import { expect, test, type APIRequestContext, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { applySessionCookies, loginAsRole } from './support/auth';

const APP_BASE_URL =
  process.env['PLAYWRIGHT_BASE_URL'] ||
  process.env['E2E_BASE_URL'] ||
  'http://localhost:4200';

const INVESTOR_METRICS_API_PATTERN = /^https?:\/\/[^/]+:3000\/financial-control\/investor-metrics(?:\?.*)?$/;
const FINANCIAL_DASHBOARD_API_PATTERN = /^https?:\/\/[^/]+:3000\/financial-control\/dashboard(?:\?.*)?$/;
const FINANCIAL_ALERTS_API_PATTERN = /^https?:\/\/[^/]+:3000\/financial-control\/alerts(?:\?.*)?$/;
const AGING_REPORT_API_PATTERN = /^https?:\/\/[^/]+:3000\/financial-control\/aging-report(?:\?.*)?$/;
const BANK_ACCOUNTS_API_PATTERN = /^https?:\/\/[^/]+:3000\/financial-control\/bank-accounts(?:\?.*)?$/;
const BANK_TRANSACTIONS_API_PATTERN = /^https?:\/\/[^/]+:3000\/financial-control\/bank-transactions(?:\?.*)?$/;
const FUNDS_API_PATTERN = /^https?:\/\/[^/]+:3000\/financial-control\/funds(?:\?.*)?$/;
const FUND_TRANSACTIONS_API_PATTERN = /^https?:\/\/[^/]+:3000\/financial-control\/fund-transactions(?:\?.*)?$/;

async function openAuthenticatedPage(
  browser: Browser,
  request: APIRequestContext,
  path: string,
  configurePage?: (page: Page) => Promise<void>,
): Promise<{ context: BrowserContext; page: Page }> {
  const session = await loginAsRole(request, 'shareholder');
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

async function routeJson(page: Page, pattern: RegExp, body: unknown, status = 200): Promise<void> {
  await page.route(pattern, async (route) => {
    await route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  });
}

function buildInvestorMetrics() {
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
      activeStudents: 61,
      enrolledStudents: 69,
    },
    customerBase: {
      activeStudents: 61,
      enrolledStudents: 69,
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
      monthCount: 6,
      months: ['M1', 'M2', 'M3', 'M4', 'M5', 'M6'],
      revenue: [1100000, 2100000, 3100000, 4100000, 5100000, 6111000],
      netProfit: [120000, 220000, 320000, 420000, 520000, 620000],
      studentCount: [24, 31, 39, 45, 53, 61],
    },
  };
}

function buildInvestorAlerts() {
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

function buildAgingReport() {
  return {
    summary: {
      totalAR: 7250000,
      current: 0,
      '1-30': 1250000,
      '31-60': 2000000,
      '61-90': 1500000,
      '90+': 2500000,
    },
    details: [
      {
        parentName: 'PH #1',
        parentPhone: '',
        students: ['HS #1', 'HS #2'],
        totalDebt: 4250000,
        oldestDate: '2026-01-10T00:00:00.000Z',
        bucket: '90+',
        items: [],
      },
      {
        parentName: 'PH #2',
        parentPhone: '',
        students: ['HS #1'],
        totalDebt: 3000000,
        oldestDate: '2026-03-03T00:00:00.000Z',
        bucket: '31-60',
        items: [],
      },
    ],
  };
}

function buildBankAccounts() {
  return [
    {
      _id: 'bank-001',
      accountCode: 'BA001',
      bankName: 'Vietcombank',
      accountNumber: '001122334455',
      accountHolder: 'School Finance',
      currentBalance: 5500000,
      openingBalance: 5000000,
      status: 'ACTIVE',
      isPrimary: true,
      createdAt: '2026-04-01T00:00:00.000Z',
    },
  ];
}

function buildBankTransactions() {
  return [
    {
      _id: 'bank-tx-001',
      transactionCode: 'BTX001',
      bankAccountId: 'bank-001',
      type: 'DEPOSIT',
      category: 'TUITION_INCOME',
      amount: 1250000,
      balanceBefore: 4250000,
      balanceAfter: 5500000,
      transactionDate: '2026-04-08T00:00:00.000Z',
      description: 'Hoc phi',
      recordedByName: 'Finance Ops',
      isReconciled: false,
      createdAt: '2026-04-08T08:30:00.000Z',
    },
  ];
}

function buildFunds() {
  return [
    {
      _id: 'fund-001',
      fundCode: 'F001',
      name: 'Marketing Reserve',
      fundType: 'RESERVE',
      currentBalance: 2100000,
      minimumBalance: 1000000,
      targetBalance: 3000000,
      status: 'ACTIVE',
      totalDeposited: 4000000,
      totalWithdrawn: 1900000,
      createdAt: '2026-04-01T00:00:00.000Z',
    },
  ];
}

function buildFundTransactions() {
  return [
    {
      _id: 'fund-tx-001',
      transactionCode: 'FTX001',
      fundId: 'fund-001',
      type: 'DEPOSIT',
      amount: 500000,
      balanceBefore: 1600000,
      balanceAfter: 2100000,
      transactionDate: '2026-04-08T00:00:00.000Z',
      description: 'Top-up reserve',
      performedByName: 'Finance Director',
      createdAt: '2026-04-08T10:00:00.000Z',
    },
  ];
}

function buildFinancialAlerts() {
  return {
    totalAlerts: 1,
    criticalCount: 1,
    warningCount: 0,
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
        actions: [
          {
            label: 'Nap quy',
            type: 'FUND_DEPOSIT',
            target: 'RESERVE',
            amount: 500000,
          },
          {
            label: 'Xem chi tiet',
            type: 'NAVIGATE',
            target: '/financial-control?tab=funds',
          },
        ],
      },
    ],
  };
}

test.describe('Nhom 12 shareholder read-only browser surfaces', () => {
  test('N12 shareholder investor-dashboard and aging-report stay read-only while aging data stays anonymized', async ({ browser, request }) => {
    const { context, page } = await openAuthenticatedPage(
      browser,
      request,
      '/app/investor-dashboard',
      async (authedPage) => {
        await routeJson(authedPage, INVESTOR_METRICS_API_PATTERN, buildInvestorMetrics());
        await routeJson(authedPage, FINANCIAL_ALERTS_API_PATTERN, buildInvestorAlerts());
        await authedPage.route(FINANCIAL_DASHBOARD_API_PATTERN, async (route) => {
          await route.fulfill({
            status: 503,
            contentType: 'application/json',
            body: JSON.stringify({ message: 'Dashboard service unavailable' }),
          });
        });
        await routeJson(authedPage, AGING_REPORT_API_PATTERN, buildAgingReport());
      },
    );

    try {
      await expect(page.getByTestId('investor-dashboard-page')).toBeVisible();
      await expect(page.getByTestId('investor-role-chip')).toHaveText('SHAREHOLDER');
      await expect(page.getByTestId('investor-month-select')).toBeVisible();
      await expect(page.getByTestId('investor-refresh')).toBeVisible();
      await expect(page.getByTestId('investor-export-csv')).toBeVisible();
      await expect(page.getByTestId('investor-panel-alerts')).toBeVisible();
      await expect(page.getByTestId('investor-dashboard-page').getByRole('button', { name: /Tao|Th[eê]m|Sua|Xoa|Approve|Duyet/i })).toHaveCount(0);

      await page.goto('/app/aging-report');
      await page.waitForLoadState('domcontentloaded');

      await expect(page.getByRole('heading', { name: /Aging Report|Cong no/i })).toBeVisible();
      await expect(page.getByText(/Chi tiet ca nhan da duoc an danh cho vai tro co dong/i)).toBeVisible();
      await expect(page.locator('table.data tbody tr').first().locator('td').nth(0)).toHaveText('PH #1');
      await expect(page.locator('table.data tbody tr').first().locator('td').nth(1)).toHaveText('An danh');
      await expect(page.locator('table.data tbody tr').first().locator('td').nth(2)).toHaveText('2 hoc sinh');
      await expect(page.getByRole('button', { name: /Tao|Th[eê]m|Sua|Xoa|Approve|Duyet|Export|Xuat|Tai|Doi soat/i })).toHaveCount(0);
    } finally {
      await context.close();
    }
  });

  test('N12 shareholder financial-control keeps bank, funds, and alerts tabs strictly read-only', async ({ browser, request }) => {
    const { context, page } = await openAuthenticatedPage(
      browser,
      request,
      '/app/financial-control',
      async (authedPage) => {
        await authedPage.route(FINANCIAL_DASHBOARD_API_PATTERN, async (route) => {
          await route.fulfill({
            status: 503,
            contentType: 'application/json',
            body: JSON.stringify({ message: 'Dashboard service unavailable' }),
          });
        });
        await routeJson(authedPage, BANK_ACCOUNTS_API_PATTERN, buildBankAccounts());
        await routeJson(authedPage, BANK_TRANSACTIONS_API_PATTERN, buildBankTransactions());
        await routeJson(authedPage, FUNDS_API_PATTERN, buildFunds());
        await routeJson(authedPage, FUND_TRANSACTIONS_API_PATTERN, buildFundTransactions());
        await routeJson(authedPage, FINANCIAL_ALERTS_API_PATTERN, buildFinancialAlerts());
      },
    );

    try {
      await expect(page.getByRole('heading', { name: /Tai chinh|Tài chính/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /Cap nhat|Cập nhật/i })).toBeVisible();

      await page.getByRole('button', { name: /Ngan hang|Ngân hàng/i }).click();
      await expect(page.getByText('Vietcombank')).toBeVisible();
      await expect(page.getByRole('button', { name: /\+ Th[eê]m TK ngan hang|\+ Thêm TK ngân hàng/i })).toHaveCount(0);
      await expect(page.getByRole('button', { name: /\+ Ghi nhan giao dich|\+ Ghi nhận giao dịch/i })).toHaveCount(0);
      await expect(page.locator('table.data button.btn-sm')).toHaveCount(0);

      await page.getByRole('button', { name: /Quy|Quỹ/i }).click();
      await expect(page.getByText('Marketing Reserve')).toBeVisible();
      await page.locator('.fund-card').first().click();
      await expect(page.getByRole('button', { name: /\+ Tao quy moi|\+ Tạo quỹ mới/i })).toHaveCount(0);
      await expect(page.getByRole('button', { name: /\+ Nap\/Rut quy|\+ Nạp\/Rút quỹ/i })).toHaveCount(0);

      await page.getByRole('button', { name: /Canh bao|Cảnh báo/i }).click();
      await expect(page.getByText('Reserve below target')).toBeVisible();
      await expect(page.locator('.alert-actions .action-btn')).toHaveCount(0);
      await expect(page.getByText(/Hanh dong de xuat|Hành động đề xuất/i)).toHaveCount(0);
      await expect(page.getByRole('button', { name: /Nap quy|Xem chi tiet/i })).toHaveCount(0);
    } finally {
      await context.close();
    }
  });
});
