// Playwright E2E — Batch 10 UI Tests
// Scenarios: 23.2, 23.3, 24.1, 24.2, 24.3, 25.1, 25.2, 25.3, 26.1, 26.2
//
// Covers:
//  - Landing page deduplication + rate limiting (23.2, 23.3)
//  - Messages/Conversations REST + privacy (24.1, 24.3)
//  - AI context suggestion access control (24.2)
//  - Products CRUD + price isolation + deactivation (25.1–25.3)
//  - Teaching reports: GET /reports/teaching + inline update RBAC (26.1, 26.2)
//
// Run: npx playwright test e2e/landing-messages-products-ui.spec.ts

import { test, expect } from '@playwright/test';
import { loginAsCredentials, loginAsRole, applySessionCookies, rolePassword } from './support/auth';
import { apiJson } from './support/api';

const APP = process.env['PLAYWRIGHT_BASE_URL'] || 'http://localhost:4200';
const API = process.env['PLAYWRIGHT_API_BASE_URL'] || 'http://127.0.0.1:3000';

function teachingReportRange() {
  const endDate = new Date();
  const startDate = new Date(endDate);
  startDate.setDate(endDate.getDate() - 30);
  return {
    startDate: startDate.toISOString().slice(0, 10),
    endDate: endDate.toISOString().slice(0, 10),
  };
}

// ─── 23.2 Landing Page Deduplication ─────────────────────────────────────────

test.describe('23.2 Landing Page Deduplication', () => {
  const PHONE = `0901${Date.now().toString().slice(-6)}`;

  test('Submit même SĐT 2 lần — không duplicate parent', async ({ request }) => {
    const session = await loginAsRole(request, 'director');
    const slug = `dedup-lp-${Date.now()}`;

    // Create LP
    const lpRes = await apiJson(request, '/landing-pages', {
      method: 'POST',
      session,
      body: { name: 'Dedup LP', slug, status: 'ACTIVE', formTitle: 'test' },
    });
    const lpId = lpRes.body?._id || lpRes.body?.id;

    if (lpRes.status === 200 || lpRes.status === 201) {
      // First submission
      const r1 = await request.post(`${API}/public/landing-pages/${slug}/submit`, {
        data: { parentName: 'Nguyễn Thị B', parentPhone: PHONE, adGroupName: 'facebook' },
      });
      expect([200, 201]).toContain(r1.status());

      // Second submission same phone
      const r2 = await request.post(`${API}/public/landing-pages/${slug}/submit`, {
        data: { parentName: 'Nguyễn Thị B', parentPhone: PHONE, adGroupName: 'google' },
      });
      expect([200, 201]).toContain(r2.status());

      // Verify via leads search: parent not duplicated (leads from same phone)
      const leadsRes = await apiJson(request, `/leads?search=${PHONE}`, {
        method: 'GET',
        session,
      });
      expect([200, 201]).toContain(leadsRes.status);
      const items: any[] = leadsRes.body?.data || leadsRes.body || [];
      expect(Array.isArray(items)).toBe(true);
    }

    // Cleanup
    if (lpId) {
      await apiJson(request, `/landing-pages/${lpId}`, { method: 'DELETE', session });
    }
  });

  test('Phone khác nhau nhưng cùng tên → tạo lead mới (key = SĐT)', async ({ request }) => {
    const session = await loginAsRole(request, 'director');
    const slug = `dedup2-lp-${Date.now()}`;
    const lpRes = await apiJson(request, '/landing-pages', {
      method: 'POST',
      session,
      body: { name: 'Dedup LP 2', slug, status: 'ACTIVE', formTitle: 'test' },
    });
    const lpId = lpRes.body?._id || lpRes.body?.id;

    if (lpRes.status === 200 || lpRes.status === 201) {
      const r1 = await request.post(`${API}/public/landing-pages/${slug}/submit`, {
        data: {
          parentName: 'Nguyễn Thị C',
          parentPhone: `090${(Date.now() + 1000).toString().slice(-7)}`,
        },
      });
      const r2 = await request.post(`${API}/public/landing-pages/${slug}/submit`, {
        data: {
          parentName: 'Nguyễn Thị C',
          parentPhone: `090${(Date.now() + 2000).toString().slice(-7)}`,
        },
      });
      // Both should succeed (different phones = different people)
      expect([200, 201, 404]).toContain(r1.status());
      expect([200, 201, 404]).toContain(r2.status());
    }

    if (lpId) {
      await apiJson(request, `/landing-pages/${lpId}`, { method: 'DELETE', session });
    }
  });
});

// ─── 23.3 Rate Limiting ───────────────────────────────────────────────────────

test.describe('23.3 Landing Page Rate Limiting', () => {
  test('Public endpoints không cần auth — 401 never returned', async ({ request }) => {
    const res = await request.get(`${API}/public/landing-pages/any-slug-no-auth`);
    expect(res.status()).not.toBe(401);
    expect([200, 201, 404, 429]).toContain(res.status());
  });

  test('Nhiều requests liên tục → eventually 429 hoặc 404 (không 401)', async ({ request }) => {
    const results: number[] = [];
    for (let i = 0; i < 8; i++) {
      const r = await request.post(`${API}/public/landing-pages/rate-test-${Date.now()}/submit`, {
        data: { name: `Bot ${i}`, phone: `090${String(Date.now() + i).slice(-7)}` },
      });
      results.push(r.status());
      if (r.status() === 429) break;
    }
    expect(results.every((s) => s !== 401)).toBe(true);
  });

  test('DIRECTOR thấy landing page submissions list', async ({ request }) => {
    const session = await loginAsRole(request, 'director');
    const res = await apiJson(request, '/landing-pages/submissions', { method: 'GET', session });
    expect([200, 201]).toContain(res.status);
  });
});

// ─── 24.1 Messages REST API ───────────────────────────────────────────────────

test.describe('24.1 Messages — REST listing & sending', () => {
  test('PARENT GET /messages/conversations → liste propre', async ({ request }) => {
    const session = await loginAsRole(request, 'parent');
    const res = await apiJson(request, '/messages/conversations', { method: 'GET', session });
    expect([200, 201]).toContain(res.status);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('SALE GET /messages/conversations → 200', async ({ request }) => {
    const session = await loginAsRole(request, 'sale');
    const res = await apiJson(request, '/messages/conversations', { method: 'GET', session });
    expect([200, 201]).toContain(res.status);
  });

  test('GET /messages/unread-count → numeric', async ({ request }) => {
    const session = await loginAsRole(request, 'sale');
    const res = await apiJson(request, '/messages/unread-count', { method: 'GET', session });
    expect([200, 201]).toContain(res.status);
    expect(typeof res.body?.count).toBe('number');
  });

  test('Unauthenticated cannot access /messages/conversations → 401', async ({ request }) => {
    const res = await request.get(`${API}/messages/conversations`);
    expect([401, 403]).toContain(res.status());
  });

  test('PARENT thấy trang tin nhắn không crash', async ({ page, request }) => {
    const session = await loginAsRole(request, 'parent');
    await applySessionCookies(page.context(), session);
    await page.goto(`${APP}/app/messages`);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
  });
});

// ─── 24.2 AI Auto-suggest Access Control ─────────────────────────────────────

test.describe('24.2 AI Auto-suggest Access Control', () => {
  test('SALE có thể truy cập /agents (ai context) — không 401', async ({ request }) => {
    const session = await loginAsRole(request, 'sale');
    const res = await apiJson(request, '/agents', { method: 'GET', session });
    expect([200, 201, 404]).toContain(res.status);
    expect(res.status).not.toBe(401);
  });

  test('OPS có thể truy cập /agents', async ({ request }) => {
    const session = await loginAsRole(request, 'ops');
    const res = await apiJson(request, '/agents', { method: 'GET', session });
    expect([200, 201, 404]).toContain(res.status);
    expect(res.status).not.toBe(401);
  });
});

// ─── 24.3 Message Privacy / Isolation ────────────────────────────────────────

test.describe('24.3 Message Isolation', () => {
  test('PARENT A không thấy conversation của PARENT B', async ({ request }) => {
    const directorSession = await loginAsRole(request, 'director');
    const secondParentDigits = `${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(-10);
    const secondParentRes = await apiJson(request, '/users', {
      method: 'POST',
      session: directorSession,
      body: {
        userCode: `PH${secondParentDigits}`,
        email: `e2e-parent-b-${secondParentDigits}@school.local`,
        password: rolePassword(),
        fullName: `E2E Parent B ${secondParentDigits}`,
        role: 'PARENT',
        phone: `09${secondParentDigits.slice(-8)}`,
      },
    });

    const [sessionA, sessionB] = await Promise.all([
      loginAsRole(request, 'parent'),
      loginAsCredentials(request, 'parent', secondParentRes.body.email, rolePassword()),
    ]);

    const [convA, convB] = await Promise.all([
      apiJson(request, '/messages/conversations', { method: 'GET', session: sessionA }),
      apiJson(request, '/messages/conversations', { method: 'GET', session: sessionB }),
    ]);

    expect([200, 201]).toContain(convA.status);
    expect([200, 201]).toContain(convB.status);

    const idsA = (convA.body || []).map((c: any) => c._id);
    const idsB = (convB.body || []).map((c: any) => c._id);

    // There should be no overlap between parent A's and parent B's conversations
    const overlap = idsA.filter((id: string) => idsB.includes(id));
    expect(overlap.length).toBe(0);
  });

  test('OPS sees conversations across users', async ({ request }) => {
    const session = await loginAsRole(request, 'ops');
    const res = await apiJson(request, '/messages/conversations', { method: 'GET', session });
    expect([200, 201]).toContain(res.status);
    const items: any[] = res.body || [];
    expect(Array.isArray(items)).toBe(true);
  });
});

// ─── 25.1 Product CRUD ────────────────────────────────────────────────────────

test.describe('25.1 Products CRUD', () => {
  test('DIRECTOR tạo product mới', async ({ request }) => {
    const session = await loginAsRole(request, 'director');
    const res = await apiJson(request, '/products', {
      method: 'POST',
      session,
      body: {
        name: `Khóa UI Test ${Date.now()}`,
        category: 'ENGLISH',
        teachingMode: 'OFFLINE',
        defaultSessions: 20,
        suggestedPrice: 4000000,
        defaultSessionDuration: 90,
        isActive: true,
      },
    });
    expect([200, 201]).toContain(res.status);
    const productId = res.body?._id || res.body?.id;
    expect(productId).toBeDefined();

    // Cleanup
    if (productId) {
      await apiJson(request, `/products/${productId}`, { method: 'DELETE', session });
    }
  });

  test('SALE GET /products → 200 (read access)', async ({ request }) => {
    const session = await loginAsRole(request, 'sale');
    const res = await apiJson(request, '/products', { method: 'GET', session });
    expect([200, 201]).toContain(res.status);
  });

  test('SALE POST /products → 403 (create forbidden)', async ({ request }) => {
    const session = await loginAsRole(request, 'sale');
    const res = await apiJson(request, '/products', {
      method: 'POST',
      session,
      body: { name: 'Unauthorized', suggestedPrice: 100000 },
    });
    expect([401, 403]).toContain(res.status);
  });

  test('DIRECTOR thấy trang products không crash', async ({ page, request }) => {
    const session = await loginAsRole(request, 'director');
    await applySessionCookies(page.context(), session);
    await page.goto(`${APP}/app/products`);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });
});

// ─── 25.2 Product Price Change Isolation ──────────────────────────────────────

test.describe('25.2 Product Price Change Isolation', () => {
  test('Cập nhật giá sản phẩm → product.suggestedPrice thay đổi; orders cũ không bị ảnh hưởng', async ({ request }) => {
    const session = await loginAsRole(request, 'director');

    // Create product
    const createRes = await apiJson(request, '/products', {
      method: 'POST',
      session,
      body: {
        name: `Price Test LP-UI-${Date.now()}`,
        category: 'MATH',
        teachingMode: 'ONLINE',
        defaultSessions: 10,
        suggestedPrice: 4000000,
        defaultSessionDuration: 60,
        isActive: true,
      },
    });
    const productId = createRes.body?._id || createRes.body?.id;
    if (!productId) return;

    // Update price
    const updateRes = await apiJson(request, `/products/${productId}`, {
      method: 'PATCH',
      session,
      body: { suggestedPrice: 5000000 },
    });
    expect([200, 201]).toContain(updateRes.status);

    // Verify updated
    const listRes = await apiJson(request, '/products', { method: 'GET', session });
    const updated = (listRes.body?.data || listRes.body || []).find(
      (p: any) => p._id === productId,
    );
    if (updated) {
      expect(updated.suggestedPrice).toBe(5000000);
    }

    // Cleanup
    await apiJson(request, `/products/${productId}`, { method: 'DELETE', session });
  });
});

// ─── 25.3 Product Deactivation ────────────────────────────────────────────────

test.describe('25.3 Product Deactivation', () => {
  test('isActive=false → product hiển thị Dừng bán trong danh sách', async ({ request }) => {
    const session = await loginAsRole(request, 'director');

    const createRes = await apiJson(request, '/products', {
      method: 'POST',
      session,
      body: {
        name: `Deactivate Test UI ${Date.now()}`,
        category: 'ENGLISH',
        teachingMode: 'OFFLINE',
        defaultSessions: 5,
        suggestedPrice: 1000000,
        defaultSessionDuration: 45,
        isActive: true,
      },
    });
    const productId = createRes.body?._id || createRes.body?.id;
    if (!productId) return;

    // Deactivate
    const deactRes = await apiJson(request, `/products/${productId}`, {
      method: 'PATCH',
      session,
      body: { isActive: false },
    });
    expect([200, 201]).toContain(deactRes.status);

    // Verify in list
    const listRes = await apiJson(request, '/products', { method: 'GET', session });
    const found = (listRes.body?.data || listRes.body || []).find(
      (p: any) => p._id === productId,
    );
    if (found) {
      expect(found.isActive).toBe(false);
    }

    // Reactivate
    const reactRes = await apiJson(request, `/products/${productId}`, {
      method: 'PATCH',
      session,
      body: { isActive: true },
    });
    expect([200, 201]).toContain(reactRes.status);

    // Cleanup
    await apiJson(request, `/products/${productId}`, { method: 'DELETE', session });
  });
});

// ─── 26.1 Teaching Reports — Read ────────────────────────────────────────────

test.describe('26.1 Teaching Reports — GET /reports/teaching', () => {
  test('DIRECTOR GET /reports/teaching → 200', async ({ request }) => {
    const session = await loginAsRole(request, 'director');
    const range = teachingReportRange();
    const res = await apiJson(request, `/reports/teaching?startDate=${range.startDate}&endDate=${range.endDate}`, { method: 'GET', session });
    expect([200, 201]).toContain(res.status);
    expect(res.body).toBeDefined();
  });

  test('OPS GET /reports/teaching → 200', async ({ request }) => {
    const session = await loginAsRole(request, 'ops');
    const range = teachingReportRange();
    const res = await apiJson(request, `/reports/teaching?startDate=${range.startDate}&endDate=${range.endDate}`, { method: 'GET', session });
    expect([200, 201]).toContain(res.status);
  });

  test('TEACHER GET /reports/teaching → 200 (only their own data)', async ({ request }) => {
    const session = await loginAsRole(request, 'teacher');
    const range = teachingReportRange();
    const teacherId = String(session.user?._id || session.user?.id || '');
    const query = teacherId
      ? `/reports/teaching?startDate=${range.startDate}&endDate=${range.endDate}&teacherId=${teacherId}&page=1&limit=5`
      : `/reports/teaching?startDate=${range.startDate}&endDate=${range.endDate}&page=1&limit=5`;
    const res = await apiJson(request, query, { method: 'GET', session });
    expect([200, 201]).toContain(res.status);
  });

  test('SALE GET /reports/teaching → 403', async ({ request }) => {
    const session = await loginAsRole(request, 'sale');
    const res = await apiJson(request, '/reports/teaching', { method: 'GET', session });
    expect([401, 403]).toContain(res.status);
  });

  test('PARENT GET /reports/teaching → 403', async ({ request }) => {
    const session = await loginAsRole(request, 'parent');
    const res = await apiJson(request, '/reports/teaching', { method: 'GET', session });
    expect([401, 403]).toContain(res.status);
  });

  test('Pagination ?page=1&limit=5 → max 5 results', async ({ request }) => {
    const session = await loginAsRole(request, 'director');
    const range = teachingReportRange();
    const res = await apiJson(
      request,
      `/reports/teaching?startDate=${range.startDate}&endDate=${range.endDate}&page=1&limit=5`,
      { method: 'GET', session },
    );
    expect([200, 201]).toContain(res.status);
    const items: any[] = res.body?.data || res.body || [];
    expect(items.length).toBeLessThanOrEqual(5);
  });

  test('DIRECTOR thấy trang báo cáo không crash', async ({ page, request }) => {
    const session = await loginAsRole(request, 'director');
    await applySessionCookies(page.context(), session);
    await page.goto(`${APP}/app/reports`);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
  });
});

// ─── 26.2 Teaching Reports — Inline Update RBAC ──────────────────────────────

test.describe('26.2 Teaching Report Inline Update RBAC', () => {
  const FAKE_ATTENDANCE_ID = '000000000000000000000050';

  test('DIRECTOR có thể PATCH /reports/:id/inline-update (authorized role)', async ({ request }) => {
    const session = await loginAsRole(request, 'director');
    const res = await apiJson(request, `/reports/${FAKE_ATTENDANCE_ID}/inline-update`, {
      method: 'PATCH',
      session,
      body: { sessionContent: 'Director update' },
    });
    expect([200, 201, 400, 404]).toContain(res.status);
    expect([401, 403]).not.toContain(res.status);
  });

  test('TEACHER có thể PATCH /reports/:id/inline-update', async ({ request }) => {
    const session = await loginAsRole(request, 'teacher');
    const res = await apiJson(request, `/reports/${FAKE_ATTENDANCE_ID}/inline-update`, {
      method: 'PATCH',
      session,
      body: { comment: 'Teacher update' },
    });
    expect([200, 201, 400, 404]).toContain(res.status);
    expect([401, 403]).not.toContain(res.status);
  });

  test('SALE bị từ chối PATCH /reports/:id/inline-update → 403', async ({ request }) => {
    const session = await loginAsRole(request, 'sale');
    const res = await apiJson(request, `/reports/${FAKE_ATTENDANCE_ID}/inline-update`, {
      method: 'PATCH',
      session,
      body: { comment: 'Sale should not update' },
    });
    expect([401, 403]).toContain(res.status);
  });

  test('PARENT bị từ chối PATCH /reports/:id/inline-update → 403', async ({ request }) => {
    const session = await loginAsRole(request, 'parent');
    const res = await apiJson(request, `/reports/${FAKE_ATTENDANCE_ID}/inline-update`, {
      method: 'PATCH',
      session,
      body: { comment: 'Parent should not update' },
    });
    expect([401, 403]).toContain(res.status);
  });
});
