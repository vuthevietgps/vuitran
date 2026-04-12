import { expect, test, type APIRequestContext, type Browser, type Page } from '@playwright/test';
import {
  applySessionCookies,
  createBatchEvidenceContext,
  extractAttendanceLink,
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
const ATTENDANCE_CLASSES_API = new RegExp(`${API_ORIGIN_PATTERN}/attendance/classes-with-students(?:\\?.*)?$`);
const ATTENDANCE_CLASS_API = new RegExp(`${API_ORIGIN_PATTERN}/attendance/class/class-coteach-001(?:\\?.*)?$`);
const BULK_MARK_API = new RegExp(`${API_ORIGIN_PATTERN}/attendance/bulk-mark(?:\\?.*)?$`);
const GENERATE_LINK_API = new RegExp(`${API_ORIGIN_PATTERN}/attendance/generate-link(?:\\?.*)?$`);
const SESSIONS_API = new RegExp(`${API_ORIGIN_PATTERN}/sessions(?:\\?.*)?$`);
const COMPLETE_API = new RegExp(`${API_ORIGIN_PATTERN}/sessions/session-coteach-report-001/complete(?:\\?.*)?$`);

const CLASS_ID = 'class-coteach-001';
const PRIMARY_TEACHER_ID = 'teacher-primary-001';
const ATTENDANCE_TEACHER_ID = 'teacher-attendance-001';
const REPORT_TEACHER_ID = 'teacher-report-001';
const STUDENT_ALPHA_ID = 'student-coteach-001';
const FIXTURE_DATE = formatLocalDateInput(new Date());

type ClassCreateBody = {
  name: string;
  code: string;
  teacherId: string;
  classMode: 'ONLINE' | 'OFFLINE';
  coTeachers?: Array<{
    teacherId: string;
    role: 'SUPPORT' | 'REPORT' | 'ATTENDANCE';
    canManageAttendance: boolean;
    canManageReports: boolean;
    canCreateLink: boolean;
  }>;
  studentIds?: string[];
  pricePerSession?: number;
  teacherPayPerStudent?: number;
  baseDuration?: number;
  sessionDuration?: number;
  revenuePerStudent?: number;
  teacherSalaryCost?: number;
};

type BulkAttendanceBody = {
  classId: string;
  date: string;
  attendances: Array<{
    studentId: string;
    status: string | null;
    notes: string;
  }>;
};

type GenerateLinkBody = {
  classId: string;
  studentId: string;
  date: string;
};

function appUrl(path: string): string {
  return new URL(path, APP_BASE_URL).toString();
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function formatLocalDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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

async function installClipboardHarness(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const state = {
      writes: [] as string[],
    };

    Object.defineProperty(window, '__attendanceClipboardState', {
      configurable: true,
      value: state,
    });

    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async (text: string) => {
          state.writes.push(String(text));
        },
      },
    });
  });
}

async function getClipboardWrites(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    [
      ...(
        window as Window & {
          __attendanceClipboardState: { writes: string[] };
        }
      ).__attendanceClipboardState.writes,
    ],
  );
}

async function captureSingleDialog(page: Page, action: () => Promise<void>): Promise<string> {
  const messages: string[] = [];
  const handler = async (dialog: { message: () => string; accept: () => Promise<void> }) => {
    messages.push(dialog.message());
    await dialog.accept();
  };

  page.on('dialog', handler);

  try {
    await action();
    await expect.poll(() => messages.length).toBe(1);
    return messages[0];
  } finally {
    page.off('dialog', handler);
  }
}

async function installClassCoTeachingRoutes(page: Page): Promise<{
  getCreateBodies: () => ClassCreateBody[];
  getClassesCallCount: () => number;
}> {
  const usersDirectory = [
    {
      _id: 'sale-manager-001',
      fullName: 'Sale Manager',
      email: 'sale.manager@example.com',
      role: 'SALE',
    },
  ];

  const teacherProfiles = [
    buildTeacherProfile(PRIMARY_TEACHER_ID, 'Teacher Primary', 'teacher.primary@example.com'),
    buildTeacherProfile(ATTENDANCE_TEACHER_ID, 'Teacher Attendance', 'teacher.attendance@example.com'),
    buildTeacherProfile(REPORT_TEACHER_ID, 'Teacher Report', 'teacher.report@example.com'),
  ];

  const students = [
    {
      _id: STUDENT_ALPHA_ID,
      studentCode: 'HS-COTEACH-001',
      fullName: 'Hoc sinh Co-teaching',
      age: 12,
      parentName: 'Phu huynh Co-teaching',
      parentPhone: '0901000001',
      faceImage: '/uploads/faces/student-coteach-001.png',
    },
  ];

  const products = [
    {
      _id: 'product-offline-001',
      code: 'PKG-OFFLINE-001',
      name: 'Goi Offline STEM',
      teachingMode: 'OFFLINE',
      isActive: true,
    },
  ];

  let classesCallCount = 0;
  const createBodies: ClassCreateBody[] = [];
  let createdClasses: any[] = [];

  await page.route(CLASSES_API, async (route) => {
    const request = route.request();
    if (request.method() === 'POST') {
      const body = request.postDataJSON() as ClassCreateBody;
      createBodies.push(clone(body));
      createdClasses = [
        {
          _id: CLASS_ID,
          name: body.name,
          code: body.code,
          classMode: 'OFFLINE',
          teacher: {
            _id: PRIMARY_TEACHER_ID,
            fullName: 'Teacher Primary',
            email: 'teacher.primary@example.com',
          },
          coTeachers: [
            {
              teacherId: {
                _id: ATTENDANCE_TEACHER_ID,
                fullName: 'Teacher Attendance',
                email: 'teacher.attendance@example.com',
                userCode: 'GV-ATT-001',
              },
              role: 'ATTENDANCE',
              canManageAttendance: true,
              canManageReports: false,
              canCreateLink: true,
            },
            {
              teacherId: {
                _id: REPORT_TEACHER_ID,
                fullName: 'Teacher Report',
                email: 'teacher.report@example.com',
                userCode: 'GV-REP-001',
              },
              role: 'REPORT',
              canManageAttendance: false,
              canManageReports: true,
              canCreateLink: false,
            },
          ],
          students: [
            {
              _id: STUDENT_ALPHA_ID,
              fullName: 'Hoc sinh Co-teaching',
              studentCode: 'HS-COTEACH-001',
            },
          ],
          studentConfigs: [],
          pricePerSession: 350000,
          teacherPayPerStudent: 180000,
          baseDuration: 70,
          sessionDuration: 70,
          actualPricePerSession: 350000,
          actualTeacherPayPerSession: 0,
          revenuePerStudent: 0,
          teacherSalaryCost: 0,
        },
      ];
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(clone(createdClasses[0])),
      });
      return;
    }

    classesCallCount += 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(clone(createdClasses)),
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
      body: JSON.stringify(clone(products)),
    });
  });

  return {
    getCreateBodies: () => clone(createBodies),
    getClassesCallCount: () => classesCallCount,
  };
}

async function installAttendanceRoutes(page: Page): Promise<{
  getBulkBodies: () => BulkAttendanceBody[];
  getLinkBodies: () => GenerateLinkBody[];
}> {
  const state = {
    statuses: {
      [STUDENT_ALPHA_ID]: null as string | null,
    },
  };
  const bulkBodies: BulkAttendanceBody[] = [];
  const linkBodies: GenerateLinkBody[] = [];

  await page.route(ATTENDANCE_CLASSES_API, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          classId: CLASS_ID,
          classCode: 'CLS-COTEACH-001',
          className: 'Lop Offline Co-teaching',
          studentCount: 1,
          students: [
            {
              studentId: STUDENT_ALPHA_ID,
              fullName: 'Hoc sinh Co-teaching',
              studentCode: 'HS-COTEACH-001',
              age: 12,
              parentName: 'Phu huynh Co-teaching',
            },
          ],
        },
      ]),
    });
  });

  await page.route(ATTENDANCE_CLASS_API, async (route) => {
    const url = new URL(route.request().url());
    const date = url.searchParams.get('date') || FIXTURE_DATE;

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        class: {
          _id: CLASS_ID,
          name: 'Lop Offline Co-teaching',
          code: 'CLS-COTEACH-001',
        },
        date,
        permissions: {
          canBulkEdit: true,
          canGenerateLink: true,
          blockedReason: null,
          substituteActive: false,
          substituteTeacherId: null,
          activeTeacherId: ATTENDANCE_TEACHER_ID,
        },
        attendanceList: [
          {
            student: {
              _id: STUDENT_ALPHA_ID,
              fullName: 'Hoc sinh Co-teaching',
              age: 12,
              parentName: 'Phu huynh Co-teaching',
            },
            attendance: {
              classId: CLASS_ID,
              studentId: STUDENT_ALPHA_ID,
              date,
              status: state.statuses[STUDENT_ALPHA_ID],
              notes: '',
            },
          },
        ],
      }),
    });
  });

  await page.route(BULK_MARK_API, async (route) => {
    const body = route.request().postDataJSON() as BulkAttendanceBody;
    bulkBodies.push(clone(body));
    for (const item of body.attendances) {
      state.statuses[item.studentId] = item.status;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: body.attendances,
        errors: [],
        sessionsCreated: 1,
        totalProcessed: body.attendances.length,
        totalErrors: 0,
        attendedCount: body.attendances.filter((item) => item.status === 'PRESENT').length,
      }),
    });
  });

  await page.route(GENERATE_LINK_API, async (route) => {
    const body = route.request().postDataJSON() as GenerateLinkBody;
    linkBodies.push(clone(body));
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        attendanceUrl: appUrl(`/student-attendance/${STUDENT_ALPHA_ID}-token`),
        expiresAt: '2026-04-12T10:00:00.000Z',
      }),
    });
  });

  return {
    getBulkBodies: () => clone(bulkBodies),
    getLinkBodies: () => clone(linkBodies),
  };
}

async function installReportRoutes(page: Page): Promise<{
  getCompleteBodies: () => Array<Record<string, string>>;
  getSessionsCallCount: () => number;
}> {
  const state = {
    sessions: [
      {
        _id: 'session-coteach-report-001',
        classId: {
          _id: CLASS_ID,
          code: 'CLS-COTEACH-001',
          name: 'Lop Offline Co-teaching',
        },
        studentId: {
          _id: STUDENT_ALPHA_ID,
          fullName: 'Hoc sinh Co-teaching',
          studentCode: 'HS-COTEACH-001',
        },
        teacherId: {
          _id: PRIMARY_TEACHER_ID,
          fullName: 'Teacher Primary',
          email: 'teacher.primary@example.com',
        },
        scheduledDate: '2026-04-11',
        scheduledStartTime: '18:00',
        scheduledEndTime: '19:10',
        attendedAt: '2026-04-11T11:05:00.000Z',
        amountCharged: 350000,
        teacherPayout: 0,
        durationMinutes: 70,
        status: 'SCHEDULED',
        hasTeachingReport: false,
      },
    ],
  };

  let sessionsCallCount = 0;
  const completeBodies: Array<Record<string, string>> = [];

  await page.route(CLASSES_API, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          _id: CLASS_ID,
          code: 'CLS-COTEACH-001',
          name: 'Lop Offline Co-teaching',
          classMode: 'OFFLINE',
          teacher: {
            _id: PRIMARY_TEACHER_ID,
            fullName: 'Teacher Primary',
          },
          coTeachers: [
            {
              teacherId: {
                _id: REPORT_TEACHER_ID,
                fullName: 'Teacher Report',
              },
              role: 'REPORT',
              canManageAttendance: false,
              canManageReports: true,
              canCreateLink: false,
            },
          ],
          students: [
            {
              _id: STUDENT_ALPHA_ID,
              fullName: 'Hoc sinh Co-teaching',
            },
          ],
        },
      ]),
    });
  });

  await page.route(SESSIONS_API, async (route) => {
    sessionsCallCount += 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: clone(state.sessions),
        meta: { totalPages: 1, total: state.sessions.length, page: 1, limit: 20 },
      }),
    });
  });

  await page.route(COMPLETE_API, async (route) => {
    completeBodies.push(route.request().postDataJSON() as Record<string, string>);
    state.sessions = state.sessions.map((session) =>
      session._id === 'session-coteach-report-001'
        ? {
            ...session,
            status: 'TEACHER_COMPLETED',
            hasTeachingReport: true,
          }
        : session,
    );
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    });
  });

  return {
    getCompleteBodies: () => clone(completeBodies),
    getSessionsCallCount: () => sessionsCallCount,
  };
}

function buildTeacherProfile(teacherId: string, fullName: string, email: string) {
  return {
    _id: `profile-${teacherId}`,
    userId: {
      _id: teacherId,
      fullName,
      email,
      userCode: teacherId.toUpperCase(),
    },
    managedSales: [],
    subjects: ['Khoa hoc'],
    grades: ['Lop 6'],
    teachingMode: 'OFFLINE',
    locations: [],
    qualifications: [],
    yearsOfExperience: 5,
    availability: [],
    pricePerSession: 180000,
    status: 'ACTIVE',
    rating: 4.9,
    totalReviews: 20,
    totalSessions: 88,
    activeClasses: 2,
  };
}

test.use({
  trace: 'off',
  video: 'on',
});

test('B05 offline co-teaching sends the exact assistant-teacher payload and renders role/permission summaries on the class row', async ({
  browser,
  page,
  request,
}) => {
  const batch = await openBatch(browser, 'offline_co_teaching_class_config_browser');

  try {
    const routes = await installClassCoTeachingRoutes(page);

    await signInAs(page, request, 'director');
    await page.goto(appUrl('/app/classes'));
    await page.waitForLoadState('domcontentloaded');

    await page.getByTestId('classes-create').click();
    await expect(page.getByRole('heading', { name: 'Them lop hoc' })).toBeVisible();

    await page.locator('input[name="name"]').fill('Lop Offline Co-teaching');
    await page.locator('select[name="classMode"]').selectOption('OFFLINE');
    await page.locator('input[name="codeSearch"]').fill('STEM');
    await page.locator('.dropdown-item').filter({ hasText: 'Goi Offline STEM' }).click();
    await page.locator('select[name="teacherId"]').selectOption(PRIMARY_TEACHER_ID);
    await page.locator('input[name="pricePerSession"]').fill('350000');
    await page.locator('input[name="teacherPayPerStudent"]').fill('180000');
    await expect(page.locator('select[name="baseDuration"] option:checked')).toHaveText('70 phut');
    await expect(page.locator('input[name="sessionDuration"]')).toHaveValue('70');
    await page.getByRole('button', { name: 'Them', exact: true }).click();

    await page.getByTestId('class-co-teacher-add').click();
    await page.getByTestId('class-co-teacher-teacher-0').selectOption(ATTENDANCE_TEACHER_ID);
    await page.getByTestId('class-co-teacher-add').click();
    await page.getByTestId('class-co-teacher-teacher-1').selectOption(REPORT_TEACHER_ID);

    await expect(page.locator('[data-testid="class-co-teacher-role-0"] option:checked')).toHaveText('GV phu diem danh');
    await expect(page.getByTestId('class-co-teacher-attendance-0')).toBeChecked();
    await expect(page.getByTestId('class-co-teacher-reports-0')).not.toBeChecked();
    await expect(page.getByTestId('class-co-teacher-link-0')).toBeChecked();

    await expect(page.locator('[data-testid="class-co-teacher-role-1"] option:checked')).toHaveText('GV phu bao cao');
    await expect(page.getByTestId('class-co-teacher-attendance-1')).not.toBeChecked();
    await expect(page.getByTestId('class-co-teacher-reports-1')).toBeChecked();
    await expect(page.getByTestId('class-co-teacher-link-1')).not.toBeChecked();

    await page.getByRole('button', { name: 'Luu' }).click();

    await expect.poll(() => routes.getCreateBodies().length).toBe(1);
    expect(routes.getCreateBodies()[0]).toEqual({
      name: 'Lop Offline Co-teaching',
      code: 'Goi Offline STEM',
      teacherId: PRIMARY_TEACHER_ID,
      coTeachers: [
        {
          teacherId: ATTENDANCE_TEACHER_ID,
          role: 'ATTENDANCE',
          canManageAttendance: true,
          canManageReports: false,
          canCreateLink: true,
        },
        {
          teacherId: REPORT_TEACHER_ID,
          role: 'REPORT',
          canManageAttendance: false,
          canManageReports: true,
          canCreateLink: false,
        },
      ],
      classMode: 'OFFLINE',
      studentIds: [STUDENT_ALPHA_ID],
      pricePerSession: 350000,
      teacherPayPerStudent: 180000,
      baseDuration: 70,
      sessionDuration: 70,
      revenuePerStudent: 0,
      teacherSalaryCost: 0,
    });

    const row = page.getByTestId(`class-row-${CLASS_ID}`);
    await expect.poll(routes.getClassesCallCount).toBeGreaterThan(1);
    await expect(row).toBeVisible();
    await expect(page.getByTestId(`class-primary-teacher-${CLASS_ID}`)).toContainText('Teacher Primary');
    await expect(page.getByTestId(`class-co-teacher-summary-${CLASS_ID}-0`)).toContainText('Teacher Attendance');
    await expect(page.getByTestId(`class-co-teacher-role-${CLASS_ID}-0`)).toHaveText('GV phu diem danh');
    await expect(page.getByTestId(`class-co-teacher-permissions-${CLASS_ID}-0`)).toHaveText('Diem danh · Tao link');
    await expect(page.getByTestId(`class-co-teacher-summary-${CLASS_ID}-1`)).toContainText('Teacher Report');
    await expect(page.getByTestId(`class-co-teacher-role-${CLASS_ID}-1`)).toHaveText('GV phu bao cao');
    await expect(page.getByTestId(`class-co-teacher-permissions-${CLASS_ID}-1`)).toHaveText('Bao cao');
    await batch.step('class-row-renders-co-teachers');

    await batch.finalize('PASS', {
      extraLines: [
        'Verified OFFLINE class creation keeps the primary teacher separate and sends only assistant coTeachers in the exact POST /classes payload: PASS',
        'Verified role presets map to ATTENDANCE and REPORT with strict permission flags instead of the legacy roleLabel/enabled shape: PASS',
        'Verified the reloaded class row surfaces GV chinh, both assistant names, and exact role/permission summaries after save: PASS',
      ],
    });
  } catch (error) {
    await batch.finalize('FAIL', { error });
    throw error;
  }
});

test('B05 attendance co-teacher can generate link and bulk-save attendance for the configured offline class', async ({
  browser,
  page,
  request,
}) => {
  const batch = await openBatch(browser, 'offline_co_teaching_attendance_permission_browser');

  try {
    const routes = await installAttendanceRoutes(page);
    await installClipboardHarness(page);

    await signInAs(page, request, 'teacher');
    await page.goto(appUrl('/app/attendance'));
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByTestId('attendance-date-input')).toHaveValue(FIXTURE_DATE);
    await page.getByTestId('attendance-class-select').selectOption(CLASS_ID);
    await expect(page.getByTestId(`attendance-student-card-${STUDENT_ALPHA_ID}`)).toBeVisible();
    await expect(page.getByTestId(`attendance-generate-link-${STUDENT_ALPHA_ID}`)).toBeVisible();
    await expect(page.getByTestId('attendance-mark-all-present')).toBeVisible();
    await expect(page.getByTestId('attendance-save-button')).toBeDisabled();

    const dialogMessage = await captureSingleDialog(page, async () => {
      await page.getByTestId(`attendance-generate-link-${STUDENT_ALPHA_ID}`).click();
    });
    await expect.poll(() => routes.getLinkBodies().length).toBe(1);
    expect(routes.getLinkBodies()[0]).toEqual({
      classId: CLASS_ID,
      studentId: STUDENT_ALPHA_ID,
      date: FIXTURE_DATE,
    });
    const { attendanceUrl } = extractAttendanceLink(dialogMessage);
    expect(attendanceUrl).toBe(appUrl(`/student-attendance/${STUDENT_ALPHA_ID}-token`));
    expect(await getClipboardWrites(page)).toEqual([attendanceUrl]);

    await page.getByTestId('attendance-mark-all-present').click();
    await expect(page.getByTestId(`attendance-present-${STUDENT_ALPHA_ID}`)).toHaveClass(/active/);
    await expect(page.getByTestId('attendance-save-button')).toBeEnabled();

    await page.getByTestId('attendance-save-button').click();
    await expect.poll(() => routes.getBulkBodies().length).toBe(1);
    expect(routes.getBulkBodies()[0]).toEqual({
      classId: CLASS_ID,
      date: FIXTURE_DATE,
      attendances: [
        {
          studentId: STUDENT_ALPHA_ID,
          status: 'PRESENT',
          notes: '',
        },
      ],
    });
    await batch.step('attendance-co-teacher-actions');

    await batch.finalize('PASS', {
      extraLines: [
        'Verified the attendance-configured co-teacher still sees both generate-link and bulk-attendance controls on the offline class: PASS',
        'Verified generate-link posts the exact classId/studentId/date payload and copies the exact attendance URL once: PASS',
        'Verified bulk attendance save posts the exact PRESENT payload for the configured student instead of degrading to view-only mode: PASS',
      ],
    });
  } catch (error) {
    await batch.finalize('FAIL', { error });
    throw error;
  }
});

test('B05 report co-teacher can complete the session report flow for the configured offline class', async ({
  browser,
  page,
  request,
}) => {
  const batch = await openBatch(browser, 'offline_co_teaching_report_permission_browser');

  try {
    const routes = await installReportRoutes(page);

    await signInAs(page, request, 'teacher');
    await page.goto(appUrl('/app/sessions'));
    await page.waitForLoadState('domcontentloaded');

    const row = page.getByTestId('session-row-session-coteach-report-001');
    await expect(row).toBeVisible();
    await expect(row).toContainText('CLS-COTEACH-001');
    await expect(row.getByTestId('sessions-complete-button')).toBeVisible();

    await row.getByTestId('sessions-complete-button').click();
    await expect(page.getByTestId('sessions-complete-topics')).toBeVisible();
    await page.getByTestId('sessions-complete-topics').fill('Bao cao dong day ve he mat troi');
    await page.getByTestId('sessions-complete-homework').fill('Hoan thanh worksheet ve hanh tinh');
    await page.getByTestId('sessions-complete-notes').fill('GV phu bao cao da tong hop noi dung buoi hoc');
    await page.getByTestId('sessions-complete-submit').click();

    await expect.poll(() => routes.getCompleteBodies().length).toBe(1);
    expect(routes.getCompleteBodies()[0]).toEqual({
      topicsCovered: 'Bao cao dong day ve he mat troi',
      homework: 'Hoan thanh worksheet ve hanh tinh',
      teacherNotes: 'GV phu bao cao da tong hop noi dung buoi hoc',
    });
    await expect.poll(routes.getSessionsCallCount).toBe(2);
    await expect(row).toContainText('GV hoàn thành');
    await batch.step('report-co-teacher-complete-session');

    await batch.finalize('PASS', {
      extraLines: [
        'Verified the report-configured co-teacher still sees the complete/report CTA on the offline class session row: PASS',
        'Verified the report completion payload stays exact for topicsCovered, homework, and teacherNotes: PASS',
        'Verified success reloads the session row to TEACHER_COMPLETED instead of leaving stale SCHEDULED state behind: PASS',
      ],
    });
  } catch (error) {
    await batch.finalize('FAIL', { error });
    throw error;
  }
});
