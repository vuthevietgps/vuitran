import { expect, test, type APIRequestContext, type Browser, type Page } from '@playwright/test';
import { applySessionCookies, createBatchEvidenceContext, loginAsRole, type BatchEvidenceSession, type DemoRole } from './support';

const APP_BASE_URL =
  process.env['PLAYWRIGHT_BASE_URL'] ||
  process.env['E2E_BASE_URL'] ||
  'http://localhost:4200';

const API_ORIGIN_PATTERN = 'https?://(?:localhost|127\\.0\\.0\\.1):3000';
const TEACHERS_API = new RegExp(`${API_ORIGIN_PATTERN}/teachers(?:\\?.*)?$`);
const TEACHER_PROFILE_API = new RegExp(`${API_ORIGIN_PATTERN}/teachers/([^/]+)/profile(?:\\?.*)?$`);
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
};

type RoleExpectation = {
  approveVisible: boolean;
  detailSaleSubtextVisible: boolean;
  financeVisible: boolean;
  passwordVisible: boolean;
  managedSalesEditorVisible: boolean;
};

function appUrl(path: string): string {
  return new URL(path, APP_BASE_URL).toString();
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function buildTeacherState(): TeacherState {
  const managedSale: TeacherLinkedUser = {
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
    managedSales: [managedSale],
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
    sales: [managedSale],
  };
}

async function openTeacherProfilesMatrix(
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

async function installTeacherProfileRoutes(page: Page, state: TeacherState): Promise<void> {
  await page.route(TEACHERS_API, async (route) => {
    await page.waitForTimeout(200);
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

    await page.waitForTimeout(250);
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
}

async function assertTeacherRoleView(
  batch: BatchEvidenceSession,
  state: TeacherState,
  role: DemoRole,
  expectation: RoleExpectation,
): Promise<void> {
  await batch.page.goto(appUrl('/app/teacher-profiles'));
  await batch.page.waitForLoadState('domcontentloaded');

  await expect(batch.page).toHaveURL(/\/app\/teacher-profiles$/);
  await expect(batch.page.getByText('Dang tai danh sach giao vien...')).toBeVisible();
  const teacherCard = batch.page.locator('.teacher-card').filter({ hasText: state.fullProfile.profile.userId.fullName }).first();
  await expect(teacherCard).toBeVisible();
  await expect(teacherCard).toContainText('GV001');
  await expect(teacherCard).toContainText('teacher.profile@example.com');
  await expect(teacherCard.locator('.badge[data-status="PENDING"]')).toHaveText('Cho duyet');
  await expect(teacherCard.locator('.manager-chip')).toHaveText('Sale Alpha');
  await batch.step(`teacher-profiles-list-${role}`);

  await teacherCard.click();
  await expect(batch.page).toHaveURL(new RegExp(`/app/teacher-profiles/${state.fullProfile.profile._id}$`));
  await expect(batch.page.getByText('Dang tai ho so...')).toBeVisible();
  await expect(batch.page.getByRole('heading', { name: 'Chi tiet giao vien' })).toBeVisible();
  await expect(batch.page.locator('.card').filter({ hasText: 'Thong tin tai khoan' })).toContainText('Nguyen Thi Giao Vien');
  await expect(batch.page.locator('.card').filter({ hasText: 'Thong tin giang day' })).toContainText('Toan');
  await expect(batch.page.locator('.card').filter({ hasText: 'Thong tin giang day' })).toContainText('Tieng Anh');
  const activeClassesTable = batch.page.locator('section.card.wide').filter({ hasText: 'Lop dang day' }).locator('.data-table');
  const recentSessionsTable = batch.page.locator('section.card.wide').filter({ hasText: 'Buoi day gan day' }).locator('.data-table');

  const approveButton = batch.page.getByRole('button', { name: 'Duyet' });
  if (expectation.approveVisible) {
    await expect(approveButton).toBeVisible();
  } else {
    await expect(approveButton).toHaveCount(0);
  }

  const detailSubtext = batch.page.getByText('Sale chi thay lop, hoc sinh va buoi hoc thuoc sale cua minh.');
  if (expectation.detailSaleSubtextVisible) {
    await expect(detailSubtext).toBeVisible();
  } else {
    await expect(detailSubtext).toHaveCount(0);
  }

  if (expectation.financeVisible) {
    await expect(batch.page.locator('.stat-card').filter({ hasText: 'Tong thu nhap' })).toContainText('360,000d');
    await expect(batch.page.locator('.card').filter({ hasText: 'Thong tin ngan hang' })).toContainText('Vietcombank');
    await expect(activeClassesTable).toContainText('Luong GV/buoi');
    await expect(activeClassesTable).toContainText('180,000d');
    await expect(recentSessionsTable).toContainText('Luong');
    await expect(recentSessionsTable).toContainText('180,000d');
  } else {
    await expect(batch.page.locator('.stat-card').filter({ hasText: 'Tong thu nhap' })).toHaveCount(0);
    await expect(batch.page.locator('.card').filter({ hasText: 'Thong tin ngan hang' })).toHaveCount(0);
    await expect(activeClassesTable.locator('th', { hasText: 'Luong GV/buoi' })).toHaveCount(0);
    await expect(recentSessionsTable.locator('th', { hasText: 'Luong' })).toHaveCount(0);
  }
  await batch.step(`teacher-profiles-detail-${role}`);

  await batch.page.getByRole('button', { name: 'Sua' }).click();
  const modal = batch.page.locator('.modal');
  await expect(modal).toBeVisible();
  await expect(modal.getByRole('heading', { name: 'Sua ho so giao vien' })).toBeVisible();
  await expect(modal.locator('input[name="fullName"]')).toHaveValue('Nguyen Thi Giao Vien');
  await expect(modal.locator('input[name="email"]')).toHaveValue('teacher.profile@example.com');
  await expect(modal.locator('input[name="pricePerSession"]')).toHaveValue('300000');
  await expect(modal.locator('input[name="pricePerHour"]')).toHaveValue('180000');

  if (expectation.passwordVisible) {
    await expect(modal.locator('input[name="password"]')).toBeVisible();
  } else {
    await expect(modal.locator('input[name="password"]')).toHaveCount(0);
  }

  const managedSalesBlock = modal.locator('.sales-editor').filter({ hasText: 'Sale quan ly' });
  if (expectation.managedSalesEditorVisible) {
    await expect(managedSalesBlock).toBeVisible();
    await expect(modal.getByRole('button', { name: '+ Them sale' })).toBeVisible();
    const managedSalesSelect = managedSalesBlock.getByRole('combobox');
    await expect(managedSalesSelect).toBeVisible();
    await expect(managedSalesSelect.locator('option', { hasText: 'Sale Alpha (SALE001)' })).toHaveCount(1);
    await expect(managedSalesSelect).toHaveValue('sale-teacher-001');
  } else {
    await expect(modal.getByRole('button', { name: '+ Them sale' })).toHaveCount(0);
    await expect(managedSalesBlock.getByRole('combobox')).toHaveCount(0);
  }

  const financeEditor = modal.locator('.sales-editor').filter({ hasText: 'Thong tin ngan hang' });
  if (expectation.financeVisible) {
    await expect(financeEditor).toBeVisible();
    await expect(modal.locator('input[name="bankName"]')).toHaveValue('Vietcombank');
    await expect(modal.locator('input[name="accountNumber"]')).toHaveValue('123456789');
    await expect(modal.locator('input[name="accountHolderName"]')).toHaveValue('NGUYEN THI GIAO VIEN');
  } else {
    await expect(financeEditor).toHaveCount(0);
    await expect(modal.locator('input[name="bankName"]')).toHaveCount(0);
  }

  await batch.step(`teacher-profiles-edit-${role}`);
  await modal.getByRole('button', { name: 'Dong' }).click();
  await expect(modal).toHaveCount(0);
}

test.use({
  trace: 'off',
  video: 'on',
});

test('B06 teacher profiles permission matrix for DIRECTOR keeps approve, finance, and managed-sales editing', async ({ browser, request }) => {
  const state = buildTeacherState();
  const batch = await openTeacherProfilesMatrix(
    browser,
    request,
    'teacher_profiles_permission_director',
    'director',
  );

  try {
    await installTeacherProfileRoutes(batch.page, state);

    await assertTeacherRoleView(batch, state, 'director', {
      approveVisible: true,
      detailSaleSubtextVisible: false,
      financeVisible: true,
      passwordVisible: true,
      managedSalesEditorVisible: true,
    });

    await batch.finalize('PASS', {
      extraLines: [
        'Verified DIRECTOR sees teacher list/detail, approve button, finance cards, password field, and managed-sales editor.',
      ],
    });
  } catch (error) {
    await batch.finalize('FAIL', { error });
    throw error;
  }
});

test('B06 teacher profiles permission matrix for ACCOUNTING keeps finance but hides approve and director-only controls', async ({ browser, request }) => {
  const state = buildTeacherState();
  const batch = await openTeacherProfilesMatrix(
    browser,
    request,
    'teacher_profiles_permission_accounting',
    'accounting',
  );

  try {
    await installTeacherProfileRoutes(batch.page, state);

    await assertTeacherRoleView(batch, state, 'accounting', {
      approveVisible: false,
      detailSaleSubtextVisible: false,
      financeVisible: true,
      passwordVisible: false,
      managedSalesEditorVisible: false,
    });

    await batch.finalize('PASS', {
      extraLines: [
        'Verified ACCOUNTING keeps teacher profile finance visibility but does not get approve, password, or managed-sales controls.',
      ],
    });
  } catch (error) {
    await batch.finalize('FAIL', { error });
    throw error;
  }
});

test('B06 teacher profiles permission matrix for SALE keeps detail access while finance stays masked', async ({ browser, request }) => {
  const state = buildTeacherState();
  const batch = await openTeacherProfilesMatrix(
    browser,
    request,
    'teacher_profiles_permission_sale',
    'sale',
  );

  try {
    await installTeacherProfileRoutes(batch.page, state);

    await assertTeacherRoleView(batch, state, 'sale', {
      approveVisible: false,
      detailSaleSubtextVisible: true,
      financeVisible: false,
      passwordVisible: false,
      managedSalesEditorVisible: false,
    });

    await batch.finalize('PASS', {
      extraLines: [
        'Verified SALE keeps teacher list/detail and edit access while finance cards, bank info, and director-only controls stay hidden.',
      ],
    });
  } catch (error) {
    await batch.finalize('FAIL', { error });
    throw error;
  }
});
