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
const LEADS_API = new RegExp(`^${API_PREFIX_PATTERN}/leads(?:/.*)?(?:\\?.*)?$`);
const USERS_SALES_API = new RegExp(`^${API_PREFIX_PATTERN}/users/sales(?:\\?.*)?$`);
const USERS_PARENTS_API = new RegExp(`^${API_PREFIX_PATTERN}/users/parents(?:\\?.*)?$`);
const USERS_TEACHERS_API = new RegExp(`^${API_PREFIX_PATTERN}/users/teachers(?:\\?.*)?$`);
const STUDENTS_API = new RegExp(`^${API_PREFIX_PATTERN}/students(?:\\?.*)?$`);
const PRODUCTS_API = new RegExp(`^${API_PREFIX_PATTERN}/products(?:\\?.*)?$`);
const CLASSES_API = new RegExp(`^${API_PREFIX_PATTERN}/classes(?:/sale-offline-options)?(?:\\?.*)?$`);
const ORDERS_API = new RegExp(`^${API_PREFIX_PATTERN}/orders(?:/.*)?(?:\\?.*)?$`);

type LeadHarnessItem = {
  _id: string;
  leadCode: string;
  parentName: string;
  parentPhone: string;
  parentEmail?: string;
  studentName?: string;
  studentGrade?: string;
  source: string;
  status: string;
  saleId?: string | null;
  saleName?: string;
  estimatedValue?: number;
  createdAt: string;
};

type HarnessState = {
  lead: LeadHarnessItem;
  listUrls: string[];
  pipelineUrls: string[];
  convertBodies: Array<{ id: string; body: unknown }>;
  leadDetailUrls: string[];
  orderListUrls: string[];
  orderPipelineUrls: string[];
};

function appUrl(path: string): string {
  return new URL(path, APP_BASE_URL).toString();
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function leadRow(page: Page, leadCode: string) {
  return page.locator('table.data tbody tr').filter({ hasText: leadCode }).first();
}

function buildState(): HarnessState {
  return {
    lead: {
      _id: 'lead-convert-001',
      leadCode: 'LEAD-CONVERT-001',
      parentName: 'Phu huynh Convert',
      parentPhone: '0900111222',
      parentEmail: 'convert.parent@school.local',
      studentName: 'Hoc sinh Convert',
      studentGrade: 'Lop 5',
      source: 'OTHER',
      status: 'INTERESTED',
      saleId: 'sale-001',
      saleName: 'Sale Alpha',
      estimatedValue: 1_900_000,
      createdAt: '2026-04-09T03:00:00.000Z',
    },
    listUrls: [],
    pipelineUrls: [],
    convertBodies: [],
    leadDetailUrls: [],
    orderListUrls: [],
    orderPipelineUrls: [],
  };
}

async function installRoutes(page: Page, state: HarnessState): Promise<void> {
  await page.route(USERS_SALES_API, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          _id: 'sale-001',
          fullName: 'Sale Alpha',
          email: 'sale.alpha@school.local',
          role: 'SALE',
        },
      ]),
    });
  });

  await page.route(USERS_PARENTS_API, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });

  await page.route(USERS_TEACHERS_API, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });

  await page.route(STUDENTS_API, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });

  await page.route(PRODUCTS_API, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });

  await page.route(CLASSES_API, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });

  await page.route(ORDERS_API, async (route) => {
    const request = route.request();
    const method = request.method();
    const url = new URL(request.url());
    const pathname = url.pathname.replace(/^\/api/, '');

    if (method === 'GET' && pathname === '/orders') {
      state.orderListUrls.push(request.url());
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
      return;
    }

    if (method === 'GET' && pathname === '/orders/pipeline') {
      state.orderPipelineUrls.push(request.url());
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          DRAFT: { count: 0, totalValue: 0 },
          SUBMITTED: { count: 0, totalValue: 0 },
          APPROVED: { count: 0, totalValue: 0 },
          COMPLETED: { count: 0, totalValue: 0 },
        }),
      });
      return;
    }

    await route.fallback();
  });

  await page.route(LEADS_API, async (route) => {
    const request = route.request();
    const method = request.method();
    const url = new URL(request.url());
    const pathname = url.pathname.replace(/^\/api/, '');

    if (method === 'GET' && pathname === '/leads/pipeline') {
      state.pipelineUrls.push(request.url());
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          pipeline: {
            NEW: { count: 0, estimatedValue: 0 },
            CONTACTED: { count: 0, estimatedValue: 0 },
            CONSULTING: { count: 0, estimatedValue: 0 },
            INTERESTED: { count: 1, estimatedValue: state.lead.estimatedValue || 0 },
            CONVERTED: { count: 0, estimatedValue: 0 },
          },
          total: 1,
          conversionRate: 0,
          assignedCount: 1,
          unassignedCount: 0,
        }),
      });
      return;
    }

    if (method === 'GET' && pathname === '/leads/follow-ups') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
      return;
    }

    if (method === 'GET' && pathname === '/leads/pool/list') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
      return;
    }

    if (method === 'GET' && pathname === '/leads') {
      state.listUrls.push(request.url());
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([clone(state.lead)]),
      });
      return;
    }

    if (method === 'GET' && pathname === '/leads/lead-convert-001') {
      state.leadDetailUrls.push(request.url());
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(clone(state.lead)),
      });
      return;
    }

    if (method === 'POST' && pathname === '/leads/lead-convert-001/convert') {
      state.convertBodies.push({ id: 'lead-convert-001', body: request.postDataJSON() ?? null });
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          message: 'Lead da san sang tao don dang ky.',
          lead: {
            _id: state.lead._id,
            status: 'CONVERTED',
          },
        }),
      });
      return;
    }

    await route.fallback();
  });
}

async function openLeadsPage(
  browser: Browser,
  scenario: string,
): Promise<{ evidence: BatchEvidenceSession; state: HarnessState }> {
  const evidence = await createBatchEvidenceContext(browser, {
    batchId: 'B04',
    scenario,
    runDate: RUN_DATE,
  });

  const state = buildState();
  await installRoutes(evidence.page, state);
  return { evidence, state };
}

test.use({
  trace: 'off',
  video: 'on',
});

test.describe.serial('B04 lead convert to order browser', () => {
  test('B04 convert lead routes to orders create flow with exact prefilled lead data', async ({
    browser,
    request,
  }) => {
    test.slow();
    test.setTimeout(300_000);

    const { evidence, state } = await openLeadsPage(browser, 'lead_convert_order_browser');
    const directorSession = await loginAsRole(request, 'director');
    await applySessionCookies(evidence.page, directorSession);

    const dialogMessages: string[] = [];
    evidence.page.on('dialog', async (dialog) => {
      dialogMessages.push(dialog.message());
      await dialog.accept();
    });

    await evidence.page.goto(appUrl('/app/leads'));
    await evidence.page.waitForLoadState('domcontentloaded');

    try {
      await expect(evidence.page.locator('h2')).toContainText(/Lead/i);
      await expect(evidence.page.locator('table.data tbody tr')).toHaveCount(1);
      const row = leadRow(evidence.page, 'LEAD-CONVERT-001');
      await expect(row).toBeVisible();
      await row.click();
      await expect(evidence.page.getByRole('heading', { name: /LEAD-CONVERT-001/ })).toBeVisible();
      await expect(evidence.page.locator('.detail-grid')).toContainText('Sale Alpha');
      await evidence.step('01-lead-detail-ready');

      const convertRequest = evidence.page.waitForRequest((req) =>
        req.method() === 'POST' && req.url().includes('/leads/lead-convert-001/convert'));
      await evidence.page.getByRole('button', { name: /Chuyen doi.*Don DK|Chuyển đổi.*Đơn ĐK/i }).click();
      await convertRequest;
      await expect.poll(() => dialogMessages.length).toBe(2);
      await evidence.page.waitForURL(/\/app\/orders\?fromLead=lead-convert-001$/);
      await expect(evidence.page.locator('[data-testid="order-form-modal"]')).toBeVisible();
      await evidence.step('02-convert-routed-to-orders');

      expect(dialogMessages[0]).toBe('Chuyển đổi lead "Phu huynh Convert" → tạo đơn đăng ký?');
      expect(dialogMessages[1]).toBe('Lead da san sang tao don dang ky.');
      expect(state.convertBodies).toEqual([{ id: 'lead-convert-001', body: {} }]);
      expect(state.leadDetailUrls.length).toBeGreaterThanOrEqual(1);
      expect(state.orderListUrls.length).toBeGreaterThanOrEqual(1);
      expect(state.orderPipelineUrls.length).toBeGreaterThanOrEqual(1);

      await expect(evidence.page.locator('[data-testid="order-parent-name"]')).toHaveValue('Phu huynh Convert');
      await expect(evidence.page.locator('[data-testid="order-parent-phone"]')).toHaveValue('0900111222');
      await expect(evidence.page.locator('[data-testid="order-parent-email"]')).toHaveValue('convert.parent@school.local');
      await expect(evidence.page.locator('[data-testid="order-student-name"]')).toHaveValue('Hoc sinh Convert');
      await expect(evidence.page.locator('[data-testid="order-lead-source"]')).toHaveValue('OTHER');
      await expect(evidence.page.locator('[data-testid="order-sale"]')).toHaveValue('sale-001');
      await evidence.step('03-order-prefill-reflected');

      await evidence.finalize('PASS', {
        extraLines: [
          `Dialog messages: ${JSON.stringify(dialogMessages)}`,
          `Convert request bodies: ${JSON.stringify(state.convertBodies)}`,
          'Browser evidence proves lead conversion keeps confirm + convert call + orders route handoff + exact order-prefill contract without weakening any oracle.',
        ],
      });
    } catch (error) {
      await evidence.finalize('FAIL', { error });
      throw error;
    }
  });
});
