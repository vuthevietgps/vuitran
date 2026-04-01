import { ConflictException, Injectable, Logger } from "@nestjs/common";
import { InjectConnection, InjectModel } from "@nestjs/mongoose";
import { ClientSession, Connection, Model, Types } from "mongoose";
import * as bcrypt from "bcrypt";
import {
  Order,
  OrderDocument,
  OrderStatus,
  OrderType,
} from "./schemas/order.schema";
import { Student, StudentDocument } from "../students/schemas/student.schema";
import {
  Invoice,
  InvoiceCourseStatus,
  InvoiceDocument,
  InvoiceStatus,
  InvoiceType,
} from "../invoices/schemas/invoice.schema";
import { Classroom, ClassDocument } from "../classes/schemas/class.schema";
import { User, UserDocument } from "../users/schemas/user.schema";
import { AuditLogService } from "../audit-log/audit-log.service";
import {
  AuditAction,
  AuditModule,
} from "../audit-log/schemas/audit-log.schema";
import { NotificationsService } from "../notifications/notifications.service";
import { NotificationType } from "../notifications/schemas/notification.schema";
import { Role } from "../common/interfaces/role.enum";
import { UserStatus } from "../common/interfaces/user-status.enum";
import { JwtPayload } from "../common/interfaces/jwt-payload.interface";
import { MarketingAttributionService } from "../marketing-attribution/marketing-attribution.service";
import { ParentAttributionSourceType } from "../marketing-attribution/schemas/parent-attribution.schema";

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
    @InjectModel(Student.name)
    private readonly studentModel: Model<StudentDocument>,
    @InjectModel(Invoice.name)
    private readonly invoiceModel: Model<InvoiceDocument>,
    @InjectModel(Classroom.name)
    private readonly classModel: Model<ClassDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectConnection() private readonly connection: Connection,
    private readonly auditLogService: AuditLogService,
    private readonly notificationsService: NotificationsService,
    private readonly marketingAttributionService: MarketingAttributionService,
  ) {}

  async processApprovedOrder(
    orderId: string,
    approver: JwtPayload,
  ): Promise<EnrollmentResult> {
    const errors: string[] = [];
    const order = await this.orderModel.findById(orderId).lean();
    if (!order) {
      return { success: false, errors: ["Order khong ton tai"] };
    }

    const o = order as any;
    const mongoSession = await this.connection.startSession();

    let studentId = "";
    let studentCode = "";
    let isNew = false;
    let parentUserId = "";
    let invoiceIds: string[] = [];

    try {
      await mongoSession.withTransaction(async () => {
        const studentResult = await this.findOrCreateStudent(
          o,
          approver,
          mongoSession,
        );
        studentId = studentResult.studentId;
        studentCode = studentResult.studentCode;
        isNew = studentResult.isNew;
        parentUserId = studentResult.parentUserId;

        invoiceIds = [];
        for (const [itemIndex, item] of (o.items || []).entries()) {
          const invoiceId = await this.createInvoiceForItem(
            o,
            item,
            itemIndex,
            studentId,
            approver,
            mongoSession,
          );
          invoiceIds.push(invoiceId);
        }

        await this.orderModel.findByIdAndUpdate(
          orderId,
          {
            status: OrderStatus.APPROVED,
            parentUserId: new Types.ObjectId(parentUserId),
            processedResults: {
              studentId: new Types.ObjectId(studentId),
              invoiceIds: invoiceIds.map((id) => new Types.ObjectId(id)),
              classIds: [],
            },
          },
          { session: mongoSession },
        );
      });
    } catch (err) {
      this.logger.error(
        `Enrollment transaction failed for order ${o.orderCode}: ${(err as Error).message}`,
      );

      await this.orderModel.findByIdAndUpdate(orderId, {
        status: OrderStatus.APPROVED,
      });

      return {
        success: false,
        errors: [`Enrollment that bai: ${(err as Error).message}`],
      };
    } finally {
      await mongoSession.endSession();
    }

    try {
      await this.marketingAttributionService.upsertParentAttribution({
        parentUserId,
        parentPhone: o.parentPhone,
        adGroupId: o.adGroupId,
        adGroupName: o.adGroupName,
        platform: o.leadSource,
        sourceOrderId: orderId,
        sourceType: ParentAttributionSourceType.STUDENT,
      });

      await this.auditLogService.log({
        userId: approver._id,
        userEmail: approver.email,
        userFullName: approver.fullName,
        userRole: approver.role,
        action: AuditAction.STATUS_CHANGE,
        module: AuditModule.ORDERS,
        targetId: orderId,
        targetName: o.orderCode,
        description:
          `Don ${o.orderCode} da khoi tao du lieu tu dong: Student ${studentCode}` +
          `${isNew ? " (moi)" : ""}, ${invoiceIds.length} hoa don. Cho tao/ghep lop de hoan tat.`,
        newValue: { studentId, studentCode, invoiceIds, errors } as any,
      });

      if (o.saleId) {
        await this.notificationsService.create({
          recipientId: o.saleId.toString(),
          recipientRole: Role.SALE,
          type: NotificationType.SYSTEM,
          title: `Don ${o.orderCode} da khoi tao du lieu`,
          message:
            `Don ${o.orderCode} (${o.studentName}) da duoc duyet va khoi tao tu dong. ` +
            `Hoc vien: ${studentCode}, ${invoiceIds.length} hoa don da tao. ` +
            `Tiep tuc duyet hoa don va tao/ghep lop de hoan tat.`,
          link: `/orders`,
          targetId: orderId,
          targetModule: "ORDERS",
        });
      }

      await this.notificationsService.notifyByRole(Role.OPS, {
        type: NotificationType.SYSTEM,
        title: `Khoi tao enrollment tu dong: ${o.orderCode}`,
        message:
          `Don ${o.orderCode} (${o.studentName}) da khoi tao xong: ` +
          `Student ${studentCode}, ${invoiceIds.length} hoa don.` +
          (errors.length ? ` Co loi: ${errors.join("; ")}` : ""),
        link: `/orders`,
        targetId: orderId,
        targetModule: "ORDERS",
      });
    } catch (notifyErr) {
      this.logger.warn(
        `Non-critical post-enrollment tasks failed for ${o.orderCode}: ${(notifyErr as Error).message}`,
      );
    }

    return {
      success: errors.length === 0,
      studentId,
      studentCode,
      invoiceIds,
      classIds: [],
      errors: errors.length ? errors : undefined,
    };
  }

  private normalizePhone(value?: string): string {
    return (value || "").trim();
  }

  private normalizeOptionalText(value?: string | null): string | undefined {
    const normalized = String(value ?? "").trim();
    return normalized || undefined;
  }

  private roundMoneyToThousand(value?: number): number {
    const normalized = Number(value || 0);
    if (!Number.isFinite(normalized) || normalized <= 0) return 0;
    return Math.round(normalized / 1000) * 1000;
  }

  private roundMoneyDownToThousand(value?: number): number {
    const normalized = Number(value || 0);
    if (!Number.isFinite(normalized) || normalized <= 0) return 0;
    return Math.floor(normalized / 1000) * 1000;
  }

  private floorSessionCount(value?: number): number {
    const normalized = Number(value || 0);
    if (!Number.isFinite(normalized) || normalized <= 0) return 0;
    return Math.floor(normalized);
  }

  private hasExplicitValue(value: unknown): boolean {
    return value !== undefined && value !== null && value !== "";
  }

  private resolveOrderCommissionBaseAmount(order: any, fallbackAmount?: number): number {
    const totalAmount = this.roundMoneyToThousand(order?.totalAmount || 0);
    if (totalAmount > 0) return totalAmount;

    const summedItemAmount = Array.isArray(order?.items)
      ? this.roundMoneyToThousand(
          order.items.reduce(
            (sum: number, item: any) => sum + Math.max(0, Number(item?.amount || 0)),
            0,
          ),
        )
      : 0;
    if (summedItemAmount > 0) return summedItemAmount;

    const finalAmount = this.roundMoneyToThousand(order?.finalAmount || 0);
    if (finalAmount > 0) return finalAmount;

    return this.roundMoneyToThousand(fallbackAmount || 0);
  }

  private resolveOrderItemBaseAmounts(order: any): number[] {
    if (!Array.isArray(order?.items)) return [];
    return order.items.map((item: any) =>
      this.roundMoneyToThousand(Math.max(0, Number(item?.amount || 0))),
    );
  }

  private resolveDistributedMoneyAmount(
    order: any,
    totalTargetAmount: number,
    itemIndex: number,
    fallbackAmount: number,
  ): number {
    const targetAmount = this.roundMoneyToThousand(totalTargetAmount || 0);
    if (targetAmount <= 0) return 0;

    const baseAmount = this.roundMoneyToThousand(fallbackAmount || 0);
    const itemBaseAmounts = this.resolveOrderItemBaseAmounts(order);
    const currentItemBaseAmount =
      itemBaseAmounts[itemIndex] && itemBaseAmounts[itemIndex] > 0
        ? itemBaseAmounts[itemIndex]
        : baseAmount;
    if (currentItemBaseAmount <= 0) return 0;

    const baseTotalAmount = this.resolveOrderCommissionBaseAmount(order, currentItemBaseAmount);
    if (baseTotalAmount <= 0) return currentItemBaseAmount;

    if (itemBaseAmounts.length > 1 && itemIndex === itemBaseAmounts.length - 1) {
      const allocatedBefore = itemBaseAmounts
        .slice(0, itemIndex)
        .reduce(
          (sum, itemAmount) =>
            sum +
            this.roundMoneyToThousand(
              (Math.max(0, itemAmount) / Math.max(baseTotalAmount, 1)) * targetAmount,
            ),
          0,
        );
      return this.roundMoneyToThousand(Math.max(0, targetAmount - allocatedBefore));
    }

    return this.roundMoneyToThousand(
      (currentItemBaseAmount / Math.max(baseTotalAmount, 1)) * targetAmount,
    );
  }

  private resolveDistributedCommissionAmount(
    order: any,
    totalCommission: number,
    itemIndex: number,
    fallbackAmount: number,
  ): number {
    const normalizedCommission = Math.max(0, Number(totalCommission || 0));
    if (!Number.isFinite(normalizedCommission) || normalizedCommission <= 0) return 0;

    const baseAmount = this.roundMoneyToThousand(fallbackAmount || 0);
    const itemBaseAmounts = this.resolveOrderItemBaseAmounts(order);
    const currentItemBaseAmount =
      itemBaseAmounts[itemIndex] && itemBaseAmounts[itemIndex] > 0
        ? itemBaseAmounts[itemIndex]
        : baseAmount;
    if (currentItemBaseAmount <= 0) return 0;

    const baseTotalAmount = this.resolveOrderCommissionBaseAmount(order, currentItemBaseAmount);
    if (baseTotalAmount <= 0) return normalizedCommission;

    if (itemBaseAmounts.length > 1 && itemIndex === itemBaseAmounts.length - 1) {
      const allocatedBefore = itemBaseAmounts
        .slice(0, itemIndex)
        .reduce(
          (sum, itemAmount) =>
            sum +
            Math.round(
              (Math.max(0, itemAmount) / Math.max(baseTotalAmount, 1)) *
                normalizedCommission,
            ),
          0,
        );
      return Math.max(0, normalizedCommission - allocatedBefore);
    }

    return Math.round(
      (currentItemBaseAmount / Math.max(baseTotalAmount, 1)) * normalizedCommission,
    );
  }

  private normalizeEmail(value?: string | null): string | undefined {
    const normalized = this.normalizeOptionalText(value)?.toLowerCase();
    return normalized || undefined;
  }

  private normalizeUserCode(value?: string | null): string | undefined {
    const normalized = this.normalizeOptionalText(value)?.toUpperCase();
    return normalized || undefined;
  }

  private withSession<T>(query: T, mongoSession?: ClientSession): T {
    return (mongoSession ? (query as any).session(mongoSession) : query) as T;
  }

  private async generateParentUserCode(
    mongoSession?: ClientSession,
  ): Promise<string> {
    const prefix = "PH";
    const last = await this.withSession(
      this.userModel
        .findOne({ userCode: { $regex: `^${prefix}\\d+$` } })
        .select("userCode")
        .sort({ userCode: -1 })
        .lean(),
      mongoSession,
    );

    let nextNum = 1;
    const match = (last as any)?.userCode?.match?.(/^PH(\d+)$/);
    if (match) {
      nextNum = parseInt(match[1], 10) + 1;
    }

    return `${prefix}${String(nextNum).padStart(4, "0")}`;
  }

  private deriveBirthMonth(
    explicitMonth?: number | null,
    dateLike?: Date | string | null,
  ): number | undefined {
    if (explicitMonth && explicitMonth >= 1 && explicitMonth <= 12) {
      return explicitMonth;
    }

    if (!dateLike) {
      return undefined;
    }

    const parsed = new Date(dateLike);
    if (Number.isNaN(parsed.getTime())) {
      return undefined;
    }

    return parsed.getMonth() + 1;
  }

  private getPrimaryOrderItem(order: any): any | null {
    if (!Array.isArray(order?.items) || !order.items.length) {
      return null;
    }
    return order.items[0];
  }

  private derivePreferredTeachingMode(
    order: any,
  ): "ONLINE" | "OFFLINE" | "BOTH" {
    const modes = Array.from(
      new Set(
        (Array.isArray(order?.items) ? order.items : [])
          .map((item: any) => String(item?.teachingMode || "").toUpperCase())
          .filter((mode: string) => mode === "ONLINE" || mode === "OFFLINE"),
      ),
    );

    if (modes.length === 1) {
      return modes[0] as "ONLINE" | "OFFLINE";
    }
    return "BOTH";
  }

  private deriveStudentLearningNeeds(order: any): string | undefined {
    const notes = [
      this.normalizeOptionalText(order?.consultationNotes),
      ...(Array.isArray(order?.items)
        ? order.items
            .flatMap((item: any) => [
              this.normalizeOptionalText(item?.learningGoals),
              this.normalizeOptionalText(item?.notes),
            ])
            .filter((value: string | undefined): value is string => !!value)
        : []),
    ].filter((value): value is string => !!value);

    if (!notes.length) {
      return undefined;
    }

    return Array.from(new Set(notes)).join(" | ");
  }

  private deriveStudentSubjects(order: any): string[] | undefined {
    const subjects = Array.isArray(order?.items)
      ? order.items
          .map((item: any) => this.normalizeOptionalText(item?.subject))
          .filter((value: string | undefined): value is string => !!value)
      : [];

    if (!subjects.length) {
      return undefined;
    }

    return Array.from(new Set(subjects));
  }

  private deriveStudentAge(order: any): number {
    if (Number.isFinite(order?.studentAge)) {
      return Math.max(3, Math.min(25, Number(order.studentAge)));
    }

    if (order?.studentDob) {
      return this.calculateAge(order.studentDob);
    }

    return 10;
  }

  private buildStudentUpdatePatch(
    order: any,
    parentUserId: Types.ObjectId,
    existingStudent?: any,
  ): Record<string, any> {
    const primaryItem = this.getPrimaryOrderItem(order);
    const preferredTeachingMode = this.derivePreferredTeachingMode(order);
    const learningNeeds = this.deriveStudentLearningNeeds(order);
    const subjects = this.deriveStudentSubjects(order);
    const faceImage = this.normalizeOptionalText(order?.studentFaceImage);
    const studentBirthMonth = this.deriveBirthMonth(
      order?.studentBirthMonth,
      order?.studentDob,
    );
    const parentBirthMonth = this.deriveBirthMonth(
      order?.parentBirthMonth,
      null,
    );
    const productPackageId =
      primaryItem?.productId && Types.ObjectId.isValid(primaryItem.productId)
        ? new Types.ObjectId(primaryItem.productId)
        : undefined;

    const patch: Record<string, any> = {
      orderId: order._id,
      parentUserId,
    };

    if (
      !existingStudent?.parentName &&
      this.normalizeOptionalText(order?.parentName)
    ) {
      patch.parentName = this.normalizeOptionalText(order.parentName);
    }
    if (
      !existingStudent?.parentPhone &&
      this.normalizeOptionalText(order?.parentPhone)
    ) {
      patch.parentPhone = this.normalizeOptionalText(order.parentPhone);
    }
    if (
      !existingStudent?.grade &&
      this.normalizeOptionalText(order?.studentGrade)
    ) {
      patch.grade = this.normalizeOptionalText(order.studentGrade);
    }
    if (
      !existingStudent?.level &&
      this.normalizeOptionalText(order?.studentLevel)
    ) {
      patch.level = this.normalizeOptionalText(order.studentLevel);
    }
    if (
      (!existingStudent?.age || existingStudent.age < 3) &&
      this.deriveStudentAge(order)
    ) {
      patch.age = this.deriveStudentAge(order);
    }
    if (!existingStudent?.studentBirthMonth && studentBirthMonth) {
      patch.studentBirthMonth = studentBirthMonth;
    }
    if (!existingStudent?.parentBirthMonth && parentBirthMonth) {
      patch.parentBirthMonth = parentBirthMonth;
    }
    if (
      faceImage &&
      (!existingStudent?.faceImage ||
        existingStudent.faceImage === "default-avatar.png")
    ) {
      patch.faceImage = faceImage;
    }
    if (!existingStudent?.productPackage && productPackageId) {
      patch.productPackage = productPackageId;
    }
    if (!existingStudent?.preferredTeachingMode) {
      patch.preferredTeachingMode = preferredTeachingMode;
    }
    if (preferredTeachingMode !== "BOTH" && !existingStudent?.studentType) {
      patch.studentType = preferredTeachingMode;
    }
    if (!existingStudent?.learningNeeds && learningNeeds) {
      patch.learningNeeds = learningNeeds;
    }
    if (
      (!Array.isArray(existingStudent?.subjects) ||
        !existingStudent.subjects.length) &&
      subjects?.length
    ) {
      patch.subjects = subjects;
    }
    if (
      order?.saleId &&
      !existingStudent?.saleId &&
      Types.ObjectId.isValid(order.saleId.toString())
    ) {
      patch.saleId = new Types.ObjectId(order.saleId.toString());
      patch.saleName = order.saleName || existingStudent?.saleName;
    }
    if (order?.adGroupId && !existingStudent?.adGroupId) {
      patch.adGroupId = order.adGroupId;
      patch.adGroupName = order.adGroupName || undefined;
    }

    return patch;
  }

  private async syncParentUserFromOrder(
    parentUserId: Types.ObjectId,
    order: any,
    mongoSession?: ClientSession,
  ): Promise<void> {
    const parent = await this.withSession(
      this.userModel
        .findById(parentUserId)
        .select(
          "fullName email phone userCode saleOwnerId address facebookLink",
        )
        .lean(),
      mongoSession,
    );

    if (!parent) {
      return;
    }

    const update: Record<string, any> = {};
    const normalizedEmail = this.normalizeEmail(order.parentEmail);
    const normalizedCode = this.normalizeUserCode(order.parentUserCode);
    const normalizedPhone = this.normalizeOptionalText(order.parentPhone);
    const normalizedName = this.normalizeOptionalText(order.parentName);
    const normalizedAddress = this.normalizeOptionalText(order.parentAddress);
    const normalizedFacebookLink = this.normalizeOptionalText(
      order.parentFacebookLink,
    );

    if (
      normalizedEmail &&
      (!parent.email || parent.email.endsWith("@school.local")) &&
      parent.email !== normalizedEmail
    ) {
      const existingEmailUser = await this.withSession(
        this.userModel.findOne({ email: normalizedEmail }).select("_id").lean(),
        mongoSession,
      );
      if (
        !existingEmailUser ||
        existingEmailUser._id.toString() === parentUserId.toString()
      ) {
        update.email = normalizedEmail;
      }
    }

    if (normalizedPhone && !parent.phone) {
      update.phone = normalizedPhone;
    }

    if (
      normalizedName &&
      (!parent.fullName || parent.fullName.startsWith("Phu huynh "))
    ) {
      update.fullName = normalizedName;
    }

    if (!parent.userCode) {
      if (normalizedCode) {
        const existingCodeUser = await this.withSession(
          this.userModel
            .findOne({ userCode: normalizedCode })
            .select("_id")
            .lean(),
          mongoSession,
        );
        if (
          !existingCodeUser ||
          existingCodeUser._id.toString() === parentUserId.toString()
        ) {
          update.userCode = normalizedCode;
        }
      } else {
        update.userCode = await this.generateParentUserCode(mongoSession);
      }
    }

    if (normalizedAddress && !parent.address) {
      update.address = normalizedAddress;
    }

    if (normalizedFacebookLink && !parent.facebookLink) {
      update.facebookLink = normalizedFacebookLink;
    }

    if (
      order?.saleId &&
      !parent.saleOwnerId &&
      Types.ObjectId.isValid(order.saleId.toString())
    ) {
      update.saleOwnerId = new Types.ObjectId(order.saleId.toString());
      update.saleOwnerName = order.saleName || "";
    }

    if (Object.keys(update).length) {
      await this.userModel.findByIdAndUpdate(parentUserId, update, {
        session: mongoSession || undefined,
      });
    }
  }

  private async resolveParentUserId(
    order: any,
    mongoSession?: ClientSession,
  ): Promise<Types.ObjectId> {
    if (order.parentUserId) {
      const parentById = await this.withSession(
        this.userModel.findById(order.parentUserId).select("_id role").lean(),
        mongoSession,
      );

      if (!parentById) {
        throw new Error("Khong tim thay tai khoan phu huynh tu parentUserId");
      }
      if ((parentById as any).role !== Role.PARENT) {
        throw new Error("parentUserId khong phai tai khoan PHU HUYNH");
      }

      const parentId = new Types.ObjectId((parentById as any)._id);
      await this.syncParentUserFromOrder(parentId, order, mongoSession);
      return parentId;
    }

    const parentUserCode = this.normalizeUserCode(order.parentUserCode);
    if (parentUserCode) {
      const parentByCode = await this.withSession(
        this.userModel
          .findOne({ userCode: parentUserCode })
          .select("_id role")
          .lean(),
        mongoSession,
      );

      if (parentByCode) {
        if ((parentByCode as any).role !== Role.PARENT) {
          throw new Error(
            `Ma tai khoan ${parentUserCode} da ton tai nhung khong phai tai khoan PHU HUYNH`,
          );
        }
        const parentId = new Types.ObjectId((parentByCode as any)._id);
        await this.syncParentUserFromOrder(parentId, order, mongoSession);
        return parentId;
      }
    }

    const email = this.normalizeEmail(order.parentEmail);
    if (email) {
      const userByEmail = await this.withSession(
        this.userModel.findOne({ email }).select("_id role").lean(),
        mongoSession,
      );

      if (userByEmail?._id) {
        if ((userByEmail as any).role !== Role.PARENT) {
          throw new Error(
            `Email ${email} da ton tai nhung khong phai tai khoan PHU HUYNH`,
          );
        }
        const parentId = new Types.ObjectId(userByEmail._id);
        await this.syncParentUserFromOrder(parentId, order, mongoSession);
        return parentId;
      }
    }

    const phone = this.normalizePhone(order.parentPhone);
    if (!phone) {
      throw new Error(
        "Khong xac dinh duoc tai khoan PHU HUYNH. Vui long bo sung parentUserId hoac tao user PARENT truoc khi duyet don",
      );
    }

    const parentByPhone = await this.withSession(
      this.userModel
        .find({ phone, role: Role.PARENT })
        .select("_id email userCode")
        .lean(),
      mongoSession,
    );

    let narrowedParents = parentByPhone;
    if (email && narrowedParents.length > 1) {
      const exactEmailMatches = narrowedParents.filter(
        (parent: any) => parent.email === email,
      );
      if (exactEmailMatches.length === 1) {
        narrowedParents = exactEmailMatches;
      }
    }
    if (parentUserCode && narrowedParents.length > 1) {
      const exactCodeMatches = narrowedParents.filter(
        (parent: any) => parent.userCode === parentUserCode,
      );
      if (exactCodeMatches.length === 1) {
        narrowedParents = exactCodeMatches;
      }
    }

    if (narrowedParents.length === 1) {
      const parentId = new Types.ObjectId(narrowedParents[0]._id);
      await this.syncParentUserFromOrder(parentId, order, mongoSession);
      return parentId;
    }

    if (narrowedParents.length > 1) {
      throw new Error("Tim thay nhieu tai khoan phu huynh trung so dien thoai");
    }

    const normalizedPhoneDigits = phone.replace(/\D/g, "");
    const preferredEmail =
      email || `parent.${normalizedPhoneDigits}@school.local`;
    const existingPreferredEmail = await this.withSession(
      this.userModel
        .findOne({ email: preferredEmail })
        .select("_id role")
        .lean(),
      mongoSession,
    );

    if (existingPreferredEmail) {
      if ((existingPreferredEmail as any).role !== Role.PARENT) {
        throw new Error(
          `Email ${preferredEmail} da ton tai nhung khong phai tai khoan PHU HUYNH`,
        );
      }
      const parentId = new Types.ObjectId((existingPreferredEmail as any)._id);
      await this.syncParentUserFromOrder(parentId, order, mongoSession);
      return parentId;
    }

    const hashedPassword = await bcrypt.hash("123456", 10);
    const generatedUserCode =
      parentUserCode || (await this.generateParentUserCode(mongoSession));
    const parentUser = new this.userModel({
      email: preferredEmail,
      userCode: generatedUserCode,
      password: hashedPassword,
      fullName:
        this.normalizeOptionalText(order.parentName) ||
        `Phu huynh ${normalizedPhoneDigits}`,
      role: Role.PARENT,
      phone,
      status: UserStatus.ACTIVE,
      saleOwnerId:
        order?.saleId && Types.ObjectId.isValid(order.saleId.toString())
          ? new Types.ObjectId(order.saleId.toString())
          : undefined,
      saleOwnerName: order?.saleName || undefined,
      address: this.normalizeOptionalText(order.parentAddress),
      facebookLink: this.normalizeOptionalText(order.parentFacebookLink),
    });

    const savedParent = mongoSession
      ? await parentUser.save({ session: mongoSession })
      : await parentUser.save();

    this.logger.log(
      `Auto-created PARENT user ${preferredEmail} from order ${order.orderCode || order._id}`,
    );

    return new Types.ObjectId((savedParent as any)._id);
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
  }> {
    const sessionOpts = mongoSession ? { session: mongoSession } : {};
    const parentUserId = await this.resolveParentUserId(order, mongoSession);
    const primaryItem = this.getPrimaryOrderItem(order);
    const requestedStudentCode = this.normalizeOptionalText(
      order?.studentCode,
    )?.toUpperCase();

    if (order.existingStudentId) {
      const existing = await this.studentModel
        .findById(order.existingStudentId)
        .session(mongoSession || null)
        .lean();

      if (existing) {
        if (
          requestedStudentCode &&
          requestedStudentCode !==
            String((existing as any).studentCode || "")
              .trim()
              .toUpperCase()
        ) {
          throw new ConflictException(
            "Ma hoc sinh khong khop voi hoc sinh da lien ket",
          );
        }
        const existingParentUserId = (existing as any).parentUserId?.toString();
        if (
          existingParentUserId &&
          existingParentUserId !== parentUserId.toString()
        ) {
          throw new Error("Hoc vien da duoc gan cho phu huynh khac");
        }

        const patch = this.buildStudentUpdatePatch(
          order,
          parentUserId,
          existing,
        );
        if (!existingParentUserId) {
          patch.parentUserId = parentUserId;
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
        };
      }
    }

    const existingByPhone = await this.studentModel
      .findOne({
        parentPhone: order.parentPhone,
        fullName: order.studentName,
      })
      .session(mongoSession || null)
      .lean();

    if (existingByPhone) {
      if (
        requestedStudentCode &&
        requestedStudentCode !==
          String((existingByPhone as any).studentCode || "")
            .trim()
            .toUpperCase()
      ) {
        throw new ConflictException(
          "Ma hoc sinh khong khop voi hoc sinh trung thong tin phu huynh",
        );
      }
      const existingParentUserId = (
        existingByPhone as any
      ).parentUserId?.toString();
      if (
        existingParentUserId &&
        existingParentUserId !== parentUserId.toString()
      ) {
        throw new Error("Hoc vien da duoc gan cho phu huynh khac");
      }

      const patch = this.buildStudentUpdatePatch(
        order,
        parentUserId,
        existingByPhone,
      );
      if (!existingParentUserId) {
        patch.parentUserId = parentUserId;
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
      };
    }

    const studentCode = await this.resolveStudentCode(order, mongoSession);
    const preferredTeachingMode = this.derivePreferredTeachingMode(order);
    const learningNeeds = this.deriveStudentLearningNeeds(order);
    const subjects = this.deriveStudentSubjects(order);
    const productPackageId =
      primaryItem?.productId && Types.ObjectId.isValid(primaryItem.productId)
        ? new Types.ObjectId(primaryItem.productId)
        : undefined;
    const saleId =
      order?.saleId && Types.ObjectId.isValid(order.saleId.toString())
        ? new Types.ObjectId(order.saleId.toString())
        : undefined;

    const student = new this.studentModel({
      studentCode,
      fullName: order.studentName,
      age: this.deriveStudentAge(order),
      studentBirthMonth: this.deriveBirthMonth(
        order.studentBirthMonth,
        order.studentDob,
      ),
      parentBirthMonth: this.deriveBirthMonth(order.parentBirthMonth, null),
      parentName: order.parentName,
      parentPhone: order.parentPhone,
      parentUserId,
      faceImage:
        this.normalizeOptionalText(order.studentFaceImage) ||
        "default-avatar.png",
      productPackage: productPackageId,
      learningNeeds,
      subjects,
      grade: order.studentGrade || undefined,
      level: this.normalizeOptionalText(order.studentLevel),
      preferredTeachingMode,
      studentType:
        preferredTeachingMode !== "BOTH" ? preferredTeachingMode : undefined,
      saleId,
      saleName: order.saleName || undefined,
      orderId: order._id,
      adGroupId: order.adGroupId || undefined,
      adGroupName: order.adGroupName || undefined,
      approvalStatus: "APPROVED",
      approvedBy: new Types.ObjectId(approver._id),
      approvedAt: new Date(),
    });

    const saved = await student.save(sessionOpts);

    await this.auditLogService.log({
      userId: approver._id,
      userEmail: approver.email,
      userFullName: approver.fullName,
      userRole: approver.role,
      action: AuditAction.CREATE,
      module: AuditModule.STUDENTS,
      targetId: (saved as any)._id.toString(),
      targetName: studentCode,
      description: `Tu dong tao hoc vien ${studentCode} - ${order.studentName} tu don ${order.orderCode}`,
    });

    return {
      studentId: (saved as any)._id.toString(),
      studentCode,
      isNew: true,
      parentUserId: parentUserId.toString(),
    };
  }

  private async resolveStudentCode(
    order: any,
    mongoSession?: ClientSession,
  ): Promise<string> {
    const preferredStudentCode = this.normalizeOptionalText(
      order?.studentCode,
    )?.toUpperCase();
    if (!preferredStudentCode) {
      return this.generateStudentCode(mongoSession);
    }

    const existingQuery = this.studentModel
      .findOne({ studentCode: preferredStudentCode })
      .select("_id");

    if (mongoSession) {
      existingQuery.session(mongoSession);
    }

    const existing = await existingQuery.lean();
    if (existing) {
      throw new ConflictException("Ma hoc sinh da ton tai");
    }

    return preferredStudentCode;
  }

  private async getNextInvoicePaymentRound(
    studentId: string,
    mongoSession?: ClientSession,
  ): Promise<number> {
    const query = this.invoiceModel.countDocuments({
      studentId: new Types.ObjectId(studentId),
      status: { $nin: [InvoiceStatus.CANCELLED, InvoiceStatus.REJECTED] },
    });

    if (mongoSession) {
      query.session(mongoSession);
    }

    const previousInvoices = await query;
    return previousInvoices + 1;
  }

  private deriveInvoiceCourseStatus(
    orderType: string | undefined,
    paymentRound: number,
  ): InvoiceCourseStatus {
    if (orderType === OrderType.NEW_ENROLLMENT) {
      return InvoiceCourseStatus.NEW;
    }

    const continuationStatuses = [
      InvoiceCourseStatus.CONTINUE_1,
      InvoiceCourseStatus.CONTINUE_2,
      InvoiceCourseStatus.CONTINUE_3,
      InvoiceCourseStatus.CONTINUE_4,
      InvoiceCourseStatus.CONTINUE_5,
    ];
    const continuationIndex = Math.min(
      Math.max(paymentRound - 1, 1),
      continuationStatuses.length,
    );
    return continuationStatuses[continuationIndex - 1];
  }

  private async createInvoiceForItem(
    order: any,
    item: any,
    itemIndex: number,
    studentId: string,
    approver: JwtPayload,
    mongoSession?: ClientSession,
  ): Promise<string> {
    const sessionOpts = mongoSession ? { session: mongoSession } : {};
    const manualInvoiceNumber = this.normalizeOptionalText(item.invoiceNumber);
    const invoiceNumber =
      manualInvoiceNumber || (await this.generateInvoiceNumber(mongoSession));
    const requestedPaymentRound = Number(item.paymentRound || 0);
    const paymentRound =
      requestedPaymentRound > 0
        ? requestedPaymentRound
        : await this.getNextInvoicePaymentRound(studentId, mongoSession);

    if (manualInvoiceNumber) {
      const existingInvoiceQuery = this.invoiceModel
        .findOne({ invoiceNumber })
        .select("_id");
      if (mongoSession) {
        existingInvoiceQuery.session(mongoSession);
      }

      const existingInvoice = await existingInvoiceQuery.lean();
      if (existingInvoice) {
        throw new ConflictException(`So hoa don ${invoiceNumber} da ton tai`);
      }
    }

    const courseSessions = Math.max(1, this.floorSessionCount(item.sessions || 1));
    const requestedInvoiceSessions = this.hasExplicitValue(item.invoiceSessions)
      ? this.floorSessionCount(item.invoiceSessions)
      : courseSessions;
    const sessionDuration = item.sessionDuration || 90;
    const baseDuration = Number(item.baseDuration || 0) || sessionDuration;
    const pricePerSession = this.roundMoneyToThousand(item.pricePerSession || 0);
    const perMinuteRate =
      pricePerSession && baseDuration ? pricePerSession / baseDuration : 0;
    const effectivePricePerSession = perMinuteRate
      ? this.roundMoneyToThousand(perMinuteRate * sessionDuration)
      : pricePerSession;
    const classType = item.teachingMode || "ONLINE";
    const trialSessions = this.floorSessionCount(item.trialSessions || 0);
    const hasExplicitAmount =
      item.amount !== undefined && item.amount !== null && item.amount !== "";
    const baseAmount = this.roundMoneyToThousand(
      hasExplicitAmount
        ? Number(item.amount || 0)
        : requestedInvoiceSessions * effectivePricePerSession,
    );
    const isOfflineTrialZeroAmountInvoice =
      String(classType).trim().toUpperCase() === "OFFLINE" &&
      trialSessions > 0 &&
      baseAmount <= 0;
    const amount = isOfflineTrialZeroAmountInvoice
      ? 0
      : this.resolveDistributedMoneyAmount(
          order,
          Number(order?.finalAmount || 0) > 0
            ? Number(order.finalAmount)
            : baseAmount,
          itemIndex,
          baseAmount,
        );
    const invoiceSessions = isOfflineTrialZeroAmountInvoice
      ? Math.max(0, requestedInvoiceSessions)
      : Math.max(1, requestedInvoiceSessions || courseSessions);
    const courseStatus =
      item.courseStatus ||
      this.deriveInvoiceCourseStatus(order.orderType, paymentRound);
    const bonusSessions = this.floorSessionCount(item.bonusSessions || 0);
    const parsedPaymentDate = order?.paymentDate
      ? new Date(order.paymentDate)
      : null;
    const paymentDate =
      parsedPaymentDate && !Number.isNaN(parsedPaymentDate.getTime())
        ? parsedPaymentDate
        : order.approvedAt || new Date();

    const saleId =
      order?.saleId && Types.ObjectId.isValid(order.saleId.toString())
        ? new Types.ObjectId(order.saleId.toString())
        : undefined;
    const createdBy = saleId || new Types.ObjectId(approver._id);
    const saleCommission = this.resolveDistributedCommissionAmount(
      order,
      Number(order?.saleCommission || 0),
      itemIndex,
      baseAmount,
    );

    const invoice = new this.invoiceModel({
      invoiceNumber,
      invoiceType: InvoiceType.TUITION,
      studentId: new Types.ObjectId(studentId),
      orderId: new Types.ObjectId(order._id),
      orderItemIndex: itemIndex,
      productId:
        item.productId && Types.ObjectId.isValid(item.productId)
          ? new Types.ObjectId(item.productId)
          : undefined,
      productName: item.productName || undefined,
      requestedClassId:
        item.selectedClassId && Types.ObjectId.isValid(item.selectedClassId)
          ? new Types.ObjectId(item.selectedClassId)
          : undefined,
      requestedTeacherId:
        item.preferredTeacherId &&
        Types.ObjectId.isValid(item.preferredTeacherId)
          ? new Types.ObjectId(item.preferredTeacherId)
          : undefined,
      saleId,
      saleCommission,
      classType,
      sessions: invoiceSessions,
      bonusSessions,
      bonusSessionsRemaining: bonusSessions,
      trialSessions,
      trialSessionsRemaining: trialSessions,
      paymentRound,
      courseStatus,
      pricePerSession,
      teacherPayPerSession: this.roundMoneyDownToThousand(
        Number(item.teacherPayPerSession || 0),
      ),
      referenceDuration: baseDuration,
      perMinuteRate,
      sessionsRemaining: invoiceSessions,
      amount,
      paymentDate,
      receiptImage: this.normalizeOptionalText(order.receiptImage),
      description:
        this.normalizeOptionalText(item.invoiceDescription) ||
        `Hoa don tu dong tu don ${order.orderCode} - ${item.productName || "Goi hoc"}`,
      status: InvoiceStatus.PENDING_APPROVAL,
      createdBy,
    });

    let saved: InvoiceDocument;
    try {
      saved = await invoice.save(sessionOpts);
    } catch (error: any) {
      if (
        error?.code === 11000 &&
        (error?.keyPattern?.invoiceNumber || error?.keyValue?.invoiceNumber)
      ) {
        throw new ConflictException(`So hoa don ${invoiceNumber} da ton tai`);
      }
      throw error;
    }

    return (saved as any)._id.toString();
  }

  private async generateStudentCode(
    mongoSession?: ClientSession,
  ): Promise<string> {
    const prefix = "HS";
    const query = this.studentModel
      .findOne({ studentCode: { $regex: `^${prefix}\\d+$` } })
      .sort({ studentCode: -1 });

    if (mongoSession) {
      query.session(mongoSession);
    }

    const last = await query.lean();
    let nextNum = 1;
    const match = (last as any)?.studentCode?.match?.(/^HS(\d+)$/);
    if (match) {
      nextNum = parseInt(match[1], 10) + 1;
    }

    return `${prefix}${String(nextNum).padStart(3, "0")}`;
  }

  private async generateInvoiceNumber(
    mongoSession?: ClientSession,
  ): Promise<string> {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, "0");
    const prefix = `INV-${year}${month}-`;

    const query = this.invoiceModel
      .findOne({ invoiceNumber: { $regex: `^${prefix}` } })
      .sort({ invoiceNumber: -1 });

    if (mongoSession) {
      query.session(mongoSession);
    }

    const last = await query.lean();
    let nextNum = 1;
    if (last) {
      const suffix = (last as any).invoiceNumber.replace(prefix, "");
      nextNum = parseInt(suffix, 10) + 1;
    }

    return `${prefix}${String(nextNum).padStart(4, "0")}`;
  }

  private calculateAge(dob: Date | string): number {
    const birth = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();

    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birth.getDate())
    ) {
      age--;
    }

    return Math.max(3, Math.min(25, age));
  }
}
