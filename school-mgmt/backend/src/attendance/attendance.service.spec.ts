import { ForbiddenException } from '@nestjs/common';
import { Types } from 'mongoose';
import { AttendanceService } from './attendance.service';
import { Role } from '../common/interfaces/role.enum';
import { ClassMode } from '../classes/schemas/class.schema';
import { WalletStatus } from '../wallets/schemas/wallet.schema';

function buildLeanQuery<T>(value: T) {
  return {
    session: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    populate: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(value),
  } as any;
}

describe('AttendanceService historical resolution', () => {
  let service: AttendanceService;

  beforeEach(() => {
    service = new AttendanceService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
  });

  const classroom = {
    _id: 'class-1',
    teacher: 'teacher-b',
    students: ['student-1'],
    substituteTeachers: [],
    durationSnapshots: [
      {
        effectiveAt: new Date('2026-03-01T00:00:00.000Z'),
        baseDuration: 70,
        sessionDuration: 70,
        pricePerSession: 200000,
        teacherPayPerSession: 80000,
        teacherPayPerStudent: 0,
      },
      {
        effectiveAt: new Date('2026-03-20T00:00:00.000Z'),
        baseDuration: 70,
        sessionDuration: 90,
        pricePerSession: 200000,
        teacherPayPerSession: 80000,
        teacherPayPerStudent: 0,
      },
    ],
    studentConfigs: [
      {
        studentId: 'student-1',
        teacherSlots: [
          {
            slotIndex: 1,
            teacherId: 'teacher-a',
            assignedAt: new Date('2026-03-01T00:00:00.000Z'),
          },
          {
            slotIndex: 2,
            teacherId: 'teacher-b',
            assignedAt: new Date('2026-03-20T00:00:00.000Z'),
          },
        ],
        durationSlots: [
          {
            slotIndex: 1,
            baseDuration: 70,
            sessionDuration: 70,
            totalSessions: 10,
            effectiveAt: new Date('2026-03-01T00:00:00.000Z'),
          },
          {
            slotIndex: 2,
            baseDuration: 70,
            sessionDuration: 90,
            totalSessions: 8,
            effectiveAt: new Date('2026-03-20T00:00:00.000Z'),
          },
        ],
      },
    ],
  };

  it('allows the old teacher on old attendance dates and blocks the new teacher', () => {
    expect(() =>
      (service as any).assertClassAccess(
        classroom,
        { role: Role.TEACHER, sub: 'teacher-a' },
        new Date('2026-03-19T12:00:00.000Z'),
      ),
    ).not.toThrow();

    expect(() =>
      (service as any).assertClassAccess(
        classroom,
        { role: Role.TEACHER, sub: 'teacher-b' },
        new Date('2026-03-19T12:00:00.000Z'),
      ),
    ).toThrow(ForbiddenException);

    expect(() =>
      (service as any).assertClassAccess(
        classroom,
        { role: Role.TEACHER, sub: 'teacher-b' },
        new Date('2026-03-21T12:00:00.000Z'),
      ),
    ).not.toThrow();
  });

  it('resolves historical tuition, session duration, and teacher payout from the effective snapshot', async () => {
    await expect(
      (service as any).resolveAmountCharged(
        'student-1',
        'class-1',
        70,
        classroom,
        new Date('2026-03-19T12:00:00.000Z'),
      ),
    ).resolves.toBe(200000);

    await expect(
      (service as any).resolveAmountCharged(
        'student-1',
        'class-1',
        90,
        classroom,
        new Date('2026-03-21T12:00:00.000Z'),
      ),
    ).resolves.toBe(257000);

    expect(
      (service as any).resolveSessionDurationForDate(
        classroom,
        'student-1',
        new Date('2026-03-19T12:00:00.000Z'),
      ),
    ).toBe(70);

    expect(
      (service as any).resolveSessionDurationForDate(
        classroom,
        'student-1',
        new Date('2026-03-21T12:00:00.000Z'),
      ),
    ).toBe(90);

    expect(
      (service as any).resolveTeacherPayout(
        70,
        classroom,
        new Date('2026-03-19T12:00:00.000Z'),
      ),
    ).toBe(80000);

    expect(
      (service as any).resolveTeacherPayout(
        90,
        classroom,
        new Date('2026-03-21T12:00:00.000Z'),
      ),
    ).toBe(102000);
  });
});

describe('AttendanceService attendance financial guard', () => {
  let service: AttendanceService;
  let invoiceModel: { find: jest.Mock; findOne: jest.Mock };
  let studentModel: { findById: jest.Mock };
  let trialEnrollmentModel: { findOne: jest.Mock };
  let walletModel: { findOne: jest.Mock };

  const classId = new Types.ObjectId();
  const studentId = new Types.ObjectId();
  const parentUserId = new Types.ObjectId();
  const date = new Date('2026-04-01T09:00:00.000Z');
  const classroom = {
    _id: classId,
    classMode: ClassMode.ONLINE,
    pricePerSession: 200000,
    teacherPayPerSession: 80000,
    students: [studentId],
    substituteTeachers: [],
    durationSnapshots: [],
    studentConfigs: [],
  } as any;

  beforeEach(() => {
    invoiceModel = {
      find: jest.fn(() => buildLeanQuery([])),
      findOne: jest.fn(() => buildLeanQuery(null)),
    };
    studentModel = {
      findById: jest.fn(() => buildLeanQuery({ parentUserId })),
    };
    trialEnrollmentModel = {
      findOne: jest.fn(() => buildLeanQuery(null)),
    };
    walletModel = {
      findOne: jest.fn(() =>
        buildLeanQuery({
          balance: 0,
          debtLimit: 0,
          trialDebtSessions: 2,
          status: WalletStatus.ACTIVE,
        }),
      ),
    };

    service = new AttendanceService(
      {} as any,
      {} as any,
      studentModel as any,
      {} as any,
      invoiceModel as any,
      trialEnrollmentModel as any,
      walletModel as any,
      {} as any,
      {} as any,
    );

    jest.spyOn(service as any, 'resolveAmountCharged').mockResolvedValue(200000);
  });

  it('allows offline trial attendance without checking invoices or wallet', async () => {
    trialEnrollmentModel.findOne.mockReturnValueOnce(
      buildLeanQuery({ _id: new Types.ObjectId() }),
    );

    await expect(
      (service as any).assertAttendanceFinancialEligibility({
        classId,
        studentId,
        date,
        classroom: { ...classroom, classMode: ClassMode.OFFLINE },
      }),
    ).resolves.toBeUndefined();

    expect(invoiceModel.find).not.toHaveBeenCalled();
    expect(walletModel.findOne).not.toHaveBeenCalled();
  });

  it('blocks counted attendance when the student has no remaining paid or bonus sessions', async () => {
    invoiceModel.find.mockImplementation(() => buildLeanQuery([]));

    await expect(
      (service as any).assertAttendanceFinancialEligibility({
        classId,
        studentId,
        date,
        classroom,
      }),
    ).rejects.toThrow('Hoc sinh khong du buoi hoc con lai');

    expect(walletModel.findOne).not.toHaveBeenCalled();
  });

  it('allows counted attendance when bonus sessions fully cover the lesson', async () => {
    invoiceModel.find.mockImplementation((query: any) => {
      if (query?.sessionsRemaining) {
        return buildLeanQuery([]);
      }
      if (query?.bonusSessionsRemaining) {
        return buildLeanQuery([
          {
            pricePerSession: 200000,
            bonusSessionsRemaining: 1,
          },
        ]);
      }
      return buildLeanQuery([]);
    });

    await expect(
      (service as any).assertAttendanceFinancialEligibility({
        classId,
        studentId,
        date,
        classroom,
      }),
    ).resolves.toBeUndefined();

    expect(walletModel.findOne).not.toHaveBeenCalled();
  });

  it('blocks counted attendance when paid coverage exists but the wallet is below the debt limit', async () => {
    invoiceModel.find.mockImplementation((query: any) => {
      if (query?.sessionsRemaining) {
        return buildLeanQuery([
          {
            pricePerSession: 200000,
            sessionsRemaining: 2,
          },
        ]);
      }
      return buildLeanQuery([]);
    });
    walletModel.findOne.mockReturnValueOnce(
      buildLeanQuery({
        balance: -250000,
        debtLimit: 0,
        trialDebtSessions: 1,
        status: WalletStatus.ACTIVE,
      }),
    );

    await expect(
      (service as any).assertAttendanceFinancialEligibility({
        classId,
        studentId,
        date,
        classroom,
      }),
    ).rejects.toThrow('Vi phu huynh khong du so du');
  });
});
