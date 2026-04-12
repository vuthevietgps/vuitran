import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { MarketingAttributionService } from "./marketing-attribution.service";
import { MarketingAttributionListener } from "./marketing-attribution.listener";
import {
  ParentAttribution,
  ParentAttributionSchema,
} from "./schemas/parent-attribution.schema";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ParentAttribution.name, schema: ParentAttributionSchema },
    ]),
  ],
  providers: [MarketingAttributionService, MarketingAttributionListener],
  exports: [MarketingAttributionService, MongooseModule],
})
export class MarketingAttributionModule {}
