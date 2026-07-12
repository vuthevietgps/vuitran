import { createHash } from 'crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel, InjectConnection } from '@nestjs/mongoose';
import { Model, Types, FilterQuery, Connection, ClientSession } from 'mongoose';

import {
  StaffPayroll,
  StaffPayrollDocument,
  StaffPayrollStatus,
} from './schemas/staff-payroll.schema';
import { WorkSessionsService } from '../work-sessions/work-sessions.service';
import { SalaryConfigService } from '../salary-config/salary-config.service';
import { FinancialControlBankFundService } from '../financial-control/financial-control-bank-fund.service';
import { CommissionType } from '../salary-config/schemas/salary-config.schema';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { Role } from '../common/interfaces/role.enum';

@Injectable()
export class StaffPayrollService {
  private readonly logger = new Logger(StaffPayrollService.name);

  constructor(
    @InjectModel(StaffPayroll.name) private staffPayrollModel: Model<StaffPayrollDocument>,
    @InjectConnection() private connection: Connection,
    private readonly workSessionsService: WorkSessionsService,
    private readonly salaryConfigService: SalaryConfigService,
    private readonly bankFundService: FinancialControlBankFundService,
  ) {}

  // ══════════════════════════════════════════════════════════════════
  //  GENERATE (Tạo bảng lương nhân viên)
  // ══════════════════════════════════════════════════════════════════

  async generate(dto: {
    userId: string;
    periodStart: string;
    periodEnd: string;
    bonusAmount?: number;
    deductionAmount?: number;
    notes?: string;
  }, createdBy: string): Promise<StaffPayrollDocument> {
    const periodStart = new Date(dto.periodStart);
    const periodEnd = new Date(dto.periodEnd);

    if (periodEnd <= periodStart) {
      throw new BadRequestException('Ngày kết thúc phải sau ngày bắt đầu');
    }

    // Check duplicate
    const existing = await this.staffPayrollModel.findOne({
      userId: new Types.ObjectId(dto.userId),
      periodStart: { $lte: periodEnd },
      periodEnd: { $gte: periodStart },
      status: { $nin: [StaffPayrollStatus.REJECTED] },
    });
    if (existing) {
      throw new BadRequestException(
        `Đã tồn tại bảng lương cho nhân viên này trong kỳ trùng (${existing.payrollCode})`,
      );
    }

    // 1. Lấy SalaryConfig
    const config = await this.salaryConfigService.findByUserId(dto.userId);
    if (!config) {
      throw new BadRequestException('Chưa cấu hình lương cho nhân viên này');
    }

    // 2. Lấy thông tin user
    const UserModel = this.connection.model('User');
    const user = await UserModel.findById(dto.userId).lean() as any;
    const isExperienceTeacher = user?.role === Role.EXPERIENCE_TEACHER;
    if (!user) throw new NotFoundException('Nhân viên không tồn tại');

    // 3. Tổng hợp WorkSession → giờ làm + lần muộn
    const workSummary = await this.workSessionsService.getSummary(
      dto.userId, periodStart, periodEnd,
    );

    const actualHours = workSummary.totalHours;
    const standardHours = config.standardHours;
    const attendanceRatio = Math.min(actualHours / standardHours, 1);
    const baseSalaryAmount = Math.round(config.baseSalary * attendanceRatio);
    const lateDays = workSummary.lateDays;
    const onTimeDays = Math.max((workSummary.totalSessions || 0) - lateDays, 0);
    const experienceMetrics = isExperienceTeacher
      ? await this.getExperienceTeacherPayrollMetrics(dto.userId, periodStart, periodEnd)
      : {
          experienceCaseCount: 0,
          successfulExperienceCaseCount: 0,
          totalRevenue: 0,
          homeworkGradingCount: 0,
        };

    // 4. Tính hoa hồng (từ Orders approved/completed trong kỳ)
    let totalRevenue = isExperienceTeacher ? experienceMetrics.totalRevenue : 0;
    let commissionAmount = 0;
    if (config.commissionEnabled && config.commissionTiers.length > 0) {
      if (!isExperienceTeacher) {
        totalRevenue = await this.getRevenueForUser(dto.userId, periodStart, periodEnd);
      }
      commissionAmount = this.calculateCommission(
        totalRevenue,
        config.commissionType as CommissionType,
        config.commissionTiers,
      );
    }

    // 5. Tính KPI bonus
    let kpiScore = 0;
    let kpiBonusPercentage = 0;
    let kpiBonusAmount = 0;
    if (config.kpiBonusEnabled && config.kpiBonusTiers.length > 0) {
      kpiScore = await this.getKpiScore(dto.userId, user.role, periodStart, periodEnd);
      kpiBonusPercentage = this.findKpiBonusPercentage(kpiScore, config.kpiBonusTiers);
      kpiBonusAmount = Math.round(config.baseSalary * kpiBonusPercentage / 100);
    }

    // 6. Tính phạt muộn
    const latePenaltyPerTime = config.latePenaltyAmount;
    const latePenaltyAmount = lateDays * latePenaltyPerTime;
    const punctualityBonusPerTime = config.punctualityBonusAmount ?? 0;
    const punctualityBonusAmount = onTimeDays * punctualityBonusPerTime;
    const experienceCaseRate = isExperienceTeacher ? (config.experienceCaseRate ?? 0) : 0;
    const experienceCaseAmount = experienceMetrics.experienceCaseCount * experienceCaseRate;
    const homeworkGradingRate = isExperienceTeacher ? (config.homeworkGradingRate ?? 0) : 0;
    const homeworkGradingAmount = experienceMetrics.homeworkGradingCount * homeworkGradingRate;

    // 7. Điều chỉnh thủ công
    const bonusAmount = dto.bonusAmount ?? 0;
    const deductionAmount = dto.deductionAmount ?? 0;

    // 8. Tổng thực nhận (tối thiểu 0 — phạt không vượt quá tổng lương)
    const netAmount = Math.max(
      0,
      baseSalaryAmount + commissionAmount + kpiBonusAmount
        + punctualityBonusAmount + experienceCaseAmount + homeworkGradingAmount
        - latePenaltyAmount + bonusAmount - deductionAmount,
    );

    // 9. FIX BUG #1: Dùng SHA-256 hash của full userId thay vì slice(-6)
    // để tránh collision khi 2 nhân viên có ObjectId kết thúc giống nhau.
    const ym = `${periodStart.getFullYear()}${String(periodStart.getMonth() + 1).padStart(2, '0')}`;
    const shortCode = createHash('sha256').update(dto.userId).digest('hex').slice(0, 8).toUpperCase();
    const payrollCode = `SPR-${ym}-${shortCode}`;

    const payroll = await this.staffPayrollModel.create({
      userId: new Types.ObjectId(dto.userId),
      userName: user.fullName,
      role: user.role,
      periodStart,
      periodEnd,
      payrollCode,

      baseSalary: config.baseSalary,
      standardHours,
      actualHours,
      attendanceRatio: Math.round(attendanceRatio * 10000) / 10000,
      baseSalaryAmount,

      totalRevenue,
      commissionType: config.commissionType,
      commissionTiers: config.commissionTiers,
      commissionAmount,

      kpiScore: Math.round(kpiScore * 100) / 100,
      kpiBonusTiers: config.kpiBonusTiers,
      kpiBonusPercentage,
      kpiBonusAmount,

      lateDays,
      latePenaltyPerTime,
      latePenaltyAmount,
      onTimeDays,
      punctualityBonusPerTime,
      punctualityBonusAmount,
      experienceCaseCount: experienceMetrics.experienceCaseCount,
      experienceCaseRate,
      experienceCaseAmount,
      successfulExperienceCaseCount: experienceMetrics.successfulExperienceCaseCount,
      homeworkGradingCount: experienceMetrics.homeworkGradingCount,
      homeworkGradingRate,
      homeworkGradingAmount,

      bonusAmount,
      deductionAmount,
      notes: dto.notes,

      netAmount,
      status: StaffPayrollStatus.DRAFT,
      createdBy: new Types.ObjectId(createdBy),
    });

    this.logger.log(
      `Staff payroll generated: ${payrollCode} | user=${user.fullName} | net=${netAmount}đ`,
    );
    return payroll;
  }

  // ══════════════════════════════════════════════════════════════════
  //  BULK GENERATE
  // ══════════════════════════════════════════════════════════════════

  async bulkGenerate(
    periodStart: string,
    periodEnd: string,
    createdBy: string,
  ): Promise<{ created: number; skipped: number; errors: string[] }> {
    // Lấy tất cả user có SalaryConfig ACTIVE
    const configs = await this.salaryConfigService.findAll({ status: 'ACTIVE', limit: 1000 });

    let created = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const config of configs.data) {
      try {
        const userId = (config.userId as any)?._id?.toString() || config.userId?.toString();
        await this.generate({ userId, periodStart, periodEnd }, createdBy);
        created++;
      } catch (err) {
        const msg = (err as Error).message;
        if (msg.includes('Đã tồn tại')) {
          skipped++;
        } else {
          const userName = (config.userId as any)?.fullName || 'N/A';
          errors.push(`${userName}: ${msg}`);
        }
      }
    }

    return { created, skipped, errors };
  }

  // ══════════════════════════════════════════════════════════════════
  //  QUERY
  // ══════════════════════════════════════════════════════════════════

  async findAll(query: {
    userId?: string;
    status?: StaffPayrollStatus;
    fromDate?: string;
    toDate?: string;
    page?: number;
    limit?: number;
  }) {
    const filter: FilterQuery<StaffPayroll> = {};

    if (query.userId) filter.userId = new Types.ObjectId(query.userId);
    if (query.status) filter.status = query.status;
    if (query.fromDate || query.toDate) {
      filter.periodStart = {};
      if (query.fromDate) filter.periodStart.$gte = new Date(query.fromDate);
      if (query.toDate) filter.periodStart.$lte = new Date(query.toDate);
    }

    const page = Number(query.page) || 1;
    const limit = Math.min(Number(query.limit) || 20, 100);
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.staffPayrollModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('userId', 'fullName email role')
        .populate('createdBy', 'fullName')
        .populate('approvedBy', 'fullName')
        .lean(),
      this.staffPayrollModel.countDocuments(filter),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findById(id: string, actor?: JwtPayload): Promise<StaffPayrollDocument> {
    const payroll = await this.staffPayrollModel
      .findById(id)
      .populate('userId', 'fullName email role')
      .populate('createdBy', 'fullName')
      .populate('approvedBy', 'fullName')
      .populate('paidBy', 'fullName');

    if (!payroll) throw new NotFoundException('Bảng lương không tồn tại');

    // Staff can only view their own
    if (actor && ![Role.DIRECTOR, Role.ACCOUNTING, Role.OPS].includes(actor.role)) {
      if (payroll.userId?.toString() !== actor.sub) {
        // FIX SECURITY: Dùng ForbiddenException (HTTP 403) thay vì BadRequestException (HTTP 400)
        throw new ForbiddenException('Bạn không có quyền xem bảng lương này');
      }
    }
    return payroll;
  }

  // ══════════════════════════════════════════════════════════════════
  //  UPDATE (chỉ DRAFT)
  // ══════════════════════════════════════════════════════════════════

  async update(id: string, dto: {
    bonusAmount?: number;
    deductionAmount?: number;
    notes?: string;
  }): Promise<StaffPayrollDocument> {
    const payroll = await this.staffPayrollModel.findById(id);
    if (!payroll) throw new NotFoundException('Bảng lương không tồn tại');
    if (payroll.status !== StaffPayrollStatus.DRAFT) {
      throw new BadRequestException('Chỉ sửa được bảng lương DRAFT');
    }

    if (dto.bonusAmount !== undefined) payroll.bonusAmount = dto.bonusAmount;
    if (dto.deductionAmount !== undefined) payroll.deductionAmount = dto.deductionAmount;
    if (dto.notes !== undefined) payroll.notes = dto.notes;

    // Recalc net (tối thiểu 0 — phạt không vượt quá tổng lương)
    payroll.netAmount = Math.max(
      0,
      payroll.baseSalaryAmount +
        payroll.commissionAmount +
        payroll.kpiBonusAmount +
        (payroll.punctualityBonusAmount || 0) +
        (payroll.experienceCaseAmount || 0) +
        (payroll.homeworkGradingAmount || 0) -
        payroll.latePenaltyAmount +
        payroll.bonusAmount -
        payroll.deductionAmount,
    );

    try {
      return await payroll.save();
    } catch (err) {
      this.throwIfVersionConflict(err);
    }
  }

  // ══════════════════════════════════════════════════════════════════
  //  WORKFLOW: SUBMIT → APPROVE → PAY
  // ══════════════════════════════════════════════════════════════════

  async submitForReview(id: string): Promise<StaffPayrollDocument> {
    const payroll = await this.staffPayrollModel.findById(id);
    if (!payroll) throw new NotFoundException('Bảng lương không tồn tại');
    if (payroll.status !== StaffPayrollStatus.DRAFT) {
      throw new BadRequestException('Chỉ submit được bảng lương DRAFT');
    }
    payroll.status = StaffPayrollStatus.PENDING_REVIEW;
    try {
      return await payroll.save();
    } catch (err) {
      this.throwIfVersionConflict(err);
    }
  }

  async approve(id: string, approvedBy: string): Promise<StaffPayrollDocument> {
    const payroll = await this.staffPayrollModel.findById(id);
    if (!payroll) throw new NotFoundException('Bảng lương không tồn tại');
    if (payroll.status !== StaffPayrollStatus.PENDING_REVIEW) {
      throw new BadRequestException('Chỉ duyệt được bảng lương PENDING_REVIEW');
    }
    payroll.status = StaffPayrollStatus.APPROVED;
    payroll.approvedBy = new Types.ObjectId(approvedBy);
    payroll.approvedAt = new Date();
    try {
      return await payroll.save();
    } catch (err) {
      this.throwIfVersionConflict(err);
    }
  }

  async reject(id: string, rejectedBy: string, reason: string): Promise<StaffPayrollDocument> {
    const payroll = await this.staffPayrollModel.findById(id);
    if (!payroll) throw new NotFoundException('Bảng lương không tồn tại');
    if (payroll.status !== StaffPayrollStatus.PENDING_REVIEW) {
      throw new BadRequestException('Chỉ từ chối được bảng lương PENDING_REVIEW');
    }
    payroll.status = StaffPayrollStatus.REJECTED;
    payroll.rejectionReason = reason;
    payroll.rejectedBy = new Types.ObjectId(rejectedBy);
    payroll.rejectedAt = new Date();
    try {
      return await payroll.save();
    } catch (err) {
      this.throwIfVersionConflict(err);
    }
  }

  async reopen(id: string): Promise<StaffPayrollDocument> {
    const payroll = await this.staffPayrollModel.findById(id);
    if (!payroll) throw new NotFoundException('Bảng lương không tồn tại');
    if (payroll.status !== StaffPayrollStatus.REJECTED) {
      throw new BadRequestException('Chỉ mở lại được bảng lương REJECTED');
    }
    payroll.status = StaffPayrollStatus.DRAFT;
    payroll.rejectionReason = undefined;
    payroll.rejectedBy = undefined;
    payroll.rejectedAt = undefined;
    try {
      return await payroll.save();
    } catch (err) {
      this.throwIfVersionConflict(err);
    }
  }

  /**
   * Xác nhận đã chi lương → PAID.
   * FIX BUG #6: Log warning nếu không cung cấp bankAccountId để audit trail.
   */
  async markPaid(
    id: string,
    paidBy: string,
    paymentRef?: string,
    bankAccountId?: string,
    paidByName?: string,
  ): Promise<StaffPayrollDocument> {
    const payroll = await this.staffPayrollModel.findById(id);
    if (!payroll) throw new NotFoundException('Bảng lương không tồn tại');
    if (payroll.status !== StaffPayrollStatus.APPROVED) {
      throw new BadRequestException('Chỉ chi lương được bảng lương APPROVED');
    }

    // Compatibility path for unit tests/mocks that do not provide Mongo transactions.
    if (typeof (this.connection as any).startSession !== 'function') {
      if (!bankAccountId && payroll.netAmount > 0) {
        this.logger.warn(
          `StaffPayroll ${payroll.payrollCode} mark-paid (compat mode) khong co bankAccountId, se khong tao bank transaction.`,
        );
      }

      payroll.status = StaffPayrollStatus.PAID;
      payroll.paidAt = new Date();
      payroll.paidBy = new Types.ObjectId(paidBy);
      if (paymentRef) payroll.paymentRef = paymentRef;

      try {
        const saved = await payroll.save();

        if (payroll.netAmount > 0 && bankAccountId) {
          await this.bankFundService.recordBankTransaction({
            bankAccountId,
            type: 'WITHDRAWAL',
            category: 'PAYROLL',
            amount: payroll.netAmount,
            transactionDate: payroll.paidAt.toISOString().split('T')[0],
            description: `Chi lương NV: ${payroll.payrollCode}`,
            reference: payroll.payrollCode,
            referenceId: (payroll as any)._id.toString(),
            referenceType: 'STAFF_PAYROLL',
          }, { _id: paidBy, fullName: paidByName || 'System' } as any);
        }

        return saved;
      } catch (err) {
        this.throwIfVersionConflict(err);
      }
    }

    const mongoSession = await this.connection.startSession();
    mongoSession.startTransaction();
    try {
      let effectiveBankAccountId: string | undefined;
      if (payroll.netAmount > 0) {
        effectiveBankAccountId = await this.resolveActiveBankAccountId(
          bankAccountId,
          mongoSession,
          'chi luong nhan vien',
        );
        if (!bankAccountId) {
          this.logger.warn(
            `StaffPayroll ${payroll.payrollCode} mark-paid khong truyen bankAccountId, da tu dong dung tai khoan ACTIVE mac dinh ${effectiveBankAccountId}.`,
          );
        }
      }

      payroll.status = StaffPayrollStatus.PAID;
      payroll.paidAt = new Date();
      payroll.paidBy = new Types.ObjectId(paidBy);
      if (paymentRef) payroll.paymentRef = paymentRef;
      await payroll.save({ session: mongoSession });

      if (payroll.netAmount > 0 && effectiveBankAccountId) {
        await this.bankFundService.recordBankTransaction({
          bankAccountId: effectiveBankAccountId,
          type: 'WITHDRAWAL',
          category: 'PAYROLL',
          amount: payroll.netAmount,
          transactionDate: payroll.paidAt.toISOString().split('T')[0],
          description: `Chi lương NV: ${payroll.payrollCode}`,
          reference: payroll.payrollCode,
          referenceId: (payroll as any)._id.toString(),
          referenceType: 'STAFF_PAYROLL',
        }, { _id: paidBy, fullName: paidByName || 'System' } as any, { session: mongoSession });
      }

      await mongoSession.commitTransaction();
      this.logger.log(
        `StaffPayroll ${payroll.payrollCode} marked PAID | net: ${payroll.netAmount}đ` +
          (effectiveBankAccountId ? ` | bank recorded ${effectiveBankAccountId}` : ' | no bank movement'),
      );
      return payroll;
    } catch (err) {
      await mongoSession.abortTransaction();
      this.throwIfVersionConflict(err);
    } finally {
      mongoSession.endSession();
    }
  }

  private async resolveActiveBankAccountId(
    requestedBankAccountId: string | undefined,
    mongoSession: ClientSession,
    context: string,
  ): Promise<string> {
    const BankAccountModel = this.connection.model('BankAccount');

    if (requestedBankAccountId) {
      if (!Types.ObjectId.isValid(requestedBankAccountId)) {
        throw new BadRequestException('bankAccountId khong hop le');
      }

      const requested = await BankAccountModel.findOne({
        _id: new Types.ObjectId(requestedBankAccountId),
        status: 'ACTIVE',
      })
        .select({ _id: 1 })
        .session(mongoSession)
        .lean();

      if (!requested) {
        throw new BadRequestException('Tai khoan ngan hang khong ton tai hoac khong ACTIVE');
      }
      return (requested as any)._id.toString();
    }

    const fallback = await BankAccountModel.findOne({ status: 'ACTIVE' })
      .sort({ isPrimary: -1, createdAt: -1 })
      .select({ _id: 1 })
      .session(mongoSession)
      .lean();

    if (!fallback) {
      throw new BadRequestException(
        `Khong co tai khoan ngan hang ACTIVE de ghi nhan giao dich ${context}`,
      );
    }

    return (fallback as any)._id.toString();
  }

  async remove(id: string): Promise<void> {
    const payroll = await this.staffPayrollModel.findById(id);
    if (!payroll) throw new NotFoundException('Bảng lương không tồn tại');
    if (payroll.status !== StaffPayrollStatus.DRAFT) {
      throw new BadRequestException('Chỉ xóa được bảng lương DRAFT');
    }
    await this.staffPayrollModel.findByIdAndDelete(id);
  }

  // ══════════════════════════════════════════════════════════════════
  //  STATS
  // ══════════════════════════════════════════════════════════════════

  async getSummary() {
    return this.staffPayrollModel.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalNet: { $sum: '$netAmount' },
        },
      },
    ]);
  }

  // ══════════════════════════════════════════════════════════════════
  //  HELPERS: Tính toán lương
  // ══════════════════════════════════════════════════════════════════

  /**
   * Lấy doanh thu từ Orders (approved/completed) gán cho user trong kỳ.
   */
  private async getRevenueForUser(userId: string, from: Date, to: Date): Promise<number> {
    const OrderModel = this.connection.model('Order');
    const result = await OrderModel.aggregate([
      {
        $match: {
          saleId: new Types.ObjectId(userId),
          status: { $in: ['APPROVED', 'COMPLETED'] },
          createdAt: { $gte: from, $lte: to },
        },
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$finalAmount' },
        },
      },
    ]);
    return result[0]?.totalRevenue || 0;
  }

  private async getExperienceTeacherPayrollMetrics(
    userId: string,
    from: Date,
    to: Date,
  ): Promise<{
    experienceCaseCount: number;
    successfulExperienceCaseCount: number;
    totalRevenue: number;
    homeworkGradingCount: number;
  }> {
    const TrialEnrollmentModel = this.connection.model('TrialEnrollment');
    const SessionModel = this.connection.model('Session');
    const teacherObjectId = new Types.ObjectId(userId);
    const activeTrialWindow = {
      $or: [
        { assessmentUpdatedAt: { $gte: from, $lte: to } },
        { decisionAt: { $gte: from, $lte: to } },
        { updatedAt: { $gte: from, $lte: to } },
      ],
    };

    const [caseRows, revenueRows, homeworkGradingCount] = await Promise.all([
      TrialEnrollmentModel.aggregate([
        {
          $match: {
            experienceTeacherId: teacherObjectId,
            ...activeTrialWindow,
          },
        },
        {
          $group: {
            _id: null,
            experienceCaseCount: {
              $sum: {
                $cond: [
                  {
                    $or: [
                      { $gt: [{ $ifNull: ['$trialSessionsUsed', 0] }, 0] },
                      { $ne: [{ $ifNull: ['$assessmentUpdatedAt', null] }, null] },
                      { $ne: [{ $ifNull: ['$assessmentScore', null] }, null] },
                      { $ne: [{ $ifNull: ['$assessmentNotes', null] }, null] },
                      { $ne: [{ $ifNull: ['$zoomRecordingUrl', null] }, null] },
                      { $gt: [{ $size: { $ifNull: ['$resultImageUrls', []] } }, 0] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
          },
        },
      ]),
      TrialEnrollmentModel.aggregate([
        {
          $match: {
            experienceTeacherId: teacherObjectId,
            status: 'CONVERTED',
            decisionAt: { $gte: from, $lte: to },
          },
        },
        { $lookup: { from: 'orders', localField: 'orderId', foreignField: '_id', as: 'order' } },
        { $lookup: { from: 'invoices', localField: 'invoiceId', foreignField: '_id', as: 'invoice' } },
        { $unwind: { path: '$order', preserveNullAndEmptyArrays: true } },
        { $unwind: { path: '$invoice', preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: null,
            successfulExperienceCaseCount: { $sum: 1 },
            totalRevenue: {
              $sum: {
                $ifNull: ['$order.finalAmount', { $ifNull: ['$invoice.amount', 0] }],
              },
            },
          },
        },
      ]),
      SessionModel.countDocuments({
        'evaluation.homeworkGradedBy': teacherObjectId,
        'evaluation.homeworkGradedAt': { $gte: from, $lte: to },
        'evaluation.homeworkStatus': { $in: ['GRADED', 'REVIEWED'] },
      }),
    ]);

    return {
      experienceCaseCount: caseRows[0]?.experienceCaseCount || 0,
      successfulExperienceCaseCount: revenueRows[0]?.successfulExperienceCaseCount || 0,
      totalRevenue: revenueRows[0]?.totalRevenue || 0,
      homeworkGradingCount,
    };
  }

  /**
   * Tính hoa hồng dựa trên doanh thu + bảng mốc + kiểu tính.
   */
  private calculateCommission(
    totalRevenue: number,
    commissionType: CommissionType,
    tiers: Array<{ minRevenue: number; maxRevenue: number | null; percentage: number }>,
  ): number {
    if (totalRevenue <= 0 || tiers.length === 0) return 0;

    // Sort tiers by minRevenue ascending
    const sorted = [...tiers].sort((a, b) => a.minRevenue - b.minRevenue);

    if (commissionType === CommissionType.HIGHEST_TIER) {
      // Mốc cao nhất: tìm mốc cao nhất mà revenue đạt được → toàn bộ revenue × %
      let applicablePercentage = 0;
      for (const tier of sorted) {
        if (totalRevenue >= tier.minRevenue) {
          applicablePercentage = tier.percentage;
        }
      }
      return Math.round(totalRevenue * applicablePercentage / 100);
    }

    // PROGRESSIVE: lũy tiến — mỗi phần doanh thu trong khoảng tính % riêng
    let commission = 0;
    for (const tier of sorted) {
      const min = tier.minRevenue;
      const max = tier.maxRevenue ?? Infinity;

      if (totalRevenue <= min) break;

      const taxableAmount = Math.min(totalRevenue, max) - min;
      if (taxableAmount > 0) {
        commission += taxableAmount * tier.percentage / 100;
      }
    }
    return Math.round(commission);
  }

  /**
   * Lấy KPI score cho user.
   * - Teacher: tính từ sessions (completion rate, report rate, ratings, etc.)
   * - Các role khác: tính đơn giản từ attendance ratio × 100
   */
  private async getKpiScore(
    userId: string,
    role: string,
    from: Date,
    to: Date,
  ): Promise<number> {
    if (role === Role.TEACHER) {
      return this.getTeacherKpiScore(userId, from, to);
    }
    if (role === Role.EXPERIENCE_TEACHER) {
      return this.getExperienceTeacherKpiScore(userId, from, to);
    }

    // Các role khác: KPI đơn giản dựa trên attendance
    const workSummary = await this.workSessionsService.getSummary(userId, from, to);
    const config = await this.salaryConfigService.findByUserId(userId);
    if (!config) return 0;

    const attendanceRatio = Math.min(workSummary.totalHours / config.standardHours, 1);
    return Math.round(attendanceRatio * 100);
  }

  private async getAttendanceKpiScore(userId: string, from: Date, to: Date): Promise<number> {
    const workSummary = await this.workSessionsService.getSummary(userId, from, to);
    const config = await this.salaryConfigService.findByUserId(userId);
    if (!config) return 0;

    const attendanceRatio = Math.min(workSummary.totalHours / config.standardHours, 1);
    return Math.round(attendanceRatio * 100);
  }

  private async getExperienceTeacherKpiScore(userId: string, from: Date, to: Date): Promise<number> {
    const TrialEnrollmentModel = this.connection.model('TrialEnrollment');
    const attendanceScore = await this.getAttendanceKpiScore(userId, from, to);

    const result = await TrialEnrollmentModel.aggregate([
      {
        $match: {
          experienceTeacherId: new Types.ObjectId(userId),
          $or: [
            { createdAt: { $gte: from, $lte: to } },
            { updatedAt: { $gte: from, $lte: to } },
            { assessmentUpdatedAt: { $gte: from, $lte: to } },
          ],
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          assessed: {
            $sum: {
              $cond: [
                {
                  $or: [
                    { $ne: [{ $ifNull: ['$assessmentScore', null] }, null] },
                    { $ne: [{ $ifNull: ['$recommendedLevel', null] }, null] },
                    { $ne: [{ $ifNull: ['$assessmentNotes', null] }, null] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          completedTrials: {
            $sum: {
              $cond: [
                {
                  $or: [
                    { $gte: [{ $ifNull: ['$trialSessionsUsed', 0] }, { $ifNull: ['$maxTrialSessions', 2] }] },
                    { $in: ['$status', ['WAITING_DECISION', 'CONVERTED', 'REJECTED']] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          converted: {
            $sum: { $cond: [{ $eq: ['$status', 'CONVERTED'] }, 1, 0] },
          },
        },
      },
    ]);

    if (!result.length || result[0].total === 0) {
      return attendanceScore;
    }

    const total = result[0].total || 0;
    const assessmentRate = total > 0 ? (result[0].assessed / total) * 100 : 0;
    const trialCompletionRate = total > 0 ? (result[0].completedTrials / total) * 100 : 0;
    const conversionSupportRate = total > 0 ? (result[0].converted / total) * 100 : 0;

    const kpiScore =
      assessmentRate * 0.40 +
      trialCompletionRate * 0.25 +
      conversionSupportRate * 0.20 +
      attendanceScore * 0.15;

    return Math.round(Math.min(kpiScore, 100));
  }

  /**
   * FIX PERF: Tính KPI score cho teacher bằng MongoDB aggregation thay vì load all sessions vào memory.
   * Trước đây: SessionModel.find() → load N docs → filter/map trong JS.
   * Sau fix: 1 aggregation pipeline xử lý hoàn toàn trong MongoDB.
   */
  private async getTeacherKpiScore(teacherId: string, from: Date, to: Date): Promise<number> {
    const SessionModel = this.connection.model('Session');

    const result = await SessionModel.aggregate([
      {
        $match: {
          teacherId: new Types.ObjectId(teacherId),
          scheduledDate: { $gte: from, $lte: to },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          completed: {
            $sum: {
              $cond: [
                { $in: ['$status', ['TEACHER_COMPLETED', 'PARENT_CONFIRMED', 'FINALIZED']] },
                1,
                0,
              ],
            },
          },
          withReport: {
            $sum: { $cond: [{ $eq: ['$hasTeachingReport', true] }, 1, 0] },
          },
          reportsOnTime: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $gt: [{ $ifNull: ['$teachingReport.submittedAt', null] }, null] },
                    { $ne: ['$teachingReport.isLateSubmission', true] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          withFeedback: {
            $sum: {
              $cond: [{ $gt: [{ $ifNull: ['$parentFeedback.overallRating', null] }, null] }, 1, 0],
            },
          },
          sumOverallRating: {
            $sum: { $ifNull: ['$parentFeedback.overallRating', 0] },
          },
          satisfiedCount: {
            $sum: { $cond: [{ $eq: ['$parentFeedback.isSatisfied', true] }, 1, 0] },
          },
          withEvaluation: {
            $sum: {
              $cond: [{ $gt: [{ $ifNull: ['$evaluation.studentPerformance', null] }, null] }, 1, 0],
            },
          },
          sumStudentPerformance: {
            $sum: { $ifNull: ['$evaluation.studentPerformance', 0] },
          },
        },
      },
    ]);

    if (!result.length || result[0].total === 0) return 0;

    const r = result[0];
    const total: number = r.total;
    const completed: number = r.completed;
    const withReport: number = r.withReport;
    const reportsOnTime: number = r.reportsOnTime;
    const withFeedback: number = r.withFeedback;
    const withEvaluation: number = r.withEvaluation;

    const completionRate = (completed / total) * 100;
    const reportSubmissionRate = completed > 0 ? (withReport / completed) * 100 : 0;
    const onTimeReportRate = withReport > 0 ? (reportsOnTime / withReport) * 100 : 0;

    // Rating scale 1-5: ×20 để scale lên 20-100, default neutral = 3 khi không có feedback
    const avgOverallRating = withFeedback > 0 ? r.sumOverallRating / withFeedback : 3;
    const avgStudentPerformance = withEvaluation > 0 ? r.sumStudentPerformance / withEvaluation : 3;
    const satisfactionRate = withFeedback > 0 ? (r.satisfiedCount / withFeedback) * 100 : 50;

    // KPI formula (same as dashboard)
    const kpiScore =
      completionRate * 0.25 +
      reportSubmissionRate * 0.15 +
      onTimeReportRate * 0.10 +
      avgOverallRating * 20 * 0.25 +
      avgStudentPerformance * 20 * 0.15 +
      satisfactionRate * 0.10;

    return Math.min(kpiScore, 100);
  }

  /**
   * Tìm mốc KPI bonus phù hợp với score.
   */
  private findKpiBonusPercentage(
    kpiScore: number,
    tiers: Array<{ minScore: number; maxScore: number; bonusPercentage: number }>,
  ): number {
    for (const tier of tiers) {
      if (kpiScore >= tier.minScore && kpiScore <= tier.maxScore) {
        return tier.bonusPercentage;
      }
    }
    return 0;
  }

  private throwIfVersionConflict(err: unknown): never {
    const isVersionConflict = (err as any)?.name === 'VersionError';
    const isWriteConflict =
      (err as any)?.code === 112 ||
      (err as any)?.codeName === 'WriteConflict' ||
      /WriteConflict/i.test((err as any)?.message || '');

    if (isVersionConflict || isWriteConflict) {
      throw new ConflictException(
        'Bảng lương nhân viên đã thay đổi bởi thao tác khác. Vui lòng tải lại và thử lại.',
      );
    }
    throw err;
  }
}
