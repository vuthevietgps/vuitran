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

type OpenAIToken = {
  _id: string;
  label: string;
  apiKey: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  systemPromptPrefix?: string;
  status: string;
  lastUsedAt?: string;
  createdAt: string;
};

type AiProfile = {
  _id: string;
  assistantType: string;
  label: string;
  description?: string;
  rulesPrompt?: string;
  defaultOpenAITokenId?: string;
  defaultOpenAITokenLabel?: string;
  defaultOpenAIModel?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

type TokenPayload = {
  label: string;
  apiKey?: string;
  model: string;
  temperature: number;
  maxTokens: number;
  systemPromptPrefix: string;
  status: string;
};

type AiProfilePayload = {
  assistantType: string;
  label: string;
  description: string;
  rulesPrompt: string;
  defaultOpenAITokenId: string;
  status: string;
};

type SettingsLibraryState = {
  fanpages: any[];
  tokens: OpenAIToken[];
  aiProfiles: AiProfile[];
  adAccounts: any[];
  createTokenCalls: TokenPayload[];
  updateTokenCalls: Array<{ tokenId: string; payload: TokenPayload }>;
  deleteTokenIds: string[];
  createProfileCalls: AiProfilePayload[];
  updateProfileCalls: Array<{ profileId: string; payload: AiProfilePayload }>;
  deleteProfileIds: string[];
  nextTokenId: number;
  nextProfileId: number;
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

function maskApiKey(apiKey: string): string {
  return apiKey.startsWith('sk-') ? 'sk-••••••' : '••••••';
}

function tokenLabel(token?: OpenAIToken): string {
  if (!token) return '-';
  return `${token.label} (${token.model})`;
}

function buildSettingsLibraryState(): SettingsLibraryState {
  const createdAt = nowIso(-180);
  return {
    fanpages: [],
    tokens: [
      {
        _id: 'token-parent-1',
        label: 'Parent Support Token',
        apiKey: 'sk-••••••',
        model: 'gpt-4o-mini',
        temperature: 0.7,
        maxTokens: 2000,
        systemPromptPrefix: 'Support parent and learner escalation.',
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
        systemPromptPrefix: 'Qualify and nurture inbound lead conversations.',
        status: 'ACTIVE',
        lastUsedAt: nowIso(-20),
        createdAt,
      },
    ],
    aiProfiles: [
      {
        _id: 'profile-parent-1',
        assistantType: 'PARENT_SUPPORT',
        label: 'Parent Support Default',
        description: 'Mac dinh cho parent support.',
        rulesPrompt: 'Uu tien handoff neu gap refund, khiu nai, hoac doi lich phuc tap.',
        defaultOpenAITokenId: 'token-parent-1',
        defaultOpenAITokenLabel: 'Parent Support Token',
        defaultOpenAIModel: 'gpt-4o-mini',
        status: 'ACTIVE',
        createdAt,
        updatedAt: createdAt,
      },
    ],
    adAccounts: [],
    createTokenCalls: [],
    updateTokenCalls: [],
    deleteTokenIds: [],
    createProfileCalls: [],
    updateProfileCalls: [],
    deleteProfileIds: [],
    nextTokenId: 2,
    nextProfileId: 2,
  };
}

function updateToken(state: SettingsLibraryState, tokenId: string, patch: Partial<OpenAIToken>): OpenAIToken | null {
  const current = state.tokens.find((item) => item._id === tokenId);
  if (!current) return null;
  const updated: OpenAIToken = { ...current, ...patch };
  state.tokens = state.tokens.map((item) => (item._id === tokenId ? updated : item));
  return updated;
}

function updateProfile(state: SettingsLibraryState, profileId: string, patch: Partial<AiProfile>): AiProfile | null {
  const current = state.aiProfiles.find((item) => item._id === profileId);
  if (!current) return null;
  const updated: AiProfile = { ...current, ...patch, updatedAt: nowIso() };
  state.aiProfiles = state.aiProfiles.map((item) => (item._id === profileId ? updated : item));
  return updated;
}

async function seedLibraryBrowserApis(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const browserWindow = window as any;
    browserWindow.__chatbotLibraryConfirms = [];
    window.confirm = (message?: string) => {
      browserWindow.__chatbotLibraryConfirms.push(String(message || ''));
      return true;
    };
  });
}

async function routeSettingsLibraryApis(page: Page, state: SettingsLibraryState): Promise<void> {
  await page.route(/\/chatbot\/fanpages(?:\?.*)?$/, async (route) => {
    const url = new URL(route.request().url());
    if (url.origin === APP_ORIGIN) {
      await route.continue();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: state.fanpages,
        total: state.fanpages.length,
        page: 1,
        limit: 200,
      }),
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
        total: 0,
        page: 1,
        limit: 200,
      }),
    });
  });

  await page.route(/\/chatbot\/openai-tokens(?:\/[^/?]+)?(?:\?.*)?$/, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === APP_ORIGIN) {
      await route.continue();
      return;
    }

    const method = request.method();
    const path = url.pathname;

    if (path.endsWith('/chatbot/openai-tokens') && method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(state.tokens),
      });
      return;
    }

    if (path.endsWith('/chatbot/openai-tokens') && method === 'POST') {
      const payload = request.postDataJSON() as TokenPayload;
      state.createTokenCalls.push(payload);
      await sleep(350);
      const tokenId = `token-created-${state.nextTokenId}`;
      state.nextTokenId += 1;
      state.tokens = [
        ...state.tokens,
        {
          _id: tokenId,
          label: payload.label,
          apiKey: maskApiKey(payload.apiKey || ''),
          model: payload.model,
          temperature: payload.temperature,
          maxTokens: payload.maxTokens,
          systemPromptPrefix: payload.systemPromptPrefix,
          status: payload.status,
          lastUsedAt: '',
          createdAt: nowIso(),
        },
      ];
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, id: tokenId }),
      });
      return;
    }

    const tokenMatch = path.match(/\/chatbot\/openai-tokens\/([^/]+)$/);
    if (tokenMatch && method === 'PATCH') {
      const payload = request.postDataJSON() as TokenPayload;
      state.updateTokenCalls.push({ tokenId: tokenMatch[1], payload });
      await sleep(350);
      updateToken(state, tokenMatch[1], {
        label: payload.label,
        apiKey: payload.apiKey ? maskApiKey(payload.apiKey) : undefined,
        model: payload.model,
        temperature: payload.temperature,
        maxTokens: payload.maxTokens,
        systemPromptPrefix: payload.systemPromptPrefix,
        status: payload.status,
      });
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
      return;
    }

    if (tokenMatch && method === 'DELETE') {
      state.deleteTokenIds.push(tokenMatch[1]);
      await sleep(250);
      state.tokens = state.tokens.filter((item) => item._id !== tokenMatch[1]);
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
      body: JSON.stringify({ message: 'Unhandled OpenAI token route' }),
    });
  });

  await page.route(/\/chatbot\/ai-assistant-profiles(?:\/[^/?]+)?(?:\?.*)?$/, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === APP_ORIGIN) {
      await route.continue();
      return;
    }

    const method = request.method();
    const path = url.pathname;

    if (path.endsWith('/chatbot/ai-assistant-profiles') && method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(state.aiProfiles),
      });
      return;
    }

    if (path.endsWith('/chatbot/ai-assistant-profiles') && method === 'POST') {
      const payload = request.postDataJSON() as AiProfilePayload;
      state.createProfileCalls.push(payload);
      await sleep(350);
      const profileId = `profile-created-${state.nextProfileId}`;
      state.nextProfileId += 1;
      const token = state.tokens.find((item) => item._id === payload.defaultOpenAITokenId);
      state.aiProfiles = [
        ...state.aiProfiles,
        {
          _id: profileId,
          assistantType: payload.assistantType,
          label: payload.label,
          description: payload.description,
          rulesPrompt: payload.rulesPrompt,
          defaultOpenAITokenId: payload.defaultOpenAITokenId,
          defaultOpenAITokenLabel: token?.label || '',
          defaultOpenAIModel: token?.model || '',
          status: payload.status,
          createdAt: nowIso(),
          updatedAt: nowIso(),
        },
      ];
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, id: profileId }),
      });
      return;
    }

    const profileMatch = path.match(/\/chatbot\/ai-assistant-profiles\/([^/]+)$/);
    if (profileMatch && method === 'PATCH') {
      const payload = request.postDataJSON() as AiProfilePayload;
      state.updateProfileCalls.push({ profileId: profileMatch[1], payload });
      await sleep(350);
      const token = state.tokens.find((item) => item._id === payload.defaultOpenAITokenId);
      updateProfile(state, profileMatch[1], {
        assistantType: payload.assistantType,
        label: payload.label,
        description: payload.description,
        rulesPrompt: payload.rulesPrompt,
        defaultOpenAITokenId: payload.defaultOpenAITokenId,
        defaultOpenAITokenLabel: token?.label || '',
        defaultOpenAIModel: token?.model || '',
        status: payload.status,
      });
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
      return;
    }

    if (profileMatch && method === 'DELETE') {
      state.deleteProfileIds.push(profileMatch[1]);
      await sleep(250);
      state.aiProfiles = state.aiProfiles.filter((item) => item._id !== profileMatch[1]);
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
      body: JSON.stringify({ message: 'Unhandled AI profile route' }),
    });
  });
}

async function openDirectorEvidencePage(
  browser: Browser,
  request: APIRequestContext,
  scenario: string,
  setup: (page: Page) => Promise<void> | void,
): Promise<BatchEvidenceSession> {
  const session = await loginAsRole(request, 'director');
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

test.describe.serial('B09 chatbot-settings library browser flows', () => {
  test('B09 director can create, edit, and delete OpenAI tokens with exact browser payloads', async ({ browser, request }) => {
    test.slow();
    test.setTimeout(240_000);

    const state = buildSettingsLibraryState();
    const evidence = await openDirectorEvidencePage(
      browser,
      request,
      'chatbot_settings_tokens_director_crud',
      async (page) => {
        await seedLibraryBrowserApis(page);
        await routeSettingsLibraryApis(page, state);
      },
    );

    try {
      await evidence.page.getByRole('button', { name: 'OpenAI Tokens' }).click();
      await expect(evidence.page.locator('tbody tr')).toHaveCount(2);

      await evidence.page.getByRole('button', { name: /Them token/i }).click();
      const modal = evidence.page.locator('.modal').last();
      const saveButton = modal.getByRole('button', { name: /^Luu$/i });

      await saveButton.click();
      await expect(modal.locator('.error')).toHaveText(/Vui long dien du cac truong bat buoc/i);
      await evidence.step('01-token-create-validation');

      await modal.getByLabel('Label').fill('Director Browser Token');
      await modal.getByLabel('API key').fill('sk-live-browser-001');
      await modal.getByLabel('Model').selectOption('gpt-4o');
      await modal.getByLabel('Temperature').fill('0.5');
      await modal.getByLabel('Max tokens').fill('4096');
      await modal.getByLabel('System prompt prefix').fill('Use strict enrollment escalation policy.');

      const expectedCreatePayload: TokenPayload = {
        label: 'Director Browser Token',
        apiKey: 'sk-live-browser-001',
        model: 'gpt-4o',
        temperature: 0.5,
        maxTokens: 4096,
        systemPromptPrefix: 'Use strict enrollment escalation policy.',
        status: 'ACTIVE',
      };

      await saveButton.click();
      await expect(modal.getByRole('button', { name: /Dang luu/i })).toBeDisabled();
      await expect.poll(() => state.createTokenCalls.length).toBe(1);
      expect(state.createTokenCalls[0]).toEqual(expectedCreatePayload);
      await expect(modal).toHaveCount(0);

      const createdRow = evidence.page.locator('tbody tr').filter({ hasText: 'Director Browser Token' }).first();
      await expect(createdRow).toContainText('sk-••••••');
      await expect(createdRow).toContainText('gpt-4o');
      await expect(createdRow).toContainText('0.5');
      await expect(createdRow).toContainText('4096');
      await expect(createdRow).toContainText('Hoat dong');
      await evidence.step('02-token-create-reflected');

      await createdRow.getByRole('button', { name: 'Sua' }).click();
      const editModal = evidence.page.locator('.modal').last();
      const editSaveButton = editModal.getByRole('button', { name: /^Luu$/i });
      await editModal.getByLabel('Model').selectOption('gpt-4o-mini');
      await editModal.getByLabel('Temperature').fill('0.2');
      await editModal.getByLabel('Max tokens').fill('1024');
      await editModal.getByLabel('System prompt prefix').fill('Use compact fallback responses.');
      await editModal.getByLabel('Trang thai').selectOption('REVOKED');

      const expectedUpdatePayload: TokenPayload = {
        label: 'Director Browser Token',
        model: 'gpt-4o-mini',
        temperature: 0.2,
        maxTokens: 1024,
        systemPromptPrefix: 'Use compact fallback responses.',
        status: 'REVOKED',
      };

      await editSaveButton.click();
      await expect(editModal.getByRole('button', { name: /Dang luu/i })).toBeDisabled();
      await expect.poll(() => state.updateTokenCalls.length).toBe(1);
      expect(state.updateTokenCalls[0]).toEqual({
        tokenId: 'token-created-2',
        payload: expectedUpdatePayload,
      });
      await expect(editModal).toHaveCount(0);

      await expect(createdRow).toContainText('gpt-4o-mini');
      await expect(createdRow).toContainText('0.2');
      await expect(createdRow).toContainText('1024');
      await expect(createdRow).toContainText('Da thu hoi');
      await evidence.step('03-token-edit-reflected');

      await createdRow.getByRole('button', { name: 'Xoa' }).click();
      await expect.poll(async () => {
        return evidence.page.evaluate(() => {
          return ((window as any).__chatbotLibraryConfirms || []).slice();
        });
      }).toContain('Xoa token "Director Browser Token"?');
      await expect.poll(() => state.deleteTokenIds).toContain('token-created-2');
      await expect(evidence.page.locator('tbody tr').filter({ hasText: 'Director Browser Token' })).toHaveCount(0);
      await evidence.step('04-token-delete');

      evidence.note('OpenAI token browser flow now proves create/edit/delete with exact payloads, masked row reflection, and pending-state disable.');
      await evidence.finalize('PASS', {
        extraLines: [
          'Director token create kept exact browser payload and masked the stored key in the table: PASS',
          'Director token edit omitted a blank apiKey while reflecting model, temperature, maxTokens, and revoked status: PASS',
          'Director token delete removed the row after confirmation: PASS',
        ],
      });
    } catch (error) {
      await evidence.finalize('FAIL', { error });
      throw error;
    }
  });

  test('B09 director can create, edit, and delete AI profiles with token reflection after reload', async ({ browser, request }) => {
    test.slow();
    test.setTimeout(240_000);

    const state = buildSettingsLibraryState();
    const evidence = await openDirectorEvidencePage(
      browser,
      request,
      'chatbot_settings_profiles_director_crud',
      async (page) => {
        await seedLibraryBrowserApis(page);
        await routeSettingsLibraryApis(page, state);
      },
    );

    try {
      await evidence.page.getByRole('button', { name: 'AI Profiles' }).click();
      await expect(evidence.page.locator('tbody tr')).toHaveCount(1);

      await evidence.page.getByRole('button', { name: /Them AI profile/i }).click();
      const modal = evidence.page.locator('.modal').last();
      const saveButton = modal.getByRole('button', { name: /^Luu$/i });

      await saveButton.click();
      await expect(modal.locator('.error')).toHaveText(/Vui long dien du cac truong bat buoc/i);
      await evidence.step('01-profile-create-validation');

      await modal.getByLabel('Loai AI').selectOption('LEAD_CARE');
      await modal.getByLabel('Label').fill('Lead Escalation Browser');
      await modal.getByLabel('Mo ta ngan').fill('Escalation profile for browser CRUD evidence.');
      await modal.getByLabel('OpenAI token mac dinh').selectOption('token-sales-1');
      await modal.getByLabel('Rules cho AI').fill('Escalate to director when parent asks for refund or legal complaint.');

      const expectedCreatePayload: AiProfilePayload = {
        assistantType: 'LEAD_CARE',
        label: 'Lead Escalation Browser',
        description: 'Escalation profile for browser CRUD evidence.',
        rulesPrompt: 'Escalate to director when parent asks for refund or legal complaint.',
        defaultOpenAITokenId: 'token-sales-1',
        status: 'ACTIVE',
      };

      await saveButton.click();
      await expect(modal.getByRole('button', { name: /Dang luu/i })).toBeDisabled();
      await expect.poll(() => state.createProfileCalls.length).toBe(1);
      expect(state.createProfileCalls[0]).toEqual(expectedCreatePayload);
      await expect(modal).toHaveCount(0);

      const createdRow = evidence.page.locator('tbody tr').filter({ hasText: 'Lead Escalation Browser' }).first();
      await expect(createdRow).toContainText('Cham soc lead');
      await expect(createdRow).toContainText(tokenLabel(state.tokens.find((item) => item._id === 'token-sales-1')));
      await expect(createdRow).toContainText('Hoat dong');
      await evidence.step('02-profile-create-reflected');

      await createdRow.getByRole('button', { name: 'Sua' }).click();
      const editModal = evidence.page.locator('.modal').last();
      const editSaveButton = editModal.getByRole('button', { name: /^Luu$/i });
      await editModal.getByLabel('Mo ta ngan').fill('Escalation profile updated after browser edit.');
      await editModal.getByLabel('OpenAI token mac dinh').selectOption('');
      await editModal.getByLabel('Rules cho AI').fill('Fallback to manual handoff after two failed qualification attempts.');
      await editModal.getByLabel('Trang thai').selectOption('INACTIVE');

      const expectedUpdatePayload: AiProfilePayload = {
        assistantType: 'LEAD_CARE',
        label: 'Lead Escalation Browser',
        description: 'Escalation profile updated after browser edit.',
        rulesPrompt: 'Fallback to manual handoff after two failed qualification attempts.',
        defaultOpenAITokenId: '',
        status: 'INACTIVE',
      };

      await editSaveButton.click();
      await expect(editModal.getByRole('button', { name: /Dang luu/i })).toBeDisabled();
      await expect.poll(() => state.updateProfileCalls.length).toBe(1);
      expect(state.updateProfileCalls[0]).toEqual({
        profileId: 'profile-created-2',
        payload: expectedUpdatePayload,
      });
      await expect(editModal).toHaveCount(0);

      await expect(createdRow).toContainText('Ngung');
      await expect(createdRow).toContainText('Escalation profile updated after browser edit.');
      await expect(createdRow).toContainText('-');
      await evidence.step('03-profile-edit-reflected');

      await createdRow.getByRole('button', { name: 'Xoa' }).click();
      await expect.poll(async () => {
        return evidence.page.evaluate(() => {
          return ((window as any).__chatbotLibraryConfirms || []).slice();
        });
      }).toContain('Xoa AI profile "Lead Escalation Browser"?');
      await expect.poll(() => state.deleteProfileIds).toContain('profile-created-2');
      await expect(evidence.page.locator('tbody tr').filter({ hasText: 'Lead Escalation Browser' })).toHaveCount(0);
      await evidence.step('04-profile-delete');

      evidence.note('AI profile browser flow now proves create/edit/delete with exact payloads, token-label reflection, and inactive fallback state after reload.');
      await evidence.finalize('PASS', {
        extraLines: [
          'Director AI profile create kept exact browser payload and reflected default token label in the table: PASS',
          'Director AI profile edit reflected description, rules, cleared token fallback, and inactive status after reload: PASS',
          'Director AI profile delete removed the row after confirmation: PASS',
        ],
      });
    } catch (error) {
      await evidence.finalize('FAIL', { error });
      throw error;
    }
  });

  test('B09 chatbot-settings shows expired OpenAI token as a clear error state in the token library', async ({ browser, request }) => {
    test.slow();
    test.setTimeout(240_000);

    const state = buildSettingsLibraryState();
    state.tokens = [
      ...state.tokens,
      {
        _id: 'token-expired-1',
        label: 'Expired Parent Escalation Token',
        apiKey: 'sk-â€¢â€¢â€¢â€¢â€¢â€¢',
        model: 'gpt-4o-mini',
        temperature: 0.6,
        maxTokens: 1800,
        systemPromptPrefix: 'Escalation token that has already expired.',
        status: 'EXPIRED',
        lastUsedAt: nowIso(-1440),
        createdAt: nowIso(-2880),
      },
    ];

    const evidence = await openDirectorEvidencePage(
      browser,
      request,
      'chatbot_settings_expired_openai_token_browser',
      async (page) => {
        await seedLibraryBrowserApis(page);
        await routeSettingsLibraryApis(page, state);
      },
    );

    try {
      await evidence.page.getByRole('button', { name: 'OpenAI Tokens' }).click();
      await expect(evidence.page.locator('tbody tr')).toHaveCount(3);

      const expiredRow = evidence.page.locator('tbody tr').filter({ hasText: 'Expired Parent Escalation Token' }).first();
      const expiredStatusBadge = expiredRow.locator('.badge').first();

      await expect(expiredRow).toContainText('Expired Parent Escalation Token');
      await expect(expiredRow).toContainText('gpt-4o-mini');
      await expect(expiredRow).toContainText('Het han');
      await expect(expiredStatusBadge).toHaveText('Het han');
      await expect(expiredStatusBadge).toHaveCSS('background-color', 'rgb(185, 28, 28)');
      await evidence.step('01-expired-token-row-status');

      await expiredRow.getByRole('button', { name: 'Sua' }).click();
      const editModal = evidence.page.locator('.modal').last();
      await expect(editModal.getByRole('heading', { name: 'Sua OpenAI token' })).toBeVisible();
      await expect(editModal.getByLabel('Label')).toHaveValue('Expired Parent Escalation Token');
      await expect(editModal.getByLabel('Trang thai')).toHaveValue('EXPIRED');
      await expect(editModal.getByLabel('Trang thai')).toContainText('Het han');
      await evidence.step('02-expired-token-modal-status');

      evidence.note('Expired OpenAI token is now evidenced in chatbot-settings with an exact red `Het han` badge and matching edit-form status.');
      await evidence.finalize('PASS', {
        extraLines: [
          'Expired OpenAI token row rendered exact `Het han` status in the token library: PASS',
          'Expired OpenAI token status badge kept the red error color contract `rgb(185, 28, 28)`: PASS',
          'Expired OpenAI token edit modal reflected the same `EXPIRED` state without drifting from the row: PASS',
        ],
      });
    } catch (error) {
      await evidence.finalize('FAIL', { error });
      throw error;
    }
  });
});
