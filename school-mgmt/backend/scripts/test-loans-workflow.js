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

async function login(email, password = DEMO_PASSWORD, maxRetries = 4) {
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

function daysAgo(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function assertLoanPaymentState(payments, paymentNumber, expectedStatus) {
  const payment = payments.find((item) => Number(item.paymentNumber) === Number(paymentNumber));
  ensure(payment, `Missing payment ${paymentNumber}`);
  ensure(payment.status === expectedStatus, `Payment ${paymentNumber} expected ${expectedStatus} but got ${payment.status}`);
  return payment;
}

async function main() {
  console.log(`Testing loans workflow against ${API_BASE}`);

  const frontendRes = await fetch(`${FRONTEND_BASE}/app/loans`);
  ensure(frontendRes.status === 200, 'Frontend route /app/loans must be reachable');

  const director = await login('director.demo@school.local');
  const accounting = await login('accounting.demo@school.local');
  const teacher = await login('teacher.demo@school.local');
  console.log('- DIRECTOR, ACCOUNTING, TEACHER logged in');

  await request({
    method: 'GET',
    reqPath: '/loans',
    token: teacher.token,
    expectedStatus: [401, 403],
  });
  console.log('PASS | Teacher is blocked from loans endpoint');

  const lenderName = `Loan Workflow ${Date.now()}`;
  const createPayload = {
    lenderName,
    lenderType: 'BANK',
    loanType: 'WORKING_CAPITAL',
    principal: 9_000_000,
    interestRate: 0,
    interestType: 'FIXED',
    term: 3,
    startDate: daysAgo(90),
    paymentFrequency: 'MONTHLY',
    collateral: 'Workflow collateral',
    notes: 'E2E loans workflow',
  };

  const createRes = await request({
    method: 'POST',
    reqPath: '/loans',
    token: director.token,
    body: createPayload,
    expectedStatus: [200, 201],
  });
  const createdLoan = createRes.data;
  const loanId = normalizeId(createdLoan._id);
  ensure(loanId, 'Create loan response must include _id');
  console.log('PASS | Director creates a draft loan');

  const listAfterCreate = await request({
    method: 'GET',
    reqPath: `/loans?keyword=${encodeURIComponent(lenderName)}`,
    token: accounting.token,
    expectedStatus: [200],
  });
  ensure(Array.isArray(listAfterCreate.data), 'Loans list must be an array');
  ensure(listAfterCreate.data.some((item) => normalizeId(item._id) === loanId), 'Created loan must appear in list');
  console.log('PASS | Accounting can see the created loan in list');

  const detailBeforeActivate = await request({
    method: 'GET',
    reqPath: `/loans/${loanId}`,
    token: accounting.token,
    expectedStatus: [200],
  });
  ensure(detailBeforeActivate.data.status === 'DRAFT', 'Loan must start as DRAFT');

  const activateRes = await request({
    method: 'POST',
    reqPath: `/loans/${loanId}/activate`,
    token: director.token,
    expectedStatus: [200, 201],
  });
  ensure(normalizeId(activateRes.data._id) === loanId, 'Activate response must reference the same loan');
  ensure(activateRes.data.status === 'ACTIVE', 'Loan must become ACTIVE after activation');
  console.log('PASS | Director activates the loan');

  const paymentsAfterActivate = await request({
    method: 'GET',
    reqPath: `/loans/payments/list?loanId=${loanId}`,
    token: accounting.token,
    expectedStatus: [200],
  });
  ensure(Array.isArray(paymentsAfterActivate.data) && paymentsAfterActivate.data.length === 3, 'Activation must generate 3 payment rows');
  const firstPayment = assertLoanPaymentState(paymentsAfterActivate.data, 1, 'SCHEDULED');
  console.log('PASS | Payment schedule is generated');

  const summaryBeforePayment = await request({
    method: 'GET',
    reqPath: '/loans/summary',
    token: accounting.token,
    expectedStatus: [200],
  });
  ensure(summaryBeforePayment.data && typeof summaryBeforePayment.data.totalDebt === 'number', 'Loan summary must be readable');

  const recordRes = await request({
    method: 'POST',
    reqPath: '/loans/payments/record',
    token: accounting.token,
    body: {
      loanId,
      paymentNumber: firstPayment.paymentNumber,
      paidDate: new Date().toISOString(),
      amount: firstPayment.totalAmount,
      paymentMethod: 'BANK_TRANSFER',
      reference: `E2E-${Date.now()}`,
      notes: 'Paid from workflow test',
    },
    expectedStatus: [200, 201],
  });
  ensure(recordRes.data?.ok !== false, 'Record payment must succeed');
  console.log('PASS | Accounting records the first payment');

  const paymentsAfterRecord = await request({
    method: 'GET',
    reqPath: `/loans/payments/list?loanId=${loanId}`,
    token: accounting.token,
    expectedStatus: [200],
  });
  assertLoanPaymentState(paymentsAfterRecord.data, 1, 'PAID');
  console.log('PASS | First installment becomes PAID');

  const loanAfterRecord = await request({
    method: 'GET',
    reqPath: `/loans/${loanId}`,
    token: accounting.token,
    expectedStatus: [200],
  });
  ensure(loanAfterRecord.data.status === 'ACTIVE', 'Loan should remain ACTIVE until fully repaid');
  ensure(loanAfterRecord.data.remainingBalance === 6_000_000, 'Remaining balance must decrease after one installment is paid');

  await request({
    method: 'POST',
    reqPath: '/loans/update-overdue',
    token: director.token,
    expectedStatus: [200, 201],
  });
  console.log('PASS | Director can run overdue recalculation');

  const paymentsAfterOverdue = await request({
    method: 'GET',
    reqPath: `/loans/payments/list?loanId=${loanId}`,
    token: accounting.token,
    expectedStatus: [200],
  });
  ensure(
    paymentsAfterOverdue.data.some((item) => item.status === 'OVERDUE'),
    'At least one remaining installment must be marked OVERDUE after recalculation',
  );

  const listAfterPayment = await request({
    method: 'GET',
    reqPath: `/loans?keyword=${encodeURIComponent(lenderName)}`,
    token: accounting.token,
    expectedStatus: [200],
  });
  const refreshedLoan = listAfterPayment.data.find((item) => normalizeId(item._id) === loanId);
  ensure(refreshedLoan && refreshedLoan.remainingBalance === 6_000_000, 'Loan list must reflect updated remaining balance');
  console.log('PASS | Loan list reflects remaining balance and overdue state');

  console.log('\n=== Loans Workflow Summary ===');
  console.log(`API Base : ${API_BASE}`);
  console.log('PASS     : 8');
  console.log('FAIL     : 0');
}

main().catch((err) => {
  console.error('FAIL | loans workflow');
  console.error(err);
  process.exitCode = 1;
});
