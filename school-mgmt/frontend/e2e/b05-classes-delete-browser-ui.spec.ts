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
const CLASS_DELETE_API = new RegExp(`${API_ORIGIN_PATTERN}/classes/class-delete-001(?:\\?.*)?$`);
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

async function installClassesDeleteRoutes(page: Page): Promise<{
  getClassesCallCount: () => number;
  getDeleteCallCount: () => number;
}> {
  const initialClasses = [
    {
      _id: 'class-delete-001',
      name: 'Lop Xoa Lop',
      code: 'HS-B05-DEL-001',
      classMode: 'ONLINE',
      teacher: {
        _id: 'teacher-delete-001',
        fullName: 'Teacher Delete',
        email: 'teacher.delete@example.com',
      },
      students: [
        {
          _id: 'student-delete-001',
          fullName: 'Hoc sinh Xoa Lop',
          studentCode: 'HS-DEL-001',
        },
      ],
      pricePerSession: 430000,
      teacherPayPerSession: 230000,
      baseDuration: 60,
      sessionDuration: 60,
      actualPricePerSession: 430000,
      actualTeacherPayPerSession: 230000,
      revenuePerStudent: 0,
      teacherSalaryCost: 0,
    },
  ];

  const teachers = [
    {
      _id: 'teacher-profile-delete-001',
      userId: {
        _id: 'teacher-delete-001',
        fullName: 'Teacher Delete',
        email: 'teacher.delete@example.com',
      },
      managedSales: [],
      subjects: ['Toan'],
      grades: ['Lop 8'],
      teachingMode: 'ONLINE',
      locations: [],
      qualifications: [],
      yearsOfExperience: 5,
      availability: [],
      pricePerSession: 230000,
      status: 'ACTIVE',
      rating: 4.7,
      totalReviews: 10,
      totalSessions: 30,
      activeClasses: 2,
    },
  ];

  const students = [
    {
      _id: 'student-delete-001',
      studentCode: 'HS-DEL-001',
      fullName: 'Hoc sinh Xoa Lop',
      age: 14,
      parentName: 'Phu huynh Xoa Lop',
      parentPhone: '0901222333',
      faceImage: '/uploads/faces/student-delete-001.png',
    },
  ];

  let classesCallCount = 0;
  let deleteCallCount = 0;

  await page.route(CLASSES_API, async (route) => {
    classesCallCount += 1;
    const body = classesCallCount === 1 ? initialClasses : [];
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(clone(body)),
    });
  });

  await page.route(CLASS_DELETE_API, async (route) => {
    deleteCallCount += 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
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
    getDeleteCallCount: () => deleteCallCount,
  };
}

test.use({
  trace: 'off',
  video: 'on',
});

test('B05 delete class shows confirm and only removes data after confirmed reload', async ({ browser, page, request }) => {
  const batch = await openBatch(browser, 'classes_delete_browser');

  try {
    const routes = await installClassesDeleteRoutes(page);

    await signInAs(page, request, 'director');
    await page.goto(appUrl('/app/classes'));
    await page.waitForLoadState('domcontentloaded');

    const classRow = page.getByTestId('class-row-class-delete-001');
    const deleteButton = classRow.getByTestId('class-delete-class-delete-001');

    await expect(page.getByRole('heading', { name: 'Quan ly lop hoc' })).toBeVisible();
    await expect(classRow).toBeVisible();
    await expect(classRow).toContainText('Lop Xoa Lop');
    await expect(deleteButton).toBeVisible();

    let cancelDialogMessage = '';
    let cancelDialogType = '';
    const cancelHandled = new Promise<void>((resolve, reject) => {
      page.once('dialog', async (dialog) => {
        try {
          cancelDialogType = dialog.type();
          cancelDialogMessage = dialog.message();
          await dialog.dismiss();
          resolve();
        } catch (error) {
          reject(error);
        }
      });
    });
    await deleteButton.click();
    await cancelHandled;

    await expect.poll(() => cancelDialogType).toBe('confirm');
    await expect.poll(() => cancelDialogMessage).toBe('Xoa lop Lop Xoa Lop?');
    await expect.poll(routes.getDeleteCallCount).toBe(0);
    await expect.poll(routes.getClassesCallCount).toBe(1);
    await expect(classRow).toBeVisible();
    await batch.step('classes-delete-cancelled');

    let confirmDialogMessage = '';
    let confirmDialogType = '';
    const confirmHandled = new Promise<void>((resolve, reject) => {
      page.once('dialog', async (dialog) => {
        try {
          confirmDialogType = dialog.type();
          confirmDialogMessage = dialog.message();
          await dialog.accept();
          resolve();
        } catch (error) {
          reject(error);
        }
      });
    });
    await deleteButton.click();
    await confirmHandled;

    await expect.poll(() => confirmDialogType).toBe('confirm');
    await expect.poll(() => confirmDialogMessage).toBe('Xoa lop Lop Xoa Lop?');
    await expect.poll(routes.getDeleteCallCount).toBe(1);
    await expect.poll(routes.getClassesCallCount).toBe(2);
    await expect(classRow).toHaveCount(0);
    await expect(page.getByText('Chua co lop hoc.')).toBeVisible();
    await batch.step('classes-delete-confirmed');

    await batch.finalize('PASS', {
      extraLines: [
        'Verified delete action shows exact confirm dialog text before any mutation: PASS',
        'Verified dismissing the confirm dialog keeps delete request count at 0 and leaves the class row intact: PASS',
        'Verified accepting the confirm dialog sends exactly one DELETE /classes/:id and triggers a second GET /classes reload: PASS',
        'Verified the deleted class row disappears and the empty-state text appears after the confirmed reload: PASS',
      ],
    });
  } catch (error) {
    await batch.finalize('FAIL', { error });
    throw error;
  }
});
