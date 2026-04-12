import {
  Injectable,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { AdAccount } from './schemas/ad-account.schema';
import { AdGroup, AdGroupDocument } from './schemas/ad-group.schema';
import { ApiToken } from './schemas/api-token.schema';
import { AdCost } from './schemas/ad-cost.schema';

import { CreateAdAccountDto } from './dto/create-ad-account.dto';
import { UpdateAdAccountDto } from './dto/update-ad-account.dto';
import { QueryAdAccountDto } from './dto/query-ad-account.dto';
import { CreateAdGroupDto } from './dto/create-ad-group.dto';
import { UpdateAdGroupDto } from './dto/update-ad-group.dto';
import { QueryAdGroupDto } from './dto/query-ad-group.dto';
import { CreateApiTokenDto } from './dto/create-api-token.dto';
import { UpdateApiTokenDto } from './dto/update-api-token.dto';
import { CreateAdCostDto } from './dto/create-ad-cost.dto';
import { QueryAdCostDto } from './dto/query-ad-cost.dto';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { BusinessTokenSyncResult } from './ads.types';

import { AdsTokenService } from './ads-token.service';
import { AdsCrudService } from './ads-crud.service';
import { AdsFacebookSyncService } from './ads-facebook-sync.service';
import { AdsCostSyncService } from './ads-cost-sync.service';
import { AdsDataService } from './ads-data.service';
import { GoogleAdsProvider } from './platforms/google-ads.service';
import { TikTokAdsProvider } from './platforms/tiktok-ads.service';

@Injectable()
export class AdsService {
  private readonly logger = new Logger(AdsService.name);

  constructor(
    private readonly adsTokenService: AdsTokenService,
    private readonly adsCrudService: AdsCrudService,
    private readonly adsFacebookSyncService: AdsFacebookSyncService,
    private readonly adsCostSyncService: AdsCostSyncService,
    private readonly adsDataService: AdsDataService,
    private readonly googleAdsProvider: GoogleAdsProvider,
    private readonly tikTokAdsProvider: TikTokAdsProvider,
  ) {}

  // ─── Ad Account CRUD ───────────────────────────────────

  async createAccount(dto: CreateAdAccountDto, user: JwtPayload): Promise<AdAccount> {
    return this.adsCrudService.createAccount(dto, user);
  }

  async findAllAccounts(query: QueryAdAccountDto) {
    return this.adsCrudService.findAllAccounts(query);
  }

  async findOneAccount(id: string) {
    return this.adsCrudService.findOneAccount(id);
  }

  async updateAccount(id: string, dto: UpdateAdAccountDto): Promise<AdAccount> {
    return this.adsCrudService.updateAccount(id, dto);
  }

  async deleteAccount(id: string): Promise<void> {
    return this.adsCrudService.deleteAccount(id);
  }

  // ─── Ad Group CRUD ─────────────────────────────────────

  async createGroup(dto: CreateAdGroupDto, user: JwtPayload): Promise<AdGroup> {
    return this.adsCrudService.createGroup(dto, user);
  }

  async findAllGroups(query: QueryAdGroupDto) {
    return this.adsCrudService.findAllGroups(query);
  }

  async findOneGroup(id: string): Promise<AdGroupDocument> {
    return this.adsCrudService.findOneGroup(id);
  }

  async updateGroup(id: string, dto: UpdateAdGroupDto): Promise<AdGroup> {
    return this.adsCrudService.updateGroup(id, dto);
  }

  async deleteGroup(id: string): Promise<void> {
    return this.adsCrudService.deleteGroup(id);
  }

  async findGroupsByPlatform(platform: string): Promise<AdGroup[]> {
    return this.adsCrudService.findGroupsByPlatform(platform);
  }

  async findAllGroupsSimple(): Promise<AdGroup[]> {
    return this.adsCrudService.findAllGroupsSimple();
  }

  // ─── API Token Management ─────────────────────────────

  async createToken(dto: CreateApiTokenDto, user: JwtPayload): Promise<ApiToken> {
    return this.adsTokenService.createToken(dto, user);
  }

  async findAllTokens(): Promise<any[]> {
    return this.adsTokenService.findAllTokens();
  }

  async findTokensByAccount(accountId: string): Promise<any[]> {
    return this.adsTokenService.findTokensByAccount(accountId);
  }

  async updateToken(id: string, dto: UpdateApiTokenDto): Promise<ApiToken> {
    return this.adsTokenService.updateToken(id, dto);
  }

  async deleteToken(id: string): Promise<void> {
    return this.adsTokenService.deleteToken(id);
  }

  // ─── Ad Cost Management ───────────────────────────────

  async createOrUpdateCost(dto: CreateAdCostDto): Promise<AdCost> {
    return this.adsCostSyncService.createOrUpdateCost(dto);
  }

  async findAllCosts(query: QueryAdCostDto) {
    return this.adsCostSyncService.findAllCosts(query);
  }

  async deleteCost(id: string): Promise<void> {
    return this.adsCostSyncService.deleteCost(id);
  }

  // ─── Platform Sync ────────────────────────────────────

  async syncFacebookBusinessToken(tokenId: string, dateStr?: string): Promise<BusinessTokenSyncResult> {
    return this.adsFacebookSyncService.syncFacebookBusinessToken(tokenId, dateStr);
  }

  async syncGoogleMccToken(
    tokenId: string,
    dateStr?: string,
  ): Promise<BusinessTokenSyncResult> {
    return this.googleAdsProvider.syncGoogleMccToken(tokenId, dateStr);
  }

  async syncTikTokBusinessCenterToken(
    tokenId: string,
    dateStr?: string,
  ): Promise<BusinessTokenSyncResult> {
    return this.tikTokAdsProvider.syncTikTokBusinessCenterToken(tokenId, dateStr);
  }

  async syncAccountCosts(accountId: string, dateStr?: string): Promise<number> {
    return this.adsCostSyncService.syncAccountCosts(accountId, dateStr);
  }

  // ─── Cron: Daily Ad Cost Sync ─────────────────────────

  @Cron('0 6 * * *')
  async syncAllAdCosts(): Promise<{ synced: number; errors: string[] }> {
    const lookbackDays = this.adsCostSyncService.getSyncLookbackDays();
    const syncDates = this.adsCostSyncService.buildRollingSyncDates(lookbackDays);
    this.logger.log(`Starting daily ad cost sync (lookback ${lookbackDays} day(s))...`);

    const businessTokens = await this.adsTokenService.findActiveBusinessTokens();
    const accounts = await this.adsCrudService.findActiveAccounts();

    let synced = 0;
    const errors: string[] = [];

    for (const token of businessTokens) {
      try {
        const result = await this.adsFacebookSyncService.runFacebookBusinessTokenSync(
          token,
          this.adsTokenService.decrypt(token.accessToken),
          syncDates,
        );
        await this.adsTokenService.markTokenSynced(token);
        synced += result.synced;
        errors.push(...result.errors);
      } catch (err: any) {
        const msg = `${token.label || token.businessName || token._id} (FACEBOOK_BM): ${err.message}`;
        errors.push(msg);
        this.logger.error(msg);
      }
    }

    for (const account of accounts) {
      const hasAccountToken = await this.adsTokenService.findBestActiveToken({
        adAccountId: account._id,
        tokenType: 'ACCOUNT',
      });
      if (!hasAccountToken) continue;

      try {
        const count = await this.adsCostSyncService.syncAccountCostsForDates(account._id.toString(), syncDates);
        synced += count;
      } catch (err: any) {
        const msg = `${account.name} (${account.platform}): ${err.message}`;
        errors.push(msg);
        this.logger.error(msg);
      }
    }

    this.logger.log(`Ad cost sync complete. Synced: ${synced}, Errors: ${errors.length}`);

    try {
      await this.adsDataService.syncTrueRevenue();
    } catch (err: any) {
      this.logger.error(`syncTrueRevenue cron error: ${err.message}`);
    }

    return { synced, errors };
  }

  // ─── Analytics ─────────────────────────────────────────

  async getAnalytics(startDate: string, endDate: string, adGroupId?: string, platform?: string): Promise<any> {
    return this.adsDataService.getAnalytics(startDate, endDate, adGroupId, platform);
  }

  async getNetProfitByAdGroup(startDate: string, endDate: string, adGroupId?: string): Promise<any> {
    return this.adsDataService.getNetProfitByAdGroup(startDate, endDate, adGroupId);
  }

  async getSuggestions(startDate: string, endDate: string, totalBudget: number): Promise<any> {
    return this.adsDataService.getSuggestions(startDate, endDate, totalBudget);
  }

  // ─── Backfill & Revenue Sync ──────────────────────────

  async backfillAdGroupIds() {
    return this.adsDataService.backfillAdGroupIds();
  }

  async backfillParentAttribution() {
    return this.adsDataService.backfillParentAttribution();
  }

  async syncTrueRevenue(adGroupId?: string) {
    return this.adsDataService.syncTrueRevenue(adGroupId);
  }
}
