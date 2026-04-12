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
const CLASSES_API = new RegExp(`${API_ORIGIN_PATTERN}/classes(?:\\?.*)?$`);
const CLASS_STUDENT_CONFIG_API = new RegExp(
  `${API_ORIGIN_PATTERN}/classes/class-config-001/students/student-config-001/config(?:\\?.*)?$`,
);
const USERS_DIRECTORY_API = new RegExp(`${API_ORIGIN_PATTERN}/users/directory(?:\\?.*)?$`);
const TEACHERS_API = new RegExp(`${API_ORIGIN_PATTERN}/teachers(?:\\?.*)?$`);
const STUDENTS_API = new RegExp(`${API_ORIGIN_PATTERN}/students(?:\\?.*)?$`);
const PRODUCTS_API = new RegExp(`${API_ORIGIN_PATTERN}/products(?:\\?.*)?$`);

function appUrl(path: string): string {
  return new URL(path, APP_BASE_URL).toString();
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

async function signInAs(page: Page, request: APIRequestContext): Promise<void> {
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

async function installStudentConfigRoutes(page: Page): Promise<{
  getClassesCallCount: () => number;
  getPatchedPayloads: () => Array<Record<string, unknown>>;
}> {
  const teacherInitial = {
    _id: 'teacher-config-001',
    fullName: 'Teacher Chu Dao',
    email: 'teacher.config.001@example.com',
    userCode: 'GV-001',
  };
  const teacherUpdated = {
    _id: 'teacher-config-002',
    fullName: 'Teacher Chuyen Slot',
    email: 'teacher.config.002@example.com',
    userCode: 'GV-002',
  };

  const originalClasses = [
    {
      _id: 'class-config-001',
      name: 'Lop Cau Hinh Rieng',
      code: 'CLS-CONFIG-001',
      classMode: 'ONLINE',
      teacher: teacherInitial,
      students: [
        {
          _id: 'student-config-001',
          fullName: 'Hoc sinh Slot Rieng',
          studentCode: 'HS-CONFIG-001',
        },
        {
          _id: 'student-config-002',
          fullName: 'Hoc sinh Mac Dinh',
          studentCode: 'HS-CONFIG-002',
        },
      ],
      pricePerSession: 380000,
      teacherPayPerSession: 220000,
      baseDuration: 60,
      sessionDuration: 60,
      actualPricePerSession: 380000,
      actualTeacherPayPerSession: 220000,
      totalSessions: 18,
      revenuePerStudent: 0,
      teacherSalaryCost: 0,
      studentConfigs: [],
    },
  ];

  const updatedClasses = [
    {
      _id: 'class-config-001',
      name: 'Lop Cau Hinh Rieng',
      code: 'CLS-CONFIG-001',
      classMode: 'ONLINE',
      teacher: teacherInitial,
      students: [
        {
          _id: 'student-config-001',
          fullName: 'Hoc sinh Slot Rieng',
          studentCode: 'HS-CONFIG-001',
        },
        {
          _id: 'student-config-002',
          fullName: 'Hoc sinh Mac Dinh',
          studentCode: 'HS-CONFIG-002',
        },
      ],
      pricePerSession: 380000,
      teacherPayPerSession: 220000,
      baseDuration: 60,
      sessionDuration: 60,
      actualPricePerSession: 380000,
      actualTeacherPayPerSession: 220000,
      totalSessions: 18,
      revenuePerStudent: 0,
      teacherSalaryCost: 0,
      studentConfigs: [
        {
          studentId: {
            _id: 'student-config-001',
            fullName: 'Hoc sinh Slot Rieng',
            studentCode: 'HS-CONFIG-001',
          },
          teacherSlots: [
            {
              slotIndex: 1,
              slotType: 'INITIAL',
              teacherId: teacherInitial,
            },
            {
              slotIndex: 2,
              slotType: 'UPDATE',
              teacherId: teacherUpdated,
            },
          ],
          durationSlots: [
            {
              slotIndex: 1,
              slotType: 'INITIAL',
              baseDuration: 60,
              sessionDuration: 60,
              totalSessions: 18,
            },
            {
              slotIndex: 2,
              slotType: 'UPDATE',
              baseDuration: 60,
              sessionDuration: 90,
              totalSessions: 12,
            },
          ],
        },
      ],
    },
  ];

  const teacherProfiles = [
    {
      _id: 'teacher-profile-config-001',
      userId: teacherInitial,
      managedSales: [],
      subjects: ['Toan'],
      grades: ['Lop 7'],
      teachingMode: 'ONLINE',
      locations: [],
      qualifications: [],
      yearsOfExperience: 4,
      availability: [],
      pricePerSession: 220000,
      status: 'ACTIVE',
      rating: 4.7,
      totalReviews: 14,
      totalSessions: 72,
      activeClasses: 2,
    },
    {
      _id: 'teacher-profile-config-002',
      userId: teacherUpdated,
      managedSales: [],
      subjects: ['Toan'],
      grades: ['Lop 7'],
      teachingMode: 'ONLINE',
      locations: [],
      qualifications: [],
      yearsOfExperience: 6,
      availability: [],
      pricePerSession: 235000,
      status: 'ACTIVE',
      rating: 4.9,
      totalReviews: 18,
      totalSessions: 95,
      activeClasses: 3,
    },
  ];

  const students = [
    {
      _id: 'student-config-001',
      studentCode: 'HS-CONFIG-001',
      fullName: 'Hoc sinh Slot Rieng',
      age: 13,
      parentName: 'Phu huynh Slot Rieng',
      parentPhone: '0901888001',
      faceImage: '/uploads/faces/student-config-001.png',
    },
    {
      _id: 'student-config-002',
      studentCode: 'HS-CONFIG-002',
      fullName: 'Hoc sinh Mac Dinh',
      age: 12,
      parentName: 'Phu huynh Mac Dinh',
      parentPhone: '0901888002',
      faceImage: '/uploads/faces/student-config-002.png',
    },
  ];

  let classesCallCount = 0;
  const patchBodies: Array<Record<string, unknown>> = [];

  await page.route(CLASSES_API, async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    classesCallCount += 1;
    const body = classesCallCount === 1 ? originalClasses : updatedClasses;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(clone(body)),
    });
  });

  await page.route(CLASS_STUDENT_CONFIG_API, async (route) => {
    const payload = route.request().postDataJSON() as Record<string, unknown>;
    patchBodies.push(clone(payload));
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        message: 'Cap nhat cau hinh hoc sinh thanh cong',
        data: clone(updatedClasses[0]),
      }),
    });
  });

  await page.route(USERS_DIRECTORY_API, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });

  await page.route(TEACHERS_API, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(clone(teacherProfiles)),
    });
  });

  await page.route(STUDENTS_API, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(clone(students)),
    });
  });

  await page.route(PRODUCTS_API, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });

  return {
    getClassesCallCount: () => classesCallCount,
    getPatchedPayloads: () => clone(patchBodies),
  };
}

test.use({
  trace: 'off',
  video: 'on',
});

test('B05 student config opens from class row, saves exact per-student payload, and reloads updated slot summaries', async ({ browser, page, request }) => {
  const batch = await openBatch(browser, 'student_config_browser');

  try {
    const routes = await installStudentConfigRoutes(page);

    await signInAs(page, request);
    await page.goto(appUrl('/app/classes'));
    await page.waitForLoadState('domcontentloaded');

    const classRow = page.getByTestId('class-row-class-config-001');
    const studentChip = page.getByTestId('class-student-chip-class-config-001-student-config-001');
    const configButton = page.getByTestId('class-student-config-class-config-001-student-config-001');

    await expect(page.getByRole('heading', { name: 'Quan ly lop hoc' })).toBeVisible();
    await expect(classRow).toBeVisible();
    await expect(studentChip).toContainText('Hoc sinh Slot Rieng');
    await expect(page.getByTestId('class-student-teacher-summary-class-config-001-student-config-001')).toHaveText('GV1: Teacher Chu Dao');
    await expect(page.getByTestId('class-student-duration-summary-class-config-001-student-config-001')).toHaveText('Lan 1: 60 phut');
    await expect(configButton).toBeVisible();
    await batch.step('student-config-entry-visible');

    await configButton.click();

    await expect(page.getByRole('heading', { name: 'Sua hoc sinh trong lop' })).toBeVisible();
    await expect(page.locator('.student-modal-summary')).toContainText('Hoc sinh Slot Rieng');
    await expect(page.locator('.student-modal-summary')).toContainText('Lop Cau Hinh Rieng');
    await expect(page.locator('.student-modal-summary')).toContainText('Tong so buoi hien tai: 18');
    await expect(page.locator('.slot-card').filter({ hasText: 'GV1' })).toContainText('Teacher Chu Dao');
    await expect(page.locator('.slot-card').filter({ hasText: 'Lan 1' })).toContainText('60 phut');

    await page.locator('select[name="studentConfigTeacherId"]').selectOption('teacher-config-002');
    await page.locator('select[name="studentConfigSessionDuration"]').selectOption({ label: '90 phut' });
    await page.getByRole('button', { name: 'Luu thay doi hoc sinh' }).click();

    await expect.poll(routes.getClassesCallCount).toBe(2);
    await expect.poll(() => routes.getPatchedPayloads().length).toBe(1);
    expect(routes.getPatchedPayloads()[0]).toEqual({
      teacherId: 'teacher-config-002',
      sessionDuration: 90,
    });
    await expect(page.getByRole('heading', { name: 'Sua hoc sinh trong lop' })).toHaveCount(0);

    await expect(page.getByTestId('class-student-teacher-summary-class-config-001-student-config-001')).toHaveText('GV2: Teacher Chuyen Slot');
    await expect(page.getByTestId('class-student-duration-summary-class-config-001-student-config-001')).toHaveText('Lan 2: 90 phut');
    await batch.step('student-config-summary-updated');

    await configButton.click();
    await expect(page.getByRole('heading', { name: 'Sua hoc sinh trong lop' })).toBeVisible();
    await expect(page.locator('.slot-card').filter({ hasText: 'GV1' })).toContainText('Teacher Chu Dao');
    await expect(page.locator('.slot-card').filter({ hasText: 'GV2' })).toContainText('Teacher Chuyen Slot');
    await expect(page.locator('.slot-card').filter({ hasText: 'Lan 1' })).toContainText('60 phut');
    await expect(page.locator('.slot-card').filter({ hasText: 'Lan 2' })).toContainText('90 phut');
    await batch.step('student-config-reopen-updated');

    await batch.finalize('PASS', {
      extraLines: [
        'Verified classes row exposes a real per-student config entry point for the targeted student: PASS',
        'Verified the student-config modal opens with the correct class/student context and current GV1/Lan 1 baseline: PASS',
        'Verified saving one teacher-slot append and one duration-slot append sends one exact PATCH /classes/:id/students/:studentId/config payload: PASS',
        'Verified successful save reloads /classes and updates per-student summaries from GV1/Lan 1 to GV2/Lan 2 on the real classes surface: PASS',
        'Verified reopening the modal after reload shows both historical slots, not stale pre-save state: PASS',
      ],
    });
  } catch (error) {
    await batch.finalize('FAIL', { error });
    throw error;
  }
});
