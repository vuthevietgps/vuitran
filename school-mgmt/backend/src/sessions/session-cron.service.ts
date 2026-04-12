import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';

import {
  Session,
  SessionDocument,
  SessionStatus,
} from './schemas/session.schema';
import { SessionSettlementService } from './session-settlement.service';
import { SessionTrialService } from './session-trial.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  NotificationPriority,
  NotificationType,
} from '../notifications/schemas/notification.schema';
import { StudentSupportSnapshotService } from '../messages/student-support-snapshot.service';
import { Student, StudentDocument } from '../students/schemas/student.schema';

import { objectIdToString, extractErrorMessage } from './helpers/session.utils';
import { addVietnamHours } from './helpers/vietnam-timezone.utils';

// ─── Constants ───────────────────────────────────────────────────────
const TEACHING_REPORT_DEADLINE_HOURS = 24;

@Injectable()
export class SessionCronService {
  private readonly logger = new Logger(SessionCronService.name);

  constructor(
    @InjectModel(Session.name) private sessionModel: Model<SessionDocument>,
    @InjectModel(Student.name) private studentModel: Model<StudentDocument>,
    private sessionSettlementService: SessionSettlementService,
    private sessionTrialService: SessionTrialService,
    private notificationsService: NotificationsService,
    private studentSupportSnapshotService: StudentSupportSnapshotService,
  ) {}

  // ──────────────────────────────────────────────────────────────────
  //  CRON: AUTO-CONFIRM
  //  Chạy mỗi giờ, tìm sessions TEACHER_COMPLETED quá X giờ → FINALIZED
  // ──────────────────────────────────────────────────────────────────

  @Cron(CronExpression.EVERY_HOUR)
  async autoConfirmSessions() {
    const now = new Date();

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

      const deadline = addVietnamHours(
        new Date(session.confirmation.teacherCompletedAt),
        session.autoConfirmAfterHours,
      );

      if (now >= deadline) {
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
        if (!updated) continue;

          await this.sessionSettlementService.settleFinalizedSession(updated);
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
    cutoff.setHours(cutoff.getHours() - 1);

    const sessions = await this.sessionModel.find({
      status: SessionStatus.FINALIZED,
      isPaid: false,
      isBonusSession: false,
      amountCharged: { $gt: 0 },
      parentUserId: { $exists: true },
      'confirmation.finalizedAt': { $lt: cutoff },
    }).limit(50);

    let recovered = 0;
    for (const session of sessions) {
      if (session.sessionType === 'TRIAL' && !session.trialConverted) continue;

      await this.sessionSettlementService.settleFinalizedSession(session);
      const reloaded = await this.sessionModel.findById(session._id).select('isPaid isBonusSession').lean();
      if ((reloaded as any)?.isPaid || (reloaded as any)?.isBonusSession) recovered++;
    }

    if (recovered > 0) {
      this.logger.log(`Recovery: retried wallet deduction for ${recovered} sessions`);
    }
  }

  // ──────────────────────────────────────────────────────────────────
  //  Backfill invoice consumption
  // ──────────────────────────────────────────────────────────────────

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
      await this.sessionSettlementService.applyInvoiceConsumptionForSession(
        session._id as Types.ObjectId,
      );
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
  // ──────────────────────────────────────────────────────────────────

  @Cron(CronExpression.EVERY_12_HOURS)
  async autoDecideOrphanTrialSessions() {
    await this.sessionTrialService.autoDecideOrphanTrialSessions();
  }

  // ──────────────────────────────────────────────────────────────────
  //  CRON: NHẮC NHỞ BÁO CÁO GIẢNG DẠY TRỄ HẠN
  // ──────────────────────────────────────────────────────────────────

  @Cron(CronExpression.EVERY_HOUR)
  async checkLateTeachingReports() {
    const now = new Date();
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
        isTeacherPaid: false,
      })
      .select('_id teacherId scheduledDate')
      .limit(100);

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
  //  PRIVATE HELPERS
  // ──────────────────────────────────────────────────────────────────

  private triggerStudentSupportSnapshotRefreshForSessions(
    sessions: Array<{ parentUserId?: any; studentId?: any }>,
    reason: string,
  ) {
    void this.refreshStudentSupportSnapshotsForSessions(sessions, reason);
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

  private async refreshStudentSupportSnapshotsForSessions(
    sessions: Array<{ parentUserId?: any; studentId?: any }>,
    reason: string,
  ): Promise<void> {
    const resolvedParents = new Map<string, string | null>();
    const refreshedKeys = new Set<string>();

    for (const session of sessions) {
      const studentId = objectIdToString(session.studentId);
      if (!studentId) continue;

      let parentUserId = objectIdToString(session.parentUserId);
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
          `[StudentSupportSnapshot] Failed to refresh for student ${studentId} (${reason}): ${extractErrorMessage(err)}`,
        );
      }
    }
  }
}
