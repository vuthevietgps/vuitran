import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
import {
  TrackingAttribution,
  TrackingAttributionSchema,
} from '../../marketing-attribution/schemas/tracking-attribution.schema';

export type LeadDocument = HydratedDocument<Lead>;

export enum LeadStatus {
  NEW = 'NEW',
  CONTACTED = 'CONTACTED',
  CONSULTING = 'CONSULTING',
  INTERESTED = 'INTERESTED',
  CONVERTED = 'CONVERTED',
  NOT_INTERESTED = 'NOT_INTERESTED',
  NO_RESPONSE = 'NO_RESPONSE',
}

export enum LeadSource {
  FACEBOOK = 'FACEBOOK',
  GOOGLE = 'GOOGLE',
  TIKTOK = 'TIKTOK',
  ZALO = 'ZALO',
  WEBSITE = 'WEBSITE',
  REFERRAL = 'REFERRAL',
  WALK_IN = 'WALK_IN',
  OTHER = 'OTHER',
}

export enum ContactMethod {
  CALL = 'CALL',
  ZALO = 'ZALO',
  EMAIL = 'EMAIL',
  MEET = 'MEET',
  SMS = 'SMS',
  OTHER = 'OTHER',
}

export enum LostReason {
  PRICE_TOO_HIGH = 'PRICE_TOO_HIGH',
  CHOSE_COMPETITOR = 'CHOSE_COMPETITOR',
  NO_LONGER_NEEDED = 'NO_LONGER_NEEDED',
  UNREACHABLE = 'UNREACHABLE',
  SCHEDULE_CONFLICT = 'SCHEDULE_CONFLICT',
  OTHER = 'OTHER',
}

@Schema({ _id: false })
export class ContactHistoryEntry {
  @Prop({ type: Date, default: Date.now })
  date!: Date;

  @Prop({ type: String, enum: Object.values(ContactMethod), required: true })
  method!: string;

  @Prop({ type: String, trim: true })
  notes?: string;

  @Prop({ type: Date })
  nextFollowUp?: Date;

  @Prop({ type: String, trim: true })
  contactedBy?: string;
}

export const ContactHistoryEntrySchema = SchemaFactory.createForClass(ContactHistoryEntry);

@Schema({ timestamps: true })
export class Lead {
  @Prop({ required: true, trim: true, unique: true })
  leadCode!: string;

  @Prop({ required: true, trim: true })
  parentName!: string;

  @Prop({ required: true, trim: true })
  parentPhone!: string;

  @Prop({ type: String, trim: true })
  parentEmail?: string;

  @Prop({ type: String, trim: true })
  studentName?: string;

  @Prop({ type: String, trim: true })
  studentGrade?: string;

  @Prop({ type: [String], default: [] })
  interestedSubjects?: string[];

  @Prop({ type: String, enum: Object.values(LeadSource), default: LeadSource.OTHER })
  source!: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'AdGroup' })
  adGroupId?: Types.ObjectId;

  @Prop({ type: String, trim: true })
  adGroupName?: string;

  @Prop({ type: String, trim: true })
  referredBy?: string;

  @Prop({ type: String, enum: Object.values(LeadStatus), default: LeadStatus.NEW })
  status!: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: false })
  saleId?: Types.ObjectId;

  @Prop({ type: String, trim: true })
  saleName?: string;

  @Prop({ type: Date })
  assignedAt?: Date;

  @Prop({ type: Date })
  lastContactAt?: Date;

  @Prop({ type: Date })
  returnedToPoolAt?: Date;

  @Prop({ type: Number, default: 0 })
  returnCount?: number;

  @Prop({ type: [{
    saleId: { type: SchemaTypes.ObjectId, ref: 'User' },
    saleName: String,
    assignedAt: Date,
    returnedAt: Date,
    returnReason: String,
  }], default: [] })
  assignmentHistory?: Array<{
    saleId: Types.ObjectId;
    saleName: string;
    assignedAt: Date;
    returnedAt?: Date;
    returnReason?: string;
  }>;

  @Prop({ type: [ContactHistoryEntrySchema], default: [] })
  contactHistory?: ContactHistoryEntry[];

  @Prop({ type: Date })
  nextFollowUp?: Date;

  @Prop({ type: Number, min: 0 })
  estimatedValue?: number;

  @Prop({ type: String, enum: Object.values(LostReason) })
  lostReason?: string;

  @Prop({ type: String, trim: true })
  lostNotes?: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Order' })
  convertedOrderId?: Types.ObjectId;

  @Prop({ type: [String], default: [] })
  tags?: string[];

  @Prop({ type: String, trim: true })
  notes?: string;

  @Prop({ type: TrackingAttributionSchema })
  tracking?: TrackingAttribution;
}

export const LeadSchema = SchemaFactory.createForClass(Lead);

LeadSchema.index({ status: 1 });
LeadSchema.index({ saleId: 1 });
LeadSchema.index({ source: 1 });
LeadSchema.index({ nextFollowUp: 1 });
LeadSchema.index({ saleId: 1, status: 1, nextFollowUp: 1 });
LeadSchema.index({ saleId: 1, status: 1, returnedToPoolAt: -1, createdAt: -1 });
LeadSchema.index({ parentPhone: 1 });
LeadSchema.index({ createdAt: -1 });
LeadSchema.index({ assignedAt: 1 });
LeadSchema.index({ lastContactAt: 1 });
LeadSchema.index({ adGroupId: 1 });

