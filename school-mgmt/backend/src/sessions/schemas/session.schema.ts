import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
import {
  ReportTemplateDynamicField,
  ReportTemplateDynamicFieldSchema,
} from '../../report-templates/schemas/report-template.schema';

export type SessionDocument = HydratedDocument<Session>;

// ─── Enums ──────────────────────────────────────────────────────────

export enum SessionStatus {
  SCHEDULED = 'SCHEDULED',                   // Đã lên lịch
  TEACHER_COMPLETED = 'TEACHER_COMPLETED',   // GV xác nhận đã dạy
  PARENT_CONFIRMED = 'PARENT_CONFIRMED',     // PH xác nhận
  FINALIZED = 'FINALIZED',                   // Đã chốt (tự động hoặc thủ công) → sẵn sàng trừ ví / tính lương
  CANCELLED = 'CANCELLED',                   // Đã hủy
  NO_SHOW = 'NO_SHOW',                       // Học sinh vắng không phép
  RESCHEDULED = 'RESCHEDULED',               // Đã dời lịch (buổi cũ → tạo buổi mới)
}

export enum SessionType {
  REGULAR = 'REGULAR',       // Buổi học thường
  TRIAL = 'TRIAL',           // Buổi học thử
  MAKE_UP = 'MAKE_UP',       // Buổi bù
  EXAM_PREP = 'EXAM_PREP',   // Ôn thi
  REVIEW = 'REVIEW',         // Ôn tập
  EXTRA = 'EXTRA',           // Buổi học thêm
}

export enum CancelledByRole {
  TEACHER = 'TEACHER',
  PARENT = 'PARENT',
  OPS = 'OPS',
  SYSTEM = 'SYSTEM',
}

// ─── Sub-schemas ────────────────────────────────────────────────────

@Schema({ _id: false })
export class SessionConfirmation {
  @Prop({ type: Date })
  teacherCompletedAt?: Date;

  @Prop({ type: Date })
  parentConfirmedAt?: Date;

  @Prop({ type: Date })
  autoConfirmedAt?: Date; // Nếu PH không phản hồi sau X giờ

  @Prop({ type: Date })
  finalizedAt?: Date; // Thời điểm chốt cuối cùng

  @Prop({ type: Types.ObjectId, ref: 'User' })
  finalizedBy?: Types.ObjectId; // OPS/DIRECTOR chốt thủ công (nếu có)
}

export const SessionConfirmationSchema =
  SchemaFactory.createForClass(SessionConfirmation);

@Schema({ _id: false })
export class SessionCancellation {
  @Prop({ type: String, enum: CancelledByRole })
  cancelledBy?: CancelledByRole;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  cancelledByUserId?: Types.ObjectId;

  @Prop({ type: String, trim: true })
  cancelReason?: string;

  @Prop({ type: Date })
  cancelledAt?: Date;

  @Prop({ type: Number, min: 0, max: 100, default: 0 })
  refundPercent?: number; // % hoàn lại cho PH

  @Prop({ type: Number, min: 0, default: 0 })
  refundAmount?: number; // Số tiền hoàn (VNĐ)

  @Prop({ type: Boolean, default: false })
  isLateCancellation?: boolean; // Hủy trễ (< hoursBeforeSession)
}

export const SessionCancellationSchema =
  SchemaFactory.createForClass(SessionCancellation);

// ─── Sub-schema: Đánh giá chất lượng buổi học (GV điền) ────────────

@Schema({ _id: false })
export class SessionEvaluation {
  // ── Mục tiêu & nội dung ──
  @Prop({ type: String, trim: true })
  lessonObjective?: string; // Mục tiêu buổi học

  @Prop({ type: String, trim: true })
  lessonContent?: string; // Nội dung bài giảng chi tiết

  @Prop({ type: [String], default: [] })
  materialsUsed?: string[]; // Tài liệu/giáo trình sử dụng

  @Prop({ type: [String], default: [] })
  skillsTaught?: string[]; // Kỹ năng giảng dạy trong buổi (e.g. "Giải phương trình bậc 2")

  // ── Đánh giá HS trong buổi (GV ghi nhận) ──
  @Prop({ type: Number, min: 1, max: 5 })
  studentPerformance?: number; // Năng lực HS (1=Yếu, 5=Xuất sắc)

  @Prop({ type: Number, min: 1, max: 5 })
  studentEngagement?: number; // Mức độ tập trung/tham gia (1=Không tập trung, 5=Rất tích cực)

  @Prop({ type: Number, min: 1, max: 5 })
  comprehensionLevel?: number; // Mức độ hiểu bài (1=Chưa hiểu, 5=Hiểu hoàn toàn)

  @Prop({ type: String, trim: true })
  strengthsObserved?: string; // Điểm mạnh quan sát được

  @Prop({ type: String, trim: true })
  areasOfImprovement?: string; // Điểm cần cải thiện

  // ── Bài tập & kế hoạch ──
  @Prop({ type: String, trim: true })
  homeworkAssigned?: string; // Bài tập về nhà chi tiết

  @Prop({ type: Date })
  homeworkDeadline?: Date; // Hạn nộp bài tập

  @Prop({ type: String, enum: ['NOT_ASSIGNED', 'ASSIGNED', 'SUBMITTED', 'REVIEWED'], default: 'NOT_ASSIGNED' })
  homeworkStatus?: string; // Trạng thái BTVN

  @Prop({ type: Number, min: 0, max: 10 })
  homeworkScore?: number; // Điểm BTVN (0-10)

  @Prop({ type: String, trim: true })
  homeworkFeedback?: string; // Nhận xét BTVN

  // ── Tiến độ & kế hoạch tiếp theo ──
  @Prop({ type: Number, min: 0, max: 100 })
  progressPercent?: number; // Tiến độ hoàn thành nội dung khóa (0-100%)

  @Prop({ type: [String], default: [] })
  curriculumItemsCompleted?: string[]; // IDs/tên mục chương trình đã hoàn thành trong buổi

  @Prop({ type: String, trim: true })
  nextSessionPlan?: string; // Kế hoạch buổi học tiếp theo

  @Prop({ type: String, trim: true })
  overallComment?: string; // Nhận xét tổng quan buổi học
}

export const SessionEvaluationSchema =
  SchemaFactory.createForClass(SessionEvaluation);

// ─── Sub-schema: Báo cáo giảng dạy (GV điền sau mỗi buổi) ─────────

@Schema({ _id: false })
export class TeachingReport {
  /** Nội dung đã học trong buổi */
  @Prop({ type: String, trim: true, required: true })
  lessonContent!: string;

  /** Thái độ / hành vi của học sinh trong buổi */
  @Prop({ type: String, trim: true })
  studentAttitude?: string;

  /** Link ghi hình bài giảng */
  @Prop({ type: String, trim: true })
  recordingUrl?: string;

  @Prop({ type: String, trim: true })
  recordingFileKey?: string;

  /** Nhận xét chung của GV về buổi học */
  @Prop({ type: String, trim: true })
  teacherComment?: string;

  /** Bài tập về nhà (nếu có) */
  @Prop({ type: String, trim: true })
  homework?: string;

  /** Ghi chú thêm */
  @Prop({ type: String, trim: true })
  additionalNotes?: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'ReportTemplate' })
  templateId?: Types.ObjectId;

  @Prop({ type: String, trim: true })
  templateTitle?: string;

  @Prop({ type: Number, min: 1 })
  templateVersion?: number;

  @Prop({ type: SchemaTypes.Mixed })
  dynamicFieldValues?: Record<string, unknown>;

  @Prop({ type: [ReportTemplateDynamicFieldSchema], default: undefined })
  dynamicFieldSchemaSnapshot?: ReportTemplateDynamicField[];

  /** Thời điểm GV nộp báo cáo */
  @Prop({ type: Date, required: true })
  submittedAt!: Date;

  /** Deadline nộp báo cáo (tự động = scheduledDate + 24h) */
  @Prop({ type: Date })
  deadline?: Date;

  /** Có nộp muộn hay không */
  @Prop({ type: Boolean, default: false })
  isLateSubmission?: boolean;

  /** Thời gian nộp muộn (giờ) */
  @Prop({ type: Number, min: 0 })
  lateSubmissionHours?: number;

  /** Phiên bản báo cáo (dùng cho tracking updates) */
  @Prop({ type: Number, default: 1, min: 1 })
  version?: number;

  /** Lần cập nhật cuối */
  @Prop({ type: Date })
  lastUpdatedAt?: Date;
}

export const TeachingReportSchema =
  SchemaFactory.createForClass(TeachingReport);

// ─── Sub-schema: Phản hồi của phụ huynh ────────────────────────────

@Schema({ _id: false })
export class ParentFeedback {
  @Prop({ type: Number, min: 1, max: 5 })
  overallRating?: number; // Đánh giá tổng quan (1-5)

  @Prop({ type: Number, min: 1, max: 5 })
  teachingQualityRating?: number; // Chất lượng giảng dạy (1-5)

  @Prop({ type: Number, min: 1, max: 5 })
  communicationRating?: number; // Giao tiếp/tương tác (1-5)

  @Prop({ type: Number, min: 1, max: 5 })
  facilityRating?: number; // Cơ sở vật chất/trải nghiệm học tập (1-5)

  @Prop({ type: String, trim: true })
  parentNotes?: string; // Phản hồi của PH

  @Prop({ type: String, trim: true })
  concerns?: string; // Điều PH lo ngại/cần cải thiện

  @Prop({ type: Boolean })
  isSatisfied?: boolean; // PH hài lòng không?
}

export const ParentFeedbackSchema =
  SchemaFactory.createForClass(ParentFeedback);

@Schema({ _id: false })
export class SessionEditHistoryChange {
  @Prop({ type: String, required: true, trim: true })
  field!: string;

  @Prop({ type: String, required: true, trim: true })
  label!: string;

  @Prop({ type: String, trim: true })
  beforeValue?: string;

  @Prop({ type: String, trim: true })
  afterValue?: string;
}

export const SessionEditHistoryChangeSchema =
  SchemaFactory.createForClass(SessionEditHistoryChange);

@Schema({ _id: false })
export class SessionDurationRemainingSnapshot {
  @Prop({ type: Number, min: 1, required: true })
  newDurationMinutes!: number;

  @Prop({ type: Number, min: 0, default: 0 })
  paidRemainingMinutes?: number;

  @Prop({ type: Number, min: 0, default: 0 })
  bonusRemainingMinutes?: number;

  @Prop({ type: Number, min: 0, default: 0 })
  totalRemainingMinutes?: number;

  @Prop({ type: Number, min: 0, default: 0 })
  paidSessionsRemaining?: number;

  @Prop({ type: Number, min: 0, default: 0 })
  bonusSessionsRemaining?: number;

  @Prop({ type: Number, min: 0, default: 0 })
  totalSessionsRemaining?: number;
}

export const SessionDurationRemainingSnapshotSchema =
  SchemaFactory.createForClass(SessionDurationRemainingSnapshot);

@Schema({ _id: false })
export class SessionEditHistoryEntry {
  @Prop({ type: Date, required: true })
  editedAt!: Date;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  editedByUserId?: Types.ObjectId;

  @Prop({ type: String, trim: true })
  editedByName?: string;

  @Prop({ type: String, trim: true })
  editedByRole?: string;

  @Prop({ type: [SessionEditHistoryChangeSchema], default: [] })
  changes!: SessionEditHistoryChange[];

  @Prop({ type: SessionDurationRemainingSnapshotSchema })
  durationSnapshot?: SessionDurationRemainingSnapshot;
}

export const SessionEditHistoryEntrySchema =
  SchemaFactory.createForClass(SessionEditHistoryEntry);

// ─── Main Schema ────────────────────────────────────────────────────

@Schema({ timestamps: true })
export class Session {
  // ── References ──
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Classroom', required: true })
  classId!: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Student', required: true })
  studentId!: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true })
  teacherId!: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User' })
  parentUserId?: Types.ObjectId; // PH liên kết (auto-populate từ Student)

  // ── Tracking nguồn quảng cáo (denormalize từ Student/Order) ──
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Order' })
  orderId?: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'AdGroup' })
  adGroupId?: Types.ObjectId;

  @Prop({ type: String })
  adGroupName?: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'TrialEnrollment', index: true })
  trialEnrollmentId?: Types.ObjectId;

  // ── Session type ──
  @Prop({ type: String, enum: SessionType, default: SessionType.REGULAR, index: true })
  sessionType!: SessionType; // Loại buổi học

  // ── Schedule (linh hoạt — GV & PH tự thỏa thuận) ──
  @Prop({ type: Date, required: true })
  scheduledDate!: Date; // Ngày dạy

  @Prop({ type: String, trim: true }) // "HH:mm" — optional, GV & PH tự sắp xếp
  scheduledStartTime?: string;

  @Prop({ type: String, trim: true }) // "HH:mm" — optional
  scheduledEndTime?: string;

  @Prop({ type: Number, min: 15, required: true })
  durationMinutes!: number; // Thời lượng buổi học (phút) — bắt buộc để tính tiền

  // ── Actual timing (GV ghi nhận khi hoàn thành) ──
  @Prop({ type: Date })
  actualStartTime?: Date;

  @Prop({ type: Date })
  actualEndTime?: Date;

  // ── Session number ──
  @Prop({ type: Number, min: 1 })
  sessionNumber?: number; // Buổi thứ mấy trong lớp

  // ── Content (legacy — giữ tương thích) ──
  @Prop({ type: String, trim: true })
  topicsCovered?: string; // Nội dung đã dạy

  @Prop({ type: String, trim: true })
  homework?: string; // Bài tập về nhà

  @Prop({ type: String, trim: true })
  teacherNotes?: string; // Ghi chú của GV

  @Prop({ type: String, trim: true })
  parentNotes?: string; // Phản hồi của PH (legacy)

  @Prop({ type: Number, min: 1, max: 5 })
  parentRating?: number; // PH đánh giá buổi học (1-5) (legacy)

  // ── Đánh giá buổi học chi tiết (GV điền) ──
  @Prop({ type: SessionEvaluationSchema })
  evaluation?: SessionEvaluation;

  // ── Báo cáo giảng dạy (GV bắt buộc điền — quyết định tính lương) ──
  @Prop({ type: TeachingReportSchema })
  teachingReport?: TeachingReport;

  /** true khi GV đã nộp báo cáo giảng dạy — chỉ session có report mới tính lương */
  @Prop({ type: Boolean, default: false, index: true })
  hasTeachingReport!: boolean;

  // ── Phản hồi chi tiết từ PH ──
  @Prop({ type: ParentFeedbackSchema })
  parentFeedback?: ParentFeedback;

  // ── Status ──
  @Prop({
    type: String,
    enum: SessionStatus,
    default: SessionStatus.SCHEDULED,
    index: true,
  })
  status!: SessionStatus;

  // ── Confirmation workflow ──
  @Prop({ type: SessionConfirmationSchema, default: () => ({}) })
  confirmation!: SessionConfirmation;

  // ── Cancellation info ──
  @Prop({ type: SessionCancellationSchema })
  cancellation?: SessionCancellation;

  // ── Reschedule ──
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Session' })
  rescheduledFromId?: Types.ObjectId; // Buổi gốc nếu đây là buổi dời lịch

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Session' })
  rescheduledToId?: Types.ObjectId; // Buổi mới nếu buổi này bị dời

  // ── Financials ──
  @Prop({ type: Number, min: 0, default: 0 })
  amountCharged!: number; // Số tiền tính cho PH (VNĐ)

  @Prop({ type: Number, min: 0, default: 0 })
  referenceAmountCharged!: number; // Giá trị chuẩn dùng để quy đổi suất học/invoice kể cả khi là buổi tặng

  @Prop({ type: Number, min: 0, default: 0 })
  teacherPayout!: number; // Lương GV cho buổi này (VNĐ)

  @Prop({ type: Boolean, default: false })
  isPaid!: boolean; // Đã trừ ví PH chưa

  @Prop({ type: Boolean, default: false, index: true })
  isBonusSession!: boolean; // Buổi tặng/khuyến mãi: không trừ ví nhưng vẫn tính lương GV

  @Prop({ type: Boolean, default: false, index: true })
  invoiceConsumptionApplied!: boolean; // Đã tiêu hao suất học trên invoice chưa

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Invoice' })
  consumedInvoiceId?: Types.ObjectId; // Invoice đầu tiên được consume (trace)

  @Prop({ type: Number, min: 0, default: 0 })
  consumedInvoiceUnits!: number; // Tổng số buổi quy đổi đã trừ (có thể là số thập phân)

  @Prop({ type: Number, min: 0, default: 0 })
  consumedInvoiceAmount!: number; // Giá trị tiền tương ứng đã trừ trên invoice(s)

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Invoice' })
  bonusInvoiceId?: Types.ObjectId; // Invoice đầu tiên cấp suất buổi tặng

  @Prop({ type: Number, min: 0, default: 0 })
  consumedBonusUnits!: number; // Tổng số buổi tặng quy đổi đã dùng

  @Prop({ type: Number, min: 0, default: 0 })
  consumedBonusAmount!: number; // Giá trị tương đương theo bảng giá của buổi tặng

  @Prop({ type: Boolean, default: false })
  isTeacherPaid!: boolean; // Đã tính vào payroll GV chưa
  @Prop({ type: String, trim: true })
  walletDeductError?: string;

  @Prop({ type: Date })
  walletDeductAlertSentAt?: Date;

  // ── Trial session tracking ──

  /**
   * Buổi học thử đã chuyển thành buổi trả phí chưa?
   * - true: HS học tiếp → buổi trial bị trừ ví + tính lương GV
   * - false: chưa convert (chờ quyết định)
   * - Chỉ áp dụng khi sessionType = TRIAL
   */
  @Prop({ type: Boolean, default: false })
  trialConverted!: boolean;

  /** HS không học tiếp sau trial → KHÔNG trả lương GV, không trừ ví PH (deprecated, dùng trialRejectedNoPay) */
  @Prop({ type: Boolean, default: false })
  trialTeacherPaidOnly!: boolean;

  /** Trial bị từ chối → GV không được trả lương từ HS này, không trừ ví PH */
  @Prop({ type: Boolean, default: false })
  trialRejectedNoPay!: boolean;

  // ── Auto-confirm config ──
  @Prop({ type: Number, min: 1, default: 48 })
  autoConfirmAfterHours!: number; // Tự xác nhận sau X giờ nếu PH không phản hồi

  // ── Metadata ──
  @Prop({ type: SchemaTypes.ObjectId, ref: 'User' })
  createdBy?: Types.ObjectId; // OPS hoặc GV tạo

  @Prop({ type: Date })
  createdAt?: Date;

  @Prop({ type: Date })
  updatedAt?: Date;

  @Prop({ type: [SessionEditHistoryEntrySchema], default: [] })
  editHistory!: SessionEditHistoryEntry[];
}

export const SessionSchema = SchemaFactory.createForClass(Session);

// ─── Indexes ────────────────────────────────────────────────────────

// Unique: 1 học sinh / 1 lớp / 1 ngày / 1 sessionNumber (cho phép nhiều buổi cùng ngày nếu khác số buổi)
SessionSchema.index(
  { classId: 1, studentId: 1, scheduledDate: 1, sessionNumber: 1 },
  { unique: true, sparse: true },
);
SessionSchema.index({ teacherId: 1, scheduledDate: 1 });
SessionSchema.index({ status: 1, scheduledDate: 1 });
SessionSchema.index({ teacherId: 1, status: 1, scheduledDate: 1 });
SessionSchema.index({ parentUserId: 1, status: 1 });
SessionSchema.index({ parentUserId: 1, studentId: 1, status: 1, scheduledDate: -1 });
SessionSchema.index({ studentId: 1, status: 1, scheduledDate: 1 });
SessionSchema.index({ classId: 1, status: 1, scheduledDate: -1 });
SessionSchema.index({ status: 1, 'confirmation.teacherCompletedAt': 1 }); // For auto-confirm cron
SessionSchema.index({ classId: 1, sessionNumber: 1 });
SessionSchema.index({ teacherId: 1, hasTeachingReport: 1, status: 1 }); // Payroll + báo cáo giảng dạy
SessionSchema.index({
  status: 1,
  isPaid: 1,
  isBonusSession: 1,
  invoiceConsumptionApplied: 1,
  'confirmation.finalizedAt': 1,
});
SessionSchema.index({ adGroupId: 1, scheduledDate: 1 }); // Analytics lợi nhuận per ad group per ngày

