import { expect, test } from '@playwright/test';
import {
  applySessionCookies,
  createBatchEvidenceContext,
  createSubmittedOrder,
  findInvoicesByOrderId,
  getOrderById,
  getWalletBalanceByUserId,
  loginAsRole,
  orderRow,
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

test('B04 trial 0đ keeps approved badge and exact zero-amount display without leaking product suggested price', async ({
  browser,
  request,
}) => {
  test.slow();
  test.setTimeout(300_000);

  const evidence = await createBatchEvidenceContext(browser, {
    batchId: 'B04',
    scenario: 'trial_zero_amount_browser',
    runDate: RUN_DATE,
  });

  const directorSession = await loginAsRole(request, 'director');
  const label = `trial-zero-amount-browser-${Date.now()}`;
  const seededOrder = await createSubmittedOrder(request, {
    label,
    totalAmount: 0,
    finalAmount: 0,
    sessions: 1,
    invoiceSessions: 0,
    sessionDuration: 60,
    baseDuration: 60,
    pricePerSession: 0,
    trialSessions: 1,
    teachingMode: 'OFFLINE',
    teacherPayPerStudent: 200_000,
    paymentPlan: 'FULL',
  });

  try {
    await applySessionCookies(evidence.page, directorSession);
    await evidence.page.goto(appUrl('/app/orders'));
    await evidence.page.waitForLoadState('networkidle');

    await expect(evidence.page.locator('h2')).toContainText(/Đơn đăng ký học|Don dang ky hoc/i);

    const keywordInput = evidence.page.locator('section.filters input').first();
    await keywordInput.fill(seededOrder.orderCode);

    const row = orderRow(evidence.page, seededOrder.orderCode);
    await expect(row).toBeVisible({ timeout: 20_000 });
    await expect(row.getByTestId('order-row-course-price')).toHaveText(/^\s*0d\s*$/i);
    await expect(row.getByTestId('order-row-course-price')).not.toContainText(/1[.,]500[.,]000|1500000|2[.,]000[.,]000|2000000/i);
    await expect(row.getByTestId('order-row-invoice-amount')).toContainText(/0d/i);
    await evidence.step('01-trial-row-stays-zero-before-approval');

    await row.locator('td').first().click();
    const detailModal = evidence.page.getByTestId('order-detail-modal');
    await expect(detailModal).toBeVisible({ timeout: 20_000 });
    await expect(detailModal.getByTestId('order-detail-course-price')).toContainText(/0d/i);
    await expect(detailModal.getByTestId('order-detail-course-price')).not.toContainText(/1[.,]500[.,]000|1500000|2[.,]000[.,]000|2000000/i);
    await expect(detailModal.getByTestId('order-detail-invoice-amount')).toContainText(/0d/i);
    await expect(detailModal.getByTestId('order-detail-item-invoice-sessions-0')).toContainText(/0\s*\+\s*0.*1.*học thử|0\s*\+\s*0.*1.*hoc thu/i);
    await evidence.step('02-trial-detail-shows-zero-course-price-and-one-trial-session');

    await detailModal.getByTestId('order-detail-approve').click();
    const approveModal = evidence.page.getByTestId('order-approve-modal');
    await expect(approveModal).toBeVisible({ timeout: 20_000 });
    await expect(approveModal).toContainText(/Đơn học thử offline 0đ, không bắt buộc upload hóa đơn sale|Don hoc thu offline 0d/i);
    await expect(approveModal).toContainText(/ảnh đối ứng không bắt buộc|anh doi ung khong bat buoc/i);
    await approveModal.getByTestId('order-approve-confirm').click();
    await expect(approveModal).toBeHidden({ timeout: 30_000 });

    await expect(detailModal.locator('.badge').first()).toContainText(/Đã duyệt|APPROVED|Da duyet/i, {
      timeout: 30_000,
    });
    await expect(row.locator('.badge').first()).toContainText(/Đã duyệt|APPROVED|Da duyet/i, {
      timeout: 30_000,
    });
    await expect(row.getByTestId('order-row-course-price')).toHaveText(/^\s*0d\s*$/i);
    await expect(row.getByTestId('order-row-invoice-amount')).toContainText(/0d/i);
    await expect(detailModal.getByTestId('order-detail-course-price')).toContainText(/0d/i);
    await expect(detailModal.getByTestId('order-detail-invoice-amount')).toContainText(/0d/i);
    await evidence.step('03-trial-order-approves-without-proof-and-keeps-zero-amount-display');

    const approvedOrder = await getOrderById(request, directorSession, seededOrder._id);
    expect(approvedOrder.status).toBe('APPROVED');

    const parentUserId = String(approvedOrder.parentUserId || '');
    expect(parentUserId).toBeTruthy();

    const invoices = await findInvoicesByOrderId(request, directorSession, seededOrder._id);
    expect(invoices).toHaveLength(1);
    expect(Number(invoices[0].amount || 0)).toBe(0);

    await expect
      .poll(() => getWalletBalanceByUserId(request, directorSession, parentUserId))
      .toBe(0);
    await evidence.step('04-generated-invoice-and-wallet-remain-zero');

    await evidence.finalize('PASS', {
      extraLines: [
        `Seeded zero-amount trial order: ${seededOrder.orderCode}`,
        'Verified the order row and detail modal both keep course price and invoice amount at exactly 0đ for the offline trial path instead of leaking the product suggested price.',
        'Verified DIRECTOR can approve the 0đ trial without uploading sale/counter receipts and the generated invoice plus wallet side effect both remain exactly 0đ.',
      ],
    });
  } catch (error) {
    await evidence.finalize('FAIL', { error });
    throw error;
  }
});
