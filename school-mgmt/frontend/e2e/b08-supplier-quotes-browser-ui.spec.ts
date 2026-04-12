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
const SUPPLIER_QUOTES_LIST_API = new RegExp(`${API_ORIGIN_PATTERN}/supplier-quotes(?:\\?.*)?$`);
const SUPPLIER_QUOTES_UPDATE_API = new RegExp(`${API_ORIGIN_PATTERN}/supplier-quotes/[^/]+(?:\\?.*)?$`);
const SUPPLIER_QUOTES_SEND_API = new RegExp(`${API_ORIGIN_PATTERN}/supplier-quotes/[^/]+/send(?:\\?.*)?$`);
const SUPPLIER_QUOTES_ACCEPT_API = new RegExp(`${API_ORIGIN_PATTERN}/supplier-quotes/[^/]+/accept(?:\\?.*)?$`);
const SUPPLIER_QUOTES_REJECT_API = new RegExp(`${API_ORIGIN_PATTERN}/supplier-quotes/[^/]+/reject(?:\\?.*)?$`);

type QuoteStatus = 'DRAFT' | 'SENT' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED';

type QuoteLineItem = {
  itemName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice?: number;
  notes?: string;
};

type SupplierQuoteItem = {
  _id: string;
  quoteCode: string;
  supplierName: string;
  supplierPhone?: string;
  supplierEmail?: string;
  supplierAddress?: string;
  title: string;
  items: QuoteLineItem[];
  totalAmount: number;
  status: QuoteStatus;
  quoteDate: string;
  validUntil?: string;
  createdById: string;
  createdByName: string;
  approvedById?: string;
  approvedByName?: string;
  approvedAt?: string;
  rejectionReason?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

type SupplierQuoteState = {
  items: SupplierQuoteItem[];
  createBodies: unknown[];
  updateBodies: Array<{ id: string; body: unknown }>;
  sendIds: string[];
  acceptIds: string[];
  rejectBodies: Array<{ id: string; body: unknown }>;
  deleteIds: string[];
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

function quoteRow(page: Page, quoteCode: string) {
  return page.locator('table.data-table tbody tr').filter({ hasText: quoteCode }).first();
}

async function openSupplierQuotesPage(batch: BatchEvidenceSession, session: DemoSession): Promise<void> {
  await batch.page.context().clearCookies();
  await applySessionCookies(batch.page, session);
  await batch.page.goto(appUrl('/app/supplier-quotes'));
  await batch.page.waitForLoadState('networkidle');
  await expect(batch.page.locator('.header h2')).toBeVisible();
  await expect(batch.page.locator('table.data-table')).toBeVisible();
}

async function fillQuoteModal(
  page: Page,
  values: {
    title: string;
    supplierName: string;
    supplierPhone: string;
    supplierEmail: string;
    supplierAddress: string;
    quoteDate: string;
    validUntil: string;
    notes: string;
    itemName: string;
    quantity: number;
    unit: string;
    unitPrice: number;
  },
): Promise<void> {
  const modal = page.locator('.modal-backdrop .modal').first();
  const groups = modal.locator('.form-group');
  await groups.nth(0).locator('input').fill(values.title);
  await groups.nth(1).locator('input').fill(values.supplierName);
  await groups.nth(2).locator('input').fill(values.supplierPhone);
  await groups.nth(3).locator('input').fill(values.supplierEmail);
  await groups.nth(4).locator('input').fill(values.supplierAddress);
  await groups.nth(5).locator('input').fill(values.quoteDate);
  await groups.nth(6).locator('input').fill(values.validUntil);
  await groups.nth(7).locator('textarea').fill(values.notes);

  const lineInputs = modal.locator('.line-item').first().locator('input');
  await lineInputs.nth(0).fill(values.itemName);
  await lineInputs.nth(1).fill(String(values.quantity));
  await lineInputs.nth(2).fill(values.unit);
  await lineInputs.nth(3).fill(String(values.unitPrice));
}

async function installSupplierQuoteRoutes(page: Page, state: SupplierQuoteState): Promise<void> {
  await page.route(SUPPLIER_QUOTES_REJECT_API, async (route) => {
    if (route.request().method() !== 'POST') {
      await route.fallback();
      return;
    }

    const id = route.request().url().split('/supplier-quotes/')[1]?.split('/reject')[0] || '';
    const body = route.request().postDataJSON();
    state.rejectBodies.push({ id, body });

    const item = state.items.find((entry) => entry._id === id);
    if (item) {
      item.status = 'REJECTED';
      item.rejectionReason = String((body as { reason?: string }).reason || '');
      item.approvedById = 'accounting-user-id';
      item.approvedByName = 'Accounting Demo';
      item.approvedAt = '2026-04-11T11:15:00.000Z';
      item.updatedAt = '2026-04-11T11:15:00.000Z';
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(item || { ok: true }),
    });
  });

  await page.route(SUPPLIER_QUOTES_ACCEPT_API, async (route) => {
    if (route.request().method() !== 'POST') {
      await route.fallback();
      return;
    }

    const id = route.request().url().split('/supplier-quotes/')[1]?.split('/accept')[0] || '';
    state.acceptIds.push(id);

    const item = state.items.find((entry) => entry._id === id);
    if (item) {
      item.status = 'ACCEPTED';
      item.approvedById = 'accounting-user-id';
      item.approvedByName = 'Accounting Demo';
      item.approvedAt = '2026-04-11T11:05:00.000Z';
      item.updatedAt = '2026-04-11T11:05:00.000Z';
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(item || { ok: true }),
    });
  });

  await page.route(SUPPLIER_QUOTES_SEND_API, async (route) => {
    if (route.request().method() !== 'POST') {
      await route.fallback();
      return;
    }

    const id = route.request().url().split('/supplier-quotes/')[1]?.split('/send')[0] || '';
    state.sendIds.push(id);

    const item = state.items.find((entry) => entry._id === id);
    if (item) {
      item.status = 'SENT';
      item.updatedAt = '2026-04-11T11:00:00.000Z';
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(item || { ok: true }),
    });
  });

  await page.route(SUPPLIER_QUOTES_UPDATE_API, async (route) => {
    const url = route.request().url();
    if (url.includes('/send') || url.includes('/accept') || url.includes('/reject')) {
      await route.fallback();
      return;
    }

    const id = url.split('/supplier-quotes/')[1]?.split('?')[0] || '';

    if (route.request().method() === 'PATCH') {
      const body = route.request().postDataJSON();
      state.updateBodies.push({ id, body });

      const item = state.items.find((entry) => entry._id === id);
      if (item) {
        const rawItems = ((body as { items?: QuoteLineItem[] }).items || []).map((line) => ({
          ...line,
          totalPrice: Number(line.quantity) * Number(line.unitPrice),
        }));
        Object.assign(item, body, {
          items: rawItems,
          totalAmount: rawItems.reduce((sum, line) => sum + Number(line.totalPrice || 0), 0),
          quoteDate: `${String((body as { quoteDate?: string }).quoteDate || '2026-04-12')}T00:00:00.000Z`,
          validUntil: `${String((body as { validUntil?: string }).validUntil || '2026-04-20')}T00:00:00.000Z`,
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

  await page.route(SUPPLIER_QUOTES_LIST_API, async (route) => {
    if (route.request().method() === 'GET') {
      const url = new URL(route.request().url());
      const keyword = url.searchParams.get('keyword') || '';
      const status = url.searchParams.get('status') || '';
      let items = [...state.items];

      if (keyword) {
        const normalized = keyword.toLowerCase();
        items = items.filter((item) =>
          item.quoteCode.toLowerCase().includes(normalized)
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

      const rawItems = ((body as { items?: QuoteLineItem[] }).items || []).map((line) => ({
        ...line,
        totalPrice: Number(line.quantity) * Number(line.unitPrice),
      }));

      const createdItem: SupplierQuoteItem = {
        _id: 'supplier-quote-create-001',
        quoteCode: 'SQ-20260411-NEW',
        supplierName: String((body as { supplierName?: string }).supplierName || ''),
        supplierPhone: String((body as { supplierPhone?: string }).supplierPhone || ''),
        supplierEmail: String((body as { supplierEmail?: string }).supplierEmail || ''),
        supplierAddress: String((body as { supplierAddress?: string }).supplierAddress || ''),
        title: String((body as { title?: string }).title || ''),
        items: rawItems,
        totalAmount: rawItems.reduce((sum, line) => sum + Number(line.totalPrice || 0), 0),
        status: 'DRAFT',
        quoteDate: `${String((body as { quoteDate?: string }).quoteDate || '2026-04-11')}T00:00:00.000Z`,
        validUntil: `${String((body as { validUntil?: string }).validUntil || '2026-04-18')}T00:00:00.000Z`,
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

test('B08 supplier quotes keep create edit send accept reject and delete states consistent', async ({
  browser,
  request,
}) => {
  test.slow();

  const accountingSession = await loginAsRole(request, 'accounting');

  const state: SupplierQuoteState = {
    items: [
      {
        _id: 'supplier-quote-send-001',
        quoteCode: 'SQ-20260411-001',
        title: 'Network equipment quote',
        supplierName: 'Infra Supply Co',
        supplierPhone: '0900111222',
        supplierEmail: 'sales@infrasupply.local',
        supplierAddress: '12 Tran Hung Dao',
        items: [
          { itemName: 'Router', quantity: 2, unit: 'bo', unitPrice: 1800000, totalPrice: 3600000 },
        ],
        totalAmount: 3600000,
        status: 'DRAFT',
        quoteDate: '2026-04-10T00:00:00.000Z',
        validUntil: '2026-04-20T00:00:00.000Z',
        createdById: 'ops-user-id',
        createdByName: 'Ops Demo',
        notes: 'Draft quote for send and accept flow',
        createdAt: '2026-04-10T09:00:00.000Z',
        updatedAt: '2026-04-10T09:00:00.000Z',
      },
      {
        _id: 'supplier-quote-reject-001',
        quoteCode: 'SQ-20260411-002',
        title: 'Printer maintenance quote',
        supplierName: 'Office Fix Ltd',
        supplierPhone: '0900222333',
        supplierEmail: 'ops@officefix.local',
        supplierAddress: '9 Nguyen Hue',
        items: [
          { itemName: 'Service package', quantity: 1, unit: 'goi', unitPrice: 950000, totalPrice: 950000 },
        ],
        totalAmount: 950000,
        status: 'DRAFT',
        quoteDate: '2026-04-09T00:00:00.000Z',
        validUntil: '2026-04-19T00:00:00.000Z',
        createdById: 'ops-user-id',
        createdByName: 'Ops Demo',
        notes: 'Draft quote for reject flow',
        createdAt: '2026-04-09T09:00:00.000Z',
        updatedAt: '2026-04-09T09:00:00.000Z',
      },
    ],
    createBodies: [],
    updateBodies: [],
    sendIds: [],
    acceptIds: [],
    rejectBodies: [],
    deleteIds: [],
  };

  const expectedCreateBody = {
    title: 'Office desk procurement April',
    supplierName: 'Interior Hub',
    supplierPhone: '0900333444',
    supplierEmail: 'hello@interiorhub.local',
    supplierAddress: '88 Le Loi',
    quoteDate: '2026-04-11',
    validUntil: '2026-04-18',
    notes: 'Need review before procurement approval',
    items: [
      {
        itemName: 'Working desk',
        quantity: 3,
        unit: 'cai',
        unitPrice: 2100000,
      },
    ],
  };

  const expectedUpdateBody = {
    title: 'Office desk procurement April (edited)',
    supplierName: 'Interior Hub',
    supplierPhone: '0900333444',
    supplierEmail: 'hello@interiorhub.local',
    supplierAddress: '88 Le Loi',
    quoteDate: '2026-04-12',
    validUntil: '2026-04-20',
    notes: 'Updated after supplier confirmed extra accessories',
    items: [
      {
        itemName: 'Working desk',
        quantity: 3,
        unit: 'cai',
        unitPrice: 2100000,
        totalPrice: 6300000,
      },
    ],
  };

  const rejectReason = 'Bao gia cao hon gia muc duoc phe duyet cho dot mua sam';

  const batch = await createBatchEvidenceContext(browser, {
    batchId: 'B08',
    scenario: 'supplier_quotes_lifecycle_browser',
    runDate: RUN_DATE,
  });

  try {
    await installSupplierQuoteRoutes(batch.page, state);
    await openSupplierQuotesPage(batch, accountingSession);

    await batch.page.locator('.header .btn.btn-primary').click();
    await fillQuoteModal(batch.page, {
      ...expectedCreateBody,
      itemName: 'Working desk',
      quantity: 3,
      unit: 'cai',
      unitPrice: 2100000,
    });
    await batch.step('supplier-quotes-create-form-filled');
    await batch.page.locator('.modal-actions .btn.btn-primary').click();

    await expect.poll(() => state.createBodies.length).toBe(1);
    expect(state.createBodies[0]).toEqual(expectedCreateBody);

    const createdRow = quoteRow(batch.page, 'SQ-20260411-NEW');
    await expect(createdRow).toBeVisible();
    await expect(createdRow).toContainText(expectedCreateBody.title);
    await expect(createdRow).toContainText(formatAmount(6300000));
    await batch.step('supplier-quotes-created-row-visible');

    await createdRow.locator('button').nth(0).click();
    await fillQuoteModal(batch.page, {
      title: expectedUpdateBody.title,
      supplierName: expectedUpdateBody.supplierName,
      supplierPhone: expectedUpdateBody.supplierPhone,
      supplierEmail: expectedUpdateBody.supplierEmail,
      supplierAddress: expectedUpdateBody.supplierAddress,
      quoteDate: expectedUpdateBody.quoteDate,
      validUntil: expectedUpdateBody.validUntil,
      notes: expectedUpdateBody.notes,
      itemName: 'Working desk',
      quantity: 3,
      unit: 'cai',
      unitPrice: 2100000,
    });
    await batch.page.locator('.modal-actions .btn.btn-primary').click();

    await expect.poll(() => state.updateBodies.length).toBe(1);
    expect(state.updateBodies[0]).toEqual({
      id: 'supplier-quote-create-001',
      body: expectedUpdateBody,
    });
    await expect(createdRow).toContainText(expectedUpdateBody.title);
    await batch.step('supplier-quotes-edited-row-visible');

    const deleteDialog = new Promise<void>((resolve, reject) => {
      batch.page.once('dialog', async (dialog) => {
        try {
          expect(dialog.type()).toBe('confirm');
          expect(dialog.message()).toBe('Xóa báo giá SQ-20260411-NEW?');
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

    await expect.poll(() => state.deleteIds).toContain('supplier-quote-create-001');
    await expect(createdRow).toHaveCount(0);
    await batch.step('supplier-quotes-delete-removes-row');

    const sendRow = quoteRow(batch.page, 'SQ-20260411-001');
    const sendDialog = new Promise<void>((resolve, reject) => {
      batch.page.once('dialog', async (dialog) => {
        try {
          expect(dialog.type()).toBe('confirm');
          expect(dialog.message()).toBe('Gửi báo giá này?');
          await dialog.accept();
          resolve();
        } catch (error) {
          reject(error);
        }
      });
    });
    await Promise.all([
      sendDialog,
      sendRow.locator('button').nth(1).click(),
    ]);

    await expect.poll(() => state.sendIds).toContain('supplier-quote-send-001');
    await expect(sendRow.locator('.badge-sent')).toBeVisible();
    await batch.step('supplier-quotes-send-updates-row-status');

    const acceptDialog = new Promise<void>((resolve, reject) => {
      batch.page.once('dialog', async (dialog) => {
        try {
          expect(dialog.type()).toBe('confirm');
          expect(dialog.message()).toBe('Duyệt báo giá này?');
          await dialog.accept();
          resolve();
        } catch (error) {
          reject(error);
        }
      });
    });
    await Promise.all([
      acceptDialog,
      sendRow.locator('button').nth(0).click(),
    ]);

    await expect.poll(() => state.acceptIds).toContain('supplier-quote-send-001');
    await expect(sendRow.locator('.badge-accepted')).toBeVisible();
    await expect(sendRow.locator('button')).toHaveCount(0);
    await sendRow.click();
    const acceptedDetail = batch.page.locator('.modal-backdrop .modal').first();
    await expect(acceptedDetail).toContainText('Accounting Demo');
    await batch.step('supplier-quotes-accept-detail-visible');
    await acceptedDetail.locator('button').last().click();

    const rejectRow = quoteRow(batch.page, 'SQ-20260411-002');
    const rejectDialog = new Promise<void>((resolve, reject) => {
      batch.page.once('dialog', async (dialog) => {
        try {
          expect(dialog.type()).toBe('prompt');
          expect(dialog.message()).toBe('Lý do từ chối:');
          await dialog.accept(rejectReason);
          resolve();
        } catch (error) {
          reject(error);
        }
      });
    });
    await Promise.all([
      rejectDialog,
      rejectRow.locator('button').nth(3).click(),
    ]);

    await expect.poll(() => state.rejectBodies.length).toBe(1);
    expect(state.rejectBodies[0]).toEqual({
      id: 'supplier-quote-reject-001',
      body: { reason: rejectReason },
    });
    await expect(rejectRow.locator('.badge-rejected')).toBeVisible();
    await rejectRow.click();
    const rejectedDetail = batch.page.locator('.modal-backdrop .modal').first();
    await expect(rejectedDetail).toContainText(rejectReason);
    await expect(rejectedDetail).toContainText('Accounting Demo');
    await batch.step('supplier-quotes-reject-detail-visible');

    await batch.finalize('PASS', {
      extraLines: [
        'Verified create flow sends the exact POST /supplier-quotes payload, inserts a new DRAFT row, and computes row total from the submitted line item.',
        'Verified edit flow preloads current values, sends the exact PATCH body, and list reload reflects the updated title, dates, notes, and preserved line-item payload.',
        'Verified delete flow confirms with the exact quote code and removes the DRAFT row after the DELETE succeeds.',
        'Verified send then accept transitions move the row DRAFT -> SENT -> ACCEPTED, remove mutating actions after acceptance, and surface approver metadata in detail view.',
        'Verified reject captures the exact prompt reason, moves the row to REJECTED, and surfaces the saved rejection reason plus approver metadata in detail view.',
      ],
    });
  } catch (error) {
    await batch.finalize('FAIL', { error });
    throw error;
  }
});
