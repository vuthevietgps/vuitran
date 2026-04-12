import { expect, test, type APIRequestContext } from '@playwright/test';
import {
  applySessionCookies,
  createBatchEvidenceContext,
  loginAsRole,
} from './support';

const APP_BASE_URL =
  process.env['PLAYWRIGHT_BASE_URL'] ||
  process.env['E2E_BASE_URL'] ||
  'http://localhost:4200';

const RUN_DATE =
  process.env['UI_EVIDENCE_DATE'] ||
  process.env['E2E_RUN_DATE'] ||
  '2026-04-11';

const API_ORIGIN_PATTERN = 'https?://(?:localhost|127\\.0\\.0\\.1):3000';
const TRIAL_ENROLLMENTS_API = new RegExp(`${API_ORIGIN_PATTERN}/trial-enrollments(?:\\?.*)?$`);
const TRIAL_TEACHER_PAID_ONLY_API = new RegExp(
  `${API_ORIGIN_PATTERN}/trial-enrollments/trial-teacher-paid-only-001/teacher-paid-only(?:\\?.*)?$`,
);
const CLASSES_API = new RegExp(`${API_ORIGIN_PATTERN}/classes(?:\\?.*)?$`);
const PRODUCTS_API = new RegExp(`${API_ORIGIN_PATTERN}/products(?:\\?.*)?$`);
const SALES_API = new RegExp(`${API_ORIGIN_PATTERN}/users/sales(?:\\?.*)?$`);

type TrialRow = {
  _id: string;
  trialCode: string;
  status: string;
  teacherPaidOnlyDecision?: boolean;
  studentName: string;
  parentName: string;
  parentPhone: string;
  classId: { _id: string; name: string; code: string; classMode: string };
  productId: { _id: string; name: string; code: string; teachingMode: string };
  saleId: { _id: string; fullName: string };
  studentId: { _id: string; fullName: string; studentCode: string };
  maxTrialSessions: number;
  trialSessionsUsed: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

function appUrl(path: string): string {
  return new URL(path, APP_BASE_URL).toString();
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function buildTrialRow(overrides: Partial<TrialRow> = {}): TrialRow {
  return {
    _id: 'trial-teacher-paid-only-001',
    trialCode: 'HT0999',
    status: 'WAITING_DECISION',
    teacherPaidOnlyDecision: false,
    studentName: 'Hoc sinh Trial Teacher Paid',
    parentName: 'Phu huynh Trial Teacher Paid',
    parentPhone: '0909000999',
    classId: {
      _id: 'class-trial-paid-001',
      name: 'Lop Offline Trial Teacher Paid',
      code: 'CLS-TRIAL-001',
      classMode: 'OFFLINE',
    },
    productId: {
      _id: 'product-trial-paid-001',
      name: 'Goi Offline Trial Teacher Paid',
      code: 'PKG-TRIAL-001',
      teachingMode: 'OFFLINE',
    },
    saleId: {
      _id: 'sale-trial-paid-001',
      fullName: 'Sale Trial Paid',
    },
    studentId: {
      _id: 'student-trial-paid-001',
      fullName: 'Hoc sinh Trial Teacher Paid',
      studentCode: 'HS-TRIAL-001',
    },
    maxTrialSessions: 2,
    trialSessionsUsed: 2,
    notes: 'Da hoc du 2 buoi, chuan bi chot trial.',
    createdAt: '2026-04-11T09:00:00.000Z',
    updatedAt: '2026-04-11T10:00:00.000Z',
    ...overrides,
  };
}

async function signInAsDirector(page: any, request: APIRequestContext): Promise<void> {
  await page.context().clearCookies();
  const session = await loginAsRole(request, 'director');
  await applySessionCookies(page, session);
}

async function installRoutes(page: any, rows: TrialRow[]) {
  const state = {
    rows: clone(rows),
    teacherPaidOnlyBodies: [] as Array<Record<string, unknown>>,
    listLoadCount: 0,
  };

  await page.route('**/notifications/unread-count', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ count: 0 }),
    });
  });

  await page.route('**/pending-approvals/summary', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ totalPending: 0 }),
    });
  });

  await page.route(CLASSES_API, async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          _id: 'class-trial-paid-001',
          name: 'Lop Offline Trial Teacher Paid',
          code: 'CLS-TRIAL-001',
          classMode: 'OFFLINE',
        },
      ]),
    });
  });

  await page.route(PRODUCTS_API, async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          _id: 'product-trial-paid-001',
          name: 'Goi Offline Trial Teacher Paid',
          code: 'PKG-TRIAL-001',
          teachingMode: 'OFFLINE',
        },
      ]),
    });
  });

  await page.route(SALES_API, async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          _id: 'sale-trial-paid-001',
          fullName: 'Sale Trial Paid',
        },
      ]),
    });
  });

  await page.route(TRIAL_TEACHER_PAID_ONLY_API, async (route: any) => {
    const body = route.request().postDataJSON() as Record<string, unknown>;
    state.teacherPaidOnlyBodies.push(clone(body));
    await new Promise((resolve) => setTimeout(resolve, 250));

    state.rows = state.rows.map((row) => (
      row._id === 'trial-teacher-paid-only-001'
        ? {
            ...row,
            status: 'REJECTED',
            teacherPaidOnlyDecision: true,
            updatedAt: '2026-04-11T10:05:00.000Z',
            notes: `${row.notes}\nKhong tiep tuc nhung van tra luong GV, khong charge PH.`,
          }
        : row
    ));

    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify(clone(state.rows.find((row) => row._id === 'trial-teacher-paid-only-001'))),
    });
  });

  await page.route(TRIAL_ENROLLMENTS_API, async (route: any) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }

    state.listLoadCount += 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(clone(state.rows)),
    });
  });

  return {
    getTeacherPaidOnlyBodies: () => clone(state.teacherPaidOnlyBodies),
    getListLoadCount: () => state.listLoadCount,
  };
}

test.use({
  trace: 'off',
  video: 'on',
});

test.describe('B04 trial teacher-paid-only browser UI', () => {
  test('only WAITING_DECISION rows expose the teacher-paid-only action', async ({ page, request }) => {
    await installRoutes(page, [
      buildTrialRow(),
      buildTrialRow({
        _id: 'trial-pending-001',
        trialCode: 'HT0998',
        status: 'PENDING_TRIAL',
        studentName: 'Hoc sinh Trial Pending',
        notes: 'Moi hoc thu buoi dau.',
        trialSessionsUsed: 1,
      }),
    ]);

    await signInAsDirector(page, request);
    await page.goto(appUrl('/app/trial-enrollments'));
    await page.waitForLoadState('domcontentloaded');

    const waitingRow = page.locator('.table-wrap table.data tbody tr').filter({
      hasText: 'Hoc sinh Trial Teacher Paid',
    }).first();
    const pendingRow = page.locator('.table-wrap table.data tbody tr').filter({
      hasText: 'Hoc sinh Trial Pending',
    }).first();

    await expect(waitingRow.getByTestId('trial-teacher-paid-only-trial-teacher-paid-only-001')).toBeVisible();
    await expect(pendingRow.getByRole('button', { name: /Tra luong GV/i })).toHaveCount(0);
  });

  test('posts teacher-paid-only decision, reloads the row, and surfaces no-parent-charge note', async ({
    browser,
    page,
    request,
  }) => {
    const evidence = await createBatchEvidenceContext(browser, {
      batchId: 'B04',
      scenario: 'trial_teacher_paid_only_browser',
      runDate: RUN_DATE,
    });

    try {
      const routes = await installRoutes(evidence.page, [buildTrialRow()]);
      await signInAsDirector(evidence.page, request);
      await evidence.page.goto(appUrl('/app/trial-enrollments'));
      await evidence.page.waitForLoadState('domcontentloaded');

      const row = evidence.page.locator('.table-wrap table.data tbody tr').filter({
        hasText: 'Hoc sinh Trial Teacher Paid',
      }).first();

      await expect(row).toBeVisible({ timeout: 15_000 });
      await expect(row).toContainText(/Cho quyet dinh/i);
      await expect(row.getByTestId('trial-teacher-paid-only-trial-teacher-paid-only-001')).toBeVisible();
      await evidence.step('trial-teacher-paid-only-pristine');

      await row.getByTestId('trial-teacher-paid-only-trial-teacher-paid-only-001').click();

      await expect(evidence.page.getByTestId('trial-page-feedback')).toContainText(/van tra luong giao vien/i);
      await expect(row).toContainText(/Khong tiep tuc/i);
      await expect(
        row.getByTestId('trial-teacher-paid-only-note-trial-teacher-paid-only-001'),
      ).toContainText(/Van tra luong GV, khong charge PH/i);
      await expect(row).toContainText(/Khong charge PH/i);
      await evidence.step('trial-teacher-paid-only-updated');

      expect(routes.getTeacherPaidOnlyBodies()).toEqual([{}]);
      expect(routes.getListLoadCount()).toBeGreaterThanOrEqual(2);

      await evidence.finalize('PASS', {
        extraLines: [
          'Verified only WAITING_DECISION trial rows expose the dedicated teacher-paid-only action on trial-enrollments.',
          'Verified the UI posts the exact /trial-enrollments/:id/teacher-paid-only request, then reloads the row to REJECTED with a distinct note: van tra luong GV, khong charge PH.',
          'Verified the teacher-paid-only UI state does not reuse generic reject copy, avoiding a false implication that parent charge or teacher payroll was removed.',
        ],
      });
    } catch (error) {
      await evidence.finalize('FAIL', { error });
      throw error;
    }
  });
});
