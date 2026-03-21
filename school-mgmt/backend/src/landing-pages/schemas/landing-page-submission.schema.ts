import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
import {
  TrackingAttribution,
  TrackingAttributionSchema,
} from '../../marketing-attribution/schemas/tracking-attribution.schema';

export type LandingPageSubmissionDocument = HydratedDocument<LandingPageSubmission>;

export enum LandingPageMatchSource {
  NONE = 'NONE',
  USER_PHONE = 'USER_PHONE',
  USER_EMAIL = 'USER_EMAIL',
  STUDENT_PARENT = 'STUDENT_PARENT',
}

@Schema({ timestamps: true })
export class LandingPageSubmission {
  @Prop({ required: true, trim: true, unique: true })
  submissionCode!: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'LandingPage', required: true })
  landingPageId!: Types.ObjectId;

  @Prop({ type: String, trim: true, required: true })
  landingPageName!: string;

  @Prop({ type: String, trim: true, required: true })
  landingPageSlug!: string;

  @Prop({ type: String, trim: true, required: true })
  parentName!: string;

  @Prop({ type: String, trim: true, required: true })
  parentPhone!: string;

  @Prop({ type: String, trim: true })
  normalizedParentPhone?: string;

  @Prop({ type: String, trim: true })
  hashedParentPhoneSha256?: string;

  @Prop({ type: String, trim: true })
  parentEmail?: string;

  @Prop({ type: String, trim: true })
  normalizedParentEmail?: string;

  @Prop({ type: String, trim: true })
  hashedParentEmailSha256?: string;

  @Prop({ type: String, trim: true })
  studentName?: string;

  @Prop({ type: String, trim: true })
  studentGrade?: string;

  @Prop({ type: String, trim: true })
  notes?: string;

  @Prop({ type: String, trim: true })
  platform?: string;

  @Prop({ type: String, trim: true })
  adRefParam?: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'AdGroup' })
  adGroupId?: Types.ObjectId;

  @Prop({ type: String, trim: true })
  adGroupName?: string;

  @Prop({ type: TrackingAttributionSchema })
  tracking?: TrackingAttribution;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User' })
  matchedParentUserId?: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Wallet' })
  matchedWalletId?: Types.ObjectId;

  @Prop({ type: String, enum: Object.values(LandingPageMatchSource), default: LandingPageMatchSource.NONE })
  matchSource!: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Lead' })
  leadId?: Types.ObjectId;

  @Prop({ type: String, trim: true })
  leadCode?: string;
}

export const LandingPageSubmissionSchema = SchemaFactory.createForClass(LandingPageSubmission);
LandingPageSubmissionSchema.index({ landingPageId: 1, createdAt: -1 });
LandingPageSubmissionSchema.index({ normalizedParentPhone: 1, createdAt: -1 });
LandingPageSubmissionSchema.index({ adGroupId: 1, createdAt: -1 });
