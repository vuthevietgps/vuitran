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
const CLASSES_API = new RegExp(`${API_ORIGIN_PATTERN}/attendance/classes-with-students(?:\\?.*)?$`);
const ATTENDANCE_CLASS_API = new RegExp(
  `${API_ORIGIN_PATTERN}/attendance/class/class-attendance-001(?:\\?.*)?$`,
);
const GENERATE_LINK_API = new RegExp(`${API_ORIGIN_PATTERN}/attendance/generate-link(?:\\?.*)?$`);

const FIXTURE_DATE = formatLocalDateInput(new Date());
const CLASS_ID = 'class-attendance-001';
const STUDENT_ALPHA_ID = 'student-attendance-001';
const STUDENT_BRAVO_ID = 'student-attendance-002';

type GenerateLinkBody = {
  classId: string;
  studentId: string;
  date: string;
};

type PermissionMode = 'primary-blocked' | 'substitute-allowed';

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
}

async function installAttendanceRoutes(
  page: Page,
  mode: PermissionMode,
): Promise<{ getLinkBodies: () => GenerateLinkBody[] }> {
  const linkBodies: GenerateLinkBody[] = [];

  await page.route(CLASSES_API, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          classId: CLASS_ID,
          classCode: 'CLS-ATT-001',
          className: 'Lop Attendance Browser',
          studentCount: 2,
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
          ],
        },
      ]),
    });
  });

  await page.route(ATTENDANCE_CLASS_API, async (route) => {
    const url = new URL(route.request().url());
    const date = url.searchParams.get('date') || FIXTURE_DATE;

    const permissions =
      mode === 'primary-blocked'
        ? {
            canBulkEdit: false,
            canGenerateLink: false,
            blockedReason:
              'Ngay nay da co giao vien day thay phu trach diem danh. Giao vien chinh khong duoc tao link diem danh.',
            substituteActive: true,
            substituteTeacherId: 'teacher-substitute-001',
            activeTeacherId: 'teacher-substitute-001',
          }
        : {
            canBulkEdit: false,
            canGenerateLink: true,
            blockedReason: null,
            substituteActive: true,
            substituteTeacherId: 'teacher-substitute-001',
            activeTeacherId: 'teacher-substitute-001',
          };

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
        permissions,
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
              status: null,
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
              status: null,
              notes: '',
            },
          },
        ],
      }),
    });
  });

  await page.route(GENERATE_LINK_API, async (route) => {
    const body = route.request().postDataJSON() as GenerateLinkBody;
    linkBodies.push(clone(body));

    const attendanceUrl = new URL(`/student-attendance/${body.studentId}-token`, APP_BASE_URL).toString();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        attendanceUrl,
        expiresAt: '2026-04-12T10:00:00.000Z',
      }),
    });
  });

  return {
    getLinkBodies: () => clone(linkBodies),
  };
}

test.use({
  trace: 'off',
  video: 'on',
});

test('B05 substitute attendance RBAC hides generate-link actions for the primary teacher on an active substitute day', async ({
  browser,
  page,
  request,
}) => {
  const batch = await openBatch(browser, 'substitute_attendance_primary_teacher_blocked_browser');

  try {
    await installAttendanceRoutes(page, 'primary-blocked');
    await loadAttendancePage(page, request, 'teacher');

    await expect(page.getByTestId('attendance-permission-note')).toContainText(
      'Ngay nay da co giao vien day thay phu trach diem danh. Giao vien chinh khong duoc tao link diem danh.',
    );
    await expect(page.getByTestId(`attendance-generate-link-${STUDENT_ALPHA_ID}`)).toHaveCount(0);
    await expect(page.getByTestId(`attendance-generate-link-${STUDENT_BRAVO_ID}`)).toHaveCount(0);
    await expect(page.getByTestId('attendance-mark-all-present')).toHaveCount(0);
    await expect(page.getByTestId('attendance-save-button')).toHaveCount(0);
    await batch.step('primary-teacher-blocked-by-substitute');

    await batch.finalize('PASS', {
      extraLines: [
        'Verified the primary teacher still loads the class roster for the selected date but sees no generate-link CTA once a substitute is active: PASS',
        'Verified the UI surfaces one explicit blocked-reason note instead of silently leaving stale teacher actions clickable: PASS',
      ],
    });
  } catch (error) {
    await batch.finalize('FAIL', {
      extraLines: [error instanceof Error ? error.stack || error.message : String(error)],
    });
    throw error;
  }
});

test('B05 substitute attendance RBAC lets the substitute teacher generate the exact attendance link payload on the same day', async ({
  browser,
  page,
  request,
}) => {
  const batch = await openBatch(browser, 'substitute_attendance_substitute_teacher_allowed_browser');

  try {
    const routes = await installAttendanceRoutes(page, 'substitute-allowed');
    await installClipboardHarness(page);
    await loadAttendancePage(page, request, 'teacher');

    await expect(page.getByTestId('attendance-permission-note')).toHaveCount(0);
    await expect(page.getByTestId(`attendance-generate-link-${STUDENT_ALPHA_ID}`)).toBeVisible();

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
    await batch.step('substitute-teacher-generate-link-allowed');

    await batch.finalize('PASS', {
      extraLines: [
        'Verified an active substitute teacher still sees the generate-link action when the assignment grants create-link permission: PASS',
        'Verified the substitute path posts the exact classId/studentId/date payload and copies the exact generated student attendance URL: PASS',
      ],
    });
  } catch (error) {
    await batch.finalize('FAIL', {
      extraLines: [error instanceof Error ? error.stack || error.message : String(error)],
    });
    throw error;
  }
});
