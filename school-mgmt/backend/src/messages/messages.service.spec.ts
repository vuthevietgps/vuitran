import { Types } from 'mongoose';
import { MessagesService } from './messages.service';
import { ConversationKind } from './schemas/conversation.schema';
import { Role } from '../common/interfaces/role.enum';
import { UserStatus } from '../common/interfaces/user-status.enum';

describe('MessagesService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  function buildService() {
    const service = Object.create(MessagesService.prototype) as any;
    service.conversationModel = {
      findOne: jest.fn(),
      create: jest.fn(),
    };
    return service;
  }

  it('creates a direct conversation when no matching thread exists', async () => {
    const service = buildService();
    const parentId = new Types.ObjectId().toHexString();
    const staffId = new Types.ObjectId().toHexString();
    const convo = {
      _id: 'conversation-1',
      participants: [parentId, staffId],
      conversationKind: 'DIRECT',
      topicStudentName: undefined,
      save: jest.fn(),
    };
    service.conversationModel.findOne.mockResolvedValue(null);
    service.conversationModel.create.mockResolvedValue(convo);

    await expect(
      service.getOrCreateConversation(parentId, staffId),
    ).resolves.toBe(convo);

    expect(service.conversationModel.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        participants: { $all: expect.any(Array), $size: 2 },
        $or: [
          { conversationKind: 'DIRECT' },
          { conversationKind: { $exists: false } },
        ],
        topicStudentId: { $exists: false },
      }),
    );
    expect(service.conversationModel.create).toHaveBeenCalledWith({
      participants: [expect.anything(), expect.anything()],
      conversationKind: 'DIRECT',
      topicStudentId: undefined,
      topicStudentName: undefined,
    });
  });

  it('reuses an existing conversation and fills the missing topic student name', async () => {
    const service = buildService();
    const parentId = new Types.ObjectId().toHexString();
    const staffId = new Types.ObjectId().toHexString();
    const convo = {
      _id: 'conversation-2',
      participants: [parentId, staffId],
      conversationKind: 'PARENT_SUPPORT',
      topicStudentName: '',
      save: jest.fn().mockResolvedValue(undefined),
    };
    service.conversationModel.findOne.mockResolvedValue(convo);

    const result = await service.getOrCreateConversation(parentId, staffId, {
      conversationKind: 'PARENT_SUPPORT',
      topicStudentName: 'Hoc sinh A',
    });

    expect(result).toBe(convo);
    expect(convo.topicStudentName).toBe('Hoc sinh A');
    expect(convo.save).toHaveBeenCalledTimes(1);
  });

  it('does not auto-reply when a parent-support message is sent', async () => {
    const service = Object.create(MessagesService.prototype) as any;
    const senderId = new Types.ObjectId().toHexString();
    const receiverId = new Types.ObjectId().toHexString();
    const convoId = new Types.ObjectId();
    const convo = {
      _id: convoId,
      conversationKind: ConversationKind.PARENT_SUPPORT,
      participants: [new Types.ObjectId(senderId), new Types.ObjectId(receiverId)],
    };
    const createdMessage = { _id: 'message-1', content: 'Xin cap nhat giup tien do hoc tap.' };

    service.resolveConversationAccess = jest.fn().mockResolvedValue({
      conversationKind: ConversationKind.PARENT_SUPPORT,
    });
    service.getOrCreateConversation = jest.fn().mockResolvedValue(convo);
    service.messageModel = {
      create: jest.fn().mockResolvedValue(createdMessage),
    };
    service.updateConversationLastMessage = jest.fn().mockResolvedValue(undefined);
    service.aiHelper = {
      maybeAutoReplyToParentSupport: jest.fn(),
    };

    const result = await service.sendMessage(
      senderId,
      receiverId,
      'Xin cap nhat giup tien do hoc tap.',
    );

    expect(result).toBe(createdMessage);
    expect(service.updateConversationLastMessage).toHaveBeenCalledWith(
      convoId,
      'Xin cap nhat giup tien do hoc tap.',
      senderId,
    );
    expect(service.aiHelper.maybeAutoReplyToParentSupport).not.toHaveBeenCalled();
  });

  it('returns an AI suggestion preview without persisting a message', async () => {
    const service = Object.create(MessagesService.prototype) as any;
    const opsId = new Types.ObjectId().toHexString();
    const parentId = new Types.ObjectId().toHexString();
    const convoId = new Types.ObjectId().toHexString();
    const convo = {
      _id: new Types.ObjectId(convoId),
      conversationKind: ConversationKind.PARENT_SUPPORT,
      participants: [new Types.ObjectId(parentId), new Types.ObjectId(opsId)],
    };
    const userRows = [
      {
        _id: new Types.ObjectId(parentId),
        fullName: 'Nguyen Parent',
        role: Role.PARENT,
        status: UserStatus.ACTIVE,
      },
    ];
    const findQuery = {
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue(userRows),
    };

    service.findActiveUserOrThrow = jest.fn().mockResolvedValue({
      _id: new Types.ObjectId(opsId),
      fullName: 'Ops Demo',
      role: Role.OPS,
      status: UserStatus.ACTIVE,
    });
    service.assertConversationParticipant = jest.fn().mockResolvedValue({ convo, isParticipant: true });
    service.userModel = {
      find: jest.fn().mockReturnValue(findQuery),
    };
    service.aiHelper = {
      generateParentSupportAIReply: jest.fn().mockResolvedValue('Goi y AI: Minh Anh da hoan thanh bai tap tuan nay.'),
    };
    service.messageModel = {
      create: jest.fn(),
    };

    const result = await service.previewAiSuggestion(opsId, convoId);

    expect(result).toEqual({
      content: 'Goi y AI: Minh Anh da hoan thanh bai tap tuan nay.',
      conversationId: convoId,
      previewOnly: true,
    });
    expect(service.aiHelper.generateParentSupportAIReply).toHaveBeenCalledWith(convo, userRows[0]);
    expect(service.messageModel.create).not.toHaveBeenCalled();
  });
});
