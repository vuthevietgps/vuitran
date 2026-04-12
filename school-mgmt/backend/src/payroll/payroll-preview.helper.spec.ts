import { Types } from 'mongoose';
import { buildTeacherPayrollPreview } from './payroll-preview.helper';

function createLeanChain<T>(value: T) {
  return {
    populate: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(value),
  };
}

describe('buildTeacherPayrollPreview()', () => {
  it('surfaces late-report penalty and final payout from PayrollTransaction without hiding the gross payout', async () => {
    const teacherId = new Types.ObjectId().toString();
    const sessionId = new Types.ObjectId();
    const classId = new Types.ObjectId();
    const studentId = new Types.ObjectId();

    const session = {
      _id: sessionId,
      classId: { _id: classId, name: 'Lop Penalty', code: 'CLS-PENALTY' },
      studentId: { _id: studentId, fullName: 'Hoc sinh Penalty', studentCode: 'HS-PENALTY' },
      scheduledDate: new Date('2026-04-08T02:00:00.000Z'),
      durationMinutes: 60,
      teacherPayout: 120_000,
      status: 'FINALIZED',
      hasTeachingReport: true,
      isTeacherPaid: false,
      isPaid: false,
      confirmation: {},
      teachingReport: {
        lessonContent: 'Nop bao cao tre cho buoi hoc penalty.',
        submittedAt: new Date('2026-04-11T02:00:00.000Z'),
        isLateSubmission: true,
      },
    };

    const sessionModel = {
      find: jest.fn().mockReturnValue(createLeanChain([session])),
    };
    const payrollTransactionModel = {
      find: jest.fn().mockReturnValue(createLeanChain([
        {
          sessionId,
          status: 'PENDING',
          penaltyAmount: 36_000,
          finalSalary: 84_000,
          isLateReport: true,
          lateHours: 72,
        },
      ])),
    };
    const payrollModel = {
      find: jest.fn().mockReturnValue(createLeanChain([])),
    };
    const connection = {
      model: jest.fn((name: string) => {
        if (name === 'Session') return sessionModel;
        if (name === 'PayrollTransaction') return payrollTransactionModel;
        throw new Error(`Unexpected model lookup: ${name}`);
      }),
    } as any;
    const sessionsService = {
      countFinalizedForPayroll: jest.fn().mockResolvedValue({
        count: 1,
        totalPayout: 120_000,
        sessions: [{ _id: sessionId, teacherPayout: 120_000 }],
      }),
    } as any;

    const preview = await buildTeacherPayrollPreview(
      teacherId,
      '2026-04-01',
      '2026-04-30',
      sessionsService,
      connection,
      payrollModel as any,
    );

    expect(preview.summary.eligibleForPayroll).toBe(1);
    expect(preview.amounts.totalEligiblePayout).toBe(120_000);
    expect(preview.sessions).toHaveLength(1);
    expect(preview.sessions[0]).toMatchObject({
      _id: sessionId,
      teacherPayout: 120_000,
      penaltyAmount: 36_000,
      finalPayout: 84_000,
      isLateReport: true,
      lateHours: 72,
      payrollStatus: 'ELIGIBLE',
    });
  });

  it('surfaces offline minimum guarantee as a separate preview top-up instead of hiding it inside teacherPayout', async () => {
    const teacherId = new Types.ObjectId().toString();
    const sessionId = new Types.ObjectId();
    const classId = new Types.ObjectId();
    const studentId = new Types.ObjectId();

    const session = {
      _id: sessionId,
      classId: {
        _id: classId,
        name: 'Lop Offline Guarantee',
        code: 'CLS-GUARANTEE',
        classMode: 'OFFLINE',
        teacherPayPerStudent: 60_000,
      },
      studentId: { _id: studentId, fullName: 'Hoc sinh Vang Nhieu', studentCode: 'HS-GUARANTEE' },
      scheduledDate: new Date('2026-04-09T02:00:00.000Z'),
      durationMinutes: 60,
      teacherPayout: 200_000,
      status: 'FINALIZED',
      hasTeachingReport: true,
      isTeacherPaid: false,
      isPaid: false,
      confirmation: {},
      teachingReport: {
        lessonContent: 'Buoi hoc offline duoc bao chung muc toi thieu.',
        submittedAt: new Date('2026-04-10T02:00:00.000Z'),
        isLateSubmission: false,
      },
    };

    const sessionModel = {
      find: jest.fn().mockReturnValue(createLeanChain([session])),
    };
    const payrollTransactionModel = {
      find: jest.fn().mockReturnValue(createLeanChain([])),
    };
    const payrollModel = {
      find: jest.fn().mockReturnValue(createLeanChain([])),
    };
    const connection = {
      model: jest.fn((name: string) => {
        if (name === 'Session') return sessionModel;
        if (name === 'PayrollTransaction') return payrollTransactionModel;
        throw new Error(`Unexpected model lookup: ${name}`);
      }),
    } as any;
    const sessionsService = {
      countFinalizedForPayroll: jest.fn().mockResolvedValue({
        count: 1,
        totalPayout: 200_000,
        sessions: [{ _id: sessionId, teacherPayout: 200_000 }],
      }),
    } as any;

    const preview = await buildTeacherPayrollPreview(
      teacherId,
      '2026-04-01',
      '2026-04-30',
      sessionsService,
      connection,
      payrollModel as any,
    );

    expect(preview.summary.eligibleForPayroll).toBe(1);
    expect(preview.amounts.totalEligiblePayout).toBe(200_000);
    expect(preview.amounts.totalOfflineMinGuaranteeAmount).toBe(140_000);
    expect(preview.sessions).toHaveLength(1);
    expect(preview.sessions[0]).toMatchObject({
      _id: sessionId,
      classMode: 'OFFLINE',
      teacherPayout: 200_000,
      offlineBasePayout: 60_000,
      offlineMinGuaranteeAmount: 140_000,
      offlineMinGuaranteeFloor: 200_000,
      offlineMinGuaranteeApplied: true,
      payrollStatus: 'ELIGIBLE',
    });
  });
});
