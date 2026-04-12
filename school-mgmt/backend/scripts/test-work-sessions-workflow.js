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
  getSetCookieHeaders(res).forEach((entry) => {
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

    return { status: res.status, data: parsed.json, raw: parsed.text };
  } finally {
    clearTimeout(timer);
  }
}

async function loginWithRetry(email, password, maxRetries = 4) {
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
  throw new Error(`Login failed for ${email}`);
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

  summary() {
    const pass = this.results.filter((r) => r.status === 'PASS').length;
    const fail = this.results.filter((r) => r.status === 'FAIL').length;
    console.log('\n=== Work Sessions Workflow Summary ===');
    console.log(`API Base : ${API_BASE}`);
    console.log(`PASS     : ${pass}`);
    console.log(`FAIL     : ${fail}`);
    if (fail > 0) {
      console.log('\nFailed tests:');
      this.results
        .filter((r) => r.status === 'FAIL')
        .forEach((r) => console.log(`- ${r.name}: ${r.error}`));
    }
    return { pass, fail };
  }
}

function monthStartIso() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
}

function monthEndIso() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).toISOString();
}

async function main() {
  const runner = new TestRunner();
  console.log(`Testing work-sessions workflow against ${API_BASE}`);

  const accountEmails = {
    director: 'director.demo@school.local',
    accounting: 'accounting.demo@school.local',
    ops: 'ops.demo@school.local',
    teacher: 'teacher.demo@school.local',
    sale: 'sale.huong@school.local',
  };

  const auth = {};
  for (const [role, email] of Object.entries(accountEmails)) {
    const loginData = await loginWithRetry(email, DEMO_PASSWORD, 4);
    auth[role] = loginData;
    console.log(`- ${role.toUpperCase()} logged in (${email})`);
  }

  const teacherId = normalizeId(auth.teacher.user && (auth.teacher.user._id || auth.teacher.user.id));
  ensure(teacherId, 'Teacher user id is missing');

  const workRouteRes = await fetch(`${FRONTEND_BASE}/app/work-sessions`);
  ensure(workRouteRes.status === 200, `Frontend route /app/work-sessions must return 200, got ${workRouteRes.status}`);

  let baselineCount = 0;
  let baselineSummaryCount = 0;
  let activeSessionId = null;
  let activeSessionStatus = null;

  await runner.test('Teacher can read own work sessions and admin endpoint blocks teacher', async () => {
    const myRes = await request({
      method: 'GET',
      reqPath: '/work-sessions/my?page=1&limit=10',
      token: auth.teacher.token,
      expectedStatus: [200],
    });
    ensure(myRes.data && Array.isArray(myRes.data.data), 'Teacher work-session payload must include data array');
    ensure(myRes.data && myRes.data.meta, 'Teacher work-session payload must include meta');
    baselineCount = Number(myRes.data.meta.total || 0);

    const summaryRes = await request({
      method: 'GET',
      reqPath: `/work-sessions/summary?periodStart=${encodeURIComponent(monthStartIso())}&periodEnd=${encodeURIComponent(monthEndIso())}`,
      token: auth.director.token,
      expectedStatus: [200],
    });
    ensure(Array.isArray(summaryRes.data), 'Monthly work-session summary must return an array');
    const baselineRow = summaryRes.data.find((item) => normalizeId(item.userId) === teacherId || item.email === accountEmails.teacher);
    ensure(baselineRow, 'Monthly summary must include the teacher before generating a new session');
    baselineSummaryCount = Number(baselineRow.totalSessions || 0);

    await request({
      method: 'GET',
      reqPath: '/work-sessions?page=1&limit=5',
      token: auth.teacher.token,
      expectedStatus: [403],
    });
  });

  await runner.test('Login/logout creates a new work session for teacher', async () => {
    // Logging in again creates a fresh work session and auto-closes any active one.
    const loginAgain = await loginWithRetry(accountEmails.teacher, DEMO_PASSWORD, 2);
    auth.teacher = loginAgain;

    const teacherIdAfterLogin = normalizeId(loginAgain.user && (loginAgain.user._id || loginAgain.user.id));
    ensure(teacherIdAfterLogin === teacherId, 'Teacher identity changed unexpectedly');

    const myAfterLogin = await request({
      method: 'GET',
      reqPath: '/work-sessions/my?page=1&limit=5',
      token: auth.teacher.token,
      expectedStatus: [200],
    });
    const latest = myAfterLogin.data && Array.isArray(myAfterLogin.data.data) ? myAfterLogin.data.data[0] : null;
    ensure(latest, 'Teacher work-sessions list should contain at least one session after login');
    activeSessionId = normalizeId(latest._id);
    activeSessionStatus = latest.status;
    ensure(activeSessionId, 'Active work session id missing');
    ensure(activeSessionStatus === 'ACTIVE', `Latest work session should be ACTIVE after login, got ${activeSessionStatus}`);

    await request({
      method: 'POST',
      reqPath: '/auth/logout',
      token: auth.teacher.token,
      expectedStatus: [200, 201],
      body: {},
    });
  });

  await runner.test('Director can list, inspect and update teacher work session', async () => {
    const listRes = await request({
      method: 'GET',
      reqPath: `/work-sessions?userId=${teacherId}&page=1&limit=10`,
      token: auth.director.token,
      expectedStatus: [200],
    });
    ensure(listRes.data && Array.isArray(listRes.data.data), 'Director work-session list must include data array');
    const current = listRes.data.data.find((item) => normalizeId(item._id) === activeSessionId) || listRes.data.data[0];
    ensure(current, 'Director should see at least one work session for the teacher');
    ensure(
      normalizeId(current.userId && current.userId._id ? current.userId._id : current.userId) === teacherId
      || normalizeId(current.userId) === teacherId,
      'Listed work session must belong to the teacher',
    );

    const updateRes = await request({
      method: 'PATCH',
      reqPath: `/work-sessions/${normalizeId(current._id)}`,
      token: auth.director.token,
      expectedStatus: [200],
      body: { notes: `updated-by-e2e-${Date.now()}` },
    });
    ensure(typeof updateRes.data.notes === 'string', 'Updated work session must include notes');
    ensure((updateRes.data.notes || '').includes('updated-by-e2e-'), 'Work session note must be updated');
    activeSessionStatus = updateRes.data.status || activeSessionStatus;
  });

  await runner.test('Monthly summary reflects the new work session', async () => {
    const listRes = await request({
      method: 'GET',
      reqPath: '/work-sessions/my?page=1&limit=10',
      token: auth.teacher.token,
      expectedStatus: [200],
    });
    ensure(listRes.data && Array.isArray(listRes.data.data), 'Teacher list after login/logout must include data array');
    ensure(
      Number(listRes.data.meta && listRes.data.meta.total || 0) >= baselineCount + 1,
      'Teacher work-session list should gain one new record after login/logout flow',
    );

    const summaryRes = await request({
      method: 'GET',
      reqPath: `/work-sessions/summary?periodStart=${encodeURIComponent(monthStartIso())}&periodEnd=${encodeURIComponent(monthEndIso())}`,
      token: auth.director.token,
      expectedStatus: [200],
    });
    ensure(Array.isArray(summaryRes.data), 'Monthly work-session summary must return an array');
    const row = summaryRes.data.find((item) => normalizeId(item.userId) === teacherId || item.email === accountEmails.teacher);
    ensure(row, 'Monthly summary must include the teacher row');
    ensure(
      Number(row.totalSessions || 0) >= baselineSummaryCount + 2,
      `Monthly totalSessions should increase after login/logout flow (before=${baselineSummaryCount}, after=${row.totalSessions})`,
    );
    ensure(Number(row.totalMinutes || 0) >= 0, 'Monthly summary totalMinutes must be numeric');
  });

  const result = runner.summary();
  if (result.fail > 0) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
