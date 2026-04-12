import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
import { Role } from '../../common/interfaces/role.enum';
import { UserStatus } from '../../common/interfaces/user-status.enum';

export type UserDocument = HydratedDocument<User>;

@Schema({ timestamps: true })
export class User {
  @Prop({ type: String, trim: true, uppercase: true, sparse: true, unique: true })
  userCode?: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email!: string;

  @Prop({ required: true })
  password!: string;

  @Prop({ required: true, trim: true })
  fullName!: string;

  @Prop({ type: String, enum: Object.values(Role), required: true })
  role!: Role;

  @Prop({ type: String, enum: Object.values(UserStatus), default: UserStatus.ACTIVE })
  status!: UserStatus;

  @Prop({ type: Number, default: 0 })
  failedLoginAttempts!: number;

  @Prop({ type: Date })
  lastFailedLoginAt?: Date;

  @Prop({ type: String, trim: true })
  phone?: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: false })
  saleOwnerId?: Types.ObjectId;

  @Prop({ type: String, trim: true })
  saleOwnerName?: string;

  @Prop({ type: String, trim: true })
  facebookLink?: string;

  @Prop({ type: String, trim: true })
  address?: string;

  @Prop({ type: Number, min: 0, max: 100 })
  ownershipPercentage?: number;

  @Prop({ type: Boolean, default: false })
  enableEmailNotif?: boolean;

  @Prop({ type: Boolean, default: false })
  enableZaloNotif?: boolean;

  @Prop({ type: Boolean, default: false })
  enableSmsNotif?: boolean;
}

export const UserSchema = SchemaFactory.createForClass(User);

// Indexes for frequently queried fields
UserSchema.index({ role: 1 });
UserSchema.index({ role: 1, saleOwnerId: 1 });

