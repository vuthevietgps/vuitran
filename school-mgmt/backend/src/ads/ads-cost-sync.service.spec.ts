import { Types } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { AdsCostSyncService } from './ads-cost-sync.service';
import { AdCostSource } from './schemas/ad-cost.schema';
import { fetchWithRetry, normalizeToUtcDay } from './ads.utils';

jest.mock('./ads.utils', () => {
  const actual = jest.requireActual('./ads.utils');
  return {
    ...actual,
    fetchWithRetry: jest.fn(),
  };
});

function execResult<T>(value: T) {
  return {
    exec: jest.fn().mockResolvedValue(value),
  };
}

describe('AdsCostSyncService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('syncs Facebook account costs at adset level and writes spend to the matching ad group', async () => {
    const accountId = new Types.ObjectId();
    const groupId = new Types.ObjectId();
    const account = {
      _id: accountId,
      name: 'Meta Account',
      platform: 'FACEBOOK',
      platformAccountId: '123456',
      currency: 'VND',
    };
    const group = {
      _id: groupId,
      adAccountId: accountId,
      name: 'Adset A',
      platform: 'FACEBOOK',
      platformCampaignId: 'adset-001',
      status: 'ACTIVE',
    };
    const savedCost = {
      adGroupId: groupId,
      adAccountId: accountId,
      platform: 'FACEBOOK',
      spend: 250_000,
    };
    const adCostModel = {
      findOneAndUpdate: jest.fn().mockReturnValue(execResult(savedCost)),
      find: jest.fn(),
      countDocuments: jest.fn(),
    };
    const adGroupModel = {
      find: jest.fn().mockReturnValue(execResult([group])),
    };
    const adsTokenService = {
      getDecryptedToken: jest.fn().mockResolvedValue('account-token'),
    };
    const adsCrudService = {
      findOneAccount: jest.fn().mockResolvedValue(account),
      findOneGroup: jest.fn().mockResolvedValue(group),
    };
    const service = new AdsCostSyncService(
      adCostModel as any,
      {} as any,
      adGroupModel as any,
      adsTokenService as any,
      adsCrudService as any,
      { get: jest.fn((key: string, fallback?: string) => fallback) } as unknown as ConfigService,
    );
    (fetchWithRetry as jest.Mock).mockResolvedValue({
      data: [
        {
          adset_id: 'adset-001',
          adset_name: 'Adset A',
          spend: '250000',
          impressions: '1000',
          clicks: '50',
          actions: [{ action_type: 'offsite_conversion', value: '2' }],
        },
      ],
    });

    await expect(
      service.syncAccountCostsForDates(accountId.toString(), [normalizeToUtcDay('2026-04-10')]),
    ).resolves.toBe(1);

    expect(fetchWithRetry).toHaveBeenCalledWith(
      expect.stringContaining('&level=adset'),
      expect.objectContaining({
        headers: { Authorization: 'Bearer account-token' },
      }),
    );
    expect(fetchWithRetry).toHaveBeenCalledWith(
      expect.stringContaining('fields=adset_id,adset_name,spend,impressions,clicks,actions'),
      expect.any(Object),
    );
    expect(adCostModel.findOneAndUpdate).toHaveBeenCalledWith(
      { adGroupId: groupId.toString(), date: normalizeToUtcDay('2026-04-10') },
      {
        $set: expect.objectContaining({
          adAccountId: accountId.toString(),
          adGroupName: 'Adset A',
          platform: 'FACEBOOK',
          spend: 250_000,
          impressions: 1000,
          clicks: 50,
          conversions: 2,
          source: AdCostSource.SYNCED,
        }),
      },
      { upsert: true, new: true },
    );
  });
});
