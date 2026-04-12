import { expect, test } from '@playwright/test';
import { apiJson } from '../support/api';
import { applySessionCookies, loginAsCredentials, loginAsRole, rolePassword } from '../support/auth';
import { createBatchEvidenceContext } from '../support/orchestrator';
import { seedUiOrchestratorFixtures } from '../support/orchestrator-fixtures';
import {
  createLearningFixture,
  dateOffset,
  getWalletBalanceByUserId,
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

function asArray<T>(value: any): T[] {
  if (Array.isArray(value)) return value as T[];
  return (value?.data || value?.items || value?.results || []) as T[];
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

test.describe('B07 finance wallets payroll orchestrator', () => {
  let fixtures: Awaited<ReturnType<typeof seedUiOrchestratorFixtures>>;
  let directorSession: DemoSession;
  let accountingSession: DemoSession;
  let opsSession: DemoSession;
  let payrollLateFixture: Awaited<ReturnType<typeof createLearningFixture>>;

  test.beforeAll(async ({ request }) => {
    test.setTimeout(180_000);
    fixtures = await seedUiOrchestratorFixtures(request, 'b07-finance-invoices-wallets-payroll');
    directorSession = await loginAsRole(request, 'director');
    accountingSession = await loginAsRole(request, 'accounting');
    opsSession = await loginAsRole(request, 'ops');

    // Seed a positive wallet balance so the over-balance transfer test can work off real state.
    const seedTopUp = await apiJson<AnyRecord>(request, directorSession, 'POST', '/wallets/top-up', {
      userId: fixtures.freshParent._id,
      amount: 300_000,
      paymentMethod: 'CASH',
      description: 'B07 transfer balance seed',
      transactionRef: `B07-SEED-${Date.now()}`,
    });
    await apiJson(
      request,
      accountingSession,
      'POST',
      `/wallets/top-up/${seedTopUp._id}/approve`,
      {
        accountingNotes: 'Seeded balance for transfer guardrail coverage',
      },
    );

    payrollLateFixture = await createLearningFixture(request, {
      label: 'b07-payroll-late-report',
      initializeWallet: true,
      scheduledDate: dateOffset(-3),
    });

    const teacherSession = await loginAsCredentials(
      request,
      'teacher',
      payrollLateFixture.teacher.email,
      rolePassword(),
    );
    const payrollLateSessionId = payrollLateFixture.session._id;

    await apiJson(
      request,
      teacherSession,
      'POST',
      `/sessions/${payrollLateSessionId}/complete`,
      {
        lessonContent: 'Late report scenario for B07.',
        homework: 'Reading practice',
        teacherNotes: 'Submitted late for payroll exclusion coverage.',
        actualStartTime: new Date(Date.now() - (90 * 60 * 1000)).toISOString(),
        actualEndTime: new Date(Date.now() - (30 * 60 * 1000)).toISOString(),
        studentPerformance: 4,
        studentEngagement: 4,
        comprehensionLevel: 4,
      },
      [200, 201],
    );

    await apiJson(
      request,
      teacherSession,
      'PATCH',
      `/sessions/${payrollLateSessionId}/teaching-report`,
      {
        lessonContent: 'Teacher submitted a complete late report for payroll exclusion coverage.',
        studentAttitude: 'Student remained focused and responsive throughout the lesson.',
        recordingUrl: 'https://example.com/b07-late-report-recording',
        teacherComment: 'The teacher followed the lesson plan and documented the late report clearly.',
        homework: 'Review the assigned worksheet and practice the new vocabulary list.',
        additionalNotes: 'Late report submitted intentionally for exclusion workflow coverage.',
      },
      [200, 201],
    );

    const parentSession = await loginAsCredentials(
      request,
      'parent',
      payrollLateFixture.parent.email,
      payrollLateFixture.parent.password,
    );

    await apiJson(
      request,
      parentSession,
      'POST',
      `/sessions/${payrollLateSessionId}/confirm`,
      {
        overallRating: 5,
        teachingQualityRating: 5,
        communicationRating: 5,
        concerns: '',
        isSatisfied: true,
      },
      [200, 201],
    );

    const finalizedLateSession = await apiJson<AnyRecord>(
      request,
      opsSession,
      'POST',
      `/sessions/${payrollLateSessionId}/finalize`,
      {},
      [200, 201],
    );
    expect(finalizedLateSession.status).toBe('FINALIZED');
    expect(finalizedLateSession.hasTeachingReport).toBeTruthy();
    expect(finalizedLateSession.confirmation?.finalizedBy).toBeTruthy();
  });

  test('B07 accounting approves wallet top-up and the ledger reflects the balance delta', async ({ browser, request }) => {
    const evidence = await createBatchEvidenceContext(browser, {
      batchId: 'B07',
      scenario: 'wallet-top-up-ledger',
      runDate: RUN_DATE,
    });

    try {
      await openEvidencePage(evidence, accountingSession, '/app/wallets');
      const balanceBefore = await getWalletBalanceByUserId(request, directorSession, fixtures.freshParent._id);
      const transactionRef = `B07-TOPUP-${Date.now()}`;

      const walletTopUp = await apiJson<AnyRecord>(request, directorSession, 'POST', '/wallets/top-up', {
        userId: fixtures.freshParent._id,
        amount: 250_000,
        paymentMethod: 'CASH',
        description: 'B07 accounting approval flow',
        transactionRef,
      });

      await expect
        .poll(async () => {
          const pendingRows = asArray<AnyRecord>(
            await apiJson<any>(request, accountingSession, 'GET', '/wallets/top-up/pending'),
          );
          return pendingRows.some(
            (entry) => String(entry._id) === String(walletTopUp._id)
              || String(entry.transactionRef || '') === transactionRef,
          );
        }, { timeout: 20_000 })
        .toBe(true);

      await evidence.page.reload({ waitUntil: 'networkidle' });
      await Promise.all([
        evidence.page.waitForResponse((response) =>
          response.url().includes('/wallets/top-up/pending')
          && response.status() === 200,
        ),
        evidence.page.getByRole('button', { name: /Chờ duyệt|Cho duyet/i }).click(),
      ]);
      const pendingItem = evidence.page
        .locator('.pending-item')
        .filter({ hasText: transactionRef })
        .first();
      await expect(pendingItem).toBeVisible({ timeout: 20_000 });
      await evidence.step('wallets-before-approval');
      await pendingItem.getByRole('button', { name: /Duyệt|Duye?t/i }).click();
      await expect(evidence.page.getByText(/Duyệt yêu cầu nạp tiền|Duyet yeu cau nap tien/i)).toBeVisible();

      const approveButton = evidence.page.getByRole('button', { name: /Xác nhận duyệt|Xac nhan duyet/i });
      await expect(approveButton).toBeEnabled();
      await evidence.step('wallets-approve-form-ready');
      await approveButton.click();

      await expect.poll(async () => getWalletBalanceByUserId(request, directorSession, fixtures.freshParent._id))
        .toBe(balanceBefore + walletTopUp.amount);
      await evidence.step('wallets-after-approval');

      const statusToast = evidence.page.locator('.notification, .toast, [role="status"]').first();
      if (await statusToast.count()) {
        await expect.soft(statusToast).toBeVisible({ timeout: 2_000 });
      }

      const pendingModal = evidence.page.locator('.modal-backdrop').first();
      const closePendingButton = pendingModal.getByRole('button', { name: /Đóng|Dong/i }).last();
      if (await closePendingButton.isVisible().catch(() => false)) {
        await closePendingButton.click();
        await expect(pendingModal).toBeHidden({ timeout: 10_000 });
      }

      await evidence.page.getByRole('button', { name: /Lịch sử giao dịch|Lich su giao dich/i }).click();
      const ledgerRow = evidence.page
        .locator('table.data tbody tr')
        .filter({ hasText: 'B07 accounting approval flow' })
        .filter({ hasText: Number(walletTopUp.amount).toLocaleString('vi-VN') })
        .first();
      await expect(ledgerRow).toBeVisible();
      await expect(ledgerRow).toContainText(Number(balanceBefore + walletTopUp.amount).toLocaleString('vi-VN'));
      await evidence.step('wallet-ledger-reflects-balance');

      await evidence.finalize('PASS', {
        extraLines: [
          `Approved top-up amount: ${formatMoney(walletTopUp.amount)}`,
          `Wallet balance before approval: ${formatMoney(balanceBefore)}`,
          `Wallet balance after approval: ${formatMoney(balanceBefore + walletTopUp.amount)}`,
        ],
      });
    } catch (error) {
      await evidence.finalize('FAIL', { error });
      throw error;
    }
  });

  test('B07 director transfer over current balance is blocked and does not move money', async ({ browser, request }) => {
    const evidence = await createBatchEvidenceContext(browser, {
      batchId: 'B07',
      scenario: 'wallet-transfer-over-balance-blocked',
      runDate: RUN_DATE,
    });

    try {
      await openEvidencePage(evidence, directorSession, '/app/wallets');
      const sourceBalance = await getWalletBalanceByUserId(request, directorSession, fixtures.freshParent._id);
      const transferAmount = sourceBalance + 50_000;

      await evidence.page.getByRole('button', { name: /Chuyển tiền|Chuyen tien/i }).click();
      const transferModal = evidence.page.locator('.modal-backdrop .modal').last();
      await expect(transferModal).toBeVisible();

      await transferModal.locator('input[name="fromUserId"]').fill(fixtures.freshParent._id);
      await transferModal.locator('input[name="toUserId"]').fill(fixtures.depletedWalletFixture.parent._id);
      await transferModal.locator('input[name="amount"]').fill(String(transferAmount));
      await transferModal.locator('textarea[name="description"]').fill('Attempt to exceed available balance.');
      await evidence.step('wallet-transfer-form-filled');
      evidence.page.once('dialog', (dialog) => dialog.dismiss().catch(() => undefined));

      const [transferResponse] = await Promise.all([
        evidence.page.waitForResponse((resp) => resp.url().includes('/wallets/transfer') && resp.request().method() === 'POST'),
        transferModal.getByRole('button', { name: /^Chuyển tiền|^Chuyen tien/i }).click(),
      ]);

      expect(transferResponse.status()).toBe(400);
      const transferError = await transferResponse.json().catch(() => ({} as AnyRecord));
      expect(String(transferError?.message || transferError?.error || '')).toContain('Số dư không đủ');
      await expect(transferModal).toBeVisible();
      await evidence.step('wallet-transfer-blocked');

      await expect.poll(async () => getWalletBalanceByUserId(request, directorSession, fixtures.freshParent._id))
        .toBe(sourceBalance);

      await transferModal.locator('button[type="button"].ghost').first().click();
      await expect(transferModal).toBeHidden({ timeout: 20_000 });

      await evidence.page.getByRole('button', { name: /Lịch sử giao dịch|Lich su giao dich/i }).click();
      await expect(
        evidence.page.locator('table.data tbody tr').filter({ hasText: formatMoney(transferAmount) }),
      ).toHaveCount(0);
      await evidence.step('wallet-ledger-unchanged-after-block');

      await evidence.finalize('PASS', {
        extraLines: [
          `Source wallet balance stayed at ${formatMoney(sourceBalance)}.`,
          `Blocked transfer amount: ${formatMoney(transferAmount)}`,
          `Backend error: ${String(transferError?.message || transferError?.error || 'unknown')}`,
        ],
      });
    } catch (error) {
      await evidence.finalize('FAIL', { error });
      throw error;
    }
  });

  test('B07 director payroll generation can exclude a late-report teacher and teacher view shows EXCLUDED', async ({ browser, request }) => {
    test.setTimeout(120_000);
    const evidence = await createBatchEvidenceContext(browser, {
      batchId: 'B07',
      scenario: 'payroll-exclude-late-report-teacher',
      runDate: RUN_DATE,
    });

    try {
      await openEvidencePage(evidence, directorSession, '/app/payroll');
      const teacherSelect = evidence.page.locator('.filter-bar select').first();
      const startInput = evidence.page.locator('.filter-bar input[type="date"]').first();
      const endInput = evidence.page.locator('.filter-bar input[type="date"]').last();

      await teacherSelect.selectOption(payrollLateFixture.teacher._id);
      await startInput.fill(dateOffset(-7));
      await endInput.fill(dateOffset(1));
      await evidence.page.getByRole('button', { name: /^Xem$/i }).click();

      await evidence.step('payroll-before-generate');

      const generateButton = evidence.page.getByRole('button', { name: /Tạo bảng lương|Tao bang luong/i });
      await expect(generateButton).toBeVisible({ timeout: 20_000 });
      await expect(generateButton).toBeEnabled();
      const [generateResponse] = await Promise.all([
        evidence.page.waitForResponse((response) =>
          response.request().method() === 'POST'
          && /\/payroll(?:\?.*)?$/.test(response.url()),
        ),
        generateButton.click(),
      ]);
      expect(generateResponse.ok()).toBeTruthy();
      await evidence.step('payroll-generate-request-sent');

      await expect(evidence.page.locator('.notification')).toContainText(/thành công|thanh cong/i, { timeout: 20_000 });

      const payrollListResponse = await apiJson<any>(request, directorSession, 'GET', `/payroll?teacherId=${payrollLateFixture.teacher._id}`);
      const payrolls = asArray<AnyRecord>(payrollListResponse);
      const targetPayroll = payrolls.find((item) => String(item.teacherId?._id || item.teacherId) === String(payrollLateFixture.teacher._id)) || payrolls[0];
      expect(targetPayroll, 'Expected a generated payroll record for the late-report teacher').toBeTruthy();

      const payrollRow = evidence.page.locator('tbody tr').filter({ hasText: targetPayroll.payrollCode }).first();
      await evidence.page.getByRole('button', { name: /Bảng lương|Bang luong/i }).click();
      await expect(payrollRow).toBeVisible({ timeout: 20_000 });
      await payrollRow.click();
      await expect(evidence.page.getByText(new RegExp(`Chi tiết bảng lương: ${String(targetPayroll.payrollCode).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`))).toBeVisible();
      await evidence.step('payroll-detail-opened');

      const detailModal = evidence.page.locator('.modal-overlay .modal-content').last();
      await expect(detailModal).toBeVisible();
      const excludeButton = detailModal.getByRole('button', { name: /Loại trừ|Exclude/i });
      await expect(excludeButton).toBeVisible();
      await excludeButton.click();

      const excludeModal = evidence.page.locator('.modal-exclude-payroll');
      await expect(excludeModal).toBeVisible();
      const reasonInput = excludeModal.locator('textarea[name="adjustmentReason"]');
      const saveButton = excludeModal.getByRole('button', { name: /Lưu|Save/i });

      await reasonInput.fill('Nộp trễ');
      await expect(saveButton).toBeEnabled();
      await saveButton.click();

      await evidence.step('payroll-excluded-saved');

      await expect(excludeModal).toBeHidden({ timeout: 20_000 });
      await expect(evidence.page.locator('.notification')).toContainText(/loại trừ|exclude|thành công|success/i, { timeout: 20_000 });
      await expect(detailModal.locator('.payroll-item-row').filter({ hasText: /EXCLUDED/i }).first()).toBeVisible({ timeout: 20_000 });

      const teacherView = await createBatchEvidenceContext(browser, {
        batchId: 'B07',
        scenario: 'payroll-excluded-teacher-view',
        runDate: RUN_DATE,
      });

      try {
        const teacherSession = await loginAsCredentials(
          request,
          'teacher',
          payrollLateFixture.teacher.email,
          rolePassword(),
        );
        await openEvidencePage(teacherView, teacherSession, '/app/payroll');
        await teacherView.page.locator('button:has-text("Bảng lương"), button:has-text("Bang luong")').first().click();
        const teacherPayrollRow = teacherView.page.locator('tbody tr').filter({ hasText: targetPayroll.payrollCode }).first();
        await expect(teacherPayrollRow).toBeVisible({ timeout: 20_000 });
        await teacherPayrollRow.click();
        const teacherDetailModal = teacherView.page.locator('.modal-overlay .modal-content').last();
        await expect(teacherDetailModal).toBeVisible({ timeout: 20_000 });
        await expect(teacherDetailModal.locator('.payroll-item-row').filter({ hasText: /EXCLUDED/i }).first()).toBeVisible({ timeout: 20_000 });
        await teacherView.step('payroll-teacher-view-excluded');

        await teacherView.finalize('PASS', {
          extraLines: [
            `Payroll code: ${targetPayroll.payrollCode}`,
            `Teacher: ${payrollLateFixture.teacher.fullName}`,
            'Payroll status: EXCLUDED',
          ],
        });
      } catch (error) {
        await teacherView.finalize('FAIL', { error });
        throw error;
      }

      await evidence.finalize('PASS', {
        extraLines: [
          `Payroll code: ${targetPayroll.payrollCode}`,
          `Teacher: ${payrollLateFixture.teacher.fullName}`,
          'Late-report teacher excluded from payroll.',
        ],
      });
    } catch (error) {
      await evidence.finalize('FAIL', { error });
      throw error;
    }
  });
});
