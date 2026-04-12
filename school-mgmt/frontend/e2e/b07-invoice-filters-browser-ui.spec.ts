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
const STUDENTS_API = new RegExp(`${API_ORIGIN_PATTERN}/students(?:\\?.*)?$`);
const SALES_API = new RegExp(`${API_ORIGIN_PATTERN}/users/sales(?:\\?.*)?$`);
const CLASSES_API = new RegExp(`${API_ORIGIN_PATTERN}/classes(?:\\?.*)?$`);

type InvoiceStatus =
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'PAID'
  | 'PENDING';

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
  status: InvoiceStatus;
  createdBy: {
    _id: string;
    fullName: string;
    email: string;
  };
  createdAt: string;
  updatedAt: string;
  classType?: 'ONLINE' | 'OFFLINE';
  sessions?: number;
  courseStatus?: 'NEW';
};

function appUrl(path: string): string {
  return new URL(path, APP_BASE_URL).toString();
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function buildInvoice(index: number, overrides: Partial<InvoiceItem> = {}): InvoiceItem {
  const suffix = String(index).padStart(3, '0');
  return {
    _id: `invoice-b07-${suffix}`,
    invoiceNumber: `INV-B07-BATCH-${suffix}`,
    studentId: {
      _id: `student-b07-${suffix}`,
      fullName: `Hoc sinh ${suffix}`,
      parentName: `Phu huynh ${suffix}`,
      parentPhone: `0900${suffix}`,
      studentCode: `HS-${suffix}`,
    },
    saleId: {
      _id: 'sale-b07-generic',
      fullName: 'Sale Generic',
      email: 'sale.generic@example.com',
    },
    classId: {
      _id: `class-b07-${suffix}`,
      name: `Lop ${suffix}`,
      code: `CL-${suffix}`,
    },
    amount: 1_000_000 + index * 1_000,
    paymentDate: '2026-06-15T09:00:00.000Z',
    status: 'APPROVED',
    createdBy: {
      _id: 'director-b07',
      fullName: 'Director B07',
      email: 'director.b07@example.com',
    },
    createdAt: '2026-04-11T09:00:00.000Z',
    updatedAt: '2026-04-11T09:05:00.000Z',
    classType: 'ONLINE',
    sessions: 12,
    courseStatus: 'NEW',
    ...overrides,
  };
}

function buildInvoicesForFilters(): InvoiceItem[] {
  const invoices = Array.from({ length: 85 }, (_, offset) => buildInvoice(offset + 1));

  invoices[4] = buildInvoice(5, {
    invoiceNumber: 'INV-B07-REJECT-001',
    studentId: {
      _id: 'student-filter-reject',
      fullName: 'Hoc sinh Reject',
      parentName: 'Phu huynh Reject',
      parentPhone: '0905000001',
      studentCode: 'HS-REJECT-001',
    },
    saleId: {
      _id: 'sale-filter-reject',
      fullName: 'Sale Filter Reject',
      email: 'sale.reject@example.com',
    },
    classId: {
      _id: 'class-filter-reject',
      name: 'Lop Reject',
      code: 'CL-REJECT-001',
    },
    amount: 2_800_000,
    paymentDate: '2026-05-20T09:00:00.000Z',
    status: 'REJECTED',
    classType: 'OFFLINE',
  });

  invoices[8] = buildInvoice(9, {
    invoiceNumber: 'INV-B07-ALPHA-002',
    studentId: {
      _id: 'student-filter-alpha',
      fullName: 'Hoc sinh Alpha',
      parentName: 'Nguyen Thi Parent Filter',
      parentPhone: '0905000002',
      studentCode: 'HS-ALPHA-002',
    },
    saleId: {
      _id: 'sale-filter-alpha',
      fullName: 'Sale Filter Alpha',
      email: 'sale.alpha@example.com',
    },
    classId: {
      _id: 'class-filter-alpha',
      name: 'Lop Alpha',
      code: 'CL-ALPHA-002',
    },
    amount: 3_100_000,
    paymentDate: '2026-03-12T09:00:00.000Z',
    status: 'PENDING_APPROVAL',
  });

  invoices[12] = buildInvoice(13, {
    invoiceNumber: 'INV-B07-BETA-003',
    studentId: {
      _id: 'student-filter-beta',
      fullName: 'Hoc sinh Beta',
      parentName: 'Le Thi Parent Beta',
      parentPhone: '0905000003',
      studentCode: 'HS-BETA-003',
    },
    saleId: {
      _id: 'sale-filter-beta',
      fullName: 'Sale Filter Beta',
      email: 'sale.beta@example.com',
    },
    classId: {
      _id: 'class-filter-beta',
      name: 'Lop Beta',
      code: 'CL-BETA-003',
    },
    amount: 3_400_000,
    paymentDate: '2026-04-25T09:00:00.000Z',
    status: 'APPROVED',
  });

  return invoices;
}

async function installInvoicesRoutes(page: Page, invoices: InvoiceItem[]): Promise<void> {
  await page.route(INVOICES_API, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(clone(invoices)),
    });
  });

  for (const pattern of [STUDENTS_API, SALES_API, CLASSES_API]) {
    await page.route(pattern, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: '[]',
      });
    });
  }
}

function rowByInvoiceNumber(page: Page, invoiceNumber: string) {
  return page
    .getByTestId('invoice-row')
    .filter({ hasText: invoiceNumber })
    .first();
}

async function clearFilters(page: Page): Promise<void> {
  const clearButton = page.getByRole('button', { name: /Xoa loc|Xóa lọc/i });
  await expect(clearButton).toBeVisible();
  await clearButton.click();
}

test.use({ video: 'on' });
test.describe.configure({ mode: 'serial', timeout: 180_000 });

test('B07 invoice filters match keyword parent sale class type status and date range exactly', async ({
  browser,
  request,
}) => {
  test.slow();

  const evidence = await createBatchEvidenceContext(browser, {
    batchId: 'B07',
    scenario: 'invoice_filters_browser',
    runDate: RUN_DATE,
  });

  const directorSession = await loginAsRole(request, 'director');
  const invoices = buildInvoicesForFilters();

  try {
    await installInvoicesRoutes(evidence.page, invoices);
    await applySessionCookies(evidence.context, directorSession);
    await evidence.page.goto(appUrl('/app/invoices'));
    await evidence.page.waitForLoadState('networkidle');

    const topFilterRow = evidence.page.locator('.filters-section .filter-row').first();
    const bottomFilterRow = evidence.page.locator('.filters-section .filter-row').nth(1);
    const keywordInput = topFilterRow.locator('input').nth(0);
    const parentInput = topFilterRow.locator('input').nth(1);
    const saleInput = topFilterRow.locator('input').nth(2);
    const classTypeSelect = bottomFilterRow.locator('select').nth(0);
    const statusSelect = bottomFilterRow.locator('select').nth(1);
    const dateFromInput = bottomFilterRow.locator('input[type="date"]').nth(0);
    const dateToInput = bottomFilterRow.locator('input[type="date"]').nth(1);

    await keywordInput.fill('INV-B07-BETA-003');
    await expect(evidence.page.getByTestId('invoice-row')).toHaveCount(1);
    await expect(rowByInvoiceNumber(evidence.page, 'INV-B07-BETA-003')).toBeVisible();
    await evidence.step('invoice-filter-keyword');
    await clearFilters(evidence.page);

    await parentInput.fill('Nguyen Thi Parent Filter');
    await expect(evidence.page.getByTestId('invoice-row')).toHaveCount(1);
    await expect(rowByInvoiceNumber(evidence.page, 'INV-B07-ALPHA-002')).toBeVisible();
    await clearFilters(evidence.page);

    await saleInput.fill('Sale Filter Beta');
    await expect(evidence.page.getByTestId('invoice-row')).toHaveCount(1);
    await expect(rowByInvoiceNumber(evidence.page, 'INV-B07-BETA-003')).toBeVisible();
    await evidence.step('invoice-filter-parent-sale');
    await clearFilters(evidence.page);

    await classTypeSelect.selectOption('OFFLINE');
    await expect(evidence.page.getByTestId('invoice-row')).toHaveCount(1);
    await expect(rowByInvoiceNumber(evidence.page, 'INV-B07-REJECT-001')).toBeVisible();
    await clearFilters(evidence.page);

    await statusSelect.selectOption('REJECTED');
    await expect(evidence.page.getByTestId('invoice-row')).toHaveCount(1);
    await expect(rowByInvoiceNumber(evidence.page, 'INV-B07-REJECT-001')).toBeVisible();
    await clearFilters(evidence.page);

    await dateFromInput.fill('2026-04-20');
    await dateToInput.fill('2026-04-30');
    await expect(evidence.page.getByTestId('invoice-row')).toHaveCount(1);
    await expect(rowByInvoiceNumber(evidence.page, 'INV-B07-BETA-003')).toBeVisible();
    await evidence.step('invoice-filter-class-status-date');

    await evidence.finalize('PASS', {
      extraLines: [
        'Verified keyword filter keeps only the exact invoice-number match.',
        'Verified parent and sale filters isolate the expected rows without leaking neighboring invoices.',
        'Verified class-type, status, and date-range filters each narrow the table to the exact expected invoice.',
      ],
    });
  } catch (error) {
    await evidence.finalize('FAIL', { error });
    throw error;
  }
});

test('B07 invoice table loads additional batches on scroll without duplicates or dropped rows', async ({
  browser,
  request,
}) => {
  test.slow();

  const evidence = await createBatchEvidenceContext(browser, {
    batchId: 'B07',
    scenario: 'invoice_infinite_scroll_browser',
    runDate: RUN_DATE,
  });

  const directorSession = await loginAsRole(request, 'director');
  const invoices = Array.from({ length: 85 }, (_, offset) => buildInvoice(offset + 1));

  try {
    await installInvoicesRoutes(evidence.page, invoices);
    await applySessionCookies(evidence.context, directorSession);
    await evidence.page.goto(appUrl('/app/invoices'));
    await evidence.page.waitForLoadState('networkidle');

    const tableWrap = evidence.page.locator('.invoice-table-wrap');
    await expect(evidence.page.getByTestId('invoice-row')).toHaveCount(40);
    await expect(rowByInvoiceNumber(evidence.page, 'INV-B07-BATCH-040')).toBeVisible();
    await expect(rowByInvoiceNumber(evidence.page, 'INV-B07-BATCH-041')).toHaveCount(0);
    await evidence.step('invoice-scroll-initial-batch');

    await tableWrap.evaluate((node) => {
      node.scrollTop = node.scrollHeight;
      node.dispatchEvent(new Event('scroll'));
    });
    await expect(evidence.page.getByTestId('invoice-row')).toHaveCount(80);
    await expect(rowByInvoiceNumber(evidence.page, 'INV-B07-BATCH-041')).toBeVisible();
    await expect(rowByInvoiceNumber(evidence.page, 'INV-B07-BATCH-080')).toBeVisible();
    await expect(rowByInvoiceNumber(evidence.page, 'INV-B07-BATCH-081')).toHaveCount(0);
    await evidence.step('invoice-scroll-second-batch');

    await tableWrap.evaluate((node) => {
      node.scrollTop = node.scrollHeight;
      node.dispatchEvent(new Event('scroll'));
    });
    await expect(evidence.page.getByTestId('invoice-row')).toHaveCount(85);
    await expect(rowByInvoiceNumber(evidence.page, 'INV-B07-BATCH-085')).toBeVisible();

    const visibleInvoiceNumbers = await evidence.page.getByTestId('invoice-row').evaluateAll((rows) =>
      rows.map((row) => row.getAttribute('data-invoice-number') || ''),
    );
    const uniqueInvoiceNumbers = new Set(visibleInvoiceNumbers.filter(Boolean));
    expect(uniqueInvoiceNumbers.size).toBe(85);
    await evidence.step('invoice-scroll-final-batch');

    await evidence.finalize('PASS', {
      extraLines: [
        'Verified the invoice table starts with 40 visible rows, expands to 80 on the first scroll, and reaches 85 on the second scroll.',
        'Verified invoice rows from earlier batches stay visible after subsequent loads.',
        'Verified all 85 rendered invoice numbers remain unique after the final batch expansion.',
      ],
    });
  } catch (error) {
    await evidence.finalize('FAIL', { error });
    throw error;
  }
});
