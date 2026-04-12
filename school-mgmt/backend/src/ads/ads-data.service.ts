import {
  Injectable,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { AdCost, AdCostDocument } from './schemas/ad-cost.schema';
import { AdGroup, AdGroupDocument } from './schemas/ad-group.schema';
import { Order, OrderDocument } from '../orders/schemas/order.schema';
import { Lead, LeadDocument } from '../leads/schemas/lead.schema';
import { Session, SessionDocument, SessionStatus } from '../sessions/schemas/session.schema';
import { Expense, ExpenseDocument, PaymentStatus } from '../expenses/schemas/expense.schema';
import { Student, StudentDocument } from '../students/schemas/student.schema';
import {
  Invoice,
  InvoiceDocument,
  InvoiceStatus,
} from '../invoices/schemas/invoice.schema';
import {
  ParentAttribution,
  ParentAttributionDocument,
} from '../marketing-attribution/schemas/parent-attribution.schema';

import { NetProfitDailyRow, SuggestionModel } from './ads.types';

import {
  getUtcDateRange,
  parseOptionalObjectId,
  groupDayKey,
  splitGroupDayKey,
  daysInMonth,
  fitLogCurve,
  toUtcDateOnlyString,
} from './ads.utils';

@Injectable()
export class AdsDataService {
  private readonly logger = new Logger(AdsDataService.name);
  private readonly maxAnalyticsRangeDays = 366;
  private readonly maxSuggestionRangeDays = 180;

  constructor(
    @InjectModel(AdCost.name) private adCostModel: Model<AdCostDocument>,
    @InjectModel(AdGroup.name) private adGroupModel: Model<AdGroupDocument>,
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    @InjectModel(Lead.name) private leadModel: Model<LeadDocument>,
    @InjectModel(Session.name) private sessionModel: Model<SessionDocument>,
    @InjectModel(Expense.name) private expenseModel: Model<ExpenseDocument>,
    @InjectModel(Student.name) private studentModel: Model<StudentDocument>,
    @InjectModel(Invoice.name) private invoiceModel: Model<InvoiceDocument>,
    @InjectModel(ParentAttribution.name) private parentAttributionModel: Model<ParentAttributionDocument>,
  ) {}

  // ─── Net Profit Daily Rows ─────────────────────────────

  async buildNetProfitDailyRows(
    start: Date,
    end: Date,
    adGroupObjectId?: Types.ObjectId,
  ): Promise<NetProfitDailyRow[]> {
    const sessionMatch: any = {
      adGroupId: { $exists: true, $ne: null },
      status: SessionStatus.FINALIZED,
      scheduledDate: { $gte: start, $lte: end },
    };
    if (adGroupObjectId) sessionMatch.adGroupId = adGroupObjectId;

    const sessionsByGroupDay = await this.sessionModel.aggregate([
      { $match: sessionMatch },
      {
        $group: {
          _id: {
            adGroupId: '$adGroupId',
            date: {
              $dateToString: {
                format: '%Y-%m-%d',
                date: '$scheduledDate',
                timezone: 'UTC',
              },
            },
          },
          revenue: { $sum: { $ifNull: ['$amountCharged', 0] } },
          teacherCost: { $sum: { $ifNull: ['$teacherPayout', 0] } },
          sessionCount: { $sum: 1 },
          adGroupName: { $first: '$adGroupName' },
        },
      },
      { $sort: { '_id.date': 1 } },
    ]);

    const totalSessionsByDay = await this.sessionModel.aggregate([
      {
        $match: {
          status: SessionStatus.FINALIZED,
          scheduledDate: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$scheduledDate',
              timezone: 'UTC',
            },
          },
          totalSessions: { $sum: 1 },
        },
      },
    ]);
    const totalSessionMap = new Map<string, number>(
      totalSessionsByDay.map((row: any) => [String(row._id), Number(row.totalSessions || 0)]),
    );

    const expensesByDay = await this.expenseModel.aggregate([
      {
        $match: {
          paymentStatus: { $in: [PaymentStatus.PAID, PaymentStatus.APPROVED_UNPAID] },
          expenseDate: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$expenseDate',
              timezone: 'UTC',
            },
          },
          totalExpense: { $sum: { $ifNull: ['$amount', 0] } },
        },
      },
    ]);
    const expenseMap = new Map<string, number>(
      expensesByDay.map((row: any) => [String(row._id), Number(row.totalExpense || 0)]),
    );

    const adCostMatch: any = { date: { $gte: start, $lte: end } };
    if (adGroupObjectId) adCostMatch.adGroupId = adGroupObjectId;

    const adCostsByGroupDay = await this.adCostModel.aggregate([
      { $match: adCostMatch },
      {
        $group: {
          _id: {
            adGroupId: '$adGroupId',
            date: {
              $dateToString: {
                format: '%Y-%m-%d',
                date: '$date',
                timezone: 'UTC',
              },
            },
          },
          adSpend: { $sum: { $ifNull: ['$spend', 0] } },
          adGroupName: { $first: '$adGroupName' },
          platform: { $first: '$platform' },
        },
      },
    ]);

    const adCostMap = new Map<string, any>();
    for (const c of adCostsByGroupDay) {
      const gId = String(c._id.adGroupId);
      const date = String(c._id.date);
      adCostMap.set(groupDayKey(gId, date), c);
    }

    const sessionDataMap = new Map<string, any>();
    for (const s of sessionsByGroupDay) {
      const gId = String(s._id.adGroupId);
      const date = String(s._id.date);
      sessionDataMap.set(groupDayKey(gId, date), s);
    }

    const allKeys = new Set<string>([
      ...Array.from(sessionDataMap.keys()),
      ...Array.from(adCostMap.keys()),
    ]);

    const groupIds = new Set<string>();
    for (const key of allKeys) {
      const parsed = splitGroupDayKey(key);
      if (parsed.adGroupId) groupIds.add(parsed.adGroupId);
    }

    const adGroupIds = Array.from(groupIds)
      .filter((id) => Types.ObjectId.isValid(id))
      .map((id) => new Types.ObjectId(id));

    const adGroups = adGroupIds.length
      ? await this.adGroupModel.find({ _id: { $in: adGroupIds } }).select('name platform').lean()
      : [];
    const adGroupMetaMap = new Map<string, { name?: string; platform?: string }>(
      adGroups.map((g: any) => [String(g._id), { name: g.name, platform: g.platform }]),
    );

    const daily: NetProfitDailyRow[] = [];
    for (const key of allKeys) {
      const { adGroupId, date } = splitGroupDayKey(key);
      if (!date) continue;

      const sessionData = sessionDataMap.get(key);
      const revenue = Number(sessionData?.revenue || 0);
      const teacherCost = Number(sessionData?.teacherCost || 0);
      const sessionCount = Number(sessionData?.sessionCount || 0);
      const grossProfit = revenue - teacherCost;

      const totalSessionsOfDay = Number(totalSessionMap.get(date) || 0);
      const totalExpenseOfDay = Number(expenseMap.get(date) || 0);
      const overheadPerSession = totalSessionsOfDay > 0 ? totalExpenseOfDay / totalSessionsOfDay : 0;
      const allocatedOverhead = Math.round(overheadPerSession * sessionCount);

      const adCostData = adCostMap.get(key);
      const adSpend = Number(adCostData?.adSpend || 0);
      const netProfit = grossProfit - allocatedOverhead - adSpend;

      const meta = adGroupMetaMap.get(adGroupId);
      daily.push({
        date,
        adGroupId,
        adGroupName: sessionData?.adGroupName || adCostData?.adGroupName || meta?.name || '',
        platform: adCostData?.platform || meta?.platform || '',
        sessionCount,
        revenue,
        teacherCost,
        grossProfit,
        totalExpenseOfDay,
        totalSessionsOfDay,
        overheadPerSession: Math.round(overheadPerSession),
        allocatedOverhead,
        adSpend,
        netProfit,
        netMargin: revenue > 0 ? Math.round((netProfit / revenue) * 10000) / 100 : 0,
      });
    }

    daily.sort((a, b) => a.date.localeCompare(b.date) || a.adGroupId.localeCompare(b.adGroupId));
    return daily;
  }

  // ─── Analytics ─────────────────────────────────────────

  async getAnalytics(startDate: string, endDate: string, adGroupId?: string, platform?: string): Promise<any> {
    const { start, end } = getUtcDateRange(startDate, endDate, this.maxAnalyticsRangeDays);
    const adGroupObjectId = parseOptionalObjectId(adGroupId);

    const costMatch: any = { date: { $gte: start, $lte: end } };
    if (adGroupObjectId) costMatch.adGroupId = adGroupObjectId;
    if (platform) costMatch.platform = platform;

    const costsByGroup = await this.adCostModel.aggregate([
      { $match: costMatch },
      {
        $group: {
          _id: '$adGroupId',
          totalSpend: { $sum: { $ifNull: ['$spend', 0] } },
          totalImpressions: { $sum: { $ifNull: ['$impressions', 0] } },
          totalClicks: { $sum: { $ifNull: ['$clicks', 0] } },
          totalConversions: { $sum: { $ifNull: ['$conversions', 0] } },
          adGroupName: { $first: '$adGroupName' },
          platform: { $first: '$platform' },
        },
      },
    ]);
    const costMap = new Map(costsByGroup.map((c) => [c._id.toString(), c]));

    const leadMatch: any = { adGroupId: { $exists: true, $ne: null }, createdAt: { $gte: start, $lte: end } };
    if (adGroupObjectId) leadMatch.adGroupId = adGroupObjectId;

    const leadsByGroup = await this.leadModel.aggregate([
      { $match: leadMatch },
      { $group: { _id: '$adGroupId', leadCount: { $sum: 1 } } },
    ]);
    const leadMap = new Map(leadsByGroup.map(l => [l._id.toString(), l.leadCount]));

    const orderMatch: any = {
      adGroupId: { $exists: true, $ne: null },
      createdAt: { $gte: start, $lte: end },
      status: { $in: ['APPROVED', 'COMPLETED'] },
    };
    if (adGroupObjectId) orderMatch.adGroupId = adGroupObjectId;

    const ordersByGroup = await this.orderModel.aggregate([
      { $match: orderMatch },
      {
        $group: {
          _id: '$adGroupId',
          orderCount: { $sum: 1 },
          revenue: { $sum: '$finalAmount' },
        },
      },
    ]);
    const orderMap = new Map(ordersByGroup.map(o => [o._id.toString(), o]));

    const dailyNetProfit = await this.buildNetProfitDailyRows(start, end, adGroupObjectId);
    const netProfitByGroup = new Map<string, number>();
    const netProfitMetaByGroup = new Map<string, { adGroupName: string; platform: string }>();
    for (const row of dailyNetProfit) {
      if (platform && row.platform !== platform) continue;
      netProfitByGroup.set(row.adGroupId, (netProfitByGroup.get(row.adGroupId) || 0) + row.netProfit);
      if (!netProfitMetaByGroup.has(row.adGroupId)) {
        netProfitMetaByGroup.set(row.adGroupId, {
          adGroupName: row.adGroupName || '',
          platform: row.platform || '',
        });
      }
    }

    const allGroupIds = new Set<string>();
    for (const gId of costMap.keys()) allGroupIds.add(gId);
    for (const gId of leadMap.keys()) allGroupIds.add(gId);
    for (const gId of orderMap.keys()) allGroupIds.add(gId);
    for (const gId of netProfitByGroup.keys()) allGroupIds.add(gId);
    if (adGroupObjectId) allGroupIds.add(adGroupObjectId.toString());

    const adGroupMetaMap = new Map<string, { name: string; platform: string }>();
    const adGroupOids = Array.from(allGroupIds)
      .filter((id) => Types.ObjectId.isValid(id))
      .map((id) => new Types.ObjectId(id));
    if (adGroupOids.length > 0) {
      const groups = await this.adGroupModel
        .find({ _id: { $in: adGroupOids } })
        .select('_id name platform')
        .lean();
      for (const group of groups as any[]) {
        adGroupMetaMap.set(group._id.toString(), {
          name: group.name || '',
          platform: group.platform || '',
        });
      }
    }

    const rows = Array.from(allGroupIds)
      .map((gId) => {
        const cost = costMap.get(gId);
        const groupMeta = adGroupMetaMap.get(gId);
        const netProfitMeta = netProfitMetaByGroup.get(gId);
        const resolvedPlatform = cost?.platform || netProfitMeta?.platform || groupMeta?.platform || '';

        if (platform && resolvedPlatform !== platform) return null;

        const leadCount = leadMap.get(gId) || 0;
        const orderData = orderMap.get(gId) || { orderCount: 0, revenue: 0 };
        const netProfit = netProfitByGroup.get(gId) || 0;
        const totalSpend = Number(cost?.totalSpend || 0);
        const roi = totalSpend > 0 ? (netProfit / totalSpend) * 100 : 0;

        return {
          adGroupId: gId,
          adGroupName: cost?.adGroupName || netProfitMeta?.adGroupName || groupMeta?.name || '',
          platform: resolvedPlatform,
          totalSpend,
          totalImpressions: Number(cost?.totalImpressions || 0),
          totalClicks: Number(cost?.totalClicks || 0),
          totalConversions: Number(cost?.totalConversions || 0),
          leadCount,
          orderCount: orderData.orderCount,
          revenue: orderData.revenue,
          costPerLead: leadCount > 0 ? Math.round(totalSpend / leadCount) : null,
          costPerOrder: orderData.orderCount > 0 ? Math.round(totalSpend / orderData.orderCount) : null,
          netProfit,
          roi: Math.round(roi * 100) / 100,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null)
      .sort((a, b) => b.totalSpend - a.totalSpend || b.netProfit - a.netProfit);

    const summary = {
      totalSpend: rows.reduce((s, r) => s + r.totalSpend, 0),
      totalLeads: rows.reduce((s, r) => s + r.leadCount, 0),
      totalOrders: rows.reduce((s, r) => s + r.orderCount, 0),
      totalRevenue: rows.reduce((s, r) => s + r.revenue, 0),
      totalNetProfit: rows.reduce((s, r) => s + r.netProfit, 0),
      avgCostPerLead: 0,
      avgCostPerOrder: 0,
      avgRoi: 0,
    };

    if (summary.totalLeads > 0) summary.avgCostPerLead = Math.round(summary.totalSpend / summary.totalLeads);
    if (summary.totalOrders > 0) summary.avgCostPerOrder = Math.round(summary.totalSpend / summary.totalOrders);
    if (summary.totalSpend > 0) summary.avgRoi = Math.round((summary.totalNetProfit / summary.totalSpend) * 10000) / 100;

    return { rows, summary };
  }

  // ─── Net Profit By Ad Group ────────────────────────────

  async getNetProfitByAdGroup(
    startDate: string,
    endDate: string,
    adGroupId?: string,
  ): Promise<any> {
    const { start, end } = getUtcDateRange(startDate, endDate, this.maxAnalyticsRangeDays);
    const adGroupObjectId = parseOptionalObjectId(adGroupId);
    const daily = await this.buildNetProfitDailyRows(start, end, adGroupObjectId);

    const groupSummaryMap = new Map<string, any>();
    for (const row of daily) {
      if (!groupSummaryMap.has(row.adGroupId)) {
        groupSummaryMap.set(row.adGroupId, {
          adGroupId: row.adGroupId,
          adGroupName: row.adGroupName,
          platform: row.platform,
          totalRevenue: 0,
          totalTeacherCost: 0,
          totalGrossProfit: 0,
          totalAllocatedOverhead: 0,
          totalAdSpend: 0,
          totalNetProfit: 0,
          totalSessions: 0,
          days: 0,
        });
      }
      const s = groupSummaryMap.get(row.adGroupId);
      s.totalRevenue += row.revenue;
      s.totalTeacherCost += row.teacherCost;
      s.totalGrossProfit += row.grossProfit;
      s.totalAllocatedOverhead += row.allocatedOverhead;
      s.totalAdSpend += row.adSpend;
      s.totalNetProfit += row.netProfit;
      s.totalSessions += row.sessionCount;
      s.days += 1;
    }

    const summaryByGroup = Array.from(groupSummaryMap.values())
      .map((s: any) => ({
        ...s,
        netMargin: s.totalRevenue > 0
          ? Math.round((s.totalNetProfit / s.totalRevenue) * 10000) / 100
          : 0,
        avgNetProfitPerDay: s.days > 0 ? Math.round(s.totalNetProfit / s.days) : 0,
        avgNetProfitPerSession: s.totalSessions > 0
          ? Math.round(s.totalNetProfit / s.totalSessions)
          : 0,
      }))
      .sort((a, b) => b.totalNetProfit - a.totalNetProfit);

    const overall = {
      totalRevenue: summaryByGroup.reduce((s, r) => s + r.totalRevenue, 0),
      totalTeacherCost: summaryByGroup.reduce((s, r) => s + r.totalTeacherCost, 0),
      totalGrossProfit: summaryByGroup.reduce((s, r) => s + r.totalGrossProfit, 0),
      totalAllocatedOverhead: summaryByGroup.reduce((s, r) => s + r.totalAllocatedOverhead, 0),
      totalAdSpend: summaryByGroup.reduce((s, r) => s + r.totalAdSpend, 0),
      totalNetProfit: summaryByGroup.reduce((s, r) => s + r.totalNetProfit, 0),
      totalSessions: summaryByGroup.reduce((s, r) => s + r.totalSessions, 0),
      netMargin: 0,
    };
    if (overall.totalRevenue > 0) {
      overall.netMargin = Math.round((overall.totalNetProfit / overall.totalRevenue) * 10000) / 100;
    }

    return { daily, summaryByGroup, overall };
  }

  // ─── Suggestions ───────────────────────────────────────

  async getSuggestions(startDate: string, endDate: string, totalBudget: number): Promise<any> {
    if (!Number.isFinite(totalBudget) || totalBudget < 0) {
      throw new BadRequestException('totalBudget must be a non-negative number');
    }

    const normalizedBudget = Math.round(totalBudget);
    const { start, end } = getUtcDateRange(startDate, endDate, this.maxSuggestionRangeDays);
    const dailyRows = await this.buildNetProfitDailyRows(start, end);
    const maxDailyIncreaseFactor = 1.2;

    if (!dailyRows.length) {
      return {
        totalBudget: normalizedBudget,
        allocated: 0,
        unallocated: normalizedBudget,
        totalSuggestedDailySpend: 0,
        expectedDailyNetProfit: 0,
        projectedMonthlySpend: 0,
        projectedMonthlyNetProfit: 0,
        dailySuggestedTotals: [],
        monthlyProjection: [],
        summaryTable: [],
        suggestions: [],
      };
    }

    const groupData = new Map<string, {
      adGroupName: string;
      platform: string;
      rows: NetProfitDailyRow[];
      points: Array<{ spend: number; netProfit: number }>;
    }>();

    for (const row of dailyRows) {
      if (!groupData.has(row.adGroupId)) {
        groupData.set(row.adGroupId, {
          adGroupName: row.adGroupName,
          platform: row.platform,
          rows: [],
          points: [],
        });
      }
      const target = groupData.get(row.adGroupId)!;
      target.rows.push(row);
      if (row.adSpend > 0) {
        target.points.push({ spend: row.adSpend, netProfit: row.netProfit });
      }
    }

    const minPoints = 7;
    const suggestions: SuggestionModel[] = [];

    for (const [gId, data] of groupData) {
      const currentAvgSpend = data.rows.length > 0
        ? Math.round(data.rows.reduce((sum, row) => sum + row.adSpend, 0) / data.rows.length)
        : 0;

      if (data.points.length < minPoints) {
        suggestions.push({
          adGroupId: gId,
          adGroupName: data.adGroupName,
          platform: data.platform,
          currentDailySpend: currentAvgSpend,
          suggestedDailySpend: 0,
          expectedDailyNetProfit: null,
          expectedDailyMarginalProfit: null,
          changePercent: null,
          confidence: 'LOW',
          dataPoints: data.points.length,
          maturityDays: 0,
          averageCtr: 0,
          averageLeadRate: 0,
          averageProfitPerLead: null,
          observedAverageNetProfit: 0,
          recommendation: '',
          recommendationReasons: [],
          coeffA: null,
          coeffB: null,
        });
        continue;
      }

      const fit = fitLogCurve(
        data.points.map((p) => p.spend),
        data.points.map((p) => p.netProfit),
      );

      suggestions.push({
        adGroupId: gId,
        adGroupName: data.adGroupName,
        platform: data.platform,
        currentDailySpend: currentAvgSpend,
        suggestedDailySpend: 0,
        expectedDailyNetProfit: null,
        expectedDailyMarginalProfit: null,
        changePercent: null,
        confidence: fit.rSquared >= 0.5 ? 'HIGH' : fit.rSquared >= 0.2 ? 'MEDIUM' : 'LOW',
        dataPoints: data.points.length,
        maturityDays: 0,
        averageCtr: 0,
        averageLeadRate: 0,
        averageProfitPerLead: null,
        observedAverageNetProfit: 0,
        recommendation: '',
        recommendationReasons: [],
        coeffA: fit.a,
        coeffB: fit.b,
      });
    }

    const allocations = new Map<string, number>();
    for (const s of suggestions) allocations.set(s.adGroupId, 0);

    let remainingBudget = normalizedBudget;
    const allocatable = suggestions.filter((s) => s.coeffA !== null && s.coeffA > 0);
    const step = 100000;

    if (allocatable.length > 0 && remainingBudget > 0) {
      while (remainingBudget >= step) {
        let bestGroup: SuggestionModel | null = null;
        let bestMarginal = -Infinity;

        for (const s of allocatable) {
          const currentAlloc = allocations.get(s.adGroupId) || 0;
          const marginal = (s.coeffA as number) / (currentAlloc + 1);
          if (marginal > bestMarginal) {
            bestMarginal = marginal;
            bestGroup = s;
          }
        }

        if (!bestGroup || bestMarginal <= 0) break;

        allocations.set(bestGroup.adGroupId, (allocations.get(bestGroup.adGroupId) || 0) + step);
        remainingBudget -= step;
      }

      if (remainingBudget > 0) {
        let bestGroup: SuggestionModel | null = null;
        let bestMarginal = -Infinity;

        for (const s of allocatable) {
          const currentAlloc = allocations.get(s.adGroupId) || 0;
          const marginal = (s.coeffA as number) / (currentAlloc + 1);
          if (marginal > bestMarginal) {
            bestMarginal = marginal;
            bestGroup = s;
          }
        }

        if (bestGroup && bestMarginal > 0) {
          allocations.set(bestGroup.adGroupId, (allocations.get(bestGroup.adGroupId) || 0) + remainingBudget);
          remainingBudget = 0;
        }
      }
    } else if (suggestions.length > 0 && remainingBudget > 0) {
      const weights = suggestions.map((s) => Math.max(0, s.currentDailySpend));
      const weightSum = weights.reduce((sum, value) => sum + value, 0);

      if (weightSum > 0) {
        let distributed = 0;
        for (let i = 0; i < suggestions.length; i++) {
          const s = suggestions[i];
          const isLast = i === suggestions.length - 1;
          const alloc = isLast
            ? remainingBudget - distributed
            : Math.floor((remainingBudget * weights[i]) / weightSum);
          allocations.set(s.adGroupId, alloc);
          distributed += alloc;
        }
      } else {
        const perGroup = Math.floor(remainingBudget / suggestions.length);
        let remainder = remainingBudget - (perGroup * suggestions.length);
        for (const s of suggestions) {
          const extra = remainder > 0 ? 1 : 0;
          allocations.set(s.adGroupId, perGroup + extra);
          if (remainder > 0) remainder -= 1;
        }
      }
      remainingBudget = 0;
    }

    const latestSpendByGroup = new Map<string, number>();
    for (const [gId, data] of groupData.entries()) {
      const sortedRows = [...data.rows].sort((a, b) => a.date.localeCompare(b.date));
      const latest = sortedRows[sortedRows.length - 1];
      latestSpendByGroup.set(gId, latest?.adSpend || 0);
    }

    const cappedAllocations = new Map<string, number>();
    const capInfoByGroup = new Map<string, {
      previousDayAdSpend: number | null;
      capByPreviousDay: number | null;
      cappedByDailyGuard: boolean;
    }>();
    for (const s of suggestions) {
      const rawAlloc = allocations.get(s.adGroupId) || 0;
      const latestSpend = latestSpendByGroup.get(s.adGroupId) || 0;
      if (latestSpend > 0) {
        const capByPreviousDay = Math.round(latestSpend * maxDailyIncreaseFactor);
        const suggested = Math.min(rawAlloc, capByPreviousDay);
        cappedAllocations.set(s.adGroupId, suggested);
        capInfoByGroup.set(s.adGroupId, {
          previousDayAdSpend: latestSpend,
          capByPreviousDay,
          cappedByDailyGuard: rawAlloc > capByPreviousDay,
        });
      } else {
        cappedAllocations.set(s.adGroupId, rawAlloc);
        capInfoByGroup.set(s.adGroupId, {
          previousDayAdSpend: null,
          capByPreviousDay: null,
          cappedByDailyGuard: false,
        });
      }
    }

    let expectedDailyNetProfit = 0;
    for (const s of suggestions) {
      const alloc = cappedAllocations.get(s.adGroupId) || 0;
      s.suggestedDailySpend = alloc;

      if (s.coeffA !== null && s.coeffB !== null) {
        const predicted = s.coeffA * Math.log(alloc + 1) + s.coeffB;
        const marginal = s.coeffA / (alloc + 1);
        s.expectedDailyNetProfit = Math.round(predicted);
        s.expectedDailyMarginalProfit = Math.round(marginal * 100) / 100;
        expectedDailyNetProfit += s.expectedDailyNetProfit;
      }

      s.changePercent = s.currentDailySpend > 0
        ? Math.round(((alloc - s.currentDailySpend) / s.currentDailySpend) * 100)
        : null;
    }

    const totalSuggestedDailySpend = suggestions.reduce((sum, row) => sum + row.suggestedDailySpend, 0);

    const summaryTable = dailyRows
      .map((row) => {
        const rawSuggestedAdSpend = allocations.get(row.adGroupId) || 0;
        const suggestedAdSpend = cappedAllocations.get(row.adGroupId) || 0;
        const capInfo = capInfoByGroup.get(row.adGroupId);
        return {
          date: row.date,
          adGroupId: row.adGroupId,
          adGroupName: row.adGroupName,
          platform: row.platform,
          netProfit: row.netProfit,
          actualAdSpend: row.adSpend,
          rawSuggestedAdSpend,
          suggestedAdSpend,
          previousDayAdSpend: capInfo?.previousDayAdSpend ?? null,
          capByPreviousDay: capInfo?.capByPreviousDay ?? null,
          cappedByDailyGuard: capInfo?.cappedByDailyGuard ?? false,
        };
      })
      .sort((a, b) => a.date.localeCompare(b.date) || a.adGroupId.localeCompare(b.adGroupId));

    const netProfitByDate = new Map<string, number>();
    for (const row of summaryTable) {
      netProfitByDate.set(row.date, (netProfitByDate.get(row.date) || 0) + row.netProfit);
    }
    const uniqueDates = Array.from(new Set(dailyRows.map((row) => row.date))).sort();
    const dailySuggestedTotals = uniqueDates.map((date) => ({
      date,
      totalNetProfit: netProfitByDate.get(date) || 0,
      totalSuggestedAdSpend: totalSuggestedDailySpend,
    }));

    const monthlyProjection = Array.from(new Set(dailySuggestedTotals.map((row) => row.date.slice(0, 7))))
      .sort()
      .map((month) => {
        const [yearStr, monthStr] = month.split('-');
        const year = Number(yearStr);
        const monthNumber = Number(monthStr);
        const monthDate = new Date(Date.UTC(year, monthNumber - 1, 1));
        const days = daysInMonth(monthDate);
        return {
          month,
          daysInMonth: days,
          projectedSpend: totalSuggestedDailySpend * days,
          projectedNetProfit: Math.round(expectedDailyNetProfit * days),
        };
      });

    const cleanSuggestions = suggestions
      .map(({ coeffA, coeffB, ...item }) => item)
      .sort((a, b) => b.suggestedDailySpend - a.suggestedDailySpend);

    return {
      totalBudget: normalizedBudget,
      allocated: totalSuggestedDailySpend,
      unallocated: Math.max(0, normalizedBudget - totalSuggestedDailySpend),
      totalSuggestedDailySpend,
      expectedDailyNetProfit,
      projectedMonthlySpend: monthlyProjection[0]?.projectedSpend || 0,
      projectedMonthlyNetProfit: monthlyProjection[0]?.projectedNetProfit || 0,
      dailySuggestedTotals,
      monthlyProjection,
      summaryTable,
      suggestions: cleanSuggestions,
    };
  }

  // ─── Backfill & Sync ──────────────────────────────────

  async syncTrueRevenue(adGroupId?: string): Promise<{
    groupsProcessed: number;
    totalLeadsUpdated: number;
    totalRevenueUpdated: number;
    errors: string[];
  }> {
    const filter: any = adGroupId ? { _id: new Types.ObjectId(adGroupId) } : {};
    const groups = await this.adGroupModel.find(filter).lean();

    let groupsProcessed = 0;
    let totalLeadsUpdated = 0;
    let totalRevenueUpdated = 0;
    const errors: string[] = [];

    for (const group of groups) {
      try {
        const gId = group._id as Types.ObjectId;

        const totalLeads = await this.leadModel.countDocuments({ adGroupId: gId });

        const spendAgg = await this.adCostModel.aggregate<{ total: number }>([
          { $match: { adGroupId: gId } },
          { $group: { _id: null, total: { $sum: '$spend' } } },
        ]);
        const totalSpend = spendAgg[0]?.total ?? 0;

        const directStudents = await this.studentModel
          .find({ adGroupId: gId })
          .select('_id')
          .lean();

        const attributions = await this.parentAttributionModel
          .find({ adGroupId: gId })
          .select('parentUserId')
          .lean();

        const attributedParentIds = attributions
          .filter((a) => a.parentUserId)
          .map((a) => a.parentUserId as Types.ObjectId);

        const attributedStudents =
          attributedParentIds.length > 0
            ? await this.studentModel
                .find({ parentUserId: { $in: attributedParentIds } })
                .select('_id')
                .lean()
            : [];

        const studentIdSet = new Set<string>([
          ...directStudents.map((s) => (s._id as Types.ObjectId).toString()),
          ...attributedStudents.map((s) => (s._id as Types.ObjectId).toString()),
        ]);

        let totalRevenue = 0;
        if (studentIdSet.size > 0) {
          const studentObjectIds = Array.from(studentIdSet).map(
            (id) => new Types.ObjectId(id),
          );
          const revenueAgg = await this.invoiceModel.aggregate<{ total: number }>([
            {
              $match: {
                studentId: { $in: studentObjectIds },
                status: { $in: [InvoiceStatus.APPROVED, InvoiceStatus.PAID] },
              },
            },
            { $group: { _id: null, total: { $sum: '$amount' } } },
          ]);
          totalRevenue = revenueAgg[0]?.total ?? 0;
        }

        await this.adGroupModel.updateOne(
          { _id: gId },
          {
            $set: {
              totalLeads,
              totalSpend,
              totalRevenue,
              revenueLastSyncedAt: new Date(),
            },
          },
        );

        groupsProcessed++;
        totalLeadsUpdated += totalLeads;
        totalRevenueUpdated += totalRevenue;
      } catch (err: any) {
        const msg = `AdGroup ${(group as any).name ?? String(group._id)}: ${err.message}`;
        errors.push(msg);
        this.logger.error(`syncTrueRevenue error: ${msg}`);
      }
    }

    this.logger.log(
      `syncTrueRevenue done: ${groupsProcessed} groups, totalRevenue=${totalRevenueUpdated}, errors=${errors.length}`,
    );
    return { groupsProcessed, totalLeadsUpdated, totalRevenueUpdated, errors };
  }

  async backfillParentAttribution(): Promise<{
    conversations: number;
    leads: number;
    orders: number;
    students: number;
    upserted: number;
  }> {
    let leads = 0;
    let orders = 0;
    let students = 0;
    let upserted = 0;
    const conversations = 0;

    const leadsWithAd = await this.leadModel
      .find({ adGroupId: { $exists: true, $ne: null } })
      .select('_id adGroupId adGroupName parentPhone parentEmail tracking')
      .lean();

    for (const lead of leadsWithAd) {
      if (!lead.adGroupId) continue;
      try {
        const exists = await this.parentAttributionModel.findOne({
          sourceLeadId: lead._id,
        }).lean();
        if (exists) continue;

        await this.parentAttributionModel.create({
          parentKey: lead.parentPhone
            ? `phone:${String(lead.parentPhone).replace(/\D/g, '')}`
            : `lead:${String(lead._id)}`,
          normalizedParentPhone: lead.parentPhone
            ? String(lead.parentPhone).replace(/\D/g, '')
            : undefined,
          adGroupId: lead.adGroupId,
          adGroupName: (lead as any).adGroupName,
          tracking: (lead as any).tracking,
          sourceLeadId: lead._id,
          attributionModel: 'FIRST_TOUCH_LOCKED',
          firstAttributedAt: (lead as any).createdAt ?? new Date(),
          lastConfirmedAt: new Date(),
        });
        upserted++;
      } catch (err: any) {
        this.logger.warn(`backfillParentAttribution lead ${lead._id}: ${err.message}`);
      }
      leads++;
    }

    const studentsWithAd = await this.studentModel
      .find({ adGroupId: { $exists: true, $ne: null }, parentUserId: { $exists: true, $ne: null } })
      .select('_id adGroupId adGroupName parentUserId')
      .lean();

    for (const student of studentsWithAd) {
      if (!student.adGroupId || !(student as any).parentUserId) continue;
      try {
        const exists = await this.parentAttributionModel.findOne({
          parentUserId: (student as any).parentUserId,
        }).lean();
        if (exists) continue;

        await this.parentAttributionModel.create({
          parentKey: `user:${String((student as any).parentUserId)}`,
          parentUserId: (student as any).parentUserId,
          adGroupId: student.adGroupId,
          adGroupName: (student as any).adGroupName,
          attributionModel: 'FIRST_TOUCH_LOCKED',
          firstAttributedAt: (student as any).createdAt ?? new Date(),
          lastConfirmedAt: new Date(),
        });
        upserted++;
      } catch (err: any) {
        this.logger.warn(`backfillParentAttribution student ${student._id}: ${err.message}`);
      }
      students++;
    }

    this.logger.log(
      `backfillParentAttribution done: leads=${leads}, students=${students}, upserted=${upserted}`,
    );
    return { conversations, leads, orders, students, upserted };
  }

  async backfillAdGroupIds(): Promise<{
    studentsUpdated: number;
    sessionsUpdated: number;
  }> {
    let studentsUpdated = 0;
    let sessionsUpdated = 0;

    const orders = await this.orderModel.find({
      adGroupId: { $exists: true, $ne: null },
      'processedResults.studentId': { $exists: true, $ne: null },
    }).lean();

    for (const order of orders) {
      const o = order as any;
      const studentId = o.processedResults?.studentId;
      if (!studentId) continue;

      const studentResult = await this.studentModel.updateOne(
        { _id: studentId, adGroupId: { $exists: false } },
        {
          $set: {
            orderId: o._id,
            adGroupId: o.adGroupId,
            adGroupName: o.adGroupName || undefined,
          },
        },
      );
      if (studentResult.modifiedCount > 0) studentsUpdated++;

      const sessionResult = await this.sessionModel.updateMany(
        { studentId: studentId, adGroupId: { $exists: false } },
        {
          $set: {
            orderId: o._id,
            adGroupId: o.adGroupId,
            adGroupName: o.adGroupName || undefined,
          },
        },
      );
      sessionsUpdated += sessionResult.modifiedCount;
    }

    this.logger.log(
      `Backfill complete: ${studentsUpdated} students, ${sessionsUpdated} sessions updated`,
    );

    return { studentsUpdated, sessionsUpdated };
  }
}
