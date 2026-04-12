/* eslint-disable no-console */
const path = require('path');

try {
  // eslint-disable-next-line global-require
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
} catch (_) {}

const API_BASE = process.env.TEST_API_BASE || `http://localhost:${process.env.PORT || 3000}`;
const FRONTEND_BASE = process.env.TEST_FRONTEND_BASE || 'http://localhost:4200';
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'ChangeThisDemoPass2024!';
const REQUEST_TIMEOUT_MS = 45_000;
const LOGIN_RETRY_WAIT_MS = 65_000;

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

function uniqueSuffix() {
  const stamp = Date.now().toString().slice(-8);
  const rand = Math.floor(Math.random() * 9000).toString().padStart(4, '0');
  return `${stamp}${rand}`;
}

async function fetchRoute(url) {
  const res = await fetch(url, { redirect: 'manual' });
  return res.status;
}

function pickArray(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

async function main() {
  console.log(`Testing audit-log workflow against ${API_BASE}`);

  const director = await loginWithRetry('director.demo@school.local');
  const sale = await loginWithRetry('sale.huong@school.local');
  console.log('- DIRECTOR and SALE logged in');

  await request({
    reqPath: '/audit-log',
    token: director.token,
    expectedStatus: [200],
  });
  await request({
    reqPath: '/audit-log/stats',
    token: director.token,
    expectedStatus: [200],
  });
  await request({
    reqPath: '/audit-log',
    token: sale.token,
    expectedStatus: [403],
  });
  await request({
    reqPath: '/audit-log/stats',
    token: sale.token,
    expectedStatus: [403],
  });

  const routeStatus = await fetchRoute(`${FRONTEND_BASE}/app/audit-log`);
  ensure(routeStatus === 200, `Expected /app/audit-log => 200, got ${routeStatus}`);

  const productsRes = await request({
    reqPath: '/products',
    token: director.token,
    expectedStatus: [200],
  });
  let products = pickArray(productsRes.data);

  if (products.length === 0) {
    const createdProduct = await request({
      method: 'POST',
      reqPath: '/products',
      token: director.token,
      expectedStatus: [200, 201],
      body: {
        name: `Audit Log Product ${uniqueSuffix()}`,
        category: 'ENGLISH',
        teachingMode: 'BOTH',
        defaultSessions: 24,
        defaultSessionDuration: 90,
        pricePerSession: 250000,
        suggestedPrice: 6000000,
        commissionRate: 10,
        gradeLevel: 'Lop 3',
        highlights: ['Audit log workflow'],
        isActive: true,
      },
    });
    products = [createdProduct.data];
  }

  const product = products[0];
  const productId = normalizeId(product);
  ensure(productId, 'Failed to resolve productId');

  const suffix = uniqueSuffix();
  const studentName = `Audit Student ${suffix}`;
  const parentName = `Audit Parent ${suffix}`;
  const parentPhone = `09${suffix.slice(-8)}`;
  const orderCodeHint = `ORDER-AUD-${suffix}`;

  let orderId = null;
  let orderCode = null;
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

  await step('Create a sale-owned order that must appear in audit-log', async () => {
    const created = await request({
      method: 'POST',
      reqPath: '/orders',
      token: sale.token,
      expectedStatus: [200, 201],
      body: {
        orderType: 'NEW_ENROLLMENT',
        parentName,
        parentPhone,
        studentName,
        studentGrade: 'Lop 3',
        studentAge: 9,
        items: [
          {
            productId,
            productName: product.name || 'Audit Log Product',
            sessions: 2,
            sessionDuration: 90,
            baseDuration: 90,
            pricePerSession: 250000,
            amount: 500000,
            bonusSessions: 0,
            trialSessions: 0,
            paymentRound: 1,
            teacherPayPerSession: 100000,
            teacherPayPerStudent: 0,
            subject: 'English',
            learningGoals: 'Audit log workflow',
            maxStudents: 1,
            invoiceDescription: 'Audit log workflow order item',
            notes: 'Audit log workflow note',
          },
        ],
        totalAmount: 500000,
        finalAmount: 500000,
        paymentPlan: 'FULL',
        consultationNotes: 'Audit log workflow consultation',
      },
    });
    orderId = normalizeId(created.data);
    orderCode = created.data?.orderCode;
    ensure(orderId, 'orderId must be created');
    ensure(orderCode, 'orderCode must be generated');
  });

  await step('Patch order and submit it to generate additional audit entries', async () => {
    await request({
      method: 'PATCH',
      reqPath: `/orders/${orderId}`,
      token: sale.token,
      expectedStatus: [200],
      body: {
        paymentDate: new Date().toISOString(),
        receiptImage: `/uploads/audit-log-${suffix}.jpg`,
      },
    });

    await request({
      method: 'POST',
      reqPath: `/orders/${orderId}/submit`,
      token: sale.token,
      expectedStatus: [200, 201],
    });
  });

  await step('Audit-log search and filters return the generated order actions', async () => {
    const searchTerm = encodeURIComponent(orderCode || studentName);

    const createLogs = await request({
      reqPath: `/audit-log?search=${searchTerm}&module=ORDERS&action=CREATE`,
      token: director.token,
      expectedStatus: [200],
    });
    const createRows = pickArray(createLogs.data);
    ensure(createRows.length >= 1, 'Expected at least one CREATE audit entry for the order');
    ensure(
      createRows.some((row) => String(row.targetName || '').includes(orderCode) || String(row.description || '').includes(studentName)),
      'CREATE audit entry must mention the generated order',
    );

    const updateLogs = await request({
      reqPath: `/audit-log?search=${searchTerm}&module=ORDERS&action=UPDATE`,
      token: director.token,
      expectedStatus: [200],
    });
    const updateRows = pickArray(updateLogs.data);
    ensure(updateRows.length >= 1, 'Expected at least one UPDATE audit entry for the order');

    const statusLogs = await request({
      reqPath: `/audit-log?search=${searchTerm}&module=ORDERS&action=STATUS_CHANGE`,
      token: director.token,
      expectedStatus: [200],
    });
    const statusRows = pickArray(statusLogs.data);
    ensure(statusRows.length >= 1, 'Expected at least one STATUS_CHANGE audit entry for the order');

    const moduleLogs = await request({
      reqPath: `/audit-log?search=${searchTerm}&module=ORDERS`,
      token: director.token,
      expectedStatus: [200],
    });
    const moduleRows = pickArray(moduleLogs.data);
    ensure(moduleRows.length >= 3, 'Expected the order search to return all generated order audit rows');
  });

  await step('Audit-log stats reflect the new activity', async () => {
    const stats = await request({
      reqPath: '/audit-log/stats',
      token: director.token,
      expectedStatus: [200],
    });
    ensure(typeof stats.data?.todayCount === 'number', 'todayCount must be a number');
    ensure(Array.isArray(stats.data?.recentActivity), 'recentActivity must be an array');
    ensure((stats.data?.byModule?.ORDERS || 0) >= 3, 'ORDERS module stats must reflect generated actions');
    ensure((stats.data?.byAction?.CREATE || 0) >= 1, 'CREATE stats must be present');
    ensure((stats.data?.byAction?.UPDATE || 0) >= 1, 'UPDATE stats must be present');
    ensure((stats.data?.byAction?.STATUS_CHANGE || 0) >= 1, 'STATUS_CHANGE stats must be present');
  });

  console.log('\n=== Audit Log Workflow Summary ===');
  console.log(`API Base : ${API_BASE}`);
  console.log(`PASS     : ${pass}`);
  console.log(`FAIL     : ${fail}`);

  if (fail > 0) process.exit(1);
}

main().catch((err) => {
  console.error('\nUnhandled error in audit-log workflow test');
  console.error(err && err.stack ? err.stack : err);
  process.exit(1);
});
