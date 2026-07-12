import { Injectable, BadRequestException } from "@nestjs/common";
import { InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Model } from "mongoose";
import { BaseAdPlatformService } from "./base-ad-platform.service";
import { IAdPlatformService } from "./ad-platform.interface";
import {
  AdAccount,
  AdAccountDocument,
  AdPlatform,
  AdAccountStatus,
  AdAccountSyncSource,
} from "../schemas/ad-account.schema";
import {
  AdGroup,
  AdGroupDocument,
  AdGroupStatus,
  AdGroupSyncSource,
} from "../schemas/ad-group.schema";
import {
  AdCost,
  AdCostDocument,
  AdCostSource,
} from "../schemas/ad-cost.schema";
import { Fanpage, FanpageDocument } from "../../chatbot/schemas/fanpage.schema";
import { ApiToken, ApiTokenDocument, ApiTokenType } from "../schemas/api-token.schema";
import {
  BusinessTokenSyncResult,
  GoogleCampaignRow,
  GoogleCustomerClientRow,
} from "../ads.types";
import { toUtcDateOnlyString, groupDayKey } from "../ads.utils";

@Injectable()
export class GoogleAdsProvider
  extends BaseAdPlatformService
  implements IAdPlatformService
{
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

  async syncBusinessToken(
    tokenId: string,
    tokenDoc: ApiTokenDocument,
    accessToken: string,
    syncDates: Date[],
  ): Promise<BusinessTokenSyncResult> {
    return this.runGoogleMccTokenSync(tokenDoc, accessToken, syncDates);
  }

  async syncPlatformCosts(
    tokenDoc: ApiTokenDocument,
    account: AdAccountDocument,
    groups: AdGroupDocument[],
    syncDate: Date,
  ): Promise<number> {
    const accessToken = this.decrypt(tokenDoc.accessToken);
    return this.syncGoogleCosts(
      accessToken,
      account,
      groups,
      syncDate,
      tokenDoc.businessId,
    );
  }

  async syncGoogleMccToken(
    tokenId: string,
    dateStr?: string,
  ): Promise<BusinessTokenSyncResult> {
    const tokenDoc = await this.getTokenByIdForUse(tokenId);
    if (
      tokenDoc.platform !== AdPlatform.GOOGLE ||
      tokenDoc.tokenType !== ApiTokenType.GOOGLE_MCC
    ) {
      throw new BadRequestException("Token này không phải Google MCC token.");
    }

    const accessToken = this.decrypt(tokenDoc.accessToken);
    const syncDates = dateStr
      ? [this.normalizeToUtcDay(dateStr)]
      : this.buildRollingSyncDates(this.getSyncLookbackDays());

    const result = await this.runGoogleMccTokenSync(
      tokenDoc,
      accessToken,
      syncDates,
    );
    tokenDoc.lastSyncedAt = new Date();
    await tokenDoc.save();
    return result;
  }

  private normalizeGoogleCustomerId(raw?: string | number): string {
    return String(raw || "")
      .replace(/\D/g, "")
      .trim();
  }

  private parseGoogleCustomerIdFromResource(raw?: string): string {
    const match = String(raw || "").match(/customers\/(\d+)/);
    return match ? match[1] : this.normalizeGoogleCustomerId(raw);
  }

  private mapGoogleAccountStatus(raw?: string): string {
    const normalized = String(raw || "")
      .trim()
      .toUpperCase();
    if (!normalized || normalized === "ENABLED") return AdAccountStatus.ACTIVE;
    if (normalized.includes("SUSPENDED")) return AdAccountStatus.PAUSED;
    return AdAccountStatus.DISABLED;
  }

  private mapGoogleAdGroupStatus(raw?: string): string {
    const normalized = String(raw || "")
      .trim()
      .toUpperCase();
    if (!normalized || normalized === "ENABLED") return AdGroupStatus.ACTIVE;
    if (normalized.includes("PAUSED")) return AdGroupStatus.PAUSED;
    return AdGroupStatus.ARCHIVED;
  }

  private async fetchGoogleAccessibleCustomerIds(
    accessToken: string,
  ): Promise<string[]> {
    const response = await this.fetchWithRetry(
      "https://googleads.googleapis.com/v19/customers:listAccessibleCustomers",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "developer-token": this.configService.get<string>(
            "GOOGLE_ADS_DEV_TOKEN",
            "",
          ),
        },
      },
    );
    return Array.isArray(response?.resourceNames)
      ? response.resourceNames
          .map((item: string) => this.parseGoogleCustomerIdFromResource(item))
          .filter(Boolean)
      : [];
  }

  private async fetchGoogleSearchStream(
    accessToken: string,
    customerId: string,
    query: string,
    loginCustomerId?: string,
  ): Promise<any[]> {
    const normalizedCustomerId = this.normalizeGoogleCustomerId(customerId);
    const normalizedLoginCustomerId =
      this.normalizeGoogleCustomerId(loginCustomerId);
    const response = await this.fetchWithRetry(
      `https://googleads.googleapis.com/v19/customers/${normalizedCustomerId}/googleAds:searchStream`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "developer-token": this.configService.get<string>(
            "GOOGLE_ADS_DEV_TOKEN",
            "",
          ),
          "Content-Type": "application/json",
          ...(normalizedLoginCustomerId
            ? { "login-customer-id": normalizedLoginCustomerId }
            : {}),
        },
        body: JSON.stringify({ query }),
      },
    );
    const batches = Array.isArray(response) ? response : [response];
    return batches.flatMap((batch: any) => batch?.results || []);
  }

  private unwrapGoogleCustomerClient(
    row: GoogleCustomerClientRow,
  ): NonNullable<GoogleCustomerClientRow["customerClient"]> | null {
    const client =
      row.customerClient ||
      (row.customer_client
        ? {
            clientCustomer: row.customer_client.client_customer,
            id: row.customer_client.id,
            descriptiveName: row.customer_client.descriptive_name,
            currencyCode: row.customer_client.currency_code,
            manager: row.customer_client.manager,
            status: row.customer_client.status,
          }
        : null);
    return client || null;
  }

  private async fetchGoogleCustomerSelf(
    accessToken: string,
    customerId: string,
    loginCustomerId: string,
  ): Promise<{
    id: string;
    name?: string;
    currency?: string;
    manager: boolean;
    status?: string;
  } | null> {
    const rows = await this.fetchGoogleSearchStream(
      accessToken,
      customerId,
      "SELECT customer_client.id, customer_client.descriptive_name, customer_client.currency_code, customer_client.manager, customer_client.status FROM customer_client WHERE customer_client.level = 0",
      loginCustomerId,
    );
    const client = rows.length
      ? this.unwrapGoogleCustomerClient(rows[0])
      : null;
    if (!client) return null;
    return {
      id: this.normalizeGoogleCustomerId(client.id || customerId),
      name: client.descriptiveName,
      currency: client.currencyCode,
      manager: Boolean(client.manager),
      status: client.status,
    };
  }

  private async collectGoogleLeafAccounts(
    accessToken: string,
    rootManagerId: string,
    currentManagerId: string,
    visited = new Set<string>(),
  ): Promise<
    Array<{ id: string; name?: string; currency?: string; status?: string }>
  > {
    const normalizedManagerId =
      this.normalizeGoogleCustomerId(currentManagerId);
    if (!normalizedManagerId || visited.has(normalizedManagerId)) return [];
    visited.add(normalizedManagerId);

    const rows = await this.fetchGoogleSearchStream(
      accessToken,
      normalizedManagerId,
      "SELECT customer_client.client_customer, customer_client.id, customer_client.descriptive_name, customer_client.currency_code, customer_client.manager, customer_client.status FROM customer_client WHERE customer_client.level = 1",
      rootManagerId,
    );

    const leafAccounts: Array<{
      id: string;
      name?: string;
      currency?: string;
      status?: string;
    }> = [];
    for (const row of rows) {
      const client = this.unwrapGoogleCustomerClient(row);
      if (!client) continue;
      const clientId = this.normalizeGoogleCustomerId(
        client.clientCustomer || client.id,
      );
      if (!clientId) continue;
      if (client.manager) {
        const nested = await this.collectGoogleLeafAccounts(
          accessToken,
          rootManagerId,
          clientId,
          visited,
        );
        leafAccounts.push(...nested);
        continue;
      }
      leafAccounts.push({
        id: clientId,
        name: client.descriptiveName,
        currency: client.currencyCode,
        status: client.status,
      });
    }
    return leafAccounts;
  }

  private async upsertGoogleAdAccount(
    row: { id: string; name?: string; currency?: string; status?: string },
    tokenDoc: ApiTokenDocument,
  ): Promise<AdAccountDocument | null> {
    const platformAccountId = this.normalizeGoogleCustomerId(row.id);
    if (!platformAccountId) return null;

    const now = new Date();
    let account = await this.adAccountModel
      .findOne({
        platform: AdPlatform.GOOGLE,
        platformAccountId,
      })
      .exec();

    if (!account) {
      account = new this.adAccountModel({
        accountCode: await this.generateAccountCode(),
        name: row.name || `Google Ads ${platformAccountId}`,
        platform: AdPlatform.GOOGLE,
        platformAccountId,
        status: this.mapGoogleAccountStatus(row.status),
        currency: row.currency || "USD",
        businessId: tokenDoc.businessId,
        businessName: tokenDoc.businessName,
        syncSource: AdAccountSyncSource.GOOGLE_MCC,
        lastSyncedAt: now,
        createdById: tokenDoc.createdById,
        createdByName: tokenDoc.label || "Google MCC Sync",
      });
      return account.save();
    }

    account.name = row.name || account.name;
    account.status = this.mapGoogleAccountStatus(row.status);
    account.currency = row.currency || account.currency;
    account.businessId = tokenDoc.businessId;
    account.businessName = tokenDoc.businessName;
    account.syncSource = AdAccountSyncSource.GOOGLE_MCC;
    account.lastSyncedAt = now;
    return account.save();
  }

  private async upsertGoogleAdGroup(
    account: AdAccountDocument,
    row: GoogleCampaignRow,
    tokenDoc: ApiTokenDocument,
  ): Promise<AdGroupDocument | null> {
    const campaign = row.campaign;
    const externalId = String(campaign?.id || "").trim();
    if (!externalId) return null;

    const now = new Date();
    const startDate = this.parseOptionalUtcDate(
      campaign?.startDate || campaign?.start_date,
    );
    const endDate = this.parseOptionalUtcDate(
      campaign?.endDate || campaign?.end_date,
    );
    let group = await this.adGroupModel
      .findOne({
        adAccountId: account._id,
        platformCampaignId: externalId,
      })
      .exec();

    if (!group) {
      group = new this.adGroupModel({
        groupCode: await this.generateGroupCode(),
        name: campaign?.name || `Google Campaign ${externalId}`,
        adAccountId: account._id,
        adAccountName: account.name,
        platform: AdPlatform.GOOGLE,
        platformCampaignId: externalId,
        status: this.mapGoogleAdGroupStatus(campaign?.status),
        startDate,
        endDate,
        syncSource: AdGroupSyncSource.GOOGLE_MCC,
        lastSyncedAt: now,
        createdById: tokenDoc.createdById,
        createdByName: tokenDoc.label || "Google MCC Sync",
      });
      return group.save();
    }

    group.name = campaign?.name || group.name;
    group.adAccountName = account.name;
    group.status = this.mapGoogleAdGroupStatus(campaign?.status);
    group.startDate = startDate || group.startDate;
    group.endDate = endDate || group.endDate;
    group.syncSource = AdGroupSyncSource.GOOGLE_MCC;
    group.lastSyncedAt = now;
    return group.save();
  }

  private async syncGoogleCampaignsForManagedAccount(
    accessToken: string,
    loginCustomerId: string,
    account: AdAccountDocument,
    tokenDoc: ApiTokenDocument,
  ): Promise<{
    groupsSynced: number;
    groupsByExternalId: Map<string, AdGroupDocument>;
  }> {
    const rows = await this.fetchGoogleSearchStream(
      accessToken,
      account.platformAccountId,
      "SELECT campaign.id, campaign.name, campaign.status, campaign.start_date, campaign.end_date FROM campaign",
      loginCustomerId,
    );

    const groupsByExternalId = new Map<string, AdGroupDocument>();
    let groupsSynced = 0;

    for (const row of rows as GoogleCampaignRow[]) {
      const group = await this.upsertGoogleAdGroup(account, row, tokenDoc);
      if (!group) continue;
      groupsByExternalId.set(group.platformCampaignId, group);
      groupsSynced += 1;
    }

    return { groupsSynced, groupsByExternalId };
  }

  private async runGoogleMccTokenSync(
    tokenDoc: ApiTokenDocument,
    accessToken: string,
    syncDates: Date[],
  ): Promise<BusinessTokenSyncResult> {
    const errors: string[] = [];
    let synced = 0;
    let adAccountsSynced = 0;
    let adGroupsSynced = 0;

    let managerId = this.normalizeGoogleCustomerId(tokenDoc.businessId);
    if (!managerId) {
      const accessibleCustomers =
        await this.fetchGoogleAccessibleCustomerIds(accessToken);
      if (accessibleCustomers.length !== 1) {
        throw new BadRequestException(
          "Google MCC token cần MCC Customer ID khi token truy cập nhiều customer.",
        );
      }
      managerId = accessibleCustomers[0];
      tokenDoc.businessId = managerId;
    }

    const self = await this.fetchGoogleCustomerSelf(
      accessToken,
      managerId,
      managerId,
    );
    if (self?.name && !tokenDoc.businessName) {
      tokenDoc.businessName = self.name;
    }

    const accountRows = await this.collectGoogleLeafAccounts(
      accessToken,
      managerId,
      managerId,
    );
    const dedupedAccounts = new Map<
      string,
      { id: string; name?: string; currency?: string; status?: string }
    >();
    accountRows.forEach((row) => {
      if (!row.id) return;
      dedupedAccounts.set(row.id, row);
    });
    if (!dedupedAccounts.size && self?.id) {
      dedupedAccounts.set(self.id, {
        id: self.id,
        name: self.name,
        currency: self.currency,
        status: self.status,
      });
    }

    for (const row of dedupedAccounts.values()) {
      try {
        const account = await this.upsertGoogleAdAccount(row, tokenDoc);
        if (!account) continue;
        adAccountsSynced += 1;

        const campaignResult = await this.syncGoogleCampaignsForManagedAccount(
          accessToken,
          managerId,
          account,
          tokenDoc,
        );
        adGroupsSynced += campaignResult.groupsSynced;

        for (const syncDate of syncDates) {
          synced += await this.syncGoogleCosts(
            accessToken,
            account,
            Array.from(campaignResult.groupsByExternalId.values()),
            syncDate,
            managerId,
          );
        }
      } catch (err: any) {
        errors.push(`Google account ${row.name || row.id}: ${err.message}`);
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

  private async syncGoogleCosts(
    token: string,
    account: AdAccountDocument,
    groups: AdGroupDocument[],
    date: Date,
    loginCustomerId?: string,
  ): Promise<number> {
    const dateStr = this.toUtcDateOnlyString(date);
    let synced = 0;

    try {
      const query =
        `SELECT campaign.id, metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.conversions` +
        ` FROM campaign WHERE segments.date = '${dateStr}'`;

      const url = `https://googleads.googleapis.com/v19/customers/${account.platformAccountId}/googleAds:searchStream`;

      const response = await this.fetchWithRetry(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "developer-token": this.configService.get<string>(
            "GOOGLE_ADS_DEV_TOKEN",
            "",
          ),
          "Content-Type": "application/json",
          ...(loginCustomerId
            ? {
                "login-customer-id":
                  this.normalizeGoogleCustomerId(loginCustomerId),
              }
            : {}),
        },
        body: JSON.stringify({ query }),
      });

      const campaignMap = new Map<string, AdGroupDocument>();
      for (const g of groups) {
        campaignMap.set(g.platformCampaignId, g);
      }

      const streamBatches = Array.isArray(response) ? response : [response];
      const results = streamBatches.flatMap(
        (batch: any) => batch?.results || [],
      );
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
          platform: "GOOGLE",
          date: this.toUtcDateOnlyString(date),
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
}
