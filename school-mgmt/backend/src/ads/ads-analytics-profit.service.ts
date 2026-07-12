import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AdCost, AdCostDocument } from './schemas/ad-cost.schema';
import { AdGroup, AdGroupDocument } from './schemas/ad-group.schema';
import { Expense, ExpenseDocument } from '../expenses/schemas/expense.schema';
import { Lead, LeadDocument, LeadStatus } from '../leads/schemas/lead.schema';
import { Order, OrderDocument, OrderStatus } from '../orders/schemas/order.schema';
import { Session, SessionDocument } from '../sessions/schemas/session.schema';
import { SessionStatus } from '../sessions/schemas/session.schema';
import { PaymentStatus } from '../expenses/schemas/expense.schema';
import { NetProfitDailyRow, SaleFunnelDiagnosticsResponse } from './ads.types';
import { AdsGroupProfitCostService } from './ads-group-profit-cost.service';

import {
  getUtcDateRange,
  groupDayKey,
  parseOptionalObjectId,
  roundCurrency,
  splitGroupDayKey,
} from './ads.utils';

@Injectable()
export class AdsAnalyticsProfitService {
  private readonly logger = new Logger(AdsAnalyticsProfitService.name);
  private readonly maxAnalyticsRangeDays = 366;
  private readonly staleLeadDays = 7;

  constructor(
    @InjectModel(AdCost.name) private readonly adCostModel: Model<AdCostDocument>,
    @InjectModel(AdGroup.name) private readonly adGroupModel: Model<AdGroupDocument>,
    @InjectModel(Expense.name) private readonly expenseModel: Model<ExpenseDocument>,
    @InjectModel(Lead.name) private readonly leadModel: Model<LeadDocument>,
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    @InjectModel(Session.name) private readonly sessionModel: Model<SessionDocument>,
    private readonly groupProfitCostService: AdsGroupProfitCostService,
  ) {}

  private parseOptionalFilterObjectId(id: string | undefined, fieldName: string): Types.ObjectId | undefined {
    if (!id) return undefined;
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException(`${fieldName} khong hop le`);
    }
    return new Types.ObjectId(id);
  }

  private saleFunnelKey(adGroupId: unknown, saleId: unknown): string {
    return `${String(adGroupId || '')}::${saleId ? String(saleId) : ''}`;
  }

  async getSaleFunnelDiagnostics(
    startDate: string,
    endDate: string,
    adGroupId?: string,
    saleId?: string,
  ): Promise<SaleFunnelDiagnosticsResponse> {
    const { start, end } = getUtcDateRange(startDate, endDate, this.maxAnalyticsRangeDays);
    const adGroupObjectId = parseOptionalObjectId(adGroupId);
    const saleObjectId = this.parseOptionalFilterObjectId(saleId, 'saleId');
    const staleCutoff = new Date(Date.now() - this.staleLeadDays * 24 * 60 * 60 * 1000);
    const activeLeadStatuses = [LeadStatus.NEW, LeadStatus.CONTACTED, LeadStatus.CONSULTING, LeadStatus.INTERESTED];
    const contactedLeadStatuses = [
      LeadStatus.CONTACTED,
      LeadStatus.CONSULTING,
      LeadStatus.INTERESTED,
      LeadStatus.CONVERTED,
    ];
    const convertedOrderStatuses = [
      OrderStatus.DRAFT,
      OrderStatus.SUBMITTED,
      OrderStatus.NEEDS_INFO,
      OrderStatus.APPROVED,
      OrderStatus.COMPLETED,
    ];
    const approvedOrderStatuses = [OrderStatus.APPROVED, OrderStatus.COMPLETED];

    const leadMatch: any = {
      adGroupId: { $exists: true, $ne: null },
      createdAt: { $gte: start, $lte: end },
    };
    if (adGroupObjectId) leadMatch.adGroupId = adGroupObjectId;
    if (saleObjectId) leadMatch.saleId = saleObjectId;

    const orderMatch: any = {
      adGroupId: { $exists: true, $ne: null },
      createdAt: { $gte: start, $lte: end },
    };
    if (adGroupObjectId) orderMatch.adGroupId = adGroupObjectId;
    if (saleObjectId) orderMatch.saleId = saleObjectId;

    const [leadRows, orderRows] = await Promise.all([
      this.leadModel.aggregate([
        { $match: leadMatch },
        {
          $group: {
            _id: {
              adGroupId: '$adGroupId',
              saleId: { $ifNull: ['$saleId', null] },
            },
            adGroupName: { $first: '$adGroupName' },
            saleName: { $first: '$saleName' },
            leadCount: { $sum: 1 },
            assignedLeadCount: {
              $sum: {
                $cond: [{ $ne: [{ $ifNull: ['$saleId', null] }, null] }, 1, 0],
              },
            },
            contactedLeadCount: {
              $sum: {
                $cond: [
                  {
                    $or: [
                      { $ne: [{ $ifNull: ['$lastContactAt', null] }, null] },
                      { $in: ['$status', contactedLeadStatuses] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            staleLeadCount: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $ne: [{ $ifNull: ['$saleId', null] }, null] },
                      { $in: ['$status', activeLeadStatuses] },
                      {
                        $or: [
                          {
                            $and: [
                              {
                                $eq: [{ $ifNull: ['$lastContactAt', null] }, null],
                              },
                              {
                                $ne: [{ $ifNull: ['$assignedAt', null] }, null],
                              },
                              { $lte: ['$assignedAt', staleCutoff] },
                            ],
                          },
                          {
                            $and: [
                              {
                                $ne: [{ $ifNull: ['$lastContactAt', null] }, null],
                              },
                              { $lte: ['$lastContactAt', staleCutoff] },
                            ],
                          },
                        ],
                      },
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
      this.orderModel.aggregate([
        { $match: orderMatch },
        {
          $group: {
            _id: {
              adGroupId: '$adGroupId',
              saleId: { $ifNull: ['$saleId', null] },
            },
            adGroupName: { $first: '$adGroupName' },
            saleName: { $first: '$saleName' },
            convertedOrderCount: {
              $sum: {
                $cond: [{ $in: ['$status', convertedOrderStatuses] }, 1, 0],
              },
            },
            approvedOrderCount: {
              $sum: {
                $cond: [{ $in: ['$status', approvedOrderStatuses] }, 1, 0],
              },
            },
            revenue: {
              $sum: {
                $cond: [{ $in: ['$status', approvedOrderStatuses] }, { $ifNull: ['$finalAmount', 0] }, 0],
              },
            },
            saleCommission: {
              $sum: {
                $cond: [{ $in: ['$status', approvedOrderStatuses] }, { $ifNull: ['$saleCommission', 0] }, 0],
              },
            },
          },
        },
      ]),
    ]);

    const leadMap = new Map<string, any>();
    const orderMap = new Map<string, any>();
    const allKeys = new Set<string>();
    const adGroupIds = new Set<string>();

    for (const row of leadRows as any[]) {
      const rowAdGroupId = row._id?.adGroupId?.toString?.();
      if (!rowAdGroupId) continue;
      const rowSaleId = row._id?.saleId?.toString?.() || '';
      const key = this.saleFunnelKey(rowAdGroupId, rowSaleId);
      leadMap.set(key, row);
      allKeys.add(key);
      adGroupIds.add(rowAdGroupId);
    }

    for (const row of orderRows as any[]) {
      const rowAdGroupId = row._id?.adGroupId?.toString?.();
      if (!rowAdGroupId) continue;
      const rowSaleId = row._id?.saleId?.toString?.() || '';
      const key = this.saleFunnelKey(rowAdGroupId, rowSaleId);
      orderMap.set(key, row);
      allKeys.add(key);
      adGroupIds.add(rowAdGroupId);
    }

    if (adGroupObjectId && allKeys.size === 0) {
      const key = this.saleFunnelKey(adGroupObjectId.toString(), saleObjectId?.toString() || '');
      allKeys.add(key);
      adGroupIds.add(adGroupObjectId.toString());
    }

    const adGroupObjectIds = Array.from(adGroupIds)
      .filter((id) => Types.ObjectId.isValid(id))
      .map((id) => new Types.ObjectId(id));
    const adGroups =
      adGroupObjectIds.length > 0
        ? await this.adGroupModel
            .find({ _id: { $in: adGroupObjectIds } })
            .select('_id name platform')
            .lean()
        : [];
    const adGroupMetaMap = new Map<string, { name: string; platform: string }>();
    for (const group of adGroups as any[]) {
      adGroupMetaMap.set(group._id.toString(), {
        name: group.name || '',
        platform: group.platform || '',
      });
    }

    const rows = Array.from(allKeys)
      .map((key) => {
        const [rowAdGroupId, rowSaleId] = key.split('::');
        if (!rowAdGroupId) return null;

        const leadData = leadMap.get(key);
        const orderData = orderMap.get(key);
        const adGroupMeta = adGroupMetaMap.get(rowAdGroupId);
        const revenue = roundCurrency(Number(orderData?.revenue || 0));
        const saleCommission = roundCurrency(Number(orderData?.saleCommission || 0));
        const profit = roundCurrency(revenue - saleCommission);
        const saleName = leadData?.saleName || orderData?.saleName || (rowSaleId ? '' : 'UNASSIGNED');

        return {
          adGroupId: rowAdGroupId,
          adGroupName: leadData?.adGroupName || orderData?.adGroupName || adGroupMeta?.name || '',
          platform: adGroupMeta?.platform || '',
          saleId: rowSaleId || null,
          saleName,
          leadCount: Number(leadData?.leadCount || 0),
          assignedLeadCount: Number(leadData?.assignedLeadCount || 0),
          contactedLeadCount: Number(leadData?.contactedLeadCount || 0),
          staleLeadCount: Number(leadData?.staleLeadCount || 0),
          convertedOrderCount: Number(orderData?.convertedOrderCount || 0),
          approvedOrderCount: Number(orderData?.approvedOrderCount || 0),
          revenue,
          saleCommission,
          profit,
          netProfit: null,
          profitBasis: 'ORDER_REVENUE_MINUS_SALE_COMMISSION' as const,
          netProfitBasis: null,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null)
      .sort(
        (a, b) =>
          a.adGroupName.localeCompare(b.adGroupName) ||
          a.saleName.localeCompare(b.saleName) ||
          a.adGroupId.localeCompare(b.adGroupId) ||
          String(a.saleId || '').localeCompare(String(b.saleId || '')),
      );

    const summary = {
      leadCount: rows.reduce((sum, row) => sum + row.leadCount, 0),
      assignedLeadCount: rows.reduce((sum, row) => sum + row.assignedLeadCount, 0),
      contactedLeadCount: rows.reduce((sum, row) => sum + row.contactedLeadCount, 0),
      staleLeadCount: rows.reduce((sum, row) => sum + row.staleLeadCount, 0),
      convertedOrderCount: rows.reduce((sum, row) => sum + row.convertedOrderCount, 0),
      approvedOrderCount: rows.reduce((sum, row) => sum + row.approvedOrderCount, 0),
      revenue: roundCurrency(rows.reduce((sum, row) => sum + row.revenue, 0)),
      saleCommission: roundCurrency(rows.reduce((sum, row) => sum + row.saleCommission, 0)),
      profit: roundCurrency(rows.reduce((sum, row) => sum + row.profit, 0)),
      netProfit: null,
    };

    return {
      query: {
        startDate,
        endDate,
        adGroupId: adGroupId || null,
        saleId: saleId || null,
        staleAfterDays: this.staleLeadDays,
      },
      rows,
      summary,
    };
  }

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
      ? await this.adGroupModel.find({ _id: { $in: adGroupIds } }).select('name platform adAccountId').lean()
      : [];
    const adGroupMetaMap = new Map<string, { name?: string; platform?: string; adAccountId?: string }>(
      adGroups.map((g: any) => [String(g._id), {
        name: g.name,
        platform: g.platform,
        adAccountId: g.adAccountId ? String(g.adAccountId) : undefined,
      }]),
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
          adAccountId: meta?.adAccountId,
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

    const leadMatch: any = {
      adGroupId: { $exists: true, $ne: null },
      createdAt: { $gte: start, $lte: end },
    };
    if (adGroupObjectId) leadMatch.adGroupId = adGroupObjectId;

    const leadsByGroup = await this.leadModel.aggregate([
      { $match: leadMatch },
      { $group: { _id: '$adGroupId', leadCount: { $sum: 1 } } },
    ]);
    const leadMap = new Map(leadsByGroup.map((l) => [l._id.toString(), l.leadCount]));

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
          revenue: { $sum: { $ifNull: ['$finalAmount', 0] } },
          saleCommission: { $sum: { $ifNull: ['$saleCommission', 0] } },
        },
      },
    ]);
    const orderMap = new Map(ordersByGroup.map((o) => [o._id.toString(), o]));
    const costBreakdownByGroup = await this.groupProfitCostService.buildBreakdownByAdGroup(start, end);

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
    for (const gId of costBreakdownByGroup.keys()) allGroupIds.add(gId);
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

    const rows = Array.from(allGroupIds)
      .map((gId) => {
        const cost = costMap.get(gId);
        const groupMeta = adGroupMetaMap.get(gId);
        const netProfitMeta = netProfitMetaByGroup.get(gId);
        const resolvedPlatform = cost?.platform || netProfitMeta?.platform || groupMeta?.platform || '';

        if (platform && resolvedPlatform !== platform) return null;

        const leadCount = leadMap.get(gId) || 0;
        const orderData = orderMap.get(gId) || { orderCount: 0, revenue: 0, saleCommission: 0 };
        const sessionNetProfit = netProfitByGroup.get(gId) || 0;
        const recognizedRevenue = recognizedRevenueByGroup.get(gId) || 0;
        const bookedRevenue = roundCurrency(Number(orderData.revenue || 0));
        const saleCommission = roundCurrency(Number(orderData.saleCommission || 0));
        const totalSpend = Number(cost?.totalSpend || 0);
        const costBreakdown = costBreakdownByGroup.get(gId);
        const estimatedTeacherCost = roundCurrency(Number(costBreakdown?.estimatedTeacherCost || 0));
        const directParentExpense = roundCurrency(Number(costBreakdown?.directParentExpense || 0));
        const allocatedGroupExpense = roundCurrency(Number(costBreakdown?.allocatedGroupExpense || 0));
        const allocatedGlobalExpense = roundCurrency(Number(costBreakdown?.allocatedGlobalExpense || 0));
        const allocatedStaffLaborCost = roundCurrency(Number(costBreakdown?.allocatedStaffLaborCost || 0));
        const otherCost = roundCurrency(directParentExpense + allocatedGroupExpense + allocatedGlobalExpense);
        const operatingCost = roundCurrency(otherCost + allocatedStaffLaborCost);
        const totalCost = roundCurrency(
          totalSpend
          + saleCommission
          + estimatedTeacherCost
          + operatingCost,
        );
        const orderProfit = roundCurrency(bookedRevenue - saleCommission - estimatedTeacherCost);
        const netProfit = roundCurrency(bookedRevenue - totalCost);
        const projectedOrderNetProfit = netProfit;
        const realizedNetProfit = sessionNetProfit;
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
          revenue: bookedRevenue,
          bookedRevenue,
          recognizedRevenue,
          saleCommission,
          estimatedTeacherCost,
          directParentExpense,
          allocatedGroupExpense,
          allocatedGlobalExpense,
          allocatedStaffLaborCost,
          otherCost,
          operatingCost,
          totalCost,
          orderProfit,
          sessionNetProfit,
          projectedOrderNetProfit,
          realizedNetProfit,
          costPerLead: leadCount > 0 ? Math.round(totalSpend / leadCount) : null,
          costPerOrder: orderData.orderCount > 0 ? Math.round(totalSpend / orderData.orderCount) : null,
          netProfit,
          roi: Math.round(roi * 100) / 100,
          profitBasis: 'ORDER_REVENUE_MINUS_ALL_ALLOCATED_COSTS',
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null)
      .sort((a, b) => b.totalSpend - a.totalSpend || b.netProfit - a.netProfit);

    const summary = {
      totalSpend: rows.reduce((s, r) => s + r.totalSpend, 0),
      totalLeads: rows.reduce((s, r) => s + r.leadCount, 0),
      totalOrders: rows.reduce((s, r) => s + r.orderCount, 0),
      totalRevenue: rows.reduce((s, r) => s + r.revenue, 0),
      totalBookedRevenue: rows.reduce((s, r) => s + r.bookedRevenue, 0),
      totalRecognizedRevenue: rows.reduce((s, r) => s + r.recognizedRevenue, 0),
      totalSaleCommission: rows.reduce((s, r) => s + r.saleCommission, 0),
      totalEstimatedTeacherCost: rows.reduce((s, r) => s + r.estimatedTeacherCost, 0),
      totalDirectParentExpense: rows.reduce((s, r) => s + r.directParentExpense, 0),
      totalAllocatedGroupExpense: rows.reduce((s, r) => s + r.allocatedGroupExpense, 0),
      totalAllocatedGlobalExpense: rows.reduce((s, r) => s + r.allocatedGlobalExpense, 0),
      totalAllocatedStaffLaborCost: rows.reduce((s, r) => s + r.allocatedStaffLaborCost, 0),
      totalOtherCost: rows.reduce((s, r) => s + r.otherCost, 0),
      totalOperatingCost: rows.reduce((s, r) => s + r.operatingCost, 0),
      totalCost: rows.reduce((s, r) => s + r.totalCost, 0),
      totalOrderProfit: rows.reduce((s, r) => s + r.orderProfit, 0),
      totalSessionNetProfit: rows.reduce((s, r) => s + r.sessionNetProfit, 0),
      totalProjectedOrderNetProfit: rows.reduce((s, r) => s + r.projectedOrderNetProfit, 0),
      totalRealizedNetProfit: rows.reduce((s, r) => s + r.realizedNetProfit, 0),
      totalNetProfit: rows.reduce((s, r) => s + r.netProfit, 0),
      avgCostPerLead: 0,
      avgCostPerOrder: 0,
      avgRoi: 0,
      profitBasis: 'ORDER_REVENUE_MINUS_ALL_ALLOCATED_COSTS',
    };

    if (summary.totalLeads > 0) summary.avgCostPerLead = Math.round(summary.totalSpend / summary.totalLeads);
    if (summary.totalOrders > 0) summary.avgCostPerOrder = Math.round(summary.totalSpend / summary.totalOrders);
    if (summary.totalSpend > 0)
      summary.avgRoi = Math.round((summary.totalNetProfit / summary.totalSpend) * 10000) / 100;

    return { rows, summary };
  }

  async getNetProfitByAdGroup(startDate: string, endDate: string, adGroupId?: string): Promise<any> {
    const { start, end } = getUtcDateRange(startDate, endDate, this.maxAnalyticsRangeDays);
    const adGroupObjectId = parseOptionalObjectId(adGroupId);
    const daily = await this.buildNetProfitDailyRows(start, end, adGroupObjectId);

    const groupSummaryMap = new Map<string, any>();
    for (const row of daily) {
      if (!groupSummaryMap.has(row.adGroupId)) {
        groupSummaryMap.set(row.adGroupId, {
          adGroupId: row.adGroupId,
          adGroupName: row.adGroupName,
          adAccountId: row.adAccountId,
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
        netMargin: s.totalRevenue > 0 ? Math.round((s.totalNetProfit / s.totalRevenue) * 10000) / 100 : 0,
        avgNetProfitPerDay: s.days > 0 ? Math.round(s.totalNetProfit / s.days) : 0,
        avgNetProfitPerSession: s.totalSessions > 0 ? Math.round(s.totalNetProfit / s.totalSessions) : 0,
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
}
