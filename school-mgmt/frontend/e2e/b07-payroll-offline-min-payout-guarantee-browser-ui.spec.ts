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

async function clearViteOverlay(page: Page): Promise<void> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    if ((await page.locator('vite-error-overlay').count()) === 0) {
      return;
    }
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(150);
    if ((await page.locator('vite-error-overlay').count()) === 0) {
      return;
    }
    await page.reload({ waitUntil: 'domcontentloaded' });
  }
  await expect(page.locator('vite-error-overlay')).toHaveCount(0);
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

test('B07 payroll preview shows offline minimum guarantee separately from actual teaching pay with an explicit reason', async ({
  browser,
  request,
}) => {
  test.slow();
  test.setTimeout(300_000);

  const state: PreviewState = {
    preview: {
      teacherId: 'teacher-preview-b07-min-guarantee-001',
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
        totalEligiblePayout: 200_000,
        totalAlreadyPaid: 0,
        totalBlockedByReport: 0,
        totalPendingConfirm: 0,
        totalPendingFinalize: 0,
        totalHeldPayout: 0,
        totalAttendedPayout: 200_000,
        totalOfflineMinGuaranteeAmount: 140_000,
      },
      sessions: [
        {
          _id: 'session-min-guarantee-001',
          classId: {
            _id: 'class-min-guarantee-001',
            name: 'Lop Offline Bao Chung',
            code: 'CLS-MIN',
            classMode: 'OFFLINE',
            teacherPayPerStudent: 60_000,
          },
          classMode: 'OFFLINE',
          studentId: {
            _id: 'student-min-guarantee-001',
            fullName: 'Hoc sinh Vang Nhieu',
            studentCode: 'HS-MIN',
          },
          scheduledDate: '2026-04-09T02:00:00.000Z',
          durationMinutes: 60,
          teacherPayout: 200_000,
          offlineBasePayout: 60_000,
          offlineMinGuaranteeAmount: 140_000,
          offlineMinGuaranteeFloor: 200_000,
          offlineMinGuaranteeApplied: true,
          finalPayout: 200_000,
          status: 'FINALIZED',
          hasTeachingReport: true,
          isTeacherPaid: false,
          isPaid: false,
          confirmation: {
            finalizedAt: '2026-04-10T03:00:00.000Z',
          },
          teachingReport: {
            lessonContent: 'Buoi hoc offline can bao chung muc toi thieu do si so vang nhieu.',
            submittedAt: '2026-04-10T02:30:00.000Z',
            isLateSubmission: false,
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
    'payroll_offline_min_payout_guarantee_browser',
    async (page) => {
      await routePayrollPreview(page, state);
    },
  );

  try {
    await clearViteOverlay(evidence.page);

    const dateInputs = evidence.page.locator('.filter-bar input[type="date"]');
    await dateInputs.first().fill(state.preview.periodStart);
    await dateInputs.first().dispatchEvent('change');
    await dateInputs.nth(1).fill(state.preview.periodEnd);
    await dateInputs.nth(1).dispatchEvent('change');
    await clearViteOverlay(evidence.page);
    await evidence.page.getByRole('button', { name: /^Xem$/ }).click();

    const eligibleTab = evidence.page.getByRole('button', { name: /Đủ ĐK lương \(1\)|Du DK luong \(1\)/i });
    await expect(eligibleTab).toBeVisible();
    await eligibleTab.click();

    const rows = evidence.page.locator('.session-table tbody tr');
    await expect(rows).toHaveCount(1);
    const row = rows.first();
    await expect(row).toContainText('Lop Offline Bao Chung');
    await expect(row).toContainText('Hoc sinh Vang Nhieu');
    await expect(row.locator('.badge-eligible')).toHaveText(/Sẵn sàng TT|San sang TT/i);
    await expect(row.locator('.gross-amount')).toHaveText('60.000đ');
    await expect(row.locator('.offline-min-guarantee-amount')).toHaveText('Bảo chứng tối thiểu: +140.000đ');
    await expect(row.locator('.guarantee-net-amount')).toHaveText('Thực nhận: 200.000đ');
    await expect(row.locator('.guarantee-reason-token')).toHaveText('OFFLINE_MIN_GUARANTEE');
    await expect(row.locator('.guarantee-reason-label')).toHaveText('OFFLINE tối thiểu 200.000đ');
    await expect(row.locator('.guarantee-reason-detail')).toHaveText(
      'Lương thực tế 60.000đ, bù 140.000đ do sĩ số điểm danh thấp.',
    );
    await evidence.step('01_payroll_preview_shows_offline_min_payout_guarantee');

    expect(state.requestUrls.length).toBeGreaterThanOrEqual(1);
    await evidence.finalize('PASS', {
      extraLines: [
        `Preview request count: ${state.requestUrls.length}.`,
        'Browser evidence proves payroll preview separates the actual offline teaching pay from the minimum-guarantee top-up instead of hiding both inside one payout number.',
        'The same row now shows actual pay 60.000đ, guarantee top-up 140.000đ, final payout 200.000đ, and an explicit OFFLINE_MIN_GUARANTEE reason.',
      ],
    });
  } catch (error) {
    await evidence.finalize('FAIL', { error });
    throw error;
  }
});
