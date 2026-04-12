import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { apiJson } from '../support/api';
import {
  applySessionCookies,
  loginAsCredentials,
  loginAsRole,
  rolePassword,
} from '../support/auth';
import { seedUiOrchestratorFixtures, type UiOrchestratorFixtures } from '../support/orchestrator-fixtures';
import {
  createBatchEvidenceContext,
  expectRoleContrast,
} from '../support/orchestrator';
import { createParentAccount, type ParentAccount } from '../support/scenario-helpers';
import type { DemoRole } from '../support/types';
import { ROLE_LABELS } from '../../src/app/models/role.enum';

test.use({ video: 'on' });
test.describe.configure({ mode: 'serial' });

const APP_BASE_URL =
  process.env['PLAYWRIGHT_BASE_URL'] ||
  process.env['E2E_BASE_URL'] ||
  'http://localhost:4200';

function appUrl(path: string): string {
  return new URL(path, APP_BASE_URL).toString();
}

function roleName(role: string): string {
  return ROLE_LABELS[String(role).toUpperCase()] || role;
}

async function gotoApp(page: Page, path: string): Promise<void> {
  await page.goto(appUrl(path));
  await page.waitForLoadState('domcontentloaded');
}

async function resetCookies(page: Page): Promise<void> {
  await page.context().clearCookies();
}

async function signIn(page: Page, session: Awaited<ReturnType<typeof loginAsRole>>): Promise<void> {
  await resetCookies(page);
  await applySessionCookies(page, session);
}

async function openOrderFormAsSale(page: Page, request: APIRequestContext): Promise<void> {
  const saleSession = await loginAsRole(request, 'sale');
  await signIn(page, saleSession);
  await gotoApp(page, '/app/orders');
  await page.getByTestId('orders-create-button').click();
  await expect(page.getByTestId('order-form-modal')).toBeVisible();
}

async function getSelectOptionCount(page: Page, testId: string, text: string): Promise<number> {
  return page.getByTestId(testId).locator('option', { hasText: text }).count();
}

let seeded: UiOrchestratorFixtures;
let secondaryParent: ParentAccount;
let multiParentStudent: any;
let pendingClassId = '';

test.beforeAll(async ({ request }) => {
  seeded = await seedUiOrchestratorFixtures(request, 'b01-b03-system-auth-dashboard');

  const directorSession = await loginAsRole(request, 'director');
  await apiJson(
    request,
    directorSession,
    'PATCH',
    `/users/${seeded.freshParent._id}`,
    {
      saleOwnerId: seeded.teacherSwapFixture.sale._id,
    },
    [200, 201],
  );
  secondaryParent = await createParentAccount(request, directorSession, 'b01-b03-secondary-parent');
  await apiJson(
    request,
    directorSession,
    'PATCH',
    `/users/${secondaryParent._id}`,
    {
      saleOwnerId: seeded.teacherSwapFixture.sale._id,
    },
    [200, 201],
  );

  multiParentStudent = await apiJson<any>(
    request,
    directorSession,
    'POST',
    '/students',
    {
      studentCode: `HS${Date.now().toString().slice(-8)}`,
      fullName: 'E2E Multi Parent Student',
      age: 11,
      parentName: seeded.freshParent.fullName,
      parentPhone: seeded.freshParent.phone,
      parentUserId: seeded.freshParent._id,
      saleId: seeded.teacherSwapFixture.sale._id,
      saleName: seeded.teacherSwapFixture.sale.fullName,
      faceImage: 'default-avatar.png',
    },
  );

  pendingClassId = seeded.teacherSwapFixture.classroom._id;

  const saleSession = await loginAsCredentials(
    request,
    'sale',
    seeded.teacherSwapFixture.sale.email,
    rolePassword(),
  );

  await apiJson(
    request,
    saleSession,
    'PATCH',
    `/classes/${pendingClassId}`,
    {
      name: `${seeded.teacherSwapFixture.classroom.name} - Pending Review`,
      teacherId: seeded.teacherSwapFixture.substituteTeacher._id,
    },
    [200, 201],
  );
});

test('B01 Auth and session safeguards', async ({ browser, request }) => {
  const batch = await createBatchEvidenceContext(browser, {
    batchId: 'B01',
    scenario: 'Auth_Session',
  });

  try {
    await batch.page.addInitScript(() => {
      window.localStorage.setItem('school_mgmt_sidebar_collapsed', 'false');
    });

    await gotoApp(batch.page, '/login');
    await expect(batch.page.getByTestId('login-form')).toBeVisible();

    const lockoutEmail = seeded.freshParent.email;
    const loginSubmit = batch.page.getByTestId('login-submit');
    const loginError = batch.page.getByTestId('login-error');
    let loginPostCount = 0;

    await batch.page.route('**/auth/login', async (route) => {
      if (route.request().method() === 'POST') {
        loginPostCount += 1;
      }
      if (loginPostCount === 1) {
        await batch.page.waitForTimeout(650);
      }
      await route.continue();
    });

    for (let attempt = 1; attempt <= 5; attempt += 1) {
      await batch.page.getByTestId('login-email').fill(lockoutEmail);
      await batch.page.getByTestId('login-password').fill(`Wrong-password-${attempt}!`);

      const clickPromise = loginSubmit.click();
      if (attempt === 1) {
        await expect(loginSubmit).toBeDisabled();
        await expect(loginSubmit).toHaveText('Dang xu ly...');
        await loginSubmit.click().catch(() => undefined);
        await expect(loginSubmit).toBeDisabled();
        await expect(loginSubmit).toHaveText('Dang xu ly...');
      }

      await clickPromise;

      if (attempt < 5) {
        await expect(loginError).toHaveText('Sai email hoac mat khau');
      }
    }

    const lockoutText = await loginError.textContent();
    const normalizedLockoutText = String(lockoutText || '')
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .toLowerCase();
    expect(normalizedLockoutText).toMatch(/(tai khoan da bi khoa|ban da thu qua nhieu lan|lock)/);
    expect(normalizedLockoutText).toMatch(/(30 phut|1 phut|thu lai sau|vui long doi)/);
    await batch.step('login-lockout-state');

    await batch.page.unroute('**/auth/login');

    const directorSession = await loginAsRole(request, 'director');
    await signIn(batch.page, directorSession);
    await batch.page.route('**/users/me', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Unauthorized' }),
      });
    });

    await gotoApp(batch.page, '/app/dashboard');
    await expect(batch.page).toHaveURL(/\/login$/);
    await expect(batch.page.getByTestId('login-form')).toBeVisible();
    await batch.step('session-401-redirect');

      await batch.finalize('PASS', {
      extraLines: [
        `Lockout email: ${lockoutEmail}`,
        'Verified submit disable + loading state on the first login attempt.',
        'Verified 401 session restore redirects back to /login.',
      ],
    });
  } catch (error) {
    await batch.finalize('FAIL', { error });
    throw error;
  }
});

test('B02 Dashboard and handbook role rendering', async ({ browser, request }) => {
  const batch = await createBatchEvidenceContext(browser, {
    batchId: 'B02',
    scenario: 'Dashboard_RBAC',
  });

  try {
    await batch.page.addInitScript(() => {
      window.localStorage.setItem('school_mgmt_sidebar_collapsed', 'false');
      (window as any).__dashboardTestDelayMs = 500;
    });

    const roleMatrix: Array<{
      role: DemoRole;
      path: string;
      handbookHref?: string;
      visibleSelectors: string[];
      hiddenSelectors: string[];
    }> = [
      {
        role: 'director',
        path: '/app/dashboard',
        handbookHref: '/app/internal-handbook',
        visibleSelectors: ['[data-testid="nav-users"]', '[data-testid="nav-parent-users"]', '[data-testid="nav-products"]', '[data-testid="nav-pending-approvals"]', '[data-testid="nav-investor-dashboard"]'],
        hiddenSelectors: [],
      },
      {
        role: 'accounting',
        path: '/app/dashboard',
        handbookHref: '/app/internal-handbook',
        visibleSelectors: ['[data-testid="nav-handbook"]', '[data-testid="sidebar-user-role"]', '[data-testid="nav-classes"]'],
        hiddenSelectors: ['[data-testid="nav-products"]', '[data-testid="nav-users"]'],
      },
      {
        role: 'ops',
        path: '/app/dashboard',
        handbookHref: '/app/internal-handbook',
        visibleSelectors: ['[data-testid="nav-pending-approvals"]', '[data-testid="nav-students"]'],
        hiddenSelectors: ['[data-testid="nav-products"]'],
      },
      {
        role: 'teacher',
        path: '/app/dashboard',
        handbookHref: '/app/teacher-hub',
        visibleSelectors: ['[data-testid="nav-handbook"]', '[data-testid="nav-classes"]'],
        hiddenSelectors: ['[data-testid="dashboard-handbook-banner"]', '[data-testid="nav-products"]'],
      },
      {
        role: 'parent',
        path: '/app/dashboard',
        handbookHref: '/app/internal-handbook',
        visibleSelectors: ['[data-testid="nav-handbook"]', '[data-testid="nav-parent-calendar"]'],
        hiddenSelectors: ['[data-testid="nav-products"]', '[data-testid="nav-pending-approvals"]'],
      },
      {
        role: 'sale',
        path: '/app/dashboard',
        handbookHref: '/app/sale-hub',
        visibleSelectors: ['[data-testid="nav-users"]', '[data-testid="nav-students"]'],
        hiddenSelectors: ['[data-testid="nav-products"]', '[data-testid="nav-pending-approvals"]'],
      },
      {
        role: 'adsmanager',
        path: '/app/dashboard',
        handbookHref: '/app/internal-handbook',
        visibleSelectors: ['[data-testid="nav-handbook"]', '[data-testid="nav-notifications"]'],
        hiddenSelectors: ['[data-testid="nav-products"]', '[data-testid="nav-users"]'],
      },
      {
        role: 'shareholder',
        path: '/app/dashboard',
        visibleSelectors: ['[data-testid="investor-dashboard-page"]', '[data-testid="investor-role-chip"]'],
        hiddenSelectors: ['[data-testid="nav-handbook"]', '[data-testid="dashboard-handbook-banner"]'],
      },
    ];

    for (const entry of roleMatrix) {
      const session = await loginAsRole(request, entry.role);
      await signIn(batch.page, session);

      if (entry.role === 'shareholder') {
        await gotoApp(batch.page, entry.path);
        await batch.page.waitForURL(/\/app\/investor-dashboard/);
        await expect(batch.page.getByTestId('investor-dashboard-page')).toBeVisible();
        await expect(batch.page.getByTestId('investor-role-chip')).toHaveText('SHAREHOLDER');
      } else {
        await gotoApp(batch.page, entry.path);
        await expect(batch.page.getByTestId('dashboard-loader')).toBeVisible();
        await expect(batch.page.getByTestId('dashboard-loader')).toBeHidden({ timeout: 15_000 });
        await expect(batch.page.getByTestId('app-sidebar')).toBeVisible();
        await expect(batch.page.locator('app-daily-task-tabs')).toBeVisible();
        await expect(batch.page.getByTestId('sidebar-user-role')).toHaveText(roleName(entry.role));

        if (entry.role === 'teacher') {
          await expect(batch.page.getByTestId('dashboard-handbook-banner')).toHaveCount(0);
        } else {
          await expect(batch.page.getByTestId('dashboard-handbook-banner')).toBeVisible();
        }

        if (entry.handbookHref) {
          await expect(batch.page.getByTestId('nav-handbook')).toHaveAttribute('href', new RegExp(entry.handbookHref.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
        }
      }

      for (const selector of entry.visibleSelectors) {
        await expect(batch.page.locator(selector).first()).toBeVisible();
      }
      for (const selector of entry.hiddenSelectors) {
        await expect(batch.page.locator(selector)).toHaveCount(0);
      }

      await batch.step(`role-${entry.role.toLowerCase()}-dashboard`);
    }

    await batch.finalize('PASS', {
      extraLines: [
        'Verified dashboard loader and handbook banner state across the 8 roles.',
        'Verified sidebar and handbook routing differ by role, including shareholder investor dashboard.',
      ],
    });
  } catch (error) {
    await batch.finalize('FAIL', { error });
    throw error;
  }
});

test('B03 Pending approvals, products, and parent persistence', async ({ browser, request }) => {
  const batch = await createBatchEvidenceContext(browser, {
    batchId: 'B03',
    scenario: 'Users_Products_Parents',
  });

  try {
    await batch.page.addInitScript(() => {
      window.localStorage.setItem('school_mgmt_sidebar_collapsed', 'false');
    });

    const directorSession = await loginAsRole(request, 'director');
    await signIn(batch.page, directorSession);

    await gotoApp(batch.page, '/app/pending-approvals?tab=classes');
    await expect(batch.page.getByTestId('pending-approvals-page')).toBeVisible();
    await expect(batch.page.getByTestId('pending-summary-cards')).toBeVisible();
    await expect(batch.page.getByTestId('pending-tab-classes')).toBeVisible();

    const pendingRow = batch.page.getByTestId(`pending-class-row-${pendingClassId}`);
    await expect(pendingRow).toBeVisible();
    const badgeBefore = Number((await batch.page.getByTestId('nav-badge-pending').textContent().catch(() => '0')) || '0');
    const tabCountBefore = Number((await batch.page.getByTestId('pending-summary-classes').locator('.card-number').textContent().catch(() => '0')) || '0');
    await expect(badgeBefore).toBeGreaterThanOrEqual(1);
    await expect(tabCountBefore).toBeGreaterThanOrEqual(1);

    await batch.step('approvals-before-approve');
    await expect(pendingRow.getByTestId(`pending-class-approve-${pendingClassId}`)).toBeVisible();
    await pendingRow.getByTestId(`pending-class-approve-${pendingClassId}`).click();
    await batch.step('approvals-after-click');
    await expect(pendingRow).toHaveCount(0);

    await batch.page.evaluate(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await batch.page.reload();
    await expect(batch.page.getByTestId('pending-approvals-page')).toBeVisible();
    const badgeAfter = Number((await batch.page.getByTestId('nav-badge-pending').textContent().catch(() => '0')) || '0');
    const tabCountAfter = Number((await batch.page.getByTestId('pending-summary-classes').locator('.card-number').textContent().catch(() => '0')) || '0');
    await expect(badgeAfter).toBeLessThanOrEqual(badgeBefore);
    await expect(tabCountAfter).toBeLessThan(tabCountBefore);
    await gotoApp(batch.page, '/app/dashboard');
    const pendingBadge = batch.page.getByTestId('nav-badge-pending');
    if (badgeAfter > 0) {
      await expect(pendingBadge).toBeVisible();
      await expect(pendingBadge).toHaveText(String(badgeAfter));
    } else {
      await expect(pendingBadge).toHaveCount(0);
    }
    await batch.step('approvals-dashboard-sync');

    const productName = seeded.teacherSwapFixture.product.name;
    const productId = seeded.teacherSwapFixture.product._id;

    await batch.page.route('**/products/**', async (route) => {
      if (route.request().method() === 'PATCH' && route.request().url().includes(`/products/${productId}`)) {
        await batch.page.waitForTimeout(500);
      }
      await route.continue();
    });

    await gotoApp(batch.page, '/app/products');
    const productsSearch = batch.page.locator('.filters input[placeholder="Tim ten goi"]');
    await expect(batch.page.locator('table.data')).toBeVisible();
    await expect(batch.page.locator('tr', { hasText: productName }).first()).toBeVisible();
    await batch.step('products-before-deactivate');

    const productRow = batch.page.locator('tr', { hasText: productName }).first();
    await productRow.getByRole('button', { name: 'Sua' }).click();
    const productModal = batch.page.locator('.modal');
    await expect(productModal).toBeVisible();
    await productModal.locator('input[type="checkbox"][name="isActive"]').uncheck();
    await productModal.getByRole('button', { name: /^(Cap nhat|Luu)$/ }).click();
    await expect(productRow).toHaveClass(/inactive/);
    await expect(productRow.locator('.badge.off')).toBeVisible();
    await batch.step('products-after-deactivate');

    await productsSearch.fill('__no_match__');
    await expect(batch.page.getByText('Chua co goi san pham.')).toBeVisible();
    await batch.step('products-empty-state');

    await openOrderFormAsSale(batch.page, request);
    const optionCount = await getSelectOptionCount(batch.page, 'order-item-product-0', productName);
    expect(optionCount, 'Deactivated product should not appear in sale order dropdown').toBe(0);
    await batch.step('orders-product-dropdown');

    const saleSession = await loginAsRole(request, 'sale');
    await signIn(batch.page, saleSession);
    await gotoApp(batch.page, '/app/students');
    await expect(batch.page.locator('table.data')).toBeVisible();
    const studentRow = batch.page.locator('tr', { hasText: multiParentStudent.studentCode }).first();
    await expect(studentRow).toBeVisible();
    await batch.step('students-before-parent-swap');

    const studentUpdateRoute = '**/students/**';
    await batch.page.route(studentUpdateRoute, async (route) => {
      if (route.request().method() === 'PATCH' && route.request().url().includes(`/students/${multiParentStudent._id}`)) {
        await batch.page.waitForTimeout(450);
      }
      await route.continue();
    });

    await studentRow.getByRole('button', { name: 'Sua' }).click();
    const studentModal = batch.page.locator('.modal');
    await expect(studentModal).toBeVisible();
    const parentSelect = studentModal.locator('select[name="parentUserId"]');
    await expect(parentSelect.locator(`option[value="${seeded.freshParent._id}"]`)).toHaveCount(1);
    await expect(parentSelect.locator(`option[value="${secondaryParent._id}"]`)).toHaveCount(1);
    await parentSelect.selectOption(secondaryParent._id);
    await expect(studentModal.locator('input[name="parentName"]')).toHaveValue(secondaryParent.fullName);
    await expect(studentModal.locator('input[name="parentPhone"]')).toHaveValue(secondaryParent.phone);
    await studentModal.getByRole('button', { name: 'Luu' }).click();
    await expect(batch.page.locator('.modal-backdrop')).toHaveCount(0);

    await batch.page.reload();
    await expect(batch.page.locator('table.data')).toBeVisible();
    await expect(batch.page.locator('tr', { hasText: secondaryParent.fullName }).first()).toBeVisible();
    await batch.step('students-after-parent-swap');

    await studentRow.getByRole('button', { name: 'Sua' }).click().catch(() => undefined);
    await expect(batch.page.locator('.modal')).toBeVisible();
    await expect(batch.page.locator('select[name="parentUserId"]')).toHaveValue(secondaryParent._id);
    await batch.step('students-persistence-detail');

    await gotoApp(batch.page, '/app/users?role=PARENT');
    await expect(batch.page.locator('table.data')).toBeVisible();
    const parentSearch = batch.page.getByPlaceholder('Tim theo ma, email hoac ho ten');
    await parentSearch.fill(seeded.freshParent.email);
    await expect(batch.page.locator('td').filter({ hasText: seeded.freshParent.email }).first()).toBeVisible();
    await parentSearch.fill(secondaryParent.email);
    await expect(batch.page.locator('td').filter({ hasText: secondaryParent.email }).first()).toBeVisible();
    await batch.step('users-parent-view');

    await expectRoleContrast(browser, request, {
      path: '/app/users?role=PARENT',
      allowedRole: 'director',
      deniedRole: 'sale',
      visibleSelector: 'button.danger',
      hiddenSelector: 'button.danger',
    });

    await batch.finalize('PASS', {
      extraLines: [
        `Pending approvals class id: ${pendingClassId}`,
        `Deactivated product: ${productName}`,
        `Student reassigned from ${seeded.freshParent.fullName} to ${secondaryParent.fullName}`,
        'Verified parent list/detail persistence after reload and RBAC contrast for sensitive controls.',
      ],
    });
  } catch (error) {
    await batch.finalize('FAIL', { error });
    throw error;
  }
});
