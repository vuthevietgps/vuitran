import { ApiTokenDocument } from "../schemas/api-token.schema";
import { AdAccountDocument } from "../schemas/ad-account.schema";
import { AdGroupDocument } from "../schemas/ad-group.schema";
import { BusinessTokenSyncResult } from "../ads.types";

export interface AdPlatformMutationResult {
  attempted: boolean;
  platform: string;
  externalId: string;
  success: boolean;
  message?: string;
  raw?: unknown;
}

export interface IAdPlatformService {
  /**
   * Syncs the parent level tokens (agency / business level) down to managed ad accounts
   */
  syncBusinessToken(
    tokenId: string,
    tokenDoc: ApiTokenDocument,
    accessToken: string,
    syncDates: Date[],
  ): Promise<BusinessTokenSyncResult>;

  /**
   * Fetches costs for a specific ad account for a given date
   */
  syncPlatformCosts(
    tokenDoc: ApiTokenDocument,
    account: AdAccountDocument,
    groups: AdGroupDocument[],
    syncDate: Date,
  ): Promise<number>;

  /**
   * Optional live write adapter. Providers should implement this only after the
   * exact platform semantics and token scopes are verified.
   */
  updatePlatformGroupBudget?(
    tokenDoc: ApiTokenDocument,
    account: AdAccountDocument,
    group: AdGroupDocument,
    dailyBudget: number,
  ): Promise<AdPlatformMutationResult>;

  updatePlatformGroupStatus?(
    tokenDoc: ApiTokenDocument,
    account: AdAccountDocument,
    group: AdGroupDocument,
    status: string,
  ): Promise<AdPlatformMutationResult>;
}
