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
const CLASSES_API = new RegExp(`${API_ORIGIN_PATTERN}/attendance/classes-with-students(?:\\?.*)?$`);
const ATTENDANCE_CLASS_API = new RegExp(
  `${API_ORIGIN_PATTERN}/attendance/class/class-attendance-001(?:\\?.*)?$`,
);
const BULK_MARK_API = new RegExp(`${API_ORIGIN_PATTERN}/attendance/bulk-mark(?:\\?.*)?$`);

const FIXTURE_DATE = formatLocalDateInput(new Date());
const CLASS_ID = 'class-attendance-001';
const STUDENT_ALPHA_ID = 'student-attendance-001';
const STUDENT_BRAVO_ID = 'student-attendance-002';
const STUDENT_CHARLIE_ID = 'student-attendance-003';

type BulkAttendanceBody = {
  classId: string;
  date: string;
  attendances: Array<{
    studentId: string;
    status: string | null;
    notes: string;
  }>;
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

async function loadAttendancePage(
  page: Page,
  request: APIRequestContext,
  role: DemoRole,
): Promise<void> {
  await signInAs(page, request, role);
  await page.goto(appUrl('/app/attendance'));
  await page.waitForLoadState('domcontentloaded');
  await expect(page.getByTestId('attendance-date-input')).toHaveValue(FIXTURE_DATE);
  await page.getByTestId('attendance-class-select').selectOption(CLASS_ID);
  await expect(page.getByTestId(`attendance-student-card-${STUDENT_ALPHA_ID}`)).toBeVisible();
  await expect(page.getByTestId(`attendance-student-card-${STUDENT_BRAVO_ID}`)).toBeVisible();
  await expect(page.getByTestId(`attendance-student-card-${STUDENT_CHARLIE_ID}`)).toBeVisible();
}

async function installAttendanceRoutes(page: Page): Promise<{
  getBulkBodies: () => BulkAttendanceBody[];
  getLoadCount: () => number;
}> {
  const classPayload = [
    {
      classId: CLASS_ID,
      classCode: 'CLS-ATT-001',
      className: 'Lop Attendance Browser',
      studentCount: 3,
      students: [
        {
          studentId: STUDENT_ALPHA_ID,
          fullName: 'Hoc sinh Alpha',
          studentCode: 'HS-ATT-001',
          age: 12,
          parentName: 'Phu huynh Alpha',
        },
        {
          studentId: STUDENT_BRAVO_ID,
          fullName: 'Hoc sinh Bravo',
          studentCode: 'HS-ATT-002',
          age: 11,
          parentName: 'Phu huynh Bravo',
        },
        {
          studentId: STUDENT_CHARLIE_ID,
          fullName: 'Hoc sinh Charlie',
          studentCode: 'HS-ATT-003',
          age: 10,
          parentName: 'Phu huynh Charlie',
        },
      ],
    },
  ];

  const state = {
    statuses: {
      [STUDENT_ALPHA_ID]: null as string | null,
      [STUDENT_BRAVO_ID]: null as string | null,
      [STUDENT_CHARLIE_ID]: null as string | null,
    },
  };

  const bulkBodies: BulkAttendanceBody[] = [];
  let loadCount = 0;

  await page.route(CLASSES_API, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(clone(classPayload)),
    });
  });

  await page.route(ATTENDANCE_CLASS_API, async (route) => {
    loadCount += 1;
    const url = new URL(route.request().url());
    const date = url.searchParams.get('date') || FIXTURE_DATE;

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        class: {
          _id: CLASS_ID,
          name: 'Lop Attendance Browser',
          code: 'CLS-ATT-001',
        },
        date,
        attendanceList: [
          {
            student: {
              _id: STUDENT_ALPHA_ID,
              fullName: 'Hoc sinh Alpha',
              age: 12,
              parentName: 'Phu huynh Alpha',
            },
            attendance: {
              classId: CLASS_ID,
              studentId: STUDENT_ALPHA_ID,
              date,
              status: state.statuses[STUDENT_ALPHA_ID],
              notes: '',
            },
          },
          {
            student: {
              _id: STUDENT_BRAVO_ID,
              fullName: 'Hoc sinh Bravo',
              age: 11,
              parentName: 'Phu huynh Bravo',
            },
            attendance: {
              classId: CLASS_ID,
              studentId: STUDENT_BRAVO_ID,
              date,
              status: state.statuses[STUDENT_BRAVO_ID],
              notes: '',
            },
          },
          {
            student: {
              _id: STUDENT_CHARLIE_ID,
              fullName: 'Hoc sinh Charlie',
              age: 10,
              parentName: 'Phu huynh Charlie',
            },
            attendance: {
              classId: CLASS_ID,
              studentId: STUDENT_CHARLIE_ID,
              date,
              status: state.statuses[STUDENT_CHARLIE_ID],
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

    await new Promise((resolve) => setTimeout(resolve, 250));
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: body.attendances,
        errors: [],
        sessionsCreated: 2,
        totalProcessed: body.attendances.length,
        totalErrors: 0,
      }),
    });
  });

  return {
    getBulkBodies: () => clone(bulkBodies),
    getLoadCount: () => loadCount,
  };
}

test.use({
  trace: 'off',
  video: 'on',
});

test('B05 attendance per-student present absent late keeps the exact mixed-status payload and persisted reload state', async ({
  browser,
  page,
  request,
}) => {
  const batch = await openBatch(browser, 'attendance_present_absent_late_browser');

  try {
    const routes = await installAttendanceRoutes(page);
    await loadAttendancePage(page, request, 'director');

    const saveButton = page.getByTestId('attendance-save-button');

    await expect(page.getByTestId('attendance-mark-all-present')).toBeVisible();
    await expect(saveButton).toBeDisabled();
    await expect(page.locator('.attendance-summary .stat.present')).toContainText('Co mat: 0');
    await expect(page.locator('.attendance-summary .stat.absent')).toContainText('Vang mat: 0');
    await expect(page.locator('.attendance-summary .stat.late')).toContainText('Di muon: 0');
    await expect(page.locator('.attendance-summary .stat.not-marked')).toContainText(
      'Chua diem danh: 3',
    );
    await batch.step('attendance-mixed-status-pristine');

    await page.getByTestId(`attendance-present-${STUDENT_ALPHA_ID}`).click();
    await page.getByTestId(`attendance-absent-${STUDENT_BRAVO_ID}`).click();
    await page.getByTestId(`attendance-late-${STUDENT_CHARLIE_ID}`).click();

    await expect(saveButton).toBeEnabled();
    await expect(page.getByTestId(`attendance-present-${STUDENT_ALPHA_ID}`)).toHaveClass(/active/);
    await expect(page.getByTestId(`attendance-absent-${STUDENT_BRAVO_ID}`)).toHaveClass(/active/);
    await expect(page.getByTestId(`attendance-late-${STUDENT_CHARLIE_ID}`)).toHaveClass(/active/);
    await expect(page.locator('.attendance-summary .stat.present')).toContainText('Co mat: 1');
    await expect(page.locator('.attendance-summary .stat.absent')).toContainText('Vang mat: 1');
    await expect(page.locator('.attendance-summary .stat.late')).toContainText('Di muon: 1');
    await expect(page.locator('.attendance-summary .stat.not-marked')).toContainText(
      'Chua diem danh: 0',
    );
    await batch.step('attendance-mixed-status-selected');

    await saveButton.click();

    await expect(saveButton).toHaveText('Dang luu...');
    await expect(saveButton).toBeDisabled();
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
        {
          studentId: STUDENT_BRAVO_ID,
          status: 'ABSENT',
          notes: '',
        },
        {
          studentId: STUDENT_CHARLIE_ID,
          status: 'LATE',
          notes: '',
        },
      ],
    });

    await expect.poll(routes.getLoadCount).toBe(2);
    await expect(saveButton).toHaveText('Luu diem danh');
    await expect(saveButton).toBeDisabled();
    await expect(page.getByTestId(`attendance-present-${STUDENT_ALPHA_ID}`)).toHaveClass(/active/);
    await expect(page.getByTestId(`attendance-absent-${STUDENT_BRAVO_ID}`)).toHaveClass(/active/);
    await expect(page.getByTestId(`attendance-late-${STUDENT_CHARLIE_ID}`)).toHaveClass(/active/);
    await expect(page.locator('.attendance-summary .stat.present')).toContainText('Co mat: 1');
    await expect(page.locator('.attendance-summary .stat.absent')).toContainText('Vang mat: 1');
    await expect(page.locator('.attendance-summary .stat.late')).toContainText('Di muon: 1');
    await expect(page.locator('.attendance-summary .stat.not-marked')).toContainText(
      'Chua diem danh: 0',
    );
    await expect(page.locator('.error')).toHaveCount(0);
    await batch.step('attendance-mixed-status-reload');

    await batch.finalize('PASS', {
      extraLines: [
        'Verified per-student controls now support exact PRESENT, ABSENT, and LATE selections without collapsing ABSENT/LATE back to unmarked: PASS',
        'Verified exact POST /attendance/bulk-mark payload preserves one PRESENT, one ABSENT, and one LATE student in roster order: PASS',
        'Verified post-save reload keeps the persisted mixed-status buttons and summary counts instead of normalizing non-PRESENT states away: PASS',
      ],
    });
  } catch (error) {
    await batch.finalize('FAIL', {
      extraLines: [error instanceof Error ? error.stack || error.message : String(error)],
    });
    throw error;
  }
});
