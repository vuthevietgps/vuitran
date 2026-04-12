import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

export type WorkSessionDocument = HydratedDocument<WorkSession>;

export enum WorkSessionStatus {
  ACTIVE = 'ACTIVE',           // Đang online (đã login, chưa logout)
  COMPLETED = 'COMPLETED',     // Đã logout bình thường
  AUTO_CLOSED = 'AUTO_CLOSED', // Hệ thống tự đóng (login mới mà chưa logout cũ)
}

@Schema({ timestamps: true })
export class WorkSession {
  /** Nhân viên */
  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true })
  userId!: Types.ObjectId;

  /** Ngày làm việc (chỉ ngày, không giờ — dùng cho group/query) */
  @Prop({ type: Date, required: true })
  date!: Date;

  /** Thời điểm đăng nhập */
  @Prop({ type: Date, required: true })
  loginTime!: Date;

  /** Giờ vào ca dự kiến (snapshot từ SalaryConfig tại thời điểm login) */
  @Prop({ type: String })
  scheduledStartTime?: string;

  /** Giờ kết thúc ca dự kiến (snapshot từ SalaryConfig tại thời điểm login) */
  @Prop({ type: String })
  scheduledEndTime?: string;

  /** Thời điểm đăng xuất */
  @Prop({ type: Date })
  logoutTime?: Date;

  /** Tổng phút làm việc (auto-calc khi logout) */
  @Prop({ type: Number, min: 0, default: 0 })
  totalMinutes!: number;

  /** Có đến muộn không (so với scheduledStartTime trong SalaryConfig) */
  @Prop({ type: Boolean, default: false })
  isLate!: boolean;

  /** Số phút đến muộn */
  @Prop({ type: Number, min: 0, default: 0 })
  lateMinutes!: number;

  /** Có về sớm không (so với scheduledEndTime trong SalaryConfig) */
  @Prop({ type: Boolean, default: false })
  isEarlyLeave!: boolean;

  /** Số phút về sớm */
  @Prop({ type: Number, min: 0, default: 0 })
  earlyLeaveMinutes!: number;

  /** Trạng thái */
  @Prop({ type: String, enum: WorkSessionStatus, default: WorkSessionStatus.ACTIVE })
  status!: WorkSessionStatus;

  /** Ghi chú (OPS chỉnh sửa thủ công) */
  @Prop({ type: String, trim: true })
  notes?: string;
}

export const WorkSessionSchema = SchemaFactory.createForClass(WorkSession);

// ─── Indexes ────────────────────────────────────────────────────────
WorkSessionSchema.index({ userId: 1, date: 1 });
WorkSessionSchema.index({ userId: 1, status: 1 });
WorkSessionSchema.index({ date: -1 });
