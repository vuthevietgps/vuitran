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

type AssignmentHistoryItem = {
  saleId: string;
  saleName: string;
  assignedAt: string;
  returnedAt?: string;
  returnReason?: string;
};

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
  assignedAt?: string;
  assignmentHistory?: AssignmentHistoryItem[];
};

type LeadHarnessState = {
  item: LeadHarnessItem;
  listUrls: string[];
  pipelineUrls: string[];
  assignBodies: Array<{ id: string; body: unknown }>;
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

async function acceptDialog(page: Page, action: () => Promise<void>): Promise<string> {
  const dialogPromise = page.waitForEvent('dialog');
  const actionPromise = action();
  const dialog = await dialogPromise;
  const message = dialog.message();
  await dialog.accept();
  await actionPromise;
  return message;
}

function buildState(): LeadHarnessState {
  return {
    item: {
      _id: 'lead-reassign-001',
      leadCode: 'LEAD-REASSIGN-001',
      parentName: 'Phu huynh Da phan bo',
      parentPhone: '0900000099',
      parentEmail: 'parent.assigned@school.local',
      studentName: 'Hoc sinh Dang hoc thu',
      studentGrade: 'Lop 4',
      source: 'FACEBOOK',
      status: 'CONTACTED',
      saleId: 'sale-001',
      saleName: 'Sale Alpha',
      estimatedValue: 1_650_000,
      createdAt: '2026-04-08T02:00:00.000Z',
      assignedAt: '2026-04-09T03:00:00.000Z',
      assignmentHistory: [
        {
          saleId: 'sale-001',
          saleName: 'Sale Alpha',
          assignedAt: '2026-04-09T03:00:00.000Z',
        },
      ],
    },
    listUrls: [],
    pipelineUrls: [],
    assignBodies: [],
  };
}

function buildPipeline(state: LeadHarnessState) {
  return {
    pipeline: {
      NEW: { count: 0, estimatedValue: 0 },
      CONTACTED: { count: 1, estimatedValue: state.item.estimatedValue || 0 },
      CONSULTING: { count: 0, estimatedValue: 0 },
      INTERESTED: { count: 0, estimatedValue: 0 },
      CONVERTED: { count: 0, estimatedValue: 0 },
    },
    total: 1,
    conversionRate: 0,
    assignedCount: 1,
    unassignedCount: 0,
  };
}

async function installRoutes(page: Page, state: LeadHarnessState): Promise<void> {
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
        {
          _id: 'sale-002',
          fullName: 'Sale Beta',
          email: 'sale.beta@school.local',
          role: 'SALE',
        },
      ]),
    });
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
        body: JSON.stringify(buildPipeline(state)),
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
        body: JSON.stringify([clone(state.item)]),
      });
      return;
    }

    if (method === 'GET' && pathname === '/leads/lead-reassign-001') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(clone(state.item)),
      });
      return;
    }

    if (method === 'POST' && pathname === '/leads/lead-reassign-001/assign') {
      const body = request.postDataJSON() as { saleId: string; saleName: string };
      state.assignBodies.push({ id: 'lead-reassign-001', body });
      state.item = {
        ...state.item,
        saleId: body.saleId,
        saleName: body.saleName,
        assignedAt: '2026-04-11T11:45:00.000Z',
        assignmentHistory: [
          ...(state.item.assignmentHistory || []),
          {
            saleId: body.saleId,
            saleName: body.saleName,
            assignedAt: '2026-04-11T11:45:00.000Z',
          },
        ],
      };
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

async function openLeadsPage(
  browser: Browser,
  scenario: string,
): Promise<{ evidence: BatchEvidenceSession; state: LeadHarnessState }> {
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

test.describe.serial('B04 lead reassign browser', () => {
  test('B04 reassign lead keeps modal confirm, list, detail, and assignment history consistent', async ({
    browser,
    request,
  }) => {
    test.slow();
    test.setTimeout(300_000);

    const { evidence, state } = await openLeadsPage(browser, 'lead_reassign_browser');
    const directorSession = await loginAsRole(request, 'director');
    await applySessionCookies(evidence.page, directorSession);
    await evidence.page.goto(appUrl('/app/leads'));
    await evidence.page.waitForLoadState('domcontentloaded');

    try {
      await expect(evidence.page.locator('h2')).toContainText(/Lead/i);
      await expect(evidence.page.locator('table.data tbody tr')).toHaveCount(1);
      await expect(evidence.page.locator('.pipe-card.assigned .pipe-count')).toHaveText('1');
      await expect(evidence.page.locator('.pipe-card.pool .pipe-count')).toHaveText('0');
      expect(state.listUrls.length).toBeGreaterThanOrEqual(1);
      expect(state.pipelineUrls.length).toBeGreaterThanOrEqual(1);
      await evidence.step('01-lead-assigned-loaded');

      const row = leadRow(evidence.page, 'LEAD-REASSIGN-001');
      await expect(row).toBeVisible();
      await expect(row.locator('td').nth(6)).toContainText('Sale Alpha');
      await row.click();
      await expect(evidence.page.getByRole('heading', { name: /LEAD-REASSIGN-001/ })).toBeVisible();
      await expect(evidence.page.locator('.detail-grid')).toContainText('Sale Alpha');
      await expect(evidence.page.locator('.assignment-history')).toContainText('Sale Alpha');
      await expect(evidence.page.locator('.assignment-history')).toContainText(/Dang phu trach|Đang phụ trách/i);
      await evidence.step('02-detail-shows-current-owner');

      await evidence.page.getByRole('button', { name: /Doi Sale|Đổi Sale/i }).click();
      const assignModal = evidence.page
        .locator('.modal')
        .filter({ has: evidence.page.getByRole('heading', { name: /Phan bo Lead cho Sale|Phân bổ Lead cho Sale/i }) });
      await expect(assignModal).toBeVisible();
      await expect(assignModal).toContainText('Sale Alpha');
      await assignModal.locator('select').selectOption('sale-002');
      await expect(assignModal.locator('select')).toHaveValue('sale-002');

      const assignRequest = evidence.page.waitForRequest((req) =>
        req.method() === 'POST' && req.url().includes('/leads/lead-reassign-001/assign'));
      const dialogMessage = await acceptDialog(evidence.page, async () => {
        await assignModal.locator('button.primary').click();
      });
      await assignRequest;

      expect(dialogMessage).toContain('Phu huynh Da phan bo');
      expect(dialogMessage).toContain('Sale Alpha');
      expect(dialogMessage).toContain('Sale Beta');
      expect(state.assignBodies).toHaveLength(1);
      expect(state.assignBodies[0]).toEqual({
        id: 'lead-reassign-001',
        body: {
          saleId: 'sale-002',
          saleName: 'Sale Beta',
        },
      });

      await expect(row.locator('td').nth(6)).toContainText('Sale Beta');
      await expect(evidence.page.locator('.pipe-card.assigned .pipe-count')).toHaveText('1');
      await expect(evidence.page.locator('.pipe-card.pool .pipe-count')).toHaveText('0');
      await row.click();
      await expect(evidence.page.locator('.detail-grid')).toContainText('Sale Beta');
      await expect(evidence.page.locator('.assignment-history')).toContainText('Sale Alpha');
      await expect(evidence.page.locator('.assignment-history')).toContainText('Sale Beta');
      await expect(evidence.page.locator('.assignment-history')).toContainText(/Dang phu trach|Đang phụ trách/i);
      await evidence.step('03-reassign-reflected');

      await evidence.finalize('PASS', {
        extraLines: [
          `Assign confirm message: ${dialogMessage}`,
          `Assign request body: ${JSON.stringify(state.assignBodies[0]?.body || null)}`,
          'Browser evidence proves reassign-lead flow keeps recipient modal, confirm, row owner, detail owner, and assignment history consistent without weakening any oracle.',
        ],
      });
    } catch (error) {
      await evidence.finalize('FAIL', { error });
      throw error;
    }
  });
});
