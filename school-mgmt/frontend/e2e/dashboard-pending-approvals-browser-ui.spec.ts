import { expect, test, type APIRequestContext, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { applySessionCookies, loginAsRole } from './support/auth';

const APP_BASE_URL =
  process.env['PLAYWRIGHT_BASE_URL'] ||
  process.env['E2E_BASE_URL'] ||
  'http://localhost:4200';

const PENDING_APPROVALS_API_PATTERN = /^https?:\/\/[^/]+:3000\/pending-approvals(?:\?.*)?$/;
const PENDING_APPROVALS_SUMMARY_API_PATTERN = /^https?:\/\/[^/]+:3000\/pending-approvals\/summary(?:\?.*)?$/;

async function openAuthenticatedPage(
  browser: Browser,
  request: APIRequestContext,
  role: 'director' | 'ops',
  path: string,
  configurePage?: (page: Page) => Promise<void>,
): Promise<{ context: BrowserContext; page: Page }> {
  const session = await loginAsRole(request, role);
  const context = await browser.newContext({ baseURL: APP_BASE_URL });
  const page = await context.newPage();

  if (configurePage) {
    await configurePage(page);
  }

  await applySessionCookies(context, session);
  await page.goto(path);
  await page.waitForLoadState('domcontentloaded');

  return { context, page };
}

function buildPendingPayload() {
  return {
    summary: {
      totalPending: 6,
      pendingPayrolls: 1,
      pendingInvoices: 1,
      pendingTopUps: 1,
      pendingTeachers: 1,
      pendingClassUpdates: 1,
      pendingSessionChangeRequests: 1,
      openTickets: 2,
    },
    payrolls: [
      {
        payrollCode: 'PR-001',
        teacherId: { fullName: 'Teacher One' },
        periodStart: '2026-04-01',
        periodEnd: '2026-04-30',
        totalSessions: 8,
        netAmount: 1200000,
        createdAt: '2026-04-08T00:00:00.000Z',
      },
    ],
    invoices: [
      {
        invoiceNumber: 'INV-001',
        studentId: { fullName: 'Student One' },
        totalAmount: 500000,
        createdBy: { fullName: 'Sale One' },
        createdAt: '2026-04-08T00:00:00.000Z',
      },
    ],
    topUps: [
      {
        userId: { fullName: 'Parent One', email: 'parent.one@school.local' },
        amount: 300000,
        paymentMethod: 'BANK_TRANSFER',
        createdAt: '2026-04-08T00:00:00.000Z',
      },
    ],
    teachers: [
      {
        _id: 'teacher-profile-001',
        userId: { fullName: 'Teacher New', email: 'teacher.new@school.local', phone: '0900000001' },
        createdAt: '2026-04-08T00:00:00.000Z',
      },
    ],
    classes: [
      {
        _id: 'class-001',
        code: 'CLS001',
        name: 'Class One',
        sale: { fullName: 'Sale One' },
        pendingSaleUpdate: {
          status: 'PENDING',
          requestedBy: { fullName: 'Sale One' },
          requestedAt: '2026-04-08T00:00:00.000Z',
          requestedChanges: { sessionDuration: 90 },
          changeSummary: [
            {
              label: 'Thoi luong buoi hoc',
              beforeValue: '60 phut',
              afterValue: '90 phut',
            },
          ],
        },
      },
    ],
    sessionChanges: [
      {
        _id: 'session-change-001',
        classId: { code: 'CLS001' },
        studentId: { fullName: 'Student One', studentCode: 'HS001' },
        requestedBy: { fullName: 'Sale One' },
        requestedAt: '2026-04-08T00:00:00.000Z',
        requestedTeacherId: { fullName: 'Teacher Two' },
        requestedDurationMinutes: 90,
        currentDurationMinutes: 60,
        reason: 'Need more practice time',
        sessionId: { scheduledDate: '2026-04-09', scheduledStartTime: '18:00' },
        financialImpact: {
          newAmountCharged: 250000,
          newTeacherPayout: 150000,
          note: 'Updated payout',
        },
      },
    ],
  };
}

function buildPendingPayloadWithDurationPreview() {
  return {
    summary: {
      totalPending: 1,
      pendingPayrolls: 0,
      pendingInvoices: 0,
      pendingTopUps: 0,
      pendingTeachers: 0,
      pendingClassUpdates: 1,
      pendingSessionChangeRequests: 0,
      openTickets: 0,
    },
    payrolls: [],
    invoices: [],
    topUps: [],
    teachers: [],
    classes: [
      {
        _id: 'class-preview-001',
        code: 'CLS-PREVIEW',
        name: 'Class Preview',
        sale: { fullName: 'Sale Preview' },
        pendingSaleUpdate: {
          status: 'PENDING',
          requestType: 'DURATION_CHANGE',
          requestedBy: { fullName: 'Sale Preview' },
          requestedAt: '2026-04-08T00:00:00.000Z',
          requestedChanges: { sessionDuration: 90, baseDuration: 45 },
          changeSummary: [
            {
              label: 'Thoi luong buoi hoc',
              beforeValue: '60 phut',
              afterValue: '90 phut',
            },
          ],
          durationPreview: {
            oldBaseDuration: 30,
            oldSessionDuration: 60,
            newBaseDuration: 45,
            newSessionDuration: 90,
            students: [
              {
                studentId: 'student-001',
                studentName: 'Student Preview',
                studentCode: 'HS-PREVIEW',
                oldDurationMinutes: 60,
                newDurationMinutes: 90,
                totalSessionsRemainingBefore: 12,
                totalSessionsRemainingAfter: 8,
                paidSessionsRemainingBefore: 10,
                paidSessionsRemainingAfter: 7,
                bonusSessionsRemainingBefore: 2,
                bonusSessionsRemainingAfter: 1,
                projectedTotalSessionsBefore: 15,
                projectedTotalSessionsAfter: 10,
              },
            ],
          },
        },
      },
    ],
    sessionChanges: [],
  };
}

function buildStatefulPendingPayload(state: { classPending: boolean; sessionChangePending: boolean }) {
  return {
    summary: {
      totalPending: 4 + Number(state.classPending) + Number(state.sessionChangePending),
      pendingPayrolls: 1,
      pendingInvoices: 1,
      pendingTopUps: 1,
      pendingTeachers: 1,
      pendingClassUpdates: Number(state.classPending),
      pendingSessionChangeRequests: Number(state.sessionChangePending),
      openTickets: 2,
    },
    payrolls: [
      {
        payrollCode: 'PR-001',
        teacherId: { fullName: 'Teacher One' },
        periodStart: '2026-04-01',
        periodEnd: '2026-04-30',
        totalSessions: 8,
        netAmount: 1200000,
        createdAt: '2026-04-08T00:00:00.000Z',
      },
    ],
    invoices: [
      {
        invoiceNumber: 'INV-001',
        studentId: { fullName: 'Student One' },
        totalAmount: 500000,
        createdBy: { fullName: 'Sale One' },
        createdAt: '2026-04-08T00:00:00.000Z',
      },
    ],
    topUps: [
      {
        userId: { fullName: 'Parent One', email: 'parent.one@school.local' },
        amount: 300000,
        paymentMethod: 'BANK_TRANSFER',
        createdAt: '2026-04-08T00:00:00.000Z',
      },
    ],
    teachers: [
      {
        _id: 'teacher-profile-001',
        userId: { fullName: 'Teacher New', email: 'teacher.new@school.local', phone: '0900000001' },
        createdAt: '2026-04-08T00:00:00.000Z',
      },
    ],
    classes: state.classPending
      ? [
          {
            _id: 'class-001',
            code: 'CLS001',
            name: 'Class One',
            sale: { fullName: 'Sale One' },
            pendingSaleUpdate: {
              status: 'PENDING',
              requestedBy: { fullName: 'Sale One' },
              requestedAt: '2026-04-08T00:00:00.000Z',
              requestedChanges: { sessionDuration: 90 },
              changeSummary: [
                {
                  label: 'Thoi luong buoi hoc',
                  beforeValue: '60 phut',
                  afterValue: '90 phut',
                },
              ],
            },
          },
        ]
      : [],
    sessionChanges: state.sessionChangePending
      ? [
          {
            _id: 'session-change-001',
            classId: { code: 'CLS001' },
            studentId: { fullName: 'Student One', studentCode: 'HS001' },
            requestedBy: { fullName: 'Sale One' },
            requestedAt: '2026-04-08T00:00:00.000Z',
            requestedTeacherId: { fullName: 'Teacher Two' },
            requestedDurationMinutes: 90,
            currentDurationMinutes: 60,
            reason: 'Need more practice time',
            sessionId: { scheduledDate: '2026-04-09', scheduledStartTime: '18:00' },
            financialImpact: {
              newAmountCharged: 250000,
              newTeacherPayout: 150000,
              note: 'Updated payout',
            },
          },
        ]
      : [],
  };
}

test.describe('Dashboard and pending approvals browser UI', () => {
  test('B02 dashboard co skeleton/loading state trong luc tai', async ({ browser, request }) => {
    const { context, page } = await openAuthenticatedPage(
      browser,
      request,
      'director',
      '/app/dashboard',
      async (authedPage) => {
        await authedPage.addInitScript(() => {
          (globalThis as typeof globalThis & { __dashboardTestDelayMs?: number }).__dashboardTestDelayMs = 500;
        });
      },
    );

    try {
      await expect(page.getByTestId('dashboard-loader')).toBeVisible();
      await expect(page.getByTestId('dashboard-loader')).toBeHidden({ timeout: 5_000 });
      await expect(page.getByTestId('dashboard-handbook-banner')).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test('B02 dashboard co error state va nut tai lai khi tai loi', async ({ browser, request }) => {
    const { context, page } = await openAuthenticatedPage(
      browser,
      request,
      'director',
      '/app/dashboard',
      async (authedPage) => {
        await authedPage.addInitScript(() => {
          (globalThis as typeof globalThis & { __dashboardTestForceError?: boolean }).__dashboardTestForceError = true;
        });
      },
    );

    try {
      await expect(page.getByTestId('dashboard-error')).toBeVisible();
      await expect(page.getByTestId('dashboard-retry')).toBeVisible();

      await page.evaluate(() => {
        (globalThis as typeof globalThis & { __dashboardTestForceError?: boolean }).__dashboardTestForceError = false;
      });
      await page.getByTestId('dashboard-retry').click();

      await expect(page.getByTestId('dashboard-error')).toBeHidden({ timeout: 5_000 });
      await expect(page.getByTestId('dashboard-handbook-banner')).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test('B02 chuyen qua lai giua cac tab Pending Approvals hien thi dung list du lieu', async ({ browser, request }) => {
    const payload = buildPendingPayload();
    const { context, page } = await openAuthenticatedPage(
      browser,
      request,
      'director',
      '/app/pending-approvals',
      async (authedPage) => {
        await authedPage.route(PENDING_APPROVALS_API_PATTERN, async (route) => {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(payload),
          });
        });

        await authedPage.route(PENDING_APPROVALS_SUMMARY_API_PATTERN, async (route) => {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ totalPending: payload.summary.totalPending }),
          });
        });
      },
    );

    try {
      await expect(page.getByTestId('pending-approvals-page')).toBeVisible();
      await expect(page.getByTestId('pending-table-payroll')).toBeVisible();
      await page.getByTestId('pending-tab-invoices').click();
      await expect(page.getByTestId('pending-table-invoices')).toBeVisible();

      await page.getByTestId('pending-tab-topups').click();
      await expect(page.getByTestId('pending-table-topups')).toBeVisible();

      await page.getByTestId('pending-tab-teachers').click();
      await expect(page.getByTestId('pending-table-teachers')).toBeVisible();

      await page.getByTestId('pending-tab-classes').click();
      await expect(page.getByTestId('pending-table-classes')).toBeVisible();

      await page.getByTestId('pending-tab-session-changes').click();
      await expect(page.getByTestId('pending-table-session-changes')).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test('B02 badge count tren Pending Approvals va sidebar khop summary hien thi', async ({ browser, request }) => {
    const payload = buildPendingPayload();
    const { context, page } = await openAuthenticatedPage(
      browser,
      request,
      'director',
      '/app/pending-approvals',
      async (authedPage) => {
        await authedPage.route(PENDING_APPROVALS_API_PATTERN, async (route) => {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(payload),
          });
        });

        await authedPage.route(PENDING_APPROVALS_SUMMARY_API_PATTERN, async (route) => {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ totalPending: payload.summary.totalPending }),
          });
        });
      },
    );

    try {
      await expect(page.getByTestId('pending-approvals-page')).toBeVisible();
      await expect(page.getByTestId('nav-badge-pending')).toHaveText(String(payload.summary.totalPending));
      await expect(page.getByTestId('pending-summary-total')).toContainText(String(payload.summary.totalPending));
      await expect(page.getByTestId('pending-tab-payroll')).toContainText(String(payload.summary.pendingPayrolls));
      await expect(page.getByTestId('pending-tab-invoices')).toContainText(String(payload.summary.pendingInvoices));
      await expect(page.getByTestId('pending-tab-topups')).toContainText(String(payload.summary.pendingTopUps));
      await expect(page.getByTestId('pending-tab-teachers')).toContainText(String(payload.summary.pendingTeachers));
      await expect(page.getByTestId('pending-tab-classes')).toContainText(String(payload.summary.pendingClassUpdates));
      await expect(page.getByTestId('pending-tab-session-changes')).toContainText(String(payload.summary.pendingSessionChangeRequests));
    } finally {
      await context.close();
    }
  });

  test('B02 approve va reject tai Pending Approvals cap nhat UI va giam count realtime', async ({ browser, request }) => {
    const state = {
      classPending: true,
      sessionChangePending: true,
    };

    const { context, page } = await openAuthenticatedPage(
      browser,
      request,
      'director',
      '/app/pending-approvals',
      async (authedPage) => {
        await authedPage.addInitScript(() => {
          const originalSetInterval = window.setInterval.bind(window);
          window.setInterval = ((handler: TimerHandler, timeout?: number, ...args: unknown[]) => {
            const normalizedTimeout = timeout === 60000 ? 150 : timeout;
            return originalSetInterval(handler, normalizedTimeout, ...args);
          }) as typeof window.setInterval;
        });

        await authedPage.route(PENDING_APPROVALS_API_PATTERN, async (route) => {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(buildStatefulPendingPayload(state)),
          });
        });

        await authedPage.route(PENDING_APPROVALS_SUMMARY_API_PATTERN, async (route) => {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ totalPending: 4 + Number(state.classPending) + Number(state.sessionChangePending) }),
          });
        });

        await authedPage.route('**/classes/class-001/pending-sale-update/approve', async (route) => {
          state.classPending = false;
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true }),
          });
        });

        await authedPage.route('**/sessions/change-requests/session-change-001/review', async (route) => {
          state.sessionChangePending = false;
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true }),
          });
        });
      },
    );

    try {
      await expect(page.getByTestId('pending-approvals-page')).toBeVisible();
      await expect(page.getByTestId('nav-badge-pending')).toHaveText('6');

      await page.getByTestId('pending-tab-classes').click();
      await expect(page.getByTestId('pending-class-row-class-001')).toBeVisible();
      await page.getByTestId('pending-class-approve-class-001').click();

      await expect(page.getByTestId('pending-class-row-class-001')).toHaveCount(0);
      await expect(page.getByTestId('pending-empty-classes')).toBeVisible();
      await expect(page.getByTestId('pending-summary-classes')).toContainText('0');
      await expect(page.getByTestId('nav-badge-pending')).toHaveText('5', { timeout: 5_000 });

      page.once('dialog', async (dialog) => {
        await dialog.accept('Khong phu hop');
      });

      await page.getByTestId('pending-tab-session-changes').click();
      await expect(page.getByTestId('pending-session-change-row-session-change-001')).toBeVisible();
      await page.getByTestId('pending-session-change-reject-session-change-001').click();

      await expect(page.getByTestId('pending-session-change-row-session-change-001')).toHaveCount(0);
      await expect(page.getByTestId('pending-empty-session-changes')).toBeVisible();
      await expect(page.getByTestId('pending-summary-session-changes')).toContainText('0');
      await expect(page.getByTestId('nav-badge-pending')).toHaveText('4', { timeout: 5_000 });
    } finally {
      await context.close();
    }
  });

  test('B02 UI preview thay doi thoi luong o tab Sua lop render dung truoc sau thay doi', async ({ browser, request }) => {
    const payload = buildPendingPayloadWithDurationPreview();
    const { context, page } = await openAuthenticatedPage(
      browser,
      request,
      'director',
      '/app/pending-approvals?tab=classes',
      async (authedPage) => {
        await authedPage.route(PENDING_APPROVALS_API_PATTERN, async (route) => {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(payload),
          });
        });

        await authedPage.route(PENDING_APPROVALS_SUMMARY_API_PATTERN, async (route) => {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ totalPending: payload.summary.totalPending }),
          });
        });
      },
    );

    try {
      await expect(page.getByTestId('pending-content-classes')).toBeVisible();
      await expect(page.getByTestId('pending-class-duration-preview-head-class-preview-001')).toContainText('30 / 60 phut');
      await expect(page.getByTestId('pending-class-duration-preview-head-class-preview-001')).toContainText('45 / 90 phut');

      const studentPreview = page.getByTestId('pending-class-duration-preview-student-class-preview-001-0');
      await expect(studentPreview).toContainText('Student Preview');
      await expect(studentPreview).toContainText('(HS-PREVIEW)');
      await expect(studentPreview).toContainText('12');
      await expect(studentPreview).toContainText('8 buoi');
      await expect(studentPreview).toContainText('10');
      await expect(studentPreview).toContainText('7');
      await expect(studentPreview).toContainText('2');
      await expect(studentPreview).toContainText('1');
      await expect(studentPreview).toContainText('15');
      await expect(studentPreview).toContainText('10 buoi');
    } finally {
      await context.close();
    }
  });
});
