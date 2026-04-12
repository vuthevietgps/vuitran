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
const CLASSES_API = new RegExp(`${API_ORIGIN_PATTERN}/classes(?:\\?.*)?$`);
const SESSIONS_API = new RegExp(`${API_ORIGIN_PATTERN}/sessions(?:\\?.*)?$`);
const SESSION_STATS_API = new RegExp(`${API_ORIGIN_PATTERN}/sessions/stats(?:\\?.*)?$`);
const SESSION_DETAIL_API = new RegExp(`${API_ORIGIN_PATTERN}/sessions/session-detail-001(?:\\?.*)?$`);

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

async function installSessionDetailRoutes(page: Page): Promise<{ getDetailCallCount: () => number }> {
  const classes = [
    {
      _id: 'class-session-001',
      name: 'Lop Session Detail',
      code: 'CLS-DET-001',
    },
  ];

  const listPayload = {
    data: [
      {
        _id: 'session-detail-001',
        classId: {
          _id: 'class-session-001',
          name: 'Lop Session Detail',
          code: 'CLS-DET-001',
        },
        studentId: {
          _id: 'student-session-001',
          fullName: 'Hoc sinh Session Detail',
          studentCode: 'HS-SES-001',
        },
        teacherId: {
          _id: 'teacher-session-001',
          fullName: 'Teacher Session Detail',
          email: 'teacher.session.detail@example.com',
        },
        scheduledDate: '2026-04-10',
        scheduledStartTime: '18:00',
        scheduledEndTime: '19:30',
        amountCharged: 550000,
        teacherPayout: 300000,
        durationMinutes: 90,
        status: 'FINALIZED',
        isPaid: true,
        isTeacherPaid: true,
        hasTeachingReport: true,
        confirmation: {
          finalizedAt: '2026-04-10T13:45:00.000Z',
          finalizedBy: {
            _id: 'director-payroll-001',
            fullName: 'Director Payroll',
          },
        },
      },
    ],
    meta: {
      totalPages: 1,
      total: 1,
      page: 1,
      limit: 20,
    },
  };

  const detailPayload = {
    _id: 'session-detail-001',
    classId: {
      _id: 'class-session-001',
      name: 'Lop Session Detail',
      code: 'CLS-DET-001',
    },
    studentId: {
      _id: 'student-session-001',
      fullName: 'Hoc sinh Session Detail',
      studentCode: 'HS-SES-001',
    },
    teacherId: {
      _id: 'teacher-session-001',
      fullName: 'Teacher Session Detail',
      email: 'teacher.session.detail@example.com',
    },
    scheduledDate: '2026-04-10',
    scheduledStartTime: '18:00',
    scheduledEndTime: '19:30',
    amountCharged: 550000,
    teacherPayout: 300000,
    durationMinutes: 90,
    status: 'FINALIZED',
    isPaid: true,
    isTeacherPaid: true,
    topicsCovered: 'Phan so, quy dong mau so, va bai tap ung dung theo de kiem tra giua ky.',
    homework: 'Hoan thanh worksheet 4 va xem lai 12 cau hoi trac nghiem phan so.',
    teacherNotes: 'Hoc sinh tiep thu nhanh, can nhac lai cach trinh bay bai giai ngan gon hon.',
    parentNotes: 'Phu huynh da xem recording va dong y tiep tuc lich hoc hien tai.',
    parentRating: 5,
    hasTeachingReport: true,
    confirmation: {
      teacherCompletedAt: '2026-04-10T12:15:00.000Z',
      parentConfirmedAt: '2026-04-10T12:40:00.000Z',
      finalizedAt: '2026-04-10T13:45:00.000Z',
      finalizedBy: {
        _id: 'director-payroll-001',
        fullName: 'Director Payroll',
      },
    },
    teachingReport: {
      submittedAt: '2026-04-10T05:20:00.000Z',
      deadline: '2026-04-10T16:59:00.000Z',
      isLateSubmission: false,
      recordingUrl: 'https://example.com/recordings/session-detail-001',
      lessonContent: 'Hoc sinh luyen phan so, quy dong, va giai 6 bai toan van co loi giai tung buoc.',
      studentAttitude: 'Tap trung tot, chu dong hoi khi gap dang bai moi, hop tac xuyen suot buoi hoc.',
      teacherComment: 'Tien do on dinh, co the tang do kho bai tap o buoi tiep theo.',
      homework: 'Lam worksheet 4, hoan thanh 12 cau trac nghiem, va xem lai video da ghi hinh.',
      additionalNotes: 'Can mang theo vo nhap de doi chieu bai tap vao buoi hoc tiep theo.',
    },
    editHistory: [
      {
        editedAt: '2026-04-10T10:00:00.000Z',
        editedByName: 'Director Approvals',
        editedByRole: 'DIRECTOR',
        changes: [
          {
            field: 'durationMinutes',
            label: 'Thoi luong',
            beforeValue: '60 phut',
            afterValue: '90 phut',
          },
        ],
        durationSnapshot: {
          newDurationMinutes: 90,
          totalSessionsRemaining: 8,
          paidSessionsRemaining: 6,
          bonusSessionsRemaining: 2,
        },
      },
    ],
  };

  let detailCallCount = 0;

  await page.route(CLASSES_API, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(clone(classes)),
    });
  });

  await page.route(SESSION_STATS_API, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        totalSessions: 1,
        totalRevenue: 550000,
        totalTeacherCost: 300000,
        byStatus: {
          FINALIZED: {
            count: 1,
            totalCharged: 550000,
            totalPayout: 300000,
          },
        },
      }),
    });
  });

  await page.route(SESSIONS_API, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(clone(listPayload)),
    });
  });

  await page.route(SESSION_DETAIL_API, async (route) => {
    detailCallCount += 1;
    await new Promise((resolve) => setTimeout(resolve, 250));
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(clone(detailPayload)),
    });
  });

  return {
    getDetailCallCount: () => detailCallCount,
  };
}

test.use({
  trace: 'off',
  video: 'on',
});

test('B05 session detail renders core fields, teaching report, and edit history after loading fresh detail', async ({
  browser,
  page,
  request,
}) => {
  const batch = await openBatch(browser, 'session_detail_browser');

  try {
    const routes = await installSessionDetailRoutes(page);

    await signInAs(page, request, 'director');
    await page.goto(appUrl('/app/sessions'));
    await page.waitForLoadState('domcontentloaded');

    const sessionRow = page.getByTestId('session-row-session-detail-001');
    await expect(page).toHaveURL(/\/app\/sessions$/);
    await expect(page.getByTestId('sessions-create-button')).toBeVisible();
    await expect(page.locator('.stats-bar')).toBeVisible();
    await expect(sessionRow).toBeVisible();
    await expect(sessionRow).toContainText('CLS-DET-001');
    await expect(sessionRow).toContainText('Hoc sinh Session Detail');
    await batch.step('session-row-summary-visible');

    await sessionRow.getByTestId('sessions-view-detail').click();

    const detailModal = page.locator('.modal.modal-lg');
    await expect(detailModal).toBeVisible();
    await expect(detailModal.getByTestId('sessions-detail-close')).toBeVisible();
    await expect(detailModal.locator('.detail-grid')).toBeVisible();
    await expect(detailModal.locator('.detail-loading')).toBeVisible();
    await expect.poll(routes.getDetailCallCount).toBe(1);
    await expect(detailModal.locator('.detail-loading')).toHaveCount(0, { timeout: 5_000 });

    const detailGrid = detailModal.locator('.detail-grid');
    await expect(detailGrid).toContainText('Lop Session Detail');
    await expect(detailGrid).toContainText('CLS-DET-001');
    await expect(detailGrid).toContainText('Hoc sinh Session Detail');
    await expect(detailGrid).toContainText('Teacher Session Detail');
    await expect(detailGrid).toContainText('10/04/2026');
    await expect(detailGrid).toContainText('18:00');
    await expect(detailGrid).toContainText('19:30');
    await expect(detailGrid).toContainText('550.000');
    await expect(detailGrid).toContainText('300.000');
    await expect(detailGrid.locator('.badge')).toHaveClass(/badge-finalized/);
    await expect(detailGrid).toContainText('Phan so, quy dong mau so');
    await expect(detailGrid).toContainText('worksheet 4');
    await expect(detailGrid).toContainText('Hoc sinh tiep thu nhanh');
    await expect(detailGrid).toContainText('Phu huynh da xem recording');

    const reportCard = detailModal.locator('.report-card');
    await expect(reportCard).toBeVisible();
    await expect(reportCard.locator('.report-status')).toHaveClass(/report-status-ok/);
    const expectedSubmittedAt = await page.evaluate((value) => new Date(value).toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }), '2026-04-10T05:20:00.000Z');
    const expectedDeadline = await page.evaluate((value) => new Date(value).toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }), '2026-04-10T16:59:00.000Z');
    await expect(reportCard).toContainText(expectedSubmittedAt);
    await expect(reportCard).toContainText(expectedDeadline);
    await expect(reportCard).toContainText('Hoc sinh luyen phan so');
    await expect(reportCard).toContainText('Tap trung tot');
    await expect(reportCard).toContainText('Tien do on dinh');
    await expect(reportCard).toContainText('12 cau trac nghiem');
    await expect(reportCard).toContainText('vo nhap');
    await expect(reportCard.locator('a.report-link')).toHaveAttribute(
      'href',
      'https://example.com/recordings/session-detail-001',
    );

    const historyCard = detailModal.locator('.history-card');
    await expect(historyCard).toBeVisible();
    await expect(historyCard.locator('.history-item')).toContainText('Director Approvals');
    await expect(historyCard.locator('.history-item')).toContainText('60 phut -> 90 phut');
    await expect(historyCard.locator('.history-item')).toContainText('Sau khi đổi sang 90 phút');
    await expect(detailModal.getByTestId('sessions-finalize-from-detail')).toHaveCount(0);
    await batch.step('session-detail-loaded-complete');

    await detailModal.getByTestId('sessions-detail-close').click();
    await expect(detailModal).toHaveCount(0);

    await batch.finalize('PASS', {
      extraLines: [
        'Verified session detail modal loads fresh detail from GET /sessions/:id after clicking Xem: PASS',
        'Verified core session fields render correctly in the detail modal for class, student, teacher, date, time, tuition, payout, and status: PASS',
        'Verified teaching report section renders submitted metadata, recording link, and report body fields: PASS',
        'Verified edit-history section renders actor, field change summary, duration snapshot, and hides finalize-from-detail after manual payroll confirmation: PASS',
      ],
    });
  } catch (error) {
    await batch.finalize('FAIL', { error });
    throw error;
  }
});
