import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type SupplierPaymentDocument = HydratedDocument<SupplierPayment>;

export enum SupplierPaymentStatus {
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  APPROVED = 'APPROVED',
  PAID = 'PAID',
  REJECTED = 'REJECTED',
}

export enum SupplierPaymentMethod {
  CASH = 'CASH',
  BANK_TRANSFER = 'BANK_TRANSFER',
  E_WALLET = 'E_WALLET',
  OTHER = 'OTHER',
}

@Schema({ timestamps: true })
export class SupplierPayment {
  @Prop({ unique: true, trim: true })
  paymentCode!: string;

  @Prop({ required: true, trim: true })
  supplierName!: string;

  @Prop({ type: String, trim: true })
  supplierPhone?: string;

  @Prop({ type: String, trim: true })
  supplierEmail?: string;

  @Prop({ type: String, trim: true })
  supplierBankAccount?: string;

  @Prop({ type: String, trim: true })
  supplierBankName?: string;

  @Prop({ required: true, trim: true })
  title!: string;

  @Prop({ type: String, trim: true })
  description?: string;

  @Prop({ required: true, min: 0 })
  amount!: number;

  @Prop({ type: Date })
  paymentDate?: Date;

  @Prop({ type: String, enum: Object.values(SupplierPaymentStatus), default: SupplierPaymentStatus.PENDING_APPROVAL })
  status!: string;

  @Prop({ type: String, enum: Object.values(SupplierPaymentMethod) })
  paymentMethod?: string;

  @Prop({ type: Types.ObjectId, ref: 'SupplierQuote' })
  supplierQuoteId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  createdById?: Types.ObjectId;

  @Prop({ type: String, trim: true })
  createdByName?: string;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  approvedById?: Types.ObjectId;

  @Prop({ type: String, trim: true })
  approvedByName?: string;

  @Prop({ type: Date })
  approvedAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  paidById?: Types.ObjectId;

  @Prop({ type: String, trim: true })
  paidByName?: string;

  @Prop({ type: Date })
  paidAt?: Date;

  @Prop({ type: String, trim: true })
  rejectionReason?: string;

  @Prop({ type: String })
  receiptUrl?: string;

  @Prop({ type: [String], default: [] })
  receiptUrls?: string[];

  @Prop({ type: String, trim: true })
  notes?: string;
}

export const SupplierPaymentSchema = SchemaFactory.createForClass(SupplierPayment);
SupplierPaymentSchema.index({ paymentDate: -1 });
SupplierPaymentSchema.index({ status: 1 });
SupplierPaymentSchema.index({ supplierName: 1 });
SupplierPaymentSchema.index({ createdById: 1 });
