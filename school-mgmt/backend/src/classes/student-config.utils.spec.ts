import {
  getClassPricingConfigAt,
  getDurationForStudentAt,
  getTeacherIdForStudentAt,
  getTeacherOwnedStudentIdsAt,
} from './student-config.utils';

describe('student-config.utils historical resolution', () => {
  const classroom = {
    teacher: 'teacher-b',
    students: ['student-1', 'student-2'],
    totalSessions: 10,
    pricingSnapshot: {
      referenceDuration: 70,
      sessionDuration: 90,
      pricePerSession: 200000,
      perMinuteRate: 2857.14,
      teacherPayPerSession: 80000,
      teacherPayPerStudent: 0,
    },
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
          {
            slotIndex: 3,
            baseDuration: 70,
            sessionDuration: 100,
            totalSessions: 7.2,
            effectiveAt: new Date('2026-03-25T00:00:00.000Z'),
          },
        ],
      },
      {
        studentId: 'student-2',
        teacherSlots: [
          {
            slotIndex: 1,
            teacherId: 'teacher-a',
            assignedAt: new Date('2026-03-01T00:00:00.000Z'),
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

  it('resolves teacher by the effective session date', () => {
    expect(
      getTeacherIdForStudentAt(classroom, 'student-1', new Date('2026-03-19T12:00:00.000Z')),
    ).toBe('teacher-a');
    expect(
      getTeacherIdForStudentAt(classroom, 'student-1', new Date('2026-03-21T12:00:00.000Z')),
    ).toBe('teacher-b');
  });

  it('resolves visible teacher-owned students by date', () => {
    expect(
      getTeacherOwnedStudentIdsAt(classroom, 'teacher-a', new Date('2026-03-19T12:00:00.000Z')),
    ).toEqual(['student-1', 'student-2']);
    expect(
      getTeacherOwnedStudentIdsAt(classroom, 'teacher-a', new Date('2026-03-21T12:00:00.000Z')),
    ).toEqual(['student-2']);
    expect(
      getTeacherOwnedStudentIdsAt(classroom, 'teacher-b', new Date('2026-03-21T12:00:00.000Z')),
    ).toEqual(['student-1']);
  });

  it('resolves class pricing snapshot by effective date', () => {
    expect(getClassPricingConfigAt(classroom, new Date('2026-03-19T12:00:00.000Z'))).toMatchObject({
      baseDuration: 70,
      sessionDuration: 70,
      pricePerSession: 200000,
      teacherPayPerSession: 80000,
    });
    expect(getClassPricingConfigAt(classroom, new Date('2026-03-21T12:00:00.000Z'))).toMatchObject({
      baseDuration: 70,
      sessionDuration: 90,
      pricePerSession: 200000,
      teacherPayPerSession: 80000,
    });
  });

  it('prefers student duration slots over class duration snapshots', () => {
    expect(
      getDurationForStudentAt(classroom, 'student-1', new Date('2026-03-24T12:00:00.000Z')),
    ).toMatchObject({
      baseDuration: 70,
      sessionDuration: 90,
      totalSessions: 8,
    });
    expect(
      getDurationForStudentAt(classroom, 'student-1', new Date('2026-03-26T12:00:00.000Z')),
    ).toMatchObject({
      baseDuration: 70,
      sessionDuration: 100,
      totalSessions: 7.2,
    });
  });

  it('falls back to the earliest historical snapshot when querying before the first slot', () => {
    expect(
      getTeacherIdForStudentAt(classroom, 'student-1', new Date('2026-02-20T12:00:00.000Z')),
    ).toBe('teacher-a');
    expect(
      getDurationForStudentAt(classroom, 'student-2', new Date('2026-02-20T12:00:00.000Z')),
    ).toMatchObject({
      baseDuration: 70,
      sessionDuration: 70,
      totalSessions: 10,
    });
  });
});
