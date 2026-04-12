import { expect, test } from '@playwright/test';
import {
  RECEIPT_DATA_URL,
  apiJson,
  approvalFile,
  applySessionCookies,
  createBatchEvidenceContext,
  createSubmittedOrder,
  findInvoicesByOrderId,
  getOrderById,
  getWalletBalanceByUserId,
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

function appUrl(path: string): string {
  return new URL(path, APP_BASE_URL).toString();
}

test.use({
  trace: 'off',
  video: 'on',
});

test('B04 approved order cancel propagates across orders, invoices, students, and wallet rollback', async ({
  browser,
  request,
}) => {
  test.slow();
  test.setTimeout(300_000);

  const evidence = await createBatchEvidenceContext(browser, {
    batchId: 'B04',
    scenario: 'order_cancel_linked_views_browser',
    runDate: RUN_DATE,
  });

  const directorSession = await loginAsRole(request, 'director');
  const label = `cancel-linked-views-${Date.now()}`;
  const seededOrder = await createSubmittedOrder(request, {
    label,
    totalAmount: 2_400_000,
    finalAmount: 2_400_000,
    sessions: 12,
    invoiceSessions: 12,
    sessionDuration: 90,
    baseDuration: 90,
    pricePerSession: 200_000,
    teachingMode: 'ONLINE',
    teacherPayPerSession: 120_000,
    receiptImage: RECEIPT_DATA_URL,
  });

  const expectedAmount = 2_400_000;
  const invoiceNumber = String(seededOrder.items?.[0]?.invoiceNumber || '');

  try {
    await applySessionCookies(evidence.page, directorSession);
    await evidence.page.goto(appUrl('/app/orders'));
    await evidence.page.waitForLoadState('networkidle');

    await expect(evidence.page.locator('h2')).toContainText(/Đơn đăng ký học|Don dang ky hoc/i);

    const orderKeyword = evidence.page.locator('section.filters input').first();
    await orderKeyword.fill(seededOrder.orderCode);

    const orderRow = evidence.page.locator(`[data-testid="order-row"][data-order-code="${seededOrder.orderCode}"]`);
    await expect(orderRow).toBeVisible({ timeout: 20_000 });

    await orderRow.locator('td').first().click();
    const detailModal = evidence.page.getByTestId('order-detail-modal');
    await expect(detailModal).toBeVisible({ timeout: 20_000 });

    await detailModal.getByTestId('order-detail-approve').click();
    const approveModal = evidence.page.getByTestId('order-approve-modal');
    await expect(approveModal).toBeVisible({ timeout: 20_000 });
    await approveModal.getByTestId('order-approve-image').setInputFiles(
      approvalFile('b04-order-cancel-linked-views-approval.png'),
    );
    await approveModal.getByTestId('order-approve-confirm').click();
    await expect(approveModal).toBeHidden({ timeout: 30_000 });

    await expect(detailModal.locator('.detail-head .badge')).toContainText(/Đã duyệt|APPROVED|Da duyet/i, {
      timeout: 30_000,
    });
    await expect(detailModal.getByText(/Invoice:\s*1/i)).toBeVisible({ timeout: 20_000 });
    await expect(orderRow.locator('.status-stack .badge').first()).toContainText(/Đã duyệt|APPROVED|Da duyet/i, {
      timeout: 20_000,
    });

    const approvedOrder = await getOrderById(request, directorSession, seededOrder._id);
    const approvedStudentId = String(approvedOrder.processedResults?.studentId || '');
    const approvedStudent = approvedStudentId
      ? await apiJson<any>(request, directorSession, 'GET', `/students/${approvedStudentId}`)
      : null;
    const approvedStudentCode = String(approvedStudent?.studentCode || '');
    const approvedStudentName = String(approvedOrder.studentName || seededOrder.studentName);
    const approvedParentName = String(approvedOrder.parentName || seededOrder.parentName);
    const approvedParentUserId = String(approvedOrder.parentUserId || '');

    expect(approvedStudentId).toBeTruthy();
    expect(approvedStudentCode).toBeTruthy();
    expect(approvedParentUserId).toBeTruthy();

    await expect
      .poll(() => getWalletBalanceByUserId(request, directorSession, approvedParentUserId))
      .toBe(expectedAmount);
    await evidence.step('01-order-approved-and-wallet-topped-up-before-cancel');

    const cancelDialogHandled = new Promise<string>((resolve) => {
      evidence.page.once('dialog', (dialog) => {
        const message = dialog.message();
        void dialog.accept().then(() => resolve(message));
      });
    });
    await detailModal.getByTestId('order-detail-cancel').click();
    const cancelDialogMessage = await cancelDialogHandled;
    expect(cancelDialogMessage).toContain(seededOrder.orderCode);

    await expect(detailModal).toBeHidden({ timeout: 20_000 });
    await expect(orderRow.locator('.status-stack .badge').first()).toContainText(/Đã hủy|CANCELLED|Da huy/i, {
      timeout: 30_000,
    });
    await evidence.step('02-order-row-turns-cancelled-after-ui-cancel');

    await orderRow.locator('td').first().click();
    const cancelledDetailModal = evidence.page.getByTestId('order-detail-modal');
    await expect(cancelledDetailModal).toBeVisible({ timeout: 20_000 });
    await expect(cancelledDetailModal.locator('.detail-head .badge')).toContainText(/Đã hủy|CANCELLED|Da huy/i);
    await expect(cancelledDetailModal.getByTestId('order-detail-cancel')).toHaveCount(0);
    await expect(cancelledDetailModal.getByTestId('order-detail-submit')).toHaveCount(0);
    await expect(cancelledDetailModal.getByTestId('order-detail-approve')).toHaveCount(0);
    await cancelledDetailModal.getByTestId('order-detail-close').click();
    await expect(cancelledDetailModal).toBeHidden({ timeout: 15_000 });
    await evidence.step('03-order-detail-reopen-shows-cancelled-and-no-further-actions');

    await evidence.page.locator('aside.sidebar a[href="/app/invoices"]').first().click();
    await evidence.page.waitForURL(/\/app\/invoices/, { timeout: 20_000 });
    const invoiceKeyword = evidence.page.locator('section.filters-section input').first();
    await invoiceKeyword.fill(invoiceNumber);
    const invoiceRow = evidence.page.locator(`[data-testid="invoice-row"][data-invoice-number="${invoiceNumber}"]`);
    await expect(invoiceRow).toBeVisible({ timeout: 20_000 });
    await expect(invoiceRow.locator('.status')).toContainText(/Đã hủy|CANCELLED|Da huy/i, { timeout: 20_000 });
    await expect(invoiceRow.getByTestId('invoice-row-cancel')).toHaveCount(0);
    await evidence.step('04-invoices-list-shows-cancelled-generated-invoice');

    await evidence.page.locator('aside.sidebar a[href="/app/students"]').first().click();
    await evidence.page.waitForURL(/\/app\/students/, { timeout: 20_000 });
    const studentKeyword = evidence.page.locator('section.filters input').first();
    await studentKeyword.fill(approvedStudentCode);
    const studentRow = evidence.page.locator('table.data tbody tr').filter({ hasText: approvedStudentCode }).first();
    await expect(studentRow).toBeVisible({ timeout: 20_000 });
    await expect(studentRow).toContainText(approvedStudentName);
    await expect(studentRow).toContainText(approvedParentName);
    await evidence.step('05-students-list-keeps-provisioned-student-visible-after-cancel');

    const cancelledOrder = await getOrderById(request, directorSession, seededOrder._id);
    expect(cancelledOrder.status).toBe('CANCELLED');

    const relatedInvoices = await findInvoicesByOrderId(request, directorSession, seededOrder._id);
    expect(relatedInvoices).toHaveLength(1);
    expect(relatedInvoices[0].status).toBe('CANCELLED');

    await expect
      .poll(() => getWalletBalanceByUserId(request, directorSession, approvedParentUserId))
      .toBe(0);
    await evidence.step('06-backend-order-invoice-and-wallet-rollback-match-ui');

    await evidence.finalize('PASS', {
      extraLines: [
        `Seeded order: ${seededOrder.orderCode}`,
        `Generated invoice: ${invoiceNumber}`,
        `Provisioned student code kept visible after cancel: ${approvedStudentCode}`,
        'Verified DIRECTOR can cancel an approved order from the order detail modal and the order row/detail both switch to CANCELLED with no further submit/approve/cancel actions.',
        'Verified the linked invoice is cancelled, the parent wallet rolls back exactly to 0, and the provisioned student remains visible on Students without weakening any oracle.',
      ],
    });
  } catch (error) {
    await evidence.finalize('FAIL', { error });
    throw error;
  }
});
