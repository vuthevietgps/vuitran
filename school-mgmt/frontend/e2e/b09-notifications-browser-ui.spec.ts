import { expect, test, type APIRequestContext, type Browser, type Page } from '@playwright/test';
import { applySessionCookies, createBatchEvidenceContext, loginAsRole, type BatchEvidenceSession } from './support';

const APP_BASE_URL =
  process.env['PLAYWRIGHT_BASE_URL'] ||
  process.env['E2E_BASE_URL'] ||
  'http://localhost:4200';
const APP_ORIGIN = new URL(APP_BASE_URL).origin;
const RUN_DATE = process.env['UI_EVIDENCE_DATE'] || new Date().toISOString().slice(0, 10);

test.use({
  trace: 'off',
  video: 'on',
});

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
  pages: NotificationItem[][];
  markReadIds: string[];
  markAllCalls: number;
  listRequests: string[];
  unreadCountRequests: number;
  unreadCountOverride: number | null;
};

function appUrl(path: string): string {
  return new URL(path, APP_BASE_URL).toString();
}

function nowIso(): string {
  return new Date().toISOString();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildNotificationState(): NotificationState {
  return {
    pages: [
      [
        {
          _id: 'notif-ticket-open',
          title: 'Ticket qua han can xu ly',
          message: 'Ticket REFUND-001 da qua SLA va can OPS tiep nhan ngay.',
          type: 'TICKET_OVERDUE',
          priority: 'URGENT',
          isRead: false,
          createdAt: nowIso(),
          link: '/app/notifications?linked=ticket-overdue',
        },
        {
          _id: 'notif-wallet-low',
          title: 'So du vi sap can',
          message: 'Reserve 3 thang dang thap hon muc canh bao noi bo.',
          type: 'WALLET_LOW_BALANCE',
          priority: 'HIGH',
          isRead: false,
          createdAt: nowIso(),
          link: '/app/notifications?linked=wallet-low-balance',
        },
        {
          _id: 'notif-system-read',
          title: 'Cap nhat he thong',
          message: 'Thong bao he thong da duoc doc truoc do.',
          type: 'SYSTEM',
          priority: 'LOW',
          isRead: true,
          createdAt: nowIso(),
        },
      ],
      [
        {
          _id: 'notif-session-reminder',
          title: 'Nhac lich hoc ngay mai',
          message: 'Hoc sinh Minh Anh co lich hoc ngay mai luc 19:00.',
          type: 'SESSION_CONFLICT',
          priority: 'MEDIUM',
          isRead: false,
          createdAt: nowIso(),
          link: '/app/notifications?linked=session-reminder',
        },
      ],
    ],
    markReadIds: [],
    markAllCalls: 0,
    listRequests: [],
    unreadCountRequests: 0,
    unreadCountOverride: null,
  };
}

function unreadItems(state: NotificationState): NotificationItem[] {
  return state.pages.flat().filter((item) => !item.isRead);
}

async function routeNotificationApis(page: Page, state: NotificationState): Promise<void> {
  await page.route(/\/notifications(?:\/[^/?]+\/read|\/mark-all-read|\/unread-count)?(?:\?.*)?$/, async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (url.origin === APP_ORIGIN) {
      await route.continue();
      return;
    }

    const method = request.method();
    const path = url.pathname;

    if (path.endsWith('/notifications/unread-count') && method === 'GET') {
      state.unreadCountRequests += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ count: state.unreadCountOverride ?? unreadItems(state).length }),
      });
      return;
    }

    if (path.endsWith('/notifications/mark-all-read') && method === 'PATCH') {
      state.markAllCalls += 1;
      await sleep(350);
      state.pages = state.pages.map((items) => items.map((item) => ({ ...item, isRead: true })));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
      return;
    }

    const markReadMatch = path.match(/\/notifications\/([^/]+)\/read$/);
    if (markReadMatch && method === 'PATCH') {
      const notificationId = markReadMatch[1];
      state.markReadIds.push(notificationId);
      await sleep(250);
      state.pages = state.pages.map((items) =>
        items.map((item) => (item._id === notificationId ? { ...item, isRead: true } : item)),
      );
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
      return;
    }

    if (path.endsWith('/notifications') && method === 'GET') {
      state.listRequests.push(url.search);
      const requestedPage = Number(url.searchParams.get('page') || '1');
      const unreadOnly = url.searchParams.get('unreadOnly') === 'true';

      let data: NotificationItem[] = [];
      let totalPages = 1;
      if (unreadOnly) {
        const unread = unreadItems(state);
        data = requestedPage === 1 ? unread : [];
        totalPages = unread.length > 0 ? 1 : 1;
      } else {
        data = state.pages[requestedPage - 1] || [];
        totalPages = state.pages.length;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data,
          totalPages,
          unreadCount: unreadItems(state).length,
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
}

async function openParentEvidencePage(
  browser: Browser,
  request: APIRequestContext,
  scenario: string,
  setup: (page: Page) => Promise<void> | void,
): Promise<BatchEvidenceSession> {
  const parentSession = await loginAsRole(request, 'parent');
  const evidence = await createBatchEvidenceContext(browser, {
    batchId: 'B09',
    scenario,
    runDate: RUN_DATE,
  });
  await applySessionCookies(evidence.context, parentSession);
  await setup(evidence.page);
  await evidence.page.goto(appUrl('/app/notifications'));
  await evidence.page.waitForLoadState('domcontentloaded');
  return evidence;
}

async function accelerateUnreadPolling(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const originalSetInterval = window.setInterval.bind(window);
    window.setInterval = ((handler: TimerHandler, timeout?: number, ...args: any[]) => {
      const nextTimeout = timeout === 30000 ? 100 : timeout;
      return originalSetInterval(handler, nextTimeout as number, ...args);
    }) as typeof window.setInterval;
  });
}

test.describe.serial('B09 notifications browser flows', () => {
  test('B09 parent click unread notification marks read and follows notification link', async ({ browser, request }) => {
    test.slow();
    test.setTimeout(240_000);

    const state = buildNotificationState();
    const evidence = await openParentEvidencePage(
      browser,
      request,
      'notifications_browser_click_route',
      async (page) => {
        await routeNotificationApis(page, state);
      },
    );

    try {
      const headerUnreadBadge = evidence.page.locator('.header-actions .unread-badge');
      const overdueCard = evidence.page.locator('.notification-item').filter({ hasText: 'Ticket qua han can xu ly' }).first();

      await expect(headerUnreadBadge).toHaveText(/3 chưa đọc/i);
      await expect(overdueCard).toHaveClass(/unread/);
      await expect(evidence.page.locator('.notification-item.unread')).toHaveCount(2);

      await overdueCard.click();
      await expect.poll(() => state.markReadIds).toContain('notif-ticket-open');
      await evidence.page.waitForURL(/linked=ticket-overdue/);
      await expect(headerUnreadBadge).toHaveText(/2 chưa đọc/i);
      await expect(overdueCard).not.toHaveClass(/unread/);
      await expect(evidence.page.locator('.notification-item.unread')).toHaveCount(1);
      await expect.poll(() => state.listRequests.some((query) => query.includes('linked=ticket-overdue'))).toBe(false);
      await evidence.step('01-click-unread-mark-read-route');

      evidence.note('Unread notification click now proves mark-as-read mutation and router navigation via notification link.');
      await evidence.finalize('PASS', {
        extraLines: [
          'Unread notification click decremented header badge: PASS',
          'Notification link navigation kept browser on linked URL: PASS',
        ],
      });
    } catch (error) {
      await evidence.finalize('FAIL', { error });
      throw error;
    }
  });

  test('B09 notifications unread filter, pagination, and mark-all keep list state coherent', async ({ browser, request }) => {
    test.slow();
    test.setTimeout(240_000);

    const state = buildNotificationState();
    const evidence = await openParentEvidencePage(
      browser,
      request,
      'notifications_browser_filter_pagination',
      async (page) => {
        await routeNotificationApis(page, state);
      },
    );

    try {
      const pageLabel = evidence.page.locator('.pagination span');
      const unreadFilter = evidence.page.locator('.filter-select');
      const headerUnreadBadge = evidence.page.locator('.header-actions .unread-badge');

      await expect(pageLabel).toHaveText(/Trang 1\/2/i);
      await evidence.page.locator('.pagination button').last().click();
      await expect(pageLabel).toHaveText(/Trang 2\/2/i);
      await expect(evidence.page.locator('.notification-item')).toHaveCount(1);
      await expect(evidence.page.locator('.notification-item')).toContainText('Nhac lich hoc ngay mai');
      await evidence.step('01-pagination-page-two');

      await evidence.page.locator('.pagination button').first().click();
      await expect(pageLabel).toHaveText(/Trang 1\/2/i);
      await unreadFilter.selectOption('unread');
      await expect.poll(() => state.listRequests.some((query) => query.includes('unreadOnly=true'))).toBe(true);
      await expect(evidence.page.locator('.notification-item')).toHaveCount(3);
      await expect(evidence.page.locator('.notification-item.unread')).toHaveCount(3);
      await evidence.step('02-unread-filter-list');

      await evidence.page.getByRole('button', { name: /Đánh dấu tất cả đã đọc/i }).click();
      await expect.poll(() => state.markAllCalls).toBe(1);
      await expect(headerUnreadBadge).toHaveCount(0);
      await expect(evidence.page.locator('.notification-item.unread')).toHaveCount(0);

      await unreadFilter.selectOption('all');
      await unreadFilter.selectOption('unread');
      await expect(evidence.page.locator('.empty')).toContainText('Không có thông báo nào');
      await evidence.step('03-mark-all-read-empty-unread');

      evidence.note('Notifications page now proves pagination, unread-only filtering, and mark-all-read state reset without leaving stale unread UI behind.');
      await evidence.finalize('PASS', {
        extraLines: [
          'Notifications pagination across two pages: PASS',
          'Unread-only filter and mark-all-read state reset: PASS',
        ],
      });
    } catch (error) {
      await evidence.finalize('FAIL', { error });
      throw error;
    }
  });

  test('B09 notifications unread polling updates the badge without duplicating list state', async ({ browser, request }) => {
    test.slow();
    test.setTimeout(240_000);

    const state = buildNotificationState();
    const evidence = await openParentEvidencePage(
      browser,
      request,
      'notifications_browser_unread_polling',
      async (page) => {
        await accelerateUnreadPolling(page);
        await routeNotificationApis(page, state);
      },
    );

    try {
      const headerUnreadBadge = evidence.page.locator('.header-actions .unread-badge');
      const notificationItems = evidence.page.locator('.notification-item');

      await expect(headerUnreadBadge).toHaveText(/3 chưa đọc/i);
      await expect(notificationItems).toHaveCount(3);
      await expect.poll(() => state.unreadCountRequests).toBeGreaterThanOrEqual(1);

      state.unreadCountOverride = 1;
      const unreadCountRequestsBeforeSecondPoll = state.unreadCountRequests;
      await expect.poll(() => state.unreadCountRequests).toBeGreaterThan(unreadCountRequestsBeforeSecondPoll);
      await expect(headerUnreadBadge).toHaveText(/1 chưa đọc/i);
      await expect(notificationItems).toHaveCount(3);
      await expect(notificationItems.filter({ hasText: 'Ticket qua han can xu ly' })).toHaveCount(1);
      await expect.poll(() => state.listRequests.length).toBe(1);
      await evidence.step('01-unread-polling-badge-only');

      state.unreadCountOverride = 4;
      const unreadCountRequestsBeforeThirdPoll = state.unreadCountRequests;
      await expect.poll(() => state.unreadCountRequests).toBeGreaterThan(unreadCountRequestsBeforeThirdPoll);
      await expect(headerUnreadBadge).toHaveText(/4 chưa đọc/i);
      await expect(notificationItems).toHaveCount(3);
      await expect(notificationItems.filter({ hasText: 'So du vi sap can' })).toHaveCount(1);
      await expect.poll(() => state.listRequests.length).toBe(1);
      await evidence.step('02-unread-polling-no-list-duplication');

      evidence.note('Unread polling now proves badge refresh is driven by the unread-count endpoint and does not duplicate or refetch the current list.');
      await evidence.finalize('PASS', {
        extraLines: [
          'Unread count polling refreshed the header badge without touching the current list payload: PASS',
          'Repeated polling did not duplicate notification rows or trigger an extra list fetch: PASS',
        ],
      });
    } catch (error) {
      await evidence.finalize('FAIL', { error });
      throw error;
    }
  });
});
