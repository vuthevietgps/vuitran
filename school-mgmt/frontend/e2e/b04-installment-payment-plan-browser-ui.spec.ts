import { expect, test } from '@playwright/test';
import {
  approvalFile,
  applySessionCookies,
  createBatchEvidenceContext,
  createEnrollmentFixture,
  createPendingInvoice,
  getInvoiceById,
  getWalletBalanceByUserId,
  invoiceRow,
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

test('B04 installment keeps exact payment rounds and amounts while only the first installment is approved', async ({
  browser,
  request,
}) => {
  test.slow();
  test.setTimeout(300_000);

  const evidence = await createBatchEvidenceContext(browser, {
    batchId: 'B04',
    scenario: 'installment_payment_plan_browser',
    runDate: RUN_DATE,
  });

  const directorSession = await loginAsRole(request, 'director');
  const accountingSession = await loginAsRole(request, 'accounting');
  const label = `installment-browser-${Date.now()}`;
  const enrollment = await createEnrollmentFixture(request, {
    label,
    classMode: 'ONLINE',
    initializeWallet: true,
    initialWalletAmount: 0,
  });
  const invoicePrefix = `E2E-INSTALL-${Date.now()}`;

  const [invoiceOne, invoiceTwo, invoiceThree] = await Promise.all([
    createPendingInvoice(request, enrollment, {
      invoiceNumber: `${invoicePrefix}-1`,
      amount: 1_000_000,
      paymentRound: 1,
      sessions: 4,
    }),
    createPendingInvoice(request, enrollment, {
      invoiceNumber: `${invoicePrefix}-2`,
      amount: 1_000_000,
      paymentRound: 2,
      sessions: 4,
    }),
    createPendingInvoice(request, enrollment, {
      invoiceNumber: `${invoicePrefix}-3`,
      amount: 1_000_000,
      paymentRound: 3,
      sessions: 4,
    }),
  ]);

  try {
    await applySessionCookies(evidence.page, accountingSession);
    await evidence.page.goto(appUrl('/app/invoices'));
    await evidence.page.waitForLoadState('networkidle');

    await expect(evidence.page.locator('h2')).toContainText(/Quản lý hóa đơn|Quan ly hoa don/i);
    const keywordInput = evidence.page.locator('section.filters-section input').first();
    await keywordInput.fill(invoicePrefix);
    await evidence.page.waitForLoadState('networkidle');

    const firstRow = invoiceRow(evidence.page, invoiceOne.invoiceNumber);
    const secondRow = invoiceRow(evidence.page, invoiceTwo.invoiceNumber);
    const thirdRow = invoiceRow(evidence.page, invoiceThree.invoiceNumber);

    await expect(firstRow).toBeVisible({ timeout: 20_000 });
    await expect(secondRow).toBeVisible({ timeout: 20_000 });
    await expect(thirdRow).toBeVisible({ timeout: 20_000 });

    await expect(firstRow.locator('td').nth(6)).toHaveText(/\s*1\s*/);
    await expect(secondRow.locator('td').nth(6)).toHaveText(/\s*2\s*/);
    await expect(thirdRow.locator('td').nth(6)).toHaveText(/\s*3\s*/);

    await expect(firstRow.locator('td').nth(7)).toContainText(/1[.,]000[.,]000.*đ|1[.,]000[.,]000/);
    await expect(secondRow.locator('td').nth(7)).toContainText(/1[.,]000[.,]000.*đ|1[.,]000[.,]000/);
    await expect(thirdRow.locator('td').nth(7)).toContainText(/1[.,]000[.,]000.*đ|1[.,]000[.,]000/);

    await expect(firstRow.locator('td').nth(9)).toContainText(/Chờ duyệt|Cho duyet|PENDING_APPROVAL/i);
    await expect(secondRow.locator('td').nth(9)).toContainText(/Chờ duyệt|Cho duyet|PENDING_APPROVAL/i);
    await expect(thirdRow.locator('td').nth(9)).toContainText(/Chờ duyệt|Cho duyet|PENDING_APPROVAL/i);
    await evidence.step('01-installment-rows-show-three-rounds-and-equal-amounts');

    await firstRow.getByTestId('invoice-row-approve').click();
    const approveModal = evidence.page.getByTestId('invoice-approve-modal');
    await expect(approveModal).toBeVisible({ timeout: 20_000 });
    await expect(approveModal).toContainText(invoiceOne.invoiceNumber);
    await expect(approveModal).toContainText(/1[.,]000[.,]000.*đ|1[.,]000[.,]000/);
    await approveModal.getByTestId('invoice-approve-file').setInputFiles(
      approvalFile(`b04-installment-${invoiceOne.invoiceNumber}.png`),
    );
    evidence.page.once('dialog', (dialog) => dialog.accept());
    await approveModal.getByTestId('invoice-approve-confirm').click();
    await expect(approveModal).toBeHidden({ timeout: 30_000 });

    await expect(firstRow.locator('td').nth(9)).toContainText(/Đã duyệt|Da duyet|APPROVED/i);
    await expect(secondRow.locator('td').nth(9)).toContainText(/Chờ duyệt|Cho duyet|PENDING_APPROVAL/i);
    await expect(thirdRow.locator('td').nth(9)).toContainText(/Chờ duyệt|Cho duyet|PENDING_APPROVAL/i);
    await evidence.step('02-only-first-installment-turns-approved');

    const [approvedInvoice, pendingInvoiceTwo, pendingInvoiceThree] = await Promise.all([
      getInvoiceById(request, directorSession, invoiceOne._id),
      getInvoiceById(request, directorSession, invoiceTwo._id),
      getInvoiceById(request, directorSession, invoiceThree._id),
    ]);
    expect(approvedInvoice.status).toBe('APPROVED');
    expect(pendingInvoiceTwo.status).toBe('PENDING_APPROVAL');
    expect(pendingInvoiceThree.status).toBe('PENDING_APPROVAL');

    await expect
      .poll(() => getWalletBalanceByUserId(request, directorSession, enrollment.parent._id))
      .toBe(1_000_000);
    await evidence.step('03-wallet-only-reflects-first-installment-amount');

    await evidence.finalize('PASS', {
      extraLines: [
        `Invoice bundle prefix: ${invoicePrefix}`,
        'Verified the invoice UI renders three installment rounds 1/2/3 with the exact 1,000,000đ amount on each row.',
        'Verified approving only installment round 1 leaves rounds 2 and 3 pending and increases parent wallet balance by exactly 1,000,000đ.',
      ],
    });
  } catch (error) {
    await evidence.finalize('FAIL', { error });
    throw error;
  }
});
