import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

export type OpenAITokenDocument = HydratedDocument<OpenAIToken>;

export enum OpenAITokenStatus {
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
  REVOKED = 'REVOKED',
}

@Schema({ timestamps: true })
export class OpenAIToken {
  @Prop({ required: true, trim: true })
  label!: string;

  @Prop({ required: true })
  apiKey!: string;

  @Prop({ type: String, default: 'gpt-5.4-mini' })
  model!: string;

  @Prop({ type: Number, default: 0.7 })
  temperature?: number;

  @Prop({ type: Number, default: 2000 })
  maxTokens?: number;

  @Prop({ type: String, trim: true })
  systemPromptPrefix?: string;

  @Prop({ type: String, enum: Object.values(OpenAITokenStatus), default: OpenAITokenStatus.ACTIVE })
  status!: string;

  @Prop({ type: Date })
  lastUsedAt?: Date;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true })
  createdById!: Types.ObjectId;
}

export const OpenAITokenSchema = SchemaFactory.createForClass(OpenAIToken);

OpenAITokenSchema.index({ status: 1 });
OpenAITokenSchema.index({ createdAt: -1 });
