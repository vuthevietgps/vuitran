import { expect, test, type Page } from '@playwright/test';
import { apiJson } from '../support/api';
import { createBatchEvidenceContext } from '../support/orchestrator';
import { applySessionCookies, loginAsCredentials, loginAsRole, roleEmail, rolePassword } from '../support/auth';
import { uniquePhone } from '../support';

test.use({ video: 'on' });
test.describe.configure({ mode: 'serial', timeout: 120_000 });

const APP_BASE_URL =
  process.env['PLAYWRIGHT_BASE_URL']
  || process.env['E2E_BASE_URL']
  || 'http://localhost:4200';

function appUrl(path: string): string {
  return new URL(path, APP_BASE_URL).toString();
}

async function gotoLogin(page: Page): Promise<void> {
  await page.goto(appUrl('/login'));
  await page.waitForLoadState('domcontentloaded');
}

async function loginViaUi(page: Page, role: 'director' | 'parent'): Promise<void> {
  await gotoLogin(page);
  await page.getByTestId('login-email').fill(roleEmail(role));
  await page.getByTestId('login-password').fill(rolePassword());
  await page.getByTestId('login-submit').click();
  await page.waitForURL(/\/app\/dashboard$/, { waitUntil: 'domcontentloaded' });
}

async function logoutViaUi(page: Page): Promise<void> {
  await page.getByRole('button', { name: /dang xuat|đăng xuất/i }).click();
  await page.waitForURL(/\/login$/);
  await expect(page.getByTestId('login-form')).toBeVisible();
}

async function signInWithSession(page: Page, session: Awaited<ReturnType<typeof loginAsRole>>): Promise<void> {
  await applySessionCookies(page, session);
}

async function openAppAsRole(page: Page, role: 'director' | 'parent'): Promise<void> {
  await loginViaUi(page, role);
  await expect(page.getByTestId('app-sidebar')).toBeVisible();
}

function sidebarLink(page: Page, href: string) {
  return page.getByTestId('app-sidebar').locator(`a[href="${href}"]`);
}

async function expectRouteGuardRedirect(page: Page): Promise<void> {
  await page.waitForLoadState('domcontentloaded');
  await expect(page).toHaveURL(/\/(not-authorized|app\/dashboard)$/);
}

test('B01 RBAC sidebar distinguishes director and parent access', async ({ browser }) => {
  const batch = await createBatchEvidenceContext(browser, {
    batchId: 'B01',
    scenario: 'auth-appshell-rbac-sidebar',
  });

  try {
    await batch.page.addInitScript(() => {
      window.localStorage.setItem('school_mgmt_sidebar_collapsed', 'false');
    });

    await openAppAsRole(batch.page, 'director');
    await expect(batch.page.getByTestId('app-sidebar')).toBeVisible();
    await expect(sidebarLink(batch.page, '/app/financial-control')).toBeVisible();
    await expect(sidebarLink(batch.page, '/app/payroll')).toBeVisible();
    await expect(batch.page.getByTestId('nav-users')).toBeVisible();
    await expect(batch.page.getByTestId('nav-parent-users')).toBeVisible();
    await batch.step('director-sidebar-sensitive-items');

    await logoutViaUi(batch.page);
    await loginViaUi(batch.page, 'parent');
    await expect(batch.page.getByTestId('app-sidebar')).toBeVisible();
    await expect(sidebarLink(batch.page, '/app/financial-control')).toHaveCount(0);
    await expect(sidebarLink(batch.page, '/app/payroll')).toHaveCount(0);
    await expect(batch.page.getByTestId('nav-users')).toHaveCount(0);
    await expect(batch.page.getByTestId('nav-parent-users')).toHaveCount(0);
    await expect(sidebarLink(batch.page, '/app/parent-invoices')).toBeVisible();
    await expect(sidebarLink(batch.page, '/app/wallets')).toBeVisible();
    await batch.step('parent-sidebar-restricted-items');

    await batch.finalize('PASS', {
      extraLines: [
        'Verified director sees finance and staff-management links in sidebar.',
        'Verified parent does not see /app/financial-control, /app/payroll, or user-management links.',
      ],
    });
  } catch (error) {
    await batch.finalize('FAIL', { error });
    throw error;
  }
});

test('B01 route guard redirects parent away from restricted finance routes', async ({ browser }) => {
  const batch = await createBatchEvidenceContext(browser, {
    batchId: 'B01',
    scenario: 'auth-appshell-route-guard',
  });

  try {
    await batch.page.addInitScript(() => {
      window.localStorage.setItem('school_mgmt_sidebar_collapsed', 'false');
    });

    await openAppAsRole(batch.page, 'parent');
    await batch.page.goto(appUrl('/app/financial-control'));
    await expectRouteGuardRedirect(batch.page);
    await batch.step('parent-guard-financial-control');

    await batch.page.goto(appUrl('/app/payroll'));
    await expectRouteGuardRedirect(batch.page);
    await batch.step('parent-guard-payroll');

    await batch.finalize('PASS', {
      extraLines: [
        'Verified parent is redirected away from /app/financial-control and /app/payroll.',
        'Accepted redirect targets: /not-authorized or /app/dashboard.',
      ],
    });
  } catch (error) {
    await batch.finalize('FAIL', { error });
    throw error;
  }
});

test('B01 shareholder lands on investor dashboard without UI errors', async ({ browser, request }) => {
  const batch = await createBatchEvidenceContext(browser, {
    batchId: 'B01',
    scenario: 'auth-appshell-shareholder-redirect',
  });

  try {
    await batch.page.addInitScript(() => {
      window.localStorage.setItem('school_mgmt_sidebar_collapsed', 'false');
    });

    const directorSession = await loginAsRole(request, 'director');
    const uniqueStamp = Date.now().toString();
    const email = `e2e-shareholder-${uniqueStamp.slice(-8)}@school.local`;
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
        phone: uniquePhone(`b01-shareholder-${uniqueStamp}`),
        ownershipPercentage: 10,
      },
      [200, 201],
    );

    const shareholderSession = await loginAsCredentials(request, 'shareholder', email, password);
    await signInWithSession(batch.page, shareholderSession);
    await batch.page.goto(appUrl('/app/dashboard'));
    await batch.page.waitForURL(/\/app\/investor-dashboard$/, { waitUntil: 'domcontentloaded' });

    await expect(batch.page).toHaveURL(/\/app\/investor-dashboard$/);
    await expect(batch.page.getByTestId('investor-dashboard-page')).toBeVisible();
    await expect(batch.page.getByTestId('investor-role-chip')).toHaveText('SHAREHOLDER');
    await expect(batch.page.getByTestId('investor-metric-cash')).toBeVisible();
    await expect(batch.page.getByTestId('investor-panel-dashboard')).toBeVisible();
    await expect(batch.page.getByRole('button', { name: /Tao moi|Tạo mới|Sua|Sửa|Xoa|Xóa/i })).toHaveCount(0);
    await expect(batch.page.getByTestId('investor-page-error')).toHaveCount(0);
    await batch.step('shareholder-investor-dashboard');

    await batch.finalize('PASS', {
      extraLines: [
        'Verified shareholder is redirected to /app/investor-dashboard.',
        'Verified investor dashboard cards render and action buttons are absent.',
      ],
    });
  } catch (error) {
    await batch.finalize('FAIL', { error });
    throw error;
  }
});

test('B01 unknown routes fall back to login under current wildcard contract', async ({ browser, request }) => {
  const batch = await createBatchEvidenceContext(browser, {
    batchId: 'B01',
    scenario: 'auth-appshell-unknown-route',
  });

  try {
    await batch.page.addInitScript(() => {
      window.localStorage.setItem('school_mgmt_sidebar_collapsed', 'false');
    });

    await batch.page.goto(appUrl('/khong-ton-tai'));
    await batch.page.waitForURL(/\/login$/, { waitUntil: 'domcontentloaded' });
    await expect(batch.page).toHaveURL(/\/login$/);
    await expect(batch.page.getByTestId('login-form')).toBeVisible();
    await batch.step('anonymous-unknown-route-to-login');

    const directorSession = await loginAsRole(request, 'director');
    await batch.page.context().clearCookies();
    await signInWithSession(batch.page, directorSession);

    await batch.page.goto(appUrl('/app/man-hinh-khong-ton-tai'));
    await batch.page.waitForURL(/\/login$/, { waitUntil: 'domcontentloaded' });
    await expect(batch.page).toHaveURL(/\/login$/);
    await expect(batch.page.getByTestId('login-form')).toBeVisible();
    await batch.step('authenticated-unknown-route-to-login');

    await batch.finalize('PASS', {
      extraLines: [
        'Verified top-level unknown routes redirect to /login.',
        'Verified unknown nested /app routes also fall back to /login under the current wildcard route contract.',
      ],
    });
  } catch (error) {
    await batch.finalize('FAIL', { error });
    throw error;
  }
});
