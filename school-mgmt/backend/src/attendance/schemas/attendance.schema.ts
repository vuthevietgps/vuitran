import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
import { User } from '../../users/schemas/user.schema';
import { Student } from '../../students/schemas/student.schema';
import { Classroom } from '../../classes/schemas/class.schema';

export type AttendanceDocument = HydratedDocument<Attendance>;

export enum AttendanceStatus {
  PRESENT = 'PRESENT',
  ABSENT = 'ABSENT',
  LATE = 'LATE',
  EXCUSED = 'EXCUSED',
}

export const COUNTED_ATTENDANCE_STATUSES: readonly AttendanceStatus[] = [
  AttendanceStatus.PRESENT,
  AttendanceStatus.LATE,
];

@Schema({ timestamps: true })
export class Attendance {
  @Prop({ type: SchemaTypes.ObjectId, ref: Classroom.name, required: true })
  classId!: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: Student.name, required: true })
  studentId!: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: User.name, required: true })
  teacherId!: Types.ObjectId;

  @Prop({ type: Date, required: true })
  date!: Date;

  @Prop({ type: String, enum: Object.values(AttendanceStatus), required: false })
  status?: AttendanceStatus;

  @Prop({ type: String, trim: true })
  notes?: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Session' })
  sessionId?: Types.ObjectId;

  @Prop({ type: Number, min: 0 })
  sessionDuration?: number;

  @Prop({ type: Number, min: 0 })
  sessionIndex?: number;

  @Prop({ type: String, enum: ['PENDING', 'OK', 'ISSUE'] })
  parentConfirm?: string;

  // Compatibility fields still used by payroll qualification and ops approval flows.
  @Prop({ type: SchemaTypes.ObjectId, ref: User.name })
  checkedBy?: Types.ObjectId;

  @Prop({ type: Date })
  checkedAt?: Date;

  @Prop({ type: String })
  imageUrl?: string;

  @Prop({ type: String, trim: true })
  imageFileKey?: string;

  @Prop({ type: String, unique: true, sparse: true })
  attendanceToken?: string;

  @Prop({ type: Date })
  tokenExpiresAt?: Date;

  @Prop({ type: Date })
  attendedAt?: Date;
}

export const AttendanceSchema = SchemaFactory.createForClass(Attendance);

AttendanceSchema.index({ classId: 1, studentId: 1, date: 1 }, { unique: true });
AttendanceSchema.index({ sessionId: 1 }, { sparse: true });
AttendanceSchema.index({ date: 1, status: 1 });
AttendanceSchema.index({ classId: 1, date: 1 });
AttendanceSchema.index({ studentId: 1, date: -1 });
AttendanceSchema.index({ teacherId: 1, date: -1 });
