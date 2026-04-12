import {
  Injectable,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';

import {
  AdAccount,
  AdAccountDocument,
  AdAccountStatus,
  AdAccountSyncSource,
} from './schemas/ad-account.schema';
import {
  AdGroup,
  AdGroupDocument,
  AdGroupStatus,
  AdGroupSyncSource,
} from './schemas/ad-group.schema';
import {
  ApiToken,
  ApiTokenDocument,
  ApiTokenType,
} from './schemas/api-token.schema';
import { AdCostSource } from './schemas/ad-cost.schema';
import {
  Fanpage,
  FanpageDocument,
  FanpagePlatform,
  FanpageStatus,
  FanpageSyncSource,
} from '../chatbot/schemas/fanpage.schema';

import {
  FacebookBusinessRef,
  FacebookAdAccountRow,
  FacebookPageRow,
  FacebookAdsetRow,
  FacebookInsightRow,
  BusinessTokenSyncResult,
} from './ads.types';

import { normalizeToUtcDay, toUtcDateOnlyString, fetchWithRetry } from './ads.utils';
import { AdsTokenService } from './ads-token.service';
import { AdsCrudService } from './ads-crud.service';
import { AdsCostSyncService } from './ads-cost-sync.service';

@Injectable()
export class AdsFacebookSyncService {
  private readonly logger = new Logger(AdsFacebookSyncService.name);

  constructor(
    @InjectModel(AdAccount.name) private adAccountModel: Model<AdAccountDocument>,
    @InjectModel(AdGroup.name) private adGroupModel: Model<AdGroupDocument>,
    @InjectModel(Fanpage.name) private fanpageModel: Model<FanpageDocument>,
    private readonly adsTokenService: AdsTokenService,
    private readonly adsCrudService: AdsCrudService,
    private readonly adsCostSyncService: AdsCostSyncService,
    private configService: ConfigService,
  ) {}

  async syncFacebookBusinessToken(tokenId: string, dateStr?: string): Promise<BusinessTokenSyncResult> {
    const tokenDoc = await this.adsTokenService.getTokenByIdForUse(tokenId);
    if (tokenDoc.platform !== 'FACEBOOK' || tokenDoc.tokenType !== ApiTokenType.FACEBOOK_SYSTEM_USER) {
      throw new BadRequestException('Token này không phải Facebook system user token.');
    }

    const accessToken = this.adsTokenService.decrypt(tokenDoc.accessToken);
    const syncDates = dateStr
      ? [normalizeToUtcDay(dateStr)]
      : this.adsCostSyncService.buildRollingSyncDates(this.adsCostSyncService.getSyncLookbackDays());

    const result = await this.runFacebookBusinessTokenSync(tokenDoc, accessToken, syncDates);
    tokenDoc.lastSyncedAt = new Date();
    await tokenDoc.save();
    return result;
  }

  async runFacebookBusinessTokenSync(
    tokenDoc: ApiTokenDocument,
    accessToken: string,
    syncDates: Date[],
  ): Promise<BusinessTokenSyncResult> {
    const errors: string[] = [];
    let synced = 0;
    let adAccountsSynced = 0;
    let adGroupsSynced = 0;
    let fanpagesSynced = 0;

    const businesses = await this.resolveFacebookBusinesses(tokenDoc, accessToken);
    if (!tokenDoc.businessId && businesses.length === 1) {
      tokenDoc.businessId = businesses[0].id;
      tokenDoc.businessName = businesses[0].name;
    }

    const accountRows = await this.fetchFacebookBusinessAdAccounts(accessToken, businesses);
    const pages = await this.fetchFacebookPages(accessToken, businesses);
    const accounts: AdAccountDocument[] = [];

    for (const row of accountRows) {
      try {
        const account = await this.upsertFacebookAdAccount(row, tokenDoc);
        if (!account) continue;
        accounts.push(account);
        adAccountsSynced += 1;
      } catch (err: any) {
        errors.push(`Ad account ${row.name || row.account_id || row.id}: ${err.message}`);
      }
    }

    for (const row of pages) {
      try {
        const fanpage = await this.upsertFacebookFanpage(row, tokenDoc);
        if (!fanpage) continue;
        fanpagesSynced += 1;
        if (!row.access_token) {
          errors.push(`Fanpage ${row.name || row.id}: chưa lấy được page access token.`);
        }
      } catch (err: any) {
        errors.push(`Fanpage ${row.name || row.id}: ${err.message}`);
      }
    }

    for (const account of accounts) {
      try {
        const groupResult = await this.syncFacebookAdsetsForAccount(accessToken, account, tokenDoc);
        adGroupsSynced += groupResult.groupsSynced;

        for (const syncDate of syncDates) {
          const syncResult = await this.syncFacebookInsightsForAccount(
            accessToken,
            account,
            tokenDoc,
            groupResult.groupsByExternalId,
            syncDate,
          );
          synced += syncResult.synced;
          adGroupsSynced += syncResult.groupsSynced;
        }
      } catch (err: any) {
        errors.push(`Account ${account.name}: ${err.message}`);
      }
    }

    return { synced, adAccountsSynced, adGroupsSynced, fanpagesSynced, errors };
  }

  // ─── Facebook Graph helpers ─────────────────────────────

  private buildFacebookGraphUrl(
    path: string,
    params: Record<string, string | number | undefined>,
  ): string {
    const url = new URL(`https://graph.facebook.com/v25.0${path}`);
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;
      url.searchParams.set(key, String(value));
    });
    return url.toString();
  }

  private async fetchFacebookCollection<T>(url: string, accessToken: string): Promise<T[]> {
    const results: T[] = [];
    const visited = new Set<string>();
    let nextUrl: string | null = url;

    while (nextUrl) {
      if (visited.has(nextUrl)) break;
      visited.add(nextUrl);

      const response = await fetchWithRetry(nextUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const pageData = Array.isArray(response?.data) ? response.data as T[] : [];
      results.push(...pageData);
      nextUrl = response?.paging?.next || null;
    }

    return results;
  }

  private normalizeFacebookAdAccountId(raw?: string): string {
    return String(raw || '').replace(/^act_/, '').trim();
  }

  private mapFacebookAccountStatus(raw?: number | string): string {
    const status = Number(raw);
    if ([2, 101, 201].includes(status)) return AdAccountStatus.DISABLED;
    if ([3, 7, 8, 9, 100].includes(status)) return AdAccountStatus.PAUSED;
    return AdAccountStatus.ACTIVE;
  }

  private mapFacebookAdGroupStatus(raw?: string): string {
    const normalized = String(raw || '').trim().toUpperCase();
    if (!normalized || normalized.includes('ACTIVE')) return AdGroupStatus.ACTIVE;
    if (normalized.includes('PAUSED')) return AdGroupStatus.PAUSED;
    return AdGroupStatus.ARCHIVED;
  }

  private convertSpendToVnd(amount: number, currency?: string): number {
    const normalized = String(currency || '').trim().toUpperCase();
    if (!normalized || normalized === 'VND') return amount;
    if (normalized === 'USD') return amount * this.getExchangeRate('USD');
    return amount;
  }

  private getExchangeRate(currency: string): number {
    if (currency === 'USD') {
      return Number(this.configService.get<string>('USD_TO_VND', '25000'));
    }
    return 1;
  }

  // ─── Facebook resolve/fetch ─────────────────────────────

  private async resolveFacebookBusinesses(
    tokenDoc: ApiTokenDocument,
    accessToken: string,
  ): Promise<FacebookBusinessRef[]> {
    const businesses = new Map<string, FacebookBusinessRef>();
    if (tokenDoc.businessId) {
      businesses.set(tokenDoc.businessId, {
        id: tokenDoc.businessId,
        name: tokenDoc.businessName || undefined,
      });
    }

    try {
      const discovered = await this.fetchFacebookCollection<FacebookBusinessRef>(
        this.buildFacebookGraphUrl('/me/businesses', {
          fields: 'id,name',
          limit: 100,
        }),
        accessToken,
      );
      discovered.forEach((business) => {
        if (!business?.id) return;
        businesses.set(business.id, { id: business.id, name: business.name });
      });
    } catch (err: any) {
      if (!businesses.size) {
        this.logger.warn(`Cannot resolve Facebook businesses from system token: ${err.message}`);
      }
    }

    return Array.from(businesses.values());
  }

  private async fetchFacebookBusinessAdAccounts(
    accessToken: string,
    businesses: FacebookBusinessRef[],
  ): Promise<FacebookAdAccountRow[]> {
    const accounts = new Map<string, FacebookAdAccountRow>();
    const addAccount = (row: FacebookAdAccountRow, business?: FacebookBusinessRef) => {
      const accountId = this.normalizeFacebookAdAccountId(row.account_id || row.id);
      if (!accountId) return;
      accounts.set(accountId, {
        ...row,
        account_id: accountId,
        business: row.business?.id
          ? row.business
          : business
            ? { id: business.id, name: business.name }
            : undefined,
      });
    };

    for (const business of businesses) {
      for (const edge of ['owned_ad_accounts', 'client_ad_accounts']) {
        try {
          const rows = await this.fetchFacebookCollection<FacebookAdAccountRow>(
            this.buildFacebookGraphUrl(`/${business.id}/${edge}`, {
              fields: 'id,account_id,name,account_status,currency,business',
              limit: 250,
            }),
            accessToken,
          );
          rows.forEach((row) => addAccount(row, business));
        } catch (err: any) {
          this.logger.warn(`Cannot fetch ${edge} for business ${business.id}: ${err.message}`);
        }
      }
    }

    if (!accounts.size) {
      const fallbackRows = await this.fetchFacebookCollection<FacebookAdAccountRow>(
        this.buildFacebookGraphUrl('/me/adaccounts', {
          fields: 'id,account_id,name,account_status,currency,business',
          limit: 250,
        }),
        accessToken,
      );
      fallbackRows.forEach((row) => addAccount(row));
    }

    return Array.from(accounts.values());
  }

  private async fetchFacebookPages(
    accessToken: string,
    businesses: FacebookBusinessRef[],
  ): Promise<FacebookPageRow[]> {
    const pages = new Map<string, FacebookPageRow>();
    const addPage = (row: FacebookPageRow) => {
      const pageId = String(row.id || '').trim();
      if (!pageId) return;
      const existing = pages.get(pageId);
      pages.set(pageId, {
        ...(existing || {}),
        ...row,
        id: pageId,
        access_token: row.access_token || existing?.access_token,
      });
    };

    for (const business of businesses) {
      try {
        const rows = await this.fetchFacebookCollection<FacebookPageRow>(
          this.buildFacebookGraphUrl(`/${business.id}/owned_pages`, {
            fields: 'id,name,link',
            limit: 250,
          }),
          accessToken,
        );
        rows.forEach(addPage);
      } catch (err: any) {
        this.logger.warn(`Cannot fetch owned_pages for business ${business.id}: ${err.message}`);
      }
    }

    try {
      const accessiblePages = await this.fetchFacebookCollection<FacebookPageRow>(
        this.buildFacebookGraphUrl('/me/accounts', {
          fields: 'id,name,access_token,link',
          limit: 250,
        }),
        accessToken,
      );
      accessiblePages.forEach(addPage);
    } catch (err: any) {
      if (!pages.size) {
        this.logger.warn(`Cannot fetch /me/accounts for Facebook pages: ${err.message}`);
      }
    }

    for (const page of pages.values()) {
      if (!page.access_token && page.id) {
        page.access_token = await this.resolveFacebookPageAccessToken(page.id, accessToken);
      }
    }

    return Array.from(pages.values());
  }

  private async resolveFacebookPageAccessToken(pageId: string, accessToken: string): Promise<string | undefined> {
    try {
      const response = await fetchWithRetry(
        this.buildFacebookGraphUrl(`/${pageId}`, { fields: 'access_token' }),
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      return response?.access_token || undefined;
    } catch {
      return undefined;
    }
  }

  // ─── Facebook upsert ───────────────────────────────────

  private async upsertFacebookAdAccount(
    row: FacebookAdAccountRow,
    tokenDoc: ApiTokenDocument,
  ): Promise<AdAccountDocument | null> {
    const platformAccountId = this.normalizeFacebookAdAccountId(row.account_id || row.id);
    if (!platformAccountId) return null;

    const businessId = row.business?.id || tokenDoc.businessId || undefined;
    const businessName = row.business?.name || tokenDoc.businessName || undefined;
    const now = new Date();
    const status = this.mapFacebookAccountStatus(row.account_status);
    const currency = row.currency?.toUpperCase();

    let account = await this.adAccountModel.findOne({
      platform: 'FACEBOOK',
      platformAccountId,
    }).exec();

    if (!account) {
      account = new this.adAccountModel({
        accountCode: await this.adsCrudService.generateAccountCode(),
        name: row.name || `Facebook Ads ${platformAccountId}`,
        platform: 'FACEBOOK',
        platformAccountId,
        status,
        currency,
        businessId,
        businessName,
        syncSource: AdAccountSyncSource.FACEBOOK_BM,
        lastSyncedAt: now,
        createdById: tokenDoc.createdById,
        createdByName: tokenDoc.label || 'Facebook BM Sync',
      });
      return account.save();
    }

    account.name = row.name || account.name;
    account.status = status;
    account.currency = currency || account.currency;
    account.businessId = businessId;
    account.businessName = businessName;
    account.syncSource = AdAccountSyncSource.FACEBOOK_BM;
    account.lastSyncedAt = now;
    return account.save();
  }

  private async upsertFacebookAdGroup(
    account: AdAccountDocument,
    row: FacebookAdsetRow,
    tokenDoc: ApiTokenDocument,
  ): Promise<AdGroupDocument | null> {
    const externalId = String(row.id || '').trim();
    if (!externalId) return null;

    const now = new Date();
    const status = this.mapFacebookAdGroupStatus(row.effective_status);
    const startDate = row.start_time ? new Date(row.start_time) : undefined;
    const endDate = row.end_time ? new Date(row.end_time) : undefined;

    let group = await this.adGroupModel.findOne({
      adAccountId: account._id,
      platformCampaignId: externalId,
    }).exec();

    if (!group) {
      group = new this.adGroupModel({
        groupCode: await this.adsCrudService.generateGroupCode(),
        name: row.name || `Facebook Ad Set ${externalId}`,
        adAccountId: account._id,
        adAccountName: account.name,
        platform: 'FACEBOOK',
        platformCampaignId: externalId,
        status,
        startDate,
        endDate,
        syncSource: AdGroupSyncSource.FACEBOOK_BM,
        lastSyncedAt: now,
        createdById: tokenDoc.createdById,
        createdByName: tokenDoc.label || 'Facebook BM Sync',
      });
      return group.save();
    }

    group.name = row.name || group.name;
    group.adAccountName = account.name;
    group.status = status;
    group.startDate = startDate || group.startDate;
    group.endDate = endDate || group.endDate;
    group.syncSource = AdGroupSyncSource.FACEBOOK_BM;
    group.lastSyncedAt = now;
    return group.save();
  }

  private async upsertFacebookFanpage(
    row: FacebookPageRow,
    tokenDoc: ApiTokenDocument,
  ): Promise<FanpageDocument | null> {
    const pageId = String(row.id || '').trim();
    if (!pageId) return null;

    const now = new Date();
    const encryptedPageToken = row.access_token ? this.adsTokenService.encrypt(row.access_token) : undefined;
    let fanpage = await this.fanpageModel.findOne({
      platform: FanpagePlatform.FACEBOOK,
      pageId,
    }).exec();

    if (!fanpage) {
      fanpage = new this.fanpageModel({
        fanpageCode: await this.adsCrudService.generateFanpageCode(),
        name: row.name || `Facebook Page ${pageId}`,
        platform: FanpagePlatform.FACEBOOK,
        pageId,
        pageAccessToken: encryptedPageToken,
        syncSource: FanpageSyncSource.FACEBOOK_BM,
        businessId: tokenDoc.businessId,
        businessName: tokenDoc.businessName,
        syncTokenId: tokenDoc._id,
        syncTokenLabel: tokenDoc.label,
        lastSyncedAt: now,
        status: FanpageStatus.ACTIVE,
        aiAutoReplyEnabled: true,
        createdById: tokenDoc.createdById,
        createdByName: tokenDoc.label || 'Facebook BM Sync',
      });
      return fanpage.save();
    }

    fanpage.name = row.name || fanpage.name;
    if (encryptedPageToken) fanpage.pageAccessToken = encryptedPageToken;
    fanpage.syncSource = FanpageSyncSource.FACEBOOK_BM;
    fanpage.businessId = tokenDoc.businessId;
    fanpage.businessName = tokenDoc.businessName;
    fanpage.syncTokenId = tokenDoc._id;
    fanpage.syncTokenLabel = tokenDoc.label;
    fanpage.lastSyncedAt = now;
    return fanpage.save();
  }

  // ─── Facebook sync orchestration ───────────────────────

  private async syncFacebookAdsetsForAccount(
    accessToken: string,
    account: AdAccountDocument,
    tokenDoc: ApiTokenDocument,
  ): Promise<{ groupsSynced: number; groupsByExternalId: Map<string, AdGroupDocument> }> {
    const rows = await this.fetchFacebookCollection<FacebookAdsetRow>(
      this.buildFacebookGraphUrl(`/act_${account.platformAccountId}/adsets`, {
        fields: 'id,name,effective_status,start_time,end_time',
        limit: 250,
      }),
      accessToken,
    );

    const groupsByExternalId = new Map<string, AdGroupDocument>();
    let groupsSynced = 0;

    for (const row of rows) {
      const group = await this.upsertFacebookAdGroup(account, row, tokenDoc);
      if (!group) continue;
      groupsByExternalId.set(group.platformCampaignId, group);
      groupsSynced += 1;
    }

    return { groupsSynced, groupsByExternalId };
  }

  private async syncFacebookInsightsForAccount(
    accessToken: string,
    account: AdAccountDocument,
    tokenDoc: ApiTokenDocument,
    groupsByExternalId: Map<string, AdGroupDocument>,
    date: Date,
  ): Promise<{ synced: number; groupsSynced: number }> {
    const dateStr = toUtcDateOnlyString(date);
    const rows = await this.fetchFacebookCollection<FacebookInsightRow>(
      this.buildFacebookGraphUrl(`/act_${account.platformAccountId}/insights`, {
        fields: 'adset_id,adset_name,spend,impressions,clicks,actions',
        level: 'adset',
        time_range: JSON.stringify({ since: dateStr, until: dateStr }),
        limit: 250,
      }),
      accessToken,
    );

    let synced = 0;
    let groupsSynced = 0;

    for (const row of rows) {
      const externalId = String(row.adset_id || '').trim();
      if (!externalId) continue;

      let group: AdGroupDocument | null | undefined = groupsByExternalId.get(externalId);
      if (!group) {
        group = await this.upsertFacebookAdGroup(account, {
          id: externalId,
          name: row.adset_name,
          effective_status: 'ACTIVE',
        }, tokenDoc);
        if (group) {
          groupsByExternalId.set(externalId, group);
          groupsSynced += 1;
        }
      }
      if (!group) continue;

      const conversions = (row.actions || [])
        .filter((action) => action.action_type === 'offsite_conversion')
        .reduce((sum, action) => sum + Number(action.value || 0), 0);

      await this.adsCostSyncService.createOrUpdateCost({
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
      synced += 1;
    }

    return { synced, groupsSynced };
  }
}
