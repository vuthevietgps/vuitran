/* eslint-disable no-console */
const path = require('path');

try {
  // eslint-disable-next-line global-require
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
} catch (_) {}

const API_BASE = process.env.TEST_API_BASE || `http://localhost:${process.env.PORT || 3000}`;
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'ChangeThisDemoPass2024!';
const REQUEST_TIMEOUT_MS = 45000;
const LOGIN_RETRY_WAIT_MS = 65000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatDateYYYYMMDD(d) {
  return d.toISOString().slice(0, 10);
}

function addDays(date, days) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function randomCode(prefix) {
  const stamp = Date.now().toString().slice(-8);
  const rand = Math.floor(Math.random() * 9999)
    .toString()
    .padStart(4, '0');
  return `${prefix}${stamp}${rand}`.toUpperCase();
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
          `Response: ${parsed.text.slice(0, 900)}`,
      );
    }

    return { status: res.status, data: parsed.json, raw: parsed.text };
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

function extractItemSessionId(item) {
  if (!item) return null;
  if (item.sessionId && item.sessionId._id) return normalizeId(item.sessionId._id);
  return normalizeId(item.sessionId);
}

function findItemBySessionId(items, sessionId) {
  return (items || []).find((it) => extractItemSessionId(it) === sessionId);
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
    console.log('\n=== Teacher Payroll Operational Test Summary ===');
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

async function main() {
  const runner = new TestRunner();
  console.log(`Testing teacher payroll operational scenarios against ${API_BASE}`);

  const auth = {};
  const accountEmails = {
    director: 'director.demo@school.local',
    ops: 'ops.demo@school.local',
    teacher: 'teacher.demo@school.local',
  };

  for (const [role, email] of Object.entries(accountEmails)) {
    const loginData = await loginWithRetry(email, DEMO_PASSWORD, 4);
    auth[role] = { token: loginData.token, user: loginData.user, email };
    console.log(`- ${role.toUpperCase()} logged in (${email})`);
  }

  const now = new Date();
  const baseOffsetDays = 5000 + Math.floor(Math.random() * 1000);
  const dateA = formatDateYYYYMMDD(addDays(now, baseOffsetDays));
  const dateB = formatDateYYYYMMDD(addDays(now, baseOffsetDays + 1));
  const dateC = formatDateYYYYMMDD(addDays(now, baseOffsetDays + 2));
  const dateD = formatDateYYYYMMDD(addDays(now, baseOffsetDays + 3));
  const dateE = formatDateYYYYMMDD(addDays(now, baseOffsetDays + 4));
  const payrollPeriod1 = dateA;
  const payrollPeriod2 = formatDateYYYYMMDD(addDays(now, baseOffsetDays + 45));

  let teacherId = null;
  let chosenClass = null;
  let chosenStudent = null;
  let payroll1Id = null;
  let payroll2Id = null;
  let payrollBankAccountId = null;
  let createdClassId = null;
  const sessions = {
    a: null,
    b: null,
    c: null,
    d: null,
    e: null,
  };

  const createAttendanceSession = async (date, label) => {
    const mark = await request({
      method: 'POST',
      reqPath: '/attendance/mark',
      token: auth.ops.token,
      body: {
        classId: chosenClass.classId,
        studentId: chosenStudent.studentId,
        date,
        status: 'PRESENT',
        notes: `ops payroll test ${label}`,
      },
      expectedStatus: [200, 201],
    });
    const sessionId = normalizeId(mark.data && mark.data.sessionId);
    ensure(sessionId, `Missing sessionId after attendance mark (${label})`);
    return sessionId;
  };

  const submitTeachingReport = async (sessionId, label) => {
    const report = await request({
      method: 'PATCH',
      reqPath: `/sessions/${sessionId}/teaching-report`,
      token: auth.teacher.token,
      body: {
        lessonContent: `Operational payroll scenario report for ${label}, enough detail to satisfy validator.`,
        teacherComment: `teacher comment ${label}`,
      },
      expectedStatus: [200],
    });
    ensure(
      report.data && report.data.hasTeachingReport === true,
      `Session ${sessionId} should have teaching report after submit`,
    );
  };

  const finalizeSession = async (sessionId) => {
    const res = await request({
      method: 'POST',
      reqPath: `/sessions/${sessionId}/finalize`,
      token: auth.ops.token,
      expectedStatus: [200, 201],
    });
    ensure(res.data && res.data.status === 'FINALIZED', `Expected FINALIZED for ${sessionId}`);
  };

  const topUpParentWallet = async (userId, amount, description) => {
    await request({
      method: 'POST',
      reqPath: '/wallets/adjust',
      token: auth.director.token,
      expectedStatus: [200, 201],
      body: {
        userId,
        amount,
        direction: 'ADD',
        description,
      },
    });
  };

  await runner.test('Ensure active bank account has enough balance for payroll payout', async () => {
    const bankAccountsRes = await request({
      method: 'GET',
      reqPath: '/financial-control/bank-accounts',
      token: auth.director.token,
      expectedStatus: [200],
    });
    const bankAccounts = Array.isArray(bankAccountsRes.data) ? bankAccountsRes.data : [];
    let bank = bankAccounts.find(
      (a) => a && a.status === 'ACTIVE' && Number(a.currentBalance || 0) >= 5_000_000_000,
    );

    if (!bank) {
      const created = await request({
        method: 'POST',
        reqPath: '/financial-control/bank-accounts',
        token: auth.director.token,
        expectedStatus: [200, 201],
        body: {
          bankName: 'VCB',
          accountNumber: `9999${Date.now()}`.slice(-12),
          accountHolder: 'Payroll Test',
          openingBalance: 5_000_000_000,
          isPrimary: true,
          description: 'Auto-created by teacher payroll ops test',
        },
      });
      bank = created.data;
    }

    payrollBankAccountId = normalizeId(bank && bank._id);
    ensure(payrollBankAccountId, 'Cannot resolve bank account id for payroll payout');
  });

  await runner.test('Load teacher class with students for operational payroll tests', async () => {
    const me = await request({
      method: 'GET',
      reqPath: '/users/me',
      token: auth.teacher.token,
      expectedStatus: [200],
    });
    teacherId = normalizeId(
      (auth.teacher.user && (auth.teacher.user._id || auth.teacher.user.id)) ||
        (me.data && (me.data._id || me.data.id || me.data.user)),
    );
    ensure(teacherId, 'Cannot resolve teacher id from /users/me');

    const studentsRes = await request({
      method: 'GET',
      reqPath: '/students',
      token: auth.director.token,
      expectedStatus: [200],
    });
    const students = Array.isArray(studentsRes.data) ? studentsRes.data : [];

    let selectedStudent = null;
    for (const student of students) {
      const sid = normalizeId(student && student._id);
      if (!sid) continue;
      const detail = await request({
        method: 'GET',
        reqPath: `/students/${sid}`,
        token: auth.director.token,
        expectedStatus: [200],
      });
      const parentUserId = normalizeId(detail.data && detail.data.parentUserId);
      if (!parentUserId) continue;
      selectedStudent = {
        studentId: sid,
        parentUserId,
      };
      break;
    }
    ensure(selectedStudent, 'No student with parentUserId available for payroll ops tests');

    const created = await request({
      method: 'POST',
      reqPath: '/classes',
      token: auth.director.token,
      expectedStatus: [200, 201],
      body: {
        name: `PAY WF ${Date.now()}`,
        code: randomCode('PWF'),
        teacherId,
        classMode: 'ONLINE',
        studentIds: [selectedStudent.studentId],
        pricePerSession: 180_000,
        teacherPayPerSession: 120_000,
        teacherPayPerStudent: 0,
        baseDuration: 60,
        sessionDuration: 60,
      },
    });
    createdClassId = normalizeId(created.data && created.data._id);
    ensure(createdClassId, 'Temporary payroll workflow class was not created');

    await topUpParentWallet(
      selectedStudent.parentUserId,
      3_000_000,
      'Top up wallet for teacher payroll operational session flow',
    );

    const classes = await request({
      method: 'GET',
      reqPath: '/attendance/classes-with-students',
      token: auth.teacher.token,
      expectedStatus: [200],
    });
    ensure(Array.isArray(classes.data), 'Teacher classes endpoint should return array');

    chosenClass = classes.data.find((c) => normalizeId(c.classId) === createdClassId);
    ensure(chosenClass, 'Temporary payroll workflow class not visible to teacher');
    chosenStudent = (chosenClass.students || []).find(
      (s) => normalizeId(s.studentId) === selectedStudent.studentId,
    );
    ensure(chosenStudent && chosenStudent.studentId, 'No student in selected temporary teacher class');
  });

  await runner.test('TEACHER is forbidden from creating production session directly', async () => {
    await request({
      method: 'POST',
      reqPath: '/sessions',
      token: auth.teacher.token,
      body: {
        classId: chosenClass.classId,
        studentId: chosenStudent.studentId,
        teacherId,
        scheduledDate: dateA,
        durationMinutes: 60,
      },
      expectedStatus: [403],
    });
  });

  await runner.test('Create finalized eligible session A (attendance + report + ops finalize)', async () => {
    sessions.a = await createAttendanceSession(dateA, 'A');
    await submitTeachingReport(sessions.a, 'A');
    await finalizeSession(sessions.a);
  });

  await runner.test('Create finalized eligible session B (attendance + report + ops finalize)', async () => {
    sessions.b = await createAttendanceSession(dateB, 'B');
    await submitTeachingReport(sessions.b, 'B');
    await finalizeSession(sessions.b);
  });

  await runner.test('Reject finalize for session C without teaching report and keep it out of payroll', async () => {
    sessions.c = await createAttendanceSession(dateC, 'C');
    await request({
      method: 'POST',
      reqPath: `/sessions/${sessions.c}/finalize`,
      token: auth.ops.token,
      expectedStatus: [400],
    });

    const detail = await request({
      method: 'GET',
      reqPath: `/sessions/${sessions.c}`,
      token: auth.director.token,
      expectedStatus: [200],
    });
    ensure(
      detail.data && detail.data.status === 'TEACHER_COMPLETED',
      `Session C must remain TEACHER_COMPLETED without report, got ${detail.data && detail.data.status}`,
    );
  });

  await runner.test('Create teacher-completed session E with report but not finalized', async () => {
    sessions.e = await createAttendanceSession(dateE, 'E');
    await submitTeachingReport(sessions.e, 'E');

    const detail = await request({
      method: 'GET',
      reqPath: `/sessions/${sessions.e}`,
      token: auth.director.token,
      expectedStatus: [200],
    });
    ensure(
      detail.data && detail.data.status === 'TEACHER_COMPLETED',
      `Session E must remain TEACHER_COMPLETED before payroll, got ${detail.data && detail.data.status}`,
    );
  });

  await runner.test('Generate payroll cycle #1 at cutoff date (cumulative unpaid to cutoff)', async () => {
    const created = await request({
      method: 'POST',
      reqPath: '/payroll',
      token: auth.director.token,
      body: {
        teacherId,
        periodStart: payrollPeriod1,
        periodEnd: payrollPeriod1,
        notes: 'Operational payroll cycle 1',
      },
      expectedStatus: [200, 201],
    });
    payroll1Id = normalizeId(created.data && created.data._id);
    ensure(payroll1Id, 'Payroll #1 id not returned');
  });

  await runner.test('Payroll #1 includes A,B and excludes C(no-report), E(not-finalized)', async () => {
    const itemsRes = await request({
      method: 'GET',
      reqPath: `/payroll/${payroll1Id}/items`,
      token: auth.director.token,
      expectedStatus: [200],
    });
    const items = Array.isArray(itemsRes.data) ? itemsRes.data : [];
    const itemA = findItemBySessionId(items, sessions.a);
    const itemB = findItemBySessionId(items, sessions.b);
    const itemC = findItemBySessionId(items, sessions.c);
    const itemE = findItemBySessionId(items, sessions.e);

    ensure(itemA, 'Payroll #1 must include session A');
    ensure(itemB, 'Payroll #1 must include session B');
    ensure(!itemC, 'Payroll #1 must not include session C (missing teaching report)');
    ensure(!itemE, 'Payroll #1 must not include session E (not finalized)');
  });

  await runner.test('Exclude session B item in payroll #1 (release for later cycle)', async () => {
    const itemsRes = await request({
      method: 'GET',
      reqPath: `/payroll/${payroll1Id}/items`,
      token: auth.director.token,
      expectedStatus: [200],
    });
    const items = Array.isArray(itemsRes.data) ? itemsRes.data : [];
    const itemB = findItemBySessionId(items, sessions.b);
    ensure(itemB, 'Cannot find session B item in payroll #1');

    const itemId = normalizeId(itemB._id);
    const payout = Number(itemB.adjustedPayout ?? itemB.teacherPayout ?? 0);
    ensure(itemId, 'Payroll #1 item id for session B is missing');
    ensure(Number.isFinite(payout) && payout >= 0, `Invalid payout for item B: ${payout}`);

    await request({
      method: 'PATCH',
      reqPath: `/payroll/${payroll1Id}/items/${itemId}`,
      token: auth.director.token,
      body: {
        adjustedPayout: payout,
        status: 'EXCLUDED',
        adjustmentReason: 'Temporarily excluded, to be paid next payroll cycle',
      },
      expectedStatus: [200],
    });

    const sessionB = await request({
      method: 'GET',
      reqPath: `/sessions/${sessions.b}`,
      token: auth.director.token,
      expectedStatus: [200],
    });
    ensure(
      sessionB.data && sessionB.data.isTeacherPaid === false,
      'Excluded session B must be released (isTeacherPaid=false)',
    );
  });

  await runner.test('Submit, approve and mark payroll #1 as paid', async () => {
    await request({
      method: 'POST',
      reqPath: `/payroll/${payroll1Id}/submit`,
      token: auth.ops.token,
      expectedStatus: [200, 201],
    });
    await request({
      method: 'POST',
      reqPath: `/payroll/${payroll1Id}/approve`,
      token: auth.director.token,
      expectedStatus: [200, 201],
    });
    await request({
      method: 'POST',
      reqPath: `/payroll/${payroll1Id}/mark-paid`,
      token: auth.director.token,
      body: {
        paymentRef: `OPS-CYCLE1-${Date.now()}`,
        bankAccountId: payrollBankAccountId,
      },
      expectedStatus: [200, 201],
    });

    const sessionA = await request({
      method: 'GET',
      reqPath: `/sessions/${sessions.a}`,
      token: auth.director.token,
      expectedStatus: [200],
    });
    const sessionB = await request({
      method: 'GET',
      reqPath: `/sessions/${sessions.b}`,
      token: auth.director.token,
      expectedStatus: [200],
    });

    ensure(sessionA.data && sessionA.data.isTeacherPaid === true, 'Session A should remain paid');
    ensure(
      sessionB.data && sessionB.data.isTeacherPaid === false,
      'Session B excluded in cycle #1 must stay unpaid before cycle #2',
    );
  });

  await runner.test('Create new eligible session D after cycle #1 payment', async () => {
    sessions.d = await createAttendanceSession(dateD, 'D');
    await submitTeachingReport(sessions.d, 'D');
    await finalizeSession(sessions.d);
  });

  await runner.test('Generate payroll cycle #2 (different month cutoff) and verify cumulative unpaid', async () => {
    const created = await request({
      method: 'POST',
      reqPath: '/payroll',
      token: auth.director.token,
      body: {
        teacherId,
        periodStart: payrollPeriod2,
        periodEnd: payrollPeriod2,
        notes: 'Operational payroll cycle 2',
      },
      expectedStatus: [200, 201],
    });
    payroll2Id = normalizeId(created.data && created.data._id);
    ensure(payroll2Id, 'Payroll #2 id not returned');

    const itemsRes = await request({
      method: 'GET',
      reqPath: `/payroll/${payroll2Id}/items`,
      token: auth.director.token,
      expectedStatus: [200],
    });
    const items = Array.isArray(itemsRes.data) ? itemsRes.data : [];

    const itemA = findItemBySessionId(items, sessions.a);
    const itemB = findItemBySessionId(items, sessions.b);
    const itemC = findItemBySessionId(items, sessions.c);
    const itemD = findItemBySessionId(items, sessions.d);
    const itemE = findItemBySessionId(items, sessions.e);

    ensure(!itemA, 'Session A already paid in cycle #1 must not appear in cycle #2');
    ensure(itemB, 'Session B excluded in cycle #1 must be payable in cycle #2');
    ensure(!itemC, 'Session C without report must not appear in cycle #2');
    ensure(itemD, 'New eligible session D must appear in cycle #2');
    ensure(!itemE, 'Session E not finalized must not appear in cycle #2');
  });

  await runner.test('Session B is claimed again after payroll #2 generation', async () => {
    const sessionB = await request({
      method: 'GET',
      reqPath: `/sessions/${sessions.b}`,
      token: auth.director.token,
      expectedStatus: [200],
    });
    ensure(
      sessionB.data && sessionB.data.isTeacherPaid === true,
      'Session B should be claimed again by payroll cycle #2',
    );
  });

  const result = runner.summary();
  if (createdClassId && auth.director && auth.director.token) {
    try {
      await request({
        method: 'DELETE',
        reqPath: `/classes/${createdClassId}`,
        token: auth.director.token,
        expectedStatus: [200, 204],
      });
    } catch (err) {
      console.log(`Cleanup warning: could not delete temporary class ${createdClassId}`);
    }
  }
  if (result.fail > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('\nFatal error running teacher payroll operational tests:');
  console.error(err);
  process.exit(1);
});
