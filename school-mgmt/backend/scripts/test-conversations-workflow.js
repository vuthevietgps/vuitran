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
const AD_CAMPAIGN_ID = `fb-conv-cid-${RUN_ID}`;
const FANPAGE_PAGE_ID = `page-conv-${RUN_ID}`;
const AD_SPEND = 450_000;

const FB_USER_MESSAGE = `fb-conv-msg-${RUN_ID}`;
const FB_USER_LEAD = `fb-conv-lead-${RUN_ID}`;
const FB_USER_ORDER = `fb-conv-order-${RUN_ID}`;

let directorToken;
let opsToken;
let saleToken;
let saleMe;

let adAccountId;
let adGroupId;
let fanpageId;

let messageConvId;
let messageConvCode;
let leadConvId;
let orderConvId;
let messageConvInitialCount = 0;
let createdLeadId;
let createdOrderId;

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
          `Response: ${parsed.text.slice(0, 600)}`,
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function pollUntil(checkFn, { maxAttempts = 12, delayMs = 1000 } = {}) {
  for (let i = 0; i < maxAttempts; i++) {
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
    console.log('\n=== E2E Conversations Summary ===');
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

async function createAdInfra() {
  const accountRes = await request({
    method: 'POST',
    reqPath: '/ads/accounts',
    token: directorToken,
    body: {
      name: `Conversation AdAccount ${RUN_ID}`,
      platform: 'FACEBOOK',
      platformAccountId: `act_conv_${RUN_ID}`,
    },
    expectedStatus: [200, 201],
  });
  adAccountId = normalizeId(accountRes.data._id || accountRes.data.id);
  ensure(adAccountId, 'adAccountId must be created');

  const groupRes = await request({
    method: 'POST',
    reqPath: '/ads/groups',
    token: directorToken,
    body: {
      name: `Conversation AdGroup ${RUN_ID}`,
      adAccountId,
      platform: 'FACEBOOK',
      platformCampaignId: AD_CAMPAIGN_ID,
    },
    expectedStatus: [200, 201],
  });
  adGroupId = normalizeId(groupRes.data._id || groupRes.data.id);
  ensure(adGroupId, 'adGroupId must be created');

  const fanpageRes = await request({
    method: 'POST',
    reqPath: '/chatbot/fanpages',
    token: directorToken,
    body: {
      name: `Conversation Fanpage ${RUN_ID}`,
      platform: 'FACEBOOK',
      pageId: FANPAGE_PAGE_ID,
      adAccountId,
    },
    expectedStatus: [200, 201],
  });
  fanpageId = normalizeId(fanpageRes.data._id || fanpageRes.data.id);
  ensure(fanpageId, 'fanpageId must be created');
}

async function postWebhook(platformUserId, text) {
  const payload = {
    object: 'page',
    entry: [{
      id: FANPAGE_PAGE_ID,
      messaging: [{
        sender: { id: platformUserId },
        recipient: { id: FANPAGE_PAGE_ID },
        timestamp: Date.now(),
        message: { mid: `mid_${platformUserId}_${Date.now()}`, text },
        referral: {
          ref: AD_CAMPAIGN_ID,
          ad_id: AD_CAMPAIGN_ID,
          source: 'ADS',
          type: 'OPEN_THREAD',
        },
      }],
    }],
  };

  const res = await fetch(`${API_BASE}/webhooks/facebook/${FANPAGE_PAGE_ID}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  ensure(res.status === 200, `Webhook must return 200, got ${res.status}`);
  await res.text();
}

async function findConversationByPlatformUserId(platformUserId) {
  const result = await request({
    reqPath: `/chatbot/conversations${qs({ fanpageId, platform: 'FACEBOOK' })}`,
    token: directorToken,
    expectedStatus: [200],
  });
  const list = Array.isArray(result.data?.data) ? result.data.data : [];
  return list.find((conv) => conv.platformUserId === platformUserId) || null;
}

async function main() {
  console.log('=== E2E Conversations Workflow ===');
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

  await runner.test('AUTH | Login as sale', async () => {
    const auth = await login('sale.huong@school.local', DEMO_PASSWORD);
    saleToken = auth.token;
    saleMe = auth.user || null;
    ensure(saleToken, 'saleToken must exist');
  });

  await runner.test('SETUP | Create ad account, ad group, and fanpage for webhook conversations', async () => {
    await createAdInfra();
    console.log(`      adAccountId : ${adAccountId}`);
    console.log(`      adGroupId   : ${adGroupId}`);
    console.log(`      fanpageId   : ${fanpageId}`);
  });

  await runner.test('STEP 1 | Webhook creates three conversations with ad attribution', async () => {
    await postWebhook(FB_USER_MESSAGE, 'Toi muon tu van khoa hoc');
    await postWebhook(FB_USER_LEAD, 'Toi can hoc cho con');
    await postWebhook(FB_USER_ORDER, 'Cho toi tao don nhap');

    const [messageConv, leadConv, orderConv] = await Promise.all([
      pollUntil(() => findConversationByPlatformUserId(FB_USER_MESSAGE)),
      pollUntil(() => findConversationByPlatformUserId(FB_USER_LEAD)),
      pollUntil(() => findConversationByPlatformUserId(FB_USER_ORDER)),
    ]);

    ensure(messageConv, 'message conversation must exist');
    ensure(leadConv, 'lead conversation must exist');
    ensure(orderConv, 'order conversation must exist');

    messageConvId = normalizeId(messageConv._id);
    messageConvCode = messageConv.conversationCode;
    leadConvId = normalizeId(leadConv._id);
    orderConvId = normalizeId(orderConv._id);
    messageConvInitialCount = Number(messageConv.messageCount || 0);

    ensure(normalizeId(messageConv.adGroupId) === adGroupId, 'message conversation must inherit adGroupId');
    ensure(normalizeId(leadConv.adGroupId) === adGroupId, 'lead conversation must inherit adGroupId');
    ensure(normalizeId(orderConv.adGroupId) === adGroupId, 'order conversation must inherit adGroupId');
  });

  await runner.test('STEP 2 | Conversation list, search, and detail endpoints return the new conversation', async () => {
    const listRes = await request({
      reqPath: `/chatbot/conversations${qs({
        fanpageId,
        status: 'AI_HANDLING',
        search: messageConvCode,
      })}`,
      token: saleToken,
      expectedStatus: [200],
    });
    const items = Array.isArray(listRes.data?.data) ? listRes.data.data : [];
    const row = items.find((conv) => normalizeId(conv._id) === messageConvId);
    ensure(row, `conversation ${messageConvId} must appear in filtered list`);

    const detailRes = await request({
      reqPath: `/chatbot/conversations/${messageConvId}`,
      token: saleToken,
      expectedStatus: [200],
    });
    ensure(normalizeId(detailRes.data._id) === messageConvId, 'detail endpoint must return the selected conversation');
    ensure(detailRes.data.status === 'AI_HANDLING', `initial status must be AI_HANDLING, got "${detailRes.data.status}"`);
  });

  await runner.test('STEP 3 | Updating customer info persists on conversation detail', async () => {
    await request({
      method: 'PATCH',
      reqPath: `/chatbot/conversations/${messageConvId}`,
      token: saleToken,
      body: {
        customerName: 'Phu huynh hoi thoai E2E',
        customerPhone: '0904555666',
        customerEmail: 'conv-e2e@example.com',
        notes: 'Khach muon hoc online',
      },
      expectedStatus: [200],
    });

    const detailRes = await request({
      reqPath: `/chatbot/conversations/${messageConvId}`,
      token: saleToken,
      expectedStatus: [200],
    });
    ensure(detailRes.data.customerName === 'Phu huynh hoi thoai E2E', 'customerName must be updated');
    ensure(detailRes.data.customerPhone === '0904555666', 'customerPhone must be updated');
    ensure(detailRes.data.customerEmail === 'conv-e2e@example.com', 'customerEmail must be updated');
    ensure(detailRes.data.notes === 'Khach muon hoc online', 'notes must be updated');
  });

  await runner.test('STEP 4 | Takeover changes status to HUMAN_HANDLING and assigns the sale user', async () => {
    const res = await request({
      method: 'POST',
      reqPath: `/chatbot/conversations/${messageConvId}/takeover`,
      token: saleToken,
      body: {},
      expectedStatus: [200, 201],
    });
    ensure(res.data.status === 'HUMAN_HANDLING', `status must be HUMAN_HANDLING, got "${res.data.status}"`);
    ensure(normalizeId(res.data.assignedAgentId) === normalizeId(saleMe?.sub || saleMe?._id), 'assignedAgentId must be sale user');
  });

  await runner.test('STEP 5 | Human reply creates a message and increments conversation counters', async () => {
    await request({
      method: 'POST',
      reqPath: `/chatbot/conversations/${messageConvId}/messages`,
      token: saleToken,
      body: { content: 'Em da tiep nhan va se tu van ngay.' },
      expectedStatus: [200, 201],
    });

    const messagesRes = await request({
      reqPath: `/chatbot/conversations/${messageConvId}/messages${qs({ page: 1, limit: 50 })}`,
      token: saleToken,
      expectedStatus: [200],
    });
    const messages = Array.isArray(messagesRes.data?.data) ? messagesRes.data.data : [];
    const reply = messages.find((msg) => msg.content === 'Em da tiep nhan va se tu van ngay.');
    ensure(reply, 'human reply must be saved in message list');
    ensure(reply.senderType === 'HUMAN_AGENT', `senderType must be HUMAN_AGENT, got "${reply.senderType}"`);

    const detailRes = await request({
      reqPath: `/chatbot/conversations/${messageConvId}`,
      token: saleToken,
      expectedStatus: [200],
    });
    ensure(Number(detailRes.data.messageCount || 0) >= messageConvInitialCount + 1, 'messageCount must increase after human reply');
  });

  await runner.test('STEP 6 | Releasing and closing a conversation updates its status', async () => {
    const releaseRes = await request({
      method: 'POST',
      reqPath: `/chatbot/conversations/${messageConvId}/release`,
      token: saleToken,
      body: {},
      expectedStatus: [200, 201],
    });
    ensure(releaseRes.data.status === 'AI_HANDLING', `status after release must be AI_HANDLING, got "${releaseRes.data.status}"`);

    const closeRes = await request({
      method: 'PATCH',
      reqPath: `/chatbot/conversations/${messageConvId}`,
      token: saleToken,
      body: { status: 'CLOSED' },
      expectedStatus: [200],
    });
    ensure(closeRes.data.status === 'CLOSED', `status after close must be CLOSED, got "${closeRes.data.status}"`);
  });

  await runner.test('STEP 7 | OPS must choose a sale before creating a lead from an unassigned conversation', async () => {
    const res = await request({
      method: 'POST',
      reqPath: `/chatbot/conversations/${leadConvId}/create-lead`,
      token: opsToken,
      body: {
        parentName: 'Parent Conversation Lead',
        parentPhone: '0904777888',
      },
      expectedStatus: [400],
    });
    ensure(String(res.data.message).toLowerCase().includes('sale'), 'error message must mention sale');
  });

  await runner.test('STEP 8 | Creating lead from conversation links lead to conversation and selected sale', async () => {
    const res = await request({
      method: 'POST',
      reqPath: `/chatbot/conversations/${leadConvId}/create-lead`,
      token: opsToken,
      body: {
        parentName: 'Parent Conversation Lead',
        parentPhone: '0904777888',
        saleId: normalizeId(saleMe?.sub || saleMe?._id),
      },
      expectedStatus: [200, 201],
    });
    createdLeadId = normalizeId(res.data._id);
    ensure(createdLeadId, 'lead must be created');
    ensure(normalizeId(res.data.saleId) === normalizeId(saleMe?.sub || saleMe?._id), 'lead must belong to selected sale');
    ensure(normalizeId(res.data.adGroupId) === adGroupId, 'lead must inherit adGroupId from conversation');

    const detailRes = await request({
      reqPath: `/chatbot/conversations/${leadConvId}`,
      token: opsToken,
      expectedStatus: [200],
    });
    ensure(normalizeId(detailRes.data.leadId) === createdLeadId, 'conversation.leadId must be linked after create-lead');
  });

  await runner.test('STEP 9 | Creating draft order from conversation inherits linked lead sale owner', async () => {
    const res = await request({
      method: 'POST',
      reqPath: `/chatbot/conversations/${leadConvId}/create-order`,
      token: directorToken,
      body: {
        parentName: 'Parent Conversation Lead',
        parentPhone: '0904777888',
        studentName: 'Hoc sinh tu hoi thoai',
        items: [],
        notes: 'Tao don nhap tu man hoi thoai',
      },
      expectedStatus: [200, 201],
    });
    createdOrderId = normalizeId(res.data._id);
    ensure(createdOrderId, 'order must be created');
    ensure(res.data.status === 'DRAFT', `conversation order must be DRAFT, got "${res.data.status}"`);
    ensure(Array.isArray(res.data.items) && res.data.items.length === 0, 'conversation order must allow empty draft items');
    ensure(normalizeId(res.data.saleId) === normalizeId(saleMe?.sub || saleMe?._id), 'order must inherit sale owner from linked lead');

    const conversationRes = await request({
      reqPath: `/chatbot/conversations/${leadConvId}`,
      token: directorToken,
      expectedStatus: [200],
    });
    ensure(normalizeId(conversationRes.data.orderId) === createdOrderId, 'conversation.orderId must link to created order');

    const orderRes = await request({
      reqPath: `/orders/${createdOrderId}`,
      token: directorToken,
      expectedStatus: [200],
    });
    ensure(normalizeId(orderRes.data._id) === createdOrderId, 'orders endpoint must return created conversation order');
  });

  await runner.test('STEP 10 | Order can also be created directly from another conversation using selected sale', async () => {
    const res = await request({
      method: 'POST',
      reqPath: `/chatbot/conversations/${orderConvId}/create-order`,
      token: opsToken,
      body: {
        parentName: 'Parent Direct Order',
        parentPhone: '0904999000',
        studentName: 'Hoc sinh direct order',
        saleId: normalizeId(saleMe?.sub || saleMe?._id),
        items: [],
        notes: 'Don nhap khong qua lead',
      },
      expectedStatus: [200, 201],
    });
    ensure(normalizeId(res.data.saleId) === normalizeId(saleMe?.sub || saleMe?._id), 'direct conversation order must use selected sale');

    const detailRes = await request({
      reqPath: `/chatbot/conversations/${orderConvId}`,
      token: opsToken,
      expectedStatus: [200],
    });
    ensure(normalizeId(detailRes.data.orderId) === normalizeId(res.data._id), 'direct order conversation must store orderId');
  });

  runner.summary();
  if (runner.results.some((r) => r.status === 'FAIL')) process.exit(1);
}

main().catch((err) => {
  console.error('\nUnhandled error:', err.message);
  process.exit(1);
});
