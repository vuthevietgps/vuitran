import { TransactionType, TransactionStatus } from '../wallets/schemas/ledger-entry.schema';
import { BadRequestException } from '@nestjs/common';
import { SessionStatus } from '../sessions/schemas/session.schema';
import { PaymentStatus } from '../expenses/schemas/expense.schema';
import { normalizePhone, buildParentKey } from '../marketing-attribution/parent-attribution.util';
import { ExpenseAllocationScope } from '../expenses/schemas/expense.schema';
import { InvoiceType, InvoiceStatus } from '../invoices/schemas/invoice.schema';
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AdCost, AdCostDocument } from './schemas/ad-cost.schema';
import { AdGroup, AdGroupDocument } from './schemas/ad-group.schema';
import { Expense, ExpenseDocument } from '../expenses/schemas/expense.schema';
import { Invoice, InvoiceDocument } from '../invoices/schemas/invoice.schema';
import { Lead, LeadDocument } from '../leads/schemas/lead.schema';
import { LedgerEntry, LedgerEntryDocument } from '../wallets/schemas/ledger-entry.schema';
import { Order, OrderDocument } from '../orders/schemas/order.schema';
import { ParentAttribution, ParentAttributionDocument } from '../marketing-attribution/schemas/parent-attribution.schema';
import { Session, SessionDocument } from '../sessions/schemas/session.schema';
import { Student, StudentDocument } from '../students/schemas/student.schema';

import {
  ActionableSuggestion,
  NetProfitDailyRow,
  ParentProfitabilityAccumulator,
  ParentProfitabilityRow,
  ProfitProjectionBasis,
  ProfitProjectionProfile,
  RealizedCohortParentAccumulator,
  RealizedCohortRow,
  SuggestionModel,
} from './ads.types';

import {
  addUtcDays,
  allocateSharedAmount,
  buildProfitProjectionProfile,
  buildProfitProjectionProfileMap,
  buildSuggestionRecommendation,
  daysInMonth,
  ensureParentAccumulator,
  ensureRealizedCohortAccumulator,
  fitLogCurve,
  getUtcDateRange,
  groupDayKey,
  isDateWithinInclusiveRange,
  mergeParentIdentity,
  normalizeMaturityDays,
  normalizeRefundRatePercentX,
  normalizeToUtcDay,
  parseOptionalObjectId,
  resolveProfitProjection,
  roundCurrency,
  splitGroupDayKey,
  toUtcDateOnlyString,
} from './ads.utils';

@Injectable()
export class AdsAnalyticsService {
  private readonly logger = new Logger(AdsAnalyticsService.name);
  private readonly maxAnalyticsRangeDays = 366;
  private readonly maxRealizedCohortRangeDays = 180;
  private readonly maxSuggestionRangeDays = 180;

  constructor(
    @InjectModel(AdCost.name) private readonly adCostModel: Model<AdCostDocument>,
    @InjectModel(AdGroup.name) private readonly adGroupModel: Model<AdGroupDocument>,
    @InjectModel(Expense.name) private readonly expenseModel: Model<ExpenseDocument>,
    @InjectModel(Invoice.name) private readonly invoiceModel: Model<InvoiceDocument>,
    @InjectModel(Lead.name) private readonly leadModel: Model<LeadDocument>,
    @InjectModel(LedgerEntry.name) private readonly ledgerEntryModel: Model<LedgerEntryDocument>,
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    @InjectModel(ParentAttribution.name) private readonly parentAttributionModel: Model<ParentAttributionDocument>,
    @InjectModel(Session.name) private readonly sessionModel: Model<SessionDocument>,
    @InjectModel(Student.name) private readonly studentModel: Model<StudentDocument>,
  ) {}

  private async buildNetProfitDailyRows(
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
          // Accounting view: include incurred expenses even if not yet paid.
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

  async getAnalytics(startDate: string, endDate: string, adGroupId?: string, platform?: string): Promise<any> {
    const { start, end } = getUtcDateRange(startDate, endDate, this.maxAnalyticsRangeDays);
    const adGroupObjectId = parseOptionalObjectId(adGroupId);

    // Get ad costs aggregated by group
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

    // Get leads count per ad group
    const leadMatch: any = { adGroupId: { $exists: true, $ne: null }, createdAt: { $gte: start, $lte: end } };
    if (adGroupObjectId) leadMatch.adGroupId = adGroupObjectId;

    const leadsByGroup = await this.leadModel.aggregate([
      { $match: leadMatch },
      { $group: { _id: '$adGroupId', leadCount: { $sum: 1 } } },
    ]);
    const leadMap = new Map(leadsByGroup.map(l => [l._id.toString(), l.leadCount]));

    // Get orders count and revenue per ad group
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

    // Calculate net profit with full business formula to keep all analytics consistent.
    const dailyNetProfit = await this.buildNetProfitDailyRows(start, end, adGroupObjectId);
    const netProfitByGroup = new Map<string, number>();
    const recognizedRevenueByGroup = new Map<string, number>();
    const netProfitMetaByGroup = new Map<string, { adGroupName: string; platform: string }>();
    for (const row of dailyNetProfit) {
      if (platform && row.platform !== platform) continue;
      netProfitByGroup.set(row.adGroupId, (netProfitByGroup.get(row.adGroupId) || 0) + row.netProfit);
      recognizedRevenueByGroup.set(row.adGroupId, (recognizedRevenueByGroup.get(row.adGroupId) || 0) + row.revenue);
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
    const adGroupIds = Array.from(allGroupIds)
      .filter((id) => Types.ObjectId.isValid(id))
      .map((id) => new Types.ObjectId(id));
    if (adGroupIds.length > 0) {
      const groups = await this.adGroupModel
        .find({ _id: { $in: adGroupIds } })
        .select('_id name platform')
        .lean();
      for (const group of groups as any[]) {
        adGroupMetaMap.set(group._id.toString(), {
          name: group.name || '',
          platform: group.platform || '',
        });
      }
    }

    // Combine results from all data sources (cost, leads, orders, net-profit).
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
      const recognizedRevenue = recognizedRevenueByGroup.get(gId) || 0;
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
        revenue: recognizedRevenue,
        bookedRevenue: orderData.revenue,
        costPerLead: leadCount > 0 ? Math.round(totalSpend / leadCount) : null,
        costPerOrder: orderData.orderCount > 0 ? Math.round(totalSpend / orderData.orderCount) : null,
        netProfit,
        roi: Math.round(roi * 100) / 100,
      };
    })
      .filter((row): row is NonNullable<typeof row> => row !== null)
      .sort((a, b) => b.totalSpend - a.totalSpend || b.netProfit - a.netProfit);

    // Summary
    const summary = {
      totalSpend: rows.reduce((s, r) => s + r.totalSpend, 0),
      totalLeads: rows.reduce((s, r) => s + r.leadCount, 0),
      totalOrders: rows.reduce((s, r) => s + r.orderCount, 0),
      totalRevenue: rows.reduce((s, r) => s + r.revenue, 0),
      totalBookedRevenue: rows.reduce((s, r) => s + r.bookedRevenue, 0),
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

  // â”€â”€â”€ Net Profit By Ad Group (Per Day) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  /**
   * TÃ­nh lá»£i nhuáº­n thuáº§n trÃªn má»—i nhÃ³m quáº£ng cÃ¡o theo ngÃ y.
   *
   * CÃ´ng thá»©c:
   *   grossProfit = Î£(amountCharged - teacherPayout) cá»§a sessions thuá»™c adGroup ngÃ y Ä‘Ã³
   *   overheadPerSession = totalExpenses(ngÃ y) / totalSessions(ngÃ y)
   *   allocatedOverhead = overheadPerSession Ã— sessionCount(adGroup, ngÃ y)
   *   netProfit = grossProfit - allocatedOverhead - adSpend(adGroup, ngÃ y)
   */
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

  async getParentProfitability(
    startDate: string,
    endDate: string,
    adGroupId?: string,
    platform?: string,
  ): Promise<any> {
    const { start, end } = getUtcDateRange(startDate, endDate, this.maxAnalyticsRangeDays);
    const adGroupObjectId = parseOptionalObjectId(adGroupId);

    const [attributions, sessions, expenses, adCosts] = await Promise.all([
      this.parentAttributionModel.find(adGroupObjectId ? { adGroupId: adGroupObjectId } : {})
        .select('parentKey parentUserId parentPhone normalizedParentPhone adGroupId adGroupName platform firstAttributedAt')
        .lean(),
      this.sessionModel.find({
        status: SessionStatus.FINALIZED,
        scheduledDate: { $gte: start, $lte: end },
      })
        .select('parentUserId studentId adGroupId adGroupName amountCharged teacherPayout')
        .lean(),
      this.expenseModel.find({
        paymentStatus: { $in: [PaymentStatus.PAID, PaymentStatus.APPROVED_UNPAID] },
        expenseDate: { $gte: start, $lte: end },
      })
        .select('allocationScope adGroupId adGroupName parentUserId parentPhone normalizedParentPhone amount')
        .lean(),
      this.adCostModel.aggregate([
        { $match: { date: { $gte: start, $lte: end } } },
        {
          $group: {
            _id: '$adGroupId',
            totalSpend: { $sum: { $ifNull: ['$spend', 0] } },
            adGroupName: { $first: '$adGroupName' },
            platform: { $first: '$platform' },
          },
        },
      ]),
    ]);

    const studentIds = Array.from(new Set(
      sessions
        .map((session: any) => session.studentId?.toString?.())
        .filter((id: string | undefined): id is string => !!id && Types.ObjectId.isValid(id)),
    )).map((id) => new Types.ObjectId(id));
    const students = studentIds.length
      ? await this.studentModel.find({ _id: { $in: studentIds } })
        .select('_id parentUserId parentPhone parentName adGroupId adGroupName')
        .lean()
      : [];
    const studentMap = new Map<string, any>(
      students.map((student: any) => [student._id.toString(), student]),
    );

    const parentRows = new Map<string, ParentProfitabilityAccumulator>();
    const aliasMap = new Map<string, string>();
    const groupIds = new Set<string>();
    const groupMetaSeed = new Map<string, { name?: string; platform?: string }>();

    const registerAliases = (
      targetParentKey: string,
      parentUserId?: string | Types.ObjectId | null,
      parentPhone?: string | null,
    ) => {
      if (parentUserId) aliasMap.set(`user:${parentUserId.toString()}`, targetParentKey);
      const normalizedParentPhone = normalizePhone(parentPhone);
      if (normalizedParentPhone) aliasMap.set(`phone:${normalizedParentPhone}`, targetParentKey);
    };

    const resolveMappedParentKey = (
      parentUserId?: string | Types.ObjectId | null,
      parentPhone?: string | null,
    ): string | null => {
      if (parentUserId) {
        const mapped = aliasMap.get(`user:${parentUserId.toString()}`);
        if (mapped) return mapped;
      }
      const normalizedParentPhone = normalizePhone(parentPhone);
      if (normalizedParentPhone) {
        const mapped = aliasMap.get(`phone:${normalizedParentPhone}`);
        if (mapped) return mapped;
      }
      return buildParentKey(parentUserId, parentPhone);
    };

    for (const attribution of attributions as any[]) {
      const parentKey = attribution.parentKey
        || buildParentKey(attribution.parentUserId, attribution.parentPhone || attribution.normalizedParentPhone);
      if (!parentKey) continue;

      const row = ensureParentAccumulator(parentRows, parentKey);
      mergeParentIdentity(row, {
        parentUserId: attribution.parentUserId,
        parentPhone: attribution.parentPhone || attribution.normalizedParentPhone,
        adGroupId: attribution.adGroupId,
        adGroupName: attribution.adGroupName,
        platform: attribution.platform,
        attributedAt: attribution.firstAttributedAt,
      });
      registerAliases(parentKey, attribution.parentUserId, attribution.parentPhone || attribution.normalizedParentPhone);
      if (attribution.adGroupId) {
        const groupId = attribution.adGroupId.toString();
        groupIds.add(groupId);
        groupMetaSeed.set(groupId, {
          name: attribution.adGroupName,
          platform: attribution.platform,
        });
      }
    }

    for (const session of sessions as any[]) {
      const student = studentMap.get(session.studentId?.toString?.());
      const parentKey = resolveMappedParentKey(session.parentUserId || student?.parentUserId, student?.parentPhone);
      if (!parentKey) continue;

      const row = ensureParentAccumulator(parentRows, parentKey);
      mergeParentIdentity(row, {
        parentUserId: session.parentUserId || student?.parentUserId,
        parentPhone: student?.parentPhone,
        parentName: student?.parentName,
        adGroupId: student?.adGroupId || session.adGroupId,
        adGroupName: student?.adGroupName || session.adGroupName,
      });
      registerAliases(parentKey, session.parentUserId || student?.parentUserId, student?.parentPhone);

      if (student?._id) row.studentIds.add(student._id.toString());
      row.sessionCount += 1;
      row.revenue += Number(session.amountCharged || 0);
      row.teacherCost += Number(session.teacherPayout || 0);
      if (row.adGroupId) groupIds.add(row.adGroupId);
    }

    let totalGlobalExpense = 0;
    const groupExpenseMap = new Map<string, { amount: number; adGroupName?: string }>();
    for (const expense of expenses as any[]) {
      const amount = Number(expense.amount || 0);
      if (amount <= 0) continue;

      const allocationScope = expense.allocationScope || ExpenseAllocationScope.GLOBAL;
      if (allocationScope === ExpenseAllocationScope.PARENT) {
        const parentKey = resolveMappedParentKey(
          expense.parentUserId,
          expense.parentPhone || expense.normalizedParentPhone,
        );
        if (!parentKey) continue;

        const row = ensureParentAccumulator(parentRows, parentKey);
        mergeParentIdentity(row, {
          parentUserId: expense.parentUserId,
          parentPhone: expense.parentPhone || expense.normalizedParentPhone,
        });
        registerAliases(parentKey, expense.parentUserId, expense.parentPhone || expense.normalizedParentPhone);
        row.directParentExpense += amount;
        continue;
      }

      if (allocationScope === ExpenseAllocationScope.AD_GROUP && expense.adGroupId) {
        const groupId = expense.adGroupId.toString();
        const existing = groupExpenseMap.get(groupId) || { amount: 0, adGroupName: expense.adGroupName };
        existing.amount += amount;
        if (!existing.adGroupName && expense.adGroupName) existing.adGroupName = expense.adGroupName;
        groupExpenseMap.set(groupId, existing);
        groupIds.add(groupId);
        if (expense.adGroupName) groupMetaSeed.set(groupId, { name: expense.adGroupName });
        continue;
      }

      totalGlobalExpense += amount;
    }

    for (const cost of adCosts as any[]) {
      const groupId = cost._id?.toString?.();
      if (!groupId) continue;
      groupIds.add(groupId);
      groupMetaSeed.set(groupId, {
        name: cost.adGroupName || groupMetaSeed.get(groupId)?.name,
        platform: cost.platform || groupMetaSeed.get(groupId)?.platform,
      });
    }

    const groupObjectIds = Array.from(groupIds)
      .filter((id) => Types.ObjectId.isValid(id))
      .map((id) => new Types.ObjectId(id));
    const adGroups = groupObjectIds.length
      ? await this.adGroupModel.find({ _id: { $in: groupObjectIds } }).select('_id name platform').lean()
      : [];
    const adGroupMetaMap = new Map<string, { name?: string; platform?: string }>(
      adGroups.map((group: any) => [
        group._id.toString(),
        {
          name: group.name || groupMetaSeed.get(group._id.toString())?.name,
          platform: group.platform || groupMetaSeed.get(group._id.toString())?.platform,
        },
      ]),
    );

    for (const [groupId, seed] of groupMetaSeed.entries()) {
      if (!adGroupMetaMap.has(groupId)) {
        adGroupMetaMap.set(groupId, seed);
      }
    }

    const rawRows = Array.from(parentRows.values());
    for (const row of rawRows) {
      if (row.adGroupId) {
        const meta = adGroupMetaMap.get(row.adGroupId);
        if (meta?.name && (!row.adGroupName || row.adGroupName === 'UNATTRIBUTED')) row.adGroupName = meta.name;
        if (meta?.platform && !row.platform) row.platform = meta.platform;
      }
    }

    allocateSharedAmount(rawRows, totalGlobalExpense, 'allocatedGlobalOverhead');

    const rowsByGroup = new Map<string, ParentProfitabilityAccumulator[]>();
    for (const row of rawRows) {
      const groupKey = row.adGroupId || '__UNATTRIBUTED__';
      if (!rowsByGroup.has(groupKey)) rowsByGroup.set(groupKey, []);
      rowsByGroup.get(groupKey)!.push(row);
    }

    for (const [groupId, expenseData] of groupExpenseMap.entries()) {
      allocateSharedAmount(rowsByGroup.get(groupId) || [], expenseData.amount, 'allocatedGroupExpense');
    }
    for (const cost of adCosts as any[]) {
      const groupId = cost._id?.toString?.();
      if (!groupId) continue;
      allocateSharedAmount(
        rowsByGroup.get(groupId) || [],
        Number(cost.totalSpend || 0),
        'allocatedAdSpend',
      );
    }

    const rows: ParentProfitabilityRow[] = rawRows
      .map((row) => {
        const revenue = roundCurrency(row.revenue);
        const teacherCost = roundCurrency(row.teacherCost);
        const directParentExpense = roundCurrency(row.directParentExpense);
        const allocatedGroupExpense = roundCurrency(row.allocatedGroupExpense);
        const allocatedGlobalOverhead = roundCurrency(row.allocatedGlobalOverhead);
        const allocatedAdSpend = roundCurrency(row.allocatedAdSpend);
        const netProfit = roundCurrency(
          revenue
          - teacherCost
          - directParentExpense
          - allocatedGroupExpense
          - allocatedGlobalOverhead
          - allocatedAdSpend,
        );

        return {
          parentKey: row.parentKey,
          parentUserId: row.parentUserId,
          parentPhone: row.parentPhone,
          normalizedParentPhone: row.normalizedParentPhone,
          parentName: row.parentName,
          adGroupId: row.adGroupId || '',
          adGroupName: row.adGroupName || 'UNATTRIBUTED',
          platform: row.platform || adGroupMetaMap.get(row.adGroupId)?.platform || '',
          attributedAt: row.attributedAt?.toISOString(),
          sessionCount: row.sessionCount,
          studentCount: row.studentIds.size,
          revenue,
          teacherCost,
          directParentExpense,
          allocatedGroupExpense,
          allocatedGlobalOverhead,
          allocatedAdSpend,
          netProfit,
          netMargin: revenue > 0 ? roundCurrency((netProfit / revenue) * 100) : 0,
        };
      })
      .filter((row) => {
        if (adGroupObjectId && row.adGroupId !== adGroupObjectId.toString()) return false;
        if (platform && row.platform !== platform) return false;
        return (
          row.sessionCount > 0
          || row.revenue > 0
          || row.teacherCost > 0
          || row.directParentExpense > 0
          || row.allocatedGroupExpense > 0
          || row.allocatedGlobalOverhead > 0
          || row.allocatedAdSpend > 0
          || !!row.attributedAt
        );
      })
      .sort((a, b) => b.netProfit - a.netProfit || b.revenue - a.revenue || a.parentKey.localeCompare(b.parentKey));

    const summaryByGroupMap = new Map<string, any>();
    for (const row of rows) {
      const groupKey = row.adGroupId || '__UNATTRIBUTED__';
      if (!summaryByGroupMap.has(groupKey)) {
        summaryByGroupMap.set(groupKey, {
          adGroupId: row.adGroupId,
          adGroupName: row.adGroupName || 'UNATTRIBUTED',
          platform: row.platform,
          parentCount: 0,
          totalSessions: 0,
          totalStudents: 0,
          totalRevenue: 0,
          totalTeacherCost: 0,
          totalDirectParentExpense: 0,
          totalAllocatedGroupExpense: 0,
          totalAllocatedGlobalOverhead: 0,
          totalAdSpend: 0,
          totalNetProfit: 0,
        });
      }
      const summary = summaryByGroupMap.get(groupKey);
      summary.parentCount += 1;
      summary.totalSessions += row.sessionCount;
      summary.totalStudents += row.studentCount;
      summary.totalRevenue += row.revenue;
      summary.totalTeacherCost += row.teacherCost;
      summary.totalDirectParentExpense += row.directParentExpense;
      summary.totalAllocatedGroupExpense += row.allocatedGroupExpense;
      summary.totalAllocatedGlobalOverhead += row.allocatedGlobalOverhead;
      summary.totalAdSpend += row.allocatedAdSpend;
      summary.totalNetProfit += row.netProfit;
    }

    const summaryByGroup = Array.from(summaryByGroupMap.values())
      .map((summary) => ({
        ...summary,
        totalRevenue: roundCurrency(summary.totalRevenue),
        totalTeacherCost: roundCurrency(summary.totalTeacherCost),
        totalDirectParentExpense: roundCurrency(summary.totalDirectParentExpense),
        totalAllocatedGroupExpense: roundCurrency(summary.totalAllocatedGroupExpense),
        totalAllocatedGlobalOverhead: roundCurrency(summary.totalAllocatedGlobalOverhead),
        totalAdSpend: roundCurrency(summary.totalAdSpend),
        totalNetProfit: roundCurrency(summary.totalNetProfit),
        netMargin: summary.totalRevenue > 0
          ? roundCurrency((summary.totalNetProfit / summary.totalRevenue) * 100)
          : 0,
      }))
      .sort((a, b) => b.totalNetProfit - a.totalNetProfit || b.totalRevenue - a.totalRevenue);

    const overall = {
      parentCount: rows.length,
      totalSessions: rows.reduce((sum, row) => sum + row.sessionCount, 0),
      totalStudents: rows.reduce((sum, row) => sum + row.studentCount, 0),
      totalRevenue: roundCurrency(rows.reduce((sum, row) => sum + row.revenue, 0)),
      totalTeacherCost: roundCurrency(rows.reduce((sum, row) => sum + row.teacherCost, 0)),
      totalDirectParentExpense: roundCurrency(rows.reduce((sum, row) => sum + row.directParentExpense, 0)),
      totalAllocatedGroupExpense: roundCurrency(rows.reduce((sum, row) => sum + row.allocatedGroupExpense, 0)),
      totalAllocatedGlobalOverhead: roundCurrency(rows.reduce((sum, row) => sum + row.allocatedGlobalOverhead, 0)),
      totalAdSpend: roundCurrency(rows.reduce((sum, row) => sum + row.allocatedAdSpend, 0)),
      totalNetProfit: roundCurrency(rows.reduce((sum, row) => sum + row.netProfit, 0)),
      netMargin: 0,
    };
    if (overall.totalRevenue > 0) {
      overall.netMargin = roundCurrency((overall.totalNetProfit / overall.totalRevenue) * 100);
    }

    return { rows, summaryByGroup, overall };
  }

  async getRealizedCohortAnalytics(
    startDate: string,
    endDate: string,
    adGroupId?: string,
    platform?: string,
    maturityDays?: number,
    refundRatePercentX?: number,
  ): Promise<any> {
    const { start, end } = getUtcDateRange(startDate, endDate, this.maxRealizedCohortRangeDays);
    return this.buildRealizedCohortAnalytics(start, end, {
      adGroupObjectId: parseOptionalObjectId(adGroupId),
      platform,
      maturityDays: normalizeMaturityDays(maturityDays),
      refundRatePercentX: normalizeRefundRatePercentX(refundRatePercentX),
    });
  }

  private async buildRealizedCohortAnalytics(
    start: Date,
    end: Date,
    options: {
      adGroupObjectId?: Types.ObjectId;
      platform?: string;
      maturityDays: number;
      refundRatePercentX: number | null;
    },
  ): Promise<{
    basis: string;
    maturityDays: number;
    realizedThrough: string;
    refundRatePercentX: number | null;
    rows: RealizedCohortRow[];
    matureRows: RealizedCohortRow[];
    summary: any;
  }> {
    const todayStart = normalizeToUtcDay(new Date());
    const todayEnd = new Date(todayStart);
    todayEnd.setUTCHours(23, 59, 59, 999);
    const realizedThrough = toUtcDateOnlyString(todayStart);
    const refundRatePercentX = normalizeRefundRatePercentX(options.refundRatePercentX);
    const refundRateOverride = refundRatePercentX !== null
      ? refundRatePercentX / 100
      : null;

    const attributionMatch: any = {
      adGroupId: { $exists: true, $ne: null },
      firstAttributedAt: { $gte: start, $lte: end },
    };
    if (options.adGroupObjectId) attributionMatch.adGroupId = options.adGroupObjectId;
    if (options.platform) attributionMatch.platform = options.platform;

    const attributions = await this.parentAttributionModel.find(attributionMatch)
      .select(
        'parentKey parentUserId parentPhone normalizedParentPhone adGroupId adGroupName platform firstAttributedAt',
      )
      .lean();

    const emptySummary = {
      totalSpend: 0,
      totalImpressions: 0,
      totalClicks: 0,
      totalConversions: 0,
      totalLeads: 0,
      totalOrders: 0,
      totalNewParents: 0,
      totalCollectedRevenue: 0,
      totalRemainingSessionUnits: 0,
      totalRealizedParents: 0,
      totalRealizedSessions: 0,
      totalRealizedRevenue: 0,
      totalRefundAmount: 0,
      totalNetRealizedRevenue: 0,
      totalProjectedRevenue: 0,
      totalTeacherCost: 0,
      totalDirectParentExpense: 0,
      totalAllocatedGroupExpense: 0,
      totalAllocatedGlobalOverhead: 0,
      totalNetProfit: 0,
      totalProjectedNetProfit: 0,
      totalRoi: 0,
      matureRowCount: 0,
      immatureRowCount: 0,
    };

    if (!attributions.length) {
      return {
        basis: 'REALIZED_SESSION_DEDUCT_REFUND + PROJECTED_APPROVED_TUITION_CASH_WITH_SESSION_COSTS',
        maturityDays: options.maturityDays,
        realizedThrough,
        refundRatePercentX,
        rows: [],
        matureRows: [],
        summary: emptySummary,
      };
    }

    const parentRows = new Map<string, RealizedCohortParentAccumulator>();
    const aliasMap = new Map<string, string>();
    const newParentCountMap = new Map<string, number>();
    const groupIds = new Set<string>();
    let maxObservationEnd = new Date(start);

    const registerAliases = (
      parentKey: string,
      parentUserId?: string | Types.ObjectId | null,
      parentPhone?: string | null,
    ) => {
      if (parentUserId) aliasMap.set(`user:${parentUserId.toString()}`, parentKey);
      const normalizedParentPhone = normalizePhone(parentPhone);
      if (normalizedParentPhone) aliasMap.set(`phone:${normalizedParentPhone}`, parentKey);
    };

    const resolveMappedParentKey = (
      parentUserId?: string | Types.ObjectId | null,
      parentPhone?: string | null,
    ): string | null => {
      if (parentUserId) {
        const mapped = aliasMap.get(`user:${parentUserId.toString()}`);
        if (mapped) return mapped;
      }
      const normalizedParentPhone = normalizePhone(parentPhone);
      if (normalizedParentPhone) {
        const mapped = aliasMap.get(`phone:${normalizedParentPhone}`);
        if (mapped) return mapped;
      }
      return buildParentKey(parentUserId, parentPhone);
    };

    for (const attribution of attributions as any[]) {
      const parentKey = attribution.parentKey
        || buildParentKey(attribution.parentUserId, attribution.parentPhone || attribution.normalizedParentPhone);
      const adGroupIdValue = attribution.adGroupId?.toString?.();
      if (!parentKey || !adGroupIdValue) continue;

      const attributedAt = new Date(attribution.firstAttributedAt);
      const cohortStart = normalizeToUtcDay(attributedAt);
      const cohortDate = toUtcDateOnlyString(cohortStart);
      const maturityEndDay = addUtcDays(cohortStart, options.maturityDays - 1);
      const cappedEndDay = maturityEndDay > todayStart ? todayStart : maturityEndDay;
      const observationEnd = new Date(cappedEndDay);
      observationEnd.setUTCHours(23, 59, 59, 999);
      const cohortAgeDays = Math.max(
        1,
        Math.floor((todayStart.getTime() - cohortStart.getTime()) / 86400000) + 1,
      );

      ensureRealizedCohortAccumulator(parentRows, {
        parentKey,
        adGroupId: attribution.adGroupId,
        adGroupName: attribution.adGroupName,
        platform: attribution.platform,
        attributedAt,
        cohortDate,
        cohortStart,
        observationEnd,
        cohortAgeDays,
        isMatured: cohortAgeDays >= options.maturityDays,
        parentUserId: attribution.parentUserId,
        parentPhone: attribution.parentPhone || attribution.normalizedParentPhone,
      });

      const cohortKey = groupDayKey(adGroupIdValue, cohortDate);
      newParentCountMap.set(cohortKey, (newParentCountMap.get(cohortKey) || 0) + 1);
      groupIds.add(adGroupIdValue);
      registerAliases(parentKey, attribution.parentUserId, attribution.parentPhone || attribution.normalizedParentPhone);
      if (observationEnd > maxObservationEnd) maxObservationEnd = observationEnd;
    }

    const leadMatch: any = {
      adGroupId: { $exists: true, $ne: null },
      createdAt: { $gte: start, $lte: end },
    };
    const orderMatch: any = {
      adGroupId: { $exists: true, $ne: null },
      createdAt: { $gte: start, $lte: end },
      status: { $in: ['APPROVED', 'COMPLETED'] },
    };
    const adCostMatch: any = { date: { $gte: start, $lte: end } };
    if (options.adGroupObjectId) {
      leadMatch.adGroupId = options.adGroupObjectId;
      orderMatch.adGroupId = options.adGroupObjectId;
      adCostMatch.adGroupId = options.adGroupObjectId;
    }
    if (options.platform) {
      leadMatch.source = options.platform;
      orderMatch.leadSource = options.platform;
      adCostMatch.platform = options.platform;
    }

    const [leadRows, orderRows, adCostRows, invoiceRows, ledgerEntries, expenses] = await Promise.all([
      this.leadModel.aggregate([
        { $match: leadMatch },
        {
          $group: {
            _id: {
              adGroupId: '$adGroupId',
              date: {
                $dateToString: {
                  format: '%Y-%m-%d',
                  date: '$createdAt',
                  timezone: 'UTC',
                },
              },
            },
            leadCount: { $sum: 1 },
          },
        },
      ]),
      this.orderModel.aggregate([
        { $match: orderMatch },
        {
          $group: {
            _id: {
              adGroupId: '$adGroupId',
              date: {
                $dateToString: {
                  format: '%Y-%m-%d',
                  date: '$createdAt',
                  timezone: 'UTC',
                },
              },
            },
            orderCount: { $sum: 1 },
          },
        },
      ]),
      this.adCostModel.aggregate([
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
            adGroupName: { $first: '$adGroupName' },
            platform: { $first: '$platform' },
            spend: { $sum: { $ifNull: ['$spend', 0] } },
            impressions: { $sum: { $ifNull: ['$impressions', 0] } },
            clicks: { $sum: { $ifNull: ['$clicks', 0] } },
            conversions: { $sum: { $ifNull: ['$conversions', 0] } },
          },
        },
      ]),
      this.invoiceModel.find({
        invoiceType: InvoiceType.TUITION,
        status: { $in: [InvoiceStatus.APPROVED, InvoiceStatus.PAID] },
        paymentDate: { $gte: start, $lte: maxObservationEnd },
        studentId: { $exists: true, $ne: null },
      })
        .select('studentId amount paymentDate sessions sessionsRemaining pricePerSession')
        .lean(),
      this.ledgerEntryModel.find({
        type: { $in: [TransactionType.SESSION_DEDUCT, TransactionType.REFUND] },
        status: { $in: [TransactionStatus.COMPLETED, TransactionStatus.APPROVED] },
        createdAt: { $gte: start, $lte: maxObservationEnd },
        sessionId: { $exists: true, $ne: null },
      })
        .select('sessionId studentId userId type amount createdAt')
        .lean(),
      this.expenseModel.find({
        paymentStatus: { $in: [PaymentStatus.PAID, PaymentStatus.APPROVED_UNPAID] },
        expenseDate: { $gte: start, $lte: maxObservationEnd },
      })
        .select('allocationScope adGroupId parentUserId parentPhone normalizedParentPhone amount expenseDate')
        .lean(),
    ]);

    const sessionIds = Array.from(new Set(
      (ledgerEntries as any[])
        .map((entry) => entry.sessionId?.toString?.())
        .filter((id: string | undefined): id is string => !!id && Types.ObjectId.isValid(id)),
    )).map((id) => new Types.ObjectId(id));

    const sessions = sessionIds.length
      ? await this.sessionModel.find({ _id: { $in: sessionIds } })
        .select('_id studentId parentUserId adGroupId adGroupName teacherPayout amountCharged')
        .lean()
      : [];

    const studentIds = Array.from(new Set(
      [
        ...(sessions as any[]).map((session) => session.studentId?.toString?.()),
        ...(invoiceRows as any[]).map((invoice) => invoice.studentId?.toString?.()),
      ]
        .filter((id: string | undefined): id is string => !!id && Types.ObjectId.isValid(id)),
    )).map((id) => new Types.ObjectId(id));

    const students = studentIds.length
      ? await this.studentModel.find({ _id: { $in: studentIds } })
        .select('_id parentUserId parentPhone parentName adGroupId adGroupName')
        .lean()
      : [];

    const sessionMap = new Map<string, any>(sessions.map((session: any) => [session._id.toString(), session]));
    const studentMap = new Map<string, any>(students.map((student: any) => [student._id.toString(), student]));
    const futureSessions = studentIds.length
      ? await this.sessionModel.find({
        studentId: { $in: studentIds },
        scheduledDate: { $gt: todayEnd },
        status: {
          $in: [
            SessionStatus.SCHEDULED,
            SessionStatus.TEACHER_COMPLETED,
            SessionStatus.PARENT_CONFIRMED,
          ],
        },
      })
        .select('studentId parentUserId adGroupId adGroupName scheduledDate teacherPayout')
        .lean()
      : [];

    for (const entry of ledgerEntries as any[]) {
      const sessionId = entry.sessionId?.toString?.();
      if (!sessionId) continue;
      const session = sessionMap.get(sessionId);
      if (!session) continue;
      const student = studentMap.get(session.studentId?.toString?.());
      const parentKey = resolveMappedParentKey(
        entry.userId || session.parentUserId || student?.parentUserId,
        student?.parentPhone,
      );
      if (!parentKey) continue;

      const row = parentRows.get(parentKey);
      if (!row) continue;
      if (!isDateWithinInclusiveRange(entry.createdAt, row.cohortStart, row.observationEnd)) continue;

      if (session.parentUserId && !row.parentUserId) row.parentUserId = session.parentUserId.toString();
      if (student?.parentPhone && !row.parentPhone) row.parentPhone = student.parentPhone;
      if (student?.parentPhone && !row.normalizedParentPhone) row.normalizedParentPhone = normalizePhone(student.parentPhone);
      if (student?.parentName && !row.parentName) row.parentName = student.parentName;
      if (student?._id) row.studentIds.add(student._id.toString());
      if (session.adGroupId && !row.adGroupId) row.adGroupId = session.adGroupId.toString();
      if (session.adGroupName && (!row.adGroupName || row.adGroupName === 'UNATTRIBUTED')) {
        row.adGroupName = session.adGroupName;
      }
      if (student?.adGroupId && !row.adGroupId) row.adGroupId = student.adGroupId.toString();
      if (student?.adGroupName && (!row.adGroupName || row.adGroupName === 'UNATTRIBUTED')) {
        row.adGroupName = student.adGroupName;
      }

      registerAliases(parentKey, entry.userId || session.parentUserId || student?.parentUserId, student?.parentPhone);

      const amount = Number(entry.amount || 0);
      if (entry.type === TransactionType.SESSION_DEDUCT) {
        row.revenue += amount;
        if (!row.realizedSessionIds.has(sessionId)) {
          row.realizedSessionIds.add(sessionId);
          row.sessionCount += 1;
          row.teacherCost += Number(session.teacherPayout || 0);
        }
      } else if (entry.type === TransactionType.REFUND) {
        row.refundAmount += amount;
      }
    }

    for (const invoice of invoiceRows as any[]) {
      const student = studentMap.get(invoice.studentId?.toString?.());
      if (!student) continue;

      const parentKey = resolveMappedParentKey(
        student.parentUserId,
        student.parentPhone,
      );
      if (!parentKey) continue;

      const row = parentRows.get(parentKey);
      if (!row) continue;
      if (!isDateWithinInclusiveRange(invoice.paymentDate, row.cohortStart, row.observationEnd)) continue;

      registerAliases(parentKey, student.parentUserId, student.parentPhone);

      row.collectedRevenue += Number(invoice.amount || 0);
      row.remainingSessionUnits += Number(invoice.sessionsRemaining || 0);
      if (student.parentUserId && !row.parentUserId) row.parentUserId = student.parentUserId.toString();
      if (student.parentPhone && !row.parentPhone) row.parentPhone = student.parentPhone;
      if (student.parentPhone && !row.normalizedParentPhone) {
        row.normalizedParentPhone = normalizePhone(student.parentPhone);
      }
      if (student.parentName && !row.parentName) row.parentName = student.parentName;
      if (student._id) row.studentIds.add(student._id.toString());
      if (student.adGroupId && !row.adGroupId) row.adGroupId = student.adGroupId.toString();
      if (student.adGroupName && (!row.adGroupName || row.adGroupName === 'UNATTRIBUTED')) {
        row.adGroupName = student.adGroupName;
      }
    }

    for (const session of futureSessions as any[]) {
      const student = studentMap.get(session.studentId?.toString?.());
      if (!student) continue;

      const parentKey = resolveMappedParentKey(
        session.parentUserId || student.parentUserId,
        student.parentPhone,
      );
      if (!parentKey) continue;

      const row = parentRows.get(parentKey);
      if (!row) continue;

      registerAliases(parentKey, session.parentUserId || student.parentUserId, student.parentPhone);

      row.scheduledRemainingSessionCount += 1;
      row.scheduledRemainingTeacherCost += Number(session.teacherPayout || 0);
      if (student.parentUserId && !row.parentUserId) row.parentUserId = student.parentUserId.toString();
      if (student.parentPhone && !row.parentPhone) row.parentPhone = student.parentPhone;
      if (student.parentPhone && !row.normalizedParentPhone) {
        row.normalizedParentPhone = normalizePhone(student.parentPhone);
      }
      if (student.parentName && !row.parentName) row.parentName = student.parentName;
      if (student._id) row.studentIds.add(student._id.toString());
      if (session.adGroupId && !row.adGroupId) row.adGroupId = session.adGroupId.toString();
      if (session.adGroupName && (!row.adGroupName || row.adGroupName === 'UNATTRIBUTED')) {
        row.adGroupName = session.adGroupName;
      }
      if (student.adGroupId && !row.adGroupId) row.adGroupId = student.adGroupId.toString();
      if (student.adGroupName && (!row.adGroupName || row.adGroupName === 'UNATTRIBUTED')) {
        row.adGroupName = student.adGroupName;
      }
    }

    const rawParentRows = Array.from(parentRows.values());
    const rowsByCohort = new Map<string, RealizedCohortParentAccumulator[]>();
    for (const row of rawParentRows) {
      if (!row.adGroupId) continue;
      const cohortKey = groupDayKey(row.adGroupId, row.cohortDate);
      if (!rowsByCohort.has(cohortKey)) rowsByCohort.set(cohortKey, []);
      rowsByCohort.get(cohortKey)!.push(row);
      groupIds.add(row.adGroupId);
    }

    const groupExpenseItems: Array<{ adGroupId: string; amount: number; expenseDate: Date }> = [];
    const globalExpenseItems: Array<{ amount: number; expenseDate: Date }> = [];

    for (const expense of expenses as any[]) {
      const scope = expense.allocationScope || ExpenseAllocationScope.GLOBAL;
      const amount = Number(expense.amount || 0);
      if (amount <= 0) continue;

      if (scope === ExpenseAllocationScope.PARENT) {
        const parentKey = resolveMappedParentKey(
          expense.parentUserId,
          expense.parentPhone || expense.normalizedParentPhone,
        );
        if (!parentKey) continue;
        const row = parentRows.get(parentKey);
        if (!row) continue;
        if (!isDateWithinInclusiveRange(expense.expenseDate, row.cohortStart, row.observationEnd)) continue;
        row.directParentExpense += amount;
        continue;
      }

      if (scope === ExpenseAllocationScope.AD_GROUP && expense.adGroupId) {
        groupExpenseItems.push({
          adGroupId: expense.adGroupId.toString(),
          amount,
          expenseDate: expense.expenseDate,
        });
        continue;
      }

      globalExpenseItems.push({ amount, expenseDate: expense.expenseDate });
    }

    for (const item of groupExpenseItems) {
      const eligibleRows = rawParentRows.filter((row) => (
        row.adGroupId === item.adGroupId
        && isDateWithinInclusiveRange(item.expenseDate, row.cohortStart, row.observationEnd)
      ));
      allocateSharedAmount(eligibleRows, item.amount, 'allocatedGroupExpense');
    }

    for (const item of globalExpenseItems) {
      const eligibleRows = rawParentRows.filter((row) => (
        isDateWithinInclusiveRange(item.expenseDate, row.cohortStart, row.observationEnd)
      ));
      allocateSharedAmount(eligibleRows, item.amount, 'allocatedGlobalOverhead');
    }

    const adCostMap = new Map<string, any>();
    for (const cost of adCostRows as any[]) {
      const groupId = cost._id?.adGroupId?.toString?.();
      const date = String(cost._id?.date || '');
      if (!groupId || !date) continue;
      const cohortKey = groupDayKey(groupId, date);
      adCostMap.set(cohortKey, cost);
      allocateSharedAmount(rowsByCohort.get(cohortKey) || [], Number(cost.spend || 0), 'allocatedAdSpend');
      groupIds.add(groupId);
    }

    const leadCountMap = new Map<string, number>();
    for (const lead of leadRows as any[]) {
      const groupId = lead._id?.adGroupId?.toString?.();
      const date = String(lead._id?.date || '');
      if (!groupId || !date) continue;
      leadCountMap.set(groupDayKey(groupId, date), Number(lead.leadCount || 0));
      groupIds.add(groupId);
    }

    const orderCountMap = new Map<string, number>();
    for (const order of orderRows as any[]) {
      const groupId = order._id?.adGroupId?.toString?.();
      const date = String(order._id?.date || '');
      if (!groupId || !date) continue;
      orderCountMap.set(groupDayKey(groupId, date), Number(order.orderCount || 0));
      groupIds.add(groupId);
    }

    const groupObjectIds = Array.from(groupIds)
      .filter((id) => Types.ObjectId.isValid(id))
      .map((id) => new Types.ObjectId(id));
    const adGroups = groupObjectIds.length
      ? await this.adGroupModel.find({ _id: { $in: groupObjectIds } }).select('_id name platform').lean()
      : [];
    const groupMetaMap = new Map<string, { name?: string; platform?: string }>(
      adGroups.map((group: any) => [group._id.toString(), { name: group.name, platform: group.platform }]),
    );

    const cohortPerformanceMap = new Map<string, any>();
    for (const row of rawParentRows) {
      if (!row.adGroupId) continue;
      const cohortKey = groupDayKey(row.adGroupId, row.cohortDate);
      if (!cohortPerformanceMap.has(cohortKey)) {
          cohortPerformanceMap.set(cohortKey, {
            date: row.cohortDate,
            cohortAgeDays: row.cohortAgeDays,
            isMatured: row.isMatured,
            adGroupId: row.adGroupId,
            adGroupName: row.adGroupName,
            platform: row.platform,
            collectedRevenue: 0,
            remainingSessionUnits: 0,
            scheduledRemainingSessionCount: 0,
            scheduledRemainingTeacherCost: 0,
            realizedRevenue: 0,
            refundAmount: 0,
            teacherCost: 0,
            directParentExpense: 0,
            allocatedGroupExpense: 0,
          allocatedGlobalOverhead: 0,
          newParentCount: 0,
          realizedParentCount: 0,
          realizedSessionCount: 0,
        });
      }

      const cohort = cohortPerformanceMap.get(cohortKey);
      cohort.collectedRevenue += row.collectedRevenue;
      cohort.remainingSessionUnits += row.remainingSessionUnits;
      cohort.scheduledRemainingSessionCount += row.scheduledRemainingSessionCount;
      cohort.scheduledRemainingTeacherCost += row.scheduledRemainingTeacherCost;
      cohort.realizedRevenue += row.revenue;
      cohort.refundAmount += row.refundAmount;
      cohort.teacherCost += row.teacherCost;
      cohort.directParentExpense += row.directParentExpense;
      cohort.allocatedGroupExpense += row.allocatedGroupExpense;
      cohort.allocatedGlobalOverhead += row.allocatedGlobalOverhead;
      cohort.newParentCount += 1;
      cohort.realizedSessionCount += row.sessionCount;
      if (row.revenue > 0 || row.refundAmount > 0 || row.sessionCount > 0) {
        cohort.realizedParentCount += 1;
      }
    }

    const allKeys = new Set<string>([
      ...Array.from(newParentCountMap.keys()),
      ...Array.from(leadCountMap.keys()),
      ...Array.from(orderCountMap.keys()),
      ...Array.from(adCostMap.keys()),
      ...Array.from(cohortPerformanceMap.keys()),
    ]);

    const rawRows: RealizedCohortRow[] = Array.from(allKeys)
      .map((key) => {
        const { adGroupId, date } = splitGroupDayKey(key);
        if (!adGroupId || !date) return null;

        const performance = cohortPerformanceMap.get(key);
        const adCost = adCostMap.get(key);
        const adMeta = groupMetaMap.get(adGroupId);
        const adSpend = Number(adCost?.spend || 0);
        const leadCount = Number(leadCountMap.get(key) || 0);
        const orderCount = Number(orderCountMap.get(key) || 0);
        const newParentCount = Number(newParentCountMap.get(key) || performance?.newParentCount || 0);
        const collectedRevenue = roundCurrency(Number(performance?.collectedRevenue || 0));
        const remainingSessionUnits = roundCurrency(Number(performance?.remainingSessionUnits || 0));
        const scheduledRemainingSessionCount = Number(performance?.scheduledRemainingSessionCount || 0);
        const scheduledRemainingTeacherCost = roundCurrency(Number(performance?.scheduledRemainingTeacherCost || 0));
        const realizedRevenue = roundCurrency(Number(performance?.realizedRevenue || 0));
        const refundAmount = roundCurrency(Number(performance?.refundAmount || 0));
        const teacherCost = roundCurrency(Number(performance?.teacherCost || 0));
        const directParentExpense = roundCurrency(Number(performance?.directParentExpense || 0));
        const allocatedGroupExpense = roundCurrency(Number(performance?.allocatedGroupExpense || 0));
        const allocatedGlobalOverhead = roundCurrency(Number(performance?.allocatedGlobalOverhead || 0));
        const netRealizedRevenue = roundCurrency(realizedRevenue - refundAmount);
        const netProfit = roundCurrency(
          netRealizedRevenue
          - teacherCost
          - directParentExpense
          - allocatedGroupExpense
          - allocatedGlobalOverhead
          - adSpend,
        );
        const impressions = Number(adCost?.impressions || 0);
        const clicks = Number(adCost?.clicks || 0);
        const conversions = Number(adCost?.conversions || 0);
        const cohortDate = normalizeToUtcDay(date);
        const cohortAgeDays = performance?.cohortAgeDays
          || Math.max(1, Math.floor((todayStart.getTime() - cohortDate.getTime()) / 86400000) + 1);
        const isMatured = Boolean(performance?.isMatured ?? (cohortAgeDays >= options.maturityDays));

        return {
          date,
          realizedThrough,
          maturityDays: options.maturityDays,
          cohortAgeDays,
          isMatured,
          adGroupId,
          adGroupName: performance?.adGroupName || adCost?.adGroupName || adMeta?.name || '',
          platform: performance?.platform || adCost?.platform || adMeta?.platform || '',
          impressions,
          clicks,
          conversions,
          ctr: impressions > 0 ? roundCurrency((clicks / impressions) * 100) : 0,
          cpc: clicks > 0 ? roundCurrency(adSpend / clicks) : null,
          cpm: impressions > 0 ? roundCurrency((adSpend / impressions) * 1000) : null,
          costPerConversion: conversions > 0 ? roundCurrency(adSpend / conversions) : null,
          leadCount,
          orderCount,
          newParentCount,
          realizedParentCount: Number(performance?.realizedParentCount || 0),
          realizedSessionCount: Number(performance?.realizedSessionCount || 0),
          adSpend: roundCurrency(adSpend),
          collectedRevenue,
          remainingSessionUnits,
          scheduledRemainingSessionCount,
          scheduledRemainingTeacherCost,
          realizedRevenue,
          refundAmount,
          netRealizedRevenue,
          estimatedRemainingRefund: 0,
          estimatedRemainingTeacherCost: 0,
          estimatedRemainingOtherCost: 0,
          projectedRevenue: netRealizedRevenue,
          projectedNetProfit: netProfit,
          effectiveNetProfit: netProfit,
          projectionBasis: 'ACTUAL_ONLY',
          teacherCost,
          directParentExpense,
          allocatedGroupExpense,
          allocatedGlobalOverhead,
          netProfit,
          roi: adSpend > 0 ? roundCurrency((netProfit / adSpend) * 100) : 0,
          costPerLead: leadCount > 0 ? roundCurrency(adSpend / leadCount) : null,
          costPerNewParent: newParentCount > 0 ? roundCurrency(adSpend / newParentCount) : null,
          profitPerLead: leadCount > 0 ? roundCurrency(netProfit / leadCount) : null,
          profitPerNewParent: newParentCount > 0 ? roundCurrency(netProfit / newParentCount) : null,
        };
      })
      .filter((row): row is RealizedCohortRow => row !== null)
      .sort((a, b) => a.date.localeCompare(b.date) || a.adGroupName.localeCompare(b.adGroupName));

    const rawMatureRows = rawRows.filter((row) => row.isMatured);
    const rowsWithActualService = rawRows.filter((row) => row.realizedRevenue > 0);
    const matureRowsWithActualService = rawMatureRows.filter((row) => row.realizedRevenue > 0);
    const profitProfiles = {
      groupMature: buildProfitProjectionProfileMap(matureRowsWithActualService, (row) => row.adGroupId),
      platformMature: buildProfitProjectionProfileMap(matureRowsWithActualService, (row) => row.platform),
      overallMature: buildProfitProjectionProfile(matureRowsWithActualService),
      groupLive: buildProfitProjectionProfileMap(rowsWithActualService, (row) => row.adGroupId),
      platformLive: buildProfitProjectionProfileMap(rowsWithActualService, (row) => row.platform),
      overallLive: buildProfitProjectionProfile(rowsWithActualService),
    };

    const rows = rawRows.map((row) => {
      const projection = resolveProfitProjection(row, profitProfiles);
      const deferredRevenue = roundCurrency(Math.max(0, row.collectedRevenue - row.realizedRevenue));
      const remainingSessionUnits = roundCurrency(Math.max(0, row.remainingSessionUnits || 0));
      const scheduledRemainingSessionUnits = roundCurrency(
        Math.min(remainingSessionUnits, Math.max(0, row.scheduledRemainingSessionCount || 0)),
      );
      const unscheduledRemainingSessionUnits = roundCurrency(
        Math.max(0, remainingSessionUnits - scheduledRemainingSessionUnits),
      );
      const remainingRefundRate = refundRateOverride ?? projection?.profile.refundRate ?? 0;
      const estimatedRemainingRefund = (!row.isMatured && deferredRevenue > 0)
        ? roundCurrency(deferredRevenue * remainingRefundRate)
        : 0;
      const estimatedRemainingTeacherCost = (!row.isMatured && deferredRevenue > 0 && projection)
        ? remainingSessionUnits > 0
          ? roundCurrency(
            row.scheduledRemainingTeacherCost
            + (
              projection.profile.teacherCostPerSession !== null
                ? (unscheduledRemainingSessionUnits * projection.profile.teacherCostPerSession)
                : (unscheduledRemainingSessionUnits > 0
                  ? ((unscheduledRemainingSessionUnits / Math.max(remainingSessionUnits, 1))
                    * deferredRevenue
                    * projection.profile.teacherCostRate)
                  : 0)
            ),
          )
          : roundCurrency(deferredRevenue * projection.profile.teacherCostRate)
        : 0;
      const estimatedRemainingOtherCost = (!row.isMatured && deferredRevenue > 0 && projection)
        ? remainingSessionUnits > 0 && projection.profile.otherCostPerSession !== null
          ? roundCurrency(remainingSessionUnits * projection.profile.otherCostPerSession)
          : roundCurrency(deferredRevenue * projection.profile.otherCostRate)
        : 0;
      const projectedRevenue = (!row.isMatured && row.collectedRevenue > 0)
        ? roundCurrency(row.netRealizedRevenue + deferredRevenue - estimatedRemainingRefund)
        : row.netRealizedRevenue;
      const projectedNetProfit = (!row.isMatured && row.collectedRevenue > 0)
        ? roundCurrency(
          row.netProfit
          + deferredRevenue
          - estimatedRemainingRefund
          - estimatedRemainingTeacherCost
          - estimatedRemainingOtherCost,
        )
        : row.netProfit;
      return {
        ...row,
        estimatedRemainingRefund,
        estimatedRemainingTeacherCost,
        estimatedRemainingOtherCost,
        projectedRevenue,
        projectedNetProfit,
        effectiveNetProfit: (!row.isMatured && row.collectedRevenue > 0) ? projectedNetProfit : row.netProfit,
        projectionBasis: projection?.basis || 'ACTUAL_ONLY',
      };
    });
    const matureRows = rows.filter((row) => row.isMatured);

    const summary = {
      totalSpend: roundCurrency(rows.reduce((sum, row) => sum + row.adSpend, 0)),
      totalImpressions: rows.reduce((sum, row) => sum + row.impressions, 0),
      totalClicks: rows.reduce((sum, row) => sum + row.clicks, 0),
      totalConversions: rows.reduce((sum, row) => sum + row.conversions, 0),
      totalLeads: rows.reduce((sum, row) => sum + row.leadCount, 0),
      totalOrders: rows.reduce((sum, row) => sum + row.orderCount, 0),
      totalNewParents: rows.reduce((sum, row) => sum + row.newParentCount, 0),
      totalCollectedRevenue: roundCurrency(rows.reduce((sum, row) => sum + row.collectedRevenue, 0)),
      totalRemainingSessionUnits: roundCurrency(rows.reduce((sum, row) => sum + row.remainingSessionUnits, 0)),
      totalRealizedParents: rows.reduce((sum, row) => sum + row.realizedParentCount, 0),
      totalRealizedSessions: rows.reduce((sum, row) => sum + row.realizedSessionCount, 0),
      totalRealizedRevenue: roundCurrency(rows.reduce((sum, row) => sum + row.realizedRevenue, 0)),
      totalRefundAmount: roundCurrency(rows.reduce((sum, row) => sum + row.refundAmount, 0)),
      totalNetRealizedRevenue: roundCurrency(rows.reduce((sum, row) => sum + row.netRealizedRevenue, 0)),
      totalProjectedRevenue: roundCurrency(rows.reduce((sum, row) => sum + row.projectedRevenue, 0)),
      totalTeacherCost: roundCurrency(rows.reduce((sum, row) => sum + row.teacherCost, 0)),
      totalDirectParentExpense: roundCurrency(rows.reduce((sum, row) => sum + row.directParentExpense, 0)),
      totalAllocatedGroupExpense: roundCurrency(rows.reduce((sum, row) => sum + row.allocatedGroupExpense, 0)),
      totalAllocatedGlobalOverhead: roundCurrency(rows.reduce((sum, row) => sum + row.allocatedGlobalOverhead, 0)),
      totalNetProfit: roundCurrency(rows.reduce((sum, row) => sum + row.netProfit, 0)),
      totalProjectedNetProfit: roundCurrency(rows.reduce((sum, row) => sum + row.projectedNetProfit, 0)),
      totalRoi: 0,
      matureRowCount: matureRows.length,
      immatureRowCount: rows.length - matureRows.length,
    };
    if (summary.totalSpend > 0) {
      summary.totalRoi = roundCurrency((summary.totalNetProfit / summary.totalSpend) * 100);
    }

    return {
      basis: 'REALIZED_SESSION_DEDUCT_REFUND + PROJECTED_APPROVED_TUITION_CASH_WITH_SESSION_COSTS',
      maturityDays: options.maturityDays,
      realizedThrough,
      refundRatePercentX,
      rows,
      matureRows,
      summary,
    };
  }


  async getSuggestions(
    startDate: string,
    endDate: string,
    totalBudget: number,
    maturityDays?: number,
    refundRatePercentX?: number,
  ): Promise<any> {
    if (!Number.isFinite(totalBudget) || totalBudget < 0) {
      throw new BadRequestException('totalBudget must be a non-negative number');
    }

    const normalizedBudget = Math.round(totalBudget);
    const { start, end } = getUtcDateRange(startDate, endDate, this.maxSuggestionRangeDays);
    const normalizedMaturityDays = normalizeMaturityDays(maturityDays);
    const normalizedRefundRatePercentX = normalizeRefundRatePercentX(refundRatePercentX);
    const cohortAnalytics = await this.buildRealizedCohortAnalytics(start, end, {
      maturityDays: normalizedMaturityDays,
      refundRatePercentX: normalizedRefundRatePercentX,
    });
    const dailyRows = cohortAnalytics.rows;
    const maxDailyIncreaseFactor = 1.2; // cap: suggested spend <= previous-day spend * 120%

    if (!dailyRows.length) {
      return {
        basis: cohortAnalytics.basis,
        maturityDays: normalizedMaturityDays,
        realizedThrough: cohortAnalytics.realizedThrough,
        refundRatePercentX: normalizedRefundRatePercentX,
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
      rows: RealizedCohortRow[];
      points: Array<{ spend: number; netProfit: number }>;
      totalSpend: number;
      totalNetProfit: number;
      totalLeads: number;
      totalClicks: number;
      totalImpressions: number;
      latestSpend: number;
    }>();

    for (const row of dailyRows) {
      if (!groupData.has(row.adGroupId)) {
        groupData.set(row.adGroupId, {
          adGroupName: row.adGroupName,
          platform: row.platform,
          rows: [],
          points: [],
          totalSpend: 0,
          totalNetProfit: 0,
          totalLeads: 0,
          totalClicks: 0,
          totalImpressions: 0,
          latestSpend: 0,
        });
      }
      const target = groupData.get(row.adGroupId)!;
      target.rows.push(row);
      target.totalSpend += row.adSpend;
      target.totalNetProfit += row.effectiveNetProfit;
      target.totalLeads += row.leadCount;
      target.totalClicks += row.clicks;
      target.totalImpressions += row.impressions;
      target.latestSpend = row.adSpend;
      if (row.adSpend > 0 && (row.collectedRevenue > 0 || row.isMatured)) {
        target.points.push({ spend: row.adSpend, netProfit: row.effectiveNetProfit });
      }
    }

    const modelRows = dailyRows.filter((row) => row.adSpend > 0 && (row.collectedRevenue > 0 || row.isMatured));
    const overallCtr = modelRows.reduce((sum, row) => sum + row.clicks, 0) > 0
      ? roundCurrency(
        (modelRows.reduce((sum, row) => sum + row.clicks, 0)
          / Math.max(1, modelRows.reduce((sum, row) => sum + row.impressions, 0))) * 100,
      )
      : 0;
    const overallLeadRate = modelRows.reduce((sum, row) => sum + row.clicks, 0) > 0
      ? roundCurrency(
        (modelRows.reduce((sum, row) => sum + row.leadCount, 0)
          / Math.max(1, modelRows.reduce((sum, row) => sum + row.clicks, 0))) * 100,
      )
      : 0;
    const overallRoi = cohortAnalytics.summary.totalSpend > 0
      ? roundCurrency((cohortAnalytics.summary.totalProjectedNetProfit / cohortAnalytics.summary.totalSpend) * 100)
      : 0;

    const minPoints = 5;
    const suggestions: SuggestionModel[] = [];

    for (const [gId, data] of groupData) {
      const recentRows = [...data.rows]
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(-7);
      const currentAvgSpend = recentRows.length > 0
        ? Math.round(recentRows.reduce((sum, row) => sum + row.adSpend, 0) / recentRows.length)
        : 0;
      const groupCtr = data.totalImpressions > 0
        ? roundCurrency((data.totalClicks / data.totalImpressions) * 100)
        : 0;
      const groupLeadRate = data.totalClicks > 0
        ? roundCurrency((data.totalLeads / data.totalClicks) * 100)
        : 0;
      const averageProfitPerLead = data.totalLeads > 0
        ? roundCurrency(data.totalNetProfit / data.totalLeads)
        : null;
      const observedAverageNetProfit = data.rows.length > 0
        ? roundCurrency(data.totalNetProfit / data.rows.length)
        : 0;
      const groupRoi = data.totalSpend > 0
        ? roundCurrency((data.totalNetProfit / data.totalSpend) * 100)
        : 0;

      if (data.points.length < minPoints) {
        const guidance = buildSuggestionRecommendation({
          dataPoints: data.points.length,
          groupRoi,
          averageCtr: groupCtr,
          averageLeadRate: groupLeadRate,
          averageProfitPerLead,
          overallCtr,
          overallLeadRate,
          overallRoi,
          fitR2: 0,
        });
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
          maturityDays: normalizedMaturityDays,
          averageCtr: groupCtr,
          averageLeadRate: groupLeadRate,
          averageProfitPerLead,
          observedAverageNetProfit,
          recommendation: guidance.recommendation,
          recommendationReasons: guidance.reasons,
          coeffA: null,
          coeffB: null,
        });
        continue;
      }

      const fit = fitLogCurve(
        data.points.map((p) => p.spend),
        data.points.map((p) => p.netProfit),
      );
      const guidance = buildSuggestionRecommendation({
        dataPoints: data.points.length,
        groupRoi,
        averageCtr: groupCtr,
        averageLeadRate: groupLeadRate,
        averageProfitPerLead,
        overallCtr,
        overallLeadRate,
        overallRoi,
        fitR2: fit.rSquared,
      });

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
        maturityDays: normalizedMaturityDays,
        averageCtr: groupCtr,
        averageLeadRate: groupLeadRate,
        averageProfitPerLead,
        observedAverageNetProfit,
        recommendation: guidance.recommendation,
        recommendationReasons: guidance.reasons,
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

    const latestSpendByGroup = new Map<string, number>(
      Array.from(groupData.entries()).map(([gId, data]) => [gId, data.latestSpend]),
    );

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
          maturityDays: row.maturityDays,
          cohortAgeDays: row.cohortAgeDays,
          isMatured: row.isMatured,
          impressions: row.impressions,
          clicks: row.clicks,
          conversions: row.conversions,
          leadCount: row.leadCount,
          orderCount: row.orderCount,
          newParentCount: row.newParentCount,
          collectedRevenue: row.collectedRevenue,
          remainingSessionUnits: row.remainingSessionUnits,
          scheduledRemainingSessionCount: row.scheduledRemainingSessionCount,
          realizedRevenue: row.realizedRevenue,
          netRealizedRevenue: row.netRealizedRevenue,
          projectedRevenue: row.projectedRevenue,
          estimatedRemainingRefund: row.estimatedRemainingRefund,
          estimatedRemainingTeacherCost: row.estimatedRemainingTeacherCost,
          estimatedRemainingOtherCost: row.estimatedRemainingOtherCost,
          teacherCost: row.teacherCost,
          directParentExpense: row.directParentExpense,
          allocatedGroupExpense: row.allocatedGroupExpense,
          allocatedGlobalOverhead: row.allocatedGlobalOverhead,
          netProfit: row.netProfit,
          projectedNetProfit: row.projectedNetProfit,
          effectiveNetProfit: row.effectiveNetProfit,
          projectionBasis: row.projectionBasis,
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
      netProfitByDate.set(row.date, (netProfitByDate.get(row.date) || 0) + row.effectiveNetProfit);
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
      basis: cohortAnalytics.basis,
      maturityDays: normalizedMaturityDays,
      realizedThrough: cohortAnalytics.realizedThrough,
      refundRatePercentX: normalizedRefundRatePercentX,
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

  async getActionsRequired(options?: {
    refundRatePercentX?: number;
    lookbackDays?: number;
    targetProfitableRatio?: number;
    totalBudget?: number;
  }): Promise<{ actions: ActionableSuggestion[]; summary: import('./ads.types').ActionsRequiredSummary }> {
    const lookbackDays = options?.lookbackDays ?? 7;
    const targetProfitableRatio = options?.targetProfitableRatio ?? 0.6;
    const refundRateX = options?.refundRatePercentX ?? 10;

    const today = new Date();
    const startLookback = new Date(today);
    startLookback.setDate(today.getDate() - lookbackDays);
    const start90 = new Date(today);
    start90.setDate(today.getDate() - 90);

    const startDateStr = toUtcDateOnlyString(startLookback);
    const endDateStr = toUtcDateOnlyString(today);
    const start90Str = toUtcDateOnlyString(start90);

    // Step 1: Get lookback profit data to auto-compute budget
    const profitData = await this.getNetProfitByAdGroup(startDateStr, endDateStr);
    const effectiveBudget = options?.totalBudget != null
      ? options.totalBudget
      : profitData.overall.totalAdSpend > 0
        ? Math.round(profitData.overall.totalAdSpend / lookbackDays)
        : 5_000_000;

    // Step 2: Run both suggestion models in parallel (90-day window for fitting)
    const [suggestionsReal, suggestionsX] = await Promise.all([
      this.getSuggestions(start90Str, endDateStr, effectiveBudget, 60, undefined).catch(() => null),
      this.getSuggestions(start90Str, endDateStr, effectiveBudget, 60, refundRateX).catch(() => null),
    ]);

    const actions: ActionableSuggestion[] = [];
    const pausedGroupIds = new Set<string>();

    // Build lookup: adGroupId → SuggestionModel (real and X scenarios)
    const realByGroup = new Map<string, any>();
    if (suggestionsReal?.suggestions) {
      for (const s of suggestionsReal.suggestions) realByGroup.set(s.adGroupId, s);
    }
    const xByGroup = new Map<string, any>();
    if (suggestionsX?.suggestions) {
      for (const s of suggestionsX.suggestions) xByGroup.set(s.adGroupId, s);
    }

    // Aggregate effectiveNetProfit per group from 90-day summaryTable
    const effectiveByGroup = new Map<string, number>();
    if (suggestionsReal?.summaryTable) {
      for (const row of suggestionsReal.summaryTable) {
        effectiveByGroup.set(row.adGroupId, (effectiveByGroup.get(row.adGroupId) ?? 0) + row.effectiveNetProfit);
      }
    }

    // ── STEP 1: PAUSE_GROUP suggestions ──────────────────────────────────────
    for (const group of profitData.summaryByGroup) {
      const realSuggestion = realByGroup.get(group.adGroupId);
      const netProfit7d = group.totalNetProfit;
      const actualDailySpend = lookbackDays > 0 ? group.totalAdSpend / lookbackDays : 0;
      const optimalDailySpend = realSuggestion?.suggestedDailySpend ?? 0;
      const effectiveNetProfit = effectiveByGroup.get(group.adGroupId) ?? 0;
      const profitPerLead = realSuggestion?.averageProfitPerLead ?? null;
      const dataPoints = realSuggestion?.dataPoints ?? 0;

      let shouldPause = false;
      const pauseReasons: string[] = [];

      // Condition 1: Continuous loss in both lookback window and 90-day cohort
      if (netProfit7d < 0 && effectiveNetProfit < 0) {
        shouldPause = true;
        pauseReasons.push(
          `Lỗ liên tục: lỗ ${Math.abs(netProfit7d).toLocaleString('vi-VN')}đ trong ${lookbackDays} ngày và cohort lỗ ${Math.abs(effectiveNetProfit).toLocaleString('vi-VN')}đ`,
        );
      }

      // Condition 2: Spending >150% of optimal while losing
      if (optimalDailySpend > 0 && actualDailySpend > optimalDailySpend * 1.5 && netProfit7d < 0) {
        shouldPause = true;
        const overpct = Math.round(((actualDailySpend - optimalDailySpend) / optimalDailySpend) * 100);
        pauseReasons.push(
          `Chi vượt tối ưu: đang chi ${Math.round(actualDailySpend).toLocaleString('vi-VN')}đ/ngày, tối ưu chỉ ${optimalDailySpend.toLocaleString('vi-VN')}đ/ngày (vượt ${overpct}%)`,
        );
      }

      // Condition 3: Negative profit per lead with enough data points
      if (profitPerLead !== null && profitPerLead < 0 && dataPoints >= 5) {
        shouldPause = true;
        pauseReasons.push(
          `Mỗi lead đang tạo lỗ ${Math.abs(profitPerLead).toLocaleString('vi-VN')}đ — cần sửa funnel trước khi chạy tiếp`,
        );
      }

      if (!shouldPause) continue;

      const lossAbs = Math.abs(netProfit7d);
      const priority: ActionableSuggestion['priority'] =
        lossAbs > 2_000_000 ? 'CRITICAL' : lossAbs > 500_000 ? 'HIGH' : 'MEDIUM';

      const overspendPercent = optimalDailySpend > 0
        ? Math.round(((actualDailySpend - optimalDailySpend) / optimalDailySpend) * 100)
        : null;

      actions.push({
        type: 'PAUSE_GROUP',
        priority,
        title: `Tạm dừng nhóm QC: ${group.adGroupName}`,
        description: pauseReasons.join('. '),
        reasons: pauseReasons,
        details: {
          netProfit7Days: netProfit7d,
          effectiveNetProfit,
          actualDailySpend: Math.round(actualDailySpend),
          optimalDailySpend,
          profitPerLead,
          overspendPercent,
          platform: group.platform,
          dataPoints,
        },
        relatedEntity: { type: 'AdGroup', id: group.adGroupId, name: group.adGroupName },
        estimatedImpact: {
          dailyProfitChange: lookbackDays > 0 ? Math.round(-netProfit7d / lookbackDays) : 0,
          monthlyProfitChange: lookbackDays > 0 ? Math.round(-netProfit7d / lookbackDays) * 30 : 0,
        },
      });
      pausedGroupIds.add(group.adGroupId);
    }

    // ── STEP 2: ADJUST_BUDGET suggestions (skip paused groups) ───────────────
    // IMPORTANT: Limit budget changes to 20% to avoid resetting Learning Phase of FB/TikTok AI
    const SAFE_BUDGET_CHANGE_PERCENT = 0.20; // Max 20% change per day

    if (suggestionsReal?.suggestions) {
      for (const s of suggestionsReal.suggestions as any[]) {
        if (pausedGroupIds.has(s.adGroupId)) continue;
        if (s.confidence === 'LOW') continue;

        const optimalReal: number = s.suggestedDailySpend;
        const actual: number = s.currentDailySpend;
        if (optimalReal <= 0 || actual <= 0) continue;

        const deviationPercentReal = ((actual - optimalReal) / optimalReal) * 100;
        if (Math.abs(deviationPercentReal) <= 15) continue;

        const sX = xByGroup.get(s.adGroupId);
        const optimalX: number = sX?.suggestedDailySpend ?? optimalReal;
        const deviationPercentX = optimalX > 0
          ? Math.round(((actual - optimalX) / optimalX) * 100)
          : null;

        // Estimate profit gain: profit at optimal minus observed average at current spend
        const profitGain = (s.expectedDailyNetProfit ?? s.observedAverageNetProfit ?? 0)
          - (s.observedAverageNetProfit ?? 0);
        if (Math.abs(profitGain) < 1000) continue; // Skip negligible impact

        const isDecrease = deviationPercentReal > 0;
        const subType: 'INCREASE' | 'DECREASE' = isDecrease ? 'DECREASE' : 'INCREASE';

        // Only suggest INCREASE if cohort view is positive
        const effectiveNetProfitGroup = effectiveByGroup.get(s.adGroupId) ?? 0;
        if (!isDecrease && effectiveNetProfitGroup <= 0) continue;

        // ─── Learning Phase Protection: Limit to 20% max change ───────────
        // Calculate safe target that respects Learning Phase constraints
        let safeTarget: number;
        let learningPhaseWarning = false;

        if (isDecrease) {
          // DECREASE: Max giảm 20%
          const safeDecreaseLimit = actual * (1 - SAFE_BUDGET_CHANGE_PERCENT);
          safeTarget = Math.max(optimalReal, safeDecreaseLimit);
          learningPhaseWarning = optimalReal < safeDecreaseLimit;
        } else {
          // INCREASE: Max tăng 20%
          const safeIncreaseLimit = actual * (1 + SAFE_BUDGET_CHANGE_PERCENT);
          safeTarget = Math.min(optimalReal, safeIncreaseLimit);
          learningPhaseWarning = optimalReal > safeIncreaseLimit;
        }

        const profitGainAbs = Math.abs(profitGain);
        const priority: ActionableSuggestion['priority'] =
          profitGainAbs > 500_000 ? 'HIGH' : profitGainAbs > 100_000 ? 'MEDIUM' : 'LOW';

        const fmt = (v: number) => Math.round(v).toLocaleString('vi-VN');

        // Build description with Learning Phase awareness
        let description: string;
        if (isDecrease) {
          if (learningPhaseWarning) {
            description = `Đang chi ${fmt(actual)}đ/ngày, tối ưu chỉ ${fmt(optimalReal)}đ/ngày. ` +
              `GIẢM TỪ TỪ về ${fmt(safeTarget)}đ/ngày (-20%) hôm nay để không mất learning phase. ` +
              `Mục tiêu cuối: ${fmt(optimalReal)}đ/ngày.`;
          } else {
            description = `Đang chi ${fmt(actual)}đ/ngày, tối ưu chỉ ${fmt(optimalReal)}đ/ngày. ` +
              `Giảm về ${fmt(optimalReal)}đ/ngày sẽ tăng lợi nhuận ước tính ${fmt(Math.abs(profitGain))}đ/ngày.`;
          }
        } else {
          if (learningPhaseWarning) {
            description = `Đang chi ${fmt(actual)}đ/ngày, tối ưu là ${fmt(optimalReal)}đ/ngày. ` +
              `TĂNG TỪ TỪ về ${fmt(safeTarget)}đ/ngày (+20%) hôm nay để không mất learning phase. ` +
              `Mục tiêu cuối: ${fmt(optimalReal)}đ/ngày.`;
          } else {
            description = `Đang chi ${fmt(actual)}đ/ngày, tối ưu là ${fmt(optimalReal)}đ/ngày. ` +
              `Tăng lên ${fmt(optimalReal)}đ/ngày sẽ tăng lợi nhuận ước tính ${fmt(Math.abs(profitGain))}đ/ngày.`;
          }
        }

        const reasons = [
          `Chi phí thực tế ${isDecrease ? 'cao hơn' : 'thấp hơn'} ${Math.abs(Math.round(deviationPercentReal))}% so với mức tối ưu`,
        ];
        if (learningPhaseWarning) {
          reasons.push('⚠️ Điều chỉnh >20% có thể reset Learning Phase của thuật toán quảng cáo');
        }

        actions.push({
          type: 'ADJUST_BUDGET',
          subType,
          priority,
          title: `${isDecrease ? 'Giảm' : 'Tăng'} chi phí QC: ${s.adGroupName}`,
          description,
          reasons,
          details: {
            currentDailySpend: actual,
            optimalDailySpendReal: optimalReal,
            optimalDailySpendX: optimalX,
            safeDailyTarget: Math.round(safeTarget),      // Target an toàn cho Learning Phase
            learningPhaseProtected: learningPhaseWarning, // Flag: cần điều chỉnh từ từ
            maxSafeChangePercent: SAFE_BUDGET_CHANGE_PERCENT * 100,
            refundRatePercentX: refundRateX,
            expectedDailyNetProfit: s.expectedDailyNetProfit,
            estimatedDailyProfitGain: Math.round(profitGain),
            estimatedMonthlyProfitGain: Math.round(profitGain * 30),
            confidence: s.confidence,
            deviationPercentReal: Math.round(deviationPercentReal),
            deviationPercentX,
            platform: s.platform,
          },
          relatedEntity: { type: 'AdGroup', id: s.adGroupId, name: s.adGroupName },
          estimatedImpact: {
            dailyProfitChange: Math.round(profitGain),
            monthlyProfitChange: Math.round(profitGain * 30),
          },
        });
      }
    }

    // ── STEP 3: CREATE_GROUP suggestions ─────────────────────────────────────
    const allGroups = profitData.summaryByGroup;
    const profitableGroups = allGroups.filter((g) => (effectiveByGroup.get(g.adGroupId) ?? 0) > 0);
    const unprofitableGroups = allGroups.filter((g) => (effectiveByGroup.get(g.adGroupId) ?? 0) <= 0);
    const currentProfitableCount = profitableGroups.length;
    const targetProfitableCount = Math.max(3, Math.ceil(allGroups.length * targetProfitableRatio));
    const groupDeficit = Math.max(0, targetProfitableCount - currentProfitableCount);
    const totalUnallocated = suggestionsReal?.unallocated ?? 0;

    // ─── CHẶN: Tính tổng lợi nhuận toàn bộ tài khoản ─────────────────────
    // Nếu tổng tài khoản đang lỗ, TUYỆT ĐỐI không gợi ý tạo thêm nhóm
    const accountOverallProfit = allGroups.reduce((sum, g) => sum + (effectiveByGroup.get(g.adGroupId) ?? 0), 0);
    const isAccountInLoss = accountOverallProfit < 0;

    // Average daily optimal spend of profitable groups with sufficient confidence
    const profitableWithModel = profitableGroups
      .map((g) => realByGroup.get(g.adGroupId))
      .filter((s): s is any => s != null && s.confidence !== 'LOW' && s.suggestedDailySpend > 0);
    const avgDailySpendProfitable = profitableWithModel.length > 0
      ? Math.round(profitableWithModel.reduce((sum: number, s: any) => sum + s.suggestedDailySpend, 0) / profitableWithModel.length)
      : 0;

    let suggestedNewGroupCount = 0;
    let totalSuggestedNewGroups = 0;

    // CHẶN: Nếu tài khoản đang lỗ tổng, không gợi ý tạo nhóm mới
    if (isAccountInLoss) {
      suggestedNewGroupCount = 0;
      totalSuggestedNewGroups = 0;

      // Thêm suggestion OPTIMIZE_FUNNEL_FIRST thay vì CREATE_GROUP
      actions.push({
        type: 'OPTIMIZE_FUNNEL_FIRST',
        priority: 'HIGH',
        title: 'Cần tối ưu funnel trước khi mở rộng',
        description: `Tổng tài khoản đang lỗ ${Math.abs(accountOverallProfit).toLocaleString('vi-VN')}đ trong 90 ngày. ` +
          `Cần tối ưu các nhóm hiện tại trước khi tạo nhóm mới. ` +
          `Hiện có ${unprofitableGroups.length}/${allGroups.length} nhóm đang lỗ.`,
        reasons: [
          `Tổng lợi nhuận 90 ngày: -${Math.abs(accountOverallProfit).toLocaleString('vi-VN')}đ`,
          `${unprofitableGroups.length} nhóm đang tạo lỗ`,
          'Tạo thêm nhóm khi funnel chưa hiệu quả sẽ đốt thêm tiền',
        ],
        details: {
          accountOverallProfit,
          unprofitableGroupCount: unprofitableGroups.length,
          totalActiveGroups: allGroups.length,
          unallocatedBudget: totalUnallocated,
          recommendation: 'Dừng tạo nhóm mới, tập trung tối ưu hoặc tạm dừng các nhóm đang lỗ',
        },
        estimatedImpact: {
          dailyProfitChange: 0,
          monthlyProfitChange: 0,
        },
      });
    } else {
      // Skip CREATE_GROUP when there are no active groups at all (no data to base recommendation on)
      if (allGroups.length === 0) {
        suggestedNewGroupCount = 0;
        totalSuggestedNewGroups = 0;
      } else {
        // Logic tính toán số nhóm cần tạo như cũ
        if (totalUnallocated > 0 && avgDailySpendProfitable > 0) {
          suggestedNewGroupCount = Math.min(Math.floor(totalUnallocated / avgDailySpendProfitable), 5);
        }
        totalSuggestedNewGroups = Math.min(Math.max(suggestedNewGroupCount, groupDeficit), 5);
      }
    }

    if (totalSuggestedNewGroups > 0) {
      // Compute ROI per platform from 7-day data
      const platformRoiMap: Record<string, { totalRevenue: number; totalAdSpend: number; profitableCount: number }> = {};
      for (const group of allGroups) {
        if (!platformRoiMap[group.platform]) {
          platformRoiMap[group.platform] = { totalRevenue: 0, totalAdSpend: 0, profitableCount: 0 };
        }
        platformRoiMap[group.platform].totalRevenue += group.totalRevenue;
        platformRoiMap[group.platform].totalAdSpend += group.totalAdSpend;
      }
      for (const group of profitableGroups) {
        if (platformRoiMap[group.platform]) platformRoiMap[group.platform].profitableCount += 1;
      }
      const platformBreakdown: Record<string, { profitableCount: number; avgROI: number }> = {};
      for (const [platform, data] of Object.entries(platformRoiMap)) {
        platformBreakdown[platform] = {
          profitableCount: data.profitableCount,
          avgROI: data.totalAdSpend > 0
            ? Math.round(((data.totalRevenue - data.totalAdSpend) / data.totalAdSpend) * 100)
            : 0,
        };
      }

      const suggestedPlatform = Object.entries(platformBreakdown)
        .sort((a, b) => b[1].avgROI - a[1].avgROI)[0]?.[0] ?? 'FACEBOOK';
      const bestPlatformROI = platformBreakdown[suggestedPlatform]?.avgROI ?? 0;

      const avgProfitPerProfitableGroup = profitableGroups.length > 0
        ? Math.round(
          profitableGroups.reduce((sum, g) => sum + (effectiveByGroup.get(g.adGroupId) ?? 0), 0)
          / profitableGroups.length,
        )
        : 0;
      const suggestedBudgetPerNewGroup = avgDailySpendProfitable > 0
        ? avgDailySpendProfitable
        : totalSuggestedNewGroups > 0 ? Math.floor(totalUnallocated / totalSuggestedNewGroups) : 0;
      const estimatedMonthlyProfit = avgProfitPerProfitableGroup * totalSuggestedNewGroups * 30;

      const priority: ActionableSuggestion['priority'] =
        groupDeficit >= 2 && totalUnallocated > 2_000_000 ? 'HIGH'
          : groupDeficit >= 1 || totalUnallocated > 1_000_000 ? 'MEDIUM'
            : 'LOW';

      const createReasons: string[] = [];
      if (groupDeficit > 0) createReasons.push(`Thiếu ${groupDeficit} nhóm có lãi so với mục tiêu ${Math.round(targetProfitableRatio * 100)}%`);
      if (totalUnallocated > 0) createReasons.push(`Còn ${totalUnallocated.toLocaleString('vi-VN')}đ/ngày ngân sách chưa phân bổ tối ưu`);

      actions.push({
        type: 'CREATE_GROUP',
        priority,
        title: `Tạo ${totalSuggestedNewGroups} nhóm QC mới`,
        description: `Hiện có ${currentProfitableCount}/${allGroups.length} nhóm có lãi (mục tiêu ${targetProfitableCount} nhóm). Ngân sách chưa phân bổ: ${totalUnallocated.toLocaleString('vi-VN')}đ/ngày. Nên tạo ${totalSuggestedNewGroups} nhóm mới, ưu tiên nền tảng ${suggestedPlatform} (ROI tốt nhất: ${bestPlatformROI}%).`,
        reasons: createReasons,
        details: {
          activeGroupCount: allGroups.length,
          profitableGroupCount: currentProfitableCount,
          unprofitableGroupCount: unprofitableGroups.length,
          targetProfitableCount,
          groupDeficit,
          suggestedNewGroupCount: totalSuggestedNewGroups,
          unallocatedBudget: totalUnallocated,
          suggestedBudgetPerNewGroup,
          suggestedPlatform,
          platformBreakdown,
          avgProfitPerProfitableGroup,
          estimatedMonthlyProfitIfSuccessful: estimatedMonthlyProfit,
        },
        estimatedImpact: {
          dailyProfitChange: Math.round(avgProfitPerProfitableGroup * totalSuggestedNewGroups),
          monthlyProfitChange: estimatedMonthlyProfit,
        },
      });
    }

    // Sort: CRITICAL > HIGH > MEDIUM > LOW
    const priorityOrder: Record<string, number> = { CRITICAL: 1, HIGH: 2, MEDIUM: 3, LOW: 4 };
    actions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    const totalOptimalDailySpend = suggestionsReal?.totalSuggestedDailySpend ?? 0;
    const overallEffectiveNetProfit = Array.from(effectiveByGroup.values()).reduce((sum, v) => sum + v, 0);

    return {
      actions,
      summary: {
        totalActiveGroups: allGroups.length,
        profitableGroups: currentProfitableCount,
        unprofitableGroups: unprofitableGroups.length,
        totalDailySpend: effectiveBudget,
        totalOptimalDailySpend,
        overallNetProfit7d: profitData.overall.totalNetProfit,
        overallEffectiveNetProfit,
        generatedAt: new Date().toISOString(),
      },
    };
  }

  private buildSuggestionRecommendation(input: {
    dataPoints: number;
    groupRoi: number;
    averageCtr: number;
    averageLeadRate: number;
    averageProfitPerLead: number | null;
    overallCtr: number;
    overallLeadRate: number;
    overallRoi: number;
    fitR2: number;
  }): { recommendation: string; reasons: string[] } {
    return buildSuggestionRecommendation(input);
  }
  /**
   * Fit: y = a * ln(x + 1) + b using least squares
   * Returns coefficients and R-squared
   */
  private fitLogCurve(xValues: number[], yValues: number[]): { a: number; b: number; rSquared: number } {
    return fitLogCurve(xValues, yValues);
  }

}
