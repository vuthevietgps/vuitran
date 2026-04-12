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
const SESSION_CHANGE_REVIEW_API = new RegExp(`${API_ORIGIN_PATTERN}/sessions/change-requests/session-change-approved-001/review(?:\\?.*)?$`);
const CLASSES_API = new RegExp(`${API_ORIGIN_PATTERN}/classes(?:\\?.*)?$`);
const SESSIONS_API = new RegExp(`${API_ORIGIN_PATTERN}/sessions(?:\\?.*)?$`);
const SESSION_STATS_API = new RegExp(`${API_ORIGIN_PATTERN}/sessions/stats(?:\\?.*)?$`);
const SESSION_DETAIL_API = new RegExp(`${API_ORIGIN_PATTERN}/sessions/session-change-session-001(?:\\?.*)?$`);

type HarnessState = {
  pending: boolean;
};

type HarnessOptions = {
  reviewFailureMessage?: string;
};

type Harness = {
  getReviewPayloads: () => Array<{ action: string }>;
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
      pendingClassUpdates: 0,
      pendingSessionChangeRequests: Number(state.pending),
      openTickets: 0,
    },
    payrolls: [],
    invoices: [],
    topUps: [],
    teachers: [],
    classes: [],
    sessionChanges: state.pending
      ? [
          {
            _id: 'session-change-approved-001',
            classId: { _id: 'class-session-change-001', code: 'CLS-SC-001', name: 'Lop Doi Buoi Hoc' },
            studentId: { _id: 'student-session-change-001', fullName: 'Hoc sinh Doi Buoi', studentCode: 'HS-SC-001' },
            requestedBy: { _id: 'sale-session-change-001', fullName: 'Sale Session Change', role: 'SALE' },
            requestedAt: '2026-04-10T08:00:00.000Z',
            requestedTeacherId: { _id: 'teacher-new-001', fullName: 'Teacher Moi' },
            requestedDurationMinutes: 90,
            currentDurationMinutes: 60,
            reason: 'Can them thoi gian luyen tap va doi GV phu hop hon.',
            sessionId: {
              _id: 'session-change-session-001',
              scheduledDate: '2026-04-12',
              scheduledStartTime: '18:00',
            },
            financialImpact: {
              oldAmountCharged: 200000,
              newAmountCharged: 250000,
              deltaAmountCharged: 50000,
              oldTeacherPayout: 120000,
              newTeacherPayout: 150000,
              deltaTeacherPayout: 30000,
              note: 'Bien loi nhuan thu hep do luong GV tang.',
            },
          },
        ]
      : [],
  };
}

function buildSessionListPayload(state: HarnessState) {
  const approved = !state.pending;
  return {
    data: [
      {
        _id: 'session-change-session-001',
        classId: {
          _id: 'class-session-change-001',
          name: 'Lop Doi Buoi Hoc',
          code: 'CLS-SC-001',
        },
        studentId: {
          _id: 'student-session-change-001',
          fullName: 'Hoc sinh Doi Buoi',
          studentCode: 'HS-SC-001',
        },
        teacherId: {
          _id: approved ? 'teacher-new-001' : 'teacher-old-001',
          fullName: approved ? 'Teacher Moi' : 'Teacher Cu',
        },
        scheduledDate: '2026-04-12',
        scheduledStartTime: '18:00',
        scheduledEndTime: approved ? '19:30' : '19:00',
        durationMinutes: approved ? 90 : 60,
        amountCharged: approved ? 250000 : 200000,
        teacherPayout: approved ? 150000 : 120000,
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
  const approved = !state.pending;
  return {
    _id: 'session-change-session-001',
    classId: {
      _id: 'class-session-change-001',
      name: 'Lop Doi Buoi Hoc',
      code: 'CLS-SC-001',
    },
    studentId: {
      _id: 'student-session-change-001',
      fullName: 'Hoc sinh Doi Buoi',
      studentCode: 'HS-SC-001',
    },
    teacherId: {
      _id: approved ? 'teacher-new-001' : 'teacher-old-001',
      fullName: approved ? 'Teacher Moi' : 'Teacher Cu',
    },
    scheduledDate: '2026-04-12',
    scheduledStartTime: '18:00',
    scheduledEndTime: approved ? '19:30' : '19:00',
    durationMinutes: approved ? 90 : 60,
    amountCharged: approved ? 250000 : 200000,
    teacherPayout: approved ? 150000 : 120000,
    status: 'SCHEDULED',
    isPaid: false,
    isTeacherPaid: false,
    editHistory: approved
      ? [
          {
            editedAt: '2026-04-10T08:30:00.000Z',
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
                field: 'durationMinutes',
                label: 'Thoi luong',
                beforeValue: '60 phut',
                afterValue: '90 phut',
              },
            ],
          },
        ]
      : [],
  };
}

async function installRoutes(page: Page, options: HarnessOptions = {}): Promise<Harness> {
  const state: HarnessState = {
    pending: true,
  };
  const reviewPayloads: Array<{ action: string }> = [];

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

  await page.route(SESSION_CHANGE_REVIEW_API, async (route) => {
    const payload = route.request().postDataJSON() as { action: string };
    reviewPayloads.push(payload);
    if (options.reviewFailureMessage && payload.action === 'APPROVE') {
      await route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({ message: options.reviewFailureMessage }),
      });
      return;
    }
    state.pending = false;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        requestId: 'session-change-approved-001',
        action: payload.action,
      }),
    });
  });

  await page.route(CLASSES_API, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          _id: 'class-session-change-001',
          name: 'Lop Doi Buoi Hoc',
          code: 'CLS-SC-001',
        },
      ]),
    });
  });

  await page.route(SESSION_STATS_API, async (route) => {
    const approved = !state.pending;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        totalSessions: 1,
        totalRevenue: approved ? 250000 : 200000,
        totalTeacherCost: approved ? 150000 : 120000,
        byStatus: {
          SCHEDULED: {
            count: 1,
            totalCharged: approved ? 250000 : 200000,
            totalPayout: approved ? 150000 : 120000,
          },
        },
      }),
    });
  });

  await page.route(SESSIONS_API, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(buildSessionListPayload(state)),
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
    getReviewPayloads: () => reviewPayloads,
  };
}

test.use({
  trace: 'off',
  video: 'on',
});

for (const role of ['director', 'ops'] as const) {
  test(`B05 ${role} approval of session change updates pending hub and sessions screen`, async ({
    browser,
    page,
    request,
  }) => {
    const batch = await openBatch(browser, `session_change_approval_${role}`);

    try {
      const harness = await installRoutes(page);

      await signInAs(page, request, role);
      await page.goto(appUrl('/app/pending-approvals?tab=session-changes'));
      await page.waitForLoadState('domcontentloaded');

      const sessionChangeRow = page.getByTestId('pending-session-change-row-session-change-approved-001');
      await expect(page.getByTestId('pending-tab-session-changes')).toBeVisible();
      await expect(page.getByTestId('pending-summary-session-changes')).toContainText('1');
      await expect(sessionChangeRow).toBeVisible();
      await expect(sessionChangeRow).toContainText('Teacher Moi');
      await expect(sessionChangeRow).toContainText('60 -> 90 phut');
      await batch.step(`pending-session-change-visible-${role}`);

      await page.getByTestId('pending-session-change-approve-session-change-approved-001').click();

      await expect.poll(() => harness.getReviewPayloads().length).toBe(1);
      expect(harness.getReviewPayloads()).toEqual([{ action: 'APPROVE' }]);
      await expect(sessionChangeRow).toHaveCount(0);
      await expect(page.getByTestId('pending-empty-session-changes')).toBeVisible();
      await expect(page.getByTestId('pending-summary-session-changes')).toContainText('0');
      await batch.step(`pending-session-change-approved-${role}`);

      await page.goto(appUrl('/app/sessions'));
      await page.waitForLoadState('domcontentloaded');

      const sessionRow = page.getByTestId('session-row-session-change-session-001');
      await expect(sessionRow).toBeVisible();
      await expect(sessionRow).toContainText('Teacher Moi');
      await expect(sessionRow).toContainText('18:00 – 19:30');
      await expect(sessionRow).toContainText('150.000');
      await batch.step(`sessions-row-updated-${role}`);

      await sessionRow.getByTestId('sessions-view-detail').click();
      const detailModal = page.locator('.modal.modal-lg');
      await expect(detailModal).toBeVisible();
      await expect(detailModal).toContainText('Teacher Moi');
      await expect(detailModal).toContainText('18:00 – 19:30');
      await expect(detailModal).toContainText('Giao vien');
      await expect(detailModal).toContainText('Teacher Cu');
      await expect(detailModal).toContainText('Thoi luong');
      await expect(detailModal).toContainText('60 phut');
      await expect(detailModal).toContainText('90 phut');
      await batch.step(`sessions-detail-updated-${role}`);

      await batch.finalize('PASS', {
        extraLines: [
          `Role ${role} sent exact APPROVE payload and cleared the pending session-change row.`,
          'Sessions row and detail both reflected the approved teacher and duration update.',
        ],
      });
    } catch (error) {
      await batch.finalize('FAIL', { error });
      throw error;
    }
  });
}

test('B05 manager sees exact teacher-swap conflict validation error when session-change approval fails', async ({
  browser,
  page,
  request,
}) => {
  const batch = await openBatch(browser, 'session_change_approval_conflict_browser');

  try {
    const failureMessage = 'Trung lich: Giao vien da co buoi hoc trung gio';
    const harness = await installRoutes(page, { reviewFailureMessage: failureMessage });

    await signInAs(page, request, 'director');
    await page.goto(appUrl('/app/pending-approvals?tab=session-changes'));
    await page.waitForLoadState('domcontentloaded');

    const sessionChangeRow = page.getByTestId('pending-session-change-row-session-change-approved-001');
    await expect(sessionChangeRow).toBeVisible();
    await expect(sessionChangeRow).toContainText('Teacher Moi');
    await expect(sessionChangeRow).toContainText('60 -> 90 phut');
    await batch.step('pending-session-change-conflict-visible');

    await page.getByTestId('pending-session-change-approve-session-change-approved-001').click();

    await expect.poll(() => harness.getReviewPayloads().length).toBe(1);
    expect(harness.getReviewPayloads()).toEqual([{ action: 'APPROVE' }]);
    await expect(page.getByTestId('pending-error')).toContainText(failureMessage);
    await expect(sessionChangeRow).toBeVisible();
    await expect(page.getByTestId('pending-summary-session-changes')).toContainText('1');
    await batch.step('pending-session-change-conflict-error-visible');

    await page.goto(appUrl('/app/sessions'));
    await page.waitForLoadState('domcontentloaded');

    const sessionRow = page.getByTestId('session-row-session-change-session-001');
    await expect(sessionRow).toBeVisible();
    await expect(sessionRow).toContainText('Teacher Cu');
    await expect(sessionRow).toContainText('120.000');
    await expect(sessionRow).not.toContainText('Teacher Moi');
    await batch.step('sessions-row-unchanged-after-conflict');

    await sessionRow.getByTestId('sessions-view-detail').click();
    const detailModal = page.locator('.modal.modal-lg');
    await expect(detailModal).toBeVisible();
    await expect(detailModal).toContainText('Teacher Cu');
    await expect(detailModal).toContainText('18:00');
    await expect(detailModal).toContainText('19:00');
    await expect(detailModal.locator('.history-card .history-item')).toHaveCount(0);
    await batch.step('sessions-detail-unchanged-after-conflict');

    await batch.finalize('PASS', {
      extraLines: [
        'Verified manager approve action still sends exact `{ action: APPROVE }` even on failure.',
        'Verified frontend surfaces the exact backend overlap message `Trung lich: ...` and keeps the pending row in place.',
        'Verified sessions row and detail modal remain unchanged after the failed teacher-swap approval.',
      ],
    });
  } catch (error) {
    await batch.finalize('FAIL', { error });
    throw error;
  }
});
