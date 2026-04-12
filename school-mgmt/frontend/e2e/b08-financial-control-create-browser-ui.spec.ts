import { expect, test, type APIRequestContext, type Browser, type Page } from '@playwright/test';
import {
  applySessionCookies,
  createBatchEvidenceContext,
  loginAsRole,
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
const FINANCIAL_DASHBOARD_API = new RegExp(`${API_ORIGIN_PATTERN}/financial-control/dashboard(?:\\?.*)?$`);
const BANK_ACCOUNTS_API = new RegExp(`${API_ORIGIN_PATTERN}/financial-control/bank-accounts(?:\\?.*)?$`);
const BANK_TRANSACTIONS_API = new RegExp(`${API_ORIGIN_PATTERN}/financial-control/bank-transactions(?:\\?.*)?$`);
const FUNDS_API = new RegExp(`${API_ORIGIN_PATTERN}/financial-control/funds(?:\\?.*)?$`);
const FUND_TRANSACTIONS_API = new RegExp(`${API_ORIGIN_PATTERN}/financial-control/fund-transactions(?:\\?.*)?$`);

type BankAccount = {
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

type BankTransaction = {
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

type Fund = {
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

type FundTransaction = {
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

type State = {
  bankAccounts: BankAccount[];
  bankTransactions: BankTransaction[];
  funds: Fund[];
  fundTransactions: FundTransaction[];
  createdBankBodies: unknown[];
  createdBankTxBodies: unknown[];
  createdFundBodies: unknown[];
  createdFundTxBodies: unknown[];
};

function appUrl(path: string): string {
  return new URL(path, APP_BASE_URL).toString();
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function formatAmount(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

function dashboardStub() {
  return {
    cashPosition: {
      bankBalance: 3200000,
      bankAccountCount: 1,
      fundBalance: 1200000,
      fundCount: 1,
      marketingFund: 500000,
      marketingFundCount: 1,
      availableCash: 4400000,
    },
    obligations: {
      payrollPayable: 0,
      payrollPayableCount: 0,
      expensePayable: 0,
      expensePayableCount: 0,
      orderPayable: 0,
      orderPayableCount: 0,
      totalPayable14Days: 0,
      operatingReserve3Months: 1000000,
      burnRate: 200000,
      runway: 12,
      reserveHealthy: true,
      cashAfterObligations: 4400000,
    },
    deferredRevenue: {
      walletBalance: 0,
      walletCount: 0,
      pendingInvoiceAmount: 0,
      pendingInvoiceCount: 0,
    },
    metrics: {
      burnRate: 200000,
      runway: 12,
      currentRatio: 2.5,
      grossMargin: 30,
      netMargin: 15,
      grossProfit: 1000000,
      netProfit: 500000,
      revenueGrowth: 8,
      thisMonthRevenue: 3000000,
      lastMonthRevenue: 2770000,
      accountsReceivable: 0,
      accountsPayable: 0,
      deferredRevenue: 0,
    },
    fundWarnings: [],
  };
}

async function openFinancialControl(page: Page, session: DemoSession): Promise<void> {
  await applySessionCookies(page.context(), session);
  await page.goto(appUrl('/app/financial-control'));
  await page.waitForLoadState('networkidle');
  await expect(page.locator('.page-header h2')).toBeVisible();
}

async function clickBankTab(page: Page): Promise<void> {
  await page.locator('.tab-bar button').filter({ hasText: /Ngan hang|Ngân hàng/i }).first().click();
  await expect(page.locator('.section-header h3').filter({ hasText: /Tài khoản Ngân hàng/i })).toBeVisible();
}

async function clickFundsTab(page: Page): Promise<void> {
  await page.locator('.tab-bar button').filter({ hasText: /Quy|Quỹ/i }).first().click();
  await expect(page.locator('.section-header h3').filter({ hasText: /Quản lý Quỹ/i })).toBeVisible();
}

async function installRoutes(page: Page, state: State): Promise<void> {
  await page.route(FINANCIAL_DASHBOARD_API, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(dashboardStub()),
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
      state.createdBankBodies.push(body);

      const created: BankAccount = {
        _id: 'bank-created-001',
        accountCode: 'BA-CREATED-001',
        bankName: String((body as { bankName?: string }).bankName || ''),
        accountNumber: String((body as { accountNumber?: string }).accountNumber || ''),
        accountHolder: String((body as { accountHolder?: string }).accountHolder || ''),
        branch: String((body as { branch?: string }).branch || ''),
        currentBalance: Number((body as { openingBalance?: number }).openingBalance || 0),
        openingBalance: Number((body as { openingBalance?: number }).openingBalance || 0),
        status: 'ACTIVE',
        description: String((body as { description?: string }).description || ''),
        isPrimary: Boolean((body as { isPrimary?: boolean }).isPrimary),
        createdByName: 'Director Demo',
        createdAt: '2026-04-11T09:00:00.000Z',
      };
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
    const url = new URL(route.request().url());

    if (route.request().method() === 'GET') {
      const bankAccountId = url.searchParams.get('bankAccountId');
      const items = bankAccountId
        ? state.bankTransactions.filter((item) => item.bankAccountId === bankAccountId)
        : state.bankTransactions;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(clone(items)),
      });
      return;
    }

    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON();
      state.createdBankTxBodies.push(body);

      const bankAccountId = String((body as { bankAccountId?: string }).bankAccountId || '');
      const amount = Number((body as { amount?: number }).amount || 0);
      const account = state.bankAccounts.find((item) => item._id === bankAccountId);
      if (!account) {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Bank account not found' }),
        });
        return;
      }

      const created: BankTransaction = {
        _id: 'bank-tx-created-001',
        transactionCode: 'BTX-CREATED-001',
        bankAccountId,
        type: String((body as { type?: string }).type || ''),
        category: String((body as { category?: string }).category || ''),
        amount,
        balanceBefore: account.currentBalance,
        balanceAfter: account.currentBalance + amount,
        transactionDate: `${String((body as { transactionDate?: string }).transactionDate || '2026-04-11')}T00:00:00.000Z`,
        description: String((body as { description?: string }).description || ''),
        reference: String((body as { reference?: string }).reference || ''),
        recordedByName: 'Director Demo',
        isReconciled: false,
        createdAt: '2026-04-11T09:10:00.000Z',
      };
      account.currentBalance = created.balanceAfter;
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
      state.createdFundBodies.push(body);

      const created: Fund = {
        _id: 'fund-created-001',
        fundCode: 'F-CREATED-001',
        name: String((body as { name?: string }).name || ''),
        fundType: String((body as { fundType?: string }).fundType || ''),
        currentBalance: Number((body as { currentBalance?: number }).currentBalance || 0),
        minimumBalance: Number((body as { minimumBalance?: number }).minimumBalance || 0),
        targetBalance: Number((body as { targetBalance?: number }).targetBalance || 0),
        status: 'ACTIVE',
        description: String((body as { description?: string }).description || ''),
        totalDeposited: Number((body as { currentBalance?: number }).currentBalance || 0),
        totalWithdrawn: 0,
        createdByName: 'Director Demo',
        createdAt: '2026-04-11T09:20:00.000Z',
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
    const url = new URL(route.request().url());

    if (route.request().method() === 'GET') {
      const fundId = url.searchParams.get('fundId');
      const items = fundId
        ? state.fundTransactions.filter((item) => item.fundId === fundId)
        : state.fundTransactions;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(clone(items)),
      });
      return;
    }

    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON();
      state.createdFundTxBodies.push(body);

      const fundId = String((body as { fundId?: string }).fundId || '');
      const amount = Number((body as { amount?: number }).amount || 0);
      const fund = state.funds.find((item) => item._id === fundId);
      if (!fund) {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Fund not found' }),
        });
        return;
      }

      const created: FundTransaction = {
        _id: 'fund-tx-created-001',
        transactionCode: 'FTX-CREATED-001',
        fundId,
        type: String((body as { type?: string }).type || ''),
        amount,
        balanceBefore: fund.currentBalance,
        balanceAfter:
          String((body as { type?: string }).type || '') === 'WITHDRAW'
            ? fund.currentBalance - amount
            : fund.currentBalance + amount,
        transactionDate: `${String((body as { transactionDate?: string }).transactionDate || '2026-04-11')}T00:00:00.000Z`,
        description: String((body as { description?: string }).description || ''),
        reference: String((body as { reference?: string }).reference || ''),
        performedByName: 'Director Demo',
        createdAt: '2026-04-11T09:30:00.000Z',
      };
      fund.currentBalance = created.balanceAfter;
      if (created.type === 'WITHDRAW') {
        fund.totalWithdrawn += amount;
      } else {
        fund.totalDeposited += amount;
      }
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
}

test.use({ video: 'on' });
test.describe.configure({ mode: 'serial', timeout: 180_000 });

test('B08 financial-control create flows keep bank, bank-transaction, fund, and fund-transaction state consistent', async ({
  browser,
  request,
}) => {
  test.slow();

  const directorSession = await loginAsRole(request, 'director');
  const state: State = {
    bankAccounts: [
      {
        _id: 'bank-seed-001',
        accountCode: 'BA-SEED-001',
        bankName: 'Seed Bank',
        accountNumber: '00112233',
        accountHolder: 'Seed Finance',
        branch: 'District 1',
        currentBalance: 3200000,
        openingBalance: 3200000,
        status: 'ACTIVE',
        description: 'Seed account',
        isPrimary: false,
        createdByName: 'Director Demo',
        createdAt: '2026-04-10T08:00:00.000Z',
      },
    ],
    bankTransactions: [],
    funds: [
      {
        _id: 'fund-seed-001',
        fundCode: 'F-SEED-001',
        name: 'Seed Reserve',
        fundType: 'RESERVE',
        currentBalance: 1200000,
        minimumBalance: 500000,
        targetBalance: 1500000,
        status: 'ACTIVE',
        description: 'Seed fund',
        totalDeposited: 1200000,
        totalWithdrawn: 0,
        createdByName: 'Director Demo',
        createdAt: '2026-04-10T08:00:00.000Z',
      },
    ],
    fundTransactions: [],
    createdBankBodies: [],
    createdBankTxBodies: [],
    createdFundBodies: [],
    createdFundTxBodies: [],
  };

  const expectedBankBody = {
    bankName: 'ACB',
    accountNumber: '9876543210',
    accountHolder: 'Truong Hoc Demo',
    branch: 'Chi nhanh Q1',
    openingBalance: 6500000,
    description: 'Tai khoan thu hoc phi online',
    isPrimary: true,
  };

  const expectedBankTxBody = {
    bankAccountId: 'bank-created-001',
    type: 'DEPOSIT',
    category: 'TUITION_INCOME',
    amount: 1250000,
    transactionDate: '2026-04-11',
    description: 'Thu hoc phi dot 1',
    reference: 'INV-B08-001',
  };

  const expectedFundBody = {
    name: 'Quy Marketing Q2',
    fundType: 'MARKETING',
    currentBalance: 3000000,
    minimumBalance: 1000000,
    targetBalance: 5000000,
    description: 'Du phong ads Q2',
  };

  const expectedFundTxBody = {
    fundId: 'fund-created-001',
    type: 'WITHDRAW',
    amount: 450000,
    transactionDate: '2026-04-11',
    description: 'Rut quy chay ads cohort',
    reference: 'ADS-B08-001',
  };

  const batch = await createBatchEvidenceContext(browser, {
    batchId: 'B08',
    scenario: 'financial_control_create_browser',
    runDate: RUN_DATE,
  });

  try {
    await installRoutes(batch.page, state);
    await openFinancialControl(batch.page, directorSession);

    await clickBankTab(batch.page);
    await batch.page.getByRole('button', { name: /\+ Th[eê]m TK ng[aâ]n h[aà]ng/i }).click();
    const bankModal = batch.page.locator('.modal').first();
    await bankModal.locator('input[name="bankName"]').fill(expectedBankBody.bankName);
    await bankModal.locator('input[name="accountNumber"]').fill(expectedBankBody.accountNumber);
    await bankModal.locator('input[name="accountHolder"]').fill(expectedBankBody.accountHolder);
    await bankModal.locator('input[name="branch"]').fill(expectedBankBody.branch);
    await bankModal.locator('input[name="openingBalance"]').fill(String(expectedBankBody.openingBalance));
    await bankModal.locator('textarea[name="description"]').fill(expectedBankBody.description);
    await bankModal.locator('input[name="isPrimary"]').check();
    await bankModal.locator('button[type="submit"]').click();

    await expect.poll(() => state.createdBankBodies.length).toBe(1);
    expect(state.createdBankBodies[0]).toEqual(expectedBankBody);

    const createdBankCard = batch.page.locator('.bank-card').filter({ hasText: expectedBankBody.bankName }).first();
    await expect(createdBankCard).toBeVisible();
    await expect(createdBankCard).toContainText(expectedBankBody.accountNumber);
    await expect(createdBankCard).toContainText(formatAmount(expectedBankBody.openingBalance));
    await batch.step('bank-account-created');

    await createdBankCard.click();
    await batch.page.getByRole('button', { name: /\+ Ghi nh[aậ]n giao d[iị]ch/i }).click();
    const bankTxModal = batch.page.locator('.modal').first();
    await bankTxModal.locator('select[name="bankAccountId"]').selectOption(expectedBankTxBody.bankAccountId);
    await bankTxModal.locator('select[name="type"]').selectOption(expectedBankTxBody.type);
    await bankTxModal.locator('select[name="category"]').selectOption(expectedBankTxBody.category);
    await bankTxModal.locator('input[name="amount"]').fill(String(expectedBankTxBody.amount));
    await bankTxModal.locator('input[name="transactionDate"]').fill(expectedBankTxBody.transactionDate);
    await bankTxModal.locator('textarea[name="description"]').fill(expectedBankTxBody.description);
    await bankTxModal.locator('input[name="reference"]').fill(expectedBankTxBody.reference);
    await bankTxModal.locator('button[type="submit"]').click();

    await expect.poll(() => state.createdBankTxBodies.length).toBe(1);
    expect(state.createdBankTxBodies[0]).toEqual(expectedBankTxBody);

    const bankTxRow = batch.page.locator('table.data tbody tr').filter({ hasText: 'BTX-CREATED-001' }).first();
    await expect(bankTxRow).toBeVisible();
    await expect(bankTxRow).toContainText(expectedBankTxBody.description);
    await expect(bankTxRow).toContainText(formatAmount(expectedBankTxBody.amount));
    await expect(createdBankCard).toContainText(formatAmount(expectedBankBody.openingBalance + expectedBankTxBody.amount));
    await batch.step('bank-transaction-recorded');

    await clickFundsTab(batch.page);
    await batch.page.getByRole('button', { name: /\+ T[aạ]o qu[yỹ] m[oớ]i/i }).click();
    const fundModal = batch.page.locator('.modal').first();
    await fundModal.locator('input[name="name"]').fill(expectedFundBody.name);
    await fundModal.locator('select[name="fundType"]').selectOption(expectedFundBody.fundType);
    await fundModal.locator('input[name="currentBalance"]').fill(String(expectedFundBody.currentBalance));
    await fundModal.locator('input[name="minimumBalance"]').fill(String(expectedFundBody.minimumBalance));
    await fundModal.locator('input[name="targetBalance"]').fill(String(expectedFundBody.targetBalance));
    await fundModal.locator('textarea[name="description"]').fill(expectedFundBody.description);
    await fundModal.locator('button[type="submit"]').click();

    await expect.poll(() => state.createdFundBodies.length).toBe(1);
    expect(state.createdFundBodies[0]).toEqual(expectedFundBody);

    const createdFundCard = batch.page.locator('.fund-card').filter({ hasText: expectedFundBody.name }).first();
    await expect(createdFundCard).toBeVisible();
    await expect(createdFundCard).toContainText('F-CREATED-001');
    await expect(createdFundCard).toContainText(formatAmount(expectedFundBody.currentBalance));
    await batch.step('fund-created');

    await createdFundCard.click();
    await batch.page.getByRole('button', { name: /\+ N[aạ]p\/R[uú]t qu[yỹ]/i }).click();
    const fundTxModal = batch.page.locator('.modal').first();
    await fundTxModal.locator('select[name="type"]').selectOption(expectedFundTxBody.type);
    await fundTxModal.locator('input[name="amount"]').fill(String(expectedFundTxBody.amount));
    await fundTxModal.locator('input[name="transactionDate"]').fill(expectedFundTxBody.transactionDate);
    await fundTxModal.locator('textarea[name="description"]').fill(expectedFundTxBody.description);
    await fundTxModal.locator('input[name="reference"]').fill(expectedFundTxBody.reference);
    await fundTxModal.locator('button[type="submit"]').click();

    await expect.poll(() => state.createdFundTxBodies.length).toBe(1);
    expect(state.createdFundTxBodies[0]).toEqual(expectedFundTxBody);

    const fundTxRow = batch.page.locator('table.data tbody tr').filter({ hasText: 'FTX-CREATED-001' }).first();
    await expect(fundTxRow).toBeVisible();
    await expect(fundTxRow).toContainText(expectedFundTxBody.description);
    await expect(fundTxRow).toContainText(formatAmount(expectedFundTxBody.amount));
    await expect(createdFundCard).toContainText(formatAmount(expectedFundBody.currentBalance - expectedFundTxBody.amount));
    await batch.step('fund-transaction-recorded');

    await batch.finalize('PASS', {
      extraLines: [
        'Verified /app/financial-control creates a bank account with the exact POST body and re-renders the new account card after reload.',
        'Verified recording a bank transaction posts the exact payload, appends the new row, and updates the selected bank account balance.',
        'Verified creating a fund posts the exact payload and re-renders the new fund card with code and opening balance.',
        'Verified recording a fund transaction posts the exact payload, appends the new fund transaction row, and updates the selected fund balance.',
        'Edit bank-account and edit-fund actions remain outside this closure because the current financial-control UI does not expose edit controls on the live surface.',
      ],
    });
  } catch (error) {
    await batch.finalize('FAIL', { error });
    throw error;
  }
});
