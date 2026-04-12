import { expect, test } from '@playwright/test';
import {
  acceptDialog,
  closeActors,
  createLearningFixture,
  dateOffset,
  generateAttendanceLinkFromUi,
  getSessionById,
  getWalletBalanceByUserId,
  loginAsRole,
  openCustomPage,
  openRolePage,
  rolePassword,
  submitAttendanceByToken,
} from './support';

async function submitTeachingReportForSession(page: any, sessionId: string) {
  const card = page.getByTestId(`report-pending-card-${sessionId}`);
  await expect(card).toBeVisible();
  await card.getByTestId(`report-pending-expand-${sessionId}`).click();

  const form = page.getByTestId(`report-pending-form-${sessionId}`);
  await expect(form).toBeVisible();
  await form.getByTestId('report-lesson-content').fill(
    'Session debt-limit warning coverage with complete teaching-report details.',
  );
  await form.getByTestId('report-student-attitude').fill(
    'Student stayed focused and completed all requested in-session tasks.',
  );
  await form.getByTestId('report-recording-url').fill('https://example.com/e2e-session-debt-limit');
  await form.getByTestId('report-teacher-comment').fill(
    'Teacher completed the lesson so OPS can run finalize and settlement checks.',
  );
  await form.getByTestId('report-homework').fill(
    'Review the lesson summary and complete the assigned worksheet before next session.',
  );
  await form.getByTestId('report-additional-notes').fill(
    'Seeded specifically to validate wallet deduction warning on finalize.',
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

test('B05 ops finalize shows explicit debt-limit warning when wallet deduction fails after finalize', async ({
  browser,
  request,
}) => {
  test.slow();

  const directorSession = await loginAsRole(request, 'director');
  const fixture = await createLearningFixture(request, {
    label: 'session-debt-limit-warning',
    classMode: 'ONLINE',
    scheduledDate: dateOffset(0),
    initializeWallet: true,
    timeSlotIndex: 8,
    durationMinutes: 60,
    pricePerSession: 200_000,
    amountCharged: 1_000_000,
    teacherPayout: 120_000,
  });

  const teacherAttendanceUi = await openCustomPage(
    browser,
    request,
    'teacher',
    fixture.teacher.email,
    rolePassword(),
    '/app/attendance',
  );
  const teacherReportUi = await openCustomPage(
    browser,
    request,
    'teacher',
    fixture.teacher.email,
    rolePassword(),
    '/app/teaching-report',
  );
  const opsUi = await openRolePage(browser, request, 'ops', '/app/sessions');

  try {
    await teacherAttendanceUi.page.getByTestId('attendance-class-select').selectOption(fixture.classroom._id);
    await teacherAttendanceUi.page.getByTestId('attendance-date-input').fill(fixture.scheduledDate);
    await teacherAttendanceUi.page.getByTestId('attendance-load-button').click();
    await expect(
      teacherAttendanceUi.page.getByTestId(`attendance-generate-link-${fixture.student._id}`),
    ).toBeVisible();

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

    const sessionRow = opsUi.page.getByTestId(`session-row-${fixture.session._id}`);
    await expect(sessionRow).toBeVisible();
    await sessionRow.getByTestId('sessions-view-detail').click();
    await expect(opsUi.page.getByTestId('sessions-finalize-from-detail')).toBeVisible();

    const confirmMessage = await acceptDialog(
      opsUi.page,
      () => opsUi.page.getByTestId('sessions-finalize-from-detail').click(),
    );
    expect(confirmMessage).toContain('Xác nhận lương');

    const warningAlert = opsUi.page.getByTestId('sessions-wallet-deduct-warning');
    await expect(warningAlert).toBeVisible();
    await expect(warningAlert).toContainText('Vượt giới hạn nợ');
    await expect(warningAlert).toContainText('Phụ huynh cần nạp thêm tiền');
    await expect(opsUi.page.getByTestId('sessions-error-alert')).toContainText('Vượt giới hạn nợ');
    await expect(opsUi.page.getByTestId('sessions-detail-close')).toBeVisible();

    const finalizedSession = await getSessionById(request, directorSession, fixture.session._id);
    expect(finalizedSession.status).toBe('FINALIZED');
    expect(finalizedSession.isPaid).toBe(false);
    expect(String(finalizedSession.walletDeductError || '')).toContain('Vượt giới hạn nợ');
    await expect.poll(() => getWalletBalanceByUserId(request, directorSession, fixture.parent._id)).toBe(0);
  } finally {
    await closeActors(teacherAttendanceUi, teacherReportUi, opsUi);
  }
});
