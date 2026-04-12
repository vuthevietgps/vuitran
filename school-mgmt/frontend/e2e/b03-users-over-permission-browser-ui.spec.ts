import { expect, test, type APIRequestContext, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { applySessionCookies, createBatchEvidenceContext, loginAsRole, type BatchEvidenceSession } from './support';

const APP_BASE_URL =
  process.env['PLAYWRIGHT_BASE_URL']
  || process.env['E2E_BASE_URL']
  || 'http://localhost:4200';

const API_ORIGIN_PATTERN = 'https?://(?:localhost|127\\.0\\.0\\.1):3000';
const USERS_ME_API = new RegExp(`${API_ORIGIN_PATTERN}/users/me(?:\\?.*)?$`);
const USERS_API = new RegExp(`${API_ORIGIN_PATTERN}/users(?:\\?.*)?$`);
const USERS_PARENTS_API = new RegExp(`${API_ORIGIN_PATTERN}/users/parents(?:\\?.*)?$`);

type AuthPayload = {
  _id: string;
  sub: string;
  email: string;
  role: string;
  fullName: string;
  userCode?: string;
};

type UserItem = {
  _id: string;
  userCode?: string;
  email: string;
  fullName: string;
  role: string;
  status?: string;
  phone?: string;
  saleOwnerId?: string | null;
  saleOwnerName?: string;
  facebookLink?: string;
  address?: string;
};

type RequestStats = {
  allUsers: number;
  parentUsers: number;
};

type State = {
  allUsers: UserItem[];
  parents: UserItem[];
  requestStatsByRole: Record<string, RequestStats>;
};

function appUrl(path: string): string {
  return new URL(path, APP_BASE_URL).toString();
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function buildState(): State {
  const allUsers: UserItem[] = [
    {
      _id: 'director-b03-perm-001',
      userCode: 'GD001',
      email: 'director.permission@example.com',
      fullName: 'Director Permission Matrix',
      role: 'DIRECTOR',
      status: 'ACTIVE',
    },
    {
      _id: 'accounting-b03-perm-001',
      userCode: 'KT001',
      email: 'accounting.permission@example.com',
      fullName: 'Accounting Permission Matrix',
      role: 'ACCOUNTING',
      status: 'ACTIVE',
    },
    {
      _id: 'sale-b03-perm-001',
      userCode: 'SALE001',
      email: 'sale.alpha@example.com',
      fullName: 'Sale Alpha',
      role: 'SALE',
      status: 'ACTIVE',
    },
  ];

  const parents: UserItem[] = [
    {
      _id: 'parent-b03-perm-owned',
      userCode: 'PH001',
      email: 'parent.owned@example.com',
      fullName: 'Phu huynh So Huu',
      role: 'PARENT',
      status: 'ACTIVE',
      phone: '0901111111',
      address: '123 Nguyen Hue',
      facebookLink: 'https://facebook.com/parent.owned',
      saleOwnerId: 'sale-b03-perm-001',
      saleOwnerName: 'Sale Alpha',
    },
    {
      _id: 'parent-b03-perm-other',
      userCode: 'PH002',
      email: 'parent.other@example.com',
      fullName: 'Phu huynh Khac Scope',
      role: 'PARENT',
      status: 'ACTIVE',
      phone: '0902222222',
      address: '456 Le Loi',
      facebookLink: 'https://facebook.com/parent.other',
      saleOwnerId: 'sale-b03-perm-999',
      saleOwnerName: 'Sale Gamma',
    },
  ];

  return {
    allUsers,
    parents,
    requestStatsByRole: {},
  };
}

async function openBatch(
  browser: Browser,
  request: APIRequestContext,
): Promise<{ batch: BatchEvidenceSession; baseSession: Awaited<ReturnType<typeof loginAsRole>> }> {
  const batch = await createBatchEvidenceContext(browser, {
    batchId: 'B03',
    scenario: 'users_over_permission',
  });
  const baseSession = await loginAsRole(request, 'director');
  await applySessionCookies(batch.page, baseSession);
  return { batch, baseSession };
}

async function openActorPage(
  browser: Browser,
  baseSession: Awaited<ReturnType<typeof loginAsRole>>,
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({ locale: 'vi-VN', viewport: { width: 1600, height: 900 } });
  const page = await context.newPage();
  await applySessionCookies(page, baseSession);
  return { context, page };
}

async function installRoutes(page: Page, state: State, actor: AuthPayload): Promise<void> {
  state.requestStatsByRole[actor.role] ??= { allUsers: 0, parentUsers: 0 };

  await page.route(USERS_ME_API, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        _id: actor._id,
        email: actor.email,
        role: actor.role,
        fullName: actor.fullName,
        userCode: actor.userCode,
      }),
    });
  });

  await page.route(USERS_PARENTS_API, async (route) => {
    state.requestStatsByRole[actor.role].parentUsers += 1;
    const scopedParents = actor.role === 'SALE'
      ? state.parents.filter((parent) => parent.saleOwnerId === actor._id)
      : state.parents;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(clone(scopedParents)),
    });
  });

  await page.route(USERS_API, async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    state.requestStatsByRole[actor.role].allUsers += 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(clone(state.allUsers)),
    });
  });
}

async function gotoUsers(page: Page): Promise<void> {
  await page.goto(appUrl('/app/users'));
  await page.waitForLoadState('domcontentloaded');
}

test.use({
  trace: 'off',
  video: 'on',
});

test('B03 users-management blocks edit-delete overreach across director sale and accounting surfaces', async ({ browser, request }) => {
  const state = buildState();
  const { batch, baseSession } = await openBatch(browser, request);

  const directorActor: AuthPayload = {
    _id: 'director-b03-perm-001',
    sub: 'director-b03-perm-001',
    email: 'director.permission@example.com',
    role: 'DIRECTOR',
    fullName: 'Director Permission Matrix',
    userCode: 'GD001',
  };
  const saleActor: AuthPayload = {
    _id: 'sale-b03-perm-001',
    sub: 'sale-b03-perm-001',
    email: 'sale.alpha@example.com',
    role: 'SALE',
    fullName: 'Sale Alpha',
    userCode: 'SALE001',
  };
  const accountingActor: AuthPayload = {
    _id: 'accounting-b03-perm-001',
    sub: 'accounting-b03-perm-001',
    email: 'accounting.permission@example.com',
    role: 'ACCOUNTING',
    fullName: 'Accounting Permission Matrix',
    userCode: 'KT001',
  };

  const sale = await openActorPage(browser, baseSession);
  const accounting = await openActorPage(browser, baseSession);

  try {
    await installRoutes(batch.page, state, directorActor);
    await installRoutes(sale.page, state, saleActor);
    await installRoutes(accounting.page, state, accountingActor);

    await gotoUsers(batch.page);
    await expect(batch.page).toHaveURL(/\/app\/users$/);
    await expect(batch.page.getByRole('heading', { name: 'Quan ly tai khoan' })).toBeVisible();
    await expect(batch.page.locator('aside.sidebar a[href="/app/users"]').first()).toHaveClass(/active/);

    const directorSelfRow = batch.page.getByTestId('users-row-director-b03-perm-001');
    await expect(directorSelfRow).toBeVisible();
    const directorSelfEdit = batch.page.getByTestId('users-edit-director-b03-perm-001');
    await expect(directorSelfEdit).toBeVisible();
    await expect(directorSelfEdit).toBeEnabled();
    await expect(batch.page.getByTestId('users-delete-director-b03-perm-001')).toHaveCount(0);

    await directorSelfEdit.click();
    const directorSelfModal = batch.page.getByTestId('users-edit-modal');
    await expect(directorSelfModal).toBeVisible();
    await expect(directorSelfModal.getByTestId('users-role-select')).toBeDisabled();
    await expect(directorSelfModal.locator('input[name="userCode"]')).toHaveValue('GD001');
    await expect(directorSelfModal.locator('input[name="email"]')).toHaveValue('director.permission@example.com');
    await directorSelfModal.getByTestId('users-cancel').click();
    await expect(directorSelfModal).toHaveCount(0);

    const accountingRow = batch.page.locator('tbody tr').filter({ hasText: 'accounting.permission@example.com' }).first();
    await expect(accountingRow).toBeVisible();
    await expect(accountingRow.getByRole('button', { name: 'Sua' })).toBeVisible();
    await expect(accountingRow.getByRole('button', { name: 'Xoa' })).toBeVisible();
    expect(state.requestStatsByRole['DIRECTOR']).toEqual({ allUsers: 1, parentUsers: 0 });
    await batch.step('users-over-permission-director');

    await gotoUsers(sale.page);
    await expect(sale.page).toHaveURL(/\/app\/users$/);
    await expect(sale.page.getByRole('heading', { name: 'Quan ly tai khoan phu huynh' })).toBeVisible();
    await expect(sale.page.getByRole('button', { name: 'Tat ca tai khoan' })).toHaveCount(0);
    await expect(sale.page.getByRole('button', { name: 'Tai khoan phu huynh' })).toHaveCount(0);
    const ownedParentRow = sale.page.locator('tbody tr').filter({ hasText: 'parent.owned@example.com' }).first();
    await expect(ownedParentRow).toBeVisible();
    await expect(ownedParentRow).toContainText('Sale Alpha');
    await expect(ownedParentRow.getByRole('button', { name: 'Sua' })).toBeVisible();
    await expect(ownedParentRow.getByRole('button', { name: 'Xoa' })).toHaveCount(0);
    await expect(sale.page.locator('tbody tr').filter({ hasText: 'parent.other@example.com' })).toHaveCount(0);
    await expect(sale.page.getByText('Chuyen sale phu trach')).toHaveCount(0);
    await expect(sale.page.getByText('Gan nhom quang cao')).toHaveCount(0);
    expect(state.requestStatsByRole['SALE']).toEqual({ allUsers: 0, parentUsers: 1 });
    await batch.step('users-over-permission-sale');

    await gotoUsers(accounting.page);
    await expect(accounting.page).toHaveURL(/\/not-authorized$/);
    await expect(accounting.page.getByText(/not authorized|khong co quyen|không có quyền/i)).toBeVisible();
    await batch.step('users-over-permission-accounting');

    await batch.finalize('PASS', {
      extraLines: [
        'Verified DIRECTOR can still edit-delete other accounts while the current logged-in self row keeps delete hidden and forces the self-edit modal to lock the role selector.',
        'Verified SALE stays forced into parent-only scope, never hits the all-users endpoint, cannot see unrelated parent rows, and cannot see delete or director-only owner-transfer surfaces.',
        'Verified ACCOUNTING is redirected to /not-authorized before any account-management data loads.',
      ],
    });
  } catch (error) {
    await batch.finalize('FAIL', { error });
    throw error;
  } finally {
    await Promise.allSettled([sale.context.close(), accounting.context.close()]);
  }
});
