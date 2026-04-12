import { SessionPayrollService } from './session-payroll.service';
import { SessionStatus } from './schemas/session.schema';

describe('SessionPayrollService teaching report gating', () => {
  let service: SessionPayrollService;

  beforeEach(() => {
    service = new SessionPayrollService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
  });

  it('returns zero payout when the teaching report is missing', () => {
    const payout = service.computeTeacherPayoutFallback(
      {
        teacherPayout: 120000,
        status: SessionStatus.FINALIZED,
        hasTeachingReport: false,
      },
      {
        classMode: 'ONLINE',
      },
    );

    expect(payout).toBe(0);
  });

  it('returns zero payout when the report flag is true but lesson content is blank', () => {
    const payout = service.computeTeacherPayoutFallback(
      {
        teacherPayout: 120000,
        status: SessionStatus.FINALIZED,
        hasTeachingReport: true,
        teachingReport: { lessonContent: '   ' },
      },
      {
        classMode: 'ONLINE',
      },
    );

    expect(payout).toBe(0);
  });

  it('keeps payout when the teaching report is valid', () => {
    const payout = service.computeTeacherPayoutFallback(
      {
        teacherPayout: 120000,
        status: SessionStatus.FINALIZED,
        hasTeachingReport: true,
        teachingReport: { lessonContent: 'Noi dung bai giang hop le va day du.' },
      },
      {
        classMode: 'ONLINE',
      },
    );

    expect(payout).toBe(120000);
  });
});
