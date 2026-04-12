import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

export type WalletDocument = HydratedDocument<Wallet>;

export enum WalletStatus {
  ACTIVE = 'ACTIVE',
  FROZEN = 'FROZEN',     // Tạm khóa (chờ xử lý tranh chấp)
  CLOSED = 'CLOSED',
}

@Schema({ timestamps: true })
export class Wallet {
  /** Chủ ví — thường là PARENT, nhưng cũng có thể mở rộng cho TEACHER */
  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true, unique: true })
  userId!: Types.ObjectId;

  /** Số dư hiện tại (VNĐ) - Cho phép âm để hỗ trợ ghi nợ */
  @Prop({ type: Number, default: 0 })
  balance!: number;

  /**
   * Giới hạn nợ tối đa (VNĐ) — mặc định = 0 (tự tính từ trialDebtSessions * giá buổi).
   * Nếu > 0: đây là giá trị cố định do admin set.
   * Logic: balance không được < -debtLimit
   */
  @Prop({ type: Number, min: 0, default: 0 })
  debtLimit!: number;

  /** Số buổi học thử cho phép nợ (mặc định 2) */
  @Prop({ type: Number, min: 0, default: 2 })
  trialDebtSessions!: number;

  /** Tổng nạp lũy kế */
  @Prop({ type: Number, min: 0, default: 0 })
  totalTopUp!: number;

  /** Tổng đã trừ lũy kế */
  @Prop({ type: Number, min: 0, default: 0 })
  totalDeducted!: number;

  /** Tổng hoàn lại lũy kế */
  @Prop({ type: Number, min: 0, default: 0 })
  totalRefunded!: number;

  /** Tổng chuyển đi lũy kế (transfer out) */
  @Prop({ type: Number, min: 0, default: 0 })
  totalTransferOut!: number;

  /** Tổng nhận chuyển lũy kế (transfer in) */
  @Prop({ type: Number, min: 0, default: 0 })
  totalTransferIn!: number;

  /** Trạng thái ví */
  @Prop({ type: String, enum: WalletStatus, default: WalletStatus.ACTIVE })
  status!: WalletStatus;

  /** Lần cuối có biến động */
  @Prop({ type: Date })
  lastTransactionAt?: Date;

  @Prop({ type: Date })
  createdAt?: Date;

  @Prop({ type: Date })
  updatedAt?: Date;
}

export const WalletSchema = SchemaFactory.createForClass(Wallet);
WalletSchema.index({ status: 1 });
WalletSchema.index({ status: 1, balance: -1 });

