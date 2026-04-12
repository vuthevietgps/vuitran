import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectModel, InjectConnection } from '@nestjs/mongoose';
import { Model, Types, Connection, ClientSession } from 'mongoose';
import {
  Attendance,
  AttendanceDocument,
  AttendanceStatus,
  COUNTED_ATTENDANCE_STATUSES,
} from './schemas/attendance.schema';
import { Classroom, ClassDocument, ClassMode } from '../classes/schemas/class.schema';
import { Student, StudentDocument } from '../students/schemas/student.schema';
import { Session, SessionDocument } from '../sessions/schemas/session.schema';
import { Invoice, InvoiceDocument } from '../invoices/schemas/invoice.schema';
import { dayRange } from '../common/utils/date.utils';
import { ClassLean, OFFLINE_MIN_TEACHER_PAYOUT, isCountedAttendanceStatus } from './attendance.utils';

@Injectable()
export class AttendanceSessionBridgeService {
  private readonly logger = new Logger(AttendanceSessionBridgeService.name);

  constructor(
    @InjectModel(Attendance.name) private readonly attendanceModel: Model<AttendanceDocument>,
    @InjectModel(Classroom.name) private readonly classModel: Model<ClassDocument>,
    @InjectModel(Student.name) private readonly studentModel: Model<StudentDocument>,
    @InjectModel(Session.name) private readonly sessionModel: Model<SessionDocument>,
    @InjectModel(Invoice.name) private readonly invoiceModel: Model<InvoiceDocument>,
    @InjectConnection() private readonly connection: Connection,
  ) {}

  /**
   * Tính amountCharged cho 1 buổi học dựa trên per-minute rate từ Invoice.
   * Fallback sang class-level pricing nếu không có invoice.
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

    const baseDuration =
      (classroom as any).baseDuration ?? (classroom as any).sessionDuration ?? 60;
    const pricePerSession = (classroom as any).pricePerSession ?? 0;
    const ratio = durationMinutes / baseDuration;
    return Math.round(pricePerSession * ratio);
  }

  /**
   * Recompute OFFLINE teacher payout for one class/day.
   */
  async recomputeOfflineTeacherPayoutForDay(params: {
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

    const finalizedSessions = allAttendedSessions.filter(
      (s: any) => s.status === 'FINALIZED',
    );
    const updatableSessions = allAttendedSessions.filter(
      (s: any) => s.status !== 'FINALIZED',
    );

    const finalizedTotal = finalizedSessions.reduce(
      (acc: number, s: any) => acc + (Number(s.teacherPayout) || 0),
      0,
    );

    const remainingPayout = Math.max(0, totalTeacherPayout - finalizedTotal);

    if (updatableSessions.length > 0 && remainingPayout > 0) {
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

  /**
   * Create or update a Session when attendance = PRESENT / LATE (with transaction).
   */
  async syncSessionForAttendance(params: {
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
      const duration =
        (classroom as any).sessionDuration ?? (classroom as any).baseDuration ?? 60;

      let teacherPayout: number;
      if (substitutePayRate !== undefined) {
        teacherPayout = substitutePayRate;
      } else if ((classroom as any).classMode === ClassMode.OFFLINE) {
        teacherPayout = (classroom as any).teacherPayPerStudent ?? 0;
      } else {
        teacherPayout = (classroom as any).teacherPayPerSession ?? 0;
      }

      try {
        if (ownsTransaction) {
          mongoSession.startTransaction();
        }

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

        if (existingSession.status === 'SCHEDULED') {
          existingSession.status = 'TEACHER_COMPLETED' as any;
          existingSession.confirmation = existingSession.confirmation ?? ({} as any);
          existingSession.confirmation.teacherCompletedAt = new Date();
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
              sessionType: 'REGULAR',
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

  async findFinalizedSessionForAttendance(
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

  async cancelLinkedSession(
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
    if (['FINALIZED', 'CANCELLED', 'RESCHEDULED'].includes(session.status)) return;

    session.status = 'CANCELLED' as any;
    session.cancellation = {
      cancelledBy: 'SYSTEM',
      cancelReason: 'Hủy do điểm danh thay đổi thành vắng mặt/bảo lưu',
      cancelledAt: new Date(),
      refundPercent: 100,
      refundAmount: 0,
    } as any;
    await session.save(mongoSession ? { session: mongoSession } : undefined);
  }

  async clearAttendanceRecord(params: {
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

  async processOneStudent(params: {
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
      const isPresent = isCountedAttendanceStatus(status);
      let sessionId: Types.ObjectId | null = null;

      if (isPresent) {
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
}
