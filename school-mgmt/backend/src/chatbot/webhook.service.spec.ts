import * as crypto from 'crypto';
import { WebhookService } from './webhook.service';

describe('WebhookService', () => {
  let service: WebhookService;

  beforeEach(() => {
    service = new WebhookService();
  });

  it('accepts TikTok timestamped signatures that follow the current HMAC format', () => {
    const rawBody = Buffer.from('{"data":[{"event":"receive_message"}]}');
    const secret = 'test-secret';
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = crypto
      .createHmac('sha256', secret)
      .update(`${timestamp}.${rawBody.toString('utf8')}`)
      .digest('hex');

    expect(service.verifyTikTokSignature(rawBody, `t=${timestamp},s=${signature}`, secret)).toBe(true);
  });

  it('parses Facebook referral events even when there is no text message yet', () => {
    const messages = service.parseFacebookWebhookPayload({
      object: 'page',
      entry: [
        {
          id: 'page-1',
          messaging: [
            {
              sender: { id: 'user-1' },
              referral: { ad_id: 'fb-ad-123' },
            },
          ],
        },
      ],
    });

    expect(messages).toEqual([
      {
        pageId: 'page-1',
        senderId: 'user-1',
        senderName: undefined,
        messageText: '',
        messageId: undefined,
        adRefParam: 'fb-ad-123',
      },
    ]);
  });

  it('parses TikTok receive_message events that only carry ad attribution', () => {
    const messages = service.parseTikTokWebhookPayload({
      data: [
        {
          event: 'receive_message',
          from_user_id: 'tt-user',
          to_user_id: 'tt-page',
          message_id: 'msg-1',
          ad_id: 'tt-ad-123',
          content: {},
        },
      ],
    });

    expect(messages).toEqual([
      {
        pageId: 'tt-page',
        senderId: 'tt-user',
        messageText: '',
        messageId: 'msg-1',
        adRefParam: 'tt-ad-123',
      },
    ]);
  });
});
