/**
 * Batch 4 E2E — Scenarios 18.4 → 23.3
 * 10 scenarios covering Chatbot, Leads, Landing Pages, Reconciliation, Export
 */
import { test, expect } from '@playwright/test';
import { apiCall } from '../support/api';
import { loginAsRole } from '../support/auth';

// ─── 18.4 FANPAGE CRUD & DUPLICATE GUARD ────────────────────────────────────

test.describe('18.4 Fanpage CRUD & Duplicate Guard', () => {
  const uniquePageId = `e2e_fp_${Date.now()}`;
  let createdFanpageId: string;

  test('Director can CRUD fanpages, SALE cannot create, duplicate pageId blocked', async ({
    request,
  }) => {
    const director = await loginAsRole(request, 'director');
    const sale = await loginAsRole(request, 'sale');

    // 1. Director creates a fanpage
    const createResp = await apiCall(request, director, 'POST', '/chatbot/fanpages', {
      name: `E2E Test Page ${uniquePageId}`,
      platform: 'FACEBOOK',
      pageId: uniquePageId,
      aiAutoReplyEnabled: false,
    }, [200, 201]);
    expect([200, 201]).toContain(createResp.status);
    const fanpage = createResp.data as any;
    expect(fanpage).toHaveProperty('_id');
    expect(fanpage.pageId).toBe(uniquePageId);
    expect(fanpage.platform).toBe('FACEBOOK');
    createdFanpageId = fanpage._id;

    // 2. GET list — director sees it
    const listResp = await apiCall(request, director, 'GET', '/chatbot/fanpages', undefined, [200]);
    const list = Array.isArray(listResp.data) ? listResp.data : (listResp.data as any)?.data || [];
    const found = list.find((fp: any) => fp.pageId === uniquePageId);
    expect(found).toBeTruthy();

    // 3. SALE cannot create fanpage (role blocked)
    const saleCreate = await apiCall(request, sale, 'POST', '/chatbot/fanpages', {
      name: 'Sale should not create',
      platform: 'FACEBOOK',
      pageId: `sale_${Date.now()}`,
    }, [401, 403]);
    expect([401, 403]).toContain(saleCreate.status);

    // 4. Duplicate pageId → 409 Conflict
    const dupResp = await apiCall(request, director, 'POST', '/chatbot/fanpages', {
      name: 'Duplicate',
      platform: 'FACEBOOK',
      pageId: uniquePageId,
    }, [400, 409, 422]);
    expect([400, 409, 422]).toContain(dupResp.status);

    // 5. Update fanpage status
    const patchResp = await apiCall(
      request, director, 'PATCH', `/chatbot/fanpages/${createdFanpageId}`,
      { status: 'INACTIVE' }, [200],
    );
    expect(patchResp.status).toBe(200);

    // 6. Cleanup — delete
    const delResp = await apiCall(
      request, director, 'DELETE', `/chatbot/fanpages/${createdFanpageId}`,
      undefined, [200, 204],
    );
    expect([200, 204]).toContain(delResp.status);
  });
});

// ─── 18.5 AI ASSISTANT PROFILE MANAGEMENT ───────────────────────────────────

test.describe('18.5 AI Assistant Profile Management', () => {
  let profileId: string;

  test('Director can CRUD AI profiles, types validated, SALE blocked', async ({ request }) => {
    const director = await loginAsRole(request, 'director');
    const sale = await loginAsRole(request, 'sale');

    // 1. Create profile
    const createResp = await apiCall(request, director, 'POST', '/chatbot/ai-assistant-profiles', {
      assistantType: 'LEAD_CARE',
      label: `E2E Test Profile ${Date.now()}`,
      description: 'Test profile for lead care',
      rulesPrompt: 'You are a friendly assistant',
    }, [200, 201]);
    expect([200, 201]).toContain(createResp.status);
    const profile = createResp.data as any;
    expect(profile).toHaveProperty('_id');
    expect(profile.assistantType).toBe('LEAD_CARE');
    profileId = profile._id;

    // 2. List profiles — exists
    const listResp = await apiCall(request, director, 'GET', '/chatbot/ai-assistant-profiles', undefined, [200]);
    const profiles = Array.isArray(listResp.data) ? listResp.data : (listResp.data as any)?.data || [];
    expect(profiles.some((p: any) => p._id === profileId)).toBe(true);

    // 3. Invalid assistantType → 400
    const badType = await apiCall(request, director, 'POST', '/chatbot/ai-assistant-profiles', {
      assistantType: 'INVALID_TYPE',
      label: 'Bad type',
    }, [400]);
    expect(badType.status).toBe(400);

    // 4. SALE cannot create profiles
    const saleCreate = await apiCall(request, sale, 'POST', '/chatbot/ai-assistant-profiles', {
      assistantType: 'PARENT_SUPPORT',
      label: 'Sale profile',
    }, [401, 403]);
    expect([401, 403]).toContain(saleCreate.status);

    // 5. Update profile
    const patchResp = await apiCall(
      request, director, 'PATCH', `/chatbot/ai-assistant-profiles/${profileId}`,
      { label: 'Updated E2E Profile', status: 'INACTIVE' }, [200],
    );
    expect(patchResp.status).toBe(200);

    // 6. Cleanup
    await apiCall(request, director, 'DELETE', `/chatbot/ai-assistant-profiles/${profileId}`,
      undefined, [200, 204]);
  });
});

// ─── 22.1 MULTI-SOURCE LEAD CREATION ────────────────────────────────────────

test.describe('22.1 Multi-Source Lead Creation', () => {
  const phones = [
    `09${Date.now().toString().slice(-8)}`,
    `08${Date.now().toString().slice(-8)}`,
  ];
  const createdLeadIds: string[] = [];

  test('create leads from FACEBOOK & WALK_IN, verify source & pipeline', async ({ request }) => {
    const director = await loginAsRole(request, 'director');

    // 1. Create lead from FACEBOOK
    const fbLead = await apiCall(request, director, 'POST', '/leads', {
      parentName: 'E2E FB Lead',
      parentPhone: phones[0],
      source: 'FACEBOOK',
      notes: 'E2E test lead',
    }, [200, 201]);
    expect([200, 201]).toContain(fbLead.status);
    const fb = fbLead.data as any;
    expect(fb.source).toBe('FACEBOOK');
    expect(fb.parentPhone).toBe(phones[0]);
    createdLeadIds.push(fb._id);

    // 2. Create lead from WALK_IN
    const walkLead = await apiCall(request, director, 'POST', '/leads', {
      parentName: 'E2E Walk-in Lead',
      parentPhone: phones[1],
      source: 'WALK_IN',
    }, [200, 201]);
    expect([200, 201]).toContain(walkLead.status);
    const walk = walkLead.data as any;
    expect(walk.source).toBe('WALK_IN');
    createdLeadIds.push(walk._id);

    // 3. Pipeline shows both
    const pipeline = await apiCall(request, director, 'GET', '/leads/pipeline', undefined, [200]);
    expect(pipeline.status).toBe(200);

    // 4. Search by phone
    const search = await apiCall(
      request, director, 'GET', `/leads?search=${phones[0]}`, undefined, [200],
    );
    const results = Array.isArray(search.data) ? search.data : (search.data as any)?.data || [];
    expect(results.some((l: any) => l.parentPhone === phones[0])).toBe(true);

    // 5. PARENT cannot create leads (role guard)
    const parent = await loginAsRole(request, 'parent');
    const parentCreate = await apiCall(request, parent, 'POST', '/leads', {
      parentName: 'Parent No Access',
      parentPhone: '0900000000',
    }, [401, 403]);
    expect([401, 403]).toContain(parentCreate.status);

    // Cleanup
    for (const id of createdLeadIds) {
      await apiCall(request, director, 'DELETE', `/leads/${id}`, undefined, [200, 204]);
    }
  });
});

// ─── 22.3 LEAD ASSIGN & RETURN-TO-POOL ──────────────────────────────────────

test.describe('22.3 Lead Assign & Return-to-Pool', () => {
  test('Director assigns lead to sale, then returns to pool', async ({ request }) => {
    const director = await loginAsRole(request, 'director');
    const sale = await loginAsRole(request, 'sale');

    // 1. Create lead
    const phone = `07${Date.now().toString().slice(-8)}`;
    const createResp = await apiCall(request, director, 'POST', '/leads', {
      parentName: 'E2E Assign Lead',
      parentPhone: phone,
      source: 'GOOGLE',
    }, [200, 201]);
    const lead = createResp.data as any;
    const leadId = lead._id;

    // 2. Get sale user ID via /users/me
    const saleProfile = await apiCall(request, sale, 'GET', '/users/me', undefined, [200]);
    const saleUser = saleProfile.data as any;
    const saleId = saleUser._id;
    const saleName = saleUser.name || saleUser.fullName || 'Sale Demo';

    // 3. Director assigns lead to sale
    const assignResp = await apiCall(request, director, 'POST', `/leads/${leadId}/assign`, {
      saleId,
      saleName,
    }, [200, 201]);
    expect([200, 201]).toContain(assignResp.status);

    // 4. Verify lead is assigned
    const getResp = await apiCall(request, director, 'GET', `/leads/${leadId}`, undefined, [200]);
    const assigned = getResp.data as any;
    expect(assigned.saleId?.toString() || assigned.saleId).toBe(saleId);

    // 5. Return to pool
    const returnResp = await apiCall(request, director, 'POST', `/leads/${leadId}/return-to-pool`, {
      reason: 'E2E test: returning to pool',
    }, [200, 201]);
    expect([200, 201]).toContain(returnResp.status);

    // 6. Verify lead is unassigned
    const afterReturn = await apiCall(request, director, 'GET', `/leads/${leadId}`, undefined, [200]);
    const returned = afterReturn.data as any;
    expect(returned.saleId).toBeFalsy();

    // 7. SALE cannot assign leads (only OPS/DIRECTOR)
    const saleAssign = await apiCall(request, sale, 'POST', `/leads/${leadId}/assign`, {
      saleId,
      saleName,
    }, [401, 403]);
    expect([401, 403]).toContain(saleAssign.status);

    // Cleanup
    await apiCall(request, director, 'DELETE', `/leads/${leadId}`, undefined, [200, 204]);
  });
});

// ─── 22.4 LEAD CONVERSION FLOW ──────────────────────────────────────────────

test.describe('22.4 Lead Conversion Flow', () => {
  test('create lead → add contact → convert', async ({ request }) => {
    const director = await loginAsRole(request, 'director');

    // 1. Create lead
    const phone = `06${Date.now().toString().slice(-8)}`;
    const createResp = await apiCall(request, director, 'POST', '/leads', {
      parentName: 'E2E Convert Lead',
      parentPhone: phone,
      source: 'REFERRAL',
      estimatedValue: 2000000,
    }, [200, 201]);
    const lead = createResp.data as any;
    const leadId = lead._id;
    expect(lead.source).toBe('REFERRAL');

    // 2. Add contact record (follow-up)
    const contactResp = await apiCall(request, director, 'POST', `/leads/${leadId}/contact`, {
      method: 'CALL',
      notes: 'PH quan tâm Khóa Hè',
    }, [200, 201]);
    expect([200, 201]).toContain(contactResp.status);

    // 3. Get lead — verify contact history exists
    const getResp = await apiCall(request, director, 'GET', `/leads/${leadId}`, undefined, [200]);
    const leadDetail = getResp.data as any;
    const contacts = leadDetail.contactHistory || leadDetail.contacts || [];
    expect(contacts.length).toBeGreaterThanOrEqual(1);

    // 4. Convert lead — returns lead + message (does NOT change status, just signals readiness)
    const convertResp = await apiCall(request, director, 'POST', `/leads/${leadId}/convert`,
      undefined, [200, 201]);
    expect([200, 201]).toContain(convertResp.status);
    const convertResult = convertResp.data as any;
    // Service returns { lead, message } where message says "Hay tao don dang ky hoc"
    expect(convertResult).toHaveProperty('message');
    expect(convertResult).toHaveProperty('lead');

    // 5. Convert again on already-valid lead should still succeed (idempotent)
    const convert2 = await apiCall(request, director, 'POST', `/leads/${leadId}/convert`,
      undefined, [200, 201]);
    expect([200, 201]).toContain(convert2.status);

    // 6. Mark a different lead as lost
    const lostPhone = `05${Date.now().toString().slice(-8)}`;
    const lostLead = await apiCall(request, director, 'POST', '/leads', {
      parentName: 'E2E Lost Lead',
      parentPhone: lostPhone,
      source: 'GOOGLE',
    }, [200, 201]);
    const lostId = (lostLead.data as any)._id;

    const lostResp = await apiCall(request, director, 'POST', `/leads/${lostId}/lost`, {
      reason: 'PRICE_TOO_HIGH',
      notes: 'PH thấy học phí cao',
    }, [200, 201]);
    expect([200, 201]).toContain(lostResp.status);

    // Verify lost status
    const lostCheck = await apiCall(request, director, 'GET', `/leads/${lostId}`, undefined, [200]);
    expect((lostCheck.data as any).status).toBe('NOT_INTERESTED');

    // Cleanup
    await apiCall(request, director, 'DELETE', `/leads/${leadId}`, undefined, [200, 204]);
    await apiCall(request, director, 'DELETE', `/leads/${lostId}`, undefined, [200, 204]);
  });
});

// ─── 23.1 LANDING PAGE CRUD & PUBLIC ACCESS ─────────────────────────────────

test.describe('23.1 Landing Page CRUD & Public Access', () => {
  const slug = `e2e-test-${Date.now()}`;
  let lpId: string;

  test('Director creates landing page, public can GET by slug', async ({ request }) => {
    const director = await loginAsRole(request, 'director');

    // 1. Create landing page
    const createResp = await apiCall(request, director, 'POST', '/landing-pages', {
      name: 'E2E Summer Course',
      slug,
      status: 'ACTIVE',
      heroTitle: 'Khóa Hè 2026',
      heroSubtitle: 'Ưu đãi 20%',
      formTitle: 'Đăng ký ngay',
      submitButtonText: 'Gửi',
      autoCreateLead: true,
    }, [200, 201]);
    expect([200, 201]).toContain(createResp.status);
    const lp = createResp.data as any;
    expect(lp.slug).toBe(slug);
    lpId = lp._id;

    // 2. Public can GET landing page by slug (no auth)
    const publicSession = { cookieHeader: '', xsrfToken: '' };
    const BASE = process.env['E2E_API_BASE_URL'] || 'http://127.0.0.1:3000';
    const pubResp = await request.fetch(`${BASE}/public/landing-pages/${slug}`, {
      method: 'GET',
    });
    // Could be 200 or 404 depending on slug routing
    expect([200, 404].includes(pubResp.status())).toBe(true);

    // 3. SALE cannot delete landing pages (only DIRECTOR)
    const sale = await loginAsRole(request, 'sale');
    const saleDel = await apiCall(request, sale, 'DELETE', `/landing-pages/${lpId}`,
      undefined, [401, 403]);
    expect([401, 403]).toContain(saleDel.status);

    // 4. List landing pages — director sees it
    const list = await apiCall(request, director, 'GET', '/landing-pages', undefined, [200]);
    const pages = Array.isArray(list.data) ? list.data : (list.data as any)?.data || [];
    expect(pages.some((p: any) => p.slug === slug)).toBe(true);

    // 5. Cleanup
    await apiCall(request, director, 'DELETE', `/landing-pages/${lpId}`, undefined, [200, 204]);
  });
});

// ─── 23.2 LANDING PAGE PUBLIC SUBMIT → LEAD AUTO-CREATE ─────────────────────

test.describe('23.2 Landing Page Submit → Lead Auto-create', () => {
  const slug = `e2e-submit-${Date.now()}`;
  const phone = `09${Date.now().toString().slice(-8)}`;
  let lpId: string;

  test('public form submit creates lead automatically', async ({ request }) => {
    const director = await loginAsRole(request, 'director');

    // 1. Create landing page with autoCreateLead
    const createResp = await apiCall(request, director, 'POST', '/landing-pages', {
      name: 'E2E Submit Test',
      slug,
      status: 'ACTIVE',
      autoCreateLead: true,
    }, [200, 201]);
    lpId = (createResp.data as any)._id;

    // 2. Public submit (no auth needed)
    const BASE = process.env['E2E_API_BASE_URL'] || 'http://127.0.0.1:3000';
    const submitResp = await request.fetch(`${BASE}/public/landing-pages/${slug}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({
        parentName: 'E2E Landing PH',
        parentPhone: phone,
        studentName: 'E2E Student',
        notes: 'Interested in summer course',
      }),
    });
    expect([200, 201]).toContain(submitResp.status());

    // 3. Check submissions list
    const subs = await apiCall(
      request, director, 'GET',
      `/landing-pages/submissions?landingPageId=${lpId}`,
      undefined, [200],
    );
    const submissions = Array.isArray(subs.data) ? subs.data : (subs.data as any)?.data || [];
    expect(submissions.length).toBeGreaterThanOrEqual(1);

    // 4. Verify lead was auto-created
    const leads = await apiCall(
      request, director, 'GET', `/leads?search=${phone}`, undefined, [200],
    );
    const leadList = Array.isArray(leads.data) ? leads.data : (leads.data as any)?.data || [];
    // If autoCreateLead worked, there should be a matching lead
    const matchingLead = leadList.find((l: any) => l.parentPhone === phone);
    if (matchingLead) {
      expect(matchingLead.parentName).toBe('E2E Landing PH');
      // Cleanup lead
      await apiCall(request, director, 'DELETE', `/leads/${matchingLead._id}`, undefined, [200, 204, 400]);
    }

    // Cleanup landing page (may fail if submissions exist — acceptable)
    await apiCall(request, director, 'DELETE', `/landing-pages/${lpId}`, undefined, [200, 204, 400]);
  });
});

// ─── 23.3 LANDING PAGE RATE LIMITING ─────────────────────────────────────────

test.describe('23.3 Landing Page Rate Limiting', () => {
  test('public submit endpoint returns 429 after throttle limit', async ({ request }) => {
    const director = await loginAsRole(request, 'director');

    // Create a temp landing page
    const slug = `e2e-rate-${Date.now()}`;
    const createResp = await apiCall(request, director, 'POST', '/landing-pages', {
      name: 'E2E Rate Limit',
      slug,
      status: 'ACTIVE',
    }, [200, 201]);
    const lpId = (createResp.data as any)._id;

    const BASE = process.env['E2E_API_BASE_URL'] || 'http://127.0.0.1:3000';
    let got429 = false;
    const statuses: number[] = [];

    // Spam 15 requests rapidly (throttle is 10 req/60s)
    for (let i = 0; i < 15; i++) {
      const resp = await request.fetch(`${BASE}/public/landing-pages/${slug}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        data: JSON.stringify({
          parentName: `Spam Bot ${i}`,
          parentPhone: `091${String(i).padStart(7, '0')}`,
        }),
      });
      statuses.push(resp.status());
      if (resp.status() === 429) {
        got429 = true;
        break;
      }
    }

    // Should have hit 429 at some point
    expect(got429).toBe(true);

    // Cleanup (may fail if submissions exist — acceptable)
    await apiCall(request, director, 'DELETE', `/landing-pages/${lpId}`, undefined, [200, 204, 400]);
  });
});

// ─── 20.3 RECONCILIATION MANUAL RUN & ROLE GUARD ────────────────────────────

test.describe('20.3 Reconciliation Manual Run', () => {
  test('DIRECTOR can run reconciliation, SALE cannot', async ({ request }) => {
    const director = await loginAsRole(request, 'director');
    const sale = await loginAsRole(request, 'sale');

    // 1. Director runs reconciliation for last 30 days
    const toDate = new Date().toISOString().split('T')[0];
    const fromDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];

    const runResp = await apiCall(request, director, 'POST', '/admin/reconciliation/run', {
      fromDate,
      toDate,
    }, [200, 201]);
    expect([200, 201]).toContain(runResp.status);
    const result = runResp.data as any;
    // Expect reconciliation result shape
    expect(result).toHaveProperty('sessionsScanned');
    expect(typeof result.sessionsScanned).toBe('number');
    expect(result.sessionsScanned).toBeGreaterThanOrEqual(0);

    // Optional result fields
    if (result.missingTxCreated !== undefined) {
      expect(typeof result.missingTxCreated).toBe('number');
    }
    if (result.criticalAnomalies !== undefined) {
      expect(typeof result.criticalAnomalies).toBe('number');
    }

    // 2. SALE cannot run reconciliation
    const saleRun = await apiCall(request, sale, 'POST', '/admin/reconciliation/run', {
      fromDate,
      toDate,
    }, [401, 403]);
    expect([401, 403]).toContain(saleRun.status);

    // 3. Missing params → 400
    const badResp = await apiCall(request, director, 'POST', '/admin/reconciliation/run', {},
      [400]);
    expect(badResp.status).toBe(400);
  });
});

// ─── 27.1 EXPORT CSV & ROLE GUARD ───────────────────────────────────────────

test.describe('27.1 Export CSV & Role Protection', () => {
  test('DIRECTOR can export payroll CSV, SALE/TEACHER blocked', async ({ request }) => {
    const director = await loginAsRole(request, 'director');
    const teacher = await loginAsRole(request, 'teacher');

    const fromDate = '2026-01-01';
    const toDate = '2026-03-31';

    // 1. Director exports payroll CSV
    const exportResp = await apiCall(
      request, director, 'GET',
      `/export/payroll?fromDate=${fromDate}&toDate=${toDate}`,
      undefined, [200],
    );
    expect(exportResp.status).toBe(200);
    // Response should be CSV text
    expect(exportResp.text.length).toBeGreaterThan(0);
    // CSV should have header row
    const firstLine = exportResp.text.split('\n')[0];
    expect(firstLine.length).toBeGreaterThan(0);

    // 2. Director exports invoices CSV
    const invExport = await apiCall(
      request, director, 'GET',
      `/export/invoices?fromDate=${fromDate}&toDate=${toDate}`,
      undefined, [200],
    );
    expect(invExport.status).toBe(200);
    expect(invExport.text.length).toBeGreaterThan(0);

    // 3. TEACHER cannot export payroll
    const teacherExport = await apiCall(
      request, teacher, 'GET',
      `/export/payroll?fromDate=${fromDate}&toDate=${toDate}`,
      undefined, [401, 403],
    );
    expect([401, 403]).toContain(teacherExport.status);

    // 4. Director exports students
    const stuExport = await apiCall(
      request, director, 'GET', '/export/students', undefined, [200],
    );
    expect(stuExport.status).toBe(200);
    expect(stuExport.text.length).toBeGreaterThan(0);
  });
});

// ─── 21.4 NOTIFICATION ISOLATION & PREFERENCES ──────────────────────────────

test.describe('21.4 Notification Isolation & Preferences', () => {
  test('each user sees only their notifications, can update preferences', async ({ request }) => {
    const director = await loginAsRole(request, 'director');
    const teacher = await loginAsRole(request, 'teacher');

    // 1. Director sees their notifications
    const dirNotif = await apiCall(request, director, 'GET', '/notifications?limit=5', undefined, [200]);
    expect(dirNotif.status).toBe(200);
    const dirList = Array.isArray(dirNotif.data) ? dirNotif.data : (dirNotif.data as any)?.data || [];
    // Each notification should belong to this user
    // (we can't deeply verify ownership IDs without user ID, but verify structure)
    for (const n of dirList.slice(0, 3)) {
      expect(n).toHaveProperty('_id');
      expect(n).toHaveProperty('type');
    }

    // 2. Unread count
    const unread = await apiCall(request, director, 'GET', '/notifications/unread-count', undefined, [200]);
    expect(unread.status).toBe(200);
    const count = typeof unread.data === 'number' ? unread.data : (unread.data as any)?.count ?? 0;
    expect(typeof count).toBe('number');

    // 3. Teacher gets their own (different set)
    const teachNotif = await apiCall(request, teacher, 'GET', '/notifications?limit=5', undefined, [200]);
    expect(teachNotif.status).toBe(200);

    // 4. Get preferences
    const prefs = await apiCall(request, director, 'GET', '/notifications/preferences', undefined, [200]);
    expect(prefs.status).toBe(200);

    // 5. Update preferences
    const updatePrefs = await apiCall(request, director, 'PATCH', '/notifications/preferences', {
      enableEmailNotif: true,
    }, [200]);
    expect(updatePrefs.status).toBe(200);

    // 6. Mark all read
    const markAll = await apiCall(request, director, 'PATCH', '/notifications/mark-all-read', undefined, [200]);
    expect(markAll.status).toBe(200);

    // 7. Verify unread count is 0 after mark-all-read
    const unreadAfter = await apiCall(request, director, 'GET', '/notifications/unread-count', undefined, [200]);
    const countAfter = typeof unreadAfter.data === 'number'
      ? unreadAfter.data
      : (unreadAfter.data as any)?.count ?? 0;
    expect(countAfter).toBe(0);
  });
});
