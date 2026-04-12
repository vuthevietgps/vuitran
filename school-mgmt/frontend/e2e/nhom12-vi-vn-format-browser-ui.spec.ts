import { expect, test, type APIRequestContext, type Browser, type Page } from '@playwright/test';
import { applySessionCookies, createBatchEvidenceContext, loginAsRole, type BatchEvidenceSession } from './support';

const APP_BASE_URL =
  process.env['PLAYWRIGHT_BASE_URL']
  || process.env['E2E_BASE_URL']
  || 'http://localhost:4200';
const APP_ORIGIN = new URL(APP_BASE_URL).origin;
const RUN_DATE = process.env['UI_EVIDENCE_DATE'] || new Date().toISOString().slice(0, 10);

const WALLETS_API = /^https?:\/\/(?:localhost|127\.0\.0\.1):3000\/wallets(?:\?.*)?$/;
const WALLETS_LEDGER_API = /^https?:\/\/(?:localhost|127\.0\.0\.1):3000\/wallets\/ledger(?:\?.*)?$/;
const WALLETS_PENDING_API = /^https?:\/\/(?:localhost|127\.0\.0\.1):3000\/wallets\/top-up\/pending(?:\?.*)?$/;
const CHATBOT_FANPAGES_API = /^https?:\/\/(?:localhost|127\.0\.0\.1):3000\/chatbot\/fanpages(?:\?.*)?$/;
const CHATBOT_TOKENS_API = /^https?:\/\/(?:localhost|127\.0\.0\.1):3000\/chatbot\/openai-tokens(?:\?.*)?$/;
const CHATBOT_PROFILES_API = /^https?:\/\/(?:localhost|127\.0\.0\.1):3000\/chatbot\/ai-assistant-profiles(?:\?.*)?$/;
const ADS_ACCOUNTS_API = /^https?:\/\/(?:localhost|127\.0\.0\.1):3000\/ads\/accounts(?:\?.*)?$/;

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
  role: 'accounting' | 'director',
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

type WalletState = {
  walletsRequests: string[];
  ledgerRequests: string[];
  pendingRequests: string[];
  wallets: any[];
  ledger: any[];
};

function buildWalletState(): WalletState {
  return {
    walletsRequests: [],
    ledgerRequests: [],
    pendingRequests: [],
    wallets: [
      {
        _id: 'wallet-locale-001',
        userId: {
          _id: 'parent-locale-001',
          fullName: 'Phu huynh Dinh dang Vi VN',
          email: 'parent.locale.wallet@example.com',
          role: 'PARENT',
        },
        balance: 1234567,
        totalTopUp: 9876543,
        totalDeducted: 321000,
        totalRefunded: 0,
        status: 'ACTIVE',
      },
    ],
    ledger: [
      {
        _id: 'ledger-locale-topup',
        walletId: 'wallet-locale-001',
        userId: 'parent-locale-001',
        type: 'TOP_UP',
        status: 'APPROVED',
        amount: 1234567,
        balanceBefore: 0,
        balanceAfter: 1234567,
        description: 'Nap vi lan dau',
        createdAt: '2026-04-05T06:45:00.000Z',
      },
      {
        _id: 'ledger-locale-refund',
        walletId: 'wallet-locale-001',
        userId: 'parent-locale-001',
        type: 'REFUND',
        status: 'APPROVED',
        amount: 250000,
        balanceBefore: 1234567,
        balanceAfter: 1484567,
        description: 'Hoan tien mot phan',
        createdAt: '2026-04-06T02:05:00.000Z',
      },
    ],
  };
}

async function routeWalletApis(page: Page, state: WalletState): Promise<void> {
  await page.route(WALLETS_API, async (route) => {
    if (new URL(route.request().url()).origin === APP_ORIGIN) {
      await route.continue();
      return;
    }

    state.walletsRequests.push(route.request().url());
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: clone(state.wallets),
        meta: {
          page: 1,
          limit: 100,
          total: state.wallets.length,
        },
      }),
    });
  });

  await page.route(WALLETS_LEDGER_API, async (route) => {
    if (new URL(route.request().url()).origin === APP_ORIGIN) {
      await route.continue();
      return;
    }

    state.ledgerRequests.push(route.request().url());
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: clone(state.ledger),
        meta: {
          page: 1,
          limit: 50,
          total: state.ledger.length,
        },
      }),
    });
  });

  await page.route(WALLETS_PENDING_API, async (route) => {
    if (new URL(route.request().url()).origin === APP_ORIGIN) {
      await route.continue();
      return;
    }

    state.pendingRequests.push(route.request().url());
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });
}

type ChatbotLocaleState = {
  fanpages: any[];
  tokens: any[];
  profiles: any[];
  adAccounts: any[];
};

function buildChatbotLocaleState(): ChatbotLocaleState {
  return {
    fanpages: [
      {
        _id: 'fanpage-locale-001',
        fanpageCode: 'FP-LOCALE-001',
        name: 'Fanpage Locale',
        platform: 'FACEBOOK',
        pageId: 'page-locale-001',
        description: 'Dung de khoa date format vi-VN.',
        syncSource: 'MANUAL',
        businessName: 'Locale Business',
        syncTokenLabel: 'Locale Token',
        lastSyncedAt: '2026-04-10T03:30:00.000Z',
        openaiTokenId: 'token-locale-001',
        openaiTokenLabel: 'Locale Token',
        openaiModel: 'gpt-4o-mini',
        status: 'ACTIVE',
        aiAutoReplyEnabled: true,
        createdAt: '2026-04-10T02:00:00.000Z',
        updatedAt: '2026-04-10T03:30:00.000Z',
      },
    ],
    tokens: [
      {
        _id: 'token-locale-001',
        label: 'Locale Token',
        apiKey: 'sk-******',
        model: 'gpt-4o-mini',
        temperature: 0.7,
        maxTokens: 2000,
        status: 'ACTIVE',
        lastUsedAt: '2026-04-10T04:15:00.000Z',
        createdAt: '2026-04-10T02:00:00.000Z',
      },
    ],
    profiles: [],
    adAccounts: [
      {
        _id: 'ad-account-locale-001',
        accountCode: 'ACC-LOCALE-001',
        name: 'Ads Locale',
        platform: 'FACEBOOK',
        platformAccountId: 'act-locale-001',
        status: 'ACTIVE',
        createdAt: '2026-04-10T02:00:00.000Z',
        updatedAt: '2026-04-10T02:30:00.000Z',
      },
    ],
  };
}

async function routeChatbotLocaleApis(page: Page, state: ChatbotLocaleState): Promise<void> {
  await page.route(CHATBOT_FANPAGES_API, async (route) => {
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

  await page.route(CHATBOT_TOKENS_API, async (route) => {
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

  await page.route(CHATBOT_PROFILES_API, async (route) => {
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

  await page.route(ADS_ACCOUNTS_API, async (route) => {
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

test.describe('NHOM12 vi-VN format browser coverage', () => {
  test('NHOM12 wallets render vi-VN money grouping and day-first ledger timestamps consistently', async ({
    browser,
    request,
  }) => {
    const state = buildWalletState();
    const evidence = await openInternalEvidencePage(
      browser,
      request,
      'accounting',
      'vi_vn_format_wallets_browser',
      '/app/wallets',
      async (page) => {
        await routeWalletApis(page, state);
      },
    );

    try {
      const { page } = evidence;
      const walletRow = page.locator('table.data tbody tr').filter({ hasText: 'Phu huynh Dinh dang Vi VN' }).first();

      await expect(walletRow).toBeVisible();
      await expect(walletRow).toContainText('1.234.567 ₫');
      await expect(walletRow).toContainText('9.876.543 ₫');
      await expect(walletRow).toContainText('321.000 ₫');
      await expect(walletRow).not.toContainText('1,234,567');
      await expect(walletRow).not.toContainText('9,876,543');

      await evidence.step('wallets-vi-vn-list-format');

      await page.getByRole('button', { name: /Lịch sử giao dịch|Lich su giao dich/i }).click();
      const ledgerRow = page.locator('table.data tbody tr').filter({ hasText: 'Nap vi lan dau' }).first();
      const refundRow = page.locator('table.data tbody tr').filter({ hasText: 'Hoan tien mot phan' }).first();

      await expect(ledgerRow).toBeVisible();
      await expect(ledgerRow).toContainText('05/04/2026 13:45');
      await expect(ledgerRow).toContainText('+1.234.567 ₫');
      await expect(ledgerRow).toContainText('0 ₫');
      await expect(ledgerRow).toContainText('1.234.567 ₫');
      await expect(ledgerRow).not.toContainText('2026-04-05');
      await expect(ledgerRow).not.toContainText('4/5/2026');

      await expect(refundRow).toBeVisible();
      await expect(refundRow).toContainText('06/04/2026 09:05');
      await expect(refundRow).toContainText('+250.000 ₫');
      await expect(refundRow).toContainText('1.234.567 ₫');
      await expect(refundRow).toContainText('1.484.567 ₫');

      expect(state.walletsRequests.length).toBe(1);
      expect(state.pendingRequests.length).toBe(1);
      expect(state.ledgerRequests.length).toBe(1);

      await evidence.step('wallets-vi-vn-ledger-format');

      await evidence.finalize('PASS', {
        extraLines: [
          'Scope: Wallet list + ledger date/currency formatting on the real finance surface.',
          `Wallet requests: ${state.walletsRequests.length}`,
          `Pending top-up requests: ${state.pendingRequests.length}`,
          `Ledger requests: ${state.ledgerRequests.length}`,
        ],
      });
    } catch (error) {
      await evidence.finalize('FAIL', { error });
      throw error;
    }
  });

  test('NHOM12 chatbot settings render vi-VN locale timestamps instead of ISO or US-style dates', async ({
    browser,
    request,
  }) => {
    const state = buildChatbotLocaleState();
    const evidence = await openInternalEvidencePage(
      browser,
      request,
      'director',
      'vi_vn_format_chatbot_settings_browser',
      '/app/chatbot-settings',
      async (page) => {
        await routeChatbotLocaleApis(page, state);
      },
    );

    try {
      const { page } = evidence;
      const fanpageRow = page.locator('table.data-table tbody tr').filter({ hasText: 'Fanpage Locale' }).first();

      await expect(fanpageRow).toBeVisible();
      await expect(fanpageRow).toContainText('10:30:00 10/4/2026');
      await expect(fanpageRow).not.toContainText('2026-04-10T03:30:00.000Z');
      await expect(fanpageRow).not.toContainText('4/10/2026');
      await expect(fanpageRow).not.toContainText('AM');
      await expect(fanpageRow).not.toContainText('PM');

      await evidence.step('chatbot-vi-vn-fanpage-date-format');

      await page.getByRole('button', { name: 'OpenAI Tokens' }).click();
      const tokenRow = page.locator('table.data-table tbody tr').filter({ hasText: 'Locale Token' }).first();

      await expect(tokenRow).toBeVisible();
      await expect(tokenRow).toContainText('11:15:00 10/4/2026');
      await expect(tokenRow).not.toContainText('2026-04-10T04:15:00.000Z');
      await expect(tokenRow).not.toContainText('4/10/2026');

      await evidence.step('chatbot-vi-vn-token-date-format');

      await evidence.finalize('PASS', {
        extraLines: [
          'Scope: Chatbot settings last-synced / last-used timestamps on vi-VN locale surfaces.',
          'Verified the UI keeps vi-VN ordering and avoids ISO or US-style fallback strings.',
        ],
      });
    } catch (error) {
      await evidence.finalize('FAIL', { error });
      throw error;
    }
  });
});
