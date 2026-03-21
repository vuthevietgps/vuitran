import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import * as crypto from 'crypto';

import {
  AdAccount,
  AdAccountDocument,
  AdAccountStatus,
  AdAccountSyncSource,
} from './schemas/ad-account.schema';
import {
  AdGroup,
  AdGroupDocument,
  AdGroupStatus,
  AdGroupSyncSource,
} from './schemas/ad-group.schema';
import {
  ApiToken,
  ApiTokenDocument,
  ApiTokenStatus,
  ApiTokenType,
} from './schemas/api-token.schema';
import { AdCost, AdCostDocument, AdCostSource } from './schemas/ad-cost.schema';

import { CreateAdAccountDto } from './dto/create-ad-account.dto';
import { UpdateAdAccountDto } from './dto/update-ad-account.dto';
import { QueryAdAccountDto } from './dto/query-ad-account.dto';
import { CreateAdGroupDto } from './dto/create-ad-group.dto';
import { UpdateAdGroupDto } from './dto/update-ad-group.dto';
import { QueryAdGroupDto } from './dto/query-ad-group.dto';
import { CreateApiTokenDto } from './dto/create-api-token.dto';
import { UpdateApiTokenDto } from './dto/update-api-token.dto';
import { CreateAdCostDto } from './dto/create-ad-cost.dto';
import { QueryAdCostDto } from './dto/query-ad-cost.dto';

import { Order, OrderDocument } from '../orders/schemas/order.schema';
import { Lead, LeadDocument } from '../leads/schemas/lead.schema';
import { Session, SessionDocument, SessionStatus } from '../sessions/schemas/session.schema';
import { Expense, ExpenseDocument, PaymentStatus } from '../expenses/schemas/expense.schema';
import { Student, StudentDocument } from '../students/schemas/student.schema';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import {
  Fanpage,
  FanpageDocument,
  FanpagePlatform,
  FanpageStatus,
  FanpageSyncSource,
} from '../chatbot/schemas/fanpage.schema';
import {
  Invoice,
  InvoiceDocument,
  InvoiceStatus,
} from '../invoices/schemas/invoice.schema';
import {
  ParentAttribution,
  ParentAttributionDocument,
} from '../marketing-attribution/schemas/parent-attribution.schema';
import { GoogleAdsProvider } from './platforms/google-ads.service';
import { TikTokAdsProvider } from './platforms/tiktok-ads.service';

type NetProfitDailyRow = {
  date: string;
  adGroupId: string;
  adGroupName: string;
  platform: string;
  sessionCount: number;
  revenue: number;
  teacherCost: number;
  grossProfit: number;
  totalExpenseOfDay: number;
  totalSessionsOfDay: number;
  overheadPerSession: number;
  allocatedOverhead: number;
  adSpend: number;
  netProfit: number;
  netMargin: number;
};

type SuggestionModel = {
  adGroupId: string;
  adGroupName: string;
  platform: string;
  currentDailySpend: number;
  suggestedDailySpend: number;
  expectedDailyNetProfit: number | null;
  expectedDailyMarginalProfit: number | null;
  changePercent: number | null;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  dataPoints: number;
  coeffA: number | null;
  coeffB: number | null;
};

type FacebookBusinessRef = {
  id: string;
  name?: string;
};

type FacebookAdAccountRow = {
  id?: string;
  account_id?: string;
  name?: string;
  account_status?: number | string;
  currency?: string;
  business?: { id?: string; name?: string };
};

type FacebookPageRow = {
  id?: string;
  name?: string;
  access_token?: string;
  link?: string;
};

type FacebookAdsetRow = {
  id?: string;
  name?: string;
  effective_status?: string;
  daily_budget?: string;
  start_time?: string;
  end_time?: string;
};

type FacebookInsightRow = {
  adset_id?: string;
  adset_name?: string;
  spend?: string;
  impressions?: string;
  clicks?: string;
  actions?: Array<{ action_type?: string; value?: string | number }>;
};

type FacebookBusinessSyncResult = {
  synced: number;
  adAccountsSynced: number;
  adGroupsSynced: number;
  fanpagesSynced: number;
  errors: string[];
};

@Injectable()
export class AdsService {
  private readonly logger = new Logger(AdsService.name);
  private encryptionKey: Buffer | null = null;
  private readonly maxAnalyticsRangeDays = 366;
  private readonly maxSuggestionRangeDays = 180;

  constructor(
    @InjectModel(AdAccount.name) private adAccountModel: Model<AdAccountDocument>,
    @InjectModel(AdGroup.name) private adGroupModel: Model<AdGroupDocument>,
    @InjectModel(ApiToken.name) private apiTokenModel: Model<ApiTokenDocument>,
    @InjectModel(AdCost.name) private adCostModel: Model<AdCostDocument>,
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    @InjectModel(Lead.name) private leadModel: Model<LeadDocument>,
    @InjectModel(Session.name) private sessionModel: Model<SessionDocument>,
    @InjectModel(Expense.name) private expenseModel: Model<ExpenseDocument>,
    @InjectModel(Student.name) private studentModel: Model<StudentDocument>,
    @InjectModel(Fanpage.name) private fanpageModel: Model<FanpageDocument>,
    @InjectModel(Invoice.name) private invoiceModel: Model<InvoiceDocument>,
    @InjectModel(ParentAttribution.name) private parentAttributionModel: Model<ParentAttributionDocument>,
    private readonly googleAdsProvider: GoogleAdsProvider,
    private readonly tikTokAdsProvider: TikTokAdsProvider,
    private configService: ConfigService,
  ) {
    const key = this.configService.get<string>('TOKEN_ENCRYPTION_KEY');
    if (key) {
      const normalizedKey = key.trim();
      if (/^[0-9a-fA-F]{64}$/.test(normalizedKey)) {
        this.encryptionKey = Buffer.from(normalizedKey, 'hex');
      } else {
        this.logger.error('TOKEN_ENCRYPTION_KEY must be a 64-character hex string (32 bytes).');
      }
    } else {
      this.logger.error('TOKEN_ENCRYPTION_KEY is missing. Ads API tokens cannot be safely encrypted.');
    }
  }

  // â”€â”€â”€ Encryption helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  private requireEncryptionKey(): Buffer {
    if (!this.encryptionKey) {
      throw new InternalServerErrorException(
        'Token encryption is not configured. Please set TOKEN_ENCRYPTION_KEY.',
      );
    }
    return this.encryptionKey;
  }

  private encrypt(plainText: string): string {
    const key = this.requireEncryptionKey();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    let encrypted = cipher.update(plainText, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
  }

  private decrypt(cipherText: string): string {
    const key = this.requireEncryptionKey();
    const parts = cipherText.split(':');
    // Backward compatibility for legacy plaintext rows.
    if (parts.length !== 3) return cipherText;
    const [ivHex, authTagHex, encrypted] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  // â”€â”€â”€ Ad Account CRUD â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  private async generateAccountCode(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `ACC-${year}-`;
    for (let attempt = 0; attempt < 5; attempt++) {
      const count = await this.adAccountModel.countDocuments({ accountCode: { $regex: `^${prefix}` } });
      const code = `${prefix}${String(count + 1 + attempt).padStart(4, '0')}`;
      const exists = await this.adAccountModel.findOne({ accountCode: code }).lean();
      if (!exists) return code;
    }
    return `${prefix}${Date.now()}`;
  }

  async createAccount(dto: CreateAdAccountDto, user: JwtPayload): Promise<AdAccount> {
    const accountCode = await this.generateAccountCode();
    const account = new this.adAccountModel({
      ...dto,
      accountCode,
      createdById: user._id,
      createdByName: user.fullName,
    });
    return account.save();
  }

  async findAllAccounts(query: QueryAdAccountDto): Promise<{ data: AdAccount[]; total: number; page: number; limit: number }> {
    const filter: any = {};
    if (query.platform) filter.platform = query.platform;
    if (query.status) filter.status = query.status;
    if (query.search) {
      filter.$or = [
        { accountCode: new RegExp(query.search, 'i') },
        { name: new RegExp(query.search, 'i') },
        { platformAccountId: new RegExp(query.search, 'i') },
      ];
    }

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(200, Math.max(1, Number(query.limit) || 50));
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.adAccountModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).exec(),
      this.adAccountModel.countDocuments(filter),
    ]);

    return { data, total, page, limit };
  }

  async findOneAccount(id: string): Promise<AdAccountDocument> {
    const account = await this.adAccountModel.findById(id).exec();
    if (!account) throw new NotFoundException('TÃ i khoáº£n quáº£ng cÃ¡o khÃ´ng tá»“n táº¡i');
    return account;
  }

  async updateAccount(id: string, dto: UpdateAdAccountDto): Promise<AdAccount> {
    const account = await this.findOneAccount(id);
    Object.assign(account, dto);
    return account.save();
  }

  async deleteAccount(id: string): Promise<void> {
    const account = await this.findOneAccount(id);
    // Check if there are ad groups linked
    const groupCount = await this.adGroupModel.countDocuments({ adAccountId: id });
    if (groupCount > 0) {
      throw new BadRequestException(`TÃ i khoáº£n Ä‘ang cÃ³ ${groupCount} nhÃ³m quáº£ng cÃ¡o. HÃ£y xÃ³a nhÃ³m QC trÆ°á»›c.`);
    }
    await this.adAccountModel.findByIdAndDelete(id).exec();
  }

  // â”€â”€â”€ Ad Group CRUD â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  private async generateGroupCode(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `ADG-${year}-`;
    for (let attempt = 0; attempt < 5; attempt++) {
      const count = await this.adGroupModel.countDocuments({ groupCode: { $regex: `^${prefix}` } });
      const code = `${prefix}${String(count + 1 + attempt).padStart(4, '0')}`;
      const exists = await this.adGroupModel.findOne({ groupCode: code }).lean();
      if (!exists) return code;
    }
    return `${prefix}${Date.now()}`;
  }

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

  async createGroup(dto: CreateAdGroupDto, user: JwtPayload): Promise<AdGroup> {
    const account = await this.findOneAccount(dto.adAccountId);
    if (String(account.platform) !== String(dto.platform)) {
      throw new BadRequestException('Ad group platform must match ad account platform.');
    }
    await this.ensureUniqueCampaignId(dto.adAccountId, dto.platformCampaignId);

    const groupCode = await this.generateGroupCode();
    const group = new this.adGroupModel({
      ...dto,
      groupCode,
      adAccountName: account.name,
      createdById: user._id,
      createdByName: user.fullName,
    });
    try {
      return await group.save();
    } catch (err: any) {
      if (this.isDuplicateKeyError(err)) {
        await this.ensureUniqueCampaignId(dto.adAccountId, dto.platformCampaignId);
      }
      throw err;
    }
  }

  async findAllGroups(query: QueryAdGroupDto): Promise<{ data: AdGroup[]; total: number; page: number; limit: number }> {
    const filter: any = {};
    if (query.adAccountId) filter.adAccountId = query.adAccountId;
    if (query.platform) filter.platform = query.platform;
    if (query.status) filter.status = query.status;
    if (query.search) {
      filter.$or = [
        { groupCode: new RegExp(query.search, 'i') },
        { name: new RegExp(query.search, 'i') },
        { platformCampaignId: new RegExp(query.search, 'i') },
      ];
    }

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(200, Math.max(1, Number(query.limit) || 50));
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.adGroupModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).exec(),
      this.adGroupModel.countDocuments(filter),
    ]);

    return { data, total, page, limit };
  }

  async findOneGroup(id: string): Promise<AdGroupDocument> {
    const group = await this.adGroupModel.findById(id).exec();
    if (!group) throw new NotFoundException('NhÃ³m quáº£ng cÃ¡o khÃ´ng tá»“n táº¡i');
    return group;
  }

  async updateGroup(id: string, dto: UpdateAdGroupDto): Promise<AdGroup> {
    const group = await this.findOneGroup(id);
    if (dto.platformCampaignId && dto.platformCampaignId !== group.platformCampaignId) {
      await this.ensureUniqueCampaignId(String(group.adAccountId), dto.platformCampaignId, id);
    }
    Object.assign(group, dto);
    try {
      return await group.save();
    } catch (err: any) {
      if (this.isDuplicateKeyError(err)) {
        await this.ensureUniqueCampaignId(
          String(group.adAccountId),
          dto.platformCampaignId || group.platformCampaignId,
          id,
        );
      }
      throw err;
    }
  }

  async deleteGroup(id: string): Promise<void> {
    await this.findOneGroup(id);
    const [costCount, leadCount, orderCount, studentCount, sessionCount] = await Promise.all([
      this.adCostModel.countDocuments({ adGroupId: id }),
      this.leadModel.countDocuments({ adGroupId: id }),
      this.orderModel.countDocuments({ adGroupId: id }),
      this.studentModel.countDocuments({ adGroupId: id }),
      this.sessionModel.countDocuments({ adGroupId: id }),
    ]);

    const blockers = [
      { label: 'ad costs', count: costCount },
      { label: 'leads', count: leadCount },
      { label: 'orders', count: orderCount },
      { label: 'students', count: studentCount },
      { label: 'sessions', count: sessionCount },
    ].filter((item) => item.count > 0);

    if (blockers.length > 0) {
      const detail = blockers.map((item) => `${item.label}: ${item.count}`).join(', ');
      throw new BadRequestException(
        `Cannot delete ad group because related data still exists (${detail}).`,
      );
    }

    await this.adGroupModel.findByIdAndDelete(id).exec();
  }

  async findGroupsByPlatform(platform: string): Promise<AdGroup[]> {
    return this.adGroupModel.find({ platform, status: 'ACTIVE' }).sort({ name: 1 }).lean();
  }

  async findAllGroupsSimple(): Promise<AdGroup[]> {
    return this.adGroupModel.find({ status: 'ACTIVE' }).sort({ name: 1 }).lean();
  }

  // â”€â”€â”€ API Token Management â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async createToken(dto: CreateApiTokenDto, user: JwtPayload): Promise<ApiToken> {
    const tokenType = dto.tokenType || (dto.adAccountId ? ApiTokenType.ACCOUNT : ApiTokenType.FACEBOOK_SYSTEM_USER);
    const tokenData: any = {
      platform: dto.platform,
      tokenType,
      businessId: dto.businessId?.trim() || undefined,
      businessName: dto.businessName?.trim() || undefined,
      label: dto.label?.trim() || undefined,
      accessToken: this.encrypt(dto.accessToken),
      refreshToken: dto.refreshToken ? this.encrypt(dto.refreshToken) : undefined,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
      createdById: user._id,
    };

    if (tokenType === ApiTokenType.ACCOUNT) {
      if (!dto.adAccountId) {
        throw new BadRequestException('API token theo tài khoản phải chọn tài khoản quảng cáo.');
      }
      const account = await this.findOneAccount(dto.adAccountId);
      if (String(account.platform) !== String(dto.platform)) {
        throw new BadRequestException('API token platform must match ad account platform.');
      }
      tokenData.adAccountId = account._id;
      tokenData.adAccountName = account.name;
      await this.revokeOtherActiveTokens(this.buildTokenScopeFilter({
        adAccountId: account._id,
        tokenType,
        platform: dto.platform,
      }));
    } else {
      if (dto.platform !== 'FACEBOOK') {
        throw new BadRequestException('Hiện chỉ hỗ trợ system user token cho Facebook.');
      }
      await this.revokeOtherActiveTokens(this.buildTokenScopeFilter({
        businessId: tokenData.businessId,
        tokenType,
        platform: dto.platform,
      }));
    }

    const token = new this.apiTokenModel(tokenData);
    return token.save();
  }

  async findAllTokens(): Promise<any[]> {
    const tokens = await this.apiTokenModel.find().sort({ createdAt: -1 }).lean();
    return tokens.map((token) => this.formatTokenForDisplay(token));
  }

  async findTokensByAccount(accountId: string): Promise<any[]> {
    const tokens = await this.apiTokenModel.find({ adAccountId: accountId }).sort({ createdAt: -1 }).lean();
    return tokens.map((token) => this.formatTokenForDisplay(token));
    // Mask tokens for display
    return tokens.map(t => ({
      ...t,
      accessToken: 'â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢' + (t.accessToken?.slice(-6) || ''),
      refreshToken: t.refreshToken ? 'â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢' + (t.refreshToken.slice(-6) || '') : undefined,
    }));
  }

  async updateToken(id: string, dto: UpdateApiTokenDto): Promise<ApiToken> {
    const token = await this.apiTokenModel.findById(id).exec();
    if (!token) throw new NotFoundException('Token not found');

    const nextTokenType = dto.tokenType || token.tokenType || ApiTokenType.ACCOUNT;
    if (dto.tokenType) token.tokenType = dto.tokenType;

    if (nextTokenType === ApiTokenType.ACCOUNT) {
      const nextAccountId = dto.adAccountId || token.adAccountId?.toString();
      if (!nextAccountId) {
        throw new BadRequestException('API token theo tài khoản phải có tài khoản quảng cáo.');
      }
      const account = await this.findOneAccount(nextAccountId);
      if (String(account.platform) !== String(token.platform)) {
        throw new BadRequestException('API token platform must match ad account platform.');
      }
      token.adAccountId = account._id;
      token.adAccountName = account.name;
      token.businessId = undefined;
      token.businessName = undefined;
    } else {
      if (token.platform !== 'FACEBOOK') {
        throw new BadRequestException('Hiện chỉ hỗ trợ system user token cho Facebook.');
      }
      token.adAccountId = undefined;
      token.adAccountName = undefined;
      if (dto.businessId !== undefined) token.businessId = dto.businessId?.trim() || undefined;
      if (dto.businessName !== undefined) token.businessName = dto.businessName?.trim() || undefined;
    }

    if (dto.accessToken) token.accessToken = this.encrypt(dto.accessToken);
    if (dto.refreshToken) token.refreshToken = this.encrypt(dto.refreshToken);
    if (dto.expiresAt) token.expiresAt = new Date(dto.expiresAt);
    if (dto.status) token.status = dto.status;
    if (dto.label !== undefined) token.label = dto.label?.trim() || undefined;

    if (token.status === ApiTokenStatus.ACTIVE) {
      await this.revokeOtherActiveTokens(
        this.buildTokenScopeFilter({
          adAccountId: token.adAccountId,
          businessId: token.businessId,
          tokenType: token.tokenType,
          platform: token.platform,
        }),
        id,
      );
    }

    return token.save();
  }

  async deleteToken(id: string): Promise<void> {
    const token = await this.apiTokenModel.findById(id).exec();
    if (!token) throw new NotFoundException('Token không tồn tại');

    // Clean up Fanpage references before deleting token
    await this.fanpageModel.updateMany(
      { syncTokenId: token._id },
      {
        $unset: { syncTokenId: 1, syncTokenLabel: 1 },
        $set: { syncSource: FanpageSyncSource.MANUAL },
      },
    );

    await this.apiTokenModel.findByIdAndDelete(id).exec();
  }

  private formatTokenForDisplay(token: any) {
    return {
      ...token,
      accessToken: this.maskEncryptedSecret(token.accessToken),
      refreshToken: token.refreshToken ? this.maskEncryptedSecret(token.refreshToken) : undefined,
    };
  }

  private maskEncryptedSecret(secret?: string): string | undefined {
    if (!secret) return undefined;
    try {
      const raw = this.decrypt(secret);
      if (!raw) return undefined;
      if (raw.length <= 8) return '****';
      return `****${raw.slice(-6)}`;
    } catch {
      return '****';
    }
  }

  private buildTokenScopeFilter(scope: {
    adAccountId?: string | Types.ObjectId;
    businessId?: string;
    tokenType?: string;
    platform?: string;
  }): Record<string, any> | null {
    if (scope.tokenType === ApiTokenType.ACCOUNT && scope.adAccountId) {
      return {
        adAccountId: scope.adAccountId,
        tokenType: ApiTokenType.ACCOUNT,
        status: ApiTokenStatus.ACTIVE,
      };
    }

    if (scope.tokenType === ApiTokenType.FACEBOOK_SYSTEM_USER) {
      if (!scope.businessId) return null;
      const filter: Record<string, any> = {
        platform: scope.platform || 'FACEBOOK',
        tokenType: ApiTokenType.FACEBOOK_SYSTEM_USER,
        status: ApiTokenStatus.ACTIVE,
      };
      if (scope.businessId) filter.businessId = scope.businessId;
      return filter;
    }

    return null;
  }

  private async revokeOtherActiveTokens(filter: Record<string, any> | null, excludeTokenId?: string): Promise<void> {
    if (!filter) return;
    const finalFilter: Record<string, any> = { ...filter };
    if (excludeTokenId) finalFilter._id = { $ne: excludeTokenId };
    await this.apiTokenModel.updateMany(
      finalFilter,
      { $set: { status: ApiTokenStatus.REVOKED } },
    ).exec();
  }

  private async findBestActiveToken(filter: Record<string, any>): Promise<ApiTokenDocument | null> {
    const activeTokens = await this.apiTokenModel.find({
      ...filter,
      status: ApiTokenStatus.ACTIVE,
    }).sort({ createdAt: -1 }).exec();
    if (!activeTokens.length) return null;

    const now = new Date();
    const expiredIds: Types.ObjectId[] = [];
    const validTokens: ApiTokenDocument[] = [];

    for (const token of activeTokens) {
      if (token.expiresAt && token.expiresAt < now) {
        expiredIds.push(token._id as Types.ObjectId);
      } else {
        validTokens.push(token);
      }
    }

    if (expiredIds.length > 0) {
      await this.apiTokenModel.updateMany(
        { _id: { $in: expiredIds } },
        { $set: { status: ApiTokenStatus.EXPIRED } },
      ).exec();
    }

    if (!validTokens.length) {
      return null;
    }

    validTokens.sort((a, b) => {
      const aExpiry = a.expiresAt ? a.expiresAt.getTime() : Number.MAX_SAFE_INTEGER;
      const bExpiry = b.expiresAt ? b.expiresAt.getTime() : Number.MAX_SAFE_INTEGER;
      if (aExpiry !== bExpiry) return bExpiry - aExpiry;

      const aCreated = (a as any).createdAt ? new Date((a as any).createdAt).getTime() : 0;
      const bCreated = (b as any).createdAt ? new Date((b as any).createdAt).getTime() : 0;
      return bCreated - aCreated;
    });

    const selectedToken = validTokens[0];
    selectedToken.lastUsedAt = now;
    await selectedToken.save();
    return selectedToken;
  }

  private async getTokenByIdForUse(id: string): Promise<ApiTokenDocument> {
    const token = await this.apiTokenModel.findById(id).exec();
    if (!token) {
      throw new NotFoundException('Token khÃ´ng tá»“n táº¡i');
    }
    if (token.status !== ApiTokenStatus.ACTIVE) {
      throw new BadRequestException('Token khÃ´ng cÃ²n hoáº¡t Ä‘á»™ng.');
    }
    if (token.expiresAt && token.expiresAt < new Date()) {
      token.status = ApiTokenStatus.EXPIRED;
      await token.save();
      throw new BadRequestException('Token Ä‘Ã£ háº¿t háº¡n.');
    }
    token.lastUsedAt = new Date();
    await token.save();
    return token;
  }

  private async getDecryptedToken(accountId: string): Promise<string | null> {
    const token = await this.findBestActiveToken({
      adAccountId: accountId,
      tokenType: ApiTokenType.ACCOUNT,
    });
    return token ? this.decrypt(token.accessToken) : null;
  }

  /**
   * Normalize incoming date to UTC day-start.
   * This avoids timezone drift when clients send YYYY-MM-DD.
   */
  private normalizeToUtcDay(input: string | Date): Date {
    if (input instanceof Date) {
      if (Number.isNaN(input.getTime())) throw new BadRequestException('NgÃƒÂ y khÃƒÂ´ng hÃ¡Â»Â£p lÃ¡Â»â€¡');
      return new Date(Date.UTC(input.getUTCFullYear(), input.getUTCMonth(), input.getUTCDate()));
    }

    const raw = String(input || '').trim();
    const dateOnlyMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (dateOnlyMatch) {
      const year = Number(dateOnlyMatch[1]);
      const month = Number(dateOnlyMatch[2]) - 1;
      const day = Number(dateOnlyMatch[3]);
      return new Date(Date.UTC(year, month, day));
    }

    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) throw new BadRequestException('NgÃƒÂ y khÃƒÂ´ng hÃ¡Â»Â£p lÃ¡Â»â€¡');
    return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()));
  }

  private toUtcDateOnlyString(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  private getUtcDateRange(
    startDate: string,
    endDate: string,
    maxRangeDays?: number,
  ): { start: Date; end: Date } {
    const start = this.normalizeToUtcDay(startDate);
    const endDay = this.normalizeToUtcDay(endDate);
    if (endDay < start) {
      throw new BadRequestException('Khoáº£ng ngÃ y khÃ´ng há»£p lá»‡: endDate pháº£i >= startDate');
    }

    if (maxRangeDays && maxRangeDays > 0) {
      const diffMs = endDay.getTime() - start.getTime();
      const diffDays = Math.floor(diffMs / 86400000) + 1;
      if (diffDays > maxRangeDays) {
        throw new BadRequestException(`Khoảng ngày vượt quá ${maxRangeDays} ngày.`);
      }
    }

    const end = new Date(endDay);
    end.setUTCHours(23, 59, 59, 999);
    return { start, end };
  }

  private parseOptionalObjectId(id?: string): Types.ObjectId | undefined {
    if (!id) return undefined;
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('adGroupId khÃ´ng há»£p lá»‡');
    }
    return new Types.ObjectId(id);
  }

  private groupDayKey(adGroupId: string, date: string): string {
    return `${adGroupId}_${date}`;
  }

  private splitGroupDayKey(key: string): { adGroupId: string; date: string } {
    const pivot = key.indexOf('_');
    if (pivot <= 0) return { adGroupId: key, date: '' };
    return {
      adGroupId: key.slice(0, pivot),
      date: key.slice(pivot + 1),
    };
  }

  private daysInMonth(date: Date): number {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  }

  private isDuplicateKeyError(err: any): boolean {
    return !!(err && (err.code === 11000 || String(err?.message || '').includes('E11000')));
  }

  private async ensureUniqueCampaignId(
    adAccountId: string | Types.ObjectId,
    platformCampaignId: string,
    excludeGroupId?: string,
  ): Promise<void> {
    const campaignId = String(platformCampaignId || '').trim();
    if (!campaignId) return;

    const filter: any = {
      adAccountId,
      platformCampaignId: campaignId,
    };
    if (excludeGroupId) {
      filter._id = { $ne: excludeGroupId };
    }

    const duplicated = await this.adGroupModel.findOne(filter).select('_id name').lean();
    if (duplicated) {
      throw new BadRequestException(
        `Platform campaign ID "${campaignId}" already exists in this ad account.`,
      );
    }
  }

  private async legacyRevokeOtherActiveTokens(
    adAccountId: string | Types.ObjectId,
    excludeTokenId?: string,
  ): Promise<void> {
    const filter: any = {
      adAccountId,
      status: ApiTokenStatus.ACTIVE,
    };
    if (excludeTokenId) {
      filter._id = { $ne: excludeTokenId };
    }

    await this.apiTokenModel.updateMany(
      filter,
      { $set: { status: ApiTokenStatus.REVOKED } },
    ).exec();
  }

  // â”€â”€â”€ Ad Cost Management â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async createOrUpdateCost(dto: CreateAdCostDto): Promise<AdCost> {
    const costDate = this.normalizeToUtcDay(dto.date);

    const group = await this.findOneGroup(dto.adGroupId);
    if (String(group.adAccountId) !== String(dto.adAccountId)) {
      throw new BadRequestException('NhÃƒÂ³m quÃ¡ÂºÂ£ng cÃƒÂ¡o khÃƒÂ´ng thuÃ¡Â»â„¢c tÃƒÂ i khoÃ¡ÂºÂ£n quÃ¡ÂºÂ£ng cÃƒÂ¡o Ã„â€˜ÃƒÂ£ chÃ¡Â»Ân');
    }
    if (String(group.platform) !== String(dto.platform)) {
      throw new BadRequestException('NÃ¡Â»Ân tÃ¡ÂºÂ£ng quÃ¡ÂºÂ£ng cÃƒÂ¡o khÃƒÂ´ng khÃ¡Â»â€ºp vÃ¡Â»â€ºi nhÃƒÂ³m quÃ¡ÂºÂ£ng cÃƒÂ¡o');
    }

    const filter = { adGroupId: dto.adGroupId, date: costDate };
    const update = {
      $set: {
        adAccountId: dto.adAccountId,
        adGroupName: group.name,
        platform: dto.platform,
        spend: dto.spend,
        impressions: dto.impressions || 0,
        clicks: dto.clicks || 0,
        conversions: dto.conversions || 0,
        source: dto.source || AdCostSource.MANUAL,
        syncedAt: new Date(),
      },
    };

    try {
      const result = await this.adCostModel.findOneAndUpdate(
        filter,
        update,
        { upsert: true, new: true },
      ).exec();
      return result!;
    } catch (err: any) {
      // Concurrent upsert may throw E11000 on unique index (adGroupId + date).
      // Retry as non-upsert update to converge to one canonical row.
      if (this.isDuplicateKeyError(err)) {
        const retried = await this.adCostModel.findOneAndUpdate(
          filter,
          update,
          { new: true },
        ).exec();
        if (retried) return retried;
      }
      throw err;
    }
  }

  async findAllCosts(query: QueryAdCostDto): Promise<{ data: AdCost[]; total: number; page: number; limit: number }> {
    const filter: any = {};
    if (query.adGroupId) filter.adGroupId = query.adGroupId;
    if (query.adAccountId) filter.adAccountId = query.adAccountId;
    if (query.platform) filter.platform = query.platform;
    if (query.startDate || query.endDate) {
      filter.date = {};
      if (query.startDate) filter.date.$gte = this.normalizeToUtcDay(query.startDate);
      if (query.endDate) {
        const end = this.normalizeToUtcDay(query.endDate);
        end.setUTCHours(23, 59, 59, 999);
        filter.date.$lte = end;
      }
    }

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(500, Math.max(1, Number(query.limit) || 50));
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.adCostModel.find(filter).sort({ date: -1 }).skip(skip).limit(limit).exec(),
      this.adCostModel.countDocuments(filter),
    ]);

    return { data, total, page, limit };
  }

  async deleteCost(id: string): Promise<void> {
    const cost = await this.adCostModel.findById(id).exec();
    if (!cost) throw new NotFoundException('Báº£n ghi chi phÃ­ khÃ´ng tá»“n táº¡i');
    await this.adCostModel.findByIdAndDelete(id).exec();
  }

  // â”€â”€â”€ Ad Cost Sync â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async syncFacebookBusinessToken(tokenId: string, dateStr?: string): Promise<FacebookBusinessSyncResult> {
    const tokenDoc = await this.getTokenByIdForUse(tokenId);
    if (tokenDoc.platform !== 'FACEBOOK' || tokenDoc.tokenType !== ApiTokenType.FACEBOOK_SYSTEM_USER) {
      throw new BadRequestException('Token này không phải Facebook system user token.');
    }

    const accessToken = this.decrypt(tokenDoc.accessToken);
    const syncDates = dateStr
      ? [this.normalizeToUtcDay(dateStr)]
      : this.buildRollingSyncDates(this.getSyncLookbackDays());

    const result = await this.runFacebookBusinessTokenSync(tokenDoc, accessToken, syncDates);
    tokenDoc.lastSyncedAt = new Date();
    await tokenDoc.save();
    return result;
  }

  private buildFacebookGraphUrl(
    path: string,
    params: Record<string, string | number | undefined>,
  ): string {
    const url = new URL(`https://graph.facebook.com/v25.0${path}`);
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;
      url.searchParams.set(key, String(value));
    });
    return url.toString();
  }

  private async fetchFacebookCollection<T>(url: string, accessToken: string): Promise<T[]> {
    const results: T[] = [];
    const visited = new Set<string>();
    let nextUrl: string | null = url;

    while (nextUrl) {
      if (visited.has(nextUrl)) break;
      visited.add(nextUrl);

      const response = await this.fetchWithRetry(nextUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const pageData = Array.isArray(response?.data) ? response.data as T[] : [];
      results.push(...pageData);
      nextUrl = response?.paging?.next || null;
    }

    return results;
  }

  private normalizeFacebookAdAccountId(raw?: string): string {
    return String(raw || '').replace(/^act_/, '').trim();
  }

  private mapFacebookAccountStatus(raw?: number | string): string {
    const status = Number(raw);
    if ([2, 101, 201].includes(status)) return AdAccountStatus.DISABLED;
    if ([3, 7, 8, 9, 100].includes(status)) return AdAccountStatus.PAUSED;
    return AdAccountStatus.ACTIVE;
  }

  private mapFacebookAdGroupStatus(raw?: string): string {
    const normalized = String(raw || '').trim().toUpperCase();
    if (!normalized || normalized.includes('ACTIVE')) return AdGroupStatus.ACTIVE;
    if (normalized.includes('PAUSED')) return AdGroupStatus.PAUSED;
    return AdGroupStatus.ARCHIVED;
  }

  private convertSpendToVnd(amount: number, currency?: string): number {
    const normalized = String(currency || '').trim().toUpperCase();
    if (!normalized || normalized === 'VND') return amount;
    if (normalized === 'USD') return amount * this.getExchangeRate('USD');
    return amount;
  }

  private async resolveFacebookBusinesses(
    tokenDoc: ApiTokenDocument,
    accessToken: string,
  ): Promise<FacebookBusinessRef[]> {
    const businesses = new Map<string, FacebookBusinessRef>();
    if (tokenDoc.businessId) {
      businesses.set(tokenDoc.businessId, {
        id: tokenDoc.businessId,
        name: tokenDoc.businessName || undefined,
      });
    }

    try {
      const discovered = await this.fetchFacebookCollection<FacebookBusinessRef>(
        this.buildFacebookGraphUrl('/me/businesses', {
          fields: 'id,name',
          limit: 100,
        }),
        accessToken,
      );
      discovered.forEach((business) => {
        if (!business?.id) return;
        businesses.set(business.id, { id: business.id, name: business.name });
      });
    } catch (err: any) {
      if (!businesses.size) {
        this.logger.warn(`Cannot resolve Facebook businesses from system token: ${err.message}`);
      }
    }

    return Array.from(businesses.values());
  }

  private async fetchFacebookBusinessAdAccounts(
    accessToken: string,
    businesses: FacebookBusinessRef[],
  ): Promise<FacebookAdAccountRow[]> {
    const accounts = new Map<string, FacebookAdAccountRow>();
    const addAccount = (row: FacebookAdAccountRow, business?: FacebookBusinessRef) => {
      const accountId = this.normalizeFacebookAdAccountId(row.account_id || row.id);
      if (!accountId) return;
      accounts.set(accountId, {
        ...row,
        account_id: accountId,
        business: row.business?.id
          ? row.business
          : business
            ? { id: business.id, name: business.name }
            : undefined,
      });
    };

    for (const business of businesses) {
      for (const edge of ['owned_ad_accounts', 'client_ad_accounts']) {
        try {
          const rows = await this.fetchFacebookCollection<FacebookAdAccountRow>(
            this.buildFacebookGraphUrl(`/${business.id}/${edge}`, {
              fields: 'id,account_id,name,account_status,currency,business',
              limit: 250,
            }),
            accessToken,
          );
          rows.forEach((row) => addAccount(row, business));
        } catch (err: any) {
          this.logger.warn(`Cannot fetch ${edge} for business ${business.id}: ${err.message}`);
        }
      }
    }

    if (!accounts.size) {
      const fallbackRows = await this.fetchFacebookCollection<FacebookAdAccountRow>(
        this.buildFacebookGraphUrl('/me/adaccounts', {
          fields: 'id,account_id,name,account_status,currency,business',
          limit: 250,
        }),
        accessToken,
      );
      fallbackRows.forEach((row) => addAccount(row));
    }

    return Array.from(accounts.values());
  }

  private async fetchFacebookPages(
    accessToken: string,
    businesses: FacebookBusinessRef[],
  ): Promise<FacebookPageRow[]> {
    const pages = new Map<string, FacebookPageRow>();
    const addPage = (row: FacebookPageRow) => {
      const pageId = String(row.id || '').trim();
      if (!pageId) return;
      const existing = pages.get(pageId);
      pages.set(pageId, {
        ...(existing || {}),
        ...row,
        id: pageId,
        access_token: row.access_token || existing?.access_token,
      });
    };

    for (const business of businesses) {
      try {
        const rows = await this.fetchFacebookCollection<FacebookPageRow>(
          this.buildFacebookGraphUrl(`/${business.id}/owned_pages`, {
            fields: 'id,name,link',
            limit: 250,
          }),
          accessToken,
        );
        rows.forEach(addPage);
      } catch (err: any) {
        this.logger.warn(`Cannot fetch owned_pages for business ${business.id}: ${err.message}`);
      }
    }

    try {
      const accessiblePages = await this.fetchFacebookCollection<FacebookPageRow>(
        this.buildFacebookGraphUrl('/me/accounts', {
          fields: 'id,name,access_token,link',
          limit: 250,
        }),
        accessToken,
      );
      accessiblePages.forEach(addPage);
    } catch (err: any) {
      if (!pages.size) {
        this.logger.warn(`Cannot fetch /me/accounts for Facebook pages: ${err.message}`);
      }
    }

    for (const page of pages.values()) {
      if (!page.access_token && page.id) {
        page.access_token = await this.resolveFacebookPageAccessToken(page.id, accessToken);
      }
    }

    return Array.from(pages.values());
  }

  private async resolveFacebookPageAccessToken(pageId: string, accessToken: string): Promise<string | undefined> {
    try {
      const response = await this.fetchWithRetry(
        this.buildFacebookGraphUrl(`/${pageId}`, { fields: 'access_token' }),
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      return response?.access_token || undefined;
    } catch {
      return undefined;
    }
  }

  private async upsertFacebookAdAccount(
    row: FacebookAdAccountRow,
    tokenDoc: ApiTokenDocument,
  ): Promise<AdAccountDocument | null> {
    const platformAccountId = this.normalizeFacebookAdAccountId(row.account_id || row.id);
    if (!platformAccountId) return null;

    const businessId = row.business?.id || tokenDoc.businessId || undefined;
    const businessName = row.business?.name || tokenDoc.businessName || undefined;
    const now = new Date();
    const status = this.mapFacebookAccountStatus(row.account_status);
    const currency = row.currency?.toUpperCase();

    let account = await this.adAccountModel.findOne({
      platform: 'FACEBOOK',
      platformAccountId,
    }).exec();

    if (!account) {
      account = new this.adAccountModel({
        accountCode: await this.generateAccountCode(),
        name: row.name || `Facebook Ads ${platformAccountId}`,
        platform: 'FACEBOOK',
        platformAccountId,
        status,
        currency,
        businessId,
        businessName,
        syncSource: AdAccountSyncSource.FACEBOOK_BM,
        lastSyncedAt: now,
        createdById: tokenDoc.createdById,
        createdByName: tokenDoc.label || 'Facebook BM Sync',
      });
      return account.save();
    }

    account.name = row.name || account.name;
    account.status = status;
    account.currency = currency || account.currency;
    account.businessId = businessId;
    account.businessName = businessName;
    account.syncSource = AdAccountSyncSource.FACEBOOK_BM;
    account.lastSyncedAt = now;
    return account.save();
  }

  private async upsertFacebookAdGroup(
    account: AdAccountDocument,
    row: FacebookAdsetRow,
    tokenDoc: ApiTokenDocument,
  ): Promise<AdGroupDocument | null> {
    const externalId = String(row.id || '').trim();
    if (!externalId) return null;

    const now = new Date();
    const status = this.mapFacebookAdGroupStatus(row.effective_status);
    const startDate = row.start_time ? new Date(row.start_time) : undefined;
    const endDate = row.end_time ? new Date(row.end_time) : undefined;

    let group = await this.adGroupModel.findOne({
      adAccountId: account._id,
      platformCampaignId: externalId,
    }).exec();

    if (!group) {
      group = new this.adGroupModel({
        groupCode: await this.generateGroupCode(),
        name: row.name || `Facebook Ad Set ${externalId}`,
        adAccountId: account._id,
        adAccountName: account.name,
        platform: 'FACEBOOK',
        platformCampaignId: externalId,
        status,
        startDate,
        endDate,
        syncSource: AdGroupSyncSource.FACEBOOK_BM,
        lastSyncedAt: now,
        createdById: tokenDoc.createdById,
        createdByName: tokenDoc.label || 'Facebook BM Sync',
      });
      return group.save();
    }

    group.name = row.name || group.name;
    group.adAccountName = account.name;
    group.status = status;
    group.startDate = startDate || group.startDate;
    group.endDate = endDate || group.endDate;
    group.syncSource = AdGroupSyncSource.FACEBOOK_BM;
    group.lastSyncedAt = now;
    return group.save();
  }

  private async upsertFacebookFanpage(
    row: FacebookPageRow,
    tokenDoc: ApiTokenDocument,
  ): Promise<FanpageDocument | null> {
    const pageId = String(row.id || '').trim();
    if (!pageId) return null;

    const now = new Date();
    const encryptedPageToken = row.access_token ? this.encrypt(row.access_token) : undefined;
    let fanpage = await this.fanpageModel.findOne({
      platform: FanpagePlatform.FACEBOOK,
      pageId,
    }).exec();

    if (!fanpage) {
      fanpage = new this.fanpageModel({
        fanpageCode: await this.generateFanpageCode(),
        name: row.name || `Facebook Page ${pageId}`,
        platform: FanpagePlatform.FACEBOOK,
        pageId,
        pageAccessToken: encryptedPageToken,
        syncSource: FanpageSyncSource.FACEBOOK_BM,
        businessId: tokenDoc.businessId,
        businessName: tokenDoc.businessName,
        syncTokenId: tokenDoc._id,
        syncTokenLabel: tokenDoc.label,
        lastSyncedAt: now,
        status: FanpageStatus.ACTIVE,
        aiAutoReplyEnabled: true,
        createdById: tokenDoc.createdById,
        createdByName: tokenDoc.label || 'Facebook BM Sync',
      });
      return fanpage.save();
    }

    fanpage.name = row.name || fanpage.name;
    if (encryptedPageToken) fanpage.pageAccessToken = encryptedPageToken;
    fanpage.syncSource = FanpageSyncSource.FACEBOOK_BM;
    fanpage.businessId = tokenDoc.businessId;
    fanpage.businessName = tokenDoc.businessName;
    fanpage.syncTokenId = tokenDoc._id;
    fanpage.syncTokenLabel = tokenDoc.label;
    fanpage.lastSyncedAt = now;
    return fanpage.save();
  }

  private async syncFacebookAdsetsForAccount(
    accessToken: string,
    account: AdAccountDocument,
    tokenDoc: ApiTokenDocument,
  ): Promise<{ groupsSynced: number; groupsByExternalId: Map<string, AdGroupDocument> }> {
    const rows = await this.fetchFacebookCollection<FacebookAdsetRow>(
      this.buildFacebookGraphUrl(`/act_${account.platformAccountId}/adsets`, {
        fields: 'id,name,effective_status,start_time,end_time',
        limit: 250,
      }),
      accessToken,
    );

    const groupsByExternalId = new Map<string, AdGroupDocument>();
    let groupsSynced = 0;

    for (const row of rows) {
      const group = await this.upsertFacebookAdGroup(account, row, tokenDoc);
      if (!group) continue;
      groupsByExternalId.set(group.platformCampaignId, group);
      groupsSynced += 1;
    }

    return { groupsSynced, groupsByExternalId };
  }

  private async syncFacebookInsightsForAccount(
    accessToken: string,
    account: AdAccountDocument,
    tokenDoc: ApiTokenDocument,
    groupsByExternalId: Map<string, AdGroupDocument>,
    date: Date,
  ): Promise<{ synced: number; groupsSynced: number }> {
    const dateStr = this.toUtcDateOnlyString(date);
    const rows = await this.fetchFacebookCollection<FacebookInsightRow>(
      this.buildFacebookGraphUrl(`/act_${account.platformAccountId}/insights`, {
        fields: 'adset_id,adset_name,spend,impressions,clicks,actions',
        level: 'adset',
        time_range: JSON.stringify({ since: dateStr, until: dateStr }),
        limit: 250,
      }),
      accessToken,
    );

    let synced = 0;
    let groupsSynced = 0;

    for (const row of rows) {
      const externalId = String(row.adset_id || '').trim();
      if (!externalId) continue;

      let group: AdGroupDocument | null | undefined = groupsByExternalId.get(externalId);
      if (!group) {
        group = await this.upsertFacebookAdGroup(account, {
          id: externalId,
          name: row.adset_name,
          effective_status: 'ACTIVE',
        }, tokenDoc);
        if (group) {
          groupsByExternalId.set(externalId, group);
          groupsSynced += 1;
        }
      }
      if (!group) continue;

      const conversions = (row.actions || [])
        .filter((action) => action.action_type === 'offsite_conversion')
        .reduce((sum, action) => sum + Number(action.value || 0), 0);

      await this.createOrUpdateCost({
        adGroupId: group._id.toString(),
        adAccountId: account._id.toString(),
        platform: 'FACEBOOK',
        date: dateStr,
        spend: this.convertSpendToVnd(Number(row.spend || 0), account.currency),
        impressions: Number(row.impressions || 0),
        clicks: Number(row.clicks || 0),
        conversions,
        source: AdCostSource.SYNCED,
      });
      synced += 1;
    }

    return { synced, groupsSynced };
  }

  private async runFacebookBusinessTokenSync(
    tokenDoc: ApiTokenDocument,
    accessToken: string,
    syncDates: Date[],
  ): Promise<FacebookBusinessSyncResult> {
    const errors: string[] = [];
    let synced = 0;
    let adAccountsSynced = 0;
    let adGroupsSynced = 0;
    let fanpagesSynced = 0;

    const businesses = await this.resolveFacebookBusinesses(tokenDoc, accessToken);
    if (!tokenDoc.businessId && businesses.length === 1) {
      tokenDoc.businessId = businesses[0].id;
      tokenDoc.businessName = businesses[0].name;
    }

    const accountRows = await this.fetchFacebookBusinessAdAccounts(accessToken, businesses);
    const pages = await this.fetchFacebookPages(accessToken, businesses);
    const accounts: AdAccountDocument[] = [];

    for (const row of accountRows) {
      try {
        const account = await this.upsertFacebookAdAccount(row, tokenDoc);
        if (!account) continue;
        accounts.push(account);
        adAccountsSynced += 1;
      } catch (err: any) {
        errors.push(`Ad account ${row.name || row.account_id || row.id}: ${err.message}`);
      }
    }

    for (const row of pages) {
      try {
        const fanpage = await this.upsertFacebookFanpage(row, tokenDoc);
        if (!fanpage) continue;
        fanpagesSynced += 1;
        if (!row.access_token) {
          errors.push(`Fanpage ${row.name || row.id}: chưa lấy được page access token.`);
        }
      } catch (err: any) {
        errors.push(`Fanpage ${row.name || row.id}: ${err.message}`);
      }
    }

    for (const account of accounts) {
      try {
        const groupResult = await this.syncFacebookAdsetsForAccount(accessToken, account, tokenDoc);
        adGroupsSynced += groupResult.groupsSynced;

        for (const syncDate of syncDates) {
          const syncResult = await this.syncFacebookInsightsForAccount(
            accessToken,
            account,
            tokenDoc,
            groupResult.groupsByExternalId,
            syncDate,
          );
          synced += syncResult.synced;
          adGroupsSynced += syncResult.groupsSynced;
        }
      } catch (err: any) {
        errors.push(`Account ${account.name}: ${err.message}`);
      }
    }

    return {
      synced,
      adAccountsSynced,
      adGroupsSynced,
      fanpagesSynced,
      errors,
    };
  }

  @Cron('0 6 * * *')
  async syncAllAdCosts(): Promise<{ synced: number; errors: string[] }> {
    const lookbackDays = this.getSyncLookbackDays();
    const syncDates = this.buildRollingSyncDates(lookbackDays);
    this.logger.log(`Starting daily ad cost sync (lookback ${lookbackDays} day(s))...`);
    const businessTokens = await this.apiTokenModel.find({
      platform: 'FACEBOOK',
      tokenType: ApiTokenType.FACEBOOK_SYSTEM_USER,
      status: ApiTokenStatus.ACTIVE,
    }).sort({ createdAt: -1 }).exec();
    const accounts = await this.adAccountModel.find({ status: 'ACTIVE' }).exec();
    let synced = 0;
    const errors: string[] = [];

    for (const token of businessTokens) {
      try {
        const result = await this.runFacebookBusinessTokenSync(token, this.decrypt(token.accessToken), syncDates);
        token.lastUsedAt = new Date();
        token.lastSyncedAt = new Date();
        await token.save();
        synced += result.synced;
        errors.push(...result.errors);
      } catch (err: any) {
        const msg = `${token.label || token.businessName || token._id} (FACEBOOK_BM): ${err.message}`;
        errors.push(msg);
        this.logger.error(msg);
      }
    }

    for (const account of accounts) {
      const hasAccountToken = await this.findBestActiveToken({
        adAccountId: account._id,
        tokenType: ApiTokenType.ACCOUNT,
      });
      if (!hasAccountToken) continue;

      try {
        const count = await this.syncAccountCostsForDates(account._id.toString(), syncDates);
        synced += count;
      } catch (err: any) {
        const msg = `${account.name} (${account.platform}): ${err.message}`;
        errors.push(msg);
        this.logger.error(msg);
      }
    }

    this.logger.log(`Ad cost sync complete. Synced: ${synced}, Errors: ${errors.length}`);

    // After syncing costs, refresh true-revenue snapshots on all ad groups
    try {
      await this.syncTrueRevenue();
    } catch (err: any) {
      this.logger.error(`syncTrueRevenue cron error: ${err.message}`);
    }

    return { synced, errors };
  }

  async syncAccountCosts(accountId: string, dateStr?: string): Promise<number> {
    const syncDates = [
      dateStr
        ? this.normalizeToUtcDay(dateStr)
        : this.normalizeToUtcDay(new Date(Date.now() - 86400000)),
    ];
    return this.syncAccountCostsForDates(accountId, syncDates);
  }

  private async syncAccountCostsForDates(accountId: string, syncDates: Date[]): Promise<number> {
    const account = await this.findOneAccount(accountId);
    const token = await this.getDecryptedToken(accountId);
    if (!token) {
      throw new BadRequestException(`KhÃ´ng tÃ¬m tháº¥y API token há»£p lá»‡ cho tÃ i khoáº£n ${account.name}`);
    }

    const groups = await this.adGroupModel.find({ adAccountId: accountId, status: 'ACTIVE' }).exec();
    if (groups.length === 0) return 0;

    let synced = 0;
    for (const syncDate of syncDates) {
      synced += await this.syncPlatformCosts(token, account, groups, syncDate);
    }

    return synced;
  }

  private async syncPlatformCosts(
    token: string,
    account: AdAccountDocument,
    groups: AdGroupDocument[],
    syncDate: Date,
  ): Promise<number> {
    switch (account.platform) {
      case 'FACEBOOK':
        return this.syncFacebookCosts(token, account, groups, syncDate);
      case 'GOOGLE':
        return this.syncGoogleCosts(token, account, groups, syncDate);
      case 'TIKTOK':
        return this.syncTikTokCosts(token, account, groups, syncDate);
      default:
        return 0;
    }
  }

  private getSyncLookbackDays(): number {
    const rawValue = Number(this.configService.get<string>('AD_SYNC_LOOKBACK_DAYS', '3'));
    if (!Number.isFinite(rawValue)) return 3;
    return Math.max(1, Math.min(14, Math.floor(rawValue)));
  }

  private buildRollingSyncDates(lookbackDays: number): Date[] {
    const dates: Date[] = [];
    for (let offset = 1; offset <= lookbackDays; offset++) {
      dates.push(this.normalizeToUtcDay(new Date(Date.now() - (offset * 86400000))));
    }
    return dates;
  }

  private async syncFacebookCosts(
    token: string, account: AdAccountDocument, groups: AdGroupDocument[], date: Date,
  ): Promise<number> {
    const dateStr = this.toUtcDateOnlyString(date);
    let synced = 0;

    try {
      const url = `https://graph.facebook.com/v21.0/act_${account.platformAccountId}/insights`
        + `?fields=spend,impressions,clicks,actions`
        + `&level=campaign`
        + `&time_range={"since":"${dateStr}","until":"${dateStr}"}`;

      const response = await this.fetchWithRetry(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = response?.data || [];

      const campaignMap = new Map<string, AdGroupDocument>();
      for (const g of groups) {
        campaignMap.set(g.platformCampaignId, g);
      }

      for (const row of data) {
        const campaignId = row.campaign_id;
        const group = campaignMap.get(campaignId);
        if (!group) continue;

        const conversions = (row.actions || [])
          .filter((a: any) => a.action_type === 'offsite_conversion')
          .reduce((sum: number, a: any) => sum + Number(a.value || 0), 0);

        await this.createOrUpdateCost({
          adGroupId: group._id.toString(),
          adAccountId: account._id.toString(),
          platform: 'FACEBOOK',
          date: dateStr,
          spend: Number(row.spend || 0) * this.getExchangeRate('USD'),
          impressions: Number(row.impressions || 0),
          clicks: Number(row.clicks || 0),
          conversions,
          source: AdCostSource.SYNCED,
        });
        synced++;
      }
    } catch (err: any) {
      this.logger.error(`Facebook sync error: ${err.message}`);
      throw err;
    }

    return synced;
  }

  private async syncGoogleCosts(
    token: string, account: AdAccountDocument, groups: AdGroupDocument[], date: Date,
  ): Promise<number> {
    const dateStr = this.toUtcDateOnlyString(date);
    let synced = 0;

    try {
      const query = `SELECT campaign.id, metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.conversions`
        + ` FROM campaign WHERE segments.date = '${dateStr}'`;

      const url = `https://googleads.googleapis.com/v17/customers/${account.platformAccountId}/googleAds:searchStream`;

      const response = await this.fetchWithRetry(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'developer-token': this.configService.get<string>('GOOGLE_ADS_DEV_TOKEN', ''),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
      });

      const campaignMap = new Map<string, AdGroupDocument>();
      for (const g of groups) {
        campaignMap.set(g.platformCampaignId, g);
      }

      const streamBatches = Array.isArray(response) ? response : [response];
      const results = streamBatches.flatMap((batch: any) => batch?.results || []);
      for (const row of results) {
        const campaignId = row.campaign?.id?.toString();
        if (!campaignId) continue;
        const group = campaignMap.get(campaignId);
        if (!group) continue;

        const costVnd = (Number(row.metrics?.cost_micros || 0) / 1_000_000) * this.getExchangeRate('USD');

        await this.createOrUpdateCost({
          adGroupId: group._id.toString(),
          adAccountId: account._id.toString(),
          platform: 'GOOGLE',
          date: this.toUtcDateOnlyString(date),
          spend: costVnd,
          impressions: Number(row.metrics?.impressions || 0),
          clicks: Number(row.metrics?.clicks || 0),
          conversions: Number(row.metrics?.conversions || 0),
          source: AdCostSource.SYNCED,
        });
        synced++;
      }
    } catch (err: any) {
      this.logger.error(`Google sync error: ${err.message}`);
      throw err;
    }

    return synced;
  }

  private async syncTikTokCosts(
    token: string, account: AdAccountDocument, groups: AdGroupDocument[], date: Date,
  ): Promise<number> {
    const dateStr = this.toUtcDateOnlyString(date);
    let synced = 0;

    try {
      const url = `https://business-api.tiktok.com/open_api/v1.3/report/integrated/get/`
        + `?advertiser_id=${account.platformAccountId}`
        + `&report_type=BASIC`
        + `&dimensions=["campaign_id","stat_time_day"]`
        + `&metrics=["spend","impressions","clicks","conversions"]`
        + `&data_level=AUCTION_CAMPAIGN`
        + `&start_date=${dateStr}&end_date=${dateStr}`;

      const response = await this.fetchWithRetry(url, {
        headers: { 'Access-Token': token },
      });

      const campaignMap = new Map<string, AdGroupDocument>();
      for (const g of groups) {
        campaignMap.set(g.platformCampaignId, g);
      }

      const rows = response?.data?.list || [];
      for (const row of rows) {
        const campaignId = row.dimensions?.campaign_id;
        if (!campaignId) continue;
        const group = campaignMap.get(campaignId);
        if (!group) continue;

        await this.createOrUpdateCost({
          adGroupId: group._id.toString(),
          adAccountId: account._id.toString(),
          platform: 'TIKTOK',
          date: dateStr,
          spend: Number(row.metrics?.spend || 0) * this.getExchangeRate('USD'),
          impressions: Number(row.metrics?.impressions || 0),
          clicks: Number(row.metrics?.clicks || 0),
          conversions: Number(row.metrics?.conversions || 0),
          source: AdCostSource.SYNCED,
        });
        synced++;
      }
    } catch (err: any) {
      this.logger.error(`TikTok sync error: ${err.message}`);
      throw err;
    }

    return synced;
  }

  private getExchangeRate(currency: string): number {
    // Configurable via env, default VND rates
    if (currency === 'USD') {
      return Number(this.configService.get<string>('USD_TO_VND', '25000'));
    }
    return 1;
  }

  private async fetchWithRetry(url: string, options: any = {}, retries = 3): Promise<any> {
    for (let i = 0; i < retries; i++) {
      try {
        const response = await fetch(url, options);
        if (!response.ok) {
          const body = await response.text();
          throw new Error(`HTTP ${response.status}: ${body}`);
        }
        return response.json();
      } catch (err: any) {
        if (i === retries - 1) throw err;
        await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i)));
      }
    }
  }

  // â”€â”€â”€ Analytics â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  private async buildNetProfitDailyRows(
    start: Date,
    end: Date,
    adGroupObjectId?: Types.ObjectId,
  ): Promise<NetProfitDailyRow[]> {
    const sessionMatch: any = {
      adGroupId: { $exists: true, $ne: null },
      status: SessionStatus.FINALIZED,
      scheduledDate: { $gte: start, $lte: end },
    };
    if (adGroupObjectId) sessionMatch.adGroupId = adGroupObjectId;

    const sessionsByGroupDay = await this.sessionModel.aggregate([
      { $match: sessionMatch },
      {
        $group: {
          _id: {
            adGroupId: '$adGroupId',
            date: {
              $dateToString: {
                format: '%Y-%m-%d',
                date: '$scheduledDate',
                timezone: 'UTC',
              },
            },
          },
          revenue: { $sum: { $ifNull: ['$amountCharged', 0] } },
          teacherCost: { $sum: { $ifNull: ['$teacherPayout', 0] } },
          sessionCount: { $sum: 1 },
          adGroupName: { $first: '$adGroupName' },
        },
      },
      { $sort: { '_id.date': 1 } },
    ]);

    const totalSessionsByDay = await this.sessionModel.aggregate([
      {
        $match: {
          status: SessionStatus.FINALIZED,
          scheduledDate: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$scheduledDate',
              timezone: 'UTC',
            },
          },
          totalSessions: { $sum: 1 },
        },
      },
    ]);
    const totalSessionMap = new Map<string, number>(
      totalSessionsByDay.map((row: any) => [String(row._id), Number(row.totalSessions || 0)]),
    );

    const expensesByDay = await this.expenseModel.aggregate([
      {
        $match: {
          // Accounting view: include incurred expenses even if not yet paid.
          paymentStatus: { $in: [PaymentStatus.PAID, PaymentStatus.APPROVED_UNPAID] },
          expenseDate: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$expenseDate',
              timezone: 'UTC',
            },
          },
          totalExpense: { $sum: { $ifNull: ['$amount', 0] } },
        },
      },
    ]);
    const expenseMap = new Map<string, number>(
      expensesByDay.map((row: any) => [String(row._id), Number(row.totalExpense || 0)]),
    );

    const adCostMatch: any = { date: { $gte: start, $lte: end } };
    if (adGroupObjectId) adCostMatch.adGroupId = adGroupObjectId;

    const adCostsByGroupDay = await this.adCostModel.aggregate([
      { $match: adCostMatch },
      {
        $group: {
          _id: {
            adGroupId: '$adGroupId',
            date: {
              $dateToString: {
                format: '%Y-%m-%d',
                date: '$date',
                timezone: 'UTC',
              },
            },
          },
          adSpend: { $sum: { $ifNull: ['$spend', 0] } },
          adGroupName: { $first: '$adGroupName' },
          platform: { $first: '$platform' },
        },
      },
    ]);

    const adCostMap = new Map<string, any>();
    for (const c of adCostsByGroupDay) {
      const gId = String(c._id.adGroupId);
      const date = String(c._id.date);
      adCostMap.set(this.groupDayKey(gId, date), c);
    }

    const sessionDataMap = new Map<string, any>();
    for (const s of sessionsByGroupDay) {
      const gId = String(s._id.adGroupId);
      const date = String(s._id.date);
      sessionDataMap.set(this.groupDayKey(gId, date), s);
    }

    const allKeys = new Set<string>([
      ...Array.from(sessionDataMap.keys()),
      ...Array.from(adCostMap.keys()),
    ]);

    const groupIds = new Set<string>();
    for (const key of allKeys) {
      const parsed = this.splitGroupDayKey(key);
      if (parsed.adGroupId) groupIds.add(parsed.adGroupId);
    }

    const adGroupIds = Array.from(groupIds)
      .filter((id) => Types.ObjectId.isValid(id))
      .map((id) => new Types.ObjectId(id));

    const adGroups = adGroupIds.length
      ? await this.adGroupModel.find({ _id: { $in: adGroupIds } }).select('name platform').lean()
      : [];
    const adGroupMetaMap = new Map<string, { name?: string; platform?: string }>(
      adGroups.map((g: any) => [String(g._id), { name: g.name, platform: g.platform }]),
    );

    const daily: NetProfitDailyRow[] = [];
    for (const key of allKeys) {
      const { adGroupId, date } = this.splitGroupDayKey(key);
      if (!date) continue;

      const sessionData = sessionDataMap.get(key);
      const revenue = Number(sessionData?.revenue || 0);
      const teacherCost = Number(sessionData?.teacherCost || 0);
      const sessionCount = Number(sessionData?.sessionCount || 0);
      const grossProfit = revenue - teacherCost;

      const totalSessionsOfDay = Number(totalSessionMap.get(date) || 0);
      const totalExpenseOfDay = Number(expenseMap.get(date) || 0);
      const overheadPerSession = totalSessionsOfDay > 0 ? totalExpenseOfDay / totalSessionsOfDay : 0;
      const allocatedOverhead = Math.round(overheadPerSession * sessionCount);

      const adCostData = adCostMap.get(key);
      const adSpend = Number(adCostData?.adSpend || 0);
      const netProfit = grossProfit - allocatedOverhead - adSpend;

      const meta = adGroupMetaMap.get(adGroupId);
      daily.push({
        date,
        adGroupId,
        adGroupName: sessionData?.adGroupName || adCostData?.adGroupName || meta?.name || '',
        platform: adCostData?.platform || meta?.platform || '',
        sessionCount,
        revenue,
        teacherCost,
        grossProfit,
        totalExpenseOfDay,
        totalSessionsOfDay,
        overheadPerSession: Math.round(overheadPerSession),
        allocatedOverhead,
        adSpend,
        netProfit,
        netMargin: revenue > 0 ? Math.round((netProfit / revenue) * 10000) / 100 : 0,
      });
    }

    daily.sort((a, b) => a.date.localeCompare(b.date) || a.adGroupId.localeCompare(b.adGroupId));
    return daily;
  }

  async getAnalytics(startDate: string, endDate: string, adGroupId?: string, platform?: string): Promise<any> {
    const { start, end } = this.getUtcDateRange(startDate, endDate, this.maxAnalyticsRangeDays);
    const adGroupObjectId = this.parseOptionalObjectId(adGroupId);

    // Get ad costs aggregated by group
    const costMatch: any = { date: { $gte: start, $lte: end } };
    if (adGroupObjectId) costMatch.adGroupId = adGroupObjectId;
    if (platform) costMatch.platform = platform;

    const costsByGroup = await this.adCostModel.aggregate([
      { $match: costMatch },
      {
        $group: {
          _id: '$adGroupId',
          totalSpend: { $sum: { $ifNull: ['$spend', 0] } },
          totalImpressions: { $sum: { $ifNull: ['$impressions', 0] } },
          totalClicks: { $sum: { $ifNull: ['$clicks', 0] } },
          totalConversions: { $sum: { $ifNull: ['$conversions', 0] } },
          adGroupName: { $first: '$adGroupName' },
          platform: { $first: '$platform' },
        },
      },
    ]);
    const costMap = new Map(costsByGroup.map((c) => [c._id.toString(), c]));

    // Get leads count per ad group
    const leadMatch: any = { adGroupId: { $exists: true, $ne: null }, createdAt: { $gte: start, $lte: end } };
    if (adGroupObjectId) leadMatch.adGroupId = adGroupObjectId;

    const leadsByGroup = await this.leadModel.aggregate([
      { $match: leadMatch },
      { $group: { _id: '$adGroupId', leadCount: { $sum: 1 } } },
    ]);
    const leadMap = new Map(leadsByGroup.map(l => [l._id.toString(), l.leadCount]));

    // Get orders count and revenue per ad group
    const orderMatch: any = {
      adGroupId: { $exists: true, $ne: null },
      createdAt: { $gte: start, $lte: end },
      status: { $in: ['APPROVED', 'COMPLETED'] },
    };
    if (adGroupObjectId) orderMatch.adGroupId = adGroupObjectId;

    const ordersByGroup = await this.orderModel.aggregate([
      { $match: orderMatch },
      {
        $group: {
          _id: '$adGroupId',
          orderCount: { $sum: 1 },
          revenue: { $sum: '$finalAmount' },
        },
      },
    ]);
    const orderMap = new Map(ordersByGroup.map(o => [o._id.toString(), o]));

    // Calculate net profit with full business formula to keep all analytics consistent.
    const dailyNetProfit = await this.buildNetProfitDailyRows(start, end, adGroupObjectId);
    const netProfitByGroup = new Map<string, number>();
    const netProfitMetaByGroup = new Map<string, { adGroupName: string; platform: string }>();
    for (const row of dailyNetProfit) {
      if (platform && row.platform !== platform) continue;
      netProfitByGroup.set(row.adGroupId, (netProfitByGroup.get(row.adGroupId) || 0) + row.netProfit);
      if (!netProfitMetaByGroup.has(row.adGroupId)) {
        netProfitMetaByGroup.set(row.adGroupId, {
          adGroupName: row.adGroupName || '',
          platform: row.platform || '',
        });
      }
    }

    const allGroupIds = new Set<string>();
    for (const gId of costMap.keys()) allGroupIds.add(gId);
    for (const gId of leadMap.keys()) allGroupIds.add(gId);
    for (const gId of orderMap.keys()) allGroupIds.add(gId);
    for (const gId of netProfitByGroup.keys()) allGroupIds.add(gId);
    if (adGroupObjectId) allGroupIds.add(adGroupObjectId.toString());

    const adGroupMetaMap = new Map<string, { name: string; platform: string }>();
    const adGroupIds = Array.from(allGroupIds)
      .filter((id) => Types.ObjectId.isValid(id))
      .map((id) => new Types.ObjectId(id));
    if (adGroupIds.length > 0) {
      const groups = await this.adGroupModel
        .find({ _id: { $in: adGroupIds } })
        .select('_id name platform')
        .lean();
      for (const group of groups as any[]) {
        adGroupMetaMap.set(group._id.toString(), {
          name: group.name || '',
          platform: group.platform || '',
        });
      }
    }

    // Combine results from all data sources (cost, leads, orders, net-profit).
    const rows = Array.from(allGroupIds)
      .map((gId) => {
        const cost = costMap.get(gId);
        const groupMeta = adGroupMetaMap.get(gId);
        const netProfitMeta = netProfitMetaByGroup.get(gId);
        const resolvedPlatform = cost?.platform || netProfitMeta?.platform || groupMeta?.platform || '';

        if (platform && resolvedPlatform !== platform) return null;

      const leadCount = leadMap.get(gId) || 0;
      const orderData = orderMap.get(gId) || { orderCount: 0, revenue: 0 };
      const netProfit = netProfitByGroup.get(gId) || 0;
      const totalSpend = Number(cost?.totalSpend || 0);
      const roi = totalSpend > 0 ? (netProfit / totalSpend) * 100 : 0;

      return {
        adGroupId: gId,
        adGroupName: cost?.adGroupName || netProfitMeta?.adGroupName || groupMeta?.name || '',
        platform: resolvedPlatform,
        totalSpend,
        totalImpressions: Number(cost?.totalImpressions || 0),
        totalClicks: Number(cost?.totalClicks || 0),
        totalConversions: Number(cost?.totalConversions || 0),
        leadCount,
        orderCount: orderData.orderCount,
        revenue: orderData.revenue,
        costPerLead: leadCount > 0 ? Math.round(totalSpend / leadCount) : null,
        costPerOrder: orderData.orderCount > 0 ? Math.round(totalSpend / orderData.orderCount) : null,
        netProfit,
        roi: Math.round(roi * 100) / 100,
      };
    })
      .filter((row): row is NonNullable<typeof row> => row !== null)
      .sort((a, b) => b.totalSpend - a.totalSpend || b.netProfit - a.netProfit);

    // Summary
    const summary = {
      totalSpend: rows.reduce((s, r) => s + r.totalSpend, 0),
      totalLeads: rows.reduce((s, r) => s + r.leadCount, 0),
      totalOrders: rows.reduce((s, r) => s + r.orderCount, 0),
      totalRevenue: rows.reduce((s, r) => s + r.revenue, 0),
      totalNetProfit: rows.reduce((s, r) => s + r.netProfit, 0),
      avgCostPerLead: 0,
      avgCostPerOrder: 0,
      avgRoi: 0,
    };

    if (summary.totalLeads > 0) summary.avgCostPerLead = Math.round(summary.totalSpend / summary.totalLeads);
    if (summary.totalOrders > 0) summary.avgCostPerOrder = Math.round(summary.totalSpend / summary.totalOrders);
    if (summary.totalSpend > 0) summary.avgRoi = Math.round((summary.totalNetProfit / summary.totalSpend) * 10000) / 100;

    return { rows, summary };
  }

  // â”€â”€â”€ Net Profit By Ad Group (Per Day) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  /**
   * TÃ­nh lá»£i nhuáº­n thuáº§n trÃªn má»—i nhÃ³m quáº£ng cÃ¡o theo ngÃ y.
   *
   * CÃ´ng thá»©c:
   *   grossProfit = Î£(amountCharged - teacherPayout) cá»§a sessions thuá»™c adGroup ngÃ y Ä‘Ã³
   *   overheadPerSession = totalExpenses(ngÃ y) / totalSessions(ngÃ y)
   *   allocatedOverhead = overheadPerSession Ã— sessionCount(adGroup, ngÃ y)
   *   netProfit = grossProfit - allocatedOverhead - adSpend(adGroup, ngÃ y)
   */
  async getNetProfitByAdGroup(
    startDate: string,
    endDate: string,
    adGroupId?: string,
  ): Promise<any> {
    const { start, end } = this.getUtcDateRange(startDate, endDate, this.maxAnalyticsRangeDays);
    const adGroupObjectId = this.parseOptionalObjectId(adGroupId);
    const daily = await this.buildNetProfitDailyRows(start, end, adGroupObjectId);

    const groupSummaryMap = new Map<string, any>();
    for (const row of daily) {
      if (!groupSummaryMap.has(row.adGroupId)) {
        groupSummaryMap.set(row.adGroupId, {
          adGroupId: row.adGroupId,
          adGroupName: row.adGroupName,
          platform: row.platform,
          totalRevenue: 0,
          totalTeacherCost: 0,
          totalGrossProfit: 0,
          totalAllocatedOverhead: 0,
          totalAdSpend: 0,
          totalNetProfit: 0,
          totalSessions: 0,
          days: 0,
        });
      }
      const s = groupSummaryMap.get(row.adGroupId);
      s.totalRevenue += row.revenue;
      s.totalTeacherCost += row.teacherCost;
      s.totalGrossProfit += row.grossProfit;
      s.totalAllocatedOverhead += row.allocatedOverhead;
      s.totalAdSpend += row.adSpend;
      s.totalNetProfit += row.netProfit;
      s.totalSessions += row.sessionCount;
      s.days += 1;
    }

    const summaryByGroup = Array.from(groupSummaryMap.values())
      .map((s: any) => ({
        ...s,
        netMargin: s.totalRevenue > 0
          ? Math.round((s.totalNetProfit / s.totalRevenue) * 10000) / 100
          : 0,
        avgNetProfitPerDay: s.days > 0 ? Math.round(s.totalNetProfit / s.days) : 0,
        avgNetProfitPerSession: s.totalSessions > 0
          ? Math.round(s.totalNetProfit / s.totalSessions)
          : 0,
      }))
      .sort((a, b) => b.totalNetProfit - a.totalNetProfit);

    const overall = {
      totalRevenue: summaryByGroup.reduce((s, r) => s + r.totalRevenue, 0),
      totalTeacherCost: summaryByGroup.reduce((s, r) => s + r.totalTeacherCost, 0),
      totalGrossProfit: summaryByGroup.reduce((s, r) => s + r.totalGrossProfit, 0),
      totalAllocatedOverhead: summaryByGroup.reduce((s, r) => s + r.totalAllocatedOverhead, 0),
      totalAdSpend: summaryByGroup.reduce((s, r) => s + r.totalAdSpend, 0),
      totalNetProfit: summaryByGroup.reduce((s, r) => s + r.totalNetProfit, 0),
      totalSessions: summaryByGroup.reduce((s, r) => s + r.totalSessions, 0),
      netMargin: 0,
    };
    if (overall.totalRevenue > 0) {
      overall.netMargin = Math.round((overall.totalNetProfit / overall.totalRevenue) * 10000) / 100;
    }

    return { daily, summaryByGroup, overall };
  }
  /**
   * Dong bo du lieu tu Google MCC: tk quang cao, nhom QC, chi phi.
   * Uy quyen toan bo logic cho GoogleAdsProvider.
   */
  async syncGoogleMccToken(
    tokenId: string,
    dateStr?: string,
  ): Promise<import('./ads.types').BusinessTokenSyncResult> {
    return this.googleAdsProvider.syncGoogleMccToken(tokenId, dateStr);
  }

  /**
   * Dong bo du lieu tu TikTok Business Center: tk QC, nhom QC, chi phi.
   * Uy quyen toan bo logic cho TikTokAdsProvider.
   */
  async syncTikTokBusinessCenterToken(
    tokenId: string,
    dateStr?: string,
  ): Promise<import('./ads.types').BusinessTokenSyncResult> {
    return this.tikTokAdsProvider.syncTikTokBusinessCenterToken(tokenId, dateStr);
  }

  /**
   * Backfill ParentAttribution: duyet qua Leads, Orders co adGroupId va
   * upsert ParentAttribution docs de dam bao du lieu attribution day du
   * cho cac ban ghi cu truoc khi he thong co Attribution module.
   */
  async backfillParentAttribution(): Promise<{
    conversations: number;
    leads: number;
    orders: number;
    students: number;
    upserted: number;
  }> {
    let leads = 0;
    let orders = 0;
    let students = 0;
    let upserted = 0;
    const conversations = 0; // legacy field, no conversation model in this context

    // Backfill from Leads that have adGroupId but no ParentAttribution
    const leadsWithAd = await this.leadModel
      .find({ adGroupId: { $exists: true, $ne: null } })
      .select('_id adGroupId adGroupName parentPhone parentEmail tracking')
      .lean();

    for (const lead of leadsWithAd) {
      if (!lead.adGroupId) continue;
      try {
        const exists = await this.parentAttributionModel.findOne({
          sourceLeadId: lead._id,
        }).lean();
        if (exists) continue;

        await this.parentAttributionModel.create({
          parentKey: lead.parentPhone
            ? `phone:${String(lead.parentPhone).replace(/\D/g, '')}`
            : `lead:${String(lead._id)}`,
          normalizedParentPhone: lead.parentPhone
            ? String(lead.parentPhone).replace(/\D/g, '')
            : undefined,
          adGroupId: lead.adGroupId,
          adGroupName: (lead as any).adGroupName,
          tracking: (lead as any).tracking,
          sourceLeadId: lead._id,
          attributionModel: 'FIRST_TOUCH_LOCKED',
          firstAttributedAt: (lead as any).createdAt ?? new Date(),
          lastConfirmedAt: new Date(),
        });
        upserted++;
      } catch (err: any) {
        this.logger.warn(`backfillParentAttribution lead ${lead._id}: ${err.message}`);
      }
      leads++;
    }

    // Backfill from Students that have adGroupId but no Attribution via parentUserId
    const studentsWithAd = await this.studentModel
      .find({ adGroupId: { $exists: true, $ne: null }, parentUserId: { $exists: true, $ne: null } })
      .select('_id adGroupId adGroupName parentUserId')
      .lean();

    for (const student of studentsWithAd) {
      if (!student.adGroupId || !(student as any).parentUserId) continue;
      try {
        const exists = await this.parentAttributionModel.findOne({
          parentUserId: (student as any).parentUserId,
        }).lean();
        if (exists) continue;

        await this.parentAttributionModel.create({
          parentKey: `user:${String((student as any).parentUserId)}`,
          parentUserId: (student as any).parentUserId,
          adGroupId: student.adGroupId,
          adGroupName: (student as any).adGroupName,
          attributionModel: 'FIRST_TOUCH_LOCKED',
          firstAttributedAt: (student as any).createdAt ?? new Date(),
          lastConfirmedAt: new Date(),
        });
        upserted++;
      } catch (err: any) {
        this.logger.warn(`backfillParentAttribution student ${student._id}: ${err.message}`);
      }
      students++;
    }

    this.logger.log(
      `backfillParentAttribution done: leads=${leads}, students=${students}, upserted=${upserted}`,
    );
    return { conversations, leads, orders, students, upserted };
  }

  /**
   * Tinh lai doanh thu thuc te (totalRevenue), so leads (totalLeads) va
   * tong chi phi (totalSpend) cho tung nhom quang cao, sau do luu snapshot
   * vao AdGroup document de hien thi nhanh tren dashboard.
   *
   * Logic attribution:
   *   1. Leads truc tiep: Lead.adGroupId = group._id
   *   2. Students truc tiep: Student.adGroupId = group._id
   *   3. Students qua ParentAttribution: attribution.adGroupId = group._id
   *      -> lay parentUserId -> tim Students co cung parentUserId
   *   Gop tat ca studentIds -> lay Invoice APPROVED/PAID -> sum amount = totalRevenue
   */
  async syncTrueRevenue(adGroupId?: string): Promise<{
    groupsProcessed: number;
    totalLeadsUpdated: number;
    totalRevenueUpdated: number;
    errors: string[];
  }> {
    const filter: any = adGroupId ? { _id: new Types.ObjectId(adGroupId) } : {};
    const groups = await this.adGroupModel.find(filter).lean();

    let groupsProcessed = 0;
    let totalLeadsUpdated = 0;
    let totalRevenueUpdated = 0;
    const errors: string[] = [];

    for (const group of groups) {
      try {
        const gId = group._id as Types.ObjectId;

        // 1. Count leads directly attributed to this ad group
        const totalLeads = await this.leadModel.countDocuments({ adGroupId: gId });

        // 2. Total ad spend from AdCost records
        const spendAgg = await this.adCostModel.aggregate<{ total: number }>([
          { $match: { adGroupId: gId } },
          { $group: { _id: null, total: { $sum: '$spend' } } },
        ]);
        const totalSpend = spendAgg[0]?.total ?? 0;

        // 3a. Students directly attributed to this ad group
        const directStudents = await this.studentModel
          .find({ adGroupId: gId })
          .select('_id')
          .lean();

        // 3b. Students via ParentAttribution -> parentUserId
        const attributions = await this.parentAttributionModel
          .find({ adGroupId: gId })
          .select('parentUserId')
          .lean();

        const attributedParentIds = attributions
          .filter((a) => a.parentUserId)
          .map((a) => a.parentUserId as Types.ObjectId);

        const attributedStudents =
          attributedParentIds.length > 0
            ? await this.studentModel
                .find({ parentUserId: { $in: attributedParentIds } })
                .select('_id')
                .lean()
            : [];

        // Deduplicate student IDs
        const studentIdSet = new Set<string>([
          ...directStudents.map((s) => (s._id as Types.ObjectId).toString()),
          ...attributedStudents.map((s) => (s._id as Types.ObjectId).toString()),
        ]);

        // 4. Sum approved/paid invoices for those students
        let totalRevenue = 0;
        if (studentIdSet.size > 0) {
          const studentObjectIds = Array.from(studentIdSet).map(
            (id) => new Types.ObjectId(id),
          );
          const revenueAgg = await this.invoiceModel.aggregate<{ total: number }>([
            {
              $match: {
                studentId: { $in: studentObjectIds },
                status: { $in: [InvoiceStatus.APPROVED, InvoiceStatus.PAID] },
              },
            },
            { $group: { _id: null, total: { $sum: '$amount' } } },
          ]);
          totalRevenue = revenueAgg[0]?.total ?? 0;
        }

        // 5. Persist snapshot onto the AdGroup document
        await this.adGroupModel.updateOne(
          { _id: gId },
          {
            $set: {
              totalLeads,
              totalSpend,
              totalRevenue,
              revenueLastSyncedAt: new Date(),
            },
          },
        );

        groupsProcessed++;
        totalLeadsUpdated += totalLeads;
        totalRevenueUpdated += totalRevenue;
      } catch (err: any) {
        const msg = `AdGroup ${(group as any).name ?? String(group._id)}: ${err.message}`;
        errors.push(msg);
        this.logger.error(`syncTrueRevenue error: ${msg}`);
      }
    }

    this.logger.log(
      `syncTrueRevenue done: ${groupsProcessed} groups, totalRevenue=${totalRevenueUpdated}, errors=${errors.length}`,
    );
    return { groupsProcessed, totalLeadsUpdated, totalRevenueUpdated, errors };
  }

  async backfillAdGroupIds(): Promise<{
    studentsUpdated: number;
    sessionsUpdated: number;
  }> {
    let studentsUpdated = 0;
    let sessionsUpdated = 0;

    // TÃ¬m Orders cÃ³ adGroupId vÃ  processedResults.studentId
    const orders = await this.orderModel.find({
      adGroupId: { $exists: true, $ne: null },
      'processedResults.studentId': { $exists: true, $ne: null },
    }).lean();

    for (const order of orders) {
      const o = order as any;
      const studentId = o.processedResults?.studentId;
      if (!studentId) continue;

      // Update Student
      const studentResult = await this.studentModel.updateOne(
        { _id: studentId, adGroupId: { $exists: false } },
        {
          $set: {
            orderId: o._id,
            adGroupId: o.adGroupId,
            adGroupName: o.adGroupName || undefined,
          },
        },
      );
      if (studentResult.modifiedCount > 0) studentsUpdated++;

      // Update Sessions thuá»™c student nÃ y
      const sessionResult = await this.sessionModel.updateMany(
        { studentId: studentId, adGroupId: { $exists: false } },
        {
          $set: {
            orderId: o._id,
            adGroupId: o.adGroupId,
            adGroupName: o.adGroupName || undefined,
          },
        },
      );
      sessionsUpdated += sessionResult.modifiedCount;
    }

    this.logger.log(
      `Backfill complete: ${studentsUpdated} students, ${sessionsUpdated} sessions updated`,
    );

    return { studentsUpdated, sessionsUpdated };
  }

  // â”€â”€â”€ Budget Suggestions (Diminishing Marginal Returns) â”€â”€â”€â”€

  async getSuggestions(startDate: string, endDate: string, totalBudget: number): Promise<any> {
    if (!Number.isFinite(totalBudget) || totalBudget < 0) {
      throw new BadRequestException('totalBudget must be a non-negative number');
    }

    const normalizedBudget = Math.round(totalBudget);
    const { start, end } = this.getUtcDateRange(startDate, endDate, this.maxSuggestionRangeDays);
    const dailyRows = await this.buildNetProfitDailyRows(start, end);
    const maxDailyIncreaseFactor = 1.2; // cap: suggested spend <= previous-day spend * 120%

    if (!dailyRows.length) {
      return {
        totalBudget: normalizedBudget,
        allocated: 0,
        unallocated: normalizedBudget,
        totalSuggestedDailySpend: 0,
        expectedDailyNetProfit: 0,
        projectedMonthlySpend: 0,
        projectedMonthlyNetProfit: 0,
        dailySuggestedTotals: [],
        monthlyProjection: [],
        summaryTable: [],
        suggestions: [],
      };
    }

    const groupData = new Map<string, {
      adGroupName: string;
      platform: string;
      rows: NetProfitDailyRow[];
      points: Array<{ spend: number; netProfit: number }>;
    }>();

    for (const row of dailyRows) {
      if (!groupData.has(row.adGroupId)) {
        groupData.set(row.adGroupId, {
          adGroupName: row.adGroupName,
          platform: row.platform,
          rows: [],
          points: [],
        });
      }
      const target = groupData.get(row.adGroupId)!;
      target.rows.push(row);
      if (row.adSpend > 0) {
        target.points.push({ spend: row.adSpend, netProfit: row.netProfit });
      }
    }

    const minPoints = 7;
    const suggestions: SuggestionModel[] = [];

    for (const [gId, data] of groupData) {
      const currentAvgSpend = data.rows.length > 0
        ? Math.round(data.rows.reduce((sum, row) => sum + row.adSpend, 0) / data.rows.length)
        : 0;

      if (data.points.length < minPoints) {
        suggestions.push({
          adGroupId: gId,
          adGroupName: data.adGroupName,
          platform: data.platform,
          currentDailySpend: currentAvgSpend,
          suggestedDailySpend: 0,
          expectedDailyNetProfit: null,
          expectedDailyMarginalProfit: null,
          changePercent: null,
          confidence: 'LOW',
          dataPoints: data.points.length,
          coeffA: null,
          coeffB: null,
        });
        continue;
      }

      const fit = this.fitLogCurve(
        data.points.map((p) => p.spend),
        data.points.map((p) => p.netProfit),
      );

      suggestions.push({
        adGroupId: gId,
        adGroupName: data.adGroupName,
        platform: data.platform,
        currentDailySpend: currentAvgSpend,
        suggestedDailySpend: 0,
        expectedDailyNetProfit: null,
        expectedDailyMarginalProfit: null,
        changePercent: null,
        confidence: fit.rSquared >= 0.5 ? 'HIGH' : fit.rSquared >= 0.2 ? 'MEDIUM' : 'LOW',
        dataPoints: data.points.length,
        coeffA: fit.a,
        coeffB: fit.b,
      });
    }

    const allocations = new Map<string, number>();
    for (const s of suggestions) allocations.set(s.adGroupId, 0);

    let remainingBudget = normalizedBudget;
    const allocatable = suggestions.filter((s) => s.coeffA !== null && s.coeffA > 0);
    const step = 100000;

    if (allocatable.length > 0 && remainingBudget > 0) {
      while (remainingBudget >= step) {
        let bestGroup: SuggestionModel | null = null;
        let bestMarginal = -Infinity;

        for (const s of allocatable) {
          const currentAlloc = allocations.get(s.adGroupId) || 0;
          const marginal = (s.coeffA as number) / (currentAlloc + 1);
          if (marginal > bestMarginal) {
            bestMarginal = marginal;
            bestGroup = s;
          }
        }

        if (!bestGroup || bestMarginal <= 0) break;

        allocations.set(bestGroup.adGroupId, (allocations.get(bestGroup.adGroupId) || 0) + step);
        remainingBudget -= step;
      }

      if (remainingBudget > 0) {
        let bestGroup: SuggestionModel | null = null;
        let bestMarginal = -Infinity;

        for (const s of allocatable) {
          const currentAlloc = allocations.get(s.adGroupId) || 0;
          const marginal = (s.coeffA as number) / (currentAlloc + 1);
          if (marginal > bestMarginal) {
            bestMarginal = marginal;
            bestGroup = s;
          }
        }

        if (bestGroup && bestMarginal > 0) {
          allocations.set(bestGroup.adGroupId, (allocations.get(bestGroup.adGroupId) || 0) + remainingBudget);
          remainingBudget = 0;
        }
      }
    } else if (suggestions.length > 0 && remainingBudget > 0) {
      const weights = suggestions.map((s) => Math.max(0, s.currentDailySpend));
      const weightSum = weights.reduce((sum, value) => sum + value, 0);

      if (weightSum > 0) {
        let distributed = 0;
        for (let i = 0; i < suggestions.length; i++) {
          const s = suggestions[i];
          const isLast = i === suggestions.length - 1;
          const alloc = isLast
            ? remainingBudget - distributed
            : Math.floor((remainingBudget * weights[i]) / weightSum);
          allocations.set(s.adGroupId, alloc);
          distributed += alloc;
        }
      } else {
        const perGroup = Math.floor(remainingBudget / suggestions.length);
        let remainder = remainingBudget - (perGroup * suggestions.length);
        for (const s of suggestions) {
          const extra = remainder > 0 ? 1 : 0;
          allocations.set(s.adGroupId, perGroup + extra);
          if (remainder > 0) remainder -= 1;
        }
      }
      remainingBudget = 0;
    }

    const latestSpendByGroup = new Map<string, number>();
    for (const [gId, data] of groupData.entries()) {
      const sortedRows = [...data.rows].sort((a, b) => a.date.localeCompare(b.date));
      const latest = sortedRows[sortedRows.length - 1];
      latestSpendByGroup.set(gId, latest?.adSpend || 0);
    }

    const cappedAllocations = new Map<string, number>();
    const capInfoByGroup = new Map<string, {
      previousDayAdSpend: number | null;
      capByPreviousDay: number | null;
      cappedByDailyGuard: boolean;
    }>();
    for (const s of suggestions) {
      const rawAlloc = allocations.get(s.adGroupId) || 0;
      const latestSpend = latestSpendByGroup.get(s.adGroupId) || 0;
      if (latestSpend > 0) {
        const capByPreviousDay = Math.round(latestSpend * maxDailyIncreaseFactor);
        const suggested = Math.min(rawAlloc, capByPreviousDay);
        cappedAllocations.set(s.adGroupId, suggested);
        capInfoByGroup.set(s.adGroupId, {
          previousDayAdSpend: latestSpend,
          capByPreviousDay,
          cappedByDailyGuard: rawAlloc > capByPreviousDay,
        });
      } else {
        cappedAllocations.set(s.adGroupId, rawAlloc);
        capInfoByGroup.set(s.adGroupId, {
          previousDayAdSpend: null,
          capByPreviousDay: null,
          cappedByDailyGuard: false,
        });
      }
    }

    let expectedDailyNetProfit = 0;
    for (const s of suggestions) {
      const alloc = cappedAllocations.get(s.adGroupId) || 0;
      s.suggestedDailySpend = alloc;

      if (s.coeffA !== null && s.coeffB !== null) {
        const predicted = s.coeffA * Math.log(alloc + 1) + s.coeffB;
        const marginal = s.coeffA / (alloc + 1);
        s.expectedDailyNetProfit = Math.round(predicted);
        s.expectedDailyMarginalProfit = Math.round(marginal * 100) / 100;
        expectedDailyNetProfit += s.expectedDailyNetProfit;
      }

      s.changePercent = s.currentDailySpend > 0
        ? Math.round(((alloc - s.currentDailySpend) / s.currentDailySpend) * 100)
        : null;
    }

    const totalSuggestedDailySpend = suggestions.reduce((sum, row) => sum + row.suggestedDailySpend, 0);

    const summaryTable = dailyRows
      .map((row) => {
        const rawSuggestedAdSpend = allocations.get(row.adGroupId) || 0;
        const suggestedAdSpend = cappedAllocations.get(row.adGroupId) || 0;
        const capInfo = capInfoByGroup.get(row.adGroupId);
        return {
          date: row.date,
          adGroupId: row.adGroupId,
          adGroupName: row.adGroupName,
          platform: row.platform,
          netProfit: row.netProfit,
          actualAdSpend: row.adSpend,
          rawSuggestedAdSpend,
          suggestedAdSpend,
          previousDayAdSpend: capInfo?.previousDayAdSpend ?? null,
          capByPreviousDay: capInfo?.capByPreviousDay ?? null,
          cappedByDailyGuard: capInfo?.cappedByDailyGuard ?? false,
        };
      })
      .sort((a, b) => a.date.localeCompare(b.date) || a.adGroupId.localeCompare(b.adGroupId));

    const netProfitByDate = new Map<string, number>();
    for (const row of summaryTable) {
      netProfitByDate.set(row.date, (netProfitByDate.get(row.date) || 0) + row.netProfit);
    }
    const uniqueDates = Array.from(new Set(dailyRows.map((row) => row.date))).sort();
    const dailySuggestedTotals = uniqueDates.map((date) => ({
      date,
      totalNetProfit: netProfitByDate.get(date) || 0,
      totalSuggestedAdSpend: totalSuggestedDailySpend,
    }));

    const monthlyProjection = Array.from(new Set(dailySuggestedTotals.map((row) => row.date.slice(0, 7))))
      .sort()
      .map((month) => {
        const [yearStr, monthStr] = month.split('-');
        const year = Number(yearStr);
        const monthNumber = Number(monthStr);
        const monthDate = new Date(Date.UTC(year, monthNumber - 1, 1));
        const days = this.daysInMonth(monthDate);
        return {
          month,
          daysInMonth: days,
          projectedSpend: totalSuggestedDailySpend * days,
          projectedNetProfit: Math.round(expectedDailyNetProfit * days),
        };
      });

    const cleanSuggestions = suggestions
      .map(({ coeffA, coeffB, ...item }) => item)
      .sort((a, b) => b.suggestedDailySpend - a.suggestedDailySpend);

    return {
      totalBudget: normalizedBudget,
      allocated: totalSuggestedDailySpend,
      unallocated: Math.max(0, normalizedBudget - totalSuggestedDailySpend),
      totalSuggestedDailySpend,
      expectedDailyNetProfit,
      projectedMonthlySpend: monthlyProjection[0]?.projectedSpend || 0,
      projectedMonthlyNetProfit: monthlyProjection[0]?.projectedNetProfit || 0,
      dailySuggestedTotals,
      monthlyProjection,
      summaryTable,
      suggestions: cleanSuggestions,
    };
  }
  /**
   * Fit: y = a * ln(x + 1) + b using least squares
   * Returns coefficients and R-squared
   */
  private fitLogCurve(xValues: number[], yValues: number[]): { a: number; b: number; rSquared: number } {
    const n = xValues.length;
    if (n < 2) return { a: 0, b: 0, rSquared: 0 };

    // Transform: let X = ln(x + 1), fit Y = a*X + b
    const X = xValues.map(x => Math.log(x + 1));
    const Y = yValues;

    const sumX = X.reduce((s, v) => s + v, 0);
    const sumY = Y.reduce((s, v) => s + v, 0);
    const sumXY = X.reduce((s, v, i) => s + v * Y[i], 0);
    const sumXX = X.reduce((s, v) => s + v * v, 0);

    const denom = n * sumXX - sumX * sumX;
    if (Math.abs(denom) < 1e-10) return { a: 0, b: sumY / n, rSquared: 0 };

    const a = (n * sumXY - sumX * sumY) / denom;
    const b = (sumY - a * sumX) / n;

    // R-squared
    const meanY = sumY / n;
    const ssTotal = Y.reduce((s, y) => s + (y - meanY) ** 2, 0);
    const ssResidual = Y.reduce((s, y, i) => s + (y - (a * X[i] + b)) ** 2, 0);
    const rSquared = ssTotal > 0 ? 1 - ssResidual / ssTotal : 0;

    return { a, b, rSquared: Math.max(0, rSquared) };
  }
}





