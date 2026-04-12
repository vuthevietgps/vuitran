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

const API_ORIGIN_PATTERN = 'https?://(?:localhost|127\\.0\\.0\\.1):3000(?:/api)?';
const CLASSES_LIST_API = new RegExp(`${API_ORIGIN_PATTERN}/classes(?:\\?.*)?$`);
const CLASS_UPDATE_API = new RegExp(`${API_ORIGIN_PATTERN}/classes/class-edit-001(?:\\?.*)?$`);
const USERS_DIRECTORY_API = new RegExp(`${API_ORIGIN_PATTERN}/users/directory(?:\\?.*)?$`);
const TEACHERS_API = new RegExp(`${API_ORIGIN_PATTERN}/teachers(?:\\?.*)?$`);
const STUDENTS_API = new RegExp(`${API_ORIGIN_PATTERN}/students(?:\\?.*)?$`);
const PRODUCTS_API = new RegExp(`${API_ORIGIN_PATTERN}/products(?:\\?.*)?$`);

type TeacherDirectoryItem = {
  _id: string;
  fullName: string;
  email: string;
};

type TeacherProfileItem = {
  _id: string;
  userId: TeacherDirectoryItem;
  managedSales: string[];
  subjects: string[];
  grades: string[];
  teachingMode: 'ONLINE' | 'OFFLINE' | 'BOTH';
  locations: string[];
  qualifications: string[];
  yearsOfExperience: number;
  availability: string[];
  pricePerSession: number;
  status: 'ACTIVE' | 'INACTIVE';
  rating: number;
  totalReviews: number;
  totalSessions: number;
  activeClasses: number;
};

type ClassState = {
  listRequests: string[];
  patchPayloads: Record<string, unknown>[];
  teachersDirectory: Array<{
    _id: string;
    fullName: string;
    email: string;
    role: 'SALE';
  }>;
  teacherProfiles: TeacherProfileItem[];
  students: Array<{
    _id: string;
    fullName: string;
    studentCode: string;
    parentName: string;
    parentPhone: string;
  }>;
  classes: Array<{
    _id: string;
    name: string;
    code: string;
    classMode: 'ONLINE';
    teacher: TeacherDirectoryItem;
    students: Array<{
      _id: string;
      fullName: string;
      studentCode: string;
    }>;
    pricePerSession: number;
    teacherPayPerSession: number;
    baseDuration: number;
    sessionDuration: number;
    actualPricePerSession: number;
    actualTeacherPayPerSession: number;
    revenuePerStudent: number;
    teacherSalaryCost: number;
  }>;
};

function appUrl(path: string): string {
  return new URL(path, APP_BASE_URL).toString();
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

async function signInAsDirector(page: Page, request: APIRequestContext): Promise<void> {
  await page.context().clearCookies();
  const session = await loginAsRole(request, 'director');
  await applySessionCookies(page, session);
}

async function openBatch(browser: Browser, scenario: string): Promise<BatchEvidenceSession> {
  return createBatchEvidenceContext(browser, {
    batchId: 'B05',
    scenario,
  });
}

function buildClassState(): ClassState {
  const teacherCu: TeacherDirectoryItem = {
    _id: 'teacher-edit-001',
    fullName: 'Teacher Cu',
    email: 'teacher.cu@example.com',
  };
  const teacherMoi: TeacherDirectoryItem = {
    _id: 'teacher-edit-002',
    fullName: 'Teacher Moi',
    email: 'teacher.moi@example.com',
  };

  return {
    listRequests: [],
    patchPayloads: [],
    teachersDirectory: [
      {
        _id: 'sale-edit-001',
        fullName: 'Sale Lop Hoc',
        email: 'sale.lophoc@example.com',
        role: 'SALE',
      },
    ],
    teacherProfiles: [
      {
        _id: 'teacher-profile-edit-001',
        userId: teacherCu,
        managedSales: [],
        subjects: ['Toan'],
        grades: ['Lop 6'],
        teachingMode: 'ONLINE',
        locations: [],
        qualifications: ['Cu nhan Su pham'],
        yearsOfExperience: 4,
        availability: [],
        pricePerSession: 250000,
        status: 'ACTIVE',
        rating: 4.7,
        totalReviews: 12,
        totalSessions: 58,
        activeClasses: 2,
      },
      {
        _id: 'teacher-profile-edit-002',
        userId: teacherMoi,
        managedSales: [],
        subjects: ['Toan'],
        grades: ['Lop 6'],
        teachingMode: 'ONLINE',
        locations: [],
        qualifications: ['Thac si Toan hoc'],
        yearsOfExperience: 6,
        availability: [],
        pricePerSession: 250000,
        status: 'ACTIVE',
        rating: 4.9,
        totalReviews: 21,
        totalSessions: 84,
        activeClasses: 3,
      },
    ],
    students: [
      {
        _id: 'student-edit-001',
        fullName: 'Hoc sinh Lan',
        studentCode: 'HS-EDIT-001',
        parentName: 'Phu huynh Lan',
        parentPhone: '0901000001',
      },
      {
        _id: 'student-edit-002',
        fullName: 'Hoc sinh Minh',
        studentCode: 'HS-EDIT-002',
        parentName: 'Phu huynh Minh',
        parentPhone: '0901000002',
      },
    ],
    classes: [
      {
        _id: 'class-edit-001',
        name: 'Lop Edit Ban Dau',
        code: 'CLS-EDIT-001',
        classMode: 'ONLINE',
        teacher: teacherCu,
        students: [
          {
            _id: 'student-edit-001',
            fullName: 'Hoc sinh Lan',
            studentCode: 'HS-EDIT-001',
          },
          {
            _id: 'student-edit-002',
            fullName: 'Hoc sinh Minh',
            studentCode: 'HS-EDIT-002',
          },
        ],
        pricePerSession: 420000,
        teacherPayPerSession: 250000,
        baseDuration: 60,
        sessionDuration: 75,
        actualPricePerSession: 525000,
        actualTeacherPayPerSession: 312000,
        revenuePerStudent: 0,
        teacherSalaryCost: 0,
      },
    ],
  };
}

async function installClassRoutes(page: Page, state: ClassState): Promise<void> {
  await page.route(CLASS_UPDATE_API, async (route) => {
    const payload = route.request().postDataJSON() as Record<string, unknown>;
    state.patchPayloads.push(clone(payload));

    const teacherId = String(payload['teacherId'] || '');
    const matchedTeacher = state.teacherProfiles.find((profile) => profile.userId._id === teacherId)?.userId;
    if (!matchedTeacher) {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Khong tim thay giao vien' }),
      });
      return;
    }

    const current = state.classes[0];
    state.classes[0] = {
      ...current,
      name: String(payload['name'] || current.name),
      code: String(payload['code'] || current.code),
      teacher: clone(matchedTeacher),
      classMode: (payload['classMode'] as 'ONLINE') || current.classMode,
      pricePerSession: Number(payload['pricePerSession'] ?? current.pricePerSession),
      teacherPayPerSession: Number(payload['teacherPayPerSession'] ?? current.teacherPayPerSession),
      baseDuration: Number(payload['baseDuration'] ?? current.baseDuration),
      sessionDuration: Number(payload['sessionDuration'] ?? current.sessionDuration),
      actualPricePerSession: Number(payload['pricePerSession'] ?? current.pricePerSession),
      actualTeacherPayPerSession: Number(payload['teacherPayPerSession'] ?? current.teacherPayPerSession),
      revenuePerStudent: Number(payload['revenuePerStudent'] ?? current.revenuePerStudent),
      teacherSalaryCost: Number(payload['teacherSalaryCost'] ?? current.teacherSalaryCost),
    };

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        message: 'Cap nhat lop hoc thanh cong',
        data: clone(state.classes[0]),
      }),
    });
  });

  await page.route(CLASSES_LIST_API, async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    state.listRequests.push(route.request().url());
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(clone(state.classes)),
    });
  });

  await page.route(USERS_DIRECTORY_API, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(clone(state.teachersDirectory)),
    });
  });

  await page.route(TEACHERS_API, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(clone(state.teacherProfiles)),
    });
  });

  await page.route(STUDENTS_API, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(clone(state.students)),
    });
  });

  await page.route(PRODUCTS_API, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });
}

test.use({
  trace: 'off',
  video: 'on',
});

test.describe.serial('B05 classes edit reload browser flow', () => {
  test('B05 editing an existing class persists exact payload, reloads the list, and reopens with the updated values', async ({ browser, request }) => {
    test.slow();
    test.setTimeout(300_000);

    const state = buildClassState();
    const batch = await openBatch(browser, 'classes_edit_reload_browser');

    try {
      await installClassRoutes(batch.page, state);
      await signInAsDirector(batch.page, request);

      await batch.page.goto(appUrl('/app/classes'));
      await batch.page.waitForLoadState('domcontentloaded');
      await batch.step('00-after-goto');

      const classRow = batch.page.getByTestId('class-row-class-edit-001');
      await expect(batch.page).toHaveURL(/\/app\/classes$/);
      await expect(batch.page.getByRole('heading', { name: 'Quan ly lop hoc' })).toBeVisible();
      await expect(classRow).toBeVisible();
      await expect(classRow).toContainText('Lop Edit Ban Dau');
      await expect(classRow).toContainText('Teacher Cu');
      await expect(classRow).toContainText('75p');
      await expect.poll(() => state.listRequests.length).toBe(1);
      await batch.step('01-class-list-initial');

      await classRow.getByTestId('class-edit-class-edit-001').click();
      await expect(batch.page.getByRole('heading', { name: 'Chinh sua lop hoc' })).toBeVisible();
      await expect(batch.page.locator('input[name="name"]')).toHaveValue('Lop Edit Ban Dau');
      await expect(batch.page.locator('input[name="codeSearch"]')).toHaveValue('CLS-EDIT-001');
      await expect(batch.page.locator('select[name="teacherId"]')).toHaveValue('teacher-edit-001');
      await expect(batch.page.locator('input[name="pricePerSession"]')).toHaveValue('420000');
      await expect(batch.page.locator('input[name="sessionDuration"]')).toHaveValue('75');
      await batch.step('02-modal-prefill');

      await batch.page.locator('input[name="name"]').fill('Lop Edit Da Reload');
      await batch.page.locator('select[name="teacherId"]').selectOption('teacher-edit-002');
      await batch.page.locator('input[name="pricePerSession"]').fill('470000');
      await batch.page.locator('input[name="sessionDuration"]').fill('95');
      await batch.page.getByRole('button', { name: 'Cap nhat' }).click();

      await expect.poll(() => state.patchPayloads.length).toBe(1);
      expect(state.patchPayloads[0]).toStrictEqual({
        name: 'Lop Edit Da Reload',
        code: 'CLS-EDIT-001',
        teacherId: 'teacher-edit-002',
        classMode: 'ONLINE',
        studentIds: ['student-edit-001', 'student-edit-002'],
        pricePerSession: 470000,
        baseDuration: 60,
        sessionDuration: 95,
        revenuePerStudent: 0,
        teacherSalaryCost: 0,
        teacherPayPerSession: 250000,
      });
      await expect.poll(() => state.listRequests.length).toBe(2);
      await expect(batch.page.getByRole('heading', { name: 'Chinh sua lop hoc' })).toHaveCount(0);
      await expect(classRow).toContainText('Lop Edit Da Reload');
      await expect(classRow).toContainText('Teacher Moi');
      await expect(classRow).toContainText('95p');
      await expect(classRow).not.toContainText('Lop Edit Ban Dau');
      await expect(classRow).not.toContainText('Teacher Cu');
      await batch.step('03-row-updated-after-reload');

      await classRow.getByTestId('class-edit-class-edit-001').click();
      await expect(batch.page.getByRole('heading', { name: 'Chinh sua lop hoc' })).toBeVisible();
      await expect(batch.page.locator('input[name="name"]')).toHaveValue('Lop Edit Da Reload');
      await expect(batch.page.locator('input[name="codeSearch"]')).toHaveValue('CLS-EDIT-001');
      await expect(batch.page.locator('select[name="teacherId"]')).toHaveValue('teacher-edit-002');
      await expect(batch.page.locator('input[name="pricePerSession"]')).toHaveValue('470000');
      await expect(batch.page.locator('input[name="sessionDuration"]')).toHaveValue('95');
      await batch.step('04-modal-reopened-with-updated-values');

      await batch.finalize('PASS', {
        extraLines: [
          'Verified DIRECTOR can edit an existing class from /app/classes: PASS',
          'Verified PATCH /classes/:id payload stays exact for name, teacher, price, and duration fields: PASS',
          'Verified class list reload runs again after save and row content reflects the updated class immediately: PASS',
          'Verified reopening the edit modal uses fresh reloaded data, not stale pre-edit state: PASS',
        ],
      });
    } catch (error) {
      await batch.finalize('FAIL', { error });
      throw error;
    }
  });
});
