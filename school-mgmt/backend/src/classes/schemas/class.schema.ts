import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
import { User } from '../../users/schemas/user.schema';
import { Student } from '../../students/schemas/student.schema';
import { Product } from '../../products/schemas/product.schema';
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

export enum ClassUpdateRequestStatus {
  PENDING = 'PENDING',
  REJECTED = 'REJECTED',
}

export enum PendingClassUpdateType {
  GENERAL = 'GENERAL',
  DURATION_CHANGE = 'DURATION_CHANGE',
}

export enum OfflineAssignmentRequestStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export enum ClassEditHistoryAction {
  SALE_DIRECT_UPDATED = 'SALE_DIRECT_UPDATED',
  SALE_REQUESTED = 'SALE_REQUESTED',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  MANAGER_UPDATED = 'MANAGER_UPDATED',
}

export enum DurationSnapshotSource {
  INITIAL = 'INITIAL',
  MANAGER_DIRECT = 'MANAGER_DIRECT',
  APPROVED_SALE_UPDATE = 'APPROVED_SALE_UPDATE',
  APPROVED_DURATION_CHANGE = 'APPROVED_DURATION_CHANGE',
}

export enum StudentConfigSlotType {
  INITIAL = 'INITIAL',
  UPDATE = 'UPDATE',
}

export enum ClassCoTeacherRole {
  SUPPORT = 'SUPPORT',
  REPORT = 'REPORT',
  ATTENDANCE = 'ATTENDANCE',
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

@Schema({ _id: false })
export class ClassCoTeacher {
  @Prop({ type: SchemaTypes.ObjectId, ref: User.name, required: true })
  teacherId!: Types.ObjectId;

  @Prop({ type: String, enum: ClassCoTeacherRole, default: ClassCoTeacherRole.SUPPORT })
  role!: ClassCoTeacherRole;

  @Prop({ type: Boolean, default: true })
  canManageAttendance!: boolean;

  @Prop({ type: Boolean, default: true })
  canManageReports!: boolean;

  @Prop({ type: Boolean, default: true })
  canCreateLink!: boolean;

  @Prop({ type: String, trim: true })
  note?: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: User.name })
  assignedBy?: Types.ObjectId;

  @Prop({ type: Date })
  assignedAt?: Date;
}

export const ClassCoTeacherSchema = SchemaFactory.createForClass(ClassCoTeacher);

@Schema({ _id: false })
export class DurationSnapshot {
  @Prop({ type: String, enum: DurationSnapshotSource, required: true })
  source!: DurationSnapshotSource;

  @Prop({ type: String, enum: PendingClassUpdateType, default: PendingClassUpdateType.GENERAL })
  requestType!: PendingClassUpdateType;

  @Prop({ type: Date, required: true })
  effectiveAt!: Date;

  @Prop({ type: SchemaTypes.ObjectId, ref: User.name })
  effectiveBy?: Types.ObjectId;

  @Prop({ type: Number, min: 15, required: true })
  baseDuration!: number;

  @Prop({ type: Number, min: 15, required: true })
  sessionDuration!: number;

  @Prop({ type: Number, min: 0, default: 0 })
  pricePerSession!: number;

  @Prop({ type: Number, min: 0, default: 0 })
  teacherPayPerSession!: number;

  @Prop({ type: Number, min: 0, default: 0 })
  teacherPayPerStudent!: number;
}

export const DurationSnapshotSchema = SchemaFactory.createForClass(DurationSnapshot);

@Schema({ _id: false })
export class StudentTeacherSlot {
  @Prop({ type: Number, min: 1, max: 3, required: true })
  slotIndex!: number;

  @Prop({ type: String, enum: StudentConfigSlotType, default: StudentConfigSlotType.INITIAL })
  slotType!: StudentConfigSlotType;

  @Prop({ type: SchemaTypes.ObjectId, ref: User.name, required: true })
  teacherId!: Types.ObjectId;

  @Prop({ type: Date, required: true })
  assignedAt!: Date;

  @Prop({ type: SchemaTypes.ObjectId, ref: User.name })
  assignedBy?: Types.ObjectId;
}

export const StudentTeacherSlotSchema = SchemaFactory.createForClass(StudentTeacherSlot);

@Schema({ _id: false })
export class StudentDurationSlot {
  @Prop({ type: Number, min: 1, max: 3, required: true })
  slotIndex!: number;

  @Prop({ type: String, enum: StudentConfigSlotType, default: StudentConfigSlotType.INITIAL })
  slotType!: StudentConfigSlotType;

  @Prop({ type: Date, required: true })
  effectiveAt!: Date;

  @Prop({ type: SchemaTypes.ObjectId, ref: User.name })
  effectiveBy?: Types.ObjectId;

  @Prop({ type: Number, min: 15, required: true })
  baseDuration!: number;

  @Prop({ type: Number, min: 15, required: true })
  sessionDuration!: number;

  @Prop({ type: Number, min: 0, default: 0 })
  totalSessions!: number;
}

export const StudentDurationSlotSchema = SchemaFactory.createForClass(StudentDurationSlot);

@Schema({ _id: false })
export class StudentClassConfig {
  @Prop({ type: SchemaTypes.ObjectId, ref: Student.name, required: true })
  studentId!: Types.ObjectId;

  @Prop({ type: [StudentTeacherSlotSchema], default: [] })
  teacherSlots!: StudentTeacherSlot[];

  @Prop({ type: [StudentDurationSlotSchema], default: [] })
  durationSlots!: StudentDurationSlot[];

  @Prop({ type: Date, default: Date.now })
  updatedAt!: Date;
}

export const StudentClassConfigSchema = SchemaFactory.createForClass(StudentClassConfig);

@Schema({ _id: false })
export class ClassEditHistoryChange {
  @Prop({ type: String, required: true, trim: true })
  field!: string;

  @Prop({ type: String, required: true, trim: true })
  label!: string;

  @Prop({ type: String, trim: true })
  beforeValue?: string;

  @Prop({ type: String, trim: true })
  afterValue?: string;
}

export const ClassEditHistoryChangeSchema =
  SchemaFactory.createForClass(ClassEditHistoryChange);

@Schema({ _id: false })
export class ClassDurationPreviewStudent {
  @Prop({ type: SchemaTypes.ObjectId, ref: Student.name })
  studentId?: Types.ObjectId;

  @Prop({ type: String, trim: true })
  studentName?: string;

  @Prop({ type: String, trim: true })
  studentCode?: string;

  @Prop({ type: Number, min: 15, required: true })
  oldDurationMinutes!: number;

  @Prop({ type: Number, min: 15, required: true })
  newDurationMinutes!: number;

  @Prop({ type: Number, min: 0, default: 0 })
  paidSessionsRemainingBefore?: number;

  @Prop({ type: Number, min: 0, default: 0 })
  bonusSessionsRemainingBefore?: number;

  @Prop({ type: Number, min: 0, default: 0 })
  totalSessionsRemainingBefore?: number;

  @Prop({ type: Number, min: 0, default: 0 })
  paidSessionsRemainingAfter?: number;

  @Prop({ type: Number, min: 0, default: 0 })
  bonusSessionsRemainingAfter?: number;

  @Prop({ type: Number, min: 0, default: 0 })
  totalSessionsRemainingAfter?: number;

  @Prop({ type: Number, min: 0, default: 0 })
  projectedTotalSessionsBefore?: number;

  @Prop({ type: Number, min: 0, default: 0 })
  projectedTotalSessionsAfter?: number;
}

export const ClassDurationPreviewStudentSchema =
  SchemaFactory.createForClass(ClassDurationPreviewStudent);

@Schema({ _id: false })
export class ClassDurationPreview {
  @Prop({ type: Number, min: 15, required: true })
  oldBaseDuration!: number;

  @Prop({ type: Number, min: 15, required: true })
  oldSessionDuration!: number;

  @Prop({ type: Number, min: 15, required: true })
  newBaseDuration!: number;

  @Prop({ type: Number, min: 15, required: true })
  newSessionDuration!: number;

  @Prop({ type: [ClassDurationPreviewStudentSchema], default: [] })
  students!: ClassDurationPreviewStudent[];
}

export const ClassDurationPreviewSchema =
  SchemaFactory.createForClass(ClassDurationPreview);

@Schema({ _id: false })
export class ClassEditHistoryEntry {
  @Prop({ type: Date, required: true })
  editedAt!: Date;

  @Prop({ type: SchemaTypes.ObjectId, ref: User.name })
  editedByUserId?: Types.ObjectId;

  @Prop({ type: String, trim: true })
  editedByName?: string;

  @Prop({ type: String, trim: true })
  editedByRole?: string;

  @Prop({ type: String, enum: ClassEditHistoryAction, required: true })
  action!: ClassEditHistoryAction;

  @Prop({ type: String, enum: PendingClassUpdateType, default: PendingClassUpdateType.GENERAL })
  requestType!: PendingClassUpdateType;

  @Prop({ type: [ClassEditHistoryChangeSchema], default: [] })
  changes!: ClassEditHistoryChange[];

  @Prop({ type: ClassDurationPreviewSchema })
  durationPreview?: ClassDurationPreview;

  @Prop({ type: String, trim: true })
  note?: string;
}

export const ClassEditHistoryEntrySchema =
  SchemaFactory.createForClass(ClassEditHistoryEntry);

@Schema({ _id: false })
export class PendingSaleUpdate {
  @Prop({ type: String, enum: ClassUpdateRequestStatus, default: ClassUpdateRequestStatus.PENDING })
  status!: ClassUpdateRequestStatus;

  @Prop({ type: String, enum: PendingClassUpdateType, default: PendingClassUpdateType.GENERAL })
  requestType!: PendingClassUpdateType;

  @Prop({ type: SchemaTypes.Mixed, required: true })
  requestedChanges!: Record<string, unknown>;

  @Prop({ type: SchemaTypes.ObjectId, ref: User.name, required: true })
  requestedBy!: Types.ObjectId;

  @Prop({ type: Date, required: true })
  requestedAt!: Date;

  @Prop({ type: [ClassEditHistoryChangeSchema], default: [] })
  changeSummary?: ClassEditHistoryChange[];

  @Prop({ type: ClassDurationPreviewSchema })
  durationPreview?: ClassDurationPreview;

  @Prop({ type: SchemaTypes.ObjectId, ref: User.name })
  reviewedBy?: Types.ObjectId;

  @Prop({ type: Date })
  reviewedAt?: Date;

  @Prop({ type: String, trim: true })
  rejectionReason?: string;
}

export const PendingSaleUpdateSchema = SchemaFactory.createForClass(PendingSaleUpdate);

@Schema({ _id: true })
export class PendingOfflineAssignment {
  @Prop({ type: String, enum: OfflineAssignmentRequestStatus, default: OfflineAssignmentRequestStatus.PENDING })
  status!: OfflineAssignmentRequestStatus;

  @Prop({ type: [SchemaTypes.ObjectId], ref: Student.name, default: [] })
  studentIds!: Types.ObjectId[];

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Invoice' })
  invoiceId?: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: User.name, required: true })
  requestedBy!: Types.ObjectId;

  @Prop({ type: Date, required: true })
  requestedAt!: Date;

  @Prop({ type: SchemaTypes.ObjectId, ref: User.name })
  reviewedBy?: Types.ObjectId;

  @Prop({ type: Date })
  reviewedAt?: Date;

  @Prop({ type: String, trim: true })
  rejectionReason?: string;
}

export const PendingOfflineAssignmentSchema =
  SchemaFactory.createForClass(PendingOfflineAssignment);

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

  @Prop({ type: SchemaTypes.ObjectId, ref: Product.name, required: false })
  productPackage?: Types.ObjectId;

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

  @Prop({ type: [ClassCoTeacherSchema], default: [] })
  coTeachers!: ClassCoTeacher[];

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

  @Prop({ type: PendingSaleUpdateSchema, required: false })
  pendingSaleUpdate?: PendingSaleUpdate;

  @Prop({ type: [PendingOfflineAssignmentSchema], default: [] })
  pendingOfflineAssignments!: PendingOfflineAssignment[];

  @Prop({ type: [DurationSnapshotSchema], default: [] })
  durationSnapshots!: DurationSnapshot[];

  @Prop({ type: [StudentClassConfigSchema], default: [] })
  studentConfigs!: StudentClassConfig[];

  @Prop({ type: [ClassEditHistoryEntrySchema], default: [] })
  editHistory!: ClassEditHistoryEntry[];
}

export const ClassroomSchema = SchemaFactory.createForClass(Classroom);

// Indexes for frequently queried fields
ClassroomSchema.index({ teacher: 1 });
ClassroomSchema.index({ sale: 1 });
ClassroomSchema.index({ status: 1 });
ClassroomSchema.index({ students: 1, status: 1 });
ClassroomSchema.index({ students: 1 });
ClassroomSchema.index({ 'studentConfigs.studentId': 1 });
ClassroomSchema.index({ 'studentConfigs.teacherSlots.teacherId': 1 });
ClassroomSchema.index({ 'coTeachers.teacherId': 1 });
ClassroomSchema.index({ 'pendingSaleUpdate.status': 1, sale: 1 });
ClassroomSchema.index({ classMode: 1, 'pendingOfflineAssignments.status': 1 });

