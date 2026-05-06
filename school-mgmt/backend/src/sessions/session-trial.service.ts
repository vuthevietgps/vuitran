import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import {
  Session,
  SessionDocument,
  SessionStatus,
  SessionType,
} from './schemas/session.schema';
import {
  Classroom,
  ClassDocument,
  ClassMode,
} from '../classes/schemas/class.schema';
import { PayrollTransactionService } from '../payroll/payroll-transaction.service';
import { SessionSettlementService } from './session-settlement.service';

const TRIAL_AUTO_DECIDE_DAYS = 7;

@Injectable()
export class SessionTrialService {
  private readonly logger = new Logger(SessionTrialService.name);

  constructor(
    @InjectModel(Session.name) private readonly sessionModel: Model<SessionDocument>,
    @InjectModel(Classroom.name) private readonly classModel: Model<ClassDocument>,
    private readonly payrollTxService: PayrollTransactionService,
    private readonly sessionSettlementService: SessionSettlementService,
  ) {}

  async autoDecideOrphanTrialSessions(): Promise<void> {
    this.logger.debug(
      `Skip auto-deciding orphan trial sessions after ${TRIAL_AUTO_DECIDE_DAYS} days; awaiting explicit trial decision`,
    );
  }

  async convertTrialSessions(
    studentId: string,
    classId: string,
  ): Promise<{ converted: number; deducted: number }> {
    await this.ensureOfflineTrialClass(classId);

    const trialSessions = await this.sessionModel.find({
      studentId: new Types.ObjectId(studentId),
      classId: new Types.ObjectId(classId),
      sessionType: SessionType.TRIAL,
      trialConverted: false,
      status: { $nin: [SessionStatus.CANCELLED, SessionStatus.RESCHEDULED] },
    });

    let converted = 0;
    let deducted = 0;

    for (const session of trialSessions) {
      session.trialConverted = true;
      session.trialTeacherPaidOnly = false;
      (session as any).trialRejectedNoPay = false;
      await session.save();
      converted++;

      if (session.status !== SessionStatus.FINALIZED) {
        continue;
      }

      await this.sessionSettlementService.settleFinalizedSession(session);
      const reloaded = await this.sessionModel.findById(session._id).lean();
      if (reloaded?.isPaid) deducted++;
    }

    this.logger.log(
      `Trial conversion: student ${studentId} class ${classId} -> ${converted} sessions converted, ${deducted} wallet deductions`,
    );

    return { converted, deducted };
  }

  async markTrialRejectedNoPay(
    studentId: string,
    classId: string,
    actorUserId?: string,
  ): Promise<{ updated: number; excludedPayroll: number }> {
    await this.ensureOfflineTrialClass(classId);

    const trialSessions = await this.sessionModel.find({
      studentId: new Types.ObjectId(studentId),
      classId: new Types.ObjectId(classId),
      sessionType: SessionType.TRIAL,
      trialConverted: false,
      trialRejectedNoPay: false,
    });

    let updated = 0;
    let excludedPayroll = 0;
    for (const session of trialSessions) {
      session.trialTeacherPaidOnly = false;
      (session as any).trialRejectedNoPay = true;
      session.isTeacherPaid = false;
      await session.save();
      updated++;

      if (actorUserId) {
        try {
          await this.payrollTxService.excludeFromPayroll(
            session._id.toString(),
            actorUserId,
            'Hoc thu khong chuyen doi thanh hoc vien chinh thuc',
          );
          excludedPayroll++;
        } catch (error) {
          const message = this.extractErrorMessage(error);
          if (!message.includes('PayrollTransaction not found')) {
            this.logger.warn(
              `Failed to exclude payroll for rejected trial session ${session._id}: ${message}`,
            );
          }
        }
      }
    }

    this.logger.log(
      `Trial rejected-no-pay: student ${studentId} class ${classId} -> ${updated} sessions, ${excludedPayroll} payroll exclusions`,
    );

    return { updated, excludedPayroll };
  }

  async markTrialTeacherPaidOnly(
    studentId: string,
    classId: string,
    actorUserId?: string,
  ): Promise<{ updated: number; excludedPayroll: number }> {
    this.logger.warn(
      `Trial teacher-paid-only is disabled by business rule: student ${studentId} class ${classId} actor ${actorUserId || 'unknown'}`,
    );
    throw new BadRequestException(
      'Hoc thu khong ho tro che do tra luong GV rieng; neu khong hoc tiep thi giao vien khong duoc tinh luong',
    );
  }

  private async ensureOfflineTrialClass(classId: string): Promise<void> {
    const classroom = await this.classModel.findById(classId).select('classMode').lean();
    if (!classroom) {
      throw new NotFoundException('Lop hoc khong ton tai');
    }
    if ((classroom as any).classMode !== ClassMode.OFFLINE) {
      throw new BadRequestException('Hoc thu chi ap dung cho lop OFFLINE');
    }
  }

  private extractErrorMessage(err: unknown): string {
    if (typeof err === 'string') return err;
    if (err instanceof Error) return err.message;
    if (err && typeof (err as any).message === 'string') {
      return (err as any).message;
    }
    return 'Unknown error';
  }
}
