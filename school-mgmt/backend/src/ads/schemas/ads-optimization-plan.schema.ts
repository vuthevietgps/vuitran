import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

export type AdsOptimizationPlanDocument = HydratedDocument<AdsOptimizationPlan>;

export enum AdsOptimizationPlanStatus {
  DRAFT = 'DRAFT',
  PARTIALLY_APPROVED = 'PARTIALLY_APPROVED',
  APPROVED = 'APPROVED',
  EXECUTING = 'EXECUTING',
  EXECUTED = 'EXECUTED',
  PARTIALLY_EXECUTED = 'PARTIALLY_EXECUTED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

export enum AdsOptimizationPlanSource {
  ACTIONS_REQUIRED = 'ACTIONS_REQUIRED',
  MANUAL = 'MANUAL',
}

export enum AdsOptimizationPlanItemStatus {
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  EXECUTED = 'EXECUTED',
  SKIPPED = 'SKIPPED',
  FAILED = 'FAILED',
}

@Schema({ timestamps: true })
export class AdsOptimizationPlan {
  @Prop({ required: true, trim: true })
  title!: string;

  @Prop({ type: String, enum: Object.values(AdsOptimizationPlanSource), default: AdsOptimizationPlanSource.ACTIONS_REQUIRED })
  source!: string;

  @Prop({ type: String, enum: Object.values(AdsOptimizationPlanStatus), default: AdsOptimizationPlanStatus.DRAFT })
  status!: string;

  @Prop({ type: SchemaTypes.Mixed, default: {} })
  generationOptions!: Record<string, any>;

  @Prop({ type: SchemaTypes.Mixed, default: {} })
  summary!: Record<string, any>;

  @Prop({ type: [SchemaTypes.Mixed], default: [] })
  items!: Array<Record<string, any>>;

  @Prop({ type: Date })
  generatedAt?: Date;

  @Prop({ type: Date })
  approvedAt?: Date;

  @Prop({ type: Date })
  executedAt?: Date;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User' })
  createdById?: Types.ObjectId;

  @Prop({ type: String, trim: true })
  createdByName?: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User' })
  approvedById?: Types.ObjectId;

  @Prop({ type: String, trim: true })
  approvedByName?: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User' })
  executedById?: Types.ObjectId;

  @Prop({ type: String, trim: true })
  executedByName?: string;
}

export const AdsOptimizationPlanSchema = SchemaFactory.createForClass(AdsOptimizationPlan);

AdsOptimizationPlanSchema.index({ status: 1, createdAt: -1 });
AdsOptimizationPlanSchema.index({ 'items.adGroupId': 1 });
AdsOptimizationPlanSchema.index({ generatedAt: -1 });
