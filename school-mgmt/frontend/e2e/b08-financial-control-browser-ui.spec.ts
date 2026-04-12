import { expect, test, type APIRequestContext, type Browser, type Page } from '@playwright/test';
import {
  applySessionCookies,
  createBatchEvidenceContext,
  loginAsRole,
  type BatchEvidenceSession,
  type DemoRole,
  type DemoSession,
} from './support';

const APP_BASE_URL =
  process.env['PLAYWRIGHT_BASE_URL'] ||
  process.env['E2E_BASE_URL'] ||
  'http://localhost:4200';

const RUN_DATE =
  process.env['UI_EVIDENCE_DATE'] ||
  process.env['E2E_RUN_DATE'] ||
  '2026-04-11';

const API_ORIGIN_PATTERN = 'https?://(?:localhost|127\\.0\\.0\\.1):3000';
const DASHBOARD_API = new RegExp(`${API_ORIGIN_PATTERN}/financial-control/dashboard(?:\\?.*)?$`);
const BANK_ACCOUNTS_API = new RegExp(`${API_ORIGIN_PATTERN}/financial-control/bank-accounts(?:\\?.*)?$`);
const BANK_TRANSACTIONS_API = new RegExp(`${API_ORIGIN_PATTERN}/financial-control/bank-transactions(?:\\?.*)?$`);
const BANK_RECONCILE_API = new RegExp(`${API_ORIGIN_PATTERN}/financial-control/bank-transactions/[^/]+/reconcile(?:\\?.*)?$`);
const FUNDS_API = new RegExp(`${API_ORIGIN_PATTERN}/financial-control/funds(?:\\?.*)?$`);
const FUND_TRANSACTIONS_API = new RegExp(`${API_ORIGIN_PATTERN}/financial-control/fund-transactions(?:\\?.*)?$`);
const PROVISIONAL_GROSS_PROFIT_API = new RegExp(`${API_ORIGIN_PATTERN}/financial-control/provisional-gross-profit(?:\\?.*)?$`);
const ALERTS_API = new RegExp(`${API_ORIGIN_PATTERN}/financial-control/alerts(?:\\?.*)?$`);
const CASHFLOW_API = new RegExp(`${API_ORIGIN_PATTERN}/financial-control/cash-flow(?:\\?.*)?$`);
const PNL_API = new RegExp(`${API_ORIGIN_PATTERN}/financial-control/profit-and-loss(?:\\?.*)?$`);
const RECONCILIATION_API = new RegExp(`${API_ORIGIN_PATTERN}/financial-control/reconciliation(?:\\?.*)?$`);

type BankAccountItem = {
  _id: string;
  accountCode: string;
  bankName: string;
  accountNumber: string;
  accountHolder?: string;
  branch?: string;
  currentBalance: number;
  openingBalance: number;
  status: string;
  description?: string;
  isPrimary?: boolean;
  createdByName?: string;
  createdAt: string;
};

type BankTransactionItem = {
  _id: string;
  transactionCode: string;
  bankAccountId: string;
  type: string;
  category: string;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  transactionDate: string;
  description?: string;
  reference?: string;
  recordedByName: string;
  isReconciled?: boolean;
  createdAt: string;
};

type FundItem = {
  _id: string;
  fundCode: string;
  name: string;
  fundType: string;
  currentBalance: number;
  minimumBalance: number;
  targetBalance: number;
  status: string;
  description?: string;
  totalDeposited: number;
  totalWithdrawn: number;
  createdByName?: string;
  createdAt: string;
};

type FundTransactionItem = {
  _id: string;
  transactionCode: string;
  fundId: string;
  type: string;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  transactionDate: string;
  description?: string;
  reference?: string;
  performedByName: string;
  createdAt: string;
};

type FinancialControlState = {
  bankAccounts: BankAccountItem[];
  bankTransactions: BankTransactionItem[];
  funds: FundItem[];
  fundTransactions: FundTransactionItem[];
  bankAccountBodies: unknown[];
  bankTransactionBodies: unknown[];
  reconcileIds: string[];
  fundBodies: unknown[];
  fundTransactionBodies: unknown[];
};

function appUrl(path: string): string {
  return new URL(path, APP_BASE_URL).toString();
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

async function signInAs(page: Page, request: APIRequestContext, role: DemoRole): Promise<DemoSession> {
  await page.context().clearCookies();
  const session = await loginAsRole(request, role);
  await applySessionCookies(page.context(), session);
  return session;
}

async function openBatch(browser: Browser, scenario: string): Promise<BatchEvidenceSession> {
  return createBatchEvidenceContext(browser, {
    batchId: 'B08',
    scenario,
    runDate: RUN_DATE,
  });
}

function minimalDashboard(bankBalance = 0, fundBalance = 0, unreconciledItems = 0): any {
  return {
    cashPosition: {
      bankBalance,
      bankAccountCount: bankBalance > 0 ? 1 : 0,
      fundBalance,
      fundCount: fundBalance > 0 ? 1 : 0,
      marketingFund: 0,
      marketingFundCount: 0,
      availableCash: bankBalance + fundBalance,
    },
    obligations: {
      payrollPayable: 0,
      payrollPayableCount: 0,
      expensePayable: 0,
      expensePayableCount: 0,
      orderPayable: 0,
      orderPayableCount: 0,
      totalPayable14Days: 0,
      operatingReserve3Months: 0,
      burnRate: 0,
      runway: 0,
      reserveHealthy: true,
      cashAfterObligations: bankBalance + fundBalance,
    },
    deferredRevenue: {
      walletBalance: 0,
      walletCount: 0,
      pendingInvoiceAmount: 0,
      pendingInvoiceCount: 0,
    },
    metrics: {
      burnRate: 0,
      runway: 0,
      currentRatio: 0,
      grossMargin: 0,
      netMargin: 0,
      grossProfit: 0,
      netProfit: 0,
      revenueGrowth: 0,
      thisMonthRevenue: 0,
      lastMonthRevenue: 0,
      accountsReceivable: 0,
      accountsPayable: 0,
      deferredRevenue: 0,
    },
    debtPosition: {
      totalDebt: 0,
      activeLoanCount: 0,
      loanPayable: 0,
      loanPayableCount: 0,
    },
    fundWarnings: unreconciledItems > 0 ? [] : [],
  };
}

function reconciliationReport(state: FinancialControlState): any {
  const bankBalance = state.bankAccounts.reduce((sum, account) => sum + account.currentBalance, 0);
  const fundBalance = state.funds.reduce((sum, fund) => sum + fund.currentBalance, 0);
  const unreconciledItems = state.bankTransactions.filter((tx) => !tx.isReconciled).length;
  return {
    healthIndicators: {
      bankBalance,
      fundBalance,
      walletLiability: 0,
      loanDebt: 0,
      netPosition: bankBalance + fundBalance,
      unreconciledItems,
      fundWarnings: state.funds.filter((fund) => fund.currentBalance < fund.minimumBalance).length,
    },
    bankAccounts: {
      accountCount: state.bankAccounts.length,
    },
    funds: {
      fundCount: state.funds.length,
    },
    loanSummary: {
      activeLoanCount: 0,
    },
    profitAndLoss: {
      grossProfit: 0,
      grossMargin: 0,
      netProfit: 0,
      netMargin: 0,
    },
  };
}

function provisionalGrossProfitReport(month: string): any {
  if (month === '2026-03') {
    return {
      period: {
        month: 3,
        year: 2026,
        startDate: '2026-03-01',
        endDate: '2026-03-31',
      },
      cashInflow: {
        approvedInvoiceAmount: 7200000,
        approvedInvoiceCount: 4,
      },
      provisional: {
        revenueAmount: 6100000,
        teacherPayoutAmount: 2200000,
        attendanceCount: 18,
      },
      grossProfitAmount: 3900000,
    };
  }

  return {
    period: {
      month: 4,
      year: 2026,
      startDate: '2026-04-01',
      endDate: '2026-04-30',
    },
    cashInflow: {
      approvedInvoiceAmount: 6800000,
      approvedInvoiceCount: 5,
    },
    provisional: {
      revenueAmount: 5600000,
      teacherPayoutAmount: 2100000,
      attendanceCount: 16,
    },
    grossProfitAmount: 3500000,
  };
}

function cashFlowReport(groupBy: string): any {
  if (groupBy === 'day') {
    return {
      totalInflow: 4500000,
      totalOutflow: 1700000,
      netCashFlow: 2800000,
      timeline: [
        {
          date: '2026-04-10',
          inflow: {
            invoices: 2500000,
            invoiceCount: 2,
            sessionRevenue: 800000,
            sessionCount: 4,
            walletTopUps: 900000,
            walletTopUpCount: 2,
            loanDisbursements: 300000,
            loanDisbursementCount: 1,
          },
          outflow: {
            payroll: 700000,
            payrollCount: 1,
            expenses: 500000,
            expenseCount: 1,
            adCost: 300000,
            adCostCount: 1,
            loanRepayments: 200000,
            loanRepaymentCount: 1,
          },
          totalInflow: 4500000,
          totalOutflow: 1700000,
          netCashFlow: 2800000,
        },
      ],
      basis: {
        requested: 'cash',
        applied: 'cash',
        totalInflow: 'cash',
        totalOutflow: 'cash',
      },
      accrualReference: {
        sessionRevenue: 800000,
        teacherCost: 350000,
        serviceMargin: 450000,
      },
      period: {
        startDate: '2026-04-10',
        endDate: '2026-04-10',
        groupBy: 'day',
      },
    };
  }

  return {
    totalInflow: 9000000,
    totalOutflow: 2800000,
    netCashFlow: 6200000,
    timeline: [
      {
        date: '2026-04',
        inflow: {
          invoices: 5000000,
          invoiceCount: 3,
          sessionRevenue: 2100000,
          sessionCount: 9,
          walletTopUps: 1300000,
          walletTopUpCount: 2,
          loanDisbursements: 600000,
          loanDisbursementCount: 1,
        },
        outflow: {
          payroll: 1200000,
          payrollCount: 2,
          expenses: 900000,
          expenseCount: 1,
          adCost: 400000,
          adCostCount: 1,
          loanRepayments: 300000,
          loanRepaymentCount: 1,
        },
        totalInflow: 9000000,
        totalOutflow: 2800000,
        netCashFlow: 6200000,
      },
    ],
    basis: {
      requested: 'cash',
      applied: 'cash',
      totalInflow: 'cash',
      totalOutflow: 'cash',
    },
    accrualReference: {
      sessionRevenue: 2100000,
      teacherCost: 950000,
      serviceMargin: 1150000,
    },
    period: {
      startDate: '2026-04-01',
      endDate: '2026-04-30',
      groupBy: 'month',
    },
  };
}

function profitAndLossReport(basis: 'cash' | 'accrual'): any {
  if (basis === 'accrual') {
    return {
      period: {
        startDate: '2026-04-01',
        endDate: '2026-04-30',
      },
      basis: {
        selected: 'accrual',
        default: 'cash',
        supported: ['cash', 'accrual'],
      },
      revenue: {
        total: 5800000,
        sessionRevenue: 2600000,
        sessionCount: 11,
        byInvoiceType: {
          COURSE: { count: 3, amount: 4200000 },
          TRIAL: { count: 2, amount: 1600000 },
        },
      },
      costs: {
        teacherCost: 1200000,
        payrollCost: 1500000,
        operatingExpenses: 0,
        expenseByCategory: {
          MARKETING: { count: 1, amount: 350000 },
          OPERATIONS: { count: 1, amount: 450000 },
        },
        adCost: 300000,
        adCostByPlatform: {
          FACEBOOK: { count: 1, amount: 300000 },
        },
        totalCosts: 2600000,
      },
      summary: {
        basis: 'accrual',
        grossProfit: 4600000,
        grossMargin: 79.31,
        netProfit: 3200000,
        netMargin: 55.17,
      },
    };
  }

  return {
    period: {
      startDate: '2026-04-01',
      endDate: '2026-04-30',
    },
    basis: {
      selected: 'cash',
      default: 'cash',
      supported: ['cash', 'accrual'],
    },
    revenue: {
      total: 5400000,
      sessionRevenue: 2100000,
      sessionCount: 9,
      byInvoiceType: {
        COURSE: { count: 3, amount: 4800000 },
        TRIAL: { count: 2, amount: 600000 },
      },
    },
    costs: {
      teacherCost: 950000,
      payrollCost: 1500000,
      operatingExpenses: 0,
      expenseByCategory: {
        MARKETING: { count: 1, amount: 250000 },
        OPERATIONS: { count: 1, amount: 450000 },
      },
      adCost: 300000,
      adCostByPlatform: {
        FACEBOOK: { count: 1, amount: 300000 },
      },
      totalCosts: 2500000,
    },
    summary: {
      basis: 'cash',
      grossProfit: 4450000,
      grossMargin: 82.41,
      netProfit: 2900000,
      netMargin: 53.7,
    },
  };
}

function financialAlertsReport(): any {
  return {
    totalAlerts: 3,
    criticalCount: 1,
    warningCount: 1,
    infoCount: 1,
    marketingBudget: {
      fundBalance: 1400000,
      optimalDailyBudget: 250000,
      optimalMonthlyBudget: 1800000,
      groupBreakdown: [
        {
          adGroupId: 'adg-001',
          adGroupName: 'Prospecting QA',
          platform: 'FACEBOOK',
          currentDailySpend: 120000,
          optimalDailySpend: 180000,
          changePercent: 50,
          confidence: 'HIGH',
          reason: 'Cost per order below target and volume still scalable.',
        },
      ],
    },
    alerts: [
      {
        id: 'alert-critical-1',
        severity: 'CRITICAL',
        category: 'FUND',
        title: 'Quy Marketing duoi nguong toi thieu',
        message: 'Can nap quy ngay de khong gian doan ngan sach QC.',
        data: { fundType: 'MARKETING' },
        actions: [
          {
            label: 'Nap quy Marketing',
            type: 'FUND_DEPOSIT',
            target: 'MARKETING',
            amount: 500000,
          },
        ],
      },
      {
        id: 'alert-warning-1',
        severity: 'WARNING',
        category: 'RECONCILIATION',
        title: 'Con giao dich chua doi soat',
        message: 'Can xem chi tiet doi soat de dong so lieu cuoi ngay.',
        data: { unreconciledItems: 1 },
        actions: [
          {
            label: 'Xem chi tiet doi soat',
            type: 'NAVIGATE',
            target: '/financial-control?tab=reconciliation',
          },
        ],
      },
      {
        id: 'alert-info-1',
        severity: 'INFO',
        category: 'CASHFLOW',
        title: 'Dong tien duong trong ky',
        message: 'Dong tien rong dang duong va khong can can thiep them.',
        data: { netCashFlow: 6200000 },
        actions: [
          {
            label: 'Thong tin dong tien',
            type: 'INFO',
          },
        ],
      },
    ],
  };
}

async function installFinancialControlRoutes(page: Page, state: FinancialControlState): Promise<void> {
  await page.route(DASHBOARD_API, async (route) => {
    const bankBalance = state.bankAccounts.reduce((sum, account) => sum + account.currentBalance, 0);
    const fundBalance = state.funds.reduce((sum, fund) => sum + fund.currentBalance, 0);
    const unreconciledItems = state.bankTransactions.filter((tx) => !tx.isReconciled).length;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(minimalDashboard(bankBalance, fundBalance, unreconciledItems)),
    });
  });

  await page.route(BANK_ACCOUNTS_API, async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(clone(state.bankAccounts)),
      });
      return;
    }

    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON();
      state.bankAccountBodies.push(body);
      const account = body as {
        bankName: string;
        accountNumber: string;
        accountHolder?: string;
        branch?: string;
        openingBalance?: number;
        description?: string;
        isPrimary?: boolean;
      };
      const created: BankAccountItem = {
        _id: `bank-${state.bankAccounts.length + 1}`,
        accountCode: `BA-TEST-${state.bankAccounts.length + 1}`,
        bankName: account.bankName,
        accountNumber: account.accountNumber,
        accountHolder: account.accountHolder || '',
        branch: account.branch || '',
        currentBalance: Number(account.openingBalance || 0),
        openingBalance: Number(account.openingBalance || 0),
        status: 'ACTIVE',
        description: account.description || '',
        isPrimary: Boolean(account.isPrimary),
        createdByName: 'Director Demo',
        createdAt: '2026-04-11T09:00:00.000Z',
      };
      if (created.isPrimary) {
        for (const existing of state.bankAccounts) existing.isPrimary = false;
      }
      state.bankAccounts = [created, ...state.bankAccounts];
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(created),
      });
      return;
    }

    await route.fallback();
  });

  await page.route(BANK_TRANSACTIONS_API, async (route) => {
    if (route.request().method() === 'GET') {
      const url = new URL(route.request().url());
      let items = [...state.bankTransactions];
      const bankAccountId = url.searchParams.get('bankAccountId');
      const type = url.searchParams.get('type');
      const keyword = (url.searchParams.get('keyword') || '').trim().toLowerCase();
      if (bankAccountId) {
        items = items.filter((item) => item.bankAccountId === bankAccountId);
      }
      if (type) {
        items = items.filter((item) => item.type === type);
      }
      if (keyword) {
        items = items.filter((item) =>
          [item.transactionCode, item.description || '', item.reference || '']
            .some((field) => field.toLowerCase().includes(keyword)),
        );
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(clone(items)),
      });
      return;
    }

    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON();
      state.bankTransactionBodies.push(body);
      const payload = body as {
        bankAccountId: string;
        type: string;
        category?: string;
        amount: number;
        transactionDate: string;
        description?: string;
        reference?: string;
      };
      const account = state.bankAccounts.find((item) => item._id === payload.bankAccountId);
      if (!account) {
        await route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Bank account not found' }),
        });
        return;
      }
      const balanceBefore = account.currentBalance;
      const isOutflow = ['WITHDRAWAL', 'TRANSFER_OUT', 'FEE'].includes(payload.type);
      const delta = isOutflow ? -Number(payload.amount) : Number(payload.amount);
      account.currentBalance += delta;
      const created: BankTransactionItem = {
        _id: `bank-tx-${state.bankTransactions.length + 1}`,
        transactionCode: `BT-TEST-${state.bankTransactions.length + 1}`,
        bankAccountId: payload.bankAccountId,
        type: payload.type,
        category: payload.category || 'OTHER',
        amount: Number(payload.amount),
        balanceBefore,
        balanceAfter: account.currentBalance,
        transactionDate: `${payload.transactionDate}T00:00:00.000Z`,
        description: payload.description || '',
        reference: payload.reference || '',
        recordedByName: 'Director Demo',
        isReconciled: false,
        createdAt: '2026-04-11T09:05:00.000Z',
      };
      state.bankTransactions = [created, ...state.bankTransactions];
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(created),
      });
      return;
    }

    await route.fallback();
  });

  await page.route(BANK_RECONCILE_API, async (route) => {
    if (route.request().method() !== 'POST') {
      await route.fallback();
      return;
    }

    const id = route.request().url().split('/bank-transactions/')[1]?.split('/reconcile')[0] || '';
    state.reconcileIds.push(id);
    const transaction = state.bankTransactions.find((item) => item._id === id);
    if (transaction) {
      transaction.isReconciled = true;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    });
  });

  await page.route(FUNDS_API, async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(clone(state.funds)),
      });
      return;
    }

    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON();
      state.fundBodies.push(body);
      const payload = body as {
        name: string;
        fundType: string;
        currentBalance?: number;
        minimumBalance?: number;
        targetBalance?: number;
        description?: string;
      };
      const currentBalance = Number(payload.currentBalance || 0);
      const created: FundItem = {
        _id: `fund-${state.funds.length + 1}`,
        fundCode: `FUND-TEST-${state.funds.length + 1}`,
        name: payload.name,
        fundType: payload.fundType,
        currentBalance,
        minimumBalance: Number(payload.minimumBalance || 0),
        targetBalance: Number(payload.targetBalance || 0),
        status: 'ACTIVE',
        description: payload.description || '',
        totalDeposited: currentBalance,
        totalWithdrawn: 0,
        createdByName: 'Director Demo',
        createdAt: '2026-04-11T09:10:00.000Z',
      };
      state.funds = [created, ...state.funds];
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(created),
      });
      return;
    }

    await route.fallback();
  });

  await page.route(FUND_TRANSACTIONS_API, async (route) => {
    if (route.request().method() === 'GET') {
      const url = new URL(route.request().url());
      let items = [...state.fundTransactions];
      const fundId = url.searchParams.get('fundId');
      const type = url.searchParams.get('type');
      if (fundId) {
        items = items.filter((item) => item.fundId === fundId);
      }
      if (type) {
        items = items.filter((item) => item.type === type);
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(clone(items)),
      });
      return;
    }

    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON();
      state.fundTransactionBodies.push(body);
      const payload = body as {
        fundId: string;
        type: string;
        amount: number;
        transactionDate: string;
        description?: string;
        reference?: string;
      };
      const fund = state.funds.find((item) => item._id === payload.fundId);
      if (!fund) {
        await route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Fund not found' }),
        });
        return;
      }
      const balanceBefore = fund.currentBalance;
      const delta = payload.type === 'WITHDRAW' ? -Number(payload.amount) : Number(payload.amount);
      fund.currentBalance += delta;
      if (payload.type === 'DEPOSIT') {
        fund.totalDeposited += Number(payload.amount);
      }
      if (payload.type === 'WITHDRAW') {
        fund.totalWithdrawn += Number(payload.amount);
      }
      const created: FundTransactionItem = {
        _id: `fund-tx-${state.fundTransactions.length + 1}`,
        transactionCode: `FT-TEST-${state.fundTransactions.length + 1}`,
        fundId: payload.fundId,
        type: payload.type,
        amount: Number(payload.amount),
        balanceBefore,
        balanceAfter: fund.currentBalance,
        transactionDate: `${payload.transactionDate}T00:00:00.000Z`,
        description: payload.description || '',
        reference: payload.reference || '',
        performedByName: 'Director Demo',
        createdAt: '2026-04-11T09:15:00.000Z',
      };
      state.fundTransactions = [created, ...state.fundTransactions];
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(created),
      });
      return;
    }

    await route.fallback();
  });

  await page.route(RECONCILIATION_API, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(reconciliationReport(state)),
    });
  });
}

test.use({ video: 'on', trace: 'off' });
test.describe.configure({ mode: 'serial', timeout: 180_000 });

test('B08 financial-control creates bank account and records bank transaction with exact payload and balance updates', async ({
  browser,
  page,
  request,
}) => {
  const batch = await openBatch(browser, 'financial_control_bank_create_tx_browser');
  const state: FinancialControlState = {
    bankAccounts: [],
    bankTransactions: [],
    funds: [],
    fundTransactions: [],
    bankAccountBodies: [],
    bankTransactionBodies: [],
    reconcileIds: [],
    fundBodies: [],
    fundTransactionBodies: [],
  };

  const expectedCreateBody = {
    bankName: 'Vietcombank QA',
    accountNumber: '97040011223344',
    accountHolder: 'Cong ty QA',
    branch: 'Chi nhanh Quan 1',
    openingBalance: 2500000,
    description: 'Tai khoan test B08',
    isPrimary: true,
  };

  const expectedTransactionBody = {
    bankAccountId: 'bank-1',
    type: 'DEPOSIT',
    category: 'OTHER',
    amount: 1250000,
    transactionDate: '2026-04-11',
    description: 'Thu bo sung tai khoan ngan hang B08',
    reference: 'B08-BANK-TX-001',
  };

  try {
    await installFinancialControlRoutes(page, state);
    await signInAs(batch.page, request, 'director');
    await batch.page.goto(appUrl('/app/financial-control'));
    await batch.page.waitForLoadState('networkidle');

    await batch.page.locator('.tab-bar button').nth(3).click();
    await expect(batch.page.locator('.tab-content .section-header h3').first()).toContainText(/Ng.n h.ng/i);
    await batch.step('financial-control-bank-tab-opened');

    await batch.page.locator('.tab-content .section-header .primary').first().click();
    const bankModal = batch.page.locator('.modal-backdrop .modal').last();
    await expect(bankModal).toBeVisible();

    await bankModal.locator('input[name="bankName"]').fill(expectedCreateBody.bankName);
    await bankModal.locator('input[name="accountNumber"]').fill(expectedCreateBody.accountNumber);
    await bankModal.locator('input[name="accountHolder"]').fill(expectedCreateBody.accountHolder);
    await bankModal.locator('input[name="branch"]').fill(expectedCreateBody.branch);
    await bankModal.locator('input[name="openingBalance"]').fill(String(expectedCreateBody.openingBalance));
    await bankModal.locator('textarea[name="description"]').fill(expectedCreateBody.description);
    await bankModal.locator('input[name="isPrimary"]').check();
    await bankModal.locator('.form-actions .primary').click();

    await expect(bankModal).toBeHidden({ timeout: 20_000 });
    expect(state.bankAccountBodies).toHaveLength(1);
    expect(state.bankAccountBodies[0]).toEqual(expectedCreateBody);

    const bankCard = batch.page.locator('.bank-card').filter({ hasText: expectedCreateBody.accountNumber }).first();
    await expect(bankCard).toBeVisible();
    await expect(bankCard).toContainText(expectedCreateBody.bankName);
    await expect(bankCard).toContainText('2,500,000');
    await batch.step('financial-control-bank-account-created');

    await bankCard.click();
    await batch.page.locator('.section-header.mt .primary').first().click();
    const bankTxModal = batch.page.locator('.modal-backdrop .modal').last();
    await expect(bankTxModal).toBeVisible();

    await bankTxModal.locator('select[name="type"]').selectOption(expectedTransactionBody.type);
    await bankTxModal.locator('select[name="category"]').selectOption(expectedTransactionBody.category);
    await bankTxModal.locator('input[name="amount"]').fill(String(expectedTransactionBody.amount));
    await bankTxModal.locator('input[name="transactionDate"]').fill(expectedTransactionBody.transactionDate);
    await bankTxModal.locator('textarea[name="description"]').fill(expectedTransactionBody.description);
    await bankTxModal.locator('input[name="reference"]').fill(expectedTransactionBody.reference);
    await bankTxModal.locator('.form-actions .primary').click();

    await expect(bankTxModal).toBeHidden({ timeout: 20_000 });
    expect(state.bankTransactionBodies).toHaveLength(1);
    expect(state.bankTransactionBodies[0]).toEqual(expectedTransactionBody);

    const transactionRow = batch.page.locator('table.data tbody tr').filter({ hasText: expectedTransactionBody.reference }).first();
    await expect(transactionRow).toBeVisible();
    await expect(transactionRow).toContainText('Nạp vào');
    await expect(transactionRow).toContainText('+1,250,000');
    await expect(transactionRow).toContainText('2,500,000');
    await expect(transactionRow).toContainText('3,750,000');
    await expect(bankCard).toContainText('3,750,000');
    await batch.step('financial-control-bank-transaction-recorded');

    await batch.finalize('PASS', {
      extraLines: [
        'Director created bank account with exact POST payload and saw the new bank card reload immediately.',
        'Director recorded a bank transaction with exact POST payload and saw both table row and bank-card balance update.',
        `Created account body: ${JSON.stringify(expectedCreateBody)}`,
        `Recorded bank transaction body: ${JSON.stringify(expectedTransactionBody)}`,
      ],
    });
  } catch (error) {
    await batch.finalize('FAIL', { error });
    throw error;
  }
});

test('B08 financial-control creates fund and records fund transaction with exact payload and balance updates', async ({
  browser,
  page,
  request,
}) => {
  const batch = await openBatch(browser, 'financial_control_fund_create_tx_browser');
  const state: FinancialControlState = {
    bankAccounts: [],
    bankTransactions: [],
    funds: [],
    fundTransactions: [],
    bankAccountBodies: [],
    bankTransactionBodies: [],
    reconcileIds: [],
    fundBodies: [],
    fundTransactionBodies: [],
  };

  const expectedCreateBody = {
    name: 'Quy Du phong QA',
    fundType: 'RESERVE',
    currentBalance: 1800000,
    minimumBalance: 500000,
    targetBalance: 3000000,
    description: 'Quy du phong test B08',
  };

  const expectedTransactionBody = {
    fundId: 'fund-1',
    type: 'DEPOSIT',
    amount: 900000,
    transactionDate: '2026-04-11',
    description: 'Bo sung quy du phong B08',
    reference: 'B08-FUND-TX-001',
  };

  try {
    await installFinancialControlRoutes(page, state);
    await signInAs(batch.page, request, 'director');
    await batch.page.goto(appUrl('/app/financial-control'));
    await batch.page.waitForLoadState('networkidle');

    await batch.page.locator('.tab-bar button').nth(4).click();
    await expect(batch.page.locator('.tab-content .section-header h3').first()).toContainText(/Qu.y/i);
    await batch.step('financial-control-funds-tab-opened');

    await batch.page.locator('.tab-content .section-header .primary').first().click();
    const fundModal = batch.page.locator('.modal-backdrop .modal').last();
    await expect(fundModal).toBeVisible();

    await fundModal.locator('input[name="name"]').fill(expectedCreateBody.name);
    await fundModal.locator('select[name="fundType"]').selectOption(expectedCreateBody.fundType);
    await fundModal.locator('input[name="currentBalance"]').fill(String(expectedCreateBody.currentBalance));
    await fundModal.locator('input[name="minimumBalance"]').fill(String(expectedCreateBody.minimumBalance));
    await fundModal.locator('input[name="targetBalance"]').fill(String(expectedCreateBody.targetBalance));
    await fundModal.locator('textarea[name="description"]').fill(expectedCreateBody.description);
    await fundModal.locator('.form-actions .primary').click();

    await expect(fundModal).toBeHidden({ timeout: 20_000 });
    expect(state.fundBodies).toHaveLength(1);
    expect(state.fundBodies[0]).toEqual(expectedCreateBody);

    const fundCard = batch.page.locator('.fund-card').filter({ hasText: expectedCreateBody.name }).first();
    await expect(fundCard).toBeVisible();
    await expect(fundCard).toContainText('1,800,000');
    await expect(fundCard).toContainText('500,000');
    await expect(fundCard).toContainText('3,000,000');
    await batch.step('financial-control-fund-created');

    await fundCard.click();
    await batch.page.locator('.section-header.mt .primary').first().click();
    const fundTxModal = batch.page.locator('.modal-backdrop .modal').last();
    await expect(fundTxModal).toBeVisible();

    await fundTxModal.locator('select[name="type"]').selectOption(expectedTransactionBody.type);
    await fundTxModal.locator('input[name="amount"]').fill(String(expectedTransactionBody.amount));
    await fundTxModal.locator('input[name="transactionDate"]').fill(expectedTransactionBody.transactionDate);
    await fundTxModal.locator('textarea[name="description"]').fill(expectedTransactionBody.description);
    await fundTxModal.locator('input[name="reference"]').fill(expectedTransactionBody.reference);
    await fundTxModal.locator('.form-actions .primary').click();

    await expect(fundTxModal).toBeHidden({ timeout: 20_000 });
    expect(state.fundTransactionBodies).toHaveLength(1);
    expect(state.fundTransactionBodies[0]).toEqual(expectedTransactionBody);

    const fundTxRow = batch.page.locator('table.data tbody tr').filter({ hasText: expectedTransactionBody.reference }).first();
    await expect(fundTxRow).toBeVisible();
    await expect(fundTxRow).toContainText('Nạp vào');
    await expect(fundTxRow).toContainText('+900,000');
    await expect(fundTxRow).toContainText('1,800,000');
    await expect(fundTxRow).toContainText('2,700,000');
    await expect(fundCard).toContainText('2,700,000');
    await batch.step('financial-control-fund-transaction-recorded');

    await batch.finalize('PASS', {
      extraLines: [
        'Director created a fund with exact POST payload and saw the new fund card reload immediately.',
        'Director recorded a fund transaction with exact POST payload and saw both table row and fund-card balance update.',
        `Created fund body: ${JSON.stringify(expectedCreateBody)}`,
        `Recorded fund transaction body: ${JSON.stringify(expectedTransactionBody)}`,
      ],
    });
  } catch (error) {
    await batch.finalize('FAIL', { error });
    throw error;
  }
});

test('B08 financial-control reconciles bank transaction and updates unreconciled report counters', async ({
  browser,
  request,
}) => {
  const batch = await openBatch(browser, 'financial_control_reconcile_browser');
  const state: FinancialControlState = {
    bankAccounts: [
      {
        _id: 'bank-seed-1',
        accountCode: 'BA-SEED-1',
        bankName: 'ACB QA',
        accountNumber: '97045555666677',
        accountHolder: 'Cong ty QA',
        branch: 'Chi nhanh Binh Thanh',
        currentBalance: 4200000,
        openingBalance: 3000000,
        status: 'ACTIVE',
        description: 'Seeded bank account for B08 reconcile browser',
        isPrimary: true,
        createdByName: 'Director Demo',
        createdAt: '2026-04-11T08:00:00.000Z',
      },
    ],
    bankTransactions: [
      {
        _id: 'bank-tx-seed-1',
        transactionCode: 'BT-SEED-1',
        bankAccountId: 'bank-seed-1',
        type: 'DEPOSIT',
        category: 'OTHER',
        amount: 1200000,
        balanceBefore: 3000000,
        balanceAfter: 4200000,
        transactionDate: '2026-04-11T00:00:00.000Z',
        description: 'Pending reconciliation seed',
        reference: 'B08-RECON-001',
        recordedByName: 'Accounting Demo',
        isReconciled: false,
        createdAt: '2026-04-11T08:30:00.000Z',
      },
    ],
    funds: [],
    fundTransactions: [],
    bankAccountBodies: [],
    bankTransactionBodies: [],
    reconcileIds: [],
    fundBodies: [],
    fundTransactionBodies: [],
  };

  try {
    await installFinancialControlRoutes(batch.page, state);
    await signInAs(batch.page, request, 'accounting');
    await batch.page.goto(appUrl('/app/financial-control'));
    await batch.page.waitForLoadState('networkidle');

    await batch.page.locator('.tab-bar button').nth(3).click();
    const bankCard = batch.page.locator('.bank-card').filter({ hasText: '97045555666677' }).first();
    await expect(bankCard).toBeVisible();
    await bankCard.click();

    const txRow = batch.page
      .locator('table.data tbody tr')
      .filter({ hasText: /BT-SEED-1/ })
      .filter({ hasText: /Pending reconciliation seed/ })
      .first();
    await expect(txRow).toBeVisible();
    await expect(txRow.locator('.badge.reconciled')).toHaveCount(0);
    await expect(txRow.getByRole('button', { name: /Đối soát|Doi soat/i })).toBeVisible();
    await batch.step('financial-control-reconcile-before');

    const dialogPromise = batch.page.waitForEvent('dialog').then(async (dialog) => {
      const message = dialog.message();
      await dialog.accept();
      return message;
    });
    await txRow.getByRole('button', { name: /Đối soát|Doi soat/i }).click();
    const dialogMessage = await dialogPromise;
    expect(dialogMessage).toBe('Xác nhận đối soát giao dịch này?');
    expect(state.reconcileIds).toEqual(['bank-tx-seed-1']);

    await expect(txRow.locator('.badge.reconciled')).toBeVisible();
    await expect(txRow.getByRole('button', { name: /Đối soát|Doi soat/i })).toHaveCount(0);
    await batch.step('financial-control-reconcile-after');

    await batch.page.locator('.tab-bar button').nth(7).click();
    const unreconciledCard = batch.page.locator('.recon-card').filter({ hasText: /Chưa đối soát|Chua doi soat/i }).first();
    await expect(unreconciledCard).toBeVisible();
    await expect(unreconciledCard).toContainText('0');
    await batch.step('financial-control-reconciliation-report-updated');

    await batch.finalize('PASS', {
      extraLines: [
        `Reconcile ids: ${state.reconcileIds.join(', ')}`,
        `Dialog message: ${dialogMessage}`,
        'Transaction row switched from action button to reconciled badge after POST /bank-transactions/:id/reconcile.',
        'Financial-control reconciliation tab recomputed unreconciled counter from 1 to 0.',
      ],
    });
  } catch (error) {
    await batch.finalize('FAIL', { error });
    throw error;
  }
});

test('B08 financial-control tabs render provisional, bank, funds, cashflow, and pnl seeded data without crossing tab contracts', async ({
  browser,
  request,
}) => {
  const batch = await openBatch(browser, 'financial_control_tabs_browser');
  const state: FinancialControlState = {
    bankAccounts: [
      {
        _id: 'bank-tabs-1',
        accountCode: 'BA-TABS-1',
        bankName: 'Techcombank QA',
        accountNumber: '97042222333344',
        accountHolder: 'Cong ty QA',
        branch: 'Chi nhanh Thu Duc',
        currentBalance: 4200000,
        openingBalance: 3000000,
        status: 'ACTIVE',
        description: 'Seeded bank account for tab coverage',
        isPrimary: true,
        createdByName: 'Director Demo',
        createdAt: '2026-04-11T08:00:00.000Z',
      },
    ],
    bankTransactions: [
      {
        _id: 'bank-tx-tabs-1',
        transactionCode: 'BT-TABS-1',
        bankAccountId: 'bank-tabs-1',
        type: 'DEPOSIT',
        category: 'OTHER',
        amount: 1200000,
        balanceBefore: 3000000,
        balanceAfter: 4200000,
        transactionDate: '2026-04-11T00:00:00.000Z',
        description: 'Seeded bank transaction for tab coverage',
        reference: 'B08-TABS-BANK-001',
        recordedByName: 'Accounting Demo',
        isReconciled: true,
        createdAt: '2026-04-11T08:30:00.000Z',
      },
    ],
    funds: [
      {
        _id: 'fund-tabs-1',
        fundCode: 'FUND-TABS-1',
        name: 'Quy Marketing QA',
        fundType: 'MARKETING',
        currentBalance: 2700000,
        minimumBalance: 1000000,
        targetBalance: 5000000,
        status: 'ACTIVE',
        description: 'Seeded fund for tab coverage',
        totalDeposited: 3600000,
        totalWithdrawn: 900000,
        createdByName: 'Director Demo',
        createdAt: '2026-04-11T09:00:00.000Z',
      },
    ],
    fundTransactions: [
      {
        _id: 'fund-tx-tabs-1',
        transactionCode: 'FT-TABS-1',
        fundId: 'fund-tabs-1',
        type: 'DEPOSIT',
        amount: 900000,
        balanceBefore: 1800000,
        balanceAfter: 2700000,
        transactionDate: '2026-04-11T00:00:00.000Z',
        description: 'Seeded fund transaction for tab coverage',
        reference: 'B08-TABS-FUND-001',
        performedByName: 'Accounting Demo',
        createdAt: '2026-04-11T09:05:00.000Z',
      },
    ],
    bankAccountBodies: [],
    bankTransactionBodies: [],
    reconcileIds: [],
    fundBodies: [],
    fundTransactionBodies: [],
  };
  const provisionalMonths: string[] = [];
  const cashFlowGroupBys: string[] = [];
  const pnlBases: string[] = [];

  try {
    await installFinancialControlRoutes(batch.page, state);

    await batch.page.route(PROVISIONAL_GROSS_PROFIT_API, async (route) => {
      const url = new URL(route.request().url());
      const month = url.searchParams.get('month') || '';
      provisionalMonths.push(month);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(provisionalGrossProfitReport(month)),
      });
    });

    await batch.page.route(CASHFLOW_API, async (route) => {
      const url = new URL(route.request().url());
      const groupBy = url.searchParams.get('groupBy') || 'month';
      cashFlowGroupBys.push(groupBy);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(cashFlowReport(groupBy)),
      });
    });

    await batch.page.route(PNL_API, async (route) => {
      const url = new URL(route.request().url());
      const basis = (url.searchParams.get('basis') || 'cash') as 'cash' | 'accrual';
      pnlBases.push(basis);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(profitAndLossReport(basis)),
      });
    });

    await signInAs(batch.page, request, 'director');
    await batch.page.goto(appUrl('/app/financial-control'));
    await batch.page.waitForLoadState('networkidle');

    await batch.page.locator('.tab-bar button').nth(1).click();
    await expect(batch.page.locator('.tab-content h3').first()).toContainText(/L.i nhu.n g.p t.m t.nh/i);
    await batch.page.locator('.tab-content input[type="month"]').fill('2026-03');
    await batch.page.locator('.tab-content .primary').filter({ hasText: /Xem/i }).click();
    await expect(batch.page.locator('.tab-content .ov-label').filter({ hasText: /Doanh thu t.m t.nh/i }).first()).toBeVisible();
    await expect(batch.page.locator('.tab-content')).toContainText('7,200,000');
    await expect(batch.page.locator('.tab-content')).toContainText('6,100,000');
    await expect(batch.page.locator('.tab-content')).toContainText('2,200,000');
    await expect(batch.page.locator('.tab-content')).toContainText('3,900,000');
    expect(provisionalMonths).toContain('2026-03');
    await batch.step('financial-control-provisional-tab-visible');

    await batch.page.locator('.tab-bar button').nth(3).click();
    await expect(batch.page.locator('.tab-content .section-header h3').first()).toContainText(/Ng.n h.ng/i);
    const bankCard = batch.page.locator('.bank-card').filter({ hasText: '97042222333344' }).first();
    await expect(bankCard).toBeVisible();
    await expect(bankCard).toContainText('4,200,000');
    await bankCard.click();
    const bankTxRow = batch.page.locator('table.data tbody tr').filter({ hasText: 'BT-TABS-1' }).first();
    await expect(bankTxRow).toBeVisible();
    await expect(bankTxRow).toContainText('+1,200,000');
    await expect(bankTxRow.locator('.badge.reconciled')).toBeVisible();
    await batch.step('financial-control-bank-tab-visible');

    await batch.page.locator('.tab-bar button').nth(4).click();
    await expect(batch.page.locator('.tab-content .section-header h3').first()).toContainText(/Qu.n l. Qu./i);
    const fundCard = batch.page.locator('.fund-card').filter({ hasText: 'Quy Marketing QA' }).first();
    await expect(fundCard).toBeVisible();
    await expect(fundCard).toContainText('2,700,000');
    await expect(fundCard).toContainText('1,000,000');
    await fundCard.click();
    const fundTxRow = batch.page.locator('table.data tbody tr').filter({ hasText: 'FT-TABS-1' }).first();
    await expect(fundTxRow).toBeVisible();
    await expect(fundTxRow).toContainText('+900,000');
    await batch.step('financial-control-funds-tab-visible');

    await batch.page.locator('.tab-bar button').nth(5).click();
    await expect(batch.page.locator('.tab-content .section-header h3').first()).toContainText(/D.ng ti.n/i);
    await expect(batch.page.locator('.cashflow-summary')).toContainText('9,000,000');
    await expect(batch.page.locator('.cashflow-summary')).toContainText('2,800,000');
    await expect(batch.page.locator('.cashflow-summary')).toContainText('6,200,000');
    await expect(batch.page.locator('.tab-content')).toContainText(/Basis:\s*CASH/i);
    await expect(batch.page.locator('table.data tbody tr').first()).toContainText('2026-04');
    expect(cashFlowGroupBys).toContain('month');
    await batch.step('financial-control-cashflow-tab-visible');

    await batch.page.locator('.tab-bar button').nth(6).click();
    await expect(batch.page.locator('.tab-content .section-header h3').first()).toContainText(/P&L Report/i);
    await expect(batch.page.locator('.pnl-section.revenue')).toContainText('5,400,000');
    await expect(batch.page.locator('.pnl-section.costs')).toContainText('2,500,000');
    await expect(batch.page.locator('.pnl-section.summary')).toContainText('4,450,000');
    await expect(batch.page.locator('.pnl-section.summary')).toContainText('2,900,000');
    expect(pnlBases).toContain('cash');
    await batch.step('financial-control-pnl-tab-visible');

    await batch.finalize('PASS', {
      extraLines: [
        `Provisional months requested: ${provisionalMonths.join(', ')}`,
        `Cash-flow groupBy values: ${cashFlowGroupBys.join(', ')}`,
        `P&L basis values: ${pnlBases.join(', ')}`,
        'Verified provisional gross profit tab renders seeded month metrics after explicit month selection.',
        'Verified bank and fund tabs render seeded cards plus transaction rows without mixing bank and fund contracts.',
        'Verified cashflow tab renders summary cards and timeline on the current cash basis contract.',
        'Verified P&L tab renders revenue, cost, and summary sections on the current cash basis contract.',
      ],
    });
  } catch (error) {
    await batch.finalize('FAIL', { error });
    throw error;
  }
});

test('B08 financial-control tab switching clears stale bank and fund selection state before reopening transaction forms', async ({
  browser,
  request,
}) => {
  const batch = await openBatch(browser, 'financial_control_tab_switch_state_browser');
  const state: FinancialControlState = {
    bankAccounts: [
      {
        _id: 'bank-stale-1',
        accountCode: 'BA-ST-1',
        bankName: 'Techcombank Cu',
        accountNumber: '97040000111122',
        accountHolder: 'Cong ty Cu',
        branch: 'Thu Duc',
        currentBalance: 5100000,
        openingBalance: 3500000,
        status: 'ACTIVE',
        description: 'Old bank account before tab switch',
        isPrimary: true,
        createdByName: 'Director Demo',
        createdAt: '2026-04-11T08:00:00.000Z',
      },
    ],
    bankTransactions: [
      {
        _id: 'bank-tx-stale-1',
        transactionCode: 'BT-STALE-1',
        bankAccountId: 'bank-stale-1',
        type: 'DEPOSIT',
        category: 'OTHER',
        amount: 1600000,
        balanceBefore: 3500000,
        balanceAfter: 5100000,
        transactionDate: '2026-04-11T00:00:00.000Z',
        description: 'Old bank transaction before tab switch',
        reference: 'BANK-STALE-OLD',
        recordedByName: 'Accounting Demo',
        isReconciled: true,
        createdAt: '2026-04-11T08:30:00.000Z',
      },
    ],
    funds: [
      {
        _id: 'fund-stale-1',
        fundCode: 'FUND-ST-1',
        name: 'Quy Cu',
        fundType: 'RESERVE',
        currentBalance: 2200000,
        minimumBalance: 500000,
        targetBalance: 3500000,
        status: 'ACTIVE',
        description: 'Old fund before tab switch',
        totalDeposited: 2200000,
        totalWithdrawn: 0,
        createdByName: 'Director Demo',
        createdAt: '2026-04-11T09:00:00.000Z',
      },
    ],
    fundTransactions: [
      {
        _id: 'fund-tx-stale-1',
        transactionCode: 'FT-STALE-1',
        fundId: 'fund-stale-1',
        type: 'DEPOSIT',
        amount: 700000,
        balanceBefore: 1500000,
        balanceAfter: 2200000,
        transactionDate: '2026-04-11T00:00:00.000Z',
        description: 'Old fund transaction before tab switch',
        reference: 'FUND-STALE-OLD',
        performedByName: 'Accounting Demo',
        createdAt: '2026-04-11T09:05:00.000Z',
      },
    ],
    bankAccountBodies: [],
    bankTransactionBodies: [],
    reconcileIds: [],
    fundBodies: [],
    fundTransactionBodies: [],
  };
  const bankTransactionRequests: string[] = [];
  const fundTransactionRequests: string[] = [];

  try {
    await installFinancialControlRoutes(batch.page, state);

    batch.page.on('request', (req) => {
      if (req.method() !== 'GET') return;
      const url = req.url();
      if (BANK_TRANSACTIONS_API.test(url)) {
        bankTransactionRequests.push(url);
      }
      if (FUND_TRANSACTIONS_API.test(url)) {
        fundTransactionRequests.push(url);
      }
    });

    await signInAs(batch.page, request, 'director');
    await batch.page.goto(appUrl('/app/financial-control'));
    await batch.page.waitForLoadState('networkidle');

    await batch.page.locator('.tab-bar button').nth(3).click();
    const oldBankCard = batch.page.locator('.bank-card').filter({ hasText: '97040000111122' }).first();
    await expect(oldBankCard).toBeVisible();
    await oldBankCard.click();
    const oldBankTxRow = batch.page.locator('table.data tbody tr').filter({ hasText: 'BT-STALE-1' }).first();
    await expect(oldBankTxRow).toBeVisible();
    await batch.step('financial-control-bank-old-selection');

    await batch.page.locator('.section-header.mt .primary').first().click();
    let txModal = batch.page.locator('.modal-backdrop .modal').last();
    await expect(txModal.locator('form')).toBeVisible();
    await txModal.locator('textarea[name="description"]').fill('draft-bank-should-reset');
    await txModal.locator('input[name="reference"]').fill('BANK-DRAFT-RESET');
    await txModal.getByRole('button', { name: /H.y/i }).click();
    await expect(txModal).toHaveCount(0);

    await batch.page.locator('.tab-bar button').nth(4).click();
    const oldFundCard = batch.page.locator('.fund-card').filter({ hasText: 'Quy Cu' }).first();
    await expect(oldFundCard).toBeVisible();
    await oldFundCard.click();
    const oldFundTxRow = batch.page.locator('table.data tbody tr').filter({ hasText: 'FT-STALE-1' }).first();
    await expect(oldFundTxRow).toBeVisible();
    await batch.step('financial-control-fund-old-selection');

    await batch.page.locator('.section-header.mt .primary').first().click();
    let fundModal = batch.page.locator('.modal-backdrop .modal').last();
    await expect(fundModal.locator('form')).toBeVisible();
    await fundModal.locator('textarea[name="description"]').fill('draft-fund-should-reset');
    await fundModal.locator('input[name="reference"]').fill('FUND-DRAFT-RESET');
    await fundModal.getByRole('button', { name: /H.y/i }).click();
    await expect(fundModal).toHaveCount(0);

    state.bankAccounts = [
      {
        _id: 'bank-stale-2',
        accountCode: 'BA-ST-2',
        bankName: 'Vietcombank Moi',
        accountNumber: '97040000999988',
        accountHolder: 'Cong ty Moi',
        branch: 'Quan 7',
        currentBalance: 7800000,
        openingBalance: 6000000,
        status: 'ACTIVE',
        description: 'New bank account after tab switch',
        isPrimary: true,
        createdByName: 'Director Demo',
        createdAt: '2026-04-11T10:00:00.000Z',
      },
    ];
    state.bankTransactions = [
      {
        _id: 'bank-tx-stale-2',
        transactionCode: 'BT-STALE-2',
        bankAccountId: 'bank-stale-2',
        type: 'DEPOSIT',
        category: 'OTHER',
        amount: 1800000,
        balanceBefore: 6000000,
        balanceAfter: 7800000,
        transactionDate: '2026-04-11T00:00:00.000Z',
        description: 'New bank transaction after tab switch',
        reference: 'BANK-STALE-NEW',
        recordedByName: 'Accounting Demo',
        isReconciled: true,
        createdAt: '2026-04-11T10:05:00.000Z',
      },
    ];
    state.funds = [
      {
        _id: 'fund-stale-2',
        fundCode: 'FUND-ST-2',
        name: 'Quy Moi',
        fundType: 'MARKETING',
        currentBalance: 3100000,
        minimumBalance: 1200000,
        targetBalance: 5000000,
        status: 'ACTIVE',
        description: 'New fund after tab switch',
        totalDeposited: 3600000,
        totalWithdrawn: 500000,
        createdByName: 'Director Demo',
        createdAt: '2026-04-11T10:15:00.000Z',
      },
    ];
    state.fundTransactions = [
      {
        _id: 'fund-tx-stale-2',
        transactionCode: 'FT-STALE-2',
        fundId: 'fund-stale-2',
        type: 'DEPOSIT',
        amount: 900000,
        balanceBefore: 2200000,
        balanceAfter: 3100000,
        transactionDate: '2026-04-11T00:00:00.000Z',
        description: 'New fund transaction after tab switch',
        reference: 'FUND-STALE-NEW',
        performedByName: 'Accounting Demo',
        createdAt: '2026-04-11T10:20:00.000Z',
      },
    ];

    await batch.page.locator('.tab-bar button').nth(7).click();
    await expect(batch.page.locator('.recon-grid').first()).toBeVisible();

    await batch.page.locator('.tab-bar button').nth(3).click();
    const newBankCard = batch.page.locator('.bank-card').filter({ hasText: '97040000999988' }).first();
    await expect(newBankCard).toBeVisible();
    await expect(oldBankCard).toHaveCount(0);
    const bankSectionHeader = batch.page.locator('.section-header.mt h3').first();
    await expect(bankSectionHeader).toContainText(/Giao d.ch ng.n h.ng/i);
    await expect(bankSectionHeader).not.toContainText(/Techcombank Cu/i);
    await expect(batch.page.locator('table.data tbody tr').filter({ hasText: 'BT-STALE-1' })).toHaveCount(0);
    const newBankTxRow = batch.page.locator('table.data tbody tr').filter({ hasText: 'BT-STALE-2' }).first();
    await expect(newBankTxRow).toBeVisible();
    await expect
      .poll(() => bankTransactionRequests.length, { message: 'bank transaction GETs should include initial, selected, and reset loads' })
      .toBeGreaterThanOrEqual(3);
    const lastBankRequest = new URL(bankTransactionRequests[bankTransactionRequests.length - 1]);
    expect(lastBankRequest.searchParams.get('bankAccountId')).toBeNull();
    expect(bankTransactionRequests.some((url) => new URL(url).searchParams.get('bankAccountId') === 'bank-stale-1')).toBe(true);
    await batch.step('financial-control-bank-selection-reset');

    await batch.page.locator('.section-header.mt .primary').first().click();
    txModal = batch.page.locator('.modal-backdrop .modal').last();
    await expect(txModal.locator('select[name="bankAccountId"]')).toHaveValue('bank-stale-2');
    await expect(txModal.locator('select[name="type"]')).toHaveValue('DEPOSIT');
    await expect(txModal.locator('textarea[name="description"]')).toHaveValue('');
    await expect(txModal.locator('input[name="reference"]')).toHaveValue('');
    await txModal.getByRole('button', { name: /H.y/i }).click();
    await expect(txModal).toHaveCount(0);
    await batch.step('financial-control-bank-form-reset');

    await batch.page.locator('.tab-bar button').nth(4).click();
    const newFundCard = batch.page.locator('.fund-card').filter({ hasText: 'Quy Moi' }).first();
    await expect(newFundCard).toBeVisible();
    await expect(oldFundCard).toHaveCount(0);
    await expect(batch.page.locator('.section-header.mt h3')).toHaveCount(0);
    await expect(batch.page.locator('.section-header.mt .primary')).toHaveCount(0);
    await expect(batch.page.locator('table.data tbody tr').filter({ hasText: 'FT-STALE-1' })).toHaveCount(0);
    expect(fundTransactionRequests.some((url) => new URL(url).searchParams.get('fundId') === 'fund-stale-1')).toBe(true);
    expect(fundTransactionRequests.some((url) => new URL(url).searchParams.get('fundId') === 'fund-stale-2')).toBe(false);
    await batch.step('financial-control-fund-selection-cleared');

    await newFundCard.click();
    const newFundTxRow = batch.page.locator('table.data tbody tr').filter({ hasText: 'FT-STALE-2' }).first();
    await expect(newFundTxRow).toBeVisible();
    const lastFundRequest = new URL(fundTransactionRequests[fundTransactionRequests.length - 1]);
    expect(lastFundRequest.searchParams.get('fundId')).toBe('fund-stale-2');
    await batch.page.locator('.section-header.mt .primary').first().click();
    fundModal = batch.page.locator('.modal-backdrop .modal').last();
    await expect(fundModal.locator('select[name="type"]')).toHaveValue('DEPOSIT');
    await expect(fundModal.locator('textarea[name="description"]')).toHaveValue('');
    await expect(fundModal.locator('input[name="reference"]')).toHaveValue('');
    await fundModal.getByRole('button', { name: /H.y/i }).click();
    await expect(fundModal).toHaveCount(0);
    await batch.step('financial-control-fund-form-reset');

    expect(state.bankTransactionBodies).toHaveLength(0);
    expect(state.fundTransactionBodies).toHaveLength(0);

    await batch.finalize('PASS', {
      extraLines: [
        `Bank transaction GET requests: ${bankTransactionRequests.join(' | ')}`,
        `Fund transaction GET requests: ${fundTransactionRequests.join(' | ')}`,
        'Bank tab switch cleared stale selected account, removed stale transaction row, and reopened the transaction form with the new account + blank draft fields.',
        'Funds tab switch cleared stale selected fund, hid the stale transaction area until a valid new fund was selected, and reopened the fund transaction form with clean defaults.',
        'No hidden submit side effect occurred while switching tabs or reopening forms.',
      ],
    });
  } catch (error) {
    await batch.finalize('FAIL', { error });
    throw error;
  }
});

test('B08 financial alerts render severity colors and attached actions open the correct handling context', async ({
  browser,
  request,
}) => {
  const batch = await openBatch(browser, 'financial_alerts_browser');
  const state: FinancialControlState = {
    bankAccounts: [],
    bankTransactions: [],
    funds: [
      {
        _id: 'fund-alerts-1',
        fundCode: 'FUND-ALERTS-1',
        name: 'Quy Marketing QA',
        fundType: 'MARKETING',
        currentBalance: 1400000,
        minimumBalance: 1000000,
        targetBalance: 2500000,
        status: 'ACTIVE',
        description: 'Seeded marketing fund for alerts browser proof',
        totalDeposited: 2000000,
        totalWithdrawn: 600000,
        createdByName: 'Director Demo',
        createdAt: '2026-04-11T09:00:00.000Z',
      },
    ],
    fundTransactions: [],
    bankAccountBodies: [],
    bankTransactionBodies: [],
    reconcileIds: [],
    fundBodies: [],
    fundTransactionBodies: [],
  };

  try {
    await installFinancialControlRoutes(batch.page, state);
    await batch.page.route(ALERTS_API, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(financialAlertsReport()),
      });
    });

    await signInAs(batch.page, request, 'director');
    await batch.page.goto(appUrl('/app/financial-control'));
    await batch.page.waitForLoadState('networkidle');

    await batch.page.locator('.tab-bar button').nth(2).click();
    await expect(batch.page.locator('.tab-content .section-header h3').first()).toContainText(/C.nh b.o/i);

    const criticalBadge = batch.page.locator('.alert-badge.critical');
    const warningBadge = batch.page.locator('.alert-badge.warning');
    const infoBadge = batch.page.locator('.alert-badge.info');
    await expect(criticalBadge).toContainText('1');
    await expect(warningBadge).toContainText('1');
    await expect(infoBadge).toContainText('1');

    const criticalBadgeStyles = await criticalBadge.evaluate((node) => {
      const style = window.getComputedStyle(node);
      return {
        color: style.color,
        borderColor: style.borderColor,
      };
    });
    const warningBadgeStyles = await warningBadge.evaluate((node) => {
      const style = window.getComputedStyle(node);
      return {
        color: style.color,
        borderColor: style.borderColor,
      };
    });
    const infoBadgeStyles = await infoBadge.evaluate((node) => {
      const style = window.getComputedStyle(node);
      return {
        color: style.color,
        borderColor: style.borderColor,
      };
    });
    expect(criticalBadgeStyles).toEqual({
      color: 'rgb(220, 38, 38)',
      borderColor: 'rgb(254, 202, 202)',
    });
    expect(warningBadgeStyles).toEqual({
      color: 'rgb(217, 119, 6)',
      borderColor: 'rgb(253, 230, 138)',
    });
    expect(infoBadgeStyles).toEqual({
      color: 'rgb(37, 99, 235)',
      borderColor: 'rgb(191, 219, 254)',
    });

    const criticalCard = batch.page.locator('.alert-card.alert-critical').first();
    const warningCard = batch.page.locator('.alert-card.alert-warning').first();
    const infoCard = batch.page.locator('.alert-card.alert-info').first();
    await expect(criticalCard).toContainText(/Nap quy Marketing/i);
    await expect(warningCard).toContainText(/Xem chi tiet doi soat/i);
    await expect(infoCard).toContainText(/Thong tin dong tien/i);

    const criticalCardBorder = await criticalCard.evaluate((node) => window.getComputedStyle(node).borderLeftColor);
    const warningCardBorder = await warningCard.evaluate((node) => window.getComputedStyle(node).borderLeftColor);
    const infoCardBorder = await infoCard.evaluate((node) => window.getComputedStyle(node).borderLeftColor);
    expect(criticalCardBorder).toBe('rgb(220, 38, 38)');
    expect(warningCardBorder).toBe('rgb(245, 158, 11)');
    expect(infoCardBorder).toBe('rgb(59, 130, 246)');

    const marketingSection = batch.page.locator('.marketing-budget-section');
    await expect(marketingSection).toBeVisible();
    await expect(marketingSection).toContainText('1,400,000');
    await expect(marketingSection).toContainText('250,000');
    await expect(marketingSection).toContainText('1,800,000');
    await batch.step('financial-alerts-severity-visible');

    await warningCard.getByRole('button', { name: /Xem chi tiet doi soat/i }).click();
    await expect(batch.page.locator('.tab-bar button.active')).toContainText(/.i so.t|Doi soat/i);
    await expect(batch.page.locator('.recon-grid')).toBeVisible();
    await expect(batch.page).toHaveURL(/\/app\/financial-control\?tab=reconciliation/);
    await batch.step('financial-alerts-navigate-action');

    await batch.page.locator('.tab-bar button').nth(2).click();
    await expect(criticalCard).toBeVisible();
    await criticalCard.getByRole('button', { name: /Nap quy Marketing/i }).click();
    await expect(batch.page.locator('.tab-bar button.active')).toContainText(/Qu./i);
    const fundTxModal = batch.page.locator('.modal-backdrop .modal').last();
    await expect(fundTxModal).toBeVisible();
    await expect(fundTxModal.getByRole('heading', { name: /N.p\/R.t qu./i })).toContainText(/Quy Marketing QA/i);
    await expect(fundTxModal.locator('select[name="type"]')).toHaveValue('DEPOSIT');
    await expect(fundTxModal.locator('input[name="amount"]')).toHaveValue('500000');
    await expect(fundTxModal.locator('textarea[name="description"]')).toHaveValue(/Nap quy Marketing/i);
    await batch.step('financial-alerts-fund-context-opened');

    await batch.finalize('PASS', {
      extraLines: [
        `Critical badge style: ${JSON.stringify(criticalBadgeStyles)}`,
        `Warning badge style: ${JSON.stringify(warningBadgeStyles)}`,
        `Info badge style: ${JSON.stringify(infoBadgeStyles)}`,
        'Verified alerts summary badges render the current red/orange/blue severity contract in browser CSS, not just text labels.',
        'Verified NAVIGATE action switched financial-control into reconciliation context with the correct URL and report grid.',
        'Verified FUND_DEPOSIT action opened the fund transaction modal with the target marketing fund, DEPOSIT type, seeded amount, and suggested description.',
      ],
    });
  } catch (error) {
    await batch.finalize('FAIL', { error });
    throw error;
  }
});
