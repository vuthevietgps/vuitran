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

async function fetchRoute(url) {
  const res = await fetch(url, { redirect: 'manual' });
  return res.status;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

async function main() {
  console.log(`Testing attendance-report workflow against ${API_BASE}`);

  const directorToken = await loginWithRetry('director.demo@school.local');
  const teacherToken = await loginWithRetry('teacher.demo@school.local');
  const parentToken = await loginWithRetry('parent.demo@school.local');
  console.log('- DIRECTOR, TEACHER, PARENT logged in');

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

  const testDate = todayIso();
  let classId;
  let studentId;
  let attendanceId;

  await step('Frontend route is reachable and parent is blocked from attendance report', async () => {
    const routeStatus = await fetchRoute(`${FRONTEND_BASE}/app/attendance-report`);
    ensure(routeStatus === 200, `Expected /app/attendance-report => 200, got ${routeStatus}`);

    await request({
      reqPath: `/attendance/report?startDate=${testDate}&endDate=${testDate}`,
      token: parentToken,
      expectedStatus: [403],
    });
  });

  await step('Director can discover a class with students and create attendance for the report', async () => {
    const classesRes = await request({
      reqPath: '/attendance/classes-with-students',
      token: directorToken,
      expectedStatus: [200],
    });
    const classes = Array.isArray(classesRes.data) ? classesRes.data : classesRes.data?.data || [];
    ensure(Array.isArray(classes) && classes.length > 0, 'No classes with students available');

    const chosenClass = classes.find((item) => Array.isArray(item.students) && item.students.length > 0);
    ensure(chosenClass, 'No class with at least one student available');
    classId = normalizeId(chosenClass._id || chosenClass.id || chosenClass.classId);
    ensure(classId, 'Could not resolve classId');

    const students = Array.isArray(chosenClass.students) ? chosenClass.students : [];
    ensure(students.length > 0, 'Chosen class has no students');
    studentId = normalizeId(students[0]._id || students[0].studentId || students[0].id);
    ensure(studentId, 'Could not resolve studentId');

    const markRes = await request({
      method: 'POST',
      reqPath: '/attendance/mark',
      token: directorToken,
      body: {
        classId,
        studentId,
        date: testDate,
        status: 'PRESENT',
        notes: `attendance-report workflow ${testDate}`,
      },
      expectedStatus: [200, 201],
    });
    attendanceId = normalizeId(markRes.data && (markRes.data._id || markRes.data.id));
    ensure(attendanceId, 'Failed to resolve attendanceId');

    const updateRes = await request({
      method: 'PATCH',
      reqPath: `/attendance/${attendanceId}`,
      token: directorToken,
      body: {
        status: 'PRESENT',
        notes: `attendance-report workflow updated ${testDate}`,
      },
      expectedStatus: [200, 201],
    });
    ensure(normalizeId(updateRes.data && (updateRes.data._id || updateRes.data.id)) === attendanceId, 'Attendance update did not keep same record');
  });

  await step('Attendance report returns the created record for director and teacher', async () => {
    const directorReport = await request({
      reqPath: `/attendance/report?startDate=${testDate}&endDate=${testDate}&classId=${classId}&page=1&limit=20`,
      token: directorToken,
      expectedStatus: [200],
    });
    const directorItems = Array.isArray(directorReport.data?.data) ? directorReport.data.data : [];
    ensure(directorItems.length > 0, 'Director report should include at least one row');
    const hit = directorItems.find((item) => normalizeId(item.classId && item.classId._id) === classId && normalizeId(item.studentId && item.studentId._id) === studentId);
    ensure(hit, 'Created attendance record not found in report');

    const teacherReport = await request({
      reqPath: `/attendance/report?startDate=${testDate}&endDate=${testDate}&classId=${classId}&page=1&limit=20`,
      token: teacherToken,
      expectedStatus: [200],
    });
    const teacherItems = Array.isArray(teacherReport.data?.data) ? teacherReport.data.data : [];
    ensure(Array.isArray(teacherItems), 'Teacher report payload missing data array');
  });

  console.log('\n=== Attendance Report Workflow Summary ===');
  console.log(`API Base : ${API_BASE}`);
  console.log(`PASS     : ${pass}`);
  console.log(`FAIL     : ${fail}`);

  if (fail > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
