import {
  addVietnamHours,
  calculateTeachingReportDeadline,
  calculateVietnamLateHours,
  calculateVietnamHoursBefore,
} from './vietnam-timezone.utils';

describe('vietnam-timezone.utils', () => {
  it('calculates a teaching report deadline in Asia/Ho_Chi_Minh correctly', () => {
    const scheduledDate = new Date('2026-04-09T17:00:00.000Z');

    const deadline = calculateTeachingReportDeadline(scheduledDate, 24);

    expect(deadline.toISOString()).toBe('2026-04-10T17:00:00.000Z');
  });

  it('calculates late hours consistently around the Vietnam timezone boundary', () => {
    const deadline = new Date('2026-04-10T17:00:00.000Z');
    const submittedAt = new Date('2026-04-10T18:30:00.000Z');

    expect(calculateVietnamLateHours(submittedAt, deadline)).toBe(1);
  });

  it('calculates hours before a session start using Vietnam wall clock time', () => {
    const scheduledDate = new Date('2026-04-09T17:00:00.000Z');
    const now = new Date('2026-04-10T15:00:00.000Z');

    expect(calculateVietnamHoursBefore(scheduledDate, '23:00', now)).toBe(1);
  });

  it('adds hours using Vietnam wall clock semantics', () => {
    const baseDate = new Date('2026-04-09T17:00:00.000Z');

    expect(addVietnamHours(baseDate, 24).toISOString()).toBe('2026-04-10T17:00:00.000Z');
  });
});
