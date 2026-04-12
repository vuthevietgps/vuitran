import { Types } from 'mongoose';
import { SessionsService } from './sessions.service';
import { SessionStatus } from './schemas/session.schema';

jest.mock('./session-payroll.service', () => ({
  SessionPayrollService: class SessionPayrollService {},
}));
jest.mock('./session-query.service', () => ({
  SessionQueryService: class SessionQueryService {},
}));
jest.mock('./session-workflow.service', () => ({
  SessionWorkflowService: class SessionWorkflowService {},
}));

function buildService(overrides: Partial<{
  sessionModel: any;
  sessionChangeRequestModel: any;
  classModel: any;
  studentModel: any;
  teacherProfileModel: any;
  userModel: any;
  studentSupportSnapshotService: any;
  sessionTrialService: any;
  sessionPayrollService: any;
  sessionQueryService: any;
  sessionWorkflowService: any;
}> = {}) {
  const sessionQueryService =
    overrides.sessionQueryService ?? {
      submitParentFeedback: jest.fn(),
      buildRemainingSessionsAtNewDurationSnapshot: jest.fn(),
      findAll: jest.fn(),
      findById: jest.fn(),
      getStats: jest.fn(),
      getChildrenProgress: jest.fn(),
      checkConflicts: jest.fn(),
    };
  const sessionPayrollService =
    overrides.sessionPayrollService ?? {
      countFinalizedForPayroll: jest.fn(),
      claimTeacherPaid: jest.fn(),
      markTeacherPaid: jest.fn(),
      checkTeacherPaid: jest.fn(),
      unmarkTeacherPaid: jest.fn(),
      markPaid: jest.fn(),
      resolveSessionFinancials: jest.fn(),
      buildRemainingSessionsAtNewDurationSnapshot: jest.fn(),
    };

  return {
    service: new SessionsService(
      overrides.sessionModel ?? ({} as any),
      overrides.sessionChangeRequestModel ?? ({} as any),
      overrides.classModel ?? ({} as any),
      overrides.studentModel ?? ({} as any),
      overrides.teacherProfileModel ?? ({} as any),
      overrides.userModel ?? ({} as any),
      overrides.studentSupportSnapshotService ?? ({} as any),
      overrides.sessionTrialService ?? ({} as any),
      sessionPayrollService as any,
      sessionQueryService as any,
      overrides.sessionWorkflowService ?? ({} as any),
    ),
    sessionQueryService,
    sessionPayrollService,
  };
}

describe('SessionsService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('delegates parent feedback submission to the query service', async () => {
    const { service, sessionQueryService } = buildService();
    sessionQueryService.submitParentFeedback.mockResolvedValue({
      success: true,
      message: 'Cam on ban da gui danh gia!',
    });

    const result = await service.submitParentFeedback('parent-1', {
      overallRating: 5,
      teachingQuality: 4,
      communication: 5,
      facility: 3,
      comment: 'Tot',
      sessionId: new Types.ObjectId().toHexString(),
    });

    expect(sessionQueryService.submitParentFeedback).toHaveBeenCalledWith('parent-1', {
      overallRating: 5,
      teachingQuality: 4,
      communication: 5,
      facility: 3,
      comment: 'Tot',
      sessionId: expect.any(String),
    });
    expect(result).toEqual({
      success: true,
      message: 'Cam on ban da gui danh gia!',
    });
  });

  it('delegates finalized session counting to the payroll service', async () => {
    const { service, sessionPayrollService } = buildService();
    sessionPayrollService.countFinalizedForPayroll.mockResolvedValue(12);
    const cutoff = new Date('2026-04-09T00:00:00.000Z');

    await expect(
      service.countFinalizedForPayroll('teacher-1', cutoff, undefined),
    ).resolves.toBe(12);

    expect(sessionPayrollService.countFinalizedForPayroll).toHaveBeenCalledWith(
      'teacher-1',
      cutoff,
      undefined,
    );
  });

  it('delegates teacher-paid checks to the payroll service', async () => {
    const { service, sessionPayrollService } = buildService();
    sessionPayrollService.checkTeacherPaid.mockResolvedValue(['s-1', 's-2']);

    const result = await service.checkTeacherPaid(['s-1', 's-2']);

    expect(sessionPayrollService.checkTeacherPaid).toHaveBeenCalledWith(['s-1', 's-2']);
    expect(result).toEqual(['s-1', 's-2']);
  });
});
