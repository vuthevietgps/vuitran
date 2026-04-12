import { MarketingAttributionListener } from './marketing-attribution.listener';
import { MarketingAttributionService } from './marketing-attribution.service';
import { ParentAttributionSourceType } from './schemas/parent-attribution.schema';
import { OrderApprovedEvent } from '../orders/events/order-approved.event';

function buildListener(
  overrides: Partial<{
    attributionService: Pick<MarketingAttributionService, 'upsertParentAttribution'>;
  }> = {},
) {
  const attributionService = overrides.attributionService ?? {
    upsertParentAttribution: jest.fn().mockResolvedValue(undefined),
  };

  return {
    listener: new MarketingAttributionListener(attributionService as any),
    attributionService,
  };
}

function buildPayload() {
  return new OrderApprovedEvent(
    'order-id',
    'ORD-2026-0001',
    'student-id',
    ['inv-1'],
    'actor-id',
    {
      parentUserId: 'parent-id',
      parentPhone: '0901234567',
      adGroupId: 'ad-group-id',
      adGroupName: 'Ad Group',
      leadSource: 'FACEBOOK',
    },
    {
      parentUserId: 'parent-id',
      parentPhone: '0901234567',
      adGroupId: 'ad-group-id',
      adGroupName: 'Ad Group',
    },
  );
}

describe('MarketingAttributionListener.handleOrderApprovedAttribution', () => {
  it('upserts parent attribution from order approved payload', async () => {
    const { listener, attributionService } = buildListener();

    await listener.handleOrderApprovedAttribution(buildPayload());

    expect(attributionService.upsertParentAttribution).toHaveBeenCalledWith(
      expect.objectContaining({
        parentUserId: 'parent-id',
        parentPhone: '0901234567',
        adGroupId: 'ad-group-id',
        adGroupName: 'Ad Group',
        platform: 'FACEBOOK',
        sourceOrderId: 'order-id',
        sourceType: ParentAttributionSourceType.STUDENT,
      }),
    );
  });

  it('swallows attribution errors', async () => {
    const { listener, attributionService } = buildListener({
      attributionService: {
        upsertParentAttribution: jest.fn().mockRejectedValue(new Error('boom')),
      } as any,
    });

    await expect(listener.handleOrderApprovedAttribution(buildPayload())).resolves.toBeUndefined();
    expect(attributionService.upsertParentAttribution).toHaveBeenCalled();
  });
});
