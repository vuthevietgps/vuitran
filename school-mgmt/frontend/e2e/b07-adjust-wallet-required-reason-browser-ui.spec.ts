import { expect, test } from '@playwright/test';
import {
  applySessionCookies,
  createBatchEvidenceContext,
  getWalletBalanceByUserId,
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

function formatCurrency(value: number): string {
  return `${Number(value || 0).toLocaleString('vi-VN')} ₫`;
}

test.use({ video: 'on' });
test.describe.configure({ mode: 'serial', timeout: 180_000 });

test('B07 adjust wallet requires a reason, previews the exact ledger impact, and records the exact reason in UI ledger history', async ({
  browser,
  request,
}) => {
  test.slow();

  const evidence = await createBatchEvidenceContext(browser, {
    batchId: 'B07',
    scenario: 'adjust_wallet_required_reason_browser',
    runDate: RUN_DATE,
  });

  const fixtures = await seedUiOrchestratorFixtures(request, 'b07-adjust-wallet-required-reason');
  const accountingSession = await loginAsRole(request, 'accounting');

  const targetParent = fixtures.freshParent;
  const amount = 35_000;
  const description = `B07 adjust wallet ${Date.now()}`;
  const reason = `B07 exact audit reason ${Date.now()}`;
  const capturedAdjustPayloads: Array<Record<string, any>> = [];

  const requestListener = (outgoingRequest: { url: () => string; method: () => string; postDataJSON: () => any }): void => {
    if (outgoingRequest.method() !== 'POST' || !outgoingRequest.url().includes('/wallets/adjust')) {
      return;
    }
    capturedAdjustPayloads.push(outgoingRequest.postDataJSON());
  };

  try {
    const beforeBalance = await getWalletBalanceByUserId(request, accountingSession, targetParent._id);

    evidence.page.on('request', requestListener);
    await applySessionCookies(evidence.context, accountingSession);
    await evidence.page.goto(appUrl('/app/wallets'));
    await evidence.page.waitForLoadState('networkidle');

    await expect(evidence.page.getByTestId('wallet-adjust-open-header')).toBeVisible();
    await evidence.page.getByTestId('wallet-adjust-open-header').click();
    const adjustModal = evidence.page.getByTestId('wallet-adjust-modal');
    await expect(adjustModal).toBeVisible();

    await adjustModal.getByTestId('wallet-adjust-user-id').fill(targetParent._id);
    await adjustModal.getByTestId('wallet-adjust-amount').fill(String(amount));
    await adjustModal.getByTestId('wallet-adjust-description').fill(description);
    await expect(adjustModal.getByTestId('wallet-adjust-preview-before')).toHaveText(formatCurrency(beforeBalance));
    await expect(adjustModal.getByTestId('wallet-adjust-preview-delta')).toHaveText(`+${formatCurrency(amount)}`);
    await expect(adjustModal.getByTestId('wallet-adjust-preview-after')).toHaveText(formatCurrency(beforeBalance + amount));

    await adjustModal.getByTestId('wallet-adjust-submit').click();
    await expect(adjustModal.getByTestId('wallet-adjust-reason-error')).toHaveText(/Lý do điều chỉnh là bắt buộc\./i);
    expect(capturedAdjustPayloads).toHaveLength(0);
    await evidence.step('adjust-wallet-validation-visible');

    await adjustModal.getByTestId('wallet-adjust-reason').fill(reason);
    await expect(adjustModal.getByTestId('wallet-adjust-reason-error')).toHaveCount(0);
    await expect(adjustModal.getByTestId('wallet-adjust-preview-reason')).toHaveText(reason);
    await evidence.step('adjust-wallet-preview-exact-reason');

    const submitResponse = evidence.page.waitForResponse((response) => (
      response.request().method() === 'POST'
      && response.url().includes('/wallets/adjust')
      && response.ok()
    ));
    await adjustModal.getByTestId('wallet-adjust-submit').click();
    await submitResponse;

    expect(capturedAdjustPayloads).toHaveLength(1);
    expect(capturedAdjustPayloads[0]).toMatchObject({
      userId: targetParent._id,
      amount,
      direction: 'ADD',
      description,
      reason,
      adjustmentType: 'MANUAL_ADJUST',
    });

    await expect(evidence.page.locator('.filters')).toBeVisible();
    await expect(evidence.page.locator('.filters select').first()).toHaveValue('ADJUSTMENT');

    const ledgerRow = evidence.page.locator('table.data tbody tr')
      .filter({ hasText: description })
      .filter({ hasText: reason })
      .first();

    await expect(ledgerRow).toBeVisible();
    await expect(ledgerRow.locator('td').nth(1)).toHaveText('Điều chỉnh');
    await expect(ledgerRow.locator('td').nth(2)).toHaveText(`+${formatCurrency(amount)}`);
    await expect(ledgerRow.locator('td').nth(3)).toHaveText(formatCurrency(beforeBalance));
    await expect(ledgerRow.locator('td').nth(4)).toHaveText(formatCurrency(beforeBalance + amount));
    await expect(ledgerRow.getByTestId('wallet-ledger-adjustment-reason')).toContainText(reason);
    await evidence.step('adjust-wallet-ledger-row-visible');

    const afterBalance = await getWalletBalanceByUserId(request, accountingSession, targetParent._id);
    expect(afterBalance).toBe(beforeBalance + amount);

    await evidence.finalize('PASS', {
      extraLines: [
        'Verified adjust-wallet submit stays blocked when reason is blank and the modal surfaces a clear inline validation message before any POST /wallets/adjust request is sent.',
        'Verified the adjust preview keeps the exact before-balance, signed delta, after-balance, and exact typed reason before submit.',
        'Verified the successful adjust request persists the exact reason and the ADJUSTMENT ledger row renders the exact reason alongside the normalized description and exact balance delta.',
      ],
    });
  } catch (error) {
    await evidence.finalize('FAIL', { error });
    throw error;
  } finally {
    evidence.page.off('request', requestListener);
  }
});
