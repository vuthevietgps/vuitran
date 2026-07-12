import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, FilterQuery } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

import { Fanpage, FanpageDocument, FanpagePlatform, FanpageSyncSource } from './schemas/fanpage.schema';
import { OpenAIToken, OpenAITokenDocument, OpenAITokenStatus } from './schemas/openai-token.schema';
import {
  AiAssistantProfile,
  AiAssistantProfileDocument,
} from './schemas/ai-assistant-profile.schema';
import { AdGroup, AdGroupDocument } from '../ads/schemas/ad-group.schema';

import { CreateFanpageDto } from './dto/create-fanpage.dto';
import { UpdateFanpageDto } from './dto/update-fanpage.dto';
import { QueryFanpageDto } from './dto/query-fanpage.dto';
import { CreateOpenAITokenDto } from './dto/create-openai-token.dto';
import { UpdateOpenAITokenDto } from './dto/update-openai-token.dto';
import { CreateAiAssistantProfileDto } from './dto/create-ai-assistant-profile.dto';
import { UpdateAiAssistantProfileDto } from './dto/update-ai-assistant-profile.dto';

import { AuditLogService } from '../audit-log/audit-log.service';
import { AuditAction, AuditModule } from '../audit-log/schemas/audit-log.schema';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { extractOpenAIApiKey } from '../common/utils/openai-api-key';

@Injectable()
export class ChatbotConfigService {
  private readonly logger = new Logger(ChatbotConfigService.name);
  private encryptionKey: Buffer | null = null;

  constructor(
    @InjectModel(Fanpage.name) private fanpageModel: Model<FanpageDocument>,
    @InjectModel(OpenAIToken.name) private openaiTokenModel: Model<OpenAITokenDocument>,
    @InjectModel(AiAssistantProfile.name)
    private aiAssistantProfileModel: Model<AiAssistantProfileDocument>,
    @InjectModel(AdGroup.name) private adGroupModel: Model<AdGroupDocument>,
    private configService: ConfigService,
    private auditLogService: AuditLogService,
  ) {
    const key = this.configService.get<string>('TOKEN_ENCRYPTION_KEY');
    if (key) {
      this.encryptionKey = Buffer.from(key, 'hex');
    }
  }

  // ─── Encryption helpers ─────────────────────────────────────

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

  decryptValue(cipherText: string): string {
    return this.decrypt(cipherText);
  }

  private maskToken(token: string): string {
    if (token.length <= 8) return '****';
    return '****' + token.slice(-6);
  }

  private normalizeOpenAIApiKey(input: string): string {
    const key = extractOpenAIApiKey(input);
    if (!key) {
      throw new BadRequestException('API key OpenAI khong hop le. Hay dan dung chuoi bat dau bang sk-...');
    }
    return key;
  }

  private async resolveActiveOpenAITokenId(tokenId: string, fieldName: string): Promise<Types.ObjectId> {
    if (!Types.ObjectId.isValid(tokenId)) {
      throw new BadRequestException(`${fieldName} khong hop le`);
    }

    const token = await this.openaiTokenModel
      .findById(tokenId)
      .select('_id status')
      .lean<{ _id: Types.ObjectId; status: OpenAITokenStatus } | null>();
    if (!token) {
      throw new BadRequestException(`${fieldName} khong ton tai`);
    }
    if (token.status !== OpenAITokenStatus.ACTIVE) {
      throw new BadRequestException(`${fieldName} phai tro toi OpenAI token ACTIVE`);
    }

    return new Types.ObjectId(tokenId);
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
    if (dto.openaiTokenId?.trim()) {
      data.openaiTokenId = await this.resolveActiveOpenAITokenId(dto.openaiTokenId, 'openaiTokenId');
    } else {
      delete data.openaiTokenId;
    }

    const doc = new this.fanpageModel(data);
    const saved = await doc.save();

    await this.auditLogService.log({
      userId: user.sub,
      userEmail: user.email,
      userFullName: user.fullName,
      userRole: user.role,
      action: AuditAction.CREATE,
      module: AuditModule.CHATBOT,
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
    if (!current) throw new NotFoundException('Fanpage không tồn tại');

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
      if (openaiTokenId) update.openaiTokenId = await this.resolveActiveOpenAITokenId(openaiTokenId, 'openaiTokenId');
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
    const apiKey = this.normalizeOpenAIApiKey(dto.apiKey);
    const data: any = {
      ...dto,
      apiKey: this.encrypt(apiKey),
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
      module: AuditModule.CHATBOT,
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
    if (dto.apiKey !== undefined) {
      delete update.apiKey;
      const input = dto.apiKey.trim();
      if (input) update.apiKey = this.encrypt(this.normalizeOpenAIApiKey(input));
    }

    const doc = await this.openaiTokenModel.findByIdAndUpdate(id, update, { new: true });
    if (!doc) throw new NotFoundException('OpenAI token không tồn tại');
    return { ...doc.toObject(), apiKey: this.maskToken(doc.apiKey) };
  }

  async deleteOpenAIToken(id: string) {
    const doc = await this.openaiTokenModel.findByIdAndDelete(id);
    if (!doc) throw new NotFoundException('OpenAI token không tồn tại');
  }

  // ─── AI Assistant Profile CRUD ──────────────────────────────

  async createAiAssistantProfile(dto: CreateAiAssistantProfileDto, user: JwtPayload) {
    const existing = await this.aiAssistantProfileModel.findOne({
      assistantType: dto.assistantType,
    });
    if (existing) {
      throw new BadRequestException('Loai AI nay da co profile cau hinh');
    }

    let defaultOpenAITokenId: Types.ObjectId | undefined;
    if (dto.defaultOpenAITokenId?.trim()) {
      defaultOpenAITokenId = await this.resolveActiveOpenAITokenId(
        dto.defaultOpenAITokenId,
        'defaultOpenAITokenId',
      );
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
      module: AuditModule.CHATBOT,
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
        update.defaultOpenAITokenId = await this.resolveActiveOpenAITokenId(tokenId, 'defaultOpenAITokenId');
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

  // ─── OpenAI Key Management ─────────────────────────────────

  async getDecryptedOpenAIKey(tokenId: string | Types.ObjectId): Promise<{
    key: string; model: string; temperature: number; maxTokens: number; systemPromptPrefix?: string;
  } | null> {
    const token = await this.openaiTokenModel.findById(tokenId);
    if (!token || token.status !== OpenAITokenStatus.ACTIVE) return null;

    const decryptedKey = this.decrypt(token.apiKey);
    const normalizedKey = extractOpenAIApiKey(decryptedKey);
    if (!normalizedKey) {
      this.logger.warn(`OpenAI token ${token._id?.toString()} does not contain a valid sk- API key`);
      return null;
    }

    const tokenUpdate: Record<string, any> = { lastUsedAt: new Date() };
    if (normalizedKey !== decryptedKey) {
      tokenUpdate.apiKey = this.encrypt(normalizedKey);
    }
    await this.openaiTokenModel.updateOne({ _id: token._id }, tokenUpdate);

    return {
      key: normalizedKey,
      model: token.model,
      temperature: token.temperature ?? 0.7,
      maxTokens: token.maxTokens ?? 2000,
      systemPromptPrefix: token.systemPromptPrefix,
    };
  }

  async markOpenAITokenExpired(tokenId: string | Types.ObjectId): Promise<void> {
    await this.openaiTokenModel.updateOne(
      { _id: tokenId },
      { status: OpenAITokenStatus.EXPIRED },
    );
  }

  // ─── Fanpage lookup helpers ─────────────────────────────────

  async findFanpageByPageId(pageId: string): Promise<FanpageDocument | null> {
    return this.fanpageModel.findOne({ pageId });
  }

  getDecryptedAppSecret(fanpage: FanpageDocument): string {
    return fanpage.appSecret ? this.decrypt(fanpage.appSecret) : '';
  }
}
