import { expect, test, type Page } from '@playwright/test';
import {
  applySessionCookies,
  createBatchEvidenceContext,
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

const API_PREFIX_PATTERN = 'https?://(?:localhost|127\\.0\\.0\\.1):3000';
const WORK_SESSIONS_LIST_API = new RegExp(`${API_PREFIX_PATTERN}/work-sessions(?:\\?.*)?$`);
const WORK_SESSIONS_SUMMARY_API = new RegExp(`${API_PREFIX_PATTERN}/work-sessions/summary(?:\\?.*)?$`);
const WORK_SESSION_UPDATE_API = new RegExp(`${API_PREFIX_PATTERN}/work-sessions/ws-alpha-001(?:\\?.*)?$`);

type WorkSession = {
  _id: string;
  userId: {
    _id: string;
    fullName: string;
  };
  date: string;
  loginTime: string;
  logoutTime: string | null;
  totalMinutes: number;
  status: string;
  isLate: boolean;
  lateMinutes: number;
  notes?: string;
};

type WorkSessionSummary = {
  fullName: string;
  totalSessions: number;
  totalMinutes: number;
  lateDays: number;
  totalLateMinutes: number;
};

function appUrl(path: string): string {
  return new URL(path, APP_BASE_URL).toString();
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function listRow(page: Page, userName: string) {
  return page.locator('table.data tbody tr').filter({ hasText: userName }).first();
}

test.use({ video: 'on' });
test.describe.configure({ mode: 'serial', timeout: 180_000 });

test('B07 work sessions filter summary and edit flow stay consistent for director', async ({
  browser,
  request,
}) => {
  test.slow();

  const evidence = await createBatchEvidenceContext(browser, {
    batchId: 'B07',
    scenario: 'work_sessions_filter_summary_edit_browser',
    runDate: RUN_DATE,
  });

  const directorSession = await loginAsRole(request, 'director');

  const alphaInitial: WorkSession = {
    _id: 'ws-alpha-001',
    userId: {
      _id: 'teacher-alpha-001',
      fullName: 'Teacher Alpha',
    },
    date: '2026-04-10T00:00:00.000Z',
    loginTime: '2026-04-10T08:30:00+07:00',
    logoutTime: '2026-04-10T10:00:00+07:00',
    totalMinutes: 90,
    status: 'COMPLETED',
    isLate: true,
    lateMinutes: 15,
    notes: 'Alpha original note',
  };

  const betaSession: WorkSession = {
    _id: 'ws-beta-001',
    userId: {
      _id: 'teacher-beta-001',
      fullName: 'Teacher Beta',
    },
    date: '2026-04-11T00:00:00.000Z',
    loginTime: '2026-04-11T09:00:00+07:00',
    logoutTime: null,
    totalMinutes: 0,
    status: 'ACTIVE',
    isLate: false,
    lateMinutes: 0,
    notes: '',
  };

  const alphaUpdated: WorkSession = {
    ...alphaInitial,
    loginTime: '2026-04-10T09:15:00+07:00',
    logoutTime: '2026-04-10T11:00:00+07:00',
    totalMinutes: 105,
    notes: 'Alpha updated note',
  };

  const summaryRows: WorkSessionSummary[] = [
    {
      fullName: 'Teacher Alpha',
      totalSessions: 2,
      totalMinutes: 210,
      lateDays: 1,
      totalLateMinutes: 15,
    },
    {
      fullName: 'Teacher Beta',
      totalSessions: 1,
      totalMinutes: 120,
      lateDays: 0,
      totalLateMinutes: 0,
    },
  ];

  let sessionsState: WorkSession[] = [clone(alphaInitial), clone(betaSession)];
  const listQueries: Array<{ fromDate: string | null; toDate: string | null }> = [];
  const summaryQueries: Array<{ periodStart: string | null; periodEnd: string | null }> = [];
  const updateBodies: unknown[] = [];

  const expectedPatchPayload = {
    loginTime: new Date('2026-04-10T09:15').toISOString(),
    logoutTime: new Date('2026-04-10T11:00').toISOString(),
    notes: 'Alpha updated note',
  };

  try {
    await installRoutes();
    await applySessionCookies(evidence.context, directorSession);
    await evidence.page.goto(appUrl('/app/work-sessions'));
    await evidence.page.waitForLoadState('networkidle');

    await expect(evidence.page).toHaveURL(/\/app\/work-sessions$/);
    await expect(evidence.page.getByRole('heading', { name: 'Chấm công nhân viên' })).toBeVisible();

    const dateInputs = evidence.page.locator('.filters input[type="date"]');
    await dateInputs.nth(0).fill('2026-04-09');
    await dateInputs.nth(1).fill('2026-04-12');

    await expect
      .poll(() => listQueries.at(-1))
      .toEqual({ fromDate: '2026-04-09', toDate: '2026-04-12' });

    await evidence.page.locator('.filters input[placeholder="Lọc theo nhân viên..."]').fill('Alpha');
    const alphaRow = listRow(evidence.page, 'Teacher Alpha');
    await expect(alphaRow).toBeVisible();
    await expect(evidence.page.locator('table.data tbody tr')).toHaveCount(1);
    await expect(alphaRow).toContainText('10/04/2026');
    await expect(alphaRow).toContainText('08:30');
    await expect(alphaRow).toContainText('10:00');
    await expect(alphaRow).toContainText('1g30p');
    await expect(alphaRow).toContainText('Hoàn thành');
    await expect(alphaRow).toContainText('+15p');
    await evidence.step('work-sessions-filtered-list');

    await evidence.page.locator('.toggle-btn').click();
    await expect
      .poll(() => summaryQueries.at(-1))
      .toEqual({ periodStart: '2026-04-01', periodEnd: '2026-04-30' });

    const summaryTable = evidence.page.locator('table.data');
    await expect(summaryTable).toContainText('Teacher Alpha');
    await expect(summaryTable).toContainText('Teacher Beta');
    await expect(summaryTable).toContainText('3g30p');
    await expect(summaryTable).toContainText('2g00p');
    await evidence.step('work-sessions-summary-visible');

    await evidence.page.locator('.toggle-btn').click();
    await expect(alphaRow).toBeVisible();
    await alphaRow.getByRole('button', { name: /Sửa/i }).click();

    const modal = evidence.page.locator('.modal');
    await expect(modal).toBeVisible();
    await expect(modal.locator('input[type="datetime-local"]').nth(0)).toHaveValue('2026-04-10T08:30');
    await expect(modal.locator('input[type="datetime-local"]').nth(1)).toHaveValue('2026-04-10T10:00');
    await expect(modal.locator('textarea')).toHaveValue('Alpha original note');

    await modal.locator('input[type="datetime-local"]').nth(0).fill('2026-04-10T09:15');
    await modal.locator('input[type="datetime-local"]').nth(1).fill('2026-04-10T11:00');
    await modal.locator('textarea').fill('Alpha updated note');
    await evidence.step('work-sessions-edit-form-filled');

    await modal.getByRole('button', { name: 'Cập nhật' }).click();

    await expect.poll(() => updateBodies.length).toBe(1);
    expect(updateBodies[0]).toEqual(expectedPatchPayload);
    await expect(alphaRow).toContainText('09:15');
    await expect(alphaRow).toContainText('11:00');
    await expect(alphaRow).toContainText('1g45p');

    await alphaRow.getByRole('button', { name: /Sửa/i }).click();
    await expect(modal.locator('textarea')).toHaveValue('Alpha updated note');
    await modal.getByRole('button', { name: 'Hủy' }).click();
    await evidence.step('work-sessions-edit-reloaded');

    await evidence.finalize('PASS', {
      extraLines: [
        'Verified director list view reloads with the exact fromDate/toDate query parameters and keyword filtering narrows the table to the expected employee row.',
        'Verified summary view triggers the exact work-sessions/summary period query and renders both employee monthly totals without dropping late-minute information.',
        'Verified edit modal preloads the current session values, sends the exact PATCH payload, and the reloaded list plus reopened modal reflect the updated times and notes.',
      ],
    });
  } catch (error) {
    await evidence.finalize('FAIL', { error });
    throw error;
  }

  async function installRoutes(): Promise<void> {
    await evidence.page.route(WORK_SESSIONS_SUMMARY_API, async (route) => {
      const url = new URL(route.request().url());
      summaryQueries.push({
        periodStart: url.searchParams.get('periodStart'),
        periodEnd: url.searchParams.get('periodEnd'),
      });
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(clone(summaryRows)),
      });
    });

    await evidence.page.route(WORK_SESSIONS_LIST_API, async (route) => {
      if (route.request().method() !== 'GET') {
        await route.fallback();
        return;
      }
      const url = new URL(route.request().url());
      listQueries.push({
        fromDate: url.searchParams.get('fromDate'),
        toDate: url.searchParams.get('toDate'),
      });
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(clone(sessionsState)),
      });
    });

    await evidence.page.route(WORK_SESSION_UPDATE_API, async (route) => {
      if (route.request().method() !== 'PATCH') {
        await route.fallback();
        return;
      }
      const body = route.request().postDataJSON();
      updateBodies.push(body);
      sessionsState = [clone(alphaUpdated), clone(betaSession)];
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
    });
  }
});
