import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from '../../users/schemas/user.schema';

export type TeacherProfileDocument = TeacherProfile & Document;

export enum TeacherStatus {
  PENDING = 'PENDING',       // Chờ duyệt
  APPROVED = 'APPROVED',     // Đã duyệt
  ACTIVE = 'ACTIVE',         // Đang hoạt động
  SUSPENDED = 'SUSPENDED',   // Tạm ngưng
  INACTIVE = 'INACTIVE',     // Không hoạt động
}

export enum DayOfWeek {
  MONDAY = 'MONDAY',
  TUESDAY = 'TUESDAY',
  WEDNESDAY = 'WEDNESDAY',
  THURSDAY = 'THURSDAY',
  FRIDAY = 'FRIDAY',
  SATURDAY = 'SATURDAY',
  SUNDAY = 'SUNDAY',
}

// Sub-schema cho availability slot
@Schema({ _id: false })
export class AvailabilitySlot {
  @Prop({ type: String, enum: DayOfWeek, required: true })
  day!: DayOfWeek;

  @Prop({ type: String, required: true, trim: true }) // Format: "HH:mm"
  startTime!: string;

  @Prop({ type: String, required: true, trim: true }) // Format: "HH:mm"
  endTime!: string;
}

// Sub-schema cho qualification
@Schema({ _id: false })
export class Qualification {
  @Prop({ type: String, required: true, trim: true })
  title!: string; // Tên bằng cấp/chứng chỉ

  @Prop({ type: String, trim: true })
  institution?: string; // Trường/tổ chức cấp

  @Prop({ type: Number })
  year?: number; // Năm cấp

  @Prop({ type: String, trim: true })
  imageUrl?: string; // Ảnh chứng chỉ
}

// Sub-schema cho bank info
@Schema({ _id: false })
export class BankInfo {
  @Prop({ type: String, required: true, trim: true })
  bankName!: string;

  @Prop({ type: String, required: true, trim: true })
  accountNumber!: string;

  @Prop({ type: String, required: true, trim: true })
  accountHolderName!: string;

  @Prop({ type: String, trim: true })
  branch?: string;
}

@Schema({ timestamps: true })
export class TeacherProfile {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, unique: true })
  userId!: Types.ObjectId;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], default: [] })
  managedSales!: Types.ObjectId[];

  // Teaching info
  @Prop({ type: [String], default: [], trim: true })
  subjects!: string[]; // Môn dạy: ["Toán", "Lý", "Hóa"]

  @Prop({ type: [String], default: [], trim: true })
  grades!: string[]; // Lớp dạy: ["Lớp 10", "Lớp 11", "Lớp 12"]

  @Prop({ type: String, enum: ['ONLINE', 'OFFLINE', 'BOTH'], default: 'BOTH' })
  teachingMode!: string; // Hình thức dạy

  @Prop({ type: [String], default: [], trim: true })
  locations!: string[]; // Khu vực dạy offline

  // Profile
  @Prop({ type: String, trim: true })
  bio?: string; // Giới thiệu bản thân

  @Prop({ type: [Qualification], default: [] })
  qualifications!: Qualification[]; // Bằng cấp

  @Prop({ type: Number, min: 0, default: 0 })
  yearsOfExperience!: number; // Số năm kinh nghiệm

  @Prop({ type: String, trim: true })
  videoIntroUrl?: string; // Video giới thiệu

  // Availability
  @Prop({ type: [AvailabilitySlot], default: [] })
  availability!: AvailabilitySlot[]; // Lịch rảnh

  // Pricing
  @Prop({ type: Number, min: 0, required: true })
  pricePerSession!: number; // Lương mặc định/buổi (có thể override theo lớp)

  @Prop({ type: Number, min: 0 })
  pricePerHour?: number; // Hoặc tính theo giờ

  // Status & stats
  @Prop({ type: String, enum: TeacherStatus, default: TeacherStatus.PENDING })
  status!: TeacherStatus;

  @Prop({ type: Number, min: 0, max: 5, default: 0 })
  rating!: number; // Đánh giá trung bình

  @Prop({ type: Number, min: 0, default: 0 })
  totalReviews!: number;

  @Prop({ type: Number, min: 0, default: 0 })
  totalSessions!: number; // Tổng buổi đã dạy

  @Prop({ type: Number, min: 0, default: 0 })
  activeClasses!: number; // Số lớp đang dạy

  // Payment info
  @Prop({ type: BankInfo })
  bankInfo?: BankInfo;

  // Admin notes
  @Prop({ type: Types.ObjectId, ref: 'User' })
  approvedBy?: Types.ObjectId;

  @Prop({ type: Date })
  approvedAt?: Date;

  @Prop({ type: String, trim: true })
  adminNotes?: string;

  // Metadata
  @Prop({ type: Date })
  createdAt?: Date;

  @Prop({ type: Date })
  updatedAt?: Date;
}

export const TeacherProfileSchema = SchemaFactory.createForClass(TeacherProfile);

// Indexes
TeacherProfileSchema.index({ status: 1 });
TeacherProfileSchema.index({ subjects: 1 });
TeacherProfileSchema.index({ grades: 1 });
TeacherProfileSchema.index({ rating: -1 });
TeacherProfileSchema.index({ managedSales: 1 });

