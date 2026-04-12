import { Injectable, Optional } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { BankTransaction, BankTransactionDocument } from './schemas/bank-transaction.schema';
import { Expense, ExpenseDocument } from '../expenses/schemas/expense.schema';
import { Order, OrderDocument } from '../orders/schemas/order.schema';
import { AdCost, AdCostDocument } from '../ads/schemas/ad-cost.schema';
import { AdGroup, AdGroupDocument } from '../ads/schemas/ad-group.schema';
import { LoanFinancialAggregateService } from './aggregates/loan-financial.aggregate';
import { FinancialControlBankFundService } from './financial-control-bank-fund.service';
import { FinancialControlCashflowService } from './financial-control-cashflow.service';
import { FinancialControlPnlService } from './financial-control-pnl.service';
import { FinancialControlDashboardService } from './financial-control-dashboard.service';
import { AdsAnalyticsService } from '../ads/ads-analytics.service';
import { fitLogCurve } from './financial-control.utils';

@Injectable()
export class FinancialControlAlertsService {
  constructor(
    @InjectModel(BankTransaction.name) private bankTransactionModel: Model<BankTransactionDocument>,
    @InjectModel(Expense.name) private expenseModel: Model<ExpenseDocument>,
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    @InjectModel(AdCost.name) private adCostModel: Model<AdCostDocument>,
    @InjectModel(AdGroup.name) private adGroupModel: Model<AdGroupDocument>,
    private readonly loanAggregate: LoanFinancialAggregateService,
    private readonly bankFundService: FinancialControlBankFundService,
    private readonly cashflowService: FinancialControlCashflowService,
    private readonly pnlService: FinancialControlPnlService,
    private readonly dashboardService: FinancialControlDashboardService,
    @Optional() private readonly adsAnalyticsService?: AdsAnalyticsService,
  ) {}

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
      this.dashboardService.getFinancialDashboard(),
      this.bankFundService.getFundsSummary(),
      this.pnlService.getProfitAndLoss(),
      this.calculateOptimalMarketingBudget(),
      this.bankTransactionModel.countDocuments({ isReconciled: false }),
      this.cashflowService.getCashFlow({ groupBy: 'month' }),
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

    // 1. Marketing fund vs optimal ads budget
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

    // 2. Runway warning
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

    // 3. Operating reserve
    if (!dashboard.obligations.reserveHealthy) {
      const { operatingReserve3Months } = dashboard.obligations;
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

    // 4. Fund below minimum
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

    // 5. 14-day obligations
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

    // 6. Current Ratio
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

    // 7. Negative net profit
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

    // 8. Unreconciled transactions
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

    // 9. Pending expenses
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

    // 10. Overdue order payments
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

    // 11. Negative cash flow trend
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

    // 12. Overdue loan payments
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

    // 13. High debt ratio
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

    // 14. Loans near maturity
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

    // 15. Revenue declining
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
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const activeGroups = await this.adGroupModel.find({ status: 'ACTIVE' }).lean();

    if (activeGroups.length === 0) {
      return { totalOptimalDailyBudget: 0, groupBreakdown: [] };
    }

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

      const xValues = points.map(p => p.spend);
      const yOrders = points.map(p => p.orders);
      const yRevenue = points.map(p => p.revenue);

      const orderFit = fitLogCurve(xValues, yOrders);
      const revFit = fitLogCurve(xValues, yRevenue);

      let optimalSpend = currentAvgSpend;

      if (revFit.a > 1) {
        optimalSpend = Math.max(0, revFit.a - 1);
      } else if (orderFit.a > 0) {
        optimalSpend = Math.max(currentAvgSpend, orderFit.a * 5);
      }

      optimalSpend = Math.min(optimalSpend, currentAvgSpend * 3);
      optimalSpend = Math.max(optimalSpend, currentAvgSpend * 0.5);

      const rounded = Math.round(optimalSpend / 10000) * 10000;

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
}
