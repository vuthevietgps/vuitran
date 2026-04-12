import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { expect, test, type BrowserContext, type Locator, type Page } from '@playwright/test';
import {
  acceptDialog,
  apiJson,
  applySessionCookies,
  approvalFile,
  createParentAccount,
  createPendingInvoice,
  ensureProductFixture,
  ensureSaleAccount,
  initializeWalletForParent,
  invoiceRow,
  loginAsCredentials,
  loginAsRole,
  roleEmail,
  rolePassword,
  uniquePhone,
} from './support';

const APP_BASE_URL =
  process.env['PLAYWRIGHT_BASE_URL'] ||
  process.env['E2E_BASE_URL'] ||
  'http://localhost:4200';

const RUN_DATE = process.env['UI_EVIDENCE_DATE'] || new Date().toISOString().slice(0, 10);
const DATE_STAMP = RUN_DATE.replace(/-/g, '');
const ROOT_DIR = path.resolve(process.cwd(), '../..');
const EVIDENCE_DIR = path.join(ROOT_DIR, 'frontend-ui-evidence', RUN_DATE);
const VIDEO_DIR = path.join(EVIDENCE_DIR, 'videos');
const RAW_VIDEO_DIR = path.join(VIDEO_DIR, 'raw');
const ARTIFACTS_DIR = path.join(EVIDENCE_DIR, 'b07-artifacts');
const FINAL_VIDEO_NAME = `UI_B07_Invoices_Wallets_Payroll_${DATE_STAMP}`;
const VIEWPORT = { width: 1600, height: 900 };

test.use({
  trace: 'off',
  launchOptions: { slowMo: 180 },
});

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function localDateString(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function timeString(date: Date): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function recentSchedule(durationMinutes = 60): {
  scheduledDate: string;
  actualStartIso: string;
  actualEndIso: string;
  startTime: string;
  endTime: string;
} {
  const actualEnd = new Date(Date.now() - (30 * 60 * 1000));
  const actualStart = new Date(actualEnd.getTime() - (durationMinutes * 60 * 1000));
  return {
    scheduledDate: localDateString(actualStart),
    actualStartIso: actualStart.toISOString(),
    actualEndIso: actualEnd.toISOString(),
    startTime: timeString(actualStart),
    endTime: timeString(actualEnd),
  };
}

function monthBounds(anchor: Date): { periodStart: string; periodEnd: string } {
  const start = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const end = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
  return {
    periodStart: localDateString(start),
    periodEnd: localDateString(end),
  };
}

async function ensureEvidenceDirs(): Promise<void> {
  await mkdir(VIDEO_DIR, { recursive: true });
  await mkdir(RAW_VIDEO_DIR, { recursive: true });
  await mkdir(ARTIFACTS_DIR, { recursive: true });
}

async function installOverlay(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const LABEL_ID = '__codex_video_label';
    const CURSOR_ID = '__codex_video_cursor';

    const ensureOverlay = () => {
      if (!document.body) return;

      let cursor = document.getElementById(CURSOR_ID) as HTMLDivElement | null;
      if (!cursor) {
        cursor = document.createElement('div');
        cursor.id = CURSOR_ID;
        cursor.style.position = 'fixed';
        cursor.style.left = '0';
        cursor.style.top = '0';
        cursor.style.width = '24px';
        cursor.style.height = '24px';
        cursor.style.borderRadius = '999px';
        cursor.style.border = '3px solid rgba(14, 165, 233, 0.92)';
        cursor.style.background = 'rgba(255,255,255,0.74)';
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
        label.style.maxWidth = '760px';
        label.style.padding = '10px 14px';
        label.style.borderRadius = '14px';
        label.style.background = 'rgba(15, 23, 42, 0.82)';
        label.style.color = '#e2e8f0';
        label.style.font = '600 15px/1.45 "Segoe UI", system-ui, sans-serif';
        label.style.boxShadow = '0 20px 44px rgba(15, 23, 42, 0.28)';
        label.style.pointerEvents = 'none';
        label.style.zIndex = '2147483646';
        label.style.opacity = '0';
        label.style.transition = 'opacity 150ms ease';
        document.body.appendChild(label);
      }

      window.addEventListener('mousemove', (event) => {
        cursor!.style.transform = `translate(${Math.round(event.clientX - 12)}px, ${Math.round(event.clientY - 12)}px)`;
      }, { passive: true });

      document.addEventListener('mousedown', () => {
        cursor!.style.width = '18px';
        cursor!.style.height = '18px';
        cursor!.style.borderColor = 'rgba(249, 115, 22, 0.95)';
      });

      document.addEventListener('mouseup', () => {
        cursor!.style.width = '24px';
        cursor!.style.height = '24px';
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

async function showTitleCard(page: Page, title: string, subtitle: string, bullets: string[]): Promise<void> {
  await page.setContent(`
    <style>
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background:
          radial-gradient(circle at top left, rgba(34,197,94,.24), transparent 35%),
          radial-gradient(circle at bottom right, rgba(59,130,246,.28), transparent 40%),
          linear-gradient(135deg, #020617 0%, #0f172a 45%, #1e293b 100%);
        color: #e2e8f0;
        font-family: "Segoe UI", system-ui, sans-serif;
      }
      .card {
        width: min(980px, calc(100vw - 80px));
        border: 1px solid rgba(148,163,184,.26);
        border-radius: 28px;
        padding: 40px 44px;
        background: rgba(15,23,42,.68);
        box-shadow: 0 24px 80px rgba(2,6,23,.45);
        backdrop-filter: blur(14px);
      }
      .eyebrow {
        display: inline-flex;
        padding: 8px 14px;
        border-radius: 999px;
        background: rgba(34,197,94,.14);
        color: #86efac;
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
        line-height: 1.5;
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
        color: #38bdf8;
      }
    </style>
    <div class="card">
      <div class="eyebrow">Playwright UI Recorder</div>
      <h1>${title}</h1>
      <p>${subtitle}</p>
      <ul>${bullets.map((item) => `<li>${item}</li>`).join('')}</ul>
    </div>
  `);
  await page.waitForTimeout(1600);
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

async function slowFill(page: Page, locator: Locator, value: string, delay = 55): Promise<void> {
  await clickLocator(page, locator);
  await locator.fill('');
  if (value) {
    await locator.pressSequentially(value, { delay });
  }
  await page.waitForTimeout(120);
}

async function loginViaUi(page: Page, email: string, password: string): Promise<void> {
  await page.goto(new URL('/login', APP_BASE_URL).toString());
  await page.waitForLoadState('networkidle');
  await slowFill(page, page.getByTestId('login-email'), email);
  await slowFill(page, page.getByTestId('login-password'), password);
  await clickLocator(page, page.getByTestId('login-submit'));
  await page.waitForURL(/\/app\//, { timeout: 20_000 });
}

async function switchSession(
  page: Page,
  session: any,
  targetPath: string,
  fallbackCredentials: { email: string; password: string },
): Promise<void> {
  await page.goto('about:blank');
  await page.context().clearCookies();
  await page.evaluate(() => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {
      // Ignore storage clearing on opaque origins such as about:blank.
    }
  });
  await applySessionCookies(page.context(), session);
  await page.goto(new URL(targetPath, APP_BASE_URL).toString());
  await page.waitForLoadState('networkidle');

  if (new URL(page.url(), APP_BASE_URL).pathname === '/login') {
    await loginViaUi(page, fallbackCredentials.email, fallbackCredentials.password);
    if (new URL(page.url(), APP_BASE_URL).pathname !== targetPath) {
      await page.goto(new URL(targetPath, APP_BASE_URL).toString());
      await page.waitForLoadState('networkidle');
    }
  }

  await page.waitForTimeout(900);
}

async function capture(page: Page, artifactDir: string, fileName: string): Promise<void> {
  await page.screenshot({
    path: path.join(artifactDir, fileName),
    fullPage: true,
  });
}

async function saveRecordedVideo(page: Page, context: BrowserContext): Promise<string | null> {
  const recordedVideo = page.video();
  await context.close();
  if (!recordedVideo) {
    return null;
  }

  const rawVideoPath = await recordedVideo.path();
  const finalVideoPath = path.join(VIDEO_DIR, `${FINAL_VIDEO_NAME}.webm`);
  await rm(finalVideoPath, { force: true });
  await rename(rawVideoPath, finalVideoPath);
  return finalVideoPath;
}

async function waitForEligiblePreview(
  request: Parameters<typeof apiJson>[0],
  directorSession: any,
  teacherId: string,
  periodStart: string,
  periodEnd: string,
): Promise<void> {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const preview = await apiJson<any>(
      request,
      directorSession,
      'GET',
      `/payroll/teacher-preview?teacherId=${teacherId}&periodStart=${periodStart}&periodEnd=${periodEnd}`,
    );

    if ((preview?.summary?.eligibleForPayroll || 0) > 0) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error('Teacher payroll preview never became eligible.');
}

test.describe('B07 invoices wallets payroll recorder', () => {
  test('records a long B07 finance workflow video', async ({ browser, request }) => {
    test.slow();
    test.setTimeout(480_000);

    await ensureEvidenceDirs();

    const directorSession = await loginAsRole(request, 'director');
    const accountingSession = await loginAsRole(request, 'accounting');
    const label = `B07${Date.now()}`;
    const digits = `${Date.now()}${Math.floor(Math.random() * 10000)}`.slice(-10);
    const artifactDir = path.join(ARTIFACTS_DIR, `b07-finance-video-${digits}`);
    const schedule = recentSchedule(60);
    const monthRange = monthBounds(new Date(schedule.actualEndIso));
    const invoiceNumber = `B07INV-${digits.slice(-6)}`;
    const parentTopUpAmount = 731000;
    const parentTopUpDescription = `B07 cash top up ${digits.slice(-4)}`;
    const teacherPayout = 123000;
    const invoiceAmount = 1810000;

    await mkdir(artifactDir, { recursive: true });

    const context = await browser.newContext({
      baseURL: APP_BASE_URL,
      locale: 'vi-VN',
      viewport: VIEWPORT,
      recordVideo: {
        dir: RAW_VIDEO_DIR,
        size: VIEWPORT,
      },
    });
    const page = await context.newPage();
    await installOverlay(page);

    const [product, sale, parent] = await Promise.all([
      ensureProductFixture(request, directorSession, label, 'ONLINE'),
      ensureSaleAccount(request, directorSession, label),
      createParentAccount(request, directorSession, label),
    ]);
    await initializeWalletForParent(request, parent);

    const teacher = await apiJson<any>(
      request,
      directorSession,
      'POST',
      '/users',
      {
        userCode: `TB07${digits}`,
        email: `video-b07-teacher-${digits}@school.local`,
        password: rolePassword(),
        fullName: `Video B07 Teacher ${digits.slice(-4)}`,
        role: 'TEACHER',
        phone: uniquePhone(`${label}-teacher`),
      },
    );

    const student = await apiJson<any>(
      request,
      directorSession,
      'POST',
      '/students',
      {
        studentCode: `SB07${digits}`,
        fullName: `Video B07 Student ${digits.slice(-4)}`,
        age: 10,
        parentName: parent.fullName,
        parentPhone: parent.phone,
        parentUserId: parent._id,
        faceImage: 'default-avatar.png',
        productPackage: product._id,
        level: 'Starter',
        studentType: 'ONLINE',
        saleId: sale._id,
        saleName: sale.fullName,
      },
    );

    const classroom = await apiJson<any>(
      request,
      directorSession,
      'POST',
      '/classes',
      {
        name: `Video B07 Class ${digits.slice(-4)}`,
        code: `CB07${digits}`,
        teacherId: teacher._id,
        saleId: sale._id,
        classMode: 'ONLINE',
        productPackageId: product._id,
        studentIds: [student._id],
        subject: 'Tieng Anh',
        learningGoals: 'Finance linked workflow for invoices wallets payroll',
        pricePerSession: 210000,
        teacherPayPerSession: teacherPayout,
        teacherPayPerStudent: 0,
        baseDuration: 60,
        sessionDuration: 60,
        maxStudents: 1,
      },
    );

    const pendingInvoice = await createPendingInvoice(
      request,
      { parent, student, classroom, teacher, sale, product },
      {
        invoiceNumber,
        amount: invoiceAmount,
        paymentRound: 1,
        sessions: 8,
      },
    );

    const payrollSession = await apiJson<any>(
      request,
      directorSession,
      'POST',
      '/sessions',
      {
        classId: classroom._id,
        studentId: student._id,
        teacherId: teacher._id,
        parentUserId: parent._id,
        scheduledDate: schedule.scheduledDate,
        scheduledStartTime: schedule.startTime,
        scheduledEndTime: schedule.endTime,
        durationMinutes: 60,
        amountCharged: 210000,
        teacherPayout,
      },
    );

    await apiJson<any>(
      request,
      directorSession,
      'POST',
      '/attendance/mark',
      {
        classId: classroom._id,
        studentId: student._id,
        date: schedule.scheduledDate,
        status: 'PRESENT',
        notes: 'B07 payroll attendance seed',
      },
    );

    const teacherSession = await loginAsCredentials(request, 'teacher', teacher.email, rolePassword());
    const parentSession = await loginAsCredentials(request, 'parent', parent.email, parent.password);

    const sessionAfterAttendance = await apiJson<any>(
      request,
      directorSession,
      'GET',
      `/sessions/${payrollSession._id}`,
    );

    if (sessionAfterAttendance.status === 'SCHEDULED') {
      await apiJson<any>(
        request,
        teacherSession,
        'POST',
        `/sessions/${payrollSession._id}/complete`,
        {
          lessonContent: 'Teacher completed a focused speaking and listening lesson.',
          homework: 'Review the notes and finish the assigned worksheet.',
          teacherNotes: 'Student completed all activities with good energy.',
          actualStartTime: schedule.actualStartIso,
          actualEndTime: schedule.actualEndIso,
          studentPerformance: 4,
          studentEngagement: 4,
          comprehensionLevel: 4,
        },
      );
    } else if (sessionAfterAttendance.status !== 'TEACHER_COMPLETED') {
      throw new Error(
        `Unexpected session status after attendance seed: ${sessionAfterAttendance.status}`,
      );
    }

    await apiJson<any>(
      request,
      teacherSession,
      'PATCH',
      `/sessions/${payrollSession._id}/teaching-report`,
      {
        lessonContent: 'Teacher completed a focused speaking and listening lesson with full notes.',
        studentAttitude: 'Student was attentive and responsive.',
        recordingUrl: 'https://example.com/b07-recording',
        teacherComment: 'Good progress and strong participation during the lesson.',
        homework: 'Review the notes and finish the assigned worksheet.',
        additionalNotes: 'Ready for payroll eligibility after final confirmation.',
      },
    );

    await apiJson<any>(
      request,
      parentSession,
      'POST',
      `/sessions/${payrollSession._id}/confirm`,
      {
        rating: 5,
        parentNotes: 'Parent confirmed the session and report content.',
      },
    );

    await apiJson<any>(
      request,
      directorSession,
      'POST',
      `/sessions/${payrollSession._id}/finalize`,
      {},
    );

    await waitForEligiblePreview(
      request,
      directorSession,
      teacher._id,
      monthRange.periodStart,
      monthRange.periodEnd,
    );

    try {
      await showTitleCard(
        page,
        'B07 Invoices, Wallets, Payroll',
        'Video nay tiep tuc batch test tai chinh voi flow lien ket tu invoice den wallet va payroll.',
        [
          'Approve invoice tren UI va doi chieu trang thai Approved.',
          'Parent gui top-up request, accounting duyet va kiem tra ledger.',
          'Payroll preview -> generate -> submit -> approve -> mark paid cho giao vien.',
        ],
      );

      await setVideoLabel(page, 'Buoc 1: Accounting vao Invoices, loc invoice vua seed va approve bang chung tu doi ung.');
      await switchSession(page, accountingSession, '/app/invoices', {
        email: roleEmail('accounting'),
        password: rolePassword(),
      });
      await slowFill(page, page.locator('.filters-section input').first(), invoiceNumber);
      const pendingInvoiceRow = invoiceRow(page, invoiceNumber);
      await expect(pendingInvoiceRow).toBeVisible({ timeout: 20_000 });
      await expect(pendingInvoiceRow).toContainText(student.fullName);
      await expect(pendingInvoiceRow).toContainText('Chờ duyệt');
      await capture(page, artifactDir, '01-invoice-pending.png');
      await clickLocator(page, pendingInvoiceRow.getByTestId('invoice-row-approve'));
      await expect(page.getByTestId('invoice-approve-modal')).toBeVisible({ timeout: 15_000 });
      await page.getByTestId('invoice-approve-file').setInputFiles(approvalFile('b07-approve.png'));
      await capture(page, artifactDir, '02-invoice-approve-modal.png');
      const approveConfirmButton = page.getByTestId('invoice-approve-confirm');
      await expect(approveConfirmButton).toBeEnabled({ timeout: 15_000 });
      await acceptDialog(page, () => clickLocator(page, approveConfirmButton));
      await expect(page.getByTestId('invoice-approve-modal')).toBeHidden({ timeout: 20_000 });
      await page.locator('.filters-section select').nth(1).selectOption('APPROVED');
      await expect(invoiceRow(page, invoiceNumber)).toBeVisible({ timeout: 20_000 });
      await page.waitForTimeout(900);
      await capture(page, artifactDir, '03-invoice-approved.png');

      await showTitleCard(
        page,
        'Parent Top-Up Request',
        'Sau invoice, video quay tiep luong parent gui yeu cau top-up va accounting duyet tren man hinh wallet.',
        [
          'Parent tao yeu cau top-up cash tu vi cua minh.',
          'Accounting mo pending modal va approve yeu cau.',
          'Ledger hien thi giao dich top-up voi mo ta duy nhat de doi chieu.',
        ],
      );

      await setVideoLabel(page, 'Buoc 2: Parent mo My Wallet, tao yeu cau nap tien cash voi mo ta duy nhat de doi chieu ledger.');
      await switchSession(page, parentSession, '/app/wallets', {
        email: parent.email,
        password: parent.password,
      });
      await expect(page.locator('.my-wallet-card')).toBeVisible({ timeout: 15_000 });
      await capture(page, artifactDir, '04-parent-wallet-home.png');
      await clickLocator(page, page.locator('.my-wallet-card .primary').first());
      const parentTopUpModal = page.locator('.modal-backdrop .modal').last();
      await expect(parentTopUpModal).toBeVisible({ timeout: 10_000 });
      await slowFill(page, parentTopUpModal.locator('input[type="number"]').first(), String(parentTopUpAmount));
      await parentTopUpModal.locator('select').selectOption('CASH');
      await slowFill(page, parentTopUpModal.locator('textarea').first(), parentTopUpDescription);
      await capture(page, artifactDir, '05-parent-topup-filled.png');
      await acceptDialog(page, () => clickLocator(page, parentTopUpModal.locator('.modal-actions .primary').first()));
      await expect(parentTopUpModal).toBeHidden({ timeout: 15_000 });
      await page.waitForTimeout(1000);
      await capture(page, artifactDir, '06-parent-topup-requested.png');

      await setVideoLabel(page, 'Buoc 3: Accounting vao Wallets, mo pending top-ups, approve request vua tao, roi kiem tra ledger.');
      await switchSession(page, accountingSession, '/app/wallets', {
        email: roleEmail('accounting'),
        password: rolePassword(),
      });
      await expect(page.locator('table.data')).toBeVisible({ timeout: 15_000 });
      await clickLocator(page, page.locator('.header-actions .ghost').first());
      const pendingModal = page.locator('.modal-backdrop .modal-lg').last();
      const pendingItem = pendingModal.locator('.pending-item').filter({ hasText: parent.fullName }).first();
      await expect(pendingItem).toBeVisible({ timeout: 15_000 });
      await expect(pendingItem).toContainText(parentTopUpAmount.toLocaleString('vi-VN'));
      await capture(page, artifactDir, '07-wallet-pending-topup.png');
      await clickLocator(page, pendingItem.locator('.pending-actions .primary').first());
      const approveModal = page
        .locator('.modal-backdrop .modal')
        .filter({ hasText: 'Duyệt yêu cầu nạp tiền' })
        .first();
      await expect(approveModal).toBeVisible({ timeout: 10_000 });
      await clickLocator(page, approveModal.locator('.modal-actions .primary').first());
      await expect(approveModal).toBeHidden({ timeout: 15_000 });
      await expect(page.locator('.modal-backdrop .modal-lg')).toBeVisible({ timeout: 15_000 });
      await clickLocator(page, page.locator('.modal-backdrop .modal-lg .modal-actions .ghost').first());
      await expect(page.locator('.modal-backdrop .modal-lg')).toBeHidden({ timeout: 15_000 });
      const walletRow = page.locator('table.data tbody tr').filter({ hasText: parent.fullName }).first();
      await expect(walletRow).toBeVisible({ timeout: 20_000 });
      await clickLocator(page, walletRow.locator('.actions-cell button').first());
      await expect(page.locator('.filters select').first()).toBeVisible({ timeout: 10_000 });
      await page.locator('.filters select').first().selectOption('TOP_UP');
      const ledgerRow = page.locator('table.data tbody tr').filter({ hasText: parentTopUpDescription }).first();
      await expect(ledgerRow).toBeVisible({ timeout: 20_000 });
      await capture(page, artifactDir, '08-wallet-ledger-topup.png');

      await showTitleCard(
        page,
        'Teacher Payroll Lifecycle',
        'Phan cuoi quay payroll UI voi du lieu session da du dieu kien tinh luong va day du workflow phe duyet.',
        [
          'Preview hien session eligible cua giao vien vua seed.',
          'Accounting generate payroll va submit review.',
          'Director approve, accounting mark paid va row chuyen sang PAID.',
        ],
      );

      await setVideoLabel(page, 'Buoc 4: Accounting vao Payroll preview, loc giao vien moi va tao bang luong tu session eligible.');
      await switchSession(page, accountingSession, '/app/payroll', {
        email: roleEmail('accounting'),
        password: rolePassword(),
      });
      const previewFilterBar = page.locator('.payroll-page .filter-bar').first();
      await previewFilterBar.locator('select').first().selectOption(teacher._id);
      await previewFilterBar.locator('input[type="date"]').nth(0).fill(monthRange.periodStart);
      await previewFilterBar.locator('input[type="date"]').nth(1).fill(monthRange.periodEnd);
      await clickLocator(page, previewFilterBar.locator('button').first());
      const eligibleRow = page.locator('.session-table tbody tr').filter({ hasText: student.fullName }).first();
      await expect(eligibleRow).toBeVisible({ timeout: 20_000 });
      await capture(page, artifactDir, '09-payroll-preview-eligible.png');
      await clickLocator(page, page.locator('.action-row .btn-success').first());
      await page.waitForTimeout(1600);
      await expect(page.locator('.existing-payrolls table.data-table tbody tr').first()).toBeVisible({ timeout: 20_000 });
      await capture(page, artifactDir, '10-payroll-generated.png');

      await setVideoLabel(page, 'Buoc 5: Accounting mo tab payrolls, loc row DRAFT cua giao vien va submit review.');
      await clickLocator(page, page.locator('.tab-bar button').nth(1));
      const payrollListFilterBar = page.locator('.payroll-page .filter-bar').first();
      await payrollListFilterBar.locator('select').nth(0).selectOption(teacher._id);
      await payrollListFilterBar.locator('select').nth(1).selectOption('DRAFT');
      await clickLocator(page, payrollListFilterBar.locator('button').first());
      const draftPayrollRow = page.locator('table.data-table tbody tr').filter({ hasText: teacher.fullName }).first();
      await expect(draftPayrollRow).toBeVisible({ timeout: 20_000 });
      await capture(page, artifactDir, '11-payroll-draft-row.png');
      await clickLocator(page, draftPayrollRow.locator('.action-buttons button').first());
      await payrollListFilterBar.locator('select').nth(1).selectOption('PENDING_REVIEW');
      await clickLocator(page, payrollListFilterBar.locator('button').first());
      await expect(page.locator('table.data-table tbody tr').filter({ hasText: teacher.fullName }).first()).toBeVisible({ timeout: 20_000 });
      await capture(page, artifactDir, '12-payroll-submitted.png');

      await setVideoLabel(page, 'Buoc 6: Director vao Payroll, loc row pending review va approve bang luong.');
      await switchSession(page, directorSession, '/app/payroll', {
        email: roleEmail('director'),
        password: rolePassword(),
      });
      const directorPayrollFilterBar = page.locator('.payroll-page .filter-bar').first();
      await clickLocator(page, page.locator('.tab-bar button').nth(1));
      await directorPayrollFilterBar.locator('select').nth(0).selectOption(teacher._id);
      await directorPayrollFilterBar.locator('select').nth(1).selectOption('PENDING_REVIEW');
      await clickLocator(page, directorPayrollFilterBar.locator('button').first());
      const pendingPayrollRow = page.locator('table.data-table tbody tr').filter({ hasText: teacher.fullName }).first();
      await expect(pendingPayrollRow).toBeVisible({ timeout: 20_000 });
      await capture(page, artifactDir, '13-payroll-pending-review.png');
      await clickLocator(page, pendingPayrollRow.locator('.action-buttons button').first());
      await directorPayrollFilterBar.locator('select').nth(1).selectOption('APPROVED');
      await clickLocator(page, directorPayrollFilterBar.locator('button').first());
      await expect(page.locator('table.data-table tbody tr').filter({ hasText: teacher.fullName }).first()).toBeVisible({ timeout: 20_000 });
      await capture(page, artifactDir, '14-payroll-approved.png');

      await setVideoLabel(page, 'Buoc 7: Accounting quay lai Payroll, loc row approved, nhap payment ref va mark paid.');
      await switchSession(page, accountingSession, '/app/payroll', {
        email: roleEmail('accounting'),
        password: rolePassword(),
      });
      await clickLocator(page, page.locator('.tab-bar button').nth(1));
      const finalPayrollFilterBar = page.locator('.payroll-page .filter-bar').first();
      await finalPayrollFilterBar.locator('select').nth(0).selectOption(teacher._id);
      await finalPayrollFilterBar.locator('select').nth(1).selectOption('APPROVED');
      await clickLocator(page, finalPayrollFilterBar.locator('button').first());
      const approvedPayrollRow = page.locator('table.data-table tbody tr').filter({ hasText: teacher.fullName }).first();
      await expect(approvedPayrollRow).toBeVisible({ timeout: 20_000 });
      await capture(page, artifactDir, '15-payroll-approved-row.png');
      page.once('dialog', async (dialog) => {
        await dialog.accept(`B07-PAY-${digits.slice(-5)}`);
      });
      await clickLocator(page, approvedPayrollRow.locator('.action-buttons button').first());
      await finalPayrollFilterBar.locator('select').nth(1).selectOption('PAID');
      await clickLocator(page, finalPayrollFilterBar.locator('button').first());
      const paidPayrollRow = page.locator('table.data-table tbody tr').filter({ hasText: teacher.fullName }).first();
      await expect(paidPayrollRow).toBeVisible({ timeout: 20_000 });
      await expect(paidPayrollRow.locator('.action-buttons button')).toHaveCount(0);
      await capture(page, artifactDir, '16-payroll-paid-row.png');

      await showTitleCard(
        page,
        'B07 Video Completed',
        'Invoice, wallet top-up va payroll workflow da duoc quay tiep tren mot flow dai va co du bang chung.',
        [
          `Invoice ${pendingInvoice.invoiceNumber} da duoc approve tren UI.`,
          `Top-up ${parentTopUpAmount.toLocaleString('vi-VN')}d da qua pending -> approve -> ledger.`,
          'Payroll giao vien da qua preview -> draft -> pending review -> approved -> paid.',
        ],
      );

      await writeFile(
        path.join(artifactDir, 'README.txt'),
        [
          'B07 UI recorder artifacts',
          `artifactDir=${artifactDir}`,
          `invoiceId=${pendingInvoice._id}`,
          `invoiceNumber=${pendingInvoice.invoiceNumber}`,
          `parent=${parent.email}`,
          `teacher=${teacher.email}`,
          `sessionId=${payrollSession._id}`,
        ].join('\n'),
        'utf8',
      );
    } finally {
      const finalVideoPath = await saveRecordedVideo(page, context);
      if (finalVideoPath) {
        console.log(`FINAL_VIDEO_PATH=${finalVideoPath}`);
      }
    }
  });
});
