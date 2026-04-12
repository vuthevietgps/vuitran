import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

export type SessionChangeRequestDocument = HydratedDocument<SessionChangeRequest>;

export enum SessionChangeRequestStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
}

@Schema({ _id: false })
export class SessionChangeFinancialImpact {
  @Prop({ type: Number, min: 15, required: true })
  oldDurationMinutes!: number;

  @Prop({ type: Number, min: 15, required: true })
  newDurationMinutes!: number;

  @Prop({ type: Number, min: 0, required: true })
  oldAmountCharged!: number;

  @Prop({ type: Number, min: 0, required: true })
  newAmountCharged!: number;

  @Prop({ type: Number, required: true })
  deltaAmountCharged!: number;

  @Prop({ type: Number, min: 0, required: true })
  oldTeacherPayout!: number;

  @Prop({ type: Number, min: 0, required: true })
  newTeacherPayout!: number;

  @Prop({ type: Number, required: true })
  deltaTeacherPayout!: number;

  @Prop({ type: Number, min: 0 })
  requestedTeacherDefaultRate?: number;

  @Prop({ type: String, trim: true })
  note?: string;
}

export const SessionChangeFinancialImpactSchema =
  SchemaFactory.createForClass(SessionChangeFinancialImpact);

@Schema({ timestamps: true })
export class SessionChangeRequest {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Session', required: true })
  sessionId!: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Classroom', required: true })
  classId!: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Student', required: true })
  studentId!: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User' })
  parentUserId?: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true })
  currentTeacherId!: Types.ObjectId;

  @Prop({ type: Date, required: true })
  currentScheduledDate!: Date;

  @Prop({ type: String, required: true, trim: true })
  currentStartTime!: string;

  @Prop({ type: String, required: true, trim: true })
  currentEndTime!: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User' })
  requestedTeacherId?: Types.ObjectId;

  @Prop({ type: Date })
  requestedScheduledDate?: Date;

  @Prop({ type: String, trim: true })
  requestedStartTime?: string;

  @Prop({ type: String, trim: true })
  requestedEndTime?: string;

  @Prop({ type: Number, min: 15, required: true })
  currentDurationMinutes!: number;

  @Prop({ type: Number, min: 15 })
  requestedDurationMinutes?: number;

  @Prop({ type: String, required: true, trim: true })
  reason!: string;

  @Prop({
    type: String,
    enum: Object.values(SessionChangeRequestStatus),
    default: SessionChangeRequestStatus.PENDING,
  })
  status!: SessionChangeRequestStatus;

  @Prop({ type: SessionChangeFinancialImpactSchema, required: true })
  financialImpact!: SessionChangeFinancialImpact;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true })
  requestedBy!: Types.ObjectId;

  @Prop({ type: Date, required: true, default: Date.now })
  requestedAt!: Date;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User' })
  reviewedBy?: Types.ObjectId;

  @Prop({ type: Date })
  reviewedAt?: Date;

  @Prop({ type: String, trim: true })
  rejectionReason?: string;

  @Prop({ type: String, trim: true })
  cancelledReason?: string;
}

export const SessionChangeRequestSchema =
  SchemaFactory.createForClass(SessionChangeRequest);

SessionChangeRequestSchema.index(
  { sessionId: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: { status: SessionChangeRequestStatus.PENDING },
  },
);
SessionChangeRequestSchema.index({ sessionId: 1, createdAt: -1 });
SessionChangeRequestSchema.index({ requestedBy: 1, createdAt: -1 });
