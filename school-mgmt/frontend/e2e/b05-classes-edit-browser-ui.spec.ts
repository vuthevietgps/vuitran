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
const CLASSES_API = new RegExp(`${API_ORIGIN_PATTERN}/classes(?:\\?.*)?$`);
const CLASS_UPDATE_API = new RegExp(`${API_ORIGIN_PATTERN}/classes/class-edit-001(?:\\?.*)?$`);
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

async function signInAs(page: Page, request: APIRequestContext, role: DemoRole): Promise<void> {
  await page.context().clearCookies();
  const session = await loginAsRole(request, role);
  await applySessionCookies(page, session);
}

async function openBatch(browser: Browser, scenario: string): Promise<BatchEvidenceSession> {
  return createBatchEvidenceContext(browser, {
    batchId: 'B05',
    scenario,
  });
}

async function installClassesEditRoutes(page: Page): Promise<{
  getClassesCallCount: () => number;
  getPatchedPayloads: () => unknown[];
}> {
  const originalClasses = [
    {
      _id: 'class-edit-001',
      name: 'Lop Toan Nen Tang',
      code: 'HS-B05-001',
      classMode: 'ONLINE',
      teacher: {
        _id: 'teacher-class-001',
        fullName: 'Teacher Initial',
        email: 'teacher.initial@example.com',
      },
      students: [
        {
          _id: 'student-class-001',
          fullName: 'Hoc sinh Cap nhat',
          studentCode: 'HS-EDIT-001',
        },
      ],
      pricePerSession: 420000,
      teacherPayPerSession: 240000,
      baseDuration: 60,
      sessionDuration: 60,
      actualPricePerSession: 420000,
      actualTeacherPayPerSession: 240000,
      revenuePerStudent: 0,
      teacherSalaryCost: 0,
    },
  ];

  const updatedClasses = [
    {
      _id: 'class-edit-001',
      name: 'Lop Toan Da Cap Nhat',
      code: 'HS-B05-001',
      classMode: 'ONLINE',
      teacher: {
        _id: 'teacher-class-002',
        fullName: 'Teacher Reloaded',
        email: 'teacher.reloaded@example.com',
      },
      students: [
        {
          _id: 'student-class-001',
          fullName: 'Hoc sinh Cap nhat',
          studentCode: 'HS-EDIT-001',
        },
      ],
      pricePerSession: 560000,
      teacherPayPerSession: 280000,
      baseDuration: 60,
      sessionDuration: 75,
      actualPricePerSession: 700000,
      actualTeacherPayPerSession: 350000,
      revenuePerStudent: 0,
      teacherSalaryCost: 0,
    },
  ];

  const usersDirectory = [
    {
      _id: 'sale-b05-001',
      fullName: 'Sale B05',
      email: 'sale.b05@example.com',
      role: 'SALE',
    },
  ];

  const teachers = [
    {
      _id: 'teacher-profile-class-001',
      userId: {
        _id: 'teacher-class-001',
        fullName: 'Teacher Initial',
        email: 'teacher.initial@example.com',
      },
      managedSales: [],
      subjects: ['Toan'],
      grades: ['Lop 7'],
      teachingMode: 'ONLINE',
      locations: [],
      qualifications: [],
      yearsOfExperience: 4,
      availability: [],
      pricePerSession: 240000,
      status: 'ACTIVE',
      rating: 4.8,
      totalReviews: 16,
      totalSessions: 54,
      activeClasses: 2,
    },
    {
      _id: 'teacher-profile-class-002',
      userId: {
        _id: 'teacher-class-002',
        fullName: 'Teacher Reloaded',
        email: 'teacher.reloaded@example.com',
      },
      managedSales: [],
      subjects: ['Toan'],
      grades: ['Lop 7'],
      teachingMode: 'ONLINE',
      locations: [],
      qualifications: [],
      yearsOfExperience: 6,
      availability: [],
      pricePerSession: 280000,
      status: 'ACTIVE',
      rating: 4.9,
      totalReviews: 20,
      totalSessions: 88,
      activeClasses: 3,
    },
  ];

  const students = [
    {
      _id: 'student-class-001',
      studentCode: 'HS-EDIT-001',
      fullName: 'Hoc sinh Cap nhat',
      age: 13,
      parentName: 'Phu huynh Cap nhat',
      parentPhone: '0901110001',
      faceImage: '/uploads/faces/student-class-001.png',
    },
  ];

  let classesCallCount = 0;
  const patchBodies: unknown[] = [];

  await page.route(CLASSES_API, async (route) => {
    classesCallCount += 1;
    const body = classesCallCount === 1 ? originalClasses : updatedClasses;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(clone(body)),
    });
  });

  await page.route(CLASS_UPDATE_API, async (route) => {
    patchBodies.push(route.request().postDataJSON());
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        message: 'Cap nhat lop hoc thanh cong',
        data: clone(updatedClasses[0]),
      }),
    });
  });

  await page.route(USERS_DIRECTORY_API, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(clone(usersDirectory)),
    });
  });

  await page.route(TEACHERS_API, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(clone(teachers)),
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

test('B05 edit existing class reloads fresh data and reopens with updated values', async ({ browser, page, request }) => {
  const batch = await openBatch(browser, 'classes_edit_reload_browser');

  try {
    const routes = await installClassesEditRoutes(page);

    await signInAs(page, request, 'director');
    await page.goto(appUrl('/app/classes'));
    await page.waitForLoadState('domcontentloaded');

    const classRow = page.getByTestId('class-row-class-edit-001');
    await expect(page).toHaveURL(/\/app\/classes$/);
    await expect(page.getByRole('heading', { name: 'Quan ly lop hoc' })).toBeVisible();
    await expect(classRow).toBeVisible();
    await expect(classRow).toContainText('Lop Toan Nen Tang');
    await expect(classRow).toContainText('Teacher Initial');
    await expect(classRow).toContainText('60p');
    await batch.step('classes-original-row');

    await classRow.getByTestId('class-edit-class-edit-001').click();
    await expect(page.getByRole('heading', { name: 'Chinh sua lop hoc' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cap nhat' })).toBeVisible();
    await expect(page.locator('input[name="name"]')).toHaveValue('Lop Toan Nen Tang');
    await expect(page.locator('select[name="teacherId"]')).toHaveValue('teacher-class-001');
    await expect(page.locator('select[name="baseDuration"] option:checked')).toHaveText('60 phut');
    await expect(page.locator('input[name="sessionDuration"]')).toHaveValue('60');
    await expect(page.locator('input[name="pricePerSession"]')).toHaveValue('420000');

    await page.locator('input[name="name"]').fill('Lop Toan Da Cap Nhat');
    await page.locator('select[name="teacherId"]').selectOption('teacher-class-002');
    await page.locator('input[name="pricePerSession"]').fill('560000');
    await page.locator('input[name="teacherPayPerSession"]').fill('280000');
    await page.locator('input[name="sessionDuration"]').fill('75');

    await page.getByRole('button', { name: 'Cap nhat' }).click();

    await expect.poll(routes.getClassesCallCount).toBe(2);
    await expect(page.getByRole('heading', { name: 'Chinh sua lop hoc' })).toHaveCount(0);
    await expect.poll(() => routes.getPatchedPayloads().length).toBe(1);
    expect(routes.getPatchedPayloads()[0]).toEqual({
      name: 'Lop Toan Da Cap Nhat',
      code: 'HS-B05-001',
      teacherId: 'teacher-class-002',
      classMode: 'ONLINE',
      studentIds: ['student-class-001'],
      pricePerSession: 560000,
      teacherPayPerSession: 280000,
      baseDuration: 60,
      sessionDuration: 75,
      revenuePerStudent: 0,
      teacherSalaryCost: 0,
    });

    await expect(classRow).toContainText('Lop Toan Da Cap Nhat');
    await expect(classRow).toContainText('Teacher Reloaded');
    await expect(classRow).toContainText('75p');

    await classRow.getByTestId('class-edit-class-edit-001').click();
    await expect(page.getByRole('heading', { name: 'Chinh sua lop hoc' })).toBeVisible();
    await expect(page.locator('input[name="name"]')).toHaveValue('Lop Toan Da Cap Nhat');
    await expect(page.locator('select[name="teacherId"]')).toHaveValue('teacher-class-002');
    await expect(page.locator('input[name="pricePerSession"]')).toHaveValue('560000');
    await expect(page.locator('input[name="teacherPayPerSession"]')).toHaveValue('280000');
    await expect(page.locator('input[name="sessionDuration"]')).toHaveValue('75');
    await batch.step('classes-reopened-updated');

    await batch.finalize('PASS', {
      extraLines: [
        'Verified manager edit opens modal with current class values prefilled: PASS',
        'Verified exact PATCH /classes/:id payload carries updated name, teacher, pricing, and duration fields: PASS',
        'Verified successful save triggers a second GET /classes and the table row re-renders with reloaded values: PASS',
        'Verified reopening the modal reads the updated values from the reloaded class list instead of stale local state: PASS',
      ],
    });
  } catch (error) {
    await batch.finalize('FAIL', { error });
    throw error;
  }
});
