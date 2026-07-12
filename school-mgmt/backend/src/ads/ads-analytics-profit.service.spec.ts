import { BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';
import { AdsAnalyticsProfitService } from './ads-analytics-profit.service';
import { OrderStatus } from '../orders/schemas/order.schema';

function buildFindResult<T>(value: T) {
  return {
    select: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(value),
  };
}

function buildService(
  overrides: Partial<{
    adCostModel: any;
    adGroupModel: any;
    expenseModel: any;
    groupProfitCostService: any;
    leadModel: any;
    orderModel: any;
    sessionModel: any;
  }> = {},
) {
  const adGroupModel = overrides.adGroupModel ?? {
    find: jest.fn().mockReturnValue(buildFindResult([])),
  };
  const leadModel = overrides.leadModel ?? {
    aggregate: jest.fn().mockResolvedValue([]),
  };
  const orderModel = overrides.orderModel ?? {
    aggregate: jest.fn().mockResolvedValue([]),
  };
  const groupProfitCostService = overrides.groupProfitCostService ?? {
    buildBreakdownByAdGroup: jest.fn().mockResolvedValue(new Map()),
  };

  const service = new AdsAnalyticsProfitService(
    (overrides.adCostModel ?? { aggregate: jest.fn() }) as any,
    adGroupModel as any,
    (overrides.expenseModel ?? { aggregate: jest.fn() }) as any,
    leadModel as any,
    orderModel as any,
    (overrides.sessionModel ?? { aggregate: jest.fn() }) as any,
    groupProfitCostService as any,
  );

  return { service, adGroupModel, groupProfitCostService, leadModel, orderModel };
}

describe('AdsAnalyticsProfitService sale funnel diagnostics', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('merges lead and order diagnostics by ad group and sale', async () => {
    const adGroupId = new Types.ObjectId();
    const saleId = new Types.ObjectId();
    const leadModel = {
      aggregate: jest.fn().mockResolvedValue([
        {
          _id: { adGroupId, saleId },
          adGroupName: 'Meta Lead Gen',
          saleName: 'Sale A',
          leadCount: 10,
          assignedLeadCount: 9,
          contactedLeadCount: 6,
          staleLeadCount: 2,
        },
      ]),
    };
    const orderModel = {
      aggregate: jest.fn().mockResolvedValue([
        {
          _id: { adGroupId, saleId },
          adGroupName: 'Meta Lead Gen',
          saleName: 'Sale A',
          convertedOrderCount: 3,
          approvedOrderCount: 2,
          revenue: 1_200_000,
          saleCommission: 120_000,
        },
      ]),
    };
    const adGroupModel = {
      find: jest.fn().mockReturnValue(
        buildFindResult([
          {
            _id: adGroupId,
            name: 'Meta Lead Gen',
            platform: 'FACEBOOK',
          },
        ]),
      ),
    };
    const { service } = buildService({ adGroupModel, leadModel, orderModel });

    const result = await service.getSaleFunnelDiagnostics('2026-04-01', '2026-04-30');

    expect(result.rows).toEqual([
      expect.objectContaining({
        adGroupId: adGroupId.toString(),
        adGroupName: 'Meta Lead Gen',
        platform: 'FACEBOOK',
        saleId: saleId.toString(),
        saleName: 'Sale A',
        leadCount: 10,
        assignedLeadCount: 9,
        contactedLeadCount: 6,
        staleLeadCount: 2,
        convertedOrderCount: 3,
        approvedOrderCount: 2,
        revenue: 1_200_000,
        saleCommission: 120_000,
        profit: 1_080_000,
        netProfit: null,
        profitBasis: 'ORDER_REVENUE_MINUS_SALE_COMMISSION',
        netProfitBasis: null,
      }),
    ]);
    expect(result.summary).toEqual(
      expect.objectContaining({
        leadCount: 10,
        assignedLeadCount: 9,
        contactedLeadCount: 6,
        staleLeadCount: 2,
        convertedOrderCount: 3,
        approvedOrderCount: 2,
        revenue: 1_200_000,
        saleCommission: 120_000,
        profit: 1_080_000,
        netProfit: null,
      }),
    );
  });

  it('applies optional adGroupId and saleId filters to lead and order matches', async () => {
    const adGroupId = new Types.ObjectId();
    const saleId = new Types.ObjectId();
    const { service, leadModel, orderModel } = buildService();

    await service.getSaleFunnelDiagnostics('2026-04-01', '2026-04-30', adGroupId.toString(), saleId.toString());

    const leadMatch = leadModel.aggregate.mock.calls[0][0][0].$match;
    const orderMatch = orderModel.aggregate.mock.calls[0][0][0].$match;
    expect(leadMatch.adGroupId).toEqual(adGroupId);
    expect(leadMatch.saleId).toEqual(saleId);
    expect(orderMatch.adGroupId).toEqual(adGroupId);
    expect(orderMatch.saleId).toEqual(saleId);
  });

  it('counts only active order statuses as converted orders in the aggregation', async () => {
    const { service, orderModel } = buildService();

    await service.getSaleFunnelDiagnostics('2026-04-01', '2026-04-30');

    const orderGroup = orderModel.aggregate.mock.calls[0][0][1].$group;
    expect(orderGroup.convertedOrderCount.$sum.$cond[0].$in[1]).toEqual([
      OrderStatus.DRAFT,
      OrderStatus.SUBMITTED,
      OrderStatus.NEEDS_INFO,
      OrderStatus.APPROVED,
      OrderStatus.COMPLETED,
    ]);
    expect(orderGroup.approvedOrderCount.$sum.$cond[0].$in[1]).toEqual([OrderStatus.APPROVED, OrderStatus.COMPLETED]);
  });

  it('rejects invalid saleId values', async () => {
    const { service } = buildService();

    await expect(
      service.getSaleFunnelDiagnostics('2026-04-01', '2026-04-30', undefined, 'bad-id'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('AdsAnalyticsProfitService analytics overview', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('calculates group net profit from orders, ad spend, teacher cost, overhead, and staff labor', async () => {
    const adGroupId = new Types.ObjectId();
    const adCostModel = {
      aggregate: jest
        .fn()
        .mockResolvedValueOnce([
          {
            _id: adGroupId,
            totalSpend: 200_000,
            totalImpressions: 1_000,
            totalClicks: 50,
            totalConversions: 3,
            adGroupName: 'Meta Orders',
            platform: 'FACEBOOK',
          },
        ])
        .mockResolvedValueOnce([
          {
            _id: { adGroupId, date: '2026-04-10' },
            adSpend: 200_000,
            adGroupName: 'Meta Orders',
            platform: 'FACEBOOK',
          },
        ]),
    };
    const leadModel = {
      aggregate: jest.fn().mockResolvedValue([{ _id: adGroupId, leadCount: 4 }]),
    };
    const orderModel = {
      aggregate: jest.fn().mockResolvedValue([
        {
          _id: adGroupId,
          orderCount: 1,
          revenue: 2_000_000,
          saleCommission: 150_000,
        },
      ]),
    };
    const sessionModel = {
      aggregate: jest
        .fn()
        .mockResolvedValueOnce([
          {
            _id: { adGroupId, date: '2026-04-10' },
            revenue: 900_000,
            teacherCost: 100_000,
            sessionCount: 1,
            adGroupName: 'Meta Orders',
          },
        ])
        .mockResolvedValueOnce([{ _id: '2026-04-10', totalSessions: 1 }]),
    };
    const expenseModel = {
      aggregate: jest.fn().mockResolvedValue([]),
    };
    const groupProfitCostService = {
      buildBreakdownByAdGroup: jest.fn().mockResolvedValue(
        new Map([
          [
            adGroupId.toString(),
            {
              estimatedTeacherCost: 1_000_000,
              directParentExpense: 50_000,
              allocatedGroupExpense: 80_000,
              allocatedGlobalExpense: 120_000,
              allocatedStaffLaborCost: 300_000,
            },
          ],
        ]),
      ),
    };
    const adGroupModel = {
      find: jest.fn().mockReturnValue(
        buildFindResult([
          {
            _id: adGroupId,
            name: 'Meta Orders',
            platform: 'FACEBOOK',
          },
        ]),
      ),
    };
    const { service } = buildService({
      adCostModel,
      adGroupModel,
      expenseModel,
      groupProfitCostService,
      leadModel,
      orderModel,
      sessionModel,
    });

    const result = await service.getAnalytics('2026-04-10', '2026-04-10');
    const row = result.rows[0];

    expect(row).toEqual(
      expect.objectContaining({
        adGroupId: adGroupId.toString(),
        totalSpend: 200_000,
        leadCount: 4,
        orderCount: 1,
        revenue: 2_000_000,
        bookedRevenue: 2_000_000,
        recognizedRevenue: 900_000,
        saleCommission: 150_000,
        estimatedTeacherCost: 1_000_000,
        directParentExpense: 50_000,
        allocatedGroupExpense: 80_000,
        allocatedGlobalExpense: 120_000,
        allocatedStaffLaborCost: 300_000,
        otherCost: 250_000,
        operatingCost: 550_000,
        totalCost: 1_900_000,
        orderProfit: 850_000,
        sessionNetProfit: 600_000,
        netProfit: 100_000,
        roi: 50,
        profitBasis: 'ORDER_REVENUE_MINUS_ALL_ALLOCATED_COSTS',
      }),
    );
    expect(result.summary).toEqual(
      expect.objectContaining({
        totalSpend: 200_000,
        totalRevenue: 2_000_000,
        totalBookedRevenue: 2_000_000,
        totalRecognizedRevenue: 900_000,
        totalSaleCommission: 150_000,
        totalEstimatedTeacherCost: 1_000_000,
        totalDirectParentExpense: 50_000,
        totalAllocatedGroupExpense: 80_000,
        totalAllocatedGlobalExpense: 120_000,
        totalAllocatedStaffLaborCost: 300_000,
        totalOtherCost: 250_000,
        totalOperatingCost: 550_000,
        totalCost: 1_900_000,
        totalOrderProfit: 850_000,
        totalSessionNetProfit: 600_000,
        totalNetProfit: 100_000,
        avgCostPerOrder: 200_000,
        avgRoi: 50,
        profitBasis: 'ORDER_REVENUE_MINUS_ALL_ALLOCATED_COSTS',
      }),
    );
    expect(groupProfitCostService.buildBreakdownByAdGroup).toHaveBeenCalled();
  });
});
