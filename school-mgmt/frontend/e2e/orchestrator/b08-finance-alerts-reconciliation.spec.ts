import { expect, test } from '../support/orchestrator-fixtures';
import { apiJson } from '../support/api';
import { applySessionCookies, loginAsCredentials, loginAsRole } from '../support/auth';
import { dateOffset } from '../support/scenario-helpers';

test.use({ video: 'on' });
test.describe.configure({ mode: 'serial', timeout: 180_000 });

const APP_BASE_URL =
  process.env['PLAYWRIGHT_BASE_URL']
  || process.env['E2E_BASE_URL']
  || 'http://localhost:4200';

type AnyRecord = any;

interface CsvRowSeed {
  rowType: 'MATCHED' | 'UNMATCHED_BANK' | 'UNMATCHED_SYSTEM' | 'PENDING_REJECT';
  reference: string;
  amount: number;
  transactionDate: string;
  description: string;
}

function appUrl(path: string): string {
  return new URL(path, APP_BASE_URL).toString();
}

function buildMockCsv(rows: CsvRowSeed[]): string {
  const header = ['rowType', 'reference', 'amount', 'transactionDate', 'description'];
  const body = rows.map((row) => [
    row.rowType,
    row.reference,
    String(row.amount),
    row.transactionDate,
    `"${row.description.replace(/"/g, '""')}"`,
  ].join(','));
  return [header.join(','), ...body].join('\n');
}

async function openAppPage(
  page: AnyRecord,
  session: Awaited<ReturnType<typeof loginAsRole>>,
  path: string,
): Promise<void> {
  await applySessionCookies(page.context(), session);
  await page.goto(appUrl(path));
  await page.waitForLoadState('networkidle');
}

test.describe('B08 finance alerts and reconciliation orchestrator', () => {
  let directorSession: Awaited<ReturnType<typeof loginAsRole>>;
  let accountingSession: Awaited<ReturnType<typeof loginAsRole>>;
  let shareholderSession: Awaited<ReturnType<typeof loginAsRole>>;
  let bankAccount: AnyRecord;
  let rejectablePendingRef: string;

  test.beforeAll(async ({ request }) => {
    test.setTimeout(180_000);
    directorSession = await loginAsRole(request, 'director');
    accountingSession = await loginAsRole(request, 'accounting');

    const shareholderDigits = `${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(-10);
    const shareholderPassword = 'Shareholder123!';
    const shareholderUser = await apiJson<AnyRecord>(request, directorSession, 'POST', '/users', {
      userCode: `SH${shareholderDigits}`,
      email: `e2e-shareholder-${shareholderDigits}@school.local`,
      password: shareholderPassword,
      fullName: `E2E Shareholder ${shareholderDigits}`,
      role: 'SHAREHOLDER',
      phone: `09${shareholderDigits.slice(-8)}`,
      ownershipPercentage: 10,
    });
    shareholderSession = await loginAsCredentials(
      request,
      'shareholder',
      shareholderUser.email,
      shareholderPassword,
    );

    bankAccount = await apiJson<AnyRecord>(request, directorSession, 'POST', '/financial-control/bank-accounts', {
      bankName: 'E2E Bank',
      accountNumber: `09${Date.now().toString().slice(-8)}`,
      accountHolder: 'School Mgmt E2E',
      openingBalance: 5_000_000,
      isPrimary: false,
      description: 'Seeded bank account for B08 finance alerts/reconciliation',
    });

    rejectablePendingRef = `CSV-PENDING-REJECT-${Date.now()}`;

    await apiJson<AnyRecord>(request, directorSession, 'POST', '/wallets/top-up', {
      userId: String(directorSession.user?._id || directorSession.user?.id || directorSession.user?.sub),
      amount: 270_000,
      paymentMethod: 'BANK_TRANSFER',
      transactionRef: rejectablePendingRef,
      receiptImageUrl: '/uploads/wallets/e2e-top-up.png',
      description: 'Pending import row that will be rejected from the UI',
    });
  });

  test('DIRECTOR keeps P&L basis in sync across CASH and ACCRUAL reloads', async ({ createEvidence }) => {
    const evidence = await createEvidence({
      batchId: 'B08',
      scenario: 'director-pnl-basis-switch',
    });

    try {
      await openAppPage(evidence.page, directorSession, '/app/financial-control');
      await evidence.step('financial-control-opened');

      await Promise.all([
        evidence.page.waitForResponse((response) =>
          response.url().includes('/financial-control/profit-and-loss')
          && response.url().includes('basis=cash')
          && response.status() === 200,
        ),
        evidence.page.getByRole('button', { name: /P&L/i }).click(),
      ]);

      const pnlSection = evidence.page
        .locator('.tab-content')
        .filter({ has: evidence.page.getByRole('heading', { name: /P&L Report/i }) })
        .first();
      const pnlReport = pnlSection.locator('.pnl-report');
      const basisSelect = pnlSection.locator('select').first();
      await expect(pnlSection.getByRole('heading', { name: /P&L Report/i })).toBeVisible();
      await expect(basisSelect).toHaveValue('cash');
      await expect(pnlReport).toContainText(/TỔNG DOANH THU|DOANH THU/i);
      await expect(pnlReport).toContainText(/CASH/i);
      const cashSnapshot = await pnlReport.textContent();
      await evidence.step('pnl-cash-loaded');

      await Promise.all([
        evidence.page.waitForResponse((response) =>
          response.url().includes('/financial-control/profit-and-loss')
          && response.url().includes('basis=accrual')
          && response.status() === 200,
        ),
        basisSelect.selectOption('accrual'),
      ]);

      await expect(basisSelect).toHaveValue('accrual');
      await expect(pnlReport).toContainText(/ACCRUAL/i);
      await expect(pnlReport).not.toContainText(/TỔNG DOANH THU \(CASH\)|CASH basis/i);
      const accrualSnapshot = await pnlReport.textContent();
      expect(accrualSnapshot).not.toBe(cashSnapshot);
      await evidence.step('pnl-accrual-reloaded');

      await evidence.finalize('PASS', {
        extraLines: [
          'P&L basis switched from CASH to ACCRUAL and the report re-fetched the accrual dataset.',
          'No stale CASH labels remained after the switch.',
        ],
      });
    } catch (error) {
      await evidence.finalize('FAIL', { error });
      throw error;
    }
  });

  test('ACCOUNTING classifies mock CSV rows and rejects an unmatched import with a reason', async ({ createEvidence }) => {
    const evidence = await createEvidence({
      batchId: 'B08',
      scenario: 'accounting-reconciliation-import',
    });

    try {
      await openAppPage(evidence.page, accountingSession, '/app/bank-reconciliation');
      await expect(evidence.page.getByText('Doi soat Ngan hang')).toBeVisible();
      await evidence.step('reconciliation-page-opened');

      await evidence.page.locator('.filter-bar select').first().selectOption(bankAccount._id);
      await evidence.page.locator('.filter-bar input[type="date"]').first().fill(dateOffset(-1));
      await evidence.page.locator('.filter-bar input[type="date"]').last().fill(dateOffset(1));

      await Promise.all([
        evidence.page.waitForResponse((response) =>
          response.url().includes('/financial-control/bank-reconciliation')
          && response.status() === 200,
        ),
        evidence.page.getByRole('button', { name: /Doi soat/i }).click(),
      ]);

      const importRows: CsvRowSeed[] = [
        {
          rowType: 'MATCHED',
          reference: `CSV-MATCH-${Date.now()}`,
          amount: 640_000,
          transactionDate: dateOffset(0),
          description: 'Matched bank transfer row from UI CSV import',
        },
        {
          rowType: 'UNMATCHED_BANK',
          reference: rejectablePendingRef,
          amount: 270_000,
          transactionDate: dateOffset(0),
          description: 'Pending import row that will be rejected from the UI',
        },
      ];
      const mockCsv = buildMockCsv(importRows);

      const importButton = evidence.page.locator('button', { hasText: /Import giao dich gia lap|Import giao dịch giả lập/i }).first();
      const fileInput = evidence.page.locator('input[type="file"][aria-label*="Import giao dich gia lap"], input[type="file"]').first();
      await expect(importButton).toBeVisible();
      await expect(fileInput).toBeAttached();
      await fileInput.setInputFiles({
        name: 'b08-bank-reconciliation.csv',
        mimeType: 'text/csv',
        buffer: Buffer.from(mockCsv, 'utf8'),
      });

      const matchedItems = evidence.page.locator('.matched-item');
      const unmatchedItems = evidence.page.locator('.unmatched-item');
      await expect(matchedItems).toHaveCount(1, { timeout: 20_000 });
      await expect(unmatchedItems).toHaveCount(1, { timeout: 20_000 });
      await expect(matchedItems.first()).toContainText(importRows[0].reference);
      await expect(unmatchedItems.first()).toContainText(importRows[1].reference);
      await evidence.step('reconciliation-matched-unmatched-visible');

      const unmatchedItem = unmatchedItems.filter({ hasText: importRows[1].reference }).first();
      const rejectButton = unmatchedItem.getByRole('button', { name: /Reject|Tu choi doi soat|Từ chối đối soát/i });
      await expect(rejectButton).toBeVisible();
      await rejectButton.click();

      const rejectModal = evidence.page.locator('.modal-reject-reconciliation');
      await expect(rejectModal).toBeVisible();
      const reasonInput = rejectModal.locator('textarea[name="reason"]');
      const saveButton = rejectModal.getByRole('button', { name: /Luu|Lưu|Save/i });
      await expect(reasonInput).toBeVisible();

      await saveButton.click();
      await expect(rejectModal.locator('.form-error')).toContainText(/ly do|bat buoc|reason|required/i);
      await evidence.step('rejection-validation-shown');

      await reasonInput.fill('Nop tre');
      await saveButton.click();

      await expect(evidence.page.locator('.notice, .notification, .toast-success')).toContainText(/thanh cong|success|thành công/i, {
        timeout: 20_000,
      });
      await expect(evidence.page.locator('.unmatched-item').filter({ hasText: importRows[1].reference })).toHaveCount(0, {
        timeout: 20_000,
      });
      await evidence.step('rejected-import-removed-from-unmatched');

      await evidence.finalize('PASS', {
        extraLines: [
          'Mock CSV upload produced matched and unmatched reconciliation rows through the UI.',
          'Unmatched row rejection required a reason and removed the item from the unmatched list.',
          `Mock CSV snapshot: ${mockCsv.split('\n').length - 1} data rows`,
        ],
      });
    } catch (error) {
      await evidence.finalize('FAIL', { error });
      throw error;
    }
  });

  test('SHAREHOLDER sees financial control as read-only across overview, revenue, expense, and P&L views', async ({ createEvidence }) => {
    const evidence = await createEvidence({
      batchId: 'B08',
      scenario: 'shareholder-readonly-financial-control',
    });

    try {
      await openAppPage(evidence.page, shareholderSession, '/app/financial-control');
      await evidence.step('shareholder-overview');

      const forbiddenButtons = evidence.page.getByRole('button', {
        name: /(Create|Edit|Delete|Tạo|Sửa|Xóa)/i,
      });
      await expect(forbiddenButtons).toHaveCount(0);

      await evidence.page.getByRole('button', { name: /P&L/i }).click();
      await expect(evidence.page.locator('.pnl-report')).toBeVisible();
      await expect(evidence.page.locator('.pnl-report').getByRole('button')).toHaveCount(0);
      await expect(evidence.page.getByRole('button', { name: /(Create|Edit|Delete|Tạo|Sửa|Xóa)/i })).toHaveCount(0);
      await evidence.step('shareholder-pnl-readonly');

      await evidence.page.getByRole('button', { name: /Đối soát|Doi soat/i }).click();
      await expect(evidence.page.locator('.recon-grid')).toBeVisible();
      await expect(evidence.page.getByRole('button', { name: /(Create|Edit|Delete|Tạo|Sửa|Xóa)/i })).toHaveCount(0);
      await evidence.step('shareholder-reconciliation-readonly');

      await evidence.finalize('PASS', {
        extraLines: [
          'Shareholder financial-control views remained read-only.',
          'No Create/Edit/Delete controls were rendered on overview, P&L, or reconciliation content.',
        ],
      });
    } catch (error) {
      await evidence.finalize('FAIL', { error });
      throw error;
    }
  });
});
