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
  ClassStatus,
  ClassDocument,
  ClassEditHistoryAction,
  ClassUpdateRequestStatus,
  DurationSnapshotSource,
  PendingClassUpdateType,
  PricingSnapshotSource,
  StudentConfigSlotType,
} from './schemas/class.schema';
import { CreateClassDto } from './dto/create-class.dto';
import { UpdateClassDto } from './dto/update-class.dto';
import { AssignStudentsDto } from './dto/assign-students.dto';
import { UpdateStudentConfigDto } from './dto/update-student-config.dto';
import { User, UserDocument } from '../users/schemas/user.schema';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { Student, StudentDocument } from '../students/schemas/student.schema';
import { Invoice, InvoiceDocument, InvoiceStatus } from '../invoices/schemas/invoice.schema';
import { TeacherProfile } from '../teachers/schemas/teacher-profile.schema';
import { Product, ProductDocument } from '../products/schemas/product.schema';
import { Role } from '../common/interfaces/role.enum';
import { Order, OrderDocument, OrderStatus } from '../orders/schemas/order.schema';
import { StudentSupportSnapshotService } from '../messages/student-support-snapshot.service';
import { Session, SessionDocument, SessionStatus } from '../sessions/schemas/session.schema';
import {
  getCurrentTeacherIdForStudent,
  getCurrentDurationForStudent,
  getClassPricingConfigAt,
  getTeacherOwnedStudentIds,
} from './student-config.utils';

@Injectable()
export class ClassesService {
  private readonly logger = new Logger(ClassesService.name);

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
  ) {}

  private triggerStudentSupportSnapshotRefreshForClass(classId: string, reason: string) {
    void this.refreshStudentSupportSnapshotForClass(classId, reason);
  }

  private triggerStudentSupportSnapshotRefreshForStudentIds(
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

  private getActorId(actor?: JwtPayload): string | null {
    return actor?.sub ?? actor?._id ?? (actor as any)?.userId ?? null;
  }

  private isManagerRole(role?: Role): boolean {
    return role === Role.DIRECTOR || role === Role.OPS;
  }

  private resolveRequestedUpdateType(dto?: Pick<UpdateClassDto, 'requestType'>): PendingClassUpdateType {
    return dto?.requestType === PendingClassUpdateType.DURATION_CHANGE
      ? PendingClassUpdateType.DURATION_CHANGE
      : PendingClassUpdateType.GENERAL;
  }

  private stripUpdateMetaFields<T extends object>(dto: T): Omit<T, 'requestType'> {
    const { requestType, ...rest } = dto as T & { requestType?: PendingClassUpdateType };
    return rest;
  }

  private sanitizeSaleUpdateDto(dto: UpdateClassDto): UpdateClassDto {
    const { saleId, studentIds, invoiceId, requestType, code, ...allowed } = dto;
    return allowed;
  }

  private sanitizeDurationUpdateDto(dto: UpdateClassDto): UpdateClassDto {
    const requestedChanges = new UpdateClassDto();
    requestedChanges.requestType = PendingClassUpdateType.DURATION_CHANGE;
    if (dto.baseDuration !== undefined) {
      requestedChanges.baseDuration = dto.baseDuration;
    }
    if (dto.sessionDuration !== undefined) {
      requestedChanges.sessionDuration = dto.sessionDuration;
    }
    return requestedChanges;
  }

  private isSameObjectId(left: unknown, right: unknown): boolean {
    const normalize = (value: unknown): string => {
      if (!value) {
        return '';
      }
      if (typeof value === 'string') {
        return value;
      }
      return (value as any)?.toString?.() || '';
    };

    return normalize(left) === normalize(right);
  }

  private objectIdToString(value: unknown): string | null {
    if (!value) return null;
    if (typeof value === 'string') return value;
    return (value as any)?._id?.toString?.() || (value as any)?.toString?.() || null;
  }

  private sanitizeClassCodeToken(value?: string | null, fallback = 'AUTO'): string {
    const normalized = String(value || '')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(-8);
    return normalized || fallback;
  }

  private buildAutoClassName(options: {
    studentName?: string | null;
    productName?: string | null;
    classMode?: string | null;
  }): string {
    const productName = String(options.productName || '').trim();
    const studentName = String(options.studentName || '').trim();
    const fallbackMode = String(options.classMode || '').toUpperCase() === ClassMode.OFFLINE
      ? 'OFFLINE'
      : 'ONLINE';
    const label = productName || fallbackMode;
    return studentName ? `Lop ${label} - ${studentName}` : `Lop ${label}`;
  }

  private async generateAutoClassCode(orderCode?: string | null, invoiceId?: string | null): Promise<string> {
    const orderToken = this.sanitizeClassCodeToken(orderCode, 'ORD');
    const invoiceToken = this.sanitizeClassCodeToken(invoiceId, 'AUTO').slice(-4);
    const baseCode = `CLS-${orderToken}-${invoiceToken}`;
    let attempt = 0;
    let candidate = baseCode;

    while (await this.classModel.exists({ code: candidate })) {
      attempt += 1;
      candidate = `${baseCode}-${attempt}`;
    }

    return candidate;
  }

  private async syncOrderProgressForInvoiceIds(invoiceIds: string[]): Promise<void> {
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

  private getClassHistoryFieldLabel(field: string): string {
    const labels: Record<string, string> = {
      name: 'Ten lop',
      code: 'Ma lop',
      teacherId: 'Giao vien',
      productPackageId: 'Goi san pham',
      classMode: 'Loai lop',
      pricePerSession: 'Gia theo buoi',
      teacherPayPerSession: 'Luong GV/buoi',
      teacherPayPerStudent: 'Luong GV/HS',
      baseDuration: 'Thoi luong co so',
      sessionDuration: 'Thoi luong buoi hoc',
      subject: 'Mon hoc',
      grade: 'Khoi lop',
      learningGoals: 'Muc tieu hoc',
      maxStudents: 'Si so toi da',
    };
    return labels[field] || field;
  }

  private formatCurrencyForHistory(value: unknown): string {
    const amount = this.toSafeNumber(value, 0);
    return `${amount.toLocaleString('vi-VN')}d`;
  }

  private formatClassModeLabel(value: unknown): string {
    return String(value || '').toUpperCase() === 'OFFLINE' ? 'OFFLINE' : 'ONLINE';
  }

  private formatClassHistoryValue(
    field: string,
    value: unknown,
    lookupMaps?: {
      teacherNames?: Map<string, string>;
      productNames?: Map<string, string>;
    },
  ): string {
    if (value === null || value === undefined) {
      return '(trong)';
    }

    if (typeof value === 'string' && !value.trim()) {
      return '(trong)';
    }

    switch (field) {
      case 'teacherId': {
        const teacherId = this.objectIdToString(value);
        if (!teacherId) return '(trong)';
        return lookupMaps?.teacherNames?.get(teacherId) || teacherId;
      }
      case 'productPackageId': {
        const productId = this.objectIdToString(value);
        if (!productId) return '(trong)';
        return lookupMaps?.productNames?.get(productId) || productId;
      }
      case 'classMode':
        return this.formatClassModeLabel(value);
      case 'pricePerSession':
      case 'teacherPayPerSession':
      case 'teacherPayPerStudent':
        return this.formatCurrencyForHistory(value);
      case 'baseDuration':
      case 'sessionDuration':
        return `${this.toSafeNumber(value, 0)} phut`;
      case 'maxStudents':
        return `${this.toSafeNumber(value, 0)}`;
      default:
        return String(value);
    }
  }

  private async buildClassHistoryLookupMaps(
    classroom: any,
    dto: Partial<CreateClassDto>,
  ): Promise<{
    teacherNames: Map<string, string>;
    productNames: Map<string, string>;
  }> {
    const teacherIds = new Set<string>();
    const productIds = new Set<string>();

    const currentTeacherId = this.objectIdToString(classroom?.teacher);
    const requestedTeacherId = this.objectIdToString(dto.teacherId);
    if (currentTeacherId) teacherIds.add(currentTeacherId);
    if (requestedTeacherId) teacherIds.add(requestedTeacherId);

    const currentProductId = this.objectIdToString(classroom?.productPackage);
    const requestedProductId = this.objectIdToString(dto.productPackageId);
    if (currentProductId) productIds.add(currentProductId);
    if (requestedProductId) productIds.add(requestedProductId);

    const [teachers, products] = await Promise.all([
      teacherIds.size
        ? this.userModel.find({ _id: { $in: Array.from(teacherIds).map((id) => new Types.ObjectId(id)) } })
            .select('fullName userCode')
            .lean()
        : Promise.resolve([]),
      productIds.size
        ? this.productModel.find({ _id: { $in: Array.from(productIds).map((id) => new Types.ObjectId(id)) } })
            .select('name code')
            .lean()
        : Promise.resolve([]),
    ]);

    return {
      teacherNames: new Map(
        (teachers as any[]).map((teacher) => [
          teacher._id.toString(),
          teacher.userCode
            ? `${teacher.userCode} - ${teacher.fullName || teacher._id.toString()}`
            : (teacher.fullName || teacher._id.toString()),
        ]),
      ),
      productNames: new Map(
        (products as any[]).map((product) => [
          product._id.toString(),
          product.code
            ? `${product.name || product._id.toString()} (${product.code})`
            : (product.name || product._id.toString()),
        ]),
      ),
    };
  }

  private async buildClassChangeSummary(
    classroom: any,
    dto: Partial<CreateClassDto>,
  ): Promise<Array<{
    field: string;
    label: string;
    beforeValue: string;
    afterValue: string;
  }>> {
    const lookupMaps = await this.buildClassHistoryLookupMaps(classroom, dto);
    const fields = Object.keys(dto).filter((field) => field !== 'requestType');
    const changes: Array<{
      field: string;
      label: string;
      beforeValue: string;
      afterValue: string;
    }> = [];

    const beforeValueMap: Record<string, unknown> = {
      name: classroom?.name,
      code: classroom?.code,
      teacherId: classroom?.teacher,
      productPackageId: classroom?.productPackage,
      classMode: classroom?.classMode,
      pricePerSession: classroom?.pricePerSession,
      teacherPayPerSession: classroom?.teacherPayPerSession,
      teacherPayPerStudent: classroom?.teacherPayPerStudent,
      baseDuration: classroom?.baseDuration,
      sessionDuration: classroom?.sessionDuration,
      subject: classroom?.subject,
      grade: classroom?.grade,
      learningGoals: classroom?.learningGoals,
      maxStudents: classroom?.maxStudents,
    };

    for (const field of fields) {
      const beforeValue = this.formatClassHistoryValue(field, beforeValueMap[field], lookupMaps);
      const afterValue = this.formatClassHistoryValue(field, (dto as any)[field], lookupMaps);
      if (beforeValue === afterValue) {
        continue;
      }

      changes.push({
        field,
        label: this.getClassHistoryFieldLabel(field),
        beforeValue,
        afterValue,
      });
    }

    return changes;
  }

  private async buildClassDurationPreview(
    classroom: any,
    nextBaseDuration: number,
    nextSessionDuration: number,
  ): Promise<{
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
  }> {
    const studentIds = ((classroom?.students || []) as any[])
      .map((studentId) => this.objectIdToString(studentId))
      .filter((studentId: string | null): studentId is string => !!studentId);

    const currentDurationState = this.buildDurationSnapshotData(classroom);
    if (!studentIds.length) {
      return {
        oldBaseDuration: currentDurationState.baseDuration,
        oldSessionDuration: currentDurationState.sessionDuration,
        newBaseDuration: nextBaseDuration,
        newSessionDuration: nextSessionDuration,
        students: [],
      };
    }

    const [completedSessionMap, remainingAllowanceMap, students] = await Promise.all([
      this.buildStudentCompletedSessionMap(classroom, studentIds),
      this.buildStudentRemainingAllowanceMap(classroom, studentIds),
      this.studentModel
        .find({ _id: { $in: studentIds.map((studentId) => new Types.ObjectId(studentId)) } })
        .select('fullName studentCode')
        .lean(),
    ]);

    const studentMetaMap = new Map(
      (students as any[]).map((student) => [student._id.toString(), student]),
    );

    return {
      oldBaseDuration: currentDurationState.baseDuration,
      oldSessionDuration: currentDurationState.sessionDuration,
      newBaseDuration: nextBaseDuration,
      newSessionDuration: nextSessionDuration,
      students: studentIds.map((studentId) => {
        const currentDuration = getCurrentDurationForStudent(classroom, studentId);
        const completedSessions = this.toSafeNumber(completedSessionMap.get(studentId), 0);
        const remainingAllowance = remainingAllowanceMap.get(studentId) || {
          paidRemainingMinutes: 0,
          bonusRemainingMinutes: 0,
          totalRemainingMinutes: 0,
        };
        const oldDurationMinutes =
          this.toSafeNumber(currentDuration.sessionDuration, currentDurationState.sessionDuration)
          || currentDurationState.sessionDuration;
        const oldBaseDuration =
          this.toSafeNumber(currentDuration.baseDuration, currentDurationState.baseDuration)
          || currentDurationState.baseDuration;
        const studentMeta = studentMetaMap.get(studentId) as any;

        const paidSessionsRemainingBefore = oldDurationMinutes > 0
          ? this.floorSessionCount(remainingAllowance.paidRemainingMinutes / oldDurationMinutes)
          : 0;
        const bonusSessionsRemainingBefore = oldDurationMinutes > 0
          ? this.floorSessionCount(remainingAllowance.bonusRemainingMinutes / oldDurationMinutes)
          : 0;
        const totalSessionsRemainingBefore = oldDurationMinutes > 0
          ? this.floorSessionCount(remainingAllowance.totalRemainingMinutes / oldDurationMinutes)
          : 0;
        const paidSessionsRemainingAfter = nextSessionDuration > 0
          ? this.floorSessionCount(remainingAllowance.paidRemainingMinutes / nextSessionDuration)
          : 0;
        const bonusSessionsRemainingAfter = nextSessionDuration > 0
          ? this.floorSessionCount(remainingAllowance.bonusRemainingMinutes / nextSessionDuration)
          : 0;
        const totalSessionsRemainingAfter = nextSessionDuration > 0
          ? this.floorSessionCount(remainingAllowance.totalRemainingMinutes / nextSessionDuration)
          : 0;

        return {
          studentId: new Types.ObjectId(studentId),
          studentName: studentMeta?.fullName,
          studentCode: studentMeta?.studentCode,
          oldDurationMinutes,
          newDurationMinutes: nextSessionDuration,
          paidSessionsRemainingBefore,
          bonusSessionsRemainingBefore,
          totalSessionsRemainingBefore,
          paidSessionsRemainingAfter,
          bonusSessionsRemainingAfter,
          totalSessionsRemainingAfter,
          projectedTotalSessionsBefore: completedSessions + totalSessionsRemainingBefore,
          projectedTotalSessionsAfter: completedSessions + totalSessionsRemainingAfter,
          oldBaseDuration,
        };
      }).map((studentPreview) => {
        const { oldBaseDuration, ...rest } = studentPreview as any;
        return rest;
      }),
    };
  }

  private async buildClassHistoryArtifacts(
    classroom: any,
    dto: Partial<CreateClassDto> & Partial<Pick<UpdateClassDto, 'requestType'>>,
    actor: JwtPayload | undefined,
    action: ClassEditHistoryAction,
    note?: string,
  ): Promise<{
    changeSummary: Array<{
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
    } | undefined;
    historyEntry: {
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
  }> {
    const requestType = this.resolveRequestedUpdateType(dto);
    const dtoWithoutMeta = this.stripUpdateMetaFields(dto);
    const changeSummary = await this.buildClassChangeSummary(classroom, dtoWithoutMeta);

    let durationPreview:
      | {
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
      }
      | undefined;

    const nextBaseDuration =
      this.toSafeNumber(dtoWithoutMeta.baseDuration, this.toSafeNumber(classroom?.baseDuration, 60))
      || this.toSafeNumber(classroom?.baseDuration, 60)
      || 60;
    const nextSessionDuration =
      this.toSafeNumber(dtoWithoutMeta.sessionDuration, this.toSafeNumber(classroom?.sessionDuration, nextBaseDuration))
      || this.toSafeNumber(classroom?.sessionDuration, nextBaseDuration)
      || nextBaseDuration;

    if (
      dtoWithoutMeta.baseDuration !== undefined
      || dtoWithoutMeta.sessionDuration !== undefined
      || requestType === PendingClassUpdateType.DURATION_CHANGE
    ) {
      durationPreview = await this.buildClassDurationPreview(
        classroom,
        nextBaseDuration,
        nextSessionDuration,
      );
    }

    const actorId = this.getActorId(actor);
    const historyEntry = {
      editedAt: new Date(),
      editedByUserId: actorId ? new Types.ObjectId(actorId) : undefined,
      editedByName: actor?.fullName || actor?.email,
      editedByRole: actor?.role,
      action,
      requestType,
      changes: changeSummary,
      durationPreview,
      note: note?.trim() || undefined,
    };

    return {
      changeSummary,
      durationPreview,
      historyEntry,
    };
  }

  private splitSaleUpdateChanges(
    dto: UpdateClassDto,
    existing: any,
  ): {
    directChanges: UpdateClassDto;
    approvalChanges: UpdateClassDto | null;
    requestType: PendingClassUpdateType | null;
  } {
    const saleChanges = this.sanitizeSaleUpdateDto(dto);
    const directChanges = new UpdateClassDto();
    const approvalChanges = new UpdateClassDto();

    const directFieldNames: Array<keyof UpdateClassDto> = [
      'name',
      'productPackageId',
      'subject',
      'grade',
      'learningGoals',
      'curriculum',
      'revenuePerStudent',
      'teacherSalaryCost',
      'maxStudents',
    ];

    for (const fieldName of directFieldNames) {
      if (saleChanges[fieldName] !== undefined) {
        directChanges[fieldName] = saleChanges[fieldName] as never;
      }
    }

    if (
      saleChanges.pricePerSession !== undefined
      && this.toSafeNumber(saleChanges.pricePerSession, 0)
        !== this.toSafeNumber(existing?.pricePerSession, 0)
    ) {
      approvalChanges.pricePerSession = saleChanges.pricePerSession;
    }

    if (
      saleChanges.teacherId !== undefined
      && !this.isSameObjectId(saleChanges.teacherId, existing?.teacher)
    ) {
      approvalChanges.teacherId = saleChanges.teacherId;
    }

    if (
      saleChanges.teacherPayPerSession !== undefined
      && this.toSafeNumber(saleChanges.teacherPayPerSession, 0)
        !== this.toSafeNumber(existing?.teacherPayPerSession, 0)
    ) {
      approvalChanges.teacherPayPerSession = saleChanges.teacherPayPerSession;
    }

    if (
      saleChanges.teacherPayPerStudent !== undefined
      && this.toSafeNumber(saleChanges.teacherPayPerStudent, 0)
        !== this.toSafeNumber(existing?.teacherPayPerStudent, 0)
    ) {
      approvalChanges.teacherPayPerStudent = saleChanges.teacherPayPerStudent;
    }

    if (
      saleChanges.baseDuration !== undefined
      && this.toSafeNumber(saleChanges.baseDuration, 0)
        !== this.toSafeNumber(existing?.baseDuration, 0)
    ) {
      approvalChanges.baseDuration = saleChanges.baseDuration;
    }

    if (
      saleChanges.sessionDuration !== undefined
      && this.toSafeNumber(saleChanges.sessionDuration, 0)
        !== this.toSafeNumber(existing?.sessionDuration, 0)
    ) {
      approvalChanges.sessionDuration = saleChanges.sessionDuration;
    }

    const hasApprovalChanges = Object.keys(approvalChanges).length > 0;
    const requestType = hasApprovalChanges
      ? this.resolveRequestedUpdateType(dto)
      : null;

    if (requestType) {
      approvalChanges.requestType = requestType;
    }

    return {
      directChanges,
      approvalChanges: hasApprovalChanges ? approvalChanges : null,
      requestType,
    };
  }

  private assertCanReviewPendingUpdate(pendingSaleUpdate: any, actor?: JwtPayload): void {
    if (!actor || !this.isManagerRole(actor.role)) {
      throw new ForbiddenException('Ban khong co quyen duyet thay doi lop hoc');
    }

    if (
      pendingSaleUpdate?.requestType === PendingClassUpdateType.DURATION_CHANGE
      && actor.role !== Role.DIRECTOR
    ) {
      throw new ForbiddenException('Chi Director moi duoc duyet thay doi thoi luong lop hoc');
    }

    if (pendingSaleUpdate?.status && pendingSaleUpdate.status !== ClassUpdateRequestStatus.PENDING) {
      throw new BadRequestException('Yeu cau sua lop hoc khong con cho duyet');
    }
  }

  private buildDurationSnapshotData(classState: any): {
    baseDuration: number;
    sessionDuration: number;
    pricePerSession: number;
    teacherPayPerSession: number;
    teacherPayPerStudent: number;
  } {
    const classPricing = getClassPricingConfigAt(classState);
    const snapshot = classState?.pricingSnapshot || {};
    const baseDuration =
      this.pickFirstPositiveNumber(
        classState?.baseDuration,
        classPricing.baseDuration,
        snapshot.referenceDuration,
        60,
      ) || 60;
    const sessionDuration =
      this.pickFirstPositiveNumber(
        classState?.sessionDuration,
        classPricing.sessionDuration,
        snapshot.sessionDuration,
        baseDuration,
      )
      || baseDuration;

    return {
      baseDuration,
      sessionDuration,
      pricePerSession: this.roundMoneyToThousand(this.pickFirstPositiveNumber(
        classState?.pricePerSession,
        classPricing.pricePerSession,
        snapshot.pricePerSession,
      )),
      teacherPayPerSession: this.roundMoneyDownToThousand(this.pickFirstPositiveNumber(
        classState?.teacherPayPerSession,
        classPricing.teacherPayPerSession,
        snapshot.teacherPayPerSession,
      )),
      teacherPayPerStudent: this.roundMoneyDownToThousand(this.pickFirstPositiveNumber(
        classState?.teacherPayPerStudent,
        classPricing.teacherPayPerStudent,
        snapshot.teacherPayPerStudent,
      )),
    };
  }

  private buildDurationSnapshotRecord(
    classState: any,
    source: DurationSnapshotSource,
    requestType: PendingClassUpdateType,
    effectiveById?: string | null,
  ) {
    return {
      source,
      requestType,
      effectiveAt: new Date(),
      effectiveBy: effectiveById ? new Types.ObjectId(effectiveById) : undefined,
      ...this.buildDurationSnapshotData(classState),
    };
  }

  private roundMoneyToThousand(value: number): number {
    if (!Number.isFinite(value) || value <= 0) return 0;
    return Math.round(value / 1000) * 1000;
  }

  private floorSessionCount(value: number): number {
    const normalized = Number.isFinite(value) ? value : 0;
    return normalized > 0 ? Math.floor(normalized) : 0;
  }

  private buildInitialStudentConfigRecord(
    classState: any,
    studentId: string,
    totalSessions: number,
    actorId?: string | null,
  ) {
    if (!classState?.teacher) {
      throw new BadRequestException('Lop hoc chua co giao vien phu trach');
    }

    const durationSnapshot = this.buildDurationSnapshotData(classState);
    return {
      studentId: new Types.ObjectId(studentId),
      teacherSlots: [
        {
          slotIndex: 1,
          slotType: StudentConfigSlotType.INITIAL,
          teacherId: new Types.ObjectId(classState.teacher.toString()),
          assignedAt: new Date(),
          assignedBy: actorId ? new Types.ObjectId(actorId) : undefined,
        },
      ],
      durationSlots: [
        {
          slotIndex: 1,
          slotType: StudentConfigSlotType.INITIAL,
          effectiveAt: new Date(),
          effectiveBy: actorId ? new Types.ObjectId(actorId) : undefined,
          baseDuration: durationSnapshot.baseDuration,
          sessionDuration: durationSnapshot.sessionDuration,
          totalSessions: this.floorSessionCount(totalSessions),
        },
      ],
      updatedAt: new Date(),
    };
  }

  private async buildStudentCompletedSessionMap(
    classroom: any,
    studentIds: string[],
  ): Promise<Map<string, number>> {
    const completedSessionMap = new Map<string, number>();
    if (!studentIds.length || !classroom?._id) {
      return completedSessionMap;
    }

    const rows = await this.sessionModel.aggregate([
      {
        $match: {
          classId: new Types.ObjectId(classroom._id),
          studentId: { $in: studentIds.map((studentId) => new Types.ObjectId(studentId)) },
          status: { $nin: [SessionStatus.CANCELLED, SessionStatus.RESCHEDULED] },
        },
      },
      {
        $group: {
          _id: '$studentId',
          count: { $sum: 1 },
        },
      },
    ]);

    for (const row of rows) {
      completedSessionMap.set(row._id?.toString?.() || '', this.toSafeNumber(row.count, 0));
    }

    return completedSessionMap;
  }

  private async buildStudentRemainingMinutesMap(
    classroom: any,
    studentIds: string[],
  ): Promise<Map<string, number>> {
    const remainingMinutesMap = new Map<string, number>();
    const remainingAllowanceMap = await this.buildStudentRemainingAllowanceMap(classroom, studentIds);
    for (const [studentId, allowance] of remainingAllowanceMap.entries()) {
      remainingMinutesMap.set(studentId, this.toSafeNumber(allowance.totalRemainingMinutes, 0));
    }
    return remainingMinutesMap;
  }

  private async buildStudentRemainingAllowanceMap(
    classroom: any,
    studentIds: string[],
  ): Promise<Map<string, {
    paidRemainingMinutes: number;
    bonusRemainingMinutes: number;
    trialRemainingMinutes: number;
    totalRemainingMinutes: number;
  }>> {
    const remainingAllowanceMap = new Map<string, {
      paidRemainingMinutes: number;
      bonusRemainingMinutes: number;
      trialRemainingMinutes: number;
      totalRemainingMinutes: number;
    }>();
    if (!studentIds.length || !classroom?._id) {
      return remainingAllowanceMap;
    }

    const fallbackReferenceDuration =
      this.toSafeNumber((classroom as any)?.pricingSnapshot?.referenceDuration, 0)
      || this.toSafeNumber((classroom as any)?.baseDuration, 60)
      || 60;

    const invoices = await this.invoiceModel
      .find({
        classId: new Types.ObjectId(classroom._id),
        studentId: { $in: studentIds.map((studentId) => new Types.ObjectId(studentId)) },
        status: { $nin: [InvoiceStatus.CANCELLED, InvoiceStatus.REJECTED] },
      })
      .select('studentId referenceDuration sessionsRemaining bonusSessionsRemaining trialSessionsRemaining')
      .lean();

    for (const invoice of invoices) {
      const studentId = (invoice as any)?.studentId?.toString?.();
      if (!studentId) {
        continue;
      }

      const referenceDuration =
        this.toSafeNumber((invoice as any)?.referenceDuration, fallbackReferenceDuration) || fallbackReferenceDuration;
      const current = remainingAllowanceMap.get(studentId) || {
        paidRemainingMinutes: 0,
        bonusRemainingMinutes: 0,
        trialRemainingMinutes: 0,
        totalRemainingMinutes: 0,
      };
      const paidRemainingMinutes =
        current.paidRemainingMinutes
        + (this.toSafeNumber((invoice as any)?.sessionsRemaining, 0) * referenceDuration);
      const bonusRemainingMinutes =
        current.bonusRemainingMinutes
        + (this.toSafeNumber((invoice as any)?.bonusSessionsRemaining, 0) * referenceDuration);
      const trialRemainingMinutes =
        current.trialRemainingMinutes
        + (this.toSafeNumber((invoice as any)?.trialSessionsRemaining, 0) * referenceDuration);
      remainingAllowanceMap.set(studentId, {
        paidRemainingMinutes,
        bonusRemainingMinutes,
        trialRemainingMinutes,
        totalRemainingMinutes: paidRemainingMinutes + bonusRemainingMinutes + trialRemainingMinutes,
      });
    }

    return remainingAllowanceMap;
  }

  private async buildProjectedStudentTotalSessionsMap(
    classroom: any,
    studentIds: string[],
    sessionDurationOverrides?: Map<string, number>,
  ): Promise<Map<string, number>> {
    const [completedSessionMap, remainingMinutesMap] = await Promise.all([
      this.buildStudentCompletedSessionMap(classroom, studentIds),
      this.buildStudentRemainingMinutesMap(classroom, studentIds),
    ]);

    const totalSessionsMap = new Map<string, number>();
    for (const studentId of studentIds) {
      const currentDuration = getCurrentDurationForStudent(classroom, studentId);
      const sessionDuration =
        this.toSafeNumber(sessionDurationOverrides?.get(studentId), 0)
        || this.toSafeNumber(currentDuration.sessionDuration, 0)
        || 60;
      const completedSessions = this.toSafeNumber(completedSessionMap.get(studentId), 0);
      const remainingMinutes = this.toSafeNumber(remainingMinutesMap.get(studentId), 0);
      const remainingSessionsAtDuration = sessionDuration > 0
        ? this.floorSessionCount(remainingMinutes / sessionDuration)
        : 0;
      const projectedTotal = completedSessions + remainingSessionsAtDuration;
      const fallbackTotal =
        this.toSafeNumber(currentDuration.totalSessions, this.toSafeNumber((classroom as any)?.totalSessions, 0));

      totalSessionsMap.set(
        studentId,
        projectedTotal > 0 ? projectedTotal : this.floorSessionCount(fallbackTotal),
      );
    }

    return totalSessionsMap;
  }

  private async withProjectedStudentTotals(classroom: any) {
    if (!classroom || !Array.isArray(classroom.studentConfigs) || !classroom.studentConfigs.length) {
      return classroom;
    }

    const studentIds = classroom.studentConfigs
      .map((config: any) => config?.studentId?._id?.toString?.() || config?.studentId?.toString?.())
      .filter((studentId: string | undefined): studentId is string => !!studentId);
    if (!studentIds.length) {
      return classroom;
    }

    const projectedTotalSessions = await this.buildProjectedStudentTotalSessionsMap(classroom, studentIds);
    const nextStudentConfigs = classroom.studentConfigs.map((config: any) => {
      const studentId = config?.studentId?._id?.toString?.() || config?.studentId?.toString?.();
      const nextTotal = studentId ? projectedTotalSessions.get(studentId) : undefined;
      if (nextTotal === undefined || !Array.isArray(config?.durationSlots) || !config.durationSlots.length) {
        return config;
      }

      let latestSlotIndex = 0;
      let latestSlotOrder = Number(config.durationSlots[0]?.slotIndex || 0);
      config.durationSlots.forEach((slot: any, index: number) => {
        const slotOrder = Number(slot?.slotIndex || 0);
        if (slotOrder >= latestSlotOrder) {
          latestSlotOrder = slotOrder;
          latestSlotIndex = index;
        }
      });

      const nextDurationSlots = config.durationSlots.map((slot: any, index: number) =>
        index === latestSlotIndex
          ? { ...slot, totalSessions: this.floorSessionCount(nextTotal) }
          : slot,
      );

      return {
        ...config,
        durationSlots: nextDurationSlots,
      };
    });

    return {
      ...classroom,
      studentConfigs: nextStudentConfigs,
    };
  }

  private async syncStudentConfigsOnClass(classId: string, actorId?: string | null): Promise<void> {
    const classroom = await this.classModel.findById(classId).lean();
    if (!classroom) {
      return;
    }

    const studentIds = ((classroom as any).students || [])
      .map((studentId: any) => studentId?.toString?.())
      .filter((studentId: string | undefined): studentId is string => !!studentId);

    const existingConfigs = Array.isArray((classroom as any).studentConfigs)
      ? (classroom as any).studentConfigs
      : [];
    const existingConfigMap = new Map(
      existingConfigs
        .map((config: any) => [config?.studentId?.toString?.(), config] as const)
        .filter(([studentId]) => !!studentId),
    );

    const totalSessionsMap = await this.buildProjectedStudentTotalSessionsMap(classroom, studentIds);
    const normalizedConfigs = studentIds.map((studentId) => {
      const existingConfig = existingConfigMap.get(studentId);
      return existingConfig || this.buildInitialStudentConfigRecord(
        classroom,
        studentId,
        totalSessionsMap.get(studentId) || 0,
        actorId,
      );
    });

    const hasMissingConfig = studentIds.some((studentId) => !existingConfigMap.has(studentId));
    const hasRemovedConfig = existingConfigs.length !== normalizedConfigs.length;
    if (!hasMissingConfig && !hasRemovedConfig) {
      return;
    }

    await this.classModel.findByIdAndUpdate(classId, {
      $set: {
        studentConfigs: normalizedConfigs,
      },
    });
  }

  private async syncTeacherSlotsOnClass(
    classId: string,
    teacherId: string,
    actorId?: string | null,
  ): Promise<void> {
    await this.syncStudentConfigsOnClass(classId, actorId);

    const classroom = await this.classModel.findById(classId).lean();
    if (!classroom) {
      return;
    }

    const normalizedTeacherId = teacherId.toString();
    const studentConfigs = Array.isArray((classroom as any).studentConfigs)
      ? (classroom as any).studentConfigs
      : [];
    if (!studentConfigs.length) {
      return;
    }

    const assignedAt = new Date();
    const assignedBy = actorId ? new Types.ObjectId(actorId) : undefined;
    let hasChanges = false;

    const nextStudentConfigs = studentConfigs.map((config: any) => {
      const teacherSlots = Array.isArray(config?.teacherSlots)
        ? [...config.teacherSlots]
        : [];
      teacherSlots.sort((left: any, right: any) => Number(left?.slotIndex || 0) - Number(right?.slotIndex || 0));

      const currentTeacherId = teacherSlots.at(-1)?.teacherId?.toString?.() || null;
      if (currentTeacherId === normalizedTeacherId && teacherSlots.length > 0) {
        return config;
      }

      hasChanges = true;
      const nextTeacherSlot = {
        teacherId: new Types.ObjectId(normalizedTeacherId),
        assignedAt,
        assignedBy,
      };

      const nextTeacherSlots = teacherSlots.length === 0
        ? [
            {
              slotIndex: 1,
              slotType: StudentConfigSlotType.INITIAL,
              ...nextTeacherSlot,
            },
          ]
        : teacherSlots.length >= 3
          ? [
              {
                slotIndex: 1,
                slotType: StudentConfigSlotType.INITIAL,
                ...nextTeacherSlot,
              },
            ]
          : [
              ...teacherSlots,
              {
                slotIndex: teacherSlots.length + 1,
                slotType: StudentConfigSlotType.UPDATE,
                ...nextTeacherSlot,
              },
            ];

      return {
        ...config,
        teacherSlots: nextTeacherSlots,
        updatedAt: assignedAt,
      };
    });

    if (!hasChanges) {
      return;
    }

    await this.classModel.findByIdAndUpdate(classId, {
      $set: {
        studentConfigs: nextStudentConfigs,
      },
    });
  }

  private async syncDurationSlotsOnClass(
    classId: string,
    actorId?: string | null,
  ): Promise<void> {
    await this.syncStudentConfigsOnClass(classId, actorId);

    const classroom = await this.classModel.findById(classId).lean();
    if (!classroom) {
      return;
    }

    const studentConfigs = Array.isArray((classroom as any).studentConfigs)
      ? (classroom as any).studentConfigs
      : [];
    if (!studentConfigs.length) {
      return;
    }

    const targetDuration = this.buildDurationSnapshotData(classroom);
    const studentIds = studentConfigs
      .map((config: any) => config?.studentId?.toString?.())
      .filter((studentId: string | undefined): studentId is string => !!studentId);
    const totalSessionsMap = await this.buildProjectedStudentTotalSessionsMap(
      classroom,
      studentIds,
      new Map(studentIds.map((studentId) => [studentId, targetDuration.sessionDuration])),
    );

    const effectiveAt = new Date();
    const effectiveBy = actorId ? new Types.ObjectId(actorId) : undefined;
    let hasChanges = false;

    const nextStudentConfigs = studentConfigs.map((config: any) => {
      const studentId = config?.studentId?.toString?.();
      if (!studentId) {
        return config;
      }

      const durationSlots = Array.isArray(config?.durationSlots)
        ? [...config.durationSlots]
        : [];
      durationSlots.sort((left: any, right: any) => Number(left?.slotIndex || 0) - Number(right?.slotIndex || 0));

      const currentDurationSlot = durationSlots.at(-1);
      const nextTotalSessions = this.floorSessionCount(
        totalSessionsMap.get(studentId)
        || this.toSafeNumber(
          currentDurationSlot?.totalSessions,
          this.toSafeNumber((classroom as any)?.totalSessions, 0),
        ),
      );

      const currentBaseDuration = this.toSafeNumber(currentDurationSlot?.baseDuration, 0);
      const currentSessionDuration = this.toSafeNumber(currentDurationSlot?.sessionDuration, 0);
      const currentTotalSessions = this.floorSessionCount(
        this.toSafeNumber(
          currentDurationSlot?.totalSessions,
          this.toSafeNumber((classroom as any)?.totalSessions, 0),
        ),
      );

      if (
        currentBaseDuration === targetDuration.baseDuration
        && currentSessionDuration === targetDuration.sessionDuration
        && currentTotalSessions === nextTotalSessions
        && durationSlots.length > 0
      ) {
        return config;
      }

      hasChanges = true;
      const nextDurationSlot = {
        effectiveAt,
        effectiveBy,
        baseDuration: targetDuration.baseDuration,
        sessionDuration: targetDuration.sessionDuration,
        totalSessions: nextTotalSessions,
      };

      const nextDurationSlots = durationSlots.length === 0
        ? [
            {
              slotIndex: 1,
              slotType: StudentConfigSlotType.INITIAL,
              ...nextDurationSlot,
            },
          ]
        : durationSlots.length >= 3
          ? [
              {
                slotIndex: 1,
                slotType: StudentConfigSlotType.INITIAL,
                ...nextDurationSlot,
              },
            ]
          : [
              ...durationSlots,
              {
                slotIndex: durationSlots.length + 1,
                slotType: StudentConfigSlotType.UPDATE,
                ...nextDurationSlot,
              },
            ];

      return {
        ...config,
        durationSlots: nextDurationSlots,
        updatedAt: effectiveAt,
      };
    });

    if (!hasChanges) {
      return;
    }

    await this.classModel.findByIdAndUpdate(classId, {
      $set: {
        studentConfigs: nextStudentConfigs,
      },
    });
  }

  private async validateTeacherForSaleScope(
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

  private async validateTeacherForClassSale(classroom: any, teacherId: string): Promise<Types.ObjectId> {
    return this.validateTeacherForSaleScope(
      teacherId,
      classroom?.sale?.toString?.() || null,
    );
  }

  private async assertStudentsBelongToSale(studentIds: string[], saleId?: string | null): Promise<void> {
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

  private async assertClassAccess(classroom: any, actor?: JwtPayload): Promise<void> {
    if (!actor) return;
    const actorId = this.getActorId(actor);
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

  private async getParentStudentIds(parentUserId: string): Promise<string[]> {
    const ownedStudents = await this.studentModel
      .find({ parentUserId: new Types.ObjectId(parentUserId) })
      .select('_id')
      .lean();
    return ownedStudents.map((student: any) => student._id.toString());
  }

  private filterClassStudentsByIds(classroom: any, allowedStudentIds: Set<string>) {
    if (!classroom || !Array.isArray(classroom.students)) {
      return classroom;
    }

    const filteredStudents = classroom.students.filter((student: any) => {
      const studentId = student?._id?.toString?.() ?? student?.toString?.();
      return !!studentId && allowedStudentIds.has(studentId);
    });

    return {
      ...classroom,
      students: filteredStudents,
      studentConfigs: Array.isArray(classroom.studentConfigs)
        ? classroom.studentConfigs.filter((config: any) => {
            const studentId = config?.studentId?._id?.toString?.() || config?.studentId?.toString?.();
            return !!studentId && allowedStudentIds.has(studentId);
          })
        : [],
    };
  }

  async create(dto: CreateClassDto, actor?: JwtPayload) {
    await this.ensureCodeUnique(dto.code);

    let invoice: any = null;
    if (dto.invoiceId) {
      invoice = await this.invoiceModel.findById(dto.invoiceId).lean();
      if (!invoice) {
        throw new NotFoundException('Hoa don khong ton tai');
      }
      if (invoice.status !== InvoiceStatus.APPROVED && invoice.status !== InvoiceStatus.PAID) {
        throw new ForbiddenException('Hoa don chua duoc duyet');
      }
      if (!dto.studentIds?.length && invoice.studentId) {
        dto.studentIds = [invoice.studentId.toString()];
      }
      if (!dto.classMode && invoice.classType) {
        dto.classMode = invoice.classType;
      }
      if (!dto.productPackageId && invoice.productId) {
        dto.productPackageId = invoice.productId.toString();
      }
      invoice = await this.hydrateInvoicePricingContext(invoice);
    }

    // SALE must create class from their own approved invoice
    if (actor?.role === Role.SALE) {
      if (!dto.invoiceId) {
        throw new BadRequestException('SALE phai chon hoa don da duyet de tao lop');
      }
      const actorId = this.getActorId(actor)!;
      if (invoice?.saleId && invoice.saleId.toString() !== actorId) {
        throw new ForbiddenException('SALE chi duoc tao lop tu hoa don cua minh');
      }
      dto.saleId = actorId;
    }

    // Auto-bind sale from invoice if present
    if (!dto.saleId && invoice?.saleId) {
      dto.saleId = invoice.saleId.toString();
    }

    if (actor?.role === Role.SALE) {
      await this.validateTeacherForSaleScope(dto.teacherId, dto.saleId);
      await this.assertStudentsBelongToSale(dto.studentIds || [], dto.saleId);
    }

    const payload = await this.buildPayload(dto);
    this.applyInvoicePricingDefaults(payload, invoice);
    this.attachPricingSnapshot(payload, invoice);
    (payload as any).durationSnapshots = [
      this.buildDurationSnapshotRecord(
        payload,
        DurationSnapshotSource.INITIAL,
        PendingClassUpdateType.GENERAL,
        this.getActorId(actor),
      ),
    ];

    if (dto.invoiceId) {
      (payload as any).invoiceId = new Types.ObjectId(dto.invoiceId);
    }

    const created = await new this.classModel(payload).save();

    if (dto.invoiceId) {
      await this.invoiceModel.updateOne(
        { _id: dto.invoiceId },
        { $set: { classId: created._id } },
      );
      await this.syncOrderProgressForInvoiceIds([dto.invoiceId]);
    }

    await this.syncStudentConfigsOnClass(created._id.toString(), this.getActorId(actor));

    this.triggerStudentSupportSnapshotRefreshForClass(created._id.toString(), 'createClass');
    return this.findByIdPopulated(created._id);
  }

  async findOne(id: string, actor?: JwtPayload) {
    const classroom = await this.classModel
      .findById(id)
      .select('teacher sale students substituteTeachers studentConfigs')
      .lean();
    if (!classroom) throw new NotFoundException('Lop hoc khong ton tai');
    await this.assertClassAccess(classroom, actor);
    const detailedClass = await this.findByIdPopulated(id);
    if (actor?.role === Role.TEACHER) {
      const actorTeacherId = this.getActorId(actor);
      if (!actorTeacherId) {
        throw new ForbiddenException('Ban khong co quyen truy cap lop hoc nay');
      }
      const allowedStudentIds = new Set(getTeacherOwnedStudentIds(detailedClass, actorTeacherId));
      return this.filterClassStudentsByIds(detailedClass, allowedStudentIds);
    }

    if (actor?.role !== Role.PARENT) {
      return detailedClass;
    }

    const actorId = this.getActorId(actor);
    if (!actorId) {
      throw new ForbiddenException('Ban khong co quyen truy cap lop hoc nay');
    }

    const allowedStudentIds = new Set(await this.getParentStudentIds(actorId));
    return this.filterClassStudentsByIds(detailedClass, allowedStudentIds);
  }

  async findAll(actor: JwtPayload) {
    let filter: any = {};
    const actorId = this.getActorId(actor);
    let parentStudentIdSet: Set<string> | null = null;

    if (actor.role === Role.SALE) {
      filter = { sale: actorId };
    } else if (actor.role === Role.TEACHER) {
      filter = {
        $or: [
          { teacher: actorId },
          { 'substituteTeachers.teacherId': actorId },
          { 'studentConfigs.teacherSlots.teacherId': actorId },
        ],
      };
    } else if (actor.role === Role.PARENT) {
      if (!actorId) {
        throw new ForbiddenException('Ban khong co quyen truy cap danh sach lop hoc');
      }
      const parentStudentIds = await this.getParentStudentIds(actorId);
      if (!parentStudentIds.length) {
        return [];
      }
      parentStudentIdSet = new Set(parentStudentIds);
      filter = {
        students: {
          $in: parentStudentIds.map((id) => new Types.ObjectId(id)),
        },
      };
    }
    // DIRECTOR, OPS có thể xem tất cả lớp (filter rỗng)

    const classrooms = await this.classModel
      .find(filter)
      .sort({ createdAt: -1 })
      .populate('teacher', 'fullName email role')
      .populate('sale', 'fullName email role')
      .populate('pendingSaleUpdate.requestedBy', 'fullName email role')
      .populate('pendingSaleUpdate.reviewedBy', 'fullName email role')
      .populate('productPackage', 'name code teachingMode pricePerSession suggestedPrice')
      .populate('students', 'fullName age parentName studentCode')
      .populate('studentConfigs.studentId', 'fullName studentCode')
      .populate('studentConfigs.teacherSlots.teacherId', 'fullName email role userCode')
      .populate('studentConfigs.teacherSlots.assignedBy', 'fullName email role')
      .lean();

    const sourceInvoiceMap = await this.buildClassSourceInvoiceMap(classrooms);
    const mapped = await Promise.all(classrooms.map(async (classroom) => {
      const projectedClassroom = await this.withProjectedStudentTotals(classroom);
      return this.decorateClassroomForDisplay(
        projectedClassroom,
        this.getClassSourceInvoice(projectedClassroom, sourceInvoiceMap),
      );
    }));

    if (actor.role === Role.TEACHER && actorId) {
      return mapped
        .map((classroom) => {
          const allowedStudentIds = new Set(getTeacherOwnedStudentIds(classroom, actorId));
          if (!allowedStudentIds.size) {
            return null;
          }
          return this.filterClassStudentsByIds(classroom, allowedStudentIds);
        })
        .filter((classroom): classroom is NonNullable<typeof classroom> => !!classroom);
    }

    if (actor.role !== Role.PARENT || !parentStudentIdSet) {
      return mapped;
    }

    return mapped.map((classroom) =>
      this.filterClassStudentsByIds(classroom, parentStudentIdSet!),
    );
  }

  async findSaleOfflineOptions(actor: JwtPayload) {
    const actorId = this.getActorId(actor);
    if (actor.role !== Role.SALE || !actorId) {
      throw new ForbiddenException('Ban khong co quyen truy cap danh sach lop offline');
    }

    const classrooms = await this.classModel
      .find({
        classMode: ClassMode.OFFLINE,
        status: ClassStatus.ACTIVE,
        sale: new Types.ObjectId(actorId),
        $or: [
          { invoiceId: { $exists: false } },
          { invoiceId: null },
        ],
      })
      .sort({ createdAt: -1 })
      .populate('teacher', 'fullName email role')
      .populate('sale', 'fullName email role')
      .populate('productPackage', 'name code teachingMode pricePerSession suggestedPrice')
      .populate('students', 'fullName age parentName studentCode')
      .lean();

    const sourceInvoiceMap = await this.buildClassSourceInvoiceMap(classrooms);
    return classrooms
      .filter((classroom) => {
        if (!classroom.maxStudents) {
          return true;
        }

        const currentStudentCount = Array.isArray(classroom.students) ? classroom.students.length : 0;
        return currentStudentCount < classroom.maxStudents;
      })
      .map((classroom) =>
        this.decorateClassroomForDisplay(
          classroom,
          this.getClassSourceInvoice(classroom, sourceInvoiceMap),
        ),
      );
  }

  async autoPlaceApprovedInvoice(
    params: {
      invoiceId: string;
      studentId: string;
      requestedClassId?: string | null;
      requestedClassCode?: string | null;
      requestedTeacherId?: string | null;
    },
    actor?: JwtPayload,
  ): Promise<{ action: 'SKIPPED' | 'ASSIGNED_EXISTING' | 'CREATED_NEW'; classId?: string }> {
    const invoiceId = this.objectIdToString(params.invoiceId);
    const studentId = this.objectIdToString(params.studentId);
    const requestedClassId = this.objectIdToString(params.requestedClassId);
    const requestedClassCode = String(params.requestedClassCode || '').trim().toUpperCase() || null;
    const requestedTeacherId = this.objectIdToString(params.requestedTeacherId);

    if (!invoiceId || !studentId || (!requestedClassId && !requestedClassCode)) {
      if (!requestedClassId && requestedTeacherId && !requestedClassCode) {
        this.logger.warn(
          `Skip auto-placing invoice ${invoiceId || params.invoiceId}: class code must be entered manually`,
        );
      }
      return { action: 'SKIPPED' };
    }

    if (requestedClassId) {
      const classroom = await this.classModel
        .findById(requestedClassId)
        .select('_id classMode')
        .lean();
      if (!classroom) {
        throw new NotFoundException('Lop duoc chon tren order khong ton tai');
      }

      const invoice = await this.invoiceModel
        .findById(invoiceId)
        .select('_id classId classType')
        .lean();
      if (!invoice) {
        throw new NotFoundException('Hoa don khong ton tai');
      }
      if ((invoice as any).classId) {
        return { action: 'SKIPPED', classId: this.objectIdToString((invoice as any).classId) || undefined };
      }
      if ((invoice as any).classType && classroom.classMode && (invoice as any).classType !== classroom.classMode) {
        throw new BadRequestException('Loai lop duoc chon tren order khong khop voi hoa don');
      }

      const assigned = await this.assignStudentsBySale(
        requestedClassId,
        { studentIds: [studentId], invoiceId },
        actor as JwtPayload,
      );
      return {
        action: 'ASSIGNED_EXISTING',
        classId: this.objectIdToString((assigned as any)?._id) || requestedClassId,
      };
    }

    const invoice = await this.invoiceModel
      .findById(invoiceId)
      .select('_id classId classType orderId orderItemIndex productId productName saleId studentId')
      .lean();
    if (!invoice) {
      throw new NotFoundException('Hoa don khong ton tai');
    }
    if ((invoice as any).classId) {
      return {
        action: 'SKIPPED',
        classId: this.objectIdToString((invoice as any).classId) || undefined,
      };
    }

    const matchedClass = requestedClassCode
      ? await this.classModel
          .findOne({ code: requestedClassCode })
          .select('_id classMode')
          .lean()
      : null;

    if (matchedClass) {
      if ((invoice as any).classType && matchedClass.classMode && (invoice as any).classType !== matchedClass.classMode) {
        throw new BadRequestException('Loai lop theo ma lop du kien khong khop voi hoa don');
      }

      const assigned = await this.assignStudentsBySale(
        matchedClass._id.toString(),
        { studentIds: [studentId], invoiceId },
        actor as JwtPayload,
      );
      return {
        action: 'ASSIGNED_EXISTING',
        classId: this.objectIdToString((assigned as any)?._id) || matchedClass._id.toString(),
      };
    }

    if (!requestedTeacherId) {
      this.logger.warn(
        `Skip auto-creating class for invoice ${invoiceId}: missing requestedTeacherId for class code ${requestedClassCode}`,
      );
      return { action: 'SKIPPED' };
    }

    const [student, order] = await Promise.all([
      this.studentModel.findById(studentId).select('fullName').lean(),
      (invoice as any).orderId
        ? this.orderModel.findById((invoice as any).orderId).select('items').lean()
        : Promise.resolve(null),
    ]);

    const orderItemIndex = Number((invoice as any).orderItemIndex ?? -1);
    const orderItems = Array.isArray((order as any)?.items) ? (order as any).items : [];
    const orderItem = orderItemIndex >= 0 ? orderItems[orderItemIndex] || null : null;

    const created = await this.create(
      {
        name: this.buildAutoClassName({
          studentName: (student as any)?.fullName,
          productName: (invoice as any)?.productName,
          classMode: (invoice as any)?.classType,
        }),
        code: requestedClassCode || '',
        teacherId: requestedTeacherId,
        saleId: this.objectIdToString((invoice as any)?.saleId) || undefined,
        invoiceId,
        classMode: (invoice as any)?.classType || undefined,
        productPackageId: this.objectIdToString((invoice as any)?.productId) || undefined,
        studentIds: [studentId],
        subject: String(orderItem?.subject || '').trim() || undefined,
        learningGoals: String(orderItem?.learningGoals || '').trim() || undefined,
        maxStudents:
          orderItem?.maxStudents !== undefined && orderItem?.maxStudents !== null
            ? Number(orderItem.maxStudents)
            : undefined,
      },
      actor,
    );

    return {
      action: 'CREATED_NEW',
      classId: this.objectIdToString((created as any)?._id) || undefined,
    };
  }

  async update(id: string, dto: UpdateClassDto, actor?: JwtPayload) {
    const existing = await this.classModel.findById(id).lean();
    if (!existing) throw new NotFoundException('Class not found');
    const actorId = this.getActorId(actor);

    if (actor?.role === Role.SALE) {
      if (!actorId || existing.sale?.toString() !== actorId) {
        throw new ForbiddenException('Ban khong phu trach lop hoc nay');
      }

      const { directChanges, approvalChanges, requestType } = this.splitSaleUpdateChanges(dto, existing);

      const directPrepared = await this.prepareClassUpdate(id, directChanges, existing);
      const hasDirectChanges = Object.keys(directPrepared.update).length > 0;

      if (approvalChanges?.teacherId) {
        await this.validateTeacherForClassSale(existing, approvalChanges.teacherId);
      }
      const hasApprovalChanges = !!approvalChanges;

      if (!hasDirectChanges && !hasApprovalChanges) {
        throw new BadRequestException('Khong co thay doi nao de cap nhat');
      }

      if (hasDirectChanges) {
        const directHistoryArtifacts = await this.buildClassHistoryArtifacts(
          existing,
          directChanges,
          actor,
          ClassEditHistoryAction.SALE_DIRECT_UPDATED,
        );
        await this.applyPreparedClassUpdate(id, directPrepared, 'saleDirectUpdateClass', {
          durationSnapshotSource: directPrepared.durationSnapshotData
            ? DurationSnapshotSource.MANAGER_DIRECT
            : undefined,
          requestType: this.resolveRequestedUpdateType(directChanges),
          effectiveById: actorId,
          historyEntry: directHistoryArtifacts.historyEntry,
        });
      }

      if (hasApprovalChanges) {
        const persistedRequestedChanges = this.stripUpdateMetaFields(approvalChanges as UpdateClassDto);
        const approvalHistoryArtifacts = await this.buildClassHistoryArtifacts(
          existing,
          approvalChanges,
          actor,
          ClassEditHistoryAction.SALE_REQUESTED,
        );
        await this.classModel.findByIdAndUpdate(id, {
          $set: {
            pendingSaleUpdate: {
              status: ClassUpdateRequestStatus.PENDING,
              requestType,
              requestedChanges: persistedRequestedChanges,
              requestedBy: new Types.ObjectId(actorId),
              requestedAt: new Date(),
              changeSummary: approvalHistoryArtifacts.changeSummary,
              durationPreview: approvalHistoryArtifacts.durationPreview,
              reviewedBy: null,
              reviewedAt: null,
              rejectionReason: null,
            },
          },
          $push: {
            editHistory: approvalHistoryArtifacts.historyEntry,
          },
        });

        if (hasDirectChanges) {
          return {
            ok: true,
            pendingApproval: true,
            message: requestType === PendingClassUpdateType.DURATION_CHANGE
              ? 'Da cap nhat thong tin lop. Phan doi giao vien/thoi luong dang cho Director duyet'
              : 'Da cap nhat thong tin lop. Phan doi giao vien dang cho Director/Ops duyet',
          };
        }

        return {
          ok: true,
          pendingApproval: true,
          message: requestType === PendingClassUpdateType.DURATION_CHANGE
            ? 'Da gui yeu cau doi giao vien/thoi luong lop hoc cho Director duyet'
            : 'Da gui yeu cau doi giao vien/luong GV cho Director/Ops duyet',
        };
      }

      return this.findByIdPopulated(id);
    }

    if (actor?.role && !this.isManagerRole(actor.role)) {
      throw new ForbiddenException('Ban khong co quyen cap nhat lop hoc');
    }

    const prepared = await this.prepareClassUpdate(id, dto, existing);
    const managerHistoryArtifacts = await this.buildClassHistoryArtifacts(
      existing,
      dto,
      actor,
      ClassEditHistoryAction.MANAGER_UPDATED,
    );
    await this.applyPreparedClassUpdate(id, prepared, 'updateClass', {
      clearPendingSaleUpdate: true,
      durationSnapshotSource: prepared.durationSnapshotData
        ? DurationSnapshotSource.MANAGER_DIRECT
        : undefined,
      requestType: this.resolveRequestedUpdateType(dto),
      effectiveById: actorId,
      historyEntry: managerHistoryArtifacts.historyEntry,
    });

    return this.findByIdPopulated(id);
  }

  async approvePendingSaleUpdate(id: string, actor?: JwtPayload) {
    const existing = await this.classModel.findById(id).lean();
    if (!existing) throw new NotFoundException('Class not found');

    const pendingSaleUpdate = (existing as any).pendingSaleUpdate;
    if (!pendingSaleUpdate || pendingSaleUpdate.status !== ClassUpdateRequestStatus.PENDING) {
      throw new BadRequestException('Lop hoc khong co yeu cau cap nhat cho duyet');
    }
    this.assertCanReviewPendingUpdate(pendingSaleUpdate, actor);

    const requestedChanges = (pendingSaleUpdate.requestedChanges || {}) as UpdateClassDto;
    const requestType = (pendingSaleUpdate.requestType || PendingClassUpdateType.GENERAL) as PendingClassUpdateType;
    const prepared = await this.prepareClassUpdate(id, requestedChanges, existing);
    if (requestedChanges.teacherId) {
      prepared.update.teacher = await this.validateTeacherForClassSale(existing, requestedChanges.teacherId);
    }
    if (!Object.keys(prepared.update).length) {
      throw new BadRequestException('Yeu cau cap nhat khong hop le');
    }

    const actorId = this.getActorId(actor);
    const approvalHistoryArtifacts = await this.buildClassHistoryArtifacts(
      existing,
      requestedChanges,
      actor,
      ClassEditHistoryAction.APPROVED,
    );
    await this.applyPreparedClassUpdate(id, prepared, 'approvePendingSaleUpdate', {
      clearPendingSaleUpdate: true,
      durationSnapshotSource: prepared.durationSnapshotData
        ? (
          requestType === PendingClassUpdateType.DURATION_CHANGE
            ? DurationSnapshotSource.APPROVED_DURATION_CHANGE
            : DurationSnapshotSource.APPROVED_SALE_UPDATE
        )
        : undefined,
      requestType,
      effectiveById: actorId,
      historyEntry: approvalHistoryArtifacts.historyEntry,
    });
    return this.findByIdPopulated(id);
  }

  async rejectPendingSaleUpdate(id: string, reason?: string, actor?: JwtPayload) {
    const existing = await this.classModel.findById(id).lean();
    if (!existing) throw new NotFoundException('Class not found');

    const pendingSaleUpdate = (existing as any).pendingSaleUpdate;
    if (!pendingSaleUpdate || pendingSaleUpdate.status !== ClassUpdateRequestStatus.PENDING) {
      throw new BadRequestException('Lop hoc khong co yeu cau cap nhat cho duyet');
    }
    this.assertCanReviewPendingUpdate(pendingSaleUpdate, actor);

    const actorId = this.getActorId(actor);
    if (!actorId) {
      throw new ForbiddenException('Khong xac dinh duoc nguoi duyet');
    }

    const rejectionHistoryEntry = {
      editedAt: new Date(),
      editedByUserId: new Types.ObjectId(actorId),
      editedByName: actor?.fullName || actor?.email,
      editedByRole: actor?.role,
      action: ClassEditHistoryAction.REJECTED,
      requestType: (pendingSaleUpdate.requestType || PendingClassUpdateType.GENERAL) as PendingClassUpdateType,
      changes: Array.isArray(pendingSaleUpdate.changeSummary) ? pendingSaleUpdate.changeSummary : [],
      durationPreview: pendingSaleUpdate.durationPreview,
      note: reason?.trim() || 'Khong dat yeu cau',
    };

    await this.classModel.findByIdAndUpdate(id, {
      $set: {
        'pendingSaleUpdate.status': ClassUpdateRequestStatus.REJECTED,
        'pendingSaleUpdate.reviewedBy': new Types.ObjectId(actorId),
        'pendingSaleUpdate.reviewedAt': new Date(),
        'pendingSaleUpdate.rejectionReason': reason?.trim() || 'Khong dat yeu cau',
      },
      $push: {
        editHistory: rejectionHistoryEntry,
      },
    });

    return this.findByIdPopulated(id);
  }

  async remove(id: string) {
    const classroom = await this.classModel.findById(id).lean();
    if (!classroom) throw new NotFoundException('Class not found');

    // Cascade: delete related attendance and session records
    const classObjectId = new Types.ObjectId(id);
    const AttendanceModel = this.studentModel.db.model('Attendance');
    const SessionModel = this.studentModel.db.model('Session');
    await Promise.all([
      AttendanceModel.deleteMany({ classId: classObjectId }),
      SessionModel.deleteMany({ classId: classObjectId }),
    ]);

    // Clear classId on linked invoices
    await this.invoiceModel.updateMany(
      { classId: classObjectId },
      { $unset: { classId: 1 } },
    );

    const deleted = await this.classModel.findByIdAndDelete(id).lean();
    const studentIds = ((classroom as any).students || []).map((studentId: any) =>
      studentId?.toString?.(),
    ).filter((studentId: string | undefined): studentId is string => !!studentId);
    this.triggerStudentSupportSnapshotRefreshForStudentIds(studentIds, 'removeClass');
    return deleted;
  }

  async assignStudentsBySale(id: string, dto: AssignStudentsDto, actor: JwtPayload) {
    const classroom = await this.classModel.findById(id).lean();
    if (!classroom) throw new NotFoundException('Class not found');
    const actorId = this.getActorId(actor);

    // Sale can only assign to their own classes; Director/OPS can assign to any
    if (actor.role === Role.SALE) {
      if (!actorId || classroom.sale?.toString() !== actorId) {
        throw new ForbiddenException('Bạn không phụ trách lớp này');
      }
    }
    const studentIds = dto.studentIds || [];
    let invoice: any = null;
    if (dto.invoiceId) {
      invoice = await this.invoiceModel.findById(dto.invoiceId).lean();
      if (!invoice) {
        throw new NotFoundException('Hoa don khong ton tai');
      }
      if (invoice.status !== InvoiceStatus.APPROVED && invoice.status !== InvoiceStatus.PAID) {
        throw new ForbiddenException('Hoa don chua duoc duyet');
      }
      if (invoice.classId) {
        throw new BadRequestException('Hoa don nay da duoc gan vao lop hoc khac');
      }
      if (invoice.classType && invoice.classType !== classroom.classMode) {
        throw new BadRequestException('Loai lop cua hoa don khong khop voi lop duoc chon');
      }
      const invoiceStudentId = invoice.studentId?.toString?.();
      if (!invoiceStudentId || !studentIds.includes(invoiceStudentId)) {
        throw new BadRequestException('Hoc sinh tren hoa don phai nam trong danh sach them vao lop');
      }
      if (actor.role === Role.SALE && actorId) {
        const invoiceSaleId = invoice.saleId?.toString?.();
        if (invoiceSaleId && invoiceSaleId !== actorId) {
          throw new ForbiddenException('Sale chi duoc su dung hoa don cua minh');
        }
      }
    }
    if (!studentIds.length) throw new BadRequestException('Vui lòng chọn học viên');
    // Only allow APPROVED students to be enrolled
    const studentFilter: any = {
      _id: { $in: studentIds },
      approvalStatus: 'APPROVED',
    };
    if (actor.role === Role.SALE && actorId) {
      studentFilter.saleId = new Types.ObjectId(actorId);
    }
    const valid = await this.studentModel.find(studentFilter, '_id').lean();
    if (valid.length !== studentIds.length) {
      const invalidCount = studentIds.length - valid.length;
      throw new BadRequestException(`${invalidCount} học viên chưa được duyệt hoặc không hợp lệ`);
    }
    const existingStudentIds = classroom.students?.map((s: any) => s.toString()) || [];
    const merged = Array.from(
      new Set([...existingStudentIds, ...studentIds])
    ).map((sid) => new Types.ObjectId(sid));

    // Enforce class capacity
    if ((classroom as any).maxStudents && merged.length > (classroom as any).maxStudents) {
      throw new BadRequestException(
        `Lớp chỉ chứa tối đa ${(classroom as any).maxStudents} học viên (hiện có ${existingStudentIds.length})`,
      );
    }
    
    // Cập nhật danh sách học sinh trong lớp
    await this.classModel.findByIdAndUpdate(id, { students: merged });
    if (dto.invoiceId) {
      await this.invoiceModel.updateOne(
        { _id: dto.invoiceId },
        { $set: { classId: new Types.ObjectId(id) } },
      );
      await this.syncOrderProgressForInvoiceIds([dto.invoiceId]);
    }
    await this.syncStudentConfigsOnClass(id, actorId);

    this.triggerStudentSupportSnapshotRefreshForClass(id, 'assignStudentsBySale');
    return this.findByIdPopulated(id);
  }

  async updateStudentConfig(
    classId: string,
    studentId: string,
    dto: UpdateStudentConfigDto,
    actor?: JwtPayload,
  ) {
    const classroom = await this.classModel.findById(classId).lean();
    if (!classroom) {
      throw new NotFoundException('Class not found');
    }

    const actorId = this.getActorId(actor);
    if (actor?.role === Role.SALE) {
      if (!actorId || classroom.sale?.toString() !== actorId) {
        throw new ForbiddenException('Ban khong phu trach lop hoc nay');
      }
    } else if (!actor?.role || !this.isManagerRole(actor.role)) {
      throw new ForbiddenException('Ban khong co quyen cap nhat hoc sinh trong lop');
    }

    const classStudentIds = ((classroom as any).students || [])
      .map((currentStudentId: any) => currentStudentId?.toString?.())
      .filter((currentStudentId: string | undefined): currentStudentId is string => !!currentStudentId);
    if (!classStudentIds.includes(studentId)) {
      throw new BadRequestException('Hoc sinh khong thuoc lop hoc nay');
    }

    await this.syncStudentConfigsOnClass(classId, actorId);
    const refreshedClassroom = await this.classModel.findById(classId).lean();
    if (!refreshedClassroom) {
      throw new NotFoundException('Class not found');
    }

    const studentConfig = ((refreshedClassroom as any).studentConfigs || [])
      .find((config: any) => config?.studentId?.toString?.() === studentId);
    if (!studentConfig) {
      throw new NotFoundException('Khong tim thay cau hinh hoc sinh trong lop');
    }

    const updateQuery: Record<string, any> = {
      $set: {
        'studentConfigs.$[studentConfig].updatedAt': new Date(),
      },
    };
    const arrayFilters = [{ 'studentConfig.studentId': new Types.ObjectId(studentId) }];
    let hasChanges = false;

    if (dto.teacherId) {
      const teacherSlots = Array.isArray(studentConfig.teacherSlots) ? studentConfig.teacherSlots : [];
      const currentTeacherId = getCurrentTeacherIdForStudent(refreshedClassroom, studentId);

      if (currentTeacherId !== dto.teacherId) {
        if (teacherSlots.length >= 3) {
          throw new BadRequestException('Da dat toi da 3 moc giao vien cho hoc sinh nay');
        }

        const validatedTeacherId = await this.validateTeacherForClassSale(refreshedClassroom, dto.teacherId);
        updateQuery.$push = updateQuery.$push || {};
        updateQuery.$push['studentConfigs.$[studentConfig].teacherSlots'] = {
          slotIndex: teacherSlots.length + 1,
          slotType: StudentConfigSlotType.UPDATE,
          teacherId: validatedTeacherId,
          assignedAt: new Date(),
          assignedBy: actorId ? new Types.ObjectId(actorId) : undefined,
        };
        hasChanges = true;
      }
    }

    const hasDurationPayload = dto.baseDuration !== undefined || dto.sessionDuration !== undefined;
    if (hasDurationPayload) {
      const durationSlots = Array.isArray(studentConfig.durationSlots) ? studentConfig.durationSlots : [];
      const currentDuration = getCurrentDurationForStudent(refreshedClassroom, studentId);
      const nextBaseDuration =
        this.toSafeNumber(dto.baseDuration, currentDuration.baseDuration) || currentDuration.baseDuration;
      const nextSessionDuration =
        this.toSafeNumber(dto.sessionDuration, currentDuration.sessionDuration) || currentDuration.sessionDuration;

      if (
        nextBaseDuration !== currentDuration.baseDuration
        || nextSessionDuration !== currentDuration.sessionDuration
      ) {
        if (durationSlots.length >= 3) {
          throw new BadRequestException('Da dat toi da 3 moc thoi luong cho hoc sinh nay');
        }

        const projectedTotalSessions = await this.buildProjectedStudentTotalSessionsMap(
          refreshedClassroom,
          [studentId],
          new Map([[studentId, nextSessionDuration]]),
        );

        updateQuery.$push = updateQuery.$push || {};
        updateQuery.$push['studentConfigs.$[studentConfig].durationSlots'] = {
          slotIndex: durationSlots.length + 1,
          slotType: StudentConfigSlotType.UPDATE,
          effectiveAt: new Date(),
          effectiveBy: actorId ? new Types.ObjectId(actorId) : undefined,
          baseDuration: nextBaseDuration,
          sessionDuration: nextSessionDuration,
          totalSessions: this.floorSessionCount(
            projectedTotalSessions.get(studentId) || currentDuration.totalSessions,
          ),
        };
        hasChanges = true;
      }
    }

    if (!hasChanges) {
      throw new BadRequestException('Khong co thay doi nao de luu');
    }

    await this.classModel.updateOne(
      { _id: new Types.ObjectId(classId) },
      updateQuery,
      { arrayFilters },
    );

    this.triggerStudentSupportSnapshotRefreshForClass(classId, 'updateStudentConfig');
    return this.findByIdPopulated(classId);
  }

  private async prepareClassUpdate(
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
    const dtoWithoutMeta = this.stripUpdateMetaFields(dto);
    const existingStudentIds = ((existing as any).students || [])
      .map((studentId: any) => studentId?.toString?.())
      .filter((studentId: string | undefined): studentId is string => !!studentId);

    const update: Record<string, unknown> = {};
    if (dtoWithoutMeta.name) update.name = dtoWithoutMeta.name;
    if (dtoWithoutMeta.code) {
      await this.ensureCodeUnique(dtoWithoutMeta.code, id);
      update.code = dtoWithoutMeta.code.toUpperCase();
    }

    const members = await this.buildPayload(dtoWithoutMeta, true);
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
      const referenceDuration = this.toSafeNumber(
        update.baseDuration,
        this.toSafeNumber(
          currentSnapshot.referenceDuration,
          this.toSafeNumber((existing as any).baseDuration, 60),
        ),
      ) || 60;
      const sessionDuration = this.toSafeNumber(
        update.sessionDuration,
        this.toSafeNumber(
          currentSnapshot.sessionDuration,
          this.toSafeNumber((existing as any).sessionDuration, referenceDuration),
        ),
      ) || referenceDuration;
      const pricePerSession = this.toSafeNumber(
        update.pricePerSession,
        this.toSafeNumber(
          currentSnapshot.pricePerSession,
          this.toSafeNumber((existing as any).pricePerSession, 0),
        ),
      );
      const teacherPayPerSession = this.toSafeNumber(
        update.teacherPayPerSession,
        this.toSafeNumber(
          currentSnapshot.teacherPayPerSession,
          this.toSafeNumber((existing as any).teacherPayPerSession, 0),
        ),
      );
      const teacherPayPerStudent = this.toSafeNumber(
        update.teacherPayPerStudent,
        this.toSafeNumber(
          currentSnapshot.teacherPayPerStudent,
          this.toSafeNumber((existing as any).teacherPayPerStudent, 0),
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
      durationSnapshotData = this.buildDurationSnapshotData({
        ...existing,
        ...update,
        pricingSnapshot: update.pricingSnapshot,
      });
    }

    return { existingStudentIds, update, durationSnapshotData };
  }

  private async applyPreparedClassUpdate(
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
        await this.syncTeacherSlotsOnClass(id, teacherId, options?.effectiveById);
      }
    }

    if (prepared.durationSnapshotData) {
      await this.syncDurationSlotsOnClass(id, options?.effectiveById);
    }

    if (Object.prototype.hasOwnProperty.call(prepared.update, 'students')) {
      await this.syncStudentConfigsOnClass(id, options?.effectiveById);
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

  private toSafeNumber(value: unknown, fallback = 0): number {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  private pickFirstPositiveNumber(...values: unknown[]): number {
    for (const value of values) {
      const normalized = Number(value);
      if (Number.isFinite(normalized) && normalized > 0) {
        return normalized;
      }
    }
    return 0;
  }

  private roundMoneyDownToThousand(value: number): number {
    if (!Number.isFinite(value) || value <= 0) return 0;
    return Math.floor(value / 1000) * 1000;
  }

  private getOrderItemForInvoice(order: any | null, invoice: any | null): any | null {
    if (!order || !Array.isArray(order.items) || !order.items.length || !invoice) {
      return null;
    }

    const itemIndex = Number(invoice.orderItemIndex);
    if (Number.isInteger(itemIndex) && itemIndex >= 0 && itemIndex < order.items.length) {
      return order.items[itemIndex] || null;
    }

    const invoiceNumber = String(invoice.invoiceNumber || '').trim().toUpperCase();
    if (invoiceNumber) {
      const matchedByNumber = order.items.find(
        (item: any) => String(item?.invoiceNumber || '').trim().toUpperCase() === invoiceNumber,
      );
      if (matchedByNumber) {
        return matchedByNumber;
      }
    }

    const productId = this.objectIdToString(invoice.productId);
    if (productId) {
      const matchedByProduct = order.items.filter(
        (item: any) => this.objectIdToString(item?.productId) === productId,
      );
      if (matchedByProduct.length === 1) {
        return matchedByProduct[0];
      }
    }

    return order.items[0] || null;
  }

  private buildInvoicePricingContext(invoice: any | null, orderItem?: any | null): any | null {
    if (!invoice) {
      return null;
    }

    const orderItemPricePerSession = this.roundMoneyToThousand(
      this.toSafeNumber(orderItem?.pricePerSession, 0),
    );
    const orderItemReferenceDuration = this.pickFirstPositiveNumber(
      orderItem?.baseDuration,
      orderItem?.sessionDuration,
    );
    const orderItemTeacherPayPerSession = this.roundMoneyDownToThousand(
      this.toSafeNumber(orderItem?.teacherPayPerSession, 0),
    );
    const orderItemTeacherPayPerStudent = this.roundMoneyDownToThousand(
      this.toSafeNumber(orderItem?.teacherPayPerStudent, 0),
    );

    return {
      ...invoice,
      pricePerSession: this.roundMoneyToThousand(
        this.pickFirstPositiveNumber(invoice?.pricePerSession, orderItemPricePerSession),
      ),
      referenceDuration:
        this.pickFirstPositiveNumber(
          invoice?.referenceDuration,
          orderItemReferenceDuration,
          60,
        ) || 60,
      teacherPayPerSession: this.roundMoneyDownToThousand(
        this.pickFirstPositiveNumber(
          invoice?.teacherPayPerSession,
          orderItemTeacherPayPerSession,
        ),
      ),
      teacherPayPerStudent: this.roundMoneyDownToThousand(
        this.pickFirstPositiveNumber(
          (invoice as any)?.teacherPayPerStudent,
          orderItemTeacherPayPerStudent,
        ),
      ),
    };
  }

  private async hydrateInvoicePricingContext(invoice: any | null): Promise<any | null> {
    if (!invoice) {
      return null;
    }

    const orderId = this.objectIdToString(invoice.orderId);
    if (!orderId || !Types.ObjectId.isValid(orderId)) {
      return this.buildInvoicePricingContext(invoice, null);
    }

    const order = await this.orderModel
      .findById(orderId)
      .select('items')
      .lean();

    return this.buildInvoicePricingContext(
      invoice,
      this.getOrderItemForInvoice(order, invoice),
    );
  }

  private resolveCurrentClassPricingState(classroom: any, sourceInvoice?: any | null): {
    baseDuration: number;
    sessionDuration: number;
    pricePerSession: number;
    teacherPayPerSession: number;
    teacherPayPerStudent: number;
  } {
    const classPricing = getClassPricingConfigAt(classroom);
    const pricingSnapshot = classroom?.pricingSnapshot || {};
    const baseDuration = this.pickFirstPositiveNumber(
      classroom?.baseDuration,
      classPricing.baseDuration,
      pricingSnapshot.referenceDuration,
      sourceInvoice?.referenceDuration,
      60,
    ) || 60;
    const sessionDuration = this.pickFirstPositiveNumber(
      classroom?.sessionDuration,
      classPricing.sessionDuration,
      pricingSnapshot.sessionDuration,
      baseDuration,
    ) || baseDuration;
    const pricePerSession = this.roundMoneyToThousand(this.pickFirstPositiveNumber(
      classroom?.pricePerSession,
      classPricing.pricePerSession,
      pricingSnapshot.pricePerSession,
      sourceInvoice?.pricePerSession,
      classroom?.revenuePerStudent,
    ));
    const teacherPayPerSession = this.roundMoneyDownToThousand(this.pickFirstPositiveNumber(
      classroom?.teacherPayPerSession,
      classPricing.teacherPayPerSession,
      pricingSnapshot.teacherPayPerSession,
      sourceInvoice?.teacherPayPerSession,
      classroom?.teacherSalaryCost,
    ));
    const teacherPayPerStudent = this.roundMoneyDownToThousand(this.pickFirstPositiveNumber(
      classroom?.teacherPayPerStudent,
      classPricing.teacherPayPerStudent,
      pricingSnapshot.teacherPayPerStudent,
      sourceInvoice?.teacherPayPerStudent,
    ));

    return {
      baseDuration,
      sessionDuration,
      pricePerSession,
      teacherPayPerSession,
      teacherPayPerStudent,
    };
  }

  private buildClassFinancialSummary(classroom: any, sourceInvoice?: any | null): {
    actualPricePerSession: number;
    actualTeacherPayPerSession: number;
    totalRevenue: number;
    totalCost: number;
    profit: number;
    studentCount: number;
  } {
    const studentCount = classroom.students?.length || 0;
    const currentPricing = this.resolveCurrentClassPricingState(classroom, sourceInvoice);
    const baseDur = currentPricing.baseDuration;
    const sessDur = currentPricing.sessionDuration;
    const ratio = sessDur / baseDur;
    const actualPricePerSession = this.roundMoneyToThousand(currentPricing.pricePerSession * ratio);
    const actualTeacherPayPerSession = this.roundMoneyDownToThousand(
      currentPricing.teacherPayPerSession * ratio,
    );
    const isOffline = classroom.classMode === 'OFFLINE';
    const totalRevenue = actualPricePerSession * studentCount;
    const totalCost = isOffline
      ? this.roundMoneyDownToThousand(currentPricing.teacherPayPerStudent * studentCount)
      : actualTeacherPayPerSession;
    const profit = totalRevenue - totalCost;

    return {
      actualPricePerSession,
      actualTeacherPayPerSession,
      totalRevenue,
      totalCost,
      profit,
      studentCount,
    };
  }

  private async buildClassSourceInvoiceMap(classrooms: any[]): Promise<Map<string, any>> {
    const invoiceIds = Array.from(
      new Set(
        classrooms
          .flatMap((classroom) => [
            this.objectIdToString(classroom?.invoiceId),
            this.objectIdToString(classroom?.pricingSnapshot?.sourceInvoiceId),
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
          .map((invoice: any) => this.objectIdToString(invoice?.orderId))
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
        const order = orderMap.get(this.objectIdToString(invoice?.orderId) || '');
        return [
          invoice._id.toString(),
          this.buildInvoicePricingContext(
            invoice,
            this.getOrderItemForInvoice(order, invoice),
          ),
        ];
      }),
    );
  }

  private getClassSourceInvoice(classroom: any, invoiceMap: Map<string, any>): any | null {
    const linkedInvoiceIds = [
      this.objectIdToString(classroom?.invoiceId),
      this.objectIdToString(classroom?.pricingSnapshot?.sourceInvoiceId),
    ].filter((invoiceId): invoiceId is string => !!invoiceId);

    for (const invoiceId of linkedInvoiceIds) {
      const invoice = invoiceMap.get(invoiceId);
      if (invoice) {
        return invoice;
      }
    }

    return null;
  }

  private decorateClassroomForDisplay(classroom: any, sourceInvoice?: any | null) {
    const resolvedPricing = this.resolveCurrentClassPricingState(classroom, sourceInvoice);
    return {
      ...classroom,
      ...resolvedPricing,
      ...this.buildClassFinancialSummary(
        {
          ...classroom,
          ...resolvedPricing,
        },
        sourceInvoice,
      ),
    };
  }

  /**
   * If class is created from an approved invoice and pricing fields are not provided,
   * seed class pricing from invoice snapshot to keep sale quote consistent.
   */
  private applyInvoicePricingDefaults(payload: Record<string, unknown>, invoice: any | null): void {
    if (!invoice) return;

    const invoiceReferenceDuration = this.toSafeNumber(invoice.referenceDuration, 60);
    const invoicePricePerSession = this.roundMoneyToThousand(
      this.toSafeNumber(invoice.pricePerSession, 0),
    );

    if (payload.baseDuration === undefined && invoiceReferenceDuration > 0) {
      payload.baseDuration = invoiceReferenceDuration;
    }

    if (payload.pricePerSession === undefined && invoicePricePerSession > 0) {
      payload.pricePerSession = invoicePricePerSession;
    }

    const invoiceTeacherPayPerSession = this.roundMoneyDownToThousand(
      this.toSafeNumber(invoice.teacherPayPerSession, 0),
    );
    if (payload.teacherPayPerSession === undefined && invoiceTeacherPayPerSession > 0) {
      payload.teacherPayPerSession = invoiceTeacherPayPerSession;
    }

    const invoiceTeacherPayPerStudent = this.roundMoneyDownToThousand(
      this.toSafeNumber(invoice.teacherPayPerStudent, 0),
    );
    if (payload.teacherPayPerStudent === undefined && invoiceTeacherPayPerStudent > 0) {
      payload.teacherPayPerStudent = invoiceTeacherPayPerStudent;
    }
  }

  /**
   * Freeze pricing snapshot at class creation.
   * This snapshot is later used by session charging to avoid pricing drift.
   */
  private attachPricingSnapshot(payload: Record<string, unknown>, invoice: any | null): void {
    const referenceDuration = this.toSafeNumber(payload.baseDuration, 60) || 60;
    const sessionDuration =
      this.toSafeNumber(payload.sessionDuration, referenceDuration) || referenceDuration;
    const pricePerSession = this.roundMoneyToThousand(this.toSafeNumber(payload.pricePerSession, 0));
    const teacherPayPerSession = this.roundMoneyDownToThousand(
      this.toSafeNumber(payload.teacherPayPerSession, 0),
    );
    const teacherPayPerStudent = this.roundMoneyDownToThousand(
      this.toSafeNumber(payload.teacherPayPerStudent, 0),
    );

    let perMinuteRate = this.toSafeNumber(invoice?.perMinuteRate, 0);
    if (perMinuteRate <= 0 && pricePerSession > 0 && referenceDuration > 0) {
      perMinuteRate = pricePerSession / referenceDuration;
    }

    payload.pricingSnapshot = {
      source: invoice ? PricingSnapshotSource.INVOICE : PricingSnapshotSource.MANUAL,
      capturedAt: new Date(),
      sourceInvoiceId: invoice?._id ? new Types.ObjectId(invoice._id) : undefined,
      sourceInvoiceNumber: invoice?.invoiceNumber,
      referenceDuration,
      sessionDuration,
      pricePerSession,
      perMinuteRate,
      teacherPayPerSession,
      teacherPayPerStudent,
    };
  }

  private async ensureCodeUnique(code: string, excludeId?: string) {
    const existing = await this.classModel
      .findOne({ code: code.toUpperCase(), ...(excludeId ? { _id: { $ne: excludeId } } : {}) })
      .lean();
    if (existing) throw new ConflictException('Class code already exists');
  }

  private async buildPayload(
    dto: Partial<CreateClassDto>,
    allowPartial = false,
  ): Promise<Record<string, unknown>> {
    const payload: Record<string, unknown> = {};

    if (!allowPartial || dto.teacherId) {
      const teacherId = dto.teacherId ?? null;
      if (!teacherId) throw new BadRequestException('Teacher is required');
      payload.teacher = await this.validateUserRole(teacherId, Role.TEACHER);
    }

    // Sale is optional now (OPS/Director may not assign a Sale)
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

    if (!allowPartial || dto.name) payload.name = dto.name;
    if (!allowPartial || dto.code) payload.code = dto.code?.toUpperCase();
    
    // Per-session pricing (new model)
    if (dto.pricePerSession !== undefined) {
      payload.pricePerSession = this.roundMoneyToThousand(Number(dto.pricePerSession || 0));
    }
    if (dto.teacherPayPerSession !== undefined) {
      payload.teacherPayPerSession = this.roundMoneyDownToThousand(
        Number(dto.teacherPayPerSession || 0),
      );
    }
    if (dto.teacherPayPerStudent !== undefined) {
      payload.teacherPayPerStudent = this.roundMoneyDownToThousand(
        Number(dto.teacherPayPerStudent || 0),
      );
    }
    if ((dto as any).baseDuration !== undefined) payload.baseDuration = (dto as any).baseDuration;
    if (dto.sessionDuration !== undefined) payload.sessionDuration = dto.sessionDuration;
    if ((dto as any).classMode !== undefined) payload.classMode = (dto as any).classMode;

    // Thông tin môn học
    if (dto.subject !== undefined) payload.subject = dto.subject;
    if (dto.grade !== undefined) payload.grade = dto.grade;
    if (dto.learningGoals !== undefined) payload.learningGoals = dto.learningGoals;

    // Chương trình học (curriculum)
    if (dto.curriculum !== undefined) payload.curriculum = dto.curriculum;

    // Legacy fields
    if (dto.revenuePerStudent !== undefined) {
      payload.revenuePerStudent = this.roundMoneyToThousand(Number(dto.revenuePerStudent || 0));
    }
    if (dto.teacherSalaryCost !== undefined) {
      payload.teacherSalaryCost = this.roundMoneyDownToThousand(
        Number(dto.teacherSalaryCost || 0),
      );
    }

    return payload;
  }

  private async validateUserRole(userId: string, role: Role): Promise<Types.ObjectId> {
    const user = await this.userModel.findById(userId).lean();
    if (!user || user.role !== role) {
      throw new BadRequestException(`Selected ${role.toLowerCase()} is invalid`);
    }
    return new Types.ObjectId(userId);
  }

  private async validateStudents(studentIds: string[]): Promise<Types.ObjectId[]> {
    if (!studentIds?.length) return [];
    const found = await this.studentModel.find({ _id: { $in: studentIds } }, '_id').lean();
    if (found.length !== studentIds.length) {
      throw new BadRequestException('Một số học viên không hợp lệ');
    }
    return studentIds.map((id) => new Types.ObjectId(id));
  }
  private async validateProductPackage(productPackageId: string): Promise<Types.ObjectId> {
    const product = await this.productModel.findById(productPackageId).lean();
    if (!product) {
      throw new BadRequestException('Goi san pham khong hop le');
    }
    return new Types.ObjectId(productPackageId);
  }

  private async findByIdPopulated(id: string | Types.ObjectId) {
    const classroom = await this.classModel
      .findById(id)
      .populate('teacher', 'fullName email role')
      .populate('sale', 'fullName email role')
      .populate('pendingSaleUpdate.requestedBy', 'fullName email role')
      .populate('pendingSaleUpdate.reviewedBy', 'fullName email role')
      .populate('productPackage', 'name code teachingMode pricePerSession suggestedPrice')
      .populate('students', 'fullName age parentName studentCode')
      .populate('studentConfigs.studentId', 'fullName studentCode')
      .populate('studentConfigs.teacherSlots.teacherId', 'fullName email role userCode')
      .populate('studentConfigs.teacherSlots.assignedBy', 'fullName email role')
      .populate('studentConfigs.durationSlots.effectiveBy', 'fullName email role')
      .populate('durationSnapshots.effectiveBy', 'fullName email role')
      .lean();

    if (classroom) {
      const projectedClassroom = await this.withProjectedStudentTotals(classroom);
      const sourceInvoiceMap = await this.buildClassSourceInvoiceMap([projectedClassroom]);
      const decoratedClassroom = this.decorateClassroomForDisplay(
        projectedClassroom,
        this.getClassSourceInvoice(projectedClassroom, sourceInvoiceMap),
      );

      // Tinh tien do chuong trinh hoc
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

  // ──────────────────────────────────────────────────────────────────
  //  CURRICULUM MANAGEMENT
  // ──────────────────────────────────────────────────────────────────

  /** Cập nhật toàn bộ chương trình học */
  async updateCurriculum(classId: string, curriculum: any[], actor?: JwtPayload) {
    const classroom = await this.classModel.findById(classId);
    if (!classroom) throw new NotFoundException('Lớp học không tồn tại');
    await this.assertClassAccess(classroom, actor);
    (classroom as any).curriculum = curriculum;
    await classroom.save();
    this.triggerStudentSupportSnapshotRefreshForClass(classId, 'updateCurriculum');
    return this.findByIdPopulated(classId);
  }

  /** Đánh dấu một mục chương trình đã hoàn thành */
  async markCurriculumItemCompleted(
    classId: string,
    itemId: string,
    sessionId?: string,
    actor?: JwtPayload,
  ) {
    const classroom = await this.classModel.findById(classId);
    if (!classroom) throw new NotFoundException('Lớp học không tồn tại');
    await this.assertClassAccess(classroom, actor);

    const curriculum = (classroom as any).curriculum || [];
    const item = curriculum.find((ci: any) => ci._id?.toString() === itemId);
    if (!item) throw new NotFoundException('Mục chương trình không tồn tại');

    item.isCompleted = true;
    item.completedAt = new Date();
    if (sessionId) {
      item.completedInSessionId = new Types.ObjectId(sessionId);
    }

    (classroom as any).curriculum = curriculum;
    await classroom.save();
    this.triggerStudentSupportSnapshotRefreshForClass(classId, 'markCurriculumItemCompleted');
    return this.findByIdPopulated(classId);
  }

  // ──────────────────────────────────────────────────────────────────
  //  SUBSTITUTE TEACHER MANAGEMENT
  // ──────────────────────────────────────────────────────────────────

  /** Thêm GV dạy thay vào lớp (gọi từ tickets.service khi duyệt ticket) */
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

    // Validate substitute teacher exists and is TEACHER role
    await this.validateUserRole(data.teacherId, Role.TEACHER);

    // Check no overlap for same substitute teacher in this class
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

  /** Xóa GV dạy thay (trả lại quyền cho GV chính) */
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

  /** Lấy GV dạy thay đang active cho lớp tại ngày cụ thể */
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

  /** Lấy tiến độ chương trình học */
  async getCurriculumProgress(classId: string, actor?: JwtPayload) {
    const classroom = await this.classModel.findById(classId).lean();
    if (!classroom) throw new NotFoundException('Lớp học không tồn tại');
    await this.assertClassAccess(classroom, actor);

    const curriculum = (classroom as any).curriculum || [];
    const totalItems = curriculum.length;
    const completedItems = curriculum.filter((item: any) => item.isCompleted).length;

    return {
      classId,
      classCode: classroom.code,
      className: classroom.name,
      subject: (classroom as any).subject,
      grade: (classroom as any).grade,
      learningGoals: (classroom as any).learningGoals,
      curriculum,
      totalItems,
      completedItems,
      progressPercent: totalItems > 0
        ? Math.round((completedItems / totalItems) * 100)
        : 0,
    };
  }

  // ════════════════════════════════════════════════════════════════════
  // TEACHER MATCHING (Phase 2.5)
  // ════════════════════════════════════════════════════════════════════

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

    // Score each teacher
    const scored: any[] = [];
    for (const profile of profiles) {
      let score = 50; // base score
      const reasons: string[] = [];

      // Subject match
      if (params.subject && (profile as any).subjects?.includes(params.subject)) {
        score += 20;
        reasons.push('Đúng môn dạy');
      }
      // Grade match
      if (params.grade && (profile as any).grades?.includes(params.grade)) {
        score += 15;
        reasons.push('Đúng khối lớp');
      }
      // Teaching mode match
      if (params.teachingMode && (profile as any).teachingMode === params.teachingMode) {
        score += 10;
        reasons.push('Đúng hình thức dạy');
      }

      // Workload (fewer active classes = higher score)
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

      // Rating bonus
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

    // Sort by score descending, return top 5
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, 5);
  }
}
