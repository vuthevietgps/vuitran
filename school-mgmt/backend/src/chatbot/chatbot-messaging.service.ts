import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, FilterQuery } from 'mongoose';
import * as crypto from 'crypto';

import { Fanpage, FanpageDocument } from './schemas/fanpage.schema';
import { Conversation, ConversationDocument, ConversationStatus } from './schemas/conversation.schema';
import { Message, MessageDocument, SenderType, MessageStatus } from './schemas/message.schema';
import { AdGroup, AdGroupDocument } from '../ads/schemas/ad-group.schema';

import { QueryConversationDto } from './dto/query-conversation.dto';
import { UpdateConversationDto } from './dto/update-conversation.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { QueryMessageDto } from './dto/query-message.dto';

import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { MarketingAttributionService } from '../marketing-attribution/marketing-attribution.service';
import {
  ParentAttributionModel,
  ParentAttributionSourceType,
} from '../marketing-attribution/schemas/parent-attribution.schema';
import { ChatbotConfigService } from './chatbot-config.service';
import { ChatbotGateway } from './chatbot.gateway';
import { buildOpenAIChatBody } from '../common/utils/openai-chat-options';

@Injectable()
export class ChatbotMessagingService {
  private readonly logger = new Logger(ChatbotMessagingService.name);

  constructor(
    @InjectModel(Conversation.name) private conversationModel: Model<ConversationDocument>,
    @InjectModel(Message.name) private messageModel: Model<MessageDocument>,
    @InjectModel(Fanpage.name) private fanpageModel: Model<FanpageDocument>,
    @InjectModel(AdGroup.name) private adGroupModel: Model<AdGroupDocument>,
    private chatbotConfigService: ChatbotConfigService,
    private chatbotGateway: ChatbotGateway,
    private marketingAttributionService: MarketingAttributionService,
  ) {}

  private isDuplicateKeyError(err: any, fields?: string[]): boolean {
    const isDuplicate = !!(err && (err.code === 11000 || String(err?.message || '').includes('E11000')));
    if (!isDuplicate) return false;
    if (!fields?.length) return true;

    const keyPattern = err?.keyPattern || {};
    const keyValue = err?.keyValue || {};
    return fields.some((field) =>
      Object.prototype.hasOwnProperty.call(keyPattern, field)
      || Object.prototype.hasOwnProperty.call(keyValue, field)
      || String(err?.message || '').includes(`${field}_`),
    );
  }

  // ─── Conversation Management ────────────────────────────────

  private async generateConversationCode(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `CONV-${year}-`;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const entropy = `${Date.now().toString(36)}${crypto.randomBytes(2).toString('hex')}`.toUpperCase();
      const code = `${prefix}${entropy}`;
      const exists = await this.conversationModel.exists({ conversationCode: code });
      if (!exists) return code;
    }
    return `${prefix}${Date.now().toString(36).toUpperCase()}${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  }

  private parsePositiveInt(value: string | undefined, fallback: number, max: number): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
    return Math.min(Math.floor(parsed), max);
  }

  async findOrCreateConversation(
    fanpageId: string,
    platformUserId: string,
    customerName?: string,
    adRefParam?: string,
  ): Promise<ConversationDocument> {
    const fanpageObjectId = new Types.ObjectId(fanpageId);
    let conv = await this.conversationModel.findOne({
      fanpageId: fanpageObjectId,
      platformUserId,
    });

    if (conv) {
      // Reopen if closed
      let changed = false;
      if (conv.status === ConversationStatus.CLOSED) {
        conv.status = ConversationStatus.AI_HANDLING;
        changed = true;
      }
      if (customerName && !conv.customerName) {
        conv.customerName = customerName;
        changed = true;
      }
      if (adRefParam && (!conv.adRefParam || !conv.adGroupId)) {
        const fanpage = await this.fanpageModel.findById(fanpageId).lean();
        if (!fanpage) throw new NotFoundException('Fanpage không tồn tại');

        conv.adRefParam = adRefParam;
        const resolved = await this.resolveAdGroup(adRefParam, fanpage);
        if (resolved) {
          conv.adGroupId = resolved.adGroupId;
          conv.adGroupName = resolved.adGroupName;
        }
        changed = true;
      }
      if (changed) {
        await conv.save();
        if (conv.customerPhone && conv.adGroupId) {
          await this.marketingAttributionService.upsertParentAttribution({
            parentPhone: conv.customerPhone,
            adGroupId: conv.adGroupId,
            adGroupName: conv.adGroupName,
            platform: conv.platform,
            adRefParam: conv.adRefParam,
            sourceConversationId: conv._id,
            sourceType: ParentAttributionSourceType.CONVERSATION,
          });
        }
      }
      return conv;
    }

    const fanpage = await this.fanpageModel.findById(fanpageId).lean();
    if (!fanpage) throw new NotFoundException('Fanpage không tồn tại');

    // Resolve ad group attribution
    let adGroupId: Types.ObjectId | undefined;
    let adGroupName: string | undefined;
    if (adRefParam) {
      const resolved = await this.resolveAdGroup(adRefParam, fanpage);
      if (resolved) {
        adGroupId = resolved.adGroupId;
        adGroupName = resolved.adGroupName;
      }
    }

    const baseConversationData = {
      fanpageId: fanpageObjectId,
      fanpageName: fanpage.name,
      platform: fanpage.platform,
      platformUserId,
      customerName,
      status: ConversationStatus.AI_HANDLING,
      lastMessageAt: new Date(),
      messageCount: 0,
      adRefParam,
      adGroupId,
      adGroupName,
    };

    for (let attempt = 0; attempt < 6; attempt += 1) {
      const conversationCode = await this.generateConversationCode();

      try {
        conv = new this.conversationModel({
          conversationCode,
          ...baseConversationData,
        });
        return await conv.save();
      } catch (err: any) {
        if (this.isDuplicateKeyError(err, ['fanpageId', 'platformUserId'])) {
          const existing = await this.conversationModel.findOne({
            fanpageId: fanpageObjectId,
            platformUserId,
          });
          if (existing) return existing;
        }

        if (this.isDuplicateKeyError(err, ['conversationCode'])) {
          this.logger.warn(
            `Duplicate conversationCode during webhook create for fanpage ${fanpageId}, retry ${attempt + 1}/6`,
          );
          continue;
        }

        throw err;
      }
    }

    conv = new this.conversationModel({
      conversationCode: `CONV-${new Date().getFullYear()}-${Date.now()}`,
      ...baseConversationData,
    });

    try {
      return await conv.save();
    } catch (err: any) {
      if (this.isDuplicateKeyError(err, ['fanpageId', 'platformUserId'])) {
        const existing = await this.conversationModel.findOne({
          fanpageId: fanpageObjectId,
          platformUserId,
        });
        if (existing) return existing;
      }
      throw err;
    }
  }

  async findAllConversations(query: QueryConversationDto) {
    const filter: FilterQuery<ConversationDocument> = {};
    if (query.fanpageId) filter.fanpageId = new Types.ObjectId(query.fanpageId);
    if (query.status) filter.status = query.status;
    if (query.platform) filter.platform = query.platform;
    if (query.assignedAgentId) filter.assignedAgentId = new Types.ObjectId(query.assignedAgentId);
    if (query.search) {
      filter.$or = [
        { customerName: { $regex: query.search, $options: 'i' } },
        { customerPhone: { $regex: query.search, $options: 'i' } },
        { conversationCode: { $regex: query.search, $options: 'i' } },
      ];
    }

    const page = this.parsePositiveInt(query.page, 1, 10000);
    const limit = this.parsePositiveInt(query.limit, 20, 100);
    const skip = (page - 1) * limit;
    const total = await this.conversationModel.countDocuments(filter);
    const data = await this.conversationModel.find(filter)
      .sort({ lastMessageAt: -1 })
      .skip(skip).limit(limit).lean();

    return { data, total, page, limit };
  }

  async findOneConversation(id: string) {
    const conv = await this.conversationModel.findById(id).lean();
    if (!conv) throw new NotFoundException('Hội thoại không tồn tại');
    return conv;
  }

  async updateConversation(id: string, dto: UpdateConversationDto) {
    const conv = await this.conversationModel.findById(id);
    if (!conv) throw new NotFoundException('Hội thoại không tồn tại');

    const update: any = { ...dto };
    if (dto.assignedAgentId) {
      update.assignedAgentId = new Types.ObjectId(dto.assignedAgentId);
    }
    delete update.adRefParam;
    delete update.adGroupId;
    delete update.adGroupName;

    conv.set(update);

    const fanpage = await this.fanpageModel.findById(conv.fanpageId).lean();
    if (!fanpage) throw new NotFoundException('Fanpage không tồn tại');

    if (dto.adRefParam !== undefined) {
      const adRefParam = dto.adRefParam.trim();
      conv.adRefParam = adRefParam || undefined;
      if (adRefParam && !dto.adGroupId) {
        const resolved = await this.resolveAdGroup(adRefParam, fanpage);
        if (resolved) {
          conv.adGroupId = resolved.adGroupId;
          conv.adGroupName = dto.adGroupName?.trim() || resolved.adGroupName;
        }
      }
    }

    if (dto.adGroupId !== undefined) {
      const group = await this.adGroupModel.findById(dto.adGroupId).lean();
      if (!group) throw new NotFoundException('Nhóm quảng cáo không tồn tại');
      conv.adGroupId = group._id as Types.ObjectId;
      conv.adGroupName = dto.adGroupName?.trim() || group.name;
    } else if (dto.adGroupName !== undefined) {
      conv.adGroupName = dto.adGroupName.trim() || undefined;
    }

    const doc = await conv.save();

    if (
      doc.customerPhone
      && doc.adGroupId
      && (dto.adGroupId !== undefined || dto.adRefParam !== undefined || dto.customerPhone !== undefined)
    ) {
      await this.marketingAttributionService.upsertParentAttribution({
        parentPhone: doc.customerPhone,
        adGroupId: doc.adGroupId,
        adGroupName: doc.adGroupName,
        platform: doc.platform,
        adRefParam: doc.adRefParam,
        sourceConversationId: doc._id,
        attributionModel: ParentAttributionModel.MANUAL_OVERRIDE,
        sourceType: ParentAttributionSourceType.MANUAL,
      });
    }

    return doc;
  }

  async takeoverConversation(id: string, user: JwtPayload) {
    const conv = await this.conversationModel.findById(id);
    if (!conv) throw new NotFoundException('Hội thoại không tồn tại');
    conv.status = ConversationStatus.HUMAN_HANDLING;
    conv.assignedAgentId = new Types.ObjectId(user.sub);
    conv.assignedAgentName = user.fullName;
    return conv.save();
  }

  async releaseConversation(id: string) {
    const conv = await this.conversationModel.findById(id);
    if (!conv) throw new NotFoundException('Hội thoại không tồn tại');
    conv.status = ConversationStatus.AI_HANDLING;
    conv.assignedAgentId = undefined;
    conv.assignedAgentName = undefined;
    return conv.save();
  }

  // ─── Message Handling ───────────────────────────────────────

  async saveMessage(
    conversationId: string | Types.ObjectId,
    content: string,
    senderType: string,
    senderName?: string,
    senderUserId?: string,
    platformMessageId?: string,
  ): Promise<MessageDocument> {
    const conversationObjectId = new Types.ObjectId(conversationId.toString());
    const normalizedPlatformMessageId = platformMessageId?.trim();

    if (normalizedPlatformMessageId) {
      const existing = await this.messageModel.findOne({
        conversationId: conversationObjectId,
        platformMessageId: normalizedPlatformMessageId,
      });
      if (existing) return existing;
    }

    let saved: MessageDocument;
    try {
      const msg = new this.messageModel({
        conversationId: conversationObjectId,
        senderType,
        senderName,
        senderUserId: senderUserId ? new Types.ObjectId(senderUserId) : undefined,
        content,
        platformMessageId: normalizedPlatformMessageId || undefined,
        status: MessageStatus.SENT,
      });
      saved = await msg.save();
    } catch (err: any) {
      if (normalizedPlatformMessageId && this.isDuplicateKeyError(err, ['platformMessageId'])) {
        const existing = await this.messageModel.findOne({
          conversationId: conversationObjectId,
          platformMessageId: normalizedPlatformMessageId,
        });
        if (existing) return existing;
      }
      throw err;
    }

    // Update conversation
    await this.conversationModel.updateOne(
      { _id: conversationObjectId },
      { lastMessageAt: new Date(), $inc: { messageCount: 1 } },
    );

    // Push the new message to all staff clients watching this conversation via WebSocket
    this.chatbotGateway.emitNewMessage(conversationId.toString(), saved.toObject());

    return saved;
  }

  async getMessages(conversationId: string, query: QueryMessageDto) {
    const page = this.parsePositiveInt(query.page, 1, 10000);
    const limit = this.parsePositiveInt(query.limit, 50, 100);
    const skip = (page - 1) * limit;

    const filter = { conversationId: new Types.ObjectId(conversationId) };
    const total = await this.messageModel.countDocuments(filter);
    const data = await this.messageModel.find(filter)
      .sort({ createdAt: 1 })
      .skip(skip).limit(limit).lean();

    return { data, total, page, limit };
  }

  async sendHumanReply(conversationId: string, dto: SendMessageDto, user: JwtPayload) {
    const conv = await this.conversationModel.findById(conversationId);
    if (!conv) throw new NotFoundException('Hội thoại không tồn tại');

    // Save message
    const msg = await this.saveMessage(
      conversationId,
      dto.content,
      SenderType.HUMAN_AGENT,
      user.fullName,
      user.sub,
    );

    // Send to platform
    try {
      const fanpage = await this.fanpageModel.findById(conv.fanpageId);
      if (fanpage?.pageAccessToken) {
        await this.sendToPlatform(fanpage, conv.platformUserId, dto.content);
      }
    } catch (err: any) {
      this.logger.error(`Failed to send reply to platform: ${err.message}`);
      await this.messageModel.updateOne(
        { _id: msg._id },
        { status: MessageStatus.FAILED, errorMessage: err.message },
      );
    }

    return msg;
  }

  // ─── AI Auto-Reply ──────────────────────────────────────────

  async handleIncomingCustomerMessage(
    fanpageId: string,
    platformUserId: string,
    content: string,
    customerName?: string,
    adRefParam?: string,
    platformMessageId?: string,
  ) {
    const fanpage = await this.fanpageModel.findById(fanpageId);
    if (!fanpage) {
      this.logger.warn(`Fanpage not found: ${fanpageId}`);
      return;
    }

    // Find or create conversation
    const conv = await this.findOrCreateConversation(
      fanpageId,
      platformUserId,
      customerName,
      adRefParam,
    );

    const normalizedContent = String(content || '').trim();
    const normalizedPlatformMessageId = platformMessageId?.trim();
    const isDuplicatePlatformMessage = Boolean(
      normalizedPlatformMessageId
      && await this.messageModel.exists({
        conversationId: conv._id,
        platformMessageId: normalizedPlatformMessageId,
      }),
    );

    if (normalizedContent && !isDuplicatePlatformMessage) {
      await this.saveMessage(
        conv._id,
        normalizedContent,
        SenderType.CUSTOMER,
        customerName || conv.customerName,
        undefined,
        normalizedPlatformMessageId,
      );
    }

    // Update customer name if provided and not set yet
    if (customerName && !conv.customerName) {
      conv.customerName = customerName;
      await conv.save();
    }

    // AI auto-reply if enabled
    if (
      normalizedContent
      && !isDuplicatePlatformMessage
      && conv.status === ConversationStatus.AI_HANDLING
      && fanpage.aiAutoReplyEnabled
    ) {
      try {
        const aiReply = await this.generateAIReply(conv, fanpage);
        if (aiReply) {
          // Save AI message
          await this.saveMessage(conv._id, aiReply, SenderType.AI, 'AI');

          // Send back to platform
          if (fanpage.pageAccessToken) {
            await this.sendToPlatform(fanpage, platformUserId, aiReply);
          }
        }
      } catch (err: any) {
        this.logger.error(`AI reply failed for conv ${conv.conversationCode}: ${err.message}`);
      }
    }

    // Notify connected staff clients about the updated conversation in real-time
    const updatedConv = await this.conversationModel.findById(conv._id).lean();
    if (updatedConv) {
      this.chatbotGateway.emitConversationUpdated(updatedConv);
    }
  }

  async generateAIReply(conv: ConversationDocument, fanpage: FanpageDocument): Promise<string | null> {
    if (!fanpage.openaiTokenId) {
      this.logger.warn(`No OpenAI token configured for fanpage ${fanpage.fanpageCode}`);
      return null;
    }

    const tokenData = await this.chatbotConfigService.getDecryptedOpenAIKey(fanpage.openaiTokenId);
    if (!tokenData) {
      this.logger.warn(`OpenAI token inactive for fanpage ${fanpage.fanpageCode}`);
      return null;
    }

    // Build system prompt
    const systemPromptParts: string[] = [];
    if (tokenData.systemPromptPrefix?.trim()) {
      systemPromptParts.push(tokenData.systemPromptPrefix.trim());
    }
    systemPromptParts.push(
      `Ban la tu van vien cua fanpage "${fanpage.name}". Hay doc mo ta fanpage va lich su hoi thoai de tra loi khach hang mot cach than thien, chuyen nghiep, dung ngu canh va khong tu suy doan qua muc.`,
    );
    if (fanpage.description?.trim()) {
      systemPromptParts.push(`Mo ta fanpage va quy tac tu van:\n${fanpage.description.trim()}`);
    }
    const systemPrompt = systemPromptParts.join('\n\n');

    // Build conversation context with token budget management.
    // Rough estimate: ~4 chars per token (conservative; works for mixed VN/EN text).
    const MAX_CONTEXT_TOKENS = 7000; // leave ~1000 for the response
    const systemTokenEstimate = Math.ceil(systemPrompt.length / 4);
    let remainingTokenBudget = MAX_CONTEXT_TOKENS - systemTokenEstimate;

    const recentMessages = await this.messageModel
      .find({ conversationId: conv._id })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    // Walk from newest to oldest, include messages that fit within the budget
    const includedMessages: typeof recentMessages = [];
    for (const msg of recentMessages) {
      const tokenEstimate = Math.ceil(msg.content.length / 4) + 4; // +4 for role overhead
      if (remainingTokenBudget - tokenEstimate < 0) break;
      remainingTokenBudget -= tokenEstimate;
      includedMessages.unshift(msg); // keep chronological order
    }

    const messages: Array<{ role: string; content: string }> = [
      { role: 'system', content: systemPrompt },
    ];
    for (const msg of includedMessages) {
      if (msg.senderType === SenderType.CUSTOMER) {
        messages.push({ role: 'user', content: msg.content });
      } else if (msg.senderType === SenderType.AI || msg.senderType === SenderType.HUMAN_AGENT) {
        messages.push({ role: 'assistant', content: msg.content });
      }
    }

    // Call OpenAI with exponential-backoff retry (max 3 attempts)
    const MAX_RETRIES = 3;
    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${tokenData.key}`,
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

          // 401 Unauthorized → mark token expired immediately, do not retry
          if (response.status === 401) {
            await this.chatbotConfigService.markOpenAITokenExpired(fanpage.openaiTokenId);
            throw err;
          }

          // 400 Bad Request → likely token-length issue, do not retry
          if (response.status === 400) {
            throw err;
          }

          // 429 / 5xx → retryable
          lastError = err;
          if (attempt < MAX_RETRIES) {
            const delay = Math.pow(2, attempt) * 500; // 1s, 2s
            this.logger.warn(`OpenAI attempt ${attempt} failed (${response.status}), retrying in ${delay}ms`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
          throw err;
        }

        const result = await response.json() as any;
        return result.choices?.[0]?.message?.content || null;
      } catch (err: any) {
        lastError = err;
        // Non-network errors (e.g. 401, 400 thrown above): propagate immediately
        if (err.message?.includes('401') || err.message?.includes('400')) {
          this.logger.error(`OpenAI permanent error: ${err.message}`);
          throw err;
        }
        if (attempt < MAX_RETRIES) {
          const delay = Math.pow(2, attempt) * 500;
          this.logger.warn(`OpenAI attempt ${attempt} error: ${err.message}, retrying in ${delay}ms`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    this.logger.error(`OpenAI API failed after ${MAX_RETRIES} attempts: ${lastError?.message}`);
    throw lastError!;
  }

  // ─── Platform Messaging ─────────────────────────────────────

  async sendToPlatform(fanpage: FanpageDocument, recipientId: string, text: string) {
    const decryptedToken = this.chatbotConfigService.decryptValue(fanpage.pageAccessToken || '');

    if (fanpage.platform === 'FACEBOOK') {
      await this.sendFacebookMessage(decryptedToken, recipientId, text);
    } else if (fanpage.platform === 'TIKTOK') {
      await this.sendTikTokMessage(decryptedToken, recipientId, text);
    }
  }

  private async sendFacebookMessage(pageAccessToken: string, recipientId: string, text: string) {
    const url = 'https://graph.facebook.com/v25.0/me/messages';
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${pageAccessToken}`,
      },
      body: JSON.stringify({
        recipient: { id: recipientId },
        message: { text },
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`Facebook API error ${response.status}: ${errBody}`);
    }
  }

  private async sendTikTokMessage(accessToken: string, conversationId: string, text: string) {
    const url = 'https://business-api.tiktok.com/open_api/v1.3/im/send_message/';
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Access-Token': accessToken,
      },
      body: JSON.stringify({
        conversation_id: conversationId,
        content: { text },
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`TikTok API error ${response.status}: ${errBody}`);
    }
  }

  // ─── Ad Group Attribution ───────────────────────────────────

  async resolveAdGroup(adRefParam: string, fanpage: any): Promise<{ adGroupId: Types.ObjectId; adGroupName: string } | null> {
    if (!adRefParam) return null;

    const normalizedRef = adRefParam.trim();
    const baseFilter: FilterQuery<AdGroupDocument> = {
      $or: [
        { platformCampaignId: normalizedRef },
        { trackingKeys: normalizedRef },
        { groupCode: normalizedRef },
      ],
    };
    if (fanpage.adAccountId) {
      baseFilter.adAccountId = fanpage.adAccountId;
    }

    let adGroup = await this.adGroupModel.findOne(baseFilter).lean();

    if (!adGroup && fanpage.adAccountId) {
      adGroup = await this.adGroupModel.findOne({
        adAccountId: fanpage.adAccountId,
        name: normalizedRef,
      }).lean();
    }

    if (!adGroup) return null;
    return { adGroupId: adGroup._id as Types.ObjectId, adGroupName: adGroup.name };
  }
}
