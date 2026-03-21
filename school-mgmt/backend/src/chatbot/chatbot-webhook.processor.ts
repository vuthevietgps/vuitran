import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { ChatbotService } from './chatbot.service';
import { CHATBOT_WEBHOOK_QUEUE, WebhookMessageJobData } from './chatbot-webhook.constants';

@Processor(CHATBOT_WEBHOOK_QUEUE)
export class ChatbotWebhookProcessor extends WorkerHost {
  private readonly logger = new Logger(ChatbotWebhookProcessor.name);

  constructor(private readonly chatbotService: ChatbotService) {
    super();
  }

  async process(job: Job<WebhookMessageJobData>): Promise<void> {
    const { fanpageId, platformUserId, messageText, senderName, adRefParam, messageId } = job.data;
    this.logger.debug(`Processing webhook job ${job.id} for fanpage ${fanpageId}`);

    await this.chatbotService.handleIncomingCustomerMessage(
      fanpageId,
      platformUserId,
      messageText,
      senderName,
      adRefParam,
      messageId,
    );
  }
}
