import { Prop, Schema, SchemaFactory, raw } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

export type SalaryConfigDocument = HydratedDocument<SalaryConfig>;

export enum CommissionType {
  PROGRESSIVE = 'PROGRESSIVE',   // Lũy tiến: mỗi mốc áp dụng cho phần doanh thu tương ứng
  HIGHEST_TIER = 'HIGHEST_TIER', // Mốc cao nhất: toàn bộ doanh thu tính % của mốc đạt được
}

export enum SalaryConfigStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

@Schema({ timestamps: true, optimisticConcurrency: true })
export class SalaryConfig {
  /** Nhân viên (unique — mỗi người 1 cấu hình) */
  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true, unique: true })
  userId!: Types.ObjectId;

  // ── Lương cứng ──

  /** Lương cứng / tháng (VNĐ) */
  @Prop({ type: Number, min: 0, required: true })
  baseSalary!: number;

  /** Số giờ chuẩn / tháng (VD: 176) */
  @Prop({ type: Number, min: 1, required: true })
  standardHours!: number;

  /** Giờ vào ca (VD: "08:00") — dùng để tính đến muộn */
  @Prop({ type: String, required: true, default: '08:00' })
  scheduledStartTime!: string;

  /** Giờ kết thúc ca (VD: "17:00") — dùng để tính về sớm */
  @Prop({ type: String, required: true, default: '17:00' })
  scheduledEndTime!: string;

  // ── Phạt muộn ──

  /** Số tiền phạt / lần đến muộn (VNĐ) */
  @Prop({ type: Number, min: 0, default: 0 })
  latePenaltyAmount!: number;

  // ── Hoa hồng ──

  /** Bật/tắt hoa hồng cho user này */
  @Prop({ type: Boolean, default: false })
  commissionEnabled!: boolean;

  /** Kiểu tính hoa hồng */
  @Prop({ type: String, enum: CommissionType, default: CommissionType.PROGRESSIVE })
  commissionType!: CommissionType;

  /** Bảng mốc hoa hồng: [{ minRevenue, maxRevenue (null = vô hạn), percentage }] */
  @Prop({
    type: [raw({
      minRevenue: { type: Number, required: true },
      maxRevenue: { type: Number, default: null },
      percentage: { type: Number, required: true, min: 0, max: 100 },
    })],
    default: [],
  })
  commissionTiers!: Array<{
    minRevenue: number;
    maxRevenue: number | null;
    percentage: number;
  }>;

  // ── KPI Bonus ──

  /** Bật/tắt thưởng KPI cho user này */
  @Prop({ type: Boolean, default: false })
  kpiBonusEnabled!: boolean;

  /** Bảng mốc KPI: [{ minScore, maxScore, bonusPercentage (% of baseSalary) }] */
  @Prop({
    type: [raw({
      minScore: { type: Number, required: true },
      maxScore: { type: Number, required: true },
      bonusPercentage: { type: Number, required: true, min: 0 },
    })],
    default: [],
  })
  kpiBonusTiers!: Array<{
    minScore: number;
    maxScore: number;
    bonusPercentage: number;
  }>;

  // ── Meta ──

  @Prop({ type: String, enum: SalaryConfigStatus, default: SalaryConfigStatus.ACTIVE })
  status!: SalaryConfigStatus;

  /** Ngày bắt đầu hiệu lực */
  @Prop({ type: Date, default: () => new Date() })
  effectiveFrom!: Date;

  /** Ghi chú */
  @Prop({ type: String, trim: true })
  notes?: string;
}

export const SalaryConfigSchema = SchemaFactory.createForClass(SalaryConfig);
SalaryConfigSchema.index({ status: 1 });

