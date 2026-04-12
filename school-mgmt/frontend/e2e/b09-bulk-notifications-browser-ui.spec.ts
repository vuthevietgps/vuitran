import { expect, test, type APIRequestContext, type Browser, type Page } from '@playwright/test';
import {
  applySessionCookies,
  createBatchEvidenceContext,
  loginAsRole,
  type BatchEvidenceSession,
} from './support';

const APP_BASE_URL =
  process.env['PLAYWRIGHT_BASE_URL'] ||
  process.env['E2E_BASE_URL'] ||
  'http://localhost:4200';
const APP_ORIGIN = new URL(APP_BASE_URL).origin;
const RUN_DATE =
  process.env['UI_EVIDENCE_DATE'] ||
  process.env['E2E_RUN_DATE'] ||
  '2026-04-11';

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

type BulkPreviewPayload = {
  recipientGroup: string;
  title: string;
  message: string;
  priority: string;
  link?: string;
};

type NotificationState = {
  pages: NotificationItem[][];
  listRequests: string[];
  unreadCountRequests: number;
  previewBodies: BulkPreviewPayload[];
  sendBodies: BulkPreviewPayload[];
};

function appUrl(path: string): string {
  return new URL(path, APP_BASE_URL).toString();
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function nowIso(): string {
  return new Date().toISOString();
}

function buildNotificationState(): NotificationState {
  return {
    pages: [
      [
        {
          _id: 'notif-existing-bulk-001',
          title: 'Thong bao he thong cu',
          message: 'Thong bao da ton tai de giu inbox page khong rong.',
          type: 'SYSTEM',
          priority: 'LOW',
          isRead: false,
          createdAt: nowIso(),
        },
      ],
    ],
    listRequests: [],
    unreadCountRequests: 0,
    previewBodies: [],
    sendBodies: [],
  };
}

function buildPreviewResponse(body: BulkPreviewPayload) {
  return {
    recipientGroup: body.recipientGroup,
    recipientLabel: 'Phụ huynh',
    title: body.title,
    message: body.message,
    priority: body.priority,
    link: body.link,
    channels: ['IN_APP'],
    totalRecipients: 2,
    sampleRecipients: [
      {
        recipientId: 'parent-001',
        fullName: 'Nguyen Thi Lan',
        role: 'PARENT',
        email: 'lan.parent@example.com',
      },
      {
        recipientId: 'parent-002',
        fullName: 'Tran Van Minh',
        role: 'PARENT',
        email: 'minh.parent@example.com',
      },
    ],
  };
}

function buildSendResponse(body: BulkPreviewPayload) {
  return {
    ...buildPreviewResponse(body),
    successCount: 1,
    failedCount: 1,
    errors: [
      {
        recipientId: 'parent-002',
        recipientName: 'Tran Van Minh',
        recipientRole: 'PARENT',
        error: 'Email disabled for recipient',
      },
    ],
  };
}

async function routeNotificationApis(page: Page, state: NotificationState): Promise<void> {
  await page.route(/\/notifications(?:\/bulk-preview|\/bulk-send|\/unread-count)?(?:\?.*)?$/, async (route) => {
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
        body: JSON.stringify({ count: 1 }),
      });
      return;
    }

    if (path.endsWith('/notifications') && method === 'GET') {
      state.listRequests.push(url.search);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: clone(state.pages[0]),
          totalPages: 1,
          unreadCount: 1,
        }),
      });
      return;
    }

    if (path.endsWith('/notifications/bulk-preview') && method === 'POST') {
      const body = clone(request.postDataJSON() as BulkPreviewPayload);
      state.previewBodies.push(body);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(buildPreviewResponse(body)),
      });
      return;
    }

    if (path.endsWith('/notifications/bulk-send') && method === 'POST') {
      const body = clone(request.postDataJSON() as BulkPreviewPayload);
      state.sendBodies.push(body);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(buildSendResponse(body)),
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

async function openDirectorEvidencePage(
  browser: Browser,
  request: APIRequestContext,
  scenario: string,
  setup: (page: Page) => Promise<void> | void,
): Promise<BatchEvidenceSession> {
  const directorSession = await loginAsRole(request, 'director');
  const evidence = await createBatchEvidenceContext(browser, {
    batchId: 'B09',
    scenario,
    runDate: RUN_DATE,
  });
  await applySessionCookies(evidence.context, directorSession);
  await setup(evidence.page);
  await evidence.page.goto(appUrl('/app/notifications'));
  await evidence.page.waitForLoadState('domcontentloaded');
  return evidence;
}

async function clearViteOverlay(page: Page): Promise<void> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    if ((await page.locator('vite-error-overlay').count()) === 0) {
      return;
    }
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(150);
    if ((await page.locator('vite-error-overlay').count()) === 0) {
      return;
    }
    await page.reload({ waitUntil: 'domcontentloaded' });
  }
  await expect(page.locator('vite-error-overlay')).toHaveCount(0);
}

test.use({
  trace: 'off',
  video: 'on',
});

test('B09 admin bulk notifications choose the exact recipient group, preview exact content, and only send after confirm with visible success-failure results', async ({
  browser,
  request,
}) => {
  test.slow();
  test.setTimeout(300_000);

  const state = buildNotificationState();
  const evidence = await openDirectorEvidencePage(
    browser,
    request,
    'bulk_notifications_browser',
    async (page) => {
      await routeNotificationApis(page, state);
    },
  );

  const expectedPayload: BulkPreviewPayload = {
    recipientGroup: 'PARENTS',
    title: 'Thong bao lich nghi 30/4',
    message: 'Trung tam nghi hoc ngay 30/4 va hoc lai tu 02/5. Vui long kiem tra lich hoc da cap nhat.',
    priority: 'HIGH',
    link: '/app/notifications?campaign=holiday',
  };

  try {
    await clearViteOverlay(evidence.page);

    await expect(evidence.page.getByTestId('bulk-notification-card')).toBeVisible();
    await expect(evidence.page.getByTestId('bulk-confirm-button')).toBeDisabled();

    await evidence.page.getByTestId('bulk-recipient-group').selectOption(expectedPayload.recipientGroup);
    await evidence.page.getByTestId('bulk-priority').selectOption(expectedPayload.priority);
    await evidence.page.getByTestId('bulk-title').fill(expectedPayload.title);
    await evidence.page.getByTestId('bulk-message').fill(expectedPayload.message);
    await evidence.page.getByTestId('bulk-link').fill(expectedPayload.link || '');

    await evidence.page.getByTestId('bulk-preview-button').click();
    await expect.poll(() => state.previewBodies).toEqual([expectedPayload]);
    expect(state.sendBodies).toHaveLength(0);

    await expect(evidence.page.getByTestId('bulk-preview-group')).toHaveText('Phụ huynh');
    await expect(evidence.page.getByTestId('bulk-preview-total')).toHaveText('2 người nhận');
    await expect(evidence.page.getByTestId('bulk-preview-priority')).toHaveText('Quan trọng');
    await expect(evidence.page.getByTestId('bulk-preview-title')).toHaveText(expectedPayload.title);
    await expect(evidence.page.getByTestId('bulk-preview-message')).toHaveText(expectedPayload.message);
    await expect(evidence.page.getByTestId('bulk-preview-link')).toHaveText(expectedPayload.link || '');
    await expect(evidence.page.getByTestId('bulk-preview-recipient')).toHaveCount(2);
    await expect(evidence.page.getByTestId('bulk-preview-panel')).toContainText('Nguyen Thi Lan');
    await expect(evidence.page.getByTestId('bulk-preview-panel')).toContainText('Tran Van Minh');
    await evidence.step('01-bulk-notification-preview');

    await evidence.page.getByTestId('bulk-confirm-button').click();
    await expect.poll(() => state.sendBodies).toEqual([expectedPayload]);
    await expect(evidence.page.getByTestId('bulk-result-summary')).toHaveText('Thành công 1, Lỗi 1');
    await expect(evidence.page.getByTestId('bulk-result-error')).toHaveCount(1);
    await expect(evidence.page.getByTestId('bulk-result-panel')).toContainText('Tran Van Minh');
    await expect(evidence.page.getByTestId('bulk-result-panel')).toContainText('Phụ huynh');
    await expect(evidence.page.getByTestId('bulk-result-panel')).toContainText('Email disabled for recipient');
    await evidence.step('02-bulk-notification-confirm-result');

    expect(state.listRequests.length).toBeGreaterThanOrEqual(2);
    await evidence.finalize('PASS', {
      extraLines: [
        `Preview payload count: ${state.previewBodies.length}.`,
        `Send payload count: ${state.sendBodies.length}.`,
        'Browser evidence proves admin bulk notifications keep exact recipient-group selection, preview the exact composed content before confirm, and then surface partial success with an ordered failure row.',
      ],
    });
  } catch (error) {
    await evidence.finalize('FAIL', { error });
    throw error;
  }
});
