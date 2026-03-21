import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

export type LedgerEntryDocument = HydratedDocument<LedgerEntry>;

// ─── Loại giao dịch ─────────────────────────────────────────────────

export enum TransactionType {
  TOP_UP = 'TOP_UP',                   // Nạp tiền
  SESSION_DEDUCT = 'SESSION_DEDUCT',   // Trừ tiền buổi học (khi FINALIZED)
  REFUND = 'REFUND',                   // Hoàn tiền (huỷ buổi)
  ADJUSTMENT = 'ADJUSTMENT',           // Điều chỉnh thủ công (ACCOUNTING)
  BONUS = 'BONUS',                     // Thưởng / khuyến mãi
  TRANSFER_OUT = 'TRANSFER_OUT',       // Chuyển tiền đi (sang ví khác)
  TRANSFER_IN = 'TRANSFER_IN',        // Nhận tiền chuyển (từ ví khác)
}

/**
 * Phân loại chi tiết loại điều chỉnh manual (dùng với type = ADJUSTMENT).
 * Bắt buộc cho audit trail chống gian lận.
 */
export enum AdjustmentType {
  MANUAL_ADJUST = 'MANUAL_ADJUST',       // Admin điều chỉnh tay (cần ghi rõ lý do)
  TRANSFER = 'TRANSFER',                 // Chuyển nhượng giữa học sinh
  INVOICE_CANCEL_ROLLBACK = 'INVOICE_CANCEL_ROLLBACK', // Rollback do hủy hóa đơn
  DISPUTE_RESOLUTION = 'DISPUTE_RESOLUTION', // Giải quyết tranh chấp
  PROMO_CREDIT = 'PROMO_CREDIT',         // Cộng credit khuyến mãi
  WRITE_OFF = 'WRITE_OFF',               // Xóa nợ (bad debt)
  CORRECTION = 'CORRECTION',             // Sửa lỗi hệ thống
  OTHER = 'OTHER',                       // Khác (yêu cầu ghi rõ reason)
}

export enum TransactionStatus {
  PENDING = 'PENDING',       // Chờ duyệt (topup yêu cầu)
  APPROVED = 'APPROVED',     // Đã duyệt (topup confirmed → balance đã cộng)
  COMPLETED = 'COMPLETED',   // Hoàn tất (deduct/refund auto)
  REJECTED = 'REJECTED',     // Từ chối (topup bị reject)
}

export enum PaymentMethod {
  BANK_TRANSFER = 'BANK_TRANSFER',
  CASH = 'CASH',
  MOMO = 'MOMO',
  VNPAY = 'VNPAY',
  ZALO_PAY = 'ZALO_PAY',
  SYSTEM = 'SYSTEM',         // Hệ thống tự động (deduct/refund)
}

// ─── Main Schema ─────────────────────────────────────────────────────

@Schema({ timestamps: true })
export class LedgerEntry {
  /** Ví liên quan */
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Wallet', required: true })
  walletId!: Types.ObjectId;

  /** Chủ ví */
  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true })
  userId!: Types.ObjectId;

  /** Loại giao dịch */
  @Prop({ type: String, enum: TransactionType, required: true })
  type!: TransactionType;

  /** Trạng thái */
  @Prop({ type: String, enum: TransactionStatus, default: TransactionStatus.COMPLETED })
  status!: TransactionStatus;

  /** Số tiền (luôn dương; hướng giao dịch xác định bởi type) */
  @Prop({ type: Number, required: true, min: 0 })
  amount!: number;

  /** Số dư trước giao dịch - Cho phép âm khi ghi nợ */
  @Prop({ type: Number, default: 0 })
  balanceBefore!: number;

  /** Số dư sau giao dịch - Cho phép âm khi ghi nợ */
  @Prop({ type: Number, default: 0 })
  balanceAfter!: number;

  /** Mô tả ngắn */
  @Prop({ type: String, trim: true })
  description?: string;

  /**
   * Loại điều chỉnh chi tiết (chỉ dùng khi type = ADJUSTMENT).
   * Bắt buộc cho audit trail để phân loại lý do điều chỉnh.
   */
  @Prop({ type: String, enum: Object.values(AdjustmentType) })
  adjustmentType?: AdjustmentType;

  /**
   * Lý do điều chỉnh chi tiết (bắt buộc khi type = ADJUSTMENT).
   * Ghi rõ lý do để audit trail đầy đủ.
   */
  @Prop({ type: String, trim: true })
  adjustmentReason?: string;

  // ── References ──

  /** Session liên quan (nếu deduct/refund) */
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Session' })
  sessionId?: Types.ObjectId;

  /** Invoice liên quan (nếu top-up từ hóa đơn) */
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Invoice' })
  invoiceId?: Types.ObjectId;

  /** Class liên quan */
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Classroom' })
  classId?: Types.ObjectId;

  /** Student liên quan */
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Student' })
  studentId?: Types.ObjectId;

  // ── Payment details (cho TOP_UP) ──

  /** Phương thức thanh toán */
  @Prop({ type: String, enum: PaymentMethod })
  paymentMethod?: PaymentMethod;

  /** Mã giao dịch ngân hàng / ví điện tử */
  @Prop({ type: String, trim: true })
  transactionRef?: string;

  /** Ảnh chụp biên lai */
  @Prop({ type: String, trim: true })
  receiptImageUrl?: string;

  /** Ghi chú của ACCOUNTING khi duyệt */
  @Prop({ type: String, trim: true })
  accountingNotes?: string;

  // ── Approval ──

  /** Người duyệt (ACCOUNTING/DIRECTOR) */
  @Prop({ type: SchemaTypes.ObjectId, ref: 'User' })
  approvedBy?: Types.ObjectId;

  @Prop({ type: Date })
  approvedAt?: Date;

  /** Người tạo */
  @Prop({ type: SchemaTypes.ObjectId, ref: 'User' })
  createdBy?: Types.ObjectId;

  /** Ledger entry đối ứng (dùng cho TRANSFER_OUT ↔ TRANSFER_IN) */
  @Prop({ type: SchemaTypes.ObjectId, ref: 'LedgerEntry' })
  relatedEntryId?: Types.ObjectId;

  @Prop({ type: Date })
  createdAt?: Date;

  @Prop({ type: Date })
  updatedAt?: Date;
}

export const LedgerEntrySchema = SchemaFactory.createForClass(LedgerEntry);

// ─── Indexes ─────────────────────────────────────────────────────────

LedgerEntrySchema.index({ walletId: 1, createdAt: -1 });
LedgerEntrySchema.index({ userId: 1, type: 1 });
LedgerEntrySchema.index({ sessionId: 1 });
LedgerEntrySchema.index({ status: 1, type: 1 }); // Tìm topup PENDING
LedgerEntrySchema.index({ createdAt: -1 });
LedgerEntrySchema.index(
  { invoiceId: 1, type: 1 },
  {
    unique: true,
    partialFilterExpression: {
      type: TransactionType.TOP_UP,
      invoiceId: { $exists: true },
    },
  },
);
