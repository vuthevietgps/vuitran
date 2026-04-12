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
  customerPhone?: string;
  customerEmail?: string;
  status: 'AI_HANDLING' | 'HUMAN_HANDLING' | 'CLOSED';
  assignedAgentId?: string;
  assignedAgentName?: string;
  lastMessageAt: string;
  messageCount: number;
  adGroupName?: string;
  notes?: string;
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

type ConversationsState = {
  fanpages: Fanpage[];
  sales: SaleUser[];
  conversations: Conversation[];
  messagesByConversationId: Record<string, Message[]>;
  listRequests: string[];
  messageRequests: string[];
  sentContents: string[];
  takeoverCalls: string[];
  releaseCalls: string[];
  closedConversationIds: string[];
};

function appUrl(path: string): string {
  return new URL(path, APP_BASE_URL).toString();
}

function nowIso(): string {
  return new Date().toISOString();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sortConversations(items: Conversation[]): Conversation[] {
  return [...items].sort((left, right) => {
    return new Date(right.lastMessageAt).getTime() - new Date(left.lastMessageAt).getTime();
  });
}

function repeatMessage(index: number): Message {
  return {
    _id: `msg-human-${index + 1}`,
    conversationId: 'conv-human-main',
    senderType: index % 2 === 0 ? 'CUSTOMER' : 'HUMAN_AGENT',
    senderName: index % 2 === 0 ? 'Pham Bao' : 'Ops Demo',
    content: `Conversation history ${index + 1} - long browser text to force message area scrolling in the evidence run.`,
    status: 'SENT',
    createdAt: new Date(Date.now() - (40 - index) * 60_000).toISOString(),
  };
}

function buildConversationsState(): ConversationsState {
  const createdAt = nowIso();
  const fanpages: Fanpage[] = [
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
    {
      _id: 'fp-ops',
      fanpageCode: 'FP-OPS',
      name: 'Ops Support Page',
      platform: 'FACEBOOK',
      pageId: 'page-ops',
      status: 'ACTIVE',
      aiAutoReplyEnabled: true,
      createdAt,
      updatedAt: createdAt,
    },
  ];

  const conversations = sortConversations([
    {
      _id: 'conv-ai-main',
      conversationCode: 'CHAT-001',
      fanpageId: 'fp-main',
      fanpageName: 'Main Enrollment Page',
      platform: 'FACEBOOK',
      platformUserId: 'fb-ai-main',
      customerName: 'Tran Lan',
      customerPhone: '0900000001',
      customerEmail: 'tran.lan@example.test',
      status: 'AI_HANDLING',
      assignedAgentId: '',
      assignedAgentName: '',
      lastMessageAt: new Date(Date.now() - 3 * 60_000).toISOString(),
      messageCount: 2,
      adGroupName: 'Lead Magnet Alpha',
      notes: 'Need AI handoff test.',
      createdAt,
      updatedAt: createdAt,
    },
    {
      _id: 'conv-human-main',
      conversationCode: 'CHAT-002',
      fanpageId: 'fp-main',
      fanpageName: 'Main Enrollment Page',
      platform: 'FACEBOOK',
      platformUserId: 'fb-human-main',
      customerName: 'Pham Bao',
      customerPhone: '0900000002',
      customerEmail: 'pham.bao@example.test',
      status: 'HUMAN_HANDLING',
      assignedAgentId: 'sale-ops-1',
      assignedAgentName: 'Ops Demo',
      lastMessageAt: new Date(Date.now() - 12 * 60_000).toISOString(),
      messageCount: 24,
      adGroupName: 'Retargeting Main',
      notes: 'Need human coaching follow-up.',
      createdAt,
      updatedAt: createdAt,
    },
    {
      _id: 'conv-closed-ops',
      conversationCode: 'CHAT-003',
      fanpageId: 'fp-ops',
      fanpageName: 'Ops Support Page',
      platform: 'FACEBOOK',
      platformUserId: 'fb-closed-ops',
      customerName: 'Le Chi',
      customerPhone: '0900000003',
      customerEmail: 'le.chi@example.test',
      status: 'CLOSED',
      assignedAgentId: 'sale-ops-1',
      assignedAgentName: 'Ops Demo',
      lastMessageAt: new Date(Date.now() - 120 * 60_000).toISOString(),
      messageCount: 3,
      notes: 'Closed support case.',
      createdAt,
      updatedAt: createdAt,
    },
  ]);

  return {
    fanpages,
    sales: [
      {
        _id: 'sale-ops-1',
        email: 'ops.demo@school.local',
        fullName: 'Ops Demo',
        role: 'OPS',
      },
    ],
    conversations,
    messagesByConversationId: {
      'conv-ai-main': [
        {
          _id: 'msg-ai-1',
          conversationId: 'conv-ai-main',
          senderType: 'CUSTOMER',
          senderName: 'Tran Lan',
          content: 'Hello, I want to know the class schedule.',
          status: 'SENT',
          createdAt: new Date(Date.now() - 6 * 60_000).toISOString(),
        },
        {
          _id: 'msg-ai-2',
          conversationId: 'conv-ai-main',
          senderType: 'AI',
          senderName: 'Enrollment Bot',
          content: 'I can help with class schedule and fee details.',
          status: 'SENT',
          createdAt: new Date(Date.now() - 3 * 60_000).toISOString(),
        },
      ],
      'conv-human-main': Array.from({ length: 24 }, (_, index) => repeatMessage(index)),
      'conv-closed-ops': [
        {
          _id: 'msg-closed-1',
          conversationId: 'conv-closed-ops',
          senderType: 'CUSTOMER',
          senderName: 'Le Chi',
          content: 'Support issue resolved.',
          status: 'SENT',
          createdAt: new Date(Date.now() - 3 * 60 * 60_000).toISOString(),
        },
        {
          _id: 'msg-closed-2',
          conversationId: 'conv-closed-ops',
          senderType: 'HUMAN_AGENT',
          senderName: 'Ops Demo',
          content: 'Ticket was resolved and closed.',
          status: 'SENT',
          createdAt: new Date(Date.now() - 119 * 60_000).toISOString(),
        },
        {
          _id: 'msg-closed-3',
          conversationId: 'conv-closed-ops',
          senderType: 'CUSTOMER',
          senderName: 'Le Chi',
          content: 'Thank you.',
          status: 'SENT',
          createdAt: new Date(Date.now() - 118 * 60_000).toISOString(),
        },
      ],
    },
    listRequests: [],
    messageRequests: [],
    sentContents: [],
    takeoverCalls: [],
    releaseCalls: [],
    closedConversationIds: [],
  };
}

function updateConversation(
  state: ConversationsState,
  conversationId: string,
  patch: Partial<Conversation>,
): Conversation | null {
  const current = state.conversations.find((item) => item._id === conversationId);
  if (!current) {
    return null;
  }

  const updated: Conversation = {
    ...current,
    ...patch,
    updatedAt: nowIso(),
  };
  state.conversations = sortConversations(
    state.conversations.map((item) => (item._id === conversationId ? updated : item)),
  );
  return updated;
}

function requestSearchParamEquals(entries: string[], key: string, expected: string): boolean {
  return entries.some((entry) => {
    const params = new URLSearchParams(entry.startsWith('?') ? entry.slice(1) : entry);
    return params.get(key) === expected;
  });
}

async function seedConversationBrowserApis(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const win = window as any;
    win.__conversationConfirms = [];
    window.confirm = (message?: string) => {
      win.__conversationConfirms.push(String(message || ''));
      return true;
    };
  });
}

async function routeConversationApis(page: Page, state: ConversationsState): Promise<void> {
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

  await page.route(/\/chatbot\/conversations(?:\/[^/?]+(?:\/messages|\/takeover|\/release)?)?(?:\?.*)?$/, async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (url.origin === APP_ORIGIN) {
      await route.continue();
      return;
    }

    const method = request.method();
    const path = url.pathname;

    if (path.endsWith('/chatbot/conversations') && method === 'GET') {
      state.listRequests.push(url.search);
      const keyword = (url.searchParams.get('search') || '').trim().toLowerCase();
      const status = url.searchParams.get('status') || '';
      const fanpageId = url.searchParams.get('fanpageId') || '';
      const pageNumber = Number(url.searchParams.get('page') || '1');
      const limit = Number(url.searchParams.get('limit') || '20');

      let filtered = [...state.conversations];
      if (keyword) {
        filtered = filtered.filter((item) => {
          return [
            item.customerName,
            item.customerPhone,
            item.customerEmail,
            item.conversationCode,
          ]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(keyword));
        });
      }
      if (status) {
        filtered = filtered.filter((item) => item.status === status);
      }
      if (fanpageId) {
        filtered = filtered.filter((item) => item.fanpageId === fanpageId);
      }

      const start = (pageNumber - 1) * limit;
      const data = filtered.slice(start, start + limit);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data,
          total: filtered.length,
          page: pageNumber,
          limit,
        }),
      });
      return;
    }

    const detailMatch = path.match(/\/chatbot\/conversations\/([^/]+)$/);
    if (detailMatch && method === 'GET') {
      const conversation = state.conversations.find((item) => item._id === detailMatch[1]);
      await route.fulfill({
        status: conversation ? 200 : 404,
        contentType: 'application/json',
        body: JSON.stringify(conversation || { message: 'Conversation not found' }),
      });
      return;
    }

    const messagesMatch = path.match(/\/chatbot\/conversations\/([^/]+)\/messages$/);
    if (messagesMatch && method === 'GET') {
      const conversationId = messagesMatch[1];
      state.messageRequests.push(`${conversationId}${url.search}`);
      const messages = state.messagesByConversationId[conversationId] || [];
      const pageNumber = Number(url.searchParams.get('page') || '1');
      const limit = Number(url.searchParams.get('limit') || '50');
      const start = Math.max(0, messages.length - pageNumber * limit);
      const end = messages.length - (pageNumber - 1) * limit;
      const data = messages.slice(start, end);

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data,
          total: messages.length,
          page: pageNumber,
          limit,
        }),
      });
      return;
    }

    if (messagesMatch && method === 'POST') {
      const conversationId = messagesMatch[1];
      const payload = request.postDataJSON() as { content?: string };
      const content = String(payload?.content || '').trim();
      state.sentContents.push(content);
      const createdMessage: Message = {
        _id: `msg-sent-${state.sentContents.length}`,
        conversationId,
        senderType: 'HUMAN_AGENT',
        senderName: 'Ops Demo',
        content,
        status: 'SENT',
        createdAt: nowIso(),
      };
      state.messagesByConversationId[conversationId] = [
        ...(state.messagesByConversationId[conversationId] || []),
        createdMessage,
      ];
      updateConversation(state, conversationId, {
        lastMessageAt: createdMessage.createdAt,
        messageCount: state.messagesByConversationId[conversationId].length,
        status: 'HUMAN_HANDLING',
        assignedAgentId: 'sale-ops-1',
        assignedAgentName: 'Ops Demo',
      });
      await sleep(250);
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          message: createdMessage,
        }),
      });
      return;
    }

    const takeoverMatch = path.match(/\/chatbot\/conversations\/([^/]+)\/takeover$/);
    if (takeoverMatch && method === 'POST') {
      state.takeoverCalls.push(takeoverMatch[1]);
      updateConversation(state, takeoverMatch[1], {
        status: 'HUMAN_HANDLING',
        assignedAgentId: 'sale-ops-1',
        assignedAgentName: 'Ops Demo',
      });
      await sleep(250);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
      return;
    }

    const releaseMatch = path.match(/\/chatbot\/conversations\/([^/]+)\/release$/);
    if (releaseMatch && method === 'POST') {
      state.releaseCalls.push(releaseMatch[1]);
      updateConversation(state, releaseMatch[1], {
        status: 'AI_HANDLING',
        assignedAgentId: '',
        assignedAgentName: '',
      });
      await sleep(250);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
      return;
    }

    if (detailMatch && method === 'PATCH') {
      const conversationId = detailMatch[1];
      const payload = request.postDataJSON() as Partial<Conversation>;
      updateConversation(state, conversationId, payload);
      if (payload.status === 'CLOSED') {
        state.closedConversationIds.push(conversationId);
      }
      await sleep(250);
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
      body: JSON.stringify({ message: 'Unhandled chatbot conversations route' }),
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

async function emitRealtimeEvent(
  page: Page,
  type: 'newMessage' | 'conversationUpdated',
  payload: Record<string, unknown>,
): Promise<void> {
  await page.evaluate(
    ({ eventType, eventPayload }) => {
      const browserWindow = window as any;
      const ng = browserWindow.ng;
      if (!ng?.getComponent) {
        throw new Error('Angular debug helpers are unavailable for realtime event injection');
      }

      const host = document.querySelector('app-conversations');
      if (!host) {
        throw new Error('Conversations component host not found');
      }

      const component = ng.getComponent(host);
      const socketService = component?.socketService;
      if (!socketService) {
        throw new Error('ChatbotSocketService is unavailable on the conversations component');
      }

      if (eventType === 'newMessage') {
        socketService.newMessage$.next(eventPayload);
      } else {
        socketService.conversationUpdated$.next(eventPayload);
      }

      if (typeof ng.applyChanges === 'function') {
        ng.applyChanges(host);
      }
    },
    {
      eventType: type,
      eventPayload: payload,
    },
  );
}

async function applyAngularChanges(page: Page): Promise<void> {
  await page.evaluate(() => {
    const browserWindow = window as any;
    const ng = browserWindow.ng;
    const host = document.querySelector('app-conversations');
    if (!ng?.applyChanges || !host) {
      throw new Error('Angular applyChanges is unavailable for conversations component');
    }
    ng.applyChanges(host);
  });
}

test.describe.serial('B09 conversations browser flows', () => {
  test('B09 OPS conversation filters, selection, autoscroll, and send guards stay coherent', async ({ browser, request }) => {
    test.slow();
    test.setTimeout(240_000);

    const state = buildConversationsState();
    const evidence = await openOpsEvidencePage(
      browser,
      request,
      'conversations_browser_filters',
      async (page) => {
        await seedConversationBrowserApis(page);
        await routeConversationApis(page, state);
      },
    );

    try {
      const searchInput = evidence.page.locator('.list-filters input').first();
      const statusSelect = evidence.page.locator('.list-filters select').first();
      const fanpageSelect = evidence.page.locator('.list-filters select').nth(1);

      await expect(evidence.page.locator('.conv-card')).toHaveCount(3);
      await expect(evidence.page.locator('.chat-panel.no-selection')).toBeVisible();

      const listRequestsBeforeSearch = state.listRequests.length;
      await searchInput.fill('Pham Bao');
      await expect.poll(() => state.listRequests.length).toBeGreaterThan(listRequestsBeforeSearch);
      await expect.poll(() => requestSearchParamEquals(state.listRequests, 'search', 'Pham Bao')).toBe(true);
      await expect(evidence.page.locator('.conv-card')).toHaveCount(1);

      await statusSelect.selectOption('HUMAN_HANDLING');
      await fanpageSelect.selectOption('fp-main');
      await expect.poll(() => requestSearchParamEquals(state.listRequests, 'status', 'HUMAN_HANDLING')).toBe(true);
      await expect.poll(() => requestSearchParamEquals(state.listRequests, 'fanpageId', 'fp-main')).toBe(true);

      const humanCard = evidence.page.locator('.conv-card').filter({ hasText: 'Pham Bao' }).first();
      await humanCard.click();
      await expect.poll(() => {
        return state.messageRequests.some((entry) => {
          const conversationId = entry.replace(/\?.*$/, '');
          const params = new URLSearchParams(entry.includes('?') ? entry.slice(entry.indexOf('?') + 1) : '');
          return conversationId === 'conv-human-main'
            && params.get('page') === '1'
            && params.get('limit') === '50';
        });
      }).toBe(true);
      await expect(evidence.page.locator('.conv-card.selected')).toContainText('Pham Bao');
      await expect(evidence.page.locator('.message-bubble')).toHaveCount(24);
      await expect(evidence.page.locator('.message-bubble').first()).toContainText('Conversation history 1');
      await expect(evidence.page.locator('.message-bubble').last()).toContainText('Conversation history 24');
      await expect(evidence.page.locator('.chat-input textarea')).toBeVisible();
      await expect(evidence.page.locator('.chat-input-disabled')).toHaveCount(0);
      await expect.poll(async () => {
        return evidence.page.locator('.messages-area').evaluate((element) => {
          const area = element as HTMLElement;
          return Math.abs((area.scrollHeight - area.clientHeight) - area.scrollTop);
        });
      }).toBeLessThanOrEqual(2);
      await evidence.step('01-human-filters-selection-scroll');

      await searchInput.fill('');
      await statusSelect.selectOption('');
      await fanpageSelect.selectOption('');
      await expect(evidence.page.locator('.conv-card')).toHaveCount(3);

      const aiCard = evidence.page.locator('.conv-card').filter({ hasText: 'Tran Lan' }).first();
      await aiCard.click();
      await expect(evidence.page.locator('.conv-card.selected')).toContainText('Tran Lan');
      await expect(evidence.page.locator('.message-bubble')).toHaveCount(2);
      await expect(evidence.page.locator('.messages-area')).not.toContainText('Conversation history 24');
      await expect(evidence.page.locator('.chat-input textarea')).toHaveCount(0);
      await expect(evidence.page.locator('.chat-input-disabled')).toHaveCount(1);
      await expect(evidence.page.locator('.chat-header-actions button.primary.small')).toHaveCount(1);
      await evidence.step('02-ai-send-guard');

      evidence.note('Conversations browser flow now proves filter fan-out, selection, message autoscroll, and AI-versus-human send guards.');
      await evidence.finalize('PASS', {
        extraLines: [
          'Conversation filters fan out through search, status, and fanpage params: PASS',
          'Selecting a human-handled conversation loads messages and scrolls to latest content: PASS',
          'AI-handled conversations hide the send box until takeover: PASS',
        ],
      });
    } catch (error) {
      await evidence.finalize('FAIL', { error });
      throw error;
    }
  });

  test('B09 OPS takeover, send, release, and close keep conversation actions coherent', async ({ browser, request }) => {
    test.slow();
    test.setTimeout(240_000);

    const state = buildConversationsState();
    const evidence = await openOpsEvidencePage(
      browser,
      request,
      'conversations_browser_actions',
      async (page) => {
        await seedConversationBrowserApis(page);
        await routeConversationApis(page, state);
      },
    );

    try {
      const aiCard = evidence.page.locator('.conv-card').filter({ hasText: 'Tran Lan' }).first();
      await aiCard.click();
      await expect(evidence.page.locator('.chat-header-actions button.primary.small')).toHaveCount(1);
      await expect(evidence.page.locator('.chat-input textarea')).toHaveCount(0);

      await evidence.page.locator('.chat-header-actions button.primary.small').click();
      await expect.poll(() => state.takeoverCalls).toContain('conv-ai-main');
      await expect(evidence.page.locator('.chat-input textarea')).toBeVisible();
      await expect(evidence.page.locator('.chat-header-actions button.secondary.small')).toHaveCount(1);
      await evidence.step('01-takeover-human-mode');

      const sendBox = evidence.page.locator('.chat-input textarea');
      const sendButton = evidence.page.locator('.chat-input button.primary');
      await sendBox.fill('Ops manual follow-up sent from browser test.');
      await sendButton.click();
      await expect.poll(() => state.sentContents).toContain('Ops manual follow-up sent from browser test.');
      await expect(evidence.page.locator('.message-bubble')).toHaveCount(3);
      await expect(evidence.page.locator('.message-bubble').last()).toContainText('Ops manual follow-up sent from browser test.');
      await evidence.step('02-send-human-message');

      await evidence.page.locator('.chat-header-actions button.secondary.small').click();
      await expect.poll(() => state.releaseCalls).toContain('conv-ai-main');
      await expect(evidence.page.locator('.chat-input textarea')).toHaveCount(0);
      await expect(evidence.page.locator('.chat-header-actions button.primary.small')).toHaveCount(1);
      await evidence.step('03-release-back-to-ai');

      await evidence.page.locator('.chat-header-actions button.ghost.small').click();
      await expect.poll(() => state.closedConversationIds).toContain('conv-ai-main');
      await expect(evidence.page.locator('.chat-header-actions button')).toHaveCount(0);
      await expect(evidence.page.locator('.chat-input textarea')).toHaveCount(0);
      await expect(evidence.page.locator('.chat-input-disabled')).toHaveCount(1);
      await expect.poll(async () => {
        return evidence.page.evaluate(() => {
          return ((window as any).__conversationConfirms || []).length;
        });
      }).toBe(1);
      await evidence.step('04-close-conversation');

      evidence.note('Conversation action flow now proves takeover, manual send fallback, release back to AI, and close confirmation against the current HTTP contract.');
      await evidence.finalize('PASS', {
        extraLines: [
          'Takeover switches AI conversation into HUMAN_HANDLING mode: PASS',
          'Manual send appends a human-agent message and reloads the thread: PASS',
          'Release returns the conversation to AI mode and close removes action controls: PASS',
        ],
      });
    } catch (error) {
      await evidence.finalize('FAIL', { error });
      throw error;
    }
  });

  test('B09 realtime newMessage appends exactly once and keeps the selected thread pinned to latest content', async ({ browser, request }) => {
    test.slow();
    test.setTimeout(240_000);

    const state = buildConversationsState();
    const evidence = await openOpsEvidencePage(
      browser,
      request,
      'conversations_browser_realtime_new_message',
      async (page) => {
        await seedConversationBrowserApis(page);
        await routeConversationApis(page, state);
      },
    );

    try {
      const humanCard = evidence.page.locator('.conv-card').filter({ hasText: 'Pham Bao' }).first();
      await humanCard.click();

      const messagesArea = evidence.page.locator('.messages-area');
      await expect(messagesArea).toBeVisible();
      await expect(evidence.page.locator('.message-bubble')).toHaveCount(24);

      await messagesArea.evaluate((element) => {
        const area = element as HTMLElement;
        area.scrollTop = 0;
      });

      const realtimeMessage: Message = {
        _id: 'msg-human-live-001',
        conversationId: 'conv-human-main',
        senderType: 'CUSTOMER',
        senderName: 'Pham Bao',
        content: 'Realtime websocket message from parent browser.',
        status: 'SENT',
        createdAt: nowIso(),
      };

      state.messagesByConversationId['conv-human-main'] = [
        ...state.messagesByConversationId['conv-human-main'],
        realtimeMessage,
      ];
      updateConversation(state, 'conv-human-main', {
        lastMessageAt: realtimeMessage.createdAt,
        messageCount: state.messagesByConversationId['conv-human-main'].length,
      });

      await emitRealtimeEvent(evidence.page, 'newMessage', {
        conversationId: 'conv-human-main',
        message: realtimeMessage,
      });

      await expect(evidence.page.locator('.message-bubble')).toHaveCount(25);
      await expect(
        evidence.page.locator('.message-bubble').filter({ hasText: realtimeMessage.content }),
      ).toHaveCount(1);

      await emitRealtimeEvent(evidence.page, 'newMessage', {
        conversationId: 'conv-human-main',
        message: realtimeMessage,
      });

      await expect(
        evidence.page.locator('.message-bubble').filter({ hasText: realtimeMessage.content }),
      ).toHaveCount(1);

      await expect.poll(async () => {
        return messagesArea.evaluate((element) => {
          const area = element as HTMLElement;
          return Math.abs((area.scrollHeight - area.clientHeight) - area.scrollTop);
        });
      }).toBeLessThanOrEqual(2);
      await evidence.step('05-realtime-new-message');

      evidence.note('Realtime message flow now proves websocket append-once behavior and keeps the open thread pinned to the latest content.');
      await evidence.finalize('PASS', {
        extraLines: [
          'Realtime newMessage appends the incoming customer message exactly once: PASS',
          'Duplicate realtime payload with the same message id is ignored: PASS',
          'Open thread stays pinned to the latest message after realtime append: PASS',
        ],
      });
    } catch (error) {
      await evidence.finalize('FAIL', { error });
      throw error;
    }
  });

  test('B09 realtime conversationUpdated moves an updated thread to the top and reloads page 1 for a new thread', async ({ browser, request }) => {
    test.slow();
    test.setTimeout(240_000);

    const state = buildConversationsState();
    const evidence = await openOpsEvidencePage(
      browser,
      request,
      'conversations_browser_realtime_list',
      async (page) => {
        await seedConversationBrowserApis(page);
        await routeConversationApis(page, state);
      },
    );

    try {
      const conversationCards = evidence.page.locator('.conv-card');
      await expect(conversationCards).toHaveCount(3);
      await expect(conversationCards.first().locator('.customer-name')).toHaveText('Tran Lan');

      const currentClosedConversation = state.conversations.find((item) => item._id === 'conv-closed-ops');
      if (!currentClosedConversation) {
        throw new Error('Expected conv-closed-ops to exist in the seeded conversation list');
      }

      const existingRealtimeUpdate: Conversation = {
        ...currentClosedConversation,
        status: 'HUMAN_HANDLING',
        assignedAgentId: 'sale-ops-1',
        assignedAgentName: 'Ops Demo',
        messageCount: 4,
        lastMessageAt: nowIso(),
        updatedAt: nowIso(),
      };
      updateConversation(state, 'conv-closed-ops', existingRealtimeUpdate);

      await emitRealtimeEvent(evidence.page, 'conversationUpdated', {
        conversation: existingRealtimeUpdate,
      });

      await expect(conversationCards.first().locator('.customer-name')).toHaveText('Le Chi');
      await expect(conversationCards.first()).toContainText('4 tin');
      await evidence.step('06-realtime-existing-reorder');

      const listRequestCountBeforeReload = state.listRequests.length;
      const newConversation: Conversation = {
        _id: 'conv-realtime-new',
        conversationCode: 'CHAT-004',
        fanpageId: 'fp-main',
        fanpageName: 'Main Enrollment Page',
        platform: 'FACEBOOK',
        platformUserId: 'fb-realtime-new',
        customerName: 'Vo Ngoc',
        customerPhone: '0900000009',
        customerEmail: 'vo.ngoc@example.test',
        status: 'AI_HANDLING',
        assignedAgentId: '',
        assignedAgentName: '',
        lastMessageAt: new Date(Date.now() + 60_000).toISOString(),
        messageCount: 1,
        notes: 'Fresh realtime conversation from websocket list update.',
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      state.conversations = sortConversations([...state.conversations, newConversation]);
      state.messagesByConversationId[newConversation._id] = [
        {
          _id: 'msg-realtime-new-1',
          conversationId: newConversation._id,
          senderType: 'CUSTOMER',
          senderName: 'Vo Ngoc',
          content: 'Tin nhan moi vua vao tu websocket.',
          status: 'SENT',
          createdAt: newConversation.lastMessageAt,
        },
      ];

      await emitRealtimeEvent(evidence.page, 'conversationUpdated', {
        conversation: newConversation,
      });

      await expect.poll(() => state.listRequests.length).toBe(listRequestCountBeforeReload + 1);
      await expect.poll(async () => {
        return evidence.page.evaluate(() => {
          const browserWindow = window as any;
          const component = browserWindow.ng?.getComponent?.(document.querySelector('app-conversations'));
          return component?.conversations?.().length ?? 0;
        });
      }).toBe(4);
      await applyAngularChanges(evidence.page);
      await expect(conversationCards).toHaveCount(4);
      await expect(conversationCards.first().locator('.customer-name')).toHaveText('Vo Ngoc');
      await expect(conversationCards.first()).toContainText('Main Enrollment Page');
      await evidence.step('07-realtime-new-thread-reload');

      evidence.note('Realtime list flow now proves both in-place reorder for an updated thread and full page-1 reload when a brand-new conversation arrives.');
      await evidence.finalize('PASS', {
        extraLines: [
          'Existing conversationUpdated event moves the touched conversation to the top of the list: PASS',
          'Updated list card keeps the new count and current state after realtime reorder: PASS',
          'Brand-new conversationUpdated event forces a page-1 reload and renders the new thread at the top: PASS',
        ],
      });
    } catch (error) {
      await evidence.finalize('FAIL', { error });
      throw error;
    }
  });
});
