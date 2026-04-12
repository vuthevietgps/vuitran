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
  senderType?: string;
  content: string;
  createdAt: string;
  readAt?: string | null;
};

type State = {
  conversations: Conversation[];
  messagesByConversationId: Record<string, Message[]>;
  suggestionRequests: string[];
  sendPayloads: Array<{ conversationId: string; content: string }>;
  messageRequests: Array<{ conversationId: string; page: string; limit: string }>;
  readConversationIds: string[];
  nextMessageId: number;
};

function appUrl(path: string): string {
  return new URL(path, APP_BASE_URL).toString();
}

function nowIso(offsetMinutes = 0): string {
  return new Date(Date.now() + (offsetMinutes * 60 * 1000)).toISOString();
}

function buildState(): State {
  return {
    conversations: [
      {
        _id: 'conv-support-ai-1',
        participants: [
          { _id: 'parent-1', fullName: 'Nguyen Parent', role: 'PARENT' },
          { _id: 'ops-1', fullName: 'Ops Demo', role: 'OPS' },
        ],
        lastMessage: 'Con co bai tap nao can nop trong tuan nay khong?',
        lastMessageAt: nowIso(-5),
        unreadCount: 1,
        conversationKind: 'PARENT_SUPPORT',
        topicStudentName: 'Minh Anh',
        viewerIsParticipant: true,
      },
    ],
    messagesByConversationId: {
      'conv-support-ai-1': [
        {
          _id: 'conv-support-ai-1-msg-1',
          senderId: { _id: 'parent-1', fullName: 'Nguyen Parent', role: 'PARENT' },
          senderType: 'CUSTOMER',
          content: 'Con co bai tap nao can nop trong tuan nay khong?',
          createdAt: nowIso(-5),
        },
      ],
    },
    suggestionRequests: [],
    sendPayloads: [],
    messageRequests: [],
    readConversationIds: [],
    nextMessageId: 2,
  };
}

async function routeMessageApis(page: Page, state: State): Promise<void> {
  await page.route(/\/users\/directory(?:\?.*)?$/, async (route) => {
    const url = new URL(route.request().url());
    if (url.origin === APP_ORIGIN) {
      await route.continue();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });

  await page.route(/\/messages\/conversations(?:\/[^/?]+(?:\/messages|\/read|\/send|\/ai-suggest)?)?(?:\?.*)?$/, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === APP_ORIGIN) {
      await route.continue();
      return;
    }

    const method = request.method();
    const path = url.pathname;

    if (path.endsWith('/messages/conversations') && method === 'GET') {
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

    const suggestMatch = path.match(/\/messages\/conversations\/([^/]+)\/ai-suggest$/);
    if (suggestMatch && method === 'POST') {
      const conversationId = suggestMatch[1];
      state.suggestionRequests.push(conversationId);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          conversationId,
          previewOnly: true,
          content: 'Goi y AI: Minh Anh da hoan thanh bai tap tren lop. Anh/chi vui long giup con nop phieu bai tap phan fractions truoc thu Sau.',
        }),
      });
      return;
    }

    const sendMatch = path.match(/\/messages\/conversations\/([^/]+)\/send$/);
    if (sendMatch && method === 'POST') {
      const conversationId = sendMatch[1];
      const payload = request.postDataJSON() as { content?: string };
      const content = String(payload?.content || '').trim();
      state.sendPayloads.push({ conversationId, content });
      const message: Message = {
        _id: `${conversationId}-reply-${state.nextMessageId}`,
        senderId: { _id: 'ops-1', fullName: 'Ops Demo', role: 'OPS' },
        senderType: 'USER',
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
          ? { ...conversation, lastMessage: content, lastMessageAt: message.createdAt }
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

test.describe.serial('B09 messages AI suggest preview-only browser', () => {
  test('B09 support chat AI suggest keeps the reply as preview-only until the agent explicitly sends it', async ({ browser, request }) => {
    test.slow();
    test.setTimeout(240_000);

    const state = buildState();
    const evidence = await openOpsEvidencePage(
      browser,
      request,
      'ai_suggest_preview_only_browser',
      async (page) => {
        await routeMessageApis(page, state);
      },
    );

    try {
      await evidence.page.locator('.list-tabs button').nth(1).click();
      await evidence.page.locator('.conv-card').first().click();

      await expect.poll(() => state.messageRequests.some(
        (entry) => entry.conversationId === 'conv-support-ai-1' && entry.page === '1' && entry.limit === '100',
      )).toBe(true);
      await expect.poll(() => state.readConversationIds).toContain('conv-support-ai-1');
      await expect(evidence.page.locator('.message-bubble')).toHaveCount(1);
      await expect(evidence.page.getByTestId('messages-ai-suggest-preview')).toHaveCount(0);
      await expect(evidence.page.locator('.chat-input textarea')).toHaveValue('');

      await evidence.page.getByTestId('messages-ai-suggest-button').click();
      await expect.poll(() => state.suggestionRequests).toContain('conv-support-ai-1');
      await expect(evidence.page.getByTestId('messages-ai-suggest-preview')).toContainText('Minh Anh da hoan thanh bai tap tren lop');
      await expect(evidence.page.locator('.message-bubble')).toHaveCount(1);
      await expect.poll(() => state.sendPayloads.length).toBe(0);
      await expect(evidence.page.locator('.chat-input textarea')).toHaveValue('');
      await evidence.step('01-ai-suggest-preview-only');

      await evidence.page.getByTestId('messages-ai-suggest-apply').click();
      await expect(evidence.page.locator('.chat-input textarea')).toHaveValue(
        'Goi y AI: Minh Anh da hoan thanh bai tap tren lop. Anh/chi vui long giup con nop phieu bai tap phan fractions truoc thu Sau.',
      );
      await expect(evidence.page.locator('.message-bubble')).toHaveCount(1);

      await evidence.page.locator('.chat-input button.primary').click();
      await expect.poll(() => state.sendPayloads).toContainEqual({
        conversationId: 'conv-support-ai-1',
        content: 'Goi y AI: Minh Anh da hoan thanh bai tap tren lop. Anh/chi vui long giup con nop phieu bai tap phan fractions truoc thu Sau.',
      });
      await expect(evidence.page.locator('.message-bubble')).toHaveCount(2);
      await expect(evidence.page.locator('.message-bubble').last()).toContainText('Anh/chi vui long giup con nop phieu bai tap');
      await evidence.step('02-agent-sends-after-explicit-apply');

      evidence.note('Messages support view now proves AI suggestion is preview-only first, then only reaches the conversation after the agent explicitly applies and sends it.');
      await evidence.finalize('PASS', {
        extraLines: [
          'Clicking Goi y AI creates a preview draft and does not append any message or fire a send call: PASS',
          'Only after the agent applies the draft and presses Gui does exactly one outbound support reply appear in the thread: PASS',
        ],
      });
    } catch (error) {
      await evidence.finalize('FAIL', { error });
      throw error;
    }
  });
});
