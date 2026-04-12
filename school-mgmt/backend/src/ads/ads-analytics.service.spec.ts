import { AdsAnalyticsService } from './ads-analytics.service';

describe('AdsAnalyticsService', () => {
  function buildService() {
    const profitService = {
      getAnalytics: jest.fn(),
      getNetProfitByAdGroup: jest.fn(),
    };
    const parentService = {
      getParentProfitability: jest.fn(),
    };
    const cohortService = {
      getRealizedCohortAnalytics: jest.fn(),
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
            estimatedImpact: { dailyProfitChange: 100000, monthlyProfitChange: 3000000 },
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

    return { service, profitService, parentService, cohortService, suggestionsService, actionsService };
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
});
