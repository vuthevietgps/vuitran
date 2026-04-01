import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type SupplierQuoteDocument = HydratedDocument<SupplierQuote>;

export enum QuoteStatus {
  DRAFT = 'DRAFT',
  SENT = 'SENT',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED',
}

@Schema({ timestamps: true })
export class SupplierQuote {
  @Prop({ unique: true, trim: true })
  quoteCode!: string;

  @Prop({ required: true, trim: true })
  supplierName!: string;

  @Prop({ type: String, trim: true })
  supplierPhone?: string;

  @Prop({ type: String, trim: true })
  supplierEmail?: string;

  @Prop({ type: String, trim: true })
  supplierAddress?: string;

  @Prop({ required: true, trim: true })
  title!: string;

  @Prop({ type: String, trim: true })
  description?: string;

  @Prop({
    type: [
      {
        itemName: String,
        quantity: Number,
        unit: String,
        unitPrice: Number,
        totalPrice: Number,
        notes: String,
      },
    ],
    default: [],
  })
  items!: {
    itemName: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    totalPrice: number;
    notes?: string;
  }[];

  @Prop({ default: 0 })
  totalAmount!: number;

  @Prop({ type: String, enum: Object.values(QuoteStatus), default: QuoteStatus.DRAFT })
  status!: string;

  @Prop({ type: Date })
  quoteDate?: Date;

  @Prop({ type: Date })
  validUntil?: Date;

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

  @Prop({ type: String, trim: true })
  rejectionReason?: string;

  @Prop({ type: String, trim: true })
  notes?: string;
}

export const SupplierQuoteSchema = SchemaFactory.createForClass(SupplierQuote);
SupplierQuoteSchema.index({ quoteDate: -1 });
SupplierQuoteSchema.index({ status: 1 });
SupplierQuoteSchema.index({ supplierName: 1 });
SupplierQuoteSchema.index({ createdById: 1 });
