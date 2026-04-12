import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import {
  Session,
  SessionDocument,
  SessionStatus,
} from './schemas/session.schema';
import {
  SessionChangeRequest,
  SessionChangeRequestDocument,
  SessionChangeRequestStatus,
} from './schemas/session-change-request.schema';
import { Classroom, ClassDocument } from '../classes/schemas/class.schema';
import { Student, StudentDocument } from '../students/schemas/student.schema';
import { TeacherProfile, TeacherProfileDocument } from '../teachers/schemas/teacher-profile.schema';
import { User, UserDocument } from '../users/schemas/user.schema';

import { CreateSessionDto } from './dto/create-session.dto';
import { UpdateSessionDto } from './dto/update-session.dto';
import { QuerySessionDto } from './dto/query-session.dto';
import { CompleteSessionDto } from './dto/complete-session.dto';
import { ConfirmSessionDto } from './dto/confirm-session.dto';
import { CancelSessionDto } from './dto/cancel-session.dto';
import { RescheduleSessionDto } from './dto/reschedule-session.dto';
import { CreateSessionChangeRequestDto } from './dto/create-session-change-request.dto';
import { ReviewSessionChangeRequestDto } from './dto/review-session-change-request.dto';
import { BulkCreateSessionDto } from './dto/bulk-create-session.dto';
import { SubmitTeachingReportDto } from './dto/submit-teaching-report.dto';
import { BulkTeachingReportDto } from './dto/bulk-teaching-report.dto';
import { SessionTrialService } from './session-trial.service';
import { SessionWorkflowService } from './session-workflow.service';
import { SessionPayrollService } from './session-payroll.service';
import { SessionQueryService } from './session-query.service';
import { Role } from '../common/interfaces/role.enum';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { StudentSupportSnapshotService } from '../messages/student-support-snapshot.service';
import {
  getDurationForStudentAt,
  getClassPricingConfigAt,
  isTeacherAssignedToStudentAt,
} from '../classes/student-config.utils';

import {
  objectIdToString,
  toSafeNumber,
  roundMoneyToThousand,
  roundMoneyDownToThousand,
  extractErrorMessage,
  formatSessionHistoryValue,
  getSessionEditFieldLabel,
} from './helpers/session.utils';

@Injectable()
export class SessionsService {
  private readonly logger = new Logger(SessionsService.name);

  constructor(
    @InjectModel(Session.name) private sessionModel: Model<SessionDocument>,
    @InjectModel(SessionChangeRequest.name)
    private sessionChangeRequestModel: Model<SessionChangeRequestDocument>,
    @InjectModel(Classroom.name) private classModel: Model<ClassDocument>,
    @InjectModel(Student.name) private studentModel: Model<StudentDocument>,
    @InjectModel(TeacherProfile.name) private teacherProfileModel: Model<TeacherProfileDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private studentSupportSnapshotService: StudentSupportSnapshotService,
    private sessionTrialService: SessionTrialService,
    private sessionPayrollService: SessionPayrollService,
    private sessionQueryService: SessionQueryService,
    @Inject(forwardRef(() => SessionWorkflowService))
    private sessionWorkflowService: SessionWorkflowService,
  ) {}

  // ──────────────────────────────────────────────────────────────────
  //  PRIVATE HELPERS
  // ──────────────────────────────────────────────────────────────────

  private isTeacherAssignedToClassOnDate(
    classroom: any,
    teacherId: string,
    scheduledDate: Date,
    studentId?: string,
  ): boolean {
    if (studentId && isTeacherAssignedToStudentAt(classroom, studentId, teacherId, scheduledDate)) {
      return true;
    }

    if (!studentId && objectIdToString(classroom?.teacher) === teacherId) {
      return true;
    }

    const subs = (classroom?.substituteTeachers || []) as any[];
    const day = new Date(
      Date.UTC(
        scheduledDate.getUTCFullYear(),
        scheduledDate.getUTCMonth(),
        scheduledDate.getUTCDate(),
      ),
    );

    return subs.some((s) => {
      if (objectIdToString(s?.teacherId) !== teacherId) return false;
      const from = new Date(s.fromDate);
      const to = new Date(s.toDate);
      from.setUTCHours(0, 0, 0, 0);
      to.setUTCHours(23, 59, 59, 999);
      return day >= from && day <= to;
    });
  }

  private parseTimeToMinutes(value?: string | null): number | null {
    const safeValue = `${value || ''}`.trim();
    const match = /^(\d{1,2}):(\d{2})$/.exec(safeValue);
    if (!match) return null;

    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
    return (hours * 60) + minutes;
  }

  private calculateDurationMinutes(startTime?: string | null, endTime?: string | null): number | null {
    const startMinutes = this.parseTimeToMinutes(startTime);
    const endMinutes = this.parseTimeToMinutes(endTime);
    if (startMinutes === null || endMinutes === null || endMinutes <= startMinutes) {
      return null;
    }
    return endMinutes - startMinutes;
  }

  private formatDateOnly(value: Date | string): string {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '';
    }
    return date.toISOString().slice(0, 10);
  }

  private populateSessionChangeRequestQuery<TQuery extends { populate: (...args: any[]) => TQuery }>(
    query: TQuery,
  ): TQuery {
    return query
      .populate('sessionId', 'scheduledDate scheduledStartTime scheduledEndTime status durationMinutes')
      .populate('classId', 'name code')
      .populate('studentId', 'fullName studentCode')
      .populate('parentUserId', 'fullName email')
      .populate('currentTeacherId', 'fullName email')
      .populate('requestedTeacherId', 'fullName email')
      .populate('requestedBy', 'fullName email role')
      .populate('reviewedBy', 'fullName email role');
  }

  private async getPopulatedSessionChangeRequestById(id: string) {
    return this.populateSessionChangeRequestQuery(
      this.sessionChangeRequestModel.findById(id),
    ).lean();
  }

  private async resolveParentUserIdForSession(session: {
    parentUserId?: any;
    studentId: any;
  }): Promise<string | null> {
    const direct = objectIdToString(session.parentUserId);
    if (direct) return direct;

    const student = await this.studentModel
      .findById(session.studentId)
      .select('parentUserId')
      .lean();
    return objectIdToString((student as any)?.parentUserId);
  }

  private triggerStudentSupportSnapshotRefreshForSession(
    session: { parentUserId?: any; studentId?: any },
    reason: string,
  ) {
    void this.refreshStudentSupportSnapshotForSession(session, reason);
  }

  private async refreshStudentSupportSnapshotForSession(
    session: { parentUserId?: any; studentId?: any },
    reason: string,
  ): Promise<void> {
    const studentId = objectIdToString(session.studentId);
    if (!studentId) return;

    const parentUserId = await this.resolveParentUserIdForSession({
      parentUserId: session.parentUserId,
      studentId: session.studentId,
    });
    if (!parentUserId) return;

    try {
      await this.studentSupportSnapshotService.rebuild(parentUserId, studentId);
    } catch (err) {
      this.logger.warn(
        `[StudentSupportSnapshot] Failed to refresh for student ${studentId} (${reason}): ${extractErrorMessage(err)}`,
      );
    }
  }

  private async getUserDisplayNameMap(ids: string[]): Promise<Map<string, string>> {
    const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
    if (!uniqueIds.length) {
      return new Map();
    }

    const users = await this.userModel
      .find({ _id: { $in: uniqueIds.map((id) => new Types.ObjectId(id)) } })
      .select('fullName')
      .lean();

    return new Map(
      users
        .map((user: any) => [objectIdToString(user?._id), user?.fullName || 'Nguoi dung'] as const)
        .filter(([id]) => !!id) as Array<[string, string]>,
    );
  }

  private buildSessionEditHistoryEntry(params: {
    session: SessionDocument;
    dto: UpdateSessionDto;
    actor?: JwtPayload;
    teacherNameMap: Map<string, string>;
    durationSnapshot?: {
      newDurationMinutes: number;
      paidRemainingMinutes?: number;
      bonusRemainingMinutes?: number;
      totalRemainingMinutes?: number;
      paidSessionsRemaining?: number;
      bonusSessionsRemaining?: number;
      totalSessionsRemaining?: number;
    } | null;
  }) {
    const { session, dto, actor, teacherNameMap, durationSnapshot } = params;
    const changes: Array<{
      field: string;
      label: string;
      beforeValue: string;
      afterValue: string;
    }> = [];

    const registerChange = (
      field: string,
      beforeRaw: unknown,
      afterRaw: unknown,
    ) => {
      const beforeValue = formatSessionHistoryValue(field, beforeRaw, teacherNameMap);
      const afterValue = formatSessionHistoryValue(field, afterRaw, teacherNameMap);
      if (beforeValue === afterValue) {
        return;
      }

      changes.push({
        field,
        label: getSessionEditFieldLabel(field),
        beforeValue,
        afterValue,
      });
    };

    if (dto.teacherId !== undefined) {
      registerChange('teacherId', session.teacherId, dto.teacherId);
    }
    if (dto.scheduledDate !== undefined) {
      registerChange('scheduledDate', session.scheduledDate, dto.scheduledDate);
    }
    if (dto.scheduledStartTime !== undefined) {
      registerChange('scheduledStartTime', session.scheduledStartTime, dto.scheduledStartTime);
    }
    if (dto.scheduledEndTime !== undefined) {
      registerChange('scheduledEndTime', session.scheduledEndTime, dto.scheduledEndTime);
    }
    if (dto.durationMinutes !== undefined) {
      registerChange('durationMinutes', session.durationMinutes, dto.durationMinutes);
    }
    if (dto.sessionType !== undefined) {
      registerChange('sessionType', session.sessionType, dto.sessionType);
    }
    if (dto.topicsCovered !== undefined) {
      registerChange('topicsCovered', session.topicsCovered, dto.topicsCovered);
    }
    if (dto.homework !== undefined) {
      registerChange('homework', session.homework, dto.homework);
    }
    if (dto.teacherNotes !== undefined) {
      registerChange('teacherNotes', session.teacherNotes, dto.teacherNotes);
    }
    if (dto.amountCharged !== undefined) {
      registerChange('amountCharged', session.amountCharged, dto.amountCharged);
    }
    if (dto.teacherPayout !== undefined) {
      registerChange('teacherPayout', session.teacherPayout, dto.teacherPayout);
    }
    if (dto.autoConfirmAfterHours !== undefined) {
      registerChange('autoConfirmAfterHours', session.autoConfirmAfterHours, dto.autoConfirmAfterHours);
    }
    if (dto.lessonObjective !== undefined) {
      registerChange('lessonObjective', session.evaluation?.lessonObjective, dto.lessonObjective);
    }

    if (!changes.length) {
      return null;
    }

    return {
      editedAt: new Date(),
      editedByUserId: actor?.sub ? new Types.ObjectId(actor.sub) : undefined,
      editedByName: actor?.fullName || undefined,
      editedByRole: actor?.role || undefined,
      changes,
      durationSnapshot: durationSnapshot || undefined,
    };
  }

  /** FIX-8: Check teacher availability — warning only, does NOT throw */
  private async checkTeacherAvailability(
    teacherId: string,
    scheduledDate: Date,
    startTime?: string,
    endTime?: string,
  ): Promise<void> {
    try {
      const profile = await this.teacherProfileModel
        .findOne({ userId: new Types.ObjectId(teacherId) })
        .select('availability')
        .lean();

      if (!profile || !(profile as any).availability?.length) return;

      // Map JS getUTCDay() (0=Sun) to DayOfWeek enum values
      const dayIndexToEnum = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
      const dayOfWeek = dayIndexToEnum[scheduledDate.getUTCDay()];
      const dateStr = scheduledDate.toISOString().split('T')[0];

      const slotsForDay = ((profile as any).availability as any[]).filter(
        (slot) => slot.day === dayOfWeek,
      );

      if (slotsForDay.length === 0) {
        this.logger.warn(
          `[Availability] Teacher ${teacherId} has no availability on ${dayOfWeek} (${dateStr})`,
        );
        return;
      }

      if (!startTime || !endTime) return;

      // String-based HH:mm comparison works for zero-padded times
      const hasOverlap = slotsForDay.some(
        (slot) => startTime < slot.endTime && endTime > slot.startTime,
      );

      if (!hasOverlap) {
        this.logger.warn(
          `[Availability] Teacher ${teacherId} has no slot covering ${startTime}-${endTime} on ${dayOfWeek} (${dateStr})`,
        );
      }
    } catch (err) {
      this.logger.warn(
        `[Availability] Failed to check teacher availability: ${extractErrorMessage(err)}`,
      );
    }
  }

  // ──────────────────────────────────────────────────────────────────
  //  CREATE
  // ──────────────────────────────────────────────────────────────────

  async create(
    dto: CreateSessionDto,
    createdBy: string,
    actor?: JwtPayload,
    options?: { skipSnapshotRefresh?: boolean },
  ): Promise<SessionDocument> {
    // Validate class exists
    const classroom = await this.classModel.findById(dto.classId).lean();
    if (!classroom) throw new NotFoundException('Lop hoc khong ton tai');

    // Validate student exists
    const student = await this.studentModel.findById(dto.studentId).lean();
    if (!student) throw new NotFoundException('Hoc sinh khong ton tai');

    const scheduledDate = new Date(dto.scheduledDate);

    // Validate student belongs to class
    const studentInClass = (classroom.students || []).some(
      (s: any) => objectIdToString(s) === dto.studentId,
    );
    if (!studentInClass) {
      throw new BadRequestException('Hoc sinh khong thuoc lop hoc nay');
    }

    // Validate teacher assignment for class/date
    if (!this.isTeacherAssignedToClassOnDate(classroom, dto.teacherId, scheduledDate, dto.studentId)) {
      throw new BadRequestException(
        'Giao vien khong phu trach lop nay trong ngay duoc chon',
      );
    }

    // TEACHER can only create sessions for themselves
    if (actor?.role === Role.TEACHER) {
      if (actor.sub !== dto.teacherId) {
        throw new ForbiddenException(
          'Giao vien chi duoc tao buoi hoc cho chinh minh',
        );
      }
      if (!this.isTeacherAssignedToClassOnDate(classroom, actor.sub, scheduledDate, dto.studentId)) {
        throw new ForbiddenException(
          'Ban khong phu trach lop nay trong ngay duoc chon',
        );
      }
    }

    // FIX-8: Warn (do not reject) if session falls outside teacher's declared availability
    await this.checkTeacherAvailability(
      dto.teacherId,
      scheduledDate,
      dto.scheduledStartTime,
      dto.scheduledEndTime,
    );

    const studentParentId = objectIdToString((student as any).parentUserId);
    if (dto.parentUserId && studentParentId && dto.parentUserId !== studentParentId) {
      throw new BadRequestException(
        'parentUserId khong khop voi phu huynh cua hoc sinh',
      );
    }
    const parentUserId = studentParentId ?? dto.parentUserId;

    // Check for duplicate session (same student + class + date)
    const dayStart = new Date(
      Date.UTC(
        scheduledDate.getUTCFullYear(),
        scheduledDate.getUTCMonth(),
        scheduledDate.getUTCDate(),
      ),
    );
    const dayEnd = new Date(dayStart);
    dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);
    const duplicate = await this.sessionModel
      .findOne({
        classId: dto.classId,
        studentId: dto.studentId,
        scheduledDate: { $gte: dayStart, $lt: dayEnd },
        status: { $nin: [SessionStatus.CANCELLED, SessionStatus.RESCHEDULED] },
      })
      .lean();
    if (duplicate) {
      throw new ConflictException(
        'Da ton tai buoi hoc cho hoc sinh nay trong lop vao ngay nay',
      );
    }

    // Schedule conflict detection
    if (dto.scheduledStartTime && dto.scheduledEndTime) {
      const conflictResult = await this.sessionQueryService.checkConflicts({
        teacherId: dto.teacherId,
        studentId: dto.studentId,
        scheduledDate: dto.scheduledDate,
        scheduledStartTime: dto.scheduledStartTime,
        scheduledEndTime: dto.scheduledEndTime,
      });
      if (conflictResult.hasConflict) {
        const msgs = conflictResult.conflicts.map((c: any) => c.message).join('; ');
        throw new ConflictException(`Trung lich: ${msgs}`);
      }
    }

    // Auto-fill financials from class pricing snapshot (fallback to class fields for legacy data)
    const defaultDuration =
      toSafeNumber(
        getDurationForStudentAt(classroom, dto.studentId, scheduledDate).sessionDuration,
        0,
      ) ||
      toSafeNumber(getClassPricingConfigAt(classroom, scheduledDate).sessionDuration, 60) ||
      60;
    const durationMinutes = dto.durationMinutes ?? defaultDuration;
    const pricing = this.sessionPayrollService.resolveSessionFinancials(classroom, durationMinutes, scheduledDate);
    const amountCharged =
      dto.amountCharged !== undefined
        ? roundMoneyToThousand(dto.amountCharged)
        : pricing.amountCharged;
    const teacherPayout =
      dto.teacherPayout !== undefined
        ? roundMoneyDownToThousand(dto.teacherPayout)
        : pricing.teacherPayout;

    // Build evaluation if lesson objective provided
    const evaluation = dto.lessonObjective
      ? { lessonObjective: dto.lessonObjective }
      : undefined;

    const session = new this.sessionModel({
      ...dto,
      scheduledDate: new Date(dto.scheduledDate),
      parentUserId: parentUserId ? new Types.ObjectId(parentUserId) : undefined,
      sessionType: dto.sessionType,
      amountCharged,
      referenceAmountCharged: amountCharged,
      teacherPayout,
      durationMinutes,
      evaluation,
      orderId: (student as any).orderId || undefined,
      adGroupId: (student as any).adGroupId || undefined,
      adGroupName: (student as any).adGroupName || undefined,
      createdBy: new Types.ObjectId(createdBy),
    });

    const savedSession = await session.save();
    if (!options?.skipSnapshotRefresh) {
      this.triggerStudentSupportSnapshotRefreshForSession(savedSession, 'createSession');
    }
    return savedSession;
  }

  // ──────────────────────────────────────────────────────────────────
  //  BULK CREATE (tạo cho cả lớp)
  // ──────────────────────────────────────────────────────────────────

  async bulkCreate(dto: BulkCreateSessionDto, actor: JwtPayload): Promise<SessionDocument[]> {
    const classroom = await this.classModel.findById(dto.classId).lean();
    if (!classroom) throw new NotFoundException('Lớp học không tồn tại');

    const sessions: SessionDocument[] = [];

    for (const item of dto.students) {
      try {
        const session = await this.create(
          {
            classId: dto.classId,
            teacherId: dto.teacherId,
            studentId: item.studentId,
            parentUserId: item.parentUserId,
            scheduledDate: dto.scheduledDate,
            durationMinutes: dto.durationMinutes,
            sessionType: dto.sessionType,
            scheduledStartTime: dto.scheduledStartTime,
            scheduledEndTime: dto.scheduledEndTime,
          },
          actor.sub,
          actor,
        );
        sessions.push(session);
      } catch (err) {
        this.logger.warn(
          `Bulk create skipped student ${item.studentId}: ${(err as Error).message}`,
        );
      }
    }

    return sessions;
  }

  // ──────────────────────────────────────────────────────────────────
  //  QUERY / FIND (delegated to SessionQueryService)
  // ──────────────────────────────────────────────────────────────────

  async findAll(query: QuerySessionDto, actor?: JwtPayload) {
    return this.sessionQueryService.findAll(query, actor);
  }

  async findById(id: string, actor?: JwtPayload): Promise<SessionDocument> {
    return this.sessionQueryService.findById(id, actor);
  }

  async createSessionChangeRequest(
    sessionId: string,
    dto: CreateSessionChangeRequestDto,
    actor: JwtPayload,
  ) {
    const session = await this.sessionModel.findById(sessionId);
    if (!session) {
      throw new NotFoundException('Buoi hoc khong ton tai');
    }

    await this.findById(sessionId, actor);

    if (session.status !== SessionStatus.SCHEDULED) {
      throw new BadRequestException('Chi gui yeu cau doi buoi cho session SCHEDULED');
    }

    const classroom = await this.classModel.findById(session.classId).lean();
    if (!classroom) {
      throw new NotFoundException('Lop hoc khong ton tai');
    }

    if (actor.role === Role.SALE) {
      const saleOwnerId = objectIdToString((classroom as any)?.sale);
      if (!saleOwnerId || saleOwnerId !== actor.sub) {
        throw new ForbiddenException('Ban khong phu trach lop hoc nay');
      }
    }

    const currentTeacherId = objectIdToString(session.teacherId);
    if (!currentTeacherId) {
      throw new BadRequestException('Buoi hoc khong co giao vien hop le');
    }

    const currentScheduledDate = new Date(session.scheduledDate);
    const currentScheduledDateText = this.formatDateOnly(currentScheduledDate);
    const currentStartTime = `${session.scheduledStartTime || ''}`.trim();
    const currentEndTime = `${session.scheduledEndTime || ''}`.trim();
    const currentDurationMinutes =
      toSafeNumber(session.durationMinutes, 0)
      || this.calculateDurationMinutes(currentStartTime, currentEndTime)
      || 60;

    const requestedScheduledDateText =
      `${dto.requestedScheduledDate || ''}`.trim() || currentScheduledDateText;
    const requestedStartTimeText =
      `${dto.requestedStartTime || ''}`.trim() || currentStartTime;
    const requestedEndTimeText =
      `${dto.requestedEndTime || ''}`.trim() || currentEndTime;

    if ((dto.requestedStartTime && !dto.requestedEndTime) || (!dto.requestedStartTime && dto.requestedEndTime)) {
      throw new BadRequestException('Phai nhap du ca gio bat dau va gio ket thuc khi de xuat doi gio');
    }

    const computedRequestedDuration =
      this.calculateDurationMinutes(requestedStartTimeText, requestedEndTimeText);
    if (!computedRequestedDuration) {
      throw new BadRequestException('Khung gio de xuat khong hop le');
    }

    const normalizedRequestedTeacherId =
      dto.requestedTeacherId && dto.requestedTeacherId !== currentTeacherId
        ? dto.requestedTeacherId
        : undefined;
    const normalizedReason = `${dto.reason || ''}`.trim();

    if (!normalizedReason) {
      throw new BadRequestException('Ly do thay doi khong duoc de trong');
    }

    if (normalizedRequestedTeacherId) {
      const requestedTeacher = await this.userModel
        .findOne({ _id: new Types.ObjectId(normalizedRequestedTeacherId), role: Role.TEACHER })
        .select('_id')
        .lean();
      if (!requestedTeacher) {
        throw new NotFoundException('Giao vien de xuat khong ton tai');
      }
    }

    const normalizedRequestedDurationMinutes =
      dto.requestedDurationMinutes !== undefined
        ? dto.requestedDurationMinutes
        : computedRequestedDuration;

    const requestedDurationMinutes =
      normalizedRequestedDurationMinutes !== currentDurationMinutes
        ? normalizedRequestedDurationMinutes
        : undefined;

    const requestedScheduledDate =
      requestedScheduledDateText !== currentScheduledDateText
        ? new Date(requestedScheduledDateText)
        : undefined;
    const requestedStartTime =
      requestedStartTimeText !== currentStartTime ? requestedStartTimeText : undefined;
    const requestedEndTime =
      requestedEndTimeText !== currentEndTime ? requestedEndTimeText : undefined;

    if (
      !normalizedRequestedTeacherId
      && !requestedDurationMinutes
      && !requestedScheduledDate
      && !requestedStartTime
      && !requestedEndTime
    ) {
      throw new BadRequestException('Yeu cau thay doi phai khac thong tin hien tai');
    }

    const effectiveRequestedDate = requestedScheduledDate || currentScheduledDate;
    const nextFinancials =
      requestedDurationMinutes || requestedScheduledDate
      || requestedStartTime
      || requestedEndTime
        ? this.sessionPayrollService.resolveSessionFinancials(
          classroom,
          requestedDurationMinutes ?? currentDurationMinutes,
          effectiveRequestedDate,
        )
        : {
          amountCharged: toSafeNumber(session.amountCharged, 0),
          teacherPayout: toSafeNumber(session.teacherPayout, 0),
          pricePerSession: 0,
        };

    try {
      const created = await this.sessionChangeRequestModel.create({
        sessionId: session._id,
        classId: session.classId,
        studentId: session.studentId,
        parentUserId: session.parentUserId,
        currentTeacherId: session.teacherId,
        currentScheduledDate,
        currentStartTime,
        currentEndTime,
        requestedTeacherId: normalizedRequestedTeacherId
          ? new Types.ObjectId(normalizedRequestedTeacherId)
          : undefined,
        requestedScheduledDate,
        requestedStartTime,
        requestedEndTime,
        currentDurationMinutes,
        requestedDurationMinutes,
        reason: normalizedReason,
        status: SessionChangeRequestStatus.PENDING,
        financialImpact: {
          oldDurationMinutes: currentDurationMinutes,
          newDurationMinutes: requestedDurationMinutes ?? currentDurationMinutes,
          oldAmountCharged: toSafeNumber(session.amountCharged, 0),
          newAmountCharged: nextFinancials.amountCharged,
          deltaAmountCharged: nextFinancials.amountCharged - toSafeNumber(session.amountCharged, 0),
          oldTeacherPayout: toSafeNumber(session.teacherPayout, 0),
          newTeacherPayout: nextFinancials.teacherPayout,
          deltaTeacherPayout: nextFinancials.teacherPayout - toSafeNumber(session.teacherPayout, 0),
        },
        requestedBy: new Types.ObjectId(actor.sub),
      });

      return this.getPopulatedSessionChangeRequestById((created._id as Types.ObjectId).toString());
    } catch (error: any) {
      if (error?.code === 11000) {
        throw new ConflictException('Buoi hoc nay da co yeu cau doi buoi dang cho duyet');
      }
      throw error;
    }
  }

  async getSessionChangeRequests(sessionId: string, actor: JwtPayload) {
    await this.findById(sessionId, actor);
    return this.populateSessionChangeRequestQuery(
      this.sessionChangeRequestModel
        .find({ sessionId: new Types.ObjectId(sessionId) })
        .sort({ requestedAt: -1, createdAt: -1 }),
    ).lean();
  }

  async reviewSessionChangeRequest(
    requestId: string,
    dto: ReviewSessionChangeRequestDto,
    actor: JwtPayload,
  ) {
    const request = await this.sessionChangeRequestModel.findById(requestId);
    if (!request) {
      throw new NotFoundException('Yeu cau doi buoi hoc khong ton tai');
    }

    if (request.status !== SessionChangeRequestStatus.PENDING) {
      throw new BadRequestException('Chi duyet duoc yeu cau dang cho xu ly');
    }

    if (dto.action === 'REJECT') {
      request.status = SessionChangeRequestStatus.REJECTED;
      request.reviewedBy = new Types.ObjectId(actor.sub);
      request.reviewedAt = new Date();
      request.rejectionReason = `${dto.rejectionReason || ''}`.trim() || undefined;
      await request.save();
      return this.getPopulatedSessionChangeRequestById(requestId);
    }

    const session = await this.sessionModel.findById(request.sessionId);
    if (!session) {
      throw new NotFoundException('Buoi hoc khong ton tai');
    }

    const updateDto: UpdateSessionDto = {};
    const requestedTeacherId = objectIdToString(request.requestedTeacherId);
    const requestedScheduledDateText = request.requestedScheduledDate
      ? this.formatDateOnly(request.requestedScheduledDate)
      : '';

    if (requestedTeacherId && requestedTeacherId !== objectIdToString(session.teacherId)) {
      updateDto.teacherId = requestedTeacherId;
    }
    if (requestedScheduledDateText && requestedScheduledDateText !== this.formatDateOnly(session.scheduledDate)) {
      updateDto.scheduledDate = requestedScheduledDateText;
    }
    if (request.requestedStartTime && request.requestedStartTime !== session.scheduledStartTime) {
      updateDto.scheduledStartTime = request.requestedStartTime;
    }
    if (request.requestedEndTime && request.requestedEndTime !== session.scheduledEndTime) {
      updateDto.scheduledEndTime = request.requestedEndTime;
    }
    if (
      request.requestedDurationMinutes !== undefined
      && request.requestedDurationMinutes !== session.durationMinutes
    ) {
      updateDto.durationMinutes = request.requestedDurationMinutes;
    }

    if (!Object.keys(updateDto).length) {
      throw new BadRequestException('Yeu cau khong con thay doi nao de ap dung');
    }

    await this.update(objectIdToString(request.sessionId) || request.sessionId.toString(), updateDto, actor);

    request.status = SessionChangeRequestStatus.APPROVED;
    request.reviewedBy = new Types.ObjectId(actor.sub);
    request.reviewedAt = new Date();
    request.rejectionReason = undefined;
    await request.save();

    return this.getPopulatedSessionChangeRequestById(requestId);
  }

  // ──────────────────────────────────────────────────────────────────
  //  UPDATE (basic edit - only SCHEDULED sessions)
  // ──────────────────────────────────────────────────────────────────

  async update(
    id: string,
    dto: UpdateSessionDto,
    actor?: JwtPayload,
  ): Promise<SessionDocument> {
    const session = await this.sessionModel.findById(id);
    if (!session) throw new NotFoundException('Buổi học không tồn tại');

    if (session.status !== SessionStatus.SCHEDULED) {
      throw new BadRequestException(
        'Chỉ có thể sửa buổi học ở trạng thái SCHEDULED',
      );
    }

    const classroom = await this.classModel.findById(session.classId).lean();
    if (!classroom) {
      throw new NotFoundException('Lop hoc khong ton tai');
    }

    const scheduledDate = dto.scheduledDate ? new Date(dto.scheduledDate) : new Date(session.scheduledDate);
    const nextTeacherId = dto.teacherId || session.teacherId.toString();
    const nextStartTime =
      dto.scheduledStartTime !== undefined ? dto.scheduledStartTime : session.scheduledStartTime;
    const nextEndTime =
      dto.scheduledEndTime !== undefined ? dto.scheduledEndTime : session.scheduledEndTime;
    const nextDurationMinutes =
      dto.durationMinutes !== undefined ? dto.durationMinutes : session.durationMinutes;

    const studentId = objectIdToString(session.studentId);
    if (!studentId) {
      throw new BadRequestException('Session khong co hoc sinh hop le');
    }

    if (!this.isTeacherAssignedToClassOnDate(classroom, nextTeacherId, scheduledDate, studentId)) {
      throw new BadRequestException('Giao vien khong phu trach lop nay trong ngay duoc chon');
    }

    if (nextStartTime && nextEndTime) {
      const conflictResult = await this.sessionQueryService.checkConflicts({
        teacherId: nextTeacherId,
        studentId,
        scheduledDate: scheduledDate.toISOString(),
        scheduledStartTime: nextStartTime,
        scheduledEndTime: nextEndTime,
        excludeSessionId: id,
      });
      if (conflictResult.hasConflict) {
        const messages = conflictResult.conflicts.map((item: any) => item.message).join('; ');
        throw new ConflictException(`Trung lich: ${messages}`);
      }

      await this.checkTeacherAvailability(
        nextTeacherId,
        scheduledDate,
        nextStartTime,
        nextEndTime,
      );
    }

    const recomputedFinancials =
      dto.durationMinutes !== undefined
        ? this.sessionPayrollService.resolveSessionFinancials(classroom, nextDurationMinutes, scheduledDate)
        : null;

    const normalizedAmountCharged =
      dto.amountCharged !== undefined
        ? roundMoneyToThousand(dto.amountCharged)
        : undefined;
    const normalizedTeacherPayout =
      dto.teacherPayout !== undefined
        ? roundMoneyDownToThousand(dto.teacherPayout)
        : undefined;

    const dtoForHistory: UpdateSessionDto = {
      ...dto,
      ...(normalizedAmountCharged !== undefined ? { amountCharged: normalizedAmountCharged } : {}),
      ...(normalizedTeacherPayout !== undefined ? { teacherPayout: normalizedTeacherPayout } : {}),
    };
    if (recomputedFinancials && dto.amountCharged === undefined) {
      dtoForHistory.amountCharged = recomputedFinancials.amountCharged;
    }
    if (recomputedFinancials && dto.teacherPayout === undefined) {
      dtoForHistory.teacherPayout = recomputedFinancials.teacherPayout;
    }

    const teacherNameMap = await this.getUserDisplayNameMap(
      [objectIdToString(session.teacherId), dto.teacherId].filter(
        (value): value is string => !!value,
      ),
    );

    const durationSnapshot =
      dto.durationMinutes !== undefined && dto.durationMinutes !== session.durationMinutes
        ? await this.sessionPayrollService.buildRemainingSessionsAtNewDurationSnapshot(session, dto.durationMinutes)
        : null;

    const historyEntry = this.buildSessionEditHistoryEntry({
      session,
      dto: dtoForHistory,
      actor,
      teacherNameMap,
      durationSnapshot,
    });

    if (!historyEntry) {
      return this.findById(id, actor);
    }

    if (dto.teacherId !== undefined) {
      session.teacherId = new Types.ObjectId(dto.teacherId);
    }
    if (dto.scheduledDate !== undefined) {
      session.scheduledDate = scheduledDate;
    }
    if (dto.sessionType !== undefined) {
      session.sessionType = dto.sessionType;
    }
    if (dto.scheduledStartTime !== undefined) {
      session.scheduledStartTime = dto.scheduledStartTime;
    }
    if (dto.scheduledEndTime !== undefined) {
      session.scheduledEndTime = dto.scheduledEndTime;
    }
    if (dto.durationMinutes !== undefined) {
      session.durationMinutes = dto.durationMinutes;
      if (dto.amountCharged === undefined && recomputedFinancials) {
        session.amountCharged = recomputedFinancials.amountCharged;
      }
      if (dto.teacherPayout === undefined && recomputedFinancials) {
        session.teacherPayout = recomputedFinancials.teacherPayout;
      }
    }
    if (dto.topicsCovered !== undefined) {
      session.topicsCovered = dto.topicsCovered;
    }
    if (dto.homework !== undefined) {
      session.homework = dto.homework;
    }
    if (dto.teacherNotes !== undefined) {
      session.teacherNotes = dto.teacherNotes;
    }
    if (dto.amountCharged !== undefined) {
      session.amountCharged = normalizedAmountCharged ?? 0;
    }
    if (dto.teacherPayout !== undefined) {
      session.teacherPayout = normalizedTeacherPayout ?? 0;
    }
    if (dto.autoConfirmAfterHours !== undefined) {
      session.autoConfirmAfterHours = dto.autoConfirmAfterHours;
    }
    if (dto.lessonObjective !== undefined) {
      const evaluation = session.evaluation || ({} as any);
      evaluation.lessonObjective = dto.lessonObjective;
      session.evaluation = evaluation;
    }

    session.editHistory = [...(session.editHistory || []), historyEntry];

    const savedSession = await session.save();
    this.triggerStudentSupportSnapshotRefreshForSession(savedSession, 'updateSession');
    return this.findById((savedSession._id as Types.ObjectId).toString(), actor);
  }

  // ──────────────────────────────────────────────────────────────────
  //  WORKFLOW ACTIONS (delegated to SessionWorkflowService)
  // ──────────────────────────────────────────────────────────────────

  async teacherComplete(
    sessionId: string,
    teacherUserId: string,
    dto: CompleteSessionDto,
  ): Promise<SessionDocument> {
    return this.sessionWorkflowService.teacherComplete(sessionId, teacherUserId, dto);
  }

  async submitTeachingReport(
    sessionId: string,
    teacherUserId: string,
    dto: SubmitTeachingReportDto,
  ): Promise<SessionDocument> {
    return this.sessionWorkflowService.submitTeachingReport(sessionId, teacherUserId, dto);
  }

  async bulkSubmitTeachingReport(
    classId: string,
    date: string,
    teacherUserId: string,
    dto: BulkTeachingReportDto,
  ): Promise<{ updatedCount: number; skippedCount: number; results: { sessionId: string; status: string; action: string }[] }> {
    return this.sessionWorkflowService.bulkSubmitTeachingReport(classId, date, teacherUserId, dto);
  }

  async parentConfirm(
    sessionId: string,
    parentUserId: string,
    dto: ConfirmSessionDto,
  ): Promise<SessionDocument> {
    return this.sessionWorkflowService.parentConfirm(sessionId, parentUserId, dto);
  }

  async manualFinalize(sessionId: string, userId: string): Promise<SessionDocument> {
    return this.sessionWorkflowService.manualFinalize(sessionId, userId);
  }

  async cancel(
    sessionId: string,
    userId: string,
    userRole: Role,
    dto: CancelSessionDto,
  ): Promise<SessionDocument> {
    return this.sessionWorkflowService.cancel(sessionId, userId, userRole, dto);
  }

  async reschedule(
    sessionId: string,
    actor: JwtPayload,
    dto: RescheduleSessionDto,
  ): Promise<{ oldSession: SessionDocument; newSession: SessionDocument }> {
    return this.sessionWorkflowService.reschedule(sessionId, actor, dto);
  }

  async markNoShow(sessionId: string, actor: JwtPayload): Promise<SessionDocument> {
    return this.sessionWorkflowService.markNoShow(sessionId, actor);
  }

  // ──────────────────────────────────────────────────────────────────
  //  DELETE (soft-delete chỉ OPS/DIRECTOR, chỉ khi SCHEDULED)
  // ──────────────────────────────────────────────────────────────────

  async remove(id: string): Promise<void> {
    const session = await this.sessionModel.findById(id);
    if (!session) throw new NotFoundException('Buổi học không tồn tại');

    if (session.status !== SessionStatus.SCHEDULED) {
      throw new BadRequestException(
        'Chỉ xóa được buổi ở trạng thái SCHEDULED',
      );
    }

    await this.sessionModel.findByIdAndDelete(id);
  }

  // ──────────────────────────────────────────────────────────────────
  //  TRIAL SESSION (delegated to SessionTrialService)
  // ──────────────────────────────────────────────────────────────────

  async convertTrialSessions(
    studentId: string,
    classId: string,
  ): Promise<{ converted: number; deducted: number }> {
    return this.sessionTrialService.convertTrialSessions(studentId, classId);
  }

  async markTrialRejectedNoPay(
    studentId: string,
    classId: string,
    actorUserId?: string,
  ): Promise<{ updated: number; excludedPayroll: number }> {
    return this.sessionTrialService.markTrialRejectedNoPay(studentId, classId, actorUserId);
  }

  async markTrialTeacherPaidOnly(
    studentId: string,
    classId: string,
    actorUserId?: string,
  ): Promise<{ updated: number; excludedPayroll: number }> {
    return this.sessionTrialService.markTrialTeacherPaidOnly(studentId, classId, actorUserId);
  }

  // ──────────────────────────────────────────────────────────────────
  //  STATS / QUERY (delegated to SessionQueryService)
  // ──────────────────────────────────────────────────────────────────

  async getStats(filter: { teacherId?: string; classId?: string; fromDate?: string; toDate?: string }) {
    return this.sessionQueryService.getStats(filter);
  }

  async getChildrenProgress(parentUserId: string) {
    return this.sessionQueryService.getChildrenProgress(parentUserId);
  }

  async checkConflicts(params: {
    teacherId?: string;
    studentId?: string;
    scheduledDate: string;
    scheduledStartTime: string;
    scheduledEndTime: string;
    excludeSessionId?: string;
  }) {
    return this.sessionQueryService.checkConflicts(params);
  }

  async submitParentFeedback(parentUserId: string, feedback: {
    overallRating: number;
    teachingQuality?: number;
    communication?: number;
    facility?: number;
    comment?: string;
    studentId?: string;
    sessionId?: string;
  }) {
    return this.sessionQueryService.submitParentFeedback(parentUserId, feedback);
  }

  // ──────────────────────────────────────────────────────────────────
  //  PAYROLL (delegated to SessionPayrollService)
  // ──────────────────────────────────────────────────────────────────

  async countFinalizedForPayroll(
    teacherId: string,
    cutoffExclusive: Date,
    mongoSession?: any,
  ) {
    return this.sessionPayrollService.countFinalizedForPayroll(teacherId, cutoffExclusive, mongoSession);
  }

  async claimTeacherPaid(sessionIds: string[], mongoSession?: any): Promise<void> {
    return this.sessionPayrollService.claimTeacherPaid(sessionIds, mongoSession);
  }

  async markTeacherPaid(sessionIds: string[], mongoSession?: any): Promise<void> {
    return this.sessionPayrollService.markTeacherPaid(sessionIds, mongoSession);
  }

  async checkTeacherPaid(sessionIds: string[]): Promise<string[]> {
    return this.sessionPayrollService.checkTeacherPaid(sessionIds);
  }

  async unmarkTeacherPaid(sessionIds: string[], mongoSession?: any): Promise<void> {
    return this.sessionPayrollService.unmarkTeacherPaid(sessionIds, mongoSession);
  }

  async markPaid(sessionIds: string[]): Promise<void> {
    return this.sessionPayrollService.markPaid(sessionIds);
  }
}
