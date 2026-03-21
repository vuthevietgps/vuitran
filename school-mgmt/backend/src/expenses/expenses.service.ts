import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectModel, InjectConnection } from '@nestjs/mongoose';
import { Model, Connection, Types } from 'mongoose';
import {
  Expense,
  ExpenseAllocationScope,
  ExpenseDocument,
  PaymentStatus,
} from './schemas/expense.schema';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { QueryExpenseDto } from './dto/query-expense.dto';
import { PayExpenseDto } from './dto/pay-expense.dto';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { FinancialControlService } from '../financial-control/financial-control.service';
import { normalizePhone } from '../marketing-attribution/parent-attribution.util';

@Injectable()
export class ExpensesService {
  private readonly logger = new Logger(ExpensesService.name);

  constructor(
    @InjectModel(Expense.name) private expenseModel: Model<ExpenseDocument>,
    @InjectConnection() private connection: Connection,
    private financialControlService: FinancialControlService,
  ) {}

  /** Generate unique expense code with retry on collision */
  private async generateExpenseCode(): Promise<string> {
    for (let attempt = 0; attempt < 5; attempt++) {
      const count = await this.expenseModel.countDocuments();
      const code = `EXP-${String(count + 1 + attempt).padStart(5, '0')}`;
      const exists = await this.expenseModel.findOne({ expenseCode: code }).lean();
      if (!exists) return code;
    }
    // Fallback: timestamp-based
    return `EXP-${Date.now()}`;
  }

  private applyAllocationFields(
    data: Record<string, any>,
    dto: Pick<CreateExpenseDto | UpdateExpenseDto, 'allocationScope' | 'adGroupId' | 'adGroupName' | 'parentUserId' | 'parentPhone'>,
    fallbackScope?: string,
  ): void {
    const inferredScope = dto.adGroupId
      ? ExpenseAllocationScope.AD_GROUP
      : (dto.parentUserId || dto.parentPhone)
        ? ExpenseAllocationScope.PARENT
        : undefined;
    const allocationScope = dto.allocationScope || fallbackScope || inferredScope || ExpenseAllocationScope.GLOBAL;
    data.allocationScope = allocationScope;

    delete data.adGroupId;
    delete data.adGroupName;
    delete data.parentUserId;
    delete data.parentPhone;
    delete data.normalizedParentPhone;

    if (allocationScope === ExpenseAllocationScope.AD_GROUP) {
      if (!dto.adGroupId) {
        throw new BadRequestException('Chi phi scope AD_GROUP can adGroupId');
      }
      data.adGroupId = new Types.ObjectId(dto.adGroupId);
      data.adGroupName = dto.adGroupName?.trim() || undefined;
      return;
    }

    if (allocationScope === ExpenseAllocationScope.PARENT) {
      const normalizedParentPhone = normalizePhone(dto.parentPhone);
      if (!dto.parentUserId && !normalizedParentPhone) {
        throw new BadRequestException('Chi phi scope PARENT can parentUserId hoac parentPhone');
      }
      if (dto.parentUserId) data.parentUserId = new Types.ObjectId(dto.parentUserId);
      if (dto.parentPhone) data.parentPhone = dto.parentPhone.trim();
      if (normalizedParentPhone) data.normalizedParentPhone = normalizedParentPhone;
    }
  }

  async create(dto: CreateExpenseDto, user: JwtPayload): Promise<Expense> {
    const expenseCode = await this.generateExpenseCode();

    const data: any = {
      ...dto,
      expenseCode,
      createdById: user._id,
      createdByName: user.fullName,
      paymentStatus: PaymentStatus.PENDING_APPROVAL,
    };
    this.applyAllocationFields(data, dto);

    // Handle recurring expense
    if (dto.isRecurring && dto.recurringFrequency) {
      data.recurringStartDate = dto.recurringStartDate ? new Date(dto.recurringStartDate) : new Date(dto.expenseDate);
      data.recurringActive = true;
      data.nextOccurrence = this.calculateNextOccurrence(
        data.recurringStartDate,
        dto.recurringFrequency,
      );
      if (dto.recurringEndDate) {
        data.recurringEndDate = new Date(dto.recurringEndDate);
      }
    }

    const expense = new this.expenseModel(data);
    return expense.save();
  }

  /** Upload receipt URL(s) for an expense */
  async uploadReceipt(id: string, receiptUrls: string[], user: JwtPayload): Promise<Expense> {
    const expense = await this.findOne(id);
    if (!expense.receiptUrls) expense.receiptUrls = [];
    expense.receiptUrls.push(...receiptUrls);
    if (!expense.receiptUrl) expense.receiptUrl = receiptUrls[0];
    return expense.save();
  }

  /** Process recurring expenses — called by cron or manually */
  async processRecurringExpenses(): Promise<{ created: number; errors: string[] }> {
    const now = new Date();
    const recurring = await this.expenseModel.find({
      isRecurring: true,
      recurringActive: true,
      nextOccurrence: { $lte: now },
      $or: [
        { recurringEndDate: { $exists: false } },
        { recurringEndDate: null },
        { recurringEndDate: { $gte: now } },
      ],
    }).exec();

    let created = 0;
    const errors: string[] = [];

    for (const parent of recurring) {
      try {
        const expenseCode = await this.generateExpenseCode();

        const child = new this.expenseModel({
          expenseCode,
          title: parent.title,
          description: parent.description,
          amount: parent.amount,
          expenseDate: parent.nextOccurrence,
          category: parent.category,
          allocationScope: parent.allocationScope,
          adGroupId: parent.adGroupId,
          adGroupName: parent.adGroupName,
          parentUserId: parent.parentUserId,
          parentPhone: parent.parentPhone,
          normalizedParentPhone: parent.normalizedParentPhone,
          paymentStatus: PaymentStatus.PENDING_APPROVAL,
          createdById: parent.createdById,
          createdByName: parent.createdByName,
          notes: `[Tự động] Tạo từ chi phí định kỳ ${parent.expenseCode}`,
          parentExpenseId: parent._id,
        });
        await child.save();

        // Update next occurrence
        const next = this.calculateNextOccurrence(
          parent.nextOccurrence!,
          parent.recurringFrequency!,
        );

        // Check if next occurrence exceeds end date
        if (parent.recurringEndDate && next > parent.recurringEndDate) {
          parent.recurringActive = false;
        }
        parent.nextOccurrence = next;
        await parent.save();

        created++;
      } catch (err: any) {
        errors.push(`${parent.expenseCode}: ${err.message}`);
      }
    }

    return { created, errors };
  }

  /** Get child expenses of a recurring parent */
  async getRecurringChildren(parentId: string): Promise<Expense[]> {
    return this.expenseModel.find({ parentExpenseId: parentId }).sort({ expenseDate: -1 }).exec();
  }

  private calculateNextOccurrence(current: Date, frequency: string): Date {
    const next = new Date(current);
    switch (frequency) {
      case 'DAILY': next.setDate(next.getDate() + 1); break;
      case 'WEEKLY': next.setDate(next.getDate() + 7); break;
      case 'MONTHLY': next.setMonth(next.getMonth() + 1); break;
      case 'QUARTERLY': next.setMonth(next.getMonth() + 3); break;
      case 'YEARLY': next.setFullYear(next.getFullYear() + 1); break;
    }
    return next;
  }

  async findAll(query: QueryExpenseDto): Promise<{ data: Expense[]; total: number; page: number; limit: number }> {
    const filter: any = {};

    if (query.keyword) {
      filter.$or = [
        { expenseCode: new RegExp(query.keyword, 'i') },
        { title: new RegExp(query.keyword, 'i') },
        { description: new RegExp(query.keyword, 'i') },
      ];
    }

    if (query.category) filter.category = query.category;
    if (query.paymentStatus) filter.paymentStatus = query.paymentStatus;
    if (query.createdById) filter.createdById = query.createdById;

    if (query.startDate || query.endDate) {
      filter.expenseDate = {};
      if (query.startDate) filter.expenseDate.$gte = new Date(query.startDate);
      if (query.endDate) {
        const endDate = new Date(query.endDate);
        endDate.setHours(23, 59, 59, 999);
        filter.expenseDate.$lte = endDate;
      }
    }

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(200, Math.max(1, Number(query.limit) || 50));
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.expenseModel.find(filter).sort({ expenseDate: -1, createdAt: -1 }).skip(skip).limit(limit).exec(),
      this.expenseModel.countDocuments(filter),
    ]);

    return { data, total, page, limit };
  }

  async findOne(id: string): Promise<ExpenseDocument> {
    const expense = await this.expenseModel.findById(id).exec();
    if (!expense) throw new NotFoundException('Expense not found');
    return expense;
  }

  async update(id: string, dto: UpdateExpenseDto, user: JwtPayload): Promise<Expense> {
    const isPrivileged = ['DIRECTOR', 'ACCOUNTING'].includes(user.role);
    const updatePayload: any = { ...dto };
    if (dto.expenseDate) {
      updatePayload.expenseDate = new Date(dto.expenseDate);
    }
    if (
      dto.allocationScope !== undefined
      || dto.adGroupId !== undefined
      || dto.adGroupName !== undefined
      || dto.parentUserId !== undefined
      || dto.parentPhone !== undefined
    ) {
      const existingExpense = await this.findOne(id);
      this.applyAllocationFields(updatePayload, dto, existingExpense.allocationScope);
    }

    const updated = await this.expenseModel.findOneAndUpdate(
      {
        _id: id,
        paymentStatus: { $ne: PaymentStatus.PAID },
        ...(isPrivileged ? {} : { createdById: user._id }),
      },
      { $set: updatePayload },
      { new: true },
    ).exec();

    if (updated) return updated;

    const existing = await this.expenseModel.findById(id).exec();
    if (!existing) throw new NotFoundException('Expense not found');

    if (!isPrivileged && String(existing.createdById) !== String(user._id)) {
      throw new BadRequestException('You do not have permission to update this expense');
    }

    if (existing.paymentStatus === PaymentStatus.PAID) {
      throw new BadRequestException('Cannot update a paid expense');
    }

    throw new BadRequestException('Expense cannot be updated');
  }

  async delete(id: string, user: JwtPayload): Promise<void> {
    const isDirector = user.role === 'DIRECTOR';

    const deleted = await this.expenseModel.findOneAndDelete(
      {
        _id: id,
        paymentStatus: { $ne: PaymentStatus.PAID },
        ...(isDirector ? {} : { createdById: user._id }),
      },
    ).exec();

    if (deleted) return;

    const existing = await this.expenseModel.findById(id).exec();
    if (!existing) throw new NotFoundException('Expense not found');

    if (!isDirector && String(existing.createdById) !== String(user._id)) {
      throw new BadRequestException('You do not have permission to delete this expense');
    }

    if (existing.paymentStatus === PaymentStatus.PAID) {
      throw new BadRequestException('Cannot delete a paid expense');
    }

    throw new BadRequestException('Expense cannot be deleted');
  }

  async approve(id: string, user: JwtPayload): Promise<Expense> {
    const updated = await this.expenseModel.findOneAndUpdate(
      { _id: id, paymentStatus: PaymentStatus.PENDING_APPROVAL },
      {
        $set: {
          paymentStatus: PaymentStatus.APPROVED_UNPAID,
          approvedById: user._id,
          approvedByName: user.fullName,
          approvedAt: new Date(),
        },
      },
      { new: true },
    ).exec();

    if (!updated) {
      const exists = await this.expenseModel.findById(id).exec();
      if (!exists) throw new NotFoundException('Expense not found');
      throw new BadRequestException(
        `Expense đang ở trạng thái "${exists.paymentStatus}", chỉ có thể duyệt khi ở "PENDING_APPROVAL"`,
      );
    }

    return updated;
  }

  async reject(id: string, reason: string, user: JwtPayload): Promise<Expense> {
    const updated = await this.expenseModel.findOneAndUpdate(
      { _id: id, paymentStatus: PaymentStatus.PENDING_APPROVAL },
      {
        $set: {
          paymentStatus: PaymentStatus.REJECTED,
          approvedById: user._id,
          approvedByName: user.fullName,
          approvedAt: new Date(),
          rejectionReason: reason,
        },
      },
      { new: true },
    ).exec();

    if (!updated) {
      const exists = await this.expenseModel.findById(id).exec();
      if (!exists) throw new NotFoundException('Expense not found');
      throw new BadRequestException(
        `Expense đang ở trạng thái "${exists.paymentStatus}", chỉ có thể từ chối khi ở "PENDING_APPROVAL"`,
      );
    }

    return updated;
  }

  async markPaid(id: string, dto: PayExpenseDto, user: JwtPayload): Promise<Expense> {
    const session = await this.connection.startSession();
    let paidExpense: Expense | null = null;

    try {
      await session.withTransaction(async () => {
        const paidAt = dto.paidAt ? new Date(dto.paidAt) : new Date();
        const updated = await this.expenseModel.findOneAndUpdate(
          { _id: id, paymentStatus: PaymentStatus.APPROVED_UNPAID },
          {
            $set: {
              paymentStatus: PaymentStatus.PAID,
              paidById: user._id,
              paidByName: user.fullName,
              paidAt,
              paymentMethod: dto.paymentMethod,
              ...(dto.notes ? { notes: dto.notes } : {}),
            },
          },
          { new: true, session },
        ).exec();

        if (!updated) {
          const exists = await this.expenseModel.findById(id).session(session).exec();
          if (!exists) throw new NotFoundException('Expense not found');
          throw new BadRequestException(
            `Expense đang ở trạng thái "${exists.paymentStatus}", cần ở "APPROVED_UNPAID" để đánh dấu đã thanh toán`,
          );
        }

        // BUG #2 fix: ghi nhận giao dịch ngân hàng cho cả BANK_TRANSFER lẫn khi chỉ định bankAccountId
        const shouldRecordBank = dto.paymentMethod === 'BANK_TRANSFER' || !!dto.bankAccountId;
        if (shouldRecordBank) {
          let bankAccountId = dto.bankAccountId;
          if (!bankAccountId) {
            // BANK_TRANSFER không chỉ định tài khoản → dùng tài khoản chính
            const bankSummary = await this.financialControlService.getBankAccountSummary();
            const primaryAccount = bankSummary.primaryAccount || bankSummary.accounts?.[0];
            if (!primaryAccount) {
              throw new BadRequestException('Không có tài khoản ngân hàng hoạt động để ghi nhận chi tiền');
            }
            bankAccountId = primaryAccount._id.toString();
          }

          await this.financialControlService.recordBankTransaction({
            bankAccountId: bankAccountId!,
            type: 'WITHDRAWAL',
            category: 'EXPENSE',
            amount: updated.amount,
            transactionDate: paidAt.toISOString().split('T')[0],
            description: `Chi phí: ${updated.title} (${updated.expenseCode})`,
            reference: updated.expenseCode,
            referenceId: updated._id?.toString(),
            referenceType: 'EXPENSE',
          }, user, { session });
        }

        paidExpense = updated;
      });

      if (!paidExpense) {
        throw new BadRequestException('Không thể đánh dấu đã thanh toán');
      }

      return paidExpense;
    } finally {
      session.endSession();
    }
  }

  async getStats(startDate?: string, endDate?: string): Promise<any> {
    const filter: any = {};

    if (startDate || endDate) {
      filter.expenseDate = {};
      if (startDate) filter.expenseDate.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.expenseDate.$lte = end;
      }
    }

    const result = await this.expenseModel.aggregate([
      { $match: filter },
      {
        $facet: {
          byStatus: [
            { $group: { _id: '$paymentStatus', count: { $sum: 1 }, total: { $sum: '$amount' } } },
          ],
          byCategory: [
            { $group: { _id: '$category', count: { $sum: 1 }, total: { $sum: '$amount' } } },
          ],
          total: [
            { $group: { _id: null, count: { $sum: 1 }, total: { $sum: '$amount' } } },
          ],
        },
      },
    ]);

    const stats = result[0];
    const byStatus: any = {};
    const byCategory: any = {};

    stats.byStatus.forEach((s: any) => {
      byStatus[s._id] = { count: s.count, total: s.total };
    });

    stats.byCategory.forEach((c: any) => {
      byCategory[c._id] = { count: c.count, total: c.total };
    });

    return {
      totalCount: stats.total[0]?.count || 0,
      totalAmount: stats.total[0]?.total || 0,
      byStatus,
      byCategory,
    };
  }
}
