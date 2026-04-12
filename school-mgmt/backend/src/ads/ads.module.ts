import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AdsController } from './ads.controller';
import { AdsService } from './ads.service';
import { AdsAnalyticsService } from './ads-analytics.service';
import { AdsAnalyticsProfitService } from './ads-analytics-profit.service';
import { AdsAnalyticsParentService } from './ads-analytics-parent.service';
import { AdsAnalyticsCohortService } from './ads-analytics-cohort.service';
import { AdsAnalyticsSuggestionsService } from './ads-analytics-suggestions.service';
import { AdsAnalyticsActionsService } from './ads-analytics-actions.service';
import { AdsTokenService } from './ads-token.service';
import { AdsCrudService } from './ads-crud.service';
import { AdsFacebookSyncService } from './ads-facebook-sync.service';
import { AdsCostSyncService } from './ads-cost-sync.service';
import { AdsDataService } from './ads-data.service';
import { GoogleAdsProvider } from './platforms/google-ads.service';
import { TikTokAdsProvider } from './platforms/tiktok-ads.service';
import { AdAccount, AdAccountSchema } from './schemas/ad-account.schema';
import { AdGroup, AdGroupSchema } from './schemas/ad-group.schema';
import { ApiToken, ApiTokenSchema } from './schemas/api-token.schema';
import { AdCost, AdCostSchema } from './schemas/ad-cost.schema';
import { Order, OrderSchema } from '../orders/schemas/order.schema';
import { Invoice, InvoiceSchema } from '../invoices/schemas/invoice.schema';
import { Lead, LeadSchema } from '../leads/schemas/lead.schema';
import { Session, SessionSchema } from '../sessions/schemas/session.schema';
import { Expense, ExpenseSchema } from '../expenses/schemas/expense.schema';
import { Student, StudentSchema } from '../students/schemas/student.schema';
import { Fanpage, FanpageSchema } from '../chatbot/schemas/fanpage.schema';
import { Conversation, ConversationSchema } from '../chatbot/schemas/conversation.schema';
import { LedgerEntry, LedgerEntrySchema } from '../wallets/schemas/ledger-entry.schema';
import { MarketingAttributionModule } from '../marketing-attribution/marketing-attribution.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AdAccount.name, schema: AdAccountSchema },
      { name: AdGroup.name, schema: AdGroupSchema },
      { name: ApiToken.name, schema: ApiTokenSchema },
      { name: AdCost.name, schema: AdCostSchema },
      { name: Order.name, schema: OrderSchema },
      { name: Invoice.name, schema: InvoiceSchema },
      { name: Lead.name, schema: LeadSchema },
      { name: Session.name, schema: SessionSchema },
      { name: Expense.name, schema: ExpenseSchema },
      { name: Student.name, schema: StudentSchema },
      { name: Fanpage.name, schema: FanpageSchema },
      { name: Conversation.name, schema: ConversationSchema },
      { name: LedgerEntry.name, schema: LedgerEntrySchema },
    ]),
    MarketingAttributionModule,
  ],
  controllers: [AdsController],
  providers: [
    AdsService,
    AdsAnalyticsService,
    AdsAnalyticsProfitService,
    AdsAnalyticsParentService,
    AdsAnalyticsCohortService,
    AdsAnalyticsSuggestionsService,
    AdsAnalyticsActionsService,
    AdsTokenService,
    AdsCrudService,
    AdsFacebookSyncService,
    AdsCostSyncService,
    AdsDataService,
    GoogleAdsProvider,
    TikTokAdsProvider,
  ],
  exports: [AdsService, AdsAnalyticsService],
})
export class AdsModule {}
