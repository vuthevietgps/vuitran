import { Types, Connection, Model } from 'mongoose';
import { OFFLINE_MIN_TEACHER_PAYOUT } from '../attendance/attendance.utils';
import { normalizeDate } from '../common/utils/date.utils';
import { SessionsService } from '../sessions/sessions.service';
import { PayrollDocument } from './schemas/payroll.schema';

type PreviewPayrollTransactionRecord = {
  sessionId: Types.ObjectId;
  status?: string;
  holdReason?: string;
  holdDescription?: string;
  penaltyAmount?: number;
  finalSalary?: number;
  isLateReport?: boolean;
  lateHours?: number;
};

function hasQualifiedTeachingReport(session: {
  hasTeachingReport?: boolean;
  teachingReport?: { lessonContent?: string | null } | null;
}) {
  return (
    session.hasTeachingReport === true &&
    typeof session.teachingReport?.lessonContent === 'string' &&
    session.teachingReport.lessonContent.trim().length > 0
  );
}

function getPreviewTeacherPayout(session: {
  teacherPayout?: number;
  isTeacherPaid?: boolean;
  hasTeachingReport?: boolean;
  teachingReport?: { lessonContent?: string | null } | null;
}) {
  return hasQualifiedTeachingReport(session) || session.isTeacherPaid
    ? Number(session.teacherPayout || 0)
    : 0;
}

function getPreviewPenaltyAmount(tx?: { penaltyAmount?: number }) {
  return Number(tx?.penaltyAmount || 0);
}

function getPreviewOfflineBasePayout(session: {
  teacherPayout?: number;
  isTeacherPaid?: boolean;
  hasTeachingReport?: boolean;
  teachingReport?: { lessonContent?: string | null } | null;
  classId?: {
    classMode?: string | null;
    teacherPayPerStudent?: number | null;
  } | null;
}) {
  const grossPayout = getPreviewTeacherPayout(session);
  if (session.classId?.classMode !== 'OFFLINE' || grossPayout <= 0) {
    return 0;
  }
  const perStudentTeacherPay = Number(session.classId?.teacherPayPerStudent || 0);
  if (perStudentTeacherPay <= 0) {
    return 0;
  }
  return Math.min(grossPayout, perStudentTeacherPay);
}

function getPreviewOfflineMinGuaranteeAmount(session: {
  teacherPayout?: number;
  isTeacherPaid?: boolean;
  hasTeachingReport?: boolean;
  teachingReport?: { lessonContent?: string | null } | null;
  classId?: {
    classMode?: string | null;
    teacherPayPerStudent?: number | null;
  } | null;
}) {
  const grossPayout = getPreviewTeacherPayout(session);
  if (session.classId?.classMode !== 'OFFLINE' || grossPayout <= 0) {
    return 0;
  }
  const basePayout = getPreviewOfflineBasePayout(session);
  if (basePayout <= 0) {
    return 0;
  }
  return Math.max(0, grossPayout - basePayout);
}

function getPreviewFinalPayout(
  session: {
    teacherPayout?: number;
    isTeacherPaid?: boolean;
    hasTeachingReport?: boolean;
    teachingReport?: { lessonContent?: string | null } | null;
  },
  tx?: { finalSalary?: number },
) {
  const grossPayout = getPreviewTeacherPayout(session);
  if (!tx) {
    return grossPayout;
  }
  return Number(tx.finalSalary ?? grossPayout);
}

export async function buildTeacherPayrollPreview(
  teacherId: string,
  periodStart: string,
  periodEnd: string,
  sessionsService: SessionsService,
  connection: Connection,
  payrollModel: Model<PayrollDocument>,
) {
  const from = normalizeDate(periodStart);
  const to = normalizeDate(periodEnd);
  const cutoffExclusive = new Date(to);
  cutoffExclusive.setUTCDate(cutoffExclusive.getUTCDate() + 1);

  const eligibleSnapshot = await sessionsService.countFinalizedForPayroll(
    teacherId,
    cutoffExclusive,
  );
  const eligibleSessionIds = new Set(
    (eligibleSnapshot.sessions || [])
      .map((s: any) => s?._id?.toString())
      .filter((id: string | undefined): id is string => !!id),
  );

  const SessionModel = connection.model('Session');
  const PayrollTransactionModel = connection.model('PayrollTransaction');

  const sessions = await SessionModel.find({
    teacherId: new Types.ObjectId(teacherId),
    scheduledDate: { $gte: from, $lt: cutoffExclusive },
    status: { $nin: ['RESCHEDULED'] },
  })
    .populate('classId', 'name code classMode teacherPayPerStudent')
    .populate('studentId', 'fullName studentCode')
    .sort('scheduledDate')
    .lean();

  const previewTransactions = sessions.length > 0
    ? await PayrollTransactionModel.find({
        teacherId: new Types.ObjectId(teacherId),
        sessionId: { $in: sessions.map((session: any) => session._id) },
      })
        .select('sessionId status holdReason holdDescription penaltyAmount finalSalary isLateReport lateHours')
        .lean<PreviewPayrollTransactionRecord[]>()
    : [];
  const txBySessionId = new Map(
    previewTransactions.map((tx) => [tx.sessionId.toString(), tx] as const),
  );

  const attended: any[] = [];
  const held: any[] = [];
  const missingReport: any[] = [];
  const pendingParentConfirm: any[] = [];
  const alreadyPaid: any[] = [];
  const cancelled: any[] = [];
  const noShow: any[] = [];
  const pendingFinalize: any[] = [];
  const finalizedNoReport: any[] = [];

  for (const s of sessions) {
    const session: any = s;
    const status = session.status;
    const hasReport = hasQualifiedTeachingReport(session);
    const isPaid = !!session.isTeacherPaid;
    const sid = session?._id?.toString?.() ?? String(session?._id);
    const isEligibleByRules = eligibleSessionIds.has(sid);
    const sessionTx = txBySessionId.get(sid);

    if (['TEACHER_COMPLETED', 'PARENT_CONFIRMED', 'FINALIZED'].includes(status)) {
      attended.push(session);
    }

    if (isPaid) {
      alreadyPaid.push(session);
      continue;
    }

    if (sessionTx?.status === 'HELD') {
      held.push(session);
      continue;
    }

    if (status === 'FINALIZED' && !hasReport) {
      finalizedNoReport.push(session);
      missingReport.push(session);
    }

    if (['TEACHER_COMPLETED', 'PARENT_CONFIRMED'].includes(status) && !hasReport) {
      missingReport.push(session);
    }

    if (status === 'TEACHER_COMPLETED') {
      pendingParentConfirm.push(session);
    }

    if (
      status === 'PARENT_CONFIRMED' ||
      (status === 'FINALIZED' && hasReport && !isEligibleByRules)
    ) {
      pendingFinalize.push(session);
    }

    if (status === 'CANCELLED') {
      cancelled.push(session);
    }

    if (status === 'NO_SHOW') {
      noShow.push(session);
    }
  }

  const existingPayrolls = await payrollModel
    .find({
      teacherId: new Types.ObjectId(teacherId),
      periodStart: { $lte: to },
      periodEnd: { $gte: from },
    })
    .populate('createdBy', 'fullName')
    .populate('approvedBy', 'fullName')
    .sort('-createdAt')
    .lean();

  return {
    teacherId,
    periodStart: from,
    periodEnd: to,

    summary: {
      totalSessions: sessions.length,
      totalAttended: attended.length,
      eligibleForPayroll: eligibleSnapshot.count,
      missingReport: missingReport.length,
      pendingParentConfirm: pendingParentConfirm.length,
      pendingFinalize: pendingFinalize.length,
      finalizedNoReport: finalizedNoReport.length,
      heldCount: held.length,
      alreadyPaid: alreadyPaid.length,
      cancelled: cancelled.length,
      noShow: noShow.length,
    },

    amounts: {
      totalEligiblePayout: eligibleSnapshot.totalPayout,
      totalAlreadyPaid: alreadyPaid.reduce((acc, s) => acc + getPreviewTeacherPayout(s), 0),
      totalBlockedByReport: finalizedNoReport.reduce((acc, s) => acc + getPreviewTeacherPayout(s), 0),
      totalPendingConfirm: pendingParentConfirm.reduce((acc, s) => acc + getPreviewTeacherPayout(s), 0),
      totalPendingFinalize: pendingFinalize.reduce((acc, s) => acc + getPreviewTeacherPayout(s), 0),
      totalHeldPayout: held.reduce((acc, s) => acc + getPreviewTeacherPayout(s), 0),
      totalAttendedPayout: attended.reduce((acc, s) => acc + getPreviewTeacherPayout(s), 0),
      totalOfflineMinGuaranteeAmount: attended.reduce(
        (acc, s) => acc + getPreviewOfflineMinGuaranteeAmount(s),
        0,
      ),
    },

    sessions: sessions.map((s: any) => {
      const sid = s?._id?.toString?.() ?? String(s?._id);
      const isEligibleByRules = eligibleSessionIds.has(sid);
      const sessionTx = txBySessionId.get(sid);
      const teacherPayout = getPreviewTeacherPayout(s);
      const offlineBasePayout = getPreviewOfflineBasePayout(s);
      const offlineMinGuaranteeAmount = getPreviewOfflineMinGuaranteeAmount(s);
      const offlineMinGuaranteeApplied = offlineMinGuaranteeAmount > 0;

      return {
        _id: s._id,
        classId: s.classId,
        classMode: s.classId?.classMode,
        studentId: s.studentId,
        scheduledDate: s.scheduledDate,
        durationMinutes: s.durationMinutes,
        teacherPayout,
        offlineBasePayout,
        offlineMinGuaranteeAmount,
        offlineMinGuaranteeFloor: OFFLINE_MIN_TEACHER_PAYOUT,
        offlineMinGuaranteeApplied,
        penaltyAmount: getPreviewPenaltyAmount(sessionTx),
        finalPayout: getPreviewFinalPayout(s, sessionTx),
        isLateReport: !!sessionTx?.isLateReport,
        lateHours: Number(sessionTx?.lateHours || 0),
        status: s.status,
        hasTeachingReport: hasQualifiedTeachingReport(s),
        isTeacherPaid: !!s.isTeacherPaid,
        isPaid: !!s.isPaid,
        confirmation: s.confirmation,
        teachingReport: s.teachingReport
        ? {
            lessonContent: s.teachingReport.lessonContent,
            submittedAt: s.teachingReport.submittedAt,
            isLateSubmission: s.teachingReport.isLateSubmission,
          }
        : null,
        holdReason: sessionTx?.holdReason,
        holdDescription: sessionTx?.holdDescription,
        payrollStatus: s.isTeacherPaid
          ? 'PAID'
          : (() => {
              if (sessionTx?.status === 'HELD') return 'HELD';
              if (isEligibleByRules) return 'ELIGIBLE';
              if (s.status === 'FINALIZED' && !hasQualifiedTeachingReport(s)) return 'BLOCKED_NO_REPORT';
              if (s.status === 'TEACHER_COMPLETED') return 'WAITING_PARENT';
              if (s.status === 'PARENT_CONFIRMED') return 'WAITING_FINALIZE';
              if (s.status === 'FINALIZED' && hasQualifiedTeachingReport(s)) return 'WAITING_FINALIZE';
              if (s.status === 'CANCELLED') return 'CANCELLED';
              if (s.status === 'NO_SHOW') return 'NO_SHOW';
              return 'OTHER';
            })(),
      };
    }),

    existingPayrolls,
  };
}
