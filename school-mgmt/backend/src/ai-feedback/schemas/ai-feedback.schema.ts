import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

export type AiFeedbackDocument = HydratedDocument<AiFeedback>;

export enum AiFeedbackSource {
  AI_CORE = 'AI_CORE',
  DIRECTOR_AI = 'DIRECTOR_AI',
  PARENT_SUPPORT = 'PARENT_SUPPORT',
  CHATBOT_AUTO_REPLY = 'CHATBOT_AUTO_REPLY',
  OTHER = 'OTHER',
}

export enum AiFeedbackCategory {
  WRONG_DATA = 'WRONG_DATA',
  MISSING_CONTEXT = 'MISSING_CONTEXT',
  BAD_ACTION = 'BAD_ACTION',
  BAD_TONE = 'BAD_TONE',
  UNSAFE = 'UNSAFE',
  TOO_GENERIC = 'TOO_GENERIC',
  OTHER = 'OTHER',
}

export enum AiFeedbackSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum AiFeedbackStatus {
  NEW = 'NEW',
  REVIEWED = 'REVIEWED',
  PLANNED = 'PLANNED',
  RESOLVED = 'RESOLVED',
  DISMISSED = 'DISMISSED',
}

@Schema({ timestamps: true })
export class AiFeedback {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', index: true })
  userId?: Types.ObjectId;

  @Prop({ type: String, trim: true })
  userEmail?: string;

  @Prop({ type: String, trim: true })
  userFullName?: string;

  @Prop({ type: String, trim: true, index: true })
  userRole?: string;

  @Prop({ type: String, enum: Object.values(AiFeedbackSource), required: true, index: true })
  source!: AiFeedbackSource;

  @Prop({ type: String, trim: true, index: true })
  assistantType?: string;

  @Prop({ type: SchemaTypes.ObjectId, index: true })
  sessionId?: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, index: true })
  messageId?: Types.ObjectId;

  @Prop({ type: String, trim: true })
  activeRoute?: string;

  @Prop({ type: [String], default: [] })
  contextKeys!: string[];

  @Prop({ type: [String], default: [] })
  toolKeys!: string[];

  @Prop({ type: String, trim: true })
  userMessage?: string;

  @Prop({ type: String, trim: true })
  assistantAnswer?: string;

  @Prop({ type: String, enum: Object.values(AiFeedbackCategory), default: AiFeedbackCategory.OTHER, index: true })
  category!: AiFeedbackCategory;

  @Prop({ type: String, enum: Object.values(AiFeedbackSeverity), default: AiFeedbackSeverity.MEDIUM, index: true })
  severity!: AiFeedbackSeverity;

  @Prop({ type: String, trim: true })
  reason?: string;

  @Prop({ type: String, enum: Object.values(AiFeedbackStatus), default: AiFeedbackStatus.NEW, index: true })
  status!: AiFeedbackStatus;

  @Prop({ type: String, trim: true })
  resolutionNotes?: string;

  @Prop({ type: SchemaTypes.Mixed })
  metadata?: Record<string, unknown>;

  @Prop({ type: Date })
  createdAt?: Date;

  @Prop({ type: Date })
  updatedAt?: Date;
}

export const AiFeedbackSchema = SchemaFactory.createForClass(AiFeedback);

AiFeedbackSchema.index({ createdAt: -1 });
AiFeedbackSchema.index({ status: 1, severity: 1, createdAt: -1 });
AiFeedbackSchema.index({ source: 1, assistantType: 1, createdAt: -1 });
