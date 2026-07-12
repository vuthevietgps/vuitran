import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DashboardModule } from '../dashboard/dashboard.module';
import { FinancialControlModule } from '../financial-control/financial-control.module';
import { PendingApprovalsModule } from '../pending-approvals/pending-approvals.module';
import { ChatbotModule } from '../chatbot/chatbot.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { AdsModule } from '../ads/ads.module';
import { AiCoreModule } from '../ai-core/ai-core.module';
import { DirectorAiController } from './director-ai.controller';
import { DirectorAiService } from './director-ai.service';
import {
  DirectorAiSession,
  DirectorAiSessionSchema,
} from './schemas/director-ai-session.schema';
import {
  DirectorAiMessage,
  DirectorAiMessageSchema,
} from './schemas/director-ai-message.schema';

@Module({
  imports: [
    DashboardModule,
    FinancialControlModule,
    PendingApprovalsModule,
    ChatbotModule,
    AuditLogModule,
    AdsModule,
    AiCoreModule,
    MongooseModule.forFeature([
      { name: DirectorAiSession.name, schema: DirectorAiSessionSchema },
      { name: DirectorAiMessage.name, schema: DirectorAiMessageSchema },
    ]),
  ],
  controllers: [DirectorAiController],
  providers: [DirectorAiService],
})
export class DirectorAiModule {}
