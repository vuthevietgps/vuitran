import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

export type AuditLogDocument = HydratedDocument<AuditLog>;

export enum AuditAction {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  APPROVE = 'APPROVE',
  REJECT = 'REJECT',
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  LOCK = 'LOCK',
  UNLOCK = 'UNLOCK',
  STATUS_CHANGE = 'STATUS_CHANGE',
  PAYMENT = 'PAYMENT',
  EXPORT = 'EXPORT',
}

export enum AuditModule {
  USERS = 'USERS',
  STUDENTS = 'STUDENTS',
  TEACHERS = 'TEACHERS',
  CLASSES = 'CLASSES',
  SESSIONS = 'SESSIONS',
  PAYROLL = 'PAYROLL',
  WALLETS = 'WALLETS',
  INVOICES = 'INVOICES',
  TICKETS = 'TICKETS',
  PRODUCTS = 'PRODUCTS',
  ATTENDANCE = 'ATTENDANCE',
  AUTH = 'AUTH',
  TEACHING_MATERIALS = 'TEACHING_MATERIALS',
  LEADS = 'LEADS',
  ORDERS = 'ORDERS',
  ADS = 'ADS',
}

@Schema({ timestamps: true })
export class AuditLog {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'User' })
  userId?: Types.ObjectId;

  @Prop({ type: String, trim: true })
  userEmail?: string;

  @Prop({ type: String, trim: true })
  userFullName?: string;

  @Prop({ type: String, trim: true })
  userRole?: string;

  @Prop({ type: String, enum: AuditAction, required: true })
  action!: AuditAction;

  @Prop({ type: String, enum: AuditModule, required: true })
  module!: AuditModule;

  @Prop({ type: String, trim: true })
  targetId?: string;

  @Prop({ type: String, trim: true })
  targetName?: string;

  @Prop({ type: String, trim: true })
  description!: string;

  @Prop({ type: SchemaTypes.Mixed })
  oldValue?: Record<string, any>;

  @Prop({ type: SchemaTypes.Mixed })
  newValue?: Record<string, any>;

  @Prop({ type: String, trim: true })
  ipAddress?: string;

  @Prop({ type: Date })
  createdAt?: Date;
}

export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);

AuditLogSchema.index({ createdAt: -1 });
AuditLogSchema.index({ userId: 1, createdAt: -1 });
AuditLogSchema.index({ module: 1, action: 1 });
AuditLogSchema.index({ targetId: 1 });
