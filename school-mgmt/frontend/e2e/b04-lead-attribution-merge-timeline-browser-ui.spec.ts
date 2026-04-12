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

type LeadListItem = {
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
  notes?: string;
};

type AttributionTouchpoint = {
  capturedAt?: string;
  firstTouchedAt?: string;
  lastConfirmedAt?: string;
  attributionModel?: string;
  sourceType: string;
  adGroupName?: string;
  platform?: string;
  tracking?: {
    landingPageName?: string;
    landingPageSlug?: string;
    utmCampaign?: string;
  };
  notes?: string;
};

type LeadDetailItem = LeadListItem & {
  attributionSummary?: {
    attributionModel?: string | null;
    sourceType?: string | null;
    platform?: string | null;
    firstAttributedAt?: string | null;
    lastConfirmedAt?: string | null;
  } | null;
  attributionTouchpoints?: AttributionTouchpoint[];
};

type HarnessState = {
  lead: LeadListItem;
  detail: LeadDetailItem;
  listUrls: string[];
  pipelineUrls: string[];
  detailUrls: string[];
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
      _id: 'lead-merge-001',
      leadCode: 'LEAD-MERGE-001',
      parentName: 'Phu huynh Attribution',
      parentPhone: '0900888999',
      parentEmail: 'merge.parent@school.local',
      studentName: 'Hoc sinh Attribution',
      studentGrade: 'Lop 6',
      source: 'FACEBOOK',
      status: 'CONTACTED',
      saleId: 'sale-001',
      saleName: 'Sale Alpha',
      estimatedValue: 2_400_000,
      createdAt: '2026-04-01T08:00:00.000Z',
      notes: 'Lead same phone has multiple marketing touchpoints',
    },
    detail: {
      _id: 'lead-merge-001',
      leadCode: 'LEAD-MERGE-001',
      parentName: 'Phu huynh Attribution',
      parentPhone: '0900888999',
      parentEmail: 'merge.parent@school.local',
      studentName: 'Hoc sinh Attribution',
      studentGrade: 'Lop 6',
      source: 'FACEBOOK',
      status: 'CONTACTED',
      saleId: 'sale-001',
      saleName: 'Sale Alpha',
      estimatedValue: 2_400_000,
      createdAt: '2026-04-01T08:00:00.000Z',
      notes: 'Lead same phone has multiple marketing touchpoints',
      attributionSummary: {
        attributionModel: 'FIRST_TOUCH_LOCKED',
        sourceType: 'CONVERSATION',
        platform: 'FACEBOOK',
        firstAttributedAt: '2026-04-01T08:00:00.000Z',
        lastConfirmedAt: '2026-04-05T10:10:00.000Z',
      },
      attributionTouchpoints: [
        {
          capturedAt: '2026-04-01T08:00:00.000Z',
          firstTouchedAt: '2026-04-01T08:00:00.000Z',
          lastConfirmedAt: '2026-04-01T08:05:00.000Z',
          attributionModel: 'FIRST_TOUCH_LOCKED',
          sourceType: 'CONVERSATION',
          adGroupName: 'Facebook Prospecting',
          platform: 'FACEBOOK',
          tracking: {
            landingPageName: 'chatbot-parent-funnel',
            utmCampaign: 'fb-parent-top',
          },
          notes: 'giu nguon dau tien',
        },
        {
          capturedAt: '2026-04-05T10:00:00.000Z',
          firstTouchedAt: '2026-04-05T10:00:00.000Z',
          lastConfirmedAt: '2026-04-05T10:10:00.000Z',
          attributionModel: 'LAST_TOUCH',
          sourceType: 'LANDING_PAGE',
          adGroupName: 'Google Search K12',
          platform: 'GOOGLE',
          tracking: {
            landingPageSlug: 'google-k12',
            utmCampaign: 'gg-k12',
          },
          notes: 'xac nhan touchpoint bo sung',
        },
      ],
    },
    listUrls: [],
    pipelineUrls: [],
    detailUrls: [],
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
            CONTACTED: { count: 1, estimatedValue: state.lead.estimatedValue || 0 },
            CONSULTING: { count: 0, estimatedValue: 0 },
            INTERESTED: { count: 0, estimatedValue: 0 },
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

    if (method === 'GET' && pathname === '/leads/lead-merge-001') {
      state.detailUrls.push(request.url());
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(clone(state.detail)),
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

test.describe.serial('B04 lead attribution merge timeline browser', () => {
  test('B04 lead detail shows merged attribution touchpoints timeline instead of a single final source', async ({
    browser,
    request,
  }) => {
    test.slow();
    test.setTimeout(300_000);

    const { evidence, state } = await openLeadsPage(browser, 'lead_attribution_merge_timeline_browser');
    const directorSession = await loginAsRole(request, 'director');
    await applySessionCookies(evidence.page, directorSession);
    await evidence.page.goto(appUrl('/app/leads'));
    await evidence.page.waitForLoadState('domcontentloaded');

    try {
      await expect(evidence.page.locator('h2')).toContainText(/Lead/i);
      await expect(evidence.page.locator('table.data tbody tr')).toHaveCount(1);
      expect(state.listUrls.length).toBeGreaterThanOrEqual(1);
      expect(state.pipelineUrls.length).toBeGreaterThanOrEqual(1);
      await evidence.step('01-lead-list-loaded');

      const row = leadRow(evidence.page, 'LEAD-MERGE-001');
      await expect(row).toBeVisible();
      await expect(row.locator('td').nth(4)).toContainText('Facebook');
      await row.click();

      await expect.poll(() => state.detailUrls.length).toBe(1);
      await expect(evidence.page.getByRole('heading', { name: /LEAD-MERGE-001/ })).toBeVisible();
      await expect(evidence.page.getByRole('heading', { name: /Attribution Merge/i })).toBeVisible();
      await expect(evidence.page.locator('.attribution-summary')).toContainText('Facebook');
      await expect(evidence.page.locator('.attribution-summary')).toContainText('Chatbot');
      await expect(evidence.page.locator('.attribution-summary')).toContainText('First touch locked');

      const touchpoints = evidence.page.locator('.attribution-timeline .attr-item');
      await expect(touchpoints).toHaveCount(2);
      await expect(touchpoints.nth(0)).toContainText('Facebook / Chatbot');
      await expect(touchpoints.nth(0)).toContainText('Campaign: Facebook Prospecting');
      await expect(touchpoints.nth(0)).toContainText('Landing: chatbot-parent-funnel');
      await expect(touchpoints.nth(0)).toContainText('UTM: fb-parent-top');
      await expect(touchpoints.nth(0)).toContainText('giu nguon dau tien');
      await expect(touchpoints.nth(1)).toContainText('Google / Landing Page');
      await expect(touchpoints.nth(1)).toContainText('Campaign: Google Search K12');
      await expect(touchpoints.nth(1)).toContainText('Landing: google-k12');
      await expect(touchpoints.nth(1)).toContainText('UTM: gg-k12');
      await expect(touchpoints.nth(1)).toContainText('xac nhan touchpoint bo sung');
      await evidence.step('02-attribution-merge-timeline-visible');

      await evidence.finalize('PASS', {
        extraLines: [
          `Lead detail endpoint hits: ${state.detailUrls.length}`,
          'Verified lead detail no longer relies on a scalar source only; it renders a merged attribution timeline with two ordered touchpoints.',
          'Verified first touch stays Facebook/Chatbot while a later Google/Landing Page touchpoint is still visible in the same lead detail modal.',
        ],
      });
    } catch (error) {
      await evidence.finalize('FAIL', { error });
      throw error;
    }
  });
});
