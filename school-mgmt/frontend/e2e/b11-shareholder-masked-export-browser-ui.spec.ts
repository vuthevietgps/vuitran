import { expect, test, type APIRequestContext, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { promises as fs } from 'node:fs';
import { applySessionCookies, loginAsRole } from './support/auth';

const APP_BASE_URL =
  process.env['PLAYWRIGHT_BASE_URL'] ||
  process.env['E2E_BASE_URL'] ||
  'http://localhost:4200';

const INVESTOR_METRICS_API_PATTERN = /^https?:\/\/[^/]+:3000\/financial-control\/investor-metrics(?:\?.*)?$/;
const FINANCIAL_DASHBOARD_API_PATTERN = /^https?:\/\/[^/]+:3000\/financial-control\/dashboard(?:\?.*)?$/;
const FINANCIAL_ALERTS_API_PATTERN = /^https?:\/\/[^/]+:3000\/financial-control\/alerts(?:\?.*)?$/;
const INVESTOR_EXPORT_API_PATTERN = /^https?:\/\/[^/]+:3000\/export\/investor-summary(?:\?.*)?$/;

async function openAuthenticatedPage(
  browser: Browser,
  request: APIRequestContext,
  path: string,
  configurePage?: (page: Page) => Promise<void>,
): Promise<{ context: BrowserContext; page: Page }> {
  const session = await loginAsRole(request, 'shareholder');
  const context = await browser.newContext({ baseURL: APP_BASE_URL, acceptDownloads: true });
  const page = await context.newPage();

  if (configurePage) {
    await configurePage(page);
  }

  await applySessionCookies(context, session);
  await page.goto(path);
  await page.waitForLoadState('domcontentloaded');

  return { context, page };
}

async function routeJson(page: Page, pattern: RegExp, body: unknown, status = 200): Promise<void> {
  await page.route(pattern, async (route) => {
    await route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  });
}

function buildInvestorMetrics(monthCount: 3 | 6 | 12 = 6) {
  const monthsMap = {
    3: ['T-2', 'T-1', 'T'],
    6: ['M1', 'M2', 'M3', 'M4', 'M5', 'M6'],
    12: ['M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7', 'M8', 'M9', 'M10', 'M11', 'M12'],
  } as const;

  const revenueMap = {
    3: [1100000, 2100000, 3111000],
    6: [1100000, 2100000, 3100000, 4100000, 5100000, 6111000],
    12: [1200000, 2200000, 3200000, 4200000, 5200000, 6200000, 7200000, 8200000, 9200000, 10200000, 11200000, 12111000],
  } as const;

  const studentMap = {
    3: [24, 28, 31],
    6: [24, 31, 39, 45, 53, 61],
    12: [32, 38, 44, 51, 57, 63, 72, 81, 90, 102, 113, 121],
  } as const;

  const activeStudents = monthCount === 12 ? 121 : monthCount === 3 ? 31 : 61;
  const enrolledStudents = activeStudents + 8;

  return {
    snapshot: {
      cashOnHand: 6111000,
      totalFundBalance: 8800000,
      burnRate: 1450000,
      runway: 7.4,
    },
    revenue: {
      recognizedRevenue: {
        thisMonth: 6111000,
        lastMonth: 5200000,
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
      activeStudents,
      enrolledStudents,
    },
    customerBase: {
      activeStudents,
      enrolledStudents,
    },
    methodology: {
      cac: { formula: 'Ads spend / so don moi', note: 'Lay tu dashboard ads va order da duyet.' },
      ltv: { formula: 'ARPU * retention months', note: 'Dung retention 6 thang gan nhat.' },
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
      months: monthsMap[monthCount],
      revenue: revenueMap[monthCount],
      netProfit: revenueMap[monthCount].map((value, index) => Math.round(value / 10) + index * 1000),
      studentCount: studentMap[monthCount],
    },
  };
}

function buildFinancialDashboard() {
  return {
    cashPosition: {
      bankBalance: 5500000,
      bankAccountCount: 2,
      fundBalance: 3300000,
      fundCount: 1,
      marketingFund: 2100000,
      marketingFundCount: 1,
      availableCash: 8800000,
    },
    obligations: {
      payrollPayable: 2800000,
      payrollPayableCount: 6,
      expensePayable: 1900000,
      expensePayableCount: 3,
      orderPayable: 700000,
      orderPayableCount: 2,
      totalPayable14Days: 5400000,
      operatingReserve3Months: 4350000,
      burnRate: 1450000,
      runway: 7.4,
      reserveHealthy: true,
      cashAfterObligations: 3400000,
    },
    deferredRevenue: {
      walletBalance: 2300000,
      walletCount: 4,
      pendingInvoiceAmount: 4100000,
      pendingInvoiceCount: 5,
    },
    metrics: {
      burnRate: 1450000,
      runway: 7.4,
      currentRatio: 1.63,
      grossMargin: 41.2,
      netMargin: 20.7,
      grossProfit: 19500000,
      netProfit: 9800000,
      revenueGrowth: 17.5,
      thisMonthRevenue: 6111000,
      lastMonthRevenue: 5200000,
      accountsReceivable: 3500000,
      accountsPayable: 4700000,
      deferredRevenue: 6400000,
    },
    fundWarnings: [],
  };
}

function buildFinancialAlerts() {
  return {
    totalAlerts: 2,
    criticalCount: 1,
    warningCount: 1,
    infoCount: 0,
    marketingBudget: {
      fundBalance: 2100000,
      optimalDailyBudget: 180000,
      optimalMonthlyBudget: 5400000,
      groupBreakdown: [],
    },
    alerts: [
      {
        id: 'financial-alert-1',
        severity: 'CRITICAL',
        category: 'CASHFLOW',
        title: 'Reserve below target',
        message: 'Available reserve is below the 3-month target.',
        data: {},
        actions: [],
      },
    ],
  };
}

test.describe('B11 shareholder masked export browser UI', () => {
  test('shareholder can export masked investor summary csv with current month filter', async ({ browser, request }) => {
    let requestedMonthCount = '';
    const csvBody = '\uFEFF"Section","Metric","Value","Parent","Masked phone","Students","Bucket","Notes"\n"Aging detail","Outstanding receivable","4250000","PH #1","An danh","HS #1 / HS #2","90+","0 chi tiet"';

    const { context, page } = await openAuthenticatedPage(
      browser,
      request,
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
        await routeJson(authedPage, FINANCIAL_DASHBOARD_API_PATTERN, buildFinancialDashboard());
        await routeJson(authedPage, FINANCIAL_ALERTS_API_PATTERN, buildFinancialAlerts());
        await authedPage.route(INVESTOR_EXPORT_API_PATTERN, async (route) => {
          const url = new URL(route.request().url());
          requestedMonthCount = url.searchParams.get('monthCount') || '';
          await authedPage.waitForTimeout(700);
          await route.fulfill({
            status: 200,
            contentType: 'text/csv; charset=utf-8',
            headers: {
              'Content-Type': 'text/csv; charset=utf-8',
              'Content-Disposition': 'attachment; filename="bao-cao-co-dong_2026-04-11.csv"',
            },
            body: csvBody,
          });
        });
      },
    );

    try {
      await expect(page.getByTestId('investor-role-chip')).toHaveText('SHAREHOLDER');
      await expect(page.getByTestId('investor-export-csv')).toBeVisible();

      await page.getByTestId('investor-month-select').selectOption({ index: 2 });
      const downloadPromise = page.waitForEvent('download', { timeout: 30_000 });
      await page.getByTestId('investor-export-csv').click();
      await expect(page.getByTestId('investor-export-csv')).toContainText('Dang xuat...');
      const download = await downloadPromise;

      expect(requestedMonthCount).toBe('12');
      expect(await download.suggestedFilename()).toBe('bao-cao-co-dong_2026-04-11.csv');

      const downloadPath = await download.path();
      expect(downloadPath).toBeTruthy();
      const downloadedCsv = await fs.readFile(downloadPath!, 'utf8');
      expect(downloadedCsv).toContain('"PH #1","An danh","HS #1 / HS #2","90+"');
      expect(downloadedCsv).not.toContain('090');
      await expect(page.getByTestId('investor-export-success')).toContainText('CSV');
      await expect(page.getByTestId('investor-export-error')).toHaveCount(0);
    } finally {
      await context.close();
    }
  });

  test('shareholder sees timeout toast when investor export fails', async ({ browser, request }) => {
    const { context, page } = await openAuthenticatedPage(
      browser,
      request,
      '/app/investor-dashboard',
      async (authedPage) => {
        await routeJson(authedPage, INVESTOR_METRICS_API_PATTERN, buildInvestorMetrics(6));
        await routeJson(authedPage, FINANCIAL_DASHBOARD_API_PATTERN, buildFinancialDashboard());
        await routeJson(authedPage, FINANCIAL_ALERTS_API_PATTERN, buildFinancialAlerts());
        await authedPage.route(INVESTOR_EXPORT_API_PATTERN, async (route) => {
          await route.fulfill({
            status: 504,
            contentType: 'text/plain',
            body: 'Gateway Timeout',
          });
        });
      },
    );

    try {
      await expect(page.getByTestId('investor-export-csv')).toBeVisible();
      await page.getByTestId('investor-export-csv').click();
      await expect(page.getByTestId('investor-export-error')).toContainText('timeout');
      await expect(page.getByTestId('investor-export-csv')).toContainText('Xuat Bao Cao');
      await expect(page.getByTestId('investor-export-success')).toHaveCount(0);
    } finally {
      await context.close();
    }
  });
});
