import { expect, test, type APIRequestContext, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { applySessionCookies, loginAsRole } from './support/auth';

const APP_BASE_URL =
  process.env['PLAYWRIGHT_BASE_URL'] ||
  process.env['E2E_BASE_URL'] ||
  'http://localhost:4200';

const INVESTOR_METRICS_API_PATTERN = /^https?:\/\/[^/]+:3000\/financial-control\/investor-metrics(?:\?.*)?$/;
const FINANCIAL_DASHBOARD_API_PATTERN = /^https?:\/\/[^/]+:3000\/financial-control\/dashboard(?:\?.*)?$/;
const FINANCIAL_ALERTS_API_PATTERN = /^https?:\/\/[^/]+:3000\/financial-control\/alerts(?:\?.*)?$/;

async function openAuthenticatedPage(
  browser: Browser,
  request: APIRequestContext,
  role: 'shareholder' | 'director',
  path: string,
  configurePage?: (page: Page) => Promise<void>,
): Promise<{ context: BrowserContext; page: Page }> {
  const session = await loginAsRole(request, role);
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

function buildInvestorMetrics(monthCount: 3 | 6 | 12) {
  const summaryMap = {
    3: {
      cashOnHand: 3111000,
      recognizedRevenue: 3111000,
      activeStudents: 31,
      months: ['T-2', 'T-1', 'T'],
      revenue: [1100000, 2100000, 3111000],
      netProfit: [120000, 220000, 320000],
      studentCount: [24, 28, 31],
    },
    6: {
      cashOnHand: 6111000,
      recognizedRevenue: 6111000,
      activeStudents: 61,
      months: ['M1', 'M2', 'M3', 'M4', 'M5', 'M6'],
      revenue: [1100000, 2100000, 3100000, 4100000, 5100000, 6111000],
      netProfit: [120000, 220000, 320000, 420000, 520000, 620000],
      studentCount: [24, 31, 39, 45, 53, 61],
    },
    12: {
      cashOnHand: 12111000,
      recognizedRevenue: 12111000,
      activeStudents: 121,
      months: ['M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7', 'M8', 'M9', 'M10', 'M11', 'M12'],
      revenue: [1200000, 2200000, 3200000, 4200000, 5200000, 6200000, 7200000, 8200000, 9200000, 10200000, 11200000, 12111000],
      netProfit: [130000, 230000, 330000, 430000, 530000, 630000, 730000, 830000, 930000, 1030000, 1130000, 1230000],
      studentCount: [32, 38, 44, 51, 57, 63, 72, 81, 90, 102, 113, 121],
    },
  } as const;

  const selected = summaryMap[monthCount];

  return {
    snapshot: {
      cashOnHand: selected.cashOnHand,
      totalFundBalance: 8800000,
      burnRate: 1450000,
      runway: 7.4,
    },
    revenue: {
      recognizedRevenue: {
        thisMonth: selected.recognizedRevenue,
        lastMonth: selected.recognizedRevenue - 900000,
        ytd: 54000000,
        growthPercent: 17.5,
      },
      unearnedRevenue: {
        walletBalance: 2300000,
        unconsumedInvoiceValue: 4100000,
        total: 6400000,
      },
    },
    profitability: {
      grossProfit: 19500000,
      grossMargin: 41.2,
      netProfit: 9800000,
      netMargin: 20.7,
      ebitda: 11200000,
      ebitdaMargin: 23.4,
    },
    unitEconomics: {
      cac: 740000,
      costPerLead: 110000,
      costPerOrder: 450000,
      ltv: 5200000,
      ltvCacRatio: 7.03,
      arpu: 1860000,
      arpuActive: 2120000,
      activeStudents: selected.activeStudents,
      enrolledStudents: selected.activeStudents + 8,
    },
    customerBase: {
      activeStudents: selected.activeStudents,
      enrolledStudents: selected.activeStudents + 8,
    },
    methodology: {
      cac: {
        formula: 'Ads spend / so don moi',
        note: 'Lay tu dashboard ads va order da duyet.',
      },
      ltv: {
        formula: 'ARPU * retention months',
        note: 'Dung retention 6 thang gan nhat.',
      },
      arpu: {
        formula: 'Revenue / enrolled students',
        activeFormula: 'Revenue / active students',
        note: 'Co tach enrolled va active.',
      },
    },
    retention: {
      retentionRate: 82.5,
      churnRate: 17.5,
      atRiskCount: 4,
    },
    liabilities: {
      accountsReceivable: 3500000,
      payrollPayable: 2800000,
      expensePayable: 1900000,
      loanSummary: { totalDebt: 0 },
      arAgingBuckets: { current: 2000000, overdue30: 1500000 },
    },
    trend: {
      monthCount,
      months: selected.months,
      revenue: selected.revenue,
      netProfit: selected.netProfit,
      studentCount: selected.studentCount,
    },
  };
}

function buildFinancialAlerts() {
  return {
    totalAlerts: 3,
    criticalCount: 1,
    warningCount: 2,
    infoCount: 0,
    marketingBudget: {
      fundBalance: 2100000,
      optimalDailyBudget: 180000,
      optimalMonthlyBudget: 5400000,
      groupBreakdown: [],
    },
    alerts: [
      {
        id: 'alert-1',
        severity: 'CRITICAL',
        category: 'PAYROLL',
        title: 'Payroll gap',
        message: 'Luong da chi nhung bao cao giang day con thieu.',
        data: {},
        actions: [],
      },
      {
        id: 'alert-2',
        severity: 'WARNING',
        category: 'CASHFLOW',
        title: 'Reserve drop',
        message: 'Reserve 3 thang dang thap hon muc muc tieu.',
        data: {},
        actions: [],
      },
    ],
  };
}

test.describe('Investor dashboard browser UI', () => {
  test('B02 investor dashboard giu duoc phan con song khi mot widget loi va doi dung filter 3/6/12 thang', async ({ browser, request }) => {
    const { context, page } = await openAuthenticatedPage(
      browser,
      request,
      'director',
      '/app/investor-dashboard',
      async (authedPage) => {
        await authedPage.route(INVESTOR_METRICS_API_PATTERN, async (route) => {
          const url = new URL(route.request().url());
          const monthCount = Number(url.searchParams.get('monthCount') || '6') as 3 | 6 | 12;
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(buildInvestorMetrics([3, 6, 12].includes(monthCount) ? monthCount : 6)),
          });
        });

        await authedPage.route(FINANCIAL_DASHBOARD_API_PATTERN, async (route) => {
          await route.fulfill({
            status: 503,
            contentType: 'application/json',
            body: JSON.stringify({ message: 'Dashboard service unavailable' }),
          });
        });

        await authedPage.route(FINANCIAL_ALERTS_API_PATTERN, async (route) => {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(buildFinancialAlerts()),
          });
        });
      },
    );

    try {
      await expect(page.getByTestId('investor-dashboard-page')).toBeVisible();
      await expect(page.getByTestId('investor-role-chip')).toContainText('DIRECTOR');
      await expect(page.getByTestId('investor-status-warning')).toBeVisible();
      await expect(page.getByTestId('investor-section-error-dashboard')).toBeVisible();

      await expect(page.getByTestId('investor-metric-grid')).toBeVisible();
      await expect(page.getByTestId('investor-metric-cash')).toContainText('6.111.000');
      await expect(page.getByTestId('investor-panel-revenue')).toBeVisible();
      await expect(page.getByTestId('investor-panel-alerts')).toBeVisible();
      await expect(page.getByTestId('investor-panel-dashboard')).toHaveCount(0);
      await expect(page.getByTestId('investor-trend-panel')).toContainText('6');

      await page.getByTestId('investor-month-select').selectOption({ index: 2 });
      await expect(page.getByTestId('investor-metric-cash')).toContainText('12.111.000');
      await expect(page.getByTestId('investor-trend-panel')).toContainText('12');

      await page.getByTestId('investor-month-select').selectOption({ index: 0 });
      await expect(page.getByTestId('investor-metric-cash')).toContainText('3.111.000');
      await expect(page.getByTestId('investor-trend-panel')).toContainText('3');
    } finally {
      await context.close();
    }
  });
});
