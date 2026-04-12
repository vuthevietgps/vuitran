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

function appUrl(path: string): string {
  return new URL(path, APP_BASE_URL).toString();
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
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

type ParentDashboardState = {
  dashboardRequests: string[];
  dashboard: any;
};

async function openInternalEvidencePage(
  browser: Browser,
  request: APIRequestContext,
  role: 'sale' | 'parent',
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

function buildParentDashboardState(): ParentDashboardState {
  return {
    dashboardRequests: [],
    dashboard: {
      wallet: {
        balance: 0,
        totalTopUp: 0,
        totalDeducted: 0,
        totalRefunded: 0,
        status: 'ACTIVE',
      },
      children: {
        total: 0,
        list: [],
      },
      sessions: {
        total: 0,
        byStatus: {},
        upcomingCount: 0,
        needsConfirmation: 0,
      },
      recentSessions: [],
      recentTransactions: [],
      invoices: {
        total: 0,
        totalPaid: 0,
        list: [],
      },
      attendance: {
        total: 0,
        byStatus: {},
        recentList: [],
      },
      tickets: {
        myTickets: 0,
        openTickets: 0,
      },
    },
  };
}

async function routeParentDashboardApis(page: Page, state: ParentDashboardState): Promise<void> {
  await page.route(/^https?:\/\/[^/]+:3000\/dashboard\/parent(?:\?.*)?$/, async (route) => {
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
}

test.describe('NHOM12 dashboard empty-state browser coverage', () => {
  test('NHOM12 sale dashboard shows a friendly onboarding state instead of zero-value KPI noise', async ({
    browser,
    request,
  }) => {
    const saleState = buildSaleDashboardState();
    const dailyTasksState = buildDailyTasksState();
    const evidence = await openInternalEvidencePage(
      browser,
      request,
      'sale',
      'dashboard_empty_state_sale',
      '/app/dashboard',
      async (page) => {
        await routeDailyTasks(page, dailyTasksState);
        await routeSaleDashboardApis(page, saleState);
      },
    );

    try {
      await expect(evidence.page.getByTestId('sale-dashboard-empty-state')).toBeVisible();
      await expect(evidence.page.getByTestId('sale-dashboard-empty-state')).toContainText('Dashboard sale dang cho du lieu dau tien');
      await expect(evidence.page.getByTestId('sale-dashboard-kpi-grid')).toHaveCount(0);
      await expect(evidence.page.getByTestId('sale-dashboard-empty-cta-leads')).toHaveAttribute('href', '/app/leads');
      await expect(evidence.page.getByTestId('sale-dashboard-empty-cta-parents')).toHaveAttribute('href', '/app/users?role=PARENT');
      await expect(evidence.page.getByTestId('sale-dashboard-empty-cta-guide')).toHaveAttribute('href', '/app/sale-hub');
      expect(saleState.dashboardRequests).toHaveLength(1);
      expect(saleState.commissionRequests).toHaveLength(1);
      expect(dailyTasksState.requests.length).toBeGreaterThanOrEqual(1);

      await evidence.step('01-sale-friendly-empty-state');
      await evidence.step('02-sale-empty-state-ctas');
      evidence.note('Fresh SALE dashboard shows a friendly onboarding state with exact CTA targets instead of rendering misleading zero KPI cards.');
      await evidence.finalize('PASS', {
        extraLines: [
          'Fresh SALE dashboard renders a friendly empty state instead of zero KPI noise: PASS',
          'Lead, parent-list, and sale-hub CTAs keep exact route targets on the empty state: PASS',
        ],
      });
    } catch (error) {
      await evidence.finalize('FAIL', { error });
      throw error;
    }
  });

  test('NHOM12 parent dashboard shows linked-child guidance and support CTAs when no child is connected', async ({
    browser,
    request,
  }) => {
    const parentState = buildParentDashboardState();
    const dailyTasksState = buildDailyTasksState();
    const evidence = await openInternalEvidencePage(
      browser,
      request,
      'parent',
      'dashboard_empty_state_parent',
      '/app/dashboard',
      async (page) => {
        await routeDailyTasks(page, dailyTasksState);
        await routeParentDashboardApis(page, parentState);
      },
    );

    try {
      await expect(evidence.page.getByTestId('parent-dashboard-empty-state')).toBeVisible();
      await expect(evidence.page.getByTestId('parent-dashboard-empty-state')).toContainText('Tai khoan nay chua co hoc sinh nao duoc lien ket');
      await expect(evidence.page.getByTestId('parent-dashboard-learning-empty-state')).toBeVisible();
      await expect(evidence.page.getByTestId('parent-dashboard-empty-cta-chat')).toHaveAttribute('href', '/app/parent-chat');
      await expect(evidence.page.getByTestId('parent-dashboard-empty-cta-ticket')).toHaveAttribute('href', '/app/tickets');
      await expect(evidence.page.getByTestId('parent-dashboard-empty-cta-invoices')).toHaveAttribute('href', '/app/parent-invoices');
      await expect(evidence.page.getByText('Chuong trinh hoc theo tung con')).toHaveCount(0);
      expect(parentState.dashboardRequests).toHaveLength(1);
      expect(dailyTasksState.requests.length).toBeGreaterThanOrEqual(1);

      await evidence.step('01-parent-friendly-empty-state');
      await evidence.step('02-parent-support-ctas');
      evidence.note('Parent dashboard switches to a linked-child guidance state with support CTAs instead of rendering an empty learning dashboard with misleading zero-state content.');
      await evidence.finalize('PASS', {
        extraLines: [
          'Parent dashboard renders a linked-child guidance state when no child is connected: PASS',
          'Support and invoice CTAs keep exact route targets on the parent empty state: PASS',
        ],
      });
    } catch (error) {
      await evidence.finalize('FAIL', { error });
      throw error;
    }
  });
});
