import { expect, test, type APIRequestContext } from '@playwright/test';
import { apiJson } from '../support/api';
import { loginAsRole } from '../support/auth';
import {
  createParentAccount,
  getWalletBalanceByUserId,
  initializeWalletForParent,
} from '../support/scenario-helpers';

const DEFAULT_API_BASE_URL =
  process.env['PLAYWRIGHT_API_BASE_URL'] ||
  process.env['E2E_API_BASE_URL'] ||
  'http://127.0.0.1:3000';

type FetchResult = {
  status: number;
  text: string;
  data: any;
};

function makeHeaders(cookieHeader: string, xsrfToken: string): Record<string, string> {
  return {
    Cookie: cookieHeader,
    'X-XSRF-TOKEN': xsrfToken,
    'Content-Type': 'application/json',
  };
}

async function fetchJson(
  request: APIRequestContext,
  url: string,
  options: {
    method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
    headers: Record<string, string>;
    data?: unknown;
  },
): Promise<FetchResult> {
  const response = await request.fetch(url, options);
  const text = await response.text();
  const contentType = response.headers()['content-type'] || '';

  let data: any = null;
  if (contentType.includes('application/json') && text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  } else {
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }
  }

  return {
    status: response.status(),
    text,
    data,
  };
}

function extractEntries(payload: any): any[] {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload?.data)) {
    return payload.data;
  }

  if (Array.isArray(payload?.items)) {
    return payload.items;
  }

  if (Array.isArray(payload?.docs)) {
    return payload.docs;
  }

  return [];
}

test.describe('Wallet top-up approval race conditions', () => {
  test('only one concurrent approve can settle the same pending top-up', async ({ request }) => {
    test.slow();

    const label = `race-topup-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
    const directorSession = await loginAsRole(request, 'director');
    const parent = await createParentAccount(request, directorSession, label);

    await initializeWalletForParent(request, parent);
    await expect.poll(async () => getWalletBalanceByUserId(request, directorSession, parent._id)).toBe(0);

    const topUp = await apiJson<any>(request, directorSession, 'POST', '/wallets/top-up', {
      userId: parent._id,
      amount: 500_000,
      paymentMethod: 'BANK_TRANSFER',
      transactionRef: `RACE-${label}`,
      receiptImageUrl: '/uploads/wallets/e2e-top-up.png',
      description: `Race top-up for ${label}`,
    });

    expect(topUp._id, 'Top-up request should create a ledger entry').toBeTruthy();
    expect(topUp.status).toBe('PENDING');

    const approveUrl = `${DEFAULT_API_BASE_URL}/wallets/top-up/${topUp._id}/approve`;
    const approveHeaders = makeHeaders(directorSession.cookieHeader, directorSession.xsrfToken);
    const approvePayload = {
      bankMatched: true,
      bankStatementRef: `BANK-${label}`,
      accountingNotes: `Concurrent approval check for ${label}`,
    };

    // Fire 3 approvals simultaneously and capture every response status without short-circuiting.
    const attempts = await Promise.all(
      Array.from({ length: 3 }, () =>
        fetchJson(request, approveUrl, {
          method: 'POST',
          headers: approveHeaders,
          data: approvePayload,
        }),
      ),
    );

    const successAttempts = attempts.filter((attempt) => [200, 201].includes(attempt.status));
    const rejectedAttempts = attempts.filter((attempt) => [400, 409].includes(attempt.status));

    expect(successAttempts).toHaveLength(1);
    expect(rejectedAttempts).toHaveLength(2);

    for (const attempt of attempts) {
      expect([200, 201, 400, 409]).toContain(attempt.status);
    }

    await expect.poll(async () => getWalletBalanceByUserId(request, directorSession, parent._id)).toBe(500_000);

    const wallet = await apiJson<any>(request, directorSession, 'GET', `/wallets/user/${parent._id}`);
    expect(Number(wallet?.balance || 0)).toBe(500_000);

    const ledgerResponse = await apiJson<any>(
      request,
      directorSession,
      'GET',
      `/wallets/ledger?userId=${parent._id}&type=TOP_UP&page=1&limit=20`,
    );
    const ledgerEntries = extractEntries(ledgerResponse);
    const matchingEntries = ledgerEntries.filter((entry) => String(entry._id) === String(topUp._id));

    expect(matchingEntries).toHaveLength(1);
    expect(
      ledgerEntries.filter((entry) => String(entry._id) === String(topUp._id) && String(entry.status) === 'APPROVED'),
    ).toHaveLength(1);

    const approvedEntry = matchingEntries[0];
    expect(approvedEntry.status).toBe('APPROVED');
    expect(Number(approvedEntry.amount)).toBe(500_000);
    expect(Number(approvedEntry.balanceBefore)).toBe(0);
    expect(Number(approvedEntry.balanceAfter)).toBe(500_000);
    expect(approvedEntry.approvedBy).toBeTruthy();
    expect(approvedEntry.approvedAt).toBeTruthy();
  });
});
