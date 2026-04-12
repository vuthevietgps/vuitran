import { expect, test, type APIRequestContext, type Browser, type Page } from '@playwright/test';
import {
  applySessionCookies,
  createBatchEvidenceContext,
  loginAsRole,
  type BatchEvidenceSession,
  type DemoRole,
} from './support';

const APP_BASE_URL =
  process.env['PLAYWRIGHT_BASE_URL'] ||
  process.env['E2E_BASE_URL'] ||
  'http://localhost:4200';

const API_ORIGIN_PATTERN = 'https?://(?:localhost|127\\.0\\.0\\.1):3000';
const CLASSES_API = new RegExp(`${API_ORIGIN_PATTERN}/classes(?:\\?.*)?$`);
const SESSIONS_API = new RegExp(`${API_ORIGIN_PATTERN}/sessions(?:\\?.*)?$`);
const COMPLETE_API = new RegExp(`${API_ORIGIN_PATTERN}/sessions/session-complete-001/complete(?:\\?.*)?$`);

function appUrl(path: string): string {
  return new URL(path, APP_BASE_URL).toString();
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

async function signInAs(page: Page, request: APIRequestContext, role: DemoRole): Promise<void> {
  await page.context().clearCookies();
  const session = await loginAsRole(request, role);
  await applySessionCookies(page, session);
}

async function openBatch(browser: Browser, scenario: string): Promise<BatchEvidenceSession> {
  return createBatchEvidenceContext(browser, {
    batchId: 'B05',
    scenario,
  });
}

async function installCompleteModalRoutes(page: Page): Promise<{
  getListCallCount: () => number;
  getCompleteCallCount: () => number;
  getCompleteBodies: () => Array<Record<string, string>>;
}> {
  const state = {
    sessions: [
      {
        _id: 'session-complete-001',
        classId: {
          _id: 'class-complete-001',
          code: 'CLS-COMP-001',
          name: 'Lop Teacher Complete',
        },
        studentId: {
          _id: 'student-complete-001',
          fullName: 'Hoc sinh Complete',
          studentCode: 'HS-COMP-001',
        },
        teacherId: {
          _id: 'teacher-complete-001',
          fullName: 'Teacher Complete',
          email: 'teacher.complete@example.com',
        },
        scheduledDate: '2026-04-10',
        scheduledStartTime: '18:00',
        scheduledEndTime: '19:30',
        attendedAt: '2026-04-10T11:05:00.000Z',
        amountCharged: 450000,
        teacherPayout: 270000,
        durationMinutes: 90,
        status: 'SCHEDULED',
        hasTeachingReport: false,
      },
    ],
  };

  let listCallCount = 0;
  let completeCallCount = 0;
  const completeBodies: Array<Record<string, string>> = [];

  await page.route(CLASSES_API, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          _id: 'class-complete-001',
          code: 'CLS-COMP-001',
          name: 'Lop Teacher Complete',
          students: [{ _id: 'student-complete-001', fullName: 'Hoc sinh Complete' }],
        },
      ]),
    });
  });

  await page.route(SESSIONS_API, async (route) => {
    listCallCount += 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: clone(state.sessions),
        meta: { totalPages: 1, total: state.sessions.length, page: 1, limit: 20 },
      }),
    });
  });

  await page.route(COMPLETE_API, async (route) => {
    completeCallCount += 1;
    completeBodies.push(route.request().postDataJSON() as Record<string, string>);
    state.sessions = state.sessions.map((session) =>
      session._id === 'session-complete-001'
        ? {
            ...session,
            status: 'TEACHER_COMPLETED',
            hasTeachingReport: true,
          }
        : session,
    );
    await new Promise((resolve) => setTimeout(resolve, 250));
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    });
  });

  return {
    getListCallCount: () => listCallCount,
    getCompleteCallCount: () => completeCallCount,
    getCompleteBodies: () => clone(completeBodies),
  };
}

test.use({
  trace: 'off',
  video: 'on',
});

test('B05 teacher complete modal requires topics, homework, notes and reloads the session row after success', async ({
  browser,
  page,
  request,
}) => {
  const batch = await openBatch(browser, 'session_complete_modal_browser');

  try {
    const routes = await installCompleteModalRoutes(page);

    await signInAs(page, request, 'teacher');
    await page.goto(appUrl('/app/sessions'));
    await page.waitForLoadState('domcontentloaded');

    const row = page.getByTestId('session-row-session-complete-001');
    await expect(row).toBeVisible();
    await expect(row.getByTestId('sessions-complete-button')).toBeVisible();
    await expect(row).toContainText('CLS-COMP-001');
    await expect(row).toContainText('Hoc sinh Complete');
    await batch.step('session-complete-row-visible');

    await row.getByTestId('sessions-complete-button').click();

    const modal = page.locator('.modal').filter({ has: page.getByTestId('sessions-complete-submit') });
    const topics = page.getByTestId('sessions-complete-topics');
    const homework = page.getByTestId('sessions-complete-homework');
    const notes = page.getByTestId('sessions-complete-notes');
    const submit = page.getByTestId('sessions-complete-submit');

    await expect(modal).toBeVisible();
    await expect(topics).toBeVisible();
    await expect(homework).toBeVisible();
    await expect(notes).toBeVisible();

    await submit.click();
    await expect.poll(routes.getCompleteCallCount).toBe(0);
    await expect(page.getByTestId('sessions-complete-topics-error')).toHaveText('Vui long nhap noi dung da day.');
    await expect(page.getByTestId('sessions-complete-homework-error')).toHaveText('Vui long nhap bai tap ve nha.');
    await expect(page.getByTestId('sessions-complete-notes-error')).toHaveText('Vui long nhap ghi chu giao vien.');
    await batch.step('complete-modal-blocks-empty-submit');

    await topics.fill('  Luyen phan so va bai toan van  ');
    await submit.click();
    await expect.poll(routes.getCompleteCallCount).toBe(0);
    await expect(page.getByTestId('sessions-complete-topics-error')).toHaveCount(0);
    await expect(page.getByTestId('sessions-complete-homework-error')).toHaveText('Vui long nhap bai tap ve nha.');
    await expect(page.getByTestId('sessions-complete-notes-error')).toHaveText('Vui long nhap ghi chu giao vien.');

    await homework.fill('  Hoan thanh worksheet 5  ');
    await submit.click();
    await expect.poll(routes.getCompleteCallCount).toBe(0);
    await expect(page.getByTestId('sessions-complete-homework-error')).toHaveCount(0);
    await expect(page.getByTestId('sessions-complete-notes-error')).toHaveText('Vui long nhap ghi chu giao vien.');

    await notes.fill('  Can nhac hoc sinh viet loi giai ngan gon hon.  ');
    await expect(page.getByTestId('sessions-complete-notes-error')).toHaveCount(0);

    await submit.click();

    await expect.poll(routes.getCompleteCallCount).toBe(1);
    await expect.poll(() => routes.getCompleteBodies()).toEqual([
      {
        topicsCovered: 'Luyen phan so va bai toan van',
        homework: 'Hoan thanh worksheet 5',
        teacherNotes: 'Can nhac hoc sinh viet loi giai ngan gon hon.',
      },
    ]);
    await expect.poll(routes.getListCallCount).toBe(2);
    await expect(modal).toHaveCount(0);
    await expect(row.getByTestId('sessions-complete-button')).toHaveCount(0);
    await expect(row).toContainText('GV hoàn thành');
    await batch.step('complete-modal-submit-success-and-row-reload');
    await batch.finalize('PASS', {
      extraLines: [
        'Verified the teacher complete modal blocks empty or partial submit with strict field-level required errors: PASS',
        'Verified no POST /sessions/:id/complete is sent until topics, homework, and teacher notes are all present: PASS',
        'Verified the submit payload is trimmed and exact for topicsCovered, homework, and teacherNotes: PASS',
        'Verified success closes the modal, reloads the sessions list, and updates the row status to TEACHER_COMPLETED: PASS',
      ],
    });
  } catch (error) {
    await batch.finalize('FAIL', { error });
    throw error;
  }
});
