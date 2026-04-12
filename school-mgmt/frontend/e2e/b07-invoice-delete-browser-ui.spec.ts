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

const API_ORIGIN_PATTERN = 'https?://(?:localhost|127\\.0\\.0\\.1):3000';
const INVOICES_API = new RegExp(`${API_ORIGIN_PATTERN}/invoices(?:\\?.*)?$`);
const INVOICE_DELETE_API = new RegExp(`${API_ORIGIN_PATTERN}/invoices/invoice-delete-001(?:\\?.*)?$`);
const STUDENTS_API = new RegExp(`${API_ORIGIN_PATTERN}/students(?:\\?.*)?$`);
const SALES_API = new RegExp(`${API_ORIGIN_PATTERN}/users/sales(?:\\?.*)?$`);
const CLASSES_API = new RegExp(`${API_ORIGIN_PATTERN}/classes(?:\\?.*)?$`);
const TOPUP_PENDING_API = new RegExp(`${API_ORIGIN_PATTERN}/wallets/top-up/pending(?:\\?.*)?$`);

type InvoiceItem = {
  _id: string;
  invoiceNumber: string;
  studentId: {
    _id: string;
    fullName: string;
    parentName: string;
    parentPhone: string;
    studentCode?: string;
  };
  saleId?: {
    _id: string;
    fullName: string;
    email: string;
  };
  classId?: {
    _id: string;
    name: string;
    code: string;
  };
  amount: number;
  paymentDate: string;
  status: 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'PAID' | 'PENDING';
  createdBy: {
    _id: string;
    fullName: string;
    email: string;
  };
  createdAt: string;
  updatedAt: string;
  classType?: 'ONLINE' | 'OFFLINE';
  sessions?: number;
  paymentRound?: number;
  courseStatus?: 'NEW';
};

function appUrl(path: string): string {
  return new URL(path, APP_BASE_URL).toString();
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function rowByInvoiceNumber(page: Page, invoiceNumber: string) {
  return page
    .getByTestId('invoice-row')
    .filter({ hasText: invoiceNumber })
    .first();
}

test.use({ video: 'on' });
test.describe.configure({ mode: 'serial', timeout: 180_000 });

test('B07 director deletes pending invoice and the list reload removes the row', async ({
  browser,
  request,
}) => {
  test.slow();

  const evidence = await createBatchEvidenceContext(browser, {
    batchId: 'B07',
    scenario: 'invoice_delete_browser',
    runDate: RUN_DATE,
  });

  const directorSession = await loginAsRole(request, 'director');

  const removableInvoice: InvoiceItem = {
    _id: 'invoice-delete-001',
    invoiceNumber: 'INV-B07-DELETE-001',
    studentId: {
      _id: 'student-delete-001',
      fullName: 'Hoc sinh Xoa Invoice',
      parentName: 'Phu huynh Xoa Invoice',
      parentPhone: '0905333001',
      studentCode: 'HS-DELETE-001',
    },
    saleId: {
      _id: 'sale-delete-001',
      fullName: 'Sale Delete One',
      email: 'sale.delete.one@example.com',
    },
    classId: {
      _id: 'class-delete-001',
      name: 'Lop Delete One',
      code: 'CL-DELETE-001',
    },
    amount: 1900000,
    paymentDate: '2026-04-11T00:00:00.000Z',
    status: 'PENDING_APPROVAL',
    createdBy: {
      _id: 'director-b07',
      fullName: 'Director B07',
      email: 'director.b07@example.com',
    },
    createdAt: '2026-04-11T09:00:00.000Z',
    updatedAt: '2026-04-11T09:00:00.000Z',
    classType: 'ONLINE',
    sessions: 12,
    paymentRound: 1,
    courseStatus: 'NEW',
  };

  const survivorInvoice: InvoiceItem = {
    _id: 'invoice-delete-keep-001',
    invoiceNumber: 'INV-B07-KEEP-001',
    studentId: {
      _id: 'student-delete-keep-001',
      fullName: 'Hoc sinh Con Lai',
      parentName: 'Phu huynh Con Lai',
      parentPhone: '0905333002',
      studentCode: 'HS-KEEP-001',
    },
    saleId: {
      _id: 'sale-delete-002',
      fullName: 'Sale Delete Two',
      email: 'sale.delete.two@example.com',
    },
    classId: {
      _id: 'class-delete-002',
      name: 'Lop Delete Two',
      code: 'CL-DELETE-002',
    },
    amount: 2150000,
    paymentDate: '2026-04-12T00:00:00.000Z',
    status: 'PENDING_APPROVAL',
    createdBy: {
      _id: 'director-b07',
      fullName: 'Director B07',
      email: 'director.b07@example.com',
    },
    createdAt: '2026-04-11T10:00:00.000Z',
    updatedAt: '2026-04-11T10:00:00.000Z',
    classType: 'OFFLINE',
    sessions: 8,
    paymentRound: 1,
    courseStatus: 'NEW',
  };

  let invoicesState: InvoiceItem[] = [clone(removableInvoice), clone(survivorInvoice)];
  let invoicesGetCount = 0;
  const deleteUrls: string[] = [];
  const dialogs: string[] = [];

  try {
    await installRoutes();
    await applySessionCookies(evidence.context, directorSession);
    await evidence.page.goto(appUrl('/app/invoices'));
    await evidence.page.waitForLoadState('networkidle');

    const targetRow = rowByInvoiceNumber(evidence.page, removableInvoice.invoiceNumber);
    const survivorRow = rowByInvoiceNumber(evidence.page, survivorInvoice.invoiceNumber);
    await expect(targetRow).toBeVisible();
    await expect(survivorRow).toBeVisible();
    await expect(targetRow.getByTestId('invoice-row-delete')).toBeVisible();
    await evidence.step('invoice-delete-row-visible');

    evidence.page.once('dialog', async (dialog) => {
      dialogs.push(dialog.message());
      await dialog.accept();
    });

    await targetRow.getByTestId('invoice-row-delete').click();

    await expect.poll(() => deleteUrls.length).toBe(1);
    expect(deleteUrls[0]).toContain('/invoices/invoice-delete-001');
    expect(dialogs).toEqual(['Xóa hóa đơn INV-B07-DELETE-001?']);
    await expect.poll(() => invoicesGetCount).toBe(2);

    await expect(rowByInvoiceNumber(evidence.page, removableInvoice.invoiceNumber)).toHaveCount(0);
    await expect(rowByInvoiceNumber(evidence.page, survivorInvoice.invoiceNumber)).toBeVisible();
    await expect(evidence.page.locator('.stat-card .stat-value').first()).toHaveText('1');
    await evidence.step('invoice-delete-row-removed-after-reload');

    await evidence.finalize('PASS', {
      extraLines: [
        'Verified only the target pending invoice row receives the delete action and the confirmation dialog uses the exact invoice number.',
        'Verified exact DELETE /invoices/:id is issued for the selected invoice and a second GET /invoices reload happens after successful deletion.',
        'Verified the deleted invoice row disappears after reload while the surviving row remains visible and the total invoice summary drops to one row.',
      ],
    });
  } catch (error) {
    await evidence.finalize('FAIL', { error });
    throw error;
  }

  async function installRoutes(): Promise<void> {
    await evidence.page.route(TOPUP_PENDING_API, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: '[]',
      });
    });

    await evidence.page.route(STUDENTS_API, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: '[]',
      });
    });

    await evidence.page.route(SALES_API, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: '[]',
      });
    });

    await evidence.page.route(CLASSES_API, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: '[]',
      });
    });

    await evidence.page.route(INVOICES_API, async (route) => {
      if (route.request().method() !== 'GET') {
        await route.fallback();
        return;
      }

      invoicesGetCount += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(clone(invoicesState)),
      });
    });

    await evidence.page.route(INVOICE_DELETE_API, async (route) => {
      if (route.request().method() !== 'DELETE') {
        await route.fallback();
        return;
      }

      deleteUrls.push(route.request().url());
      invoicesState = [clone(survivorInvoice)];
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
    });
  }
});
