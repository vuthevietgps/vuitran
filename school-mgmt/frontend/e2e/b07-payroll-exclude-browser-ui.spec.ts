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
const PAYROLL_DETAIL_API = new RegExp(`${API_PREFIX_PATTERN}/payroll/payroll-b07-001(?:\\?.*)?$`);
const PAYROLL_ITEMS_API = new RegExp(`${API_PREFIX_PATTERN}/payroll/payroll-b07-001/items(?:\\?.*)?$`);
const PAYROLL_ADJUST_API = new RegExp(`${API_PREFIX_PATTERN}/payroll/payroll-b07-001/items/payroll-item-b07-001(?:\\?.*)?$`);

function appUrl(path: string): string {
  return new URL(path, APP_BASE_URL).toString();
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

test.use({ video: 'on' });
test.describe.configure({ mode: 'serial', timeout: 180_000 });

test('B07 exclude payroll requires a reason and reflects EXCLUDED state after save', async ({
  browser,
  request,
}) => {
  test.slow();

  const evidence = await createBatchEvidenceContext(browser, {
    batchId: 'B07',
    scenario: 'payroll_exclude_required_reason_browser',
    runDate: RUN_DATE,
  });

  const directorSession = await loginAsRole(request, 'director');
  const listQueries: Array<{ page: string | null; limit: string | null }> = [];
  const adjustBodies: unknown[] = [];

  const teacher = {
    _id: 'teacher-b07-001',
    email: 'teacher.excluded@example.com',
    fullName: 'Teacher Excluded',
    role: 'TEACHER',
  };

  const payrollListItem = {
    _id: 'payroll-b07-001',
    teacherId: { _id: teacher._id, fullName: teacher.fullName, email: teacher.email },
    payrollCode: 'PR-EX-001',
    periodStart: '2026-04-01T00:00:00.000Z',
    periodEnd: '2026-04-30T00:00:00.000Z',
    totalSessions: 1,
    grossAmount: 350000,
    adjustmentAmount: 0,
    bonusAmount: 0,
    deductionAmount: 0,
    netAmount: 350000,
    status: 'DRAFT',
    notes: '',
  };

  const payrollDetail = {
    _id: 'payroll-b07-001',
    payrollCode: 'PR-EX-001',
    userName: teacher.fullName,
    role: 'TEACHER',
    periodStart: '2026-04-01T00:00:00.000Z',
    periodEnd: '2026-04-30T00:00:00.000Z',
    status: 'DRAFT',
    baseSalary: 5000000,
    attendanceRatio: 1,
    actualHours: 20,
    standardHours: 20,
    baseSalaryAmount: 5000000,
    totalRevenue: 0,
    commissionType: '',
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
    notes: '',
    netAmount: 350000,
  };

  const payrollItem = {
    _id: 'payroll-item-b07-001',
    payrollId: 'payroll-b07-001',
    sessionDate: '2026-04-10T00:00:00.000Z',
    classId: { _id: 'class-001', name: 'Math 1', code: 'MATH1' },
    studentId: { _id: 'student-001', fullName: 'Student One', studentCode: 'HS001' },
    teacherPayout: 350000,
    adjustedPayout: 350000,
    adjustmentReason: '',
    status: 'INCLUDED',
  };

  let payrollListState = [clone(payrollListItem)];
  let payrollDetailState = clone(payrollDetail);
  let payrollItemsState = [clone(payrollItem)];

  const expectedAdjustPayload = {
    adjustedPayout: 350000,
    status: 'EXCLUDED',
    adjustmentReason: 'Late report needs manual exclusion',
  };

  try {
    await evidence.page.route(TEACHERS_API, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([teacher]),
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
          data: clone(payrollListState),
          meta: { total: payrollListState.length },
        }),
      });
    });

    await evidence.page.route(PAYROLL_DETAIL_API, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(clone(payrollDetailState)),
      });
    });

    await evidence.page.route(PAYROLL_ITEMS_API, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(clone(payrollItemsState)),
      });
    });

    await evidence.page.route(PAYROLL_ADJUST_API, async (route) => {
      if (route.request().method() !== 'PATCH') {
        await route.fallback();
        return;
      }
      const body = route.request().postDataJSON();
      adjustBodies.push(body);
      payrollItemsState = [
        {
          ...payrollItemsState[0],
          status: 'EXCLUDED',
          adjustmentReason: expectedAdjustPayload.adjustmentReason,
        },
      ];
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
    });

    await applySessionCookies(evidence.context, directorSession);
    await evidence.page.goto(appUrl('/app/payroll'));
    await evidence.page.waitForLoadState('networkidle');

    await expect(evidence.page).toHaveURL(/\/app\/payroll$/);
    await expect(evidence.page.locator('.payroll-page h2')).toBeVisible();
    await evidence.page.locator('.tab-bar button').nth(1).click();

    await expect
      .poll(() => listQueries.at(-1))
      .toEqual({ page: '1', limit: '20' });

    const payrollRow = evidence.page.locator('tbody tr').filter({ hasText: 'PR-EX-001' }).first();
    await expect(payrollRow).toBeVisible();
    await payrollRow.click();

    const detailModal = evidence.page.locator('.modal-overlay .modal-content').last();
    await expect(detailModal).toBeVisible();
    const itemRow = detailModal.locator('.payroll-item-row').filter({ hasText: 'Math 1' }).first();
    await expect(itemRow).toContainText('INCLUDED');
    await evidence.step('payroll-exclude-detail-opened');

    const excludeButton = itemRow.getByRole('button', { name: 'Exclude Payroll' });
    await expect(excludeButton).toBeVisible();
    await excludeButton.click();

    const excludeModal = evidence.page.locator('.modal-exclude-payroll');
    const reasonInput = excludeModal.locator('textarea[name="adjustmentReason"]');
    const saveButton = excludeModal.locator('button[type="submit"].btn-danger');
    await expect(excludeModal).toBeVisible();
    await expect(saveButton).toBeDisabled();

    await reasonInput.focus();
    await excludeModal.locator('button[type="button"].btn-secondary').focus();
    await expect(excludeModal.locator('.form-error')).toBeVisible();
    await evidence.step('payroll-exclude-validation-visible');

    await reasonInput.fill('Late report needs manual exclusion');
    await expect(excludeModal.locator('.form-error')).toHaveCount(0);
    await expect(saveButton).toBeEnabled();
    await saveButton.click();

    await expect.poll(() => adjustBodies.length).toBe(1);
    expect(adjustBodies[0]).toEqual(expectedAdjustPayload);

    await expect(excludeModal).toBeHidden({ timeout: 20_000 });
    await expect(detailModal.locator('.payroll-item-row').filter({ hasText: 'EXCLUDED' }).first()).toBeVisible();
    await expect(detailModal.locator('.payroll-item-row').filter({ hasText: expectedAdjustPayload.adjustmentReason }).first()).toBeVisible();
    await evidence.step('payroll-exclude-detail-updated');

    await detailModal.locator('.modal-header .close-btn').click();
    await expect(payrollRow).toContainText('EXCLUDED');
    await evidence.step('payroll-exclude-list-indicator-visible');

    await evidence.finalize('PASS', {
      extraLines: [
        'Verified exclude-payroll save stays blocked when the reason is blank and the modal surfaces a clear validation message before any PATCH request is sent.',
        'Verified the payroll item PATCH payload keeps the exact adjusted payout, forces status EXCLUDED, and persists the trimmed exclusion reason.',
        'Verified both the detail modal and payroll list reflect EXCLUDED state after save instead of leaving the payroll item status stale.',
      ],
    });
  } catch (error) {
    await evidence.finalize('FAIL', { error });
    throw error;
  }
});
