import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

export type DirectorAiMessageDocument = HydratedDocument<DirectorAiMessage>;

export enum DirectorAiMessageRole {
  USER = 'USER',
  ASSISTANT = 'ASSISTANT',
}

@Schema({ timestamps: true })
export class DirectorAiMessage {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'DirectorAiSession', required: true, index: true })
  sessionId!: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ type: String, enum: Object.values(DirectorAiMessageRole), required: true })
  role!: DirectorAiMessageRole;

  @Prop({ type: String, required: true, trim: true })
  content!: string;

  @Prop({ type: [String], default: [] })
  contextKeys!: string[];

  @Prop({ type: SchemaTypes.Mixed })
  metadata?: Record<string, any>;
}

export const DirectorAiMessageSchema = SchemaFactory.createForClass(DirectorAiMessage);

DirectorAiMessageSchema.index({ sessionId: 1, createdAt: -1 });
DirectorAiMessageSchema.index({ userId: 1, createdAt: -1 });
