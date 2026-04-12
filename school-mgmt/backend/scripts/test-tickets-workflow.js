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

    return { status: res.status, data: parsed.json, raw: parsed.text };
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
    return buildCookieHeader({
      access_token: cookieJar.access_token,
      'XSRF-TOKEN': cookieJar['XSRF-TOKEN'],
    });
  }
  throw new Error(`Unable to login for ${email}`);
}

function randomSuffix() {
  return `${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 900 + 100)}`;
}

async function fetchRoute(url) {
  const res = await fetch(url, { redirect: 'manual' });
  return res.status;
}

async function main() {
  console.log(`Testing tickets workflow against ${API_BASE}`);

  const directorToken = await loginWithRetry('director.demo@school.local');
  const opsToken = await loginWithRetry('ops.demo@school.local');
  const teacherToken = await loginWithRetry('teacher.demo@school.local');
  const parentToken = await loginWithRetry('parent.demo@school.local');
  console.log('- DIRECTOR, OPS, TEACHER, PARENT logged in');

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

  const ticketCodeSuffix = randomSuffix();
  let ticketId;

  await step('Frontend route is reachable and baseline RBAC is correct', async () => {
    const routeStatus = await fetchRoute(`${FRONTEND_BASE}/app/tickets`);
    ensure(routeStatus === 200, `Expected /app/tickets => 200, got ${routeStatus}`);

    await request({
      reqPath: '/tickets',
      token: parentToken,
      expectedStatus: [403],
    });

    await request({
      reqPath: '/tickets/stats',
      token: teacherToken,
      expectedStatus: [403],
    });
  });

  await step('Teacher can create a ticket and creator lists can see it', async () => {
    const created = await request({
      method: 'POST',
      reqPath: '/tickets',
      token: teacherToken,
      body: {
        type: 'PAYMENT_ISSUE',
        subject: `Ticket e2e ${ticketCodeSuffix}`,
        description: 'Ticket workflow generated from e2e test.',
        priority: 'HIGH',
      },
      expectedStatus: [200, 201],
    });
    ticketId = normalizeId(created.data);
    ensure(ticketId, 'Failed to resolve ticket id');
    ensure(created.data.status === 'OPEN' || created.data.status === 'IN_PROGRESS', 'Unexpected initial ticket status');

    const myTickets = await request({
      reqPath: '/tickets/my-tickets',
      token: teacherToken,
      expectedStatus: [200],
    });
    ensure(
      Array.isArray(myTickets.data?.data) && myTickets.data.data.some((item) => normalizeId(item) === ticketId),
      'Teacher my-tickets does not contain created ticket',
    );

    const directorList = await request({
      reqPath: '/tickets',
      token: directorToken,
      expectedStatus: [200],
    });
    ensure(
      Array.isArray(directorList.data?.data) && directorList.data.data.some((item) => normalizeId(item) === ticketId),
      'Director list does not contain created ticket',
    );
  });

  await step('OPS can start, comment and resolve the ticket', async () => {
    const started = await request({
      method: 'POST',
      reqPath: `/tickets/${ticketId}/start`,
      token: opsToken,
      expectedStatus: [200, 201],
    });
    ensure(started.data.status === 'IN_PROGRESS', 'Ticket was not moved to IN_PROGRESS');
    ensure(normalizeId(started.data.assignedTo) || normalizeId(started.data.assignedTo?._id), 'Ticket missing assignedTo');

    await request({
      method: 'POST',
      reqPath: `/tickets/${ticketId}/comments`,
      token: opsToken,
      body: {
        content: 'OPS internal note for e2e coverage',
        isInternal: true,
      },
      expectedStatus: [200, 201],
    });

    const visibleComments = await request({
      reqPath: `/tickets/${ticketId}/comments`,
      token: teacherToken,
      expectedStatus: [200],
    });
    ensure(
      Array.isArray(visibleComments.data) && visibleComments.data.length === 0,
      'Teacher should not see internal comments',
    );

    const internalComments = await request({
      reqPath: `/tickets/${ticketId}/comments`,
      token: directorToken,
      expectedStatus: [200],
    });
    ensure(
      Array.isArray(internalComments.data) && internalComments.data.length >= 1,
      'Director should see internal comments',
    );

    const resolved = await request({
      method: 'POST',
      reqPath: `/tickets/${ticketId}/resolve`,
      token: directorToken,
      body: {
        summary: 'Resolved by e2e workflow',
        outcome: 'APPROVED',
      },
      expectedStatus: [200, 201],
    });
    ensure(resolved.data.status === 'RESOLVED', 'Ticket was not resolved');
    ensure(resolved.data.resolution && resolved.data.resolution.summary, 'Resolved ticket missing resolution');
  });

  await step('Ticket can be closed and reopened by workflow actions', async () => {
    const closed = await request({
      method: 'POST',
      reqPath: `/tickets/${ticketId}/close`,
      token: directorToken,
      expectedStatus: [200, 201],
    });
    ensure(closed.data.status === 'CLOSED', 'Ticket was not closed');

    const reopened = await request({
      method: 'POST',
      reqPath: `/tickets/${ticketId}/reopen`,
      token: directorToken,
      expectedStatus: [200, 201],
    });
    ensure(reopened.data.status === 'IN_PROGRESS', 'Ticket was not reopened to IN_PROGRESS');
    ensure(!reopened.data.resolution, 'Reopened ticket should clear resolution');
  });

  await step('Stats and my-tickets endpoints remain usable after the workflow', async () => {
    const stats = await request({
      reqPath: '/tickets/stats',
      token: directorToken,
      expectedStatus: [200],
    });
    ensure(Array.isArray(stats.data.byStatus), 'Stats missing byStatus');

    const staffTickets = await request({
      reqPath: '/tickets/assigned-to-me',
      token: opsToken,
      expectedStatus: [200],
    });
    ensure(Array.isArray(staffTickets.data?.data), 'Assigned-to-me response malformed');
  });

  console.log('\n=== Tickets Workflow Summary ===');
  console.log(`API Base : ${API_BASE}`);
  console.log(`PASS     : ${pass}`);
  console.log(`FAIL     : ${fail}`);

  if (fail > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
