import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Session, SessionDocument } from '../sessions/schemas/session.schema';
import { Invoice, InvoiceDocument } from '../invoices/schemas/invoice.schema';
import { LedgerEntry, LedgerEntryDocument } from '../wallets/schemas/ledger-entry.schema';
import { Wallet, WalletDocument } from '../wallets/schemas/wallet.schema';
import { AdCost, AdCostDocument } from '../ads/schemas/ad-cost.schema';
import {
  Attendance,
  AttendanceDocument,
  COUNTED_ATTENDANCE_STATUSES,
} from '../attendance/schemas/attendance.schema';
import { QueryCashFlowDto } from './dto/fund.dto';
import { PayrollFinancialAggregateService } from './aggregates/payroll-financial.aggregate';
import { ExpenseFinancialAggregateService } from './aggregates/expense-financial.aggregate';
import { LoanFinancialAggregateService } from './aggregates/loan-financial.aggregate';
import { resolveFinancialBasis } from './financial-control.utils';

@Injectable()
export class FinancialControlCashflowService {
  constructor(
    @InjectModel(Session.name) private sessionModel: Model<SessionDocument>,
    @InjectModel(Invoice.name) private invoiceModel: Model<InvoiceDocument>,
    @InjectModel(LedgerEntry.name) private ledgerModel: Model<LedgerEntryDocument>,
    @InjectModel(Wallet.name) private walletModel: Model<WalletDocument>,
    @InjectModel(AdCost.name) private adCostModel: Model<AdCostDocument>,
    @InjectModel(Attendance.name) private attendanceModel: Model<AttendanceDocument>,
    private readonly payrollAggregate: PayrollFinancialAggregateService,
    private readonly expenseAggregate: ExpenseFinancialAggregateService,
    private readonly loanAggregate: LoanFinancialAggregateService,
  ) {}

  async getCashFlow(query: QueryCashFlowDto): Promise<any> {
    const requestedBasis = resolveFinancialBasis(query.basis);
    const dateFilter: any = {};
    if (query.startDate) dateFilter.$gte = new Date(query.startDate);
    if (query.endDate) {
      const end = new Date(query.endDate);
      end.setHours(23, 59, 59, 999);
      dateFilter.$lte = end;
    }

    const hasDateFilter = Object.keys(dateFilter).length > 0;

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

      this.adCostModel.aggregate([
        {
          $match: {
            source: { $ne: 'ESTIMATED' },
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

      this.ledgerModel.aggregate([
        {
          $match: {
            type: 'TOP_UP',
            status: 'APPROVED',
            paymentMethod: { $ne: 'SYSTEM' },
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
                date: { $ifNull: ['$approvedAt', '$createdAt'] },
              },
            },
            totalAmount: { $sum: '$amount' },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),

      this.loanAggregate.getDisbursementTimeline(
        query.groupBy === 'month' ? 'month' : 'day',
        hasDateFilter ? dateFilter : undefined,
      ),

      this.loanAggregate.getRepaymentTimeline(
        query.groupBy === 'month' ? 'month' : 'day',
        hasDateFilter ? dateFilter : undefined,
      ),
    ]);

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

  async getWalletTotals(): Promise<any> {
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

  async getBurnRateOutflows(since: Date): Promise<{
    payrollTotal6m: number;
    expenseTotal6m: number;
    adCostTotal6m: number;
  }> {
    const [payrollTotal6m, expenseTotal6m, adCostRows] = await Promise.all([
      this.payrollAggregate.getPaidTotalSince(since),
      this.expenseAggregate.getPaidTotalSince(since),
      this.adCostModel.aggregate([
        { $match: { date: { $gte: since }, source: { $ne: 'ESTIMATED' } } },
        { $group: { _id: null, total: { $sum: '$spend' } } },
      ]),
    ]);

    return {
      payrollTotal6m,
      expenseTotal6m,
      adCostTotal6m: adCostRows[0]?.total || 0,
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
}
