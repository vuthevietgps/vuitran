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
const INVOICE_CREATE_API = new RegExp(`${API_ORIGIN_PATTERN}/invoices$`);
const INVOICE_UPDATE_API = new RegExp(`${API_ORIGIN_PATTERN}/invoices/invoice-edit-001(?:\\?.*)?$`);
const STUDENTS_API = new RegExp(`${API_ORIGIN_PATTERN}/students(?:\\?.*)?$`);
const SALES_API = new RegExp(`${API_ORIGIN_PATTERN}/users/sales(?:\\?.*)?$`);
const CLASSES_API = new RegExp(`${API_ORIGIN_PATTERN}/classes(?:\\?.*)?$`);

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
  bonusSessions?: number;
  trialSessions?: number;
  paymentRound?: number;
  courseStatus?: 'NEW' | 'CONTINUE_1' | 'CONTINUE_2' | 'CONTINUE_3' | 'CONTINUE_4' | 'CONTINUE_5';
  description?: string;
  receiptImage?: string;
};

type StudentItem = {
  _id: string;
  studentCode: string;
  fullName: string;
  age: number;
  parentName: string;
  parentPhone: string;
  faceImage: string;
};

type SaleUser = {
  _id: string;
  email: string;
  fullName: string;
  role: string;
};

type ClassItem = {
  _id: string;
  name: string;
  code: string;
  classMode: 'ONLINE' | 'OFFLINE';
  students: Array<{
    _id: string;
    fullName: string;
    studentCode?: string;
  }>;
};

function appUrl(path: string): string {
  return new URL(path, APP_BASE_URL).toString();
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('vi-VN');
}

function rowByInvoiceNumber(page: Page, invoiceNumber: string) {
  return page
    .getByTestId('invoice-row')
    .filter({ hasText: invoiceNumber })
    .first();
}

async function selectedOptionLabel(page: Page, testId: string): Promise<string> {
  return page.getByTestId(testId).evaluate((element) => {
    const select = element as HTMLSelectElement;
    return select.selectedOptions[0]?.textContent?.trim() ?? '';
  });
}

async function installLookupsRoutes(
  page: Page,
  students: StudentItem[],
  sales: SaleUser[],
  classes: ClassItem[],
): Promise<void> {
  await page.route(STUDENTS_API, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(clone(students)),
    });
  });

  await page.route(SALES_API, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(clone(sales)),
    });
  });

  await page.route(CLASSES_API, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(clone(classes)),
    });
  });
}

test.use({ video: 'on' });
test.describe.configure({ mode: 'serial', timeout: 180_000 });

test('B07 create invoice sends exact payload and re-renders the new row after reload', async ({
  browser,
  request,
}) => {
  test.slow();

  const evidence = await createBatchEvidenceContext(browser, {
    batchId: 'B07',
    scenario: 'invoice_create_browser',
    runDate: RUN_DATE,
  });

  const directorSession = await loginAsRole(request, 'director');

  const students: StudentItem[] = [
    {
      _id: 'student-create-001',
      studentCode: 'HS-CREATE-001',
      fullName: 'Hoc sinh Tao Moi',
      age: 12,
      parentName: 'Phu huynh Tao Moi',
      parentPhone: '0905111001',
      faceImage: '/uploads/faces/student-create-001.png',
    },
  ];

  const sales: SaleUser[] = [
    {
      _id: 'sale-create-001',
      email: 'sale.create.one@example.com',
      fullName: 'Sale Create One',
      role: 'SALE',
    },
  ];

  const classes: ClassItem[] = [
    {
      _id: 'class-create-online-001',
      name: 'Lop Online Create',
      code: 'CL-CREATE-001',
      classMode: 'ONLINE',
      students: [
        {
          _id: 'student-create-001',
          fullName: 'Hoc sinh Tao Moi',
          studentCode: 'HS-CREATE-001',
        },
      ],
    },
  ];

  const expectedPayload = {
    invoiceNumber: 'INV-B07-CREATE-001',
    courseStatus: 'NEW',
    studentId: 'student-create-001',
    classType: 'ONLINE',
    amount: 2600000,
    paymentDate: '2026-04-11',
    sessions: 12,
    paymentRound: 1,
    classId: 'class-create-online-001',
    saleId: 'sale-create-001',
    description: 'B07 create invoice browser proof',
  };

  const createdInvoice: InvoiceItem = {
    _id: 'invoice-create-001',
    invoiceNumber: expectedPayload.invoiceNumber,
    studentId: {
      _id: 'student-create-001',
      fullName: 'Hoc sinh Tao Moi',
      parentName: 'Phu huynh Tao Moi',
      parentPhone: '0905111001',
      studentCode: 'HS-CREATE-001',
    },
    saleId: {
      _id: 'sale-create-001',
      fullName: 'Sale Create One',
      email: 'sale.create.one@example.com',
    },
    classId: {
      _id: 'class-create-online-001',
      name: 'Lop Online Create',
      code: 'CL-CREATE-001',
    },
    amount: 2600000,
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
    description: expectedPayload.description,
  };

  let invoicesState: InvoiceItem[] = [];
  let invoicesGetCount = 0;
  const createBodies: unknown[] = [];

  try {
    await pageRoutesForCreate();
    await applySessionCookies(evidence.context, directorSession);
    await evidence.page.goto(appUrl('/app/invoices'));
    await evidence.page.waitForLoadState('networkidle');

    await evidence.page.getByTestId('invoices-create-button').click();
    const modal = evidence.page.getByTestId('invoice-form-modal');
    await expect(modal).toBeVisible();
    await expect(modal.getByRole('heading', { name: 'Them hoa don moi' })).toHaveCount(0);
    await expect(modal.getByRole('heading', { name: /Them hoa don moi|Thêm hóa đơn mới/i })).toBeVisible();

    await evidence.page.getByTestId('invoice-number').fill(expectedPayload.invoiceNumber);
    await evidence.page.getByTestId('invoice-student').selectOption(expectedPayload.studentId);
    await expect(modal).toContainText('Phu huynh Tao Moi');
    await expect(evidence.page.getByTestId('invoice-class')).toHaveValue(expectedPayload.classId);
    await expect(evidence.page.getByTestId('invoice-class-type')).toHaveValue(expectedPayload.classType);
    await evidence.page.getByTestId('invoice-sessions').fill(String(expectedPayload.sessions));
    await evidence.page.getByTestId('invoice-payment-round').fill(String(expectedPayload.paymentRound));
    await evidence.page.getByTestId('invoice-amount').fill(String(expectedPayload.amount));
    await evidence.page.getByTestId('invoice-sale').selectOption(expectedPayload.saleId);
    await evidence.page.getByTestId('invoice-payment-date').fill(expectedPayload.paymentDate);
    await evidence.page.getByTestId('invoice-description').fill(expectedPayload.description);
    await evidence.step('invoice-create-form-filled');

    await evidence.page.getByTestId('invoice-submit').click();

    await expect.poll(() => createBodies.length).toBe(1);
    expect(createBodies[0]).toEqual(expectedPayload);
    await expect.poll(() => invoicesGetCount).toBe(2);
    await expect(modal).toHaveCount(0);

    const createdRow = rowByInvoiceNumber(evidence.page, expectedPayload.invoiceNumber);
    await expect(createdRow).toBeVisible();
    await expect(createdRow.locator('td').nth(0)).toHaveText(formatDate(createdInvoice.paymentDate));
    await expect(createdRow.locator('td').nth(2)).toContainText('Hoc sinh Tao Moi');
    await expect(createdRow.locator('td').nth(3)).toContainText('Phu huynh Tao Moi');
    await expect(createdRow.locator('td').nth(4)).toContainText('Online');
    await expect(createdRow.locator('td').nth(7)).toHaveText(formatCurrency(createdInvoice.amount));
    await expect(createdRow.locator('td').nth(8)).toContainText('Sale Create One');
    await expect(createdRow.locator('td').nth(9)).toContainText(/Cho duyet|Chờ duyệt/i);
    await evidence.step('invoice-create-row-visible-after-reload');

    await evidence.finalize('PASS', {
      extraLines: [
        'Verified selecting the student auto-fills the only linked class and synchronizes class type from that class.',
        'Verified exact POST /invoices payload includes invoice number, student, class, class type, sessions, payment round, sale, amount, date, and description.',
        'Verified successful create triggers a second GET /invoices and the new pending row re-renders with the expected student, parent, amount, sale, and status.',
      ],
    });
  } catch (error) {
    await evidence.finalize('FAIL', { error });
    throw error;
  }

  async function pageRoutesForCreate(): Promise<void> {
    await installLookupsRoutes(evidence.page, students, sales, classes);

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

    await evidence.page.route(INVOICE_CREATE_API, async (route) => {
      if (route.request().method() !== 'POST') {
        await route.fallback();
        return;
      }

      const body = route.request().postDataJSON();
      createBodies.push(body);
      invoicesState = [clone(createdInvoice), ...invoicesState];
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, data: clone(createdInvoice) }),
      });
    });
  }
});

test('B07 edit invoice sends exact PATCH payload and the list reload reflects updated fields', async ({
  browser,
  request,
}) => {
  test.slow();

  const evidence = await createBatchEvidenceContext(browser, {
    batchId: 'B07',
    scenario: 'invoice_edit_browser',
    runDate: RUN_DATE,
  });

  const directorSession = await loginAsRole(request, 'director');

  const students: StudentItem[] = [
    {
      _id: 'student-edit-001',
      studentCode: 'HS-EDIT-001',
      fullName: 'Hoc sinh Sua Invoice',
      age: 13,
      parentName: 'Phu huynh Sua Invoice',
      parentPhone: '0905222001',
      faceImage: '/uploads/faces/student-edit-001.png',
    },
  ];

  const sales: SaleUser[] = [
    {
      _id: 'sale-edit-001',
      email: 'sale.edit.old@example.com',
      fullName: 'Sale Edit Old',
      role: 'SALE',
    },
    {
      _id: 'sale-edit-002',
      email: 'sale.edit.new@example.com',
      fullName: 'Sale Edit New',
      role: 'SALE',
    },
  ];

  const classes: ClassItem[] = [
    {
      _id: 'class-edit-online-001',
      name: 'Lop Edit Online',
      code: 'CL-EDIT-001',
      classMode: 'ONLINE',
      students: [
        {
          _id: 'student-edit-001',
          fullName: 'Hoc sinh Sua Invoice',
          studentCode: 'HS-EDIT-001',
        },
      ],
    },
    {
      _id: 'class-edit-offline-002',
      name: 'Lop Edit Offline',
      code: 'CL-EDIT-002',
      classMode: 'OFFLINE',
      students: [
        {
          _id: 'student-edit-001',
          fullName: 'Hoc sinh Sua Invoice',
          studentCode: 'HS-EDIT-001',
        },
      ],
    },
  ];

  const initialInvoice: InvoiceItem = {
    _id: 'invoice-edit-001',
    invoiceNumber: 'INV-B07-EDIT-001',
    studentId: {
      _id: 'student-edit-001',
      fullName: 'Hoc sinh Sua Invoice',
      parentName: 'Phu huynh Sua Invoice',
      parentPhone: '0905222001',
      studentCode: 'HS-EDIT-001',
    },
    saleId: {
      _id: 'sale-edit-001',
      fullName: 'Sale Edit Old',
      email: 'sale.edit.old@example.com',
    },
    classId: {
      _id: 'class-edit-online-001',
      name: 'Lop Edit Online',
      code: 'CL-EDIT-001',
    },
    amount: 2100000,
    paymentDate: '2026-04-05T00:00:00.000Z',
    status: 'PENDING_APPROVAL',
    createdBy: {
      _id: 'director-b07',
      fullName: 'Director B07',
      email: 'director.b07@example.com',
    },
    createdAt: '2026-04-11T09:00:00.000Z',
    updatedAt: '2026-04-11T09:00:00.000Z',
    classType: 'ONLINE',
    sessions: 10,
    paymentRound: 1,
    courseStatus: 'NEW',
    description: 'B07 edit invoice before update',
  };

  const expectedPatchPayload = {
    invoiceNumber: 'INV-B07-EDIT-002',
    courseStatus: 'CONTINUE_2',
    studentId: 'student-edit-001',
    classType: 'OFFLINE',
    amount: 2750000,
    paymentDate: '2026-04-18',
    sessions: 8,
    paymentRound: 2,
    classId: 'class-edit-offline-002',
    saleId: 'sale-edit-002',
    description: 'B07 edit invoice after update',
  };

  const updatedInvoice: InvoiceItem = {
    ...initialInvoice,
    invoiceNumber: expectedPatchPayload.invoiceNumber,
    saleId: {
      _id: 'sale-edit-002',
      fullName: 'Sale Edit New',
      email: 'sale.edit.new@example.com',
    },
    classId: {
      _id: 'class-edit-offline-002',
      name: 'Lop Edit Offline',
      code: 'CL-EDIT-002',
    },
    amount: expectedPatchPayload.amount,
    paymentDate: '2026-04-18T00:00:00.000Z',
    classType: 'OFFLINE',
    sessions: expectedPatchPayload.sessions,
    paymentRound: expectedPatchPayload.paymentRound,
    courseStatus: 'CONTINUE_2',
    description: expectedPatchPayload.description,
    updatedAt: '2026-04-11T09:30:00.000Z',
  };

  let invoicesState: InvoiceItem[] = [clone(initialInvoice)];
  let invoicesGetCount = 0;
  const patchBodies: unknown[] = [];

  try {
    await pageRoutesForEdit();
    await applySessionCookies(evidence.context, directorSession);
    await evidence.page.goto(appUrl('/app/invoices'));
    await evidence.page.waitForLoadState('networkidle');

    const initialRow = rowByInvoiceNumber(evidence.page, initialInvoice.invoiceNumber);
    await expect(initialRow).toBeVisible();
    await expect(initialRow.locator('td').nth(7)).toHaveText(formatCurrency(initialInvoice.amount));
    await expect(initialRow.locator('td').nth(8)).toContainText('Sale Edit Old');

    await initialRow.locator('[data-testid="invoice-row-edit"]').click();
    const modal = evidence.page.getByTestId('invoice-form-modal');
    await expect(modal).toBeVisible();
    await expect(modal.getByRole('heading', { name: /Sửa hóa đơn/i })).toBeVisible();
    await expect(evidence.page.getByTestId('invoice-number')).toHaveValue(initialInvoice.invoiceNumber);
    await expect
      .poll(() => selectedOptionLabel(evidence.page, 'invoice-course-status'))
      .toBe('Khóa mới');
    await expect(evidence.page.getByTestId('invoice-class')).toHaveValue('class-edit-online-001');
    await expect(evidence.page.getByTestId('invoice-class-type')).toHaveValue('ONLINE');
    await expect(evidence.page.getByTestId('invoice-sale')).toHaveValue('sale-edit-001');

    await evidence.page.getByTestId('invoice-number').fill(expectedPatchPayload.invoiceNumber);
    await evidence.page.getByTestId('invoice-course-status').selectOption({ label: 'Khóa tiếp lần 2' });
    await evidence.page.getByTestId('invoice-class').selectOption('class-edit-offline-002');
    await expect(evidence.page.getByTestId('invoice-class-type')).toHaveValue('OFFLINE');
    await evidence.page.getByTestId('invoice-sessions').fill(String(expectedPatchPayload.sessions));
    await evidence.page.getByTestId('invoice-payment-round').fill(String(expectedPatchPayload.paymentRound));
    await evidence.page.getByTestId('invoice-amount').fill(String(expectedPatchPayload.amount));
    await evidence.page.getByTestId('invoice-sale').selectOption(expectedPatchPayload.saleId);
    await evidence.page.getByTestId('invoice-payment-date').fill(expectedPatchPayload.paymentDate);
    await evidence.page.getByTestId('invoice-description').fill(expectedPatchPayload.description);
    await evidence.step('invoice-edit-form-updated');

    await evidence.page.getByTestId('invoice-submit').click();

    await expect.poll(() => patchBodies.length).toBe(1);
    expect(patchBodies[0]).toEqual(expectedPatchPayload);
    await expect.poll(() => invoicesGetCount).toBe(2);
    await expect(modal).toHaveCount(0);

    const updatedRow = rowByInvoiceNumber(evidence.page, expectedPatchPayload.invoiceNumber);
    await expect(updatedRow).toBeVisible();
    await expect(updatedRow.locator('td').nth(0)).toHaveText(formatDate(updatedInvoice.paymentDate));
    await expect(updatedRow.locator('td').nth(4)).toContainText('Offline');
    await expect(updatedRow.locator('td').nth(6)).toHaveText('2');
    await expect(updatedRow.locator('td').nth(7)).toHaveText(formatCurrency(updatedInvoice.amount));
    await expect(updatedRow.locator('td').nth(8)).toContainText('Sale Edit New');
    await expect(updatedRow.locator('td').nth(9)).toContainText(/Cho duyet|Chờ duyệt/i);
    await evidence.step('invoice-edit-row-visible-after-reload');

    await evidence.finalize('PASS', {
      extraLines: [
        'Verified edit modal preloads the current invoice values before any change is made.',
        'Verified exact PATCH /invoices/:id payload carries the updated invoice number, course status, class, class type, sessions, payment round, sale, amount, date, and description.',
        'Verified successful save triggers a second GET /invoices and the table row re-renders with the updated invoice number, class type, sale, amount, and payment round.',
      ],
    });
  } catch (error) {
    await evidence.finalize('FAIL', { error });
    throw error;
  }

  async function pageRoutesForEdit(): Promise<void> {
    await installLookupsRoutes(evidence.page, students, sales, classes);

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

    await evidence.page.route(INVOICE_UPDATE_API, async (route) => {
      if (route.request().method() !== 'PATCH') {
        await route.fallback();
        return;
      }

      const body = route.request().postDataJSON();
      patchBodies.push(body);
      invoicesState = [clone(updatedInvoice)];
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, data: clone(updatedInvoice) }),
      });
    });
  }
});
