/* eslint-disable no-console */
const path = require('path');

try {
  // eslint-disable-next-line global-require
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
} catch (_) {}

const API_BASE = process.env.TEST_API_BASE || `http://localhost:${process.env.PORT || 3000}`;
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'ChangeThisDemoPass2024!';
const REQUEST_TIMEOUT_MS = 30000;

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
          `Response: ${parsed.text.slice(0, 500)}`,
      );
    }

    return { status: res.status, data: parsed.json, raw: parsed.text };
  } finally {
    clearTimeout(timer);
  }
}

async function loginDirector() {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'director.demo@school.local', password: DEMO_PASSWORD }),
  });

  const parsed = await parseResponse(res);
  if (res.status !== 201 && res.status !== 200) {
    throw new Error(`Login failed: ${parsed.text}`);
  }

  const cookieJar = extractCookiesFromResponse(res);
  ensure(cookieJar.access_token, 'No access_token cookie returned');

  if (!cookieJar['XSRF-TOKEN']) {
    const meRes = await fetch(`${API_BASE}/users/me`, {
      headers: { Cookie: `access_token=${cookieJar.access_token}` },
    });
    Object.assign(cookieJar, extractCookiesFromResponse(meRes));
  }

  ensure(cookieJar['XSRF-TOKEN'], 'No XSRF-TOKEN cookie returned');
  return buildCookieHeader({
    access_token: cookieJar.access_token,
    'XSRF-TOKEN': cookieJar['XSRF-TOKEN'],
  });
}

async function loginUser(email, password) {
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
    cookie: buildCookieHeader({
      access_token: cookieJar.access_token,
      'XSRF-TOKEN': cookieJar['XSRF-TOKEN'],
    }),
    user: parsed.json && parsed.json.user ? parsed.json.user : null,
  };
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

async function waitFor(description, fn, maxAttempts = 30, intervalMs = 500) {
  let lastError = null;
  for (let i = 1; i <= maxAttempts; i += 1) {
    try {
      const result = await fn();
      if (result) return result;
    } catch (err) {
      lastError = err;
    }
    await sleep(intervalMs);
  }
  if (lastError) throw lastError;
  throw new Error(`Timeout waiting for ${description}`);
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
    console.log('\n=== Class + Attendance + Pricing Workflow Summary ===');
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

async function getWalletBalance(token, userId) {
  const res = await request({
    method: 'GET',
    reqPath: `/wallets/user/${userId}`,
    token,
    expectedStatus: [200],
  });
  return Number(res.data.balance || 0);
}

async function topUpWallet(token, userId, amount, description) {
  await request({
    method: 'POST',
    reqPath: '/wallets/adjust',
    token,
    expectedStatus: [200, 201],
    body: {
      userId,
      amount,
      direction: 'ADD',
      description,
    },
  });
}

async function findSessionDeductEntry(token, userId, sessionId) {
  const ledgerRes = await request({
    method: 'GET',
    reqPath: `/wallets/ledger${qs({
      userId,
      type: 'SESSION_DEDUCT',
      limit: 200,
    })}`,
    token,
    expectedStatus: [200],
  });
  const items = Array.isArray(ledgerRes.data?.data) ? ledgerRes.data.data : [];
  return items.find((e) => normalizeId(e.sessionId && e.sessionId._id) === sessionId) || null;
}

async function main() {
  const runner = new TestRunner();
  const createdClassIds = [];
  let token = null;
  let teacherToken = null;

  const selected = {
    teacherId: null,
    onlineStudent: null,
    offlineStudentA: null,
    offlineStudentB: null,
  };

  const wallets = {
    beforeFinalize: {},
    afterFinalize: {},
  };

  const ids = {
    onlineClassId: null,
    offlineClassId: null,
    onlineSession1: null,
    onlineSession2: null,
    offlineSessionOnePresent: null,
    offlineSessionBothPresentA: null,
    offlineSessionBothPresentB: null,
  };

  const submitTeachingReport = async (sessionId, label) => {
    const report = await request({
      method: 'PATCH',
      reqPath: `/sessions/${sessionId}/teaching-report`,
      token: teacherToken,
      expectedStatus: [200],
      body: {
        lessonContent: `Class attendance pricing workflow report for ${label}, đủ dài để hợp lệ.`,
        teacherComment: `teacher report ${label}`,
      },
    });
    ensure(
      report.data && report.data.hasTeachingReport === true,
      `Session ${sessionId} should have teaching report after submit`,
    );
  };

  const now = new Date();
  const dateOnline1 = formatDateYYYYMMDD(addDays(now, 520));
  const dateOnline2 = formatDateYYYYMMDD(addDays(now, 521));
  const dateOffline1 = formatDateYYYYMMDD(addDays(now, 522));
  const dateOffline2 = formatDateYYYYMMDD(addDays(now, 523));

  await runner.test('Login DIRECTOR demo account', async () => {
    token = await loginDirector();
    ensure(token && token.includes('access_token='), 'Director token missing');
  });

  await runner.test('Login TEACHER demo account', async () => {
    const teacherLogin = await loginUser('teacher.demo@school.local', DEMO_PASSWORD);
    teacherToken = teacherLogin.cookie;
    ensure(teacherToken && teacherToken.includes('access_token='), 'Teacher token missing');
  });

  await runner.test('Pick teacher and students for workflow', async () => {
    const meRes = await request({
      method: 'GET',
      reqPath: '/users/me',
      token: teacherToken,
      expectedStatus: [200],
    });
    selected.teacherId = normalizeId(
      meRes.data && (meRes.data._id || meRes.data.id || meRes.data.user),
    );
    ensure(selected.teacherId, 'Teacher demo id missing');

    const usersRes = await request({
      method: 'GET',
      reqPath: '/users',
      token,
      expectedStatus: [200],
    });
    const users = Array.isArray(usersRes.data) ? usersRes.data : [];
    const teachers = users.filter((u) => u.role === 'TEACHER');
    ensure(teachers.length > 0, 'No teacher found');
    ensure(
      teachers.some((u) => normalizeId(u._id) === selected.teacherId),
      'Teacher demo must exist in users list',
    );

    const studentsRes = await request({
      method: 'GET',
      reqPath: '/students',
      token,
      expectedStatus: [200],
    });
    const students = Array.isArray(studentsRes.data) ? studentsRes.data : [];
    const approved = students.filter((s) => s.approvalStatus === 'APPROVED');
    ensure(approved.length >= 2, 'Need at least 2 approved students for workflow test');

    const eligible = [];
    for (const s of approved) {
      const sid = normalizeId(s._id);
      if (!sid) continue;
      const detail = await request({
        method: 'GET',
        reqPath: `/students/${sid}`,
        token,
        expectedStatus: [200],
      });
      const parentUserId = normalizeId(detail.data && detail.data.parentUserId);
      if (!parentUserId) continue;
      eligible.push({
        studentId: sid,
        fullName: s.fullName || sid,
        parentUserId,
      });
      if (eligible.length >= 4) break;
    }

    ensure(eligible.length >= 2, 'Need at least 2 students with parentUserId for workflow');

    selected.onlineStudent = eligible[0];
    selected.offlineStudentA = eligible[0];
    selected.offlineStudentB = eligible[1];

    console.log(
      `Selected teacher=${selected.teacherId}, onlineStudent=${selected.onlineStudent.studentId}, ` +
        `offlineStudents=[${selected.offlineStudentA.studentId}, ${selected.offlineStudentB.studentId}]`,
    );
  });

  await runner.test('Top up wallets for involved parents', async () => {
    const uniqueParents = Array.from(
      new Set([
        selected.onlineStudent.parentUserId,
        selected.offlineStudentA.parentUserId,
        selected.offlineStudentB.parentUserId,
      ]),
    );

    for (const pid of uniqueParents) {
      await topUpWallet(token, pid, 1_000_000, 'workflow test top-up');
      const balance = await getWalletBalance(token, pid);
      wallets.beforeFinalize[pid] = balance;
      ensure(Number.isFinite(balance), `Wallet balance missing for ${pid}`);
    }
  });

  await runner.test('Create ONLINE class (new)', async () => {
    const payload = {
      name: `WF ONLINE ${Date.now()}`,
      code: randomCode('WFON'),
      teacherId: selected.teacherId,
      classMode: 'ONLINE',
      studentIds: [selected.onlineStudent.studentId],
      pricePerSession: 150_000,
      teacherPayPerSession: 100_000,
      teacherPayPerStudent: 0,
      baseDuration: 60,
      sessionDuration: 60,
    };
    const res = await request({
      method: 'POST',
      reqPath: '/classes',
      token,
      expectedStatus: [200, 201],
      body: payload,
    });
    ids.onlineClassId = normalizeId(res.data && res.data._id);
    ensure(ids.onlineClassId, 'ONLINE class id missing');
    createdClassIds.push(ids.onlineClassId);
  });

  await runner.test('ONLINE attendance #1 -> session pricing and payout must match initial class price', async () => {
    const mark = await request({
      method: 'POST',
      reqPath: '/attendance/mark',
      token,
      expectedStatus: [200, 201],
      body: {
        classId: ids.onlineClassId,
        studentId: selected.onlineStudent.studentId,
        date: dateOnline1,
        status: 'PRESENT',
        notes: 'workflow-online-1',
      },
    });

    ids.onlineSession1 = normalizeId(mark.data && mark.data.sessionId);
    ensure(ids.onlineSession1, 'ONLINE session #1 was not created');

    const s = await request({
      method: 'GET',
      reqPath: `/sessions/${ids.onlineSession1}`,
      token,
      expectedStatus: [200],
    });
    ensure(Number(s.data.amountCharged) === 150_000, `Expected amountCharged=150000, got ${s.data.amountCharged}`);
    ensure(Number(s.data.teacherPayout) === 100_000, `Expected teacherPayout=100000, got ${s.data.teacherPayout}`);

    await submitTeachingReport(ids.onlineSession1, 'online-session-1');

    await request({
      method: 'POST',
      reqPath: `/sessions/${ids.onlineSession1}/finalize`,
      token,
      expectedStatus: [200, 201],
    });

    const entry = await waitFor(
      'online session #1 wallet deduction',
      async () => findSessionDeductEntry(token, selected.onlineStudent.parentUserId, ids.onlineSession1),
      20,
      300,
    );
    ensure(entry, 'No SESSION_DEDUCT ledger entry for online session #1');
    ensure(Number(entry.amount) === 150_000, `Expected ledger amount=150000, got ${entry.amount}`);
    ensure(
      Number(entry.balanceBefore) - Number(entry.balanceAfter) === 150_000,
      `Expected balance delta=150000, got ${Number(entry.balanceBefore) - Number(entry.balanceAfter)}`,
    );
  });

  await runner.test('Update ONLINE class price/pay and verify next session uses new values only', async () => {
    await request({
      method: 'PATCH',
      reqPath: `/classes/${ids.onlineClassId}`,
      token,
      expectedStatus: [200],
      body: {
        pricePerSession: 220_000,
        teacherPayPerSession: 140_000,
      },
    });

    const oldSession = await request({
      method: 'GET',
      reqPath: `/sessions/${ids.onlineSession1}`,
      token,
      expectedStatus: [200],
    });
    ensure(
      Number(oldSession.data.amountCharged) === 150_000 && Number(oldSession.data.teacherPayout) === 100_000,
      'Old ONLINE session should keep old pricing after class update',
    );

    const mark = await request({
      method: 'POST',
      reqPath: '/attendance/mark',
      token,
      expectedStatus: [200, 201],
      body: {
        classId: ids.onlineClassId,
        studentId: selected.onlineStudent.studentId,
        date: dateOnline2,
        status: 'PRESENT',
        notes: 'workflow-online-2-after-price-change',
      },
    });
    ids.onlineSession2 = normalizeId(mark.data && mark.data.sessionId);
    ensure(ids.onlineSession2, 'ONLINE session #2 was not created');

    const newSession = await request({
      method: 'GET',
      reqPath: `/sessions/${ids.onlineSession2}`,
      token,
      expectedStatus: [200],
    });
    ensure(Number(newSession.data.amountCharged) === 220_000, `Expected amountCharged=220000, got ${newSession.data.amountCharged}`);
    ensure(Number(newSession.data.teacherPayout) === 140_000, `Expected teacherPayout=140000, got ${newSession.data.teacherPayout}`);

    await submitTeachingReport(ids.onlineSession2, 'online-session-2');

    await request({
      method: 'POST',
      reqPath: `/sessions/${ids.onlineSession2}/finalize`,
      token,
      expectedStatus: [200, 201],
    });

    const entry = await waitFor(
      'online session #2 wallet deduction',
      async () => findSessionDeductEntry(token, selected.onlineStudent.parentUserId, ids.onlineSession2),
      20,
      300,
    );
    ensure(Number(entry.amount) === 220_000, `Expected ledger amount=220000, got ${entry.amount}`);
  });

  await runner.test('Create OFFLINE class then add students into class', async () => {
    const payload = {
      name: `WF OFFLINE ${Date.now()}`,
      code: randomCode('WFOF'),
      teacherId: selected.teacherId,
      classMode: 'OFFLINE',
      studentIds: [],
      pricePerSession: 120_000,
      teacherPayPerSession: 0,
      teacherPayPerStudent: 80_000,
      baseDuration: 60,
      sessionDuration: 60,
    };
    const res = await request({
      method: 'POST',
      reqPath: '/classes',
      token,
      expectedStatus: [200, 201],
      body: payload,
    });
    ids.offlineClassId = normalizeId(res.data && res.data._id);
    ensure(ids.offlineClassId, 'OFFLINE class id missing');
    createdClassIds.push(ids.offlineClassId);

    const assign = await request({
      method: 'POST',
      reqPath: `/classes/${ids.offlineClassId}/assign-students`,
      token,
      expectedStatus: [200, 201],
      body: { studentIds: [selected.offlineStudentA.studentId, selected.offlineStudentB.studentId] },
    });
    const assignedStudents = Array.isArray(assign.data?.students) ? assign.data.students : [];
    const assignedIds = new Set(assignedStudents.map((s) => normalizeId(s._id)));
    ensure(assignedIds.has(selected.offlineStudentA.studentId), 'Offline student A not assigned');
    ensure(assignedIds.has(selected.offlineStudentB.studentId), 'Offline student B not assigned');
  });

  await runner.test('OFFLINE bulk attendance (1 present, 1 absent): min teacher payout 200k and absent has no session', async () => {
    const bulk = await request({
      method: 'POST',
      reqPath: '/attendance/bulk-mark',
      token,
      expectedStatus: [200, 201],
      body: {
        classId: ids.offlineClassId,
        date: dateOffline1,
        attendances: [
          { studentId: selected.offlineStudentA.studentId, status: 'PRESENT', notes: 'offline-present' },
          { studentId: selected.offlineStudentB.studentId, status: 'ABSENT', notes: 'offline-absent' },
        ],
      },
    });

    ensure(bulk.data.classMode === 'OFFLINE', 'Expected OFFLINE summary in bulk response');
    ensure(Number(bulk.data.attendedCount) === 1, `Expected attendedCount=1, got ${bulk.data.attendedCount}`);
    ensure(Number(bulk.data.totalTeacherPayout) === 200_000, `Expected totalTeacherPayout=200000, got ${bulk.data.totalTeacherPayout}`);
    ensure(Boolean(bulk.data.minimumTeacherPayoutApplied) === true, 'Expected minimumTeacherPayoutApplied=true');

    const success = Array.isArray(bulk.data.success) ? bulk.data.success : [];
    const presentAtt = success.find(
      (a) =>
        normalizeId(a.studentId && a.studentId._id ? a.studentId._id : a.studentId) ===
          selected.offlineStudentA.studentId && a.status === 'PRESENT',
    );
    const absentAtt = success.find(
      (a) =>
        normalizeId(a.studentId && a.studentId._id ? a.studentId._id : a.studentId) ===
          selected.offlineStudentB.studentId && a.status === 'ABSENT',
    );

    ids.offlineSessionOnePresent = normalizeId(presentAtt && presentAtt.sessionId);
    ensure(ids.offlineSessionOnePresent, 'Expected session for offline PRESENT student');
    ensure(!normalizeId(absentAtt && absentAtt.sessionId), 'ABSENT student must not have sessionId');

    await submitTeachingReport(ids.offlineSessionOnePresent, 'offline-one-present');

    await request({
      method: 'POST',
      reqPath: `/sessions/${ids.offlineSessionOnePresent}/finalize`,
      token,
      expectedStatus: [200, 201],
    });

    const s = await request({
      method: 'GET',
      reqPath: `/sessions/${ids.offlineSessionOnePresent}`,
      token,
      expectedStatus: [200],
    });
    ensure(Number(s.data.amountCharged) === 120_000, `Expected amountCharged=120000, got ${s.data.amountCharged}`);
    ensure(Number(s.data.teacherPayout) === 200_000, `Expected teacherPayout=200000 due min rule, got ${s.data.teacherPayout}`);

    const entry = await waitFor(
      'offline first session wallet deduction',
      async () => findSessionDeductEntry(token, selected.offlineStudentA.parentUserId, ids.offlineSessionOnePresent),
      20,
      300,
    );
    ensure(Number(entry.amount) === 120_000, `Expected ledger amount=120000, got ${entry.amount}`);
  });

  await runner.test('Update OFFLINE pricing and verify next day payout uses per-student rule without min', async () => {
    await request({
      method: 'PATCH',
      reqPath: `/classes/${ids.offlineClassId}`,
      token,
      expectedStatus: [200],
      body: {
        pricePerSession: 180_000,
        teacherPayPerStudent: 120_000,
      },
    });

    const bulk = await request({
      method: 'POST',
      reqPath: '/attendance/bulk-mark',
      token,
      expectedStatus: [200, 201],
      body: {
        classId: ids.offlineClassId,
        date: dateOffline2,
        attendances: [
          { studentId: selected.offlineStudentA.studentId, status: 'PRESENT', notes: 'offline-both-present-a' },
          { studentId: selected.offlineStudentB.studentId, status: 'PRESENT', notes: 'offline-both-present-b' },
        ],
      },
    });

    ensure(Number(bulk.data.attendedCount) === 2, `Expected attendedCount=2, got ${bulk.data.attendedCount}`);
    ensure(Number(bulk.data.totalTeacherPayout) === 240_000, `Expected totalTeacherPayout=240000, got ${bulk.data.totalTeacherPayout}`);
    ensure(Boolean(bulk.data.minimumTeacherPayoutApplied) === false, 'Expected minimumTeacherPayoutApplied=false');

    const success = Array.isArray(bulk.data.success) ? bulk.data.success : [];
    const attA = success.find(
      (a) =>
        normalizeId(a.studentId && a.studentId._id ? a.studentId._id : a.studentId) ===
        selected.offlineStudentA.studentId,
    );
    const attB = success.find(
      (a) =>
        normalizeId(a.studentId && a.studentId._id ? a.studentId._id : a.studentId) ===
        selected.offlineStudentB.studentId,
    );
    ids.offlineSessionBothPresentA = normalizeId(attA && attA.sessionId);
    ids.offlineSessionBothPresentB = normalizeId(attB && attB.sessionId);
    ensure(ids.offlineSessionBothPresentA && ids.offlineSessionBothPresentB, 'Both PRESENT students must have sessions');

    const sA = await request({
      method: 'GET',
      reqPath: `/sessions/${ids.offlineSessionBothPresentA}`,
      token,
      expectedStatus: [200],
    });
    const sB = await request({
      method: 'GET',
      reqPath: `/sessions/${ids.offlineSessionBothPresentB}`,
      token,
      expectedStatus: [200],
    });

    ensure(Number(sA.data.amountCharged) === 180_000, `Expected amountCharged A=180000, got ${sA.data.amountCharged}`);
    ensure(Number(sB.data.amountCharged) === 180_000, `Expected amountCharged B=180000, got ${sB.data.amountCharged}`);

    const teacherTotal = Number(sA.data.teacherPayout || 0) + Number(sB.data.teacherPayout || 0);
    ensure(teacherTotal === 240_000, `Expected teacherPayout total=240000, got ${teacherTotal}`);

    await submitTeachingReport(ids.offlineSessionBothPresentA, 'offline-both-present-a');
    await submitTeachingReport(ids.offlineSessionBothPresentB, 'offline-both-present-b');

    await request({
      method: 'POST',
      reqPath: `/sessions/${ids.offlineSessionBothPresentA}/finalize`,
      token,
      expectedStatus: [200, 201],
    });
    await request({
      method: 'POST',
      reqPath: `/sessions/${ids.offlineSessionBothPresentB}/finalize`,
      token,
      expectedStatus: [200, 201],
    });

    const entryA = await waitFor(
      'offline session A wallet deduction',
      async () => findSessionDeductEntry(token, selected.offlineStudentA.parentUserId, ids.offlineSessionBothPresentA),
      20,
      300,
    );
    const entryB = await waitFor(
      'offline session B wallet deduction',
      async () => findSessionDeductEntry(token, selected.offlineStudentB.parentUserId, ids.offlineSessionBothPresentB),
      20,
      300,
    );

    ensure(Number(entryA.amount) === 180_000, `Expected entry A amount=180000, got ${entryA.amount}`);
    ensure(Number(entryB.amount) === 180_000, `Expected entry B amount=180000, got ${entryB.amount}`);
  });

  await runner.test('Capture final wallet balances (sanity)', async () => {
    const uniqueParents = Array.from(
      new Set([
        selected.onlineStudent.parentUserId,
        selected.offlineStudentA.parentUserId,
        selected.offlineStudentB.parentUserId,
      ]),
    );
    for (const pid of uniqueParents) {
      wallets.afterFinalize[pid] = await getWalletBalance(token, pid);
      ensure(
        wallets.afterFinalize[pid] <= wallets.beforeFinalize[pid],
        `Expected wallet after <= before for user ${pid}`,
      );
    }
  });

  const result = runner.summary();

  if (createdClassIds.length > 0 && token) {
    console.log('\nCleanup: deleting test classes...');
    for (const classId of createdClassIds.reverse()) {
      try {
        await request({
          method: 'DELETE',
          reqPath: `/classes/${classId}`,
          token,
          expectedStatus: [200, 204],
        });
        console.log(`- deleted class ${classId}`);
      } catch (err) {
        console.log(`- cleanup failed for class ${classId}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  if (result.fail > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('\nFatal error running workflow test:');
  console.error(err);
  process.exit(1);
});

