/* eslint-disable no-console */
const path = require('path');

try {
  // eslint-disable-next-line global-require
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
} catch (_) {}

const API_BASE = process.env.TEST_API_BASE || `http://localhost:${process.env.PORT || 3000}`;
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'ChangeThisDemoPass2024!';
const REQUEST_TIMEOUT_MS = 30000;

function ensure(condition, message) {
  if (!condition) throw new Error(message);
}

function normalizeId(v) {
  if (!v) return null;
  if (typeof v === 'string') return v;
  if (typeof v === 'object') {
    if (typeof v._id === 'string') return v._id;
    if (v._id && typeof v._id.toString === 'function') return v._id.toString();
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

async function login(email, password) {
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
    const skip = this.results.filter((r) => r.status === 'SKIP').length;
    console.log('\n=== RBAC + Non-Negative Guard Summary ===');
    console.log(`API Base : ${API_BASE}`);
    console.log(`PASS     : ${pass}`);
    console.log(`FAIL     : ${fail}`);
    console.log(`SKIP     : ${skip}`);
    if (fail > 0) {
      console.log('\nFailed tests:');
      this.results
        .filter((r) => r.status === 'FAIL')
        .forEach((r) => console.log(`- ${r.name}: ${r.error}`));
    }
    return { pass, fail, skip };
  }

  skip(name, reason) {
    this.results.push({ name, status: 'SKIP', error: reason, ms: 0 });
    console.log(`SKIP | ${name}`);
    console.log(`      ${reason}`);
  }
}

function uniquePhone(prefix = '09') {
  const normalizedPrefix = String(prefix).replace(/\D/g, '').slice(0, 2) || '09';
  const tailLength = Math.max(10 - normalizedPrefix.length, 1);
  const tail = `${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(-tailLength);
  return `${normalizedPrefix}${tail}`;
}

async function main() {
  const runner = new TestRunner();
  console.log(`Testing RBAC + finance guards against ${API_BASE}`);

  const auth = {};
  const accountEmails = {
    director: 'director.demo@school.local',
    parent: 'parent.demo@school.local',
    sale1: 'sale.huong@school.local',
    sale2: 'sale.tuan@school.local',
  };

  for (const [role, email] of Object.entries(accountEmails)) {
    const loginData = await login(email, DEMO_PASSWORD);
    auth[role] = loginData;
    console.log(`- ${role.toUpperCase()} logged in (${email})`);
  }

  const parentStudents = (await request({ method: 'GET', reqPath: '/students', token: auth.parent.token })).data || [];
  const parentStudentIds = new Set(parentStudents.map((s) => normalizeId(s && s._id)).filter(Boolean));
  ensure(parentStudentIds.size > 0, 'Parent has no students in seed data');

  const allStudents = (await request({ method: 'GET', reqPath: '/students', token: auth.director.token })).data || [];
  const foreignStudentForParent = allStudents.find((s) => !parentStudentIds.has(normalizeId(s && s._id)));
  ensure(foreignStudentForParent, 'Cannot find a foreign student for parent tests');

  await runner.test('PARENT cannot get foreign student by id', async () => {
    const sid = normalizeId(foreignStudentForParent._id);
    await request({
      method: 'GET',
      reqPath: `/students/${sid}`,
      token: auth.parent.token,
      expectedStatus: [404],
    });
  });

  await runner.test('PARENT cannot list all classes', async () => {
    await request({
      method: 'GET',
      reqPath: '/classes',
      token: auth.parent.token,
      expectedStatus: [403],
    });
  });

  const allClasses = (await request({ method: 'GET', reqPath: '/classes', token: auth.director.token })).data || [];
  const foreignClassForParent = allClasses.find((cls) => {
    const students = Array.isArray(cls.students) ? cls.students : [];
    return students.length > 0 && !students.some((st) => parentStudentIds.has(normalizeId(st && st._id)));
  });

  if (foreignClassForParent) {
    await runner.test('PARENT cannot access foreign class by id', async () => {
      const cid = normalizeId(foreignClassForParent._id);
      await request({
        method: 'GET',
        reqPath: `/classes/${cid}`,
        token: auth.parent.token,
        expectedStatus: [403],
      });
    });
  } else {
    runner.skip('PARENT cannot access foreign class by id', 'No foreign class found in seed data');
  }

  const sale1Students = (await request({ method: 'GET', reqPath: '/students', token: auth.sale1.token })).data || [];
  const sale1StudentIds = new Set(sale1Students.map((s) => normalizeId(s && s._id)).filter(Boolean));
  ensure(sale1StudentIds.size > 0, 'SALE1 has no students in seed data');

  const foreignStudentForSale1 = allStudents.find((s) => !sale1StudentIds.has(normalizeId(s && s._id)));
  ensure(foreignStudentForSale1, 'Cannot find foreign student for SALE1 test');

  await runner.test('SALE cannot get foreign student by id', async () => {
    const sid = normalizeId(foreignStudentForSale1._id);
    await request({
      method: 'GET',
      reqPath: `/students/${sid}`,
      token: auth.sale1.token,
      expectedStatus: [404],
    });
  });

  let sale1LeadId = null;
  await runner.test('SALE1 creates lead', async () => {
    const created = await request({
      method: 'POST',
      reqPath: '/leads',
      token: auth.sale1.token,
      expectedStatus: [200, 201],
      body: {
        parentName: 'E2E Parent Sale1',
        parentPhone: uniquePhone('091'),
        studentName: 'E2E Student Sale1',
        studentGrade: '5',
        source: 'FACEBOOK',
        notes: 'rbac-test-sale1',
      },
    });
    sale1LeadId = normalizeId(created.data && created.data._id);
    ensure(sale1LeadId, 'Failed to create SALE1 lead');
  });

  await runner.test('SALE2 cannot read SALE1 lead', async () => {
    await request({
      method: 'GET',
      reqPath: `/leads/${sale1LeadId}`,
      token: auth.sale2.token,
      expectedStatus: [404],
    });
  });

  await runner.test('SALE2 cannot update SALE1 lead', async () => {
    await request({
      method: 'PATCH',
      reqPath: `/leads/${sale1LeadId}`,
      token: auth.sale2.token,
      expectedStatus: [404],
      body: { notes: 'should-not-update' },
    });
  });

  let sale1OrderId = null;
  await runner.test('SALE1 creates order', async () => {
    const payload = {
      orderType: 'NEW_ENROLLMENT',
      parentName: 'Order Parent Sale1',
      parentPhone: uniquePhone('092'),
      studentName: 'Order Student Sale1',
      items: [
        {
          productId: '507f1f77bcf86cd799439011',
          productName: 'Guard Product',
          sessions: 10,
          pricePerSession: 100000,
          amount: 1000000,
        },
      ],
      totalAmount: 1000000,
      finalAmount: 1000000,
      leadSource: 'FACEBOOK',
      consultationNotes: 'rbac-order-test',
    };
    const created = await request({
      method: 'POST',
      reqPath: '/orders',
      token: auth.sale1.token,
      expectedStatus: [200, 201],
      body: payload,
    });
    sale1OrderId = normalizeId(created.data && created.data._id);
    ensure(sale1OrderId, 'Failed to create SALE1 order');
  });

  await runner.test('SALE2 cannot read SALE1 order', async () => {
    await request({
      method: 'GET',
      reqPath: `/orders/${sale1OrderId}`,
      token: auth.sale2.token,
      expectedStatus: [404],
    });
  });

  await runner.test('SALE2 cannot update SALE1 order', async () => {
    await request({
      method: 'PATCH',
      reqPath: `/orders/${sale1OrderId}`,
      token: auth.sale2.token,
      expectedStatus: [404],
      body: { consultationNotes: 'should-not-update-order' },
    });
  });

  await runner.test('SALE2 cannot submit SALE1 order', async () => {
    await request({
      method: 'POST',
      reqPath: `/orders/${sale1OrderId}/submit`,
      token: auth.sale2.token,
      expectedStatus: [404],
    });
  });

  await runner.test('SALE2 cannot cancel SALE1 order', async () => {
    await request({
      method: 'POST',
      reqPath: `/orders/${sale1OrderId}/cancel`,
      token: auth.sale2.token,
      expectedStatus: [404],
    });
  });

  const sale1StudentId = normalizeId(sale1Students[0] && sale1Students[0]._id);
  ensure(sale1StudentId, 'Cannot resolve SALE1 student id for invoice tests');

  let sale1InvoiceId = null;
  await runner.test('SALE1 creates invoice', async () => {
    const created = await request({
      method: 'POST',
      reqPath: '/invoices',
      token: auth.sale1.token,
      expectedStatus: [200, 201],
      body: {
        invoiceNumber: `INV-RBAC-${Date.now()}`,
        studentId: sale1StudentId,
        amount: 500000,
        paymentDate: new Date().toISOString(),
        description: 'rbac-invoice-test',
      },
    });
    sale1InvoiceId = normalizeId(created.data && created.data._id);
    ensure(sale1InvoiceId, 'Failed to create SALE1 invoice');
  });

  await runner.test('SALE2 cannot read SALE1 invoice by id', async () => {
    await request({
      method: 'GET',
      reqPath: `/invoices/${sale1InvoiceId}`,
      token: auth.sale2.token,
      expectedStatus: [404],
    });
  });

  await runner.test('SALE2 cannot query invoices of foreign student', async () => {
    await request({
      method: 'GET',
      reqPath: `/invoices/student/${sale1StudentId}`,
      token: auth.sale2.token,
      expectedStatus: [404],
    });
  });

  await runner.test('DIRECTOR cannot create bank account with negative opening balance', async () => {
    await request({
      method: 'POST',
      reqPath: '/financial-control/bank-accounts',
      token: auth.director.token,
      expectedStatus: [400],
      body: {
        bankName: 'Guard Bank Negative',
        accountNumber: `NEG-${Date.now()}`,
        openingBalance: -100,
      },
    });
  });

  let bankAccountId = null;
  await runner.test('DIRECTOR creates bank account with positive opening balance', async () => {
    const created = await request({
      method: 'POST',
      reqPath: '/financial-control/bank-accounts',
      token: auth.director.token,
      expectedStatus: [200, 201],
      body: {
        bankName: 'Guard Bank Positive',
        accountNumber: `POS-${Date.now()}`,
        openingBalance: 1000,
      },
    });
    bankAccountId = normalizeId(created.data && created.data._id);
    ensure(bankAccountId, 'Failed to create positive bank account');
  });

  await runner.test('DIRECTOR cannot withdraw bank account below zero', async () => {
    await request({
      method: 'POST',
      reqPath: '/financial-control/bank-transactions',
      token: auth.director.token,
      expectedStatus: [400],
      body: {
        bankAccountId,
        type: 'WITHDRAWAL',
        category: 'OTHER',
        amount: 2000,
        transactionDate: new Date().toISOString(),
        description: 'should-fail-overdraw-bank',
      },
    });
  });

  await runner.test('DIRECTOR cannot create fund with negative opening balance', async () => {
    await request({
      method: 'POST',
      reqPath: '/financial-control/funds',
      token: auth.director.token,
      expectedStatus: [400],
      body: {
        name: 'Guard Fund Negative',
        fundType: 'OTHER',
        currentBalance: -100,
      },
    });
  });

  let fundId = null;
  await runner.test('DIRECTOR creates fund with positive opening balance', async () => {
    const created = await request({
      method: 'POST',
      reqPath: '/financial-control/funds',
      token: auth.director.token,
      expectedStatus: [200, 201],
      body: {
        name: `Guard Fund Positive ${Date.now()}`,
        fundType: 'OTHER',
        currentBalance: 800,
        minimumBalance: 0,
      },
    });
    fundId = normalizeId(created.data && created.data._id);
    ensure(fundId, 'Failed to create positive fund');
  });

  await runner.test('DIRECTOR cannot withdraw fund below zero', async () => {
    await request({
      method: 'POST',
      reqPath: '/financial-control/fund-transactions',
      token: auth.director.token,
      expectedStatus: [400],
      body: {
        fundId,
        type: 'WITHDRAW',
        amount: 1200,
        transactionDate: new Date().toISOString(),
        description: 'should-fail-overdraw-fund',
      },
    });
  });

  const { fail } = runner.summary();
  if (fail > 0) process.exitCode = 1;
}

main().catch((err) => {
  const message = err && err.message ? err.message : String(err);
  console.error('Fatal:', message);
  process.exit(1);
});
