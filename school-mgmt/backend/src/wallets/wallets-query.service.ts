import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, FilterQuery } from 'mongoose';
import { Cron } from '@nestjs/schedule';

import { Wallet, WalletDocument, WalletStatus } from './schemas/wallet.schema';
import {
  LedgerEntry,
  LedgerEntryDocument,
  TransactionType,
  TransactionStatus,
} from './schemas/ledger-entry.schema';

import { User } from '../users/schemas/user.schema';
import { Invoice, InvoiceDocument } from '../invoices/schemas/invoice.schema';
import { Student, StudentDocument } from '../students/schemas/student.schema';
import { ParentAttribution, ParentAttributionDocument } from '../marketing-attribution/schemas/parent-attribution.schema';
import { normalizePhone } from '../marketing-attribution/parent-attribution.util';
import { Role } from '../common/interfaces/role.enum';
import { QueryLedgerDto } from './dto/query-ledger.dto';

@Injectable()
export class WalletsQueryService {
  private readonly logger = new Logger(WalletsQueryService.name);

  constructor(
    @InjectModel(Wallet.name) private walletModel: Model<WalletDocument>,
    @InjectModel(LedgerEntry.name) private ledgerModel: Model<LedgerEntryDocument>,
    @InjectModel(User.name) private userModel: Model<any>,
    @InjectModel(Invoice.name) private invoiceModel: Model<InvoiceDocument>,
    @InjectModel(Student.name) private studentModel: Model<StudentDocument>,
    @InjectModel(ParentAttribution.name)
    private parentAttributionModel: Model<ParentAttributionDocument>,
  ) {}

  // ══════════════════════════════════════════════════════════════════
  //  WALLET DECORATION (enrich wallet data with user + attribution)
  // ══════════════════════════════════════════════════════════════════

  private walletOwnerId(wallet: any): string | null {
    const userId = wallet?.userId?._id || wallet?.userId;
    return userId ? userId.toString() : null;
  }

  async decorateWallets(wallets: any[]) {
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

  async getSessionEquivalence(params: {
    studentId: string;
    classId: string;
    requesterParentUserId?: string;
  }) {
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

    const commonDurations = [30, 45, 60, 70, 90, 120];
    if (!commonDurations.includes(referenceDuration)) {
      commonDurations.push(referenceDuration);
      commonDurations.sort((a, b) => a - b);
    }

    const equivalenceTable = commonDurations.map((duration) => {
      const priceForDuration = Math.round(perMinuteRate * duration);
      const sessionsAvailable = priceForDuration > 0
        ? Math.floor((balance / priceForDuration) * 100) / 100
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
  //  NIGHTLY LEDGER BALANCE VERIFICATION (Đối soát số dư hàng đêm)
  // ══════════════════════════════════════════════════════════════════

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

  async runManualLedgerVerification(): Promise<{
    checked: number;
    discrepancies: number;
    issues: Array<{ walletId: string; userId: string; systemBalance: number; ledgerBalance: number; diff: number }>;
  }> {
    const walletCount = await this.walletModel.countDocuments({ status: { $ne: 'CLOSED' } });

    const issues = await this.ledgerModel.aggregate([
      { $sort: { walletId: 1, createdAt: -1 } },
      {
        $group: {
          _id: '$walletId',
          lastBalanceAfter: { $first: '$balanceAfter' },
        },
      },
      {
        $lookup: {
          from: 'wallets',
          localField: '_id',
          foreignField: '_id',
          as: 'walletInfo',
        },
      },
      { $unwind: '$walletInfo' },
      {
        $project: {
          walletId: '$_id',
          userId: '$walletInfo.userId',
          systemBalance: '$walletInfo.balance',
          ledgerBalance: { $ifNull: ['$lastBalanceAfter', 0] },
          diff: { $subtract: ['$walletInfo.balance', { $ifNull: ['$lastBalanceAfter', 0] }] },
        },
      },
      { $match: { diff: { $ne: 0 } } },
    ]);

    return { checked: walletCount, discrepancies: issues.length, issues };
  }
}
