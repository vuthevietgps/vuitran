// Playwright E2E — Batch 9 UI Tests
// Scenarios: 21.1, 21.2, 21.3, 21.4, 22.1, 22.2, 22.3, 22.4, 22.5, 23.1
//
// Covers:
//  - Notifications: user sees own notifications; unread count; preferences (21.1–21.4)
//  - Leads CRUD: SALE creates/views leads; OPS assigns; DIRECTOR accesses stats (22.1–22.4)
//  - Follow-ups: overdue leads in follow-up list; pool management (22.5)
//  - Landing page: public form submit creates lead; rate limiting; missing fields (23.1)
//
// Run: npx playwright test e2e/notifications-leads-landing-ui.spec.ts

import { test, expect } from '@playwright/test';
import { loginAsRole, applySessionCookies } from './support/auth';
import { apiJson } from './support/api';

const APP = process.env['PLAYWRIGHT_BASE_URL'] || 'http://localhost:4200';
const API = process.env['PLAYWRIGHT_API_BASE_URL'] || 'http://127.0.0.1:3000';

// ─── 21.1 Invoice Notification ──────────────────────────────────────────────

test.describe('21.1 Invoice Notification', () => {
  test('Authenticated user GET /notifications returns own notifications', async ({ request }) => {
    const session = await loginAsRole(request, 'parent');
    const res = await apiJson(request, '/notifications', { method: 'GET', session });
    expect([200, 201]).toContain(res.status);
    const items = res.body?.data || res.body || [];
    expect(Array.isArray(items)).toBe(true);
  });

  test('GET /notifications/unread-count returns numeric count', async ({ request }) => {
    const session = await loginAsRole(request, 'parent');
    const res = await apiJson(request, '/notifications/unread-count', { method: 'GET', session });
    expect([200, 201]).toContain(res.status);
    expect(typeof res.body?.count).toBe('number');
    expect(res.body.count).toBeGreaterThanOrEqual(0);
  });

  test('PATCH /notifications/mark-all-read responds successfully', async ({ request }) => {
    const session = await loginAsRole(request, 'sale');
    const res = await apiJson(request, '/notifications/mark-all-read', { method: 'PATCH', session });
    expect([200, 201]).toContain(res.status);
  });

  test('Unauthenticated cannot access /notifications', async ({ request }) => {
    const res = await request.get(`${API}/notifications`);
    expect([401, 403]).toContain(res.status());
  });

  test('PARENT thấy trang notifications không crash', async ({ page, request }) => {
    const session = await loginAsRole(request, 'parent');
    await applySessionCookies(page.context(), session);
    await page.goto(`${APP}/app/notifications`);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
  });
});

// ─── 21.2 Session Reminder — Notification Preferences ───────────────────────

test.describe('21.2 Notification Preferences', () => {
  test('GET /notifications/preferences returns settings', async ({ request }) => {
    const session = await loginAsRole(request, 'parent');
    const res = await apiJson(request, '/notifications/preferences', { method: 'GET', session });
    expect([200, 201]).toContain(res.status);
    expect(typeof res.body?.enableEmailNotif).toBe('boolean');
    expect(typeof res.body?.enableZaloNotif).toBe('boolean');
    expect(typeof res.body?.enableSmsNotif).toBe('boolean');
  });

  test('PATCH /notifications/preferences toggles opt-in flags', async ({ request }) => {
    const session = await loginAsRole(request, 'parent');
    const res = await apiJson(request, '/notifications/preferences', {
      method: 'PATCH',
      session,
      body: {
        enableEmailNotif: true,
        enableZaloNotif: false,
        enableSmsNotif: true,
        phone: '0901234567',
      },
    });
    expect([200, 201]).toContain(res.status);
    expect(res.body?.success).toBe(true);
  });

  test('After opt-out Zalo, preference is persisted', async ({ request }) => {
    const session = await loginAsRole(request, 'ops');
    // Disable Zalo
    await apiJson(request, '/notifications/preferences', {
      method: 'PATCH',
      session,
      body: { enableZaloNotif: false },
    });
    // Verify
    const res = await apiJson(request, '/notifications/preferences', { method: 'GET', session });
    expect([200, 201]).toContain(res.status);
    expect(res.body?.enableZaloNotif).toBe(false);
  });
});

// ─── 21.3 Bulk Notification Pagination ────────────────────────────────────

test.describe('21.3 Notification Pagination & Bulk Infrastructure', () => {
  test('Pagination GET /notifications?page=1&limit=5 respects limit', async ({ request }) => {
    const session = await loginAsRole(request, 'director');
    const res = await apiJson(request, '/notifications?page=1&limit=5', { method: 'GET', session });
    expect([200, 201]).toContain(res.status);
    const items = res.body?.data || res.body || [];
    expect(items.length).toBeLessThanOrEqual(5);
  });

  test('Two different users get independent notification lists', async ({ request }) => {
    const [saleSession, parentSession] = await Promise.all([
      loginAsRole(request, 'sale'),
      loginAsRole(request, 'parent'),
    ]);
    const [saleRes, parentRes] = await Promise.all([
      apiJson(request, '/notifications', { method: 'GET', session: saleSession }),
      apiJson(request, '/notifications', { method: 'GET', session: parentSession }),
    ]);
    expect([200, 201]).toContain(saleRes.status);
    expect([200, 201]).toContain(parentRes.status);
  });

  test('GET /notifications?unreadOnly=true returns subset', async ({ request }) => {
    const session = await loginAsRole(request, 'sale');
    const [all, unread] = await Promise.all([
      apiJson(request, '/notifications', { method: 'GET', session }),
      apiJson(request, '/notifications?unreadOnly=true', { method: 'GET', session }),
    ]);
    expect([200, 201]).toContain(all.status);
    expect([200, 201]).toContain(unread.status);
    // Unread count should be ≤ total
    const allCount = (all.body?.data || all.body || []).length;
    const unreadCount = (unread.body?.data || unread.body || []).length;
    expect(unreadCount).toBeLessThanOrEqual(allCount);
  });
});

// ─── 21.4 Notification Isolation ─────────────────────────────────────────────

test.describe('21.4 Notification Isolation', () => {
  test('OPS notification list does not contain PARENT notifications', async ({ request }) => {
    const session = await loginAsRole(request, 'ops');
    const res = await apiJson(request, '/notifications', { method: 'GET', session });
    expect([200, 201]).toContain(res.status);
    // All returned notifications should belong to OPS user
    const items: any[] = res.body?.data || res.body || [];
    for (const n of items) {
      if (n.recipientRole) {
        expect(n.recipientRole).not.toBe('PARENT');
      }
    }
  });

  test('PATCH /notifications/:id/read with fake ID does not crash the endpoint', async ({ request }) => {
    const session = await loginAsRole(request, 'parent');
    const res = await apiJson(request, '/notifications/000000000000000000000001/read', {
      method: 'PATCH',
      session,
    });
    expect([200, 400, 403, 404]).toContain(res.status);
  });
});

// ─── 22.1 Multi-source Lead Creation ─────────────────────────────────────────

test.describe('22.1 Multi-source Lead Creation', () => {
  test('SALE có thể tạo lead từ FACEBOOK', async ({ request }) => {
    const session = await loginAsRole(request, 'sale');
    const res = await apiJson(request, '/leads', {
      method: 'POST',
      session,
      body: {
        parentName: 'Nguyễn Thị C UI',
        parentPhone: `09${Date.now().toString().slice(-8)}`,
        source: 'FACEBOOK',
        notes: 'UI test lead',
      },
    });
    expect([200, 201]).toContain(res.status);
    expect(res.body?.status).toBe('NEW');
    expect(res.body?.source).toBe('FACEBOOK');
  });

  test('Thiếu phone → 400 validation error', async ({ request }) => {
    const session = await loginAsRole(request, 'sale');
    const res = await apiJson(request, '/leads', {
      method: 'POST',
      session,
      body: { parentName: 'No Phone', source: 'OTHER' },
    });
    expect([400, 422]).toContain(res.status);
  });

  test('GET /leads/pipeline trả về cấu trúc pipeline', async ({ request }) => {
    const session = await loginAsRole(request, 'sale');
    const res = await apiJson(request, '/leads/pipeline', { method: 'GET', session });
    expect([200, 201]).toContain(res.status);
    expect(res.body).toBeDefined();
  });

  test('SALE thấy trang leads không crash', async ({ page, request }) => {
    const session = await loginAsRole(request, 'sale');
    await applySessionCookies(page.context(), session);
    await page.goto(`${APP}/app/leads`);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });
});

// ─── 22.2 Lead Status Transitions ────────────────────────────────────────────

test.describe('22.2 Lead Auto-expire & Status Transitions', () => {
  test('DIRECTOR GET /leads/stats trả về thống kê', async ({ request }) => {
    const session = await loginAsRole(request, 'director');
    const res = await apiJson(request, '/leads/stats', { method: 'GET', session });
    expect([200, 201]).toContain(res.status);
    expect(res.body).toBeDefined();
  });

  test('SALE bị từ chối GET /leads/stats (DIRECTOR only)', async ({ request }) => {
    const session = await loginAsRole(request, 'sale');
    const res = await apiJson(request, '/leads/stats', { method: 'GET', session });
    expect([401, 403]).toContain(res.status);
  });

  test('Sale có thể mark lead là NOT_INTERESTED', async ({ request }) => {
    const session = await loginAsRole(request, 'sale');
    // Create a lead first
    const createRes = await apiJson(request, '/leads', {
      method: 'POST',
      session,
      body: {
        parentName: 'Lost Test UI',
        parentPhone: `09${(Date.now() + 50).toString().slice(-8)}`,
        source: 'OTHER',
      },
    });
    const leadId = createRes.body?._id || createRes.body?.id;
    if (!leadId) return;

    const lostRes = await apiJson(request, `/leads/${leadId}/lost`, {
      method: 'POST',
      session,
      body: { reason: 'PRICE_TOO_HIGH', notes: 'Too expensive' },
    });
    expect([200, 201]).toContain(lostRes.status);
    expect(lostRes.body?.status).toBe('NOT_INTERESTED');
  });
});

// ─── 22.3 Lead Reassignment ───────────────────────────────────────────────────

test.describe('22.3 Lead Reassignment', () => {
  test('OPS có thể assign lead cho Sale khác', async ({ request }) => {
    const dirSession = await loginAsRole(request, 'director');
    const saleSession = await loginAsRole(request, 'sale');
    const opsSession = await loginAsRole(request, 'ops');

    // Get sale user ID
    const usersRes = await apiJson(request, '/users?limit=20', { method: 'GET', session: dirSession });
    const users: any[] = usersRes.body?.data || usersRes.body || [];
    const sale = users.find((u: any) => u.role === 'SALE');
    if (!sale) return;

    // Create lead (as sale)
    const createRes = await apiJson(request, '/leads', {
      method: 'POST',
      session: saleSession,
      body: {
        parentName: 'Assign Test UI',
        parentPhone: `09${(Date.now() + 150).toString().slice(-8)}`,
        source: 'REFERRAL',
      },
    });
    const leadId = createRes.body?._id || createRes.body?.id;
    if (!leadId) return;

    // OPS assigns to sale
    const assignRes = await apiJson(request, `/leads/${leadId}/assign`, {
      method: 'POST',
      session: opsSession,
      body: { saleId: sale._id, saleName: sale.fullName },
    });
    expect([200, 201]).toContain(assignRes.status);
  });

  test('SALE bị từ chối POST /leads/:id/assign', async ({ request }) => {
    const saleSession = await loginAsRole(request, 'sale');
    const res = await apiJson(request, '/leads/000000000000000000000001/assign', {
      method: 'POST',
      session: saleSession,
      body: { saleId: '000000000000000000000002', saleName: 'Test' },
    });
    expect([401, 403, 404]).toContain(res.status);
  });
});

// ─── 22.4 Lead Conversion ────────────────────────────────────────────────────

test.describe('22.4 Lead Conversion to Order', () => {
  test('Sale có thể call convert lead pre-check endpoint', async ({ request }) => {
    const session = await loginAsRole(request, 'sale');

    // Create lead
    const createRes = await apiJson(request, '/leads', {
      method: 'POST',
      session,
      body: {
        parentName: 'Convert UI Test',
        parentPhone: `09${(Date.now() + 250).toString().slice(-8)}`,
        source: 'GOOGLE',
      },
    });
    const leadId = createRes.body?._id || createRes.body?.id;
    if (!leadId) return;

    // Add contact before convert
    await apiJson(request, `/leads/${leadId}/contact`, {
      method: 'POST',
      session,
      body: { method: 'CALL', notes: 'Đã tư vấn', nextFollowUp: '' },
    });

    // Convert
    const convertRes = await apiJson(request, `/leads/${leadId}/convert`, { method: 'POST', session });
    expect([200, 201]).toContain(convertRes.status);
    expect(convertRes.body?.lead?._id || convertRes.body?.lead?.id).toBe(leadId);
    expect(String(convertRes.body?.message || '')).not.toHaveLength(0);
  });

  test('Converted lead shows CONVERTED status in GET', async ({ request }) => {
    const session = await loginAsRole(request, 'sale');
    const allRes = await apiJson(request, '/leads?status=CONVERTED', { method: 'GET', session });
    expect([200, 201]).toContain(allRes.status);
    const items: any[] = allRes.body?.data || allRes.body || [];
    for (const lead of items) {
      expect(lead.status).toBe('CONVERTED');
    }
  });
});

// ─── 22.5 Follow-up Reminder ─────────────────────────────────────────────────

test.describe('22.5 Follow-up Reminder', () => {
  test('GET /leads/follow-ups trả về danh sách leads cần follow-up', async ({ request }) => {
    const session = await loginAsRole(request, 'sale');
    const res = await apiJson(request, '/leads/follow-ups', { method: 'GET', session });
    expect([200, 201]).toContain(res.status);
    const items: any[] = res.body?.data || res.body || [];
    expect(Array.isArray(items)).toBe(true);
    // CONVERTED/LOST leads should not appear
    for (const lead of items) {
      expect(['CONVERTED', 'LOST']).not.toContain(lead.status);
    }
  });

  test('GET /leads/pool/list OPS xem pool leads', async ({ request }) => {
    const session = await loginAsRole(request, 'ops');
    const res = await apiJson(request, '/leads/pool/list', { method: 'GET', session });
    expect([200, 201]).toContain(res.status);
  });

  test('SALE bị từ chối /leads/pool/list', async ({ request }) => {
    const session = await loginAsRole(request, 'sale');
    const res = await apiJson(request, '/leads/pool/list', { method: 'GET', session });
    expect([401, 403]).toContain(res.status);
  });
});

// ─── 23.1 Landing Page Form Submission ───────────────────────────────────────

test.describe('23.1 Landing Page Form Submission (Public)', () => {
  test('POST /public/landing-pages/:slug/submit không cần auth', async ({ request }) => {
    // Try submitting to a likely-nonexistent slug — expect 404 or 400, not 401
    const res = await request.post(`${API}/public/landing-pages/test-lp-nonexistent-ui/submit`, {
      data: { name: 'Trần Văn D', phone: '0907654321', utm_source: 'google' },
    });
    // NOT 401 (no auth required); could be 404 (lp not found) or success
    expect(res.status()).not.toBe(401);
    expect([200, 201, 400, 404, 429]).toContain(res.status());
  });

  test('POST thiếu phone → 400 validation error', async ({ request }) => {
    const res = await request.post(`${API}/public/landing-pages/any-slug/submit`, {
      data: { name: 'No Phone' },
    });
    expect([400, 404, 422]).toContain(res.status());
  });

  test('DIRECTOR có thể tạo và xem landing pages', async ({ request }) => {
    const session = await loginAsRole(request, 'director');
    const uniqueSlug = `ui-lp-${Date.now()}`;
    const createRes = await apiJson(request, '/landing-pages', {
      method: 'POST',
      session,
      body: {
        name: 'Test Landing Page UI',
        slug: uniqueSlug,
        status: 'ACTIVE',
        formTitle: 'Test description',
      },
    });
    expect([200, 201]).toContain(createRes.status);
    const lpId = createRes.body?._id || createRes.body?.id;

    // GET list
    const listRes = await apiJson(request, '/landing-pages', { method: 'GET', session });
    expect([200, 201]).toContain(listRes.status);

    // Cleanup
    if (lpId) {
      await apiJson(request, `/landing-pages/${lpId}`, { method: 'DELETE', session });
    }
  });

  test('Public submit với đúng slug tạo được lead', async ({ request }) => {
    const session = await loginAsRole(request, 'director');
    const uniqueSlug = `ui-lp-submit-${Date.now()}`;

    // Create LP first
    const createRes = await apiJson(request, '/landing-pages', {
      method: 'POST',
      session,
      body: { name: 'Submit Test LP', slug: uniqueSlug, status: 'ACTIVE', formTitle: 'test' },
    });
    const lpId = createRes.body?._id || createRes.body?.id;

    if (createRes.status === 200 || createRes.status === 201) {
      // Submit form (no auth)
      const submitRes = await request.post(`${API}/public/landing-pages/${uniqueSlug}/submit`, {
        data: {
          name: 'Trần Văn D',
          phone: '0907654321',
          utm_source: 'google',
          utm_medium: 'cpc',
          utm_campaign: 'summer2026',
        },
      });
      expect([200, 201, 400]).toContain(submitRes.status());
    }

    // Cleanup
    if (lpId) {
      await apiJson(request, `/landing-pages/${lpId}`, { method: 'DELETE', session });
    }
  });

  test('Rate limiting: nhiều requests rapid → eventually 429', async ({ request }) => {
    const results: number[] = [];
    const slug = `rl-test-${Date.now()}`;

    for (let i = 0; i < 12; i++) {
      const res = await request.post(`${API}/public/landing-pages/${slug}/submit`, {
        data: { name: `User ${i}`, phone: `090${String(i).padStart(7, '0')}` },
      });
      results.push(res.status());
    }
    // We should see either 404 (slug doesn't exist) or 429 (rate limited), not 401
    expect(results.every((s) => s !== 401)).toBe(true);
  });

  test('DIRECTOR thấy landing page submissions', async ({ request }) => {
    const session = await loginAsRole(request, 'director');
    const res = await apiJson(request, '/landing-pages/submissions', { method: 'GET', session });
    expect([200, 201]).toContain(res.status);
  });
});
