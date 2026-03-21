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
  PricingSnapshotSource,
} from './schemas/class.schema';
import { CreateClassDto } from './dto/create-class.dto';
import { UpdateClassDto } from './dto/update-class.dto';
import { AssignStudentsDto } from './dto/assign-students.dto';
import { User, UserDocument } from '../users/schemas/user.schema';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { Student, StudentDocument } from '../students/schemas/student.schema';
import { Invoice, InvoiceDocument, InvoiceStatus } from '../invoices/schemas/invoice.schema';
import { TeacherProfile } from '../teachers/schemas/teacher-profile.schema';
import { Role } from '../common/interfaces/role.enum';
import { StudentSupportSnapshotService } from '../messages/student-support-snapshot.service';

@Injectable()
export class ClassesService {
  private readonly logger = new Logger(ClassesService.name);

  constructor(
    @InjectModel(Classroom.name) private readonly classModel: Model<ClassDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Student.name) private readonly studentModel: Model<StudentDocument>,
    @InjectModel(Invoice.name) private readonly invoiceModel: Model<InvoiceDocument>,
    @InjectModel(TeacherProfile.name) private readonly teacherProfileModel: Model<any>,
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

    this.triggerStudentSupportSnapshotRefreshForClass(created._id.toString(), 'createClass');
    return this.findByIdPopulated(created._id);
  }

  async findOne(id: string, actor?: JwtPayload) {
    const classroom = await this.classModel
      .findById(id)
      .select('teacher sale students substituteTeachers')
      .lean();
    if (!classroom) throw new NotFoundException('Lop hoc khong ton tai');
    await this.assertClassAccess(classroom, actor);
    const detailedClass = await this.findByIdPopulated(id);
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
      .populate('students', 'fullName age parentName studentCode')
      .lean();

    const mapped = classrooms.map((classroom) => ({
      ...classroom,
      ...this.buildClassFinancialSummary(classroom),
    }));

    if (actor.role !== Role.PARENT || !parentStudentIdSet) {
      return mapped;
    }

    return mapped.map((classroom) =>
      this.filterClassStudentsByIds(classroom, parentStudentIdSet!),
    );
  }

  async update(id: string, dto: UpdateClassDto) {
    const existing = await this.classModel.findById(id).lean();
    if (!existing) throw new NotFoundException('Class not found');
    const existingStudentIds = ((existing as any).students || []).map((studentId: any) =>
      studentId?.toString?.(),
    ).filter((studentId: string | undefined): studentId is string => !!studentId);

    const update: Record<string, unknown> = {};
    if (dto.name) update.name = dto.name;
    if (dto.code) {
      await this.ensureCodeUnique(dto.code, id);
      update.code = dto.code.toUpperCase();
    }
    const members = await this.buildPayload(dto, true);
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
    }

    await this.classModel.findByIdAndUpdate(id, update, { new: true }).lean();

    if (Object.prototype.hasOwnProperty.call(update, 'students')) {
      const updatedStudentIds = ((update.students as Types.ObjectId[]) || [])
        .map((studentId) => studentId?.toString?.())
        .filter((studentId: string | undefined): studentId is string => !!studentId);
      this.triggerStudentSupportSnapshotRefreshForStudentIds(
        [...new Set([...existingStudentIds, ...updatedStudentIds])],
        'updateClassStudents',
      );
    } else {
      this.triggerStudentSupportSnapshotRefreshForClass(id, 'updateClass');
    }

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

    this.triggerStudentSupportSnapshotRefreshForClass(id, 'assignStudentsBySale');
    return this.findByIdPopulated(id);
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
  private async findByIdPopulated(id: string | Types.ObjectId) {
    const classroom = await this.classModel
      .findById(id)
      .populate('teacher', 'fullName email role')
      .populate('sale', 'fullName email role')
      .populate('students', 'fullName age parentName')
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
