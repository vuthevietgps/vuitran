import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
import { Student } from '../../students/schemas/student.schema';
import { User } from '../../users/schemas/user.schema';
// NOTE: Không import Classroom trực tiếp để tránh circular dependency
// class.schema.ts import invoice.schema.ts → invoice.schema.ts import class.schema.ts

export enum InvoiceStatus {
  PENDING_APPROVAL = 'PENDING_APPROVAL', // Chờ duyệt
  APPROVED = 'APPROVED',                 // Đã duyệt — đã nạp ví PH
  PAID = 'PAID',                         // Đã thanh toán (legacy / tương đương APPROVED)
  PENDING = 'PENDING',                   // Chờ thanh toán (legacy)
  REJECTED = 'REJECTED',                 // Bị từ chối
  CANCELLED = 'CANCELLED',               // Đã hủy
}

/** Loại hóa đơn */
export enum InvoiceType {
  TUITION = 'TUITION',       // Thu học phí → nạp ví PH
  MATERIAL = 'MATERIAL',     // Thu tiền tài liệu/giáo trình
  OTHER = 'OTHER',           // Thu khác
}

/** Loại lớp học của hóa đơn */
export enum ClassType {
  ONLINE = 'ONLINE',
  OFFLINE = 'OFFLINE',
}

export enum InvoiceCourseStatus {
  NEW = 'NEW',
  CONTINUE_1 = 'CONTINUE_1',
  CONTINUE_2 = 'CONTINUE_2',
  CONTINUE_3 = 'CONTINUE_3',
  CONTINUE_4 = 'CONTINUE_4',
  CONTINUE_5 = 'CONTINUE_5',
}

export type InvoiceDocument = HydratedDocument<Invoice>;

@Schema({ timestamps: true })
export class Invoice {
  @Prop({ required: true, trim: true, unique: true })
  invoiceNumber!: string;

  /** Loại hóa đơn */
  @Prop({ type: String, enum: Object.values(InvoiceType), default: InvoiceType.TUITION })
  invoiceType!: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: Student.name, required: true })
  studentId!: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Order', required: false })
  orderId?: Types.ObjectId;

  @Prop({ type: Number, min: 0, required: false })
  orderItemIndex?: number;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Product', required: false })
  productId?: Types.ObjectId;

  @Prop({ type: String, trim: true, required: false })
  productName?: string;

  /** Lớp học liên quan (để biết thanh toán cho lớp nào) */
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Classroom', required: false })
  classId?: Types.ObjectId;

  /** Lớp được chọn sẵn từ order, sẽ auto gán sau khi duyệt hóa đơn */
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Classroom', required: false })
  requestedClassId?: Types.ObjectId;

  /** Giáo viên được chọn sẵn từ order, sẽ dùng để auto tạo lớp mới nếu chưa chọn lớp */
  @Prop({ type: SchemaTypes.ObjectId, ref: User.name, required: false })
  requestedTeacherId?: Types.ObjectId;

  /** Sale phụ trách — luôn ghi nhận doanh thu & hoa hồng cho sale này */
  @Prop({ type: SchemaTypes.ObjectId, ref: User.name, required: false })
  saleId?: Types.ObjectId;

  /** Hoa hồng cho sale (VNĐ) — sẽ bổ sung công thức tính sau */
  @Prop({ type: Number, min: 0, default: 0 })
  saleCommission!: number;

  /** Đã nạp vào ví PH chưa (tránh nạp lại khi đã APPROVED) */
  @Prop({ type: Boolean, default: false })
  walletTopUpDone!: boolean;

  /** Ledger entry ID khi đã nạp ví (để trace) */
  @Prop({ type: SchemaTypes.ObjectId, ref: 'LedgerEntry', required: false })
  ledgerEntryId?: Types.ObjectId;

  /** Loại lớp học: ONLINE hoặc OFFLINE */
  @Prop({ type: String, enum: Object.values(ClassType), required: false })
  classType?: string;

  /** Số buổi học đăng ký thanh toán */
  @Prop({ type: Number, min: 0, required: false })
  sessions?: number;

  /** Số buổi tặng thêm theo chương trình khuyến mãi */
  @Prop({ type: Number, min: 0, default: 0 })
  bonusSessions?: number;

  /** Số buổi học thử (được gộp chung vào tổng số buổi của hóa đơn) */
  @Prop({ type: Number, min: 0, default: 0 })
  trialSessions?: number;

  @Prop({ type: Number, min: 1, required: false })
  paymentRound?: number;

  @Prop({
    type: String,
    enum: Object.values(InvoiceCourseStatus),
    default: InvoiceCourseStatus.NEW,
  })
  courseStatus!: string;

  /** Giá mỗi buổi tại thời điểm lập hóa đơn (cho referenceDuration phút) */
  @Prop({ type: Number, min: 0, required: false })
  pricePerSession?: number;

  /**
   * Thời lượng cơ sở mà pricePerSession dựa trên (phút).
   * VD: Invoice 3.8M / 20 buổi / 70 phút → referenceDuration = 70.
   * Dùng để tính perMinuteRate → tính giá buổi bất kỳ thời lượng.
   */
  @Prop({ type: Number, min: 1, required: false })
  referenceDuration?: number;

  /**
   * Đơn giá/phút (auto-computed) = pricePerSession / referenceDuration.
   * Dùng để tính amountCharged cho session bất kỳ thời lượng:
   * amountCharged = perMinuteRate × actualDuration.
   */
  @Prop({ type: Number, min: 0, required: false })
  perMinuteRate?: number;

  /** Lương GV mỗi buổi (VNĐ) — lưu từ order/DTO để truyền sang class */
  @Prop({ type: Number, min: 0, default: 0 })
  teacherPayPerSession?: number;

  /** Số buổi quy đổi còn lại (theo referenceDuration) */
  @Prop({ type: Number, min: 0, required: false })
  sessionsRemaining?: number;

  /** Số buổi tặng còn lại (không cộng ví, chỉ dùng để học bù/khuyến mãi) */
  @Prop({ type: Number, min: 0, default: 0 })
  bonusSessionsRemaining?: number;

  /** Số buổi học thử còn lại */
  @Prop({ type: Number, min: 0, default: 0 })
  trialSessionsRemaining?: number;

  @Prop({ required: true, min: 0 })
  amount!: number; // Tổng số tiền = sessions * pricePerSession (hoặc nhập tự do)

  @Prop({ required: true })
  paymentDate!: Date;

  @Prop({ type: String, trim: true, required: false })
  receiptImage?: string; // Ảnh chứng từ (optional)

  @Prop({ type: String, trim: true })
  description?: string;

  @Prop({
    type: String,
    enum: Object.values(InvoiceStatus),
    default: InvoiceStatus.PENDING_APPROVAL,
  })
  status!: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: User.name, required: true })
  createdBy!: Types.ObjectId;

  // ── Approval tracking ──

  /** Người duyệt (DIRECTOR / ACCOUNTING) */
  @Prop({ type: SchemaTypes.ObjectId, ref: User.name, required: false })
  approvedBy?: Types.ObjectId;

  @Prop({ type: Date, required: false })
  approvedAt?: Date;

  /** Ảnh xác nhận duyệt hóa đơn (bắt buộc khi APPROVE) */
  @Prop({ type: String, trim: true, required: false })
  approvalImage?: string;

  /** Lý do từ chối (nếu REJECTED) */
  @Prop({ type: String, trim: true, required: false })
  rejectedReason?: string;

  // ── Cancellation tracking ──

  /** Người hủy hóa đơn (nếu CANCELLED) */
  @Prop({ type: SchemaTypes.ObjectId, ref: User.name, required: false })
  cancelledBy?: Types.ObjectId;

  @Prop({ type: Date, required: false })
  cancelledAt?: Date;

  /** Lý do hủy */
  @Prop({ type: String, trim: true, required: false })
  cancellationReason?: string;
}

export const InvoiceSchema = SchemaFactory.createForClass(Invoice);

// ─── Indexes ─────────────────────────────────────────────────────────
InvoiceSchema.index({ studentId: 1, createdAt: -1 });
InvoiceSchema.index({ studentId: 1, classId: 1, status: 1 }); // Attendance + wallet deduction lookups
InvoiceSchema.index({ saleId: 1 });
InvoiceSchema.index({ status: 1 });
InvoiceSchema.index({ classId: 1 });
InvoiceSchema.index({ courseStatus: 1 });
InvoiceSchema.index({ orderId: 1, classId: 1 });
InvoiceSchema.index({ orderId: 1, orderItemIndex: 1 });
