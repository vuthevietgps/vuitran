import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

export type ExpenseDocument = HydratedDocument<Expense>;

export enum ExpenseCategory {
  RENT = 'RENT',                      // Tiền thuê mặt bằng
  UTILITIES = 'UTILITIES',            // Điện, nước, internet
  SUPPLIES = 'SUPPLIES',              // Văn phòng phẩm, thiết bị
  MARKETING = 'MARKETING',            // Quảng cáo, marketing
  MAINTENANCE = 'MAINTENANCE',        // Sửa chữa, bảo trì
  SALARY_BONUS = 'SALARY_BONUS',      // Thưởng, phụ cấp
  TRAINING = 'TRAINING',              // Đào tạo
  TRANSPORT = 'TRANSPORT',            // Đi lại, xăng xe
  MEAL = 'MEAL',                      // Ăn uống
  ENTERTAINMENT = 'ENTERTAINMENT',    // Tiếp khách
  OTHER = 'OTHER',                    // Khác
}

export enum PaymentStatus {
  PENDING_APPROVAL = 'PENDING_APPROVAL',  // Chờ duyệt
  APPROVED_UNPAID = 'APPROVED_UNPAID',    // Đã duyệt, chưa chi
  PAID = 'PAID',                          // Đã chi
  REJECTED = 'REJECTED',                  // Từ chối
}

export enum PaymentMethod {
  CASH = 'CASH',
  BANK_TRANSFER = 'BANK_TRANSFER',
  CREDIT_CARD = 'CREDIT_CARD',
  E_WALLET = 'E_WALLET',
  OTHER = 'OTHER',
}

export enum ExpenseAllocationScope {
  GLOBAL = 'GLOBAL',
  AD_GROUP = 'AD_GROUP',
  PARENT = 'PARENT',
}

export enum RecurringFrequency {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
  YEARLY = 'YEARLY',
}

@Schema({ timestamps: true })
export class Expense {
  @Prop({ required: true, trim: true, unique: true })
  expenseCode!: string;

  @Prop({ required: true, trim: true })
  title!: string;

  @Prop({ type: String, trim: true })
  description?: string;

  @Prop({ required: true, min: 0 })
  amount!: number;

  @Prop({ type: Date, required: true })
  expenseDate!: Date;

  @Prop({ type: String, enum: Object.values(ExpenseCategory), default: ExpenseCategory.OTHER })
  category!: string;

  @Prop({ type: String, enum: Object.values(PaymentStatus), default: PaymentStatus.PENDING_APPROVAL })
  paymentStatus!: string;

  @Prop({ type: String, enum: Object.values(ExpenseAllocationScope), default: ExpenseAllocationScope.GLOBAL })
  allocationScope!: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'AdGroup' })
  adGroupId?: Types.ObjectId;

  @Prop({ type: String, trim: true })
  adGroupName?: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User' })
  parentUserId?: Types.ObjectId;

  @Prop({ type: String, trim: true })
  parentPhone?: string;

  @Prop({ type: String, trim: true })
  normalizedParentPhone?: string;

  // Người tạo phiếu chi
  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true })
  createdById!: Types.ObjectId;

  @Prop({ type: String, required: true })
  createdByName!: string;

  // Người duyệt
  @Prop({ type: SchemaTypes.ObjectId, ref: 'User' })
  approvedById?: Types.ObjectId;

  @Prop({ type: String })
  approvedByName?: string;

  @Prop({ type: Date })
  approvedAt?: Date;

  @Prop({ type: String, trim: true })
  rejectionReason?: string;

  // Người chi tiền
  @Prop({ type: SchemaTypes.ObjectId, ref: 'User' })
  paidById?: Types.ObjectId;

  @Prop({ type: String })
  paidByName?: string;

  @Prop({ type: Date })
  paidAt?: Date;

  @Prop({ type: String, enum: Object.values(PaymentMethod) })
  paymentMethod?: string;

  @Prop({ type: String, trim: true })
  receiptUrl?: string;

  @Prop({ type: [String], default: [] })
  receiptUrls?: string[];

  @Prop({ type: String, trim: true })
  notes?: string;

  // ─── Recurring expense fields ────────────────────────
  @Prop({ type: Boolean, default: false })
  isRecurring?: boolean;

  @Prop({ type: String, enum: RecurringFrequency })
  recurringFrequency?: string;

  @Prop({ type: Date })
  recurringStartDate?: Date;

  @Prop({ type: Date })
  recurringEndDate?: Date;

  @Prop({ type: Date })
  nextOccurrence?: Date;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Expense' })
  parentExpenseId?: Types.ObjectId;

  @Prop({ type: Boolean, default: true })
  recurringActive?: boolean;
}

export const ExpenseSchema = SchemaFactory.createForClass(Expense);
ExpenseSchema.index({ expenseDate: -1 });
ExpenseSchema.index({ paymentStatus: 1 });
ExpenseSchema.index({ category: 1 });
ExpenseSchema.index({ createdById: 1 });
ExpenseSchema.index({ createdAt: -1 });
ExpenseSchema.index({ allocationScope: 1, expenseDate: -1 });
ExpenseSchema.index({ adGroupId: 1, expenseDate: -1 });
ExpenseSchema.index({ parentUserId: 1, expenseDate: -1 });
ExpenseSchema.index({ normalizedParentPhone: 1, expenseDate: -1 });
ExpenseSchema.index({ isRecurring: 1, recurringActive: 1, nextOccurrence: 1 });
ExpenseSchema.index({ parentExpenseId: 1 });

