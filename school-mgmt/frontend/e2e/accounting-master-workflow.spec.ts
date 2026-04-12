import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { expect, test, type BrowserContext, type Locator, type Page, type Route } from '@playwright/test';
import { ACCOUNTING_VIDEO_COPY } from './accounting-video-copy';

const APP_BASE_URL =
  process.env['PLAYWRIGHT_BASE_URL'] ||
  process.env['E2E_BASE_URL'] ||
  'http://localhost:4200';

const API_PREFIX_PATTERN = '^(?:https?://[^/]+)?(?:/api)?';
const TINY_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7Z1ioAAAAASUVORK5CYII=';
const TOP_UP_LEDGER_DESCRIPTION = 'Duyet top-up tu bien lai chuyen khoan';
const RUN_DATE = process.env['UI_EVIDENCE_DATE'] || new Date().toISOString().slice(0, 10);
const DATE_STAMP = RUN_DATE.replace(/-/g, '');
const ROOT_DIR = path.resolve(process.cwd(), '../..');
const EVIDENCE_DIR = path.join(ROOT_DIR, 'frontend-ui-evidence', RUN_DATE);
const VIDEO_DIR = path.join(EVIDENCE_DIR, 'videos');
const RAW_VIDEO_DIR = path.join(VIDEO_DIR, 'raw');
const META_DIR = path.join(EVIDENCE_DIR, 'showcase-artifacts');
const FINAL_VIDEO_BASENAME = `UI_KeToan_Full_Workflow_VI_${DATE_STAMP}`;
const VIEWPORT = { width: 1600, height: 900 };
const VIDEO_TEST_TITLE = 'records the full accounting master workflow with HD demo pacing';

test.use({
  video: 'on',
  viewport: VIEWPORT,
  trace: 'off',
  launchOptions: {
    slowMo: 150,
  },
});

test.describe.serial('Accounting full workflow video', () => {
  test(VIDEO_TEST_TITLE, async ({ page }) => {
    test.setTimeout(900_000);

    const state = buildAccountingWorkflowState();
    const ui = new AccountingWorkflowPage(page);
    const context = page.context();
    const artifactDir = path.join(META_DIR, `accounting-demo-${Date.now()}`);
    const cues: NarrationCue[] = [];
    const narrationDurationMap = await buildNarrationDurationMap(collectNarrationTexts(ACCOUNTING_VIDEO_COPY));
    const recordingStartedAt = Date.now();
    let savedVideoPath: string | null = null;

    const presentSceneCard = async (
      section: string,
      title: string,
      description: string,
      bullets: readonly string[],
      narration: string,
    ) => {
      await setVideoLabel(page, null);
      await setVideoCallout(page, null, null);
      const playback = beginNarration(cues, recordingStartedAt, section, narration, narrationDurationMap);
      await showTitleCard(page, title, description, [...bullets]);
      await waitForNarrationWindow(page, playback, 3_600);
    };

    await ensureEvidenceDirs();
    await mkdir(artifactDir, { recursive: true });
    await installAccountingWorkflowRoutes(page, state);
    await installVideoOverlay(page);

    try {
      const introPlayback = beginNarration(
        cues,
        recordingStartedAt,
        'intro',
        ACCOUNTING_VIDEO_COPY.introNarration,
        narrationDurationMap,
      );
      await showTitleCard(
        page,
        ACCOUNTING_VIDEO_COPY.introTitle,
        ACCOUNTING_VIDEO_COPY.introDescription,
        [...ACCOUNTING_VIDEO_COPY.introBullets],
      );
      await waitForNarrationWindow(page, introPlayback, 4_600);

      const roadmapPlayback = beginNarration(
        cues,
        recordingStartedAt,
        'roadmap',
        ACCOUNTING_VIDEO_COPY.roadmapNarration,
        narrationDurationMap,
      );
      await showWorkflowRoadmapCard(
        page,
        ACCOUNTING_VIDEO_COPY.roadmapTitle,
        ACCOUNTING_VIDEO_COPY.roadmapDescription,
        ACCOUNTING_VIDEO_COPY.workflowSteps,
      );
      await waitForNarrationWindow(page, roadmapPlayback, 5_400);

      await presentSceneCard(
        'scene-dashboard',
        ACCOUNTING_VIDEO_COPY.dashboardSceneTitle,
        ACCOUNTING_VIDEO_COPY.dashboardSceneDescription,
        ACCOUNTING_VIDEO_COPY.dashboardSceneBullets,
        ACCOUNTING_VIDEO_COPY.dashboardSceneNarration,
      );

      await ui.loginAsAccounting();
      await expect(page).toHaveURL(/\/app\/dashboard/);
      await expect(page.getByRole('heading', { name: /(Dashboard Kế toán|Dashboard Ke toan)/i })).toBeVisible();
      await setVideoLabel(page, ACCOUNTING_VIDEO_COPY.dashboardLabel);
      const dashboardPlayback = beginNarration(
        cues,
        recordingStartedAt,
        'dashboard',
        ACCOUNTING_VIDEO_COPY.dashboardNarration,
        narrationDurationMap,
      );
      const topUpTask = page.getByText(/(Top-up chờ duyệt|Top-up cho duyet)/i).first();
      await expect(topUpTask).toBeVisible();
      await setVideoCallout(page, topUpTask, ACCOUNTING_VIDEO_COPY.dashboardTaskCallout);
      await ui.pause(2_200);
      await setVideoCallout(page, null, null);
      await waitForNarrationWindow(page, dashboardPlayback);

      await presentSceneCard(
        'scene-wallets',
        ACCOUNTING_VIDEO_COPY.walletsSceneTitle,
        ACCOUNTING_VIDEO_COPY.walletsSceneDescription,
        ACCOUNTING_VIDEO_COPY.walletsSceneBullets,
        ACCOUNTING_VIDEO_COPY.walletsSceneNarration,
      );

      await ui.goto('/app/wallets');
      await setVideoLabel(page, ACCOUNTING_VIDEO_COPY.walletsLabel);
      const walletsPlayback = beginNarration(
        cues,
        recordingStartedAt,
        'wallets',
        ACCOUNTING_VIDEO_COPY.walletsNarration,
        narrationDurationMap,
      );
      const pendingButton = page.getByRole('button', { name: /(Chờ duyệt|Cho duyet)/i });
      await expect(pendingButton).toBeVisible();
      await setVideoCallout(page, pendingButton, ACCOUNTING_VIDEO_COPY.walletsPendingButtonCallout);
      await ui.pause(1_600);
      await clickLocator(page, pendingButton);

      const pendingModal = page.locator('.modal.modal-lg');
      await expect(pendingModal).toBeVisible();
      const pendingRow = pendingModal.locator('.pending-item').filter({ hasText: state.parent.fullName }).first();
      await expect(pendingRow).toBeVisible();
      await setVideoCallout(page, pendingRow, ACCOUNTING_VIDEO_COPY.walletsPendingRowCallout);
      await ui.pause(2_000);
      await clickLocator(page, pendingRow.getByRole('button', { name: /(Duyệt|Duyet)/i }));
      await expect(page.locator('select[name="bankAccountId"]')).toBeVisible();
      await page.locator('select[name="bankAccountId"]').selectOption(state.bankAccounts[0]._id);
      await ui.slowFill(page.locator('textarea[name="accountingNotes"]'), 'Da doi soat bien lai va xac nhan top-up hop le.');
      const approveButton = page.getByRole('button', { name: /(Xác nhận duyệt|Xac nhan duyet)/i });
      await setVideoCallout(page, approveButton, ACCOUNTING_VIDEO_COPY.walletsApproveCallout);
      await ui.pause(1_600);
      await clickLocator(page, approveButton);
      await expect.poll(() => state.topUpApprovalBodies.length).toBe(1);
      await expect(pendingModal).toContainText(/(Không có yêu cầu nào|Khong co yeu cau nao)/i);
      await ui.pause(1_400);
      await clickLocator(page, pendingModal.getByRole('button', { name: /(Đóng|Dong)/i }));

      await clickLocator(page, page.getByRole('button', { name: /(Lịch sử giao dịch|Lich su giao dich)/i }));
      const ledgerRow = page.locator('table.data tbody tr').first();
      await expect(ledgerRow).toContainText(TOP_UP_LEDGER_DESCRIPTION);
      await setVideoCallout(page, ledgerRow, ACCOUNTING_VIDEO_COPY.walletsLedgerCallout);
      await ui.pause(2_100);

      await ui.goto('/app/wallets');
      const walletRow = page.locator('table.data tbody tr').filter({ hasText: state.parent.fullName }).first();
      await expect(walletRow).toBeVisible();
      await clickLocator(page, walletRow.getByTestId('wallet-adjust-button'));
      const adjustModal = page.getByTestId('wallet-adjust-modal');
      await expect(adjustModal).toBeVisible();
      await page.getByTestId('wallet-adjust-direction').selectOption('SUBTRACT');
      await page.getByTestId('wallet-adjust-amount').fill('50000');
      await ui.slowFill(page.getByTestId('wallet-adjust-description'), 'Kiem tra validation khi tru vi nhung chua nhap ly do.');
      await setVideoCallout(page, adjustModal, ACCOUNTING_VIDEO_COPY.walletsAdjustModalCallout);
      await ui.pause(2_000);
      await page.getByTestId('wallet-adjust-submit').click();
      await expect(page.getByTestId('wallet-adjust-reason-error')).toContainText(
        /(Lý do điều chỉnh là bắt buộc|Ly do dieu chinh la bat buoc)/i,
      );
      expect(state.adjustBodies).toHaveLength(0);
      await ui.pause(1_700);
      await clickLocator(page, adjustModal.getByRole('button', { name: /^(Hủy|Huy)$/i }));
      await expect(page.getByTestId('wallet-adjust-modal')).toHaveCount(0);
      await setVideoCallout(page, null, null);
      await waitForNarrationWindow(page, walletsPlayback);

      await presentSceneCard(
        'scene-invoices',
        ACCOUNTING_VIDEO_COPY.invoicesSceneTitle,
        ACCOUNTING_VIDEO_COPY.invoicesSceneDescription,
        ACCOUNTING_VIDEO_COPY.invoicesSceneBullets,
        ACCOUNTING_VIDEO_COPY.invoicesSceneNarration,
      );

      await ui.goto('/app/invoices');
      await setVideoLabel(page, ACCOUNTING_VIDEO_COPY.invoicesLabel);
      const invoicesPlayback = beginNarration(
        cues,
        recordingStartedAt,
        'invoices',
        ACCOUNTING_VIDEO_COPY.invoicesNarration,
        narrationDurationMap,
      );
      const invoiceFilters = page.locator('.filters-section .filter-row').nth(1).locator('select');
      await invoiceFilters.nth(1).selectOption('PENDING_APPROVAL');
      const pendingInvoiceRow = page.getByTestId('invoice-row').filter({ hasText: state.invoices[0].invoiceNumber }).first();
      await expect(pendingInvoiceRow).toBeVisible();
      await setVideoCallout(page, pendingInvoiceRow, ACCOUNTING_VIDEO_COPY.invoicesPendingCallout);
      await ui.pause(1_900);
      await clickLocator(page, pendingInvoiceRow.getByTestId('invoice-row-approve'));
      const approveInvoiceModal = page.getByTestId('invoice-approve-modal');
      await expect(approveInvoiceModal).toBeVisible();
      await page.getByTestId('invoice-approve-file').setInputFiles({
        name: 'invoice-approval-proof.png',
        mimeType: 'image/png',
        buffer: Buffer.from(TINY_PNG_BASE64, 'base64'),
      });
      await expect(page.getByRole('img', { name: /(Ảnh xác nhận|Anh xac nhan)/i })).toBeVisible();
      const invoiceConfirm = page.getByTestId('invoice-approve-confirm');
      await setVideoCallout(page, invoiceConfirm, ACCOUNTING_VIDEO_COPY.invoicesApproveCallout);
      await ui.pause(1_600);
      const confirmMessage = await captureSingleDialog(page, async () => {
        await clickLocator(page, invoiceConfirm);
      });
      expect(confirmMessage).toContain(state.invoices[0].invoiceNumber);
      await expect.poll(() => state.invoiceApprovalBodies.length).toBe(1);
      await expect(approveInvoiceModal).toHaveCount(0);
      await invoiceFilters.nth(1).selectOption('APPROVED');
      const approvedInvoiceRow = page.getByTestId('invoice-row').filter({ hasText: state.invoices[0].invoiceNumber }).first();
      await expect(approvedInvoiceRow).toContainText(/(Đã duyệt|Da duyet)/i);
      await setVideoCallout(page, approvedInvoiceRow, ACCOUNTING_VIDEO_COPY.invoicesApprovedCallout);
      await ui.pause(2_100);
      await setVideoCallout(page, null, null);
      await waitForNarrationWindow(page, invoicesPlayback);

      await presentSceneCard(
        'scene-teacher-payroll',
        ACCOUNTING_VIDEO_COPY.teacherPayrollSceneTitle,
        ACCOUNTING_VIDEO_COPY.teacherPayrollSceneDescription,
        ACCOUNTING_VIDEO_COPY.teacherPayrollSceneBullets,
        ACCOUNTING_VIDEO_COPY.teacherPayrollSceneNarration,
      );

      await ui.goto('/app/payroll');
      await setVideoLabel(page, ACCOUNTING_VIDEO_COPY.teacherPayrollLabel);
      const teacherPayrollPlayback = beginNarration(
        cues,
        recordingStartedAt,
        'teacher-payroll',
        ACCOUNTING_VIDEO_COPY.teacherPayrollNarration,
        narrationDurationMap,
      );
      const previewFilterBar = page.locator('.filter-bar').first();
      await previewFilterBar.locator('select').selectOption(state.teachers[0]._id);
      const previewDates = previewFilterBar.locator('input[type="date"]');
      await previewDates.nth(0).fill(state.monthStart);
      await previewDates.nth(1).fill(state.monthEnd);
      await clickLocator(page, previewFilterBar.getByRole('button', { name: /(Xem|View)/i }));
      await expect(page.locator('.session-table')).toBeVisible();
      const previewRow = page.locator('.session-table tbody tr').first();
      await setVideoCallout(page, previewRow, ACCOUNTING_VIDEO_COPY.teacherPayrollPreviewCallout);
      await ui.pause(2_200);

      await clickLocator(page, page.locator('.tab-bar').getByRole('button', { name: /^(Bảng lương|Bang luong)$/i }).first());
      const payrollFilterBar = page.locator('.filter-bar').first();
      await payrollFilterBar.locator('select').nth(1).selectOption('DRAFT');
      await clickLocator(page, payrollFilterBar.getByRole('button', { name: /(Tìm|Tim)/i }));
      const payrollRow = page.locator('table.data-table tbody tr').filter({ hasText: 'PAY-ACC-001' }).first();
      await expect(payrollRow).toBeVisible();
      await setVideoCallout(page, payrollRow, ACCOUNTING_VIDEO_COPY.teacherPayrollDraftCallout);
      await ui.pause(1_800);
      await clickLocator(page, payrollRow.getByRole('button', { name: /(Gửi duyệt|Gui duyet)/i }));
      await expect.poll(() => state.payrollSubmitIds.length).toBe(1);
      await payrollFilterBar.locator('select').nth(1).selectOption('PENDING_REVIEW');
      await clickLocator(page, payrollFilterBar.getByRole('button', { name: /(Tìm|Tim)/i }));
      const pendingReviewRow = page.locator('table.data-table tbody tr').filter({ hasText: 'PAY-ACC-001' }).first();
      await expect(pendingReviewRow).toContainText(/(Chờ duyệt|Cho duyet)/i);
      await setVideoCallout(page, pendingReviewRow, ACCOUNTING_VIDEO_COPY.teacherPayrollPendingCallout);
      await ui.pause(2_000);
      await setVideoCallout(page, null, null);
      await waitForNarrationWindow(page, teacherPayrollPlayback);

      await presentSceneCard(
        'scene-staff-payroll',
        ACCOUNTING_VIDEO_COPY.staffPayrollSceneTitle,
        ACCOUNTING_VIDEO_COPY.staffPayrollSceneDescription,
        ACCOUNTING_VIDEO_COPY.staffPayrollSceneBullets,
        ACCOUNTING_VIDEO_COPY.staffPayrollSceneNarration,
      );

      await ui.goto('/app/staff-payroll');
      await setVideoLabel(page, ACCOUNTING_VIDEO_COPY.staffPayrollLabel);
      const staffPayrollPlayback = beginNarration(
        cues,
        recordingStartedAt,
        'staff-payroll',
        ACCOUNTING_VIDEO_COPY.staffPayrollNarration,
        narrationDurationMap,
      );
      const staffPayrollRow = page.locator('table.data tbody tr').filter({ hasText: 'SP-ACC-001' }).first();
      await expect(staffPayrollRow).toBeVisible();
      await setVideoCallout(page, staffPayrollRow, ACCOUNTING_VIDEO_COPY.staffPayrollRowCallout);
      await ui.pause(1_800);
      await clickLocator(page, staffPayrollRow);
      const staffDetailModal = page.locator('.modal.wide').filter({ hasText: /SP-ACC-001/i });
      await expect(staffDetailModal).toBeVisible();
      await clickLocator(page, staffDetailModal.getByRole('button', { name: /(Đánh dấu đã trả|Danh dau da tra)/i }));
      const markPaidModal = page.locator('.modal').filter({ hasText: /(Đánh dấu đã thanh toán|Danh dau da thanh toan)/i });
      await expect(markPaidModal).toBeVisible();
      await setVideoCallout(page, markPaidModal, ACCOUNTING_VIDEO_COPY.staffPayrollMarkPaidCallout);
      await ui.slowFill(markPaidModal.locator('input').first(), 'UNC-SP-ACC-001');
      await ui.pause(1_500);
      await clickLocator(page, markPaidModal.getByRole('button', { name: /(Xác nhận|Xac nhan)/i }));
      await expect.poll(() => state.staffPayrollPaidBodies.length).toBe(1);
      const paidPayrollRow = page.locator('table.data tbody tr').filter({ hasText: 'SP-ACC-001' }).first();
      await expect(paidPayrollRow).toContainText(/(Đã thanh toán|Da thanh toan)/i);
      await setVideoCallout(page, paidPayrollRow, ACCOUNTING_VIDEO_COPY.staffPayrollPaidCallout);
      await ui.pause(2_000);
      await setVideoCallout(page, null, null);
      await waitForNarrationWindow(page, staffPayrollPlayback);

      await presentSceneCard(
        'scene-expenses',
        ACCOUNTING_VIDEO_COPY.expensesSceneTitle,
        ACCOUNTING_VIDEO_COPY.expensesSceneDescription,
        ACCOUNTING_VIDEO_COPY.expensesSceneBullets,
        ACCOUNTING_VIDEO_COPY.expensesSceneNarration,
      );

      await ui.goto('/app/expenses');
      await setVideoLabel(page, ACCOUNTING_VIDEO_COPY.expensesLabel);
      const expensesPlayback = beginNarration(
        cues,
        recordingStartedAt,
        'expenses',
        ACCOUNTING_VIDEO_COPY.expensesNarration,
        narrationDurationMap,
      );
      const createExpenseTitle = 'Mua van phong pham cho lop moi';
      await clickLocator(page, page.getByRole('button', { name: /\+ Tạo phiếu chi/i }));
      const expenseCreateModal = page.locator('.modal').filter({ hasText: /(Tạo phiếu chi mới|Sửa phiếu chi)/i });
      await expect(expenseCreateModal).toBeVisible();
      await ui.slowFill(expenseCreateModal.locator('input[name="title"]'), createExpenseTitle);
      await ui.slowFill(expenseCreateModal.locator('textarea[name="description"]'), 'Mua but, giay kiem tra va so theo doi cho dau thang.');
      await expenseCreateModal.locator('input[name="amount"]').fill('480000');
      await expenseCreateModal.locator('input[name="expenseDate"]').fill(state.today);
      await expenseCreateModal.locator('select[name="category"]').selectOption('SUPPLIES');
      await ui.slowFill(expenseCreateModal.locator('textarea[name="notes"]'), 'Phieu chi dung de demo quy trinh ke toan.');
      await clickLocator(page, expenseCreateModal.getByRole('button', { name: /^Tạo$/i }));
      await expect.poll(() => state.expenseCreateBodies.length).toBe(1);

      const expenseRow = page.locator('table.data tbody tr').filter({ hasText: createExpenseTitle }).first();
      await expect(expenseRow).toBeVisible();
      await setVideoCallout(page, expenseRow, ACCOUNTING_VIDEO_COPY.expensesCreatedCallout);
      await ui.pause(1_800);
      await captureSingleDialog(page, async () => {
        await clickLocator(page, expenseRow.getByRole('button', { name: /(Duyệt|Duyet)/i }));
      });
      await expect.poll(() => state.expenseApprovalIds.length).toBe(1);
      const approvedExpenseRow = page.locator('table.data tbody tr').filter({ hasText: createExpenseTitle }).first();
      await expect(approvedExpenseRow).toContainText(/(Đã duyệt, chưa chi|Da duyet, chua chi)/i);
      await clickLocator(page, approvedExpenseRow.getByRole('button', { name: /(Đã chi|Danh dau da chi)/i }));
      const payExpenseModal = page.locator('.modal').filter({ hasText: /(Xác nhận đã chi tiền|Xac nhan da chi tien)/i });
      await expect(payExpenseModal).toBeVisible();
      await setVideoCallout(page, payExpenseModal, ACCOUNTING_VIDEO_COPY.expensesPayModalCallout);
      await payExpenseModal.locator('select').selectOption('BANK_TRANSFER');
      await payExpenseModal.locator('input[type="date"]').fill(state.today);
      await ui.slowFill(payExpenseModal.locator('textarea'), 'Chuyen khoan tu tai khoan ngan hang chinh.');
      await ui.pause(1_500);
      await clickLocator(page, payExpenseModal.getByRole('button', { name: /(Xác nhận|Xac nhan)/i }));
      await expect.poll(() => state.expensePaidBodies.length).toBe(1);
      const paidExpenseRow = page.locator('table.data tbody tr').filter({ hasText: createExpenseTitle }).first();
      await expect(paidExpenseRow).toContainText(/(Đã chi|Da chi)/i);
      await setVideoCallout(page, paidExpenseRow, ACCOUNTING_VIDEO_COPY.expensesPaidCallout);
      await ui.pause(2_100);
      await setVideoCallout(page, null, null);
      await waitForNarrationWindow(page, expensesPlayback);

      await presentSceneCard(
        'scene-loans',
        ACCOUNTING_VIDEO_COPY.loansSceneTitle,
        ACCOUNTING_VIDEO_COPY.loansSceneDescription,
        ACCOUNTING_VIDEO_COPY.loansSceneBullets,
        ACCOUNTING_VIDEO_COPY.loansSceneNarration,
      );

      await ui.goto('/app/loans');
      await setVideoLabel(page, ACCOUNTING_VIDEO_COPY.loansLabel);
      const loansPlayback = beginNarration(
        cues,
        recordingStartedAt,
        'loans',
        ACCOUNTING_VIDEO_COPY.loansNarration,
        narrationDurationMap,
      );
      const overdueButton = page.getByRole('button', { name: /(Cập nhật quá hạn|Cap nhat qua han)/i });
      await expect(overdueButton).toBeVisible();
      await setVideoCallout(page, overdueButton, ACCOUNTING_VIDEO_COPY.loansOverdueRunCallout);
      await ui.pause(1_700);
      await clickLocator(page, overdueButton);
      await expect.poll(() => state.loanOverdueRuns).toBe(1);

      await clickLocator(page, page.locator('.tab-bar').getByRole('button', { name: /(Danh sách|Danh sach)/i }));
      const loanRow = page.locator('table.data-table tbody tr').filter({ hasText: 'LOAN-ACC-001' }).first();
      await expect(loanRow).toBeVisible();
      await setVideoCallout(page, loanRow, ACCOUNTING_VIDEO_COPY.loansRowCallout);
      await ui.pause(1_900);
      await clickLocator(page, loanRow.getByRole('button', { name: /(Lịch trả nợ|Lich tra no)/i }));

      const overduePaymentRow = page.locator('table.data-table tbody tr').filter({ hasText: /(Quá hạn|Qua han)/i }).first();
      await expect(overduePaymentRow).toBeVisible();
      await setVideoCallout(page, overduePaymentRow, ACCOUNTING_VIDEO_COPY.loansPaymentCallout);
      await ui.pause(1_900);
      await clickLocator(page, overduePaymentRow.getByRole('button', { name: /(Ghi nhận trả|Ghi nhan tra)/i }));
      const loanPaymentModal = page.locator('.modal').filter({ hasText: /(Ghi nhận thanh toán kỳ|Ghi nhan thanh toan ky)/i });
      await expect(loanPaymentModal).toBeVisible();
      await loanPaymentModal.locator('select').selectOption('BANK_TRANSFER');
      await loanPaymentModal.locator('input[type="text"]').fill('UNC-LOAN-ACC-002');
      await ui.slowFill(loanPaymentModal.locator('textarea'), 'Thanh toan dung chung tu ngan hang ngay hom nay.');
      await clickLocator(page, loanPaymentModal.getByRole('button', { name: /(Ghi nhận thanh toán|Ghi nhan thanh toan)/i }));
      await expect.poll(() => state.loanPaymentBodies.length).toBe(1);

      await clickLocator(page, page.locator('.tab-bar').getByRole('button', { name: /(Lịch sử thanh toán|Lich su thanh toan)/i }));
      const loanHistoryRow = page.locator('table.data-table tbody tr').filter({ hasText: 'LP-ACC-002' }).first();
      await expect(loanHistoryRow).toContainText(state.user.fullName);
      await setVideoCallout(page, loanHistoryRow, ACCOUNTING_VIDEO_COPY.loansHistoryCallout);
      await ui.pause(2_100);
      await setVideoCallout(page, null, null);
      await waitForNarrationWindow(page, loansPlayback);

      await presentSceneCard(
        'scene-financial-control',
        ACCOUNTING_VIDEO_COPY.financialControlSceneTitle,
        ACCOUNTING_VIDEO_COPY.financialControlSceneDescription,
        ACCOUNTING_VIDEO_COPY.financialControlSceneBullets,
        ACCOUNTING_VIDEO_COPY.financialControlSceneNarration,
      );

      await ui.goto('/app/financial-control');
      await setVideoLabel(page, ACCOUNTING_VIDEO_COPY.financialControlLabel);
      const financialTabs = page.locator('.tab-bar button');
      const financialOverviewPlayback = beginNarration(
        cues,
        recordingStartedAt,
        'financial-overview',
        ACCOUNTING_VIDEO_COPY.financialOverviewNarration,
        narrationDurationMap,
      );
      const cashSection = page.getByText(/(TÌNH HÌNH TIỀN MẶT|Tinh hinh tien mat)/i).first();
      await expect(cashSection).toBeVisible();
      await setVideoCallout(page, cashSection, ACCOUNTING_VIDEO_COPY.financialOverviewCallout);
      await ui.pause(2_100);

      await clickLocator(page, financialTabs.nth(1));
      await expect(page.getByText(/(Lợi nhuận gộp tạm tính|Loi nhuan gop tam tinh)/i).first()).toBeVisible();
      await ui.pause(1_400);

      await clickLocator(page, financialTabs.nth(2));
      const alertCard = page.locator('.alert-card').first();
      await expect(alertCard).toBeVisible();
      await setVideoCallout(page, alertCard, ACCOUNTING_VIDEO_COPY.financialAlertCallout);
      await ui.pause(2_100);
      await setVideoCallout(page, null, null);
      await waitForNarrationWindow(page, financialOverviewPlayback);

      const bankAndFundsPlayback = beginNarration(
        cues,
        recordingStartedAt,
        'bank-and-funds',
        ACCOUNTING_VIDEO_COPY.bankAndFundsNarration,
        narrationDurationMap,
      );
      await clickLocator(page, financialTabs.nth(3));
      const bankCard = page.locator('[data-testid="bank-account-card-bank-account-accounting-001"]').first();
      await expect(bankCard).toBeVisible();
      await clickLocator(page, bankCard);
      await setVideoCallout(page, bankCard, ACCOUNTING_VIDEO_COPY.financialBankCallout);
      await ui.pause(1_800);

      await clickLocator(page, page.getByRole('button', { name: /\+ Ghi nhận giao dịch/i }));
      const bankTxModal = page.locator('.modal-backdrop .modal').last();
      await expect(bankTxModal.locator('input[name="amount"]')).toBeVisible();
      await bankTxModal.locator('select[name="type"]').selectOption('WITHDRAWAL');
      await bankTxModal.locator('select[name="category"]').selectOption('EXPENSE');
      await bankTxModal.locator('input[name="amount"]').fill('250000');
      await bankTxModal.locator('input[name="transactionDate"]').fill(state.today);
      await ui.slowFill(bankTxModal.locator('textarea[name="description"]'), 'Chi van hanh phat sinh trong ngay.');
      await ui.slowFill(bankTxModal.locator('input[name="reference"]'), 'BTX-DEMO-002');
      await clickLocator(page, bankTxModal.locator('button[type="submit"]'));
      await expect.poll(() => state.bankTransactionBodies.length).toBe(1);

      const unreconciledRow = page.locator('table.data tbody tr').filter({ hasText: 'BTX-ACC-003' }).first();
      await expect(unreconciledRow).toBeVisible();
      await setVideoCallout(page, unreconciledRow, ACCOUNTING_VIDEO_COPY.financialUnreconciledCallout);
      await ui.pause(1_900);
      await captureSingleDialog(page, async () => {
        await clickLocator(page, unreconciledRow.getByRole('button', { name: /(Đối soát|Doi soat)/i }));
      });
      await expect.poll(() => state.reconciledBankTransactionIds.length).toBe(1);

      await clickLocator(page, financialTabs.nth(4));
      const marketingFundCard = page.locator('[data-testid="fund-card-fund-accounting-marketing"]').first();
      await expect(marketingFundCard).toBeVisible();
      await clickLocator(page, marketingFundCard);
      await setVideoCallout(page, marketingFundCard, ACCOUNTING_VIDEO_COPY.financialFundCallout);
      await ui.pause(1_800);
      await clickLocator(page, page.getByRole('button', { name: /(\+ Nạp\/Rút quỹ|\+ Nap\/Rut quy)/i }));
      const fundTxModal = page.locator('.modal-backdrop .modal').last();
      await expect(fundTxModal.locator('input[name="amount"]')).toBeVisible();
      await fundTxModal.locator('select[name="type"]').selectOption('DEPOSIT');
      await fundTxModal.locator('input[name="amount"]').fill('2000000');
      await fundTxModal.locator('input[name="transactionDate"]').fill(state.today);
      await ui.slowFill(fundTxModal.locator('textarea[name="description"]'), 'Bo sung ngan sach marketing giua thang.');
      await ui.slowFill(fundTxModal.locator('input[name="reference"]'), 'FUND-DEMO-001');
      await clickLocator(page, fundTxModal.locator('button[type="submit"]'));
      await expect.poll(() => state.fundTransactionBodies.length).toBe(1);
      await ui.pause(1_500);

      await clickLocator(page, financialTabs.nth(5));
      await expect(page.getByText(/(Tổng dòng tiền vào|Tong dong tien vao)/i).first()).toBeVisible();
      await ui.pause(1_300);

      await clickLocator(page, financialTabs.nth(6));
      await expect(page.getByText(/P&L Report/i)).toBeVisible();
      await page.locator('select').last().selectOption('accrual');
      await ui.pause(1_300);

      await clickLocator(page, financialTabs.nth(7));
      const reconCard = page.getByText(/(Chưa đối soát|Chua doi soat)/i).first();
      await expect(reconCard).toBeVisible();
      await setVideoCallout(page, reconCard, ACCOUNTING_VIDEO_COPY.financialReconciliationCallout);
      await ui.pause(2_200);
      await setVideoCallout(page, null, null);
      await waitForNarrationWindow(page, bankAndFundsPlayback);

      await presentSceneCard(
        'scene-exports',
        ACCOUNTING_VIDEO_COPY.exportsSceneTitle,
        ACCOUNTING_VIDEO_COPY.exportsSceneDescription,
        ACCOUNTING_VIDEO_COPY.exportsSceneBullets,
        ACCOUNTING_VIDEO_COPY.exportsSceneNarration,
      );

      await ui.goto('/app/export-reports');
      await setVideoLabel(page, ACCOUNTING_VIDEO_COPY.exportsLabel);
      const exportsPlayback = beginNarration(
        cues,
        recordingStartedAt,
        'exports',
        ACCOUNTING_VIDEO_COPY.exportsNarration,
        narrationDurationMap,
      );
      const payrollCard = page.locator('.export-card').filter({ hasText: /(Bảng lương|Bang luong)/i }).first();
      await payrollCard.locator('input[type="date"]').nth(0).fill(state.monthStart);
      await payrollCard.locator('input[type="date"]').nth(1).fill(state.monthEnd);
      await clickLocator(page, payrollCard.getByRole('button', { name: /(Xuất CSV|Xuat CSV)/i }));
      await expect.poll(() => state.exportCalls.length).toBe(1);
      await expect(page.locator('.message')).toContainText(/(thành công|thanh cong)/i);

      const financialCard = page.locator('.export-card').filter({ hasText: /(Tài chính|Tai chinh)/i }).first();
      await financialCard.locator('input[type="date"]').nth(0).fill(state.monthStart);
      await financialCard.locator('input[type="date"]').nth(1).fill(state.monthEnd);
      await setVideoCallout(page, financialCard, ACCOUNTING_VIDEO_COPY.exportsCardCallout);
      await ui.pause(1_600);
      await clickLocator(page, financialCard.getByRole('button', { name: /(Xuất CSV|Xuat CSV)/i }));
      await expect.poll(() => state.exportCalls.length).toBe(2);
      await ui.pause(1_900);
      await setVideoCallout(page, null, null);
      await waitForNarrationWindow(page, exportsPlayback);

      await presentSceneCard(
        'scene-logout',
        ACCOUNTING_VIDEO_COPY.logoutSceneTitle,
        ACCOUNTING_VIDEO_COPY.logoutSceneDescription,
        ACCOUNTING_VIDEO_COPY.logoutSceneBullets,
        ACCOUNTING_VIDEO_COPY.logoutSceneNarration,
      );

      await ui.goto('/app/dashboard');
      await setVideoLabel(page, ACCOUNTING_VIDEO_COPY.logoutLabel);
      const logoutPlayback = beginNarration(
        cues,
        recordingStartedAt,
        'logout',
        ACCOUNTING_VIDEO_COPY.logoutNarration,
        narrationDurationMap,
      );
      const logoutButton = page.locator('aside .logout');
      await expect(logoutButton).toBeVisible();
      await setVideoCallout(page, logoutButton, ACCOUNTING_VIDEO_COPY.logoutCallout);
      await ui.pause(1_700);
      await clickLocator(page, logoutButton);
      await expect(page).toHaveURL(/\/login/);
      await expect(page.getByTestId('login-form')).toBeVisible();
      await ui.pause(2_000);
      await setVideoCallout(page, null, null);
      await waitForNarrationWindow(page, logoutPlayback);

      await setVideoLabel(page, null);
      await setVideoCallout(page, null, null);
      const outroPlayback = beginNarration(
        cues,
        recordingStartedAt,
        'outro',
        ACCOUNTING_VIDEO_COPY.outroNarration,
        narrationDurationMap,
      );
      await showTitleCard(
        page,
        ACCOUNTING_VIDEO_COPY.outroTitle,
        ACCOUNTING_VIDEO_COPY.outroDescription,
        [...ACCOUNTING_VIDEO_COPY.outroBullets],
      );
      await waitForNarrationWindow(page, outroPlayback, 4_600);

      await writeNarrationArtifacts(artifactDir, cues);
    } finally {
      savedVideoPath = await saveRecordedVideo(page, context);
    }

    expect(savedVideoPath).toBeTruthy();
  });
});

type NarrationCue = {
  id: string;
  atMs: number;
  section: string;
  text: string;
};

type NarrationPlayback = {
  startedAt: number;
  targetMs: number;
};

const NARRATION_FALLBACK_WORD_MS = 440;
const NARRATION_FALLBACK_BASE_MS = 1_300;
const NARRATION_FINISH_BUFFER_MS = 350;

async function ensureEvidenceDirs(): Promise<void> {
  await mkdir(VIDEO_DIR, { recursive: true });
  await mkdir(RAW_VIDEO_DIR, { recursive: true });
  await mkdir(META_DIR, { recursive: true });
}

async function saveRecordedVideo(page: Page, context: BrowserContext): Promise<string | null> {
  const recordedVideo = page.video();
  if (!recordedVideo) {
    await context.close();
    return null;
  }

  await ensureEvidenceDirs();
  await context.close();
  const rawVideoPath = await recordedVideo.path();
  const finalVideoPath = path.join(VIDEO_DIR, `${FINAL_VIDEO_BASENAME}.webm`);
  await rm(finalVideoPath, { force: true });
  await rename(rawVideoPath, finalVideoPath);
  return finalVideoPath;
}

function pushNarrationCue(
  cues: NarrationCue[],
  recordingStartedAt: number,
  section: string,
  text: string,
): void {
  cues.push({
    id: `cue-${String(cues.length + 1).padStart(2, '0')}`,
    atMs: Math.max(0, Date.now() - recordingStartedAt),
    section,
    text,
  });
}

function formatCueTimestamp(atMs: number): string {
  const totalSeconds = Math.floor(atMs / 1000);
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

async function writeNarrationArtifacts(artifactDir: string, cues: NarrationCue[]): Promise<void> {
  await writeFile(
    path.join(artifactDir, 'narration-cues.json'),
    `${JSON.stringify(cues, null, 2)}\n`,
    'utf8',
  );

  const lines = [
    '# Accounting Full Workflow Narration',
    '',
    'Danh sach cue de render long tieng cho video ke toan.',
    '',
    '| Cue | Time | Section | Text |',
    '| --- | --- | --- | --- |',
    ...cues.map((cue) => `| ${cue.id} | ${formatCueTimestamp(cue.atMs)} | ${cue.section} | ${cue.text} |`),
    '',
  ];

  await writeFile(path.join(artifactDir, 'narration-script.md'), lines.join('\n'), 'utf8');
}

function estimateNarrationDurationMs(text: string): number {
  const wordCount = String(text || '').trim().split(/\s+/).filter(Boolean).length;
  return Math.max(2_400, wordCount * NARRATION_FALLBACK_WORD_MS + NARRATION_FALLBACK_BASE_MS);
}

async function buildNarrationDurationMap(texts: string[]): Promise<Map<string, number>> {
  const uniqueTexts = [...new Set(texts.filter(Boolean))];
  return new Map(uniqueTexts.map((text) => [text, estimateNarrationDurationMs(text)]));
}

function beginNarration(
  cues: NarrationCue[],
  recordingStartedAt: number,
  section: string,
  text: string,
  durationMap: Map<string, number>,
): NarrationPlayback {
  pushNarrationCue(cues, recordingStartedAt, section, text);
  return {
    startedAt: Date.now(),
    targetMs: durationMap.get(text) ?? estimateNarrationDurationMs(text),
  };
}

async function waitForNarrationWindow(
  page: Page,
  playback: NarrationPlayback,
  minimumMs = 0,
  extraBufferMs = NARRATION_FINISH_BUFFER_MS,
): Promise<void> {
  const elapsedMs = Date.now() - playback.startedAt;
  const targetMs = Math.max(minimumMs, playback.targetMs + extraBufferMs);
  const remainingMs = targetMs - elapsedMs;

  if (remainingMs > 0) {
    await page.waitForTimeout(remainingMs);
  }
}

function appUrl(path: string): string {
  return new URL(path, APP_BASE_URL).toString();
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function formatLocalDateInput(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function toIso(dateText: string, timeText: string): string {
  return new Date(`${dateText}T${timeText}:00`).toISOString();
}

function dataUrlPng(): string {
  return `data:image/png;base64,${TINY_PNG_BASE64}`;
}

async function jsonResponse(route: Route, body: unknown, status = 200): Promise<void> {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

async function captureSingleDialog(page: Page, action: () => Promise<void>): Promise<string> {
  const messages: string[] = [];
  const handler = async (dialog: { message: () => string; accept: () => Promise<void> }) => {
    messages.push(dialog.message());
    await dialog.accept();
  };

  page.on('dialog', handler);

  try {
    await action();
    await expect.poll(() => messages.length).toBe(1);
    await page.waitForTimeout(150);
    return messages[0];
  } finally {
    page.off('dialog', handler);
  }
}

async function installVideoOverlay(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const CURSOR_ID = '__codex_video_cursor';
    const LABEL_ID = '__codex_video_label';
    const CALLOUT_ID = '__codex_video_callout';
    const CALLOUT_TEXT_ID = '__codex_video_callout_text';

    const ensureOverlay = () => {
      if (!document.body) return;

      let cursor = document.getElementById(CURSOR_ID) as HTMLDivElement | null;
      if (!cursor) {
        cursor = document.createElement('div');
        cursor.id = CURSOR_ID;
        cursor.style.position = 'fixed';
        cursor.style.left = '0';
        cursor.style.top = '0';
        cursor.style.width = '26px';
        cursor.style.height = '26px';
        cursor.style.borderRadius = '999px';
        cursor.style.border = '3px solid rgba(14, 165, 233, 0.92)';
        cursor.style.background = 'rgba(255,255,255,0.78)';
        cursor.style.boxShadow = '0 10px 28px rgba(14, 165, 233, 0.35)';
        cursor.style.pointerEvents = 'none';
        cursor.style.zIndex = '2147483647';
        cursor.style.transform = 'translate(-999px, -999px)';
        cursor.style.transition = 'transform 60ms linear, width 100ms ease, height 100ms ease, border-color 100ms ease';
        document.body.appendChild(cursor);
      }

      let label = document.getElementById(LABEL_ID) as HTMLDivElement | null;
      if (!label) {
        label = document.createElement('div');
        label.id = LABEL_ID;
        label.style.position = 'fixed';
        label.style.left = '20px';
        label.style.bottom = '20px';
        label.style.maxWidth = '860px';
        label.style.padding = '12px 16px';
        label.style.borderRadius = '14px';
        label.style.background = 'rgba(15, 23, 42, 0.84)';
        label.style.color = '#e2e8f0';
        label.style.font = '600 15px/1.55 "Segoe UI", system-ui, sans-serif';
        label.style.boxShadow = '0 20px 44px rgba(15, 23, 42, 0.28)';
        label.style.pointerEvents = 'none';
        label.style.zIndex = '2147483646';
        label.style.opacity = '0';
        label.style.transition = 'opacity 150ms ease';
        document.body.appendChild(label);
      }

      let callout = document.getElementById(CALLOUT_ID) as HTMLDivElement | null;
      if (!callout) {
        callout = document.createElement('div');
        callout.id = CALLOUT_ID;
        callout.style.position = 'fixed';
        callout.style.left = '0';
        callout.style.top = '0';
        callout.style.width = '0';
        callout.style.height = '0';
        callout.style.border = '4px solid rgba(239, 68, 68, 0.96)';
        callout.style.borderRadius = '18px';
        callout.style.boxShadow = '0 0 0 9999px rgba(15, 23, 42, 0.10), 0 0 0 4px rgba(255,255,255,0.20), 0 18px 44px rgba(239, 68, 68, 0.25)';
        callout.style.pointerEvents = 'none';
        callout.style.zIndex = '2147483645';
        callout.style.opacity = '0';
        callout.style.transition = 'opacity 140ms ease, left 180ms ease, top 180ms ease, width 180ms ease, height 180ms ease';
        document.body.appendChild(callout);
      }

      let calloutText = document.getElementById(CALLOUT_TEXT_ID) as HTMLDivElement | null;
      if (!calloutText) {
        calloutText = document.createElement('div');
        calloutText.id = CALLOUT_TEXT_ID;
        calloutText.style.position = 'fixed';
        calloutText.style.left = '0';
        calloutText.style.top = '0';
        calloutText.style.maxWidth = '380px';
        calloutText.style.padding = '10px 14px';
        calloutText.style.borderRadius = '14px';
        calloutText.style.background = 'rgba(220, 38, 38, 0.95)';
        calloutText.style.color = '#fff';
        calloutText.style.font = '700 14px/1.45 "Segoe UI", system-ui, sans-serif';
        calloutText.style.boxShadow = '0 18px 36px rgba(127, 29, 29, 0.35)';
        calloutText.style.pointerEvents = 'none';
        calloutText.style.zIndex = '2147483646';
        calloutText.style.opacity = '0';
        calloutText.style.transition = 'opacity 140ms ease, left 180ms ease, top 180ms ease';
        document.body.appendChild(calloutText);
      }

      window.addEventListener('mousemove', (event) => {
        cursor!.style.transform = `translate(${Math.round(event.clientX - 13)}px, ${Math.round(event.clientY - 13)}px)`;
      }, { passive: true });

      document.addEventListener('mousedown', () => {
        cursor!.style.width = '20px';
        cursor!.style.height = '20px';
        cursor!.style.borderColor = 'rgba(249, 115, 22, 0.95)';
      });

      document.addEventListener('mouseup', () => {
        cursor!.style.width = '26px';
        cursor!.style.height = '26px';
        cursor!.style.borderColor = 'rgba(14, 165, 233, 0.92)';
      });

      (window as any).__codexVideoLabel = (message: string | null) => {
        if (!label) return;
        if (!message) {
          label.style.opacity = '0';
          label.textContent = '';
          return;
        }
        label.textContent = message;
        label.style.opacity = '1';
      };

      (window as any).__codexVideoCallout = (
        rect: { x: number; y: number; width: number; height: number } | null,
        message: string | null,
      ) => {
        if (!callout || !calloutText) return;
        if (!rect || !message) {
          callout.style.opacity = '0';
          calloutText.style.opacity = '0';
          calloutText.textContent = '';
          return;
        }

        const padding = 10;
        const x = Math.max(8, rect.x - padding);
        const y = Math.max(8, rect.y - padding);
        const width = Math.max(60, rect.width + padding * 2);
        const height = Math.max(40, rect.height + padding * 2);
        callout.style.left = `${Math.round(x)}px`;
        callout.style.top = `${Math.round(y)}px`;
        callout.style.width = `${Math.round(width)}px`;
        callout.style.height = `${Math.round(height)}px`;
        callout.style.opacity = '1';

        const maxLeft = Math.max(12, window.innerWidth - 390);
        const textLeft = Math.min(maxLeft, Math.max(12, x));
        const preferredTop = y - 62;
        const textTop = preferredTop > 12 ? preferredTop : Math.min(window.innerHeight - 80, y + height + 12);
        calloutText.textContent = message;
        calloutText.style.left = `${Math.round(textLeft)}px`;
        calloutText.style.top = `${Math.round(textTop)}px`;
        calloutText.style.opacity = '1';
      };
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', ensureOverlay, { once: true });
    } else {
      ensureOverlay();
    }
  });
}

async function setVideoLabel(page: Page, message: string | null): Promise<void> {
  await page.evaluate((value) => {
    const fn = (window as any).__codexVideoLabel as ((msg: string | null) => void) | undefined;
    fn?.(value);
  }, message);
}

async function setVideoCallout(
  page: Page,
  locator: Locator | null,
  message: string | null,
): Promise<void> {
  let rect: { x: number; y: number; width: number; height: number } | null = null;
  if (locator) {
    const box = await locator.boundingBox();
    if (box) {
      rect = {
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
      };
    }
  }

  await page.evaluate(({ nextRect, nextMessage }) => {
    const fn = (window as any).__codexVideoCallout as ((
      value: { x: number; y: number; width: number; height: number } | null,
      text: string | null,
    ) => void) | undefined;
    fn?.(nextRect, nextMessage);
  }, { nextRect: rect, nextMessage: message });
}

async function showTitleCard(page: Page, title: string, subtitle: string, bullets: string[]): Promise<void> {
  await page.setContent(`
    <style>
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background:
          radial-gradient(circle at top left, rgba(249,115,22,.20), transparent 36%),
          radial-gradient(circle at bottom right, rgba(220,38,38,.22), transparent 42%),
          linear-gradient(135deg, #020617 0%, #0f172a 45%, #1f2937 100%);
        color: #e2e8f0;
        font-family: "Segoe UI", system-ui, sans-serif;
      }
      .card {
        width: min(1080px, calc(100vw - 80px));
        border: 1px solid rgba(148,163,184,.24);
        border-radius: 28px;
        padding: 42px 46px;
        background: rgba(15,23,42,.72);
        box-shadow: 0 24px 80px rgba(2,6,23,.45);
        backdrop-filter: blur(14px);
      }
      .eyebrow {
        display: inline-flex;
        padding: 8px 14px;
        border-radius: 999px;
        background: rgba(249,115,22,.16);
        color: #fdba74;
        font-size: 14px;
        letter-spacing: .08em;
        text-transform: uppercase;
        font-weight: 700;
      }
      h1 {
        margin: 20px 0 12px;
        font-size: 42px;
        line-height: 1.08;
      }
      p {
        margin: 0 0 18px;
        color: #cbd5e1;
        font-size: 20px;
        line-height: 1.55;
      }
      ul {
        margin: 0;
        padding-left: 22px;
        display: grid;
        gap: 10px;
        color: #f8fafc;
        font-size: 18px;
      }
      li::marker {
        color: #fb7185;
      }
    </style>
    <div class="card">
      <div class="eyebrow">Accounting Recorder</div>
      <h1>${title}</h1>
      <p>${subtitle}</p>
      <ul>${bullets.map((item) => `<li>${item}</li>`).join('')}</ul>
    </div>
  `);
  await page.waitForTimeout(1800);
}

async function showWorkflowRoadmapCard(
  page: Page,
  title: string,
  subtitle: string,
  steps: readonly string[],
  activeIndex: number | null = null,
): Promise<void> {
  await page.setContent(`
    <style>
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        font-family: "Segoe UI", system-ui, sans-serif;
        background:
          radial-gradient(circle at top left, rgba(20, 184, 166, 0.18), transparent 28%),
          radial-gradient(circle at bottom right, rgba(249, 115, 22, 0.18), transparent 28%),
          linear-gradient(135deg, #0f172a 0%, #111827 48%, #1f2937 100%);
        color: #e2e8f0;
      }
      .shell {
        width: min(1280px, calc(100vw - 72px));
        padding: 34px 38px 40px;
        border-radius: 30px;
        background: rgba(15, 23, 42, 0.72);
        border: 1px solid rgba(148, 163, 184, 0.18);
        box-shadow: 0 34px 90px rgba(15, 23, 42, 0.36);
        backdrop-filter: blur(16px);
      }
      .eyebrow {
        margin: 0 0 12px;
        color: #99f6e4;
        font-size: 12px;
        font-weight: 800;
        letter-spacing: 0.18em;
        text-transform: uppercase;
      }
      h1 {
        margin: 0;
        font-size: 42px;
        line-height: 1.08;
        letter-spacing: -0.04em;
        color: #f8fafc;
      }
      .subtitle {
        margin: 16px 0 0;
        max-width: 980px;
        font-size: 17px;
        line-height: 1.6;
        color: rgba(226, 232, 240, 0.92);
      }
      .roadmap {
        margin-top: 30px;
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 16px;
      }
      .step {
        min-height: 124px;
        padding: 18px;
        border-radius: 22px;
        background: rgba(30, 41, 59, 0.78);
        border: 1px solid rgba(148, 163, 184, 0.14);
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.04);
      }
      .step.active {
        background: linear-gradient(135deg, rgba(20, 184, 166, 0.26), rgba(249, 115, 22, 0.18));
        border-color: rgba(45, 212, 191, 0.62);
        box-shadow: 0 20px 44px rgba(20, 184, 166, 0.14);
      }
      .step-num {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 38px;
        height: 38px;
        border-radius: 999px;
        background: rgba(148, 163, 184, 0.16);
        color: #f8fafc;
        font-size: 14px;
        font-weight: 800;
      }
      .step.active .step-num {
        background: rgba(255, 255, 255, 0.18);
      }
      .step-title {
        margin: 16px 0 0;
        font-size: 18px;
        line-height: 1.35;
        font-weight: 700;
        color: #f8fafc;
      }
      .step-copy {
        margin-top: 10px;
        font-size: 13px;
        line-height: 1.55;
        color: rgba(226, 232, 240, 0.76);
      }
      .legend {
        margin-top: 18px;
        font-size: 13px;
        line-height: 1.55;
        color: rgba(226, 232, 240, 0.78);
      }
    </style>
    <section class="shell">
      <p class="eyebrow">Accounting Journey</p>
      <h1>${title}</h1>
      <p class="subtitle">${subtitle}</p>
      <div class="roadmap">
        ${steps
          .map(
            (step, index) => `
              <article class="step ${activeIndex === index ? 'active' : ''}">
                <span class="step-num">${String(index + 1).padStart(2, '0')}</span>
                <h2 class="step-title">${step}</h2>
                <p class="step-copy">Chặng ${index + 1} trong hành trình vận hành nghiệp vụ kế toán.</p>
              </article>
            `,
          )
          .join('')}
      </div>
      <p class="legend">
        ${activeIndex === null
          ? 'Màn hình này dùng để giới thiệu toàn bộ roadmap kế toán trước khi đi vào từng chặng thao tác.'
          : `Chúng ta đang đi vào chặng ${activeIndex + 1} của luồng kế toán.`}
      </p>
    </section>
  `);
  await page.waitForTimeout(1800);
}

function collectNarrationTexts(copy: typeof ACCOUNTING_VIDEO_COPY): string[] {
  return [
    copy.introNarration,
    copy.roadmapNarration,
    copy.dashboardSceneNarration,
    copy.dashboardNarration,
    copy.walletsSceneNarration,
    copy.walletsNarration,
    copy.invoicesSceneNarration,
    copy.invoicesNarration,
    copy.teacherPayrollSceneNarration,
    copy.teacherPayrollNarration,
    copy.staffPayrollSceneNarration,
    copy.staffPayrollNarration,
    copy.expensesSceneNarration,
    copy.expensesNarration,
    copy.loansSceneNarration,
    copy.loansNarration,
    copy.financialControlSceneNarration,
    copy.financialOverviewNarration,
    copy.bankAndFundsNarration,
    copy.exportsSceneNarration,
    copy.exportsNarration,
    copy.logoutSceneNarration,
    copy.logoutNarration,
    copy.outroNarration,
  ];
}

async function clickLocator(page: Page, locator: Locator): Promise<void> {
  await expect(locator).toBeVisible({ timeout: 20_000 });
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if (!box) {
    throw new Error('Could not calculate locator position for click.');
  }

  await page.mouse.move(box.x + (box.width / 2), box.y + (box.height / 2), { steps: 18 });
  await page.waitForTimeout(100);
  await page.mouse.down();
  await page.waitForTimeout(60);
  await page.mouse.up();
  await page.waitForTimeout(160);
}

type AccountingUserFixture = {
  _id: string;
  sub: string;
  email: string;
  role: 'ACCOUNTING';
  fullName: string;
  userCode: string;
};

type ParentUserFixture = {
  _id: string;
  fullName: string;
  email: string;
  phone: string;
  role: 'PARENT';
};

type SaleUserFixture = {
  _id: string;
  fullName: string;
  email: string;
  role: 'SALE';
};

type TeacherFixture = {
  _id: string;
  fullName: string;
  email: string;
  role: 'TEACHER';
  userCode: string;
};

type StudentFixture = {
  _id: string;
  studentCode: string;
  fullName: string;
  age: number;
  parentName: string;
  parentPhone: string;
  parentUserId: string;
  faceImage: string;
};

type ClassFixture = {
  _id: string;
  name: string;
  code: string;
  classMode: 'ONLINE' | 'OFFLINE';
  students: Array<{ _id: string; fullName: string; studentCode: string }>;
};

type WalletFixture = {
  _id: string;
  userId: ParentUserFixture;
  balance: number;
  totalTopUp: number;
  totalDeducted: number;
  totalRefunded: number;
  status: 'ACTIVE';
  lastTransactionAt: string;
  adGroupId?: string;
  adGroupName?: string;
  adPlatform?: string;
  adAttributionSource?: 'PARENT_ATTRIBUTION' | null;
};

type PendingTopUpFixture = {
  _id: string;
  walletId: string;
  userId: ParentUserFixture;
  amount: number;
  paymentMethod: 'BANK_TRANSFER';
  transactionRef: string;
  receiptImageUrl: string;
  description: string;
  createdAt: string;
};

type LedgerFixture = {
  _id: string;
  walletId: string;
  userId: string;
  type: 'TOP_UP' | 'SESSION_DEDUCT' | 'ADJUSTMENT';
  status: 'COMPLETED';
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  description: string;
  adjustmentReason?: string;
  createdAt: string;
};

type InvoiceFixture = {
  _id: string;
  invoiceNumber: string;
  studentId: {
    _id: string;
    fullName: string;
    parentName: string;
    parentPhone: string;
    studentCode: string;
  };
  classType: 'ONLINE' | 'OFFLINE';
  saleId: {
    _id: string;
    fullName: string;
    email: string;
  };
  sessions: number;
  bonusSessions: number;
  trialSessions: number;
  paymentRound: number;
  courseStatus: 'NEW';
  amount: number;
  paymentDate: string;
  receiptImage: string;
  approvalImage?: string;
  description: string;
  classId: {
    _id: string;
    name: string;
    code: string;
  };
  status: 'PENDING_APPROVAL' | 'APPROVED';
  createdBy: {
    _id: string;
    fullName: string;
    email: string;
  };
  createdAt: string;
  updatedAt: string;
};

type PayrollPreviewSessionFixture = {
  _id: string;
  classId: {
    _id: string;
    name: string;
    code: string;
    classMode?: 'ONLINE' | 'OFFLINE';
  };
  studentId: {
    _id: string;
    fullName: string;
    studentCode: string;
  };
  scheduledDate: string;
  durationMinutes: number;
  teacherPayout: number;
  penaltyAmount?: number;
  finalPayout?: number;
  status: string;
  hasTeachingReport: boolean;
  isTeacherPaid: boolean;
  isPaid: boolean;
  payrollStatus: 'PAID' | 'ELIGIBLE' | 'BLOCKED_NO_REPORT' | 'WAITING_PARENT' | 'WAITING_FINALIZE';
  teachingReport?: {
    submittedAt?: string;
    isLateSubmission?: boolean;
  } | null;
};

type PayrollFixture = {
  _id: string;
  teacherId: {
    _id: string;
    fullName: string;
    email: string;
    phone?: string;
  };
  periodStart: string;
  periodEnd: string;
  payrollCode: string;
  totalSessions: number;
  grossAmount: number;
  adjustmentAmount: number;
  bonusAmount: number;
  deductionAmount: number;
  netAmount: number;
  status: 'DRAFT' | 'PENDING_REVIEW';
  createdBy: {
    _id: string;
    fullName: string;
  };
  notes?: string;
};

type PayrollItemDetailFixture = {
  _id: string;
  payrollId: string;
  sessionId: { _id: string; scheduledDate: string; status: string };
  classId: { _id: string; name: string; code: string };
  studentId: { _id: string; fullName: string; studentCode: string };
  sessionDate: string;
  teacherPayout: number;
  adjustedPayout: number;
  status: 'ELIGIBLE';
};

type BankAccountFixture = {
  _id: string;
  accountCode: string;
  bankName: string;
  accountNumber: string;
  accountHolder?: string;
  branch?: string;
  currentBalance: number;
  openingBalance: number;
  status: 'ACTIVE' | 'INACTIVE';
  description?: string;
  isPrimary?: boolean;
  createdByName?: string;
  createdAt: string;
};

type BankTransactionFixture = {
  _id: string;
  transactionCode: string;
  bankAccountId: string;
  type: 'DEPOSIT' | 'WITHDRAWAL' | 'TRANSFER_IN' | 'TRANSFER_OUT' | 'INTEREST' | 'FEE' | 'ADJUSTMENT';
  category: string;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  transactionDate: string;
  description?: string;
  reference?: string;
  recordedByName: string;
  isReconciled?: boolean;
  createdAt: string;
};

type FundFixture = {
  _id: string;
  fundCode: string;
  name: string;
  fundType: 'RESERVE' | 'PETTY_CASH' | 'MARKETING' | 'TRAINING' | 'BONUS' | 'OTHER';
  currentBalance: number;
  minimumBalance: number;
  targetBalance: number;
  status: 'ACTIVE' | 'INACTIVE';
  description?: string;
  totalDeposited: number;
  totalWithdrawn: number;
  createdByName?: string;
  createdAt: string;
};

type FundTransactionFixture = {
  _id: string;
  transactionCode: string;
  fundId: string;
  type: 'DEPOSIT' | 'WITHDRAW' | 'ADJUSTMENT';
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  transactionDate: string;
  description?: string;
  reference?: string;
  performedByName: string;
  createdAt: string;
};

type StaffPayrollFixture = {
  _id: string;
  payrollCode: string;
  userId: string;
  userName: string;
  role: 'DIRECTOR' | 'ACCOUNTING' | 'OPS' | 'ADSMANAGER' | 'TEACHER' | 'SALES' | 'STAFF';
  periodStart: string;
  periodEnd: string;
  baseSalary: number;
  actualHours: number;
  standardHours: number;
  attendanceRatio: number;
  baseSalaryAmount: number;
  totalRevenue: number;
  commissionType?: string;
  commissionTiers?: Array<{ from: number; to?: number; rate: number }>;
  commissionAmount: number;
  kpiScore: number;
  kpiBonusTiers?: Array<{ minScore: number; maxScore?: number; bonusPercentage: number }>;
  kpiBonusPercentage: number;
  kpiBonusAmount: number;
  lateDays: number;
  latePenaltyPerTime: number;
  latePenaltyAmount: number;
  bonusAmount: number;
  deductionAmount: number;
  netAmount: number;
  status: 'DRAFT' | 'PENDING_REVIEW' | 'APPROVED' | 'PAID' | 'REJECTED';
  notes?: string;
  rejectionReason?: string;
  paymentRef?: string;
  createdAt: string;
  updatedAt: string;
};

type ExpenseFixture = {
  _id: string;
  expenseCode: string;
  title: string;
  description?: string;
  amount: number;
  expenseDate: string;
  category: string;
  paymentStatus: 'PENDING_APPROVAL' | 'APPROVED_UNPAID' | 'PAID' | 'REJECTED';
  createdById: string;
  createdByName: string;
  approvedById?: string;
  approvedByName?: string;
  approvedAt?: string;
  rejectionReason?: string;
  paidById?: string;
  paidByName?: string;
  paidAt?: string;
  paymentMethod?: string;
  receiptUrl?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

type LoanFixture = {
  _id: string;
  loanCode: string;
  lenderName: string;
  lenderType: 'BANK' | 'INDIVIDUAL' | 'ORGANIZATION' | 'OTHER';
  loanType: 'WORKING_CAPITAL' | 'EQUIPMENT' | 'RENOVATION' | 'EXPANSION' | 'OTHER';
  principal: number;
  interestRate: number;
  interestType: 'FIXED' | 'FLOATING';
  term: number;
  startDate: string;
  endDate: string;
  paymentFrequency: 'MONTHLY' | 'QUARTERLY' | 'SEMI_ANNUALLY' | 'ANNUALLY';
  status: 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'DEFAULTED' | 'RESTRUCTURED';
  bankAccountId?: string;
  totalPaid: number;
  remainingBalance: number;
  collateral?: string;
  notes?: string;
  createdByName: string;
  approvedByName?: string;
  approvedAt?: string;
  createdAt: string;
};

type LoanPaymentFixture = {
  _id: string;
  paymentCode: string;
  loanId: string;
  paymentNumber: number;
  dueDate: string;
  paidDate?: string;
  principalAmount: number;
  interestAmount: number;
  totalAmount: number;
  status: 'SCHEDULED' | 'PAID' | 'OVERDUE' | 'PARTIAL';
  paymentMethod?: string;
  reference?: string;
  notes?: string;
  paidByName?: string;
  createdAt: string;
};

type ExportCallFixture = {
  endpoint: string;
  query: Record<string, string>;
};

type WorkflowState = {
  today: string;
  monthStart: string;
  monthEnd: string;
  user: AccountingUserFixture;
  parent: ParentUserFixture;
  sales: SaleUserFixture[];
  teachers: TeacherFixture[];
  students: StudentFixture[];
  classes: ClassFixture[];
  wallets: WalletFixture[];
  pendingTopUps: PendingTopUpFixture[];
  ledgerEntries: LedgerFixture[];
  invoices: InvoiceFixture[];
  payrollPreviewSessions: PayrollPreviewSessionFixture[];
  payrolls: PayrollFixture[];
  payrollItemsById: Record<string, PayrollItemDetailFixture[]>;
  bankAccounts: BankAccountFixture[];
  bankTransactions: BankTransactionFixture[];
  funds: FundFixture[];
  fundTransactions: FundTransactionFixture[];
  staffPayrolls: StaffPayrollFixture[];
  expenseItems: ExpenseFixture[];
  loanItems: LoanFixture[];
  loanPayments: LoanPaymentFixture[];
  loginBodies: Array<{ email: string; password: string }>;
  topUpApprovalBodies: Array<{ topUpId: string; payload: Record<string, unknown> }>;
  invoiceApprovalBodies: Array<{ invoiceId: string; payload: Record<string, unknown> }>;
  payrollSubmitIds: string[];
  adjustBodies: Array<Record<string, unknown>>;
  bankTransactionBodies: Array<Record<string, unknown>>;
  reconciledBankTransactionIds: string[];
  fundTransactionBodies: Array<Record<string, unknown>>;
  staffPayrollPaidBodies: Array<{ payrollId: string; paymentRef?: string }>;
  expenseCreateBodies: Array<Record<string, unknown>>;
  expenseApprovalIds: string[];
  expensePaidBodies: Array<{ expenseId: string; payload: Record<string, unknown> }>;
  loanPaymentBodies: Array<Record<string, unknown>>;
  loanOverdueRuns: number;
  exportCalls: ExportCallFixture[];
};

function buildAccountingWorkflowState(): WorkflowState {
  const now = new Date();
  const today = formatLocalDateInput(now);
  const monthStart = formatLocalDateInput(new Date(now.getFullYear(), now.getMonth(), 1));
  const monthEnd = formatLocalDateInput(new Date(now.getFullYear(), now.getMonth() + 1, 0));
  const proofImage = dataUrlPng();

  const user: AccountingUserFixture = {
    _id: 'accounting-demo-001',
    sub: 'accounting-demo-001',
    email: 'accounting.demo@school.local',
    role: 'ACCOUNTING',
    fullName: 'Ke Toan Demo',
    userCode: 'KT-001',
  };

  const parent: ParentUserFixture = {
    _id: 'parent-accounting-001',
    fullName: 'Chi Nguyen Thu Huong',
    email: 'huong.parent@school.local',
    phone: '0901000123',
    role: 'PARENT',
  };

  const sales: SaleUserFixture[] = [
    {
      _id: 'sale-accounting-001',
      fullName: 'Sale Demo',
      email: 'sale.demo@school.local',
      role: 'SALE',
    },
  ];

  const teachers: TeacherFixture[] = [
    {
      _id: 'teacher-accounting-001',
      fullName: 'Co Pham Bao Chau',
      email: 'teacher.payroll@school.local',
      role: 'TEACHER',
      userCode: 'GV-ACC-001',
    },
  ];

  const students: StudentFixture[] = [
    {
      _id: 'student-accounting-001',
      studentCode: 'HS-ACC-001',
      fullName: 'Nguyen Minh Thu',
      age: 10,
      parentName: parent.fullName,
      parentPhone: parent.phone,
      parentUserId: parent._id,
      faceImage: proofImage,
    },
    {
      _id: 'student-accounting-002',
      studentCode: 'HS-ACC-002',
      fullName: 'Tran Gia Han',
      age: 11,
      parentName: 'Anh Le Minh',
      parentPhone: '0901000456',
      parentUserId: 'parent-accounting-002',
      faceImage: proofImage,
    },
  ];

  const classes: ClassFixture[] = [
    {
      _id: 'class-accounting-001',
      name: 'Lop Toan Accounting 4A',
      code: 'CLS-ACC-001',
      classMode: 'ONLINE',
      students: [
        {
          _id: students[0]._id,
          fullName: students[0].fullName,
          studentCode: students[0].studentCode,
        },
      ],
    },
  ];

  const wallets: WalletFixture[] = [
    {
      _id: 'wallet-accounting-001',
      userId: parent,
      balance: 450_000,
      totalTopUp: 1_200_000,
      totalDeducted: 750_000,
      totalRefunded: 0,
      status: 'ACTIVE',
      lastTransactionAt: toIso(today, '08:15'),
      adGroupId: 'AD-GROUP-001',
      adGroupName: 'Campaign Accounting',
      adPlatform: 'Facebook',
      adAttributionSource: 'PARENT_ATTRIBUTION',
    },
    {
      _id: 'wallet-accounting-002',
      userId: {
        _id: 'parent-accounting-003',
        fullName: 'Anh Tran Quoc Khanh',
        email: 'khanh.parent@school.local',
        phone: '0901222333',
        role: 'PARENT',
      },
      balance: 300_000,
      totalTopUp: 800_000,
      totalDeducted: 500_000,
      totalRefunded: 0,
      status: 'ACTIVE',
      lastTransactionAt: toIso(today, '07:50'),
    },
  ];

  const pendingTopUps: PendingTopUpFixture[] = [
    {
      _id: 'topup-accounting-001',
      walletId: wallets[0]._id,
      userId: parent,
      amount: 500_000,
      paymentMethod: 'BANK_TRANSFER',
      transactionRef: 'MB123456789',
      receiptImageUrl: proofImage,
      description: 'Nap vi hoc phi thang nay',
      createdAt: toIso(today, '08:45'),
    },
  ];

  const ledgerEntries: LedgerFixture[] = [
    {
      _id: 'ledger-accounting-001',
      walletId: wallets[0]._id,
      userId: parent._id,
      type: 'SESSION_DEDUCT',
      status: 'COMPLETED',
      amount: 250_000,
      balanceBefore: 700_000,
      balanceAfter: 450_000,
      description: 'Tru hoc phi buoi hoc gan nhat',
      createdAt: toIso(today, '08:15'),
    },
    {
      _id: 'ledger-accounting-002',
      walletId: wallets[1]._id,
      userId: wallets[1].userId._id,
      type: 'ADJUSTMENT',
      status: 'COMPLETED',
      amount: 50_000,
      balanceBefore: 250_000,
      balanceAfter: 300_000,
      description: 'Dieu chinh cong bo sung',
      adjustmentReason: 'Bo sung chenh lech doi soat',
      createdAt: toIso(today, '07:50'),
    },
  ];

  const invoices: InvoiceFixture[] = [
    {
      _id: 'invoice-accounting-001',
      invoiceNumber: 'INV-ACC-001',
      studentId: {
        _id: students[0]._id,
        fullName: students[0].fullName,
        parentName: students[0].parentName,
        parentPhone: students[0].parentPhone,
        studentCode: students[0].studentCode,
      },
      classType: 'ONLINE',
      saleId: {
        _id: sales[0]._id,
        fullName: sales[0].fullName,
        email: sales[0].email,
      },
      sessions: 20,
      bonusSessions: 2,
      trialSessions: 0,
      paymentRound: 1,
      courseStatus: 'NEW',
      amount: 3_800_000,
      paymentDate: today,
      receiptImage: proofImage,
      description: 'Hoa don hoc phi khoa moi',
      classId: {
        _id: classes[0]._id,
        name: classes[0].name,
        code: classes[0].code,
      },
      status: 'PENDING_APPROVAL',
      createdBy: {
        _id: sales[0]._id,
        fullName: sales[0].fullName,
        email: sales[0].email,
      },
      createdAt: toIso(today, '09:00'),
      updatedAt: toIso(today, '09:00'),
    },
  ];

  const payrollPreviewSessions: PayrollPreviewSessionFixture[] = [
    {
      _id: 'payroll-preview-session-001',
      classId: {
        _id: classes[0]._id,
        name: classes[0].name,
        code: classes[0].code,
        classMode: 'ONLINE',
      },
      studentId: {
        _id: students[0]._id,
        fullName: students[0].fullName,
        studentCode: students[0].studentCode,
      },
      scheduledDate: today,
      durationMinutes: 90,
      teacherPayout: 300_000,
      penaltyAmount: 50_000,
      finalPayout: 250_000,
      status: 'FINALIZED',
      hasTeachingReport: true,
      isTeacherPaid: false,
      isPaid: false,
      payrollStatus: 'ELIGIBLE',
      teachingReport: {
        submittedAt: toIso(today, '10:45'),
        isLateSubmission: true,
      },
    },
    {
      _id: 'payroll-preview-session-002',
      classId: {
        _id: classes[0]._id,
        name: classes[0].name,
        code: classes[0].code,
        classMode: 'ONLINE',
      },
      studentId: {
        _id: students[0]._id,
        fullName: students[0].fullName,
        studentCode: students[0].studentCode,
      },
      scheduledDate: today,
      durationMinutes: 90,
      teacherPayout: 300_000,
      finalPayout: 300_000,
      status: 'FINALIZED',
      hasTeachingReport: false,
      isTeacherPaid: false,
      isPaid: false,
      payrollStatus: 'BLOCKED_NO_REPORT',
      teachingReport: null,
    },
    {
      _id: 'payroll-preview-session-003',
      classId: {
        _id: classes[0]._id,
        name: classes[0].name,
        code: classes[0].code,
        classMode: 'ONLINE',
      },
      studentId: {
        _id: students[1]._id,
        fullName: students[1].fullName,
        studentCode: students[1].studentCode,
      },
      scheduledDate: today,
      durationMinutes: 60,
      teacherPayout: 220_000,
      finalPayout: 220_000,
      status: 'TEACHER_COMPLETED',
      hasTeachingReport: true,
      isTeacherPaid: false,
      isPaid: false,
      payrollStatus: 'WAITING_FINALIZE',
      teachingReport: {
        submittedAt: toIso(today, '11:10'),
        isLateSubmission: false,
      },
    },
  ];

  const payrolls: PayrollFixture[] = [
    {
      _id: 'payroll-accounting-001',
      teacherId: {
        _id: teachers[0]._id,
        fullName: teachers[0].fullName,
        email: teachers[0].email,
      },
      periodStart: monthStart,
      periodEnd: monthEnd,
      payrollCode: 'PAY-ACC-001',
      totalSessions: 3,
      grossAmount: 820_000,
      adjustmentAmount: 0,
      bonusAmount: 0,
      deductionAmount: 50_000,
      netAmount: 770_000,
      status: 'DRAFT',
      createdBy: {
        _id: user._id,
        fullName: user.fullName,
      },
      notes: 'Ky luong giao vien chua gui duyet',
    },
  ];

  const payrollItemsById: Record<string, PayrollItemDetailFixture[]> = {
    'payroll-accounting-001': [
      {
        _id: 'payroll-item-accounting-001',
        payrollId: 'payroll-accounting-001',
        sessionId: {
          _id: payrollPreviewSessions[0]._id,
          scheduledDate: payrollPreviewSessions[0].scheduledDate,
          status: payrollPreviewSessions[0].status,
        },
        classId: {
          _id: classes[0]._id,
          name: classes[0].name,
          code: classes[0].code,
        },
        studentId: {
          _id: students[0]._id,
          fullName: students[0].fullName,
          studentCode: students[0].studentCode,
        },
        sessionDate: today,
        teacherPayout: 250_000,
        adjustedPayout: 250_000,
        status: 'ELIGIBLE',
      },
    ],
  };

  const bankAccounts: BankAccountFixture[] = [
    {
      _id: 'bank-account-accounting-001',
      accountCode: 'BA-ACC-001',
      bankName: 'VCB',
      accountNumber: '001122334455',
      accountHolder: 'Trung Tam Tung Tran',
      branch: 'Ho Chi Minh',
      currentBalance: 15_000_000,
      openingBalance: 10_000_000,
      status: 'ACTIVE',
      description: 'Tai khoan thu hoc phi chinh',
      isPrimary: true,
      createdByName: user.fullName,
      createdAt: toIso(today, '07:00'),
    },
  ];

  const bankTransactions: BankTransactionFixture[] = [
    {
      _id: 'bank-tx-accounting-001',
      transactionCode: 'BTX-ACC-001',
      bankAccountId: bankAccounts[0]._id,
      type: 'DEPOSIT',
      category: 'TUITION_INCOME',
      amount: 500_000,
      balanceBefore: 14_500_000,
      balanceAfter: 15_000_000,
      transactionDate: toIso(today, '08:46'),
      description: 'Tien vao doi ung top-up phu huynh',
      reference: 'MB123456789',
      recordedByName: user.fullName,
      isReconciled: false,
      createdAt: toIso(today, '08:46'),
    },
    {
      _id: 'bank-tx-accounting-002',
      transactionCode: 'BTX-ACC-000',
      bankAccountId: bankAccounts[0]._id,
      type: 'WITHDRAWAL',
      category: 'PAYROLL',
      amount: 770_000,
      balanceBefore: 15_770_000,
      balanceAfter: 15_000_000,
      transactionDate: toIso(today, '07:35'),
      description: 'Chi luong giao vien ky truoc',
      reference: 'UNC-KYTRUOC-01',
      recordedByName: user.fullName,
      isReconciled: true,
      createdAt: toIso(today, '07:35'),
    },
  ];

  const funds: FundFixture[] = [
    {
      _id: 'fund-accounting-marketing',
      fundCode: 'FUND-MKT-001',
      name: 'Quy Marketing Online',
      fundType: 'MARKETING',
      currentBalance: 1_200_000,
      minimumBalance: 2_000_000,
      targetBalance: 5_000_000,
      status: 'ACTIVE',
      description: 'Quy chay ads va toi uu lead',
      totalDeposited: 4_000_000,
      totalWithdrawn: 2_800_000,
      createdByName: user.fullName,
      createdAt: toIso(today, '06:45'),
    },
    {
      _id: 'fund-accounting-reserve',
      fundCode: 'FUND-RSV-001',
      name: 'Quy Du Phong Van Hanh',
      fundType: 'RESERVE',
      currentBalance: 8_000_000,
      minimumBalance: 5_000_000,
      targetBalance: 10_000_000,
      status: 'ACTIVE',
      description: 'Quy du phong cho 3 thang van hanh',
      totalDeposited: 9_500_000,
      totalWithdrawn: 1_500_000,
      createdByName: user.fullName,
      createdAt: toIso(today, '06:30'),
    },
  ];

  const fundTransactions: FundTransactionFixture[] = [
    {
      _id: 'fund-tx-accounting-001',
      transactionCode: 'FTX-MKT-001',
      fundId: funds[0]._id,
      type: 'WITHDRAW',
      amount: 600_000,
      balanceBefore: 1_800_000,
      balanceAfter: 1_200_000,
      transactionDate: toIso(today, '09:20'),
      description: 'Chi ngan sach quang cao ngay',
      reference: 'ADS-APR-001',
      performedByName: user.fullName,
      createdAt: toIso(today, '09:20'),
    },
    {
      _id: 'fund-tx-accounting-002',
      transactionCode: 'FTX-RSV-001',
      fundId: funds[1]._id,
      type: 'DEPOSIT',
      amount: 2_000_000,
      balanceBefore: 6_000_000,
      balanceAfter: 8_000_000,
      transactionDate: toIso(today, '08:10'),
      description: 'Bo sung quy du phong tu dong tien thang',
      reference: 'RESERVE-APR-001',
      performedByName: user.fullName,
      createdAt: toIso(today, '08:10'),
    },
  ];

  const staffPayrolls: StaffPayrollFixture[] = [
    {
      _id: 'staff-payroll-accounting-001',
      payrollCode: 'SP-ACC-001',
      userId: 'ops-user-001',
      userName: 'Le Hoang Mai',
      role: 'OPS',
      periodStart: monthStart,
      periodEnd: monthEnd,
      baseSalary: 9_500_000,
      actualHours: 168,
      standardHours: 176,
      attendanceRatio: 0.955,
      baseSalaryAmount: 9_072_500,
      totalRevenue: 0,
      commissionType: 'Bac doanh thu',
      commissionTiers: [
        { from: 0, to: 50_000_000, rate: 1 },
        { from: 50_000_000, rate: 1.5 },
      ],
      commissionAmount: 450_000,
      kpiScore: 92,
      kpiBonusTiers: [
        { minScore: 85, maxScore: 95, bonusPercentage: 5 },
      ],
      kpiBonusPercentage: 5,
      kpiBonusAmount: 476_000,
      lateDays: 1,
      latePenaltyPerTime: 100_000,
      latePenaltyAmount: 100_000,
      bonusAmount: 200_000,
      deductionAmount: 0,
      netAmount: 10_098_500,
      status: 'APPROVED',
      notes: 'Da duoc giam doc phe duyet, cho ke toan xac nhan chi.',
      createdAt: toIso(today, '09:05'),
      updatedAt: toIso(today, '09:05'),
    },
    {
      _id: 'staff-payroll-accounting-002',
      payrollCode: 'SP-ACC-000',
      userId: 'sales-user-001',
      userName: 'Tran Bao Nam',
      role: 'SALES',
      periodStart: monthStart,
      periodEnd: monthEnd,
      baseSalary: 8_000_000,
      actualHours: 176,
      standardHours: 176,
      attendanceRatio: 1,
      baseSalaryAmount: 8_000_000,
      totalRevenue: 120_000_000,
      commissionType: 'Bac doanh thu',
      commissionTiers: [
        { from: 0, to: 100_000_000, rate: 2 },
        { from: 100_000_000, rate: 3 },
      ],
      commissionAmount: 2_600_000,
      kpiScore: 96,
      kpiBonusTiers: [
        { minScore: 90, bonusPercentage: 7 },
      ],
      kpiBonusPercentage: 7,
      kpiBonusAmount: 560_000,
      lateDays: 0,
      latePenaltyPerTime: 100_000,
      latePenaltyAmount: 0,
      bonusAmount: 300_000,
      deductionAmount: 0,
      netAmount: 11_460_000,
      status: 'PAID',
      paymentRef: 'UNC-SP-0001',
      notes: 'Da chi qua ngan hang.',
      createdAt: toIso(today, '07:50'),
      updatedAt: toIso(today, '08:05'),
    },
  ];

  const expenseItems: ExpenseFixture[] = [
    {
      _id: 'expense-accounting-000',
      expenseCode: 'EXP-ACC-000',
      title: 'Thanh toan internet van phong',
      description: 'Cuoc internet co so chinh',
      amount: 350_000,
      expenseDate: toIso(today, '00:00'),
      category: 'UTILITIES',
      paymentStatus: 'PAID',
      createdById: user._id,
      createdByName: user.fullName,
      approvedById: user._id,
      approvedByName: user.fullName,
      approvedAt: toIso(today, '08:20'),
      paidById: user._id,
      paidByName: user.fullName,
      paidAt: toIso(today, '08:35'),
      paymentMethod: 'BANK_TRANSFER',
      notes: 'Da doi soat hoa don nha mang.',
      createdAt: toIso(today, '08:15'),
      updatedAt: toIso(today, '08:35'),
    },
  ];

  const loanItems: LoanFixture[] = [
    {
      _id: 'loan-accounting-001',
      loanCode: 'LOAN-ACC-001',
      lenderName: 'VCB Business',
      lenderType: 'BANK',
      loanType: 'WORKING_CAPITAL',
      principal: 12_000_000,
      interestRate: 10.5,
      interestType: 'FIXED',
      term: 3,
      startDate: toIso(today, '00:00'),
      endDate: toIso(today, '00:00'),
      paymentFrequency: 'MONTHLY',
      status: 'ACTIVE',
      bankAccountId: bankAccounts[0]._id,
      totalPaid: 4_000_000,
      remainingBalance: 8_000_000,
      collateral: 'Hop dong doanh thu hoc phi',
      notes: 'Khoan vay bo sung dong tien van hanh quy 2.',
      createdByName: user.fullName,
      approvedByName: 'Director Demo',
      approvedAt: toIso(today, '06:00'),
      createdAt: toIso(today, '06:00'),
    },
  ];

  const loanPayments: LoanPaymentFixture[] = [
    {
      _id: 'loan-payment-accounting-001',
      paymentCode: 'LP-ACC-001',
      loanId: loanItems[0]._id,
      paymentNumber: 1,
      dueDate: toIso(today, '00:00'),
      paidDate: toIso(today, '00:00'),
      principalAmount: 4_000_000,
      interestAmount: 250_000,
      totalAmount: 4_250_000,
      status: 'PAID',
      paymentMethod: 'BANK_TRANSFER',
      reference: 'UNC-LOAN-001',
      notes: 'Da tra dung han ky 1.',
      paidByName: user.fullName,
      createdAt: toIso(today, '07:10'),
    },
    {
      _id: 'loan-payment-accounting-002',
      paymentCode: 'LP-ACC-002',
      loanId: loanItems[0]._id,
      paymentNumber: 2,
      dueDate: new Date(new Date(today).getTime() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      principalAmount: 4_000_000,
      interestAmount: 180_000,
      totalAmount: 4_180_000,
      status: 'SCHEDULED',
      createdAt: toIso(today, '07:11'),
    },
    {
      _id: 'loan-payment-accounting-003',
      paymentCode: 'LP-ACC-003',
      loanId: loanItems[0]._id,
      paymentNumber: 3,
      dueDate: new Date(new Date(today).getTime() + 25 * 24 * 60 * 60 * 1000).toISOString(),
      principalAmount: 4_000_000,
      interestAmount: 120_000,
      totalAmount: 4_120_000,
      status: 'SCHEDULED',
      createdAt: toIso(today, '07:12'),
    },
  ];

  return {
    today,
    monthStart,
    monthEnd,
    user,
    parent,
    sales,
    teachers,
    students,
    classes,
    wallets,
    pendingTopUps,
    ledgerEntries,
    invoices,
    payrollPreviewSessions,
    payrolls,
    payrollItemsById,
    bankAccounts,
    bankTransactions,
    funds,
    fundTransactions,
    staffPayrolls,
    expenseItems,
    loanItems,
    loanPayments,
    loginBodies: [],
    topUpApprovalBodies: [],
    invoiceApprovalBodies: [],
    payrollSubmitIds: [],
    adjustBodies: [],
    bankTransactionBodies: [],
    reconciledBankTransactionIds: [],
    fundTransactionBodies: [],
    staffPayrollPaidBodies: [],
    expenseCreateBodies: [],
    expenseApprovalIds: [],
    expensePaidBodies: [],
    loanPaymentBodies: [],
    loanOverdueRuns: 0,
    exportCalls: [],
  };
}

function buildAccountingDashboard(state: WorkflowState) {
  const totalBalance = state.wallets.reduce((sum, wallet) => sum + wallet.balance, 0);
  const totalTopUp = state.wallets.reduce((sum, wallet) => sum + wallet.totalTopUp, 0);
  const totalDeducted = state.wallets.reduce((sum, wallet) => sum + wallet.totalDeducted, 0);
  const totalRefunded = state.wallets.reduce((sum, wallet) => sum + wallet.totalRefunded, 0);
  const paidPayrolls = state.payrolls.filter((item) => item.status === 'PENDING_REVIEW');
  const approvedInvoices = state.invoices.filter((item) => item.status === 'APPROVED');

  return {
    revenue: {
      totalSessionRevenue: approvedInvoices.reduce((sum, item) => sum + item.amount, 0),
      totalTeacherCost: state.payrolls.reduce((sum, item) => sum + item.netAmount, 0),
      grossProfit: approvedInvoices.reduce((sum, item) => sum + item.amount, 0) - state.payrolls.reduce((sum, item) => sum + item.netAmount, 0),
    },
    wallets: {
      totalBalance,
      walletCount: state.wallets.length,
      frozenCount: 0,
      totalTopUp,
      totalDeducted,
      totalRefunded,
    },
    payroll: {
      totalPaidThisPeriod: paidPayrolls.reduce((sum, item) => sum + item.netAmount, 0),
      byStatus: {
        DRAFT: {
          count: state.payrolls.filter((item) => item.status === 'DRAFT').length,
          totalNet: state.payrolls.filter((item) => item.status === 'DRAFT').reduce((sum, item) => sum + item.netAmount, 0),
        },
        PENDING_REVIEW: {
          count: state.payrolls.filter((item) => item.status === 'PENDING_REVIEW').length,
          totalNet: state.payrolls.filter((item) => item.status === 'PENDING_REVIEW').reduce((sum, item) => sum + item.netAmount, 0),
        },
      },
    },
    financialSummary: {
      TOP_UP: {
        count: state.ledgerEntries.filter((item) => item.type === 'TOP_UP').length,
        totalAmount: state.ledgerEntries.filter((item) => item.type === 'TOP_UP').reduce((sum, item) => sum + item.amount, 0),
      },
      SESSION_DEDUCT: {
        count: state.ledgerEntries.filter((item) => item.type === 'SESSION_DEDUCT').length,
        totalAmount: state.ledgerEntries.filter((item) => item.type === 'SESSION_DEDUCT').reduce((sum, item) => sum + item.amount, 0),
      },
      ADJUSTMENT: {
        count: state.ledgerEntries.filter((item) => item.type === 'ADJUSTMENT').length,
        totalAmount: state.ledgerEntries.filter((item) => item.type === 'ADJUSTMENT').reduce((sum, item) => sum + item.amount, 0),
      },
    },
    pendingTopUps: clone(state.pendingTopUps),
    ledgerRecent: clone(state.ledgerEntries.slice(0, 5)),
  };
}

function buildDailyTaskBoard(state: WorkflowState) {
  const tasks = [
    {
      id: 'task-accounting-topup-001',
      type: 'TOP_UP',
      title: `Top-up chờ duyệt (${state.pendingTopUps.length})`,
      detail: 'Đối chiếu biên lai ngân hàng và cộng tiền vào ví phụ huynh.',
      meta: [state.parent.fullName, 'Ví phụ huynh'],
      priority: 'HIGH',
      dueAt: toIso(state.today, '10:30'),
      route: '/app/wallets',
      actionLabel: 'Mở ví',
      overdue: false,
    },
    {
      id: 'task-accounting-invoice-001',
      type: 'INVOICE',
      title: `Hóa đơn chờ duyệt (${state.invoices.filter((item) => item.status === 'PENDING_APPROVAL').length})`,
      detail: 'Kiểm tra hóa đơn sale upload và hóa đơn đối ứng trước khi duyệt.',
      meta: [state.invoices[0].invoiceNumber, state.invoices[0].studentId.fullName],
      priority: 'HIGH',
      dueAt: toIso(state.today, '11:00'),
      route: '/app/invoices',
      actionLabel: 'Mở hóa đơn',
      overdue: false,
    },
  ];

  return {
    role: state.user.role,
    generatedAt: new Date().toISOString(),
    summary: {
      totalTasks: tasks.length,
      overdueTasks: 0,
      dueTodayTasks: tasks.length,
      highPriorityTasks: tasks.length,
    },
    tabs: [
      {
        key: 'need-action',
        label: 'Cần xử lý',
        description: 'Danh sách nghiệp vụ tài chính đang chờ kế toán thao tác.',
        emptyMessage: 'Không còn việc cần xử lý.',
        count: tasks.length,
        tasks,
      },
    ],
  };
}

function buildWalletList(state: WorkflowState) {
  return state.wallets.map((wallet) => clone(wallet));
}

function buildLedgerList(state: WorkflowState, requestUrl: string) {
  const url = new URL(requestUrl);
  const type = url.searchParams.get('type') || '';
  const fromDate = url.searchParams.get('fromDate') || '';
  const toDate = url.searchParams.get('toDate') || '';

  const data = state.ledgerEntries.filter((entry) => {
    if (type && entry.type !== type) {
      return false;
    }
    if (fromDate && entry.createdAt < `${fromDate}T00:00:00.000Z`) {
      return false;
    }
    if (toDate && entry.createdAt > `${toDate}T23:59:59.999Z`) {
      return false;
    }
    return true;
  });

  return {
    data: clone(data),
    meta: {
      total: data.length,
      page: 1,
      limit: 50,
      totalPages: 1,
    },
  };
}

function buildPayrollPreview(state: WorkflowState, teacherId: string, periodStart: string, periodEnd: string) {
  const sessions = clone(state.payrollPreviewSessions);
  const eligibleSessions = sessions.filter((session) => session.payrollStatus === 'ELIGIBLE');
  const paidSessions = sessions.filter((session) => session.payrollStatus === 'PAID');
  const blockedNoReport = sessions.filter((session) => session.payrollStatus === 'BLOCKED_NO_REPORT');
  const waitingFinalize = sessions.filter((session) => session.payrollStatus === 'WAITING_FINALIZE');
  const waitingParent = sessions.filter((session) => session.payrollStatus === 'WAITING_PARENT');

  return {
    teacherId,
    periodStart,
    periodEnd,
    summary: {
      totalSessions: sessions.length,
      totalAttended: sessions.length,
      eligibleForPayroll: eligibleSessions.length,
      missingReport: blockedNoReport.length,
      pendingParentConfirm: waitingParent.length,
      pendingFinalize: waitingFinalize.length,
      finalizedNoReport: blockedNoReport.length,
      heldCount: 0,
      alreadyPaid: paidSessions.length,
      cancelled: 0,
      noShow: 0,
    },
    amounts: {
      totalEligiblePayout: eligibleSessions.reduce((sum, session) => sum + (session.finalPayout ?? session.teacherPayout), 0),
      totalAlreadyPaid: paidSessions.reduce((sum, session) => sum + (session.finalPayout ?? session.teacherPayout), 0),
      totalBlockedByReport: blockedNoReport.reduce((sum, session) => sum + (session.finalPayout ?? session.teacherPayout), 0),
      totalPendingConfirm: waitingParent.reduce((sum, session) => sum + (session.finalPayout ?? session.teacherPayout), 0),
      totalPendingFinalize: waitingFinalize.reduce((sum, session) => sum + (session.finalPayout ?? session.teacherPayout), 0),
      totalHeldPayout: 0,
      totalAttendedPayout: sessions.reduce((sum, session) => sum + (session.finalPayout ?? session.teacherPayout), 0),
      totalOfflineMinGuaranteeAmount: 0,
    },
    sessions,
    existingPayrolls: clone(state.payrolls),
  };
}

function buildPayrollListResult(state: WorkflowState, requestUrl: string) {
  const url = new URL(requestUrl);
  const teacherId = url.searchParams.get('teacherId') || '';
  const status = url.searchParams.get('status') || '';
  const page = Number(url.searchParams.get('page') || '1');
  const limit = Number(url.searchParams.get('limit') || '20');

  const data = state.payrolls.filter((payroll) => {
    if (teacherId && payroll.teacherId._id !== teacherId) {
      return false;
    }
    if (status && payroll.status !== status) {
      return false;
    }
    return true;
  });

  return {
    data: clone(data),
    meta: {
      total: data.length,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(data.length / limit)),
    },
  };
}

function matchesDateRange(value: string | undefined, fromDate: string, toDate: string): boolean {
  if (!value) {
    return false;
  }

  const normalized = value.slice(0, 10);
  if (fromDate && normalized < fromDate) {
    return false;
  }
  if (toDate && normalized > toDate) {
    return false;
  }
  return true;
}

function toNumber(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function buildStaffPayrollListResult(state: WorkflowState, requestUrl: string) {
  const url = new URL(requestUrl);
  const status = url.searchParams.get('status') || '';
  const periodStart = url.searchParams.get('periodStart') || '';
  const periodEnd = url.searchParams.get('periodEnd') || '';
  const page = Number(url.searchParams.get('page') || '1');
  const limit = Number(url.searchParams.get('limit') || '20');

  const data = state.staffPayrolls.filter((item) => {
    if (status && item.status !== status) {
      return false;
    }
    if (periodStart && !matchesDateRange(item.periodStart, periodStart, periodEnd || periodStart)) {
      return false;
    }
    if (periodEnd && !matchesDateRange(item.periodEnd, periodStart || periodEnd, periodEnd)) {
      return false;
    }
    return true;
  });

  return {
    data: clone(data),
    total: data.length,
    page,
    limit,
  };
}

function buildExpenseListResult(state: WorkflowState, requestUrl: string) {
  const url = new URL(requestUrl);
  const startDate = url.searchParams.get('startDate') || '';
  const endDate = url.searchParams.get('endDate') || '';
  const data = state.expenseItems.filter((item) => {
    if (startDate && !matchesDateRange(item.expenseDate, startDate, endDate || startDate)) {
      return false;
    }
    if (endDate && !matchesDateRange(item.expenseDate, startDate || endDate, endDate)) {
      return false;
    }
    return true;
  });

  return {
    data: clone(data),
    total: data.length,
    page: 1,
    limit: 50,
  };
}

function buildExpenseStats(state: WorkflowState) {
  const byStatus: Record<string, { count: number; total: number }> = {};
  const byCategory: Record<string, { count: number; total: number }> = {};

  for (const item of state.expenseItems) {
    byStatus[item.paymentStatus] ??= { count: 0, total: 0 };
    byStatus[item.paymentStatus].count += 1;
    byStatus[item.paymentStatus].total += item.amount;

    byCategory[item.category] ??= { count: 0, total: 0 };
    byCategory[item.category].count += 1;
    byCategory[item.category].total += item.amount;
  }

  return {
    totalCount: state.expenseItems.length,
    totalAmount: state.expenseItems.reduce((sum, item) => sum + item.amount, 0),
    byStatus,
    byCategory,
  };
}

function buildLoanListResult(state: WorkflowState, requestUrl: string) {
  const url = new URL(requestUrl);
  const status = url.searchParams.get('status') || '';
  const lenderType = url.searchParams.get('lenderType') || '';
  const keyword = (url.searchParams.get('keyword') || '').trim().toLowerCase();

  return clone(state.loanItems.filter((item) => {
    if (status && item.status !== status) {
      return false;
    }
    if (lenderType && item.lenderType !== lenderType) {
      return false;
    }
    if (keyword) {
      const haystack = `${item.loanCode} ${item.lenderName}`.toLowerCase();
      return haystack.includes(keyword);
    }
    return true;
  }));
}

function buildLoanPaymentsResult(state: WorkflowState, requestUrl: string) {
  const url = new URL(requestUrl);
  const loanId = url.searchParams.get('loanId') || '';
  const status = url.searchParams.get('status') || '';
  const startDate = url.searchParams.get('startDate') || '';
  const endDate = url.searchParams.get('endDate') || '';

  return clone(state.loanPayments.filter((item) => {
    if (loanId && item.loanId !== loanId) {
      return false;
    }
    if (status && item.status !== status) {
      return false;
    }
    if (startDate || endDate) {
      const dateToCheck = item.paidDate || item.dueDate;
      if (!matchesDateRange(dateToCheck, startDate, endDate)) {
        return false;
      }
    }
    return true;
  }));
}

function buildLoanSummary(state: WorkflowState) {
  const paidPayments = state.loanPayments.filter((item) => item.status === 'PAID');
  const overduePayments = state.loanPayments.filter((item) => item.status === 'OVERDUE');
  const nextThirtyDays = new Date();
  nextThirtyDays.setDate(nextThirtyDays.getDate() + 30);
  const upcomingPayments = state.loanPayments.filter((item) =>
    item.status === 'SCHEDULED' && new Date(item.dueDate) <= nextThirtyDays,
  );

  return {
    totalDebt: state.loanItems
      .filter((item) => item.status === 'ACTIVE')
      .reduce((sum, item) => sum + item.remainingBalance, 0),
    totalPrincipal: state.loanItems.reduce((sum, item) => sum + item.principal, 0),
    activeLoanCount: state.loanItems.filter((item) => item.status === 'ACTIVE').length,
    overdueAmount: overduePayments.reduce((sum, item) => sum + item.totalAmount, 0),
    overdueCount: overduePayments.length,
    upcomingPayments30d: upcomingPayments.reduce((sum, item) => sum + item.totalAmount, 0),
    upcomingPaymentCount30d: upcomingPayments.length,
    totalInterestPaid: paidPayments.reduce((sum, item) => sum + item.interestAmount, 0),
    totalAmountPaid: paidPayments.reduce((sum, item) => sum + item.totalAmount, 0),
  };
}

function buildFinancialControlDashboard(state: WorkflowState) {
  const bankBalance = state.bankAccounts.reduce((sum, item) => sum + item.currentBalance, 0);
  const fundBalance = state.funds.reduce((sum, item) => sum + item.currentBalance, 0);
  const marketingFunds = state.funds.filter((item) => item.fundType === 'MARKETING');
  const marketingBalance = marketingFunds.reduce((sum, item) => sum + item.currentBalance, 0);
  const staffPayrollPayable = state.staffPayrolls
    .filter((item) => item.status === 'APPROVED')
    .reduce((sum, item) => sum + item.netAmount, 0);
  const teacherPayrollPayable = state.payrolls
    .filter((item) => item.status === 'PENDING_REVIEW')
    .reduce((sum, item) => sum + item.netAmount, 0);
  const expensePayable = state.expenseItems
    .filter((item) => item.paymentStatus === 'APPROVED_UNPAID')
    .reduce((sum, item) => sum + item.amount, 0);
  const approvedInvoices = state.invoices.filter((item) => item.status === 'APPROVED');
  const approvedInvoiceAmount = approvedInvoices.reduce((sum, item) => sum + item.amount, 0);
  const teacherCost = state.payrollPreviewSessions.reduce(
    (sum, item) => sum + (item.finalPayout ?? item.teacherPayout),
    0,
  );
  const burnRate = 9_800_000;
  const availableCash = bankBalance + fundBalance;
  const accountsPayable = staffPayrollPayable + teacherPayrollPayable + expensePayable;
  const grossProfit = approvedInvoiceAmount - teacherCost;
  const netProfit = grossProfit - expensePayable - 1_200_000;
  const loanSummary = buildLoanSummary(state);

  return {
    cashPosition: {
      bankBalance,
      bankAccountCount: state.bankAccounts.length,
      fundBalance,
      fundCount: state.funds.length,
      marketingFund: marketingBalance,
      marketingFundCount: marketingFunds.length,
      availableCash,
    },
    obligations: {
      payrollPayable: staffPayrollPayable + teacherPayrollPayable,
      payrollPayableCount: state.staffPayrolls.filter((item) => item.status === 'APPROVED').length
        + state.payrolls.filter((item) => item.status === 'PENDING_REVIEW').length,
      expensePayable,
      expensePayableCount: state.expenseItems.filter((item) => item.paymentStatus === 'APPROVED_UNPAID').length,
      orderPayable: 0,
      orderPayableCount: 0,
      totalPayable14Days: staffPayrollPayable + teacherPayrollPayable + expensePayable,
      operatingReserve3Months: 30_000_000,
      burnRate,
      runway: Number((availableCash / burnRate).toFixed(1)),
      reserveHealthy: availableCash >= 30_000_000,
      cashAfterObligations: availableCash - (staffPayrollPayable + teacherPayrollPayable + expensePayable),
    },
    deferredRevenue: {
      walletBalance: state.wallets.reduce((sum, item) => sum + item.balance, 0),
      walletCount: state.wallets.length,
      pendingInvoiceAmount: state.invoices
        .filter((item) => item.status === 'PENDING_APPROVAL')
        .reduce((sum, item) => sum + item.amount, 0),
      pendingInvoiceCount: state.invoices.filter((item) => item.status === 'PENDING_APPROVAL').length,
    },
    metrics: {
      burnRate,
      runway: Number((availableCash / burnRate).toFixed(1)),
      currentRatio: Number(((availableCash || 1) / Math.max(accountsPayable, 1)).toFixed(2)),
      grossMargin: approvedInvoiceAmount > 0 ? Number(((grossProfit / approvedInvoiceAmount) * 100).toFixed(1)) : 0,
      netMargin: approvedInvoiceAmount > 0 ? Number(((netProfit / approvedInvoiceAmount) * 100).toFixed(1)) : 0,
      grossProfit,
      netProfit,
      revenueGrowth: 12.5,
      thisMonthRevenue: approvedInvoiceAmount,
      lastMonthRevenue: 3_200_000,
      accountsReceivable: 0,
      accountsPayable,
      deferredRevenue: state.wallets.reduce((sum, item) => sum + item.balance, 0),
    },
    debtPosition: {
      totalDebt: loanSummary.totalDebt,
      activeLoanCount: loanSummary.activeLoanCount,
      loanPayable: loanSummary.overdueAmount + loanSummary.upcomingPayments30d,
      loanPayableCount: loanSummary.overdueCount + loanSummary.upcomingPaymentCount30d,
    },
    fundWarnings: state.funds
      .filter((item) => item.currentBalance < item.minimumBalance)
      .map((item) => ({
        name: item.name,
        fundCode: item.fundCode,
        currentBalance: item.currentBalance,
        minimumBalance: item.minimumBalance,
        deficit: item.minimumBalance - item.currentBalance,
      })),
  };
}

function buildFinancialAlerts(state: WorkflowState) {
  const marketingFund = state.funds.find((item) => item.fundType === 'MARKETING');
  const unreconciledCount = state.bankTransactions.filter((item) => !item.isReconciled).length;
  const overdueCount = state.loanPayments.filter((item) => item.status === 'OVERDUE').length;

  return {
    totalAlerts: unreconciledCount + overdueCount + (marketingFund && marketingFund.currentBalance < marketingFund.minimumBalance ? 1 : 0),
    criticalCount: overdueCount > 0 ? 1 : 0,
    warningCount: (marketingFund && marketingFund.currentBalance < marketingFund.minimumBalance ? 1 : 0) + (unreconciledCount > 0 ? 1 : 0),
    infoCount: 0,
    marketingBudget: {
      fundBalance: marketingFund?.currentBalance || 0,
      optimalDailyBudget: 250_000,
      optimalMonthlyBudget: 7_500_000,
      groupBreakdown: [
        {
          adGroupId: 'AD-GROUP-001',
          adGroupName: 'Facebook Lead Lop Toan',
          platform: 'FACEBOOK',
          currentDailySpend: 180_000,
          optimalDailySpend: 240_000,
          changePercent: 33.3,
          confidence: 'HIGH',
          reason: 'CPL dang on dinh va cohort da qua 60 ngay cho thay ty le dong hoc phi tot.',
        },
        {
          adGroupId: 'AD-GROUP-002',
          adGroupName: 'TikTok Remarketing',
          platform: 'TIKTOK',
          currentDailySpend: 120_000,
          optimalDailySpend: 90_000,
          changePercent: -25,
          confidence: 'MEDIUM',
          reason: 'Nhom remarketing da dat muc tan suat cao, can giam ngan sach de tranh lang phi.',
        },
      ],
    },
    alerts: [
      ...(marketingFund && marketingFund.currentBalance < marketingFund.minimumBalance
        ? [{
            id: 'alert-fund-marketing',
            severity: 'WARNING' as const,
            category: 'MARKETING_BUDGET',
            title: 'Quy marketing dang thap hon nguong toi thieu',
            message: 'Quy marketing con lai khong du de duy tri muc chi toi uu trong mot thang. Nen nap them quy hoac giam spend.',
            data: { fundId: marketingFund._id },
            actions: [
              { label: 'Nap them 2.000.000đ', type: 'FUND_DEPOSIT', target: 'MARKETING', amount: 2_000_000 },
              { label: 'Mo tab Quy', type: 'NAVIGATE', target: '/financial-control?tab=funds' },
            ],
          }]
        : []),
      ...(unreconciledCount > 0
        ? [{
            id: 'alert-bank-unreconciled',
            severity: 'WARNING' as const,
            category: 'RECONCILIATION',
            title: 'Con giao dich ngan hang chua doi soat',
            message: 'Co giao dich chuyen khoan vua vao tai khoan thu hoc phi nhung chua duoc ke toan doi soat.',
            data: { count: unreconciledCount },
            actions: [
              { label: 'Mo tab Ngan hang', type: 'NAVIGATE', target: '/financial-control?tab=bank' },
            ],
          }]
        : []),
      ...(overdueCount > 0
        ? [{
            id: 'alert-loan-overdue',
            severity: 'CRITICAL' as const,
            category: 'LOAN',
            title: 'Co ky tra no vay da qua han',
            message: 'Khoan vay van hanh dang co it nhat mot ky da qua han can ghi nhan thanh toan hoac xu ly ngay.',
            data: { count: overdueCount },
            actions: [
              { label: 'Mo man Von vay', type: 'NAVIGATE', target: '/loans' },
              { label: 'Mo doi soat tai chinh', type: 'NAVIGATE', target: '/financial-control?tab=reconciliation' },
            ],
          }]
        : []),
    ],
  };
}

function buildCashFlow(state: WorkflowState, requestUrl: string) {
  const url = new URL(requestUrl);
  const groupBy = url.searchParams.get('groupBy') || 'month';
  const teacherPayrollCash = state.payrolls
    .filter((item) => item.status === 'PENDING_REVIEW')
    .reduce((sum, item) => sum + item.netAmount, 0);
  const staffPayrollCash = state.staffPayrolls
    .filter((item) => item.status === 'PAID')
    .reduce((sum, item) => sum + item.netAmount, 0);
  const paidExpenses = state.expenseItems
    .filter((item) => item.paymentStatus === 'PAID')
    .reduce((sum, item) => sum + item.amount, 0);
  const paidLoanRepayments = state.loanPayments
    .filter((item) => item.status === 'PAID')
    .reduce((sum, item) => sum + item.totalAmount, 0);

  const timeline = [
    {
      date: groupBy === 'day' ? state.today : state.today.slice(0, 7),
      inflow: {
        invoices: state.invoices.filter((item) => item.status === 'APPROVED').reduce((sum, item) => sum + item.amount, 0),
        invoiceCount: state.invoices.filter((item) => item.status === 'APPROVED').length,
        sessionRevenue: 3_400_000,
        sessionCount: 18,
        walletTopUps: state.ledgerEntries.filter((item) => item.type === 'TOP_UP').reduce((sum, item) => sum + item.amount, 0),
        walletTopUpCount: state.ledgerEntries.filter((item) => item.type === 'TOP_UP').length,
        loanDisbursements: 12_000_000,
        loanDisbursementCount: 1,
      },
      outflow: {
        payroll: teacherPayrollCash + staffPayrollCash,
        payrollCount: state.payrolls.filter((item) => item.status === 'PENDING_REVIEW').length
          + state.staffPayrolls.filter((item) => item.status === 'PAID').length,
        expenses: paidExpenses,
        expenseCount: state.expenseItems.filter((item) => item.paymentStatus === 'PAID').length,
        adCost: state.fundTransactions
          .filter((item) => item.fundId === state.funds[0]._id && item.type === 'WITHDRAW')
          .reduce((sum, item) => sum + item.amount, 0),
        adCostCount: state.fundTransactions.filter((item) => item.fundId === state.funds[0]._id && item.type === 'WITHDRAW').length,
        loanRepayments: paidLoanRepayments,
        loanRepaymentCount: state.loanPayments.filter((item) => item.status === 'PAID').length,
      },
    },
  ].map((entry) => ({
    ...entry,
    totalInflow: entry.inflow.invoices + entry.inflow.walletTopUps + entry.inflow.loanDisbursements,
    totalOutflow: entry.outflow.payroll + entry.outflow.expenses + entry.outflow.adCost + entry.outflow.loanRepayments,
    netCashFlow: (entry.inflow.invoices + entry.inflow.walletTopUps + entry.inflow.loanDisbursements)
      - (entry.outflow.payroll + entry.outflow.expenses + entry.outflow.adCost + entry.outflow.loanRepayments),
  }));

  return {
    totalInflow: timeline.reduce((sum, item) => sum + item.totalInflow, 0),
    totalOutflow: timeline.reduce((sum, item) => sum + item.totalOutflow, 0),
    netCashFlow: timeline.reduce((sum, item) => sum + item.netCashFlow, 0),
    timeline,
    basis: {
      requested: 'cash',
      applied: 'cash',
      totalInflow: 'cash',
      totalOutflow: 'cash',
    },
    accrualReference: {
      sessionRevenue: 3_400_000,
      teacherCost: 770_000,
      serviceMargin: 2_630_000,
    },
    period: {
      startDate: state.monthStart,
      endDate: state.monthEnd,
      groupBy,
    },
  };
}

function buildProfitAndLoss(state: WorkflowState, requestUrl: string) {
  const url = new URL(requestUrl);
  const basis = (url.searchParams.get('basis') as 'cash' | 'accrual' | null) || 'cash';
  const approvedInvoices = state.invoices.filter((item) => item.status === 'APPROVED');
  const approvedRevenue = approvedInvoices.reduce((sum, item) => sum + item.amount, 0);
  const sessionRevenue = 3_400_000;
  const teacherCost = state.payrollPreviewSessions
    .filter((item) => item.payrollStatus === 'ELIGIBLE' || item.payrollStatus === 'PAID')
    .reduce((sum, item) => sum + (item.finalPayout ?? item.teacherPayout), 0);
  const paidStaffPayroll = state.staffPayrolls
    .filter((item) => item.status === 'PAID')
    .reduce((sum, item) => sum + item.netAmount, 0);
  const paidExpenses = state.expenseItems
    .filter((item) => item.paymentStatus === 'PAID')
    .reduce((sum, item) => sum + item.amount, 0);
  const adCost = state.fundTransactions
    .filter((item) => item.fundId === state.funds[0]._id && item.type === 'WITHDRAW')
    .reduce((sum, item) => sum + item.amount, 0);
  const interestExpense = state.loanPayments
    .filter((item) => item.status === 'PAID')
    .reduce((sum, item) => sum + item.interestAmount, 0);
  const revenueTotal = basis === 'cash' ? approvedRevenue : sessionRevenue;
  const payrollCost = basis === 'cash' ? paidStaffPayroll : teacherCost + paidStaffPayroll;
  const operatingExpenses = paidExpenses;
  const totalCosts = payrollCost + operatingExpenses + adCost + interestExpense;
  const grossProfit = revenueTotal - teacherCost;
  const netProfit = revenueTotal - totalCosts;

  return {
    period: {
      startDate: state.monthStart,
      endDate: state.monthEnd,
    },
    basis: {
      selected: basis,
      default: 'cash',
      supported: ['cash', 'accrual'],
    },
    revenue: {
      total: revenueTotal,
      sessionRevenue,
      invoiceRevenue: approvedRevenue,
      accrualRevenue: sessionRevenue,
      byBasis: {
        cash: approvedRevenue,
        accrual: sessionRevenue,
      },
      sessionCount: 18,
      byInvoiceType: {
        NEW: {
          count: approvedInvoices.length,
          amount: approvedRevenue,
        },
      },
    },
    costs: {
      costOfGoodsSold: teacherCost,
      teacherCost,
      teacherPayrollCash: 0,
      staffPayrollCash: paidStaffPayroll,
      payrollCost,
      operatingExpenses,
      expenseByCategory: {
        UTILITIES: {
          count: state.expenseItems.filter((item) => item.category === 'UTILITIES').length,
          amount: state.expenseItems
            .filter((item) => item.category === 'UTILITIES')
            .reduce((sum, item) => sum + item.amount, 0),
        },
      },
      adCost,
      adCostByPlatform: {
        FACEBOOK: {
          count: 1,
          amount: adCost,
        },
      },
      interestExpense,
      totalCosts,
      byBasis: {
        cash: {
          revenue: approvedRevenue,
          costs: paidStaffPayroll + paidExpenses + adCost + interestExpense,
        },
        accrual: {
          revenue: sessionRevenue,
          costs: teacherCost + paidStaffPayroll + paidExpenses + adCost + interestExpense,
        },
      },
    },
    summary: {
      basis,
      grossProfit,
      grossMargin: revenueTotal > 0 ? Number(((grossProfit / revenueTotal) * 100).toFixed(1)) : 0,
      netProfit,
      netMargin: revenueTotal > 0 ? Number(((netProfit / revenueTotal) * 100).toFixed(1)) : 0,
      byBasis: {
        cash: approvedRevenue - (paidStaffPayroll + paidExpenses + adCost + interestExpense),
        accrual: sessionRevenue - (teacherCost + paidStaffPayroll + paidExpenses + adCost + interestExpense),
      },
    },
  };
}

function buildReconciliation(state: WorkflowState) {
  const loanSummary = buildLoanSummary(state);
  const bankBalance = state.bankAccounts.reduce((sum, item) => sum + item.currentBalance, 0);
  const fundBalance = state.funds.reduce((sum, item) => sum + item.currentBalance, 0);
  const walletLiability = state.wallets.reduce((sum, item) => sum + item.balance, 0);
  const loanDebt = loanSummary.totalDebt;
  const pnl = buildProfitAndLoss(state, `http://localhost/financial-control/profit-and-loss?basis=cash`);

  return {
    healthIndicators: {
      bankBalance,
      fundBalance,
      walletLiability,
      loanDebt,
      netPosition: bankBalance + fundBalance - walletLiability - loanDebt,
      unreconciledItems: state.bankTransactions.filter((item) => !item.isReconciled).length,
      fundWarnings: state.funds.filter((item) => item.currentBalance < item.minimumBalance).length,
    },
    bankAccounts: {
      accountCount: state.bankAccounts.length,
    },
    funds: {
      fundCount: state.funds.length,
    },
    loanSummary: {
      activeLoanCount: loanSummary.activeLoanCount,
    },
    profitAndLoss: {
      grossProfit: pnl.summary.grossProfit,
      grossMargin: pnl.summary.grossMargin,
      netProfit: pnl.summary.netProfit,
      netMargin: pnl.summary.netMargin,
    },
  };
}

function buildProvisionalGrossProfit(state: WorkflowState) {
  const approvedInvoiceAmount = state.invoices
    .filter((item) => item.status === 'APPROVED')
    .reduce((sum, item) => sum + item.amount, 0);
  const teacherPayoutAmount = state.payrollPreviewSessions
    .filter((item) => item.payrollStatus === 'ELIGIBLE' || item.payrollStatus === 'PAID')
    .reduce((sum, item) => sum + (item.finalPayout ?? item.teacherPayout), 0);

  return {
    period: {
      month: Number(state.today.slice(5, 7)),
      year: Number(state.today.slice(0, 4)),
      startDate: state.monthStart,
      endDate: state.monthEnd,
    },
    cashInflow: {
      approvedInvoiceAmount,
      approvedInvoiceCount: state.invoices.filter((item) => item.status === 'APPROVED').length,
    },
    provisional: {
      revenueAmount: 3_400_000,
      teacherPayoutAmount,
      attendanceCount: 18,
    },
    grossProfitAmount: 3_400_000 - teacherPayoutAmount,
  };
}

function getStaffPayroll(state: WorkflowState, payrollId: string): StaffPayrollFixture | undefined {
  return state.staffPayrolls.find((item) => item._id === payrollId);
}

function getExpense(state: WorkflowState, expenseId: string): ExpenseFixture | undefined {
  return state.expenseItems.find((item) => item._id === expenseId);
}

function getLoan(state: WorkflowState, loanId: string): LoanFixture | undefined {
  return state.loanItems.find((item) => item._id === loanId);
}

function recordBankTransaction(state: WorkflowState, payload: Record<string, unknown>) {
  const bankAccountId = String(payload['bankAccountId'] || '');
  const account = state.bankAccounts.find((item) => item._id === bankAccountId);
  if (!account) {
    return;
  }

  state.bankTransactionBodies.push(clone(payload));
  const type = String(payload['type'] || 'DEPOSIT') as BankTransactionFixture['type'];
  const amount = toNumber(payload['amount']);
  const isInflow = ['DEPOSIT', 'TRANSFER_IN', 'INTEREST'].includes(type);
  const balanceBefore = account.currentBalance;
  const balanceAfter = isInflow ? balanceBefore + amount : balanceBefore - amount;
  account.currentBalance = balanceAfter;

  state.bankTransactions.unshift({
    _id: `bank-tx-generated-${state.bankTransactions.length + 1}`,
    transactionCode: `BTX-ACC-${String(state.bankTransactions.length + 1).padStart(3, '0')}`,
    bankAccountId,
    type,
    category: String(payload['category'] || 'OTHER'),
    amount,
    balanceBefore,
    balanceAfter,
    transactionDate: toIso(String(payload['transactionDate'] || state.today), '00:00'),
    description: String(payload['description'] || ''),
    reference: String(payload['reference'] || ''),
    recordedByName: state.user.fullName,
    isReconciled: false,
    createdAt: new Date().toISOString(),
  });
}

function reconcileBankTransaction(state: WorkflowState, transactionId: string) {
  const item = state.bankTransactions.find((entry) => entry._id === transactionId);
  if (!item) {
    return;
  }

  item.isReconciled = true;
  state.reconciledBankTransactionIds.push(transactionId);
}

function recordFundTransaction(state: WorkflowState, payload: Record<string, unknown>) {
  const fundId = String(payload['fundId'] || '');
  const fund = state.funds.find((item) => item._id === fundId);
  if (!fund) {
    return;
  }

  state.fundTransactionBodies.push(clone(payload));
  const type = String(payload['type'] || 'DEPOSIT') as FundTransactionFixture['type'];
  const amount = toNumber(payload['amount']);
  const isDeposit = type === 'DEPOSIT';
  const balanceBefore = fund.currentBalance;
  const balanceAfter = isDeposit ? balanceBefore + amount : balanceBefore - amount;
  fund.currentBalance = balanceAfter;
  if (isDeposit) {
    fund.totalDeposited += amount;
  } else {
    fund.totalWithdrawn += amount;
  }

  state.fundTransactions.unshift({
    _id: `fund-tx-generated-${state.fundTransactions.length + 1}`,
    transactionCode: `FTX-ACC-${String(state.fundTransactions.length + 1).padStart(3, '0')}`,
    fundId,
    type,
    amount,
    balanceBefore,
    balanceAfter,
    transactionDate: toIso(String(payload['transactionDate'] || state.today), '00:00'),
    description: String(payload['description'] || ''),
    reference: String(payload['reference'] || ''),
    performedByName: state.user.fullName,
    createdAt: new Date().toISOString(),
  });
}

function markStaffPayrollPaid(state: WorkflowState, payrollId: string, paymentRef: string | undefined) {
  const item = getStaffPayroll(state, payrollId);
  if (!item) {
    return;
  }

  item.status = 'PAID';
  item.paymentRef = paymentRef || 'UNC-STAFF-DEMO';
  item.updatedAt = new Date().toISOString();
  state.staffPayrollPaidBodies.push({ payrollId, paymentRef: item.paymentRef });
}

function createExpense(state: WorkflowState, payload: Record<string, unknown>) {
  state.expenseCreateBodies.push(clone(payload));
  const now = new Date().toISOString();
  state.expenseItems.unshift({
    _id: `expense-generated-${state.expenseItems.length + 1}`,
    expenseCode: `EXP-ACC-${String(state.expenseItems.length + 1).padStart(3, '0')}`,
    title: String(payload['title'] || 'Chi phi moi'),
    description: String(payload['description'] || ''),
    amount: toNumber(payload['amount']),
    expenseDate: toIso(String(payload['expenseDate'] || state.today), '00:00'),
    category: String(payload['category'] || 'OTHER'),
    paymentStatus: 'PENDING_APPROVAL',
    createdById: state.user._id,
    createdByName: state.user.fullName,
    notes: String(payload['notes'] || ''),
    createdAt: now,
    updatedAt: now,
  });
}

function approveExpenseItem(state: WorkflowState, expenseId: string) {
  const item = getExpense(state, expenseId);
  if (!item) {
    return;
  }

  item.paymentStatus = 'APPROVED_UNPAID';
  item.approvedById = state.user._id;
  item.approvedByName = state.user.fullName;
  item.approvedAt = new Date().toISOString();
  item.updatedAt = new Date().toISOString();
  state.expenseApprovalIds.push(expenseId);
}

function markExpensePaid(state: WorkflowState, expenseId: string, payload: Record<string, unknown>) {
  const item = getExpense(state, expenseId);
  if (!item) {
    return;
  }

  item.paymentStatus = 'PAID';
  item.paidById = state.user._id;
  item.paidByName = state.user.fullName;
  item.paidAt = payload['paidAt']
    ? toIso(String(payload['paidAt']), '00:00')
    : new Date().toISOString();
  item.paymentMethod = String(payload['paymentMethod'] || 'CASH');
  item.notes = [item.notes, String(payload['notes'] || '')].filter(Boolean).join(' | ');
  item.updatedAt = new Date().toISOString();
  state.expensePaidBodies.push({ expenseId, payload: clone(payload) });
}

function updateOverdueLoans(state: WorkflowState) {
  state.loanOverdueRuns += 1;
  const now = new Date();
  for (const payment of state.loanPayments) {
    if (payment.status === 'SCHEDULED' && new Date(payment.dueDate) < now) {
      payment.status = 'OVERDUE';
    }
  }
}

function recordLoanPayment(state: WorkflowState, payload: Record<string, unknown>) {
  state.loanPaymentBodies.push(clone(payload));
  const loanId = String(payload['loanId'] || '');
  const paymentNumber = toNumber(payload['paymentNumber']);
  const payment = state.loanPayments.find((item) => item.loanId === loanId && item.paymentNumber === paymentNumber);
  if (!payment) {
    return;
  }

  payment.status = 'PAID';
  payment.paidDate = toIso(String(payload['paidDate'] || state.today), '00:00');
  payment.paymentMethod = String(payload['paymentMethod'] || 'BANK_TRANSFER');
  payment.reference = String(payload['reference'] || '');
  payment.notes = String(payload['notes'] || '');
  payment.paidByName = state.user.fullName;

  const loan = getLoan(state, loanId);
  if (loan) {
    loan.totalPaid += payment.principalAmount;
    loan.remainingBalance = Math.max(0, loan.principal - loan.totalPaid);
    if (loan.remainingBalance === 0) {
      loan.status = 'COMPLETED';
    }
  }
}

function getWallet(state: WorkflowState, walletId: string): WalletFixture | undefined {
  return state.wallets.find((wallet) => wallet._id === walletId);
}

function approveTopUp(state: WorkflowState, topUpId: string, payload: Record<string, unknown>): void {
  const request = state.pendingTopUps.find((item) => item._id === topUpId);
  if (!request) {
    return;
  }

  const wallet = getWallet(state, request.walletId);
  if (!wallet) {
    return;
  }

  state.topUpApprovalBodies.push({ topUpId, payload: clone(payload) });

  const approvedAt = new Date().toISOString();
  const balanceBefore = wallet.balance;
  const balanceAfter = balanceBefore + request.amount;

  wallet.balance = balanceAfter;
  wallet.totalTopUp += request.amount;
  wallet.lastTransactionAt = approvedAt;

  state.ledgerEntries.unshift({
    _id: `ledger-approved-${topUpId}`,
    walletId: wallet._id,
    userId: wallet.userId._id,
    type: 'TOP_UP',
    status: 'COMPLETED',
    amount: request.amount,
    balanceBefore,
    balanceAfter,
    description: TOP_UP_LEDGER_DESCRIPTION,
    createdAt: approvedAt,
  });

  state.pendingTopUps = state.pendingTopUps.filter((item) => item._id !== topUpId);
}

function approveInvoice(state: WorkflowState, invoiceId: string, payload: Record<string, unknown>): void {
  const invoice = state.invoices.find((item) => item._id === invoiceId);
  if (!invoice) {
    return;
  }

  state.invoiceApprovalBodies.push({ invoiceId, payload: clone(payload) });

  invoice.status = 'APPROVED';
  invoice.approvalImage = String(payload['approvalImage'] || dataUrlPng());
  invoice.updatedAt = new Date().toISOString();
}

function submitPayrollForReview(state: WorkflowState, payrollId: string): void {
  const payroll = state.payrolls.find((item) => item._id === payrollId);
  if (!payroll) {
    return;
  }

  state.payrollSubmitIds.push(payrollId);
  payroll.status = 'PENDING_REVIEW';
}

class AccountingWorkflowPage {
  constructor(private readonly page: Page) {}

  async goto(path: string): Promise<void> {
    await this.page.goto(appUrl(path));
    await this.page.waitForLoadState('domcontentloaded');
  }

  async pause(ms = 2_000): Promise<void> {
    await this.page.waitForTimeout(ms);
  }

  async slowFill(locator: Locator, value: string, delay = 30): Promise<void> {
    await expect(locator).toBeVisible({ timeout: 20_000 });
    await locator.click();
    await locator.fill('');
    await locator.pressSequentially(value, { delay });
  }

  async loginAsAccounting(): Promise<void> {
    await this.goto('/login');
    await expect(this.page.getByTestId('login-form')).toBeVisible();
    await this.slowFill(this.page.getByTestId('login-email'), 'accounting.demo@school.local');
    await this.pause(600);
    await this.slowFill(this.page.getByTestId('login-password'), '123456');
    await this.pause();
    await this.page.getByTestId('login-submit').click();
    await this.page.waitForURL(/\/app\/dashboard/, { timeout: 30_000 });
  }
}

async function installAccountingWorkflowRoutes(page: Page, state: WorkflowState): Promise<void> {
  const AUTH_LOGIN_API = new RegExp(`${API_PREFIX_PATTERN}/auth/login(?:\\?.*)?$`);
  const AUTH_LOGOUT_API = new RegExp(`${API_PREFIX_PATTERN}/auth/logout(?:\\?.*)?$`);
  const USERS_ME_API = new RegExp(`${API_PREFIX_PATTERN}/users/me(?:\\?.*)?$`);
  const NOTIFICATIONS_COUNT_API = new RegExp(`${API_PREFIX_PATTERN}/notifications/unread-count(?:\\?.*)?$`);
  const DASHBOARD_DAILY_TASKS_API = new RegExp(`${API_PREFIX_PATTERN}/dashboard/daily-tasks(?:\\?.*)?$`);
  const DASHBOARD_ACCOUNTING_API = new RegExp(`${API_PREFIX_PATTERN}/dashboard/accounting(?:\\?.*)?$`);
  const USERS_SALES_API = new RegExp(`${API_PREFIX_PATTERN}/users/sales(?:\\?.*)?$`);
  const USERS_TEACHERS_API = new RegExp(`${API_PREFIX_PATTERN}/users/teachers(?:\\?.*)?$`);
  const USERS_PARENTS_API = new RegExp(`${API_PREFIX_PATTERN}/users/parents(?:\\?.*)?$`);
  const STUDENTS_API = new RegExp(`${API_PREFIX_PATTERN}/students(?:\\?.*)?$`);
  const CLASSES_API = new RegExp(`${API_PREFIX_PATTERN}/classes(?:\\?.*)?$`);
  const WALLETS_API = new RegExp(`${API_PREFIX_PATTERN}/wallets(?:\\?.*)?$`);
  const WALLETS_PENDING_TOPUPS_API = new RegExp(`${API_PREFIX_PATTERN}/wallets/top-up/pending(?:\\?.*)?$`);
  const WALLETS_LEDGER_API = new RegExp(`${API_PREFIX_PATTERN}/wallets/ledger(?:\\?.*)?$`);
  const WALLETS_APPROVE_TOPUP_API = new RegExp(`${API_PREFIX_PATTERN}/wallets/top-up/([^/?]+)/approve(?:\\?.*)?$`);
  const WALLETS_ADJUST_API = new RegExp(`${API_PREFIX_PATTERN}/wallets/adjust(?:\\?.*)?$`);
  const BANK_ACCOUNTS_API = new RegExp(`${API_PREFIX_PATTERN}/financial-control/bank-accounts(?:\\?.*)?$`);
  const INVOICES_API = new RegExp(`${API_PREFIX_PATTERN}/invoices(?:\\?.*)?$`);
  const INVOICE_APPROVE_API = new RegExp(`${API_PREFIX_PATTERN}/invoices/([^/?]+)/approve(?:\\?.*)?$`);
  const INVOICE_UPLOAD_API = new RegExp(`${API_PREFIX_PATTERN}/invoices/receipt-upload(?:\\?.*)?$`);
  const PAYROLL_PREVIEW_API = new RegExp(`${API_PREFIX_PATTERN}/payroll/teacher-preview(?:\\?.*)?$`);
  const PAYROLL_LIST_API = new RegExp(`${API_PREFIX_PATTERN}/payroll(?:\\?.*)?$`);
  const PAYROLL_ITEMS_API = new RegExp(`${API_PREFIX_PATTERN}/payroll/([^/?]+)/items(?:\\?.*)?$`);
  const PAYROLL_SUBMIT_API = new RegExp(`${API_PREFIX_PATTERN}/payroll/([^/?]+)/submit(?:\\?.*)?$`);
  const STAFF_PAYROLL_MY_API = new RegExp(`${API_PREFIX_PATTERN}/staff-payroll/my(?:\\?.*)?$`);
  const STAFF_PAYROLL_SUMMARY_API = new RegExp(`${API_PREFIX_PATTERN}/staff-payroll/summary(?:\\?.*)?$`);
  const STAFF_PAYROLL_MARK_PAID_API = new RegExp(`${API_PREFIX_PATTERN}/staff-payroll/([^/?]+)/mark-paid(?:\\?.*)?$`);
  const STAFF_PAYROLL_API = new RegExp(`${API_PREFIX_PATTERN}/staff-payroll(?:\\?.*)?$`);
  const STAFF_PAYROLL_ONE_API = new RegExp(`${API_PREFIX_PATTERN}/staff-payroll/(?!summary(?:\\?|$)|my(?:\\?|$)|bulk-generate(?:\\?|$))([^/?]+)(?:\\?.*)?$`);
  const EXPENSES_STATS_API = new RegExp(`${API_PREFIX_PATTERN}/expenses/stats(?:\\?.*)?$`);
  const EXPENSE_APPROVE_API = new RegExp(`${API_PREFIX_PATTERN}/expenses/([^/?]+)/approve(?:\\?.*)?$`);
  const EXPENSE_MARK_PAID_API = new RegExp(`${API_PREFIX_PATTERN}/expenses/([^/?]+)/mark-paid(?:\\?.*)?$`);
  const EXPENSES_API = new RegExp(`${API_PREFIX_PATTERN}/expenses(?:\\?.*)?$`);
  const LOANS_SUMMARY_API = new RegExp(`${API_PREFIX_PATTERN}/loans/summary(?:\\?.*)?$`);
  const LOANS_PAYMENTS_LIST_API = new RegExp(`${API_PREFIX_PATTERN}/loans/payments/list(?:\\?.*)?$`);
  const LOANS_PAYMENTS_RECORD_API = new RegExp(`${API_PREFIX_PATTERN}/loans/payments/record(?:\\?.*)?$`);
  const LOANS_UPDATE_OVERDUE_API = new RegExp(`${API_PREFIX_PATTERN}/loans/update-overdue(?:\\?.*)?$`);
  const LOANS_ONE_API = new RegExp(`${API_PREFIX_PATTERN}/loans/(?!summary(?:\\?|$)|payments(?:/|\\?|$)|update-overdue(?:\\?|$))([^/?]+)(?:\\?.*)?$`);
  const LOANS_API = new RegExp(`${API_PREFIX_PATTERN}/loans(?:\\?.*)?$`);
  const FINANCIAL_CONTROL_DASHBOARD_API = new RegExp(`${API_PREFIX_PATTERN}/financial-control/dashboard(?:\\?.*)?$`);
  const FINANCIAL_CONTROL_PROVISIONAL_API = new RegExp(`${API_PREFIX_PATTERN}/financial-control/provisional-gross-profit(?:\\?.*)?$`);
  const FINANCIAL_CONTROL_ALERTS_API = new RegExp(`${API_PREFIX_PATTERN}/financial-control/alerts(?:\\?.*)?$`);
  const FINANCIAL_CONTROL_OVERVIEW_API = new RegExp(`${API_PREFIX_PATTERN}/financial-control/overview(?:\\?.*)?$`);
  const FINANCIAL_CONTROL_BANK_ACCOUNTS_API = new RegExp(`${API_PREFIX_PATTERN}/financial-control/bank-accounts(?:\\?.*)?$`);
  const FINANCIAL_CONTROL_BANK_TRANSACTIONS_API = new RegExp(`${API_PREFIX_PATTERN}/financial-control/bank-transactions(?:\\?.*)?$`);
  const FINANCIAL_CONTROL_BANK_RECONCILE_API = new RegExp(`${API_PREFIX_PATTERN}/financial-control/bank-transactions/([^/?]+)/reconcile(?:\\?.*)?$`);
  const FINANCIAL_CONTROL_FUNDS_API = new RegExp(`${API_PREFIX_PATTERN}/financial-control/funds(?:\\?.*)?$`);
  const FINANCIAL_CONTROL_FUND_TRANSACTIONS_API = new RegExp(`${API_PREFIX_PATTERN}/financial-control/fund-transactions(?:\\?.*)?$`);
  const FINANCIAL_CONTROL_CASHFLOW_API = new RegExp(`${API_PREFIX_PATTERN}/financial-control/cash-flow(?:\\?.*)?$`);
  const FINANCIAL_CONTROL_PNL_API = new RegExp(`${API_PREFIX_PATTERN}/financial-control/profit-and-loss(?:\\?.*)?$`);
  const FINANCIAL_CONTROL_RECONCILIATION_API = new RegExp(`${API_PREFIX_PATTERN}/financial-control/reconciliation(?:\\?.*)?$`);
  const EXPORT_API = new RegExp(`${API_PREFIX_PATTERN}/export/([^?]+)(?:\\?.*)?$`);
  
  await page.route(AUTH_LOGIN_API, async (route) => {
    const body = route.request().postDataJSON() as { email: string; password: string };
    state.loginBodies.push(clone(body));
    await jsonResponse(route, { user: clone(state.user) });
  });

  await page.route(AUTH_LOGOUT_API, async (route) => {
    await jsonResponse(route, { ok: true });
  });

  await page.route(USERS_ME_API, async (route) => {
    await jsonResponse(route, clone(state.user));
  });

  await page.route(NOTIFICATIONS_COUNT_API, async (route) => {
    await jsonResponse(route, { count: 3 });
  });

  await page.route(DASHBOARD_DAILY_TASKS_API, async (route) => {
    await jsonResponse(route, buildDailyTaskBoard(state));
  });

  await page.route(DASHBOARD_ACCOUNTING_API, async (route) => {
    await jsonResponse(route, buildAccountingDashboard(state));
  });

  await page.route(USERS_SALES_API, async (route) => {
    await jsonResponse(route, clone(state.sales));
  });

  await page.route(USERS_TEACHERS_API, async (route) => {
    await jsonResponse(route, clone(state.teachers));
  });

  await page.route(USERS_PARENTS_API, async (route) => {
    await jsonResponse(route, [
      {
        _id: state.parent._id,
        userCode: 'PH-001',
        fullName: state.parent.fullName,
        phone: state.parent.phone,
        role: state.parent.role,
      },
    ]);
  });

  await page.route(STUDENTS_API, async (route) => {
    await jsonResponse(route, clone(state.students));
  });

  await page.route(CLASSES_API, async (route) => {
    await jsonResponse(route, clone(state.classes));
  });

  await page.route(WALLETS_PENDING_TOPUPS_API, async (route) => {
    await jsonResponse(route, clone(state.pendingTopUps));
  });

  await page.route(BANK_ACCOUNTS_API, async (route) => {
    await jsonResponse(route, clone(state.bankAccounts));
  });

  await page.route(WALLETS_APPROVE_TOPUP_API, async (route) => {
    const match = route.request().url().match(WALLETS_APPROVE_TOPUP_API);
    const topUpId = match?.[1] || '';
    const payload = route.request().postDataJSON() as Record<string, unknown>;
    approveTopUp(state, topUpId, payload);
    await jsonResponse(route, { ok: true });
  });

  await page.route(WALLETS_LEDGER_API, async (route) => {
    await jsonResponse(route, buildLedgerList(state, route.request().url()));
  });

  await page.route(WALLETS_ADJUST_API, async (route) => {
    const payload = route.request().postDataJSON() as Record<string, unknown>;
    state.adjustBodies.push(clone(payload));
    await jsonResponse(route, { ok: true });
  });

  await page.route(WALLETS_API, async (route) => {
    await jsonResponse(route, {
      data: buildWalletList(state),
      meta: {
        total: state.wallets.length,
        page: 1,
        limit: 50,
        totalPages: 1,
      },
    });
  });

  await page.route(INVOICE_UPLOAD_API, async (route) => {
    await jsonResponse(route, { url: dataUrlPng() });
  });

  await page.route(INVOICE_APPROVE_API, async (route) => {
    const match = route.request().url().match(INVOICE_APPROVE_API);
    const invoiceId = match?.[1] || '';
    const payload = route.request().postDataJSON() as Record<string, unknown>;
    approveInvoice(state, invoiceId, payload);
    await jsonResponse(route, { ok: true });
  });

  await page.route(INVOICES_API, async (route) => {
    await jsonResponse(route, clone(state.invoices));
  });

  await page.route(PAYROLL_PREVIEW_API, async (route) => {
    const url = new URL(route.request().url());
    const teacherId = url.searchParams.get('teacherId') || state.teachers[0]._id;
    const periodStart = url.searchParams.get('periodStart') || state.monthStart;
    const periodEnd = url.searchParams.get('periodEnd') || state.monthEnd;
    await jsonResponse(route, buildPayrollPreview(state, teacherId, periodStart, periodEnd));
  });

  await page.route(PAYROLL_ITEMS_API, async (route) => {
    const match = route.request().url().match(PAYROLL_ITEMS_API);
    const payrollId = match?.[1] || '';
    await jsonResponse(route, clone(state.payrollItemsById[payrollId] || []));
  });

  await page.route(PAYROLL_SUBMIT_API, async (route) => {
    const match = route.request().url().match(PAYROLL_SUBMIT_API);
    const payrollId = match?.[1] || '';
    submitPayrollForReview(state, payrollId);
    await jsonResponse(route, { ok: true });
  });

  await page.route(PAYROLL_LIST_API, async (route) => {
    await jsonResponse(route, buildPayrollListResult(state, route.request().url()));
  });

  await page.route(STAFF_PAYROLL_SUMMARY_API, async (route) => {
    await jsonResponse(route, {
      total: state.staffPayrolls.length,
      approved: state.staffPayrolls.filter((item) => item.status === 'APPROVED').length,
      paid: state.staffPayrolls.filter((item) => item.status === 'PAID').length,
    });
  });

  await page.route(STAFF_PAYROLL_MARK_PAID_API, async (route) => {
    const match = route.request().url().match(STAFF_PAYROLL_MARK_PAID_API);
    const payrollId = match?.[1] || '';
    const payload = route.request().postDataJSON() as { paymentRef?: string };
    markStaffPayrollPaid(state, payrollId, payload?.paymentRef);
    await jsonResponse(route, { ok: true });
  });

  await page.route(STAFF_PAYROLL_ONE_API, async (route) => {
    const match = route.request().url().match(STAFF_PAYROLL_ONE_API);
    const payrollId = match?.[1] || '';
    await jsonResponse(route, clone(getStaffPayroll(state, payrollId) || null));
  });

  await page.route(STAFF_PAYROLL_MY_API, async (route) => {
    await jsonResponse(route, { data: [], total: 0, page: 1, limit: 20 });
  });

  await page.route(STAFF_PAYROLL_API, async (route) => {
    await jsonResponse(route, buildStaffPayrollListResult(state, route.request().url()));
  });

  await page.route(EXPENSES_STATS_API, async (route) => {
    await jsonResponse(route, buildExpenseStats(state));
  });

  await page.route(EXPENSE_APPROVE_API, async (route) => {
    const match = route.request().url().match(EXPENSE_APPROVE_API);
    const expenseId = match?.[1] || '';
    approveExpenseItem(state, expenseId);
    await jsonResponse(route, { ok: true });
  });

  await page.route(EXPENSE_MARK_PAID_API, async (route) => {
    const match = route.request().url().match(EXPENSE_MARK_PAID_API);
    const expenseId = match?.[1] || '';
    const payload = route.request().postDataJSON() as Record<string, unknown>;
    markExpensePaid(state, expenseId, payload);
    await jsonResponse(route, { ok: true });
  });

  await page.route(EXPENSES_API, async (route) => {
    if (route.request().method() === 'POST') {
      const payload = route.request().postDataJSON() as Record<string, unknown>;
      createExpense(state, payload);
      await jsonResponse(route, { ok: true });
      return;
    }

    await jsonResponse(route, buildExpenseListResult(state, route.request().url()));
  });

  await page.route(LOANS_SUMMARY_API, async (route) => {
    await jsonResponse(route, buildLoanSummary(state));
  });

  await page.route(LOANS_PAYMENTS_LIST_API, async (route) => {
    await jsonResponse(route, buildLoanPaymentsResult(state, route.request().url()));
  });

  await page.route(LOANS_PAYMENTS_RECORD_API, async (route) => {
    const payload = route.request().postDataJSON() as Record<string, unknown>;
    recordLoanPayment(state, payload);
    await jsonResponse(route, { ok: true });
  });

  await page.route(LOANS_UPDATE_OVERDUE_API, async (route) => {
    updateOverdueLoans(state);
    await jsonResponse(route, { ok: true });
  });

  await page.route(LOANS_ONE_API, async (route) => {
    const match = route.request().url().match(LOANS_ONE_API);
    const loanId = match?.[1] || '';
    await jsonResponse(route, clone(getLoan(state, loanId) || null));
  });

  await page.route(LOANS_API, async (route) => {
    await jsonResponse(route, buildLoanListResult(state, route.request().url()));
  });

  await page.route(FINANCIAL_CONTROL_DASHBOARD_API, async (route) => {
    await jsonResponse(route, buildFinancialControlDashboard(state));
  });

  await page.route(FINANCIAL_CONTROL_PROVISIONAL_API, async (route) => {
    await jsonResponse(route, buildProvisionalGrossProfit(state));
  });

  await page.route(FINANCIAL_CONTROL_ALERTS_API, async (route) => {
    await jsonResponse(route, buildFinancialAlerts(state));
  });

  await page.route(FINANCIAL_CONTROL_OVERVIEW_API, async (route) => {
    const cashFlow = buildCashFlow(state, 'http://localhost/financial-control/cash-flow?groupBy=month');
    await jsonResponse(route, {
      bankAccounts: {
        totalBalance: state.bankAccounts.reduce((sum, item) => sum + item.currentBalance, 0),
        accountCount: state.bankAccounts.length,
        accounts: clone(state.bankAccounts),
      },
      funds: {
        totalBalance: state.funds.reduce((sum, item) => sum + item.currentBalance, 0),
        fundCount: state.funds.length,
        warningCount: state.funds.filter((item) => item.currentBalance < item.minimumBalance).length,
        warnings: clone(state.funds.filter((item) => item.currentBalance < item.minimumBalance)),
        funds: clone(state.funds),
      },
      cashFlow: {
        totalInflow: cashFlow.totalInflow,
        totalOutflow: cashFlow.totalOutflow,
        netCashFlow: cashFlow.netCashFlow,
        recentMonths: cashFlow.timeline,
      },
      profitAndLoss: buildProfitAndLoss(state, 'http://localhost/financial-control/profit-and-loss?basis=cash'),
    });
  });

  await page.route(FINANCIAL_CONTROL_BANK_ACCOUNTS_API, async (route) => {
    await jsonResponse(route, clone(state.bankAccounts));
  });

  await page.route(FINANCIAL_CONTROL_BANK_RECONCILE_API, async (route) => {
    const match = route.request().url().match(FINANCIAL_CONTROL_BANK_RECONCILE_API);
    const transactionId = match?.[1] || '';
    reconcileBankTransaction(state, transactionId);
    await jsonResponse(route, { ok: true });
  });

  await page.route(FINANCIAL_CONTROL_BANK_TRANSACTIONS_API, async (route) => {
    if (route.request().method() === 'POST') {
      const payload = route.request().postDataJSON() as Record<string, unknown>;
      recordBankTransaction(state, payload);
      await jsonResponse(route, { ok: true });
      return;
    }

    const url = new URL(route.request().url());
    const bankAccountId = url.searchParams.get('bankAccountId') || '';
    const type = url.searchParams.get('type') || '';
    const keyword = (url.searchParams.get('keyword') || '').trim().toLowerCase();
    const startDate = url.searchParams.get('startDate') || '';
    const endDate = url.searchParams.get('endDate') || '';

    const data = state.bankTransactions.filter((item) => {
      if (bankAccountId && item.bankAccountId !== bankAccountId) {
        return false;
      }
      if (type && item.type !== type) {
        return false;
      }
      if (keyword) {
        const haystack = `${item.transactionCode} ${item.description || ''} ${item.reference || ''}`.toLowerCase();
        if (!haystack.includes(keyword)) {
          return false;
        }
      }
      if ((startDate || endDate) && !matchesDateRange(item.transactionDate, startDate, endDate)) {
        return false;
      }
      return true;
    });

    await jsonResponse(route, clone(data));
  });

  await page.route(FINANCIAL_CONTROL_FUNDS_API, async (route) => {
    await jsonResponse(route, clone(state.funds));
  });

  await page.route(FINANCIAL_CONTROL_FUND_TRANSACTIONS_API, async (route) => {
    if (route.request().method() === 'POST') {
      const payload = route.request().postDataJSON() as Record<string, unknown>;
      recordFundTransaction(state, payload);
      await jsonResponse(route, { ok: true });
      return;
    }

    const url = new URL(route.request().url());
    const fundId = url.searchParams.get('fundId') || '';
    const startDate = url.searchParams.get('startDate') || '';
    const endDate = url.searchParams.get('endDate') || '';

    const data = state.fundTransactions.filter((item) => {
      if (fundId && item.fundId !== fundId) {
        return false;
      }
      if ((startDate || endDate) && !matchesDateRange(item.transactionDate, startDate, endDate)) {
        return false;
      }
      return true;
    });

    await jsonResponse(route, clone(data));
  });

  await page.route(FINANCIAL_CONTROL_CASHFLOW_API, async (route) => {
    await jsonResponse(route, buildCashFlow(state, route.request().url()));
  });

  await page.route(FINANCIAL_CONTROL_PNL_API, async (route) => {
    await jsonResponse(route, buildProfitAndLoss(state, route.request().url()));
  });

  await page.route(FINANCIAL_CONTROL_RECONCILIATION_API, async (route) => {
    await jsonResponse(route, buildReconciliation(state));
  });

  await page.route(EXPORT_API, async (route) => {
    const match = route.request().url().match(EXPORT_API);
    const endpoint = match?.[1] || 'export';
    const query = Object.fromEntries(new URL(route.request().url()).searchParams.entries());
    state.exportCalls.push({ endpoint, query });

    await route.fulfill({
      status: 200,
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="${endpoint.replace(/\//g, '-')}.csv"`,
      },
      body: 'code,name,amount\nACC-001,Demo,1000\n',
    });
  });
}

test.describe.skip('Accounting master workflow legacy', () => {
  test('records the full accounting master workflow with HD demo pacing', async ({ page }) => {
    test.setTimeout(120_000);

    const state = buildAccountingWorkflowState();
    const ui = new AccountingWorkflowPage(page);

    await installAccountingWorkflowRoutes(page, state);

    await test.step('Step 1 - Đăng nhập kế toán và kiểm tra dashboard', async () => {
      // Bước 1: đăng nhập bằng tài khoản kế toán và xác nhận các khối thông tin quan trọng xuất hiện.
      await ui.loginAsAccounting();
      await expect(page).toHaveURL(/\/app\/dashboard/);
      await expect(page.getByRole('heading', { name: /(Dashboard Kế toán|Dashboard Ke toan)/i })).toBeVisible();
      await expect(page.getByText(/(Top-up chờ duyệt|Top-up cho duyet)/i).first()).toBeVisible();
      await expect(page.getByText(/(Hóa đơn chờ duyệt|Hoa don cho duyet)/i).first()).toBeVisible();
      await ui.pause();
    });

    await test.step('Step 2 - Duyệt top-up pending và kiểm tra Ledger', async () => {
      // Bước 2: mở ví, duyệt một top-up đang pending rồi kiểm tra giao dịch TOP_UP sinh ra trong Ledger.
      await ui.goto('/app/wallets');
      const pendingButton = page.getByRole('button', { name: /(Chờ duyệt|Cho duyet)/i });
      await expect(pendingButton).toBeVisible();
      await pendingButton.click();
      await expect(page.locator('.modal h3').filter({ hasText: /(Yêu cầu nạp tiền chờ duyệt|Yeu cau nap tien cho duyet)/i })).toBeVisible();
      await ui.pause();

      const pendingModal = page.locator('.modal.modal-lg');
      const pendingRow = pendingModal.locator('.pending-item').filter({ hasText: state.parent.fullName }).first();
      await expect(pendingRow).toBeVisible();
      await pendingRow.getByRole('button', { name: /(Duyệt|Duyet)/i }).click();
      await expect(page.locator('.modal h3').filter({ hasText: /(Duyệt yêu cầu nạp tiền|Duyet yeu cau nap tien)/i })).toBeVisible();
      await page.locator('select[name="bankAccountId"]').selectOption(state.bankAccounts[0]._id);
      await ui.slowFill(page.locator('textarea[name="accountingNotes"]'), 'Da doi soat bien lai va xac nhan top-up hop le.');
      await ui.pause();

      await page.getByRole('button', { name: /(Xác nhận duyệt|Xac nhan duyet)/i }).click();
      await expect.poll(() => state.topUpApprovalBodies.length).toBe(1);
      await expect(pendingModal).toContainText(/(Không có yêu cầu nào|Khong co yeu cau nao)/i);
      await ui.pause();

      await pendingModal.getByRole('button', { name: /(Đóng|Dong)/i }).click();
      await ui.pause();

      await page.getByRole('button', { name: /(Lịch sử giao dịch|Lich su giao dich)/i }).click();
      await expect(page.locator('.chip-top_up').first()).toBeVisible();
      const ledgerRow = page.locator('table.data tbody tr').first();
      await expect(ledgerRow).toContainText(/(Nạp tiền|Nap tien)/i);
      await expect(ledgerRow).toContainText(TOP_UP_LEDGER_DESCRIPTION);
      await ui.pause();
    });

    await test.step('Step 3 - Duyệt hóa đơn pending và kiểm tra RBAC nút Xóa', async () => {
      // Bước 3: lọc hóa đơn pending, upload ảnh đối ứng để duyệt, sau đó kiểm tra trạng thái APPROVED và nút Xóa không tồn tại.
      await ui.goto('/app/invoices');
      const invoiceFilters = page.locator('.filters-section .filter-row').nth(1).locator('select');
      await invoiceFilters.nth(1).selectOption('PENDING_APPROVAL');
      await ui.pause();

      const pendingInvoiceRow = page.getByTestId('invoice-row').filter({ hasText: state.invoices[0].invoiceNumber }).first();
      await expect(pendingInvoiceRow).toBeVisible();
      await pendingInvoiceRow.getByTestId('invoice-row-approve').click();
      await expect(page.getByTestId('invoice-approve-modal')).toBeVisible();
      await ui.pause();

      await page.getByTestId('invoice-approve-file').setInputFiles({
        name: 'invoice-approval-proof.png',
        mimeType: 'image/png',
        buffer: Buffer.from(TINY_PNG_BASE64, 'base64'),
      });
      await expect(page.getByRole('img', { name: /(Ảnh xác nhận|Anh xac nhan)/i })).toBeVisible();
      await ui.pause();

      const confirmMessage = await captureSingleDialog(page, async () => {
        await page.getByTestId('invoice-approve-confirm').click();
      });

      expect(confirmMessage).toContain(state.invoices[0].invoiceNumber);
      await expect.poll(() => state.invoiceApprovalBodies.length).toBe(1);
      await expect(page.getByTestId('invoice-approve-modal')).toHaveCount(0);
      await ui.pause();

      await invoiceFilters.nth(1).selectOption('APPROVED');
      const approvedInvoiceRow = page.getByTestId('invoice-row').filter({ hasText: state.invoices[0].invoiceNumber }).first();
      await expect(approvedInvoiceRow).toBeVisible();
      await expect(approvedInvoiceRow).toContainText(/(Đã duyệt|Da duyet)/i);
      await expect(approvedInvoiceRow.getByTestId('invoice-row-delete')).toHaveCount(0);
      await ui.pause();
    });

    await test.step('Step 4 - Kiểm tra payroll preview và gửi duyệt kỳ lương draft', async () => {
      // Bước 4: UI hiện tại của ACCOUNTING hiển thị cột phạt ở tab Preview,
      // còn thao tác trên bảng lương draft là "Gửi duyệt" thay vì nút "Duyệt".
      await ui.goto('/app/payroll');
      const previewFilterBar = page.locator('.filter-bar').first();
      await previewFilterBar.locator('select').selectOption(state.teachers[0]._id);
      const previewDates = previewFilterBar.locator('input[type="date"]');
      await previewDates.nth(0).fill(state.monthStart);
      await previewDates.nth(1).fill(state.monthEnd);
      await ui.pause();
      await previewFilterBar.getByRole('button', { name: /(Xem|View)/i }).click();
      await expect(page.locator('.session-table')).toBeVisible();
      await expect(page.locator('.late-penalty-amount')).toBeVisible();
      await expect(page.locator('.late-badge')).toBeVisible();
      await ui.pause();

      await page.getByRole('button', { name: /^(Bảng lương|Bang luong)$/i }).click();
      await ui.pause();

      const payrollFilterBar = page.locator('.filter-bar').first();
      await payrollFilterBar.locator('select').nth(1).selectOption('DRAFT');
      await payrollFilterBar.getByRole('button', { name: /(Tìm|Tim)/i }).click();
      const payrollRow = page.locator('table.data-table tbody tr').filter({ hasText: 'PAY-ACC-001' }).first();
      await expect(payrollRow).toBeVisible();
      await ui.pause();

      await payrollRow.getByRole('button', { name: /(Gửi duyệt|Gui duyet)/i }).click();
      await expect.poll(() => state.payrollSubmitIds.length).toBe(1);
      await expect(page.locator('.notification')).toContainText(/(Đã gửi duyệt|Da gui duyet)/i);
      await payrollFilterBar.locator('select').nth(1).selectOption('PENDING_REVIEW');
      const pendingReviewRow = page.locator('table.data-table tbody tr').filter({ hasText: 'PAY-ACC-001' }).first();
      await expect(pendingReviewRow).toContainText(/(Chờ duyệt|Cho duyet)/i);
      await ui.pause();
    });

    await test.step('Step 5 - Kiểm tra RBAC trên màn học sinh', async () => {
      // Bước 5: UI hiện tại của ACCOUNTING chỉ có list view ở màn học sinh,
      // nên kiểm tra RBAC trực tiếp trên dòng dữ liệu thay cho trang chi tiết riêng.
      await ui.goto('/app/students');
      const studentRow = page.locator('table tbody tr').filter({ hasText: state.students[0].fullName }).first();
      await expect(studentRow).toBeVisible();
      await expect(studentRow.getByRole('button', { name: /(Edit|Sửa|Sua)/i })).toHaveCount(0);
      await expect(studentRow.getByRole('button', { name: /(Delete|Xóa|Xoa)/i })).toHaveCount(0);
      await ui.pause();
    });

    await test.step('Step 6 - Kiểm tra validation audit khi điều chỉnh ví', async () => {
      // Bước 6: UI hiện tại dùng amount dương + chiều SUBTRACT thay cho nhập số âm trực tiếp.
      // Bỏ trống lý do để xác nhận validation bắt buộc xuất hiện và request không được gửi đi.
      await ui.goto('/app/wallets');
      const walletRow = page.locator('table.data tbody tr').filter({ hasText: state.parent.fullName }).first();
      await expect(walletRow).toBeVisible();
      await walletRow.getByTestId('wallet-adjust-button').click();
      const adjustModal = page.getByTestId('wallet-adjust-modal');
      await expect(adjustModal).toBeVisible();
      await ui.pause();

      await page.getByTestId('wallet-adjust-direction').selectOption('SUBTRACT');
      await page.getByTestId('wallet-adjust-amount').fill('50000');
      await ui.slowFill(page.getByTestId('wallet-adjust-description'), 'Dieu chinh am de kiem tra audit validation.');
      await ui.pause();

      await page.getByTestId('wallet-adjust-submit').click();
      await expect(page.getByTestId('wallet-adjust-reason-error')).toContainText(/(Lý do điều chỉnh là bắt buộc|Ly do dieu chinh la bat buoc)/i);
      await expect(page.getByTestId('wallet-adjust-preview-delta')).toContainText('-');
      expect(state.adjustBodies).toHaveLength(0);
      await ui.pause();

      await adjustModal.getByRole('button', { name: /^(Hủy|Huy)$/i }).click();
      await expect(page.getByTestId('wallet-adjust-modal')).toHaveCount(0);
      await ui.pause();
    });

    await test.step('Step 7 - Đăng xuất khỏi hệ thống', async () => {
      // Bước 7: đăng xuất ở sidebar và xác nhận quay về trang đăng nhập.
      await page.locator('aside .logout').click();
      await expect(page).toHaveURL(/\/login/);
      await expect(page.getByTestId('login-form')).toBeVisible();
      await ui.pause();
    });
  });
});

test.describe.skip('Accounting full workflow video legacy', () => {
  test(VIDEO_TEST_TITLE, async ({ page, context }) => {
    test.setTimeout(360_000);

    const state = buildAccountingWorkflowState();
    const ui = new AccountingWorkflowPage(page);
    const cues: NarrationCue[] = [];
    const artifactDir = path.join(META_DIR, `accounting-demo-${Date.now()}`);
    const recordingStartedAt = Date.now();
    let savedVideoPath: string | null = null;

    await ensureEvidenceDirs();
    await mkdir(artifactDir, { recursive: true });
    await installAccountingWorkflowRoutes(page, state);
    await installVideoOverlay(page);

    try {
      pushNarrationCue(
        cues,
        recordingStartedAt,
        'intro',
        'Xin chào. Đây là video walkthrough đầy đủ cho vai trò kế toán, đi qua các luồng ví, hóa đơn, lương, chi phí, vốn vay, kiểm soát tài chính và xuất báo cáo.',
      );
      await showTitleCard(
        page,
        'Hướng dẫn đầy đủ vai trò Kế toán',
        'Video này mô phỏng toàn bộ luồng làm việc chính của kế toán trên hệ thống.',
        [
          'Chú thích tiếng Việt theo từng cảnh và từng bước thao tác.',
          'Khoanh đỏ vùng cần tập trung để dễ quay lại đào tạo nội bộ.',
          'Mỗi cảnh đều có lời dẫn AI để giải thích mục tiêu nghiệp vụ.',
        ],
      );

      pushNarrationCue(
        cues,
        recordingStartedAt,
        'dashboard',
        'Bắt đầu từ dashboard kế toán. Đây là nơi nhìn nhanh yêu cầu top-up, hóa đơn chờ duyệt và các đầu việc tài chính cần ưu tiên trong ngày.',
      );
      await ui.loginAsAccounting();
      await setVideoLabel(page, 'Bước 1. Đăng nhập kế toán và đọc dashboard để nắm các việc phải xử lý trong ngày.');
      await expect(page).toHaveURL(/\/app\/dashboard/);
      await expect(page.getByRole('heading', { name: /(Dashboard Kế toán|Dashboard Ke toan)/i })).toBeVisible();
      const topUpTask = page.getByText(/(Top-up chờ duyệt|Top-up cho duyet)/i).first();
      await expect(topUpTask).toBeVisible();
      await setVideoCallout(page, topUpTask, 'Dashboard đang báo có yêu cầu nạp ví cần kế toán xác nhận.');
      await ui.pause(2200);
      await setVideoCallout(page, null, null);

      pushNarrationCue(
        cues,
        recordingStartedAt,
        'wallets',
        'Luồng ví bắt đầu từ duyệt top-up, sau đó kiểm tra lại ledger và kiểm tra validation khi điều chỉnh số dư. Điểm quan trọng là luôn đối chiếu biến động sau khi thao tác.',
      );
      await ui.goto('/app/wallets');
      await setVideoLabel(page, 'Bước 2. Vào Wallets để duyệt top-up, kiểm tra Ledger và xem validation audit của điều chỉnh ví.');
      const pendingButton = page.getByRole('button', { name: /(Chờ duyệt|Cho duyet)/i });
      await setVideoCallout(page, pendingButton, 'Mở danh sách top-up đang chờ kế toán duyệt.');
      await clickLocator(page, pendingButton);
      const pendingModal = page.locator('.modal.modal-lg');
      await expect(pendingModal).toBeVisible();
      await ui.pause(1200);

      const pendingRow = pendingModal.locator('.pending-item').filter({ hasText: state.parent.fullName }).first();
      await setVideoCallout(page, pendingRow, 'Kiểm tra đúng phụ huynh, số tiền, mã giao dịch và ảnh biên lai trước khi duyệt.');
      await clickLocator(page, pendingRow.getByRole('button', { name: /(Duyệt|Duyet)/i }));
      await expect(page.locator('select[name="bankAccountId"]')).toBeVisible();
      await page.locator('select[name="bankAccountId"]').selectOption(state.bankAccounts[0]._id);
      await ui.slowFill(page.locator('textarea[name="accountingNotes"]'), 'Đã đối soát biên lai, mã giao dịch và xác nhận top-up hợp lệ.');
      await setVideoCallout(
        page,
        page.getByRole('button', { name: /(Xác nhận duyệt|Xac nhan duyet)/i }),
        'Bước này cộng tiền vào ví và sinh bút toán TOP_UP trong ledger.',
      );
      await clickLocator(page, page.getByRole('button', { name: /(Xác nhận duyệt|Xac nhan duyet)/i }));
      await expect.poll(() => state.topUpApprovalBodies.length).toBe(1);
      await expect(pendingModal).toContainText(/(Không có yêu cầu nào|Khong co yeu cau nao)/i);
      await ui.pause(1500);
      await clickLocator(page, pendingModal.getByRole('button', { name: /(Đóng|Dong)/i }));
      await clickLocator(page, page.getByRole('button', { name: /(Lịch sử giao dịch|Lich su giao dich)/i }));

      const ledgerRow = page.locator('table.data tbody tr').first();
      await expect(ledgerRow).toContainText(TOP_UP_LEDGER_DESCRIPTION);
      await setVideoCallout(page, ledgerRow, 'Sau khi duyệt xong, kế toán phải quay lại ledger để nhìn đúng dòng TOP_UP vừa sinh ra.');
      await ui.pause(1800);
      await setVideoCallout(page, null, null);

      await ui.goto('/app/wallets');
      await setVideoLabel(page, 'Bước 2. Kiểm tra thêm validation điều chỉnh ví để đảm bảo mọi thao tác đều có dấu vết audit.');
      const walletRow = page.locator('table.data tbody tr').filter({ hasText: state.parent.fullName }).first();
      await clickLocator(page, walletRow.getByTestId('wallet-adjust-button'));
      const adjustModal = page.getByTestId('wallet-adjust-modal');
      await expect(adjustModal).toBeVisible();
      await setVideoCallout(page, adjustModal, 'Luồng điều chỉnh ví luôn cần lý do audit. Hệ thống sẽ chặn nếu thiếu lý do.');
      await page.getByTestId('wallet-adjust-direction').selectOption('SUBTRACT');
      await page.getByTestId('wallet-adjust-amount').fill('50000');
      await ui.slowFill(page.getByTestId('wallet-adjust-description'), 'Kiểm tra tình huống trừ ví nhưng chưa nhập lý do audit.');
      await page.getByTestId('wallet-adjust-submit').click();
      await expect(page.getByTestId('wallet-adjust-reason-error')).toContainText(/(Lý do điều chỉnh là bắt buộc|Ly do dieu chinh la bat buoc)/i);
      expect(state.adjustBodies).toHaveLength(0);
      await ui.pause(1600);
      await clickLocator(page, adjustModal.getByRole('button', { name: /^(Hủy|Huy)$/i }));
      await expect(page.getByTestId('wallet-adjust-modal')).toHaveCount(0);
      await setVideoCallout(page, null, null);

      pushNarrationCue(
        cues,
        recordingStartedAt,
        'invoices',
        'Tiếp theo là hóa đơn. Kế toán lọc hóa đơn chờ duyệt, đối chiếu chứng từ thanh toán, duyệt ảnh xác nhận và sau đó kiểm tra trạng thái đã chuyển sang approved.',
      );
      await ui.goto('/app/invoices');
      await setVideoLabel(page, 'Bước 3. Vào Invoices để duyệt hóa đơn chờ xác nhận thanh toán.');
      const invoiceFilters = page.locator('.filters-section .filter-row').nth(1).locator('select');
      await invoiceFilters.nth(1).selectOption('PENDING_APPROVAL');
      const pendingInvoiceRow = page.getByTestId('invoice-row').filter({ hasText: state.invoices[0].invoiceNumber }).first();
      await expect(pendingInvoiceRow).toBeVisible();
      await setVideoCallout(page, pendingInvoiceRow, 'Hóa đơn đang ở trạng thái chờ duyệt và có đủ thông tin học sinh, lớp, sale và số tiền.');
      await clickLocator(page, pendingInvoiceRow.getByTestId('invoice-row-approve'));
      await expect(page.getByTestId('invoice-approve-modal')).toBeVisible();
      await page.getByTestId('invoice-approve-file').setInputFiles({
        name: 'invoice-approval-proof.png',
        mimeType: 'image/png',
        buffer: Buffer.from(TINY_PNG_BASE64, 'base64'),
      });
      await ui.pause(1000);
      await setVideoCallout(page, page.getByTestId('invoice-approve-confirm'), 'Ảnh xác nhận duyệt được upload trước khi chốt hóa đơn.');
      const confirmMessage = await captureSingleDialog(page, async () => {
        await page.getByTestId('invoice-approve-confirm').click();
      });
      expect(confirmMessage).toContain(state.invoices[0].invoiceNumber);
      await expect.poll(() => state.invoiceApprovalBodies.length).toBe(1);
      await invoiceFilters.nth(1).selectOption('APPROVED');
      const approvedInvoiceRow = page.getByTestId('invoice-row').filter({ hasText: state.invoices[0].invoiceNumber }).first();
      await expect(approvedInvoiceRow).toContainText(/(Đã duyệt|Da duyet)/i);
      await ui.pause(1800);
      await setVideoCallout(page, null, null);

      pushNarrationCue(
        cues,
        recordingStartedAt,
        'teacher-payroll',
        'Phần payroll giáo viên luôn phải đọc từ preview trước. Kế toán nhìn các buổi đủ điều kiện, buổi bị chặn vì thiếu báo cáo hoặc chờ xác nhận, rồi mới gửi bảng lương draft sang bước duyệt.',
      );
      await ui.goto('/app/payroll');
      await setVideoLabel(page, 'Bước 4. Mở Payroll giáo viên để xem preview từng buổi học rồi gửi bảng lương draft đi duyệt.');
      const previewFilterBar = page.locator('.filter-bar').first();
      await previewFilterBar.locator('select').selectOption(state.teachers[0]._id);
      const previewDates = previewFilterBar.locator('input[type="date"]');
      await previewDates.nth(0).fill(state.monthStart);
      await previewDates.nth(1).fill(state.monthEnd);
      await clickLocator(page, previewFilterBar.getByRole('button', { name: /(Xem|View)/i }));
      await expect(page.locator('.session-table')).toBeVisible();
      const previewRow = page.locator('.session-table tbody tr').first();
      await setVideoCallout(page, previewRow, 'Bảng preview cho thấy buổi đủ điều kiện, buổi thiếu teaching report và cả mức phạt nộp báo cáo trễ.');
      await ui.pause(2200);
      await clickLocator(page, page.locator('.tab-bar').getByRole('button', { name: /^(Bảng lương|Bang luong)$/i }));

      const payrollFilterBar = page.locator('.filter-bar').first();
      await payrollFilterBar.locator('select').nth(1).selectOption('DRAFT');
      await clickLocator(page, payrollFilterBar.getByRole('button', { name: /(Tìm|Tim)/i }));
      const payrollRow = page.locator('table.data-table tbody tr').filter({ hasText: 'PAY-ACC-001' }).first();
      await expect(payrollRow).toBeVisible();
      await setVideoCallout(page, payrollRow, 'Đây là bảng lương draft. Kế toán gửi duyệt chứ chưa tự phê duyệt.');
      await clickLocator(page, payrollRow.getByRole('button', { name: /(Gửi duyệt|Gui duyet)/i }));
      await expect.poll(() => state.payrollSubmitIds.length).toBe(1);
      await payrollFilterBar.locator('select').nth(1).selectOption('PENDING_REVIEW');
      await clickLocator(page, payrollFilterBar.getByRole('button', { name: /(Tìm|Tim)/i }));
      const pendingReviewRow = page.locator('table.data-table tbody tr').filter({ hasText: 'PAY-ACC-001' }).first();
      await expect(pendingReviewRow).toContainText(/(Chờ duyệt|Cho duyet)/i);
      await ui.pause(1700);
      await setVideoCallout(page, null, null);

      pushNarrationCue(
        cues,
        recordingStartedAt,
        'staff-payroll',
        'Với lương nhân sự nội bộ, kế toán thường mở chi tiết để kiểm tra cấu phần lương, thưởng KPI, phạt muộn và chứng từ, rồi đánh dấu đã thanh toán khi tiền thực sự ra khỏi tài khoản.',
      );
      await ui.goto('/app/staff-payroll');
      await setVideoLabel(page, 'Bước 5. Kiểm tra bảng lương nhân viên, mở chi tiết cấu phần lương và đánh dấu đã trả.');
      const staffPayrollRow = page.locator('table.data tbody tr').filter({ hasText: 'SP-ACC-001' }).first();
      await expect(staffPayrollRow).toBeVisible();
      await setVideoCallout(page, staffPayrollRow, 'Bảng lương này đã được duyệt và đang chờ kế toán xác nhận chi tiền.');
      await clickLocator(page, staffPayrollRow);
      const staffDetailModal = page.locator('.modal.wide').filter({ hasText: /SP-ACC-001/i });
      await expect(staffDetailModal).toBeVisible();
      await ui.pause(1300);
      await clickLocator(page, staffDetailModal.getByRole('button', { name: /(Đánh dấu đã trả|Danh dau da tra)/i }));
      const markPaidModal = page.locator('.modal').filter({ hasText: /(Đánh dấu đã thanh toán|Danh dau da thanh toan)/i });
      await expect(markPaidModal).toBeVisible();
      await setVideoCallout(page, markPaidModal, 'Kế toán nhập mã chứng từ hoặc mã giao dịch để hoàn tất dấu vết thanh toán.');
      await ui.slowFill(markPaidModal.locator('input').first(), 'UNC-SP-ACC-001');
      await clickLocator(page, markPaidModal.getByRole('button', { name: /(Xác nhận|Xac nhan)/i }));
      await expect.poll(() => state.staffPayrollPaidBodies.length).toBe(1);
      await expect(page.locator('table.data tbody tr').filter({ hasText: 'SP-ACC-001' }).first()).toContainText(/(Đã thanh toán|Da thanh toan)/i);
      await ui.pause(1700);
      await setVideoCallout(page, null, null);

      pushNarrationCue(
        cues,
        recordingStartedAt,
        'expenses',
        'Luồng chi phí khác gồm ba bước rõ ràng: tạo phiếu chi, duyệt phiếu, rồi đánh dấu đã chi kèm phương thức thanh toán. Đây là phần kế toán dùng rất thường xuyên trong ngày.',
      );
      await ui.goto('/app/expenses');
      await setVideoLabel(page, 'Bước 6. Tạo phiếu chi mới, duyệt phiếu và đánh dấu đã chi theo đúng vòng đời nghiệp vụ.');
      const createExpenseTitle = 'Mua văn phòng phẩm cho lớp mới';
      await clickLocator(page, page.getByRole('button', { name: /\+ Tạo phiếu chi/i }));
      const expenseCreateModal = page.locator('.modal').filter({ hasText: /(Tạo phiếu chi mới|Sửa phiếu chi)/i });
      await expect(expenseCreateModal).toBeVisible();
      await ui.slowFill(expenseCreateModal.locator('input[name="title"]'), createExpenseTitle);
      await ui.slowFill(expenseCreateModal.locator('textarea[name="description"]'), 'Mua bút, giấy kiểm tra và sổ theo dõi cho đầu tháng.');
      await expenseCreateModal.locator('input[name="amount"]').fill('480000');
      await expenseCreateModal.locator('input[name="expenseDate"]').fill(state.today);
      await expenseCreateModal.locator('select[name="category"]').selectOption('SUPPLIES');
      await ui.slowFill(expenseCreateModal.locator('textarea[name="notes"]'), 'Phiếu chi dùng để demo quy trình kế toán.');
      await clickLocator(page, expenseCreateModal.getByRole('button', { name: /^Tạo$/i }));
      await expect.poll(() => state.expenseCreateBodies.length).toBe(1);

      const expenseRow = page.locator('table.data tbody tr').filter({ hasText: createExpenseTitle }).first();
      await expect(expenseRow).toBeVisible();
      await setVideoCallout(page, expenseRow, 'Phiếu chi mới lên trạng thái chờ duyệt ngay sau khi tạo.');
      await captureSingleDialog(page, async () => {
        await clickLocator(page, expenseRow.getByRole('button', { name: /(Duyệt|Duyet)/i }));
      });
      await expect.poll(() => state.expenseApprovalIds.length).toBe(1);
      const approvedExpenseRow = page.locator('table.data tbody tr').filter({ hasText: createExpenseTitle }).first();
      await expect(approvedExpenseRow).toContainText(/(Đã duyệt, chưa chi|Da duyet, chua chi)/i);
      await clickLocator(page, approvedExpenseRow.getByRole('button', { name: /(Đã chi|Danh dau da chi)/i }));
      const payExpenseModal = page.locator('.modal').filter({ hasText: /(Xác nhận đã chi tiền|Xac nhan da chi tien)/i });
      await expect(payExpenseModal).toBeVisible();
      await payExpenseModal.locator('select').selectOption('BANK_TRANSFER');
      await payExpenseModal.locator('input[type="date"]').fill(state.today);
      await ui.slowFill(payExpenseModal.locator('textarea'), 'Chuyển khoản từ tài khoản ngân hàng chính.');
      await clickLocator(page, payExpenseModal.getByRole('button', { name: /(Xác nhận|Xac nhan)/i }));
      await expect.poll(() => state.expensePaidBodies.length).toBe(1);
      await expect(page.locator('table.data tbody tr').filter({ hasText: createExpenseTitle }).first()).toContainText(/(Đã chi|Da chi)/i);
      await ui.pause(1800);
      await setVideoCallout(page, null, null);

      pushNarrationCue(
        cues,
        recordingStartedAt,
        'loans',
        'Ở module vốn vay, kế toán theo dõi tổng nợ, cập nhật các kỳ quá hạn, mở lịch trả nợ rồi ghi nhận thanh toán từng kỳ để lịch sử và dư nợ cập nhật ngay.',
      );
      await ui.goto('/app/loans');
      await setVideoLabel(page, 'Bước 7. Theo dõi khoản vay, cập nhật kỳ quá hạn rồi ghi nhận thanh toán từng kỳ.');
      const overdueButton = page.getByRole('button', { name: /(Cập nhật quá hạn|Cap nhat qua han)/i });
      await setVideoCallout(page, overdueButton, 'Nút này rà soát các kỳ đến hạn để đưa đúng cảnh báo vào hệ thống.');
      await clickLocator(page, overdueButton);
      await expect.poll(() => state.loanOverdueRuns).toBe(1);
      await ui.pause(1200);

      await clickLocator(page, page.locator('.tab-bar').getByRole('button', { name: /(Danh sách|Danh sach)/i }));
      const loanRow = page.locator('table.data-table tbody tr').filter({ hasText: 'LOAN-ACC-001' }).first();
      await expect(loanRow).toBeVisible();
      await setVideoCallout(page, loanRow, 'Danh sách khoản vay cho thấy bên cho vay, dư nợ còn lại và thao tác mở lịch trả nợ.');
      await clickLocator(page, loanRow.getByRole('button', { name: /(Lịch trả nợ|Lich tra no)/i }));
      const overduePaymentRow = page.locator('table.data-table tbody tr').filter({ hasText: /(Quá hạn|Qua han)/i }).first();
      await expect(overduePaymentRow).toBeVisible();
      await setVideoCallout(page, overduePaymentRow, 'Kỳ này đã quá hạn nên kế toán có thể mở form ghi nhận thanh toán trực tiếp.');
      await clickLocator(page, overduePaymentRow.getByRole('button', { name: /(Ghi nhận trả|Ghi nhan tra)/i }));
      const loanPaymentModal = page.locator('.modal').filter({ hasText: /(Ghi nhận thanh toán kỳ|Ghi nhan thanh toan ky)/i });
      await expect(loanPaymentModal).toBeVisible();
      await loanPaymentModal.locator('select').selectOption('BANK_TRANSFER');
      await loanPaymentModal.locator('input[type="text"]').fill('UNC-LOAN-ACC-002');
      await ui.slowFill(loanPaymentModal.locator('textarea'), 'Thanh toán đúng chứng từ ngân hàng ngày hôm nay.');
      await clickLocator(page, loanPaymentModal.getByRole('button', { name: /(Ghi nhận thanh toán|Ghi nhan thanh toan)/i }));
      await expect.poll(() => state.loanPaymentBodies.length).toBe(1);
      await ui.pause(1200);
      await clickLocator(page, page.locator('.tab-bar').getByRole('button', { name: /(Lịch sử thanh toán|Lich su thanh toan)/i }));
      const loanHistoryRow = page.locator('table.data-table tbody tr').filter({ hasText: 'LP-ACC-002' }).first();
      await expect(loanHistoryRow).toContainText(state.user.fullName);
      await ui.pause(1700);
      await setVideoCallout(page, null, null);

      pushNarrationCue(
        cues,
        recordingStartedAt,
        'financial-overview',
        'Phần kiểm soát tài chính gom các chỉ số tiền mặt, nghĩa vụ phải trả, lợi nhuận tạm tính và cảnh báo vận hành. Đây là nơi kế toán nhìn toàn cảnh trước khi đối soát chi tiết.',
      );
      await ui.goto('/app/financial-control');
      await setVideoLabel(page, 'Bước 8. Kiểm soát tài chính: xem tổng quan tiền mặt, cảnh báo, ngân hàng, quỹ, dòng tiền, P&L và đối soát.');
      const cashSection = page.getByText(/(TÌNH HÌNH TIỀN MẶT|Tinh hinh tien mat)/i).first();
      const financialTabs = page.locator('.tab-bar button');
      await expect(cashSection).toBeVisible();
      await setVideoCallout(page, cashSection, 'Dashboard tài chính cho thấy tiền ngân hàng, quỹ, nghĩa vụ phải trả và vị thế nợ vay trong cùng một nơi.');
      await ui.pause(2200);

      await clickLocator(page, financialTabs.nth(1));
      await expect(page.getByText(/(Lợi nhuận gộp tạm tính|Loi nhuan gop tam tinh)/i).first()).toBeVisible();
      await ui.pause(1500);

      await clickLocator(page, financialTabs.nth(2));
      const alertCard = page.locator('.alert-card').first();
      await expect(alertCard).toBeVisible();
      await setVideoCallout(page, alertCard, 'Cảnh báo tài chính giúp kế toán biết ngay quỹ marketing thấp, giao dịch chưa đối soát hoặc kỳ vay quá hạn.');
      await ui.pause(1900);
      await setVideoCallout(page, null, null);

      pushNarrationCue(
        cues,
        recordingStartedAt,
        'bank-and-funds',
        'Sau phần tổng quan, kế toán đi xuống chi tiết ngân hàng và quỹ. Mỗi giao dịch mới đều phải có mô tả, chứng từ và bước đối soát để tránh lệch số dư cuối ngày.',
      );
      await clickLocator(page, financialTabs.nth(3));
      const bankCard = page.locator('[data-testid="bank-account-card-bank-account-accounting-001"]').first();
      await expect(bankCard).toBeVisible();
      await clickLocator(page, bankCard);
      await setVideoCallout(page, bankCard, 'Chọn tài khoản ngân hàng đang thao tác để lọc giao dịch đúng nguồn tiền.');
      await clickLocator(page, page.getByRole('button', { name: /\+ Ghi nhận giao dịch/i }));
      const bankTxModal = page.locator('.modal-backdrop .modal').last();
      await expect(bankTxModal.locator('input[name="amount"]')).toBeVisible();
      await bankTxModal.locator('select[name="type"]').selectOption('WITHDRAWAL');
      await bankTxModal.locator('select[name="category"]').selectOption('EXPENSE');
      await bankTxModal.locator('input[name="amount"]').fill('250000');
      await bankTxModal.locator('input[name="transactionDate"]').fill(state.today);
      await ui.slowFill(bankTxModal.locator('textarea[name="description"]'), 'Chi vận hành phát sinh trong ngày.');
      await ui.slowFill(bankTxModal.locator('input[name="reference"]'), 'BTX-DEMO-002');
      await clickLocator(page, bankTxModal.locator('button[type="submit"]'));
      await expect.poll(() => state.bankTransactionBodies.length).toBe(1);
      await ui.pause(1200);

      const unreconciledRow = page.locator('table.data tbody tr').filter({ hasText: 'BTX-ACC-003' }).first();
      await expect(unreconciledRow).toBeVisible();
      await setVideoCallout(page, unreconciledRow, 'Giao dịch mới tạo xong vẫn ở trạng thái chưa đối soát.');
      await captureSingleDialog(page, async () => {
        await clickLocator(page, unreconciledRow.getByRole('button', { name: /(Đối soát|Doi soat)/i }));
      });
      await expect.poll(() => state.reconciledBankTransactionIds.length).toBe(1);
      await ui.pause(1500);

      await clickLocator(page, financialTabs.nth(4));
      const marketingFundCard = page.locator('[data-testid="fund-card-fund-accounting-marketing"]').first();
      await expect(marketingFundCard).toBeVisible();
      await clickLocator(page, marketingFundCard);
      await setVideoCallout(page, marketingFundCard, 'Quỹ marketing đang dưới ngưỡng và cần bổ sung để đảm bảo ngân sách chạy ads.');
      await clickLocator(page, page.getByRole('button', { name: /(\+ Nạp\/Rút quỹ|\+ Nap\/Rut quy)/i }));
      const fundTxModal = page.locator('.modal-backdrop .modal').last();
      await expect(fundTxModal.locator('input[name="amount"]')).toBeVisible();
      await fundTxModal.locator('select[name="type"]').selectOption('DEPOSIT');
      await fundTxModal.locator('input[name="amount"]').fill('2000000');
      await fundTxModal.locator('input[name="transactionDate"]').fill(state.today);
      await ui.slowFill(fundTxModal.locator('textarea[name="description"]'), 'Bổ sung ngân sách marketing giữa tháng.');
      await ui.slowFill(fundTxModal.locator('input[name="reference"]'), 'FUND-DEMO-001');
      await clickLocator(page, fundTxModal.locator('button[type="submit"]'));
      await expect.poll(() => state.fundTransactionBodies.length).toBe(1);
      await ui.pause(1500);

      await clickLocator(page, financialTabs.nth(5));
      await expect(page.getByText(/(Tổng dòng tiền vào|Tong dong tien vao)/i).first()).toBeVisible();
      await ui.pause(1300);

      await clickLocator(page, financialTabs.nth(6));
      await expect(page.getByText(/P&L Report/i)).toBeVisible();
      await page.locator('select').last().selectOption('accrual');
      await ui.pause(1300);

      await clickLocator(page, financialTabs.nth(7));
      const reconCard = page.getByText(/(Chưa đối soát|Chua doi soat)/i).first();
      await expect(reconCard).toBeVisible();
      await setVideoCallout(page, reconCard, 'Tab đối soát tóm tắt số dư ngân hàng, quỹ, ví phụ huynh, nợ vay và các mục chưa reconcile.');
      await ui.pause(2000);
      await setVideoCallout(page, null, null);

      pushNarrationCue(
        cues,
        recordingStartedAt,
        'exports',
        'Cuối cùng là xuất báo cáo. Kế toán có thể tải CSV cho bảng lương, hóa đơn, sổ cái tài chính, học sinh và báo cáo đối soát quảng cáo để phục vụ phân tích hoặc gửi nội bộ.',
      );
      await ui.goto('/app/export-reports');
      await setVideoLabel(page, 'Bước 9. Xuất báo cáo CSV cho payroll, hóa đơn, tài chính và đối soát phục vụ báo cáo cuối ngày.');
      const payrollCard = page.locator('.export-card').filter({ hasText: /(Bảng lương|Bang luong)/i }).first();
      await payrollCard.locator('input[type="date"]').nth(0).fill(state.monthStart);
      await payrollCard.locator('input[type="date"]').nth(1).fill(state.monthEnd);
      await clickLocator(page, payrollCard.getByRole('button', { name: /(Xuất CSV|Xuat CSV)/i }));
      await expect.poll(() => state.exportCalls.length).toBe(1);
      await expect(page.locator('.message')).toContainText(/(thành công|thanh cong)/i);

      const financialCard = page.locator('.export-card').filter({ hasText: /(Tài chính|Tai chinh)/i }).first();
      await financialCard.locator('input[type="date"]').nth(0).fill(state.monthStart);
      await financialCard.locator('input[type="date"]').nth(1).fill(state.monthEnd);
      await setVideoCallout(page, financialCard, 'Cùng một màn hình, kế toán có thể tải nhiều gói CSV khác nhau tùy nhu cầu đối soát.');
      await clickLocator(page, financialCard.getByRole('button', { name: /(Xuất CSV|Xuat CSV)/i }));
      await expect.poll(() => state.exportCalls.length).toBe(2);
      await ui.pause(1700);
      await setVideoCallout(page, null, null);

      pushNarrationCue(
        cues,
        recordingStartedAt,
        'outro',
        'Như vậy toàn bộ các luồng chính của kế toán đã được mô phỏng xong. Từ đây có thể dùng video này để onboarding, đào tạo thao tác hoặc làm bằng chứng nghiệm thu giao diện.',
      );
      await showTitleCard(
        page,
        'Hoàn tất walkthrough Kế toán',
        'Video đã đi qua toàn bộ luồng chính của role kế toán với dữ liệu mô phỏng có trạng thái thay đổi thực.',
        [
          'Wallets: duyệt top-up, đọc ledger, kiểm tra validation điều chỉnh ví.',
          'Invoices và payroll: duyệt chứng từ, gửi duyệt, xác nhận chi.',
          'Expenses, loans, financial control, export reports: thao tác đủ vòng đời chính.',
        ],
      );

      await writeNarrationArtifacts(artifactDir, cues);
    } finally {
      savedVideoPath = await saveRecordedVideo(page, context);
    }

    expect(savedVideoPath).toBeTruthy();
  });
});
