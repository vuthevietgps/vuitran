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

function monthStartIso(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1).toISOString();
}

function monthEndIso(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999).toISOString();
}

function todayIso(date = new Date()) {
  return date.toISOString();
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
    console.log('\n=== Commission Report Workflow Summary ===');
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

function pickProduct(products) {
  return (products || []).find((p) => p && p.isActive !== false) || products[0];
}

async function main() {
  const runner = new TestRunner();
  console.log(`Testing commission-report workflow against ${API_BASE}`);

  const director = await loginWithRetry('director.demo@school.local', DEMO_PASSWORD);
  const accounting = await loginWithRetry('accounting.demo@school.local', DEMO_PASSWORD);
  const sale = await loginWithRetry('sale.huong@school.local', DEMO_PASSWORD);
  console.log('- DIRECTOR, ACCOUNTING, SALE logged in');

  const routeRes = await fetch(`${FRONTEND_BASE}/app/commission-report`);
  ensure(routeRes.status === 200, `Frontend route /app/commission-report must return 200, got ${routeRes.status}`);

  const productsRes = await request({
    method: 'GET',
    reqPath: '/products',
    token: director.token,
  });
  const product = pickProduct(productsRes.data || []);
  ensure(product, 'Need at least one active product for commission workflow');

  const productId = normalizeId(product._id);
  const productName = product.name || 'Commission test product';
  const amount = Number(product.suggestedPrice || product.pricePerSession || 150000) * Number(product.defaultSessions || 1);
  const saleCommission = Math.max(50000, Math.round(amount * 0.1));
  const uniqueSuffix = uniqueCode('COMM');

  const orderPayload = {
    orderType: 'NEW_ENROLLMENT',
    parentName: `Phu huynh ${uniqueSuffix}`,
    parentPhone: uniquePhone('09'),
    parentEmail: uniqueEmail('parent'),
    studentName: `Hoc sinh ${uniqueSuffix}`,
    studentGrade: product.gradeLevel || 'Grade 1',
    studentAge: 10,
    studentBirthMonth: 1,
    parentBirthMonth: 1,
    saleCommission,
    items: [
      {
        productId,
        productName,
        sessions: Number(product.defaultSessions || 1),
        sessionDuration: Number(product.defaultSessionDuration || 90),
        baseDuration: Number(product.defaultSessionDuration || 90),
        pricePerSession: Number(product.suggestedPrice || product.pricePerSession || 150000),
        amount,
        paymentRound: 1,
        teachingMode: product.teachingMode === 'OFFLINE' ? 'OFFLINE' : 'ONLINE',
        subject: product.category || 'ENGLISH',
        learningGoals: 'E2E commission workflow',
        maxStudents: 1,
        invoiceDescription: 'E2E commission workflow',
      },
    ],
    totalAmount: amount,
    discountAmount: 0,
    finalAmount: amount,
    paymentPlan: 'FULL',
    paymentDate: todayIso(),
    receiptImage: 'https://example.com/receipt.png',
    consultationNotes: 'Generated by commission-report workflow test',
    leadSource: 'WALK_IN',
  };

  let createdOrderId = null;
  let createdOrderCode = null;

  await runner.test('Create and approve a sale order for commission report', async () => {
    const createRes = await request({
      method: 'POST',
      reqPath: '/orders',
      token: sale.token,
      body: orderPayload,
      expectedStatus: [201],
    });
    createdOrderId = normalizeId(createRes.data?._id);
    createdOrderCode = createRes.data?.orderCode;
    ensure(createdOrderId, 'Order creation must return _id');

    const submitRes = await request({
      method: 'POST',
      reqPath: `/orders/${createdOrderId}/submit`,
      token: sale.token,
      expectedStatus: [200, 201],
    });
    ensure(submitRes.data?.status === 'SUBMITTED', 'Order should become SUBMITTED');

    const approveRes = await request({
      method: 'POST',
      reqPath: `/orders/${createdOrderId}/approve`,
      token: director.token,
      expectedStatus: [200, 201],
    });
    ensure(
      ['APPROVED', 'COMPLETED'].includes(approveRes.data?.order?.status),
      'Order should be APPROVED or COMPLETED',
    );
  });

  await runner.test('Director commission report reflects the approved order', async () => {
    const reportRes = await request({
      method: 'GET',
      reqPath: `/orders/commission-report?fromDate=${encodeURIComponent(monthStartIso())}&toDate=${encodeURIComponent(monthEndIso())}`,
      token: director.token,
    });
    const details = reportRes.data?.details || [];
    const summary = reportRes.data?.summary || {};
    const order = details.find((item) => item.orderCode === createdOrderCode || normalizeId(item._id) === createdOrderId);
    ensure(order, 'Commission report must include the created order');
    ensure(Number(order.saleCommission || 0) === saleCommission, 'Commission amount must match created order');
    ensure(Number(summary.pendingCommission || 0) >= saleCommission, 'Pending commission must reflect the approved order');
  });

  await runner.test('Sale and accounting can read commission report', async () => {
    const saleRes = await request({
      method: 'GET',
      reqPath: `/orders/commission-report?fromDate=${encodeURIComponent(monthStartIso())}&toDate=${encodeURIComponent(monthEndIso())}`,
      token: sale.token,
    });
    const accountingRes = await request({
      method: 'GET',
      reqPath: `/orders/commission-report?fromDate=${encodeURIComponent(monthStartIso())}&toDate=${encodeURIComponent(monthEndIso())}`,
      token: accounting.token,
    });
    ensure((saleRes.data?.details || []).some((item) => item.orderCode === createdOrderCode), 'Sale should see own commission report');
    ensure((accountingRes.data?.details || []).some((item) => item.orderCode === createdOrderCode), 'Accounting should see commission report');
  });

  const summary = runner.summary();
  process.exit(summary.fail > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
