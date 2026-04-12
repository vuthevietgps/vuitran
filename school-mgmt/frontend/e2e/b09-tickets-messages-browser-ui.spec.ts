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

type TicketItem = {
  _id: string;
  ticketCode: string;
  type: string;
  status: string;
  priority: string;
  subject: string;
  description: string;
  createdBy: { _id: string; fullName: string; email: string; role: string };
  createdByRole: string;
  assignedTo?: { _id: string; fullName: string; email: string };
  sourceConversationId?: string;
  studentId?: { _id: string; fullName: string; studentCode: string };
  resolution?: {
    outcome: string;
    summary: string;
    refundAmount: number;
    refundLedgerEntryId?: string;
    resolvedBy?: { _id: string; fullName: string };
    resolvedAt?: string;
  };
  attachments: string[];
  dueDate?: string;
  isOverdue: boolean;
  createdAt: string;
  updatedAt: string;
};

type TicketComment = {
  _id: string;
  ticketId: string;
  userId: { _id: string; fullName: string; email: string; role: string };
  content: string;
  attachments: string[];
  isInternal: boolean;
  createdAt: string;
};

type Conversation = {
  _id: string;
  participants: Array<{ _id: string; fullName: string; role: string }>;
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

type TicketMessagesState = {
  currentOpsId: string;
  allTickets: TicketItem[];
  assignedTickets: TicketItem[];
  myTickets: TicketItem[];
  commentsByTicketId: Record<string, TicketComment[]>;
  conversations: Conversation[];
  messagesByConversationId: Record<string, Message[]>;
  ticketRequests: string[];
  messageReadIds: string[];
  createPayloads: Array<{ type: string; subject: string; description: string; priority: string }>;
  commentPayloads: Array<{ ticketId: string; content: string; isInternal: boolean }>;
  resolvePayloads: Array<{ ticketId: string; outcome: string; summary: string; refundAmount: number }>;
  actionRequests: string[];
  closeFailuresByTicketId: Record<string, string>;
  nextTicketId: number;
  nextCommentId: number;
};

function appUrl(path: string): string {
  return new URL(path, APP_BASE_URL).toString();
}

function nowIso(): string {
  return new Date().toISOString();
}

function paginate<T>(items: T[]) {
  return {
    data: items,
    meta: {
      total: items.length,
      page: 1,
      limit: 20,
      totalPages: 1,
    },
  };
}

function buildTicketMessagesState(currentOpsId = 'ops-1'): TicketMessagesState {
  const sourceTicket: TicketItem = {
    _id: 'ticket-support-1',
    ticketCode: 'TKT-OPS-001',
    type: 'REFUND_REQUEST',
    status: 'IN_PROGRESS',
    priority: 'HIGH',
    subject: 'Can giai quyet refund cho buoi hoc bi huy',
    description: 'Phu huynh yeu cau refund sau khi buoi hoc bi huy do giao vien nghi.',
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
    sourceConversationId: 'conv-support-1',
    studentId: {
      _id: 'student-1',
      fullName: 'Minh Anh',
      studentCode: 'HS001',
    },
    attachments: [],
    dueDate: nowIso(),
    isOverdue: true,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  return {
    currentOpsId,
    allTickets: [
      sourceTicket,
      {
        ...sourceTicket,
        _id: 'ticket-all-2',
        ticketCode: 'TKT-ALL-002',
        subject: 'Khieu nai lich hoc can dieu chinh',
        type: 'SCHEDULE_ISSUE',
        status: 'OPEN',
        priority: 'MEDIUM',
        isOverdue: false,
        sourceConversationId: '',
      },
    ],
    assignedTickets: [sourceTicket],
    myTickets: [
      {
        ...sourceTicket,
        _id: 'ticket-my-1',
        ticketCode: 'TKT-MY-001',
        subject: 'Ticket do OPS tao de theo doi noi bo',
        createdBy: {
          _id: currentOpsId,
          fullName: 'Ops Demo',
          email: 'ops.demo@school.local',
          role: 'OPS',
        },
        createdByRole: 'OPS',
        isOverdue: false,
      },
    ],
    commentsByTicketId: {
      'ticket-support-1': [
        {
          _id: 'comment-1',
          ticketId: 'ticket-support-1',
          userId: {
            _id: 'parent-1',
            fullName: 'Nguyen Phu Huynh',
            email: 'parent.demo@school.local',
            role: 'PARENT',
          },
          content: 'Nho trung tam ho tro refund cho buoi hoc da huy.',
          attachments: [],
          isInternal: false,
          createdAt: nowIso(),
        },
      ],
    },
    conversations: [
      {
        _id: 'conv-support-1',
        participants: [
          { _id: 'parent-1', fullName: 'Nguyen Phu Huynh', role: 'PARENT' },
          { _id: 'ops-1', fullName: 'Ops Demo', role: 'OPS' },
        ],
        lastMessage: 'Nho trung tam ho tro refund cho buoi hoc da huy.',
        lastMessageAt: nowIso(),
        unreadCount: 2,
        conversationKind: 'PARENT_SUPPORT',
        topicStudentName: 'Minh Anh',
        viewerIsParticipant: true,
      },
      {
        _id: 'conv-direct-1',
        participants: [
          { _id: 'sale-1', fullName: 'Sale Demo', role: 'SALE' },
          { _id: 'ops-1', fullName: 'Ops Demo', role: 'OPS' },
        ],
        lastMessage: 'Can update lead nay gap.',
        lastMessageAt: nowIso(),
        unreadCount: 0,
        conversationKind: 'DIRECT',
        viewerIsParticipant: true,
      },
    ],
    messagesByConversationId: {
      'conv-support-1': [
        {
          _id: 'msg-1',
          senderId: { _id: 'parent-1', fullName: 'Nguyen Phu Huynh', role: 'PARENT' },
          content: 'Nho trung tam ho tro refund cho buoi hoc da huy.',
          createdAt: nowIso(),
        },
        {
          _id: 'msg-2',
          senderId: { _id: 'ops-1', fullName: 'Ops Demo', role: 'OPS' },
          content: 'OPS da tiep nhan va dang kiem tra ticket refund.',
          createdAt: nowIso(),
          readAt: nowIso(),
        },
      ],
    },
    ticketRequests: [],
    messageReadIds: [],
    createPayloads: [],
    commentPayloads: [],
    resolvePayloads: [],
    actionRequests: [],
    closeFailuresByTicketId: {},
    nextTicketId: 2,
    nextCommentId: 2,
  };
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function updateTicketCollections(
  state: TicketMessagesState,
  ticketId: string,
  updater: (ticket: TicketItem) => TicketItem,
) {
  const updateList = (items: TicketItem[]) =>
    items.map((ticket) => (ticket._id === ticketId ? updater(ticket) : ticket));

  state.allTickets = updateList(state.allTickets);
  state.assignedTickets = updateList(state.assignedTickets);
  state.myTickets = updateList(state.myTickets);
}

async function routeTicketApis(page: Page, state: TicketMessagesState): Promise<void> {
  await page.route(/\/tickets(?:\/[^/?]+(?:\/comments|\/start|\/request-info|\/resolve|\/close|\/cancel|\/reopen)?|\/stats|\/my-tickets|\/assigned-to-me)?(?:\?.*)?$/, async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (url.origin === APP_ORIGIN) {
      await route.continue();
      return;
    }

    const method = request.method();
    const path = url.pathname;
    state.ticketRequests.push(`${method} ${path}${url.search}`);

    if (path.endsWith('/tickets/stats') && method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          byStatus: [
            { _id: 'OPEN', count: 1 },
            { _id: 'IN_PROGRESS', count: 1 },
            { _id: 'WAITING_INFO', count: 0 },
            { _id: 'RESOLVED', count: 0 },
            { _id: 'CLOSED', count: 0 },
          ],
          byType: [],
          byPriority: [],
          overdueCount: 1,
        }),
      });
      return;
    }

    if (path.endsWith('/tickets/assigned-to-me') && method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(paginate(clone(state.assignedTickets))),
      });
      return;
    }

    if (path.endsWith('/tickets/my-tickets') && method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(paginate(clone(state.myTickets))),
      });
      return;
    }

    if (path.endsWith('/tickets') && method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(paginate(clone(state.allTickets))),
      });
      return;
    }

    if (path.endsWith('/tickets') && method === 'POST') {
      const body = request.postDataJSON() as {
        type: string;
        subject: string;
        description: string;
        priority: string;
      };
      state.createPayloads.push(body);

      const created: TicketItem = {
        _id: `ticket-created-${state.nextTicketId}`,
        ticketCode: `TKT-CREATE-00${state.nextTicketId}`,
        type: body.type,
        status: 'OPEN',
        priority: body.priority,
        subject: body.subject,
        description: body.description,
        createdBy: {
          _id: state.currentOpsId,
          fullName: 'Ops Demo',
          email: 'ops.demo@school.local',
          role: 'OPS',
        },
        createdByRole: 'OPS',
        attachments: [],
        isOverdue: false,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      state.nextTicketId += 1;
      state.myTickets = [created, ...state.myTickets];
      state.allTickets = [created, ...state.allTickets];
      state.commentsByTicketId[created._id] = [];

      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(created),
      });
      return;
    }

    const commentsMatch = path.match(/\/tickets\/([^/]+)\/comments$/);
    if (commentsMatch && method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(clone(state.commentsByTicketId[commentsMatch[1]] || [])),
      });
      return;
    }

    if (commentsMatch && method === 'POST') {
      const ticketId = commentsMatch[1];
      const body = request.postDataJSON() as { content: string; isInternal?: boolean };
      state.commentPayloads.push({
        ticketId,
        content: body.content,
        isInternal: Boolean(body.isInternal),
      });

      const comment: TicketComment = {
        _id: `comment-created-${state.nextCommentId}`,
        ticketId,
        userId: {
          _id: state.currentOpsId,
          fullName: 'Ops Demo',
          email: 'ops.demo@school.local',
          role: 'OPS',
        },
        content: body.content,
        attachments: [],
        isInternal: Boolean(body.isInternal),
        createdAt: nowIso(),
      };
      state.nextCommentId += 1;
      state.commentsByTicketId[ticketId] = [...(state.commentsByTicketId[ticketId] || []), comment];

      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(comment),
      });
      return;
    }

    const actionMatch = path.match(/\/tickets\/([^/]+)\/(start|request-info|resolve|close|cancel|reopen)$/);
    if (actionMatch && method === 'POST') {
      const [, ticketId, action] = actionMatch;
      state.actionRequests.push(`${action}:${ticketId}`);

      if (action === 'start') {
        updateTicketCollections(state, ticketId, (ticket) => ({
          ...ticket,
          status: 'IN_PROGRESS',
          assignedTo: {
            _id: state.currentOpsId,
            fullName: 'Ops Demo',
            email: 'ops.demo@school.local',
          },
          updatedAt: nowIso(),
        }));
      } else if (action === 'request-info') {
        updateTicketCollections(state, ticketId, (ticket) => ({
          ...ticket,
          status: 'WAITING_INFO',
          updatedAt: nowIso(),
        }));
      } else if (action === 'resolve') {
        const body = request.postDataJSON() as {
          outcome: string;
          summary: string;
          refundAmount?: number;
        };
        state.resolvePayloads.push({
          ticketId,
          outcome: body.outcome,
          summary: body.summary,
          refundAmount: body.refundAmount ?? 0,
        });
        updateTicketCollections(state, ticketId, (ticket) => ({
          ...ticket,
          status: 'RESOLVED',
          resolution: {
            outcome: body.outcome,
            summary: body.summary,
            refundAmount: body.refundAmount ?? 0,
            refundLedgerEntryId: (body.refundAmount ?? 0) > 0 ? `ledger-refund-${ticketId}` : undefined,
            resolvedBy: {
              _id: state.currentOpsId,
              fullName: 'Ops Demo',
            },
            resolvedAt: nowIso(),
          },
          updatedAt: nowIso(),
        }));
      } else if (action === 'close') {
        const closeFailureMessage = state.closeFailuresByTicketId[ticketId];
        if (closeFailureMessage) {
          await route.fulfill({
            status: 400,
            contentType: 'application/json',
            body: JSON.stringify({ message: closeFailureMessage }),
          });
          return;
        }
        updateTicketCollections(state, ticketId, (ticket) => ({
          ...ticket,
          status: 'CLOSED',
          updatedAt: nowIso(),
        }));
      } else if (action === 'cancel') {
        updateTicketCollections(state, ticketId, (ticket) => ({
          ...ticket,
          status: 'CANCELLED',
          updatedAt: nowIso(),
        }));
      } else if (action === 'reopen') {
        updateTicketCollections(state, ticketId, (ticket) => ({
          ...ticket,
          status: 'OPEN',
          updatedAt: nowIso(),
        }));
      }

      const updated = [...state.allTickets, ...state.assignedTickets, ...state.myTickets].find(
        (ticket) => ticket._id === ticketId,
      );
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(updated),
      });
      return;
    }

    const detailMatch = path.match(/\/tickets\/([^/]+)$/);
    if (detailMatch && method === 'GET') {
      const ticket = [...state.allTickets, ...state.assignedTickets, ...state.myTickets].find(
        (item) => item._id === detailMatch[1],
      );
      await route.fulfill({
        status: ticket ? 200 : 404,
        contentType: 'application/json',
        body: JSON.stringify(ticket || { message: 'Ticket not found' }),
      });
      return;
    }

    await route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Unhandled ticket route' }),
    });
  });
}

async function routeMessageApis(page: Page, state: TicketMessagesState): Promise<void> {
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

  await page.route(/\/messages\/conversations(?:\/[^/?]+(?:\/messages|\/read)?)?(?:\?.*)?$/, async (route) => {
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
      state.messageReadIds.push(readMatch[1]);
      state.conversations = state.conversations.map((item) =>
        item._id === readMatch[1] ? { ...item, unreadCount: 0 } : item,
      );
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
      return;
    }

    const messagesMatch = path.match(/\/messages\/conversations\/([^/]+)\/messages$/);
    if (messagesMatch && method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          messages: state.messagesByConversationId[messagesMatch[1]] || [],
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
      body: JSON.stringify({ message: 'Unhandled message route' }),
    });
  });
}

async function openOpsEvidencePage(
  browser: Browser,
  request: APIRequestContext,
  scenario: string,
  path: string,
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
  await evidence.page.goto(appUrl(path));
  await evidence.page.waitForLoadState('domcontentloaded');
  return evidence;
}

test.describe.serial('B09 tickets and messages browser flows', () => {
  test('B09 OPS ticket tabs switch between assigned, all, and my lists cleanly', async ({ browser, request }) => {
    test.slow();
    test.setTimeout(240_000);

    const state = buildTicketMessagesState();
    const evidence = await openOpsEvidencePage(
      browser,
      request,
      'tickets_browser_tabs',
      '/app/tickets',
      async (page) => {
        await routeTicketApis(page, state);
      },
    );

    try {
      const tabAll = evidence.page.getByTestId('tickets-tab-all');
      const tabAssigned = evidence.page.getByTestId('tickets-tab-assigned');
      const tabMy = evidence.page.getByTestId('tickets-tab-my');

      await expect(evidence.page.getByTestId('tickets-tabs')).toBeVisible();
      await expect(tabAssigned).toHaveClass(/active/);
      await expect(evidence.page.getByTestId('tickets-list')).toContainText('TKT-OPS-001');

      await tabAll.click();
      await expect(tabAll).toHaveClass(/active/);
      await expect.poll(() => state.ticketRequests.some((entry) => entry.includes('GET /tickets?'))).toBe(true);
      await expect(evidence.page.getByTestId('tickets-list')).toContainText('TKT-ALL-002');

      await tabMy.click();
      await expect(tabMy).toHaveClass(/active/);
      await expect.poll(() => state.ticketRequests.some((entry) => entry.includes('GET /tickets/my-tickets'))).toBe(true);
      await expect(evidence.page.getByTestId('tickets-list')).toContainText('TKT-MY-001');
      await evidence.step('01-ticket-tabs-switch');

      evidence.note('OPS ticket tabs now prove assigned/all/my switching against the current query contract.');
      await evidence.finalize('PASS', {
        extraLines: [
          'OPS sees and switches assigned/all/my tabs: PASS',
          'Each tab refreshes the matching ticket list surface: PASS',
        ],
      });
    } catch (error) {
      await evidence.finalize('FAIL', { error });
      throw error;
    }
  });

  test('B09 ticketId deep-link opens detail and source conversation jumps into linked support chat', async ({ browser, request }) => {
    test.slow();
    test.setTimeout(240_000);

    const state = buildTicketMessagesState();
    const evidence = await openOpsEvidencePage(
      browser,
      request,
      'tickets_to_messages_deeplink',
      '/app/tickets?tab=assigned&ticketId=ticket-support-1',
      async (page) => {
        await routeTicketApis(page, state);
        await routeMessageApis(page, state);
      },
    );

    try {
      await expect(evidence.page.locator('.ticket-detail-page')).toBeVisible();
      await expect(evidence.page.locator('.detail-subject')).toContainText('refund');
      await expect(evidence.page.locator('.chat-link')).toBeVisible();
      await expect(evidence.page.locator('.comment')).toContainText('refund');
      await evidence.step('01-ticket-detail-deeplink');

      await evidence.page.locator('.chat-link').click();
      await evidence.page.waitForURL(/\/app\/messages\?conversationId=conv-support-1/);
      await expect.poll(() => state.messageReadIds).toContain('conv-support-1');
      await expect(evidence.page.locator('.conv-card.selected')).toContainText('Nguyen Phu Huynh');
      await expect(evidence.page.locator('.conv-card.selected .kind-tag.support')).toContainText('Ho tro PH');
      await expect(evidence.page.locator('.message-bubble')).toHaveCount(2);
      await expect(evidence.page.locator('.chat-header')).toContainText('Minh Anh');
      await evidence.step('02-source-conversation-opened');

      evidence.note('Ticket deep-link now opens the requested detail directly, and source-conversation navigation lands on the linked support chat with messages loaded.');
      await evidence.finalize('PASS', {
        extraLines: [
          'ticketId query parameter opens the requested ticket detail: PASS',
          'Open source conversation lands on linked support chat and marks it read: PASS',
        ],
      });
    } catch (error) {
      await evidence.finalize('FAIL', { error });
      throw error;
    }
  });

  test('B09 ticket lifecycle browser flow creates, comments, resolves, closes, reopens, and cancels with exact payloads', async ({ browser, request }) => {
    test.slow();
    test.setTimeout(240_000);

    const opsSession = await loginAsRole(request, 'ops');
    const currentOpsId = String(opsSession.user?.sub || opsSession.user?._id || 'ops-1');
    const state = buildTicketMessagesState(currentOpsId);
    state.allTickets = [];
    state.assignedTickets = [];
    state.myTickets = [];

    const evidence = await openOpsEvidencePage(
      browser,
      request,
      'tickets_browser_lifecycle',
      '/app/tickets?tab=my',
      async (page) => {
        page.on('dialog', async (dialog) => {
          await dialog.accept();
        });
        await routeTicketApis(page, state);
      },
    );

    try {
      await expect(evidence.page.locator('.empty-state')).toBeVisible();
      await expect(evidence.page.locator('.empty-state')).toContainText('Không có ticket nào.');
      await evidence.step('01-empty-state');

      await evidence.page.locator('.empty-state .primary').click();
      await expect(evidence.page.locator('.modal h3')).toContainText('Tạo Ticket mới');
      await evidence.page.locator('.modal-footer .primary').click();
      await expect(evidence.page.locator('.form-error')).toContainText('Vui lòng điền đầy đủ thông tin bắt buộc.');
      expect(state.createPayloads).toHaveLength(0);

      await evidence.page.locator('.modal select').first().selectOption('REFUND_REQUEST');
      await evidence.page.locator('.modal input[type="text"]').fill('Refund cho buoi hoc bi huy');
      await evidence.page.locator('.modal textarea').fill('Phu huynh yeu cau refund vi buoi hoc offline bi huy do giao vien nghi.');
      await evidence.page.locator('.modal select').nth(1).selectOption('HIGH');
      await evidence.page.locator('.modal-footer .primary').click();
      await expect.poll(() => state.createPayloads.length).toBe(1);
      expect(state.createPayloads[0]).toEqual({
        type: 'REFUND_REQUEST',
        subject: 'Refund cho buoi hoc bi huy',
        description: 'Phu huynh yeu cau refund vi buoi hoc offline bi huy do giao vien nghi.',
        priority: 'HIGH',
      });
      await expect(evidence.page.locator('.ticket-list')).toContainText('TKT-CREATE-002');
      await expect(evidence.page.locator('.ticket-list')).toContainText('Refund cho buoi hoc bi huy');
      await evidence.step('02-create-ticket');

      await evidence.page.getByText('TKT-CREATE-002').click();
      await expect(evidence.page.locator('.ticket-detail-page')).toBeVisible();
      await expect(evidence.page.locator('.detail-subject')).toHaveText('Refund cho buoi hoc bi huy');
      await expect(evidence.page.locator('.reply-box textarea')).toHaveValue('');
      await evidence.page.locator('.reply-box textarea').fill('Da tiep nhan case va dang kiem tra lich su session.');
      await evidence.page.locator('.internal-check input').check();
      await evidence.page.locator('.reply-actions .primary').click();
      await expect.poll(() => state.commentPayloads.length).toBe(1);
      expect(state.commentPayloads[0]).toEqual({
        ticketId: 'ticket-created-2',
        content: 'Da tiep nhan case va dang kiem tra lich su session.',
        isInternal: true,
      });
      await expect(evidence.page.locator('.comment')).toContainText('Da tiep nhan case va dang kiem tra lich su session.');
      await expect(evidence.page.locator('.comment .internal-badge')).toContainText('Nội bộ');
      await evidence.step('03-comment-added');

      await evidence.page.locator('.action-btn.start').click();
      await expect.poll(() => state.actionRequests).toContain('start:ticket-created-2');
      await expect(evidence.page.locator('.detail-sidebar .badge.status').first()).toContainText('Đang xử lý');

      await evidence.page.locator('.action-btn.resolve').click();
      await expect(evidence.page.locator('.modal h3')).toContainText('Giải quyết Ticket');
      await evidence.page.locator('.modal-footer .primary').click();
      await expect(evidence.page.locator('.form-error')).toContainText('Vui lòng nhập tóm tắt kết quả.');
      expect(state.resolvePayloads).toHaveLength(0);

      await evidence.page.locator('.modal textarea').fill('Da doi lich va dong y refund mot phan cho phu huynh.');
      await evidence.page.locator('.modal input[type="number"]').fill('150000');
      await evidence.page.locator('.modal-footer .primary').click();
      await expect.poll(() => state.resolvePayloads.length).toBe(1);
      expect(state.resolvePayloads[0]).toEqual({
        ticketId: 'ticket-created-2',
        outcome: 'APPROVED',
        summary: 'Da doi lich va dong y refund mot phan cho phu huynh.',
        refundAmount: 150000,
      });
      await expect(evidence.page.locator('.detail-sidebar .badge.status').first()).toContainText('Đã giải quyết');
      await expect(evidence.page.locator('.resolution-card')).toContainText('Da doi lich va dong y refund mot phan cho phu huynh.');
      await expect(evidence.page.locator('.refund-amount')).toContainText('150.000');
      await evidence.step('04-resolved');

      await evidence.page.locator('.action-btn.close-ticket').click();
      await expect.poll(() => state.actionRequests).toContain('close:ticket-created-2');
      await expect(evidence.page.locator('.detail-sidebar .badge.status').first()).toContainText('Đã đóng');

      await evidence.page.locator('.action-btn.reopen').click();
      await expect.poll(() => state.actionRequests).toContain('reopen:ticket-created-2');
      await expect(evidence.page.locator('.detail-sidebar .badge.status').first()).toContainText('Mới tạo');

      await evidence.page.locator('.action-btn.cancel').click();
      await expect.poll(() => state.actionRequests).toContain('cancel:ticket-created-2');
      await expect(evidence.page.locator('.detail-sidebar .badge.status').first()).toContainText('Đã hủy');
      await expect(evidence.page.locator('.reply-box')).toHaveCount(0);
      await evidence.step('05-close-reopen-cancel');

      evidence.note('Tickets browser lifecycle now proves create, detail, internal comment, resolve, close, reopen, and cancel flows with exact payload capture.');
      await evidence.finalize('PASS', {
        extraLines: [
          'Ticket create flow validates required fields and posts the exact lifecycle payload: PASS',
          'Ticket detail comment flow persists the exact comment payload and internal badge: PASS',
          'Ticket resolve/close/reopen/cancel transitions keep exact status and resolution data in the detail pane: PASS',
        ],
      });
    } catch (error) {
      await evidence.finalize('FAIL', { error });
      throw error;
    }
  });

  test('B09 refund ticket close warns clearly when no refund ledger is linked yet', async ({ browser, request }) => {
    test.slow();
    test.setTimeout(240_000);

    const opsSession = await loginAsRole(request, 'ops');
    const currentOpsId = String(opsSession.user?.sub || opsSession.user?._id || 'ops-1');
    const state = buildTicketMessagesState(currentOpsId);
    const refundGuardMessage = 'Ticket refund nay chua duoc lien ket LedgerEntry giao dich vi. Ke toan can tao giao dich hoan tien truoc khi dong ticket.';
    const dialogMessages: string[] = [];

    const resolvedRefundTicket: TicketItem = {
      _id: 'ticket-refund-guard-1',
      ticketCode: 'TKT-REFUND-GUARD-001',
      type: 'REFUND_REQUEST',
      status: 'RESOLVED',
      priority: 'HIGH',
      subject: 'Refund can doi ledger truoc khi dong',
      description: 'Ticket refund nay da resolve nhung ke toan chua lien ket giao dich vi.',
      createdBy: {
        _id: 'parent-1',
        fullName: 'Nguyen Phu Huynh',
        email: 'parent.demo@school.local',
        role: 'PARENT',
      },
      createdByRole: 'PARENT',
      assignedTo: {
        _id: currentOpsId,
        fullName: 'Ops Demo',
        email: 'ops.demo@school.local',
      },
      attachments: [],
      dueDate: nowIso(),
      isOverdue: false,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      resolution: {
        outcome: 'APPROVED',
        summary: 'OPS da thong nhat so tien hoan voi phu huynh.',
        refundAmount: 200000,
        resolvedBy: {
          _id: currentOpsId,
          fullName: 'Ops Demo',
        },
        resolvedAt: nowIso(),
      },
    };
    state.allTickets = [resolvedRefundTicket];
    state.assignedTickets = [resolvedRefundTicket];
    state.myTickets = [];
    state.closeFailuresByTicketId[resolvedRefundTicket._id] = refundGuardMessage;

    const evidence = await openOpsEvidencePage(
      browser,
      request,
      'tickets_browser_refund_ledger_guard',
      '/app/tickets?tab=assigned',
      async (page) => {
        page.on('dialog', async (dialog) => {
          dialogMessages.push(`${dialog.type()}:${dialog.message()}`);
          await dialog.accept();
        });
        await routeTicketApis(page, state);
      },
    );

    try {
      await expect(evidence.page.locator('.ticket-list')).toContainText('TKT-REFUND-GUARD-001');
      await evidence.page.getByText('TKT-REFUND-GUARD-001').click();
      await expect(evidence.page.locator('.ticket-detail-page')).toBeVisible();
      await expect(evidence.page.locator('.detail-sidebar .badge.status').first()).toContainText('Đã giải quyết');
      await expect(evidence.page.locator('.refund-amount')).toContainText('200.000');
      await expect(evidence.page.locator('.resolution-warning')).toContainText('Chua lien ket giao dich hoan tien tren vi. Ke toan can tao LedgerEntry truoc khi dong ticket.');
      await evidence.step('01-refund-warning-visible');

      await evidence.page.locator('.action-btn.close-ticket').click();
      await expect.poll(() => dialogMessages).toEqual([
        `alert:${refundGuardMessage}`,
      ]);
      expect(state.actionRequests).toEqual([]);
      await expect(evidence.page.locator('.detail-sidebar .badge.status').first()).toContainText('Đã giải quyết');
      await expect(evidence.page.locator('.action-btn.close-ticket')).toBeVisible();
      await evidence.step('02-close-blocked-with-warning');

      evidence.note('Refund-request close now stays blocked in browser UI until a wallet ledger entry is linked, and the user sees the exact warning text without mutating ticket state.');
      await evidence.finalize('PASS', {
        extraLines: [
          'Resolved refund ticket without refundLedgerEntryId shows a blocking warning banner: PASS',
          'Close action is blocked with the exact refund-ledger warning and leaves the ticket in RESOLVED state: PASS',
        ],
      });
    } catch (error) {
      await evidence.finalize('FAIL', { error });
      throw error;
    }
  });
});
