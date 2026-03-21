import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

export type StudentSupportSnapshotDocument = HydratedDocument<StudentSupportSnapshot>;

@Schema({ _id: false })
export class SnapshotHomeworkItem {
  @Prop({ type: String, trim: true })
  className?: string;

  @Prop({ type: String, trim: true })
  homework?: string;

  @Prop({ type: String, trim: true })
  deadline?: string;

  @Prop({ type: String, trim: true })
  status?: string;
}

export const SnapshotHomeworkItemSchema =
  SchemaFactory.createForClass(SnapshotHomeworkItem);

@Schema({ _id: false })
export class SnapshotCommentItem {
  @Prop({ type: String, trim: true })
  date?: string;

  @Prop({ type: String, trim: true })
  className?: string;

  @Prop({ type: String, trim: true })
  teacherComment?: string;

  @Prop({ type: String, trim: true })
  overallComment?: string;
}

export const SnapshotCommentItemSchema =
  SchemaFactory.createForClass(SnapshotCommentItem);

@Schema({ _id: false })
export class SnapshotCurriculumProgressItem {
  @Prop({ type: String, trim: true })
  classId?: string;

  @Prop({ type: String, trim: true })
  className?: string;

  @Prop({ type: Number, min: 0, max: 100, default: 0 })
  progressPercent!: number;
}

export const SnapshotCurriculumProgressItemSchema =
  SchemaFactory.createForClass(SnapshotCurriculumProgressItem);

@Schema({ _id: false })
export class SnapshotUpcomingSessionItem {
  @Prop({ type: String, trim: true })
  scheduledAt?: string;

  @Prop({ type: String, trim: true })
  className?: string;
}

export const SnapshotUpcomingSessionItemSchema =
  SchemaFactory.createForClass(SnapshotUpcomingSessionItem);

@Schema({ _id: false })
export class SnapshotTeachingMaterialItem {
  @Prop({ type: String, trim: true })
  title?: string;

  @Prop({ type: String, trim: true })
  className?: string;

  @Prop({ type: String, trim: true })
  description?: string;

  @Prop({ type: String, trim: true })
  updatedAt?: string;
}

export const SnapshotTeachingMaterialItemSchema =
  SchemaFactory.createForClass(SnapshotTeachingMaterialItem);

@Schema({ timestamps: true })
export class StudentSupportSnapshot {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Student', required: true })
  studentId!: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true })
  parentUserId!: Types.ObjectId;

  @Prop({ type: Number, default: 1 })
  snapshotVersion!: number;

  @Prop({ type: Date, required: true })
  generatedAt!: Date;

  @Prop({ type: Date })
  sourceUpdatedAt?: Date;

  @Prop({ type: String, trim: true })
  contextText?: string;

  @Prop({ type: Number, min: 0, max: 100, default: 0 })
  dataCompletenessScore!: number;

  @Prop({ type: [String], default: [] })
  dataWarnings!: string[];

  @Prop({ type: Number, min: 0, default: 0 })
  sessionCount!: number;

  @Prop({ type: Number })
  averagePerformance?: number;

  @Prop({ type: Number })
  averageEngagement?: number;

  @Prop({ type: Number })
  averageComprehension?: number;

  @Prop({ type: [SnapshotHomeworkItemSchema], default: [] })
  pendingHomework!: SnapshotHomeworkItem[];

  @Prop({ type: [SnapshotCommentItemSchema], default: [] })
  recentComments!: SnapshotCommentItem[];

  @Prop({ type: [SnapshotCurriculumProgressItemSchema], default: [] })
  curriculumProgress!: SnapshotCurriculumProgressItem[];

  @Prop({ type: [SnapshotUpcomingSessionItemSchema], default: [] })
  upcomingSessions!: SnapshotUpcomingSessionItem[];

  @Prop({ type: [SnapshotTeachingMaterialItemSchema], default: [] })
  teachingMaterials!: SnapshotTeachingMaterialItem[];

  @Prop({ type: Date })
  createdAt?: Date;

  @Prop({ type: Date })
  updatedAt?: Date;
}

export const StudentSupportSnapshotSchema =
  SchemaFactory.createForClass(StudentSupportSnapshot);

StudentSupportSnapshotSchema.index({ studentId: 1, parentUserId: 1 }, { unique: true });
StudentSupportSnapshotSchema.index({ generatedAt: -1 });
