import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
import { AiAssistantType } from '../../chatbot/schemas/ai-assistant-profile.schema';
import {
  AiActionDraftStatus,
  AiActionKey,
  AiEntityType,
} from '../ai-core.types';

export type AiActionDraftDocument = HydratedDocument<AiActionDraft>;

@Schema({ timestamps: true })
export class AiActionDraft {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'AiSession', index: true })
  sessionId?: Types.ObjectId;

  @Prop({ type: String, enum: Object.values(AiAssistantType), required: true, index: true })
  assistantType!: AiAssistantType;

  @Prop({ type: String, enum: Object.values(AiActionKey), required: true, index: true })
  actionKey!: AiActionKey;

  @Prop({ type: String, enum: Object.values(AiEntityType), required: true, index: true })
  entityType!: AiEntityType;

  @Prop({ type: SchemaTypes.ObjectId })
  entityId?: Types.ObjectId;

  @Prop({ type: SchemaTypes.Mixed, default: {} })
  payload!: Record<string, unknown>;

  @Prop({ type: SchemaTypes.Mixed })
  before?: Record<string, unknown>;

  @Prop({ type: SchemaTypes.Mixed, default: [] })
  diff!: Array<Record<string, unknown>>;

  @Prop({ type: [String], default: [] })
  warnings!: string[];

  @Prop({ type: String, enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], default: 'MEDIUM' })
  riskLevel!: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

  @Prop({ type: Boolean, default: true })
  requiresConfirmation!: boolean;

  @Prop({ type: Boolean, default: false })
  requiresApproval!: boolean;

  @Prop({
    type: String,
    enum: Object.values(AiActionDraftStatus),
    default: AiActionDraftStatus.PENDING_CONFIRMATION,
    index: true,
  })
  status!: AiActionDraftStatus;

  @Prop({ type: String, trim: true })
  sourceMessage?: string;

  @Prop({ type: SchemaTypes.Mixed })
  requestedBySnapshot?: Record<string, unknown>;

  @Prop({ type: Date, index: true })
  expiresAt?: Date;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User' })
  confirmedBy?: Types.ObjectId;

  @Prop({ type: Date })
  confirmedAt?: Date;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User' })
  executedBy?: Types.ObjectId;

  @Prop({ type: Date })
  executedAt?: Date;

  @Prop({ type: SchemaTypes.Mixed })
  executionResult?: Record<string, unknown>;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User' })
  rejectedBy?: Types.ObjectId;

  @Prop({ type: Date })
  rejectedAt?: Date;

  @Prop({ type: String, trim: true })
  rejectReason?: string;

  @Prop({ type: String, trim: true })
  errorMessage?: string;
}

export const AiActionDraftSchema = SchemaFactory.createForClass(AiActionDraft);

AiActionDraftSchema.index({ userId: 1, status: 1, updatedAt: -1 });
AiActionDraftSchema.index({ sessionId: 1, status: 1, updatedAt: -1 });
