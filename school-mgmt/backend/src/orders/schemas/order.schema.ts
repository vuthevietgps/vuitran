import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
import {
  TrackingAttribution,
  TrackingAttributionSchema,
} from '../../marketing-attribution/schemas/tracking-attribution.schema';

export type OrderDocument = HydratedDocument<Order>;

export enum OrderType {
  NEW_ENROLLMENT = 'NEW_ENROLLMENT',
  RENEWAL = 'RENEWAL',
  ADDITIONAL = 'ADDITIONAL',
  PACKAGE_CHANGE = 'PACKAGE_CHANGE',
}

export enum OrderStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  NEEDS_INFO = 'NEEDS_INFO',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum PaymentPlan {
  FULL = 'FULL',
  INSTALLMENT_2 = 'INSTALLMENT_2',
  INSTALLMENT_3 = 'INSTALLMENT_3',
}

export enum LeadSource {
  FACEBOOK = 'FACEBOOK',
  GOOGLE = 'GOOGLE',
  TIKTOK = 'TIKTOK',
  ZALO = 'ZALO',
  WEBSITE = 'WEBSITE',
  REFERRAL = 'REFERRAL',
  WALK_IN = 'WALK_IN',
  OTHER = 'OTHER',
}

@Schema({ _id: false })
export class OrderItem {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Product', required: true })
  productId!: Types.ObjectId;

  @Prop({ type: String, trim: true })
  productName?: string;

  @Prop({ type: Number, min: 1, required: true })
  sessions!: number;

  @Prop({ type: Number, min: 15, default: 90 })
  sessionDuration!: number;

  @Prop({ type: Number, min: 0, required: true })
  pricePerSession!: number;

  @Prop({ type: Number, min: 0, required: true })
  amount!: number;

  @Prop({ type: String, enum: ['ONLINE', 'OFFLINE'], default: 'ONLINE' })
  teachingMode?: string;

  @Prop({ type: String, trim: true })
  preferredSchedule?: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User' })
  preferredTeacherId?: Types.ObjectId;

  @Prop({ type: String, trim: true })
  notes?: string;
}

export const OrderItemSchema = SchemaFactory.createForClass(OrderItem);

@Schema({ _id: false })
export class PaymentFrame {
  @Prop({ type: Date, required: true })
  dueDate!: Date;

  @Prop({ type: Number, min: 0, required: true })
  amount!: number;

  @Prop({ type: String, enum: ['PENDING', 'PAID'], default: 'PENDING' })
  status!: string;
}

export const PaymentFrameSchema = SchemaFactory.createForClass(PaymentFrame);

@Schema({ _id: false })
export class OrderCommunicationSummary {
  @Prop({ type: String, trim: true })
  saleMessage?: string;

  @Prop({ type: String, trim: true })
  parentMessage?: string;

  @Prop({ type: String, trim: true })
  teacherMessage?: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User' })
  parentRecipientId?: Types.ObjectId;

  @Prop({ type: [SchemaTypes.ObjectId], ref: 'User', default: [] })
  teacherRecipientIds?: Types.ObjectId[];

  @Prop({ type: Date })
  generatedAt?: Date;
}

@Schema({ _id: false })
export class ProcessedResults {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Student' })
  studentId?: Types.ObjectId;

  @Prop({ type: [SchemaTypes.ObjectId], ref: 'Invoice', default: [] })
  invoiceIds?: Types.ObjectId[];

  @Prop({ type: [SchemaTypes.ObjectId], ref: 'Classroom', default: [] })
  classIds?: Types.ObjectId[];

  @Prop({ type: SchemaTypes.Mixed })
  communicationSummary?: OrderCommunicationSummary;
}

export const ProcessedResultsSchema = SchemaFactory.createForClass(ProcessedResults);

@Schema({ timestamps: true })
export class Order {
  @Prop({ required: true, trim: true, unique: true })
  orderCode!: string;

  @Prop({ type: String, enum: Object.values(OrderType), required: true })
  orderType!: string;

  @Prop({ type: String, enum: Object.values(OrderStatus), default: OrderStatus.DRAFT })
  status!: string;

  // Customer info
  @Prop({ required: true, trim: true })
  parentName!: string;

  @Prop({ required: true, trim: true })
  parentPhone!: string;

  @Prop({ type: String, trim: true })
  parentEmail?: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User' })
  parentUserId?: Types.ObjectId;

  // Student info
  @Prop({ required: true, trim: true })
  studentName!: string;

  @Prop({ type: Date })
  studentDob?: Date;

  @Prop({ type: String, trim: true })
  studentGrade?: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Student' })
  existingStudentId?: Types.ObjectId;

  // Items
  @Prop({ type: [OrderItemSchema], required: true })
  items!: OrderItem[];

  // Pricing
  @Prop({ type: Number, min: 0, required: true })
  totalAmount!: number;

  @Prop({ type: Number, min: 0, default: 0 })
  discountAmount?: number;

  @Prop({ type: String, trim: true })
  discountReason?: string;

  @Prop({ type: Number, min: 0, required: true })
  finalAmount!: number;

  // Payment plan
  @Prop({ type: String, enum: Object.values(PaymentPlan), default: PaymentPlan.FULL })
  paymentPlan?: string;

  @Prop({ type: [PaymentFrameSchema], default: [] })
  paymentFrames?: PaymentFrame[];

  // Sale info
  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true })
  saleId!: Types.ObjectId;

  @Prop({ type: String, trim: true })
  saleName?: string;

  @Prop({ type: Number, min: 0, default: 0 })
  saleCommission?: number;

  @Prop({ type: String, enum: Object.values(LeadSource) })
  leadSource?: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Lead' })
  leadId?: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'AdGroup' })
  adGroupId?: Types.ObjectId;

  @Prop({ type: String, trim: true })
  adGroupName?: string;

  @Prop({ type: String, trim: true })
  consultationNotes?: string;

  @Prop({ type: TrackingAttributionSchema })
  tracking?: TrackingAttribution;

  // Processing
  @Prop({ type: ProcessedResultsSchema })
  processedResults?: ProcessedResults;

  // Approval
  @Prop({ type: SchemaTypes.ObjectId, ref: 'User' })
  approvedBy?: Types.ObjectId;

  @Prop({ type: Date })
  approvedAt?: Date;

  @Prop({ type: String, trim: true })
  rejectionReason?: string;

  @Prop({ type: String, trim: true })
  needsInfoReason?: string;
}

export const OrderSchema = SchemaFactory.createForClass(Order);
OrderSchema.index({ status: 1, createdAt: -1 });
OrderSchema.index({ saleId: 1 });
OrderSchema.index({ leadId: 1 });
OrderSchema.index({ parentPhone: 1 });
OrderSchema.index({ adGroupId: 1 });

