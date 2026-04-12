import { expect, test, type Locator } from '@playwright/test';
import {
  apiJson,
  applySessionCookies,
  createBatchEvidenceContext,
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

function formatCurrency(value: number): string {
  return `${Number(value || 0).toLocaleString('vi-VN')} \u20ab`;
}

async function seedApprovedTopUp(
  request: any,
  directorSession: any,
  accountingSession: any,
  userId: string,
  amount: number,
  description: string,
): Promise<AnyRecord> {
  const created = await apiJson<AnyRecord>(
    request,
    directorSession,
    'POST',
    '/wallets/top-up',
    {
      userId,
      amount,
      paymentMethod: 'BANK_TRANSFER',
      transactionRef: `B07-LEDGER-TOPUP-${Date.now()}`,
      receiptImageUrl: '/uploads/wallets/e2e-top-up.png',
      description,
    },
  );

  return apiJson<AnyRecord>(
    request,
    accountingSession,
    'POST',
    `/wallets/top-up/${created._id}/approve`,
    {
      bankMatched: true,
      bankStatementRef: `BANK-${Date.now()}`,
      accountingNotes: 'B07 ledger browser proof top-up seed.',
    },
  );
}

async function seedAdjustment(
  request: any,
  accountingSession: any,
  userId: string,
  amount: number,
  direction: 'ADD' | 'SUBTRACT',
  description: string,
): Promise<AnyRecord> {
  return apiJson<AnyRecord>(
    request,
    accountingSession,
    'POST',
    '/wallets/adjust',
    {
      userId,
      amount,
      direction,
      description,
      reason: `${description} audit proof`,
      adjustmentType: 'MANUAL_ADJUST',
    },
  );
}

async function expectLedgerRow(
  row: Locator,
  expected: {
    label: string;
    signedAmount: string;
    balanceBefore: string;
    balanceAfter: string;
    status: string;
  },
): Promise<void> {
  await expect(row).toBeVisible();
  await expect(row.locator('td').nth(1)).toHaveText(expected.label);
  await expect(row.locator('td').nth(2)).toHaveText(expected.signedAmount);
  await expect(row.locator('td').nth(3)).toHaveText(expected.balanceBefore);
  await expect(row.locator('td').nth(4)).toHaveText(expected.balanceAfter);
  await expect(row.locator('td').nth(6)).toContainText(expected.status);
}

test.use({ video: 'on' });
test.describe.configure({ mode: 'serial', timeout: 180_000 });

test('B07 wallet ledger renders exact transaction labels, signed amounts, and balance deltas', async ({
  browser,
  request,
}) => {
  test.slow();

  const evidence = await createBatchEvidenceContext(browser, {
    batchId: 'B07',
    scenario: 'wallet_ledger_browser',
    runDate: RUN_DATE,
  });

  const fixtures = await seedUiOrchestratorFixtures(request, 'b07-wallet-ledger-browser');
  const directorSession = await loginAsRole(request, 'director');
  const accountingSession = await loginAsRole(request, 'accounting');

  const topUpDescription = `B07 ledger top-up ${Date.now()}`;
  const transferDescription = `B07 ledger transfer ${Date.now()}`;
  const adjustmentAddDescription = `B07 ledger adjust add ${Date.now()}`;
  const adjustmentSubtractDescription = `B07 ledger adjust subtract ${Date.now()}`;

  const topUpEntry = await seedApprovedTopUp(
    request,
    directorSession,
    accountingSession,
    fixtures.freshParent._id,
    510_000,
    topUpDescription,
  );

  const transferResult = await apiJson<AnyRecord>(
    request,
    accountingSession,
    'POST',
    '/wallets/transfer',
    {
      fromUserId: fixtures.freshParent._id,
      toUserId: fixtures.depletedWalletFixture.parent._id,
      amount: 120_000,
      description: transferDescription,
    },
  );

  const adjustmentAddEntry = await seedAdjustment(
    request,
    accountingSession,
    fixtures.depletedWalletFixture.parent._id,
    35_000,
    'ADD',
    adjustmentAddDescription,
  );

  const adjustmentSubtractEntry = await seedAdjustment(
    request,
    accountingSession,
    fixtures.freshParent._id,
    20_000,
    'SUBTRACT',
    adjustmentSubtractDescription,
  );

  try {
    await applySessionCookies(evidence.context, accountingSession);
    await evidence.page.goto(appUrl('/app/wallets'));
    await evidence.page.waitForLoadState('networkidle');

    await expect(evidence.page.locator('table.data')).toBeVisible();
    await evidence.page.getByRole('button', { name: /(L\u1ecbch s\u1eed giao d\u1ecbch|Lich su giao dich)/i }).click();
    await expect(evidence.page.locator('.filters')).toBeVisible();
    await evidence.step('wallet-ledger-opened');

    const topUpRow = evidence.page.locator('table.data tbody tr').filter({ hasText: topUpDescription }).first();
    const transferOutRow = evidence.page.locator('table.data tbody tr').filter({ hasText: transferDescription }).filter({ hasText: fixtures.depletedWalletFixture.parent.fullName }).first();
    const transferInRow = evidence.page.locator('table.data tbody tr').filter({ hasText: transferDescription }).filter({ hasText: fixtures.freshParent.fullName }).first();
    const adjustmentAddRow = evidence.page.locator('table.data tbody tr').filter({ hasText: adjustmentAddDescription }).first();
    const adjustmentSubtractRow = evidence.page.locator('table.data tbody tr').filter({ hasText: adjustmentSubtractDescription }).first();

    await expectLedgerRow(topUpRow, {
      label: 'N\u1ea1p ti\u1ec1n',
      signedAmount: `+${formatCurrency(topUpEntry.amount)}`,
      balanceBefore: formatCurrency(topUpEntry.balanceBefore),
      balanceAfter: formatCurrency(topUpEntry.balanceAfter),
      status: 'APPROVED',
    });

    await expectLedgerRow(transferOutRow, {
      label: 'Chuy\u1ec3n \u0111i',
      signedAmount: `-${formatCurrency(transferResult.fromEntry.amount)}`,
      balanceBefore: formatCurrency(transferResult.fromEntry.balanceBefore),
      balanceAfter: formatCurrency(transferResult.fromEntry.balanceAfter),
      status: 'COMPLETED',
    });

    await expectLedgerRow(transferInRow, {
      label: 'Nh\u1eadn chuy\u1ec3n',
      signedAmount: `+${formatCurrency(transferResult.toEntry.amount)}`,
      balanceBefore: formatCurrency(transferResult.toEntry.balanceBefore),
      balanceAfter: formatCurrency(transferResult.toEntry.balanceAfter),
      status: 'COMPLETED',
    });

    await expectLedgerRow(adjustmentAddRow, {
      label: '\u0110i\u1ec1u ch\u1ec9nh',
      signedAmount: `+${formatCurrency(adjustmentAddEntry.amount)}`,
      balanceBefore: formatCurrency(adjustmentAddEntry.balanceBefore),
      balanceAfter: formatCurrency(adjustmentAddEntry.balanceAfter),
      status: 'COMPLETED',
    });

    await expectLedgerRow(adjustmentSubtractRow, {
      label: '\u0110i\u1ec1u ch\u1ec9nh',
      signedAmount: `-${formatCurrency(adjustmentSubtractEntry.amount)}`,
      balanceBefore: formatCurrency(adjustmentSubtractEntry.balanceBefore),
      balanceAfter: formatCurrency(adjustmentSubtractEntry.balanceAfter),
      status: 'COMPLETED',
    });
    await evidence.step('wallet-ledger-labels-signs-balances');

    await evidence.page.locator('.filters select').first().selectOption('ADJUSTMENT');
    await expect(adjustmentAddRow).toBeVisible();
    await expect(adjustmentSubtractRow).toBeVisible();
    await expect(topUpRow).toHaveCount(0);
    await evidence.step('wallet-ledger-adjustment-filter');

    await evidence.finalize('PASS', {
      extraLines: [
        'Verified TOP_UP renders as a positive signed ledger row with exact balance-before and balance-after values.',
        'Verified TRANSFER_OUT and TRANSFER_IN render reciprocal negative/positive amounts with exact labels and balances.',
        'Verified ADJUSTMENT keeps the shared label but derives the displayed sign from the real balance delta for both add and subtract flows.',
      ],
    });
  } catch (error) {
    await evidence.finalize('FAIL', { error });
    throw error;
  }
});
