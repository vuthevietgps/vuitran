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

import { Wallet, WalletDocument, WalletStatus } from './schemas/wallet.schema';
import {
  LedgerEntry,
  LedgerEntryDocument,
  TransactionType,
  TransactionStatus,
  PaymentMethod,
  AdjustmentType,
} from './schemas/ledger-entry.schema';

import { User } from '../users/schemas/user.schema';
import { AdjustBalanceDto } from './dto/adjust-balance.dto';
import { TransferDto } from './dto/transfer.dto';

@Injectable()
export class WalletsOperationsService {
  private readonly logger = new Logger(WalletsOperationsService.name);

  constructor(
    @InjectModel(Wallet.name) private walletModel: Model<WalletDocument>,
    @InjectModel(LedgerEntry.name) private ledgerModel: Model<LedgerEntryDocument>,
    @InjectModel(User.name) private userModel: Model<any>,
    @InjectConnection() private connection: Connection,
  ) {}

  /** Ensure wallet exists (idempotent upsert) */
  private async ensureWallet(userId: string, session?: ClientSession): Promise<WalletDocument> {
    const wallet = await this.walletModel.findOneAndUpdate(
      { userId: new Types.ObjectId(userId) },
      { $setOnInsert: { userId: new Types.ObjectId(userId), balance: 0 } },
      { upsert: true, new: true, session },
    );
    if (!wallet) throw new NotFoundException('Không thể tạo ví');
    return wallet;
  }

  // ══════════════════════════════════════════════════════════════════
  //  SESSION DEDUCT (Trừ tiền khi session FINALIZED)
  // ══════════════════════════════════════════════════════════════════

  /**
   * Trừ tiền ví PH khi buổi học được FINALIZED.
   * Gọi từ Sessions module.
   */
  async deductForSession(
    params: {
      parentUserId: string;
      sessionId: string;
      classId: string;
      studentId: string;
      amount: number;
      pricePerSession?: number;
    },
    systemUserId?: string,
  ): Promise<LedgerEntryDocument> {
    const mongoSession = await this.connection.startSession();
    mongoSession.startTransaction();

    try {
      // Idempotency check: prevent double deduction for same session
      const existingDeduct = await this.ledgerModel.findOne({
        type: TransactionType.SESSION_DEDUCT,
        sessionId: new Types.ObjectId(params.sessionId),
        status: TransactionStatus.COMPLETED,
      }).session(mongoSession).lean();
      if (existingDeduct) {
        // Verify params match để phát hiện retry với amount khác
        if (
          existingDeduct.amount !== params.amount ||
          existingDeduct.studentId?.toString() !== params.studentId
        ) {
          await mongoSession.abortTransaction();
          this.logger.warn(
            `Idempotency mismatch session ${params.sessionId}: ` +
            `existing amount=${existingDeduct.amount}, requested=${params.amount}`,
          );
          throw new BadRequestException(
            `Đã tồn tại giao dịch trừ tiền cho buổi học này với số tiền khác ` +
            `(${existingDeduct.amount}đ vs ${params.amount}đ). Vui lòng kiểm tra lại.`,
          );
        }
        await mongoSession.abortTransaction();
        return existingDeduct as any;
      }

      // Read wallet INSIDE transaction to prevent stale-balance races
      const wallet = await this.ensureWallet(params.parentUserId, mongoSession);
      if (!wallet) {
        throw new NotFoundException('Không thể tạo ví cho phụ huynh');
      }

      if (wallet.status === WalletStatus.FROZEN) {
        throw new BadRequestException('Ví đang bị đóng băng, không thể trừ tiền');
      }

      // ── Atomic check + deduct: embed debt limit vào query filter ──
      const effectiveDebtLimit = this.calcDebtLimit(wallet, params.pricePerSession);
      const minimumRequiredBalance = params.amount - effectiveDebtLimit;
      const balanceBefore = wallet.balance;

      const atomicResult = await this.walletModel.findOneAndUpdate(
        {
          _id: wallet._id,
          balance: { $gte: minimumRequiredBalance },
        },
        {
          $inc: { balance: -params.amount, totalDeducted: params.amount },
          $set: { lastTransactionAt: new Date() },
        },
        { session: mongoSession, new: true },
      );

      if (!atomicResult) {
        const currentWallet = await this.walletModel.findById(wallet._id).session(mongoSession);
        throw new BadRequestException(
          `Vượt giới hạn nợ. Số dư: ${(currentWallet?.balance ?? wallet.balance).toLocaleString('vi-VN')}đ, ` +
          `giới hạn nợ: -${effectiveDebtLimit.toLocaleString('vi-VN')}đ. ` +
          `Phụ huynh cần nạp thêm tiền.`,
        );
      }

      const entry = await this.ledgerModel.create(
        [
          {
            walletId: wallet._id,
            userId: wallet.userId,
            type: TransactionType.SESSION_DEDUCT,
            status: TransactionStatus.COMPLETED,
            amount: params.amount,
            balanceBefore,
            balanceAfter: atomicResult.balance,
            description: `Trừ tiền buổi học`,
            sessionId: new Types.ObjectId(params.sessionId),
            classId: new Types.ObjectId(params.classId),
            studentId: new Types.ObjectId(params.studentId),
            paymentMethod: PaymentMethod.SYSTEM,
            createdBy: systemUserId ? new Types.ObjectId(systemUserId) : undefined,
          },
        ],
        { session: mongoSession },
      );

      await mongoSession.commitTransaction();
      this.logger.log(
        `Session deduct: ${params.amount}đ from wallet ${wallet._id} (session: ${params.sessionId})`,
      );

      // ─── Grace Period: Cảnh báo khi ví cạn/âm ────────────────────────────
      if (atomicResult.balance <= 0) {
        const debtSessions = params.pricePerSession && params.pricePerSession > 0
          ? Math.ceil(Math.abs(atomicResult.balance) / params.pricePerSession)
          : Math.abs(Math.floor(atomicResult.balance / params.amount));

        this.logger.warn(
          `LOW_BALANCE_ALERT: Wallet ${wallet._id} balance=${atomicResult.balance}đ ` +
          `(nợ ~${debtSessions} buổi). Parent ${params.parentUserId} cần nạp tiền.`,
        );

        setImmediate(() => {
          this.emitLowBalanceAlert({
            walletId: wallet._id.toString(),
            parentUserId: params.parentUserId,
            studentId: params.studentId,
            currentBalance: atomicResult.balance,
            debtSessions,
            effectiveDebtLimit,
            pricePerSession: params.pricePerSession,
          });
        });
      }

      return entry[0];
    } catch (err) {
      await mongoSession.abortTransaction();
      throw err;
    } finally {
      mongoSession.endSession();
    }
  }

  // ══════════════════════════════════════════════════════════════════
  //  REFUND (Hoàn tiền khi huỷ buổi)
  // ══════════════════════════════════════════════════════════════════

  /**
   * Hoàn tiền vào ví PH khi buổi học bị huỷ.
   */
  async refundForSession(
    params: {
      parentUserId: string;
      sessionId: string;
      classId: string;
      studentId: string;
      refundAmount: number;
    },
    systemUserId?: string,
  ): Promise<LedgerEntryDocument | null> {
    if (params.refundAmount <= 0) return null;

    const mongoSession = await this.connection.startSession();
    mongoSession.startTransaction();

    try {
      // Idempotency check: prevent double refund for same session
      const existingRefund = await this.ledgerModel.findOne({
        type: TransactionType.REFUND,
        sessionId: new Types.ObjectId(params.sessionId),
        status: TransactionStatus.COMPLETED,
      }).session(mongoSession).lean();
      if (existingRefund) {
        if (existingRefund.amount !== params.refundAmount) {
          await mongoSession.abortTransaction();
          this.logger.warn(
            `Refund idempotency mismatch session ${params.sessionId}: ` +
            `existing=${existingRefund.amount}, requested=${params.refundAmount}`,
          );
          throw new BadRequestException(
            `Đã tồn tại giao dịch hoàn tiền cho buổi học này với số tiền khác.`,
          );
        }
        await mongoSession.abortTransaction();
        return existingRefund as any;
      }

      // Read wallet INSIDE transaction to prevent stale-balance races
      const wallet = await this.ensureWallet(params.parentUserId, mongoSession);
      if (!wallet) {
        throw new NotFoundException('Không thể tạo ví cho phụ huynh');
      }

      const balanceBefore = wallet.balance;
      
      // Use atomic $inc to prevent race conditions
      await this.walletModel.updateOne(
        { _id: wallet._id },
        {
          $inc: { balance: params.refundAmount, totalRefunded: params.refundAmount },
          $set: { lastTransactionAt: new Date() },
        },
        { session: mongoSession },
      );
      
      const updatedWallet = await this.walletModel.findById(wallet._id).session(mongoSession);

      const entry = await this.ledgerModel.create(
        [
          {
            walletId: wallet._id,
            userId: wallet.userId,
            type: TransactionType.REFUND,
            status: TransactionStatus.COMPLETED,
            amount: params.refundAmount,
            balanceBefore,
            balanceAfter: updatedWallet!.balance,
            description: `Hoàn tiền buổi học bị huỷ`,
            sessionId: new Types.ObjectId(params.sessionId),
            classId: new Types.ObjectId(params.classId),
            studentId: new Types.ObjectId(params.studentId),
            paymentMethod: PaymentMethod.SYSTEM,
            createdBy: systemUserId ? new Types.ObjectId(systemUserId) : undefined,
          },
        ],
        { session: mongoSession },
      );

      await mongoSession.commitTransaction();
      this.logger.log(
        `Refund: ${params.refundAmount}đ to wallet ${wallet._id} (session: ${params.sessionId})`,
      );
      return entry[0];
    } catch (err) {
      await mongoSession.abortTransaction();
      throw err;
    } finally {
      mongoSession.endSession();
    }
  }

  // ══════════════════════════════════════════════════════════════════
  //  ADJUST (Điều chỉnh thủ công)
  // ══════════════════════════════════════════════════════════════════

  /**
   * ACCOUNTING/DIRECTOR điều chỉnh số dư thủ công.
   */
  async adjustBalance(dto: AdjustBalanceDto, adjustedBy: string): Promise<LedgerEntryDocument> {
    const mongoSession = await this.connection.startSession();
    mongoSession.startTransaction();

    try {
      const description = typeof dto.description === 'string' ? dto.description.trim() : '';
      const reason = typeof dto.reason === 'string' ? dto.reason.trim() : '';
      if (!description) {
        throw new BadRequestException('Mô tả điều chỉnh không được để trống');
      }
      if (!reason) {
        throw new BadRequestException('Lý do điều chỉnh không được để trống');
      }

      // Read wallet INSIDE transaction to prevent stale-balance
      const wallet = await this.ensureWallet(dto.userId, mongoSession);
      if (!wallet) {
        throw new NotFoundException('Không thể tạo ví cho user');
      }

      const balanceBefore = wallet.balance;
      const deltaAmount = dto.direction === 'ADD' ? dto.amount : -dto.amount;
      const totalField = dto.direction === 'ADD' ? 'totalTopUp' : 'totalDeducted';
      
      // Use atomic $inc to prevent race conditions
      await this.walletModel.updateOne(
        { _id: wallet._id },
        {
          $inc: { balance: deltaAmount, [totalField]: dto.amount },
          $set: { lastTransactionAt: new Date() },
        },
        { session: mongoSession },
      );

      const updatedWallet = await this.walletModel.findById(wallet._id).session(mongoSession);

      const adjustmentType = dto.adjustmentType || AdjustmentType.MANUAL_ADJUST;

      const entry = await this.ledgerModel.create(
        [
          {
            walletId: wallet._id,
            userId: wallet.userId,
            type: TransactionType.ADJUSTMENT,
            status: TransactionStatus.COMPLETED,
            amount: dto.amount,
            balanceBefore,
            balanceAfter: updatedWallet!.balance,
            description: `[${dto.direction}] ${description}`,
            adjustmentType,
            adjustmentReason: reason,
            paymentMethod: PaymentMethod.SYSTEM,
            approvedBy: new Types.ObjectId(adjustedBy),
            approvedAt: new Date(),
            createdBy: new Types.ObjectId(adjustedBy),
          },
        ],
        { session: mongoSession },
      );

      await mongoSession.commitTransaction();

      this.logger.log({
        event: 'WALLET_ADJUSTMENT',
        walletId: wallet._id.toString(),
        userId: wallet.userId.toString(),
        direction: dto.direction,
        amount: dto.amount,
        adjustmentType,
        reason,
        performedBy: adjustedBy,
        balanceBefore,
        balanceAfter: updatedWallet!.balance,
        timestamp: new Date().toISOString(),
      });

      return entry[0];
    } catch (err) {
      await mongoSession.abortTransaction();
      throw err;
    } finally {
      mongoSession.endSession();
    }
  }

  // ══════════════════════════════════════════════════════════════════
  //  TRANSFER (Chuyển tiền giữa 2 ví — không phí)
  // ══════════════════════════════════════════════════════════════════

  /**
   * Chuyển tiền từ ví A sang ví B, không phí.
   */
  async transferBetweenWallets(
    dto: TransferDto,
    performedBy: string,
  ): Promise<{ fromEntry: LedgerEntryDocument; toEntry: LedgerEntryDocument }> {
    if (dto.fromUserId === dto.toUserId) {
      throw new BadRequestException('Không thể chuyển cho chính mình');
    }

    const [fromUser, toUser] = await Promise.all([
      this.userModel.findById(dto.fromUserId, 'role fullName').lean() as Promise<{ _id: any; role: string; fullName: string } | null>,
      this.userModel.findById(dto.toUserId, 'role fullName').lean() as Promise<{ _id: any; role: string; fullName: string } | null>,
    ]);
    if (!fromUser) throw new NotFoundException('User gửi không tồn tại');
    if (!toUser) throw new NotFoundException('User nhận không tồn tại');
    if (fromUser.role !== 'PARENT') {
      throw new BadRequestException('Ví gửi phải thuộc phụ huynh (PARENT)');
    }
    if (toUser.role !== 'PARENT') {
      throw new BadRequestException('Ví nhận phải thuộc phụ huynh (PARENT)');
    }

    const mongoSession = await this.connection.startSession();
    mongoSession.startTransaction();

    try {
      const fromWallet = await this.walletModel
        .findOneAndUpdate(
          { userId: new Types.ObjectId(dto.fromUserId) },
          { $setOnInsert: { userId: new Types.ObjectId(dto.fromUserId), balance: 0 } },
          { upsert: true, new: true, session: mongoSession },
        );
      const toWallet = await this.walletModel
        .findOneAndUpdate(
          { userId: new Types.ObjectId(dto.toUserId) },
          { $setOnInsert: { userId: new Types.ObjectId(dto.toUserId), balance: 0 } },
          { upsert: true, new: true, session: mongoSession },
        );

      if (fromWallet.status === WalletStatus.FROZEN) {
        throw new BadRequestException('Ví gửi đang bị đóng băng');
      }
      if (toWallet.status === WalletStatus.FROZEN) {
        throw new BadRequestException('Ví nhận đang bị đóng băng');
      }
      if (fromWallet.balance < dto.amount) {
        throw new BadRequestException(
          `Số dư không đủ. Hiện tại: ${fromWallet.balance.toLocaleString('vi-VN')}đ`,
        );
      }

      const fromBalanceBefore = fromWallet.balance;
      await this.walletModel.updateOne(
        { _id: fromWallet._id },
        {
          $inc: { balance: -dto.amount, totalTransferOut: dto.amount },
          $set: { lastTransactionAt: new Date() },
        },
        { session: mongoSession },
      );

      const toBalanceBefore = toWallet.balance;
      await this.walletModel.updateOne(
        { _id: toWallet._id },
        {
          $inc: { balance: dto.amount, totalTransferIn: dto.amount },
          $set: { lastTransactionAt: new Date() },
        },
        { session: mongoSession },
      );
      
      const updatedFromWallet = await this.walletModel.findById(fromWallet._id).session(mongoSession);
      const updatedToWallet = await this.walletModel.findById(toWallet._id).session(mongoSession);

      const desc = dto.description || `Chuyển tiền ${dto.amount.toLocaleString('vi-VN')}đ`;

      const fromEntries = await this.ledgerModel.create(
        [
          {
            walletId: fromWallet._id,
            userId: fromWallet.userId,
            type: TransactionType.TRANSFER_OUT,
            status: TransactionStatus.COMPLETED,
            amount: dto.amount,
            balanceBefore: fromBalanceBefore,
            balanceAfter: updatedFromWallet!.balance,
            description: `[Chuyển đi → ${toUser.fullName}] ${desc}`,
            paymentMethod: PaymentMethod.SYSTEM,
            createdBy: new Types.ObjectId(performedBy),
          },
        ],
        { session: mongoSession },
      );

      const toEntries = await this.ledgerModel.create(
        [
          {
            walletId: toWallet._id,
            userId: toWallet.userId,
            type: TransactionType.TRANSFER_IN,
            status: TransactionStatus.COMPLETED,
            amount: dto.amount,
            balanceBefore: toBalanceBefore,
            balanceAfter: updatedToWallet!.balance,
            description: `[Nhận từ ${fromUser.fullName}] ${desc}`,
            paymentMethod: PaymentMethod.SYSTEM,
            createdBy: new Types.ObjectId(performedBy),
          },
        ],
        { session: mongoSession },
      );

      // Cross-reference
      fromEntries[0].relatedEntryId = toEntries[0]._id;
      toEntries[0].relatedEntryId = fromEntries[0]._id;
      await fromEntries[0].save({ session: mongoSession });
      await toEntries[0].save({ session: mongoSession });

      await mongoSession.commitTransaction();
      this.logger.log(
        `Transfer: ${dto.amount}đ from wallet ${fromWallet._id} → ${toWallet._id} by ${performedBy}`,
      );

      return { fromEntry: fromEntries[0], toEntry: toEntries[0] };
    } catch (err) {
      await mongoSession.abortTransaction();
      throw err;
    } finally {
      mongoSession.endSession();
    }
  }

  // ══════════════════════════════════════════════════════════════════
  //  PRIVATE HELPERS
  // ══════════════════════════════════════════════════════════════════

  /**
   * Tính giới hạn nợ tối đa cho ví.
   */
  private calcDebtLimit(wallet: WalletDocument, pricePerSession?: number): number {
    if (wallet.debtLimit > 0) return wallet.debtLimit;

    const trialSessions = wallet.trialDebtSessions ?? 2;
    if (trialSessions <= 0) return 0;

    if (!pricePerSession || pricePerSession <= 0) {
      this.logger.warn(
        `calcDebtLimit: pricePerSession=${pricePerSession} cho wallet ${wallet._id}. ` +
        `Debt limit = 0 (không cho nợ). Cần set wallet.debtLimit hoặc đảm bảo class.pricePerSession > 0.`,
      );
      return 0;
    }

    return trialSessions * pricePerSession;
  }

  /**
   * Bắn cảnh báo ví cạn/âm cho Sales team follow-up.
   */
  private emitLowBalanceAlert(data: {
    walletId: string;
    parentUserId: string;
    studentId: string;
    currentBalance: number;
    debtSessions: number;
    effectiveDebtLimit: number;
    pricePerSession?: number;
  }): void {
    this.logger.warn({
      event: 'WALLET_LOW_BALANCE_ALERT',
      walletId: data.walletId,
      parentUserId: data.parentUserId,
      studentId: data.studentId,
      balance: data.currentBalance,
      debtSessions: data.debtSessions,
      debtLimit: data.effectiveDebtLimit,
      pricePerSession: data.pricePerSession,
      requiresFollowUp: true,
      timestamp: new Date().toISOString(),
    });
  }
}
