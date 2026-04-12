import {
  Controller, Get, Post, Param, Query, Req, Res,
  HttpStatus, Logger, OnModuleInit, RawBodyRequest,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ChatbotService } from './chatbot.service';
import { WebhookService } from './webhook.service';
import { CHATBOT_WEBHOOK_QUEUE, WebhookMessageJobData } from './chatbot-webhook.constants';

@Controller('webhooks')
export class WebhookController implements OnModuleInit {
  private readonly logger = new Logger(WebhookController.name);
  private readonly queueReadyTimeoutMs = 5000;

  constructor(
    private readonly chatbotService: ChatbotService,
    private readonly webhookService: WebhookService,
    @InjectQueue(CHATBOT_WEBHOOK_QUEUE) private readonly webhookQueue: Queue,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.tryWarmWebhookQueue('startup', this.queueReadyTimeoutMs);
  }

  // ─── Facebook Webhook Verification ──────────────────────────

  @Get('facebook/:pageId')
  async verifyFacebook(
    @Param('pageId') pageId: string,
    @Query() query: any,
    @Res() res: Response,
  ) {
    const fanpage = await this.chatbotService.findFanpageByPageId(pageId);
    if (!fanpage || !fanpage.webhookVerifyToken) {
      return res.status(HttpStatus.FORBIDDEN).send('Fanpage not found');
    }

    const challenge = this.webhookService.verifyFacebookWebhook(query, fanpage.webhookVerifyToken);
    if (challenge) {
      return res.status(HttpStatus.OK).send(challenge);
    }
    return res.status(HttpStatus.FORBIDDEN).send('Verification failed');
  }

  // ─── Facebook Incoming Messages ─────────────────────────────

  @Post('facebook/:pageId')
  async handleFacebook(
    @Param('pageId') pageId: string,
    @Req() req: RawBodyRequest<Request>,
    @Res() res: Response,
  ) {
    // Respond 200 immediately to prevent Facebook retries
    res.status(HttpStatus.OK).send('EVENT_RECEIVED');

    try {
      const fanpage = await this.chatbotService.findFanpageByPageId(pageId);
      if (!fanpage) {
        this.logger.warn(`Facebook webhook: fanpage not found for pageId ${pageId}`);
        return;
      }

      const signature = req.headers['x-hub-signature-256'] as string;
      if (fanpage.appSecret) {
        if (!signature) {
          this.logger.warn(
            `Facebook webhook: missing signature while appSecret is configured for pageId ${pageId}`,
          );
          return;
        }
        const appSecret = this.chatbotService.getDecryptedAppSecret(fanpage);
        const rawBody = req.rawBody || Buffer.from(JSON.stringify(req.body));
        if (!this.webhookService.verifyFacebookSignature(rawBody, signature, appSecret)) {
          this.logger.warn(`Facebook webhook: signature verification failed for pageId ${pageId}`);
          return;
        }
      }

      // Check Redis availability once for the entire batch of messages.
      const redisReady = await this.isRedisReady();

      const messages = this.webhookService.parseFacebookWebhookPayload(req.body);
      for (const msg of messages) {
        const jobData: WebhookMessageJobData = {
          fanpageId: fanpage._id.toString(),
          platformUserId: msg.senderId,
          messageText: msg.messageText,
          senderName: msg.senderName,
          adRefParam: msg.adRefParam,
          messageId: msg.messageId,
        };
        if (redisReady) {
          await this.webhookQueue.add('process-message', jobData, {
            attempts: 3,
            backoff: { type: 'exponential', delay: 1000 },
            removeOnComplete: true,
            removeOnFail: 100, // keep last 100 failed jobs for inspection
          });
          this.logger.debug(
            `Enqueued Facebook webhook message ${jobData.messageId || 'no-mid'} for fanpage ${fanpage._id}`,
          );
        } else {
          // Redis/BullMQ unavailable — process synchronously
          this.logger.warn(
            `Redis not ready, processing webhook synchronously for fanpage ${fanpage._id}`,
          );
          try {
            await this.chatbotService.handleIncomingCustomerMessage(
              jobData.fanpageId,
              jobData.platformUserId,
              jobData.messageText || '',
              jobData.senderName,
              jobData.adRefParam,
              jobData.messageId,
            );
          } catch (syncErr: any) {
            this.logger.error(
              `Sync fallback failed for fanpage ${fanpage._id}: ${syncErr.message}`,
              syncErr.stack,
            );
          }
        }
      }
    } catch (err: any) {
      this.logger.error(`Facebook webhook error: ${err.message}`, err.stack);
    }
  }

  // ─── TikTok Incoming Messages ───────────────────────────────

  @Post('tiktok/:pageId')
  async handleTikTok(
    @Param('pageId') pageId: string,
    @Req() req: RawBodyRequest<Request>,
    @Res() res: Response,
  ) {
    res.status(HttpStatus.OK).send('OK');

    try {
      const fanpage = await this.chatbotService.findFanpageByPageId(pageId);
      if (!fanpage) {
        this.logger.warn(`TikTok webhook: fanpage not found for pageId ${pageId}`);
        return;
      }

      const signature = (req.headers['tiktok-signature'] || req.headers['x-tiktok-signature']) as string;
      if (fanpage.appSecret) {
        if (!signature) {
          this.logger.warn(
            `TikTok webhook: missing signature while appSecret is configured for pageId ${pageId}`,
          );
          return;
        }
        const appSecret = this.chatbotService.getDecryptedAppSecret(fanpage);
        const rawBody = req.rawBody || Buffer.from(JSON.stringify(req.body));
        if (!this.webhookService.verifyTikTokSignature(rawBody, signature, appSecret)) {
          this.logger.warn(`TikTok webhook: signature verification failed for pageId ${pageId}`);
          return;
        }
      }

      const redisReady = await this.isRedisReady();

      const messages = this.webhookService.parseTikTokWebhookPayload(req.body);
      for (const msg of messages) {
        const jobData: WebhookMessageJobData = {
          fanpageId: fanpage._id.toString(),
          platformUserId: msg.senderId,
          messageText: msg.messageText,
          senderName: msg.senderName,
          adRefParam: msg.adRefParam,
          messageId: msg.messageId,
        };
        if (redisReady) {
          await this.webhookQueue.add('process-message', jobData, {
            attempts: 3,
            backoff: { type: 'exponential', delay: 1000 },
            removeOnComplete: true,
            removeOnFail: 100,
          });
          this.logger.debug(
            `Enqueued TikTok webhook message ${jobData.messageId || 'no-mid'} for fanpage ${fanpage._id}`,
          );
        } else {
          this.logger.warn(
            `Redis not ready, processing TikTok webhook synchronously for fanpage ${fanpage._id}`,
          );
          try {
            await this.chatbotService.handleIncomingCustomerMessage(
              jobData.fanpageId,
              jobData.platformUserId,
              jobData.messageText || '',
              jobData.senderName,
              jobData.adRefParam,
              jobData.messageId,
            );
          } catch (syncErr: any) {
            this.logger.error(
              `TikTok sync fallback failed for fanpage ${fanpage._id}: ${syncErr.message}`,
              syncErr.stack,
            );
          }
        }
      }
    } catch (err: any) {
      this.logger.error(`TikTok webhook error: ${err.message}`, err.stack);
    }
  }

  // ─── Helpers ─────────────────────────────────────────────────

  private async tryWarmWebhookQueue(reason: string, timeoutMs: number): Promise<boolean> {
    try {
      const client = await Promise.race([
        this.webhookQueue.waitUntilReady(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Redis check timeout')), timeoutMs),
        ),
      ]);
      const ready = client?.status === 'ready';
      if (ready) {
        this.logger.debug(`Chatbot webhook queue ready via ${reason}`);
      }
      return ready;
    } catch (err: any) {
      if (reason === 'startup') {
        this.logger.warn(`Chatbot webhook queue warmup failed: ${err.message}`);
      }
      return false;
    }
  }

  /** Returns true only when the BullMQ underlying Redis client is in 'ready' state.
   *  Uses a short race timeout so we never hang waiting for a Redis connection that
   *  may never arrive (e.g., Redis is not running).
   */
  private async isRedisReady(): Promise<boolean> {
    return this.tryWarmWebhookQueue('request', 2000);
  }
}
