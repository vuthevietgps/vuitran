import { expect, test } from '@playwright/test';
import { apiJson } from '../support/api';
import { applySessionCookies, loginAsRole } from '../support/auth';
import { createBatchEvidenceContext } from '../support/orchestrator';
import { seedUiOrchestratorFixtures } from '../support/orchestrator-fixtures';
import {
  approvalFile,
  createPendingInvoice,
  getWalletBalanceByUserId,
  invoiceRow,
} from '../support/scenario-helpers';
import type { DemoSession } from '../support/types';

test.use({ video: 'on' });
test.describe.configure({ mode: 'serial', timeout: 180_000 });

const APP_BASE_URL =
  process.env['PLAYWRIGHT_BASE_URL']
  || process.env['E2E_BASE_URL']
  || 'http://localhost:4200';

const RUN_DATE =
  process.env['UI_EVIDENCE_DATE']
  || process.env['E2E_RUN_DATE']
  || new Date().toISOString().slice(0, 10);

type AnyRecord = any;
type EvidenceContext = Awaited<ReturnType<typeof createBatchEvidenceContext>>;

function appUrl(path: string): string {
  return new URL(path, APP_BASE_URL).toString();
}

function formatMoney(value: number): string {
  return `${Number(value || 0).toLocaleString('vi-VN')}đ`;
}

async function openEvidencePage(
  evidence: EvidenceContext,
  session: DemoSession,
  path: string,
): Promise<void> {
  await applySessionCookies(evidence.context, session);
  await evidence.page.goto(appUrl(path));
  await evidence.page.waitForLoadState('networkidle');
}

async function approveInvoiceFromUi(
  evidence: EvidenceContext,
  invoiceNumber: string,
  receiptName: string,
): Promise<void> {
  const row = invoiceRow(evidence.page, invoiceNumber);
  await expect(row).toBeVisible();
  await row.locator('[data-testid="invoice-row-approve"]').click();
  await evidence.page.locator('[data-testid="invoice-approve-file"]').setInputFiles(
    approvalFile(receiptName),
  );
  await expect(evidence.page.getByTestId('invoice-approve-confirm')).toBeEnabled();
  await evidence.step(`invoice-${invoiceNumber}-approve-modal-ready`);
  await Promise.all([
    evidence.page.once('dialog', (dialog) => dialog.accept().catch(() => undefined)),
    evidence.page.getByTestId('invoice-approve-confirm').click(),
  ]);
  await expect(evidence.page.locator('[data-testid="invoice-approve-modal"]')).toBeHidden({ timeout: 20_000 });
}

async function cancelInvoiceFromUi(
  evidence: EvidenceContext,
  invoiceNumber: string,
  reason: string,
): Promise<string> {
  const row = invoiceRow(evidence.page, invoiceNumber);
  const cancelButton = row.locator('[data-testid="invoice-row-cancel"]');
  await expect(cancelButton).toBeVisible();

  let alertMessage = '';
  const dialogSequence = new Promise<void>((resolve, reject) => {
    evidence.page.once('dialog', async (promptDialog) => {
      try {
        expect(promptDialog.type()).toBe('prompt');
        evidence.page.once('dialog', async (alertDialog) => {
          try {
            alertMessage = alertDialog.message();
            await alertDialog.accept();
            resolve();
          } catch (error) {
            reject(error);
          }
        });
        await promptDialog.accept(reason);
      } catch (error) {
        reject(error);
      }
    });
  });

  await cancelButton.click({ force: true });
  await dialogSequence;

  await evidence.page.waitForLoadState('networkidle');
  return alertMessage;
}

test.describe('B07 finance rollback constraints orchestrator', () => {
  let fixtures: Awaited<ReturnType<typeof seedUiOrchestratorFixtures>>;
  let directorSession: DemoSession;
  let accountingSession: DemoSession;

  test.beforeAll(async ({ request }) => {
    fixtures = await seedUiOrchestratorFixtures(request, 'finance-rollback-constraints');
    directorSession = await loginAsRole(request, 'director');
    accountingSession = await loginAsRole(request, 'accounting');
  });

  test('B07 accounting approves a top-up invoice and cancel rolls the wallet back by the same amount', async ({ browser, request }) => {
    const evidence = await createBatchEvidenceContext(browser, {
      batchId: 'B07',
      scenario: 'finance-topup-cancel-rollback',
      runDate: RUN_DATE,
    });

    try {
      const invoiceAmount = 360_000;
      const invoiceNumber = `FTUP-${Date.now()}`;
      const cancellationReason = `Rollback approved top-up ${invoiceNumber}`;

      const topUpInvoice = await createPendingInvoice(request, fixtures.depletedWalletFixture, {
        invoiceNumber,
        amount: invoiceAmount,
        paymentRound: 1,
        sessions: 6,
        classType: 'ONLINE',
      });

      await openEvidencePage(evidence, accountingSession, '/app/invoices');
      const balanceBefore = await getWalletBalanceByUserId(
        request,
        directorSession,
        fixtures.depletedWalletFixture.parent._id,
      );

      await expect(invoiceRow(evidence.page, invoiceNumber)).toBeVisible();
      await evidence.step('invoice-topup-pending-visible');

      await approveInvoiceFromUi(evidence, invoiceNumber, `b07-${invoiceNumber}-approval.png`);
      await expect(invoiceRow(evidence.page, invoiceNumber)).toContainText(/APPROVED|Da duyet|Đã duyệt/i);
      await expect.poll(async () => getWalletBalanceByUserId(
        request,
        directorSession,
        fixtures.depletedWalletFixture.parent._id,
      )).toBe(balanceBefore + invoiceAmount);
      await evidence.step('invoice-topup-approved-visible');

      const cancelMessage = await cancelInvoiceFromUi(
        evidence,
        invoiceNumber,
        cancellationReason,
      );
      expect(cancelMessage).toMatch(/Da huy hoa don|huy hoa don|rollback/i);

      await evidence.page.getByRole('button', { name: /Lam moi|Làm mới/i }).click();
      const cancelledRow = invoiceRow(evidence.page, invoiceNumber);
      await expect(cancelledRow).toContainText(/CANCELLED|Da huy|Đã hủy/i);
      await expect.poll(async () => getWalletBalanceByUserId(
        request,
        directorSession,
        fixtures.depletedWalletFixture.parent._id,
      )).toBe(balanceBefore);
      await evidence.step('invoice-topup-cancelled-visible');

      await evidence.finalize('PASS', {
        extraLines: [
          `Invoice: ${topUpInvoice.invoiceNumber}`,
          `Approved amount: ${formatMoney(invoiceAmount)}`,
          `Wallet balance before approval: ${formatMoney(balanceBefore)}`,
          `Wallet balance after cancel: ${formatMoney(balanceBefore)}`,
        ],
      });
    } catch (error) {
      await evidence.finalize('FAIL', { error });
      throw error;
    }
  });

  test('B07 canceling a fully spent top-up is blocked before the wallet can go negative', async ({ browser, request }) => {
    const evidence = await createBatchEvidenceContext(browser, {
      batchId: 'B07',
      scenario: 'finance-topup-cancel-overdraft-guard',
      runDate: RUN_DATE,
    });

    try {
      const invoiceAmount = 420_000;
      const invoiceNumber = `FNEG-${Date.now()}`;
      const spendDescription = `Drain wallet before cancel ${invoiceNumber}`;
      const cancellationReason = `Attempted rollback after full spend ${invoiceNumber}`;

      const topUpInvoice = await createPendingInvoice(request, fixtures.depletedWalletFixture, {
        invoiceNumber,
        amount: invoiceAmount,
        paymentRound: 1,
        sessions: 8,
        classType: 'ONLINE',
      });

      await openEvidencePage(evidence, accountingSession, '/app/invoices');
      const balanceBefore = await getWalletBalanceByUserId(
        request,
        directorSession,
        fixtures.depletedWalletFixture.parent._id,
      );

      await expect(invoiceRow(evidence.page, invoiceNumber)).toBeVisible();
      await evidence.step('invoice-topup-pending-visible');

      await approveInvoiceFromUi(evidence, invoiceNumber, `b07-${invoiceNumber}-approval.png`);
      await expect(invoiceRow(evidence.page, invoiceNumber)).toContainText(/APPROVED|Da duyet|Đã duyệt/i);
      await expect.poll(async () => getWalletBalanceByUserId(
        request,
        directorSession,
        fixtures.depletedWalletFixture.parent._id,
      )).toBe(balanceBefore + invoiceAmount);
      await evidence.step('invoice-topup-approved-visible');

      await apiJson<AnyRecord>(request, accountingSession, 'POST', '/wallets/transfer', {
        fromUserId: fixtures.depletedWalletFixture.parent._id,
        toUserId: fixtures.freshParent._id,
        amount: invoiceAmount,
        description: spendDescription,
      });

      await expect.poll(async () => getWalletBalanceByUserId(
        request,
        directorSession,
        fixtures.depletedWalletFixture.parent._id,
      )).toBe(0);
      await evidence.step('wallet-drained-before-cancel');

      const cancelMessage = await cancelInvoiceFromUi(
        evidence,
        invoiceNumber,
        cancellationReason,
      );

      const balanceAfterCancel = await getWalletBalanceByUserId(
        request,
        directorSession,
        fixtures.depletedWalletFixture.parent._id,
      );

      expect(cancelMessage).toMatch(/so du|số dư|khong du|không đủ|am|âm|rollback|balance/i);
      await evidence.page.getByRole('button', { name: /Lam moi|Làm mới/i }).click();
      await expect(invoiceRow(evidence.page, invoiceNumber)).toContainText(/APPROVED|Da duyet|Đã duyệt/i);
      expect(balanceAfterCancel).toBe(0);
      await evidence.step('invoice-topup-cancel-attempted');

      await evidence.finalize('PASS', {
        extraLines: [
          `Invoice: ${topUpInvoice.invoiceNumber}`,
          `Wallet balance after approval: ${formatMoney(invoiceAmount)}`,
          `Wallet balance before cancel: ${formatMoney(balanceBefore)}`,
          `Wallet balance after cancel attempt: ${formatMoney(balanceAfterCancel)}`,
          `Cancel guard message: ${cancelMessage}`,
        ],
      });
    } catch (error) {
      await evidence.finalize('FAIL', { error });
      throw error;
    }
  });
});
