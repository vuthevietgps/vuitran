import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BullModule, getQueueToken } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ChatbotController } from './chatbot.controller';
import { WebhookController } from './webhook.controller';
import { ChatbotService } from './chatbot.service';
import { ChatbotConfigService } from './chatbot-config.service';
import { ChatbotMessagingService } from './chatbot-messaging.service';
import { WebhookService } from './webhook.service';
import { ChatbotGateway } from './chatbot.gateway';
import { ChatbotWebhookProcessor } from './chatbot-webhook.processor';
import { CHATBOT_WEBHOOK_QUEUE } from './chatbot-webhook.constants';
import { Fanpage, FanpageSchema } from './schemas/fanpage.schema';
import { OpenAIToken, OpenAITokenSchema } from './schemas/openai-token.schema';
import {
  AiAssistantProfile,
  AiAssistantProfileSchema,
} from './schemas/ai-assistant-profile.schema';
import { Conversation, ConversationSchema } from './schemas/conversation.schema';
import { Message, MessageSchema } from './schemas/message.schema';
import { AdGroup, AdGroupSchema } from '../ads/schemas/ad-group.schema';
import { Lead, LeadSchema } from '../leads/schemas/lead.schema';
import { Order, OrderSchema } from '../orders/schemas/order.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { MarketingAttributionModule } from '../marketing-attribution/marketing-attribution.module';

const redisEnabled = (process.env.REDIS_ENABLED ?? 'true').toLowerCase() !== 'false';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Fanpage.name, schema: FanpageSchema },
      { name: OpenAIToken.name, schema: OpenAITokenSchema },
      { name: AiAssistantProfile.name, schema: AiAssistantProfileSchema },
      { name: Conversation.name, schema: ConversationSchema },
      { name: Message.name, schema: MessageSchema },
      { name: AdGroup.name, schema: AdGroupSchema },
      { name: Lead.name, schema: LeadSchema },
      { name: Order.name, schema: OrderSchema },
      { name: User.name, schema: UserSchema },
    ]),
    ...(redisEnabled
      ? [
          BullModule.registerQueueAsync({
            name: CHATBOT_WEBHOOK_QUEUE,
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (config: ConfigService) => ({
              connection: {
                host: config.get<string>('REDIS_HOST', 'localhost'),
                port: config.get<number>('REDIS_PORT', 6379),
                ...(config.get<string>('REDIS_PASSWORD')
                  ? { password: config.get<string>('REDIS_PASSWORD') }
                  : {}),
                enableOfflineQueue: false,
                lazyConnect: true,
                connectTimeout: 3000,
                maxRetriesPerRequest: 0,
                retryStrategy: () => null,
              },
            }),
          }),
        ]
      : []),
    AuditLogModule,
    MarketingAttributionModule,
  ],
  controllers: [ChatbotController, WebhookController],
  providers: [
    ChatbotService,
    ChatbotConfigService,
    ChatbotMessagingService,
    WebhookService,
    ChatbotGateway,
    ...(redisEnabled
      ? [ChatbotWebhookProcessor]
      : [
          {
            provide: getQueueToken(CHATBOT_WEBHOOK_QUEUE),
            useValue: {
              client: new Promise(() => undefined),
              add: async () => {
                throw new Error('Redis queue is disabled');
              },
            },
          },
        ]),
  ],
  exports: [ChatbotService, ChatbotGateway],
})
export class ChatbotModule {}
