import { Types } from 'mongoose';
import { ClassMode } from '../classes/schemas/class.schema';
import { SessionTrialService } from './session-trial.service';
import { SessionType } from './schemas/session.schema';

function buildClassModel() {
  const lean = jest.fn().mockResolvedValue({
    _id: new Types.ObjectId(),
    classMode: ClassMode.OFFLINE,
  });
  const select = jest.fn().mockReturnValue({ lean });
  return {
    findById: jest.fn().mockReturnValue({ select }),
  };
}

describe('SessionTrialService', () => {
  it('keeps teacher payout when trial is marked teacher-paid-only', async () => {
    const session = {
      _id: new Types.ObjectId(),
      studentId: new Types.ObjectId(),
      classId: new Types.ObjectId(),
      sessionType: SessionType.TRIAL,
      trialConverted: false,
      trialTeacherPaidOnly: false,
      trialRejectedNoPay: false,
      isTeacherPaid: false,
      save: jest.fn().mockResolvedValue(undefined),
    };
    const sessionModel = {
      find: jest.fn().mockResolvedValue([session]),
    };
    const classModel = buildClassModel();
    const payrollTxService = {
      excludeFromPayroll: jest.fn(),
    };

    const service = new SessionTrialService(
      sessionModel as any,
      classModel as any,
      payrollTxService as any,
      {} as any,
    );

    const result = await service.markTrialTeacherPaidOnly(
      session.studentId.toString(),
      session.classId.toString(),
      new Types.ObjectId().toString(),
    );

    expect(result).toEqual({ updated: 1, excludedPayroll: 0 });
    expect(session.trialTeacherPaidOnly).toBe(true);
    expect(session.trialRejectedNoPay).toBe(false);
    expect(session.isTeacherPaid).toBe(true);
    expect(session.save).toHaveBeenCalledTimes(1);
    expect(payrollTxService.excludeFromPayroll).not.toHaveBeenCalled();
  });

  it('still excludes payroll when trial is rejected with no pay', async () => {
    const session = {
      _id: new Types.ObjectId(),
      studentId: new Types.ObjectId(),
      classId: new Types.ObjectId(),
      sessionType: SessionType.TRIAL,
      trialConverted: false,
      trialTeacherPaidOnly: true,
      trialRejectedNoPay: false,
      isTeacherPaid: true,
      save: jest.fn().mockResolvedValue(undefined),
    };
    const sessionModel = {
      find: jest.fn().mockResolvedValue([session]),
    };
    const classModel = buildClassModel();
    const payrollTxService = {
      excludeFromPayroll: jest.fn().mockResolvedValue(undefined),
    };

    const service = new SessionTrialService(
      sessionModel as any,
      classModel as any,
      payrollTxService as any,
      {} as any,
    );

    const actorUserId = new Types.ObjectId().toString();
    const result = await service.markTrialRejectedNoPay(
      session.studentId.toString(),
      session.classId.toString(),
      actorUserId,
    );

    expect(result).toEqual({ updated: 1, excludedPayroll: 1 });
    expect(session.trialTeacherPaidOnly).toBe(false);
    expect(session.trialRejectedNoPay).toBe(true);
    expect(session.isTeacherPaid).toBe(false);
    expect(payrollTxService.excludeFromPayroll).toHaveBeenCalledWith(
      session._id.toString(),
      actorUserId,
      'Hoc thu khong chuyen doi thanh hoc vien chinh thuc',
    );
  });
});
