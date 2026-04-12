import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

export type TeacherRegistrationDocument = HydratedDocument<TeacherRegistration>;

export enum TeacherRegistrationStatus {
  NEW = 'NEW',
  INTERVIEWING = 'INTERVIEWING',
  APPROVED = 'APPROVED',
  CONVERTED = 'CONVERTED',
  REJECTED = 'REJECTED',
}

export enum TeacherRegistrationTeachingMode {
  ONLINE = 'ONLINE',
  OFFLINE = 'OFFLINE',
  BOTH = 'BOTH',
}

@Schema({ timestamps: true })
export class TeacherRegistration {
  @Prop({ required: true, unique: true, trim: true })
  applicationCode!: string;

  @Prop({ required: true, trim: true })
  fullName!: string;

  @Prop({ required: true, trim: true })
  phone!: string;

  @Prop({ trim: true, lowercase: true })
  email?: string;

  @Prop({ type: [String], default: [], trim: true })
  subjects!: string[];

  @Prop({ type: [String], default: [], trim: true })
  grades!: string[];

  @Prop({
    type: String,
    enum: Object.values(TeacherRegistrationTeachingMode),
    default: TeacherRegistrationTeachingMode.BOTH,
  })
  teachingMode!: TeacherRegistrationTeachingMode;

  @Prop({ type: [String], default: [], trim: true })
  locations!: string[];

  @Prop({ type: Number, min: 0, default: 0 })
  yearsOfExperience!: number;

  @Prop({ type: String, trim: true })
  bio?: string;

  @Prop({ type: String, trim: true })
  sourcePage?: string;

  @Prop({
    type: String,
    enum: Object.values(TeacherRegistrationStatus),
    default: TeacherRegistrationStatus.NEW,
  })
  status!: TeacherRegistrationStatus;

  @Prop({ type: String, trim: true })
  interviewNotes?: string;

  @Prop({ type: String, trim: true })
  adminNotes?: string;

  @Prop({ type: Date })
  interviewedAt?: Date;

  @Prop({ type: Date })
  decidedAt?: Date;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User' })
  convertedUserId?: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'TeacherProfile' })
  convertedTeacherProfileId?: Types.ObjectId;

  @Prop({ type: String, trim: true })
  convertedUserCode?: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User' })
  convertedBy?: Types.ObjectId;

  @Prop({ type: Date })
  convertedAt?: Date;
}

export const TeacherRegistrationSchema =
  SchemaFactory.createForClass(TeacherRegistration);

TeacherRegistrationSchema.index({ status: 1, createdAt: -1 });
TeacherRegistrationSchema.index({ phone: 1 });
TeacherRegistrationSchema.index({ email: 1 });
TeacherRegistrationSchema.index({ subjects: 1 });
