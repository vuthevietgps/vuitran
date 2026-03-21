import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
import { AdPlatform } from './ad-account.schema';

export type AdGroupDocument = HydratedDocument<AdGroup>;

export enum AdGroupStatus {
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  ARCHIVED = 'ARCHIVED',
}

export enum AdGroupSyncSource {
  MANUAL = 'MANUAL',
  FACEBOOK_BM = 'FACEBOOK_BM',
  GOOGLE_MCC = 'GOOGLE_MCC',
  TIKTOK_BC = 'TIKTOK_BC',
}

@Schema({ timestamps: true })
export class AdGroup {
  @Prop({ required: true, trim: true, unique: true })
  groupCode!: string;

  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'AdAccount', required: true })
  adAccountId!: Types.ObjectId;

  @Prop({ type: String, trim: true })
  adAccountName?: string;

  @Prop({ type: String, enum: Object.values(AdPlatform), required: true })
  platform!: string;

  @Prop({ required: true, trim: true })
  platformCampaignId!: string;

  @Prop({ type: [String], default: [] })
  trackingKeys?: string[];

  @Prop({ type: String, enum: Object.values(AdGroupStatus), default: AdGroupStatus.ACTIVE })
  status!: string;

  @Prop({ type: Number, min: 0, default: 0 })
  dailyBudget?: number;

  @Prop({ type: String, enum: Object.values(AdGroupSyncSource), default: AdGroupSyncSource.MANUAL })
  syncSource!: string;

  @Prop({ type: Date })
  lastSyncedAt?: Date;

  @Prop({ type: Date })
  startDate?: Date;

  @Prop({ type: Date })
  endDate?: Date;

  @Prop({ type: String, trim: true })
  targetAudience?: string;

  @Prop({ type: String, trim: true })
  notes?: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true })
  createdById!: Types.ObjectId;

  @Prop({ type: String, trim: true })
  createdByName?: string;

  // ─── Cached revenue snapshot (populated by syncTrueRevenue) ───────────────

  /** Tổng số Leads thu được từ nhóm quảng cáo này */
  @Prop({ type: Number, min: 0, default: 0 })
  totalLeads?: number;

  /** Tổng chi phí quảng cáo (VNĐ) — lấy từ AdCost.spend */
  @Prop({ type: Number, min: 0, default: 0 })
  totalSpend?: number;

  /** Tổng doanh thu thực tế (VNĐ) — lấy từ Invoice APPROVED/PAID */
  @Prop({ type: Number, min: 0, default: 0 })
  totalRevenue?: number;

  /** Thời điểm đồng bộ doanh thu gần nhất */
  @Prop({ type: Date })
  revenueLastSyncedAt?: Date;
}

export const AdGroupSchema = SchemaFactory.createForClass(AdGroup);
AdGroupSchema.index({ adAccountId: 1 });
AdGroupSchema.index({ adAccountId: 1, platformCampaignId: 1 }, { unique: true });
AdGroupSchema.index({ platform: 1, status: 1 });
AdGroupSchema.index({ trackingKeys: 1 });
AdGroupSchema.index({ createdAt: -1 });

