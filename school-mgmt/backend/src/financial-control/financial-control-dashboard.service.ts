import { Injectable, Optional } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { BankTransaction, BankTransactionDocument } from './schemas/bank-transaction.schema';
import { Fund, FundDocument } from './schemas/fund.schema';
import { Session, SessionDocument } from '../sessions/schemas/session.schema';
import { Invoice, InvoiceDocument } from '../invoices/schemas/invoice.schema';
import { Wallet, WalletDocument } from '../wallets/schemas/wallet.schema';
import { Order, OrderDocument } from '../orders/schemas/order.schema';
import { Student, StudentDocument } from '../students/schemas/student.schema';
import { PayrollFinancialAggregateService } from './aggregates/payroll-financial.aggregate';
import { ExpenseFinancialAggregateService } from './aggregates/expense-financial.aggregate';
import { LoanFinancialAggregateService } from './aggregates/loan-financial.aggregate';
import { FinancialControlBankFundService } from './financial-control-bank-fund.service';
import { FinancialControlCashflowService } from './financial-control-cashflow.service';
import { FinancialControlPnlService } from './financial-control-pnl.service';
import { FinancialControlAgingService } from './financial-control-aging.service';
import { AdsAnalyticsService } from '../ads/ads-analytics.service';
import { DashboardService } from '../dashboard/dashboard.service';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { toDateOnly, roundMetric, roundOptionalMetric, normalizeTrendMonthCount } from './financial-control.utils';

@Injectable()
export class FinancialControlDashboardService {
  constructor(
    @InjectModel(BankTransaction.name) private bankTransactionModel: Model<BankTransactionDocument>,
    @InjectModel(Fund.name) private fundModel: Model<FundDocument>,
    @InjectModel(Session.name) private sessionModel: Model<SessionDocument>,
    @InjectModel(Invoice.name) private invoiceModel: Model<InvoiceDocument>,
    @InjectModel(Wallet.name) private walletModel: Model<WalletDocument>,
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    @InjectModel(Student.name) private studentModel: Model<StudentDocument>,
    private readonly payrollAggregate: PayrollFinancialAggregateService,
    private readonly expenseAggregate: ExpenseFinancialAggregateService,
    private readonly loanAggregate: LoanFinancialAggregateService,
    private readonly bankFundService: FinancialControlBankFundService,
    private readonly cashflowService: FinancialControlCashflowService,
    private readonly pnlService: FinancialControlPnlService,
    private readonly agingService: FinancialControlAgingService,
    @Optional() private readonly adsAnalyticsService?: AdsAnalyticsService,
    @Optional() private readonly dashboardService?: DashboardService,
  ) {}

  async getFinancialDashboard(): Promise<any> {
    const now = new Date();
    const in14Days = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

    const sixMonthsAgo = new Date(now);
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

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
      this.bankFundService.getBankAccountSummary(),
      this.bankFundService.getFundsSummary(),

      this.fundModel.aggregate([
        { $match: { fundType: 'MARKETING', status: 'ACTIVE' } },
        { $group: { _id: null, total: { $sum: '$currentBalance' }, count: { $sum: 1 } } },
      ]),

      this.cashflowService.getWalletTotals(),

      this.payrollAggregate.getApprovedPayables(),
      this.expenseAggregate.getApprovedPayables(),

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

      this.cashflowService.getBurnRateOutflows(sixMonthsAgo),

      this.invoiceModel.aggregate([
        { $match: { status: 'PENDING_APPROVAL' } },
        { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]),

      this.sessionModel.aggregate([
        { $match: { status: 'FINALIZED', scheduledDate: { $gte: thisMonthStart } } },
        { $group: { _id: null, total: { $sum: '$amountCharged' } } },
      ]),

      this.sessionModel.aggregate([
        { $match: { status: 'FINALIZED', scheduledDate: { $gte: lastMonthStart, $lte: lastMonthEnd } } },
        { $group: { _id: null, total: { $sum: '$amountCharged' } } },
      ]),

      this.pnlService.getProfitAndLoss(),

      this.loanAggregate.getDebtSummary(['ACTIVE']),
      this.loanAggregate.getUpcomingOutstandingSummary(in14Days),
      this.loanAggregate.getUpcomingOutstandingSummary(in30Days),
    ]);

    const bankBalance = bankSummary.totalBalance || 0;
    const fundBalance = fundsSummary.totalBalance || 0;
    const marketingFundBalance = marketingFunds[0]?.total || 0;
    const availableCash = bankBalance + fundBalance;

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

    const totalOutflow6m =
      avgMonthlyOutflows.payrollTotal6m +
      avgMonthlyOutflows.expenseTotal6m +
      avgMonthlyOutflows.adCostTotal6m;
    const burnRate = Math.round(totalOutflow6m / 6);
    const operatingReserve3Months = burnRate * 3;
    const runway = burnRate > 0 ? Math.round((availableCash / burnRate) * 10) / 10 : 999;

    const walletBalance = walletTotals.totalLiability ?? Math.max(walletTotals.totalBalance || 0, 0);
    const pendingInvoiceAmount = pendingInvoices[0]?.total || 0;
    const pendingInvoiceCount = pendingInvoices[0]?.count || 0;

    const thisMonthRev = thisMonthRevenue[0]?.total || 0;
    const lastMonthRev = lastMonthRevenue[0]?.total || 0;
    const revenueGrowth = lastMonthRev > 0
      ? Math.round(((thisMonthRev - lastMonthRev) / lastMonthRev) * 10000) / 100
      : 0;

    const currentAssets = availableCash + pendingInvoiceAmount;
    const currentLiabilities = totalPayable14Days + walletBalance;
    const currentRatio = currentLiabilities > 0
      ? Math.round((currentAssets / currentLiabilities) * 100) / 100
      : 999;

    return {
      cashPosition: {
        bankBalance,
        bankAccountCount: bankSummary.accountCount || 0,
        fundBalance,
        fundCount: fundsSummary.fundCount || 0,
        marketingFund: marketingFundBalance,
        marketingFundCount: marketingFunds[0]?.count || 0,
        availableCash,
      },
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
      deferredRevenue: {
        walletBalance,
        walletCount: walletTotals.count || 0,
        pendingInvoiceAmount,
        pendingInvoiceCount,
      },
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
      debtPosition: {
        totalDebt,
        activeLoanCount,
        loanPayable,
        loanPayableCount,
      },
      fundWarnings: fundsSummary.warnings || [],
    };
  }

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
      this.bankFundService.getBankAccountSummary(),
      this.bankFundService.getFundsSummary(),
      this.bankTransactionModel.countDocuments(unreconciledFilter),
      this.cashflowService.getWalletTotals(),
      this.pnlService.getProfitAndLoss(startDate, endDate),
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

  async getFinancialOverview(startDate?: string, endDate?: string): Promise<any> {
    const [bankSummary, fundsSummary, cashFlow, pnl] = await Promise.all([
      this.bankFundService.getBankAccountSummary(),
      this.bankFundService.getFundsSummary(),
      this.cashflowService.getCashFlow({ startDate, endDate, groupBy: 'month' }),
      this.pnlService.getProfitAndLoss(startDate, endDate),
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

  async getInvestorMetrics(monthCountInput?: number | string): Promise<any> {
    const now = new Date();
    const monthCount = normalizeTrendMonthCount(monthCountInput);
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const previousMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    const yearStart = new Date(now.getFullYear(), 0, 1);
    const unitEconomicsStart = new Date(now);
    unitEconomicsStart.setDate(unitEconomicsStart.getDate() - 90);

    const [
      financialDashboard,
      currentProfitAndLoss,
      previousProfitAndLoss,
      ytdProfitAndLoss,
      retentionMetrics,
      agingReport,
      loanSummary,
      unearnedRevenue,
      ltv,
      trend,
      activeStudentsThisMonth,
      enrolledStudents,
      adsAnalytics,
    ] = await Promise.all([
      this.getFinancialDashboard(),
      this.pnlService.getProfitAndLoss(toDateOnly(currentMonthStart), toDateOnly(now), 'cash'),
      this.pnlService.getProfitAndLoss(toDateOnly(previousMonthStart), toDateOnly(previousMonthEnd), 'cash'),
      this.pnlService.getProfitAndLoss(toDateOnly(yearStart), toDateOnly(now), 'cash'),
      this.getRetentionMetricsSnapshot(),
      this.agingService.getAgingReport(),
      this.loanAggregate.getDebtSummary(['ACTIVE']),
      this.getUnearnedRevenueBreakdown(),
      this.calculateLifetimeValue(),
      this.getInvestorTrend(monthCount),
      this.getActiveStudentCount(currentMonthStart, now),
      this.getEnrolledStudentCount(now),
      this.getAdsAnalyticsSummary(unitEconomicsStart, now),
    ]);

    const currentRevenue = Number(currentProfitAndLoss?.revenue?.total || 0);
    const previousRevenue = Number(previousProfitAndLoss?.revenue?.total || 0);
    const grossProfit = Number(currentProfitAndLoss?.summary?.grossProfit || 0);
    const grossMargin = Number(currentProfitAndLoss?.summary?.grossMargin || 0);
    const netProfit = Number(currentProfitAndLoss?.summary?.netProfit || 0);
    const netMargin = Number(currentProfitAndLoss?.summary?.netMargin || 0);
    const interestExpense = Number(currentProfitAndLoss?.costs?.interestExpense || 0);
    const agingSummary = agingReport?.summary as Record<string, number> | undefined;
    const ebitda = netProfit + interestExpense;
    const ebitdaMargin = currentRevenue > 0 ? (ebitda / currentRevenue) * 100 : 0;
    const costPerLead = Number(adsAnalytics?.totalLeads || 0) > 0
      ? Number(adsAnalytics?.avgCostPerLead || 0)
      : null;
    const costPerOrder = Number(adsAnalytics?.totalOrders || 0) > 0
      ? Number(adsAnalytics?.avgCostPerOrder || 0)
      : null;
    const cac = costPerOrder;
    const arpu = enrolledStudents > 0 ? currentRevenue / enrolledStudents : null;
    const arpuActive = activeStudentsThisMonth > 0 ? currentRevenue / activeStudentsThisMonth : null;
    const revenueGrowthPercent = previousRevenue > 0
      ? ((currentRevenue - previousRevenue) / previousRevenue) * 100
      : (currentRevenue > 0 ? 100 : 0);

    return {
      snapshot: {
        cashOnHand: roundMetric(Number(financialDashboard?.cashPosition?.availableCash || 0)),
        totalFundBalance: roundMetric(Number(financialDashboard?.cashPosition?.fundBalance || 0)),
        burnRate: roundMetric(Number(financialDashboard?.metrics?.burnRate || 0)),
        runway: roundMetric(Number(financialDashboard?.metrics?.runway || 0), 1),
      },
      revenue: {
        recognizedRevenue: {
          thisMonth: roundMetric(currentRevenue),
          lastMonth: roundMetric(previousRevenue),
          ytd: roundMetric(Number(ytdProfitAndLoss?.revenue?.total || 0)),
          growthPercent: roundMetric(revenueGrowthPercent, 2),
        },
        unearnedRevenue,
      },
      profitability: {
        grossProfit: roundMetric(grossProfit),
        grossMargin: roundMetric(grossMargin, 2),
        netProfit: roundMetric(netProfit),
        netMargin: roundMetric(netMargin, 2),
        ebitda: roundMetric(ebitda),
        ebitdaMargin: roundMetric(ebitdaMargin, 2),
      },
      unitEconomics: {
        cac: roundOptionalMetric(cac),
        costPerLead: roundOptionalMetric(costPerLead),
        costPerOrder: roundOptionalMetric(costPerOrder),
        ltv: roundMetric(ltv),
        ltvCacRatio: roundOptionalMetric(cac && cac > 0 ? ltv / cac : null, 2),
        arpu: roundOptionalMetric(arpu),
        arpuActive: roundOptionalMetric(arpuActive),
        activeStudents: Number(activeStudentsThisMonth || 0),
        enrolledStudents: Number(enrolledStudents || 0),
      },
      customerBase: {
        activeStudents: Number(activeStudentsThisMonth || 0),
        enrolledStudents: Number(enrolledStudents || 0),
      },
      methodology: {
        cac: {
          formula: 'Ad spend / approved orders',
          note: 'CAC chi dung cost per order. Khong fallback sang cost per lead khi thieu order.',
        },
        ltv: {
          formula: 'Average approved or completed order revenue per student',
          note: 'LTV hien la trung binh lich su toan bo hoc sinh, chua tinh theo cohort.',
        },
        arpu: {
          formula: 'Current month recognized revenue / approved enrolled students',
          activeFormula: 'Current month recognized revenue / active students in trend window',
          note: 'ARPU mac dinh dung enrolled students; arpuActive duoc tra rieng de doi chieu.',
        },
      },
      retention: {
        retentionRate: roundMetric(Number(retentionMetrics?.retentionRate || 0), 2),
        churnRate: roundMetric(Number(retentionMetrics?.churnRate || 0), 2),
        atRiskCount: Number(retentionMetrics?.atRiskCount || 0),
      },
      liabilities: {
        accountsReceivable: roundMetric(Number(financialDashboard?.metrics?.accountsReceivable || 0)),
        payrollPayable: roundMetric(Number(financialDashboard?.obligations?.payrollPayable || 0)),
        expensePayable: roundMetric(Number(financialDashboard?.obligations?.expensePayable || 0)),
        loanSummary,
        arAgingBuckets: {
          current: roundMetric(Number(agingSummary?.current || 0)),
          '1-30': roundMetric(Number(agingSummary?.['1-30'] || 0)),
          '31-60': roundMetric(Number(agingSummary?.['31-60'] || 0)),
          '61-90': roundMetric(Number(agingSummary?.['61-90'] || 0)),
          '90+': roundMetric(Number(agingSummary?.['90+'] || 0)),
        },
      },
      trend: {
        ...trend,
        monthCount,
      },
    };
  }

  private async getRetentionMetricsSnapshot(): Promise<any> {
    if (this.dashboardService) {
      return this.dashboardService.getRetentionMetrics();
    }

    return {
      retentionRate: 0,
      churnRate: 0,
      atRiskCount: 0,
    };
  }

  private async getAdsAnalyticsSummary(startDate: Date, endDate: Date): Promise<any> {
    if (!this.adsAnalyticsService) {
      return null;
    }

    const analytics = await this.adsAnalyticsService.getAnalytics(
      toDateOnly(startDate),
      toDateOnly(endDate),
    );

    return analytics?.summary ?? null;
  }

  private async getUnearnedRevenueBreakdown(): Promise<{
    walletBalance: number;
    unconsumedInvoiceValue: number;
    total: number;
  }> {
    const [walletSummary, invoiceSummary] = await Promise.all([
      this.walletModel.aggregate([
        {
          $match: {
            status: 'ACTIVE',
            balance: { $gt: 0 },
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$balance' },
          },
        },
      ]),
      this.invoiceModel.aggregate([
        {
          $match: {
            status: { $in: ['APPROVED', 'PAID'] },
            sessionsRemaining: { $gt: 0 },
            pricePerSession: { $gt: 0 },
          },
        },
        {
          $group: {
            _id: null,
            total: {
              $sum: {
                $multiply: ['$sessionsRemaining', '$pricePerSession'],
              },
            },
          },
        },
      ]),
    ]);

    const walletBal = Number(walletSummary[0]?.total || 0);
    const unconsumedInvoiceValue = Number(invoiceSummary[0]?.total || 0);

    return {
      walletBalance: roundMetric(walletBal),
      unconsumedInvoiceValue: roundMetric(unconsumedInvoiceValue),
      total: roundMetric(walletBal + unconsumedInvoiceValue),
    };
  }

  private async calculateLifetimeValue(): Promise<number> {
    const rows = await this.orderModel.aggregate([
      {
        $match: {
          status: { $in: ['APPROVED', 'COMPLETED'] },
          orderType: { $in: ['NEW_ENROLLMENT', 'RENEWAL', 'ADDITIONAL'] },
        },
      },
      {
        $addFields: {
          effectiveStudentId: {
            $ifNull: ['$processedResults.studentId', '$existingStudentId'],
          },
        },
      },
      {
        $match: {
          effectiveStudentId: { $ne: null },
        },
      },
      {
        $group: {
          _id: '$effectiveStudentId',
          totalRevenue: { $sum: '$finalAmount' },
        },
      },
      {
        $group: {
          _id: null,
          averageRevenue: { $avg: '$totalRevenue' },
        },
      },
    ]);

    return roundMetric(Number(rows[0]?.averageRevenue || 0));
  }

  private async getInvestorTrend(monthCount = 6): Promise<{
    months: string[];
    revenue: number[];
    netProfit: number[];
    studentCount: number[];
  }> {
    const now = new Date();
    const periods = Array.from({ length: monthCount }, (_, index) => {
      const offset = monthCount - index - 1;
      const start = new Date(now.getFullYear(), now.getMonth() - offset, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - offset + 1, 0, 23, 59, 59, 999);
      return {
        label: `${String(start.getMonth() + 1).padStart(2, '0')}/${start.getFullYear()}`,
        start,
        end,
      };
    });

    const rows = await Promise.all(periods.map(async (period) => {
      const [profitAndLoss, studentCount] = await Promise.all([
        this.pnlService.getProfitAndLoss(toDateOnly(period.start), toDateOnly(period.end), 'cash'),
        this.getActiveStudentCount(period.start, period.end),
      ]);

      return {
        label: period.label,
        revenue: roundMetric(Number(profitAndLoss?.revenue?.total || 0)),
        netProfit: roundMetric(Number(profitAndLoss?.summary?.netProfit || 0)),
        studentCount,
      };
    }));

    return {
      months: rows.map((row) => row.label),
      revenue: rows.map((row) => row.revenue),
      netProfit: rows.map((row) => row.netProfit),
      studentCount: rows.map((row) => row.studentCount),
    };
  }

  private async getActiveStudentCount(startDate: Date, endDate: Date): Promise<number> {
    const studentIds = await this.sessionModel.distinct('studentId', {
      scheduledDate: { $gte: startDate, $lte: endDate },
      status: { $nin: ['CANCELLED'] },
    });

    return studentIds.filter(Boolean).length;
  }

  private async getEnrolledStudentCount(asOf?: Date): Promise<number> {
    const filter: Record<string, any> = {
      approvalStatus: 'APPROVED',
    };

    if (asOf) {
      filter.createdAt = { $lte: asOf };
    }

    return this.studentModel.countDocuments(filter);
  }
}
