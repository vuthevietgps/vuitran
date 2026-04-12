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

type Participant = {
  _id: string;
  fullName: string;
  role: string;
};

type Conversation = {
  _id: string;
  participants: Participant[];
  lastMessage?: string;
  lastMessageAt?: string;
  unreadCount: number;
  conversationKind?: string;
  topicStudentName?: string;
  viewerIsParticipant?: boolean;
};

type Message = {
  _id: string;
  senderId: { _id: string; fullName: string; role: string };
  content: string;
  createdAt: string;
  readAt?: string | null;
};

type DirectoryUser = {
  _id: string;
  fullName: string;
  email: string;
  role: string;
};

type MessageBrowserState = {
  conversations: Conversation[];
  messagesByConversationId: Record<string, Message[]>;
  directoryUsers: DirectoryUser[];
  conversationRequests: string[];
  messageRequests: Array<{ conversationId: string; page: string; limit: string }>;
  readConversationIds: string[];
  sentPayloads: Array<{ receiverId: string; content: string }>;
  nextConversationId: number;
  nextMessageId: number;
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

function buildMessages(
  conversationId: string,
  messages: Array<{ senderId: string; senderName: string; senderRole: string; content: string; offsetMinutes: number }>,
): Message[] {
  return messages.map((entry, index) => ({
    _id: `${conversationId}-msg-${index + 1}`,
    senderId: {
      _id: entry.senderId,
      fullName: entry.senderName,
      role: entry.senderRole,
    },
    content: entry.content,
    createdAt: nowIso(entry.offsetMinutes),
    readAt: entry.senderId === 'ops-1' ? nowIso(entry.offsetMinutes + 1) : undefined,
  }));
}

function buildMessageBrowserState(): MessageBrowserState {
  return {
    conversations: [
      {
        _id: 'conv-support-1',
        participants: [
          { _id: 'parent-1', fullName: 'Nguyen Parent', role: 'PARENT' },
          { _id: 'ops-1', fullName: 'Ops Demo', role: 'OPS' },
        ],
        lastMessage: 'Can trung tam ho tro refund sau buoi hoc bi huy.',
        lastMessageAt: nowIso(-6),
        unreadCount: 1,
        conversationKind: 'PARENT_SUPPORT',
        topicStudentName: 'Minh Anh',
        viewerIsParticipant: true,
      },
      {
        _id: 'conv-direct-1',
        participants: [
          { _id: 'accounting-1', fullName: 'Accounting Demo', role: 'ACCOUNTING' },
          { _id: 'ops-1', fullName: 'Ops Demo', role: 'OPS' },
        ],
        lastMessage: 'Please confirm the wallet refund ledger before 5pm.',
        lastMessageAt: nowIso(-4),
        unreadCount: 2,
        conversationKind: 'DIRECT',
        viewerIsParticipant: true,
      },
    ],
    messagesByConversationId: {
      'conv-support-1': buildMessages('conv-support-1', [
        {
          senderId: 'parent-1',
          senderName: 'Nguyen Parent',
          senderRole: 'PARENT',
          content: 'Can trung tam ho tro refund sau buoi hoc bi huy.',
          offsetMinutes: -6,
        },
        {
          senderId: 'ops-1',
          senderName: 'Ops Demo',
          senderRole: 'OPS',
          content: 'OPS da tiep nhan va dang doi accounting xac nhan ledger.',
          offsetMinutes: -5,
        },
      ]),
      'conv-direct-1': buildMessages('conv-direct-1', [
        {
          senderId: 'accounting-1',
          senderName: 'Accounting Demo',
          senderRole: 'ACCOUNTING',
          content: 'Please confirm the wallet refund ledger before 5pm.',
          offsetMinutes: -8,
        },
        {
          senderId: 'ops-1',
          senderName: 'Ops Demo',
          senderRole: 'OPS',
          content: 'OPS is checking the affected sessions now.',
          offsetMinutes: -7,
        },
        {
          senderId: 'accounting-1',
          senderName: 'Accounting Demo',
          senderRole: 'ACCOUNTING',
          content: 'Need the final parent confirmation note in the ticket.',
          offsetMinutes: -4,
        },
      ]),
    },
    directoryUsers: [
      {
        _id: 'accounting-1',
        fullName: 'Accounting Demo',
        email: 'accounting.demo@school.local',
        role: 'ACCOUNTING',
      },
      {
        _id: 'sale-2',
        fullName: 'Sale Fresh',
        email: 'sale.fresh@school.local',
        role: 'SALE',
      },
    ],
    conversationRequests: [],
    messageRequests: [],
    readConversationIds: [],
    sentPayloads: [],
    nextConversationId: 2,
    nextMessageId: 1,
  };
}

async function routeMessageApis(page: Page, state: MessageBrowserState): Promise<void> {
  await page.route(/\/users\/directory(?:\?.*)?$/, async (route) => {
    const url = new URL(route.request().url());
    if (url.origin === APP_ORIGIN) {
      await route.continue();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(state.directoryUsers),
    });
  });

  await page.route(/\/messages\/send(?:\?.*)?$/, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === APP_ORIGIN) {
      await route.continue();
      return;
    }

    if (request.method() !== 'POST') {
      await route.fulfill({ status: 405, body: 'Unsupported method' });
      return;
    }

    const payload = request.postDataJSON() as { receiverId?: string; content?: string };
    const receiverId = String(payload?.receiverId || '');
    const content = String(payload?.content || '').trim();
    state.sentPayloads.push({ receiverId, content });

    const recipient = state.directoryUsers.find((user) => user._id === receiverId);
    const conversationId = `conv-direct-new-${state.nextConversationId}`;
    state.nextConversationId += 1;

    const createdConversation: Conversation = {
      _id: conversationId,
      participants: [
        {
          _id: receiverId,
          fullName: recipient?.fullName || 'Unknown User',
          role: recipient?.role || 'SALE',
        },
        { _id: 'ops-1', fullName: 'Ops Demo', role: 'OPS' },
      ],
      lastMessage: content,
      lastMessageAt: nowIso(),
      unreadCount: 0,
      conversationKind: 'DIRECT',
      viewerIsParticipant: true,
    };
    state.conversations = [createdConversation, ...state.conversations];
    state.messagesByConversationId[conversationId] = [
      {
        _id: `${conversationId}-msg-${state.nextMessageId}`,
        senderId: { _id: 'ops-1', fullName: 'Ops Demo', role: 'OPS' },
        content,
        createdAt: nowIso(),
        readAt: nowIso(1),
      },
    ];
    state.nextMessageId += 1;

    await sleep(250);
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    });
  });

  await page.route(/\/messages\/conversations(?:\/[^/?]+(?:\/messages|\/read|\/send)?)?(?:\?.*)?$/, async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (url.origin === APP_ORIGIN) {
      await route.continue();
      return;
    }

    const method = request.method();
    const path = url.pathname;

    if (path.endsWith('/messages/conversations') && method === 'GET') {
      state.conversationRequests.push(`${method} ${path}`);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(state.conversations),
      });
      return;
    }

    const readMatch = path.match(/\/messages\/conversations\/([^/]+)\/read$/);
    if (readMatch && method === 'POST') {
      const conversationId = readMatch[1];
      state.readConversationIds.push(conversationId);
      state.conversations = state.conversations.map((conversation) => (
        conversation._id === conversationId
          ? { ...conversation, unreadCount: 0 }
          : conversation
      ));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
      return;
    }

    const sendMatch = path.match(/\/messages\/conversations\/([^/]+)\/send$/);
    if (sendMatch && method === 'POST') {
      const conversationId = sendMatch[1];
      const payload = request.postDataJSON() as { content?: string };
      const content = String(payload?.content || '').trim();
      const message: Message = {
        _id: `${conversationId}-reply-${state.nextMessageId}`,
        senderId: { _id: 'ops-1', fullName: 'Ops Demo', role: 'OPS' },
        content,
        createdAt: nowIso(),
        readAt: nowIso(1),
      };
      state.nextMessageId += 1;
      state.messagesByConversationId[conversationId] = [
        ...(state.messagesByConversationId[conversationId] || []),
        message,
      ];
      state.conversations = state.conversations.map((conversation) => (
        conversation._id === conversationId
          ? {
              ...conversation,
              lastMessage: content,
              lastMessageAt: message.createdAt,
            }
          : conversation
      ));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
      return;
    }

    const messagesMatch = path.match(/\/messages\/conversations\/([^/]+)\/messages$/);
    if (messagesMatch && method === 'GET') {
      const conversationId = messagesMatch[1];
      state.messageRequests.push({
        conversationId,
        page: url.searchParams.get('page') || '',
        limit: url.searchParams.get('limit') || '',
      });
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          messages: state.messagesByConversationId[conversationId] || [],
        }),
      });
      return;
    }

    const detailMatch = path.match(/\/messages\/conversations\/([^/]+)$/);
    if (detailMatch && method === 'GET') {
      const conversation = state.conversations.find((item) => item._id === detailMatch[1]);
      await route.fulfill({
        status: conversation ? 200 : 404,
        contentType: 'application/json',
        body: JSON.stringify(conversation || { message: 'Conversation not found' }),
      });
      return;
    }

    await route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Unhandled messages route' }),
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
  await evidence.page.goto(appUrl('/app/messages'));
  await evidence.page.waitForLoadState('domcontentloaded');
  return evidence;
}

test.describe.serial('B09 internal messages browser flows', () => {
  test('B09 internal messages direct tab selects a conversation, loads messages, and marks it read', async ({ browser, request }) => {
    test.slow();
    test.setTimeout(240_000);

    const state = buildMessageBrowserState();
    const evidence = await openOpsEvidencePage(
      browser,
      request,
      'internal_messages_browser_core',
      async (page) => {
        await routeMessageApis(page, state);
      },
    );

    try {
      const tabs = evidence.page.locator('.list-tabs button');
      const searchInput = evidence.page.locator('.list-search input');
      const conversationCards = evidence.page.locator('.conv-card');

      await expect(conversationCards).toHaveCount(2);
      await tabs.nth(2).click();
      await expect(tabs.nth(2)).toHaveClass(/active/);
      await expect(conversationCards).toHaveCount(1);
      await expect(conversationCards.first()).toContainText('Accounting Demo');

      await searchInput.fill('ledger');
      await expect(conversationCards).toHaveCount(1);
      await expect(conversationCards.first()).toContainText('Accounting Demo');

      await conversationCards.first().click();
      await expect.poll(() => state.messageRequests.some(
        (entry) => entry.conversationId === 'conv-direct-1' && entry.page === '1' && entry.limit === '100',
      )).toBe(true);
      await expect.poll(() => state.readConversationIds).toContain('conv-direct-1');
      await expect(evidence.page.locator('.conv-card.selected')).toContainText('Accounting Demo');
      await expect(evidence.page.locator('.conv-card.selected .unread-badge')).toHaveCount(0);
      await expect(evidence.page.locator('.chat-header')).toContainText('Accounting Demo');
      await expect(evidence.page.locator('.message-bubble')).toHaveCount(3);
      await evidence.step('01-direct-tab-load-mark-read');

      evidence.note('Internal messages now prove direct-tab filtering, conversation selection, message loading, and mark-read clearing against the current browser contract.');
      await evidence.finalize('PASS', {
        extraLines: [
          'Internal/direct conversation list stays coherent under tab and keyword filtering: PASS',
          'Selecting a direct conversation loads messages and clears unread state through the current mark-read endpoint: PASS',
        ],
      });
    } catch (error) {
      await evidence.finalize('FAIL', { error });
      throw error;
    }
  });

  test('B09 internal messages can start a new direct conversation and send the first message', async ({ browser, request }) => {
    test.slow();
    test.setTimeout(240_000);

    const state = buildMessageBrowserState();
    const evidence = await openOpsEvidencePage(
      browser,
      request,
      'internal_messages_browser_new_direct_send',
      async (page) => {
        await routeMessageApis(page, state);
      },
    );

    try {
      const newMessageButton = evidence.page.locator('.page-header button.primary');
      const recipientSelect = evidence.page.locator('.new-chat-recipient select');
      const composer = evidence.page.locator('.chat-input textarea');
      const sendButton = evidence.page.locator('.chat-input button.primary');

      await newMessageButton.click();
      await expect(recipientSelect).toBeVisible();
      await recipientSelect.selectOption('sale-2');
      await composer.fill('Please review the fresh parent lead before noon.');
      await sendButton.click();

      await expect.poll(() => state.sentPayloads.some(
        (entry) => entry.receiverId === 'sale-2'
          && entry.content === 'Please review the fresh parent lead before noon.',
      )).toBe(true);
      await expect.poll(() => state.messageRequests.some(
        (entry) => entry.conversationId.startsWith('conv-direct-new-') && entry.page === '1' && entry.limit === '100',
      )).toBe(true);
      await expect(evidence.page.locator('.conv-card.selected')).toContainText('Sale Fresh');
      await expect(evidence.page.locator('.chat-header')).toContainText('Sale Fresh');
      await expect(evidence.page.locator('.message-bubble')).toHaveCount(1);
      await expect(evidence.page.locator('.message-bubble')).toContainText('Please review the fresh parent lead before noon.');
      await evidence.step('01-new-direct-conversation-send');

      evidence.note('OPS can now prove browser-level creation of a fresh direct conversation and the first outbound message without falling back to API-only evidence.');
      await evidence.finalize('PASS', {
        extraLines: [
          'New direct conversation chooses a fresh recipient instead of reusing an existing thread: PASS',
          'First outbound message persists, reloads the conversation list, and auto-selects the new thread: PASS',
        ],
      });
    } catch (error) {
      await evidence.finalize('FAIL', { error });
      throw error;
    }
  });
});
