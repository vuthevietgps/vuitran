import { Types } from 'mongoose';
import { AdsOptimizationPlanService } from './ads-optimization-plan.service';
import {
  AdsOptimizationPlanItemStatus,
  AdsOptimizationPlanStatus,
} from './schemas/ads-optimization-plan.schema';
import { AdGroupStatus } from './schemas/ad-group.schema';
import { Role } from '../common/interfaces/role.enum';

describe('AdsOptimizationPlanService', () => {
  const user: any = {
    _id: new Types.ObjectId().toString(),
    fullName: 'Director',
    email: 'director@example.com',
    role: Role.DIRECTOR,
  };

  function buildPlanModel() {
    const savedDocs: any[] = [];
    const PlanModel: any = jest.fn().mockImplementation(function PlanDocument(this: any, data: any) {
      Object.assign(this, data);
      this.markModified = jest.fn();
      this.save = jest.fn(async () => {
        savedDocs.push(this);
        return this;
      });
    });
    PlanModel.find = jest.fn();
    PlanModel.findById = jest.fn();
    PlanModel.countDocuments = jest.fn();
    return { PlanModel, savedDocs };
  }

  function queryResult<T>(value: T) {
    return { exec: jest.fn().mockResolvedValue(value) };
  }

  function buildService(overrides: Record<string, any> = {}) {
    const { PlanModel, savedDocs } = buildPlanModel();
    const adGroupModel = {
      find: jest.fn(),
      findById: jest.fn(),
    };
    const actionsService = {
      getActionsRequired: jest.fn(),
    };
    const profitService = {
      getNetProfitByAdGroup: jest.fn(),
    };

    const service = new AdsOptimizationPlanService(
      overrides.PlanModel || PlanModel,
      overrides.adGroupModel || adGroupModel,
      overrides.actionsService || actionsService,
      overrides.profitService || profitService,
    );

    return { service, PlanModel, savedDocs, adGroupModel, actionsService, profitService };
  }

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('generates a draft plan from actions-required recommendations', async () => {
    const { service, PlanModel, adGroupModel, actionsService } = buildService();
    const adGroupId = new Types.ObjectId();
    const group: any = {
      _id: adGroupId,
      name: 'Google profitable',
      platform: 'GOOGLE',
      status: AdGroupStatus.ACTIVE,
      dailyBudget: 700000,
      platformCampaignId: 'cmp-1',
      adAccountId: new Types.ObjectId(),
    };

    actionsService.getActionsRequired.mockResolvedValue({
      actions: [
        {
          type: 'ADJUST_BUDGET',
          subType: 'INCREASE',
          priority: 'HIGH',
          title: 'Increase budget',
          description: 'Increase safely',
          reasons: ['Profitable cohort'],
          details: {
            safeDailyTarget: 840000,
            currentDailySpend: 700000,
            platform: 'GOOGLE',
          },
          relatedEntity: { type: 'AdGroup', id: adGroupId.toString(), name: group.name },
          estimatedImpact: { dailyProfitChange: 120000, monthlyProfitChange: 3600000 },
        },
      ],
      summary: {
        totalActiveGroups: 1,
        generatedAt: '2026-06-09T00:00:00.000Z',
      },
    });
    adGroupModel.find.mockReturnValue(queryResult([group]));

    const result = await service.generateFromActionsRequired({ lookbackDays: 14 }, user);

    expect(actionsService.getActionsRequired).toHaveBeenCalledWith({
      refundRatePercentX: undefined,
      lookbackDays: 14,
      targetProfitableRatio: undefined,
      totalBudget: undefined,
    });
    expect(PlanModel).toHaveBeenCalledWith(expect.objectContaining({
      status: AdsOptimizationPlanStatus.DRAFT,
      generationOptions: { lookbackDays: 14 },
      items: [
        expect.objectContaining({
          actionType: 'ADJUST_BUDGET',
          status: AdsOptimizationPlanItemStatus.PENDING_APPROVAL,
          adGroupId: adGroupId.toString(),
          currentDailyBudget: 700000,
          proposedDailyBudget: 840000,
          executionMode: 'ERP_SAFE',
        }),
      ],
    }));
    expect(result.items).toHaveLength(1);
  });

  it('executes approved budget and pause items against ERP ad groups only', async () => {
    const { service, PlanModel, adGroupModel } = buildService();
    const planId = new Types.ObjectId().toString();
    const adGroupId = new Types.ObjectId();
    const group: any = {
      _id: adGroupId,
      name: 'Facebook loser',
      platform: 'FACEBOOK',
      status: AdGroupStatus.ACTIVE,
      dailyBudget: 500000,
      platformCampaignId: 'adset-1',
      adAccountId: new Types.ObjectId(),
      save: jest.fn(async function save(this: any) {
        return this;
      }),
    };
    const planDoc: any = {
      _id: planId,
      status: AdsOptimizationPlanStatus.APPROVED,
      items: [
        {
          itemId: 'pause-1',
          actionType: 'PAUSE_GROUP',
          status: AdsOptimizationPlanItemStatus.APPROVED,
          adGroupId: adGroupId.toString(),
          proposedStatus: AdGroupStatus.PAUSED,
          title: 'Pause group',
        },
        {
          itemId: 'budget-1',
          actionType: 'ADJUST_BUDGET',
          status: AdsOptimizationPlanItemStatus.APPROVED,
          adGroupId: adGroupId.toString(),
          proposedDailyBudget: 300000,
          title: 'Reduce budget',
        },
      ],
      markModified: jest.fn(),
      save: jest.fn(async function save(this: any) {
        return this;
      }),
    };

    PlanModel.findById.mockReturnValue(queryResult(planDoc));
    adGroupModel.findById.mockReturnValue(queryResult(group));

    const result = await service.execute(planId, {}, user);

    expect(group.status).toBe(AdGroupStatus.PAUSED);
    expect(group.dailyBudget).toBe(300000);
    expect(group.save).toHaveBeenCalledTimes(2);
    expect(result.executedCount).toBe(2);
    expect(result.failedCount).toBe(0);
    expect(planDoc.status).toBe(AdsOptimizationPlanStatus.EXECUTED);
    expect(planDoc.items).toEqual([
      expect.objectContaining({
        itemId: 'pause-1',
        status: AdsOptimizationPlanItemStatus.EXECUTED,
        executionResult: expect.objectContaining({
          platformMutation: expect.objectContaining({ attempted: false }),
        }),
      }),
      expect.objectContaining({
        itemId: 'budget-1',
        status: AdsOptimizationPlanItemStatus.EXECUTED,
      }),
    ]);
  });
});
