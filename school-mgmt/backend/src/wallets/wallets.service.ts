import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, FilterQuery, ClientSession } from 'mongoose';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';

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
import { Invoice, InvoiceDocument } from '../invoices/schemas/invoice.schema';
import { BankAccount, BankAccountDocument, BankAccountStatus } from '../financial-control/schemas/bank-account.schema';
import { Role } from '../common/interfaces/role.enum';
import { Student, StudentDocument } from '../students/schemas/student.schema';
import { ParentAttribution, ParentAttributionDocument } from '../marketing-attribution/schemas/parent-attribution.schema';
import { normalizePhone } from '../marketing-attribution/parent-attribution.util';
import { TopUpRequestDto } from './dto/top-up-request.dto';
import { ApproveTopUpDto } from './dto/approve-top-up.dto';
import { AdjustBalanceDto } from './dto/adjust-balance.dto';
import { QueryLedgerDto } from './dto/query-ledger.dto';
import { TransferDto } from './dto/transfer.dto';

@Injectable()
export class WalletsService {
  private readonly logger = new Logger(WalletsService.name);

  constructor(
    @InjectModel(Wallet.name) private walletModel: Model<WalletDocument>,
    @InjectModel(LedgerEntry.name) private ledgerModel: Model<LedgerEntryDocument>,
    @InjectModel(User.name) private userModel: Model<any>,
    @InjectModel(Invoice.name) private invoiceModel: Model<InvoiceDocument>,
    @InjectModel(BankAccount.name) private bankAccountModel: Model<BankAccountDocument>,
    @InjectModel(Student.name) private studentModel: Model<StudentDocument>,
    @InjectModel(ParentAttribution.name)
    private parentAttributionModel: Model<ParentAttributionDocument>,
    @InjectConnection() private connection: Connection,
  ) {}

  // ══════════════════════════════════════════════════════════════════
  //  WALLET CRUD
  // ══════════════════════════════════════════════════════════════════

  /** Tạo ví mới cho user (idempotent, có thể chạy trong transaction) */
  async createWallet(userId: string, mongoSession?: ClientSession): Promise<WalletDocument> {
    const wallet = await this.walletModel
      .findOneAndUpdate(
        { userId: new Types.ObjectId(userId) },
        { $setOnInsert: { userId: new Types.ObjectId(userId), balance: 0 } },
        { upsert: true, new: true, session: mongoSession },
      );
    if (!wallet) {
      throw new NotFoundException('Không thể tạo ví');
    }
    return wallet;
  }

  /** Lấy ví theo userId, auto-create nếu chưa có */
  async getOrCreateWallet(userId: string): Promise<WalletDocument> {
    return this.createWallet(userId);
  }

  /** Bản trả về cho UI: luôn kèm user profile + ad attribution nếu có */
  async getOrCreateWalletView(userId: string) {
    await this.createWallet(userId);
    return this.getWalletViewByUserId(userId);
  }

  async getWalletViewByUserId(userId: string) {
    const wallet = await this.walletModel.findOne({ userId: new Types.ObjectId(userId) }).lean();
    if (!wallet) throw new NotFoundException('Ví không tồn tại cho user này');
    const [decorated] = await this.decorateWallets([wallet]);
    return decorated;
  }

  /** Lấy ví theo ID */
  async findWalletById(walletId: string): Promise<WalletDocument> {
    const wallet = await this.walletModel.findById(walletId);
    if (!wallet) throw new NotFoundException('Ví không tồn tại');
    return wallet;
  }

  /** Lấy ví theo userId */
  async findWalletByUserId(userId: string): Promise<WalletDocument> {
    const wallet = await this.walletModel.findOne({ userId: new Types.ObjectId(userId) });
    if (!wallet) throw new NotFoundException('Ví không tồn tại cho user này');
    return wallet;
  }

  /** Đóng băng ví */
  async freezeWallet(userId: string): Promise<WalletDocument> {
    const wallet = await this.findWalletByUserId(userId);
    wallet.status = WalletStatus.FROZEN;
    return wallet.save();
  }

  /** Mở lại ví */
  async unfreezeWallet(userId: string): Promise<WalletDocument> {
    const wallet = await this.findWalletByUserId(userId);
    wallet.status = WalletStatus.ACTIVE;
    return wallet.save();
  }

  private walletOwnerId(wallet: any): string | null {
    const userId = wallet?.userId?._id || wallet?.userId;
    return userId ? userId.toString() : null;
  }

  private async decorateWallets(wallets: any[]) {
    if (!wallets.length) return [];

    const userIds = Array.from(
      new Set(
        wallets
          .map((wallet) => this.walletOwnerId(wallet))
          .filter((id): id is string => !!id && Types.ObjectId.isValid(id)),
      ),
    );

    const userObjectIds = userIds.map((id) => new Types.ObjectId(id));
    const users = userObjectIds.length
      ? await this.userModel
          .find({ _id: { $in: userObjectIds } })
          .select('_id fullName email phone role')
          .lean()
      : [];
    const userMap = new Map<string, any>(
      users.map((user: any) => [user._id.toString(), user]),
    );

    const parentUsers = users.filter((user: any) => user.role === Role.PARENT);
    const parentUserIds = parentUsers.map((user: any) => user._id);
    const normalizedPhones = Array.from(
      new Set(
        parentUsers
          .map((user: any) => normalizePhone(user.phone))
          .filter((phone): phone is string => !!phone),
      ),
    );

    const attributionOr: any[] = [];
    if (parentUserIds.length) attributionOr.push({ parentUserId: { $in: parentUserIds } });
    if (normalizedPhones.length) attributionOr.push({ normalizedParentPhone: { $in: normalizedPhones } });

    const attributions = attributionOr.length
      ? await this.parentAttributionModel
          .find({ $or: attributionOr })
          .select('parentUserId normalizedParentPhone adGroupId adGroupName platform lastConfirmedAt')
          .sort({ lastConfirmedAt: -1 })
          .lean()
      : [];

    const attributionByUserId = new Map<string, any>();
    const attributionByPhone = new Map<string, any>();

    for (const attribution of attributions as any[]) {
      const ownerId = attribution.parentUserId?.toString?.();
      if (ownerId && !attributionByUserId.has(ownerId)) {
        attributionByUserId.set(ownerId, attribution);
      }

      const normalizedParentPhone = normalizePhone(attribution.normalizedParentPhone);
      if (normalizedParentPhone && !attributionByPhone.has(normalizedParentPhone)) {
        attributionByPhone.set(normalizedParentPhone, attribution);
      }
    }

    const fallbackParentIds = parentUsers
      .map((user: any) => user._id.toString())
      .filter((userId) => {
        if (attributionByUserId.has(userId)) return false;
        const normalizedParentPhone = normalizePhone(userMap.get(userId)?.phone);
        return !normalizedParentPhone || !attributionByPhone.has(normalizedParentPhone);
      });

    const fallbackStudents = fallbackParentIds.length
      ? await this.studentModel
          .find({
            parentUserId: { $in: fallbackParentIds.map((id) => new Types.ObjectId(id)) },
            adGroupId: { $exists: true, $ne: null },
          })
          .select('parentUserId adGroupId adGroupName updatedAt createdAt')
          .sort({ updatedAt: -1, createdAt: -1 })
          .lean()
      : [];

    const fallbackStudentByParent = new Map<string, any>();
    for (const student of fallbackStudents as any[]) {
      const parentUserId = student.parentUserId?.toString?.();
      if (parentUserId && !fallbackStudentByParent.has(parentUserId)) {
        fallbackStudentByParent.set(parentUserId, student);
      }
    }

    return wallets.map((wallet) => {
      const ownerId = this.walletOwnerId(wallet);
      const user = ownerId ? userMap.get(ownerId) : null;
      const normalizedParentPhone = normalizePhone(user?.phone);
      const attribution =
        (ownerId ? attributionByUserId.get(ownerId) : null)
        || (normalizedParentPhone ? attributionByPhone.get(normalizedParentPhone) : null)
        || (ownerId ? fallbackStudentByParent.get(ownerId) : null);

      const adGroupId = attribution?.adGroupId?.toString?.();
      const isParentWallet = user?.role === Role.PARENT;
      const adAttributionSource = !attribution
        ? (isParentWallet ? 'UNATTRIBUTED' : null)
        : (attribution?.lastConfirmedAt ? 'PARENT_ATTRIBUTION' : 'STUDENT_FALLBACK');

      return {
        ...wallet,
        userId: user || wallet.userId,
        adGroupId,
        adGroupName: attribution?.adGroupName || '',
        adPlatform: attribution?.platform || '',
        adAttributionSource,
      };
    });
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

    const wallet = await this.getOrCreateWallet(dto.userId);

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
      
      // Use atomic $inc to prevent race conditions
      await this.walletModel.updateOne(
        { _id: entry.walletId },
        {
          $inc: { balance: entry.amount, totalTopUp: entry.amount },
          $set: { lastTransactionAt: new Date() },
        },
        { session },
      );
      
      // Get updated balance for balanceAfter
      const updatedWallet = await this.walletModel.findById(entry.walletId).session(session);

      // Update ledger entry
      entry.status = TransactionStatus.APPROVED;
      entry.balanceBefore = balanceBefore;
      entry.balanceAfter = updatedWallet!.balance;
      entry.approvedBy = new Types.ObjectId(approvedBy);
      entry.approvedAt = new Date();

      const approvalNotes: string[] = [];
      if (dto.accountingNotes?.trim()) {
        approvalNotes.push(dto.accountingNotes.trim());
      }
      if (entry.paymentMethod === PaymentMethod.BANK_TRANSFER) {
        const bankRef = dto.bankStatementRef?.trim();
        if (bankRef) {
          approvalNotes.push(`BANK_MATCHED_REF: ${bankRef}`);
          entry.transactionRef = bankRef;
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
      if (approvalNotes.length > 0) {
        entry.accountingNotes = approvalNotes.join(' | ');
      }

      await entry.save({ session });

      await session.commitTransaction();
      this.logger.log(
        `TopUp approved: ${entry.amount}đ → wallet ${wallet._id} (new balance: ${updatedWallet!.balance}đ)`,
      );
      return entry;
    } catch (err) {
      await session.abortTransaction();
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
    const mongoSession = options?.session || await this.connection.startSession();
    const ownsSession = !options?.session;
    if (ownsSession) mongoSession.startTransaction();

    try {
      const invoiceObjectId = new Types.ObjectId(params.invoiceId);

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
      const wallet = await this.createWallet(params.parentUserId, mongoSession);
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
      throw err;
    } finally {
      if (ownsSession) mongoSession.endSession();
    }
  }

  // ══════════════════════════════════════════════════════════════════
  //  REVERSE INVOICE TOP-UP (Rollback khi hủy hóa đơn APPROVED)
  // ══════════════════════════════════════════════════════════════════

  /**
   * BUG NGHIÊM TRỌNG fix: Rollback wallet top-up khi hủy hóa đơn APPROVED.
   * Gọi từ InvoicesService.cancelInvoice() trong cùng transaction.
   * Tạo ADJUSTMENT entry âm để trừ lại số tiền đã nạp.
   * Ví có thể về âm nếu PH đã dùng hết tiền (được phép).
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

    // Tìm original TOP_UP entry của invoice này
    const originalEntry = await this.ledgerModel
      .findOne({ type: TransactionType.TOP_UP, invoiceId: invoiceObjectId })
      .session(mongoSession || null)
      .exec();

    if (!originalEntry) {
      // Không có entry để reverse — trường hợp này không nên xảy ra nếu walletTopUpDone = true
      this.logger.warn(`reverseInvoiceTopUp: no TOP_UP entry found for invoice ${params.invoiceId}`);
      return null as any;
    }

    // Atomic decrement wallet balance (new: false để lấy balance trước khi trừ)
    const walletBefore = await this.walletModel.findOneAndUpdate(
      { _id: originalEntry.walletId },
      {
        $inc: { balance: -params.amount, totalTopUp: -params.amount },
        $set: { lastTransactionAt: new Date() },
      },
      { session: mongoSession, new: false },
    );

    if (!walletBefore) {
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
        description: `Hoàn tiền do hủy hóa đơn: ${params.reason}`,
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
      /** Giá 1 buổi (để tính debt limit nếu chưa set debtLimit cố định) */
      pricePerSession?: number;
    },
    systemUserId?: string, // Optional: ID of user triggering the deduction
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
      const wallet = await this.createWallet(params.parentUserId, mongoSession);
      if (!wallet) {
        throw new NotFoundException('Không thể tạo ví cho phụ huynh');
      }

      if (wallet.status === WalletStatus.FROZEN) {
        throw new BadRequestException('Ví đang bị đóng băng, không thể trừ tiền');
      }

      // ── Atomic check + deduct: embed debt limit vào query filter ──
      const effectiveDebtLimit = this.calcDebtLimit(wallet, params.pricePerSession);
      // balance - amount >= -effectiveDebtLimit  ===  balance >= amount - effectiveDebtLimit
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
      // Nếu balance sau khi trừ <= 0, tự động bắn cảnh báo cho Sales follow-up
      if (atomicResult.balance <= 0) {
        const debtSessions = params.pricePerSession && params.pricePerSession > 0
          ? Math.ceil(Math.abs(atomicResult.balance) / params.pricePerSession)
          : Math.abs(Math.floor(atomicResult.balance / params.amount));

        this.logger.warn(
          `LOW_BALANCE_ALERT: Wallet ${wallet._id} balance=${atomicResult.balance}đ ` +
          `(nợ ~${debtSessions} buổi). Parent ${params.parentUserId} cần nạp tiền.`,
        );

        // Emit event for Sales notification (runs after transaction committed)
        // Can be consumed by EventEmitter/Bull queue for async notifications
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
   * refundAmount đã được tính sẵn trong SessionsService (dựa vào cancelPolicy).
   */
  async refundForSession(
    params: {
      parentUserId: string;
      sessionId: string;
      classId: string;
      studentId: string;
      refundAmount: number;
    },
    systemUserId?: string, // Optional: ID of user triggering the refund
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
      const wallet = await this.createWallet(params.parentUserId, mongoSession);
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
      // Read wallet INSIDE transaction to prevent stale-balance
      const wallet = await this.createWallet(dto.userId, mongoSession);
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

      // Xác định loại điều chỉnh (mặc định MANUAL_ADJUST)
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
            description: `[${dto.direction}] ${dto.description}`,
            // ── Audit trail fields for compliance ──
            adjustmentType,
            adjustmentReason: dto.reason || dto.description, // Fallback to description if no reason
            paymentMethod: PaymentMethod.SYSTEM,
            approvedBy: new Types.ObjectId(adjustedBy),
            approvedAt: new Date(),
            createdBy: new Types.ObjectId(adjustedBy),
          },
        ],
        { session: mongoSession },
      );

      await mongoSession.commitTransaction();

      // Structured logging for audit
      this.logger.log({
        event: 'WALLET_ADJUSTMENT',
        walletId: wallet._id.toString(),
        userId: wallet.userId.toString(),
        direction: dto.direction,
        amount: dto.amount,
        adjustmentType,
        reason: dto.reason || dto.description,
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
   * Dành cho phụ huynh chuyển tiền cho học sinh khác.
   */
  async transferBetweenWallets(
    dto: TransferDto,
    performedBy: string,
  ): Promise<{ fromEntry: LedgerEntryDocument; toEntry: LedgerEntryDocument }> {
    if (dto.fromUserId === dto.toUserId) {
      throw new BadRequestException('Không thể chuyển cho chính mình');
    }

    // Validate cả hai user đều là PARENT (chỉ ví phụ huynh mới được transfer)
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
      // Lấy wallet trong session để tránh race condition
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

      // Trừ ví gửi - use atomic $inc
      const fromBalanceBefore = fromWallet.balance;
      await this.walletModel.updateOne(
        { _id: fromWallet._id },
        {
          $inc: { balance: -dto.amount, totalTransferOut: dto.amount },
          $set: { lastTransactionAt: new Date() },
        },
        { session: mongoSession },
      );

      // Cộng ví nhận - use atomic $inc
      const toBalanceBefore = toWallet.balance;
      await this.walletModel.updateOne(
        { _id: toWallet._id },
        {
          $inc: { balance: dto.amount, totalTransferIn: dto.amount },
          $set: { lastTransactionAt: new Date() },
        },
        { session: mongoSession },
      );
      
      // Refresh wallets to get updated balances
      const updatedFromWallet = await this.walletModel.findById(fromWallet._id).session(mongoSession);
      const updatedToWallet = await this.walletModel.findById(toWallet._id).session(mongoSession);

      const desc = dto.description || `Chuyển tiền ${dto.amount.toLocaleString('vi-VN')}đ`;

      // Ledger entry cho ví gửi
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

      // Ledger entry cho ví nhận
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

      // Cross-reference: liên kết 2 ledger entry đối ứng
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
  //  LEDGER QUERY (Lịch sử giao dịch)
  // ══════════════════════════════════════════════════════════════════

  async queryLedger(query: QueryLedgerDto) {
    const filter: FilterQuery<LedgerEntry> = {};

    if (query.userId) filter.userId = new Types.ObjectId(query.userId);
    if (query.walletId) filter.walletId = new Types.ObjectId(query.walletId);
    if (query.type) filter.type = query.type;
    if (query.status) filter.status = query.status;

    if (query.fromDate || query.toDate) {
      filter.createdAt = {};
      if (query.fromDate) filter.createdAt.$gte = new Date(query.fromDate);
      if (query.toDate) filter.createdAt.$lte = new Date(query.toDate);
    }

    const page = Number(query.page) || 1;
    const limit = Math.min(Number(query.limit) || 20, 100);
    const skip = (page - 1) * limit;
    const sort = query.sort || '-createdAt';

    const [data, total] = await Promise.all([
      this.ledgerModel
        .find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate('sessionId', 'scheduledDate scheduledStartTime status')
        .populate('classId', 'name code')
        .populate('studentId', 'fullName studentCode')
        .populate('approvedBy', 'fullName')
        .populate('createdBy', 'fullName')
        .lean(),
      this.ledgerModel.countDocuments(filter),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  /** Lấy danh sách topup PENDING (cho ACCOUNTING review) */
  async getPendingTopUps() {
    return this.ledgerModel
      .find({
        type: TransactionType.TOP_UP,
        status: TransactionStatus.PENDING,
      })
      .sort('-createdAt')
      .populate('userId', 'fullName email phone')
      .lean();
  }

  // ══════════════════════════════════════════════════════════════════
  //  STATS (Thống kê)
  // ══════════════════════════════════════════════════════════════════

  /** Tổng hợp thu chi theo khoảng thời gian */
  async getFinancialSummary(fromDate?: string, toDate?: string) {
    const match: FilterQuery<LedgerEntry> = {
      status: { $in: [TransactionStatus.APPROVED, TransactionStatus.COMPLETED] },
    };

    if (fromDate || toDate) {
      match.createdAt = {};
      if (fromDate) match.createdAt.$gte = new Date(fromDate);
      if (toDate) match.createdAt.$lte = new Date(toDate);
    }

    const result = await this.ledgerModel.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$type',
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
    ]);

    const summary: Record<string, { totalAmount: number; count: number }> = {};
    for (const r of result) {
      summary[r._id] = { totalAmount: r.totalAmount, count: r.count };
    }

    return summary;
  }

  /** Danh sách tất cả ví (cho ACCOUNTING/DIRECTOR) — hỗ trợ tìm kiếm & lọc */
  async getAllWallets(page = 1, limit = 20, search?: string, status?: string) {
    const skip = (page - 1) * limit;
    const filter: FilterQuery<Wallet> = {};

    if (status && Object.values(WalletStatus).includes(status as WalletStatus)) {
      filter.status = status;
    }

    // Nếu có search → tìm userId khớp fullName/email/phone trước
    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), 'i');
      const matchingUsers = await this.userModel
        .find(
          { $or: [{ fullName: regex }, { email: regex }, { phone: regex }] },
          '_id',
        )
        .lean();
      const userIds = matchingUsers.map((u: any) => u._id);
      filter.userId = { $in: userIds };
    }

    const [data, total] = await Promise.all([
      this.walletModel
        .find(filter)
        .sort('-balance')
        .skip(skip)
        .limit(limit)
        .populate('userId', 'fullName email phone role')
        .lean(),
      this.walletModel.countDocuments(filter),
    ]);

    const decoratedData = await this.decorateWallets(data);

    return {
      data: decoratedData,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  // ══════════════════════════════════════════════════════════════════
  //  SESSION EQUIVALENCE (Quy đổi số buổi theo thời lượng)
  // ══════════════════════════════════════════════════════════════════

  /**
   * Tính bảng quy đổi số buổi dựa trên per-minute rate từ Invoice.
   *
   * VD: Invoice 3,800,000 / 20 buổi / 70 phút
   *   → perMinuteRate = (3,800,000 / 20) / 70 = 2,714.29 đ/phút
   *   → 70 phút = 190,000 đ/buổi → ví 3,800,000 = 20 buổi
   *   → 90 phút = 244,286 đ/buổi → ví 3,800,000 ≈ 15.56 buổi
   *   → 45 phút = 122,143 đ/buổi → ví 3,800,000 ≈ 31.11 buổi
   */
  async getSessionEquivalence(params: {
    studentId: string;
    classId: string;
    requesterParentUserId?: string;
  }) {
    // 1) Tìm invoice APPROVED mới nhất cho student + class
    const invoice = await this.invoiceModel.findOne({
      studentId: new Types.ObjectId(params.studentId),
      classId: new Types.ObjectId(params.classId),
      status: 'APPROVED',
      perMinuteRate: { $gt: 0 },
    }).sort('-createdAt').lean();

    if (!invoice) {
      throw new NotFoundException(
        'Không tìm thấy hóa đơn đã duyệt cho học sinh này trong lớp này',
      );
    }

    // 2) Lấy ví phụ huynh
    const student = await this.userModel.db
      .collection('students')
      .findOne({ _id: new Types.ObjectId(params.studentId) });
    if (!student?.parentUserId) {
      throw new NotFoundException('Không tìm thấy phụ huynh của học sinh');
    }
    if (
      params.requesterParentUserId &&
      student.parentUserId.toString() !== params.requesterParentUserId
    ) {
      throw new ForbiddenException('Bạn không có quyền tra cứu học sinh không thuộc mình');
    }

    const wallet = await this.walletModel
      .findOne({ userId: student.parentUserId })
      .lean();

    const balance = wallet?.balance ?? 0;
    const perMinuteRate = invoice.perMinuteRate!;
    const referenceDuration = invoice.referenceDuration!;
    const pricePerSession = invoice.pricePerSession!;

    // 3) Bảng quy đổi cho các thời lượng phổ biến
    const commonDurations = [30, 45, 60, 70, 90, 120];
    // Đảm bảo referenceDuration nằm trong danh sách
    if (!commonDurations.includes(referenceDuration)) {
      commonDurations.push(referenceDuration);
      commonDurations.sort((a, b) => a - b);
    }

    const equivalenceTable = commonDurations.map((duration) => {
      const priceForDuration = Math.round(perMinuteRate * duration);
      const sessionsAvailable = priceForDuration > 0
        ? Math.floor((balance / priceForDuration) * 100) / 100 // 2 decimal places
        : 0;
      return {
        durationMinutes: duration,
        pricePerSession: priceForDuration,
        sessionsAvailable,
        isReferenceDuration: duration === referenceDuration,
      };
    });

    return {
      studentId: params.studentId,
      classId: params.classId,
      invoiceId: (invoice as any)._id,
      invoiceNumber: (invoice as any).invoiceNumber,
      walletBalance: balance,
      perMinuteRate: Math.round(perMinuteRate * 100) / 100,
      referenceDuration,
      pricePerReferenceDuration: pricePerSession,
      sessionsRemaining: (invoice as any).sessionsRemaining ?? null,
      equivalenceTable,
    };
  }

  // ══════════════════════════════════════════════════════════════════
  //  PRIVATE HELPERS
  // ══════════════════════════════════════════════════════════════════

  /**
   * Tính giới hạn nợ tối đa cho ví.
   * - Nếu wallet.debtLimit > 0 → dùng giá trị cố định (admin set)
   * - Nếu không → tính từ trialDebtSessions × pricePerSession
   *   (mặc định 2 buổi học thử)
   * - Nếu không biết pricePerSession → fallback = 0 (không cho nợ)
   */
  private calcDebtLimit(wallet: WalletDocument, pricePerSession?: number): number {
    // Admin set debtLimit cố định
    if (wallet.debtLimit > 0) return wallet.debtLimit;

    // Tính từ số buổi trial cho phép nợ
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
   * Trong production, có thể kết nối với:
   * - EventEmitter2 để publish event 'wallet.lowBalance'
   * - Bull queue để gửi notification async
   * - Slack/Telegram webhook
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
    // Log structured data for monitoring/alerting systems
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

    // TODO: Integrate with notification system when available
    // Example integrations:
    // - this.eventEmitter.emit('wallet.lowBalance', data);
    // - this.notificationQueue.add('lowBalanceAlert', data);
    // - Post to Slack/Telegram webhook
  }

  // ══════════════════════════════════════════════════════════════════
  //  NIGHTLY LEDGER BALANCE VERIFICATION (Đối soát số dư hàng đêm)
  // ══════════════════════════════════════════════════════════════════

  /**
   * Chạy lúc 02:00 sáng hàng ngày.
   * Đối soát số dư ví với giao dịch cuối cùng trong ledger.
   *
   * Nguyên tắc bất biến: wallet.balance === lastCompletedEntry.balanceAfter
   * Nếu sai lệch → ghi log WARN để kế toán review thủ công.
   */
  @Cron('0 2 * * *', { name: 'nightly-ledger-balance-verification' })
  async runNightlyLedgerVerification(): Promise<void> {
    this.logger.log('[CRON] Bắt đầu đối soát số dư ví...');
    const { checked, issues } = await this.runManualLedgerVerification();

    if (issues.length === 0) {
      this.logger.log(
        `[CRON] Đối soát hoàn tất: ${checked} ví đã kiểm tra, KHÔNG có sai lệch ✓`,
      );
    } else {
      this.logger.error(
        `[CRON] Đối soát hoàn tất: ${checked} ví kiểm tra, ` +
        `${issues.length} ví SAI LỆCH — cần kế toán xem xét:\n` +
        issues.map(i =>
          `  • Wallet ${i.walletId}: system=${i.systemBalance}đ, ledger=${i.ledgerBalance}đ, diff=${i.diff}đ`
        ).join('\n'),
      );
    }
  }

  /**
   * Đối soát thủ công theo yêu cầu (DIRECTOR/ACCOUNTING có thể gọi qua API).
   * Trả về danh sách ví bị sai lệch để review.
   */
  async runManualLedgerVerification(): Promise<{
    checked: number;
    discrepancies: number;
    issues: Array<{ walletId: string; userId: string; systemBalance: number; ledgerBalance: number; diff: number }>;
  }> {
    const walletCount = await this.walletModel.countDocuments({ status: { $ne: 'CLOSED' } });

    const issues = await this.ledgerModel.aggregate([
      // Sort to get the latest entry first for each wallet
      { $sort: { walletId: 1, createdAt: -1 } },
      // Group by walletId and take the very first document (the latest one)
      {
        $group: {
          _id: '$walletId',
          lastBalanceAfter: { $first: '$balanceAfter' },
        },
      },
      // Join with the wallets collection
      {
        $lookup: {
          from: 'wallets',
          localField: '_id',
          foreignField: '_id',
          as: 'walletInfo',
        },
      },
      { $unwind: '$walletInfo' },
      // Project to calculate the difference
      {
        $project: {
          walletId: '$_id',
          userId: '$walletInfo.userId',
          systemBalance: '$walletInfo.balance',
          ledgerBalance: { $ifNull: ['$lastBalanceAfter', 0] },
          diff: { $subtract: ['$walletInfo.balance', { $ifNull: ['$lastBalanceAfter', 0] }] },
        },
      },
      // Filter only those with a non-zero difference
      { $match: { diff: { $ne: 0 } } },
    ]);

    return { checked: walletCount, discrepancies: issues.length, issues };
  }
}

/*
  // OLD IMPLEMENTATION (N+1 queries)
  async runManualLedgerVerification_OLD(): Promise<{
    checked: number;
    discrepancies: number;
    issues: Array<{ walletId: string; userId: string; systemBalance: number; ledgerBalance: number; diff: number }>;
  }> {
    const wallets = await this.walletModel
      .find({ status: { $ne: 'CLOSED' } })
      .select('_id userId balance')
      .lean();

    let checked = 0;
    const issues: Array<{ walletId: string; userId: string; systemBalance: number; ledgerBalance: number; diff: number }> = [];

    for (const wallet of wallets) {
      checked++;

      const lastEntry = await this.ledgerModel.findOne({
          walletId: wallet._id,
          status: { $in: [TransactionStatus.APPROVED, TransactionStatus.COMPLETED] },
        })
        .sort({ createdAt: -1 })
        .select('balanceAfter')
        .lean();

      const expectedBalance = lastEntry ? lastEntry.balanceAfter : 0;
      const actualBalance = wallet.balance ?? 0;

      if (Math.abs(actualBalance - expectedBalance) > 0) {
        issues.push({
          walletId: wallet._id.toString(),
          userId: wallet.userId.toString(),
          systemBalance: actualBalance,
          ledgerBalance: expectedBalance,
          diff: (actualBalance || 0) - expectedBalance,
        });
      }
    }

    return { checked, discrepancies: issues.length, issues };
  }
*/
