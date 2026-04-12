import { expect, test, type Page } from '@playwright/test';
import {
  acceptDialog,
  apiJson,
  applySessionCookies,
  createBatchEvidenceContext,
  createParentAccount,
  getWalletBalanceByUserId,
  initializeWalletForParent,
  loginAsCredentials,
  loginAsRole,
  pngFilePayload,
} from './support';

const APP_BASE_URL =
  process.env['PLAYWRIGHT_BASE_URL']
  || process.env['E2E_BASE_URL']
  || 'http://localhost:4200';
const API_ORIGIN_PATTERN = 'http:\\/\\/(?:localhost|127\\.0\\.0\\.1):3000';
const TOPUP_API = new RegExp(`${API_ORIGIN_PATTERN}/wallets/top-up(?:\\?.*)?$`);
const TOPUP_UPLOAD_API = new RegExp(`${API_ORIGIN_PATTERN}/wallets/top-up/upload-receipt(?:\\?.*)?$`);
const RUN_DATE = '2026-04-11';
const SUCCESS_ALERT =
  'Yêu cầu nạp tiền đã được gửi. Kế toán sẽ duyệt trong thời gian sớm nhất.';
const RECEIPT_REQUIRED_ALERT = 'Chuyển khoản bắt buộc phải đính kèm ảnh biên lai.';

type AnyRecord = any;

function appUrl(path: string): string {
  return new URL(path, APP_BASE_URL).toString();
}

function asArray<T>(value: any): T[] {
  if (Array.isArray(value)) return value as T[];
  return (value?.data || value?.items || value?.results || []) as T[];
}

async function gotoWalletsAsParent(
  page: Page,
  email: string,
  password: string,
) {
  await page.goto(appUrl('/app/wallets'));
  await page.waitForLoadState('networkidle');

  if (new URL(page.url()).pathname === '/login') {
    await page.locator('input[name="email"]').fill(email);
    await page.locator('input[name="password"]').fill(password);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/\/app\//);
    await page.goto(appUrl('/app/wallets'));
    await page.waitForLoadState('networkidle');
  }

  await expect(page.locator('.my-wallet-card')).toBeVisible();
  await expect(page.locator('.my-wallet-card .balance-value')).toBeVisible();
  await expect(page.locator('.my-wallet-card button.primary')).toHaveCount(1);
}

async function expectImageLoaded(page: Page, selector: string): Promise<void> {
  await expect
    .poll(async () => page.locator(selector).evaluate((node) => {
      const image = node as HTMLImageElement;
      return image.complete && image.naturalWidth > 0 && image.naturalHeight > 0;
    }))
    .toBe(true);
}

test.describe.configure({ mode: 'serial', timeout: 120_000 });
test.setTimeout(120_000);

test('B07 parent top-up with uploaded receipt creates a pending top-up without changing wallet balance', async ({
  browser,
  request,
}) => {
  test.slow();

  const evidence = await createBatchEvidenceContext(browser, {
    batchId: 'B07',
    scenario: 'parent_topup_receipt_browser',
    runDate: RUN_DATE,
  });

  const directorSession = await loginAsRole(request, 'director');
  const accountingSession = await loginAsRole(request, 'accounting');
  const parent = await createParentAccount(request, directorSession, 'b07-parent-topup-receipt');
  await initializeWalletForParent(request, parent);
  const parentSession = await loginAsCredentials(request, 'parent', parent.email, parent.password);

  const amount = 470_000;
  const transactionRef = `B07-PARENT-TOPUP-${Date.now()}`;
  const description = 'Parent top-up receipt browser proof';
  const balanceBefore = await getWalletBalanceByUserId(
    request,
    directorSession,
    parent._id,
  );
  const pendingBefore = await apiJson<AnyRecord[]>(
    request,
    accountingSession,
    'GET',
    '/wallets/top-up/pending',
  );
  const pendingCountBefore = pendingBefore.length;

  try {
    await applySessionCookies(evidence.context, parentSession);
    await gotoWalletsAsParent(evidence.page, parent.email, parent.password);
    await evidence.step('parent-wallet-home');

    await evidence.page.locator('.my-wallet-card button.primary').click();
    const modal = evidence.page.locator('.modal-backdrop .modal').first();
    await expect(modal).toBeVisible();

    await modal.locator('input[name="amount"]').fill(String(amount));
    await modal.locator('input[name="transactionRef"]').fill(transactionRef);
    await modal.locator('textarea[name="description"]').fill(description);

    const uploadRequestPromise = evidence.page.waitForRequest(
      (req) => req.method() === 'POST' && TOPUP_UPLOAD_API.test(req.url()),
    );
    const uploadResponsePromise = evidence.page.waitForResponse(
      (resp) => resp.request().method() === 'POST' && TOPUP_UPLOAD_API.test(resp.url()),
    );

    await modal.locator('input[name="receiptFile"]').setInputFiles(
      pngFilePayload('b07-parent-topup-receipt.png'),
    );

    const [uploadRequest, uploadResponse] = await Promise.all([
      uploadRequestPromise,
      uploadResponsePromise,
    ]);
    expect(String(uploadRequest.headers()['content-type'] || '')).toContain('multipart/form-data');
    expect([200, 201]).toContain(uploadResponse.status());

    const uploadBody = await uploadResponse.json().catch(() => null);
    const uploadedReceiptUrl = String(uploadBody?.url || '');
    expect(uploadedReceiptUrl).toMatch(/^\/uploads\/wallets\/.+/);

    const uploadedReceiptResponse = await request.get(`http://localhost:3000${uploadedReceiptUrl}`);
    expect(uploadedReceiptResponse.status()).toBe(200);
    expect(String(uploadedReceiptResponse.headers()['content-type'] || '')).toContain('image/');

    await expect(modal.locator('img')).toBeVisible();
    await expect(modal.locator('img')).toHaveAttribute('src', new RegExp('/uploads/wallets/'));
    await expectImageLoaded(evidence.page, '.modal-backdrop .modal img');
    await evidence.step('parent-topup-uploaded-receipt-preview');

    const topUpRequestPromise = evidence.page.waitForRequest(
      (req) => req.method() === 'POST' && TOPUP_API.test(req.url()),
    );
    const topUpResponsePromise = evidence.page.waitForResponse(
      (resp) => resp.request().method() === 'POST' && TOPUP_API.test(resp.url()),
    );
    const successDialogPromise = evidence.page.waitForEvent('dialog').then(async (dialog) => {
      const message = dialog.message();
      await dialog.accept();
      return message;
    });

    await modal.locator('button[type="submit"]').click();

    const [topUpRequest, topUpResponse, successMessage] = await Promise.all([
      topUpRequestPromise,
      topUpResponsePromise,
      successDialogPromise,
    ]);

    expect(successMessage).toBe(SUCCESS_ALERT);
    expect([200, 201]).toContain(topUpResponse.status());

    const topUpPayload = topUpRequest.postDataJSON() as AnyRecord;
    expect(topUpPayload).toEqual({
      userId: parent._id,
      amount,
      paymentMethod: 'BANK_TRANSFER',
      transactionRef,
      receiptImageUrl: uploadedReceiptUrl,
      description,
    });

    const createdTopUp = await topUpResponse.json().catch(() => null);
    expect(createdTopUp?._id, 'Created parent top-up should return a ledger entry id.').toBeTruthy();
    expect(createdTopUp?.status).toBe('PENDING');
    expect(createdTopUp?.amount).toBe(amount);
    expect(String(createdTopUp?.receiptImageUrl || '')).toBe(uploadedReceiptUrl);

    await expect(modal).toHaveCount(0);

    await expect
      .poll(async () => {
        const pendingAfter = await apiJson<AnyRecord[]>(
          request,
          accountingSession,
          'GET',
          '/wallets/top-up/pending',
        );
        return pendingAfter.length;
      })
      .toBe(pendingCountBefore + 1);

    const pendingAfter = await apiJson<AnyRecord[]>(
      request,
      accountingSession,
      'GET',
      '/wallets/top-up/pending',
    );
    const pendingEntry = pendingAfter.find(
      (entry) => String(entry._id) === String(createdTopUp._id),
    );
    expect(
      pendingEntry,
      'Accounting pending list must include the new parent top-up request.',
    ).toBeTruthy();
    expect(String(pendingEntry?.transactionRef || '')).toBe(transactionRef);
    expect(String(pendingEntry?.receiptImageUrl || '')).toBe(uploadedReceiptUrl);
    expect(String(pendingEntry?.description || '')).toContain(description);

    const balanceAfter = await getWalletBalanceByUserId(
      request,
      directorSession,
      parent._id,
    );
    expect(balanceAfter).toBe(balanceBefore);

    const ledgerResponse = await apiJson<AnyRecord>(
      request,
      accountingSession,
      'GET',
      '/wallets/ledger?limit=200&type=TOP_UP',
    );
    const ledgerEntry = asArray<AnyRecord>(ledgerResponse).find(
      (entry) => String(entry._id) === String(createdTopUp._id),
    );
    expect(ledgerEntry, 'New parent top-up must be queryable in accounting ledger.').toBeTruthy();
    expect(ledgerEntry.status).toBe('PENDING');
    expect(ledgerEntry.paymentMethod).toBe('BANK_TRANSFER');
    expect(String(ledgerEntry.receiptImageUrl || '')).toBe(uploadedReceiptUrl);
    expect(String(ledgerEntry.transactionRef || '')).toBe(transactionRef);
    expect(String(ledgerEntry.description || '')).toContain(description);
    expect(ledgerEntry.balanceBefore).toBe(balanceBefore);
    expect(ledgerEntry.balanceAfter).toBe(balanceBefore);

    const myLedgerRow = evidence.page
      .locator('table.data tbody tr')
      .filter({ hasText: description })
      .first();
    await expect(myLedgerRow).toBeVisible();
    await evidence.step('parent-topup-my-ledger-pending-row');

    await evidence.finalize('PASS', {
      extraLines: [
        `Parent top-up amount: ${amount.toLocaleString('vi-VN')} d`,
        `Uploaded receipt URL: ${uploadedReceiptUrl}`,
        `Pending count before request: ${pendingCountBefore}`,
        `Pending count after request: ${pendingCountBefore + 1}`,
        `Wallet balance stayed unchanged at: ${balanceBefore.toLocaleString('vi-VN')} d`,
        'Verified browser upload renders a real preview, submit posts the exact parent payload, accounting pending list receives the request, and ledger stays PENDING without crediting the wallet yet.',
      ],
    });
  } catch (error) {
    await evidence.finalize('FAIL', { error });
    throw error;
  }
});

test('B07 parent bank-transfer top-up blocks submit without uploaded receipt', async ({
  browser,
  request,
}) => {
  test.slow();

  const evidence = await createBatchEvidenceContext(browser, {
    batchId: 'B07',
    scenario: 'parent_topup_receipt_required_browser',
    runDate: RUN_DATE,
  });

  const directorSession = await loginAsRole(request, 'director');
  const accountingSession = await loginAsRole(request, 'accounting');
  const parent = await createParentAccount(request, directorSession, 'b07-parent-topup-required');
  await initializeWalletForParent(request, parent);
  const parentSession = await loginAsCredentials(request, 'parent', parent.email, parent.password);

  const transactionRef = `B07-PARENT-NO-RECEIPT-${Date.now()}`;
  const description = 'Parent top-up without uploaded receipt should not submit';
  let topUpRequestCount = 0;
  const requestListener = (req: { url: () => string; method: () => string }) => {
    if (req.method() === 'POST' && TOPUP_API.test(req.url())) {
      topUpRequestCount += 1;
    }
  };

  try {
    evidence.page.on('request', requestListener);
    await applySessionCookies(evidence.context, parentSession);
    await gotoWalletsAsParent(evidence.page, parent.email, parent.password);

    await evidence.page.locator('.my-wallet-card button.primary').click();
    const modal = evidence.page.locator('.modal-backdrop .modal').first();
    await expect(modal).toBeVisible();

    await modal.locator('input[name="amount"]').fill('180000');
    await modal.locator('input[name="transactionRef"]').fill(transactionRef);
    await modal.locator('textarea[name="description"]').fill(description);

    const dialogMessage = await acceptDialog(
      evidence.page,
      () => modal.locator('button[type="submit"]').click(),
    );

    expect(dialogMessage).toBe(RECEIPT_REQUIRED_ALERT);
    expect(topUpRequestCount).toBe(0);
    await expect(modal).toBeVisible();
    await expect(modal.locator('img')).toHaveCount(0);

    const pendingAfter = await apiJson<AnyRecord[]>(
      request,
      accountingSession,
      'GET',
      '/wallets/top-up/pending',
    );
    expect(
      pendingAfter.some((entry) => String(entry.transactionRef || '') === transactionRef),
      'Validation block must prevent any pending top-up with the attempted transactionRef.',
    ).toBe(false);

    await evidence.step('parent-topup-receipt-required-validation');
    await evidence.finalize('PASS', {
      extraLines: [
        'Bank transfer parent top-up without an uploaded receipt was blocked before any POST /wallets/top-up request.',
        `Blocked transactionRef: ${transactionRef}`,
        'Verified the modal stayed open and accounting pending list did not receive a new request.',
      ],
    });
  } catch (error) {
    await evidence.finalize('FAIL', { error });
    throw error;
  } finally {
    evidence.page.off('request', requestListener);
  }
});
