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

  @Prop({ type: Types.ObjectId, ref: 'Classroom' })
  classId?: Types.ObjectId;

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
  },
  {
    default_language: 'none',
    weights: {
      title: 10,
      manualSummary: 8,
      aiSummary: 6,
      tags: 5,
      description: 4,
      originalName: 2,
      extractedTextPreview: 1,
    },
  },
);
