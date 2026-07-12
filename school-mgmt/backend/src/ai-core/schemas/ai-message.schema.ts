import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

export type AiMessageDocument = HydratedDocument<AiMessage>;

export enum AiMessageRole {
  USER = 'USER',
  ASSISTANT = 'ASSISTANT',
}

@Schema({ timestamps: true })
export class AiMessage {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'AiSession', required: true, index: true })
  sessionId!: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ type: String, enum: Object.values(AiMessageRole), required: true })
  role!: AiMessageRole;

  @Prop({ type: String, required: true, trim: true })
  content!: string;

  @Prop({ type: String, trim: true })
  situationKey?: string;

  @Prop({ type: [String], default: [] })
  toolKeys!: string[];

  @Prop({ type: SchemaTypes.Mixed })
  metadata?: Record<string, any>;
}

export const AiMessageSchema = SchemaFactory.createForClass(AiMessage);

AiMessageSchema.index({ sessionId: 1, createdAt: -1 });
AiMessageSchema.index({ userId: 1, createdAt: -1 });
AiMessageSchema.index({ situationKey: 1, createdAt: -1 });
AiMessageSchema.index({ 'metadata.assistantType': 1, situationKey: 1, createdAt: -1 });
AiMessageSchema.index({ 'metadata.source': 1, createdAt: -1 });
