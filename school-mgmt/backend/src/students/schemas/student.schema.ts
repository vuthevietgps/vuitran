import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
import { Product } from '../../products/schemas/product.schema';

export type StudentDocument = HydratedDocument<Student>;

@Schema({ _id: false })
export class PaymentFrame {
  @Prop({ type: Number, min: 1, max: 10, required: true })
  frameIndex!: number; // 1..10

  @Prop({ type: String, required: false, trim: true })
  invoiceCode?: string;

  @Prop({ type: Number, min: 0 })
  sessionsRegistered?: number;

  @Prop({ type: Number, min: 0 })
  pricePerSession?: number;

  @Prop({ type: Number, min: 0 })
  amountCollected?: number;

  @Prop({ type: Number, min: 0 })
  sessionsCollected?: number;

  @Prop({ type: String })
  invoiceImage?: string;

  @Prop({ type: String, enum: ['PENDING', 'CONFIRMED', 'REJECTED'], default: 'PENDING' })
  confirmStatus?: 'PENDING' | 'CONFIRMED' | 'REJECTED';
}

export const PaymentFrameSchema = SchemaFactory.createForClass(PaymentFrame);

// Sub-schema for preferred schedule
@Schema({ _id: false })
export class PreferredTimeSlot {
  @Prop({ type: String, required: true }) // e.g., "MONDAY", "TUESDAY"
  day!: string;

  @Prop({ type: String, required: true }) // Format: "HH:mm"
  startTime!: string;

  @Prop({ type: String, required: true }) // Format: "HH:mm"
  endTime!: string;
}

export const PreferredTimeSlotSchema = SchemaFactory.createForClass(PreferredTimeSlot);

@Schema({ timestamps: true })
export class Student {
  @Prop({ required: true, trim: true, unique: true })
  studentCode!: string;

  @Prop({ required: true, trim: true })
  fullName!: string;

  @Prop({ required: true, min: 3, max: 25 })
  age!: number;

  // Birthday info (for birthday promotions)
  @Prop({ type: Number, min: 1, max: 12, required: false })
  studentBirthMonth?: number; // Tháng sinh học sinh (1-12)

  @Prop({ type: Number, min: 1, max: 12, required: false })
  parentBirthMonth?: number; // Tháng sinh phụ huynh (1-12)

  // Parent info
  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: false })
  parentUserId?: Types.ObjectId; // Link to parent's login account (PARENT role)

  @Prop({ type: [{ type: SchemaTypes.ObjectId, ref: 'User' }], default: [] })
  parentUserIds?: Types.ObjectId[]; // All linked parent accounts, primary parent kept in parentUserId

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: false, index: true })
  studentUserId?: Types.ObjectId; // Optional login account for the student

  @Prop({ required: true, trim: true })
  parentName!: string;

  @Prop({ required: true, trim: true })
  parentPhone!: string;

  @Prop({ required: true, trim: true })
  faceImage!: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: Product.name })
  productPackage?: Types.ObjectId;

  // Learning needs & preferences
  @Prop({ type: String, trim: true })
  learningNeeds?: string; // Nhu cầu học, mục tiêu (e.g., "Ôn thi đại học", "Tăng điểm Toán")

  @Prop({ type: [String], default: [] })
  subjects?: string[]; // Môn học muốn học (e.g., ["Toán", "Lý"])

  @Prop({ type: String, trim: true })
  grade?: string; // Lớp đang học (e.g., "Lớp 10", "Lớp 12")

  @Prop({ type: String, trim: true })
  level?: string;

  @Prop({ type: String, enum: ['ONLINE', 'OFFLINE', 'BOTH'], default: 'BOTH' })
  preferredTeachingMode?: string;

  @Prop({ type: String, trim: true })
  preferredLocation?: string; // Khu vực nếu học offline

  @Prop({ type: [PreferredTimeSlotSchema], default: [] })
  preferredSchedule?: PreferredTimeSlot[]; // Khung giờ mong muốn

  // Legacy field (keep for backward compatibility)
  @Prop({ type: String, enum: ['ONLINE', 'OFFLINE'], required: false })
  studentType?: 'ONLINE' | 'OFFLINE';

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: false })
  saleId?: Types.ObjectId;

  @Prop({ type: String, required: false })
  saleName?: string;

  // ── Tracking nguồn quảng cáo (denormalize từ Order) ──
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Order', required: false })
  orderId?: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'AdGroup', required: false })
  adGroupId?: Types.ObjectId;

  @Prop({ type: String, required: false })
  adGroupName?: string;

  @Prop({ type: String, enum: ['PENDING', 'APPROVED', 'REJECTED'], default: 'PENDING' })
  approvalStatus?: 'PENDING' | 'APPROVED' | 'REJECTED';

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: false })
  approvedBy?: Types.ObjectId;

  @Prop({ type: Date, required: false })
  approvedAt?: Date;

  @Prop({ type: [PaymentFrameSchema], default: [] })
  payments?: PaymentFrame[];

  @Prop({ type: Number, default: 0, min: 0 })
  totalPurchasedSessions!: number;
}

export const StudentSchema = SchemaFactory.createForClass(Student);

// Indexes for frequently queried fields
StudentSchema.index({ approvalStatus: 1 });
StudentSchema.index({ saleId: 1 });
StudentSchema.index({ parentUserId: 1 });
StudentSchema.index({ parentUserIds: 1 });
StudentSchema.index({ adGroupId: 1 });

