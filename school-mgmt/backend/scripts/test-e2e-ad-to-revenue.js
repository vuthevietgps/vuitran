/* eslint-disable no-console */
/**
 * E2E Test: Scenario 1 — Ad Click → Deferred Revenue & Commission
 *
 * Full flow:
 *   Facebook Webhook (with ad referral)
 *   → Conversation auto-created with adGroupId attribution
 *   → Lead created from conversation (attribution inherited)
 *   → Order created, submitted, approved → auto-enrollment → Invoice (PENDING_APPROVAL)
 *   → Invoice approved by Accounting → Wallet TOP_UP
 *   → Financial Dashboard: deferredRevenue.walletBalance ↑
 *   → P&L: sessionRevenue unchanged (no sessions finalized yet)
 *   → Bonus: double-approve invoice → 4xx guard, wallet unchanged
 *
 * Run: node scripts/test-e2e-ad-to-revenue.js
 * Or:  npm run test:e2e-ad-to-revenue
 */

'use strict';

const path = require('path');

try {
  // eslint-disable-next-line global-require
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
} catch (_) {}

// ── Config ────────────────────────────────────────────────────────────────────
const API_BASE = process.env.TEST_API_BASE || `http://localhost:${process.env.PORT || 3000}`;
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'Demo1234567890';
const REQUEST_TIMEOUT_MS = 30_000;

// ── Test-specific constants ───────────────────────────────────────────────────
const RUN_ID = Date.now();
const AD_CAMPAIGN_ID = `fb-e2e-cid-${RUN_ID}`;   // matches platformCampaignId in AdGroup
const FB_USER_ID = `fb-mock-${RUN_ID}`;           // simulated Facebook sender.id
const FANPAGE_PAGE_ID = `page-e2e-${RUN_ID}`;     // Fanpage pageId (used in webhook URL)
const TEST_PHONE = `09${String(RUN_ID).slice(-9)}`; // unique 11-digit VN phone
const TEST_PARENT_NAME = 'Nguyen E2E Test';
const STUDENT_NAME = 'Student E2E Test';
const DUMMY_PRODUCT_ID = '000000000000000000000001'; // valid ObjectId (not validated at enrollment)
const SESSIONS = 3;
const UNIT_PRICE = 500_000; // VND per session
const INVOICE_AMOUNT = SESSIONS * UNIT_PRICE; // 1_500_000 VND

// ── Shared state ──────────────────────────────────────────────────────────────
let directorToken;
let saleToken;
let accountingToken;
let adAccountId;
let adGroupId;
let fanpageId;
let conversationId;
let orderId;
let invoiceId;
let parentUserId;
let dashboardWalletBefore = 0;
let sessionRevenueBefore = 0;

// ── Helpers (same pattern as test-wallet-topup-workflow.js) ──────────────────

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
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Poll checkFn() until it returns a non-null/non-false value.
 * Returns the value, or null if all attempts are exhausted.
 */
async function pollUntil(checkFn, { maxAttempts = 12, delayMs = 2000 } = {}) {
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
    console.log('\n=== E2E Scenario 1: Ad Click → Revenue Summary ===');
    console.log(`API Base      : ${API_BASE}`);
    console.log(`Run ID        : ${RUN_ID}`);
    console.log(`AD_CAMPAIGN_ID: ${AD_CAMPAIGN_ID}`);
    console.log(`INVOICE_AMOUNT: ${INVOICE_AMOUNT.toLocaleString()} VND`);
    console.log(`PASS          : ${pass}`);
    console.log(`FAIL          : ${fail}`);
    if (fail > 0) {
      console.log('\nFailed tests:');
      this.results
        .filter((r) => r.status === 'FAIL')
        .forEach((r) => console.log(`  - ${r.name}: ${r.error}`));
    }
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== E2E Scenario 1: Ad Click → Deferred Revenue & Commission ===');
  console.log(`API Base      : ${API_BASE}`);
  console.log(`Run ID        : ${RUN_ID}`);
  console.log(`AD_CAMPAIGN_ID: ${AD_CAMPAIGN_ID}`);
  console.log(`TEST_PHONE    : ${TEST_PHONE}`);
  console.log(`INVOICE_AMOUNT: ${INVOICE_AMOUNT.toLocaleString()} VND`);
  console.log('');

  const runner = new TestRunner();

  // ────────────────────────────────────────────────────────────────────────────
  // AUTH
  // ────────────────────────────────────────────────────────────────────────────

  await runner.test('AUTH | Login as director', async () => {
    const auth = await login('director.demo@school.local', DEMO_PASSWORD);
    directorToken = auth.token;
    ensure(directorToken, 'Director token must be set');
  });

  await runner.test('AUTH | Login as sale', async () => {
    const auth = await login('sale.huong@school.local', DEMO_PASSWORD);
    saleToken = auth.token;
    ensure(saleToken, 'Sale token must be set');
  });

  await runner.test('AUTH | Login as accounting', async () => {
    const auth = await login('accounting.demo@school.local', DEMO_PASSWORD);
    accountingToken = auth.token;
    ensure(accountingToken, 'Accounting token must be set');
  });

  // ────────────────────────────────────────────────────────────────────────────
  // SETUP: Ad infrastructure
  // ────────────────────────────────────────────────────────────────────────────

  await runner.test('SETUP | Create AdAccount (FACEBOOK)', async () => {
    const { data } = await request({
      method: 'POST',
      reqPath: '/ads/accounts',
      token: directorToken,
      body: {
        name: `E2E AdAccount ${RUN_ID}`,
        platform: 'FACEBOOK',
        platformAccountId: `act_e2e_${RUN_ID}`,
      },
      expectedStatus: [200, 201],
    });
    adAccountId = normalizeId(data._id || data.id);
    ensure(adAccountId, 'adAccountId must be set after create');
    console.log(`      adAccountId: ${adAccountId}`);
  });

  await runner.test('SETUP | Create AdGroup with matching platformCampaignId', async () => {
    ensure(adAccountId, 'adAccountId required (previous test must pass)');
    const { data } = await request({
      method: 'POST',
      reqPath: '/ads/groups',
      token: directorToken,
      body: {
        name: `E2E AdGroup ${RUN_ID}`,
        adAccountId,
        platform: 'FACEBOOK',
        platformCampaignId: AD_CAMPAIGN_ID, // webhook referral.ad_id must match this
      },
      expectedStatus: [200, 201],
    });
    adGroupId = normalizeId(data._id || data.id);
    ensure(adGroupId, 'adGroupId must be set after create');
    console.log(`      adGroupId : ${adGroupId}`);
  });

  await runner.test('SETUP | Create Fanpage linked to AdAccount (no appSecret → skip webhook signature)', async () => {
    ensure(adAccountId, 'adAccountId required');
    const { data } = await request({
      method: 'POST',
      reqPath: '/chatbot/fanpages',
      token: directorToken,
      body: {
        name: `E2E Fanpage ${RUN_ID}`,
        platform: 'FACEBOOK',
        pageId: FANPAGE_PAGE_ID,
        adAccountId, // fanpage must link to the same AdAccount as the AdGroup for resolveAdGroup() to match
        // intentionally omit appSecret so webhook signature verification is skipped
      },
      expectedStatus: [200, 201],
    });
    fanpageId = normalizeId(data._id || data.id);
    ensure(fanpageId, 'fanpageId must be set after create');
    console.log(`      fanpageId : ${fanpageId}`);
  });

  // ────────────────────────────────────────────────────────────────────────────
  // STEP 1: Facebook Webhook → Conversation with ad attribution
  // ────────────────────────────────────────────────────────────────────────────

  await runner.test('STEP 1a | POST webhook with referral.ad_id = AD_CAMPAIGN_ID', async () => {
    ensure(fanpageId, 'fanpageId required');
    // Webhook is a public endpoint — no auth
    const webhookPayload = {
      object: 'page',
      entry: [{
        id: FANPAGE_PAGE_ID,
        messaging: [{
          sender: { id: FB_USER_ID },
          recipient: { id: FANPAGE_PAGE_ID },
          timestamp: Date.now(),
          message: { mid: `mid_e2e_${RUN_ID}`, text: 'Tôi muốn tìm hiểu về khóa học' },
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
      body: JSON.stringify(webhookPayload),
    });
    // Must acknowledge immediately with 200
    ensure(res.status === 200, `Webhook endpoint must return 200, got ${res.status}`);
    await res.text(); // drain response body
  });

  await runner.test('STEP 1b | Poll: conversation appears with correct adGroupId and AI_HANDLING status', async () => {
    ensure(fanpageId, 'fanpageId required');
    ensure(adGroupId, 'adGroupId required');

    const conv = await pollUntil(async () => {
      const { data } = await request({
        reqPath: `/chatbot/conversations${qs({ fanpageId, platform: 'FACEBOOK' })}`,
        token: directorToken,
        expectedStatus: [200],
      });
      const list = Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : []);
      return list.find((c) => c.platformUserId === FB_USER_ID) || null;
    }, { maxAttempts: 10, delayMs: 1000 }); // up to 10s; sync fallback resolves immediately

    ensure(conv, `Conversation for FB_USER_ID=${FB_USER_ID} must appear within 10s`);
    conversationId = normalizeId(conv._id);
    ensure(conversationId, 'conversationId must be set');

    const convAdGroupId = normalizeId(conv.adGroupId);
    ensure(
      convAdGroupId === adGroupId,
      `conv.adGroupId=${convAdGroupId} must equal adGroupId=${adGroupId}`,
    );
    ensure(
      conv.adRefParam === AD_CAMPAIGN_ID,
      `conv.adRefParam="${conv.adRefParam}" must equal AD_CAMPAIGN_ID="${AD_CAMPAIGN_ID}"`,
    );
    ensure(
      conv.status === 'AI_HANDLING',
      `conv.status="${conv.status}" must be AI_HANDLING`,
    );
    console.log(`      conversationId: ${conversationId}`);
    console.log(`      adRefParam    : ${conv.adRefParam}`);
    console.log(`      adGroupId     : ${convAdGroupId}`);
    console.log(`      status        : ${conv.status}`);
  });

  // ────────────────────────────────────────────────────────────────────────────
  // STEP 2: Create lead from conversation (attribution inherited)
  // ────────────────────────────────────────────────────────────────────────────

  await runner.test('STEP 2 | Create lead from conversation (SALE role)', async () => {
    ensure(conversationId, 'conversationId required');
    const { data } = await request({
      method: 'POST',
      reqPath: `/chatbot/conversations/${conversationId}/create-lead`,
      token: saleToken,
      body: {
        parentName: TEST_PARENT_NAME,
        parentPhone: TEST_PHONE,
        studentName: STUDENT_NAME,
        notes: `E2E run ${RUN_ID}`,
      },
      expectedStatus: [200, 201],
    });
    const leadId = normalizeId(data._id || data.id);
    ensure(leadId, 'leadId must be set');

    const leadAdGroupId = normalizeId(data.adGroupId);
    ensure(
      leadAdGroupId === adGroupId,
      `lead.adGroupId=${leadAdGroupId} must equal adGroupId=${adGroupId} (attribution inherited from conversation)`,
    );
    ensure(
      data.parentPhone === TEST_PHONE,
      `lead.parentPhone="${data.parentPhone}" must equal TEST_PHONE="${TEST_PHONE}"`,
    );
    console.log(`      leadId        : ${leadId}`);
    console.log(`      lead.adGroupId: ${leadAdGroupId}`);
    console.log(`      lead.phone    : ${data.parentPhone}`);
  });

  // ────────────────────────────────────────────────────────────────────────────
  // STEP 3a-b: Create order from conversation → submit
  // ────────────────────────────────────────────────────────────────────────────

  await runner.test('STEP 3a | Create order from conversation (DRAFT status)', async () => {
    ensure(conversationId, 'conversationId required');
    const { data } = await request({
      method: 'POST',
      reqPath: `/chatbot/conversations/${conversationId}/create-order`,
      token: saleToken,
      body: {
        parentName: TEST_PARENT_NAME,
        parentPhone: TEST_PHONE,
        studentName: STUDENT_NAME,
        items: [{
          productId: DUMMY_PRODUCT_ID,
          productName: 'Gói học E2E Test',
          quantity: SESSIONS,    // maps to → item.sessions
          unitPrice: UNIT_PRICE, // maps to → item.pricePerSession
        }],
        notes: `E2E order ${RUN_ID}`,
      },
      expectedStatus: [200, 201],
    });
    orderId = normalizeId(data._id || data.id);
    ensure(orderId, 'orderId must be set');
    ensure(data.status === 'DRAFT', `order.status must be DRAFT, got "${data.status}"`);
    ensure(
      data.finalAmount === INVOICE_AMOUNT,
      `order.finalAmount=${data.finalAmount} must equal INVOICE_AMOUNT=${INVOICE_AMOUNT}`,
    );
    console.log(`      orderId      : ${orderId}`);
    console.log(`      finalAmount  : ${data.finalAmount}`);
  });

  await runner.test('STEP 3b | Submit order (DRAFT → SUBMITTED)', async () => {
    ensure(orderId, 'orderId required');
    const { data } = await request({
      method: 'POST',
      reqPath: `/orders/${orderId}/submit`,
      token: saleToken,
      expectedStatus: [200, 201],
    });
    const status = data.status || (data.order && data.order.status);
    ensure(status === 'SUBMITTED', `order.status must be SUBMITTED after submit, got "${status}"`);
  });

  // ────────────────────────────────────────────────────────────────────────────
  // STEP 3c: Approve order → auto-enrollment → Student + Invoice created
  // ────────────────────────────────────────────────────────────────────────────

  await runner.test('STEP 3c | Approve order (DIRECTOR) → enrollment creates student & invoice', async () => {
    ensure(orderId, 'orderId required');
    const { data } = await request({
      method: 'POST',
      reqPath: `/orders/${orderId}/approve`,
      token: directorToken,
      expectedStatus: [200, 201],
    });

    const enrollment = data?.enrollment || {};
    const order = data?.order || data;

    ensure(
      enrollment.success === true,
      `enrollment.success must be true; errors: ${JSON.stringify(enrollment.errors)}`,
    );
    ensure(
      Array.isArray(enrollment.invoiceIds) && enrollment.invoiceIds.length > 0,
      `enrollment.invoiceIds must be a non-empty array`,
    );

    invoiceId = normalizeId(enrollment.invoiceIds[0]);
    ensure(invoiceId, 'invoiceId must be extracted from enrollment.invoiceIds[0]');

    // parentUserId is written to the order during enrollment
    parentUserId = normalizeId(order.parentUserId);
    ensure(parentUserId, 'order.parentUserId must be set after enrollment (parent User auto-created)');

    console.log(`      invoiceId    : ${invoiceId}`);
    console.log(`      parentUserId : ${parentUserId}`);
    console.log(`      studentId    : ${normalizeId(enrollment.studentId)}`);
  });

  await runner.test('STEP 3c verify | Invoice is in PENDING_APPROVAL with correct amount', async () => {
    ensure(invoiceId, 'invoiceId required');
    const { data } = await request({
      reqPath: `/invoices/${invoiceId}`,
      token: directorToken,
      expectedStatus: [200],
    });
    ensure(
      data.status === 'PENDING_APPROVAL',
      `invoice.status must be PENDING_APPROVAL before approval, got "${data.status}"`,
    );
    ensure(
      data.amount === INVOICE_AMOUNT,
      `invoice.amount=${data.amount} must equal INVOICE_AMOUNT=${INVOICE_AMOUNT}`,
    );
    console.log(`      invoice.status: ${data.status}`);
    console.log(`      invoice.amount: ${data.amount}`);
  });

  // ────────────────────────────────────────────────────────────────────────────
  // STEP 3d: Capture financial baseline before invoice approval
  // ────────────────────────────────────────────────────────────────────────────

  await runner.test('STEP 3d | Capture financial baseline (before invoice approval)', async () => {
    const [dashRes, pnlRes] = await Promise.all([
      request({
        reqPath: '/financial-control/dashboard',
        token: directorToken,
        expectedStatus: [200],
      }),
      request({
        reqPath: '/financial-control/profit-and-loss',
        token: directorToken,
        expectedStatus: [200],
      }),
    ]);
    dashboardWalletBefore = dashRes.data?.deferredRevenue?.walletBalance ?? 0;
    sessionRevenueBefore = pnlRes.data?.revenue?.sessionRevenue ?? 0;
    console.log(`      deferredRevenue.walletBalance (before): ${dashboardWalletBefore.toLocaleString()}`);
    console.log(`      revenue.sessionRevenue (before)       : ${sessionRevenueBefore.toLocaleString()}`);
  });

  // ────────────────────────────────────────────────────────────────────────────
  // STEP 3e: Approve invoice → wallets.topUpFromInvoice
  // ────────────────────────────────────────────────────────────────────────────

  await runner.test('STEP 3e | Approve invoice (ACCOUNTING) → wallet TOP_UP', async () => {
    ensure(invoiceId, 'invoiceId required');
    const { data } = await request({
      method: 'POST',
      reqPath: `/invoices/${invoiceId}/approve`,
      token: accountingToken,
      body: { action: 'APPROVE', approvalImage: 'uploads/e2e-test-proof.jpg' },
      expectedStatus: [200, 201],
    });
    const invoice = data?.invoice || data;
    ensure(
      invoice.status === 'APPROVED',
      `invoice.status must be APPROVED after approval, got "${invoice.status}"`,
    );
    console.log(`      invoice.status: ${invoice.status}`);
  });

  // ────────────────────────────────────────────────────────────────────────────
  // STEP 4a: Wallet balance verification
  // ────────────────────────────────────────────────────────────────────────────

  await runner.test('STEP 4a | Wallet balance = INVOICE_AMOUNT', async () => {
    ensure(parentUserId, 'parentUserId required');
    const { data } = await request({
      reqPath: `/wallets/user/${parentUserId}`,
      token: directorToken,
      expectedStatus: [200],
    });
    const wallet = data?.wallet || data;
    ensure(
      wallet.balance === INVOICE_AMOUNT,
      `wallet.balance=${wallet.balance} must equal INVOICE_AMOUNT=${INVOICE_AMOUNT}`,
    );
    ensure(
      wallet.totalTopUp === INVOICE_AMOUNT,
      `wallet.totalTopUp=${wallet.totalTopUp} must equal INVOICE_AMOUNT=${INVOICE_AMOUNT}`,
    );
    console.log(`      wallet.balance  : ${wallet.balance}`);
    console.log(`      wallet.totalTopUp: ${wallet.totalTopUp}`);
  });

  // ────────────────────────────────────────────────────────────────────────────
  // STEP 4b: Ledger entry verification
  // ────────────────────────────────────────────────────────────────────────────

  await runner.test('STEP 4b | Ledger has TOP_UP entry linked to invoice, status APPROVED', async () => {
    ensure(parentUserId, 'parentUserId required');
    ensure(invoiceId, 'invoiceId required');
    const { data } = await request({
      reqPath: `/wallets/ledger${qs({ userId: parentUserId, type: 'TOP_UP' })}`,
      token: directorToken,
      expectedStatus: [200],
    });
    const entries = Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : []);
    const topUpEntry = entries.find((e) => normalizeId(e.invoiceId) === invoiceId);
    ensure(topUpEntry, `Ledger must contain a TOP_UP entry for invoiceId=${invoiceId}`);
    ensure(topUpEntry.type === 'TOP_UP', `ledger.type must be TOP_UP, got "${topUpEntry.type}"`);
    ensure(topUpEntry.status === 'APPROVED', `ledger.status must be APPROVED, got "${topUpEntry.status}"`);
    ensure(
      topUpEntry.amount === INVOICE_AMOUNT,
      `ledger.amount=${topUpEntry.amount} must equal INVOICE_AMOUNT=${INVOICE_AMOUNT}`,
    );
    console.log(`      ledger.type  : ${topUpEntry.type}`);
    console.log(`      ledger.status: ${topUpEntry.status}`);
    console.log(`      ledger.amount: ${topUpEntry.amount}`);
  });

  // ────────────────────────────────────────────────────────────────────────────
  // STEP 4c: Financial dashboard — deferredRevenue.walletBalance increased
  // ────────────────────────────────────────────────────────────────────────────

  await runner.test('STEP 4c | deferredRevenue.walletBalance increased by INVOICE_AMOUNT', async () => {
    const { data } = await request({
      reqPath: '/financial-control/dashboard',
      token: directorToken,
      expectedStatus: [200],
    });
    const walletAfter = data?.deferredRevenue?.walletBalance ?? 0;
    console.log(`      walletBalance before: ${dashboardWalletBefore.toLocaleString()}`);
    console.log(`      walletBalance after : ${walletAfter.toLocaleString()}`);
    console.log(`      expected increase   : >= ${INVOICE_AMOUNT.toLocaleString()}`);
    ensure(
      walletAfter >= dashboardWalletBefore + INVOICE_AMOUNT,
      `deferredRevenue.walletBalance must increase by at least ${INVOICE_AMOUNT}: ` +
        `before=${dashboardWalletBefore}, after=${walletAfter}`,
    );
  });

  // ────────────────────────────────────────────────────────────────────────────
  // STEP 4d: P&L — sessionRevenue unchanged (no sessions yet finalized)
  // ────────────────────────────────────────────────────────────────────────────

  await runner.test('STEP 4d | revenue.sessionRevenue unchanged (no sessions finalized)', async () => {
    const { data } = await request({
      reqPath: '/financial-control/profit-and-loss',
      token: directorToken,
      expectedStatus: [200],
    });
    const sessionRevenueAfter = data?.revenue?.sessionRevenue ?? 0;
    console.log(`      sessionRevenue before: ${sessionRevenueBefore.toLocaleString()}`);
    console.log(`      sessionRevenue after : ${sessionRevenueAfter.toLocaleString()}`);
    ensure(
      sessionRevenueAfter === sessionRevenueBefore,
      `revenue.sessionRevenue must be unchanged: before=${sessionRevenueBefore}, after=${sessionRevenueAfter}`,
    );
  });

  // ────────────────────────────────────────────────────────────────────────────
  // BONUS: Idempotency — double-approve must be rejected
  // ────────────────────────────────────────────────────────────────────────────

  await runner.test('BONUS | Double-approve invoice → 4xx (idempotent guard)', async () => {
    ensure(invoiceId, 'invoiceId required');
    const { status } = await request({
      method: 'POST',
      reqPath: `/invoices/${invoiceId}/approve`,
      token: accountingToken,
      body: { action: 'APPROVE' },
      expectedStatus: [400, 409, 422],
    });
    console.log(`      double-approve response status: ${status} (expected 4xx)`);
  });

  await runner.test('BONUS | Wallet balance unchanged after double-approve attempt', async () => {
    ensure(parentUserId, 'parentUserId required');
    const { data } = await request({
      reqPath: `/wallets/user/${parentUserId}`,
      token: directorToken,
      expectedStatus: [200],
    });
    const wallet = data?.wallet || data;
    ensure(
      wallet.balance === INVOICE_AMOUNT,
      `wallet.balance must still be ${INVOICE_AMOUNT} after double-approve, got ${wallet.balance}`,
    );
    console.log(`      wallet.balance after double-approve: ${wallet.balance} (unchanged ✓)`);
  });

  // ────────────────────────────────────────────────────────────────────────────
  runner.summary();
  if (runner.results.some((r) => r.status === 'FAIL')) process.exit(1);
}

main().catch((err) => {
  console.error('\nUnhandled error:', err.message);
  process.exit(1);
});
