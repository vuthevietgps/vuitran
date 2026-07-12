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

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', index: true })
  experienceTeacherId?: Types.ObjectId;

  @Prop({ type: Date, index: true })
  testDate?: Date;

  @Prop({ type: String, trim: true })
  testStartTime?: string;

  @Prop({ type: String, trim: true })
  testEndTime?: string;

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

  @Prop({ type: Number, min: 0, max: 100 })
  assessmentScore?: number;

  @Prop({ type: String, trim: true })
  recommendedLevel?: string;

  @Prop({ type: String, trim: true })
  assessmentNotes?: string;

  @Prop({ type: String, trim: true })
  zoomMeetingUrl?: string;

  @Prop({ type: String, trim: true })
  zoomRecordingUrl?: string;

  @Prop({ type: [String], default: [] })
  resultImageUrls?: string[];

  @Prop({ type: Number, min: 0, max: 100 })
  listeningScore?: number;

  @Prop({ type: Number, min: 0, max: 100 })
  speakingScore?: number;

  @Prop({ type: Number, min: 0, max: 100 })
  readingScore?: number;

  @Prop({ type: Number, min: 0, max: 100 })
  writingScore?: number;

  @Prop({ type: Number, min: 0, max: 100 })
  pronunciationScore?: number;

  @Prop({ type: Number, min: 0, max: 100 })
  grammarScore?: number;

  @Prop({ type: Number, min: 0, max: 100 })
  vocabularyScore?: number;

  @Prop({ type: Number, min: 0, max: 100 })
  reflexScore?: number;

  @Prop({ type: Number, min: 0, max: 100 })
  confidenceScore?: number;

  @Prop({ type: Number, min: 0, max: 100 })
  focusScore?: number;

  @Prop({ type: Number, min: 0 })
  testDurationMinutes?: number;

  @Prop({ type: String, trim: true })
  learningGaps?: string;

  @Prop({ type: String, trim: true })
  strengthsObserved?: string;

  @Prop({ type: String, trim: true })
  improvementAreas?: string;

  @Prop({ type: String, trim: true })
  recommendedRoadmap?: string;

  @Prop({ type: String, trim: true })
  suggestedPackage?: string;

  @Prop({ type: String, trim: true })
  suggestedSchedule?: string;

  @Prop({ type: String, trim: true })
  salesAdvice?: string;

  @Prop({ type: String, enum: ['HIGH', 'MEDIUM', 'LOW', 'UNKNOWN'], default: 'UNKNOWN' })
  closingPotential?: string;

  @Prop({ type: String, trim: true })
  technicalNotes?: string;

  @Prop({ type: Date, index: true })
  assessmentUpdatedAt?: Date;

  @Prop({ type: Date, index: true })
  decisionAt?: Date;

  @Prop({ type: Boolean, default: false })
  teacherPaidOnlyDecision!: boolean;
}

export const TrialEnrollmentSchema = SchemaFactory.createForClass(TrialEnrollment);

TrialEnrollmentSchema.index({ classId: 1, status: 1 });
TrialEnrollmentSchema.index({ productId: 1, status: 1 });
TrialEnrollmentSchema.index({ saleId: 1, status: 1 });
TrialEnrollmentSchema.index({ experienceTeacherId: 1, status: 1 });
TrialEnrollmentSchema.index({ experienceTeacherId: 1, testDate: 1, status: 1 });
TrialEnrollmentSchema.index({ status: 1, createdAt: -1 });
TrialEnrollmentSchema.index({ saleId: 1, createdAt: -1 });
TrialEnrollmentSchema.index({ experienceTeacherId: 1, createdAt: -1 });
TrialEnrollmentSchema.index({ testDate: 1, testStartTime: 1 });
TrialEnrollmentSchema.index({ createdAt: -1 });
