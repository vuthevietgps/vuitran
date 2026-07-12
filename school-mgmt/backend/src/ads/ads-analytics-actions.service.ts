import { Injectable, Logger } from '@nestjs/common';
import { AdsAnalyticsProfitService } from './ads-analytics-profit.service';
import { AdsAnalyticsSuggestionsService } from './ads-analytics-suggestions.service';
import { ActionableSuggestion, ActionsRequiredSummary, CampaignDraftRecommendation } from './ads.types';

import { toUtcDateOnlyString } from './ads.utils';

@Injectable()
export class AdsAnalyticsActionsService {
  private readonly logger = new Logger(AdsAnalyticsActionsService.name);

  constructor(
    private readonly profitService: AdsAnalyticsProfitService,
    private readonly suggestionsService: AdsAnalyticsSuggestionsService,
  ) {}

  async getActionsRequired(options?: {
    refundRatePercentX?: number;
    lookbackDays?: number;
    targetProfitableRatio?: number;
    totalBudget?: number;
  }): Promise<{ actions: ActionableSuggestion[]; summary: ActionsRequiredSummary }> {
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

    const profitData = await this.profitService.getNetProfitByAdGroup(startDateStr, endDateStr);
    const effectiveBudget = options?.totalBudget != null
      ? options.totalBudget
      : profitData.overall.totalAdSpend > 0
        ? Math.round(profitData.overall.totalAdSpend / lookbackDays)
        : 5_000_000;

    const [suggestionsReal, suggestionsX] = await Promise.all([
      this.suggestionsService.getSuggestions(start90Str, endDateStr, effectiveBudget, 60, undefined).catch(() => null),
      this.suggestionsService.getSuggestions(start90Str, endDateStr, effectiveBudget, 60, refundRateX).catch(() => null),
    ]);

    const actions: ActionableSuggestion[] = [];
    const pausedGroupIds = new Set<string>();

    const realByGroup = new Map<string, any>();
    if (suggestionsReal?.suggestions) {
      for (const s of suggestionsReal.suggestions) realByGroup.set(s.adGroupId, s);
    }
    const xByGroup = new Map<string, any>();
    if (suggestionsX?.suggestions) {
      for (const s of suggestionsX.suggestions) xByGroup.set(s.adGroupId, s);
    }

    const effectiveByGroup = new Map<string, number>();
    const cohortStatsByGroup = this.buildCohortStatsByGroup(suggestionsReal?.summaryTable || []);
    if (suggestionsReal?.summaryTable) {
      for (const row of suggestionsReal.summaryTable) {
        effectiveByGroup.set(row.adGroupId, (effectiveByGroup.get(row.adGroupId) ?? 0) + row.effectiveNetProfit);
      }
    }

    const profitByGroup = new Map<string, any>(
      (profitData.summaryByGroup || []).map((group: any) => [group.adGroupId, group]),
    );
    const allGroupIds = new Set<string>([
      ...Array.from(profitByGroup.keys()),
      ...Array.from(realByGroup.keys()),
      ...Array.from(cohortStatsByGroup.keys()),
    ]);
    const allGroups = Array.from(allGroupIds).map((groupId) => {
      const profitGroup = profitByGroup.get(groupId);
      const suggestionGroup = realByGroup.get(groupId);
      const cohortStats = cohortStatsByGroup.get(groupId);
      return {
        ...(profitGroup || {}),
        adGroupId: groupId,
        adGroupName: profitGroup?.adGroupName || suggestionGroup?.adGroupName || cohortStats?.adGroupName || '',
        adAccountId: profitGroup?.adAccountId || suggestionGroup?.adAccountId || cohortStats?.adAccountId || '',
        platform: profitGroup?.platform || suggestionGroup?.platform || cohortStats?.platform || '',
        totalRevenue: Number(profitGroup?.totalRevenue || cohortStats?.projectedRevenue || 0),
        totalAdSpend: Number(profitGroup?.totalAdSpend || cohortStats?.adSpend || 0),
        totalNetProfit: Number(profitGroup?.totalNetProfit || cohortStats?.actualNetProfit || 0),
      };
    });

    for (const group of allGroups) {
      const realSuggestion = realByGroup.get(group.adGroupId);
      const cohortStats = cohortStatsByGroup.get(group.adGroupId);
      const netProfit7d = group.totalNetProfit;
      const actualDailySpend = lookbackDays > 0 ? group.totalAdSpend / lookbackDays : 0;
      const optimalDailySpend = realSuggestion?.suggestedDailySpend ?? 0;
      const effectiveNetProfit = cohortStats?.effectiveNetProfit ?? effectiveByGroup.get(group.adGroupId) ?? 0;
      const profitPerLead = realSuggestion?.averageProfitPerLead ?? null;
      const dataPoints = realSuggestion?.dataPoints ?? 0;
      const hasEnoughCohortSignal =
        dataPoints >= 5
        || Number(cohortStats?.matureRows || 0) > 0
        || Number(cohortStats?.collectedRevenue || 0) > 0;

      let shouldPause = false;
      const pauseReasons: string[] = [];

      if (effectiveNetProfit < 0 && hasEnoughCohortSignal && (netProfit7d < 0 || profitPerLead === null || profitPerLead < 0)) {
        shouldPause = true;
        pauseReasons.push(
          `Cohort hiệu quả đang lỗ ${Math.abs(effectiveNetProfit).toLocaleString('vi-VN')}đ sau khi tính doanh thu ghi nhận, học phí còn lại, refund dự kiến và chi phí giáo viên còn lại`,
        );
      }

      if (optimalDailySpend > 0 && actualDailySpend > optimalDailySpend * 1.5 && netProfit7d < 0) {
        shouldPause = true;
        const overpct = Math.round(((actualDailySpend - optimalDailySpend) / optimalDailySpend) * 100);
        pauseReasons.push(
          `Chi vượt tối ưu: đang chi ${Math.round(actualDailySpend).toLocaleString('vi-VN')}đ/ngày, tối ưu chỉ ${optimalDailySpend.toLocaleString('vi-VN')}đ/ngày (vượt ${overpct}%)`,
        );
      }

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
          cohortMatureRows: cohortStats?.matureRows || 0,
          cohortImmatureRows: cohortStats?.immatureRows || 0,
          collectedRevenue: cohortStats?.collectedRevenue || 0,
          projectedCohortNetProfit: cohortStats?.projectedNetProfit || 0,
          metricBasis: 'COHORT_EFFECTIVE_NET_PROFIT',
        },
        relatedEntity: { type: 'AdGroup', id: group.adGroupId, name: group.adGroupName },
        estimatedImpact: {
          dailyProfitChange: lookbackDays > 0 ? Math.round(-netProfit7d / lookbackDays) : 0,
          monthlyProfitChange: lookbackDays > 0 ? Math.round(-netProfit7d / lookbackDays) * 30 : 0,
        },
      });
      pausedGroupIds.add(group.adGroupId);
    }

    const SAFE_BUDGET_CHANGE_PERCENT = 0.20;

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

        const profitGain = (s.expectedDailyNetProfit ?? s.observedAverageNetProfit ?? 0)
          - (s.observedAverageNetProfit ?? 0);
        if (Math.abs(profitGain) < 1000) continue;

        const isDecrease = deviationPercentReal > 0;
        const subType: 'INCREASE' | 'DECREASE' = isDecrease ? 'DECREASE' : 'INCREASE';

        const effectiveNetProfitGroup = cohortStatsByGroup.get(s.adGroupId)?.effectiveNetProfit ?? effectiveByGroup.get(s.adGroupId) ?? 0;
        if (!isDecrease && effectiveNetProfitGroup <= 0) continue;

        let safeTarget: number;
        let learningPhaseWarning = false;

        if (isDecrease) {
          const safeDecreaseLimit = actual * (1 - SAFE_BUDGET_CHANGE_PERCENT);
          safeTarget = Math.max(optimalReal, safeDecreaseLimit);
          learningPhaseWarning = optimalReal < safeDecreaseLimit;
        } else {
          const safeIncreaseLimit = actual * (1 + SAFE_BUDGET_CHANGE_PERCENT);
          safeTarget = Math.min(optimalReal, safeIncreaseLimit);
          learningPhaseWarning = optimalReal > safeIncreaseLimit;
        }

        const profitGainAbs = Math.abs(profitGain);
        const priority: ActionableSuggestion['priority'] =
          profitGainAbs > 500_000 ? 'HIGH' : profitGainAbs > 100_000 ? 'MEDIUM' : 'LOW';

        const fmt = (v: number) => Math.round(v).toLocaleString('vi-VN');

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
            safeDailyTarget: Math.round(safeTarget),
            learningPhaseProtected: learningPhaseWarning,
            maxSafeChangePercent: SAFE_BUDGET_CHANGE_PERCENT * 100,
            refundRatePercentX: refundRateX,
            expectedDailyNetProfit: s.expectedDailyNetProfit,
            estimatedDailyProfitGain: Math.round(profitGain),
            estimatedMonthlyProfitGain: Math.round(profitGain * 30),
            confidence: s.confidence,
            deviationPercentReal: Math.round(deviationPercentReal),
            deviationPercentX,
            platform: s.platform,
            effectiveCohortNetProfit: effectiveNetProfitGroup,
            metricBasis: 'COHORT_EFFECTIVE_NET_PROFIT',
          },
          relatedEntity: { type: 'AdGroup', id: s.adGroupId, name: s.adGroupName },
          estimatedImpact: {
            dailyProfitChange: Math.round(profitGain),
            monthlyProfitChange: Math.round(profitGain * 30),
          },
        });
      }
    }

    const getEffectiveGroupProfit = (groupId: string) =>
      cohortStatsByGroup.get(groupId)?.effectiveNetProfit ?? effectiveByGroup.get(groupId) ?? 0;
    const profitableGroups = allGroups.filter((g) => getEffectiveGroupProfit(g.adGroupId) > 0);
    const unprofitableGroups = allGroups.filter((g) => getEffectiveGroupProfit(g.adGroupId) <= 0);
    const currentProfitableCount = profitableGroups.length;
    const targetProfitableCount = Math.max(3, Math.ceil(allGroups.length * targetProfitableRatio));
    const groupDeficit = Math.max(0, targetProfitableCount - currentProfitableCount);
    const totalUnallocated = suggestionsReal?.unallocated ?? 0;

    const accountOverallProfit = allGroups.reduce((sum, g) => sum + getEffectiveGroupProfit(g.adGroupId), 0);
    const isAccountInLoss = accountOverallProfit < 0;

    const profitableWithModel = profitableGroups
      .map((g) => realByGroup.get(g.adGroupId))
      .filter((s): s is any => s != null && s.confidence !== 'LOW' && s.suggestedDailySpend > 0);
    const avgDailySpendProfitable = profitableWithModel.length > 0
      ? Math.round(profitableWithModel.reduce((sum: number, s: any) => sum + s.suggestedDailySpend, 0) / profitableWithModel.length)
      : 0;

    let suggestedNewGroupCount = 0;
    let totalSuggestedNewGroups = 0;

    if (isAccountInLoss) {
      suggestedNewGroupCount = 0;
      totalSuggestedNewGroups = 0;

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
      if (allGroups.length === 0) {
        suggestedNewGroupCount = 0;
        totalSuggestedNewGroups = 0;
      } else {
        if (totalUnallocated > 0 && avgDailySpendProfitable > 0) {
          suggestedNewGroupCount = Math.min(Math.floor(totalUnallocated / avgDailySpendProfitable), 5);
        }
        totalSuggestedNewGroups = Math.min(Math.max(suggestedNewGroupCount, groupDeficit), 5);
      }
    }

    if (totalSuggestedNewGroups > 0) {
      const platformRoiMap: Record<string, { totalEffectiveProfit: number; totalAdSpend: number; profitableCount: number }> = {};
      for (const group of allGroups) {
        if (!platformRoiMap[group.platform]) {
          platformRoiMap[group.platform] = { totalEffectiveProfit: 0, totalAdSpend: 0, profitableCount: 0 };
        }
        platformRoiMap[group.platform].totalEffectiveProfit += getEffectiveGroupProfit(group.adGroupId);
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
            ? Math.round((data.totalEffectiveProfit / data.totalAdSpend) * 100)
            : 0,
        };
      }

      const suggestedPlatform = Object.entries(platformBreakdown)
        .sort((a, b) => b[1].avgROI - a[1].avgROI)[0]?.[0] ?? 'FACEBOOK';
      const bestPlatformROI = platformBreakdown[suggestedPlatform]?.avgROI ?? 0;

      const avgProfitPerProfitableGroup = profitableGroups.length > 0
        ? Math.round(
          profitableGroups.reduce((sum, g) => sum + getEffectiveGroupProfit(g.adGroupId), 0)
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
      const draftRecommendations = this.buildCampaignDraftRecommendations({
        count: totalSuggestedNewGroups,
        platform: suggestedPlatform,
        dailyBudget: suggestedBudgetPerNewGroup,
        sourceGroups: profitableGroups,
        avgProfitPerProfitableGroup,
        bestPlatformROI,
      });

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
          draftRecommendationCount: draftRecommendations.length,
          platformBreakdown,
          avgProfitPerProfitableGroup,
          estimatedMonthlyProfitIfSuccessful: estimatedMonthlyProfit,
        },
        estimatedImpact: {
          dailyProfitChange: Math.round(avgProfitPerProfitableGroup * totalSuggestedNewGroups),
          monthlyProfitChange: estimatedMonthlyProfit,
        },
        draftRecommendations,
      });
    }

    const priorityOrder: Record<string, number> = { CRITICAL: 1, HIGH: 2, MEDIUM: 3, LOW: 4 };
    actions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    const totalOptimalDailySpend = suggestionsReal?.totalSuggestedDailySpend ?? 0;
    const overallEffectiveNetProfit = accountOverallProfit;
    const dataReadiness = this.buildDataReadiness({
      allGroups,
      realByGroup,
      cohortStatsByGroup,
      summaryTable: suggestionsReal?.summaryTable || [],
      totalRevenue: profitData.overall.totalRevenue || 0,
    });

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
        dataReadiness,
        generatedAt: new Date().toISOString(),
      },
    };
  }

  private buildCampaignDraftRecommendations(input: {
    count: number;
    platform: string;
    dailyBudget: number;
    sourceGroups: any[];
    avgProfitPerProfitableGroup: number;
    bestPlatformROI: number;
  }): CampaignDraftRecommendation[] {
    const count = Math.max(0, Math.min(5, Math.floor(input.count || 0)));
    const sourceGroups = input.sourceGroups
      .filter((group) => !input.platform || group.platform === input.platform)
      .sort((a, b) => Number(b.totalNetProfit || 0) - Number(a.totalNetProfit || 0));
    const fallbackSources = sourceGroups.length ? sourceGroups : input.sourceGroups;
    const today = toUtcDateOnlyString(new Date());

    return Array.from({ length: count }).map((_, index) => {
      const source = fallbackSources[index % Math.max(1, fallbackSources.length)] || {};
      const platform = input.platform || source.platform || 'FACEBOOK';
      const sourceName = source.adGroupName || `${platform} benchmark`;
      const draftName = `${platform} scale test ${index + 1} - ${sourceName}`.slice(0, 120);
      const trackingKey = this.buildTrackingKey(platform, draftName, index + 1, today);
      const targetAudience = this.buildTargetAudience(platform, sourceName);
      const targetDailyNetProfit = Math.max(0, Math.round(input.avgProfitPerProfitableGroup || 0));
      const payload: CampaignDraftRecommendation['payload'] = {
        name: draftName,
        ...(source.adAccountId ? { adAccountId: source.adAccountId } : {}),
        platform,
        dailyBudget: Math.max(0, Math.round(input.dailyBudget || 0)),
        targetAudience,
        trackingKeys: [trackingKey],
        notes: [
          `AI scale draft from source group: ${sourceName}`,
          `Expected ROI benchmark: ${input.bestPlatformROI}%`,
          'Keep PAUSED until creative, landing page, pixel/offline conversion and approval are verified.',
        ].join('\n'),
      };

      return {
        draftName,
        platform,
        ...(source.adAccountId ? { adAccountId: source.adAccountId } : {}),
        ...(source.adGroupId ? { sourceAdGroupId: source.adGroupId } : {}),
        ...(source.adGroupName ? { sourceAdGroupName: source.adGroupName } : {}),
        dailyBudget: payload.dailyBudget,
        targetAudience,
        trackingKey,
        objective: this.buildObjective(platform),
        offerAngle: this.buildOfferAngle(sourceName),
        kpi: {
          targetCpl: null,
          targetCpo: null,
          targetDailyNetProfit,
        },
        payload,
        missingFields: source.adAccountId ? [] : ['adAccountId'],
        launchChecklist: [
          'Confirm ad account and billing are active.',
          'Attach approved creative/copy and landing page.',
          'Verify tracking key is present on the landing page form.',
          'Verify pixel/offline conversion event mapping.',
          'Start paused; publish only after human approval.',
        ],
      };
    });
  }

  private buildDataReadiness(input: {
    allGroups: any[];
    realByGroup: Map<string, any>;
    cohortStatsByGroup: Map<string, any>;
    summaryTable: any[];
    totalRevenue: number;
  }): ActionsRequiredSummary['dataReadiness'] {
    const groupsAnalyzed = input.allGroups.length;
    const groupsWithModel = input.allGroups
      .filter((group) => Number(input.realByGroup.get(group.adGroupId)?.dataPoints || 0) >= 5)
      .length;
    const groupsWithCohortSignal = input.allGroups.filter((group) => {
      const stats = input.cohortStatsByGroup.get(group.adGroupId);
      return Number(stats?.matureRows || 0) > 0
        || Number(stats?.collectedRevenue || 0) > 0
        || Number(stats?.projectedRevenue || 0) > 0;
    }).length;
    const matureCohortRows = input.summaryTable.filter((row) => row.isMatured).length;
    const attributionCoveragePercent = groupsAnalyzed > 0
      ? Math.round((groupsWithCohortSignal / groupsAnalyzed) * 100)
      : 0;

    let score = 0;
    if (groupsAnalyzed > 0) score += 15;
    score += Math.min(30, attributionCoveragePercent * 0.3);
    score += groupsAnalyzed > 0 ? Math.min(25, (groupsWithModel / groupsAnalyzed) * 25) : 0;
    score += matureCohortRows > 0 ? 15 : 0;
    score += input.totalRevenue > 0 ? 15 : 0;
    score = Math.round(Math.min(100, score));

    const warnings: string[] = [];
    if (groupsAnalyzed === 0) warnings.push('No ad groups were available for analysis.');
    if (attributionCoveragePercent < 70) warnings.push('Attribution coverage is below 70%; verify tracking keys and lead/order mapping.');
    if (groupsWithModel < Math.ceil(groupsAnalyzed / 2)) warnings.push('Fewer than half of ad groups have enough model data points.');
    if (matureCohortRows === 0) warnings.push('No matured cohort rows yet; projections may be unstable.');
    if (input.totalRevenue <= 0) warnings.push('No recognized revenue in the analysis window.');

    return {
      score,
      level: score >= 85 ? 'PRODUCTION_READY' : score >= 70 ? 'GOOD' : score >= 50 ? 'NEEDS_REVIEW' : 'WEAK',
      groupsAnalyzed,
      groupsWithModel,
      groupsWithCohortSignal,
      matureCohortRows,
      attributionCoveragePercent,
      warnings,
    };
  }

  private buildTrackingKey(platform: string, draftName: string, index: number, date: string): string {
    const slug = draftName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 42) || 'campaign';
    return `${platform.toLowerCase()}-${date.replace(/-/g, '')}-${index}-${slug}`;
  }

  private buildTargetAudience(platform: string, sourceName: string): string {
    if (platform === 'GOOGLE') return `High-intent search demand related to ${sourceName}; split exact/phrase tests before broad expansion.`;
    if (platform === 'TIKTOK') return `Parents and students matching ${sourceName}; test broad interest + retargeting viewers separately.`;
    return `Parents similar to profitable group ${sourceName}; test broad, lookalike and retargeting in separate ad sets.`;
  }

  private buildObjective(platform: string): string {
    if (platform === 'GOOGLE') return 'Capture high-intent leads with measurable form submissions.';
    if (platform === 'TIKTOK') return 'Validate new audience/creative angle while protecting daily budget.';
    return 'Scale profitable parent lead acquisition with controlled budget and clean attribution.';
  }

  private buildOfferAngle(sourceName: string): string {
    return `Clone the strongest promise from "${sourceName}", but create a fresh audience/creative test so performance can be measured independently.`;
  }

  private buildCohortStatsByGroup(rows: any[]): Map<string, any> {
    const result = new Map<string, any>();
    for (const row of rows || []) {
      const groupId = row.adGroupId;
      if (!groupId) continue;
      if (!result.has(groupId)) {
        result.set(groupId, {
          adGroupId: groupId,
          adGroupName: row.adGroupName || '',
          platform: row.platform || '',
          adSpend: 0,
          collectedRevenue: 0,
          realizedRevenue: 0,
          projectedRevenue: 0,
          actualNetProfit: 0,
          projectedNetProfit: 0,
          effectiveNetProfit: 0,
          matureRows: 0,
          immatureRows: 0,
        });
      }
      const target = result.get(groupId);
      target.adSpend += Number(row.actualAdSpend || 0);
      target.collectedRevenue += Number(row.collectedRevenue || 0);
      target.realizedRevenue += Number(row.realizedRevenue || 0);
      target.projectedRevenue += Number(row.projectedRevenue || 0);
      target.actualNetProfit += Number(row.netProfit || 0);
      target.projectedNetProfit += Number(row.projectedNetProfit || 0);
      target.effectiveNetProfit += Number(row.effectiveNetProfit || 0);
      if (row.isMatured) target.matureRows += 1;
      else target.immatureRows += 1;
    }
    return result;
  }
}
