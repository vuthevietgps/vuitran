import { Injectable, BadRequestException } from "@nestjs/common";
import { FacebookAdsProvider } from "./facebook-ads.service";
import { GoogleAdsProvider } from "./google-ads.service";
import { TikTokAdsProvider } from "./tiktok-ads.service";
import { AdPlatform } from "../schemas/ad-account.schema";
import { IAdPlatformService } from "./ad-platform.interface";

@Injectable()
export class AdPlatformFactory {
  constructor(
    private readonly fb: FacebookAdsProvider,
    private readonly gg: GoogleAdsProvider,
    private readonly tt: TikTokAdsProvider,
  ) {}

  getService(platform: string): IAdPlatformService {
    switch (platform) {
      case "FACEBOOK":
        return this.fb;
      case "GOOGLE":
        return this.gg;
      case "TIKTOK":
        return this.tt;
      default:
        throw new BadRequestException(
          "Platform " + platform + " not supported",
        );
    }
  }
}
