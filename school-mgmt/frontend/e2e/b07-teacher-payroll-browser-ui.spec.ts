import { expect, test, type Locator, type Page } from '@playwright/test';
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

const API_PREFIX_PATTERN = '(?:https?://[^/]+)?(?:/api)?';
const USERS_TEACHERS_API = new RegExp(`^${API_PREFIX_PATTERN}/users/teachers(?:\\?.*)?$`);
const PAYROLL_PREVIEW_API = new RegExp(`^${API_PREFIX_PATTERN}/payroll/teacher-preview(?:\\?.*)?$`);
const PAYROLL_LIST_API = new RegExp(`^${API_PREFIX_PATTERN}/payroll(?:\\?.*)?$`);
const PAYROLL_DETAIL_API = new RegExp(`^${API_PREFIX_PATTERN}/payroll/(?!teacher-preview(?:\\?|$))[^/?#]+(?:/(?:submit|approve|reject|reopen|mark-paid))?(?:\\?.*)?$`);
const PAYROLL_ITEMS_API = new RegExp(`^${API_PREFIX_PATTERN}/payroll/[^/?#]+/items(?:\\?.*)?$`);

type PayrollStatus = 'DRAFT' | 'PENDING_REVIEW' | 'APPROVED' | 'PAID' | 'REJECTED';

type TeacherDirectoryItem = {
  _id: string;
  email: string;
  fullName: string;
  role: 'TEACHER';
};

type PayrollRecord = {
  _id: string;
  payrollCode: string;
  teacherId: {
    _id: string;
    fullName: string;
    email: string;
  };
  periodStart: string;
  periodEnd: string;
  totalSessions: number;
  grossAmount: number;
  adjustmentAmount: number;
  bonusAmount: number;
  deductionAmount: number;
  netAmount: number;
  status: PayrollStatus;
  notes?: string;
  rejectionReason?: string;
  paymentRef?: string;
};

type PayrollPreviewSession = {
  _id: string;
  classId?: { _id: string; name: string; code: string };
  studentId?: { _id: string; fullName: string; studentCode?: string };
  scheduledDate: string;
  durationMinutes: number;
  teacherPayout: number;
  payrollStatus:
    | 'ELIGIBLE'
    | 'PAID'
    | 'BLOCKED_NO_REPORT'
    | 'WAITING_PARENT'
    | 'WAITING_FINALIZE'
    | 'CANCELLED'
    | 'NO_SHOW'
    | 'OTHER';
  hasTeachingReport: boolean;
  teachingReport?: {
    lessonContent?: string;
    submittedAt?: string;
    isLateSubmission?: boolean;
  } | null;
};

type PayrollPreviewState = {
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
  sessions: PayrollPreviewSession[];
  existingPayrolls: PayrollRecord[];
};

type PayrollItemDetail = {
  _id: string;
  payrollId: string;
  sessionDate: string;
  classId?: {
    _id: string;
    name: string;
    code: string;
  };
  studentId?: {
    _id: string;
    fullName: string;
    studentCode: string;
  };
  teacherPayout: number;
  adjustedPayout: number;
  adjustmentReason?: string;
  status: 'INCLUDED' | 'EXCLUDED' | 'ADJUSTED';
};

function appUrl(path: string): string {
  return new URL(path, APP_BASE_URL).toString();
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function netAmount(payroll: Pick<PayrollRecord, 'grossAmount' | 'adjustmentAmount' | 'bonusAmount' | 'deductionAmount'>): number {
  return payroll.grossAmount + payroll.adjustmentAmount + payroll.bonusAmount - payroll.deductionAmount;
}

function payrollRow(page: Page, payrollCode: string): Locator {
  return page.locator('table.data-table tbody tr').filter({ hasText: payrollCode }).first();
}

function payrollDetailModal(page: Page): Locator {
  return page.locator('.modal-overlay .large-modal').filter({ hasText: 'Chi tiết bảng lương' });
}

function editPayrollModal(page: Page): Locator {
  return page.locator('.modal-overlay .modal-content').filter({ hasText: 'Điều chỉnh bảng lương' });
}

function actionButton(scope: Locator, name: RegExp): Locator {
  return scope.getByRole('button', { name });
}

test.use({ video: 'on' });
test.describe.configure({ mode: 'serial', timeout: 180_000 });

test('B07 teacher payroll lifecycle covers preview generate update submit reject reopen approve mark-paid and delete with exact payloads', async ({
  browser,
  request,
}) => {
  test.slow();

  const evidence = await createBatchEvidenceContext(browser, {
    batchId: 'B07',
    scenario: 'teacher_payroll_lifecycle_browser',
    runDate: RUN_DATE,
  });

  const directorSession = await loginAsRole(request, 'director');

  const teacher: TeacherDirectoryItem = {
    _id: 'teacher-payroll-001',
    email: 'teacher.payroll.one@example.com',
    fullName: 'Teacher Payroll One',
    role: 'TEACHER',
  };

  const expectedGeneratePayload = {
    teacherId: teacher._id,
    periodStart: '2026-04-01',
    periodEnd: '2026-04-30',
  };

  const expectedUpdatePayload = {
    bonusAmount: 150000,
    deductionAmount: 20000,
    notes: 'Điều chỉnh tháng 4',
  };

  const expectedRejectPayload = { reason: 'Thiếu xác nhận cuối tháng' };
  const expectedMarkPaidPayload = { paymentRef: 'BANK-TCH-2026-04' };

  const workflowPayroll: PayrollRecord = {
    _id: 'payroll-teacher-001',
    payrollCode: 'PR-TCH-2026-04-001',
    teacherId: clone(teacher),
    periodStart: '2026-04-01T00:00:00.000Z',
    periodEnd: '2026-04-30T00:00:00.000Z',
    totalSessions: 2,
    grossAmount: 1600000,
    adjustmentAmount: 0,
    bonusAmount: 0,
    deductionAmount: 0,
    netAmount: 1600000,
    status: 'DRAFT',
    notes: '',
  };

  const deletePayroll: PayrollRecord = {
    _id: 'payroll-delete-001',
    payrollCode: 'PR-TCH-DELETE-001',
    teacherId: clone(teacher),
    periodStart: '2026-04-01T00:00:00.000Z',
    periodEnd: '2026-04-30T00:00:00.000Z',
    totalSessions: 1,
    grossAmount: 500000,
    adjustmentAmount: 0,
    bonusAmount: 0,
    deductionAmount: 0,
    netAmount: 500000,
    status: 'DRAFT',
    notes: 'Delete target',
  };

  const workflowItems: PayrollItemDetail[] = [
    {
      _id: 'payroll-item-001',
      payrollId: workflowPayroll._id,
      sessionDate: '2026-04-11T00:00:00.000Z',
      classId: { _id: 'class-001', name: 'Toán nâng cao', code: 'MTH-ADV' },
      studentId: { _id: 'student-001', fullName: 'Student One', studentCode: 'HS001' },
      teacherPayout: 800000,
      adjustedPayout: 800000,
      status: 'INCLUDED',
    },
    {
      _id: 'payroll-item-002',
      payrollId: workflowPayroll._id,
      sessionDate: '2026-04-18T00:00:00.000Z',
      classId: { _id: 'class-001', name: 'Toán nâng cao', code: 'MTH-ADV' },
      studentId: { _id: 'student-002', fullName: 'Student Two', studentCode: 'HS002' },
      teacherPayout: 800000,
      adjustedPayout: 800000,
      status: 'INCLUDED',
    },
  ];

  const deleteItems: PayrollItemDetail[] = [
    {
      _id: 'payroll-delete-item-001',
      payrollId: deletePayroll._id,
      sessionDate: '2026-04-20T00:00:00.000Z',
      classId: { _id: 'class-002', name: 'Văn cơ bản', code: 'VAN-BASIC' },
      studentId: { _id: 'student-003', fullName: 'Student Delete', studentCode: 'HS003' },
      teacherPayout: 500000,
      adjustedPayout: 500000,
      status: 'INCLUDED',
    },
  ];

  const previewSessions: PayrollPreviewSession[] = [
    {
      _id: 'session-001',
      classId: { _id: 'class-001', name: 'Toán nâng cao', code: 'MTH-ADV' },
      studentId: { _id: 'student-001', fullName: 'Student One', studentCode: 'HS001' },
      scheduledDate: '2026-04-11T00:00:00.000Z',
      durationMinutes: 90,
      teacherPayout: 800000,
      payrollStatus: 'ELIGIBLE',
      hasTeachingReport: true,
      teachingReport: { lessonContent: 'Ôn tập đại số', submittedAt: '2026-04-11T11:00:00.000Z' },
    },
    {
      _id: 'session-002',
      classId: { _id: 'class-001', name: 'Toán nâng cao', code: 'MTH-ADV' },
      studentId: { _id: 'student-002', fullName: 'Student Two', studentCode: 'HS002' },
      scheduledDate: '2026-04-18T00:00:00.000Z',
      durationMinutes: 90,
      teacherPayout: 800000,
      payrollStatus: 'ELIGIBLE',
      hasTeachingReport: true,
      teachingReport: { lessonContent: 'Ôn tập hình học', submittedAt: '2026-04-18T11:00:00.000Z' },
    },
  ];

  let previewState: PayrollPreviewState = {
    teacherId: teacher._id,
    periodStart: '2026-04-01',
    periodEnd: '2026-04-30',
    summary: {
      totalSessions: 2,
      totalAttended: 2,
      eligibleForPayroll: 2,
      missingReport: 0,
      pendingParentConfirm: 0,
      pendingFinalize: 0,
      finalizedNoReport: 0,
      alreadyPaid: 0,
      cancelled: 0,
      noShow: 0,
    },
    amounts: {
      totalEligiblePayout: 1600000,
      totalAlreadyPaid: 0,
      totalBlockedByReport: 0,
      totalPendingConfirm: 0,
      totalPendingFinalize: 0,
      totalAttendedPayout: 1600000,
    },
    sessions: clone(previewSessions),
    existingPayrolls: [],
  };

  let listState: PayrollRecord[] = [clone(deletePayroll)];
  const detailById: Record<string, PayrollRecord> = {
    [deletePayroll._id]: clone(deletePayroll),
  };
  const itemsByPayrollId: Record<string, PayrollItemDetail[]> = {
    [deletePayroll._id]: clone(deleteItems),
  };

  const previewQueries: Array<{ teacherId: string | null; periodStart: string | null; periodEnd: string | null }> = [];
  const listQueries: Array<{ page: string | null; limit: string | null; status: string | null }> = [];
  const generateBodies: unknown[] = [];
  const updateBodies: unknown[] = [];
  const submitBodies: unknown[] = [];
  const approveBodies: unknown[] = [];
  const rejectBodies: unknown[] = [];
  const reopenBodies: unknown[] = [];
  const markPaidBodies: unknown[] = [];
  const deleteIds: string[] = [];

  function upsertPayroll(payroll: PayrollRecord): void {
    const currentIndex = listState.findIndex((entry) => entry._id === payroll._id);
    if (currentIndex === -1) {
      listState = [clone(payroll), ...listState];
    } else {
      listState = listState.map((entry) => (entry._id === payroll._id ? clone(payroll) : entry));
    }
    detailById[payroll._id] = clone(payroll);
  }

  function setWorkflowStatus(status: PayrollStatus): void {
    const current = detailById[workflowPayroll._id];
    if (!current) return;
    const next: PayrollRecord = {
      ...current,
      status,
    };
    if (status !== 'REJECTED') delete next.rejectionReason;
    if (status !== 'PAID') delete next.paymentRef;
    upsertPayroll(next);
  }

  try {
    await evidence.page.route(USERS_TEACHERS_API, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([teacher]),
      });
    });

    await evidence.page.route(PAYROLL_PREVIEW_API, async (route) => {
      const url = new URL(route.request().url());
      previewQueries.push({
        teacherId: url.searchParams.get('teacherId'),
        periodStart: url.searchParams.get('periodStart'),
        periodEnd: url.searchParams.get('periodEnd'),
      });
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(clone(previewState)),
      });
    });

    await evidence.page.route(PAYROLL_LIST_API, async (route) => {
      const requestMethod = route.request().method();
      if (requestMethod === 'GET') {
        const url = new URL(route.request().url());
        listQueries.push({
          page: url.searchParams.get('page'),
          limit: url.searchParams.get('limit'),
          status: url.searchParams.get('status'),
        });
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: clone(listState),
            meta: {
              total: listState.length,
              page: 1,
              limit: 20,
              totalPages: 1,
            },
          }),
        });
        return;
      }

      if (requestMethod === 'POST') {
        const body = route.request().postDataJSON();
        generateBodies.push(body);
        upsertPayroll(workflowPayroll);
        itemsByPayrollId[workflowPayroll._id] = clone(workflowItems);
        previewState = {
          ...previewState,
          summary: {
            ...previewState.summary,
            eligibleForPayroll: 0,
          },
          amounts: {
            ...previewState.amounts,
            totalEligiblePayout: 0,
          },
          existingPayrolls: [clone(detailById[workflowPayroll._id])],
        };
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            _id: workflowPayroll._id,
            payrollCode: workflowPayroll.payrollCode,
          }),
        });
        return;
      }

      await route.fallback();
    });

    await evidence.page.route(PAYROLL_ITEMS_API, async (route) => {
      const path = new URL(route.request().url()).pathname;
      const match = path.match(/^(?:\/api)?\/payroll\/([^/]+)\/items$/);
      if (!match) {
        await route.fallback();
        return;
      }

      const payrollId = match[1];
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(clone(itemsByPayrollId[payrollId] || [])),
      });
    });

    await evidence.page.route(PAYROLL_DETAIL_API, async (route) => {
      const requestMethod = route.request().method();
      const path = new URL(route.request().url()).pathname;
      const detailMatch = path.match(/^(?:\/api)?\/payroll\/((?!teacher-preview$)[^/]+)$/);
      const actionMatch = path.match(/^(?:\/api)?\/payroll\/([^/]+)\/(submit|approve|reject|reopen|mark-paid)$/);

      if (requestMethod === 'GET' && detailMatch) {
        const payrollId = detailMatch[1];
        await route.fulfill({
          status: detailById[payrollId] ? 200 : 404,
          contentType: 'application/json',
          body: JSON.stringify(clone(detailById[payrollId] || null)),
        });
        return;
      }

      if (requestMethod === 'PATCH' && detailMatch) {
        const payrollId = detailMatch[1];
        const body = route.request().postDataJSON();
        updateBodies.push(body);
        const current = detailById[payrollId];
        if (current) {
          const next: PayrollRecord = {
            ...current,
            bonusAmount: expectedUpdatePayload.bonusAmount,
            deductionAmount: expectedUpdatePayload.deductionAmount,
            notes: expectedUpdatePayload.notes,
          };
          next.netAmount = netAmount(next);
          upsertPayroll(next);
        }
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(clone(detailById[payrollId] || null)),
        });
        return;
      }

      if (requestMethod === 'DELETE' && detailMatch) {
        const payrollId = detailMatch[1];
        deleteIds.push(payrollId);
        listState = listState.filter((entry) => entry._id !== payrollId);
        delete detailById[payrollId];
        delete itemsByPayrollId[payrollId];
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ok: true }),
        });
        return;
      }

      if (requestMethod === 'POST' && actionMatch) {
        const payrollId = actionMatch[1];
        const action = actionMatch[2];
        const body = route.request().postDataJSON();

        if (action === 'submit') {
          submitBodies.push(body);
          setWorkflowStatus('PENDING_REVIEW');
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ ok: true }),
          });
          return;
        }

        if (action === 'approve') {
          approveBodies.push(body);
          setWorkflowStatus('APPROVED');
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ ok: true }),
          });
          return;
        }

        if (action === 'reject') {
          rejectBodies.push(body);
          const current = detailById[payrollId];
          if (current) {
            upsertPayroll({
              ...current,
              status: 'REJECTED',
              rejectionReason: expectedRejectPayload.reason,
            });
          }
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ ok: true }),
          });
          return;
        }

        if (action === 'reopen') {
          reopenBodies.push(body);
          setWorkflowStatus('DRAFT');
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ ok: true }),
          });
          return;
        }

        if (action === 'mark-paid') {
          markPaidBodies.push(body);
          const current = detailById[payrollId];
          if (current) {
            upsertPayroll({
              ...current,
              status: 'PAID',
              paymentRef: expectedMarkPaidPayload.paymentRef,
            });
          }
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ ok: true }),
          });
          return;
        }
      }

      await route.fallback();
    });

    await applySessionCookies(evidence.context, directorSession);
    await evidence.page.goto(appUrl('/app/payroll'));
    await evidence.page.waitForLoadState('networkidle');

    await expect(evidence.page).toHaveURL(/\/app\/payroll$/);

    const filterBar = evidence.page.locator('.filter-bar');
    const teacherSelect = filterBar.locator('.filter-group').filter({ hasText: /Giáo viên|Giao vien/i }).locator('select');
    await teacherSelect.selectOption(teacher._id);
    await teacherSelect.dispatchEvent('change');

    const periodStartInput = filterBar.locator('.filter-group').filter({ hasText: /Từ ngày|Tu ngay/i }).locator('input');
    const periodEndInput = filterBar.locator('.filter-group').filter({ hasText: /Đến ngày|Den ngay/i }).locator('input');
    await periodStartInput.fill(expectedGeneratePayload.periodStart);
    await periodStartInput.dispatchEvent('change');
    await periodEndInput.fill(expectedGeneratePayload.periodEnd);
    await periodEndInput.dispatchEvent('change');
    await evidence.page.getByRole('button', { name: 'Xem', exact: true }).click();

    await expect.poll(() => previewQueries.at(-1)).toEqual(expectedGeneratePayload);
    await expect(evidence.page.getByText('Đủ điều kiện tính lương')).toBeVisible();
    await expect(evidence.page.getByText('2', { exact: true }).first()).toBeVisible();
    await expect(evidence.page.getByRole('button', { name: /Tạo bảng lương/i })).toContainText('1.600.000đ');
    const previewRequestCountBeforeGenerate = previewQueries.length;

    await evidence.step('teacher-payroll-preview-loaded');

    await evidence.page.getByRole('button', { name: /Tạo bảng lương/i }).click();
    await expect.poll(() => generateBodies.length).toBe(1);
    expect(generateBodies[0]).toEqual(expectedGeneratePayload);
    await expect(evidence.page.locator('.notification')).toContainText('Đã tạo bảng lương thành công!');
    await expect.poll(() => previewQueries.length).toBeGreaterThan(previewRequestCountBeforeGenerate);
    await expect.poll(() => previewQueries.at(-1)).toEqual(expectedGeneratePayload);
    await expect(evidence.page.locator('.existing-payrolls')).toContainText(workflowPayroll.payrollCode);

    await evidence.page.getByRole('button', { name: /Bảng lương/i }).click();
    await expect.poll(() => listQueries.at(-1)).toEqual({ page: '1', limit: '20', status: null });

    const workflowRow = payrollRow(evidence.page, workflowPayroll.payrollCode);
    const deleteRow = payrollRow(evidence.page, deletePayroll.payrollCode);
    await expect(workflowRow).toBeVisible();
    await expect(deleteRow).toBeVisible();

    await actionButton(workflowRow, /^Sửa$|^Sua$/i).click();
    const editModal = editPayrollModal(evidence.page);
    await expect(editModal).toBeVisible();
    await editModal.getByLabel(/^Thưởng thêm$|^Thuong them$/i).fill(String(expectedUpdatePayload.bonusAmount));
    await editModal.getByLabel(/^Khấu trừ thêm$|^Khau tru them$/i).fill(String(expectedUpdatePayload.deductionAmount));
    await editModal.getByLabel(/^Ghi chú$|^Ghi chu$/i).fill('  Điều chỉnh tháng 4  ');
    await editModal.getByRole('button', { name: /^Lưu$|^Luu$/i }).click();

    await expect.poll(() => updateBodies.length).toBe(1);
    expect(updateBodies[0]).toEqual(expectedUpdatePayload);
    await expect(editModal).toHaveCount(0);
    await expect(workflowRow).toContainText('+150.000đ');
    await expect(workflowRow).toContainText('-20.000đ');
    await expect(workflowRow).toContainText('1.730.000đ');

    await workflowRow.click();
    const detailModal = payrollDetailModal(evidence.page);
    await expect(detailModal).toBeVisible();
    await expect(detailModal).toContainText(expectedUpdatePayload.notes);
    await detailModal.locator('.close-btn').click();
    await expect(detailModal).toBeHidden();

    await actionButton(workflowRow, /^Gửi duyệt$|^Gui duyet$/i).click();
    await expect.poll(() => submitBodies.length).toBe(1);
    expect(submitBodies[0]).toEqual({});
    await expect(workflowRow).toContainText('Chờ duyệt');

    evidence.page.once('dialog', (dialog) => {
      expect(dialog.type()).toBe('prompt');
      expect(dialog.message()).toBe('Lý do từ chối:');
      dialog.accept(expectedRejectPayload.reason);
    });
    await actionButton(workflowRow, /^Từ chối$|^Tu choi$/i).click();
    await expect.poll(() => rejectBodies.length).toBe(1);
    expect(rejectBodies[0]).toEqual(expectedRejectPayload);
    await expect(workflowRow).toContainText('Từ chối');

    await workflowRow.click();
    await expect(detailModal).toBeVisible();
    await expect(detailModal).toContainText(expectedRejectPayload.reason);
    await detailModal.locator('.close-btn').click();

    await actionButton(workflowRow, /^Mở lại$|^Mo lai$/i).click();
    await expect.poll(() => reopenBodies.length).toBe(1);
    expect(reopenBodies[0]).toEqual({});
    await expect(workflowRow).toContainText('Nháp');

    await actionButton(workflowRow, /^Gửi duyệt$|^Gui duyet$/i).click();
    await expect.poll(() => submitBodies.length).toBe(2);

    await actionButton(workflowRow, /^Duyệt$|^Duyet$/i).click();
    await expect.poll(() => approveBodies.length).toBe(1);
    expect(approveBodies[0]).toEqual({});
    await expect(workflowRow).toContainText('Đã duyệt');

    evidence.page.once('dialog', (dialog) => {
      expect(dialog.type()).toBe('prompt');
      expect(dialog.message()).toBe('Mã giao dịch ngân hàng (tùy chọn):');
      dialog.accept(expectedMarkPaidPayload.paymentRef);
    });
    await actionButton(workflowRow, /^Xác nhận chi$|^Xac nhan chi$/i).click();
    await expect.poll(() => markPaidBodies.length).toBe(1);
    expect(markPaidBodies[0]).toEqual(expectedMarkPaidPayload);
    await expect(workflowRow).toContainText('Đã thanh toán');

    await workflowRow.click();
    await expect(detailModal).toBeVisible();
    await expect(detailModal).toContainText(expectedMarkPaidPayload.paymentRef);
    await detailModal.locator('.close-btn').click();

    evidence.page.once('dialog', (dialog) => {
      expect(dialog.type()).toBe('confirm');
      expect(dialog.message()).toBe('Xóa bảng lương DRAFT này?');
      dialog.accept();
    });
    await actionButton(deleteRow, /^Xóa$|^Xoa$/i).click();
    await expect.poll(() => deleteIds).toEqual([deletePayroll._id]);
    await expect(deleteRow).toHaveCount(0);

    await evidence.finalize('PASS', {
      extraLines: [
        'Verified /app/payroll preview cards, eligible-session render, and exact generate payload.',
        'Verified payroll-level edit modal sends exact PATCH body and re-renders bonus, deduction, net amount, and notes after reload.',
        'Verified strict lifecycle transitions submit -> reject -> reopen -> submit -> approve -> mark-paid, plus DRAFT delete and persisted payment reference/rejection reason.',
      ],
    });
  } catch (error) {
    await evidence.finalize('FAIL', { error });
    throw error;
  }
});
