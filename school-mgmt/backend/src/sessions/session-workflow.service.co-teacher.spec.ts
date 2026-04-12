import { Types } from 'mongoose';
import { SessionWorkflowService } from './session-workflow.service';
import { SessionStatus } from './schemas/session.schema';

jest.mock('../payroll/payroll-transaction.service', () => ({
  PayrollTransactionService: class PayrollTransactionService {},
}));

function buildService(overrides: Partial<Record<string, any>> = {}) {
  return new SessionWorkflowService(
    overrides.sessionModel ?? ({} as any),
    overrides.classModel ?? ({} as any),
    overrides.studentModel ?? ({} as any),
    overrides.attendanceModel ?? ({} as any),
    overrides.reportTemplateModel ?? ({} as any),
    overrides.walletsService ?? {},
    overrides.notificationsService ?? {},
    overrides.payrollTxService ?? {},
    overrides.ticketsService ?? {},
    overrides.studentSupportSnapshotService ?? {},
    overrides.sessionSettlementService ?? {},
    overrides.sessionsService ?? {},
    overrides.storageUrlService ?? {
      extractAssetKey: jest.fn(),
      transformSensitiveAssetUrls: jest.fn((value) => value),
    },
  );
}

describe('SessionWorkflowService co-teacher access', () => {
  it('allows co-teachers with attendance permission to complete a session', async () => {
    const teacherId = new Types.ObjectId().toHexString();
    const classId = new Types.ObjectId().toHexString();
    const session = {
      _id: new Types.ObjectId(),
      classId: new Types.ObjectId(classId),
      teacherId: new Types.ObjectId(),
      status: SessionStatus.SCHEDULED,
      confirmation: {},
      save: jest.fn().mockResolvedValue({
        _id: new Types.ObjectId(),
        status: SessionStatus.TEACHER_COMPLETED,
      }),
    };
    const service = buildService({
      sessionModel: { findById: jest.fn().mockResolvedValue(session) },
      classModel: {
        findById: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnThis(),
          lean: jest.fn().mockResolvedValue({
            _id: classId,
            coTeachers: [
              {
                teacherId: new Types.ObjectId(teacherId),
                canManageAttendance: true,
                canManageReports: false,
              },
            ],
          }),
        }),
      },
      attendanceModel: { findOneAndUpdate: jest.fn() },
    });

    await expect(
      service.teacherComplete(session._id.toString(), teacherId, {} as any),
    ).resolves.toHaveProperty('status', SessionStatus.TEACHER_COMPLETED);
    expect(session.save).toHaveBeenCalled();
  });

  it('allows co-teachers with report permission to submit a teaching report', async () => {
    const teacherId = new Types.ObjectId().toHexString();
    const classId = new Types.ObjectId().toHexString();
    const session = {
      _id: new Types.ObjectId(),
      classId: new Types.ObjectId(classId),
      teacherId: new Types.ObjectId(),
      status: SessionStatus.TEACHER_COMPLETED,
      scheduledDate: new Date('2026-04-11T00:00:00.000Z'),
      teacherPayout: 120_000,
      confirmation: {},
      hasTeachingReport: false,
      teachingReport: undefined,
      save: jest.fn().mockResolvedValue(true),
      toObject: jest.fn().mockReturnValue({}),
    };
    const service = buildService({
      sessionModel: {
        findById: jest.fn().mockResolvedValue(session),
      },
      classModel: {
        findById: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnThis(),
          lean: jest.fn().mockResolvedValue({
            _id: classId,
            coTeachers: [
              {
                teacherId: new Types.ObjectId(teacherId),
                canManageAttendance: false,
                canManageReports: true,
              },
            ],
          }),
        }),
      },
      payrollTxService: {
        getBySessionId: jest.fn().mockResolvedValue(null),
      },
      reportTemplateModel: {
        findById: jest.fn(),
      },
      storageUrlService: {
        extractAssetKey: jest.fn(),
        transformSensitiveAssetUrls: jest.fn((value) => value),
      },
      attendanceModel: { findOneAndUpdate: jest.fn() },
    });

    await expect(
      service.submitTeachingReport(session._id.toString(), teacherId, {
        lessonContent: 'Noi dung bao cao day du va hop le',
      } as any),
    ).resolves.toBeDefined();
    expect(session.save).toHaveBeenCalled();
  });

  it('allows co-teachers with report permission to bulk submit reports', async () => {
    const teacherId = new Types.ObjectId().toHexString();
    const classId = new Types.ObjectId().toHexString();
    const sessionId = new Types.ObjectId();
    const session = {
      _id: sessionId,
      classId: new Types.ObjectId(classId),
      teacherId: new Types.ObjectId(),
      status: SessionStatus.TEACHER_COMPLETED,
      scheduledDate: new Date('2026-04-11T00:00:00.000Z'),
      scheduledStartTime: '08:00',
      scheduledEndTime: '09:00',
      hasTeachingReport: false,
      isTeacherPaid: false,
    };
    const service = buildService({
      sessionModel: {
        find: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([session]),
        }),
        findByIdAndUpdate: jest.fn().mockResolvedValue(true),
      },
      classModel: {
        findById: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnThis(),
          lean: jest.fn().mockResolvedValue({
            _id: classId,
            teacher: new Types.ObjectId(),
            coTeachers: [
              {
                teacherId: new Types.ObjectId(teacherId),
                canManageAttendance: false,
                canManageReports: true,
              },
            ],
          }),
        }),
      },
      payrollTxService: {
        getBySessionId: jest.fn().mockResolvedValue(null),
      },
      reportTemplateModel: {
        findById: jest.fn(),
      },
      storageUrlService: {
        extractAssetKey: jest.fn(),
        transformSensitiveAssetUrls: jest.fn((value) => value),
      },
      attendanceModel: { findOneAndUpdate: jest.fn() },
    });

    await expect(
      service.bulkSubmitTeachingReport(
        classId,
        '2026-04-11',
        teacherId,
        { lessonContent: 'Noi dung bao cao day du va hop le' } as any,
      ),
    ).resolves.toEqual(
      expect.objectContaining({
        updatedCount: 1,
        skippedCount: 0,
      }),
    );
  });
});
