import { Types } from 'mongoose';
import { ChatbotMessagingService } from './chatbot-messaging.service';
import { ConversationStatus } from './schemas/conversation.schema';
import { FanpagePlatform } from './schemas/fanpage.schema';

describe('ChatbotMessagingService', () => {
  function buildService() {
    const service = Object.create(ChatbotMessagingService.prototype) as any;
    service.logger = { warn: jest.fn(), error: jest.fn() };
    service.messageModel = {
      exists: jest.fn(),
      findOne: jest.fn(),
    };
    service.fanpageModel = {
      findById: jest.fn(),
    };
    service.conversationModel = {
      findById: jest.fn(),
      updateOne: jest.fn(),
    };
    service.chatbotGateway = {
      emitConversationUpdated: jest.fn(),
      emitNewMessage: jest.fn(),
    };
    return service;
  }

  it('returns an existing platform message instead of creating a duplicate', async () => {
    const service = buildService();
    const existing = { _id: new Types.ObjectId(), platformMessageId: 'platform-msg-1' };
    service.messageModel.findOne.mockResolvedValue(existing);

    const result = await service.saveMessage(
      new Types.ObjectId(),
      'Xin chao',
      'CUSTOMER',
      'Parent',
      undefined,
      'platform-msg-1',
    );

    expect(result).toBe(existing);
    expect(service.conversationModel.updateOne).not.toHaveBeenCalled();
  });

  it('does not save or auto-reply again for duplicate webhook platform messages', async () => {
    const service = buildService();
    const fanpageId = new Types.ObjectId().toHexString();
    const conversationId = new Types.ObjectId();
    const fanpage = {
      _id: new Types.ObjectId(fanpageId),
      name: 'Fanpage',
      platform: FanpagePlatform.FACEBOOK,
      aiAutoReplyEnabled: true,
    };
    const conversation = {
      _id: conversationId,
      conversationCode: 'CONV-1',
      status: ConversationStatus.AI_HANDLING,
      customerName: 'Parent',
    };

    service.fanpageModel.findById.mockResolvedValue(fanpage);
    service.findOrCreateConversation = jest.fn().mockResolvedValue(conversation);
    service.messageModel.exists.mockResolvedValue({ _id: new Types.ObjectId() });
    service.saveMessage = jest.fn();
    service.generateAIReply = jest.fn();
    service.conversationModel.findById.mockReturnValue({
      lean: jest.fn().mockResolvedValue(conversation),
    });

    await service.handleIncomingCustomerMessage(
      fanpageId,
      'platform-user-1',
      'Tin nhan retry',
      'Parent',
      undefined,
      'platform-msg-1',
    );

    expect(service.saveMessage).not.toHaveBeenCalled();
    expect(service.generateAIReply).not.toHaveBeenCalled();
    expect(service.chatbotGateway.emitConversationUpdated).toHaveBeenCalledWith(conversation);
  });
});
