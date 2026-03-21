import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

export type AdAccountDocument = HydratedDocument<AdAccount>;

export enum AdPlatform {
  FACEBOOK = 'FACEBOOK',
  GOOGLE = 'GOOGLE',
  TIKTOK = 'TIKTOK',
}

export enum AdAccountStatus {
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  DISABLED = 'DISABLED',
}

export enum AdAccountSyncSource {
  MANUAL = 'MANUAL',
  FACEBOOK_BM = 'FACEBOOK_BM',
  GOOGLE_MCC = 'GOOGLE_MCC',
  TIKTOK_BC = 'TIKTOK_BC',
}

@Schema({ timestamps: true })
export class AdAccount {
  @Prop({ required: true, trim: true, unique: true })
  accountCode!: string;

  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ type: String, enum: Object.values(AdPlatform), required: true })
  platform!: string;

  @Prop({ required: true, trim: true })
  platformAccountId!: string;

  @Prop({ type: String, enum: Object.values(AdAccountStatus), default: AdAccountStatus.ACTIVE })
  status!: string;

  @Prop({ type: Number, min: 0, default: 0 })
  monthlyBudget?: number;

  @Prop({ type: String, trim: true, uppercase: true })
  currency?: string;

  @Prop({ type: String, trim: true })
  businessId?: string;

  @Prop({ type: String, trim: true })
  businessName?: string;

  @Prop({ type: String, enum: Object.values(AdAccountSyncSource), default: AdAccountSyncSource.MANUAL })
  syncSource!: string;

  @Prop({ type: Date })
  lastSyncedAt?: Date;

  @Prop({ type: String, trim: true })
  notes?: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true })
  createdById!: Types.ObjectId;

  @Prop({ type: String, trim: true })
  createdByName?: string;
}

export const AdAccountSchema = SchemaFactory.createForClass(AdAccount);
AdAccountSchema.index({ platform: 1 });
AdAccountSchema.index({ status: 1 });
AdAccountSchema.index({ businessId: 1 }, { sparse: true });
AdAccountSchema.index({ createdAt: -1 });

