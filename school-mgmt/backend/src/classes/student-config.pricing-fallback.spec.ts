import { getClassPricingConfigAt } from './student-config.utils';

describe('getClassPricingConfigAt pricing fallback', () => {
  it('falls back to pricingSnapshot when a duration snapshot is missing payout fields', () => {
    const classroom = {
      totalSessions: 24,
      pricingSnapshot: {
        referenceDuration: 70,
        sessionDuration: 70,
        pricePerSession: 145_000,
        teacherPayPerSession: 75_000,
        teacherPayPerStudent: 0,
      },
      durationSnapshots: [
        {
          effectiveAt: new Date('2026-03-20T00:00:00.000Z'),
          baseDuration: 70,
          sessionDuration: 70,
          pricePerSession: 0,
          teacherPayPerSession: 0,
          teacherPayPerStudent: 0,
        },
      ],
    };

    expect(getClassPricingConfigAt(classroom, new Date('2026-04-01T00:00:00.000Z'))).toMatchObject({
      baseDuration: 70,
      sessionDuration: 70,
      totalSessions: 24,
      pricePerSession: 145_000,
      teacherPayPerSession: 75_000,
      teacherPayPerStudent: 0,
    });
  });

  it('falls back to top-level class pricing when no pricing snapshot exists', () => {
    const classroom = {
      totalSessions: 12,
      pricePerSession: 160_000,
      teacherPayPerSession: 80_000,
      teacherPayPerStudent: 25_000,
      durationSnapshots: [
        {
          effectiveAt: new Date('2026-03-20T00:00:00.000Z'),
          baseDuration: 80,
          sessionDuration: 90,
          pricePerSession: 0,
          teacherPayPerSession: 0,
          teacherPayPerStudent: 0,
        },
      ],
    };

    expect(getClassPricingConfigAt(classroom, new Date('2026-04-01T00:00:00.000Z'))).toMatchObject({
      baseDuration: 80,
      sessionDuration: 90,
      totalSessions: 12,
      pricePerSession: 160_000,
      teacherPayPerSession: 80_000,
      teacherPayPerStudent: 25_000,
    });
  });
});
