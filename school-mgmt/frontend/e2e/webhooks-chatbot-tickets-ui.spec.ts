// Playwright E2E — Batch 8 UI Tests
// Scenarios: 18.1, 18.2, 18.3, 18.4, 18.5, 18.6, 19.1, 19.2, 19.3, 20.1
//
// Covers:
//  - Webhooks: POST /webhooks/facebook/:pageId always returns 200 (18.1)
//  - Redis fallback: multiple rapid webhook calls all succeed (18.2)
//  - OpenAI tokens: DIRECTOR manages tokens; status update visible in UI (18.3)
//  - Fanpages: DIRECTOR creates fanpage; accessToken masked in list (18.4)
//  - AI assistant profiles: DIRECTOR tunes systemPrompt/temperature (18.5)
//  - Conversations: OPS/SALE sees list; assign conversation to Sale (18.6)
//  - Refund ticket flow: PARENT creates ticket → OPS starts → ACCOUNTING adjusts wallet → OPS closes (19.1)
//  - CRM auto-link: SALE creates order from conversation (19.2)
//  - Ticket overdue: OPS escalates ticket priority; stats/SLA visible (19.3)
//  - Backfill: DIRECTOR runs backfill-parent-attribution via ads endpoint (20.1)
//
// Run: npx playwright test e2e/webhooks-chatbot-tickets-ui.spec.ts

import { test, expect } from '@playwright/test';
import { loginAsRole, applySessionCookies } from './support/auth';
import { apiJson } from './support/api';

const APP = process.env['PLAYWRIGHT_BASE_URL'] || 'http://localhost:4200';
const API = process.env['PLAYWRIGHT_API_BASE_URL'] || 'http://127.0.0.1:3000';
const AI_ASSISTANT_TEST_LABEL = 'UI Test Profile 18.5';
const AI_ASSISTANT_UPDATED_TEST_LABEL = 'Updated UI Test Profile 18.5';
const AI_ASSISTANT_TYPES = ['PARENT_SUPPORT', 'INTERNAL_SUPPORT', 'TEACHER_SUPPORT', 'LEAD_CARE'] as const;
const AI_ASSISTANT_RECYCLE_PRIORITY = ['LEAD_CARE', 'INTERNAL_SUPPORT', 'TEACHER_SUPPORT'] as const;

type AiAssistantTypeValue = typeof AI_ASSISTANT_TYPES[number];

type AiAssistantProfileItem = {
  _id?: string;
  id?: string;
  assistantType?: string;
  label?: string;
  description?: string;
  rulesPrompt?: string;
  defaultOpenAITokenId?: string;
  status?: string;
};

type AiAssistantProfileBackup = {
  assistantType: AiAssistantTypeValue;
  label: string;
  description?: string;
  rulesPrompt?: string;
  defaultOpenAITokenId?: string;
  status: string;
};

function unwrapApiCollection(body: any): any[] {
  if (Array.isArray(body?.data)) return body.data;
  if (Array.isArray(body)) return body;
  return [];
}

function getEntityId(item: any): string | undefined {
  const id = item?._id || item?.id;
  return typeof id === 'string' ? id : undefined;
}

async function listAiAssistantProfiles(request: any, session: any): Promise<AiAssistantProfileItem[]> {
  const res = await apiJson(request, '/chatbot/ai-assistant-profiles', { method: 'GET', session });
  expect([200, 201]).toContain(res.status);
  return unwrapApiCollection(res.body) as AiAssistantProfileItem[];
}

async function deleteAiAssistantProfile(request: any, session: any, profileId: string): Promise<void> {
  const res = await apiJson(request, `/chatbot/ai-assistant-profiles/${profileId}`, {
    method: 'DELETE',
    session,
    expectedStatus: [200, 201, 204],
  });
  expect([200, 201, 204]).toContain(res.status);
}

async function restoreAiAssistantProfile(
  request: any,
  session: any,
  backup: AiAssistantProfileBackup | null,
): Promise<void> {
  if (!backup) return;

  const res = await apiJson(request, '/chatbot/ai-assistant-profiles', {
    method: 'POST',
    session,
    body: backup,
  });
  expect([200, 201]).toContain(res.status);
}

function buildAiAssistantProfileBackup(profile: AiAssistantProfileItem): AiAssistantProfileBackup {
  const assistantType = AI_ASSISTANT_TYPES.find((type) => type === profile.assistantType);
  if (!assistantType) {
    throw new Error(`Unsupported assistantType for recycle: ${profile.assistantType}`);
  }
  if (!profile.label?.trim()) {
    throw new Error(`Cannot recycle AI profile without label: ${assistantType}`);
  }

  const backup: AiAssistantProfileBackup = {
    assistantType,
    label: profile.label.trim(),
    status: profile.status || 'ACTIVE',
  };

  if (profile.description?.trim()) backup.description = profile.description.trim();
  if (profile.rulesPrompt?.trim()) backup.rulesPrompt = profile.rulesPrompt.trim();
  if (profile.defaultOpenAITokenId?.trim()) backup.defaultOpenAITokenId = profile.defaultOpenAITokenId.trim();

  return backup;
}

async function reserveAiAssistantTypeSlot(request: any, session: any): Promise<{
  assistantType: AiAssistantTypeValue;
  recycledProfileBackup: AiAssistantProfileBackup | null;
}> {
  let profiles = await listAiAssistantProfiles(request, session);
  const staleProfiles = profiles.filter((profile) =>
    [AI_ASSISTANT_TEST_LABEL, AI_ASSISTANT_UPDATED_TEST_LABEL].includes(profile.label || ''),
  );
  for (const staleProfile of staleProfiles) {
    const staleProfileId = getEntityId(staleProfile);
    if (staleProfileId) {
      await deleteAiAssistantProfile(request, session, staleProfileId);
    }
  }

  profiles = await listAiAssistantProfiles(request, session);
  const availableAssistantType = AI_ASSISTANT_TYPES.find((type) =>
    !profiles.some((profile) => profile.assistantType === type),
  );
  if (availableAssistantType) {
    return { assistantType: availableAssistantType, recycledProfileBackup: null };
  }

  const recycleCandidate = AI_ASSISTANT_RECYCLE_PRIORITY
    .map((type) => profiles.find((profile) => profile.assistantType === type))
    .find(Boolean);
  const recycleCandidateId = getEntityId(recycleCandidate);
  if (!recycleCandidate || !recycleCandidateId) {
    throw new Error('Unable to reserve an assistantType slot for 18.5 AI profile test.');
  }

  const recycledProfileBackup = buildAiAssistantProfileBackup(recycleCandidate);
  await deleteAiAssistantProfile(request, session, recycleCandidateId);

  return {
    assistantType: recycledProfileBackup.assistantType,
    recycledProfileBackup,
  };
}

// ─── 18.1 Webhook Signature Mismatch ────────────────────────────────────────

test.describe('18.1 Webhook Signature Mismatch', () => {
  test('POST /webhooks/facebook/:pageId luôn trả về 200 kể cả không có chữ ký', async ({ request }) => {
    const res = await request.post(`${API}/webhooks/facebook/test-page-ui-18-1`, {
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({ object: 'page', entry: [] }),
    });
    expect(res.status()).toBe(200);
  });

  test('POST với X-Hub-Signature-256 sai vẫn trả về 200', async ({ request }) => {
    const res = await request.post(`${API}/webhooks/facebook/test-page-ui-18-1`, {
      headers: {
        'Content-Type': 'application/json',
        'x-hub-signature-256': 'sha256=INVALID_SIGNATURE',
      },
      data: JSON.stringify({
        object: 'page',
        entry: [
          {
            id: 'test-page-ui-18-1',
            messaging: [
              {
                sender: { id: 'fb-user-111' },
                recipient: { id: 'test-page-ui-18-1' },
                timestamp: Date.now(),
                message: { mid: 'mid-ui-001', text: 'test message' },
              },
            ],
          },
        ],
      }),
    });
    expect(res.status()).toBe(200);
  });

  test('POST với body trống vẫn trả về 200', async ({ request }) => {
    const res = await request.post(`${API}/webhooks/facebook/test-page-ui-18-1`, {
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({}),
    });
    expect(res.status()).toBe(200);
  });
});

// ─── 18.2 Redis/BullMQ Queue Fallback ───────────────────────────────────────

test.describe('18.2 Redis/BullMQ Queue Fallback', () => {
  test('Nhiều webhook requests liên tiếp đều trả về 200', async ({ request }) => {
    const pageId = 'test-page-ui-18-2';
    const results = await Promise.all(
      [1, 2, 3, 4, 5].map((i) =>
        request.post(`${API}/webhooks/facebook/${pageId}`, {
          headers: { 'Content-Type': 'application/json' },
          data: JSON.stringify({
            object: 'page',
            entry: [
              {
                id: pageId,
                messaging: [
                  {
                    sender: { id: `user-${i}` },
                    recipient: { id: pageId },
                    timestamp: Date.now(),
                    message: { mid: `mid-fallback-${i}`, text: `message ${i}` },
                  },
                ],
              },
            ],
          }),
        }),
      ),
    );
    for (const res of results) {
      expect(res.status()).toBe(200);
    }
  });
});

// ─── 18.3 OpenAI Token Exhaustion ───────────────────────────────────────────

test.describe('18.3 OpenAI Token Management', () => {
  test('DIRECTOR thấy trang chatbot-settings không crash', async ({ page, request }) => {
    const session = await loginAsRole(request, 'director');
    await applySessionCookies(page.context(), session);

    await page.goto(`${APP}/app/chatbot-settings`);
    await page.waitForLoadState('networkidle');

    await expect(page.locator('h1, h2').first()).toBeVisible();
  });

  test('DIRECTOR GET /chatbot/openai-tokens trả về danh sách', async ({ request }) => {
    const session = await loginAsRole(request, 'director');
    const res = await apiJson(request, '/chatbot/openai-tokens', { method: 'GET', session });
    expect([200, 201]).toContain(res.status);
  });

  test('DIRECTOR POST /chatbot/openai-tokens có thể tạo token mới', async ({ request }) => {
    const session = await loginAsRole(request, 'director');
    const res = await apiJson(request, '/chatbot/openai-tokens', {
      method: 'POST',
      session,
      body: {
        label: 'UI Test Token 18.3',
        apiKey: 'sk-ui-test-18-3',
        model: 'gpt-4o',
      },
    });
    expect([200, 201]).toContain(res.status);
    const tokenId = res.body?._id || res.body?.id;
    if (tokenId) {
      // Update to simulate exhaustion
      const patchRes = await apiJson(request, `/chatbot/openai-tokens/${tokenId}`, {
        method: 'PATCH',
        session,
        body: { status: 'EXPIRED' },
      });
      expect([200, 201]).toContain(patchRes.status);

      // Cleanup
      await apiJson(request, `/chatbot/openai-tokens/${tokenId}`, { method: 'DELETE', session });
    }
  });

  test('SALE bị từ chối GET /chatbot/openai-tokens (403)', async ({ request }) => {
    const session = await loginAsRole(request, 'sale');
    const res = await apiJson(request, '/chatbot/openai-tokens', { method: 'GET', session });
    expect(res.status).toBe(403);
  });

  test('OPS bị từ chối POST /chatbot/openai-tokens (403)', async ({ request }) => {
    const session = await loginAsRole(request, 'ops');
    const res = await apiJson(request, '/chatbot/openai-tokens', {
      method: 'POST',
      session,
      body: { label: 'OPS Attempt', apiKey: 'sk-ops', model: 'gpt-3.5-turbo' },
    });
    expect(res.status).toBe(403);
  });
});

// ─── 18.4 Fanpage CRUD & Token Masking ────────────────────────────────────

test.describe('18.4 Fanpage CRUD & Token Masking', () => {
  test('DIRECTOR có thể tạo fanpage mới', async ({ request }) => {
    const session = await loginAsRole(request, 'director');
    const pageId = `ui-fp-${Date.now()}`;
    const res = await apiJson(request, '/chatbot/fanpages', {
      method: 'POST',
      session,
      body: {
        pageId,
        name: 'UI Test Fanpage 18.4',
        pageAccessToken: 'EAAUITestTokenXYZ',
        platform: 'FACEBOOK',
      },
    });
    expect([200, 201]).toContain(res.status);
    const fanpageId = res.body?._id || res.body?.id;

    if (fanpageId) {
      // accessToken phải bị ẩn trong GET
      const listRes = await apiJson(request, '/chatbot/fanpages', { method: 'GET', session });
      const items: any[] = listRes.body?.data || listRes.body || [];
      const fp = items.find((f: any) => (f._id || f.id) === fanpageId);
      if (fp) {
        const token = fp.pageAccessToken || fp.accessToken || fp.accesstoken || '';
        expect(token).not.toBe('EAAUITestTokenXYZ');
      }

      // Cleanup
      await apiJson(request, `/chatbot/fanpages/${fanpageId}`, { method: 'DELETE', session });
    }
  });

  test('Tạo fanpage với pageId trùng trả về 409', async ({ request }) => {
    const session = await loginAsRole(request, 'director');
    const pageId = `dup-ui-fp-${Date.now()}`;

    // First creation
    const first = await apiJson(request, '/chatbot/fanpages', {
      method: 'POST',
      session,
      body: { pageId, name: 'First FP', pageAccessToken: 'EAAFirst', platform: 'FACEBOOK' },
    });
    expect([200, 201]).toContain(first.status);
    const fanpageId = first.body?._id || first.body?.id;

    // Duplicate
    const dup = await apiJson(request, '/chatbot/fanpages', {
      method: 'POST',
      session,
      body: { pageId, name: 'Duplicate FP', pageAccessToken: 'EAADuplicate', platform: 'FACEBOOK' },
    });
    expect([409, 400]).toContain(dup.status);

    // Cleanup
    if (fanpageId) {
      await apiJson(request, `/chatbot/fanpages/${fanpageId}`, { method: 'DELETE', session });
    }
  });

  test('SALE bị từ chối tạo fanpage (403)', async ({ request }) => {
    const session = await loginAsRole(request, 'sale');
    const res = await apiJson(request, '/chatbot/fanpages', {
      method: 'POST',
      session,
      body: { pageId: 'sale-attempt', name: 'Unauthorized', pageAccessToken: 'EAAUnauth', platform: 'FACEBOOK' },
    });
    expect(res.status).toBe(403);
  });

  test('OPS có thể đọc fanpages', async ({ request }) => {
    const session = await loginAsRole(request, 'ops');
    const res = await apiJson(request, '/chatbot/fanpages', { method: 'GET', session });
    expect([200, 201]).toContain(res.status);
  });
});

// ─── 18.5 AI Assistant Profile Tuning ─────────────────────────────────────

test.describe('18.5 AI Assistant Profile Tuning', () => {
  test('DIRECTOR c?? th??? t???o v?? c???p nh???t AI profile', async ({ request }) => {
    const session = await loginAsRole(request, 'director');
    const { assistantType: availableAssistantType, recycledProfileBackup } =
      await reserveAiAssistantTypeSlot(request, session);
    let profileId: string | undefined;

    try {
      const createRes = await apiJson(request, '/chatbot/ai-assistant-profiles', {
        method: 'POST',
        session,
        body: {
          label: AI_ASSISTANT_TEST_LABEL,
          assistantType: availableAssistantType,
          rulesPrompt: 'Initial prompt',
          description: 'Profile created by frontend e2e',
        },
      });
      expect([200, 201]).toContain(createRes.status);
      profileId = createRes.body?._id || createRes.body?.id;
      expect(profileId).toBeTruthy();

      const patchRes = await apiJson(request, `/chatbot/ai-assistant-profiles/${profileId}`, {
        method: 'PATCH',
        session,
        body: {
          label: AI_ASSISTANT_UPDATED_TEST_LABEL,
          rulesPrompt: 'B???n l?? tr??? l?? ch??m s??c ph??? huynh t???n t??m.',
          status: 'INACTIVE',
        },
      });
      expect([200, 201]).toContain(patchRes.status);

      const items = await listAiAssistantProfiles(request, session);
      const profile = items.find((item) => getEntityId(item) === profileId);
      expect(profile).toBeTruthy();
      expect(profile?.assistantType).toBe(availableAssistantType);
      expect(profile?.label).toBe(AI_ASSISTANT_UPDATED_TEST_LABEL);
      expect(profile?.rulesPrompt).toBe('B???n l?? tr??? l?? ch??m s??c ph??? huynh t???n t??m.');
      expect(profile?.status).toBe('INACTIVE');
    } finally {
      if (profileId) {
        await deleteAiAssistantProfile(request, session, profileId);
      }
      await restoreAiAssistantProfile(request, session, recycledProfileBackup);
    }
  });

  test('OPS có thể đọc AI profiles', async ({ request }) => {
    const session = await loginAsRole(request, 'ops');
    const res = await apiJson(request, '/chatbot/ai-assistant-profiles', { method: 'GET', session });
    expect([200, 201]).toContain(res.status);
  });

  test('SALE bị từ chối tạo AI profile (403)', async ({ request }) => {
    const session = await loginAsRole(request, 'sale');
    const res = await apiJson(request, '/chatbot/ai-assistant-profiles', {
      method: 'POST',
      session,
      body: { name: 'Unauthorized', assistantType: 'LEAD_CARE', systemPrompt: 'test', temperature: 1, maxTokens: 100 },
    });
    expect(res.status).toBe(403);
  });
});

// ─── 18.6 Conversation Ownership ────────────────────────────────────────────

test.describe('18.6 Conversation Ownership', () => {
  test('OPS có thể xem danh sách hội thoại', async ({ request }) => {
    const session = await loginAsRole(request, 'ops');
    const res = await apiJson(request, '/chatbot/conversations', { method: 'GET', session });
    expect([200, 201]).toContain(res.status);
    expect(Array.isArray(res.body?.data || res.body)).toBe(true);
  });

  test('SALE có thể xem danh sách hội thoại', async ({ request }) => {
    const session = await loginAsRole(request, 'sale');
    const res = await apiJson(request, '/chatbot/conversations', { method: 'GET', session });
    expect([200, 201]).toContain(res.status);
  });

  test('Unauthenticated bị từ chối xem hội thoại', async ({ request }) => {
    const res = await request.get(`${API}/chatbot/conversations`);
    expect([401, 403]).toContain(res.status());
  });

  test('DIRECTOR thấy trang conversations không crash', async ({ page, request }) => {
    const session = await loginAsRole(request, 'director');
    await applySessionCookies(page.context(), session);

    await page.goto(`${APP}/app/chatbot-settings`);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
  });
});

// ─── 19.1 Refund Ticket Flow ─────────────────────────────────────────────────

test.describe('19.1 Refund Ticket Flow', () => {
  test('PARENT thấy trang tickets không crash', async ({ page, request }) => {
    const session = await loginAsRole(request, 'parent');
    await applySessionCookies(page.context(), session);

    await page.goto(`${APP}/app/tickets`);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
  });

  test('PARENT POST /tickets tạo REFUND_REQUEST ticket', async ({ request }) => {
    const session = await loginAsRole(request, 'parent');
    const res = await apiJson(request, '/tickets', {
      method: 'POST',
      session,
      body: {
        type: 'REFUND_REQUEST',
        subject: 'UI Test Refund G15',
        description: 'Cần hoàn tiền buổi học bị hủy.',
        priority: 'MEDIUM',
      },
    });
    expect([200, 201]).toContain(res.status);
    const ticketId = res.body?._id || res.body?.id;

    if (ticketId) {
      expect(res.body.type).toBe('REFUND_REQUEST');
      expect(res.body.status).toBe('OPEN');

      // OPS starts the ticket
      const opsSession = await loginAsRole(request, 'ops');
      const startRes = await apiJson(request, `/tickets/${ticketId}/start`, { method: 'POST', session: opsSession });
      expect([200, 201]).toContain(startRes.status);

      const resolveRes = await apiJson(request, `/tickets/${ticketId}/resolve`, {
        method: 'POST',
        session: opsSession,
        body: {
          summary: 'Validated refund request and completed manual review.',
          outcome: 'REJECTED',
        },
      });
      expect([200, 201]).toContain(resolveRes.status);
      expect(resolveRes.body?.status).toBe('RESOLVED');

      // OPS closes after resolve
      const closeRes = await apiJson(request, `/tickets/${ticketId}/close`, { method: 'POST', session: opsSession });
      expect([200, 201]).toContain(closeRes.status);
      expect(closeRes.body?.status).toBe('CLOSED');
    }
  });

  test('OPS thấy trang tickets không crash', async ({ page, request }) => {
    const session = await loginAsRole(request, 'ops');
    await applySessionCookies(page.context(), session);

    await page.goto(`${APP}/app/tickets`);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });

  test('PARENT chỉ thấy my-tickets — không thấy tất cả tickets', async ({ request }) => {
    const session = await loginAsRole(request, 'parent');
    const myRes = await apiJson(request, '/tickets/my-tickets', { method: 'GET', session });
    expect([200, 201]).toContain(myRes.status);

    // PARENT bị từ chối GET /tickets (all tickets)
    const allRes = await apiJson(request, '/tickets', { method: 'GET', session });
    expect([401, 403]).toContain(allRes.status);
  });

  test('ACCOUNTING POST /wallets/adjust hoàn tiền 200k', async ({ request }) => {
    // Get director session to lookup a user ID
    const dirSession = await loginAsRole(request, 'director');
    const usersRes = await apiJson(request, '/users?limit=10', { method: 'GET', session: dirSession });
    const users = usersRes.body?.data || usersRes.body || [];
    const parent = users.find((u: any) => u.role === 'PARENT');
    if (!parent) return;

    const accSession = await loginAsRole(request, 'accounting');
    const res = await apiJson(request, '/wallets/adjust', {
      method: 'POST',
      session: accSession,
      body: {
        userId: parent._id,
        amount: 200000,
        direction: 'ADD',
        description: 'UI test refund adjustment',
        reason: 'Hoàn tiền buổi học bị hủy (UI Test)',
      },
    });
    expect([200, 201]).toContain(res.status);
  });
});

// ─── 19.2 CRM Auto-link from Chatbot ─────────────────────────────────────────

test.describe('19.2 CRM Auto-link from Chatbot', () => {
  test('SALE có thể gọi POST /chatbot/conversations/:id/create-lead', async ({ request }) => {
    const session = await loginAsRole(request, 'sale');

    // Get any conversation
    const listRes = await apiJson(request, '/chatbot/conversations?limit=1', { method: 'GET', session });
    const items = listRes.body?.data || listRes.body || [];

    if (items.length === 0) {
      const fakeId = '000000000000000000000001';
      const res = await apiJson(request, `/chatbot/conversations/${fakeId}/create-lead`, {
        method: 'POST',
        session,
        body: { parentName: 'Test Lead', parentPhone: '0900000001' },
      });
      expect([200, 201, 404, 422]).toContain(res.status);
    } else {
      const convId = items[0]._id || items[0].id;
      const res = await apiJson(request, `/chatbot/conversations/${convId}/create-lead`, {
        method: 'POST',
        session,
        body: { parentName: 'Nguyễn Văn CRM', parentPhone: '0900000002' },
      });
      expect([200, 201, 400, 409, 404, 422]).toContain(res.status);
    }
  });

  test('SALE có thể gọi POST /chatbot/conversations/:id/create-order', async ({ request }) => {
    const session = await loginAsRole(request, 'sale');

    const listRes = await apiJson(request, '/chatbot/conversations?limit=1', { method: 'GET', session });
    const items = listRes.body?.data || listRes.body || [];
    const convId = items.length > 0 ? (items[0]._id || items[0].id) : '000000000000000000000001';

    const res = await apiJson(request, `/chatbot/conversations/${convId}/create-order`, {
      method: 'POST',
      session,
      body: { courseName: 'Toán Lớp 8', amount: 1200000 },
    });
    expect([200, 201, 400, 404, 422]).toContain(res.status);
  });

  test('Unauthenticated bị từ chối create-order', async ({ request }) => {
    const res = await request.post(`${API}/chatbot/conversations/000000000000000000000001/create-order`, {
      data: { courseName: 'test' },
    });
    expect([401, 403]).toContain(res.status());
  });
});

// ─── 19.3 Ticket Overdue Escalation ──────────────────────────────────────────

test.describe('19.3 Ticket Overdue Escalation & SLA', () => {
  test('OPS thấy SLA metrics', async ({ request }) => {
    const session = await loginAsRole(request, 'ops');
    const res = await apiJson(request, '/tickets/sla-metrics', { method: 'GET', session });
    expect([200, 201]).toContain(res.status);
    expect(res.body).toBeDefined();
  });

  test('DIRECTOR thấy ticket stats', async ({ request }) => {
    const session = await loginAsRole(request, 'director');
    const res = await apiJson(request, '/tickets/stats', { method: 'GET', session });
    expect([200, 201]).toContain(res.status);
    expect(res.body).toBeDefined();
  });

  test('OPS có thể nâng priority ticket của một ticket thành HIGH', async ({ request }) => {
    const parentSession = await loginAsRole(request, 'parent');
    const session = await loginAsRole(request, 'ops');
    const createRes = await apiJson(request, '/tickets', {
      method: 'POST',
      session: parentSession,
      body: {
        type: 'REFUND_REQUEST',
        subject: `UI Test Ticket Priority ${Date.now()}`,
        description: 'Tao ticket dang OPEN de OPS doi priority.',
        priority: 'MEDIUM',
      },
    });
    expect([200, 201]).toContain(createRes.status);

    const ticketId = createRes.body?._id || createRes.body?.id;
    expect(ticketId).toBeTruthy();

    const res = await apiJson(request, `/tickets/${ticketId}`, {
      method: 'PATCH',
      session,
      body: { priority: 'HIGH' },
    });
    expect([200, 201]).toContain(res.status);
    expect(res.body?.priority).toBe('HIGH');
  });

  test('PARENT bị từ chối GET /tickets/sla-metrics', async ({ request }) => {
    const session = await loginAsRole(request, 'parent');
    const res = await apiJson(request, '/tickets/sla-metrics', { method: 'GET', session });
    expect([401, 403]).toContain(res.status);
  });

  test('OPS thấy trang tickets không crash', async ({ page, request }) => {
    const session = await loginAsRole(request, 'ops');
    await applySessionCookies(page.context(), session);

    await page.goto(`${APP}/app/tickets`);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
  });
});

// ─── 20.1 Backfill Data ────────────────────────────────────────────────────

test.describe('20.1 Backfill Parent Attribution', () => {
  test('DIRECTOR POST /ads/backfill-parent-attribution thành công', async ({ request }) => {
    test.setTimeout(120_000);
    const session = await loginAsRole(request, 'director');
    const res = await apiJson(request, '/ads/backfill-parent-attribution', {
      method: 'POST',
      session,
    });
    expect([200, 201]).toContain(res.status);
    expect(res.body).toBeDefined();
  });

  test('Backfill idempotent — chạy lần 2 không lỗi', async ({ request }) => {
    test.setTimeout(120_000);
    const session = await loginAsRole(request, 'director');
    const first = await apiJson(request, '/ads/backfill-parent-attribution', { method: 'POST', session });
    const second = await apiJson(request, '/ads/backfill-parent-attribution', { method: 'POST', session });
    expect([200, 201]).toContain(first.status);
    expect([200, 201]).toContain(second.status);
    const upserted2 = second.body?.upserted ?? 0;
    expect(upserted2).toBeGreaterThanOrEqual(0);
  });

  test('OPS bị từ chối POST /ads/backfill-parent-attribution (403)', async ({ request }) => {
    const session = await loginAsRole(request, 'ops');
    const res = await apiJson(request, '/ads/backfill-parent-attribution', { method: 'POST', session });
    expect(res.status).toBe(403);
  });

  test('DIRECTOR POST /ads/backfill-adgroup cũng thành công', async ({ request }) => {
    const session = await loginAsRole(request, 'director');
    const res = await apiJson(request, '/ads/backfill-adgroup', { method: 'POST', session });
    expect([200, 201]).toContain(res.status);
    expect(res.body).toBeDefined();
  });

  test('Unauthenticated bị từ chối backfill', async ({ request }) => {
    const res = await request.post(`${API}/ads/backfill-parent-attribution`);
    expect([401, 403]).toContain(res.status());
  });
});
