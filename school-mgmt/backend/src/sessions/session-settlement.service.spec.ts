import { Types } from 'mongoose';
import { SessionSettlementService } from './session-settlement.service';
import { SessionStatus, SessionType } from './schemas/session.schema';

function buildQueryChain(result: any) {
  const chain: any = {
    select: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(result),
  };
  return chain;
}

function buildService(overrides: Partial<Record<string, any>> = {}) {
  return new SessionSettlementService(
    overrides.sessionModel ?? {},
    overrides.classModel ?? {},
    overrides.studentModel ?? {},
    overrides.invoiceModel ?? {},
    overrides.walletsService ?? {},
    overrides.notificationsService ?? {},
  );
}

describe('SessionSettlementService.applyInvoiceConsumptionForSession', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('consumes trialSessionsRemaining by duration units for converted trial sessions even when they charge the parent wallet', async () => {
    const sessionId = new Types.ObjectId();
    const invoiceId = new Types.ObjectId();
    const claim = {
      _id: sessionId,
      studentId: new Types.ObjectId(),
      classId: new Types.ObjectId(),
      amountCharged: 150000,
      referenceAmountCharged: 150000,
      durationMinutes: 60,
      isBonusSession: false,
      sessionType: SessionType.TRIAL,
      trialConverted: true,
      status: SessionStatus.FINALIZED,
    };

    const sessionModel = {
      findOneAndUpdate: jest.fn().mockReturnValue(buildQueryChain(claim)),
      updateOne: jest.fn().mockResolvedValue({ acknowledged: true, modifiedCount: 1 }),
    };
    const invoiceModel = {
      find: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([
          {
            _id: invoiceId,
            trialSessionsRemaining: 1,
            referenceDuration: 60,
          },
        ]),
      }),
      updateOne: jest.fn().mockResolvedValue({ acknowledged: true, modifiedCount: 1 }),
      findById: jest.fn(),
    };

    const service = buildService({ sessionModel, invoiceModel });

    await service.applyInvoiceConsumptionForSession(sessionId);

    expect(invoiceModel.updateOne).toHaveBeenCalledWith(
      { _id: invoiceId, trialSessionsRemaining: { $gte: 1 } },
      { $inc: { trialSessionsRemaining: -1 } },
    );
    expect(sessionModel.updateOne).toHaveBeenCalledWith(
      { _id: sessionId },
      {
        $set: {
          consumedInvoiceId: invoiceId,
          consumedInvoiceUnits: 1,
          consumedInvoiceAmount: 0,
          consumedBonusUnits: 0,
          consumedBonusAmount: 0,
        },
        $unset: { bonusInvoiceId: 1 },
      },
    );
  });
});
