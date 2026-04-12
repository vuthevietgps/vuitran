import { expect, test, type APIRequestContext, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { applySessionCookies, loginAsRole } from './support/auth';

const APP_BASE_URL =
  process.env['PLAYWRIGHT_BASE_URL'] ||
  process.env['E2E_BASE_URL'] ||
  'http://localhost:4200';

const DIRECTOR_DASHBOARD_API_PATTERN = /^https?:\/\/[^/]+:3000\/dashboard\/director\/comprehensive(?:\?.*)?$/;
const DAILY_TASKS_API_PATTERN = /^https?:\/\/[^/]+:3000\/dashboard\/daily-tasks(?:\?.*)?$/;
const FINANCIAL_ALERTS_API_PATTERN = /^https?:\/\/[^/]+:3000\/financial-control\/alerts(?:\?.*)?$/;
const FINANCIAL_PNL_API_PATTERN = /^https?:\/\/[^/]+:3000\/financial-control\/profit-and-loss(?:\?.*)?$/;
const TICKETS_API_PATTERN = /^https?:\/\/[^/]+:3000\/tickets(?:\?.*)?$/;
const TICKET_STATS_API_PATTERN = /^https?:\/\/[^/]+:3000\/tickets\/stats(?:\?.*)?$/;

async function openAuthenticatedPage(
  browser: Browser,
  request: APIRequestContext,
  path: string,
  configurePage?: (page: Page) => Promise<void>,
): Promise<{ context: BrowserContext; page: Page }> {
  const session = await loginAsRole(request, 'director');
  const context = await browser.newContext({ baseURL: APP_BASE_URL });
  const page = await context.newPage();

  if (configurePage) {
    await configurePage(page);
  }

  await applySessionCookies(context, session);
  await page.goto(path);
  await page.waitForLoadState('domcontentloaded');

  return { context, page };
}

function buildDirectorComprehensivePayload() {
  return {
    director: {
      overview: {
        totalRevenue: 32000000,
        totalTeacherCost: 12000000,
        totalExpenses: 4500000,
        grossProfit: 20000000,
        netProfit: 15500000,
        profitMargin: 48.4,
      },
      sessions: {
        total: 42,
        byStatus: {
          SCHEDULED: 12,
          FINALIZED: 24,
          CANCELLED: 6,
        },
        completionRate: 57.1,
      },
      users: {
        totalTeachers: 11,
        activeTeachers: 9,
        totalParents: 34,
        totalStudents: 36,
      },
      payroll: {
        totalPaid: 8200000,
        pendingApproval: 2,
        byStatus: {
          PAID: { count: 4, totalNet: 8200000 },
          PENDING_REVIEW: { count: 2, totalNet: 2600000 },
        },
      },
      tickets: {
        total: 12,
        openCount: 5,
        overdueCount: 3,
        avgResolutionHours: 18.5,
      },
      wallets: {
        totalBalance: 6100000,
        totalTopUp: 21000000,
        totalDeducted: 15500000,
        totalRefunded: 450000,
      },
      recentActivity: {
        recentSessions: [
          {
            teacherId: { fullName: 'Teacher One' },
            studentId: { name: 'Student One' },
            status: 'FINALIZED',
          },
        ],
        recentTickets: [
          {
            ticketCode: 'TKT-OVERDUE-001',
            subject: 'Ticket quá hạn cần xử lý',
            status: 'OPEN',
          },
        ],
        recentTopUps: [],
      },
    },
    accounting: {
      financialSummary: {
        TOP_UP: { totalAmount: 12000000, count: 4 },
        SESSION_DEDUCT: { totalAmount: 8500000, count: 21 },
      },
      wallets: {
        totalBalance: 6100000,
        totalTopUp: 21000000,
        totalDeducted: 15500000,
        totalRefunded: 450000,
        walletCount: 16,
        frozenCount: 1,
      },
      pendingTopUps: [],
      payroll: {
        byStatus: {
          PAID: { count: 4, totalNet: 8200000, totalGross: 9100000 },
          PENDING_REVIEW: { count: 2, totalNet: 2600000, totalGross: 2900000 },
        },
        totalPaidThisPeriod: 8200000,
      },
      ledgerRecent: [],
      revenue: {
        totalSessionRevenue: 32000000,
        totalTeacherCost: 12000000,
        grossProfit: 20000000,
      },
    },
    ops: {
      classes: {
        total: 14,
        active: 11,
        byStatus: {
          ACTIVE: 11,
          INACTIVE: 3,
        },
      },
      sessions: {
        total: 42,
        byStatus: {
          SCHEDULED: 12,
          FINALIZED: 24,
          CANCELLED: 6,
        },
        upcomingToday: 4,
        needsFinalization: 2,
      },
      teachers: {
        total: 11,
        active: 9,
        pendingApproval: 1,
        suspended: 1,
      },
      students: {
        total: 36,
        pendingApproval: 2,
      },
      tickets: {
        total: 12,
        byStatus: {
          OPEN: 5,
          IN_PROGRESS: 4,
          WAITING_INFO: 1,
          RESOLVED: 2,
        },
        byPriority: {
          HIGH: 3,
          MEDIUM: 6,
          LOW: 3,
        },
        overdueCount: 3,
        assignedToMe: 2,
      },
      recentTickets: [
        {
          ticketCode: 'TKT-OVERDUE-001',
          subject: 'Ticket quá hạn cần xử lý',
          createdBy: { fullName: 'Parent One' },
          assignedTo: { fullName: 'Ops One' },
          status: 'OPEN',
          createdAt: '2026-04-08T02:00:00.000Z',
        },
      ],
    },
    birthdays: {
      month: 4,
      totalStudentBirthdays: 0,
      totalParentBirthdays: 0,
      studentBirthdays: [],
      parentBirthdays: [],
    },
    staffLists: {
      totalStaff: 3,
      teachers: [],
      summary: {
        OPS: 1,
        ACCOUNTING: 1,
        SALE: 1,
      },
      byRole: {
        OPS: [
          {
            fullName: 'Ops One',
            email: 'ops.one@school.local',
            status: 'ACTIVE',
            createdAt: '2026-03-01T00:00:00.000Z',
          },
        ],
      },
    },
  };
}

function buildFinancialAlertsPayload() {
  return {
    totalAlerts: 3,
    criticalCount: 1,
    warningCount: 2,
    infoCount: 0,
    marketingBudget: {
      fundBalance: 1800000,
      optimalDailyBudget: 95000,
      optimalMonthlyBudget: 2850000,
      groupBreakdown: [],
    },
    alerts: [
      {
        id: 'alert-critical-001',
        severity: 'CRITICAL',
        category: 'PAYROLL',
        title: 'Lương đã chi nhưng thiếu báo cáo giảng dạy',
        message: 'Đã chi lương cho 2 buổi nhưng chưa có teaching report finalize.',
        data: {},
        actions: [],
      },
      {
        id: 'alert-warning-001',
        severity: 'WARNING',
        category: 'CASHFLOW',
        title: 'Reserve xuống thấp',
        message: 'Reserve 3 tháng thấp hơn mục tiêu hiện tại.',
        data: {},
        actions: [],
      },
    ],
  };
}

function buildProfitAndLossPayload() {
  return {
    period: {
      startDate: '2026-04-01',
      endDate: '2026-04-30',
    },
    revenue: {
      total: 32000000,
      sessionRevenue: 32000000,
      byInvoiceType: {},
      sessionCount: 42,
    },
    costs: {
      teacherCost: 12000000,
      payrollCost: 8200000,
      operatingExpenses: 4500000,
      expenseByCategory: {
        RENT: { total: 2500000, count: 1 },
        EQUIPMENT: { total: 1100000, count: 2 },
        SOFTWARE: { total: 900000, count: 3 },
      },
      adCost: 650000,
      adCostByPlatform: {},
      totalCosts: 17150000,
    },
    summary: {
      grossProfit: 20000000,
      grossMargin: 62.5,
      netProfit: 14850000,
      netMargin: 46.4,
    },
  };
}

function buildDailyTasksPayload() {
  return {
    role: 'DIRECTOR',
    generatedAt: '2026-04-08T00:00:00.000Z',
    title: 'Daily tasks',
    subtitle: 'Director board',
    summary: {
      totalTasks: 0,
      overdueTasks: 0,
      dueTodayTasks: 0,
      highPriorityTasks: 0,
    },
    tabs: [],
  };
}

function buildTicketListPayload() {
  return {
    data: [
      {
        _id: 'ticket-overdue-001',
        ticketCode: 'TKT-OVERDUE-001',
        type: 'REFUND_REQUEST',
        status: 'OPEN',
        priority: 'HIGH',
        subject: 'Refund request quá hạn',
        description: 'Ticket đã quá SLA cần xử lý ngay.',
        createdBy: {
          _id: 'user-parent-001',
          fullName: 'Parent One',
          email: 'parent.one@school.local',
          role: 'PARENT',
        },
        createdByRole: 'PARENT',
        assignedTo: {
          _id: 'user-ops-001',
          fullName: 'Ops One',
          email: 'ops.one@school.local',
        },
        attachments: [],
        dueDate: '2026-04-07T00:00:00.000Z',
        isOverdue: true,
        createdAt: '2026-04-08T00:00:00.000Z',
        updatedAt: '2026-04-08T00:00:00.000Z',
      },
    ],
    meta: {
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
    },
  };
}

test.describe('Director dashboard browser UI', () => {
  test('B02 overdue tickets noi bat va click vao danh sach ticket da loc qua han', async ({ browser, request }) => {
    let sawOverdueQuery = false;
    const { context, page } = await openAuthenticatedPage(browser, request, '/app/dashboard', async (authedPage) => {
      await authedPage.route(DIRECTOR_DASHBOARD_API_PATTERN, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(buildDirectorComprehensivePayload()),
        });
      });

      await authedPage.route(DAILY_TASKS_API_PATTERN, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(buildDailyTasksPayload()),
        });
      });

      await authedPage.route(FINANCIAL_ALERTS_API_PATTERN, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(buildFinancialAlertsPayload()),
        });
      });

      await authedPage.route(FINANCIAL_PNL_API_PATTERN, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(buildProfitAndLossPayload()),
        });
      });

      await authedPage.route(TICKET_STATS_API_PATTERN, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            byStatus: [
              { _id: 'OPEN', count: 1 },
              { _id: 'IN_PROGRESS', count: 0 },
              { _id: 'WAITING_INFO', count: 0 },
              { _id: 'RESOLVED', count: 0 },
              { _id: 'CLOSED', count: 0 },
            ],
            byType: [],
            byPriority: [{ _id: 'HIGH', count: 1 }],
            overdueCount: 1,
          }),
        });
      });

      await authedPage.route(TICKETS_API_PATTERN, async (route) => {
        const url = new URL(route.request().url());
        sawOverdueQuery = url.searchParams.get('overdue') === 'true';
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(buildTicketListPayload()),
        });
      });
    });

    try {
      await expect(page.getByTestId('director-dashboard-page')).toBeVisible();
      await expect(page.getByTestId('director-overdue-alert')).toBeVisible();
      await expect(page.getByTestId('director-overdue-count')).toContainText('3');

      await Promise.all([
        page.waitForURL(/\/app\/tickets/),
        page.getByTestId('director-overdue-alert').click(),
      ]);

      await expect(page.getByTestId('tickets-page')).toBeVisible();
      await expect(page.getByTestId('tickets-filter-overdue-chip')).toBeVisible();
      await expect(page.getByTestId('ticket-overdue-tag')).toContainText('QUÁ HẠN');
      expect(sawOverdueQuery).toBeTruthy();
    } finally {
      await context.close();
    }
  });

  test('B02 critical anomalies va expense breakdown render dung tren director dashboard', async ({ browser, request }) => {
    const { context, page } = await openAuthenticatedPage(browser, request, '/app/dashboard', async (authedPage) => {
      await authedPage.route(DIRECTOR_DASHBOARD_API_PATTERN, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(buildDirectorComprehensivePayload()),
        });
      });

      await authedPage.route(DAILY_TASKS_API_PATTERN, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(buildDailyTasksPayload()),
        });
      });

      await authedPage.route(FINANCIAL_ALERTS_API_PATTERN, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(buildFinancialAlertsPayload()),
        });
      });

      await authedPage.route(FINANCIAL_PNL_API_PATTERN, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(buildProfitAndLossPayload()),
        });
      });
    });

    try {
      await expect(page.getByTestId('director-critical-alerts')).toBeVisible();
      await expect(page.getByTestId('director-critical-alert-item').first()).toContainText('Lương đã chi');
      await expect(page.getByTestId('director-critical-alert-item').nth(1)).toContainText('Reserve xuống thấp');

      await page.getByTestId('director-dashboard-tabs').locator('button').nth(1).click();

      await expect(page.getByTestId('director-expense-breakdown')).toBeVisible();
      await expect(page.getByTestId('director-expense-row').nth(0)).toContainText('RENT');
      await expect(page.getByTestId('director-expense-row').nth(1)).toContainText('EQUIPMENT');
      await expect(page.getByTestId('director-expense-row').nth(2)).toContainText('SOFTWARE');
    } finally {
      await context.close();
    }
  });

  test('B02 dashboard khong vo layout o man hinh hep', async ({ browser, request }) => {
    const { context, page } = await openAuthenticatedPage(browser, request, '/app/dashboard', async (authedPage) => {
      await authedPage.setViewportSize({ width: 390, height: 844 });

      await authedPage.route(DIRECTOR_DASHBOARD_API_PATTERN, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(buildDirectorComprehensivePayload()),
        });
      });

      await authedPage.route(DAILY_TASKS_API_PATTERN, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(buildDailyTasksPayload()),
        });
      });

      await authedPage.route(FINANCIAL_ALERTS_API_PATTERN, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(buildFinancialAlertsPayload()),
        });
      });

      await authedPage.route(FINANCIAL_PNL_API_PATTERN, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(buildProfitAndLossPayload()),
        });
      });
    });

    try {
      await expect(page.getByTestId('director-dashboard-page')).toBeVisible();

      const metrics = await page.evaluate(() => {
        const main = document.querySelector('main.content') as HTMLElement | null;
        const dashboard = document.querySelector('[data-testid="director-dashboard-page"]') as HTMLElement | null;

        return {
          mainClientWidth: main?.clientWidth ?? 0,
          mainScrollWidth: main?.scrollWidth ?? 0,
          dashboardClientWidth: dashboard?.clientWidth ?? 0,
          dashboardScrollWidth: dashboard?.scrollWidth ?? 0,
        };
      });

      expect(metrics.mainScrollWidth).toBeLessThanOrEqual(metrics.mainClientWidth + 1);
      expect(metrics.dashboardScrollWidth).toBeLessThanOrEqual(metrics.dashboardClientWidth + 1);
    } finally {
      await context.close();
    }
  });
});
