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

function makeUniqueSuffix() {
  return `${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 900 + 100)}`;
}

async function fetchRoute(url) {
  const res = await fetch(url, { redirect: 'manual' });
  return res.status;
}

async function main() {
  console.log(`Testing financial-control workflow against ${API_BASE}`);

  const directorToken = await loginWithRetry('director.demo@school.local');
  const accountingToken = await loginWithRetry('accounting.demo@school.local');
  const teacherToken = await loginWithRetry('teacher.demo@school.local');
  console.log('- DIRECTOR, ACCOUNTING, TEACHER logged in');

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

  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const startDate = `${yyyy}-${mm}-01`;
  const endDate = `${yyyy}-${mm}-${dd}`;
  const suffix = makeUniqueSuffix();
  let bankAccountId;
  let fundId;

  await step('Frontend route is reachable and teacher is blocked from financial-control API', async () => {
    const routeStatus = await fetchRoute(`${FRONTEND_BASE}/app/financial-control`);
    ensure(routeStatus === 200, `Expected /app/financial-control => 200, got ${routeStatus}`);
    await request({
      reqPath: '/financial-control/dashboard',
      token: teacherToken,
      expectedStatus: [403],
    });
  });

  await step('Director and accounting can read financial-control overview endpoints', async () => {
    const dashboard = await request({
      reqPath: '/financial-control/dashboard',
      token: directorToken,
      expectedStatus: [200],
    });
    ensure(dashboard.data && dashboard.data.cashPosition, 'Dashboard missing cashPosition');
    ensure(dashboard.data.obligations, 'Dashboard missing obligations');

    const overview = await request({
      reqPath: `/financial-control/overview?startDate=${startDate}&endDate=${endDate}`,
      token: accountingToken,
      expectedStatus: [200],
    });
    ensure(overview.data && overview.data.bankAccounts, 'Overview missing bankAccounts');
    ensure(overview.data.profitAndLoss, 'Overview missing profitAndLoss');

    const alerts = await request({
      reqPath: '/financial-control/alerts',
      token: directorToken,
      expectedStatus: [200],
    });
    ensure(Array.isArray(alerts.data.alerts), 'Alerts response missing alerts array');
  });

  await step('Director can create bank account and fund, and both are visible in read APIs', async () => {
    const createdBank = await request({
      method: 'POST',
      reqPath: '/financial-control/bank-accounts',
      token: directorToken,
      body: {
        bankName: 'Test Financial Bank',
        accountNumber: `FC${suffix}`,
        accountHolder: 'Test Director',
        openingBalance: 12345,
        description: `fc-workflow-${suffix}`,
      },
      expectedStatus: [200, 201],
    });
    bankAccountId = normalizeId(createdBank.data && createdBank.data._id ? createdBank.data : createdBank.data?.data);
    ensure(bankAccountId, 'Failed to resolve bankAccountId');

    const createdFund = await request({
      method: 'POST',
      reqPath: '/financial-control/funds',
      token: directorToken,
      body: {
        name: `FC Workflow ${suffix}`,
        fundType: 'OTHER',
        minimumBalance: 1000,
        targetBalance: 5000,
        currentBalance: 2222,
        description: `fc-workflow-${suffix}`,
      },
      expectedStatus: [200, 201],
    });
    fundId = normalizeId(createdFund.data && createdFund.data._id ? createdFund.data : createdFund.data?.data);
    ensure(fundId, 'Failed to resolve fundId');

    const bankList = await request({
      reqPath: '/financial-control/bank-accounts',
      token: accountingToken,
      expectedStatus: [200],
    });
    ensure(
      Array.isArray(bankList.data) && bankList.data.some((item) => normalizeId(item) === bankAccountId),
      'Created bank account not visible in list',
    );

    const fundList = await request({
      reqPath: '/financial-control/funds',
      token: accountingToken,
      expectedStatus: [200],
    });
    ensure(
      Array.isArray(fundList.data) && fundList.data.some((item) => normalizeId(item) === fundId),
      'Created fund not visible in list',
    );
  });

  await step('Transactions update bank and fund balances and summaries remain readable', async () => {
    await request({
      method: 'POST',
      reqPath: '/financial-control/bank-transactions',
      token: accountingToken,
      body: {
        bankAccountId,
        type: 'DEPOSIT',
        category: 'OTHER',
        amount: 555,
        transactionDate: `${endDate}T10:00:00.000Z`,
        description: `fc bank deposit ${suffix}`,
      },
      expectedStatus: [200, 201],
    });

    await request({
      method: 'POST',
      reqPath: '/financial-control/fund-transactions',
      token: accountingToken,
      body: {
        fundId,
        type: 'DEPOSIT',
        amount: 333,
        transactionDate: `${endDate}T11:00:00.000Z`,
        description: `fc fund deposit ${suffix}`,
      },
      expectedStatus: [200, 201],
    });

    const bankDetail = await request({
      reqPath: `/financial-control/bank-accounts/${bankAccountId}`,
      token: directorToken,
      expectedStatus: [200],
    });
    ensure((bankDetail.data.currentBalance || 0) >= 12900, 'Bank currentBalance did not update as expected');

    const fundDetail = await request({
      reqPath: `/financial-control/funds/${fundId}`,
      token: directorToken,
      expectedStatus: [200],
    });
    ensure((fundDetail.data.currentBalance || 0) >= 2555, 'Fund currentBalance did not update as expected');

    await request({
      reqPath: '/financial-control/bank-accounts/summary',
      token: accountingToken,
      expectedStatus: [200],
    });
    await request({
      reqPath: '/financial-control/funds/summary',
      token: accountingToken,
      expectedStatus: [200],
    });
  });

  await step('Financial-control report endpoints return usable payloads', async () => {
    const cashFlow = await request({
      reqPath: `/financial-control/cash-flow?startDate=${startDate}&endDate=${endDate}&groupBy=month`,
      token: directorToken,
      expectedStatus: [200],
    });
    ensure(cashFlow.data && typeof cashFlow.data.totalInflow === 'number', 'Cash-flow missing totals');

    const pnl = await request({
      reqPath: `/financial-control/profit-and-loss?startDate=${startDate}&endDate=${endDate}&basis=cash`,
      token: directorToken,
      expectedStatus: [200],
    });
    ensure(pnl.data && pnl.data.revenue && pnl.data.costs, 'Profit-and-loss missing revenue/costs');

    const aging = await request({
      reqPath: '/financial-control/aging-report',
      token: accountingToken,
      expectedStatus: [200],
    });
    ensure(aging.data && typeof aging.data === 'object', 'Aging report missing payload');

    const balanceSheet = await request({
      reqPath: '/financial-control/balance-sheet',
      token: directorToken,
      expectedStatus: [200],
    });
    ensure(balanceSheet.data && typeof balanceSheet.data === 'object', 'Balance sheet missing payload');

    const provisional = await request({
      reqPath: `/financial-control/provisional-gross-profit?month=${yyyy}-${mm}`,
      token: accountingToken,
      expectedStatus: [200],
    });
    ensure(provisional.data && provisional.data.period, 'Provisional gross profit missing period');
  });

  console.log('\n=== Financial Control Workflow Summary ===');
  console.log(`API Base : ${API_BASE}`);
  console.log(`PASS     : ${pass}`);
  console.log(`FAIL     : ${fail}`);

  if (fail > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
