import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type TeachingMaterialChunkDocument = TeachingMaterialChunk & Document;

@Schema({ timestamps: true })
export class TeachingMaterialChunk {
  @Prop({ type: Types.ObjectId, ref: 'TeachingMaterial', required: true, index: true })
  materialId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Classroom', index: true })
  classId?: Types.ObjectId;

  @Prop({ type: Number, required: true, min: 0 })
  chunkIndex!: number;

  @Prop({ type: String, required: true })
  content!: string;

  @Prop({ type: String, trim: true })
  preview?: string;

  @Prop({ type: Number, min: 0, default: 0 })
  charCount!: number;

  @Prop({ type: Date })
  createdAt?: Date;

  @Prop({ type: Date })
  updatedAt?: Date;
}

export const TeachingMaterialChunkSchema =
  SchemaFactory.createForClass(TeachingMaterialChunk);

TeachingMaterialChunkSchema.index({ materialId: 1, chunkIndex: 1 }, { unique: true });
TeachingMaterialChunkSchema.index({ classId: 1, updatedAt: -1 });
