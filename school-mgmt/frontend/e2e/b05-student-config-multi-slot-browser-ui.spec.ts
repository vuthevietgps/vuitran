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
  `${API_ORIGIN_PATTERN}/classes/class-config-multi-001/students/student-config-multi-001/config(?:\\?.*)?$`,
);
const USERS_DIRECTORY_API = new RegExp(`${API_ORIGIN_PATTERN}/users/directory(?:\\?.*)?$`);
const TEACHERS_API = new RegExp(`${API_ORIGIN_PATTERN}/teachers(?:\\?.*)?$`);
const STUDENTS_API = new RegExp(`${API_ORIGIN_PATTERN}/students(?:\\?.*)?$`);
const PRODUCTS_API = new RegExp(`${API_ORIGIN_PATTERN}/products(?:\\?.*)?$`);
const SESSION_STATS_API = new RegExp(`${API_ORIGIN_PATTERN}/sessions/stats(?:\\?.*)?$`);
const SESSIONS_API = new RegExp(`${API_ORIGIN_PATTERN}/sessions(?:\\?.*)?$`);
const SESSION_DETAIL_API = new RegExp(`${API_ORIGIN_PATTERN}/sessions/session-config-multi-001(?:\\?.*)?$`);

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

async function installRoutes(page: Page): Promise<{
  getClassesCallCount: () => number;
  getPatchedPayloads: () => Array<Record<string, unknown>>;
}> {
  const teacherInitial = {
    _id: 'teacher-config-multi-001',
    fullName: 'Teacher Chu Dao',
    email: 'teacher.multi.001@example.com',
    userCode: 'GV-M1',
  };
  const teacherUpdated = {
    _id: 'teacher-config-multi-002',
    fullName: 'Teacher Chuyen Slot',
    email: 'teacher.multi.002@example.com',
    userCode: 'GV-M2',
  };

  const originalClasses = [
    {
      _id: 'class-config-multi-001',
      name: 'Lop Multi Slot',
      code: 'CLS-MULTI-001',
      classMode: 'ONLINE',
      teacher: teacherInitial,
      students: [
        {
          _id: 'student-config-multi-001',
          fullName: 'Hoc sinh Multi Slot',
          studentCode: 'HS-MULTI-001',
        },
      ],
      pricePerSession: 450000,
      teacherPayPerSession: 260000,
      baseDuration: 60,
      sessionDuration: 60,
      actualPricePerSession: 450000,
      actualTeacherPayPerSession: 260000,
      totalSessions: 20,
      revenuePerStudent: 0,
      teacherSalaryCost: 0,
      studentConfigs: [],
    },
  ];

  const updatedClasses = [
    {
      _id: 'class-config-multi-001',
      name: 'Lop Multi Slot',
      code: 'CLS-MULTI-001',
      classMode: 'ONLINE',
      teacher: teacherInitial,
      students: [
        {
          _id: 'student-config-multi-001',
          fullName: 'Hoc sinh Multi Slot',
          studentCode: 'HS-MULTI-001',
        },
      ],
      pricePerSession: 450000,
      teacherPayPerSession: 260000,
      baseDuration: 60,
      sessionDuration: 60,
      actualPricePerSession: 450000,
      actualTeacherPayPerSession: 260000,
      totalSessions: 20,
      revenuePerStudent: 0,
      teacherSalaryCost: 0,
      studentConfigs: [
        {
          studentId: {
            _id: 'student-config-multi-001',
            fullName: 'Hoc sinh Multi Slot',
            studentCode: 'HS-MULTI-001',
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
              totalSessions: 20,
            },
            {
              slotIndex: 2,
              slotType: 'UPDATE',
              baseDuration: 60,
              sessionDuration: 90,
              totalSessions: 14,
            },
          ],
        },
      ],
    },
  ];

  const teacherProfiles = [
    {
      _id: 'teacher-profile-multi-001',
      userId: teacherInitial,
      managedSales: [],
      subjects: ['Toan'],
      grades: ['Lop 8'],
      teachingMode: 'ONLINE',
      locations: [],
      qualifications: [],
      yearsOfExperience: 5,
      availability: [],
      pricePerSession: 260000,
      status: 'ACTIVE',
      rating: 4.8,
      totalReviews: 18,
      totalSessions: 80,
      activeClasses: 3,
    },
    {
      _id: 'teacher-profile-multi-002',
      userId: teacherUpdated,
      managedSales: [],
      subjects: ['Toan'],
      grades: ['Lop 8'],
      teachingMode: 'ONLINE',
      locations: [],
      qualifications: [],
      yearsOfExperience: 7,
      availability: [],
      pricePerSession: 280000,
      status: 'ACTIVE',
      rating: 4.9,
      totalReviews: 25,
      totalSessions: 110,
      activeClasses: 4,
    },
  ];

  const students = [
    {
      _id: 'student-config-multi-001',
      studentCode: 'HS-MULTI-001',
      fullName: 'Hoc sinh Multi Slot',
      age: 14,
      parentName: 'Phu huynh Multi Slot',
      parentPhone: '0901888111',
      faceImage: '/uploads/faces/student-config-multi-001.png',
    },
  ];

  const sessionListPayload = {
    data: [
      {
        _id: 'session-config-multi-001',
        classId: {
          _id: 'class-config-multi-001',
          name: 'Lop Multi Slot',
          code: 'CLS-MULTI-001',
        },
        studentId: {
          _id: 'student-config-multi-001',
          fullName: 'Hoc sinh Multi Slot',
          studentCode: 'HS-MULTI-001',
        },
        teacherId: teacherUpdated,
        scheduledDate: '2026-04-15',
        scheduledStartTime: '18:30',
        scheduledEndTime: '20:00',
        durationMinutes: 90,
        amountCharged: 450000,
        teacherPayout: 280000,
        status: 'SCHEDULED',
        isPaid: false,
        isTeacherPaid: false,
      },
    ],
    meta: {
      totalPages: 1,
      total: 1,
      page: 1,
      limit: 20,
    },
  };

  const sessionDetailPayload = {
    _id: 'session-config-multi-001',
    classId: {
      _id: 'class-config-multi-001',
      name: 'Lop Multi Slot',
      code: 'CLS-MULTI-001',
    },
    studentId: {
      _id: 'student-config-multi-001',
      fullName: 'Hoc sinh Multi Slot',
      studentCode: 'HS-MULTI-001',
    },
    teacherId: teacherUpdated,
    scheduledDate: '2026-04-15',
    scheduledStartTime: '18:30',
    scheduledEndTime: '20:00',
    durationMinutes: 90,
    amountCharged: 450000,
    teacherPayout: 280000,
    status: 'SCHEDULED',
    isPaid: false,
    isTeacherPaid: false,
    editHistory: [
      {
        editedAt: '2026-04-14T09:00:00.000Z',
        editedByName: 'Director Classes',
        editedByRole: 'DIRECTOR',
        changes: [
          {
            field: 'teacherId',
            label: 'Giao vien',
            beforeValue: 'Teacher Chu Dao',
            afterValue: 'Teacher Chuyen Slot',
          },
          {
            field: 'durationMinutes',
            label: 'Thoi luong',
            beforeValue: '60 phut',
            afterValue: '90 phut',
          },
        ],
        durationSnapshot: {
          newDurationMinutes: 90,
          totalSessionsRemaining: 14,
          paidSessionsRemaining: 12,
          bonusSessionsRemaining: 2,
        },
      },
    ],
  };

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

  await page.route(SESSION_STATS_API, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        totalSessions: 1,
        totalRevenue: 450000,
        totalTeacherCost: 280000,
        byStatus: {
          SCHEDULED: {
            count: 1,
            totalCharged: 450000,
            totalPayout: 280000,
          },
        },
      }),
    });
  });

  await page.route(SESSIONS_API, async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(clone(sessionListPayload)),
    });
  });

  await page.route(SESSION_DETAIL_API, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(clone(sessionDetailPayload)),
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

test('B05 student config multi-slot state appears correctly in form, class detail, and sessions schedule after save', async ({ browser, page, request }) => {
  const batch = await openBatch(browser, 'student_config_multi_slot_browser');

  try {
    const routes = await installRoutes(page);

    await signInAs(page, request);
    await page.goto(appUrl('/app/classes'));
    await page.waitForLoadState('domcontentloaded');

    const configButton = page.getByTestId('class-student-config-class-config-multi-001-student-config-multi-001');
    await expect(page.getByTestId('class-student-teacher-summary-class-config-multi-001-student-config-multi-001')).toHaveText('GV1: Teacher Chu Dao');
    await expect(page.getByTestId('class-student-duration-summary-class-config-multi-001-student-config-multi-001')).toHaveText('Lan 1: 60 phut');

    await configButton.click();
    await expect(page.getByRole('heading', { name: 'Sua hoc sinh trong lop' })).toBeVisible();
    await page.locator('select[name="studentConfigTeacherId"]').selectOption('teacher-config-multi-002');
    await page.locator('select[name="studentConfigSessionDuration"]').selectOption({ label: '90 phut' });
    await page.getByRole('button', { name: 'Luu thay doi hoc sinh' }).click();

    await expect.poll(routes.getClassesCallCount).toBe(2);
    await expect.poll(() => routes.getPatchedPayloads().length).toBe(1);
    expect(routes.getPatchedPayloads()[0]).toEqual({
      teacherId: 'teacher-config-multi-002',
      sessionDuration: 90,
    });

    await expect(page.getByTestId('class-student-teacher-summary-class-config-multi-001-student-config-multi-001')).toHaveText('GV2: Teacher Chuyen Slot');
    await expect(page.getByTestId('class-student-duration-summary-class-config-multi-001-student-config-multi-001')).toHaveText('Lan 2: 90 phut');
    await expect(page.getByTestId('class-student-teacher-history-class-config-multi-001-student-config-multi-001')).toHaveText(
      'GV1: Teacher Chu Dao -> GV2: Teacher Chuyen Slot',
    );
    await expect(page.getByTestId('class-student-duration-history-class-config-multi-001-student-config-multi-001')).toHaveText(
      'Lan 1: 60 phut -> Lan 2: 90 phut',
    );
    await batch.step('student-config-class-detail-history');

    await configButton.click();
    await expect(page.locator('.slot-card').filter({ hasText: 'GV1' })).toContainText('Teacher Chu Dao');
    await expect(page.locator('.slot-card').filter({ hasText: 'GV2' })).toContainText('Teacher Chuyen Slot');
    await expect(page.locator('.slot-card').filter({ hasText: 'Lan 1' })).toContainText('60 phut');
    await expect(page.locator('.slot-card').filter({ hasText: 'Lan 2' })).toContainText('90 phut');
    await page.getByRole('button', { name: 'Huy' }).click();
    await batch.step('student-config-form-history');

    await page.goto(appUrl('/app/sessions'));
    await page.waitForLoadState('domcontentloaded');

    const sessionRow = page.getByTestId('session-row-session-config-multi-001');
    await expect(sessionRow).toBeVisible();
    await expect(sessionRow).toContainText('CLS-MULTI-001');
    await expect(sessionRow).toContainText('Hoc sinh Multi Slot');
    await expect(sessionRow).toContainText('Teacher Chuyen Slot');
    await sessionRow.getByTestId('sessions-view-detail').click();

    const detailModal = page.locator('.modal.modal-lg');
    await expect(detailModal).toBeVisible();
    await expect(detailModal.locator('.detail-grid')).toContainText('Teacher Chuyen Slot');
    await expect(detailModal.getByTestId('sessions-detail-duration')).toHaveText('90 phút');
    await batch.step('student-config-schedule-surface');

    await batch.finalize('PASS', {
      extraLines: [
        'Verified the form persists both GV2 and Lan 2 after save and reopen, not just the latest transient selections: PASS',
        'Verified the classes surface shows both current summaries and slot history on the targeted student row after reload: PASS',
        'Verified the sessions schedule surface reflects the updated teacher and 90-minute duration for the configured student after save: PASS',
      ],
    });
  } catch (error) {
    await batch.finalize('FAIL', { error });
    throw error;
  }
});
