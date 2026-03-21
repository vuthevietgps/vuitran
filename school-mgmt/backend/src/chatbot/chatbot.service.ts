import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectModel, InjectConnection } from '@nestjs/mongoose';
import { Model, Types, FilterQuery, Connection } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

import { Fanpage, FanpageDocument, FanpagePlatform, FanpageSyncSource } from './schemas/fanpage.schema';
import { OpenAIToken, OpenAITokenDocument, OpenAITokenStatus } from './schemas/openai-token.schema';
import {
  AiAssistantProfile,
  AiAssistantProfileDocument,
} from './schemas/ai-assistant-profile.schema';
import { Conversation, ConversationDocument, ConversationStatus } from './schemas/conversation.schema';
import { Message, MessageDocument, SenderType, MessageStatus } from './schemas/message.schema';
import { AdGroup, AdGroupDocument } from '../ads/schemas/ad-group.schema';
import { Lead, LeadDocument, LeadStatus } from '../leads/schemas/lead.schema';
import { Order, OrderDocument } from '../orders/schemas/order.schema';
import { User, UserDocument } from '../users/schemas/user.schema';

import { CreateFanpageDto } from './dto/create-fanpage.dto';
import { UpdateFanpageDto } from './dto/update-fanpage.dto';
import { QueryFanpageDto } from './dto/query-fanpage.dto';
import { CreateOpenAITokenDto } from './dto/create-openai-token.dto';
import { UpdateOpenAITokenDto } from './dto/update-openai-token.dto';
import { CreateAiAssistantProfileDto } from './dto/create-ai-assistant-profile.dto';
import { UpdateAiAssistantProfileDto } from './dto/update-ai-assistant-profile.dto';
import { QueryConversationDto } from './dto/query-conversation.dto';
import { UpdateConversationDto } from './dto/update-conversation.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { QueryMessageDto } from './dto/query-message.dto';
import { CreateLeadFromConvDto } from './dto/create-lead-from-conv.dto';
import { CreateOrderFromConvDto } from './dto/create-order-from-conv.dto';

import { AuditLogService } from '../audit-log/audit-log.service';
import { AuditAction } from '../audit-log/schemas/audit-log.schema';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { Role } from '../common/interfaces/role.enum';
import { MarketingAttributionService } from '../marketing-attribution/marketing-attribution.service';
import {
  ParentAttributionModel,
  ParentAttributionSourceType,
} from '../marketing-attribution/schemas/parent-attribution.schema';
import { ChatbotGateway } from './chatbot.gateway';

@Injectable()
export class ChatbotService {
  private readonly logger = new Logger(ChatbotService.name);
  private encryptionKey: Buffer | null = null;

  constructor(
    @InjectModel(Fanpage.name) private fanpageModel: Model<FanpageDocument>,
    @InjectModel(OpenAIToken.name) private openaiTokenModel: Model<OpenAITokenDocument>,
    @InjectModel(AiAssistantProfile.name)
    private aiAssistantProfileModel: Model<AiAssistantProfileDocument>,
    @InjectModel(Conversation.name) private conversationModel: Model<ConversationDocument>,
    @InjectModel(Message.name) private messageModel: Model<MessageDocument>,
    @InjectModel(AdGroup.name) private adGroupModel: Model<AdGroupDocument>,
    @InjectModel(Lead.name) private leadModel: Model<LeadDocument>,
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectConnection() private readonly connection: Connection,
    private configService: ConfigService,
    private auditLogService: AuditLogService,
    private marketingAttributionService: MarketingAttributionService,
    private chatbotGateway: ChatbotGateway,
  ) {
    const key = this.configService.get<string>('TOKEN_ENCRYPTION_KEY');
    if (key) {
      this.encryptionKey = Buffer.from(key, 'hex');
    }
  }

  // ─── Encryption helpers ─────────────────────────────────────

  private getActorId(user: JwtPayload): string {
    return user?.sub ?? user?._id ?? (user as any)?.userId;
  }

  private async findSaleUser(saleId: string | Types.ObjectId): Promise<any> {
    const sale = await this.userModel
      .findOne({ _id: saleId, role: Role.SALE })
      .select('_id fullName email')
      .lean();
    if (!sale) {
      throw new BadRequestException('Sale phu trach khong hop le');
    }
    return sale;
  }

  private async resolveConversationSaleOwner(
    conv: ConversationDocument,
    dto: { saleId?: string },
    user: JwtPayload,
    targetLabel: 'lead' | 'don hang',
  ): Promise<{ saleId: Types.ObjectId; saleName: string }> {
    const actorId = this.getActorId(user);
    if (user.role === Role.SALE) {
      return {
        saleId: new Types.ObjectId(actorId),
        saleName: user.fullName || user.email,
      };
    }

    let lockedOwnerId: string | null = null;
    let lockedOwnerName: string | null = null;

    if (conv.leadId) {
      const lead = await this.leadModel.findById(conv.leadId).select('saleId saleName').lean();
      if (!lead) {
        throw new BadRequestException('Lead lien ket khong ton tai');
      }
      if (lead.saleId) {
        lockedOwnerId = lead.saleId.toString();
        lockedOwnerName = (lead as any).saleName || null;
      }
    }

    if (!lockedOwnerId && conv.assignedAgentId) {
      const assignedSale = await this.userModel
        .findOne({ _id: conv.assignedAgentId, role: Role.SALE })
        .select('_id fullName email')
        .lean();
      if (assignedSale) {
        lockedOwnerId = assignedSale._id.toString();
        lockedOwnerName = assignedSale.fullName || assignedSale.email;
      }
    }

    if (dto.saleId) {
      const requestedSale = await this.findSaleUser(dto.saleId);
      if (lockedOwnerId && requestedSale._id.toString() !== lockedOwnerId) {
        throw new BadRequestException(
          targetLabel === 'lead'
            ? 'Hoi thoai da gan cho sale khac. Hay chuyen owner truoc khi tao lead'
            : 'Hoi thoai/lead da gan cho sale khac. Hay chuyen owner truoc khi tao don',
        );
      }
      return {
        saleId: requestedSale._id as Types.ObjectId,
        saleName: requestedSale.fullName || requestedSale.email,
      };
    }

    if (lockedOwnerId) {
      if (lockedOwnerName) {
        return {
          saleId: new Types.ObjectId(lockedOwnerId),
          saleName: lockedOwnerName,
        };
      }
      const inferredSale = await this.findSaleUser(lockedOwnerId);
      return {
        saleId: inferredSale._id as Types.ObjectId,
        saleName: inferredSale.fullName || inferredSale.email,
      };
    }

    throw new BadRequestException(
      targetLabel === 'lead'
        ? 'Phai chon sale phu trach cho lead'
        : 'Phai chon sale phu trach cho don hang',
    );
  }

  private encrypt(plainText: string): string {
    if (!this.encryptionKey) return plainText;
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    let encrypted = cipher.update(plainText, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
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

  private maskToken(token: string): string {
    if (token.length <= 8) return '****';
    return '****' + token.slice(-6);
  }

  private mapFanpageForResponse(fp: any) {
    const openAIToken = fp?.openaiTokenId && typeof fp.openaiTokenId === 'object'
      ? fp.openaiTokenId
      : null;

    return {
      ...fp,
      openaiTokenId: openAIToken?._id ? openAIToken._id.toString() : fp.openaiTokenId,
      openaiTokenLabel: openAIToken?.label,
      openaiModel: openAIToken?.model,
      pageAccessToken: fp.pageAccessToken ? this.maskToken(fp.pageAccessToken) : undefined,
      appSecret: fp.appSecret ? this.maskToken(fp.appSecret) : undefined,
    };
  }

  private mapAiAssistantProfileForResponse(profile: any) {
    const defaultToken = profile?.defaultOpenAITokenId
      && typeof profile.defaultOpenAITokenId === 'object'
      ? profile.defaultOpenAITokenId
      : null;

    return {
      ...profile,
      defaultOpenAITokenId: defaultToken?._id
        ? defaultToken._id.toString()
        : profile.defaultOpenAITokenId,
      defaultOpenAITokenLabel: defaultToken?.label,
      defaultOpenAIModel: defaultToken?.model,
    };
  }

  // ─── Fanpage CRUD ───────────────────────────────────────────

  private async generateFanpageCode(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `FP-${year}-`;
    for (let attempt = 0; attempt < 5; attempt++) {
      const count = await this.fanpageModel.countDocuments({ fanpageCode: { $regex: `^${prefix}` } });
      const code = `${prefix}${String(count + 1 + attempt).padStart(4, '0')}`;
      const exists = await this.fanpageModel.exists({ fanpageCode: code });
      if (!exists) return code;
    }
    return `${prefix}${Date.now()}`;
  }

  async createFanpage(dto: CreateFanpageDto, user: JwtPayload) {
    const fanpageCode = await this.generateFanpageCode();

    let adAccountName: string | undefined;
    if (dto.adAccountId) {
      const acc = await this.adGroupModel.db.model('AdAccount').findById(dto.adAccountId).lean() as any;
      adAccountName = acc?.name;
    }

    const data: any = {
      ...dto,
      fanpageCode,
      adAccountName,
      createdById: user.sub,
      createdByName: user.fullName,
    };

    if (dto.pageAccessToken) data.pageAccessToken = this.encrypt(dto.pageAccessToken);
    if (dto.appSecret) data.appSecret = this.encrypt(dto.appSecret);

    const doc = new this.fanpageModel(data);
    const saved = await doc.save();

    await this.auditLogService.log({
      userId: user.sub,
      userEmail: user.email,
      userFullName: user.fullName,
      userRole: user.role,
      action: AuditAction.CREATE,
      module: 'CHATBOT' as any,
      targetId: saved._id?.toString(),
      targetName: saved.fanpageCode,
      description: `Tạo fanpage: ${saved.name} (${saved.platform})`,
    });

    return saved;
  }

  async findAllFanpages(query: QueryFanpageDto) {
    const filter: FilterQuery<FanpageDocument> = {};
    if (query.platform) filter.platform = query.platform;
    if (query.status) filter.status = query.status;
    if (query.search) {
      filter.$or = [
        { name: { $regex: query.search, $options: 'i' } },
        { fanpageCode: { $regex: query.search, $options: 'i' } },
        { pageId: { $regex: query.search, $options: 'i' } },
      ];
    }

    const page = parseInt(query.page || '1', 10);
    const limit = parseInt(query.limit || '20', 10);
    const skip = (page - 1) * limit;
    const total = await this.fanpageModel.countDocuments(filter);
    const data = await this.fanpageModel.find(filter)
      .populate({ path: 'openaiTokenId', select: 'label model' })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const masked = data.map((fp) => this.mapFanpageForResponse(fp));

    return { data: masked, total, page, limit };
  }

  async findOneFanpage(id: string) {
    const fp = await this.fanpageModel.findById(id)
      .populate({ path: 'openaiTokenId', select: 'label model' })
      .lean();
    if (!fp) throw new NotFoundException('Fanpage không tồn tại');
    return this.mapFanpageForResponse(fp);
  }

  async updateFanpage(id: string, dto: UpdateFanpageDto) {
    const current = await this.fanpageModel.findById(id).lean();
    if (!current) throw new NotFoundException('Fanpage khÃ´ng tá»“n táº¡i');

    const isSyncedFacebookFanpage = current.syncSource === FanpageSyncSource.FACEBOOK_BM
      && current.platform === FanpagePlatform.FACEBOOK;

    const update: any = {};
    const unset: Record<string, 1> = {};

    if (!isSyncedFacebookFanpage && dto.name !== undefined) {
      const name = dto.name.trim();
      if (name) update.name = name;
    }

    if (!isSyncedFacebookFanpage && dto.pageId !== undefined) {
      const pageId = dto.pageId.trim();
      if (pageId) update.pageId = pageId;
    }

    if (!isSyncedFacebookFanpage && dto.pageAccessToken !== undefined) {
      const pageAccessToken = dto.pageAccessToken.trim();
      if (pageAccessToken) update.pageAccessToken = this.encrypt(pageAccessToken);
      else unset.pageAccessToken = 1;
    }

    if (dto.description !== undefined) {
      const description = dto.description.trim();
      if (description) update.description = description;
      else unset.description = 1;
    }

    if (dto.adAccountId !== undefined) {
      const adAccountId = dto.adAccountId.trim();
      if (adAccountId) {
        update.adAccountId = adAccountId;
        const acc = await this.adGroupModel.db.model('AdAccount').findById(adAccountId).lean() as any;
        update.adAccountName = acc?.name;
      } else {
        unset.adAccountId = 1;
        unset.adAccountName = 1;
      }
    }

    if (dto.webhookVerifyToken !== undefined) {
      const webhookVerifyToken = dto.webhookVerifyToken.trim();
      if (webhookVerifyToken) update.webhookVerifyToken = webhookVerifyToken;
      else unset.webhookVerifyToken = 1;
    }

    if (dto.appSecret !== undefined) {
      const appSecret = dto.appSecret.trim();
      if (appSecret) update.appSecret = this.encrypt(appSecret);
      else unset.appSecret = 1;
    }

    if (dto.openaiTokenId !== undefined) {
      const openaiTokenId = dto.openaiTokenId.trim();
      if (openaiTokenId) update.openaiTokenId = openaiTokenId;
      else unset.openaiTokenId = 1;
    }

    if (dto.aiAutoReplyEnabled !== undefined) {
      update.aiAutoReplyEnabled = dto.aiAutoReplyEnabled;
    }

    if (dto.status !== undefined) {
      update.status = dto.status;
    }

    const updateDoc: any = {};
    if (Object.keys(update).length) updateDoc.$set = update;
    if (Object.keys(unset).length) updateDoc.$unset = unset;

    const doc = await this.fanpageModel.findByIdAndUpdate(id, updateDoc, { new: true });
    if (!doc) throw new NotFoundException('Fanpage không tồn tại');
    return doc;
  }

  async deleteFanpage(id: string) {
    const doc = await this.fanpageModel.findByIdAndDelete(id);
    if (!doc) throw new NotFoundException('Fanpage không tồn tại');
  }

  // ─── OpenAI Token CRUD ──────────────────────────────────────

  async createOpenAIToken(dto: CreateOpenAITokenDto, user: JwtPayload) {
    const data: any = {
      ...dto,
      apiKey: this.encrypt(dto.apiKey),
      createdById: user.sub,
    };

    const doc = new this.openaiTokenModel(data);
    const saved = await doc.save();

    await this.auditLogService.log({
      userId: user.sub,
      userEmail: user.email,
      userFullName: user.fullName,
      userRole: user.role,
      action: AuditAction.CREATE,
      module: 'CHATBOT' as any,
      targetId: saved._id?.toString(),
      targetName: saved.label,
      description: `Tạo OpenAI token: ${saved.label}`,
    });

    return { ...saved.toObject(), apiKey: this.maskToken(saved.apiKey) };
  }

  async findAllOpenAITokens() {
    const tokens = await this.openaiTokenModel.find().sort({ createdAt: -1 }).lean();
    return tokens.map(t => ({
      ...t,
      apiKey: this.maskToken(t.apiKey),
    }));
  }

  async updateOpenAIToken(id: string, dto: UpdateOpenAITokenDto) {
    const update: any = { ...dto };
    if (dto.apiKey) update.apiKey = this.encrypt(dto.apiKey);

    const doc = await this.openaiTokenModel.findByIdAndUpdate(id, update, { new: true });
    if (!doc) throw new NotFoundException('OpenAI token không tồn tại');
    return { ...doc.toObject(), apiKey: this.maskToken(doc.apiKey) };
  }

  async deleteOpenAIToken(id: string) {
    const doc = await this.openaiTokenModel.findByIdAndDelete(id);
    if (!doc) throw new NotFoundException('OpenAI token không tồn tại');
  }

  async createAiAssistantProfile(dto: CreateAiAssistantProfileDto, user: JwtPayload) {
    const existing = await this.aiAssistantProfileModel.findOne({
      assistantType: dto.assistantType,
    });
    if (existing) {
      throw new BadRequestException('Loai AI nay da co profile cau hinh');
    }

    let defaultOpenAITokenId: Types.ObjectId | undefined;
    if (dto.defaultOpenAITokenId?.trim()) {
      if (!Types.ObjectId.isValid(dto.defaultOpenAITokenId)) {
        throw new BadRequestException('defaultOpenAITokenId khong hop le');
      }
      defaultOpenAITokenId = new Types.ObjectId(dto.defaultOpenAITokenId);
    }

    const doc = new this.aiAssistantProfileModel({
      assistantType: dto.assistantType,
      label: dto.label.trim(),
      description: dto.description?.trim() || undefined,
      rulesPrompt: dto.rulesPrompt?.trim() || undefined,
      defaultOpenAITokenId,
      status: dto.status,
      createdById: user.sub,
    });

    const saved = await doc.save();

    await this.auditLogService.log({
      userId: user.sub,
      userEmail: user.email,
      userFullName: user.fullName,
      userRole: user.role,
      action: AuditAction.CREATE,
      module: 'CHATBOT' as any,
      targetId: saved._id?.toString(),
      targetName: saved.label,
      description: `Tao AI assistant profile: ${saved.assistantType}`,
    });

    return this.mapAiAssistantProfileForResponse(saved.toObject());
  }

  async findAllAiAssistantProfiles() {
    const profiles = await this.aiAssistantProfileModel
      .find()
      .populate({ path: 'defaultOpenAITokenId', select: 'label model' })
      .sort({ assistantType: 1 })
      .lean();

    return profiles.map((profile) => this.mapAiAssistantProfileForResponse(profile));
  }

  async updateAiAssistantProfile(id: string, dto: UpdateAiAssistantProfileDto) {
    const current = await this.aiAssistantProfileModel.findById(id).lean();
    if (!current) throw new NotFoundException('AI assistant profile khong ton tai');

    if (dto.assistantType && dto.assistantType !== current.assistantType) {
      const existing = await this.aiAssistantProfileModel.findOne({
        assistantType: dto.assistantType,
        _id: { $ne: current._id },
      });
      if (existing) {
        throw new BadRequestException('Loai AI nay da co profile cau hinh');
      }
    }

    const update: any = {};
    const unset: Record<string, 1> = {};

    if (dto.assistantType !== undefined) update.assistantType = dto.assistantType;
    if (dto.label !== undefined) update.label = dto.label.trim();
    if (dto.description !== undefined) {
      const description = dto.description.trim();
      if (description) update.description = description;
      else unset.description = 1;
    }
    if (dto.rulesPrompt !== undefined) {
      const rulesPrompt = dto.rulesPrompt.trim();
      if (rulesPrompt) update.rulesPrompt = rulesPrompt;
      else unset.rulesPrompt = 1;
    }
    if (dto.defaultOpenAITokenId !== undefined) {
      const tokenId = dto.defaultOpenAITokenId.trim();
      if (!tokenId) {
        unset.defaultOpenAITokenId = 1;
      } else {
        if (!Types.ObjectId.isValid(tokenId)) {
          throw new BadRequestException('defaultOpenAITokenId khong hop le');
        }
        update.defaultOpenAITokenId = new Types.ObjectId(tokenId);
      }
    }
    if (dto.status !== undefined) update.status = dto.status;

    const updateDoc: any = {};
    if (Object.keys(update).length) updateDoc.$set = update;
    if (Object.keys(unset).length) updateDoc.$unset = unset;

    const doc = await this.aiAssistantProfileModel
      .findByIdAndUpdate(id, updateDoc, { new: true })
      .populate({ path: 'defaultOpenAITokenId', select: 'label model' });
    if (!doc) throw new NotFoundException('AI assistant profile khong ton tai');

    return this.mapAiAssistantProfileForResponse(doc.toObject());
  }

  async deleteAiAssistantProfile(id: string) {
    const doc = await this.aiAssistantProfileModel.findByIdAndDelete(id);
    if (!doc) throw new NotFoundException('AI assistant profile khong ton tai');
  }

  async getDecryptedOpenAIKey(tokenId: string | Types.ObjectId): Promise<{
    key: string; model: string; temperature: number; maxTokens: number; systemPromptPrefix?: string;
  } | null> {
    const token = await this.openaiTokenModel.findById(tokenId);
    if (!token || token.status !== OpenAITokenStatus.ACTIVE) return null;

    await this.openaiTokenModel.updateOne({ _id: token._id }, { lastUsedAt: new Date() });

    return {
      key: this.decrypt(token.apiKey),
      model: token.model,
      temperature: token.temperature ?? 0.7,
      maxTokens: token.maxTokens ?? 2000,
      systemPromptPrefix: token.systemPromptPrefix,
    };
  }

  // ─── Conversation Management ────────────────────────────────

  private async generateConversationCode(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `CONV-${year}-`;
    for (let attempt = 0; attempt < 5; attempt++) {
      const count = await this.conversationModel.countDocuments({ conversationCode: { $regex: `^${prefix}` } });
      const code = `${prefix}${String(count + 1 + attempt).padStart(5, '0')}`;
      const exists = await this.conversationModel.exists({ conversationCode: code });
      if (!exists) return code;
    }
    return `${prefix}${Date.now()}`;
  }

  async findOrCreateConversation(
    fanpageId: string,
    platformUserId: string,
    customerName?: string,
    adRefParam?: string,
  ): Promise<ConversationDocument> {
    let conv = await this.conversationModel.findOne({
      fanpageId: new Types.ObjectId(fanpageId),
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
        if (!fanpage) throw new NotFoundException('Fanpage khÃ´ng tá»“n táº¡i');

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

    const conversationCode = await this.generateConversationCode();

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

    conv = new this.conversationModel({
      conversationCode,
      fanpageId: new Types.ObjectId(fanpageId),
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
    });

    return conv.save();
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

    const page = parseInt(query.page || '1', 10);
    const limit = parseInt(query.limit || '20', 10);
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
    const msg = new this.messageModel({
      conversationId: new Types.ObjectId(conversationId.toString()),
      senderType,
      senderName,
      senderUserId: senderUserId ? new Types.ObjectId(senderUserId) : undefined,
      content,
      platformMessageId,
      status: MessageStatus.SENT,
    });
    const saved = await msg.save();

    // Update conversation
    await this.conversationModel.updateOne(
      { _id: new Types.ObjectId(conversationId.toString()) },
      { lastMessageAt: new Date(), $inc: { messageCount: 1 } },
    );

    // Push the new message to all staff clients watching this conversation via WebSocket
    this.chatbotGateway.emitNewMessage(conversationId.toString(), saved.toObject());

    return saved;
  }

  async getMessages(conversationId: string, query: QueryMessageDto) {
    const page = parseInt(query.page || '1', 10);
    const limit = parseInt(query.limit || '50', 10);
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
    if (normalizedContent) {
      await this.saveMessage(
        conv._id,
        normalizedContent,
        SenderType.CUSTOMER,
        customerName || conv.customerName,
        undefined,
        platformMessageId,
      );
    }

    // Update customer name if provided and not set yet
    if (customerName && !conv.customerName) {
      conv.customerName = customerName;
      await conv.save();
    }

    // AI auto-reply if enabled
    if (normalizedContent && conv.status === ConversationStatus.AI_HANDLING && fanpage.aiAutoReplyEnabled) {
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

    const tokenData = await this.getDecryptedOpenAIKey(fanpage.openaiTokenId);
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

          // 401 Unauthorized → mark token expired immediately, do not retry
          if (response.status === 401) {
            await this.openaiTokenModel.updateOne(
              { _id: fanpage.openaiTokenId },
              { status: OpenAITokenStatus.EXPIRED },
            );
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
    const decryptedToken = this.decrypt(fanpage.pageAccessToken || '');

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

  // ─── Lead/Order Creation from Conversation ──────────────────

  async createLeadFromConversation(conversationId: string, dto: CreateLeadFromConvDto, user: JwtPayload) {
    const conv = await this.conversationModel.findById(conversationId);
    if (!conv) throw new NotFoundException('Hội thoại không tồn tại');

    if (conv.leadId) {
      throw new BadRequestException('Hội thoại này đã có lead');
    }

    const saleOwner = await this.resolveConversationSaleOwner(conv, dto, user, 'lead');

    // Generate lead code outside transaction (read-only, race-safe via the unique index)
    const year = new Date().getFullYear();
    const prefix = `LEAD-${year}-`;
    const last = await this.leadModel
      .findOne({ leadCode: { $regex: `^${prefix}` } })
      .sort({ leadCode: -1 })
      .lean();
    let nextNum = 1;
    if (last) {
      const parts = last.leadCode.split('-');
      nextNum = parseInt(parts[2], 10) + 1;
    }
    const leadCode = `${prefix}${String(nextNum).padStart(4, '0')}`;

    const sourceMap: Record<string, string> = { FACEBOOK: 'FACEBOOK', TIKTOK: 'TIKTOK' };

    const mongoSession = await this.connection.startSession();
    let saved: LeadDocument;
    try {
      await mongoSession.withTransaction(async () => {
        const lead = new this.leadModel({
          leadCode,
          parentName: dto.parentName,
          parentPhone: dto.parentPhone,
          parentEmail: dto.parentEmail,
          studentName: dto.studentName,
          interestedSubjects: dto.interestedSubjects,
          source: sourceMap[conv.platform] || 'OTHER',
          adGroupId: conv.adGroupId,
          adGroupName: conv.adGroupName,
          saleId: saleOwner.saleId,
          saleName: saleOwner.saleName,
          assignedAt: new Date(),
          status: LeadStatus.NEW,
          notes: dto.notes,
          assignmentHistory: [{
            saleId: saleOwner.saleId,
            saleName: saleOwner.saleName,
            assignedAt: new Date(),
          }],
        });

        saved = await lead.save({ session: mongoSession });

        // Link lead to conversation atomically
        conv.leadId = saved._id as Types.ObjectId;
        conv.customerName = dto.parentName;
        conv.customerPhone = dto.parentPhone;
        await conv.save({ session: mongoSession });

        await this.marketingAttributionService.upsertParentAttribution({
          parentPhone: dto.parentPhone,
          adGroupId: conv.adGroupId,
          adGroupName: conv.adGroupName,
          platform: conv.platform,
          adRefParam: conv.adRefParam,
          sourceConversationId: conv._id,
          sourceLeadId: saved._id,
          sourceType: ParentAttributionSourceType.LEAD,
        }, mongoSession);
      });
    } finally {
      await mongoSession.endSession();
    }

    // Audit log is intentionally outside the transaction — it must never
    // roll back a successful Lead creation.
    await this.auditLogService.log({
      userId: user.sub,
      userEmail: user.email,
      userFullName: user.fullName,
      userRole: user.role,
      action: AuditAction.CREATE,
      module: 'LEADS' as any,
      targetId: saved!._id?.toString(),
      targetName: saved!.leadCode,
      description: `Tạo lead từ hội thoại ${conv.conversationCode}: ${saved!.parentName} - ${saved!.parentPhone}`,
    });

    return saved!;
  }

  async createOrderFromConversation(conversationId: string, dto: CreateOrderFromConvDto, user: JwtPayload) {
    const conv = await this.conversationModel.findById(conversationId);
    if (!conv) throw new NotFoundException('Hội thoại không tồn tại');

    if (conv.orderId) {
      throw new BadRequestException('Hội thoại này đã có đơn hàng');
    }

    const saleOwner = await this.resolveConversationSaleOwner(conv, dto, user, 'don hang');

    // Generate order code outside transaction (read-only)
    const year = new Date().getFullYear();
    const prefix = `ORD-${year}-`;
    const last = await this.orderModel
      .findOne({ orderCode: { $regex: `^${prefix}` } })
      .sort({ orderCode: -1 })
      .lean();
    let nextNum = 1;
    if (last) {
      const parts = (last as any).orderCode.split('-');
      nextNum = parseInt(parts[2], 10) + 1;
    }
    const orderCode = `${prefix}${String(nextNum).padStart(4, '0')}`;

    const sourceMap: Record<string, string> = { FACEBOOK: 'FACEBOOK', TIKTOK: 'TIKTOK' };

    const items = dto.items.map(item => ({
      productId: new Types.ObjectId(item.productId),
      productName: item.productName,
      sessions: item.quantity,
      sessionDuration: 90,
      pricePerSession: item.unitPrice,
      amount: item.quantity * item.unitPrice,
    }));
    const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);
    const discountAmount = dto.discountAmount || 0;
    const finalAmount = totalAmount - discountAmount;

    const mongoSession = await this.connection.startSession();
    let saved: any;
    try {
      await mongoSession.withTransaction(async () => {
        const order = new this.orderModel({
          orderCode,
          orderType: dto.orderType || 'NEW_ENROLLMENT',
          parentName: dto.parentName,
          parentPhone: dto.parentPhone,
          studentName: dto.studentName,
          leadSource: sourceMap[conv.platform] || 'OTHER',
          leadId: conv.leadId,
          adGroupId: conv.adGroupId,
          adGroupName: conv.adGroupName,
          items,
          totalAmount,
          discountAmount,
          discountReason: dto.discountReason,
          finalAmount,
          paymentPlan: dto.paymentPlan || 'FULL',
          status: 'DRAFT',
          saleId: saleOwner.saleId,
          saleName: saleOwner.saleName,
          notes: dto.notes,
        });

        saved = await order.save({ session: mongoSession });

        // Link order to conversation atomically
        conv.orderId = saved._id as Types.ObjectId;
        conv.customerName = dto.parentName;
        conv.customerPhone = dto.parentPhone;
        await conv.save({ session: mongoSession });

        await this.marketingAttributionService.upsertParentAttribution({
          parentPhone: dto.parentPhone,
          adGroupId: saved.adGroupId,
          adGroupName: saved.adGroupName,
          platform: conv.platform,
          adRefParam: conv.adRefParam,
          sourceConversationId: conv._id,
          sourceLeadId: conv.leadId,
          sourceOrderId: saved._id,
          sourceType: ParentAttributionSourceType.ORDER,
        }, mongoSession);
      });
    } finally {
      await mongoSession.endSession();
    }

    // Audit log outside transaction — must not roll back a successful Order creation.
    await this.auditLogService.log({
      userId: user.sub,
      userEmail: user.email,
      userFullName: user.fullName,
      userRole: user.role,
      action: AuditAction.CREATE,
      module: 'ORDERS' as any,
      targetId: saved._id?.toString(),
      targetName: saved.orderCode,
      description: `Tạo đơn hàng từ hội thoại ${conv.conversationCode}: ${dto.parentName} - ${dto.parentPhone}`,
    });

    return saved;
  }

  // ─── Internal helpers for webhook ───────────────────────────

  async findFanpageByPageId(pageId: string): Promise<FanpageDocument | null> {
    return this.fanpageModel.findOne({ pageId });
  }

  getDecryptedAppSecret(fanpage: FanpageDocument): string {
    return fanpage.appSecret ? this.decrypt(fanpage.appSecret) : '';
  }
}
