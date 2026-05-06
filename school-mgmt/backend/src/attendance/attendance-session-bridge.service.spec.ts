import { Types } from 'mongoose';
import { AttendanceSessionBridgeService } from './attendance-session-bridge.service';
import { ClassMode } from '../classes/schemas/class.schema';
import { SessionType } from '../sessions/schemas/session.schema';

type QueryChainResult = {
  select: jest.Mock;
  sort: jest.Mock;
  session: jest.Mock;
  lean: jest.Mock;
};

function buildQueryChain(result: any): QueryChainResult {
  const chain: Partial<QueryChainResult> = {};
  chain.select = jest.fn().mockReturnThis();
  chain.sort = jest.fn().mockReturnThis();
  chain.session = jest.fn().mockReturnThis();
  chain.lean = jest.fn().mockReturnThis();
  const promise = Promise.resolve(result);
  (chain as any).then = promise.then.bind(promise);
  (chain as any).catch = promise.catch.bind(promise);
  return chain as QueryChainResult;
}

function buildService(overrides: Partial<{
  attendanceModel: any;
  classModel: any;
  studentModel: any;
  sessionModel: any;
  invoiceModel: any;
  connection: any;
}> = {}) {
  const attendanceModel = overrides.attendanceModel ?? ({} as any);
  const classModel = overrides.classModel ?? ({} as any);
  const studentModel =
    overrides.studentModel ??
    ({
      findById: jest.fn(),
    } as any);
  const sessionModel =
    overrides.sessionModel ??
    ({
      findOne: jest.fn(),
      create: jest.fn(),
    } as any);
  const invoiceModel =
    overrides.invoiceModel ??
    ({
      findOne: jest.fn().mockReturnValue(buildQueryChain(null)),
    } as any);
  const connection =
    overrides.connection ??
    ({
      startSession: jest.fn(),
    } as any);

  return new AttendanceSessionBridgeService(
    attendanceModel as any,
    classModel as any,
    studentModel as any,
    sessionModel as any,
    invoiceModel as any,
    connection as any,
  );
}

describe('AttendanceSessionBridgeService snapshot resolution', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('uses the snapshot effective on the attendance date when creating sessions', async () => {
    const studentId = new Types.ObjectId();
    const classId = new Types.ObjectId();
    const teacherId = new Types.ObjectId();
    const parentUserId = new Types.ObjectId();
    const mongoSession = {} as any;

    const sessionModel: any = {
      findOne: jest
        .fn()
        .mockReturnValueOnce(buildQueryChain(null))
        .mockReturnValueOnce(buildQueryChain({ sessionNumber: 0 }))
        .mockReturnValueOnce(buildQueryChain(null))
        .mockReturnValueOnce(buildQueryChain({ sessionNumber: 1 })),
      create: jest
        .fn()
        .mockResolvedValueOnce([{ _id: new Types.ObjectId() }])
        .mockResolvedValueOnce([{ _id: new Types.ObjectId() }]),
    };
    const studentModel: any = {
      findById: jest
        .fn()
        .mockReturnValue(buildQueryChain({ parentUserId })),
    };
    const service = buildService({ sessionModel, studentModel });

    const classroom = {
      _id: classId,
      classMode: ClassMode.ONLINE,
      sessionDuration: 90,
      baseDuration: 90,
      pricePerSession: 900000,
      teacherPayPerSession: 300000,
      teacherPayPerStudent: 0,
      pricingSnapshot: {
        referenceDuration: 90,
        sessionDuration: 90,
        pricePerSession: 900000,
        teacherPayPerSession: 300000,
      },
      durationSnapshots: [
        {
          effectiveAt: new Date('2026-03-01T00:00:00.000Z'),
          baseDuration: 60,
          sessionDuration: 60,
          pricePerSession: 600000,
          teacherPayPerSession: 200000,
          teacherPayPerStudent: 0,
        },
        {
          effectiveAt: new Date('2026-04-01T00:00:00.000Z'),
          baseDuration: 90,
          sessionDuration: 90,
          pricePerSession: 900000,
          teacherPayPerSession: 300000,
          teacherPayPerStudent: 0,
        },
      ],
    } as any;

    await service.syncSessionForAttendance({
      classId,
      studentId,
      teacherId,
      date: new Date('2026-03-20T00:00:00.000Z'),
      classroom,
      mongoSession,
    });

    expect(sessionModel.create).toHaveBeenNthCalledWith(
      1,
      [
        expect.objectContaining({
          durationMinutes: 60,
          amountCharged: 600000,
          teacherPayout: 200000,
        }),
      ],
      { session: mongoSession },
    );

    await service.syncSessionForAttendance({
      classId,
      studentId,
      teacherId,
      date: new Date('2026-04-20T00:00:00.000Z'),
      classroom,
      mongoSession,
    });

    expect(sessionModel.create).toHaveBeenNthCalledWith(
      2,
      [
        expect.objectContaining({
          durationMinutes: 90,
          amountCharged: 900000,
          teacherPayout: 300000,
        }),
      ],
      { session: mongoSession },
    );
  });

  it('keeps a historical attendance session on the older snapshot when reusing a mutable session', async () => {
    const studentId = new Types.ObjectId();
    const classId = new Types.ObjectId();
    const teacherId = new Types.ObjectId();
    const mongoSession = {} as any;

    const existingSession = {
      _id: new Types.ObjectId(),
      status: 'SCHEDULED',
      confirmation: null,
      teacherId: new Types.ObjectId(),
      teacherPayout: 300000,
      amountCharged: 900000,
      durationMinutes: 90,
      save: jest.fn().mockResolvedValue(undefined),
    };

    const sessionModel: any = {
      findOne: jest.fn().mockReturnValueOnce(buildQueryChain(existingSession)),
      create: jest.fn(),
    };
    const service = buildService({ sessionModel });

    const classroom = {
      _id: classId,
      classMode: ClassMode.ONLINE,
      sessionDuration: 90,
      baseDuration: 90,
      pricePerSession: 900000,
      teacherPayPerSession: 300000,
      teacherPayPerStudent: 0,
      pricingSnapshot: {
        referenceDuration: 90,
        sessionDuration: 90,
        pricePerSession: 900000,
        teacherPayPerSession: 300000,
      },
      durationSnapshots: [
        {
          effectiveAt: new Date('2026-03-01T00:00:00.000Z'),
          baseDuration: 60,
          sessionDuration: 60,
          pricePerSession: 600000,
          teacherPayPerSession: 200000,
          teacherPayPerStudent: 0,
        },
        {
          effectiveAt: new Date('2026-04-01T00:00:00.000Z'),
          baseDuration: 90,
          sessionDuration: 90,
          pricePerSession: 900000,
          teacherPayPerSession: 300000,
          teacherPayPerStudent: 0,
        },
      ],
    } as any;

    const sessionId = await service.syncSessionForAttendance({
      classId,
      studentId,
      teacherId,
      date: new Date('2026-03-20T00:00:00.000Z'),
      classroom,
      mongoSession,
    });

    expect(sessionId?.toString()).toBe(existingSession._id.toString());
    expect(existingSession.durationMinutes).toBe(60);
    expect(existingSession.amountCharged).toBe(600000);
    expect(existingSession.teacherPayout).toBe(200000);
    expect(existingSession.status).toBe('TEACHER_COMPLETED');
    expect(existingSession.save).toHaveBeenCalledWith({ session: mongoSession });
    expect(sessionModel.create).not.toHaveBeenCalled();
  });

  it('creates an approved trial attendance session as TRIAL for zero-amount trial invoices', async () => {
    const studentId = new Types.ObjectId();
    const classId = new Types.ObjectId();
    const teacherId = new Types.ObjectId();
    const parentUserId = new Types.ObjectId();
    const mongoSession = {} as any;

    const sessionModel: any = {
      findOne: jest
        .fn()
        .mockReturnValueOnce(buildQueryChain(null))
        .mockReturnValueOnce(buildQueryChain({ sessionNumber: 0 })),
      create: jest.fn().mockResolvedValueOnce([{ _id: new Types.ObjectId() }]),
    };
    const studentModel: any = {
      findById: jest
        .fn()
        .mockReturnValue(buildQueryChain({ parentUserId })),
    };
    const invoiceModel: any = {
      findOne: jest
        .fn()
        .mockReturnValueOnce(buildQueryChain({
          trialSessionsRemaining: 1,
          sessionsRemaining: 0,
          bonusSessionsRemaining: 0,
          amount: 0,
          pricePerSession: 150000,
        }))
        .mockReturnValueOnce(buildQueryChain({
          perMinuteRate: 0,
          referenceDuration: 60,
          pricePerSession: 0,
        })),
    };
    const service = buildService({ sessionModel, studentModel, invoiceModel });

    const classroom = {
      _id: classId,
      classMode: ClassMode.OFFLINE,
      sessionDuration: 60,
      baseDuration: 60,
      pricePerSession: 150000,
      teacherPayPerSession: 0,
      teacherPayPerStudent: 180000,
      pricingSnapshot: {
        referenceDuration: 60,
        sessionDuration: 60,
        pricePerSession: 150000,
        teacherPayPerSession: 0,
        teacherPayPerStudent: 180000,
      },
      durationSnapshots: [],
    } as any;

    await service.syncSessionForAttendance({
      classId,
      studentId,
      teacherId,
      date: new Date('2026-04-14T00:00:00.000Z'),
      classroom,
      mongoSession,
    });

    expect(sessionModel.create).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          sessionType: SessionType.TRIAL,
          trialConverted: false,
          trialTeacherPaidOnly: false,
          trialRejectedNoPay: false,
          amountCharged: 150000,
        }),
      ],
      { session: mongoSession },
    );
  });

  it('upgrades a mutable attendance session to TRIAL when it is backed by an approved trial invoice', async () => {
    const studentId = new Types.ObjectId();
    const classId = new Types.ObjectId();
    const teacherId = new Types.ObjectId();
    const mongoSession = {} as any;

    const existingSession = {
      _id: new Types.ObjectId(),
      status: 'SCHEDULED',
      sessionType: SessionType.REGULAR,
      trialConverted: false,
      trialTeacherPaidOnly: false,
      trialRejectedNoPay: false,
      trialEnrollmentId: undefined,
      confirmation: null,
      teacherId: new Types.ObjectId(),
      teacherPayout: 100000,
      amountCharged: 150000,
      durationMinutes: 60,
      save: jest.fn().mockResolvedValue(undefined),
    };

    const sessionModel: any = {
      findOne: jest.fn().mockReturnValueOnce(buildQueryChain(existingSession)),
      create: jest.fn(),
    };
    const invoiceModel: any = {
      findOne: jest
        .fn()
        .mockReturnValueOnce(buildQueryChain({
          trialSessionsRemaining: 1,
          sessionsRemaining: 0,
          bonusSessionsRemaining: 0,
          amount: 0,
          pricePerSession: 150000,
        }))
        .mockReturnValueOnce(buildQueryChain({
          perMinuteRate: 0,
          referenceDuration: 60,
          pricePerSession: 0,
        })),
    };
    const service = buildService({ sessionModel, invoiceModel });

    const classroom = {
      _id: classId,
      classMode: ClassMode.OFFLINE,
      sessionDuration: 60,
      baseDuration: 60,
      pricePerSession: 150000,
      teacherPayPerSession: 0,
      teacherPayPerStudent: 180000,
      pricingSnapshot: {
        referenceDuration: 60,
        sessionDuration: 60,
        pricePerSession: 150000,
        teacherPayPerSession: 0,
        teacherPayPerStudent: 180000,
      },
      durationSnapshots: [],
    } as any;

    await service.syncSessionForAttendance({
      classId,
      studentId,
      teacherId,
      date: new Date('2026-04-14T00:00:00.000Z'),
      classroom,
      mongoSession,
    });

    expect(existingSession.sessionType).toBe(SessionType.TRIAL);
    expect(existingSession.trialConverted).toBe(false);
    expect(existingSession.amountCharged).toBe(150000);
    expect(existingSession.status).toBe('TEACHER_COMPLETED');
    expect(existingSession.save).toHaveBeenCalledWith({ session: mongoSession });
    expect(sessionModel.create).not.toHaveBeenCalled();
  });
});
