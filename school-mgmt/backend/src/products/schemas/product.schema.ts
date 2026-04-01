import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ProductDocument = HydratedDocument<Product>;

export enum ProductCategory {
  MATH = 'MATH',
  ENGLISH = 'ENGLISH',
  SCIENCE = 'SCIENCE',
  LITERATURE = 'LITERATURE',
  PHYSICS = 'PHYSICS',
  CHEMISTRY = 'CHEMISTRY',
  BIOLOGY = 'BIOLOGY',
  HISTORY = 'HISTORY',
  GEOGRAPHY = 'GEOGRAPHY',
  INFORMATICS = 'INFORMATICS',
  MULTI_SUBJECT = 'MULTI_SUBJECT',
  OTHER = 'OTHER',
}

export enum TeachingMode {
  ONLINE = 'ONLINE',
  OFFLINE = 'OFFLINE',
  BOTH = 'BOTH',
}

@Schema({ timestamps: true })
export class Product {
  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ required: true, trim: true, unique: true, uppercase: true })
  code!: string;

  @Prop({ type: String, trim: true })
  description?: string;

  @Prop({ type: String, enum: Object.values(ProductCategory), default: ProductCategory.ENGLISH })
  category?: string;

  @Prop({ type: String, enum: Object.values(TeachingMode), default: TeachingMode.BOTH })
  teachingMode?: string;

  @Prop({ type: Number, min: 1, default: 24 })
  defaultSessions?: number;

  @Prop({ type: Number, min: 15, default: 90 })
  defaultSessionDuration?: number;

  @Prop({ type: Number, min: 0 })
  pricePerSession?: number;

  @Prop({ type: Number, min: 0 })
  suggestedPrice?: number;

  @Prop({ type: Number, min: 0, max: 100, default: 0 })
  commissionRate?: number;

  @Prop({ type: String, trim: true })
  gradeLevel?: string;

  @Prop({ type: [String], default: [] })
  highlights?: string[];

  @Prop({ type: Boolean, default: true })
  isActive?: boolean;
}

export const ProductSchema = SchemaFactory.createForClass(Product);

ProductSchema.index({ category: 1 });
ProductSchema.index({ isActive: 1 });
