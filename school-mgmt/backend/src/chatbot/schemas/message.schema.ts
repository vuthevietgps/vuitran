import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

export type MessageDocument = HydratedDocument<Message>;

export enum SenderType {
  CUSTOMER = 'CUSTOMER',
  AI = 'AI',
  HUMAN_AGENT = 'HUMAN_AGENT',
}

export enum MessageStatus {
  SENT = 'SENT',
  DELIVERED = 'DELIVERED',
  FAILED = 'FAILED',
}

@Schema({ timestamps: true })
export class Message {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Conversation', required: true })
  conversationId!: Types.ObjectId;

  @Prop({ type: String, enum: Object.values(SenderType), required: true })
  senderType!: string;

  @Prop({ type: String, trim: true })
  senderName?: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User' })
  senderUserId?: Types.ObjectId;

  @Prop({ required: true })
  content!: string;

  @Prop({ type: String, trim: true })
  platformMessageId?: string;

  @Prop({ type: String, enum: Object.values(MessageStatus), default: MessageStatus.SENT })
  status!: string;

  @Prop({ type: String, trim: true })
  errorMessage?: string;
}

export const MessageSchema = SchemaFactory.createForClass(Message);

MessageSchema.index({ conversationId: 1, createdAt: 1 });
MessageSchema.index(
  { conversationId: 1, platformMessageId: 1 },
  {
    unique: true,
    partialFilterExpression: { platformMessageId: { $type: 'string' } },
  },
);
MessageSchema.index({ createdAt: -1 });
