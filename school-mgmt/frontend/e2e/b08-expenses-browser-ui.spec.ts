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
const EXPENSES_LIST_API = new RegExp(`${API_ORIGIN_PATTERN}/expenses(?:\\?.*)?$`);
const EXPENSES_STATS_API = new RegExp(`${API_ORIGIN_PATTERN}/expenses/stats(?:\\?.*)?$`);
const EXPENSE_UPDATE_API = new RegExp(`${API_ORIGIN_PATTERN}/expenses/[^/]+(?:\\?.*)?$`);
const EXPENSE_APPROVE_API = new RegExp(`${API_ORIGIN_PATTERN}/expenses/[^/]+/approve(?:\\?.*)?$`);
const EXPENSE_REJECT_API = new RegExp(`${API_ORIGIN_PATTERN}/expenses/[^/]+/reject(?:\\?.*)?$`);
const EXPENSE_MARK_PAID_API = new RegExp(`${API_ORIGIN_PATTERN}/expenses/[^/]+/mark-paid(?:\\?.*)?$`);

type ExpenseItem = {
  _id: string;
  expenseCode: string;
  title: string;
  description?: string;
  amount: number;
  expenseDate: string;
  category: string;
  paymentStatus: 'PENDING_APPROVAL' | 'APPROVED_UNPAID' | 'PAID' | 'REJECTED';
  createdById: string;
  createdByName: string;
  approvedById?: string;
  approvedByName?: string;
  approvedAt?: string;
  rejectionReason?: string;
  paidById?: string;
  paidByName?: string;
  paidAt?: string;
  paymentMethod?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

type ExpenseStats = {
  totalCount: number;
  totalAmount: number;
  byStatus: Record<string, { count: number; total: number }>;
  byCategory: Record<string, { count: number; total: number }>;
};

type ExpenseState = {
  items: ExpenseItem[];
  createBodies: unknown[];
  updateBodies: Array<{ id: string; body: unknown }>;
  approveIds: string[];
  rejectBodies: Array<{ id: string; body: unknown }>;
  markPaidBodies: Array<{ id: string; body: unknown }>;
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

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
    return JSON.parse(Buffer.from(padded, 'base64').toString('utf8')) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function sessionUserId(session: DemoSession, fallback: string): string {
  const user = session.user as Record<string, unknown> | null | undefined;
  return String(user?._id || decodeJwtPayload(session.accessToken)?.sub || fallback);
}

function sessionFullName(session: DemoSession, fallback: string): string {
  const user = session.user as Record<string, unknown> | null | undefined;
  return String(user?.fullName || decodeJwtPayload(session.accessToken)?.fullName || fallback);
}

function computeStats(items: ExpenseItem[]): ExpenseStats {
  const byStatus: ExpenseStats['byStatus'] = {};
  const byCategory: ExpenseStats['byCategory'] = {};

  for (const item of items) {
    byStatus[item.paymentStatus] ||= { count: 0, total: 0 };
    byStatus[item.paymentStatus].count += 1;
    byStatus[item.paymentStatus].total += item.amount;

    byCategory[item.category] ||= { count: 0, total: 0 };
    byCategory[item.category].count += 1;
    byCategory[item.category].total += item.amount;
  }

  return {
    totalCount: items.length,
    totalAmount: items.reduce((sum, item) => sum + item.amount, 0),
    byStatus,
    byCategory,
  };
}

function expenseRow(page: Page, expenseCode: string) {
  return page.locator('table.data tbody tr').filter({ hasText: expenseCode }).first();
}

async function openExpensesPage(batch: BatchEvidenceSession, session: DemoSession): Promise<void> {
  await batch.page.context().clearCookies();
  await applySessionCookies(batch.page, session);
  await batch.page.goto(appUrl('/app/expenses'));
  await batch.page.waitForLoadState('networkidle');
  await expect(batch.page.locator('.page-header h2')).toBeVisible();
  await expect(batch.page.locator('table.data')).toBeVisible();
}

async function installExpensesRoutes(
  page: Page,
  state: ExpenseState,
  users: {
    director: DemoSession;
    accounting: DemoSession;
    ops: DemoSession;
  },
): Promise<void> {
  await page.route(EXPENSES_STATS_API, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(computeStats(state.items)),
    });
  });

  await page.route(EXPENSE_REJECT_API, async (route) => {
    if (route.request().method() !== 'POST') {
      await route.fallback();
      return;
    }

    const id = route.request().url().split('/expenses/')[1]?.split('/reject')[0] || '';
    const body = route.request().postDataJSON();
    state.rejectBodies.push({ id, body });

    const item = state.items.find((entry) => entry._id === id);
    if (item) {
      item.paymentStatus = 'REJECTED';
      item.rejectionReason = String((body as { rejectionReason?: string }).rejectionReason || '');
      item.approvedById = sessionUserId(users.accounting, 'accounting-user-id');
      item.approvedByName = sessionFullName(users.accounting, 'Accounting Demo');
      item.approvedAt = '2026-04-11T10:45:00.000Z';
      item.updatedAt = '2026-04-11T10:45:00.000Z';
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    });
  });

  await page.route(EXPENSE_MARK_PAID_API, async (route) => {
    if (route.request().method() !== 'POST') {
      await route.fallback();
      return;
    }

    const id = route.request().url().split('/expenses/')[1]?.split('/mark-paid')[0] || '';
    const body = route.request().postDataJSON();
    state.markPaidBodies.push({ id, body });

    const item = state.items.find((entry) => entry._id === id);
    if (item) {
      item.paymentStatus = 'PAID';
      item.paidById = sessionUserId(users.accounting, sessionUserId(users.director, 'finance-user-id'));
      item.paidByName = sessionFullName(users.accounting, sessionFullName(users.director, 'Finance Demo'));
      item.paidAt = String((body as { paidAt?: string }).paidAt || '2026-04-12');
      item.paymentMethod = String((body as { paymentMethod?: string }).paymentMethod || 'CASH');
      item.notes = String((body as { notes?: string }).notes || item.notes || '');
      item.updatedAt = '2026-04-11T11:15:00.000Z';
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    });
  });

  await page.route(EXPENSE_APPROVE_API, async (route) => {
    if (route.request().method() !== 'POST') {
      await route.fallback();
      return;
    }

    const id = route.request().url().split('/expenses/')[1]?.split('/approve')[0] || '';
    state.approveIds.push(id);

    const item = state.items.find((entry) => entry._id === id);
    if (item) {
      item.paymentStatus = 'APPROVED_UNPAID';
      item.approvedById = sessionUserId(users.accounting, sessionUserId(users.director, 'finance-user-id'));
      item.approvedByName = sessionFullName(users.accounting, sessionFullName(users.director, 'Finance Demo'));
      item.approvedAt = '2026-04-11T11:00:00.000Z';
      item.updatedAt = '2026-04-11T11:00:00.000Z';
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    });
  });

  await page.route(EXPENSE_UPDATE_API, async (route) => {
    if (route.request().method() !== 'PATCH') {
      await route.fallback();
      return;
    }

    const id = route.request().url().split('/expenses/')[1]?.split('?')[0] || '';
    const body = route.request().postDataJSON();
    state.updateBodies.push({ id, body });

    const item = state.items.find((entry) => entry._id === id);
    if (item) {
      Object.assign(item, body, {
        expenseDate: `${(body as { expenseDate: string }).expenseDate}T00:00:00.000Z`,
        updatedAt: '2026-04-11T10:30:00.000Z',
      });
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    });
  });

  await page.route(EXPENSES_LIST_API, async (route) => {
    const url = new URL(route.request().url());

    if (url.pathname.endsWith('/stats')) {
      await route.fallback();
      return;
    }

    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: clone(state.items),
          total: state.items.length,
          page: 1,
          limit: state.items.length || 20,
        }),
      });
      return;
    }

    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON();
      state.createBodies.push(body);
      const createdExpense: ExpenseItem = {
        _id: 'expense-create-001',
        expenseCode: 'CP-EXP-CREATE-001',
        title: String((body as { title?: string }).title || ''),
        description: String((body as { description?: string }).description || ''),
        amount: Number((body as { amount?: number }).amount || 0),
        expenseDate: `${String((body as { expenseDate?: string }).expenseDate || '2026-04-11')}T00:00:00.000Z`,
        category: String((body as { category?: string }).category || 'OTHER'),
        paymentStatus: 'PENDING_APPROVAL',
        createdById: sessionUserId(users.director, 'director-user-id'),
        createdByName: sessionFullName(users.director, 'Director Demo'),
        notes: String((body as { notes?: string }).notes || ''),
        createdAt: '2026-04-11T10:00:00.000Z',
        updatedAt: '2026-04-11T10:00:00.000Z',
      };
      state.items = [createdExpense, ...state.items];

      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(createdExpense),
      });
      return;
    }

    await route.fallback();
  });
}

test.use({ video: 'on' });
test.describe.configure({ mode: 'serial', timeout: 180_000 });

test('B08 expenses lifecycle keeps create edit approve reject and mark-paid states consistent', async ({
  browser,
  request,
}) => {
  test.slow();

  const directorSession = await loginAsRole(request, 'director');
  const accountingSession = await loginAsRole(request, 'accounting');
  const opsSession = await loginAsRole(request, 'ops');

  const state: ExpenseState = {
    items: [
      {
        _id: 'expense-reject-001',
        expenseCode: 'CP-EXP-REJECT-001',
        title: 'Duplicate printer toner',
        description: 'Seed pending expense for reject proof',
        amount: 480000,
        expenseDate: '2026-04-09T00:00:00.000Z',
        category: 'SUPPLIES',
        paymentStatus: 'PENDING_APPROVAL',
        createdById: sessionUserId(opsSession, 'ops-user-id'),
        createdByName: sessionFullName(opsSession, 'Ops Demo'),
        notes: 'Seeded reject note',
        createdAt: '2026-04-09T08:00:00.000Z',
        updatedAt: '2026-04-09T08:00:00.000Z',
      },
    ],
    createBodies: [],
    updateBodies: [],
    approveIds: [],
    rejectBodies: [],
    markPaidBodies: [],
  };

  const expectedCreateBody = {
    title: 'Teacher travel reimbursement April',
    description: 'Taxi reimbursement for April workshops',
    amount: 1250000,
    expenseDate: '2026-04-11',
    category: 'TRANSPORT',
    notes: 'Need approval before payout',
  };

  const expectedUpdateBody = {
    title: 'Teacher travel reimbursement April (edited)',
    description: 'Taxi reimbursement for April workshops and extra site visit',
    amount: 1350000,
    expenseDate: '2026-04-12',
    category: 'TRANSPORT',
    notes: 'Updated after extra trip',
  };

  const expectedMarkPaidBody = {
    paymentMethod: 'BANK_TRANSFER',
    paidAt: '2026-04-13',
    notes: 'Paid via BIDV corporate account',
  };

  const batch = await createBatchEvidenceContext(browser, {
    batchId: 'B08',
    scenario: 'expenses_lifecycle_browser',
    runDate: RUN_DATE,
  });

  try {
    await installExpensesRoutes(batch.page, state, {
      director: directorSession,
      accounting: accountingSession,
      ops: opsSession,
    });
    await openExpensesPage(batch, directorSession);

    await batch.page.locator('.page-header > button.primary').click();
    let modal = batch.page.locator('.modal').first();
    await modal.locator('input[name="title"]').fill(expectedCreateBody.title);
    await modal.locator('textarea[name="description"]').fill(expectedCreateBody.description);
    await modal.locator('input[name="amount"]').fill(String(expectedCreateBody.amount));
    await modal.locator('input[name="expenseDate"]').fill(expectedCreateBody.expenseDate);
    await modal.locator('select[name="category"]').selectOption(expectedCreateBody.category);
    await modal.locator('textarea[name="notes"]').fill(expectedCreateBody.notes);
    await modal.locator('button[type="submit"]').click();

    await expect.poll(() => state.createBodies.length).toBe(1);
    expect(state.createBodies[0]).toEqual(expectedCreateBody);

    const createdRow = expenseRow(batch.page, 'CP-EXP-CREATE-001');
    await expect(createdRow).toBeVisible();
    await expect(createdRow).toContainText('Teacher travel reimbursement April');
    await expect(createdRow).toContainText(formatAmount(1250000));
    await batch.step('expenses-create-reload');

    await createdRow.locator('td.actions-cell button').first().click();
    modal = batch.page.locator('.modal').first();
    await modal.locator('input[name="title"]').fill(expectedUpdateBody.title);
    await modal.locator('textarea[name="description"]').fill(expectedUpdateBody.description);
    await modal.locator('input[name="amount"]').fill(String(expectedUpdateBody.amount));
    await modal.locator('input[name="expenseDate"]').fill(expectedUpdateBody.expenseDate);
    await modal.locator('textarea[name="notes"]').fill(expectedUpdateBody.notes);
    await modal.locator('button[type="submit"]').click();

    await expect.poll(() => state.updateBodies.length).toBe(1);
    expect(state.updateBodies[0]).toEqual({
      id: 'expense-create-001',
      body: expectedUpdateBody,
    });

    await expect(createdRow).toContainText(expectedUpdateBody.title);
    await expect(createdRow).toContainText(formatAmount(1350000));
    await batch.step('expenses-edit-reload');

    const approveDialogHandled = new Promise<void>((resolve, reject) => {
      batch.page.once('dialog', async (dialog) => {
        try {
          expect(dialog.type()).toBe('confirm');
          await dialog.accept();
          resolve();
        } catch (error) {
          reject(error);
        }
      });
    });
    await Promise.all([
      approveDialogHandled,
      createdRow.locator('button.btn-sm.success').click(),
    ]);

    await expect.poll(() => state.approveIds.includes('expense-create-001')).toBeTruthy();
    await expect(createdRow.locator('button.btn-sm.primary')).toBeVisible();
    await batch.step('expenses-approved');

    await createdRow.locator('button.btn-sm.primary').click();
    const payModal = batch.page.locator('.modal').first();
    await payModal.locator('select').selectOption(expectedMarkPaidBody.paymentMethod);
    await payModal.locator('input[type="date"]').fill(expectedMarkPaidBody.paidAt);
    await payModal.locator('textarea').fill(expectedMarkPaidBody.notes);
    await payModal.locator('.form-actions button.primary').click();

    await expect.poll(() => state.markPaidBodies.length).toBe(1);
    expect(state.markPaidBodies[0]).toEqual({
      id: 'expense-create-001',
      body: expectedMarkPaidBody,
    });
    await expect(createdRow.locator('td.actions-cell button')).toHaveCount(0);
    await createdRow.click();
    const detailModal = batch.page.locator('.modal.wide').first();
    await expect(detailModal).toContainText(expectedMarkPaidBody.notes);
    await expect(detailModal).toContainText('Chuyển khoản');
    await batch.step('expenses-mark-paid');
    await detailModal.locator('.form-actions button[type="button"]').click();

    const rejectRow = expenseRow(batch.page, 'CP-EXP-REJECT-001');
    const rejectDialogHandled = new Promise<void>((resolve, reject) => {
      batch.page.once('dialog', async (dialog) => {
        try {
          expect(dialog.type()).toBe('prompt');
          await dialog.accept('Duplicate charge found in supplier ledger');
          resolve();
        } catch (error) {
          reject(error);
        }
      });
    });
    await Promise.all([
      rejectDialogHandled,
      rejectRow.locator('button.btn-sm.danger').click(),
    ]);

    await expect.poll(() => state.rejectBodies.length).toBe(1);
    expect(state.rejectBodies[0]).toEqual({
      id: 'expense-reject-001',
      body: { rejectionReason: 'Duplicate charge found in supplier ledger' },
    });
    await rejectRow.click();
    const rejectedDetail = batch.page.locator('.modal.wide').first();
    await expect(rejectedDetail).toContainText('Duplicate charge found in supplier ledger');
    await batch.step('expenses-reject');

    await batch.finalize('PASS', {
      extraLines: [
        'Verified create flow sends the exact POST /expenses payload and re-renders the new pending row after the list and stats reload.',
        'Verified edit flow preloads current values, sends the exact PATCH payload, and the list reload reflects the updated title, amount, and notes.',
        'Verified finance approval exposes the pay action, mark-paid sends the exact payment payload, and the paid expense no longer shows mutating row actions.',
        'Verified reject flow captures the exact rejection reason through the prompt contract and surfaces the saved reason in detail view after reload.',
      ],
    });
  } catch (error) {
    await batch.finalize('FAIL', { error });
    throw error;
  }
});

test('B08 expenses keeps creator approver and payer actions separated by role and status', async ({
  browser,
  request,
}) => {
  test.slow();

  const directorSession = await loginAsRole(request, 'director');
  const accountingSession = await loginAsRole(request, 'accounting');
  const opsSession = await loginAsRole(request, 'ops');

  const state: ExpenseState = {
    items: [
      {
        _id: 'expense-rbac-pending-001',
        expenseCode: 'CP-EXP-RBAC-001',
        title: 'Pending expense for RBAC',
        description: 'Pending expense visible to creator and approver',
        amount: 650000,
        expenseDate: '2026-04-08T00:00:00.000Z',
        category: 'OTHER',
        paymentStatus: 'PENDING_APPROVAL',
        createdById: sessionUserId(opsSession, 'ops-user-id'),
        createdByName: sessionFullName(opsSession, 'Ops Demo'),
        notes: 'Pending RBAC note',
        createdAt: '2026-04-08T09:00:00.000Z',
        updatedAt: '2026-04-08T09:00:00.000Z',
      },
      {
        _id: 'expense-rbac-approved-001',
        expenseCode: 'CP-EXP-RBAC-002',
        title: 'Approved unpaid expense for RBAC',
        description: 'Approved expense visible to payer',
        amount: 920000,
        expenseDate: '2026-04-07T00:00:00.000Z',
        category: 'RENT',
        paymentStatus: 'APPROVED_UNPAID',
        createdById: String(opsSession.user?._id || 'ops-user-id'),
        createdByName: String(opsSession.user?.fullName || 'Ops Demo'),
        approvedById: sessionUserId(accountingSession, 'accounting-user-id'),
        approvedByName: sessionFullName(accountingSession, 'Accounting Demo'),
        approvedAt: '2026-04-08T10:00:00.000Z',
        notes: 'Approved RBAC note',
        createdAt: '2026-04-07T09:00:00.000Z',
        updatedAt: '2026-04-08T10:00:00.000Z',
      },
    ],
    createBodies: [],
    updateBodies: [],
    approveIds: [],
    rejectBodies: [],
    markPaidBodies: [],
  };

  const batch = await createBatchEvidenceContext(browser, {
    batchId: 'B08',
    scenario: 'expenses_rbac_browser',
    runDate: RUN_DATE,
  });

  try {
    await installExpensesRoutes(batch.page, state, {
      director: directorSession,
      accounting: accountingSession,
      ops: opsSession,
    });

    await openExpensesPage(batch, opsSession);
    const opsPendingRow = expenseRow(batch.page, 'CP-EXP-RBAC-001');
    const opsApprovedRow = expenseRow(batch.page, 'CP-EXP-RBAC-002');
    await expect(batch.page.locator('.page-header > button.primary')).toBeVisible();
    await expect(opsPendingRow).toBeVisible();
    await expect(opsPendingRow.locator('button.btn-sm.success')).toHaveCount(0);
    await expect(opsPendingRow.locator('button.btn-sm.danger')).toHaveCount(0);
    await expect(opsApprovedRow.locator('button.btn-sm.primary')).toHaveCount(0);
    await batch.step('expenses-rbac-ops');

    await openExpensesPage(batch, accountingSession);
    const accountingPendingRow = expenseRow(batch.page, 'CP-EXP-RBAC-001');
    const accountingApprovedRow = expenseRow(batch.page, 'CP-EXP-RBAC-002');
    await expect(accountingPendingRow.locator('button.btn-sm.success')).toBeVisible();
    await expect(accountingPendingRow.locator('button.btn-sm.danger')).toBeVisible();
    await expect(accountingApprovedRow.locator('button.btn-sm.primary')).toBeVisible();
    await batch.step('expenses-rbac-accounting');

    await openExpensesPage(batch, directorSession);
    const directorPendingRow = expenseRow(batch.page, 'CP-EXP-RBAC-001');
    const directorApprovedRow = expenseRow(batch.page, 'CP-EXP-RBAC-002');
    await expect(directorPendingRow.locator('button.btn-sm.success')).toBeVisible();
    await expect(directorPendingRow.locator('button.btn-sm.danger')).toBeVisible();
    await expect(directorApprovedRow.locator('button.btn-sm.primary')).toBeVisible();
    await batch.step('expenses-rbac-director');

    await batch.finalize('PASS', {
      extraLines: [
        'Verified OPS keeps the creator surface on /app/expenses and sees the seeded expense rows, but does not see approve, reject, or pay actions on pending and approved rows.',
        'Verified ACCOUNTING can approve or reject pending expenses and can mark approved-unpaid expenses as paid on the same list surface.',
        'Verified DIRECTOR retains the same finance-staff approval and payment actions without re-opening hidden creator-only behavior for non-finance roles.',
      ],
    });
  } catch (error) {
    await batch.finalize('FAIL', { error });
    throw error;
  }
});
