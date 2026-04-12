import { expect, test, type APIRequestContext, type Browser, type Page } from '@playwright/test';
import { applySessionCookies, createBatchEvidenceContext, loginAsRole, type BatchEvidenceSession } from './support';

const APP_BASE_URL =
  process.env['PLAYWRIGHT_BASE_URL'] ||
  process.env['E2E_BASE_URL'] ||
  'http://localhost:4200';
const APP_ORIGIN = new URL(APP_BASE_URL).origin;
const RUN_DATE = process.env['UI_EVIDENCE_DATE'] || new Date().toISOString().slice(0, 10);

test.use({
  trace: 'off',
  video: 'on',
});

function appUrl(path: string): string {
  return new URL(path, APP_BASE_URL).toString();
}

function nowIso(offsetMinutes = 0): string {
  return new Date(Date.now() + (offsetMinutes * 60 * 1000)).toISOString();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

type PendingApprovalsState = {
  payload: any;
  dataRequests: string[];
  summaryRequests: string[];
};

type TicketRefreshState = {
  assignedTickets: any[];
  ticketDetail: any;
  comments: any[];
  assignedRequests: string[];
  statsRequests: string[];
  detailRequests: string[];
  commentRequests: string[];
};

type PublicLandingRefreshState = {
  page: any;
  pageRequests: string[];
};

async function openInternalEvidencePage(
  browser: Browser,
  request: APIRequestContext,
  role: 'director' | 'ops',
  scenario: string,
  path: string,
  setup: (page: Page) => Promise<void> | void,
): Promise<BatchEvidenceSession> {
  const session = await loginAsRole(request, role);
  const evidence = await createBatchEvidenceContext(browser, {
    batchId: 'NHOM12',
    scenario,
    runDate: RUN_DATE,
  });
  await applySessionCookies(evidence.context, session);
  await setup(evidence.page);
  await evidence.page.goto(appUrl(path));
  await evidence.page.waitForLoadState('domcontentloaded');
  return evidence;
}

async function openPublicEvidencePage(
  browser: Browser,
  scenario: string,
  path: string,
  setup: (page: Page) => Promise<void> | void,
): Promise<BatchEvidenceSession> {
  const evidence = await createBatchEvidenceContext(browser, {
    batchId: 'NHOM12',
    scenario,
    runDate: RUN_DATE,
  });
  await setup(evidence.page);
  await evidence.page.goto(appUrl(path));
  await evidence.page.waitForLoadState('domcontentloaded');
  return evidence;
}

function buildPendingApprovalsState(): PendingApprovalsState {
  return {
    payload: {
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
          _id: 'class-refresh-001',
          code: 'CLS-REFRESH',
          name: 'Class Refresh',
          sale: { fullName: 'Sale Refresh' },
          pendingSaleUpdate: {
            status: 'PENDING',
            requestType: 'DURATION_CHANGE',
            requestedBy: { fullName: 'Sale Refresh' },
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
                  studentId: 'student-refresh-001',
                  studentName: 'Student Refresh',
                  studentCode: 'HS-REFRESH',
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
    },
    dataRequests: [],
    summaryRequests: [],
  };
}

async function routePendingApprovalsApis(page: Page, state: PendingApprovalsState): Promise<void> {
  await page.route(/^https?:\/\/[^/]+:3000\/pending-approvals(?:\?.*)?$/, async (route) => {
    state.dataRequests.push(route.request().url());
    await sleep(250);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(clone(state.payload)),
    });
  });

  await page.route(/^https?:\/\/[^/]+:3000\/pending-approvals\/summary(?:\?.*)?$/, async (route) => {
    state.summaryRequests.push(route.request().url());
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ totalPending: state.payload.summary.totalPending }),
    });
  });
}

function buildTicketRefreshState(): TicketRefreshState {
  const createdAt = nowIso(-60);
  return {
    assignedTickets: [
      {
        _id: 'ticket-refresh-001',
        ticketCode: 'TKT-REFRESH-001',
        type: 'SUPPORT',
        status: 'IN_PROGRESS',
        priority: 'HIGH',
        subject: 'Refresh state ticket detail',
        description: 'Need to keep the same ticket detail after page reload.',
        createdAt,
        updatedAt: createdAt,
        createdBy: { _id: 'ops-1', fullName: 'Ops Refresh' },
        assignedTo: { _id: 'ops-1', fullName: 'Ops Refresh' },
      },
    ],
    ticketDetail: {
      _id: 'ticket-refresh-001',
      ticketCode: 'TKT-REFRESH-001',
      type: 'SUPPORT',
      status: 'IN_PROGRESS',
      priority: 'HIGH',
      subject: 'Refresh state ticket detail',
      description: 'Need to keep the same ticket detail after page reload.',
      createdAt,
      updatedAt: createdAt,
      createdBy: { _id: 'ops-1', fullName: 'Ops Refresh', role: 'OPS' },
      assignedTo: { _id: 'ops-1', fullName: 'Ops Refresh', role: 'OPS' },
      classId: null,
      studentId: null,
      teacherId: null,
      sessionId: null,
      sourceConversationId: null,
      resolution: null,
    },
    comments: [
      {
        _id: 'comment-refresh-001',
        ticketId: 'ticket-refresh-001',
        content: 'First refresh-safe comment.',
        isInternal: false,
        createdAt,
        userId: { _id: 'ops-1', fullName: 'Ops Refresh', role: 'OPS' },
      },
    ],
    assignedRequests: [],
    statsRequests: [],
    detailRequests: [],
    commentRequests: [],
  };
}

async function routeTicketRefreshApis(page: Page, state: TicketRefreshState): Promise<void> {
  await page.route(/^https?:\/\/[^/]+:3000\/tickets\/assigned-to-me(?:\?.*)?$/, async (route) => {
    state.assignedRequests.push(route.request().url());
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: clone(state.assignedTickets),
        meta: { totalPages: 1, page: 1 },
      }),
    });
  });

  await page.route(/^https?:\/\/[^/]+:3000\/tickets\/stats(?:\?.*)?$/, async (route) => {
    state.statsRequests.push(route.request().url());
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        byStatus: [{ _id: 'IN_PROGRESS', count: 1 }],
      }),
    });
  });

  await page.route(/^https?:\/\/[^/]+:3000\/tickets\/ticket-refresh-001\/comments(?:\?.*)?$/, async (route) => {
    state.commentRequests.push(route.request().url());
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(clone(state.comments)),
    });
  });

  await page.route(/^https?:\/\/[^/]+:3000\/tickets\/ticket-refresh-001(?:\?.*)?$/, async (route) => {
    state.detailRequests.push(route.request().url());
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(clone(state.ticketDetail)),
    });
  });
}

function buildPublicLandingRefreshState(): PublicLandingRefreshState {
  return {
    page: {
      _id: 'lp-refresh-001',
      name: 'Refresh Safe Landing',
      slug: 'refresh-safe-landing',
      status: 'ACTIVE',
      heroTitle: 'Refresh Safe Landing',
      heroSubtitle: 'Trang nay phai tai lai an toan sau khi refresh.',
      formTitle: 'Nhan tu van hoc thu',
      formDescription: 'Form nay duoc dung de kiem chung refresh state co ban.',
      submitButtonText: 'Nhan tu van ngay',
      privacyNotice: 'Thong tin chi dung de tu van.',
      successTitle: 'Cam on phu huynh',
      successMessage: 'Chung toi se lien he som.',
      customHeadHtml: '<meta id="refresh-head-hook" name="refresh-head-hook" content="present">',
      customBodyHtml: '<div id="refresh-body-hook">refresh-body-hook</div>',
    },
    pageRequests: [],
  };
}

async function routePublicLandingRefreshApis(page: Page, state: PublicLandingRefreshState): Promise<void> {
  await page.route(/\/public\/landing-pages\/refresh-safe-landing(?:\?.*)?$/, async (route) => {
    if (new URL(route.request().url()).origin === APP_ORIGIN) {
      await route.continue();
      return;
    }
    state.pageRequests.push(route.request().url());
    await sleep(250);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(clone(state.page)),
    });
  });
}

test.describe.serial('NHOM12 refresh-state browser coverage', () => {
  test('NHOM12 pending approvals keeps requested tab and class preview after page refresh', async ({ browser, request }) => {
    test.slow();
    test.setTimeout(240_000);

    const state = buildPendingApprovalsState();
    const evidence = await openInternalEvidencePage(
      browser,
      request,
      'director',
      'refresh_state_pending_approvals',
      '/app/pending-approvals?tab=classes',
      async (page) => {
        await routePendingApprovalsApis(page, state);
      },
    );

    try {
      await expect(evidence.page.getByTestId('pending-approvals-page')).toBeVisible();
      await expect(evidence.page.getByTestId('pending-content-classes')).toBeVisible();
      await expect(evidence.page.getByTestId('pending-class-duration-preview-head-class-refresh-001')).toContainText('30 / 60 phut');
      await expect(evidence.page.getByTestId('pending-class-duration-preview-head-class-refresh-001')).toContainText('45 / 90 phut');
      await expect(evidence.page).toHaveURL(/\/app\/pending-approvals\?tab=classes/);
      expect(state.dataRequests).toHaveLength(1);
      await evidence.step('01-before-refresh-classes-tab');

      await evidence.page.reload({ waitUntil: 'networkidle' });

      await expect(evidence.page.getByTestId('pending-approvals-page')).toBeVisible();
      await expect(evidence.page.getByTestId('pending-content-classes')).toBeVisible();
      await expect(evidence.page.getByTestId('pending-class-duration-preview-head-class-refresh-001')).toContainText('30 / 60 phut');
      await expect(evidence.page.getByTestId('pending-class-duration-preview-head-class-refresh-001')).toContainText('45 / 90 phut');
      await expect(evidence.page).toHaveURL(/\/app\/pending-approvals\?tab=classes/);
      expect(state.dataRequests).toHaveLength(2);
      await evidence.step('02-after-refresh-classes-tab');

      evidence.note('Pending approvals kept the requested classes tab and duration-preview content after a full browser reload.');
      await evidence.finalize('PASS', {
        extraLines: [
          'Pending approvals query-tab persisted across page refresh: PASS',
          'Class duration preview remained visible and correct after reload: PASS',
        ],
      });
    } catch (error) {
      await evidence.finalize('FAIL', { error });
      throw error;
    }
  });

  test('NHOM12 tickets keeps deep-linked detail and comments after page refresh', async ({ browser, request }) => {
    test.slow();
    test.setTimeout(240_000);

    const state = buildTicketRefreshState();
    const evidence = await openInternalEvidencePage(
      browser,
      request,
      'ops',
      'refresh_state_ticket_detail',
      '/app/tickets?tab=assigned&ticketId=ticket-refresh-001',
      async (page) => {
        await routeTicketRefreshApis(page, state);
      },
    );

    try {
      await expect(evidence.page.locator('.ticket-detail-page')).toBeVisible();
      await expect(evidence.page.locator('.detail-subject')).toContainText('Refresh state ticket detail');
      await expect(evidence.page.locator('.comment-body')).toContainText('First refresh-safe comment.');
      await expect(evidence.page).toHaveURL(/\/app\/tickets\?tab=assigned&ticketId=ticket-refresh-001/);
      expect(state.detailRequests).toHaveLength(1);
      expect(state.commentRequests).toHaveLength(1);
      await evidence.step('01-before-refresh-ticket-detail');

      await evidence.page.reload({ waitUntil: 'networkidle' });

      await expect(evidence.page.locator('.ticket-detail-page')).toBeVisible();
      await expect(evidence.page.locator('.detail-subject')).toContainText('Refresh state ticket detail');
      await expect(evidence.page.locator('.comment-body')).toContainText('First refresh-safe comment.');
      await expect(evidence.page).toHaveURL(/\/app\/tickets\?tab=assigned&ticketId=ticket-refresh-001/);
      expect(state.detailRequests).toHaveLength(2);
      expect(state.commentRequests).toHaveLength(2);
      await evidence.step('02-after-refresh-ticket-detail');

      evidence.note('Ticket detail opened from query params survives a full page refresh and reloads the same detail plus comment thread.');
      await evidence.finalize('PASS', {
        extraLines: [
          'ticketId deep-link remained on the same ticket detail after refresh: PASS',
          'Ticket comments reloaded cleanly after refresh without losing the current detail state: PASS',
        ],
      });
    } catch (error) {
      await evidence.finalize('FAIL', { error });
      throw error;
    }
  });

  test('NHOM12 public landing keeps the same slug screen and core content after page refresh', async ({ browser }) => {
    test.slow();
    test.setTimeout(240_000);

    const state = buildPublicLandingRefreshState();
    const evidence = await openPublicEvidencePage(
      browser,
      'refresh_state_public_landing',
      '/lp/refresh-safe-landing',
      async (page) => {
        await routePublicLandingRefreshApis(page, state);
      },
    );

    try {
      await expect(evidence.page.locator('.hero h1')).toContainText(/Refresh Safe Landing/i);
      await expect(evidence.page.locator('.form-head h2')).toContainText(/Nhan tu van hoc thu/i);
      await expect(evidence.page.locator('#refresh-head-hook')).toHaveCount(1);
      await expect(evidence.page.locator('#refresh-body-hook')).toBeVisible();
      await expect(evidence.page).toHaveURL(/\/lp\/refresh-safe-landing$/);
      expect(state.pageRequests).toHaveLength(1);
      await evidence.step('01-before-refresh-public-landing');

      await evidence.page.reload({ waitUntil: 'networkidle' });

      await expect(evidence.page.locator('.hero h1')).toContainText(/Refresh Safe Landing/i);
      await expect(evidence.page.locator('.form-head h2')).toContainText(/Nhan tu van hoc thu/i);
      await expect(evidence.page.locator('#refresh-head-hook')).toHaveCount(1);
      await expect(evidence.page.locator('#refresh-body-hook')).toBeVisible();
      await expect(evidence.page).toHaveURL(/\/lp\/refresh-safe-landing$/);
      expect(state.pageRequests).toHaveLength(2);
      await evidence.step('02-after-refresh-public-landing');

      evidence.note('Public landing stayed on the same slug, reloaded the same hero/form shell, and restored custom head/body markup after refresh.');
      await evidence.finalize('PASS', {
        extraLines: [
          'Public landing slug remained stable across page refresh: PASS',
          'Public landing hero, form shell, and injected markup reloaded cleanly after refresh: PASS',
        ],
      });
    } catch (error) {
      await evidence.finalize('FAIL', { error });
      throw error;
    }
  });
});
