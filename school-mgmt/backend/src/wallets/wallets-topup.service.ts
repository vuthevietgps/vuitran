import {
  BadRequestException,
  ConflictException,
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

import { BankAccount, BankAccountDocument, BankAccountStatus } from '../financial-control/schemas/bank-account.schema';
import { TopUpRequestDto } from './dto/top-up-request.dto';
import { ApproveTopUpDto } from './dto/approve-top-up.dto';

@Injectable()
export class WalletsTopUpService {
  private readonly logger = new Logger(WalletsTopUpService.name);

  constructor(
    @InjectModel(Wallet.name) private walletModel: Model<WalletDocument>,
    @InjectModel(LedgerEntry.name) private ledgerModel: Model<LedgerEntryDocument>,
    @InjectModel(BankAccount.name) private bankAccountModel: Model<BankAccountDocument>,
    @InjectConnection() private connection: Connection,
  ) {}

  private isDuplicateKeyError(err: unknown): boolean {
    const code = (err as { code?: unknown } | undefined)?.code;
    if (code === 11000) return true;

    const message = String((err as { message?: unknown } | undefined)?.message || '');
    return message.includes('E11000 duplicate key error');
  }

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
  //  TOP-UP (Nạp tiền)
  // ══════════════════════════════════════════════════════════════════

  /**
   * PH hoặc OPS tạo yêu cầu nạp tiền → PENDING
   * Chưa cộng balance, chờ ACCOUNTING duyệt.
   */
  async requestTopUp(dto: TopUpRequestDto, createdBy: string): Promise<LedgerEntryDocument> {
    if (
      dto.paymentMethod === PaymentMethod.BANK_TRANSFER &&
      !dto.receiptImageUrl?.trim()
    ) {
      throw new BadRequestException(
        'Top-up via bank transfer requires receiptImageUrl',
      );
    }

    const wallet = await this.ensureWallet(dto.userId);

    const entry = await this.ledgerModel.create({
      walletId: wallet._id,
      userId: wallet.userId,
      type: TransactionType.TOP_UP,
      status: TransactionStatus.PENDING,
      amount: dto.amount,
      balanceBefore: wallet.balance,
      balanceAfter: wallet.balance, // Chưa thay đổi
      description: dto.description || `Nạp tiền ${dto.amount.toLocaleString('vi-VN')}đ`,
      paymentMethod: dto.paymentMethod,
      transactionRef: dto.transactionRef,
      receiptImageUrl: dto.receiptImageUrl,
      createdBy: new Types.ObjectId(createdBy),
    });

    return entry;
  }

  /**
   * ACCOUNTING duyệt yêu cầu nạp tiền → APPROVED → cộng balance
   */
  async approveTopUp(
    ledgerEntryId: string,
    approvedBy: string,
    dto: ApproveTopUpDto,
  ): Promise<LedgerEntryDocument> {
    const session = await this.connection.startSession();
    session.startTransaction();

    try {
      const entry = await this.ledgerModel.findById(ledgerEntryId).session(session);
      if (!entry) throw new NotFoundException('Giao dịch không tồn tại');

      if (entry.status !== TransactionStatus.PENDING) {
        throw new BadRequestException('Giao dịch đã được xử lý');
      }
      if (entry.type !== TransactionType.TOP_UP) {
        throw new BadRequestException('Chỉ duyệt được giao dịch nạp tiền');
      }
      if (
        entry.paymentMethod === PaymentMethod.BANK_TRANSFER &&
        !entry.receiptImageUrl
      ) {
        throw new BadRequestException(
          'Yeu cau nap chuyen khoan thieu anh bien lai',
        );
      }
      if (
        entry.paymentMethod === PaymentMethod.BANK_TRANSFER &&
        dto.bankMatched !== true
      ) {
        throw new BadRequestException(
          'Can xac nhan doi soat sao ke truoc khi duyet',
        );
      }
      if (
        dto.bankAccountId &&
        entry.paymentMethod !== PaymentMethod.BANK_TRANSFER
      ) {
        throw new BadRequestException('bankAccountId chi ap dung cho giao dich chuyen khoan');
      }

      // Update wallet balance atomically (prevent race condition)
      const wallet = await this.walletModel.findById(entry.walletId).session(session);
      if (!wallet) throw new NotFoundException('Ví không tồn tại');

      const balanceBefore = wallet.balance;
      

      const approvalNotes: string[] = [];
      let transactionRef = entry.transactionRef;
      if (dto.accountingNotes?.trim()) {
        approvalNotes.push(dto.accountingNotes.trim());
      }
      if (entry.paymentMethod === PaymentMethod.BANK_TRANSFER) {
        const bankRef = dto.bankStatementRef?.trim();
        if (bankRef) {
          approvalNotes.push(`BANK_MATCHED_REF: ${bankRef}`);
          transactionRef = bankRef;
        } else {
          approvalNotes.push('BANK_MATCHED_REF: CONFIRMED');
        }
        if (dto.bankAccountId) {
          const bankAccount = await this.bankAccountModel.findOne({
            _id: new Types.ObjectId(dto.bankAccountId),
            status: BankAccountStatus.ACTIVE,
          }).session(session).lean();
          if (!bankAccount) {
            throw new BadRequestException('Tai khoan ngan hang doi soat khong hop le hoac khong hoat dong');
          }
          approvalNotes.push(`BANK_MATCHED_BANK_ACCOUNT_ID: ${dto.bankAccountId}`);
        }
      }
      const approvedAt = new Date();
      const claimedEntry = await this.ledgerModel.findOneAndUpdate(
        {
          _id: entry._id,
          status: TransactionStatus.PENDING,
          type: TransactionType.TOP_UP,
        },
        {
          $set: {
            status: TransactionStatus.APPROVED,
            approvedBy: new Types.ObjectId(approvedBy),
            approvedAt,
            ...(approvalNotes.length > 0 ? { accountingNotes: approvalNotes.join(' | ') } : {}),
            ...(transactionRef ? { transactionRef } : {}),
          },
        },
        { new: true, session },
      );
      if (!claimedEntry) {
        throw new BadRequestException('Giao dá»‹ch Ä‘Ã£ Ä‘Æ°á»£c xá»­ lÃ½');
      }

      await this.walletModel.updateOne(
        { _id: claimedEntry.walletId },
        {
          $inc: { balance: claimedEntry.amount, totalTopUp: claimedEntry.amount },
          $set: { lastTransactionAt: new Date() },
        },
        { session },
      );

      const updatedWallet = await this.walletModel.findById(claimedEntry.walletId).session(session);
      claimedEntry.balanceBefore = balanceBefore;
      claimedEntry.balanceAfter = updatedWallet!.balance;
      await claimedEntry.save({ session });

      await session.commitTransaction();
      this.logger.log(
        `TopUp approved: ${entry.amount}đ → wallet ${wallet._id} (new balance: ${updatedWallet!.balance}đ)`,
      );
      return claimedEntry;
    } catch (err) {
      const errorMessage = String((err as { message?: string } | undefined)?.message || '');
      try {
        await session.abortTransaction();
      } catch {
        // Ignore abort failures so the original conflict can be mapped below.
      }
      if (errorMessage.toLowerCase().includes('write conflict')) {
        const latestEntry = await this.ledgerModel.findById(ledgerEntryId).lean();
        if (latestEntry?.status && latestEntry.status !== TransactionStatus.PENDING) {
          throw new ConflictException('Giao dich da duoc xu ly');
        }
        throw new ConflictException('Giao dich dang duoc xu ly. Vui long thu lai sau');
      }
      throw err;
    } finally {
      session.endSession();
    }
  }

  /**
   * ACCOUNTING từ chối yêu cầu nạp tiền
   */
  async rejectTopUp(
    ledgerEntryId: string,
    rejectedBy: string,
    reason?: string,
  ): Promise<LedgerEntryDocument> {
    const entry = await this.ledgerModel.findById(ledgerEntryId);
    if (!entry) throw new NotFoundException('Giao dịch không tồn tại');

    if (entry.status !== TransactionStatus.PENDING) {
      throw new BadRequestException('Giao dịch đã được xử lý');
    }

    entry.status = TransactionStatus.REJECTED;
    entry.approvedBy = new Types.ObjectId(rejectedBy);
    entry.approvedAt = new Date();
    if (reason) entry.accountingNotes = reason;

    return entry.save();
  }

  // ══════════════════════════════════════════════════════════════════
  //  TOP-UP FROM INVOICE (Nạp tiền từ hóa đơn đã duyệt)
  // ══════════════════════════════════════════════════════════════════

  /**
   * Gọi từ InvoicesService khi Invoice TUITION được APPROVED.
   * Nạp thẳng vào ví PH (auto-approved, không chờ duyệt thêm).
   */
  async topUpFromInvoice(params: {
    parentUserId: string;
    invoiceId: string;
    invoiceNumber: string;
    amount: number;
    studentId: string;
    classId?: string;
    approvedBy: string;
  }, options?: { session?: ClientSession }): Promise<LedgerEntryDocument> {
    const invoiceObjectId = new Types.ObjectId(params.invoiceId);
    const mongoSession = options?.session || await this.connection.startSession();
    const ownsSession = !options?.session;
    if (ownsSession) mongoSession.startTransaction();

    try {
      // Idempotency by invoiceId: prevent duplicate wallet top-up for same invoice.
      const existingEntry = await this.ledgerModel.findOne({
        type: TransactionType.TOP_UP,
        status: TransactionStatus.APPROVED,
        invoiceId: invoiceObjectId,
      }).session(mongoSession).exec();
      if (existingEntry) {
        if (ownsSession) await mongoSession.commitTransaction();
        return existingEntry;
      }

      // Read wallet INSIDE transaction to prevent stale-balance races
      const wallet = await this.ensureWallet(params.parentUserId, mongoSession);
      if (!wallet) {
        throw new NotFoundException('Không thể tạo ví cho phụ huynh');
      }
      if (wallet.status === WalletStatus.FROZEN) {
        throw new BadRequestException('Ví đang bị đóng băng, không thể nạp tiền');
      }

      const balanceBefore = wallet.balance;

      // Use atomic $inc to prevent race conditions
      const updatedWallet = await this.walletModel.findOneAndUpdate(
        { _id: wallet._id },
        {
          $inc: { balance: params.amount, totalTopUp: params.amount },
          $set: { lastTransactionAt: new Date() },
        },
        { session: mongoSession, new: true },
      );
      if (!updatedWallet) {
        throw new NotFoundException('Ví không tồn tại');
      }

      const entry = await this.ledgerModel.create(
        [
          {
            walletId: wallet._id,
            userId: wallet.userId,
            type: TransactionType.TOP_UP,
            status: TransactionStatus.APPROVED,
            amount: params.amount,
            balanceBefore,
            balanceAfter: updatedWallet!.balance,
            description: `Nạp tiền từ hóa đơn ${params.invoiceNumber}`,
            studentId: new Types.ObjectId(params.studentId),
            classId: params.classId ? new Types.ObjectId(params.classId) : undefined,
            invoiceId: invoiceObjectId,
            paymentMethod: PaymentMethod.SYSTEM,
            approvedBy: new Types.ObjectId(params.approvedBy),
            approvedAt: new Date(),
            createdBy: new Types.ObjectId(params.approvedBy),
          },
        ],
        { session: mongoSession },
      );

      if (ownsSession) await mongoSession.commitTransaction();
      this.logger.log(
        `Invoice top-up: ${params.amount}đ → wallet ${wallet._id} (invoice: ${params.invoiceNumber})`,
      );
      return entry[0];
    } catch (err) {
      if (ownsSession) await mongoSession.abortTransaction();
      if (this.isDuplicateKeyError(err)) {
        const existingEntry = await this.ledgerModel.findOne({
          type: TransactionType.TOP_UP,
          status: TransactionStatus.APPROVED,
          invoiceId: invoiceObjectId,
        }).lean();
        if (existingEntry) {
          this.logger.warn(
            `Duplicate invoice top-up suppressed for invoice ${params.invoiceId} (${params.invoiceNumber})`,
          );
          return existingEntry as LedgerEntryDocument;
        }
        throw new ConflictException('Hoa don nay da duoc nap tien');
      }
      throw err;
    } finally {
      if (ownsSession) mongoSession.endSession();
    }
  }

  // ══════════════════════════════════════════════════════════════════
  //  REVERSE INVOICE TOP-UP (Rollback khi hủy hóa đơn APPROVED)
  // ══════════════════════════════════════════════════════════════════

  /**
   * Rollback wallet top-up khi hủy hóa đơn APPROVED.
   * Gọi từ InvoicesService.cancelInvoice() trong cùng transaction.
   * Tạo ADJUSTMENT entry âm để trừ lại số tiền đã nạp.
   */
  async reverseInvoiceTopUp(
    params: {
      invoiceId: string;
      amount: number;
      reason: string;
      cancelledBy: string;
    },
    options?: { session?: ClientSession },
  ): Promise<LedgerEntryDocument> {
    const mongoSession = options?.session;
    const invoiceObjectId = new Types.ObjectId(params.invoiceId);

    const existingAdjustment = await this.ledgerModel
      .findOne({
        type: TransactionType.ADJUSTMENT,
        invoiceId: invoiceObjectId,
        adjustmentType: AdjustmentType.INVOICE_CANCEL_ROLLBACK,
        status: TransactionStatus.COMPLETED,
      })
      .session(mongoSession || null)
      .exec();
    if (existingAdjustment) {
      this.logger.warn(
        `reverseInvoiceTopUp: clawback already exists for invoice ${params.invoiceId}`,
      );
      return existingAdjustment;
    }

    // Tìm original TOP_UP entry của invoice này
    const originalEntry = await this.ledgerModel
      .findOne({ type: TransactionType.TOP_UP, invoiceId: invoiceObjectId })
      .session(mongoSession || null)
      .exec();

    if (!originalEntry) {
      this.logger.warn(`reverseInvoiceTopUp: no TOP_UP entry found for invoice ${params.invoiceId}`);
      return null as any;
    }

    // Atomic decrement wallet balance (new: false để lấy balance trước khi trừ)
    const walletBefore = await this.walletModel.findOneAndUpdate(
      {
        _id: originalEntry.walletId,
        balance: { $gte: params.amount },
      },
      {
        $inc: { balance: -params.amount, totalTopUp: -params.amount },
        $set: { lastTransactionAt: new Date() },
      },
      { session: mongoSession, new: false },
    );

    if (!walletBefore) {
      const currentWallet = await this.walletModel
        .findById(originalEntry.walletId)
        .session(mongoSession || null)
        .lean();
      if (currentWallet) {
        throw new BadRequestException('So du vi khong du de hoan tac hoa don. Vi se bi am.');
      }
      throw new NotFoundException('Ví không tồn tại khi rollback invoice top-up');
    }

    const balanceBefore = walletBefore.balance;
    const balanceAfter = balanceBefore - params.amount;

    // Tạo ADJUSTMENT entry ghi nhận việc trừ tiền do hủy hóa đơn
    const [entry] = await this.ledgerModel.create(
      [{
        walletId: originalEntry.walletId,
        userId: originalEntry.userId,
        type: TransactionType.ADJUSTMENT,
        status: TransactionStatus.COMPLETED,
        amount: params.amount,
        balanceBefore,
        balanceAfter,
        description: `Clawback invoice top-up: ${params.reason}`,
        adjustmentType: AdjustmentType.INVOICE_CANCEL_ROLLBACK,
        adjustmentReason: params.reason,
        invoiceId: invoiceObjectId,
        paymentMethod: PaymentMethod.SYSTEM,
        approvedBy: new Types.ObjectId(params.cancelledBy),
        approvedAt: new Date(),
        createdBy: new Types.ObjectId(params.cancelledBy),
      }],
      mongoSession ? { session: mongoSession } : {},
    );

    this.logger.log(
      `Invoice top-up reversed: -${params.amount}đ from wallet ${originalEntry.walletId} (invoice: ${params.invoiceId})`,
    );

    return entry;
  }
}
