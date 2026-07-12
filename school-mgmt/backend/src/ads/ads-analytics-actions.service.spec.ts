import { AdsAnalyticsActionsService } from './ads-analytics-actions.service';

describe('AdsAnalyticsActionsService', () => {
  function buildService() {
    const profitService = {
      getNetProfitByAdGroup: jest.fn(),
    };
    const suggestionsService = {
      getSuggestions: jest.fn(),
    };
    const service = new AdsAnalyticsActionsService(profitService as any, suggestionsService as any);
    return { service, profitService, suggestionsService };
  }

  it('adds campaign draft recommendations and data readiness to create-group actions', async () => {
    const { service, profitService, suggestionsService } = buildService();
    const adGroupId = '64b000000000000000000041';
    const adAccountId = '64b000000000000000000021';

    profitService.getNetProfitByAdGroup.mockResolvedValue({
      summaryByGroup: [{
        adGroupId,
        adGroupName: 'Facebook Grade 6 Winners',
        adAccountId,
        platform: 'FACEBOOK',
        totalRevenue: 3_000_000,
        totalAdSpend: 700_000,
        totalNetProfit: 1_200_000,
      }],
      overall: {
        totalAdSpend: 700_000,
        totalNetProfit: 1_200_000,
        totalRevenue: 3_000_000,
      },
    });

    const suggestionsReal = {
      totalSuggestedDailySpend: 500_000,
      unallocated: 1_000_000,
      suggestions: [{
        adGroupId,
        adGroupName: 'Facebook Grade 6 Winners',
        adAccountId,
        platform: 'FACEBOOK',
        suggestedDailySpend: 500_000,
        confidence: 'HIGH',
        dataPoints: 7,
        averageProfitPerLead: 250_000,
      }],
      summaryTable: [{
        adGroupId,
        adGroupName: 'Facebook Grade 6 Winners',
        platform: 'FACEBOOK',
        actualAdSpend: 700_000,
        collectedRevenue: 3_000_000,
        projectedRevenue: 3_500_000,
        netProfit: 1_200_000,
        projectedNetProfit: 1_300_000,
        effectiveNetProfit: 1_300_000,
        isMatured: true,
      }],
    };

    suggestionsService.getSuggestions
      .mockResolvedValueOnce(suggestionsReal)
      .mockResolvedValueOnce(suggestionsReal);

    const result = await service.getActionsRequired({ totalBudget: 1_500_000 });
    const createAction = result.actions.find((action) => action.type === 'CREATE_GROUP');

    expect(result.summary.dataReadiness).toMatchObject({
      level: 'PRODUCTION_READY',
      groupsAnalyzed: 1,
      groupsWithModel: 1,
      groupsWithCohortSignal: 1,
      attributionCoveragePercent: 100,
    });
    expect(createAction).toBeDefined();
    expect(createAction?.draftRecommendations).toHaveLength(2);
    expect(createAction?.draftRecommendations?.[0]).toMatchObject({
      platform: 'FACEBOOK',
      adAccountId,
      sourceAdGroupId: adGroupId,
      dailyBudget: 500_000,
      missingFields: [],
      payload: {
        adAccountId,
        platform: 'FACEBOOK',
        dailyBudget: 500_000,
      },
    });
    expect(createAction?.draftRecommendations?.[0].trackingKey).toMatch(/^facebook-\d{8}-1-/);
  });
});
