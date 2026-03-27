import { Injectable, Logger } from '@nestjs/common';
import { InjectModel, InjectConnection } from '@nestjs/mongoose';
import { Model, Types, Connection, ClientSession } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { Order, OrderDocument, OrderStatus } from './schemas/order.schema';
import { Student, StudentDocument } from '../students/schemas/student.schema';
import { Invoice, InvoiceDocument, InvoiceStatus, InvoiceType } from '../invoices/schemas/invoice.schema';
import { Classroom, ClassDocument } from '../classes/schemas/class.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuditAction, AuditModule } from '../audit-log/schemas/audit-log.schema';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/schemas/notification.schema';
import { Role } from '../common/interfaces/role.enum';
import { UserStatus } from '../common/interfaces/user-status.enum';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { MarketingAttributionService } from '../marketing-attribution/marketing-attribution.service';
import { ParentAttributionSourceType } from '../marketing-attribution/schemas/parent-attribution.schema';
import {
  InvoiceReference,
  OrderCommunicationService,
  ParentAccountSummary,
} from './order-communication.service';

export interface EnrollmentResult {
  success: boolean;
  studentId?: string;
  studentCode?: string;
  invoiceIds?: string[];
  classIds?: string[];
  errors?: string[];
}

@Injectable()
export class EnrollmentService {
  private readonly logger = new Logger(EnrollmentService.name);

  constructor(
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    @InjectModel(Student.name) private readonly studentModel: Model<StudentDocument>,
    @InjectModel(Invoice.name) private readonly invoiceModel: Model<InvoiceDocument>,
    @InjectModel(Classroom.name) private readonly classModel: Model<ClassDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectConnection() private readonly connection: Connection,
    private readonly auditLogService: AuditLogService,
    private readonly notificationsService: NotificationsService,
    private readonly marketingAttributionService: MarketingAttributionService,
    private readonly orderCommunicationService: OrderCommunicationService,
  ) {}

  /**
   * Xử lý tự động khi đơn được duyệt:
   * 1. Tạo Student (nếu chưa có)
   * 2. Tạo Invoice cho mỗi item
   * 3. Cập nhật processedResults vào Order
   * 4. Đổi status → COMPLETED
   * 5. Ghi audit log + gửi thông báo
   */
  async processApprovedOrder(orderId: string, approver: JwtPayload): Promise<EnrollmentResult> {
    const errors: string[] = [];
    const order = await this.orderModel.findById(orderId).lean();
    if (!order) {
      return { success: false, errors: ['Order không tồn tại'] };
    }

    const o = order as any;

    // ── Atomic transaction: Student + Invoices + Order status ──
    const mongoSession = await this.connection.startSession();
    let studentId = '';
    let studentCode = '';
    let isNew = false;
    let invoiceIds: string[] = [];
    let invoiceRefs: InvoiceReference[] = [];
    let parentUserId = '';
    let parentAccount: ParentAccountSummary | null = null;

    try {
      await mongoSession.withTransaction(async () => {
        // ── Step 1: Tạo hoặc tìm Student ──
        const studentResult = await this.findOrCreateStudent(o, approver, mongoSession);
        studentId = studentResult.studentId;
        studentCode = studentResult.studentCode;
        isNew = studentResult.isNew;
        parentUserId = studentResult.parentUserId;
        parentAccount = studentResult.parentAccount;

        // ── Step 2: Tạo Invoice cho mỗi item ──
        invoiceIds = [];
        invoiceRefs = [];
        for (const item of o.items) {
          const invoiceRef = await this.createInvoiceForItem(o, item, studentId, approver, mongoSession);
          invoiceIds.push(invoiceRef.invoiceId);
          invoiceRefs.push(invoiceRef);
        }

        // ── Step 3: Cập nhật processedResults + status → COMPLETED ──
        await this.orderModel.findByIdAndUpdate(orderId, {
          status: OrderStatus.COMPLETED,
          parentUserId: new Types.ObjectId(parentUserId),
          processedResults: {
            studentId: new Types.ObjectId(studentId),
            invoiceIds: invoiceRefs.map((invoice) => new Types.ObjectId(invoice.invoiceId)),
            classIds: [], // Classes sẽ được tạo sau khi Invoice được duyệt thanh toán
          },
        }, { session: mongoSession });
      });
    } catch (err) {
      this.logger.error(`Enrollment transaction failed for order ${o.orderCode}: ${(err as Error).message}`);

      // Rollback: đổi lại status APPROVED để OPS xử lý thủ công
      await this.orderModel.findByIdAndUpdate(orderId, {
        status: OrderStatus.APPROVED,
      });

      return {
        success: false,
        errors: [`Enrollment thất bại: ${(err as Error).message}`],
      };
    } finally {
      await mongoSession.endSession();
    }

    // ── Non-critical operations OUTSIDE transaction ──
    try {
      if (!parentAccount) {
        throw new Error('Khong xac dinh duoc thong tin tai khoan phu huynh sau khi enrollment');
      }

      await this.marketingAttributionService.upsertParentAttribution({
        parentUserId,
        parentPhone: o.parentPhone,
        adGroupId: o.adGroupId,
        adGroupName: o.adGroupName,
        platform: o.leadSource,
        sourceOrderId: orderId,
        sourceType: ParentAttributionSourceType.STUDENT,
      });

      // ── Step 4: Audit log ──
      await this.auditLogService.log({
        userId: approver._id,
        userEmail: approver.email,
        userFullName: approver.fullName,
        userRole: approver.role,
        action: AuditAction.STATUS_CHANGE,
        module: AuditModule.ORDERS,
        targetId: orderId,
        targetName: o.orderCode,
        description: `Đơn ${o.orderCode} → COMPLETED. Tự động tạo: Student ${studentCode}${isNew ? ' (mới)' : ''}, ${invoiceIds.length} hóa đơn.`,
        newValue: { studentId, studentCode, invoiceIds, errors } as any,
      });

      // ── Step 5: Thông báo cho Sale ──
      if (o.saleId) {
        await this.notificationsService.create({
          recipientId: o.saleId.toString(),
          recipientRole: Role.SALE,
          type: NotificationType.SYSTEM,
          title: `Đơn ${o.orderCode} đã hoàn tất`,
          message: `Đơn ${o.orderCode} (${o.studentName}) đã được duyệt và xử lý tự động. Học viên: ${studentCode}, ${invoiceIds.length} hóa đơn đã tạo.`,
          link: `/app/orders?orderId=${orderId}`,
          targetId: orderId,
          targetModule: 'ORDERS',
        });
      }

      // Thông báo cho OPS
      const communicationSummary = await this.orderCommunicationService.buildSummary({
        order: o,
        parentAccount,
        studentCode,
        invoiceRefs,
        classIds: [],
      });
      await this.orderModel.findByIdAndUpdate(orderId, {
        $set: {
          'processedResults.communicationSummary': communicationSummary,
        },
      });
      await this.orderCommunicationService.sendNotifications({
        order: { ...o, _id: orderId },
        summary: communicationSummary,
        studentCode,
        parentAccount,
        invoiceRefs,
      });

      await this.notificationsService.notifyByRole(Role.OPS, {
        type: NotificationType.SYSTEM,
        title: `Enrollment tự động: ${o.orderCode}`,
        message: `Đơn ${o.orderCode} (${o.studentName}) đã xử lý xong: Student ${studentCode}, ${invoiceIds.length} hóa đơn.${errors.length ? ' Có lỗi: ' + errors.join('; ') : ''}`,
        link: `/app/orders?orderId=${orderId}`,
        targetId: orderId,
        targetModule: 'ORDERS',
      });
    } catch (notifyErr) {
      this.logger.warn(`Non-critical post-enrollment tasks failed for ${o.orderCode}: ${(notifyErr as Error).message}`);
    }

    return {
      success: errors.length === 0,
      studentId,
      studentCode,
      invoiceIds,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  // ────────────────────────────────────────────────
  //  STUDENT
  // ────────────────────────────────────────────────

  private normalizePhone(value?: string): string {
    return (value || '').trim();
  }

  private async resolveParentAccount(
    order: any,
    mongoSession?: ClientSession,
  ): Promise<ParentAccountSummary> {
    const withSession = <T>(query: any): any => (mongoSession ? query.session(mongoSession) : query);

    if (order.parentUserId) {
      const parentById = await withSession(
        this.userModel.findById(order.parentUserId).select('_id role email fullName phone').lean(),
      );
      if (!parentById) {
        throw new Error('Khong tim thay tai khoan phu huynh tu parentUserId');
      }
      if ((parentById as any).role !== Role.PARENT) {
        throw new Error('parentUserId khong phai tai khoan PHU HUYNH');
      }
      return {
        parentUserId: (parentById as any)._id.toString(),
        fullName: (parentById as any).fullName || (order.parentName || '').trim(),
        email: (parentById as any).email || '',
        phone: (parentById as any).phone || this.normalizePhone(order.parentPhone),
        source: 'LINKED_ORDER',
        wasAutoCreated: false,
      };
    }

    const email = (order.parentEmail || '').trim().toLowerCase();
    if (email) {
      const parentByEmail = await withSession(
        this.userModel
          .findOne({ email, role: Role.PARENT })
          .select('_id fullName email phone')
          .lean(),
      );
      if (parentByEmail?._id) {
        return {
          parentUserId: parentByEmail._id.toString(),
          fullName: (parentByEmail as any).fullName || (order.parentName || '').trim(),
          email: (parentByEmail as any).email || email,
          phone: (parentByEmail as any).phone || this.normalizePhone(order.parentPhone),
          source: 'MATCHED_EMAIL',
          wasAutoCreated: false,
        };
      }
    }

    const phone = this.normalizePhone(order.parentPhone);
    if (phone) {
      const parentByPhone = await withSession(
        this.userModel
          .find({ phone, role: Role.PARENT })
          .select('_id fullName email phone')
          .lean(),
      );
      if (parentByPhone.length === 1) {
        return {
          parentUserId: parentByPhone[0]._id.toString(),
          fullName: (parentByPhone[0] as any).fullName || (order.parentName || '').trim(),
          email: (parentByPhone[0] as any).email || '',
          phone: (parentByPhone[0] as any).phone || phone,
          source: 'MATCHED_PHONE',
          wasAutoCreated: false,
        };
      }
      if (parentByPhone.length > 1) {
        throw new Error('Tim thay nhieu tai khoan phu huynh trung so dien thoai');
      }

      // Auto-create PARENT user from order contact info
      const normalizedPhoneDigits = phone.replace(/\D/g, '');
      const autoEmail = `parent.${normalizedPhoneDigits}@school.local`;

      const existingAutoEmail = await withSession(
        this.userModel.findOne({ email: autoEmail }).select('_id role').lean(),
      );
      if (existingAutoEmail) {
        if ((existingAutoEmail as any).role !== Role.PARENT) {
          throw new Error(`Email tu dong ${autoEmail} da ton tai nhung khong phai tai khoan PHU HUYNH`);
        }
        return {
          parentUserId: (existingAutoEmail as any)._id.toString(),
          fullName: (order.parentName || '').trim() || `Phu huynh ${normalizedPhoneDigits}`,
          email: autoEmail,
          phone,
          source: 'MATCHED_EMAIL',
          wasAutoCreated: false,
        };
      }

      const hashedPassword = await bcrypt.hash('TempParent123!', 10);
      const parentUser = new this.userModel({
        email: autoEmail,
        password: hashedPassword,
        fullName: (order.parentName || '').trim() || `Phu huynh ${normalizedPhoneDigits}`,
        role: Role.PARENT,
        phone,
        status: UserStatus.ACTIVE,
      });
      const savedParent = mongoSession
        ? await parentUser.save({ session: mongoSession })
        : await parentUser.save();

      this.logger.log(`Auto-created PARENT user: ${autoEmail} from order ${order.orderCode || order._id}`);
      return {
        parentUserId: (savedParent as any)._id.toString(),
        fullName: (savedParent as any).fullName || (order.parentName || '').trim(),
        email: (savedParent as any).email || autoEmail,
        phone: (savedParent as any).phone || phone,
        source: 'AUTO_CREATED',
        wasAutoCreated: true,
      };
    }

    throw new Error(
      'Khong xac dinh duoc tai khoan PHU HUYNH. Vui long bo sung parentUserId hoac tao user PARENT truoc khi duyet don',
    );
  }

  private async findOrCreateStudent(
    order: any,
    approver: JwtPayload,
    mongoSession?: ClientSession,
  ): Promise<{
    studentId: string;
    studentCode: string;
    isNew: boolean;
    parentUserId: string;
    parentAccount: ParentAccountSummary;
  }> {
    const sessionOpts = mongoSession ? { session: mongoSession } : {};
    const parentAccount = await this.resolveParentAccount(order, mongoSession);
    const parentUserId = new Types.ObjectId(parentAccount.parentUserId);

    // Nếu order đã link existingStudentId → dùng luôn
    if (order.existingStudentId) {
      const existing = await this.studentModel.findById(order.existingStudentId).session(mongoSession || null).lean();
      if (existing) {
        // Cập nhật adGroupId nếu student chưa có mà order có
        const existingParentUserId = (existing as any).parentUserId?.toString();
        if (existingParentUserId && existingParentUserId !== parentUserId.toString()) {
          throw new Error('Hoc vien da duoc gan cho phu huynh khac');
        }

        const patch: Record<string, any> = { orderId: order._id };
        if (!existingParentUserId) patch.parentUserId = parentUserId;
        if (order.adGroupId && !(existing as any).adGroupId) {
          patch.adGroupId = order.adGroupId;
          patch.adGroupName = order.adGroupName || undefined;
        }
        await this.studentModel.findByIdAndUpdate(
          (existing as any)._id,
          patch,
          { session: mongoSession || undefined },
        );
        return {
          studentId: (existing as any)._id.toString(),
          studentCode: (existing as any).studentCode,
          isNew: false,
          parentUserId: parentUserId.toString(),
          parentAccount,
        };
      }
    }

    // Tìm student theo parentPhone + studentName (tránh trùng)
    const existingByPhone = await this.studentModel.findOne({
      parentPhone: order.parentPhone,
      fullName: order.studentName,
    }).session(mongoSession || null).lean();

    if (existingByPhone) {
      // Cập nhật adGroupId nếu student chưa có mà order có
      const existingParentUserId = (existingByPhone as any).parentUserId?.toString();
      if (existingParentUserId && existingParentUserId !== parentUserId.toString()) {
        throw new Error('Hoc vien da duoc gan cho phu huynh khac');
      }

      const patch: Record<string, any> = { orderId: order._id };
      if (!existingParentUserId) patch.parentUserId = parentUserId;
      if (order.adGroupId && !(existingByPhone as any).adGroupId) {
        patch.adGroupId = order.adGroupId;
        patch.adGroupName = order.adGroupName || undefined;
      }
      await this.studentModel.findByIdAndUpdate(
        (existingByPhone as any)._id,
        patch,
        { session: mongoSession || undefined },
      );
      return {
        studentId: (existingByPhone as any)._id.toString(),
        studentCode: (existingByPhone as any).studentCode,
        isNew: false,
        parentUserId: parentUserId.toString(),
        parentAccount,
      };
    }

    // Tạo student mới
    const studentCode = await this.generateStudentCode(mongoSession);
    const age = order.studentDob ? this.calculateAge(order.studentDob) : 10; // default age

    const student = new this.studentModel({
      studentCode,
      fullName: order.studentName,
      age,
      parentName: order.parentName,
      parentPhone: order.parentPhone,
      parentUserId,
      faceImage: 'default-avatar.png', // placeholder
      grade: order.studentGrade || undefined,
      saleId: order.saleId,
      saleName: order.saleName,
      orderId: order._id,
      adGroupId: order.adGroupId || undefined,
      adGroupName: order.adGroupName || undefined,
      approvalStatus: 'APPROVED', // Auto-approve khi đơn đã được Director/OPS duyệt
      approvedBy: new Types.ObjectId(approver._id),
      approvedAt: new Date(),
    });

    const saved = await student.save(sessionOpts);

    // Audit log cho student mới
    await this.auditLogService.log({
      userId: approver._id,
      userEmail: approver.email,
      userFullName: approver.fullName,
      userRole: approver.role,
      action: AuditAction.CREATE,
      module: AuditModule.STUDENTS,
      targetId: (saved as any)._id.toString(),
      targetName: studentCode,
      description: `Tự động tạo học viên ${studentCode} - ${order.studentName} từ đơn ${order.orderCode}`,
    });

    return {
      studentId: (saved as any)._id.toString(),
      studentCode,
      isNew: true,
      parentUserId: parentUserId.toString(),
      parentAccount,
    };
  }

  // ────────────────────────────────────────────────
  //  INVOICE
  // ────────────────────────────────────────────────

  private async createInvoiceForItem(
    order: any,
    item: any,
    studentId: string,
    approver: JwtPayload,
    mongoSession?: ClientSession,
  ): Promise<InvoiceReference> {
    const sessionOpts = mongoSession ? { session: mongoSession } : {};
    const invoiceNumber = await this.generateInvoiceNumber(mongoSession);

    // Tính giá theo item
    const sessions = item.sessions || 1;
    const pricePerSession = item.pricePerSession || 0;
    const amount = item.amount || sessions * pricePerSession;
    const sessionDuration = item.sessionDuration || 90;

    // Per-minute rate
    const perMinuteRate = pricePerSession && sessionDuration
      ? pricePerSession / sessionDuration
      : 0;

    const invoice = new this.invoiceModel({
      invoiceNumber,
      invoiceType: InvoiceType.TUITION,
      studentId: new Types.ObjectId(studentId),
      saleId: order.saleId ? new Types.ObjectId(order.saleId.toString()) : undefined,
      sessions,
      pricePerSession,
      referenceDuration: sessionDuration,
      perMinuteRate,
      sessionsRemaining: sessions,
      amount,
      paymentDate: new Date(), // Ngày tạo
      description: `Hóa đơn tự động từ đơn ${order.orderCode} — ${item.productName || 'Gói học'}`,
      status: InvoiceStatus.PENDING_APPROVAL,
      createdBy: new Types.ObjectId(approver._id),
    });

    const saved = await invoice.save(sessionOpts);
    const invoiceId = (saved as any)._id.toString();

    // Audit log + notifications are non-critical, run outside transaction
    // (audit log for invoice creation will be handled post-transaction in processApprovedOrder)

    return {
      invoiceId,
      invoiceNumber,
    };
  }

  // ────────────────────────────────────────────────
  //  CODE GENERATORS
  // ────────────────────────────────────────────────

  private async generateStudentCode(mongoSession?: ClientSession): Promise<string> {
    const prefix = 'HS';
    const query = this.studentModel
      .findOne({ studentCode: { $regex: `^${prefix}\\d+$` } })
      .sort({ studentCode: -1 });
    if (mongoSession) query.session(mongoSession);
    const last = await query.lean();

    let nextNum = 1;
    if (last) {
      const match = (last as any).studentCode.match(/^HS(\d+)$/);
      if (match) {
        nextNum = parseInt(match[1], 10) + 1;
      }
    }
    return `${prefix}${String(nextNum).padStart(3, '0')}`;
  }

  private async generateInvoiceNumber(mongoSession?: ClientSession): Promise<string> {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const prefix = `INV-${year}${month}-`;

    const query = this.invoiceModel
      .findOne({ invoiceNumber: { $regex: `^${prefix}` } })
      .sort({ invoiceNumber: -1 });
    if (mongoSession) query.session(mongoSession);
    const last = await query.lean();

    let nextNum = 1;
    if (last) {
      const parts = (last as any).invoiceNumber.replace(prefix, '');
      nextNum = parseInt(parts, 10) + 1;
    }
    return `${prefix}${String(nextNum).padStart(4, '0')}`;
  }

  private calculateAge(dob: Date | string): number {
    const birth = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return Math.max(3, Math.min(25, age)); // Clamp to valid range
  }
}
