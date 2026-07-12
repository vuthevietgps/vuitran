import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

export type DirectorAiSessionDocument = HydratedDocument<DirectorAiSession>;

export enum DirectorAiSessionStatus {
  ACTIVE = 'ACTIVE',
  ARCHIVED = 'ARCHIVED',
}

@Schema({ timestamps: true })
export class DirectorAiSession {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ type: String, trim: true, default: 'Director AI chat' })
  title!: string;

  @Prop({
    type: String,
    enum: Object.values(DirectorAiSessionStatus),
    default: DirectorAiSessionStatus.ACTIVE,
  })
  status!: DirectorAiSessionStatus;

  @Prop({ type: [String], default: [] })
  lastContextKeys!: string[];

  @Prop({ type: Date })
  lastMessageAt?: Date;
}

export const DirectorAiSessionSchema = SchemaFactory.createForClass(DirectorAiSession);

DirectorAiSessionSchema.index({ userId: 1, updatedAt: -1 });
DirectorAiSessionSchema.index({ status: 1, updatedAt: -1 });
