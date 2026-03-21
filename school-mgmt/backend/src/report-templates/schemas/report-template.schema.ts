import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

export type ReportTemplateDocument = HydratedDocument<ReportTemplate>;

@Schema({ timestamps: true })
export class ReportTemplate {
  /** GV sở hữu template này */
  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true, index: true })
  teacherId!: Types.ObjectId;

  /** Áp dụng cho lớp cụ thể (tùy chọn) */
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Classroom' })
  classId?: Types.ObjectId;

  /** Tên gợi nhớ của template */
  @Prop({ required: true, trim: true, maxlength: 100 })
  title!: string;

  /** Nội dung mẫu gợi ý cho lessonContent */
  @Prop({ required: true, trim: true, maxlength: 2000 })
  templateContent!: string;

  /** Template toàn cục (Admin tạo, mọi GV đều thấy) */
  @Prop({ type: Boolean, default: false, index: true })
  isGlobal?: boolean;
}

export const ReportTemplateSchema = SchemaFactory.createForClass(ReportTemplate);

// Compound index: GV chỉ được thấy template của mình + global
ReportTemplateSchema.index({ teacherId: 1, isGlobal: 1 });
