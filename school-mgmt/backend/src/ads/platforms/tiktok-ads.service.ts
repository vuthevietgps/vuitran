import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Model, Types } from 'mongoose';
import { AdAccount, AdAccountDocument, AdPlatform, AdAccountStatus, AdAccountSyncSource } from '../schemas/ad-account.schema';
import { AdGroup, AdGroupDocument, AdGroupStatus, AdGroupSyncSource } from '../schemas/ad-group.schema';
import { AdCost, AdCostDocument, AdCostSource } from '../schemas/ad-cost.schema';
import { Fanpage, FanpageDocument } from '../../chatbot/schemas/fanpage.schema';
import { ApiToken, ApiTokenStatus, ApiTokenDocument, ApiTokenType } from '../schemas/api-token.schema';
import { IAdPlatformService } from './ad-platform.interface';
import { BaseAdPlatformService } from './base-ad-platform.service';
import {
  TikTokBusinessCenterRef,
  TikTokAdvertiserRow,
  TikTokCampaignRow,
  BusinessTokenSyncResult,
} from '../ads.types';





@Injectable()

export class TikTokAdsProvider extends BaseAdPlatformService implements IAdPlatformService {
  async syncBusinessToken(
    tokenId: string,
    tokenDoc: ApiTokenDocument,
    accessToken: string,
    syncDates: Date[],
  ): Promise<BusinessTokenSyncResult> {
    return this.syncTikTokBusinessCenterToken(tokenId);
  }

  async syncPlatformCosts(
    tokenDoc: ApiTokenDocument,
    account: AdAccountDocument,
    groups: AdGroupDocument[],
    syncDate: Date,
  ): Promise<number> {
    const accessToken = this.decrypt(tokenDoc.accessToken);
    return this.syncTikTokCosts(accessToken, account, groups, syncDate);
  }

  constructor(
    @InjectModel(AdAccount.name) adAccountModel: Model<AdAccountDocument>,
    @InjectModel(AdGroup.name) adGroupModel: Model<AdGroupDocument>,
    @InjectModel(Fanpage.name) fanpageModel: Model<FanpageDocument>,
    @InjectModel(AdCost.name) adCostModel: Model<AdCostDocument>,
    @InjectModel(ApiToken.name) apiTokenModel: Model<ApiTokenDocument>,
    configService: ConfigService,
  ) {
    super(adAccountModel, adGroupModel, fanpageModel, adCostModel, apiTokenModel, configService);
  }

  async syncTikTokBusinessCenterToken(tokenId: string, dateStr?: string): Promise<BusinessTokenSyncResult> {
      const tokenDoc = await this.getTokenByIdForUse(tokenId);
      if (tokenDoc.platform !== AdPlatform.TIKTOK || tokenDoc.tokenType !== ApiTokenType.TIKTOK_BUSINESS_CENTER) {
        throw new BadRequestException('Token này không phải TikTok Business Center token.');
      }
  
      const accessToken = this.decrypt(tokenDoc.accessToken);
      const syncDates = dateStr
        ? [this.normalizeToUtcDay(dateStr)]
        : this.buildRollingSyncDates(this.getSyncLookbackDays());
  
      const result = await this.runTikTokBusinessCenterTokenSync(tokenDoc, accessToken, syncDates);
      tokenDoc.lastSyncedAt = new Date();
      await tokenDoc.save();
      return result;
    }

  private buildTikTokUrl(path: string, params: Record<string, string | number | undefined>): string {
      const url = new URL(`https://business-api.tiktok.com${path}`);
      Object.entries(params).forEach(([key, value]) => {
        if (value === undefined || value === null || value === '') return;
        url.searchParams.set(key, String(value));
      });
      return url.toString();
    }

  private extractTikTokList(response: any): any[] {
      if (Array.isArray(response?.data?.list)) return response.data.list;
      if (Array.isArray(response?.data?.data)) return response.data.data;
      if (Array.isArray(response?.list)) return response.list;
      return [];
    }

  private extractTikTokPageInfo(response: any): any {
      return response?.data?.page_info || response?.page_info || {};
    }

  private async fetchTikTokPagedList<T>(
      path: string,
      accessToken: string,
      params: Record<string, string | number | undefined> = {},
    ): Promise<T[]> {
      const results: T[] = [];
      let page = 1;
      const pageSize = 1000;
  
      while (page <= 20) {
        const response = await this.fetchWithRetry(
          this.buildTikTokUrl(path, { ...params, page, page_size: pageSize }),
          { headers: { 'Access-Token': accessToken } },
        );
        const rows = this.extractTikTokList(response) as T[];
        results.push(...rows);
  
        const pageInfo = this.extractTikTokPageInfo(response);
        const totalPage = Number(pageInfo.total_page || pageInfo.total_pages || 0);
        const totalNumber = Number(pageInfo.total_number || pageInfo.total_count || 0);
        const hasNext = Boolean(pageInfo.has_next || pageInfo.has_more || pageInfo.hasMore);
  
        if (hasNext || (totalPage > 0 && page < totalPage) || (totalNumber > 0 && results.length < totalNumber)) {
          page += 1;
          continue;
        }
        break;
      }
  
      return results;
    }

  private mapTikTokAccountStatus(raw?: string): string {
      const normalized = String(raw || '').trim().toUpperCase();
      if (!normalized || normalized.includes('ENABLE') || normalized.includes('ACTIVE')) return AdAccountStatus.ACTIVE;
      if (normalized.includes('DISABLE') || normalized.includes('PAUSE')) return AdAccountStatus.PAUSED;
      return AdAccountStatus.DISABLED;
    }

  private mapTikTokCampaignStatus(raw?: string): string {
      const normalized = String(raw || '').trim().toUpperCase();
      if (!normalized || normalized.includes('ENABLE') || normalized.includes('ACTIVE')) return AdGroupStatus.ACTIVE;
      if (normalized.includes('DISABLE') || normalized.includes('PAUSE')) return AdGroupStatus.PAUSED;
      return AdGroupStatus.ARCHIVED;
    }

  private async resolveTikTokBusinessCenters(
      tokenDoc: ApiTokenDocument,
      accessToken: string,
    ): Promise<TikTokBusinessCenterRef[]> {
      const businesses = new Map<string, TikTokBusinessCenterRef>();
      if (tokenDoc.businessId) {
        businesses.set(tokenDoc.businessId, {
          id: tokenDoc.businessId,
          name: tokenDoc.businessName || undefined,
        });
      }
  
      try {
        const rows = await this.fetchTikTokPagedList<any>(
          '/open_api/v1.3/bc/get/',
          accessToken,
        );
        rows.forEach((row) => {
          const id = String(row.bc_id || row.business_center_id || row.id || '').trim();
          if (!id) return;
          businesses.set(id, {
            id,
            name: row.name || row.bc_name || row.business_center_name,
          });
        });
      } catch (err: any) {
        if (!businesses.size) {
          this.logger.warn(`Cannot resolve TikTok Business Centers from token: ${err.message}`);
        }
      }
  
      return Array.from(businesses.values());
    }

  private async fetchTikTokAuthorizedAdvertisers(accessToken: string): Promise<TikTokAdvertiserRow[]> {
      const rows = await this.fetchTikTokPagedList<TikTokAdvertiserRow>(
        '/open_api/v1.3/oauth2/advertiser/get/',
        accessToken,
      );
      return rows.filter((row) => String(row.advertiser_id || '').trim());
    }

  private async fetchTikTokBusinessCenterAdvertisers(
      accessToken: string,
      businessCenterId: string,
      fallbackAdvertisers: TikTokAdvertiserRow[],
    ): Promise<TikTokAdvertiserRow[]> {
      const advertisers = new Map<string, TikTokAdvertiserRow>();
      const fallbackById = new Map<string, TikTokAdvertiserRow>();
      fallbackAdvertisers.forEach((row) => {
        const id = String(row.advertiser_id || '').trim();
        if (id) fallbackById.set(id, row);
      });
  
      const mergeRow = (row: any) => {
        const id = String(row.advertiser_id || row.asset_id || row.id || '').trim();
        if (!id) return;
        advertisers.set(id, {
          ...(fallbackById.get(id) || {}),
          advertiser_id: id,
          advertiser_name: row.advertiser_name || row.name || fallbackById.get(id)?.advertiser_name,
          currency: row.currency || fallbackById.get(id)?.currency,
          status: row.status || fallbackById.get(id)?.status,
        });
      };
  
      try {
        const balanceRows = await this.fetchTikTokPagedList<any>(
          '/open_api/v1.3/advertiser/balance/get/',
          accessToken,
          { bc_id: businessCenterId },
        );
        balanceRows.forEach(mergeRow);
      } catch (err: any) {
        this.logger.warn(`Cannot fetch TikTok advertisers from advertiser/balance/get for BC ${businessCenterId}: ${err.message}`);
      }
  
      if (!advertisers.size) {
        try {
          const assetRows = await this.fetchTikTokPagedList<any>(
            '/open_api/v1.3/bc/asset/get/',
            accessToken,
            { bc_id: businessCenterId, asset_type: 'ADVERTISER' },
          );
          assetRows.forEach(mergeRow);
        } catch (err: any) {
          this.logger.warn(`Cannot fetch TikTok advertisers from bc/asset/get for BC ${businessCenterId}: ${err.message}`);
        }
      }
  
      if (!advertisers.size) {
        fallbackAdvertisers.forEach((row) => {
          const id = String(row.advertiser_id || '').trim();
          if (id) advertisers.set(id, row);
        });
      }
  
      return Array.from(advertisers.values());
    }

  private async upsertTikTokAdAccount(
      row: TikTokAdvertiserRow,
      tokenDoc: ApiTokenDocument,
      businessCenter: TikTokBusinessCenterRef,
    ): Promise<AdAccountDocument | null> {
      const platformAccountId = String(row.advertiser_id || '').trim();
      if (!platformAccountId) return null;
  
      const now = new Date();
      let account = await this.adAccountModel.findOne({
        platform: AdPlatform.TIKTOK,
        platformAccountId,
      }).exec();
  
      if (!account) {
        account = new this.adAccountModel({
          accountCode: await this.generateAccountCode(),
          name: row.advertiser_name || row.name || `TikTok Advertiser ${platformAccountId}`,
          platform: AdPlatform.TIKTOK,
          platformAccountId,
          status: this.mapTikTokAccountStatus(row.status),
          currency: row.currency || 'USD',
          businessId: businessCenter.id,
          businessName: businessCenter.name || tokenDoc.businessName,
          syncSource: AdAccountSyncSource.TIKTOK_BC,
          lastSyncedAt: now,
          createdById: tokenDoc.createdById,
          createdByName: tokenDoc.label || 'TikTok BC Sync',
        });
        return account.save();
      }
  
      account.name = row.advertiser_name || row.name || account.name;
      account.status = this.mapTikTokAccountStatus(row.status);
      account.currency = row.currency || account.currency;
      account.businessId = businessCenter.id;
      account.businessName = businessCenter.name || tokenDoc.businessName;
      account.syncSource = AdAccountSyncSource.TIKTOK_BC;
      account.lastSyncedAt = now;
      return account.save();
    }

  private async upsertTikTokAdGroup(
      account: AdAccountDocument,
      row: TikTokCampaignRow,
      tokenDoc: ApiTokenDocument,
    ): Promise<AdGroupDocument | null> {
      const externalId = String(row.campaign_id || '').trim();
      if (!externalId) return null;
  
      const now = new Date();
      const status = this.mapTikTokCampaignStatus(row.operation_status || row.secondary_status);
      const startDate = this.parseOptionalUtcDate(row.schedule_start_time || row.create_time);
      const endDate = this.parseOptionalUtcDate(row.schedule_end_time);
      let group = await this.adGroupModel.findOne({
        adAccountId: account._id,
        platformCampaignId: externalId,
      }).exec();
  
      if (!group) {
        group = new this.adGroupModel({
          groupCode: await this.generateGroupCode(),
          name: row.campaign_name || `TikTok Campaign ${externalId}`,
          adAccountId: account._id,
          adAccountName: account.name,
          platform: AdPlatform.TIKTOK,
          platformCampaignId: externalId,
          status,
          startDate,
          endDate,
          syncSource: AdGroupSyncSource.TIKTOK_BC,
          lastSyncedAt: now,
          createdById: tokenDoc.createdById,
          createdByName: tokenDoc.label || 'TikTok BC Sync',
        });
        return group.save();
      }
  
      group.name = row.campaign_name || group.name;
      group.adAccountName = account.name;
      group.status = status;
      group.startDate = startDate || group.startDate;
      group.endDate = endDate || group.endDate;
      group.syncSource = AdGroupSyncSource.TIKTOK_BC;
      group.lastSyncedAt = now;
      return group.save();
    }

  private async syncTikTokCampaignsForManagedAccount(
      accessToken: string,
      account: AdAccountDocument,
      tokenDoc: ApiTokenDocument,
    ): Promise<{ groupsSynced: number; groupsByExternalId: Map<string, AdGroupDocument> }> {
      const rows = await this.fetchTikTokPagedList<TikTokCampaignRow>(
        '/open_api/v1.3/campaign/get/',
        accessToken,
        { advertiser_id: account.platformAccountId },
      );
  
      const groupsByExternalId = new Map<string, AdGroupDocument>();
      let groupsSynced = 0;
  
      for (const row of rows) {
        const group = await this.upsertTikTokAdGroup(account, row, tokenDoc);
        if (!group) continue;
        groupsByExternalId.set(group.platformCampaignId, group);
        groupsSynced += 1;
      }
  
      return { groupsSynced, groupsByExternalId };
    }

  private async runTikTokBusinessCenterTokenSync(
      tokenDoc: ApiTokenDocument,
      accessToken: string,
      syncDates: Date[],
    ): Promise<BusinessTokenSyncResult> {
      const errors: string[] = [];
      let synced = 0;
      let adAccountsSynced = 0;
      let adGroupsSynced = 0;
  
      const businesses = await this.resolveTikTokBusinessCenters(tokenDoc, accessToken);
      if (!tokenDoc.businessId && businesses.length === 1) {
        tokenDoc.businessId = businesses[0].id;
        tokenDoc.businessName = businesses[0].name;
      }
  
      const authorizedAdvertisers = await this.fetchTikTokAuthorizedAdvertisers(accessToken);
      const seenAdvertisers = new Set<string>();
  
      for (const business of businesses) {
        const advertisers = await this.fetchTikTokBusinessCenterAdvertisers(
          accessToken,
          business.id,
          authorizedAdvertisers,
        );
  
        for (const advertiser of advertisers) {
          const advertiserId = String(advertiser.advertiser_id || '').trim();
          if (!advertiserId || seenAdvertisers.has(advertiserId)) continue;
          seenAdvertisers.add(advertiserId);
  
          try {
            const account = await this.upsertTikTokAdAccount(advertiser, tokenDoc, business);
            if (!account) continue;
            adAccountsSynced += 1;
  
            const campaignResult = await this.syncTikTokCampaignsForManagedAccount(accessToken, account, tokenDoc);
            adGroupsSynced += campaignResult.groupsSynced;
  
            for (const syncDate of syncDates) {
              synced += await this.syncTikTokCosts(
                accessToken,
                account,
                Array.from(campaignResult.groupsByExternalId.values()),
                syncDate,
              );
            }
          } catch (err: any) {
            errors.push(`TikTok advertiser ${advertiser.advertiser_name || advertiserId}: ${err.message}`);
          }
        }
      }
  
      return {
        synced,
        adAccountsSynced,
        adGroupsSynced,
        fanpagesSynced: 0,
        errors,
      };
    }

  private async syncTikTokCosts(
      token: string, account: AdAccountDocument, groups: AdGroupDocument[], date: Date,
    ): Promise<number> {
      const dateStr = this.toUtcDateOnlyString(date);
      let synced = 0;
  
      try {
        const url = `https://business-api.tiktok.com/open_api/v1.3/report/integrated/get/`
          + `?advertiser_id=${account.platformAccountId}`
          + `&report_type=BASIC`
          + `&dimensions=["campaign_id","stat_time_day"]`
          + `&metrics=["spend","impressions","clicks","conversions"]`
          + `&data_level=AUCTION_CAMPAIGN`
          + `&start_date=${dateStr}&end_date=${dateStr}`;
  
        const response = await this.fetchWithRetry(url, {
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
            spend: Number(row.metrics?.spend || 0) * this.getExchangeRate('USD'),
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
