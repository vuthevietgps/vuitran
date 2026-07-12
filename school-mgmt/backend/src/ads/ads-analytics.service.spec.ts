import { AdsAnalyticsService } from './ads-analytics.service';

describe('AdsAnalyticsService', () => {
  function buildService() {
    const profitService = {
      getAnalytics: jest.fn().mockResolvedValue({
        rows: [],
        summary: {
          totalSpend: 0,
          totalNetProfit: 0,
        },
      }),
      getNetProfitByAdGroup: jest.fn(),
      getSaleFunnelDiagnostics: jest.fn().mockResolvedValue({
        query: {
          startDate: '2026-04-01',
          endDate: '2026-04-30',
          adGroupId: 'g-1',
          saleId: 's-1',
          staleAfterDays: 7,
        },
        rows: [],
        summary: {
          leadCount: 0,
          assignedLeadCount: 0,
          contactedLeadCount: 0,
          staleLeadCount: 0,
          convertedOrderCount: 0,
          approvedOrderCount: 0,
          revenue: 0,
          saleCommission: 0,
          profit: 0,
          netProfit: null,
        },
      }),
    };
    const parentService = {
      getParentProfitability: jest.fn(),
    };
    const cohortService = {
      getRealizedCohortAnalytics: jest.fn().mockResolvedValue({
        basis: 'REALIZED_SESSION_DEDUCT_REFUND + PROJECTED_APPROVED_TUITION_CASH_WITH_SESSION_COSTS',
        maturityDays: 60,
        realizedThrough: '2026-04-30',
        refundRatePercentX: null,
        rows: [],
        summary: {},
      }),
    };
    const suggestionsService = {
      getSuggestions: jest.fn(),
    };
    const actionsService = {
      getActionsRequired: jest.fn().mockResolvedValue({
        actions: [
          {
            type: 'PAUSE_GROUP',
            priority: 'CRITICAL',
            title: 'Pause group',
            description: 'Stop a losing group',
            reasons: ['Net loss exceeds threshold'],
            details: {},
            relatedEntity: { type: 'AdGroup', id: 'g-1' },
            estimatedImpact: {
              dailyProfitChange: 100000,
              monthlyProfitChange: 3000000,
            },
          },
        ],
        summary: {
          totalActiveGroups: 1,
          profitableGroups: 0,
          totalDailySpend: 500000,
          overallEffectiveNetProfit: -3000000,
          overallNetProfit7d: -3000000,
          generatedAt: '2026-04-09T00:00:00.000Z',
        },
      }),
    };

    const service = new AdsAnalyticsService(
      profitService as any,
      parentService as any,
      cohortService as any,
      suggestionsService as any,
      actionsService as any,
    );

    return {
      service,
      profitService,
      parentService,
      cohortService,
      suggestionsService,
      actionsService,
    };
  }

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('delegates getActionsRequired to the refactored actions service', async () => {
    const { service, actionsService } = buildService();
    const options = {
      refundRatePercentX: 15,
      lookbackDays: 14,
      targetProfitableRatio: 0.7,
      totalBudget: 25_000_000,
    };

    await expect(service.getActionsRequired(options)).resolves.toEqual(
      expect.objectContaining({
        actions: expect.arrayContaining([
          expect.objectContaining({
            type: 'PAUSE_GROUP',
            priority: 'CRITICAL',
          }),
        ]),
        summary: expect.objectContaining({
          totalActiveGroups: 1,
          generatedAt: '2026-04-09T00:00:00.000Z',
        }),
      }),
    );

    expect(actionsService.getActionsRequired).toHaveBeenCalledWith(options);
  });

  it('delegates sale funnel diagnostics to the profit analytics service', async () => {
    const { service, profitService } = buildService();

    await expect(service.getSaleFunnelDiagnostics('2026-04-01', '2026-04-30', 'g-1', 's-1')).resolves.toEqual(
      expect.objectContaining({
        query: expect.objectContaining({
          startDate: '2026-04-01',
          endDate: '2026-04-30',
          adGroupId: 'g-1',
          saleId: 's-1',
        }),
      }),
    );

    expect(profitService.getSaleFunnelDiagnostics).toHaveBeenCalledWith('2026-04-01', '2026-04-30', 'g-1', 's-1');
  });

  it('uses cohort effective profit as the main analytics netProfit and keeps order lifecycle profit separately', async () => {
    const { service, profitService, cohortService } = buildService();
    profitService.getAnalytics.mockResolvedValue({
      rows: [
        {
          adGroupId: 'g-1',
          adGroupName: 'Meta',
          platform: 'FACEBOOK',
          totalSpend: 200_000,
          netProfit: 100_000,
          sessionNetProfit: -50_000,
        },
      ],
      summary: {
        totalSpend: 200_000,
        totalNetProfit: 100_000,
      },
    });
    cohortService.getRealizedCohortAnalytics.mockResolvedValue({
      basis: 'REALIZED_SESSION_DEDUCT_REFUND + PROJECTED_APPROVED_TUITION_CASH_WITH_SESSION_COSTS',
      maturityDays: 45,
      realizedThrough: '2026-04-30',
      refundRatePercentX: 10,
      rows: [
        {
          adGroupId: 'g-1',
          collectedRevenue: 2_000_000,
          realizedRevenue: 500_000,
          netRealizedRevenue: 500_000,
          projectedRevenue: 1_800_000,
          remainingSessionUnits: 15,
          estimatedRemainingRefund: 100_000,
          estimatedRemainingTeacherCost: 600_000,
          estimatedRemainingOtherCost: 100_000,
          netProfit: -50_000,
          projectedNetProfit: 450_000,
          effectiveNetProfit: 450_000,
          isMatured: false,
        },
      ],
    });

    const result = await service.getAnalytics('2026-04-01', '2026-04-30', undefined, undefined, 45, 10);

    expect(result.rows[0]).toEqual(
      expect.objectContaining({
        projectedOrderNetProfit: 100_000,
        realizedNetProfit: -50_000,
        effectiveCohortNetProfit: 450_000,
        netProfit: 450_000,
        profitBasis: 'COHORT_EFFECTIVE_NET_PROFIT',
      }),
    );
    expect(result.summary).toEqual(
      expect.objectContaining({
        totalProjectedOrderNetProfit: 100_000,
        totalEffectiveCohortNetProfit: 450_000,
        totalNetProfit: 450_000,
        maturityDays: 45,
        refundRatePercentX: 10,
      }),
    );
  });
});
