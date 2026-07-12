import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Model, Types } from 'mongoose';
import { MessageDocument, MessageSenderType } from './schemas/message.schema';
import { ConversationDocument, ConversationKind } from './schemas/conversation.schema';
import {
  AiAssistantProfileDocument,
  AiAssistantStatus,
  AiAssistantType,
} from '../chatbot/schemas/ai-assistant-profile.schema';
import {
  OpenAITokenDocument,
  OpenAITokenStatus,
} from '../chatbot/schemas/openai-token.schema';
import { TicketsService } from '../tickets/tickets.service';
import { TicketPriority, TicketType } from '../tickets/schemas/ticket.schema';
import { Role } from '../common/interfaces/role.enum';
import { buildOpenAIChatBody } from '../common/utils/openai-chat-options';
import { extractOpenAIApiKey } from '../common/utils/openai-api-key';
import { StudentSupportSnapshotService } from './student-support-snapshot.service';
import {
  ActiveUserLean,
  AssistantProfileLean,
  HandoffIntent,
  HandoffResult,
  TokenData,
} from './messages.types';

const AI_SENDER_NAME = 'Tro ly AI';

export class ParentSupportAiHelper {
  private readonly logger = new Logger(ParentSupportAiHelper.name);

  constructor(
    private readonly messageModel: Model<MessageDocument>,
    private readonly conversationModel: Model<ConversationDocument>,
    private readonly aiAssistantProfileModel: Model<AiAssistantProfileDocument>,
    private readonly openaiTokenModel: Model<OpenAITokenDocument>,
    private readonly configService: ConfigService,
    private readonly ticketsService: TicketsService,
    private readonly studentSupportSnapshotService: StudentSupportSnapshotService,
    private readonly decrypt: (cipherText: string) => string,
    private readonly clipText: (value?: string | null, limit?: number) => string,
  ) {}

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

  detectParentSupportHandoff(content: string): HandoffIntent | null {
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

  async handleParentSupportHandoff(
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

    const rawKey = this.decrypt(token.apiKey);
    const key = extractOpenAIApiKey(rawKey);
    if (!key) {
      this.logger.warn(`Parent support OpenAI token ${token._id?.toString()} does not contain a valid sk- API key`);
      return null;
    }

    await this.openaiTokenModel.updateOne(
      { _id: token._id },
      { lastUsedAt: new Date() },
    );

    return {
      tokenId: token._id as Types.ObjectId,
      key,
      model: token.model || 'gpt-5.4-mini',
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
          body: JSON.stringify(buildOpenAIChatBody({
            model: tokenData.model,
            messages,
            temperature: tokenData.temperature,
            maxTokens: tokenData.maxTokens,
          })),
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

  async generateParentSupportAIReply(
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

  async maybeAutoReplyToParentSupport(
    convo: ConversationDocument,
    senderId: string,
    parentMessageContent: string,
    findActiveUserOrThrow: (userId: string) => Promise<ActiveUserLean>,
    updateConversationLastMessage: (
      conversationId: Types.ObjectId,
      content: string,
      senderId?: string,
    ) => Promise<void>,
  ) {
    if (convo.conversationKind !== ConversationKind.PARENT_SUPPORT) {
      return;
    }

    const sender = await findActiveUserOrThrow(senderId);
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

        await updateConversationLastMessage(
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

      await updateConversationLastMessage(convo._id as Types.ObjectId, aiReply);
    } catch (error: any) {
      this.logger.warn(
        `Parent support AI reply skipped for conversation ${convo._id?.toString?.()}: ${error.message}`,
      );
    }
  }
}
