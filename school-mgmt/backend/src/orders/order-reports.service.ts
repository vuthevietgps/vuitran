import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { Order, OrderDocument, OrderStatus } from "./schemas/order.schema";
import { JwtPayload } from "../common/interfaces/jwt-payload.interface";
import { Role } from "../common/interfaces/role.enum";

@Injectable()
export class OrderReportsService {
  constructor(
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
  ) {}

  private getActorId(user: JwtPayload): string {
    return user?.sub ?? user?._id ?? (user as any)?.userId;
  }

  async getPipeline(user: JwtPayload) {
    const match: any = {};
    if (user.role === Role.SALE) match.saleId = new Types.ObjectId(this.getActorId(user));

    const pipeline = await this.orderModel.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalValue: { $sum: "$finalAmount" },
        },
      },
    ]);

    const result: Record<string, { count: number; totalValue: number }> = {};
    for (const status of Object.values(OrderStatus)) {
      result[status] = { count: 0, totalValue: 0 };
    }
    for (const item of pipeline) {
      result[item._id] = {
        count: item.count,
        totalValue: item.totalValue || 0,
      };
    }

    return result;
  }

  async getStats(user: JwtPayload) {
    const thisMonthStart = new Date(
      new Date().getFullYear(),
      new Date().getMonth(),
      1,
    );
    const match: any = {};
    if (user.role === Role.SALE) match.saleId = new Types.ObjectId(this.getActorId(user));

    const stats = await this.orderModel.aggregate([
      { $match: match },
      {
        $facet: {
          overview: [
            {
              $group: {
                _id: null,
                total: { $sum: 1 },
                submitted: {
                  $sum: {
                    $cond: [
                      { $in: ["$status", ["SUBMITTED", "APPROVED", "COMPLETED", "REJECTED", "NEEDS_INFO"]] },
                      1,
                      0,
                    ],
                  },
                },
                approved: {
                  $sum: {
                    $cond: [
                      { $in: ["$status", ["APPROVED", "COMPLETED"]] },
                      1,
                      0,
                    ],
                  },
                },
                totalRevenue: {
                  $sum: {
                    $cond: [
                      { $in: ["$status", ["APPROVED", "COMPLETED"]] },
                      "$finalAmount",
                      0,
                    ],
                  },
                },
                totalCommission: {
                  $sum: {
                    $cond: [
                      { $in: ["$status", ["APPROVED", "COMPLETED"]] },
                      "$saleCommission",
                      0,
                    ],
                  },
                },
              },
            },
          ],
          thisMonth: [
            { $match: { createdAt: { $gte: thisMonthStart } } },
            {
              $group: {
                _id: null,
                count: { $sum: 1 },
                revenue: {
                  $sum: {
                    $cond: [
                      { $in: ["$status", ["APPROVED", "COMPLETED"]] },
                      "$finalAmount",
                      0,
                    ],
                  },
                },
              },
            },
          ],
          bySale: [
            {
              $group: {
                _id: { saleId: "$saleId", saleName: "$saleName" },
                total: { $sum: 1 },
                approved: {
                  $sum: {
                    $cond: [
                      { $in: ["$status", ["APPROVED", "COMPLETED"]] },
                      1,
                      0,
                    ],
                  },
                },
                revenue: {
                  $sum: {
                    $cond: [
                      { $in: ["$status", ["APPROVED", "COMPLETED"]] },
                      "$finalAmount",
                      0,
                    ],
                  },
                },
              },
            },
          ],
          byType: [{ $group: { _id: "$orderType", count: { $sum: 1 } } }],
          bySource: [
            { $match: { leadSource: { $ne: null } } },
            { $group: { _id: "$leadSource", count: { $sum: 1 } } },
          ],
          pendingValue: [
            { $match: { status: "SUBMITTED" } },
            {
              $group: {
                _id: null,
                count: { $sum: 1 },
                total: { $sum: "$finalAmount" },
              },
            },
          ],
        },
      },
    ]);

    const data = stats[0];
    const overview = data.overview[0] || {
      total: 0,
      approved: 0,
      totalRevenue: 0,
      totalCommission: 0,
    };

    return {
      total: overview.total,
      approved: overview.approved,
      conversionRate:
        overview.submitted > 0
          ? Math.round((overview.approved / overview.submitted) * 100)
          : 0,
      totalRevenue: overview.totalRevenue,
      totalCommission: overview.totalCommission,
      thisMonth: data.thisMonth[0] || { count: 0, revenue: 0 },
      bySale: data.bySale.map((s: any) => ({
        saleId: s._id.saleId,
        saleName: s._id.saleName,
        total: s.total,
        approved: s.approved,
        conversionRate:
          s.total > 0 ? Math.round((s.approved / Math.max(1, s.total - (s.draft || 0))) * 100) : 0,
        revenue: s.revenue,
      })),
      byType: data.byType,
      bySource: data.bySource,
      pendingOrders: data.pendingValue[0]?.count || 0,
      pendingValue: data.pendingValue[0]?.total || 0,
    };
  }

  async getCommissionReport(
    saleId?: string,
    fromDate?: string,
    toDate?: string,
  ) {
    const filter: any = {};
    if (saleId) filter.saleId = saleId;
    if (fromDate || toDate) {
      filter.createdAt = {};
      if (fromDate) filter.createdAt.$gte = new Date(fromDate);
      if (toDate) filter.createdAt.$lte = new Date(toDate);
    }

    const [details, aggregated] = await Promise.all([
      this.orderModel
        .find(filter)
        .sort({ createdAt: -1 })
        .select('orderCode parentName studentName finalAmount saleCommission status saleName saleId createdAt')
        .limit(2000)
        .lean(),

      this.orderModel.aggregate([
        { $match: filter },
        {
          $facet: {
            byMonth: [
              { $match: { status: { $in: ['COMPLETED', 'APPROVED'] } } },
              {
                $group: {
                  _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
                  revenue: { $sum: { $ifNull: ['$finalAmount', 0] } },
                  commission: { $sum: { $ifNull: ['$saleCommission', 0] } },
                  count: { $sum: 1 },
                },
              },
              { $sort: { _id: -1 } },
            ],
            completedSummary: [
              { $match: { status: 'COMPLETED' } },
              {
                $group: {
                  _id: null,
                  totalRevenue: { $sum: { $ifNull: ['$finalAmount', 0] } },
                  totalCommission: { $sum: { $ifNull: ['$saleCommission', 0] } },
                },
              },
            ],
            approvedSummary: [
              { $match: { status: 'APPROVED' } },
              {
                $group: {
                  _id: null,
                  pendingCommission: { $sum: { $ifNull: ['$saleCommission', 0] } },
                },
              },
            ],
            totalCount: [{ $count: 'count' }],
          },
        },
      ]),
    ]);

    const agg = aggregated[0] || {};
    const completed = agg.completedSummary?.[0] || { totalRevenue: 0, totalCommission: 0 };
    const approved = agg.approvedSummary?.[0] || { pendingCommission: 0 };
    const totalOrders = agg.totalCount?.[0]?.count || 0;

    return {
      details: details.map((o: any) => ({
        _id: o._id,
        orderCode: o.orderCode,
        parentName: o.parentName,
        studentName: o.studentName,
        finalAmount: o.finalAmount || 0,
        saleCommission: o.saleCommission || 0,
        status: o.status,
        saleName: o.saleName,
        saleId: o.saleId,
        createdAt: o.createdAt,
      })),
      byMonth: (agg.byMonth || []).map((m: any) => ({
        month: m._id,
        revenue: m.revenue,
        commission: m.commission,
        count: m.count,
      })),
      summary: {
        totalRevenue: completed.totalRevenue,
        totalCommission: completed.totalCommission,
        pendingCommission: approved.pendingCommission,
        totalOrders,
      },
    };
  }
}
