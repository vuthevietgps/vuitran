import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import * as crypto from 'crypto';
import { Model, Types } from 'mongoose';
import {
  MessageDocument,
  MessageSenderType,
} from './schemas/message.schema';
import {
  ConversationDocument,
  ConversationKind,
} from './schemas/conversation.schema';
import {
  DIRECT_CONVERSATION_MODEL,
  DIRECT_MESSAGE_MODEL,
} from './messages.constants';
import { User, UserDocument } from '../users/schemas/user.schema';
import { Student, StudentDocument } from '../students/schemas/student.schema';
import {
  AiAssistantProfile,
  AiAssistantProfileDocument,
} from '../chatbot/schemas/ai-assistant-profile.schema';
import {
  OpenAIToken,
  OpenAITokenDocument,
} from '../chatbot/schemas/openai-token.schema';
import { TicketsService } from '../tickets/tickets.service';
import { Role } from '../common/interfaces/role.enum';
import { UserStatus } from '../common/interfaces/user-status.enum';
import { StudentSupportSnapshotService } from './student-support-snapshot.service';
import { ParentSupportAiHelper } from './parent-support-ai.helper';
import {
  ActiveUserLean,
  ConversationAccess,
  ConversationPermission,
  ParentStudentLean,
  UnreadCountRow,
} from './messages.types';

const PARENT_SUPPORT_ROLES = [Role.DIRECTOR, Role.OPS, Role.SALE];

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);
  private encryptionKey: Buffer | null = null;
  private readonly aiHelper: ParentSupportAiHelper;

  constructor(
    @InjectModel(DIRECT_MESSAGE_MODEL) private readonly messageModel: Model<MessageDocument>,
    @InjectModel(DIRECT_CONVERSATION_MODEL)
    private readonly conversationModel: Model<ConversationDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Student.name) private readonly studentModel: Model<StudentDocument>,
    @InjectModel(AiAssistantProfile.name)
    private readonly aiAssistantProfileModel: Model<AiAssistantProfileDocument>,
    @InjectModel(OpenAIToken.name)
    private readonly openaiTokenModel: Model<OpenAITokenDocument>,
    private readonly configService: ConfigService,
    private readonly ticketsService: TicketsService,
    private readonly studentSupportSnapshotService: StudentSupportSnapshotService,
  ) {
    const key = this.configService.get<string>('TOKEN_ENCRYPTION_KEY');
    if (key) {
      try {
        this.encryptionKey = Buffer.from(key, 'hex');
      } catch {
        this.logger.warn('TOKEN_ENCRYPTION_KEY is not valid hex; OpenAI tokens may fail to decrypt');
      }
    }

    this.aiHelper = new ParentSupportAiHelper(
      this.messageModel,
      this.conversationModel,
      this.aiAssistantProfileModel,
      this.openaiTokenModel,
      this.configService,
      this.ticketsService,
      this.studentSupportSnapshotService,
      (cipherText) => this.decrypt(cipherText),
      (value, limit) => this.clipText(value, limit),
    );
  }

  private decrypt(cipherText: string): string {
    if (!this.encryptionKey) return cipherText;
    const parts = cipherText.split(':');
    if (parts.length !== 3) return cipherText;

    const [ivHex, authTagHex, encrypted] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', this.encryptionKey, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  private clipText(value?: string | null, limit = 180): string {
    const normalized = value?.trim();
    if (!normalized) return '';
    if (normalized.length <= limit) return normalized;
    return `${normalized.slice(0, limit - 3)}...`;
  }

  private normalizeMessageForResponse(message: any) {
    const senderType = message.senderType || MessageSenderType.USER;
    const handoffTicketId = message.handoffTicketId?.toString?.()
      || message.handoffTicketId?._id?.toString?.()
      || '';
    const handoffTicketCode = message.handoffTicketCode || '';

    if (senderType === MessageSenderType.AI) {
      return {
        ...message,
        senderType,
        handoffTicketId,
        handoffTicketCode,
        senderId: {
          _id: 'AI',
          fullName: message.senderLabel || 'Tro ly AI',
          role: 'AI',
        },
      };
    }

    if (message.senderId && typeof message.senderId === 'object') {
      return {
        ...message,
        senderType,
        handoffTicketId,
        handoffTicketCode,
        senderId: {
          _id: message.senderId._id?.toString?.() || String(message.senderId._id || ''),
          fullName: message.senderId.fullName || message.senderLabel || 'Nguoi dung',
          role: message.senderId.role || '',
        },
      };
    }

    return {
      ...message,
      senderType,
      handoffTicketId,
      handoffTicketCode,
      senderId: {
        _id: message.senderId?.toString?.() || '',
        fullName: message.senderLabel || 'Nguoi dung',
        role: '',
      },
    };
  }

  private async getUnreadCountMap(
    conversationIds: Types.ObjectId[],
    uid: Types.ObjectId,
  ): Promise<Map<string, number>> {
    if (!conversationIds.length) {
      return new Map();
    }

    const rows = await this.messageModel.aggregate<UnreadCountRow>([
      {
        $match: {
          conversationId: { $in: conversationIds },
          senderId: { $ne: uid },
          readAt: null,
        },
      },
      {
        $group: {
          _id: '$conversationId',
          count: { $sum: 1 },
        },
      },
    ]);

    return new Map(
      rows.map((row) => [row._id.toString(), row.count]),
    );
  }

  private async findActiveUserOrThrow(userId: string): Promise<ActiveUserLean> {
    const user = await this.userModel
      .findById(userId)
      .select('_id fullName role status')
      .lean<ActiveUserLean | null>();

    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  private async findParentStudentOrThrow(
    parentUserId: string,
    studentId: string,
  ): Promise<ParentStudentLean> {
    const student = await this.studentModel
      .findOne({
        _id: new Types.ObjectId(studentId),
        parentUserId: new Types.ObjectId(parentUserId),
      })
      .select(
        '_id fullName studentCode grade subjects learningNeeds preferredTeachingMode preferredLocation saleId',
      )
      .lean<ParentStudentLean | null>();

    if (!student) {
      throw new ForbiddenException('Student context is not available for this parent');
    }

    return student;
  }

  private async getParentSupportContactIds(parentUserId: string): Promise<Set<string>> {
    const students = await this.studentModel
      .find({ parentUserId: new Types.ObjectId(parentUserId) })
      .select('saleId')
      .lean<Array<{ saleId?: Types.ObjectId }>>();

    const saleIds = Array.from(
      new Set(
        students
          .map((student) => student.saleId?.toString())
          .filter((id): id is string => !!id),
      ),
    ).map((id) => new Types.ObjectId(id));

    const userFilter: any = {
      status: UserStatus.ACTIVE,
      $or: [
        { role: Role.DIRECTOR },
        { role: Role.OPS },
      ],
    };

    if (saleIds.length) {
      userFilter.$or.push({
        role: Role.SALE,
        _id: { $in: saleIds },
      });
    }

    const users = await this.userModel
      .find(userFilter)
      .select('_id')
      .lean<Array<{ _id: Types.ObjectId }>>();

    return new Set(users.map((user) => user._id.toString()));
  }

  private async resolveConversationAccess(
    senderId: string,
    receiverId: string,
    contextStudentId?: string,
  ): Promise<ConversationAccess> {
    const [sender, receiver] = await Promise.all([
      this.findActiveUserOrThrow(senderId),
      this.findActiveUserOrThrow(receiverId),
    ]);

    const senderIsParent = sender.role === Role.PARENT;
    const receiverIsParent = receiver.role === Role.PARENT;

    if (!senderIsParent && !receiverIsParent) {
      if (contextStudentId) {
        throw new BadRequestException(
          'Student context is only supported for parent support conversations',
        );
      }

      return { conversationKind: ConversationKind.DIRECT };
    }

    const parent = senderIsParent ? sender : receiver;
    const supportUser = senderIsParent ? receiver : sender;

    if (!PARENT_SUPPORT_ROLES.includes(supportUser.role)) {
      throw new ForbiddenException('Parent support chat only allows support staff');
    }

    const allowedContactIds = await this.getParentSupportContactIds(parent._id.toString());
    if (!allowedContactIds.has(supportUser._id.toString())) {
      throw new ForbiddenException('This support contact is not available for the selected parent');
    }

    if (!contextStudentId) {
      return { conversationKind: ConversationKind.PARENT_SUPPORT };
    }

    const student = await this.findParentStudentOrThrow(parent._id.toString(), contextStudentId);
    return {
      conversationKind: ConversationKind.PARENT_SUPPORT,
      topicStudentId: student._id,
      topicStudentName: student.fullName || '',
    };
  }

  private async assertConversationParticipant(
    userId: string,
    conversationId: string,
  ): Promise<ConversationPermission> {
    const convo = await this.conversationModel.findById(conversationId);
    if (!convo) throw new NotFoundException('Conversation not found');

    const isParticipant = convo.participants.some(
      (participant) => participant.toString() === userId,
    );
    if (isParticipant) {
      return { convo, isParticipant: true };
    }

    const actor = await this.findActiveUserOrThrow(userId);
    const isPrivilegedParentSupportViewer =
      convo.conversationKind === ConversationKind.PARENT_SUPPORT
      && [Role.OPS, Role.DIRECTOR].includes(actor.role);

    if (!isPrivilegedParentSupportViewer) {
      throw new NotFoundException('Conversation not found');
    }

    return { convo, isParticipant: false };
  }

  private async updateConversationLastMessage(
    conversationId: Types.ObjectId,
    content: string,
    senderId?: string,
  ) {
    const lastMessage = content.substring(0, 100);
    if (senderId) {
      await this.conversationModel.updateOne(
        { _id: conversationId },
        {
          $set: {
            lastMessage,
            lastMessageAt: new Date(),
            lastMessageBy: new Types.ObjectId(senderId),
          },
        },
      );
      return;
    }

    await this.conversationModel.updateOne(
      { _id: conversationId },
      {
        $set: {
          lastMessage,
          lastMessageAt: new Date(),
        },
        $unset: { lastMessageBy: 1 },
      },
    );
  }

  async getOrCreateConversation(
    userId1: string,
    userId2: string,
    access: ConversationAccess = { conversationKind: ConversationKind.DIRECT },
  ): Promise<ConversationDocument> {
    const id1 = new Types.ObjectId(userId1);
    const id2 = new Types.ObjectId(userId2);

    const filter: any = {
      participants: { $all: [id1, id2], $size: 2 },
    };

    if (access.conversationKind === ConversationKind.DIRECT) {
      filter.$or = [
        { conversationKind: ConversationKind.DIRECT },
        { conversationKind: { $exists: false } },
      ];
    } else {
      filter.conversationKind = access.conversationKind;
    }

    if (access.topicStudentId) {
      filter.topicStudentId = access.topicStudentId;
    } else {
      filter.topicStudentId = { $exists: false };
    }

    let convo = await this.conversationModel.findOne(filter);

    if (!convo) {
      convo = await this.conversationModel.create({
        participants: [id1, id2],
        conversationKind: access.conversationKind,
        topicStudentId: access.topicStudentId,
        topicStudentName: access.topicStudentName,
      });
    } else if (!convo.topicStudentName && access.topicStudentName) {
      convo.topicStudentName = access.topicStudentName;
      await convo.save();
    }

    return convo;
  }

  async sendMessage(
    senderId: string,
    receiverId: string,
    content: string,
    contextStudentId?: string,
  ) {
    const access = await this.resolveConversationAccess(
      senderId,
      receiverId,
      contextStudentId,
    );

    const convo = await this.getOrCreateConversation(senderId, receiverId, access);

    const message = await this.messageModel.create({
      conversationId: convo._id,
      senderId: new Types.ObjectId(senderId),
      senderType: MessageSenderType.USER,
      content,
    });

    await this.updateConversationLastMessage(convo._id as Types.ObjectId, content, senderId);

    return message;
  }

  async sendToConversation(senderId: string, conversationId: string, content: string) {
    const { convo } = await this.assertConversationParticipant(senderId, conversationId);

    const message = await this.messageModel.create({
      conversationId: convo._id,
      senderId: new Types.ObjectId(senderId),
      senderType: MessageSenderType.USER,
      content,
    });

    await this.updateConversationLastMessage(convo._id as Types.ObjectId, content, senderId);

    return message;
  }

  async previewAiSuggestion(userId: string, conversationId: string) {
    const actor = await this.findActiveUserOrThrow(userId);
    if (!PARENT_SUPPORT_ROLES.includes(actor.role)) {
      throw new ForbiddenException('AI suggestion is only available for parent-support agents');
    }

    const { convo } = await this.assertConversationParticipant(userId, conversationId);
    if (convo.conversationKind !== ConversationKind.PARENT_SUPPORT) {
      throw new BadRequestException('AI suggestion is only available for parent-support conversations');
    }

    const participantIds = convo.participants.map((participant) => participant.toString());
    const participants = await this.userModel
      .find({ _id: { $in: participantIds.map((id) => new Types.ObjectId(id)) } })
      .select('_id fullName role status')
      .lean<ActiveUserLean[]>();

    const parent = participants.find((participant) =>
      participant.role === Role.PARENT && participant.status === UserStatus.ACTIVE);

    if (!parent) {
      throw new BadRequestException('Parent-support conversation is missing an active parent');
    }

    const content = await this.aiHelper.generateParentSupportAIReply(convo, parent);
    if (!content) {
      throw new BadRequestException('AI suggestion is unavailable for this conversation');
    }

    return {
      content,
      conversationId: convo._id.toString(),
      previewOnly: true,
    };
  }

  async listConversations(userId: string) {
    const uid = new Types.ObjectId(userId);
    const actor = await this.findActiveUserOrThrow(userId);
    const canViewSupportQueue = [Role.OPS, Role.DIRECTOR].includes(actor.role);

    const conversations = await this.conversationModel
      .find(
        canViewSupportQueue
          ? {
              $or: [
                { participants: uid },
                { conversationKind: ConversationKind.PARENT_SUPPORT },
              ],
            }
          : { participants: uid },
      )
      .sort({ lastMessageAt: -1 })
      .populate('participants', 'fullName email role')
      .populate('topicStudentId', 'fullName studentCode')
      .lean();

    const participantConversationIds = conversations
      .filter((convo) =>
        convo.participants.some(
          (participant: any) => participant?._id?.toString?.() === userId,
        ),
      )
      .map((convo) => convo._id as Types.ObjectId);
    const unreadCountMap = await this.getUnreadCountMap(participantConversationIds, uid);

    return conversations.map((convo) => {
      const isParticipant = convo.participants.some(
        (participant: any) => participant?._id?.toString?.() === userId,
      );

      return {
        ...convo,
        unreadCount: isParticipant ? unreadCountMap.get(convo._id.toString()) || 0 : 0,
        viewerIsParticipant: isParticipant,
      };
    });
  }

  async getConversation(userId: string, conversationId: string) {
    const uid = new Types.ObjectId(userId);
    const access = await this.assertConversationParticipant(userId, conversationId);

    const convo = await this.conversationModel
      .findById(conversationId)
      .populate('participants', 'fullName email role')
      .populate('topicStudentId', 'fullName studentCode')
      .lean();

    if (!convo) throw new NotFoundException('Conversation not found');

    const unreadCountMap = access.isParticipant
      ? await this.getUnreadCountMap([convo._id as Types.ObjectId], uid)
      : new Map<string, number>();
    const unreadCount = access.isParticipant
      ? unreadCountMap.get(convo._id.toString()) || 0
      : 0;

    return {
      ...convo,
      unreadCount,
      viewerIsParticipant: access.isParticipant,
    };
  }

  async listMessages(
    userId: string,
    conversationId: string,
    page = 1,
    limit = 50,
  ) {
    const { convo } = await this.assertConversationParticipant(userId, conversationId);

    const skip = (page - 1) * limit;
    const [messages, total] = await Promise.all([
      this.messageModel
        .find({ conversationId: convo._id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('senderId', 'fullName email role')
        .lean(),
      this.messageModel.countDocuments({ conversationId: convo._id }),
    ]);

    const normalizedMessages = messages
      .reverse()
      .map((message) => this.normalizeMessageForResponse(message));

    return { messages: normalizedMessages, total, page, limit };
  }

  async markRead(userId: string, conversationId: string) {
    const uid = new Types.ObjectId(userId);
    const access = await this.assertConversationParticipant(userId, conversationId);

    if (!access.isParticipant) {
      return { marked: 0 };
    }

    const result = await this.messageModel.updateMany(
      {
        conversationId: access.convo._id,
        senderId: { $ne: uid },
        readAt: null,
      },
      { $set: { readAt: new Date() } },
    );

    return { marked: result.modifiedCount };
  }

  async getUnreadCount(userId: string) {
    const uid = new Types.ObjectId(userId);

    const convos = await this.conversationModel
      .find({ participants: uid })
      .select('_id')
      .lean();

    const convoIds = convos.map((convo) => convo._id);

    const unreadCountMap = await this.getUnreadCountMap(convoIds as Types.ObjectId[], uid);
    const count = Array.from(unreadCountMap.values()).reduce((sum, value) => sum + value, 0);

    return { count };
  }
}
