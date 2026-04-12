import { expect, test } from '@playwright/test';
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

function appUrl(path: string): string {
  return new URL(path, APP_BASE_URL).toString();
}

test.use({ video: 'on' });
test.describe.configure({ mode: 'serial', timeout: 180_000 });

test('B07 work sessions shows AUTO_CLOSED status with explicit forgotten checkout warning', async ({
  browser,
  request,
}) => {
  test.slow();

  const evidence = await createBatchEvidenceContext(browser, {
    batchId: 'B07',
    scenario: 'work_sessions_auto_closed_browser',
    runDate: RUN_DATE,
  });

  const directorSession = await loginAsRole(request, 'director');
  const listQueries: Array<{ fromDate: string | null; toDate: string | null }> = [];

  const autoClosedSession = {
    _id: 'ws-auto-closed-001',
    userId: {
      _id: 'teacher-auto-closed-001',
      fullName: 'Teacher Auto Closed',
    },
    date: '2026-04-10T00:00:00.000Z',
    loginTime: '2026-04-10T08:00:00+07:00',
    logoutTime: null,
    totalMinutes: 0,
    status: 'AUTO_CLOSED',
    isLate: false,
    lateMinutes: 0,
    notes: '',
  };

  try {
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
        body: JSON.stringify([autoClosedSession]),
      });
    });

    await applySessionCookies(evidence.context, directorSession);
    await evidence.page.goto(appUrl('/app/work-sessions'));
    await evidence.page.waitForLoadState('networkidle');

    await expect(evidence.page).toHaveURL(/\/app\/work-sessions$/);
    await expect(evidence.page.getByRole('heading', { name: 'Chấm công nhân viên' })).toBeVisible();
    await expect
      .poll(() => listQueries.at(-1))
      .toEqual({ fromDate: '2026-04-01', toDate: '2026-04-30' });

    const row = evidence.page.locator('table.data tbody tr').filter({ hasText: 'Teacher Auto Closed' });
    await expect(row).toHaveCount(1);
    await expect(row).toContainText('10/04/2026');
    await expect(row).toContainText('08:00');
    await expect(row).toContainText('—');
    await expect(row.getByText('Tự đóng do quên check-out')).toBeVisible();
    await evidence.step('work-sessions-auto-closed-visible');

    await evidence.finalize('PASS', {
      extraLines: [
        'Verified the work-sessions list keeps the exact default fromDate/toDate month query and renders AUTO_CLOSED sessions on the live admin table.',
        'Verified the status badge explicitly explains the violation as a forgotten check-out instead of leaving AUTO_CLOSED as an ambiguous generic label.',
      ],
    });
  } catch (error) {
    await evidence.finalize('FAIL', { error });
    throw error;
  }
});
