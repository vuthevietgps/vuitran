import { BadRequestException, Injectable, Optional } from '@nestjs/common';
import { InjectModel, InjectConnection } from '@nestjs/mongoose';
import { Model, Types, Connection, ClientSession } from 'mongoose';
import { BankAccount, BankAccountDocument } from './schemas/bank-account.schema';
import { BankTransaction, BankTransactionDocument } from './schemas/bank-transaction.schema';
import { Fund, FundDocument } from './schemas/fund.schema';
import { FundTransaction, FundTransactionDocument } from './schemas/fund-transaction.schema';
import {
  CreateBankAccountDto, UpdateBankAccountDto,
  RecordBankTransactionDto, QueryBankTransactionDto,
} from './dto/bank-account.dto';
import {
  CreateFundDto, UpdateFundDto,
  FundTransactionDto, QueryFundTransactionDto,
  QueryCashFlowDto,
} from './dto/fund.dto';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { PayrollFinancialAggregateService } from './aggregates/payroll-financial.aggregate';
import { ExpenseFinancialAggregateService } from './aggregates/expense-financial.aggregate';
import { LoanFinancialAggregateService } from './aggregates/loan-financial.aggregate';
import { FinancialControlBankFundService } from './financial-control-bank-fund.service';

// Import related schemas for cash flow aggregation
import { Session, SessionDocument } from '../sessions/schemas/session.schema';
import { Expense, ExpenseDocument } from '../expenses/schemas/expense.schema';
import { Invoice, InvoiceDocument } from '../invoices/schemas/invoice.schema';
import { LedgerEntry, LedgerEntryDocument } from '../wallets/schemas/ledger-entry.schema';
import { Wallet, WalletDocument } from '../wallets/schemas/wallet.schema';
import { AdCost, AdCostDocument } from '../ads/schemas/ad-cost.schema';
import { AdGroup, AdGroupDocument } from '../ads/schemas/ad-group.schema';
import { AdsService } from '../ads/ads.service';
import { AdsAnalyticsService } from '../ads/ads-analytics.service';
import { Order, OrderDocument } from '../orders/schemas/order.schema';
import { Lead, LeadDocument } from '../leads/schemas/lead.schema';
import { Student, StudentDocument } from '../students/schemas/student.schema';
import {
  Attendance,
  AttendanceDocument,
  COUNTED_ATTENDANCE_STATUSES,
} from '../attendance/schemas/attendance.schema';

type FinancialReportBasis = 'cash' | 'accrual';

@Injectable()
export class FinancialControlService {
  constructor(
    @InjectModel(BankAccount.name) private bankAccountModel: Model<BankAccountDocument>,
    @InjectModel(BankTransaction.name) private bankTransactionModel: Model<BankTransactionDocument>,
    @InjectModel(Fund.name) private fundModel: Model<FundDocument>,
    @InjectModel(FundTransaction.name) private fundTransactionModel: Model<FundTransactionDocument>,
    @InjectModel(Session.name) private sessionModel: Model<SessionDocument>,
    @InjectModel(Expense.name) private expenseModel: Model<ExpenseDocument>,
    @InjectModel(Invoice.name) private invoiceModel: Model<InvoiceDocument>,
    @InjectModel(LedgerEntry.name) private ledgerModel: Model<LedgerEntryDocument>,
    @InjectModel(Wallet.name) private walletModel: Model<WalletDocument>,
    @InjectModel(AdCost.name) private adCostModel: Model<AdCostDocument>,
    @InjectModel(AdGroup.name) private adGroupModel: Model<AdGroupDocument>,
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    @InjectModel(Lead.name) private leadModel: Model<LeadDocument>,
    @InjectModel(Student.name) private studentModel: Model<StudentDocument>,
    @InjectModel(Attendance.name) private attendanceModel: Model<AttendanceDocument>,
    @InjectConnection() private connection: Connection,
    private readonly payrollAggregate: PayrollFinancialAggregateService,
    private readonly expenseAggregate: ExpenseFinancialAggregateService,
    private readonly loanAggregate: LoanFinancialAggregateService,
    private readonly bankFundService: FinancialControlBankFundService,
    @Optional() private readonly adsService?: AdsService,
    @Optional() private readonly adsAnalyticsService?: AdsAnalyticsService,
  ) {}

  // Delegate bank/fund operations to dedicated service to keep this class focused on reporting.
  async createBankAccount(dto: CreateBankAccountDto, user: JwtPayload): Promise<BankAccount> {
    return this.bankFundService.createBankAccount(dto, user);
  }

  async findAllBankAccounts(): Promise<BankAccount[]> {
    return this.bankFundService.findAllBankAccounts();
  }

  async findBankAccount(id: string): Promise<BankAccountDocument> {
    return this.bankFundService.findBankAccount(id);
  }

  async updateBankAccount(id: string, dto: UpdateBankAccountDto, _user: JwtPayload): Promise<BankAccount> {
    return this.bankFundService.updateBankAccount(id, dto);
  }

  async getBankAccountSummary(): Promise<any> {
    return this.bankFundService.getBankAccountSummary();
  }

  async recordBankTransaction(
    dto: RecordBankTransactionDto,
    user: JwtPayload,
    options?: { session?: ClientSession },
  ): Promise<BankTransaction> {
    return this.bankFundService.recordBankTransaction(dto, user, options);
  }

  async findBankTransactions(query: QueryBankTransactionDto): Promise<BankTransaction[]> {
    return this.bankFundService.findBankTransactions(query);
  }

  async reconcileTransaction(id: string, user: JwtPayload): Promise<BankTransaction> {
    return this.bankFundService.reconcileTransaction(id, user);
  }

  async createFund(dto: CreateFundDto, user: JwtPayload): Promise<Fund> {
    return this.bankFundService.createFund(dto, user);
  }

  async findAllFunds(): Promise<Fund[]> {
    return this.bankFundService.findAllFunds();
  }

  async findFund(id: string): Promise<FundDocument> {
    return this.bankFundService.findFund(id);
  }

  async updateFund(id: string, dto: UpdateFundDto): Promise<Fund> {
    return this.bankFundService.updateFund(id, dto);
  }

  async recordFundTransaction(dto: FundTransactionDto, user: JwtPayload): Promise<FundTransaction> {
    return this.bankFundService.recordFundTransaction(dto, user);
  }

  async findFundTransactions(query: QueryFundTransactionDto): Promise<FundTransaction[]> {
    return this.bankFundService.findFundTransactions(query);
  }

  async getFundsSummary(): Promise<any> {
    return this.bankFundService.getFundsSummary();
  }

  private resolveFinancialBasis(basis?: string): FinancialReportBasis {
    return basis === 'accrual' ? 'accrual' : 'cash';
  }

  async getCashFlow(query: QueryCashFlowDto): Promise<any> {
    const requestedBasis = this.resolveFinancialBasis(query.basis);
    const dateFilter: any = {};
    if (query.startDate) dateFilter.$gte = new Date(query.startDate);
    if (query.endDate) {
      const end = new Date(query.endDate);
      end.setHours(23, 59, 59, 999);
      dateFilter.$lte = end;
    }

    const hasDateFilter = Object.keys(dateFilter).length > 0;

    // Aggregate data from all financial sources
    const [
      invoiceIncome,
      payrollOut,
      expenseOut,
      sessionRevenue,
      adCostOut,
      walletTopUps,
      loanDisbursements,
      loanRepayments,
    ] = await Promise.all([
      // Income from invoices (approved)
      this.invoiceModel.aggregate([
        {
          $match: {
            status: 'APPROVED',
            ...(hasDateFilter ? { paymentDate: dateFilter } : {}),
          },
        },
        {
          $group: {
            _id: {
              $dateToString: {
                format: query.groupBy === 'month' ? '%Y-%m' : '%Y-%m-%d',
                date: '$paymentDate',
              },
            },
            totalAmount: { $sum: '$amount' },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),

      this.payrollAggregate.getPaidOutflowTimeline(
        query.groupBy === 'month' ? 'month' : 'day',
        hasDateFilter ? dateFilter : undefined,
      ),

      this.expenseAggregate.getPaidOutflowTimeline(
        query.groupBy === 'month' ? 'month' : 'day',
        hasDateFilter ? dateFilter : undefined,
      ),

      // Session revenue (finalized)
      this.sessionModel.aggregate([
        {
          $match: {
            status: 'FINALIZED',
            ...(hasDateFilter ? { scheduledDate: dateFilter } : {}),
          },
        },
        {
          $group: {
            _id: {
              $dateToString: {
                format: query.groupBy === 'month' ? '%Y-%m' : '%Y-%m-%d',
                date: '$scheduledDate',
              },
            },
            totalRevenue: { $sum: '$amountCharged' },
            totalTeacherCost: { $sum: '$teacherPayout' },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),

      // Ad costs outflow (marketing spend) — exclude ESTIMATED to avoid double-counting with SYNCED
      this.adCostModel.aggregate([
        {
          $match: {
            source: { $ne: 'ESTIMATED' }, // BUG #5 fix: ESTIMATED are projections, not real cash outflow
            ...(hasDateFilter ? { date: dateFilter } : {}),
          },
        },
        {
          $group: {
            _id: {
              $dateToString: {
                format: query.groupBy === 'month' ? '%Y-%m' : '%Y-%m-%d',
                date: '$date',
              },
            },
            totalSpend: { $sum: '$spend' },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),

      // Wallet top-ups (approved) — money received from parents
      this.ledgerModel.aggregate([
        {
          $match: {
            type: 'TOP_UP',
            status: 'APPROVED',
            // Invoice approval also creates TOP_UP entries (paymentMethod=SYSTEM).
            // Exclude them to avoid double-counting against invoice inflow.
            paymentMethod: { $ne: 'SYSTEM' },
            // BUG #6 fix: filter by approvedAt (when money actually received), fallback to createdAt
            ...(hasDateFilter ? { $or: [
              { approvedAt: dateFilter },
              { approvedAt: { $exists: false }, createdAt: dateFilter },
            ] } : {}),
          },
        },
        {
          $group: {
            _id: {
              $dateToString: {
                format: query.groupBy === 'month' ? '%Y-%m' : '%Y-%m-%d',
                date: { $ifNull: ['$approvedAt', '$createdAt'] }, // BUG #6 fix: use approvedAt
              },
            },
            totalAmount: { $sum: '$amount' },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),

      // Loan disbursements (inflow - money received from lenders)
      this.loanAggregate.getDisbursementTimeline(
        query.groupBy === 'month' ? 'month' : 'day',
        hasDateFilter ? dateFilter : undefined,
      ),

      // Loan repayments (outflow - money paid to lenders)
      this.loanAggregate.getRepaymentTimeline(
        query.groupBy === 'month' ? 'month' : 'day',
        hasDateFilter ? dateFilter : undefined,
      ),
    ]);

    // Build unified timeline
    const allDates = new Set<string>();
    invoiceIncome.forEach((i: any) => allDates.add(i._id));
    payrollOut.forEach((p: any) => allDates.add(p._id));
    expenseOut.forEach((e: any) => allDates.add(e._id));
    sessionRevenue.forEach((s: any) => allDates.add(s._id));
    adCostOut.forEach((a: any) => allDates.add(a._id));
    walletTopUps.forEach((w: any) => allDates.add(w._id));
    loanDisbursements.forEach((l: any) => allDates.add(l._id));
    loanRepayments.forEach((l: any) => allDates.add(l._id));

    const incomeMap = new Map(invoiceIncome.map((i: any) => [i._id, i]));
    const payrollMap = new Map(payrollOut.map((p: any) => [p._id, p]));
    const expenseMap = new Map(expenseOut.map((e: any) => [e._id, e]));
    const sessionMap = new Map(sessionRevenue.map((s: any) => [s._id, s]));
    const adCostMap = new Map(adCostOut.map((a: any) => [a._id, a]));
    const walletMap = new Map(walletTopUps.map((w: any) => [w._id, w]));
    const loanDisbMap = new Map(loanDisbursements.map((l: any) => [l._id, l]));
    const loanRepayMap = new Map(loanRepayments.map((l: any) => [l._id, l]));

    const timeline = Array.from(allDates).sort().map(date => {
      const income = incomeMap.get(date);
      const payroll = payrollMap.get(date);
      const expense = expenseMap.get(date);
      const session = sessionMap.get(date);
      const adCost = adCostMap.get(date);
      const wallet = walletMap.get(date);
      const loanDisb = loanDisbMap.get(date);
      const loanRepay = loanRepayMap.get(date);

      const cashInflow = (income?.totalAmount || 0) + (wallet?.totalAmount || 0) + (loanDisb?.totalAmount || 0);
      const cashOutflow = (payroll?.totalAmount || 0) + (expense?.totalAmount || 0) + (adCost?.totalSpend || 0) + (loanRepay?.totalAmount || 0);
      const sessionRevenueAmount = session?.totalRevenue || 0;
      const teacherCostAmount = session?.totalTeacherCost || 0;

      return {
        date,
        inflow: {
          invoices: income?.totalAmount || 0,
          invoiceCount: income?.count || 0,
          sessionRevenue: sessionRevenueAmount,
          sessionRevenueIncludedInTotal: false,
          sessionCount: session?.count || 0,
          walletTopUps: wallet?.totalAmount || 0,
          walletTopUpCount: wallet?.count || 0,
          loanDisbursements: loanDisb?.totalAmount || 0,
          loanDisbursementCount: loanDisb?.count || 0,
        },
        outflow: {
          payroll: payroll?.totalAmount || 0,
          payrollCount: payroll?.count || 0,
          expenses: expense?.totalAmount || 0,
          expenseCount: expense?.count || 0,
          teacherCost: teacherCostAmount,
          teacherCostIncludedInTotal: false,
          adCost: adCost?.totalSpend || 0,
          adCostCount: adCost?.count || 0,
          loanRepayments: loanRepay?.totalAmount || 0,
          loanRepaymentCount: loanRepay?.count || 0,
        },
        accrualReference: {
          sessionRevenue: sessionRevenueAmount,
          teacherCost: teacherCostAmount,
          serviceMargin: sessionRevenueAmount - teacherCostAmount,
        },
        totalInflow: cashInflow,
        totalOutflow: cashOutflow,
        netCashFlow: cashInflow - cashOutflow,
      };
    });

    // Calculate totals
    const totals = timeline.reduce(
      (acc, t) => ({
        totalInflow: acc.totalInflow + t.totalInflow,
        totalOutflow: acc.totalOutflow + t.totalOutflow,
        netCashFlow: acc.netCashFlow + t.netCashFlow,
      }),
      { totalInflow: 0, totalOutflow: 0, netCashFlow: 0 },
    );

    const accrualReference = timeline.reduce(
      (acc, t) => ({
        sessionRevenue: acc.sessionRevenue + (t.accrualReference?.sessionRevenue || 0),
        teacherCost: acc.teacherCost + (t.accrualReference?.teacherCost || 0),
        serviceMargin: acc.serviceMargin + (t.accrualReference?.serviceMargin || 0),
      }),
      { sessionRevenue: 0, teacherCost: 0, serviceMargin: 0 },
    );

    return {
      ...totals,
      timeline,
      basis: {
        requested: requestedBasis,
        applied: 'cash',
        totalInflow: 'cash',
        totalOutflow: 'cash',
      },
      accrualReference,
      period: {
        startDate: query.startDate || 'all',
        endDate: query.endDate || 'all',
        groupBy: query.groupBy || 'day',
      },
    };
  }

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // P&L REPORT — Bảng cân đối thu chi
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

  async getProfitAndLoss(startDate?: string, endDate?: string, basis?: string): Promise<any> {
    const selectedBasis = this.resolveFinancialBasis(basis);
    const dateFilter: any = {};
    if (startDate) dateFilter.$gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      dateFilter.$lte = end;
    }
    const hasDateFilter = Object.keys(dateFilter).length > 0;

    const [
      sessionData,
      invoiceData,
      payrollSummary,
      expenseData,
      adCostData,
      loanInterestData,
    ] = await Promise.all([
      // Session revenue & teacher cost
      this.sessionModel.aggregate([
        { $match: { status: 'FINALIZED', ...(hasDateFilter ? { scheduledDate: dateFilter } : {}) } },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$amountCharged' },
            totalTeacherCost: { $sum: '$teacherPayout' },
            sessionCount: { $sum: 1 },
          },
        },
      ]),

      // Invoice revenue by type
      this.invoiceModel.aggregate([
        { $match: { status: 'APPROVED', ...(hasDateFilter ? { paymentDate: dateFilter } : {}) } },
        {
          $group: {
            _id: '$invoiceType',
            totalAmount: { $sum: '$amount' },
            count: { $sum: 1 },
          },
        },
      ]),

      this.payrollAggregate.getPaidSummaryBreakdown(hasDateFilter ? dateFilter : undefined),
      this.expenseAggregate.getPaidCategorySummary(hasDateFilter ? dateFilter : undefined),

      // Ad costs (marketing spend) by platform — exclude ESTIMATED
      this.adCostModel.aggregate([
        { $match: {
          source: { $ne: 'ESTIMATED' }, // BUG #5 fix: exclude projected costs from P&L
          ...(hasDateFilter ? { date: dateFilter } : {}),
        } },
        {
          $group: {
            _id: '$platform',
            totalSpend: { $sum: '$spend' },
            count: { $sum: 1 },
          },
        },
      ]),

      this.loanAggregate.getInterestExpenseSummary(hasDateFilter ? dateFilter : undefined),
    ]);

    // Revenue breakdown
    const revenue = {
      sessionRevenue: sessionData[0]?.totalRevenue || 0,
      sessionCount: sessionData[0]?.sessionCount || 0,
      byInvoiceType: {} as Record<string, { amount: number; count: number }>,
    };
    invoiceData.forEach((i: any) => {
      revenue.byInvoiceType[i._id] = { amount: i.totalAmount, count: i.count };
    });
    const invoiceRevenue = Object.values(revenue.byInvoiceType).reduce(
      (sum, item) => sum + (item.amount || 0),
      0,
    );
    const accrualRevenue = revenue.sessionRevenue;

    // Cost breakdown
    const teacherCost = sessionData[0]?.totalTeacherCost || 0;
    const teacherPayrollCash = payrollSummary.teacherTotal || 0;
    const teacherPayrollCount = payrollSummary.teacherCount || 0;
    const staffPayrollCash = payrollSummary.staffTotal || 0;
    const staffPayrollCount = payrollSummary.staffCount || 0;
    const payrollCost = payrollSummary.total || 0;

    const expenseByCategory: Record<string, { amount: number; count: number }> = {};
    let totalExpenses = 0;
    expenseData.forEach((e: any) => {
      expenseByCategory[e._id] = { amount: e.totalAmount, count: e.count };
      totalExpenses += e.totalAmount;
    });

    // Ad costs by platform
    const adCostByPlatform: Record<string, { amount: number; count: number }> = {};
    let totalAdCost = 0;
    adCostData.forEach((a: any) => {
      adCostByPlatform[a._id] = { amount: a.totalSpend, count: a.count };
      totalAdCost += a.totalSpend;
    });

    // Loan interest expense
    const interestExpense = loanInterestData.totalInterest || 0;

    const basisSummary = {
      cash: {
        revenue: invoiceRevenue,
        costOfGoodsSold: teacherPayrollCash,
        payrollCost,
        operatingExpenses: totalExpenses,
        adCost: totalAdCost,
        interestExpense,
        totalCosts: payrollCost + totalExpenses + totalAdCost + interestExpense,
      },
      accrual: {
        revenue: accrualRevenue,
        costOfGoodsSold: teacherCost,
        payrollCost,
        operatingExpenses: totalExpenses,
        adCost: totalAdCost,
        interestExpense,
        // In accrual view, payroll excludes teacher payroll to avoid double-counting teacherCost.
        totalCosts: teacherCost + staffPayrollCash + totalExpenses + totalAdCost + interestExpense,
      },
    } as const;

    const selected = basisSummary[selectedBasis];
    const grossProfit = selected.revenue - selected.costOfGoodsSold;
    const netProfit = selected.revenue - selected.totalCosts;

    return {
      period: { startDate: startDate || 'all', endDate: endDate || 'all' },
      basis: {
        selected: selectedBasis,
        default: 'cash',
        supported: ['cash', 'accrual'],
      },
      revenue: {
        total: selected.revenue,
        invoiceRevenue,
        accrualRevenue,
        byBasis: {
          cash: invoiceRevenue,
          accrual: accrualRevenue,
        },
        ...revenue,
      },
      costs: {
        costOfGoodsSold: selected.costOfGoodsSold,
        teacherCost,
        teacherPayrollCash,
        teacherPayrollCount,
        staffPayrollCash,
        staffPayrollCount,
        payrollCost,
        operatingExpenses: totalExpenses,
        expenseByCategory,
        adCost: totalAdCost,
        adCostByPlatform,
        interestExpense,
        totalCosts: selected.totalCosts,
        byBasis: basisSummary,
      },
      summary: {
        basis: selectedBasis,
        grossProfit,
        grossMargin: selected.revenue > 0 ? Math.round((grossProfit / selected.revenue) * 10000) / 100 : 0,
        netProfit,
        netMargin: selected.revenue > 0 ? Math.round((netProfit / selected.revenue) * 10000) / 100 : 0,
        byBasis: {
          cash: {
            grossProfit: basisSummary.cash.revenue - basisSummary.cash.costOfGoodsSold,
            grossMargin: basisSummary.cash.revenue > 0
              ? Math.round(((basisSummary.cash.revenue - basisSummary.cash.costOfGoodsSold) / basisSummary.cash.revenue) * 10000) / 100
              : 0,
            netProfit: basisSummary.cash.revenue - basisSummary.cash.totalCosts,
            netMargin: basisSummary.cash.revenue > 0
              ? Math.round(((basisSummary.cash.revenue - basisSummary.cash.totalCosts) / basisSummary.cash.revenue) * 10000) / 100
              : 0,
          },
          accrual: {
            grossProfit: basisSummary.accrual.revenue - basisSummary.accrual.costOfGoodsSold,
            grossMargin: basisSummary.accrual.revenue > 0
              ? Math.round(((basisSummary.accrual.revenue - basisSummary.accrual.costOfGoodsSold) / basisSummary.accrual.revenue) * 10000) / 100
              : 0,
            netProfit: basisSummary.accrual.revenue - basisSummary.accrual.totalCosts,
            netMargin: basisSummary.accrual.revenue > 0
              ? Math.round(((basisSummary.accrual.revenue - basisSummary.accrual.totalCosts) / basisSummary.accrual.revenue) * 10000) / 100
              : 0,
          },
        },
      },
    };
  }

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // RECONCILIATION — Đối soát tài chính
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

  async getReconciliationReport(startDate?: string, endDate?: string): Promise<any> {
    const dateFilter: any = {};
    if (startDate) dateFilter.$gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      dateFilter.$lte = end;
    }
    const hasDateFilter = Object.keys(dateFilter).length > 0;
    const unreconciledFilter: any = { isReconciled: false };
    if (hasDateFilter) {
      unreconciledFilter.transactionDate = dateFilter;
    }

    const [bankSummary, fundsSummary, unreconciledCount, walletTotal, pnl, loanSummary] = await Promise.all([
      this.getBankAccountSummary(),
      this.getFundsSummary(),
      this.bankTransactionModel.countDocuments(unreconciledFilter),
      this.getWalletTotals(),
      this.getProfitAndLoss(startDate, endDate),
      this.loanAggregate.getDebtSummary(['ACTIVE']),
    ]);

    const totalLoanDebt = loanSummary.totalDebt || 0;
    const activeLoanCount = loanSummary.count || 0;
    const walletLiability = walletTotal.totalLiability ?? Math.max(walletTotal.totalBalance || 0, 0);

    return {
      bankAccounts: bankSummary,
      funds: fundsSummary,
      wallets: walletTotal,
      unreconciledTransactions: unreconciledCount,
      profitAndLoss: pnl.summary,
      loanSummary: {
        totalDebt: totalLoanDebt,
        activeLoanCount,
      },
      healthIndicators: {
        bankBalance: bankSummary.totalBalance,
        fundBalance: fundsSummary.totalBalance,
        walletLiability,
        loanDebt: totalLoanDebt,
        netPosition: bankSummary.totalBalance + fundsSummary.totalBalance - walletLiability - totalLoanDebt,
        unreconciledItems: unreconciledCount,
        fundWarnings: fundsSummary.warningCount,
      },
    };
  }

  private async getWalletTotals(): Promise<any> {
    const agg = await this.walletModel.aggregate([
      { $match: { status: { $ne: 'CLOSED' } } },
      {
        $group: {
          _id: null,
          totalBalance: { $sum: '$balance' },
          totalLiability: {
            $sum: {
              $cond: [{ $gt: ['$balance', 0] }, '$balance', 0],
            },
          },
          totalReceivable: {
            $sum: {
              $abs: {
                $cond: [{ $lt: ['$balance', 0] }, '$balance', 0],
              },
            },
          },
          count: { $sum: 1 },
        },
      },
    ]);
    return agg[0] || { totalBalance: 0, totalLiability: 0, totalReceivable: 0, count: 0 };
  }

  private async getBurnRateOutflows(since: Date): Promise<{
    payrollTotal6m: number;
    expenseTotal6m: number;
    adCostTotal6m: number;
  }> {
    const [payrollTotal6m, expenseTotal6m, adCostRows] = await Promise.all([
      this.payrollAggregate.getPaidTotalSince(since),
      this.expenseAggregate.getPaidTotalSince(since),
      this.adCostModel.aggregate([
        { $match: { date: { $gte: since }, source: { $ne: 'ESTIMATED' } } }, // BUG #5 fix
        { $group: { _id: null, total: { $sum: '$spend' } } },
      ]),
    ]);

    return {
      payrollTotal6m,
      expenseTotal6m,
      adCostTotal6m: adCostRows[0]?.total || 0,
    };
  }

  private async getProvisionalGrossProfitInMonth(
    monthStart: Date,
    monthEndExclusive: Date,
  ): Promise<{
    period: { month: number; year: number; startDate: string; endDate: string };
    cashInflow: { approvedInvoiceAmount: number; approvedInvoiceCount: number };
    provisional: { revenueAmount: number; teacherPayoutAmount: number; attendanceCount: number };
    grossProfitAmount: number;
  }> {
    const [approvedInvoices, attendanceFinancials] = await Promise.all([
      this.invoiceModel.aggregate([
        {
          $match: {
            status: 'APPROVED',
            paymentDate: { $gte: monthStart, $lt: monthEndExclusive },
          },
        },
        { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]),
      this.attendanceModel.aggregate([
        {
          $match: {
            date: { $gte: monthStart, $lt: monthEndExclusive },
            status: { $in: [...COUNTED_ATTENDANCE_STATUSES] },
            sessionId: { $exists: true, $ne: null },
          },
        },
        {
          $lookup: {
            from: this.sessionModel.collection.name,
            localField: 'sessionId',
            foreignField: '_id',
            as: 'session',
          },
        },
        { $unwind: '$session' },
        {
          $group: {
            _id: null,
            provisionalRevenue: { $sum: { $ifNull: ['$session.amountCharged', 0] } },
            provisionalTeacherPayout: { $sum: { $ifNull: ['$session.teacherPayout', 0] } },
            attendanceCount: { $sum: 1 },
          },
        },
      ]),
    ]);

    const invoiceAmount = approvedInvoices[0]?.total || 0;
    const invoiceCount = approvedInvoices[0]?.count || 0;
    const provisionalRevenue = attendanceFinancials[0]?.provisionalRevenue || 0;
    const provisionalTeacherPayout = attendanceFinancials[0]?.provisionalTeacherPayout || 0;
    const attendanceCount = attendanceFinancials[0]?.attendanceCount || 0;

    return {
      period: {
        month: monthStart.getMonth() + 1,
        year: monthStart.getFullYear(),
        startDate: monthStart.toISOString(),
        endDate: new Date(monthEndExclusive.getTime() - 1).toISOString(),
      },
      cashInflow: {
        approvedInvoiceAmount: invoiceAmount,
        approvedInvoiceCount: invoiceCount,
      },
      provisional: {
        revenueAmount: provisionalRevenue,
        teacherPayoutAmount: provisionalTeacherPayout,
        attendanceCount,
      },
      grossProfitAmount: provisionalRevenue - provisionalTeacherPayout,
    };
  }

  private resolveMonthRange(month?: string): { monthStart: Date; monthEndExclusive: Date } {
    if (!month) {
      const now = new Date();
      return {
        monthStart: new Date(now.getFullYear(), now.getMonth(), 1),
        monthEndExclusive: new Date(now.getFullYear(), now.getMonth() + 1, 1),
      };
    }

    const normalized = month.trim();
    const matched = /^(\d{4})-(\d{2})$/.exec(normalized);
    if (!matched) {
      throw new BadRequestException('Thang khong hop le, vui long dung dinh dang YYYY-MM');
    }

    const year = Number(matched[1]);
    const monthIndex = Number(matched[2]);
    if (!Number.isFinite(year) || !Number.isFinite(monthIndex) || monthIndex < 1 || monthIndex > 12) {
      throw new BadRequestException('Thang khong hop le, vui long dung dinh dang YYYY-MM');
    }

    return {
      monthStart: new Date(year, monthIndex - 1, 1),
      monthEndExclusive: new Date(year, monthIndex, 1),
    };
  }

  async getProvisionalGrossProfit(month?: string): Promise<{
    period: { month: number; year: number; startDate: string; endDate: string };
    cashInflow: { approvedInvoiceAmount: number; approvedInvoiceCount: number };
    provisional: { revenueAmount: number; teacherPayoutAmount: number; attendanceCount: number };
    grossProfitAmount: number;
  }> {
    const { monthStart, monthEndExclusive } = this.resolveMonthRange(month);
    return this.getProvisionalGrossProfitInMonth(monthStart, monthEndExclusive);
  }

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // FINANCIAL DASHBOARD — Bảng chỉ số tài chính quản trị
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

  async getFinancialDashboard(): Promise<any> {
    const now = new Date();
    const in14Days = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

    // 6 months ago for average calculation
    const sixMonthsAgo = new Date(now);
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    // Last month for revenue growth
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const [
      bankSummary,
      fundsSummary,
      marketingFunds,
      walletTotals,
      pendingPayroll,
      pendingExpenses,
      upcomingOrderPayments,
      avgMonthlyOutflows,
      pendingInvoices,
      thisMonthRevenue,
      lastMonthRevenue,
      pnl,
      loanDebtSummary,
      upcomingLoanPayments14Days,
      upcomingLoanPayments30Days,
    ] = await Promise.all([
      // 1. Bank & Fund balances
      this.getBankAccountSummary(),
      this.getFundsSummary(),

      // 2. Marketing fund specifically
      this.fundModel.aggregate([
        { $match: { fundType: 'MARKETING', status: 'ACTIVE' } },
        { $group: { _id: null, total: { $sum: '$currentBalance' }, count: { $sum: 1 } } },
      ]),

      // 3. Wallet totals (deferred revenue / liability)
      this.getWalletTotals(),

      // 4. Payroll APPROVED but not PAID
      this.payrollAggregate.getApprovedPayables(),

      // 5. Expenses APPROVED_UNPAID
      this.expenseAggregate.getApprovedPayables(),

      // 6. Order payment frames due within 14 days
      this.orderModel.aggregate([
        {
          $match: {
            status: { $nin: ['CANCELLED', 'REJECTED'] },
            'paymentFrames.dueDate': { $lte: in14Days, $gte: now },
            'paymentFrames.status': { $ne: 'PAID' },
          },
        },
        { $unwind: '$paymentFrames' },
        {
          $match: {
            'paymentFrames.dueDate': { $lte: in14Days, $gte: now },
            'paymentFrames.status': { $ne: 'PAID' },
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$paymentFrames.amount' },
            count: { $sum: 1 },
          },
        },
      ]),

      // 7. Average monthly outflows (last 6 months) for burn rate
      this.getBurnRateOutflows(sixMonthsAgo),

      // 8. Pending invoices (money coming in)
      this.invoiceModel.aggregate([
        { $match: { status: 'PENDING_APPROVAL' } },
        { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]),

      // 9. This month revenue (sessions finalized)
      this.sessionModel.aggregate([
        { $match: { status: 'FINALIZED', scheduledDate: { $gte: thisMonthStart } } },
        { $group: { _id: null, total: { $sum: '$amountCharged' } } },
      ]),

      // 10. Last month revenue
      this.sessionModel.aggregate([
        { $match: { status: 'FINALIZED', scheduledDate: { $gte: lastMonthStart, $lte: lastMonthEnd } } },
        { $group: { _id: null, total: { $sum: '$amountCharged' } } },
      ]),

      // 11. P&L for margins
      this.getProfitAndLoss(),

      this.loanAggregate.getDebtSummary(['ACTIVE']),
      this.loanAggregate.getUpcomingOutstandingSummary(in14Days),
      this.loanAggregate.getUpcomingOutstandingSummary(in30Days),
    ]);

    // â”€â”€ Calculate derived metrics â”€â”€

    const bankBalance = bankSummary.totalBalance || 0;
    const fundBalance = fundsSummary.totalBalance || 0;
    const marketingFundBalance = marketingFunds[0]?.total || 0;
    const availableCash = bankBalance + fundBalance;

    // Upcoming payables
    const payrollPayable = pendingPayroll.total || 0;
    const payrollPayableCount = pendingPayroll.count || 0;
    const expensePayable = pendingExpenses.total || 0;
    const expensePayableCount = pendingExpenses.count || 0;
    const orderPayable = upcomingOrderPayments[0]?.total || 0;
    const orderPayableCount = upcomingOrderPayments[0]?.count || 0;
    const loanPayable14Days = upcomingLoanPayments14Days.total || 0;
    const loanPayable14DaysCount = upcomingLoanPayments14Days.count || 0;
    const loanPayable = upcomingLoanPayments30Days.total || 0;
    const loanPayableCount = upcomingLoanPayments30Days.count || 0;
    const totalDebt = loanDebtSummary.totalDebt || 0;
    const activeLoanCount = loanDebtSummary.count || 0;
    const totalPayable14Days = payrollPayable + expensePayable + orderPayable + loanPayable14Days;

    // Burn rate (average monthly)
    const totalOutflow6m =
      avgMonthlyOutflows.payrollTotal6m +
      avgMonthlyOutflows.expenseTotal6m +
      avgMonthlyOutflows.adCostTotal6m;
    const burnRate = Math.round(totalOutflow6m / 6);
    const operatingReserve3Months = burnRate * 3;
    const runway = burnRate > 0 ? Math.round((availableCash / burnRate) * 10) / 10 : 999;

    // Deferred revenue & receivables
    const walletBalance = walletTotals.totalLiability ?? Math.max(walletTotals.totalBalance || 0, 0);
    const pendingInvoiceAmount = pendingInvoices[0]?.total || 0;
    const pendingInvoiceCount = pendingInvoices[0]?.count || 0;

    // Revenue growth
    const thisMonthRev = thisMonthRevenue[0]?.total || 0;
    const lastMonthRev = lastMonthRevenue[0]?.total || 0;
    const revenueGrowth = lastMonthRev > 0
      ? Math.round(((thisMonthRev - lastMonthRev) / lastMonthRev) * 10000) / 100
      : 0;

    // Accounting ratios
    const currentAssets = availableCash + pendingInvoiceAmount;
    const currentLiabilities = totalPayable14Days + walletBalance;
    const currentRatio = currentLiabilities > 0
      ? Math.round((currentAssets / currentLiabilities) * 100) / 100
      : 999;

    return {
      // Section 1: Cash position
      cashPosition: {
        bankBalance,
        bankAccountCount: bankSummary.accountCount || 0,
        fundBalance,
        fundCount: fundsSummary.fundCount || 0,
        marketingFund: marketingFundBalance,
        marketingFundCount: marketingFunds[0]?.count || 0,
        availableCash,
      },

      // Section 2: Obligations & Reserve
      obligations: {
        payrollPayable,
        payrollPayableCount,
        expensePayable,
        expensePayableCount,
        orderPayable,
        orderPayableCount,
        loanPayable: loanPayable14Days,
        loanPayableCount: loanPayable14DaysCount,
        totalPayable14Days,
        operatingReserve3Months,
        burnRate,
        runway,
        reserveHealthy: availableCash >= operatingReserve3Months,
        cashAfterObligations: availableCash - totalPayable14Days,
      },

      // Section 3: Deferred revenue & receivables
      deferredRevenue: {
        walletBalance,
        walletCount: walletTotals.count || 0,
        pendingInvoiceAmount,
        pendingInvoiceCount,
      },

      // Section 4: Accounting metrics
      metrics: {
        burnRate,
        runway,
        currentRatio,
        grossMargin: pnl.summary.grossMargin,
        netMargin: pnl.summary.netMargin,
        grossProfit: pnl.summary.grossProfit,
        netProfit: pnl.summary.netProfit,
        revenueGrowth,
        thisMonthRevenue: thisMonthRev,
        lastMonthRevenue: lastMonthRev,
        accountsReceivable: pendingInvoiceAmount,
        accountsPayable: payrollPayable + expensePayable,
        deferredRevenue: walletBalance,
      },

      // Section 5: Debt position (loans)
      debtPosition: {
        totalDebt,
        activeLoanCount,
        loanPayable,
        loanPayableCount,
      },

      // Fund warnings
      fundWarnings: fundsSummary.warnings || [],
    };
  }

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // FINANCIAL OVERVIEW — Tổng quan tài chính cho Director
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

  async getFinancialOverview(startDate?: string, endDate?: string): Promise<any> {
    const [bankSummary, fundsSummary, cashFlow, pnl] = await Promise.all([
      this.getBankAccountSummary(),
      this.getFundsSummary(),
      this.getCashFlow({ startDate, endDate, groupBy: 'month' }),
      this.getProfitAndLoss(startDate, endDate),
    ]);

    return {
      bankAccounts: bankSummary,
      funds: fundsSummary,
      cashFlow: {
        totalInflow: cashFlow.totalInflow,
        totalOutflow: cashFlow.totalOutflow,
        netCashFlow: cashFlow.netCashFlow,
        recentMonths: cashFlow.timeline.slice(-6),
      },
      profitAndLoss: pnl,
    };
  }

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // FINANCIAL ALERTS — Cảnh báo & Chỉ dẫn hành động
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

  async getFinancialAlerts(): Promise<any> {
    const [
      dashboard,
      fundsSummary,
      pnl,
      marketingBudgetNeeded,
      unreconciledCount,
      recentCashFlow,
      pendingExpenses,
      overdueOrders,
    ] = await Promise.all([
      this.getFinancialDashboard(),
      this.getFundsSummary(),
      this.getProfitAndLoss(),
      this.calculateOptimalMarketingBudget(),
      this.bankTransactionModel.countDocuments({ isReconciled: false }),
      this.getCashFlow({ groupBy: 'month' }),
      this.expenseModel.countDocuments({ paymentStatus: 'APPROVED_UNPAID' }),
      this.orderModel.aggregate([
        {
          $match: {
            status: { $nin: ['CANCELLED', 'REJECTED'] },
            'paymentFrames.dueDate': { $lt: new Date() },
            'paymentFrames.status': { $ne: 'PAID' },
          },
        },
        { $unwind: '$paymentFrames' },
        {
          $match: {
            'paymentFrames.dueDate': { $lt: new Date() },
            'paymentFrames.status': { $ne: 'PAID' },
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$paymentFrames.amount' },
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const alerts: any[] = [];

    // ── 1. Quỹ Marketing vs chi phí ads tối ưu đề xuất ──
    const marketingFundBalance = dashboard.cashPosition.marketingFund || 0;
    const optimalAdsBudget = marketingBudgetNeeded.totalOptimalDailyBudget;
    const optimalMonthlyBudget = optimalAdsBudget * 30;

    if (optimalAdsBudget > 0) {
      const coverageMonths = optimalMonthlyBudget > 0
        ? Math.round((marketingFundBalance / optimalMonthlyBudget) * 10) / 10
        : 999;

      if (marketingFundBalance < optimalMonthlyBudget) {
        const deficit = optimalMonthlyBudget - marketingFundBalance;
        alerts.push({
          id: 'MARKETING_FUND_LOW',
          severity: marketingFundBalance < optimalMonthlyBudget * 0.5 ? 'CRITICAL' : 'WARNING',
          category: 'MARKETING',
          title: 'Quỹ Marketing không đủ cho chi phí QC tối ưu',
          message: `Quỹ Marketing hiện có ${marketingFundBalance.toLocaleString()}đ, nhưng ngân sách QC tối ưu đề xuất là ${optimalMonthlyBudget.toLocaleString()}đ/tháng (${optimalAdsBudget.toLocaleString()}đ/ngày). Chỉ đủ cho ${coverageMonths} tháng.`,
          data: {
            currentBalance: marketingFundBalance,
            optimalDailyBudget: optimalAdsBudget,
            optimalMonthlyBudget,
            deficit,
            coverageMonths,
            groupBreakdown: marketingBudgetNeeded.groupBreakdown,
          },
          actions: [
            { label: 'Nạp thêm quỹ Marketing', type: 'FUND_DEPOSIT', target: 'MARKETING', amount: deficit },
            { label: 'Xem phân tích QC & điều chỉnh ngân sách', type: 'NAVIGATE', target: '/ads-analytics' },
            { label: 'Giảm ngân sách QC các nhóm hiệu quả thấp', type: 'NAVIGATE', target: '/ads-management' },
          ],
        });
      } else {
        alerts.push({
          id: 'MARKETING_FUND_OK',
          severity: 'INFO',
          category: 'MARKETING',
          title: 'Quỹ Marketing đủ cho hoạt động QC',
          message: `Quỹ Marketing đủ cho ${coverageMonths} tháng QC tối ưu (${optimalMonthlyBudget.toLocaleString()}đ/tháng).`,
          data: { currentBalance: marketingFundBalance, optimalMonthlyBudget, coverageMonths },
          actions: [],
        });
      }
    }

    // ── 2. Runway cảnh báo ──
    const { runway, burnRate } = dashboard.obligations;
    if (runway < 2) {
      alerts.push({
        id: 'RUNWAY_CRITICAL',
        severity: 'CRITICAL',
        category: 'CASH_FLOW',
        title: 'Runway nguy hiểm — dưới 2 tháng',
        message: `Với tốc độ chi ${burnRate.toLocaleString()}đ/tháng, tiền khả dụng chỉ đủ hoạt động ${runway} tháng. Cần hành động ngay.`,
        data: { runway, burnRate, availableCash: dashboard.cashPosition.availableCash },
        actions: [
          { label: 'Cắt giảm chi phí vận hành', type: 'NAVIGATE', target: '/expenses' },
          { label: 'Thu hồi công nợ & hóa đơn chờ duyệt', type: 'NAVIGATE', target: '/invoices' },
          { label: 'Tạm dừng chiến dịch QC hiệu quả thấp', type: 'NAVIGATE', target: '/ads-management' },
        ],
      });
    } else if (runway < 4) {
      alerts.push({
        id: 'RUNWAY_WARNING',
        severity: 'WARNING',
        category: 'CASH_FLOW',
        title: 'Runway thấp — dưới 4 tháng',
        message: `Runway hiện tại ${runway} tháng. Nên duy trì ít nhất 6 tháng dự phòng.`,
        data: { runway, burnRate, availableCash: dashboard.cashPosition.availableCash },
        actions: [
          { label: 'Tối ưu chi phí', type: 'NAVIGATE', target: '/expenses' },
          { label: 'Đẩy mạnh thu học phí', type: 'NAVIGATE', target: '/orders' },
        ],
      });
    }

    // ── 3. Dự phòng hoạt động 3 tháng ──
    if (!dashboard.obligations.reserveHealthy) {
      const { operatingReserve3Months, cashAfterObligations } = dashboard.obligations;
      const shortfall = operatingReserve3Months - dashboard.cashPosition.availableCash;
      alerts.push({
        id: 'RESERVE_INSUFFICIENT',
        severity: 'WARNING',
        category: 'RESERVE',
        title: 'Tiền khả dụng chưa đủ dự phòng 3 tháng',
        message: `Cần ${operatingReserve3Months.toLocaleString()}đ dự phòng 3 tháng, hiện thiếu ${shortfall.toLocaleString()}đ.`,
        data: { required: operatingReserve3Months, shortfall, available: dashboard.cashPosition.availableCash },
        actions: [
          { label: 'Nạp quỹ dự phòng', type: 'FUND_DEPOSIT', target: 'RESERVE', amount: shortfall },
          { label: 'Rà soát & cắt chi phí không cần thiết', type: 'NAVIGATE', target: '/expenses' },
        ],
      });
    }

    // ── 4. Quỹ dưới mức tối thiểu ──
    for (const warning of (fundsSummary.warnings || [])) {
      alerts.push({
        id: `FUND_BELOW_MIN_${warning.fundCode}`,
        severity: 'WARNING',
        category: 'FUND',
        title: `Quỹ "${warning.name}" dưới mức tối thiểu`,
        message: `${warning.name} (${warning.fundCode}): Hiện có ${warning.currentBalance.toLocaleString()}đ, tối thiểu ${warning.minimumBalance.toLocaleString()}đ, thiếu ${warning.deficit.toLocaleString()}đ.`,
        data: warning,
        actions: [
          { label: `Nạp thêm ${warning.deficit.toLocaleString()}đ`, type: 'FUND_DEPOSIT', target: warning.fundCode, amount: warning.deficit },
        ],
      });
    }

    // ── 5. Nghĩa vụ thanh toán 14 ngày ──
    const { totalPayable14Days, cashAfterObligations } = dashboard.obligations;
    if (cashAfterObligations < 0) {
      alerts.push({
        id: 'OBLIGATIONS_EXCEED_CASH',
        severity: 'CRITICAL',
        category: 'OBLIGATIONS',
        title: 'Không đủ tiền thanh toán nghĩa vụ 14 ngày tới',
        message: `Tổng phải trả ${totalPayable14Days.toLocaleString()}đ trong 14 ngày, nhưng tiền khả dụng chỉ ${dashboard.cashPosition.availableCash.toLocaleString()}đ. Thiếu ${Math.abs(cashAfterObligations).toLocaleString()}đ.`,
        data: {
          totalPayable: totalPayable14Days,
          available: dashboard.cashPosition.availableCash,
          deficit: Math.abs(cashAfterObligations),
          payroll: dashboard.obligations.payrollPayable,
          expenses: dashboard.obligations.expensePayable,
          orders: dashboard.obligations.orderPayable,
          loans: dashboard.obligations.loanPayable,
        },
        actions: [
          { label: 'Thu hồi công nợ gấp', type: 'NAVIGATE', target: '/invoices' },
          { label: 'Hoãn chi lương / chi phí nếu có thể', type: 'INFO' },
          { label: 'Rút quỹ dự phòng', type: 'FUND_WITHDRAW', target: 'RESERVE' },
        ],
      });
    }

    // ── 6. Current Ratio thấp ──
    const { currentRatio } = dashboard.metrics;
    if (currentRatio < 1) {
      alerts.push({
        id: 'CURRENT_RATIO_DANGER',
        severity: 'CRITICAL',
        category: 'METRICS',
        title: 'Current Ratio < 1 — Rủi ro mất khả năng thanh toán',
        message: `Current Ratio = ${currentRatio}. Tài sản ngắn hạn nhỏ hơn nợ ngắn hạn, cần tăng doanh thu hoặc giảm nợ.`,
        data: { currentRatio },
        actions: [
          { label: 'Đẩy mạnh thu phí & giảm nợ', type: 'NAVIGATE', target: '/orders' },
          { label: 'Tối ưu chi phí VH', type: 'NAVIGATE', target: '/expenses' },
        ],
      });
    } else if (currentRatio < 1.5) {
      alerts.push({
        id: 'CURRENT_RATIO_LOW',
        severity: 'WARNING',
        category: 'METRICS',
        title: 'Current Ratio thấp (< 1.5)',
        message: `Current Ratio = ${currentRatio}. Nên duy trì >= 1.5 để đảm bảo thanh khoản.`,
        data: { currentRatio },
        actions: [
          { label: 'Xem chi tiết tài chính', type: 'NAVIGATE', target: '/financial-control' },
        ],
      });
    }

    // ── 7. Lợi nhuận ròng âm ──
    if (pnl.summary.netProfit < 0) {
      alerts.push({
        id: 'NET_PROFIT_NEGATIVE',
        severity: pnl.summary.netProfit < -pnl.revenue.total * 0.2 ? 'CRITICAL' : 'WARNING',
        category: 'PROFITABILITY',
        title: 'Lợi nhuận ròng âm — đang lỗ',
        message: `Lỗ ròng ${Math.abs(pnl.summary.netProfit).toLocaleString()}đ (biên lợi nhuận ${pnl.summary.netMargin}%). Cần rà soát cơ cấu chi phí.`,
        data: {
          netProfit: pnl.summary.netProfit,
          netMargin: pnl.summary.netMargin,
          revenue: pnl.revenue.total,
          totalCosts: pnl.costs.totalCosts,
        },
        actions: [
          { label: 'Xem P&L chi tiết', type: 'NAVIGATE', target: '/financial-control?tab=pnl' },
          { label: 'Rà soát chi phí giáo viên', type: 'NAVIGATE', target: '/sessions' },
          { label: 'Tăng giá hoặc đẩy enrollment', type: 'NAVIGATE', target: '/orders' },
        ],
      });
    }

    // ── 8. Giao dịch chưa đối soát ──
    if (unreconciledCount > 20) {
      alerts.push({
        id: 'UNRECONCILED_HIGH',
        severity: 'WARNING',
        category: 'RECONCILIATION',
        title: `${unreconciledCount} giao dịch chưa đối soát`,
        message: `Có ${unreconciledCount} giao dịch ngân hàng chưa được đối soát. Nên đối soát định kỳ để đảm bảo chính xác sổ sách.`,
        data: { count: unreconciledCount },
        actions: [
          { label: 'Đối soát giao dịch', type: 'NAVIGATE', target: '/financial-control?tab=bank' },
        ],
      });
    }

    // ── 9. Chi phí chờ thanh toán ──
    if (pendingExpenses > 5) {
      alerts.push({
        id: 'PENDING_EXPENSES',
        severity: 'INFO',
        category: 'EXPENSES',
        title: `${pendingExpenses} chi phí đã duyệt chưa thanh toán`,
        message: `Có ${pendingExpenses} khoản chi phí đã được duyệt nhưng chưa thanh toán. Nên xử lý sớm.`,
        data: { count: pendingExpenses },
        actions: [
          { label: 'Xem chi phí chờ thanh toán', type: 'NAVIGATE', target: '/expenses' },
        ],
      });
    }

    // ── 10. Đơn hàng quá hạn thanh toán ──
    const overdueAmount = overdueOrders[0]?.total || 0;
    const overdueCount = overdueOrders[0]?.count || 0;
    if (overdueCount > 0) {
      alerts.push({
        id: 'OVERDUE_PAYMENTS',
        severity: overdueAmount > burnRate * 0.5 ? 'CRITICAL' : 'WARNING',
        category: 'RECEIVABLE',
        title: `${overdueCount} kỳ thanh toán quá hạn`,
        message: `Có ${overdueCount} kỳ thanh toán quá hạn, tổng ${overdueAmount.toLocaleString()}đ. Cần nhắc nhở phụ huynh.`,
        data: { count: overdueCount, amount: overdueAmount },
        actions: [
          { label: 'Xem đơn hàng quá hạn', type: 'NAVIGATE', target: '/orders' },
          { label: 'Gửi nhắc nhở phụ huynh', type: 'INFO' },
        ],
      });
    }

    // ── 11. Dòng tiền ròng âm liên tục ──
    const recentMonths = recentCashFlow.timeline.slice(-3);
    const negativeMonths = recentMonths.filter((m: any) => m.netCashFlow < 0);
    if (negativeMonths.length >= 2) {
      const totalNegative = negativeMonths.reduce((s: number, m: any) => s + m.netCashFlow, 0);
      alerts.push({
        id: 'NEGATIVE_CASHFLOW_TREND',
        severity: negativeMonths.length >= 3 ? 'CRITICAL' : 'WARNING',
        category: 'CASH_FLOW',
        title: `Dòng tiền ròng âm ${negativeMonths.length}/${recentMonths.length} tháng gần đây`,
        message: `Dòng tiền ròng âm liên tục cho thấy chi tiêu đang vượt thu nhập. Tổng âm: ${totalNegative.toLocaleString()}đ.`,
        data: { negativeMonths: negativeMonths.length, totalNegative, recentMonths },
        actions: [
          { label: 'Phân tích dòng tiền chi tiết', type: 'NAVIGATE', target: '/financial-control?tab=cashflow' },
          { label: 'Rà soát các khoản chi lớn', type: 'NAVIGATE', target: '/expenses' },
          { label: 'Tăng tuyển sinh / marketing', type: 'NAVIGATE', target: '/ads-analytics' },
        ],
      });
    }

    // ── 12. Khoản vay quá hạn ──
    const loanOverduePayments = await this.loanAggregate.getOverdueOutstandingSummary();
    const loanOverdueAmount = loanOverduePayments.total || 0;
    const loanOverdueCount = loanOverduePayments.count || 0;
    if (loanOverdueCount > 0) {
      alerts.push({
        id: 'LOAN_OVERDUE_PAYMENTS',
        severity: loanOverdueAmount > burnRate * 0.3 ? 'CRITICAL' : 'WARNING',
        category: 'LOAN',
        title: `${loanOverdueCount} kỳ trả nợ vay quá hạn`,
        message: `Có ${loanOverdueCount} kỳ trả nợ vay quá hạn, tổng ${loanOverdueAmount.toLocaleString()}đ. Cần xử lý ngay để tránh phạt lãi.`,
        data: { count: loanOverdueCount, amount: loanOverdueAmount },
        actions: [
          { label: 'Xem khoản vay', type: 'NAVIGATE', target: '/loans' },
          { label: 'Thanh toán ngay', type: 'INFO' },
        ],
      });
    }

    // ── 13. Tỷ lệ nợ cao ──
    const loanTotalDebt = dashboard.debtPosition?.totalDebt || 0;
    if (loanTotalDebt > dashboard.cashPosition.availableCash) {
      alerts.push({
        id: 'LOAN_HIGH_DEBT_RATIO',
        severity: loanTotalDebt > dashboard.cashPosition.availableCash * 2 ? 'CRITICAL' : 'WARNING',
        category: 'LOAN',
        title: 'Tổng nợ vay vượt tiền khả dụng',
        message: `Tổng nợ vay ${loanTotalDebt.toLocaleString()}đ vượt tiền khả dụng ${dashboard.cashPosition.availableCash.toLocaleString()}đ. Cần cân nhắc chiến lược trả nợ.`,
        data: { totalDebt: loanTotalDebt, availableCash: dashboard.cashPosition.availableCash },
        actions: [
          { label: 'Xem chi tiết khoản vay', type: 'NAVIGATE', target: '/loans' },
          { label: 'Xem dòng tiền', type: 'NAVIGATE', target: '/financial-control?tab=cashflow' },
        ],
      });
    }

    // ── 14. Khoản vay sắp đáo hạn ──
    const in30DaysAlert = new Date(new Date().getTime() + 30 * 24 * 60 * 60 * 1000);
    const nearMaturityLoans = await this.loanAggregate.getNearMaturityLoans(in30DaysAlert);
    for (const loan of nearMaturityLoans) {
      alerts.push({
        id: `LOAN_NEAR_MATURITY_${(loan as any)._id}`,
        severity: 'WARNING',
        category: 'LOAN',
        title: `Khoản vay ${(loan as any).loanCode} sắp đáo hạn`,
        message: `Khoản vay từ ${(loan as any).lenderName}, gốc ${(loan as any).principal.toLocaleString()}đ, còn nợ ${(loan as any).remainingBalance.toLocaleString()}đ, đáo hạn ${new Date((loan as any).endDate).toLocaleDateString('vi-VN')}.`,
        data: { loanCode: (loan as any).loanCode, remainingBalance: (loan as any).remainingBalance, endDate: (loan as any).endDate },
        actions: [
          { label: 'Xem khoản vay', type: 'NAVIGATE', target: '/loans' },
        ],
      });
    }

    // ── 15. Tăng trưởng doanh thu giảm ──
    const { revenueGrowth } = dashboard.metrics;
    if (revenueGrowth < -10) {
      alerts.push({
        id: 'REVENUE_DECLINING',
        severity: revenueGrowth < -30 ? 'CRITICAL' : 'WARNING',
        category: 'REVENUE',
        title: `Doanh thu giảm ${Math.abs(revenueGrowth)}% so với tháng trước`,
        message: `Tháng trước: ${dashboard.metrics.lastMonthRevenue.toLocaleString()}đ → Tháng này: ${dashboard.metrics.thisMonthRevenue.toLocaleString()}đ (${revenueGrowth}%).`,
        data: { revenueGrowth, thisMonth: dashboard.metrics.thisMonthRevenue, lastMonth: dashboard.metrics.lastMonthRevenue },
        actions: [
          { label: 'Tăng chiến dịch QC', type: 'NAVIGATE', target: '/ads-management' },
          { label: 'Xem phân tích leads', type: 'NAVIGATE', target: '/leads' },
          { label: 'Đẩy mạnh tuyển sinh', type: 'NAVIGATE', target: '/orders' },
        ],
      });
    }

    // Sort: CRITICAL â†’ WARNING â†’ INFO
    const severityOrder: Record<string, number> = { CRITICAL: 0, WARNING: 1, INFO: 2 };
    alerts.sort((a, b) => (severityOrder[a.severity] ?? 3) - (severityOrder[b.severity] ?? 3));

    return {
      totalAlerts: alerts.length,
      criticalCount: alerts.filter(a => a.severity === 'CRITICAL').length,
      warningCount: alerts.filter(a => a.severity === 'WARNING').length,
      infoCount: alerts.filter(a => a.severity === 'INFO').length,
      marketingBudget: {
        fundBalance: marketingFundBalance,
        optimalDailyBudget: optimalAdsBudget,
        optimalMonthlyBudget,
        groupBreakdown: marketingBudgetNeeded.groupBreakdown,
      },
      alerts,
    };
  }

  /**
   * Tính ngân sách marketing tối ưu = tổng chi phí ads đề xuất tối ưu từ các nhóm QC
   * Dùng logarithmic curve fitting giống ads.service
   */
  private async calculateOptimalMarketingBudget(): Promise<{
    totalOptimalDailyBudget: number;
    groupBreakdown: any[];
  }> {
    if (!this.adsAnalyticsService) {
      return this.calculateOptimalMarketingBudgetLegacy();
    }

    try {
      const now = new Date();
      const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
      const start = new Date(end);
      start.setUTCDate(start.getUTCDate() - 29);

      const [activeGroups, recentSpend] = await Promise.all([
        this.adGroupModel.find({ status: 'ACTIVE' }).lean(),
        this.adCostModel.aggregate([
          { $match: { date: { $gte: start, $lte: end } } },
          { $group: { _id: null, totalSpend: { $sum: { $ifNull: ['$spend', 0] } } } },
        ]),
      ]);

      if (activeGroups.length === 0) {
        return { totalOptimalDailyBudget: 0, groupBreakdown: [] };
      }

      const configuredBudget = activeGroups
        .reduce((sum, group: any) => sum + Number(group.dailyBudget || 0), 0);
      const recentAverageBudget = Math.round(Number(recentSpend[0]?.totalSpend || 0) / 30);
      const baselineBudget = Math.max(0, configuredBudget, recentAverageBudget);

      const suggestionResult = await this.adsAnalyticsService.getSuggestions(
        this.formatDateOnlyUtc(start),
        this.formatDateOnlyUtc(end),
        baselineBudget,
      );

      const groupBreakdown = (Array.isArray(suggestionResult?.suggestions)
        ? suggestionResult.suggestions
        : [])
        .map((row: any) => ({
          adGroupId: row.adGroupId,
          adGroupName: row.adGroupName || '',
          platform: row.platform || '',
          currentDailySpend: Math.round(Number(row.currentDailySpend || 0)),
          optimalDailySpend: Math.round(Number(row.suggestedDailySpend || 0)),
          changePercent: Number.isFinite(row.changePercent) ? row.changePercent : 0,
          confidence: row.confidence || 'LOW',
          reason: this.buildSuggestionReason(row),
        }));

      const included = new Set(groupBreakdown.map((row: any) => String(row.adGroupId)));
      for (const group of activeGroups as any[]) {
        const gId = String(group._id);
        if (included.has(gId)) continue;
        const dailyBudget = Math.round(Number(group.dailyBudget || 0));
        groupBreakdown.push({
          adGroupId: gId,
          adGroupName: group.name || '',
          platform: group.platform || '',
          currentDailySpend: 0,
          optimalDailySpend: dailyBudget,
          changePercent: 0,
          confidence: 'LOW',
          reason: 'No recent data, fallback to configured daily budget',
        });
      }

      const totalFromSuggestions = Number(suggestionResult?.totalSuggestedDailySpend);
      const totalOptimalDailyBudget = Number.isFinite(totalFromSuggestions)
        ? Math.round(totalFromSuggestions)
        : groupBreakdown.reduce((sum: number, row: any) => sum + Number(row.optimalDailySpend || 0), 0);

      return { totalOptimalDailyBudget, groupBreakdown };
    } catch {
      return this.calculateOptimalMarketingBudgetLegacy();
    }
  }

  private formatDateOnlyUtc(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  private buildSuggestionReason(row: any): string {
    const dataPoints = Number(row?.dataPoints || 0);
    if (dataPoints < 7) {
      return 'Insufficient data (< 7 days)';
    }

    const changePercent = Number(row?.changePercent || 0);
    if (changePercent > 0) return 'Increase budget by marginal net-profit signal';
    if (changePercent < 0) return 'Reduce budget by marginal net-profit signal';
    return 'Keep current budget level';
  }

  private async calculateOptimalMarketingBudgetLegacy(): Promise<{
    totalOptimalDailyBudget: number;
    groupBreakdown: any[];
  }> {
    // Get last 30 days of ad data
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const activeGroups = await this.adGroupModel.find({ status: 'ACTIVE' }).lean();

    if (activeGroups.length === 0) {
      return { totalOptimalDailyBudget: 0, groupBreakdown: [] };
    }

    // Get daily spend & order data per group
    const [dailyData, dailyOrders] = await Promise.all([
      this.adCostModel.aggregate([
        { $match: { date: { $gte: thirtyDaysAgo } } },
        {
          $group: {
            _id: { adGroupId: '$adGroupId', date: '$date' },
            spend: { $sum: '$spend' },
            adGroupName: { $first: '$adGroupName' },
            platform: { $first: '$platform' },
          },
        },
      ]),
      this.orderModel.aggregate([
        {
          $match: {
            adGroupId: { $exists: true, $ne: null },
            createdAt: { $gte: thirtyDaysAgo },
            status: { $in: ['APPROVED', 'COMPLETED'] },
          },
        },
        {
          $group: {
            _id: {
              adGroupId: '$adGroupId',
              date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            },
            orders: { $sum: 1 },
            revenue: { $sum: '$finalAmount' },
          },
        },
      ]),
    ]);

    const orderMap = new Map<string, Map<string, { orders: number; revenue: number }>>();
    for (const o of dailyOrders) {
      const gId = o._id.adGroupId.toString();
      if (!orderMap.has(gId)) orderMap.set(gId, new Map());
      orderMap.get(gId)!.set(o._id.date, { orders: o.orders, revenue: o.revenue });
    }

    // Build group data
    const groupData = new Map<string, {
      name: string; platform: string;
      points: Array<{ spend: number; orders: number; revenue: number }>;
    }>();

    for (const row of dailyData) {
      const gId = row._id.adGroupId.toString();
      if (!groupData.has(gId)) {
        groupData.set(gId, { name: row.adGroupName || '', platform: row.platform, points: [] });
      }
      const dateStr = row._id.date.toISOString().split('T')[0];
      const orderInfo = orderMap.get(gId)?.get(dateStr) || { orders: 0, revenue: 0 };
      groupData.get(gId)!.points.push({ spend: row.spend, orders: orderInfo.orders, revenue: orderInfo.revenue });
    }

    const groupBreakdown: any[] = [];
    let totalOptimal = 0;

    for (const [gId, data] of groupData) {
      const points = data.points;
      const currentAvgSpend = points.length > 0 ? points.reduce((s, p) => s + p.spend, 0) / points.length : 0;

      if (points.length < 7) {
        // Not enough data - use current average as suggestion
        groupBreakdown.push({
          adGroupId: gId,
          adGroupName: data.name,
          platform: data.platform,
          currentDailySpend: Math.round(currentAvgSpend),
          optimalDailySpend: Math.round(currentAvgSpend),
          confidence: 'LOW',
          reason: 'Chưa đủ dữ liệu (< 7 ngày)',
        });
        totalOptimal += Math.round(currentAvgSpend);
        continue;
      }

      // Fit logarithmic curve: orders = a * ln(spend + 1) + b
      const xValues = points.map(p => p.spend);
      const yOrders = points.map(p => p.orders);
      const yRevenue = points.map(p => p.revenue);

      const orderFit = this.fitLogCurveInternal(xValues, yOrders);
      const revFit = this.fitLogCurveInternal(xValues, yRevenue);

      // Find optimal: maximize (revenue - spend) â†’ marginal revenue = 1
      // d(revenue)/d(spend) = revA / (spend + 1) = 1 â†’ spend = revA - 1
      let optimalSpend = currentAvgSpend;

      if (revFit.a > 1) {
        optimalSpend = Math.max(0, revFit.a - 1);
      } else if (orderFit.a > 0) {
        // Fallback: use point where marginal orders drop below threshold
        optimalSpend = Math.max(currentAvgSpend, orderFit.a * 5);
      }

      // Cap at 3x current average to avoid extreme suggestions
      optimalSpend = Math.min(optimalSpend, currentAvgSpend * 3);
      optimalSpend = Math.max(optimalSpend, currentAvgSpend * 0.5); // Don't suggest less than half current

      const rounded = Math.round(optimalSpend / 10000) * 10000; // Round to 10K

      groupBreakdown.push({
        adGroupId: gId,
        adGroupName: data.name,
        platform: data.platform,
        currentDailySpend: Math.round(currentAvgSpend),
        optimalDailySpend: rounded,
        changePercent: currentAvgSpend > 0 ? Math.round(((rounded - currentAvgSpend) / currentAvgSpend) * 100) : 0,
        confidence: orderFit.rSquared >= 0.5 ? 'HIGH' : orderFit.rSquared >= 0.2 ? 'MEDIUM' : 'LOW',
        reason: rounded > currentAvgSpend
          ? 'Tăng ngân sách để tối ưu chuyển đổi'
          : rounded < currentAvgSpend
          ? 'Giảm ngân sách do hiệu quả biên giảm'
          : 'Giữ nguyên ngân sách hiện tại',
      });
      totalOptimal += rounded;
    }

    // Include active groups with no recent data
    for (const group of activeGroups) {
      const gId = (group as any)._id.toString();
      if (!groupData.has(gId)) {
        const dailyBudget = (group as any).dailyBudget || 0;
        groupBreakdown.push({
          adGroupId: gId,
          adGroupName: (group as any).name,
          platform: (group as any).platform,
          currentDailySpend: 0,
          optimalDailySpend: dailyBudget,
          confidence: 'LOW',
          reason: 'Chưa có dữ liệu chi phí — dùng budget đã cài đặt',
        });
        totalOptimal += dailyBudget;
      }
    }

    return { totalOptimalDailyBudget: totalOptimal, groupBreakdown };
  }

  private fitLogCurveInternal(xValues: number[], yValues: number[]): { a: number; b: number; rSquared: number } {
    const n = xValues.length;
    if (n < 2) return { a: 0, b: 0, rSquared: 0 };

    const X = xValues.map(x => Math.log(x + 1));
    const Y = yValues;

    const sumX = X.reduce((s, v) => s + v, 0);
    const sumY = Y.reduce((s, v) => s + v, 0);
    const sumXY = X.reduce((s, v, i) => s + v * Y[i], 0);
    const sumXX = X.reduce((s, v) => s + v * v, 0);

    const denom = n * sumXX - sumX * sumX;
    if (Math.abs(denom) < 1e-10) return { a: 0, b: sumY / n, rSquared: 0 };

    const a = (n * sumXY - sumX * sumY) / denom;
    const b = (sumY - a * sumX) / n;

    const meanY = sumY / n;
    const ssTotal = Y.reduce((s, y) => s + (y - meanY) ** 2, 0);
    const ssResidual = Y.reduce((s, y, i) => s + (y - (a * X[i] + b)) ** 2, 0);
    const rSquared = ssTotal > 0 ? 1 - ssResidual / ssTotal : 0;

    return { a, b, rSquared: Math.max(0, rSquared) };
  }

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // AGING REPORT (Phase 1.4)
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

  async getAgingReport() {
    const now = new Date();

    // Get wallets with negative balance (debt)
    const walletsWithDebt = await this.walletModel
      .find({ balance: { $lt: 0 } })
      .populate('userId', 'fullName email phone')
      .lean();

    // Get unpaid invoices (PENDING_APPROVAL or APPROVED but not yet fully consumed)
    const unpaidInvoices = await this.invoiceModel
      .find({ status: { $in: ['PENDING_APPROVAL'] } })
      .populate('studentId', 'fullName parentName parentPhone parentUserId')
      .lean();

    // Build aging buckets
    const agingMap: Map<string, {
      parentName: string;
      parentPhone: string;
      students: string[];
      totalDebt: number;
      oldestDate: Date;
      items: any[];
    }> = new Map();

    // Process wallet debts
    for (const w of walletsWithDebt) {
      const user = (w as any).userId;
      if (!user) continue;
      const key = user._id.toString();
      if (!agingMap.has(key)) {
        agingMap.set(key, {
          parentName: user.fullName || '',
          parentPhone: user.phone || '',
          students: [],
          totalDebt: 0,
          oldestDate: new Date(),
          items: [],
        });
      }
      const entry = agingMap.get(key)!;
      entry.totalDebt += Math.abs(w.balance);
      const walletDebtDate = (w as any).updatedAt || now;
      if (walletDebtDate < entry.oldestDate) entry.oldestDate = walletDebtDate;
      entry.items.push({ type: 'WALLET_DEBT', amount: Math.abs(w.balance), date: walletDebtDate });
    }

    // Process unpaid invoices
    for (const inv of unpaidInvoices) {
      const student = (inv as any).studentId;
      if (!student) continue;
      const parentKey = student.parentUserId?.toString() || student.parentPhone || student._id.toString();
      if (!agingMap.has(parentKey)) {
        agingMap.set(parentKey, {
          parentName: student.parentName || '',
          parentPhone: student.parentPhone || '',
          students: [],
          totalDebt: 0,
          oldestDate: new Date(),
          items: [],
        });
      }
      const entry = agingMap.get(parentKey)!;
      entry.totalDebt += (inv as any).amount || 0;
      if (!entry.students.includes(student.fullName)) entry.students.push(student.fullName);
      const invDate = (inv as any).createdAt || now;
      if (invDate < entry.oldestDate) entry.oldestDate = invDate;
      entry.items.push({
        type: 'UNPAID_INVOICE',
        invoiceNumber: (inv as any).invoiceNumber,
        amount: (inv as any).amount,
        date: invDate,
        status: (inv as any).status,
      });
    }

    // Classify into aging buckets
    const getBucket = (date: Date): string => {
      const diffDays = Math.floor((now.getTime() - new Date(date).getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays <= 0) return 'current';
      if (diffDays <= 30) return '1-30';
      if (diffDays <= 60) return '31-60';
      if (diffDays <= 90) return '61-90';
      return '90+';
    };

    const results: any[] = [];
    const bucketSummary: Record<string, number> = { current: 0, '1-30': 0, '31-60': 0, '61-90': 0, '90+': 0 };

    for (const [, entry] of agingMap) {
      const bucket = getBucket(entry.oldestDate);
      bucketSummary[bucket] += entry.totalDebt;
      results.push({
        parentName: entry.parentName,
        parentPhone: entry.parentPhone,
        students: entry.students,
        totalDebt: entry.totalDebt,
        oldestDate: entry.oldestDate,
        bucket,
        items: entry.items,
      });
    }

    // Sort by totalDebt descending
    results.sort((a, b) => b.totalDebt - a.totalDebt);

    const totalAR = Object.values(bucketSummary).reduce((s, v) => s + v, 0);

    return {
      summary: { totalAR, ...bucketSummary },
      details: results,
    };
  }

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // BANK RECONCILIATION (Phase 2.7)
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

  async getReconciliation(bankAccountId: string, fromDate: string, toDate: string) {
    if (!bankAccountId) {
      throw new BadRequestException('bankAccountId is required');
    }
    if (!Types.ObjectId.isValid(bankAccountId)) {
      throw new BadRequestException('Invalid bankAccountId');
    }
    if (!fromDate || !toDate) {
      throw new BadRequestException('fromDate and toDate are required');
    }

    const from = new Date(fromDate);
    const to = new Date(toDate);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      throw new BadRequestException('Invalid fromDate/toDate');
    }
    if (from.getTime() > to.getTime()) {
      throw new BadRequestException('fromDate must be less than or equal to toDate');
    }
    to.setHours(23, 59, 59, 999);

    const dateFilter = {
      $gte: from,
      $lte: to,
    };

    // Only reconcile inflow bank rows against wallet top-up ledger rows.
    const bankTxns = await this.bankTransactionModel.find({
      bankAccountId: new Types.ObjectId(bankAccountId),
      type: { $in: ['DEPOSIT', 'TRANSFER_IN'] },
      transactionDate: dateFilter,
    }).sort({ transactionDate: 1 }).lean();

    const ledgerFrom = new Date(from);
    ledgerFrom.setDate(ledgerFrom.getDate() - 2);
    const ledgerTo = new Date(to);
    ledgerTo.setDate(ledgerTo.getDate() + 2);
    const ledgerDateFilter = {
      $gte: ledgerFrom,
      $lte: ledgerTo,
    };

    // Use bank-transfer top-ups only and support both approvedAt/createdAt for legacy data.
    const ledgerEntries = await this.ledgerModel.find({
      type: 'TOP_UP',
      status: 'APPROVED',
      paymentMethod: 'BANK_TRANSFER',
      $or: [
        { approvedAt: ledgerDateFilter },
        { createdAt: ledgerDateFilter },
      ],
    }).lean();

    const normalizedBankAccountId = bankAccountId.trim();

    const normalizeRef = (value: unknown): string =>
      typeof value === 'string' ? value.trim().toUpperCase() : '';

    const isUsableRef = (value: string): boolean =>
      value.length >= 4 && value !== 'CONFIRMED';

    const extractLedgerRefs = (ledger: any): string[] => {
      const refs = new Set<string>();
      const directRef = normalizeRef(ledger?.transactionRef);
      if (isUsableRef(directRef)) {
        refs.add(directRef);
      }

      const notes = typeof ledger?.accountingNotes === 'string' ? ledger.accountingNotes : '';
      const refRegex = /BANK_MATCHED_REF:\s*([^|]+)/gi;
      let match: RegExpExecArray | null;
      while ((match = refRegex.exec(notes)) !== null) {
        const noteRef = normalizeRef(match[1]);
        if (isUsableRef(noteRef)) {
          refs.add(noteRef);
        }
      }

      return Array.from(refs);
    };

    const extractLedgerBankAccountIds = (ledger: any): string[] => {
      const ids = new Set<string>();
      const notes = typeof ledger?.accountingNotes === 'string' ? ledger.accountingNotes : '';
      const accountIdRegex = /BANK_MATCHED_BANK_ACCOUNT_ID:\s*([^|]+)/gi;
      let match: RegExpExecArray | null;
      while ((match = accountIdRegex.exec(notes)) !== null) {
        const id = (match[1] || '').trim();
        if (Types.ObjectId.isValid(id)) {
          ids.add(id);
        }
      }
      return Array.from(ids);
    };

    // Exclude entries explicitly tagged to another bank account from this reconciliation run.
    const scopedLedgerEntries = ledgerEntries.filter((ledger: any) => {
      const taggedIds = extractLedgerBankAccountIds(ledger);
      return taggedIds.length === 0 || taggedIds.includes(normalizedBankAccountId);
    });

    const hasReferenceMatch = (bank: any, ledger: any): boolean => {
      const bankText = [bank?.reference, bank?.description]
        .map(v => normalizeRef(v))
        .filter(Boolean)
        .join(' ');
      if (!bankText) return false;

      const ledgerRefs = extractLedgerRefs(ledger);
      if (ledgerRefs.length === 0) return false;
      return ledgerRefs.some(ref => bankText.includes(ref));
    };

    const toTimestamp = (value: unknown): number | null => {
      if (!value) return null;
      const ts = new Date(value as any).getTime();
      return Number.isNaN(ts) ? null : ts;
    };

    const matched: { bank: any; ledger: any }[] = [];
    const usedBankIds = new Set<string>();
    const usedLedgerIds = new Set<string>();

    const findBestLedgerMatch = (bank: any, requireReferenceMatch: boolean): any | null => {
      const bankDate = toTimestamp(bank?.transactionDate);
      if (bankDate == null) return null;
      const bankAmount = Number(bank?.amount || 0);

      let best: any | null = null;
      let bestDayDiff = Number.POSITIVE_INFINITY;
      let bestAmountDiff = Number.POSITIVE_INFINITY;

      for (const ledger of scopedLedgerEntries) {
        const ledgerId = (ledger as any)?._id?.toString?.();
        if (!ledgerId || usedLedgerIds.has(ledgerId)) continue;

        const ledgerBankAccountIds = extractLedgerBankAccountIds(ledger);
        // If ledger already tagged to a specific bank account, only match that account.
        if (ledgerBankAccountIds.length > 0 && !ledgerBankAccountIds.includes(normalizedBankAccountId)) {
          continue;
        }

        const ledgerDate = toTimestamp((ledger as any).approvedAt || (ledger as any).createdAt);
        if (ledgerDate == null) continue;

        const ledgerAmount = Number((ledger as any).amount || 0);
        const amountDiff = Math.abs(bankAmount - ledgerAmount);
        if (amountDiff >= 1) continue;

        const dayDiff = Math.abs(bankDate - ledgerDate) / (1000 * 60 * 60 * 24);
        const allowedDayDiff = requireReferenceMatch ? 2 : 1;
        if (dayDiff > allowedDayDiff) continue;

        const ledgerRefs = extractLedgerRefs(ledger);
        if (requireReferenceMatch && !hasReferenceMatch(bank, ledger)) {
          continue;
        }
        // Prevent fallback pass from stealing entries that already carry explicit bank refs.
        if (!requireReferenceMatch && ledgerRefs.length > 0) {
          continue;
        }

        if (
          best == null ||
          dayDiff < bestDayDiff ||
          (dayDiff === bestDayDiff && amountDiff < bestAmountDiff)
        ) {
          best = ledger;
          bestDayDiff = dayDiff;
          bestAmountDiff = amountDiff;
        }
      }

      return best;
    };

    // Pass 1: reference-based matches first.
    for (const bank of bankTxns) {
      const bankId = (bank as any)?._id?.toString?.();
      if (!bankId || usedBankIds.has(bankId)) continue;

      const bestRefMatch = findBestLedgerMatch(bank, true);
      if (!bestRefMatch) continue;

      const ledgerId = (bestRefMatch as any)._id.toString();
      matched.push({ bank, ledger: bestRefMatch });
      usedBankIds.add(bankId);
      usedLedgerIds.add(ledgerId);
    }

    // Pass 2: fallback to amount + nearest date.
    for (const bank of bankTxns) {
      const bankId = (bank as any)?._id?.toString?.();
      if (!bankId || usedBankIds.has(bankId)) continue;

      const bestFallbackMatch = findBestLedgerMatch(bank, false);
      if (!bestFallbackMatch) continue;

      const ledgerId = (bestFallbackMatch as any)._id.toString();
      matched.push({ bank, ledger: bestFallbackMatch });
      usedBankIds.add(bankId);
      usedLedgerIds.add(ledgerId);
    }

    const unmatchedBank = bankTxns.filter((b: any) => !usedBankIds.has(b._id.toString()));
    const unmatchedLedger = scopedLedgerEntries.filter((l: any) => !usedLedgerIds.has(l._id.toString()));

    const matchedAmount = matched.reduce((s, m) => s + ((m.bank as any).amount || 0), 0);
    const unmatchedBankAmount = unmatchedBank.reduce((s, b: any) => s + (b.amount || 0), 0);
    const unmatchedLedgerAmount = unmatchedLedger.reduce((s, l: any) => s + (l.amount || 0), 0);

    return {
      matched: matched.map((m) => ({
        bankTxn: m.bank,
        ledgerEntry: m.ledger,
      })),
      unmatchedBank,
      // Keep both keys for compatibility with different frontend consumers.
      unmatchedLedger,
      unmatchedSystem: unmatchedLedger,
      summary: {
        matchedCount: matched.length,
        matchedAmount,
        unmatchedBankCount: unmatchedBank.length,
        unmatchedBankAmount,
        unmatchedLedgerCount: unmatchedLedger.length,
        unmatchedLedgerAmount,
        unmatchedSystemCount: unmatchedLedger.length,
        unmatchedSystemAmount: unmatchedLedgerAmount,
        variance: unmatchedBankAmount - unmatchedLedgerAmount,
      },
    };
  }

  // BALANCE SHEET (Phase 3.7)
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

  async getBalanceSheet() {
    // Assets
    const bankAccounts = await this.bankAccountModel.find({ status: 'ACTIVE' }).lean();
    const totalBankBalance = bankAccounts.reduce((s, a: any) => s + (a.currentBalance || 0), 0);

    const wallets = await this.walletModel.find({ status: 'ACTIVE' }).lean();
    const totalWalletLiability = wallets.reduce((s, w: any) => s + Math.max(w.balance || 0, 0), 0);
    const totalWalletReceivable = wallets.reduce((s, w: any) => s + Math.abs(Math.min(w.balance || 0, 0)), 0);

    const funds = await this.fundModel.find({ status: 'ACTIVE' }).lean();
    const totalFundBalance = funds.reduce((s, f: any) => s + (f.currentBalance || 0), 0);

    // Wallet positive balances are deferred revenue liability, not asset.
    const totalAssets = totalBankBalance + totalFundBalance + totalWalletReceivable;

    // Liabilities
    const loansOutstanding = await this.loanAggregate.getDebtSummary(['ACTIVE']);
    const totalLoans = loansOutstanding.totalDebt || 0;

    const [pendingPayroll, pendingExpenses] = await Promise.all([
      this.payrollAggregate.getPendingLiabilities(),
      this.expenseAggregate.getPendingLiabilities(),
    ]);
    const totalPendingPayroll = pendingPayroll.total || 0;
    const totalPendingExpenses = pendingExpenses.total || 0;

    const totalLiabilities = totalLoans + totalPendingPayroll + totalPendingExpenses + totalWalletLiability;

    const equity = totalAssets - totalLiabilities;

    return {
      assets: {
        bankAccounts: bankAccounts.map((a: any) => ({
          name: a.bankName,
          accountNumber: a.accountNumber,
          balance: a.currentBalance,
        })),
        totalBankBalance,
        totalWalletReceivable,
        totalFundBalance,
        totalAssets,
      },
      liabilities: {
        totalWalletLiability,
        totalLoans,
        loansCount: loansOutstanding.count || 0,
        totalPendingPayroll,
        payrollCount: pendingPayroll.count || 0,
        totalPendingExpenses,
        expensesCount: pendingExpenses.count || 0,
        totalLiabilities,
      },
      equity,
      date: new Date().toISOString(),
    };
  }

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // TAX EXPORT (Phase 3.8)
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

  async getTaxReport(year: number) {
    const months: any[] = [];

    for (let m = 0; m < 12; m++) {
      const start = new Date(year, m, 1);
      const end = new Date(year, m + 1, 0, 23, 59, 59);
      const monthLabel = `${String(m + 1).padStart(2, '0')}/${year}`;

      // Revenue
      const invoices = await this.invoiceModel.find({
        status: 'APPROVED',
        paymentDate: { $gte: start, $lte: end },
      }).lean();
      const revenue = invoices.reduce((s, i: any) => s + (i.amount || 0), 0);

      // Expenses by category
      const expenseRows = await this.expenseAggregate.getPaidCategorySummary({
        $gte: start,
        $lte: end,
      });
      const totalExpenses = expenseRows.reduce((s, e: any) => s + (e.totalAmount || 0), 0);
      const expenseByCategory: Record<string, number> = {};
      for (const row of expenseRows) {
        const cat = (row as any)._id || 'OTHER';
        expenseByCategory[cat] = (expenseByCategory[cat] || 0) + ((row as any).totalAmount || 0);
      }

      // Payroll
      const payrollSummary = await this.payrollAggregate.getPaidSummary({
        $gte: start,
        $lte: end,
      });
      const totalPayroll = payrollSummary.total || 0;

      months.push({
        month: monthLabel,
        revenue,
        totalExpenses,
        expenseByCategory,
        totalPayroll,
        profit: revenue - totalExpenses - totalPayroll,
      });
    }

    const yearSummary = {
      totalRevenue: months.reduce((s, m) => s + m.revenue, 0),
      totalExpenses: months.reduce((s, m) => s + m.totalExpenses, 0),
      totalPayroll: months.reduce((s, m) => s + m.totalPayroll, 0),
      totalProfit: months.reduce((s, m) => s + m.profit, 0),
    };

    return { year, months, summary: yearSummary };
  }
}


