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

const API_PREFIX_PATTERN = 'https?://(?:localhost|127\\.0\\.0\\.1):3000';
const PARENT_ATTENDANCE_API = new RegExp(`${API_PREFIX_PATTERN}/attendance/my-children(?:\\?.*)?$`);
const PARENT_ATTENDANCE_STATS_API = new RegExp(
  `${API_PREFIX_PATTERN}/attendance/my-children/stats(?:\\?.*)?$`,
);

const STUDENT_AN_ID = 'student-parent-attendance-001';
const STUDENT_BINH_ID = 'student-parent-attendance-002';
const RELOAD_FROM_DATE = '2026-04-08';
const RELOAD_TO_DATE = '2026-04-10';

type ParentAttendanceHarness = {
  recordRequestUrls: string[];
  statsRequestUrls: string[];
};

function appUrl(path: string): string {
  return new URL(path, APP_BASE_URL).toString();
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function buildRecordsResponse(rangeKey: 'initial' | 'reload') {
  if (rangeKey === 'reload') {
    return {
      children: [
        {
          student: {
            _id: STUDENT_AN_ID,
            fullName: 'Be An',
          },
          records: [],
        },
        {
          student: {
            _id: STUDENT_BINH_ID,
            fullName: 'Be Binh',
          },
          records: [
            {
              _id: 'attendance-parent-binh-002',
              date: '2026-04-09T00:00:00.000Z',
              status: 'PRESENT',
              className: 'English Spark',
              classCode: 'CLS-ENG-02',
              notes: 'Di hoc day du',
              parentConfirm: 'OK',
            },
            {
              _id: 'attendance-parent-binh-003',
              date: '2026-04-10T00:00:00.000Z',
              status: 'LATE',
              className: 'English Spark',
              classCode: 'CLS-ENG-02',
              notes: 'Tre 5 phut',
              parentConfirm: 'PENDING',
            },
          ],
        },
      ],
    };
  }

  return {
    children: [
      {
        student: {
          _id: STUDENT_AN_ID,
          fullName: 'Be An',
        },
        records: [
          {
            _id: 'attendance-parent-an-001',
            date: '2026-04-03T00:00:00.000Z',
            status: 'PRESENT',
            className: 'Math Focus',
            classCode: 'CLS-MATH-01',
            notes: 'Tap trung tot',
            parentConfirm: 'OK',
          },
          {
            _id: 'attendance-parent-an-002',
            date: '2026-04-05T00:00:00.000Z',
            status: 'LATE',
            className: 'Math Focus',
            classCode: 'CLS-MATH-01',
            notes: 'Den tre 10 phut',
            parentConfirm: 'PENDING',
          },
        ],
      },
      {
        student: {
          _id: STUDENT_BINH_ID,
          fullName: 'Be Binh',
        },
        records: [
          {
            _id: 'attendance-parent-binh-001',
            date: '2026-04-07T00:00:00.000Z',
            status: 'ABSENT',
            className: 'English Spark',
            classCode: 'CLS-ENG-02',
            notes: 'Om sot',
            parentConfirm: 'PENDING',
          },
        ],
      },
    ],
  };
}

function buildStatsResponse(rangeKey: 'initial' | 'reload') {
  if (rangeKey === 'reload') {
    return {
      children: [
        {
          student: {
            _id: STUDENT_AN_ID,
            fullName: 'Be An',
          },
          total: 0,
          present: 0,
          absent: 0,
          late: 0,
          presentRate: 0,
          absentRate: 0,
          lateRate: 0,
        },
        {
          student: {
            _id: STUDENT_BINH_ID,
            fullName: 'Be Binh',
          },
          total: 2,
          present: 1,
          absent: 0,
          late: 1,
          presentRate: 50,
          absentRate: 0,
          lateRate: 50,
        },
      ],
    };
  }

  return {
    children: [
      {
        student: {
          _id: STUDENT_AN_ID,
          fullName: 'Be An',
        },
        total: 2,
        present: 1,
        absent: 0,
        late: 1,
        presentRate: 50,
        absentRate: 0,
        lateRate: 50,
      },
      {
        student: {
          _id: STUDENT_BINH_ID,
          fullName: 'Be Binh',
        },
        total: 1,
        present: 0,
        absent: 1,
        late: 0,
        presentRate: 0,
        absentRate: 100,
        lateRate: 0,
      },
    ],
  };
}

async function openParentAttendance(
  browser: Browser,
  request: APIRequestContext,
  scenario: string,
  setup?: (page: Page) => Promise<void> | void,
): Promise<BatchEvidenceSession> {
  const batch = await createBatchEvidenceContext(browser, {
    batchId: 'B05',
    scenario,
  });
  const parentSession = await loginAsRole(request, 'parent');
  await applySessionCookies(batch.page, parentSession);
  if (setup) {
    await setup(batch.page);
  }
  await batch.page.goto(appUrl('/app/parent-attendance'));
  await batch.page.waitForLoadState('domcontentloaded');
  return batch;
}

async function routeParentAttendance(page: Page): Promise<ParentAttendanceHarness> {
  const harness: ParentAttendanceHarness = {
    recordRequestUrls: [],
    statsRequestUrls: [],
  };
  const delayMs = 180;

  await page.route(PARENT_ATTENDANCE_API, async (route) => {
    const url = route.request().url();
    harness.recordRequestUrls.push(url);
    const parsed = new URL(url);
    const rangeKey =
      parsed.searchParams.get('fromDate') === RELOAD_FROM_DATE &&
      parsed.searchParams.get('toDate') === RELOAD_TO_DATE
        ? 'reload'
        : 'initial';

    await new Promise((resolve) => setTimeout(resolve, delayMs));
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(clone(buildRecordsResponse(rangeKey))),
    });
  });

  await page.route(PARENT_ATTENDANCE_STATS_API, async (route) => {
    const url = route.request().url();
    harness.statsRequestUrls.push(url);
    const parsed = new URL(url);
    const rangeKey =
      parsed.searchParams.get('fromDate') === RELOAD_FROM_DATE &&
      parsed.searchParams.get('toDate') === RELOAD_TO_DATE
        ? 'reload'
        : 'initial';

    await new Promise((resolve) => setTimeout(resolve, delayMs));
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(clone(buildStatsResponse(rangeKey))),
    });
  });

  return harness;
}

test.use({
  trace: 'off',
  video: 'on',
});

test.describe.serial('B05 parent attendance browser flows', () => {
  test('B05 parent attendance renders only current parent children with correct stats and scoped records', async ({
    browser,
    request,
  }) => {
    let harness: ParentAttendanceHarness | null = null;
    const batch = await openParentAttendance(
      browser,
      request,
      'parent_attendance_scope_browser',
      async (page) => {
        harness = await routeParentAttendance(page);
      },
    );

    try {
      const page = batch.page;
      await expect(page).toHaveURL(/\/app\/parent-attendance$/);
      await expect(page.locator('h2')).toHaveText('Lich su diem danh');
      await expect(page.locator('.loading-text')).toContainText('Dang tai du lieu...');
      await expect.poll(() => page.locator('.loading-text').count()).toBe(0);
      await expect(page.locator('.stats-grid .stat-name')).toHaveText(['Be An', 'Be Binh']);
      await expect(page.locator('.student-section')).toHaveCount(2);
      await expect(page.locator('.stats-grid').first()).toContainText('2');
      await expect(page.locator('.stats-grid').first()).toContainText('50%');
      await expect(page.locator('.stats-grid').first()).toContainText('1');
      await expect(page.locator('.stats-grid').first()).toContainText('100%');
      await expect(page.locator('.student-section').nth(0)).toContainText('Be An');
      await expect(page.locator('.student-section').nth(0)).toContainText('CLS-MATH-01');
      await expect(page.locator('.student-section').nth(0)).toContainText('Co mat');
      await expect(page.locator('.student-section').nth(0)).toContainText('Di tre');
      await expect(page.locator('.student-section').nth(0)).toContainText('Da xac nhan');
      await expect(page.locator('.student-section').nth(1)).toContainText('Be Binh');
      await expect(page.locator('.student-section').nth(1)).toContainText('CLS-ENG-02');
      await expect(page.locator('.student-section').nth(1)).toContainText('Vang mat');
      await expect(page.locator('.student-section').nth(1)).toContainText('Om sot');
      await expect(page.locator('.student-section').nth(1)).toContainText('Chua xac nhan');
      await expect(page.locator('body')).not.toContainText('Hoc sinh Ngoai Pham Vi');

      await batch.step('parent-attendance-scoped-render');

      const fromDate = await page.locator('.filters input[type="date"]').nth(0).inputValue();
      const toDate = await page.locator('.filters input[type="date"]').nth(1).inputValue();
      await expect.poll(() => harness?.recordRequestUrls.length ?? 0).toBe(1);
      await expect.poll(() => harness?.statsRequestUrls.length ?? 0).toBe(1);
      const recordsUrl = new URL(harness!.recordRequestUrls[0]);
      const statsUrl = new URL(harness!.statsRequestUrls[0]);

      expect(recordsUrl.pathname).toBe('/attendance/my-children');
      expect(recordsUrl.searchParams.get('fromDate')).toBe(fromDate);
      expect(recordsUrl.searchParams.get('toDate')).toBe(toDate);
      expect(statsUrl.pathname).toBe('/attendance/my-children/stats');
      expect(statsUrl.searchParams.get('fromDate')).toBe(fromDate);
      expect(statsUrl.searchParams.get('toDate')).toBe(toDate);
      await batch.step('parent-attendance-uses-my-children-endpoints');

      await batch.finalize('PASS', {
        extraLines: [
          'Verified parent attendance page renders only children returned by scoped /attendance/my-children endpoints: PASS',
          'Verified scoped cards and tables show the exact class, status, note, and parent-confirm state per child: PASS',
          'Verified initial load uses /attendance/my-children and /attendance/my-children/stats with the visible date filters: PASS',
        ],
      });
    } catch (error) {
      await batch.finalize('FAIL', {
        extraLines: [error instanceof Error ? error.stack || error.message : String(error)],
      });
      throw error;
    }
  });

  test('B05 parent attendance filters one child locally and refreshes scoped endpoints with the exact date range', async ({
    browser,
    request,
  }) => {
    let harness: ParentAttendanceHarness | null = null;
    const batch = await openParentAttendance(
      browser,
      request,
      'parent_attendance_filter_refresh_browser',
      async (page) => {
        harness = await routeParentAttendance(page);
      },
    );

    try {
      const page = batch.page;
      const studentFilter = page.locator('.filters select');
      const fromDateInput = page.locator('.filters input[type="date"]').nth(0);
      const toDateInput = page.locator('.filters input[type="date"]').nth(1);

      await expect.poll(() => page.locator('.loading-text').count()).toBe(0);
      await expect(studentFilter).toBeVisible();
      await studentFilter.selectOption(STUDENT_BINH_ID);
      await expect(page.locator('.stats-grid .stat-name')).toHaveText(['Be Binh']);
      await expect(page.locator('.student-section')).toHaveCount(1);
      await expect(page.locator('.student-section').first()).toContainText('Be Binh');
      await expect(page.locator('.student-section').first()).not.toContainText('Be An');
      await batch.step('parent-attendance-student-filter');

      const initialRecordRequestCount = harness!.recordRequestUrls.length;
      const initialStatsRequestCount = harness!.statsRequestUrls.length;
      await fromDateInput.fill(RELOAD_FROM_DATE);
      await toDateInput.fill(RELOAD_TO_DATE);
      await page.getByRole('button', { name: 'Lam moi' }).click();

      await expect.poll(() => harness?.recordRequestUrls.length ?? 0).toBeGreaterThan(
        initialRecordRequestCount,
      );
      await expect.poll(() => harness?.statsRequestUrls.length ?? 0).toBeGreaterThan(
        initialStatsRequestCount,
      );

      const latestRecordsUrl = new URL(harness!.recordRequestUrls.at(-1)!);
      const latestStatsUrl = new URL(harness!.statsRequestUrls.at(-1)!);
      expect(
        harness!.recordRequestUrls.some((url) => {
          const parsed = new URL(url);
          return (
            parsed.searchParams.get('fromDate') === RELOAD_FROM_DATE &&
            parsed.searchParams.get('toDate') === RELOAD_TO_DATE
          );
        }),
      ).toBe(true);
      expect(
        harness!.statsRequestUrls.some((url) => {
          const parsed = new URL(url);
          return (
            parsed.searchParams.get('fromDate') === RELOAD_FROM_DATE &&
            parsed.searchParams.get('toDate') === RELOAD_TO_DATE
          );
        }),
      ).toBe(true);
      expect(latestRecordsUrl.searchParams.get('fromDate')).toBe(RELOAD_FROM_DATE);
      expect(latestRecordsUrl.searchParams.get('toDate')).toBe(RELOAD_TO_DATE);
      expect(latestStatsUrl.searchParams.get('fromDate')).toBe(RELOAD_FROM_DATE);
      expect(latestStatsUrl.searchParams.get('toDate')).toBe(RELOAD_TO_DATE);

      await expect(page.locator('.stats-grid .stat-name')).toHaveText(['Be Binh']);
      await expect(page.locator('.stats-grid').first()).toContainText('2');
      await expect(page.locator('.stats-grid').first()).toContainText('50%');
      await expect(page.locator('.student-section')).toHaveCount(1);
      await expect(page.locator('.student-section').first()).toContainText('Be Binh');
      await expect(page.locator('.student-section').first()).toContainText('Di hoc day du');
      await expect(page.locator('.student-section').first()).toContainText('Tre 5 phut');
      await expect(page.locator('.student-section').first()).toContainText('Da xac nhan');
      await expect(page.locator('.student-section').first()).toContainText('Chua xac nhan');
      await batch.step('parent-attendance-date-refresh');

      await batch.finalize('PASS', {
        extraLines: [
          'Verified selecting one child filters the rendered stats and record sections without leaking sibling data: PASS',
          'Verified refresh sends the exact fromDate/toDate range to both scoped parent-attendance endpoints: PASS',
          'Verified the refreshed child section rebinds to the new scoped payload while keeping parent-only visibility: PASS',
        ],
      });
    } catch (error) {
      await batch.finalize('FAIL', {
        extraLines: [error instanceof Error ? error.stack || error.message : String(error)],
      });
      throw error;
    }
  });
});
