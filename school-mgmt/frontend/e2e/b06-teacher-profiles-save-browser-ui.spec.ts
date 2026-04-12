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

type TeacherUpdatePayload = {
  user?: {
    fullName?: string;
    email?: string;
    phone?: string;
    password?: string;
  };
  managedSales?: string[];
  subjects?: string[];
  grades?: string[];
  teachingMode?: 'ONLINE' | 'OFFLINE' | 'BOTH';
  locations?: string[];
  bio?: string;
  yearsOfExperience?: number;
  pricePerSession?: number;
  pricePerHour?: number;
  bankInfo?: {
    bankName: string;
    accountNumber: string;
    accountHolderName: string;
    branch?: string;
  };
};

type TeacherState = {
  teachers: TeacherProfile[];
  fullProfile: TeacherFullProfile;
  sales: TeacherLinkedUser[];
  updateCalls: Array<{ teacherId: string; payload: TeacherUpdatePayload }>;
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
  const saleBravo: TeacherLinkedUser = {
    _id: 'sale-teacher-002',
    userCode: 'SALE002',
    fullName: 'Sale Bravo',
    email: 'sale.bravo@example.com',
    phone: '0904444444',
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
    sales: [saleAlpha, saleBravo],
    updateCalls: [],
  };
}

function salesByIds(state: TeacherState, ids: string[] | undefined): TeacherLinkedUser[] {
  if (!ids?.length) {
    return [];
  }
  return ids
    .map((id) => state.sales.find((sale) => sale._id === id))
    .filter((item): item is TeacherLinkedUser => !!item);
}

function applyTeacherUpdate(state: TeacherState, payload: TeacherUpdatePayload): void {
  const current = state.fullProfile.profile;
  const nextProfile: TeacherProfile = {
    ...current,
    userId: {
      ...current.userId,
      fullName: payload.user?.fullName ?? current.userId.fullName,
      email: payload.user?.email ?? current.userId.email,
      phone: payload.user?.phone ?? current.userId.phone,
    },
    managedSales: payload.managedSales ? salesByIds(state, payload.managedSales) : current.managedSales,
    subjects: payload.subjects ?? current.subjects,
    grades: payload.grades ?? current.grades,
    teachingMode: payload.teachingMode ?? current.teachingMode,
    locations: payload.locations ?? current.locations,
    bio: payload.bio ?? current.bio,
    yearsOfExperience: payload.yearsOfExperience ?? current.yearsOfExperience,
    pricePerSession: payload.pricePerSession ?? current.pricePerSession,
    pricePerHour: payload.pricePerHour ?? current.pricePerHour,
    bankInfo: payload.bankInfo ?? current.bankInfo,
  };

  state.fullProfile.profile = nextProfile;
  state.teachers = state.teachers.map((teacher) =>
    teacher._id === nextProfile._id
      ? {
          ...teacher,
          userId: clone(nextProfile.userId),
          managedSales: clone(nextProfile.managedSales || []),
          subjects: clone(nextProfile.subjects),
          grades: clone(nextProfile.grades),
          teachingMode: nextProfile.teachingMode,
          locations: clone(nextProfile.locations),
          bio: nextProfile.bio,
          yearsOfExperience: nextProfile.yearsOfExperience,
          pricePerSession: nextProfile.pricePerSession,
          pricePerHour: nextProfile.pricePerHour,
          bankInfo: nextProfile.bankInfo ? clone(nextProfile.bankInfo) : undefined,
        }
      : teacher,
  );
}

async function openTeacherProfilesSave(
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

async function installTeacherSaveRoutes(page: Page, state: TeacherState): Promise<void> {
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
    const teacherId = match?.[1] || '';
    if (teacherId !== state.fullProfile.profile._id) {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Teacher not found' }),
      });
      return;
    }
    const payload = route.request().postDataJSON() as TeacherUpdatePayload;
    state.updateCalls.push({
      teacherId,
      payload: clone(payload),
    });
    applyTeacherUpdate(state, payload);
    await page.waitForTimeout(350);
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

test('B06 director save keeps password bankInfo and managedSales in the exact update payload', async ({ browser, request }) => {
  const state = buildTeacherState();
  const batch = await openTeacherProfilesSave(browser, request, 'teacher_profiles_save_director', 'director');

  try {
    await installTeacherSaveRoutes(batch.page, state);
    const page = await openEditModal(batch);
    const modal = page.locator('.modal');

    await modal.locator('input[name="fullName"]').fill('Nguyen Thi Giao Vien Cap Nhat');
    await modal.locator('input[name="email"]').fill('teacher.updated@example.com');
    await modal.locator('input[name="phone"]').fill('0907777777');
    await modal.locator('input[name="password"]').fill('DirectorNew123!');
    await modal.locator('input[name="subjects"]').fill('Toan, Van');
    await modal.locator('input[name="grades"]').fill('Lop 8, Lop 9');
    await modal.locator('select[name="teachingMode"]').selectOption('ONLINE');
    await modal.locator('input[name="locations"]').fill('Q7, Thu Duc');
    await modal.locator('textarea[name="bio"]').fill('Cap nhat bio cho DIRECTOR save flow.');
    await modal.locator('input[name="yearsOfExperience"]').fill('9');
    await modal.locator('input[name="pricePerSession"]').fill('350000');
    await modal.locator('input[name="pricePerHour"]').fill('210000');
    await modal.locator('input[name="bankName"]').fill('Techcombank');
    await modal.locator('input[name="accountNumber"]').fill('987654321');
    await modal.locator('input[name="accountHolderName"]').fill('NGUYEN THI GIAO VIEN CAP NHAT');
    await modal.locator('input[name="bankBranch"]').fill('Chi nhanh Thu Duc');

    await modal.getByRole('button', { name: '+ Them sale' }).click();
    const managedSalesBlock = modal.locator('.sales-editor').filter({ hasText: 'Sale quan ly' });
    const managedSalesSelects = managedSalesBlock.getByRole('combobox');
    await expect(managedSalesSelects).toHaveCount(2);
    await managedSalesSelects.nth(0).selectOption('sale-teacher-001');
    await managedSalesSelects.nth(1).selectOption('sale-teacher-002');

    const saveButton = modal.getByRole('button', { name: 'Luu thay doi' });
    const savePromise = saveButton.click();
    await expect(modal.getByRole('button', { name: 'Dang luu...' })).toBeVisible();
    await savePromise;

    expect(state.updateCalls).toHaveLength(1);
    expect(state.updateCalls[0]).toEqual({
      teacherId: 'teacher-profile-001',
      payload: {
        user: {
          fullName: 'Nguyen Thi Giao Vien Cap Nhat',
          email: 'teacher.updated@example.com',
          phone: '0907777777',
          password: 'DirectorNew123!',
        },
        subjects: ['Toan', 'Van'],
        grades: ['Lop 8', 'Lop 9'],
        teachingMode: 'ONLINE',
        locations: ['Q7', 'Thu Duc'],
        bio: 'Cap nhat bio cho DIRECTOR save flow.',
        yearsOfExperience: 9,
        pricePerSession: 350000,
        pricePerHour: 210000,
        bankInfo: {
          bankName: 'Techcombank',
          accountNumber: '987654321',
          accountHolderName: 'NGUYEN THI GIAO VIEN CAP NHAT',
          branch: 'Chi nhanh Thu Duc',
        },
        managedSales: ['sale-teacher-001', 'sale-teacher-002'],
      },
    });
    await expect(modal).toHaveCount(0);
    await expect(page.locator('.card').filter({ hasText: 'Thong tin tai khoan' })).toContainText('Nguyen Thi Giao Vien Cap Nhat');
    await expect(page.locator('.card').filter({ hasText: 'Thong tin tai khoan' })).toContainText('teacher.updated@example.com');
    await expect(page.locator('.card').filter({ hasText: 'Thong tin ngan hang' })).toContainText('Techcombank');
    await expect(page.locator('.card').filter({ hasText: 'Thong tin tai khoan' })).toContainText('Sale quan ly 2: Sale Bravo');
    await batch.step('teacher-profiles-save-director');

    await batch.finalize('PASS', {
      extraLines: [
        'Verified DIRECTOR save sends password, bankInfo, and managedSales in the exact PATCH payload.',
        'Verified teacher detail reloads with the updated name, email, bank info, and second managed sale.',
      ],
    });
  } catch (error) {
    await batch.finalize('FAIL', { error });
    throw error;
  }
});

test('B06 accounting save keeps bankInfo but omits password and managedSales from the update payload', async ({ browser, request }) => {
  const state = buildTeacherState();
  const batch = await openTeacherProfilesSave(browser, request, 'teacher_profiles_save_accounting', 'accounting');

  try {
    await installTeacherSaveRoutes(batch.page, state);
    const page = await openEditModal(batch);
    const modal = page.locator('.modal');

    await expect(modal.locator('input[name="password"]')).toHaveCount(0);
    await expect(modal.getByRole('button', { name: '+ Them sale' })).toHaveCount(0);
    await expect(modal.locator('.sales-editor').filter({ hasText: 'Thong tin ngan hang' })).toBeVisible();

    await modal.locator('input[name="fullName"]').fill('Nguyen Thi Giao Vien Accounting');
    await modal.locator('input[name="email"]').fill('teacher.accounting@example.com');
    await modal.locator('input[name="phone"]').fill('0908888888');
    await modal.locator('input[name="subjects"]').fill('Tieng Anh, Van');
    await modal.locator('input[name="grades"]').fill('Lop 9');
    await modal.locator('select[name="teachingMode"]').selectOption('OFFLINE');
    await modal.locator('input[name="locations"]').fill('Q10');
    await modal.locator('textarea[name="bio"]').fill('Cap nhat bio cho ACCOUNTING save flow.');
    await modal.locator('input[name="yearsOfExperience"]').fill('8');
    await modal.locator('input[name="pricePerSession"]').fill('330000');
    await modal.locator('input[name="pricePerHour"]').fill('190000');
    await modal.locator('input[name="bankName"]').fill('ACB');
    await modal.locator('input[name="accountNumber"]').fill('555666777');
    await modal.locator('input[name="accountHolderName"]').fill('NGUYEN THI GV ACCOUNTING');
    await modal.locator('input[name="bankBranch"]').fill('Chi nhanh Quan 10');

    const saveButton = modal.getByRole('button', { name: 'Luu thay doi' });
    const savePromise = saveButton.click();
    await expect(modal.getByRole('button', { name: 'Dang luu...' })).toBeVisible();
    await savePromise;

    expect(state.updateCalls).toHaveLength(1);
    expect(state.updateCalls[0]).toEqual({
      teacherId: 'teacher-profile-001',
      payload: {
        user: {
          fullName: 'Nguyen Thi Giao Vien Accounting',
          email: 'teacher.accounting@example.com',
          phone: '0908888888',
        },
        subjects: ['Tieng Anh', 'Van'],
        grades: ['Lop 9'],
        teachingMode: 'OFFLINE',
        locations: ['Q10'],
        bio: 'Cap nhat bio cho ACCOUNTING save flow.',
        yearsOfExperience: 8,
        pricePerSession: 330000,
        pricePerHour: 190000,
        bankInfo: {
          bankName: 'ACB',
          accountNumber: '555666777',
          accountHolderName: 'NGUYEN THI GV ACCOUNTING',
          branch: 'Chi nhanh Quan 10',
        },
      },
    });
    expect(state.updateCalls[0].payload.user).not.toHaveProperty('password');
    expect(state.updateCalls[0].payload).not.toHaveProperty('managedSales');
    await expect(modal).toHaveCount(0);
    await expect(page.locator('.card').filter({ hasText: 'Thong tin tai khoan' })).toContainText('Nguyen Thi Giao Vien Accounting');
    await expect(page.locator('.card').filter({ hasText: 'Thong tin ngan hang' })).toContainText('ACB');
    await batch.step('teacher-profiles-save-accounting');

    await batch.finalize('PASS', {
      extraLines: [
        'Verified ACCOUNTING save keeps bankInfo and core teaching fields in the exact PATCH payload.',
        'Verified the PATCH payload omits director-only password and managedSales fields.',
      ],
    });
  } catch (error) {
    await batch.finalize('FAIL', { error });
    throw error;
  }
});

test('B06 sale save keeps non-finance edits but omits bankInfo and managedSales from the update payload', async ({ browser, request }) => {
  const state = buildTeacherState();
  const batch = await openTeacherProfilesSave(browser, request, 'teacher_profiles_save_sale', 'sale');

  try {
    await installTeacherSaveRoutes(batch.page, state);
    const page = await openEditModal(batch);
    const modal = page.locator('.modal');

    await expect(modal.locator('input[name="password"]')).toHaveCount(0);
    await expect(modal.locator('input[name="bankName"]')).toHaveCount(0);
    await expect(modal.getByRole('button', { name: '+ Them sale' })).toHaveCount(0);

    await modal.locator('input[name="fullName"]').fill('Nguyen Thi Giao Vien Sale');
    await modal.locator('input[name="email"]').fill('teacher.sale@example.com');
    await modal.locator('input[name="phone"]').fill('0909999999');
    await modal.locator('input[name="subjects"]').fill('Tieng Anh');
    await modal.locator('input[name="grades"]').fill('Lop 10');
    await modal.locator('select[name="teachingMode"]').selectOption('ONLINE');
    await modal.locator('input[name="locations"]').fill('Binh Thanh');
    await modal.locator('textarea[name="bio"]').fill('Cap nhat bio cho SALE save flow.');
    await modal.locator('input[name="yearsOfExperience"]').fill('10');
    await modal.locator('input[name="pricePerSession"]').fill('370000');
    await modal.locator('input[name="pricePerHour"]').fill('220000');

    const saveButton = modal.getByRole('button', { name: 'Luu thay doi' });
    const savePromise = saveButton.click();
    await expect(modal.getByRole('button', { name: 'Dang luu...' })).toBeVisible();
    await savePromise;

    expect(state.updateCalls).toHaveLength(1);
    expect(state.updateCalls[0]).toEqual({
      teacherId: 'teacher-profile-001',
      payload: {
        user: {
          fullName: 'Nguyen Thi Giao Vien Sale',
          email: 'teacher.sale@example.com',
          phone: '0909999999',
        },
        subjects: ['Tieng Anh'],
        grades: ['Lop 10'],
        teachingMode: 'ONLINE',
        locations: ['Binh Thanh'],
        bio: 'Cap nhat bio cho SALE save flow.',
        yearsOfExperience: 10,
        pricePerSession: 370000,
        pricePerHour: 220000,
      },
    });
    expect(state.updateCalls[0].payload).not.toHaveProperty('bankInfo');
    expect(state.updateCalls[0].payload).not.toHaveProperty('managedSales');
    await expect(modal).toHaveCount(0);
    await expect(page.locator('.card').filter({ hasText: 'Thong tin tai khoan' })).toContainText('Nguyen Thi Giao Vien Sale');
    await expect(page.locator('.card').filter({ hasText: 'Thong tin ngan hang' })).toHaveCount(0);
    await batch.step('teacher-profiles-save-sale');

    await batch.finalize('PASS', {
      extraLines: [
        'Verified SALE save keeps non-finance edits in the exact PATCH payload.',
        'Verified the PATCH payload omits bankInfo and managedSales while finance surfaces remain masked after reload.',
      ],
    });
  } catch (error) {
    await batch.finalize('FAIL', { error });
    throw error;
  }
});
