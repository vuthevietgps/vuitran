import { Types } from 'mongoose';
import { MarketingAttributionService } from './marketing-attribution.service';
import { ParentAttributionSourceType } from './schemas/parent-attribution.schema';

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
  });

  it('fills referredByUserId onto an existing attribution when it was previously empty', async () => {
    const existingDoc: any = {
      _id: new Types.ObjectId(),
      parentKey: 'phone:0901234567',
      parentPhone: '0901234567',
      normalizedParentPhone: '0901234567',
      attributionModel: 'FIRST_TOUCH_LOCKED',
      sourceType: ParentAttributionSourceType.SYSTEM,
      firstAttributedAt: new Date('2026-01-01T00:00:00.000Z'),
      lastConfirmedAt: new Date('2026-01-01T00:00:00.000Z'),
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
    });

    expect(existingDoc.save).toHaveBeenCalled();
    expect(result?.referredByUserId?.toString()).toBe(referredByUserId);
  });
});