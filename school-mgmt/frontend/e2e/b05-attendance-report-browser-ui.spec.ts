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
const ATTENDANCE_REPORT_API = new RegExp(`${API_ORIGIN_PATTERN}/attendance/report(?:\\?.*)?$`);
const IMAGE_ASSET_API = new RegExp(`${API_ORIGIN_PATTERN}/uploads/attendance-report/.*$`);

const CLASS_ID = 'class-report-001';
const START_DATE = '2026-04-01';
const END_DATE = '2026-04-30';

type AttendanceReportRequest = {
  startDate: string | null;
  endDate: string | null;
  classId: string | null;
  page: string | null;
  limit: string | null;
};

type ReportHarness = {
  getRequests: () => AttendanceReportRequest[];
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

async function installAttendanceReportRoutes(page: Page): Promise<ReportHarness> {
  const requests: AttendanceReportRequest[] = [];

  const pageOneRows = [
    {
      _id: 'attendance-row-001',
      date: '2026-04-02T00:00:00.000Z',
      attendedAt: '2026-04-02T11:15:00.000Z',
      status: 'PRESENT',
      imageUrl: 'http://localhost:3000/uploads/attendance-report/checkin-001.png',
      studentId: {
        _id: 'student-report-001',
        studentCode: 'HS-RP-001',
        fullName: 'Hoc sinh Report Alpha',
        age: 12,
        level: 'Starter',
        parentName: 'Phu huynh Alpha',
        faceImage: 'http://localhost:3000/uploads/attendance-report/face-001.png',
        totalPurchasedSessions: 12,
      },
      classId: {
        _id: CLASS_ID,
        name: 'Lop Bao Cao Diem Danh',
        code: 'CLS-RP-001',
      },
      teacherId: {
        _id: 'teacher-report-001',
        fullName: 'Teacher Report Alpha',
        email: 'teacher.report.alpha@example.com',
      },
      notes: 'Check-in dung gio.',
    },
    {
      _id: 'attendance-row-002',
      date: '2026-04-03T00:00:00.000Z',
      attendedAt: '2026-04-03T11:20:00.000Z',
      status: 'LATE',
      imageUrl: '',
      studentId: {
        _id: 'student-report-002',
        studentCode: 'HS-RP-002',
        fullName: 'Hoc sinh Report Bravo',
        age: 11,
        level: 'Mover',
        parentName: 'Phu huynh Bravo',
        faceImage: '',
        totalPurchasedSessions: 8,
      },
      classId: {
        _id: CLASS_ID,
        name: 'Lop Bao Cao Diem Danh',
        code: 'CLS-RP-001',
      },
      teacherId: {
        _id: 'teacher-report-002',
        fullName: 'Teacher Report Bravo',
        email: 'teacher.report.bravo@example.com',
      },
      notes: 'Den muon 5 phut.',
    },
  ];

  const pageTwoRows = [
    {
      _id: 'attendance-row-003',
      date: '2026-04-04T00:00:00.000Z',
      attendedAt: '2026-04-04T11:05:00.000Z',
      status: 'PRESENT',
      imageUrl: 'http://localhost:3000/uploads/attendance-report/checkin-003.png',
      studentId: {
        _id: 'student-report-003',
        studentCode: 'HS-RP-003',
        fullName: 'Hoc sinh Report Charlie',
        age: 10,
        level: 'Flyer',
        parentName: 'Phu huynh Charlie',
        faceImage: 'http://localhost:3000/uploads/attendance-report/face-003.png',
        totalPurchasedSessions: 5,
      },
      classId: {
        _id: CLASS_ID,
        name: 'Lop Bao Cao Diem Danh',
        code: 'CLS-RP-001',
      },
      teacherId: {
        _id: 'teacher-report-003',
        fullName: 'Teacher Report Charlie',
        email: 'teacher.report.charlie@example.com',
      },
      notes: 'Diem danh binh thuong.',
    },
  ];

  await page.route(CLASSES_API, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          classId: CLASS_ID,
          classCode: 'CLS-RP-001',
          className: 'Lop Bao Cao Diem Danh',
          studentCount: 3,
          students: [
            { studentId: 'student-report-001', fullName: 'Hoc sinh Report Alpha' },
            { studentId: 'student-report-002', fullName: 'Hoc sinh Report Bravo' },
            { studentId: 'student-report-003', fullName: 'Hoc sinh Report Charlie' },
          ],
        },
      ]),
    });
  });

  await page.route(ATTENDANCE_REPORT_API, async (route) => {
    const url = new URL(route.request().url());
    requests.push({
      startDate: url.searchParams.get('startDate'),
      endDate: url.searchParams.get('endDate'),
      classId: url.searchParams.get('classId'),
      page: url.searchParams.get('page'),
      limit: url.searchParams.get('limit'),
    });

    const currentPage = Number(url.searchParams.get('page') || '1');
    const payload =
      currentPage === 2
        ? {
            data: pageTwoRows,
            meta: {
              total: 3,
              page: 2,
              limit: 2,
              totalPages: 2,
            },
          }
        : {
            data: pageOneRows,
            meta: {
              total: 3,
              page: 1,
              limit: 2,
              totalPages: 2,
            },
          };

    await new Promise((resolve) => setTimeout(resolve, 150));
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(payload),
    });
  });

  await page.route(IMAGE_ASSET_API, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'image/svg+xml',
      body: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect width="16" height="16" fill="#2563eb"/></svg>`,
    });
  });

  return {
    getRequests: () => clone(requests),
  };
}

async function openAttendanceReport(page: Page, request: APIRequestContext): Promise<void> {
  await signInAs(page, request, 'director');
  await page.goto(appUrl('/app/attendance-report'));
  await page.waitForLoadState('domcontentloaded');
}

test.use({
  trace: 'off',
  video: 'on',
});

test('B05 attendance-report filters by class and date, then paginates with exact query params', async ({
  browser,
  page,
  request,
}) => {
  const batch = await openBatch(browser, 'attendance_report_filter_pagination_browser');

  try {
    const routes = await installAttendanceReportRoutes(page);
    await openAttendanceReport(page, request);

    await page.getByTestId('attendance-report-start-date').fill(START_DATE);
    await page.getByTestId('attendance-report-end-date').fill(END_DATE);
    await page.getByTestId('attendance-report-class-filter').selectOption(CLASS_ID);
    await page.getByTestId('attendance-report-search-button').click();

    await expect.poll(() => routes.getRequests().length).toBe(1);
    expect(routes.getRequests()[0]).toEqual({
      startDate: START_DATE,
      endDate: END_DATE,
      classId: CLASS_ID,
      page: '1',
      limit: '20',
    });

    await expect(page.getByTestId('attendance-report-summary-total-items')).toContainText('3');
    await expect(page.getByTestId('attendance-report-summary-page')).toContainText('1 / 2');
    await expect(page.getByTestId('attendance-report-row-attendance-row-001')).toBeVisible();
    await expect(page.getByTestId('attendance-report-row-attendance-row-002')).toBeVisible();
    await expect(page.getByTestId('attendance-report-total-purchased-attendance-row-001')).toContainText(
      '12',
    );
    await batch.step('attendance-report-page-one-filtered');

    await page.getByRole('button', { name: 'Sau »' }).click();

    await expect.poll(() => routes.getRequests().length).toBe(2);
    expect(routes.getRequests()[1]).toEqual({
      startDate: START_DATE,
      endDate: END_DATE,
      classId: CLASS_ID,
      page: '2',
      limit: '20',
    });

    await expect(page.getByTestId('attendance-report-summary-page')).toContainText('2 / 2');
    await expect(page.getByTestId('attendance-report-row-attendance-row-001')).toHaveCount(0);
    await expect(page.getByTestId('attendance-report-row-attendance-row-003')).toBeVisible();
    await expect(page.getByTestId('attendance-report-total-purchased-attendance-row-003')).toContainText(
      '5',
    );
    await batch.step('attendance-report-page-two-filtered');

    await batch.finalize('PASS', {
      extraLines: [
        'Verified attendance-report sends strict class/date/page query params for the first search: PASS',
        'Verified filtered page-one results render correct summary totals and purchased-session column: PASS',
        'Verified pagination requests page 2 with the same filters and swaps the table rows to the second page payload: PASS',
      ],
    });
  } catch (error) {
    await batch.finalize('FAIL', {
      extraLines: [error instanceof Error ? error.stack || error.message : String(error)],
    });
    throw error;
  }
});

test('B05 attendance-report preview opens the correct student-face and attendance images in the modal', async ({
  browser,
  page,
  request,
}) => {
  const batch = await openBatch(browser, 'attendance_report_preview_browser');

  try {
    await installAttendanceReportRoutes(page);
    await openAttendanceReport(page, request);

    await page.getByTestId('attendance-report-start-date').fill(START_DATE);
    await page.getByTestId('attendance-report-end-date').fill(END_DATE);
    await page.getByTestId('attendance-report-class-filter').selectOption(CLASS_ID);
    await page.getByTestId('attendance-report-search-button').click();

    const alphaRow = page.getByTestId('attendance-report-row-attendance-row-001');
    await expect(alphaRow).toBeVisible();

    const thumbnails = alphaRow.locator('img.thumbnail');
    await expect(thumbnails).toHaveCount(2);

    await thumbnails.nth(0).click();
    const modal = page.locator('.modal');
    await expect(modal).toBeVisible();
    await expect(modal.locator('img')).toHaveAttribute(
      'src',
      'http://localhost:3000/uploads/attendance-report/face-001.png',
    );
    await batch.step('attendance-report-face-preview');

    await modal.click();
    await expect(modal).toHaveCount(0);

    await thumbnails.nth(1).click();
    const attendanceModal = page.locator('.modal');
    await expect(attendanceModal).toBeVisible();
    await expect(attendanceModal.locator('img')).toHaveAttribute(
      'src',
      'http://localhost:3000/uploads/attendance-report/checkin-001.png',
    );
    await batch.step('attendance-report-checkin-preview');

    await attendanceModal.click();
    await expect(attendanceModal).toHaveCount(0);
    await batch.finalize('PASS', {
      extraLines: [
        'Verified the student-face thumbnail opens a modal with the exact face image URL: PASS',
        'Verified the attendance-image thumbnail opens a modal with the exact check-in image URL: PASS',
        'Verified closing each preview resets the modal cleanly before the next preview opens: PASS',
      ],
    });
  } catch (error) {
    await batch.finalize('FAIL', {
      extraLines: [error instanceof Error ? error.stack || error.message : String(error)],
    });
    throw error;
  }
});
