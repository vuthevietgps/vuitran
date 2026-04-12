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

async function uploadReceipt({ token, fileName }) {
  const pngBase64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7+VXwAAAAASUVORK5CYII=';
  const pngBuffer = Buffer.from(pngBase64, 'base64');
  const form = new FormData();
  form.append('file', new Blob([pngBuffer], { type: 'image/png' }), fileName);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const headers = {};
    if (token) headers.Cookie = token;
    const xsrf = extractXsrfFromCookieHeader(token);
    if (xsrf) headers['X-XSRF-TOKEN'] = xsrf;

    const res = await fetch(`${API_BASE}/invoices/receipt-upload`, {
      method: 'POST',
      headers,
      body: form,
      signal: controller.signal,
    });

    const parsed = await parseResponse(res);
    if (res.status !== 200 && res.status !== 201) {
      throw new Error(
        `POST /invoices/receipt-upload expected [200,201] but got ${res.status}. Response: ${parsed.text.slice(0, 500)}`,
      );
    }

    ensure(parsed.json && parsed.json.url, 'Receipt upload did not return url');
    return parsed.json.url;
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

function pickInvoice(list) {
  return (Array.isArray(list) ? list : []).find((item) => item && item.invoiceType === 'TUITION') || list?.[0];
}

async function main() {
  console.log(`Testing aging-report workflow against ${API_BASE}`);

  const director = await loginWithRetry('director.demo@school.local', DEMO_PASSWORD);
  const accounting = await loginWithRetry('accounting.demo@school.local', DEMO_PASSWORD);
  const sale = await loginWithRetry('sale.huong@school.local', DEMO_PASSWORD);
  const parent = await loginWithRetry('parent.demo@school.local', DEMO_PASSWORD);
  const teacher = await loginWithRetry('teacher.demo@school.local', DEMO_PASSWORD);
  console.log('- DIRECTOR, ACCOUNTING, SALE, PARENT, TEACHER logged in');

  const routeRes = await fetch(`${FRONTEND_BASE}/app/aging-report`);
  ensure(routeRes.status === 200, `Frontend route /app/aging-report must return 200, got ${routeRes.status}`);

  const reportBefore = await request({
    method: 'GET',
    reqPath: '/financial-control/aging-report',
    token: director.token,
    expectedStatus: [200],
  });
  const baselineTotalAR = Number(reportBefore.data?.summary?.totalAR || 0);
  const baselineCount = Array.isArray(reportBefore.data?.details) ? reportBefore.data.details.length : 0;

  let studentId = null;
  let invoiceId = null;
  let invoiceNumber = null;
  let invoiceAmount = 0;
  let receiptImage = null;

  await request({
    method: 'GET',
    reqPath: '/financial-control/aging-report',
    token: teacher.token,
    expectedStatus: [403],
  });

  const studentsRes = await request({
    method: 'GET',
    reqPath: '/students',
    token: director.token,
    expectedStatus: [200],
  });
  const students = Array.isArray(studentsRes.data) ? studentsRes.data : studentsRes.data?.data || [];
  const parentStudent = students.find((student) => normalizeId(student?.parentUserId) && student.parentPhone);
  ensure(parentStudent, 'Need at least one student with parent linkage for aging workflow');
  studentId = normalizeId(parentStudent._id);
  ensure(studentId, 'Student id missing for aging workflow');

  if (normalizeId(parentStudent.saleId) !== normalizeId(sale.user?._id)) {
    await request({
      method: 'PATCH',
      reqPath: `/students/${studentId}`,
      token: director.token,
      expectedStatus: [200],
      body: { saleId: normalizeId(sale.user?._id), saleName: sale.user?.fullName || 'Sale Demo' },
    });
  }

  const beforeParentInvoices = await request({
    method: 'GET',
    reqPath: '/invoices/my-children',
    token: parent.token,
    expectedStatus: [200],
  });
  ensure(beforeParentInvoices.data, 'Accounting should be able to read invoice view');

  receiptImage = await uploadReceipt({
    token: sale.token,
    fileName: `aging-report-${Date.now()}.png`,
  });

  invoiceNumber = uniqueCode('AGING');
  invoiceAmount = 987654;
  const invoiceCreate = await request({
    method: 'POST',
    reqPath: '/invoices',
    token: sale.token,
    expectedStatus: [200, 201],
    body: {
      invoiceNumber,
      invoiceType: 'TUITION',
      classType: 'ONLINE',
      studentId,
      sessions: 6,
      bonusSessions: 0,
      trialSessions: 0,
      paymentRound: 1,
      courseStatus: 'NEW',
      pricePerSession: Math.floor(invoiceAmount / 6),
      referenceDuration: 60,
      amount: invoiceAmount,
      paymentDate: new Date().toISOString().slice(0, 10),
      receiptImage,
      description: 'Aging report workflow',
    },
  });
  invoiceId = normalizeId(invoiceCreate.data && invoiceCreate.data._id);
  ensure(invoiceId, 'Invoice id missing after create');
  ensure(invoiceCreate.data.status === 'PENDING_APPROVAL', 'Invoice should remain pending approval');

  const reportAfterCreate = await request({
    method: 'GET',
    reqPath: '/financial-control/aging-report',
    token: accounting.token,
    expectedStatus: [200],
  });
  const afterDetails = Array.isArray(reportAfterCreate.data?.details) ? reportAfterCreate.data.details : [];
  const afterTotalAR = Number(reportAfterCreate.data?.summary?.totalAR || 0);
  const matchingDetail = afterDetails.find((item) =>
    (item.students || []).includes(parentStudent.fullName) ||
    item.parentPhone === parentStudent.parentPhone ||
    Number(item.totalDebt || 0) >= invoiceAmount,
  );
  ensure(afterTotalAR >= baselineTotalAR + invoiceAmount, 'Aging totalAR should increase after pending invoice');
  ensure(afterDetails.length >= baselineCount, 'Aging details should not shrink after adding pending invoice');
  ensure(matchingDetail, 'Aging report should include the newly created pending invoice bucket');

  await request({
    method: 'POST',
    reqPath: `/invoices/${invoiceId}/approve`,
    token: accounting.token,
    expectedStatus: [200, 201],
    body: {
      action: 'APPROVE',
      approvalImage: '/uploads/invoices/approval-aging-report.png',
    },
  });

  const reportAfterApprove = await request({
    method: 'GET',
    reqPath: '/financial-control/aging-report',
    token: director.token,
    expectedStatus: [200],
  });
  const finalTotalAR = Number(reportAfterApprove.data?.summary?.totalAR || 0);
  ensure(finalTotalAR <= afterTotalAR - invoiceAmount, 'Aging totalAR should drop after invoice approval');

  console.log('\n=== Aging Report Workflow Summary ===');
  console.log(`API Base : ${API_BASE}`);
  console.log(`Baseline : ${baselineTotalAR}`);
  console.log(`After    : ${afterTotalAR}`);
  console.log(`Final    : ${finalTotalAR}`);
  console.log('PASS     : 1');
  console.log('FAIL     : 0');
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
