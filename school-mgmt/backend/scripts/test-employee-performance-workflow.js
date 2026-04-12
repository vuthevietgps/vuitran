/* eslint-disable no-console */
const path = require('path');

try {
  // eslint-disable-next-line global-require
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
} catch (_) {}

const API_BASE = process.env.TEST_API_BASE || `http://localhost:${process.env.PORT || 3000}`;
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
    console.log('\n=== Employee Performance Workflow Summary ===');
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

function randomCode(prefix) {
  const stamp = Date.now().toString().slice(-8);
  const rand = Math.floor(Math.random() * 9999).toString().padStart(4, '0');
  return `${prefix}${stamp}${rand}`.toUpperCase();
}

function findTeacherByEmail(items, email) {
  return (items || []).find((item) => {
    const perfEmail = String(item?.email || '').toLowerCase();
    return perfEmail === String(email).toLowerCase();
  }) || null;
}

async function main() {
  const runner = new TestRunner();
  console.log(`Testing employee performance workflow against ${API_BASE}`);

  const director = await loginWithRetry('director.demo@school.local', DEMO_PASSWORD);

  const baseline = await request({
    method: 'GET',
    reqPath: '/dashboard/director/employee-performance',
    token: director.token,
    expectedStatus: [200],
  });

  const tempTeacherEmail = `teacher.${randomCode('perf')}@school.local`.toLowerCase();
  const tempTeacherCode = randomCode('GVKPI');
  const tempTeacherName = `Employee Perf ${tempTeacherCode.slice(-4)}`;
  let tempTeacherUser = null;

  try {
    await runner.test('Director can create a teacher used by employee-performance', async () => {
      const created = await request({
        method: 'POST',
        reqPath: '/users',
        token: director.token,
        expectedStatus: [200, 201],
        body: {
          userCode: tempTeacherCode,
          email: tempTeacherEmail,
          password: DEMO_PASSWORD,
          fullName: tempTeacherName,
          role: 'TEACHER',
        },
      });

      tempTeacherUser = created.data;
      ensure(tempTeacherUser && normalizeId(tempTeacherUser._id), 'Teacher user was not created');
    });

    await runner.test('Employee performance endpoint reflects the new teacher', async () => {
      const after = await request({
        method: 'GET',
        reqPath: '/dashboard/director/employee-performance',
        token: director.token,
        expectedStatus: [200],
      });

      const beforeTeachers = Array.isArray(baseline.data?.teachers) ? baseline.data.teachers : [];
      const afterTeachers = Array.isArray(after.data?.teachers) ? after.data.teachers : [];
      ensure(afterTeachers.length >= beforeTeachers.length + 1, 'Teacher count did not increase');

      const newTeacher = findTeacherByEmail(afterTeachers, tempTeacherEmail);
      ensure(newTeacher, 'New teacher not found in employee performance data');
      ensure(newTeacher.totalSessions === 0, 'New teacher should start with 0 sessions');
      ensure(newTeacher.reportRate === 0, 'New teacher should start with 0 report rate');
      ensure(newTeacher.avgRating === null, 'New teacher should have null avg rating');

      ensure(Array.isArray(after.data.sales), 'Sales performance array missing');
      ensure(Array.isArray(after.data.ops), 'Ops performance array missing');
    });

    await runner.test('Employee-performance page is protected from non-director access', async () => {
      const sale = await loginWithRetry('sale.huong@school.local', DEMO_PASSWORD);
      await request({
        method: 'GET',
        reqPath: '/dashboard/director/employee-performance',
        token: sale.token,
        expectedStatus: [403],
      });
    });
  } finally {
    if (tempTeacherUser && normalizeId(tempTeacherUser._id)) {
      try {
        const teacherList = await request({
          method: 'GET',
          reqPath: '/teachers',
          token: director.token,
          expectedStatus: [200],
        });
        const match = findTeacherByEmail(teacherList.data, tempTeacherEmail);
        if (match && normalizeId(match._id)) {
          await request({
            method: 'DELETE',
            reqPath: `/teachers/${normalizeId(match._id)}`,
            token: director.token,
            expectedStatus: [200, 204],
          });
        }
      } catch (err) {
        console.log(`[cleanup] teacher profile delete skipped: ${err.message}`);
      }

      try {
        await request({
          method: 'DELETE',
          reqPath: `/users/${normalizeId(tempTeacherUser._id)}`,
          token: director.token,
          expectedStatus: [200, 204],
        });
      } catch (err) {
        console.log(`[cleanup] teacher user delete skipped: ${err.message}`);
      }
    }
  }

  const { pass, fail } = runner.summary();
  process.exitCode = fail > 0 ? 1 : 0;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
