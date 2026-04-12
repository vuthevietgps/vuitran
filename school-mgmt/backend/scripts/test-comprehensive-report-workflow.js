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

    return { status: res.status, data: parsed.json, raw: parsed.text, headers: res.headers };
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

function uniqueSuffix() {
  return `${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 900 + 100)}`;
}

async function fetchRoute(url) {
  const res = await fetch(url, { redirect: 'manual' });
  return res.status;
}

async function main() {
  console.log(`Testing comprehensive-report workflow against ${API_BASE}`);

  const director = await loginWithRetry('director.demo@school.local');
  const teacher = await loginWithRetry('teacher.demo@school.local');
  const accounting = await loginWithRetry('accounting.demo@school.local');
  const sale = await loginWithRetry('sale.huong@school.local');
  console.log('- DIRECTOR, TEACHER, ACCOUNTING, SALE logged in');

  const teacherId = normalizeId(teacher.user);
  ensure(teacherId, 'Teacher demo id missing');

  const suffix = uniqueSuffix();
  const studentCode = `CRPT-${suffix}`;
  const studentName = `Comprehensive Report ${suffix}`;
  const parentName = `Parent CR ${suffix}`;
  const classCode = `CLS-CR-${suffix}`;
  const className = `Class Comprehensive Report ${suffix}`;
  const reportDate = new Date().toISOString().slice(0, 10);

  let studentId = null;
  let classId = null;
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

  await step('Frontend route and RBAC baseline are correct', async () => {
    const routeStatus = await fetchRoute(`${FRONTEND_BASE}/app/comprehensive-report`);
    ensure(routeStatus === 200, `Expected /app/comprehensive-report => 200, got ${routeStatus}`);

    await request({
      reqPath: '/students/comprehensive-report',
      token: teacher.token,
      expectedStatus: [403],
    });

    await request({
      reqPath: '/students/comprehensive-report',
      token: accounting.token,
      expectedStatus: [200],
    });
  });

  await step('Director can create student/class and teacher can mark attendance', async () => {
    const createdStudent = await request({
      method: 'POST',
      reqPath: '/students',
      token: director.token,
      expectedStatus: [200, 201],
      body: {
        studentCode,
        fullName: studentName,
        age: 10,
        parentName,
        parentPhone: `09${suffix.slice(-8)}`,
        faceImage: 'default-avatar.png',
        studentType: 'ONLINE',
        saleId: normalizeId(sale.user),
        saleName: sale.user?.fullName || 'Sale Demo',
      },
    });
    studentId = normalizeId(createdStudent.data);
    ensure(studentId, 'Failed to resolve studentId');

    await request({
      method: 'POST',
      reqPath: `/students/${studentId}/approve`,
      token: director.token,
      expectedStatus: [200, 201],
      body: { action: 'APPROVE' },
    });

    const createdClass = await request({
      method: 'POST',
      reqPath: '/classes',
      token: director.token,
      expectedStatus: [200, 201],
      body: {
        name: className,
        code: classCode,
        teacherId,
        saleId: normalizeId(sale.user),
        classMode: 'ONLINE',
        subject: 'Tieng Anh',
        grade: 'Lop 4',
        learningGoals: 'Kiem tra bao cao tong hop',
        pricePerSession: 150000,
        teacherPayPerSession: 70000,
        baseDuration: 90,
        sessionDuration: 90,
        maxStudents: 1,
        studentIds: [studentId],
      },
    });
    classId = normalizeId(createdClass.data);
    ensure(classId, 'Failed to resolve classId');

    const attendance = await request({
      method: 'POST',
      reqPath: '/attendance/mark',
      token: director.token,
      expectedStatus: [200, 201],
      body: {
        classId,
        studentId,
        date: reportDate,
        status: 'PRESENT',
        notes: 'Comprehensive report e2e attendance',
      },
    });
    ensure(normalizeId(attendance.data?.studentId) === studentId, 'Attendance did not target expected student');
  });

  await step('Comprehensive report includes the created student/class pair', async () => {
    const directorReport = await request({
      reqPath: `/students/comprehensive-report?classId=${classId}&searchTerm=${encodeURIComponent(studentCode)}`,
      token: director.token,
      expectedStatus: [200],
    });

    ensure(directorReport.data && Array.isArray(directorReport.data.rows), 'Comprehensive report missing rows');
    const row = directorReport.data.rows.find((item) => normalizeId(item.classId) === classId);
    ensure(row, 'Created class did not appear in comprehensive report');
    ensure(row.studentCode === studentCode, 'Comprehensive report studentCode mismatch');
    ensure(Number(row.attendedCount || 0) >= 1, 'Comprehensive report should show at least one attended session');
    ensure(Number(row.sessionsCompleted || 0) >= 1, 'Comprehensive report should show completed sessions');
    ensure(row.teacherCodeAndName || row.teacherName, 'Comprehensive report should resolve teacher info');

    const accountingReport = await request({
      reqPath: `/students/comprehensive-report?classId=${classId}`,
      token: accounting.token,
      expectedStatus: [200],
    });
    ensure(Array.isArray(accountingReport.data.rows), 'Accounting report rows missing');
    ensure(
      accountingReport.data.rows.some((item) => normalizeId(item.classId) === classId),
      'Accounting should see the same comprehensive report row',
    );
  });

  await step('Student list and student report stay aligned with the same data', async () => {
    const studentReport = await request({
      reqPath: `/students/report?classId=${classId}&searchTerm=${encodeURIComponent(studentName)}`,
      token: director.token,
      expectedStatus: [200],
    });
    ensure(Array.isArray(studentReport.data), 'Student report should be an array');
    ensure(
      studentReport.data.some((item) => normalizeId(item._id) === studentId || item.studentCode === studentCode),
      'Student report should include the created student',
    );

    const studentList = await request({
      reqPath: '/students',
      token: director.token,
      expectedStatus: [200],
    });
    ensure(
      Array.isArray(studentList.data) && studentList.data.some((item) => item.studentCode === studentCode),
      'Student list should include the created student',
    );
  });

  await step('Sale can see the same comprehensive row for the owned student', async () => {
    const saleReport = await request({
      reqPath: `/students/comprehensive-report?classId=${classId}&searchTerm=${encodeURIComponent(studentCode)}`,
      token: sale.token,
      expectedStatus: [200],
    });
    ensure(Array.isArray(saleReport.data.rows), 'Sale report rows missing');
    const saleRow = saleReport.data.rows.find((item) => normalizeId(item.classId) === classId);
    ensure(saleRow, 'Sale should see the owned class row');
    ensure(saleRow.saleId === normalizeId(sale.user), 'Sale row should be owned by the sale actor');
  });

  console.log('\n=== Comprehensive Report Workflow Summary ===');
  console.log(`API Base : ${API_BASE}`);
  console.log(`PASS     : ${pass}`);
  console.log(`FAIL     : ${fail}`);

  if (fail > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
