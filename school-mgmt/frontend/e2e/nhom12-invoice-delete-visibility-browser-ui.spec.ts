import { expect, test, type APIRequestContext, type Browser, type Page } from '@playwright/test';
import {
  applySessionCookies,
  createBatchEvidenceContext,
  loginAsRole,
  type BatchEvidenceSession,
  type DemoRole,
  type DemoSession,
} from './support';

const APP_BASE_URL =
  process.env['PLAYWRIGHT_BASE_URL'] ||
  process.env['E2E_BASE_URL'] ||
  'http://localhost:4200';

const API_ORIGIN_PATTERN = 'https?://(?:localhost|127\\.0\\.0\\.1):3000';
const INVOICES_API = new RegExp(`${API_ORIGIN_PATTERN}/invoices(?:\\?.*)?$`);
const STUDENTS_API = new RegExp(`${API_ORIGIN_PATTERN}/students(?:\\?.*)?$`);
const SALES_API = new RegExp(`${API_ORIGIN_PATTERN}/users/sales(?:\\?.*)?$`);
const CLASSES_API = new RegExp(`${API_ORIGIN_PATTERN}/classes(?:\\?.*)?$`);

type InvoiceStudent = {
  _id: string;
  fullName: string;
  parentName: string;
  parentPhone: string;
  studentCode?: string;
};

type InvoiceSale = {
  _id: string;
  fullName: string;
  email: string;
};

type InvoiceClass = {
  _id: string;
  name: string;
  code: string;
};

type InvoiceItem = {
  _id: string;
  invoiceNumber: string;
  studentId: InvoiceStudent;
  saleId?: InvoiceSale;
  classId?: InvoiceClass;
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
  courseStatus?: 'NEW';
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
};

function appUrl(path: string): string {
  return new URL(path, APP_BASE_URL).toString();
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

async function openInvoiceDeleteVisibilityBatch(
  browser: Browser,
  request: APIRequestContext,
): Promise<BatchEvidenceSession> {
  const batch = await createBatchEvidenceContext(browser, {
    batchId: 'N12',
    scenario: 'invoice_delete_visibility_matrix',
  });
  const directorSession = await loginAsRole(request, 'director');
  await applySessionCookies(batch.page, directorSession);
  return batch;
}

async function installInvoicesRoutes(
  page: Page,
  invoices: InvoiceItem[],
  students: StudentItem[],
  sales: SaleUser[],
  classes: ClassItem[],
): Promise<void> {
  await page.route(INVOICES_API, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(clone(invoices)),
    });
  });

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

async function signInAs(page: Page, request: APIRequestContext, role: DemoRole): Promise<DemoSession> {
  await page.context().clearCookies();
  const session = await loginAsRole(request, role);
  await applySessionCookies(page, session);
  return session;
}

async function assertRoleView(
  batch: BatchEvidenceSession,
  request: APIRequestContext,
  role: DemoRole,
  expected: {
    deleteVisible: boolean;
    editVisible?: boolean;
    approveVisible?: boolean;
  },
): Promise<void> {
  const session = await signInAs(batch.page, request, role);
  await batch.page.goto(appUrl('/app/invoices'));
  await batch.page.waitForLoadState('domcontentloaded');

  await expect(batch.page).toHaveURL(/\/app\/invoices$/);
  const row = batch.page.locator('[data-testid="invoice-row"]').filter({ hasText: 'INV-N12-DELETE-001' }).first();
  await expect(row).toBeVisible();
  await expect(row).toContainText('Hoc sinh Invoice Matrix');
  await expect(row).toContainText('Sale Invoice Matrix');

  const deleteButton = row.getByTestId('invoice-row-delete');
  if (expected.deleteVisible) {
    await expect(deleteButton).toBeVisible();
  } else {
    await expect(deleteButton).toHaveCount(0);
  }

  if (expected.editVisible !== undefined) {
    const editButton = row.getByTestId('invoice-row-edit');
    if (expected.editVisible) {
      await expect(editButton).toBeVisible();
    } else {
      await expect(editButton).toHaveCount(0);
    }
  }

  if (expected.approveVisible !== undefined) {
    const approveButton = row.getByTestId('invoice-row-approve');
    if (expected.approveVisible) {
      await expect(approveButton).toBeVisible();
    } else {
      await expect(approveButton).toHaveCount(0);
    }
  }

  await batch.step(`invoice-delete-visibility-${role}-${session.user?.sub || 'unknown'}`);
}

test.use({
  trace: 'off',
  video: 'on',
});

test('N12 invoice delete action stays hidden for accounting sale and ops while director keeps delete access', async ({ browser, request }) => {
  const saleSession = await loginAsRole(request, 'sale');
  const saleUserId = String(saleSession.user?.sub || saleSession.user?._id || '');
  expect(saleUserId).not.toHaveLength(0);

  const invoiceStudent: InvoiceStudent = {
    _id: 'student-n12-invoice-001',
    fullName: 'Hoc sinh Invoice Matrix',
    parentName: 'Phu huynh Invoice Matrix',
    parentPhone: '0905555555',
    studentCode: 'HS-N12-INV-001',
  };

  const invoiceSale: InvoiceSale = {
    _id: saleUserId,
    fullName: 'Sale Invoice Matrix',
    email: 'sale.invoice.matrix@example.com',
  };

  const invoiceClass: InvoiceClass = {
    _id: 'class-n12-invoice-001',
    name: 'Lop Invoice Matrix',
    code: 'CL-N12-INV-001',
  };

  const invoices: InvoiceItem[] = [
    {
      _id: 'invoice-n12-delete-001',
      invoiceNumber: 'INV-N12-DELETE-001',
      studentId: invoiceStudent,
      saleId: invoiceSale,
      classId: invoiceClass,
      amount: 2800000,
      paymentDate: '2026-04-10',
      status: 'PENDING_APPROVAL',
      createdBy: {
        _id: saleUserId,
        fullName: 'Sale Invoice Matrix',
        email: 'sale.invoice.matrix@example.com',
      },
      createdAt: '2026-04-10T09:00:00.000Z',
      updatedAt: '2026-04-10T09:15:00.000Z',
      classType: 'ONLINE',
      sessions: 12,
      courseStatus: 'NEW',
    },
  ];

  const students: StudentItem[] = [
    {
      _id: invoiceStudent._id,
      studentCode: invoiceStudent.studentCode || '',
      fullName: invoiceStudent.fullName,
      age: 11,
      parentName: invoiceStudent.parentName,
      parentPhone: invoiceStudent.parentPhone,
      faceImage: '/uploads/faces/n12-invoice-matrix.png',
    },
  ];

  const sales: SaleUser[] = [
    {
      _id: saleUserId,
      email: invoiceSale.email,
      fullName: invoiceSale.fullName,
      role: 'SALE',
    },
  ];

  const classes: ClassItem[] = [
    {
      _id: invoiceClass._id,
      name: invoiceClass.name,
      code: invoiceClass.code,
    },
  ];

  const batch = await openInvoiceDeleteVisibilityBatch(browser, request);

  try {
    await installInvoicesRoutes(batch.page, invoices, students, sales, classes);

    await assertRoleView(batch, request, 'director', {
      deleteVisible: true,
      editVisible: true,
      approveVisible: true,
    });

    await assertRoleView(batch, request, 'accounting', {
      deleteVisible: false,
      editVisible: true,
      approveVisible: true,
    });

    await assertRoleView(batch, request, 'sale', {
      deleteVisible: false,
      editVisible: true,
      approveVisible: false,
    });

    await assertRoleView(batch, request, 'ops', {
      deleteVisible: false,
      editVisible: false,
      approveVisible: false,
    });

    await batch.finalize('PASS', {
      extraLines: [
        'Verified DIRECTOR still sees the row-level delete button on the same pending invoice row.',
        'Verified ACCOUNTING keeps edit and approve access but the delete button count stays 0.',
        'Verified SALE keeps edit on their own pending invoice while delete stays hidden.',
        'Verified OPS sees the invoice row without any delete surface leaking into the actions column.',
      ],
    });
  } catch (error) {
    await batch.finalize('FAIL', { error });
    throw error;
  }
});
