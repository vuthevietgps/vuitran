import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { apiJson } from '../support/api';
import { applySessionCookies, loginAsCredentials, loginAsRole } from '../support/auth';
import { createBatchEvidenceContext } from '../support/orchestrator';
import {
  createParentAccount,
  initializeWalletForParent,
  type ParentAccount,
} from '../support/scenario-helpers';

test.use({ video: 'on' });
test.describe.configure({ mode: 'serial', timeout: 120_000 });
test.setTimeout(120_000);

const APP_BASE_URL =
  process.env['PLAYWRIGHT_BASE_URL']
  || process.env['E2E_BASE_URL']
  || 'http://localhost:4200';

const PENDING_TOP_UP_AMOUNT = 500_000;

function appUrl(path: string): string {
  return new URL(path, APP_BASE_URL).toString();
}

async function gotoApp(page: Page, path: string): Promise<void> {
  await page.goto(appUrl(path));
  await page.waitForLoadState('domcontentloaded');
}

async function signInWithSession(page: Page, session: Awaited<ReturnType<typeof loginAsRole>>): Promise<void> {
  await applySessionCookies(page, session);
}

async function seedAccountingWidget(
  request: APIRequestContext,
  directorSession: Awaited<ReturnType<typeof loginAsRole>>,
): Promise<ParentAccount> {
  const parent = await createParentAccount(request, directorSession, 'b02-dashboard-handbook');
  await initializeWalletForParent(request, parent);
  await apiJson<any>(
    request,
    directorSession,
    'POST',
    '/wallets/top-up',
    {
      userId: parent._id,
      amount: PENDING_TOP_UP_AMOUNT,
      paymentMethod: 'BANK_TRANSFER',
      transactionRef: `B02-${Date.now()}`,
      receiptImageUrl: '/uploads/wallets/e2e-top-up.png',
      description: 'B02 pending top-up seed',
    },
    [200, 201],
  );

  return parent;
}

let seededParent: ParentAccount;
let shareholderAccount: { email: string; password: string };

test.beforeAll(async ({ request }) => {
  const directorSession = await loginAsRole(request, 'director');
  seededParent = await seedAccountingWidget(request, directorSession);
  const uniqueStamp = Date.now().toString();
  const email = `e2e-shareholder-${uniqueStamp.slice(-8)}@school.local`;
  const phone = `09${uniqueStamp.slice(-8).padStart(8, '0')}`;
  const password = 'Demo123456!';

  await apiJson<any>(
    request,
    directorSession,
    'POST',
    '/users',
    {
      userCode: `SH${uniqueStamp.slice(-8)}`,
      email,
      password,
      fullName: 'E2E Shareholder',
      role: 'SHAREHOLDER',
      phone,
      ownershipPercentage: 15,
    },
    [200, 201],
  );

  shareholderAccount = { email, password };
});

test('B02 dashboard widgets open the right module for accounting', async ({ browser, request }) => {
  const batch = await createBatchEvidenceContext(browser, {
    batchId: 'B02',
    scenario: 'dashboard-widgets-accounting',
  });

  try {
    await batch.page.addInitScript(() => {
      window.localStorage.setItem('school_mgmt_sidebar_collapsed', 'false');
    });

    const accountingSession = await loginAsRole(request, 'accounting');
    await signInWithSession(batch.page, accountingSession);

    await gotoApp(batch.page, '/app/dashboard');
    await expect(batch.page.locator('app-daily-task-tabs')).toBeVisible({ timeout: 15_000 });

    const tabCount = batch.page.locator('app-daily-task-tabs .tab-count').first();
    await expect(tabCount).toHaveText(/^[1-9]\d*$/);

    const topUpRow = batch.page.locator('tr').filter({ hasText: /Xac nhan nap vi|Yeu cau nap vi/i }).first();
    await expect(topUpRow).toBeVisible();
    await expect(topUpRow.locator('.task-title')).toContainText(/Xac nhan nap vi|Yeu cau nap vi/i);
    await topUpRow.locator('.open-link').click();
    await expect(batch.page).toHaveURL(/\/app\/wallets(?:\?.*)?$/);
    await batch.step('accounting-dashboard-widget-wallets');

    await batch.finalize('PASS', {
      extraLines: [
        `Seeded pending top-up amount: ${PENDING_TOP_UP_AMOUNT.toLocaleString('vi-VN')}đ`,
        `Seeded parent: ${seededParent.email}`,
        'Verified the accounting dashboard widget count is visible and routes to /app/wallets.',
      ],
    });
  } catch (error) {
    await batch.finalize('FAIL', { error });
    throw error;
  }
});

test('B02 internal handbook renders director guidance and keywords', async ({ browser, request }) => {
  const batch = await createBatchEvidenceContext(browser, {
    batchId: 'B02',
    scenario: 'internal-handbook-director',
  });

  try {
    await batch.page.addInitScript(() => {
      window.localStorage.setItem('school_mgmt_sidebar_collapsed', 'false');
    });

    const directorSession = await loginAsRole(request, 'director');
    await signInWithSession(batch.page, directorSession);

    await gotoApp(batch.page, '/app/dashboard');
    await expect(batch.page.getByTestId('nav-handbook')).toBeVisible();
    await batch.page.getByTestId('nav-handbook').click();
    await expect(batch.page).toHaveURL(/\/app\/internal-handbook$/);
    await expect(batch.page.getByTestId('internal-handbook-page')).toBeVisible();
    await expect(batch.page.getByTestId('handbook-primary-link')).toBeVisible();
    await expect(batch.page.getByTestId('internal-handbook-page')).toContainText(/nhin toan canh|nhìn toàn cảnh/i);
    await expect(batch.page.getByTestId('internal-handbook-page')).toContainText(/kiem tra|kiểm tra/i);
    await expect(batch.page.getByTestId('internal-handbook-page')).toContainText(/truy vet|truy vết/i);
    await batch.step('director-internal-handbook');

    await batch.finalize('PASS', {
      extraLines: [
        'Verified director handbook opens from the sidebar link.',
        'Verified handbook content includes overview, inspection, and tracing guidance.',
      ],
    });
  } catch (error) {
    await batch.finalize('FAIL', { error });
    throw error;
  }
});

test('B02 shareholder dashboard stays read-only and redirects to investor dashboard', async ({ browser, request }) => {
  const batch = await createBatchEvidenceContext(browser, {
    batchId: 'B02',
    scenario: 'shareholder-read-only',
  });

  try {
    await batch.page.addInitScript(() => {
      window.localStorage.setItem('school_mgmt_sidebar_collapsed', 'false');
    });

    const shareholderSession = await loginAsCredentials(
      request,
      'shareholder',
      shareholderAccount.email,
      shareholderAccount.password,
    );
    await signInWithSession(batch.page, shareholderSession);

    await gotoApp(batch.page, '/app/dashboard');
    await expect(batch.page).toHaveURL(/\/app\/investor-dashboard$/);
    await expect(batch.page.getByTestId('investor-dashboard-page')).toBeVisible();
    await expect(batch.page.getByTestId('investor-metric-grid')).toBeVisible();
    await expect(batch.page.getByTestId('investor-metric-cash')).toContainText(/Tien mat hien co|Tiền mặt hiện có/i);
    await expect(batch.page.getByTestId('investor-panel-revenue')).toContainText(/Doanh thu/i);
    await expect(batch.page.getByTestId('investor-panel-dashboard')).toContainText(/Available cash|Cash/i);

    const destructiveActions = batch.page.locator('button, a, [role="button"]').filter({
      hasText: /Tao moi|Tạo mới|Sua|Sửa|Xoa|Xóa/i,
    });
    await expect(destructiveActions).toHaveCount(0);
    await batch.step('shareholder-investor-dashboard-read-only');

    await batch.finalize('PASS', {
      extraLines: [
        'Verified shareholder redirects away from /app/dashboard to /app/investor-dashboard.',
        'Verified investor cards render and there are no create/edit/delete actions in DOM.',
      ],
    });
  } catch (error) {
    await batch.finalize('FAIL', { error });
    throw error;
  }
});
