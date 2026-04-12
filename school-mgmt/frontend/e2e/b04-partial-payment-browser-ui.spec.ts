import { expect, test } from '@playwright/test';
import {
  RECEIPT_DATA_URL,
  approvalFile,
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

test('B04 partial payment shows exact paid and remaining amounts with an underpaid badge after approval', async ({
  browser,
  request,
}) => {
  test.slow();
  test.setTimeout(300_000);

  const evidence = await createBatchEvidenceContext(browser, {
    batchId: 'B04',
    scenario: 'partial_payment_browser',
    runDate: RUN_DATE,
  });

  const directorSession = await loginAsRole(request, 'director');
  const label = `partial-payment-browser-${Date.now()}`;
  const seededOrder = await createSubmittedOrder(request, {
    label,
    totalAmount: 1_800_000,
    finalAmount: 1_200_000,
    discountAmount: 0,
    sessions: 9,
    invoiceSessions: 6,
    pricePerSession: 200_000,
    paymentPlan: 'INSTALLMENT_2',
    receiptImage: RECEIPT_DATA_URL,
  });

  const expectedPaidAmount = 1_200_000;
  const expectedRemainingAmount = 600_000;

  try {
    await applySessionCookies(evidence.page, directorSession);
    await evidence.page.goto(appUrl('/app/orders'));
    await evidence.page.waitForLoadState('networkidle');

    await expect(evidence.page.locator('h2')).toContainText(/Đơn đăng ký học|Don dang ky hoc/i);

    const keywordInput = evidence.page.locator('section.filters input').first();
    await keywordInput.fill(seededOrder.orderCode);

    const row = orderRow(evidence.page, seededOrder.orderCode);
    await expect(row).toBeVisible({ timeout: 20_000 });
    await expect(row.getByTestId('order-row-partial-badge')).toHaveCount(0);
    await evidence.step('01-submitted-partial-order-is-visible-before-approval');

    await row.locator('td').first().click();
    const detailModal = evidence.page.getByTestId('order-detail-modal');
    await expect(detailModal).toBeVisible({ timeout: 20_000 });
    await expect(detailModal.getByTestId('order-detail-partial-badge')).toHaveCount(0);

    await detailModal.getByTestId('order-detail-approve').click();
    const approveModal = evidence.page.getByTestId('order-approve-modal');
    await expect(approveModal).toBeVisible({ timeout: 20_000 });
    await approveModal.getByTestId('order-approve-image').setInputFiles(
      approvalFile('b04-partial-payment-approval.png'),
    );
    await approveModal.getByTestId('order-approve-confirm').click();
    await expect(approveModal).toBeHidden({ timeout: 30_000 });

    await expect(detailModal.locator('.badge').first()).toContainText(/Đã duyệt|APPROVED|Da duyet/i, {
      timeout: 30_000,
    });
    await expect(row.locator('.badge').first()).toContainText(/Đã duyệt|APPROVED|Da duyet/i, {
      timeout: 30_000,
    });
    await expect(row.getByTestId('order-row-partial-badge')).toContainText(/Chưa thanh toán đủ|Chua thanh toan du/i);
    await expect(row.getByTestId('order-row-paid-amount')).toContainText(/1[.,]200[.,]000.*đ|1[.,]200[.,]000/i);
    await expect(row.getByTestId('order-row-remaining-amount')).toContainText(/600[.,]000.*đ|600[.,]000/i);
    await expect(detailModal.getByTestId('order-detail-partial-badge')).toContainText(/Chưa thanh toán đủ|Chua thanh toan du/i);
    await expect(detailModal.getByTestId('order-detail-paid-amount')).toContainText(/1[.,]200[.,]000.*đ|1[.,]200[.,]000/i);
    await expect(detailModal.getByTestId('order-detail-remaining-amount')).toContainText(/600[.,]000.*đ|600[.,]000/i);
    await evidence.step('02-approved-order-shows-underpaid-badge-and-exact-paid-vs-remaining-split');

    const approvedOrder = await getOrderById(request, directorSession, seededOrder._id);
    expect(approvedOrder.status).toBe('APPROVED');

    const invoices = await findInvoicesByOrderId(request, directorSession, seededOrder._id);
    expect(invoices).toHaveLength(1);
    expect(invoices[0].status).toBe('APPROVED');
    expect(Number(invoices[0].amount || 0)).toBe(expectedPaidAmount);

    const approvedParentUserId = String(approvedOrder.parentUserId || '');
    expect(approvedParentUserId).toBeTruthy();
    await expect
      .poll(() => getWalletBalanceByUserId(request, directorSession, approvedParentUserId))
      .toBe(expectedPaidAmount);
    await evidence.step('03-approved-invoice-and-wallet-balance-match-paid-amount-only');

    await evidence.finalize('PASS', {
      extraLines: [
        `Seeded partial order: ${seededOrder.orderCode}`,
        `Approved invoice amount: ${expectedPaidAmount.toLocaleString('vi-VN')}đ`,
        `Remaining amount shown on UI: ${expectedRemainingAmount.toLocaleString('vi-VN')}đ`,
        'Verified approving the partial-payment order surfaces an explicit "Chưa thanh toán đủ" badge plus exact paid and remaining amounts on both the order row and the detail modal.',
        'Verified backend invoice generation and parent wallet balance match the exact paid amount only, without weakening any oracle.',
      ],
    });
  } catch (error) {
    await evidence.finalize('FAIL', { error });
    throw error;
  }
});
