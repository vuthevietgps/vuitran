import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
import { AdPlatform } from './ad-account.schema';

export type ApiTokenDocument = HydratedDocument<ApiToken>;

export enum ApiTokenStatus {
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
  REVOKED = 'REVOKED',
}

export enum ApiTokenType {
  ACCOUNT = 'ACCOUNT',
  FACEBOOK_SYSTEM_USER = 'FACEBOOK_SYSTEM_USER',
  GOOGLE_MCC = 'GOOGLE_MCC',
  TIKTOK_BUSINESS_CENTER = 'TIKTOK_BUSINESS_CENTER',
}

@Schema({ timestamps: true })
export class ApiToken {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'AdAccount' })
  adAccountId?: Types.ObjectId;

  @Prop({ type: String, trim: true })
  adAccountName?: string;

  @Prop({ type: String, enum: Object.values(AdPlatform), required: true })
  platform!: string;

  @Prop({ type: String, enum: Object.values(ApiTokenType), default: ApiTokenType.ACCOUNT })
  tokenType!: string;

  @Prop({ type: String, trim: true })
  businessId?: string;

  @Prop({ type: String, trim: true })
  businessName?: string;

  @Prop({ required: true })
  accessToken!: string;

  @Prop({ type: String })
  refreshToken?: string;

  @Prop({ type: Date })
  expiresAt?: Date;

  @Prop({ type: String, enum: Object.values(ApiTokenStatus), default: ApiTokenStatus.ACTIVE })
  status!: string;

  @Prop({ type: Date })
  lastUsedAt?: Date;

  @Prop({ type: Date })
  lastSyncedAt?: Date;

  @Prop({ type: String, trim: true })
  label?: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true })
  createdById!: Types.ObjectId;
}

export const ApiTokenSchema = SchemaFactory.createForClass(ApiToken);

ApiTokenSchema.index({ adAccountId: 1 }, { sparse: true });
ApiTokenSchema.index({ businessId: 1 }, { sparse: true });
ApiTokenSchema.index({ platform: 1, tokenType: 1, status: 1 });
ApiTokenSchema.index({ adAccountId: 1, status: 1, expiresAt: -1, createdAt: -1 }, { sparse: true });
ApiTokenSchema.index({ businessId: 1, tokenType: 1, status: 1, createdAt: -1 }, { sparse: true });
