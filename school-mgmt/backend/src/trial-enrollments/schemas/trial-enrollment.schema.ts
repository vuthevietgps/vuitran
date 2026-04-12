import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

export type TrialEnrollmentDocument = HydratedDocument<TrialEnrollment>;

export enum TrialEnrollmentStatus {
  PENDING_TRIAL = 'PENDING_TRIAL',
  WAITING_DECISION = 'WAITING_DECISION',
  CONVERTED = 'CONVERTED',
  REJECTED = 'REJECTED',
}

@Schema({ timestamps: true })
export class TrialEnrollment {
  @Prop({ type: String, trim: true, required: true, unique: true, index: true })
  trialCode!: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Classroom', required: true, index: true })
  classId!: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Product', required: true, index: true })
  productId!: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', index: true })
  saleId?: Types.ObjectId;

  @Prop({ type: String, trim: true, required: true, index: true })
  parentName!: string;

  @Prop({ type: String, trim: true, required: true, index: true })
  parentPhone!: string;

  @Prop({ type: String, trim: true })
  parentEmail?: string;

  @Prop({ type: String, trim: true })
  studentName?: string;

  @Prop({ type: String, trim: true })
  studentPhone?: string;

  @Prop({ type: String, trim: true })
  studentGrade?: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Student', index: true })
  studentId?: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Order', index: true })
  orderId?: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Invoice', index: true })
  invoiceId?: Types.ObjectId;

  @Prop({
    type: String,
    enum: Object.values(TrialEnrollmentStatus),
    default: TrialEnrollmentStatus.PENDING_TRIAL,
    index: true,
  })
  status!: string;

  @Prop({ type: Number, min: 1, default: 2 })
  maxTrialSessions!: number;

  @Prop({ type: Number, min: 0, default: 0 })
  trialSessionsUsed!: number;

  @Prop({ type: String, trim: true })
  notes?: string;

  @Prop({ type: Date, index: true })
  decisionAt?: Date;

  @Prop({ type: Boolean, default: false })
  teacherPaidOnlyDecision!: boolean;
}

export const TrialEnrollmentSchema = SchemaFactory.createForClass(TrialEnrollment);

TrialEnrollmentSchema.index({ classId: 1, status: 1 });
TrialEnrollmentSchema.index({ productId: 1, status: 1 });
TrialEnrollmentSchema.index({ saleId: 1, status: 1 });
TrialEnrollmentSchema.index({ createdAt: -1 });
