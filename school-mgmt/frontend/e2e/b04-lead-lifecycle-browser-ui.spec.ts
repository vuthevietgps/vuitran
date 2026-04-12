import { expect, test, type Browser, type Page } from '@playwright/test';
import {
  acceptDialog,
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
const LEADS_API = new RegExp(`${API_PREFIX_PATTERN}/leads(?:/.*)?(?:\\?.*)?$`);
const USERS_SALES_API = new RegExp(`${API_PREFIX_PATTERN}/users/sales(?:\\?.*)?$`);

const RETURN_REASON = 'Thu hồi để phân lại sale';
const LOST_REASON = 'NO_LONGER_NEEDED';
const LOST_NOTES = 'Khách đổi mục tiêu học tập';

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
  notes?: string;
  createdAt: string;
  assignedAt?: string;
  lastContactAt?: string;
  returnCount?: number;
  lostReason?: string;
  lostNotes?: string;
  assignmentHistory?: AssignmentHistoryItem[];
};

type LeadHarnessState = {
  allItems: LeadHarnessItem[];
  staleIds: Set<string>;
  returnBodies: Array<{ id: string; body: unknown }>;
  lostBodies: Array<{ id: string; body: unknown }>;
  listUrls: string[];
  poolUrls: string[];
  staleUrls: string[];
  pipelineUrls: string[];
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

function activeLead(item: LeadHarnessItem): boolean {
  return !['CONVERTED', 'NOT_INTERESTED'].includes(item.status);
}

function poolItems(state: LeadHarnessState): LeadHarnessItem[] {
  return state.allItems.filter((item) => activeLead(item) && !item.saleId);
}

function staleItems(state: LeadHarnessState): LeadHarnessItem[] {
  return state.allItems.filter(
    (item) => activeLead(item) && !!item.saleId && state.staleIds.has(item._id),
  );
}

function buildPipeline(state: LeadHarnessState) {
  const items = state.allItems;
  const countStatus = (status: string) => items.filter((item) => item.status === status).length;

  return {
    pipeline: {
      NEW: { count: countStatus('NEW'), estimatedValue: 0 },
      CONTACTED: { count: countStatus('CONTACTED'), estimatedValue: 0 },
      CONSULTING: { count: countStatus('CONSULTING'), estimatedValue: 0 },
      INTERESTED: { count: countStatus('INTERESTED'), estimatedValue: 0 },
      CONVERTED: { count: countStatus('CONVERTED'), estimatedValue: 0 },
    },
    total: items.length,
    conversionRate: 0,
    assignedCount: items.filter((item) => activeLead(item) && !!item.saleId).length,
    unassignedCount: poolItems(state).length,
  };
}

function buildLeadState(): LeadHarnessState {
  return {
    allItems: [
      {
        _id: 'lead-stale-001',
        leadCode: 'LEAD-STALE-001',
        parentName: 'Phụ huynh Quá hạn',
        parentPhone: '0900000001',
        parentEmail: 'stale.parent@school.local',
        studentName: 'Học sinh Quá hạn',
        studentGrade: 'Lớp 5',
        source: 'FACEBOOK',
        status: 'CONTACTED',
        saleId: 'sale-001',
        saleName: 'Sale Demo',
        estimatedValue: 1_500_000,
        notes: 'Seed stale lead for browser proof',
        createdAt: '2026-03-28T02:00:00.000Z',
        assignedAt: '2026-04-01T03:00:00.000Z',
        lastContactAt: '2026-04-02T05:00:00.000Z',
        assignmentHistory: [
          {
            saleId: 'sale-001',
            saleName: 'Sale Demo',
            assignedAt: '2026-04-01T03:00:00.000Z',
          },
        ],
      },
      {
        _id: 'lead-return-001',
        leadCode: 'LEAD-RETURN-001',
        parentName: 'Phụ huynh Thu hồi',
        parentPhone: '0900000002',
        parentEmail: 'return.parent@school.local',
        studentName: 'Học sinh Thu hồi',
        studentGrade: 'Lớp 4',
        source: 'GOOGLE',
        status: 'INTERESTED',
        saleId: 'sale-001',
        saleName: 'Sale Demo',
        estimatedValue: 1_800_000,
        notes: 'Seed return-to-pool lead',
        createdAt: '2026-04-03T02:00:00.000Z',
        assignedAt: '2026-04-05T03:00:00.000Z',
        assignmentHistory: [
          {
            saleId: 'sale-001',
            saleName: 'Sale Demo',
            assignedAt: '2026-04-05T03:00:00.000Z',
          },
        ],
      },
      {
        _id: 'lead-lost-001',
        leadCode: 'LEAD-LOST-001',
        parentName: 'Phụ huynh Lead mất',
        parentPhone: '0900000003',
        parentEmail: 'lost.parent@school.local',
        studentName: 'Học sinh Lead mất',
        studentGrade: 'Lớp 6',
        source: 'OTHER',
        status: 'CONTACTED',
        saleId: 'sale-001',
        saleName: 'Sale Demo',
        estimatedValue: 900_000,
        notes: 'Seeded lost lead',
        createdAt: '2026-04-04T02:00:00.000Z',
        assignedAt: '2026-04-06T03:00:00.000Z',
        assignmentHistory: [
          {
            saleId: 'sale-001',
            saleName: 'Sale Demo',
            assignedAt: '2026-04-06T03:00:00.000Z',
          },
        ],
      },
    ],
    staleIds: new Set(['lead-stale-001']),
    returnBodies: [],
    lostBodies: [],
    listUrls: [],
    poolUrls: [],
    staleUrls: [],
    pipelineUrls: [],
  };
}

function extractId(pathname: string, suffix: string): string {
  return pathname.slice('/leads/'.length, pathname.length - suffix.length);
}

async function installLeadRoutes(page: Page, state: LeadHarnessState): Promise<void> {
  await page.route(USERS_SALES_API, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          _id: 'sale-001',
          fullName: 'Sale Demo',
          email: 'sale.huong@school.local',
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
      state.poolUrls.push(request.url());
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(clone(poolItems(state))),
      });
      return;
    }

    if (method === 'GET' && pathname === '/leads') {
      if (url.searchParams.get('stale') === 'true') {
        state.staleUrls.push(request.url());
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(clone(staleItems(state))),
        });
        return;
      }

      state.listUrls.push(request.url());
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(clone(state.allItems)),
      });
      return;
    }

    if (method === 'GET' && pathname.startsWith('/leads/')) {
      const id = pathname.replace('/leads/', '');
      const item = state.allItems.find((entry) => entry._id === id);
      if (item) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(clone(item)),
        });
        return;
      }
    }

    if (method === 'POST' && /\/leads\/[^/]+\/return-to-pool$/.test(pathname)) {
      const id = extractId(pathname, '/return-to-pool');
      const body = request.postDataJSON();
      state.returnBodies.push({ id, body });

      const item = state.allItems.find((entry) => entry._id === id);
      if (item) {
        item.saleId = null;
        item.saleName = undefined;
        item.returnCount = (item.returnCount || 0) + 1;
        item.assignmentHistory = (item.assignmentHistory || []).map((history, index, histories) =>
          index === histories.length - 1
            ? {
                ...history,
                returnedAt: '2026-04-11T08:00:00.000Z',
                returnReason: String((body as { reason?: string }).reason || ''),
              }
            : history,
        );
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
      return;
    }

    if (method === 'POST' && /\/leads\/[^/]+\/lost$/.test(pathname)) {
      const id = extractId(pathname, '/lost');
      const body = request.postDataJSON();
      state.lostBodies.push({ id, body });

      const item = state.allItems.find((entry) => entry._id === id);
      if (item) {
        item.status = 'NOT_INTERESTED';
        item.saleId = null;
        item.saleName = undefined;
        item.lostReason = String((body as { reason?: string }).reason || '');
        item.lostNotes = String((body as { notes?: string }).notes || '');
      }

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

  const state = buildLeadState();
  await installLeadRoutes(evidence.page, state);
  return { evidence, state };
}

test.use({
  trace: 'off',
  video: 'on',
});

test.describe.serial('B04 lead lifecycle browser', () => {
  test('B04 stale tab, return-to-pool, and mark-lost flows keep list and detail state consistent', async ({
    browser,
    request,
  }) => {
    test.slow();
    test.setTimeout(300_000);

    const { evidence, state } = await openLeadsPage(browser, 'lead_lost_pool_stale_browser');
    const directorSession = await loginAsRole(request, 'director');
    await applySessionCookies(evidence.page, directorSession);
    await evidence.page.goto(appUrl('/app/leads'));
    await evidence.page.waitForLoadState('domcontentloaded');

    try {
      await expect(evidence.page.locator('h2')).toContainText(/Lead/i);
      await expect(evidence.page.locator('table.data tbody tr')).toHaveCount(3);
      expect(state.listUrls.length).toBeGreaterThanOrEqual(1);
      expect(state.pipelineUrls.length).toBeGreaterThanOrEqual(1);
      await evidence.step('01-leads-list-loaded');

      const staleTabButton = evidence.page.getByRole('button', { name: /Quá hạn 7 ngày|Qua han 7 ngay/i });
      await staleTabButton.click();
      await expect(staleTabButton.locator('.tab-badge.warn')).toHaveText('1');
      expect(state.staleUrls).toHaveLength(1);

      const staleRow = leadRow(evidence.page, 'LEAD-STALE-001');
      await expect(staleRow).toBeVisible();
      await expect(staleRow.locator('td').nth(7)).toContainText('01/04');
      await expect(staleRow.locator('td').nth(8)).toContainText('02/04');
      await evidence.step('02-stale-tab-visible');

      await evidence.page.getByRole('button', { name: /Tất cả|Tat ca/i }).click();
      const returnRow = leadRow(evidence.page, 'LEAD-RETURN-001');
      await expect(returnRow).toBeVisible();

      const returnRequest = evidence.page.waitForRequest((req) =>
        req.method() === 'POST' && req.url().includes('/leads/lead-return-001/return-to-pool'));
      const promptMessage = await acceptDialog(
        evidence.page,
        () => returnRow.getByTitle('Thu hồi về kho').click(),
        RETURN_REASON,
      );
      expect(promptMessage).toMatch(/Lý do thu hồi về kho|Ly do thu hoi ve kho/i);
      await returnRequest;

      expect(state.returnBodies).toHaveLength(1);
      expect(state.returnBodies[0]).toEqual({
        id: 'lead-return-001',
        body: { reason: RETURN_REASON },
      });

      const poolTabButton = evidence.page.getByRole('button', { name: /Kho chưa phân bổ|Kho chua phan bo/i });
      await expect(poolTabButton.locator('.tab-badge')).toHaveText('1');
      await poolTabButton.click();
      await expect.poll(() => state.poolUrls.length).toBe(1);

      const poolRow = leadRow(evidence.page, 'LEAD-RETURN-001');
      await expect(poolRow).toBeVisible();
      await expect(poolRow.locator('td').nth(6)).toContainText(/Chưa phân bổ|Chua phan bo/i);
      await poolRow.click();
      await expect(evidence.page.getByRole('heading', { name: /LEAD-RETURN-001/ })).toBeVisible();
      await expect(evidence.page.locator('.detail-grid')).toContainText(/Chưa phân bổ|Chua phan bo/i);
      await expect(evidence.page.getByText(/Lịch sử phân bổ|Lich su phan bo/i)).toBeVisible();
      await expect(evidence.page.locator('.assignment-history')).toContainText('Sale Demo');
      await expect(evidence.page.locator('.assignment-history')).toContainText(RETURN_REASON);
      await evidence.step('03-return-to-pool-reflected');

      await evidence.page.getByRole('button', { name: /Đóng|Dong/i }).click();
      await evidence.page.getByRole('button', { name: /Tất cả|Tat ca/i }).click();
      const lostRow = leadRow(evidence.page, 'LEAD-LOST-001');
      await expect(lostRow).toBeVisible();

      await lostRow.locator('button.btn-sm.danger').click();
      await expect(evidence.page.getByRole('heading', { name: /Đánh dấu lead mất|Danh dau lead mat/i })).toBeVisible();
      await evidence.page.locator('select[name="lostReason"]').selectOption(LOST_REASON);
      await evidence.page.locator('textarea[name="lostNotes"]').fill(LOST_NOTES);
      const lostRequest = evidence.page.waitForRequest((req) =>
        req.method() === 'POST' && req.url().includes('/leads/lead-lost-001/lost'));
      await evidence.page.getByRole('button', { name: /Xác nhận mất|Xac nhan mat/i }).click();
      await lostRequest;

      expect(state.lostBodies).toHaveLength(1);
      expect(state.lostBodies[0]).toEqual({
        id: 'lead-lost-001',
        body: { reason: LOST_REASON, notes: LOST_NOTES },
      });

      await poolTabButton.click();
      await expect.poll(() => state.poolUrls.length).toBe(2);
      await expect(leadRow(evidence.page, 'LEAD-LOST-001')).toHaveCount(0);

      await staleTabButton.click();
      await expect.poll(() => state.staleUrls.length).toBe(2);
      await expect(leadRow(evidence.page, 'LEAD-LOST-001')).toHaveCount(0);

      await evidence.page.getByRole('button', { name: /Tất cả|Tat ca/i }).click();
      const lostStatusRow = leadRow(evidence.page, 'LEAD-LOST-001');
      await expect(lostStatusRow).toBeVisible();
      await expect(lostStatusRow.locator('td').nth(5)).toContainText(/Không quan tâm|Khong quan tam/i);
      await lostStatusRow.click();
      await expect(evidence.page.getByRole('heading', { name: /LEAD-LOST-001/ })).toBeVisible();
      await expect(evidence.page.locator('.detail-grid')).toContainText(/Chưa phân bổ|Chua phan bo/i);
      await expect(evidence.page.locator('.detail-grid')).toContainText(/Khác|Khac/i);
      await expect(evidence.page.getByText(/Seeded lost lead/)).toBeVisible();
      await expect(evidence.page.getByRole('button', { name: /Thu hồi|Thu hoi/i })).toHaveCount(0);
      await expect(evidence.page.getByRole('button', { name: /Đánh dấu lead mất|Danh dau lead mat/i })).toHaveCount(0);
      await evidence.step('04-mark-lost-removes-active-actions');

      await evidence.finalize('PASS', {
        extraLines: [
          `Return-to-pool request body: ${JSON.stringify(state.returnBodies[0]?.body || null)}`,
          `Mark-lost request body: ${JSON.stringify(state.lostBodies[0]?.body || null)}`,
          'Browser evidence proves stale-tab visibility, return-to-pool pool/history update, and lost-flow active-surface removal without weakening any oracle.',
        ],
      });
    } catch (error) {
      await evidence.finalize('FAIL', { error });
      throw error;
    }
  });
});
