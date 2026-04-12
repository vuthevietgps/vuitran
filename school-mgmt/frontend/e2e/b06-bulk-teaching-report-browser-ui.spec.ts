import { expect, test } from '@playwright/test';
import {
  apiJson,
  applySessionCookies,
  createBatchEvidenceContext,
  createLearningFixture,
  createParentAccount,
  generateAttendanceLinkAndSubmit,
  getSessionById,
  loginAsCredentials,
  loginAsRole,
} from './support';

const APP_BASE_URL =
  process.env['PLAYWRIGHT_BASE_URL'] ||
  process.env['E2E_BASE_URL'] ||
  'http://localhost:4200';

const RUN_DATE =
  process.env['UI_EVIDENCE_DATE'] ||
  process.env['E2E_RUN_DATE'] ||
  '2026-04-11';

const BULK_REPORT = {
  lessonContent:
    'Bulk offline report covers vocabulary review, grammar consolidation, and paired speaking practice for the whole class.',
  studentAttitude:
    'Both students stayed cooperative, answered prompts actively, and completed the shared speaking drills.',
  recordingUrl: 'https://example.com/e2e/b06-bulk-offline-report',
  teacherComment:
    'Teacher submitted one offline class report so the team does not need to re-enter the same lesson twice.',
  homework:
    'Review the vocabulary sheet, rewrite five grammar sentences, and prepare one short speaking response.',
  additionalNotes:
    'Bulk-report browser proof keeps one exact payload applied to every offline student session in the class.',
};

function appUrl(path: string): string {
  return new URL(path, APP_BASE_URL).toString();
}

async function createSecondOfflineStudent(request: Parameters<typeof apiJson>[0], directorSession: any, fixture: Awaited<ReturnType<typeof createLearningFixture>>, label: string) {
  const secondParent = await createParentAccount(request, directorSession, `${label}-parent-2`);

  const secondStudent = await apiJson<any>(
    request,
    directorSession,
    'POST',
    '/students',
    {
      studentCode: `HS${Date.now().toString().slice(-8)}`,
      fullName: `E2E Student ${label} B`,
      age: 11,
      parentName: secondParent.fullName,
      parentPhone: secondParent.phone,
      parentUserId: secondParent._id,
      faceImage: 'default-avatar.png',
      productPackage: fixture.product._id,
      level: 'Starter',
      studentType: 'OFFLINE',
      saleId: fixture.sale._id,
      saleName: fixture.sale.fullName,
    },
  );

  await apiJson(
    request,
    directorSession,
    'POST',
    `/students/${secondStudent._id}/approve`,
    {
      action: 'APPROVE',
    },
  );

  await apiJson(
    request,
    directorSession,
    'POST',
    `/classes/${fixture.classroom._id}/assign-students`,
    {
      studentIds: [secondStudent._id],
    },
  );

  return { secondParent, secondStudent };
}

async function createSecondSession(
  request: Parameters<typeof apiJson>[0],
  directorSession: any,
  fixture: Awaited<ReturnType<typeof createLearningFixture>>,
  secondParentId: string,
  secondStudentId: string,
) {
  return apiJson<any>(
    request,
    directorSession,
    'POST',
    '/sessions',
    {
      classId: fixture.classroom._id,
      studentId: secondStudentId,
      teacherId: fixture.teacher._id,
      parentUserId: secondParentId,
      scheduledDate: fixture.scheduledDate,
      durationMinutes: fixture.session.durationMinutes,
      amountCharged: fixture.session.amountCharged,
      teacherPayout: fixture.session.teacherPayout,
    },
  );
}

async function markAttendanceAndComplete(
  request: Parameters<typeof apiJson>[0],
  teacherSession: any,
  fixture: Awaited<ReturnType<typeof createLearningFixture>>,
  studentId: string,
) {
  await generateAttendanceLinkAndSubmit(request, teacherSession, {
    classId: fixture.classroom._id,
    studentId,
    date: fixture.scheduledDate,
  });
}

test('B06 bulk teaching report lets a teacher submit one offline report for multiple students in the same class', async ({
  browser,
  request,
}) => {
  test.slow();
  test.setTimeout(300_000);

  const label = `b06-bulk-report-${Date.now()}`;
  const directorSession = await loginAsRole(request, 'director');
  const fixture = await createLearningFixture(request, {
    label,
    classMode: 'OFFLINE',
    initializeWallet: true,
  });
  const teacherSession = await loginAsCredentials(
    request,
    'teacher',
    fixture.teacher.email,
    fixture.teacher.password,
  );
  const { secondParent, secondStudent } = await createSecondOfflineStudent(
    request,
    directorSession,
    fixture,
    label,
  );
  const secondSession = await createSecondSession(
    request,
    directorSession,
    fixture,
    secondParent._id,
    secondStudent._id,
  );

  const evidence = await createBatchEvidenceContext(browser, {
    batchId: 'B06',
    scenario: 'bulk_teaching_report_browser',
    runDate: RUN_DATE,
  });

  try {
    await markAttendanceAndComplete(
      request,
      teacherSession,
      fixture,
      fixture.student._id,
    );
    await markAttendanceAndComplete(
      request,
      teacherSession,
      fixture,
      secondStudent._id,
    );

    await expect
      .poll(async () => {
        const first = await getSessionById(request, directorSession, fixture.session._id);
        const second = await getSessionById(request, directorSession, secondSession._id);
        return [first.status, second.status].join('|');
      })
      .toBe('TEACHER_COMPLETED|TEACHER_COMPLETED');

    await applySessionCookies(evidence.page, teacherSession);
    await evidence.page.goto(appUrl('/app/teaching-report'));
    await evidence.page.waitForLoadState('networkidle');

    await evidence.page.getByTestId('report-month-filter').fill(fixture.scheduledDate.slice(0, 7));
    const dateInputs = evidence.page.locator('.filter-row input[type="date"]');
    await dateInputs.nth(0).fill(fixture.scheduledDate);
    await dateInputs.nth(1).fill(fixture.scheduledDate);
    await evidence.page.getByTestId('report-apply-filters').click();

    const bulkKey = `${fixture.classroom._id}-${fixture.scheduledDate}`;
    const bulkCard = evidence.page.getByTestId(`bulk-report-card-${bulkKey}`);
    await expect(bulkCard).toBeVisible();
    await expect(bulkCard).toContainText('Bulk Offline');
    await expect(bulkCard).toContainText(fixture.classroom.name);
    await expect(bulkCard).toContainText(fixture.student.fullName);
    await expect(bulkCard).toContainText(secondStudent.fullName);
    await evidence.step('01_bulk_card_visible', evidence.page);

    await evidence.page.getByTestId(`bulk-report-toggle-${bulkKey}`).click();
    const bulkForm = evidence.page.getByTestId(`bulk-report-form-${bulkKey}`);
    await expect(bulkForm).toBeVisible();

    await bulkForm.getByTestId('report-lesson-content').fill(BULK_REPORT.lessonContent);
    await bulkForm.getByTestId('report-student-attitude').fill(BULK_REPORT.studentAttitude);
    await bulkForm.getByTestId('report-recording-url').fill(BULK_REPORT.recordingUrl);
    await bulkForm.getByTestId('report-teacher-comment').fill(BULK_REPORT.teacherComment);
    await bulkForm.getByTestId('report-homework').fill(BULK_REPORT.homework);
    await bulkForm.getByTestId('report-additional-notes').fill(BULK_REPORT.additionalNotes);
    const bulkSubmitResponsePromise = evidence.page.waitForResponse(
      (response) =>
        response.request().method() === 'PATCH'
        && response.url().includes('/sessions/bulk-teaching-report'),
    );
    await bulkForm.getByTestId('report-submit').click();

    const bulkSubmitResponse = await bulkSubmitResponsePromise;
    expect(bulkSubmitResponse.status()).toBe(200);
    await expect
      .poll(async () => bulkSubmitResponse.json())
      .toEqual({
        updatedCount: 2,
        skippedCount: 0,
        results: expect.any(Array),
      });
    await expect(bulkForm).toBeHidden();

    await expect
      .poll(async () => {
        const first = await getSessionById(request, directorSession, fixture.session._id);
        const second = await getSessionById(request, directorSession, secondSession._id);
        return {
          firstHasReport: first.hasTeachingReport === true,
          secondHasReport: second.hasTeachingReport === true,
          firstLessonContent: first.teachingReport?.lessonContent || '',
          secondLessonContent: second.teachingReport?.lessonContent || '',
          firstTeacherComment: first.teachingReport?.teacherComment || '',
          secondTeacherComment: second.teachingReport?.teacherComment || '',
          firstHomework: first.teachingReport?.homework || '',
          secondHomework: second.teachingReport?.homework || '',
        };
      })
      .toEqual({
        firstHasReport: true,
        secondHasReport: true,
        firstLessonContent: BULK_REPORT.lessonContent,
        secondLessonContent: BULK_REPORT.lessonContent,
        firstTeacherComment: BULK_REPORT.teacherComment,
        secondTeacherComment: BULK_REPORT.teacherComment,
        firstHomework: BULK_REPORT.homework,
        secondHomework: BULK_REPORT.homework,
      });
    await evidence.step('02_bulk_submit_persists_to_both_sessions', evidence.page);

    await evidence.page.getByTestId('report-tab-completed').click();
    const completedView = evidence.page.locator('app-teaching-report-completed');
    const completedCards = completedView.locator('.session-card.completed');
    await expect(completedCards).toHaveCount(2);
    await expect(
      completedView.getByText(`HS: ${fixture.student.fullName}`, { exact: true }),
    ).toBeVisible();
    await expect(
      completedView.getByText(`HS: ${secondStudent.fullName}`, { exact: true }),
    ).toBeVisible();

    await evidence.finalize('PASS', {
      extraLines: [
        `Class: ${fixture.classroom.name} (${fixture.classroom._id})`,
        `Sessions updated: ${fixture.session._id}, ${secondSession._id}`,
        'Browser evidence proves one offline bulk teaching report can update multiple student sessions without weakening any oracle.',
      ],
    });
  } catch (error) {
    await evidence.finalize('FAIL', { error });
    throw error;
  }
});
