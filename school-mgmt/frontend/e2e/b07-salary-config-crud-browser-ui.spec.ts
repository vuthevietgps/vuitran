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

const API_PREFIX_PATTERN = 'https?://(?:localhost|127\\.0\\.0\\.1):3000';
const SALARY_CONFIG_LIST_API = new RegExp(`${API_PREFIX_PATTERN}/salary-config(?:\\?.*)?$`);
const SALARY_CONFIG_USERS_OPTIONS_API = new RegExp(`${API_PREFIX_PATTERN}/salary-config/users/options(?:\\?.*)?$`);
const SALARY_CONFIG_TARGET_API = new RegExp(`${API_PREFIX_PATTERN}/salary-config/teacher-salary-001(?:\\?.*)?$`);

type SalaryConfig = {
  userId: string;
  userName: string;
  userRole: string;
  baseSalary: number;
  standardHours: number;
  scheduledStartTime: string;
  latePenaltyAmount: number;
  commissionEnabled: boolean;
  commissionType: string;
  commissionTiers: Array<{
    minRevenue: number;
    maxRevenue: number | null;
    percentage: number;
  }>;
  kpiBonusEnabled: boolean;
  kpiBonusTiers: Array<{
    minScore: number;
    maxScore: number | null;
    bonusPercentage: number;
  }>;
  status: string;
  notes: string;
};

type SalaryConfigUserOption = {
  _id: string;
  fullName: string;
  role: string;
  status?: string;
  hasSalaryConfig?: boolean;
};

function appUrl(path: string): string {
  return new URL(path, APP_BASE_URL).toString();
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function salaryRow(page: Page, userName: string) {
  return page.locator('table.data tbody tr').filter({ hasText: userName }).first();
}

test.use({ video: 'on' });
test.describe.configure({ mode: 'serial', timeout: 180_000 });

test('B07 salary config create update delete flow persists and reloads the manager table', async ({
  browser,
  request,
}) => {
  test.slow();

  const evidence = await createBatchEvidenceContext(browser, {
    batchId: 'B07',
    scenario: 'salary_config_crud_browser',
    runDate: RUN_DATE,
  });

  const directorSession = await loginAsRole(request, 'director');
  const baseUserOptions: SalaryConfigUserOption[] = [
    {
      _id: 'teacher-salary-001',
      fullName: 'Teacher Salary Alpha',
      role: 'TEACHER',
      status: 'ACTIVE',
    },
    {
      _id: 'sale-salary-001',
      fullName: 'Sale Salary Beta',
      role: 'SALE',
      status: 'ACTIVE',
    },
  ];

  const createPayload: SalaryConfig = {
    userId: 'teacher-salary-001',
    userName: 'Teacher Salary Alpha',
    userRole: 'TEACHER',
    baseSalary: 900,
    standardHours: 160,
    scheduledStartTime: '08:30',
    latePenaltyAmount: 25,
    commissionEnabled: false,
    commissionType: 'PROGRESSIVE',
    commissionTiers: [],
    kpiBonusEnabled: false,
    kpiBonusTiers: [],
    status: 'ACTIVE',
    notes: 'B07 salary config create',
  };

  const updatePayload: SalaryConfig = {
    ...createPayload,
    baseSalary: 980,
    standardHours: 168,
    scheduledStartTime: '09:00',
    latePenaltyAmount: 35,
    commissionType: 'PROGRESSIVE',
    commissionTiers: [],
    kpiBonusTiers: [],
    notes: 'B07 salary config updated',
  };

  let configState: SalaryConfig[] = [];
  let listGetCount = 0;
  let userOptionsGetCount = 0;
  const createBodies: unknown[] = [];
  const updateBodies: unknown[] = [];
  const deleteUrls: string[] = [];

  const userOptionsState = () =>
    baseUserOptions.map((user) => ({
      ...user,
      hasSalaryConfig: configState.some((config) => config.userId === user._id),
    }));

  try {
    await installRoutes();
    await applySessionCookies(evidence.context, directorSession);
    await evidence.page.goto(appUrl('/app/salary-config'));
    await evidence.page.waitForLoadState('networkidle');

    await expect(evidence.page).toHaveURL(/\/app\/salary-config$/);
    await expect(evidence.page.getByRole('heading', { name: 'Cấu hình lương nhân viên' })).toBeVisible();
    await expect(evidence.page.getByText('Chưa có cấu hình lương nào. Nhấn "+ Tạo cấu hình" để bắt đầu.')).toBeVisible();
    await evidence.step('salary-config-empty-state');

    await evidence.page.getByRole('button', { name: '+ Tạo cấu hình' }).click();
    const modal = evidence.page.locator('.modal.wide');
    await expect(modal).toBeVisible();
    await modal.locator('select[name="userId"]').selectOption('teacher-salary-001');
    await modal.locator('input[name="baseSalary"]').fill(String(createPayload.baseSalary));
    await modal.locator('input[name="standardHours"]').fill(String(createPayload.standardHours));
    await modal.locator('input[name="scheduledStartTime"]').fill(createPayload.scheduledStartTime);
    await modal.locator('input[name="latePenaltyAmount"]').fill(String(createPayload.latePenaltyAmount));
    await modal.locator('textarea[name="notes"]').fill(createPayload.notes);
    await evidence.step('salary-config-create-form-filled');

    await modal.getByRole('button', { name: 'Tạo' }).click();

    await expect.poll(() => createBodies.length).toBe(1);
    expect(createBodies[0]).toEqual({
      userId: createPayload.userId,
      baseSalary: createPayload.baseSalary,
      standardHours: createPayload.standardHours,
      scheduledStartTime: createPayload.scheduledStartTime,
      latePenaltyAmount: createPayload.latePenaltyAmount,
      commissionEnabled: createPayload.commissionEnabled,
      commissionType: createPayload.commissionType,
      commissionTiers: clone(createPayload.commissionTiers),
      kpiBonusEnabled: createPayload.kpiBonusEnabled,
      kpiBonusTiers: clone(createPayload.kpiBonusTiers),
      notes: createPayload.notes,
    });
    await expect.poll(() => listGetCount).toBe(2);
    await expect.poll(() => userOptionsGetCount).toBe(2);

    const createdRow = salaryRow(evidence.page, createPayload.userName);
    await expect(createdRow).toBeVisible();
    await expect(createdRow).toContainText('900đ');
    await expect(createdRow).toContainText('160h');
    await expect(createdRow).toContainText('08:30');
    await expect(createdRow).toContainText('25đ');
    await evidence.step('salary-config-created-row-visible');

    await createdRow.getByRole('button', { name: 'Sửa' }).click();
    await expect(modal).toBeVisible();
    await expect(modal.locator('input[name="baseSalary"]')).toHaveValue('900');
    await expect(modal.locator('input[name="standardHours"]')).toHaveValue('160');
    await expect(modal.locator('input[name="scheduledStartTime"]')).toHaveValue('08:30');
    await expect(modal.locator('input[name="latePenaltyAmount"]')).toHaveValue('25');
    await expect(modal.locator('input[name="commissionEnabled"]')).not.toBeChecked();
    await expect(modal.locator('input[name="kpiBonusEnabled"]')).not.toBeChecked();
    await expect(modal.locator('select[name="commissionType"]')).toHaveCount(0);
    await expect(modal.locator('input[name="cMin0"]')).toHaveCount(0);
    await expect(modal.locator('input[name="kMin0"]')).toHaveCount(0);

    await modal.locator('input[name="baseSalary"]').fill(String(updatePayload.baseSalary));
    await modal.locator('input[name="standardHours"]').fill(String(updatePayload.standardHours));
    await modal.locator('input[name="scheduledStartTime"]').fill(updatePayload.scheduledStartTime);
    await modal.locator('input[name="latePenaltyAmount"]').fill(String(updatePayload.latePenaltyAmount));
    await modal.locator('textarea[name="notes"]').fill(updatePayload.notes);
    await evidence.step('salary-config-edit-form-filled');

    await modal.getByRole('button', { name: 'Cập nhật' }).click();

    await expect.poll(() => updateBodies.length).toBe(1);
    expect(updateBodies[0]).toEqual({
      userId: updatePayload.userId,
      baseSalary: updatePayload.baseSalary,
      standardHours: updatePayload.standardHours,
      scheduledStartTime: updatePayload.scheduledStartTime,
      latePenaltyAmount: updatePayload.latePenaltyAmount,
      commissionEnabled: updatePayload.commissionEnabled,
      commissionType: updatePayload.commissionType,
      commissionTiers: clone(updatePayload.commissionTiers),
      kpiBonusEnabled: updatePayload.kpiBonusEnabled,
      kpiBonusTiers: clone(updatePayload.kpiBonusTiers),
      notes: updatePayload.notes,
    });
    await expect.poll(() => listGetCount).toBe(3);
    await expect.poll(() => userOptionsGetCount).toBe(3);

    const updatedRow = salaryRow(evidence.page, updatePayload.userName);
    await expect(updatedRow).toBeVisible();
    await expect(updatedRow).toContainText('980đ');
    await expect(updatedRow).toContainText('168h');
    await expect(updatedRow).toContainText('09:00');
    await expect(updatedRow).toContainText('35đ');
    await evidence.step('salary-config-updated-row-visible');

    evidence.page.once('dialog', async (dialog) => {
      expect(dialog.message()).toBe('Xóa cấu hình lương của "Teacher Salary Alpha"? Hành động này không thể hoàn tác.');
      await dialog.accept();
    });

    await updatedRow.getByRole('button', { name: 'Xóa' }).click();

    await expect.poll(() => deleteUrls.length).toBe(1);
    expect(deleteUrls[0]).toContain('/salary-config/teacher-salary-001');
    await expect.poll(() => listGetCount).toBe(4);
    await expect.poll(() => userOptionsGetCount).toBe(4);
    await expect(salaryRow(evidence.page, updatePayload.userName)).toHaveCount(0);
    await expect(evidence.page.getByText('Chưa có cấu hình lương nào. Nhấn "+ Tạo cấu hình" để bắt đầu.')).toBeVisible();
    await evidence.step('salary-config-deleted-row-removed');

    await evidence.finalize('PASS', {
      extraLines: [
        'Verified create sends the exact POST /salary-config payload and the manager table reloads with the new employee row.',
        'Verified edit preloads the current values, sends the exact PUT /salary-config/:userId payload, and the reloaded row reflects the updated salary, hours, shift time, and late penalty.',
        'Verified delete uses the exact confirmation string, sends DELETE /salary-config/:userId, reloads the manager table and user options, and removes the employee row cleanly.',
      ],
    });
  } catch (error) {
    await evidence.finalize('FAIL', { error });
    throw error;
  }

  async function installRoutes(): Promise<void> {
    await evidence.page.route(SALARY_CONFIG_USERS_OPTIONS_API, async (route) => {
      userOptionsGetCount += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(clone(userOptionsState())),
      });
    });

    await evidence.page.route(SALARY_CONFIG_LIST_API, async (route) => {
      const method = route.request().method();
      if (method === 'GET') {
        listGetCount += 1;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: clone(configState) }),
        });
        return;
      }

      if (method === 'POST') {
        const body = route.request().postDataJSON();
        createBodies.push(body);
        configState = [clone(createPayload)];
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify(clone(createPayload)),
        });
        return;
      }

      await route.fallback();
    });

    await evidence.page.route(SALARY_CONFIG_TARGET_API, async (route) => {
      const method = route.request().method();
      if (method === 'PUT') {
        const body = route.request().postDataJSON();
        updateBodies.push(body);
        configState = [clone(updatePayload)];
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(clone(updatePayload)),
        });
        return;
      }

      if (method === 'DELETE') {
        deleteUrls.push(route.request().url());
        configState = [];
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ok: true }),
        });
        return;
      }

      await route.fallback();
    });
  }
});
