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
const STAFF_PAYROLL_API = new RegExp(`${API_PREFIX_PATTERN}/staff-payroll(?:/.*)?(?:\\?.*)?$`);

type StaffPayrollItem = {
  _id: string;
  payrollCode: string;
  userName: string;
  role: string;
  periodStart: string;
  periodEnd: string;
  status: 'DRAFT' | 'PENDING_REVIEW' | 'APPROVED' | 'PAID' | 'REJECTED';
  baseSalary: number;
  attendanceRatio: number;
  actualHours: number;
  standardHours: number;
  baseSalaryAmount: number;
  totalRevenue: number;
  commissionType?: string;
  commissionTiers: Array<{ from: number; to?: number; rate: number }>;
  commissionAmount: number;
  kpiScore: number;
  kpiBonusTiers: Array<{ minScore: number; maxScore?: number; bonusPercentage: number }>;
  kpiBonusPercentage: number;
  kpiBonusAmount: number;
  lateDays: number;
  latePenaltyPerTime: number;
  latePenaltyAmount: number;
  bonusAmount: number;
  deductionAmount: number;
  notes?: string;
  netAmount: number;
};

function appUrl(path: string): string {
  return new URL(path, APP_BASE_URL).toString();
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function payrollRow(page: Page, payrollCode: string) {
  return page.locator('table.data tbody tr').filter({ hasText: payrollCode }).first();
}

function bulkModal(page: Page) {
  return page.locator('.modal-backdrop .modal').filter({ hasText: 'Tạo bảng lương hàng loạt' });
}

test.use({ video: 'on' });
test.describe.configure({ mode: 'serial', timeout: 180_000 });

test('B07 bulk staff-payroll partial success renders exact success skip error counts and per-user error list', async ({
  browser,
  request,
}) => {
  test.slow();

  const evidence = await createBatchEvidenceContext(browser, {
    batchId: 'B07',
    scenario: 'bulk_payroll_partial_success_browser',
    runDate: RUN_DATE,
  });

  const directorSession = await loginAsRole(request, 'director');

  const expectedPayload = {
    periodStart: '2026-04-01',
    periodEnd: '2026-04-30',
  };

  const existingRow: StaffPayrollItem = {
    _id: 'staff-payroll-existing-001',
    payrollCode: 'SP-BULK-EXISTING-001',
    userName: 'Existing Staff',
    role: 'STAFF',
    periodStart: '2026-03-01T00:00:00.000Z',
    periodEnd: '2026-03-31T00:00:00.000Z',
    status: 'APPROVED',
    baseSalary: 3200000,
    attendanceRatio: 1,
    actualHours: 40,
    standardHours: 40,
    baseSalaryAmount: 3200000,
    totalRevenue: 0,
    commissionType: 'NONE',
    commissionTiers: [],
    commissionAmount: 0,
    kpiScore: 0,
    kpiBonusTiers: [],
    kpiBonusPercentage: 0,
    kpiBonusAmount: 0,
    lateDays: 0,
    latePenaltyPerTime: 0,
    latePenaltyAmount: 0,
    bonusAmount: 0,
    deductionAmount: 0,
    notes: 'Existing row',
    netAmount: 3200000,
  };

  const generatedRow: StaffPayrollItem = {
    ...clone(existingRow),
    _id: 'staff-payroll-generated-bulk-001',
    payrollCode: 'SP-BULK-2026-04-001',
    userName: 'Generated Staff',
    periodStart: '2026-04-01T00:00:00.000Z',
    periodEnd: '2026-04-30T00:00:00.000Z',
    status: 'DRAFT',
    notes: 'Generated from bulk run',
  };

  const exactErrors = [
    'teacher.staff.099@example.com - thiếu bankInfo.accountNumber',
    'ops.staff.007@example.com - thiếu salary config',
  ];

  const bulkBodies: unknown[] = [];
  const listQueries: Array<Record<string, string | null>> = [];
  let listState: StaffPayrollItem[] = [clone(existingRow)];

  try {
    await evidence.page.route(STAFF_PAYROLL_API, async (route) => {
      const requestMethod = route.request().method();
      const url = new URL(route.request().url());
      const path = url.pathname;

      if (requestMethod === 'GET' && path === '/staff-payroll') {
        listQueries.push({
          page: url.searchParams.get('page'),
          limit: url.searchParams.get('limit'),
          status: url.searchParams.get('status'),
          periodStart: url.searchParams.get('periodStart'),
          periodEnd: url.searchParams.get('periodEnd'),
        });
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: clone(listState),
            total: listState.length,
          }),
        });
        return;
      }

      if (requestMethod === 'POST' && path === '/staff-payroll/bulk-generate') {
        const body = route.request().postDataJSON();
        bulkBodies.push(body);
        listState = [clone(generatedRow), clone(existingRow)];
        await new Promise((resolve) => setTimeout(resolve, 350));
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            created: 49,
            skipped: 3,
            errors: clone(exactErrors),
          }),
        });
        return;
      }

      await route.fallback();
    });

    await applySessionCookies(evidence.context, directorSession);
    await evidence.page.goto(appUrl('/app/staff-payroll'));
    await evidence.page.waitForLoadState('networkidle');

    await expect(evidence.page).toHaveURL(/\/app\/staff-payroll$/);
    await expect(evidence.page.getByRole('heading', { name: 'Bảng lương nhân viên' })).toBeVisible();
    await expect
      .poll(() => listQueries.at(-1))
      .toEqual({
        page: '1',
        limit: '20',
        status: null,
        periodStart: null,
        periodEnd: null,
      });
    await expect(payrollRow(evidence.page, existingRow.payrollCode)).toBeVisible();

    await evidence.page.locator('.header-actions .secondary').click();
    const modal = bulkModal(evidence.page);
    await expect(modal).toBeVisible();
    await modal.locator('input[type="date"]').nth(0).fill(expectedPayload.periodStart);
    await modal.locator('input[type="date"]').nth(1).fill(expectedPayload.periodEnd);
    await evidence.step('bulk-payroll-partial-success-form-filled');

    const submitButton = modal.getByRole('button', { name: 'Tạo hàng loạt' });
    await submitButton.click();

    await expect.poll(() => bulkBodies.length).toBe(1);
    expect(bulkBodies[0]).toEqual(expectedPayload);
    await expect
      .poll(() => listQueries.length)
      .toBeGreaterThan(1);

    await expect(modal.getByText('Thành công:')).toBeVisible();
    await expect(modal.locator('.result-row.green strong')).toHaveText('49');
    await expect(modal.locator('.result-row.amber strong')).toHaveText('3');
    await expect(modal.locator('.result-row.red strong')).toHaveText('2');
    await expect(modal.getByText(exactErrors[0])).toBeVisible();
    await expect(modal.getByText(exactErrors[1])).toBeVisible();
    await expect(modal.getByRole('button', { name: 'Tạo hàng loạt' })).toHaveCount(0);
    await expect(modal.getByRole('button', { name: 'Đóng' })).toBeVisible();
    await expect(payrollRow(evidence.page, generatedRow.payrollCode)).toBeVisible();
    await evidence.step('bulk-payroll-partial-success-result');

    await modal.getByRole('button', { name: 'Đóng' }).click();
    await expect(modal).toHaveCount(0);

    await evidence.finalize('PASS', {
      extraLines: [
        'Verified the bulk-generate modal sent the exact POST body for the selected period on the live /app/staff-payroll surface.',
        'Verified a partial-success result renders exact counts for Thành công, Bỏ qua, and Lỗi, plus the per-user error list instead of a generic failure message.',
        'Verified the modal switches from submit mode to result mode and the staff-payroll list reloads after the batch completes.',
      ],
    });
  } catch (error) {
    await evidence.finalize('FAIL', { error });
    throw error;
  }
});
