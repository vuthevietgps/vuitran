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

type Fanpage = {
  _id: string;
  fanpageCode: string;
  name: string;
  platform: string;
  pageId: string;
  description?: string;
  syncSource?: string;
  businessId?: string;
  businessName?: string;
  syncTokenLabel?: string;
  lastSyncedAt?: string;
  adAccountId?: string;
  openaiTokenId?: string;
  webhookVerifyToken?: string;
  status: string;
  aiAutoReplyEnabled: boolean;
  createdAt: string;
  updatedAt: string;
};

type OpenAIToken = {
  _id: string;
  label: string;
  apiKey: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  status: string;
  lastUsedAt?: string;
  createdAt: string;
};

type AdAccount = {
  _id: string;
  accountCode: string;
  name: string;
  platform: string;
  platformAccountId: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

type FanpagePayload = {
  name: string;
  platform: string;
  pageId: string;
  pageAccessToken?: string;
  description?: string;
  adAccountId?: string;
  openaiTokenId?: string;
  webhookVerifyToken?: string;
  appSecret?: string;
  aiAutoReplyEnabled: boolean;
  status: string;
};

type ChatbotSettingsState = {
  fanpages: Fanpage[];
  tokens: OpenAIToken[];
  aiProfiles: any[];
  adAccounts: AdAccount[];
  fanpageListRequests: string[];
  createFanpageCalls: FanpagePayload[];
  updateFanpageCalls: Array<{ fanpageId: string; payload: FanpagePayload }>;
  deleteFanpageIds: string[];
  confirmMessages: string[];
  nextFanpageId: number;
};

function appUrl(path: string): string {
  return new URL(path, APP_BASE_URL).toString();
}

function nowIso(offsetMinutes = 0): string {
  return new Date(Date.now() + (offsetMinutes * 60 * 1000)).toISOString();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildChatbotSettingsState(): ChatbotSettingsState {
  const createdAt = nowIso(-120);
  return {
    fanpages: [
      {
        _id: 'fp-manual-1',
        fanpageCode: 'FP-OPS-001',
        name: 'Ops Parent Care',
        platform: 'FACEBOOK',
        pageId: 'page-ops-parent',
        description: 'Ban dau dung cho parent care va hoc vien dang hoc.',
        syncSource: 'MANUAL',
        businessName: '',
        syncTokenLabel: '',
        lastSyncedAt: '',
        adAccountId: 'ad-facebook-1',
        openaiTokenId: 'token-parent-1',
        webhookVerifyToken: 'verify-ops-parent',
        status: 'ACTIVE',
        aiAutoReplyEnabled: true,
        createdAt,
        updatedAt: createdAt,
      },
      {
        _id: 'fp-synced-1',
        fanpageCode: 'FP-BM-001',
        name: 'BM Synced Enrollment',
        platform: 'FACEBOOK',
        pageId: 'page-bm-enrollment',
        description: 'Fanpage dong bo BM, chi sua chatbot settings va webhook.',
        syncSource: 'FACEBOOK_BM',
        businessId: 'bm-001',
        businessName: 'BM Alpha',
        syncTokenLabel: 'Facebook BM Token',
        lastSyncedAt: nowIso(-30),
        adAccountId: 'ad-facebook-1',
        openaiTokenId: 'token-sales-1',
        webhookVerifyToken: 'verify-bm-main',
        status: 'ACTIVE',
        aiAutoReplyEnabled: false,
        createdAt,
        updatedAt: createdAt,
      },
    ],
    tokens: [
      {
        _id: 'token-parent-1',
        label: 'Parent Support Token',
        apiKey: 'sk-••••••',
        model: 'gpt-4o-mini',
        temperature: 0.7,
        maxTokens: 2000,
        status: 'ACTIVE',
        lastUsedAt: nowIso(-60),
        createdAt,
      },
      {
        _id: 'token-sales-1',
        label: 'Lead Care Token',
        apiKey: 'sk-••••••',
        model: 'gpt-4o',
        temperature: 0.4,
        maxTokens: 3000,
        status: 'ACTIVE',
        lastUsedAt: nowIso(-15),
        createdAt,
      },
    ],
    aiProfiles: [],
    adAccounts: [
      {
        _id: 'ad-facebook-1',
        accountCode: 'ACC-001',
        name: 'Facebook Prospecting',
        platform: 'FACEBOOK',
        platformAccountId: 'act_001',
        status: 'ACTIVE',
        createdAt,
        updatedAt: createdAt,
      },
      {
        _id: 'ad-tiktok-1',
        accountCode: 'ACC-002',
        name: 'TikTok Retargeting',
        platform: 'TIKTOK',
        platformAccountId: 'tt_001',
        status: 'ACTIVE',
        createdAt,
        updatedAt: createdAt,
      },
    ],
    fanpageListRequests: [],
    createFanpageCalls: [],
    updateFanpageCalls: [],
    deleteFanpageIds: [],
    confirmMessages: [],
    nextFanpageId: 2,
  };
}

function tokenLabel(state: ChatbotSettingsState, fanpage: Fanpage): string {
  const token = state.tokens.find((item) => item._id === fanpage.openaiTokenId);
  if (!token) {
    return '-';
  }
  return `${token.label} (${token.model})`;
}

function sortFanpages(items: Fanpage[]): Fanpage[] {
  return [...items].sort((left, right) => left.fanpageCode.localeCompare(right.fanpageCode));
}

function updateFanpage(state: ChatbotSettingsState, fanpageId: string, patch: Partial<Fanpage>): Fanpage | null {
  const current = state.fanpages.find((item) => item._id === fanpageId);
  if (!current) {
    return null;
  }

  const updated: Fanpage = {
    ...current,
    ...patch,
    updatedAt: nowIso(),
  };
  state.fanpages = sortFanpages(
    state.fanpages.map((item) => (item._id === fanpageId ? updated : item)),
  );
  return updated;
}

function filterFanpages(state: ChatbotSettingsState, searchParams: URLSearchParams): Fanpage[] {
  const keyword = (searchParams.get('search') || '').trim().toLowerCase();
  const platform = searchParams.get('platform') || '';
  const status = searchParams.get('status') || '';

  let items = sortFanpages(state.fanpages);
  if (keyword) {
    items = items.filter((fanpage) => {
      return [
        fanpage.name,
        fanpage.fanpageCode,
        fanpage.pageId,
      ].some((value) => value.toLowerCase().includes(keyword));
    });
  }
  if (platform) {
    items = items.filter((fanpage) => fanpage.platform === platform);
  }
  if (status) {
    items = items.filter((fanpage) => fanpage.status === status);
  }
  return items;
}

async function seedChatbotSettingsBrowserApis(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const browserWindow = window as any;
    browserWindow.__chatbotSettingsConfirms = [];
    window.confirm = (message?: string) => {
      browserWindow.__chatbotSettingsConfirms.push(String(message || ''));
      return true;
    };
  });
}

async function routeChatbotSettingsApis(page: Page, state: ChatbotSettingsState): Promise<void> {
  await page.route(/\/chatbot\/fanpages(?:\/[^/?]+)?(?:\?.*)?$/, async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (url.origin === APP_ORIGIN) {
      await route.continue();
      return;
    }

    const method = request.method();
    const path = url.pathname;

    if (path.endsWith('/chatbot/fanpages') && method === 'GET') {
      state.fanpageListRequests.push(url.search);
      const data = filterFanpages(state, url.searchParams);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data,
          total: data.length,
          page: 1,
          limit: 200,
        }),
      });
      return;
    }

    if (path.endsWith('/chatbot/fanpages') && method === 'POST') {
      const payload = request.postDataJSON() as FanpagePayload;
      state.createFanpageCalls.push(payload);
      await sleep(350);

      const fanpageId = `fp-created-${state.nextFanpageId}`;
      state.nextFanpageId += 1;
      state.fanpages = sortFanpages([
        ...state.fanpages,
        {
          _id: fanpageId,
          fanpageCode: `FP-NEW-00${state.nextFanpageId}`,
          name: payload.name,
          platform: payload.platform,
          pageId: payload.pageId,
          description: payload.description || '',
          syncSource: 'MANUAL',
          businessName: '',
          syncTokenLabel: '',
          lastSyncedAt: '',
          adAccountId: payload.adAccountId || '',
          openaiTokenId: payload.openaiTokenId || '',
          webhookVerifyToken: payload.webhookVerifyToken || '',
          status: payload.status || 'ACTIVE',
          aiAutoReplyEnabled: payload.aiAutoReplyEnabled,
          createdAt: nowIso(),
          updatedAt: nowIso(),
        },
      ]);

      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, id: fanpageId }),
      });
      return;
    }

    const fanpageMatch = path.match(/\/chatbot\/fanpages\/([^/]+)$/);
    if (fanpageMatch && method === 'PATCH') {
      const payload = request.postDataJSON() as FanpagePayload;
      state.updateFanpageCalls.push({ fanpageId: fanpageMatch[1], payload });
      await sleep(350);
      updateFanpage(state, fanpageMatch[1], {
        name: payload.name,
        platform: payload.platform,
        pageId: payload.pageId,
        description: payload.description || '',
        adAccountId: payload.adAccountId || '',
        openaiTokenId: payload.openaiTokenId || '',
        webhookVerifyToken: payload.webhookVerifyToken || '',
        status: payload.status,
        aiAutoReplyEnabled: payload.aiAutoReplyEnabled,
      });
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
      return;
    }

    if (fanpageMatch && method === 'DELETE') {
      state.deleteFanpageIds.push(fanpageMatch[1]);
      await sleep(250);
      state.fanpages = state.fanpages.filter((item) => item._id !== fanpageMatch[1]);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
      return;
    }

    await route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Unhandled fanpage route' }),
    });
  });

  await page.route(/\/chatbot\/openai-tokens(?:\/[^/?]+)?(?:\?.*)?$/, async (route) => {
    const url = new URL(route.request().url());
    if (url.origin === APP_ORIGIN) {
      await route.continue();
      return;
    }

    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(state.tokens),
      });
      return;
    }

    await route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Unhandled token route' }),
    });
  });

  await page.route(/\/chatbot\/ai-assistant-profiles(?:\/[^/?]+)?(?:\?.*)?$/, async (route) => {
    const url = new URL(route.request().url());
    if (url.origin === APP_ORIGIN) {
      await route.continue();
      return;
    }

    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(state.aiProfiles),
      });
      return;
    }

    await route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Unhandled AI profile route' }),
    });
  });

  await page.route(/\/ads\/accounts(?:\?.*)?$/, async (route) => {
    const url = new URL(route.request().url());
    if (url.origin === APP_ORIGIN) {
      await route.continue();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: state.adAccounts,
        total: state.adAccounts.length,
        page: 1,
        limit: 200,
      }),
    });
  });
}

async function openRoleEvidencePage(
  browser: Browser,
  request: APIRequestContext,
  role: 'director' | 'ops',
  scenario: string,
  setup: (page: Page) => Promise<void> | void,
): Promise<BatchEvidenceSession> {
  const session = await loginAsRole(request, role);
  const evidence = await createBatchEvidenceContext(browser, {
    batchId: 'B09',
    scenario,
    runDate: RUN_DATE,
  });
  await applySessionCookies(evidence.context, session);
  await setup(evidence.page);
  await evidence.page.goto(appUrl('/app/chatbot-settings'));
  await evidence.page.waitForLoadState('domcontentloaded');
  return evidence;
}

test.describe.serial('B09 chatbot-settings browser flows', () => {
  test('B09 director can create and delete a manual fanpage with exact AI settings payload', async ({ browser, request }) => {
    test.slow();
    test.setTimeout(240_000);

    const state = buildChatbotSettingsState();
    const evidence = await openRoleEvidencePage(
      browser,
      request,
      'director',
      'chatbot_settings_fanpages_director_crud',
      async (page) => {
        await seedChatbotSettingsBrowserApis(page);
        await routeChatbotSettingsApis(page, state);
      },
    );

    try {
      await expect(evidence.page.getByRole('button', { name: /Them fanpage/i })).toBeVisible();
      await expect(evidence.page.getByRole('button', { name: 'OpenAI Tokens' })).toBeVisible();
      await expect(evidence.page.locator('tbody tr')).toHaveCount(2);

      await evidence.page.getByRole('button', { name: /Them fanpage/i }).click();
      const modal = evidence.page.locator('.modal').last();
      const saveButton = modal.getByRole('button', { name: /^Luu$/i });

      await saveButton.click();
      await expect(modal.locator('.error')).toHaveText(/Vui long dien du cac truong bat buoc/i);
      await evidence.step('01-create-validation');

      await modal.getByLabel('Ten fanpage').fill('Retention Pilot');
      await modal.getByLabel('Nen tang').selectOption('FACEBOOK');
      await modal.getByLabel('Page ID').fill('page-retention-001');
      await modal.getByLabel('Page access token').fill('page-access-manual-001');
      await modal.getByLabel('Mo ta fanpage').fill('Manual retention chatbot page for browser CRUD evidence.');
      await modal.getByLabel('Tai khoan quang cao lien ket').selectOption('ad-facebook-1');
      await modal.getByLabel('OpenAI token').selectOption('token-sales-1');
      await modal.getByLabel('Webhook verify token').fill('verify-retention-001');
      await modal.getByLabel('App secret').fill('app-secret-retention-001');
      await expect(modal.getByLabel('Bat AI tu dong tra loi')).toBeChecked();

      const expectedCreatePayload: FanpagePayload = {
        name: 'Retention Pilot',
        platform: 'FACEBOOK',
        pageId: 'page-retention-001',
        pageAccessToken: 'page-access-manual-001',
        description: 'Manual retention chatbot page for browser CRUD evidence.',
        adAccountId: 'ad-facebook-1',
        openaiTokenId: 'token-sales-1',
        webhookVerifyToken: 'verify-retention-001',
        appSecret: 'app-secret-retention-001',
        aiAutoReplyEnabled: true,
        status: 'ACTIVE',
      };

      await saveButton.click();
      await expect(modal.getByRole('button', { name: /Dang luu/i })).toBeDisabled();
      await expect.poll(() => state.createFanpageCalls.length).toBe(1);
      expect(state.createFanpageCalls[0]).toEqual(expectedCreatePayload);
      await expect(modal).toHaveCount(0);

      const createdRow = evidence.page.locator('tbody tr').filter({ hasText: 'Retention Pilot' }).first();
      await expect(createdRow).toContainText('Bat');
      await expect(createdRow).toContainText('Lead Care Token (gpt-4o)');
      await expect(createdRow).toContainText('Nhap tay');
      await evidence.step('02-create-reflected-in-list');

      const searchInput = evidence.page.locator('.filters input').first();
      const syncSourceSelect = evidence.page.locator('.filters select').nth(2);
      await searchInput.fill('Retention Pilot');
      await expect(createdRow).toBeVisible();
      await expect(evidence.page.locator('tbody tr')).toHaveCount(1);
      await evidence.step('03-search-created-fanpage');

      await searchInput.fill('');
      await syncSourceSelect.selectOption('MANUAL');
      await expect(evidence.page.locator('tbody tr')).toHaveCount(2);
      await evidence.step('04-filter-created-manual-fanpages');

      await syncSourceSelect.selectOption('');
      await createdRow.getByRole('button', { name: 'Xoa' }).click();
      await expect.poll(async () => {
        return evidence.page.evaluate(() => {
          return ((window as any).__chatbotSettingsConfirms || []).slice();
        });
      }).toContain('Xoa fanpage "Retention Pilot"?');
      await expect.poll(() => state.deleteFanpageIds).toContain('fp-created-2');
      await expect(evidence.page.locator('tbody tr').filter({ hasText: 'Retention Pilot' })).toHaveCount(0);
      await evidence.step('05-delete-created-fanpage');

      evidence.note('Director fanpage CRUD now proves validation, exact create payload, manual AI configuration reflection, and confirmed delete flow.');
      await evidence.finalize('PASS', {
        extraLines: [
          'Director fanpage create kept exact AI settings payload and disabled save during pending request: PASS',
          'Created manual fanpage reflected AI auto badge and OpenAI token label after reload: PASS',
          'Delete confirm removed the created fanpage cleanly from the list: PASS',
        ],
      });
    } catch (error) {
      await evidence.finalize('FAIL', { error });
      throw error;
    }
  });

  test('B09 ops can edit a fanpage and toggle AI auto reply without director-only controls', async ({ browser, request }) => {
    test.slow();
    test.setTimeout(240_000);

    const state = buildChatbotSettingsState();
    const evidence = await openRoleEvidencePage(
      browser,
      request,
      'ops',
      'chatbot_settings_fanpages_ops_edit',
      async (page) => {
        await seedChatbotSettingsBrowserApis(page);
        await routeChatbotSettingsApis(page, state);
      },
    );

    try {
      await expect(evidence.page.getByRole('button', { name: /Them fanpage/i })).toHaveCount(0);
      await expect(evidence.page.getByRole('button', { name: 'OpenAI Tokens' })).toHaveCount(0);
      await expect(evidence.page.locator('.helper-inline')).toContainText('Director tao san');

      const manualRow = evidence.page.locator('tbody tr').filter({ hasText: 'Ops Parent Care' }).first();
      await expect(manualRow.getByRole('button', { name: 'Sua' })).toBeVisible();
      await expect(manualRow.getByRole('button', { name: 'Xoa' })).toHaveCount(0);
      await expect(manualRow).toContainText('Bat');
      await expect(manualRow).toContainText('Hoat dong');

      await manualRow.getByRole('button', { name: 'Sua' }).click();
      const modal = evidence.page.locator('.modal').last();
      const saveButton = modal.getByRole('button', { name: /^Luu$/i });

      await modal.getByLabel('Mo ta fanpage').fill('Ops updated browser flow for AI toggle evidence.');
      await modal.getByLabel('OpenAI token').selectOption('token-sales-1');
      await modal.getByLabel('Webhook verify token').fill('verify-ops-browser-001');
      await modal.getByLabel('Bat AI tu dong tra loi').uncheck();
      await modal.getByLabel('Trang thai').selectOption('INACTIVE');

      const expectedUpdatePayload: FanpagePayload = {
        name: 'Ops Parent Care',
        platform: 'FACEBOOK',
        pageId: 'page-ops-parent',
        description: 'Ops updated browser flow for AI toggle evidence.',
        adAccountId: 'ad-facebook-1',
        openaiTokenId: 'token-sales-1',
        webhookVerifyToken: 'verify-ops-browser-001',
        aiAutoReplyEnabled: false,
        status: 'INACTIVE',
      };

      await saveButton.click();
      await expect(modal.getByRole('button', { name: /Dang luu/i })).toBeDisabled();
      await expect.poll(() => state.updateFanpageCalls.length).toBe(1);
      expect(state.updateFanpageCalls[0]).toEqual({
        fanpageId: 'fp-manual-1',
        payload: expectedUpdatePayload,
      });
      await expect(modal).toHaveCount(0);

      await expect(manualRow).toContainText('Tat');
      await expect(manualRow).toContainText('Ngung');
      await expect(manualRow).toContainText('Lead Care Token (gpt-4o)');
      await expect(manualRow).toContainText('Ops updated browser flow for AI toggle evidence.');
      await evidence.step('01-ops-edit-toggle-reflected');

      const statusFilter = evidence.page.locator('.filters select').nth(1);
      await statusFilter.selectOption('INACTIVE');
      await expect(evidence.page.locator('tbody tr')).toHaveCount(1);
      await expect(evidence.page.locator('tbody tr').first()).toContainText('Ops Parent Care');
      await evidence.step('02-ops-status-filter');

      evidence.note('Ops fanpage edit flow now proves edit-only role controls plus AI auto-reply toggle reflection without exposing director-only create/delete or token-library tabs.');
      await evidence.finalize('PASS', {
        extraLines: [
          'OPS saw edit controls but not director-only create/delete or token-library tabs: PASS',
          'OPS fanpage edit posted the exact toggle payload and reflected Bat/Tat plus Trang thai after reload: PASS',
        ],
      });
    } catch (error) {
      await evidence.finalize('FAIL', { error });
      throw error;
    }
  });
});
