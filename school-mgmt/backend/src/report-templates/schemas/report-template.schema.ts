import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

export type ReportTemplateDocument = HydratedDocument<ReportTemplate>;

export const REPORT_TEMPLATE_DYNAMIC_FIELD_TYPES = [
  'text',
  'textarea',
  'url',
  'number',
  'select',
  'checkbox',
  'date',
] as const;

export type ReportTemplateDynamicFieldType =
  (typeof REPORT_TEMPLATE_DYNAMIC_FIELD_TYPES)[number];

@Schema({ _id: false })
export class ReportTemplateDynamicFieldOption {
  @Prop({ required: true, trim: true, maxlength: 100 })
  value!: string;

  @Prop({ required: true, trim: true, maxlength: 100 })
  label!: string;
}

export const ReportTemplateDynamicFieldOptionSchema =
  SchemaFactory.createForClass(ReportTemplateDynamicFieldOption);

@Schema({ _id: false })
export class ReportTemplateDynamicField {
  @Prop({ required: true, trim: true, maxlength: 60 })
  key!: string;

  @Prop({ required: true, trim: true, maxlength: 100 })
  label!: string;

  @Prop({
    type: String,
    enum: REPORT_TEMPLATE_DYNAMIC_FIELD_TYPES,
    default: 'textarea',
  })
  type!: ReportTemplateDynamicFieldType;

  @Prop({ type: Boolean, default: false })
  required?: boolean;

  @Prop({ trim: true, maxlength: 200 })
  placeholder?: string;

  @Prop({ type: Number, min: 1 })
  maxLength?: number;

  @Prop({ type: Number, min: 0, default: 0 })
  order?: number;

  @Prop({ trim: true, maxlength: 200 })
  defaultValue?: string;

  @Prop({ type: [ReportTemplateDynamicFieldOptionSchema], default: undefined })
  options?: ReportTemplateDynamicFieldOption[];
}

export const ReportTemplateDynamicFieldSchema =
  SchemaFactory.createForClass(ReportTemplateDynamicField);

@Schema({ timestamps: true })
export class ReportTemplate {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true, index: true })
  teacherId!: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Classroom' })
  classId?: Types.ObjectId;

  @Prop({ required: true, trim: true, maxlength: 100 })
  title!: string;

  @Prop({ required: true, trim: true, maxlength: 2000 })
  templateContent!: string;

  @Prop({ type: Number, min: 1, default: 1 })
  version?: number;

  @Prop({ type: [ReportTemplateDynamicFieldSchema], default: undefined })
  dynamicFields?: ReportTemplateDynamicField[];

  @Prop({ type: Boolean, default: false, index: true })
  isGlobal?: boolean;
}

export const ReportTemplateSchema = SchemaFactory.createForClass(ReportTemplate);

ReportTemplateSchema.index({ teacherId: 1, isGlobal: 1 });
