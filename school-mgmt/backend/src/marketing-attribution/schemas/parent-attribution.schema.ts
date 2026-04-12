import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
import {
  TrackingAttribution,
  TrackingAttributionSchema,
} from './tracking-attribution.schema';

export type ParentAttributionDocument = HydratedDocument<ParentAttribution>;

export enum ParentAttributionModel {
  FIRST_TOUCH_LOCKED = 'FIRST_TOUCH_LOCKED',
  LAST_TOUCH = 'LAST_TOUCH',
  MANUAL_OVERRIDE = 'MANUAL_OVERRIDE',
}

export enum ParentAttributionSourceType {
  CONVERSATION = 'CONVERSATION',
  LANDING_PAGE = 'LANDING_PAGE',
  LEAD = 'LEAD',
  ORDER = 'ORDER',
  REFERRAL = 'REFERRAL',
  STUDENT = 'STUDENT',
  MANUAL = 'MANUAL',
  SYSTEM = 'SYSTEM',
}

@Schema({ _id: false })
export class ParentAttributionTouchpoint {
  @Prop({ type: Date, default: Date.now })
  capturedAt!: Date;

  @Prop({ type: Date })
  firstTouchedAt?: Date;

  @Prop({ type: Date })
  lastConfirmedAt?: Date;

  @Prop({ type: String, enum: Object.values(ParentAttributionModel) })
  attributionModel?: string;

  @Prop({ type: String, enum: Object.values(ParentAttributionSourceType), required: true })
  sourceType!: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User' })
  parentUserId?: Types.ObjectId;

  @Prop({ type: String, trim: true })
  parentPhone?: string;

  @Prop({ type: String, trim: true })
  normalizedParentPhone?: string;

  @Prop({ type: String, trim: true })
  parentEmail?: string;

  @Prop({ type: String, trim: true })
  normalizedParentEmail?: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'AdGroup' })
  adGroupId?: Types.ObjectId;

  @Prop({ type: String, trim: true })
  adGroupName?: string;

  @Prop({ type: String, trim: true })
  platform?: string;

  @Prop({ type: String, trim: true })
  adRefParam?: string;

  @Prop({ type: TrackingAttributionSchema })
  tracking?: TrackingAttribution;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Conversation' })
  sourceConversationId?: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Lead' })
  sourceLeadId?: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Order' })
  sourceOrderId?: Types.ObjectId;

  @Prop({ type: String, trim: true })
  notes?: string;
}

export const ParentAttributionTouchpointSchema = SchemaFactory.createForClass(ParentAttributionTouchpoint);

@Schema({ timestamps: true })
export class ParentAttribution {
  @Prop({ required: true, trim: true, unique: true })
  parentKey!: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User' })
  parentUserId?: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User' })
  referredByUserId?: Types.ObjectId;

  @Prop({ type: String, trim: true })
  parentPhone?: string;

  @Prop({ type: String, trim: true })
  normalizedParentPhone?: string;

  @Prop({ type: String, trim: true })
  parentEmail?: string;

  @Prop({ type: String, trim: true })
  normalizedParentEmail?: string;

  @Prop({ type: String, trim: true })
  hashedParentPhoneSha256?: string;

  @Prop({ type: String, trim: true })
  hashedParentEmailSha256?: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'AdGroup' })
  adGroupId?: Types.ObjectId;

  @Prop({ type: String, trim: true })
  adGroupName?: string;

  @Prop({ type: String, trim: true })
  platform?: string;

  @Prop({ type: String, trim: true })
  adRefParam?: string;

  @Prop({ type: TrackingAttributionSchema })
  tracking?: TrackingAttribution;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Conversation' })
  sourceConversationId?: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Lead' })
  sourceLeadId?: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Order' })
  sourceOrderId?: Types.ObjectId;

  @Prop({
    type: String,
    enum: Object.values(ParentAttributionModel),
    default: ParentAttributionModel.FIRST_TOUCH_LOCKED,
  })
  attributionModel!: string;

  @Prop({
    type: String,
    enum: Object.values(ParentAttributionSourceType),
    default: ParentAttributionSourceType.SYSTEM,
  })
  sourceType!: string;

  @Prop({ type: Date, default: Date.now })
  firstAttributedAt!: Date;

  @Prop({ type: Date, default: Date.now })
  lastConfirmedAt!: Date;

  @Prop({ type: String, trim: true })
  notes?: string;

  @Prop({ type: [ParentAttributionTouchpointSchema], default: [] })
  touchpoints?: ParentAttributionTouchpoint[];
}

export const ParentAttributionSchema = SchemaFactory.createForClass(ParentAttribution);
ParentAttributionSchema.index({ parentUserId: 1 }, { sparse: true });
ParentAttributionSchema.index({ normalizedParentPhone: 1 }, { sparse: true });
ParentAttributionSchema.index({ normalizedParentEmail: 1 }, { sparse: true });
ParentAttributionSchema.index({ adGroupId: 1, lastConfirmedAt: -1 });
ParentAttributionSchema.index({ firstAttributedAt: -1 });
