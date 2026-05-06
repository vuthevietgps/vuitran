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
import { Session, SessionDocument, SessionType } from '../sessions/schemas/session.schema';
import { Invoice, InvoiceDocument, InvoiceStatus } from '../invoices/schemas/invoice.schema';
import { dayRange } from '../common/utils/date.utils';
import { ClassLean, OFFLINE_MIN_TEACHER_PAYOUT, isCountedAttendanceStatus } from './attendance.utils';
import { getClassPricingConfigAt, getDurationForStudentAt } from '../classes/student-config.utils';

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
    effectiveAt?: Date,
  ): Promise<number> {
    const classPricing = getClassPricingConfigAt(classroom, effectiveAt);
    if (classPricing.perMinuteRate > 0) {
      return Math.round(classPricing.perMinuteRate * durationMinutes);
    }

    if (classPricing.baseDuration > 0 && classPricing.pricePerSession > 0) {
      const ratio = durationMinutes / classPricing.baseDuration;
      return Math.round(classPricing.pricePerSession * ratio);
    }

    const invoiceFilter: Record<string, unknown> = {
      studentId,
      classId,
      status: 'APPROVED',
    };
    if (effectiveAt) {
      const endOfDay = new Date(effectiveAt);
      endOfDay.setHours(23, 59, 59, 999);
      invoiceFilter['createdAt'] = { $lte: endOfDay };
    }

    const invoice = await this.invoiceModel
      .findOne({
        ...invoiceFilter,
        $or: [
          { perMinuteRate: { $gt: 0 } },
          { pricePerSession: { $gt: 0 }, referenceDuration: { $gt: 0 } },
        ],
      })
      .sort('-createdAt')
      .select('perMinuteRate referenceDuration pricePerSession')
      .lean();

    if (invoice?.perMinuteRate) {
      return Math.round(invoice.perMinuteRate * durationMinutes);
    }

    const invoiceBaseDuration = Number(invoice?.referenceDuration ?? 0);
    const invoicePricePerSession = Number(invoice?.pricePerSession ?? 0);
    if (invoiceBaseDuration > 0 && invoicePricePerSession > 0) {
      const ratio = durationMinutes / invoiceBaseDuration;
      return Math.round(invoicePricePerSession * ratio);
    }

    const fallbackBaseDuration = Number((classroom as any).baseDuration ?? 0)
      || Number((classroom as any).sessionDuration ?? 0)
      || 60;
    const fallbackPricePerSession = Number((classroom as any).pricePerSession ?? 0);
    const ratio = durationMinutes / fallbackBaseDuration;
    return Math.round(fallbackPricePerSession * ratio);
  }

  private async shouldUseApprovedTrialSession(params: {
    studentId: Types.ObjectId;
    classId: Types.ObjectId;
    effectiveAt: Date;
    mongoSession?: ClientSession;
  }): Promise<boolean> {
    const { studentId, classId, effectiveAt, mongoSession } = params;
    const endOfDay = new Date(effectiveAt);
    endOfDay.setHours(23, 59, 59, 999);

    let query = this.invoiceModel
      .findOne({
        studentId,
        classId,
        status: InvoiceStatus.APPROVED,
        trialSessionsRemaining: { $gt: 0 },
        createdAt: { $lte: endOfDay },
      })
      .select(
        'trialSessionsRemaining sessionsRemaining bonusSessionsRemaining amount pricePerSession',
      )
      .sort({ paymentDate: 1, createdAt: 1 });
    if (mongoSession) {
      query = query.session(mongoSession);
    }

    const invoice = await query.lean();
    if (!invoice) {
      return false;
    }

    const paidSessionsRemaining = Number((invoice as any)?.sessionsRemaining ?? 0);
    const bonusSessionsRemaining = Number((invoice as any)?.bonusSessionsRemaining ?? 0);
    const amount = Number((invoice as any)?.amount ?? 0);

    return paidSessionsRemaining <= 0
      && bonusSessionsRemaining <= 0
      && amount <= 0;
  }

  private resolveDurationMinutes(
    classroom: ClassLean,
    studentId: Types.ObjectId,
    effectiveAt: Date,
  ): number {
    const studentDuration = getDurationForStudentAt(
      classroom,
      studentId.toString(),
      effectiveAt,
    );
    if (Number(studentDuration.sessionDuration) > 0) {
      return Number(studentDuration.sessionDuration);
    }

    const classPricing = getClassPricingConfigAt(classroom, effectiveAt);
    if (Number(classPricing.sessionDuration) > 0) {
      return Number(classPricing.sessionDuration);
    }

    return Number((classroom as any).sessionDuration ?? 0)
      || Number((classroom as any).baseDuration ?? 0)
      || 60;
  }

  private resolveTeacherPayout(
    classroom: ClassLean,
    effectiveAt: Date,
    durationMinutes: number,
    substitutePayRate?: number,
  ): number {
    if (substitutePayRate !== undefined) {
      return substitutePayRate;
    }

    const classPricing = getClassPricingConfigAt(classroom, effectiveAt);
    if ((classroom as any).classMode === ClassMode.OFFLINE) {
      return Number(classPricing.teacherPayPerStudent ?? 0);
    }

    const referenceDuration = Number(classPricing.baseDuration ?? 0) || 60;
    const teacherPayPerSession = Number(classPricing.teacherPayPerSession ?? 0);
    if (referenceDuration > 0 && teacherPayPerSession > 0) {
      return Math.round((teacherPayPerSession * durationMinutes) / referenceDuration);
    }

    return Number((classroom as any).teacherPayPerSession ?? 0);
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

    const classPricing = getClassPricingConfigAt(classroom, date);
    const perStudentTeacherPay = Number(classPricing.teacherPayPerStudent ?? 0);

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
      const duration = this.resolveDurationMinutes(classroom, studentId, date);
      const teacherPayout = this.resolveTeacherPayout(
        classroom,
        date,
        duration,
        substitutePayRate,
      );
      const isApprovedTrialSession = await this.shouldUseApprovedTrialSession({
        studentId,
        classId,
        effectiveAt: date,
        mongoSession,
      });

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
          if (Number(existingSession.durationMinutes ?? 0) !== Number(duration)) {
            existingSession.durationMinutes = duration;
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
          if (Number(existingSession.durationMinutes ?? 0) !== Number(duration)) {
            existingSession.durationMinutes = duration;
            shouldSave = true;
          }
          if (Number(existingSession.teacherPayout ?? 0) !== Number(teacherPayout)) {
            existingSession.teacherPayout = teacherPayout;
            shouldSave = true;
          }
        }

        if (isApprovedTrialSession && !existingSession.trialEnrollmentId) {
          if (existingSession.sessionType !== SessionType.TRIAL) {
            existingSession.sessionType = SessionType.TRIAL as any;
            shouldSave = true;
          }
          if (existingSession.trialTeacherPaidOnly) {
            existingSession.trialTeacherPaidOnly = false;
            shouldSave = true;
          }
          if ((existingSession as any).trialRejectedNoPay) {
            (existingSession as any).trialRejectedNoPay = false;
            shouldSave = true;
          }
        }

        const refreshedAmountCharged = await this.resolveAmountCharged(
          studentId,
          classId,
          duration,
          classroom,
          date,
        );
        if (Number(existingSession.amountCharged ?? 0) !== Number(refreshedAmountCharged)) {
          existingSession.amountCharged = refreshedAmountCharged;
          shouldSave = true;
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
        date,
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
              sessionType: isApprovedTrialSession ? SessionType.TRIAL : SessionType.REGULAR,
              scheduledDate: date,
              durationMinutes: duration,
              sessionNumber,
              amountCharged,
              teacherPayout,
              trialConverted: false,
              trialTeacherPaidOnly: false,
              trialRejectedNoPay: false,
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
            if (isApprovedTrialSession && !cancelled.trialEnrollmentId) {
              cancelled.sessionType = SessionType.TRIAL as any;
              cancelled.trialConverted = false;
              cancelled.trialTeacherPaidOnly = false;
              (cancelled as any).trialRejectedNoPay = false;
            }
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
      const resolvedSessionDuration = isPresent
        ? this.resolveDurationMinutes(classroom, studentObjectId, date)
        : null;

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
        update.$set.sessionDuration = resolvedSessionDuration;
      } else {
        update.$unset = { sessionId: 1, sessionDuration: 1 };
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
