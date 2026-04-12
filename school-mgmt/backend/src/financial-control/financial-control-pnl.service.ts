import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { BankAccount, BankAccountDocument } from './schemas/bank-account.schema';
import { Fund, FundDocument } from './schemas/fund.schema';
import { Session, SessionDocument } from '../sessions/schemas/session.schema';
import { Invoice, InvoiceDocument } from '../invoices/schemas/invoice.schema';
import { Wallet, WalletDocument } from '../wallets/schemas/wallet.schema';
import { AdCost, AdCostDocument } from '../ads/schemas/ad-cost.schema';
import { PayrollFinancialAggregateService } from './aggregates/payroll-financial.aggregate';
import { ExpenseFinancialAggregateService } from './aggregates/expense-financial.aggregate';
import { LoanFinancialAggregateService } from './aggregates/loan-financial.aggregate';
import { resolveFinancialBasis } from './financial-control.utils';

@Injectable()
export class FinancialControlPnlService {
  constructor(
    @InjectModel(BankAccount.name) private bankAccountModel: Model<BankAccountDocument>,
    @InjectModel(Fund.name) private fundModel: Model<FundDocument>,
    @InjectModel(Session.name) private sessionModel: Model<SessionDocument>,
    @InjectModel(Invoice.name) private invoiceModel: Model<InvoiceDocument>,
    @InjectModel(Wallet.name) private walletModel: Model<WalletDocument>,
    @InjectModel(AdCost.name) private adCostModel: Model<AdCostDocument>,
    private readonly payrollAggregate: PayrollFinancialAggregateService,
    private readonly expenseAggregate: ExpenseFinancialAggregateService,
    private readonly loanAggregate: LoanFinancialAggregateService,
  ) {}

  async getProfitAndLoss(startDate?: string, endDate?: string, basis?: string): Promise<any> {
    const selectedBasis = resolveFinancialBasis(basis);
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

      this.adCostModel.aggregate([
        { $match: {
          source: { $ne: 'ESTIMATED' },
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

    const adCostByPlatform: Record<string, { amount: number; count: number }> = {};
    let totalAdCost = 0;
    adCostData.forEach((a: any) => {
      adCostByPlatform[a._id] = { amount: a.totalSpend, count: a.count };
      totalAdCost += a.totalSpend;
    });

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

  async getBalanceSheet() {
    const bankAccounts = await this.bankAccountModel.find({ status: 'ACTIVE' }).lean();
    const totalBankBalance = bankAccounts.reduce((s, a: any) => s + (a.currentBalance || 0), 0);

    const wallets = await this.walletModel.find({ status: 'ACTIVE' }).lean();
    const totalWalletLiability = wallets.reduce((s, w: any) => s + Math.max(w.balance || 0, 0), 0);
    const totalWalletReceivable = wallets.reduce((s, w: any) => s + Math.abs(Math.min(w.balance || 0, 0)), 0);

    const funds = await this.fundModel.find({ status: 'ACTIVE' }).lean();
    const totalFundBalance = funds.reduce((s, f: any) => s + (f.currentBalance || 0), 0);

    const totalAssets = totalBankBalance + totalFundBalance + totalWalletReceivable;

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

  async getTaxReport(year: number) {
    const months: any[] = [];

    for (let m = 0; m < 12; m++) {
      const start = new Date(year, m, 1);
      const end = new Date(year, m + 1, 0, 23, 59, 59);
      const monthLabel = `${String(m + 1).padStart(2, '0')}/${year}`;

      const invoices = await this.invoiceModel.find({
        status: 'APPROVED',
        paymentDate: { $gte: start, $lte: end },
      }).lean();
      const revenue = invoices.reduce((s, i: any) => s + (i.amount || 0), 0);

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
