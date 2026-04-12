import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { Session, SessionDocument } from '../sessions/schemas/session.schema';
import {
  PayrollTransaction,
  PayrollTransactionDocument,
  PayrollTransactionStatus,
} from '../payroll/schemas/payroll-transaction.schema';
import {
  PayrollTransactionService,
} from '../payroll/payroll-transaction.service';
import {
  calculateTeachingReportDeadline,
  calculateVietnamLateHours,
} from '../sessions/helpers/vietnam-timezone.utils';

/** Số ngày quét ngược về quá khứ cho mỗi lần reconcile */
const RECONCILE_WINDOW_DAYS = 30;

export interface ReconciliationResult {
  sessionsScanned: number;
  /** PayrollTransactions bị lệch late-flag → đã tự động sửa */
  payrollTxLateHealed: number;
  /** Sessions có báo cáo nhưng thiếu PayrollTransaction → đã tạo mới */
  missingTxCreated: number;
  /** Sessions không có báo cáo nhưng PayrollTransaction đã PAID → CẢNH BÁO NGHIÊM TRỌNG */
  criticalAnomalies: number;
  /** Sessions không có báo cáo nhưng có PayrollTransaction chưa PAID → Cần xem xét thủ công */
  orphanTxWarnings: number;
}

/**
 * ReconciliationService:
 * Cronjob đối soát nightly giữa Sessions (SSOT) và PayrollTransactions
 * để đảm bảo tính toàn vẹn dữ liệu lương giáo viên.
 *
 * Lưu ý về kiến trúc:
 *   Attendance KHÔNG có hasTeachingReport / isLateReport (đã được chuyển sang
 *   Sessions và PayrollTransactions làm SSOT đúng theo schema hiện tại).
 *   Do đó reconciliation tập trung vào khớp nối Sessions ↔ PayrollTransactions.
 *
 * Các kịch bản được xử lý:
 *   CASE 1 – Thiếu PayrollTransaction:
 *     Session.hasTeachingReport=true nhưng không có PayrollTransaction
 *     → Tự động tạo PayrollTransaction (auto-heal)
 *
 *   CASE 2 – PayrollTransaction mồ côi (warning):
 *     Session.hasTeachingReport=false nhưng có PayrollTransaction (status≠PAID)
 *     → Ghi log WARNING, yêu cầu xem xét thủ công (không tự xóa)
 *
 *   CASE 3 – Lệch cờ nộp trễ (auto-heal):
 *     PayrollTransaction.isLateReport hoặc lateHours không khớp với Session.teachingReport
 *     → Tự động đồng bộ nếu status = PENDING (chưa duyệt/chưa trả)
 *
 *   CASE 4 – NGHIÊM TRỌNG – Đã trả lương nhưng không có báo cáo:
 *     PayrollTransaction.status=PAID nhưng Session.hasTeachingReport=false
 *     → KHÔNG tự sửa. Gửi alert đỏ cho Admin/Kế toán.
 */
@Injectable()
export class ReconciliationService {
  private readonly logger = new Logger(ReconciliationService.name);

  constructor(
    @InjectModel(Session.name)
    private readonly sessionModel: Model<SessionDocument>,
    @InjectModel(PayrollTransaction.name)
    private readonly payrollTxModel: Model<PayrollTransactionDocument>,
    private readonly payrollTxService: PayrollTransactionService,
  ) {}

  private hasQualifiedTeachingReport(session: {
    hasTeachingReport?: boolean;
    teachingReport?: { lessonContent?: string | null } | null;
  }): boolean {
    return (
      session.hasTeachingReport === true &&
      typeof session.teachingReport?.lessonContent === 'string' &&
      session.teachingReport.lessonContent.trim().length >= 20
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  CRONJOB NIGHTLY
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Chạy đối soát tự động mỗi ngày lúc 02:00 AM.
   * Quét 30 ngày gần nhất để cover chu kỳ tính lương tháng.
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async runNightlyReconciliation(): Promise<void> {
    const toDate = new Date();
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - RECONCILE_WINDOW_DAYS);

    this.logger.log(
      `[RECONCILIATION] Nightly job triggered. Range: ${fromDate.toISOString()} → ${toDate.toISOString()}`,
    );

    const result = await this._reconcile(fromDate, toDate);

    this.logger.log(
      `[RECONCILIATION] Nightly run completed. ` +
        `Sessions scanned: ${result.sessionsScanned} | ` +
        `Missing PayrollTx created: ${result.missingTxCreated} | ` +
        `Late-flag healed: ${result.payrollTxLateHealed} | ` +
        `Critical anomalies: ${result.criticalAnomalies} | ` +
        `Orphan warnings: ${result.orphanTxWarnings}`,
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  MANUAL TRIGGER (dùng cho backfill / debug bởi Admin)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Kích hoạt reconciliation thủ công với khoảng thời gian tuỳ chọn.
   * Dùng cho Admin backfill hoặc debug sau khi phát hiện lỗi dữ liệu.
   */
  async runManual(fromDate: Date, toDate: Date): Promise<ReconciliationResult> {
    this.logger.log(
      `[RECONCILIATION] Manual run triggered. Range: ${fromDate.toISOString()} → ${toDate.toISOString()}`,
    );
    return this._reconcile(fromDate, toDate);
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  CORE RECONCILIATION LOGIC
  // ─────────────────────────────────────────────────────────────────────────

  private async _reconcile(fromDate: Date, toDate: Date): Promise<ReconciliationResult> {
    // ── Step 1: Fetch Sessions trong khoảng thời gian ──────────────────────
    const sessions = await this.sessionModel
      .find({ scheduledDate: { $gte: fromDate, $lte: toDate } })
      .select(
        '_id teacherId classId studentId scheduledDate hasTeachingReport teachingReport teacherPayout',
      )
      .lean();

    if (sessions.length === 0) {
      this.logger.log('[RECONCILIATION] No sessions in the given range. Nothing to reconcile.');
      return {
        sessionsScanned: 0,
        payrollTxLateHealed: 0,
        missingTxCreated: 0,
        criticalAnomalies: 0,
        orphanTxWarnings: 0,
      };
    }

    // ── Step 2: Fetch PayrollTransactions liên quan trong 1 query (tránh N+1) ──
    const sessionIds = sessions.map((s) => s._id as Types.ObjectId);
    const existingTxs = await this.payrollTxModel
      .find({ sessionId: { $in: sessionIds } })
      .select('_id sessionId teacherId status isLateReport lateHours finalSalary')
      .lean();

    // Index PayrollTransactions by sessionId để lookup O(1)
    const txBySessionId = new Map<string, (typeof existingTxs)[0]>();
    for (const tx of existingTxs) {
      txBySessionId.set((tx.sessionId as Types.ObjectId).toString(), tx);
    }

    // ── Step 3: Phân tích từng Session ──────────────────────────────────────
    const bulkUpdateOps: Parameters<typeof this.payrollTxModel.bulkWrite>[0] = [];
    const criticalAnomalies: Array<{
      sessionId: string;
      payrollTxId: string;
      teacherId: string;
      finalSalary: number;
      issue: string;
    }> = [];
    const orphanWarnings: string[] = [];
    let missingTxCreated = 0;

    for (const session of sessions) {
      const sessionIdStr = (session._id as Types.ObjectId).toString();
      const existingTx = txBySessionId.get(sessionIdStr);

      const sessionHasReport: boolean = session.hasTeachingReport ?? false;
      const sessionReportDeadline =
        session.teachingReport?.deadline ??
        calculateTeachingReportDeadline(session.scheduledDate, 24);
      const sessionSubmittedAt =
        session.teachingReport?.submittedAt ??
        sessionReportDeadline;
      const derivedLateHours = calculateVietnamLateHours(
        sessionSubmittedAt,
        sessionReportDeadline,
      );
      const sessionIsLate: boolean =
        session.teachingReport?.isLateSubmission ?? derivedLateHours > 0;
      const sessionLateHours: number =
        session.teachingReport?.lateSubmissionHours ?? derivedLateHours;
      const sessionHasQualifiedReport = this.hasQualifiedTeachingReport(session as any);

      // ── CASE 1: Thiếu PayrollTransaction ──────────────────────────────────
      if (!existingTx) {
        if (sessionHasQualifiedReport) {
          // GV đã nộp báo cáo nhưng PayrollTransaction chưa được tạo → tạo bù
          try {
            await this.payrollTxService.createFromSession({
              teacherId: (session.teacherId as Types.ObjectId).toString(),
              sessionId: sessionIdStr,
              classId: (session.classId as Types.ObjectId).toString(),
              studentId: (session.studentId as Types.ObjectId).toString(),
              sessionDate: session.scheduledDate,
              baseSalary: session.teacherPayout ?? 0,
              isLateReport: sessionIsLate,
              lateHours: sessionLateHours,
              reportDeadline: sessionReportDeadline,
              reportSubmittedAt: sessionSubmittedAt,
            });
            missingTxCreated++;
            this.logger.log(
              `[RECONCILIATION][CASE 1] Created missing PayrollTransaction for session ${sessionIdStr}`,
            );
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            this.logger.error(
              `[RECONCILIATION][CASE 1] Failed to create PayrollTransaction for session ${sessionIdStr}: ${msg}`,
            );
          }
        } else if (sessionHasReport) {
          orphanWarnings.push(sessionIdStr);
          this.logger.warn(
            `[RECONCILIATION][CASE 1] Skip PayrollTransaction creation for session ${sessionIdStr}: teaching report is unqualified`,
          );
        }
        // Session không có báo cáo + không có Tx → bình thường
        continue;
      }

      // ── CASE 4: NGHIÊM TRỌNG – Đã PAID nhưng không có báo cáo ───────────
      if (existingTx.status === PayrollTransactionStatus.PAID && !sessionHasReport) {
        criticalAnomalies.push({
          sessionId: sessionIdStr,
          payrollTxId: (existingTx._id as Types.ObjectId).toString(),
          teacherId: (existingTx.teacherId as Types.ObjectId).toString(),
          finalSalary: existingTx.finalSalary,
          issue:
            'PayrollTransaction đã PAID nhưng Session KHÔNG có báo cáo giảng dạy (hasTeachingReport=false)',
        });
        continue; // KHÔNG tự động sửa, chờ xử lý thủ công
      }

      // ── CASE 2: PayrollTransaction mồ côi (session không có báo cáo, Tx chưa PAID) ──
      if (!sessionHasReport && existingTx.status !== PayrollTransactionStatus.PAID) {
        orphanWarnings.push(sessionIdStr);
        this.logger.warn(
          `[RECONCILIATION][CASE 2] Orphan PayrollTransaction ` +
            `[txId=${(existingTx._id as Types.ObjectId).toString()}] ` +
            `for session ${sessionIdStr}: session has no teaching report but ` +
            `PayrollTransaction status=${existingTx.status}. Manual review required.`,
        );
        continue;
      }

      // ── CASE 3: Session có báo cáo, Tx ở PENDING, nhưng late flags lệch ──
      if (
        sessionHasReport &&
        existingTx.status === PayrollTransactionStatus.PENDING &&
        (existingTx.isLateReport !== sessionIsLate || existingTx.lateHours !== sessionLateHours)
      ) {
        bulkUpdateOps.push({
          updateOne: {
            filter: { _id: existingTx._id },
            update: {
              $set: {
                isLateReport: sessionIsLate,
                lateHours: sessionLateHours,
              },
            },
          },
        });
        this.logger.log(
          `[RECONCILIATION][CASE 3] Will fix PayrollTransaction [${(existingTx._id as Types.ObjectId).toString()}]: ` +
            `isLateReport ${existingTx.isLateReport}→${sessionIsLate}, ` +
            `lateHours ${existingTx.lateHours}→${sessionLateHours}`,
        );
      }
    }

    // ── Step 4: Thực thi bulk update cho PayrollTransactions ────────────────
    if (bulkUpdateOps.length > 0) {
      await this.payrollTxModel.bulkWrite(bulkUpdateOps);
      this.logger.log(
        `[RECONCILIATION] Auto-healed ${bulkUpdateOps.length} PayrollTransaction late-flag discrepancies.`,
      );
    }

    // ── Step 5: Alert cho Admin nếu có anomalies nghiêm trọng ───────────────
    if (criticalAnomalies.length > 0) {
      await this._sendCriticalAlerts(criticalAnomalies);
    }

    return {
      sessionsScanned: sessions.length,
      payrollTxLateHealed: bulkUpdateOps.length,
      missingTxCreated,
      criticalAnomalies: criticalAnomalies.length,
      orphanTxWarnings: orphanWarnings.length,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  ALERT
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Phát cảnh báo NGHIÊM TRỌNG khi phát hiện PayrollTransaction đã PAID
   * nhưng Session không có báo cáo giảng dạy.
   *
   * Hiện tại: log ERROR để monitoring tools (Datadog, CloudWatch, Sentry) bắt.
   * TODO (Phase 2): Tích hợp Telegram Bot / Email của Kế toán trưởng.
   *   Ví dụ: await this.telegramService.sendAdminAlert('🚨 PAYROLL ANOMALY', anomalies);
   */
  private async _sendCriticalAlerts(
    anomalies: Array<{
      sessionId: string;
      payrollTxId: string;
      teacherId: string;
      finalSalary: number;
      issue: string;
    }>,
  ): Promise<void> {
    this.logger.error(
      `[RECONCILIATION][CRITICAL] 🚨 FOUND ${anomalies.length} CRITICAL PAYROLL ANOMALY(IES)! ` +
        `Immediate review required by Accounting/Director.`,
    );

    for (const anomaly of anomalies) {
      this.logger.error(
        `[RECONCILIATION][CRITICAL] 🚨 ` +
          `sessionId=${anomaly.sessionId} | ` +
          `payrollTxId=${anomaly.payrollTxId} | ` +
          `teacherId=${anomaly.teacherId} | ` +
          `finalSalary=${anomaly.finalSalary.toLocaleString('vi-VN')} VNĐ | ` +
          `issue: ${anomaly.issue}`,
      );
    }
  }
}
