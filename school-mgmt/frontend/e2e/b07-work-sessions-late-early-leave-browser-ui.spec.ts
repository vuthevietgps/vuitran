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
  scheduledStartTime?: string;
  scheduledEndTime?: string;
  isEarlyLeave?: boolean;
  earlyLeaveMinutes?: number;
};

function appUrl(path: string): string {
  return new URL(path, APP_BASE_URL).toString();
}

test.use({ video: 'on' });
test.describe.configure({ mode: 'serial', timeout: 180_000 });

test('B07 work sessions keeps red late and early-leave badges tied to scheduled shift times', async ({
  browser,
  request,
}) => {
  test.slow();

  const evidence = await createBatchEvidenceContext(browser, {
    batchId: 'B07',
    scenario: 'work_sessions_late_early_leave_browser',
    runDate: RUN_DATE,
  });

  const directorSession = await loginAsRole(request, 'director');
  const listQueries: Array<{ fromDate: string | null; toDate: string | null }> = [];

  const sessions: WorkSession[] = [
    {
      _id: 'ws-late-001',
      userId: {
        _id: 'teacher-late-001',
        fullName: 'Teacher Late',
      },
      date: '2026-04-10T00:00:00.000Z',
      loginTime: '2026-04-10T08:15:00+07:00',
      logoutTime: '2026-04-10T17:30:00+07:00',
      totalMinutes: 555,
      status: 'COMPLETED',
      isLate: true,
      lateMinutes: 15,
      scheduledStartTime: '08:00',
      scheduledEndTime: '17:30',
      isEarlyLeave: false,
      earlyLeaveMinutes: 0,
    },
    {
      _id: 'ws-early-001',
      userId: {
        _id: 'teacher-early-001',
        fullName: 'Teacher Early',
      },
      date: '2026-04-11T00:00:00.000Z',
      loginTime: '2026-04-11T08:00:00+07:00',
      logoutTime: '2026-04-11T16:30:00+07:00',
      totalMinutes: 510,
      status: 'COMPLETED',
      isLate: false,
      lateMinutes: 0,
      scheduledStartTime: '08:00',
      scheduledEndTime: '17:00',
      isEarlyLeave: true,
      earlyLeaveMinutes: 30,
    },
  ];

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
        body: JSON.stringify(sessions),
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

    const lateRow = evidence.page.locator('table.data tbody tr').filter({ hasText: 'Teacher Late' });
    await expect(lateRow).toHaveCount(1);
    await expect(lateRow).toContainText('10/04/2026');
    await expect(lateRow).toContainText('08:15');
    await expect(lateRow).toContainText('17:30');
    await expect(lateRow).toContainText('Ca 08:00-17:30');
    const lateBadge = lateRow.locator('.late-badge');
    await expect(lateBadge).toHaveText('+15p');
    await expect(lateBadge).toHaveCSS('color', 'rgb(220, 38, 38)');
    await expect(lateBadge).toHaveCSS('background-color', 'rgb(254, 226, 226)');

    const earlyRow = evidence.page.locator('table.data tbody tr').filter({ hasText: 'Teacher Early' });
    await expect(earlyRow).toHaveCount(1);
    await expect(earlyRow).toContainText('11/04/2026');
    await expect(earlyRow).toContainText('08:00');
    await expect(earlyRow).toContainText('16:30');
    await expect(earlyRow).toContainText('Ca 08:00-17:00');
    const earlyBadge = earlyRow.locator('.early-leave-badge');
    await expect(earlyBadge).toHaveText('Về sớm 30p');
    await expect(earlyBadge).toHaveCSS('color', 'rgb(220, 38, 38)');
    await expect(earlyBadge).toHaveCSS('background-color', 'rgb(254, 226, 226)');
    await evidence.step('work-sessions-late-early-leave-visible');

    await evidence.finalize('PASS', {
      extraLines: [
        'Verified the work-sessions list keeps the exact default month query and renders schedule hints so each warning badge stays tied to the expected shift window.',
        'Verified late sessions show the exact red +Np badge while early-leave sessions show a separate red "Về sớm Np" badge instead of collapsing both cases into one ambiguous state.',
      ],
    });
  } catch (error) {
    await evidence.finalize('FAIL', { error });
    throw error;
  }
});
