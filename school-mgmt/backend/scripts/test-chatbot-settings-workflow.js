/* eslint-disable no-console */
'use strict';

const path = require('path');

try {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
} catch (_) {}

const API_BASE = process.env.TEST_API_BASE || `http://localhost:${process.env.PORT || 3000}`;
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'Demo1234567890';
const REQUEST_TIMEOUT_MS = 30_000;

const RUN_ID = Date.now();
const TOKEN_LABEL = `E2E Token ${RUN_ID}`;
const TOKEN_LABEL_UPDATED = `E2E Token Updated ${RUN_ID}`;
const FANPAGE_NAME = `E2E Fanpage ${RUN_ID}`;
const PAGE_ID = `page-chatbot-settings-${RUN_ID}`;
const VERIFY_TOKEN = `verify-${RUN_ID}`;
const AD_CAMPAIGN_ID = `fb-chatbot-settings-cid-${RUN_ID}`;
const FB_USER_ID = `fb-chatbot-settings-${RUN_ID}`;
const AD_ACCOUNT_NAME = `E2E Chatbot AdAccount ${RUN_ID}`;
const AD_GROUP_NAME = `E2E Chatbot AdGroup ${RUN_ID}`;
const CHALLENGE = `challenge-${RUN_ID}`;
const ASSISTANT_TYPES = ['PARENT_SUPPORT', 'INTERNAL_SUPPORT', 'TEACHER_SUPPORT', 'LEAD_CARE'];

let directorToken;
let opsToken;

let adAccountId;
let adGroupId;
let createdTokenId;
let createdFanpageId;
let createdProfileId = null;
let createdProfileType = null;
let createdConversationId;

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

async function fetchWithRetry(url, options = {}, { attempts = 3, delayMs = 250 } = {}) {
  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fetch(url, options);
    } catch (err) {
      lastError = err;
      if (attempt < attempts) {
        await sleep(delayMs * attempt);
      }
    }
  }
  throw lastError;
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

    const res = await fetchWithRetry(`${API_BASE}${reqPath}`, {
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
          `Response: ${parsed.text.slice(0, 600)}`,
      );
    }

    return { status: res.status, data: parsed.json, raw: parsed.text };
  } finally {
    clearTimeout(timer);
  }
}

async function login(email, password) {
  const res = await fetchWithRetry(`${API_BASE}/auth/login`, {
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function pollUntil(checkFn, { maxAttempts = 12, delayMs = 500 } = {}) {
  for (let i = 0; i < maxAttempts; i += 1) {
    const result = await checkFn();
    if (result != null && result !== false) return result;
    if (i < maxAttempts - 1) await sleep(delayMs);
  }
  return null;
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
    console.log('\n=== E2E Chatbot Settings Summary ===');
    console.log(`API Base : ${API_BASE}`);
    console.log(`Run ID   : ${RUN_ID}`);
    console.log(`PASS     : ${pass}`);
    console.log(`FAIL     : ${fail}`);
    if (fail > 0) {
      console.log('\nFailed tests:');
      this.results
        .filter((r) => r.status === 'FAIL')
        .forEach((r) => console.log(`  - ${r.name}: ${r.error}`));
    }
  }
}

async function createAdsInfra() {
  const accountRes = await request({
    method: 'POST',
    reqPath: '/ads/accounts',
    token: directorToken,
    body: {
      name: AD_ACCOUNT_NAME,
      platform: 'FACEBOOK',
      platformAccountId: `act_chatbot_${RUN_ID}`,
    },
    expectedStatus: [200, 201],
  });
  adAccountId = normalizeId(accountRes.data._id || accountRes.data.id);
  ensure(adAccountId, 'adAccountId must exist');

  const groupRes = await request({
    method: 'POST',
    reqPath: '/ads/groups',
    token: directorToken,
    body: {
      name: AD_GROUP_NAME,
      adAccountId,
      platform: 'FACEBOOK',
      platformCampaignId: AD_CAMPAIGN_ID,
    },
    expectedStatus: [200, 201],
  });
  adGroupId = normalizeId(groupRes.data._id || groupRes.data.id);
  ensure(adGroupId, 'adGroupId must exist');
}

async function postWebhook(text) {
  const payload = {
    object: 'page',
    entry: [{
      id: PAGE_ID,
      messaging: [{
        sender: { id: FB_USER_ID },
        recipient: { id: PAGE_ID },
        timestamp: Date.now(),
        message: {
          mid: `mid-${RUN_ID}-${Date.now()}`,
          text,
        },
        referral: {
          ref: AD_CAMPAIGN_ID,
        },
      }],
    }],
  };

  const res = await fetchWithRetry(`${API_BASE}/webhooks/facebook/${PAGE_ID}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  ensure(res.status === 200, `Webhook must return 200, got ${res.status}`);
  await res.text();
}

async function findConversationByUser() {
  const res = await request({
    reqPath: `/chatbot/conversations${qs({ fanpageId: createdFanpageId })}`,
    token: directorToken,
    expectedStatus: [200],
  });
  const rows = Array.isArray(res.data?.data) ? res.data.data : [];
  return rows.find((item) => item.platformUserId === FB_USER_ID) || null;
}

async function cleanupCreatedEntities() {
  if (createdFanpageId) {
    await request({
      method: 'DELETE',
      reqPath: `/chatbot/fanpages/${createdFanpageId}`,
      token: directorToken,
      expectedStatus: [200],
    });
    createdFanpageId = null;
  }

  if (createdProfileId) {
    await request({
      method: 'DELETE',
      reqPath: `/chatbot/ai-assistant-profiles/${createdProfileId}`,
      token: directorToken,
      expectedStatus: [200],
    });
    createdProfileId = null;
  }

  if (createdTokenId) {
    await request({
      method: 'DELETE',
      reqPath: `/chatbot/openai-tokens/${createdTokenId}`,
      token: directorToken,
      expectedStatus: [200],
    });
    createdTokenId = null;
  }
}

async function main() {
  console.log('=== E2E Chatbot Settings Workflow ===');
  console.log(`API Base : ${API_BASE}`);
  console.log(`Run ID   : ${RUN_ID}`);
  console.log('');

  const runner = new TestRunner();

  await runner.test('AUTH | Login as director', async () => {
    const auth = await login('director.demo@school.local', DEMO_PASSWORD);
    directorToken = auth.token;
    ensure(directorToken, 'directorToken must exist');
  });

  await runner.test('AUTH | Login as ops', async () => {
    const auth = await login('ops.demo@school.local', DEMO_PASSWORD);
    opsToken = auth.token;
    ensure(opsToken, 'opsToken must exist');
  });

  await runner.test('SETUP | Create ad account and ad group for fanpage attribution', async () => {
    await createAdsInfra();
    console.log(`      adAccountId : ${adAccountId}`);
    console.log(`      adGroupId   : ${adGroupId}`);
  });

  await runner.test('STEP 1 | Director creates OpenAI token and ops sees masked token in library', async () => {
    const createRes = await request({
      method: 'POST',
      reqPath: '/chatbot/openai-tokens',
      token: directorToken,
      body: {
        label: TOKEN_LABEL,
        apiKey: `sk-e2e-${RUN_ID}`,
        model: 'gpt-4o-mini',
        temperature: 0.3,
        maxTokens: 700,
        systemPromptPrefix: 'E2E token for chatbot settings',
      },
      expectedStatus: [200, 201],
    });
    createdTokenId = normalizeId(createRes.data._id);
    ensure(createdTokenId, 'created token id must exist');
    ensure(createRes.data.apiKey !== `sk-e2e-${RUN_ID}`, 'create token response must mask apiKey');

    const listRes = await request({
      reqPath: '/chatbot/openai-tokens',
      token: opsToken,
      expectedStatus: [200],
    });
    const token = (Array.isArray(listRes.data) ? listRes.data : []).find((item) => normalizeId(item._id) === createdTokenId);
    ensure(token, 'ops must see created token in list');
    ensure(String(token.apiKey || '').startsWith('****'), 'token apiKey must be masked in ops list');
  });

  await runner.test('STEP 2 | Ops cannot create, update, or delete token library entries', async () => {
    await request({
      method: 'POST',
      reqPath: '/chatbot/openai-tokens',
      token: opsToken,
      body: { label: `Forbidden ${RUN_ID}`, apiKey: 'sk-forbidden' },
      expectedStatus: [403],
    });
    await request({
      method: 'PATCH',
      reqPath: `/chatbot/openai-tokens/${createdTokenId}`,
      token: opsToken,
      body: { label: 'Ops must not update token' },
      expectedStatus: [403],
    });
    await request({
      method: 'DELETE',
      reqPath: `/chatbot/openai-tokens/${createdTokenId}`,
      token: opsToken,
      expectedStatus: [403],
    });
  });

  await runner.test('STEP 3 | Director creates AI profile and ops sees token linkage', async () => {
    const existingProfilesRes = await request({
      reqPath: '/chatbot/ai-assistant-profiles',
      token: directorToken,
      expectedStatus: [200],
    });
    const existingProfiles = Array.isArray(existingProfilesRes.data) ? existingProfilesRes.data : [];
    createdProfileType = ASSISTANT_TYPES.find((type) => !existingProfiles.some((item) => item.assistantType === type)) || null;
    ensure(createdProfileType, 'need at least one free assistant type to create test profile');

    const createRes = await request({
      method: 'POST',
      reqPath: '/chatbot/ai-assistant-profiles',
      token: directorToken,
      body: {
        assistantType: createdProfileType,
        label: `E2E Profile ${RUN_ID}`,
        description: 'Profile created by e2e',
        rulesPrompt: 'Always answer briefly.',
        defaultOpenAITokenId: createdTokenId,
        status: 'ACTIVE',
      },
      expectedStatus: [200, 201],
    });
    createdProfileId = normalizeId(createRes.data._id);
    ensure(createdProfileId, 'created AI profile id must exist');

    const opsListRes = await request({
      reqPath: '/chatbot/ai-assistant-profiles',
      token: opsToken,
      expectedStatus: [200],
    });
    const profile = (Array.isArray(opsListRes.data) ? opsListRes.data : []).find((item) => normalizeId(item._id) === createdProfileId);
    ensure(profile, 'ops must see created AI profile');
    ensure(profile.defaultOpenAITokenId === createdTokenId, 'AI profile must reference created token');
    ensure(profile.defaultOpenAITokenLabel === TOKEN_LABEL, 'AI profile must populate token label');
    ensure(profile.defaultOpenAIModel === 'gpt-4o-mini', 'AI profile must populate token model');
  });

  await runner.test('STEP 4 | Ops cannot create, update, or delete AI profiles', async () => {
    await request({
      method: 'POST',
      reqPath: '/chatbot/ai-assistant-profiles',
      token: opsToken,
      body: {
        assistantType: 'LEAD_CARE',
        label: `Forbidden Profile ${RUN_ID}`,
      },
      expectedStatus: [403],
    });
    await request({
      method: 'PATCH',
      reqPath: `/chatbot/ai-assistant-profiles/${createdProfileId}`,
      token: opsToken,
      body: { label: 'Ops must not update AI profile' },
      expectedStatus: [403],
    });
    await request({
      method: 'DELETE',
      reqPath: `/chatbot/ai-assistant-profiles/${createdProfileId}`,
      token: opsToken,
      expectedStatus: [403],
    });
  });

  await runner.test('STEP 5 | Director creates fanpage and ops can search/detail it', async () => {
    const createRes = await request({
      method: 'POST',
      reqPath: '/chatbot/fanpages',
      token: directorToken,
      body: {
        name: FANPAGE_NAME,
        platform: 'FACEBOOK',
        pageId: PAGE_ID,
        description: 'Fanpage cho e2e chatbot settings',
        adAccountId,
        openaiTokenId: createdTokenId,
        webhookVerifyToken: VERIFY_TOKEN,
        aiAutoReplyEnabled: false,
      },
      expectedStatus: [200, 201],
    });
    createdFanpageId = normalizeId(createRes.data._id);
    ensure(createdFanpageId, 'created fanpage id must exist');

    const listRes = await request({
      reqPath: `/chatbot/fanpages${qs({ search: FANPAGE_NAME, platform: 'FACEBOOK', status: 'ACTIVE' })}`,
      token: opsToken,
      expectedStatus: [200],
    });
    const fanpage = (Array.isArray(listRes.data?.data) ? listRes.data.data : []).find((item) => normalizeId(item._id) === createdFanpageId);
    ensure(fanpage, 'ops must find created fanpage via list/search');
    ensure(fanpage.openaiTokenId === createdTokenId, 'fanpage must reference created token');
    ensure(fanpage.openaiTokenLabel === TOKEN_LABEL, 'fanpage list must populate token label');
    ensure(fanpage.adAccountId === adAccountId, 'fanpage must link ad account');

    const detailRes = await request({
      reqPath: `/chatbot/fanpages/${createdFanpageId}`,
      token: opsToken,
      expectedStatus: [200],
    });
    ensure(normalizeId(detailRes.data._id) === createdFanpageId, 'fanpage detail must return created fanpage');
    ensure(detailRes.data.pageAccessToken === undefined, 'fanpage detail without token should not invent pageAccessToken');
  });

  await runner.test('STEP 6 | Ops can update fanpage, but cannot create or delete it', async () => {
    await request({
      method: 'POST',
      reqPath: '/chatbot/fanpages',
      token: opsToken,
      body: {
        name: `Forbidden Fanpage ${RUN_ID}`,
        platform: 'FACEBOOK',
        pageId: `forbidden-page-${RUN_ID}`,
      },
      expectedStatus: [403],
    });

    const patchRes = await request({
      method: 'PATCH',
      reqPath: `/chatbot/fanpages/${createdFanpageId}`,
      token: opsToken,
      body: {
        description: 'Ops updated description',
        aiAutoReplyEnabled: true,
        status: 'INACTIVE',
      },
      expectedStatus: [200],
    });
    ensure(patchRes.data.description === 'Ops updated description', 'ops update must persist description');
    ensure(patchRes.data.aiAutoReplyEnabled === true, 'ops update must persist aiAutoReplyEnabled');
    ensure(patchRes.data.status === 'INACTIVE', 'ops update must persist status');

    await request({
      method: 'DELETE',
      reqPath: `/chatbot/fanpages/${createdFanpageId}`,
      token: opsToken,
      expectedStatus: [403],
    });
  });

  await runner.test('STEP 7 | Token updates propagate to AI profile and fanpage metadata', async () => {
    await request({
      method: 'PATCH',
      reqPath: `/chatbot/openai-tokens/${createdTokenId}`,
      token: directorToken,
      body: {
        label: TOKEN_LABEL_UPDATED,
        model: 'gpt-4.1-mini',
        temperature: 0.5,
      },
      expectedStatus: [200],
    });

    const fanpageListRes = await request({
      reqPath: `/chatbot/fanpages${qs({ search: FANPAGE_NAME })}`,
      token: directorToken,
      expectedStatus: [200],
    });
    const fanpage = (Array.isArray(fanpageListRes.data?.data) ? fanpageListRes.data.data : []).find((item) => normalizeId(item._id) === createdFanpageId);
    ensure(fanpage, 'fanpage must still exist after token update');
    ensure(fanpage.openaiTokenLabel === TOKEN_LABEL_UPDATED, 'fanpage must reflect updated token label');
    ensure(fanpage.openaiModel === 'gpt-4.1-mini', 'fanpage must reflect updated token model');

    const profileListRes = await request({
      reqPath: '/chatbot/ai-assistant-profiles',
      token: directorToken,
      expectedStatus: [200],
    });
    const profile = (Array.isArray(profileListRes.data) ? profileListRes.data : []).find((item) => normalizeId(item._id) === createdProfileId);
    ensure(profile, 'AI profile must still exist after token update');
    ensure(profile.defaultOpenAITokenLabel === TOKEN_LABEL_UPDATED, 'AI profile must reflect updated token label');
    ensure(profile.defaultOpenAIModel === 'gpt-4.1-mini', 'AI profile must reflect updated token model');
  });

  await runner.test('STEP 8 | Facebook verify webhook and fanpage attribution propagate into conversation', async () => {
    await request({
      method: 'PATCH',
      reqPath: `/chatbot/fanpages/${createdFanpageId}`,
      token: directorToken,
      body: {
        status: 'ACTIVE',
        aiAutoReplyEnabled: false,
      },
      expectedStatus: [200],
    });

    const verifyRes = await fetchWithRetry(
      `${API_BASE}/webhooks/facebook/${PAGE_ID}?hub.mode=subscribe&hub.verify_token=${VERIFY_TOKEN}&hub.challenge=${CHALLENGE}`,
    );
    ensure(verifyRes.status === 200, `verify webhook must return 200, got ${verifyRes.status}`);
    ensure((await verifyRes.text()) === CHALLENGE, 'verify webhook must return challenge');

    await postWebhook('Toi can tu van qua fanpage chatbot settings');

    const conversation = await pollUntil(() => findConversationByUser());
    ensure(conversation, 'conversation from webhook must be created');
    createdConversationId = normalizeId(conversation._id);
    ensure(normalizeId(conversation.fanpageId) === createdFanpageId, 'conversation must link created fanpage');
    ensure(normalizeId(conversation.adGroupId) === adGroupId, 'conversation must inherit adGroup from fanpage ad account');
    ensure(conversation.adGroupName === AD_GROUP_NAME, 'conversation must inherit adGroupName');
  });

  await runner.test('STEP 9 | Director can delete chatbot settings records and lists no longer return them', async () => {
    await cleanupCreatedEntities();

    const [fanpageRes, tokenRes, profileRes] = await Promise.all([
      request({
        reqPath: `/chatbot/fanpages${qs({ search: FANPAGE_NAME })}`,
        token: directorToken,
        expectedStatus: [200],
      }),
      request({
        reqPath: '/chatbot/openai-tokens',
        token: directorToken,
        expectedStatus: [200],
      }),
      request({
        reqPath: '/chatbot/ai-assistant-profiles',
        token: directorToken,
        expectedStatus: [200],
      }),
    ]);

    ensure(
      !(Array.isArray(fanpageRes.data?.data) ? fanpageRes.data.data : []).some((item) => item.name === FANPAGE_NAME),
      'deleted fanpage must disappear from list',
    );
    ensure(
      !(Array.isArray(tokenRes.data) ? tokenRes.data : []).some((item) => item.label === TOKEN_LABEL_UPDATED),
      'deleted token must disappear from list',
    );
    ensure(
      !(Array.isArray(profileRes.data) ? profileRes.data : []).some((item) => normalizeId(item._id) === createdProfileId),
      'deleted AI profile must disappear from list',
    );
  });

  runner.summary();
  if (runner.results.some((r) => r.status === 'FAIL')) process.exit(1);
}

main()
  .catch(async (err) => {
    console.error('\nUnhandled error:', err.message);
    try {
      if (directorToken) await cleanupCreatedEntities();
    } catch (_) {}
    process.exit(1);
  });
