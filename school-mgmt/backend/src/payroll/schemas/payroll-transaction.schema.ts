import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

export type PayrollTransactionDocument = HydratedDocument<PayrollTransaction>;

/**
 * PayrollTransaction: Sổ phụ tính lương cho từng buổi dạy.
 *
 * LUỒNG:
 * 1. Khi giáo viên submit Teaching Report → tạo record PENDING
 * 2. Nếu nộp báo cáo trễ → tự động tính penaltyAmount
 * 3. Nếu phụ huynh REJECT → chuyển sang HELD
 * 4. Manager duyệt HELD → APPROVED hoặc EXCLUDED
 * 5. Kế toán chi tiền → PAID
 *
 * Schema này bổ sung cho PayrollItem (dùng trong aggregation bảng lương kỳ).
 * PayrollTransaction theo dõi từng buổi học ngay sau khi hoàn thành.
 */

export enum PayrollTransactionStatus {
  PENDING = 'PENDING',     // Chờ xử lý (mặc định sau khi submit report)
  HELD = 'HELD',           // Giữ lại do khiếu nại / parent reject
  APPROVED = 'APPROVED',   // Đã duyệt, sẵn sàng aggregation vào Payroll
  EXCLUDED = 'EXCLUDED',   // Loại khỏi tính lương (dispute resolved → không trả)
  PAID = 'PAID',           // Đã thanh toán
}

export enum HoldReason {
  PARENT_REJECTED = 'PARENT_REJECTED',       // Phụ huynh đánh giá REJECT
  LATE_REPORT = 'LATE_REPORT',               // Nộp báo cáo trễ quá mức cho phép
  DISPUTE_PENDING = 'DISPUTE_PENDING',       // Có Ticket khiếu nại đang xử lý
  QUALITY_ISSUE = 'QUALITY_ISSUE',           // Vấn đề chất lượng giảng dạy
  ADMIN_HOLD = 'ADMIN_HOLD',                 // Admin giữ lại thủ công
  OTHER = 'OTHER',
}

@Schema({ timestamps: true })
export class PayrollTransaction {
  /** Giáo viên */
  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true, index: true })
  teacherId!: Types.ObjectId;

  /** Session liên quan (buổi học) */
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Session', required: true })
  sessionId!: Types.ObjectId;

  /** Lớp học */
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Classroom', required: true })
  classId!: Types.ObjectId;

  /** Học sinh */
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Student', required: true })
  studentId!: Types.ObjectId;

  /** Ngày buổi học */
  @Prop({ type: Date, required: true })
  sessionDate!: Date;

  // ── Salary Calculation ──────────────────────────────────────────────────

  /** Lương cứng ca dạy (theo config/hợp đồng) */
  @Prop({ type: Number, required: true, min: 0 })
  baseSalary!: number;

  /** Phạt trễ báo cáo (nếu có) */
  @Prop({ type: Number, default: 0, min: 0 })
  penaltyAmount!: number;

  /** Thưởng (nếu có - ví dụ: parent 5 sao) */
  @Prop({ type: Number, default: 0, min: 0 })
  bonusAmount!: number;

  /** Điều chỉnh khác (+/-) */
  @Prop({ type: Number, default: 0 })
  adjustmentAmount!: number;

  /** Lương thực nhận = baseSalary - penaltyAmount + bonusAmount + adjustmentAmount */
  @Prop({ type: Number, required: true, min: 0 })
  finalSalary!: number;

  // ── Status & Hold ──────────────────────────────────────────────────────

  /** Trạng thái */
  @Prop({
    type: String,
    enum: Object.values(PayrollTransactionStatus),
    default: PayrollTransactionStatus.PENDING,
    index: true,
  })
  status!: PayrollTransactionStatus;

  /** Lý do giữ lại (nếu status = HELD) */
  @Prop({ type: String, enum: Object.values(HoldReason) })
  holdReason?: HoldReason;

  /** Chi tiết lý do giữ (free text) */
  @Prop({ type: String, trim: true })
  holdDescription?: string;

  /** Ticket liên quan (nếu có khiếu nại) */
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Ticket' })
  relatedTicketId?: Types.ObjectId;

  // ── Late Report Tracking ──────────────────────────────────────────────

  /** Teaching report nộp trễ? */
  @Prop({ type: Boolean, default: false })
  isLateReport!: boolean;

  /** Số giờ trễ (dùng để tính penalty) */
  @Prop({ type: Number, min: 0 })
  lateHours?: number;

  /** Deadline nộp báo cáo */
  @Prop({ type: Date })
  reportDeadline?: Date;

  /** Thời gian thực tế nộp báo cáo */
  @Prop({ type: Date })
  reportSubmittedAt?: Date;

  // ── Audit Trail ──────────────────────────────────────────────────────

  /** Người tạo record (thường là system sau submit teaching report) */
  @Prop({ type: SchemaTypes.ObjectId, ref: 'User' })
  createdBy?: Types.ObjectId;

  /** Người duyệt (nếu status = APPROVED) */
  @Prop({ type: SchemaTypes.ObjectId, ref: 'User' })
  approvedBy?: Types.ObjectId;

  @Prop({ type: Date })
  approvedAt?: Date;

  /** Người giữ lại (nếu status = HELD) */
  @Prop({ type: SchemaTypes.ObjectId, ref: 'User' })
  heldBy?: Types.ObjectId;

  @Prop({ type: Date })
  heldAt?: Date;

  /** Người loại (nếu status = EXCLUDED) */
  @Prop({ type: SchemaTypes.ObjectId, ref: 'User' })
  excludedBy?: Types.ObjectId;

  @Prop({ type: Date })
  excludedAt?: Date;

  @Prop({ type: String, trim: true })
  excludedReason?: string;

  /** Liên kết PayrollItem (khi được aggregation vào Payroll) */
  @Prop({ type: SchemaTypes.ObjectId, ref: 'PayrollItem' })
  payrollItemId?: Types.ObjectId;

  /** Ghi chú */
  @Prop({ type: String, trim: true })
  notes?: string;

  @Prop({ type: Date })
  createdAt?: Date;

  @Prop({ type: Date })
  updatedAt?: Date;
}

export const PayrollTransactionSchema = SchemaFactory.createForClass(PayrollTransaction);

// ─── Indexes ────────────────────────────────────────────────────────────

// Unique: 1 session chỉ có 1 payroll transaction
PayrollTransactionSchema.index({ sessionId: 1 }, { unique: true });

// Query nhanh theo teacher và status
PayrollTransactionSchema.index({ teacherId: 1, status: 1 });

// Query nhanh các record HELD cần xử lý
PayrollTransactionSchema.index({ status: 1, heldAt: 1 });

// Query theo ngày buổi học
PayrollTransactionSchema.index({ sessionDate: -1 });
