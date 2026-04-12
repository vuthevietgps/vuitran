import { Types } from 'mongoose';
import { MarketingAttributionService } from './marketing-attribution.service';
import {
  ParentAttributionModel,
  ParentAttributionSourceType,
} from './schemas/parent-attribution.schema';

function buildModel(findResults: any[] = []) {
  let callIndex = 0;
  const findOne = jest.fn().mockImplementation(() => ({
    exec: jest.fn().mockResolvedValue(findResults[callIndex++] ?? null),
  }));

  const model = jest.fn().mockImplementation(function (this: any, data: any) {
    Object.assign(this, data);
    this.save = jest.fn().mockImplementation(async () => this);
  });

  (model as any).findOne = findOne;

  return { model: model as any, findOne };
}

describe('MarketingAttributionService.upsertParentAttribution()', () => {
  it('creates referral-only attribution records without adGroup data', async () => {
    const { model } = buildModel([null, null]);
    const service = new MarketingAttributionService(model);
    const referredByUserId = new Types.ObjectId().toHexString();

    const result = await service.upsertParentAttribution({
      parentPhone: '0901234567',
      referredByUserId,
    });

    expect(result).not.toBeNull();
    expect(result?.referredByUserId?.toString()).toBe(referredByUserId);
    expect(result?.sourceType).toBe(ParentAttributionSourceType.REFERRAL);
    expect(result?.touchpoints).toHaveLength(1);
    expect(result?.touchpoints?.[0].sourceType).toBe(ParentAttributionSourceType.REFERRAL);
    expect(result?.touchpoints?.[0].firstTouchedAt).toBeInstanceOf(Date);
    expect(result?.touchpoints?.[0].lastConfirmedAt).toBeInstanceOf(Date);
  });

  it('appends a touchpoint while preserving the earliest first-attributed timestamp', async () => {
    const existingDoc: any = {
      _id: new Types.ObjectId(),
      parentKey: 'phone:0901234567',
      parentPhone: '0901234567',
      normalizedParentPhone: '0901234567',
      attributionModel: ParentAttributionModel.FIRST_TOUCH_LOCKED,
      sourceType: ParentAttributionSourceType.SYSTEM,
      firstAttributedAt: new Date('2026-01-01T00:00:00.000Z'),
      lastConfirmedAt: new Date('2026-01-01T00:00:00.000Z'),
      touchpoints: [
        {
          capturedAt: new Date('2026-01-01T00:00:00.000Z'),
          firstTouchedAt: new Date('2026-01-01T00:00:00.000Z'),
          lastConfirmedAt: new Date('2026-01-01T00:00:00.000Z'),
          sourceType: ParentAttributionSourceType.SYSTEM,
          platform: 'FACEBOOK',
        },
      ],
      save: jest.fn().mockImplementation(async function (this: any) {
        return this;
      }),
    };

    const { model } = buildModel([existingDoc]);
    const service = new MarketingAttributionService(model);
    const referredByUserId = new Types.ObjectId().toHexString();

    const result = await service.upsertParentAttribution({
      parentPhone: '0901234567',
      referredByUserId,
      adGroupId: new Types.ObjectId().toHexString(),
      adGroupName: 'Campaign A',
      platform: 'FACEBOOK',
      notes: 'first update',
    });

    expect(existingDoc.save).toHaveBeenCalled();
    expect(result?.referredByUserId?.toString()).toBe(referredByUserId);
    expect(result?.firstAttributedAt.toISOString()).toBe('2026-01-01T00:00:00.000Z');
    expect(result?.touchpoints).toHaveLength(2);
    expect(result?.touchpoints?.[0].firstTouchedAt?.toISOString()).toBe('2026-01-01T00:00:00.000Z');
    expect(result?.touchpoints?.[1].sourceType).toBe(ParentAttributionSourceType.REFERRAL);
    expect(result?.touchpoints?.[1].notes).toBe('first update');
  });

  it('merges touchpoint timelines when two attribution records collapse into one', async () => {
    const earlier = new Date('2026-01-01T00:00:00.000Z');
    const later = new Date('2026-02-01T00:00:00.000Z');
    const primaryDoc: any = {
      _id: new Types.ObjectId(),
      parentUserId: new Types.ObjectId(),
      parentKey: 'user:111111111111111111111111',
      parentPhone: '0901111111',
      normalizedParentPhone: '0901111111',
      attributionModel: ParentAttributionModel.FIRST_TOUCH_LOCKED,
      sourceType: ParentAttributionSourceType.LEAD,
      firstAttributedAt: later,
      lastConfirmedAt: later,
      touchpoints: [
        {
          capturedAt: later,
          firstTouchedAt: later,
          lastConfirmedAt: later,
          sourceType: ParentAttributionSourceType.LEAD,
          sourceLeadId: new Types.ObjectId(),
        },
      ],
      save: jest.fn().mockImplementation(async function (this: any) {
        return this;
      }),
    };
    const secondaryDoc: any = {
      _id: new Types.ObjectId(),
      parentUserId: new Types.ObjectId(),
      parentKey: 'phone:0901111111',
      parentPhone: '0901111111',
      normalizedParentPhone: '0901111111',
      attributionModel: ParentAttributionModel.LAST_TOUCH,
      sourceType: ParentAttributionSourceType.MANUAL,
      firstAttributedAt: earlier,
      lastConfirmedAt: earlier,
      touchpoints: [
        {
          capturedAt: earlier,
          firstTouchedAt: earlier,
          lastConfirmedAt: earlier,
          sourceType: ParentAttributionSourceType.MANUAL,
          platform: 'GOOGLE',
        },
      ],
      deleteOne: jest.fn().mockResolvedValue(undefined),
      save: jest.fn().mockImplementation(async function (this: any) {
        return this;
      }),
    };

    const { model } = buildModel([primaryDoc, secondaryDoc]);
    const service = new MarketingAttributionService(model);

    const result = await service.upsertParentAttribution({
      parentUserId: primaryDoc.parentUserId,
      parentPhone: '0901111111',
      sourceType: ParentAttributionSourceType.ORDER,
      attributionModel: ParentAttributionModel.MANUAL_OVERRIDE,
      notes: 'merged timeline event',
    });

    expect(secondaryDoc.deleteOne).toHaveBeenCalled();
    expect(primaryDoc.save).toHaveBeenCalled();
    expect(result?.firstAttributedAt.toISOString()).toBe('2026-01-01T00:00:00.000Z');
    expect(result?.lastConfirmedAt).toBeInstanceOf(Date);
    expect(result?.lastConfirmedAt.getTime()).toBeGreaterThanOrEqual(later.getTime());
    expect(result?.touchpoints).toHaveLength(3);
    expect(result?.touchpoints?.[0].firstTouchedAt?.toISOString()).toBe('2026-01-01T00:00:00.000Z');
    expect(result?.touchpoints?.[1].firstTouchedAt?.toISOString()).toBe('2026-02-01T00:00:00.000Z');
    expect(result?.touchpoints?.[2].sourceType).toBe(ParentAttributionSourceType.ORDER);
    expect(result?.touchpoints?.[2].notes).toBe('merged timeline event');
  });
});
