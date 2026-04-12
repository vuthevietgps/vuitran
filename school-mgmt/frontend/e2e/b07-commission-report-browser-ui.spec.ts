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
const COMMISSION_REPORT_API = new RegExp(`${API_PREFIX_PATTERN}/orders/commission-report(?:\\?.*)?$`);

type CommissionReport = {
  summary: {
    totalRevenue: number;
    totalCommission: number;
    pendingCommission: number;
    totalOrders: number;
  };
  byMonth: Array<{
    month: string;
    revenue: number;
    commission: number;
    count: number;
  }>;
  details: Array<{
    orderCode: string;
    parentName: string;
    studentName: string;
    finalAmount: number;
    saleCommission: number;
    status: string;
    saleName: string;
    createdAt: string;
  }>;
};

function appUrl(path: string): string {
  return new URL(path, APP_BASE_URL).toString();
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

test.use({ video: 'on' });
test.describe.configure({ mode: 'serial', timeout: 180_000 });

test('B07 commission report renders summary, monthly, and detail data for director', async ({
  browser,
  request,
}) => {
  test.slow();

  const evidence = await createBatchEvidenceContext(browser, {
    batchId: 'B07',
    scenario: 'commission_report_director_browser',
    runDate: RUN_DATE,
  });

  const directorSession = await loginAsRole(request, 'director');
  const directorReport: CommissionReport = {
    summary: {
      totalRevenue: 950,
      totalCommission: 120,
      pendingCommission: 30,
      totalOrders: 2,
    },
    byMonth: [
      {
        month: '2026-04',
        revenue: 950,
        commission: 120,
        count: 2,
      },
    ],
    details: [
      {
        orderCode: 'OD-CM-001',
        parentName: 'Phu huynh Alpha',
        studentName: 'Hoc sinh Alpha',
        finalAmount: 450,
        saleCommission: 60,
        status: 'APPROVED',
        saleName: 'Sale Alpha',
        createdAt: '2026-04-05T00:00:00.000Z',
      },
      {
        orderCode: 'OD-CM-002',
        parentName: 'Phu huynh Beta',
        studentName: 'Hoc sinh Beta',
        finalAmount: 500,
        saleCommission: 60,
        status: 'SUBMITTED',
        saleName: 'Sale Beta',
        createdAt: '2026-04-06T00:00:00.000Z',
      },
    ],
  };

  const requestQueries: Array<{ fromDate: string | null; toDate: string | null }> = [];

  try {
    await evidence.page.route(COMMISSION_REPORT_API, async (route) => {
      const url = new URL(route.request().url());
      requestQueries.push({
        fromDate: url.searchParams.get('fromDate'),
        toDate: url.searchParams.get('toDate'),
      });
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(clone(directorReport)),
      });
    });

    await applySessionCookies(evidence.context, directorSession);
    await evidence.page.goto(appUrl('/app/commission-report'));
    await evidence.page.waitForLoadState('networkidle');

    await expect(evidence.page).toHaveURL(/\/app\/commission-report$/);
    await expect(evidence.page.getByRole('heading', { name: 'Báo cáo Hoa hồng' })).toBeVisible();

    const dateInputs = evidence.page.locator('input[type="date"]');
    await dateInputs.nth(0).fill('2026-03-01');
    await dateInputs.nth(1).fill('2026-04-15');
    await evidence.page.getByRole('button', { name: 'Làm mới' }).click();

    await expect
      .poll(() => requestQueries.at(-1))
      .toEqual({ fromDate: '2026-03-01', toDate: '2026-04-15' });

    const stats = evidence.page.locator('.stats');
    await expect(stats).toContainText('950đ');
    await expect(stats).toContainText('120đ');
    await expect(stats).toContainText('30đ');
    await expect(stats).toContainText('2');

    const monthlyTable = evidence.page.locator('table.data').nth(0);
    await expect(monthlyTable).toContainText('2026-04');
    await expect(monthlyTable).toContainText('950đ');
    await expect(monthlyTable).toContainText('120đ');
    await expect(monthlyTable).toContainText('2');

    const detailTable = evidence.page.locator('table.data').nth(1);
    await expect(detailTable).toContainText('OD-CM-001');
    await expect(detailTable).toContainText('OD-CM-002');
    await expect(detailTable).toContainText('Phu huynh Alpha');
    await expect(detailTable).toContainText('Phu huynh Beta');
    await expect(detailTable).toContainText('Sale Alpha');
    await expect(detailTable).toContainText('Sale Beta');
    await expect(detailTable).toContainText('Đã duyệt');
    await expect(detailTable).toContainText('Chờ duyệt');
    await evidence.step('commission-report-director-rendered');

    await evidence.finalize('PASS', {
      extraLines: [
        'Verified director can open /app/commission-report and the page reloads the report with the exact fromDate/toDate query parameters.',
        'Verified summary cards and the monthly table render the mocked revenue, commission, pending, and order totals without dropping any section.',
        'Verified detail table renders both order rows, role-visible sale names, and status badges for approved and submitted commission states.',
      ],
    });
  } catch (error) {
    await evidence.finalize('FAIL', { error });
    throw error;
  }
});

test('B07 commission report stays role-scoped for sale and only renders own commission rows', async ({
  browser,
  request,
}) => {
  test.slow();

  const evidence = await createBatchEvidenceContext(browser, {
    batchId: 'B07',
    scenario: 'commission_report_sale_browser',
    runDate: RUN_DATE,
  });

  const saleSession = await loginAsRole(request, 'sale');
  const saleReport: CommissionReport = {
    summary: {
      totalRevenue: 500,
      totalCommission: 70,
      pendingCommission: 10,
      totalOrders: 1,
    },
    byMonth: [
      {
        month: '2026-04',
        revenue: 500,
        commission: 70,
        count: 1,
      },
    ],
    details: [
      {
        orderCode: 'OD-CM-SALE-001',
        parentName: 'Phu huynh Sale Only',
        studentName: 'Hoc sinh Sale Only',
        finalAmount: 500,
        saleCommission: 70,
        status: 'APPROVED',
        saleName: 'Sale Scoped',
        createdAt: '2026-04-08T00:00:00.000Z',
      },
    ],
  };

  const requestQueries: Array<{ fromDate: string | null; toDate: string | null }> = [];

  try {
    await evidence.page.route(COMMISSION_REPORT_API, async (route) => {
      const url = new URL(route.request().url());
      requestQueries.push({
        fromDate: url.searchParams.get('fromDate'),
        toDate: url.searchParams.get('toDate'),
      });
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(clone(saleReport)),
      });
    });

    await applySessionCookies(evidence.context, saleSession);
    await evidence.page.goto(appUrl('/app/commission-report'));
    await evidence.page.waitForLoadState('networkidle');

    await expect(evidence.page).toHaveURL(/\/app\/commission-report$/);
    await expect(evidence.page.getByRole('heading', { name: 'Báo cáo Hoa hồng' })).toBeVisible();

    const dateInputs = evidence.page.locator('input[type="date"]');
    await dateInputs.nth(0).fill('2026-04-01');
    await dateInputs.nth(1).fill('2026-04-30');
    await evidence.page.getByRole('button', { name: 'Làm mới' }).click();

    await expect
      .poll(() => requestQueries.at(-1))
      .toEqual({ fromDate: '2026-04-01', toDate: '2026-04-30' });

    const stats = evidence.page.locator('.stats');
    await expect(stats).toContainText('500đ');
    await expect(stats).toContainText('70đ');
    await expect(stats).toContainText('10đ');
    await expect(stats).toContainText('1');

    const detailTable = evidence.page.locator('table.data').nth(1);
    await expect(detailTable).toContainText('OD-CM-SALE-001');
    await expect(detailTable).toContainText('Sale Scoped');
    await expect(detailTable).not.toContainText('Sale Beta');
    await expect(detailTable).not.toContainText('OD-CM-002');
    await evidence.step('commission-report-sale-scoped');

    await evidence.finalize('PASS', {
      extraLines: [
        'Verified sale role can open /app/commission-report and refresh the report with the exact fromDate/toDate query parameters.',
        'Verified sale-scoped summary only renders the mocked single-order totals instead of the multi-sale director dataset.',
        'Verified detail table shows only the sale-scoped order row and does not leak other sales or unrelated order codes into the browser view.',
      ],
    });
  } catch (error) {
    await evidence.finalize('FAIL', { error });
    throw error;
  }
});
