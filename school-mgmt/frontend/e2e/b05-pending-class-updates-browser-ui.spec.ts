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

const PENDING_APPROVALS_API_PATTERN = /^https?:\/\/[^/]+:3000\/pending-approvals(?:\?.*)?$/;
const PENDING_APPROVALS_SUMMARY_API_PATTERN = /^https?:\/\/[^/]+:3000\/pending-approvals\/summary(?:\?.*)?$/;
const CLASS_APPROVE_API = /^https?:\/\/[^/]+:3000\/classes\/class-approve-001\/pending-sale-update\/approve(?:\?.*)?$/;
const CLASS_REJECT_API = /^https?:\/\/[^/]+:3000\/classes\/class-reject-001\/pending-sale-update\/reject(?:\?.*)?$/;

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

type PendingState = {
  classes: Array<{
    _id: string;
    code: string;
    name: string;
    sale?: { fullName: string };
    pendingSaleUpdate: {
      status: 'PENDING';
      requestedBy: { fullName: string };
      requestedAt: string;
      requestedChanges: Record<string, unknown>;
      changeSummary: Array<{
        label: string;
        beforeValue: string;
        afterValue: string;
      }>;
    };
  }>;
};

function buildPayload(state: PendingState) {
  return {
    summary: {
      totalPending: state.classes.length,
      pendingPayrolls: 0,
      pendingInvoices: 0,
      pendingTopUps: 0,
      pendingTeachers: 0,
      pendingClassUpdates: state.classes.length,
      pendingSessionChangeRequests: 0,
      openTickets: 0,
    },
    payrolls: [],
    invoices: [],
    topUps: [],
    teachers: [],
    classes: clone(state.classes),
    sessionChanges: [],
  };
}

async function installPendingClassRoutes(page: Page): Promise<{
  getApproveCallCount: () => number;
  getRejectCallCount: () => number;
  getRejectBodies: () => unknown[];
}> {
  const state: PendingState = {
    classes: [
      {
        _id: 'class-approve-001',
        code: 'CLS-APPROVE',
        name: 'Lop Cho Phe Duyet',
        sale: { fullName: 'Sale Alpha' },
        pendingSaleUpdate: {
          status: 'PENDING',
          requestedBy: { fullName: 'Sale Alpha' },
          requestedAt: '2026-04-10T08:00:00.000Z',
          requestedChanges: {
            teacherId: 'teacher-new-001',
            teacherPayPerSession: 280000,
          },
          changeSummary: [
            {
              label: 'Giao vien',
              beforeValue: 'Teacher Cu',
              afterValue: 'Teacher Moi',
            },
          ],
        },
      },
      {
        _id: 'class-reject-001',
        code: 'CLS-REJECT',
        name: 'Lop Cho Tu Choi',
        sale: { fullName: 'Sale Beta' },
        pendingSaleUpdate: {
          status: 'PENDING',
          requestedBy: { fullName: 'Sale Beta' },
          requestedAt: '2026-04-10T09:00:00.000Z',
          requestedChanges: {
            sessionDuration: 90,
          },
          changeSummary: [
            {
              label: 'Thoi luong buoi hoc',
              beforeValue: '60 phut',
              afterValue: '90 phut',
            },
          ],
        },
      },
    ],
  };

  let approveCallCount = 0;
  let rejectCallCount = 0;
  const rejectBodies: unknown[] = [];

  await page.route(PENDING_APPROVALS_API_PATTERN, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(buildPayload(state)),
    });
  });

  await page.route(PENDING_APPROVALS_SUMMARY_API_PATTERN, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ totalPending: state.classes.length }),
    });
  });

  await page.route(CLASS_APPROVE_API, async (route) => {
    approveCallCount += 1;
    state.classes = state.classes.filter((item) => item._id !== 'class-approve-001');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    });
  });

  await page.route(CLASS_REJECT_API, async (route) => {
    rejectCallCount += 1;
    rejectBodies.push(route.request().postDataJSON());
    state.classes = state.classes.filter((item) => item._id !== 'class-reject-001');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    });
  });

  return {
    getApproveCallCount: () => approveCallCount,
    getRejectCallCount: () => rejectCallCount,
    getRejectBodies: () => clone(rejectBodies),
  };
}

test.use({
  trace: 'off',
  video: 'on',
});

test('B05 pending class updates approve and reject reload the classes tab correctly', async ({ browser, page, request }) => {
  const batch = await openBatch(browser, 'pending_class_update_review_browser');

  try {
    const routes = await installPendingClassRoutes(page);

    await signInAs(page, request, 'director');
    await page.addInitScript(() => {
      const originalSetInterval = window.setInterval.bind(window);
      window.setInterval = ((handler: TimerHandler, timeout?: number, ...args: unknown[]) => {
        const normalizedTimeout = timeout === 60000 ? 150 : timeout;
        return originalSetInterval(handler, normalizedTimeout, ...args);
      }) as typeof window.setInterval;
    });
    await page.goto(appUrl('/app/pending-approvals?tab=classes'));
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByTestId('pending-approvals-page')).toBeVisible();
    await expect(page.getByTestId('pending-tab-classes')).toBeVisible();
    await expect(page.getByTestId('pending-content-classes')).toBeVisible();
    await expect(page.getByTestId('pending-class-row-class-approve-001')).toBeVisible();
    await expect(page.getByTestId('pending-class-row-class-reject-001')).toBeVisible();
    await expect(page.getByTestId('pending-summary-classes')).toContainText('2');
    await expect(page.getByTestId('nav-badge-pending')).toHaveText('2');

    await page.getByTestId('pending-class-approve-class-approve-001').click();

    await expect.poll(routes.getApproveCallCount).toBe(1);
    await expect(page.getByTestId('pending-class-row-class-approve-001')).toHaveCount(0);
    await expect(page.getByTestId('pending-class-row-class-reject-001')).toBeVisible();
    await expect(page.getByTestId('pending-summary-classes')).toContainText('1');
    await expect(page.getByTestId('nav-badge-pending')).toHaveText('1');
    await batch.step('pending-class-approved');

    let rejectPromptType = '';
    let rejectPromptMessage = '';
    const rejectPromptHandled = new Promise<void>((resolve, reject) => {
      page.once('dialog', async (dialog) => {
        try {
          rejectPromptType = dialog.type();
          rejectPromptMessage = dialog.message();
          await dialog.accept('Khong phu hop so buoi');
          resolve();
        } catch (error) {
          reject(error);
        }
      });
    });

    await page.getByTestId('pending-class-reject-class-reject-001').click();
    await rejectPromptHandled;

    await expect.poll(() => rejectPromptType).toBe('prompt');
    await expect.poll(() => rejectPromptMessage).toBe('Ly do tu choi (co the bo trong):');
    await expect.poll(routes.getRejectCallCount).toBe(1);
    await expect.poll(() => routes.getRejectBodies().length).toBe(1);
    expect(routes.getRejectBodies()[0]).toEqual({ reason: 'Khong phu hop so buoi' });

    await expect(page.getByTestId('pending-class-row-class-reject-001')).toHaveCount(0);
    await expect(page.getByTestId('pending-empty-classes')).toBeVisible();
    await expect(page.getByTestId('pending-summary-classes')).toContainText('0');
    await expect(page.getByTestId('nav-badge-pending')).toHaveText('0');
    await batch.step('pending-class-rejected');

    await batch.finalize('PASS', {
      extraLines: [
        'Verified director can approve a pending class update and the classes tab reload removes that row: PASS',
        'Verified class summary count and sidebar badge drop from 2 to 1 after approve: PASS',
        'Verified reject flow opens the exact prompt and sends strict payload with rejection reason: PASS',
        'Verified rejecting the remaining class request reloads the classes tab into its empty state and drops counts to 0: PASS',
      ],
    });
  } catch (error) {
    await batch.finalize('FAIL', { error });
    throw error;
  }
});
