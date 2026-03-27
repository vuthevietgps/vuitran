import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel, InjectConnection } from '@nestjs/mongoose';
import { Model, Types, Connection, ClientSession } from 'mongoose';
import {
  Attendance,
  AttendanceDocument,
  AttendanceStatus,
  COUNTED_ATTENDANCE_STATUSES,
} from './schemas/attendance.schema';
import { CreateAttendanceDto, BulkAttendanceDto } from './dto/create-attendance.dto';
import { UpdateAttendanceDto } from './dto/update-attendance.dto';
import { GenerateAttendanceLinkDto, StudentAttendanceDto } from './dto/generate-link.dto';
import { UserDocument } from '../users/schemas/user.schema';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { Classroom, ClassDocument, ClassMode } from '../classes/schemas/class.schema';
import { Student, StudentDocument } from '../students/schemas/student.schema';
import { Session, SessionDocument, SessionStatus, SessionType } from '../sessions/schemas/session.schema';
import { Invoice, InvoiceDocument } from '../invoices/schemas/invoice.schema';
import {
  TrialEnrollment,
  TrialEnrollmentDocument,
  TrialEnrollmentStatus,
} from '../trial-enrollments/schemas/trial-enrollment.schema';
import { Role } from '../common/interfaces/role.enum';
import { ClassesService } from '../classes/classes.service';
import { randomBytes } from 'crypto';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import {
  getCurrentDurationForStudent,
  getCurrentTeacherIdForStudent,
  getTeacherOwnedStudentIds,
} from '../classes/student-config.utils';
import { validateAndProcessBase64Image } from '../common/utils/image-validation.utils';
import { normalizeDate, dayRange, buildDateFilter } from '../common/utils/date.utils';

type StudentLean = Student & {
  _id: Types.ObjectId;
  isTrial?: boolean;
  trialEnrollmentId?: Types.ObjectId;
};
type ClassLean = Classroom & { _id: Types.ObjectId };
const OFFLINE_MIN_TEACHER_PAYOUT = 200_000;

@Injectable()
export class AttendanceService {
  private readonly logger = new Logger(AttendanceService.name);

  constructor(
    @InjectModel(Attendance.name) private readonly attendanceModel: Model<AttendanceDocument>,
    @InjectModel(Classroom.name) private readonly classModel: Model<ClassDocument>,
    @InjectModel(Student.name) private readonly studentModel: Model<StudentDocument>,
    @InjectModel(Session.name) private readonly sessionModel: Model<SessionDocument>,
    @InjectModel(Invoice.name) private readonly invoiceModel: Model<InvoiceDocument>,
    @InjectModel(TrialEnrollment.name)
    private readonly trialEnrollmentModel: Model<TrialEnrollmentDocument>,
    @InjectConnection() private readonly connection: Connection,
    private readonly classesService: ClassesService,
  ) {}

  // ÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚Â
  // PRIVATE HELPERS
  // ÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚Â

  private getUserId(user: JwtPayload): string {
    return user?.sub ?? user?._id;
  }

  private isCountedAttendanceStatus(status?: AttendanceStatus | null): boolean {
    return !!status && COUNTED_ATTENDANCE_STATUSES.includes(status);
  }

  private normalizeInteractiveAttendanceStatus(
    status?: AttendanceStatus | null,
  ): AttendanceStatus | null {
    if (status === undefined) {
      return AttendanceStatus.PRESENT;
    }
    return status ?? null;
  }

  private normalizeBulkAttendanceStatus(
    status?: AttendanceStatus | null,
  ): AttendanceStatus | null {
    return status ?? null;
  }

  private async loadTrialStudentsForClass(classId: Types.ObjectId): Promise<StudentLean[]> {
    const enrollments = await this.trialEnrollmentModel
      .find({
        classId,
        status: {
          $in: [TrialEnrollmentStatus.PENDING_TRIAL, TrialEnrollmentStatus.WAITING_DECISION],
        },
        studentId: { $exists: true, $ne: null },
      })
      .populate('studentId', 'fullName age parentName studentCode faceImage parentPhone')
      .lean();

    return enrollments
      .map((enrollment: any) => {
        const student = enrollment.studentId;
        if (!student?._id) return null;
        return {
          ...student,
          _id: student._id,
          isTrial: true,
          trialEnrollmentId: enrollment._id,
        } as StudentLean;
      })
      .filter((student): student is StudentLean => !!student);
  }

  private async findActiveTrialEnrollment(
    classId: Types.ObjectId,
    studentId: Types.ObjectId,
    mongoSession?: ClientSession,
  ) {
    let query = this.trialEnrollmentModel.findOne({
      classId,
      studentId,
      status: {
        $in: [TrialEnrollmentStatus.PENDING_TRIAL, TrialEnrollmentStatus.WAITING_DECISION],
      },
    });
    if (mongoSession) {
      query = query.session(mongoSession);
    }
    return query.sort({ createdAt: -1 }).lean();
  }

  private async isStudentAllowedInClass(
    classroom: ClassLean,
    studentId: string,
    mongoSession?: ClientSession,
  ): Promise<boolean> {
    const inRoster = classroom.students?.some((s: any) => s.toString() === studentId);
    if (inRoster) return true;
    if (!Types.ObjectId.isValid(studentId)) return false;
    const activeTrial = await this.findActiveTrialEnrollment(
      classroom._id as Types.ObjectId,
      new Types.ObjectId(studentId),
      mongoSession,
    );
    return !!activeTrial;
  }

  private async syncTrialUsage(classId: Types.ObjectId, studentId: Types.ObjectId): Promise<void> {
    const enrollment = await this.trialEnrollmentModel
      .findOne({
        classId,
        studentId,
        status: {
          $in: [
            TrialEnrollmentStatus.PENDING_TRIAL,
            TrialEnrollmentStatus.WAITING_DECISION,
            TrialEnrollmentStatus.CONVERTED,
          ],
        },
      })
      .sort({ createdAt: -1 });

    if (!enrollment) return;

    const used = await this.sessionModel.countDocuments({
      classId,
      studentId,
      sessionType: SessionType.TRIAL,
      status: { $nin: [SessionStatus.CANCELLED, SessionStatus.RESCHEDULED] },
      trialEnrollmentId: enrollment._id,
    });

    let nextStatus = enrollment.status;
    if (
      nextStatus === TrialEnrollmentStatus.PENDING_TRIAL &&
      used >= (enrollment.maxTrialSessions || 2)
    ) {
      nextStatus = TrialEnrollmentStatus.WAITING_DECISION;
    }

    if (used !== enrollment.trialSessionsUsed || nextStatus !== enrollment.status) {
      enrollment.trialSessionsUsed = used;
      enrollment.status = nextStatus as any;
      await enrollment.save();
    }
  }

  /**
   * TÃƒÆ’Ã‚Â­nh amountCharged cho 1 buÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¢i hÃƒÂ¡Ã‚Â»Ã‚Âc dÃƒÂ¡Ã‚Â»Ã‚Â±a trÃƒÆ’Ã‚Âªn per-minute rate tÃƒÂ¡Ã‚Â»Ã‚Â« Invoice.
   * Fallback sang class-level pricing nÃƒÂ¡Ã‚ÂºÃ‚Â¿u khÃƒÆ’Ã‚Â´ng cÃƒÆ’Ã‚Â³ invoice.
   *
   * VD: Invoice 3,800,000 / 20 buÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¢i / 70 phÃƒÆ’Ã‚Âºt ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ perMinuteRate = 2,714.29
   *   ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ buÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¢i 90 phÃƒÆ’Ã‚Âºt: 2,714.29 ÃƒÆ’Ã¢â‚¬â€ 90 = 244,286 Ãƒâ€žÃ¢â‚¬Ëœ
   */
  private async resolveAmountCharged(
    studentId: Types.ObjectId,
    classId: Types.ObjectId,
    durationMinutes: number,
    classroom: ClassLean,
  ): Promise<number> {
    const snapshot = (classroom as any)?.pricingSnapshot || {};
    const snapshotPerMinuteRate = Number(snapshot.perMinuteRate ?? 0);
    if (snapshotPerMinuteRate > 0) {
      return Math.round(snapshotPerMinuteRate * durationMinutes);
    }

    const snapshotBaseDuration = Number(
      snapshot.referenceDuration ??
        (classroom as any).baseDuration ??
        (classroom as any).sessionDuration ??
        60,
    );
    const snapshotPricePerSession = Number(
      snapshot.pricePerSession ?? (classroom as any).pricePerSession ?? 0,
    );
    if (snapshotBaseDuration > 0 && snapshotPricePerSession > 0) {
      const ratio = durationMinutes / snapshotBaseDuration;
      return Math.round(snapshotPricePerSession * ratio);
    }

    // Legacy fallback: latest approved invoice with perMinuteRate
    const invoice = await this.invoiceModel
      .findOne({
        studentId,
        classId,
        status: 'APPROVED',
        perMinuteRate: { $gt: 0 },
      })
      .sort('-createdAt')
      .select('perMinuteRate referenceDuration pricePerSession')
      .lean();

    if (invoice?.perMinuteRate) {
      return Math.round(invoice.perMinuteRate * durationMinutes);
    }

    // Final fallback: class-level pricing
    const baseDuration =
      (classroom as any).baseDuration ?? (classroom as any).sessionDuration ?? 60;
    const pricePerSession = (classroom as any).pricePerSession ?? 0;
    const ratio = durationMinutes / baseDuration;
    return Math.round(pricePerSession * ratio);
  }
  private isTeacher(user: JwtPayload): boolean {
    return user?.role === Role.TEACHER;
  }

  private hasFullAccess(user: JwtPayload): boolean {
    return [Role.DIRECTOR, Role.OPS].includes(user?.role as Role);
  }

  private getOpsCheckerId(user: JwtPayload): Types.ObjectId | null {
    if (![Role.DIRECTOR, Role.OPS].includes(user?.role as Role)) {
      return null;
    }
    return new Types.ObjectId(this.getUserId(user));
  }

  private getVisibleStudentIdsForTeacher(
    classroom: ClassLean,
    teacherId: string,
    fallbackToAllForSubstitute = false,
  ): Set<string> {
    const ownedStudentIds = getTeacherOwnedStudentIds(classroom, teacherId);
    if (ownedStudentIds.length > 0) {
      return new Set(ownedStudentIds);
    }

    if (fallbackToAllForSubstitute) {
      const isSubstituteTeacher = Array.isArray((classroom as any)?.substituteTeachers)
        && (classroom as any).substituteTeachers.some(
          (item: any) => item?.teacherId?.toString?.() === teacherId,
        );
      if (isSubstituteTeacher) {
        const allStudentIds = Array.isArray(classroom?.students)
          ? classroom.students
              .map((student: any) => student?._id?.toString?.() || student?.toString?.())
              .filter((studentId: string | undefined): studentId is string => !!studentId)
          : [];
        return new Set(allStudentIds);
      }
    }

    return new Set<string>();
  }

  private assertClassAccess(
    classroom: ClassLean | null,
    user: JwtPayload,
    date?: Date,
  ): asserts classroom is ClassLean {
    if (!classroom) throw new NotFoundException('Khong tim thay lop hoc');
    if (this.hasFullAccess(user)) return;
    if (this.isTeacher(user)) {
      const uid = this.getUserId(user);
      const tid = classroom.teacher?.toString();
      if (tid && tid === uid) return;

      if (date) {
        const subs = (classroom as any).substituteTeachers || [];
        const d = new Date(
          Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
        );
        const activeSub = subs.find((s: any) => {
          if (s.teacherId?.toString() !== uid) return false;
          const from = new Date(s.fromDate);
          from.setUTCHours(0, 0, 0, 0);
          const to = new Date(s.toDate);
          to.setUTCHours(23, 59, 59, 999);
          return d >= from && d <= to;
        });
        if (activeSub) return;
      }

      if (this.getVisibleStudentIdsForTeacher(classroom, uid).size > 0) return;

      throw new ForbiddenException(
        'Ban khong phu trach lop hoc nay va khong co quyen day thay cho ngay nay',
      );
    }

    throw new ForbiddenException('Ban khong co quyen truy cap lop hoc nay');
  }
  /**
   * LÃƒÂ¡Ã‚ÂºÃ‚Â¥y thÃƒÆ’Ã‚Â´ng tin GV dÃƒÂ¡Ã‚ÂºÃ‚Â¡y thay Ãƒâ€žÃ¢â‚¬Ëœang active cho lÃƒÂ¡Ã‚Â»Ã¢â‚¬Âºp tÃƒÂ¡Ã‚ÂºÃ‚Â¡i ngÃƒÆ’Ã‚Â y cÃƒÂ¡Ã‚Â»Ã‚Â¥ thÃƒÂ¡Ã‚Â»Ã†â€™.
   * TrÃƒÂ¡Ã‚ÂºÃ‚Â£ vÃƒÂ¡Ã‚Â»Ã‚Â null nÃƒÂ¡Ã‚ÂºÃ‚Â¿u ngÃƒâ€ Ã‚Â°ÃƒÂ¡Ã‚Â»Ã‚Âi dÃƒÆ’Ã‚Â¹ng lÃƒÆ’Ã‚Â  GV chÃƒÆ’Ã‚Â­nh hoÃƒÂ¡Ã‚ÂºÃ‚Â·c khÃƒÆ’Ã‚Â´ng phÃƒÂ¡Ã‚ÂºÃ‚Â£i TEACHER.
   */
  private getSubstituteInfo(
    classroom: ClassLean,
    user: JwtPayload,
    date: Date,
  ): { teacherId: string; payRate: number; canCreateLink: boolean } | null {
    if (!this.isTeacher(user)) return null;
    const uid = this.getUserId(user);
    // NÃƒÂ¡Ã‚ÂºÃ‚Â¿u lÃƒÆ’Ã‚Â  GV chÃƒÆ’Ã‚Â­nh ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ khÃƒÆ’Ã‚Â´ng phÃƒÂ¡Ã‚ÂºÃ‚Â£i substitute
    if (classroom.teacher?.toString() === uid) return null;

    const subs = (classroom as any).substituteTeachers || [];
    const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const active = subs.find((s: any) => {
      if (s.teacherId?.toString() !== uid) return false;
      const from = new Date(s.fromDate); from.setUTCHours(0, 0, 0, 0);
      const to = new Date(s.toDate); to.setUTCHours(23, 59, 59, 999);
      return d >= from && d <= to;
    });

    if (!active) return null;
    return {
      teacherId: uid,
      payRate: active.payRate ?? 0,
      canCreateLink: active.canCreateLink ?? true,
    };
  }

  // ÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚Â
  private resolveAttendanceTeacherId(
    classroom: ClassLean,
    user: JwtPayload,
    date: Date,
    studentId: string,
  ): Types.ObjectId {
    const assignedTeacherId = getCurrentTeacherIdForStudent(classroom, studentId);

    if (this.isTeacher(user)) {
      const actorTeacherId = this.getUserId(user);
      const activeSubstitute = this.getSubstituteInfo(classroom, user, date);
      if (activeSubstitute) {
        return new Types.ObjectId(actorTeacherId);
      }
      if (assignedTeacherId && assignedTeacherId !== actorTeacherId) {
        throw new ForbiddenException('Ban khong phu trach hoc sinh nay trong lop hoc');
      }
      return new Types.ObjectId(actorTeacherId);
    }

    if (!assignedTeacherId) {
      throw new BadRequestException('Lop hoc chua co giao vien phu trach');
    }

    return new Types.ObjectId(assignedTeacherId);
  }

  /**
   * Recompute OFFLINE teacher payout for one class/day.
   *
   * Rule:
   * - totalTeacherPayout = max(200_000, teacherPayPerStudent * attendedCount)
   * - attendedCount = ALL students with PRESENT/LATE + linked session (kể cả FINALIZED)
   * - Only distribute payout to sessions NOT yet finalized/cancelled/rescheduled
   * - Sessions đã FINALIZED giữ nguyên payout (bù trừ từ remaining)
   *
   * Fix race condition: trước đây chỉ đếm sessions chưa FINALIZED → attendedCount sai
   * khi một số sessions finalize trước khi điểm danh hết. Giờ đếm TẤT CẢ attended sessions,
   * chỉ update những sessions chưa lock (non-FINALIZED).
   */
  private async recomputeOfflineTeacherPayoutForDay(params: {
    classId: string | Types.ObjectId;
    date: Date;
    classroom: ClassLean;
  }): Promise<{
    attendedCount: number;
    perStudentTeacherPay: number;
    totalTeacherPayout: number;
    minimumApplied: boolean;
  }> {
    const { date, classroom } = params;
    if ((classroom as any).classMode !== ClassMode.OFFLINE) {
      return {
        attendedCount: 0,
        perStudentTeacherPay: 0,
        totalTeacherPayout: 0,
        minimumApplied: false,
      };
    }

    const classObjectId =
      typeof params.classId === 'string'
        ? new Types.ObjectId(params.classId)
        : params.classId;

    // Only students who actually attended are counted.
    const attendanceRows = await this.attendanceModel
      .find({
        classId: classObjectId,
        date,
        status: { $in: [...COUNTED_ATTENDANCE_STATUSES] },
        sessionId: { $exists: true, $ne: null },
      })
      .select('sessionId')
      .lean();

    const uniqueSessionIds = Array.from(
      new Set(
        attendanceRows
          .map((row: any) => row.sessionId?.toString())
          .filter((id: string | undefined): id is string => !!id),
      ),
    );

    const perStudentTeacherPay = Number((classroom as any).teacherPayPerStudent ?? 0);

    if (uniqueSessionIds.length === 0) {
      return {
        attendedCount: 0,
        perStudentTeacherPay,
        totalTeacherPayout: 0,
        minimumApplied: false,
      };
    }

    // Lấy TẤT CẢ sessions (kể cả FINALIZED) để tính đúng totalAttendedCount.
    // CANCELLED/RESCHEDULED bị loại vì học sinh đó thực sự không có mặt.
    const allAttendedSessions = await this.sessionModel
      .find({
        _id: { $in: uniqueSessionIds.map((id) => new Types.ObjectId(id)) },
        classId: classObjectId,
        scheduledDate: dayRange(date),
        status: { $nin: ['CANCELLED', 'RESCHEDULED'] },
      })
      .select('_id status teacherPayout')
      .sort({ _id: 1 })
      .lean();

    const totalAttendedCount = allAttendedSessions.length;
    if (totalAttendedCount === 0) {
      return {
        attendedCount: 0,
        perStudentTeacherPay,
        totalTeacherPayout: 0,
        minimumApplied: false,
      };
    }

    const computedTotal = Math.round(perStudentTeacherPay * totalAttendedCount);
    const totalTeacherPayout = Math.max(OFFLINE_MIN_TEACHER_PAYOUT, computedTotal);
    const minimumApplied = totalTeacherPayout > computedTotal;

    // Tách sessions đã FINALIZED (không thể update) và chưa FINALIZED (có thể update).
    const finalizedSessions = allAttendedSessions.filter(
      (s: any) => s.status === 'FINALIZED',
    );
    const updatableSessions = allAttendedSessions.filter(
      (s: any) => s.status !== 'FINALIZED',
    );

    // Tổng payout đã bị lock trong FINALIZED sessions
    const finalizedTotal = finalizedSessions.reduce(
      (acc: number, s: any) => acc + (Number(s.teacherPayout) || 0),
      0,
    );

    // Phần còn lại để phân bổ cho các sessions chưa finalize
    const remainingPayout = Math.max(0, totalTeacherPayout - finalizedTotal);

    if (updatableSessions.length > 0 && remainingPayout > 0) {
      // Spread remainingPayout across updatable sessions
      const basePerSession = Math.floor(remainingPayout / updatableSessions.length);
      let remainder = remainingPayout - basePerSession * updatableSessions.length;

      const updates = updatableSessions.map((session: any) => {
        const payout = basePerSession + (remainder > 0 ? 1 : 0);
        if (remainder > 0) remainder--;
        return {
          updateOne: {
            filter: { _id: session._id },
            update: { $set: { teacherPayout: payout } },
          },
        };
      });

      await this.sessionModel.bulkWrite(updates);
    } else if (updatableSessions.length > 0 && remainingPayout === 0) {
      // Tất cả payout đã bị lock bởi FINALIZED sessions → set updatable sessions về 0
      const updates = updatableSessions.map((session: any) => ({
        updateOne: {
          filter: { _id: session._id },
          update: { $set: { teacherPayout: 0 } },
        },
      }));
      await this.sessionModel.bulkWrite(updates);
    }

    return {
      attendedCount: totalAttendedCount,
      perStudentTeacherPay,
      totalTeacherPayout,
      minimumApplied,
    };
  }
  // ENSURE REAL DOCUMENTS (Class / Student)
  // ÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚Â

  /** Find or create Classroom from classCode */
  private async ensureClassForCode(classCode: string, user: JwtPayload): Promise<ClassLean> {
    const code = classCode.trim().toUpperCase();
    const existing = await this.classModel.findOne({ code }).lean<ClassLean>();
    if (existing) return existing;

    const teacherId = this.isTeacher(user)
      ? new Types.ObjectId(this.getUserId(user))
      : new Types.ObjectId();

    const doc = await this.classModel.create({
      name: `LÃƒÂ¡Ã‚Â»Ã¢â‚¬Âºp ${code}`,
      code,
      teacher: teacherId,
      students: [],
    });
    return doc.toObject() as ClassLean;
  }

  // ÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚Â
  // SESSION BRIDGE ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â Attendance <-> Session (for payroll + wallet)
  //
  // Ãƒâ€žÃ‚ÂÃƒÆ’Ã‚Â¢y lÃƒÆ’Ã‚Â  cÃƒÂ¡Ã‚ÂºÃ‚Â§u nÃƒÂ¡Ã‚Â»Ã¢â‚¬Ëœi quan trÃƒÂ¡Ã‚Â»Ã‚Âng nhÃƒÂ¡Ã‚ÂºÃ‚Â¥t:
  // - Ãƒâ€žÃ‚ÂiÃƒÂ¡Ã‚Â»Ã†â€™m danh PRESENT/LATE ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ tÃƒÂ¡Ã‚Â»Ã‚Â± Ãƒâ€žÃ¢â‚¬ËœÃƒÂ¡Ã‚Â»Ã¢â€žÂ¢ng tÃƒÂ¡Ã‚ÂºÃ‚Â¡o Session (TEACHER_COMPLETED)
  // - Session ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ auto-confirm sau 48h ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ FINALIZED
  // - FINALIZED ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ trÃƒÂ¡Ã‚Â»Ã‚Â« vÃƒÆ’Ã‚Â­ phÃƒÂ¡Ã‚Â»Ã‚Â¥ huynh + sÃƒÂ¡Ã‚ÂºÃ‚Âµn sÃƒÆ’Ã‚Â ng tÃƒÆ’Ã‚Â­nh lÃƒâ€ Ã‚Â°Ãƒâ€ Ã‚Â¡ng GV
  // ÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚Â

  /**
   * Create or update a Session when attendance = PRESENT / LATE (with transaction).
   * Returns the sessionId or null on failure.
   */
  private async syncSessionForAttendance(params: {
    classId: Types.ObjectId;
    studentId: Types.ObjectId;
    teacherId: Types.ObjectId;
    date: Date;
    classroom: ClassLean;
    substitutePayRate?: number;
    mongoSession?: ClientSession;
  }): Promise<Types.ObjectId | null> {
    const {
      classId,
      studentId,
      teacherId,
      date,
      classroom,
      substitutePayRate,
      mongoSession: outerSession,
    } = params;

      const mongoSession = outerSession ?? await this.connection.startSession();
      const ownsTransaction = !outerSession;
      const range = dayRange(date);
      const durationConfig = getCurrentDurationForStudent(classroom, studentId.toString());
      const duration =
        durationConfig.sessionDuration
        || (classroom as any).sessionDuration
        || (classroom as any).baseDuration
        || 60;

      let teacherPayout: number;
      if (substitutePayRate !== undefined) {
        teacherPayout = substitutePayRate;
      } else if ((classroom as any).classMode === ClassMode.OFFLINE) {
        teacherPayout = (classroom as any).teacherPayPerStudent ?? 0;
      } else {
        teacherPayout = (classroom as any).teacherPayPerSession ?? 0;
      }

      const activeTrialEnrollment = await this.findActiveTrialEnrollment(
        classId,
        studentId,
        mongoSession,
      );
      const isTrialSession = !!activeTrialEnrollment;

      try {
        if (ownsTransaction) {
          mongoSession.startTransaction();
        }

      // Check for existing session on same day
      const existingSession = await this.sessionModel
        .findOne({
          classId,
          studentId,
          scheduledDate: range,
          status: { $nin: ['CANCELLED', 'RESCHEDULED'] },
        })
        .session(mongoSession);

      if (existingSession) {
        let shouldSave = false;

        // Upgrade to TEACHER_COMPLETED if still SCHEDULED.
        // Attendance owner (main/substitute teacher) becomes payout owner for payroll.
        if (existingSession.status === 'SCHEDULED') {
          existingSession.status = 'TEACHER_COMPLETED' as any;
          existingSession.confirmation = existingSession.confirmation ?? ({} as any);
          existingSession.confirmation.teacherCompletedAt = new Date();
          if (isTrialSession && existingSession.sessionType !== SessionType.TRIAL) {
            existingSession.sessionType = SessionType.TRIAL as any;
          }
          if (
            activeTrialEnrollment &&
            existingSession.trialEnrollmentId?.toString() !== activeTrialEnrollment._id.toString()
          ) {
            (existingSession as any).trialEnrollmentId = activeTrialEnrollment._id as any;
          }
          if (existingSession.teacherId?.toString() !== teacherId.toString()) {
            existingSession.teacherId = teacherId as any;
          }
          if (Number(existingSession.teacherPayout ?? 0) !== Number(teacherPayout)) {
            existingSession.teacherPayout = teacherPayout;
          }
          shouldSave = true;
        } else if (
          existingSession.status === 'TEACHER_COMPLETED' &&
          !existingSession.hasTeachingReport &&
          !existingSession.isTeacherPaid
        ) {
          if (isTrialSession && existingSession.sessionType !== SessionType.TRIAL) {
            existingSession.sessionType = SessionType.TRIAL as any;
            shouldSave = true;
          }
          if (
            activeTrialEnrollment &&
            existingSession.trialEnrollmentId?.toString() !== activeTrialEnrollment._id.toString()
          ) {
            (existingSession as any).trialEnrollmentId = activeTrialEnrollment._id as any;
            shouldSave = true;
          }
          if (existingSession.teacherId?.toString() !== teacherId.toString()) {
            existingSession.teacherId = teacherId as any;
            shouldSave = true;
          }
          if (Number(existingSession.teacherPayout ?? 0) !== Number(teacherPayout)) {
            existingSession.teacherPayout = teacherPayout;
            shouldSave = true;
          }
        }

        if (shouldSave) {
          await existingSession.save({ session: mongoSession });
        }
        if (ownsTransaction) {
          await mongoSession.commitTransaction();
        }
        return existingSession._id as Types.ObjectId;
      }

      const amountCharged = await this.resolveAmountCharged(
        studentId,
        classId,
        duration,
        classroom,
      );

      const student = await this.studentModel
        .findById(studentId)
        .select('parentUserId')
        .session(mongoSession)
        .lean();

      const lastSession = await this.sessionModel
        .findOne({
          classId,
          studentId,
        })
        .sort('-sessionNumber')
        .select('sessionNumber')
        .session(mongoSession)
        .lean();

      const sessionNumber = (lastSession?.sessionNumber ?? 0) + 1;

      try {
        const created = await this.sessionModel.create(
          [
            {
              classId,
              studentId,
              teacherId,
              parentUserId: (student as any)?.parentUserId,
              sessionType: isTrialSession ? SessionType.TRIAL : SessionType.REGULAR,
              trialEnrollmentId: activeTrialEnrollment?._id,
              trialConverted: false,
              trialTeacherPaidOnly: false,
              trialRejectedNoPay: false,
              scheduledDate: date,
              durationMinutes: duration,
              sessionNumber,
              amountCharged,
              teacherPayout,
              status: 'TEACHER_COMPLETED',
              confirmation: { teacherCompletedAt: new Date() },
              autoConfirmAfterHours: 48,
              createdBy: teacherId,
            },
          ],
          { session: mongoSession },
        );

        if (ownsTransaction) {
          await mongoSession.commitTransaction();
        }
        return created[0]._id as Types.ObjectId;
      } catch (err: any) {
        if (ownsTransaction && mongoSession.inTransaction()) {
          await mongoSession.abortTransaction();
        }

        if (err.code === 11000) {
          const followUpSession = ownsTransaction ? undefined : mongoSession;
          let foundQuery = this.sessionModel.findOne({
            classId,
            studentId,
            scheduledDate: range,
            status: { $nin: ['CANCELLED', 'RESCHEDULED'] },
          });
          if (followUpSession) {
            foundQuery = foundQuery.session(followUpSession);
          }
          const found = await foundQuery;
          if (found?._id) {
            return found._id as Types.ObjectId;
          }

          // Legacy DBs may still have a unique index on
          // (classId, studentId, scheduledDate, scheduledStartTime).
          // If create hits duplicate key because a prior same-day session was CANCELLED,
          // reopen that cancelled session instead of returning null.
          let cancelledQuery = this.sessionModel
            .findOne({
              classId,
              studentId,
              scheduledDate: range,
              status: 'CANCELLED',
            })
            .sort('-sessionNumber');
          if (followUpSession) {
            cancelledQuery = cancelledQuery.session(followUpSession);
          }
          const cancelled = await cancelledQuery;

          if (cancelled) {
            cancelled.status = 'TEACHER_COMPLETED' as any;
            cancelled.teacherId = teacherId;
            cancelled.sessionType = isTrialSession ? (SessionType.TRIAL as any) : cancelled.sessionType;
            (cancelled as any).trialEnrollmentId = activeTrialEnrollment?._id as any;
            (cancelled as any).trialRejectedNoPay = false;
            cancelled.durationMinutes = duration;
            cancelled.amountCharged = amountCharged;
            cancelled.teacherPayout = teacherPayout;
            cancelled.autoConfirmAfterHours = 48;
            cancelled.cancellation = undefined as any;
            cancelled.confirmation = cancelled.confirmation ?? ({} as any);
            cancelled.confirmation.teacherCompletedAt = new Date();
            await cancelled.save(followUpSession ? { session: followUpSession } : undefined);
            return cancelled._id as Types.ObjectId;
          }

          return null;
        }

        if (ownsTransaction && mongoSession.inTransaction()) {
          await mongoSession.abortTransaction();
        }
        this.logger.error(`Failed to create session: ${err.message}`, err.stack);
        return null;
      }
    } catch (err: any) {
      if (ownsTransaction && mongoSession.inTransaction()) {
        await mongoSession.abortTransaction();
      }
      this.logger.error(`Failed to sync session for attendance: ${err.message}`, err.stack);
      return null;
    } finally {
      if (ownsTransaction) {
        await mongoSession.endSession();
      }
    }
  }

  private async findFinalizedSessionForAttendance(
    classId: Types.ObjectId,
    studentId: Types.ObjectId,
    date: Date,
    mongoSession?: ClientSession,
  ) {
    let query = this.sessionModel
      .findOne({
        classId,
        studentId,
        scheduledDate: dayRange(date),
        status: 'FINALIZED',
      })
      .select('_id status');
    if (mongoSession) {
      query = query.session(mongoSession);
    }
    return query.lean();
  }

  /** Cancel linked session when attendance changes to ABSENT/EXCUSED */
  private async cancelLinkedSession(
    sessionId?: Types.ObjectId,
    mongoSession?: ClientSession,
  ): Promise<void> {
    if (!sessionId) return;
    let query = this.sessionModel.findById(sessionId);
    if (mongoSession) {
      query = query.session(mongoSession);
    }
    const session = await query;
    if (!session) return;
    // Cannot cancel already-finalized sessions (wallet already deducted)
    if (['FINALIZED', 'CANCELLED', 'RESCHEDULED'].includes(session.status)) return;

    session.status = 'CANCELLED' as any;
    session.cancellation = {
      cancelledBy: 'SYSTEM',
      cancelReason: 'HÃƒÂ¡Ã‚Â»Ã‚Â§y do Ãƒâ€žÃ¢â‚¬ËœiÃƒÂ¡Ã‚Â»Ã†â€™m danh thay Ãƒâ€žÃ¢â‚¬ËœÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¢i thÃƒÆ’Ã‚Â nh vÃƒÂ¡Ã‚ÂºÃ‚Â¯ng mÃƒÂ¡Ã‚ÂºÃ‚Â·t/bÃƒÂ¡Ã‚ÂºÃ‚Â£o lÃƒâ€ Ã‚Â°u',
      cancelledAt: new Date(),
      refundPercent: 100,
      refundAmount: 0,
    } as any;
    await session.save(mongoSession ? { session: mongoSession } : undefined);
  }

  private async clearAttendanceRecord(params: {
    classId: string | Types.ObjectId;
    studentId: string | Types.ObjectId;
    date: Date;
  }): Promise<boolean> {
    const classObjectId =
      typeof params.classId === 'string' ? new Types.ObjectId(params.classId) : params.classId;
    const studentObjectId =
      typeof params.studentId === 'string'
        ? new Types.ObjectId(params.studentId)
        : params.studentId;
    const mongoSession = await this.connection.startSession();

    try {
      mongoSession.startTransaction();

      const existingFinalized = await this.findFinalizedSessionForAttendance(
        classObjectId,
        studentObjectId,
        params.date,
        mongoSession,
      );
      if (existingFinalized) {
        throw new BadRequestException(
          'Buoi hoc da duoc xac nhan hoan thanh (FINALIZED). Khong the thay doi diem danh.',
        );
      }

      const attendance = await this.attendanceModel
        .findOne({
          classId: classObjectId,
          studentId: studentObjectId,
          date: params.date,
        })
        .session(mongoSession);

      if (!attendance) {
        await mongoSession.commitTransaction();
        return false;
      }

      if (attendance.sessionId) {
        await this.cancelLinkedSession(attendance.sessionId, mongoSession);
      }

      await attendance.deleteOne({ session: mongoSession });
      await mongoSession.commitTransaction();
      await this.syncTrialUsage(classObjectId, studentObjectId);
      return true;
    } catch (err) {
      if (mongoSession.inTransaction()) {
        await mongoSession.abortTransaction();
      }
      throw err;
    } finally {
      await mongoSession.endSession();
    }
  }

  // ÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚Â
  // LOAD STUDENTS FOR A CLASS (from class.students)
  // ÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚Â

  private async loadStudentsForClass(
    classroom: ClassLean,
    user: JwtPayload,
    date?: Date,
  ): Promise<StudentLean[]> {
    const cls = await this.classModel
      .findById(classroom._id)
      .populate('students', 'fullName age parentName studentCode faceImage parentPhone')
      .lean();
    const rosterStudents = (((cls as any)?.students as StudentLean[]) || []).map((student) => ({
      ...student,
      isTrial: false,
    }));
    const trialStudents = await this.loadTrialStudentsForClass(classroom._id as Types.ObjectId);

    const merged = new Map<string, StudentLean>();
    rosterStudents.forEach((student) => merged.set(student._id.toString(), student));
    trialStudents.forEach((student) => {
      if (!merged.has(student._id.toString())) {
        merged.set(student._id.toString(), student);
      }
    });

    const students = [...merged.values()];
    if (!this.isTeacher(user)) {
      return students;
    }

    const teacherId = this.getUserId(user);
    const isActiveSubstitute = !!(date && this.getSubstituteInfo(cls as ClassLean, user, date));
    if (isActiveSubstitute) {
      return students;
    }

    const visibleStudentIds = this.getVisibleStudentIdsForTeacher(cls as ClassLean, teacherId);
    const isClassTeacher = (cls as any)?.teacher?.toString?.() === teacherId;
    return students.filter((student) => {
      if (student.isTrial) {
        return isClassTeacher;
      }
      return visibleStudentIds.has(student._id.toString());
    });
  }

  // ÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚Â
  // CORE: Process one attendance item (with session bridge)
  // ÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚Â

  private async processOneStudent(params: {
    classId: string;
    studentId: string;
    date: Date;
    status: AttendanceStatus;
    notes: string;
    teacherId: Types.ObjectId;
    classroom: ClassLean;
    substitutePayRate?: number;
    checkedBy?: Types.ObjectId | null;
  }): Promise<{ attendance: any; sessionCreated: boolean }> {
    const {
      classId,
      studentId,
      date,
      status,
      notes,
      teacherId,
      classroom,
      substitutePayRate,
      checkedBy,
    } = params;
    const classObjectId = new Types.ObjectId(classId);
    const studentObjectId = new Types.ObjectId(studentId);
    const mongoSession = await this.connection.startSession();

    try {
      mongoSession.startTransaction();

      // Check if there's an existing FINALIZED session for this attendance Ã¢â‚¬â€ block changes
      const existingFinalized = await this.findFinalizedSessionForAttendance(
        classObjectId,
        studentObjectId,
        date,
        mongoSession,
      );
      if (existingFinalized) {
        throw new BadRequestException(
          'Buoi hoc da duoc xac nhan hoan thanh (FINALIZED). Khong the thay doi diem danh.',
        );
      }

      const query = { classId: classObjectId, studentId: studentObjectId, date };
      const existingAttendance = await this.attendanceModel
        .findOne(query)
        .select('_id sessionId')
        .session(mongoSession)
        .lean();

      let sessionCreated = false;
      const isPresent = this.isCountedAttendanceStatus(status);
      let sessionId: Types.ObjectId | null = null;

      if (isPresent) {
        // PRESENT -> ensure Session exists (TEACHER_COMPLETED)
        sessionId = await this.syncSessionForAttendance({
          classId: classObjectId,
          studentId: studentObjectId,
          teacherId,
          date,
          classroom,
          substitutePayRate,
          mongoSession,
        });
        if (!sessionId) {
          throw new ConflictException(
            'Khong the dong bo session cho diem danh hien tai. Vui long thu lai.',
          );
        }
        sessionCreated = true;
      } else if (existingAttendance?.sessionId) {
        await this.cancelLinkedSession(existingAttendance.sessionId as Types.ObjectId, mongoSession);
      }

      const update: any = {
        $set: {
          teacherId,
          status,
          notes: notes || '',
        },
      };

      if (sessionId) {
        update.$set.sessionId = sessionId;
      } else {
        update.$unset = { sessionId: 1 };
      }

      if (isPresent && checkedBy) {
        update.$set.checkedBy = checkedBy;
        update.$set.checkedAt = new Date();
      } else if (!isPresent) {
        update.$unset = {
          ...(update.$unset || {}),
          checkedBy: 1,
          checkedAt: 1,
        };
      }

      const attendance = await this.attendanceModel.findOneAndUpdate(
        query,
        update,
        {
          new: true,
          upsert: true,
          setDefaultsOnInsert: true,
          session: mongoSession,
        },
      );

      await mongoSession.commitTransaction();
      await this.syncTrialUsage(classObjectId, studentObjectId);
      return { attendance, sessionCreated };
    } catch (err) {
      if (mongoSession.inTransaction()) {
        await mongoSession.abortTransaction();
      }
      throw err;
    } finally {
      await mongoSession.endSession();
    }
  }
  // PUBLIC API ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â Main attendance operations
  // ÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚Â

  /** Ãƒâ€žÃ‚ÂiÃƒÂ¡Ã‚Â»Ã†â€™m danh mÃƒÂ¡Ã‚Â»Ã¢â€žÂ¢t hÃƒÂ¡Ã‚Â»Ã‚Âc sinh */
  async markAttendance(dto: CreateAttendanceDto, user: JwtPayload) {
    const date = normalizeDate(dto.date);
    const classroom = await this.classModel.findById(dto.classId).lean<ClassLean>();
    this.assertClassAccess(classroom, user, date);
    const normalizedStatus = this.normalizeInteractiveAttendanceStatus(dto.status);

    // Validate student belongs to this class
    const studentAllowed = await this.isStudentAllowedInClass(classroom, dto.studentId);
    if (!studentAllowed) {
      throw new BadRequestException('HÃƒÂ¡Ã‚Â»Ã‚Âc sinh khÃƒÆ’Ã‚Â´ng thuÃƒÂ¡Ã‚Â»Ã¢â€žÂ¢c lÃƒÂ¡Ã‚Â»Ã¢â‚¬Âºp nÃƒÆ’Ã‚Â y');
    }

    // Check nÃƒÂ¡Ã‚ÂºÃ‚Â¿u lÃƒÆ’Ã‚Â  GV dÃƒÂ¡Ã‚ÂºÃ‚Â¡y thay ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ lÃƒÂ¡Ã‚ÂºÃ‚Â¥y payRate riÃƒÆ’Ã‚Âªng
    const subInfo = this.getSubstituteInfo(classroom, user, date);
    const attendanceTeacherId = this.resolveAttendanceTeacherId(
      classroom,
      user,
      date,
      dto.studentId,
    );
    const opsCheckerId = this.getOpsCheckerId(user);

    const result = normalizedStatus
      ? await this.processOneStudent({
          classId: dto.classId,
          studentId: dto.studentId,
          date,
          status: normalizedStatus,
          notes: dto.notes || '',
          teacherId: attendanceTeacherId,
          classroom,
          substitutePayRate: subInfo?.payRate,
          checkedBy: opsCheckerId,
        })
      : {
          attendance: null,
          sessionCreated: await this.clearAttendanceRecord({
            classId: dto.classId,
            studentId: dto.studentId,
            date,
          }),
        };

    let offlineSummary:
      | { attendedCount: number; perStudentTeacherPay: number; totalTeacherPayout: number; minimumApplied: boolean }
      | null = null;
    if ((classroom as any).classMode === ClassMode.OFFLINE) {
      offlineSummary = await this.recomputeOfflineTeacherPayoutForDay({
        classId: dto.classId,
        date,
        classroom,
      });
    }

    const populated = result.attendance?._id
      ? await this.attendanceModel
          .findById(result.attendance._id)
          .populate('studentId', 'fullName age parentName')
          .populate('classId', 'name code')
          .lean()
      : null;

    return {
      ...(populated || {}),
      sessionCreated: result.sessionCreated,
      ...(offlineSummary
        ? {
            classMode: 'OFFLINE',
            attendedCount: offlineSummary.attendedCount,
            teacherPayPerStudent: offlineSummary.perStudentTeacherPay,
            totalTeacherPayout: offlineSummary.totalTeacherPayout,
            minimumTeacherPayoutApplied: offlineSummary.minimumApplied,
          }
        : {}),
    };
  }

  /** Ãƒâ€žÃ‚ÂiÃƒÂ¡Ã‚Â»Ã†â€™m danh nhiÃƒÂ¡Ã‚Â»Ã‚Âu hÃƒÂ¡Ã‚Â»Ã‚Âc sinh cÃƒÆ’Ã‚Â¹ng lÃƒÆ’Ã‚Âºc (bulk) */
  async bulkMarkAttendance(dto: BulkAttendanceDto, user: JwtPayload) {
    const date = normalizeDate(dto.date);
    const classroom = await this.classModel.findById(dto.classId).lean<ClassLean>();
    this.assertClassAccess(classroom, user, date);

    const isOffline = (classroom as any).classMode === ClassMode.OFFLINE;

    // Check nÃƒÂ¡Ã‚ÂºÃ‚Â¿u lÃƒÆ’Ã‚Â  GV dÃƒÂ¡Ã‚ÂºÃ‚Â¡y thay ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ lÃƒÂ¡Ã‚ÂºÃ‚Â¥y payRate riÃƒÆ’Ã‚Âªng
    const subInfo = this.getSubstituteInfo(classroom, user, date);
    const opsCheckerId = this.getOpsCheckerId(user);

    // Load allowed students ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â only students from orders for this class
    const students = await this.loadStudentsForClass(classroom, user, date);
    const allowedIds = new Set(students.map((s) => s._id.toString()));

    let attendedCount = 0;
    let teacherPayPerStudent = Number((classroom as any).teacherPayPerStudent ?? 0);
    let totalTeacherPayout = 0;
    let minimumTeacherPayoutApplied = false;

    const results: any[] = [];
    const errors: Array<{ studentId: string; message: string }> = [];
    let sessionsCreated = 0;
    let totalProcessed = 0;
    const submittedIds = new Set<string>();

    // ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Collect submitted student IDs ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
    for (const item of dto.attendances) {
      if (!allowedIds.has(item.studentId)) {
        errors.push({
          studentId: item.studentId,
          message: 'HÃƒÂ¡Ã‚Â»Ã‚Âc sinh khÃƒÆ’Ã‚Â´ng thuÃƒÂ¡Ã‚Â»Ã¢â€žÂ¢c lÃƒÂ¡Ã‚Â»Ã¢â‚¬Âºp hÃƒÂ¡Ã‚Â»Ã‚Âc nÃƒÆ’Ã‚Â y',
        });
        continue;
      }

      try {
        submittedIds.add(item.studentId);
        const normalizedStatus = this.normalizeBulkAttendanceStatus(item.status);
        if (normalizedStatus) {
          const attendanceTeacherId = this.resolveAttendanceTeacherId(
            classroom,
            user,
            date,
            item.studentId,
          );
          const result = await this.processOneStudent({
            classId: dto.classId,
            studentId: item.studentId,
            date,
            status: normalizedStatus,
            notes: item.notes || '',
            teacherId: attendanceTeacherId,
            classroom,
            substitutePayRate: subInfo?.payRate,
            checkedBy: opsCheckerId,
          });
          results.push(result.attendance);
          if (result.sessionCreated) sessionsCreated++;
        } else {
          await this.clearAttendanceRecord({
            classId: dto.classId,
            studentId: item.studentId,
            date,
          });
        }
        totalProcessed++;
      } catch (err: any) {
        errors.push({
          studentId: item.studentId,
          message: err.message || 'LÃƒÂ¡Ã‚Â»Ã¢â‚¬â€i khÃƒÆ’Ã‚Â´ng xÃƒÆ’Ã‚Â¡c Ãƒâ€žÃ¢â‚¬ËœÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¹nh',
        });
      }
    }

    // ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ OFFLINE: tÃƒÂ¡Ã‚ÂºÃ‚Â¡o Ãƒâ€žÃ¢â‚¬ËœiÃƒÂ¡Ã‚Â»Ã†â€™m danh ABSENT cho HS trong lÃƒÂ¡Ã‚Â»Ã¢â‚¬Âºp nhÃƒâ€ Ã‚Â°ng KHÃƒÆ’Ã¢â‚¬ÂNG cÃƒÆ’Ã‚Â³ trong danh sÃƒÆ’Ã‚Â¡ch ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
    // HS vÃƒÂ¡Ã‚ÂºÃ‚Â¯ng KHÃƒÆ’Ã¢â‚¬ÂNG bÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¹ trÃƒÂ¡Ã‚Â»Ã‚Â« tiÃƒÂ¡Ã‚Â»Ã‚Ân ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â chÃƒÂ¡Ã‚Â»Ã¢â‚¬Â° ghi nhÃƒÂ¡Ã‚ÂºÃ‚Â­n Ãƒâ€žÃ¢â‚¬ËœiÃƒÂ¡Ã‚Â»Ã†â€™m danh ABSENT
    if (isOffline) {
      for (const student of students) {
        const sid = student._id.toString();
        if (submittedIds.has(sid)) continue; // Ãƒâ€žÃ‚ÂÃƒÆ’Ã‚Â£ xÃƒÂ¡Ã‚Â»Ã‚Â­ lÃƒÆ’Ã‚Â½ ÃƒÂ¡Ã‚Â»Ã…Â¸ trÃƒÆ’Ã‚Âªn

        try {
          const attendanceTeacherId = this.resolveAttendanceTeacherId(
            classroom,
            user,
            date,
            sid,
          );
          const result = await this.processOneStudent({
            classId: dto.classId,
            studentId: sid,
            date,
            status: AttendanceStatus.ABSENT,
            notes: 'Khong co mat (OFFLINE auto-absent)',
            teacherId: attendanceTeacherId,
            classroom,
            substitutePayRate: subInfo?.payRate,
            checkedBy: opsCheckerId,
            // KhÃƒÆ’Ã‚Â´ng truyÃƒÂ¡Ã‚Â»Ã‚Ân forceSessionForAbsent ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ HS vÃƒÂ¡Ã‚ÂºÃ‚Â¯ng khÃƒÆ’Ã‚Â´ng tÃƒÂ¡Ã‚ÂºÃ‚Â¡o session, khÃƒÆ’Ã‚Â´ng trÃƒÂ¡Ã‚Â»Ã‚Â« tiÃƒÂ¡Ã‚Â»Ã‚Ân
          });
          results.push(result.attendance);
          if (result.sessionCreated) sessionsCreated++;
        } catch (err: any) {
          errors.push({
            studentId: sid,
            message: err.message || 'LÃƒÂ¡Ã‚Â»Ã¢â‚¬â€i khÃƒÆ’Ã‚Â´ng xÃƒÆ’Ã‚Â¡c Ãƒâ€žÃ¢â‚¬ËœÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¹nh',
          });
        }
      }

      // OFFLINE payout rule:
      // totalTeacherPayout = max(200k, teacherPayPerStudent * attendedCount)
      const summary = await this.recomputeOfflineTeacherPayoutForDay({
        classId: dto.classId,
        date,
        classroom,
      });
      attendedCount = summary.attendedCount;
      teacherPayPerStudent = summary.perStudentTeacherPay;
      totalTeacherPayout = summary.totalTeacherPayout;
      minimumTeacherPayoutApplied = summary.minimumApplied;

      this.logger.log(
        `[OFFLINE] Class ${dto.classId}: attended=${attendedCount}, ` +
          `teacherPayPerStudent=${teacherPayPerStudent}, ` +
          `totalTeacherPayout=${totalTeacherPayout}, ` +
          `minimumApplied=${minimumTeacherPayoutApplied}`,
      );
    }

    return {
      success: results,
      errors,
      sessionsCreated,
      totalProcessed,
      totalErrors: errors.length,
      ...(isOffline
        ? {
            attendedCount,
            classMode: 'OFFLINE',
            teacherPayPerStudent,
            totalTeacherPayout,
            minimumTeacherPayoutApplied,
          }
        : {}),
    };
  }

  /** LÃƒÂ¡Ã‚ÂºÃ‚Â¥y danh sÃƒÆ’Ã‚Â¡ch Ãƒâ€žÃ¢â‚¬ËœiÃƒÂ¡Ã‚Â»Ã†â€™m danh theo lÃƒÂ¡Ã‚Â»Ã¢â‚¬Âºp vÃƒÆ’Ã‚Â  ngÃƒÆ’Ã‚Â y (bao gÃƒÂ¡Ã‚Â»Ã¢â‚¬Å“m trÃƒÂ¡Ã‚ÂºÃ‚Â¡ng thÃƒÆ’Ã‚Â¡i Ãƒâ€žÃ¢â‚¬ËœÃƒÆ’Ã‚Â£ lÃƒâ€ Ã‚Â°u) */
  async getAttendanceByClass(classId: string, date: string, user: JwtPayload) {
    const classroom = await this.classModel.findById(classId).lean<ClassLean>();
    const attendanceDate = normalizeDate(date);
    this.assertClassAccess(classroom, user, attendanceDate);
    const students = await this.loadStudentsForClass(classroom, user, attendanceDate);

    // Existing attendance records for this day
    const attendances = await this.attendanceModel
      .find({ classId, date: attendanceDate })
      .populate('studentId', 'fullName age parentName studentCode')
      .lean();

    const attendanceMap = new Map<string, any>();
    for (const att of attendances) {
      const sid = att.studentId?._id?.toString() ?? att.studentId?.toString();
      if (sid) attendanceMap.set(sid, att);
    }

    const sorted = [...students].sort((a, b) =>
      (a.fullName || '').localeCompare(b.fullName || '', 'vi', { sensitivity: 'base' }),
    );

    const attendanceList = sorted.map((student) => {
      const sid = student._id.toString();
      const existing = attendanceMap.get(sid);
      return {
        student: {
          _id: sid,
          fullName: student.fullName,
          age: (student as any).age,
          parentName: (student as any).parentName,
          studentCode: (student as any).studentCode,
          isTrial: !!(student as any).isTrial,
          trialEnrollmentId: (student as any).trialEnrollmentId?.toString?.() || null,
        },
        attendance: existing
          ? {
              _id: existing._id?.toString(),
              classId: existing.classId?.toString(),
              studentId: sid,
              date: existing.date,
              status: existing.status,
              notes: existing.notes || '',
              attendedAt: existing.attendedAt || null,
              imageUrl: existing.imageUrl || null,
              sessionId: existing.sessionId?.toString() || null,
            }
          : {
              _id: null,
              classId,
              studentId: sid,
              date: attendanceDate,
              status: null,
              notes: '',
              attendedAt: null,
              imageUrl: null,
              sessionId: null,
            },
      };
    });

    return {
      class: {
        _id: (classroom as any)._id,
        name: classroom.name,
        code: (classroom as any).code,
      },
      date: attendanceDate,
      attendanceList,
    };
  }

  /** CÃƒÂ¡Ã‚ÂºÃ‚Â­p nhÃƒÂ¡Ã‚ÂºÃ‚Â­t trÃƒÂ¡Ã‚ÂºÃ‚Â¡ng thÃƒÆ’Ã‚Â¡i Ãƒâ€žÃ¢â‚¬ËœiÃƒÂ¡Ã‚Â»Ã†â€™m danh (cÃƒÆ’Ã‚Â³ Ãƒâ€žÃ¢â‚¬ËœÃƒÂ¡Ã‚Â»Ã¢â‚¬Å“ng bÃƒÂ¡Ã‚Â»Ã¢â€žÂ¢ Session) */
  async updateAttendance(id: string, dto: UpdateAttendanceDto, user: JwtPayload) {
    const mongoSession = await this.connection.startSession();
    let classroomForRecompute: ClassLean | null = null;
    let classIdForRecompute: Types.ObjectId | null = null;
    let dateForRecompute: Date | null = null;

    try {
      mongoSession.startTransaction();

      const attendance = await this.attendanceModel.findById(id).session(mongoSession);
      if (!attendance) throw new NotFoundException('Khong tim thay ban ghi diem danh');

      const classroom = await this.classModel
        .findById(attendance.classId)
        .lean<ClassLean>();
      this.assertClassAccess(classroom, user, attendance.date);
      classroomForRecompute = classroom;
      classIdForRecompute = attendance.classId;
      dateForRecompute = attendance.date;

      // Prevent any edits once the linked teaching session is finalized
      const existingFinalized = await this.findFinalizedSessionForAttendance(
        attendance.classId,
        attendance.studentId,
        attendance.date,
        mongoSession,
      );
      if (existingFinalized) {
        throw new BadRequestException(
          'Buoi hoc da duoc xac nhan hoan thanh (FINALIZED). Khong the thay doi diem danh.',
        );
      }

      // Check neu la GV day thay -> lay payRate rieng
      const subInfo = this.getSubstituteInfo(classroom, user, attendance.date);
      const attendanceTeacherId = this.resolveAttendanceTeacherId(
        classroom,
        user,
        attendance.date,
        attendance.studentId.toString(),
      );
      const opsCheckerId = this.getOpsCheckerId(user);

      const prevStatus = attendance.status;
      const newStatus = dto.status || prevStatus;

      // Session sync on status change
      const wasCounted = this.isCountedAttendanceStatus(prevStatus);
      const isCounted = this.isCountedAttendanceStatus(newStatus);

      if (!wasCounted && isCounted) {
        // ABSENT/EXCUSED -> PRESENT/LATE: create session
        const sid = await this.syncSessionForAttendance({
          classId: attendance.classId,
          studentId: attendance.studentId,
          teacherId: attendanceTeacherId,
          date: attendance.date,
          classroom,
          substitutePayRate: subInfo?.payRate,
          mongoSession,
        });
        if (!sid) {
          throw new ConflictException(
            'Khong the dong bo session cho diem danh hien tai. Vui long thu lai.',
          );
        }
        attendance.sessionId = sid;
      } else if (wasCounted && !isCounted) {
        // PRESENT/LATE -> ABSENT/EXCUSED: cancel session
        if (attendance.sessionId) {
          await this.cancelLinkedSession(attendance.sessionId, mongoSession);
          attendance.sessionId = undefined;
        }
      }

      if (dto.status) attendance.status = dto.status;
      if (dto.notes !== undefined) attendance.notes = dto.notes;
      attendance.teacherId = attendanceTeacherId;
      // checkedBy / checkedAt đã chuyển sang PayrollTransaction (SSOT) — không còn trong Attendance schema
      await attendance.save({ session: mongoSession });

      await mongoSession.commitTransaction();
    } catch (err) {
      if (mongoSession.inTransaction()) {
        await mongoSession.abortTransaction();
      }
      throw err;
    } finally {
      await mongoSession.endSession();
    }

    if (
      classroomForRecompute &&
      classIdForRecompute &&
      dateForRecompute &&
      (classroomForRecompute as any).classMode === ClassMode.OFFLINE
    ) {
      await this.recomputeOfflineTeacherPayoutForDay({
        classId: classIdForRecompute,
        date: dateForRecompute,
        classroom: classroomForRecompute,
      });
    }

    return this.attendanceModel
      .findById(id)
      .populate('studentId', 'fullName age parentName')
      .populate('classId', 'name code')
      .lean();
  }
  /** LÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¹ch sÃƒÂ¡Ã‚Â»Ã‚Â­ Ãƒâ€žÃ¢â‚¬ËœiÃƒÂ¡Ã‚Â»Ã†â€™m danh cÃƒÂ¡Ã‚Â»Ã‚Â§a mÃƒÂ¡Ã‚Â»Ã¢â€žÂ¢t hÃƒÂ¡Ã‚Â»Ã‚Âc sinh */
  async getStudentAttendanceHistory(
    studentId: string,
    classId?: string,
    actor?: JwtPayload,
  ) {
    const filter: any = { studentId: new Types.ObjectId(studentId) };
    if (classId) {
      if (!Types.ObjectId.isValid(classId)) {
        throw new BadRequestException('classId khong hop le');
      }
      filter.classId = new Types.ObjectId(classId);
    }
    if (actor?.role === Role.TEACHER) {
      filter.teacherId = new Types.ObjectId(this.getUserId(actor));
    }

    return this.attendanceModel
      .find({ ...filter, status: { $exists: true, $ne: null } })
      .populate('classId', 'name code')
      .populate('teacherId', 'fullName email')
      .sort({ date: -1 })
      .lean();
  }

  /** ThÃƒÂ¡Ã‚Â»Ã¢â‚¬Ëœng kÃƒÆ’Ã‚Âª Ãƒâ€žÃ¢â‚¬ËœiÃƒÂ¡Ã‚Â»Ã†â€™m danh theo lÃƒÂ¡Ã‚Â»Ã¢â‚¬Âºp */
  async getAttendanceStats(
    classId: string,
    startDate: string,
    endDate: string,
    user: JwtPayload,
  ) {
    const classroom = await this.classModel.findById(classId).lean<ClassLean>();
    this.assertClassAccess(classroom, user);

    const start = normalizeDate(startDate);
    const end = normalizeDate(endDate);
    end.setUTCHours(23, 59, 59, 999);

    const stats = await this.attendanceModel.aggregate([
      {
        $match: {
          classId: new Types.ObjectId(classId),
          date: { $gte: start, $lte: end },
          status: { $exists: true, $ne: null },
        },
      },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    return { classId, period: { startDate, endDate }, statistics: stats };
  }

  // ÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚Â
  // GENERATE LINK + PUBLIC ENDPOINTS (self-attendance via webcam)
  // ÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚Â

  /** TÃƒÂ¡Ã‚ÂºÃ‚Â¡o link Ãƒâ€žÃ¢â‚¬ËœiÃƒÂ¡Ã‚Â»Ã†â€™m danh cho hÃƒÂ¡Ã‚Â»Ã‚Âc sinh (GV/Director tÃƒÂ¡Ã‚ÂºÃ‚Â¡o, HS tÃƒÂ¡Ã‚Â»Ã‚Â± Ãƒâ€žÃ¢â‚¬ËœiÃƒÂ¡Ã‚Â»Ã†â€™m danh) */
  async generateAttendanceLink(dto: GenerateAttendanceLinkDto, user: JwtPayload) {
    const classroom = await this.classModel.findById(dto.classId).lean<ClassLean>();
    const date = normalizeDate(dto.date);
    this.assertClassAccess(classroom, user, date);

    const studentAllowed = await this.isStudentAllowedInClass(classroom, dto.studentId);
    if (!studentAllowed) {
      throw new BadRequestException('Hoc sinh khong thuoc lop nay');
    }

    // GV dÃƒÂ¡Ã‚ÂºÃ‚Â¡y thay: kiÃƒÂ¡Ã‚Â»Ã†â€™m tra quyÃƒÂ¡Ã‚Â»Ã‚Ân tÃƒÂ¡Ã‚ÂºÃ‚Â¡o link
    const subInfo = this.getSubstituteInfo(classroom, user, date);
    const attendanceTeacherId = this.resolveAttendanceTeacherId(
      classroom,
      user,
      date,
      dto.studentId,
    );
    if (subInfo && !subInfo.canCreateLink) {
      throw new ForbiddenException('GV dÃƒÂ¡Ã‚ÂºÃ‚Â¡y thay khÃƒÆ’Ã‚Â´ng Ãƒâ€žÃ¢â‚¬ËœÃƒâ€ Ã‚Â°ÃƒÂ¡Ã‚Â»Ã‚Â£c OPS cÃƒÂ¡Ã‚ÂºÃ‚Â¥p quyÃƒÂ¡Ã‚Â»Ã‚Ân tÃƒÂ¡Ã‚ÂºÃ‚Â¡o link Ãƒâ€žÃ¢â‚¬ËœiÃƒÂ¡Ã‚Â»Ã†â€™m danh');
    }

    const token = randomBytes(32).toString('hex');

    // Token hÃƒÂ¡Ã‚ÂºÃ‚Â¿t hÃƒÂ¡Ã‚ÂºÃ‚Â¡n cuÃƒÂ¡Ã‚Â»Ã¢â‚¬Ëœi ngÃƒÆ’Ã‚Â y Ãƒâ€žÃ¢â‚¬ËœiÃƒÂ¡Ã‚Â»Ã†â€™m danh (khÃƒÆ’Ã‚Â´ng phÃƒÂ¡Ã‚ÂºÃ‚Â£i cuÃƒÂ¡Ã‚Â»Ã¢â‚¬Ëœi ngÃƒÆ’Ã‚Â y hiÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¡n tÃƒÂ¡Ã‚ÂºÃ‚Â¡i)
    const tokenExpiresAt = new Date(date);
    tokenExpiresAt.setUTCDate(tokenExpiresAt.getUTCDate() + 1);
    tokenExpiresAt.setUTCMilliseconds(-1); // 23:59:59.999

    const classObjId = new Types.ObjectId(dto.classId);
    const studentObjId = new Types.ObjectId(dto.studentId);

    const finalizedSession = await this.findFinalizedSessionForAttendance(
      classObjId,
      studentObjId,
      date,
    );
    if (finalizedSession) {
      throw new BadRequestException(
        'BuÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¢i hÃƒÂ¡Ã‚Â»Ã‚Âc Ãƒâ€žÃ¢â‚¬ËœÃƒÆ’Ã‚Â£ Ãƒâ€žÃ¢â‚¬ËœÃƒâ€ Ã‚Â°ÃƒÂ¡Ã‚Â»Ã‚Â£c xÃƒÆ’Ã‚Â¡c nhÃƒÂ¡Ã‚ÂºÃ‚Â­n hoÃƒÆ’Ã‚Â n thÃƒÆ’Ã‚Â nh (FINALIZED). KhÃƒÆ’Ã‚Â´ng thÃƒÂ¡Ã‚Â»Ã†â€™ tÃƒÂ¡Ã‚ÂºÃ‚Â¡o lÃƒÂ¡Ã‚ÂºÃ‚Â¡i link Ãƒâ€žÃ¢â‚¬ËœiÃƒÂ¡Ã‚Â»Ã†â€™m danh.',
      );
    }

    const existingAttendance = await this.attendanceModel.findOne({
      classId: dto.classId,
      studentId: dto.studentId,
      date,
    });

    if (existingAttendance) {
      const alreadyMarkedPresent =
        existingAttendance.attendedAt ||
        this.isCountedAttendanceStatus(existingAttendance.status);
      if (alreadyMarkedPresent) {
        throw new BadRequestException(
          'HÃƒÂ¡Ã‚Â»Ã‚Âc sinh Ãƒâ€žÃ¢â‚¬ËœÃƒÆ’Ã‚Â£ Ãƒâ€žÃ¢â‚¬ËœÃƒâ€ Ã‚Â°ÃƒÂ¡Ã‚Â»Ã‚Â£c Ãƒâ€žÃ¢â‚¬ËœiÃƒÂ¡Ã‚Â»Ã†â€™m danh cho ngÃƒÆ’Ã‚Â y nÃƒÆ’Ã‚Â y. KhÃƒÆ’Ã‚Â´ng thÃƒÂ¡Ã‚Â»Ã†â€™ tÃƒÂ¡Ã‚ÂºÃ‚Â¡o lÃƒÂ¡Ã‚ÂºÃ‚Â¡i link.',
        );
      }

      if (existingAttendance.sessionId) {
        const linkedSession = await this.sessionModel
          .findById(existingAttendance.sessionId)
          .select('status')
          .lean();
        if (
          linkedSession &&
          !['CANCELLED', 'RESCHEDULED'].includes((linkedSession as any).status)
        ) {
          throw new BadRequestException(
            'BuÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¢i hÃƒÂ¡Ã‚Â»Ã‚Âc Ãƒâ€žÃ¢â‚¬ËœÃƒÆ’Ã‚Â£ cÃƒÆ’Ã‚Â³ session Ãƒâ€žÃ¢â‚¬Ëœang hoÃƒÂ¡Ã‚ÂºÃ‚Â¡t Ãƒâ€žÃ¢â‚¬ËœÃƒÂ¡Ã‚Â»Ã¢â€žÂ¢ng. KhÃƒÆ’Ã‚Â´ng thÃƒÂ¡Ã‚Â»Ã†â€™ tÃƒÂ¡Ã‚ÂºÃ‚Â¡o lÃƒÂ¡Ã‚ÂºÃ‚Â¡i link Ãƒâ€žÃ¢â‚¬ËœiÃƒÂ¡Ã‚Â»Ã†â€™m danh.',
          );
        }
      }

      existingAttendance.teacherId = attendanceTeacherId;
      existingAttendance.status = undefined as any;
      existingAttendance.notes = '';
      existingAttendance.sessionId = undefined;
      existingAttendance.attendanceToken = token;
      existingAttendance.tokenExpiresAt = tokenExpiresAt;
      existingAttendance.imageUrl = undefined;
      existingAttendance.attendedAt = undefined;
      await existingAttendance.save();
    } else {
      await this.attendanceModel.create({
        classId: dto.classId,
        studentId: dto.studentId,
        teacherId: attendanceTeacherId,
        date,
        attendanceToken: token,
        tokenExpiresAt,
        imageUrl: null,
        attendedAt: null,
      });
    }

    const att = await this.attendanceModel
      .findOne({ classId: dto.classId, studentId: dto.studentId, date })
      .populate('studentId', 'fullName age parentName')
      .populate('classId', 'name code');

    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:4200';
    const attendanceUrl = `${baseUrl}/student-attendance/${token}`;

    return { attendance: att, attendanceUrl, token, expiresAt: tokenExpiresAt };
  }

  /** Public: LÃƒÂ¡Ã‚ÂºÃ‚Â¥y thÃƒÆ’Ã‚Â´ng tin Ãƒâ€žÃ¢â‚¬ËœiÃƒÂ¡Ã‚Â»Ã†â€™m danh tÃƒÂ¡Ã‚Â»Ã‚Â« token */
  async getAttendanceByToken(token: string) {
    const att = await this.attendanceModel
      .findOne({ attendanceToken: token })
      .populate('studentId', 'fullName age parentName')
      .populate('classId', 'name code')
      .populate('teacherId', 'fullName email')
      .lean();

    if (!att) throw new NotFoundException('Link Ãƒâ€žÃ¢â‚¬ËœiÃƒÂ¡Ã‚Â»Ã†â€™m danh khÃƒÆ’Ã‚Â´ng hÃƒÂ¡Ã‚Â»Ã‚Â£p lÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¡');
    if (att.tokenExpiresAt && new Date() > att.tokenExpiresAt) {
      throw new BadRequestException('Link Ãƒâ€žÃ¢â‚¬ËœiÃƒÂ¡Ã‚Â»Ã†â€™m danh Ãƒâ€žÃ¢â‚¬ËœÃƒÆ’Ã‚Â£ hÃƒÂ¡Ã‚ÂºÃ‚Â¿t hÃƒÂ¡Ã‚ÂºÃ‚Â¡n');
    }
    if (att.attendedAt) {
      throw new BadRequestException('Ãƒâ€žÃ‚ÂÃƒÆ’Ã‚Â£ Ãƒâ€žÃ¢â‚¬ËœiÃƒÂ¡Ã‚Â»Ã†â€™m danh rÃƒÂ¡Ã‚Â»Ã¢â‚¬Å“i, khÃƒÆ’Ã‚Â´ng thÃƒÂ¡Ã‚Â»Ã†â€™ Ãƒâ€žÃ¢â‚¬ËœiÃƒÂ¡Ã‚Â»Ã†â€™m danh lÃƒÂ¡Ã‚ÂºÃ‚Â¡i');
    }
    return att;
  }

  /** Public: HÃƒÂ¡Ã‚Â»Ã‚Âc sinh submit Ãƒâ€žÃ¢â‚¬ËœiÃƒÂ¡Ã‚Â»Ã†â€™m danh qua link (chÃƒÂ¡Ã‚Â»Ã‚Â¥p ÃƒÂ¡Ã‚ÂºÃ‚Â£nh webcam) */
  async submitStudentAttendance(dto: StudentAttendanceDto) {
    const attendance = await this.attendanceModel.findOne({
      attendanceToken: dto.token,
    });
    if (!attendance) throw new NotFoundException('Link Ãƒâ€žÃ¢â‚¬ËœiÃƒÂ¡Ã‚Â»Ã†â€™m danh khÃƒÆ’Ã‚Â´ng hÃƒÂ¡Ã‚Â»Ã‚Â£p lÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¡');
    if (attendance.tokenExpiresAt && new Date() > attendance.tokenExpiresAt) {
      throw new BadRequestException('Link Ãƒâ€žÃ¢â‚¬ËœiÃƒÂ¡Ã‚Â»Ã†â€™m danh Ãƒâ€žÃ¢â‚¬ËœÃƒÆ’Ã‚Â£ hÃƒÂ¡Ã‚ÂºÃ‚Â¿t hÃƒÂ¡Ã‚ÂºÃ‚Â¡n');
    }
    if (attendance.attendedAt) {
      throw new BadRequestException('Ãƒâ€žÃ‚ÂÃƒÆ’Ã‚Â£ Ãƒâ€žÃ¢â‚¬ËœiÃƒÂ¡Ã‚Â»Ã†â€™m danh rÃƒÂ¡Ã‚Â»Ã¢â‚¬Å“i');
    }

    // Validate and process image with security checks (5MB limit to match multer config)
    const imageData = validateAndProcessBase64Image(
      dto.imageBase64,
      5, // 5MB max
      `attendance_${attendance._id}`,
    );

    const uploadsDir = join(process.cwd(), 'uploads', 'attendance');
    await mkdir(uploadsDir, { recursive: true });
    await writeFile(join(uploadsDir, imageData.filename), imageData.buffer);

    // Update attendance
    attendance.status = AttendanceStatus.PRESENT;
    attendance.imageUrl = `/uploads/attendance/${imageData.filename}`;
    attendance.attendedAt = new Date();
    await attendance.save();

    // Create session for this PRESENT attendance (same bridge logic)
    const classroom = await this.classModel
      .findById(attendance.classId)
      .lean<ClassLean>();
    if (classroom) {
      const sid = await this.syncSessionForAttendance({
        classId: attendance.classId,
        studentId: attendance.studentId,
        teacherId: attendance.teacherId,
        date: attendance.date,
        classroom,
      });
      if (sid) {
        attendance.sessionId = sid;
        await attendance.save();
      }

      await this.syncTrialUsage(attendance.classId, attendance.studentId);

      if ((classroom as any).classMode === ClassMode.OFFLINE) {
        await this.recomputeOfflineTeacherPayoutForDay({
          classId: attendance.classId,
          date: attendance.date,
          classroom,
        });
      }
    }

    return this.attendanceModel
      .findById(attendance._id)
      .populate('studentId', 'fullName age parentName')
      .populate('classId', 'name code')
      .populate('teacherId', 'fullName email')
      .lean();
  }

  // ÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚Â
  // REPORTS
  // ÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚Â

  async getAttendanceReport(
    startDate: string,
    endDate: string,
    classId?: string,
    actor?: JwtPayload,
    page: number = 1,
    limit: number = 20,
  ) {
    const start = normalizeDate(startDate);
    const end = normalizeDate(endDate);
    end.setUTCHours(23, 59, 59, 999);

    const filter: any = {
      date: { $gte: start, $lte: end },
      status: { $in: [...COUNTED_ATTENDANCE_STATUSES] },
    };
    if (classId) {
      if (!Types.ObjectId.isValid(classId)) {
        throw new BadRequestException('classId khong hop le');
      }
      filter.classId = new Types.ObjectId(classId);
    }
    if (actor?.role === Role.TEACHER) {
      filter.teacherId = new Types.ObjectId(this.getUserId(actor));
    }

    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.attendanceModel
        .find(filter)
        .populate('studentId', 'fullName age parentName faceImage studentCode totalPurchasedSessions')
        .populate('classId', 'name code')
        .populate('teacherId', 'fullName email')
        .sort({ date: -1, attendedAt: -1, updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.attendanceModel.countDocuments(filter),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  // ÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚Â
  // CLASS LISTING FOR TEACHER (from Classes collection)
  // ÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚Â

  async getTeacherClassAssignments(user: JwtPayload) {
    if (!this.isTeacher(user)) {
      throw new ForbiddenException('ChÃƒÂ¡Ã‚Â»Ã¢â‚¬Â° giÃƒÆ’Ã‚Â¡o viÃƒÆ’Ã‚Âªn mÃƒÂ¡Ã‚Â»Ã¢â‚¬Âºi sÃƒÂ¡Ã‚Â»Ã‚Â­ dÃƒÂ¡Ã‚Â»Ã‚Â¥ng chÃƒÂ¡Ã‚Â»Ã‚Â©c nÃƒâ€žÃ†â€™ng nÃƒÆ’Ã‚Â y');
    }

    const teacherId = new Types.ObjectId(this.getUserId(user));
    const classes = await this.classModel
      .find({
        $or: [
          { teacher: teacherId },
          { 'substituteTeachers.teacherId': teacherId },
          { 'studentConfigs.teacherSlots.teacherId': teacherId },
        ],
      })
      .populate('students', 'fullName age parentName studentCode parentPhone')
      .lean();

    return classes
      .map((cls: any) => {
        const visibleStudentIds = this.getVisibleStudentIdsForTeacher(
          cls as ClassLean,
          teacherId.toString(),
          true,
        );
        const students = (cls.students || [])
          .filter((student: any) => visibleStudentIds.has(student?._id?.toString?.() || ''))
          .map((student: any) => ({
            studentId: student._id.toString(),
            fullName: student.fullName || '',
            studentCode: student.studentCode || '',
            age: student.age,
            parentName: student.parentName || '',
            parentPhone: student.parentPhone || '',
          }))
          .sort((left: any, right: any) =>
            left.fullName.localeCompare(right.fullName, 'vi', { sensitivity: 'base' }),
          );

        if (!students.length) {
          return null;
        }

        return {
          classId: cls._id.toString(),
          classCode: cls.code || '',
          className: cls.name || `LÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»ÃƒÂ¢Ã¢â€šÂ¬Ã‚Âºp ${cls.code}`,
          studentCount: students.length,
          students,
        };
      })
      .filter((item): item is NonNullable<typeof item> => !!item)
      .sort((left: any, right: any) =>
        left.classCode.localeCompare(right.classCode, 'vi', { sensitivity: 'base' }),
      );

    return classes.map((cls: any) => ({
      classId: cls._id.toString(),
      classCode: cls.code || '',
      className: cls.name || `LÃƒÂ¡Ã‚Â»Ã¢â‚¬Âºp ${cls.code}`,
      studentCount: cls.students?.length || 0,
      students: (cls.students || [])
        .map((s: any) => ({
          studentId: s._id.toString(),
          fullName: s.fullName || '',
          studentCode: s.studentCode || '',
          age: s.age,
          parentName: s.parentName || '',
          parentPhone: s.parentPhone || '',
        }))
        .sort((a: any, b: any) =>
          a.fullName.localeCompare(b.fullName, 'vi', { sensitivity: 'base' }),
        ),
    })).sort((a: any, b: any) =>
      a.classCode.localeCompare(b.classCode, 'vi', { sensitivity: 'base' }),
    );
  }

  // ÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚Â
  // PARENT ENDPOINTS
  // ÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚Â

  /** PH xem lÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¹ch sÃƒÂ¡Ã‚Â»Ã‚Â­ Ãƒâ€žÃ¢â‚¬ËœiÃƒÂ¡Ã‚Â»Ã†â€™m danh cÃƒÂ¡Ã‚Â»Ã‚Â§a tÃƒÂ¡Ã‚ÂºÃ‚Â¥t cÃƒÂ¡Ã‚ÂºÃ‚Â£ con */
  async getChildrenAttendance(parentUserId: string, fromDate?: string, toDate?: string) {
    const parentObjId = new Types.ObjectId(parentUserId);
    const children = await this.studentModel
      .find({ parentUserId: parentObjId })
      .select('fullName studentCode')
      .lean();

    if (!children.length) return { children: [] };

    const childIds = children.map((c) => c._id);
    const filter: any = {
      studentId: { $in: childIds },
      status: { $exists: true, $ne: null },
    };
    const dateFilter = buildDateFilter(fromDate, toDate);
    if (dateFilter) filter.date = dateFilter;

    const records = await this.attendanceModel
      .find(filter)
      .populate('classId', 'name code')
      .sort({ date: -1 })
      .lean();

    // Group by student
    const grouped = children.map((child) => {
      const studentRecords = records.filter(
        (r) => (r as any).studentId?.toString() === child._id.toString(),
      );
      return {
        student: child,
        records: studentRecords.map((r: any) => ({
          _id: r._id,
          date: r.date,
          status: r.status,
          className: r.classId?.name || '',
          classCode: r.classId?.code || '',
          notes: r.notes || '',
          parentConfirm: r.parentConfirm,
        })),
      };
    });

    return { children: grouped };
  }

  /** PH xem thÃƒÂ¡Ã‚Â»Ã¢â‚¬Ëœng kÃƒÆ’Ã‚Âª Ãƒâ€žÃ¢â‚¬ËœiÃƒÂ¡Ã‚Â»Ã†â€™m danh tÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¢ng hÃƒÂ¡Ã‚Â»Ã‚Â£p */
  async getChildrenAttendanceStats(parentUserId: string, fromDate?: string, toDate?: string) {
    const parentObjId = new Types.ObjectId(parentUserId);
    const children = await this.studentModel
      .find({ parentUserId: parentObjId })
      .select('fullName studentCode')
      .lean();

    if (!children.length) return { children: [] };

    const childIds = children.map((c) => c._id);

    const match: any = {
      studentId: { $in: childIds },
      status: { $exists: true, $ne: null },
    };
    const dateFilter = buildDateFilter(fromDate, toDate);
    if (dateFilter) {
      match.date = dateFilter;
    }

    const stats = await this.attendanceModel.aggregate([
      { $match: match },
      {
        $group: {
          _id: { student: '$studentId', status: '$status' },
          count: { $sum: 1 },
        },
      },
    ]);

    const result = children.map((child) => {
      const childStats = stats.filter(
        (s) => s._id.student.toString() === child._id.toString(),
      );
      const total = childStats.reduce((sum, s) => sum + s.count, 0);
      const present = childStats.find((s) => s._id.status === 'PRESENT')?.count || 0;
      const absent = childStats.find((s) => s._id.status === 'ABSENT')?.count || 0;
      const late = childStats.find((s) => s._id.status === 'LATE')?.count || 0;

      return {
        student: child,
        total,
        present,
        absent,
        late,
        presentRate: total > 0 ? Math.round((present / total) * 100) : 0,
        absentRate: total > 0 ? Math.round((absent / total) * 100) : 0,
        lateRate: total > 0 ? Math.round((late / total) * 100) : 0,
      };
    });

    return { children: result };
  }

  /**
   * Load classes with students ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â for all roles.
   * Returns classes from the Classes collection with populated students.
   */
  async getClassesWithStudents(user: JwtPayload) {
    const filter: any = {};

    if (this.isTeacher(user)) {
      const teacherId = new Types.ObjectId(this.getUserId(user));
      filter.$or = [
        { teacher: teacherId },
        { 'substituteTeachers.teacherId': teacherId },
        { 'studentConfigs.teacherSlots.teacherId': teacherId },
      ];
    }

    const classes = await this.classModel
      .find(filter)
      .populate('students', 'fullName age parentName studentCode parentPhone')
      .lean();

    return classes
      .map((cls: any) => {
        const students = this.isTeacher(user)
          ? (cls.students || [])
              .filter((student: any) =>
                this.getVisibleStudentIdsForTeacher(
                  cls as ClassLean,
                  this.getUserId(user),
                  true,
                ).has(student?._id?.toString?.() || ''),
              )
          : (cls.students || []);

        const mappedStudents = students
          .map((student: any) => ({
            studentId: student._id.toString(),
            fullName: student.fullName || '',
            studentCode: student.studentCode || '',
            age: student.age,
            parentName: student.parentName || '',
            parentPhone: student.parentPhone || '',
          }))
          .sort((left: any, right: any) =>
            left.fullName.localeCompare(right.fullName, 'vi', { sensitivity: 'base' }),
          );

        if (this.isTeacher(user) && !mappedStudents.length) {
          return null;
        }

        return {
          classId: cls._id.toString(),
          classCode: cls.code || '',
          className: cls.name || `LÃƒÂ¡Ã‚Â»Ã¢â‚¬Âºp ${cls.code}`,
          studentCount: mappedStudents.length,
          students: mappedStudents,
        };
      })
      .filter((item): item is NonNullable<typeof item> => !!item)
      .sort((left: any, right: any) =>
        left.classCode.localeCompare(right.classCode, 'vi', { sensitivity: 'base' }),
      );
  }
}



