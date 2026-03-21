import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

export type TicketDocument = HydratedDocument<Ticket>;
export type TicketCommentDocument = HydratedDocument<TicketComment>;

// ─── Enums ──────────────────────────────────────────────────────────

export enum TicketType {
  DISPUTE = 'DISPUTE',                     // Tranh chấp buổi học
  REFUND_REQUEST = 'REFUND_REQUEST',       // Yêu cầu hoàn tiền
  TEACHER_COMPLAINT = 'TEACHER_COMPLAINT', // Khiếu nại GV
  PARENT_COMPLAINT = 'PARENT_COMPLAINT',   // Khiếu nại PH
  SCHEDULE_ISSUE = 'SCHEDULE_ISSUE',       // Vấn đề lịch học
  PAYMENT_ISSUE = 'PAYMENT_ISSUE',         // Vấn đề thanh toán
  SUBSTITUTE_TEACHER = 'SUBSTITUTE_TEACHER', // Yêu cầu GV dạy thay
  OTHER = 'OTHER',                         // Khác
}

export enum TicketStatus {
  OPEN = 'OPEN',                   // Vừa tạo
  IN_PROGRESS = 'IN_PROGRESS',     // OPS đang xử lý
  WAITING_INFO = 'WAITING_INFO',   // Chờ thêm thông tin
  WAITING_REFUND = 'WAITING_REFUND', // Chờ kế toán hoàn tiền (State Machine)
  RESOLVED = 'RESOLVED',           // Đã giải quyết
  CLOSED = 'CLOSED',               // Đã đóng (kế toán đã chi tiền)
  CANCELLED = 'CANCELLED',         // Đã hủy bởi người tạo
}

export enum TicketPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

// ─── Sub-schema: Comment/Reply ──────────────────────────────────────

@Schema({ timestamps: true })
export class TicketComment {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Ticket', required: true, index: true })
  ticketId!: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true })
  userId!: Types.ObjectId;

  @Prop({ type: String, trim: true, required: true })
  content!: string;

  @Prop({ type: [String], default: [] })
  attachments!: string[]; // URLs ảnh/file đính kèm

  @Prop({ type: Boolean, default: false })
  isInternal!: boolean; // Ghi chú nội bộ (PH/GV không thấy)

  @Prop({ type: Date })
  createdAt?: Date;

  @Prop({ type: Date })
  updatedAt?: Date;
}

export const TicketCommentSchema = SchemaFactory.createForClass(TicketComment);

// ─── Sub-schema: Resolution ─────────────────────────────────────────

@Schema({ _id: false })
export class TicketResolution {
  @Prop({ type: String, trim: true })
  summary?: string; // Tóm tắt kết quả

  @Prop({ type: String, enum: ['APPROVED', 'REJECTED', 'PARTIAL', 'CANCELLED'] })
  outcome?: string;

  @Prop({ type: Number, min: 0, default: 0 })
  refundAmount?: number; // Số tiền hoàn (nếu có)

  /** Ledger entry ID khi kế toán đã chi tiền hoàn (link accounting → ticket) */
  @Prop({ type: SchemaTypes.ObjectId, ref: 'LedgerEntry' })
  refundLedgerEntryId?: Types.ObjectId;

  /** Ngày kế toán xác nhận đã chi tiền hoàn */
  @Prop({ type: Date })
  refundPaidAt?: Date;

  /** Người chi tiền hoàn (kế toán) */
  @Prop({ type: SchemaTypes.ObjectId, ref: 'User' })
  refundPaidBy?: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User' })
  resolvedBy?: Types.ObjectId;

  @Prop({ type: Date })
  resolvedAt?: Date;
}

export const TicketResolutionSchema = SchemaFactory.createForClass(TicketResolution);

// ─── Main Schema ────────────────────────────────────────────────────

@Schema({ timestamps: true })
export class Ticket {
  /** Mã ticket (auto-gen: TKT-YYYYMMDD-XXXX) */
  @Prop({ type: String, trim: true, unique: true })
  ticketCode!: string;

  /** Loại khiếu nại */
  @Prop({ type: String, enum: TicketType, required: true })
  type!: TicketType;

  /** Trạng thái */
  @Prop({ type: String, enum: TicketStatus, default: TicketStatus.OPEN, index: true })
  status!: TicketStatus;

  /** Mức ưu tiên */
  @Prop({ type: String, enum: TicketPriority, default: TicketPriority.MEDIUM })
  priority!: TicketPriority;

  /** Tiêu đề */
  @Prop({ type: String, required: true, trim: true })
  subject!: string;

  /** Mô tả chi tiết */
  @Prop({ type: String, required: true, trim: true })
  description!: string;

  /** Người tạo (PARENT / TEACHER / OPS) */
  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true })
  createdBy!: Types.ObjectId;

  /** Role người tạo */
  @Prop({ type: String, trim: true })
  createdByRole?: string;

  // ── References (optional) ──

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Session' })
  sessionId?: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Classroom' })
  classId?: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Student' })
  studentId?: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User' })
  teacherId?: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User' })
  parentId?: Types.ObjectId;

  /** Hoi thoai noi bo da tao ra ticket nay (neu phat sinh tu chat ho tro) */
  @Prop({ type: SchemaTypes.ObjectId, ref: 'DirectConversation' })
  sourceConversationId?: Types.ObjectId;

  /** Payroll liên quan (nếu dispute lương) */
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Payroll' })
  payrollId?: Types.ObjectId;

  /** Ledger entry liên quan (nếu dispute thanh toán) */
  @Prop({ type: SchemaTypes.ObjectId, ref: 'LedgerEntry' })
  ledgerEntryId?: Types.ObjectId;

  // ══════════════════════════════════════════════════════════════════════════
  // ⚠️ DEPRECATED FIELDS - DO NOT USE FOR NEW LOGIC
  // Substitute teacher management has been moved to a separate LeaveRequests module.
  // These fields are kept for backward compatibility with existing data.
  // Use LeaveRequests for all new substitute teacher (dạy thay) operations.
  // ══════════════════════════════════════════════════════════════════════════

  /** @deprecated Use LeaveRequests module instead */
  @Prop({ type: SchemaTypes.ObjectId, ref: 'User' })
  substituteTeacherId?: Types.ObjectId;

  /** @deprecated Use LeaveRequests module instead */
  @Prop({ type: Date })
  substituteFromDate?: Date;

  /** @deprecated Use LeaveRequests module instead */
  @Prop({ type: Date })
  substituteToDate?: Date;

  /** @deprecated Use LeaveRequests module instead */
  @Prop({ type: Number, min: 0 })
  substitutePayRate?: number;

  /** @deprecated Use LeaveRequests module instead */
  @Prop({ type: Boolean, default: true })
  substituteCanCreateLink?: boolean;

  // ══════════════════════════════════════════════════════════════════════════

  // ── Attachments ──

  @Prop({ type: [String], default: [] })
  attachments!: string[]; // Ảnh/file đính kèm ban đầu

  // ── Assignment ──

  /** OPS được assign xử lý */
  @Prop({ type: SchemaTypes.ObjectId, ref: 'User' })
  assignedTo?: Types.ObjectId;

  @Prop({ type: Date })
  assignedAt?: Date;

  // ── Resolution ──

  @Prop({ type: TicketResolutionSchema })
  resolution?: TicketResolution;

  // ── SLA ──

  @Prop({ type: Date })
  dueDate?: Date; // Hạn xử lý

  @Prop({ type: Boolean, default: false })
  isOverdue!: boolean;

  // ── Metadata ──

  @Prop({ type: Date })
  createdAt?: Date;

  @Prop({ type: Date })
  updatedAt?: Date;
}

export const TicketSchema = SchemaFactory.createForClass(Ticket);

// ─── Indexes ────────────────────────────────────────────────────────
TicketSchema.index({ status: 1, priority: -1 });
TicketSchema.index({ createdBy: 1 });
TicketSchema.index({ assignedTo: 1, status: 1 });
TicketSchema.index({ sessionId: 1 });
TicketSchema.index({ type: 1, status: 1 });
TicketSchema.index({ sourceConversationId: 1, type: 1, status: 1 });
TicketSchema.index({ createdAt: -1 });

