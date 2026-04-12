import { expect, test } from '@playwright/test';
import {
  approvalFile,
  apiJson,
  applySessionCookies,
  createBatchEvidenceContext,
  createSubmittedOrder,
  findInvoicesByOrderId,
  getOrderById,
  getWalletBalanceByUserId,
  invoiceRow,
  loginAsRole,
  RECEIPT_DATA_URL,
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

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function overviewMoneyPattern(value: number): RegExp {
  const formatted = new Intl.NumberFormat('en-US').format(value);
  return new RegExp(`${escapeRegex(formatted)}\\s*[đd]`, 'i');
}

function investorMoney(value: number): string {
  return new Intl.NumberFormat('vi-VN').format(value);
}

test.use({
  trace: 'off',
  video: 'on',
});

test('B04 installment order keeps invoice rounds exact and updates deferred-revenue finance surfaces after only round 1 is approved', async ({
  browser,
  request,
}) => {
  test.slow();
  test.setTimeout(300_000);

  const evidence = await createBatchEvidenceContext(browser, {
    batchId: 'B04',
    scenario: 'installment_deferred_revenue_browser',
    runDate: RUN_DATE,
  });

  const directorSession = await loginAsRole(request, 'director');
  const label = `installment-deferred-${Date.now()}`;
  const seededOrder = await createSubmittedOrder(request, {
    label,
    totalAmount: 3_000_000,
    finalAmount: 3_000_000,
    sessions: 12,
    invoiceSessions: 12,
    sessionDuration: 60,
    baseDuration: 60,
    pricePerSession: 250_000,
    paymentPlan: 'INSTALLMENT_3',
    receiptImage: RECEIPT_DATA_URL,
  });

  const beforeDashboard = await apiJson<any>(
    request,
    directorSession,
    'GET',
    '/financial-control/dashboard',
  );
  const beforeInvestor = await apiJson<any>(
    request,
    directorSession,
    'GET',
    '/financial-control/investor-metrics',
  );

  try {
    await applySessionCookies(evidence.page, directorSession);
    await evidence.page.goto(appUrl(`/app/orders?orderId=${seededOrder._id}`));
    await evidence.page.waitForLoadState('networkidle');

    const detailModal = evidence.page.getByTestId('order-detail-modal');
    await expect(detailModal).toBeVisible({ timeout: 20_000 });
    await expect(detailModal).toContainText(/Chia 3|INSTALLMENT_3/i);

    await detailModal.getByTestId('order-detail-approve').click();
    const approveModal = evidence.page.getByTestId('order-approve-modal');
    await expect(approveModal).toBeVisible({ timeout: 20_000 });
    await approveModal.getByTestId('order-approve-image').setInputFiles(
      approvalFile('b04-installment-deferred-approval.png'),
    );
    evidence.page.once('dialog', (dialog) => dialog.accept());
    await approveModal.getByTestId('order-approve-confirm').click();
    await expect(approveModal).toBeHidden({ timeout: 30_000 });

    await expect(detailModal.locator('.badge').first()).toContainText(/Đã duyệt|Da duyet|APPROVED/i, {
      timeout: 30_000,
    });
    await expect(detailModal.getByText(/Invoice:\s*3/i)).toBeVisible({ timeout: 20_000 });
    await evidence.step('01-order-approval-creates-three-installment-invoices-without-auto-approving-them');

    await expect
      .poll(async () => getOrderById(request, directorSession, seededOrder._id), {
        timeout: 30_000,
      })
      .toMatchObject({
        _id: seededOrder._id,
        status: 'APPROVED',
        processedResults: {
          invoiceIds: expect.any(Array),
        },
      });

    await expect
      .poll(
        async () => (await findInvoicesByOrderId(request, directorSession, seededOrder._id)).length,
        { timeout: 30_000 },
      )
      .toBe(3);

    const seededInvoices = await findInvoicesByOrderId(request, directorSession, seededOrder._id);
    const installmentInvoices = [...seededInvoices].sort(
      (left, right) => Number(left.paymentRound || 0) - Number(right.paymentRound || 0),
    );
    expect(installmentInvoices.map((invoice) => invoice.paymentRound)).toEqual([1, 2, 3]);
    expect(installmentInvoices.map((invoice) => invoice.amount)).toEqual([1_000_000, 1_000_000, 1_000_000]);
    expect(installmentInvoices.map((invoice) => invoice.status)).toEqual([
      'PENDING_APPROVAL',
      'PENDING_APPROVAL',
      'PENDING_APPROVAL',
    ]);

    const approvedOrder = await getOrderById(request, directorSession, seededOrder._id);
    const approvedParentUserId = String(approvedOrder.parentUserId || '');
    expect(approvedParentUserId).toBeTruthy();
    await expect.poll(() => getWalletBalanceByUserId(request, directorSession, approvedParentUserId)).toBe(0);

    await evidence.page.goto(appUrl('/app/invoices'));
    await evidence.page.waitForLoadState('networkidle');

    const invoiceFilter = evidence.page.locator('section.filters-section input').first();
    await invoiceFilter.fill(String(seededOrder.items?.[0]?.invoiceNumber || ''));
    await evidence.page.waitForLoadState('networkidle');

    const firstInvoiceRow = invoiceRow(evidence.page, installmentInvoices[0].invoiceNumber);
    const secondInvoiceRow = invoiceRow(evidence.page, installmentInvoices[1].invoiceNumber);
    const thirdInvoiceRow = invoiceRow(evidence.page, installmentInvoices[2].invoiceNumber);

    await expect(firstInvoiceRow).toBeVisible({ timeout: 20_000 });
    await expect(secondInvoiceRow).toBeVisible({ timeout: 20_000 });
    await expect(thirdInvoiceRow).toBeVisible({ timeout: 20_000 });

    await expect(firstInvoiceRow.locator('td').nth(6)).toHaveText(/\s*1\s*/);
    await expect(secondInvoiceRow.locator('td').nth(6)).toHaveText(/\s*2\s*/);
    await expect(thirdInvoiceRow.locator('td').nth(6)).toHaveText(/\s*3\s*/);

    await expect(firstInvoiceRow.locator('td').nth(7)).toContainText(/1[.,]000[.,]000.*đ|1[.,]000[.,]000/i);
    await expect(secondInvoiceRow.locator('td').nth(7)).toContainText(/1[.,]000[.,]000.*đ|1[.,]000[.,]000/i);
    await expect(thirdInvoiceRow.locator('td').nth(7)).toContainText(/1[.,]000[.,]000.*đ|1[.,]000[.,]000/i);

    await expect(firstInvoiceRow.locator('td').nth(9)).toContainText(/Chờ duyệt|Cho duyet|PENDING_APPROVAL/i);
    await expect(secondInvoiceRow.locator('td').nth(9)).toContainText(/Chờ duyệt|Cho duyet|PENDING_APPROVAL/i);
    await expect(thirdInvoiceRow.locator('td').nth(9)).toContainText(/Chờ duyệt|Cho duyet|PENDING_APPROVAL/i);
    await evidence.step('02-invoice-ui-shows-installment-rounds-1-2-3-and-keeps-them-pending-after-order-approve');

    await firstInvoiceRow.getByTestId('invoice-row-approve').click();
    const invoiceApproveModal = evidence.page.getByTestId('invoice-approve-modal');
    await expect(invoiceApproveModal).toBeVisible({ timeout: 20_000 });
    await invoiceApproveModal.getByTestId('invoice-approve-file').setInputFiles(
      approvalFile(`b04-installment-deferred-${installmentInvoices[0].invoiceNumber}.png`),
    );
    evidence.page.once('dialog', (dialog) => dialog.accept());
    await invoiceApproveModal.getByTestId('invoice-approve-confirm').click();
    await expect(invoiceApproveModal).toBeHidden({ timeout: 30_000 });

    await expect(firstInvoiceRow.locator('td').nth(9)).toContainText(/Đã duyệt|Da duyet|APPROVED/i);
    await expect(secondInvoiceRow.locator('td').nth(9)).toContainText(/Chờ duyệt|Cho duyet|PENDING_APPROVAL/i);
    await expect(thirdInvoiceRow.locator('td').nth(9)).toContainText(/Chờ duyệt|Cho duyet|PENDING_APPROVAL/i);
    await evidence.step('03-only-round-1-turns-approved-while-round-2-3-stay-pending');

    await expect.poll(() => getWalletBalanceByUserId(request, directorSession, approvedParentUserId)).toBe(1_000_000);
    await expect.poll(async () => {
      const order = await getOrderById(request, directorSession, seededOrder._id);
      return (order.paymentFrames || []).map((frame: any) => frame.status);
    }).toEqual(['PAID', 'PENDING', 'PENDING']);

    await expect
      .poll(async () => apiJson<any>(request, directorSession, 'GET', '/financial-control/dashboard'), {
        timeout: 30_000,
      })
      .toMatchObject({
        deferredRevenue: {
          pendingInvoiceCount: beforeDashboard.deferredRevenue.pendingInvoiceCount + 2,
        },
      });

    const dashboardAfter = await apiJson<any>(
      request,
      directorSession,
      'GET',
      '/financial-control/dashboard',
    );
    expect(
      dashboardAfter.deferredRevenue.walletBalance - beforeDashboard.deferredRevenue.walletBalance,
    ).toBe(1_000_000);
    expect(
      dashboardAfter.deferredRevenue.pendingInvoiceAmount - beforeDashboard.deferredRevenue.pendingInvoiceAmount,
    ).toBe(2_000_000);
    expect(
      dashboardAfter.deferredRevenue.pendingInvoiceCount - beforeDashboard.deferredRevenue.pendingInvoiceCount,
    ).toBe(2);

    await expect
      .poll(async () => apiJson<any>(request, directorSession, 'GET', '/financial-control/investor-metrics'), {
        timeout: 30_000,
      })
      .toMatchObject({
        revenue: {
          unearnedRevenue: {
            total: beforeInvestor.revenue.unearnedRevenue.total + 2_000_000,
          },
        },
      });

    const metricsAfter = await apiJson<any>(
      request,
      directorSession,
      'GET',
      '/financial-control/investor-metrics',
    );
    expect(
      metricsAfter.revenue.unearnedRevenue.total - beforeInvestor.revenue.unearnedRevenue.total,
    ).toBe(2_000_000);
    expect(
      metricsAfter.revenue.unearnedRevenue.walletBalance - beforeInvestor.revenue.unearnedRevenue.walletBalance,
    ).toBe(1_000_000);
    expect(
      metricsAfter.revenue.unearnedRevenue.unconsumedInvoiceValue - beforeInvestor.revenue.unearnedRevenue.unconsumedInvoiceValue,
    ).toBe(1_000_000);

    await evidence.page.goto(appUrl('/app/financial-control'));
    await evidence.page.waitForLoadState('networkidle');

    const deferredRevenueSection = evidence.page
      .locator('.tab-content .dash-section')
      .filter({ has: evidence.page.locator('h4', { hasText: /DOANH THU.*PHU HUYNH|DOANH THU/i }) })
      .first();
    const walletCard = deferredRevenueSection.locator('.ov-card.inflow').nth(0);
    const pendingCard = deferredRevenueSection.locator('.ov-card.inflow').nth(1);

    await expect(walletCard).toContainText(overviewMoneyPattern(dashboardAfter.deferredRevenue.walletBalance));
    await expect(pendingCard).toContainText(overviewMoneyPattern(dashboardAfter.deferredRevenue.pendingInvoiceAmount));
    await expect(pendingCard).toContainText(new RegExp(`${dashboardAfter.deferredRevenue.pendingInvoiceCount}\\s+hóa đơn|${dashboardAfter.deferredRevenue.pendingInvoiceCount}\\s+hoa don`, 'i'));
    await evidence.step('04-financial-control-overview-shows-wallet-plus-1tr-and-pending-invoices-plus-2tr');

    await evidence.page.goto(appUrl('/app/investor-dashboard'));
    await evidence.page.waitForLoadState('networkidle');

    const liabilitiesPanel = evidence.page.getByTestId('investor-panel-liabilities');
    await expect(liabilitiesPanel).toBeVisible({ timeout: 20_000 });
    await expect(liabilitiesPanel.locator('.stack-row').filter({ hasText: 'Deferred revenue' })).toContainText(
      investorMoney(metricsAfter.revenue.unearnedRevenue.total),
    );
    await expect(liabilitiesPanel.locator('.stack-row').filter({ hasText: 'Wallet balance' })).toContainText(
      investorMoney(metricsAfter.revenue.unearnedRevenue.walletBalance),
    );
    await expect(liabilitiesPanel.locator('.stack-row').filter({ hasText: 'Unconsumed invoice value' })).toContainText(
      investorMoney(metricsAfter.revenue.unearnedRevenue.unconsumedInvoiceValue),
    );
    await evidence.step('05-investor-dashboard-keeps-deferred-revenue-at-2tr-after-only-round-1-is-approved');

    await evidence.finalize('PASS', {
      extraLines: [
        `Seeded installment order: ${seededOrder.orderCode || seededOrder._id}`,
        `Installment invoice numbers: ${installmentInvoices.map((invoice) => invoice.invoiceNumber).join(', ')}`,
        'Verified approving the installment order creates exactly three pending invoices for rounds 1/2/3 at 1,000,000đ each instead of auto-approving the whole bundle.',
        'Verified approving only round 1 increases parent wallet by exactly 1,000,000đ, leaves 2 pending invoices worth exactly 2,000,000đ on Financial Control, and keeps Investor Dashboard deferred revenue at exactly 2,000,000đ.',
      ],
    });
  } catch (error) {
    await evidence.finalize('FAIL', { error });
    throw error;
  }
});
