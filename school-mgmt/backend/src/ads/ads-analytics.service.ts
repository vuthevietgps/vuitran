import { Injectable } from '@nestjs/common';
import { AdsAnalyticsProfitService } from './ads-analytics-profit.service';
import { AdsAnalyticsParentService } from './ads-analytics-parent.service';
import { AdsAnalyticsCohortService } from './ads-analytics-cohort.service';
import { AdsAnalyticsSuggestionsService } from './ads-analytics-suggestions.service';
import { AdsAnalyticsActionsService } from './ads-analytics-actions.service';
import { ActionableSuggestion, ActionsRequiredSummary } from './ads.types';

@Injectable()
export class AdsAnalyticsService {
  constructor(
    private readonly profitService: AdsAnalyticsProfitService,
    private readonly parentService: AdsAnalyticsParentService,
    private readonly cohortService: AdsAnalyticsCohortService,
    private readonly suggestionsService: AdsAnalyticsSuggestionsService,
    private readonly actionsService: AdsAnalyticsActionsService,
  ) {}

  async getAnalytics(startDate: string, endDate: string, adGroupId?: string, platform?: string): Promise<any> {
    return this.profitService.getAnalytics(startDate, endDate, adGroupId, platform);
  }

  async getNetProfitByAdGroup(startDate: string, endDate: string, adGroupId?: string): Promise<any> {
    return this.profitService.getNetProfitByAdGroup(startDate, endDate, adGroupId);
  }

  async getParentProfitability(startDate: string, endDate: string, adGroupId?: string, platform?: string): Promise<any> {
    return this.parentService.getParentProfitability(startDate, endDate, adGroupId, platform);
  }

  async getRealizedCohortAnalytics(
    startDate: string,
    endDate: string,
    adGroupId?: string,
    platform?: string,
    maturityDays?: number,
    refundRatePercentX?: number,
  ): Promise<any> {
    return this.cohortService.getRealizedCohortAnalytics(startDate, endDate, adGroupId, platform, maturityDays, refundRatePercentX);
  }

  async getSuggestions(
    startDate: string,
    endDate: string,
    totalBudget: number,
    maturityDays?: number,
    refundRatePercentX?: number,
  ): Promise<any> {
    return this.suggestionsService.getSuggestions(startDate, endDate, totalBudget, maturityDays, refundRatePercentX);
  }

  async getActionsRequired(options?: {
    refundRatePercentX?: number;
    lookbackDays?: number;
    targetProfitableRatio?: number;
    totalBudget?: number;
  }): Promise<{ actions: ActionableSuggestion[]; summary: ActionsRequiredSummary }> {
    return this.actionsService.getActionsRequired(options);
  }
}
