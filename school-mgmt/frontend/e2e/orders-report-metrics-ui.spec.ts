import { expect, test, type APIRequestContext, type Locator, type Page } from '@playwright/test';
import {
  acceptDialog,
  apiJson,
  approvalFile,
  closeActors,
  ensureSaleAccount,
  ensureTeacherAccount,
  getOrderById,
  loginAsRole,
  openRolePage,
} from './support';

function uniqueDigits(length = 8): string {
  return `${Date.now()}${Math.floor(Math.random() * 10000)}`
    .replace(/\D/g, '')
    .slice(-length);
}

function uniquePhone(): string {
  return `09${uniqueDigits(8)}`;
}

function isoDateOffset(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function digitsOnly(value: string | null | undefined): string {
  return String(value || '').replace(/\D/g, '');
}

async function expectMoneyText(locator: Locator, amount: number): Promise<void> {
  await expect.poll(async () => digitsOnly(await locator.innerText())).toBe(String(amount));
}

async function clickAndAcceptOptionalDialog(
  page: Page,
  action: () => Promise<unknown>,
): Promise<string | null> {
  const dialogPromise = page.waitForEvent('dialog', { timeout: 5_000 }).catch(() => null);
  await action();
  const dialog = await dialogPromise;
  if (!dialog) {
    return null;
  }
  const message = dialog.message();
  await dialog.accept();
  return message;
}

async function createDedicatedProduct(
  request: APIRequestContext,
  directorSession: Awaited<ReturnType<typeof loginAsRole>>,
  label: string,
): Promise<any> {
  const code = `E2EORD${uniqueDigits(8)}`;
  return apiJson<any>(
    request,
    directorSession,
    'POST',
    '/products',
    {
      name: `E2E Order Metrics ${label}`,
      code,
      description: 'Dedicated product for order/report metric UI tests',
      category: 'ENGLISH',
      teachingMode: 'ONLINE',
      defaultSessions: 10,
      defaultSessionDuration: 60,
      pricePerSession: 240_000,
      suggestedPrice: 2_400_000,
      commissionRate: 0,
      isActive: true,
    },
  );
}

async function fillNumeric(locator: Locator, value: number | string): Promise<void> {
  await locator.scrollIntoViewIfNeeded();
  await locator.fill(String(value));
}

async function createDraftOrderViaUi(
  page: Page,
  options: {
    label: string;
    saleId: string;
    teacherId: string;
    productId: string;
    uploadSaleReceipt?: boolean;
  },
): Promise<{
  parentName: string;
  parentPhone: string;
  studentName: string;
  orderId: string;
  orderCode: string;
}> {
  const parentName = `E2E Metrics Parent ${options.label}`;
  const parentPhone = uniquePhone();
  const studentName = `E2E Metrics Student ${options.label}`;

  await page.getByTestId('orders-create-button').click();
  await expect(page.getByTestId('order-form-modal')).toBeVisible();

  await page.getByTestId('order-parent-name').fill(parentName);
  await page.getByTestId('order-parent-phone').fill(parentPhone);
  await page.getByTestId('order-student-name').fill(studentName);

  const saleSelect = page.getByTestId('order-sale');
  if (await saleSelect.isVisible()) {
    await saleSelect.selectOption(options.saleId);
  }

  await page.getByTestId('order-item-product-0').selectOption(options.productId);
  await expect(page.getByTestId('order-item-price-0')).toHaveValue('240000');
  await expect(page.getByTestId('order-total-amount')).toHaveValue('2400000');

  await page.getByTestId('order-item-teacher-0').selectOption(options.teacherId);
  await fillNumeric(page.getByTestId('order-item-sessions-0'), 10);
  await fillNumeric(page.getByTestId('order-invoice-sessions-0'), 8);
  await expect(page.getByTestId('order-invoice-amount-0')).toHaveValue('1920000');
  await expect(page.getByTestId('order-total-amount')).toHaveValue('1920000');

  await fillNumeric(page.getByTestId('order-item-bonus-0'), 2);
  await fillNumeric(page.getByTestId('order-item-trial-0'), 1);
  await fillNumeric(page.getByTestId('order-discount-amount'), 120000);
  await expect(page.getByTestId('order-final-amount')).toHaveValue('1800000');

  if (options.uploadSaleReceipt) {
    await page.getByTestId('order-receipt-file').setInputFiles(
      approvalFile(`order-sale-receipt-${options.label}.png`),
    );
    await expect(page.getByTestId('order-receipt-clear')).toBeVisible({ timeout: 20_000 });
  }

  await page.getByTestId('order-submit').click();

  const row = page.getByTestId('order-row').filter({ hasText: parentName }).first();
  await expect(row).toBeVisible({ timeout: 20_000 });

  const orderId = await row.getAttribute('data-order-id');
  const orderCode = await row.getAttribute('data-order-code');
  expect(orderId, 'Expected created order row to expose data-order-id').toBeTruthy();
  expect(orderCode, 'Expected created order row to expose data-order-code').toBeTruthy();

  return {
    parentName,
    parentPhone,
    studentName,
    orderId: orderId as string,
    orderCode: orderCode as string,
  };
}

test.describe('Orders and report metrics UI', () => {
  test('recomputes order invoice amount and detail session metrics correctly', async ({
    browser,
    request,
  }) => {
    test.slow();
    test.setTimeout(180_000);

    const directorSession = await loginAsRole(request, 'director');
    const label = `OrderCalc${uniqueDigits(6)}`;
    const [sale, teacher, product] = await Promise.all([
      ensureSaleAccount(request, directorSession, label),
      ensureTeacherAccount(request, directorSession, label),
      createDedicatedProduct(request, directorSession, label),
    ]);

    const directorUi = await openRolePage(browser, request, 'director', '/app/orders');
    try {
      const created = await createDraftOrderViaUi(directorUi.page, {
        label,
        saleId: sale._id,
        teacherId: teacher._id,
        productId: product._id,
        uploadSaleReceipt: true,
      });

      const row = directorUi.page.getByTestId('order-row').filter({ hasText: created.orderCode }).first();
      await expect(row).toBeVisible({ timeout: 20_000 });
      await expectMoneyText(row.getByTestId('order-row-course-price'), 2_400_000);
      await expectMoneyText(row.getByTestId('order-row-invoice-amount'), 1_800_000);

      await row.click();
      const detailModal = directorUi.page.getByTestId('order-detail-modal');
      await expect(detailModal).toBeVisible({ timeout: 15_000 });
      await expect(detailModal.getByTestId('order-detail-item-sessions-0')).toContainText('10');
      await expect(detailModal.getByTestId('order-detail-item-invoice-sessions-0')).toContainText('8');
      await expect(detailModal.getByTestId('order-detail-item-invoice-sessions-0')).toContainText('2');
      await expect(detailModal.getByTestId('order-detail-item-invoice-sessions-0')).toContainText('1');
      await expectMoneyText(detailModal.getByTestId('order-detail-invoice-amount'), 1_800_000);
    } finally {
      await closeActors(directorUi);
    }
  });

  test('keeps orders, comprehensive-report and attendance-report metrics aligned after approval', async ({
    browser,
    request,
  }) => {
    test.slow();
    test.setTimeout(240_000);

    const directorSession = await loginAsRole(request, 'director');
    const label = `OrderRpt${uniqueDigits(6)}`;
    const [sale, teacher, product] = await Promise.all([
      ensureSaleAccount(request, directorSession, label),
      ensureTeacherAccount(request, directorSession, label),
      createDedicatedProduct(request, directorSession, label),
    ]);

    const sessionDates = [isoDateOffset(-3), isoDateOffset(-2), isoDateOffset(-1)];
    const directorUi = await openRolePage(browser, request, 'director', '/app/orders');

    try {
      const created = await createDraftOrderViaUi(directorUi.page, {
        label,
        saleId: sale._id,
        teacherId: teacher._id,
        productId: product._id,
        uploadSaleReceipt: true,
      });

      let row = directorUi.page.getByTestId('order-row').filter({ hasText: created.orderCode }).first();
      await expect(row).toBeVisible({ timeout: 20_000 });

      const submitMessage = await acceptDialog(
        directorUi.page,
        () => row.getByTestId('order-row-submit').click(),
      );
      expect(submitMessage).toContain(created.orderCode);

      row = directorUi.page.getByTestId('order-row').filter({ hasText: created.orderCode }).first();
      await expect(row.locator('.badge')).toContainText(/Cho duyet|Chờ duyệt|SUBMITTED/i, {
        timeout: 20_000,
      });

      await row.getByTestId('order-row-approve').click();
      const approveModal = directorUi.page.getByTestId('order-approve-modal');
      await expect(approveModal).toBeVisible({ timeout: 15_000 });
      await approveModal.getByTestId('order-approve-image').setInputFiles(
        approvalFile(`order-metrics-${created.orderCode}.png`),
      );

      const approvalMessage = await clickAndAcceptOptionalDialog(
        directorUi.page,
        () => approveModal.getByTestId('order-approve-confirm').click(),
      );
      if (approvalMessage) {
        expect(approvalMessage).toMatch(/Hoc sinh|Học sinh/);
      }

      await expect(approveModal).toBeHidden({ timeout: 20_000 });
      row = directorUi.page.getByTestId('order-row').filter({ hasText: created.orderCode }).first();
      await expect(row.locator('.badge')).toContainText(/Da duyet|Đã duyệt|APPROVED|COMPLETED|Hoàn tất/i, {
        timeout: 20_000,
      });

      await expect.poll(
        async () => {
          const order = await getOrderById(request, directorSession, created.orderId);
          return Number(order?.processedResults?.classIds?.length || 0);
        },
        { timeout: 20_000 },
      ).toBe(1);

      const approvedOrder = await getOrderById(request, directorSession, created.orderId);
      expect(['APPROVED', 'COMPLETED']).toContain(approvedOrder.status);

      const studentId = approvedOrder.processedResults?.studentId as string;
      const classId = approvedOrder.processedResults?.classIds?.[0] as string;
      const invoiceId = approvedOrder.processedResults?.invoiceIds?.[0] as string;
      expect(studentId).toBeTruthy();
      expect(classId).toBeTruthy();
      expect(invoiceId).toBeTruthy();

      const createdInvoice = await apiJson<any>(request, directorSession, 'GET', `/invoices/${invoiceId}`);
      const invoiceNumber = createdInvoice.invoiceNumber as string;
      expect(createdInvoice.amount).toBe(1_800_000);
      expect(invoiceNumber).toBeTruthy();

      await apiJson(
        request,
        directorSession,
        'POST',
        '/attendance/mark',
        {
          classId,
          studentId,
          date: sessionDates[0],
          status: 'PRESENT',
          notes: `Metrics present ${label} #1`,
        },
      );
      await apiJson(
        request,
        directorSession,
        'POST',
        '/attendance/mark',
        {
          classId,
          studentId,
          date: sessionDates[1],
          status: 'ABSENT',
          notes: `Metrics absent ${label} #2`,
        },
      );
      await apiJson(
        request,
        directorSession,
        'POST',
        '/attendance/mark',
        {
          classId,
          studentId,
          date: sessionDates[2],
          status: 'PRESENT',
          notes: `Metrics present ${label} #3`,
        },
      );

      const invoiceAfterAttendance = await apiJson<any>(request, directorSession, 'GET', `/invoices/${invoiceId}`);
      const remainingSessions =
        Number(invoiceAfterAttendance.sessionsRemaining || 0) +
        Number(invoiceAfterAttendance.bonusSessionsRemaining || 0) +
        Number(invoiceAfterAttendance.trialSessionsRemaining || 0);
      const expectedPurchasedSessions =
        Number(invoiceAfterAttendance.sessions || 0) +
        Number(invoiceAfterAttendance.bonusSessions || 0) +
        Number(invoiceAfterAttendance.trialSessions || 0);
      const expectedCompletedSessions = 3;
      const expectedComprehensiveTotalSessions = expectedCompletedSessions + remainingSessions;
      expect(expectedPurchasedSessions).toBe(11);

      const comprehensiveReport = await apiJson<any>(
        request,
        directorSession,
        'GET',
        `/students/comprehensive-report?classId=${classId}&searchTerm=${encodeURIComponent(created.studentName)}`,
      );
      const comprehensiveRow = (comprehensiveReport?.rows || []).find(
        (row: any) => row.studentId === studentId,
      );

      expect(comprehensiveRow, 'Expected dedicated student row in comprehensive report').toBeTruthy();
      expect(comprehensiveRow.invoiceNumber).toBe(invoiceNumber);
      expect(comprehensiveRow.totalSessions).toBe(expectedComprehensiveTotalSessions);
      expect(comprehensiveRow.sessionsCompleted).toBe(expectedCompletedSessions);
      expect(comprehensiveRow.attendedCount).toBe(2);
      expect(comprehensiveRow.absentCount).toBe(1);
      expect((comprehensiveRow.sessions || []).slice(0, 3).map((session: any) => session?.status)).toEqual([
        'PRESENT',
        'ABSENT',
        'PRESENT',
      ]);
      const comprehensiveActualDataStatus = String(comprehensiveRow.dataStatus || 'DANG_HOC');
      const comprehensiveMismatchDataStatus = ['DANG_HOC', 'BAO_LUU', 'KET_THUC', 'HOAN_HOC_PHI']
        .find((value) => value !== comprehensiveActualDataStatus) || 'KET_THUC';

      await directorUi.page.goto('/app/comprehensive-report');
      await directorUi.page.waitForLoadState('networkidle');
      await directorUi.page.getByTestId('comprehensive-class-filter').selectOption(classId);
      await directorUi.page.getByTestId('comprehensive-search-input').fill(created.studentName);
      await directorUi.page.getByTestId('comprehensive-search-button').click();

      const comprehensiveRowUi = directorUi.page.getByTestId(`comprehensive-row-${studentId}-${classId}`);
      await expect(comprehensiveRowUi).toBeVisible({ timeout: 20_000 });
      await expect(directorUi.page.getByTestId('comprehensive-summary-total-rows')).toContainText('1');
      await expect(directorUi.page.getByTestId('comprehensive-summary-unique-classes')).toContainText('1');
      await expect(directorUi.page.getByTestId('comprehensive-summary-max-sessions')).toContainText(String(expectedComprehensiveTotalSessions));
      await expect(directorUi.page.getByTestId('comprehensive-summary-total-attended')).toContainText('2');
      await expect(directorUi.page.getByTestId(`comprehensive-invoice-number-${studentId}`)).toContainText(invoiceNumber);
      await expect(directorUi.page.getByTestId(`comprehensive-total-sessions-${studentId}`)).toContainText(String(expectedComprehensiveTotalSessions));
      await expect(directorUi.page.getByTestId(`comprehensive-sessions-completed-${studentId}`)).toContainText(String(expectedCompletedSessions));
      await expect(directorUi.page.getByTestId(`comprehensive-session-cell-${studentId}-0`)).toContainText('CM');
      await expect(directorUi.page.getByTestId(`comprehensive-session-cell-${studentId}-1`)).toContainText('V');
      await expect(directorUi.page.getByTestId(`comprehensive-session-cell-${studentId}-2`)).toContainText('CM');
      await directorUi.page.getByTestId('comprehensive-data-status-filter').selectOption(comprehensiveMismatchDataStatus);
      await expect(directorUi.page.locator('.no-data')).toContainText(/Khong tim thay du lieu|KhÃ´ng tÃ¬m tháº¥y dá»¯ liá»‡u/i);
      await directorUi.page.getByTestId('comprehensive-data-status-filter').selectOption(comprehensiveActualDataStatus);
      await expect(comprehensiveRowUi).toBeVisible({ timeout: 20_000 });
      await directorUi.page.getByTestId('comprehensive-search-input').fill(`NoMatch-${label}`);
      await directorUi.page.getByTestId('comprehensive-search-button').click();
      await expect(directorUi.page.locator('.no-data')).toContainText(/Khong tim thay du lieu|KhÃ´ng tÃ¬m tháº¥y dá»¯ liá»‡u/i);
      await directorUi.page.getByTestId('comprehensive-search-input').fill(created.studentName);
      await directorUi.page.getByTestId('comprehensive-search-button').click();
      await expect(comprehensiveRowUi).toBeVisible({ timeout: 20_000 });

      const studentReport = await apiJson<any>(
        request,
        directorSession,
        'GET',
        `/students/report?classId=${classId}&searchTerm=${encodeURIComponent(created.studentName)}`,
      );
      const studentReportRow = (Array.isArray(studentReport) ? studentReport : []).find(
        (item: any) => item._id === studentId,
      );
      expect(studentReportRow, 'Expected dedicated student row in student report').toBeTruthy();
      expect(studentReportRow.totalAttendance).toBe(2);

      await directorUi.page.goto('/app/student-report');
      await directorUi.page.waitForLoadState('networkidle');
      await directorUi.page.locator('.filters select').first().selectOption(classId);
      await directorUi.page.locator('.filters input').first().fill(created.studentName);
      await directorUi.page.locator('.filters .btn.btn-primary').click();
      const studentReportTable = directorUi.page.locator('.report-table');
      await expect(studentReportTable).toBeVisible({ timeout: 20_000 });
      await expect(studentReportTable).toContainText(created.studentName);
      await expect(studentReportTable).toContainText(created.parentName);
      await expect(studentReportTable).toContainText(created.parentPhone);
      await expect(directorUi.page.locator('.summary-number').nth(0)).toContainText('1');
      await expect(directorUi.page.locator('.summary-number').nth(1)).toContainText('2');
      await directorUi.page.locator('.filters input').first().fill(`NoMatch-${label}`);
      await directorUi.page.locator('.filters .btn.btn-primary').click();
      await expect(directorUi.page.locator('.no-data')).toBeVisible();

      const attendanceReport = await apiJson<any>(
        request,
        directorSession,
        'GET',
        `/attendance/report?startDate=${sessionDates[0]}&endDate=${sessionDates[2]}&classId=${classId}&page=1&limit=20`,
      );
      expect(attendanceReport.meta.total).toBe(2);
      expect(attendanceReport.data).toHaveLength(2);
      expect(attendanceReport.data.every((item: any) => item.status !== 'ABSENT')).toBe(true);
      for (const item of attendanceReport.data) {
        expect(item.studentId.totalPurchasedSessions).toBe(expectedPurchasedSessions);
      }

      await directorUi.page.goto('/app/attendance-report');
      await directorUi.page.waitForLoadState('networkidle');
      await directorUi.page.getByTestId('attendance-report-start-date').fill(sessionDates[0]);
      await directorUi.page.getByTestId('attendance-report-end-date').fill(sessionDates[2]);
      await directorUi.page.getByTestId('attendance-report-class-filter').selectOption(classId);
      await directorUi.page.getByTestId('attendance-report-search-button').click();

      await expect(directorUi.page.getByTestId('attendance-report-summary-total-items')).toContainText('2');
      for (const item of attendanceReport.data) {
        const reportRow = directorUi.page.getByTestId(`attendance-report-row-${item._id}`);
        await expect(reportRow).toBeVisible({ timeout: 20_000 });
        await expect(reportRow).toContainText(created.studentName);
        await expect(directorUi.page.getByTestId(`attendance-report-total-purchased-${item._id}`)).toContainText(
          String(expectedPurchasedSessions),
        );
      }
    } finally {
      await closeActors(directorUi);
    }
  });
});
