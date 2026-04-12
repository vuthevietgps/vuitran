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
          `Response: ${parsed.text.slice(0, 700)}`,
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
    console.log('\n=== Sessions Page Workflow Summary ===');
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

async function getWalletBalance(token, userId) {
  const res = await request({
    method: 'GET',
    reqPath: `/wallets/user/${userId}`,
    token,
    expectedStatus: [200],
  });
  return Number(res.data && res.data.balance ? res.data.balance : 0);
}

async function findSessionDeductEntry(token, userId, sessionId) {
  const res = await request({
    method: 'GET',
    reqPath: `/wallets/ledger${qs({ userId, type: 'SESSION_DEDUCT', limit: 200 })}`,
    token,
    expectedStatus: [200],
  });
  const items = Array.isArray(res.data && res.data.data) ? res.data.data : [];
  return items.find((entry) => normalizeId(entry.sessionId && entry.sessionId._id) === sessionId) || null;
}

async function main() {
  const runner = new TestRunner();
  const auth = {};
  const state = {
    teacherId: null,
    parentId: null,
    primaryStudent: null,
    secondaryStudent: null,
    classId: null,
    singleSessionId: null,
    bulkSessionIds: [],
    cancelSessionId: null,
    removeSessionId: null,
    walletBeforeConfirm: 0,
  };

  const now = new Date();
  const singleDate = formatDateYYYYMMDD(addDays(now, 640));
  const bulkDate = formatDateYYYYMMDD(addDays(now, 641));
  const cancelDate = formatDateYYYYMMDD(addDays(now, 642));
  const removeDate = formatDateYYYYMMDD(addDays(now, 643));

  await runner.test('Login director, teacher and parent demo accounts', async () => {
    const accounts = {
      director: 'director.demo@school.local',
      teacher: 'teacher.demo@school.local',
      parent: 'parent.demo@school.local',
    };
    for (const [role, email] of Object.entries(accounts)) {
      const loginData = await loginWithRetry(email, DEMO_PASSWORD, 4);
      auth[role] = loginData;
    }
  });

  await runner.test('Resolve teacher and parent ids', async () => {
    const teacherMe = await request({
      method: 'GET',
      reqPath: '/users/me',
      token: auth.teacher.token,
      expectedStatus: [200],
    });
    const parentMe = await request({
      method: 'GET',
      reqPath: '/users/me',
      token: auth.parent.token,
      expectedStatus: [200],
    });
    state.teacherId = normalizeId(teacherMe.data && (teacherMe.data._id || teacherMe.data.id || teacherMe.data.user));
    state.parentId = normalizeId(parentMe.data && (parentMe.data._id || parentMe.data.id || parentMe.data.user));
    ensure(state.teacherId, 'Teacher demo id not found');
    ensure(state.parentId, 'Parent demo id not found');
  });

  await runner.test('Prepare students and temporary class for sessions page workflow', async () => {
    const studentsRes = await request({
      method: 'GET',
      reqPath: '/students',
      token: auth.director.token,
      expectedStatus: [200],
    });
    const students = Array.isArray(studentsRes.data) ? studentsRes.data : [];

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

      const candidate = {
        studentId: sid,
        parentUserId,
        fullName: detail.data && detail.data.fullName,
      };

      if (!state.primaryStudent && parentUserId === state.parentId) {
        state.primaryStudent = candidate;
        continue;
      }
      if (!state.secondaryStudent && sid !== normalizeId(state.primaryStudent && state.primaryStudent.studentId)) {
        state.secondaryStudent = candidate;
      }
      if (state.primaryStudent && state.secondaryStudent) break;
    }

    ensure(state.primaryStudent, 'Cannot find a student that belongs to parent.demo');
    const classStudentIds = [state.primaryStudent.studentId];
    if (state.secondaryStudent) {
      classStudentIds.push(state.secondaryStudent.studentId);
    }

    await topUpWallet(
      auth.director.token,
      state.primaryStudent.parentUserId,
      2_000_000,
      'Top up wallet for sessions page workflow',
    );

    const created = await request({
      method: 'POST',
      reqPath: '/classes',
      token: auth.director.token,
      expectedStatus: [200, 201],
      body: {
        name: `SESS WF ${Date.now()}`,
        code: randomCode('SWF'),
        teacherId: state.teacherId,
        classMode: 'ONLINE',
        studentIds: classStudentIds,
        pricePerSession: 160_000,
        teacherPayPerSession: 100_000,
        teacherPayPerStudent: 0,
        baseDuration: 60,
        sessionDuration: 60,
      },
    });
    state.classId = normalizeId(created.data && created.data._id);
    ensure(state.classId, 'Temporary sessions workflow class was not created');
  });

  await runner.test('DIRECTOR creates one scheduled session', async () => {
    const created = await request({
      method: 'POST',
      reqPath: '/sessions',
      token: auth.director.token,
      expectedStatus: [200, 201],
      body: {
        classId: state.classId,
        studentId: state.primaryStudent.studentId,
        teacherId: state.teacherId,
        parentUserId: state.primaryStudent.parentUserId,
        scheduledDate: singleDate,
        scheduledStartTime: '09:00',
        scheduledEndTime: '10:00',
        durationMinutes: 60,
      },
    });
    state.singleSessionId = normalizeId(created.data && created.data._id);
    ensure(state.singleSessionId, 'Single session id missing');
    ensure(created.data && created.data.status === 'SCHEDULED', 'Single session must start as SCHEDULED');
  });

  await runner.test('List and stats endpoints reflect the scheduled session', async () => {
    const listRes = await request({
      method: 'GET',
      reqPath: `/sessions${qs({
        classId: state.classId,
        fromDate: singleDate,
        toDate: singleDate,
        limit: 50,
      })}`,
      token: auth.director.token,
      expectedStatus: [200],
    });
    const sessions = Array.isArray(listRes.data && listRes.data.data) ? listRes.data.data : [];
    ensure(
      sessions.some((session) => normalizeId(session._id) === state.singleSessionId),
      'Single session not found in director list',
    );

    const statsRes = await request({
      method: 'GET',
      reqPath: `/sessions/stats${qs({ classId: state.classId, fromDate: singleDate, toDate: removeDate })}`,
      token: auth.director.token,
      expectedStatus: [200],
    });
    ensure(Number(statsRes.data && statsRes.data.totalSessions) >= 1, 'Stats should count at least one session');
  });

  await runner.test('TEACHER sees the scheduled session in own list', async () => {
    const listRes = await request({
      method: 'GET',
      reqPath: `/sessions${qs({ classId: state.classId, limit: 50 })}`,
      token: auth.teacher.token,
      expectedStatus: [200],
    });
    const sessions = Array.isArray(listRes.data && listRes.data.data) ? listRes.data.data : [];
    ensure(
      sessions.some((session) => normalizeId(session._id) === state.singleSessionId),
      'Teacher list should include the scheduled session',
    );
  });

  await runner.test('TEACHER completes and reports the session', async () => {
    const completed = await request({
      method: 'POST',
      reqPath: `/sessions/${state.singleSessionId}/complete`,
      token: auth.teacher.token,
      expectedStatus: [200, 201],
      body: {
        topicsCovered: 'Grammar practice',
        homework: 'Workbook page 12',
        teacherNotes: 'Good participation',
      },
    });
    ensure(completed.data && completed.data.status === 'TEACHER_COMPLETED', 'Session should become TEACHER_COMPLETED');

    const report = await request({
      method: 'PATCH',
      reqPath: `/sessions/${state.singleSessionId}/teaching-report`,
      token: auth.teacher.token,
      expectedStatus: [200],
      body: {
        lessonContent: 'Sessions page workflow teaching report with enough detail for validation.',
        teacherComment: 'Student followed the lesson well.',
      },
    });
    ensure(report.data && report.data.hasTeachingReport === true, 'Teaching report should be stored');
  });

  await runner.test('PARENT sees the completed session and confirms it', async () => {
    state.walletBeforeConfirm = await getWalletBalance(auth.director.token, state.primaryStudent.parentUserId);

    const parentList = await request({
      method: 'GET',
      reqPath: `/sessions/my-children${qs({ classId: state.classId, limit: 50 })}`,
      token: auth.parent.token,
      expectedStatus: [200],
    });
    const parentSessions = Array.isArray(parentList.data && parentList.data.data) ? parentList.data.data : [];
    ensure(
      parentSessions.some((session) => normalizeId(session._id) === state.singleSessionId),
      'Parent list should include the completed session',
    );

    const confirmed = await request({
      method: 'POST',
      reqPath: `/sessions/${state.singleSessionId}/confirm`,
      token: auth.parent.token,
      expectedStatus: [200, 201],
      body: {
        overallRating: 5,
        parentRating: 5,
        teachingQualityRating: 5,
        communicationRating: 5,
        isSatisfied: true,
        parentNotes: 'Session confirmed in workflow test',
      },
    });
    ensure(confirmed.data && confirmed.data.status === 'FINALIZED', 'Parent confirmation should finalize the session');
  });

  await runner.test('Finalize propagation deducts wallet and persists FINALIZED status', async () => {
    const detail = await request({
      method: 'GET',
      reqPath: `/sessions/${state.singleSessionId}`,
      token: auth.director.token,
      expectedStatus: [200],
    });
    ensure(detail.data && detail.data.status === 'FINALIZED', 'Session detail must stay FINALIZED');

    const ledgerEntry = await findSessionDeductEntry(
      auth.director.token,
      state.primaryStudent.parentUserId,
      state.singleSessionId,
    );
    ensure(ledgerEntry, 'Wallet ledger should contain SESSION_DEDUCT for confirmed session');

    const walletAfter = await getWalletBalance(auth.director.token, state.primaryStudent.parentUserId);
    ensure(
      walletAfter <= state.walletBeforeConfirm,
      `Wallet should decrease or remain equal after confirm (before=${state.walletBeforeConfirm}, after=${walletAfter})`,
    );
  });

  await runner.test('DIRECTOR bulk creates scheduled sessions for the class', async () => {
    const students = [
      {
        studentId: state.primaryStudent.studentId,
        parentUserId: state.primaryStudent.parentUserId,
      },
    ];
    if (state.secondaryStudent) {
      students.push({
        studentId: state.secondaryStudent.studentId,
        parentUserId: state.secondaryStudent.parentUserId,
      });
    }

    const created = await request({
      method: 'POST',
      reqPath: '/sessions/bulk',
      token: auth.director.token,
      expectedStatus: [200, 201],
      body: {
        classId: state.classId,
        teacherId: state.teacherId,
        scheduledDate: bulkDate,
        scheduledStartTime: '11:00',
        scheduledEndTime: '12:00',
        durationMinutes: 60,
        students,
      },
    });
    const sessions = Array.isArray(created.data) ? created.data : [];
    state.bulkSessionIds = sessions.map((session) => normalizeId(session && session._id)).filter(Boolean);
    ensure(state.bulkSessionIds.length >= 1, 'Bulk create should create at least one session');
  });

  await runner.test('DIRECTOR creates and cancels another scheduled session', async () => {
    const created = await request({
      method: 'POST',
      reqPath: '/sessions',
      token: auth.director.token,
      expectedStatus: [200, 201],
      body: {
        classId: state.classId,
        studentId: state.primaryStudent.studentId,
        teacherId: state.teacherId,
        parentUserId: state.primaryStudent.parentUserId,
        scheduledDate: cancelDate,
        scheduledStartTime: '13:00',
        scheduledEndTime: '14:00',
        durationMinutes: 60,
      },
    });
    state.cancelSessionId = normalizeId(created.data && created.data._id);
    ensure(state.cancelSessionId, 'Cancel session id missing');

    const cancelled = await request({
      method: 'POST',
      reqPath: `/sessions/${state.cancelSessionId}/cancel`,
      token: auth.director.token,
      expectedStatus: [200, 201],
      body: { cancelReason: 'Sessions page workflow cancel test' },
    });
    ensure(cancelled.data && cancelled.data.status === 'CANCELLED', 'Cancelled session must be CANCELLED');
  });

  await runner.test('DIRECTOR creates and removes a scheduled session', async () => {
    const created = await request({
      method: 'POST',
      reqPath: '/sessions',
      token: auth.director.token,
      expectedStatus: [200, 201],
      body: {
        classId: state.classId,
        studentId: state.primaryStudent.studentId,
        teacherId: state.teacherId,
        parentUserId: state.primaryStudent.parentUserId,
        scheduledDate: removeDate,
        scheduledStartTime: '15:00',
        scheduledEndTime: '16:00',
        durationMinutes: 60,
      },
    });
    state.removeSessionId = normalizeId(created.data && created.data._id);
    ensure(state.removeSessionId, 'Remove session id missing');

    await request({
      method: 'DELETE',
      reqPath: `/sessions/${state.removeSessionId}`,
      token: auth.director.token,
      expectedStatus: [200, 204],
    });
    await request({
      method: 'GET',
      reqPath: `/sessions/${state.removeSessionId}`,
      token: auth.director.token,
      expectedStatus: [404],
    });
  });

  const result = runner.summary();

  if (state.classId && auth.director && auth.director.token) {
    try {
      await request({
        method: 'DELETE',
        reqPath: `/classes/${state.classId}`,
        token: auth.director.token,
        expectedStatus: [200, 204],
      });
    } catch (err) {
      console.log(`Cleanup warning: could not delete temporary class ${state.classId}`);
    }
  }

  if (result.fail > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('\nFatal error running sessions workflow tests:');
  console.error(err);
  process.exit(1);
});
