import { expect, test, type APIRequestContext, type Browser, type Page } from '@playwright/test';
import { applySessionCookies, createBatchEvidenceContext, loginAsRole, type BatchEvidenceSession } from './support';

const APP_BASE_URL =
  process.env['PLAYWRIGHT_BASE_URL']
  || process.env['E2E_BASE_URL']
  || 'http://localhost:4200';
const APP_ORIGIN = new URL(APP_BASE_URL).origin;
const RUN_DATE = process.env['UI_EVIDENCE_DATE'] || new Date().toISOString().slice(0, 10);

test.use({
  trace: 'off',
  video: 'on',
});

function appUrl(path: string): string {
  return new URL(path, APP_BASE_URL).toString();
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

async function openInternalEvidencePage(
  browser: Browser,
  request: APIRequestContext,
  role: 'director' | 'sale',
  scenario: string,
  path: string,
  setup: (page: Page) => Promise<void> | void,
): Promise<BatchEvidenceSession> {
  const session = await loginAsRole(request, role);
  const evidence = await createBatchEvidenceContext(browser, {
    batchId: 'NHOM12',
    scenario,
    runDate: RUN_DATE,
  });
  await applySessionCookies(evidence.context, session);
  await setup(evidence.page);
  await evidence.page.goto(appUrl(path));
  await evidence.page.waitForLoadState('domcontentloaded');
  return evidence;
}

async function elementWidth(locator: ReturnType<Page['locator']>): Promise<number> {
  const box = await locator.boundingBox();
  expect(box, 'Expected locator to have a bounding box').not.toBeNull();
  return box!.width;
}

function expectWidthStable(before: number, after: number, maxDelta = 2): void {
  expect(Math.abs(after - before)).toBeLessThanOrEqual(maxDelta);
}

async function expectNoHorizontalOverflow(locator: ReturnType<Page['locator']>): Promise<void> {
  const metrics = await locator.evaluate((node) => {
    const element = node as HTMLElement;
    return {
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    };
  });

  expect(metrics.clientWidth).toBeGreaterThan(0);
  expect(metrics.scrollWidth - metrics.clientWidth).toBeLessThanOrEqual(1);
}

type DailyTasksState = {
  requests: string[];
};

type SaleDashboardState = {
  dashboardRequests: string[];
  commissionRequests: string[];
  dashboard: any;
  commission: any;
};

function buildDailyTasksState(): DailyTasksState {
  return { requests: [] };
}

async function routeDailyTasks(page: Page, state: DailyTasksState): Promise<void> {
  await page.route(/^https?:\/\/[^/]+:3000\/dashboard\/daily-tasks(?:\?.*)?$/, async (route) => {
    if (new URL(route.request().url()).origin === APP_ORIGIN) {
      await route.continue();
      return;
    }

    state.requests.push(route.request().url());
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        role: 'TEST',
        generatedAt: '2026-04-10T00:00:00.000Z',
        summary: {
          totalTasks: 0,
          overdueTasks: 0,
          dueTodayTasks: 0,
          highPriorityTasks: 0,
        },
        tabs: [
          {
            key: 'today',
            label: 'Hom nay',
            description: 'Khong co viec nao can xu ly.',
            emptyMessage: 'Khong co viec nao can xu ly.',
            count: 0,
            tasks: [],
          },
        ],
      }),
    });
  });
}

function buildSaleDashboardState(): SaleDashboardState {
  return {
    dashboardRequests: [],
    commissionRequests: [],
    dashboard: {
      leads: {
        total: 0,
        converted: 0,
        conversionRate: 0,
        active: 0,
        byStatus: {},
        followUpsDueToday: [],
        followUpsOverdue: 0,
      },
      orders: {
        total: 0,
        byStatus: {},
        revenueGenerated: 0,
        commissionEarned: 0,
        commissionPending: 0,
        recentOrders: [],
      },
    },
    commission: {
      summary: { totalRevenue: 0 },
      details: [],
    },
  };
}

async function routeSaleDashboardApis(page: Page, state: SaleDashboardState): Promise<void> {
  await page.route(/^https?:\/\/[^/]+:3000\/dashboard\/sales(?:\?.*)?$/, async (route) => {
    if (new URL(route.request().url()).origin === APP_ORIGIN) {
      await route.continue();
      return;
    }

    state.dashboardRequests.push(route.request().url());
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(clone(state.dashboard)),
    });
  });

  await page.route(/^https?:\/\/[^/]+:3000\/orders\/commission-report(?:\?.*)?$/, async (route) => {
    if (new URL(route.request().url()).origin === APP_ORIGIN) {
      await route.continue();
      return;
    }

    state.commissionRequests.push(route.request().url());
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(clone(state.commission)),
    });
  });
}

type ChatbotGuideState = {
  fanpages: any[];
  tokens: any[];
  profiles: any[];
  adAccounts: any[];
};

function buildChatbotGuideState(): ChatbotGuideState {
  return {
    fanpages: [
      {
        _id: 'fp-guide-1',
        fanpageCode: 'FP-GUIDE-001',
        name: 'Flow Guide Fanpage',
        platform: 'FACEBOOK',
        pageId: 'page-guide-001',
        description: 'Fanpage dung de kiem tra flow guide.',
        syncSource: 'MANUAL',
        businessName: 'Guide Business',
        syncTokenLabel: 'BM Token',
        lastSyncedAt: '2026-04-10T03:00:00.000Z',
        openaiTokenId: 'token-guide-1',
        openaiTokenLabel: 'Guide Token',
        openaiModel: 'gpt-4o-mini',
        status: 'ACTIVE',
        aiAutoReplyEnabled: true,
        createdAt: '2026-04-10T02:00:00.000Z',
        updatedAt: '2026-04-10T03:00:00.000Z',
      },
    ],
    tokens: [
      {
        _id: 'token-guide-1',
        label: 'Guide Token',
        apiKey: 'sk-******',
        model: 'gpt-4o-mini',
        temperature: 0.7,
        maxTokens: 2000,
        status: 'ACTIVE',
        lastUsedAt: '2026-04-10T03:30:00.000Z',
        createdAt: '2026-04-10T02:00:00.000Z',
      },
    ],
    profiles: [
      {
        _id: 'profile-guide-1',
        assistantType: 'PARENT_SUPPORT',
        label: 'Guide Profile',
        description: 'Profile dung de kiem tra tab layout.',
        rulesPrompt: 'Always be concise.',
        defaultOpenAITokenId: 'token-guide-1',
        defaultOpenAITokenLabel: 'Guide Token',
        defaultOpenAIModel: 'gpt-4o-mini',
        status: 'ACTIVE',
        createdAt: '2026-04-10T02:00:00.000Z',
        updatedAt: '2026-04-10T03:00:00.000Z',
      },
    ],
    adAccounts: [
      {
        _id: 'ad-account-guide-1',
        accountCode: 'ACC-GUIDE-01',
        name: 'Guide Ads Account',
        platform: 'FACEBOOK',
        platformAccountId: 'act_guide_001',
        status: 'ACTIVE',
        createdAt: '2026-04-10T02:00:00.000Z',
        updatedAt: '2026-04-10T03:00:00.000Z',
      },
    ],
  };
}

async function routeChatbotGuideApis(page: Page, state: ChatbotGuideState): Promise<void> {
  await page.route(/^https?:\/\/[^/]+:3000\/chatbot\/fanpages(?:\?.*)?$/, async (route) => {
    if (new URL(route.request().url()).origin === APP_ORIGIN) {
      await route.continue();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: clone(state.fanpages),
        total: state.fanpages.length,
        page: 1,
        limit: 200,
      }),
    });
  });

  await page.route(/^https?:\/\/[^/]+:3000\/chatbot\/openai-tokens(?:\?.*)?$/, async (route) => {
    if (new URL(route.request().url()).origin === APP_ORIGIN) {
      await route.continue();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(clone(state.tokens)),
    });
  });

  await page.route(/^https?:\/\/[^/]+:3000\/chatbot\/ai-assistant-profiles(?:\?.*)?$/, async (route) => {
    if (new URL(route.request().url()).origin === APP_ORIGIN) {
      await route.continue();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(clone(state.profiles)),
    });
  });

  await page.route(/^https?:\/\/[^/]+:3000\/ads\/accounts(?:\?.*)?$/, async (route) => {
    if (new URL(route.request().url()).origin === APP_ORIGIN) {
      await route.continue();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: clone(state.adAccounts),
        total: state.adAccounts.length,
        page: 1,
        limit: 200,
      }),
    });
  });
}

test.describe('NHOM12 flow guide browser coverage', () => {
  test('NHOM12 dashboard flow guide renders exact title, summary, steps, and keeps layout stable', async ({
    browser,
    request,
  }) => {
    const dailyTasks = buildDailyTasksState();
    const saleDashboard = buildSaleDashboardState();
    const evidence = await openInternalEvidencePage(
      browser,
      request,
      'sale',
      'flow_guide_dashboard_browser',
      '/app/dashboard',
      async (page) => {
        await routeDailyTasks(page, dailyTasks);
        await routeSaleDashboardApis(page, saleDashboard);
      },
    );

    try {
      const { page } = evidence;
      const toggle = page.getByTestId('flow-guide-toggle');
      const content = page.getByTestId('flow-guide-content');
      const title = page.getByTestId('flow-guide-title');
      const summary = page.getByTestId('flow-guide-summary');
      const steps = page.getByTestId('flow-guide-step');
      const banner = page.getByTestId('dashboard-handbook-banner');

      await expect(toggle).toBeVisible();
      await expect(toggle).toContainText('Mô tả luồng');
      await expect(content).toHaveCount(0);
      await expect(banner).toBeVisible();

      const bannerWidthBefore = await elementWidth(banner);
      await evidence.step('dashboard-flow-guide-collapsed');

      await toggle.click();

      await expect(content).toBeVisible();
      await expect(title).toHaveText('Dashboard');
      await expect(summary).toHaveText('Tổng quan hoạt động của trung tâm, hiển thị các chỉ số quan trọng.');
      await expect(steps).toHaveCount(3);
      await expect(steps.nth(0)).toContainText('Đăng nhập:');
      await expect(steps.nth(1)).toContainText('Xem chỉ số:');
      await expect(steps.nth(2)).toContainText('Theo dõi cảnh báo:');
      await expect(banner).toBeVisible();
      await expectNoHorizontalOverflow(content);
      const bannerWidthOpen = await elementWidth(banner);
      expectWidthStable(bannerWidthBefore, bannerWidthOpen);

      await evidence.step('dashboard-flow-guide-expanded');

      await toggle.click();

      await expect(content).toHaveCount(0);
      await expect(banner).toBeVisible();
      const bannerWidthClosed = await elementWidth(banner);
      expectWidthStable(bannerWidthBefore, bannerWidthClosed);
      expect(dailyTasks.requests.length).toBeGreaterThanOrEqual(1);
      expect(saleDashboard.dashboardRequests.length).toBe(1);
      expect(saleDashboard.commissionRequests.length).toBe(1);

      await evidence.finalize('PASS', {
        extraLines: [
          'Scope: Dashboard flow guide title/summary/steps + open/close + handbook banner layout stability.',
          `Daily tasks requests: ${dailyTasks.requests.length}`,
          `Dashboard requests: ${saleDashboard.dashboardRequests.length}`,
          `Commission requests: ${saleDashboard.commissionRequests.length}`,
        ],
      });
    } catch (error) {
      await evidence.finalize('FAIL', { error });
      throw error;
    }
  });

  test('NHOM12 chatbot settings flow guide renders exact title, summary, steps, and keeps tabs/table layout stable', async ({
    browser,
    request,
  }) => {
    const chatbot = buildChatbotGuideState();
    const evidence = await openInternalEvidencePage(
      browser,
      request,
      'director',
      'flow_guide_chatbot_settings_browser',
      '/app/chatbot-settings',
      async (page) => {
        await routeChatbotGuideApis(page, chatbot);
      },
    );

    try {
      const { page } = evidence;
      const toggle = page.getByTestId('flow-guide-toggle');
      const content = page.getByTestId('flow-guide-content');
      const title = page.getByTestId('flow-guide-title');
      const summary = page.getByTestId('flow-guide-summary');
      const steps = page.getByTestId('flow-guide-step');
      const tabs = page.locator('.tabs');
      const dataTable = page.locator('table.data-table').first();

      await expect(toggle).toBeVisible();
      await expect(toggle).toContainText('Mô tả luồng');
      await expect(content).toHaveCount(0);
      await expect(tabs).toBeVisible();
      await expect(dataTable).toBeVisible();
      await expect(page.getByRole('button', { name: 'Fanpages' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'OpenAI Tokens' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'AI Profiles' })).toBeVisible();

      const tabsWidthBefore = await elementWidth(tabs);
      const tableWidthBefore = await elementWidth(dataTable);
      await evidence.step('chatbot-flow-guide-collapsed');

      await toggle.click();

      await expect(content).toBeVisible();
      await expect(title).toHaveText('Cài đặt Chatbot');
      await expect(summary).toHaveText('Cấu hình chatbot: kịch bản hội thoại, tích hợp nền tảng.');
      await expect(steps).toHaveCount(3);
      await expect(steps.nth(0)).toContainText('Cấu hình kết nối:');
      await expect(steps.nth(1)).toContainText('Thiết lập kịch bản:');
      await expect(steps.nth(2)).toContainText('Quản lý webhook:');
      await expect(tabs).toBeVisible();
      await expect(dataTable).toBeVisible();
      await expectNoHorizontalOverflow(content);

      const tabsWidthOpen = await elementWidth(tabs);
      const tableWidthOpen = await elementWidth(dataTable);
      expectWidthStable(tabsWidthBefore, tabsWidthOpen);
      expectWidthStable(tableWidthBefore, tableWidthOpen);

      await evidence.step('chatbot-flow-guide-expanded');

      await toggle.click();

      await expect(content).toHaveCount(0);
      await expect(tabs).toBeVisible();
      await expect(dataTable).toBeVisible();
      const tabsWidthClosed = await elementWidth(tabs);
      const tableWidthClosed = await elementWidth(dataTable);
      expectWidthStable(tabsWidthBefore, tabsWidthClosed);
      expectWidthStable(tableWidthBefore, tableWidthClosed);

      await evidence.finalize('PASS', {
        extraLines: [
          'Scope: Chatbot settings flow guide title/summary/steps + open/close + tabs/table layout stability.',
          `Fanpages rows: ${chatbot.fanpages.length}`,
          `Tokens rows: ${chatbot.tokens.length}`,
          `AI profiles rows: ${chatbot.profiles.length}`,
        ],
      });
    } catch (error) {
      await evidence.finalize('FAIL', { error });
      throw error;
    }
  });
});
