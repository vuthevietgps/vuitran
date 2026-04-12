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

async function uploadReceipt(token, fileName) {
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

function uniqueSuffix() {
  const stamp = Date.now().toString().slice(-8);
  const pid = String(process.pid).slice(-4);
  const rand = Math.floor(Math.random() * 9000)
    .toString()
    .padStart(4, '0');
  return `${stamp}${pid}${rand}`;
}

function randomCode(prefix) {
  return `${prefix}-${uniqueSuffix()}`.toUpperCase();
}

async function fetchRoute(url) {
  const res = await fetch(url, { redirect: 'manual' });
  return res.status;
}

async function main() {
  console.log(`Testing export-reports workflow against ${API_BASE}`);

  const director = await loginWithRetry('director.demo@school.local');
  const accounting = await loginWithRetry('accounting.demo@school.local');
  const sale = await loginWithRetry('sale.huong@school.local');
  const teacher = await loginWithRetry('teacher.demo@school.local');
  const parent = await loginWithRetry('parent.demo@school.local');
  console.log('- DIRECTOR, ACCOUNTING, SALE, TEACHER, PARENT logged in');

  const teacherId = normalizeId(teacher.user);
  ensure(teacherId, 'Teacher demo id missing');
  const parentId = normalizeId(parent.user);
  ensure(parentId, 'Parent demo id missing');
  const saleId = normalizeId(sale.user);
  ensure(saleId, 'Sale demo id missing');

  const suffix = uniqueSuffix();
  const studentCode = `EXPR-${suffix}`;
  const studentName = `Export Report ${suffix}`;
  const parentName = `Parent EX ${suffix}`;
  const classCode = `CLS-EX-${suffix}`;
  const className = `Class Export Report ${suffix}`;
  const reportDate = new Date(Date.now() + 35 * 86400000).toISOString().slice(0, 10);
  const currentMonthStart = new Date();
  currentMonthStart.setUTCDate(1);
  currentMonthStart.setUTCHours(0, 0, 0, 0);
  const currentMonthEnd = new Date();
  currentMonthEnd.setUTCMonth(currentMonthEnd.getUTCMonth() + 1);
  currentMonthEnd.setUTCDate(0);
  currentMonthEnd.setUTCHours(0, 0, 0, 0);
  const currentMonthStartStr = currentMonthStart.toISOString().slice(0, 10);
  const currentMonthEndStr = currentMonthEnd.toISOString().slice(0, 10);

  let studentId = null;
  let classId = null;
  let sessionId = null;
  let invoiceId = null;
  let invoiceNumber = null;
  let receiptImage = null;
  let approvalImage = null;
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
    const routeStatus = await fetchRoute(`${FRONTEND_BASE}/app/export-reports`);
    ensure(routeStatus === 200, `Expected /app/export-reports => 200, got ${routeStatus}`);

    await request({
      reqPath: '/export/payroll?fromDate=2026-01-01&toDate=2026-12-31',
      token: teacher.token,
      expectedStatus: [403],
    });
  });

  await step('Create fresh student/class data for export propagation', async () => {
    const createdStudent = await request({
      method: 'POST',
      reqPath: '/students',
      token: sale.token,
      expectedStatus: [200, 201],
      body: {
        studentCode,
        fullName: studentName,
        age: 9,
        parentName,
        parentPhone: `09${suffix.slice(-8)}`,
        parentUserId: parentId,
        faceImage: 'default-avatar.png',
        studentType: 'ONLINE',
      },
    });
    studentId = normalizeId(createdStudent.data);
    ensure(studentId, 'Failed to resolve studentId');
    ensure(normalizeId(createdStudent.data?.saleId) === saleId, 'Student must be sale-owned');

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
        saleId,
        classMode: 'ONLINE',
        subject: 'Tieng Anh',
        grade: 'Lop 3',
        pricePerSession: 160000,
        teacherPayPerSession: 80000,
        baseDuration: 90,
        sessionDuration: 90,
        maxStudents: 1,
        studentIds: [studentId],
      },
    });
    classId = normalizeId(createdClass.data);
    ensure(classId, 'Failed to resolve classId');

    const candidateSlots = [
      ['06:10', '07:10'],
      ['07:20', '08:20'],
      ['08:30', '09:30'],
      ['10:40', '11:40'],
      ['13:10', '14:10'],
      ['15:20', '16:20'],
      ['18:30', '19:30'],
      ['20:40', '21:40'],
    ];

    let lastError = null;
    for (const [scheduledStartTime, scheduledEndTime] of candidateSlots) {
      try {
        const createdSession = await request({
          method: 'POST',
          reqPath: '/sessions',
          token: director.token,
          expectedStatus: [200, 201],
          body: {
            classId,
            studentId,
            teacherId,
            parentUserId: parentId,
            scheduledDate: reportDate,
            scheduledStartTime,
            scheduledEndTime,
            durationMinutes: 60,
          },
        });
        sessionId = normalizeId(createdSession.data);
        ensure(sessionId, 'Session should be created');
        lastError = null;
        break;
      } catch (error) {
        lastError = error;
        const message = error instanceof Error ? error.message : String(error);
        if (!message.includes('409')) {
          throw error;
        }
      }
    }
    ensure(sessionId, `Unable to create session without time conflict: ${lastError?.message || lastError}`);
  });

  await step('Finalize the created session so attendance data is exported', async () => {
    const sessionBeforeComplete = await request({
      reqPath: `/sessions/${sessionId}`,
      token: director.token,
      expectedStatus: [200],
    });
    const sessionStatus = sessionBeforeComplete.data?.status;

    if (sessionStatus === 'SCHEDULED') {
      await request({
        method: 'POST',
        reqPath: `/sessions/${sessionId}/complete`,
        token: teacher.token,
        expectedStatus: [200, 201],
        body: {
          lessonContent: 'Export reports workflow teaching report',
          teacherNotes: 'Export reports workflow teacher note',
          topicsCovered: 'Export reports topics',
        },
      });
    } else {
      ensure(
        ['TEACHER_COMPLETED', 'PARENT_CONFIRMED', 'FINALIZED'].includes(sessionStatus),
        `Unexpected session status before completion flow: ${sessionStatus}`,
      );
    }

    await request({
      method: 'PATCH',
      reqPath: `/sessions/${sessionId}/teaching-report`,
      token: teacher.token,
      expectedStatus: [200],
      body: {
        lessonContent: 'Export reports workflow teaching report',
        teacherComment: 'Export reports workflow teacher comment',
      },
    });
    const sessionBeforeFinalize = await request({
      reqPath: `/sessions/${sessionId}`,
      token: director.token,
      expectedStatus: [200],
    });
    if (sessionBeforeFinalize.data?.status !== 'FINALIZED') {
      await request({
        method: 'POST',
        reqPath: `/sessions/${sessionId}/finalize`,
        token: director.token,
        expectedStatus: [200, 201],
      });
    }
  });

  await step('Create and approve a tuition invoice row for export coverage', async () => {
    receiptImage = await uploadReceipt(sale.token, `export-reports-receipt-${Date.now()}.png`);
    invoiceNumber = randomCode('EXINV');
    const createdInvoice = await request({
      method: 'POST',
      reqPath: '/invoices',
      token: sale.token,
      expectedStatus: [200, 201],
      body: {
        invoiceNumber,
        invoiceType: 'TUITION',
        classType: 'ONLINE',
        studentId,
        classId,
        saleId,
        sessions: 12,
        bonusSessions: 1,
        trialSessions: 0,
        paymentRound: 1,
        courseStatus: 'NEW',
        pricePerSession: 160000,
        referenceDuration: 60,
        amount: 1920000,
        paymentDate: reportDate,
        receiptImage,
        description: 'Export reports workflow invoice',
      },
    });
    invoiceId = normalizeId(createdInvoice.data);
    ensure(invoiceId, 'Failed to resolve invoice id');

    approvalImage = await uploadReceipt(accounting.token, `export-reports-approval-${Date.now()}.png`);
    const approved = await request({
      method: 'POST',
      reqPath: `/invoices/${invoiceId}/approve`,
      token: accounting.token,
      expectedStatus: [200, 201],
      body: {
        action: 'APPROVE',
        approvalImage,
      },
    });
    ensure(approved.data?.status === 'APPROVED', 'Invoice should be approved');
  });

  await step('CSV export endpoints return attachments and include created data', async () => {
    const studentsCsv = await request({
      reqPath: '/export/students',
      token: director.token,
      expectedStatus: [200],
    });
    ensure(
      studentsCsv.headers.contentDisposition.includes('attachment'),
      'Students export missing attachment header',
    );
    ensure(studentsCsv.raw.includes(studentName), 'Students export should contain created student name');

    const attendanceCsv = await request({
      reqPath: `/export/attendance?fromDate=${reportDate}&toDate=${reportDate}`,
      token: director.token,
      expectedStatus: [200],
    });
    ensure(
      attendanceCsv.headers.contentDisposition.includes('attachment'),
      'Attendance export missing attachment header',
    );
    ensure(attendanceCsv.raw.includes(studentName), 'Attendance export should contain created student name');
    ensure(attendanceCsv.raw.includes(className), 'Attendance export should contain created class name');

    const payrollCsv = await request({
      reqPath: `/export/payroll?fromDate=${currentMonthStartStr}&toDate=${currentMonthEndStr}`,
      token: director.token,
      expectedStatus: [200],
    });
    ensure(
      payrollCsv.headers.contentDisposition.includes('attachment'),
      'Payroll export missing attachment header',
    );
    ensure(payrollCsv.raw.trim().length > 20, 'Payroll export should not be empty');

    const invoicesCsv = await request({
      reqPath: `/export/invoices?fromDate=${currentMonthStartStr}&toDate=${currentMonthEndStr}`,
      token: accounting.token,
      expectedStatus: [200],
    });
    ensure(
      invoicesCsv.headers.contentDisposition.includes('attachment'),
      'Invoices export missing attachment header',
    );
    ensure(invoicesCsv.raw.includes(invoiceNumber), 'Invoices export should contain invoice number');

    const financialCsv = await request({
      reqPath: `/export/financial?fromDate=${currentMonthStartStr}&toDate=${currentMonthEndStr}`,
      token: accounting.token,
      expectedStatus: [200],
    });
    ensure(
      financialCsv.headers.contentDisposition.includes('attachment'),
      'Financial export missing attachment header',
    );
    ensure(
      financialCsv.raw.includes(parent.user?.email || '') || financialCsv.raw.includes(parent.user?.fullName || ''),
      'Financial export should contain parent row',
    );

    const adsProfitCsv = await request({
      reqPath: `/export/ads-parent-profit?startDate=${currentMonthStartStr}&endDate=${currentMonthEndStr}`,
      token: accounting.token,
      expectedStatus: [200],
    });
    ensure(adsProfitCsv.headers.contentDisposition.includes('attachment'), 'Ads parent profit export missing attachment header');
    ensure(adsProfitCsv.raw.trim().length > 20, 'Ads parent profit export should not be empty');

    const adsCohortCsv = await request({
      reqPath: `/export/ads-realized-cohort?startDate=${currentMonthStartStr}&endDate=${currentMonthEndStr}&maturityDays=60`,
      token: accounting.token,
      expectedStatus: [200],
    });
    ensure(adsCohortCsv.headers.contentDisposition.includes('attachment'), 'Ads realized cohort export missing attachment header');
    ensure(adsCohortCsv.raw.trim().length > 20, 'Ads realized cohort export should not be empty');
  });

  await step('RBAC stays tight for export endpoints', async () => {
    await request({
      reqPath: '/export/students',
      token: teacher.token,
      expectedStatus: [403],
    });
    await request({
      reqPath: '/export/financial?fromDate=2026-01-01&toDate=2026-12-31',
      token: teacher.token,
      expectedStatus: [403],
    });
  });

  console.log('\n=== Export Reports Workflow Summary ===');
  console.log(`API Base : ${API_BASE}`);
  console.log(`PASS     : ${pass}`);
  console.log(`FAIL     : ${fail}`);

  if (fail > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
