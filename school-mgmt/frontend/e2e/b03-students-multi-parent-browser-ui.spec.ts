import { expect, test, type APIRequestContext, type Browser, type Page } from '@playwright/test';
import { applySessionCookies, createBatchEvidenceContext, loginAsRole, type BatchEvidenceSession } from './support';

const APP_BASE_URL =
  process.env['PLAYWRIGHT_BASE_URL'] ||
  process.env['E2E_BASE_URL'] ||
  'http://localhost:4200';

const API_ORIGIN_PATTERN = 'https?://(?:localhost|127\\.0\\.0\\.1):3000';
const USERS_ME_API = new RegExp(`${API_ORIGIN_PATTERN}/users/me(?:\\?.*)?$`);
const USERS_PARENTS_API = new RegExp(`${API_ORIGIN_PATTERN}/users/parents(?:\\?.*)?$`);
const STUDENTS_API = new RegExp(`${API_ORIGIN_PATTERN}/students(?:\\?.*)?$`);
const STUDENT_API = new RegExp(`${API_ORIGIN_PATTERN}/students/([^/]+)(?:\\?.*)?$`);

type AuthPayload = {
  _id: string;
  email: string;
  role: string;
  fullName: string;
  userCode?: string;
};

type ParentUser = {
  _id: string;
  userCode: string;
  email: string;
  fullName: string;
  role: string;
  phone: string;
};

type StudentItem = {
  _id: string;
  studentCode: string;
  fullName: string;
  age: number;
  studentBirthMonth?: number | null;
  parentBirthMonth?: number | null;
  parentUserId?: string;
  parentUserIds?: string[];
  secondaryParentUserIds?: string[];
  parentUsers?: ParentUser[];
  parentName: string;
  parentPhone: string;
  faceImage: string;
};

type State = {
  parents: ParentUser[];
  students: StudentItem[];
  patchCalls: Array<{ studentId: string; payload: Record<string, unknown> }>;
};

function appUrl(path: string): string {
  return new URL(path, APP_BASE_URL).toString();
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function buildState(): State {
  const parents: ParentUser[] = [
    {
      _id: 'parent-b03-multi-001',
      userCode: 'PH001',
      email: 'parent.multi.alpha@example.com',
      fullName: 'Phu huynh Multi Alpha',
      role: 'PARENT',
      phone: '0901111111',
    },
    {
      _id: 'parent-b03-multi-002',
      userCode: 'PH002',
      email: 'parent.multi.beta@example.com',
      fullName: 'Phu huynh Multi Beta',
      role: 'PARENT',
      phone: '0902222222',
    },
    {
      _id: 'parent-b03-multi-003',
      userCode: 'PH003',
      email: 'parent.multi.gamma@example.com',
      fullName: 'Phu huynh Multi Gamma',
      role: 'PARENT',
      phone: '0903333333',
    },
  ];

  const students: StudentItem[] = [
    {
      _id: 'student-b03-multi-001',
      studentCode: 'HS-B03-MULTI-001',
      fullName: 'Hoc sinh Multi Parent',
      age: 9,
      studentBirthMonth: 3,
      parentBirthMonth: 8,
      parentUserId: parents[0]._id,
      parentUserIds: [parents[0]._id, parents[1]._id, parents[2]._id],
      secondaryParentUserIds: [parents[1]._id, parents[2]._id],
      parentUsers: [parents[0], parents[1], parents[2]],
      parentName: parents[0].fullName,
      parentPhone: parents[0].phone,
      faceImage: '/uploads/faces/b03-multi-parent.png',
    },
  ];

  return {
    parents,
    students,
    patchCalls: [],
  };
}

async function openStudents(
  browser: Browser,
  request: APIRequestContext,
): Promise<BatchEvidenceSession> {
  const batch = await createBatchEvidenceContext(browser, {
    batchId: 'B03',
    scenario: 'students_multi_parent',
  });
  const directorSession = await loginAsRole(request, 'director');
  await applySessionCookies(batch.page, directorSession);
  return batch;
}

async function installRoutes(page: Page, state: State, actor: AuthPayload): Promise<void> {
  await page.route(USERS_ME_API, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(clone(actor)),
    });
  });

  await page.route(USERS_PARENTS_API, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(clone(state.parents)),
    });
  });

  await page.route(STUDENTS_API, async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(clone(state.students)),
    });
  });

  await page.route(STUDENT_API, async (route) => {
    if (route.request().method() !== 'PATCH') {
      await route.fallback();
      return;
    }

    const studentId = route.request().url().match(/\/students\/([^/?#]+)(?:[?#].*)?$/)?.[1] || '';
    const payload = route.request().postDataJSON() as Record<string, unknown>;
    state.patchCalls.push({ studentId, payload: clone(payload) });

    const nextPrimaryId = String(payload['parentUserId'] || '').trim();
    const nextSecondaryIds = Array.isArray(payload['secondaryParentUserIds'])
      ? payload['secondaryParentUserIds'].map((id) => String(id || '').trim()).filter(Boolean)
      : [];
    const nextStudent = state.students[0];
    const nextPrimary = state.parents.find((parent) => parent._id === nextPrimaryId) || state.parents[0];
    const nextSecondaryParents = nextSecondaryIds
      .map((id) => state.parents.find((parent) => parent._id === id))
      .filter((parent): parent is ParentUser => !!parent);

    state.students = state.students.map((student) =>
      student._id !== studentId
        ? student
        : {
            ...student,
            studentCode: String(payload['studentCode'] || student.studentCode),
            fullName: String(payload['fullName'] || student.fullName),
            age: Number(payload['age'] || student.age),
            studentBirthMonth: payload['studentBirthMonth'] === undefined
              ? student.studentBirthMonth
              : Number(payload['studentBirthMonth']),
            parentBirthMonth: payload['parentBirthMonth'] === undefined
              ? student.parentBirthMonth
              : Number(payload['parentBirthMonth']),
            parentUserId: nextPrimary._id,
            parentUserIds: [nextPrimary._id, ...nextSecondaryIds],
            secondaryParentUserIds: nextSecondaryIds,
            parentUsers: [nextPrimary, ...nextSecondaryParents],
            parentName: nextPrimary.fullName,
            parentPhone: nextPrimary.phone,
            faceImage: String(payload['faceImage'] || student.faceImage),
          },
    );

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(clone(state.students.find((student) => student._id === studentId) || nextStudent)),
    });
  });
}

test.use({
  trace: 'off',
  video: 'on',
});

test('B03 students multi-parent keeps linked parents visible in list and edit form', async ({ browser, request }) => {
  const state = buildState();
  const batch = await openStudents(browser, request);
  const actor: AuthPayload = {
    _id: 'director-b03-multi-001',
    email: 'director.multi@example.com',
    role: 'DIRECTOR',
    fullName: 'Director Multi Parent',
    userCode: 'GD-B03',
  };

  try {
    await installRoutes(batch.page, state, actor);

    await batch.page.goto(appUrl('/app/students'));
    await batch.page.waitForLoadState('domcontentloaded');
    await expect(batch.page.getByRole('heading', { name: 'Quan ly hoc sinh' })).toBeVisible();

    const row = batch.page.locator('tbody tr').filter({ hasText: 'HS-B03-MULTI-001' }).first();
    await expect(row).toBeVisible();
    await expect(row).toContainText('Phu huynh Multi Alpha');
    await expect(row).toContainText('Phu huynh Multi Beta');
    await expect(row).toContainText('Phu huynh Multi Gamma');
    await expect(row).toContainText('0901111111');
    await expect(row).toContainText('0902222222');
    await expect(row).toContainText('0903333333');
    await batch.step('students-multi-parent-list');

    await row.getByRole('button', { name: 'Sua' }).click();
    const modal = batch.page.locator('.modal');
    await expect(modal).toBeVisible();
    await expect(modal.locator('select[name="parentUserId"]')).toHaveValue('parent-b03-multi-001');
    await expect(modal.locator('select[name="secondaryParentUserIds"] option:checked')).toHaveCount(2);
    await expect(modal.locator('select[name="secondaryParentUserIds"]')).toContainText('Phu huynh Multi Beta');
    await expect(modal.locator('select[name="secondaryParentUserIds"]')).toContainText('Phu huynh Multi Gamma');
    await modal.locator('input[name="fullName"]').fill('Hoc sinh Multi Parent Updated');
    await modal.getByRole('button', { name: 'Luu' }).click();

    expect(state.patchCalls).toHaveLength(1);
    expect(state.patchCalls[0]).toMatchObject({
      studentId: 'student-b03-multi-001',
      payload: {
        studentCode: 'HS-B03-MULTI-001',
        fullName: 'Hoc sinh Multi Parent Updated',
        parentUserId: 'parent-b03-multi-001',
        secondaryParentUserIds: ['parent-b03-multi-002', 'parent-b03-multi-003'],
      },
    });

    await expect(batch.page.locator('.modal-backdrop')).toHaveCount(0);
    const updatedRow = batch.page.locator('tbody tr').filter({ hasText: 'HS-B03-MULTI-001' }).first();
    await expect(updatedRow).toBeVisible();
    await expect(updatedRow).toContainText('Hoc sinh Multi Parent Updated');
    await expect(updatedRow).toContainText('Phu huynh Multi Beta');
    await expect(updatedRow).toContainText('Phu huynh Multi Gamma');
    await batch.step('students-multi-parent-updated-list');

    await batch.finalize('PASS', {
      extraLines: [
        'Verified the student list row surfaces the full linked-parent set without collapsing to a single owner.',
        'Verified the edit modal keeps the primary parent plus both secondary parent links selected before save.',
        'Verified the PATCH payload preserves secondaryParentUserIds and the reloaded row still shows all linked parents after update.',
      ],
    });
  } catch (error) {
    await batch.finalize('FAIL', { error });
    throw error;
  }
});
