/* eslint-disable no-console */
const path = require('path');

try {
  // eslint-disable-next-line global-require
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
} catch (_) {}

const API_BASE = process.env.TEST_API_BASE || `http://localhost:${process.env.PORT || 3000}`;
const FRONTEND_BASE = process.env.TEST_FRONTEND_BASE || 'http://localhost:4200';
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'ChangeThisDemoPass2024!';
const REQUEST_TIMEOUT_MS = 45000;
const LOGIN_RETRY_WAIT_MS = 65000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function ensure(condition, message) {
  if (!condition) throw new Error(message);
}

function normalizeId(value) {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    if (typeof value._id === 'string') return value._id;
    if (value._id && typeof value._id.toString === 'function') return value._id.toString();
    if (typeof value.id === 'string') return value.id;
    if (typeof value.toString === 'function') return value.toString();
  }
  return String(value);
}

function isSafeMethod(method) {
  return ['GET', 'HEAD', 'OPTIONS'].includes(String(method || 'GET').toUpperCase());
}

function getSetCookieHeaders(res) {
  if (res && res.headers && typeof res.headers.getSetCookie === 'function') {
    return res.headers.getSetCookie();
  }
  const single = res && res.headers ? res.headers.get('set-cookie') : null;
  return single ? [single] : [];
}

function parseCookiePairFromSetCookie(setCookieValue) {
  const firstPart = String(setCookieValue || '').split(';')[0];
  const idx = firstPart.indexOf('=');
  if (idx <= 0) return null;
  const name = firstPart.slice(0, idx).trim();
  const value = firstPart.slice(idx + 1).trim();
  if (!name) return null;
  return { name, value };
}

function extractCookiesFromResponse(res) {
  const jar = {};
  getSetCookieHeaders(res).forEach((entry) => {
    const parsed = parseCookiePairFromSetCookie(entry);
    if (parsed) jar[parsed.name] = parsed.value;
  });
  return jar;
}

function buildCookieHeader(cookieJar) {
  if (!cookieJar || typeof cookieJar !== 'object') return '';
  return Object.entries(cookieJar)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${key}=${value}`)
    .join('; ');
}

function extractXsrfFromCookieHeader(cookieHeader) {
  const match = String(cookieHeader || '').match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/);
  return match && match[1] ? match[1] : null;
}

async function parseResponse(res) {
  const text = await res.text();
  if (!text) return { text: '', json: null };
  try {
    return { text, json: JSON.parse(text) };
  } catch (_) {
    return { text, json: null };
  }
}

async function request({
  method = 'GET',
  reqPath,
  token,
  body,
  expectedStatus = [200],
  timeoutMs = REQUEST_TIMEOUT_MS,
}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Cookie = token;
    if (!isSafeMethod(method)) {
      const xsrf = extractXsrfFromCookieHeader(token);
      if (xsrf) headers['X-XSRF-TOKEN'] = xsrf;
    }

    const res = await fetch(`${API_BASE}${reqPath}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });

    const parsed = await parseResponse(res);
    const ok = Array.isArray(expectedStatus)
      ? expectedStatus.includes(res.status)
      : res.status === expectedStatus;

    if (!ok) {
      throw new Error(
        `${method} ${reqPath} expected ${JSON.stringify(expectedStatus)} but got ${res.status}. ` +
          `Response: ${parsed.text.slice(0, 900)}`,
      );
    }

    return {
      status: res.status,
      data: parsed.json,
      raw: parsed.text,
      headers: {
        contentType: res.headers.get('content-type') || '',
        contentDisposition: res.headers.get('content-disposition') || '',
      },
    };
  } finally {
    clearTimeout(timer);
  }
}

async function loginWithRetry(email, password = DEMO_PASSWORD, maxRetries = 4) {
  let attempt = 0;
  while (attempt < maxRetries) {
    attempt += 1;
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const parsed = await parseResponse(res);
    if (res.status === 429) {
      if (attempt >= maxRetries) {
        throw new Error(`Login throttled for ${email} after ${attempt} attempts`);
      }
      console.log(`[login] throttled for ${email}, waiting ${LOGIN_RETRY_WAIT_MS / 1000}s...`);
      await sleep(LOGIN_RETRY_WAIT_MS);
      continue;
    }
    if (res.status !== 201 && res.status !== 200) {
      throw new Error(`Login failed for ${email}: ${parsed.text}`);
    }

    const cookieJar = extractCookiesFromResponse(res);
    ensure(cookieJar.access_token, `No access_token cookie returned for ${email}`);

    if (!cookieJar['XSRF-TOKEN']) {
      const meRes = await fetch(`${API_BASE}/users/me`, {
        headers: { Cookie: `access_token=${cookieJar.access_token}` },
      });
      Object.assign(cookieJar, extractCookiesFromResponse(meRes));
    }

    ensure(cookieJar['XSRF-TOKEN'], `No XSRF-TOKEN cookie returned for ${email}`);
    return {
      token: buildCookieHeader({
        access_token: cookieJar.access_token,
        'XSRF-TOKEN': cookieJar['XSRF-TOKEN'],
      }),
      user: parsed.json && parsed.json.user ? parsed.json.user : null,
    };
  }
  throw new Error(`Unable to login for ${email}`);
}

async function fetchRoute(url) {
  const res = await fetch(url, { redirect: 'manual' });
  return res.status;
}

function uniqueSuffix() {
  const stamp = Date.now().toString().slice(-8);
  const pid = String(process.pid).slice(-4);
  const rand = Math.floor(Math.random() * 9000)
    .toString()
    .padStart(4, '0');
  return `${stamp}${pid}${rand}`;
}

async function pollUntil(fn, attempts = 10, delayMs = 1000) {
  let lastError = null;
  for (let i = 0; i < attempts; i += 1) {
    try {
      const result = await fn();
      if (result) return result;
    } catch (error) {
      lastError = error;
    }
    await sleep(delayMs);
  }
  if (lastError) throw lastError;
  return null;
}

async function main() {
  console.log(`Testing messages workflow against ${API_BASE}`);

  const director = await loginWithRetry('director.demo@school.local');
  const ops = await loginWithRetry('ops.demo@school.local');
  const sale = await loginWithRetry('sale.huong@school.local');
  const parent = await loginWithRetry('parent.demo@school.local');
  console.log('- DIRECTOR, OPS, SALE, PARENT logged in');

  const directorId = normalizeId(director.user);
  const opsId = normalizeId(ops.user);
  const saleId = normalizeId(sale.user);
  const parentId = normalizeId(parent.user);
  ensure(directorId, 'Director demo id missing');
  ensure(opsId, 'Ops demo id missing');
  ensure(saleId, 'Sale demo id missing');
  ensure(parentId, 'Parent demo id missing');

  const suffix = uniqueSuffix();
  const studentCode = `MSG-${suffix}`;
  const studentName = `Messages Parent ${suffix}`;
  const parentName = `Parent Messages ${suffix}`;

  let studentId = null;
  let conversationId = null;
  let ticketId = null;
  let ticketCode = null;
  let pass = 0;
  let fail = 0;

  async function step(title, fn) {
    const started = Date.now();
    try {
      await fn();
      pass += 1;
      console.log(`PASS | ${title} (${Date.now() - started}ms)`);
    } catch (error) {
      fail += 1;
      console.error(`FAIL | ${title} (${Date.now() - started}ms)`);
      console.error(error && error.stack ? error.stack : error);
      throw error;
    }
  }

  await step('Frontend route and baseline RBAC are correct', async () => {
    const routeStatus = await fetchRoute(`${FRONTEND_BASE}/app/messages`);
    ensure(routeStatus === 200, `Expected /app/messages => 200, got ${routeStatus}`);

    await request({
      reqPath: '/messages/unread-count',
      token: parent.token,
      expectedStatus: [200],
    });
  });

  await step('Create a fresh student for parent support contact', async () => {
    const created = await request({
      method: 'POST',
      reqPath: '/students',
      token: sale.token,
      expectedStatus: [200, 201],
      body: {
        studentCode,
        fullName: studentName,
        age: 9,
        parentName,
        parentPhone: `09${suffix.slice(-8)}`,
        parentUserId: parentId,
        faceImage: 'default-avatar.png',
        studentType: 'ONLINE',
      },
    });
    studentId = normalizeId(created.data);
    ensure(studentId, 'Failed to resolve studentId');
    ensure(normalizeId(created.data?.saleId) === saleId, 'Student must be linked to the sale');

    await request({
      method: 'POST',
      reqPath: `/students/${studentId}/approve`,
      token: director.token,
      expectedStatus: [200, 201],
      body: { action: 'APPROVE' },
    });
  });

  await step('Parent sends support message that hands off to ticket', async () => {
    const res = await request({
      method: 'POST',
      reqPath: '/messages/send',
      token: parent.token,
      expectedStatus: [200, 201],
      body: {
        receiverId: saleId,
        contextStudentId: studentId,
        content: `Toi muon hoan tien hoc phi cho hoc sinh ${studentName} vi lich hoc khong phu hop.`,
      },
    });
    ensure(normalizeId(res.data && res.data._id), 'Send message should create a message document');
  });

  await step('Conversation propagates to sale and director views', async () => {
    const saleConvo = await pollUntil(async () => {
      const res = await request({
        reqPath: '/messages/conversations',
        token: sale.token,
        expectedStatus: [200],
      });
      const items = Array.isArray(res.data) ? res.data : [];
      return items.find(
        (item) =>
          item.conversationKind === 'PARENT_SUPPORT'
          && normalizeId(item.topicStudentId) === studentId,
      );
    });
    ensure(saleConvo, 'Sale should see the parent support conversation');
    conversationId = normalizeId(saleConvo._id);
    ensure(conversationId, 'Conversation id missing');
    ensure(Number(saleConvo.unreadCount || 0) >= 1, 'Sale conversation should have unread messages');

    const directorConvo = await request({
      reqPath: '/messages/conversations',
      token: director.token,
      expectedStatus: [200],
    });
    const directorRow = (Array.isArray(directorConvo.data) ? directorConvo.data : []).find(
      (item) => normalizeId(item._id) === conversationId,
    );
    ensure(directorRow, 'Director should see the same support conversation');
    ensure(directorRow.viewerIsParticipant === false, 'Director should observe support queue as non-participant');
  });

  await step('Conversation detail and message list include handoff ticket metadata', async () => {
    const detailRes = await request({
      reqPath: `/messages/conversations/${conversationId}`,
      token: director.token,
      expectedStatus: [200],
    });
    ensure(normalizeId(detailRes.data._id) === conversationId, 'Conversation detail id mismatch');
    ensure(detailRes.data.conversationKind === 'PARENT_SUPPORT', 'Conversation kind must be PARENT_SUPPORT');
    ensure(normalizeId(detailRes.data.topicStudentId) === studentId, 'topicStudentId must match created student');

    const messagesRes = await request({
      reqPath: `/messages/conversations/${conversationId}/messages?page=1&limit=20`,
      token: sale.token,
      expectedStatus: [200],
    });
    const messages = Array.isArray(messagesRes.data?.messages) ? messagesRes.data.messages : [];
    ensure(messages.length >= 2, 'Support conversation should include parent message and handoff reply');

    const parentMsg = messages.find((msg) => msg.senderType === 'USER' && msg.content.includes('hoan tien'));
    ensure(parentMsg, 'Parent support message not found in conversation');

    const handoffMsg = messages.find((msg) => msg.senderType === 'AI' && msg.handoffTicketId && msg.handoffTicketCode);
    ensure(handoffMsg, 'AI handoff message with ticket metadata not found');
    ticketId = normalizeId(handoffMsg.handoffTicketId);
    ticketCode = handoffMsg.handoffTicketCode;
    ensure(ticketId, 'handoff ticket id missing');
    ensure(ticketCode, 'handoff ticket code missing');
    ensure(String(handoffMsg.content || '').includes(ticketCode), 'handoff reply should mention ticket code');
  });

  await step('Unread count updates after mark-read', async () => {
    const before = await request({
      reqPath: '/messages/unread-count',
      token: sale.token,
      expectedStatus: [200],
    });
    const beforeCount = Number(before.data?.count || 0);
    ensure(beforeCount >= 1, 'Sale unread count should be positive before mark-read');

    await request({
      method: 'POST',
      reqPath: `/messages/conversations/${conversationId}/read`,
      token: sale.token,
      expectedStatus: [200, 201],
    });

    const after = await request({
      reqPath: '/messages/unread-count',
      token: sale.token,
      expectedStatus: [200],
    });
    const afterCount = Number(after.data?.count || 0);
    ensure(afterCount <= beforeCount, 'Global unread count should not increase after mark-read');

    const detailAfter = await request({
      reqPath: `/messages/conversations/${conversationId}`,
      token: sale.token,
      expectedStatus: [200],
    });
    ensure(Number(detailAfter.data?.unreadCount || 0) === 0, 'Conversation unreadCount should become zero after mark-read');
  });

  await step('Tickets propagate from messages to tickets module', async () => {
    const parentTickets = await request({
      reqPath: '/tickets/my-tickets?page=1&limit=20&sort=-createdAt',
      token: parent.token,
      expectedStatus: [200],
    });
    const parentTicket = (Array.isArray(parentTickets.data?.data) ? parentTickets.data.data : []).find(
      (ticket) =>
        normalizeId(ticket.sourceConversationId) === conversationId
        || String(ticket.subject || '').includes('Chat PH -'),
    );
    ensure(parentTicket, 'Parent ticket should be visible in my-tickets');
    ensure(parentTicket.type === 'REFUND_REQUEST', 'Handoff ticket must use refund request type');
    ensure(parentTicket.status === 'OPEN', `Handoff ticket should remain OPEN, got "${parentTicket.status}"`);
    ensure(normalizeId(parentTicket._id), 'Parent ticket id missing');

    const directorTickets = await request({
      reqPath: `/tickets?createdBy=${parentId}&page=1&limit=20&sort=-createdAt`,
      token: director.token,
      expectedStatus: [200],
    });
    const ticketRow = (Array.isArray(directorTickets.data?.data) ? directorTickets.data.data : []).find(
      (ticket) => normalizeId(ticket._id) === normalizeId(parentTicket._id),
    );
    ensure(ticketRow, 'Director ticket list should include the handoff ticket');
    ensure(normalizeId(ticketRow.sourceConversationId) === conversationId, 'Ticket should link back to the message conversation');
  });

  await step('Parent conversation remains visible to the creator', async () => {
    const parentConversations = await request({
      reqPath: '/messages/conversations',
      token: parent.token,
      expectedStatus: [200],
    });
    const row = (Array.isArray(parentConversations.data) ? parentConversations.data : []).find(
      (item) => normalizeId(item._id) === conversationId,
    );
    ensure(row, 'Parent should still see the created support conversation');
    ensure(row.viewerIsParticipant === true, 'Parent must be a participant in the conversation');
  });

  console.log('\n=== Messages Workflow Summary ===');
  console.log(`API Base : ${API_BASE}`);
  console.log(`PASS     : ${pass}`);
  console.log(`FAIL     : ${fail}`);
  if (fail > 0) process.exit(1);
}

main().catch((err) => {
  console.error('\nUnhandled error:', err.message);
  process.exit(1);
});
