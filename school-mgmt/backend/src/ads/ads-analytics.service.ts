import { Injectable } from '@nestjs/common';
import { AdsAnalyticsProfitService } from './ads-analytics-profit.service';
import { AdsAnalyticsParentService } from './ads-analytics-parent.service';
import { AdsAnalyticsCohortService } from './ads-analytics-cohort.service';
import { AdsAnalyticsSuggestionsService } from './ads-analytics-suggestions.service';
import { AdsAnalyticsActionsService } from './ads-analytics-actions.service';
import { ActionableSuggestion, ActionsRequiredSummary, SaleFunnelDiagnosticsResponse } from './ads.types';

@Injectable()
export class AdsAnalyticsService {
  constructor(
    private readonly profitService: AdsAnalyticsProfitService,
    private readonly parentService: AdsAnalyticsParentService,
    private readonly cohortService: AdsAnalyticsCohortService,
    private readonly suggestionsService: AdsAnalyticsSuggestionsService,
    private readonly actionsService: AdsAnalyticsActionsService,
  ) {}

  async getAnalytics(
    startDate: string,
    endDate: string,
    adGroupId?: string,
    platform?: string,
    maturityDays?: number,
    refundRatePercentX?: number,
  ): Promise<any> {
    const [orderAnalytics, cohortAnalytics] = await Promise.all([
      this.profitService.getAnalytics(startDate, endDate, adGroupId, platform),
      this.cohortService.getRealizedCohortAnalytics(
        startDate,
        endDate,
        adGroupId,
        platform,
        maturityDays,
        refundRatePercentX,
      ),
    ]);

    return this.mergeCohortProfit(orderAnalytics, cohortAnalytics);
  }

  async getNetProfitByAdGroup(startDate: string, endDate: string, adGroupId?: string): Promise<any> {
    return this.profitService.getNetProfitByAdGroup(startDate, endDate, adGroupId);
  }

  async getSaleFunnelDiagnostics(
    startDate: string,
    endDate: string,
    adGroupId?: string,
    saleId?: string,
  ): Promise<SaleFunnelDiagnosticsResponse> {
    return this.profitService.getSaleFunnelDiagnostics(startDate, endDate, adGroupId, saleId);
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

  private mergeCohortProfit(orderAnalytics: any, cohortAnalytics: any): any {
    const cohortByGroup = new Map<string, any>();

    for (const row of cohortAnalytics?.rows || []) {
      const groupId = row.adGroupId;
      if (!groupId) continue;
      if (!cohortByGroup.has(groupId)) {
        cohortByGroup.set(groupId, {
          collectedRevenue: 0,
          cohortRealizedRevenue: 0,
          netRealizedRevenue: 0,
          projectedCohortRevenue: 0,
          remainingSessionUnits: 0,
          estimatedRemainingRefund: 0,
          estimatedRemainingTeacherCost: 0,
          estimatedRemainingOtherCost: 0,
          actualCohortNetProfit: 0,
          projectedCohortNetProfit: 0,
          effectiveCohortNetProfit: 0,
          matureRowCount: 0,
          immatureRowCount: 0,
        });
      }
      const target = cohortByGroup.get(groupId);
      target.collectedRevenue += Number(row.collectedRevenue || 0);
      target.cohortRealizedRevenue += Number(row.realizedRevenue || 0);
      target.netRealizedRevenue += Number(row.netRealizedRevenue || 0);
      target.projectedCohortRevenue += Number(row.projectedRevenue || 0);
      target.remainingSessionUnits += Number(row.remainingSessionUnits || 0);
      target.estimatedRemainingRefund += Number(row.estimatedRemainingRefund || 0);
      target.estimatedRemainingTeacherCost += Number(row.estimatedRemainingTeacherCost || 0);
      target.estimatedRemainingOtherCost += Number(row.estimatedRemainingOtherCost || 0);
      target.actualCohortNetProfit += Number(row.netProfit || 0);
      target.projectedCohortNetProfit += Number(row.projectedNetProfit || 0);
      target.effectiveCohortNetProfit += Number(row.effectiveNetProfit || 0);
      if (row.isMatured) target.matureRowCount += 1;
      else target.immatureRowCount += 1;
    }

    const rows = (orderAnalytics?.rows || []).map((row: any) => {
      const cohort = cohortByGroup.get(row.adGroupId);
      const projectedOrderNetProfit = Number(row.netProfit || 0);
      const realizedNetProfit = Number(row.sessionNetProfit || 0);
      const effectiveCohortNetProfit = cohort
        ? Number(cohort.effectiveCohortNetProfit || 0)
        : projectedOrderNetProfit;
      const roi = row.totalSpend > 0 ? Math.round((effectiveCohortNetProfit / row.totalSpend) * 10000) / 100 : 0;

      return {
        ...row,
        projectedOrderNetProfit,
        realizedNetProfit,
        collectedRevenue: cohort?.collectedRevenue || 0,
        cohortRealizedRevenue: cohort?.cohortRealizedRevenue || 0,
        netRealizedRevenue: cohort?.netRealizedRevenue || 0,
        projectedCohortRevenue: cohort?.projectedCohortRevenue || 0,
        remainingSessionUnits: cohort?.remainingSessionUnits || 0,
        estimatedRemainingRefund: cohort?.estimatedRemainingRefund || 0,
        estimatedRemainingTeacherCost: cohort?.estimatedRemainingTeacherCost || 0,
        estimatedRemainingOtherCost: cohort?.estimatedRemainingOtherCost || 0,
        actualCohortNetProfit: cohort?.actualCohortNetProfit ?? realizedNetProfit,
        projectedCohortNetProfit: cohort?.projectedCohortNetProfit ?? projectedOrderNetProfit,
        effectiveCohortNetProfit,
        cohortMatureRowCount: cohort?.matureRowCount || 0,
        cohortImmatureRowCount: cohort?.immatureRowCount || 0,
        netProfit: effectiveCohortNetProfit,
        roi,
        profitBasis: cohort
          ? 'COHORT_EFFECTIVE_NET_PROFIT'
          : 'ORDER_LIFECYCLE_NET_PROFIT_FALLBACK',
      };
    });

    const summary = {
      ...orderAnalytics.summary,
      totalProjectedOrderNetProfit: rows.reduce((sum: number, row: any) => sum + row.projectedOrderNetProfit, 0),
      totalRealizedNetProfit: rows.reduce((sum: number, row: any) => sum + row.realizedNetProfit, 0),
      totalCollectedRevenue: rows.reduce((sum: number, row: any) => sum + row.collectedRevenue, 0),
      totalCohortRealizedRevenue: rows.reduce((sum: number, row: any) => sum + row.cohortRealizedRevenue, 0),
      totalNetRealizedRevenue: rows.reduce((sum: number, row: any) => sum + row.netRealizedRevenue, 0),
      totalProjectedCohortRevenue: rows.reduce((sum: number, row: any) => sum + row.projectedCohortRevenue, 0),
      totalRemainingSessionUnits: rows.reduce((sum: number, row: any) => sum + row.remainingSessionUnits, 0),
      totalEstimatedRemainingRefund: rows.reduce((sum: number, row: any) => sum + row.estimatedRemainingRefund, 0),
      totalEstimatedRemainingTeacherCost: rows.reduce((sum: number, row: any) => sum + row.estimatedRemainingTeacherCost, 0),
      totalEstimatedRemainingOtherCost: rows.reduce((sum: number, row: any) => sum + row.estimatedRemainingOtherCost, 0),
      totalActualCohortNetProfit: rows.reduce((sum: number, row: any) => sum + row.actualCohortNetProfit, 0),
      totalProjectedCohortNetProfit: rows.reduce((sum: number, row: any) => sum + row.projectedCohortNetProfit, 0),
      totalEffectiveCohortNetProfit: rows.reduce((sum: number, row: any) => sum + row.effectiveCohortNetProfit, 0),
      totalNetProfit: rows.reduce((sum: number, row: any) => sum + row.netProfit, 0),
      profitBasis: 'COHORT_EFFECTIVE_NET_PROFIT_WITH_ORDER_LIFECYCLE_FALLBACK',
      cohortBasis: cohortAnalytics?.basis,
      maturityDays: cohortAnalytics?.maturityDays,
      refundRatePercentX: cohortAnalytics?.refundRatePercentX,
      realizedThrough: cohortAnalytics?.realizedThrough,
    };

    summary.avgRoi = summary.totalSpend > 0
      ? Math.round((summary.totalNetProfit / summary.totalSpend) * 10000) / 100
      : 0;

    return { rows, summary };
  }
}
