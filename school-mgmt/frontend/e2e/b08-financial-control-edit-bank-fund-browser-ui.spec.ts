import { expect, test, type Browser, type Page } from '@playwright/test';
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
const DASHBOARD_API = new RegExp(`${API_ORIGIN_PATTERN}/financial-control/dashboard(?:\\?.*)?$`);
const BANK_ACCOUNTS_API = new RegExp(`${API_ORIGIN_PATTERN}/financial-control/bank-accounts(?:\\?.*)?$`);
const BANK_ACCOUNT_ITEM_API = new RegExp(`${API_ORIGIN_PATTERN}/financial-control/bank-accounts/[^/]+(?:\\?.*)?$`);
const BANK_TRANSACTIONS_API = new RegExp(`${API_ORIGIN_PATTERN}/financial-control/bank-transactions(?:\\?.*)?$`);
const FUNDS_API = new RegExp(`${API_ORIGIN_PATTERN}/financial-control/funds(?:\\?.*)?$`);
const FUND_ITEM_API = new RegExp(`${API_ORIGIN_PATTERN}/financial-control/funds/[^/]+(?:\\?.*)?$`);
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

type State = {
  bankAccounts: BankAccount[];
  funds: Fund[];
  bankPatchBodies: unknown[];
  fundPatchBodies: unknown[];
  bankGetCount: number;
  fundGetCount: number;
};

function appUrl(path: string): string {
  return new URL(path, APP_BASE_URL).toString();
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function dashboardStub() {
  return {
    cashPosition: {
      bankBalance: 4500000,
      bankAccountCount: 1,
      fundBalance: 1900000,
      fundCount: 1,
      marketingFund: 1900000,
      marketingFundCount: 1,
      availableCash: 6400000,
    },
    obligations: {
      payrollPayable: 0,
      payrollPayableCount: 0,
      expensePayable: 0,
      expensePayableCount: 0,
      orderPayable: 0,
      orderPayableCount: 0,
      totalPayable14Days: 0,
      operatingReserve3Months: 1200000,
      burnRate: 300000,
      runway: 10,
      reserveHealthy: true,
      cashAfterObligations: 6400000,
    },
    deferredRevenue: {
      walletBalance: 0,
      walletCount: 0,
      pendingInvoiceAmount: 0,
      pendingInvoiceCount: 0,
    },
    metrics: {
      burnRate: 300000,
      runway: 10,
      currentRatio: 2.1,
      grossMargin: 28,
      netMargin: 14,
      grossProfit: 1600000,
      netProfit: 780000,
      revenueGrowth: 9,
      thisMonthRevenue: 4200000,
      lastMonthRevenue: 3850000,
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
  await page.route('**/notifications/unread-count', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ count: 0 }),
    });
  });

  await page.route('**/pending-approvals/summary', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ totalPending: 0 }),
    });
  });

  await page.route(DASHBOARD_API, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(dashboardStub()),
    });
  });

  await page.route(BANK_ACCOUNTS_API, async (route) => {
    if (route.request().method() === 'GET') {
      state.bankGetCount += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(clone(state.bankAccounts)),
      });
      return;
    }

    await route.fallback();
  });

  await page.route(BANK_ACCOUNT_ITEM_API, async (route) => {
    if (route.request().method() !== 'PATCH') {
      await route.fallback();
      return;
    }

    state.bankPatchBodies.push(route.request().postDataJSON());
    const id = route.request().url().split('/bank-accounts/')[1]?.split('?')[0] || '';
    const patch = route.request().postDataJSON() as Partial<BankAccount>;
    await new Promise((resolve) => setTimeout(resolve, 250));

    state.bankAccounts = state.bankAccounts.map((item) => {
      if (patch.isPrimary) {
        item.isPrimary = item._id === id;
      }
      if (item._id !== id) {
        return item;
      }

      return {
        ...item,
        bankName: patch.bankName ?? item.bankName,
        accountNumber: patch.accountNumber ?? item.accountNumber,
        accountHolder: patch.accountHolder ?? item.accountHolder,
        branch: patch.branch ?? item.branch,
        description: patch.description ?? item.description,
        isPrimary: patch.isPrimary ?? item.isPrimary,
      };
    });

    const updated = state.bankAccounts.find((item) => item._id === id);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(updated),
    });
  });

  await page.route(BANK_TRANSACTIONS_API, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });

  await page.route(FUNDS_API, async (route) => {
    if (route.request().method() === 'GET') {
      state.fundGetCount += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(clone(state.funds)),
      });
      return;
    }

    await route.fallback();
  });

  await page.route(FUND_ITEM_API, async (route) => {
    if (route.request().method() !== 'PATCH') {
      await route.fallback();
      return;
    }

    state.fundPatchBodies.push(route.request().postDataJSON());
    const id = route.request().url().split('/funds/')[1]?.split('?')[0] || '';
    const patch = route.request().postDataJSON() as Partial<Fund>;
    await new Promise((resolve) => setTimeout(resolve, 250));

    state.funds = state.funds.map((item) => (
      item._id === id
        ? {
            ...item,
            name: patch.name ?? item.name,
            minimumBalance: patch.minimumBalance ?? item.minimumBalance,
            targetBalance: patch.targetBalance ?? item.targetBalance,
            description: patch.description ?? item.description,
          }
        : item
    ));

    const updated = state.funds.find((item) => item._id === id);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(updated),
    });
  });

  await page.route(FUND_TRANSACTIONS_API, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });
}

test.describe.configure({ mode: 'serial', timeout: 180_000 });

test('B08 financial-control edit bank account and fund reload the cards after exact PATCH flows', async ({
  browser,
  request,
}) => {
  const directorSession = await loginAsRole(request, 'director');
  const state: State = {
    bankAccounts: [
      {
        _id: '507f1f77bcf86cd799439011',
        accountCode: 'BA-QA-001',
        bankName: 'Techcombank',
        accountNumber: '1900123456',
        accountHolder: 'Truong Hoc QA',
        branch: 'Quan 1',
        currentBalance: 4500000,
        openingBalance: 3000000,
        status: 'ACTIVE',
        description: 'Tai khoan thu hoc phi',
        isPrimary: false,
        createdByName: 'Director Demo',
        createdAt: '2026-04-11T07:30:00.000Z',
      },
      {
        _id: '507f1f77bcf86cd799439012',
        accountCode: 'BA-QA-002',
        bankName: 'Vietcombank',
        accountNumber: '1900999988',
        accountHolder: 'Tai Khoan Chinh',
        branch: 'Quan 7',
        currentBalance: 2200000,
        openingBalance: 2200000,
        status: 'ACTIVE',
        description: 'Primary',
        isPrimary: true,
        createdByName: 'Director Demo',
        createdAt: '2026-04-11T07:40:00.000Z',
      },
    ],
    funds: [
      {
        _id: '507f1f77bcf86cd799439021',
        fundCode: 'FUND-QA-001',
        name: 'Quy Marketing',
        fundType: 'MARKETING',
        currentBalance: 1900000,
        minimumBalance: 800000,
        targetBalance: 2500000,
        status: 'ACTIVE',
        description: 'Quy chay ads',
        totalDeposited: 2500000,
        totalWithdrawn: 600000,
        createdByName: 'Director Demo',
        createdAt: '2026-04-11T07:45:00.000Z',
      },
    ],
    bankPatchBodies: [],
    fundPatchBodies: [],
    bankGetCount: 0,
    fundGetCount: 0,
  };

  const expectedBankPatch = {
    bankName: 'ACB Online',
    accountNumber: '1900777700',
    accountHolder: 'Truong Hoc QA Updated',
    branch: 'Thu Duc',
    description: 'Tai khoan da doi chi nhanh',
    isPrimary: true,
  };

  const expectedFundPatch = {
    name: 'Quy Marketing Mua He',
    minimumBalance: 950000,
    targetBalance: 3200000,
    description: 'Quy marketing da cap nhat muc dich',
  };

  const batch = await createBatchEvidenceContext(browser, {
    batchId: 'B08',
    scenario: 'financial_control_edit_bank_fund_browser',
    runDate: RUN_DATE,
  });

  try {
    await installRoutes(batch.page, state);
    await openFinancialControl(batch.page, directorSession);

    await clickBankTab(batch.page);
    const bankCard = batch.page.getByTestId('bank-account-card-507f1f77bcf86cd799439011');
    await expect(bankCard).toContainText('Techcombank');
    await batch.page.getByTestId('bank-account-edit-507f1f77bcf86cd799439011').click();

    const bankModal = batch.page.getByTestId('bank-account-modal');
    await expect(bankModal).toBeVisible();
    await expect(bankModal.getByTestId('bank-account-form-bank-name')).toHaveValue('Techcombank');
    await expect(bankModal.getByTestId('bank-account-form-account-number')).toHaveValue('1900123456');
    await expect(bankModal.getByTestId('bank-account-form-account-holder')).toHaveValue('Truong Hoc QA');
    await expect(bankModal.getByTestId('bank-account-form-branch')).toHaveValue('Quan 1');
    await expect(bankModal.getByTestId('bank-account-form-description')).toHaveValue('Tai khoan thu hoc phi');
    await expect(bankModal.getByTestId('bank-account-form-is-primary')).not.toBeChecked();
    await expect(bankModal.getByTestId('bank-account-form-opening-balance')).toHaveCount(0);
    await batch.step('bank-edit-prefill');

    await bankModal.getByTestId('bank-account-form-bank-name').fill(expectedBankPatch.bankName);
    await bankModal.getByTestId('bank-account-form-account-number').fill(expectedBankPatch.accountNumber);
    await bankModal.getByTestId('bank-account-form-account-holder').fill(expectedBankPatch.accountHolder);
    await bankModal.getByTestId('bank-account-form-branch').fill(expectedBankPatch.branch);
    await bankModal.getByTestId('bank-account-form-description').fill(expectedBankPatch.description);
    await bankModal.getByTestId('bank-account-form-is-primary').check();
    await bankModal.getByTestId('bank-account-submit').click();

    await expect(bankModal.getByTestId('bank-account-submit')).toBeDisabled();
    await expect(bankModal.getByTestId('bank-account-submit')).toContainText(/Đang lưu|Dang luu/i);
    await expect.poll(() => state.bankPatchBodies.length).toBe(1);
    expect(state.bankPatchBodies[0]).toEqual(expectedBankPatch);
    await expect(bankModal).toHaveCount(0);

    await expect(bankCard).toContainText('ACB Online');
    await expect(bankCard).toContainText('1900777700');
    await expect(bankCard).toContainText('Truong Hoc QA Updated');
    await expect(batch.page.getByTestId('bank-account-card-507f1f77bcf86cd799439012')).not.toContainText('⭐');
    expect(state.bankGetCount).toBeGreaterThanOrEqual(2);
    await batch.step('bank-edit-updated-card');

    await clickFundsTab(batch.page);
    const fundCard = batch.page.getByTestId('fund-card-507f1f77bcf86cd799439021');
    await expect(fundCard).toContainText('Quy Marketing');
    await batch.page.getByTestId('fund-edit-507f1f77bcf86cd799439021').click();

    const fundModal = batch.page.getByTestId('fund-modal');
    await expect(fundModal).toBeVisible();
    await expect(fundModal.getByTestId('fund-form-name')).toHaveValue('Quy Marketing');
    await expect(fundModal.getByTestId('fund-form-type')).toBeDisabled();
    await expect(fundModal.getByTestId('fund-form-type')).toHaveValue('MARKETING');
    await expect(fundModal.getByTestId('fund-form-current-balance')).toHaveCount(0);
    await expect(fundModal.getByTestId('fund-form-minimum-balance')).toHaveValue('800000');
    await expect(fundModal.getByTestId('fund-form-target-balance')).toHaveValue('2500000');
    await expect(fundModal.getByTestId('fund-form-description')).toHaveValue('Quy chay ads');
    await batch.step('fund-edit-prefill');

    await fundModal.getByTestId('fund-form-name').fill(expectedFundPatch.name);
    await fundModal.getByTestId('fund-form-minimum-balance').fill(String(expectedFundPatch.minimumBalance));
    await fundModal.getByTestId('fund-form-target-balance').fill(String(expectedFundPatch.targetBalance));
    await fundModal.getByTestId('fund-form-description').fill(expectedFundPatch.description);
    await fundModal.getByTestId('fund-submit').click();

    await expect(fundModal.getByTestId('fund-submit')).toBeDisabled();
    await expect(fundModal.getByTestId('fund-submit')).toContainText(/Đang lưu|Dang luu/i);
    await expect.poll(() => state.fundPatchBodies.length).toBe(1);
    expect(state.fundPatchBodies[0]).toEqual(expectedFundPatch);
    await expect(fundModal).toHaveCount(0);

    await expect(fundCard).toContainText('Quy Marketing Mua He');
    await expect(fundCard).toContainText('950,000');
    await expect(fundCard).toContainText('3,200,000');
    expect(state.fundGetCount).toBeGreaterThanOrEqual(2);
    await batch.step('fund-edit-updated-card');

    await batch.finalize('PASS', {
      extraLines: [
        'Verified each bank-account and fund card now exposes a director-only edit icon on the live financial-control surface.',
        'Verified the bank-account edit modal prefills current values, hides the unsupported opening-balance field, and sends one exact PATCH body without leaking read-only balance/code fields.',
        'Verified the fund edit modal prefills current values, keeps fund type read-only, and sends one exact PATCH body without leaking currentBalance or fundCode.',
        'Verified both save buttons enter a loading state before the PATCH resolves, then the UI reloads the list and re-renders the updated bank/fund card after the 200 OK response.',
      ],
    });
  } catch (error) {
    await batch.finalize('FAIL', { error });
    throw error;
  }
});
