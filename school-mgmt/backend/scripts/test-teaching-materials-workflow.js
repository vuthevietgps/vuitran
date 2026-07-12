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

function randomCode(prefix) {
  const stamp = Date.now().toString().slice(-8);
  const rand = Math.floor(Math.random() * 9999)
    .toString()
    .padStart(4, '0');
  return `${prefix}${stamp}${rand}`.toUpperCase();
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
    const headers = {};
    if (token) headers.Cookie = token;
    if (!isSafeMethod(method)) {
      headers['Content-Type'] = 'application/json';
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

async function requestMultipart({
  reqPath,
  token,
  formData,
  expectedStatus = [200, 201],
  timeoutMs = REQUEST_TIMEOUT_MS,
}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const headers = {};
    if (token) headers.Cookie = token;
    const xsrf = extractXsrfFromCookieHeader(token);
    if (xsrf) headers['X-XSRF-TOKEN'] = xsrf;

    const res = await fetch(`${API_BASE}${reqPath}`, {
      method: 'POST',
      headers,
      body: formData,
      signal: controller.signal,
    });
    const parsed = await parseResponse(res);
    const ok = Array.isArray(expectedStatus)
      ? expectedStatus.includes(res.status)
      : res.status === expectedStatus;
    if (!ok) {
      throw new Error(
        `POST ${reqPath} expected ${JSON.stringify(expectedStatus)} but got ${res.status}. ` +
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
    console.log('\n=== Teaching Materials Workflow Summary ===');
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
  const auth = {};
  const state = {
    teacherId: null,
    classId: null,
    materialId: null,
    materialTitle: `Workflow material ${Date.now()}`,
    updatedTitle: `Workflow material updated ${Date.now()}`,
  };

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

  await runner.test('Prepare temporary class for teaching materials filters', async () => {
    const teacherMe = await request({
      method: 'GET',
      reqPath: '/users/me',
      token: auth.teacher.token,
      expectedStatus: [200],
    });
    state.teacherId = normalizeId(
      teacherMe.data && (teacherMe.data._id || teacherMe.data.id || teacherMe.data.user),
    );
    ensure(state.teacherId, 'Teacher demo id not found');

    const studentsRes = await request({
      method: 'GET',
      reqPath: '/students',
      token: auth.director.token,
      expectedStatus: [200],
    });
    const students = Array.isArray(studentsRes.data) ? studentsRes.data : [];
    let selectedStudentId = null;

    for (const student of students) {
      const sid = normalizeId(student && student._id);
      if (!sid) continue;
      const detail = await request({
        method: 'GET',
        reqPath: `/students/${sid}`,
        token: auth.director.token,
        expectedStatus: [200],
      });
      if (normalizeId(detail.data && detail.data.parentUserId)) {
        selectedStudentId = sid;
        break;
      }
    }

    ensure(selectedStudentId, 'Cannot find student with parentUserId for temp class');

    const created = await request({
      method: 'POST',
      reqPath: '/classes',
      token: auth.director.token,
      expectedStatus: [200, 201],
      body: {
        name: `MAT WF ${Date.now()}`,
        code: randomCode('MWF'),
        teacherId: state.teacherId,
        classMode: 'ONLINE',
        studentIds: [selectedStudentId],
        pricePerSession: 150000,
        teacherPayPerSession: 90000,
        teacherPayPerStudent: 0,
        baseDuration: 60,
        sessionDuration: 60,
      },
    });

    state.classId = normalizeId(created.data && created.data._id);
    ensure(state.classId, 'Temporary class id missing');
  });

  await runner.test('TEACHER cannot upload managed teaching material', async () => {
    const form = new FormData();
    form.append('file', new Blob(['Teacher upload must be blocked.'], { type: 'text/plain' }), 'blocked-note.txt');
    form.append('title', `${state.materialTitle} blocked`);
    form.append('materialScope', 'HOMEWORK');
    form.append('assignableAsHomework', 'true');

    await requestMultipart({
      reqPath: '/teaching-materials/upload',
      token: auth.teacher.token,
      formData: form,
      expectedStatus: [403],
    });
  });

  await runner.test('DIRECTOR uploads shared homework material for staff usage', async () => {
    const form = new FormData();
    form.append('file', new Blob(['Grammar note for workflow test.\nUnit 1: Present simple.'], { type: 'text/plain' }), 'workflow-note.txt');
    form.append('title', state.materialTitle);
    form.append('description', 'Shared director-managed homework material for e2e propagation');
    form.append('manualSummary', 'Shared summary for search and AI stats');
    form.append('subject', 'Tiếng Anh');
    form.append('grade', 'Lớp 5');
    form.append('classId', state.classId);
    form.append('materialScope', 'HOMEWORK');
    form.append('materialType', 'HOMEWORK_SET');
    form.append('assignableAsHomework', 'true');
    form.append('tags', JSON.stringify(['grammar', 'workflow']));
    form.append('isShared', 'true');

    const uploaded = await requestMultipart({
      reqPath: '/teaching-materials/upload',
      token: auth.director.token,
      formData: form,
      expectedStatus: [200, 201],
    });

    state.materialId = normalizeId(uploaded.data && uploaded.data._id);
    ensure(state.materialId, 'Uploaded material id missing');
    ensure(uploaded.data && uploaded.data.extractionStatus === 'READY', 'Text material should be READY for AI');
    ensure(Number(uploaded.data && uploaded.data.chunkCount) > 0, 'Uploaded text material should create chunks');
    ensure(uploaded.data && uploaded.data.isShared === true, 'Director material should be shared for staff usage');
    ensure(uploaded.data && uploaded.data.materialScope === 'HOMEWORK', 'Uploaded material should be homework scoped');
    ensure(uploaded.data && uploaded.data.assignableAsHomework === true, 'Uploaded material should be assignable as homework');
  });

  await runner.test('Teacher list, filters and stats include shared director material', async () => {
    const list = await request({
      method: 'GET',
      reqPath: `/teaching-materials${qs({
        search: state.materialTitle,
        subject: 'Tiếng Anh',
        grade: 'Lớp 5',
        classId: state.classId,
        materialScope: 'HOMEWORK',
        assignableAsHomework: 'true',
        extractionStatus: 'READY',
        fileCategory: 'other',
      })}`,
      token: auth.teacher.token,
      expectedStatus: [200],
    });
    const items = Array.isArray(list.data && list.data.data) ? list.data.data : [];
    ensure(items.some((item) => normalizeId(item._id) === state.materialId), 'Teacher filtered list should include shared director material');

    const stats = await request({
      method: 'GET',
      reqPath: '/teaching-materials/stats',
      token: auth.teacher.token,
      expectedStatus: [200],
    });
    ensure(Number(stats.data && stats.data.total) >= 1, 'Teacher stats should count shared material');
    ensure(Number(stats.data && stats.data.readyForAI) >= 1, 'Teacher stats should count ready material');
    ensure(Number(stats.data && stats.data.totalChunks) >= 1, 'Teacher stats should count generated chunks');
    ensure(
      Number((stats.data && stats.data.bySubject && stats.data.bySubject['Tiếng Anh']) || 0) >= 1,
      'Teacher stats should group by subject',
    );
  });

  await runner.test('Shared director material is visible but read-only for non-director roles', async () => {
    const directorList = await request({
      method: 'GET',
      reqPath: `/teaching-materials${qs({ search: state.materialTitle })}`,
      token: auth.director.token,
      expectedStatus: [200],
    });
    const directorItems = Array.isArray(directorList.data && directorList.data.data) ? directorList.data.data : [];
    ensure(directorItems.some((item) => normalizeId(item._id) === state.materialId), 'Director should see shared material');

    const parentList = await request({
      method: 'GET',
      reqPath: `/teaching-materials${qs({ search: state.materialTitle })}`,
      token: auth.parent.token,
      expectedStatus: [200],
    });
    const parentItems = Array.isArray(parentList.data && parentList.data.data) ? parentList.data.data : [];
    ensure(parentItems.some((item) => normalizeId(item._id) === state.materialId), 'Parent should see shared material');

    await request({
      method: 'PATCH',
      reqPath: `/teaching-materials/${state.materialId}`,
      token: auth.parent.token,
      expectedStatus: [403],
      body: { title: 'Parent cannot edit director material' },
    });
  });

  await runner.test('DIRECTOR updates shared material metadata', async () => {
    await request({
      method: 'PATCH',
      reqPath: `/teaching-materials/${state.materialId}`,
      token: auth.teacher.token,
      expectedStatus: [403],
      body: {
        title: 'Teacher cannot edit director material',
      },
    });

    const updated = await request({
      method: 'PATCH',
      reqPath: `/teaching-materials/${state.materialId}`,
      token: auth.director.token,
      expectedStatus: [200],
      body: {
        title: state.updatedTitle,
        manualSummary: 'Shared summary after update',
        isShared: true,
        tags: ['grammar', 'shared'],
      },
    });

    ensure(updated.data && updated.data.isShared === true, 'Updated material should become shared');
    ensure(updated.data && updated.data.title === state.updatedTitle, 'Updated title should persist');

    const parentList = await request({
      method: 'GET',
      reqPath: `/teaching-materials${qs({ search: state.updatedTitle })}`,
      token: auth.parent.token,
      expectedStatus: [200],
    });
    const parentItems = Array.isArray(parentList.data && parentList.data.data) ? parentList.data.data : [];
    ensure(parentItems.some((item) => normalizeId(item._id) === state.materialId), 'Parent should see shared material');

    const parentStats = await request({
      method: 'GET',
      reqPath: '/teaching-materials/stats',
      token: auth.parent.token,
      expectedStatus: [200],
    });
    ensure(Number(parentStats.data && parentStats.data.total) >= 1, 'Parent shared stats should count material');
  });

  await runner.test('Download count and director-only reprocess propagate correctly', async () => {
    const download = await request({
      method: 'POST',
      reqPath: `/teaching-materials/${state.materialId}/download`,
      token: auth.parent.token,
      expectedStatus: [200, 201],
      body: {},
    });
    ensure(Number(download.data && download.data.downloadCount) >= 1, 'Download count should increase');

    await request({
      method: 'POST',
      reqPath: `/teaching-materials/${state.materialId}/reprocess`,
      token: auth.teacher.token,
      expectedStatus: [403],
      body: {},
    });

    const reprocessed = await request({
      method: 'POST',
      reqPath: `/teaching-materials/${state.materialId}/reprocess`,
      token: auth.director.token,
      expectedStatus: [200, 201],
      body: {},
    });
    ensure(reprocessed.data && reprocessed.data.extractionStatus === 'READY', 'Reprocessed text material should remain READY');
    ensure(Number(reprocessed.data && reprocessed.data.chunkCount) > 0, 'Reprocessed text material should keep chunks');

    const detail = await request({
      method: 'GET',
      reqPath: `/teaching-materials/${state.materialId}`,
      token: auth.teacher.token,
      expectedStatus: [200],
    });
    ensure(Number(detail.data && detail.data.downloadCount) >= 1, 'Detail should reflect new download count');
  });

  await runner.test('DIRECTOR deletes material and it disappears from other roles', async () => {
    await request({
      method: 'DELETE',
      reqPath: `/teaching-materials/${state.materialId}`,
      token: auth.director.token,
      expectedStatus: [200, 204],
      body: {},
    });

    const teacherList = await request({
      method: 'GET',
      reqPath: `/teaching-materials${qs({ search: state.updatedTitle })}`,
      token: auth.teacher.token,
      expectedStatus: [200],
    });
    const teacherItems = Array.isArray(teacherList.data && teacherList.data.data) ? teacherList.data.data : [];
    ensure(!teacherItems.some((item) => normalizeId(item._id) === state.materialId), 'Teacher list should no longer contain deleted material');

    const parentList = await request({
      method: 'GET',
      reqPath: `/teaching-materials${qs({ search: state.updatedTitle })}`,
      token: auth.parent.token,
      expectedStatus: [200],
    });
    const parentItems = Array.isArray(parentList.data && parentList.data.data) ? parentList.data.data : [];
    ensure(!parentItems.some((item) => normalizeId(item._id) === state.materialId), 'Parent list should no longer contain deleted material');

    await request({
      method: 'GET',
      reqPath: `/teaching-materials/${state.materialId}`,
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
        body: {},
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
  console.error('\nFatal error running teaching materials workflow tests:');
  console.error(err);
  process.exit(1);
});
