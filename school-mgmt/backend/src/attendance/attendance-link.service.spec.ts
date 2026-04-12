import { AttendanceLinkService } from './attendance-link.service';

describe('AttendanceLinkService token expiry', () => {
  let service: AttendanceLinkService;

  beforeEach(() => {
    service = new AttendanceLinkService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
  });

  it('keeps a newly generated same-day token alive for at least 24 hours', () => {
    const attendanceDate = new Date('2026-04-09T00:00:00.000Z');
    const now = new Date('2026-04-09T23:30:00.000Z');

    const expiresAt = (service as any).calculateTokenExpiresAt(attendanceDate, now);

    expect(expiresAt.getTime() - now.getTime()).toBeGreaterThanOrEqual(24 * 60 * 60 * 1000);
  });

  it('keeps the later attendance-day expiry when it exceeds the minimum ttl window', () => {
    const attendanceDate = new Date('2026-04-11T00:00:00.000Z');
    const now = new Date('2026-04-09T08:00:00.000Z');

    const expiresAt = (service as any).calculateTokenExpiresAt(attendanceDate, now);

    expect(expiresAt.toISOString()).toBe('2026-04-11T23:59:59.999Z');
  });
});
