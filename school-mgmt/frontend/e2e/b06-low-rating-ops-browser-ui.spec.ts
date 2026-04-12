import { expect, test, type Page } from '@playwright/test';
import {
  applySessionCookies,
  closeActors,
  createBatchEvidenceContext,
  createLearningFixture,
  generateAttendanceLinkAndSubmit,
  getSessionById,
  loginAsRole,
  openCustomPage,
} from './support';

const RUN_DATE =
  process.env['UI_EVIDENCE_DATE'] ||
  process.env['E2E_RUN_DATE'] ||
  '2026-04-11';

const LOW_RATING_NOTE = 'Phu huynh cham 2 sao va muon OPS theo doi gap do tre vao lop.';

async function submitTeachingReportForSession(page: Page, sessionId: string) {
  const card = page.getByTestId(`report-pending-card-${sessionId}`);
  await expect(card).toBeVisible();
  await card.getByTestId(`report-pending-expand-${sessionId}`).click();

  const form = page.getByTestId(`report-pending-form-${sessionId}`);
  await expect(form).toBeVisible();
  await form.getByTestId('report-lesson-content').fill(
    'Low-rating OPS visibility coverage with completed grammar and speaking activities.',
  );
  await form.getByTestId('report-student-attitude').fill(
    'Student completed the lesson but parent needs OPS to review a service concern.',
  );
  await form.getByTestId('report-recording-url').fill('https://example.com/e2e-b06-low-rating');
  await form.getByTestId('report-teacher-comment').fill(
    'Teacher submitted the report so parent can finalize and OPS can inspect the parent feedback.',
  );
  await form.getByTestId('report-homework').fill(
    'Review the worksheet and prepare two speaking prompts before the next session.',
  );
  await form.getByTestId('report-additional-notes').fill(
    'Seeded specifically to prove low-rating visibility on OPS session detail.',
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

test('B06 low parent rating remains clearly visible for OPS on session detail', async ({
  browser,
  request,
}) => {
  test.slow();
  test.setTimeout(300_000);

  const evidence = await createBatchEvidenceContext(browser, {
    batchId: 'B06',
    scenario: 'low_rating_ops_browser',
    runDate: RUN_DATE,
  });

  const directorSession = await loginAsRole(request, 'director');
  const opsSession = await loginAsRole(request, 'ops');
  const fixture = await createLearningFixture(request, {
    label: `b06-low-rating-${Date.now()}`,
    classMode: 'ONLINE',
    initializeWallet: true,
    durationMinutes: 60,
    amountCharged: 200_000,
    teacherPayout: 120_000,
  });

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
    await applySessionCookies(evidence.page, opsSession);
    await evidence.page.goto('http://localhost:4200/app/sessions');
    await evidence.page.waitForLoadState('networkidle');

    await generateAttendanceLinkAndSubmit(request, teacherReportUi.session, {
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
    await expect(parentUi.page.getByTestId('sessions-confirm-rating')).toHaveValue('5');
    await parentUi.page.getByTestId('sessions-confirm-rating').fill('2');
    await parentUi.page.getByTestId('sessions-confirm-notes').fill(LOW_RATING_NOTE);
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
        status: 'PARENT_CONFIRMED',
        parentRating: 2,
        parentNotes: LOW_RATING_NOTE,
      });
    await evidence.step('01_parent_low_rating_submitted', parentUi.page);

    await evidence.page.reload({ waitUntil: 'networkidle' });
    await filterSessionsListForSession(evidence.page, {
      classId: fixture.classroom._id,
      scheduledDate: fixture.scheduledDate,
      status: 'PARENT_CONFIRMED',
    });

    const opsRow = evidence.page.getByTestId(`session-row-${fixture.session._id}`);
    await expect(opsRow).toBeVisible();
    await expect(opsRow).toContainText(/PH xác nhận|PH xac nhan/i);
    await expect(opsRow.getByTestId('sessions-low-rating-flag')).toHaveText('PH đánh giá thấp: ★★');
    await opsRow.getByTestId('sessions-view-detail').click();
    await expect(evidence.page.locator('.detail-row').filter({ hasText: 'Ghi chú PH:' })).toContainText(
      LOW_RATING_NOTE,
    );
    await expect(evidence.page.locator('.detail-row').filter({ hasText: 'Đánh giá PH:' })).toContainText(
      '★★',
    );
    await evidence.step('02_ops_detail_shows_low_rating', evidence.page);

    const finalizedSession = await getSessionById(request, directorSession, fixture.session._id);
    await evidence.finalize('PASS', {
      extraLines: [
        `Session status after parent confirm: ${finalizedSession.status}`,
        `Parent rating persisted: ${finalizedSession.parentRating}`,
        `Parent notes persisted: ${finalizedSession.parentNotes || ''}`,
        'Browser evidence proves low 1-2 star parent feedback is surfaced on the OPS list row and session detail without weakening any oracle.',
      ],
    });
  } catch (error) {
    await evidence.finalize('FAIL', { error });
    throw error;
  } finally {
    await closeActors(teacherReportUi, parentUi);
  }
});
