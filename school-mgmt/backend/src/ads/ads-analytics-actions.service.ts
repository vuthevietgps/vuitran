import { Injectable, Logger } from '@nestjs/common';
import { AdsAnalyticsProfitService } from './ads-analytics-profit.service';
import { AdsAnalyticsSuggestionsService } from './ads-analytics-suggestions.service';
import { ActionableSuggestion, ActionsRequiredSummary } from './ads.types';

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
    if (suggestionsReal?.summaryTable) {
      for (const row of suggestionsReal.summaryTable) {
        effectiveByGroup.set(row.adGroupId, (effectiveByGroup.get(row.adGroupId) ?? 0) + row.effectiveNetProfit);
      }
    }

    for (const group of profitData.summaryByGroup) {
      const realSuggestion = realByGroup.get(group.adGroupId);
      const netProfit7d = group.totalNetProfit;
      const actualDailySpend = lookbackDays > 0 ? group.totalAdSpend / lookbackDays : 0;
      const optimalDailySpend = realSuggestion?.suggestedDailySpend ?? 0;
      const effectiveNetProfit = effectiveByGroup.get(group.adGroupId) ?? 0;
      const profitPerLead = realSuggestion?.averageProfitPerLead ?? null;
      const dataPoints = realSuggestion?.dataPoints ?? 0;

      let shouldPause = false;
      const pauseReasons: string[] = [];

      if (netProfit7d < 0 && effectiveNetProfit < 0) {
        shouldPause = true;
        pauseReasons.push(
          `Lỗ liên tục: lỗ ${Math.abs(netProfit7d).toLocaleString('vi-VN')}đ trong ${lookbackDays} ngày và cohort lỗ ${Math.abs(effectiveNetProfit).toLocaleString('vi-VN')}đ`,
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

        const effectiveNetProfitGroup = effectiveByGroup.get(s.adGroupId) ?? 0;
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
          },
          relatedEntity: { type: 'AdGroup', id: s.adGroupId, name: s.adGroupName },
          estimatedImpact: {
            dailyProfitChange: Math.round(profitGain),
            monthlyProfitChange: Math.round(profitGain * 30),
          },
        });
      }
    }

    const allGroups = profitData.summaryByGroup;
    const profitableGroups = allGroups.filter((g) => (effectiveByGroup.get(g.adGroupId) ?? 0) > 0);
    const unprofitableGroups = allGroups.filter((g) => (effectiveByGroup.get(g.adGroupId) ?? 0) <= 0);
    const currentProfitableCount = profitableGroups.length;
    const targetProfitableCount = Math.max(3, Math.ceil(allGroups.length * targetProfitableRatio));
    const groupDeficit = Math.max(0, targetProfitableCount - currentProfitableCount);
    const totalUnallocated = suggestionsReal?.unallocated ?? 0;

    const accountOverallProfit = allGroups.reduce((sum, g) => sum + (effectiveByGroup.get(g.adGroupId) ?? 0), 0);
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
      const platformRoiMap: Record<string, { totalRevenue: number; totalAdSpend: number; profitableCount: number }> = {};
      for (const group of allGroups) {
        if (!platformRoiMap[group.platform]) {
          platformRoiMap[group.platform] = { totalRevenue: 0, totalAdSpend: 0, profitableCount: 0 };
        }
        platformRoiMap[group.platform].totalRevenue += group.totalRevenue;
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
            ? Math.round(((data.totalRevenue - data.totalAdSpend) / data.totalAdSpend) * 100)
            : 0,
        };
      }

      const suggestedPlatform = Object.entries(platformBreakdown)
        .sort((a, b) => b[1].avgROI - a[1].avgROI)[0]?.[0] ?? 'FACEBOOK';
      const bestPlatformROI = platformBreakdown[suggestedPlatform]?.avgROI ?? 0;

      const avgProfitPerProfitableGroup = profitableGroups.length > 0
        ? Math.round(
          profitableGroups.reduce((sum, g) => sum + (effectiveByGroup.get(g.adGroupId) ?? 0), 0)
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
          platformBreakdown,
          avgProfitPerProfitableGroup,
          estimatedMonthlyProfitIfSuccessful: estimatedMonthlyProfit,
        },
        estimatedImpact: {
          dailyProfitChange: Math.round(avgProfitPerProfitableGroup * totalSuggestedNewGroups),
          monthlyProfitChange: estimatedMonthlyProfit,
        },
      });
    }

    const priorityOrder: Record<string, number> = { CRITICAL: 1, HIGH: 2, MEDIUM: 3, LOW: 4 };
    actions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    const totalOptimalDailySpend = suggestionsReal?.totalSuggestedDailySpend ?? 0;
    const overallEffectiveNetProfit = Array.from(effectiveByGroup.values()).reduce((sum, v) => sum + v, 0);

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
        generatedAt: new Date().toISOString(),
      },
    };
  }
}
