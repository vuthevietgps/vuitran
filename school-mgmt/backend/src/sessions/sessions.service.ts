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
import { Model, Types, FilterQuery } from 'mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';

import {
  Session,
  SessionDocument,
  SessionStatus,
  CancelledByRole,
  SessionType,
} from './schemas/session.schema';
import { Classroom, ClassDocument, ClassMode } from '../classes/schemas/class.schema';
import { Student, StudentDocument } from '../students/schemas/student.schema';
import { Invoice, InvoiceDocument, InvoiceStatus } from '../invoices/schemas/invoice.schema';
import { TeacherProfile, TeacherProfileDocument } from '../teachers/schemas/teacher-profile.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import {
  Attendance,
  AttendanceDocument,
  AttendanceStatus,
  COUNTED_ATTENDANCE_STATUSES,
} from '../attendance/schemas/attendance.schema';

import { CreateSessionDto } from './dto/create-session.dto';
import { UpdateSessionDto } from './dto/update-session.dto';
import { QuerySessionDto } from './dto/query-session.dto';
import { CompleteSessionDto } from './dto/complete-session.dto';
import { ConfirmSessionDto } from './dto/confirm-session.dto';
import { CancelSessionDto } from './dto/cancel-session.dto';
import { RescheduleSessionDto } from './dto/reschedule-session.dto';
import { BulkCreateSessionDto } from './dto/bulk-create-session.dto';
import { SubmitTeachingReportDto } from './dto/submit-teaching-report.dto';
import { BulkTeachingReportDto } from './dto/bulk-teaching-report.dto';
import { Role } from '../common/interfaces/role.enum';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { WalletsService } from '../wallets/wallets.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  NotificationPriority,
  NotificationType,
} from '../notifications/schemas/notification.schema';
import { PayrollTransactionService } from '../payroll/payroll-transaction.service';
import { HoldReason } from '../payroll/schemas/payroll-transaction.schema';
import { TicketsService } from '../tickets/tickets.service';
import { TicketType, TicketPriority } from '../tickets/schemas/ticket.schema';
import { StudentSupportSnapshotService } from '../messages/student-support-snapshot.service';
import {
  getClassPricingConfigAt,
  getDurationForStudentAt,
  isTeacherAssignedToStudentAt,
} from '../classes/student-config.utils';

// ─── Constants ───────────────────────────────────────────────────────
const TEACHING_REPORT_DEADLINE_HOURS = 24; // Deadline nộp báo cáo: 24h sau buổi học
const TRIAL_AUTO_DECIDE_DAYS = 7;          // Tự động quyết định trial sau 7 ngày

@Injectable()
export class SessionsService {
  private readonly logger = new Logger(SessionsService.name);

  constructor(
    @InjectModel(Session.name) private sessionModel: Model<SessionDocument>,
    @InjectModel(Classroom.name) private classModel: Model<ClassDocument>,
    @InjectModel(Student.name) private studentModel: Model<StudentDocument>,
    @InjectModel(Invoice.name) private invoiceModel: Model<InvoiceDocument>,
    @InjectModel(TeacherProfile.name) private teacherProfileModel: Model<TeacherProfileDocument>,
    @InjectModel(Attendance.name) private attendanceModel: Model<AttendanceDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @Inject(forwardRef(() => WalletsService))
    private walletsService: WalletsService,
    private notificationsService: NotificationsService,
    private payrollTxService: PayrollTransactionService,
    private ticketsService: TicketsService,
    private studentSupportSnapshotService: StudentSupportSnapshotService,
  ) {}

  private objectIdToString(value: any): string | null {
    if (!value) return null;
    if (typeof value === 'string') return value;
    if (value instanceof Types.ObjectId) return value.toString();
    if (value?._id) return this.objectIdToString(value._id);
    if (typeof value.toString === 'function') {
      const str = value.toString();
      return str && str !== '[object Object]' ? str : null;
    }
    return null;
  }

  private async ensureAttendanceForCompletedSession(session: SessionDocument): Promise<void> {
    const attendanceDate = new Date(session.scheduledDate);
    attendanceDate.setUTCHours(0, 0, 0, 0);

    await this.attendanceModel.findOneAndUpdate(
      {
        classId: session.classId,
        studentId: session.studentId,
        date: attendanceDate,
      },
      {
        $set: {
          teacherId: session.teacherId,
          status: AttendanceStatus.PRESENT,
          sessionId: session._id,
          sessionDuration: session.durationMinutes,
          attendedAt: session.confirmation?.teacherCompletedAt || new Date(),
        },
        $setOnInsert: {
          notes: '',
        },
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      },
    );
  }

  private isTeacherAssignedToClassOnDate(
    classroom: any,
    teacherId: string,
    scheduledDate: Date,
    studentId?: string,
  ): boolean {
    if (studentId && isTeacherAssignedToStudentAt(classroom, studentId, teacherId, scheduledDate)) {
      return true;
    }

    if (!studentId && this.objectIdToString(classroom?.teacher) === teacherId) {
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
      if (this.objectIdToString(s?.teacherId) !== teacherId) return false;
      const from = new Date(s.fromDate);
      const to = new Date(s.toDate);
      from.setUTCHours(0, 0, 0, 0);
      to.setUTCHours(23, 59, 59, 999);
      return day >= from && day <= to;
    });
  }

  private async resolveParentUserIdForSession(session: {
    parentUserId?: any;
    studentId: any;
  }): Promise<string | null> {
    const direct = this.objectIdToString(session.parentUserId);
    if (direct) return direct;

    const student = await this.studentModel
      .findById(session.studentId)
      .select('parentUserId')
      .lean();
    return this.objectIdToString((student as any)?.parentUserId);
  }

  private async ensureSessionParentUserId(session: SessionDocument): Promise<string | null> {
    const existingParentUserId = this.objectIdToString(session.parentUserId);
    if (existingParentUserId) {
      return existingParentUserId;
    }

    const resolvedParentUserId = await this.resolveParentUserIdForSession({
      parentUserId: session.parentUserId,
      studentId: session.studentId,
    });
    if (!resolvedParentUserId || !Types.ObjectId.isValid(resolvedParentUserId)) {
      return resolvedParentUserId;
    }

    const parentObjectId = new Types.ObjectId(resolvedParentUserId);
    session.parentUserId = parentObjectId as any;
    await this.sessionModel.updateOne(
      { _id: session._id },
      { $set: { parentUserId: parentObjectId } },
    );

    return resolvedParentUserId;
  }

  private async ensureOfflineTrialClass(classId: string): Promise<void> {
    const classroom = await this.classModel.findById(classId).select('classMode').lean();
    if (!classroom) {
      throw new NotFoundException('Lop hoc khong ton tai');
    }
    if ((classroom as any).classMode !== ClassMode.OFFLINE) {
      throw new BadRequestException('Hoc thu chi ap dung cho lop OFFLINE');
    }
  }

  private triggerStudentSupportSnapshotRefreshForSession(
    session: { parentUserId?: any; studentId?: any },
    reason: string,
  ) {
    void this.refreshStudentSupportSnapshotForSession(session, reason);
  }

  private triggerStudentSupportSnapshotRefreshForSessions(
    sessions: Array<{ parentUserId?: any; studentId?: any }>,
    reason: string,
  ) {
    void this.refreshStudentSupportSnapshotsForSessions(sessions, reason);
  }

  private async refreshStudentSupportSnapshotForSession(
    session: { parentUserId?: any; studentId?: any },
    reason: string,
  ): Promise<void> {
    const studentId = this.objectIdToString(session.studentId);
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
        `[StudentSupportSnapshot] Failed to refresh for student ${studentId} (${reason}): ${this.extractErrorMessage(err)}`,
      );
    }
  }

  private async refreshStudentSupportSnapshotsForSessions(
    sessions: Array<{ parentUserId?: any; studentId?: any }>,
    reason: string,
  ): Promise<void> {
    const resolvedParents = new Map<string, string | null>();
    const refreshedKeys = new Set<string>();

    for (const session of sessions) {
      const studentId = this.objectIdToString(session.studentId);
      if (!studentId) continue;

      let parentUserId = this.objectIdToString(session.parentUserId);
      if (!parentUserId) {
        if (resolvedParents.has(studentId)) {
          parentUserId = resolvedParents.get(studentId) || null;
        } else {
          parentUserId = await this.resolveParentUserIdForSession({
            parentUserId: session.parentUserId,
            studentId: session.studentId,
          });
          resolvedParents.set(studentId, parentUserId);
        }
      }

      if (!parentUserId) continue;

      const refreshKey = `${parentUserId}:${studentId}`;
      if (refreshedKeys.has(refreshKey)) continue;
      refreshedKeys.add(refreshKey);

      try {
        await this.studentSupportSnapshotService.rebuild(parentUserId, studentId);
      } catch (err) {
        this.logger.warn(
          `[StudentSupportSnapshot] Failed to refresh for student ${studentId} (${reason}): ${this.extractErrorMessage(err)}`,
        );
      }
    }
  }

  private toSafeNumber(value: unknown, fallback = 0): number {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  private resolveClassPricing(classroom: any, effectiveAt?: Date | string | null): {
    referenceDuration: number;
    pricePerSession: number;
    teacherPayPerSession: number;
  } {
    const pricing = getClassPricingConfigAt(classroom, effectiveAt);
    const referenceDuration = this.toSafeNumber(pricing.baseDuration, 60) || 60;
    const pricePerSession = this.toSafeNumber(pricing.pricePerSession, 0);
    const teacherPayPerSession = this.toSafeNumber(pricing.teacherPayPerSession, 0);

    return { referenceDuration, pricePerSession, teacherPayPerSession };
  }

  private resolveSessionFinancials(
    classroom: any,
    durationMinutes: number,
    effectiveAt?: Date | string | null,
  ): {
    amountCharged: number;
    teacherPayout: number;
    pricePerSession: number;
  } {
    const pricing = this.resolveClassPricing(classroom, effectiveAt);
    const baseDuration = pricing.referenceDuration > 0 ? pricing.referenceDuration : 60;
    const ratio = durationMinutes / baseDuration;

    return {
      amountCharged: this.roundMoneyToThousand(pricing.pricePerSession * ratio),
      teacherPayout: this.roundMoneyDownToThousand(pricing.teacherPayPerSession * ratio),
      pricePerSession: pricing.pricePerSession,
    };
  }

  private shouldKeepZeroTeacherPayout(session: { status?: SessionStatus | string }): boolean {
    return [
      SessionStatus.CANCELLED,
      SessionStatus.NO_SHOW,
      SessionStatus.RESCHEDULED,
    ].includes(session.status as SessionStatus);
  }

  private computeTeacherPayoutFallback(
    session: {
      teacherPayout?: number;
      status?: SessionStatus | string;
      scheduledDate?: Date | string | null;
      durationMinutes?: number | null;
    },
    classroom: any | null,
  ): number {
    const currentTeacherPayout = this.toSafeNumber(session.teacherPayout, 0);
    if (currentTeacherPayout > 0 || !classroom || this.shouldKeepZeroTeacherPayout(session)) {
      return currentTeacherPayout;
    }

    const effectiveAt = session.scheduledDate || undefined;
    const classPricing = getClassPricingConfigAt(classroom, effectiveAt);

    if (classroom.classMode === ClassMode.OFFLINE) {
      return this.roundMoneyDownToThousand(
        this.toSafeNumber(classPricing.teacherPayPerStudent, 0),
      );
    }

    const durationMinutes =
      this.toSafeNumber(session.durationMinutes, classPricing.sessionDuration || 60)
      || classPricing.sessionDuration
      || 60;

    return this.resolveSessionFinancials(classroom, durationMinutes, effectiveAt).teacherPayout;
  }

  private async buildTeacherPayoutOverrideMap(
    sessions: Array<{
      _id?: unknown;
      classId?: unknown;
      teacherPayout?: number;
      status?: SessionStatus | string;
      scheduledDate?: Date | string | null;
      durationMinutes?: number | null;
    }>,
  ): Promise<Map<string, number>> {
    const candidates = sessions.filter((session) => {
      if (!this.objectIdToString(session._id) || !this.objectIdToString(session.classId)) {
        return false;
      }
      if (this.toSafeNumber(session.teacherPayout, 0) > 0) {
        return false;
      }
      return !this.shouldKeepZeroTeacherPayout(session);
    });

    if (!candidates.length) {
      return new Map<string, number>();
    }

    const classIds = [...new Set(
      candidates
        .map((session) => this.objectIdToString(session.classId))
        .filter((classId): classId is string => !!classId),
    )];

    const classrooms = await this.classModel
      .find({
        _id: { $in: classIds.map((classId) => new Types.ObjectId(classId)) },
      })
      .select(
        'classMode pricingSnapshot durationSnapshots pricePerSession teacherPayPerSession teacherPayPerStudent baseDuration sessionDuration',
      )
      .lean();

    const classroomById = new Map<string, any>();
    for (const classroom of classrooms as any[]) {
      const classroomId = this.objectIdToString(classroom?._id);
      if (!classroomId) continue;
      classroomById.set(classroomId, classroom);
    }

    const overrides = new Map<string, number>();
    for (const session of candidates) {
      const sessionId = this.objectIdToString(session._id);
      const classId = this.objectIdToString(session.classId);
      if (!sessionId || !classId) continue;

      const overrideTeacherPayout = this.computeTeacherPayoutFallback(
        session,
        classroomById.get(classId) || null,
      );
      if (overrideTeacherPayout > 0) {
        overrides.set(sessionId, overrideTeacherPayout);
      }
    }

    return overrides;
  }

  private roundMoneyToThousand(value: number): number {
    if (!Number.isFinite(value) || value <= 0) return 0;
    return Math.round(value / 1000) * 1000;
  }

  private roundMoneyDownToThousand(value: number): number {
    if (!Number.isFinite(value) || value <= 0) return 0;
    return Math.floor(value / 1000) * 1000;
  }

  private roundTo2(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private floorSessionCount(value: number): number {
    const normalized = Number.isFinite(value) ? value : 0;
    return normalized > 0 ? Math.floor(normalized) : 0;
  }

  private formatDateForHistory(value: unknown): string {
    const date = value instanceof Date ? value : new Date(String(value));
    if (Number.isNaN(date.getTime())) return this.emptyHistoryValue();
    const day = String(date.getUTCDate()).padStart(2, '0');
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const year = date.getUTCFullYear();
    return `${day}/${month}/${year}`;
  }

  private emptyHistoryValue(): string {
    return 'Khong co';
  }

  private formatSessionTypeLabel(value?: string | null): string {
    const labels: Record<string, string> = {
      [SessionType.REGULAR]: 'Buoi hoc thuong',
      [SessionType.TRIAL]: 'Buoi hoc thu',
      [SessionType.MAKE_UP]: 'Buoi hoc bu',
      [SessionType.EXAM_PREP]: 'On thi',
      [SessionType.REVIEW]: 'On tap',
      [SessionType.EXTRA]: 'Buoi hoc them',
    };
    if (!value) return this.emptyHistoryValue();
    return labels[value] || value;
  }

  private getSessionEditFieldLabel(field: string): string {
    const labels: Record<string, string> = {
      teacherId: 'Giao vien',
      scheduledDate: 'Ngay hoc',
      scheduledStartTime: 'Gio bat dau',
      scheduledEndTime: 'Gio ket thuc',
      durationMinutes: 'Thoi luong',
      sessionType: 'Loai buoi hoc',
      topicsCovered: 'Noi dung',
      homework: 'BTVN',
      teacherNotes: 'Ghi chu GV',
      amountCharged: 'Hoc phi',
      teacherPayout: 'Luong GV',
      autoConfirmAfterHours: 'So gio auto-confirm',
      lessonObjective: 'Muc tieu buoi hoc',
    };
    return labels[field] || field;
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
        .map((user: any) => [this.objectIdToString(user?._id), user?.fullName || 'Nguoi dung'] as const)
        .filter(([id]) => !!id) as Array<[string, string]>,
    );
  }

  private formatSessionHistoryValue(
    field: string,
    value: unknown,
    teacherNameMap: Map<string, string>,
  ): string {
    if (value === undefined || value === null) {
      return this.emptyHistoryValue();
    }

    if (typeof value === 'string' && !value.trim()) {
      return this.emptyHistoryValue();
    }

    switch (field) {
      case 'teacherId': {
        const teacherId = this.objectIdToString(value);
        if (!teacherId) return this.emptyHistoryValue();
        return teacherNameMap.get(teacherId) || teacherId;
      }
      case 'scheduledDate':
        return this.formatDateForHistory(value);
      case 'durationMinutes':
        return `${this.toSafeNumber(value, 0)} phut`;
      case 'amountCharged':
      case 'teacherPayout':
        return `${this.toSafeNumber(value, 0).toLocaleString('vi-VN')}d`;
      case 'autoConfirmAfterHours':
        return `${this.toSafeNumber(value, 0)} gio`;
      case 'sessionType':
        return this.formatSessionTypeLabel(String(value));
      default:
        return String(value);
    }
  }

  private async buildRemainingSessionsAtNewDurationSnapshot(
    session: SessionDocument,
    newDurationMinutes: number,
  ) {
    const classroom = await this.classModel
      .findById(session.classId)
      .select('pricingSnapshot baseDuration')
      .lean();

    const fallbackReferenceDuration =
      this.toSafeNumber((classroom as any)?.pricingSnapshot?.referenceDuration, 0)
      || this.toSafeNumber((classroom as any)?.baseDuration, 60)
      || 60;

    const invoices = await this.invoiceModel
      .find({
        classId: session.classId,
        studentId: session.studentId,
        status: { $nin: [InvoiceStatus.CANCELLED, InvoiceStatus.REJECTED] },
      })
      .select('referenceDuration sessionsRemaining bonusSessionsRemaining trialSessionsRemaining')
      .lean();

    let paidRemainingMinutes = 0;
    let bonusRemainingMinutes = 0;
    let trialRemainingMinutes = 0;
    for (const invoice of invoices as any[]) {
      const referenceDuration =
        this.toSafeNumber(invoice?.referenceDuration, fallbackReferenceDuration) || fallbackReferenceDuration;
      paidRemainingMinutes += this.toSafeNumber(invoice?.sessionsRemaining, 0) * referenceDuration;
      bonusRemainingMinutes += this.toSafeNumber(invoice?.bonusSessionsRemaining, 0) * referenceDuration;
      trialRemainingMinutes += this.toSafeNumber(invoice?.trialSessionsRemaining, 0) * referenceDuration;
    }

    const totalRemainingMinutes = paidRemainingMinutes + bonusRemainingMinutes + trialRemainingMinutes;

    return {
      newDurationMinutes,
      paidRemainingMinutes: this.roundTo2(paidRemainingMinutes),
      bonusRemainingMinutes: this.roundTo2(bonusRemainingMinutes),
      totalRemainingMinutes: this.roundTo2(totalRemainingMinutes),
      paidSessionsRemaining:
        newDurationMinutes > 0 ? this.floorSessionCount(paidRemainingMinutes / newDurationMinutes) : 0,
      bonusSessionsRemaining:
        newDurationMinutes > 0 ? this.floorSessionCount(bonusRemainingMinutes / newDurationMinutes) : 0,
      totalSessionsRemaining:
        newDurationMinutes > 0 ? this.floorSessionCount(totalRemainingMinutes / newDurationMinutes) : 0,
    };
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
      const beforeValue = this.formatSessionHistoryValue(field, beforeRaw, teacherNameMap);
      const afterValue = this.formatSessionHistoryValue(field, afterRaw, teacherNameMap);
      if (beforeValue === afterValue) {
        return;
      }

      changes.push({
        field,
        label: this.getSessionEditFieldLabel(field),
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

  private extractErrorMessage(err: unknown): string {
    if (typeof err === 'string') return err;
    if (err instanceof Error) return err.message;
    if (err && typeof (err as any).message === 'string') {
      return (err as any).message;
    }
    return 'Unknown error';
  }

  private normalizeText(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }

  private isWalletInsufficientError(err: unknown): boolean {
    const normalized = this.normalizeText(this.extractErrorMessage(err));
    return (
      normalized.includes('gioi han no') ||
      normalized.includes('can nap them tien') ||
      normalized.includes('insufficient') ||
      normalized.includes('not enough')
    );
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
        `[Availability] Failed to check teacher availability: ${this.extractErrorMessage(err)}`,
      );
    }
  }

  private async notifyWalletLowBalance(
    session: SessionDocument,
    classroom: any | null,
    reason: string,
  ): Promise<void> {
    try {
      const student = await this.studentModel
        .findById(session.studentId)
        .select('fullName saleId parentUserId')
        .lean();

      const parentId =
        this.objectIdToString(session.parentUserId) ||
        this.objectIdToString((student as any)?.parentUserId);
      if (!parentId) return;

      const saleId =
        this.objectIdToString(classroom?.sale) ||
        this.objectIdToString((student as any)?.saleId);
      const sessionId = this.objectIdToString(session._id) || '';
      const classCode = classroom?.code ? `${classroom.code}` : '';
      const studentName = (student as any)?.fullName || 'Hoc sinh';
      const amount = this.toSafeNumber(session.amountCharged, 0).toLocaleString('vi-VN');
      const parentMessage = classCode
        ? `Vi khong du so du de tru ${amount}d cho buoi hoc lop ${classCode}. Vui long nap them tien.`
        : `Vi khong du so du de tru ${amount}d cho buoi hoc. Vui long nap them tien.`;

      await this.notificationsService.create({
        recipientId: parentId,
        recipientRole: Role.PARENT,
        type: NotificationType.WALLET_LOW_BALANCE,
        priority: NotificationPriority.HIGH,
        title: 'Vi khong du so du',
        message: parentMessage,
        targetId: sessionId,
        targetModule: 'SESSIONS',
      });

      if (saleId && saleId !== parentId) {
        const saleMessage = classCode
          ? `${studentName} (lop ${classCode}) khong du so du vi cho buoi hoc ${amount}d. Sale can lien he ho tro.`
          : `${studentName} khong du so du vi cho buoi hoc ${amount}d. Sale can lien he ho tro.`;

        await this.notificationsService.create({
          recipientId: saleId,
          recipientRole: Role.SALE,
          type: NotificationType.WALLET_LOW_BALANCE,
          priority: NotificationPriority.HIGH,
          title: 'Can cham soc nap vi',
          message: saleMessage,
          targetId: sessionId,
          targetModule: 'SESSIONS',
        });
      }
    } catch (notifyErr) {
      this.logger.warn(
        `Failed to send low wallet notifications for session ${session._id}: ${this.extractErrorMessage(
          notifyErr,
        )}`,
      );
      this.logger.debug(`Low wallet reason: ${reason}`);
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
      (s: any) => this.objectIdToString(s) === dto.studentId,
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

    const studentParentId = this.objectIdToString((student as any).parentUserId);
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
      const conflictResult = await this.checkConflicts({
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
      this.toSafeNumber(
        getDurationForStudentAt(classroom, dto.studentId, scheduledDate).sessionDuration,
        0,
      ) ||
      this.toSafeNumber(getClassPricingConfigAt(classroom, scheduledDate).sessionDuration, 60) ||
      60;
    const durationMinutes = dto.durationMinutes ?? defaultDuration;
    const pricing = this.resolveSessionFinancials(classroom, durationMinutes, scheduledDate);
    const amountCharged =
      dto.amountCharged !== undefined
        ? this.roundMoneyToThousand(dto.amountCharged)
        : pricing.amountCharged;
    const teacherPayout =
      dto.teacherPayout !== undefined
        ? this.roundMoneyDownToThousand(dto.teacherPayout)
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
  //  QUERY / FIND
  // ──────────────────────────────────────────────────────────────────

  async findAll(query: QuerySessionDto) {
    const filter: FilterQuery<Session> = {};

    if (query.classId) filter.classId = new Types.ObjectId(query.classId);
    if (query.studentId) filter.studentId = new Types.ObjectId(query.studentId);
    if (query.teacherId) filter.teacherId = new Types.ObjectId(query.teacherId);
    if (query.parentUserId) filter.parentUserId = new Types.ObjectId(query.parentUserId);
    if (query.status) filter.status = query.status;

    // Lọc theo báo cáo giảng dạy
    if ((query as any).hasReport === 'true') filter.hasTeachingReport = true;
    if ((query as any).hasReport === 'false') {
      filter.hasTeachingReport = { $ne: true } as any;
      // Chỉ lọc các status hợp lệ (đã dạy rồi)
      if (!query.status) {
        filter.status = { $in: [
          SessionStatus.TEACHER_COMPLETED,
          SessionStatus.PARENT_CONFIRMED,
          SessionStatus.FINALIZED,
        ] } as any;
      }
    }

    if (query.fromDate || query.toDate) {
      filter.scheduledDate = {};
      if (query.fromDate) filter.scheduledDate.$gte = new Date(query.fromDate);
      if (query.toDate) filter.scheduledDate.$lte = new Date(query.toDate);
    }

    const page = Number(query.page) || 1;
    const limit = Math.min(Number(query.limit) || 20, 100);
    const skip = (page - 1) * limit;
    const sort = query.sort || '-scheduledDate';

    const [data, total] = await Promise.all([
      this.sessionModel
        .find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate('classId', 'name code')
        .populate('studentId', 'fullName studentCode')
        .populate('teacherId', 'fullName email')
        .lean(),
      this.sessionModel.countDocuments(filter),
    ]);

    const attendanceBySessionId = new Map<
      string,
      { attendedAt?: Date | null; status?: AttendanceStatus | null }
    >();

    if (data.length > 0) {
      const sessionIds = data.map((session) => session._id as Types.ObjectId);
      const attendanceRows = await this.attendanceModel
        .find({ sessionId: { $in: sessionIds } })
        .sort({ attendedAt: -1, updatedAt: -1, createdAt: -1 })
        .select('sessionId attendedAt status')
        .lean();

      for (const row of attendanceRows as any[]) {
        const sessionId = row?.sessionId?.toString();
        if (!sessionId || attendanceBySessionId.has(sessionId)) continue;
        attendanceBySessionId.set(sessionId, {
          attendedAt: row?.attendedAt || null,
          status: row?.status || null,
        });
      }
    }

    const teacherPayoutOverrides = await this.buildTeacherPayoutOverrideMap(data as any[]);

    return {
      data: data.map((session: any) => {
        const sessionId = this.objectIdToString(session._id);
        const attendance = attendanceBySessionId.get(sessionId || '');
        return {
          ...session,
          teacherPayout:
            (sessionId ? teacherPayoutOverrides.get(sessionId) : undefined)
            ?? session.teacherPayout,
          attendedAt: attendance?.attendedAt || null,
          attendanceStatus: attendance?.status || null,
        };
      }),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findById(id: string, actor?: JwtPayload): Promise<SessionDocument> {
    const session = await this.sessionModel
      .findById(id)
      .populate('classId', 'name code pricePerSession teacherPayPerSession cancelPolicy')
      .populate('studentId', 'fullName studentCode parentUserId parentName parentPhone')
      .populate('teacherId', 'fullName email phone')
      .populate('parentUserId', 'fullName email phone')
      .populate('createdBy', 'fullName')
      .populate('editHistory.editedByUserId', 'fullName role');

    if (!session) throw new NotFoundException('Buổi học không tồn tại');

    // Ownership check for PARENT and TEACHER
    if (actor?.role === Role.PARENT) {
      const parentOwnerId = await this.resolveParentUserIdForSession({
        parentUserId: session.parentUserId as any,
        studentId: session.studentId as any,
      });
      if (!parentOwnerId || parentOwnerId !== actor.sub) {
        throw new NotFoundException('Buoi hoc khong ton tai');
      }
    } else if (actor?.role === Role.TEACHER) {
      const teacherOwnerId = this.objectIdToString(session.teacherId as any);
      if (!teacherOwnerId || teacherOwnerId !== actor.sub) {
        throw new NotFoundException('Buoi hoc khong ton tai');
      }
    }

    if (this.toSafeNumber(session.teacherPayout, 0) <= 0 && !this.shouldKeepZeroTeacherPayout(session)) {
      const classroomId = this.objectIdToString(session.classId);
      const classroom = await this.classModel
        .findById(classroomId)
        .select(
          'classMode pricingSnapshot durationSnapshots pricePerSession teacherPayPerSession teacherPayPerStudent baseDuration sessionDuration',
        )
        .lean();
      const fallbackTeacherPayout = this.computeTeacherPayoutFallback(session, classroom);
      if (fallbackTeacherPayout > 0) {
        session.teacherPayout = fallbackTeacherPayout;
      }
    }

    return session;
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

    const studentId = this.objectIdToString(session.studentId);
    if (!studentId) {
      throw new BadRequestException('Session khong co hoc sinh hop le');
    }

    if (!this.isTeacherAssignedToClassOnDate(classroom, nextTeacherId, scheduledDate, studentId)) {
      throw new BadRequestException('Giao vien khong phu trach lop nay trong ngay duoc chon');
    }

    if (nextStartTime && nextEndTime) {
      const conflictResult = await this.checkConflicts({
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
        ? this.resolveSessionFinancials(classroom, nextDurationMinutes, scheduledDate)
        : null;

    const normalizedAmountCharged =
      dto.amountCharged !== undefined
        ? this.roundMoneyToThousand(dto.amountCharged)
        : undefined;
    const normalizedTeacherPayout =
      dto.teacherPayout !== undefined
        ? this.roundMoneyDownToThousand(dto.teacherPayout)
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
      [this.objectIdToString(session.teacherId), dto.teacherId].filter(
        (value): value is string => !!value,
      ),
    );

    const durationSnapshot =
      dto.durationMinutes !== undefined && dto.durationMinutes !== session.durationMinutes
        ? await this.buildRemainingSessionsAtNewDurationSnapshot(session, dto.durationMinutes)
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
  //  TEACHER COMPLETE  (SCHEDULED → TEACHER_COMPLETED)
  // ──────────────────────────────────────────────────────────────────

  async teacherComplete(
    sessionId: string,
    teacherUserId: string,
    dto: CompleteSessionDto,
  ): Promise<SessionDocument> {
    const session = await this.sessionModel.findById(sessionId);
    if (!session) throw new NotFoundException('Buổi học không tồn tại');

    if (session.status !== SessionStatus.SCHEDULED) {
      throw new BadRequestException(
        `Không thể hoàn thành buổi học ở trạng thái ${session.status}`,
      );
    }

    // Verify teacher owns this session
    if (session.teacherId.toString() !== teacherUserId) {
      throw new ForbiddenException('Bạn không phải GV của buổi học này');
    }

    // Update legacy content
    if (dto.topicsCovered) session.topicsCovered = dto.topicsCovered;
    if (dto.homework) session.homework = dto.homework;
    if (dto.teacherNotes) session.teacherNotes = dto.teacherNotes;
    if (dto.actualStartTime) session.actualStartTime = new Date(dto.actualStartTime);
    if (dto.actualEndTime) session.actualEndTime = new Date(dto.actualEndTime);

    // Build evaluation (đánh giá buổi học chi tiết)
    const evaluation = session.evaluation || {} as any;
    if (dto.lessonObjective) evaluation.lessonObjective = dto.lessonObjective;
    if (dto.lessonContent) evaluation.lessonContent = dto.lessonContent;
    if (dto.materialsUsed) evaluation.materialsUsed = dto.materialsUsed;
    if (dto.skillsTaught) evaluation.skillsTaught = dto.skillsTaught;
    if (dto.studentPerformance) evaluation.studentPerformance = dto.studentPerformance;
    if (dto.studentEngagement) evaluation.studentEngagement = dto.studentEngagement;
    if (dto.comprehensionLevel) evaluation.comprehensionLevel = dto.comprehensionLevel;
    if (dto.strengthsObserved) evaluation.strengthsObserved = dto.strengthsObserved;
    if (dto.areasOfImprovement) evaluation.areasOfImprovement = dto.areasOfImprovement;
    if (dto.homeworkAssigned) {
      evaluation.homeworkAssigned = dto.homeworkAssigned;
      evaluation.homeworkStatus = 'ASSIGNED';
    }
    if (dto.homeworkDeadline) evaluation.homeworkDeadline = new Date(dto.homeworkDeadline);
    if (dto.progressPercent !== undefined) evaluation.progressPercent = dto.progressPercent;
    if (dto.curriculumItemsCompleted) evaluation.curriculumItemsCompleted = dto.curriculumItemsCompleted;
    if (dto.nextSessionPlan) evaluation.nextSessionPlan = dto.nextSessionPlan;
    if (dto.overallComment) evaluation.overallComment = dto.overallComment;
    session.evaluation = evaluation;

    // Status transition
    session.status = SessionStatus.TEACHER_COMPLETED;
    session.confirmation.teacherCompletedAt = new Date();

    const savedSession = await session.save();
    await this.ensureAttendanceForCompletedSession(savedSession);
    this.triggerStudentSupportSnapshotRefreshForSession(savedSession, 'teacherComplete');
    return savedSession;
  }

  // ──────────────────────────────────────────────────────────────────
  //  TEACHING REPORT (Báo cáo giảng dạy — bắt buộc để tính lương)
  // ──────────────────────────────────────────────────────────────────

  /**
   * GV nộp báo cáo giảng dạy cho 1 buổi học.
   * Deadline: trong vòng 24h sau buổi học.
   * Nộp muộn sẽ bị đánh dấu và cảnh báo.
   * Chỉ sessions có teachingReport mới được tính lương.
   *
   * FIX FREEZE: Không cho phép sửa báo cáo nếu PayrollTransaction đã APPROVED/PAID.
   * Điều này đảm bảo tính toàn vẹn dữ liệu cho kiểm toán sau khi kế toán đã chốt sổ.
   */
  async submitTeachingReport(
    sessionId: string,
    teacherUserId: string,
    dto: SubmitTeachingReportDto,
  ): Promise<SessionDocument> {
    const session = await this.sessionModel.findById(sessionId);
    if (!session) throw new NotFoundException('Buổi học không tồn tại');

    // Chỉ GV của buổi học mới được nộp báo cáo
    if (session.teacherId.toString() !== teacherUserId) {
      throw new ForbiddenException('Bạn không phải GV của buổi học này');
    }

    // Chỉ cho phép nộp báo cáo cho buổi đã hoàn thành
    const allowedForReport = [
      SessionStatus.TEACHER_COMPLETED,
      SessionStatus.PARENT_CONFIRMED,
      SessionStatus.FINALIZED,
    ];
    if (!allowedForReport.includes(session.status)) {
      throw new BadRequestException(
        'Chỉ nộp báo cáo cho buổi học đã hoàn thành',
      );
    }

    // ─── FIX FREEZE: Check PayrollTransaction status ─────────────────────
    // Không cho phép sửa báo cáo nếu lương đã được duyệt/chi trả
    const existingPayrollTx = await this.payrollTxService.getBySessionId(sessionId);
    if (existingPayrollTx) {
      const lockedStatuses = ['APPROVED', 'PAID'];
      if (lockedStatuses.includes(existingPayrollTx.status)) {
        throw new BadRequestException(
          `Không thể sửa báo cáo - Lương buổi học này đã được ${
            existingPayrollTx.status === 'PAID' ? 'thanh toán' : 'duyệt'
          }. Vui lòng liên hệ kế toán nếu cần điều chỉnh.`,
        );
      }
    }

    // Tính deadline (TEACHING_REPORT_DEADLINE_HOURS sau scheduledDate) — dùng UTC để tránh lệch timezone
    const deadline = new Date(session.scheduledDate);
    deadline.setUTCHours(deadline.getUTCHours() + TEACHING_REPORT_DEADLINE_HOURS);

    const now = new Date();
    const isLate = now > deadline;
    const lateHours = isLate 
      ? Math.floor((now.getTime() - deadline.getTime()) / (1000 * 60 * 60))
      : 0;

    // Kiểm tra nếu đã có báo cáo → update version
    const isUpdate = session.hasTeachingReport && session.teachingReport;
    const currentVersion = session.teachingReport?.version || 0;

    session.teachingReport = {
      lessonContent: dto.lessonContent,
      studentAttitude: dto.studentAttitude,
      recordingUrl: dto.recordingUrl,
      teacherComment: dto.teacherComment,
      homework: dto.homework,
      additionalNotes: dto.additionalNotes,
      submittedAt: isUpdate ? session.teachingReport!.submittedAt : now,
      deadline,
      isLateSubmission: isUpdate ? session.teachingReport!.isLateSubmission : isLate,
      lateSubmissionHours: isUpdate ? session.teachingReport!.lateSubmissionHours : lateHours,
      version: currentVersion + 1,
      lastUpdatedAt: now,
    };
    session.hasTeachingReport = true;

    if (this.toSafeNumber(session.teacherPayout, 0) <= 0 && !this.shouldKeepZeroTeacherPayout(session)) {
      const classroomId = this.objectIdToString(session.classId);
      const classroom = await this.classModel
        .findById(classroomId)
        .select(
          'classMode pricingSnapshot durationSnapshots pricePerSession teacherPayPerSession teacherPayPerStudent baseDuration sessionDuration',
        )
        .lean();
      const fallbackTeacherPayout = this.computeTeacherPayoutFallback(session, classroom);
      if (fallbackTeacherPayout > 0) {
        session.teacherPayout = fallbackTeacherPayout;
      }
    }

    // Log warning nếu nộp muộn
    if (isLate && !isUpdate) {
      this.logger.warn(
        `Late teaching report submission: Session ${sessionId} by teacher ${teacherUserId} - ${lateHours}h late`,
      );
    }

    this.logger.log(
      `Teaching report ${isUpdate ? 'updated' : 'submitted'} for session ${sessionId} by teacher ${teacherUserId} (version ${currentVersion + 1})`,
    );

    const savedSession = await session.save();

    // ─── Tạo PayrollTransaction khi lần đầu nộp báo cáo ───────────────
    // Chỉ tạo khi submit lần đầu (không phải update)
    // PayrollTransaction sẽ tự động tính penalty nếu nộp trễ
    if (
      !isUpdate &&
      savedSession.teacherPayout &&
      savedSession.teacherPayout > 0 &&
      !(savedSession.sessionType === 'TRIAL' && (savedSession as any).trialRejectedNoPay)
    ) {
      try {
        await this.payrollTxService.createFromSession({
          teacherId: savedSession.teacherId.toString(),
          sessionId: savedSession._id.toString(),
          classId: savedSession.classId.toString(),
          studentId: savedSession.studentId.toString(),
          sessionDate: savedSession.scheduledDate,
          baseSalary: savedSession.teacherPayout,
          isLateReport: isLate,
          lateHours,
          reportDeadline: deadline,
          reportSubmittedAt: now,
          createdBy: teacherUserId,
        });
      } catch (err) {
        // Log error but don't fail the teaching report submission
        this.logger.error(
          `Failed to create PayrollTransaction for session ${sessionId}: ${(err as Error).message}`,
        );
      }
    }

    this.triggerStudentSupportSnapshotRefreshForSession(savedSession, 'submitTeachingReport');
    return savedSession;
  }

  /**
   * Nộp báo cáo giảng dạy cho TẤT CẢ sessions của lớp OFFLINE trong 1 ngày.
   * Dùng cho lớp nhóm để GV không phải nộp từng báo cáo riêng lẻ.
   *
   * FIX FREEZE: Skip các session có PayrollTransaction đã APPROVED/PAID.
   */
  async bulkSubmitTeachingReport(
    classId: string,
    date: string,
    teacherUserId: string,
    dto: BulkTeachingReportDto,
  ): Promise<{ updatedCount: number; skippedCount: number; results: { sessionId: string; status: string; action: string }[] }> {
    const classObjectId = new Types.ObjectId(classId);

    // Parse date thành range [start, end) của ngày UTC
    const dayStart = new Date(date);
    dayStart.setUTCHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

    // Query tất cả sessions của lớp này trong ngày, do GV này dạy
    const sessions = await this.sessionModel.find({
      classId: classObjectId,
      teacherId: new Types.ObjectId(teacherUserId),
      scheduledDate: { $gte: dayStart, $lt: dayEnd },
      status: {
        $in: [
          SessionStatus.TEACHER_COMPLETED,
          SessionStatus.PARENT_CONFIRMED,
          SessionStatus.FINALIZED,
        ],
      },
    }).lean();

    if (sessions.length === 0) {
      throw new NotFoundException(
        `Không tìm thấy buổi học nào cho lớp ${classId} ngày ${date} của giáo viên này`,
      );
    }

    // ─── FIX FREEZE: Batch check PayrollTransaction status ─────────────
    // Lấy tất cả sessions đã có PayrollTransaction APPROVED/PAID để skip
    const sessionIds = sessions.map((s) => s._id.toString());
    const lockedSessionIds = new Set<string>();
    for (const sid of sessionIds) {
      const payrollTx = await this.payrollTxService.getBySessionId(sid);
      if (payrollTx && ['APPROVED', 'PAID'].includes(payrollTx.status)) {
        lockedSessionIds.add(sid);
      }
    }

    const now = new Date();
    const results: { sessionId: string; status: string; action: string }[] = [];
    let updatedCount = 0;
    let skippedCount = 0;

    for (const sess of sessions) {
      const sessionIdStr = sess._id.toString();

      // FIX FREEZE: Skip sessions có PayrollTransaction đã APPROVED/PAID
      if (lockedSessionIds.has(sessionIdStr)) {
        results.push({ sessionId: sessionIdStr, status: sess.status, action: 'SKIPPED_LOCKED' });
        skippedCount++;
        continue;
      }

      // Skip sessions đã bị thanh toán (isTeacherPaid=true) để tránh ghi đè sau khi lương đã khóa
      if ((sess as any).isTeacherPaid) {
        results.push({ sessionId: sessionIdStr, status: sess.status, action: 'SKIPPED_PAID' });
        skippedCount++;
        continue;
      }

      const deadline = new Date(sess.scheduledDate);
      deadline.setUTCHours(deadline.getUTCHours() + TEACHING_REPORT_DEADLINE_HOURS);
      const isLate = now > deadline;
      const lateHours = isLate
        ? Math.floor((now.getTime() - deadline.getTime()) / (1000 * 60 * 60))
        : 0;

      const isUpdate = (sess as any).hasTeachingReport && (sess as any).teachingReport;
      const currentVersion = (sess as any).teachingReport?.version || 0;

      await this.sessionModel.findByIdAndUpdate(sess._id, {
        $set: {
          teachingReport: {
            lessonContent: dto.lessonContent,
            studentAttitude: dto.studentAttitude,
            recordingUrl: dto.recordingUrl,
            teacherComment: dto.teacherComment,
            homework: dto.homework,
            additionalNotes: dto.additionalNotes,
            submittedAt: isUpdate ? (sess as any).teachingReport.submittedAt : now,
            deadline,
            isLateSubmission: isUpdate ? (sess as any).teachingReport.isLateSubmission : isLate,
            lateSubmissionHours: isUpdate ? (sess as any).teachingReport.lateSubmissionHours : lateHours,
            version: currentVersion + 1,
            lastUpdatedAt: now,
          },
          hasTeachingReport: true,
        },
      });

      results.push({ sessionId: sess._id.toString(), status: sess.status, action: isUpdate ? 'UPDATED' : 'SUBMITTED' });
      updatedCount++;
    }

    this.logger.log(
      `Bulk teaching report by teacher ${teacherUserId} for class ${classId} on ${date}: updated=${updatedCount}, skipped=${skippedCount}`,
    );

    if (updatedCount > 0) {
      this.triggerStudentSupportSnapshotRefreshForSessions(
        sessions.filter(
          (session) =>
            !lockedSessionIds.has(session._id.toString()) && !(session as any).isTeacherPaid,
        ),
        'bulkSubmitTeachingReport',
      );
    }

    return { updatedCount, skippedCount, results };
  }

  // ──────────────────────────────────────────────────────────────────
  //  PARENT CONFIRM  (TEACHER_COMPLETED → PARENT_CONFIRMED)
  // ──────────────────────────────────────────────────────────────────

  async parentConfirm(
    sessionId: string,
    parentUserId: string,
    dto: ConfirmSessionDto,
  ): Promise<SessionDocument> {
    const session = await this.sessionModel.findById(sessionId);
    if (!session) throw new NotFoundException('Buổi học không tồn tại');

    if (session.status !== SessionStatus.TEACHER_COMPLETED) {
      throw new BadRequestException(
        'Chỉ xác nhận được buổi học đã được GV hoàn thành',
      );
    }

    const hasRequiredTeachingReport =
      session.hasTeachingReport
      && !!session.teachingReport?.lessonContent?.trim();
    if (!hasRequiredTeachingReport) {
      throw new BadRequestException(
        'Ch\u1ec9 x\u00e1c nh\u1eadn \u0111\u01b0\u1ee3c khi bu\u1ed5i h\u1ecdc \u0111\u00e3 c\u00f3 b\u00e1o c\u00e1o gi\u1ea3ng d\u1ea1y',
      );
    }

    // Verify parent owns this student (fallback to student.parentUserId when session.parentUserId is missing)
    const ownerParentId = await this.resolveParentUserIdForSession({
      parentUserId: session.parentUserId,
      studentId: session.studentId,
    });
    if (!ownerParentId || ownerParentId !== parentUserId) {
      throw new ForbiddenException('Ban khong phai PH cua hoc sinh nay');
    }
    const resolvedParentRating = dto.parentRating ?? dto.rating;
    const resolvedOverallRating = dto.overallRating ?? dto.rating;

    // Legacy fields
    if (dto.parentNotes) session.parentNotes = dto.parentNotes;
    if (resolvedParentRating !== undefined) session.parentRating = resolvedParentRating;

    // Build parentFeedback (phản hồi chi tiết từ PH)
    const feedback = session.parentFeedback || {} as any;
    if (dto.parentNotes) feedback.parentNotes = dto.parentNotes;
    if (resolvedOverallRating !== undefined) feedback.overallRating = resolvedOverallRating;
    if (dto.teachingQualityRating) feedback.teachingQualityRating = dto.teachingQualityRating;
    if (dto.communicationRating) feedback.communicationRating = dto.communicationRating;
    if (dto.concerns) feedback.concerns = dto.concerns;
    if (dto.isSatisfied !== undefined) feedback.isSatisfied = dto.isSatisfied;
    session.parentFeedback = feedback;

    // ─── Đánh giá & Phân luồng xử lý ─────────────────────────────
    const shouldHoldSalary =
      dto.isSatisfied === false ||
      (resolvedOverallRating !== undefined && resolvedOverallRating <= 2);

    // Xác định trạng thái tiếp theo: bị khiếu nại -> giữ nguyên PARENT_CONFIRMED
    const nextStatus = shouldHoldSalary ? SessionStatus.PARENT_CONFIRMED : SessionStatus.FINALIZED;

    const updatePayload: any = {
      status: nextStatus,
      parentNotes: dto.parentNotes || session.parentNotes,
      parentRating: resolvedParentRating ?? session.parentRating,
      parentFeedback: session.parentFeedback,
      'confirmation.parentConfirmedAt': new Date(),
    };

    // Chỉ ghi nhận finalizedAt nếu chuyển sang trạng thái FINALIZED
    if (!shouldHoldSalary) {
      updatePayload['confirmation.finalizedAt'] = new Date();
    }

    // Dùng atomic transition để tránh race condition với autoConfirm cron
    const updated = await this.sessionModel.findOneAndUpdate(
      { _id: sessionId, status: SessionStatus.TEACHER_COMPLETED },
      { $set: updatePayload },
      { new: true },
    );
    if (!updated) {
      throw new BadRequestException('Buổi học đã được chốt bởi hệ thống');
    }

      // CHỈ TRỪ VÍ NẾU PHỤ HUYNH HÀI LÒNG VÀ BUỔI HỌC ĐÃ ĐƯỢC FINALIZED
      if (!shouldHoldSalary) {
        await this.settleFinalizedSession(updated);
      }

    // ─── Khiếu nại: tạo Ticket cho OPS và đóng băng lương GV ──────
    if (shouldHoldSalary) {
      try {
        const holdDescription = dto.isSatisfied === false
          ? `Phụ huynh không hài lòng: ${dto.concerns || 'Không có lý do cụ thể'}`
          : `Đánh giá tổng quan thấp: ${dto.overallRating}/5 sao`;

        // 1. Tự động sinh Ticket ưu tiên cao cho OPS
        const ticket = await this.ticketsService.create(
          {
            type: TicketType.PARENT_COMPLAINT,
            priority: TicketPriority.HIGH,
            subject: `[Tự động] Khiếu nại lớp ${(updated.classId as any)?.code || 'N/A'} - Đánh giá kém`,
            description: `Phụ huynh đánh giá thấp buổi học ngày ${updated.scheduledDate.toLocaleDateString('vi-VN')}.\nLý do hệ thống ghi nhận: ${holdDescription}\n\nGhi chú của phụ huynh: ${dto.parentNotes || 'Không có'}\n\nĐề nghị OPS liên hệ phụ huynh để tìm hiểu nguyên nhân, sau đó chốt buổi học hoặc hủy/hoàn tiền.`,
            sessionId: updated._id.toString(),
            classId: updated.classId.toString(),
            studentId: updated.studentId.toString(),
            teacherId: updated.teacherId.toString(),
          },
          parentUserId,
          Role.PARENT,
        );

        // 2. Đóng băng lương và gắn vào Ticket để Kế toán nắm thông tin
        await this.payrollTxService.holdSalary(
          updated._id.toString(),
          HoldReason.PARENT_REJECTED,
          holdDescription,
          parentUserId,
          ticket._id.toString(),
        );

        this.logger.warn(
          `Ticket ${ticket.ticketCode} created and PayrollTransaction HELD for session ${sessionId}: ${holdDescription}`,
        );
      } catch (err) {
        // Log error but don't fail the confirmation
        this.logger.error(
          `Failed to create complaint ticket or hold salary for session ${sessionId}: ${(err as Error).message}`,
        );
      }
    }

    this.triggerStudentSupportSnapshotRefreshForSession(updated, 'parentConfirm');
    return updated;
  }

  // ──────────────────────────────────────────────────────────────────
  //  OPS/DIRECTOR MANUAL FINALIZE
  // ──────────────────────────────────────────────────────────────────

  async manualFinalize(sessionId: string, userId: string): Promise<SessionDocument> {
    const session = await this.sessionModel.findById(sessionId);
    if (!session) throw new NotFoundException('Buổi học không tồn tại');

    // Session đã FINALIZED bởi system/parent: cho phép OPS/DIRECTOR đóng dấu xác nhận payroll.
    const hasRequiredTeachingReport =
      session.hasTeachingReport
      && !!session.teachingReport?.lessonContent?.trim();
    if (!hasRequiredTeachingReport) {
      throw new BadRequestException(
        'Chỉ xác nhận lương được khi buổi học đã có báo cáo giảng dạy đầy đủ',
      );
    }

    if (session.status === SessionStatus.FINALIZED) {
      if (session.confirmation?.finalizedBy) {
        return session;
      }

      const setPayload: Record<string, any> = {
        'confirmation.finalizedBy': new Types.ObjectId(userId),
      };
      if (!session.confirmation?.finalizedAt) {
        setPayload['confirmation.finalizedAt'] = new Date();
      }

      const confirmed = await this.sessionModel.findOneAndUpdate(
        {
          _id: sessionId,
          status: SessionStatus.FINALIZED,
          $or: [
            { 'confirmation.finalizedBy': { $exists: false } },
            { 'confirmation.finalizedBy': null },
          ],
        },
        { $set: setPayload },
        { new: true },
      );

      if (confirmed) {
        return confirmed;
      }

      const reloaded = await this.sessionModel.findById(sessionId);
      if (!reloaded) throw new NotFoundException('Buổi học không tồn tại');
      return reloaded;
    }

    const allowedStatuses = [
      SessionStatus.TEACHER_COMPLETED,
      SessionStatus.PARENT_CONFIRMED,
    ];
    if (!allowedStatuses.includes(session.status)) {
      throw new BadRequestException(
        `Không thể chốt buổi học ở trạng thái ${session.status}`,
      );
    }

    // Atomic status transition để tránh double finalization
    const updated = await this.sessionModel.findOneAndUpdate(
      {
        _id: sessionId,
        status: { $in: [SessionStatus.TEACHER_COMPLETED, SessionStatus.PARENT_CONFIRMED] },
      },
      {
        $set: {
          status: SessionStatus.FINALIZED,
          'confirmation.finalizedAt': new Date(),
          'confirmation.finalizedBy': new Types.ObjectId(userId),
        },
      },
      { new: true },
    );

    if (!updated) {
      throw new BadRequestException(
        'Buổi học đã được chốt bởi hệ thống hoặc người dùng khác',
      );
    }

      await this.settleFinalizedSession(updated);

    this.triggerStudentSupportSnapshotRefreshForSession(updated, 'manualFinalize');
    return updated;
  }

  // ──────────────────────────────────────────────────────────────────
  //  CANCEL SESSION
  // ──────────────────────────────────────────────────────────────────

  async cancel(
    sessionId: string,
    userId: string,
    userRole: Role,
    dto: CancelSessionDto,
  ): Promise<SessionDocument> {
    const session = await this.sessionModel.findById(sessionId);
    if (!session) throw new NotFoundException('Buổi học không tồn tại');

    // Cannot cancel already finalized/cancelled sessions
    if (
      [SessionStatus.FINALIZED, SessionStatus.CANCELLED, SessionStatus.RESCHEDULED].includes(
        session.status,
      )
    ) {
      throw new BadRequestException(
        `Không thể hủy buổi học ở trạng thái ${session.status}`,
      );
    }

    // PARENT cannot cancel sessions that teacher already completed
    if (userRole === Role.PARENT && session.status === SessionStatus.TEACHER_COMPLETED) {
      throw new BadRequestException(
        'Giáo viên đã hoàn thành buổi học, phụ huynh không thể hủy. Vui lòng liên hệ OPS.',
      );
    }

    // Determine who cancelled
    let cancelledByRole: CancelledByRole;
    if (userRole === Role.TEACHER) {
      cancelledByRole = CancelledByRole.TEACHER;
      // Verify teacher owns this session
      if (session.teacherId && session.teacherId.toString() !== userId) {
        throw new ForbiddenException('Bạn không phải giáo viên của buổi học này');
      }
    } else if (userRole === Role.PARENT) {
      cancelledByRole = CancelledByRole.PARENT;
      // Verify parent owns this student
      const ownerParentId = await this.resolveParentUserIdForSession({
        parentUserId: session.parentUserId,
        studentId: session.studentId,
      });
      if (!ownerParentId || ownerParentId !== userId) {
        throw new ForbiddenException('Ban khong phai PH cua hoc sinh nay');
      }
    } else {
      cancelledByRole = CancelledByRole.OPS;
    }

    // Calculate refund based on cancel policy from class
    const classroom = await this.classModel.findById(session.classId).lean();
    const policy = classroom?.cancelPolicy;
    const hoursBeforeSession = this.calcHoursBefore(session.scheduledDate, session.scheduledStartTime);
    const isLate = policy ? hoursBeforeSession < policy.hoursBeforeSession : false;

    // Zero-Sum Cancel: luôn hoàn 100%, không phạt hủy muộn
    const originalAmountCharged = session.amountCharged; // Lưu lại số tiền gốc trước khi về 0
    const refundPercent = 100;
    const refundAmount = originalAmountCharged; // Hoàn toàn bộ số tiền đã charge

    session.status = SessionStatus.CANCELLED;
    session.amountCharged = 0; // KHÔNG THU TIỀN PH: hủy buổi không tính doanh thu
    session.teacherPayout = 0; // KHÔNG TRẢ LƯƠNG GV: hủy buổi không tính lương
    session.cancellation = {
      cancelledBy: cancelledByRole,
      cancelledByUserId: new Types.ObjectId(userId),
      cancelReason: dto.cancelReason,
      cancelledAt: new Date(),
      refundPercent: 100,
      refundAmount,
      isLateCancellation: isLate,
    };

    const saved = await session.save();

    // Hoàn tiền vào ví PH - CHỈ KHI đã trừ tiền trước đó (isPaid = true)
    if (refundAmount > 0 && session.parentUserId && session.isPaid) {
      try {
        await this.walletsService.refundForSession({
          parentUserId: session.parentUserId.toString(),
          sessionId: saved._id.toString(),
          classId: session.classId.toString(),
          studentId: session.studentId.toString(),
          refundAmount,
        });
      } catch (err) {
        this.logger.warn(`Refund failed for session ${saved._id}: ${(err as Error).message}`);
      }
    }

    this.triggerStudentSupportSnapshotRefreshForSession(saved, 'cancelSession');
    return saved;
  }

  // ──────────────────────────────────────────────────────────────────
  //  RESCHEDULE (dời lịch)
  // ──────────────────────────────────────────────────────────────────

  async reschedule(
    sessionId: string,
    actor: JwtPayload,
    dto: RescheduleSessionDto,
  ): Promise<{ oldSession: SessionDocument; newSession: SessionDocument }> {
    const oldSession = await this.sessionModel.findById(sessionId);
    if (!oldSession) throw new NotFoundException('Buoi hoc khong ton tai');
    const actorId = actor?.sub ?? actor?._id;
    if (oldSession.status !== SessionStatus.SCHEDULED) {
      throw new BadRequestException(
        'Chi doi lich duoc buoi o trang thai SCHEDULED',
      );
    }

    if (actor?.role === Role.TEACHER && oldSession.teacherId.toString() !== actorId) {
      throw new ForbiddenException('Ban khong phai giao vien cua buoi hoc nay');
    }

    // Check max reschedules from class policy
    const classroom = await this.classModel.findById(oldSession.classId).lean();
    if (classroom?.cancelPolicy && !classroom.cancelPolicy.allowReschedule) {
      throw new BadRequestException('Lớp này không cho phép dời lịch');
    }

    // Create new session with new schedule
    const newSession = await this.create(
      {
        classId: oldSession.classId.toString(),
        studentId: oldSession.studentId.toString(),
        teacherId: oldSession.teacherId.toString(),
        parentUserId: oldSession.parentUserId?.toString(),
        scheduledDate: dto.newScheduledDate,
        scheduledStartTime: dto.newStartTime,
        scheduledEndTime: dto.newEndTime,
        durationMinutes: dto.durationMinutes ?? oldSession.durationMinutes,
        sessionType: (oldSession as any).sessionType,
        amountCharged: oldSession.amountCharged,
        teacherPayout: oldSession.teacherPayout,
        sessionNumber: oldSession.sessionNumber,
      },
      actorId,
      actor,
      { skipSnapshotRefresh: true },
    );

    // Link old ↔ new
    newSession.rescheduledFromId = oldSession._id as Types.ObjectId;
    await newSession.save();

    oldSession.status = SessionStatus.RESCHEDULED;
    oldSession.rescheduledToId = newSession._id as Types.ObjectId;
    await oldSession.save();

    await this.refreshStudentSupportSnapshotForSession(oldSession, 'rescheduleSession');
    return { oldSession, newSession };
  }

  // ──────────────────────────────────────────────────────────────────
  //  MARK NO-SHOW
  // ──────────────────────────────────────────────────────────────────

  async markNoShow(sessionId: string, actor: JwtPayload): Promise<SessionDocument> {
    const session = await this.sessionModel.findById(sessionId);
    if (!session) throw new NotFoundException('Buổi học không tồn tại');

    if (session.status !== SessionStatus.SCHEDULED) {
      throw new BadRequestException(
        'Chỉ đánh dấu vắng được buổi SCHEDULED',
      );
    }

    if (actor?.role === Role.TEACHER && session.teacherId.toString() !== actor.sub) {
      throw new ForbiddenException('Ban khong phai giao vien cua buoi hoc nay');
    }
    session.status = SessionStatus.NO_SHOW;
    session.amountCharged = 0; // KHÔNG THU TIỀN PH: vắng mặt không tính phí
    session.teacherPayout = 0; // KHÔNG TRẢ LƯƠNG GV: vắng mặt không tính lương
    const saved = await session.save();

    return saved;
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
  //  STATS (thống kê nhanh)
  // ──────────────────────────────────────────────────────────────────

  async getStats(filter: { teacherId?: string; classId?: string; fromDate?: string; toDate?: string }) {
    const match: FilterQuery<Session> = {};
    if (filter.teacherId) match.teacherId = new Types.ObjectId(filter.teacherId);
    if (filter.classId) match.classId = new Types.ObjectId(filter.classId);
    if (filter.fromDate || filter.toDate) {
      match.scheduledDate = {};
      if (filter.fromDate) match.scheduledDate.$gte = new Date(filter.fromDate);
      if (filter.toDate) match.scheduledDate.$lte = new Date(filter.toDate);
    }

    const result = await this.sessionModel.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalCharged: { $sum: '$amountCharged' },
          totalPayout: { $sum: '$teacherPayout' },
        },
      },
    ]);

    // Flatten into a summary object
    const summary: Record<string, { count: number; totalCharged: number; totalPayout: number }> = {};
    for (const r of result) {
      summary[r._id] = {
        count: r.count,
        totalCharged: r.totalCharged,
        totalPayout: r.totalPayout,
      };
    }

    const totalSessions = result.reduce((acc, r) => acc + r.count, 0);
    const totalRevenue = result.reduce((acc, r) => acc + r.totalCharged, 0);
    let totalTeacherCost = result.reduce((acc, r) => acc + r.totalPayout, 0);

    const zeroPayoutSessions = await this.sessionModel
      .find({ ...match, teacherPayout: { $lte: 0 } })
      .select('_id classId scheduledDate durationMinutes teacherPayout status')
      .lean();
    const teacherPayoutOverrides = await this.buildTeacherPayoutOverrideMap(zeroPayoutSessions as any[]);
    for (const session of zeroPayoutSessions as any[]) {
      const sessionId = this.objectIdToString(session._id);
      const overrideTeacherPayout = sessionId ? teacherPayoutOverrides.get(sessionId) : undefined;
      if (!overrideTeacherPayout || overrideTeacherPayout <= 0) continue;

      const statusKey = String(session.status || '');
      if (!summary[statusKey]) {
        summary[statusKey] = {
          count: 0,
          totalCharged: 0,
          totalPayout: 0,
        };
      }

      summary[statusKey].totalPayout += overrideTeacherPayout;
      totalTeacherCost += overrideTeacherPayout;
    }

    return { totalSessions, totalRevenue, totalTeacherCost, byStatus: summary };
  }

  // ──────────────────────────────────────────────────────────────────
  //  CRON: AUTO-CONFIRM
  //  Chạy mỗi giờ, tìm sessions TEACHER_COMPLETED quá X giờ → FINALIZED
  // ──────────────────────────────────────────────────────────────────

  @Cron(CronExpression.EVERY_HOUR)
  async autoConfirmSessions() {
    const now = new Date();

    // Find sessions in TEACHER_COMPLETED with teacherCompletedAt + autoConfirmAfterHours < now
    const sessions = await this.sessionModel.find({
      status: SessionStatus.TEACHER_COMPLETED,
      'confirmation.teacherCompletedAt': { $exists: true },
      hasTeachingReport: true,
      'teachingReport.lessonContent': { $exists: true, $ne: '' },
    });

    let confirmed = 0;
    const autoConfirmedSessions: Array<{ parentUserId?: any; studentId?: any }> = [];
    for (const session of sessions) {
      if (!session.confirmation?.teacherCompletedAt) continue;

      const deadline = new Date(session.confirmation.teacherCompletedAt);
      deadline.setHours(deadline.getHours() + session.autoConfirmAfterHours);

      if (now >= deadline) {
        // Atomic transition to prevent race with parentConfirm
        const updated = await this.sessionModel.findOneAndUpdate(
          { _id: session._id, status: SessionStatus.TEACHER_COMPLETED },
          {
            $set: {
              status: SessionStatus.FINALIZED,
              'confirmation.autoConfirmedAt': now,
              'confirmation.finalizedAt': now,
            },
          },
          { new: true },
        );
        if (!updated) continue; // Already finalized by parent

          await this.settleFinalizedSession(updated);
          autoConfirmedSessions.push(updated);

        confirmed++;
      }
    }

    if (autoConfirmedSessions.length) {
      this.triggerStudentSupportSnapshotRefreshForSessions(
        autoConfirmedSessions,
        'autoConfirmSessions',
      );
    }

    if (confirmed > 0) {
      this.logger.log(`Auto-confirmed ${confirmed} sessions`);
    }
  }

  // ──────────────────────────────────────────────────────────────────
  //  Recovery: FINALIZED but isPaid = false → retry wallet deduction
  // ──────────────────────────────────────────────────────────────────

  @Cron(CronExpression.EVERY_2_HOURS)
  async retryUnpaidFinalizedSessions() {
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - 1); // Only retry sessions finalized > 1h ago

    const sessions = await this.sessionModel.find({
      status: SessionStatus.FINALIZED,
      isPaid: false,
      isBonusSession: false,
      amountCharged: { $gt: 0 },
      parentUserId: { $exists: true },
      'confirmation.finalizedAt': { $lt: cutoff },
    }).limit(50); // Process in batches

    let recovered = 0;
    for (const session of sessions) {
      // Skip unconverted trials
      if (session.sessionType === 'TRIAL' && !session.trialConverted) continue;

      await this.settleFinalizedSession(session);
      const reloaded = await this.sessionModel.findById(session._id).select('isPaid isBonusSession').lean();
      if ((reloaded as any)?.isPaid || (reloaded as any)?.isBonusSession) recovered++;
    }

    if (recovered > 0) {
      this.logger.log(`Recovery: retried wallet deduction for ${recovered} sessions`);
    }
  }

  /**
   * Backfill dữ liệu cũ:
   * - Session đã FINALIZED nhưng chưa consume invoice (sessionsRemaining)
   * - Chạy định kỳ để tự sửa dữ liệu lịch sử sau khi deploy
   */
  @Cron(CronExpression.EVERY_6_HOURS)
  async backfillInvoiceConsumptionForFinalizedSessions() {
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - 1);

    const sessions = await this.sessionModel.find({
      status: SessionStatus.FINALIZED,
      invoiceConsumptionApplied: false,
      $and: [
        {
          $or: [
            { isPaid: true, amountCharged: { $gt: 0 } },
            { isBonusSession: true, referenceAmountCharged: { $gt: 0 } },
          ],
        },
        {
          $or: [{ sessionType: { $ne: 'TRIAL' } }, { trialConverted: true }],
        },
      ],
      'confirmation.finalizedAt': { $lt: cutoff },
    })
      .select('_id')
      .limit(100);

    let applied = 0;
    for (const session of sessions) {
      await this.applyInvoiceConsumptionForSession(session._id as Types.ObjectId);
      const reloaded = await this.sessionModel
        .findById(session._id)
        .select('invoiceConsumptionApplied')
        .lean();
      if ((reloaded as any)?.invoiceConsumptionApplied) applied++;
    }

    if (applied > 0) {
      this.logger.log(`Backfill: applied invoice consumption for ${applied} finalized sessions`);
    }
  }

  // ──────────────────────────────────────────────────────────────────
  //  CRON: AUTO-DECIDE ORPHAN TRIAL SESSIONS
  //  Buổi thử cần được Sale/OPS chốt thủ công.
  //  Không auto-mark teacher-paid-only nữa để tránh trả lương sai rule học thử.
  // ──────────────────────────────────────────────────────────────────

  @Cron(CronExpression.EVERY_12_HOURS)
  async autoDecideOrphanTrialSessions() {
    this.logger.debug(
      `Skip auto-deciding orphan trial sessions after ${TRIAL_AUTO_DECIDE_DAYS} days; awaiting explicit trial decision`,
    );
  }

  // ──────────────────────────────────────────────────────────────────
  //  CRON: NHẮC NHỞ BÁO CÁO GIẢNG DẠY TRỄ HẠN
  //  Chạy mỗi giờ, tìm sessions đã dạy xong quá 24h nhưng chưa nộp báo cáo
  // ──────────────────────────────────────────────────────────────────

  @Cron(CronExpression.EVERY_HOUR)
  async checkLateTeachingReports() {
    const now = new Date();
    // Tìm các buổi học đã dạy xong quá 24h nhưng chưa nộp báo cáo
    const deadlineThreshold = new Date(now.getTime() - TEACHING_REPORT_DEADLINE_HOURS * 60 * 60 * 1000);

    const lateSessions = await this.sessionModel
      .find({
        status: {
          $in: [
            SessionStatus.TEACHER_COMPLETED,
            SessionStatus.PARENT_CONFIRMED,
            SessionStatus.FINALIZED,
          ],
        },
        hasTeachingReport: false,
        scheduledDate: { $lte: deadlineThreshold },
        isTeacherPaid: false, // Chưa tính lương → còn có thể cứu
      })
      .select('_id teacherId scheduledDate')
      .limit(100); // Xử lý theo batch để tránh quá tải

    if (lateSessions.length === 0) return;

    let notified = 0;
    for (const session of lateSessions) {
      try {
        await this.notificationsService.create({
          recipientId: session.teacherId.toString(),
          type: NotificationType.SYSTEM,
          priority: NotificationPriority.HIGH,
          title: 'Báo cáo giảng dạy trễ hạn',
          message: `Buổi học ngày ${session.scheduledDate.toLocaleDateString('vi-VN')} chưa được nộp báo cáo. Vui lòng nộp để được tính lương.`,
          targetId: (session._id as Types.ObjectId).toString(),
          targetModule: 'Session',
        });
        notified++;
      } catch (err) {
        this.logger.warn(`Failed to send late-report notification for session ${session._id}: ${err}`);
      }
    }

    if (notified > 0) {
      this.logger.warn(`Sent ${notified} late teaching report reminder notifications`);
    }
  }

  // ──────────────────────────────────────────────────────────────────
  //  HELPERS
  // ──────────────────────────────────────────────────────────────────

  /**
   * Tính số giờ còn lại trước buổi học
   */
  private calcHoursBefore(scheduledDate: Date, scheduledStartTime?: string): number {
    const sessionStart = new Date(scheduledDate);
    if (scheduledStartTime) {
      const [h, m] = scheduledStartTime.split(':').map(Number);
      sessionStart.setHours(h, m, 0, 0);
    } else {
      // Nếu không có giờ cụ thể, dùng đầu ngày
      sessionStart.setHours(0, 0, 0, 0);
    }

    const now = new Date();
    const diffMs = sessionStart.getTime() - now.getTime();
    return diffMs / (1000 * 60 * 60);
  }

  private roundTo4(value: number): number {
    return Math.round(value * 10000) / 10000;
  }

  private getSessionCoverageAmount(session: any): number {
    const referenceAmount = this.toSafeNumber(session?.referenceAmountCharged, 0);
    if (referenceAmount > 0) {
      return referenceAmount;
    }
    return this.toSafeNumber(session?.amountCharged, 0);
  }

  private buildInvoiceConsumptionReset() {
    return {
      $set: {
        invoiceConsumptionApplied: false,
        consumedInvoiceUnits: 0,
        consumedInvoiceAmount: 0,
        consumedBonusUnits: 0,
        consumedBonusAmount: 0,
      },
      $unset: {
        consumedInvoiceId: 1,
        bonusInvoiceId: 1,
      },
    };
  }

  private async hasInvoiceCoverageForAmount(
    session: SessionDocument,
    allowanceField: 'sessionsRemaining' | 'bonusSessionsRemaining' | 'trialSessionsRemaining',
  ): Promise<boolean> {
    const coverageAmount = this.getSessionCoverageAmount(session);
    if (coverageAmount <= 0) {
      return false;
    }

    let remainingAmount = coverageAmount;
    const invoices = await this.invoiceModel
      .find({
        studentId: session.studentId,
        classId: session.classId,
        status: 'APPROVED',
        [allowanceField]: { $gt: 0 },
      })
      .sort({ paymentDate: 1, createdAt: 1 })
      .select(`_id ${allowanceField} pricePerSession`)
      .lean();

    for (const invoice of invoices) {
      if (remainingAmount <= 0) {
        break;
      }

      const pricePerSession = this.toSafeNumber((invoice as any).pricePerSession, 0);
      const remainingUnits = this.toSafeNumber((invoice as any)[allowanceField], 0);
      if (pricePerSession <= 0 || remainingUnits <= 0) {
        continue;
      }

      const amountCovered = Math.min(
        remainingAmount,
        this.roundTo2(remainingUnits * pricePerSession),
      );
      if (amountCovered <= 0) {
        continue;
      }

      remainingAmount = Math.max(0, this.roundTo2(remainingAmount - amountCovered));
    }

    return remainingAmount <= 0;
  }

  private async tryMarkBonusSession(session: SessionDocument): Promise<SessionDocument | null> {
    if (!session.parentUserId || session.isPaid || session.isBonusSession) {
      return null;
    }

    if (session.sessionType === 'TRIAL' && !session.trialConverted) {
      return null;
    }

    const coverageAmount = this.getSessionCoverageAmount(session);
    if (coverageAmount <= 0) {
      return null;
    }

    const hasPaidCoverage = await this.hasInvoiceCoverageForAmount(session, 'sessionsRemaining');
    if (hasPaidCoverage) {
      return null;
    }

    const hasBonusCoverage = await this.hasInvoiceCoverageForAmount(session, 'bonusSessionsRemaining');
    if (!hasBonusCoverage) {
      return null;
    }

    const updated = await this.sessionModel.findOneAndUpdate(
      {
        _id: session._id,
        status: SessionStatus.FINALIZED,
        isPaid: false,
        isBonusSession: false,
      },
      {
        $set: {
          isBonusSession: true,
          amountCharged: 0,
          referenceAmountCharged: coverageAmount,
        },
        $unset: {
          walletDeductError: 1,
          walletDeductAlertSentAt: 1,
        },
      },
      { new: true },
    );

    if (updated) {
      this.logger.log(`Session ${session._id} marked as complimentary bonus session`);
    }

    return updated;
  }

  private async settleFinalizedSession(session: SessionDocument): Promise<void> {
    if (session.status !== SessionStatus.FINALIZED) {
      return;
    }

    await this.ensureSessionParentUserId(session);

    const bonusSession = await this.tryMarkBonusSession(session);
    const sessionToSettle = bonusSession || session;

    if (!sessionToSettle.isBonusSession) {
      await this.deductWalletForSession(sessionToSettle);
    }

    await this.applyInvoiceConsumptionForSession(sessionToSettle._id as Types.ObjectId);
  }

  private async consumeInvoiceAllowanceForAmount(
    claim: any,
    allowanceField: 'sessionsRemaining' | 'bonusSessionsRemaining' | 'trialSessionsRemaining',
  ): Promise<{
    primaryInvoiceId: Types.ObjectId | null;
    consumedUnits: number;
    consumedAmount: number;
    remainingAmount: number;
  }> {
    const coverageAmount = this.getSessionCoverageAmount(claim);
    let remainingAmount = coverageAmount;
    let consumedAmount = 0;
    let consumedUnits = 0;
    let primaryInvoiceId: Types.ObjectId | null = null;

    const invoices = await this.invoiceModel
      .find({
        studentId: claim.studentId,
        classId: claim.classId,
        status: 'APPROVED',
        [allowanceField]: { $gt: 0 },
      })
      .sort({ paymentDate: 1, createdAt: 1 })
      .select(`_id ${allowanceField} pricePerSession`)
      .lean();

    if (!invoices.length) {
      return { primaryInvoiceId, consumedUnits, consumedAmount, remainingAmount };
    }

    for (const inv of invoices) {
      if (remainingAmount <= 0) {
        break;
      }

      const pricePerSession = this.toSafeNumber((inv as any).pricePerSession, 0);
      const invoiceRemaining = this.toSafeNumber((inv as any)[allowanceField], 0);
      if (pricePerSession <= 0 || invoiceRemaining <= 0) {
        continue;
      }

      let unitsToConsume = this.roundTo2(
        Math.min(invoiceRemaining, remainingAmount / pricePerSession),
      );
      if (unitsToConsume <= 0) {
        continue;
      }

      let updateResult = await this.invoiceModel.updateOne(
        { _id: (inv as any)._id, [allowanceField]: { $gte: unitsToConsume } },
        { $inc: { [allowanceField]: -unitsToConsume } },
      );

      if (!updateResult.modifiedCount) {
        const latestInvoice = await this.invoiceModel
          .findById((inv as any)._id)
          .select(allowanceField)
          .lean();
        const latestRemaining = this.toSafeNumber((latestInvoice as any)?.[allowanceField], 0);
        const fallbackUnits = this.roundTo2(Math.min(latestRemaining, unitsToConsume));
        if (fallbackUnits <= 0) {
          continue;
        }

        updateResult = await this.invoiceModel.updateOne(
          { _id: (inv as any)._id, [allowanceField]: { $gte: fallbackUnits } },
          { $inc: { [allowanceField]: -fallbackUnits } },
        );
        if (!updateResult.modifiedCount) {
          continue;
        }
        unitsToConsume = fallbackUnits;
      }

      const amountToConsume = Math.min(
        remainingAmount,
        this.roundTo2(unitsToConsume * pricePerSession),
      );
      if (amountToConsume <= 0) {
        continue;
      }

      if (!primaryInvoiceId) {
        primaryInvoiceId = (inv as any)._id as Types.ObjectId;
      }
      consumedAmount += amountToConsume;
      consumedUnits += unitsToConsume;
      remainingAmount = Math.max(0, this.roundTo2(remainingAmount - amountToConsume));
    }

    return {
      primaryInvoiceId,
      consumedUnits: this.roundTo2(consumedUnits),
      consumedAmount: Math.round(consumedAmount),
      remainingAmount,
    };
  }

  /**
   * Tiêu hao suất học của invoice theo giá trị buổi học đã chốt.
   * Quy ước:
   * - Session trả phí consume vào sessionsRemaining
   * - Session buổi tặng consume vào bonusSessionsRemaining
   * - Trial đã convert consume vào trialSessionsRemaining
   * - FIFO theo paymentDate/createdAt của invoice APPROVED
   * - Idempotent qua cờ session.invoiceConsumptionApplied
   */
  private async applyInvoiceConsumptionForSession(sessionId: string | Types.ObjectId): Promise<void> {
    const sid = typeof sessionId === 'string' ? new Types.ObjectId(sessionId) : sessionId;

    const claim = await this.sessionModel
      .findOneAndUpdate(
        {
          _id: sid,
          status: SessionStatus.FINALIZED,
          invoiceConsumptionApplied: false,
          $and: [
            {
              $or: [
                { isPaid: true, amountCharged: { $gt: 0 } },
                { isBonusSession: true, referenceAmountCharged: { $gt: 0 } },
              ],
            },
            {
              $or: [{ sessionType: { $ne: 'TRIAL' } }, { trialConverted: true }],
            },
          ],
        },
        { $set: { invoiceConsumptionApplied: true } },
        { new: true },
      )
      .select('_id studentId classId amountCharged referenceAmountCharged isBonusSession sessionType')
      .lean();

    if (!claim) return;

    const isBonusSession = !!(claim as any).isBonusSession;
    const coverageAmount = this.getSessionCoverageAmount(claim);
    const resetPayload = this.buildInvoiceConsumptionReset();

    if (coverageAmount <= 0) {
      await this.sessionModel.updateOne({ _id: sid }, resetPayload);
      return;
    }

    let allowanceField = isBonusSession ? 'bonusSessionsRemaining' : 'sessionsRemaining';
    let allowanceLabel = isBonusSession ? 'bonus sessions' : 'remaining sessions';
    if ((claim as any).sessionType === 'TRIAL') {
      allowanceField = 'trialSessionsRemaining';
      allowanceLabel = 'trial sessions';
    }

    try {
      const consumptionResult = await this.consumeInvoiceAllowanceForAmount(
        claim,
        allowanceField as any,
      );

      if (consumptionResult.consumedAmount <= 0) {
        await this.sessionModel.updateOne({ _id: sid }, resetPayload);
        this.logger.warn(
          `Invoice consumption skipped: no APPROVED invoice with ${allowanceLabel} for session ${sid.toString()}`,
        );
        return;
      }

      await this.sessionModel.updateOne(
        { _id: sid },
        isBonusSession
          ? {
              $set: {
                bonusInvoiceId: consumptionResult.primaryInvoiceId || undefined,
                consumedBonusUnits: consumptionResult.consumedUnits,
                consumedBonusAmount: consumptionResult.consumedAmount,
                consumedInvoiceUnits: 0,
                consumedInvoiceAmount: 0,
              },
              $unset: { consumedInvoiceId: 1 },
            }
          : {
              $set: {
                consumedInvoiceId: consumptionResult.primaryInvoiceId || undefined,
                consumedInvoiceUnits: consumptionResult.consumedUnits,
                consumedInvoiceAmount: consumptionResult.consumedAmount,
                consumedBonusUnits: 0,
                consumedBonusAmount: 0,
              },
              $unset: { bonusInvoiceId: 1 },
            },
      );

      if (consumptionResult.remainingAmount > 0) {
        this.logger.warn(
          `Invoice consumption partial for session ${sid.toString()}: consumed ${Math.round(consumptionResult.consumedAmount)} / ${Math.round(coverageAmount)}`,
        );
      }
    } catch (err) {
      await this.sessionModel.updateOne({ _id: sid }, resetPayload);
      this.logger.warn(
        `Invoice consumption failed for session ${sid.toString()}: ${this.extractErrorMessage(err)}`,
      );
    }
  }

  /**
   * Trừ ví PH khi session FINALIZED.
   * - Trial sessions: chỉ trừ ví nếu trialConverted = true
   * - Trial không convert: không trừ ví, nhưng GV vẫn được trả lương
   */
  private async deductWalletForSession(session: SessionDocument): Promise<void> {
    if (!session.parentUserId || session.isPaid || session.isBonusSession || session.amountCharged <= 0) return;

    // Trial chua convert => khong tru vi PH (GV van duoc tra qua payroll)
    if (session.sessionType === 'TRIAL' && !session.trialConverted) {
      this.logger.log(
        `Session ${session._id} is TRIAL (not converted) - skipping wallet deduction, teacher will still be paid`,
      );
      return;
    }

    // Atomic check-and-set isPaid to prevent double deduction (race condition)
    const updated = await this.sessionModel.findOneAndUpdate(
      { _id: session._id, isPaid: false },
      { $set: { isPaid: true } },
      { new: true },
    );

    if (!updated) {
      this.logger.log(`Session ${session._id} already paid, skipping deduction`);
      return;
    }

    let classroom: any | null = null;

    try {
      classroom = await this.classModel
        .findById(session.classId)
        .select('pricePerSession pricingSnapshot sale code')
        .lean();
      const pricePerSessionForDebtLimit = this.resolveClassPricing(classroom).pricePerSession;

      await this.walletsService.deductForSession({
        parentUserId: session.parentUserId.toString(),
        sessionId: (session._id as Types.ObjectId).toString(),
        classId: session.classId.toString(),
        studentId: session.studentId.toString(),
        amount: session.amountCharged,
        pricePerSession: pricePerSessionForDebtLimit,
      });

      await this.sessionModel.updateOne(
        { _id: session._id },
        { $unset: { walletDeductError: 1 } },
      );
    } catch (err) {
      const errorMessage = this.extractErrorMessage(err);
      const shouldNotify =
        this.isWalletInsufficientError(err) && !updated.walletDeductAlertSentAt;

      const rollbackPayload: Record<string, unknown> = {
        isPaid: false,
        walletDeductError: errorMessage,
      };
      if (shouldNotify) {
        rollbackPayload.walletDeductAlertSentAt = new Date();
      }

      await this.sessionModel.updateOne(
        { _id: session._id },
        { $set: rollbackPayload },
      );

      if (shouldNotify) {
        await this.notifyWalletLowBalance(updated, classroom, errorMessage);
      }

      this.logger.warn(
        `Wallet deduct failed for session ${session._id}: ${errorMessage}`,
      );
    }
  }

  // ──────────────────────────────────────────────────────────────────
  //  TRIAL SESSION: Convert buổi thử thành buổi trả phí
  // ──────────────────────────────────────────────────────────────────

  /**
   * Khi HS quyết định học tiếp sau buổi thử:
   * - Mark trialConverted = true
   * - Trigger trừ ví PH cho tất cả buổi TRIAL đã FINALIZED
   */
  async convertTrialSessions(
    studentId: string,
    classId: string,
  ): Promise<{ converted: number; deducted: number }> {
    await this.ensureOfflineTrialClass(classId);

    const trialSessions = await this.sessionModel.find({
      studentId: new Types.ObjectId(studentId),
      classId: new Types.ObjectId(classId),
      sessionType: 'TRIAL',
      trialConverted: false,
      status: { $nin: [SessionStatus.CANCELLED, SessionStatus.RESCHEDULED] },
    });

    let converted = 0;
    let deducted = 0;

    for (const session of trialSessions) {
      session.trialConverted = true;
      session.trialTeacherPaidOnly = false;
      (session as any).trialRejectedNoPay = false;
      await session.save();
      converted++;

      if (session.status !== SessionStatus.FINALIZED) {
        continue;
      }

      await this.settleFinalizedSession(session);
      // Reload to get updated isPaid from atomic deductWalletForSession
      const reloaded = await this.sessionModel.findById(session._id).lean();
      if (reloaded?.isPaid) deducted++;
    }

    this.logger.log(
      `Trial conversion: student ${studentId} class ${classId} → ${converted} sessions converted, ${deducted} wallet deductions`,
    );

    return { converted, deducted };
  }

  async markTrialRejectedNoPay(
    studentId: string,
    classId: string,
    actorUserId?: string,
  ): Promise<{ updated: number; excludedPayroll: number }> {
    await this.ensureOfflineTrialClass(classId);

    const trialSessions = await this.sessionModel.find(
      {
        studentId: new Types.ObjectId(studentId),
        classId: new Types.ObjectId(classId),
        sessionType: 'TRIAL',
        trialConverted: false,
        trialRejectedNoPay: false,
      },
    );

    let updated = 0;
    let excludedPayroll = 0;
    for (const session of trialSessions) {
      session.trialTeacherPaidOnly = false;
      (session as any).trialRejectedNoPay = true;
      session.isTeacherPaid = false;
      await session.save();
      updated++;

      if (actorUserId) {
        try {
          await this.payrollTxService.excludeFromPayroll(
            session._id.toString(),
            actorUserId,
            'Hoc thu khong chuyen doi thanh hoc vien chinh thuc',
          );
          excludedPayroll++;
        } catch (error) {
          const message = this.extractErrorMessage(error);
          if (!message.includes('PayrollTransaction not found')) {
            this.logger.warn(
              `Failed to exclude payroll for rejected trial session ${session._id}: ${message}`,
            );
          }
        }
      }
    }

    this.logger.log(
      `Trial rejected-no-pay: student ${studentId} class ${classId} → ${updated} sessions, ${excludedPayroll} payroll exclusions`,
    );

    return { updated, excludedPayroll };
  }

  /**
   * Route cũ được giữ lại để tương thích nhưng nghiệp vụ mới là KHÔNG tính lương GV
   * nếu học thử không chuyển đổi.
   */
  async markTrialTeacherPaidOnly(
    studentId: string,
    classId: string,
    actorUserId?: string,
  ): Promise<{ updated: number; excludedPayroll: number }> {
    return this.markTrialRejectedNoPay(studentId, classId, actorUserId);
  }

  // ──────────────────────────────────────────────────────────────────
  //  PARENT: Children Progress (P1)
  // ──────────────────────────────────────────────────────────────────

  /**
   * Aggregate tiến độ học tập của tất cả con theo parentUserId.
   * Trả về: evaluation scores, homework pending, curriculum progress, teacher comments.
   */
  async getChildrenProgress(parentUserId: string) {
    const parentObjId = new Types.ObjectId(parentUserId);

    // Tìm tất cả học sinh của phụ huynh
    const children = await this.studentModel
      .find({ parentUserId: parentObjId })
      .select('fullName studentCode grade subjects')
      .lean();

    if (!children.length) return { children: [] };

    const childIds = children.map((c) => c._id);

    // Lấy tất cả sessions có evaluation hoặc teachingReport
    const sessions = await this.sessionModel
      .find({
        studentId: { $in: childIds },
        status: { $in: ['TEACHER_COMPLETED', 'PARENT_CONFIRMED', 'FINALIZED'] },
      })
      .select(
        'studentId classId evaluation teachingReport hasTeachingReport scheduledDate status',
      )
      .populate('classId', 'name code curriculum')
      .sort({ scheduledDate: -1 })
      .lean();

    // Group sessions by student
    const sessionsByStudent = new Map<string, any[]>();
    for (const s of sessions) {
      const sid = s.studentId.toString();
      if (!sessionsByStudent.has(sid)) sessionsByStudent.set(sid, []);
      sessionsByStudent.get(sid)!.push(s);
    }

    const result = children.map((child) => {
      const studentSessions = sessionsByStudent.get(child._id.toString()) || [];

      // Tính trung bình evaluation scores
      const withEval = studentSessions.filter(
        (s) => s.evaluation?.studentPerformance,
      );
      const avgPerformance =
        withEval.length > 0
          ? Math.round(
              (withEval.reduce(
                (sum, s) => sum + (s.evaluation.studentPerformance || 0),
                0,
              ) /
                withEval.length) *
                10,
            ) / 10
          : null;
      const avgEngagement =
        withEval.length > 0
          ? Math.round(
              (withEval.reduce(
                (sum, s) => sum + (s.evaluation.studentEngagement || 0),
                0,
              ) /
                withEval.length) *
                10,
            ) / 10
          : null;
      const avgComprehension =
        withEval.length > 0
          ? Math.round(
              (withEval.reduce(
                (sum, s) => sum + (s.evaluation.comprehensionLevel || 0),
                0,
              ) /
                withEval.length) *
                10,
            ) / 10
          : null;

      // Homework pending (assigned nhưng chưa graded)
      const homeworkList = studentSessions
        .filter(
          (s) =>
            s.evaluation?.homeworkAssigned &&
            s.evaluation.homeworkStatus !== 'GRADED',
        )
        .map((s) => ({
          sessionDate: s.scheduledDate,
          className: (s.classId as any)?.name || '',
          homework: s.evaluation.homeworkAssigned,
          deadline: s.evaluation.homeworkDeadline,
          status: s.evaluation.homeworkStatus || 'ASSIGNED',
          score: s.evaluation.homeworkScore,
        }));

      // Recent teacher comments
      const recentComments = studentSessions
        .filter((s) => s.teachingReport?.teacherComment || s.evaluation?.overallComment)
        .slice(0, 10)
        .map((s) => ({
          sessionDate: s.scheduledDate,
          className: (s.classId as any)?.name || '',
          teacherComment: s.teachingReport?.teacherComment || '',
          overallComment: s.evaluation?.overallComment || '',
          progressPercent: s.evaluation?.progressPercent,
        }));

      // Curriculum progress per class
      const classMap = new Map<string, any>();
      for (const s of studentSessions) {
        const cid = (s.classId as any)?._id?.toString();
        if (!cid) continue;
        if (!classMap.has(cid)) {
          const curriculum = (s.classId as any)?.curriculum || [];
          const completed = curriculum.filter((c: any) => c.isCompleted).length;
          classMap.set(cid, {
            classId: cid,
            className: (s.classId as any)?.name || '',
            classCode: (s.classId as any)?.code || '',
            totalItems: curriculum.length,
            completedItems: completed,
            progressPercent:
              curriculum.length > 0
                ? Math.round((completed / curriculum.length) * 100)
                : 0,
          });
        }
      }

      return {
        student: {
          _id: child._id,
          fullName: child.fullName,
          studentCode: child.studentCode,
          grade: child.grade,
          subjects: child.subjects,
        },
        totalSessions: studentSessions.length,
        evaluation: {
          avgPerformance,
          avgEngagement,
          avgComprehension,
          totalEvaluated: withEval.length,
        },
        homework: {
          pending: homeworkList.filter((h) => h.status !== 'GRADED').length,
          list: homeworkList,
        },
        recentComments,
        curriculumProgress: Array.from(classMap.values()),
      };
    });

    return { children: result };
  }

  // ──────────────────────────────────────────────────────────────────
  //  SCHEDULE CONFLICT DETECTION (O1)
  // ──────────────────────────────────────────────────────────────────

  /**
   * Check xung đột lịch cho teacher và student.
   * 2 sessions xung đột nếu cùng ngày VÀ thời gian overlap.
   */
  async checkConflicts(params: {
    teacherId?: string;
    studentId?: string;
    scheduledDate: string;
    scheduledStartTime: string;
    scheduledEndTime: string;
    excludeSessionId?: string;
  }): Promise<{ hasConflict: boolean; conflicts: any[] }> {
    const date = new Date(params.scheduledDate);
    const dayStart = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
    );
    const dayEnd = new Date(dayStart);
    dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

    const conflicts: any[] = [];

    const baseFilter: any = {
      scheduledDate: { $gte: dayStart, $lt: dayEnd },
      status: { $nin: ['CANCELLED', 'RESCHEDULED'] },
      scheduledStartTime: { $exists: true },
      scheduledEndTime: { $exists: true },
    };
    if (params.excludeSessionId) {
      baseFilter._id = { $ne: new Types.ObjectId(params.excludeSessionId) };
    }

    // Check teacher conflicts
    if (params.teacherId) {
      const teacherSessions = await this.sessionModel
        .find({ ...baseFilter, teacherId: new Types.ObjectId(params.teacherId) })
        .populate('studentId', 'fullName studentCode')
        .populate('classId', 'name code')
        .lean();

      for (const s of teacherSessions) {
        if (
          this.isTimeOverlap(
            params.scheduledStartTime,
            params.scheduledEndTime,
            s.scheduledStartTime!,
            s.scheduledEndTime!,
          )
        ) {
          conflicts.push({
            type: 'TEACHER',
            session: s,
            message: `Giáo viên đã có buổi học ${s.scheduledStartTime}-${s.scheduledEndTime} với ${(s.studentId as any)?.fullName || 'HS'} lớp ${(s.classId as any)?.name || ''}`,
          });
        }
      }
    }

    // Check student conflicts
    if (params.studentId) {
      const studentSessions = await this.sessionModel
        .find({ ...baseFilter, studentId: new Types.ObjectId(params.studentId) })
        .populate('teacherId', 'fullName')
        .populate('classId', 'name code')
        .lean();

      for (const s of studentSessions) {
        if (
          this.isTimeOverlap(
            params.scheduledStartTime,
            params.scheduledEndTime,
            s.scheduledStartTime!,
            s.scheduledEndTime!,
          )
        ) {
          conflicts.push({
            type: 'STUDENT',
            session: s,
            message: `Học sinh đã có buổi học ${s.scheduledStartTime}-${s.scheduledEndTime} với GV ${(s.teacherId as any)?.fullName || ''} lớp ${(s.classId as any)?.name || ''}`,
          });
        }
      }
    }

    return { hasConflict: conflicts.length > 0, conflicts };
  }

  /**
   * Kiểm tra 2 khoảng thời gian có overlap không.
   * Format: "HH:mm"
   */
  private isTimeOverlap(
    start1: string,
    end1: string,
    start2: string,
    end2: string,
  ): boolean {
    const toMinutes = (t: string) => {
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m;
    };
    const s1 = toMinutes(start1);
    const e1 = toMinutes(end1);
    const s2 = toMinutes(start2);
    const e2 = toMinutes(end2);
    return s1 < e2 && s2 < e1;
  }

  /**
   * Đếm sessions FINALIZED cho 1 GV trong khoảng thời gian (dùng cho payroll)
   */
  async countFinalizedForPayroll(
    teacherId: string,
    cutoffExclusive: Date,
    mongoSession?: any,
  ): Promise<{ count: number; totalPayout: number; sessions: SessionDocument[] }> {
    let query = this.sessionModel.find({
      teacherId: new Types.ObjectId(teacherId),
      status: SessionStatus.FINALIZED,
      'confirmation.finalizedAt': { $lt: cutoffExclusive },
      isTeacherPaid: false,
      hasTeachingReport: true, // Điều kiện 1: Đã nộp báo cáo giảng dạy
      'teachingReport.lessonContent': { $exists: true, $ne: '' }, // Double-check: lessonContent phải có nội dung
    });
    if (mongoSession) query = query.session(mongoSession);
    const candidateSessions = await query;

    if (candidateSessions.length === 0) {
      return { count: 0, totalPayout: 0, sessions: [] };
    }

    const candidateIds = candidateSessions.map((s) => s._id as Types.ObjectId);
    let attendanceQuery = this.attendanceModel
      .find({
        sessionId: { $in: candidateIds },
        status: { $in: [...COUNTED_ATTENDANCE_STATUSES] },
      })
      .select('sessionId checkedBy');
    if (mongoSession) attendanceQuery = attendanceQuery.session(mongoSession);
    const attendanceRows = await attendanceQuery.lean();

    const attendanceBySessionId = new Map<
      string,
      { hasAttendance: boolean; hasOpsConfirmation: boolean }
    >();
    for (const row of attendanceRows as any[]) {
      const sid = row?.sessionId?.toString();
      if (!sid) continue;
      const previous = attendanceBySessionId.get(sid) || {
        hasAttendance: false,
        hasOpsConfirmation: false,
      };
      attendanceBySessionId.set(sid, {
        hasAttendance: true,
        hasOpsConfirmation: previous.hasOpsConfirmation || !!row?.checkedBy,
      });
    }

    const sessions = candidateSessions.filter((session) => {
      const sid = (session._id as Types.ObjectId).toString();
      const attendanceMeta = attendanceBySessionId.get(sid);
      const hasQualifiedAttendance = !!attendanceMeta?.hasAttendance;
      const confirmedByOpsInAttendance = !!attendanceMeta?.hasOpsConfirmation;
      const confirmedByOpsInSession = !!session.confirmation?.finalizedBy;
      const hasOpsConfirmation = confirmedByOpsInAttendance || confirmedByOpsInSession;
      return hasQualifiedAttendance && hasOpsConfirmation;
    });

    const teacherPayoutOverrides = await this.buildTeacherPayoutOverrideMap(sessions as any[]);
    for (const session of sessions) {
      const sessionId = this.objectIdToString(session._id);
      const overrideTeacherPayout = sessionId ? teacherPayoutOverrides.get(sessionId) : undefined;
      if (overrideTeacherPayout && overrideTeacherPayout > 0) {
        session.teacherPayout = overrideTeacherPayout;
      }
    }

    const totalPayout = sessions.reduce((acc, s) => acc + s.teacherPayout, 0);
    return { count: sessions.length, totalPayout, sessions };
  }

  /**
   * Đánh dấu sessions đã tính lương (sau khi payroll approved)
   */
  async claimTeacherPaid(sessionIds: string[], mongoSession?: any): Promise<void> {
    const objectIds = sessionIds.map((id) => new Types.ObjectId(id));
    const queryOptions = mongoSession ? { session: mongoSession } : undefined;

    let alreadyClaimedQuery = this.sessionModel
      .find({
        _id: { $in: objectIds },
        isTeacherPaid: true,
      })
      .select('_id');
    if (mongoSession) {
      alreadyClaimedQuery = alreadyClaimedQuery.session(mongoSession);
    }

    const alreadyClaimed = await alreadyClaimedQuery.lean();
    if (alreadyClaimed.length > 0) {
      throw new ConflictException(
        `${alreadyClaimed.length} buoi hoc da duoc gan cho bang luong khac`,
      );
    }

    const result = await this.sessionModel.updateMany(
      {
        _id: { $in: objectIds },
        isTeacherPaid: false,
      },
      { $set: { isTeacherPaid: true } },
      queryOptions,
    );

    if (result.modifiedCount !== sessionIds.length) {
      throw new ConflictException(
        'Khong the khoa toan bo buoi hoc cho payroll. Vui long thu lai.',
      );
    }
  }

  async markTeacherPaid(sessionIds: string[], mongoSession?: any): Promise<void> {
    await this.sessionModel.updateMany(
      { _id: { $in: sessionIds.map((id) => new Types.ObjectId(id)) } },
      { $set: { isTeacherPaid: true } },
      mongoSession ? { session: mongoSession } : undefined,
    );
  }

  /**
   * Check which sessions are already claimed (isTeacherPaid = true)
   */
  async checkTeacherPaid(sessionIds: string[]): Promise<string[]> {
    const claimed = await this.sessionModel
      .find({
        _id: { $in: sessionIds.map((id) => new Types.ObjectId(id)) },
        isTeacherPaid: true,
      })
      .select('_id')
      .lean();
    return claimed.map((s) => s._id.toString());
  }

  /**
   * Giải phóng sessions khi payroll bị reject hoặc xóa
   */
  async unmarkTeacherPaid(sessionIds: string[], mongoSession?: any): Promise<void> {
    await this.sessionModel.updateMany(
      { _id: { $in: sessionIds.map((id) => new Types.ObjectId(id)) } },
      { $set: { isTeacherPaid: false } },
      mongoSession ? { session: mongoSession } : undefined,
    );
  }

  /**
   * Đánh dấu sessions đã trừ ví PH
   */
  async markPaid(sessionIds: string[]): Promise<void> {
    await this.sessionModel.updateMany(
      { _id: { $in: sessionIds.map((id) => new Types.ObjectId(id)) } },
      { $set: { isPaid: true } },
    );
  }

  // ════════════════════════════════════════════════════════════════════
  // PARENT FEEDBACK (Phase 3.2)
  // ════════════════════════════════════════════════════════════════════

  async submitParentFeedback(parentUserId: string, feedback: {
    overallRating: number;
    teachingQuality?: number;
    communication?: number;
    facility?: number;
    comment?: string;
    studentId?: string;
    sessionId?: string;
  }) {
    const parentObjId = new Types.ObjectId(parentUserId);

    const filter: any = {
      parentUserId: parentObjId,
      status: SessionStatus.FINALIZED,
    };
    if (feedback.studentId) {
      filter.studentId = new Types.ObjectId(feedback.studentId);
    }

    let session: SessionDocument | null = null;

    if (feedback.sessionId) {
      session = await this.sessionModel.findOne({
        ...filter,
        _id: new Types.ObjectId(feedback.sessionId),
      });
      if (!session) {
        throw new NotFoundException('Bu?i h?c c?n ??nh gi? kh?ng t?n t?i');
      }
    } else {
      // Backward compatibility for older clients that still omit sessionId.
      session = await this.sessionModel
        .findOne(filter)
        .sort({ scheduledDate: -1 });
    }

    if (!session) {
      return { success: true, message: 'Feedback đã được ghi nhận (không có session liên quan)' };
    }

    // Store in top-level parentFeedback for consistency across dashboards/reports
    await this.sessionModel.updateOne(
      { _id: session._id },
      {
        $set: {
          parentFeedback: {
            overallRating: feedback.overallRating,
            teachingQualityRating: feedback.teachingQuality,
            communicationRating: feedback.communication,
            parentNotes: feedback.comment,
          },
        },
      },
    );

    return { success: true, message: 'Cảm ơn bạn đã gửi đánh giá!' };
  }
}

