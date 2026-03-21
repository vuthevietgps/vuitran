import { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { AdAccountDocument } from '../schemas/ad-account.schema';
import { AdGroupDocument } from '../schemas/ad-group.schema';
import { AdCost, AdCostDocument, AdCostSource } from '../schemas/ad-cost.schema';
import { FanpageDocument } from '../../chatbot/schemas/fanpage.schema';
import { ApiTokenDocument, ApiTokenStatus } from '../schemas/api-token.schema';
import { CreateAdCostDto } from '../dto/create-ad-cost.dto';
import { isDuplicateKeyError, normalizeToUtcDay, toUtcDateOnlyString } from '../ads.utils';

export abstract class BaseAdPlatformService {
  protected readonly logger = new Logger(this.constructor.name);

  constructor(
    protected readonly adAccountModel: Model<AdAccountDocument>,
    protected readonly adGroupModel: Model<AdGroupDocument>,
    protected readonly fanpageModel: Model<FanpageDocument>,
    protected readonly adCostModel: Model<AdCostDocument>,
    protected readonly apiTokenModel: Model<ApiTokenDocument>,
    protected readonly configService: ConfigService
  ) {}

  protected async generateAccountCode(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `ACC-${year}-`;
    for (let attempt = 0; attempt < 5; attempt++) {
      const count = await this.adAccountModel.countDocuments({ accountCode: { $regex: `^${prefix}` } });
      const code = `${prefix}${String(count + 1 + attempt).padStart(4, '0')}`;
      const exists = await this.adAccountModel.findOne({ accountCode: code }).lean();
      if (!exists) return code;
    }
    throw new Error('Could not generate unique account code');
  }

  protected async generateGroupCode(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `ADG-${year}-`;
    for (let attempt = 0; attempt < 5; attempt++) {
      const count = await this.adGroupModel.countDocuments({ groupCode: { $regex: `^${prefix}` } });
      const code = `${prefix}${String(count + 1 + attempt).padStart(4, '0')}`;
      const exists = await this.adGroupModel.findOne({ groupCode: code }).lean();
      if (!exists) return code;
    }
    throw new Error('Could not generate unique group code');
  }

  protected async generateFanpageCode(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `FP-${year}-`;
    for (let attempt = 0; attempt < 5; attempt++) {
      const count = await this.fanpageModel.countDocuments({ fanpageCode: { $regex: `^${prefix}` } });
      const code = `${prefix}${String(count + 1 + attempt).padStart(4, '0')}`;
      const exists = await this.fanpageModel.exists({ fanpageCode: code });
      if (!exists) return code;
    }
    throw new Error('Could not generate unique fanpage code');
  }

  protected async fetchWithRetry(url: string, options: any = {}, retries = 3): Promise<any> {
    for (let i = 0; i < retries; i++) {
      try {
        const response = await fetch(url, options);
        if (!response.ok) {
          const body = await response.text();
          throw new Error(`HTTP ${response.status}: ${body}`);
        }
        return await response.json();
      } catch (err: any) {
        if (i === retries - 1) throw err;
        await new Promise((resolve) => setTimeout(resolve, 1000 * Math.pow(2, i)));
      }
    }
  }

  protected requireEncryptionKey(): Buffer {
    const keyString = this.configService.get<string>('API_TOKEN_ENCRYPTION_KEY', '');
    if (!keyString || keyString.length !== 64) {
      throw new Error('API_TOKEN_ENCRYPTION_KEY must be a 64-character hex string');
    }
    return Buffer.from(keyString, 'hex');
  }

  protected encrypt(plainText: string): string {
    const key = this.requireEncryptionKey();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    let encrypted = cipher.update(plainText, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
  }

  protected decrypt(cipherText: string): string {
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

  protected async getTokenByIdForUse(id: string): Promise<ApiTokenDocument> {
    const token = await this.apiTokenModel.findById(id).exec();
    if (!token) throw new NotFoundException('Token không tồn tại');
    if (token.status !== ApiTokenStatus.ACTIVE) throw new BadRequestException('Token không còn hoạt động.');
    if (token.expiresAt && token.expiresAt < new Date()) {
      token.status = ApiTokenStatus.EXPIRED;
      await token.save();
      throw new BadRequestException('Token đã hết hạn.');
    }
    token.lastUsedAt = new Date();
    await token.save();
    return token;
  }

  protected normalizeToUtcDay(input: string | Date): Date {
    return normalizeToUtcDay(input);
  }

  protected toUtcDateOnlyString(date: Date): string {
    return toUtcDateOnlyString(date);
  }

  protected getSyncLookbackDays(): number {
    const rawValue = Number(this.configService.get<string>('AD_SYNC_LOOKBACK_DAYS', '3'));
    if (!Number.isFinite(rawValue)) return 3;
    return Math.max(1, Math.min(14, Math.floor(rawValue)));
  }

  protected buildRollingSyncDates(lookbackDays: number): Date[] {
    const dates: Date[] = [];
    for (let offset = 1; offset <= lookbackDays; offset++) {
      dates.push(this.normalizeToUtcDay(new Date(Date.now() - (offset * 86400000))));
    }
    return dates;
  }

  protected parseOptionalUtcDate(value?: string): Date | undefined {
    if (!value) return undefined;
    try { return this.normalizeToUtcDay(value); } catch { return undefined; }
  }

  protected getExchangeRate(currency: string): number {
    if (currency === 'USD') {
      return Number(this.configService.get<string>('USD_TO_VND', '25000'));
    }
    return 1;
  }

  protected convertSpendToVnd(amount: number, currency?: string): number {
    const normalized = String(currency || '').trim().toUpperCase();
    if (!normalized || normalized === 'VND') return amount;
    if (normalized === 'USD') return amount * this.getExchangeRate('USD');
    return amount;
  }

  protected async createOrUpdateCost(dto: CreateAdCostDto): Promise<AdCost> {
    const costDate = this.normalizeToUtcDay(dto.date);

    const group = await this.adGroupModel.findById(dto.adGroupId).exec();
    if (!group) throw new BadRequestException('Nhóm quảng cáo không tồn tại');
    
    if (String(group.adAccountId) !== String(dto.adAccountId)) {
      throw new BadRequestException('Nhóm quảng cáo không thuộc tài khoản quảng cáo đã chọn');
    }
    if (String(group.platform) !== String(dto.platform)) {
      throw new BadRequestException('Nền tảng quảng cáo không khớp với nhóm quảng cáo');
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
      if (isDuplicateKeyError(err)) {
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
}
