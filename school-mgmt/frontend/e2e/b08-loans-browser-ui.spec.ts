import { expect, test, type APIRequestContext, type Browser, type Page } from '@playwright/test';
import {
  applySessionCookies,
  createBatchEvidenceContext,
  loginAsRole,
  type BatchEvidenceSession,
  type DemoSession,
} from './support';

const APP_BASE_URL =
  process.env['PLAYWRIGHT_BASE_URL'] ||
  process.env['E2E_BASE_URL'] ||
  'http://localhost:4200';

const RUN_DATE =
  process.env['UI_EVIDENCE_DATE'] ||
  process.env['E2E_RUN_DATE'] ||
  '2026-04-11';

const API_ORIGIN_PATTERN = 'https?://(?:localhost|127\\.0\\.0\\.1):3000';
const LOANS_API = new RegExp(`${API_ORIGIN_PATTERN}/loans(?:\\?.*)?$`);
const LOANS_SUMMARY_API = new RegExp(`${API_ORIGIN_PATTERN}/loans/summary(?:\\?.*)?$`);
const LOAN_DETAIL_API = new RegExp(`${API_ORIGIN_PATTERN}/loans/loan-[^/]+(?:\\?.*)?$`);
const LOAN_ACTIVATE_API = new RegExp(`${API_ORIGIN_PATTERN}/loans/loan-[^/]+/activate(?:\\?.*)?$`);
const LOAN_PAYMENTS_API = new RegExp(`${API_ORIGIN_PATTERN}/loans/payments/list(?:\\?.*)?$`);
const LOAN_RECORD_PAYMENT_API = new RegExp(`${API_ORIGIN_PATTERN}/loans/payments/record(?:\\?.*)?$`);
const LOAN_UPDATE_OVERDUE_API = new RegExp(`${API_ORIGIN_PATTERN}/loans/update-overdue(?:\\?.*)?$`);

const LOAN_CREATED_ID = 'loan-created-001';
const LOAN_OVERDUE_ID = 'loan-overdue-001';
const CREATED_LOAN_CODE = 'LOAN-20260411-NEW';
const NOW = new Date('2026-04-11T12:00:00.000Z');

type LoanStatus = 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'DEFAULTED' | 'RESTRUCTURED';
type LoanPaymentStatus = 'SCHEDULED' | 'PAID' | 'OVERDUE' | 'PARTIAL';

type LoanItem = {
  _id: string;
  loanCode: string;
  lenderName: string;
  lenderType: string;
  loanType: string;
  principal: number;
  interestRate: number;
  interestType: string;
  term: number;
  startDate: string;
  endDate: string;
  paymentFrequency: string;
  status: LoanStatus;
  totalPaid: number;
  remainingBalance: number;
  collateral?: string;
  notes?: string;
  createdByName: string;
  approvedByName?: string;
  approvedAt?: string;
  createdAt: string;
};

type LoanPaymentItem = {
  _id: string;
  paymentCode: string;
  loanId: string;
  paymentNumber: number;
  dueDate: string;
  paidDate?: string;
  principalAmount: number;
  interestAmount: number;
  totalAmount: number;
  status: LoanPaymentStatus;
  paymentMethod?: string;
  reference?: string;
  notes?: string;
  paidByName?: string;
  createdAt: string;
};

type LoanSummary = {
  totalDebt: number;
  totalPrincipal: number;
  activeLoanCount: number;
  overdueAmount: number;
  overdueCount: number;
  upcomingPayments30d: number;
  upcomingPaymentCount30d: number;
  totalInterestPaid: number;
  totalAmountPaid: number;
};

type LoanState = {
  loans: LoanItem[];
  payments: LoanPaymentItem[];
  createBodies: unknown[];
  activateIds: string[];
  recordPaymentBodies: unknown[];
  updateOverdueCalls: number;
};

function appUrl(path: string): string {
  return new URL(path, APP_BASE_URL).toString();
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function formatAmount(value: number): string {
  return `${new Intl.NumberFormat('en-US').format(value)}đ`;
}

function startOfDay(dateString: string): number {
  return new Date(`${dateString}T00:00:00.000Z`).getTime();
}

function buildSummary(state: LoanState): LoanSummary {
  const activeLoans = state.loans.filter((loan) => loan.status === 'ACTIVE');
  const overduePayments = state.payments.filter((payment) => payment.status === 'OVERDUE');
  const paidPayments = state.payments.filter((payment) => payment.status === 'PAID');
  const windowEnd = new Date(NOW);
  windowEnd.setDate(windowEnd.getDate() + 30);
  const upcomingPayments = state.payments.filter((payment) => {
    if (payment.status !== 'SCHEDULED') {
      return false;
    }
    const dueTime = startOfDay(payment.dueDate.slice(0, 10));
    return dueTime >= startOfDay(NOW.toISOString().slice(0, 10)) && dueTime <= startOfDay(windowEnd.toISOString().slice(0, 10));
  });

  return {
    totalDebt: activeLoans.reduce((sum, loan) => sum + loan.remainingBalance, 0),
    totalPrincipal: activeLoans.reduce((sum, loan) => sum + loan.principal, 0),
    activeLoanCount: activeLoans.length,
    overdueAmount: overduePayments.reduce((sum, payment) => sum + payment.totalAmount, 0),
    overdueCount: overduePayments.length,
    upcomingPayments30d: upcomingPayments.reduce((sum, payment) => sum + payment.totalAmount, 0),
    upcomingPaymentCount30d: upcomingPayments.length,
    totalInterestPaid: paidPayments.reduce((sum, payment) => sum + payment.interestAmount, 0),
    totalAmountPaid: paidPayments.reduce((sum, payment) => sum + payment.totalAmount, 0),
  };
}

function loanRow(page: Page, loanCode: string) {
  return page.locator('table.data-table tbody tr').filter({ hasText: loanCode }).first();
}

function historyRow(page: Page, paymentCode: string) {
  return page.locator('table.data-table tbody tr').filter({ hasText: paymentCode }).first();
}

function summaryCard(page: Page, label: string) {
  return page.locator('.stat-card').filter({ hasText: label }).first();
}

async function openLoansPage(batch: BatchEvidenceSession, session: DemoSession): Promise<void> {
  await batch.page.context().clearCookies();
  await applySessionCookies(batch.page, session);
  await batch.page.goto(appUrl('/app/loans'));
  await batch.page.waitForLoadState('networkidle');
  await expect(batch.page.locator('.page-header h2')).toContainText('Quản lý Vốn vay');
}

async function installLoanRoutes(page: Page, state: LoanState): Promise<void> {
  await page.route(LOANS_SUMMARY_API, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(buildSummary(state)),
    });
  });

  await page.route(LOAN_UPDATE_OVERDUE_API, async (route) => {
    if (route.request().method() !== 'POST') {
      await route.fallback();
      return;
    }

    state.updateOverdueCalls += 1;
    let updated = 0;
    for (const payment of state.payments) {
      if ((payment.status === 'SCHEDULED' || payment.status === 'PARTIAL') && startOfDay(payment.dueDate.slice(0, 10)) < startOfDay(NOW.toISOString().slice(0, 10))) {
        payment.status = 'OVERDUE';
        updated += 1;
      }
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ updated }),
    });
  });

  await page.route(LOAN_RECORD_PAYMENT_API, async (route) => {
    if (route.request().method() !== 'POST') {
      await route.fallback();
      return;
    }

    const body = route.request().postDataJSON();
    state.recordPaymentBodies.push(body);

    const { loanId, paymentNumber } = body as {
      loanId: string;
      paymentNumber: number;
      paidDate: string;
      paymentMethod?: string;
      reference?: string;
      notes?: string;
    };

    const loan = state.loans.find((entry) => entry._id === loanId);
    const payment = state.payments.find((entry) => entry.loanId === loanId && entry.paymentNumber === paymentNumber);
    if (!loan || !payment) {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Loan payment not found' }),
      });
      return;
    }

    payment.status = 'PAID';
    payment.paidDate = `${String((body as { paidDate?: string }).paidDate || '2026-05-10')}T00:00:00.000Z`;
    payment.paymentMethod = String((body as { paymentMethod?: string }).paymentMethod || '');
    payment.reference = String((body as { reference?: string }).reference || '');
    payment.notes = String((body as { notes?: string }).notes || '');
    payment.paidByName = 'Director Demo';

    loan.totalPaid += payment.totalAmount;
    loan.remainingBalance = Math.max(0, loan.remainingBalance - payment.principalAmount);
    if (!state.payments.some((entry) => entry.loanId === loanId && entry.status !== 'PAID')) {
      loan.status = 'COMPLETED';
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(clone(payment)),
    });
  });

  await page.route(LOAN_ACTIVATE_API, async (route) => {
    if (route.request().method() !== 'POST') {
      await route.fallback();
      return;
    }

    const loanId = route.request().url().split('/loans/')[1]?.split('/activate')[0] || '';
    state.activateIds.push(loanId);

    const loan = state.loans.find((entry) => entry._id === loanId);
    if (!loan) {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Loan not found' }),
      });
      return;
    }

    loan.status = 'ACTIVE';
    loan.approvedByName = 'Director Demo';
    loan.approvedAt = '2026-04-11T09:30:00.000Z';

    const existingPayments = state.payments.filter((entry) => entry.loanId === loanId);
    if (existingPayments.length === 0) {
      state.payments.push(
        {
          _id: 'payment-created-001',
          paymentCode: `LP-${loan.loanCode}-001`,
          loanId,
          paymentNumber: 1,
          dueDate: '2026-05-10T00:00:00.000Z',
          principalAmount: 3000000,
          interestAmount: 150000,
          totalAmount: 3150000,
          status: 'SCHEDULED',
          createdAt: '2026-04-11T09:30:00.000Z',
        },
        {
          _id: 'payment-created-002',
          paymentCode: `LP-${loan.loanCode}-002`,
          loanId,
          paymentNumber: 2,
          dueDate: '2026-06-10T00:00:00.000Z',
          principalAmount: 3000000,
          interestAmount: 75000,
          totalAmount: 3075000,
          status: 'SCHEDULED',
          createdAt: '2026-04-11T09:30:00.000Z',
        },
      );
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(clone(loan)),
    });
  });

  await page.route(LOAN_DETAIL_API, async (route) => {
    const loanId = route.request().url().split('/loans/')[1]?.split('?')[0] || '';
    const loan = state.loans.find((entry) => entry._id === loanId);
    await route.fulfill({
      status: loan ? 200 : 404,
      contentType: 'application/json',
      body: JSON.stringify(loan ? clone(loan) : { message: 'Loan not found' }),
    });
  });

  await page.route(LOAN_PAYMENTS_API, async (route) => {
    const url = new URL(route.request().url());
    const loanId = url.searchParams.get('loanId') || '';
    const status = url.searchParams.get('status') || '';
    const startDate = url.searchParams.get('startDate') || '';
    const endDate = url.searchParams.get('endDate') || '';

    let payments = [...state.payments];
    if (loanId) {
      payments = payments.filter((entry) => entry.loanId === loanId);
    }
    if (status) {
      payments = payments.filter((entry) => entry.status === status);
    }
    if (startDate) {
      payments = payments.filter((entry) => startOfDay((entry.paidDate || entry.dueDate).slice(0, 10)) >= startOfDay(startDate));
    }
    if (endDate) {
      payments = payments.filter((entry) => startOfDay((entry.paidDate || entry.dueDate).slice(0, 10)) <= startOfDay(endDate));
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(clone(payments)),
    });
  });

  await page.route(LOANS_API, async (route) => {
    const url = new URL(route.request().url());
    const pathname = url.pathname;
    if (pathname.endsWith('/summary') || pathname.includes('/payments/') || pathname.endsWith('/update-overdue')) {
      await route.fallback();
      return;
    }

    if (route.request().method() === 'GET') {
      const status = url.searchParams.get('status') || '';
      const keyword = (url.searchParams.get('keyword') || '').toLowerCase();
      const lenderType = url.searchParams.get('lenderType') || '';
      let loans = [...state.loans];

      if (status) {
        loans = loans.filter((entry) => entry.status === status);
      }
      if (keyword) {
        loans = loans.filter((entry) =>
          entry.loanCode.toLowerCase().includes(keyword)
          || entry.lenderName.toLowerCase().includes(keyword),
        );
      }
      if (lenderType) {
        loans = loans.filter((entry) => entry.lenderType === lenderType);
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(clone(loans)),
      });
      return;
    }

    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON();
      state.createBodies.push(body);
      const createdLoan: LoanItem = {
        _id: LOAN_CREATED_ID,
        loanCode: CREATED_LOAN_CODE,
        lenderName: String((body as { lenderName?: string }).lenderName || ''),
        lenderType: String((body as { lenderType?: string }).lenderType || 'BANK'),
        loanType: String((body as { loanType?: string }).loanType || 'WORKING_CAPITAL'),
        principal: Number((body as { principal?: number }).principal || 0),
        interestRate: Number((body as { interestRate?: number }).interestRate || 0),
        interestType: String((body as { interestType?: string }).interestType || 'FIXED'),
        term: Number((body as { term?: number }).term || 0),
        startDate: `${String((body as { startDate?: string }).startDate || '2026-04-10')}T00:00:00.000Z`,
        endDate: '2026-06-10T00:00:00.000Z',
        paymentFrequency: String((body as { paymentFrequency?: string }).paymentFrequency || 'MONTHLY'),
        status: 'DRAFT',
        totalPaid: 0,
        remainingBalance: Number((body as { principal?: number }).principal || 0),
        collateral: String((body as { collateral?: string }).collateral || ''),
        notes: String((body as { notes?: string }).notes || ''),
        createdByName: 'Director Demo',
        createdAt: '2026-04-11T09:00:00.000Z',
      };
      state.loans = [createdLoan, ...state.loans];

      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(clone(createdLoan)),
      });
      return;
    }

    await route.fallback();
  });
}

test.describe.configure({ mode: 'serial', timeout: 180_000 });

test('B08 loans keep create activate payment and overdue states consistent', async ({
  browser,
  request,
}) => {
  test.slow();

  const directorSession = await loginAsRole(request, 'director');
  const state: LoanState = {
    loans: [
      {
        _id: LOAN_OVERDUE_ID,
        loanCode: 'LOAN-20260115-OD1',
        lenderName: 'ACB Bridge Capital',
        lenderType: 'BANK',
        loanType: 'WORKING_CAPITAL',
        principal: 4000000,
        interestRate: 11.2,
        interestType: 'FIXED',
        term: 6,
        startDate: '2026-01-15T00:00:00.000Z',
        endDate: '2026-07-15T00:00:00.000Z',
        paymentFrequency: 'MONTHLY',
        status: 'ACTIVE',
        totalPaid: 0,
        remainingBalance: 4000000,
        collateral: 'Hop dong thu hoc phi',
        notes: 'Khoan vay seed de proof overdue',
        createdByName: 'Director Demo',
        approvedByName: 'Director Demo',
        approvedAt: '2026-01-15T09:00:00.000Z',
        createdAt: '2026-01-15T09:00:00.000Z',
      },
    ],
    payments: [
      {
        _id: 'payment-overdue-seed-001',
        paymentCode: 'LP-LOAN-20260115-OD1-001',
        loanId: LOAN_OVERDUE_ID,
        paymentNumber: 1,
        dueDate: '2026-03-15T00:00:00.000Z',
        principalAmount: 500000,
        interestAmount: 50000,
        totalAmount: 550000,
        status: 'SCHEDULED',
        createdAt: '2026-01-15T09:00:00.000Z',
      },
    ],
    createBodies: [],
    activateIds: [],
    recordPaymentBodies: [],
    updateOverdueCalls: 0,
  };

  const batch = await createBatchEvidenceContext(browser, {
    batchId: 'B08',
    scenario: 'loans_lifecycle_browser',
    runDate: RUN_DATE,
  });

  try {
    await installLoanRoutes(batch.page, state);
    await openLoansPage(batch, directorSession);

    await batch.page.locator('.tab-bar button').nth(1).click();
    await expect(batch.page.locator('table.data-table')).toBeVisible();

    await batch.page.locator('.header-actions .primary').click();
    const createModal = batch.page.locator('.modal-overlay .modal').first();
    const createGroups = createModal.locator('.form-group');
    await createGroups.nth(0).locator('input').fill('VPBank SME');
    await createGroups.nth(1).locator('select').selectOption('BANK');
    await createGroups.nth(2).locator('select').selectOption('WORKING_CAPITAL');
    await createGroups.nth(3).locator('input').fill('6000000');
    await createGroups.nth(4).locator('input').fill('12.5');
    await createGroups.nth(5).locator('select').selectOption('FIXED');
    await createGroups.nth(6).locator('input').fill('2');
    await createGroups.nth(7).locator('input').fill('2026-04-10');
    await createGroups.nth(8).locator('select').selectOption('MONTHLY');
    await createGroups.nth(9).locator('input').fill('Xe van giao hang');
    await createGroups.nth(10).locator('textarea').fill('Bridge capital for Q2');
    await batch.step('loans-create-form-filled');

    await createModal.locator('.modal-actions .primary').click();
    const createdRow = loanRow(batch.page, CREATED_LOAN_CODE);
    await expect(createdRow).toContainText('VPBank SME');
    await expect(createdRow).toContainText('Nháp');
    await expect(createdRow).toContainText(formatAmount(6000000));
    expect(state.createBodies).toEqual([
      {
        lenderName: 'VPBank SME',
        lenderType: 'BANK',
        loanType: 'WORKING_CAPITAL',
        principal: 6000000,
        interestRate: 12.5,
        interestType: 'FIXED',
        term: 2,
        startDate: '2026-04-10',
        paymentFrequency: 'MONTHLY',
        collateral: 'Xe van giao hang',
        notes: 'Bridge capital for Q2',
      },
    ]);
    await batch.step('loans-created-draft-row-visible');

    let activateDialogMessage = '';
    batch.page.once('dialog', async (dialog) => {
      activateDialogMessage = dialog.message();
      expect(dialog.type()).toBe('confirm');
      await dialog.accept();
    });
    await createdRow.locator('button:has-text("Kích hoạt")').click();
    expect(activateDialogMessage).toBe(
      `Kích hoạt khoản vay ${CREATED_LOAN_CODE}? Hệ thống sẽ tạo lịch trả nợ tự động.`,
    );

    await expect(createdRow).toContainText('Đang vay');
    await expect(createdRow.locator('button:has-text("Kích hoạt")')).toHaveCount(0);
    expect(state.activateIds).toEqual([LOAN_CREATED_ID]);

    await batch.page.locator('.tab-bar button').nth(0).click();
    await expect(summaryCard(batch.page, 'Tổng dư nợ')).toContainText(formatAmount(10000000));
    await expect(summaryCard(batch.page, 'Khoản vay đang hoạt động')).toContainText('2');
    await batch.step('loans-activate-updates-summary');

    await batch.page.locator('.tab-bar button').nth(1).click();
    await createdRow.locator('button:has-text("Lịch trả nợ")').click();
    const scheduleRows = batch.page.locator('table.data-table tbody tr');
    await expect(scheduleRows).toHaveCount(2);
    await expect(scheduleRows.nth(0)).toContainText('Chưa đến hạn');
    await expect(scheduleRows.nth(1)).toContainText('Chưa đến hạn');

    await scheduleRows.nth(0).locator('button:has-text("Ghi nhận trả")').click();
    const payModal = batch.page.locator('.modal-overlay .modal').first();
    const payGroups = payModal.locator('.form-group');
    await payGroups.nth(0).locator('input').fill('2026-05-10');
    await payGroups.nth(1).locator('select').selectOption('BANK_TRANSFER');
    await payGroups.nth(2).locator('input').fill('REPAY-001');
    await payGroups.nth(3).locator('textarea').fill('Thanh toán kỳ 1 đúng hạn');
    await payModal.locator('.modal-actions .primary').click();

    expect(state.recordPaymentBodies).toEqual([
      {
        loanId: LOAN_CREATED_ID,
        paymentNumber: 1,
        paidDate: '2026-05-10',
        paymentMethod: 'BANK_TRANSFER',
        reference: 'REPAY-001',
        notes: 'Thanh toán kỳ 1 đúng hạn',
      },
    ]);
    await expect(scheduleRows.nth(0)).toContainText('Đã trả');
    await expect(scheduleRows.nth(1)).toContainText('Chưa đến hạn');
    await expect(batch.page.locator('.schedule-summary')).toContainText(formatAmount(3000000));
    await expect(batch.page.locator('.schedule-summary')).toContainText(formatAmount(3150000));
    await batch.step('loans-record-payment-updates-schedule');

    await batch.page.locator('.tab-bar button').nth(3).click();
    const paidHistoryRow = historyRow(batch.page, `LP-${CREATED_LOAN_CODE}-001`);
    await expect(paidHistoryRow).toContainText(CREATED_LOAN_CODE);
    await expect(paidHistoryRow).toContainText('BANK_TRANSFER');
    await expect(paidHistoryRow).toContainText(formatAmount(3150000));
    await batch.step('loans-history-shows-recorded-payment');

    await batch.page.locator('.tab-bar button').nth(0).click();
    await batch.page.locator('.header-actions .secondary').click();
    expect(state.updateOverdueCalls).toBe(1);
    await expect(summaryCard(batch.page, 'Quá hạn (1 kỳ)')).toContainText(formatAmount(550000));
    await batch.step('loans-overdue-summary-updated');

    await batch.page.locator('.tab-bar button').nth(2).click();
    await batch.page.locator('.filters select').first().selectOption(LOAN_OVERDUE_ID);
    await expect(batch.page.locator('table.data-table tbody tr').first()).toContainText('Quá hạn');
    await batch.step('loans-overdue-schedule-visible');

    await batch.finalize('PASS', {
      extraLines: [
        'Verified create flow sends the exact POST /loans payload and inserts a new DRAFT row without mutating active-loan summary cards prematurely.',
        'Verified activate flow confirms against the exact loan code, POSTs to /loans/:id/activate, removes the Kích hoạt action, and increments Tổng dư nợ plus active-loan count after reload.',
        'Verified schedule generation creates exactly two SCHEDULED installments for the new monthly loan and keeps row state consistent before any repayment.',
        'Verified record-payment flow sends the exact POST /loans/payments/record body, turns installment 1 to PAID, updates Còn nợ/Đã trả in schedule summary, and surfaces the payment in lịch sử thanh toán.',
        'Verified update-overdue changes only past-due scheduled installments, lifts summary overdue count/amount to 1 kỳ / 550,000đ, and renders the seeded overdue installment with badge Quá hạn in lịch trả nợ.',
      ],
    });
  } catch (error) {
    await batch.finalize('FAIL', { error });
    throw error;
  }
});
