import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
import { AdPlatform } from '../../ads/schemas/ad-account.schema';

export type LandingPageDocument = HydratedDocument<LandingPage>;

export enum LandingPageStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  ARCHIVED = 'ARCHIVED',
}

@Schema({ timestamps: true })
export class LandingPage {
  @Prop({ required: true, trim: true, unique: true })
  pageCode!: string;

  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ required: true, trim: true, unique: true, lowercase: true })
  slug!: string;

  @Prop({ type: String, enum: Object.values(LandingPageStatus), default: LandingPageStatus.DRAFT })
  status!: string;

  @Prop({ type: String, trim: true })
  heroTitle?: string;

  @Prop({ type: String, trim: true })
  heroSubtitle?: string;

  @Prop({ type: String, trim: true })
  formTitle?: string;

  @Prop({ type: String, trim: true })
  formDescription?: string;

  @Prop({ type: String, trim: true })
  submitButtonText?: string;

  @Prop({ type: String, trim: true })
  privacyNotice?: string;

  @Prop({ type: String, trim: true })
  successTitle?: string;

  @Prop({ type: String, trim: true })
  successMessage?: string;

  @Prop({ type: String })
  bodyHtml?: string;

  @Prop({ type: String, enum: Object.values(AdPlatform) })
  defaultPlatform?: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'AdGroup' })
  defaultAdGroupId?: Types.ObjectId;

  @Prop({ type: String, trim: true })
  defaultAdGroupName?: string;

  @Prop({ type: Boolean, default: true })
  autoCreateLead!: boolean;

  @Prop({ type: String, trim: true })
  metaPixelId?: string;

  @Prop({ type: String, trim: true })
  googleTagId?: string;

  @Prop({ type: String, trim: true })
  googleAdsConversionId?: string;

  @Prop({ type: String, trim: true })
  googleAdsConversionLabel?: string;

  @Prop({ type: String, trim: true })
  tiktokPixelId?: string;

  @Prop({ type: String })
  customHeadHtml?: string;

  @Prop({ type: String })
  customBodyHtml?: string;

  @Prop({ type: String, trim: true })
  notes?: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true })
  createdById!: Types.ObjectId;

  @Prop({ type: String, trim: true })
  createdByName?: string;
}

export const LandingPageSchema = SchemaFactory.createForClass(LandingPage);
LandingPageSchema.index({ status: 1, createdAt: -1 });
