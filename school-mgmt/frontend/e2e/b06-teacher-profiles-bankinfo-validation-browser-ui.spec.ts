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
const TEACHERS_API = new RegExp(`${API_ORIGIN_PATTERN}/teachers(?:\\?.*)?$`);
const TEACHER_PROFILE_API = new RegExp(`${API_ORIGIN_PATTERN}/teachers/([^/]+)/profile(?:\\?.*)?$`);
const TEACHER_UPDATE_API = new RegExp(`${API_ORIGIN_PATTERN}/teachers/([^/]+)(?:\\?.*)?$`);
const USERS_SALES_API = new RegExp(`${API_ORIGIN_PATTERN}/users/sales(?:\\?.*)?$`);

type TeacherLinkedUser = {
  _id: string;
  userCode?: string;
  fullName: string;
  email: string;
  phone?: string;
  role?: string;
};

type TeacherProfile = {
  _id: string;
  userId: TeacherLinkedUser;
  managedSales?: TeacherLinkedUser[];
  subjects: string[];
  grades: string[];
  teachingMode: 'ONLINE' | 'OFFLINE' | 'BOTH';
  locations: string[];
  bio?: string;
  qualifications: Array<{ title: string }>;
  yearsOfExperience: number;
  availability: Array<{ day: string; startTime: string; endTime: string }>;
  pricePerSession: number;
  pricePerHour?: number;
  status: string;
  rating: number;
  totalReviews: number;
  totalSessions: number;
  activeClasses: number;
  bankInfo?: {
    bankName: string;
    accountNumber: string;
    accountHolderName: string;
    branch?: string;
  };
};

type TeacherFullProfile = {
  profile: TeacherProfile;
  classes: {
    active: Array<{
      name: string;
      code: string;
      students: Array<{ fullName: string; studentCode: string }>;
      pricePerSession: number;
      teacherPayPerSession: number;
    }>;
    completed: any[];
    totalActive: number;
    totalCompleted: number;
  };
  sessions: {
    byStatus: Record<string, { count: number; totalPayout: number }>;
    totalCount: number;
    totalEarnings: number;
    recent: Array<{
      scheduledDate: string;
      classId: { name: string };
      studentId: { fullName: string };
      status: string;
      teacherPayout: number;
    }>;
  };
  payroll: {
    byStatus: Record<string, { count: number; totalAmount: number }>;
    totalPaid: number;
  };
};

type TeacherState = {
  teachers: TeacherProfile[];
  fullProfile: TeacherFullProfile;
  sales: TeacherLinkedUser[];
  updateCalls: Array<{ teacherId: string; payload: Record<string, unknown> }>;
};

function appUrl(path: string): string {
  return new URL(path, APP_BASE_URL).toString();
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function buildTeacherState(): TeacherState {
  const saleAlpha: TeacherLinkedUser = {
    _id: 'sale-teacher-001',
    userCode: 'SALE001',
    fullName: 'Sale Alpha',
    email: 'sale.alpha@example.com',
    phone: '0905555555',
    role: 'SALE',
  };

  const teacherUser: TeacherLinkedUser = {
    _id: 'teacher-user-001',
    userCode: 'GV001',
    fullName: 'Nguyen Thi Giao Vien',
    email: 'teacher.profile@example.com',
    phone: '0906666666',
  };

  const teacherProfile: TeacherProfile = {
    _id: 'teacher-profile-001',
    userId: teacherUser,
    managedSales: [saleAlpha],
    subjects: ['Toan', 'Tieng Anh'],
    grades: ['Lop 6', 'Lop 7'],
    teachingMode: 'BOTH',
    locations: ['Q1', 'Q3'],
    bio: 'Giao vien day ca online va offline voi kinh nghiem luyen thi.',
    qualifications: [{ title: 'Cu nhan Su pham' }],
    yearsOfExperience: 7,
    availability: [{ day: 'MONDAY', startTime: '18:00', endTime: '20:00' }],
    pricePerSession: 300000,
    pricePerHour: 180000,
    status: 'PENDING',
    rating: 4.8,
    totalReviews: 21,
    totalSessions: 42,
    activeClasses: 2,
    bankInfo: {
      bankName: 'Vietcombank',
      accountNumber: '123456789',
      accountHolderName: 'NGUYEN THI GIAO VIEN',
      branch: 'Chi nhanh Q1',
    },
  };

  return {
    teachers: [teacherProfile],
    fullProfile: {
      profile: teacherProfile,
      classes: {
        active: [
          {
            name: 'Lop Toan 7A',
            code: 'CLS-7A',
            students: [{ fullName: 'Hoc sinh A', studentCode: 'HS-A' }],
            pricePerSession: 300000,
            teacherPayPerSession: 180000,
          },
        ],
        completed: [],
        totalActive: 1,
        totalCompleted: 0,
      },
      sessions: {
        byStatus: {
          TEACHER_COMPLETED: {
            count: 3,
            totalPayout: 540000,
          },
        },
        totalCount: 3,
        totalEarnings: 540000,
        recent: [
          {
            scheduledDate: '2026-04-08T00:00:00.000Z',
            classId: { name: 'Lop Toan 7A' },
            studentId: { fullName: 'Hoc sinh A' },
            status: 'TEACHER_COMPLETED',
            teacherPayout: 180000,
          },
        ],
      },
      payroll: {
        byStatus: {
          PAID: {
            count: 2,
            totalAmount: 360000,
          },
        },
        totalPaid: 360000,
      },
    },
    sales: [saleAlpha],
    updateCalls: [],
  };
}

async function openTeacherProfilesValidation(
  browser: Browser,
  request: APIRequestContext,
  scenario: string,
  role: DemoRole,
): Promise<BatchEvidenceSession> {
  const batch = await createBatchEvidenceContext(browser, {
    batchId: 'B06',
    scenario,
  });
  const session = await loginAsRole(request, role);
  await applySessionCookies(batch.page, session);
  return batch;
}

async function installTeacherValidationRoutes(page: Page, state: TeacherState): Promise<void> {
  await page.route(TEACHERS_API, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(clone(state.teachers)),
    });
  });

  await page.route(TEACHER_PROFILE_API, async (route) => {
    const match = route.request().url().match(TEACHER_PROFILE_API);
    const teacherId = match?.[1] || '';
    if (teacherId !== state.fullProfile.profile._id) {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Teacher not found' }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(clone(state.fullProfile)),
    });
  });

  await page.route(USERS_SALES_API, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(clone(state.sales)),
    });
  });

  await page.route(TEACHER_UPDATE_API, async (route) => {
    if (route.request().method() !== 'PATCH') {
      await route.continue();
      return;
    }
    const match = route.request().url().match(TEACHER_UPDATE_API);
    state.updateCalls.push({
      teacherId: match?.[1] || '',
      payload: (route.request().postDataJSON() as Record<string, unknown>) || {},
    });
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(clone(state.fullProfile.profile)),
    });
  });
}

async function openEditModal(batch: BatchEvidenceSession): Promise<Page> {
  await batch.page.goto(appUrl('/app/teacher-profiles'));
  await batch.page.waitForLoadState('domcontentloaded');
  await expect(batch.page.locator('.teacher-card')).toHaveCount(1);
  await batch.page.locator('.teacher-card').first().click();
  await expect(batch.page).toHaveURL(/\/app\/teacher-profiles\/teacher-profile-001$/);
  await expect(batch.page.getByRole('heading', { name: 'Chi tiet giao vien' })).toBeVisible();
  await batch.page.getByRole('button', { name: 'Sua' }).click();
  await expect(batch.page.locator('.modal')).toBeVisible();
  return batch.page;
}

test.use({
  trace: 'off',
  video: 'on',
});

test('B06 director save blocks partial bankInfo and prevents any PATCH call', async ({ browser, request }) => {
  const state = buildTeacherState();
  const batch = await openTeacherProfilesValidation(browser, request, 'teacher_profiles_bankinfo_validation_director', 'director');

  try {
    await installTeacherValidationRoutes(batch.page, state);
    const page = await openEditModal(batch);
    const modal = page.locator('.modal');

    await modal.locator('input[name="bankName"]').fill('Techcombank');
    await modal.locator('input[name="accountNumber"]').fill('');
    await modal.locator('input[name="accountHolderName"]').fill('');

    await modal.getByRole('button', { name: 'Luu thay doi' }).click();
    await expect(modal.locator('.error')).toHaveText('Vui long nhap day du ten ngan hang, so tai khoan va chu tai khoan.');
    await expect(modal.getByRole('button', { name: 'Luu thay doi' })).toBeVisible();
    await expect(modal).toBeVisible();
    expect(state.updateCalls).toHaveLength(0);
    await expect(page.locator('.card').filter({ hasText: 'Thong tin ngan hang' })).toContainText('Vietcombank');
    await batch.step('teacher-profiles-bankinfo-validation-director');

    await batch.finalize('PASS', {
      extraLines: [
        'Verified DIRECTOR cannot submit partial bankInfo when only bank name is filled.',
        'Verified the exact validation message is shown and no PATCH request is sent.',
      ],
    });
  } catch (error) {
    await batch.finalize('FAIL', { error });
    throw error;
  }
});

test('B06 accounting save blocks partial bankInfo and prevents any PATCH call', async ({ browser, request }) => {
  const state = buildTeacherState();
  const batch = await openTeacherProfilesValidation(browser, request, 'teacher_profiles_bankinfo_validation_accounting', 'accounting');

  try {
    await installTeacherValidationRoutes(batch.page, state);
    const page = await openEditModal(batch);
    const modal = page.locator('.modal');

    await expect(modal.locator('input[name="password"]')).toHaveCount(0);
    await expect(modal.getByRole('button', { name: '+ Them sale' })).toHaveCount(0);
    await modal.locator('input[name="bankName"]').fill('');
    await modal.locator('input[name="accountNumber"]').fill('888777666');
    await modal.locator('input[name="accountHolderName"]').fill('NGUYEN THI ACCOUNTING');

    await modal.getByRole('button', { name: 'Luu thay doi' }).click();
    await expect(modal.locator('.error')).toHaveText('Vui long nhap day du ten ngan hang, so tai khoan va chu tai khoan.');
    await expect(modal.getByRole('button', { name: 'Luu thay doi' })).toBeVisible();
    await expect(modal).toBeVisible();
    expect(state.updateCalls).toHaveLength(0);
    await expect(page.locator('.card').filter({ hasText: 'Thong tin ngan hang' })).toContainText('Vietcombank');
    await batch.step('teacher-profiles-bankinfo-validation-accounting');

    await batch.finalize('PASS', {
      extraLines: [
        'Verified ACCOUNTING cannot submit partial bankInfo when the bank name is missing.',
        'Verified the exact validation message is shown and no PATCH request is sent.',
      ],
    });
  } catch (error) {
    await batch.finalize('FAIL', { error });
    throw error;
  }
});
