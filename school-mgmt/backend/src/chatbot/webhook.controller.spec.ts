import { HttpStatus } from '@nestjs/common';
import { WebhookController } from './webhook.controller';

describe('WebhookController', () => {
  const chatbotService = {
    findFanpageByPageId: jest.fn(),
    getDecryptedAppSecret: jest.fn(),
    handleIncomingCustomerMessage: jest.fn(),
  };

  const webhookService = {
    verifyFacebookWebhook: jest.fn(),
    verifyFacebookSignature: jest.fn(),
    parseFacebookWebhookPayload: jest.fn(),
    verifyTikTokSignature: jest.fn(),
    parseTikTokWebhookPayload: jest.fn(),
  };

  const webhookQueue: any = {
    add: jest.fn().mockResolvedValue({}),
    waitUntilReady: jest.fn().mockResolvedValue({ status: 'ready' }),
  };

  let controller: WebhookController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new WebhookController(chatbotService as any, webhookService as any, webhookQueue as any);
  });

  it('does not process Facebook message when appSecret is set but signature is missing', async () => {
    chatbotService.findFanpageByPageId.mockResolvedValue({
      _id: { toString: () => 'fanpage-1' },
      appSecret: 'encrypted-secret',
    });
    webhookService.parseFacebookWebhookPayload.mockReturnValue([
      {
        senderId: 'sender-1',
        messageText: 'hello',
        senderName: 'User 1',
        adRefParam: '',
        messageId: 'msg-1',
      },
    ]);

    const req: any = {
      headers: {},
      body: {},
      rawBody: Buffer.from('{}'),
    };
    const status = jest.fn().mockReturnThis();
    const send = jest.fn().mockReturnThis();
    const res: any = { status, send };

    await controller.handleFacebook('page-1', req, res);

    expect(status).toHaveBeenCalledWith(HttpStatus.OK);
    expect(send).toHaveBeenCalledWith('EVENT_RECEIVED');
    expect(webhookService.parseFacebookWebhookPayload).not.toHaveBeenCalled();
    expect(webhookQueue.add).not.toHaveBeenCalled();
  });

  it('enqueues a job when Facebook signature is present and valid', async () => {
    chatbotService.findFanpageByPageId.mockResolvedValue({
      _id: { toString: () => 'fanpage-2' },
      appSecret: 'encrypted-secret',
    });
    chatbotService.getDecryptedAppSecret.mockReturnValue('plain-secret');
    webhookService.verifyFacebookSignature.mockReturnValue(true);
    webhookService.parseFacebookWebhookPayload.mockReturnValue([
      {
        senderId: 'sender-2',
        messageText: 'ping',
        senderName: 'User 2',
        adRefParam: 'ad-1',
        messageId: 'msg-2',
      },
    ]);

    const req: any = {
      headers: { 'x-hub-signature-256': 'sha256=dummy' },
      body: { object: 'page' },
      rawBody: Buffer.from('{"object":"page"}'),
    };
    const status = jest.fn().mockReturnThis();
    const send = jest.fn().mockReturnThis();
    const res: any = { status, send };

    await controller.handleFacebook('page-2', req, res);

    expect(webhookService.verifyFacebookSignature).toHaveBeenCalled();
    expect(webhookService.parseFacebookWebhookPayload).toHaveBeenCalled();
    expect(webhookQueue.add).toHaveBeenCalledTimes(1);
    expect(webhookQueue.add).toHaveBeenCalledWith(
      'process-message',
      expect.objectContaining({ fanpageId: 'fanpage-2', platformUserId: 'sender-2' }),
      expect.any(Object),
    );
  });

  it('does not process TikTok message when appSecret is set but signature is missing', async () => {
    chatbotService.findFanpageByPageId.mockResolvedValue({
      _id: { toString: () => 'fanpage-3' },
      appSecret: 'encrypted-secret',
    });

    const req: any = {
      headers: {},
      body: {},
      rawBody: Buffer.from('{}'),
    };
    const status = jest.fn().mockReturnThis();
    const send = jest.fn().mockReturnThis();
    const res: any = { status, send };

    await controller.handleTikTok('page-3', req, res);

    expect(status).toHaveBeenCalledWith(HttpStatus.OK);
    expect(send).toHaveBeenCalledWith('OK');
    expect(webhookService.parseTikTokWebhookPayload).not.toHaveBeenCalled();
    expect(webhookQueue.add).not.toHaveBeenCalled();
  });

  it('enqueues a job when TikTok signature is present and valid', async () => {
    chatbotService.findFanpageByPageId.mockResolvedValue({
      _id: { toString: () => 'fanpage-4' },
      appSecret: 'encrypted-secret',
    });
    chatbotService.getDecryptedAppSecret.mockReturnValue('plain-secret');
    webhookService.verifyTikTokSignature.mockReturnValue(true);
    webhookService.parseTikTokWebhookPayload.mockReturnValue([
      {
        senderId: 'sender-4',
        messageText: '',
        senderName: 'User 4',
        adRefParam: 'tt-ad-99',
        messageId: 'msg-4',
      },
    ]);

    const req: any = {
      headers: { 'tiktok-signature': 't=1710000000,s=dummy' },
      body: { data: [] },
      rawBody: Buffer.from('{"data":[]}'),
    };
    const status = jest.fn().mockReturnThis();
    const send = jest.fn().mockReturnThis();
    const res: any = { status, send };

    await controller.handleTikTok('page-4', req, res);

    expect(webhookService.verifyTikTokSignature).toHaveBeenCalled();
    expect(webhookService.parseTikTokWebhookPayload).toHaveBeenCalled();
    expect(webhookQueue.add).toHaveBeenCalledTimes(1);
    expect(webhookQueue.add).toHaveBeenCalledWith(
      'process-message',
      expect.objectContaining({ fanpageId: 'fanpage-4', platformUserId: 'sender-4' }),
      expect.any(Object),
    );
  });

  it('falls back to synchronous Facebook processing when Redis is not ready', async () => {
    chatbotService.findFanpageByPageId.mockResolvedValue({
      _id: { toString: () => 'fanpage-5' },
      appSecret: '',
    });
    webhookQueue.waitUntilReady.mockResolvedValueOnce({ status: 'connecting' });
    webhookService.parseFacebookWebhookPayload.mockReturnValue([
      {
        senderId: 'sender-5',
        messageText: 'hello',
        senderName: 'User 5',
        adRefParam: '',
        messageId: 'msg-5',
      },
    ]);

    const req: any = {
      headers: {},
      body: { entry: [] },
      rawBody: Buffer.from('{}'),
    };
    const status = jest.fn().mockReturnThis();
    const send = jest.fn().mockReturnThis();
    const res: any = { status, send };

    await controller.handleFacebook('page-5', req, res);

    expect(webhookQueue.add).not.toHaveBeenCalled();
    expect(chatbotService.handleIncomingCustomerMessage).toHaveBeenCalledWith(
      'fanpage-5',
      'sender-5',
      'hello',
      'User 5',
      '',
      'msg-5',
    );
  });
});

