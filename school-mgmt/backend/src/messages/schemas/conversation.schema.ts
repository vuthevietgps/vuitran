import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

export type ConversationDocument = HydratedDocument<Conversation>;

export enum ConversationKind {
  DIRECT = 'DIRECT',
  PARENT_SUPPORT = 'PARENT_SUPPORT',
}

@Schema({ timestamps: true })
export class Conversation {
  @Prop({ type: [{ type: SchemaTypes.ObjectId, ref: 'User' }], required: true })
  participants!: Types.ObjectId[];

  @Prop({ type: String, enum: Object.values(ConversationKind), default: ConversationKind.DIRECT })
  conversationKind!: ConversationKind;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Student' })
  topicStudentId?: Types.ObjectId;

  @Prop({ type: String, trim: true })
  topicStudentName?: string;

  @Prop({ type: String, trim: true })
  lastMessage?: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User' })
  lastMessageBy?: Types.ObjectId;

  @Prop({ type: Date })
  lastMessageAt?: Date;

  @Prop({ type: Date })
  createdAt?: Date;

  @Prop({ type: Date })
  updatedAt?: Date;
}

export const ConversationSchema = SchemaFactory.createForClass(Conversation);
ConversationSchema.index({ participants: 1 });
ConversationSchema.index({ lastMessageAt: -1 });
ConversationSchema.index({ participants: 1, topicStudentId: 1 });
ConversationSchema.index({ participants: 1, lastMessageAt: -1 });
ConversationSchema.index({ conversationKind: 1, lastMessageAt: -1 });
ConversationSchema.index({ conversationKind: 1, topicStudentId: 1, lastMessageAt: -1 });
