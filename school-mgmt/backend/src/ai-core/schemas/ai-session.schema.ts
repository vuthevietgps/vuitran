import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
import { AiAssistantType } from '../../chatbot/schemas/ai-assistant-profile.schema';

export type AiSessionDocument = HydratedDocument<AiSession>;

export enum AiSessionStatus {
  ACTIVE = 'ACTIVE',
  ARCHIVED = 'ARCHIVED',
}

@Schema({ timestamps: true })
export class AiSession {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ type: String, enum: Object.values(AiAssistantType), required: true, index: true })
  assistantType!: AiAssistantType;

  @Prop({ type: String, trim: true, default: 'AI chat' })
  title!: string;

  @Prop({ type: String, enum: Object.values(AiSessionStatus), default: AiSessionStatus.ACTIVE })
  status!: AiSessionStatus;

  @Prop({ type: String, trim: true })
  lastSituationKey?: string;

  @Prop({ type: [String], default: [] })
  lastToolKeys!: string[];

  @Prop({ type: String, trim: true })
  lastActiveRoute?: string;

  @Prop({ type: String, trim: true })
  lastSource?: string;

  @Prop({ type: Number, default: 0 })
  messageCount!: number;

  @Prop({ type: Date })
  lastMessageAt?: Date;
}

export const AiSessionSchema = SchemaFactory.createForClass(AiSession);

AiSessionSchema.index({ userId: 1, assistantType: 1, updatedAt: -1 });
AiSessionSchema.index({ status: 1, updatedAt: -1 });
AiSessionSchema.index({ assistantType: 1, lastSituationKey: 1, updatedAt: -1 });
