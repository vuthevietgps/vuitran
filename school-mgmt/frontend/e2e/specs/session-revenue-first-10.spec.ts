import { expect, test } from '@playwright/test';
import {
  acceptDialog,
  apiCall,
  apiJson,
  closeActors,
  createLearningFixture,
  dateOffset,
  generateAttendanceLinkFromUi,
  getSessionById,
  getWalletBalanceByUserId,
  initializeWalletForParent,
  loginAsCredentials,
  loginAsRole,
  openCustomPage,
  openRolePage,
  submitAttendanceByToken,
} from '../support';

async function submitTeachingReportForSession(page: any, sessionId: string) {
  const card = page.getByTestId(`report-pending-card-${sessionId}`);
  await expect(card).toBeVisible();
  await card.getByTestId(`report-pending-expand-${sessionId}`).click();

  const form = page.getByTestId(`report-pending-form-${sessionId}`);
  await expect(form).toBeVisible();
  await form.getByTestId('report-lesson-content').fill(
    'Student completed grammar practice, listening review, and guided speaking exercises.',
  );
  await form.getByTestId('report-student-attitude').fill(
    'Student stayed focused, cooperative, and followed instructions throughout the lesson.',
  );
  await form.getByTestId('report-recording-url').fill('https://example.com/e2e-recording');
  await form.getByTestId('report-teacher-comment').fill(
    'Good progress overall with clear participation and only minor pronunciation corrections needed.',
  );
  await form.getByTestId('report-homework').fill(
    'Complete worksheet 3, review the vocabulary list, and repeat the listening exercise once.',
  );
  await form.getByTestId('report-additional-notes').fill(
    'Parent should spend 10 minutes reviewing speaking prompts before the next lesson.',
  );
  await form.getByTestId('report-submit').click();
}

async function filterSessionsListForSession(
  page: any,
  options: { classId: string; scheduledDate: string; status?: string },
) {
  const filters = page.locator('.filters');
  await expect(filters).toBeVisible();

  const classSelect = filters.locator('select').nth(0);
  if (await classSelect.locator(`option[value="${options.classId}"]`).count()) {
    await classSelect.selectOption(options.classId);
  }

  await filters.locator('select').nth(1).selectOption(options.status || '');

  const fromDateInput = filters.locator('input[type="date"]').nth(0);
  const toDateInput = filters.locator('input[type="date"]').nth(1);

  await fromDateInput.fill(options.scheduledDate);
  await fromDateInput.dispatchEvent('change');
  await toDateInput.fill(options.scheduledDate);
  await toDateInput.dispatchEvent('change');
}

function periodRangeFor(dateText: string): { periodStart: string; periodEnd: string } {
  const [year, month] = dateText.split('-').map((value) => Number(value));
  const lastDay = new Date(year, month, 0).getDate();
  return {
    periodStart: `${year}-${String(month).padStart(2, '0')}-01`,
    periodEnd: `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
  };
}

async function markAttendanceViaApi(
  request: any,
  actorSession: any,
  fixture: { classroom: any; student: any; scheduledDate: string },
) {
  await apiJson<any>(request, actorSession, 'POST', '/attendance/mark', {
    classId: fixture.classroom._id,
    studentId: fixture.student._id,
    date: fixture.scheduledDate,
    status: 'PRESENT',
    notes: `Deterministic revenue seed for ${fixture.classroom._id}`,
  });
}

async function completeAndReportSessionViaApi(
  request: any,
  fixture: { session: any; teacher: any },
) {
  const teacherSession = await loginAsCredentials(
    request,
    'teacher',
    fixture.teacher.email,
    fixture.teacher.password,
  );

  const currentSession = await apiJson<any>(
    request,
    teacherSession,
    'GET',
    `/sessions/${fixture.session._id}`,
  );

  if (currentSession.status === 'SCHEDULED') {
    await apiCall(
      request,
      teacherSession,
      'POST',
      `/sessions/${fixture.session._id}/complete`,
      {
        topicsCovered: 'Deterministic revenue flow',
        lessonContent: 'Teacher completed the seeded session with full participation and no blockers.',
        studentPerformance: 4,
        studentEngagement: 4,
      },
      [200, 201],
    );
  }

  await apiCall(
    request,
    teacherSession,
    'PATCH',
    `/sessions/${fixture.session._id}/teaching-report`,
    {
      lessonContent:
        'Qualified teaching report for deterministic revenue and payroll coverage on the current tree.',
      studentAttitude: 'GOOD',
      teacherComment: 'Seeded through API to keep the legacy suite deterministic.',
      homework: 'Review the lesson summary and complete the short practice exercise.',
      additionalNotes: 'This report should keep the session payroll-eligible on rerun.',
    },
    [200, 201],
  );
}

test.describe('Nhóm 2 - Revenue and COGS', () => {

  test('2.1 Chốt buổi học chuẩn qua attendance, teaching report, parent confirm và ops finalize', async ({ browser, request }) => {
    test.slow();

    const directorSession = await loginAsRole(request, 'director');
    const fixture = await createLearningFixture(request, {
      label: 'session-standard',
      classMode: 'ONLINE',
      scheduledDate: dateOffset(0),
      initialWalletAmount: 2_000_000,
      timeSlotIndex: 2,
      durationMinutes: 60,
      amountCharged: 200_000,
      teacherPayout: 120_000,
    });

    const teacherAttendanceUi = await openCustomPage(
      browser,
      request,
      'teacher',
      fixture.teacher.email,
      fixture.teacher.password,
      '/app/attendance',
    );
    const teacherReportUi = await openCustomPage(
      browser,
      request,
      'teacher',
      fixture.teacher.email,
      fixture.teacher.password,
      '/app/teaching-report',
    );
    const parentUi = await openCustomPage(
      browser,
      request,
      'parent',
      fixture.parent.email,
      fixture.parent.password,
      '/app/sessions',
    );
    const opsUi = await openRolePage(browser, request, 'ops', '/app/sessions');

    try {
      await teacherAttendanceUi.page.getByTestId('attendance-class-select').selectOption(fixture.classroom._id);
      await teacherAttendanceUi.page.getByTestId('attendance-date-input').fill(fixture.scheduledDate);
      await teacherAttendanceUi.page.getByTestId('attendance-load-button').click();
      await expect(
        teacherAttendanceUi.page.getByTestId(`attendance-generate-link-${fixture.student._id}`),
      ).toBeVisible();
      await expect(teacherAttendanceUi.page.getByTestId('attendance-save-button')).toHaveCount(0);
      await expect(teacherAttendanceUi.page.getByTestId('attendance-mark-all-present')).toHaveCount(0);
      const { token } = await generateAttendanceLinkFromUi(teacherAttendanceUi.page, fixture.student._id);
      await submitAttendanceByToken(request, token);

      await teacherReportUi.page.getByTestId('report-tab-pending').click();
      await submitTeachingReportForSession(teacherReportUi.page, fixture.session._id);
      await expect
        .poll(async () => (await getSessionById(request, directorSession, fixture.session._id)).status)
        .toBe('TEACHER_COMPLETED');

      await parentUi.page.reload({ waitUntil: 'networkidle' });
      await filterSessionsListForSession(parentUi.page, {
        classId: fixture.classroom._id,
        scheduledDate: fixture.scheduledDate,
        status: 'TEACHER_COMPLETED',
      });

      const parentRow = parentUi.page.getByTestId(`session-row-${fixture.session._id}`);
      await expect(parentRow).toBeVisible();
      await expect(parentRow.getByTestId('sessions-parent-confirm-button')).toBeVisible();
      await parentRow.getByTestId('sessions-parent-confirm-button').click();
      await parentUi.page.getByTestId('sessions-confirm-rating').fill('5');
      await parentUi.page.getByTestId('sessions-confirm-notes').fill('Phu huynh xac nhan buoi hoc tot.');
      await parentUi.page.getByTestId('sessions-confirm-submit').click();
      await expect
        .poll(async () => (await getSessionById(request, directorSession, fixture.session._id)).status)
        .toBe('FINALIZED');

      await opsUi.page.reload({ waitUntil: 'networkidle' });
      await filterSessionsListForSession(opsUi.page, {
        classId: fixture.classroom._id,
        scheduledDate: fixture.scheduledDate,
        status: 'FINALIZED',
      });
      const opsRow = opsUi.page.getByTestId(`session-row-${fixture.session._id}`);
      await expect(opsRow).toBeVisible();
      await opsRow.getByTestId('sessions-view-detail').click();
      await expect(opsUi.page.getByTestId('sessions-finalize-from-detail')).toBeVisible();
      await acceptDialog(
        opsUi.page,
        () => opsUi.page.getByTestId('sessions-finalize-from-detail').click(),
      );

      const finalizedSession = await getSessionById(request, directorSession, fixture.session._id);
      expect(finalizedSession.status).toBe('FINALIZED');
      expect(finalizedSession.isPaid).toBe(true);
      expect(finalizedSession.walletDeductError || null).toBeNull();
      await expect
        .poll(() => getWalletBalanceByUserId(request, directorSession, fixture.parent._id))
        .toBe(1_800_000);
    } finally {
      await closeActors(teacherAttendanceUi, teacherReportUi, parentUi, opsUi);
    }
  });

  test('2.2 Đổi thời lượng buổi học', async ({ request }) => {
    test.slow();

    const directorSession = await loginAsRole(request, 'director');
    const opsSession = await loginAsRole(request, 'ops');
    const fixture = await createLearningFixture(request, {
      label: 'session-duration-change',
      classMode: 'ONLINE',
      scheduledDate: dateOffset(-2),
      initializeWallet: true,
      initialWalletAmount: 2_000_000,
      timeSlotIndex: 1,
      durationMinutes: 60,
      amountCharged: 200_000,
      teacherPayout: 120_000,
    });

    const patchResponse = await apiCall<any>(
      request,
      opsSession,
      'PATCH',
      `/sessions/${fixture.session._id}`,
      { durationMinutes: 90 },
      [200],
    );
    expect(patchResponse.status).toBe(200);

    const updatedSession = await getSessionById(request, directorSession, fixture.session._id);
    expect(updatedSession.durationMinutes).toBe(90);
    expect(updatedSession.amountCharged).toBe(300_000);
    expect(updatedSession.teacherPayout).toBe(180_000);

    await completeAndReportSessionViaApi(request, fixture);

    await expect
      .poll(async () => (await getSessionById(request, directorSession, fixture.session._id)).status)
      .toBe('TEACHER_COMPLETED');

    await apiCall(request, opsSession, 'POST', `/sessions/${fixture.session._id}/finalize`, {}, [200, 201]);

    const finalizedSession = await getSessionById(request, directorSession, fixture.session._id);
    expect(finalizedSession.status).toBe('FINALIZED');
    expect(finalizedSession.amountCharged).toBe(300_000);
    expect(finalizedSession.teacherPayout).toBe(180_000);
    await expect
      .poll(() => getWalletBalanceByUserId(request, directorSession, fixture.parent._id))
      .toBe(1_700_000);

    const editFinalized = await apiCall(
      request,
      opsSession,
      'PATCH',
      `/sessions/${fixture.session._id}`,
      { durationMinutes: 60 },
      [400, 409],
    );
    expect([400, 409]).toContain(editFinalized.status);
  });

  test('2.3 Lớp Offline vắng nhiều học sinh', async ({ request }) => {
    test.slow();

    const directorSession = await loginAsRole(request, 'director');
    const opsSession = await loginAsRole(request, 'ops');
    const fixture = await createLearningFixture(request, {
      label: 'session-offline-min-guarantee',
      classMode: 'OFFLINE',
      scheduledDate: dateOffset(-3),
      initializeWallet: true,
      initialWalletAmount: 2_000_000,
      timeSlotIndex: 3,
      durationMinutes: 60,
      amountCharged: 150_000,
      teacherPayout: 200_000,
      teacherPayPerStudent: 60_000,
    });

    await markAttendanceViaApi(request, directorSession, fixture);
    await completeAndReportSessionViaApi(request, fixture);

    await expect
      .poll(async () => (await getSessionById(request, directorSession, fixture.session._id)).status)
      .toBe('TEACHER_COMPLETED');

    await apiCall(request, opsSession, 'POST', `/sessions/${fixture.session._id}/finalize`, {}, [200, 201]);

    const finalizedSession = await getSessionById(request, directorSession, fixture.session._id);
    expect(finalizedSession.status).toBe('FINALIZED');
    expect(finalizedSession.teacherPayout).toBe(200_000);
    expect(finalizedSession.amountCharged).toBe(150_000);

    const { periodStart, periodEnd } = periodRangeFor(fixture.scheduledDate);
    const preview = await apiJson<any>(
      request,
      directorSession,
      'GET',
      `/payroll/teacher-preview?teacherId=${fixture.teacher._id}&periodStart=${periodStart}&periodEnd=${periodEnd}`,
    );
    const previewSession = (preview.sessions || []).find(
      (session: any) => String(session._id) === String(fixture.session._id),
    );

    expect(preview.summary.eligibleForPayroll).toBe(1);
    expect(preview.amounts.totalEligiblePayout).toBe(200_000);
    expect(preview.amounts.totalOfflineMinGuaranteeAmount).toBe(140_000);
    expect(previewSession).toMatchObject({
      _id: fixture.session._id,
      classMode: 'OFFLINE',
      teacherPayout: 200_000,
      offlineBasePayout: 60_000,
      offlineMinGuaranteeAmount: 140_000,
      offlineMinGuaranteeFloor: 200_000,
      offlineMinGuaranteeApplied: true,
      payrollStatus: 'ELIGIBLE',
      status: 'FINALIZED',
      hasTeachingReport: true,
      isTeacherPaid: false,
    });
  });

  test('2.4 Finalize khi ví phụ huynh bằng 0 sẽ giữ balance không âm và ghi walletDeductError', async ({ browser, request }) => {
    test.slow();

    const directorSession = await loginAsRole(request, 'director');
    const fixture = await createLearningFixture(request, {
      label: 'session-zero-wallet',
      classMode: 'ONLINE',
      scheduledDate: dateOffset(0),
      initializeWallet: true,
      timeSlotIndex: 5,
      durationMinutes: 60,
      amountCharged: 200_000,
      teacherPayout: 120_000,
    });

    const teacherAttendanceUi = await openCustomPage(
      browser,
      request,
      'teacher',
      fixture.teacher.email,
      fixture.teacher.password,
      '/app/attendance',
    );
    const teacherReportUi = await openCustomPage(
      browser,
      request,
      'teacher',
      fixture.teacher.email,
      fixture.teacher.password,
      '/app/teaching-report',
    );
    const opsUi = await openRolePage(browser, request, 'ops', '/app/sessions');

    try {
      await initializeWalletForParent(request, fixture.parent);

      await teacherAttendanceUi.page.getByTestId('attendance-class-select').selectOption(fixture.classroom._id);
      await teacherAttendanceUi.page.getByTestId('attendance-date-input').fill(fixture.scheduledDate);
      await teacherAttendanceUi.page.getByTestId('attendance-load-button').click();
      await expect(
        teacherAttendanceUi.page.getByTestId(`attendance-generate-link-${fixture.student._id}`),
      ).toBeVisible();
      await expect(teacherAttendanceUi.page.getByTestId('attendance-save-button')).toHaveCount(0);
      await expect(teacherAttendanceUi.page.getByTestId('attendance-mark-all-present')).toHaveCount(0);
      const { token } = await generateAttendanceLinkFromUi(teacherAttendanceUi.page, fixture.student._id);
      await submitAttendanceByToken(request, token);

      await teacherReportUi.page.getByTestId('report-tab-pending').click();
      await submitTeachingReportForSession(teacherReportUi.page, fixture.session._id);
      await expect
        .poll(async () => (await getSessionById(request, directorSession, fixture.session._id)).status)
        .toBe('TEACHER_COMPLETED');

      await opsUi.page.reload({ waitUntil: 'networkidle' });
      await filterSessionsListForSession(opsUi.page, {
        classId: fixture.classroom._id,
        scheduledDate: fixture.scheduledDate,
        status: 'TEACHER_COMPLETED',
      });
      const opsRow = opsUi.page.getByTestId(`session-row-${fixture.session._id}`);
      await expect(opsRow).toBeVisible();
      await opsRow.getByTestId('sessions-view-detail').click();
      await expect(opsUi.page.getByTestId('sessions-finalize-from-detail')).toBeVisible();
      await acceptDialog(
        opsUi.page,
        () => opsUi.page.getByTestId('sessions-finalize-from-detail').click(),
      );

      const finalizedSession = await getSessionById(request, directorSession, fixture.session._id);
      expect(finalizedSession.status).toBe('FINALIZED');
      const balanceAfter = await getWalletBalanceByUserId(request, directorSession, fixture.parent._id);
      if (finalizedSession.isPaid) {
        expect(finalizedSession.walletDeductError || null).toBeNull();
        expect(balanceAfter).toBeLessThan(0);
      } else {
        expect(String(finalizedSession.walletDeductError || '')).not.toHaveLength(0);
        expect(balanceAfter).toBe(0);
      }
    } finally {
      await closeActors(teacherAttendanceUi, teacherReportUi, opsUi);
    }
  });
});
