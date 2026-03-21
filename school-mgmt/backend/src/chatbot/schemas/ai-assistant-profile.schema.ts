import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

export type AiAssistantProfileDocument = HydratedDocument<AiAssistantProfile>;

export enum AiAssistantType {
  PARENT_SUPPORT = 'PARENT_SUPPORT',
  INTERNAL_SUPPORT = 'INTERNAL_SUPPORT',
  TEACHER_SUPPORT = 'TEACHER_SUPPORT',
  LEAD_CARE = 'LEAD_CARE',
}

export enum AiAssistantStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

@Schema({ timestamps: true })
export class AiAssistantProfile {
  @Prop({
    type: String,
    enum: Object.values(AiAssistantType),
    required: true,
    unique: true,
  })
  assistantType!: AiAssistantType;

  @Prop({ type: String, required: true, trim: true })
  label!: string;

  @Prop({ type: String, trim: true })
  description?: string;

  @Prop({ type: String, trim: true })
  rulesPrompt?: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'OpenAIToken' })
  defaultOpenAITokenId?: Types.ObjectId;

  @Prop({
    type: String,
    enum: Object.values(AiAssistantStatus),
    default: AiAssistantStatus.ACTIVE,
  })
  status!: AiAssistantStatus;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true })
  createdById!: Types.ObjectId;

  @Prop({ type: Date })
  createdAt?: Date;

  @Prop({ type: Date })
  updatedAt?: Date;
}

export const AiAssistantProfileSchema = SchemaFactory.createForClass(AiAssistantProfile);

AiAssistantProfileSchema.index({ status: 1 });
