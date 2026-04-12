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
const BULK_MARK_API = new RegExp(`${API_ORIGIN_PATTERN}/attendance/bulk-mark(?:\\?.*)?$`);
const GENERATE_LINK_API = new RegExp(`${API_ORIGIN_PATTERN}/attendance/generate-link(?:\\?.*)?$`);

const FIXTURE_DATE = formatLocalDateInput(new Date());
const CLASS_ID = 'class-attendance-001';
const STUDENT_ALPHA_ID = 'student-attendance-001';
const STUDENT_BRAVO_ID = 'student-attendance-002';

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

type AttendanceHarness = {
  getBulkBodies: () => BulkAttendanceBody[];
  getLinkBodies: () => GenerateLinkBody[];
  getLoadCount: () => number;
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
      mode: 'resolve',
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
          if (state.mode === 'reject') {
            throw new Error('clipboard blocked');
          }
        },
      },
    });
  });
}

async function setClipboardMode(page: Page, mode: 'resolve' | 'reject'): Promise<void> {
  await page.evaluate((nextMode) => {
    (window as Window & {
      __attendanceClipboardState: { mode: string; writes: string[] };
    }).__attendanceClipboardState.mode = nextMode;
  }, mode);
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
    await page.waitForTimeout(150);
    expect(messages).toHaveLength(1);
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

async function installAttendanceRoutes(page: Page): Promise<AttendanceHarness> {
  const classPayload = [
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
  ];

  const state = {
    statuses: {
      [STUDENT_ALPHA_ID]: null as string | null,
      [STUDENT_BRAVO_ID]: null as string | null,
    },
  };

  const bulkBodies: BulkAttendanceBody[] = [];
  const linkBodies: GenerateLinkBody[] = [];
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
        attendedCount: body.attendances.filter((item) => item.status === 'PRESENT').length,
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
    getBulkBodies: () => clone(bulkBodies),
    getLinkBodies: () => clone(linkBodies),
    getLoadCount: () => loadCount,
  };
}

test.use({
  trace: 'off',
  video: 'on',
});

test('B05 attendance mark-all-present only enables save when dirty and reloads persisted statuses after bulk save', async ({
  browser,
  page,
  request,
}) => {
  const batch = await openBatch(browser, 'attendance_mark_all_save_browser');

  try {
    const routes = await installAttendanceRoutes(page);

    await loadAttendancePage(page, request, 'director');

    const saveButton = page.getByTestId('attendance-save-button');
    const markAllButton = page.getByTestId('attendance-mark-all-present');

    await expect(markAllButton).toBeVisible();
    await expect(saveButton).toBeVisible();
    await expect(saveButton).toBeDisabled();
    await expect(page.locator('.attendance-summary .stat.present')).toContainText('Co mat: 0');
    await expect(page.locator('.attendance-summary .stat.not-marked')).toContainText(
      'Chua diem danh: 2',
    );
    expect(routes.getBulkBodies()).toHaveLength(0);
    await batch.step('attendance-loaded-pristine');

    await markAllButton.click();

    await expect(saveButton).toBeEnabled();
    await expect(page.locator('.attendance-summary .stat.present')).toContainText('Co mat: 2');
    await expect(page.locator('.attendance-summary .stat.not-marked')).toContainText(
      'Chua diem danh: 0',
    );
    await expect(page.getByTestId(`attendance-present-${STUDENT_ALPHA_ID}`)).toHaveClass(/active/);
    await expect(page.getByTestId(`attendance-present-${STUDENT_BRAVO_ID}`)).toHaveClass(/active/);
    await batch.step('attendance-mark-all-present');

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
          status: 'PRESENT',
          notes: '',
        },
      ],
    });

    await expect.poll(routes.getLoadCount).toBe(2);
    await expect(page.locator('.attendance-summary .stat.present')).toContainText('Co mat: 2');
    await expect(page.locator('.attendance-summary .stat.not-marked')).toContainText(
      'Chua diem danh: 0',
    );
    await expect(saveButton).toHaveText('Luu diem danh');
    await expect(saveButton).toBeDisabled();
    await expect(page.locator('.error')).toHaveCount(0);
    await batch.step('attendance-bulk-save-reload');

    await batch.finalize('PASS', {
      extraLines: [
        'Verified attendance save stays disabled until a real attendance mutation occurs: PASS',
        'Verified Mark all present updates every loaded student card and summary counts before save: PASS',
        'Verified exact POST /attendance/bulk-mark payload and post-save reload preserve persisted PRESENT statuses: PASS',
      ],
    });
  } catch (error) {
    await batch.finalize('FAIL', {
      extraLines: [error instanceof Error ? error.stack || error.message : String(error)],
    });
    throw error;
  }
});

test('B05 attendance generate-link copies the exact student attendance URL and shows one clear success dialog', async ({
  browser,
  page,
  request,
}) => {
  const batch = await openBatch(browser, 'attendance_generate_link_copy_success_browser');

  try {
    const routes = await installAttendanceRoutes(page);
    await installClipboardHarness(page);

    await loadAttendancePage(page, request, 'teacher');

    await expect(page.getByTestId('attendance-mark-all-present')).toHaveCount(0);
    await expect(page.getByTestId('attendance-save-button')).toHaveCount(0);

    await setClipboardMode(page, 'resolve');
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
    expect(dialogMessage).toContain('Da tao link diem danh cho Hoc sinh Alpha.');
    expect(dialogMessage).toContain('Link da duoc copy vao clipboard:');
    expect(dialogMessage).toContain('Han su dung:');
    expect(await getClipboardWrites(page)).toEqual([attendanceUrl]);
    await expect(page.locator('.error')).toHaveCount(0);
    await batch.step('attendance-link-copy-success');

    await batch.finalize('PASS', {
      extraLines: [
        'Verified teacher attendance screen still exposes generate-link without bulk-edit controls: PASS',
        'Verified the generated attendance URL is copied exactly once to clipboard and echoed in one success dialog: PASS',
        'Verified success feedback names the student and keeps the page free of inline error noise: PASS',
      ],
    });
  } catch (error) {
    await batch.finalize('FAIL', {
      extraLines: [error instanceof Error ? error.stack || error.message : String(error)],
    });
    throw error;
  }
});

test('B05 attendance generate-link falls back to manual-copy guidance once when clipboard write fails', async ({
  browser,
  page,
  request,
}) => {
  const batch = await openBatch(browser, 'attendance_generate_link_copy_fallback_browser');

  try {
    const routes = await installAttendanceRoutes(page);
    await installClipboardHarness(page);

    await loadAttendancePage(page, request, 'teacher');

    await setClipboardMode(page, 'reject');
    const dialogMessage = await captureSingleDialog(page, async () => {
      await page.getByTestId(`attendance-generate-link-${STUDENT_BRAVO_ID}`).click();
    });

    await expect.poll(() => routes.getLinkBodies().length).toBe(1);
    expect(routes.getLinkBodies()[0]).toEqual({
      classId: CLASS_ID,
      studentId: STUDENT_BRAVO_ID,
      date: FIXTURE_DATE,
    });

    const { attendanceUrl } = extractAttendanceLink(dialogMessage);
    expect(attendanceUrl).toBe(appUrl(`/student-attendance/${STUDENT_BRAVO_ID}-token`));
    expect(dialogMessage).toContain('Da tao link diem danh cho Hoc sinh Bravo.');
    expect(dialogMessage).toContain('Khong the tu dong copy. Vui long copy link thu cong:');
    expect(dialogMessage).toContain('Han su dung:');
    expect(await getClipboardWrites(page)).toEqual([attendanceUrl]);
    await expect(page.locator('.error')).toHaveCount(0);
    await batch.step('attendance-link-copy-fallback');

    await batch.finalize('PASS', {
      extraLines: [
        'Verified clipboard failure does not suppress the generated attendance URL: PASS',
        'Verified the fallback path shows one clear manual-copy dialog instead of duplicate alerts: PASS',
        'Verified the page keeps inline error state empty because URL generation itself still succeeds: PASS',
      ],
    });
  } catch (error) {
    await batch.finalize('FAIL', {
      extraLines: [error instanceof Error ? error.stack || error.message : String(error)],
    });
    throw error;
  }
});
