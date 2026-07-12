import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AdsAnalyticsActionsService } from './ads-analytics-actions.service';
import { AdsAnalyticsProfitService } from './ads-analytics-profit.service';
import { ActionableSuggestion } from './ads.types';
import { AdGroup, AdGroupDocument, AdGroupStatus } from './schemas/ad-group.schema';
import {
  AdsOptimizationPlan,
  AdsOptimizationPlanDocument,
  AdsOptimizationPlanItemStatus,
  AdsOptimizationPlanSource,
  AdsOptimizationPlanStatus,
} from './schemas/ads-optimization-plan.schema';
import {
  DecideAdsOptimizationPlanItemDto,
  ExecuteAdsOptimizationPlanDto,
  GenerateAdsOptimizationPlanDto,
  QueryAdsOptimizationPlansDto,
} from './dto/ads-optimization-plan.dto';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { toUtcDateOnlyString } from './ads.utils';

type PlanItem = Record<string, any>;

@Injectable()
export class AdsOptimizationPlanService {
  constructor(
    @InjectModel(AdsOptimizationPlan.name)
    private readonly planModel: Model<AdsOptimizationPlanDocument>,
    @InjectModel(AdGroup.name)
    private readonly adGroupModel: Model<AdGroupDocument>,
    private readonly actionsService: AdsAnalyticsActionsService,
    private readonly profitService: AdsAnalyticsProfitService,
  ) {}

  async generateFromActionsRequired(dto: GenerateAdsOptimizationPlanDto, user: JwtPayload) {
    const options = {
      refundRatePercentX: dto.refundRatePercentX,
      lookbackDays: dto.lookbackDays,
      targetProfitableRatio: dto.targetProfitableRatio,
      totalBudget: dto.totalBudget,
    };
    const actionsResponse = await this.actionsService.getActionsRequired(options);
    const groups = await this.loadRelatedGroups(actionsResponse.actions);
    const generatedAt = new Date();

    const items = actionsResponse.actions.map((action, index) =>
      this.buildItemFromSuggestion(action, groups, index, generatedAt),
    );

    const plan = new this.planModel({
      title: dto.title?.trim() || this.buildDefaultTitle(generatedAt),
      source: AdsOptimizationPlanSource.ACTIONS_REQUIRED,
      status: AdsOptimizationPlanStatus.DRAFT,
      generationOptions: this.stripUndefined(options),
      summary: actionsResponse.summary,
      items,
      generatedAt,
      createdById: this.toObjectId(user?._id),
      createdByName: user?.fullName,
    });

    return plan.save();
  }

  async findAll(query: QueryAdsOptimizationPlansDto) {
    const filter: Record<string, any> = {};
    if (query.status) filter.status = query.status;
    if (query.adGroupId) filter['items.adGroupId'] = query.adGroupId;

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(200, Math.max(1, Number(query.limit) || 50));
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.planModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      this.planModel.countDocuments(filter),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string) {
    const plan = await this.planModel.findById(id).lean();
    if (!plan) throw new NotFoundException('Ads optimization plan not found');
    return plan;
  }

  async approveItem(
    planId: string,
    itemId: string,
    dto: DecideAdsOptimizationPlanItemDto,
    user: JwtPayload,
  ) {
    const plan = await this.getPlanDoc(planId);
    const item = this.findItem(plan, itemId);
    if ([AdsOptimizationPlanItemStatus.EXECUTED, AdsOptimizationPlanItemStatus.FAILED].includes(item.status)) {
      throw new BadRequestException('Cannot approve an item that has already been executed.');
    }

    if (dto.proposedDailyBudget !== undefined) item.proposedDailyBudget = Math.round(dto.proposedDailyBudget);
    if (dto.proposedStatus !== undefined) item.proposedStatus = dto.proposedStatus;
    item.status = AdsOptimizationPlanItemStatus.APPROVED;
    item.decisionNote = dto.note;
    item.approvedAt = new Date();
    item.approvedById = user?._id;
    item.approvedByName = user?.fullName;

    plan.approvedAt = new Date();
    plan.approvedById = this.toObjectId(user?._id);
    plan.approvedByName = user?.fullName;
    plan.status = this.recalculatePlanStatus(plan.items);
    plan.markModified('items');
    return plan.save();
  }

  async rejectItem(
    planId: string,
    itemId: string,
    dto: DecideAdsOptimizationPlanItemDto,
    user: JwtPayload,
  ) {
    const plan = await this.getPlanDoc(planId);
    const item = this.findItem(plan, itemId);
    if (item.status === AdsOptimizationPlanItemStatus.EXECUTED) {
      throw new BadRequestException('Cannot reject an item that has already been executed.');
    }

    item.status = AdsOptimizationPlanItemStatus.REJECTED;
    item.decisionNote = dto.note;
    item.rejectedAt = new Date();
    item.rejectedById = user?._id;
    item.rejectedByName = user?.fullName;

    plan.status = this.recalculatePlanStatus(plan.items);
    plan.markModified('items');
    return plan.save();
  }

  async execute(planId: string, dto: ExecuteAdsOptimizationPlanDto, user: JwtPayload) {
    const plan = await this.getPlanDoc(planId);
    const selectedIds = new Set(dto.itemIds || []);
    const items = plan.items.filter((item) =>
      item.status === AdsOptimizationPlanItemStatus.APPROVED
      && (!selectedIds.size || selectedIds.has(item.itemId)),
    );

    if (!items.length) {
      throw new BadRequestException('No approved ads optimization items to execute.');
    }

    const results: Array<Record<string, any> & { executed: boolean; skipped: boolean }> = [];
    for (const item of items) {
      const result = await this.executeItem(item, Boolean(dto.dryRun));
      results.push({ itemId: item.itemId, ...result });

      if (dto.dryRun) continue;
      item.executionResult = result;
      item.executedAt = new Date();
      item.status = result.executed
        ? AdsOptimizationPlanItemStatus.EXECUTED
        : result.skipped
          ? AdsOptimizationPlanItemStatus.SKIPPED
          : AdsOptimizationPlanItemStatus.FAILED;
    }

    if (!dto.dryRun) {
      plan.executedAt = new Date();
      plan.executedById = this.toObjectId(user?._id);
      plan.executedByName = user?.fullName;
      plan.status = this.recalculatePlanStatus(plan.items);
      plan.markModified('items');
      await plan.save();
    }

    return {
      planId,
      dryRun: Boolean(dto.dryRun),
      executedCount: results.filter((r) => r.executed).length,
      skippedCount: results.filter((r) => r.skipped).length,
      failedCount: results.filter((r) => !r.executed && !r.skipped).length,
      results,
    };
  }

  async getFollowUp(planId: string, days = 7) {
    const plan = await this.getPlanDoc(planId);
    const executedItems = plan.items.filter((item) =>
      [AdsOptimizationPlanItemStatus.EXECUTED, AdsOptimizationPlanItemStatus.SKIPPED].includes(item.status),
    );
    const adGroupIds = Array.from(new Set(
      executedItems.map((item) => item.adGroupId).filter(Boolean),
    ));

    if (!executedItems.length || !adGroupIds.length) {
      return {
        planId,
        status: plan.status,
        followUpReady: false,
        reason: 'No executed ad group items to compare yet.',
        items: executedItems,
      };
    }

    const executedTimes = executedItems
      .map((item) => item.executedAt ? new Date(item.executedAt).getTime() : 0)
      .filter((value) => value > 0);
    const firstExecutedAt = executedTimes.length
      ? new Date(Math.min(...executedTimes))
      : new Date();
    const end = new Date(Math.min(Date.now(), firstExecutedAt.getTime() + days * 86400000));
    const startDate = toUtcDateOnlyString(firstExecutedAt);
    const endDate = toUtcDateOnlyString(end);

    const profitData = await this.profitService.getNetProfitByAdGroup(startDate, endDate);
    const rows = (profitData.summaryByGroup || []).filter((row: any) =>
      adGroupIds.includes(row.adGroupId),
    );
    const rowsByGroup = new Map(rows.map((row: any) => [row.adGroupId, row]));

    return {
      planId,
      status: plan.status,
      followUpReady: true,
      window: { startDate, endDate, days },
      summary: {
        totalNetProfit: rows.reduce((sum: number, row: any) => sum + Number(row.totalNetProfit || 0), 0),
        totalRevenue: rows.reduce((sum: number, row: any) => sum + Number(row.totalRevenue || 0), 0),
        totalAdSpend: rows.reduce((sum: number, row: any) => sum + Number(row.totalAdSpend || 0), 0),
      },
      items: executedItems.map((item) => ({
        itemId: item.itemId,
        actionType: item.actionType,
        title: item.title,
        adGroupId: item.adGroupId,
        adGroupName: item.adGroupName,
        executedAt: item.executedAt,
        beforeSnapshot: item.executionResult?.beforeSnapshot,
        afterSnapshot: item.executionResult?.afterSnapshot,
        followUpMetrics: item.adGroupId ? rowsByGroup.get(item.adGroupId) || null : null,
      })),
    };
  }

  private async executeItem(item: PlanItem, dryRun: boolean) {
    if (!this.isExecutableItem(item)) {
      return {
        executed: false,
        skipped: true,
        reason: 'This recommendation is advisory or draft-only.',
      };
    }
    if (!item.adGroupId) {
      return {
        executed: false,
        skipped: false,
        reason: 'Missing adGroupId for executable ads action.',
      };
    }

    const group = await this.adGroupModel.findById(item.adGroupId).exec();
    if (!group) {
      return {
        executed: false,
        skipped: false,
        reason: 'Ad group not found.',
      };
    }

    const beforeSnapshot = this.buildGroupSnapshot(group);
    const nextDailyBudget = item.proposedDailyBudget;
    const nextStatus = item.proposedStatus;

    if (dryRun) {
      return {
        executed: true,
        skipped: false,
        dryRun: true,
        beforeSnapshot,
        afterSnapshot: {
          ...beforeSnapshot,
          dailyBudget: nextDailyBudget ?? beforeSnapshot.dailyBudget,
          status: nextStatus ?? beforeSnapshot.status,
        },
        platformMutation: this.buildPlatformMutationNotice(),
      };
    }

    if (nextDailyBudget !== undefined && nextDailyBudget !== null) {
      group.dailyBudget = Math.max(0, Math.round(Number(nextDailyBudget)));
    }
    if (nextStatus) {
      group.status = nextStatus;
    }
    await group.save();

    return {
      executed: true,
      skipped: false,
      beforeSnapshot,
      afterSnapshot: this.buildGroupSnapshot(group),
      platformMutation: this.buildPlatformMutationNotice(),
    };
  }

  private buildItemFromSuggestion(
    action: ActionableSuggestion,
    groups: Map<string, AdGroupDocument>,
    index: number,
    generatedAt: Date,
  ): PlanItem {
    const adGroupId = action.relatedEntity?.id;
    const group = adGroupId ? groups.get(adGroupId) : undefined;
    const details = action.details || {};
    const proposedDailyBudget = action.type === 'ADJUST_BUDGET'
      ? this.firstNumber(details.safeDailyTarget, details.optimalDailySpendReal, details.optimalDailySpend)
      : undefined;
    const proposedStatus = action.type === 'PAUSE_GROUP' ? AdGroupStatus.PAUSED : undefined;

    return {
      itemId: this.buildItemId(action, index),
      actionType: action.type,
      subType: action.subType,
      priority: action.priority,
      status: AdsOptimizationPlanItemStatus.PENDING_APPROVAL,
      title: action.title,
      description: action.description,
      reasons: action.reasons || [],
      adGroupId,
      adGroupName: action.relatedEntity?.name || group?.name,
      platform: details.platform || group?.platform,
      currentDailyBudget: this.firstNumber(group?.dailyBudget, details.currentDailySpend, details.actualDailySpend),
      proposedDailyBudget,
      proposedStatus,
      executionMode: this.isActionTypeExecutable(action.type) ? 'ERP_SAFE' : 'ADVISORY',
      details,
      estimatedImpact: action.estimatedImpact,
      baselineSnapshot: group ? this.buildGroupSnapshot(group) : null,
      generatedAt,
    };
  }

  private async loadRelatedGroups(actions: ActionableSuggestion[]) {
    const ids = Array.from(new Set(
      actions
        .map((action) => action.relatedEntity?.id)
        .filter((id): id is string => typeof id === 'string' && Types.ObjectId.isValid(id)),
    ));
    if (!ids.length) return new Map<string, AdGroupDocument>();

    const groups = await this.adGroupModel.find({ _id: { $in: ids } }).exec();
    return new Map(groups.map((group) => [group._id.toString(), group]));
  }

  private async getPlanDoc(id: string) {
    const plan = await this.planModel.findById(id).exec();
    if (!plan) throw new NotFoundException('Ads optimization plan not found');
    return plan;
  }

  private findItem(plan: AdsOptimizationPlanDocument, itemId: string): PlanItem {
    const item = (plan.items || []).find((candidate) => candidate.itemId === itemId);
    if (!item) throw new NotFoundException('Ads optimization plan item not found');
    return item;
  }

  private isExecutableItem(item: PlanItem): boolean {
    return this.isActionTypeExecutable(item.actionType)
      && (item.proposedDailyBudget !== undefined || item.proposedStatus !== undefined);
  }

  private isActionTypeExecutable(actionType: string): boolean {
    return ['ADJUST_BUDGET', 'PAUSE_GROUP', 'RESUME_GROUP'].includes(actionType);
  }

  private buildGroupSnapshot(group: AdGroupDocument) {
    return {
      adGroupId: group._id.toString(),
      name: group.name,
      platform: group.platform,
      status: group.status,
      dailyBudget: group.dailyBudget ?? 0,
      platformCampaignId: group.platformCampaignId,
      adAccountId: group.adAccountId?.toString(),
    };
  }

  private buildPlatformMutationNotice() {
    return {
      attempted: false,
      status: 'NOT_ENABLED',
      reason: 'Live platform write API is not enabled; ERP ad group budget/status was updated only.',
    };
  }

  private buildItemId(action: ActionableSuggestion, index: number): string {
    const entity = action.relatedEntity?.id || 'account';
    return `${action.type.toLowerCase()}-${entity}-${index + 1}`;
  }

  private buildDefaultTitle(date: Date): string {
    return `Ads optimization plan ${toUtcDateOnlyString(date)}`;
  }

  private firstNumber(...values: any[]): number | undefined {
    for (const value of values) {
      const numeric = Number(value);
      if (Number.isFinite(numeric)) return Math.max(0, Math.round(numeric));
    }
    return undefined;
  }

  private toObjectId(value?: string): Types.ObjectId | undefined {
    return value && Types.ObjectId.isValid(value) ? new Types.ObjectId(value) : undefined;
  }

  private stripUndefined(input: Record<string, any>) {
    return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined));
  }

  private recalculatePlanStatus(items: PlanItem[]): string {
    if (!items.length) return AdsOptimizationPlanStatus.DRAFT;

    const approved = items.filter((item) => item.status === AdsOptimizationPlanItemStatus.APPROVED).length;
    const pending = items.filter((item) => item.status === AdsOptimizationPlanItemStatus.PENDING_APPROVAL).length;
    const rejected = items.filter((item) => item.status === AdsOptimizationPlanItemStatus.REJECTED).length;
    const executed = items.filter((item) => item.status === AdsOptimizationPlanItemStatus.EXECUTED).length;
    const skipped = items.filter((item) => item.status === AdsOptimizationPlanItemStatus.SKIPPED).length;
    const failed = items.filter((item) => item.status === AdsOptimizationPlanItemStatus.FAILED).length;

    if (failed > 0 && executed === 0 && skipped === 0) return AdsOptimizationPlanStatus.FAILED;
    if (executed + skipped + failed > 0) {
      const remaining = items.length - rejected - executed - skipped - failed;
      return remaining > 0 || failed > 0
        ? AdsOptimizationPlanStatus.PARTIALLY_EXECUTED
        : AdsOptimizationPlanStatus.EXECUTED;
    }
    if (approved === items.length) return AdsOptimizationPlanStatus.APPROVED;
    if (approved > 0) return AdsOptimizationPlanStatus.PARTIALLY_APPROVED;
    if (rejected === items.length) return AdsOptimizationPlanStatus.CANCELLED;
    if (pending > 0) return AdsOptimizationPlanStatus.DRAFT;
    return AdsOptimizationPlanStatus.DRAFT;
  }
}
