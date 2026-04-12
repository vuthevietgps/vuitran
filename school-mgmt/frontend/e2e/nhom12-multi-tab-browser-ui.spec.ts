import { expect, test, type APIRequestContext, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { applySessionCookies, createBatchEvidenceContext, loginAsRole, type BatchEvidenceSession } from './support';

const APP_BASE_URL =
  process.env['PLAYWRIGHT_BASE_URL'] ||
  process.env['E2E_BASE_URL'] ||
  'http://localhost:4200';
const APP_ORIGIN = new URL(APP_BASE_URL).origin;
const RUN_DATE = process.env['UI_EVIDENCE_DATE'] || new Date().toISOString().slice(0, 10);

const NOTIFICATIONS_API = /\/notifications(?:\/[^/?]+\/read|\/mark-all-read|\/unread-count)?(?:\?.*)?$/;
const PENDING_APPROVALS_API = /^https?:\/\/[^/]+:3000\/pending-approvals(?:\?.*)?$/;
const PENDING_APPROVALS_SUMMARY_API = /^https?:\/\/[^/]+:3000\/pending-approvals\/summary(?:\?.*)?$/;

test.use({
  trace: 'off',
  video: 'on',
});

function appUrl(path: string): string {
  return new URL(path, APP_BASE_URL).toString();
}

function nowIso(offsetMinutes = 0): string {
  return new Date(Date.now() + (offsetMinutes * 60 * 1000)).toISOString();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

type NotificationItem = {
  _id: string;
  title: string;
  message: string;
  type: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  isRead: boolean;
  createdAt: string;
  link?: string;
};

type NotificationState = {
  items: NotificationItem[];
  unreadCountRequests: number;
  markReadIds: string[];
  listRequests: string[];
};

type PendingState = {
  classPending: boolean;
  approveCalls: number;
  summaryRequests: number;
};

async function openDirectorMultiTabEvidence(
  browser: Browser,
  request: APIRequestContext,
  scenario: string,
): Promise<BatchEvidenceSession> {
  const directorSession = await loginAsRole(request, 'director');
  const evidence = await createBatchEvidenceContext(browser, {
    batchId: 'NHOM12',
    scenario,
    runDate: RUN_DATE,
  });
  await applySessionCookies(evidence.context, directorSession);
  return evidence;
}

async function gotoApp(page: Page, path: string): Promise<void> {
  await page.goto(appUrl(path));
  await page.waitForLoadState('domcontentloaded');
}

function buildNotificationState(): NotificationState {
  return {
    items: [
      {
        _id: 'notif-ticket-overdue',
        title: 'Ticket qua han can xu ly',
        message: 'Ticket REFUND-001 da qua SLA va can tiep nhan.',
        type: 'TICKET_OVERDUE',
        priority: 'URGENT',
        isRead: false,
        createdAt: nowIso(-30),
        link: '/app/tickets?tab=assigned',
      },
      {
        _id: 'notif-wallet-low',
        title: 'So du vi sap can',
        message: 'Reserve 3 thang dang thap hon muc canh bao noi bo.',
        type: 'WALLET_LOW_BALANCE',
        priority: 'HIGH',
        isRead: false,
        createdAt: nowIso(-20),
        link: '/app/wallets',
      },
      {
        _id: 'notif-payroll-open',
        title: 'Bang luong dang cho duyet',
        message: 'Co mot bang luong moi dang cho Director duyet.',
        type: 'PAYROLL_PENDING',
        priority: 'MEDIUM',
        isRead: false,
        createdAt: nowIso(-10),
        link: '/app/pending-approvals?tab=payroll',
      },
    ],
    unreadCountRequests: 0,
    markReadIds: [],
    listRequests: [],
  };
}

function unreadNotificationCount(state: NotificationState): number {
  return state.items.filter((item) => !item.isRead).length;
}

async function routeNotificationApis(
  context: BrowserContext,
  state: NotificationState,
  pendingCount = 0,
): Promise<void> {
  await context.route(NOTIFICATIONS_API, async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (url.origin === APP_ORIGIN) {
      await route.continue();
      return;
    }

    if (url.pathname.endsWith('/notifications/unread-count') && request.method() === 'GET') {
      state.unreadCountRequests += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ count: unreadNotificationCount(state) }),
      });
      return;
    }

    const markReadMatch = url.pathname.match(/\/notifications\/([^/]+)\/read$/);
    if (markReadMatch && request.method() === 'PATCH') {
      const notificationId = markReadMatch[1];
      state.markReadIds.push(notificationId);
      await sleep(250);
      state.items = state.items.map((item) => (
        item._id === notificationId
          ? { ...item, isRead: true }
          : item
      ));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
      return;
    }

    if (url.pathname.endsWith('/notifications') && request.method() === 'GET') {
      state.listRequests.push(url.search);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: clone(state.items),
          totalPages: 1,
          unreadCount: unreadNotificationCount(state),
        }),
      });
      return;
    }

    await route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Unhandled notifications route' }),
    });
  });

  await context.route(PENDING_APPROVALS_SUMMARY_API, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ totalPending: pendingCount }),
    });
  });
}

function buildPendingPayload(state: PendingState) {
  return {
    summary: {
      totalPending: Number(state.classPending),
      pendingPayrolls: 0,
      pendingInvoices: 0,
      pendingTopUps: 0,
      pendingTeachers: 0,
      pendingClassUpdates: Number(state.classPending),
      pendingSessionChangeRequests: 0,
      openTickets: 0,
    },
    payrolls: [],
    invoices: [],
    topUps: [],
    teachers: [],
    classes: state.classPending
      ? [
          {
            _id: 'class-001',
            code: 'CLS001',
            name: 'Class One',
            sale: { fullName: 'Sale One' },
            pendingSaleUpdate: {
              status: 'PENDING',
              requestedBy: { fullName: 'Sale One' },
              requestedAt: '2026-04-08T00:00:00.000Z',
              requestedChanges: { sessionDuration: 90 },
              changeSummary: [
                {
                  label: 'Thoi luong buoi hoc',
                  beforeValue: '60 phut',
                  afterValue: '90 phut',
                },
              ],
            },
          },
        ]
      : [],
    sessionChanges: [],
  };
}

async function routePendingApis(
  context: BrowserContext,
  state: PendingState,
  unreadCount = 0,
): Promise<void> {
  await context.route(PENDING_APPROVALS_API, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(buildPendingPayload(state)),
    });
  });

  await context.route(PENDING_APPROVALS_SUMMARY_API, async (route) => {
    state.summaryRequests += 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ totalPending: Number(state.classPending) }),
    });
  });

  await context.route('**/classes/class-001/pending-sale-update/approve', async (route) => {
    state.approveCalls += 1;
    await sleep(250);
    state.classPending = false;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true }),
    });
  });

  await context.route(/\/notifications\/unread-count(?:\?.*)?$/, async (route) => {
    const url = new URL(route.request().url());
    if (url.origin === APP_ORIGIN) {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ count: unreadCount }),
    });
  });
}

async function openSecondTab(context: BrowserContext, path: string): Promise<Page> {
  const page = await context.newPage();
  await gotoApp(page, path);
  return page;
}

async function triggerForegroundRefresh(page: Page): Promise<void> {
  await page.bringToFront();
  await page.evaluate(() => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
}

test.describe.serial('NHOM12 multi-tab browser flows', () => {
  test('NHOM12 unread badge refreshes when another tab marks a notification as read', async ({ browser, request }) => {
    const state = buildNotificationState();
    const evidence = await openDirectorMultiTabEvidence(browser, request, 'multi_tab_notifications_state_sync');

    try {
      await routeNotificationApis(evidence.context, state, 0);

      await gotoApp(evidence.page, '/app/internal-handbook');
      await expect(evidence.page.getByTestId('internal-handbook-page')).toBeVisible();
      const primaryBadge = evidence.page.getByTestId('nav-badge-notifications');
      await expect(primaryBadge).toHaveText('3');
      await evidence.step('01-primary-tab-before-cross-tab-read');

      const secondTab = await openSecondTab(evidence.context, '/app/notifications');
      const unreadCard = secondTab.locator('.notification-item').filter({ hasText: 'Ticket qua han can xu ly' }).first();
      await expect(unreadCard).toHaveClass(/unread/);
      await unreadCard.click();
      await expect.poll(() => state.markReadIds).toContain('notif-ticket-overdue');
      await expect(secondTab).toHaveURL(/\/app\/tickets\?tab=assigned$/);
      await evidence.step('02-secondary-tab-marked-read', secondTab);

      await expect(primaryBadge).toHaveText('3');
      await triggerForegroundRefresh(evidence.page);
      await expect(primaryBadge).toHaveText('2');
      await evidence.step('03-primary-tab-after-foreground-refresh');

      evidence.note('Unread notification badge stayed stale in the background tab until foreground refresh, then synced to the backend-mutated count from the second tab.');
      await evidence.finalize('PASS', {
        extraLines: [
          'Primary tab kept unread badge at 3 before regaining focus: PASS',
          'Secondary tab marked one notification as read and navigated via link: PASS',
          'Primary tab refreshed unread badge to 2 after foreground visibilitychange: PASS',
        ],
      });
    } catch (error) {
      await evidence.finalize('FAIL', { error });
      throw error;
    }
  });

  test('NHOM12 pending approvals badge refreshes when another tab approves a pending class update', async ({ browser, request }) => {
    const state: PendingState = {
      classPending: true,
      approveCalls: 0,
      summaryRequests: 0,
    };
    const evidence = await openDirectorMultiTabEvidence(browser, request, 'multi_tab_pending_state_sync');

    try {
      await routePendingApis(evidence.context, state, 0);

      await gotoApp(evidence.page, '/app/internal-handbook');
      await expect(evidence.page.getByTestId('internal-handbook-page')).toBeVisible();
      const primaryPendingBadge = evidence.page.getByTestId('nav-badge-pending');
      await expect(primaryPendingBadge).toHaveText('1');
      await evidence.step('01-primary-tab-before-cross-tab-approve');

      const secondTab = await openSecondTab(evidence.context, '/app/pending-approvals?tab=classes');
      await expect(secondTab.getByTestId('pending-approvals-page')).toBeVisible();
      const pendingRow = secondTab.getByTestId('pending-class-row-class-001');
      await expect(pendingRow).toBeVisible();
      await secondTab.getByTestId('pending-class-approve-class-001').click();
      await expect(pendingRow).toHaveCount(0);
      await expect(secondTab.getByTestId('pending-empty-classes')).toBeVisible();
      await expect.poll(() => state.approveCalls).toBe(1);
      await evidence.step('02-secondary-tab-approved-class-update', secondTab);

      await expect(primaryPendingBadge).toHaveText('1');
      await triggerForegroundRefresh(evidence.page);
      await expect(primaryPendingBadge).toHaveCount(0);
      await evidence.step('03-primary-tab-after-pending-refresh');

      evidence.note('Pending approvals badge stayed at the previous count in the background tab until foreground refresh, then cleared after the second tab approved the only pending class update.');
      await evidence.finalize('PASS', {
        extraLines: [
          'Primary tab kept pending badge at 1 before regaining focus: PASS',
          'Secondary tab approved the only pending class update and cleared the pending list: PASS',
          'Primary tab removed the pending badge after foreground visibilitychange: PASS',
        ],
      });
    } catch (error) {
      await evidence.finalize('FAIL', { error });
      throw error;
    }
  });
});
