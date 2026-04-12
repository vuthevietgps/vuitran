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
const EMPLOYEE_PERFORMANCE_API = new RegExp(
  `${API_PREFIX_PATTERN}/dashboard/director/employee-performance(?:\\?.*)?$`,
);

type TeacherPerf = {
  _id: string;
  name: string;
  email: string;
  totalSessions: number;
  reportRate: number;
  avgRating: number | null;
};

type SalesPerf = {
  _id: string;
  name: string;
  email: string;
  totalLeads: number;
  convertedLeads: number;
  conversionRate: number;
  revenue: number;
  commission: number;
};

type OpsPerf = {
  _id: string;
  name: string;
  email: string;
  totalTickets: number;
  resolvedTickets: number;
  resolutionRate: number;
};

type EmployeePerformanceState = {
  teachers: TeacherPerf[];
  sales: SalesPerf[];
  ops: OpsPerf[];
  requestUrls: string[];
};

function appUrl(path: string): string {
  return new URL(path, APP_BASE_URL).toString();
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function formatUiNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

function createEmployeePerformanceState(): EmployeePerformanceState {
  return {
    teachers: [
      {
        _id: 'teacher-alpha',
        name: 'Teacher Alpha',
        email: 'alpha.teacher@example.com',
        totalSessions: 32,
        reportRate: 96.5,
        avgRating: 4.8,
      },
      {
        _id: 'teacher-bravo',
        name: 'Teacher Bravo',
        email: 'bravo.teacher@example.com',
        totalSessions: 18,
        reportRate: 81.2,
        avgRating: 4.1,
      },
    ],
    sales: [
      {
        _id: 'sale-alpha',
        name: 'Sale Alpha',
        email: 'alpha.sale@example.com',
        totalLeads: 42,
        convertedLeads: 16,
        conversionRate: 38.1,
        revenue: 54_000_000,
        commission: 5_400_000,
      },
      {
        _id: 'sale-bravo',
        name: 'Sale Bravo',
        email: 'bravo.sale@example.com',
        totalLeads: 27,
        convertedLeads: 11,
        conversionRate: 40.7,
        revenue: 38_500_000,
        commission: 3_850_000,
      },
    ],
    ops: [
      {
        _id: 'ops-alpha',
        name: 'Ops Alpha',
        email: 'alpha.ops@example.com',
        totalTickets: 64,
        resolvedTickets: 58,
        resolutionRate: 90.6,
      },
      {
        _id: 'ops-delta',
        name: 'Ops Delta',
        email: 'delta.ops@example.com',
        totalTickets: 23,
        resolvedTickets: 19,
        resolutionRate: 82.6,
      },
    ],
    requestUrls: [],
  };
}

async function openEmployeePerformancePage(
  browser: Browser,
  request: APIRequestContext,
  scenario: string,
): Promise<BatchEvidenceSession> {
  const batch = await createBatchEvidenceContext(browser, {
    batchId: 'B11',
    scenario,
  });
  const session = await loginAsRole(request, 'director');
  await applySessionCookies(batch.page, session);
  return batch;
}

async function installEmployeePerformanceRoutes(
  page: Page,
  state: EmployeePerformanceState,
): Promise<void> {
  await page.context().route(EMPLOYEE_PERFORMANCE_API, async (route) => {
    state.requestUrls.push(route.request().url());
    await page.waitForTimeout(150);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        teachers: clone(state.teachers),
        sales: clone(state.sales),
        ops: clone(state.ops),
      }),
    });
  });
}

async function tableNames(page: Page, tab: 'teachers' | 'sales' | 'ops'): Promise<string[]> {
  return page
    .locator(`[data-testid="employee-performance-table-${tab}"] tbody tr .name-cell strong`)
    .evaluateAll((nodes) => nodes.map((node) => (node.textContent || '').trim()));
}

test.use({
  trace: 'off',
  video: 'on',
});

test.describe.configure({ mode: 'serial', timeout: 120_000 });
test.setTimeout(120_000);

test('B11 employee-performance loads teachers, filters by keyword, and keeps exact teacher detail metrics', async ({
  browser,
  request,
}) => {
  const state = createEmployeePerformanceState();
  const batch = await openEmployeePerformancePage(
    browser,
    request,
    'employee_performance_teacher_filter_detail_browser',
  );

  try {
    await installEmployeePerformanceRoutes(batch.page, state);
    await batch.page.goto(appUrl('/app/employee-performance'));
    await batch.page.waitForLoadState('domcontentloaded');

    await expect(batch.page.getByTestId('employee-performance-page')).toBeVisible();
    await expect(batch.page.getByTestId('employee-performance-heading')).toContainText('Hieu suat nhan vien');
    await expect(batch.page.locator('.tab-bar button')).toHaveCount(3);
    await expect.poll(() => state.requestUrls.length).toBe(1);

    await expect(batch.page.getByTestId('employee-performance-table-teachers')).toBeVisible();
    expect(await tableNames(batch.page, 'teachers')).toEqual(['Teacher Alpha', 'Teacher Bravo']);
    await expect(batch.page.getByTestId('employee-performance-result-count')).toHaveText('2 ket qua');
    await batch.step('01-dashboard-load-teachers');

    await batch.page.getByTestId('employee-performance-filter-input').fill('bravo.teacher@example.com');
    await expect(batch.page.getByTestId('employee-performance-result-count')).toHaveText('1 ket qua');
    await expect(batch.page.getByTestId('employee-performance-row-teachers-0')).toContainText('Teacher Bravo');
    await expect(batch.page.getByTestId('employee-performance-table-teachers')).not.toContainText('Teacher Alpha');
    await expect.poll(() => state.requestUrls.length).toBe(1);
    await batch.step('02-teacher-filter-keyword');

    await batch.page.getByTestId('employee-performance-detail-button-teachers-0').click();
    const modal = batch.page.getByTestId('employee-performance-detail-modal');
    await expect(modal).toBeVisible();
    await expect(batch.page.getByTestId('employee-performance-detail-title')).toHaveText(
      'Chi tiet hieu suat: Teacher Bravo',
    );
    await expect(batch.page.getByTestId('employee-performance-detail-email')).toContainText(
      'bravo.teacher@example.com',
    );
    await expect(batch.page.getByTestId('employee-performance-detail-total-sessions')).toContainText('18');
    await expect(batch.page.getByTestId('employee-performance-detail-report-rate')).toContainText('81.2%');
    await expect(batch.page.getByTestId('employee-performance-detail-avg-rating')).toContainText('4.1/5');
    await batch.step('03-teacher-detail-modal');

    await batch.finalize('PASS', {
      extraLines: [
        'Employee performance dashboard loads the director-only teachers table from the exact mocked API payload: PASS',
        'Keyword filter narrows the teachers table by exact name/email match without issuing an extra API request: PASS',
        'Teacher detail modal keeps the exact email, total sessions, report rate, and average rating for the filtered row: PASS',
      ],
    });
  } catch (error) {
    await batch.finalize('FAIL', { error });
    throw error;
  }
});

test('B11 employee-performance keeps sales and ops filter-detail flows exact on the shared dashboard', async ({
  browser,
  request,
}) => {
  const state = createEmployeePerformanceState();
  const batch = await openEmployeePerformancePage(
    browser,
    request,
    'employee_performance_sales_ops_filter_detail_browser',
  );

  try {
    await installEmployeePerformanceRoutes(batch.page, state);
    await batch.page.goto(appUrl('/app/employee-performance'));
    await batch.page.waitForLoadState('domcontentloaded');

    await expect.poll(() => state.requestUrls.length).toBe(1);

    await batch.page.getByTestId('employee-performance-tab-sales').click();
    await expect(batch.page.getByTestId('employee-performance-table-sales')).toBeVisible();
    expect(await tableNames(batch.page, 'sales')).toEqual(['Sale Alpha', 'Sale Bravo']);

    await batch.page.getByTestId('employee-performance-filter-input').fill('bravo.sale@example.com');
    await expect(batch.page.getByTestId('employee-performance-result-count')).toHaveText('1 ket qua');
    await expect(batch.page.getByTestId('employee-performance-row-sales-0')).toContainText('Sale Bravo');
    await expect(batch.page.getByTestId('employee-performance-table-sales')).not.toContainText('Sale Alpha');
    await expect.poll(() => state.requestUrls.length).toBe(1);

    await batch.page.getByTestId('employee-performance-detail-button-sales-0').click();
    await expect(batch.page.getByTestId('employee-performance-detail-title')).toHaveText(
      'Chi tiet hieu suat: Sale Bravo',
    );
    await expect(batch.page.getByTestId('employee-performance-detail-total-leads')).toContainText('27');
    await expect(batch.page.getByTestId('employee-performance-detail-converted-leads')).toContainText('11');
    await expect(batch.page.getByTestId('employee-performance-detail-conversion-rate')).toContainText('40.7%');
    await expect(batch.page.getByTestId('employee-performance-detail-revenue')).toContainText(
      formatUiNumber(38_500_000),
    );
    await expect(batch.page.getByTestId('employee-performance-detail-commission')).toContainText(
      formatUiNumber(3_850_000),
    );
    await batch.page.getByTestId('employee-performance-detail-close').click();
    await batch.step('01-sales-filter-detail');

    await batch.page.getByTestId('employee-performance-filter-clear').click();
    await expect(batch.page.getByTestId('employee-performance-result-count')).toHaveText('2 ket qua');
    await batch.page.getByTestId('employee-performance-tab-ops').click();
    await expect(batch.page.getByTestId('employee-performance-table-ops')).toBeVisible();
    expect(await tableNames(batch.page, 'ops')).toEqual(['Ops Alpha', 'Ops Delta']);

    await batch.page.getByTestId('employee-performance-filter-input').fill('delta.ops@example.com');
    await expect(batch.page.getByTestId('employee-performance-result-count')).toHaveText('1 ket qua');
    await expect(batch.page.getByTestId('employee-performance-row-ops-0')).toContainText('Ops Delta');
    await expect(batch.page.getByTestId('employee-performance-table-ops')).not.toContainText('Ops Alpha');
    await expect.poll(() => state.requestUrls.length).toBe(1);

    await batch.page.getByTestId('employee-performance-detail-button-ops-0').click();
    await expect(batch.page.getByTestId('employee-performance-detail-title')).toHaveText(
      'Chi tiet hieu suat: Ops Delta',
    );
    await expect(batch.page.getByTestId('employee-performance-detail-total-tickets')).toContainText('23');
    await expect(batch.page.getByTestId('employee-performance-detail-resolved-tickets')).toContainText('19');
    await expect(batch.page.getByTestId('employee-performance-detail-resolution-rate')).toContainText('82.6%');
    await batch.step('02-ops-filter-detail');

    await batch.finalize('PASS', {
      extraLines: [
        'Sales tab keeps exact sorted rows, keyword filtering, and detail metrics for leads, conversions, revenue, and commission: PASS',
        'Ops tab keeps exact sorted rows, keyword filtering, and detail metrics for ticket workload and resolution rate: PASS',
        'Switching tabs and filtering stays local to the shared dashboard and does not trigger redundant employee-performance API refetches: PASS',
      ],
    });
  } catch (error) {
    await batch.finalize('FAIL', { error });
    throw error;
  }
});
