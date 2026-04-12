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
const PENDING_APPROVALS_API = new RegExp(`${API_ORIGIN_PATTERN}/pending-approvals(?:\\?.*)?$`);
const PENDING_APPROVALS_SUMMARY_API = new RegExp(`${API_ORIGIN_PATTERN}/pending-approvals/summary(?:\\?.*)?$`);
const APPROVE_CLASS_API = new RegExp(`${API_ORIGIN_PATTERN}/classes/class-teacher-swap-001/pending-sale-update/approve(?:\\?.*)?$`);
const CLASSES_API = new RegExp(`${API_ORIGIN_PATTERN}/classes(?:\\?.*)?$`);
const USERS_DIRECTORY_API = new RegExp(`${API_ORIGIN_PATTERN}/users/directory(?:\\?.*)?$`);
const TEACHERS_API = new RegExp(`${API_ORIGIN_PATTERN}/teachers(?:\\?.*)?$`);
const STUDENTS_API = new RegExp(`${API_ORIGIN_PATTERN}/students(?:\\?.*)?$`);
const PRODUCTS_API = new RegExp(`${API_ORIGIN_PATTERN}/products(?:\\?.*)?$`);
const SESSIONS_API = new RegExp(`${API_ORIGIN_PATTERN}/sessions(?:\\?.*)?$`);
const SESSION_STATS_API = new RegExp(`${API_ORIGIN_PATTERN}/sessions/stats(?:\\?.*)?$`);
const SESSION_DETAIL_API = new RegExp(`${API_ORIGIN_PATTERN}/sessions/session-teacher-swap-001(?:\\?.*)?$`);

type HarnessState = {
  pending: boolean;
};

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

function buildPendingPayload(state: HarnessState) {
  return {
    summary: {
      totalPending: Number(state.pending),
      pendingPayrolls: 0,
      pendingInvoices: 0,
      pendingTopUps: 0,
      pendingTeachers: 0,
      pendingClassUpdates: Number(state.pending),
      pendingSessionChangeRequests: 0,
      openTickets: 0,
    },
    payrolls: [],
    invoices: [],
    topUps: [],
    teachers: [],
    classes: state.pending
      ? [
          {
            _id: 'class-teacher-swap-001',
            code: 'CLS-SWAP-001',
            name: 'Lop Doi Giao Vien',
            sale: { _id: 'sale-swap-001', fullName: 'Sale Swap' },
            pendingSaleUpdate: {
              status: 'PENDING',
              requestedBy: { _id: 'sale-swap-001', fullName: 'Sale Swap' },
              requestedAt: '2026-04-10T10:00:00.000Z',
              requestedChanges: {
                teacherId: 'teacher-new-001',
                teacherPayPerSession: 150000,
              },
              changeSummary: [
                {
                  field: 'teacherId',
                  label: 'Giao vien',
                  beforeValue: 'Teacher Cu',
                  afterValue: 'Teacher Moi',
                },
                {
                  field: 'teacherPayPerSession',
                  label: 'Luong GV/buoi',
                  beforeValue: '120.000 VND',
                  afterValue: '150.000 VND',
                },
              ],
            },
          },
        ]
      : [],
    sessionChanges: [],
  };
}

function buildClassesPayload(state: HarnessState) {
  return [
    {
      _id: 'class-teacher-swap-001',
      code: 'CLS-SWAP-001',
      name: 'Lop Doi Giao Vien',
      classMode: 'ONLINE',
      teacher: {
        _id: state.pending ? 'teacher-old-001' : 'teacher-new-001',
        fullName: state.pending ? 'Teacher Cu' : 'Teacher Moi',
        email: state.pending ? 'teacher.old@example.com' : 'teacher.new@example.com',
      },
      sale: {
        _id: 'sale-swap-001',
        fullName: 'Sale Swap',
        email: 'sale.swap@example.com',
      },
      students: [
        {
          _id: 'student-swap-001',
          fullName: 'Hoc sinh Doi GV',
          studentCode: 'HS-SWAP-001',
        },
      ],
      pricePerSession: 420000,
      teacherPayPerSession: state.pending ? 120000 : 150000,
      baseDuration: 60,
      sessionDuration: 60,
      actualPricePerSession: 420000,
      actualTeacherPayPerSession: state.pending ? 120000 : 150000,
      revenuePerStudent: 0,
      teacherSalaryCost: 0,
      pendingSaleUpdate: state.pending
        ? {
            status: 'PENDING',
            requestedBy: { _id: 'sale-swap-001', fullName: 'Sale Swap' },
            requestedAt: '2026-04-10T10:00:00.000Z',
            requestedChanges: {
              teacherId: 'teacher-new-001',
              teacherPayPerSession: 150000,
            },
            changeSummary: [
              {
                field: 'teacherId',
                label: 'Giao vien',
                beforeValue: 'Teacher Cu',
                afterValue: 'Teacher Moi',
              },
            ],
          }
        : null,
      editHistory: state.pending
        ? []
        : [
            {
              editedAt: '2026-04-10T10:10:00.000Z',
              editedByName: 'Director Pending Approvals',
              editedByRole: 'DIRECTOR',
              action: 'APPROVED',
              requestType: 'GENERAL',
              changes: [
                {
                  field: 'teacherId',
                  label: 'Giao vien',
                  beforeValue: 'Teacher Cu',
                  afterValue: 'Teacher Moi',
                },
                {
                  field: 'teacherPayPerSession',
                  label: 'Luong GV/buoi',
                  beforeValue: '120.000 VND',
                  afterValue: '150.000 VND',
                },
              ],
              note: 'Phe duyet doi giao vien va cap nhat luong GV.',
            },
          ],
    },
  ];
}

function buildTeachersPayload() {
  return [
    {
      _id: 'teacher-profile-old-001',
      userId: {
        _id: 'teacher-old-001',
        fullName: 'Teacher Cu',
        email: 'teacher.old@example.com',
      },
      managedSales: [],
      subjects: ['Toan'],
      grades: ['Lop 7'],
      teachingMode: 'ONLINE',
      locations: [],
      qualifications: [],
      yearsOfExperience: 4,
      availability: [],
      pricePerSession: 120000,
      status: 'ACTIVE',
      rating: 4.6,
      totalReviews: 12,
      totalSessions: 48,
      activeClasses: 2,
    },
    {
      _id: 'teacher-profile-new-001',
      userId: {
        _id: 'teacher-new-001',
        fullName: 'Teacher Moi',
        email: 'teacher.new@example.com',
      },
      managedSales: [],
      subjects: ['Toan'],
      grades: ['Lop 7'],
      teachingMode: 'ONLINE',
      locations: [],
      qualifications: [],
      yearsOfExperience: 7,
      availability: [],
      pricePerSession: 150000,
      status: 'ACTIVE',
      rating: 4.9,
      totalReviews: 25,
      totalSessions: 91,
      activeClasses: 4,
    },
  ];
}

function buildStudentsPayload() {
  return [
    {
      _id: 'student-swap-001',
      studentCode: 'HS-SWAP-001',
      fullName: 'Hoc sinh Doi GV',
      age: 12,
      parentName: 'Phu huynh Doi GV',
      parentPhone: '0901112233',
      faceImage: '/uploads/faces/student-swap-001.png',
    },
  ];
}

function buildSessionsPayload(state: HarnessState) {
  return {
    data: [
      {
        _id: 'session-teacher-swap-001',
        classId: {
          _id: 'class-teacher-swap-001',
          code: 'CLS-SWAP-001',
          name: 'Lop Doi Giao Vien',
        },
        studentId: {
          _id: 'student-swap-001',
          fullName: 'Hoc sinh Doi GV',
          studentCode: 'HS-SWAP-001',
        },
        teacherId: {
          _id: state.pending ? 'teacher-old-001' : 'teacher-new-001',
          fullName: state.pending ? 'Teacher Cu' : 'Teacher Moi',
        },
        scheduledDate: '2026-04-12',
        scheduledStartTime: '18:00',
        scheduledEndTime: '19:00',
        durationMinutes: 60,
        amountCharged: 420000,
        teacherPayout: state.pending ? 120000 : 150000,
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
}

function buildSessionDetailPayload(state: HarnessState) {
  return {
    _id: 'session-teacher-swap-001',
    classId: {
      _id: 'class-teacher-swap-001',
      code: 'CLS-SWAP-001',
      name: 'Lop Doi Giao Vien',
    },
    studentId: {
      _id: 'student-swap-001',
      fullName: 'Hoc sinh Doi GV',
      studentCode: 'HS-SWAP-001',
    },
    teacherId: {
      _id: state.pending ? 'teacher-old-001' : 'teacher-new-001',
      fullName: state.pending ? 'Teacher Cu' : 'Teacher Moi',
    },
    scheduledDate: '2026-04-12',
    scheduledStartTime: '18:00',
    scheduledEndTime: '19:00',
    durationMinutes: 60,
    amountCharged: 420000,
    teacherPayout: state.pending ? 120000 : 150000,
    status: 'SCHEDULED',
    isPaid: false,
    isTeacherPaid: false,
    editHistory: state.pending
      ? []
      : [
          {
            editedAt: '2026-04-10T10:10:00.000Z',
            editedByName: 'Director Pending Approvals',
            editedByRole: 'DIRECTOR',
            changes: [
              {
                field: 'teacherId',
                label: 'Giao vien',
                beforeValue: 'Teacher Cu',
                afterValue: 'Teacher Moi',
              },
              {
                field: 'teacherPayout',
                label: 'Luong GV',
                beforeValue: '120.000 VND',
                afterValue: '150.000 VND',
              },
            ],
          },
        ],
  };
}

async function installRoutes(page: Page): Promise<{
  getApproveCallCount: () => number;
}> {
  const state: HarnessState = {
    pending: true,
  };
  let approveCallCount = 0;

  await page.route(PENDING_APPROVALS_API, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(buildPendingPayload(state)),
    });
  });

  await page.route(PENDING_APPROVALS_SUMMARY_API, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ totalPending: Number(state.pending) }),
    });
  });

  await page.route(APPROVE_CLASS_API, async (route) => {
    approveCallCount += 1;
    state.pending = false;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    });
  });

  await page.route(CLASSES_API, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(clone(buildClassesPayload(state))),
    });
  });

  await page.route(USERS_DIRECTORY_API, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          _id: 'sale-swap-001',
          fullName: 'Sale Swap',
          email: 'sale.swap@example.com',
          role: 'SALE',
        },
      ]),
    });
  });

  await page.route(TEACHERS_API, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(clone(buildTeachersPayload())),
    });
  });

  await page.route(STUDENTS_API, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(clone(buildStudentsPayload())),
    });
  });

  await page.route(PRODUCTS_API, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });

  await page.route(SESSIONS_API, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(buildSessionsPayload(state)),
    });
  });

  await page.route(SESSION_STATS_API, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        totalSessions: 1,
        totalRevenue: 420000,
        totalTeacherCost: state.pending ? 120000 : 150000,
        byStatus: {
          SCHEDULED: {
            count: 1,
            totalCharged: 420000,
            totalPayout: state.pending ? 120000 : 150000,
          },
        },
      }),
    });
  });

  await page.route(SESSION_DETAIL_API, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(buildSessionDetailPayload(state)),
    });
  });

  return {
    getApproveCallCount: () => approveCallCount,
  };
}

test.use({
  trace: 'off',
  video: 'on',
});

test('B05 class teacher swap approval propagates to classes row and sessions detail without stale teacher data', async ({
  browser,
  page,
  request,
}) => {
  const batch = await openBatch(browser, 'teacher_swap_propagation_browser');

  try {
    const routes = await installRoutes(page);

    await page.addInitScript(() => {
      const originalSetInterval = window.setInterval.bind(window);
      window.setInterval = ((handler: TimerHandler, timeout?: number, ...args: unknown[]) => {
        const normalizedTimeout = timeout === 60000 ? 150 : timeout;
        return originalSetInterval(handler, normalizedTimeout, ...args);
      }) as typeof window.setInterval;
    });

    await signInAs(page, request, 'director');

    await page.goto(appUrl('/app/pending-approvals?tab=classes'));
    await page.waitForLoadState('domcontentloaded');

    const pendingRow = page.getByTestId('pending-class-row-class-teacher-swap-001');
    await expect(page.getByTestId('pending-tab-classes')).toBeVisible();
    await expect(pendingRow).toBeVisible();
    await expect(pendingRow).toContainText('Teacher Cu -> Teacher Moi');
    await expect(pendingRow).toContainText('120.000 VND -> 150.000 VND');
    await batch.step('pending-class-teacher-swap-visible');

    await pendingRow.getByTestId('pending-class-approve-class-teacher-swap-001').click();

    await expect.poll(routes.getApproveCallCount).toBe(1);
    await expect(pendingRow).toHaveCount(0);
    await expect(page.getByTestId('pending-empty-classes')).toBeVisible();
    await expect(page.getByTestId('pending-summary-classes')).toContainText('0');
    await batch.step('pending-class-teacher-swap-approved');

    await page.goto(appUrl('/app/classes'));
    await page.waitForLoadState('domcontentloaded');

    const classRow = page.getByTestId('class-row-class-teacher-swap-001');
    await expect(classRow).toBeVisible();
    await expect(classRow).toContainText('Teacher Moi');
    await expect(classRow).not.toContainText('Sale dang cho duyet sua lop');
    await batch.step('classes-row-reloaded-with-new-teacher');

    await classRow.getByTestId('class-edit-class-teacher-swap-001').click();
    await expect(page.getByRole('heading', { name: 'Chinh sua lop hoc' })).toBeVisible();
    const classHistory = page.locator('.class-history');
    await expect(classHistory).toContainText('Director Pending Approvals');
    await expect(classHistory).toContainText('Teacher Cu -> Teacher Moi');
    await expect(classHistory).toContainText('120.000 VND -> 150.000 VND');
    await page.getByRole('button', { name: 'Huy' }).click();
    await batch.step('classes-history-shows-old-and-new-teacher');

    await page.goto(appUrl('/app/sessions'));
    await page.waitForLoadState('domcontentloaded');

    const sessionRow = page.getByTestId('session-row-session-teacher-swap-001');
    await expect(sessionRow).toBeVisible();
    await expect(sessionRow).toContainText('Teacher Moi');
    await expect(sessionRow).toContainText('150.000');
    await batch.step('sessions-row-reloaded-with-new-teacher');

    await sessionRow.getByTestId('sessions-view-detail').click();
    const detailModal = page.locator('.modal.modal-lg');
    await expect(detailModal).toBeVisible();
    await expect(detailModal).toContainText('Teacher Moi');
    const sessionHistory = detailModal.locator('.history-card');
    await expect(sessionHistory).toContainText('Director Pending Approvals');
    await expect(sessionHistory).toContainText('Teacher Cu -> Teacher Moi');
    await expect(sessionHistory).toContainText('120.000 VND -> 150.000 VND');
    await batch.step('sessions-detail-history-shows-old-and-new-teacher');

    await batch.finalize('PASS', {
      extraLines: [
        'Verified pending class teacher-swap row shows exact old/new teacher and payout values before approval: PASS',
        'Verified director approval clears the pending row and drops classes pending count to 0: PASS',
        'Verified /app/classes reloads with the new teacher on the class row and approved change history in the edit modal: PASS',
        'Verified /app/sessions row and detail modal both reflect the approved teacher swap without stale teacher data: PASS',
      ],
    });
  } catch (error) {
    await batch.finalize('FAIL', { error });
    throw error;
  }
});
