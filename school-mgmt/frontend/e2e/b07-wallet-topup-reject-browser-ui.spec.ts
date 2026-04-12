import { expect, test } from '@playwright/test';
import {
  acceptDialog,
  apiJson,
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

const RUN_DATE = '2026-04-10';

type AnyRecord = any;

function appUrl(path: string): string {
  return new URL(path, APP_BASE_URL).toString();
}

function asArray<T>(value: any): T[] {
  if (Array.isArray(value)) return value as T[];
  return (value?.data || value?.items || value?.results || []) as T[];
}

test('B07 accounting reject top-up decrements pending count and keeps wallet balance unchanged', async ({
  browser,
  request,
}) => {
  test.slow();

  const evidence = await createBatchEvidenceContext(browser, {
    batchId: 'B07',
    scenario: 'wallet_topup_reject_pending_count_browser',
    runDate: RUN_DATE,
  });

  const directorSession = await loginAsRole(request, 'director');
  const accountingSession = await loginAsRole(request, 'accounting');
  const fixtures = await seedUiOrchestratorFixtures(request, 'b07-wallet-topup-reject');

  const rejectReason = 'Sai bien lai top-up, yeu cau phu huynh gui lai.';
  const topUpDescription = 'Accounting rejection flow for B07 browser proof';
  const topUpRef = `B07-REJECT-${Date.now()}`;
  const balanceBeforeReject = await getWalletBalanceByUserId(
    request,
    directorSession,
    fixtures.freshParent._id,
  );

  const pendingTopUp = await apiJson<AnyRecord>(
    request,
    directorSession,
    'POST',
    '/wallets/top-up',
    {
      userId: fixtures.freshParent._id,
      amount: 420_000,
      paymentMethod: 'BANK_TRANSFER',
      transactionRef: topUpRef,
      receiptImageUrl: '/uploads/wallets/e2e-top-up.png',
      description: topUpDescription,
    },
  );

  const pendingBefore = await apiJson<AnyRecord[]>(
    request,
    accountingSession,
    'GET',
    '/wallets/top-up/pending',
  );
  const pendingCountBefore = pendingBefore.length;
  expect(
    pendingBefore.some((entry) => String(entry._id) === String(pendingTopUp._id)),
    'Seeded pending top-up must be visible in the accounting pending list.',
  ).toBe(true);

  try {
    await applySessionCookies(evidence.context, accountingSession);
    await evidence.page.goto(appUrl('/app/wallets'));
    await evidence.page.waitForLoadState('networkidle');

    const pendingButton = evidence.page.getByRole('button', { name: /Chờ duyệt/ });
    await expect(pendingButton).toBeVisible();
    await expect(pendingButton).toContainText(`(${pendingCountBefore})`);
    await evidence.step('wallet-pending-count-before-reject');

    await pendingButton.click();
    const pendingModal = evidence.page
      .locator('.modal-backdrop')
      .filter({ hasText: 'Yêu cầu nạp tiền chờ duyệt' })
      .first();
    await expect(pendingModal).toBeVisible();

    const pendingItem = pendingModal
      .locator('.pending-item')
      .filter({ hasText: fixtures.freshParent.fullName })
      .filter({ hasText: topUpRef })
      .first();
    await expect(pendingItem).toBeVisible();
    await evidence.step('wallet-pending-modal-before-reject');

    const promptMessage = await acceptDialog(
      evidence.page,
      () => pendingItem.getByRole('button', { name: /Từ chối/ }).click(),
      rejectReason,
    );
    expect(promptMessage).toContain('Lý do từ chối');

    await expect
      .poll(async () => {
        const items = await apiJson<AnyRecord[]>(
          request,
          accountingSession,
          'GET',
          '/wallets/top-up/pending',
        );
        return items.length;
      })
      .toBe(pendingCountBefore - 1);

    await expect(pendingButton).toContainText(`(${pendingCountBefore - 1})`);
    await expect(pendingItem).toHaveCount(0);
    await evidence.step('wallet-pending-count-after-reject');

    const balanceAfterReject = await getWalletBalanceByUserId(
      request,
      directorSession,
      fixtures.freshParent._id,
    );
    expect(balanceAfterReject).toBe(balanceBeforeReject);

    const ledgerResponse = await apiJson<AnyRecord>(
      request,
      accountingSession,
      'GET',
      '/wallets/ledger?limit=200&type=TOP_UP',
    );
    const ledgerEntry = asArray<AnyRecord>(ledgerResponse).find(
      (entry) => String(entry._id) === String(pendingTopUp._id),
    );
    expect(ledgerEntry, 'Rejected top-up must remain queryable in wallet ledger.').toBeTruthy();
    expect(ledgerEntry.status).toBe('REJECTED');
    expect(ledgerEntry.balanceBefore).toBe(balanceBeforeReject);
    expect(ledgerEntry.balanceAfter).toBe(balanceBeforeReject);
    expect(String(ledgerEntry.description || '')).toContain(topUpDescription);
    expect(String(ledgerEntry.accountingNotes || '')).toContain(rejectReason);

    await pendingModal.getByRole('button', { name: 'Đóng' }).click();
    await expect(pendingModal).toBeHidden();

    await evidence.page.getByRole('button', { name: /Lịch sử giao dịch/ }).click();
    const ledgerRow = evidence.page
      .locator('table.data tbody tr')
      .filter({ hasText: topUpDescription })
      .first();
    await expect(ledgerRow).toBeVisible();
    await expect(ledgerRow).toContainText('REJECTED');
    await evidence.step('wallet-ledger-rejected-status');

    await evidence.finalize('PASS', {
      extraLines: [
        `Pending count before reject: ${pendingCountBefore}`,
        `Pending count after reject: ${pendingCountBefore - 1}`,
        `Wallet balance stayed at: ${balanceBeforeReject.toLocaleString('vi-VN')} đ`,
        'Rejected request disappeared from the pending modal and stayed visible in ledger with status REJECTED.',
      ],
    });
  } catch (error) {
    await evidence.finalize('FAIL', { error });
    throw error;
  }
});
