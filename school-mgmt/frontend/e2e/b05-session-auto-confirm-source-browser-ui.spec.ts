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
const SESSION_DETAIL_API = new RegExp(`${API_ORIGIN_PATTERN}/sessions/session-auto-confirm-001(?:\\?.*)?$`);

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

async function installAutoConfirmRoutes(page: Page): Promise<{ getDetailCallCount: () => number }> {
  const listPayload = {
    data: [
      {
        _id: 'session-auto-confirm-001',
        classId: { _id: 'class-auto-001', name: 'Lop Auto Confirm', code: 'CLS-AUTO-001' },
        studentId: { _id: 'student-auto-001', fullName: 'Hoc sinh Auto Confirm', studentCode: 'HS-AUTO-001' },
        teacherId: { _id: 'teacher-auto-001', fullName: 'Teacher Auto Confirm' },
        scheduledDate: '2026-04-08',
        scheduledStartTime: '18:00',
        scheduledEndTime: '19:30',
        amountCharged: 500000,
        teacherPayout: 280000,
        durationMinutes: 90,
        status: 'FINALIZED',
        hasTeachingReport: true,
      },
    ],
    meta: { totalPages: 1, total: 1, page: 1, limit: 20 },
  };

  const detailPayload = {
    _id: 'session-auto-confirm-001',
    classId: { _id: 'class-auto-001', name: 'Lop Auto Confirm', code: 'CLS-AUTO-001' },
    studentId: { _id: 'student-auto-001', fullName: 'Hoc sinh Auto Confirm', studentCode: 'HS-AUTO-001' },
    teacherId: { _id: 'teacher-auto-001', fullName: 'Teacher Auto Confirm' },
    parentUser: { _id: 'parent-auto-001', fullName: 'Parent Manual Name' },
    scheduledDate: '2026-04-08',
    scheduledStartTime: '18:00',
    scheduledEndTime: '19:30',
    amountCharged: 500000,
    teacherPayout: 280000,
    durationMinutes: 90,
    status: 'FINALIZED',
    hasTeachingReport: true,
    confirmation: {
      teacherCompletedAt: '2026-04-08T11:15:00.000Z',
      autoConfirmedAt: '2026-04-10T03:05:00.000Z',
      finalizedAt: '2026-04-10T03:05:00.000Z',
    },
    teachingReport: {
      submittedAt: '2026-04-08T12:00:00.000Z',
      deadline: '2026-04-09T11:15:00.000Z',
      isLateSubmission: false,
      lessonContent: 'On tap hinh hoc va luyen de.',
    },
  };

  let detailCallCount = 0;

  await page.route(CLASSES_API, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{ _id: 'class-auto-001', name: 'Lop Auto Confirm', code: 'CLS-AUTO-001' }]),
    });
  });

  await page.route(SESSION_STATS_API, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        totalSessions: 1,
        totalRevenue: 500000,
        totalTeacherCost: 280000,
        byStatus: {
          FINALIZED: { count: 1, totalCharged: 500000, totalPayout: 280000 },
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

test('B05 auto-confirmed session detail shows System as confirmation source instead of a parent name', async ({
  browser,
  page,
  request,
}) => {
  const batch = await openBatch(browser, 'session_auto_confirm_source_browser');

  try {
    const routes = await installAutoConfirmRoutes(page);

    await signInAs(page, request, 'director');
    await page.goto(appUrl('/app/sessions'));
    await page.waitForLoadState('domcontentloaded');

    const row = page.getByTestId('session-row-session-auto-confirm-001');
    await expect(row).toBeVisible();
    await row.getByTestId('sessions-view-detail').click();

    const detailModal = page.locator('.modal.modal-lg');
    await expect(detailModal).toBeVisible();
    await expect.poll(routes.getDetailCallCount).toBe(1);

    const expectedConfirmationAt = new Intl.DateTimeFormat('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date('2026-04-10T03:05:00.000Z'));

    await expect(detailModal.getByTestId('sessions-confirmation-source')).toHaveText('Xác nhận tự động bởi Hệ thống');
    await expect(detailModal.getByTestId('sessions-confirmation-at')).toHaveText(expectedConfirmationAt);
    await expect(detailModal).not.toContainText('Parent Manual Name');
    await batch.step('auto-confirm-source-visible-and-not-parent');

    await batch.finalize('PASS', {
      extraLines: [
        'Verified an auto-confirmed session detail row renders explicit confirmation source as System: PASS',
        'Verified the detail modal renders the exact auto-confirm timestamp from confirmation.autoConfirmedAt: PASS',
        'Verified the detail modal does not misattribute auto-confirm to a parent name: PASS',
      ],
    });
  } catch (error) {
    await batch.finalize('FAIL', { error });
    throw error;
  }
});
