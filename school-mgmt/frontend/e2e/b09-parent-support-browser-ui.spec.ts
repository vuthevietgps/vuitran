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

type StudentItem = {
  _id: string;
  fullName: string;
  studentCode?: string;
  parentName?: string;
  productPackage?: { name?: string };
};

type SupportUser = {
  _id: string;
  fullName: string;
  email: string;
  role: string;
};

type Participant = {
  _id: string;
  fullName: string;
  role: string;
};

type SupportConversation = {
  _id: string;
  participants: Participant[];
  lastMessage?: string;
  lastMessageAt?: string;
  unreadCount?: number;
  conversationKind?: string;
  topicStudentId?: string | { _id: string; fullName?: string; studentCode?: string };
  topicStudentName?: string;
};

type SupportMessage = {
  _id: string;
  senderId: { _id: string; fullName: string; role: string };
  senderType?: string;
  content: string;
  createdAt?: string;
  readAt?: string | null;
  handoffTicketId?: string;
  handoffTicketCode?: string;
};

type MessageRequest = {
  conversationId: string;
  page: string;
  limit: string;
};

type SupportSendPayload = {
  receiverId: string;
  content: string;
  contextStudentId?: string;
};

type ParentSupportState = {
  students: StudentItem[];
  supportUsers: SupportUser[];
  conversations: SupportConversation[];
  messagesByConversationId: Record<string, SupportMessage[]>;
  messageRequests: MessageRequest[];
  readConversationIds: string[];
  supportSendPayloads: SupportSendPayload[];
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

function supportMessages(
  conversationId: string,
  rows: Array<{ senderId: string; senderName: string; senderRole: string; content: string; offsetMinutes: number }>,
): SupportMessage[] {
  return rows.map((row, index) => ({
    _id: `${conversationId}-msg-${index + 1}`,
    senderId: {
      _id: row.senderId,
      fullName: row.senderName,
      role: row.senderRole,
    },
    senderType: row.senderRole === 'PARENT' ? 'CUSTOMER' : (row.senderRole === 'AI' ? 'AI' : 'HUMAN'),
    content: row.content,
    createdAt: nowIso(row.offsetMinutes),
    readAt: row.senderRole === 'PARENT' ? undefined : nowIso(row.offsetMinutes + 1),
  }));
}

function buildParentSupportState(): ParentSupportState {
  return {
    students: [
      {
        _id: 'student-1',
        fullName: 'Minh Anh',
        studentCode: 'HS001',
        parentName: 'Nguyen Parent',
        productPackage: { name: 'Math Booster' },
      },
      {
        _id: 'student-2',
        fullName: 'Bao Chau',
        studentCode: 'HS002',
        parentName: 'Nguyen Parent',
        productPackage: { name: 'Science Sprint' },
      },
    ],
    supportUsers: [
      {
        _id: 'ops-1',
        fullName: 'Ops Demo',
        email: 'ops.demo@school.local',
        role: 'OPS',
      },
      {
        _id: 'sale-1',
        fullName: 'Sale Coach',
        email: 'sale.demo@school.local',
        role: 'SALE',
      },
      {
        _id: 'teacher-1',
        fullName: 'Teacher Demo',
        email: 'teacher.demo@school.local',
        role: 'TEACHER',
      },
    ],
    conversations: [
      {
        _id: 'support-conv-1',
        participants: [
          { _id: 'ops-1', fullName: 'Ops Demo', role: 'OPS' },
          { _id: 'parent-1', fullName: 'Nguyen Parent', role: 'PARENT' },
        ],
        lastMessage: 'Ops updated the progress summary after the latest class.',
        lastMessageAt: nowIso(-8),
        unreadCount: 2,
        conversationKind: 'PARENT_SUPPORT',
        topicStudentId: { _id: 'student-1', fullName: 'Minh Anh', studentCode: 'HS001' },
        topicStudentName: 'Minh Anh',
      },
      {
        _id: 'support-conv-2',
        participants: [
          { _id: 'sale-1', fullName: 'Sale Coach', role: 'SALE' },
          { _id: 'parent-1', fullName: 'Nguyen Parent', role: 'PARENT' },
        ],
        lastMessage: 'Sale confirmed the make-up schedule for next week.',
        lastMessageAt: nowIso(-4),
        unreadCount: 1,
        conversationKind: 'PARENT_SUPPORT',
        topicStudentId: { _id: 'student-2', fullName: 'Bao Chau', studentCode: 'HS002' },
        topicStudentName: 'Bao Chau',
      },
    ],
    messagesByConversationId: {
      'support-conv-1': supportMessages('support-conv-1', [
        {
          senderId: 'parent-1',
          senderName: 'Nguyen Parent',
          senderRole: 'PARENT',
          content: 'Can trung tam cap nhat giup tien do hoc tap cua Minh Anh.',
          offsetMinutes: -10,
        },
        {
          senderId: 'ops-1',
          senderName: 'Ops Demo',
          senderRole: 'OPS',
          content: 'Ops updated the progress summary after the latest class.',
          offsetMinutes: -8,
        },
      ]),
      'support-conv-2': supportMessages('support-conv-2', [
        {
          senderId: 'parent-1',
          senderName: 'Nguyen Parent',
          senderRole: 'PARENT',
          content: 'Can doi lich cho Bao Chau sang thu Nam tuan sau.',
          offsetMinutes: -7,
        },
        {
          senderId: 'sale-1',
          senderName: 'Sale Coach',
          senderRole: 'SALE',
          content: 'Sale confirmed the make-up schedule for next week.',
          offsetMinutes: -4,
        },
      ]),
    },
    messageRequests: [],
    readConversationIds: [],
    supportSendPayloads: [],
    nextConversationId: 3,
    nextMessageId: 1,
  };
}

async function routeParentSupportApis(page: Page, state: ParentSupportState): Promise<void> {
  await page.route(/\/students(?:\?.*)?$/, async (route) => {
    const url = new URL(route.request().url());
    if (url.origin === APP_ORIGIN) {
      await route.continue();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(state.students),
    });
  });

  await page.route(/\/users\/directory(?:\?.*)?$/, async (route) => {
    const url = new URL(route.request().url());
    if (url.origin === APP_ORIGIN) {
      await route.continue();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(state.supportUsers),
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

    const payload = request.postDataJSON() as { receiverId?: string; content?: string; contextStudentId?: string };
    const receiverId = String(payload?.receiverId || '');
    const content = String(payload?.content || '').trim();
    const contextStudentId = payload?.contextStudentId ? String(payload.contextStudentId) : undefined;
    state.supportSendPayloads.push({
      receiverId,
      content,
      contextStudentId,
    });

    const support = state.supportUsers.find((user) => user._id === receiverId);
    const student = state.students.find((item) => item._id === contextStudentId);
    const conversationId = `support-conv-${state.nextConversationId}`;
    state.nextConversationId += 1;

    const createdConversation: SupportConversation = {
      _id: conversationId,
      participants: [
        {
          _id: receiverId,
          fullName: support?.fullName || 'Support Agent',
          role: support?.role || 'OPS',
        },
        { _id: 'parent-1', fullName: 'Nguyen Parent', role: 'PARENT' },
      ],
      lastMessage: content,
      lastMessageAt: nowIso(),
      unreadCount: 0,
      conversationKind: 'PARENT_SUPPORT',
      topicStudentId: student
        ? { _id: student._id, fullName: student.fullName, studentCode: student.studentCode }
        : undefined,
      topicStudentName: student?.fullName,
    };
    state.conversations = [createdConversation, ...state.conversations];
    state.messagesByConversationId[conversationId] = [
      {
        _id: `${conversationId}-msg-${state.nextMessageId}`,
        senderId: { _id: 'parent-1', fullName: 'Nguyen Parent', role: 'PARENT' },
        senderType: 'CUSTOMER',
        content,
        createdAt: nowIso(),
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
      const message: SupportMessage = {
        _id: `${conversationId}-reply-${state.nextMessageId}`,
        senderId: { _id: 'parent-1', fullName: 'Nguyen Parent', role: 'PARENT' },
        senderType: 'CUSTOMER',
        content,
        createdAt: nowIso(),
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
      body: JSON.stringify({ message: 'Unhandled parent support route' }),
    });
  });
}

async function openParentEvidencePage(
  browser: Browser,
  request: APIRequestContext,
  scenario: string,
  setup: (page: Page) => Promise<void> | void,
): Promise<BatchEvidenceSession> {
  const parentSession = await loginAsRole(request, 'parent');
  const evidence = await createBatchEvidenceContext(browser, {
    batchId: 'B09',
    scenario,
    runDate: RUN_DATE,
  });
  await applySessionCookies(evidence.context, parentSession);
  await setup(evidence.page);
  await evidence.page.goto(appUrl('/app/parent-chat'));
  await evidence.page.waitForLoadState('domcontentloaded');
  return evidence;
}

test.describe.serial('B09 parent support chat browser flows', () => {
  test('B09 parent support chat picks the correct student/support context and reuses the matching thread', async ({ browser, request }) => {
    test.slow();
    test.setTimeout(240_000);

    const state = buildParentSupportState();
    const evidence = await openParentEvidencePage(
      browser,
      request,
      'parent_support_browser_context',
      async (page) => {
        await routeParentSupportApis(page, state);
      },
    );

    try {
      const selects = evidence.page.locator('.setup-card select');
      const studentSelect = selects.nth(0);
      const supportSelect = selects.nth(1);

      await expect(evidence.page.locator('.conversation-item.active')).toContainText('Ops Demo');
      await studentSelect.selectOption('student-2');
      await supportSelect.selectOption('sale-1');

      await expect.poll(() => state.messageRequests.some(
        (entry) => entry.conversationId === 'support-conv-2' && entry.page === '1' && entry.limit === '100',
      )).toBe(true);
      await expect.poll(() => state.readConversationIds).toContain('support-conv-2');
      await expect(evidence.page.locator('.conversation-item.active')).toContainText('Sale Coach');
      await expect(evidence.page.locator('.conversation-item.active')).toContainText('Bao Chau');
      await expect(evidence.page.locator('.context-card').first()).toContainText('Bao Chau');
      await expect(evidence.page.locator('.context-card').first()).toContainText('HS002');
      await expect(evidence.page.locator('.support-card')).toContainText('Sale Coach');
      await expect(evidence.page.locator('.chat-header')).toContainText('Sale Coach');
      await expect(evidence.page.locator('.header-chip').first()).toContainText('HS002');
      await expect(evidence.page.locator('.header-chip').nth(1)).toContainText('Sale');
      await expect(evidence.page.locator('.message .bubble')).toHaveCount(2);
      await evidence.step('01-student-support-context-selection');

      evidence.note('Parent support chat now proves student/support selection, context card refresh, and matching-thread reuse with real browser state.');
      await evidence.finalize('PASS', {
        extraLines: [
          'Selecting student and support rewires the active context to the matching support thread: PASS',
          'Matching parent-support conversation reloads messages and clears unread state through the current mark-read contract: PASS',
        ],
      });
    } catch (error) {
      await evidence.finalize('FAIL', { error });
      throw error;
    }
  });

  test('B09 parent support chat quick actions, send, and start-fresh keep the compose flow coherent', async ({ browser, request }) => {
    test.slow();
    test.setTimeout(240_000);

    const state = buildParentSupportState();
    const evidence = await openParentEvidencePage(
      browser,
      request,
      'parent_support_browser_compose',
      async (page) => {
        await routeParentSupportApis(page, state);
      },
    );

    try {
      const startFreshButton = evidence.page.locator('.page-header button.secondary');
      const selects = evidence.page.locator('.setup-card select');
      const studentSelect = selects.nth(0);
      const supportSelect = selects.nth(1);
      const composer = evidence.page.locator('.composer textarea');
      const quickAction = evidence.page.locator('.quick-chip').first();
      const sendButton = evidence.page.locator('.composer button.primary');

      await expect(startFreshButton).toBeVisible();
      await startFreshButton.click();
      await expect(evidence.page.locator('.conversation-item.active')).toHaveCount(0);
      await expect(composer).toHaveValue('');
      await expect(evidence.page.locator('.message-list')).toHaveCount(0);
      await evidence.step('01-start-fresh-clears-current-thread');

      await studentSelect.selectOption('student-2');
      await supportSelect.selectOption('ops-1');
      await quickAction.click();
      const draftValue = await composer.inputValue();
      expect(draftValue.length).toBeGreaterThan(20);
      await sendButton.click();

      await expect.poll(() => state.supportSendPayloads.some(
        (entry) => entry.receiverId === 'ops-1'
          && entry.contextStudentId === 'student-2'
          && entry.content === draftValue,
      )).toBe(true);
      await expect.poll(() => state.messageRequests.some(
        (entry) => entry.conversationId === 'support-conv-3' && entry.page === '1' && entry.limit === '100',
      )).toBe(true);
      await expect(evidence.page.locator('.conversation-item.active')).toContainText('Ops Demo');
      await expect(evidence.page.locator('.conversation-item.active')).toContainText('Bao Chau');
      await expect(evidence.page.locator('.chat-header')).toContainText('Ops Demo');
      await expect(evidence.page.locator('.chat-header')).toContainText('Bao Chau');
      await expect(evidence.page.locator('.message .bubble')).toHaveCount(1);
      await expect(evidence.page.locator('.message .bubble')).toContainText(draftValue);
      await evidence.step('02-quick-action-send-new-thread');

      evidence.note('Parent support chat now proves start-fresh reset, quick-action draft seeding, and the new support-message branch that creates and selects a fresh thread.');
      await evidence.finalize('PASS', {
        extraLines: [
          'Start-fresh clears the active thread without corrupting the selected student/support context: PASS',
          'Quick actions can seed the composer and the first support send creates then selects the correct parent-support conversation: PASS',
        ],
      });
    } catch (error) {
      await evidence.finalize('FAIL', { error });
      throw error;
    }
  });
});
