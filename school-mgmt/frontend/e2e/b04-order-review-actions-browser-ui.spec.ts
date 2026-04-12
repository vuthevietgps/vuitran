import { expect, test, type Browser, type Page } from '@playwright/test';
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

const RUN_DATE =
  process.env['UI_EVIDENCE_DATE'] ||
  process.env['E2E_RUN_DATE'] ||
  '2026-04-11';

const API_PREFIX_PATTERN = 'https?://(?:localhost|127\\.0\\.0\\.1):3000(?:/api)?';
const ORDERS_API = new RegExp(`^${API_PREFIX_PATTERN}/orders(?:/.*)?(?:\\?.*)?$`);
const USERS_PARENTS_API = new RegExp(`^${API_PREFIX_PATTERN}/users/parents(?:\\?.*)?$`);
const USERS_SALES_API = new RegExp(`^${API_PREFIX_PATTERN}/users/sales(?:\\?.*)?$`);
const USERS_TEACHERS_API = new RegExp(`^${API_PREFIX_PATTERN}/users/teachers(?:\\?.*)?$`);
const STUDENTS_API = new RegExp(`^${API_PREFIX_PATTERN}/students(?:\\?.*)?$`);
const PRODUCTS_API = new RegExp(`^${API_PREFIX_PATTERN}/products(?:\\?.*)?$`);
const CLASSES_API = new RegExp(`^${API_PREFIX_PATTERN}/classes(?:/sale-offline-options)?(?:\\?.*)?$`);

const NEEDS_INFO_REASON = 'Thiếu biên lai chuyển khoản của phụ huynh';
const REJECT_REASON = 'Sai gói học và sai số buổi trên đơn';

type OrderHarnessItem = {
  _id: string;
  orderCode: string;
  orderType: string;
  status: string;
  parentName: string;
  parentPhone: string;
  parentEmail?: string;
  studentName: string;
  studentCode?: string;
  studentLevel?: string;
  studentAge?: number;
  finalAmount: number;
  totalAmount: number;
  saleId: string;
  saleName?: string;
  items: Array<{
    productId: string;
    productName?: string;
    sessions: number;
    invoiceSessions?: number;
    sessionDuration: number;
    baseDuration?: number;
    pricePerSession: number;
    amount: number;
    subject?: string;
    teachingMode?: string;
  }>;
  createdAt?: string;
  paymentPlan?: string;
  paymentDate?: string;
  rejectionReason?: string;
  needsInfoReason?: string;
};

type OrderHarnessState = {
  items: OrderHarnessItem[];
  listUrls: string[];
  pipelineUrls: string[];
  requestInfoBodies: Array<{ id: string; body: unknown }>;
  rejectBodies: Array<{ id: string; body: unknown }>;
};

function appUrl(path: string): string {
  return new URL(path, APP_BASE_URL).toString();
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function orderRow(page: Page, orderCode: string) {
  return page.locator('[data-testid="order-row"]').filter({ hasText: orderCode }).first();
}

function buildState(): OrderHarnessState {
  return {
    items: [
      {
        _id: 'order-needs-info-001',
        orderCode: 'ODR-NEEDS-001',
        orderType: 'NEW_ENROLLMENT',
        status: 'SUBMITTED',
        parentName: 'Phu huynh Can Bo Sung',
        parentPhone: '0900111001',
        parentEmail: 'needs.info@school.local',
        studentName: 'Hoc sinh Can Bo Sung',
        studentCode: 'HS-NI-001',
        studentLevel: 'Movers',
        studentAge: 10,
        finalAmount: 2_400_000,
        totalAmount: 2_400_000,
        saleId: 'sale-001',
        saleName: 'Sale Alpha',
        paymentPlan: 'FULL',
        paymentDate: '2026-04-11',
        createdAt: '2026-04-11T01:00:00.000Z',
        items: [
          {
            productId: 'prod-001',
            productName: 'Khoa Toan Movers',
            sessions: 24,
            invoiceSessions: 24,
            sessionDuration: 90,
            baseDuration: 90,
            pricePerSession: 100_000,
            amount: 2_400_000,
            subject: 'Toan',
            teachingMode: 'ONLINE',
          },
        ],
      },
      {
        _id: 'order-reject-001',
        orderCode: 'ODR-REJECT-001',
        orderType: 'NEW_ENROLLMENT',
        status: 'SUBMITTED',
        parentName: 'Phu huynh Bi Tu Choi',
        parentPhone: '0900111002',
        parentEmail: 'reject.order@school.local',
        studentName: 'Hoc sinh Bi Tu Choi',
        studentCode: 'HS-RJ-001',
        studentLevel: 'Flyers',
        studentAge: 11,
        finalAmount: 3_100_000,
        totalAmount: 3_100_000,
        saleId: 'sale-001',
        saleName: 'Sale Alpha',
        paymentPlan: 'FULL',
        paymentDate: '2026-04-11',
        createdAt: '2026-04-11T01:05:00.000Z',
        items: [
          {
            productId: 'prod-002',
            productName: 'Khoa Anh Flyers',
            sessions: 31,
            invoiceSessions: 31,
            sessionDuration: 90,
            baseDuration: 90,
            pricePerSession: 100_000,
            amount: 3_100_000,
            subject: 'Anh',
            teachingMode: 'ONLINE',
          },
        ],
      },
    ],
    listUrls: [],
    pipelineUrls: [],
    requestInfoBodies: [],
    rejectBodies: [],
  };
}

function buildPipeline(state: OrderHarnessState) {
  const statuses = ['DRAFT', 'SUBMITTED', 'APPROVED', 'COMPLETED', 'REJECTED', 'NEEDS_INFO'] as const;
  const result: Record<string, { count: number; totalValue: number }> = {};
  for (const status of statuses) {
    const matched = state.items.filter((item) => item.status === status);
    result[status] = {
      count: matched.length,
      totalValue: matched.reduce((sum, item) => sum + item.finalAmount, 0),
    };
  }
  return result;
}

async function installSharedRoutes(page: Page): Promise<void> {
  await page.route(USERS_PARENTS_API, async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
  });
  await page.route(USERS_SALES_API, async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
  });
  await page.route(USERS_TEACHERS_API, async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
  });
  await page.route(STUDENTS_API, async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
  });
  await page.route(PRODUCTS_API, async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
  });
  await page.route(CLASSES_API, async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
  });
}

async function installOrderRoutes(page: Page, state: OrderHarnessState): Promise<void> {
  await page.route(ORDERS_API, async (route) => {
    const request = route.request();
    const method = request.method();
    const url = new URL(request.url());
    const pathname = url.pathname.replace(/^\/api/, '');

    if (method === 'GET' && pathname === '/orders') {
      state.listUrls.push(request.url());
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(clone(state.items)),
      });
      return;
    }

    if (method === 'GET' && pathname === '/orders/pipeline') {
      state.pipelineUrls.push(request.url());
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(buildPipeline(state)),
      });
      return;
    }

    if (method === 'POST' && pathname === '/orders/order-needs-info-001/request-info') {
      const body = request.postDataJSON() as { reason: string };
      state.requestInfoBodies.push({ id: 'order-needs-info-001', body });
      state.items = state.items.map((item) =>
        item._id === 'order-needs-info-001'
          ? { ...item, status: 'NEEDS_INFO', needsInfoReason: body.reason }
          : item,
      );
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
      return;
    }

    if (method === 'POST' && pathname === '/orders/order-reject-001/reject') {
      const body = request.postDataJSON() as { reason: string };
      state.rejectBodies.push({ id: 'order-reject-001', body });
      state.items = state.items.map((item) =>
        item._id === 'order-reject-001'
          ? { ...item, status: 'REJECTED', rejectionReason: body.reason }
          : item,
      );
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
      return;
    }

    await route.fallback();
  });
}

async function promptDialog(page: Page, action: () => Promise<void>, promptText: string): Promise<string> {
  const dialogPromise = page.waitForEvent('dialog');
  const actionPromise = action();
  const dialog = await dialogPromise;
  const message = dialog.message();
  await dialog.accept(promptText);
  await actionPromise;
  return message;
}

async function openOrdersPage(
  browser: Browser,
  scenario: string,
): Promise<{ evidence: BatchEvidenceSession; state: OrderHarnessState }> {
  const evidence = await createBatchEvidenceContext(browser, {
    batchId: 'B04',
    scenario,
    runDate: RUN_DATE,
  });

  const state = buildState();
  await installSharedRoutes(evidence.page);
  await installOrderRoutes(evidence.page, state);
  return { evidence, state };
}

test.use({
  trace: 'off',
  video: 'on',
});

test.describe.serial('B04 order review actions browser', () => {
  test('B04 request-more-info moves submitted order into NEEDS_INFO and surfaces the reason', async ({
    browser,
    request,
  }) => {
    test.slow();
    test.setTimeout(300_000);

    const { evidence, state } = await openOrdersPage(browser, 'order_request_info_browser');
    const directorSession = await loginAsRole(request, 'director');
    await applySessionCookies(evidence.page, directorSession);
    await evidence.page.goto(appUrl('/app/orders'));
    await evidence.page.waitForLoadState('domcontentloaded');

    try {
      await expect(evidence.page.locator('h2')).toContainText(/Đơn đăng ký học|Don dang ky hoc/i);
      await expect(evidence.page.locator('[data-testid="order-row"]')).toHaveCount(2);
      const row = orderRow(evidence.page, 'ODR-NEEDS-001');
      await expect(row).toBeVisible();
      await expect(row.locator('.badge')).toContainText(/Chờ duyệt|Cho duyet/i);
      await row.click();
      await expect(evidence.page.locator('[data-testid="order-detail-modal"]')).toBeVisible();

      const requestInfoRequest = evidence.page.waitForRequest((req) =>
        req.method() === 'POST' && req.url().includes('/orders/order-needs-info-001/request-info'));
      const promptMessage = await promptDialog(
        evidence.page,
        async () => {
          await evidence.page.getByTestId('order-detail-request-info').click();
        },
        NEEDS_INFO_REASON,
      );
      await requestInfoRequest;

      expect(promptMessage).toBe('Nội dung cần bổ sung:');
      expect(state.requestInfoBodies).toEqual([
        { id: 'order-needs-info-001', body: { reason: NEEDS_INFO_REASON } },
      ]);

      await expect(row.locator('.badge')).toContainText(/Cần bổ sung|Can bo sung/i);
      await row.click();
      await expect(evidence.page.locator('[data-testid="order-detail-modal"]')).toContainText(NEEDS_INFO_REASON);
      await expect(evidence.page.getByTestId('order-detail-submit')).toBeVisible();
      await expect(evidence.page.getByTestId('order-detail-edit')).toBeVisible();
      await expect(evidence.page.getByTestId('order-detail-approve')).toHaveCount(0);
      await evidence.step('01-request-info-reflected');

      await evidence.finalize('PASS', {
        extraLines: [
          `Request-info prompt: ${promptMessage}`,
          `Request-info body: ${JSON.stringify(state.requestInfoBodies[0]?.body || null)}`,
          'Browser evidence proves request-more-info changes row badge to NEEDS_INFO, preserves edit/resubmit affordances, and surfaces the reason in detail without weakening any oracle.',
        ],
      });
    } catch (error) {
      await evidence.finalize('FAIL', { error });
      throw error;
    }
  });

  test('B04 reject order moves submitted order into REJECTED and surfaces rejection reason', async ({
    browser,
    request,
  }) => {
    test.slow();
    test.setTimeout(300_000);

    const { evidence, state } = await openOrdersPage(browser, 'order_reject_browser');
    const directorSession = await loginAsRole(request, 'director');
    await applySessionCookies(evidence.page, directorSession);
    await evidence.page.goto(appUrl('/app/orders'));
    await evidence.page.waitForLoadState('domcontentloaded');

    try {
      await expect(evidence.page.locator('[data-testid="order-row"]')).toHaveCount(2);
      const row = orderRow(evidence.page, 'ODR-REJECT-001');
      await expect(row).toBeVisible();
      await expect(row.locator('.badge')).toContainText(/Chờ duyệt|Cho duyet/i);
      await row.click();
      await expect(evidence.page.locator('[data-testid="order-detail-modal"]')).toBeVisible();

      const rejectRequest = evidence.page.waitForRequest((req) =>
        req.method() === 'POST' && req.url().includes('/orders/order-reject-001/reject'));
      const promptMessage = await promptDialog(
        evidence.page,
        async () => {
          await evidence.page.getByTestId('order-detail-reject').click();
        },
        REJECT_REASON,
      );
      await rejectRequest;

      expect(promptMessage).toBe('Lý do từ chối:');
      expect(state.rejectBodies).toEqual([
        { id: 'order-reject-001', body: { reason: REJECT_REASON } },
      ]);

      await expect(row.locator('.badge')).toContainText(/Từ chối|Tu choi/i);
      await row.click();
      await expect(evidence.page.locator('[data-testid="order-detail-modal"]')).toContainText(REJECT_REASON);
      await expect(evidence.page.getByTestId('order-detail-submit')).toHaveCount(0);
      await expect(evidence.page.getByTestId('order-detail-approve')).toHaveCount(0);
      await expect(evidence.page.getByTestId('order-detail-reject')).toHaveCount(0);
      await evidence.step('01-reject-reflected');

      await evidence.finalize('PASS', {
        extraLines: [
          `Reject prompt: ${promptMessage}`,
          `Reject body: ${JSON.stringify(state.rejectBodies[0]?.body || null)}`,
          'Browser evidence proves reject-order changes row badge to REJECTED and surfaces the rejection reason in detail without weakening any oracle.',
        ],
      });
    } catch (error) {
      await evidence.finalize('FAIL', { error });
      throw error;
    }
  });
});
