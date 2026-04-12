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

async function login(email, password = DEMO_PASSWORD) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  const parsed = await parseResponse(res);
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

  throw new Error(`Unable to login ${email}`);
}

function uniqueCode(prefix) {
  const stamp = Date.now().toString().slice(-8);
  const rand = Math.floor(Math.random() * 9999).toString().padStart(4, '0');
  return `${prefix}${stamp}${rand}`.toUpperCase();
}

function uniquePhone(prefix = '09') {
  const tail = `${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(-8);
  return `${prefix}${tail}`;
}

function uniqueEmail(prefix = 'test') {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}@school.local`;
}

function monthStartIso(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1).toISOString();
}

function monthEndIso(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999).toISOString();
}

function todayIso(date = new Date()) {
  return date.toISOString();
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
    console.log('\n=== Staff Payroll Workflow Summary ===');
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

async function main() {
  const runner = new TestRunner();
  console.log(`Testing staff-payroll workflow against ${API_BASE}`);

  const director = await loginWithRetry('director.demo@school.local', DEMO_PASSWORD);
  const accounting = await loginWithRetry('accounting.demo@school.local', DEMO_PASSWORD);
  console.log('- DIRECTOR and ACCOUNTING logged in');

  const routeRes = await fetch(`${FRONTEND_BASE}/app/staff-payroll`);
  ensure(routeRes.status === 200, `Frontend route /app/staff-payroll must return 200, got ${routeRes.status}`);

  const tempUserPayload = {
    userCode: uniqueCode('SPU'),
    email: uniqueEmail('staffpay'),
    password: DEMO_PASSWORD,
    fullName: `Staff Payroll ${uniqueCode('TEA')}`,
    role: 'TEACHER',
    phone: uniquePhone(),
  };

  let targetUserId = null;
  let tempTeacher = null;

  await runner.test('Director can create a temporary teacher and salary config', async () => {
    const createUserRes = await request({
      method: 'POST',
      reqPath: '/users',
      token: director.token,
      body: tempUserPayload,
      expectedStatus: [201],
    });
    targetUserId = normalizeId(createUserRes.data?._id);
    ensure(targetUserId, 'Temp teacher creation must return _id');
    tempTeacher = await loginWithRetry(tempUserPayload.email, DEMO_PASSWORD);

    await request({
      method: 'POST',
      reqPath: '/salary-config',
      token: director.token,
      body: {
        userId: targetUserId,
        baseSalary: 4000000,
        standardHours: 176,
        scheduledStartTime: '08:00',
        latePenaltyAmount: 25000,
        commissionEnabled: false,
        commissionType: 'PROGRESSIVE',
        commissionTiers: [],
        kpiBonusEnabled: false,
        kpiBonusTiers: [],
        notes: `staff-payroll-e2e-${uniqueCode('SP')}`,
      },
      expectedStatus: [201],
    });
  });

  await runner.test('Create and adjust a work session for the temporary teacher', async () => {
    await loginWithRetry(tempUserPayload.email, DEMO_PASSWORD);
    await request({
      method: 'POST',
      reqPath: '/auth/logout',
      token: tempTeacher.token,
      expectedStatus: [200, 201],
    });

    const sessionsRes = await request({
      method: 'GET',
      reqPath: '/work-sessions/my?page=1&limit=5',
      token: tempTeacher.token,
    });
    const latest = (sessionsRes.data?.data || sessionsRes.data || [])[0];
    ensure(latest, 'Teacher should have at least one work session after login/logout');

    const loginAt = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const logoutAt = new Date().toISOString();
    await request({
      method: 'PATCH',
      reqPath: `/work-sessions/${normalizeId(latest._id)}`,
      token: director.token,
      body: {
        loginTime: loginAt,
        logoutTime: logoutAt,
        notes: `Adjusted for staff-payroll e2e ${uniqueCode('WS')}`,
      },
    });
  });

  await runner.test('Generate, submit, approve and mark a staff payroll', async () => {
    const periodStart = monthStartIso();
    const periodEnd = monthEndIso();
    const genRes = await request({
      method: 'POST',
      reqPath: '/staff-payroll',
      token: director.token,
      body: {
        userId: targetUserId,
        periodStart,
        periodEnd,
        bonusAmount: 0,
        deductionAmount: 0,
        notes: `generated-${uniqueCode('PAY')}`,
      },
      expectedStatus: [201],
    });
    payrollId = normalizeId(genRes.data?._id);
    ensure(payrollId, 'Payroll generation must return _id');

    const submitRes = await request({
      method: 'POST',
      reqPath: `/staff-payroll/${payrollId}/submit`,
      token: accounting.token,
      expectedStatus: [200, 201],
    });
    ensure(submitRes.data?.status === 'PENDING_REVIEW', 'Payroll should become PENDING_REVIEW');

    const approveRes = await request({
      method: 'POST',
      reqPath: `/staff-payroll/${payrollId}/approve`,
      token: director.token,
      expectedStatus: [200, 201],
    });
    ensure(approveRes.data?.status === 'APPROVED', 'Payroll should become APPROVED');

    const paidRes = await request({
      method: 'POST',
      reqPath: `/staff-payroll/${payrollId}/mark-paid`,
      token: accounting.token,
      body: { paymentRef: uniqueCode('BANK') },
      expectedStatus: [200, 201],
    });
    ensure(paidRes.data?.status === 'PAID', 'Payroll should become PAID');
  });

  await runner.test('Teacher and director can see the generated payroll', async () => {
    const teacherMyRes = await request({
      method: 'GET',
      reqPath: `/staff-payroll/my?fromDate=${encodeURIComponent(monthStartIso())}&toDate=${encodeURIComponent(todayIso())}`,
      token: tempTeacher.token,
    });
    const teacherItems = teacherMyRes.data?.data || teacherMyRes.data || [];
    ensure(teacherItems.some((p) => normalizeId(p._id) === payrollId), 'Teacher should see the payroll in my view');

    const listRes = await request({
      method: 'GET',
      reqPath: `/staff-payroll?userId=${encodeURIComponent(targetUserId)}&fromDate=${encodeURIComponent(monthStartIso())}&toDate=${encodeURIComponent(todayIso())}`,
      token: director.token,
    });
    ensure((listRes.data?.data || []).some((p) => normalizeId(p._id) === payrollId), 'Director should see the generated payroll in list');
  });

  const summary = runner.summary();
  process.exit(summary.fail > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
