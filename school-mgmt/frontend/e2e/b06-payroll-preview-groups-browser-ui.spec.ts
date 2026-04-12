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

type PreviewSession = {
  _id: string;
  classId: { _id: string; name: string; code: string };
  studentId: { _id: string; fullName: string; studentCode?: string };
  scheduledDate: string;
  durationMinutes: number;
  teacherPayout: number;
  status: string;
  hasTeachingReport: boolean;
  isTeacherPaid: boolean;
  isPaid: boolean;
  confirmation?: {
    teacherCompletedAt?: string;
    parentConfirmedAt?: string;
    autoConfirmedAt?: string;
    finalizedAt?: string;
  };
  teachingReport?: {
    lessonContent?: string;
    submittedAt?: string;
    isLateSubmission?: boolean;
  } | null;
  payrollStatus:
    | 'PAID'
    | 'ELIGIBLE'
    | 'BLOCKED_NO_REPORT'
    | 'WAITING_PARENT'
    | 'WAITING_FINALIZE'
    | 'CANCELLED'
    | 'NO_SHOW'
    | 'OTHER';
};

type PreviewPayload = {
  teacherId: string;
  periodStart: string;
  periodEnd: string;
  summary: {
    totalSessions: number;
    totalAttended: number;
    eligibleForPayroll: number;
    missingReport: number;
    pendingParentConfirm: number;
    pendingFinalize: number;
    finalizedNoReport: number;
    alreadyPaid: number;
    cancelled: number;
    noShow: number;
  };
  amounts: {
    totalEligiblePayout: number;
    totalAlreadyPaid: number;
    totalBlockedByReport: number;
    totalPendingConfirm: number;
    totalPendingFinalize: number;
    totalAttendedPayout: number;
  };
  sessions: PreviewSession[];
  existingPayrolls: any[];
};

type PreviewState = {
  preview: PreviewPayload;
  requestUrls: string[];
};

function appUrl(path: string): string {
  return new URL(path, APP_BASE_URL).toString();
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function formatMoney(value: number): string {
  return `${Number(value || 0).toLocaleString('vi-VN')}đ`;
}

function previewSession(overrides: Partial<PreviewSession> & Pick<PreviewSession, '_id' | 'scheduledDate' | 'teacherPayout' | 'payrollStatus'>): PreviewSession {
  return {
    _id: overrides._id,
    classId: overrides.classId || {
      _id: `class-${overrides._id}`,
      name: `Lop ${overrides._id}`,
      code: `CLS-${overrides._id}`,
    },
    studentId: overrides.studentId || {
      _id: `student-${overrides._id}`,
      fullName: `Hoc sinh ${overrides._id}`,
      studentCode: `HS-${overrides._id}`,
    },
    scheduledDate: overrides.scheduledDate,
    durationMinutes: overrides.durationMinutes ?? 90,
    teacherPayout: overrides.teacherPayout,
    status: overrides.status || 'TEACHER_COMPLETED',
    hasTeachingReport: overrides.hasTeachingReport ?? true,
    isTeacherPaid: overrides.isTeacherPaid ?? false,
    isPaid: overrides.isPaid ?? false,
    confirmation: overrides.confirmation || {},
    teachingReport: overrides.teachingReport ?? { lessonContent: 'Preview payroll coverage', submittedAt: '2026-04-10T03:00:00.000Z' },
    payrollStatus: overrides.payrollStatus,
  };
}

function buildPreviewState(): PreviewState {
  return {
    preview: {
      teacherId: 'teacher-preview-b06-001',
      periodStart: '2026-04-01',
      periodEnd: '2026-04-30',
      summary: {
        totalSessions: 5,
        totalAttended: 5,
        eligibleForPayroll: 0,
        missingReport: 0,
        pendingParentConfirm: 1,
        pendingFinalize: 1,
        finalizedNoReport: 1,
        alreadyPaid: 1,
        cancelled: 1,
        noShow: 0,
      },
      amounts: {
        totalEligiblePayout: 0,
        totalAlreadyPaid: 180_000,
        totalBlockedByReport: 260_000,
        totalPendingConfirm: 220_000,
        totalPendingFinalize: 240_000,
        totalAttendedPayout: 900_000,
      },
      sessions: [
        previewSession({
          _id: 'paid',
          scheduledDate: '2026-04-03T03:00:00.000Z',
          teacherPayout: 180_000,
          payrollStatus: 'PAID',
          classId: { _id: 'class-paid', name: 'Lop Da TT', code: 'CLS-PAID' },
          studentId: { _id: 'student-paid', fullName: 'Hoc sinh Da TT', studentCode: 'HS-PAID' },
          hasTeachingReport: true,
          isTeacherPaid: true,
          isPaid: true,
        }),
        previewSession({
          _id: 'waiting-parent',
          scheduledDate: '2026-04-05T03:00:00.000Z',
          teacherPayout: 220_000,
          payrollStatus: 'WAITING_PARENT',
          classId: { _id: 'class-parent', name: 'Lop Cho PH', code: 'CLS-PARENT' },
          studentId: { _id: 'student-parent', fullName: 'Hoc sinh Cho PH', studentCode: 'HS-PARENT' },
          hasTeachingReport: true,
        }),
        previewSession({
          _id: 'waiting-finalize',
          scheduledDate: '2026-04-07T03:00:00.000Z',
          teacherPayout: 240_000,
          payrollStatus: 'WAITING_FINALIZE',
          classId: { _id: 'class-finalize', name: 'Lop Cho OPS', code: 'CLS-OPS' },
          studentId: { _id: 'student-finalize', fullName: 'Hoc sinh Cho OPS', studentCode: 'HS-OPS' },
          hasTeachingReport: true,
        }),
        previewSession({
          _id: 'blocked-report',
          scheduledDate: '2026-04-09T03:00:00.000Z',
          teacherPayout: 260_000,
          payrollStatus: 'BLOCKED_NO_REPORT',
          classId: { _id: 'class-blocked', name: 'Lop Thieu Bao Cao', code: 'CLS-BLOCKED' },
          studentId: { _id: 'student-blocked', fullName: 'Hoc sinh Thieu BC', studentCode: 'HS-BLOCKED' },
          hasTeachingReport: false,
          teachingReport: null,
        }),
        previewSession({
          _id: 'cancelled',
          scheduledDate: '2026-04-11T03:00:00.000Z',
          teacherPayout: 0,
          payrollStatus: 'CANCELLED',
          classId: { _id: 'class-cancelled', name: 'Lop Huy', code: 'CLS-CANCELLED' },
          studentId: { _id: 'student-cancelled', fullName: 'Hoc sinh Huy', studentCode: 'HS-CANCELLED' },
          status: 'CANCELLED',
          hasTeachingReport: false,
          teachingReport: null,
        }),
      ],
      existingPayrolls: [],
    },
    requestUrls: [],
  };
}

async function routePayrollPreview(page: Page, state: PreviewState, delayMs = 0): Promise<void> {
  await page.route(PAYROLL_PREVIEW_API, async (route) => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }

    state.requestUrls.push(route.request().url());
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

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
): Promise<{ evidence: BatchEvidenceSession; teacherSession: any }> {
  const evidence = await createBatchEvidenceContext(browser, {
    batchId: 'B06',
    scenario,
    runDate: RUN_DATE,
  });
  const teacherSession = await loginAsRole(request, 'teacher');
  await applySessionCookies(evidence.page, teacherSession);
  await setup(evidence.page);
  await evidence.page.goto(appUrl('/app/payroll'));
  await evidence.page.waitForLoadState('domcontentloaded');
  return { evidence, teacherSession };
}

async function expectSingleSessionRow(page: Page, tabName: RegExp, className: string, studentName: string, payout: number, reason: RegExp): Promise<void> {
  await page.getByRole('button', { name: tabName }).click();
  const rows = page.locator('.session-table tbody tr');
  await expect(rows).toHaveCount(1);
  const row = rows.first();
  await expect(row).toContainText(className);
  await expect(row).toContainText(studentName);
  await expect(row).toContainText(formatMoney(payout));
  await expect(row).toContainText(reason);
}

test.use({
  trace: 'off',
  video: 'on',
});

test.describe.serial('B06 teacher payroll preview groups browser', () => {
  test('B06 teacher payroll preview clearly separates paid, waiting parent, waiting ops, blocked report, and cancelled groups', async ({
    browser,
    request,
  }) => {
    test.slow();
    test.setTimeout(300_000);

    const state = buildPreviewState();
    const { evidence } = await openPayrollPreview(
      browser,
      request,
      'teacher_payroll_preview_five_groups_browser',
      async (page) => {
        await routePayrollPreview(page, state, 450);
      },
    );

    try {
      await expect(evidence.page.locator('.loading')).toContainText(/Đang tải dữ liệu|Dang tai du lieu/i);
      await evidence.step('01-preview-loading');

      await expect(evidence.page.locator('h2')).toContainText(/Thanh toán lương giáo viên|Thanh toan luong giao vien/i);
      await expect(evidence.page.locator('.summary-grid .card')).toHaveCount(8);
      expect(state.requestUrls).toHaveLength(1);

      const previewRequest = new URL(state.requestUrls[0]);
      const dateInputs = evidence.page.locator('.filter-bar input[type="date"]');
      const periodStart = await dateInputs.first().inputValue();
      const periodEnd = await dateInputs.nth(1).inputValue();
      expect(previewRequest.searchParams.get('periodStart')).toBe(periodStart);
      expect(previewRequest.searchParams.get('periodEnd')).toBe(periodEnd);
      expect(String(previewRequest.searchParams.get('teacherId') || '')).not.toHaveLength(0);

      const totalAttendedCard = evidence.page.locator('.summary-grid .card').filter({ hasText: 'Tổng buổi đã dạy' }).first();
      await expect(totalAttendedCard.locator('.card-number')).toHaveText('5');
      await expect(totalAttendedCard).toContainText(formatMoney(900_000));

      const eligibleCard = evidence.page.locator('.summary-grid .card').filter({ hasText: 'Đủ điều kiện tính lương' }).first();
      await expect(eligibleCard.locator('.card-number')).toHaveText('0');
      await expect(eligibleCard).toContainText(formatMoney(0));

      const paidCard = evidence.page.locator('.summary-grid .card').filter({ hasText: 'Đã thanh toán' }).first();
      await expect(paidCard.locator('.card-number')).toHaveText('1');
      await expect(paidCard).toContainText(formatMoney(180_000));

      const waitingParentCard = evidence.page.locator('.summary-grid .card').filter({ hasText: 'Chờ PH xác nhận' }).first();
      await expect(waitingParentCard.locator('.card-number')).toHaveText('1');
      await expect(waitingParentCard).toContainText(formatMoney(220_000));

      const waitingOpsCard = evidence.page.locator('.summary-grid .card').filter({ hasText: 'Chờ OPS xác nhận' }).first();
      await expect(waitingOpsCard.locator('.card-number')).toHaveText('1');
      await expect(waitingOpsCard).toContainText(formatMoney(240_000));

      const blockedCard = evidence.page.locator('.summary-grid .card').filter({ hasText: 'Chờ - Thiếu báo cáo' }).first();
      await expect(blockedCard.locator('.card-number')).toHaveText('1');
      await expect(blockedCard).toContainText(formatMoney(260_000));

      const cancelledCard = evidence.page.locator('.summary-grid .card').filter({ hasText: 'Đã hủy' }).first();
      await expect(cancelledCard.locator('.card-number')).toHaveText('1');
      await evidence.step('02-summary-groups-visible');

      await expect(evidence.page.getByRole('button', { name: /Đã TT \(1\)|Da TT \(1\)/i })).toBeVisible();
      await expect(evidence.page.getByRole('button', { name: /Thiếu BC \(1\)|Thieu BC \(1\)/i })).toBeVisible();
      await expect(evidence.page.getByRole('button', { name: /Chờ PH \(1\)|Cho PH \(1\)/i })).toBeVisible();
      await expect(evidence.page.getByRole('button', { name: /Chờ OPS xác nhận \(1\)|Cho OPS xac nhan \(1\)/i })).toBeVisible();
      await expect(evidence.page.getByRole('button', { name: /Hủy \(1\)|Huy \(1\)/i })).toBeVisible();

      await expectSingleSessionRow(
        evidence.page,
        /Đã TT \(1\)|Da TT \(1\)/i,
        'Lop Da TT',
        'Hoc sinh Da TT',
        180_000,
        /Đã thanh toán|Da thanh toan/i,
      );
      await expectSingleSessionRow(
        evidence.page,
        /Chờ PH \(1\)|Cho PH \(1\)/i,
        'Lop Cho PH',
        'Hoc sinh Cho PH',
        220_000,
        /Chờ phụ huynh xác nhận|Cho phu huynh xac nhan/i,
      );
      await expectSingleSessionRow(
        evidence.page,
        /Chờ OPS xác nhận \(1\)|Cho OPS xac nhan \(1\)/i,
        'Lop Cho OPS',
        'Hoc sinh Cho OPS',
        240_000,
        /chưa được OPS Duyệt chốt|chua duoc OPS Duyet chot/i,
      );
      await expectSingleSessionRow(
        evidence.page,
        /Thiếu BC \(1\)|Thieu BC \(1\)/i,
        'Lop Thieu Bao Cao',
        'Hoc sinh Thieu BC',
        260_000,
        /thiếu Báo cáo giảng dạy|thieu Bao cao giang day/i,
      );
      await expectSingleSessionRow(
        evidence.page,
        /Hủy \(1\)|Huy \(1\)/i,
        'Lop Huy',
        'Hoc sinh Huy',
        0,
        /Đã hủy|Da huy/i,
      );
      await evidence.step('03-filter-tabs-track-five-groups');

      await evidence.finalize('PASS', {
        extraLines: [
          `Preview request: ${state.requestUrls[0]}`,
          'Summary cards visibly separate paid, waiting parent, waiting ops, missing report, and cancelled payroll groups.',
          'Session filter tabs now cover all five checklist groups, including CANCELLED.',
        ],
      });
    } catch (error) {
      await evidence.finalize('FAIL', { error });
      throw error;
    }
  });
});
