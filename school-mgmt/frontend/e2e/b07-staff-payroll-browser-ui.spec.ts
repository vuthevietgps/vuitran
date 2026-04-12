import { expect, test, type Page } from '@playwright/test';
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

const API_PREFIX_PATTERN = 'https?://(?:localhost|127\\.0\\.0\\.1):3000';
const STAFF_PAYROLL_API = new RegExp(`${API_PREFIX_PATTERN}/staff-payroll(?:/.*)?(?:\\?.*)?$`);

type StaffPayrollStatus = 'DRAFT' | 'PENDING_REVIEW' | 'APPROVED' | 'PAID' | 'REJECTED';

type StaffPayrollItem = {
  _id: string;
  payrollCode: string;
  userName: string;
  role: string;
  periodStart: string;
  periodEnd: string;
  status: StaffPayrollStatus;
  baseSalary: number;
  attendanceRatio: number;
  actualHours: number;
  standardHours: number;
  baseSalaryAmount: number;
  totalRevenue: number;
  commissionType?: string;
  commissionTiers: Array<{ from: number; to?: number; rate: number }>;
  commissionAmount: number;
  kpiScore: number;
  kpiBonusTiers: Array<{ minScore: number; maxScore?: number; bonusPercentage: number }>;
  kpiBonusPercentage: number;
  kpiBonusAmount: number;
  lateDays: number;
  latePenaltyPerTime: number;
  latePenaltyAmount: number;
  bonusAmount: number;
  deductionAmount: number;
  paymentRef?: string;
  rejectionReason?: string;
  notes?: string;
  netAmount: number;
};

function appUrl(path: string): string {
  return new URL(path, APP_BASE_URL).toString();
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function payrollRow(page: Page, payrollCode: string) {
  return page.locator('table.data tbody tr').filter({ hasText: payrollCode }).first();
}

function detailModal(page: Page) {
  return page.locator('.modal-backdrop .modal.wide');
}

function editModal(page: Page) {
  return page.locator('.modal-backdrop .modal').filter({ hasText: 'Điều chỉnh bảng lương' });
}

function generateModal(page: Page) {
  return page.locator('.modal-backdrop .modal').filter({ hasText: 'Tạo bảng lương' });
}

function markPaidModal(page: Page) {
  return page.locator('.modal-backdrop .modal').filter({ hasText: 'Đánh dấu đã thanh toán' });
}

function netAmount(item: Pick<StaffPayrollItem, 'baseSalaryAmount' | 'commissionAmount' | 'kpiBonusAmount' | 'bonusAmount' | 'deductionAmount' | 'latePenaltyAmount'>): number {
  return (
    item.baseSalaryAmount +
    item.commissionAmount +
    item.kpiBonusAmount +
    item.bonusAmount -
    item.deductionAmount -
    item.latePenaltyAmount
  );
}

test.use({ video: 'on' });
test.describe.configure({ mode: 'serial', timeout: 180_000 });

test('B07 staff payroll full lifecycle keeps strict create edit submit reject reopen approve mark-paid delete semantics', async ({
  browser,
  request,
}) => {
  test.slow();

  const evidence = await createBatchEvidenceContext(browser, {
    batchId: 'B07',
    scenario: 'staff_payroll_lifecycle_browser',
    runDate: RUN_DATE,
  });

  const directorSession = await loginAsRole(request, 'director');

  const generatedCreatePayload = {
    userId: 'teacher-staff-001',
    periodStart: '2026-04-01',
    periodEnd: '2026-04-30',
    bonusAmount: 150000,
    deductionAmount: 20000,
    notes: 'Generated for April',
  };

  const expectedPatchPayload = {
    bonusAmount: 300000,
    deductionAmount: 10000,
    notes: 'Adjusted by director',
  };

  const expectedRejectPayload = { reason: 'Thiếu giải trình bonus' };
  const expectedPaymentPayload = { paymentRef: 'BANK-STAFF-001' };

  const deleteDraft: StaffPayrollItem = {
    _id: 'staff-payroll-delete-001',
    payrollCode: 'SP-STAFF-DELETE-001',
    userName: 'Staff Delete Target',
    role: 'STAFF',
    periodStart: '2026-04-01T00:00:00.000Z',
    periodEnd: '2026-04-30T00:00:00.000Z',
    status: 'DRAFT',
    baseSalary: 3000000,
    attendanceRatio: 1,
    actualHours: 40,
    standardHours: 40,
    baseSalaryAmount: 3000000,
    totalRevenue: 0,
    commissionType: 'NONE',
    commissionTiers: [],
    commissionAmount: 0,
    kpiScore: 0,
    kpiBonusTiers: [],
    kpiBonusPercentage: 0,
    kpiBonusAmount: 0,
    lateDays: 0,
    latePenaltyPerTime: 0,
    latePenaltyAmount: 0,
    bonusAmount: 0,
    deductionAmount: 0,
    notes: 'Delete me',
    netAmount: 3000000,
  };

  const generatedDraft: StaffPayrollItem = {
    _id: 'staff-payroll-generated-001',
    payrollCode: 'SP-STAFF-2026-04-001',
    userName: 'Teacher Staff One',
    role: 'TEACHER',
    periodStart: '2026-04-01T00:00:00.000Z',
    periodEnd: '2026-04-30T00:00:00.000Z',
    status: 'DRAFT',
    baseSalary: 5000000,
    attendanceRatio: 0.92,
    actualHours: 46,
    standardHours: 50,
    baseSalaryAmount: 4600000,
    totalRevenue: 12000000,
    commissionType: 'PERCENT',
    commissionTiers: [{ from: 0, to: 10000000, rate: 2 }],
    commissionAmount: 240000,
    kpiScore: 8.8,
    kpiBonusTiers: [{ minScore: 8, maxScore: 10, bonusPercentage: 5 }],
    kpiBonusPercentage: 5,
    kpiBonusAmount: 230000,
    lateDays: 1,
    latePenaltyPerTime: 50000,
    latePenaltyAmount: 50000,
    bonusAmount: generatedCreatePayload.bonusAmount,
    deductionAmount: generatedCreatePayload.deductionAmount,
    notes: generatedCreatePayload.notes,
    netAmount: 0,
  };
  generatedDraft.netAmount = netAmount(generatedDraft);

  const createBodies: unknown[] = [];
  const updateBodies: unknown[] = [];
  const submitIds: string[] = [];
  const rejectEvents: Array<{ payrollId: string; body: unknown }> = [];
  const reopenIds: string[] = [];
  const approveIds: string[] = [];
  const markPaidEvents: Array<{ payrollId: string; body: unknown }> = [];
  const deleteIds: string[] = [];
  const listQueries: Array<Record<string, string | null>> = [];

  let listState: StaffPayrollItem[] = [clone(deleteDraft)];
  const detailById: Record<string, StaffPayrollItem> = {
    [deleteDraft._id]: clone(deleteDraft),
  };

  try {
    await evidence.page.route(STAFF_PAYROLL_API, async (route) => {
      const requestMethod = route.request().method();
      const url = new URL(route.request().url());
      const path = url.pathname;

      if (requestMethod === 'GET' && path === '/staff-payroll') {
        listQueries.push({
          page: url.searchParams.get('page'),
          limit: url.searchParams.get('limit'),
          status: url.searchParams.get('status'),
          periodStart: url.searchParams.get('periodStart'),
          periodEnd: url.searchParams.get('periodEnd'),
        });
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: clone(listState),
            total: listState.length,
          }),
        });
        return;
      }

      const detailMatch = path.match(/^\/staff-payroll\/([^/]+)$/);
      if (requestMethod === 'GET' && detailMatch) {
        const payrollId = detailMatch[1];
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(clone(detailById[payrollId] || null)),
        });
        return;
      }

      if (requestMethod === 'POST' && path === '/staff-payroll') {
        const body = route.request().postDataJSON();
        createBodies.push(body);
        listState = [clone(generatedDraft), ...listState];
        detailById[generatedDraft._id] = clone(generatedDraft);
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ _id: generatedDraft._id, payrollCode: generatedDraft.payrollCode }),
        });
        return;
      }

      const actionMatch = path.match(/^\/staff-payroll\/([^/]+)\/(submit|approve|reject|reopen|mark-paid)$/);
      if (requestMethod === 'POST' && actionMatch) {
        const [, payrollId, action] = actionMatch;
        const item = listState.find((entry) => entry._id === payrollId);
        const current = detailById[payrollId];
        if (!item || !current) {
          await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ message: 'Not found' }) });
          return;
        }

        if (action === 'submit') {
          submitIds.push(payrollId);
          item.status = 'PENDING_REVIEW';
          detailById[payrollId] = { ...current, status: 'PENDING_REVIEW' };
          await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
          return;
        }

        if (action === 'approve') {
          approveIds.push(payrollId);
          item.status = 'APPROVED';
          detailById[payrollId] = { ...current, status: 'APPROVED' };
          await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
          return;
        }

        if (action === 'reject') {
          const body = route.request().postDataJSON();
          rejectEvents.push({ payrollId, body });
          item.status = 'REJECTED';
          item.rejectionReason = String((body as { reason?: string }).reason || '');
          detailById[payrollId] = {
            ...current,
            status: 'REJECTED',
            rejectionReason: String((body as { reason?: string }).reason || ''),
          };
          await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
          return;
        }

        if (action === 'reopen') {
          reopenIds.push(payrollId);
          item.status = 'DRAFT';
          delete item.rejectionReason;
          detailById[payrollId] = {
            ...current,
            status: 'DRAFT',
            rejectionReason: undefined,
          };
          await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
          return;
        }

        if (action === 'mark-paid') {
          const body = route.request().postDataJSON();
          markPaidEvents.push({ payrollId, body });
          item.status = 'PAID';
          item.paymentRef = String((body as { paymentRef?: string }).paymentRef || '');
          detailById[payrollId] = {
            ...current,
            status: 'PAID',
            paymentRef: String((body as { paymentRef?: string }).paymentRef || ''),
          };
          await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
          return;
        }
      }

      if (requestMethod === 'PATCH' && detailMatch) {
        const payrollId = detailMatch[1];
        const body = route.request().postDataJSON() as {
          bonusAmount?: number;
          deductionAmount?: number;
          notes?: string;
        };
        updateBodies.push(body);
        const item = listState.find((entry) => entry._id === payrollId);
        const current = detailById[payrollId];
        if (!item || !current) {
          await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ message: 'Not found' }) });
          return;
        }
        item.bonusAmount = Number(body.bonusAmount || 0);
        item.deductionAmount = Number(body.deductionAmount || 0);
        item.notes = body.notes || '';
        item.netAmount = netAmount(item);
        detailById[payrollId] = {
          ...current,
          bonusAmount: Number(body.bonusAmount || 0),
          deductionAmount: Number(body.deductionAmount || 0),
          notes: body.notes || '',
          netAmount: netAmount({
            ...current,
            bonusAmount: Number(body.bonusAmount || 0),
            deductionAmount: Number(body.deductionAmount || 0),
          }),
        };
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ok: true }),
        });
        return;
      }

      if (requestMethod === 'DELETE' && detailMatch) {
        const payrollId = detailMatch[1];
        deleteIds.push(payrollId);
        listState = listState.filter((entry) => entry._id !== payrollId);
        delete detailById[payrollId];
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ok: true }),
        });
        return;
      }

      await route.fallback();
    });

    await applySessionCookies(evidence.context, directorSession);
    await evidence.page.goto(appUrl('/app/staff-payroll'));
    await evidence.page.waitForLoadState('networkidle');

    await expect(evidence.page).toHaveURL(/\/app\/staff-payroll$/);
    await expect(evidence.page.getByRole('heading', { name: 'Bảng lương nhân viên' })).toBeVisible();
    await expect
      .poll(() => listQueries.at(-1))
      .toEqual({
        page: '1',
        limit: '20',
        status: null,
        periodStart: null,
        periodEnd: null,
      });
    await expect(payrollRow(evidence.page, deleteDraft.payrollCode)).toBeVisible();
    await evidence.step('staff-payroll-initial-list');

    await evidence.page.getByRole('button', { name: /Tạo bảng lương/i }).click();
    const createModal = generateModal(evidence.page);
    await expect(createModal).toBeVisible();
    await createModal.locator('input').nth(0).fill(generatedCreatePayload.userId);
    await createModal.locator('input[type="date"]').nth(0).fill(generatedCreatePayload.periodStart);
    await createModal.locator('input[type="date"]').nth(1).fill(generatedCreatePayload.periodEnd);
    await createModal.locator('input[type="number"]').nth(0).fill(String(generatedCreatePayload.bonusAmount));
    await createModal.locator('input[type="number"]').nth(1).fill(String(generatedCreatePayload.deductionAmount));
    await createModal.locator('textarea').fill(generatedCreatePayload.notes);
    await evidence.step('staff-payroll-create-form-filled');
    await createModal.getByRole('button', { name: 'Tạo' }).click();

    await expect.poll(() => createBodies.length).toBe(1);
    expect(createBodies[0]).toEqual(generatedCreatePayload);
    await expect(createModal).toHaveCount(0);
    const createdRow = payrollRow(evidence.page, generatedDraft.payrollCode);
    await expect(createdRow).toBeVisible();
    await expect(createdRow).toContainText('Nháp');

    await createdRow.getByRole('button', { name: 'Sửa' }).click();
    const adjustModal = editModal(evidence.page);
    await expect(adjustModal).toBeVisible();
    await adjustModal.locator('input[type="number"]').nth(0).fill(String(expectedPatchPayload.bonusAmount));
    await adjustModal.locator('input[type="number"]').nth(1).fill(String(expectedPatchPayload.deductionAmount));
    await adjustModal.locator('textarea').fill(expectedPatchPayload.notes);
    await adjustModal.getByRole('button', { name: 'Lưu' }).click();

    await expect.poll(() => updateBodies.length).toBe(1);
    expect(updateBodies[0]).toEqual(expectedPatchPayload);
    await expect(adjustModal).toHaveCount(0);

    await createdRow.click();
    const detail = detailModal(evidence.page);
    await expect(detail).toBeVisible();
    await expect(detail).toContainText(generatedDraft.payrollCode);
    await expect(detail).toContainText(expectedPatchPayload.notes);
    await expect(detail).toContainText('5,310,000đ');
    await evidence.step('staff-payroll-detail-after-edit');

    evidence.page.once('dialog', (dialog) => {
      expect(dialog.type()).toBe('confirm');
      expect(dialog.message()).toBe(`Nộp bảng lương ${generatedDraft.payrollCode} để duyệt?`);
      return dialog.accept();
    });
    await detail.getByRole('button', { name: /Nộp duyệt/i }).click();
    await expect.poll(() => submitIds).toEqual([generatedDraft._id]);
    await expect(detail).toHaveCount(0);
    await expect(createdRow).toContainText('Chờ duyệt');

    evidence.page.once('dialog', (dialog) => {
      expect(dialog.type()).toBe('prompt');
      expect(dialog.message()).toBe('Lý do từ chối:');
      return dialog.accept(expectedRejectPayload.reason);
    });
    await createdRow.getByRole('button', { name: 'Từ chối' }).click();
    await expect.poll(() => rejectEvents.length).toBe(1);
    expect(rejectEvents[0]).toEqual({
      payrollId: generatedDraft._id,
      body: expectedRejectPayload,
    });
    await expect(createdRow).toContainText('Từ chối');

    await createdRow.click();
    await expect(detail).toBeVisible();
    await expect(detail).toContainText('Lý do từ chối:');
    await expect(detail).toContainText(expectedRejectPayload.reason);
    await evidence.step('staff-payroll-detail-after-reject');

    evidence.page.once('dialog', (dialog) => {
      expect(dialog.type()).toBe('confirm');
      expect(dialog.message()).toBe(`Mở lại bảng lương ${generatedDraft.payrollCode} về trạng thái Nháp?`);
      return dialog.accept();
    });
    await detail.getByRole('button', { name: /Mở lại/i }).click();
    await expect.poll(() => reopenIds).toEqual([generatedDraft._id]);
    await expect(detail).toHaveCount(0);
    await expect(createdRow).toContainText('Nháp');

    evidence.page.once('dialog', (dialog) => {
      expect(dialog.type()).toBe('confirm');
      expect(dialog.message()).toBe(`Nộp bảng lương ${generatedDraft.payrollCode} để duyệt?`);
      return dialog.accept();
    });
    await createdRow.getByRole('button', { name: 'Nộp' }).click();
    await expect.poll(() => submitIds).toEqual([generatedDraft._id, generatedDraft._id]);
    await expect(createdRow).toContainText('Chờ duyệt');

    evidence.page.once('dialog', (dialog) => {
      expect(dialog.type()).toBe('confirm');
      expect(dialog.message()).toBe(`Duyệt bảng lương ${generatedDraft.payrollCode}?`);
      return dialog.accept();
    });
    await createdRow.getByRole('button', { name: 'Duyệt' }).click();
    await expect.poll(() => approveIds).toEqual([generatedDraft._id]);
    await expect(createdRow).toContainText('Đã duyệt');

    await createdRow.click();
    await expect(detail).toBeVisible();
    await detail.getByRole('button', { name: /Đánh dấu đã trả/i }).click();
    const paidModal = markPaidModal(evidence.page);
    await expect(paidModal).toBeVisible();
    await paidModal.locator('input').fill(expectedPaymentPayload.paymentRef);
    await paidModal.getByRole('button', { name: 'Xác nhận' }).click();
    await expect.poll(() => markPaidEvents.length).toBe(1);
    expect(markPaidEvents[0]).toEqual({
      payrollId: generatedDraft._id,
      body: expectedPaymentPayload,
    });
    await expect(createdRow).toContainText('Đã thanh toán');

    await createdRow.click();
    await expect(detail).toBeVisible();
    await expect(detail).toContainText('Mã tham chiếu thanh toán:');
    await expect(detail).toContainText(expectedPaymentPayload.paymentRef);
    await detail.getByRole('button', { name: 'Đóng' }).click();
    await expect(detail).toHaveCount(0);
    await evidence.step('staff-payroll-detail-after-paid');

    const deleteRow = payrollRow(evidence.page, deleteDraft.payrollCode);
    evidence.page.once('dialog', (dialog) => {
      expect(dialog.type()).toBe('confirm');
      expect(dialog.message()).toBe(`Xóa bảng lương ${deleteDraft.payrollCode}? Thao tác này không thể hoàn tác.`);
      return dialog.accept();
    });
    await deleteRow.getByRole('button', { name: 'Xóa' }).click();
    await expect.poll(() => deleteIds).toEqual([deleteDraft._id]);
    await expect(deleteRow).toHaveCount(0);
    await evidence.step('staff-payroll-delete-draft');

    await evidence.finalize('PASS', {
      extraLines: [
        'Verified the create modal sent the exact staff-payroll POST payload and reloaded the list with a new DRAFT row.',
        'Verified edit sent the exact PATCH body, reloaded the row, and the detail modal reflected the updated note and recalculated net amount.',
        'Verified one generated payroll moved through DRAFT -> PENDING_REVIEW -> REJECTED -> DRAFT -> PENDING_REVIEW -> APPROVED -> PAID with exact confirm/prompt wording, exact mutation payloads, rejection reason, and payment reference visibility.',
        'Verified a separate DRAFT payroll required the exact destructive confirm message and disappeared from the list after DELETE.',
      ],
    });
  } catch (error) {
    await evidence.finalize('FAIL', { error });
    throw error;
  }
});
