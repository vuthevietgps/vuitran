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
import * as crypto from 'crypto';

import {
  ApiToken,
  ApiTokenDocument,
  ApiTokenStatus,
  ApiTokenType,
} from './schemas/api-token.schema';
import {
  AdAccount,
  AdAccountDocument,
} from './schemas/ad-account.schema';
import {
  Fanpage,
  FanpageDocument,
  FanpageSyncSource,
} from '../chatbot/schemas/fanpage.schema';
import { CreateApiTokenDto } from './dto/create-api-token.dto';
import { UpdateApiTokenDto } from './dto/update-api-token.dto';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';

@Injectable()
export class AdsTokenService {
  private readonly logger = new Logger(AdsTokenService.name);
  private encryptionKey: Buffer | null = null;

  constructor(
    @InjectModel(ApiToken.name) private apiTokenModel: Model<ApiTokenDocument>,
    @InjectModel(AdAccount.name) private adAccountModel: Model<AdAccountDocument>,
    @InjectModel(Fanpage.name) private fanpageModel: Model<FanpageDocument>,
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

  // ─── Encryption helpers ─────────────────────────────────

  private requireEncryptionKey(): Buffer {
    if (!this.encryptionKey) {
      throw new InternalServerErrorException(
        'Token encryption is not configured. Please set TOKEN_ENCRYPTION_KEY.',
      );
    }
    return this.encryptionKey;
  }

  encrypt(plainText: string): string {
    const key = this.requireEncryptionKey();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    let encrypted = cipher.update(plainText, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
  }

  decrypt(cipherText: string): string {
    const key = this.requireEncryptionKey();
    const parts = cipherText.split(':');
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

  // ─── Token CRUD ─────────────────────────────────────────

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
      const account = await this.findOneAccountInternal(dto.adAccountId);
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
      const account = await this.findOneAccountInternal(nextAccountId);
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

    await this.fanpageModel.updateMany(
      { syncTokenId: token._id },
      {
        $unset: { syncTokenId: 1, syncTokenLabel: 1 },
        $set: { syncSource: FanpageSyncSource.MANUAL },
      },
    );

    await this.apiTokenModel.findByIdAndDelete(id).exec();
  }

  // ─── Token helpers ──────────────────────────────────────

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

  async findBestActiveToken(filter: Record<string, any>): Promise<ApiTokenDocument | null> {
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

    if (!validTokens.length) return null;

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

  async getTokenByIdForUse(id: string): Promise<ApiTokenDocument> {
    const token = await this.apiTokenModel.findById(id).exec();
    if (!token) throw new NotFoundException('Token không tồn tại');
    if (token.status !== ApiTokenStatus.ACTIVE) {
      throw new BadRequestException('Token không còn hoạt động.');
    }
    if (token.expiresAt && token.expiresAt < new Date()) {
      token.status = ApiTokenStatus.EXPIRED;
      await token.save();
      throw new BadRequestException('Token đã hết hạn.');
    }
    token.lastUsedAt = new Date();
    await token.save();
    return token;
  }

  async getDecryptedToken(accountId: string): Promise<string | null> {
    const token = await this.findBestActiveToken({
      adAccountId: accountId,
      tokenType: ApiTokenType.ACCOUNT,
    });
    return token ? this.decrypt(token.accessToken) : null;
  }

  async findActiveBusinessTokens(): Promise<ApiTokenDocument[]> {
    return this.apiTokenModel.find({
      platform: 'FACEBOOK',
      tokenType: ApiTokenType.FACEBOOK_SYSTEM_USER,
      status: ApiTokenStatus.ACTIVE,
    }).sort({ createdAt: -1 }).exec();
  }

  async markTokenSynced(token: ApiTokenDocument): Promise<void> {
    token.lastUsedAt = new Date();
    token.lastSyncedAt = new Date();
    await token.save();
  }

  // ─── Internal helpers ───────────────────────────────────

  private async findOneAccountInternal(id: string): Promise<AdAccountDocument> {
    const account = await this.adAccountModel.findById(id).exec();
    if (!account) throw new NotFoundException('Tài khoản quảng cáo không tồn tại');
    return account;
  }
}
