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
const PENDING_TOPUPS_API = new RegExp(`${API_ORIGIN_PATTERN}/wallets/top-up/pending(?:\\?.*)?$`);

type WalletItem = {
  _id: string;
  userId: {
    _id: string;
    fullName: string;
    email?: string;
    phone?: string;
    role?: string;
  };
  balance: number;
  totalTopUp: number;
  totalDeducted: number;
  totalRefunded: number;
  status: string;
  lastTransactionAt?: string;
};

function appUrl(path: string): string {
  return new URL(path, APP_BASE_URL).toString();
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

async function openWalletTransferVisibilityBatch(
  browser: Browser,
  request: APIRequestContext,
): Promise<BatchEvidenceSession> {
  const batch = await createBatchEvidenceContext(browser, {
    batchId: 'N12',
    scenario: 'wallet_transfer_visibility_matrix',
  });
  const directorSession = await loginAsRole(request, 'director');
  await applySessionCookies(batch.page, directorSession);
  return batch;
}

async function installWalletRoutes(page: Page, wallets: WalletItem[]): Promise<void> {
  await page.route(WALLETS_API, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: clone(wallets),
        meta: {
          page: 1,
          limit: 100,
          total: wallets.length,
        },
      }),
    });
  });

  await page.route(PENDING_TOPUPS_API, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });
}

async function signInAs(page: Page, request: APIRequestContext, role: DemoRole): Promise<void> {
  await page.context().clearCookies();
  const session = await loginAsRole(request, role);
  await applySessionCookies(page, session);
}

async function assertWalletRoleView(
  batch: BatchEvidenceSession,
  request: APIRequestContext,
  role: DemoRole,
  transferVisible: boolean,
): Promise<void> {
  await signInAs(batch.page, request, role);
  await batch.page.goto(appUrl('/app/wallets'));
  await batch.page.waitForLoadState('domcontentloaded');

  await expect(batch.page).toHaveURL(/\/app\/wallets$/);
  const walletRow = batch.page.locator('table.data tbody tr').filter({ hasText: 'Phu huynh Wallet Matrix' }).first();
  await expect(walletRow).toBeVisible();
  await expect(walletRow).toContainText('parent.wallet.matrix@example.com');

  const transferButton = batch.page.getByRole('button', { name: /Chuyển tiền|Chuyen tien/i });
  if (transferVisible) {
    await expect(transferButton).toBeVisible();
  } else {
    await expect(transferButton).toHaveCount(0);
  }

  await batch.step(`wallet-transfer-visibility-${role}`);
}

test.use({
  trace: 'off',
  video: 'on',
});

test('N12 wallet transfer action stays hidden for ops while director and accounting keep the CTA', async ({ browser, request }) => {
  const wallets: WalletItem[] = [
    {
      _id: 'wallet-n12-parent-001',
      userId: {
        _id: 'parent-wallet-matrix-001',
        fullName: 'Phu huynh Wallet Matrix',
        email: 'parent.wallet.matrix@example.com',
        phone: '0906666666',
        role: 'PARENT',
      },
      balance: 4200000,
      totalTopUp: 5000000,
      totalDeducted: 800000,
      totalRefunded: 0,
      status: 'ACTIVE',
      lastTransactionAt: '2026-04-10T08:45:00.000Z',
    },
  ];

  const batch = await openWalletTransferVisibilityBatch(browser, request);

  try {
    await installWalletRoutes(batch.page, wallets);

    await assertWalletRoleView(batch, request, 'director', true);
    await assertWalletRoleView(batch, request, 'accounting', true);
    await assertWalletRoleView(batch, request, 'ops', false);

    await batch.finalize('PASS', {
      extraLines: [
        'Verified DIRECTOR keeps the transfer CTA on /app/wallets.',
        'Verified ACCOUNTING keeps the same transfer CTA on the same wallet table surface.',
        'Verified OPS can still open /app/wallets for reconciliation but the transfer CTA count stays 0.',
      ],
    });
  } catch (error) {
    await batch.finalize('FAIL', { error });
    throw error;
  }
});
