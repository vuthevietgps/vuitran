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
    batchId: 'NHOM12',
    scenario,
  });
}

async function installClassesReadonlyRoutes(page: Page): Promise<void> {
  const classes = [
    {
      _id: 'class-readonly-001',
      name: 'Lop Accounting Readonly',
      code: 'CLS-ACC-001',
      classMode: 'ONLINE',
      teacher: {
        _id: 'teacher-readonly-001',
        fullName: 'Teacher Readonly',
        email: 'teacher.readonly@example.com',
      },
      students: [
        {
          _id: 'student-readonly-001',
          fullName: 'Hoc sinh Doi soat',
          studentCode: 'HS-ACC-001',
        },
      ],
      pricePerSession: 450000,
      teacherPayPerSession: 220000,
      baseDuration: 60,
      sessionDuration: 90,
      actualPricePerSession: 675000,
      actualTeacherPayPerSession: 330000,
    },
  ];

  const usersDirectory = [
    {
      _id: 'sale-readonly-001',
      fullName: 'Sale Readonly',
      email: 'sale.readonly@example.com',
      role: 'SALE',
    },
  ];

  const teachers = [
    {
      _id: 'teacher-profile-readonly-001',
      userId: {
        _id: 'teacher-readonly-001',
        fullName: 'Teacher Readonly',
        email: 'teacher.readonly@example.com',
      },
      managedSales: [],
      subjects: ['Toan'],
      grades: ['Lop 6'],
      teachingMode: 'ONLINE',
      locations: [],
      qualifications: [],
      yearsOfExperience: 4,
      availability: [],
      pricePerSession: 220000,
      status: 'ACTIVE',
      rating: 4.8,
      totalReviews: 12,
      totalSessions: 40,
      activeClasses: 2,
    },
  ];

  const students = [
    {
      _id: 'student-readonly-001',
      studentCode: 'HS-ACC-001',
      fullName: 'Hoc sinh Doi soat',
      age: 12,
      parentName: 'Phu huynh Doi soat',
      parentPhone: '0901112222',
      faceImage: '/uploads/faces/student-readonly-001.png',
    },
  ];

  await page.route(CLASSES_API, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(clone(classes)),
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
}

test.use({
  trace: 'off',
  video: 'on',
});

test('NHOM12 accounting can view classes read-only while director keeps write actions on the same class row', async ({ browser, request }) => {
  const batch = await openBatch(browser, 'accounting_classes_readonly_browser');

  try {
    await installClassesReadonlyRoutes(batch.page);

    await signInAs(batch.page, request, 'accounting');
    await batch.page.goto(appUrl('/app/classes'));
    await batch.page.waitForLoadState('domcontentloaded');

    const accountingRow = batch.page.getByTestId('class-row-class-readonly-001');
    await expect(batch.page).toHaveURL(/\/app\/classes$/);
    await expect(batch.page.getByTestId('nav-classes')).toBeVisible();
    await expect(batch.page.getByTestId('nav-classes')).toHaveClass(/active/);
    await expect(batch.page.getByRole('heading', { name: 'Quan ly lop hoc' })).toBeVisible();
    await expect(batch.page.getByTestId('classes-readonly-note')).toBeVisible();
    await expect(batch.page.getByTestId('classes-create')).toHaveCount(0);
    await expect(accountingRow).toBeVisible();
    await expect(accountingRow).toContainText('Lop Accounting Readonly');
    await expect(accountingRow).toContainText('Hoc sinh Doi soat');
    await expect(accountingRow.getByTestId('class-edit-class-readonly-001')).toHaveCount(0);
    await expect(accountingRow.getByTestId('class-delete-class-readonly-001')).toHaveCount(0);
    await batch.step('accounting-classes-readonly');

    await signInAs(batch.page, request, 'director');
    await batch.page.goto(appUrl('/app/classes'));
    await batch.page.waitForLoadState('domcontentloaded');

    const directorRow = batch.page.getByTestId('class-row-class-readonly-001');
    await expect(batch.page).toHaveURL(/\/app\/classes$/);
    await expect(batch.page.getByTestId('nav-classes')).toBeVisible();
    await expect(batch.page.getByTestId('classes-readonly-note')).toHaveCount(0);
    await expect(batch.page.getByTestId('classes-create')).toBeVisible();
    await expect(directorRow).toBeVisible();
    await expect(directorRow.getByTestId('class-edit-class-readonly-001')).toBeVisible();
    await expect(directorRow.getByTestId('class-delete-class-readonly-001')).toBeVisible();
    await batch.step('director-classes-write-actions');

    await batch.finalize('PASS', {
      extraLines: [
        'Verified ACCOUNTING can reach /app/classes directly and via sidebar navigation for reconciliation work: PASS',
        'Verified ACCOUNTING sees class list data but no create/edit/delete controls on the same class row: PASS',
        'Verified DIRECTOR keeps create, edit, and delete controls on that same class row: PASS',
      ],
    });
  } catch (error) {
    await batch.finalize('FAIL', { error });
    throw error;
  }
});
