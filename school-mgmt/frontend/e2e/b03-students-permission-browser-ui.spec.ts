import { expect, test, type APIRequestContext, type Browser, type Page } from '@playwright/test';
import { applySessionCookies, createBatchEvidenceContext, loginAsRole, type BatchEvidenceSession, type DemoRole } from './support';

const APP_BASE_URL =
  process.env['PLAYWRIGHT_BASE_URL'] ||
  process.env['E2E_BASE_URL'] ||
  'http://localhost:4200';

const API_ORIGIN_PATTERN = 'https?://(?:localhost|127\\.0\\.0\\.1):3000';
const STUDENTS_API = new RegExp(`${API_ORIGIN_PATTERN}/students(?:\\?.*)?$`);
const USERS_PARENTS_API = new RegExp(`${API_ORIGIN_PATTERN}/users/parents(?:\\?.*)?$`);

type StudentItem = {
  _id: string;
  studentCode: string;
  fullName: string;
  age: number;
  studentBirthMonth?: number | null;
  parentBirthMonth?: number | null;
  parentUserId?: string;
  parentName: string;
  parentPhone: string;
  faceImage: string;
};

type ParentUser = {
  _id: string;
  userCode: string;
  email: string;
  fullName: string;
  role: string;
  phone: string;
};

type RoleExpectation = {
  createVisible: boolean;
  editVisible: boolean;
  deleteVisible: boolean;
};

function appUrl(path: string): string {
  return new URL(path, APP_BASE_URL).toString();
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

async function openStudentsPermissionMatrix(
  browser: Browser,
  request: APIRequestContext,
): Promise<BatchEvidenceSession> {
  const batch = await createBatchEvidenceContext(browser, {
    batchId: 'B03',
    scenario: 'students_permission_matrix',
  });
  const directorSession = await loginAsRole(request, 'director');
  await applySessionCookies(batch.page, directorSession);
  return batch;
}

async function installStudentsRoutes(page: Page, students: StudentItem[], parents: ParentUser[]): Promise<void> {
  await page.route(STUDENTS_API, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(clone(students)),
    });
  });

  await page.route(USERS_PARENTS_API, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(clone(parents)),
    });
  });
}

async function signInAs(page: Page, request: APIRequestContext, role: DemoRole): Promise<void> {
  await page.context().clearCookies();
  const session = await loginAsRole(request, role);
  await applySessionCookies(page, session);
}

async function assertRoleView(
  batch: BatchEvidenceSession,
  request: APIRequestContext,
  role: DemoRole,
  expectation: RoleExpectation,
): Promise<void> {
  await signInAs(batch.page, request, role);
  await batch.page.goto(appUrl('/app/students'));
  await batch.page.waitForLoadState('domcontentloaded');

  await expect(batch.page).toHaveURL(/\/app\/students$/);
  await expect(batch.page.getByRole('heading', { name: 'Quan ly hoc sinh' })).toBeVisible();
  await expect(batch.page.locator('table.data')).toBeVisible();
  const studentRow = batch.page.locator('tbody tr').filter({ hasText: 'HS-B03-PERM-001' }).first();
  await expect(studentRow).toBeVisible();
  await expect(studentRow).toContainText('Hoc sinh Permission Matrix');
  await expect(studentRow).toContainText('Phu huynh Permission Matrix');

  if (expectation.createVisible) {
    await expect(batch.page.getByRole('button', { name: '+ Them hoc sinh' })).toBeVisible();
  } else {
    await expect(batch.page.getByRole('button', { name: '+ Them hoc sinh' })).toHaveCount(0);
  }

  if (expectation.editVisible) {
    await expect(studentRow.getByRole('button', { name: 'Sua' })).toBeVisible();
  } else {
    await expect(studentRow.getByRole('button', { name: 'Sua' })).toHaveCount(0);
  }

  if (expectation.deleteVisible) {
    await expect(studentRow.getByRole('button', { name: 'Xoa' })).toBeVisible();
  } else {
    await expect(studentRow.getByRole('button', { name: 'Xoa' })).toHaveCount(0);
  }

  await batch.step(`students-permission-${role}`);
}

test.use({
  trace: 'off',
  video: 'on',
});

test('B03 students permission matrix keeps accounting read-only while ops and director retain allowed actions', async ({ browser, request }) => {
  const students: StudentItem[] = [
    {
      _id: 'student-b03-perm-001',
      studentCode: 'HS-B03-PERM-001',
      fullName: 'Hoc sinh Permission Matrix',
      age: 10,
      studentBirthMonth: 3,
      parentBirthMonth: 8,
      parentUserId: 'parent-b03-perm-001',
      parentName: 'Phu huynh Permission Matrix',
      parentPhone: '0904444444',
      faceImage: '/uploads/faces/permission-matrix.png',
    },
  ];
  const parents: ParentUser[] = [
    {
      _id: 'parent-b03-perm-001',
      userCode: 'PH-PERM-001',
      email: 'parent.permission@example.com',
      fullName: 'Phu huynh Permission Matrix',
      role: 'PARENT',
      phone: '0904444444',
    },
  ];

  const batch = await openStudentsPermissionMatrix(browser, request);

  try {
    await installStudentsRoutes(batch.page, students, parents);

    await assertRoleView(batch, request, 'accounting', {
      createVisible: false,
      editVisible: false,
      deleteVisible: false,
    });

    await assertRoleView(batch, request, 'ops', {
      createVisible: true,
      editVisible: true,
      deleteVisible: false,
    });

    await assertRoleView(batch, request, 'director', {
      createVisible: true,
      editVisible: true,
      deleteVisible: true,
    });

    await batch.finalize('PASS', {
      extraLines: [
        'Verified /app/students stays accessible to ACCOUNTING per route guard while the page remains read-only.',
        'Verified OPS keeps create and edit actions but still hides delete.',
        'Verified DIRECTOR keeps the full create, edit, and delete surface on the same student row.',
      ],
    });
  } catch (error) {
    await batch.finalize('FAIL', { error });
    throw error;
  }
});
