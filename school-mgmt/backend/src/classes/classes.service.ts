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
  ClassDocument,
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
import { StudentSupportSnapshotService } from '../messages/student-support-snapshot.service';
import { Session, SessionDocument, SessionStatus } from '../sessions/schemas/session.schema';
import {
  getCurrentTeacherIdForStudent,
  getCurrentDurationForStudent,
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
      'pricePerSession',
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
      ? (
        approvalChanges.baseDuration !== undefined || approvalChanges.sessionDuration !== undefined
          ? PendingClassUpdateType.DURATION_CHANGE
          : PendingClassUpdateType.GENERAL
      )
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
    const snapshot = classState?.pricingSnapshot || {};
    const baseDuration =
      this.toSafeNumber(snapshot.referenceDuration, this.toSafeNumber(classState?.baseDuration, 60)) || 60;
    const sessionDuration =
      this.toSafeNumber(snapshot.sessionDuration, this.toSafeNumber(classState?.sessionDuration, baseDuration))
      || baseDuration;

    return {
      baseDuration,
      sessionDuration,
      pricePerSession: this.toSafeNumber(
        snapshot.pricePerSession,
        this.toSafeNumber(classState?.pricePerSession, 0),
      ),
      teacherPayPerSession: this.toSafeNumber(
        snapshot.teacherPayPerSession,
        this.toSafeNumber(classState?.teacherPayPerSession, 0),
      ),
      teacherPayPerStudent: this.toSafeNumber(
        snapshot.teacherPayPerStudent,
        this.toSafeNumber(classState?.teacherPayPerStudent, 0),
      ),
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

  private roundTo2(value: number): number {
    return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
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
          totalSessions: this.roundTo2(totalSessions),
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
    if (!studentIds.length || !classroom?._id) {
      return remainingMinutesMap;
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
      .select('studentId referenceDuration sessionsRemaining bonusSessionsRemaining')
      .lean();

    for (const invoice of invoices) {
      const studentId = (invoice as any)?.studentId?.toString?.();
      if (!studentId) {
        continue;
      }

      const referenceDuration =
        this.toSafeNumber((invoice as any)?.referenceDuration, fallbackReferenceDuration) || fallbackReferenceDuration;
      const remainingUnits =
        this.toSafeNumber((invoice as any)?.sessionsRemaining, 0)
        + this.toSafeNumber((invoice as any)?.bonusSessionsRemaining, 0);
      const currentMinutes = remainingMinutesMap.get(studentId) || 0;
      remainingMinutesMap.set(studentId, currentMinutes + (remainingUnits * referenceDuration));
    }

    return remainingMinutesMap;
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
      const projectedTotal = completedSessions + (sessionDuration > 0 ? remainingMinutes / sessionDuration : 0);
      const fallbackTotal =
        this.toSafeNumber(currentDuration.totalSessions, this.toSafeNumber((classroom as any)?.totalSessions, 0));

      totalSessionsMap.set(
        studentId,
        projectedTotal > 0 ? this.roundTo2(projectedTotal) : this.roundTo2(fallbackTotal),
      );
    }

    return totalSessionsMap;
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

  private async validateTeacherForClassSale(classroom: any, teacherId: string): Promise<Types.ObjectId> {
    const validatedTeacherId = await this.validateUserRole(teacherId, Role.TEACHER);
    const saleId = classroom?.sale?.toString?.();
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
      .populate('productPackage', 'name code teachingMode pricePerSession suggestedPrice')
      .populate('students', 'fullName age parentName studentCode')
      .populate('studentConfigs.studentId', 'fullName studentCode')
      .populate('studentConfigs.teacherSlots.teacherId', 'fullName email role userCode')
      .lean();

    const mapped = classrooms.map((classroom) => ({
      ...classroom,
      ...this.buildClassFinancialSummary(classroom),
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
        await this.applyPreparedClassUpdate(id, directPrepared, 'saleDirectUpdateClass', {
          durationSnapshotSource: directPrepared.durationSnapshotData
            ? DurationSnapshotSource.MANAGER_DIRECT
            : undefined,
          requestType: this.resolveRequestedUpdateType(directChanges),
          effectiveById: actorId,
        });
      }

      if (hasApprovalChanges) {
        const persistedRequestedChanges = this.stripUpdateMetaFields(approvalChanges as UpdateClassDto);
        await this.classModel.findByIdAndUpdate(id, {
          $set: {
            pendingSaleUpdate: {
              status: ClassUpdateRequestStatus.PENDING,
              requestType,
              requestedChanges: persistedRequestedChanges,
              requestedBy: new Types.ObjectId(actorId),
              requestedAt: new Date(),
              reviewedBy: null,
              reviewedAt: null,
              rejectionReason: null,
            },
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
    await this.applyPreparedClassUpdate(id, prepared, 'updateClass', {
      clearPendingSaleUpdate: true,
      durationSnapshotSource: prepared.durationSnapshotData
        ? DurationSnapshotSource.MANAGER_DIRECT
        : undefined,
      requestType: this.resolveRequestedUpdateType(dto),
      effectiveById: actorId,
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

    await this.classModel.findByIdAndUpdate(id, {
      $set: {
        'pendingSaleUpdate.status': ClassUpdateRequestStatus.REJECTED,
        'pendingSaleUpdate.reviewedBy': new Types.ObjectId(actorId),
        'pendingSaleUpdate.reviewedAt': new Date(),
        'pendingSaleUpdate.rejectionReason': reason?.trim() || 'Khong dat yeu cau',
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
          totalSessions: this.roundTo2(projectedTotalSessions.get(studentId) || currentDuration.totalSessions),
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

    if (Object.keys(updateQuery).length) {
      await this.classModel.findByIdAndUpdate(id, updateQuery, { new: true }).lean();
    }

    if (Object.prototype.hasOwnProperty.call(prepared.update, 'teacher')) {
      const teacherId = (prepared.update.teacher as Types.ObjectId | undefined)?.toString?.();
      if (teacherId) {
        await this.syncTeacherSlotsOnClass(id, teacherId, options?.effectiveById);
      }
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

  private buildClassFinancialSummary(classroom: any): {
    actualPricePerSession: number;
    actualTeacherPayPerSession: number;
    totalRevenue: number;
    totalCost: number;
    profit: number;
    studentCount: number;
  } {
    const studentCount = classroom.students?.length || 0;
    const snapshot = classroom?.pricingSnapshot || {};
    const baseDur =
      this.toSafeNumber(snapshot.referenceDuration, this.toSafeNumber(classroom.baseDuration, 60)) || 60;
    const sessDur =
      this.toSafeNumber(snapshot.sessionDuration, this.toSafeNumber(classroom.sessionDuration, baseDur)) || baseDur;
    const ratio = sessDur / baseDur;
    const snapshotPrice = this.toSafeNumber(
      snapshot.pricePerSession,
      this.toSafeNumber(classroom.pricePerSession, this.toSafeNumber(classroom.revenuePerStudent, 0)),
    );
    const snapshotTeacherPay = this.toSafeNumber(
      snapshot.teacherPayPerSession,
      this.toSafeNumber(classroom.teacherPayPerSession, this.toSafeNumber(classroom.teacherSalaryCost, 0)),
    );
    const snapshotTeacherPayPerStudent = this.toSafeNumber(
      snapshot.teacherPayPerStudent,
      this.toSafeNumber(classroom.teacherPayPerStudent, 0),
    );

    const actualPricePerSession = Math.round(snapshotPrice * ratio);
    const actualTeacherPayPerSession = Math.round(snapshotTeacherPay * ratio);
    const isOffline = classroom.classMode === 'OFFLINE';
    const totalRevenue = actualPricePerSession * studentCount;
    const totalCost = isOffline
      ? Math.round(snapshotTeacherPayPerStudent * studentCount)
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

  /**
   * If class is created from an approved invoice and pricing fields are not provided,
   * seed class pricing from invoice snapshot to keep sale quote consistent.
   */
  private applyInvoicePricingDefaults(payload: Record<string, unknown>, invoice: any | null): void {
    if (!invoice) return;

    const invoiceReferenceDuration = this.toSafeNumber(invoice.referenceDuration, 60);
    const invoicePricePerSession = this.toSafeNumber(invoice.pricePerSession, 0);

    if (payload.baseDuration === undefined && invoiceReferenceDuration > 0) {
      payload.baseDuration = invoiceReferenceDuration;
    }

    if (payload.pricePerSession === undefined && invoicePricePerSession > 0) {
      payload.pricePerSession = invoicePricePerSession;
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
    const pricePerSession = this.toSafeNumber(payload.pricePerSession, 0);
    const teacherPayPerSession = this.toSafeNumber(payload.teacherPayPerSession, 0);
    const teacherPayPerStudent = this.toSafeNumber(payload.teacherPayPerStudent, 0);

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
    if (dto.pricePerSession !== undefined) payload.pricePerSession = dto.pricePerSession;
    if (dto.teacherPayPerSession !== undefined) payload.teacherPayPerSession = dto.teacherPayPerSession;
    if (dto.teacherPayPerStudent !== undefined) payload.teacherPayPerStudent = dto.teacherPayPerStudent;
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
    if (dto.revenuePerStudent !== undefined) payload.revenuePerStudent = dto.revenuePerStudent;
    if (dto.teacherSalaryCost !== undefined) payload.teacherSalaryCost = dto.teacherSalaryCost;

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
      .populate('productPackage', 'name code teachingMode pricePerSession suggestedPrice')
      .populate('students', 'fullName age parentName')
      .populate('studentConfigs.studentId', 'fullName studentCode')
      .populate('studentConfigs.teacherSlots.teacherId', 'fullName email role userCode')
      .populate('studentConfigs.teacherSlots.assignedBy', 'fullName email role')
      .populate('studentConfigs.durationSlots.effectiveBy', 'fullName email role')
      .lean();

    if (classroom) {
      const financialSummary = this.buildClassFinancialSummary(classroom);

      // Tinh tien do chuong trinh hoc
      const curriculum = (classroom as any).curriculum || [];
      const totalItems = curriculum.length;
      const completedItems = curriculum.filter((item: any) => item.isCompleted).length;
      const curriculumProgress = totalItems > 0
        ? Math.round((completedItems / totalItems) * 100)
        : 0;

      return {
        ...classroom,
        ...financialSummary,
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
