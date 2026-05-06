import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Classroom,
  ClassMode,
  ClassDocument,
  ClassEditHistoryAction,
  ClassStatus,
  DurationSnapshotSource,
  ClassCoTeacherRole,
  PendingClassUpdateType,
  PricingSnapshotSource,
} from './schemas/class.schema';
import { CreateClassDto } from './dto/create-class.dto';
import { UpdateClassDto } from './dto/update-class.dto';
import { User, UserDocument } from '../users/schemas/user.schema';
import { Student, StudentDocument } from '../students/schemas/student.schema';
import { Invoice, InvoiceDocument } from '../invoices/schemas/invoice.schema';
import { Order, OrderDocument, OrderStatus } from '../orders/schemas/order.schema';
import { TeacherProfile } from '../teachers/schemas/teacher-profile.schema';
import { Product, ProductDocument } from '../products/schemas/product.schema';
import { Session, SessionDocument } from '../sessions/schemas/session.schema';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { Role } from '../common/interfaces/role.enum';
import { StudentSupportSnapshotService } from '../messages/student-support-snapshot.service';
import { ClassesDataService } from './classes-data.service';
import {
  buildDurationSnapshotData,
  buildInvoicePricingContext,
  decorateClassroomForDisplay,
  getClassSourceInvoice,
  getOrderItemForInvoice,
  objectIdToString,
  roundMoneyDownToThousand,
  roundMoneyToThousand,
  sanitizeClassCodeToken,
  stripUpdateMetaFields,
  toSafeNumber,
} from './classes.utils';

@Injectable()
export class ClassesCoreService {
  private readonly logger = new Logger(ClassesCoreService.name);

  constructor(
    @InjectModel(Classroom.name) private readonly classModel: Model<ClassDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Student.name) private readonly studentModel: Model<StudentDocument>,
    @InjectModel(Invoice.name) private readonly invoiceModel: Model<InvoiceDocument>,
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    @InjectModel(TeacherProfile.name) private readonly teacherProfileModel: Model<any>,
    @InjectModel(Product.name) private readonly productModel: Model<ProductDocument>,
    @InjectModel(Session.name) private readonly sessionModel: Model<SessionDocument>,
    private readonly studentSupportSnapshotService: StudentSupportSnapshotService,
    private readonly classesDataService: ClassesDataService,
  ) {}

  // ══════════════════════════════════════════════════════════════════
  //  STUDENT SUPPORT SNAPSHOT TRIGGERS
  // ══════════════════════════════════════════════════════════════════

  triggerStudentSupportSnapshotRefreshForClass(classId: string, reason: string) {
    void this.refreshStudentSupportSnapshotForClass(classId, reason);
  }

  triggerStudentSupportSnapshotRefreshForStudentIds(
    studentIds: string[],
    reason: string,
  ) {
    void this.refreshStudentSupportSnapshotForStudentIds(studentIds, reason);
  }

  private async refreshStudentSupportSnapshotForClass(classId: string, reason: string) {
    try {
      await this.studentSupportSnapshotService.rebuildForClass(classId);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      this.logger.warn(
        `[StudentSupportSnapshot] Failed to refresh for class ${classId} (${reason}): ${message}`,
      );
    }
  }

  private async refreshStudentSupportSnapshotForStudentIds(
    studentIds: string[],
    reason: string,
  ) {
    try {
      await this.studentSupportSnapshotService.rebuildForStudentIds(studentIds);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      this.logger.warn(
        `[StudentSupportSnapshot] Failed to refresh students (${reason}): ${message}`,
      );
    }
  }

  // ══════════════════════════════════════════════════════════════════
  //  VALIDATION HELPERS
  // ══════════════════════════════════════════════════════════════════

  async validateUserRole(userId: string, role: Role): Promise<Types.ObjectId> {
    const user = await this.userModel.findById(userId).lean();
    if (!user || user.role !== role) {
      throw new BadRequestException(`Selected ${role.toLowerCase()} is invalid`);
    }
    return new Types.ObjectId(userId);
  }

  async validateStudents(studentIds: string[]): Promise<Types.ObjectId[]> {
    if (!studentIds?.length) return [];
    const found = await this.studentModel.find({ _id: { $in: studentIds } }, '_id').lean();
    if (found.length !== studentIds.length) {
      throw new BadRequestException('Một số học viên không hợp lệ');
    }
    return studentIds.map((id) => new Types.ObjectId(id));
  }

  async validateProductPackage(productPackageId: string): Promise<Types.ObjectId> {
    const product = await this.productModel.findById(productPackageId).lean();
    if (!product) {
      throw new BadRequestException('Goi san pham khong hop le');
    }
    return new Types.ObjectId(productPackageId);
  }

  async validateTeacherForSaleScope(
    teacherId: string,
    saleId?: string | null,
  ): Promise<Types.ObjectId> {
    const validatedTeacherId = await this.validateUserRole(teacherId, Role.TEACHER);
    if (!saleId) {
      return validatedTeacherId;
    }

    const profile = await this.teacherProfileModel
      .findOne({ userId: new Types.ObjectId(teacherId) })
      .select('managedSales')
      .lean();

    const managedSales = Array.isArray((profile as any)?.managedSales)
      ? (profile as any).managedSales.map((managedSale: any) => managedSale?.toString?.())
      : [];

    if (!managedSales.includes(saleId)) {
      throw new BadRequestException('Giao vien nay khong duoc gan cho sale phu trach lop');
    }

    return validatedTeacherId;
  }

  async validateCoTeachers(
    coTeachers: any[] | undefined,
    classMode?: string | null,
    primaryTeacherId?: string | null,
  ): Promise<Array<{
    teacherId: Types.ObjectId;
    role: string;
    canManageAttendance: boolean;
    canManageReports: boolean;
    canCreateLink: boolean;
    note?: string;
  }>> {
    if (!coTeachers?.length) {
      return [];
    }

    if (String(classMode || '').toUpperCase() !== ClassMode.OFFLINE) {
      throw new BadRequestException('Co-teaching chi ap dung cho lop OFFLINE');
    }

    const seenTeacherIds = new Set<string>();
    const normalized: Array<{
      teacherId: Types.ObjectId;
      role: string;
      canManageAttendance: boolean;
      canManageReports: boolean;
      canCreateLink: boolean;
      note?: string;
    }> = [];
    for (const entry of coTeachers) {
      const teacherId = String(entry?.teacherId || '').trim();
      if (!teacherId) {
        throw new BadRequestException('Co-teacher phai co giao vien hop le');
      }
      if (primaryTeacherId && teacherId === primaryTeacherId) {
        throw new BadRequestException('Co-teacher khong duoc trung voi giao vien chinh');
      }
      if (seenTeacherIds.has(teacherId)) {
        throw new BadRequestException('Danh sach co-teacher khong duoc trung giao vien');
      }
      seenTeacherIds.add(teacherId);

      const validatedTeacherId = await this.validateUserRole(teacherId, Role.TEACHER);
      const role = String(entry?.role || ClassCoTeacherRole.SUPPORT).trim().toUpperCase() || ClassCoTeacherRole.SUPPORT;
      const canManageAttendance = entry?.canManageAttendance !== false;
      const canManageReports = entry?.canManageReports !== false;
      const canCreateLink = entry?.canCreateLink !== false;

      normalized.push({
        teacherId: validatedTeacherId,
        role,
        canManageAttendance,
        canManageReports,
        canCreateLink,
        note: String(entry?.note || '').trim() || undefined,
      });
    }

    return normalized;
  }

  async validateTeacherForClassSale(classroom: any, teacherId: string): Promise<Types.ObjectId> {
    return this.validateTeacherForSaleScope(
      teacherId,
      classroom?.sale?.toString?.() || null,
    );
  }

  async assertStudentsBelongToSale(studentIds: string[], saleId?: string | null): Promise<void> {
    if (!saleId || !studentIds?.length) {
      return;
    }

    const validStudentIds = studentIds.filter((studentId) => Types.ObjectId.isValid(studentId));
    if (validStudentIds.length !== studentIds.length) {
      throw new BadRequestException('Danh sach hoc sinh khong hop le');
    }

    const ownedStudentCount = await this.studentModel.countDocuments({
      _id: { $in: validStudentIds.map((studentId) => new Types.ObjectId(studentId)) },
      saleId: new Types.ObjectId(saleId),
    });

    if (ownedStudentCount !== validStudentIds.length) {
      throw new BadRequestException('Sale chi duoc quan ly hoc sinh thuoc sale cua minh');
    }
  }

  async assertClassAccess(classroom: any, actor?: JwtPayload): Promise<void> {
    if (!actor) return;
    const actorId = actor?.sub ?? actor?._id ?? (actor as any)?.userId ?? null;
    if (!actorId) throw new ForbiddenException('Khong xac dinh duoc nguoi dung');

    if ([Role.DIRECTOR, Role.OPS, Role.ACCOUNTING].includes(actor.role)) {
      return;
    }

    if (actor.role === Role.SALE) {
      if (classroom?.sale?.toString() === actorId) return;
      throw new ForbiddenException('Ban khong co quyen truy cap lop hoc nay');
    }

    if (actor.role === Role.TEACHER) {
      if (classroom?.teacher?.toString() === actorId) return;
      const subs = (classroom?.substituteTeachers || []) as any[];
      if (subs.some((s) => s?.teacherId?.toString() === actorId)) return;
      const coTeachers = (classroom?.coTeachers || []) as any[];
      if (coTeachers.some((teacher) => teacher?.teacherId?.toString() === actorId)) return;
      const { getTeacherOwnedStudentIds } = await import('./student-config.utils');
      if (getTeacherOwnedStudentIds(classroom, actorId).length > 0) return;
      throw new ForbiddenException('Ban khong co quyen truy cap lop hoc nay');
    }

    if (actor.role === Role.PARENT) {
      const studentIds = (classroom?.students || []) as any[];
      if (!studentIds.length) {
        throw new ForbiddenException('Ban khong co quyen truy cap lop hoc nay');
      }
      const count = await this.studentModel.countDocuments({
        _id: { $in: studentIds },
        parentUserId: new Types.ObjectId(actorId),
      });
      if (count > 0) return;
      throw new ForbiddenException('Ban khong co quyen truy cap lop hoc nay');
    }

    throw new ForbiddenException('Ban khong co quyen truy cap lop hoc nay');
  }

  async getParentStudentIds(parentUserId: string): Promise<string[]> {
    const ownedStudents = await this.studentModel
      .find({ parentUserId: new Types.ObjectId(parentUserId) })
      .select('_id')
      .lean();
    return ownedStudents.map((student: any) => student._id.toString());
  }

  async ensureCodeUnique(code: string, excludeId?: string) {
    const existing = await this.classModel
      .findOne({ code: code.toUpperCase(), ...(excludeId ? { _id: { $ne: excludeId } } : {}) })
      .lean();
    if (existing) throw new ConflictException('Class code already exists');
  }

  async generateAutoClassCode(orderCode?: string | null, invoiceId?: string | null): Promise<string> {
    const orderToken = sanitizeClassCodeToken(orderCode, 'ORD');
    const invoiceToken = sanitizeClassCodeToken(invoiceId, 'AUTO').slice(-4);
    const baseCode = `CLS-${orderToken}-${invoiceToken}`;
    let attempt = 0;
    let candidate = baseCode;

    while (await this.classModel.exists({ code: candidate })) {
      attempt += 1;
      candidate = `${baseCode}-${attempt}`;
    }

    return candidate;
  }

  // ══════════════════════════════════════════════════════════════════
  //  BUILD PAYLOAD
  // ══════════════════════════════════════════════════════════════════

  async buildPayload(
    dto: Partial<CreateClassDto>,
    allowPartial = false,
    context?: {
      classMode?: string | null;
      primaryTeacherId?: string | null;
    },
  ): Promise<Record<string, unknown>> {
    const payload: Record<string, unknown> = {};
    const effectiveClassMode = String(
      dto.classMode ?? context?.classMode ?? '',
    ).toUpperCase() || null;

    if (!allowPartial || dto.teacherId) {
      const teacherId = dto.teacherId ?? null;
      if (!teacherId) throw new BadRequestException('Teacher is required');
      payload.teacher = await this.validateUserRole(teacherId, Role.TEACHER);
    }

    if (dto.saleId) {
      payload.sale = await this.validateUserRole(dto.saleId, Role.SALE);
    }

    if (!allowPartial || dto.studentIds) {
      const ids = dto.studentIds ?? [];
      payload.students = await this.validateStudents(ids);
    }

    if (dto.productPackageId) {
      payload.productPackage = await this.validateProductPackage(dto.productPackageId);
    }

    if (dto.coTeachers !== undefined) {
      payload.coTeachers = await this.validateCoTeachers(
        dto.coTeachers,
        effectiveClassMode,
        dto.teacherId ?? context?.primaryTeacherId ?? null,
      );
    }

    if (!allowPartial || dto.name) payload.name = dto.name;
    if (!allowPartial || dto.code) payload.code = dto.code?.toUpperCase();

    if (dto.pricePerSession !== undefined) {
      payload.pricePerSession = roundMoneyToThousand(Number(dto.pricePerSession || 0));
    }
    if (dto.teacherPayPerSession !== undefined) {
      payload.teacherPayPerSession = roundMoneyDownToThousand(
        Number(dto.teacherPayPerSession || 0),
      );
    }
    if (dto.teacherPayPerStudent !== undefined) {
      payload.teacherPayPerStudent = roundMoneyDownToThousand(
        Number(dto.teacherPayPerStudent || 0),
      );
    }
    if ((dto as any).baseDuration !== undefined) payload.baseDuration = (dto as any).baseDuration;
    if (dto.sessionDuration !== undefined) payload.sessionDuration = dto.sessionDuration;
    if ((dto as any).classMode !== undefined) payload.classMode = (dto as any).classMode;

    if (dto.subject !== undefined) payload.subject = dto.subject;
    if (dto.grade !== undefined) payload.grade = dto.grade;
    if (dto.learningGoals !== undefined) payload.learningGoals = dto.learningGoals;
    if (dto.maxStudents !== undefined) payload.maxStudents = Number(dto.maxStudents);

    if (dto.curriculum !== undefined) payload.curriculum = dto.curriculum;

    if (dto.revenuePerStudent !== undefined) {
      payload.revenuePerStudent = roundMoneyToThousand(Number(dto.revenuePerStudent || 0));
    }
    if (dto.teacherSalaryCost !== undefined) {
      payload.teacherSalaryCost = roundMoneyDownToThousand(
        Number(dto.teacherSalaryCost || 0),
      );
    }

    return payload;
  }

  // ══════════════════════════════════════════════════════════════════
  //  PREPARE / APPLY CLASS UPDATE
  // ══════════════════════════════════════════════════════════════════

  async prepareClassUpdate(
    id: string,
    dto: Partial<CreateClassDto> & Partial<Pick<UpdateClassDto, 'requestType'>>,
    existing: any,
  ): Promise<{
    existingStudentIds: string[];
    update: Record<string, unknown>;
    durationSnapshotData?: {
      baseDuration: number;
      sessionDuration: number;
      pricePerSession: number;
      teacherPayPerSession: number;
      teacherPayPerStudent: number;
    };
  }> {
    const dtoWithoutMeta = stripUpdateMetaFields(dto);
    const existingStudentIds = ((existing as any).students || [])
      .map((studentId: any) => studentId?.toString?.())
      .filter((studentId: string | undefined): studentId is string => !!studentId);

    const update: Record<string, unknown> = {};
    if (dtoWithoutMeta.name) update.name = dtoWithoutMeta.name;
    if (dtoWithoutMeta.code) {
      await this.ensureCodeUnique(dtoWithoutMeta.code, id);
      update.code = dtoWithoutMeta.code.toUpperCase();
    }

    const members = await this.buildPayload(dtoWithoutMeta, true, {
      classMode: (existing as any)?.classMode,
      primaryTeacherId: objectIdToString((existing as any)?.teacher),
    });
    Object.assign(update, members);

    const pricingFields = [
      'pricePerSession',
      'teacherPayPerSession',
      'teacherPayPerStudent',
      'baseDuration',
      'sessionDuration',
    ];
    const hasPricingUpdate = pricingFields.some((field) =>
      Object.prototype.hasOwnProperty.call(update, field),
    );

    let durationSnapshotData:
      | {
        baseDuration: number;
        sessionDuration: number;
        pricePerSession: number;
        teacherPayPerSession: number;
        teacherPayPerStudent: number;
      }
      | undefined;

    if (hasPricingUpdate) {
      const currentSnapshot = (existing as any).pricingSnapshot || {};
      const referenceDuration = toSafeNumber(
        update.baseDuration,
        toSafeNumber(
          currentSnapshot.referenceDuration,
          toSafeNumber((existing as any).baseDuration, 60),
        ),
      ) || 60;
      const sessionDuration = toSafeNumber(
        update.sessionDuration,
        toSafeNumber(
          currentSnapshot.sessionDuration,
          toSafeNumber((existing as any).sessionDuration, referenceDuration),
        ),
      ) || referenceDuration;
      const pricePerSession = toSafeNumber(
        update.pricePerSession,
        toSafeNumber(
          currentSnapshot.pricePerSession,
          toSafeNumber((existing as any).pricePerSession, 0),
        ),
      );
      const teacherPayPerSession = toSafeNumber(
        update.teacherPayPerSession,
        toSafeNumber(
          currentSnapshot.teacherPayPerSession,
          toSafeNumber((existing as any).teacherPayPerSession, 0),
        ),
      );
      const teacherPayPerStudent = toSafeNumber(
        update.teacherPayPerStudent,
        toSafeNumber(
          currentSnapshot.teacherPayPerStudent,
          toSafeNumber((existing as any).teacherPayPerStudent, 0),
        ),
      );
      const perMinuteRate = referenceDuration > 0
        ? pricePerSession / referenceDuration
        : 0;

      update.pricingSnapshot = {
        source: PricingSnapshotSource.MANUAL,
        capturedAt: new Date(),
        sourceInvoiceId: currentSnapshot.sourceInvoiceId,
        sourceInvoiceNumber: currentSnapshot.sourceInvoiceNumber,
        referenceDuration,
        sessionDuration,
        pricePerSession,
        perMinuteRate,
        teacherPayPerSession,
        teacherPayPerStudent,
      };
      durationSnapshotData = buildDurationSnapshotData({
        ...existing,
        ...update,
        pricingSnapshot: update.pricingSnapshot,
      }, { preferPendingValues: true });
    }

    return { existingStudentIds, update, durationSnapshotData };
  }

  async applyPreparedClassUpdate(
    id: string,
    prepared: {
      existingStudentIds: string[];
      update: Record<string, unknown>;
      durationSnapshotData?: {
        baseDuration: number;
        sessionDuration: number;
        pricePerSession: number;
        teacherPayPerSession: number;
        teacherPayPerStudent: number;
      };
    },
    reason: string,
    options?: {
      clearPendingSaleUpdate?: boolean;
      durationSnapshotSource?: DurationSnapshotSource;
      requestType?: PendingClassUpdateType;
      effectiveById?: string | null;
      historyEntry?: {
        editedAt: Date;
        editedByUserId?: Types.ObjectId;
        editedByName?: string;
        editedByRole?: string;
        action: ClassEditHistoryAction;
        requestType: PendingClassUpdateType;
        changes: Array<{
          field: string;
          label: string;
          beforeValue: string;
          afterValue: string;
        }>;
        durationPreview?: {
          oldBaseDuration: number;
          oldSessionDuration: number;
          newBaseDuration: number;
          newSessionDuration: number;
          students: Array<{
            studentId?: Types.ObjectId;
            studentName?: string;
            studentCode?: string;
            oldDurationMinutes: number;
            newDurationMinutes: number;
            paidSessionsRemainingBefore?: number;
            bonusSessionsRemainingBefore?: number;
            totalSessionsRemainingBefore?: number;
            paidSessionsRemainingAfter?: number;
            bonusSessionsRemainingAfter?: number;
            totalSessionsRemainingAfter?: number;
            projectedTotalSessionsBefore?: number;
            projectedTotalSessionsAfter?: number;
          }>;
        };
        note?: string;
      };
    },
  ): Promise<void> {
    const updateQuery: Record<string, unknown> = {};
    if (Object.keys(prepared.update).length) {
      updateQuery.$set = prepared.update;
    }
    if (options?.clearPendingSaleUpdate) {
      updateQuery.$unset = { pendingSaleUpdate: 1 };
    }
    if (prepared.durationSnapshotData && options?.durationSnapshotSource) {
      updateQuery.$push = {
        durationSnapshots: {
          source: options.durationSnapshotSource,
          requestType: options.requestType || PendingClassUpdateType.GENERAL,
          effectiveAt: new Date(),
          effectiveBy: options.effectiveById ? new Types.ObjectId(options.effectiveById) : undefined,
          ...prepared.durationSnapshotData,
        },
      };
    }
    if (options?.historyEntry) {
      updateQuery.$push = {
        ...(updateQuery.$push as Record<string, unknown> || {}),
        editHistory: options.historyEntry,
      };
    }

    if (Object.keys(updateQuery).length) {
      await this.classModel.findByIdAndUpdate(id, updateQuery, { new: true }).lean();
    }

    if (Object.prototype.hasOwnProperty.call(prepared.update, 'teacher')) {
      const teacherId = (prepared.update.teacher as Types.ObjectId | undefined)?.toString?.();
      if (teacherId) {
        await this.classesDataService.syncTeacherSlotsOnClass(id, teacherId, options?.effectiveById);
      }
    }

    if (prepared.durationSnapshotData) {
      await this.classesDataService.syncDurationSlotsOnClass(id, options?.effectiveById);
    }

    if (Object.prototype.hasOwnProperty.call(prepared.update, 'students')) {
      await this.classesDataService.syncStudentConfigsOnClass(id, options?.effectiveById);
      const updatedStudentIds = ((prepared.update.students as Types.ObjectId[]) || [])
        .map((studentId) => studentId?.toString?.())
        .filter((studentId: string | undefined): studentId is string => !!studentId);
      this.triggerStudentSupportSnapshotRefreshForStudentIds(
        [...new Set([...prepared.existingStudentIds, ...updatedStudentIds])],
        `${reason}Students`,
      );
      return;
    }

    this.triggerStudentSupportSnapshotRefreshForClass(id, reason);
  }

  // ══════════════════════════════════════════════════════════════════
  //  ORDER SYNC / SOURCE INVOICE
  // ══════════════════════════════════════════════════════════════════

  async syncOrderProgressForInvoiceIds(invoiceIds: string[]): Promise<void> {
    const normalizedInvoiceIds = invoiceIds
      .filter((invoiceId) => Types.ObjectId.isValid(invoiceId))
      .map((invoiceId) => new Types.ObjectId(invoiceId));

    if (!normalizedInvoiceIds.length) {
      return;
    }

    const sourceInvoices = await this.invoiceModel
      .find({ _id: { $in: normalizedInvoiceIds } })
      .select('_id orderId')
      .lean();

    const orderIds = Array.from(
      new Set(
        sourceInvoices
          .map((invoice: any) => invoice?.orderId?.toString?.())
          .filter((orderId: string | undefined): orderId is string => !!orderId),
      ),
    );

    if (!orderIds.length) {
      return;
    }

    const orderInvoices = await this.invoiceModel
      .find({ orderId: { $in: orderIds.map((orderId) => new Types.ObjectId(orderId)) } })
      .select('_id orderId classId')
      .lean();

    const invoicesByOrder = new Map<string, any[]>();
    for (const invoice of orderInvoices) {
      const orderId = invoice?.orderId?.toString?.();
      if (!orderId) continue;
      if (!invoicesByOrder.has(orderId)) {
        invoicesByOrder.set(orderId, []);
      }
      invoicesByOrder.get(orderId)!.push(invoice);
    }

    for (const orderId of orderIds) {
      const relatedInvoices = invoicesByOrder.get(orderId) || [];
      const allInvoicesAssignedToClass = relatedInvoices.length > 0
        && relatedInvoices.every((invoice) => !!invoice.classId);
      const uniqueClassIds = Array.from(
        new Set(
          relatedInvoices
            .map((invoice) => invoice?.classId?.toString?.())
            .filter((classId: string | undefined): classId is string => !!classId),
        ),
      );

      await this.orderModel.findByIdAndUpdate(orderId, {
        $set: {
          status: allInvoicesAssignedToClass ? OrderStatus.COMPLETED : OrderStatus.APPROVED,
          'processedResults.invoiceIds': relatedInvoices.map((invoice) => new Types.ObjectId(invoice._id)),
          'processedResults.classIds': uniqueClassIds.map((classId) => new Types.ObjectId(classId)),
        },
      });
    }
  }

  async hydrateInvoicePricingContext(invoice: any | null): Promise<any | null> {
    if (!invoice) {
      return null;
    }

    const orderId = objectIdToString(invoice.orderId);
    if (!orderId || !Types.ObjectId.isValid(orderId)) {
      return buildInvoicePricingContext(invoice, null);
    }

    const order = await this.orderModel
      .findById(orderId)
      .select('items')
      .lean();

    return buildInvoicePricingContext(
      invoice,
      getOrderItemForInvoice(order, invoice),
    );
  }

  async buildClassSourceInvoiceMap(classrooms: any[]): Promise<Map<string, any>> {
    const invoiceIds = Array.from(
      new Set(
        classrooms
          .flatMap((classroom) => [
            objectIdToString(classroom?.invoiceId),
            objectIdToString(classroom?.pricingSnapshot?.sourceInvoiceId),
          ])
          .filter((invoiceId): invoiceId is string => !!invoiceId && Types.ObjectId.isValid(invoiceId)),
      ),
    );

    if (!invoiceIds.length) {
      return new Map<string, any>();
    }

    const invoices = await this.invoiceModel
      .find({ _id: { $in: invoiceIds.map((invoiceId) => new Types.ObjectId(invoiceId)) } })
      .select('_id invoiceNumber orderId orderItemIndex productId pricePerSession referenceDuration teacherPayPerSession')
      .lean();

    const orderIds = Array.from(
      new Set(
        invoices
          .map((invoice: any) => objectIdToString(invoice?.orderId))
          .filter((orderId): orderId is string => !!orderId && Types.ObjectId.isValid(orderId)),
      ),
    );

    const orders = orderIds.length
      ? await this.orderModel
          .find({ _id: { $in: orderIds.map((orderId) => new Types.ObjectId(orderId)) } })
          .select('_id items')
          .lean()
      : [];
    const orderMap = new Map(
      orders.map((order: any) => [order._id.toString(), order]),
    );

    return new Map(
      invoices.map((invoice: any) => {
        const order = orderMap.get(objectIdToString(invoice?.orderId) || '');
        return [
          invoice._id.toString(),
          buildInvoicePricingContext(
            invoice,
            getOrderItemForInvoice(order, invoice),
          ),
        ];
      }),
    );
  }

  // ══════════════════════════════════════════════════════════════════
  //  FIND BY ID POPULATED
  // ══════════════════════════════════════════════════════════════════

  async findByIdPopulated(id: string | Types.ObjectId) {
    const classroom = await this.classModel
      .findById(id)
      .populate('teacher', 'fullName email role')
      .populate('sale', 'fullName email role')
      .populate('coTeachers.teacherId', 'fullName email role userCode')
      .populate('coTeachers.assignedBy', 'fullName email role')
      .populate('pendingSaleUpdate.requestedBy', 'fullName email role')
      .populate('pendingSaleUpdate.reviewedBy', 'fullName email role')
      .populate('pendingOfflineAssignments.studentIds', 'fullName studentCode')
      .populate('pendingOfflineAssignments.invoiceId', 'invoiceNumber status')
      .populate('pendingOfflineAssignments.requestedBy', 'fullName email role')
      .populate('pendingOfflineAssignments.reviewedBy', 'fullName email role')
      .populate('productPackage', 'name code teachingMode pricePerSession suggestedPrice')
      .populate('students', 'fullName age parentName studentCode')
      .populate('studentConfigs.studentId', 'fullName studentCode')
      .populate('studentConfigs.teacherSlots.teacherId', 'fullName email role userCode')
      .populate('studentConfigs.teacherSlots.assignedBy', 'fullName email role')
      .populate('studentConfigs.durationSlots.effectiveBy', 'fullName email role')
      .populate('durationSnapshots.effectiveBy', 'fullName email role')
      .lean();

    if (classroom) {
      const projectedClassroom = await this.classesDataService.withProjectedStudentTotals(classroom);
      const sourceInvoiceMap = await this.buildClassSourceInvoiceMap([projectedClassroom]);
      const decoratedClassroom = decorateClassroomForDisplay(
        projectedClassroom,
        getClassSourceInvoice(projectedClassroom, sourceInvoiceMap),
      );

      const curriculum = (decoratedClassroom as any).curriculum || [];
      const totalItems = curriculum.length;
      const completedItems = curriculum.filter((item: any) => item.isCompleted).length;
      const curriculumProgress = totalItems > 0
        ? Math.round((completedItems / totalItems) * 100)
        : 0;

      return {
        ...decoratedClassroom,
        curriculumProgress,
      };
    }

    return classroom;
  }

  // ══════════════════════════════════════════════════════════════════
  //  SUBSTITUTE TEACHER MANAGEMENT
  // ══════════════════════════════════════════════════════════════════

  async addSubstituteTeacher(
    classId: string,
    data: {
      teacherId: string;
      fromDate: Date;
      toDate: Date;
      payRate: number;
      canCreateLink: boolean;
      ticketId?: string;
      approvedBy: string;
    },
  ) {
    const classroom = await this.classModel.findById(classId);
    if (!classroom) throw new NotFoundException('Lớp học không tồn tại');

    await this.validateUserRole(data.teacherId, Role.TEACHER);

    const subs = (classroom as any).substituteTeachers || [];
    const overlap = subs.find(
      (s: any) =>
        s.teacherId.toString() === data.teacherId &&
        new Date(s.toDate) >= data.fromDate &&
        new Date(s.fromDate) <= data.toDate,
    );
    if (overlap) {
      throw new BadRequestException(
        'GV dạy thay đã được phân công trong khoảng thời gian này',
      );
    }

    subs.push({
      teacherId: new Types.ObjectId(data.teacherId),
      fromDate: data.fromDate,
      toDate: data.toDate,
      payRate: data.payRate,
      canCreateLink: data.canCreateLink,
      ticketId: data.ticketId ? new Types.ObjectId(data.ticketId) : undefined,
      approvedBy: new Types.ObjectId(data.approvedBy),
      approvedAt: new Date(),
    });

    (classroom as any).substituteTeachers = subs;
    await classroom.save();
    return this.findByIdPopulated(classId);
  }

  async removeSubstituteTeacher(classId: string, teacherId: string) {
    const classroom = await this.classModel.findById(classId);
    if (!classroom) throw new NotFoundException('Lớp học không tồn tại');

    const subs = (classroom as any).substituteTeachers || [];
    (classroom as any).substituteTeachers = subs.filter(
      (s: any) => s.teacherId.toString() !== teacherId,
    );
    await classroom.save();
    return this.findByIdPopulated(classId);
  }

  async getActiveSubstitute(
    classId: string,
    date: Date,
  ): Promise<{ teacherId: string; payRate: number; canCreateLink: boolean } | null> {
    const classroom = await this.classModel.findById(classId).lean();
    if (!classroom) return null;

    const subs = (classroom as any).substituteTeachers || [];
    const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

    const active = subs.find((s: any) => {
      const from = new Date(s.fromDate);
      const to = new Date(s.toDate);
      from.setUTCHours(0, 0, 0, 0);
      to.setUTCHours(23, 59, 59, 999);
      return s.teacherId && d >= from && d <= to;
    });

    if (!active) return null;
    return {
      teacherId: active.teacherId.toString(),
      payRate: active.payRate ?? 0,
      canCreateLink: active.canCreateLink ?? true,
    };
  }

  // ══════════════════════════════════════════════════════════════════
  //  TEACHER MATCHING
  // ══════════════════════════════════════════════════════════════════

  async suggestTeachers(params: {
    subject?: string;
    grade?: string;
    teachingMode?: string;
  }) {
    const filter: any = { status: 'ACTIVE' };
    if (params.subject) filter.subjects = params.subject;
    if (params.grade) filter.grades = params.grade;
    if (params.teachingMode) filter.teachingMode = params.teachingMode;

    const profiles = await this.teacherProfileModel
      .find(filter)
      .populate('userId', 'fullName email')
      .lean();

    const scored: any[] = [];
    for (const profile of profiles) {
      let score = 50;
      const reasons: string[] = [];

      if (params.subject && (profile as any).subjects?.includes(params.subject)) {
        score += 20;
        reasons.push('Đúng môn dạy');
      }
      if (params.grade && (profile as any).grades?.includes(params.grade)) {
        score += 15;
        reasons.push('Đúng khối lớp');
      }
      if (params.teachingMode && (profile as any).teachingMode === params.teachingMode) {
        score += 10;
        reasons.push('Đúng hình thức dạy');
      }

      const activeClasses = await this.classModel.countDocuments({
        teacher: (profile as any).userId?._id,
        status: 'ACTIVE',
      });
      if (activeClasses < 3) {
        score += 10;
        reasons.push('Ít lớp đang dạy');
      } else if (activeClasses < 5) {
        score += 5;
      }

      const rating = (profile as any).rating || 0;
      if (rating >= 4.5) {
        score += 10;
        reasons.push(`Rating: ${rating}/5`);
      } else if (rating >= 4.0) {
        score += 5;
      }

      scored.push({
        teacherId: (profile as any).userId?._id,
        teacherName: (profile as any).userId?.fullName || '',
        email: (profile as any).userId?.email || '',
        subjects: (profile as any).subjects,
        grades: (profile as any).grades,
        teachingMode: (profile as any).teachingMode,
        activeClasses,
        rating,
        score: Math.min(score, 100),
        reasons,
      });
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, 5);
  }
}
