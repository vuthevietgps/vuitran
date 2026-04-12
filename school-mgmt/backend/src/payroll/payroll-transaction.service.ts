import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, ClientSession } from 'mongoose';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

import {
  PayrollTransaction,
  PayrollTransactionDocument,
  PayrollTransactionStatus,
  HoldReason,
} from './schemas/payroll-transaction.schema';

/**
 * PayrollTransactionService: Quản lý sổ phụ tính lương từng buổi dạy.
 *
 * Luồng chính:
 * 1. createFromSession(): Tạo record khi GV submit teaching report
 * 2. applyPenalty(): Tính phạt nộp báo cáo trễ
 * 3. holdSalary(): Giữ lương khi có vấn đề (parent reject, dispute...)
 * 4. releaseHold(): Duyệt/giải phóng lương đang bị held
 * 5. excludeFromPayroll(): Loại khỏi tính lương
 */

export interface CreatePayrollTransactionDto {
  teacherId: string;
  sessionId: string;
  classId: string;
  studentId: string;
  sessionDate: Date;
  baseSalary: number;
  isLateReport?: boolean;
  lateHours?: number;
  reportDeadline?: Date;
  reportSubmittedAt?: Date;
  createdBy?: string;
}

export interface PenaltyConfig {
  /** Số tiền phạt mỗi giờ trễ */
  penaltyPerHour: number;
  /** Số tiền phạt tối đa (không vượt quá % lương cơ bản) */
  maxPenaltyPercent: number;
  /** Số giờ miễn phạt (grace period) */
  graceHours: number;
}

const DEFAULT_PENALTY_CONFIG: PenaltyConfig = {
  penaltyPerHour: 10_000, // 10k/giờ
  maxPenaltyPercent: 30,  // Tối đa 30% lương
  graceHours: 0,          // Không có grace period
};

@Injectable()
export class PayrollTransactionService {
  private readonly logger = new Logger(PayrollTransactionService.name);

  constructor(
    @InjectModel(PayrollTransaction.name)
    private txModel: Model<PayrollTransactionDocument>,
    @InjectConnection() private connection: Connection,
  ) {}

  // ══════════════════════════════════════════════════════════════════
  //  CREATE
  // ══════════════════════════════════════════════════════════════════

  /**
   * Tạo PayrollTransaction sau khi GV submit teaching report.
   * Tự động tính penalty nếu nộp trễ.
   */
  async createFromSession(
    dto: CreatePayrollTransactionDto,
    penaltyConfig: PenaltyConfig = DEFAULT_PENALTY_CONFIG,
  ): Promise<PayrollTransactionDocument> {
    // Tính penalty nếu nộp trễ
    let penaltyAmount = 0;
    if (dto.isLateReport && dto.lateHours && dto.lateHours > penaltyConfig.graceHours) {
      const effectiveLateHours = dto.lateHours - penaltyConfig.graceHours;
      penaltyAmount = effectiveLateHours * penaltyConfig.penaltyPerHour;
      // Cap tại maxPenaltyPercent
      const maxPenalty = Math.round(dto.baseSalary * penaltyConfig.maxPenaltyPercent / 100);
      penaltyAmount = Math.min(penaltyAmount, maxPenalty);
    }

    const finalSalary = Math.max(0, dto.baseSalary - penaltyAmount);
    const tx = await this.txModel.findOneAndUpdate(
      { sessionId: new Types.ObjectId(dto.sessionId) },
      {
        $setOnInsert: {
          teacherId: new Types.ObjectId(dto.teacherId),
          sessionId: new Types.ObjectId(dto.sessionId),
          classId: new Types.ObjectId(dto.classId),
          studentId: new Types.ObjectId(dto.studentId),
          sessionDate: dto.sessionDate,
          baseSalary: dto.baseSalary,
          penaltyAmount,
          bonusAmount: 0,
          adjustmentAmount: 0,
          finalSalary,
          status: PayrollTransactionStatus.PENDING,
          isLateReport: dto.isLateReport ?? false,
          lateHours: dto.lateHours ?? 0,
          reportDeadline: dto.reportDeadline,
          reportSubmittedAt: dto.reportSubmittedAt,
          createdBy: dto.createdBy ? new Types.ObjectId(dto.createdBy) : undefined,
        },
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      },
    );

    if (!tx) {
      throw new BadRequestException(`Khong the tao PayrollTransaction cho session ${dto.sessionId}`);
    }

    if (penaltyAmount > 0) {
      this.logger.log(
        `PayrollTransaction created for session ${dto.sessionId}: baseSalary=${dto.baseSalary}, penalty=${penaltyAmount}, final=${finalSalary}`,
      );
    }

    return tx;
  }

  // ══════════════════════════════════════════════════════════════════
  //  PENALTY
  // ══════════════════════════════════════════════════════════════════

  /**
   * Áp dụng phạt trễ báo cáo cho session.
   * Dùng khi cần tính toán lại penalty.
   */
  async applyPenalty(
    sessionId: string,
    lateHours: number,
    penaltyConfig: PenaltyConfig = DEFAULT_PENALTY_CONFIG,
  ): Promise<PayrollTransactionDocument> {
    const tx = await this.txModel.findOne({ sessionId: new Types.ObjectId(sessionId) });
    if (!tx) throw new NotFoundException(`PayrollTransaction not found for session ${sessionId}`);

    if (tx.status !== PayrollTransactionStatus.PENDING) {
      throw new BadRequestException(`Cannot apply penalty to transaction in status ${tx.status}`);
    }

    const effectiveLateHours = Math.max(0, lateHours - penaltyConfig.graceHours);
    let penaltyAmount = effectiveLateHours * penaltyConfig.penaltyPerHour;
    const maxPenalty = Math.round(tx.baseSalary * penaltyConfig.maxPenaltyPercent / 100);
    penaltyAmount = Math.min(penaltyAmount, maxPenalty);

    tx.penaltyAmount = penaltyAmount;
    tx.lateHours = lateHours;
    tx.isLateReport = lateHours > 0;
    tx.finalSalary = Math.max(0, tx.baseSalary - penaltyAmount + tx.bonusAmount + tx.adjustmentAmount);

    await tx.save();

    this.logger.log(`Applied penalty ${penaltyAmount} to session ${sessionId} (${lateHours}h late)`);
    return tx;
  }

  // ══════════════════════════════════════════════════════════════════
  //  HOLD
  // ══════════════════════════════════════════════════════════════════

  /**
   * Giữ lương (HELD) — không cho kế toán chi tiền cho đến khi có Manager duyệt.
   * Trigger: Parent reject, dispute pending, quality issue, etc.
   */
  async holdSalary(
    sessionId: string,
    reason: HoldReason,
    holdDescription: string,
    heldBy: string,
    relatedTicketId?: string,
  ): Promise<PayrollTransactionDocument> {
    const tx = await this.txModel.findOne({ sessionId: new Types.ObjectId(sessionId) });
    if (!tx) throw new NotFoundException(`PayrollTransaction not found for session ${sessionId}`);

    // Chỉ PENDING mới hold được
    if (tx.status !== PayrollTransactionStatus.PENDING) {
      throw new BadRequestException(`Cannot hold transaction in status ${tx.status}`);
    }

    tx.status = PayrollTransactionStatus.HELD;
    tx.holdReason = reason;
    tx.holdDescription = holdDescription;
    tx.heldBy = new Types.ObjectId(heldBy);
    tx.heldAt = new Date();
    if (relatedTicketId) {
      tx.relatedTicketId = new Types.ObjectId(relatedTicketId);
    }

    await tx.save();

    this.logger.warn(`Session ${sessionId} salary HELD: ${reason} - ${holdDescription}`);
    return tx;
  }

  /**
   * Manager duyệt HELD → APPROVED hoặc EXCLUDED.
   */
  async releaseHold(
    sessionId: string,
    decision: 'APPROVE' | 'EXCLUDE',
    approvedBy: string,
    excludedReason?: string,
  ): Promise<PayrollTransactionDocument> {
    const tx = await this.txModel.findOne({ sessionId: new Types.ObjectId(sessionId) });
    if (!tx) throw new NotFoundException(`PayrollTransaction not found for session ${sessionId}`);

    if (tx.status !== PayrollTransactionStatus.HELD) {
      throw new BadRequestException(`Only HELD transactions can be released`);
    }

    if (decision === 'APPROVE') {
      tx.status = PayrollTransactionStatus.APPROVED;
      tx.approvedBy = new Types.ObjectId(approvedBy);
      tx.approvedAt = new Date();
      this.logger.log(`Session ${sessionId} salary released and APPROVED`);
    } else {
      tx.status = PayrollTransactionStatus.EXCLUDED;
      tx.excludedBy = new Types.ObjectId(approvedBy);
      tx.excludedAt = new Date();
      tx.excludedReason = excludedReason;
      this.logger.warn(`Session ${sessionId} salary EXCLUDED: ${excludedReason}`);
    }

    await tx.save();
    return tx;
  }

  // ══════════════════════════════════════════════════════════════════
  //  EXCLUDE
  // ══════════════════════════════════════════════════════════════════

  /**
   * Loại khỏi tính lương (dispute resolved → không trả).
   */
  async excludeFromPayroll(
    sessionId: string,
    excludedBy: string,
    reason: string,
  ): Promise<PayrollTransactionDocument> {
    const tx = await this.txModel.findOne({ sessionId: new Types.ObjectId(sessionId) });
    if (!tx) throw new NotFoundException(`PayrollTransaction not found for session ${sessionId}`);

    if (tx.status === PayrollTransactionStatus.PAID) {
      throw new BadRequestException(`Cannot exclude already PAID transaction`);
    }

    tx.status = PayrollTransactionStatus.EXCLUDED;
    tx.excludedBy = new Types.ObjectId(excludedBy);
    tx.excludedAt = new Date();
    tx.excludedReason = reason;

    await tx.save();

    this.logger.warn(`Session ${sessionId} EXCLUDED from payroll: ${reason}`);
    return tx;
  }

  // ══════════════════════════════════════════════════════════════════
  //  APPROVE
  // ══════════════════════════════════════════════════════════════════

  /**
   * Duyệt PENDING → APPROVED (sẵn sàng aggregation vào Payroll).
   */
  async approve(
    sessionId: string,
    approvedBy: string,
  ): Promise<PayrollTransactionDocument> {
    const tx = await this.txModel.findOne({ sessionId: new Types.ObjectId(sessionId) });
    if (!tx) throw new NotFoundException(`PayrollTransaction not found for session ${sessionId}`);

    if (tx.status !== PayrollTransactionStatus.PENDING) {
      throw new BadRequestException(`Only PENDING transactions can be approved`);
    }

    tx.status = PayrollTransactionStatus.APPROVED;
    tx.approvedBy = new Types.ObjectId(approvedBy);
    tx.approvedAt = new Date();

    await tx.save();
    return tx;
  }

  /**
   * Bulk approve nhiều transactions.
   */
  async bulkApprove(
    sessionIds: string[],
    approvedBy: string,
  ): Promise<{ approved: number; skipped: number }> {
    const result = await this.txModel.updateMany(
      {
        sessionId: { $in: sessionIds.map((id) => new Types.ObjectId(id)) },
        status: PayrollTransactionStatus.PENDING,
      },
      {
        $set: {
          status: PayrollTransactionStatus.APPROVED,
          approvedBy: new Types.ObjectId(approvedBy),
          approvedAt: new Date(),
        },
      },
    );

    return {
      approved: result.modifiedCount,
      skipped: sessionIds.length - result.modifiedCount,
    };
  }

  // ══════════════════════════════════════════════════════════════════
  //  QUERY
  // ══════════════════════════════════════════════════════════════════

  /**
   * Lấy tất cả transactions đang HELD (cần Manager xử lý).
   */
  async getHeldTransactions(): Promise<PayrollTransactionDocument[]> {
    return this.txModel
      .find({ status: PayrollTransactionStatus.HELD })
      .populate('teacherId', 'fullName email')
      .populate('studentId', 'fullName')
      .populate('classId', 'name')
      .sort({ heldAt: 1 });
  }

  /**
   * Lấy transactions theo teacher trong khoảng thời gian.
   */
  async getByTeacher(
    teacherId: string,
    startDate: Date,
    endDate: Date,
    status?: PayrollTransactionStatus,
  ): Promise<PayrollTransactionDocument[]> {
    const filter: any = {
      teacherId: new Types.ObjectId(teacherId),
      sessionDate: { $gte: startDate, $lte: endDate },
    };
    if (status) filter.status = status;

    return this.txModel.find(filter).sort({ sessionDate: 1 });
  }

  /**
   * Lấy transaction theo sessionId.
   */
  async getBySessionId(sessionId: string): Promise<PayrollTransactionDocument | null> {
    return this.txModel.findOne({ sessionId: new Types.ObjectId(sessionId) });
  }

  /**
   * Tổng hợp số liệu cho 1 teacher trong kỳ (để hiển thị preview).
   */
  async getSummaryByTeacher(
    teacherId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<{
    totalSessions: number;
    pendingCount: number;
    heldCount: number;
    approvedCount: number;
    excludedCount: number;
    totalBaseSalary: number;
    totalPenalty: number;
    totalBonus: number;
    totalFinalSalary: number;
  }> {
    const txs = await this.getByTeacher(teacherId, startDate, endDate);

    const summary = {
      totalSessions: txs.length,
      pendingCount: 0,
      heldCount: 0,
      approvedCount: 0,
      excludedCount: 0,
      totalBaseSalary: 0,
      totalPenalty: 0,
      totalBonus: 0,
      totalFinalSalary: 0,
    };

    for (const tx of txs) {
      switch (tx.status) {
        case PayrollTransactionStatus.PENDING:
          summary.pendingCount++;
          break;
        case PayrollTransactionStatus.HELD:
          summary.heldCount++;
          break;
        case PayrollTransactionStatus.APPROVED:
        case PayrollTransactionStatus.PAID:
          summary.approvedCount++;
          break;
        case PayrollTransactionStatus.EXCLUDED:
          summary.excludedCount++;
          continue; // Không tính vào total
      }

      summary.totalBaseSalary += tx.baseSalary;
      summary.totalPenalty += tx.penaltyAmount;
      summary.totalBonus += tx.bonusAmount;
      summary.totalFinalSalary += tx.finalSalary;
    }

    return summary;
  }
}
