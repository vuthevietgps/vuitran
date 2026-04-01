import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type AgentDocument = HydratedDocument<Agent>;

export enum AgentStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED',
}

export enum AgentTier {
  SILVER = 'SILVER',
  GOLD = 'GOLD',
  PLATINUM = 'PLATINUM',
}

@Schema({ timestamps: true })
export class Agent {
  @Prop({ unique: true, trim: true })
  agentCode!: string;

  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ type: String, trim: true })
  contactPerson?: string;

  @Prop({ type: String, trim: true })
  phone?: string;

  @Prop({ type: String, trim: true })
  email?: string;

  @Prop({ type: String, trim: true })
  address?: string;

  @Prop({ type: String, trim: true })
  taxCode?: string;

  @Prop({ type: String, trim: true })
  bankName?: string;

  @Prop({ type: String, trim: true })
  bankAccount?: string;

  @Prop({ type: String, trim: true })
  bankAccountHolder?: string;

  @Prop({ type: String, enum: Object.values(AgentTier), default: AgentTier.SILVER })
  tier!: string;

  @Prop({ default: 0, min: 0, max: 100 })
  commissionRate!: number;

  @Prop({ type: String, enum: Object.values(AgentStatus), default: AgentStatus.ACTIVE })
  status!: string;

  @Prop({ default: 0 })
  totalReferred!: number;

  @Prop({ default: 0 })
  totalCommissionPaid!: number;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  createdById?: Types.ObjectId;

  @Prop({ type: String, trim: true })
  createdByName?: string;

  @Prop({ type: String, trim: true })
  notes?: string;
}

export const AgentSchema = SchemaFactory.createForClass(Agent);
AgentSchema.index({ name: 1 });
AgentSchema.index({ status: 1 });
AgentSchema.index({ tier: 1 });
