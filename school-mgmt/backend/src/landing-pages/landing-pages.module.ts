import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AdGroup, AdGroupSchema } from '../ads/schemas/ad-group.schema';
import { Lead, LeadSchema } from '../leads/schemas/lead.schema';
import { MarketingAttributionModule } from '../marketing-attribution/marketing-attribution.module';
import { Student, StudentSchema } from '../students/schemas/student.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Wallet, WalletSchema } from '../wallets/schemas/wallet.schema';
import { LandingPagesController, PublicLandingPagesController } from './landing-pages.controller';
import { LandingPagesService } from './landing-pages.service';
import { LandingPage, LandingPageSchema } from './schemas/landing-page.schema';
import {
  LandingPageSubmission,
  LandingPageSubmissionSchema,
} from './schemas/landing-page-submission.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: LandingPage.name, schema: LandingPageSchema },
      { name: LandingPageSubmission.name, schema: LandingPageSubmissionSchema },
      { name: Lead.name, schema: LeadSchema },
      { name: User.name, schema: UserSchema },
      { name: Student.name, schema: StudentSchema },
      { name: Wallet.name, schema: WalletSchema },
      { name: AdGroup.name, schema: AdGroupSchema },
    ]),
    MarketingAttributionModule,
  ],
  controllers: [LandingPagesController, PublicLandingPagesController],
  providers: [LandingPagesService],
  exports: [LandingPagesService],
})
export class LandingPagesModule {}
