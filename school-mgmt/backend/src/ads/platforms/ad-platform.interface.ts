import { ApiTokenDocument } from "../schemas/api-token.schema";
import { AdAccountDocument } from "../schemas/ad-account.schema";
import { AdGroupDocument } from "../schemas/ad-group.schema";
import { BusinessTokenSyncResult } from "../ads.types";

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
}
