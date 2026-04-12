import { expect, test, type APIRequestContext, type Browser, type Locator, type Page } from '@playwright/test';
import { applySessionCookies, loginAsRole } from './support/auth';
import { createBatchEvidenceContext } from './support/orchestrator';

const APP_BASE_URL =
  process.env['PLAYWRIGHT_BASE_URL'] ||
  process.env['E2E_BASE_URL'] ||
  'http://localhost:4200';

const API_ORIGIN_PATTERN = 'https?://(?:localhost|127\\.0\\.0\\.1):3000';
const STUDENTS_API = new RegExp(`${API_ORIGIN_PATTERN}/students(?:\\?.*)?$`);
const STUDENT_API = new RegExp(`${API_ORIGIN_PATTERN}/students/([^/?]+)(?:\\?.*)?$`);
const USERS_PARENTS_API = new RegExp(`${API_ORIGIN_PATTERN}/users/parents(?:\\?.*)?$`);

type ParentUser = {
  _id: string;
  userCode: string;
  email: string;
  fullName: string;
  role: 'PARENT';
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
  parentUsers?: ParentUser[];
  parentName: string;
  parentPhone: string;
  faceImage: string;
};

type StudentState = {
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

function dedupeIds(values: unknown[]): string[] {
  return values
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .filter((value, index, all) => all.indexOf(value) === index);
}

function buildState(): StudentState {
  const ownerParent: ParentUser = {
    _id: 'parent-b03-owner-001',
    userCode: 'PH-OWN-001',
    email: 'owner.parent@example.com',
    fullName: 'Parent Owner Alpha',
    role: 'PARENT',
    phone: '0901000001',
  };
  const secondaryParentOne: ParentUser = {
    _id: 'parent-b03-secondary-002',
    userCode: 'PH-SEC-002',
    email: 'secondary.beta@example.com',
    fullName: 'Parent Secondary Beta',
    role: 'PARENT',
    phone: '0902000002',
  };
  const secondaryParentTwo: ParentUser = {
    _id: 'parent-b03-secondary-003',
    userCode: 'PH-SEC-003',
    email: 'secondary.gamma@example.com',
    fullName: 'Parent Secondary Gamma',
    role: 'PARENT',
    phone: '0903000003',
  };

  return {
    parents: [secondaryParentTwo, ownerParent, secondaryParentOne],
    students: [
      {
        _id: 'student-b03-multi-parent-001',
        studentCode: 'HS-B03-MULTI-001',
        fullName: 'Hoc sinh Multi Parent',
        age: 10,
        studentBirthMonth: 5,
        parentBirthMonth: 8,
        parentUserId: ownerParent._id,
        parentUserIds: [ownerParent._id, secondaryParentOne._id, secondaryParentTwo._id],
        parentUsers: [secondaryParentOne, ownerParent, secondaryParentTwo],
        parentName: ownerParent.fullName,
        parentPhone: ownerParent.phone,
        faceImage: '/uploads/faces/b03-multi-parent.png',
      },
    ],
    patchCalls: [],
  };
}

async function openStudents(
  browser: Browser,
  request: APIRequestContext,
  scenario: string,
) {
  const batch = await createBatchEvidenceContext(browser, {
    batchId: 'B03',
    scenario,
  });
  await batch.page.addInitScript(() => {
    window.localStorage.setItem('school_mgmt_sidebar_collapsed', 'false');
  });
  const directorSession = await loginAsRole(request, 'director');
  await applySessionCookies(batch.page, directorSession);
  return batch;
}

async function gotoStudents(page: Page): Promise<void> {
  await page.goto(appUrl('/app/students'));
  await page.waitForLoadState('domcontentloaded');
}

async function installStudentsRoutes(page: Page, state: StudentState): Promise<void> {
  await page.route(USERS_PARENTS_API, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(clone(state.parents)),
    });
  });

  await page.route(STUDENTS_API, async (route) => {
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

    const match = route.request().url().match(STUDENT_API);
    const studentId = match?.[1] || '';
    const payload = (route.request().postDataJSON() || {}) as Record<string, unknown>;
    state.patchCalls.push({ studentId, payload: clone(payload) });

    const currentStudent = state.students.find((student) => student._id === studentId);
    if (!currentStudent) {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Student not found' }),
      });
      return;
    }

    const nextPrimaryParentId = String(payload['parentUserId'] || currentStudent.parentUserId || '').trim();
    const nextLinkedParentIds = dedupeIds(
      Array.isArray(payload['parentUserIds'])
        ? payload['parentUserIds'] as unknown[]
        : [nextPrimaryParentId, ...(currentStudent.parentUserIds || [])],
    );
    const orderedParentIds = dedupeIds([nextPrimaryParentId, ...nextLinkedParentIds]);
    const nextPrimaryParent =
      state.parents.find((parent) => parent._id === nextPrimaryParentId) ||
      state.parents.find((parent) => parent._id === currentStudent.parentUserId) ||
      null;

    const updatedStudent: StudentItem = {
      ...currentStudent,
      ...clone(payload),
      _id: currentStudent._id,
      parentUserId: nextPrimaryParentId || currentStudent.parentUserId,
      parentUserIds: orderedParentIds,
      parentUsers: orderedParentIds
        .map((parentId) => state.parents.find((parent) => parent._id === parentId))
        .filter((parent): parent is ParentUser => !!parent),
      parentName: String(payload['parentName'] || nextPrimaryParent?.fullName || currentStudent.parentName),
      parentPhone: String(payload['parentPhone'] || nextPrimaryParent?.phone || currentStudent.parentPhone),
    };

    state.students = state.students.map((student) => (
      student._id === studentId ? updatedStudent : student
    ));

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(clone(updatedStudent)),
    });
  });
}

async function selectedOptionTexts(locator: Locator): Promise<string[]> {
  return locator.evaluate((node) =>
    Array.from((node as HTMLSelectElement).selectedOptions).map((option) => option.textContent?.trim() || ''),
  );
}

test.describe.configure({ mode: 'serial', timeout: 120_000 });
test.setTimeout(120_000);

test('B03 student multi-parent renders primary owner and secondary parents correctly in list and edit form', async ({ browser, request }) => {
  const state = buildState();
  const batch = await openStudents(browser, request, 'student_multi_parent_render');

  try {
    await installStudentsRoutes(batch.page, state);
    await gotoStudents(batch.page);

    await expect(batch.page.getByRole('heading', { name: 'Quan ly hoc sinh' })).toBeVisible();
    const studentRow = batch.page.locator('table.data tbody tr').filter({ hasText: 'HS-B03-MULTI-001' }).first();
    await expect(studentRow).toBeVisible();
    await expect(studentRow).toContainText('Parent Owner Alpha');
    await expect(studentRow).toContainText('PH phu: PH-SEC-002 - Parent Secondary Beta | PH-SEC-003 - Parent Secondary Gamma');
    await expect(studentRow).toContainText('0901000001');
    await expect(studentRow).toContainText('PH phu: 0902000002 | 0903000003');
    await batch.step('student-multi-parent-list-render');

    await studentRow.getByRole('button', { name: 'Sua' }).click();
    const modal = batch.page.locator('.modal-backdrop .modal').first();
    await expect(modal).toBeVisible();
    await expect(modal.locator('select[name="parentUserId"]')).toHaveValue('parent-b03-owner-001');
    await expect(modal.locator('input[name="parentName"]')).toHaveValue('Parent Owner Alpha');
    await expect(modal.locator('input[name="parentPhone"]')).toHaveValue('0901000001');

    const secondarySelect = modal.locator('select[name="secondaryParentUserIds"]');
    await expect(selectedOptionTexts(secondarySelect)).resolves.toEqual([
      'PH-SEC-002 - Parent Secondary Beta',
      'PH-SEC-003 - Parent Secondary Gamma',
    ]);
    await batch.step('student-multi-parent-edit-form');

    await batch.finalize('PASS', {
      extraLines: [
        'Verified /app/students list keeps the current owner parent on the primary line even when parentUsers arrives in a different order.',
        'Verified the UI renders secondary parents and secondary phones separately under `PH phu`, instead of overwriting the owner row.',
        'Verified the edit form keeps primary parent, secondary multi-select values, and owner name/phone synchronized for the same student.',
      ],
    });
  } catch (error) {
    await batch.finalize('FAIL', { error });
    throw error;
  }
});

test('B03 student multi-parent save preserves secondary links and does not overwrite current owner', async ({ browser, request }) => {
  const state = buildState();
  const batch = await openStudents(browser, request, 'student_multi_parent_save_preserve');

  try {
    await installStudentsRoutes(batch.page, state);
    await gotoStudents(batch.page);

    const studentRow = batch.page.locator('table.data tbody tr').filter({ hasText: 'HS-B03-MULTI-001' }).first();
    await studentRow.getByRole('button', { name: 'Sua' }).click();

    const modal = batch.page.locator('.modal-backdrop .modal').first();
    await expect(modal).toBeVisible();
    await modal.locator('input[name="fullName"]').fill('Hoc sinh Multi Parent Da Sua');
    await modal.locator('select[name="secondaryParentUserIds"]').selectOption([
      { label: 'PH-SEC-002 - Parent Secondary Beta' },
      { label: 'PH-SEC-003 - Parent Secondary Gamma' },
    ]);
    await modal.locator('button[type="submit"]').click();
    await expect(batch.page.locator('.modal-backdrop')).toHaveCount(0);

    expect(state.patchCalls).toHaveLength(1);
    expect(state.patchCalls[0]).toEqual({
      studentId: 'student-b03-multi-parent-001',
      payload: {
        studentCode: 'HS-B03-MULTI-001',
        fullName: 'Hoc sinh Multi Parent Da Sua',
        age: 10,
        parentName: 'Parent Owner Alpha',
        parentPhone: '0901000001',
        faceImage: '/uploads/faces/b03-multi-parent.png',
        parentUserId: 'parent-b03-owner-001',
        parentUserIds: [
          'parent-b03-owner-001',
          'parent-b03-secondary-002',
          'parent-b03-secondary-003',
        ],
        studentBirthMonth: 5,
        parentBirthMonth: 8,
      },
    });
    expect(state.patchCalls[0].payload).not.toHaveProperty('secondaryParentUserIds');
    await batch.step('student-multi-parent-patch-payload');

    const updatedRow = batch.page.locator('table.data tbody tr').filter({ hasText: 'HS-B03-MULTI-001' }).first();
    await expect(updatedRow).toContainText('Hoc sinh Multi Parent Da Sua');
    await expect(updatedRow).toContainText('Parent Owner Alpha');
    await expect(updatedRow).toContainText('PH phu: PH-SEC-002 - Parent Secondary Beta | PH-SEC-003 - Parent Secondary Gamma');

    await updatedRow.getByRole('button', { name: 'Sua' }).click();
    const updatedModal = batch.page.locator('.modal-backdrop .modal').first();
    await expect(updatedModal.locator('select[name="parentUserId"]')).toHaveValue('parent-b03-owner-001');
    await expect(updatedModal.locator('input[name="parentName"]')).toHaveValue('Parent Owner Alpha');
    await expect(updatedModal.locator('input[name="parentPhone"]')).toHaveValue('0901000001');
    await expect(selectedOptionTexts(updatedModal.locator('select[name="secondaryParentUserIds"]'))).resolves.toEqual([
      'PH-SEC-002 - Parent Secondary Beta',
      'PH-SEC-003 - Parent Secondary Gamma',
    ]);
    await batch.step('student-multi-parent-reload-preserved');

    await batch.finalize('PASS', {
      extraLines: [
        'Verified save submits the true backend contract: `parentUserId` stays on the owner and `parentUserIds` keeps the full linked-parent set.',
        'Verified the browser payload does not leak the UI-only `secondaryParentUserIds` field into `PATCH /students/:id`.',
        'Verified reload after save keeps the same primary owner plus both secondary links in list and edit form, so a normal edit does not drop linked parents.',
      ],
    });
  } catch (error) {
    await batch.finalize('FAIL', { error });
    throw error;
  }
});
