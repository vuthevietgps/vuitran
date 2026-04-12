import { expect, test, type Page } from '@playwright/test';
import {
  closeActors,
  createLearningFixture,
  generateAttendanceLinkAndSubmit,
  getSessionById,
  initializeWalletForParent,
  loginAsCredentials,
  loginAsRole,
  openCustomPage,
  openRolePage,
} from './support';

async function submitTeachingReportForSession(page: Page, sessionId: string) {
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
  page: Page,
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

test('B06 parent confirm shows 1-5 rating control, success feedback, and submitted state in session detail', async ({ browser, request }) => {
  test.slow();

  const directorSession = await loginAsRole(request, 'director');
  const fixture = await createLearningFixture(request, {
    label: `sessions-parent-confirm-${Date.now()}`,
    classMode: 'ONLINE',
    initializeWallet: true,
    durationMinutes: 60,
    amountCharged: 200_000,
    teacherPayout: 120_000,
  });

  await initializeWalletForParent(request, fixture.parent);
  const teacherSession = await loginAsCredentials(
    request,
    'teacher',
    fixture.teacher.email,
    fixture.teacher.password,
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

  try {
    await generateAttendanceLinkAndSubmit(request, teacherSession, {
      classId: fixture.classroom._id,
      studentId: fixture.student._id,
      date: fixture.scheduledDate,
    });

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
    await parentRow.getByTestId('sessions-parent-confirm-button').click();

    await expect(parentUi.page.getByRole('heading', { name: 'Xác nhận buổi học' })).toBeVisible();
    await expect(parentUi.page.getByText('Đánh giá (1-5 sao)')).toBeVisible();
    await expect(parentUi.page.getByTestId('sessions-confirm-rating')).toHaveAttribute('min', '1');
    await expect(parentUi.page.getByTestId('sessions-confirm-rating')).toHaveAttribute('max', '5');
    await expect(parentUi.page.getByTestId('sessions-confirm-rating')).toHaveValue('5');

    await parentUi.page.getByTestId('sessions-confirm-rating').fill('4');
    await parentUi.page.getByTestId('sessions-confirm-notes').fill('Phu huynh da gui danh gia 4 sao va nhan xet ro rang.');
    await parentUi.page.getByTestId('sessions-confirm-submit').click();

    await expect(parentUi.page.getByTestId('sessions-success-alert')).toHaveText(
      'Da ghi nhan danh gia buoi hoc thanh cong.',
    );
    await expect
      .poll(async () => {
        const session = await getSessionById(request, directorSession, fixture.session._id);
        return {
          status: session.status,
          parentRating: session.parentRating,
          parentNotes: session.parentNotes || '',
        };
      })
      .toEqual({
        status: 'FINALIZED',
        parentRating: 4,
        parentNotes: 'Phu huynh da gui danh gia 4 sao va nhan xet ro rang.',
      });

    await parentUi.page.reload({ waitUntil: 'networkidle' });
    await filterSessionsListForSession(parentUi.page, {
      classId: fixture.classroom._id,
      scheduledDate: fixture.scheduledDate,
      status: 'FINALIZED',
    });

    const finalizedRow = parentUi.page.getByTestId(`session-row-${fixture.session._id}`);
    await expect(finalizedRow).toBeVisible();
    await finalizedRow.getByTestId('sessions-view-detail').click();
    await expect(parentUi.page.locator('.detail-row').filter({ hasText: 'Ghi chú PH:' })).toContainText(
      'Phu huynh da gui danh gia 4 sao va nhan xet ro rang.',
    );
    await expect(parentUi.page.locator('.detail-row').filter({ hasText: 'Đánh giá PH:' })).toContainText('★★★★');
  } finally {
    await closeActors(teacherReportUi, parentUi);
  }
});
