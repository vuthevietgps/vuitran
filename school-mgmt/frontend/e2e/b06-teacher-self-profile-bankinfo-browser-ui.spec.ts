import { expect, test, type APIRequestContext, type Browser, type Page } from '@playwright/test';
import {
  applySessionCookies,
  createBatchEvidenceContext,
  loginAsRole,
  type BatchEvidenceSession,
} from './support';

const APP_BASE_URL =
  process.env['PLAYWRIGHT_BASE_URL'] ||
  process.env['E2E_BASE_URL'] ||
  'http://localhost:4200';

const API_PREFIX_PATTERN = '(?:https?://[^/]+)?(?:/api)?';
const TEACHERS_ME_API = new RegExp(`${API_PREFIX_PATTERN}/teachers/me(?:\\?.*)?$`);
const TEACHER_PROFILE_API = new RegExp(`${API_PREFIX_PATTERN}/teachers/([^/]+)/profile(?:\\?.*)?$`);
const TEACHER_UPDATE_API = new RegExp(`${API_PREFIX_PATTERN}/teachers/([^/]+)(?:\\?.*)?$`);

type TeacherLinkedUser = {
  _id: string;
  userCode?: string;
  fullName: string;
  email: string;
  phone?: string;
};

type TeacherProfile = {
  _id: string;
  userId: TeacherLinkedUser;
  subjects: string[];
  grades: string[];
  teachingMode: 'ONLINE' | 'OFFLINE' | 'BOTH';
  locations: string[];
  bio?: string;
  qualifications: Array<{ title: string; institution?: string; year?: number; imageUrl?: string }>;
  yearsOfExperience: number;
  videoIntroUrl?: string;
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
  createdAt?: string;
  updatedAt?: string;
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

type TeacherProfileUpdatePayload = {
  subjects?: string[];
  grades?: string[];
  teachingMode?: 'ONLINE' | 'OFFLINE' | 'BOTH';
  locations?: string[];
  bio?: string;
  yearsOfExperience?: number;
  videoIntroUrl?: string;
  qualifications?: Array<{ title: string; institution?: string; year?: number; imageUrl?: string }>;
  availability?: Array<{ day: string; startTime: string; endTime: string }>;
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
  myProfile: TeacherProfile;
  fullProfile: TeacherFullProfile;
  updateCalls: Array<{ teacherId: string; payload: TeacherProfileUpdatePayload }>;
};

function appUrl(path: string): string {
  return new URL(path, APP_BASE_URL).toString();
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function buildTeacherState(): TeacherState {
  const teacherUser: TeacherLinkedUser = {
    _id: 'teacher-user-self-001',
    userCode: 'GVSELF001',
    fullName: 'Nguyen Thi Teacher Self',
    email: 'teacher.self@example.com',
    phone: '0901234567',
  };

  const myProfile: TeacherProfile = {
    _id: 'teacher-self-profile-001',
    userId: teacherUser,
    subjects: ['Toan', 'Tieng Anh'],
    grades: ['Lop 6', 'Lop 7'],
    teachingMode: 'BOTH',
    locations: ['Q1', 'Q3'],
    bio: 'Giao vien tu quan ly ho so giang day va lich day online/offline.',
    qualifications: [{ title: 'Cu nhan Su pham' }],
    yearsOfExperience: 7,
    availability: [{ day: 'MONDAY', startTime: '18:00', endTime: '20:00' }],
    pricePerSession: 300000,
    pricePerHour: 180000,
    status: 'APPROVED',
    rating: 4.9,
    totalReviews: 18,
    totalSessions: 32,
    activeClasses: 2,
    bankInfo: {
      bankName: 'Vietcombank',
      accountNumber: '123456789',
      accountHolderName: 'NGUYEN THI TEACHER SELF',
      branch: 'Chi nhanh Q1',
    },
    createdAt: '2026-03-01T02:00:00.000Z',
    updatedAt: '2026-04-10T01:30:00.000Z',
  };

  return {
    myProfile,
    fullProfile: {
      profile: myProfile,
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
    updateCalls: [],
  };
}

function applyTeacherUpdate(state: TeacherState, payload: TeacherProfileUpdatePayload): void {
  const current = state.myProfile;
  const nextProfile: TeacherProfile = {
    ...current,
    subjects: payload.subjects ?? current.subjects,
    grades: payload.grades ?? current.grades,
    teachingMode: payload.teachingMode ?? current.teachingMode,
    locations: payload.locations ?? current.locations,
    bio: payload.bio ?? current.bio,
    yearsOfExperience: payload.yearsOfExperience ?? current.yearsOfExperience,
    videoIntroUrl: payload.videoIntroUrl ?? current.videoIntroUrl,
    qualifications: payload.qualifications ?? current.qualifications,
    availability: payload.availability ?? current.availability,
    pricePerSession: payload.pricePerSession ?? current.pricePerSession,
    pricePerHour: payload.pricePerHour ?? current.pricePerHour,
    bankInfo: payload.bankInfo ?? current.bankInfo,
    updatedAt: '2026-04-10T02:05:00.000Z',
  };

  state.myProfile = nextProfile;
  state.fullProfile.profile = nextProfile;
}

async function openTeacherSelfProfile(
  browser: Browser,
  request: APIRequestContext,
  scenario: string,
): Promise<BatchEvidenceSession> {
  const batch = await createBatchEvidenceContext(browser, {
    batchId: 'B06',
    scenario,
  });
  const session = await loginAsRole(request, 'teacher');
  await applySessionCookies(batch.page, session);
  return batch;
}

async function installTeacherSelfProfileRoutes(page: Page, state: TeacherState): Promise<void> {
  const context = page.context();

  await context.route(TEACHERS_ME_API, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(clone(state.myProfile)),
    });
  });

  await context.route(TEACHER_PROFILE_API, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(clone(state.fullProfile)),
    });
  });

  await context.route(TEACHER_UPDATE_API, async (route) => {
    if (route.request().method() !== 'PATCH') {
      await route.fallback();
      return;
    }
    const match = route.request().url().match(TEACHER_UPDATE_API);
    const teacherId = match?.[1] || '';
    const payload = route.request().postDataJSON() as TeacherProfileUpdatePayload;
    state.updateCalls.push({
      teacherId,
      payload: clone(payload),
    });
    applyTeacherUpdate(state, payload);
    await page.waitForTimeout(350);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(clone(state.myProfile)),
    });
  });
}

async function openEditMode(batch: BatchEvidenceSession): Promise<Page> {
  await batch.page.goto(appUrl('/app/teacher-profile'));
  await batch.page.waitForLoadState('domcontentloaded');
  await expect(batch.page.locator('.profile-content')).toBeVisible();
  await batch.page.locator('.header-actions .btn.primary').click();
  await expect(batch.page.locator('.edit-content')).toBeVisible();
  return batch.page;
}

test.use({
  trace: 'off',
  video: 'on',
});

test('B06 teacher self-profile blocks partial bankInfo when only branch is filled', async ({ browser, request }) => {
  const state = buildTeacherState();
  const batch = await openTeacherSelfProfile(browser, request, 'teacher_self_profile_bankinfo_validation');

  try {
    await installTeacherSelfProfileRoutes(batch.page, state);
    const page = await openEditMode(batch);

    await page.locator('input[name="bankName"]').fill('');
    await page.locator('input[name="accountNumber"]').fill('');
    await page.locator('input[name="accountHolderName"]').fill('');
    await page.locator('input[name="bankBranch"]').fill(' CN Thu Duc ');

    await page.locator('button[type="submit"].btn.primary').click();
    await expect(page.locator('.alert.error')).toHaveText('Vui long nhap day du ten ngan hang, so tai khoan va chu tai khoan.');
    await expect(page.locator('.edit-content')).toBeVisible();
    await expect(page.locator('button[type="submit"].btn.primary')).toContainText('Lưu thay đổi');
    await expect(page.locator('input[name="bankBranch"]')).toHaveValue(' CN Thu Duc ');
    expect(state.updateCalls).toHaveLength(0);
    await batch.step('teacher-self-profile-bankinfo-validation');

    await batch.finalize('PASS', {
      extraLines: [
        'Verified the self-profile edit form rejects branch-only bank info with the exact validation message.',
        'Verified the invalid save keeps edit mode open and sends zero PATCH requests.',
      ],
    });
  } catch (error) {
    await batch.finalize('FAIL', { error });
    throw error;
  }
});

test('B06 teacher self-profile trims completed bankInfo before save and reloads the masked bank card', async ({ browser, request }) => {
  const state = buildTeacherState();
  const batch = await openTeacherSelfProfile(browser, request, 'teacher_self_profile_bankinfo_save');

  try {
    await installTeacherSelfProfileRoutes(batch.page, state);
    const page = await openEditMode(batch);

    await page.locator('input[name="bankName"]').fill('  ACB  ');
    await page.locator('input[name="accountNumber"]').fill(' 9988776655 ');
    await page.locator('input[name="accountHolderName"]').fill('  NGUYEN THI TEACHER SELF CAP NHAT  ');
    await page.locator('input[name="bankBranch"]').fill('  CN Quan 7  ');

    const saveButton = page.locator('button[type="submit"].btn.primary');
    const savePromise = saveButton.click();
    await expect(saveButton).toBeDisabled();
    await savePromise;

    expect(state.updateCalls).toHaveLength(1);
    expect(state.updateCalls[0]).toEqual({
      teacherId: 'teacher-self-profile-001',
      payload: {
        subjects: ['Toan', 'Tieng Anh'],
        grades: ['Lop 6', 'Lop 7'],
        teachingMode: 'BOTH',
        locations: ['Q1', 'Q3'],
        bio: 'Giao vien tu quan ly ho so giang day va lich day online/offline.',
        yearsOfExperience: 7,
        pricePerSession: 300000,
        pricePerHour: 180000,
        qualifications: [{ title: 'Cu nhan Su pham' }],
        availability: [{ day: 'MONDAY', startTime: '18:00', endTime: '20:00' }],
        bankInfo: {
          bankName: 'ACB',
          accountNumber: '9988776655',
          accountHolderName: 'NGUYEN THI TEACHER SELF CAP NHAT',
          branch: 'CN Quan 7',
        },
      },
    });
    await expect(page.locator('.edit-content')).toHaveCount(0);
    await expect(page.locator('.alert.success')).toBeVisible();
    await expect(page.locator('.section-card').filter({ hasText: 'Thông tin ngân hàng' })).toContainText('ACB');
    await expect(page.locator('.section-card').filter({ hasText: 'Thông tin ngân hàng' })).toContainText('99****6655');
    await expect(page.locator('.section-card').filter({ hasText: 'Thông tin ngân hàng' })).toContainText('NGUYEN THI TEACHER SELF CAP NHAT');
    await expect(page.locator('.section-card').filter({ hasText: 'Thông tin ngân hàng' })).toContainText('CN Quan 7');
    await batch.step('teacher-self-profile-bankinfo-save');

    await batch.finalize('PASS', {
      extraLines: [
        'Verified the self-profile save trims bank info before sending the exact PATCH payload.',
        'Verified the reloaded bank card shows the updated bank name, masked account number, account holder, and branch.',
      ],
    });
  } catch (error) {
    await batch.finalize('FAIL', { error });
    throw error;
  }
});

test('B06 teacher self-profile add-remove qualifications and availability keep the exact PATCH payload and reload detail cards', async ({ browser, request }) => {
  const state = buildTeacherState();
  const batch = await openTeacherSelfProfile(browser, request, 'teacher_self_profile_qualifications_availability_save');

  try {
    await installTeacherSelfProfileRoutes(batch.page, state);
    const page = await openEditMode(batch);

    await expect(page.locator('.qual-edit-item')).toHaveCount(1);
    await expect(page.locator('.avail-edit-item')).toHaveCount(1);

    await page.locator('.qual-edit-item .btn-icon.danger').first().click();
    await expect(page.locator('.qual-edit-item')).toHaveCount(0);

    const addQualificationButton = page.locator('.qual-edit-list + button');
    await addQualificationButton.click();
    await addQualificationButton.click();
    await expect(page.locator('.qual-edit-item')).toHaveCount(2);

    const firstQualification = page.locator('.qual-edit-item').nth(0);
    const secondQualification = page.locator('.qual-edit-item').nth(1);

    await firstQualification.locator('input').nth(0).fill(' TESOL ');
    await firstQualification.locator('input').nth(1).fill(' British Council ');
    await firstQualification.locator('input').nth(2).fill('2021');
    await firstQualification.locator('input').nth(3).fill(' https://cdn.example.com/tesol.png ');

    await secondQualification.locator('input').nth(0).fill(' Google Educator Level 2 ');
    await secondQualification.locator('input').nth(1).fill(' Google ');
    await secondQualification.locator('input').nth(2).fill('2023');
    await secondQualification.locator('input').nth(3).fill('');

    await page.locator('.avail-edit-item .btn-icon.danger').first().click();
    await expect(page.locator('.avail-edit-item')).toHaveCount(0);

    const addAvailabilityButton = page.locator('.avail-edit-list + button');
    await addAvailabilityButton.click();
    await addAvailabilityButton.click();
    await expect(page.locator('.avail-edit-item')).toHaveCount(2);

    const firstAvailability = page.locator('.avail-edit-item').nth(0);
    const secondAvailability = page.locator('.avail-edit-item').nth(1);

    await firstAvailability.locator('select').selectOption('WEDNESDAY');
    await firstAvailability.locator('input[type="time"]').nth(0).fill('17:30');
    await firstAvailability.locator('input[type="time"]').nth(1).fill('19:00');
    await secondAvailability.locator('select').selectOption('SATURDAY');
    await secondAvailability.locator('input[type="time"]').nth(0).fill('09:00');
    await secondAvailability.locator('input[type="time"]').nth(1).fill('11:30');

    const saveButton = page.locator('button[type="submit"].btn.primary');
    const savePromise = saveButton.click();
    await expect(saveButton).toBeDisabled();
    await savePromise;

    expect(state.updateCalls).toHaveLength(1);
    expect(state.updateCalls[0]).toEqual({
      teacherId: 'teacher-self-profile-001',
      payload: {
        subjects: ['Toan', 'Tieng Anh'],
        grades: ['Lop 6', 'Lop 7'],
        teachingMode: 'BOTH',
        locations: ['Q1', 'Q3'],
        bio: 'Giao vien tu quan ly ho so giang day va lich day online/offline.',
        yearsOfExperience: 7,
        pricePerSession: 300000,
        pricePerHour: 180000,
        qualifications: [
          {
            title: 'TESOL',
            institution: 'British Council',
            year: 2021,
            imageUrl: 'https://cdn.example.com/tesol.png',
          },
          {
            title: 'Google Educator Level 2',
            institution: 'Google',
            year: 2023,
          },
        ],
        availability: [
          { day: 'WEDNESDAY', startTime: '17:30', endTime: '19:00' },
          { day: 'SATURDAY', startTime: '09:00', endTime: '11:30' },
        ],
        bankInfo: {
          bankName: 'Vietcombank',
          accountNumber: '123456789',
          accountHolderName: 'NGUYEN THI TEACHER SELF',
          branch: 'Chi nhanh Q1',
        },
      },
    });

    await expect(page.locator('.edit-content')).toHaveCount(0);
    await expect(page.locator('.qualification-card')).toHaveCount(2);
    await expect(page.locator('.qualification-card').nth(0)).toContainText('TESOL');
    await expect(page.locator('.qualification-card').nth(0)).toContainText('British Council');
    await expect(page.locator('.qualification-card').nth(1)).toContainText('Google Educator Level 2');
    await expect(page.locator('.schedule-item')).toHaveCount(2);
    await expect(page.locator('.schedule-grid')).toContainText('17:30');
    await expect(page.locator('.schedule-grid')).toContainText('19:00');
    await expect(page.locator('.schedule-grid')).toContainText('09:00');
    await expect(page.locator('.schedule-grid')).toContainText('11:30');
    await expect(page.locator('.schedule-grid')).not.toContainText('18:00');
    await batch.step('teacher-self-profile-qualifications-availability-save');

    await batch.finalize('PASS', {
      extraLines: [
        'Verified self-profile save sends the exact qualifications and availability arrays in the PATCH payload.',
        'Verified the reloaded profile removes the old slot and renders the new qualifications plus schedule rows.',
      ],
    });
  } catch (error) {
    await batch.finalize('FAIL', { error });
    throw error;
  }
});
