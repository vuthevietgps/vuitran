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

const RUN_DATE =
  process.env['UI_EVIDENCE_DATE'] ||
  process.env['E2E_RUN_DATE'] ||
  '2026-04-11';

type AnyRecord = any;

function appUrl(path: string): string {
  return new URL(path, APP_BASE_URL).toString();
}

function asArray<T>(value: any): T[] {
  if (Array.isArray(value)) return value as T[];
  return (value?.data || value?.items || value?.results || []) as T[];
}

function formatCurrency(value: number): string {
  return `${Number(value || 0).toLocaleString('vi-VN')} ₫`;
}

async function seedApprovedTopUp(
  request: any,
  directorSession: any,
  accountingSession: any,
  userId: string,
  amount: number,
  description: string,
): Promise<AnyRecord> {
  const topUp = await apiJson<AnyRecord>(
    request,
    directorSession,
    'POST',
    '/wallets/top-up',
    {
      userId,
      amount,
      paymentMethod: 'BANK_TRANSFER',
      transactionRef: `B07-TRANSFER-SEED-${Date.now()}`,
      receiptImageUrl: '/uploads/wallets/e2e-top-up.png',
      description,
    },
  );

  await apiJson(
    request,
    accountingSession,
    'POST',
    `/wallets/top-up/${topUp._id}/approve`,
    {
      bankMatched: true,
      bankStatementRef: `BANK-${Date.now()}`,
      accountingNotes: 'Seeded wallet balance for B07 transfer browser coverage.',
    },
  );

  return topUp;
}

test.use({ video: 'on' });
test.describe.configure({ mode: 'serial', timeout: 180_000 });

test.describe('B07 wallet transfer browser', () => {
  let fixtures: Awaited<ReturnType<typeof seedUiOrchestratorFixtures>>;
  let directorSession: any;
  let accountingSession: any;

  test.beforeAll(async ({ request }) => {
    fixtures = await seedUiOrchestratorFixtures(request, 'b07-wallet-transfer-browser');
    directorSession = await loginAsRole(request, 'director');
    accountingSession = await loginAsRole(request, 'accounting');

    await seedApprovedTopUp(
      request,
      directorSession,
      accountingSession,
      fixtures.freshParent._id,
      450_000,
      'B07 transfer source wallet seed',
    );
  });

  test('B07 accounting transfers money between parent wallets and both balances plus ledger update correctly', async ({
    browser,
    request,
  }) => {
    test.slow();

    const evidence = await createBatchEvidenceContext(browser, {
      batchId: 'B07',
      scenario: 'wallet_transfer_success_browser',
      runDate: RUN_DATE,
    });

    const transferAmount = 180_000;
    const transferDescription = `B07 wallet transfer success ${Date.now()}`;
    const sourceBalanceBefore = await getWalletBalanceByUserId(
      request,
      directorSession,
      fixtures.freshParent._id,
    );
    const targetBalanceBefore = await getWalletBalanceByUserId(
      request,
      directorSession,
      fixtures.depletedWalletFixture.parent._id,
    );

    try {
      await applySessionCookies(evidence.context, accountingSession);
      await evidence.page.goto(appUrl('/app/wallets'));
      await evidence.page.waitForLoadState('networkidle');

      await evidence.page.getByRole('button', { name: /Chuyển tiền|Chuyen tien/i }).click();
      const transferModal = evidence.page.locator('.modal-backdrop .modal').last();
      await expect(transferModal).toBeVisible();

      await transferModal.locator('input[name="fromUserId"]').fill(fixtures.freshParent._id);
      await transferModal.locator('input[name="toUserId"]').fill(fixtures.depletedWalletFixture.parent._id);
      await transferModal.locator('input[name="amount"]').fill(String(transferAmount));
      await transferModal.locator('textarea[name="description"]').fill(transferDescription);
      await evidence.step('wallet-transfer-success-form-filled');

      let transferPostCount = 0;
      const requestListener = (apiRequest: any) => {
        if (apiRequest.url().includes('/wallets/transfer') && apiRequest.method() === 'POST') {
          transferPostCount += 1;
        }
      };
      evidence.page.on('request', requestListener);

      const transferResponsePromise = evidence.page.waitForResponse((response) =>
        response.url().includes('/wallets/transfer')
        && response.request().method() === 'POST',
      );
      const dialogPromise = evidence.page.waitForEvent('dialog').then(async (dialog) => {
        const message = dialog.message();
        await dialog.accept();
        return message;
      });

      await transferModal.getByRole('button', { name: /Chuyển tiền|Chuyen tien/i }).click();

      const [transferResponse, dialogMessage] = await Promise.all([
        transferResponsePromise,
        dialogPromise,
      ]);
      const transferResponseBody = await transferResponse.json().catch(() => ({} as AnyRecord));
      expect([200, 201]).toContain(transferResponse.status());
      expect(transferPostCount).toBe(1);
      expect(dialogMessage).toBe('Chuyen tien thanh cong!');
      evidence.page.off('request', requestListener);

      await expect(transferModal).toBeHidden({ timeout: 20_000 });

      const sourceBalanceAfter = sourceBalanceBefore - transferAmount;
      const targetBalanceAfter = targetBalanceBefore + transferAmount;
      await expect
        .poll(async () => getWalletBalanceByUserId(request, directorSession, fixtures.freshParent._id))
        .toBe(sourceBalanceAfter);
      await expect
        .poll(async () => getWalletBalanceByUserId(request, directorSession, fixtures.depletedWalletFixture.parent._id))
        .toBe(targetBalanceAfter);
      await evidence.step('wallet-transfer-success-balances-updated');

      const ledgerResponse = await apiJson<AnyRecord>(
        request,
        accountingSession,
        'GET',
        '/wallets/ledger?limit=200',
      );
      const ledgerEntries = asArray<AnyRecord>(ledgerResponse).filter((entry) =>
        String(entry.description || '').includes(transferDescription),
      );
      expect(ledgerEntries).toHaveLength(2);

      const transferOut = ledgerEntries.find((entry) => entry.type === 'TRANSFER_OUT');
      const transferIn = ledgerEntries.find((entry) => entry.type === 'TRANSFER_IN');
      expect(transferOut, 'Transfer out ledger must exist.').toBeTruthy();
      expect(transferIn, 'Transfer in ledger must exist.').toBeTruthy();

      expect(transferOut.status).toBe('COMPLETED');
      expect(transferOut.amount).toBe(transferAmount);
      expect(transferOut.balanceBefore).toBe(sourceBalanceBefore);
      expect(transferOut.balanceAfter).toBe(sourceBalanceAfter);
      expect(String(transferOut.description)).toBe(
        `[Chuyển đi → ${fixtures.depletedWalletFixture.parent.fullName}] ${transferDescription}`,
      );

      expect(transferIn.status).toBe('COMPLETED');
      expect(transferIn.amount).toBe(transferAmount);
      expect(transferIn.balanceBefore).toBe(targetBalanceBefore);
      expect(transferIn.balanceAfter).toBe(targetBalanceAfter);
      expect(String(transferIn.description)).toBe(
        `[Nhận từ ${fixtures.freshParent.fullName}] ${transferDescription}`,
      );
      expect(String(transferOut.relatedEntryId || '')).toBe(String(transferIn._id));
      expect(String(transferIn.relatedEntryId || '')).toBe(String(transferOut._id));

      await evidence.page.getByRole('button', { name: /Lịch sử giao dịch|Lich su giao dich/i }).click();
      const ledgerRows = evidence.page.locator('table.data tbody tr').filter({ hasText: transferDescription });
      await expect(ledgerRows).toHaveCount(2);
      await expect(ledgerRows.filter({ hasText: 'Chuyển đi' }).first()).toContainText(`-${formatCurrency(transferAmount)}`);
      await expect(ledgerRows.filter({ hasText: 'Nhận chuyển' }).first()).toContainText(`+${formatCurrency(transferAmount)}`);
      await evidence.step('wallet-transfer-success-ledger-visible');

      await evidence.finalize('PASS', {
        extraLines: [
          `Transfer response status: ${transferResponse.status()}`,
          `Transfer response body keys: ${Object.keys(transferResponseBody || {}).join(', ') || 'none'}`,
          `Source balance: ${formatCurrency(sourceBalanceBefore)} -> ${formatCurrency(sourceBalanceAfter)}`,
          `Target balance: ${formatCurrency(targetBalanceBefore)} -> ${formatCurrency(targetBalanceAfter)}`,
          'Ledger recorded both TRANSFER_OUT and TRANSFER_IN with exact reciprocal descriptions.',
        ],
      });
    } catch (error) {
      await evidence.finalize('FAIL', { error });
      throw error;
    }
  });

  test('B07 transfer blocks self-transfer before any POST request is sent', async ({
    browser,
    request,
  }) => {
    const evidence = await createBatchEvidenceContext(browser, {
      batchId: 'B07',
      scenario: 'wallet_transfer_self_blocked_browser',
      runDate: RUN_DATE,
    });

    const sourceBalanceBefore = await getWalletBalanceByUserId(
      request,
      directorSession,
      fixtures.freshParent._id,
    );
    const transferDescription = `B07 self transfer blocked ${Date.now()}`;

    try {
      await applySessionCookies(evidence.context, accountingSession);
      await evidence.page.goto(appUrl('/app/wallets'));
      await evidence.page.waitForLoadState('networkidle');

      let transferPostCount = 0;
      const requestListener = (apiRequest: any) => {
        if (apiRequest.url().includes('/wallets/transfer') && apiRequest.method() === 'POST') {
          transferPostCount += 1;
        }
      };
      evidence.page.on('request', requestListener);

      await evidence.page.getByRole('button', { name: /Chuyển tiền|Chuyen tien/i }).click();
      const transferModal = evidence.page.locator('.modal-backdrop .modal').last();
      await expect(transferModal).toBeVisible();

      await transferModal.locator('input[name="fromUserId"]').fill(fixtures.freshParent._id);
      await transferModal.locator('input[name="toUserId"]').fill(fixtures.freshParent._id);
      await transferModal.locator('input[name="amount"]').fill('5000');
      await transferModal.locator('textarea[name="description"]').fill(transferDescription);
      await evidence.step('wallet-transfer-self-form-filled');

      const dialogMessage = await acceptDialog(
        evidence.page,
        () => transferModal.getByRole('button', { name: /Chuyển tiền|Chuyen tien/i }).click(),
      );
      expect(dialogMessage).toBe('Khong the chuyen cho chinh minh');

      await expect(transferModal).toBeVisible();
      await expect
        .poll(() => transferPostCount)
        .toBe(0);
      await expect
        .poll(async () => getWalletBalanceByUserId(request, directorSession, fixtures.freshParent._id))
        .toBe(sourceBalanceBefore);
      evidence.page.off('request', requestListener);

      const ledgerResponse = await apiJson<AnyRecord>(
        request,
        accountingSession,
        'GET',
        '/wallets/ledger?limit=200',
      );
      const ledgerEntries = asArray<AnyRecord>(ledgerResponse).filter((entry) =>
        String(entry.description || '').includes(transferDescription),
      );
      expect(ledgerEntries).toHaveLength(0);

      await transferModal.locator('button[type="button"].ghost').click();
      await expect(transferModal).toBeHidden({ timeout: 20_000 });
      await evidence.step('wallet-transfer-self-blocked');

      await evidence.finalize('PASS', {
        extraLines: [
          `Dialog message: ${dialogMessage}`,
          `Transfer POST count: ${transferPostCount}`,
          `Source balance stayed at ${formatCurrency(sourceBalanceBefore)}.`,
          'No ledger entries were created for the self-transfer attempt.',
        ],
      });
    } catch (error) {
      await evidence.finalize('FAIL', { error });
      throw error;
    }
  });

  test('B07 over-balance transfer surfaces exact backend error and keeps balances plus ledger unchanged', async ({
    browser,
    request,
  }) => {
    const evidence = await createBatchEvidenceContext(browser, {
      batchId: 'B07',
      scenario: 'wallet_transfer_over_balance_browser',
      runDate: RUN_DATE,
    });

    const sourceBalanceBefore = await getWalletBalanceByUserId(
      request,
      directorSession,
      fixtures.freshParent._id,
    );
    const targetBalanceBefore = await getWalletBalanceByUserId(
      request,
      directorSession,
      fixtures.depletedWalletFixture.parent._id,
    );
    const transferAmount = sourceBalanceBefore + 50_000;
    const transferDescription = `B07 over balance blocked ${Date.now()}`;
    const expectedErrorMessage = `Số dư không đủ. Hiện tại: ${sourceBalanceBefore.toLocaleString('vi-VN')}đ`;

    try {
      await applySessionCookies(evidence.context, accountingSession);
      await evidence.page.goto(appUrl('/app/wallets'));
      await evidence.page.waitForLoadState('networkidle');

      let transferPostCount = 0;
      const requestListener = (apiRequest: any) => {
        if (apiRequest.url().includes('/wallets/transfer') && apiRequest.method() === 'POST') {
          transferPostCount += 1;
        }
      };
      evidence.page.on('request', requestListener);

      await evidence.page.getByRole('button', { name: /Chuyển tiền|Chuyen tien/i }).click();
      const transferModal = evidence.page.locator('.modal-backdrop .modal').last();
      await expect(transferModal).toBeVisible();

      await transferModal.locator('input[name="fromUserId"]').fill(fixtures.freshParent._id);
      await transferModal.locator('input[name="toUserId"]').fill(fixtures.depletedWalletFixture.parent._id);
      await transferModal.locator('input[name="amount"]').fill(String(transferAmount));
      await transferModal.locator('textarea[name="description"]').fill(transferDescription);
      await evidence.step('wallet-transfer-over-balance-form-filled');

      const transferResponsePromise = evidence.page.waitForResponse((response) =>
        response.url().includes('/wallets/transfer')
        && response.request().method() === 'POST',
      );
      const dialogPromise = evidence.page.waitForEvent('dialog').then(async (dialog) => {
        const message = dialog.message();
        await dialog.accept();
        return message;
      });

      await transferModal.getByRole('button', { name: /Chuyển tiền|Chuyen tien/i }).click();

      const [transferResponse, dialogMessage] = await Promise.all([
        transferResponsePromise,
        dialogPromise,
      ]);
      const transferError = await transferResponse.json().catch(() => ({} as AnyRecord));
      expect(transferResponse.status()).toBe(400);
      expect(transferPostCount).toBe(1);
      expect(String(transferError?.message || transferError?.error || '')).toBe(expectedErrorMessage);
      expect(dialogMessage).toBe(expectedErrorMessage);
      evidence.page.off('request', requestListener);

      await expect(transferModal).toBeVisible();
      await expect
        .poll(async () => getWalletBalanceByUserId(request, directorSession, fixtures.freshParent._id))
        .toBe(sourceBalanceBefore);
      await expect
        .poll(async () => getWalletBalanceByUserId(request, directorSession, fixtures.depletedWalletFixture.parent._id))
        .toBe(targetBalanceBefore);

      const ledgerResponse = await apiJson<AnyRecord>(
        request,
        accountingSession,
        'GET',
        '/wallets/ledger?limit=200',
      );
      const ledgerEntries = asArray<AnyRecord>(ledgerResponse).filter((entry) =>
        String(entry.description || '').includes(transferDescription),
      );
      expect(ledgerEntries).toHaveLength(0);

      await transferModal.locator('button[type="button"].ghost').click();
      await expect(transferModal).toBeHidden({ timeout: 20_000 });
      await evidence.page.getByRole('button', { name: /Lịch sử giao dịch|Lich su giao dich/i }).click();
      await expect(
        evidence.page.locator('table.data tbody tr').filter({ hasText: transferDescription }),
      ).toHaveCount(0);
      await evidence.step('wallet-transfer-over-balance-blocked');

      await evidence.finalize('PASS', {
        extraLines: [
          `Backend status: ${transferResponse.status()}`,
          `Dialog/backend message: ${expectedErrorMessage}`,
          `Transfer POST count: ${transferPostCount}`,
          `Balances stayed unchanged at ${formatCurrency(sourceBalanceBefore)} and ${formatCurrency(targetBalanceBefore)}.`,
        ],
      });
    } catch (error) {
      await evidence.finalize('FAIL', { error });
      throw error;
    }
  });
});
