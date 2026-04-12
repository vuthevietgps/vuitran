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

function appUrl(path: string): string {
  return new URL(path, APP_BASE_URL).toString();
}

function nowIso(offsetMinutes = 0): string {
  return new Date(Date.now() + (offsetMinutes * 60 * 1000)).toISOString();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

type LandingState = {
  pages: any[];
  submissions: any[];
  groups: any[];
  nextId: number;
  createCalls: any[];
};

type ChatbotSettingsState = {
  fanpages: any[];
  tokens: any[];
  aiProfiles: any[];
  adAccounts: any[];
  createFanpageCalls: any[];
  nextFanpageId: number;
};

type TicketState = {
  ticket: any;
  actionRequests: string[];
  confirmMessages: string[];
};

async function openInternalEvidencePage(
  browser: Browser,
  request: APIRequestContext,
  role: 'director' | 'ops',
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

async function openPublicEvidencePage(
  browser: Browser,
  scenario: string,
  path: string,
  setup: (page: Page) => Promise<void> | void,
): Promise<BatchEvidenceSession> {
  const evidence = await createBatchEvidenceContext(browser, {
    batchId: 'NHOM12',
    scenario,
    runDate: RUN_DATE,
  });
  await setup(evidence.page);
  await evidence.page.goto(appUrl(path));
  await evidence.page.waitForLoadState('domcontentloaded');
  return evidence;
}

function field(modal: ReturnType<Page['locator']>, labelText: RegExp, selector = 'input,textarea,select') {
  return modal.locator('label').filter({ hasText: labelText }).locator(selector).first();
}

async function seedManagementBrowserApis(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const win = window as any;
    win.__alerts = [];
    win.__prompts = [];
    win.__confirms = [];
    win.__copiedTexts = [];
    win.__clipboardMode = 'success';

    window.alert = (message?: string) => {
      win.__alerts.push(String(message || ''));
    };
    window.prompt = (message?: string, defaultValue?: string) => {
      win.__prompts.push({
        message: String(message || ''),
        defaultValue: String(defaultValue || ''),
      });
      return defaultValue || '';
    };
    window.confirm = (message?: string) => {
      win.__confirms.push(String(message || ''));
      return true;
    };
  });
}

async function routeLandingManagementApis(page: Page, state: LandingState): Promise<void> {
  await page.route(/\/ads\/groups\/all(?:\?.*)?$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(state.groups),
    });
  });

  await page.route(/\/landing-pages(?:\/submissions|\/[^?/]*)?(?:\?.*)?$/, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    const path = url.pathname;

    if (url.origin === APP_ORIGIN) {
      await route.continue();
      return;
    }

    if (path.endsWith('/landing-pages/submissions') && method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(state.submissions),
      });
      return;
    }

    if (path.endsWith('/landing-pages') && method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(state.pages),
      });
      return;
    }

    if (path.endsWith('/landing-pages') && method === 'POST') {
      const payload = request.postDataJSON() as any;
      state.createCalls.push(payload);
      await sleep(900);
      const pageId = `lp-nhom12-${state.nextId}`;
      state.nextId += 1;
      const group = state.groups.find((item) => item._id === payload.defaultAdGroupId);
      const created = {
        _id: pageId,
        pageCode: `LP-${String(state.nextId).padStart(3, '0')}`,
        name: payload.name,
        slug: payload.slug,
        status: payload.status || 'DRAFT',
        heroTitle: payload.heroTitle || '',
        heroSubtitle: payload.heroSubtitle || '',
        formTitle: payload.formTitle || '',
        formDescription: payload.formDescription || '',
        submitButtonText: payload.submitButtonText || '',
        privacyNotice: payload.privacyNotice || '',
        successTitle: payload.successTitle || '',
        successMessage: payload.successMessage || '',
        bodyHtml: payload.bodyHtml || '',
        defaultPlatform: payload.defaultPlatform || group?.platform || '',
        defaultAdGroupId: payload.defaultAdGroupId || '',
        defaultAdGroupName: group?.name || '',
        autoCreateLead: payload.autoCreateLead !== false,
        metaPixelId: payload.metaPixelId || '',
        googleTagId: payload.googleTagId || '',
        googleAdsConversionId: payload.googleAdsConversionId || '',
        googleAdsConversionLabel: payload.googleAdsConversionLabel || '',
        tiktokPixelId: payload.tiktokPixelId || '',
        customHeadHtml: payload.customHeadHtml || '',
        customBodyHtml: payload.customBodyHtml || '',
        notes: payload.notes || '',
        createdAt: nowIso(),
      };
      state.pages = [created, ...state.pages];
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(created),
      });
      return;
    }

    await route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Unhandled landing route' }),
    });
  });
}

function buildLandingState(): LandingState {
  return {
    pages: [
      {
        _id: 'lp-seed-1',
        pageCode: 'LP-001',
        name: 'Seed Landing',
        slug: 'seed-landing',
        status: 'ACTIVE',
        defaultPlatform: 'FACEBOOK',
        defaultAdGroupId: 'group-alpha',
        defaultAdGroupName: 'Group Alpha',
        autoCreateLead: true,
        metaPixelId: 'META-SEED',
        googleTagId: 'G-SEED',
        googleAdsConversionId: '',
        googleAdsConversionLabel: '',
        tiktokPixelId: '',
        createdAt: nowIso(),
      },
    ],
    submissions: [],
    groups: [
      {
        _id: 'group-alpha',
        groupCode: 'AG-001',
        name: 'Group Alpha',
        adAccountId: 'acc-1',
        platform: 'FACEBOOK',
        platformCampaignId: 'cmp-1',
        status: 'ACTIVE',
        createdAt: nowIso(),
        updatedAt: nowIso(),
      },
    ],
    nextId: 2,
    createCalls: [],
  };
}

async function seedChatbotBrowserApis(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const browserWindow = window as any;
    browserWindow.__chatbotSettingsConfirms = [];
    window.confirm = (message?: string) => {
      browserWindow.__chatbotSettingsConfirms.push(String(message || ''));
      return true;
    };
  });
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
    ],
    tokens: [
      {
        _id: 'token-parent-1',
        label: 'Parent Support Token',
        apiKey: 'sk-******',
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
        apiKey: 'sk-******',
        model: 'gpt-4o',
        temperature: 0.4,
        maxTokens: 3000,
        status: 'ACTIVE',
        lastUsedAt: nowIso(-20),
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
    ],
    createFanpageCalls: [],
    nextFanpageId: 2,
  };
}

async function routeChatbotSettingsApis(page: Page, state: ChatbotSettingsState): Promise<void> {
  await page.route(/\/chatbot\/fanpages(?:\?.*)?$/, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();

    if (url.origin === APP_ORIGIN) {
      await route.continue();
      return;
    }

    if (method === 'GET') {
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
      return;
    }

    if (method === 'POST') {
      const payload = request.postDataJSON() as any;
      state.createFanpageCalls.push(payload);
      await sleep(700);
      state.nextFanpageId += 1;
      const created = {
        _id: `fp-created-${state.nextFanpageId}`,
        fanpageCode: `FP-NEW-${state.nextFanpageId}`,
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
        aiAutoReplyEnabled: payload.aiAutoReplyEnabled !== false,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      state.fanpages = [...state.fanpages, created];
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, fanpage: created }),
      });
      return;
    }

    await route.fallback();
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
        body: JSON.stringify(clone(state.tokens)),
      });
      return;
    }

    await route.fallback();
  });

  await page.route(/\/chatbot\/ai-assistant-profiles(?:\/[^/?]+)?(?:\?.*)?$/, async (route) => {
    const url = new URL(route.request().url());
    if (url.origin === APP_ORIGIN) {
      await route.continue();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(clone(state.aiProfiles)),
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
        data: clone(state.adAccounts),
        total: state.adAccounts.length,
        page: 1,
        limit: 200,
      }),
    });
  });
}

async function routePublicLandingApis(page: Page, submitBodies: any[]): Promise<void> {
  await page.route(/^https:\/\/connect\.facebook\.net\/.*$/, async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/javascript', body: '' });
  });
  await page.route(/^https:\/\/www\.googletagmanager\.com\/gtag\/js.*$/, async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/javascript', body: '' });
  });
  await page.route(/^https:\/\/analytics\.tiktok\.com\/i18n\/pixel\/events\.js.*$/, async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/javascript', body: '' });
  });
  await page.route(/\/public\/landing-pages\/e2e-double-click(?:\?.*)?$/, async (route) => {
    await sleep(500);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        _id: 'lp-double-001',
        name: 'Double Click Landing',
        slug: 'e2e-double-click',
        status: 'ACTIVE',
        heroTitle: 'Double Click Landing',
        heroSubtitle: 'De lai thong tin de nhan tu van phu hop.',
        formTitle: 'Nhan tu van hoc thu',
        formDescription: 'He thong phai chan duplicate submit neu nguoi dung bam lien tuc.',
        submitButtonText: 'Nhan tu van ngay',
        privacyNotice: 'Thong tin chi dung de tu van.',
        successTitle: 'Cam on phu huynh',
        successMessage: 'Chung toi se lien he som.',
        bodyHtml: '<div id=\"lp-body-copy\">Body intro</div>',
        metaPixelId: 'PIXEL-UNIT-1',
        googleTagId: 'G-UNITTEST',
        tiktokPixelId: 'TIKTOK-UNIT-1',
        customHeadHtml: '<meta id=\"lp-head-hook\" name=\"lp-head-hook\" content=\"present\">',
        customBodyHtml: '<div id=\"lp-body-hook\">custom body hook</div>',
      }),
    });
  });
  await page.route(/\/public\/landing-pages\/e2e-double-click\/submit(?:\?.*)?$/, async (route) => {
    submitBodies.push(route.request().postDataJSON());
    await sleep(900);
    await route.fulfill({
      status: 400,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Khong gui duoc form demo.' }),
    });
  });
}

async function seedTicketBrowserApis(page: Page, state: TicketState): Promise<void> {
  await page.addInitScript(() => {
    const win = window as any;
    win.__ticketConfirmMessages = [];
    window.confirm = (message?: string) => {
      win.__ticketConfirmMessages.push(String(message || ''));
      return true;
    };
    window.alert = () => {};
  });
}

async function routeTicketApis(page: Page, state: TicketState): Promise<void> {
  await page.route(/\/tickets(?:\/[^/?]+(?:\/comments|\/start)?|\/stats|\/my-tickets|\/assigned-to-me)?(?:\?.*)?$/, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    const path = url.pathname;

    if (url.origin === APP_ORIGIN) {
      await route.continue();
      return;
    }

    if (path.endsWith('/tickets/stats') && method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          byStatus: [
            { _id: 'OPEN', count: state.ticket.status === 'OPEN' ? 1 : 0 },
            { _id: 'IN_PROGRESS', count: state.ticket.status === 'IN_PROGRESS' ? 1 : 0 },
            { _id: 'RESOLVED', count: 0 },
            { _id: 'CLOSED', count: 0 },
          ],
          byType: [],
          byPriority: [],
          overdueCount: 0,
        }),
      });
      return;
    }

    if (path.endsWith('/tickets/assigned-to-me') && method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [clone(state.ticket)],
          meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
        }),
      });
      return;
    }

    if (path.endsWith(`/tickets/${state.ticket._id}`) && method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(clone(state.ticket)),
      });
      return;
    }

    if (path.endsWith(`/tickets/${state.ticket._id}/comments`) && method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
      return;
    }

    if (path.endsWith(`/tickets/${state.ticket._id}/start`) && method === 'POST') {
      state.actionRequests.push(`start:${state.ticket._id}`);
      await sleep(800);
      state.ticket = {
        ...state.ticket,
        status: 'IN_PROGRESS',
        updatedAt: nowIso(),
      };
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(clone(state.ticket)),
      });
      return;
    }

    await route.fallback();
  });
}

function buildTicketState(): TicketState {
  const createdAt = nowIso(-90);
  return {
    ticket: {
      _id: 'ticket-open-1',
      ticketCode: 'TKT-OPEN-001',
      type: 'REFUND_REQUEST',
      status: 'OPEN',
      priority: 'HIGH',
      subject: 'Ticket double click guard',
      description: 'Can dam bao action start khong bi goi hai lan neu OPS bam lien tuc.',
      createdBy: {
        _id: 'parent-1',
        fullName: 'Nguyen Phu Huynh',
        email: 'parent.demo@school.local',
        role: 'PARENT',
      },
      createdByRole: 'PARENT',
      assignedTo: {
        _id: 'ops-1',
        fullName: 'Ops Demo',
        email: 'ops.demo@school.local',
      },
      attachments: [],
      dueDate: nowIso(60),
      isOverdue: false,
      createdAt,
      updatedAt: createdAt,
    },
    actionRequests: [],
    confirmMessages: [],
  };
}

test.describe.configure({ mode: 'serial', timeout: 300_000 });
test.setTimeout(300_000);

test('NHOM12 landing management create ignores rapid double click and creates exactly one landing page', async ({ browser, request }) => {
  const state = buildLandingState();
  const evidence = await openInternalEvidencePage(
    browser,
    request,
    'director',
    'double_click_guard_landing_management_create_browser',
    '/app/landing-pages',
    async (page) => {
      await seedManagementBrowserApis(page);
      await routeLandingManagementApis(page, state);
    },
  );

  try {
    const createButton = evidence.page.locator('.page-header .primary');
    await expect(createButton).toBeVisible();

    await createButton.click();
    const modal = evidence.page.locator('.modal');
    await expect(modal).toBeVisible();
    await field(modal, /Ten landing page/i).fill('Double Click Landing Internal');
    await field(modal, /Slug public/i).fill('double-click-landing-internal');
    await field(modal, /Trang thai/i, 'select').selectOption('ACTIVE');
    await field(modal, /Tieu de hero/i).fill('Double Click Hero');
    await field(modal, /Meta Pixel ID/i).fill('PIXEL-DBL-1');
    await field(modal, /Ad group mac dinh/i, 'select').selectOption('group-alpha');
    await expect(field(modal, /Platform mac dinh/i, 'select')).toHaveValue('FACEBOOK');

    const saveButton = modal.locator('.modal-actions .primary');
    await saveButton.evaluate((button: HTMLButtonElement) => {
      button.click();
      button.click();
    });
    await expect(saveButton).toBeDisabled();
    await evidence.step('landing-double-click-create-loading');

    await expect.poll(() => state.createCalls.length).toBe(1);
    const createdRows = evidence.page.locator('tbody tr').filter({ hasText: /Double Click Landing Internal/i });
    await expect(createdRows).toHaveCount(1, { timeout: 20_000 });
    await expect(createdRows.first()).toContainText(/Meta PIXEL-DBL-1/i);
    await evidence.step('landing-double-click-create-result');

    expect(state.createCalls[0]).toMatchObject({
      name: 'Double Click Landing Internal',
      slug: 'double-click-landing-internal',
      status: 'ACTIVE',
      metaPixelId: 'PIXEL-DBL-1',
      defaultAdGroupId: 'group-alpha',
    });

    await evidence.finalize('PASS', {
      extraLines: [
        'Landing pages create modal ignored a same-task double click and issued exactly one create request.',
        'Only one landing-page row was created after the rapid double click, proving no duplicate internal record was inserted.',
      ],
    });
  } catch (error) {
    await evidence.finalize('FAIL', { error });
    throw error;
  }
});

test('NHOM12 chatbot fanpage create ignores rapid double click and creates exactly one manual fanpage', async ({ browser, request }) => {
  const state = buildChatbotSettingsState();
  const evidence = await openInternalEvidencePage(
    browser,
    request,
    'director',
    'double_click_guard_chatbot_fanpage_create_browser',
    '/app/chatbot-settings',
    async (page) => {
      await seedChatbotBrowserApis(page);
      await routeChatbotSettingsApis(page, state);
    },
  );

  try {
    await expect(evidence.page.getByRole('button', { name: /Them fanpage/i })).toBeVisible();
    await evidence.page.getByRole('button', { name: /Them fanpage/i }).click();

    const modal = evidence.page.locator('.modal').last();
    await modal.getByLabel('Ten fanpage').fill('Double Click Fanpage');
    await modal.getByLabel('Nen tang').selectOption('FACEBOOK');
    await modal.getByLabel('Page ID').fill('page-double-click-001');
    await modal.getByLabel('Page access token').fill('page-access-double-click-001');
    await modal.getByLabel('Mo ta fanpage').fill('Should create exactly one fanpage even when save is hit twice.');
    await modal.getByLabel('Tai khoan quang cao lien ket').selectOption('ad-facebook-1');
    await modal.getByLabel('OpenAI token').selectOption('token-sales-1');
    await modal.getByLabel('Webhook verify token').fill('verify-double-click-001');
    await modal.getByLabel('App secret').fill('app-secret-double-click-001');

    const saveButton = modal.getByRole('button', { name: /^Luu$/i });
    await saveButton.evaluate((button: HTMLButtonElement) => {
      button.click();
      button.click();
    });
    await expect(modal.getByRole('button', { name: /Dang luu/i })).toBeDisabled();
    await evidence.step('chatbot-double-click-create-loading');

    await expect.poll(() => state.createFanpageCalls.length).toBe(1);
    const createdRow = evidence.page.locator('tbody tr').filter({ hasText: 'Double Click Fanpage' });
    await expect(createdRow).toHaveCount(1, { timeout: 20_000 });
    await expect(createdRow.first()).toContainText('Bat');
    await evidence.step('chatbot-double-click-create-result');

    expect(state.createFanpageCalls[0]).toEqual({
      name: 'Double Click Fanpage',
      platform: 'FACEBOOK',
      pageId: 'page-double-click-001',
      pageAccessToken: 'page-access-double-click-001',
      description: 'Should create exactly one fanpage even when save is hit twice.',
      adAccountId: 'ad-facebook-1',
      openaiTokenId: 'token-sales-1',
      webhookVerifyToken: 'verify-double-click-001',
      appSecret: 'app-secret-double-click-001',
      aiAutoReplyEnabled: true,
      status: 'ACTIVE',
    });

    await evidence.finalize('PASS', {
      extraLines: [
        'Chatbot fanpage create modal ignored a same-task double click and issued exactly one create request.',
        'Only one manual fanpage row was created after the rapid double click, proving no duplicate chatbot configuration was inserted.',
      ],
    });
  } catch (error) {
    await evidence.finalize('FAIL', { error });
    throw error;
  }
});

test('NHOM12 public landing submit ignores rapid double click and sends exactly one public submission', async ({ browser }) => {
  const submitBodies: any[] = [];
  const evidence = await openPublicEvidencePage(
    browser,
    'double_click_guard_public_landing_submit_browser',
    '/lp/e2e-double-click?utm_source=facebook&utm_medium=cpc&utm_campaign=wave3&utm_content=hero&utm_term=math&fbclid=fbclid123&gclid=gclid123&ttclid=ttclid123&campaign_id=camp-1',
    async (page) => {
      await routePublicLandingApis(page, submitBodies);
    },
  );

  try {
    await expect(evidence.page.locator('.hero h1')).toContainText(/Double Click Landing/i);
    await evidence.page.locator('input').nth(0).fill('Parent Double');
    await evidence.page.locator('input').nth(1).fill('0901111222');
    await evidence.page.locator('input').nth(2).fill('parent.double@example.com');
    await evidence.page.locator('input').nth(3).fill('Student Double');
    await evidence.page.locator('input').nth(4).fill('Lop 5');
    await evidence.page.locator('textarea').fill('Need browser proof that duplicate submit is blocked.');

    const submitButton = evidence.page.locator('.submit-btn');
    await submitButton.evaluate((button: HTMLButtonElement) => {
      button.click();
      button.click();
    });
    await expect(submitButton).toBeDisabled();
    await expect(submitButton).toContainText(/Dang gui/i);
    await evidence.step('public-landing-double-click-submit-loading');

    await expect(evidence.page.locator('.submit-error')).toContainText(/Khong gui duoc form demo/i, {
      timeout: 20_000,
    });
    await expect(submitBodies).toHaveLength(1);
    expect(submitBodies[0]).toMatchObject({
      parentName: 'Parent Double',
      parentPhone: '0901111222',
      parentEmail: 'parent.double@example.com',
      studentName: 'Student Double',
      studentGrade: 'Lop 5',
      notes: 'Need browser proof that duplicate submit is blocked.',
      platform: 'FACEBOOK',
      adRefParam: 'camp-1',
    });
    await evidence.step('public-landing-double-click-submit-result');

    await evidence.finalize('PASS', {
      extraLines: [
        'Public landing form ignored a same-task double click and issued exactly one submit request.',
        'The browser still showed the single authoritative error state after one failed request instead of duplicating submissions.',
      ],
    });
  } catch (error) {
    await evidence.finalize('FAIL', { error });
    throw error;
  }
});

test('NHOM12 ticket start action ignores rapid double click and transitions status only once', async ({ browser, request }) => {
  const state = buildTicketState();
  const evidence = await openInternalEvidencePage(
    browser,
    request,
    'ops',
    'double_click_guard_ticket_start_action_browser',
    '/app/tickets?tab=assigned',
    async (page) => {
      await seedTicketBrowserApis(page, state);
      await routeTicketApis(page, state);
    },
  );

  try {
    await expect(evidence.page.locator('.ticket-list')).toContainText('TKT-OPEN-001');
    await evidence.page.locator('.ticket-card').first().click();
    await expect(evidence.page.locator('.ticket-detail-page')).toBeVisible();
    await expect(evidence.page.locator('.detail-sidebar .badge.status').first()).toContainText('Mới tạo');

    const startButton = evidence.page.locator('.action-btn.start');
    await startButton.evaluate((button: HTMLButtonElement) => {
      button.click();
      button.click();
    });
    await evidence.step('ticket-double-click-start-fired');

    await expect.poll(() => state.actionRequests.length).toBe(1);
    expect(state.actionRequests).toEqual(['start:ticket-open-1']);
    await expect(evidence.page.locator('.detail-sidebar .badge.status').first()).toContainText('Đang xử lý');

    const confirmMessages = await evidence.page.evaluate(() => {
      return ((window as any).__ticketConfirmMessages || []).slice();
    });
    expect(confirmMessages).toEqual(['Nhận xử lý ticket này?']);
    await evidence.step('ticket-double-click-start-result');

    await evidence.finalize('PASS', {
      extraLines: [
        'Ticket start action ignored a same-task double click and issued exactly one workflow action request.',
        'The ticket status transitioned from OPEN to IN_PROGRESS exactly once, with only one confirm dialog and one final state change.',
      ],
    });
  } catch (error) {
    await evidence.finalize('FAIL', { error });
    throw error;
  }
});
