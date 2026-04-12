import { expect, test, type APIRequestContext, type Browser } from '@playwright/test';
import { applySessionCookies, createBatchEvidenceContext, loginAsRole, type BatchEvidenceSession } from './support';

const APP_BASE_URL =
  process.env['PLAYWRIGHT_BASE_URL']
  || process.env['E2E_BASE_URL']
  || 'http://localhost:4200';

const API_ORIGIN_PATTERN = 'https?://(?:localhost|127\\.0\\.0\\.1):3000';
const USERS_ME_API = new RegExp(`${API_ORIGIN_PATTERN}/users/me(?:\\?.*)?$`);
const USERS_API = new RegExp(`${API_ORIGIN_PATTERN}/users(?:\\?.*)?$`);
const USER_UPDATE_API = new RegExp(`${API_ORIGIN_PATTERN}/users/([^/]+)(?:\\?.*)?$`);

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
};

type State = {
  allUsers: UserItem[];
  updateCalls: Array<{ userId: string; payload: Record<string, unknown> }>;
};

function appUrl(path: string): string {
  return new URL(path, APP_BASE_URL).toString();
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function buildState(): State {
  return {
    allUsers: [
      {
        _id: 'director-b03-self-001',
        userCode: 'GDSELF001',
        email: 'director.self@example.com',
        fullName: 'Director Self Original',
        role: 'DIRECTOR',
        status: 'ACTIVE',
        phone: '0901111222',
      },
      {
        _id: 'accounting-b03-self-001',
        userCode: 'KTSELF001',
        email: 'accounting.self@example.com',
        fullName: 'Accounting Viewer',
        role: 'ACCOUNTING',
        status: 'ACTIVE',
        phone: '0903333444',
      },
    ],
    updateCalls: [],
  };
}

async function openBatch(
  browser: Browser,
  request: APIRequestContext,
): Promise<{ batch: BatchEvidenceSession; actor: AuthPayload }> {
  const batch = await createBatchEvidenceContext(browser, {
    batchId: 'B03',
    scenario: 'users_self_edit_browser',
  });
  const session = await loginAsRole(request, 'director');
  await applySessionCookies(batch.page, session);

  return {
    batch,
    actor: {
      _id: 'director-b03-self-001',
      sub: 'director-b03-self-001',
      email: 'director.self@example.com',
      role: 'DIRECTOR',
      fullName: 'Director Self Original',
      userCode: 'GDSELF001',
    },
  };
}

async function installRoutes(
  batch: BatchEvidenceSession,
  state: State,
  actor: AuthPayload,
): Promise<void> {
  await batch.page.route(USERS_ME_API, async (route) => {
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

  await batch.page.route(USERS_API, async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(clone(state.allUsers)),
    });
  });

  await batch.page.route(USER_UPDATE_API, async (route) => {
    if (route.request().method() !== 'PATCH') {
      await route.fallback();
      return;
    }

    const match = route.request().url().match(USER_UPDATE_API);
    const userId = match?.[1] || '';
    const payload = route.request().postDataJSON() as Record<string, unknown>;
    state.updateCalls.push({ userId, payload: clone(payload) });

    const existing = state.allUsers.find((user) => user._id === userId);
    if (!existing) {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Khong tim thay nguoi dung' }),
      });
      return;
    }

    const updatedUser: UserItem = {
      ...existing,
      userCode: typeof payload['userCode'] === 'string' ? payload['userCode'] : existing.userCode,
      email: typeof payload['email'] === 'string' ? payload['email'] : existing.email,
      fullName: typeof payload['fullName'] === 'string' ? payload['fullName'] : existing.fullName,
      phone: typeof payload['phone'] === 'string' ? payload['phone'] : existing.phone,
    };
    state.allUsers = state.allUsers.map((user) => user._id === userId ? updatedUser : user);

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(clone(updatedUser)),
    });
  });
}

test.use({
  trace: 'off',
  video: 'on',
});

test('B03 users-management self-edit updates basic fields without mutating role or status', async ({ browser, request }) => {
  const state = buildState();
  const { batch, actor } = await openBatch(browser, request);

  try {
    await installRoutes(batch, state, actor);

    const page = batch.page;
    await page.goto(appUrl('/app/users'));
    await page.waitForLoadState('domcontentloaded');

    const selfRow = page.getByTestId(`users-row-${actor._id}`);
    await expect(selfRow).toBeVisible();
    await expect(selfRow).toContainText('Director Self Original');
    await expect(selfRow).toContainText('Giam doc');
    await expect(selfRow).toContainText('ACTIVE');
    await expect(page.getByTestId(`users-edit-${actor._id}`)).toBeVisible();
    await expect(page.getByTestId(`users-delete-${actor._id}`)).toHaveCount(0);

    await page.getByTestId(`users-edit-${actor._id}`).click();
    const modal = page.getByTestId('users-edit-modal');
    await expect(modal).toBeVisible();
    await expect(modal.locator('input[name="userCode"]')).toHaveValue('GDSELF001');
    await expect(modal.locator('input[name="email"]')).toHaveValue('director.self@example.com');
    await expect(modal.locator('input[name="fullName"]')).toHaveValue('Director Self Original');
    await expect(modal.locator('input[name="phone"]')).toHaveValue('0901111222');
    await expect(modal.getByTestId('users-role-select')).toBeDisabled();
    await expect(modal.getByTestId('users-role-select')).toHaveValue('DIRECTOR');

    await modal.locator('input[name="fullName"]').fill('Director Self Updated');
    await modal.locator('input[name="phone"]').fill('0909999888');
    await modal.getByTestId('users-submit').click();

    await expect.poll(() => state.updateCalls.length).toBe(1);
    expect(state.updateCalls[0]).toEqual({
      userId: actor._id,
      payload: {
        userCode: 'GDSELF001',
        email: 'director.self@example.com',
        phone: '0909999888',
        fullName: 'Director Self Updated',
      },
    });
    await expect(modal).toHaveCount(0);
    await batch.step('self-edit-submit-safe-payload');

    const updatedRow = page.getByTestId(`users-row-${actor._id}`);
    await expect(updatedRow).toContainText('Director Self Updated');
    await expect(updatedRow).toContainText('Giam doc');
    await expect(updatedRow).toContainText('ACTIVE');
    await expect(page.getByTestId(`users-delete-${actor._id}`)).toHaveCount(0);

    await page.getByTestId(`users-edit-${actor._id}`).click();
    await expect(modal).toBeVisible();
    await expect(modal.locator('input[name="fullName"]')).toHaveValue('Director Self Updated');
    await expect(modal.locator('input[name="phone"]')).toHaveValue('0909999888');
    await expect(modal.getByTestId('users-role-select')).toBeDisabled();
    await expect(modal.getByTestId('users-cancel')).toBeVisible();
    await batch.step('self-edit-reload-stable-state');

    await batch.finalize('PASS', {
      extraLines: [
        'Verified the current logged-in account can open the self-edit modal from users-management without exposing delete on the self row.',
        'Verified the self-edit PATCH payload updates only basic fields and never includes role mutation, while the role selector stays disabled in the modal.',
        'Verified reload keeps the updated basic data while preserving the account role DIRECTOR and status ACTIVE without abnormal state changes.',
      ],
    });
  } catch (error) {
    await batch.finalize('FAIL', { error });
    throw error;
  }
});
