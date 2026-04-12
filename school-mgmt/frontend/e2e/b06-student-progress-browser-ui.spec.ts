import { expect, test, type APIRequestContext, type Browser, type Page } from '@playwright/test';
import {
  applySessionCookies,
  createBatchEvidenceContext,
  loginAsRole,
  type BatchEvidenceSession,
} from './support';

const APP_BASE_URL =
  process.env['PLAYWRIGHT_BASE_URL'] ||
  process.env['E2E_BASE_URL'] ||
  'http://localhost:4200';

const API_PREFIX_PATTERN = '(?:https?://[^/]+)?(?:/api)?';
const STUDENT_PROGRESS_API = new RegExp(`${API_PREFIX_PATTERN}/sessions/my-children/progress(?:\\?.*)?$`);

type HomeworkItem = {
  topic: string;
  assignedDate: string;
  dueDate: string;
  status: string;
  score: number | null;
};

type TeacherComment = {
  date: string;
  teacherName?: string;
  className?: string;
  comment: string;
};

type ProgressStudent = {
  studentName: string;
  evaluations: {
    averagePerformance: number;
    averageEngagement: number;
    averageComprehension: number;
  };
  progress: {
    sessionsCompleted: number;
    sessionsTotal: number;
    classes: Array<{
      className: string;
      completed: number;
      total: number;
    }>;
  };
  homework: HomeworkItem[];
  teacherComments: TeacherComment[];
};

type StudentProgressState = {
  students: ProgressStudent[];
  requestUrls: string[];
};

function appUrl(path: string): string {
  return new URL(path, APP_BASE_URL).toString();
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

async function openStudentProgress(
  browser: Browser,
  request: APIRequestContext,
  scenario: string,
  setup?: (page: Page) => Promise<void> | void,
): Promise<BatchEvidenceSession> {
  const evidence = await createBatchEvidenceContext(browser, {
    batchId: 'B06',
    scenario,
  });
  const parentSession = await loginAsRole(request, 'parent');
  await applySessionCookies(evidence.page, parentSession);
  if (setup) {
    await setup(evidence.page);
  }
  await evidence.page.goto(appUrl('/app/student-progress'));
  await evidence.page.waitForLoadState('domcontentloaded');
  return evidence;
}

function buildProgressState(): StudentProgressState {
  return {
    students: [
      {
        studentName: 'Minh Anh',
        evaluations: {
          averagePerformance: 92,
          averageEngagement: 88,
          averageComprehension: 90,
        },
        progress: {
          sessionsCompleted: 8,
          sessionsTotal: 10,
          classes: [
            {
              className: 'Math Booster 6A',
              completed: 5,
              total: 6,
            },
            {
              className: 'Science Sprint 6B',
              completed: 3,
              total: 4,
            },
          ],
        },
        homework: [
          {
            topic: 'Phan so nang cao',
            assignedDate: '2026-04-03T12:00:00.000Z',
            dueDate: '2026-04-08T12:00:00.000Z',
            status: 'SUBMITTED',
            score: 9.5,
          },
          {
            topic: 'Doc hieu khoa hoc',
            assignedDate: '2026-04-05T12:00:00.000Z',
            dueDate: '2026-04-09T12:00:00.000Z',
            status: 'IN_PROGRESS',
            score: null,
          },
        ],
        teacherComments: [
          {
            date: '2026-04-09T12:00:00.000Z',
            teacherName: 'Teacher Hoa',
            className: 'Math Booster 6A',
            comment: 'Minh Anh da giai on dinh phan so va chu dong dat cau hoi tren lop.',
          },
        ],
      },
      {
        studentName: 'Bao Chau',
        evaluations: {
          averagePerformance: 76,
          averageEngagement: 81,
          averageComprehension: 79,
        },
        progress: {
          sessionsCompleted: 4,
          sessionsTotal: 6,
          classes: [
            {
              className: 'English Explorers 5C',
              completed: 4,
              total: 6,
            },
          ],
        },
        homework: [
          {
            topic: 'Vocabulary unit 7',
            assignedDate: '2026-04-02T12:00:00.000Z',
            dueDate: '2026-04-06T12:00:00.000Z',
            status: 'GRADED',
            score: 8,
          },
        ],
        teacherComments: [
          {
            date: '2026-04-08T12:00:00.000Z',
            teacherName: 'Teacher Linh',
            className: 'English Explorers 5C',
            comment: 'Bao Chau can tap trung hon o phan nghe, nhung da tra loi tot o phan tu vung.',
          },
        ],
      },
    ],
    requestUrls: [],
  };
}

async function routeStudentProgress(page: Page, state: StudentProgressState, options?: {
  status?: number;
  message?: string;
  delayMs?: number;
}): Promise<void> {
  await page.route(STUDENT_PROGRESS_API, async (route) => {
    state.requestUrls.push(route.request().url());
    const delayMs = options?.delayMs ?? 0;
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    if (options?.status && options.status >= 400) {
      await route.fulfill({
        status: options.status,
        contentType: 'application/json',
        body: JSON.stringify({ message: options.message }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        students: clone(state.students),
      }),
    });
  });
}

test.use({
  trace: 'off',
  video: 'on',
});

test.describe.serial('B06 student progress browser flows', () => {
  test('B06 parent student progress renders exact metrics, homework, and teacher comments per child tab', async ({ browser, request }) => {
    test.slow();
    test.setTimeout(300_000);

    const state = buildProgressState();
    const evidence = await openStudentProgress(
      browser,
      request,
      'student-progress-tabs-content',
      async (page) => {
        await routeStudentProgress(page, state, { delayMs: 500 });
      },
    );

    try {
      await expect(evidence.page.locator('.loading-box')).toBeVisible();
      await evidence.step('01-loading-state');

      await expect(evidence.page.locator('h2')).toContainText(/Tien trinh hoc tap|Tiến trình học tập/i);
      await expect(evidence.page.locator('.support-link')).toHaveAttribute('href', '/app/parent-chat');
      await expect(evidence.page.locator('.tabs button')).toHaveCount(2);
      await expect(evidence.page.locator('.tabs button').first()).toContainText('Minh Anh');
      expect(state.requestUrls).toHaveLength(1);

      const firstCards = evidence.page.locator('.score-card .score-value');
      await expect(firstCards.nth(0)).toHaveText('92');
      await expect(firstCards.nth(1)).toHaveText('88');
      await expect(firstCards.nth(2)).toHaveText('90');
      await expect(evidence.page.locator('.progress-section .progress-card').first()).toContainText('8 / 10');
      await expect(evidence.page.locator('.progress-section .progress-card').nth(1)).toContainText('Math Booster 6A');
      await expect(evidence.page.locator('.progress-section .progress-card').nth(1)).toContainText('5 / 6');
      await expect(evidence.page.locator('.homework-section tbody tr')).toHaveCount(2);
      await expect(evidence.page.locator('.homework-section tbody tr').first()).toContainText('Phan so nang cao');
      await expect(evidence.page.locator('.homework-section tbody tr').first()).toContainText('03/04/2026');
      await expect(evidence.page.locator('.homework-section tbody tr').first()).toContainText('08/04/2026');
      await expect(evidence.page.locator('.homework-section tbody tr').first()).toContainText('9.5');
      await expect(evidence.page.locator('.comments-section')).toContainText('Teacher Hoa');
      await expect(evidence.page.locator('.comments-section')).toContainText('Math Booster 6A');
      await expect(evidence.page.locator('.comments-section')).toContainText('Minh Anh da giai on dinh phan so va chu dong dat cau hoi tren lop.');
      await evidence.step('02-first-child-render');

      await evidence.page.getByRole('button', { name: 'Bao Chau' }).click();
      const secondCards = evidence.page.locator('.score-card .score-value');
      await expect(secondCards.nth(0)).toHaveText('76');
      await expect(secondCards.nth(1)).toHaveText('81');
      await expect(secondCards.nth(2)).toHaveText('79');
      await expect(evidence.page.locator('.progress-section .progress-card').first()).toContainText('4 / 6');
      await expect(evidence.page.locator('.progress-section .progress-card').nth(1)).toContainText('English Explorers 5C');
      await expect(evidence.page.locator('.progress-section .progress-card').nth(1)).toContainText('4 / 6');
      await expect(evidence.page.locator('.homework-section tbody tr')).toHaveCount(1);
      await expect(evidence.page.locator('.homework-section tbody tr').first()).toContainText('Vocabulary unit 7');
      await expect(evidence.page.locator('.homework-section tbody tr').first()).toContainText('8');
      await expect(evidence.page.locator('.comments-section')).toContainText('Teacher Linh');
      await expect(evidence.page.locator('.comments-section')).toContainText('Bao Chau can tap trung hon o phan nghe, nhung da tra loi tot o phan tu vung.');
      await evidence.step('03-second-child-render');

      evidence.note('Parent student-progress page keeps exact child-specific metrics, homework rows, and teacher comments when switching tabs.');
      await evidence.finalize('PASS', {
        extraLines: [
          'Parent student-progress route renders exact metrics for the first child: PASS',
          'Switching child tab rebinds homework, progress, and teacher comments to the selected child: PASS',
        ],
      });
    } catch (error) {
      await evidence.finalize('FAIL', { error });
      throw error;
    }
  });

  test('B06 parent student progress shows exact API error state without stale student data', async ({ browser, request }) => {
    test.slow();
    test.setTimeout(300_000);

    const state = buildProgressState();
    const errorMessage = 'Khong the tai du lieu tien trinh hoc tap cho phu huynh demo.';
    const evidence = await openStudentProgress(
      browser,
      request,
      'student-progress-error-state',
      async (page) => {
        await routeStudentProgress(page, state, {
          status: 500,
          message: errorMessage,
          delayMs: 300,
        });
      },
    );

    try {
      await expect(evidence.page.locator('.loading-box')).toBeVisible();
      await evidence.step('01-loading-state');

      await expect(evidence.page.locator('.error')).toHaveText(errorMessage);
      await expect(evidence.page.locator('.tabs button')).toHaveCount(0);
      await expect(evidence.page.locator('.score-card')).toHaveCount(0);
      await expect(evidence.page.locator('.homework-section')).toHaveCount(0);
      await expect(evidence.page.locator('.comments-section')).toHaveCount(0);
      await evidence.step('02-error-state');

      evidence.note('Parent student-progress page surfaces the exact API error and keeps all child-specific sections empty after a failed load.');
      await evidence.finalize('PASS', {
        extraLines: [
          'Student-progress API error is surfaced with the exact backend message: PASS',
          'No stale child tabs, score cards, homework rows, or teacher comments survive the failed load: PASS',
        ],
      });
    } catch (error) {
      await evidence.finalize('FAIL', { error });
      throw error;
    }
  });
});
