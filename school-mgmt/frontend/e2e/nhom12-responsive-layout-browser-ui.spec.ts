import { expect, test, type APIRequestContext, type Browser, type Page } from '@playwright/test';
import { applySessionCookies, createBatchEvidenceContext, loginAsRole, type BatchEvidenceSession } from './support';

const APP_BASE_URL =
  process.env['PLAYWRIGHT_BASE_URL']
  || process.env['E2E_BASE_URL']
  || 'http://localhost:4200';
const APP_ORIGIN = new URL(APP_BASE_URL).origin;
const RUN_DATE = process.env['UI_EVIDENCE_DATE'] || new Date().toISOString().slice(0, 10);

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

type ChatbotResponsiveState = {
  fanpages: any[];
  tokens: any[];
  profiles: any[];
  adAccounts: any[];
};

function buildChatbotResponsiveState(): ChatbotResponsiveState {
  return {
    fanpages: [
      {
        _id: 'fp-responsive-001',
        fanpageCode: 'FP-RESP-001',
        name: 'Responsive Parent Care',
        platform: 'FACEBOOK',
        pageId: 'page-responsive-001',
        description: 'Fanpage dung de khoa responsive layout browser-level.',
        syncSource: 'MANUAL',
        businessName: '',
        syncTokenLabel: '',
        lastSyncedAt: '2026-04-10T03:30:00.000Z',
        openaiTokenId: 'token-responsive-001',
        openaiTokenLabel: 'Responsive Token',
        openaiModel: 'gpt-4o-mini',
        status: 'ACTIVE',
        aiAutoReplyEnabled: true,
        createdAt: '2026-04-10T02:00:00.000Z',
        updatedAt: '2026-04-10T03:30:00.000Z',
      },
    ],
    tokens: [
      {
        _id: 'token-responsive-001',
        label: 'Responsive Token',
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
        _id: 'ad-responsive-001',
        accountCode: 'ACC-RESP-001',
        name: 'Responsive Ads Account',
        platform: 'FACEBOOK',
        platformAccountId: 'act-responsive-001',
        status: 'ACTIVE',
        createdAt: '2026-04-10T02:00:00.000Z',
        updatedAt: '2026-04-10T02:30:00.000Z',
      },
    ],
  };
}

async function openInternalEvidencePage(
  browser: Browser,
  request: APIRequestContext,
  scenario: string,
  path: string,
  viewport: { width: number; height: number },
  setup: (page: Page) => Promise<void> | void,
): Promise<BatchEvidenceSession> {
  const session = await loginAsRole(request, 'director');
  const evidence = await createBatchEvidenceContext(browser, {
    batchId: 'NHOM12',
    scenario,
    runDate: RUN_DATE,
  });
  await evidence.page.setViewportSize(viewport);
  await applySessionCookies(evidence.context, session);
  await setup(evidence.page);
  await evidence.page.goto(appUrl(path));
  await evidence.page.waitForLoadState('domcontentloaded');
  return evidence;
}

async function openPublicEvidencePage(
  browser: Browser,
  scenario: string,
  path: string,
  viewport: { width: number; height: number },
  setup: (page: Page) => Promise<void> | void,
): Promise<BatchEvidenceSession> {
  const evidence = await createBatchEvidenceContext(browser, {
    batchId: 'NHOM12',
    scenario,
    runDate: RUN_DATE,
  });
  await evidence.page.setViewportSize(viewport);
  await setup(evidence.page);
  await evidence.page.goto(appUrl(path));
  await evidence.page.waitForLoadState('domcontentloaded');
  return evidence;
}

async function routeChatbotResponsiveApis(page: Page, state: ChatbotResponsiveState): Promise<void> {
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

async function routeResponsiveLanding(page: Page): Promise<void> {
  await page.route(/\/public\/landing-pages\/e2e-responsive-layout(?:\?.*)?$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        _id: 'lp-responsive-001',
        name: 'Responsive Layout Landing',
        slug: 'e2e-responsive-layout',
        status: 'ACTIVE',
        heroTitle: 'Responsive Layout Landing',
        heroSubtitle: 'Khoa bo cuc desktop hep, tablet va mobile tren public landing.',
        formTitle: 'Nhan tu van hoc thu',
        formDescription: 'De lai thong tin de doi ngu lien he.',
        submitButtonText: 'Nhan tu van ngay',
        privacyNotice: 'Thong tin chi dung de tu van.',
        successTitle: 'Cam on phu huynh',
        successMessage: 'Chung toi se lien he som.',
      }),
    });
  });
}

test.describe('NHOM12 responsive browser coverage', () => {
  test('NHOM12 chatbot settings keeps toolbar and table usable on tablet viewport', async ({
    browser,
    request,
  }) => {
    const state = buildChatbotResponsiveState();
    const evidence = await openInternalEvidencePage(
      browser,
      request,
      'responsive_chatbot_settings_tablet_browser',
      '/app/chatbot-settings',
      { width: 820, height: 1180 },
      async (page) => {
        await routeChatbotResponsiveApis(page, state);
      },
    );

    try {
      const { page } = evidence;
      await expect(page.getByRole('button', { name: 'Fanpages' })).toBeVisible();
      await expect(page.getByRole('button', { name: '+ Them fanpage' })).toBeVisible();
      await expect(page.locator('table.data-table tbody tr').filter({ hasText: 'Responsive Parent Care' }).first()).toBeVisible();

      const layout = await page.evaluate(() => {
        const docEl = document.documentElement;
        const toolbar = document.querySelector('.toolbar') as HTMLElement | null;
        const filters = document.querySelector('.filters') as HTMLElement | null;
        const addButton = Array.from(document.querySelectorAll('button'))
          .find((button) => button.textContent?.includes('+ Them fanpage')) as HTMLElement | undefined;
        const table = document.querySelector('table.data-table') as HTMLElement | null;
        const toolbarStyle = toolbar ? window.getComputedStyle(toolbar) : null;
        const filtersRect = filters?.getBoundingClientRect() ?? null;
        const buttonRect = addButton?.getBoundingClientRect() ?? null;
        return {
          viewportWidth: window.innerWidth,
          documentScrollWidth: docEl.scrollWidth,
          toolbarFlexDirection: toolbarStyle?.flexDirection ?? '',
          filtersBottom: filtersRect?.bottom ?? 0,
          buttonTop: buttonRect?.top ?? 0,
          tableClientWidth: table?.clientWidth ?? 0,
          tableScrollWidth: table?.scrollWidth ?? 0,
        };
      });

      expect(layout.documentScrollWidth).toBeLessThanOrEqual(layout.viewportWidth + 1);
      expect(layout.toolbarFlexDirection).toBe('column');
      expect(layout.buttonTop).toBeGreaterThan(layout.filtersBottom);
      expect(layout.tableClientWidth).toBeGreaterThan(0);
      expect(layout.tableScrollWidth).toBeGreaterThanOrEqual(layout.tableClientWidth);

      await evidence.step('01-chatbot-settings-tablet-stable');

      await evidence.finalize('PASS', {
        extraLines: [
          'Scope: tablet viewport layout stability on chatbot settings.',
          `Viewport width: ${layout.viewportWidth}`,
          `Document scroll width: ${layout.documentScrollWidth}`,
          `Toolbar flex direction: ${layout.toolbarFlexDirection}`,
        ],
      });
    } catch (error) {
      await evidence.finalize('FAIL', { error });
      throw error;
    }
  });

  test('NHOM12 public landing keeps hero and lead form intact on narrow desktop viewport', async ({
    browser,
  }) => {
    const evidence = await openPublicEvidencePage(
      browser,
      'responsive_public_landing_narrow_desktop_browser',
      '/lp/e2e-responsive-layout',
      { width: 1024, height: 768 },
      async (page) => {
        await routeResponsiveLanding(page);
      },
    );

    try {
      const { page } = evidence;
      await expect(page.locator('.hero h1')).toContainText(/Responsive Layout Landing/i);
      await expect(page.locator('.form-card')).toBeVisible();
      await expect(page.getByRole('button', { name: /Nhan tu van ngay/i })).toBeVisible();

      const layout = await page.evaluate(() => {
        const docEl = document.documentElement;
        const hero = document.querySelector('.hero') as HTMLElement | null;
        const heroCopy = document.querySelector('.hero-copy') as HTMLElement | null;
        const formCard = document.querySelector('.form-card') as HTMLElement | null;
        const heroRect = hero?.getBoundingClientRect() ?? null;
        const heroCopyRect = heroCopy?.getBoundingClientRect() ?? null;
        const formCardRect = formCard?.getBoundingClientRect() ?? null;
        return {
          viewportWidth: window.innerWidth,
          documentScrollWidth: docEl.scrollWidth,
          heroWidth: heroRect?.width ?? 0,
          heroCopyX: heroCopyRect?.x ?? 0,
          heroCopyY: heroCopyRect?.y ?? 0,
          formCardX: formCardRect?.x ?? 0,
          formCardY: formCardRect?.y ?? 0,
        };
      });

      expect(layout.documentScrollWidth).toBeLessThanOrEqual(layout.viewportWidth + 1);
      expect(layout.heroWidth).toBeGreaterThan(0);
      expect(layout.formCardX).toBeGreaterThan(layout.heroCopyX + 40);
      expect(Math.abs(layout.formCardY - layout.heroCopyY)).toBeLessThan(80);

      await evidence.step('01-public-landing-narrow-desktop-stable');

      await evidence.finalize('PASS', {
        extraLines: [
          'Scope: narrow desktop viewport layout stability on public landing.',
          `Viewport width: ${layout.viewportWidth}`,
          `Document scroll width: ${layout.documentScrollWidth}`,
          'Hero copy and lead form stay side-by-side without horizontal overflow: PASS',
        ],
      });
    } catch (error) {
      await evidence.finalize('FAIL', { error });
      throw error;
    }
  });
});
