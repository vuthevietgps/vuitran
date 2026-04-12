import { expect, test } from '@playwright/test';
import {
  acceptDialog,
  applySessionCookies,
  createBatchEvidenceContext,
  createPendingInvoice,
  getInvoiceById,
  getWalletBalanceByUserId,
  invoiceRow,
  loginAsRole,
  seedUiOrchestratorFixtures,
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

test.use({ video: 'on' });
test.describe.configure({ mode: 'serial', timeout: 180_000 });

test('B07 accounting reject invoice updates status, persists reason, and keeps wallet balance unchanged', async ({
  browser,
  request,
}) => {
  test.slow();

  const evidence = await createBatchEvidenceContext(browser, {
    batchId: 'B07',
    scenario: 'invoice_reject_browser',
    runDate: RUN_DATE,
  });

  const directorSession = await loginAsRole(request, 'director');
  const accountingSession = await loginAsRole(request, 'accounting');
  const fixtures = await seedUiOrchestratorFixtures(request, 'b07-invoice-reject-browser');

  const invoiceNumber = `INV-REJECT-${Date.now()}`;
  const rejectReason = `B07 reject invoice browser ${Date.now()}`;
  const invoice = await createPendingInvoice(request, fixtures.depletedWalletFixture, {
    invoiceNumber,
    amount: 385_000,
    paymentRound: 1,
    sessions: 5,
    classType: 'ONLINE',
  });

  const walletBalanceBefore = await getWalletBalanceByUserId(
    request,
    directorSession,
    fixtures.depletedWalletFixture.parent._id,
  );

  try {
    await applySessionCookies(evidence.context, accountingSession);
    await evidence.page.goto(appUrl('/app/invoices'));
    await evidence.page.waitForLoadState('networkidle');

    const pendingRow = invoiceRow(evidence.page, invoiceNumber);
    await expect(pendingRow).toBeVisible();
    await expect(pendingRow).toContainText(/PENDING_APPROVAL|Cho duyet|Chờ duyệt/i);
    await expect(pendingRow.locator('[data-testid="invoice-row-reject"]')).toBeVisible();
    await expect(pendingRow.locator('[data-testid="invoice-row-approve"]')).toBeVisible();
    await evidence.step('invoice-reject-pending-row-visible');

    const promptMessage = await acceptDialog(
      evidence.page,
      () => pendingRow.locator('[data-testid="invoice-row-reject"]').click(),
      rejectReason,
    );
    expect(promptMessage).toMatch(/Ly do|Lý do/i);

    await expect
      .poll(async () => {
        const latestInvoice = await getInvoiceById(request, directorSession, invoice._id);
        return latestInvoice.status;
      })
      .toBe('REJECTED');

    const rejectedInvoice = await getInvoiceById(request, directorSession, invoice._id);
    expect(rejectedInvoice.rejectedReason).toBe(rejectReason);

    await expect
      .poll(async () => getWalletBalanceByUserId(
        request,
        directorSession,
        fixtures.depletedWalletFixture.parent._id,
      ))
      .toBe(walletBalanceBefore);
    await evidence.step('invoice-reject-backend-state-stable');

    await evidence.page.reload({ waitUntil: 'networkidle' });
    const rejectedRow = invoiceRow(evidence.page, invoiceNumber);
    await expect(rejectedRow).toBeVisible();
    await expect(rejectedRow).toContainText(/REJECTED|Tu choi|Từ chối/i);
    await expect(rejectedRow.locator('[data-testid="invoice-row-reject"]')).toHaveCount(0);
    await expect(rejectedRow.locator('[data-testid="invoice-row-approve"]')).toHaveCount(0);
    await evidence.step('invoice-reject-row-updated');

    const statusFilter = evidence.page.locator('.filters-section select').nth(1);
    await statusFilter.selectOption('REJECTED');
    await expect(invoiceRow(evidence.page, invoiceNumber)).toBeVisible();
    await evidence.step('invoice-reject-filter-rejected');

    await statusFilter.selectOption('PENDING_APPROVAL');
    await expect(invoiceRow(evidence.page, invoiceNumber)).toHaveCount(0);
    await evidence.step('invoice-reject-filter-pending-cleared');

    await evidence.finalize('PASS', {
      extraLines: [
        `Rejected invoice: ${invoiceNumber}`,
        `Rejected reason persisted exactly: ${rejectReason}`,
        `Wallet balance stayed unchanged at: ${walletBalanceBefore.toLocaleString('vi-VN')} đ`,
        'Browser proof shows the row leaving pending state and reappearing under the REJECTED filter without any wallet side effect.',
      ],
    });
  } catch (error) {
    await evidence.finalize('FAIL', { error });
    throw error;
  }
});
