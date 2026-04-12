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

function field(modal: ReturnType<Page['locator']>, labelText: RegExp, selector = 'input,textarea,select') {
  return modal.locator('label').filter({ hasText: labelText }).locator(selector).first();
}

type FanpageState = {
  fanpages: any[];
  tokens: any[];
  aiProfiles: any[];
  adAccounts: any[];
  createFanpageCalls: any[];
  nextFanpageId: number;
};

type TicketCreateState = {
  myTickets: any[];
  createPayloads: any[];
  nextTicketId: number;
};

type PublicLandingState = {
  page: any;
  submitBodies: any[];
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

function buildFanpageState(): FanpageState {
  const createdAt = nowIso(-120);
  return {
    fanpages: [],
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
    nextFanpageId: 1,
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

async function routeChatbotFanpageApis(page: Page, state: FanpageState): Promise<void> {
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

    if (path.endsWith('/chatbot/fanpages') && method === 'POST') {
      const payload = request.postDataJSON() as any;
      state.createFanpageCalls.push(payload);
      await sleep(900);

      const fanpageId = `fp-created-${state.nextFanpageId}`;
      state.nextFanpageId += 1;
      state.fanpages = [
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
      ];

      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, id: fanpageId }),
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

  await page.route(/\/chatbot\/ai-assistant-profiles(?:\/[^/?]+)?(?:\?.*)?$/, async (route) => {
    if (new URL(route.request().url()).origin === APP_ORIGIN) {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(clone(state.aiProfiles)),
    });
  });

  await page.route(/\/ads\/accounts(?:\/all)?(?:\?.*)?$/, async (route) => {
    if (new URL(route.request().url()).origin === APP_ORIGIN) {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(clone(state.adAccounts)),
    });
  });
}

function buildTicketCreateState(): TicketCreateState {
  return {
    myTickets: [],
    createPayloads: [],
    nextTicketId: 1,
  };
}

async function routeTicketCreateApis(page: Page, state: TicketCreateState): Promise<void> {
  await page.route(/^https?:\/\/[^/]+:3000\/tickets\/my-tickets(?:\?.*)?$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: clone(state.myTickets),
        meta: { totalPages: 1, page: 1 },
      }),
    });
  });

  await page.route(/^https?:\/\/[^/]+:3000\/tickets\/stats(?:\?.*)?$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        byStatus: [],
        byType: [],
        byPriority: [],
        overdueCount: 0,
      }),
    });
  });

  await page.route(/^https?:\/\/[^/]+:3000\/tickets(?:\?.*)?$/, async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (url.origin === APP_ORIGIN) {
      await route.continue();
      return;
    }

    if (request.method() === 'POST') {
      const body = request.postDataJSON() as any;
      state.createPayloads.push(body);
      await sleep(900);
      state.myTickets = [
        {
          _id: `ticket-created-${state.nextTicketId}`,
          ticketCode: `TKT-CREATE-00${state.nextTicketId}`,
          type: body.type,
          status: 'OPEN',
          priority: body.priority,
          subject: body.subject,
          description: body.description,
          createdBy: {
            _id: 'ops-1',
            fullName: 'Ops Demo',
            email: 'ops.demo@school.local',
            role: 'OPS',
          },
          createdByRole: 'OPS',
          attachments: [],
          isOverdue: false,
          createdAt: nowIso(),
          updatedAt: nowIso(),
        },
        ...state.myTickets,
      ];
      state.nextTicketId += 1;
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(state.myTickets[0]),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: clone(state.myTickets),
        meta: { totalPages: 1, page: 1 },
      }),
    });
  });
}

function buildPublicLandingState(): PublicLandingState {
  return {
    page: {
      _id: 'lp-loading-001',
      name: 'Loading State Landing',
      slug: 'loading-state-landing',
      status: 'ACTIVE',
      heroTitle: 'Loading State Landing',
      heroSubtitle: 'Kiem chung loading state va chong submit lap.',
      formTitle: 'Nhan tu van hoc thu',
      formDescription: 'Form nay duoc dung de kiem chung pending submit.',
      submitButtonText: 'Nhan tu van ngay',
      privacyNotice: 'Thong tin chi dung de tu van.',
      successTitle: 'Cam on phu huynh',
      successMessage: 'Chung toi se lien he som.',
    },
    submitBodies: [],
  };
}

async function routePublicLandingApis(page: Page, state: PublicLandingState): Promise<void> {
  await page.route(/\/public\/landing-pages\/loading-state-landing\/submit(?:\?.*)?$/, async (route) => {
    if (new URL(route.request().url()).origin === APP_ORIGIN) {
      await route.continue();
      return;
    }
    state.submitBodies.push(route.request().postDataJSON());
    await sleep(900);
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        submissionCode: 'SUB-LOADING-001',
        leadCode: 'LEAD-LOADING-001',
      }),
    });
  });

  await page.route(/\/public\/landing-pages\/loading-state-landing(?:\?.*)?$/, async (route) => {
    if (new URL(route.request().url()).origin === APP_ORIGIN) {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(clone(state.page)),
    });
  });
}

test.describe.serial('NHOM12 loading-state browser coverage', () => {
  test('NHOM12 chatbot fanpage save shows loading state and blocks repeat save while pending', async ({ browser, request }) => {
    test.slow();
    test.setTimeout(240_000);

    const state = buildFanpageState();
    const evidence = await openInternalEvidencePage(
      browser,
      request,
      'director',
      'loading_state_chatbot_fanpage_save',
      '/app/chatbot-settings',
      async (page) => {
        await seedChatbotBrowserApis(page);
        await routeChatbotFanpageApis(page, state);
      },
    );

    try {
      await expect(evidence.page.locator('h2')).toContainText('Cai dat Chatbot');
      await evidence.page.getByRole('button', { name: /Them fanpage/i }).click();

      const modal = evidence.page.locator('.modal').filter({ has: evidence.page.getByRole('heading', { name: /Them fanpage/i }) }).first();
      await field(modal, /Ten fanpage/i).fill('Loading State Fanpage');
      await field(modal, /Nen tang/i).selectOption('FACEBOOK');
      await field(modal, /Page ID/i).fill('page-loading-001');
      await field(modal, /Webhook verify token/i).fill('verify-loading-001');

      const saveButton = modal.locator('.modal-actions .primary');
      await saveButton.click();
      await expect(saveButton).toBeDisabled();
      await expect(saveButton).toContainText(/Dang luu/i);
      await expect.poll(() => state.createFanpageCalls.length).toBe(1);

      await saveButton.evaluate((button: HTMLButtonElement) => button.click());
      await sleep(150);
      expect(state.createFanpageCalls).toHaveLength(1);
      await evidence.step('01-loading-state-visible');

      await expect(evidence.page.locator('tbody')).toContainText('Loading State Fanpage');
      expect(state.createFanpageCalls[0]).toEqual({
        name: 'Loading State Fanpage',
        platform: 'FACEBOOK',
        pageId: 'page-loading-001',
        pageAccessToken: '',
        description: '',
        webhookVerifyToken: 'verify-loading-001',
        appSecret: '',
        aiAutoReplyEnabled: true,
        status: 'ACTIVE',
      });
      expect(state.createFanpageCalls).toHaveLength(1);
      await evidence.step('02-single-save-request');

      evidence.note('Chatbot fanpage save shows a visible loading state and keeps request count at one while the save is pending.');
      await evidence.finalize('PASS', {
        extraLines: [
          'Fanpage save button switches to Dang luu and disables while request is pending: PASS',
          'Fanpage save request count remains exactly one while pending: PASS',
        ],
      });
    } catch (error) {
      await evidence.finalize('FAIL', { error });
      throw error;
    }
  });

  test('NHOM12 ticket create shows loading state and blocks repeat submit while pending', async ({ browser, request }) => {
    test.slow();
    test.setTimeout(240_000);

    const state = buildTicketCreateState();
    const evidence = await openInternalEvidencePage(
      browser,
      request,
      'ops',
      'loading_state_ticket_create',
      '/app/tickets?tab=my',
      async (page) => {
        await routeTicketCreateApis(page, state);
      },
    );

    try {
      await expect(evidence.page.locator('.empty-state')).toBeVisible();
      await evidence.page.locator('.empty-state .primary').click();
      const modal = evidence.page.locator('.modal').first();
      await expect(modal.locator('.modal-header h3')).toContainText(/Ticket/i);

      await modal.locator('.modal-body select').first().selectOption('OTHER');
      await modal.locator('.modal-body input[type="text"]').fill('Loading state ticket create');
      await modal.locator('.modal-body textarea').fill('Ticket nay dung de kiem chung loading state va chan submit lap.');
      await modal.locator('.modal-body select').nth(1).selectOption('HIGH');

      const submitButton = modal.locator('.modal-footer .primary');
      await submitButton.click();
      await expect(submitButton).toBeDisabled();
      await expect(submitButton).toContainText(/Đang tạo|Dang tao/i);
      await expect.poll(() => state.createPayloads.length).toBe(1);

      await submitButton.evaluate((button: HTMLButtonElement) => button.click());
      await sleep(150);
      expect(state.createPayloads).toHaveLength(1);
      await evidence.step('01-loading-state-visible');

      await expect(evidence.page.locator('.ticket-list')).toContainText('Loading state ticket create');
      expect(state.createPayloads[0]).toEqual({
        type: 'OTHER',
        subject: 'Loading state ticket create',
        description: 'Ticket nay dung de kiem chung loading state va chan submit lap.',
        priority: 'HIGH',
      });
      expect(state.createPayloads).toHaveLength(1);
      await evidence.step('02-single-create-request');

      evidence.note('Ticket create modal shows a visible pending label and prevents duplicate create requests while waiting for the backend.');
      await evidence.finalize('PASS', {
        extraLines: [
          'Ticket create button switches to Dang tao and disables while pending: PASS',
          'Ticket create request count remains exactly one while pending: PASS',
        ],
      });
    } catch (error) {
      await evidence.finalize('FAIL', { error });
      throw error;
    }
  });

  test('NHOM12 public landing submit shows loading state and blocks repeat submit while pending', async ({ browser }) => {
    test.slow();
    test.setTimeout(240_000);

    const state = buildPublicLandingState();
    const evidence = await openPublicEvidencePage(
      browser,
      'loading_state_public_landing_submit',
      '/lp/loading-state-landing',
      async (page) => {
        await routePublicLandingApis(page, state);
      },
    );

    try {
      await expect(evidence.page.locator('.hero h1')).toContainText(/Loading State Landing/i);
      await evidence.page.locator('input').nth(0).fill('Parent Loading');
      await evidence.page.locator('input').nth(1).fill('0901234567');
      await evidence.page.locator('input').nth(2).fill('parent.loading@example.com');
      await evidence.page.locator('input').nth(3).fill('Student Loading');
      await evidence.page.locator('input').nth(4).fill('Lop 6');
      await evidence.page.locator('textarea').fill('Can tu van khoa hoc tang toc.');

      const submitButton = evidence.page.locator('.submit-btn');
      await submitButton.click();
      await expect(submitButton).toBeDisabled();
      await expect(submitButton).toContainText(/Dang gui/i);
      await expect.poll(() => state.submitBodies.length).toBe(1);

      await submitButton.evaluate((button: HTMLButtonElement) => button.click());
      await sleep(150);
      expect(state.submitBodies).toHaveLength(1);
      await evidence.step('01-loading-state-visible');

      await expect(evidence.page.locator('.success-card')).toContainText(/Cam on phu huynh/i);
      expect(state.submitBodies[0]).toMatchObject({
        parentName: 'Parent Loading',
        parentPhone: '0901234567',
        parentEmail: 'parent.loading@example.com',
        studentName: 'Student Loading',
        studentGrade: 'Lop 6',
        notes: 'Can tu van khoa hoc tang toc.',
      });
      expect(state.submitBodies).toHaveLength(1);
      await evidence.step('02-single-submit-request');

      evidence.note('Public landing submit shows a clear pending label and prevents duplicate submissions while the request is in flight.');
      await evidence.finalize('PASS', {
        extraLines: [
          'Public landing submit button switches to Dang gui and disables while pending: PASS',
          'Public landing submit request count remains exactly one while pending: PASS',
        ],
      });
    } catch (error) {
      await evidence.finalize('FAIL', { error });
      throw error;
    }
  });
});
