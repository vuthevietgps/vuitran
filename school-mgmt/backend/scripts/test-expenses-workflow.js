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
  if (res.status === 429) {
    throw new Error(`Login throttled for ${email}`);
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

const todayISO = () => new Date().toISOString().slice(0, 10);
const stamp = Date.now().toString().slice(-8);
const uniqueExpenseTitle = `E2E Chi phi ${stamp}`;
const uniqueExpenseDescription = `Workflow test expenses ${stamp}`;

async function main() {
  console.log(`Testing expenses workflow against ${API_BASE}`);

  const [ops, accounting, director] = await Promise.all([
    loginWithRetry('ops.demo@school.local'),
    login('accounting.demo@school.local'),
    login('director.demo@school.local'),
  ]);

  console.log('- OPS, ACCOUNTING, DIRECTOR logged in');

  const frontendRoute = await fetch(`${FRONTEND_BASE}/app/expenses`);
  ensure(frontendRoute.status === 200, `Frontend route /app/expenses returned ${frontendRoute.status}`);

  const baseDashboard = await request({
    method: 'GET',
    reqPath: '/financial-control/dashboard',
    token: director.token,
    expectedStatus: 200,
  });
  const baseStats = await request({
    method: 'GET',
    reqPath: '/expenses/stats',
    token: accounting.token,
    expectedStatus: 200,
  });

  const basePending = Number(baseDashboard.data?.obligations?.expensePayable || 0);
  const basePendingCount = Number(baseDashboard.data?.obligations?.expensePayableCount || 0);
  const baseStatsCount = Number(baseStats.data?.totalCount || 0);
  const basePendingStatusCount = Number(baseStats.data?.byStatus?.PENDING_APPROVAL?.count || 0);
  const baseApprovedStatusCount = Number(baseStats.data?.byStatus?.APPROVED_UNPAID?.count || 0);
  const basePaidStatusCount = Number(baseStats.data?.byStatus?.PAID?.count || 0);

  const createRes = await request({
    method: 'POST',
    reqPath: '/expenses',
    token: ops.token,
    body: {
      title: uniqueExpenseTitle,
      description: uniqueExpenseDescription,
      amount: 765432,
      expenseDate: todayISO(),
      category: 'TRAINING',
      notes: 'Tao tu workflow e2e',
    },
    expectedStatus: [200, 201],
  });

  const expenseId = createRes.data?._id || createRes.data?.id;
  ensure(expenseId, 'Expense id is missing after create');
  ensure(createRes.data?.paymentStatus === 'PENDING_APPROVAL', 'New expense must start as PENDING_APPROVAL');

  const listRes = await request({
    method: 'GET',
    reqPath: `/expenses?keyword=${encodeURIComponent(stamp)}`,
    token: ops.token,
    expectedStatus: 200,
  });
  const createdExpense = (listRes.data?.data || []).find((item) => String(item._id || item.id) === String(expenseId));
  ensure(createdExpense, 'Created expense was not returned from list endpoint');

  const afterCreateStats = await request({
    method: 'GET',
    reqPath: '/expenses/stats',
    token: accounting.token,
    expectedStatus: 200,
  });
  const afterCreateDashboard = await request({
    method: 'GET',
    reqPath: '/financial-control/dashboard',
    token: director.token,
    expectedStatus: 200,
  });

  ensure(Number(afterCreateStats.data?.totalCount || 0) === baseStatsCount + 1, 'Stats totalCount must increase by 1 after create');
  ensure(
    Number(afterCreateStats.data?.byStatus?.PENDING_APPROVAL?.count || 0) === basePendingStatusCount + 1,
    'Pending approval count must increase by 1 after create',
  );
  ensure(
    Number(afterCreateDashboard.data?.obligations?.expensePayable || 0) === basePending,
    'Financial dashboard expense payable must stay unchanged while expense is still pending approval',
  );
  ensure(
    Number(afterCreateDashboard.data?.obligations?.expensePayableCount || 0) === basePendingCount,
    'Financial dashboard expense payable count must stay unchanged while expense is still pending approval',
  );

  const opsApproveDenied = await request({
    method: 'POST',
    reqPath: `/expenses/${expenseId}/approve`,
    token: ops.token,
    expectedStatus: 403,
  });
  ensure(opsApproveDenied.status === 403, 'OPS must be blocked from approving expenses');

  const approveRes = await request({
    method: 'POST',
    reqPath: `/expenses/${expenseId}/approve`,
    token: accounting.token,
    expectedStatus: [200, 201],
  });
  ensure(approveRes.data?.paymentStatus === 'APPROVED_UNPAID', 'Approved expense must switch to APPROVED_UNPAID');

  const afterApproveStats = await request({
    method: 'GET',
    reqPath: '/expenses/stats',
    token: accounting.token,
    expectedStatus: 200,
  });
  const afterApproveDashboard = await request({
    method: 'GET',
    reqPath: '/financial-control/dashboard',
    token: director.token,
    expectedStatus: 200,
  });

  ensure(
    Number(afterApproveStats.data?.byStatus?.PENDING_APPROVAL?.count || 0) === basePendingStatusCount,
    'Pending approval count must return to baseline after approve',
  );
  ensure(
    Number(afterApproveStats.data?.byStatus?.APPROVED_UNPAID?.count || 0) === baseApprovedStatusCount + 1,
    'Approved unpaid count must increase by 1 after approve',
  );
  ensure(
    Number(afterApproveDashboard.data?.obligations?.expensePayable || 0) === basePending + 765432,
    'Financial dashboard expense payable must stay pending after approve',
  );

  const payRes = await request({
    method: 'POST',
    reqPath: `/expenses/${expenseId}/mark-paid`,
    token: accounting.token,
    body: {
      paymentMethod: 'CASH',
      paidAt: todayISO(),
      notes: 'Thanh toan test e2e',
    },
    expectedStatus: [200, 201],
  });
  ensure(payRes.data?.paymentStatus === 'PAID', 'Paid expense must switch to PAID');

  const afterPayStats = await request({
    method: 'GET',
    reqPath: '/expenses/stats',
    token: accounting.token,
    expectedStatus: 200,
  });
  const afterPayDashboard = await request({
    method: 'GET',
    reqPath: '/financial-control/dashboard',
    token: director.token,
    expectedStatus: 200,
  });

  ensure(
    Number(afterPayStats.data?.byStatus?.PAID?.count || 0) === basePaidStatusCount + 1,
    'Paid count must increase by 1 after mark paid',
  );
  ensure(
    Number(afterPayStats.data?.byStatus?.APPROVED_UNPAID?.count || 0) === baseApprovedStatusCount,
    'Approved unpaid count must return to baseline after mark paid',
  );
  ensure(
    Number(afterPayDashboard.data?.obligations?.expensePayable || 0) === basePending,
    'Financial dashboard expense payable must return to baseline after mark paid',
  );
  ensure(
    Number(afterPayDashboard.data?.obligations?.expensePayableCount || 0) === basePendingCount,
    'Financial dashboard expense payable count must return to baseline after mark paid',
  );

  const deleteAfterPaid = await request({
    method: 'DELETE',
    reqPath: `/expenses/${expenseId}`,
    token: ops.token,
    expectedStatus: 400,
  });
  ensure(deleteAfterPaid.status === 400, 'Paid expense must not be deletable');

  console.log('\n=== Expenses Workflow Summary ===');
  console.log(`API Base : ${API_BASE}`);
  console.log('PASS     : 1');
  console.log('FAIL     : 0');
}

main().catch((err) => {
  console.error('FAIL: expenses workflow');
  console.error(err);
  process.exit(1);
});
