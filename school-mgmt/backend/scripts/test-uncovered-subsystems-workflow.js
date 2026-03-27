/* eslint-disable no-console */
const path = require('path');

try {
  // eslint-disable-next-line global-require
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
} catch (_) {}

const API_BASE = process.env.TEST_API_BASE || `http://localhost:${process.env.PORT || 3000}`;
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'ChangeThisDemoPass2024!';
const REQUEST_TIMEOUT_MS = 30000;
const LOGIN_RETRY_WAIT_MS = 65000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function ensure(condition, message) {
  if (!condition) throw new Error(message);
}

function normalizeId(v) {
  if (!v) return null;
  if (typeof v === 'string') return v;
  if (typeof v === 'object') {
    if (typeof v._id === 'string') return v._id;
    if (v._id && typeof v._id.toString === 'function') return v._id.toString();
    if (typeof v.id === 'string') return v.id;
    if (typeof v.toString === 'function') return v.toString();
  }
  return String(v);
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
  const setCookies = getSetCookieHeaders(res);
  setCookies.forEach((entry) => {
    const parsed = parseCookiePairFromSetCookie(entry);
    if (parsed) jar[parsed.name] = parsed.value;
  });
  return jar;
}

function buildCookieHeader(cookieJar) {
  if (!cookieJar || typeof cookieJar !== 'object') return '';
  return Object.entries(cookieJar)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
}

function extractXsrfFromCookieHeader(cookieHeader) {
  const m = String(cookieHeader || '').match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/);
  return m && m[1] ? m[1] : null;
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
          `Response: ${parsed.text.slice(0, 800)}`,
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

async function login(email, password) {
  let lastErr = null;

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const parsed = await parseResponse(res);
    if (res.status === 429 && attempt < 2) {
      await sleep(LOGIN_RETRY_WAIT_MS);
      continue;
    }

    if (res.status !== 201 && res.status !== 200) {
      lastErr = new Error(`Login failed for ${email}: ${parsed.text}`);
      break;
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

  throw lastErr || new Error(`Login failed for ${email}`);
}

class TestRunner {
  constructor() {
    this.results = [];
  }

  async test(name, fn) {
    const start = Date.now();
    try {
      await fn();
      const ms = Date.now() - start;
      this.results.push({ name, status: 'PASS', ms });
      console.log(`PASS | ${name} (${ms}ms)`);
    } catch (err) {
      const ms = Date.now() - start;
      const error = err instanceof Error ? err.message : String(err);
      this.results.push({ name, status: 'FAIL', ms, error });
      console.log(`FAIL | ${name} (${ms}ms)`);
      console.log(`      ${error}`);
    }
  }

  skip(name, reason) {
    this.results.push({ name, status: 'SKIP', ms: 0, error: reason });
    console.log(`SKIP | ${name}`);
    console.log(`      ${reason}`);
  }

  summary() {
    const pass = this.results.filter((r) => r.status === 'PASS').length;
    const fail = this.results.filter((r) => r.status === 'FAIL').length;
    const skip = this.results.filter((r) => r.status === 'SKIP').length;

    console.log('\n=== Uncovered Subsystems Summary ===');
    console.log(`API Base : ${API_BASE}`);
    console.log(`PASS     : ${pass}`);
    console.log(`FAIL     : ${fail}`);
    console.log(`SKIP     : ${skip}`);

    if (fail > 0) {
      console.log('\nFailed tests:');
      this.results
        .filter((r) => r.status === 'FAIL')
        .forEach((r) => console.log(`- ${r.name}: ${r.error}`));
    }

    return { pass, fail, skip };
  }
}

function firstDayOfMonthIso() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  return start.toISOString();
}

function nowIso() {
  return new Date().toISOString();
}

async function main() {
  const runner = new TestRunner();
  console.log(`Testing uncovered subsystems against ${API_BASE}`);

  const auth = {};
  const accountEmails = {
    director: 'director.demo@school.local',
    accounting: 'accounting.demo@school.local',
    ops: 'ops.demo@school.local',
    teacher: 'teacher.demo@school.local',
    parent: 'parent.demo@school.local',
    sale: 'sale.huong@school.local',
  };

  for (const [role, email] of Object.entries(accountEmails)) {
    const loginData = await login(email, DEMO_PASSWORD);
    auth[role] = loginData;
    console.log(`- ${role.toUpperCase()} logged in (${email})`);
  }

  let cleanupFanpageId = null;
  let parentPreferencesBefore = null;
  let messageConversationId = null;

  await runner.test('DIRECTOR can access director dashboard', async () => {
    const res = await request({
      method: 'GET',
      reqPath: '/dashboard/director',
      token: auth.director.token,
      expectedStatus: [200],
    });
    ensure(res.data && typeof res.data === 'object', 'Director dashboard payload must be an object');
  });

  await runner.test('DIRECTOR can access comprehensive dashboard', async () => {
    const res = await request({
      method: 'GET',
      reqPath: '/dashboard/director/comprehensive',
      token: auth.director.token,
      expectedStatus: [200],
    });
    ensure(res.data && typeof res.data === 'object', 'Comprehensive dashboard payload must be an object');
  });

  await runner.test('ACCOUNTING can access accounting dashboard', async () => {
    const res = await request({
      method: 'GET',
      reqPath: '/dashboard/accounting',
      token: auth.accounting.token,
      expectedStatus: [200],
    });
    ensure(res.data && typeof res.data === 'object', 'Accounting dashboard payload must be an object');
  });

  await runner.test('ACCOUNTING cannot access director dashboard', async () => {
    await request({
      method: 'GET',
      reqPath: '/dashboard/director',
      token: auth.accounting.token,
      expectedStatus: [403],
    });
  });

  await runner.test('OPS can access ops dashboard', async () => {
    const res = await request({
      method: 'GET',
      reqPath: '/dashboard/ops',
      token: auth.ops.token,
      expectedStatus: [200],
    });
    ensure(res.data && typeof res.data === 'object', 'Ops dashboard payload must be an object');
  });

  await runner.test('TEACHER can access teacher dashboard', async () => {
    const res = await request({
      method: 'GET',
      reqPath: '/dashboard/teacher',
      token: auth.teacher.token,
      expectedStatus: [200],
    });
    ensure(res.data && typeof res.data === 'object', 'Teacher dashboard payload must be an object');
  });

  await runner.test('PARENT can access parent dashboard', async () => {
    const res = await request({
      method: 'GET',
      reqPath: '/dashboard/parent',
      token: auth.parent.token,
      expectedStatus: [200],
    });
    ensure(res.data && typeof res.data === 'object', 'Parent dashboard payload must be an object');
  });

  await runner.test('SALE can access sales dashboard', async () => {
    const res = await request({
      method: 'GET',
      reqPath: '/dashboard/sales',
      token: auth.sale.token,
      expectedStatus: [200],
    });
    ensure(res.data && typeof res.data === 'object', 'Sales dashboard payload must be an object');
  });

  await runner.test('DIRECTOR can read audit logs', async () => {
    const res = await request({
      method: 'GET',
      reqPath: '/audit-log?page=1&limit=5',
      token: auth.director.token,
      expectedStatus: [200],
    });
    ensure(res.data && Array.isArray(res.data.data), 'Audit log payload must include data array');
    ensure(typeof res.data.total === 'number', 'Audit log payload must include total number');
  });

  await runner.test('DIRECTOR can read audit log stats', async () => {
    const res = await request({
      method: 'GET',
      reqPath: '/audit-log/stats',
      token: auth.director.token,
      expectedStatus: [200],
    });
    ensure(typeof (res.data && res.data.totalCount) === 'number', 'Audit stats must include totalCount');
  });

  await runner.test('ACCOUNTING cannot read audit logs', async () => {
    await request({
      method: 'GET',
      reqPath: '/audit-log',
      token: auth.accounting.token,
      expectedStatus: [403],
    });
  });

  await runner.test('DIRECTOR can read pending approval summary', async () => {
    const res = await request({
      method: 'GET',
      reqPath: '/pending-approvals/summary',
      token: auth.director.token,
      expectedStatus: [200],
    });
    ensure(typeof (res.data && res.data.totalPending) === 'number', 'Pending summary must include totalPending');
  });

  await runner.test('DIRECTOR can read all pending approvals', async () => {
    const res = await request({
      method: 'GET',
      reqPath: '/pending-approvals',
      token: auth.director.token,
      expectedStatus: [200],
    });
    ensure(res.data && res.data.summary, 'Pending approvals payload must include summary');
  });

  await runner.test('ACCOUNTING cannot read pending approvals', async () => {
    await request({
      method: 'GET',
      reqPath: '/pending-approvals',
      token: auth.accounting.token,
      expectedStatus: [403],
    });
  });

  await runner.test('DIRECTOR can export students CSV', async () => {
    const res = await request({
      method: 'GET',
      reqPath: '/export/students',
      token: auth.director.token,
      expectedStatus: [200],
    });
    ensure(res.headers.contentType.includes('text/csv'), 'Students export must return text/csv');
    ensure(res.raw.includes(','), 'Students export should contain CSV separator');
  });

  await runner.test('ACCOUNTING can export payroll CSV', async () => {
    const res = await request({
      method: 'GET',
      reqPath: '/export/payroll?fromDate=2025-01-01&toDate=2026-12-31',
      token: auth.accounting.token,
      expectedStatus: [200],
    });
    ensure(res.headers.contentType.includes('text/csv'), 'Payroll export must return text/csv');
    ensure(res.raw.split('\n').length >= 1, 'Payroll export should return CSV lines');
  });

  await runner.test('OPS can export attendance CSV', async () => {
    const res = await request({
      method: 'GET',
      reqPath: '/export/attendance?fromDate=2025-01-01&toDate=2026-12-31',
      token: auth.ops.token,
      expectedStatus: [200],
    });
    ensure(res.headers.contentType.includes('text/csv'), 'Attendance export must return text/csv');
  });

  await runner.test('PARENT cannot export students CSV', async () => {
    await request({
      method: 'GET',
      reqPath: '/export/students',
      token: auth.parent.token,
      expectedStatus: [403],
    });
  });

  await runner.test('PARENT can read notification preferences', async () => {
    const res = await request({
      method: 'GET',
      reqPath: '/notifications/preferences',
      token: auth.parent.token,
      expectedStatus: [200],
    });
    parentPreferencesBefore = res.data;
    ensure(typeof res.data.enableEmailNotif === 'boolean', 'Preference payload must include enableEmailNotif');
  });

  await runner.test('PARENT can update notification preferences', async () => {
    ensure(parentPreferencesBefore, 'Preference baseline is missing');
    const newPhone = `09${String(Date.now()).slice(-8)}`;
    const res = await request({
      method: 'PATCH',
      reqPath: '/notifications/preferences',
      token: auth.parent.token,
      expectedStatus: [200],
      body: {
        enableEmailNotif: !parentPreferencesBefore.enableEmailNotif,
        enableZaloNotif: !parentPreferencesBefore.enableZaloNotif,
        enableSmsNotif: !parentPreferencesBefore.enableSmsNotif,
        phone: newPhone,
      },
    });
    ensure(res.data && res.data.success === true, 'Update preferences must return success=true');
  });

  await runner.test('PARENT can read notifications list and unread count', async () => {
    const listRes = await request({
      method: 'GET',
      reqPath: '/notifications?page=1&limit=10',
      token: auth.parent.token,
      expectedStatus: [200],
    });
    ensure(listRes.data && Array.isArray(listRes.data.data), 'Notifications payload must include data array');

    const unreadRes = await request({
      method: 'GET',
      reqPath: '/notifications/unread-count',
      token: auth.parent.token,
      expectedStatus: [200],
    });
    ensure(typeof (unreadRes.data && unreadRes.data.count) === 'number', 'Unread count must be numeric');
  });

  await runner.test('PARENT can mark all notifications as read', async () => {
    const res = await request({
      method: 'PATCH',
      reqPath: '/notifications/mark-all-read',
      token: auth.parent.token,
      expectedStatus: [200],
    });
    ensure(typeof (res.data && res.data.modifiedCount) === 'number', 'Mark-all-read must return modifiedCount');
  });

  await runner.test('TEACHER can read own work sessions', async () => {
    const res = await request({
      method: 'GET',
      reqPath: '/work-sessions/my?page=1&limit=10',
      token: auth.teacher.token,
      expectedStatus: [200],
    });
    ensure(res.data && Array.isArray(res.data.data), 'My work sessions must include data array');
    ensure(res.data && res.data.meta, 'My work sessions must include meta');
  });

  await runner.test('TEACHER cannot read all work sessions', async () => {
    await request({
      method: 'GET',
      reqPath: '/work-sessions?page=1&limit=5',
      token: auth.teacher.token,
      expectedStatus: [403],
    });
  });

  let workSessionId = null;
  await runner.test('DIRECTOR can list work sessions for a teacher', async () => {
    const teacherId = normalizeId(auth.teacher.user && auth.teacher.user._id);
    ensure(teacherId, 'Teacher user id is missing');
    const res = await request({
      method: 'GET',
      reqPath: `/work-sessions?userId=${teacherId}&page=1&limit=5`,
      token: auth.director.token,
      expectedStatus: [200],
    });
    ensure(res.data && Array.isArray(res.data.data), 'Work sessions list must include data array');
    workSessionId = normalizeId(res.data.data[0] && res.data.data[0]._id);
  });

  if (workSessionId) {
    await runner.test('DIRECTOR can update a work session note', async () => {
      const res = await request({
        method: 'PATCH',
        reqPath: `/work-sessions/${workSessionId}`,
        token: auth.director.token,
        expectedStatus: [200],
        body: { notes: `updated-by-e2e-${Date.now()}` },
      });
      ensure(typeof res.data.notes === 'string', 'Updated work session must include notes');
    });
  } else {
    runner.skip('DIRECTOR can update a work session note', 'No work session record available to patch');
  }

  await runner.test('DIRECTOR can read monthly work-session summary', async () => {
    const res = await request({
      method: 'GET',
      reqPath: `/work-sessions/summary?periodStart=${encodeURIComponent(firstDayOfMonthIso())}&periodEnd=${encodeURIComponent(nowIso())}`,
      token: auth.director.token,
      expectedStatus: [200],
    });
    ensure(Array.isArray(res.data), 'Work-session summary must return an array');
  });

  await runner.test('PARENT sends direct message to SALE support contact', async () => {
    const saleId = normalizeId(auth.sale.user && auth.sale.user._id);
    ensure(saleId, 'Sale user id is missing');
    const res = await request({
      method: 'POST',
      reqPath: '/messages/send',
      token: auth.parent.token,
      expectedStatus: [200, 201],
      body: {
        receiverId: saleId,
        content: `E2E parent->sale message ${Date.now()}`,
      },
    });
    ensure(normalizeId(res.data && res.data._id), 'Send message should create a message document');
  });

  await runner.test('SALE can list conversations and find parent chat', async () => {
    const parentId = normalizeId(auth.parent.user && auth.parent.user._id);
    ensure(parentId, 'Parent user id is missing');
    const res = await request({
      method: 'GET',
      reqPath: '/messages/conversations',
      token: auth.sale.token,
      expectedStatus: [200],
    });
    ensure(Array.isArray(res.data), 'Conversations endpoint must return an array');

    const convo = res.data.find((c) => {
      const participants = Array.isArray(c.participants) ? c.participants : [];
      return participants.some((p) => normalizeId(p && p._id) === parentId);
    });
    ensure(convo, 'Could not find sale-parent conversation');
    messageConversationId = normalizeId(convo._id);
    ensure(messageConversationId, 'Conversation id is missing');
  });

  await runner.test('SALE can read conversation messages', async () => {
    ensure(messageConversationId, 'Conversation id is missing');
    const res = await request({
      method: 'GET',
      reqPath: `/messages/conversations/${messageConversationId}/messages?page=1&limit=20`,
      token: auth.sale.token,
      expectedStatus: [200],
    });
    ensure(res.data && Array.isArray(res.data.messages), 'Messages payload must include messages array');
  });

  await runner.test('SALE can mark conversation as read', async () => {
    ensure(messageConversationId, 'Conversation id is missing');
    const res = await request({
      method: 'POST',
      reqPath: `/messages/conversations/${messageConversationId}/read`,
      token: auth.sale.token,
      expectedStatus: [200, 201],
    });
    ensure(typeof (res.data && res.data.marked) === 'number', 'Mark read must return marked count');
  });

  await runner.test('PARENT can send follow-up into existing conversation', async () => {
    ensure(messageConversationId, 'Conversation id is missing');
    const res = await request({
      method: 'POST',
      reqPath: `/messages/conversations/${messageConversationId}/send`,
      token: auth.parent.token,
      expectedStatus: [200, 201],
      body: { content: `E2E follow-up ${Date.now()}` },
    });
    ensure(normalizeId(res.data && res.data._id), 'Follow-up send should create message');
  });

  await runner.test('SALE unread-count endpoint returns numeric count', async () => {
    const res = await request({
      method: 'GET',
      reqPath: '/messages/unread-count',
      token: auth.sale.token,
      expectedStatus: [200],
    });
    ensure(typeof (res.data && res.data.count) === 'number', 'Unread count payload must include count');
  });

  const createdPageId = `e2e-fb-page-${Date.now()}`;
  const verifyToken = `verify-${Date.now()}`;

  await runner.test('DIRECTOR creates chatbot fanpage config', async () => {
    const res = await request({
      method: 'POST',
      reqPath: '/chatbot/fanpages',
      token: auth.director.token,
      expectedStatus: [200, 201],
      body: {
        name: `E2E Fanpage ${Date.now()}`,
        platform: 'FACEBOOK',
        pageId: createdPageId,
        webhookVerifyToken: verifyToken,
        aiAutoReplyEnabled: false,
      },
    });
    cleanupFanpageId = normalizeId(res.data && res.data._id);
    ensure(cleanupFanpageId, 'Failed to create fanpage config');
  });

  await runner.test('OPS can list chatbot fanpages', async () => {
    const res = await request({
      method: 'GET',
      reqPath: `/chatbot/fanpages?search=${encodeURIComponent(createdPageId)}`,
      token: auth.ops.token,
      expectedStatus: [200],
    });
    ensure(res.data && Array.isArray(res.data.data), 'Fanpage list must include data array');
    const found = res.data.data.some((fp) => fp.pageId === createdPageId);
    ensure(found, 'Created fanpage not found in ops listing');
  });

  await runner.test('SALE cannot list chatbot fanpages', async () => {
    await request({
      method: 'GET',
      reqPath: '/chatbot/fanpages',
      token: auth.sale.token,
      expectedStatus: [403],
    });
  });

  await runner.test('Facebook webhook verify succeeds with correct token', async () => {
    const challenge = 'challenge-e2e-123';
    const res = await request({
      method: 'GET',
      reqPath: `/webhooks/facebook/${encodeURIComponent(createdPageId)}?hub.mode=subscribe&hub.verify_token=${encodeURIComponent(verifyToken)}&hub.challenge=${encodeURIComponent(challenge)}`,
      expectedStatus: [200],
    });
    ensure(res.raw.trim() === challenge, 'Webhook verify should return challenge text');
  });

  await runner.test('Facebook webhook verify rejects wrong token', async () => {
    await request({
      method: 'GET',
      reqPath: `/webhooks/facebook/${encodeURIComponent(createdPageId)}?hub.mode=subscribe&hub.verify_token=wrong-token&hub.challenge=abc`,
      expectedStatus: [403],
    });
  });

  await runner.test('DIRECTOR updates chatbot fanpage config', async () => {
    ensure(cleanupFanpageId, 'Fanpage id missing for update');
    const res = await request({
      method: 'PATCH',
      reqPath: `/chatbot/fanpages/${cleanupFanpageId}`,
      token: auth.director.token,
      expectedStatus: [200],
      body: { description: `Updated by E2E at ${new Date().toISOString()}` },
    });
    ensure(normalizeId(res.data && res.data._id) === cleanupFanpageId, 'Updated fanpage id mismatch');
  });

  await runner.test('DIRECTOR deletes chatbot fanpage config', async () => {
    ensure(cleanupFanpageId, 'Fanpage id missing for delete');
    await request({
      method: 'DELETE',
      reqPath: `/chatbot/fanpages/${cleanupFanpageId}`,
      token: auth.director.token,
      expectedStatus: [200],
    });
    cleanupFanpageId = null;
  });

  if (parentPreferencesBefore) {
    await runner.test('Restore parent notification preferences', async () => {
      const res = await request({
        method: 'PATCH',
        reqPath: '/notifications/preferences',
        token: auth.parent.token,
        expectedStatus: [200],
        body: {
          enableEmailNotif: !!parentPreferencesBefore.enableEmailNotif,
          enableZaloNotif: !!parentPreferencesBefore.enableZaloNotif,
          enableSmsNotif: !!parentPreferencesBefore.enableSmsNotif,
          phone: parentPreferencesBefore.phone || '',
        },
      });
      ensure(res.data && res.data.success === true, 'Failed to restore notification preferences');
    });
  }

  if (cleanupFanpageId) {
    try {
      await request({
        method: 'DELETE',
        reqPath: `/chatbot/fanpages/${cleanupFanpageId}`,
        token: auth.director.token,
        expectedStatus: [200],
      });
      cleanupFanpageId = null;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.log(`WARN | Cleanup fanpage failed: ${message}`);
    }
  }

  const result = runner.summary();
  if (result.fail > 0) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('\nFatal error running uncovered subsystem tests:');
  console.error(err);
  process.exit(1);
});
