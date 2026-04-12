/* eslint-disable no-console */
'use strict';

const path = require('path');
const Redis = require('ioredis');

try {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
} catch (_) {}

const API_BASE = process.env.TEST_API_BASE || `http://localhost:${process.env.PORT || 3000}`;
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'Demo123456!';
const REQUEST_TIMEOUT_MS = 30_000;
const REDIS_HOST = process.env.REDIS_HOST || '127.0.0.1';
const REDIS_PORT = Number(process.env.REDIS_PORT || 6379);
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || undefined;
const QUEUE_PREFIX = 'bull:chatbot-webhook';

const RUN_ID = Date.now();
const PAGE_ID = `page-queue-probe-${RUN_ID}`;
const AD_ACCOUNT_PLATFORM_ID = `act_queue_probe_${RUN_ID}`;
const AD_CAMPAIGN_ID = `fb-queue-campaign-${RUN_ID}`;
const QUEUE_PROBE_USERS = [
  { platformUserId: `fb-queue-probe-msg-${RUN_ID}`, text: `queue probe msg ${RUN_ID}` },
  { platformUserId: `fb-queue-probe-lead-${RUN_ID}`, text: `queue probe lead ${RUN_ID}` },
  { platformUserId: `fb-queue-probe-order-${RUN_ID}`, text: `queue probe order ${RUN_ID}` },
];

let directorToken;
let adAccountId;
let adGroupId;
let fanpageId;

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
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch (_) {}
  return { text, json };
}

async function request({
  method = 'GET',
  reqPath,
  token,
  body,
  expectedStatus = [200],
  headers = {},
}) {
  const finalHeaders = { Accept: 'application/json', ...headers };

  if (token) {
    finalHeaders.Cookie = token;
    const xsrf = extractXsrfFromCookieHeader(token);
    if (xsrf && !['GET', 'HEAD', 'OPTIONS'].includes(String(method).toUpperCase())) {
      finalHeaders['X-XSRF-TOKEN'] = xsrf;
    }
  }

  if (body !== undefined) {
    finalHeaders['Content-Type'] = 'application/json';
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE}${reqPath}`, {
      method,
      headers: finalHeaders,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    const parsed = await parseResponse(res);
    if (!expectedStatus.includes(res.status)) {
      throw new Error(`Expected ${expectedStatus.join('/')} for ${method} ${reqPath}, got ${res.status}: ${parsed.text}`);
    }
    return { status: res.status, data: parsed.json, text: parsed.text };
  } finally {
    clearTimeout(timeout);
  }
}

async function login(email, password) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const loginRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ email, password }),
      signal: controller.signal,
    });
    const loginParsed = await parseResponse(loginRes);
    ensure([200, 201].includes(loginRes.status), `Login failed for ${email}: ${loginRes.status} ${loginParsed.text}`);
    const cookieJar = extractCookiesFromResponse(loginRes);
    ensure(cookieJar.access_token, `No access_token cookie for ${email}`);

    const meRes = await fetch(`${API_BASE}/users/me`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Cookie: buildCookieHeader({ access_token: cookieJar.access_token }),
      },
      signal: controller.signal,
    });
    const meParsed = await parseResponse(meRes);
    ensure(meRes.status === 200, `GET /users/me failed for ${email}: ${meRes.status} ${meParsed.text}`);
    Object.assign(cookieJar, extractCookiesFromResponse(meRes));
    ensure(cookieJar['XSRF-TOKEN'], `No XSRF-TOKEN cookie for ${email}`);

    return buildCookieHeader({
      access_token: cookieJar.access_token,
      'XSRF-TOKEN': cookieJar['XSRF-TOKEN'],
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function pollUntil(checkFn, { maxAttempts = 20, delayMs = 250 } = {}) {
  for (let i = 0; i < maxAttempts; i++) {
    const result = await checkFn();
    if (result != null && result !== false) return result;
    if (i < maxAttempts - 1) await sleep(delayMs);
  }
  return null;
}

async function getQueueStats(redis) {
  const idRaw = await redis.get(`${QUEUE_PREFIX}:id`);
  const id = Number(idRaw || 0);
  let events = 0;
  try {
    events = Number(await redis.xlen(`${QUEUE_PREFIX}:events`));
  } catch (_) {}
  return { id, events };
}

async function createProbeInfra() {
  const accountRes = await request({
    method: 'POST',
    reqPath: '/ads/accounts',
    token: directorToken,
    body: {
      name: `Queue Probe AdAccount ${RUN_ID}`,
      platform: 'FACEBOOK',
      platformAccountId: AD_ACCOUNT_PLATFORM_ID,
    },
    expectedStatus: [200, 201],
  });
  adAccountId = normalizeId(accountRes.data?._id || accountRes.data?.id);
  ensure(adAccountId, 'adAccountId must exist');

  const groupRes = await request({
    method: 'POST',
    reqPath: '/ads/groups',
    token: directorToken,
    body: {
      name: `Queue Probe AdGroup ${RUN_ID}`,
      adAccountId,
      platform: 'FACEBOOK',
      platformCampaignId: AD_CAMPAIGN_ID,
    },
    expectedStatus: [200, 201],
  });
  adGroupId = normalizeId(groupRes.data?._id || groupRes.data?.id);
  ensure(adGroupId, 'adGroupId must exist');

  const fanpageRes = await request({
    method: 'POST',
    reqPath: '/chatbot/fanpages',
    token: directorToken,
    body: {
      name: `Queue Probe Fanpage ${RUN_ID}`,
      platform: 'FACEBOOK',
      pageId: PAGE_ID,
      adAccountId,
    },
    expectedStatus: [200, 201],
  });
  fanpageId = normalizeId(fanpageRes.data?._id || fanpageRes.data?.id);
  ensure(fanpageId, 'fanpageId must exist');
}

async function postWebhook(platformUserId, text) {
  const mid = `mid_${platformUserId}_${Date.now()}`;
  const payload = {
    object: 'page',
    entry: [{
      id: PAGE_ID,
      messaging: [{
        sender: { id: platformUserId },
        recipient: { id: PAGE_ID },
        timestamp: Date.now(),
        message: { mid, text },
        referral: {
          ref: AD_CAMPAIGN_ID,
          ad_id: AD_CAMPAIGN_ID,
          source: 'ADS',
          type: 'OPEN_THREAD',
        },
      }],
    }],
  };

  const res = await fetch(`${API_BASE}/webhooks/facebook/${PAGE_ID}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
  });
  const textBody = await res.text();
  ensure(res.status === 200, `Webhook must return 200, got ${res.status}: ${textBody}`);
  return { platformUserId, text, mid };
}

async function findConversationByPlatformUserId(platformUserId) {
  const res = await request({
    reqPath: `/chatbot/conversations?fanpageId=${encodeURIComponent(fanpageId)}&platform=FACEBOOK`,
    token: directorToken,
    expectedStatus: [200],
  });
  const list = Array.isArray(res.data?.data) ? res.data.data : [];
  return list.find((item) => item.platformUserId === platformUserId) || null;
}

async function getConversationMessages(conversationId) {
  const res = await request({
    reqPath: `/chatbot/conversations/${conversationId}/messages?page=1&limit=50`,
    token: directorToken,
    expectedStatus: [200],
  });
  return Array.isArray(res.data?.data) ? res.data.data : [];
}

async function cleanup() {
  if (!fanpageId || !directorToken) return;
  try {
    await request({
      method: 'DELETE',
      reqPath: `/chatbot/fanpages/${fanpageId}`,
      token: directorToken,
      expectedStatus: [200],
    });
  } catch (_) {}
}

async function main() {
  console.log('=== Redis/BullMQ Webhook Queue Probe ===');
  console.log(`API Base : ${API_BASE}`);
  console.log(`Redis    : ${REDIS_HOST}:${REDIS_PORT}`);
  console.log(`Run ID   : ${RUN_ID}`);
  console.log('');

  const redis = new Redis({
    host: REDIS_HOST,
    port: REDIS_PORT,
    ...(REDIS_PASSWORD ? { password: REDIS_PASSWORD } : {}),
    lazyConnect: false,
    maxRetriesPerRequest: 1,
  });

  try {
    directorToken = await login('director.demo@school.local', DEMO_PASSWORD);
    console.log('PASS | AUTH | Director login');

    await createProbeInfra();
    console.log(`PASS | SETUP | Ad account ${adAccountId}, ad group ${adGroupId}, fanpage ${fanpageId}`);

    const before = await getQueueStats(redis);
    console.log(`INFO | QUEUE | before id=${before.id} events=${before.events}`);

    const postedWebhooks = [];
    for (const probeUser of QUEUE_PROBE_USERS) {
      postedWebhooks.push(await postWebhook(probeUser.platformUserId, probeUser.text));
    }
    console.log(`PASS | WEBHOOK | Posted ${QUEUE_PROBE_USERS.length} webhook messages`);

    const after = await pollUntil(async () => {
      const stats = await getQueueStats(redis);
      const idDelta = stats.id - before.id;
      const eventDelta = stats.events - before.events;
      return idDelta >= QUEUE_PROBE_USERS.length || eventDelta >= QUEUE_PROBE_USERS.length ? stats : null;
    });
    ensure(after, 'Redis queue counters did not increase enough after webhook batch');
    console.log(`PASS | QUEUE | after id=${after.id} events=${after.events}`);

    for (const posted of postedWebhooks) {
      const conversation = await pollUntil(
        () => findConversationByPlatformUserId(posted.platformUserId),
        { maxAttempts: 24, delayMs: 250 },
      );
      ensure(conversation, `Conversation was not created for ${posted.platformUserId}`);
      const conversationId = normalizeId(conversation._id);
      ensure(conversationId, `conversationId must exist for ${posted.platformUserId}`);

      const messages = await pollUntil(async () => {
        const rows = await getConversationMessages(conversationId);
        return rows.find((item) => item.platformMessageId === posted.mid || item.content === posted.text) ? rows : null;
      }, { maxAttempts: 24, delayMs: 250 });
      ensure(messages, `Incoming customer message was not persisted for ${posted.platformUserId}`);

      console.log(
        `PASS | PERSIST | user=${posted.platformUserId} conversationId=${conversationId} mid=${posted.mid} content="${posted.text}"`,
      );
    }

    console.log('\n=== Queue Probe Summary ===');
    console.log(`API Base : ${API_BASE}`);
    console.log(`Queue ID : ${before.id} -> ${after.id}`);
    console.log(`Events   : ${before.events} -> ${after.events}`);
    console.log(`Persisted: ${QUEUE_PROBE_USERS.length}/${QUEUE_PROBE_USERS.length} webhook users`);
    console.log('PASS     : Redis/BullMQ webhook queue path is active');
  } finally {
    await cleanup();
    await redis.quit().catch(() => undefined);
  }
}

main().catch((err) => {
  console.error('\n=== Queue Probe Failure ===');
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});
