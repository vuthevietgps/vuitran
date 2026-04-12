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
  status: string;
  aiAutoReplyEnabled: boolean;
  createdAt: string;
  updatedAt: string;
};

type SaleUser = {
  _id: string;
  email: string;
  fullName: string;
  role: string;
};

type Conversation = {
  _id: string;
  conversationCode: string;
  fanpageId: string;
  fanpageName: string;
  platform: string;
  platformUserId: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  status: 'AI_HANDLING' | 'HUMAN_HANDLING';
  assignedAgentId?: string;
  assignedAgentName?: string;
  lastMessageAt: string;
  messageCount: number;
  notes?: string;
  leadId?: string;
  orderId?: string;
  createdAt: string;
  updatedAt: string;
};

type Message = {
  _id: string;
  conversationId: string;
  senderType: 'CUSTOMER' | 'AI' | 'HUMAN_AGENT';
  senderName?: string;
  content: string;
  status: string;
  createdAt: string;
};

type LeadPayload = {
  parentName: string;
  parentPhone: string;
  parentEmail?: string;
  studentName: string;
  notes: string;
  saleId: string;
};

type OrderPayload = {
  parentName: string;
  parentPhone: string;
  studentName: string;
  notes: string;
  saleId: string;
  items: any[];
};

type ConversionState = {
  fanpages: Fanpage[];
  sales: SaleUser[];
  conversation: Conversation;
  messages: Message[];
  leadPayloads: LeadPayload[];
  orderPayloads: OrderPayload[];
  detailRequests: string[];
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

function buildConversionState(): ConversionState {
  const createdAt = nowIso();
  return {
    fanpages: [
      {
        _id: 'fp-main',
        fanpageCode: 'FP-MAIN',
        name: 'Main Enrollment Page',
        platform: 'FACEBOOK',
        pageId: 'page-main',
        status: 'ACTIVE',
        aiAutoReplyEnabled: true,
        createdAt,
        updatedAt: createdAt,
      },
    ],
    sales: [
      {
        _id: 'sale-1',
        email: 'sale.demo@school.local',
        fullName: 'Sale Demo',
        role: 'SALE',
      },
    ],
    conversation: {
      _id: 'conv-convert-1',
      conversationCode: 'CHAT-CONVERT-001',
      fanpageId: 'fp-main',
      fanpageName: 'Main Enrollment Page',
      platform: 'FACEBOOK',
      platformUserId: 'fb-convert-001',
      customerName: 'Tran Lan',
      customerPhone: '0900000001',
      customerEmail: 'tran.lan@example.test',
      status: 'HUMAN_HANDLING',
      assignedAgentId: 'sale-1',
      assignedAgentName: 'Sale Demo',
      lastMessageAt: nowIso(-6),
      messageCount: 3,
      notes: 'Parent asked for trial-to-paid conversion details.',
      createdAt,
      updatedAt: createdAt,
    },
    messages: [
      {
        _id: 'conv-convert-1-msg-1',
        conversationId: 'conv-convert-1',
        senderType: 'CUSTOMER',
        senderName: 'Tran Lan',
        content: 'Toi muon dang ky goi hoc cho con ngay trong tuan nay.',
        status: 'SENT',
        createdAt: nowIso(-8),
      },
      {
        _id: 'conv-convert-1-msg-2',
        conversationId: 'conv-convert-1',
        senderType: 'AI',
        senderName: 'Enrollment Bot',
        content: 'Bot da thu thap thong tin ban dau va chuyen cho sale.',
        status: 'SENT',
        createdAt: nowIso(-7),
      },
      {
        _id: 'conv-convert-1-msg-3',
        conversationId: 'conv-convert-1',
        senderType: 'HUMAN_AGENT',
        senderName: 'Sale Demo',
        content: 'Sale dang chuan bi tao lead va don hang tu hoi thoai nay.',
        status: 'SENT',
        createdAt: nowIso(-6),
      },
    ],
    leadPayloads: [],
    orderPayloads: [],
    detailRequests: [],
  };
}

async function routeConversionApis(page: Page, state: ConversionState): Promise<void> {
  await page.route(/\/users\/sales(?:\?.*)?$/, async (route) => {
    const url = new URL(route.request().url());
    if (url.origin === APP_ORIGIN) {
      await route.continue();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(state.sales),
    });
  });

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
        limit: 100,
      }),
    });
  });

  await page.route(/\/chatbot\/conversations(?:\/[^/?]+(?:\/messages|\/create-lead|\/create-order)?)?(?:\?.*)?$/, async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (url.origin === APP_ORIGIN) {
      await route.continue();
      return;
    }

    const method = request.method();
    const path = url.pathname;

    if (path.endsWith('/chatbot/conversations') && method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [state.conversation],
          total: 1,
          page: 1,
          limit: 20,
        }),
      });
      return;
    }

    const detailMatch = path.match(/\/chatbot\/conversations\/([^/]+)$/);
    if (detailMatch && method === 'GET') {
      state.detailRequests.push(detailMatch[1]);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(state.conversation),
      });
      return;
    }

    const messagesMatch = path.match(/\/chatbot\/conversations\/([^/]+)\/messages$/);
    if (messagesMatch && method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: state.messages,
          total: state.messages.length,
          page: 1,
          limit: 50,
        }),
      });
      return;
    }

    const createLeadMatch = path.match(/\/chatbot\/conversations\/([^/]+)\/create-lead$/);
    if (createLeadMatch && method === 'POST') {
      const payload = request.postDataJSON() as LeadPayload;
      state.leadPayloads.push(payload);
      state.conversation = {
        ...state.conversation,
        leadId: 'lead-created-1',
        updatedAt: nowIso(),
      };
      await sleep(250);
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          _id: 'lead-created-1',
          fullName: payload.parentName,
          studentName: payload.studentName,
        }),
      });
      return;
    }

    const createOrderMatch = path.match(/\/chatbot\/conversations\/([^/]+)\/create-order$/);
    if (createOrderMatch && method === 'POST') {
      const payload = request.postDataJSON() as OrderPayload;
      state.orderPayloads.push(payload);
      state.conversation = {
        ...state.conversation,
        orderId: 'order-created-1',
        updatedAt: nowIso(),
      };
      await sleep(250);
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          _id: 'order-created-1',
          parentName: payload.parentName,
          studentName: payload.studentName,
        }),
      });
      return;
    }

    await route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Unhandled conversation conversion route' }),
    });
  });
}

async function openOpsEvidencePage(
  browser: Browser,
  request: APIRequestContext,
  scenario: string,
  setup: (page: Page) => Promise<void> | void,
): Promise<BatchEvidenceSession> {
  const opsSession = await loginAsRole(request, 'ops');
  const evidence = await createBatchEvidenceContext(browser, {
    batchId: 'B09',
    scenario,
    runDate: RUN_DATE,
  });
  await applySessionCookies(evidence.context, opsSession);
  await setup(evidence.page);
  await evidence.page.goto(appUrl('/app/conversations'));
  await evidence.page.waitForLoadState('domcontentloaded');
  return evidence;
}

test.describe.serial('B09 conversation conversion browser flows', () => {
  test('B09 conversation can create a lead with prefilled customer data and refresh linked lead state', async ({ browser, request }) => {
    test.slow();
    test.setTimeout(240_000);

    const state = buildConversionState();
    const evidence = await openOpsEvidencePage(
      browser,
      request,
      'conversation_create_lead_browser',
      async (page) => {
        await routeConversionApis(page, state);
      },
    );

    try {
      await evidence.page.locator('.conv-card').first().click();
      await expect(evidence.page.locator('.conv-card.selected')).toContainText('Tran Lan');

      const sidebarSections = evidence.page.locator('.sidebar-panel .sidebar-section');
      const leadSection = sidebarSections.nth(3);
      await leadSection.locator('button.primary.full-width').click();

      const leadInputs = leadSection.locator('.inline-form input');
      const leadSelect = leadSection.locator('.inline-form select');
      const leadNotes = leadSection.locator('.inline-form textarea').first();

      await expect(leadInputs.nth(0)).toHaveValue('Tran Lan');
      await expect(leadInputs.nth(1)).toHaveValue('0900000001');
      await expect(leadInputs.nth(2)).toHaveValue('tran.lan@example.test');
      await expect(leadSelect).toHaveValue('sale-1');

      await leadInputs.nth(3).fill('Nguyen Phuc');
      await leadNotes.fill('Lead created directly from the chatbot handoff for trial-to-paid conversion.');
      await leadSection.locator('.form-actions button.primary').click();

      await expect.poll(() => state.leadPayloads).toHaveLength(1);
      expect(state.leadPayloads[0]).toEqual({
        parentName: 'Tran Lan',
        parentPhone: '0900000001',
        parentEmail: 'tran.lan@example.test',
        studentName: 'Nguyen Phuc',
        notes: 'Lead created directly from the chatbot handoff for trial-to-paid conversion.',
        saleId: 'sale-1',
      });
      await expect.poll(() => state.detailRequests).toContain('conv-convert-1');
      await expect(leadSection.locator('.linked-entity')).toContainText('Lead');
      await expect(leadSection.locator('button.primary.full-width')).toHaveCount(0);
      await evidence.step('01-create-lead-from-conversation');

      evidence.note('Conversation sidebar now proves lead creation with exact payload preservation from prefilled customer context and linked-entity refresh after success.');
      await evidence.finalize('PASS', {
        extraLines: [
          'Lead form keeps the expected customer prefills and selected sale owner before submit: PASS',
          'Lead creation posts the exact conversation-derived payload and refreshes the sidebar into linked-lead state: PASS',
        ],
      });
    } catch (error) {
      await evidence.finalize('FAIL', { error });
      throw error;
    }
  });

  test('B09 conversation can create an order with source data intact and refresh linked order state', async ({ browser, request }) => {
    test.slow();
    test.setTimeout(240_000);

    const state = buildConversionState();
    const evidence = await openOpsEvidencePage(
      browser,
      request,
      'conversation_create_order_browser',
      async (page) => {
        await routeConversionApis(page, state);
      },
    );

    try {
      await evidence.page.locator('.conv-card').first().click();
      await expect(evidence.page.locator('.conv-card.selected')).toContainText('Tran Lan');

      const sidebarSections = evidence.page.locator('.sidebar-panel .sidebar-section');
      const orderSection = sidebarSections.nth(4);
      await orderSection.locator('button.primary.full-width').click();

      const orderInputs = orderSection.locator('.inline-form input');
      const orderSelect = orderSection.locator('.inline-form select');
      const orderNotes = orderSection.locator('.inline-form textarea').first();

      await expect(orderInputs.nth(0)).toHaveValue('Tran Lan');
      await expect(orderInputs.nth(1)).toHaveValue('0900000001');
      await expect(orderSelect).toHaveValue('sale-1');

      await orderInputs.nth(2).fill('Nguyen Phuc');
      await orderNotes.fill('Order created directly from chatbot conversation after parent confirmed package fit.');
      await orderSection.locator('.form-actions button.primary').click();

      await expect.poll(() => state.orderPayloads).toHaveLength(1);
      expect(state.orderPayloads[0]).toEqual({
        parentName: 'Tran Lan',
        parentPhone: '0900000001',
        studentName: 'Nguyen Phuc',
        notes: 'Order created directly from chatbot conversation after parent confirmed package fit.',
        saleId: 'sale-1',
        items: [],
      });
      await expect.poll(() => state.detailRequests).toContain('conv-convert-1');
      await expect(orderSection.locator('.linked-entity')).toContainText('Đơn');
      await expect(orderSection.locator('button.primary.full-width')).toHaveCount(0);
      await evidence.step('01-create-order-from-conversation');

      evidence.note('Conversation sidebar now proves order creation preserves conversation source data and refreshes into linked-order state after success.');
      await evidence.finalize('PASS', {
        extraLines: [
          'Order form keeps the expected conversation-derived parent data and selected sale owner before submit: PASS',
          'Order creation posts the exact payload, including empty items seed, and refreshes the sidebar into linked-order state: PASS',
        ],
      });
    } catch (error) {
      await evidence.finalize('FAIL', { error });
      throw error;
    }
  });
});
