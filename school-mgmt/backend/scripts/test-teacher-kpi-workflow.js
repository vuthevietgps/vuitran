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

function currentMonthWindow() {
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

async function createSessionAvoidingConflicts({
  token,
  classId,
  studentId,
  teacherId,
  parentUserId,
  scheduledDate,
}) {
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
          amountCharged: 180000,
          teacherPayout: 120000,
          lessonObjective: 'Teacher KPI workflow validation session',
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

function extractKpiPayload(res) {
  return res.data || {};
}

function findTeacherRow(payload, teacherUserId) {
  const teachers = Array.isArray(payload.teachers) ? payload.teachers : [];
  return teachers.find((item) => normalizeId(item && item.userId) === teacherUserId) || null;
}

function countActiveTeacherRows(payload) {
  return Array.isArray(payload.teachers) ? payload.teachers.length : 0;
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
    console.log('\n=== Teacher KPI Workflow Summary ===');
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
  console.log(`Testing teacher-kpi workflow against ${API_BASE}`);

  const auth = {};
  const state = {
    teacherId: null,
    parentId: null,
    parentUserId: null,
    studentId: null,
    classId: null,
    sessionId: null,
    payrollId: null,
    bankAccountId: null,
    baseline: null,
    afterCreate: null,
    afterReport: null,
    afterFinalize: null,
    afterPayroll: null,
    amountCharged: 180000,
    teacherPayout: 120000,
  };
  const { fromDate, toDate, reportDate } = currentMonthWindow();

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
    state.parentUserId = state.parentId;

    ensure(state.teacherId, 'Teacher demo id not found');
    ensure(state.parentId, 'Parent demo id not found');
  });

  await runner.test('Director-only RBAC blocks teacher from teacher-kpi endpoint', async () => {
    await request({
      method: 'GET',
      reqPath: `/dashboard/director/teacher-kpi${qs({ fromDate, toDate })}`,
      token: auth.teacher.token,
      expectedStatus: [403],
    });
  });

  await runner.test('Director can load teacher-kpi and the teacher appears in the board', async () => {
    const res = await request({
      method: 'GET',
      reqPath: `/dashboard/director/teacher-kpi${qs({ fromDate, toDate })}`,
      token: auth.director.token,
      expectedStatus: [200],
    });
    const payload = extractKpiPayload(res);
    const teacherRow = findTeacherRow(payload, state.teacherId);

    ensure(payload.summary, 'Teacher KPI summary missing');
    ensure(Array.isArray(payload.teachers), 'Teacher KPI teacher list missing');
    ensure(teacherRow, 'Teacher demo must appear in teacher KPI board');

    state.baseline = {
      totalTeachers: Number(payload.summary.totalTeachers || 0),
      activeTeachers: Number(payload.summary.activeTeachers || 0),
      avgKPI: Number(payload.summary.avgKPI || 0),
      avgRating: Number(payload.summary.avgRating || 0),
      kpiScore: Number(teacherRow.kpiScore || 0),
      sessionsTotal: Number(teacherRow.sessions && teacherRow.sessions.total || 0),
      sessionsCompleted: Number(teacherRow.sessions && teacherRow.sessions.completed || 0),
      sessionsRevenue: Number(teacherRow.sessions && teacherRow.sessions.totalRevenue || 0),
      sessionsPayout: Number(teacherRow.sessions && teacherRow.sessions.totalPayout || 0),
      reportsSubmitted: Number(teacherRow.reports && teacherRow.reports.submitted || 0),
      parentFeedbackCount: Number(teacherRow.parentFeedback && teacherRow.parentFeedback.feedbackCount || 0),
      activeClasses: Number(teacherRow.classes && teacherRow.classes.activeClasses || 0),
      payrollPaid: Number(teacherRow.payroll && teacherRow.payroll.totalPaid || 0),
      teacherStatus: teacherRow.teacherStatus,
    };
  });

  await runner.test('Prepare one parent child, create a temporary class and a scheduled session', async () => {
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

    await request({
      method: 'POST',
      reqPath: '/wallets/adjust',
      token: auth.director.token,
      expectedStatus: [200, 201],
      body: {
        userId: state.parentUserId,
        amount: 2_000_000,
        direction: 'ADD',
        description: 'Top up wallet for teacher KPI workflow',
      },
    });

    const classCreated = await request({
      method: 'POST',
      reqPath: '/classes',
      token: auth.director.token,
      expectedStatus: [200, 201],
      body: {
        name: `Teacher KPI WF ${Date.now()}`,
        code: randomCode('TKPI'),
        teacherId: state.teacherId,
        classMode: 'ONLINE',
        studentIds: [state.studentId],
        subject: 'Tiếng Anh',
        grade: 'Lớp 8',
        learningGoals: 'Cải thiện phản xạ giao tiếp và ngữ pháp cơ bản',
        pricePerSession: state.amountCharged,
        teacherPayPerSession: state.teacherPayout,
        teacherPayPerStudent: 0,
        baseDuration: 60,
        sessionDuration: 60,
        maxStudents: 1,
      },
    });
    state.classId = normalizeId(classCreated.data && classCreated.data._id);
    ensure(state.classId, 'Class id not returned');

    const sessionCreated = await createSessionAvoidingConflicts({
      token: auth.director.token,
      classId: state.classId,
      studentId: state.studentId,
      teacherId: state.teacherId,
      parentUserId: state.parentUserId,
      scheduledDate: reportDate,
    });
    state.sessionId = normalizeId(sessionCreated.data && sessionCreated.data._id);
    ensure(state.sessionId, 'Session id not returned');

    const afterCreateRes = await request({
      method: 'GET',
      reqPath: `/dashboard/director/teacher-kpi${qs({ fromDate, toDate })}`,
      token: auth.director.token,
      expectedStatus: [200],
    });
    const payload = extractKpiPayload(afterCreateRes);
    const teacherRow = findTeacherRow(payload, state.teacherId);
    ensure(teacherRow, 'Teacher KPI row missing after class/session creation');

    state.afterCreate = {
      sessionsTotal: Number(teacherRow.sessions && teacherRow.sessions.total || 0),
      sessionsCompleted: Number(teacherRow.sessions && teacherRow.sessions.completed || 0),
      sessionsRevenue: Number(teacherRow.sessions && teacherRow.sessions.totalRevenue || 0),
      sessionsPayout: Number(teacherRow.sessions && teacherRow.sessions.totalPayout || 0),
      activeClasses: Number(teacherRow.classes && teacherRow.classes.activeClasses || 0),
      reportsSubmitted: Number(teacherRow.reports && teacherRow.reports.submitted || 0),
      parentFeedbackCount: Number(teacherRow.parentFeedback && teacherRow.parentFeedback.feedbackCount || 0),
      kpiScore: Number(teacherRow.kpiScore || 0),
    };

    ensure(
      state.afterCreate.sessionsTotal === state.baseline.sessionsTotal + 1,
      `sessions.total must increase by 1 after session creation (before=${state.baseline.sessionsTotal}, after=${state.afterCreate.sessionsTotal})`,
    );
    ensure(
      state.afterCreate.activeClasses === state.baseline.activeClasses + 1,
      `activeClasses must increase by 1 after class creation (before=${state.baseline.activeClasses}, after=${state.afterCreate.activeClasses})`,
    );
    ensure(
      state.afterCreate.sessionsRevenue >= state.baseline.sessionsRevenue + state.amountCharged,
      'Teacher KPI revenue must reflect the newly created session',
    );
    ensure(
      state.afterCreate.sessionsPayout >= state.baseline.sessionsPayout + state.teacherPayout,
      'Teacher KPI payout must reflect the newly created session',
    );
  });

  await runner.test('Teacher completes the session and submits teaching report', async () => {
    const completed = await request({
      method: 'POST',
      reqPath: `/sessions/${state.sessionId}/complete`,
      token: auth.teacher.token,
      expectedStatus: [200, 201],
      body: {
        topicsCovered: 'Teacher KPI workflow topics covered',
        homework: 'Workbook exercises 1-5',
        teacherNotes: 'Student joined on time and participated actively.',
      },
    });
    ensure(completed.data && completed.data.status === 'TEACHER_COMPLETED', 'Session must move to TEACHER_COMPLETED');

    const submitted = await request({
      method: 'PATCH',
      reqPath: `/sessions/${state.sessionId}/teaching-report`,
      token: auth.teacher.token,
      expectedStatus: [200],
      body: {
        lessonContent: 'Teacher KPI workflow lesson content.',
        studentAttitude: 'Tich cuc va hop tac.',
        teacherComment: 'Can tiep tuc on lai phat am va tu vung.',
        homework: 'Luyen noi 5 cau ve chu de da hoc.',
      },
    });
    ensure(submitted.data && submitted.data.hasTeachingReport === true, 'Teaching report must be stored on session');

    const afterReportRes = await request({
      method: 'GET',
      reqPath: `/dashboard/director/teacher-kpi${qs({ fromDate, toDate })}`,
      token: auth.director.token,
      expectedStatus: [200],
    });
    const payload = extractKpiPayload(afterReportRes);
    const teacherRow = findTeacherRow(payload, state.teacherId);
    ensure(teacherRow, 'Teacher KPI row missing after report submit');

    state.afterReport = {
      sessionsCompleted: Number(teacherRow.sessions && teacherRow.sessions.completed || 0),
      reportsSubmitted: Number(teacherRow.reports && teacherRow.reports.submitted || 0),
      parentFeedbackCount: Number(teacherRow.parentFeedback && teacherRow.parentFeedback.feedbackCount || 0),
      kpiScore: Number(teacherRow.kpiScore || 0),
    };

    ensure(
      state.afterReport.reportsSubmitted === state.afterCreate.reportsSubmitted + 1,
      `reports.submitted must increase by 1 after report submit (before=${state.afterCreate.reportsSubmitted}, after=${state.afterReport.reportsSubmitted})`,
    );
    ensure(
      state.afterReport.sessionsCompleted === state.afterCreate.sessionsCompleted,
      'sessions.completed should not change until parent confirmation',
    );
    ensure(
      state.afterReport.kpiScore >= state.afterCreate.kpiScore,
      'KPI score should not decrease after adding a teaching report',
    );
  });

  await runner.test('Parent confirms the session and director finalizes it', async () => {
    const confirmed = await request({
      method: 'POST',
      reqPath: `/sessions/${state.sessionId}/confirm`,
      token: auth.parent.token,
      expectedStatus: [200, 201],
      body: {
        overallRating: 5,
        teachingQualityRating: 5,
        communicationRating: 5,
        isSatisfied: true,
        parentNotes: 'Teacher KPI workflow parent feedback.',
        concerns: 'Khong co',
      },
    });
    ensure(confirmed.data && confirmed.data.status === 'FINALIZED', 'Parent confirm must finalize session');

    const finalized = await request({
      method: 'POST',
      reqPath: `/sessions/${state.sessionId}/finalize`,
      token: auth.director.token,
      expectedStatus: [200, 201],
    });
    ensure(finalized.data && finalized.data.status === 'FINALIZED', 'Director finalize must keep session FINALIZED');

    const afterFinalizeRes = await request({
      method: 'GET',
      reqPath: `/dashboard/director/teacher-kpi${qs({ fromDate, toDate })}`,
      token: auth.director.token,
      expectedStatus: [200],
    });
    const payload = extractKpiPayload(afterFinalizeRes);
    const teacherRow = findTeacherRow(payload, state.teacherId);
    ensure(teacherRow, 'Teacher KPI row missing after finalize');

    state.afterFinalize = {
      sessionsTotal: Number(teacherRow.sessions && teacherRow.sessions.total || 0),
      sessionsCompleted: Number(teacherRow.sessions && teacherRow.sessions.completed || 0),
      reportsSubmitted: Number(teacherRow.reports && teacherRow.reports.submitted || 0),
      parentFeedbackCount: Number(teacherRow.parentFeedback && teacherRow.parentFeedback.feedbackCount || 0),
      avgOverallRating: Number(teacherRow.parentFeedback && teacherRow.parentFeedback.avgOverallRating || 0),
      kpiScore: Number(teacherRow.kpiScore || 0),
    };

    ensure(
      state.afterFinalize.sessionsCompleted === state.afterCreate.sessionsCompleted + 1,
      `sessions.completed must increase by 1 after finalization (before=${state.afterCreate.sessionsCompleted}, after=${state.afterFinalize.sessionsCompleted})`,
    );
    ensure(
      state.afterFinalize.parentFeedbackCount === state.afterReport.parentFeedbackCount + 1,
      `parentFeedback.feedbackCount must increase by 1 after parent confirm (before=${state.afterReport.parentFeedbackCount}, after=${state.afterFinalize.parentFeedbackCount})`,
    );
    ensure(
      state.afterFinalize.reportsSubmitted === state.afterReport.reportsSubmitted,
      'Report count should stay unchanged after finalization',
    );
    ensure(
      state.afterFinalize.avgOverallRating >= state.baseline.avgRating,
      'Average overall rating should not go down after a 5-star confirmation',
    );
    ensure(
      state.afterFinalize.kpiScore >= state.baseline.kpiScore,
      `KPI score should not fall below baseline (before=${state.baseline.kpiScore}, after=${state.afterFinalize.kpiScore})`,
    );
  });

  await runner.test('Teacher KPI board still returns the full teacher list summary', async () => {
    const res = await request({
      method: 'GET',
      reqPath: `/dashboard/director/teacher-kpi${qs({ fromDate, toDate })}`,
      token: auth.director.token,
      expectedStatus: [200],
    });
    const payload = extractKpiPayload(res);
    ensure(payload.summary, 'Teacher KPI summary missing at end of workflow');
    ensure(countActiveTeacherRows(payload) >= 1, 'Teacher KPI board must keep at least one teacher row');
    ensure(Number(payload.summary.totalTeachers || 0) >= 1, 'Teacher KPI summary should still include teachers');
  });

  const summary = runner.summary();
  if (summary.fail > 0) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('Fatal error in teacher-kpi workflow test');
  console.error(err);
  process.exitCode = 1;
});
