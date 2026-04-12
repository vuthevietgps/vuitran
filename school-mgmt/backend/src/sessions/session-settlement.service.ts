import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
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
} from '../classes/schemas/class.schema';
import {
  Student,
  StudentDocument,
} from '../students/schemas/student.schema';
import {
  Invoice,
  InvoiceDocument,
  InvoiceStatus,
} from '../invoices/schemas/invoice.schema';
import { WalletsService } from '../wallets/wallets.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  NotificationPriority,
  NotificationType,
} from '../notifications/schemas/notification.schema';
import { Role } from '../common/interfaces/role.enum';
import { getClassPricingConfigAt } from '../classes/student-config.utils';

@Injectable()
export class SessionSettlementService {
  private readonly logger = new Logger(SessionSettlementService.name);

  constructor(
    @InjectModel(Session.name) private readonly sessionModel: Model<SessionDocument>,
    @InjectModel(Classroom.name) private readonly classModel: Model<ClassDocument>,
    @InjectModel(Student.name) private readonly studentModel: Model<StudentDocument>,
    @InjectModel(Invoice.name) private readonly invoiceModel: Model<InvoiceDocument>,
    @Inject(forwardRef(() => WalletsService))
    private readonly walletsService: WalletsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async settleFinalizedSession(session: SessionDocument): Promise<void> {
    if (session.status !== SessionStatus.FINALIZED) {
      return;
    }

    await this.ensureSessionParentUserId(session);

    const bonusSession = await this.tryMarkBonusSession(session);
    const sessionToSettle = bonusSession || session;

    if (!sessionToSettle.isBonusSession) {
      await this.deductWalletForSession(sessionToSettle);
    }

    await this.applyInvoiceConsumptionForSession(sessionToSettle._id as Types.ObjectId);
  }

  async applyInvoiceConsumptionForSession(
    sessionId: string | Types.ObjectId,
  ): Promise<void> {
    const sid = typeof sessionId === 'string' ? new Types.ObjectId(sessionId) : sessionId;

    const claim = await this.sessionModel
      .findOneAndUpdate(
        {
          _id: sid,
          status: SessionStatus.FINALIZED,
          invoiceConsumptionApplied: false,
          $and: [
            {
              $or: [
                { isPaid: true, amountCharged: { $gt: 0 } },
                { isBonusSession: true, referenceAmountCharged: { $gt: 0 } },
              ],
            },
            {
              $or: [
                { sessionType: { $ne: SessionType.TRIAL } },
                { trialConverted: true },
              ],
            },
          ],
        },
        { $set: { invoiceConsumptionApplied: true } },
        { new: true },
      )
      .select('_id studentId classId amountCharged referenceAmountCharged isBonusSession sessionType')
      .lean();

    if (!claim) return;

    const isBonusSession = !!(claim as any).isBonusSession;
    const coverageAmount = this.getSessionCoverageAmount(claim);
    const resetPayload = this.buildInvoiceConsumptionReset();

    if (coverageAmount <= 0) {
      await this.sessionModel.updateOne({ _id: sid }, resetPayload);
      return;
    }

    let allowanceField: 'sessionsRemaining' | 'bonusSessionsRemaining' | 'trialSessionsRemaining' =
      isBonusSession ? 'bonusSessionsRemaining' : 'sessionsRemaining';
    let allowanceLabel = isBonusSession ? 'bonus sessions' : 'remaining sessions';
    if ((claim as any).sessionType === SessionType.TRIAL) {
      allowanceField = 'trialSessionsRemaining';
      allowanceLabel = 'trial sessions';
    }

    try {
      const consumptionResult = await this.consumeInvoiceAllowanceForAmount(
        claim,
        allowanceField,
      );

      if (consumptionResult.consumedAmount <= 0) {
        await this.sessionModel.updateOne({ _id: sid }, resetPayload);
        this.logger.warn(
          `Invoice consumption skipped: no APPROVED invoice with ${allowanceLabel} for session ${sid.toString()}`,
        );
        return;
      }

      await this.sessionModel.updateOne(
        { _id: sid },
        isBonusSession
          ? {
              $set: {
                bonusInvoiceId: consumptionResult.primaryInvoiceId || undefined,
                consumedBonusUnits: consumptionResult.consumedUnits,
                consumedBonusAmount: consumptionResult.consumedAmount,
                consumedInvoiceUnits: 0,
                consumedInvoiceAmount: 0,
              },
              $unset: { consumedInvoiceId: 1 },
            }
          : {
              $set: {
                consumedInvoiceId: consumptionResult.primaryInvoiceId || undefined,
                consumedInvoiceUnits: consumptionResult.consumedUnits,
                consumedInvoiceAmount: consumptionResult.consumedAmount,
                consumedBonusUnits: 0,
                consumedBonusAmount: 0,
              },
              $unset: { bonusInvoiceId: 1 },
            },
      );

      if (consumptionResult.remainingAmount > 0) {
        this.logger.warn(
          `Invoice consumption partial for session ${sid.toString()}: consumed ${Math.round(consumptionResult.consumedAmount)} / ${Math.round(coverageAmount)}`,
        );
      }
    } catch (err) {
      await this.sessionModel.updateOne({ _id: sid }, resetPayload);
      this.logger.warn(
        `Invoice consumption failed for session ${sid.toString()}: ${this.extractErrorMessage(err)}`,
      );
    }
  }

  private objectIdToString(value: any): string | null {
    if (!value) return null;
    if (typeof value === 'string') return value;
    if (value instanceof Types.ObjectId) return value.toString();
    if (value?._id) return this.objectIdToString(value._id);
    if (typeof value.toString === 'function') {
      const str = value.toString();
      return str && str !== '[object Object]' ? str : null;
    }
    return null;
  }

  private toSafeNumber(value: unknown, fallback = 0): number {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  private roundTo2(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private extractErrorMessage(err: unknown): string {
    if (typeof err === 'string') return err;
    if (err instanceof Error) return err.message;
    if (err && typeof (err as any).message === 'string') {
      return (err as any).message;
    }
    return 'Unknown error';
  }

  private normalizeText(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }

  private isWalletInsufficientError(err: unknown): boolean {
    const normalized = this.normalizeText(this.extractErrorMessage(err));
    return (
      normalized.includes('gioi han no') ||
      normalized.includes('can nap them tien') ||
      normalized.includes('insufficient') ||
      normalized.includes('not enough')
    );
  }

  private resolveClassPricing(classroom: any): {
    referenceDuration: number;
    pricePerSession: number;
    teacherPayPerSession: number;
  } {
    const pricing = getClassPricingConfigAt(classroom);
    const referenceDuration = this.toSafeNumber(pricing.baseDuration, 60) || 60;
    const pricePerSession = this.toSafeNumber(pricing.pricePerSession, 0);
    const teacherPayPerSession = this.toSafeNumber(pricing.teacherPayPerSession, 0);
    return { referenceDuration, pricePerSession, teacherPayPerSession };
  }

  private async resolveParentUserIdForSession(session: {
    parentUserId?: any;
    studentId: any;
  }): Promise<string | null> {
    const direct = this.objectIdToString(session.parentUserId);
    if (direct) return direct;

    const student = await this.studentModel
      .findById(session.studentId)
      .select('parentUserId')
      .lean();
    return this.objectIdToString((student as any)?.parentUserId);
  }

  private async ensureSessionParentUserId(session: SessionDocument): Promise<string | null> {
    const existingParentUserId = this.objectIdToString(session.parentUserId);
    if (existingParentUserId) {
      return existingParentUserId;
    }

    const resolvedParentUserId = await this.resolveParentUserIdForSession({
      parentUserId: session.parentUserId,
      studentId: session.studentId,
    });
    if (!resolvedParentUserId || !Types.ObjectId.isValid(resolvedParentUserId)) {
      return resolvedParentUserId;
    }

    const parentObjectId = new Types.ObjectId(resolvedParentUserId);
    session.parentUserId = parentObjectId as any;
    await this.sessionModel.updateOne(
      { _id: session._id },
      { $set: { parentUserId: parentObjectId } },
    );

    return resolvedParentUserId;
  }

  private getSessionCoverageAmount(session: any): number {
    const referenceAmount = this.toSafeNumber(session?.referenceAmountCharged, 0);
    if (referenceAmount > 0) {
      return referenceAmount;
    }
    return this.toSafeNumber(session?.amountCharged, 0);
  }

  private buildInvoiceConsumptionReset() {
    return {
      $set: {
        invoiceConsumptionApplied: false,
        consumedInvoiceUnits: 0,
        consumedInvoiceAmount: 0,
        consumedBonusUnits: 0,
        consumedBonusAmount: 0,
      },
      $unset: {
        consumedInvoiceId: 1,
        bonusInvoiceId: 1,
      },
    };
  }

  private async hasInvoiceCoverageForAmount(
    session: SessionDocument,
    allowanceField: 'sessionsRemaining' | 'bonusSessionsRemaining' | 'trialSessionsRemaining',
  ): Promise<boolean> {
    const coverageAmount = this.getSessionCoverageAmount(session);
    if (coverageAmount <= 0) {
      return false;
    }

    let remainingAmount = coverageAmount;
    const invoices = await this.invoiceModel
      .find({
        studentId: session.studentId,
        classId: session.classId,
        status: InvoiceStatus.APPROVED,
        [allowanceField]: { $gt: 0 },
      })
      .sort({ paymentDate: 1, createdAt: 1 })
      .select(`_id ${allowanceField} pricePerSession`)
      .lean();

    for (const invoice of invoices) {
      if (remainingAmount <= 0) {
        break;
      }

      const pricePerSession = this.toSafeNumber((invoice as any).pricePerSession, 0);
      const remainingUnits = this.toSafeNumber((invoice as any)[allowanceField], 0);
      if (pricePerSession <= 0 || remainingUnits <= 0) {
        continue;
      }

      const amountCovered = Math.min(
        remainingAmount,
        this.roundTo2(remainingUnits * pricePerSession),
      );
      if (amountCovered <= 0) {
        continue;
      }

      remainingAmount = Math.max(0, this.roundTo2(remainingAmount - amountCovered));
    }

    return remainingAmount <= 0;
  }

  private async tryMarkBonusSession(session: SessionDocument): Promise<SessionDocument | null> {
    if (!session.parentUserId || session.isPaid || session.isBonusSession) {
      return null;
    }

    if (session.sessionType === SessionType.TRIAL && !session.trialConverted) {
      return null;
    }

    const coverageAmount = this.getSessionCoverageAmount(session);
    if (coverageAmount <= 0) {
      return null;
    }

    const hasPaidCoverage = await this.hasInvoiceCoverageForAmount(session, 'sessionsRemaining');
    if (hasPaidCoverage) {
      return null;
    }

    const hasBonusCoverage = await this.hasInvoiceCoverageForAmount(session, 'bonusSessionsRemaining');
    if (!hasBonusCoverage) {
      return null;
    }

    const updated = await this.sessionModel.findOneAndUpdate(
      {
        _id: session._id,
        status: SessionStatus.FINALIZED,
        isPaid: false,
        isBonusSession: false,
      },
      {
        $set: {
          isBonusSession: true,
          amountCharged: 0,
          referenceAmountCharged: coverageAmount,
        },
        $unset: {
          walletDeductError: 1,
          walletDeductAlertSentAt: 1,
        },
      },
      { new: true },
    );

    if (updated) {
      this.logger.log(`Session ${session._id} marked as complimentary bonus session`);
    }

    return updated;
  }

  private async consumeInvoiceAllowanceForAmount(
    claim: any,
    allowanceField: 'sessionsRemaining' | 'bonusSessionsRemaining' | 'trialSessionsRemaining',
  ): Promise<{
    primaryInvoiceId: Types.ObjectId | null;
    consumedUnits: number;
    consumedAmount: number;
    remainingAmount: number;
  }> {
    const coverageAmount = this.getSessionCoverageAmount(claim);
    let remainingAmount = coverageAmount;
    let consumedAmount = 0;
    let consumedUnits = 0;
    let primaryInvoiceId: Types.ObjectId | null = null;

    const invoices = await this.invoiceModel
      .find({
        studentId: claim.studentId,
        classId: claim.classId,
        status: InvoiceStatus.APPROVED,
        [allowanceField]: { $gt: 0 },
      })
      .sort({ paymentDate: 1, createdAt: 1 })
      .select(`_id ${allowanceField} pricePerSession`)
      .lean();

    if (!invoices.length) {
      return { primaryInvoiceId, consumedUnits, consumedAmount, remainingAmount };
    }

    for (const inv of invoices) {
      if (remainingAmount <= 0) {
        break;
      }

      const pricePerSession = this.toSafeNumber((inv as any).pricePerSession, 0);
      const invoiceRemaining = this.toSafeNumber((inv as any)[allowanceField], 0);
      if (pricePerSession <= 0 || invoiceRemaining <= 0) {
        continue;
      }

      let unitsToConsume = this.roundTo2(
        Math.min(invoiceRemaining, remainingAmount / pricePerSession),
      );
      if (unitsToConsume <= 0) {
        continue;
      }

      let updateResult = await this.invoiceModel.updateOne(
        { _id: (inv as any)._id, [allowanceField]: { $gte: unitsToConsume } },
        { $inc: { [allowanceField]: -unitsToConsume } },
      );

      if (!updateResult.modifiedCount) {
        const latestInvoice = await this.invoiceModel
          .findById((inv as any)._id)
          .select(allowanceField)
          .lean();
        const latestRemaining = this.toSafeNumber((latestInvoice as any)?.[allowanceField], 0);
        const fallbackUnits = this.roundTo2(Math.min(latestRemaining, unitsToConsume));
        if (fallbackUnits <= 0) {
          continue;
        }

        updateResult = await this.invoiceModel.updateOne(
          { _id: (inv as any)._id, [allowanceField]: { $gte: fallbackUnits } },
          { $inc: { [allowanceField]: -fallbackUnits } },
        );
        if (!updateResult.modifiedCount) {
          continue;
        }
        unitsToConsume = fallbackUnits;
      }

      const amountToConsume = Math.min(
        remainingAmount,
        this.roundTo2(unitsToConsume * pricePerSession),
      );
      if (amountToConsume <= 0) {
        continue;
      }

      if (!primaryInvoiceId) {
        primaryInvoiceId = (inv as any)._id as Types.ObjectId;
      }
      consumedAmount += amountToConsume;
      consumedUnits += unitsToConsume;
      remainingAmount = Math.max(0, this.roundTo2(remainingAmount - amountToConsume));
    }

    return {
      primaryInvoiceId,
      consumedUnits: this.roundTo2(consumedUnits),
      consumedAmount: Math.round(consumedAmount),
      remainingAmount,
    };
  }

  private async deductWalletForSession(session: SessionDocument): Promise<void> {
    if (!session.parentUserId || session.isPaid || session.isBonusSession || session.amountCharged <= 0) {
      return;
    }

    if (session.sessionType === SessionType.TRIAL && !session.trialConverted) {
      this.logger.log(
        `Session ${session._id} is TRIAL (not converted) - skipping wallet deduction, teacher will still be paid`,
      );
      return;
    }

    const updated = await this.sessionModel.findOneAndUpdate(
      { _id: session._id, isPaid: false },
      { $set: { isPaid: true } },
      { new: true },
    );

    if (!updated) {
      this.logger.log(`Session ${session._id} already paid, skipping deduction`);
      return;
    }

    let classroom: any | null = null;

    try {
      classroom = await this.classModel
        .findById(session.classId)
        .select('pricePerSession pricingSnapshot sale code')
        .lean();
      const pricePerSessionForDebtLimit = this.resolveClassPricing(classroom).pricePerSession;

      await this.walletsService.deductForSession({
        parentUserId: session.parentUserId.toString(),
        sessionId: (session._id as Types.ObjectId).toString(),
        classId: session.classId.toString(),
        studentId: session.studentId.toString(),
        amount: session.amountCharged,
        pricePerSession: pricePerSessionForDebtLimit,
      });

      await this.sessionModel.updateOne(
        { _id: session._id },
        { $unset: { walletDeductError: 1 } },
      );
    } catch (err) {
      const errorMessage = this.extractErrorMessage(err);
      const shouldNotify =
        this.isWalletInsufficientError(err) && !updated.walletDeductAlertSentAt;

      const rollbackPayload: Record<string, unknown> = {
        isPaid: false,
        walletDeductError: errorMessage,
      };
      if (shouldNotify) {
        rollbackPayload.walletDeductAlertSentAt = new Date();
      }

      await this.sessionModel.updateOne(
        { _id: session._id },
        { $set: rollbackPayload },
      );

      if (shouldNotify) {
        await this.notifyWalletLowBalance(updated, classroom, errorMessage);
      }

      this.logger.warn(
        `Wallet deduct failed for session ${session._id}: ${errorMessage}`,
      );
    }
  }

  private async notifyWalletLowBalance(
    session: SessionDocument,
    classroom: any | null,
    reason: string,
  ): Promise<void> {
    try {
      const student = await this.studentModel
        .findById(session.studentId)
        .select('fullName saleId parentUserId')
        .lean();

      const parentId =
        this.objectIdToString(session.parentUserId) ||
        this.objectIdToString((student as any)?.parentUserId);
      if (!parentId) return;

      const saleId =
        this.objectIdToString(classroom?.sale) ||
        this.objectIdToString((student as any)?.saleId);
      const sessionId = this.objectIdToString(session._id) || '';
      const classCode = classroom?.code ? `${classroom.code}` : '';
      const studentName = (student as any)?.fullName || 'Hoc sinh';
      const amount = this.toSafeNumber(session.amountCharged, 0).toLocaleString('vi-VN');
      const parentMessage = classCode
        ? `Vi khong du so du de tru ${amount}d cho buoi hoc lop ${classCode}. Vui long nap them tien.`
        : `Vi khong du so du de tru ${amount}d cho buoi hoc. Vui long nap them tien.`;

      await this.notificationsService.create({
        recipientId: parentId,
        recipientRole: Role.PARENT,
        type: NotificationType.WALLET_LOW_BALANCE,
        priority: NotificationPriority.HIGH,
        title: 'Vi khong du so du',
        message: parentMessage,
        targetId: sessionId,
        targetModule: 'SESSIONS',
      });

      if (saleId && saleId !== parentId) {
        const saleMessage = classCode
          ? `${studentName} (lop ${classCode}) khong du so du vi cho buoi hoc ${amount}d. Sale can lien he ho tro.`
          : `${studentName} khong du so du vi cho buoi hoc ${amount}d. Sale can lien he ho tro.`;

        await this.notificationsService.create({
          recipientId: saleId,
          recipientRole: Role.SALE,
          type: NotificationType.WALLET_LOW_BALANCE,
          priority: NotificationPriority.HIGH,
          title: 'Can cham soc nap vi',
          message: saleMessage,
          targetId: sessionId,
          targetModule: 'SESSIONS',
        });
      }
    } catch (notifyErr) {
      this.logger.warn(
        `Failed to send low wallet notifications for session ${session._id}: ${this.extractErrorMessage(notifyErr)}`,
      );
      this.logger.debug(`Low wallet reason: ${reason}`);
    }
  }
}
