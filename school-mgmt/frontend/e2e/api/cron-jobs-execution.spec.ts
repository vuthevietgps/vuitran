import { expect, test, type APIRequestContext } from '@playwright/test';

import {
  apiCall,
  createLearningFixture,
  dateOffset,
  getSessionById,
  loginAsCredentials,
  loginAsRole,
} from '../support';

async function completeSessionAndSubmitTeachingReport(
  request: APIRequestContext,
  fixture: Awaited<ReturnType<typeof createLearningFixture>>,
) {
  const teacherSession = await loginAsCredentials(
    request,
    'teacher',
    fixture.teacher.email,
    fixture.teacher.password,
  );

  await apiCall(
    request,
    teacherSession,
    'POST',
    `/sessions/${fixture.session._id}/complete`,
    {
      topicsCovered: 'Cron auto finalize coverage',
      lessonContent: 'Teacher completed the lesson and wrapped up the assigned exercises.',
      studentPerformance: 4,
      studentEngagement: 4,
    },
    [200, 201],
  );

  await apiCall(
    request,
    teacherSession,
    'PATCH',
    `/sessions/${fixture.session._id}/teaching-report`,
    {
      lessonContent:
        'Teacher completed grammar review, speaking drills, guided reading, and listening practice with clear progress notes.',
      studentAttitude: 'Student stayed cooperative and focused for the full session.',
      recordingUrl: 'https://example.com/e2e-cron-auto-finalize',
      teacherComment: 'Student responded well to correction and completed the assigned tasks.',
      homework: 'Review the new vocabulary and finish worksheet section B.',
      additionalNotes: 'Parent can help review the speaking prompts before the next class.',
    },
    [200, 201],
  );
}

test.describe('Cron jobs execution API', () => {
  test('POST /api/dev/cron/trigger-auto-finalize finalizes an overdue teacher-completed session', async ({
    request,
  }) => {
    test.slow();

    const directorSession = await loginAsRole(request, 'director');
    const fixture = await createLearningFixture(request, {
      label: 'cron-auto-finalize',
      classMode: 'ONLINE',
      scheduledDate: dateOffset(-2),
      initializeWallet: true,
      initialWalletAmount: 500_000,
      timeSlotIndex: 1,
      durationMinutes: 60,
      amountCharged: 200_000,
      teacherPayout: 120_000,
    });

    await apiCall(
      request,
      directorSession,
      'PATCH',
      `/sessions/${fixture.session._id}`,
      {
        autoConfirmAfterHours: 1,
      },
      [200, 201],
    );

    await completeSessionAndSubmitTeachingReport(request, fixture);

    const teacherCompletedSession = await getSessionById(
      request,
      directorSession,
      fixture.session._id,
    );
    expect(teacherCompletedSession.status).toBe('TEACHER_COMPLETED');
    expect(teacherCompletedSession.hasTeachingReport).toBe(true);

    await apiCall(
      request,
      directorSession,
      'POST',
      `/api/dev/cron/seed-auto-finalize/${fixture.session._id}`,
      {
        hoursAgo: 2,
      },
      [200, 201],
    );

    await apiCall(
      request,
      directorSession,
      'POST',
      '/api/dev/cron/trigger-auto-finalize',
      {},
      [200, 201],
    );

    const finalizedSession = await getSessionById(
      request,
      directorSession,
      fixture.session._id,
    );
    expect(finalizedSession.status).toBe('FINALIZED');
    expect(finalizedSession.confirmation?.autoConfirmedAt).toBeTruthy();
    expect(finalizedSession.confirmation?.finalizedAt).toBeTruthy();
  });
});
