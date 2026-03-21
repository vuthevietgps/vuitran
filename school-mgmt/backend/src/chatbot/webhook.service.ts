import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';

export interface ParsedWebhookMessage {
  pageId: string;
  senderId: string;
  senderName?: string;
  messageText: string;
  messageId?: string;
  adRefParam?: string;
}

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  private safeCompare(left: string, right: string): boolean {
    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);
    if (leftBuffer.length !== rightBuffer.length) return false;
    return crypto.timingSafeEqual(leftBuffer, rightBuffer);
  }

  private extractFacebookAdRef(event: any): string | undefined {
    const candidates = [
      event?.referral?.ref,
      event?.referral?.ad_id,
      event?.referral?.ads_context_data?.ad_id,
      event?.postback?.referral?.ref,
      event?.postback?.referral?.ad_id,
      event?.postback?.referral?.ads_context_data?.ad_id,
      event?.postback?.payload,
    ];

    for (const candidate of candidates) {
      const value = String(candidate || '').trim();
      if (value) return value;
    }

    return undefined;
  }

  // ─── Facebook ───────────────────────────────────────────────

  verifyFacebookWebhook(
    query: { 'hub.mode'?: string; 'hub.verify_token'?: string; 'hub.challenge'?: string },
    expectedVerifyToken: string,
  ): string | null {
    const mode = query['hub.mode'];
    const token = query['hub.verify_token'];
    const challenge = query['hub.challenge'];

    if (mode === 'subscribe' && token === expectedVerifyToken) {
      this.logger.log('Facebook webhook verified successfully');
      return challenge || null;
    }

    this.logger.warn('Facebook webhook verification failed');
    return null;
  }

  verifyFacebookSignature(rawBody: Buffer, signature: string, appSecret: string): boolean {
    if (!signature || !appSecret) return false;
    const expectedSig = 'sha256=' + crypto
      .createHmac('sha256', appSecret)
      .update(rawBody)
      .digest('hex');
    return this.safeCompare(signature, expectedSig);
  }

  parseFacebookWebhookPayload(body: any): ParsedWebhookMessage[] {
    const messages: ParsedWebhookMessage[] = [];

    if (body.object !== 'page') return messages;

    for (const entry of body.entry || []) {
      const pageId = entry.id;
      for (const event of entry.messaging || []) {
        const messageText = String(
          event.message?.text
          || event.postback?.title
          || event.postback?.payload
          || '',
        ).trim();
        const adRefParam = this.extractFacebookAdRef(event);
        if (!messageText && !adRefParam) continue;

        messages.push({
          pageId,
          senderId: event.sender?.id,
          senderName: event.sender?.name,
          messageText,
          messageId: event.message?.mid || event.postback?.mid,
          adRefParam,
        });
      }
    }

    return messages;
  }

  // ─── TikTok ─────────────────────────────────────────────────

  verifyTikTokSignature(rawBody: Buffer, signature: string, appSecret: string): boolean {
    if (!signature || !appSecret) return false;
    const signatureParts = String(signature)
      .split(',')
      .map((segment) => segment.trim())
      .filter(Boolean);
    const signatureMap = new Map<string, string>();
    for (const part of signatureParts) {
      const [key, ...rest] = part.split('=');
      const value = rest.join('=').trim();
      if (key && value) {
        signatureMap.set(key.trim().toLowerCase(), value);
      }
    }

    const timestamp = signatureMap.get('t') || signatureMap.get('timestamp');
    const receivedSignature = signatureMap.get('s') || signatureMap.get('signature') || signatureMap.get('v1');
    if (!timestamp || !receivedSignature) return false;

    const timestampValue = Number(timestamp);
    if (!Number.isFinite(timestampValue)) return false;

    const driftSeconds = Math.abs(Math.floor(Date.now() / 1000) - timestampValue);
    if (driftSeconds > 300) {
      this.logger.warn(`TikTok webhook rejected because timestamp drift is ${driftSeconds}s`);
      return false;
    }

    const expectedSig = crypto
      .createHmac('sha256', appSecret)
      .update(`${timestamp}.${rawBody.toString('utf8')}`)
      .digest('hex');
    return this.safeCompare(receivedSignature, expectedSig);
  }

  parseTikTokWebhookPayload(body: any): ParsedWebhookMessage[] {
    const messages: ParsedWebhookMessage[] = [];

    const events = body.data || [];
    for (const event of events) {
      if (event.event !== 'receive_message') continue;
      const content = event.content;
      const messageText = String(content?.text || '').trim();
      const adRefParam = String(event.ad_id || content?.ad_id || '').trim() || undefined;
      if (!messageText && !adRefParam) continue;

      messages.push({
        pageId: event.to_user_id || body.page_id || '',
        senderId: event.from_user_id || '',
        messageText,
        messageId: event.message_id,
        adRefParam,
      });
    }

    return messages;
  }
}
