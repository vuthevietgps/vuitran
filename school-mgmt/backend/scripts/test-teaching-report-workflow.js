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
    console.log('\n=== Teaching Report Workflow Summary ===');
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

function extractSessionList(res) {
  if (Array.isArray(res.data && res.data.data)) return res.data.data;
  if (Array.isArray(res.data)) return res.data;
  return [];
}

function findSessionById(items, sessionId) {
  return (items || []).find((item) => normalizeId(item && item._id) === sessionId) || null;
}

function currentMonthRange() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    fromDate: `${year}-${String(month).padStart(2, '0')}-01`,
    toDate: `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
    reportDate: `${year}-${String(month).padStart(2, '0')}-${String(Math.max(lastDay - 1, 1)).padStart(2, '0')}`,
  };
}

async function createSessionAvoidingConflicts({ token, classId, studentId, teacherId, parentUserId, scheduledDate }) {
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
      return await request({
        method: 'POST',
        reqPath: '/sessions',
        token,
        expectedStatus: [200, 201],
        body: {
          classId,
          studentId,
          teacherId,
          parentUserId,
          scheduledDate,
          scheduledStartTime,
          scheduledEndTime,
          durationMinutes: 60,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      lastError = message;
      if (!message.includes('got 409')) {
        throw err;
      }
    }
  }

  throw new Error(`Cannot create non-conflicting workflow session. Last error: ${lastError}`);
}

async function main() {
  const runner = new TestRunner();
  console.log(`Testing teaching-report workflow against ${API_BASE}`);

  const auth = {};
  const state = {
    teacherId: null,
    parentId: null,
    studentId: null,
    parentUserId: null,
    classId: null,
    sessionId: null,
    templateId: null,
    previewCounts: {
      beforeReport: null,
      afterReport: null,
      afterParentConfirm: null,
    },
  };
  const { fromDate, toDate, reportDate } = currentMonthRange();

  await runner.test('Login director, teacher and parent demo accounts', async () => {
    const accounts = {
      director: 'director.demo@school.local',
      teacher: 'teacher.demo@school.local',
      parent: 'parent.demo@school.local',
    };
    for (const [role, email] of Object.entries(accounts)) {
      auth[role] = await loginWithRetry(email, DEMO_PASSWORD, 4);
    }
  });

  await runner.test('Resolve ids for teacher and parent demo', async () => {
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

    state.teacherId = normalizeId(
      teacherMe.data && (teacherMe.data._id || teacherMe.data.id || teacherMe.data.user),
    );
    state.parentId = normalizeId(
      parentMe.data && (parentMe.data._id || parentMe.data.id || parentMe.data.user),
    );

    ensure(state.teacherId, 'Teacher demo id not found');
    ensure(state.parentId, 'Parent demo id not found');
  });

  await runner.test('Director can load teacher options for the teaching-report filter', async () => {
    const res = await request({
      method: 'GET',
      reqPath: '/users/teachers',
      token: auth.director.token,
      expectedStatus: [200],
    });
    const teachers = Array.isArray(res.data) ? res.data : [];
    ensure(
      teachers.some((teacher) => normalizeId(teacher && teacher._id) === state.teacherId),
      'Teacher demo must appear in /users/teachers',
    );
  });

  await runner.test('Prepare one student of parent.demo and create a temporary class', async () => {
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
      if (parentUserId === state.parentId) {
        state.studentId = sid;
        state.parentUserId = parentUserId;
        break;
      }
    }

    ensure(state.studentId, 'Cannot find a student that belongs to parent.demo');

    await topUpWallet(
      auth.director.token,
      state.parentUserId,
      2_000_000,
      'Top up wallet for teaching-report workflow',
    );

    const created = await request({
      method: 'POST',
      reqPath: '/classes',
      token: auth.director.token,
      expectedStatus: [200, 201],
      body: {
        name: `TR WF ${Date.now()}`,
        code: randomCode('TRW'),
        teacherId: state.teacherId,
        classMode: 'ONLINE',
        studentIds: [state.studentId],
        pricePerSession: 180_000,
        teacherPayPerSession: 120_000,
        teacherPayPerStudent: 0,
        baseDuration: 60,
        sessionDuration: 60,
      },
    });

    state.classId = normalizeId(created.data && created.data._id);
    ensure(state.classId, 'Temporary teaching-report class was not created');
  });

  await runner.test('Teacher can create and list a private report template', async () => {
    const created = await request({
      method: 'POST',
      reqPath: '/report-templates',
      token: auth.teacher.token,
      expectedStatus: [200, 201],
      body: {
        title: `Template workflow ${Date.now()}`,
        templateContent:
          'Mau bao cao teaching-report workflow voi noi dung du dai de co the ap dung vao form.',
        classId: state.classId,
      },
    });
    state.templateId = normalizeId(created.data && created.data._id);
    ensure(state.templateId, 'Teacher template id not returned');

    const list = await request({
      method: 'GET',
      reqPath: '/report-templates',
      token: auth.teacher.token,
      expectedStatus: [200],
    });
    const templates = Array.isArray(list.data) ? list.data : [];
    const template = templates.find((item) => normalizeId(item && item._id) === state.templateId);
    ensure(template, 'Created template not returned in teacher list');
    ensure(template.isGlobal !== true, 'Workflow template must be private');
  });

  await runner.test('Director creates one scheduled session for the teacher-report flow', async () => {
    const created = await createSessionAvoidingConflicts({
      token: auth.director.token,
      classId: state.classId,
      studentId: state.studentId,
      teacherId: state.teacherId,
      parentUserId: state.parentUserId,
      scheduledDate: reportDate,
    });
    state.sessionId = normalizeId(created.data && created.data._id);
    ensure(state.sessionId, 'Workflow session id missing');
    ensure(created.data && created.data.status === 'SCHEDULED', 'Session must start as SCHEDULED');
  });

  await runner.test('Teacher completes the session so it appears in pending reports', async () => {
    const completed = await request({
      method: 'POST',
      reqPath: `/sessions/${state.sessionId}/complete`,
      token: auth.teacher.token,
      expectedStatus: [200, 201],
      body: {
        topicsCovered: 'Grammar review and speaking practice',
        homework: 'Workbook page 14',
        teacherNotes: 'Student joined on time',
      },
    });
    ensure(
      completed.data && completed.data.status === 'TEACHER_COMPLETED',
      'Completed session must become TEACHER_COMPLETED',
    );
  });

  await runner.test('Pending report list and payroll preview reflect missing-report state', async () => {
    const pendingRes = await request({
      method: 'GET',
      reqPath: `/sessions${qs({
        hasReport: 'false',
        teacherId: state.teacherId,
        fromDate,
        toDate,
        limit: 50,
      })}`,
      token: auth.teacher.token,
      expectedStatus: [200],
    });
    const pending = extractSessionList(pendingRes);
    const session = findSessionById(pending, state.sessionId);
    ensure(session, 'Session must appear in pending teaching-report list before submit');

    const previewRes = await request({
      method: 'GET',
      reqPath: `/payroll/teacher-preview${qs({
        teacherId: state.teacherId,
        periodStart: fromDate,
        periodEnd: toDate,
      })}`,
      token: auth.teacher.token,
      expectedStatus: [200],
    });
    const summary = previewRes.data && previewRes.data.summary;
    const sessions = Array.isArray(previewRes.data && previewRes.data.sessions)
      ? previewRes.data.sessions
      : [];
    const previewSession = findSessionById(sessions, state.sessionId);
    ensure(summary, 'Teacher preview summary missing before report');
    ensure(Number(summary.totalAttended) >= 1, 'Preview must count the completed session as attended');
    ensure(Number(summary.missingReport) >= 1, 'Preview must show missingReport before submit');
    ensure(Number(summary.pendingParentConfirm) >= 1, 'Preview must show pendingParentConfirm before submit');
    ensure(previewSession && previewSession.hasTeachingReport === false, 'Preview session row must show missing report');
    ensure(previewSession && previewSession.payrollStatus === 'WAITING_PARENT', 'Preview row must wait for parent before report');
    state.previewCounts.beforeReport = {
      missingReport: Number(summary.missingReport),
      pendingParentConfirm: Number(summary.pendingParentConfirm),
      pendingFinalize: Number(summary.pendingFinalize),
      eligibleForPayroll: Number(summary.eligibleForPayroll),
    };
  });

  await runner.test('Director pending list filtered by teacher shows the same session', async () => {
    const pendingRes = await request({
      method: 'GET',
      reqPath: `/sessions${qs({
        hasReport: 'false',
        teacherId: state.teacherId,
        fromDate,
        toDate,
        limit: 50,
      })}`,
      token: auth.director.token,
      expectedStatus: [200],
    });
    const pending = extractSessionList(pendingRes);
    ensure(findSessionById(pending, state.sessionId), 'Director filter must see pending report session');
  });

  await runner.test('Teacher submits the teaching report and session moves to completed list', async () => {
    const submitted = await request({
      method: 'PATCH',
      reqPath: `/sessions/${state.sessionId}/teaching-report`,
      token: auth.teacher.token,
      expectedStatus: [200],
      body: {
        lessonContent:
          'Teaching-report workflow lesson content with enough detail for validation and payroll eligibility.',
        studentAttitude: 'Hop tac tot va hoan thanh bai tap tren lop.',
        teacherComment: 'Can tiep tuc luyen noi theo chu de da hoc.',
        homework: 'Hoan thanh phan nghe trong workbook va viet 5 cau vi du.',
      },
    });
    ensure(submitted.data && submitted.data.hasTeachingReport === true, 'Report must be stored on session');

    const pendingRes = await request({
      method: 'GET',
      reqPath: `/sessions${qs({
        hasReport: 'false',
        teacherId: state.teacherId,
        fromDate,
        toDate,
        limit: 50,
      })}`,
      token: auth.teacher.token,
      expectedStatus: [200],
    });
    const completedRes = await request({
      method: 'GET',
      reqPath: `/sessions${qs({
        hasReport: 'true',
        teacherId: state.teacherId,
        fromDate,
        toDate,
        limit: 50,
      })}`,
      token: auth.teacher.token,
      expectedStatus: [200],
    });

    ensure(
      !findSessionById(extractSessionList(pendingRes), state.sessionId),
      'Session must leave pending list after report submit',
    );
    ensure(
      findSessionById(extractSessionList(completedRes), state.sessionId),
      'Session must appear in completed list after report submit',
    );
  });

  await runner.test('Payroll preview reflects reported-but-not-confirmed state', async () => {
    const previewRes = await request({
      method: 'GET',
      reqPath: `/payroll/teacher-preview${qs({
        teacherId: state.teacherId,
        periodStart: fromDate,
        periodEnd: toDate,
      })}`,
      token: auth.teacher.token,
      expectedStatus: [200],
    });
    const summary = previewRes.data && previewRes.data.summary;
    const sessions = Array.isArray(previewRes.data && previewRes.data.sessions)
      ? previewRes.data.sessions
      : [];
    const session = findSessionById(sessions, state.sessionId);
    const previous = state.previewCounts.beforeReport;

    ensure(summary, 'Teacher preview summary missing after report');
    ensure(previous, 'Missing baseline preview counts before report');
    ensure(
      Number(summary.missingReport) === previous.missingReport - 1,
      `missingReport must decrease by 1 after report submit (before=${previous.missingReport}, after=${summary.missingReport})`,
    );
    ensure(
      Number(summary.pendingParentConfirm) === previous.pendingParentConfirm,
      'pendingParentConfirm total should stay unchanged after report submit',
    );
    ensure(
      Number(summary.eligibleForPayroll) === previous.eligibleForPayroll,
      'eligibleForPayroll total should stay unchanged before parent confirm',
    );
    ensure(session && session.hasTeachingReport === true, 'Preview session row must show hasTeachingReport=true');
    ensure(session && session.payrollStatus === 'WAITING_PARENT', 'Preview row must wait for parent');
    state.previewCounts.afterReport = {
      missingReport: Number(summary.missingReport),
      pendingParentConfirm: Number(summary.pendingParentConfirm),
      pendingFinalize: Number(summary.pendingFinalize),
      eligibleForPayroll: Number(summary.eligibleForPayroll),
    };
  });

  await runner.test('Teacher can update the existing report from completed tab', async () => {
    const updated = await request({
      method: 'PATCH',
      reqPath: `/sessions/${state.sessionId}/teaching-report`,
      token: auth.teacher.token,
      expectedStatus: [200],
      body: {
        lessonContent:
          'Teaching-report workflow updated lesson content to verify completed-tab editing remains available.',
        studentAttitude: 'Da chu dong hon sau khi duoc nhac nho.',
        teacherComment: 'Can on lai tu vung truoc buoi hoc tiep theo.',
        homework: 'Lam them 10 cau luyen ngu phap.',
      },
    });

    const version = Number(
      updated.data &&
        updated.data.teachingReport &&
        updated.data.teachingReport.version,
    );
    ensure(version >= 2, `Updated report version must increment, got ${version}`);
    ensure(
      updated.data &&
        updated.data.teachingReport &&
        String(updated.data.teachingReport.lessonContent || '').includes('updated lesson content'),
      'Updated lessonContent must persist',
    );
  });

  await runner.test('Director completed list filtered by teacher shows the reported session', async () => {
    const completedRes = await request({
      method: 'GET',
      reqPath: `/sessions${qs({
        hasReport: 'true',
        teacherId: state.teacherId,
        fromDate,
        toDate,
        limit: 50,
      })}`,
      token: auth.director.token,
      expectedStatus: [200],
    });
    ensure(
      findSessionById(extractSessionList(completedRes), state.sessionId),
      'Director filter must see completed report session',
    );
  });

  await runner.test('Parent confirms the session and preview moves to pending-finalize state', async () => {
    const confirmed = await request({
      method: 'POST',
      reqPath: `/sessions/${state.sessionId}/confirm`,
      token: auth.parent.token,
      expectedStatus: [200, 201],
      body: {
        overallRating: 5,
        parentRating: 5,
        teachingQualityRating: 5,
        communicationRating: 5,
        isSatisfied: true,
        parentNotes: 'Parent confirmed after reviewing teaching report.',
      },
    });
    ensure(confirmed.data && confirmed.data.status === 'FINALIZED', 'Parent confirm must finalize session');

    const previewRes = await request({
      method: 'GET',
      reqPath: `/payroll/teacher-preview${qs({
        teacherId: state.teacherId,
        periodStart: fromDate,
        periodEnd: toDate,
      })}`,
      token: auth.teacher.token,
      expectedStatus: [200],
    });
    const summary = previewRes.data && previewRes.data.summary;
    const sessions = Array.isArray(previewRes.data && previewRes.data.sessions)
      ? previewRes.data.sessions
      : [];
    const session = findSessionById(sessions, state.sessionId);
    const previous = state.previewCounts.afterReport;

    ensure(summary, 'Teacher preview summary missing after parent confirm');
    ensure(previous, 'Missing preview counts after report');
    ensure(
      Number(summary.pendingParentConfirm) === previous.pendingParentConfirm - 1,
      'pendingParentConfirm must decrease by 1 after parent confirm',
    );
    ensure(
      Number(summary.pendingFinalize) === previous.pendingFinalize + 1,
      'pendingFinalize must increase by 1 after parent confirm',
    );
    ensure(
      Number(summary.eligibleForPayroll) === previous.eligibleForPayroll,
      'eligibleForPayroll total must stay unchanged before director finalize',
    );
    ensure(session && session.status === 'FINALIZED', 'Preview row must show FINALIZED after parent confirm');
    ensure(session && session.payrollStatus === 'WAITING_FINALIZE', 'Preview row must show WAITING_FINALIZE after parent confirm');
    state.previewCounts.afterParentConfirm = {
      missingReport: Number(summary.missingReport),
      pendingParentConfirm: Number(summary.pendingParentConfirm),
      pendingFinalize: Number(summary.pendingFinalize),
      eligibleForPayroll: Number(summary.eligibleForPayroll),
    };
  });

  await runner.test('Director finalize stamp makes the session payroll-eligible', async () => {
    const finalized = await request({
      method: 'POST',
      reqPath: `/sessions/${state.sessionId}/finalize`,
      token: auth.director.token,
      expectedStatus: [200, 201],
    });

    ensure(finalized.data && finalized.data.status === 'FINALIZED', 'Session must remain FINALIZED after director stamp');
    ensure(
      finalized.data && finalized.data.confirmation && finalized.data.confirmation.finalizedBy,
      'Director finalize must set confirmation.finalizedBy',
    );

    const previewRes = await request({
      method: 'GET',
      reqPath: `/payroll/teacher-preview${qs({
        teacherId: state.teacherId,
        periodStart: fromDate,
        periodEnd: toDate,
      })}`,
      token: auth.teacher.token,
      expectedStatus: [200],
    });
    const summary = previewRes.data && previewRes.data.summary;
    const sessions = Array.isArray(previewRes.data && previewRes.data.sessions)
      ? previewRes.data.sessions
      : [];
    const session = findSessionById(sessions, state.sessionId);
    const previous = state.previewCounts.afterParentConfirm;

    ensure(summary, 'Teacher preview summary missing after director finalize');
    ensure(previous, 'Missing preview counts after parent confirm');
    ensure(
      Number(summary.pendingFinalize) === previous.pendingFinalize - 1,
      'pendingFinalize must decrease by 1 after director finalize',
    );
    ensure(
      Number(summary.eligibleForPayroll) === previous.eligibleForPayroll + 1,
      'eligibleForPayroll must increase by 1 after director finalize',
    );
    ensure(session && session.payrollStatus === 'ELIGIBLE', 'Preview row must show ELIGIBLE after director stamp');
  });

  await runner.test('Teacher can delete the private template after finishing the flow', async () => {
    await request({
      method: 'DELETE',
      reqPath: `/report-templates/${state.templateId}`,
      token: auth.teacher.token,
      expectedStatus: [200, 204],
    });

    const list = await request({
      method: 'GET',
      reqPath: '/report-templates',
      token: auth.teacher.token,
      expectedStatus: [200],
    });
    const templates = Array.isArray(list.data) ? list.data : [];
    ensure(
      !templates.some((item) => normalizeId(item && item._id) === state.templateId),
      'Deleted private template must disappear from teacher list',
    );
  });

  const summary = runner.summary();
  if (summary.fail > 0) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('Fatal error in teaching-report workflow test');
  console.error(err);
  process.exitCode = 1;
});
