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
  AiAssistantStatus,
  AiAssistantType,
} from '../chatbot/schemas/ai-assistant-profile.schema';
import {
  OpenAIToken,
  OpenAITokenDocument,
  OpenAITokenStatus,
} from '../chatbot/schemas/openai-token.schema';
import { TicketsService } from '../tickets/tickets.service';
import { TicketPriority, TicketType } from '../tickets/schemas/ticket.schema';
import { Role } from '../common/interfaces/role.enum';
import { UserStatus } from '../common/interfaces/user-status.enum';
import { StudentSupportSnapshotService } from './student-support-snapshot.service';

const PARENT_SUPPORT_ROLES = [Role.DIRECTOR, Role.OPS, Role.SALE];
const AI_SENDER_NAME = 'Tro ly AI';

type ActiveUserLean = {
  _id: Types.ObjectId;
  fullName?: string;
  role: Role;
  status: UserStatus;
};

type ParentStudentLean = {
  _id: Types.ObjectId;
  fullName?: string;
  studentCode?: string;
  grade?: string;
  subjects?: string[];
  learningNeeds?: string;
  preferredTeachingMode?: string;
  preferredLocation?: string;
  saleId?: Types.ObjectId;
};

type ConversationAccess = {
  conversationKind: ConversationKind;
  topicStudentId?: Types.ObjectId;
  topicStudentName?: string;
};

type ConversationPermission = {
  convo: ConversationDocument;
  isParticipant: boolean;
};

type TokenData = {
  tokenId: Types.ObjectId;
  key: string;
  model: string;
  temperature: number;
  maxTokens: number;
  systemPromptPrefix?: string;
};

type AssistantProfileLean = {
  _id: Types.ObjectId;
  assistantType: AiAssistantType;
  label: string;
  description?: string;
  rulesPrompt?: string;
  defaultOpenAITokenId?: Types.ObjectId;
  status: AiAssistantStatus;
};

type HandoffIntent = {
  type: TicketType;
  priority: TicketPriority;
  subjectLabel: string;
  reasonLabel: string;
};

type HandoffResult = {
  reply: string;
  ticketId: string;
  ticketCode: string;
  created: boolean;
};

type UnreadCountRow = {
  _id: Types.ObjectId;
  count: number;
};

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);
  private encryptionKey: Buffer | null = null;

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

  private formatDate(value?: string | Date | null): string {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  private formatDateTime(
    value?: string | Date | null,
    startTime?: string | null,
    endTime?: string | null,
  ): string {
    if (!value) return '';

    const parts = [this.formatDate(value)];
    if (startTime && endTime) parts.push(`${startTime}-${endTime}`);
    else if (startTime) parts.push(startTime);

    return parts.filter(Boolean).join(' ');
  }

  private homeworkStatusLabel(status?: string): string {
    const labels: Record<string, string> = {
      NOT_ASSIGNED: 'khong giao',
      ASSIGNED: 'da giao',
      SUBMITTED: 'da nop',
      REVIEWED: 'da nhan xet',
    };
    return labels[status || ''] || 'chua ro';
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
          fullName: message.senderLabel || AI_SENDER_NAME,
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

  private normalizeIntentText(value: string): string {
    return value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private hasIntentKeyword(normalized: string, keywords: string[]): boolean {
    return keywords.some((keyword) => normalized.includes(keyword));
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

  private detectParentSupportHandoff(content: string): HandoffIntent | null {
    const normalized = this.normalizeIntentText(content);
    if (!normalized) return null;

    const isUrgent = this.hasIntentKeyword(normalized, [
      'gap',
      'khan',
      'nghiem trong',
      'lap tuc',
      'ngay hom nay',
      'hom nay',
      'can xu ly ngay',
    ]);

    const refundRequest = this.hasIntentKeyword(normalized, [
      'hoan tien',
      'refund',
      'tra lai tien',
      'tra tien',
      'rut tien',
      'hoan hoc phi',
    ]);
    if (refundRequest) {
      return {
        type: TicketType.REFUND_REQUEST,
        priority: isUrgent ? TicketPriority.URGENT : TicketPriority.HIGH,
        subjectLabel: 'yeu cau hoan tien',
        reasonLabel: 'hoan tien',
      };
    }

    const paymentIssue = this.hasIntentKeyword(normalized, [
      'hoc phi',
      'thanh toan',
      'chuyen khoan',
      'bien lai',
      'dong tien',
      'cong no',
      'phi',
      'thu tien',
    ]);
    if (paymentIssue) {
      return {
        type: TicketType.PAYMENT_ISSUE,
        priority: isUrgent ? TicketPriority.HIGH : TicketPriority.MEDIUM,
        subjectLabel: 'van de thanh toan',
        reasonLabel: 'thanh toan',
      };
    }

    const scheduleIssue = this.hasIntentKeyword(normalized, [
      'doi lich',
      'chuyen lich',
      'reschedule',
      'bao luu',
      'tam nghi',
      'xin nghi',
      'nghi hoc',
      'nghi buoi',
      'lich hoc',
      'sap xep lich',
    ]);
    if (scheduleIssue) {
      return {
        type: TicketType.SCHEDULE_ISSUE,
        priority: isUrgent ? TicketPriority.HIGH : TicketPriority.MEDIUM,
        subjectLabel: 'yeu cau xu ly lich hoc',
        reasonLabel: 'lich hoc',
      };
    }

    const complaint = this.hasIntentKeyword(normalized, [
      'khieu nai',
      'phan nan',
      'khong hai long',
      'buc xuc',
      'thai do',
      'vo trach nhiem',
      'tre gio',
      'muon gio',
      'nghiem tuc',
      'boi thuong',
      'tranh chap',
    ]);
    if (complaint) {
      const teacherComplaint = this.hasIntentKeyword(normalized, [
        'giao vien',
        'thay',
        'co giao',
        'co day',
        'thay day',
      ]);

      return {
        type: teacherComplaint ? TicketType.TEACHER_COMPLAINT : TicketType.DISPUTE,
        priority: isUrgent ? TicketPriority.URGENT : TicketPriority.HIGH,
        subjectLabel: teacherComplaint ? 'khieu nai giao vien' : 'khieu nai can xu ly nguoi that',
        reasonLabel: teacherComplaint ? 'khieu nai giao vien' : 'khieu nai',
      };
    }

    const explicitHumanRequest = this.hasIntentKeyword(normalized, [
      'nguoi that',
      'nhan vien',
      'quan ly',
      'ops',
      'goi lai',
      'lien he truc tiep',
      'ho tro truc tiep',
    ]);
    if (explicitHumanRequest) {
      return {
        type: TicketType.OTHER,
        priority: isUrgent ? TicketPriority.HIGH : TicketPriority.MEDIUM,
        subjectLabel: 'yeu cau nguoi that xu ly',
        reasonLabel: 'can nguoi that ho tro',
      };
    }

    return null;
  }

  private buildParentSupportHandoffReply(
    intent: HandoffIntent,
    ticketCode: string,
    created: boolean,
  ): string {
    if (created) {
      return `Em da chuyen yeu cau ${intent.reasonLabel} sang nguoi phu trach va tao ticket ${ticketCode}. Nhan vien se tiep tuc xu ly trong he thong va phan hoi anh/chi som nhat.`;
    }

    return `Yeu cau ${intent.reasonLabel} cua anh/chi da duoc ghi nhan truoc do trong ticket ${ticketCode}. Nhan vien phu trach se tiep tuc theo doi va phan hoi trong luong ho tro nay.`;
  }

  private async handleParentSupportHandoff(
    convo: ConversationDocument,
    parent: ActiveUserLean,
    parentMessageContent: string,
  ): Promise<HandoffResult | null> {
    const intent = this.detectParentSupportHandoff(parentMessageContent);
    if (!intent) return null;

    const supportUserId = convo.participants
      .map((participant) => participant.toString())
      .find((participantId) => participantId !== parent._id.toString());

    const studentName = convo.topicStudentName ? ` - ${convo.topicStudentName}` : '';
    const descriptionLines = [
      'Ticket duoc tao tu luong chat ho tro phu huynh.',
      `Loai xu ly: ${intent.reasonLabel}`,
      `ConversationId: ${convo._id?.toString?.() || ''}`,
      `Noi dung phu huynh: ${parentMessageContent.trim()}`,
    ];

    if (convo.topicStudentName) {
      descriptionLines.splice(2, 0, `Hoc sinh: ${convo.topicStudentName}`);
    }

    const { ticket, created } = await this.ticketsService.createOrFindParentSupportHandoff({
      conversationId: convo._id.toString(),
      parentId: parent._id.toString(),
      studentId: convo.topicStudentId?.toString?.(),
      supportUserId,
      type: intent.type,
      priority: intent.priority,
      subject: `Chat PH - ${intent.subjectLabel}${studentName}`,
      description: descriptionLines.join('\n'),
    });

    return {
      reply: this.buildParentSupportHandoffReply(intent, ticket.ticketCode, created),
      ticketId: ticket._id.toString(),
      ticketCode: ticket.ticketCode,
      created,
    };
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

  private async getAiAssistantProfile(
    assistantType: AiAssistantType,
  ): Promise<AssistantProfileLean | null> {
    return this.aiAssistantProfileModel
      .findOne({ assistantType })
      .lean<AssistantProfileLean | null>();
  }

  private async getDefaultParentSupportToken(
    preferredTokenId?: Types.ObjectId | string,
  ): Promise<TokenData | null> {
    const configuredTokenId = this.configService
      .get<string>('PARENT_SUPPORT_OPENAI_TOKEN_ID')
      ?.trim();

    let token: OpenAITokenDocument | null = null;
    if (preferredTokenId && Types.ObjectId.isValid(preferredTokenId.toString())) {
      token = await this.openaiTokenModel.findById(preferredTokenId);
    }

    if (configuredTokenId && Types.ObjectId.isValid(configuredTokenId)) {
      token = token || await this.openaiTokenModel.findById(configuredTokenId);
    }

    if (!token) {
      token = await this.openaiTokenModel
        .findOne({ status: OpenAITokenStatus.ACTIVE })
        .sort({ lastUsedAt: -1, createdAt: -1 });
    }

    if (!token || token.status !== OpenAITokenStatus.ACTIVE) {
      return null;
    }

    await this.openaiTokenModel.updateOne(
      { _id: token._id },
      { lastUsedAt: new Date() },
    );

    return {
      tokenId: token._id as Types.ObjectId,
      key: this.decrypt(token.apiKey),
      model: token.model || 'gpt-4o-mini',
      temperature: typeof token.temperature === 'number' ? token.temperature : 0.3,
      maxTokens: Math.min(Math.max(token.maxTokens || 500, 150), 800),
      systemPromptPrefix: token.systemPromptPrefix || undefined,
    };
  }

  private async buildStudentSupportContext(
    parentUserId: string,
    studentId: string,
  ): Promise<string> {
    const snapshot = await this.studentSupportSnapshotService.getOrBuild(
      parentUserId,
      studentId,
      { preferFresh: true },
    );
    return snapshot.contextText || '';
  }

  private async callOpenAIChatCompletion(
    tokenData: TokenData,
    messages: Array<{ role: string; content: string }>,
  ): Promise<string | null> {
    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
      try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${tokenData.key}`,
          },
          body: JSON.stringify({
            model: tokenData.model,
            messages,
            temperature: tokenData.temperature,
            max_tokens: tokenData.maxTokens,
          }),
        });

        if (!response.ok) {
          const errBody = await response.text();
          const err = new Error(`OpenAI API error ${response.status}: ${errBody}`);

          if (response.status === 401) {
            await this.openaiTokenModel.updateOne(
              { _id: tokenData.tokenId },
              { status: OpenAITokenStatus.EXPIRED },
            );
            throw err;
          }

          if (response.status === 400) {
            throw err;
          }

          lastError = err;
          if (attempt < maxRetries) {
            const delay = Math.pow(2, attempt) * 500;
            await new Promise((resolve) => setTimeout(resolve, delay));
            continue;
          }

          throw err;
        }

        const result = (await response.json()) as any;
        return this.clipText(result.choices?.[0]?.message?.content, 1800) || null;
      } catch (error: any) {
        lastError = error;

        if (error.message?.includes('401') || error.message?.includes('400')) {
          throw error;
        }

        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 500;
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error('OpenAI request failed');
  }

  private async generateParentSupportAIReply(
    convo: ConversationDocument,
    parent: ActiveUserLean,
  ): Promise<string | null> {
    if (!convo.topicStudentId) {
      return [
        'Em da nhan tin nhan cua anh/chi.',
        'De kiem tra dung hoc ba va tien do hoc tap, anh/chi vui long tao hoi thoai theo tung hoc sinh hoac cho nhan vien ho tro tiep.',
      ].join(' ');
    }

    const assistantProfile = await this.getAiAssistantProfile(
      AiAssistantType.PARENT_SUPPORT,
    );
    if (assistantProfile && assistantProfile.status === AiAssistantStatus.INACTIVE) {
      return null;
    }

    const tokenData = await this.getDefaultParentSupportToken(
      assistantProfile?.defaultOpenAITokenId,
    );
    if (!tokenData) {
      return null;
    }

    const supportContext = await this.buildStudentSupportContext(
      parent._id.toString(),
      convo.topicStudentId.toString(),
    );

    const recentMessages = await this.messageModel
      .find({ conversationId: convo._id })
      .select('senderId senderType senderLabel content createdAt')
      .sort({ createdAt: -1 })
      .limit(12)
      .lean<Array<any>>();

    const systemParts: string[] = [];
    if (tokenData.systemPromptPrefix?.trim()) {
      systemParts.push(tokenData.systemPromptPrefix.trim());
    }
    if (assistantProfile?.rulesPrompt?.trim()) {
      systemParts.push(assistantProfile.rulesPrompt.trim());
    }
    systemParts.push(
      [
        'Ban la tro ly cham soc phu huynh cua trung tam gia su.',
        'Chi duoc tra loi dua tren lich su hoi thoai va du lieu noi bo da xac thuc.',
        'Neu du lieu chua du, phai noi ro la chua the xac nhan.',
        'Neu context co canh bao du lieu, phai uu tien noi ro gioi han va khong duoc tra loi qua tu tin.',
        'Khong tu suy doan hoc phi, ket qua hoc tap, lich hoc hay cam ket thay doi hanh chinh.',
        'Neu phu huynh yeu cau doi lich, bao luu, hoan tien, giam hoc phi, khiu nai nghiem trong hoac van de ngoai du lieu hoc tap, hay lich su, hay chuyen cho nhan vien ho tro tiep.',
        'Khi nhac den buoi hoc, lich hoc, tien do hoac tai lieu, neu co ngay thi phai noi ngay cu the theo du lieu.',
        'Tra loi bang tieng Viet, than thien, ro rang, toi da 6 cau.',
      ].join(' '),
    );

    const messages: Array<{ role: string; content: string }> = [
      { role: 'system', content: systemParts.join('\n\n') },
      {
        role: 'system',
        content: `Du lieu noi bo da xac thuc cho hoc sinh trong hoi thoai nay:\n${supportContext}`,
      },
    ];

    for (const message of recentMessages.reverse()) {
      if (message.senderType === MessageSenderType.AI) {
        messages.push({ role: 'assistant', content: message.content });
        continue;
      }

      const senderId = message.senderId?.toString?.() || '';
      if (senderId === parent._id.toString()) {
        messages.push({ role: 'user', content: message.content });
      } else {
        messages.push({ role: 'assistant', content: message.content });
      }
    }

    return this.callOpenAIChatCompletion(tokenData, messages);
  }

  private async maybeAutoReplyToParentSupport(
    convo: ConversationDocument,
    senderId: string,
    parentMessageContent: string,
  ) {
    if (convo.conversationKind !== ConversationKind.PARENT_SUPPORT) {
      return;
    }

    const sender = await this.findActiveUserOrThrow(senderId);
    if (sender.role !== Role.PARENT) {
      return;
    }

    try {
      const handoffResult = await this.handleParentSupportHandoff(
        convo,
        sender,
        parentMessageContent,
      );
      if (handoffResult) {
        await this.messageModel.create({
          conversationId: convo._id,
          content: handoffResult.reply,
          senderType: MessageSenderType.AI,
          senderLabel: AI_SENDER_NAME,
          handoffTicketId: new Types.ObjectId(handoffResult.ticketId),
          handoffTicketCode: handoffResult.ticketCode,
        });

        await this.updateConversationLastMessage(
          convo._id as Types.ObjectId,
          handoffResult.reply,
        );
        return;
      }

      const aiReply = await this.generateParentSupportAIReply(convo, sender);
      if (!aiReply) return;

      await this.messageModel.create({
        conversationId: convo._id,
        content: aiReply,
        senderType: MessageSenderType.AI,
        senderLabel: AI_SENDER_NAME,
      });

      await this.updateConversationLastMessage(convo._id as Types.ObjectId, aiReply);
    } catch (error: any) {
      this.logger.warn(
        `Parent support AI reply skipped for conversation ${convo._id?.toString?.()}: ${error.message}`,
      );
    }
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
    await this.maybeAutoReplyToParentSupport(convo, senderId, content);

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
    await this.maybeAutoReplyToParentSupport(convo, senderId, content);

    return message;
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
