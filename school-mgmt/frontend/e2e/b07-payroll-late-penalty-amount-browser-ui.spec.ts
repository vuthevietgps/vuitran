import { expect, test, type APIRequestContext, type Browser, type Page } from '@playwright/test';
import {
  applySessionCookies,
  createBatchEvidenceContext,
  loginAsRole,
  type BatchEvidenceSession,
} from './support';

const APP_BASE_URL =
  process.env['PLAYWRIGHT_BASE_URL'] ||
  process.env['E2E_BASE_URL'] ||
  'http://localhost:4200';

const RUN_DATE =
  process.env['UI_EVIDENCE_DATE'] ||
  process.env['E2E_RUN_DATE'] ||
  '2026-04-11';

const API_PREFIX_PATTERN = '(?:https?://[^/]+)?(?:/api)?';
const PAYROLL_PREVIEW_API = new RegExp(`${API_PREFIX_PATTERN}/payroll/teacher-preview(?:\\?.*)?$`);

type PreviewState = {
  preview: any;
  requestUrls: string[];
};

function appUrl(path: string): string {
  return new URL(path, APP_BASE_URL).toString();
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

async function routePayrollPreview(page: Page, state: PreviewState): Promise<void> {
  await page.route(PAYROLL_PREVIEW_API, async (route) => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }

    state.requestUrls.push(route.request().url());
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(clone(state.preview)),
    });
  });
}

async function openPayrollPreview(
  browser: Browser,
  request: APIRequestContext,
  scenario: string,
  setup: (page: Page) => Promise<void> | void,
): Promise<{ evidence: BatchEvidenceSession }> {
  const evidence = await createBatchEvidenceContext(browser, {
    batchId: 'B07',
    scenario,
    runDate: RUN_DATE,
  });
  const teacherSession = await loginAsRole(request, 'teacher');
  await applySessionCookies(evidence.page, teacherSession);
  await setup(evidence.page);
  await evidence.page.goto(appUrl('/app/payroll'));
  await evidence.page.waitForLoadState('domcontentloaded');
  return { evidence };
}

test.use({
  trace: 'off',
  video: 'on',
});

test('B07 payroll preview shows late-report penalty as a separate exact amount instead of hiding it inside the payout total', async ({
  browser,
  request,
}) => {
  test.slow();
  test.setTimeout(300_000);

  const state: PreviewState = {
    preview: {
      teacherId: 'teacher-preview-b07-penalty-001',
      periodStart: '2026-04-01',
      periodEnd: '2026-04-30',
      summary: {
        totalSessions: 1,
        totalAttended: 1,
        eligibleForPayroll: 1,
        missingReport: 0,
        pendingParentConfirm: 0,
        pendingFinalize: 0,
        finalizedNoReport: 0,
        heldCount: 0,
        alreadyPaid: 0,
        cancelled: 0,
        noShow: 0,
      },
      amounts: {
        totalEligiblePayout: 120_000,
        totalAlreadyPaid: 0,
        totalBlockedByReport: 0,
        totalPendingConfirm: 0,
        totalPendingFinalize: 0,
        totalHeldPayout: 0,
        totalAttendedPayout: 120_000,
      },
      sessions: [
        {
          _id: 'session-late-penalty-001',
          classId: { _id: 'class-penalty-001', name: 'Lop Bao Cao Tre', code: 'CLS-LATE' },
          studentId: { _id: 'student-penalty-001', fullName: 'Hoc sinh Bao Cao Tre', studentCode: 'HS-LATE' },
          scheduledDate: '2026-04-08T02:00:00.000Z',
          durationMinutes: 60,
          teacherPayout: 120_000,
          penaltyAmount: 36_000,
          finalPayout: 84_000,
          isLateReport: true,
          lateHours: 72,
          status: 'FINALIZED',
          hasTeachingReport: true,
          isTeacherPaid: false,
          isPaid: false,
          confirmation: {
            finalizedAt: '2026-04-11T03:00:00.000Z',
          },
          teachingReport: {
            lessonContent: 'Nop bao cao tre de kiem tra penalty preview.',
            submittedAt: '2026-04-11T02:30:00.000Z',
            isLateSubmission: true,
          },
          payrollStatus: 'ELIGIBLE',
        },
      ],
      existingPayrolls: [],
    },
    requestUrls: [],
  };

  const { evidence } = await openPayrollPreview(
    browser,
    request,
    'payroll_late_penalty_amount_browser',
    async (page) => {
      await routePayrollPreview(page, state);
    },
  );

  try {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      if ((await evidence.page.locator('vite-error-overlay').count()) === 0) {
        break;
      }
      await evidence.page.reload({ waitUntil: 'domcontentloaded' });
    }
    await expect(evidence.page.locator('vite-error-overlay')).toHaveCount(0);

    const dateInputs = evidence.page.locator('.filter-bar input[type="date"]');
    await dateInputs.first().fill(state.preview.periodStart);
    await dateInputs.first().dispatchEvent('change');
    await dateInputs.nth(1).fill(state.preview.periodEnd);
    await dateInputs.nth(1).dispatchEvent('change');
    await evidence.page.getByRole('button', { name: /^Xem$/ }).click();

    const eligibleTab = evidence.page.getByRole('button', { name: /Đủ ĐK lương \(1\)|Du DK luong \(1\)/i });
    await expect(eligibleTab).toBeVisible();
    await eligibleTab.click();

    const rows = evidence.page.locator('.session-table tbody tr');
    await expect(rows).toHaveCount(1);
    const row = rows.first();
    await expect(row).toContainText('Lop Bao Cao Tre');
    await expect(row).toContainText('Hoc sinh Bao Cao Tre');
    await expect(row.locator('.badge-eligible')).toHaveText(/Sẵn sàng TT|San sang TT/i);
    await expect(row.locator('.late-badge')).toHaveText('Trễ');
    await expect(row.locator('.gross-amount')).toHaveText('120.000đ');
    await expect(row.locator('.late-penalty-amount')).toHaveText('Phạt: -36.000đ');
    await expect(row.locator('.late-net-amount')).toHaveText('Thực nhận: 84.000đ');
    await evidence.step('01_payroll_preview_shows_late_penalty_amount');

    expect(state.requestUrls.length).toBeGreaterThanOrEqual(1);
    await evidence.finalize('PASS', {
      extraLines: [
        `Preview request count: ${state.requestUrls.length}.`,
        'Browser evidence proves the late-report penalty is rendered as a dedicated exact amount instead of being hidden inside the gross teacher payout.',
        'The same row now shows gross 120.000đ, penalty 36.000đ, and final payout 84.000đ with the existing Trễ badge preserved.',
      ],
    });
  } catch (error) {
    await evidence.finalize('FAIL', { error });
    throw error;
  }
});
