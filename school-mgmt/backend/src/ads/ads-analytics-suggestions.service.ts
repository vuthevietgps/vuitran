import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { AdsAnalyticsCohortService } from './ads-analytics-cohort.service';
import { RealizedCohortRow, SuggestionModel } from './ads.types';

import {
  buildSuggestionRecommendation,
  daysInMonth,
  fitLogCurve,
  getUtcDateRange,
  normalizeMaturityDays,
  normalizeRefundRatePercentX,
  roundCurrency,
} from './ads.utils';

@Injectable()
export class AdsAnalyticsSuggestionsService {
  private readonly logger = new Logger(AdsAnalyticsSuggestionsService.name);
  private readonly maxSuggestionRangeDays = 180;

  constructor(
    private readonly cohortService: AdsAnalyticsCohortService,
  ) {}

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
    const cohortAnalytics = await this.cohortService.buildRealizedCohortAnalytics(start, end, {
      maturityDays: normalizedMaturityDays,
      refundRatePercentX: normalizedRefundRatePercentX,
    });
    const dailyRows = cohortAnalytics.rows;
    const maxDailyIncreaseFactor = 1.2;

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
}
