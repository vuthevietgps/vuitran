/* eslint-disable no-console */
const path = require('path');

try {
  // eslint-disable-next-line global-require
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
} catch (_) {}

const API_BASE = process.env.TEST_API_BASE || `http://localhost:${process.env.PORT || 3000}`;
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'ChangeThisDemoPass2024!';
const REQUEST_TIMEOUT_MS = 30000;
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
  const setCookies = getSetCookieHeaders(res);
  setCookies.forEach((entry) => {
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

function qs(params) {
  const p = new URLSearchParams();
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '') return;
    p.append(k, String(v));
  });
  const s = p.toString();
  return s ? `?${s}` : '';
}

function randomCode(prefix) {
  const stamp = Date.now().toString().slice(-8);
  const rand = Math.floor(Math.random() * 9999)
    .toString()
    .padStart(4, '0');
  return `${prefix}${stamp}${rand}`.toUpperCase();
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
      const message = err instanceof Error ? err.message : String(err);
      this.results.push({ name, status: 'FAIL', ms, error: message });
      console.log(`FAIL | ${name} (${ms}ms)`);
      console.log(`      ${message}`);
    }
  }

  summary() {
    const pass = this.results.filter((r) => r.status === 'PASS').length;
    const fail = this.results.filter((r) => r.status === 'FAIL').length;
    console.log('\n=== Invoices Workflow Summary ===');
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

function extractList(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

function pickInvoiceById(items, invoiceId) {
  return (items || []).find((item) => normalizeId(item && item._id) === invoiceId) || null;
}

function pickChildGroupByStudent(children, studentId) {
  return (children || []).find((entry) => normalizeId(entry?.student?._id) === studentId) || null;
}

function pickLedgerEntryByInvoiceId(items, invoiceId) {
  return (items || []).find((item) => normalizeId(item?.invoiceId) === invoiceId) || null;
}

async function main() {
  const runner = new TestRunner();
  console.log(`Testing invoices workflow against ${API_BASE}`);

  const auth = {};
  const state = {
    directorId: null,
    accountingId: null,
    saleId: null,
    parentId: null,
    parentEmail: null,
    studentId: null,
    invoiceId: null,
    invoiceNumber: null,
    amount: 0,
    purchasedSessions: 0,
    walletBefore: 0,
    walletAfter: 0,
    totalPendingBefore: 0,
    totalPendingAfterCreate: 0,
    totalPendingAfterApprove: 0,
    totalPaidBefore: 0,
    totalPaidAfterCreate: 0,
    totalPaidAfterApprove: 0,
  };

  await runner.test('Login director, accounting, sale and parent demo accounts', async () => {
    const accounts = {
      director: 'director.demo@school.local',
      accounting: 'accounting.demo@school.local',
      sale: 'sale.huong@school.local',
      parent: 'parent.demo@school.local',
    };
    for (const [role, email] of Object.entries(accounts)) {
      auth[role] = await loginWithRetry(email, DEMO_PASSWORD, 4);
    }
  });

  await runner.test('Resolve actor ids', async () => {
    const meResponses = await Promise.all([
      request({ method: 'GET', reqPath: '/users/me', token: auth.director.token, expectedStatus: [200] }),
      request({ method: 'GET', reqPath: '/users/me', token: auth.accounting.token, expectedStatus: [200] }),
      request({ method: 'GET', reqPath: '/users/me', token: auth.sale.token, expectedStatus: [200] }),
      request({ method: 'GET', reqPath: '/users/me', token: auth.parent.token, expectedStatus: [200] }),
    ]);

    state.directorId = normalizeId(meResponses[0].data && meResponses[0].data._id);
    state.accountingId = normalizeId(meResponses[1].data && meResponses[1].data._id);
    state.saleId = normalizeId(meResponses[2].data && meResponses[2].data._id);
    state.parentId = normalizeId(meResponses[3].data && meResponses[3].data._id);
    state.parentEmail = auth.parent.user?.email || 'parent.demo@school.local';

    ensure(state.directorId, 'Director id missing');
    ensure(state.accountingId, 'Accounting id missing');
    ensure(state.saleId, 'Sale id missing');
    ensure(state.parentId, 'Parent id missing');
  });

  await runner.test('Frontend route /app/invoices and backend list endpoint are reachable', async () => {
    const routeRes = await fetch('http://localhost:4200/app/invoices');
    ensure(routeRes.status === 200, 'Frontend route /app/invoices must return 200');

    const listRes = await request({
      method: 'GET',
      reqPath: '/invoices',
      token: auth.director.token,
      expectedStatus: [200],
    });
    ensure(Array.isArray(listRes.data), 'Director invoice list must be an array');
  });

  await runner.test('Find a parent.demo student and align sale ownership for invoice flow', async () => {
    const studentsRes = await request({
      method: 'GET',
      reqPath: '/students',
      token: auth.director.token,
      expectedStatus: [200],
    });
    const students = extractList(studentsRes.data);
    const parentStudent = students.find(
      (student) => normalizeId(student?.parentUserId) === state.parentId,
    );
    ensure(parentStudent, 'Cannot find a student belonging to parent.demo');

    state.studentId = normalizeId(parentStudent._id);
    ensure(state.studentId, 'Student id missing');

    if (normalizeId(parentStudent.saleId) !== state.saleId) {
      const updated = await request({
        method: 'PATCH',
        reqPath: `/students/${state.studentId}`,
        token: auth.director.token,
        expectedStatus: [200],
        body: {
          saleId: state.saleId,
          saleName: auth.sale.user?.fullName || 'Sale Demo',
        },
      });
      ensure(normalizeId(updated.data && updated.data.saleId) === state.saleId, 'Student sale ownership did not update');
    }
  });

  await runner.test('Capture baseline wallet, student purchased sessions and parent invoice summary', async () => {
    const walletRes = await request({
      method: 'GET',
      reqPath: `/wallets/user/${state.parentId}`,
      token: auth.director.token,
      expectedStatus: [200],
    });
    state.walletBefore = Number(walletRes.data.balance || 0);

    const studentRes = await request({
      method: 'GET',
      reqPath: `/students/${state.studentId}`,
      token: auth.director.token,
      expectedStatus: [200],
    });
    state.purchasedSessions = Number(studentRes.data.totalPurchasedSessions || 0);

    const parentInvoicesRes = await request({
      method: 'GET',
      reqPath: '/invoices/my-children',
      token: auth.parent.token,
      expectedStatus: [200],
    });
    const summary = parentInvoicesRes.data?.summary || {};
    state.totalPendingBefore = Number(summary.totalPending || 0);
    state.totalPaidBefore = Number(summary.totalPaid || 0);
  });

  await runner.test('Sale can upload receipt image for the invoice', async () => {
    state.invoiceReceiptImage = await uploadReceipt({
      token: auth.sale.token,
      fileName: `invoice-receipt-${Date.now()}.png`,
    });
    ensure(
      typeof state.invoiceReceiptImage === 'string' && state.invoiceReceiptImage.startsWith('/uploads/invoices/'),
      `Unexpected receipt path: ${state.invoiceReceiptImage}`,
    );
  });

  await runner.test('Sale creates tuition invoice that remains pending approval', async () => {
    state.invoiceNumber = randomCode('INVWF');
    const sessions = 12;
    const pricePerSession = 125000;
    state.amount = sessions * pricePerSession;

    const created = await request({
      method: 'POST',
      reqPath: '/invoices',
      token: auth.sale.token,
      expectedStatus: [200, 201],
      body: {
        invoiceNumber: state.invoiceNumber,
        invoiceType: 'TUITION',
        classType: 'ONLINE',
        studentId: state.studentId,
        sessions,
        bonusSessions: 1,
        trialSessions: 1,
        paymentRound: 1,
        courseStatus: 'NEW',
        pricePerSession,
        referenceDuration: 60,
        amount: state.amount,
        paymentDate: new Date().toISOString().slice(0, 10),
        receiptImage: state.invoiceReceiptImage,
        description: 'Invoices workflow e2e',
      },
    });

    state.invoiceId = normalizeId(created.data && created.data._id);
    ensure(state.invoiceId, 'Invoice id missing after create');
    ensure(created.data.status === 'PENDING_APPROVAL', `Expected PENDING_APPROVAL, got ${created.data.status}`);
    ensure(normalizeId(created.data.saleId) === state.saleId, 'Created invoice must belong to the sale actor');
  });

  await runner.test('Sale list, student list and parent invoice view include the new invoice', async () => {
    const saleList = await request({
      method: 'GET',
      reqPath: '/invoices',
      token: auth.sale.token,
      expectedStatus: [200],
    });
    ensure(
      pickInvoiceById(extractList(saleList.data), state.invoiceId),
      'Sale invoice list must include the newly created invoice',
    );

    const byStudent = await request({
      method: 'GET',
      reqPath: `/invoices/student/${state.studentId}`,
      token: auth.sale.token,
      expectedStatus: [200],
    });
    ensure(
      pickInvoiceById(extractList(byStudent.data), state.invoiceId),
      'GET /invoices/student/:id must include the newly created invoice',
    );

    const parentView = await request({
      method: 'GET',
      reqPath: '/invoices/my-children',
      token: auth.parent.token,
      expectedStatus: [200],
    });
    const children = extractList(parentView.data?.children);
    const childGroup = pickChildGroupByStudent(children, state.studentId);
    ensure(childGroup, 'Parent view must include the target student');
    ensure(
      pickInvoiceById(childGroup.invoices || [], state.invoiceId),
      'Parent child group must include the new invoice',
    );
  });

  await runner.test('Accounting sees the invoice in pending approval and approval requires image', async () => {
    const pending = await request({
      method: 'GET',
      reqPath: '/invoices/pending',
      token: auth.accounting.token,
      expectedStatus: [200],
    });
    ensure(
      pickInvoiceById(extractList(pending.data), state.invoiceId),
      'Accounting pending list must include the invoice',
    );

    await request({
      method: 'POST',
      reqPath: `/invoices/${state.invoiceId}/approve`,
      token: auth.accounting.token,
      expectedStatus: [400],
      body: {
        action: 'APPROVE',
      },
    });
  });

  await runner.test('Accounting uploads approval image and approves the invoice', async () => {
    state.approvalImage = await uploadReceipt({
      token: auth.accounting.token,
      fileName: `invoice-approval-${Date.now()}.png`,
    });
    ensure(
      typeof state.approvalImage === 'string' && state.approvalImage.startsWith('/uploads/invoices/'),
      `Unexpected approval image path: ${state.approvalImage}`,
    );

    const approved = await request({
      method: 'POST',
      reqPath: `/invoices/${state.invoiceId}/approve`,
      token: auth.accounting.token,
      expectedStatus: [200, 201],
      body: {
        action: 'APPROVE',
        approvalImage: state.approvalImage,
      },
    });

    ensure(approved.data.status === 'APPROVED', `Expected APPROVED, got ${approved.data.status}`);
    ensure(approved.data.walletTopUpDone === true, 'Approved tuition invoice must top up wallet');
    ensure(approved.data.approvalImage === state.approvalImage, 'Approval image must be persisted');
  });

  await runner.test('Wallet, student sessions and parent summary reflect approved invoice', async () => {
    const walletRes = await request({
      method: 'GET',
      reqPath: `/wallets/user/${state.parentId}`,
      token: auth.director.token,
      expectedStatus: [200],
    });
    state.walletAfter = Number(walletRes.data.balance || 0);

    const ledgerRes = await request({
      method: 'GET',
      reqPath: `/wallets/ledger${qs({ userId: state.parentId, type: 'TOP_UP', page: 1, limit: 50 })}`,
      token: auth.director.token,
      expectedStatus: [200],
    });
    const invoiceTopUp = pickLedgerEntryByInvoiceId(extractList(ledgerRes.data), state.invoiceId);
    ensure(invoiceTopUp, `Missing TOP_UP ledger entry for invoice ${state.invoiceId}`);
    ensure(
      Number(invoiceTopUp.amount || 0) === state.amount,
      `Invoice TOP_UP amount mismatch. ledger=${invoiceTopUp.amount}, expected=${state.amount}`,
    );
    ensure(
      Number(invoiceTopUp.balanceAfter || 0) === Number(invoiceTopUp.balanceBefore || 0) + state.amount,
      `Invoice TOP_UP ledger mismatch. before=${invoiceTopUp.balanceBefore}, after=${invoiceTopUp.balanceAfter}, amount=${state.amount}`,
    );

    const studentRes = await request({
      method: 'GET',
      reqPath: `/students/${state.studentId}`,
      token: auth.director.token,
      expectedStatus: [200],
    });
    const currentSessions = Number(studentRes.data.totalPurchasedSessions || 0);
    const expectedDelta = 12 + 1 + 1;
    ensure(
      currentSessions === state.purchasedSessions + expectedDelta,
      `Purchased sessions mismatch. before=${state.purchasedSessions}, after=${currentSessions}, delta=${expectedDelta}`,
    );

    const parentInvoicesRes = await request({
      method: 'GET',
      reqPath: '/invoices/my-children',
      token: auth.parent.token,
      expectedStatus: [200],
    });
    const summary = parentInvoicesRes.data?.summary || {};
    state.totalPendingAfterApprove = Number(summary.totalPending || 0);
    state.totalPaidAfterApprove = Number(summary.totalPaid || 0);
    ensure(
      state.totalPendingAfterApprove === state.totalPendingBefore,
      'Pending summary should return to baseline after approval',
    );
    ensure(
      state.totalPaidAfterApprove === state.totalPaidBefore + state.amount,
      'Paid summary must increase by invoice amount after approval',
    );

    const children = extractList(parentInvoicesRes.data?.children);
    const childGroup = pickChildGroupByStudent(children, state.studentId);
    const invoice = pickInvoiceById(childGroup?.invoices || [], state.invoiceId);
    ensure(invoice && invoice.status === 'APPROVED', 'Parent invoice view must show APPROVED invoice');
  });

  await runner.test('Approved invoice is removed from pending list and cannot be deleted', async () => {
    const pending = await request({
      method: 'GET',
      reqPath: '/invoices/pending',
      token: auth.accounting.token,
      expectedStatus: [200],
    });
    ensure(
      !pickInvoiceById(extractList(pending.data), state.invoiceId),
      'Approved invoice must leave pending list',
    );

    await request({
      method: 'DELETE',
      reqPath: `/invoices/${state.invoiceId}`,
      token: auth.director.token,
      expectedStatus: [400],
    });

    const byStudent = await request({
      method: 'GET',
      reqPath: `/invoices/student/${state.studentId}`,
      token: auth.sale.token,
      expectedStatus: [200],
    });
    const invoice = pickInvoiceById(extractList(byStudent.data), state.invoiceId);
    ensure(invoice && invoice.status === 'APPROVED', 'Sale student invoice view must keep the approved invoice');
  });

  const summary = runner.summary();
  if (summary.fail > 0) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('Fatal error in invoices workflow test');
  console.error(err);
  process.exitCode = 1;
});
