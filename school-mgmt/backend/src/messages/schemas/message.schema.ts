import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
import { DIRECT_CONVERSATION_MODEL } from '../messages.constants';

export type MessageDocument = HydratedDocument<Message>;

export enum MessageSenderType {
  USER = 'USER',
  AI = 'AI',
}

@Schema({ timestamps: true })
export class Message {
  @Prop({ type: SchemaTypes.ObjectId, ref: DIRECT_CONVERSATION_MODEL, required: true })
  conversationId!: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: false })
  senderId?: Types.ObjectId;

  @Prop({ type: String, enum: Object.values(MessageSenderType), default: MessageSenderType.USER })
  senderType!: MessageSenderType;

  @Prop({ type: String, trim: true })
  senderLabel?: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Ticket' })
  handoffTicketId?: Types.ObjectId;

  @Prop({ type: String, trim: true })
  handoffTicketCode?: string;

  @Prop({ type: String, required: true, trim: true })
  content!: string;

  @Prop({ type: Date })
  readAt?: Date;

  @Prop({ type: Date })
  createdAt?: Date;
}

export const MessageSchema = SchemaFactory.createForClass(Message);
MessageSchema.index({ conversationId: 1, createdAt: -1 });
MessageSchema.index({ conversationId: 1, readAt: 1, createdAt: -1 });
MessageSchema.index({ readAt: 1, conversationId: 1, createdAt: -1 });
