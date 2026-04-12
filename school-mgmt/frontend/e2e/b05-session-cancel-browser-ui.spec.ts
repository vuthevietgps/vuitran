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
const SESSION_DETAIL_API = new RegExp(`${API_ORIGIN_PATTERN}/sessions/session-cancel-001(?:\\?.*)?$`);
const CANCEL_API = new RegExp(`${API_ORIGIN_PATTERN}/sessions/session-cancel-001/cancel(?:\\?.*)?$`);

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

async function installCancelRoutes(page: Page): Promise<{
  getListCallCount: () => number;
  getStatsCallCount: () => number;
  getCancelCallCount: () => number;
  getCancelBodies: () => Array<Record<string, string>>;
}> {
  const state = {
    sessions: [
      {
        _id: 'session-cancel-001',
        classId: { _id: 'class-cancel-001', code: 'CLS-CANCEL-001', name: 'Lop Cancel Session' },
        studentId: { _id: 'student-cancel-001', fullName: 'Hoc sinh Cancel', studentCode: 'HS-CANCEL-001' },
        teacherId: { _id: 'teacher-cancel-001', fullName: 'Teacher Cancel' },
        scheduledDate: '2026-04-11',
        scheduledStartTime: '18:00',
        scheduledEndTime: '19:30',
        amountCharged: 500000,
        teacherPayout: 280000,
        durationMinutes: 90,
        status: 'SCHEDULED',
        isPaid: true,
        isTeacherPaid: false,
        hasTeachingReport: false,
      },
    ],
    stats: {
      totalSessions: 1,
      totalRevenue: 500000,
      totalTeacherCost: 280000,
      byStatus: {
        SCHEDULED: { count: 1, totalCharged: 500000, totalPayout: 280000 },
      },
    },
    detail: {
      _id: 'session-cancel-001',
      classId: { _id: 'class-cancel-001', code: 'CLS-CANCEL-001', name: 'Lop Cancel Session' },
      studentId: { _id: 'student-cancel-001', fullName: 'Hoc sinh Cancel', studentCode: 'HS-CANCEL-001' },
      teacherId: { _id: 'teacher-cancel-001', fullName: 'Teacher Cancel' },
      scheduledDate: '2026-04-11',
      scheduledStartTime: '18:00',
      scheduledEndTime: '19:30',
      amountCharged: 0,
      teacherPayout: 0,
      durationMinutes: 90,
      status: 'CANCELLED',
      isPaid: true,
      isTeacherPaid: false,
      hasTeachingReport: false,
      cancellation: {
        cancelledBy: 'OPS',
        cancelReason: 'Phu huynh bao ban dot xuat',
        cancelledAt: '2026-04-10T07:40:00.000Z',
        refundAmount: 500000,
      },
    },
  };

  let listCallCount = 0;
  let statsCallCount = 0;
  let cancelCallCount = 0;
  const cancelBodies: Array<Record<string, string>> = [];

  await page.route(CLASSES_API, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{ _id: 'class-cancel-001', code: 'CLS-CANCEL-001', name: 'Lop Cancel Session' }]),
    });
  });

  await page.route(SESSION_STATS_API, async (route) => {
    statsCallCount += 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(clone(state.stats)),
    });
  });

  await page.route(SESSIONS_API, async (route) => {
    listCallCount += 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: clone(state.sessions),
        meta: { totalPages: 1, total: state.sessions.length, page: 1, limit: 20 },
      }),
    });
  });

  await page.route(CANCEL_API, async (route) => {
    cancelCallCount += 1;
    cancelBodies.push(route.request().postDataJSON() as Record<string, string>);
    state.sessions = state.sessions.map((session) =>
      session._id === 'session-cancel-001'
        ? {
            ...session,
            status: 'CANCELLED',
            amountCharged: 0,
            teacherPayout: 0,
            cancellation: clone(state.detail.cancellation),
          }
        : session,
    );
    state.stats = {
      totalSessions: 1,
      totalRevenue: 0,
      totalTeacherCost: 0,
      byStatus: {
        CANCELLED: { count: 1, totalCharged: 0, totalPayout: 0 },
      },
    };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    });
  });

  await page.route(SESSION_DETAIL_API, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(clone(state.detail)),
    });
  });

  return {
    getListCallCount: () => listCallCount,
    getStatsCallCount: () => statsCallCount,
    getCancelCallCount: () => cancelCallCount,
    getCancelBodies: () => clone(cancelBodies),
  };
}

test.use({
  trace: 'off',
  video: 'on',
});

test('B05 cancel session updates row badge, stats, and cancellation metadata on detail', async ({
  browser,
  page,
  request,
}) => {
  const batch = await openBatch(browser, 'session_cancel_browser');

  try {
    const routes = await installCancelRoutes(page);

    await signInAs(page, request, 'director');
    await page.goto(appUrl('/app/sessions'));
    await page.waitForLoadState('domcontentloaded');

    const row = page.getByTestId('session-row-session-cancel-001');
    await expect(row).toBeVisible();
    await expect(row.getByTestId('sessions-cancel-button')).toBeVisible();
    await expect(page.locator('.stats-bar')).toContainText('500.000');
    await batch.step('cancel-session-row-visible');

    let promptMessage = '';
    page.once('dialog', async (dialog) => {
      promptMessage = dialog.message();
      await dialog.accept('Phu huynh bao ban dot xuat');
    });

    await row.getByTestId('sessions-cancel-button').click();

    await expect.poll(() => promptMessage).toBe('Lý do hủy buổi học:');
    await expect.poll(routes.getCancelCallCount).toBe(1);
    await expect.poll(() => routes.getCancelBodies()).toEqual([
      { cancelReason: 'Phu huynh bao ban dot xuat' },
    ]);
    await expect.poll(routes.getListCallCount).toBe(2);
    await expect.poll(routes.getStatsCallCount).toBe(2);
    await expect(row).toContainText('Đã hủy');
    await expect(page.locator('.stats-bar')).toContainText('0 ₫');
    await expect(row.locator('.zero-note')).toHaveCount(2);
    await batch.step('cancel-session-list-and-stats-reloaded');

    await row.getByTestId('sessions-view-detail').click();

    const detailModal = page.locator('.modal.modal-lg');
    const expectedCancelledAt = new Intl.DateTimeFormat('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date('2026-04-10T07:40:00.000Z'));

    await expect(detailModal).toBeVisible();
    await expect(detailModal.getByTestId('sessions-cancellation-source')).toHaveText('OPS');
    await expect(detailModal.getByTestId('sessions-cancellation-reason')).toHaveText('Phu huynh bao ban dot xuat');
    await expect(detailModal.getByTestId('sessions-cancellation-at')).toHaveText(expectedCancelledAt);
    await batch.step('cancel-session-detail-metadata-visible');

    await batch.finalize('PASS', {
      extraLines: [
        'Verified cancel prompt uses the exact reason prompt and sends one strict cancelReason payload: PASS',
        'Verified success reload updates the row badge to CANCELLED and zeroes the related revenue/teacher-cost stats: PASS',
        'Verified the detail modal surfaces cancellation source, reason, and timestamp after reload: PASS',
      ],
    });
  } catch (error) {
    await batch.finalize('FAIL', { error });
    throw error;
  }
});
