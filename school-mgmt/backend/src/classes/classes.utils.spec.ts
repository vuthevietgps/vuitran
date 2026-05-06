import {
  assertCanReviewPendingUpdate,
  buildDurationSnapshotData,
  resolveCurrentClassPricingState,
} from './classes.utils';
import { PendingClassUpdateType, ClassUpdateRequestStatus } from './schemas/class.schema';

describe('classes.utils snapshot precedence', () => {
  it('prefers the latest duration snapshot over stale top-level values for current online pricing', () => {
    const classroom = {
      classMode: 'ONLINE',
      baseDuration: 60,
      sessionDuration: 60,
      pricePerSession: 120_000,
      teacherPayPerSession: 50_000,
      teacherPayPerStudent: 0,
      pricingSnapshot: {
        referenceDuration: 70,
        sessionDuration: 70,
        pricePerSession: 145_000,
        teacherPayPerSession: 75_000,
        teacherPayPerStudent: 0,
      },
      durationSnapshots: [
        {
          effectiveAt: new Date('2026-03-01T00:00:00.000Z'),
          baseDuration: 70,
          sessionDuration: 90,
          pricePerSession: 145_000,
          teacherPayPerSession: 75_000,
          teacherPayPerStudent: 0,
        },
      ],
    };

    expect(buildDurationSnapshotData(classroom)).toMatchObject({
      baseDuration: 70,
      sessionDuration: 90,
      pricePerSession: 145_000,
      teacherPayPerSession: 75_000,
      teacherPayPerStudent: 0,
    });
    expect(resolveCurrentClassPricingState(classroom)).toMatchObject({
      baseDuration: 70,
      sessionDuration: 90,
      pricePerSession: 145_000,
      teacherPayPerSession: 75_000,
      teacherPayPerStudent: 0,
    });
  });

  it('prefers pending update values when generating the next snapshot payload', () => {
    const pendingClassState = {
      classMode: 'ONLINE',
      baseDuration: 70,
      sessionDuration: 100,
      pricePerSession: 145_000,
      teacherPayPerSession: 85_000,
      teacherPayPerStudent: 0,
      pricingSnapshot: {
        referenceDuration: 70,
        sessionDuration: 100,
        pricePerSession: 145_000,
        teacherPayPerSession: 85_000,
        teacherPayPerStudent: 0,
      },
      durationSnapshots: [
        {
          effectiveAt: new Date('2026-03-01T00:00:00.000Z'),
          baseDuration: 70,
          sessionDuration: 90,
          pricePerSession: 145_000,
          teacherPayPerSession: 75_000,
          teacherPayPerStudent: 0,
        },
      ],
    };

    expect(buildDurationSnapshotData(pendingClassState, { preferPendingValues: true })).toMatchObject({
      baseDuration: 70,
      sessionDuration: 100,
      pricePerSession: 145_000,
      teacherPayPerSession: 85_000,
      teacherPayPerStudent: 0,
    });
  });
});

describe('classes.utils pending update authorization', () => {
  it('allows ops to review sale duration change requests', () => {
    expect(() =>
      assertCanReviewPendingUpdate(
        {
          status: ClassUpdateRequestStatus.PENDING,
          requestType: PendingClassUpdateType.DURATION_CHANGE,
        },
        { role: 'OPS', sub: 'ops-1' } as any,
      ),
    ).not.toThrow();
  });
});
