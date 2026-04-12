import {
  ConflictException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, FilterQuery } from 'mongoose';

import {
  Session,
  SessionDocument,
  SessionStatus,
} from './schemas/session.schema';
import { Classroom, ClassDocument, ClassMode } from '../classes/schemas/class.schema';
import { Invoice, InvoiceDocument, InvoiceStatus } from '../invoices/schemas/invoice.schema';
import {
  Attendance,
  AttendanceDocument,
  COUNTED_ATTENDANCE_STATUSES,
} from '../attendance/schemas/attendance.schema';

import { getClassPricingConfigAt } from '../classes/student-config.utils';

import {
  objectIdToString,
  toSafeNumber,
  roundTo2,
  roundMoneyToThousand,
  roundMoneyDownToThousand,
  floorSessionCount,
  shouldKeepZeroTeacherPayout,
} from './helpers/session.utils';

@Injectable()
export class SessionPayrollService {
  private readonly logger = new Logger(SessionPayrollService.name);

  constructor(
    @InjectModel(Session.name) private sessionModel: Model<SessionDocument>,
    @InjectModel(Classroom.name) private classModel: Model<ClassDocument>,
    @InjectModel(Invoice.name) private invoiceModel: Model<InvoiceDocument>,
    @InjectModel(Attendance.name) private attendanceModel: Model<AttendanceDocument>,
  ) {}

  // ──────────────────────────────────────────────────────────────────
  //  PRICING / FINANCIAL HELPERS
  // ──────────────────────────────────────────────────────────────────

  resolveClassPricing(classroom: any, effectiveAt?: Date | string | null): {
    referenceDuration: number;
    pricePerSession: number;
    teacherPayPerSession: number;
  } {
    const pricing = getClassPricingConfigAt(classroom, effectiveAt);
    const referenceDuration = toSafeNumber(pricing.baseDuration, 60) || 60;
    const pricePerSession = toSafeNumber(pricing.pricePerSession, 0);
    const teacherPayPerSession = toSafeNumber(pricing.teacherPayPerSession, 0);

    return { referenceDuration, pricePerSession, teacherPayPerSession };
  }

  resolveSessionFinancials(
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
      amountCharged: roundMoneyToThousand(pricing.pricePerSession * ratio),
      teacherPayout: roundMoneyDownToThousand(pricing.teacherPayPerSession * ratio),
      pricePerSession: pricing.pricePerSession,
    };
  }

  hasQualifiedTeachingReport(session: {
    hasTeachingReport?: boolean;
    teachingReport?: { lessonContent?: string | null } | null;
  }): boolean {
    return (
      session.hasTeachingReport === true &&
      typeof session.teachingReport?.lessonContent === 'string' &&
      session.teachingReport.lessonContent.trim().length >= 20
    );
  }

  computeTeacherPayoutFallback(
    session: {
      teacherPayout?: number;
      status?: SessionStatus | string;
      scheduledDate?: Date | string | null;
      durationMinutes?: number | null;
      hasTeachingReport?: boolean;
      teachingReport?: { lessonContent?: string | null } | null;
    },
    classroom: any | null,
  ): number {
    if (!this.hasQualifiedTeachingReport(session)) {
      return 0;
    }

    const currentTeacherPayout = toSafeNumber(session.teacherPayout, 0);
    if (currentTeacherPayout > 0 || !classroom || shouldKeepZeroTeacherPayout(session)) {
      return currentTeacherPayout;
    }

    const effectiveAt = session.scheduledDate || undefined;
    const classPricing = getClassPricingConfigAt(classroom, effectiveAt);

    if (classroom.classMode === ClassMode.OFFLINE) {
      return roundMoneyDownToThousand(
        toSafeNumber(classPricing.teacherPayPerStudent, 0),
      );
    }

    const durationMinutes =
      toSafeNumber(session.durationMinutes, classPricing.sessionDuration || 60)
      || classPricing.sessionDuration
      || 60;

    return this.resolveSessionFinancials(classroom, durationMinutes, effectiveAt).teacherPayout;
  }

  async buildTeacherPayoutOverrideMap(
    sessions: Array<{
      _id?: unknown;
      classId?: unknown;
      teacherPayout?: number;
      status?: SessionStatus | string;
      scheduledDate?: Date | string | null;
      durationMinutes?: number | null;
      hasTeachingReport?: boolean;
      teachingReport?: { lessonContent?: string | null } | null;
    }>,
  ): Promise<Map<string, number>> {
    const candidates = sessions.filter((session) => {
      if (!objectIdToString(session._id) || !objectIdToString(session.classId)) {
        return false;
      }
      if (!this.hasQualifiedTeachingReport(session)) {
        return false;
      }
      if (toSafeNumber(session.teacherPayout, 0) > 0) {
        return false;
      }
      return !shouldKeepZeroTeacherPayout(session);
    });

    if (!candidates.length) {
      return new Map<string, number>();
    }

    const classIds = [...new Set(
      candidates
        .map((session) => objectIdToString(session.classId))
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
      const classroomId = objectIdToString(classroom?._id);
      if (!classroomId) continue;
      classroomById.set(classroomId, classroom);
    }

    const overrides = new Map<string, number>();
    for (const session of candidates) {
      const sessionId = objectIdToString(session._id);
      const classId = objectIdToString(session.classId);
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

  async buildRemainingSessionsAtNewDurationSnapshot(
    session: SessionDocument,
    newDurationMinutes: number,
  ) {
    const classroom = await this.classModel
      .findById(session.classId)
      .select('pricingSnapshot baseDuration')
      .lean();

    const fallbackReferenceDuration =
      toSafeNumber((classroom as any)?.pricingSnapshot?.referenceDuration, 0)
      || toSafeNumber((classroom as any)?.baseDuration, 60)
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
        toSafeNumber(invoice?.referenceDuration, fallbackReferenceDuration) || fallbackReferenceDuration;
      paidRemainingMinutes += toSafeNumber(invoice?.sessionsRemaining, 0) * referenceDuration;
      bonusRemainingMinutes += toSafeNumber(invoice?.bonusSessionsRemaining, 0) * referenceDuration;
      trialRemainingMinutes += toSafeNumber(invoice?.trialSessionsRemaining, 0) * referenceDuration;
    }

    const totalRemainingMinutes = paidRemainingMinutes + bonusRemainingMinutes + trialRemainingMinutes;

    return {
      newDurationMinutes,
      paidRemainingMinutes: roundTo2(paidRemainingMinutes),
      bonusRemainingMinutes: roundTo2(bonusRemainingMinutes),
      totalRemainingMinutes: roundTo2(totalRemainingMinutes),
      paidSessionsRemaining:
        newDurationMinutes > 0 ? floorSessionCount(paidRemainingMinutes / newDurationMinutes) : 0,
      bonusSessionsRemaining:
        newDurationMinutes > 0 ? floorSessionCount(bonusRemainingMinutes / newDurationMinutes) : 0,
      totalSessionsRemaining:
        newDurationMinutes > 0 ? floorSessionCount(totalRemainingMinutes / newDurationMinutes) : 0,
    };
  }

  // ──────────────────────────────────────────────────────────────────
  //  PAYROLL OPERATIONS
  // ──────────────────────────────────────────────────────────────────

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
      hasTeachingReport: true,
      'teachingReport.lessonContent': { $exists: true, $ne: '' },
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
      if (!this.hasQualifiedTeachingReport(session as any)) {
        return false;
      }

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
      const sessionId = objectIdToString(session._id);
      const overrideTeacherPayout = sessionId ? teacherPayoutOverrides.get(sessionId) : undefined;
      if (overrideTeacherPayout && overrideTeacherPayout > 0) {
        session.teacherPayout = overrideTeacherPayout;
      }
    }

    const totalPayout = sessions.reduce((acc, s) => acc + s.teacherPayout, 0);
    return { count: sessions.length, totalPayout, sessions };
  }

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

  async unmarkTeacherPaid(sessionIds: string[], mongoSession?: any): Promise<void> {
    await this.sessionModel.updateMany(
      { _id: { $in: sessionIds.map((id) => new Types.ObjectId(id)) } },
      { $set: { isTeacherPaid: false } },
      mongoSession ? { session: mongoSession } : undefined,
    );
  }

  async markPaid(sessionIds: string[]): Promise<void> {
    await this.sessionModel.updateMany(
      { _id: { $in: sessionIds.map((id) => new Types.ObjectId(id)) } },
      { $set: { isPaid: true } },
    );
  }
}
