import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
import { User } from '../../users/schemas/user.schema';
import { Student } from '../../students/schemas/student.schema';
// NOTE: Không import Invoice để tránh circular dependency

export type ClassDocument = HydratedDocument<Classroom>;
export type ClassroomDocument = HydratedDocument<Classroom>;

export enum ClassStatus {
  ACTIVE = 'ACTIVE',           // Đang hoạt động
  INACTIVE = 'INACTIVE',       // Tạm ngưng
  COMPLETED = 'COMPLETED',     // Đã kết thúc
  CANCELLED = 'CANCELLED',     // Đã hủy
}

/**
 * Chế độ lớp học:
 * - ONLINE: 1:1 (1 GV – 1 HS). Lương GV = teacherPayPerSession cố định.
 * - OFFLINE: 1:N (1 GV – nhiều HS). Lương GV = teacherPayPerStudent × số HS điểm danh.
 *   Chỉ HS được điểm danh có mặt/đi muộn mới bị trừ ví.
 */
export enum ClassMode {
  ONLINE = 'ONLINE',
  OFFLINE = 'OFFLINE',
}

export enum PricingSnapshotSource {
  MANUAL = 'MANUAL',
  INVOICE = 'INVOICE',
}

// Sub-schema for class schedule (tham khảo — GV & PH tự thỏa thuận)
@Schema({ _id: false })
export class ClassSchedule {
  @Prop({ type: String, required: true }) // e.g., "MONDAY"
  day!: string;

  @Prop({ type: String, required: true }) // Format: "HH:mm"
  startTime!: string;

  @Prop({ type: String, required: true }) // Format: "HH:mm"
  endTime!: string;
}

export const ClassScheduleSchema = SchemaFactory.createForClass(ClassSchedule);

// Sub-schema for cancellation policy
@Schema({ _id: false })
export class CancelPolicy {
  @Prop({ type: Number, min: 0, default: 24 }) // Hours before session
  hoursBeforeSession!: number;

  @Prop({ type: Number, min: 0, max: 100, default: 0 }) // Percentage charged if cancelled late
  lateChargePercent!: number;

  @Prop({ type: Boolean, default: true })
  allowReschedule!: boolean;

  @Prop({ type: Number, min: 0, default: 1 }) // Max times can reschedule per session
  maxReschedules!: number;
}

export const CancelPolicySchema = SchemaFactory.createForClass(CancelPolicy);

@Schema({ _id: false })
export class PricingSnapshot {
  @Prop({ type: String, enum: PricingSnapshotSource, default: PricingSnapshotSource.MANUAL })
  source!: PricingSnapshotSource;

  @Prop({ type: Date, required: true })
  capturedAt!: Date;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Invoice' })
  sourceInvoiceId?: Types.ObjectId;

  @Prop({ type: String, trim: true })
  sourceInvoiceNumber?: string;

  @Prop({ type: Number, min: 15, default: 60 })
  referenceDuration!: number; // Minutes

  @Prop({ type: Number, min: 15, default: 60 })
  sessionDuration!: number; // Minutes

  @Prop({ type: Number, min: 0, default: 0 })
  pricePerSession!: number; // Price for referenceDuration

  @Prop({ type: Number, min: 0, default: 0 })
  perMinuteRate!: number;

  @Prop({ type: Number, min: 0, default: 0 })
  teacherPayPerSession!: number;

  @Prop({ type: Number, min: 0, default: 0 })
  teacherPayPerStudent!: number;
}

export const PricingSnapshotSchema = SchemaFactory.createForClass(PricingSnapshot);

// ─── Sub-schema: Mục chương trình học (Curriculum Item) ─────────────

@Schema({ _id: true })
export class CurriculumItem {
  @Prop({ type: Number, min: 1, required: true })
  order!: number; // Thứ tự (1, 2, 3...)

  @Prop({ type: String, required: true, trim: true })
  title!: string; // Tên chương/bài (e.g. "Chương 1: Phương trình bậc 2")

  @Prop({ type: String, trim: true })
  description?: string; // Mô tả chi tiết nội dung

  @Prop({ type: [String], default: [] })
  objectives?: string[]; // Mục tiêu cụ thể (e.g. ["Giải được PT bậc 2", "Ứng dụng vào bài toán thực tế"])

  @Prop({ type: Number, min: 1 })
  estimatedSessions?: number; // Số buổi dự kiến cho phần này

  @Prop({ type: Boolean, default: false })
  isCompleted!: boolean; // Đã hoàn thành chưa

  @Prop({ type: Date })
  completedAt?: Date; // Ngày hoàn thành

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Session' })
  completedInSessionId?: Types.ObjectId; // Buổi học hoàn thành mục này

  @Prop({ type: String, trim: true })
  notes?: string; // Ghi chú thêm
}

export const CurriculumItemSchema = SchemaFactory.createForClass(CurriculumItem);

// ─── Sub-schema: GV dạy thay ─────────────────────────────────────────

@Schema({ _id: false })
export class SubstituteTeacher {
  @Prop({ type: SchemaTypes.ObjectId, ref: User.name, required: true })
  teacherId!: Types.ObjectId;

  @Prop({ type: Date, required: true })
  fromDate!: Date;

  @Prop({ type: Date, required: true })
  toDate!: Date;

  @Prop({ type: Number, min: 0, default: 0 })
  payRate!: number; // Lương GV dạy thay (VNĐ/buổi)

  @Prop({ type: Boolean, default: true })
  canCreateLink!: boolean; // Có được tạo link điểm danh không

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Ticket' })
  ticketId?: Types.ObjectId; // Ticket phê duyệt

  @Prop({ type: SchemaTypes.ObjectId, ref: User.name })
  approvedBy?: Types.ObjectId;

  @Prop({ type: Date })
  approvedAt?: Date;
}

export const SubstituteTeacherSchema = SchemaFactory.createForClass(SubstituteTeacher);

@Schema({ timestamps: true })
export class Classroom {
  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ required: true, trim: true, unique: true, uppercase: true })
  code!: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: User.name, required: true })
  teacher!: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: User.name, required: false })
  sale!: Types.ObjectId;

  /**
   * Chế độ lớp:
   * ONLINE = 1:1, lương GV cố định/buổi
   * OFFLINE = 1:N, lương GV = teacherPayPerStudent × số HS điểm danh
   */
  @Prop({ type: String, enum: ClassMode, default: ClassMode.ONLINE })
  classMode!: ClassMode;

  /** Hóa đơn đã duyệt liên kết (SALE tạo lớp từ hóa đơn APPROVED) */
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Invoice', required: false })
  invoiceId?: Types.ObjectId;

  @Prop({ type: PricingSnapshotSchema, required: false })
  pricingSnapshot?: PricingSnapshot;

  @Prop({ type: [SchemaTypes.ObjectId], ref: Student.name, default: [] })
  students!: Types.ObjectId[];

  // ── GV dạy thay ──
  @Prop({ type: [SubstituteTeacherSchema], default: [] })
  substituteTeachers!: SubstituteTeacher[];

  // ── Thông tin môn học ──
  @Prop({ type: String, trim: true })
  subject?: string; // Môn học (e.g. "Toán", "Tiếng Anh")

  @Prop({ type: String, trim: true })
  grade?: string; // Khối lớp (e.g. "Lớp 10", "Lớp 12")

  @Prop({ type: String, trim: true })
  learningGoals?: string; // Mục tiêu tổng thể khóa học

  // ── Chương trình học ──
  @Prop({ type: [CurriculumItemSchema], default: [] })
  curriculum!: CurriculumItem[]; // Nội dung chương trình học

  // Pricing per session (new model)
  @Prop({ type: Number, min: 0, default: 0 })
  pricePerSession!: number; // Giá thu/1 buổi (VNĐ) — cho baseDuration phút

  @Prop({ type: Number, min: 0, default: 0 })
  teacherPayPerSession!: number; // Lương GV/1 buổi (VNĐ) — cho baseDuration phút (dùng cho ONLINE 1:1)

  /** Lương GV / 1 học sinh / 1 buổi (VNĐ) — dùng cho OFFLINE 1:N */
  @Prop({ type: Number, min: 0, default: 0 })
  teacherPayPerStudent!: number;

  @Prop({ type: Number, min: 15, default: 60 }) // Minutes
  baseDuration!: number; // Thời lượng cơ sở để tính giá (phút) — mặc định 60

  @Prop({ type: Number, min: 15, default: 60 }) // Minutes
  sessionDuration!: number; // Thời lượng thực tế mỗi buổi (phút)

  // Legacy fields (keep for backward compatibility)
  @Prop({ type: Number, min: 0, default: 0 })
  revenuePerStudent!: number;

  @Prop({ type: Number, min: 0, default: 0 })
  teacherSalaryCost!: number;

  // Class info
  @Prop({ type: String, enum: ClassStatus, default: ClassStatus.ACTIVE })
  status!: ClassStatus;

  @Prop({ type: [ClassScheduleSchema], default: [] })
  schedule!: ClassSchedule[]; // Lịch học tham khảo (GV & PH tự thỏa thuận)

  @Prop({ type: Number, min: 0 })
  totalSessions?: number; // Tổng số buổi trong khóa (nếu có)

  @Prop({ type: Number, min: 0, default: 0 })
  sessionsCompleted!: number; // Số buổi đã hoàn thành

  // Policies
  @Prop({ type: CancelPolicySchema })
  cancelPolicy?: CancelPolicy;

  @Prop({ type: String, trim: true })
  description?: string; // Mô tả lớp

  @Prop({ type: Date })
  startDate?: Date; // Ngày bắt đầu

  @Prop({ type: Date })
  endDate?: Date; // Ngày kết thúc (dự kiến)

  /** Sĩ số tối đa (null = không giới hạn) */
  @Prop({ type: Number, min: 1 })
  maxStudents?: number;
}

export const ClassroomSchema = SchemaFactory.createForClass(Classroom);

// Indexes for frequently queried fields
ClassroomSchema.index({ teacher: 1 });
ClassroomSchema.index({ sale: 1 });
ClassroomSchema.index({ status: 1 });
ClassroomSchema.index({ students: 1, status: 1 });
ClassroomSchema.index({ students: 1 });

