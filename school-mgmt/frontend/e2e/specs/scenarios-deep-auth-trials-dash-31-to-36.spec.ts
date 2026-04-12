/**
 * BATCH 8 — Deep E2E Tests: Auth, Trials, Products, Tickets, Dashboards, Export
 *
 * Test levels:
 *   ● API — auth login/change-password, trial enrollments lifecycle, products CRUD, tickets lifecycle
 *   ● Propagation — trial convert → status change, dashboard per-role data isolation
 *   ● Guards — RBAC, validation, state transitions
 *
 * Groups covered: 9 (Reconciliation), 25 (Products), 31 (Auth), 32 (Trial Enrollments),
 *                 36 (Dashboard per Role), Tickets, Export, Notifications
 */
import { test, expect, type APIRequestContext } from '@playwright/test';
import { apiCall, apiJson } from '../support/api';
import { loginAsRole, loginAsCredentials, roleEmail, rolePassword } from '../support/auth';
import {
  createEnrollmentFixture,
  createParentAccount,
  ensureProductFixture,
  ensureSaleAccount,
  ensureTeacherAccount,
  uniquePhone,
  dateOffset,
  type EnrollmentFixture,
} from '../support/scenario-helpers';
import type { DemoSession } from '../support/types';

/* ─────────────────────────────────────────────────────────────────────────────
 * HELPERS
 * ───────────────────────────────────────────────────────────────────────────── */

const API_BASE =
  process.env['PLAYWRIGHT_API_BASE_URL'] ||
  process.env['E2E_API_BASE_URL'] ||
  'http://127.0.0.1:3000';

function uniqueDigits(label: string, length: number): string {
  const raw = `${Date.now()}${Math.floor(Math.random() * 1000)}${label}`.replace(/\D/g, '');
  return raw.slice(-length).padStart(length, '0');
}

/* ═══════════════════════════════════════════════════════════════════════════════
 * 31 — AUTH & SECURITY
 * ═══════════════════════════════════════════════════════════════════════════════ */

test.describe('31 Auth & Security', () => {
  test('31.1 login succeeds with cookies + /users/me; login fails for invalid credentials', async ({ request }) => {
    // Successful login → verify cookies and /users/me
    const director = await loginAsRole(request, 'director');
    expect(director.cookieHeader).toContain('access_token');
    expect(director.cookieHeader).toContain('XSRF-TOKEN');

    const me = await apiJson<any>(request, director, 'GET', '/users/me');
    expect(me.role).toBe('DIRECTOR');
    expect(me.email).toBe(roleEmail('director'));

    // Also verify other roles can login
    const teacher = await loginAsRole(request, 'teacher');
    const teacherMe = await apiJson<any>(request, teacher, 'GET', '/users/me');
    expect(teacherMe.role).toBe('TEACHER');

    // Login failure — non-existent email
    const failResp = await request.post(`${API_BASE}/auth/login`, {
      data: { email: 'nonexistent-e2e@school.local', password: 'Wrong123!' },
    });
    expect(failResp.status()).toBe(401);
  });

  test('31.3 change password: old rejected, new accepted', async ({ request }) => {
    test.slow();

    const director = await loginAsRole(request, 'director');
    const parent = await createParentAccount(request, director, 'T31.3');
    const origPassword = parent.password;
    const newPassword = 'NewE2eP@ss999!';

    // Login with original password
    const parentSession = await loginAsCredentials(request, 'parent', parent.email, origPassword);

    // Change password
    await apiCall(request, parentSession, 'POST', '/auth/change-password', {
      oldPassword: origPassword,
      newPassword,
    }, [200, 201]);

    // Verify: old password fails (raw POST to bypass cache)
    const oldResp = await request.post(`${API_BASE}/auth/login`, {
      data: { email: parent.email, password: origPassword },
    });
    expect(oldResp.status()).toBe(401);

    // Verify: new password works
    const newResp = await request.post(`${API_BASE}/auth/login`, {
      data: { email: parent.email, password: newPassword },
    });
    expect([200, 201]).toContain(newResp.status());
  });
});

/* ═══════════════════════════════════════════════════════════════════════════════
 * 32 — TRIAL ENROLLMENTS
 * ═══════════════════════════════════════════════════════════════════════════════ */

test.describe('32 Trial Enrollments', () => {
  /** Create an OFFLINE product + class (trial enrollments require both product & class to be OFFLINE) */
  async function createOfflineTrialSetup(request: APIRequestContext, label: string) {
    const director = await loginAsRole(request, 'director');
    const digits = uniqueDigits(label, 8);

    // Create a dedicated OFFLINE product (ensureProductFixture reuses ONLINE ones)
    const product = await apiJson<any>(request, director, 'POST', '/products', {
      name: `E2E Trial Product ${digits}`,
      code: `TRL${digits}`,
      description: 'OFFLINE trial product',
      category: 'ENGLISH',
      teachingMode: 'OFFLINE',
      defaultSessions: 10,
      defaultSessionDuration: 60,
      pricePerSession: 150_000,
      suggestedPrice: 1_500_000,
      commissionRate: 0,
      isActive: true,
    });

    const teacher = await ensureTeacherAccount(request, director, label);
    const sale = await ensureSaleAccount(request, director, label);

    const classroom = await apiJson<any>(request, director, 'POST', '/classes', {
      name: `E2E Trial Class ${digits}`,
      code: `TCLS${digits}`,
      teacherId: teacher._id,
      saleId: sale._id,
      classMode: 'OFFLINE',
      productPackageId: product._id,
      studentIds: [],
      subject: 'Tieng Anh',
      learningGoals: 'Trial enrollment test',
      pricePerSession: 150_000,
      teacherPayPerSession: 0,
      teacherPayPerStudent: 60_000,
      baseDuration: 60,
      sessionDuration: 60,
      maxStudents: 10,
    });

    return { director, product, classroom, teacher, sale };
  }

  test('32.1→32.2 create trial → record session → WAITING_DECISION', async ({ request }) => {
    test.slow();

    const { product, classroom, sale } = await createOfflineTrialSetup(request, 'T32-rec');
    const saleSession = await loginAsCredentials(
      request, 'sale', sale.email, sale.password,
    );

    // 32.1 Create trial enrollment
    const trial = await apiJson<any>(request, saleSession, 'POST', '/trial-enrollments', {
      classId: classroom._id,
      productId: product._id,
      saleId: sale._id,
      parentName: 'Trial Parent Record',
      parentPhone: uniquePhone('trial-rec'),
      studentName: 'Trial Student Record',
      maxTrialSessions: 1,
      notes: 'E2E trial record test',
    });
    expect(trial._id).toBeTruthy();

    // 32.2 Record trial session
    const recorded = await apiJson<any>(
      request, saleSession, 'POST',
      `/trial-enrollments/${trial._id}/trial-sessions`,
      { notes: 'Trial session completed' },
    );
    expect(recorded).toBeTruthy();

    // Verify status moved to WAITING_DECISION
    const fetched = await apiJson<any>(
      request, saleSession, 'GET',
      `/trial-enrollments/${trial._id}`,
    );
    expect(fetched.status).toBe('WAITING_DECISION');
  });

  test('32.3 convert trial requires approved invoice', async ({ request }) => {
    test.slow();

    const { product, classroom, sale } = await createOfflineTrialSetup(request, 'T32-conv');
    const saleSession = await loginAsCredentials(
      request, 'sale', sale.email, sale.password,
    );

    // Create + record
    const trial = await apiJson<any>(request, saleSession, 'POST', '/trial-enrollments', {
      classId: classroom._id,
      productId: product._id,
      saleId: sale._id,
      parentName: 'Trial Parent Convert',
      parentPhone: uniquePhone('trial-conv'),
      studentName: 'Trial Student Convert',
      maxTrialSessions: 1,
    });
    await apiJson<any>(request, saleSession, 'POST',
      `/trial-enrollments/${trial._id}/trial-sessions`, { notes: 'Done' });

    // Convert without invoice → should fail with 400 (requires approved invoice)
    const convertResp = await apiCall(
      request, saleSession, 'POST',
      `/trial-enrollments/${trial._id}/convert`,
      { decisionNotes: 'Parent agreed to enroll' },
      [400],
    );
    expect(convertResp.status).toBe(400);

    // Verify trial status is still WAITING_DECISION (not converted)
    const fetched = await apiJson<any>(
      request, saleSession, 'GET', `/trial-enrollments/${trial._id}`);
    expect(fetched.status).toBe('WAITING_DECISION');
  });

  test('32.4 reject trial enrollment', async ({ request }) => {
    test.slow();

    const { product, classroom, sale } = await createOfflineTrialSetup(request, 'T32-rej');
    const saleSession = await loginAsCredentials(
      request, 'sale', sale.email, sale.password,
    );

    // Create trial
    const trial = await apiJson<any>(request, saleSession, 'POST', '/trial-enrollments', {
      classId: classroom._id,
      productId: product._id,
      saleId: sale._id,
      parentName: 'Trial Parent Reject',
      parentPhone: uniquePhone('trial-rej'),
      studentName: 'Trial Student Reject',
      maxTrialSessions: 1,
    });
    expect(trial._id).toBeTruthy();

    // Reject
    const rejected = await apiJson<any>(
      request, saleSession, 'POST',
      `/trial-enrollments/${trial._id}/reject`,
      { decisionNotes: 'Parent found it expensive' },
    );
    expect(rejected).toBeTruthy();

    // Verify status
    const fetched = await apiJson<any>(
      request, saleSession, 'GET',
      `/trial-enrollments/${trial._id}`,
    );
    expect(fetched.status).toBe('REJECTED');
  });

  test('32.RBAC parent/teacher cannot create trial enrollments', async ({ request }) => {
    const { product, classroom } = await createOfflineTrialSetup(request, 'T32-rbac');

    // Parent cannot create trial (use demo parent)
    const parent = await loginAsRole(request, 'parent');
    const parentResp = await apiCall(request, parent, 'POST', '/trial-enrollments', {
      classId: classroom._id,
      productId: product._id,
      parentName: 'RBAC Parent',
      parentPhone: uniquePhone('rbac-p'),
      studentName: 'RBAC Student',
    }, [403]);
    expect(parentResp.status).toBe(403);

    // Teacher cannot create trial
    const teacher = await loginAsRole(request, 'teacher');
    const teacherResp = await apiCall(request, teacher, 'POST', '/trial-enrollments', {
      classId: classroom._id,
      productId: product._id,
      parentName: 'RBAC Teacher',
      parentPhone: uniquePhone('rbac-t'),
      studentName: 'RBAC Student T',
    }, [403]);
    expect(teacherResp.status).toBe(403);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════════
 * 25 — PRODUCTS CRUD
 * ═══════════════════════════════════════════════════════════════════════════════ */

test.describe('25 Products', () => {
  test('25.1 create, update, list products (Director)', async ({ request }) => {
    const director = await loginAsRole(request, 'director');
    const digits = uniqueDigits('prod', 8);

    // Create product
    const product = await apiJson<any>(request, director, 'POST', '/products', {
      name: `E2E Batch8 Product ${digits}`,
      code: `B8P${digits}`,
      description: 'E2E batch 8 product test',
      category: 'ENGLISH',
      teachingMode: 'ONLINE',
      defaultSessions: 10,
      defaultSessionDuration: 60,
      pricePerSession: 250_000,
      suggestedPrice: 2_500_000,
      commissionRate: 0,
      isActive: true,
    });
    expect(product._id).toBeTruthy();
    expect(product.name).toContain('E2E Batch8 Product');

    // Update product price
    const updated = await apiJson<any>(
      request, director, 'PATCH',
      `/products/${product._id}`,
      { pricePerSession: 300_000, suggestedPrice: 3_000_000 },
    );
    expect(updated.pricePerSession).toBe(300_000);

    // List products — should include the new one
    const products = await apiJson<any[]>(request, director, 'GET', '/products');
    const found = products.find((p: any) => p._id === product._id);
    expect(found).toBeTruthy();
    expect(found.pricePerSession).toBe(300_000);
  });

  test('25.RBAC teacher/parent cannot create products', async ({ request }) => {
    // Teacher cannot create
    const teacher = await loginAsRole(request, 'teacher');
    const teacherResp = await apiCall(request, teacher, 'POST', '/products', {
      name: 'RBAC Product Teacher',
      code: `RBACT${Date.now()}`,
      category: 'ENGLISH',
      teachingMode: 'ONLINE',
      defaultSessions: 5,
      pricePerSession: 100_000,
    }, [403]);
    expect(teacherResp.status).toBe(403);

    // Parent cannot create
    const parent = await loginAsRole(request, 'parent');
    const parentResp = await apiCall(request, parent, 'POST', '/products', {
      name: 'RBAC Product Parent',
      code: `RBACP${Date.now()}`,
      category: 'ENGLISH',
      teachingMode: 'ONLINE',
      defaultSessions: 5,
      pricePerSession: 100_000,
    }, [403]);
    expect(parentResp.status).toBe(403);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════════
 * TICKETS — Lifecycle & RBAC
 * ═══════════════════════════════════════════════════════════════════════════════ */

test.describe('Tickets', () => {
  test('parent creates ticket, OPS starts → resolves → closes', async ({ request }) => {
    test.slow();

    // Parent creates a ticket
    const parent = await loginAsRole(request, 'parent');
    const ticket = await apiJson<any>(request, parent, 'POST', '/tickets', {
      type: 'SCHEDULE_ISSUE',
      subject: 'E2E Schedule Issue Ticket',
      description: 'This is an automated test ticket for schedule issue',
      priority: 'MEDIUM',
    });
    expect(ticket._id).toBeTruthy();
    expect(ticket.status).toBe('OPEN');
    expect(ticket.type).toBe('SCHEDULE_ISSUE');

    // OPS starts working on ticket
    const ops = await loginAsRole(request, 'ops');
    await apiCall(request, ops, 'POST', `/tickets/${ticket._id}/start`, undefined, [200, 201]);

    // OPS adds a comment
    await apiCall(request, ops, 'POST', `/tickets/${ticket._id}/comments`, {
      content: 'Looking into this schedule issue',
      isInternal: false,
    }, [200, 201]);

    // OPS resolves the ticket
    await apiCall(request, ops, 'POST', `/tickets/${ticket._id}/resolve`, {
      summary: 'Schedule has been adjusted',
      outcome: 'APPROVED',
    }, [200, 201]);

    // OPS closes the ticket
    await apiCall(request, ops, 'POST', `/tickets/${ticket._id}/close`, undefined, [200, 201]);

    // Verify final status
    const closed = await apiJson<any>(request, ops, 'GET', `/tickets/${ticket._id}`);
    expect(closed.status).toBe('CLOSED');
  });

  test('teacher creates ticket, sees it in my-tickets', async ({ request }) => {
    const teacher = await loginAsRole(request, 'teacher');

    // Create ticket
    const ticket = await apiJson<any>(request, teacher, 'POST', '/tickets', {
      type: 'PAYMENT_ISSUE',
      subject: 'E2E Teacher Payment Issue',
      description: 'Teacher payroll has discrepancy',
      priority: 'HIGH',
    });
    expect(ticket._id).toBeTruthy();

    // Teacher sees it in my-tickets
    const myTickets = await apiJson<any>(request, teacher, 'GET', '/tickets/my-tickets');
    const list = Array.isArray(myTickets) ? myTickets : (myTickets.data || myTickets.items || []);
    const found = list.find((t: any) => t._id === ticket._id);
    expect(found).toBeTruthy();

    // Teacher adds comment
    await apiCall(request, teacher, 'POST', `/tickets/${ticket._id}/comments`, {
      content: 'Adding more details about the issue',
    }, [200, 201]);

    // Read comments
    const comments = await apiJson<any>(
      request, teacher, 'GET',
      `/tickets/${ticket._id}/comments`,
    );
    const commentList = Array.isArray(comments) ? comments : (comments.data || comments.items || []);
    expect(commentList.length).toBeGreaterThanOrEqual(1);
  });

  test('ticket RBAC: parent cannot start/resolve tickets', async ({ request }) => {
    const parent = await loginAsRole(request, 'parent');
    const ticket = await apiJson<any>(request, parent, 'POST', '/tickets', {
      type: 'OTHER',
      subject: 'E2E RBAC Ticket',
      description: 'Ticket for RBAC test',
    });

    // Parent cannot start ticket
    const startResp = await apiCall(
      request, parent, 'POST',
      `/tickets/${ticket._id}/start`, undefined,
      [403],
    );
    expect(startResp.status).toBe(403);

    // Parent cannot resolve ticket
    const resolveResp = await apiCall(request, parent, 'POST', `/tickets/${ticket._id}/resolve`, {
      summary: 'Should not work',
      outcome: 'APPROVED',
    }, [403]);
    expect(resolveResp.status).toBe(403);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════════
 * 36 — DASHBOARD PER ROLE
 * ═══════════════════════════════════════════════════════════════════════════════ */

test.describe('36 Dashboard per Role', () => {
  test('36.1 Director dashboards return data', async ({ request }) => {
    const director = await loginAsRole(request, 'director');
    const fromDate = dateOffset(-90);
    const toDate = dateOffset(0);

    // Main director dashboard
    const main = await apiCall(request, director, 'GET',
      `/dashboard/director?fromDate=${fromDate}&toDate=${toDate}`);
    expect(main.status).toBe(200);
    expect(main.data).toBeTruthy();

    // Comprehensive dashboard
    const comp = await apiCall(request, director, 'GET',
      `/dashboard/director/comprehensive?fromDate=${fromDate}&toDate=${toDate}`);
    expect(comp.status).toBe(200);

    // Revenue dashboard
    const revenue = await apiCall(request, director, 'GET',
      `/dashboard/director/revenue?fromDate=${fromDate}&toDate=${toDate}`);
    expect(revenue.status).toBe(200);

    // Calendar
    const now = new Date();
    const calendar = await apiCall(request, director, 'GET',
      `/dashboard/director/calendar?month=${now.getMonth() + 1}&year=${now.getFullYear()}`);
    expect(calendar.status).toBe(200);

    // Birthdays
    const birthdays = await apiCall(request, director, 'GET', '/dashboard/birthdays');
    expect(birthdays.status).toBe(200);
  });

  test('36.2-36.5 Sale + Accounting + OPS dashboards', async ({ request }) => {
    const fromDate = dateOffset(-30);
    const toDate = dateOffset(0);

    // Sale dashboard
    const sale = await loginAsRole(request, 'sale');
    const saleDash = await apiCall(request, sale, 'GET',
      `/dashboard/sales?fromDate=${fromDate}&toDate=${toDate}`);
    expect(saleDash.status).toBe(200);
    expect(saleDash.data).toBeTruthy();

    // Accounting dashboard
    const accounting = await loginAsRole(request, 'accounting');
    const acctDash = await apiCall(request, accounting, 'GET',
      `/dashboard/accounting?fromDate=${fromDate}&toDate=${toDate}`);
    expect(acctDash.status).toBe(200);

    // OPS dashboard
    const ops = await loginAsRole(request, 'ops');
    const opsDash = await apiCall(request, ops, 'GET', '/dashboard/ops');
    expect(opsDash.status).toBe(200);

    // Daily tasks — accessible to all roles
    const dailyTasks = await apiCall(request, ops, 'GET', '/dashboard/daily-tasks');
    expect(dailyTasks.status).toBe(200);
  });

  test('36.3-36.4 Teacher + Parent dashboards', async ({ request }) => {
    // Teacher dashboard
    const teacher = await loginAsRole(request, 'teacher');
    const teacherDash = await apiCall(request, teacher, 'GET', '/dashboard/teacher');
    expect(teacherDash.status).toBe(200);
    expect(teacherDash.data).toBeTruthy();

    // Parent dashboard
    const parent = await loginAsRole(request, 'parent');
    const parentDash = await apiCall(request, parent, 'GET', '/dashboard/parent');
    expect(parentDash.status).toBe(200);
    expect(parentDash.data).toBeTruthy();

    // Teacher daily-tasks
    const teacherTasks = await apiCall(request, teacher, 'GET', '/dashboard/daily-tasks');
    expect(teacherTasks.status).toBe(200);

    // Parent daily-tasks
    const parentTasks = await apiCall(request, parent, 'GET', '/dashboard/daily-tasks');
    expect(parentTasks.status).toBe(200);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════════
 * 27 — EXPORT (CSV)
 * ═══════════════════════════════════════════════════════════════════════════════ */

test.describe('27 Export', () => {
  test('27.1 export endpoints return CSV (Director)', async ({ request }) => {
    const director = await loginAsRole(request, 'director');
    const fromDate = dateOffset(-90);
    const toDate = dateOffset(0);

    // Export students (no date params required)
    const students = await apiCall(request, director, 'GET', '/export/students');
    expect(students.status).toBe(200);

    // Export invoices
    const invoices = await apiCall(request, director, 'GET',
      `/export/invoices?fromDate=${fromDate}&toDate=${toDate}`);
    expect(invoices.status).toBe(200);

    // Export payroll
    const payroll = await apiCall(request, director, 'GET',
      `/export/payroll?fromDate=${fromDate}&toDate=${toDate}`);
    expect(payroll.status).toBe(200);

    // Export financial
    const financial = await apiCall(request, director, 'GET',
      `/export/financial?fromDate=${fromDate}&toDate=${toDate}`);
    expect(financial.status).toBe(200);
  });

  test('27.RBAC teacher/parent cannot export', async ({ request }) => {
    const fromDate = dateOffset(-30);
    const toDate = dateOffset(0);

    // Teacher cannot export payroll
    const teacher = await loginAsRole(request, 'teacher');
    const teacherResp = await apiCall(request, teacher, 'GET',
      `/export/payroll?fromDate=${fromDate}&toDate=${toDate}`, undefined, [403]);
    expect(teacherResp.status).toBe(403);

    // Parent cannot export students
    const parent = await loginAsRole(request, 'parent');
    const parentResp = await apiCall(request, parent, 'GET',
      '/export/students', undefined, [403]);
    expect(parentResp.status).toBe(403);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════════
 * NOTIFICATIONS
 * ═══════════════════════════════════════════════════════════════════════════════ */

test.describe('Notifications', () => {
  test('list notifications, unread count, and preferences', async ({ request }) => {
    const director = await loginAsRole(request, 'director');

    // List notifications
    const notifs = await apiCall(request, director, 'GET', '/notifications');
    expect(notifs.status).toBe(200);

    // Unread count
    const unread = await apiCall(request, director, 'GET', '/notifications/unread-count');
    expect(unread.status).toBe(200);

    // Get preferences
    const prefs = await apiCall(request, director, 'GET', '/notifications/preferences');
    expect(prefs.status).toBe(200);

    // Update preferences
    const updatePrefs = await apiCall(request, director, 'PATCH', '/notifications/preferences', {
      enableEmailNotif: true,
    }, [200, 201]);
    expect(updatePrefs.status).toBeLessThan(300);

    // Mark all read
    const markAll = await apiCall(request, director, 'PATCH', '/notifications/mark-all-read',
      undefined, [200, 201]);
    expect(markAll.status).toBeLessThan(300);

    // Verify unread count is 0 after mark-all
    const unreadAfter = await apiJson<any>(request, director, 'GET', '/notifications/unread-count');
    const count = typeof unreadAfter === 'number' ? unreadAfter : (unreadAfter?.count ?? unreadAfter?.unreadCount ?? 0);
    expect(count).toBe(0);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════════
 * 9 — RECONCILIATION
 * ═══════════════════════════════════════════════════════════════════════════════ */

test.describe('9 Reconciliation', () => {
  test('9.1 manual reconciliation run (Director)', async ({ request }) => {
    const director = await loginAsRole(request, 'director');
    const fromDate = dateOffset(-30);
    const toDate = dateOffset(0);

    const result = await apiCall(request, director, 'POST', '/admin/reconciliation/run', {
      fromDate,
      toDate,
    }, [200, 201]);
    expect(result.status).toBeLessThan(300);
    expect(result.data).toBeTruthy();
  });

  test('9.RBAC teacher/parent cannot run reconciliation', async ({ request }) => {
    const fromDate = dateOffset(-7);
    const toDate = dateOffset(0);

    // Teacher cannot run reconciliation
    const teacher = await loginAsRole(request, 'teacher');
    const teacherResp = await apiCall(request, teacher, 'POST', '/admin/reconciliation/run', {
      fromDate,
      toDate,
    }, [403]);
    expect(teacherResp.status).toBe(403);

    // Parent cannot run reconciliation
    const parent = await loginAsRole(request, 'parent');
    const parentResp = await apiCall(request, parent, 'POST', '/admin/reconciliation/run', {
      fromDate,
      toDate,
    }, [403]);
    expect(parentResp.status).toBe(403);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════════
 * WORK SESSIONS — Read-only checks (34)
 * ═══════════════════════════════════════════════════════════════════════════════ */

test.describe('34 Work Sessions', () => {
  test('34.1 list work sessions and summary (Director/OPS)', async ({ request }) => {
    const director = await loginAsRole(request, 'director');
    const fromDate = dateOffset(-30);
    const toDate = dateOffset(0);

    // List work sessions
    const sessions = await apiCall(request, director, 'GET',
      `/work-sessions?fromDate=${fromDate}&toDate=${toDate}`);
    expect(sessions.status).toBe(200);

    // Work session summary
    const summary = await apiCall(request, director, 'GET',
      `/work-sessions/summary?periodStart=${fromDate}&periodEnd=${toDate}`);
    expect(summary.status).toBe(200);

    // My work sessions (teacher)
    const teacher = await loginAsRole(request, 'teacher');
    const myWS = await apiCall(request, teacher, 'GET',
      `/work-sessions/my?fromDate=${fromDate}&toDate=${toDate}`);
    expect(myWS.status).toBe(200);
  });
});
