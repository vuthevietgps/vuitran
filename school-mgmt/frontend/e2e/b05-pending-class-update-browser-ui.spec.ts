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

const PENDING_APPROVALS_API = /^https?:\/\/[^/]+:3000\/pending-approvals(?:\?.*)?$/;
const PENDING_APPROVALS_SUMMARY_API = /^https?:\/\/[^/]+:3000\/pending-approvals\/summary(?:\?.*)?$/;
const APPROVE_CLASS_API = /^https?:\/\/[^/]+:3000\/classes\/class-approve-001\/pending-sale-update\/approve(?:\?.*)?$/;
const REJECT_CLASS_API = /^https?:\/\/[^/]+:3000\/classes\/class-reject-001\/pending-sale-update\/reject(?:\?.*)?$/;

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

function buildPendingPayload(state: { approvePending: boolean; rejectPending: boolean }) {
  const classes = [];
  if (state.approvePending) {
    classes.push({
      _id: 'class-approve-001',
      code: 'CLS-APPROVE-001',
      name: 'Lop Cho Phe Duyet',
      sale: { fullName: 'Sale Approve' },
      pendingSaleUpdate: {
        status: 'PENDING',
        requestedBy: { fullName: 'Sale Approve' },
        requestedAt: '2026-04-10T10:00:00.000Z',
        requestedChanges: { teacherId: 'teacher-002', sessionDuration: 90 },
        changeSummary: [
          {
            label: 'Giao vien',
            beforeValue: 'Teacher Initial',
            afterValue: 'Teacher Reloaded',
          },
          {
            label: 'Thoi luong buoi hoc',
            beforeValue: '60 phut',
            afterValue: '90 phut',
          },
        ],
      },
    });
  }
  if (state.rejectPending) {
    classes.push({
      _id: 'class-reject-001',
      code: 'CLS-REJECT-001',
      name: 'Lop Cho Tu Choi',
      sale: { fullName: 'Sale Reject' },
      pendingSaleUpdate: {
        status: 'PENDING',
        requestType: 'DURATION_CHANGE',
        requestedBy: { fullName: 'Sale Reject' },
        requestedAt: '2026-04-10T11:00:00.000Z',
        requestedChanges: { baseDuration: 45, sessionDuration: 90 },
        changeSummary: [
          {
            label: 'Thoi luong buoi hoc',
            beforeValue: '60 phut',
            afterValue: '90 phut',
          },
        ],
        durationPreview: {
          oldBaseDuration: 30,
          oldSessionDuration: 60,
          newBaseDuration: 45,
          newSessionDuration: 90,
          students: [
            {
              studentId: 'student-001',
              studentName: 'Student Reject',
              studentCode: 'HS-REJECT',
              oldDurationMinutes: 60,
              newDurationMinutes: 90,
              totalSessionsRemainingBefore: 12,
              totalSessionsRemainingAfter: 8,
              paidSessionsRemainingBefore: 10,
              paidSessionsRemainingAfter: 7,
              bonusSessionsRemainingBefore: 2,
              bonusSessionsRemainingAfter: 1,
              projectedTotalSessionsBefore: 15,
              projectedTotalSessionsAfter: 10,
            },
          ],
        },
      },
    });
  }

  return {
    summary: {
      totalPending: classes.length,
      pendingPayrolls: 0,
      pendingInvoices: 0,
      pendingTopUps: 0,
      pendingTeachers: 0,
      pendingClassUpdates: classes.length,
      pendingSessionChangeRequests: 0,
      openTickets: 0,
    },
    payrolls: [],
    invoices: [],
    topUps: [],
    teachers: [],
    classes,
    sessionChanges: [],
  };
}

async function installPendingClassRoutes(page: Page): Promise<{
  getApproveCallCount: () => number;
  getRejectBodies: () => unknown[];
}> {
  const state = {
    approvePending: true,
    rejectPending: true,
  };
  let approveCallCount = 0;
  const rejectBodies: unknown[] = [];

  await page.route(PENDING_APPROVALS_API, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(buildPendingPayload(state)),
    });
  });

  await page.route(PENDING_APPROVALS_SUMMARY_API, async (route) => {
    const payload = buildPendingPayload(state);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ totalPending: payload.summary.totalPending }),
    });
  });

  await page.route(APPROVE_CLASS_API, async (route) => {
    approveCallCount += 1;
    state.approvePending = false;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    });
  });

  await page.route(REJECT_CLASS_API, async (route) => {
    rejectBodies.push(route.request().postDataJSON());
    state.rejectPending = false;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    });
  });

  return {
    getApproveCallCount: () => approveCallCount,
    getRejectBodies: () => clone(rejectBodies),
  };
}

test.use({
  trace: 'off',
  video: 'on',
});

test('B05 pending class update approve and reject flows mutate the pending list correctly', async ({ browser, page, request }) => {
    const batch = await openBatch(browser, 'pending_class_update_review_browser');

    try {
      const routes = await installPendingClassRoutes(page);
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

    const approveRow = page.getByTestId('pending-class-row-class-approve-001');
    const rejectRow = page.getByTestId('pending-class-row-class-reject-001');

    await expect(page.getByTestId('pending-approvals-page')).toBeVisible();
    await expect(page.getByTestId('pending-content-classes')).toBeVisible();
    await expect(page.getByTestId('pending-summary-classes')).toContainText('2');
    await expect(page.getByTestId('nav-badge-pending')).toHaveText('2');
    await expect(approveRow).toBeVisible();
    await expect(rejectRow).toBeVisible();
    await expect(rejectRow.getByTestId('pending-class-duration-preview-head-class-reject-001')).toContainText('30 / 60 phut');
    await expect(rejectRow.getByTestId('pending-class-duration-preview-head-class-reject-001')).toContainText('45 / 90 phut');

    await approveRow.getByTestId('pending-class-approve-class-approve-001').click();

    await expect.poll(routes.getApproveCallCount).toBe(1);
    await expect(approveRow).toHaveCount(0);
    await expect(rejectRow).toBeVisible();
    await expect(page.getByTestId('pending-summary-classes')).toContainText('1');
    await expect(page.getByTestId('nav-badge-pending')).toHaveText('1');
    await batch.step('pending-class-approved');

    let rejectDialogType = '';
    let rejectDialogMessage = '';
    page.once('dialog', async (dialog) => {
      rejectDialogType = dialog.type();
      rejectDialogMessage = dialog.message();
      await dialog.accept('Khong phu hop');
    });
    await rejectRow.getByTestId('pending-class-reject-class-reject-001').click();

    await expect.poll(() => rejectDialogType).toBe('prompt');
    await expect.poll(() => rejectDialogMessage).toBe('Ly do tu choi (co the bo trong):');
    await expect.poll(() => routes.getRejectBodies().length).toBe(1);
    expect(routes.getRejectBodies()[0]).toEqual({ reason: 'Khong phu hop' });
    await expect(rejectRow).toHaveCount(0);
    await expect(page.getByTestId('pending-empty-classes')).toBeVisible();
    await expect(page.getByTestId('pending-summary-classes')).toContainText('0');
    await expect(page.getByTestId('nav-badge-pending')).toHaveCount(0);
    await batch.step('pending-class-rejected');

    await batch.finalize('PASS', {
      extraLines: [
        'Verified pending class approve removes the approved row and decrements pending counts: PASS',
        'Verified class reject opens the exact prompt text and submits the exact rejection reason payload: PASS',
        'Verified duration preview content stays visible on the rejectable row before review and the list reaches empty state after the second review: PASS',
      ],
    });
  } catch (error) {
    await batch.finalize('FAIL', { error });
    throw error;
  }
});
