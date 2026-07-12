import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';

import {
  AdAccount,
  AdAccountDocument,
} from './schemas/ad-account.schema';
import {
  AdGroup,
  AdGroupDocument,
} from './schemas/ad-group.schema';
import { AdCost, AdCostDocument, AdCostSource } from './schemas/ad-cost.schema';

import { CreateAdCostDto } from './dto/create-ad-cost.dto';
import { QueryAdCostDto } from './dto/query-ad-cost.dto';

import {
  normalizeToUtcDay,
  toUtcDateOnlyString,
  isDuplicateKeyError,
  fetchWithRetry,
} from './ads.utils';
import { AdsTokenService } from './ads-token.service';
import { AdsCrudService } from './ads-crud.service';

@Injectable()
export class AdsCostSyncService {
  private readonly logger = new Logger(AdsCostSyncService.name);

  constructor(
    @InjectModel(AdCost.name) private adCostModel: Model<AdCostDocument>,
    @InjectModel(AdAccount.name) private adAccountModel: Model<AdAccountDocument>,
    @InjectModel(AdGroup.name) private adGroupModel: Model<AdGroupDocument>,
    private readonly adsTokenService: AdsTokenService,
    private readonly adsCrudService: AdsCrudService,
    private configService: ConfigService,
  ) {}

  // ─── Ad Cost CRUD ──────────────────────────────────────

  async createOrUpdateCost(dto: CreateAdCostDto): Promise<AdCost> {
    const costDate = normalizeToUtcDay(dto.date);

    const group = await this.adsCrudService.findOneGroup(dto.adGroupId);
    if (String(group.adAccountId) !== String(dto.adAccountId)) {
      throw new BadRequestException('Nhóm quảng cáo không thuộc tài khoản quảng cáo đã chọn');
    }
    if (String(group.platform) !== String(dto.platform)) {
      throw new BadRequestException('Nền tảng quảng cáo không khớp với nhóm quảng cáo');
    }

    const filter = { adGroupId: dto.adGroupId, date: costDate };
    const update = {
      $set: {
        adAccountId: dto.adAccountId,
        adGroupName: group.name,
        platform: dto.platform,
        spend: dto.spend,
        impressions: dto.impressions || 0,
        clicks: dto.clicks || 0,
        conversions: dto.conversions || 0,
        source: dto.source || AdCostSource.MANUAL,
        syncedAt: new Date(),
      },
    };

    try {
      const result = await this.adCostModel.findOneAndUpdate(
        filter,
        update,
        { upsert: true, new: true },
      ).exec();
      return result!;
    } catch (err: any) {
      if (isDuplicateKeyError(err)) {
        const retried = await this.adCostModel.findOneAndUpdate(
          filter,
          update,
          { new: true },
        ).exec();
        if (retried) return retried;
      }
      throw err;
    }
  }

  async findAllCosts(query: QueryAdCostDto): Promise<{ data: AdCost[]; total: number; page: number; limit: number }> {
    const filter: any = {};
    if (query.adGroupId) filter.adGroupId = query.adGroupId;
    if (query.adAccountId) filter.adAccountId = query.adAccountId;
    if (query.platform) filter.platform = query.platform;
    if (query.startDate || query.endDate) {
      filter.date = {};
      if (query.startDate) filter.date.$gte = normalizeToUtcDay(query.startDate);
      if (query.endDate) {
        const end = normalizeToUtcDay(query.endDate);
        end.setUTCHours(23, 59, 59, 999);
        filter.date.$lte = end;
      }
    }

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(500, Math.max(1, Number(query.limit) || 50));
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.adCostModel.find(filter).sort({ date: -1 }).skip(skip).limit(limit).exec(),
      this.adCostModel.countDocuments(filter),
    ]);

    return { data, total, page, limit };
  }

  async deleteCost(id: string): Promise<void> {
    const cost = await this.adCostModel.findById(id).exec();
    if (!cost) throw new NotFoundException('Bản ghi chi phí không tồn tại');
    await this.adCostModel.findByIdAndDelete(id).exec();
  }

  // ─── Per-account cost sync ─────────────────────────────

  async syncAccountCosts(accountId: string, dateStr?: string): Promise<number> {
    const syncDates = [
      dateStr
        ? normalizeToUtcDay(dateStr)
        : normalizeToUtcDay(new Date(Date.now() - 86400000)),
    ];
    return this.syncAccountCostsForDates(accountId, syncDates);
  }

  async syncAccountCostsForDates(accountId: string, syncDates: Date[]): Promise<number> {
    const account = await this.adsCrudService.findOneAccount(accountId);
    const token = await this.adsTokenService.getDecryptedToken(accountId);
    if (!token) {
      throw new BadRequestException(`Không tìm thấy API token hợp lệ cho tài khoản ${account.name}`);
    }

    const groups = await this.adGroupModel.find({ adAccountId: accountId, status: 'ACTIVE' }).exec();
    if (groups.length === 0) return 0;

    let synced = 0;
    for (const syncDate of syncDates) {
      synced += await this.syncPlatformCosts(token, account, groups, syncDate);
    }

    return synced;
  }

  private async syncPlatformCosts(
    token: string,
    account: AdAccountDocument,
    groups: AdGroupDocument[],
    syncDate: Date,
  ): Promise<number> {
    switch (account.platform) {
      case 'FACEBOOK':
        return this.syncFacebookCosts(token, account, groups, syncDate);
      case 'GOOGLE':
        return this.syncGoogleCosts(token, account, groups, syncDate);
      case 'TIKTOK':
        return this.syncTikTokCosts(token, account, groups, syncDate);
      default:
        return 0;
    }
  }

  getSyncLookbackDays(): number {
    const rawValue = Number(this.configService.get<string>('AD_SYNC_LOOKBACK_DAYS', '3'));
    if (!Number.isFinite(rawValue)) return 3;
    return Math.max(1, Math.min(14, Math.floor(rawValue)));
  }

  buildRollingSyncDates(lookbackDays: number): Date[] {
    const dates: Date[] = [];
    for (let offset = 1; offset <= lookbackDays; offset++) {
      dates.push(normalizeToUtcDay(new Date(Date.now() - (offset * 86400000))));
    }
    return dates;
  }

  private getExchangeRate(currency: string): number {
    if (currency === 'USD') {
      return Number(this.configService.get<string>('USD_TO_VND', '25000'));
    }
    return 1;
  }

  private convertSpendToVnd(amount: number, currency?: string): number {
    const normalized = String(currency || '').trim().toUpperCase();
    if (!normalized || normalized === 'VND') return amount;
    if (normalized === 'USD') return amount * this.getExchangeRate('USD');
    return amount;
  }

  // ─── Platform-specific cost sync ───────────────────────

  private async syncFacebookCosts(
    token: string, account: AdAccountDocument, groups: AdGroupDocument[], date: Date,
  ): Promise<number> {
    const dateStr = toUtcDateOnlyString(date);
    let synced = 0;

    try {
      const url = `https://graph.facebook.com/v21.0/act_${account.platformAccountId}/insights`
        + `?fields=adset_id,adset_name,spend,impressions,clicks,actions`
        + `&level=adset`
        + `&time_range={"since":"${dateStr}","until":"${dateStr}"}`;

      const response = await fetchWithRetry(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = response?.data || [];

      const campaignMap = new Map<string, AdGroupDocument>();
      for (const g of groups) {
        campaignMap.set(g.platformCampaignId, g);
      }

      for (const row of data) {
        const adsetId = row.adset_id;
        const group = campaignMap.get(adsetId);
        if (!group) continue;

        const conversions = (row.actions || [])
          .filter((a: any) => a.action_type === 'offsite_conversion')
          .reduce((sum: number, a: any) => sum + Number(a.value || 0), 0);

        await this.createOrUpdateCost({
          adGroupId: group._id.toString(),
          adAccountId: account._id.toString(),
          platform: 'FACEBOOK',
          date: dateStr,
          spend: this.convertSpendToVnd(Number(row.spend || 0), account.currency),
          impressions: Number(row.impressions || 0),
          clicks: Number(row.clicks || 0),
          conversions,
          source: AdCostSource.SYNCED,
        });
        synced++;
      }
    } catch (err: any) {
      this.logger.error(`Facebook sync error: ${err.message}`);
      throw err;
    }

    return synced;
  }

  private async syncGoogleCosts(
    token: string, account: AdAccountDocument, groups: AdGroupDocument[], date: Date,
  ): Promise<number> {
    const dateStr = toUtcDateOnlyString(date);
    let synced = 0;

    try {
      const query = `SELECT campaign.id, metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.conversions`
        + ` FROM campaign WHERE segments.date = '${dateStr}'`;

      const url = `https://googleads.googleapis.com/v17/customers/${account.platformAccountId}/googleAds:searchStream`;

      const response = await fetchWithRetry(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'developer-token': this.configService.get<string>('GOOGLE_ADS_DEV_TOKEN', ''),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
      });

      const campaignMap = new Map<string, AdGroupDocument>();
      for (const g of groups) {
        campaignMap.set(g.platformCampaignId, g);
      }

      const streamBatches = Array.isArray(response) ? response : [response];
      const results = streamBatches.flatMap((batch: any) => batch?.results || []);
      for (const row of results) {
        const campaignId = row.campaign?.id?.toString();
        if (!campaignId) continue;
        const group = campaignMap.get(campaignId);
        if (!group) continue;

        const costVnd = this.convertSpendToVnd(
          Number(row.metrics?.cost_micros || 0) / 1_000_000,
          account.currency,
        );

        await this.createOrUpdateCost({
          adGroupId: group._id.toString(),
          adAccountId: account._id.toString(),
          platform: 'GOOGLE',
          date: toUtcDateOnlyString(date),
          spend: costVnd,
          impressions: Number(row.metrics?.impressions || 0),
          clicks: Number(row.metrics?.clicks || 0),
          conversions: Number(row.metrics?.conversions || 0),
          source: AdCostSource.SYNCED,
        });
        synced++;
      }
    } catch (err: any) {
      this.logger.error(`Google sync error: ${err.message}`);
      throw err;
    }

    return synced;
  }

  private async syncTikTokCosts(
    token: string, account: AdAccountDocument, groups: AdGroupDocument[], date: Date,
  ): Promise<number> {
    const dateStr = toUtcDateOnlyString(date);
    let synced = 0;

    try {
      const url = `https://business-api.tiktok.com/open_api/v1.3/report/integrated/get/`
        + `?advertiser_id=${account.platformAccountId}`
        + `&report_type=BASIC`
        + `&dimensions=["campaign_id","stat_time_day"]`
        + `&metrics=["spend","impressions","clicks","conversions"]`
        + `&data_level=AUCTION_CAMPAIGN`
        + `&start_date=${dateStr}&end_date=${dateStr}`;

      const response = await fetchWithRetry(url, {
        headers: { 'Access-Token': token },
      });

      const campaignMap = new Map<string, AdGroupDocument>();
      for (const g of groups) {
        campaignMap.set(g.platformCampaignId, g);
      }

      const rows = response?.data?.list || [];
      for (const row of rows) {
        const campaignId = row.dimensions?.campaign_id;
        if (!campaignId) continue;
        const group = campaignMap.get(campaignId);
        if (!group) continue;

        await this.createOrUpdateCost({
          adGroupId: group._id.toString(),
          adAccountId: account._id.toString(),
          platform: 'TIKTOK',
          date: dateStr,
          spend: this.convertSpendToVnd(Number(row.metrics?.spend || 0), account.currency),
          impressions: Number(row.metrics?.impressions || 0),
          clicks: Number(row.metrics?.clicks || 0),
          conversions: Number(row.metrics?.conversions || 0),
          source: AdCostSource.SYNCED,
        });
        synced++;
      }
    } catch (err: any) {
      this.logger.error(`TikTok sync error: ${err.message}`);
      throw err;
    }

    return synced;
  }
}
