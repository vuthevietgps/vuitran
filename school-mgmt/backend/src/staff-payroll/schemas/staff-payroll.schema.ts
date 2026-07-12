import { Prop, Schema, SchemaFactory, raw } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

export type StaffPayrollDocument = HydratedDocument<StaffPayroll>;

export enum StaffPayrollStatus {
  DRAFT = 'DRAFT',
  PENDING_REVIEW = 'PENDING_REVIEW',
  APPROVED = 'APPROVED',
  PAID = 'PAID',
  REJECTED = 'REJECTED',
}

@Schema({ timestamps: true, optimisticConcurrency: true })
export class StaffPayroll {
  /** Nhân viên */
  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true })
  userId!: Types.ObjectId;

  /** Tên nhân viên (snapshot) */
  @Prop({ type: String, required: true })
  userName!: string;

  /** Vai trò (snapshot) */
  @Prop({ type: String, required: true })
  role!: string;

  /** Kỳ lương */
  @Prop({ type: Date, required: true })
  periodStart!: Date;

  @Prop({ type: Date, required: true })
  periodEnd!: Date;

  /** Mã bảng lương (auto: SPR-{YYYYMM}-{userId6}) */
  @Prop({ type: String, trim: true, unique: true })
  payrollCode!: string;

  // ══════════════ LƯƠNG CỨNG ══════════════

  /** Lương cứng gốc (từ SalaryConfig) */
  @Prop({ type: Number, min: 0, default: 0 })
  baseSalary!: number;

  /** Giờ chuẩn / tháng */
  @Prop({ type: Number, min: 0, default: 0 })
  standardHours!: number;

  /** Tổng giờ làm thực tế (từ WorkSession) */
  @Prop({ type: Number, min: 0, default: 0 })
  actualHours!: number;

  /** Tỷ lệ chấm công = actualHours / standardHours (cap 1.0) */
  @Prop({ type: Number, min: 0, default: 0 })
  attendanceRatio!: number;

  /** Lương cứng thực nhận = baseSalary × attendanceRatio */
  @Prop({ type: Number, min: 0, default: 0 })
  baseSalaryAmount!: number;

  // ══════════════ HOA HỒNG ══════════════

  /** Doanh thu trong kỳ (từ Orders approved/completed) */
  @Prop({ type: Number, min: 0, default: 0 })
  totalRevenue!: number;

  /** Kiểu tính hoa hồng (snapshot) */
  @Prop({ type: String })
  commissionType?: string;

  /** Snapshot bảng mốc hoa hồng */
  @Prop({
    type: [raw({
      minRevenue: { type: Number },
      maxRevenue: { type: Number },
      percentage: { type: Number },
    })],
    default: [],
  })
  commissionTiers!: Array<{
    minRevenue: number;
    maxRevenue: number | null;
    percentage: number;
  }>;

  /** Số tiền hoa hồng */
  @Prop({ type: Number, min: 0, default: 0 })
  commissionAmount!: number;

  // ══════════════ KPI BONUS ══════════════

  /** Điểm KPI */
  @Prop({ type: Number, min: 0, default: 0 })
  kpiScore!: number;

  /** Snapshot bảng mốc KPI */
  @Prop({
    type: [raw({
      minScore: { type: Number },
      maxScore: { type: Number },
      bonusPercentage: { type: Number },
    })],
    default: [],
  })
  kpiBonusTiers!: Array<{
    minScore: number;
    maxScore: number;
    bonusPercentage: number;
  }>;

  /** % thưởng KPI được áp dụng */
  @Prop({ type: Number, min: 0, default: 0 })
  kpiBonusPercentage!: number;

  /** Số tiền thưởng KPI = baseSalary × kpiBonusPercentage / 100 */
  @Prop({ type: Number, min: 0, default: 0 })
  kpiBonusAmount!: number;

  // ══════════════ PHẠT MUỘN ══════════════

  /** Số lần đến muộn */
  @Prop({ type: Number, min: 0, default: 0 })
  lateDays!: number;

  /** Tiền phạt / lần (snapshot) */
  @Prop({ type: Number, min: 0, default: 0 })
  latePenaltyPerTime!: number;

  /** Tổng phạt muộn = lateDays × latePenaltyPerTime */
  @Prop({ type: Number, min: 0, default: 0 })
  latePenaltyAmount!: number;

  /** So lan dung gio */
  @Prop({ type: Number, min: 0, default: 0 })
  onTimeDays!: number;

  /** Thuong dung gio / lan (snapshot) */
  @Prop({ type: Number, min: 0, default: 0 })
  punctualityBonusPerTime!: number;

  /** Tong thuong dung gio */
  @Prop({ type: Number, min: 0, default: 0 })
  punctualityBonusAmount!: number;

  /** So case trai nghiem da test trong ky */
  @Prop({ type: Number, min: 0, default: 0 })
  experienceCaseCount!: number;

  /** Don gia / case trai nghiem (snapshot) */
  @Prop({ type: Number, min: 0, default: 0 })
  experienceCaseRate!: number;

  /** Tong luong case trai nghiem */
  @Prop({ type: Number, min: 0, default: 0 })
  experienceCaseAmount!: number;

  /** So case trai nghiem chuyen doi thanh cong */
  @Prop({ type: Number, min: 0, default: 0 })
  successfulExperienceCaseCount!: number;

  /** So bai tap ve nha da cham trong ky */
  @Prop({ type: Number, min: 0, default: 0 })
  homeworkGradingCount!: number;

  /** Don gia / bai tap da cham (snapshot) */
  @Prop({ type: Number, min: 0, default: 0 })
  homeworkGradingRate!: number;

  /** Tong luong cham bai tap */
  @Prop({ type: Number, min: 0, default: 0 })
  homeworkGradingAmount!: number;

  // ══════════════ ĐIỀU CHỈNH THỦ CÔNG ══════════════

  /** Thưởng thêm */
  @Prop({ type: Number, min: 0, default: 0 })
  bonusAmount!: number;

  /** Trừ thêm */
  @Prop({ type: Number, min: 0, default: 0 })
  deductionAmount!: number;

  /** Ghi chú */
  @Prop({ type: String, trim: true })
  notes?: string;

  // ══════════════ TỔNG ══════════════

  /** Tổng thực nhận */
  @Prop({ type: Number, default: 0 })
  netAmount!: number;

  // ══════════════ WORKFLOW ══════════════

  @Prop({ type: String, enum: StaffPayrollStatus, default: StaffPayrollStatus.DRAFT })
  status!: StaffPayrollStatus;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User' })
  createdBy?: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User' })
  approvedBy?: Types.ObjectId;

  @Prop({ type: Date })
  approvedAt?: Date;

  @Prop({ type: String, trim: true })
  rejectionReason?: string;

  /** Người từ chối (DIRECTOR) — tách biệt với approvedBy */
  @Prop({ type: SchemaTypes.ObjectId, ref: 'User' })
  rejectedBy?: Types.ObjectId;

  @Prop({ type: Date })
  rejectedAt?: Date;

  @Prop({ type: Date })
  paidAt?: Date;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User' })
  paidBy?: Types.ObjectId;

  @Prop({ type: String, trim: true })
  paymentRef?: string;

  @Prop({ type: Date })
  createdAt?: Date;

  @Prop({ type: Date })
  updatedAt?: Date;
}

export const StaffPayrollSchema = SchemaFactory.createForClass(StaffPayroll);

StaffPayrollSchema.index({ userId: 1, periodStart: 1, periodEnd: 1 });
StaffPayrollSchema.index({ status: 1 });
StaffPayrollSchema.index({ createdAt: -1 });

