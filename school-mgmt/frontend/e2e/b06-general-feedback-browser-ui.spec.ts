import { expect, test, type Page } from '@playwright/test';
import {
  applySessionCookies,
  closeActors,
  createBatchEvidenceContext,
  createLearningFixture,
  generateAttendanceLinkAndSubmit,
  getSessionById,
  initializeWalletForParent,
  loginAsCredentials,
  loginAsRole,
  openCustomPage,
} from './support';

const APP_BASE_URL =
  process.env['PLAYWRIGHT_BASE_URL'] ||
  process.env['E2E_BASE_URL'] ||
  'http://localhost:4200';

const GENERAL_FEEDBACK = {
  overallRating: '5',
  teachingQuality: '4',
  communication: '3',
  facility: '2',
  comment: 'Phụ huynh muốn duy trì giáo viên hiện tại nhưng cần cải thiện thêm phần cơ sở vật chất phòng học.',
};

function appUrl(path: string): string {
  return new URL(path, APP_BASE_URL).toString();
}

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

test('B06 general-feedback form renders full parent fields and persists ratings for the selected finalized session', async ({
  browser,
  request,
}) => {
  test.slow();
  test.setTimeout(300_000);

  const directorSession = await loginAsRole(request, 'director');
  const fixture = await createLearningFixture(request, {
    label: `general-feedback-${Date.now()}`,
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
  const parentSession = await loginAsCredentials(
    request,
    'parent',
    fixture.parent.email,
    fixture.parent.password,
  );

  const teacherReportUi = await openCustomPage(
    browser,
    request,
    'teacher',
    fixture.teacher.email,
    fixture.teacher.password,
    '/app/teaching-report',
  );
  const evidence = await createBatchEvidenceContext(browser, {
    batchId: 'B06',
    scenario: 'general_feedback_browser',
  });

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

    await applySessionCookies(evidence.page, parentSession);
    await evidence.page.goto(appUrl('/app/sessions'));
    await evidence.page.waitForLoadState('networkidle');
    await filterSessionsListForSession(evidence.page, {
      classId: fixture.classroom._id,
      scheduledDate: fixture.scheduledDate,
      status: 'TEACHER_COMPLETED',
    });

    const parentRow = evidence.page.getByTestId(`session-row-${fixture.session._id}`);
    await expect(parentRow).toBeVisible();
    await parentRow.getByTestId('sessions-parent-confirm-button').click();
    await evidence.page.getByTestId('sessions-confirm-rating').fill('5');
    await evidence.page.getByTestId('sessions-confirm-notes').fill(
      'Phụ huynh đã xác nhận buổi học trước khi gửi đánh giá tổng quát.',
    );
    await evidence.page.getByTestId('sessions-confirm-submit').click();

    await expect
      .poll(async () => (await getSessionById(request, directorSession, fixture.session._id)).status)
      .toBe('FINALIZED');

    await evidence.page.reload({ waitUntil: 'networkidle' });
    await filterSessionsListForSession(evidence.page, {
      classId: fixture.classroom._id,
      scheduledDate: fixture.scheduledDate,
      status: 'FINALIZED',
    });

    await expect(evidence.page.getByTestId('sessions-general-feedback-button')).toBeEnabled();
    await evidence.page.getByTestId('sessions-general-feedback-button').click();

    await expect(evidence.page.getByRole('heading', { name: 'Gửi đánh giá tổng quát' })).toBeVisible();
    await expect(evidence.page.getByTestId('sessions-general-feedback-target-session')).toContainText(
      fixture.classroom.code,
    );
    await expect(evidence.page.getByTestId('sessions-general-feedback-overall')).toHaveAttribute('min', '1');
    await expect(evidence.page.getByTestId('sessions-general-feedback-overall')).toHaveAttribute('max', '5');
    await expect(evidence.page.getByTestId('sessions-general-feedback-teaching-quality')).toBeVisible();
    await expect(evidence.page.getByTestId('sessions-general-feedback-communication')).toBeVisible();
    await expect(evidence.page.getByTestId('sessions-general-feedback-facility')).toBeVisible();
    await evidence.step('01_general_feedback_modal_visible', evidence.page);

    await evidence.page.getByTestId('sessions-general-feedback-overall').fill(GENERAL_FEEDBACK.overallRating);
    await evidence.page.getByTestId('sessions-general-feedback-teaching-quality').fill(GENERAL_FEEDBACK.teachingQuality);
    await evidence.page.getByTestId('sessions-general-feedback-communication').fill(GENERAL_FEEDBACK.communication);
    await evidence.page.getByTestId('sessions-general-feedback-facility').fill(GENERAL_FEEDBACK.facility);
    await evidence.page.getByTestId('sessions-general-feedback-comment').fill(GENERAL_FEEDBACK.comment);

    const generalFeedbackResponsePromise = evidence.page.waitForResponse(
      (response) =>
        response.request().method() === 'POST'
        && response.url().includes('/sessions/general-feedback'),
    );
    await evidence.page.getByTestId('sessions-general-feedback-submit').click();

    const generalFeedbackResponse = await generalFeedbackResponsePromise;
    expect(generalFeedbackResponse.status()).toBe(201);
    await expect(evidence.page.getByTestId('sessions-success-alert')).toHaveText('Cảm ơn bạn đã gửi đánh giá!');
    await expect(evidence.page.getByRole('heading', { name: 'Gửi đánh giá tổng quát' })).toHaveCount(0);

    await expect
      .poll(async () => {
        const session = await getSessionById(request, directorSession, fixture.session._id);
        return {
          status: session.status,
          overallRating: session.parentFeedback?.overallRating ?? 0,
          teachingQualityRating: session.parentFeedback?.teachingQualityRating ?? 0,
          communicationRating: session.parentFeedback?.communicationRating ?? 0,
          facilityRating: session.parentFeedback?.facilityRating ?? 0,
          parentNotes: session.parentFeedback?.parentNotes || '',
        };
      })
      .toEqual({
        status: 'FINALIZED',
        overallRating: 5,
        teachingQualityRating: 4,
        communicationRating: 3,
        facilityRating: 2,
        parentNotes: GENERAL_FEEDBACK.comment,
      });
    await evidence.step('02_general_feedback_persisted', evidence.page);

    await evidence.finalize('PASS', {
      extraLines: [
        `Session: ${fixture.session._id}`,
        `Student: ${fixture.student.fullName} (${fixture.student._id})`,
        'Browser evidence proves the parent general-feedback modal renders overall, teachingQuality, communication, and facility fields, then persists them to the selected finalized session without weakening the oracle.',
      ],
    });
  } catch (error) {
    await evidence.finalize('FAIL', { error });
    throw error;
  } finally {
    await closeActors(teacherReportUi);
  }
});
