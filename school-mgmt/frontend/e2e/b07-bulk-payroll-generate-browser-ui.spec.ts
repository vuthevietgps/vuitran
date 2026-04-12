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
const TEACHERS_API = new RegExp(`${API_PREFIX_PATTERN}/users/teachers(?:\\?.*)?$`);
const PAYROLL_LIST_API = new RegExp(`${API_PREFIX_PATTERN}/payroll(?:\\?.*)?$`);
const PAYROLL_ITEMS_API = new RegExp(`${API_PREFIX_PATTERN}/payroll/[^/]+/items(?:\\?.*)?$`);
const BULK_GENERATE_API = new RegExp(`${API_PREFIX_PATTERN}/payroll/bulk-generate(?:\\?.*)?$`);

type TeacherItem = {
  _id: string;
  email: string;
  fullName: string;
  role: string;
};

type PayrollItem = {
  _id: string;
  payrollCode: string;
  teacherId: {
    _id: string;
    fullName: string;
    email: string;
  };
  periodStart: string;
  periodEnd: string;
  totalSessions: number;
  grossAmount: number;
  adjustmentAmount: number;
  bonusAmount: number;
  deductionAmount: number;
  netAmount: number;
  status: 'DRAFT' | 'PENDING_REVIEW' | 'APPROVED' | 'PAID' | 'REJECTED';
};

type PayrollItemDetail = {
  _id: string;
  payrollId: string;
  sessionDate: string;
  teacherPayout: number;
  adjustedPayout: number;
  adjustmentReason?: string;
  status: 'INCLUDED' | 'EXCLUDED' | 'ADJUSTED';
};

function appUrl(path: string): string {
  return new URL(path, APP_BASE_URL).toString();
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function payrollRow(page: import('@playwright/test').Page, payrollCode: string) {
  return page.locator('tbody tr').filter({ hasText: payrollCode }).first();
}

test.use({ video: 'on' });
test.describe.configure({ mode: 'serial', timeout: 180_000 });

test('B07 bulk payroll generate sends one exact batch request and reloads the list after success', async ({
  browser,
  request,
}) => {
  test.slow();

  const evidence = await createBatchEvidenceContext(browser, {
    batchId: 'B07',
    scenario: 'bulk_payroll_generate_browser',
    runDate: RUN_DATE,
  });

  const directorSession = await loginAsRole(request, 'director');
  const listQueries: Array<{ page: string | null; limit: string | null }> = [];
  const bulkBodies: unknown[] = [];

  const teachers: TeacherItem[] = [
    {
      _id: 'teacher-bulk-001',
      email: 'teacher.bulk.one@example.com',
      fullName: 'Teacher Bulk One',
      role: 'TEACHER',
    },
    {
      _id: 'teacher-bulk-002',
      email: 'teacher.bulk.two@example.com',
      fullName: 'Teacher Bulk Two',
      role: 'TEACHER',
    },
  ];

  const existingPayroll: PayrollItem = {
    _id: 'payroll-existing-001',
    payrollCode: 'PR-BULK-EXISTING-001',
    teacherId: {
      _id: 'teacher-existing-001',
      fullName: 'Teacher Existing',
      email: 'teacher.existing@example.com',
    },
    periodStart: '2026-03-01T00:00:00.000Z',
    periodEnd: '2026-03-31T00:00:00.000Z',
    totalSessions: 8,
    grossAmount: 3200000,
    adjustmentAmount: 0,
    bonusAmount: 0,
    deductionAmount: 0,
    netAmount: 3200000,
    status: 'APPROVED',
  };

  const generatedPayrolls: PayrollItem[] = [
    {
      _id: 'payroll-bulk-001',
      payrollCode: 'PR-BULK-001',
      teacherId: {
        _id: 'teacher-bulk-001',
        fullName: 'Teacher Bulk One',
        email: 'teacher.bulk.one@example.com',
      },
      periodStart: '2026-04-01T00:00:00.000Z',
      periodEnd: '2026-04-30T00:00:00.000Z',
      totalSessions: 11,
      grossAmount: 4100000,
      adjustmentAmount: 0,
      bonusAmount: 0,
      deductionAmount: 0,
      netAmount: 4100000,
      status: 'DRAFT',
    },
    {
      _id: 'payroll-bulk-002',
      payrollCode: 'PR-BULK-002',
      teacherId: {
        _id: 'teacher-bulk-002',
        fullName: 'Teacher Bulk Two',
        email: 'teacher.bulk.two@example.com',
      },
      periodStart: '2026-04-01T00:00:00.000Z',
      periodEnd: '2026-04-30T00:00:00.000Z',
      totalSessions: 9,
      grossAmount: 3600000,
      adjustmentAmount: 0,
      bonusAmount: 0,
      deductionAmount: 0,
      netAmount: 3600000,
      status: 'DRAFT',
    },
  ];

  const payrollItemsByPayrollId: Record<string, PayrollItemDetail[]> = {
    'payroll-existing-001': [
      {
        _id: 'payroll-item-existing-001',
        payrollId: 'payroll-existing-001',
        sessionDate: '2026-03-20T00:00:00.000Z',
        teacherPayout: 320000,
        adjustedPayout: 320000,
        status: 'INCLUDED',
      },
    ],
    'payroll-bulk-001': [
      {
        _id: 'payroll-item-bulk-001',
        payrollId: 'payroll-bulk-001',
        sessionDate: '2026-04-14T00:00:00.000Z',
        teacherPayout: 410000,
        adjustedPayout: 410000,
        status: 'INCLUDED',
      },
    ],
    'payroll-bulk-002': [
      {
        _id: 'payroll-item-bulk-002',
        payrollId: 'payroll-bulk-002',
        sessionDate: '2026-04-18T00:00:00.000Z',
        teacherPayout: 360000,
        adjustedPayout: 360000,
        status: 'INCLUDED',
      },
    ],
  };

  const expectedPayload = {
    periodStart: '2026-04-01',
    periodEnd: '2026-04-30',
  };

  let payrollsState: PayrollItem[] = [clone(existingPayroll)];

  try {
    await evidence.page.route(TEACHERS_API, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(clone(teachers)),
      });
    });

    await evidence.page.route(PAYROLL_LIST_API, async (route) => {
      if (route.request().method() !== 'GET') {
        await route.fallback();
        return;
      }
      const url = new URL(route.request().url());
      listQueries.push({
        page: url.searchParams.get('page'),
        limit: url.searchParams.get('limit'),
      });
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: clone(payrollsState),
          meta: { total: payrollsState.length, page: 1, limit: 20 },
        }),
      });
    });

    await evidence.page.route(PAYROLL_ITEMS_API, async (route) => {
      const url = new URL(route.request().url());
      const payrollId = url.pathname.split('/').slice(-2)[0];
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(clone(payrollItemsByPayrollId[payrollId] || [])),
      });
    });

    await evidence.page.route(BULK_GENERATE_API, async (route) => {
      if (route.request().method() !== 'POST') {
        await route.fallback();
        return;
      }
      const body = route.request().postDataJSON();
      bulkBodies.push(body);
      await new Promise((resolve) => setTimeout(resolve, 350));
      payrollsState = clone([...generatedPayrolls, existingPayroll]);
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          created: 2,
          skipped: 1,
          errors: [],
        }),
      });
    });

    await applySessionCookies(evidence.context, directorSession);
    await evidence.page.goto(appUrl('/app/payroll'));
    await evidence.page.waitForLoadState('networkidle');

    await expect(evidence.page.locator('.payroll-page h2')).toBeVisible();
    await evidence.page.locator('.tab-bar button').nth(1).click();

    await expect
      .poll(() => listQueries.at(-1))
      .toEqual({ page: '1', limit: '20' });

    await expect(payrollRow(evidence.page, existingPayroll.payrollCode)).toBeVisible();

    const bulkToggleButton = evidence.page.locator('.filter-bar .btn-success').first();
    await bulkToggleButton.click();

    const bulkForm = evidence.page.locator('.inline-form');
    const dateInputs = bulkForm.locator('input[type="date"]');
    const submitButton = bulkForm.locator('.btn-success');
    await expect(bulkForm).toBeVisible();
    await dateInputs.nth(0).fill(expectedPayload.periodStart);
    await dateInputs.nth(1).fill(expectedPayload.periodEnd);
    await evidence.step('payroll-bulk-form-opened');

    await submitButton.click();
    await expect(submitButton).toBeDisabled();
    await submitButton.click({ timeout: 500 }).catch(() => undefined);
    await expect
      .poll(() => bulkBodies.length)
      .toBe(1);
    await evidence.step('payroll-bulk-submit-pending');

    expect(bulkBodies[0]).toEqual(expectedPayload);

    await expect(evidence.page.locator('.notification')).toHaveText('Đã tạo: 2, bỏ qua: 1, lỗi: 0');
    await expect(bulkForm).toHaveCount(0);
    await expect
      .poll(() => listQueries.length)
      .toBeGreaterThan(1);
    await expect(payrollRow(evidence.page, 'PR-BULK-001')).toBeVisible();
    await expect(payrollRow(evidence.page, 'PR-BULK-002')).toBeVisible();
    await evidence.step('payroll-bulk-list-reloaded');

    await evidence.finalize('PASS', {
      extraLines: [
        'Verified bulk payroll generate sends one exact POST /payroll/bulk-generate request for the selected period and the UI blocks duplicate submit while the batch is pending.',
        'Verified the success notification surfaces exact created/skipped/error counts, the inline bulk form closes after success, and the payroll list reloads with the newly generated rows.',
      ],
    });
  } catch (error) {
    await evidence.finalize('FAIL', { error });
    throw error;
  }
});
