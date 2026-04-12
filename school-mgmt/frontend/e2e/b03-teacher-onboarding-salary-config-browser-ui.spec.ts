import { expect, test, type APIRequestContext, type Browser } from '@playwright/test';
import {
  applySessionCookies,
  createBatchEvidenceContext,
  loginAsRole,
  type BatchEvidenceSession,
} from './support';

const APP_BASE_URL =
  process.env['PLAYWRIGHT_BASE_URL']
  || process.env['E2E_BASE_URL']
  || 'http://localhost:4200';

const API_ORIGIN_PATTERN = 'https?://(?:localhost|127\\.0\\.0\\.1):3000';
const USERS_API = new RegExp(`${API_ORIGIN_PATTERN}/users(?:\\?.*)?$`);
const USERS_SALES_API = new RegExp(`${API_ORIGIN_PATTERN}/users/sales(?:\\?.*)?$`);
const SALARY_CONFIG_API = new RegExp(`${API_ORIGIN_PATTERN}/salary-config(?:\\?.*)?$`);
const SALARY_CONFIG_USER_OPTIONS_API = new RegExp(`${API_ORIGIN_PATTERN}/salary-config/users/options(?:\\?.*)?$`);

type TeacherSalaryConfigPayload = {
  baseSalary: number;
  standardHours: number;
  scheduledStartTime: string;
  latePenaltyAmount: number;
  commissionEnabled: boolean;
  commissionType: string;
  commissionTiers: Array<{
    minRevenue: number;
    maxRevenue?: number | null;
    percentage: number;
  }>;
  kpiBonusEnabled: boolean;
  kpiBonusTiers: Array<{
    minScore: number;
    maxScore?: number | null;
    bonusPercentage: number;
  }>;
  notes?: string;
};

type CreateTeacherPayload = {
  userCode: string;
  email: string;
  password: string;
  fullName: string;
  role: 'TEACHER';
  phone?: string;
  managedSales?: string[];
  salaryConfig: TeacherSalaryConfigPayload;
};

type UserListItem = {
  _id: string;
  userCode: string;
  email: string;
  fullName: string;
  role: string;
  status: string;
  phone?: string;
};

type SalaryConfigListItem = {
  _id: string;
  userId: string;
  userName: string;
  userRole: string;
  baseSalary: number;
  standardHours: number;
  scheduledStartTime: string;
  latePenaltyAmount: number;
  commissionEnabled: boolean;
  commissionType?: string;
  commissionTiers?: TeacherSalaryConfigPayload['commissionTiers'];
  kpiBonusEnabled: boolean;
  kpiBonusTiers?: TeacherSalaryConfigPayload['kpiBonusTiers'];
  status: string;
  notes?: string;
};

type UserOption = {
  _id: string;
  fullName: string;
  role: string;
  status: string;
  hasSalaryConfig: boolean;
};

type State = {
  users: UserListItem[];
  sales: UserListItem[];
  salaryConfigs: SalaryConfigListItem[];
  createCalls: CreateTeacherPayload[];
  userListCalls: number;
  salaryListCalls: number;
  salaryUserOptionCalls: number;
};

function appUrl(path: string): string {
  return new URL(path, APP_BASE_URL).toString();
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function buildState(): State {
  const saleUser: UserListItem = {
    _id: 'sale-onboard-001',
    userCode: 'SALE001',
    email: 'sale.onboard@example.com',
    fullName: 'Sale Onboard Alpha',
    role: 'SALE',
    status: 'ACTIVE',
    phone: '0900000001',
  };

  return {
    users: [
      {
        _id: 'director-onboard-001',
        userCode: 'GD001',
        email: 'director.onboard@example.com',
        fullName: 'Director Onboard',
        role: 'DIRECTOR',
        status: 'ACTIVE',
        phone: '0900000000',
      },
      saleUser,
    ],
    sales: [saleUser],
    salaryConfigs: [],
    createCalls: [],
    userListCalls: 0,
    salaryListCalls: 0,
    salaryUserOptionCalls: 0,
  };
}

function buildUserOptions(state: State): UserOption[] {
  const salaryConfiguredUserIds = new Set(state.salaryConfigs.map((config) => config.userId));
  return state.users
    .filter((user) => user.role !== 'PARENT')
    .map((user) => ({
      _id: user._id,
      fullName: user.fullName,
      role: user.role,
      status: user.status,
      hasSalaryConfig: salaryConfiguredUserIds.has(user._id),
    }));
}

async function openBatch(
  browser: Browser,
  request: APIRequestContext,
): Promise<BatchEvidenceSession> {
  const batch = await createBatchEvidenceContext(browser, {
    batchId: 'B03',
    scenario: 'teacher_onboarding_salary_config_browser',
  });
  const session = await loginAsRole(request, 'director');
  await applySessionCookies(batch.page, session);
  return batch;
}

async function installRoutes(batch: BatchEvidenceSession, state: State): Promise<void> {
  await batch.page.route(USERS_SALES_API, async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(clone(state.sales)),
    });
  });

  await batch.page.route(USERS_API, async (route) => {
    const request = route.request();

    if (request.method() === 'GET') {
      state.userListCalls += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(clone(state.users)),
      });
      return;
    }

    if (request.method() === 'POST') {
      const payload = request.postDataJSON() as CreateTeacherPayload;
      state.createCalls.push(clone(payload));

      const createdUser: UserListItem = {
        _id: `teacher-onboard-${state.createCalls.length}`,
        userCode: payload.userCode,
        email: payload.email,
        fullName: payload.fullName,
        role: payload.role,
        status: 'ACTIVE',
        phone: payload.phone,
      };

      state.users = [createdUser, ...state.users];
      state.salaryConfigs = [
        {
          _id: `salary-config-${state.createCalls.length}`,
          userId: createdUser._id,
          userName: createdUser.fullName,
          userRole: createdUser.role,
          baseSalary: payload.salaryConfig.baseSalary,
          standardHours: payload.salaryConfig.standardHours,
          scheduledStartTime: payload.salaryConfig.scheduledStartTime,
          latePenaltyAmount: payload.salaryConfig.latePenaltyAmount,
          commissionEnabled: payload.salaryConfig.commissionEnabled,
          commissionType: payload.salaryConfig.commissionType,
          commissionTiers: payload.salaryConfig.commissionTiers,
          kpiBonusEnabled: payload.salaryConfig.kpiBonusEnabled,
          kpiBonusTiers: payload.salaryConfig.kpiBonusTiers,
          status: 'ACTIVE',
          notes: payload.salaryConfig.notes,
        },
        ...state.salaryConfigs,
      ];

      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(clone(createdUser)),
      });
      return;
    }

    await route.fallback();
  });

  await batch.page.route(SALARY_CONFIG_USER_OPTIONS_API, async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }

    state.salaryUserOptionCalls += 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(clone(buildUserOptions(state))),
    });
  });

  await batch.page.route(SALARY_CONFIG_API, async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }

    state.salaryListCalls += 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: clone(state.salaryConfigs),
        meta: {
          total: state.salaryConfigs.length,
          page: 1,
          limit: 20,
          totalPages: 1,
        },
      }),
    });
  });
}

test.use({
  trace: 'off',
  video: 'on',
});

test.describe.configure({ mode: 'serial', timeout: 120_000 });

test('B03 teacher onboarding creates salary config in the same flow and surfaces it on salary config screen', async ({
  browser,
  request,
}) => {
  const state = buildState();
  const batch = await openBatch(browser, request);
  const stamp = Date.now().toString().slice(-6);
  const payload = {
    userCode: `GV${stamp}`,
    email: `teacher.${stamp}@example.com`,
    password: 'Teacher123',
    fullName: `Teacher Onboard ${stamp}`,
    phone: `0909${stamp}`,
    saleId: state.sales[0]._id,
    baseSalary: 12500000,
    standardHours: 176,
    scheduledStartTime: '08:30',
    latePenaltyAmount: 150000,
    notes: 'Luong onboarding dot 1',
  };

  try {
    await installRoutes(batch, state);

    const page = batch.page;
    await page.goto(appUrl('/app/users'));
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByTestId('users-create-button')).toBeVisible();
    await page.getByTestId('users-create-button').click();

    const modal = page.getByTestId('users-edit-modal');
    await expect(modal).toBeVisible();

    await modal.locator('input[name="userCode"]').fill(payload.userCode);
    await modal.locator('input[name="email"]').fill(payload.email);
    await modal.locator('input[name="phone"]').fill(payload.phone);
    await modal.locator('input[name="password"]').fill(payload.password);
    await modal.locator('input[name="fullName"]').fill(payload.fullName);
    await modal.getByTestId('users-role-select').selectOption('TEACHER');

    await expect(page.getByTestId('teacher-onboarding-salary-config')).toBeVisible();
    await modal.getByTestId('teacher-managed-sale-0').selectOption(payload.saleId);

    await modal.getByTestId('users-submit').click();
    await expect(modal.getByText('Vui long nhap luong cung mac dinh hop le cho giao vien')).toBeVisible();
    expect(state.createCalls).toHaveLength(0);
    await batch.step('teacher-onboarding-blocks-submit-without-base-salary');

    await modal.getByTestId('teacher-salary-base').fill(String(payload.baseSalary));
    await modal.getByTestId('teacher-salary-standard-hours').fill(String(payload.standardHours));
    await modal.getByTestId('teacher-salary-start-time').fill(payload.scheduledStartTime);
    await modal.getByTestId('teacher-salary-late-penalty').fill(String(payload.latePenaltyAmount));
    await modal.getByTestId('teacher-salary-notes').fill(payload.notes);
    await modal.getByTestId('users-submit').click();

    await expect(modal).toHaveCount(0);
    await expect.poll(() => state.createCalls.length).toBe(1);
    expect(state.createCalls[0]).toEqual({
      userCode: payload.userCode,
      email: payload.email,
      password: payload.password,
      fullName: payload.fullName,
      role: 'TEACHER',
      phone: payload.phone,
      managedSales: [payload.saleId],
      salaryConfig: {
        baseSalary: payload.baseSalary,
        standardHours: payload.standardHours,
        scheduledStartTime: payload.scheduledStartTime,
        latePenaltyAmount: payload.latePenaltyAmount,
        commissionEnabled: false,
        commissionType: 'PROGRESSIVE',
        commissionTiers: [],
        kpiBonusEnabled: false,
        kpiBonusTiers: [],
        notes: payload.notes,
      },
    });

    const createdUser = state.users.find((user) => user.userCode === payload.userCode);
    expect(createdUser).toBeTruthy();

    const createdUserRow = page.getByTestId(`users-row-${createdUser!._id}`);
    await expect(createdUserRow).toBeVisible();
    await expect(createdUserRow).toContainText(payload.userCode);
    await expect(createdUserRow).toContainText(payload.fullName);
    await expect(createdUserRow).toContainText('Giao vien');
    await batch.step('teacher-account-created-on-users-screen');

    await page.goto(appUrl('/app/salary-config'));
    await page.waitForLoadState('domcontentloaded');
    await expect.poll(() => state.salaryListCalls > 0).toBe(true);
    await expect.poll(() => state.salaryUserOptionCalls > 0).toBe(true);

    const salaryRow = page.locator('tbody tr').filter({ hasText: payload.fullName }).first();
    await expect(salaryRow).toBeVisible();
    await expect(salaryRow).toContainText('12,500,000');
    await expect(salaryRow).toContainText('176h');
    await expect(salaryRow).toContainText(payload.scheduledStartTime);
    await expect(salaryRow).toContainText('150,000');
    await expect(salaryRow).toContainText('Tắt');
    await batch.step('salary-config-visible-right-after-onboarding');

    await batch.finalize('PASS', {
      extraLines: [
        'Verified the create-teacher modal blocks submit when the onboarding salary config is missing baseSalary, while keeping the oracle strict and sending zero POST /users calls.',
        'Verified the successful teacher creation sends one exact POST /users payload that combines managedSales with the nested salaryConfig contract in the same request.',
        'Verified the linked /salary-config screen immediately shows the created teacher with exact base salary, standard hours, scheduled start time, late penalty, and both commission/KPI toggles off.',
      ],
    });
  } catch (error) {
    await batch.finalize('FAIL', { error });
    throw error;
  }
});
