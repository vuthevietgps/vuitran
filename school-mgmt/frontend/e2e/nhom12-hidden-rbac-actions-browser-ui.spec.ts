import { expect, test, type APIRequestContext, type Browser, type Page } from '@playwright/test';
import {
  applySessionCookies,
  createBatchEvidenceContext,
  loginAsRole,
  type BatchEvidenceSession,
  type DemoRole,
} from './support';

const APP_BASE_URL =
  process.env['PLAYWRIGHT_BASE_URL'] ||
  process.env['E2E_BASE_URL'] ||
  'http://localhost:4200';

const API_ORIGIN_PATTERN = 'https?://(?:localhost|127\\.0\\.0\\.1):3000';
const WALLETS_API = new RegExp(`${API_ORIGIN_PATTERN}/wallets(?:\\?.*)?$`);
const WALLETS_PENDING_API = new RegExp(`${API_ORIGIN_PATTERN}/wallets/top-up/pending(?:\\?.*)?$`);
const INVOICES_API = new RegExp(`${API_ORIGIN_PATTERN}/invoices(?:\\?.*)?$`);
const STUDENTS_API = new RegExp(`${API_ORIGIN_PATTERN}/students(?:\\?.*)?$`);
const USERS_SALES_API = new RegExp(`${API_ORIGIN_PATTERN}/users/sales(?:\\?.*)?$`);
const CLASSES_API = new RegExp(`${API_ORIGIN_PATTERN}/classes(?:\\?.*)?$`);

type WalletItem = {
  _id: string;
  userId: { _id: string; fullName: string; email: string; role: string };
  balance: number;
  totalTopUp: number;
  totalDeducted: number;
  totalRefunded: number;
  status: string;
};

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
  classType: 'ONLINE' | 'OFFLINE';
  saleId: {
    _id: string;
    fullName: string;
    email: string;
  };
  sessions: number;
  paymentRound: number;
  amount: number;
  paymentDate: string;
  status: 'PENDING_APPROVAL' | 'APPROVED' | 'PAID' | 'CANCELLED' | 'REJECTED' | 'PENDING';
  createdBy: {
    _id: string;
    fullName: string;
    email: string;
  };
  createdAt: string;
  updatedAt: string;
};

function appUrl(path: string): string {
  return new URL(path, APP_BASE_URL).toString();
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

async function signInAs(page: Page, request: APIRequestContext, role: DemoRole): Promise<void> {
  await page.context().clearCookies();
  const session = await loginAsRole(request, role);
  await applySessionCookies(page, session);
}

async function openBatch(
  browser: Browser,
  scenario: string,
): Promise<BatchEvidenceSession> {
  return createBatchEvidenceContext(browser, {
    batchId: 'NHOM12',
    scenario,
  });
}

async function installWalletRoutes(page: Page, wallets: WalletItem[]): Promise<void> {
  await page.route(WALLETS_PENDING_API, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });

  await page.route(WALLETS_API, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: clone(wallets),
        meta: { page: 1, limit: 100, total: wallets.length, totalPages: 1 },
      }),
    });
  });
}

async function installInvoiceRoutes(page: Page, invoices: InvoiceItem[]): Promise<void> {
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
      body: JSON.stringify([]),
    });
  });

  await page.route(USERS_SALES_API, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });

  await page.route(CLASSES_API, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });

  await page.route(WALLETS_PENDING_API, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });
}

test.use({
  trace: 'off',
  video: 'on',
});

test('NHOM12 ops wallet surface hides transfer action while accounting keeps the same CTA visible', async ({ browser, request }) => {
  const wallets: WalletItem[] = [
    {
      _id: 'wallet-nhom12-hidden-001',
      userId: {
        _id: 'parent-nhom12-hidden-001',
        fullName: 'Phu huynh Hidden Wallet',
        email: 'wallet.hidden.parent@example.com',
        role: 'PARENT',
      },
      balance: 500000,
      totalTopUp: 1000000,
      totalDeducted: 500000,
      totalRefunded: 0,
      status: 'ACTIVE',
    },
  ];

  const batch = await openBatch(browser, 'wallet_transfer_hidden_browser');

  try {
    await installWalletRoutes(batch.page, wallets);

    await signInAs(batch.page, request, 'accounting');
    await batch.page.goto(appUrl('/app/wallets'));
    await batch.page.waitForLoadState('domcontentloaded');

    await expect(batch.page).toHaveURL(/\/app\/wallets$/);
    await expect(batch.page.getByRole('button', { name: /Chuyển tiền|Chuyen tien/ })).toBeVisible();
    await expect(batch.page.locator('table.data')).toBeVisible();
    await expect(batch.page.locator('tbody tr').filter({ hasText: 'Phu huynh Hidden Wallet' })).toBeVisible();
    await batch.step('wallet-transfer-accounting-visible');

    await signInAs(batch.page, request, 'ops');
    await batch.page.goto(appUrl('/app/wallets'));
    await batch.page.waitForLoadState('domcontentloaded');

    await expect(batch.page).toHaveURL(/\/app\/wallets$/);
    await expect(batch.page.locator('table.data')).toBeVisible();
    await expect(batch.page.locator('tbody tr').filter({ hasText: 'Phu huynh Hidden Wallet' })).toBeVisible();
    await expect(batch.page.getByRole('button', { name: /Chuyển tiền|Chuyen tien/ })).toHaveCount(0);
    await batch.step('wallet-transfer-ops-hidden');

    await batch.finalize('PASS', {
      extraLines: [
        'Accounting keeps the wallet transfer CTA on the same /app/wallets surface: PASS',
        'OPS still reaches /app/wallets for reconciliation work but the transfer CTA stays fully hidden: PASS',
      ],
    });
  } catch (error) {
    await batch.finalize('FAIL', { error });
    throw error;
  }
});

test('NHOM12 invoice delete action stays hidden for accounting sale and ops while director keeps the same control', async ({ browser, request }) => {
  const invoices: InvoiceItem[] = [
    {
      _id: 'invoice-nhom12-hidden-001',
      invoiceNumber: 'INV-NHOM12-DELETE-001',
      studentId: {
        _id: 'student-nhom12-hidden-001',
        fullName: 'Hoc sinh Hidden Invoice',
        parentName: 'Phu huynh Hidden Invoice',
        parentPhone: '0909990001',
        studentCode: 'HS-NH12-001',
      },
      classType: 'ONLINE',
      saleId: {
        _id: 'sale-nhom12-hidden-001',
        fullName: 'Sale Hidden Invoice',
        email: 'sale.hidden.invoice@example.com',
      },
      sessions: 12,
      paymentRound: 1,
      amount: 4800000,
      paymentDate: '2026-04-10T08:00:00.000Z',
      status: 'PENDING_APPROVAL',
      createdBy: {
        _id: 'director-nhom12-hidden-001',
        fullName: 'Director Hidden Invoice',
        email: 'director.hidden.invoice@example.com',
      },
      createdAt: '2026-04-10T08:00:00.000Z',
      updatedAt: '2026-04-10T08:00:00.000Z',
    },
  ];

  const batch = await openBatch(browser, 'invoice_delete_hidden_browser');

  try {
    await installInvoiceRoutes(batch.page, invoices);

    await signInAs(batch.page, request, 'director');
    await batch.page.goto(appUrl('/app/invoices'));
    await batch.page.waitForLoadState('domcontentloaded');

    const directorRow = batch.page.locator('tbody tr').filter({ hasText: 'INV-NHOM12-DELETE-001' }).first();
    await expect(batch.page).toHaveURL(/\/app\/invoices$/);
    await expect(directorRow).toBeVisible();
    await expect(directorRow.getByTestId('invoice-row-delete')).toBeVisible();
    await batch.step('invoice-delete-director-visible');

    for (const role of ['accounting', 'sale', 'ops'] as const) {
      await signInAs(batch.page, request, role);
      await batch.page.goto(appUrl('/app/invoices'));
      await batch.page.waitForLoadState('domcontentloaded');

      const row = batch.page.locator('tbody tr').filter({ hasText: 'INV-NHOM12-DELETE-001' }).first();
      await expect(batch.page).toHaveURL(/\/app\/invoices$/);
      await expect(row).toBeVisible();
      await expect(row.getByTestId('invoice-row-delete')).toHaveCount(0);
      await batch.step(`invoice-delete-${role}-hidden`);
    }

    await batch.finalize('PASS', {
      extraLines: [
        'Director keeps the invoice delete control on the same mocked pending invoice row: PASS',
        'Accounting, SALE, and OPS all keep the delete control fully hidden on that exact row: PASS',
      ],
    });
  } catch (error) {
    await batch.finalize('FAIL', { error });
    throw error;
  }
});
