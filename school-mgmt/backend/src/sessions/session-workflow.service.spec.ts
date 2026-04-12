import { BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';
import { SessionWorkflowService } from './session-workflow.service';
import { SessionStatus } from './schemas/session.schema';
import { Role } from '../common/interfaces/role.enum';
import { PayrollTransactionStatus } from '../payroll/schemas/payroll-transaction.schema';
import { SessionType } from './schemas/session.schema';

function buildService(overrides: Partial<Record<string, any>> = {}) {
  return new SessionWorkflowService(
    overrides.sessionModel ?? { findById: jest.fn() },
    overrides.classModel ?? {},
    overrides.studentModel ?? {},
    overrides.attendanceModel ?? {},
    overrides.reportTemplateModel ?? {},
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

describe('SessionWorkflowService.cancel()', () => {
  it('blocks ordinary rollback when payroll is already PAID', async () => {
    const sessionId = new Types.ObjectId().toHexString();
    const teacherId = new Types.ObjectId().toHexString();
    const service = buildService({
      sessionModel: {
        findById: jest.fn().mockResolvedValue({
          _id: sessionId,
          status: SessionStatus.SCHEDULED,
          teacherId: new Types.ObjectId(teacherId),
          classId: new Types.ObjectId(),
          scheduledDate: new Date('2026-04-09T17:00:00.000Z'),
          scheduledStartTime: '08:00',
          amountCharged: 100_000,
          teacherPayout: 50_000,
          parentUserId: new Types.ObjectId(),
          isPaid: true,
          isTeacherPaid: true,
          save: jest.fn(),
        }),
      },
      payrollTxService: {
        getBySessionId: jest.fn().mockResolvedValue({
          status: PayrollTransactionStatus.PAID,
        }),
      },
    });

    await expect(
      service.cancel(
        sessionId,
        teacherId,
        Role.DIRECTOR,
        { cancelReason: 'manual rollback' } as any,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('SessionWorkflowService.reschedule()', () => {
  it('updates old session via patch write so legacy documents do not revalidate', async () => {
    const oldSessionId = new Types.ObjectId().toHexString();
    const teacherId = new Types.ObjectId().toHexString();
    const classId = new Types.ObjectId();
    const studentId = new Types.ObjectId();
    const newSessionId = new Types.ObjectId();
    const oldSession = {
      _id: new Types.ObjectId(oldSessionId),
      status: SessionStatus.SCHEDULED,
      teacherId: new Types.ObjectId(teacherId),
      classId,
      studentId,
      parentUserId: new Types.ObjectId(),
      durationMinutes: 60,
      amountCharged: 180_000,
      teacherPayout: 90_000,
      sessionNumber: 12,
      sessionType: SessionType.REGULAR,
      save: jest.fn(),
    };
    const newSession = {
      _id: newSessionId,
      rescheduledFromId: undefined,
      save: jest.fn().mockResolvedValue(undefined),
    };
    const service = buildService({
      sessionModel: {
        findById: jest.fn().mockResolvedValue(oldSession),
        updateOne: jest.fn().mockResolvedValue({ acknowledged: true, modifiedCount: 1 }),
      },
      classModel: {
        findById: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({ _id: classId, cancelPolicy: { allowReschedule: true } }),
        }),
      },
      sessionsService: {
        create: jest.fn().mockResolvedValue(newSession),
      },
      studentSupportSnapshotService: {
        refreshStudentSupportSnapshotForSession: jest.fn(),
      },
    });

    const result = await service.reschedule(oldSessionId, { sub: teacherId, role: Role.TEACHER } as any, {
      newScheduledDate: '2026-04-20',
      newStartTime: '14:00',
      newEndTime: '15:00',
    } as any);

    expect(service['sessionModel'].updateOne).toHaveBeenCalledWith(
      { _id: oldSession._id },
      {
        $set: {
          status: SessionStatus.RESCHEDULED,
          rescheduledToId: newSessionId,
        },
      },
    );
    expect(oldSession.save).not.toHaveBeenCalled();
    expect(result.oldSession.status).toBe(SessionStatus.RESCHEDULED);
    expect(result.oldSession.rescheduledToId).toEqual(newSessionId);
  });
});
