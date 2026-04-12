/* eslint-disable no-console */
const path = require('path');

try {
  // Load backend .env if available
  // eslint-disable-next-line global-require
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
} catch (_) {}

const API_BASE = process.env.TEST_API_BASE || `http://localhost:${process.env.PORT || 3000}`;
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'ChangeThisDemoPass2024!';
const REQUEST_TIMEOUT_MS = 30000;
const LOGIN_RETRY_WAIT_MS = 65000;

const VALID_TEST_IMAGE_BASE64 =
  'data:image/png;base64,' +
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO5r9a0AAAAASUVORK5CYII=';

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

async function request({
  method = 'GET',
  path: reqPath,
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
          `Response: ${parsed.text.slice(0, 400)}`,
      );
    }
    return { status: res.status, data: parsed.json, raw: parsed.text };
  } finally {
    clearTimeout(timer);
  }
}

async function loginWithRetry(email, password, maxRetries = 3) {
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
      cookie: buildCookieHeader({
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
      this.results.push({
        name,
        status: 'FAIL',
        ms,
        error: err instanceof Error ? err.message : String(err),
      });
      console.log(`FAIL | ${name} (${ms}ms)`);
      console.log(`      ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  skip(name, reason) {
    this.results.push({ name, status: 'SKIP', ms: 0, reason });
    console.log(`SKIP | ${name} (${reason})`);
  }

  summary() {
    const pass = this.results.filter((r) => r.status === 'PASS').length;
    const fail = this.results.filter((r) => r.status === 'FAIL').length;
    const skip = this.results.filter((r) => r.status === 'SKIP').length;
    console.log('\n=== Attendance Workflow Test Summary ===');
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
}

async function main() {
  const runner = new TestRunner();

  const auth = {};
  const accountEmails = {
    director: 'director.demo@school.local',
    ops: 'ops.demo@school.local',
    teacher: 'teacher.demo@school.local',
    parent: 'parent.demo@school.local',
    sale: 'sale.huong@school.local',
  };

  console.log(`Testing against ${API_BASE}`);
  console.log('Logging in test accounts...');

  for (const [role, email] of Object.entries(accountEmails)) {
    const loginData = await loginWithRetry(email, DEMO_PASSWORD, 4);
    auth[role] = {
      token: loginData.cookie,
      user: loginData.user,
      email,
    };
    console.log(`- ${role.toUpperCase()} logged in (${email})`);
  }

  const now = new Date();
  const randomOffset = 300 + Math.floor(Math.random() * 120);
  const testDate1 = formatDateYYYYMMDD(addDays(now, randomOffset));
  const testDate2 = formatDateYYYYMMDD(addDays(now, randomOffset + 1));
  const testDate3 = formatDateYYYYMMDD(addDays(now, randomOffset + 2));

  let chosenClass = null;
  let chosenStudent = null;
  let attendanceId = null;
  let sessionId = null;
  let finalizeAttendanceId = null;
  let finalizeSessionId = null;
  let attendanceToken = null;
  let parentUserId = null;
  let walletBeforeFinalize = null;
  let deductCountBefore = 0;
  let createdClassId = null;

  const submitTeachingReport = async (targetSessionId, label) => {
    const report = await request({
      method: 'PATCH',
      path: `/sessions/${targetSessionId}/teaching-report`,
      token: auth.teacher.token,
      body: {
        lessonContent: `Attendance workflow teaching report for ${label}, đủ chi tiết để hợp lệ.`,
        teacherComment: `automation teacher comment ${label}`,
      },
      expectedStatus: [200],
    });
    ensure(
      report.data && report.data.hasTeachingReport === true,
      `Session ${targetSessionId} should have teaching report after submit`,
    );
  };

  const ensureTemporaryTeacherClass = async () => {
    const teacherId =
      normalizeId(auth.teacher.user && (auth.teacher.user._id || auth.teacher.user.id)) ||
      normalizeId(
        (
          await request({
            method: 'GET',
            path: '/users/me',
            token: auth.teacher.token,
            expectedStatus: [200],
          })
        ).data,
      );
    ensure(teacherId, 'Teacher demo id not found');

    const studentsRes = await request({
      method: 'GET',
      path: '/students',
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
        path: `/students/${sid}`,
        token: auth.director.token,
        expectedStatus: [200],
      });
      const parentId = normalizeId(detail.data && detail.data.parentUserId);
      if (!parentId) continue;
      selectedStudent = {
        studentId: sid,
        parentUserId: parentId,
        fullName: detail.data && detail.data.fullName,
      };
      break;
    }
    ensure(selectedStudent, 'Cannot find student with parentUserId for attendance workflow');

    const created = await request({
      method: 'POST',
      path: '/classes',
      token: auth.director.token,
      expectedStatus: [200, 201],
      body: {
        name: `ATT WF ${Date.now()}`,
        code: randomCode('ATW'),
        teacherId,
        classMode: 'ONLINE',
        studentIds: [selectedStudent.studentId],
        pricePerSession: 150000,
        teacherPayPerSession: 90000,
        teacherPayPerStudent: 0,
        baseDuration: 60,
        sessionDuration: 60,
      },
    });

    createdClassId = normalizeId(created.data && created.data._id);
    ensure(createdClassId, 'Temporary attendance workflow class was not created');
    chosenStudent = selectedStudent;
  };

  await runner.test('DIRECTOR can list classes with students', async () => {
    const res = await request({
      method: 'GET',
      path: '/attendance/classes-with-students',
      token: auth.director.token,
      expectedStatus: [200],
    });
    ensure(Array.isArray(res.data), 'Expected classes-with-students to return array');
  });

  await runner.test('DIRECTOR prepares teacher-owned class with student for attendance workflow', async () => {
    await ensureTemporaryTeacherClass();
  });

  await runner.test('OPS can list classes with students', async () => {
    const res = await request({
      method: 'GET',
      path: '/attendance/classes-with-students',
      token: auth.ops.token,
      expectedStatus: [200],
    });
    ensure(Array.isArray(res.data), 'OPS classes-with-students should return array');
  });

  await runner.test('SALE is forbidden from attendance module', async () => {
    await request({
      method: 'GET',
      path: '/attendance/classes-with-students',
      token: auth.sale.token,
      expectedStatus: [403],
    });
  });

  await runner.test('PARENT is forbidden from attendance report', async () => {
    await request({
      method: 'GET',
      path: `/attendance/report${qs({
        startDate: testDate1,
        endDate: testDate2,
      })}`,
      token: auth.parent.token,
      expectedStatus: [403],
    });
  });

  await runner.test('TEACHER can list own classes', async () => {
    const res = await request({
      method: 'GET',
      path: '/attendance/classes-with-students',
      token: auth.teacher.token,
      expectedStatus: [200],
    });
    ensure(Array.isArray(res.data), 'Teacher classes-with-students should return array');
    chosenClass = res.data.find((c) => normalizeId(c.classId) === createdClassId);
    ensure(chosenClass, 'Temporary teacher-owned class not visible in teacher attendance list');
    const listedStudent = (chosenClass.students || []).find(
      (s) => normalizeId(s.studentId) === chosenStudent.studentId,
    );
    ensure(listedStudent, 'Chosen student not found in temporary teacher class');
  });

  {
    const directorClasses = await request({
      method: 'GET',
      path: '/attendance/classes-with-students',
      token: auth.director.token,
      expectedStatus: [200],
    });
    const teacherClasses = await request({
      method: 'GET',
      path: '/attendance/classes-with-students',
      token: auth.teacher.token,
      expectedStatus: [200],
    });
    const teacherClassIds = new Set((teacherClasses.data || []).map((c) => c.classId));
    const outsider = (directorClasses.data || []).find(
      (c) => !teacherClassIds.has(c.classId) && Array.isArray(c.students) && c.students.length > 0,
    );
    if (!outsider) {
      runner.skip('TEACHER forbidden on unassigned class', 'No outsider class available');
    } else {
      await runner.test('TEACHER forbidden on unassigned class', async () => {
        await request({
          method: 'GET',
          path: `/attendance/class/${outsider.classId}${qs({ date: testDate1 })}`,
          token: auth.teacher.token,
          expectedStatus: [403],
        });
      });
    }
  }

  await runner.test('DIRECTOR marks attendance PRESENT', async () => {
    const res = await request({
      method: 'POST',
      path: '/attendance/mark',
      token: auth.director.token,
      body: {
        classId: chosenClass.classId,
        studentId: chosenStudent.studentId,
        date: testDate1,
        status: 'PRESENT',
        notes: 'automation test mark present',
      },
      expectedStatus: [200, 201],
    });
    ensure(res.data, 'mark attendance response is empty');
    ensure(res.data.status === 'PRESENT', `Expected status PRESENT, got ${res.data.status}`);
    attendanceId = normalizeId(res.data._id);
    sessionId = normalizeId(res.data.sessionId);
    ensure(attendanceId, 'Attendance ID not returned');
    ensure(sessionId, 'Session ID should be created for PRESENT');
  });

  await runner.test('DIRECTOR updates attendance to ABSENT (cancel session link)', async () => {
    const res = await request({
      method: 'PATCH',
      path: `/attendance/${attendanceId}`,
      token: auth.director.token,
      body: { status: 'ABSENT', notes: 'automation test absent' },
      expectedStatus: [200],
    });
    ensure(res.data.status === 'ABSENT', `Expected ABSENT, got ${res.data.status}`);
    ensure(!res.data.sessionId, 'Session link should be removed when ABSENT');
  });

  await runner.test('DIRECTOR updates attendance back to PRESENT (recreate session link)', async () => {
    const res = await request({
      method: 'PATCH',
      path: `/attendance/${attendanceId}`,
      token: auth.director.token,
      body: { status: 'PRESENT', notes: 'automation test present again' },
      expectedStatus: [200],
    });
    ensure(res.data.status === 'PRESENT', `Expected PRESENT, got ${res.data.status}`);
    sessionId = normalizeId(res.data.sessionId);
    ensure(sessionId, 'Session link should exist after PRESENT');
  });

  await runner.test('DIRECTOR marks separate attendance PRESENT for finalize flow', async () => {
    const res = await request({
      method: 'POST',
      path: '/attendance/mark',
      token: auth.director.token,
      body: {
        classId: chosenClass.classId,
        studentId: chosenStudent.studentId,
        date: testDate3,
        status: 'PRESENT',
        notes: 'automation finalize flow',
      },
      expectedStatus: [200, 201],
    });
    finalizeAttendanceId = normalizeId(res.data && res.data._id);
    finalizeSessionId = normalizeId(res.data && res.data.sessionId);
    ensure(finalizeAttendanceId, 'Finalize-flow attendance ID missing');
    ensure(finalizeSessionId, 'Finalize-flow session ID missing');
  });

  await runner.test('DIRECTOR reads attendance by class/date', async () => {
    const res = await request({
      method: 'GET',
      path: `/attendance/class/${chosenClass.classId}${qs({ date: testDate1 })}`,
      token: auth.director.token,
      expectedStatus: [200],
    });
    ensure(Array.isArray(res.data.attendanceList), 'attendanceList should be array');
    const found = res.data.attendanceList.find(
      (i) => normalizeId(i.student && i.student._id) === chosenStudent.studentId,
    );
    ensure(found, 'Chosen student not found in attendance list');
    ensure(found.attendance && found.attendance.status === 'PRESENT', 'Expected PRESENT in class view');
  });

  await runner.test('DIRECTOR generates self-attendance link', async () => {
    const res = await request({
      method: 'POST',
      path: '/attendance/generate-link',
      token: auth.director.token,
      body: {
        classId: chosenClass.classId,
        studentId: chosenStudent.studentId,
        date: testDate2,
      },
      expectedStatus: [200, 201],
    });
    ensure(res.data && res.data.token, 'Token not returned');
    ensure(res.data.attendanceUrl, 'attendanceUrl not returned');
    attendanceToken = res.data.token;
  });

  await runner.test('Public token endpoint returns attendance info', async () => {
    const res = await request({
      method: 'GET',
      path: `/public/attendance/token/${attendanceToken}`,
      expectedStatus: [200],
    });
    ensure(res.data && normalizeId(res.data.studentId && res.data.studentId._id), 'Invalid token payload');
  });

  await runner.test('Public submit with invalid image is rejected', async () => {
    await request({
      method: 'POST',
      path: '/public/attendance/submit',
      token: auth.director.token,
      body: {
        token: attendanceToken,
        imageBase64: 'data:image/png;base64,invalid_data',
      },
      expectedStatus: [400],
    });
  });

  await runner.test('Public submit with valid image marks PRESENT', async () => {
    const res = await request({
      method: 'POST',
      path: '/public/attendance/submit',
      token: auth.director.token,
      body: {
        token: attendanceToken,
        imageBase64: VALID_TEST_IMAGE_BASE64,
      },
      expectedStatus: [200, 201],
    });
    ensure(res.data.status === 'PRESENT', `Expected PRESENT after submit, got ${res.data.status}`);
    ensure(res.data.attendedAt, 'attendedAt should be set');
    ensure(res.data.imageUrl, 'imageUrl should be set');
  });

  await runner.test('Public token cannot be reused after successful submit', async () => {
    await request({
      method: 'GET',
      path: `/public/attendance/token/${attendanceToken}`,
      expectedStatus: [400],
    });
  });

  await runner.test('PARENT can access children attendance endpoints', async () => {
    const h1 = await request({
      method: 'GET',
      path: '/attendance/my-children',
      token: auth.parent.token,
      expectedStatus: [200],
    });
    const h2 = await request({
      method: 'GET',
      path: '/attendance/my-children/stats',
      token: auth.parent.token,
      expectedStatus: [200],
    });
    ensure(h1.data && Array.isArray(h1.data.children), 'my-children should return children array');
    ensure(h2.data && Array.isArray(h2.data.children), 'my-children/stats should return children array');
  });

  await runner.test('DIRECTOR attendance report includes test record', async () => {
    const res = await request({
      method: 'GET',
      path: `/attendance/report${qs({
        startDate: testDate1,
        endDate: testDate2,
        classId: chosenClass.classId,
      })}`,
      token: auth.director.token,
      expectedStatus: [200],
    });
    const reportItems = Array.isArray(res.data?.data) ? res.data.data : [];
    ensure(Array.isArray(reportItems), 'Report payload must contain data array');
    const hit = reportItems.find(
      (r) =>
        normalizeId(r.classId && r.classId._id) === chosenClass.classId &&
        normalizeId(r.studentId && r.studentId._id) === chosenStudent.studentId,
    );
    ensure(hit, 'Expected attendance record not found in report');
  });

  await runner.test('Prepare wallet and capture pre-finalize state', async () => {
    const studentRes = await request({
      method: 'GET',
      path: `/students/${chosenStudent.studentId}`,
      token: auth.director.token,
      expectedStatus: [200],
    });
    parentUserId = normalizeId(studentRes.data && studentRes.data.parentUserId);
    ensure(parentUserId, 'Student has no parentUserId; cannot test wallet deduction');

    await request({
      method: 'POST',
      path: '/wallets/adjust',
      token: auth.director.token,
      body: {
        userId: parentUserId,
        amount: 500000,
        direction: 'ADD',
        description: 'automation test top-up before finalize',
      },
      expectedStatus: [200, 201],
    });

    const walletRes = await request({
      method: 'GET',
      path: `/wallets/user/${parentUserId}`,
      token: auth.director.token,
      expectedStatus: [200],
    });
    walletBeforeFinalize = walletRes.data.balance;

    const ledgerBefore = await request({
      method: 'GET',
      path: `/wallets/ledger${qs({
        userId: parentUserId,
        type: 'SESSION_DEDUCT',
        limit: 100,
      })}`,
      token: auth.director.token,
      expectedStatus: [200],
    });
    deductCountBefore = (ledgerBefore.data && ledgerBefore.data.meta && ledgerBefore.data.meta.total) || 0;
  });

  await runner.test('TEACHER submits teaching report for attendance-created finalize session', async () => {
    await submitTeachingReport(finalizeSessionId, 'attendance-finalize-flow');
  });

  await runner.test('DIRECTOR manually finalizes session created by attendance', async () => {
    const res = await request({
      method: 'POST',
      path: `/sessions/${finalizeSessionId}/finalize`,
      token: auth.director.token,
      expectedStatus: [200, 201],
    });
    ensure(res.data.status === 'FINALIZED', `Expected FINALIZED, got ${res.data.status}`);
  });

  await runner.test('Session is FINALIZED and attendance is locked from edits', async () => {
    const s = await request({
      method: 'GET',
      path: `/sessions/${finalizeSessionId}`,
      token: auth.director.token,
      expectedStatus: [200],
    });
    ensure(s.data.status === 'FINALIZED', `Expected FINALIZED session status, got ${s.data.status}`);

    await request({
      method: 'PATCH',
      path: `/attendance/${finalizeAttendanceId}`,
      token: auth.director.token,
      body: { status: 'ABSENT', notes: 'should fail after finalized' },
      expectedStatus: [400],
    });
  });

  await runner.test('Wallet ledger records one SESSION_DEDUCT after finalize', async () => {
    ensure(parentUserId, 'No parentUserId available for wallet test');
    const ledgerAfter = await request({
      method: 'GET',
      path: `/wallets/ledger${qs({
        userId: parentUserId,
        type: 'SESSION_DEDUCT',
        limit: 100,
      })}`,
      token: auth.director.token,
      expectedStatus: [200],
    });
    const totalAfter = (ledgerAfter.data && ledgerAfter.data.meta && ledgerAfter.data.meta.total) || 0;
    ensure(
      totalAfter >= deductCountBefore + 1,
      `Expected SESSION_DEDUCT count to increase (before=${deductCountBefore}, after=${totalAfter})`,
    );

    const sessionDeductEntry = (ledgerAfter.data.data || []).find(
      (e) => normalizeId(e.sessionId && e.sessionId._id) === finalizeSessionId,
    );
    ensure(
      sessionDeductEntry,
      `No SESSION_DEDUCT ledger entry found for session ${finalizeSessionId}`,
    );

    const walletAfter = await request({
      method: 'GET',
      path: `/wallets/user/${parentUserId}`,
      token: auth.director.token,
      expectedStatus: [200],
    });
    ensure(
      typeof walletAfter.data.balance === 'number',
      'Wallet response should include numeric balance',
    );
    ensure(
      walletAfter.data.balance <= walletBeforeFinalize,
      `Expected balance to be deducted or equal after finalize (before=${walletBeforeFinalize}, after=${walletAfter.data.balance})`,
    );
  });

  const result = runner.summary();
  if (createdClassId && auth.director && auth.director.token) {
    try {
      await request({
        method: 'DELETE',
        path: `/classes/${createdClassId}`,
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
  console.error('\nFatal error running attendance workflow tests:');
  console.error(err);
  process.exit(1);
});
