import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type TeachingMaterialDocument = TeachingMaterial & Document;
export enum MaterialExtractionStatus {
  PENDING = 'PENDING',
  READY = 'READY',
  UNSUPPORTED = 'UNSUPPORTED',
  FAILED = 'FAILED',
}

export enum MaterialFileCategory {
  PDF = 'pdf',
  DOC = 'doc',
  PPT = 'ppt',
  EXCEL = 'excel',
  IMAGE = 'image',
  VIDEO = 'video',
  OTHER = 'other',
}

export enum MaterialScope {
  TEACHING = 'TEACHING',
  HOMEWORK = 'HOMEWORK',
}

export enum MaterialType {
  SLIDE = 'SLIDE',
  LESSON_PLAN = 'LESSON_PLAN',
  WORKSHEET = 'WORKSHEET',
  ANSWER_KEY = 'ANSWER_KEY',
  RUBRIC = 'RUBRIC',
  AUDIO = 'AUDIO',
  VIDEO = 'VIDEO',
  HOMEWORK_SET = 'HOMEWORK_SET',
  QUIZ = 'QUIZ',
  TEST = 'TEST',
  OTHER = 'OTHER',
}

export enum MaterialUsagePhase {
  BEFORE_CLASS = 'BEFORE_CLASS',
  IN_CLASS = 'IN_CLASS',
  AFTER_CLASS = 'AFTER_CLASS',
}

export enum MaterialDifficulty {
  FOUNDATION = 'FOUNDATION',
  STANDARD = 'STANDARD',
  ADVANCED = 'ADVANCED',
}

export enum MaterialStatus {
  DRAFT = 'DRAFT',
  APPROVED = 'APPROVED',
  ARCHIVED = 'ARCHIVED',
}

@Schema({ timestamps: true })
export class TeachingMaterial {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  teacherId!: Types.ObjectId;

  @Prop({ type: String, required: true, trim: true })
  title!: string;

  @Prop({ type: String, trim: true })
  description?: string;

  @Prop({ type: String, trim: true, index: true })
  subject?: string;

  @Prop({ type: String, trim: true, index: true })
  grade?: string;

  @Prop({ type: Types.ObjectId, ref: 'Product', index: true })
  productId?: Types.ObjectId;

  @Prop({ type: String, trim: true, index: true })
  courseName?: string;

  @Prop({ type: String, trim: true, uppercase: true, index: true })
  unitCode?: string;

  @Prop({ type: String, trim: true })
  unitTitle?: string;

  @Prop({ type: String, trim: true, uppercase: true, index: true })
  lessonCode?: string;

  @Prop({ type: String, trim: true })
  lessonTitle?: string;

  @Prop({ type: Number, min: 1, index: true })
  lessonOrder?: number;

  @Prop({ type: Types.ObjectId, ref: 'Classroom' })
  classId?: Types.ObjectId;

  @Prop({
    type: String,
    enum: Object.values(MaterialScope),
    default: MaterialScope.TEACHING,
    index: true,
  })
  materialScope!: MaterialScope;

  @Prop({
    type: String,
    enum: Object.values(MaterialType),
    default: MaterialType.OTHER,
    index: true,
  })
  materialType!: MaterialType;

  @Prop({
    type: String,
    enum: Object.values(MaterialUsagePhase),
    default: MaterialUsagePhase.IN_CLASS,
    index: true,
  })
  usagePhase!: MaterialUsagePhase;

  @Prop({
    type: String,
    enum: Object.values(MaterialDifficulty),
    default: MaterialDifficulty.STANDARD,
    index: true,
  })
  difficulty!: MaterialDifficulty;

  @Prop({
    type: String,
    enum: Object.values(MaterialStatus),
    default: MaterialStatus.APPROVED,
    index: true,
  })
  status!: MaterialStatus;

  @Prop({ type: Number, min: 0 })
  estimatedMinutes?: number;

  @Prop({ type: [String], default: [], index: true })
  skills!: string[];

  @Prop({ type: Boolean, default: false, index: true })
  assignableAsHomework!: boolean;

  @Prop({ type: Boolean, default: false })
  autoGradeable!: boolean;

  @Prop({ type: String, trim: true })
  version?: string;

  @Prop({ type: String, required: true })
  fileUrl!: string;

  @Prop({ type: String, required: true })
  fileType!: string; // mime type

  @Prop({
    type: String,
    enum: Object.values(MaterialFileCategory),
    default: MaterialFileCategory.OTHER,
    index: true,
  })
  fileCategory!: MaterialFileCategory;

  @Prop({ type: Number, required: true })
  fileSize!: number; // bytes

  @Prop({ type: String, required: true })
  originalName!: string;

  @Prop({ type: [String], default: [], index: true })
  tags!: string[];

  @Prop({ type: Boolean, default: false })
  isShared!: boolean; // Chia sẻ với GV khác

  @Prop({ type: Number, default: 0 })
  downloadCount!: number;

  @Prop({
    type: String,
    enum: Object.values(MaterialExtractionStatus),
    default: MaterialExtractionStatus.PENDING,
  })
  extractionStatus!: MaterialExtractionStatus;

  @Prop({ type: String, trim: true })
  manualSummary?: string;

  @Prop({ type: String, trim: true })
  aiSummary?: string;

  @Prop({ type: String, trim: true })
  extractedTextPreview?: string;

  @Prop({ type: Number, min: 0, default: 0 })
  chunkCount!: number;

  @Prop({ type: Date })
  lastProcessedAt?: Date;

  @Prop({ type: String, trim: true })
  processingError?: string;

  @Prop({ type: Date })
  createdAt?: Date;

  @Prop({ type: Date })
  updatedAt?: Date;
}

export const TeachingMaterialSchema = SchemaFactory.createForClass(TeachingMaterial);

// Compound index for teacher + subject queries
TeachingMaterialSchema.index({ teacherId: 1, subject: 1, grade: 1 });
TeachingMaterialSchema.index({ teacherId: 1, updatedAt: -1 });
TeachingMaterialSchema.index({ classId: 1, updatedAt: -1 });
TeachingMaterialSchema.index({ teacherId: 1, fileCategory: 1, updatedAt: -1 });
TeachingMaterialSchema.index({ classId: 1, fileCategory: 1, updatedAt: -1 });
TeachingMaterialSchema.index({ productId: 1, unitCode: 1, lessonOrder: 1, lessonCode: 1 });
TeachingMaterialSchema.index({ materialScope: 1, productId: 1, updatedAt: -1 });
TeachingMaterialSchema.index({ materialScope: 1, materialType: 1, updatedAt: -1 });
TeachingMaterialSchema.index({ assignableAsHomework: 1, productId: 1, updatedAt: -1 });
TeachingMaterialSchema.index({ extractionStatus: 1, updatedAt: -1 });
TeachingMaterialSchema.index({ isShared: 1, updatedAt: -1 });
TeachingMaterialSchema.index(
  {
    title: 'text',
    description: 'text',
    manualSummary: 'text',
    aiSummary: 'text',
    extractedTextPreview: 'text',
    originalName: 'text',
    tags: 'text',
    courseName: 'text',
    unitCode: 'text',
    unitTitle: 'text',
    lessonCode: 'text',
    lessonTitle: 'text',
    skills: 'text',
  },
  {
    default_language: 'none',
    weights: {
      title: 10,
      lessonTitle: 9,
      unitTitle: 8,
      manualSummary: 8,
      aiSummary: 6,
      tags: 5,
      skills: 5,
      courseName: 5,
      lessonCode: 4,
      unitCode: 4,
      description: 4,
      originalName: 2,
      extractedTextPreview: 1,
    },
  },
);
