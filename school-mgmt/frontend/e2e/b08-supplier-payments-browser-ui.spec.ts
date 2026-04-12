import { expect, test, type Page } from '@playwright/test';
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
const SUPPLIER_PAYMENTS_LIST_API = new RegExp(`${API_ORIGIN_PATTERN}/supplier-payments(?:\\?.*)?$`);
const SUPPLIER_PAYMENTS_STATS_API = new RegExp(`${API_ORIGIN_PATTERN}/supplier-payments/stats(?:\\?.*)?$`);
const SUPPLIER_PAYMENTS_UPDATE_API = new RegExp(`${API_ORIGIN_PATTERN}/supplier-payments/[^/]+(?:\\?.*)?$`);
const SUPPLIER_PAYMENTS_APPROVE_API = new RegExp(`${API_ORIGIN_PATTERN}/supplier-payments/[^/]+/approve(?:\\?.*)?$`);
const SUPPLIER_PAYMENTS_REJECT_API = new RegExp(`${API_ORIGIN_PATTERN}/supplier-payments/[^/]+/reject(?:\\?.*)?$`);
const SUPPLIER_PAYMENTS_MARK_PAID_API = new RegExp(`${API_ORIGIN_PATTERN}/supplier-payments/[^/]+/mark-paid(?:\\?.*)?$`);

type SupplierPaymentStatus = 'PENDING_APPROVAL' | 'APPROVED' | 'PAID' | 'REJECTED';

type SupplierPaymentItem = {
  _id: string;
  paymentCode: string;
  supplierName: string;
  supplierPhone?: string;
  supplierEmail?: string;
  supplierBankAccount?: string;
  supplierBankName?: string;
  title: string;
  amount: number;
  paymentDate: string;
  status: SupplierPaymentStatus;
  paymentMethod?: string;
  createdById: string;
  createdByName: string;
  approvedById?: string;
  approvedByName?: string;
  approvedAt?: string;
  paidById?: string;
  paidByName?: string;
  paidAt?: string;
  rejectionReason?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

type SupplierPaymentStats = {
  totalCount: number;
  totalAmount: number;
  byStatus: Record<string, { count: number; total: number }>;
};

type SupplierPaymentState = {
  items: SupplierPaymentItem[];
  createBodies: unknown[];
  updateBodies: Array<{ id: string; body: unknown }>;
  approveIds: string[];
  rejectBodies: Array<{ id: string; body: unknown }>;
  markPaidBodies: Array<{ id: string; body: unknown }>;
  deleteIds: string[];
};

function appUrl(path: string): string {
  return new URL(path, APP_BASE_URL).toString();
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function supplierPaymentRow(page: Page, paymentCode: string) {
  return page.locator('table.data-table tbody tr').filter({ hasText: paymentCode }).first();
}

function statCard(page: Page, index: number) {
  return page.locator('.stats-row .stat-card').nth(index);
}

function buildStats(items: SupplierPaymentItem[]): SupplierPaymentStats {
  const byStatus: SupplierPaymentStats['byStatus'] = {};
  for (const item of items) {
    byStatus[item.status] ||= { count: 0, total: 0 };
    byStatus[item.status].count += 1;
    byStatus[item.status].total += item.amount;
  }
  return {
    totalCount: items.length,
    totalAmount: items.reduce((sum, item) => sum + item.amount, 0),
    byStatus,
  };
}

async function openSupplierPaymentsPage(batch: BatchEvidenceSession, session: DemoSession): Promise<void> {
  await batch.page.context().clearCookies();
  await applySessionCookies(batch.page, session);
  await batch.page.goto(appUrl('/app/payments/supplier'));
  await batch.page.waitForLoadState('networkidle');
  await expect(batch.page.locator('.header h2')).toBeVisible();
  await expect(batch.page.locator('table.data-table')).toBeVisible();
}

async function fillCreateOrEditModal(
  page: Page,
  values: {
    title: string;
    supplierName: string;
    supplierPhone: string;
    supplierEmail: string;
    supplierBankAccount: string;
    supplierBankName: string;
    amount: number;
    paymentDate: string;
    notes: string;
  },
): Promise<void> {
  const modal = page.locator('.modal-backdrop .modal').first();
  const groups = modal.locator('.form-group');
  await groups.nth(0).locator('input').fill(values.title);
  await groups.nth(1).locator('input').fill(values.supplierName);
  await groups.nth(2).locator('input').fill(values.supplierPhone);
  await groups.nth(3).locator('input').fill(values.supplierEmail);
  await groups.nth(4).locator('input').fill(values.supplierBankAccount);
  await groups.nth(5).locator('input').fill(values.supplierBankName);
  await groups.nth(6).locator('input').fill(String(values.amount));
  await groups.nth(7).locator('input').fill(values.paymentDate);
  await groups.nth(8).locator('textarea').fill(values.notes);
}

async function installSupplierPaymentRoutes(
  page: Page,
  state: SupplierPaymentState,
): Promise<void> {
  await page.route(SUPPLIER_PAYMENTS_STATS_API, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(buildStats(state.items)),
    });
  });

  await page.route(SUPPLIER_PAYMENTS_REJECT_API, async (route) => {
    if (route.request().method() !== 'POST') {
      await route.fallback();
      return;
    }

    const id = route.request().url().split('/supplier-payments/')[1]?.split('/reject')[0] || '';
    const body = route.request().postDataJSON();
    state.rejectBodies.push({ id, body });

    const item = state.items.find((entry) => entry._id === id);
    if (item) {
      item.status = 'REJECTED';
      item.rejectionReason = String((body as { reason?: string }).reason || '');
      item.approvedById = 'accounting-user-id';
      item.approvedByName = 'Accounting Demo';
      item.approvedAt = '2026-04-11T11:10:00.000Z';
      item.updatedAt = '2026-04-11T11:10:00.000Z';
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(item || { ok: true }),
    });
  });

  await page.route(SUPPLIER_PAYMENTS_MARK_PAID_API, async (route) => {
    if (route.request().method() !== 'POST') {
      await route.fallback();
      return;
    }

    const id = route.request().url().split('/supplier-payments/')[1]?.split('/mark-paid')[0] || '';
    const body = route.request().postDataJSON();
    state.markPaidBodies.push({ id, body });

    const item = state.items.find((entry) => entry._id === id);
    if (item) {
      item.status = 'PAID';
      item.paymentMethod = String((body as { paymentMethod?: string }).paymentMethod || 'BANK_TRANSFER');
      item.paidAt = `${String((body as { paidAt?: string }).paidAt || '2026-04-13')}T00:00:00.000Z`;
      item.paidById = 'accounting-user-id';
      item.paidByName = 'Accounting Demo';
      item.notes = String((body as { notes?: string }).notes || item.notes || '');
      item.updatedAt = '2026-04-11T11:25:00.000Z';
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(item || { ok: true }),
    });
  });

  await page.route(SUPPLIER_PAYMENTS_APPROVE_API, async (route) => {
    if (route.request().method() !== 'POST') {
      await route.fallback();
      return;
    }

    const id = route.request().url().split('/supplier-payments/')[1]?.split('/approve')[0] || '';
    state.approveIds.push(id);

    const item = state.items.find((entry) => entry._id === id);
    if (item) {
      item.status = 'APPROVED';
      item.approvedById = 'accounting-user-id';
      item.approvedByName = 'Accounting Demo';
      item.approvedAt = '2026-04-11T11:00:00.000Z';
      item.updatedAt = '2026-04-11T11:00:00.000Z';
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(item || { ok: true }),
    });
  });

  await page.route(SUPPLIER_PAYMENTS_UPDATE_API, async (route) => {
    const url = route.request().url();
    if (url.includes('/approve') || url.includes('/reject') || url.includes('/mark-paid')) {
      await route.fallback();
      return;
    }

    const id = url.split('/supplier-payments/')[1]?.split('?')[0] || '';

    if (route.request().method() === 'PATCH') {
      const body = route.request().postDataJSON();
      state.updateBodies.push({ id, body });

      const item = state.items.find((entry) => entry._id === id);
      if (item) {
        Object.assign(item, body, {
          paymentDate: `${String((body as { paymentDate?: string }).paymentDate || '2026-04-12')}T00:00:00.000Z`,
          updatedAt: '2026-04-11T10:30:00.000Z',
        });
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(item || { ok: true }),
      });
      return;
    }

    if (route.request().method() === 'DELETE') {
      state.deleteIds.push(id);
      state.items = state.items.filter((entry) => entry._id !== id);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
      return;
    }

    await route.fallback();
  });

  await page.route(SUPPLIER_PAYMENTS_LIST_API, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/stats')) {
      await route.fallback();
      return;
    }

    if (route.request().method() === 'GET') {
      const keyword = url.searchParams.get('keyword') || '';
      const status = url.searchParams.get('status') || '';
      let items = [...state.items];

      if (keyword) {
        const normalized = keyword.toLowerCase();
        items = items.filter((item) =>
          item.paymentCode.toLowerCase().includes(normalized)
          || item.title.toLowerCase().includes(normalized)
          || item.supplierName.toLowerCase().includes(normalized),
        );
      }

      if (status) {
        items = items.filter((item) => item.status === status);
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: clone(items),
          total: items.length,
          page: 1,
          limit: items.length || 20,
        }),
      });
      return;
    }

    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON();
      state.createBodies.push(body);
      const createdItem: SupplierPaymentItem = {
        _id: 'supplier-payment-create-001',
        paymentCode: 'SP-20260411-NEW',
        supplierName: String((body as { supplierName?: string }).supplierName || ''),
        supplierPhone: String((body as { supplierPhone?: string }).supplierPhone || ''),
        supplierEmail: String((body as { supplierEmail?: string }).supplierEmail || ''),
        supplierBankAccount: String((body as { supplierBankAccount?: string }).supplierBankAccount || ''),
        supplierBankName: String((body as { supplierBankName?: string }).supplierBankName || ''),
        title: String((body as { title?: string }).title || ''),
        amount: Number((body as { amount?: number }).amount || 0),
        paymentDate: `${String((body as { paymentDate?: string }).paymentDate || '2026-04-11')}T00:00:00.000Z`,
        status: 'PENDING_APPROVAL',
        createdById: 'accounting-user-id',
        createdByName: 'Accounting Demo',
        notes: String((body as { notes?: string }).notes || ''),
        createdAt: '2026-04-11T10:00:00.000Z',
        updatedAt: '2026-04-11T10:00:00.000Z',
      };
      state.items = [createdItem, ...state.items];

      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(createdItem),
      });
      return;
    }

    await route.fallback();
  });
}

test.use({ video: 'on' });
test.describe.configure({ mode: 'serial', timeout: 180_000 });

test('B08 supplier payments keep create edit approve reject mark-paid and delete states consistent', async ({
  browser,
  request,
}) => {
  test.slow();

  const accountingSession = await loginAsRole(request, 'accounting');

  const state: SupplierPaymentState = {
    items: [
      {
        _id: 'supplier-payment-approve-001',
        paymentCode: 'SP-20260411-001',
        title: 'Laptop installment for design team',
        supplierName: 'Alpha Tech Distribution',
        supplierPhone: '0900111222',
        supplierEmail: 'accounting@alphatech.local',
        supplierBankAccount: '0123456789',
        supplierBankName: 'VCB',
        amount: 4800000,
        paymentDate: '2026-04-10T00:00:00.000Z',
        status: 'PENDING_APPROVAL',
        createdById: 'ops-user-id',
        createdByName: 'Ops Demo',
        notes: 'Need accounting approval',
        createdAt: '2026-04-10T09:00:00.000Z',
        updatedAt: '2026-04-10T09:00:00.000Z',
      },
      {
        _id: 'supplier-payment-reject-001',
        paymentCode: 'SP-20260411-002',
        title: 'Backup toner purchase',
        supplierName: 'Office Mate Supply',
        supplierPhone: '0900222333',
        supplierEmail: 'ops@officemate.local',
        supplierBankAccount: '2233445566',
        supplierBankName: 'BIDV',
        amount: 1350000,
        paymentDate: '2026-04-09T00:00:00.000Z',
        status: 'PENDING_APPROVAL',
        createdById: 'ops-user-id',
        createdByName: 'Ops Demo',
        notes: 'Second approval candidate',
        createdAt: '2026-04-09T09:00:00.000Z',
        updatedAt: '2026-04-09T09:00:00.000Z',
      },
    ],
    createBodies: [],
    updateBodies: [],
    approveIds: [],
    rejectBodies: [],
    markPaidBodies: [],
    deleteIds: [],
  };

  const expectedCreateBody = {
    title: 'Office chairs batch April',
    supplierName: 'Ergo Furniture Co',
    supplierPhone: '0900333444',
    supplierEmail: 'sales@ergofurniture.local',
    supplierBankAccount: '9988776655',
    supplierBankName: 'ACB',
    amount: 2450000,
    paymentDate: '2026-04-11',
    notes: 'Pending April furniture refresh',
  };

  const expectedUpdateBody = {
    title: 'Office chairs batch April (edited)',
    supplierName: 'Ergo Furniture Co',
    supplierPhone: '0900333444',
    supplierEmail: 'sales@ergofurniture.local',
    supplierBankAccount: '9988776655',
    supplierBankName: 'ACB',
    amount: 2550000,
    paymentDate: '2026-04-12',
    notes: 'Updated after supplier quote revision',
  };

  const expectedMarkPaidBody = {
    paymentMethod: 'BANK_TRANSFER',
    paidAt: '2026-04-13',
    notes: 'Paid via BIDV corporate account',
  };

  const rejectReason = 'Duplicate supplier request in monthly purchasing batch';

  const batch = await createBatchEvidenceContext(browser, {
    batchId: 'B08',
    scenario: 'supplier_payments_lifecycle_browser',
    runDate: RUN_DATE,
  });

  try {
    await installSupplierPaymentRoutes(batch.page, state);
    await openSupplierPaymentsPage(batch, accountingSession);

    await expect(statCard(batch.page, 0)).toContainText('2');
    await expect(statCard(batch.page, 1)).toContainText('2');

    await batch.page.locator('.header .btn.btn-primary').click();
    await fillCreateOrEditModal(batch.page, expectedCreateBody);
    await batch.step('supplier-payments-create-form-filled');
    await batch.page.locator('.modal-actions .btn.btn-primary').click();

    await expect.poll(() => state.createBodies.length).toBe(1);
    expect(state.createBodies[0]).toEqual(expectedCreateBody);

    const createdRow = supplierPaymentRow(batch.page, 'SP-20260411-NEW');
    await expect(createdRow).toBeVisible();
    await expect(createdRow).toContainText(expectedCreateBody.title);
    await expect(statCard(batch.page, 0)).toContainText('3');
    await expect(statCard(batch.page, 1)).toContainText('3');
    await batch.step('supplier-payments-created-row-visible');

    await createdRow.locator('button').nth(0).click();
    await fillCreateOrEditModal(batch.page, expectedUpdateBody);
    await batch.page.locator('.modal-actions .btn.btn-primary').click();

    await expect.poll(() => state.updateBodies.length).toBe(1);
    expect(state.updateBodies[0]).toEqual({
      id: 'supplier-payment-create-001',
      body: expectedUpdateBody,
    });

    await expect(createdRow).toContainText(expectedUpdateBody.title);
    await batch.step('supplier-payments-edited-row-visible');

    const deleteDialog = new Promise<void>((resolve, reject) => {
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
      deleteDialog,
      createdRow.locator('button').last().click(),
    ]);

    await expect.poll(() => state.deleteIds).toContain('supplier-payment-create-001');
    await expect(createdRow).toHaveCount(0);
    await expect(statCard(batch.page, 0)).toContainText('2');
    await expect(statCard(batch.page, 1)).toContainText('2');
    await batch.step('supplier-payments-delete-updates-list-and-stats');

    const approveRow = supplierPaymentRow(batch.page, 'SP-20260411-001');
    const approveDialog = new Promise<void>((resolve, reject) => {
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
      approveDialog,
      approveRow.locator('button').nth(1).click(),
    ]);

    await expect.poll(() => state.approveIds).toContain('supplier-payment-approve-001');
    await expect(approveRow.locator('button').first()).toBeVisible();
    await expect(statCard(batch.page, 1)).toContainText('1');
    await expect(statCard(batch.page, 2)).toContainText('1');
    await batch.step('supplier-payments-approve-updates-status-and-stats');

    await approveRow.locator('button').first().click();
    const payModal = batch.page.locator('.modal-backdrop .modal').first();
    await payModal.locator('select').selectOption(expectedMarkPaidBody.paymentMethod);
    await payModal.locator('input[type="date"]').fill(expectedMarkPaidBody.paidAt);
    await payModal.locator('textarea').fill(expectedMarkPaidBody.notes);
    await payModal.locator('.modal-actions .btn.btn-primary').click();

    await expect.poll(() => state.markPaidBodies.length).toBe(1);
    expect(state.markPaidBodies[0]).toEqual({
      id: 'supplier-payment-approve-001',
      body: expectedMarkPaidBody,
    });
    await expect(approveRow.locator('.badge-paid')).toBeVisible();
    await expect(approveRow.locator('button')).toHaveCount(0);
    await expect(statCard(batch.page, 2)).toContainText('0');
    await expect(statCard(batch.page, 3)).toContainText('1');
    await approveRow.click();
    const paidDetail = batch.page.locator('.modal-backdrop .modal').first();
    await expect(paidDetail).toContainText('Accounting Demo');
    await batch.step('supplier-payments-mark-paid-detail-visible');
    await paidDetail.locator('button').last().click();

    const rejectRow = supplierPaymentRow(batch.page, 'SP-20260411-002');
    const rejectDialog = new Promise<void>((resolve, reject) => {
      batch.page.once('dialog', async (dialog) => {
        try {
          expect(dialog.type()).toBe('prompt');
          await dialog.accept(rejectReason);
          resolve();
        } catch (error) {
          reject(error);
        }
      });
    });
    await Promise.all([
      rejectDialog,
      rejectRow.locator('button').nth(2).click(),
    ]);

    await expect.poll(() => state.rejectBodies.length).toBe(1);
    expect(state.rejectBodies[0]).toEqual({
      id: 'supplier-payment-reject-001',
      body: { reason: rejectReason },
    });
    await expect(rejectRow.locator('.badge-rejected')).toBeVisible();
    await expect(statCard(batch.page, 1)).toContainText('0');
    await rejectRow.click();
    const rejectedDetail = batch.page.locator('.modal-backdrop .modal').first();
    await expect(rejectedDetail).toContainText(rejectReason);
    await batch.step('supplier-payments-reject-detail-visible');

    await batch.finalize('PASS', {
      extraLines: [
        'Verified create flow sends the exact POST /supplier-payments body, inserts a new pending row, and increments total plus pending stats.',
        'Verified edit flow preloads current values, sends the exact PATCH payload, and list reload reflects the updated title, amount, date, and notes.',
        'Verified delete flow removes the pending row after confirm and recomputes total plus pending stat cards without stale data.',
        'Verified approve then mark-paid transitions expose the pay action, send the exact payment payload, and sync row badges plus stats cards with paid detail metadata.',
        'Verified reject captures the exact prompt reason, moves the row to REJECTED, clears pending stats, and surfaces the saved reason in detail view after reload.',
      ],
    });
  } catch (error) {
    await batch.finalize('FAIL', { error });
    throw error;
  }
});
