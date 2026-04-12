import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { expect, test, type Browser, type BrowserContext, type Locator, type Page } from '@playwright/test';
import {
  acceptDialog,
  apiCall,
  apiJson,
  approvalFile,
  createEnrollmentFixture,
  createLearningFixture,
  createPendingInvoice,
  createSubmittedOrder,
  getSessionById,
  invoiceRow,
  loginAsCredentials,
  loginAsRole,
  orderRow,
  RECEIPT_DATA_URL,
  roleEmail,
  rolePassword,
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
const META_DIR = path.join(EVIDENCE_DIR, 'showcase-artifacts');
const FINAL_VIDEO_BASENAME = `UI_Investor_Demo_5min_VI_${DATE_STAMP}`;
const VIEWPORT = { width: 1600, height: 900 };

test.use({
  trace: 'off',
  launchOptions: {
    slowMo: 220,
  },
});

async function ensureDirs(): Promise<void> {
  await mkdir(RAW_VIDEO_DIR, { recursive: true });
  await mkdir(VIDEO_DIR, { recursive: true });
  await mkdir(META_DIR, { recursive: true });
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
        label.style.maxWidth = '760px';
        label.style.padding = '10px 14px';
        label.style.borderRadius = '14px';
        label.style.background = 'rgba(15, 23, 42, 0.84)';
        label.style.color = '#e2e8f0';
        label.style.font = '600 15px/1.45 "Segoe UI", system-ui, sans-serif';
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
        callout.style.animation = 'codexPulse 1.2s ease-in-out infinite';
        document.body.appendChild(callout);
      }

      let calloutText = document.getElementById(CALLOUT_TEXT_ID) as HTMLDivElement | null;
      if (!calloutText) {
        calloutText = document.createElement('div');
        calloutText.id = CALLOUT_TEXT_ID;
        calloutText.style.position = 'fixed';
        calloutText.style.left = '0';
        calloutText.style.top = '0';
        calloutText.style.maxWidth = '360px';
        calloutText.style.padding = '10px 14px';
        calloutText.style.borderRadius = '14px';
        calloutText.style.background = 'rgba(220, 38, 38, 0.95)';
        calloutText.style.color = '#fff';
        calloutText.style.font = '700 14px/1.4 "Segoe UI", system-ui, sans-serif';
        calloutText.style.letterSpacing = '0.01em';
        calloutText.style.boxShadow = '0 18px 36px rgba(127, 29, 29, 0.35)';
        calloutText.style.pointerEvents = 'none';
        calloutText.style.zIndex = '2147483646';
        calloutText.style.opacity = '0';
        calloutText.style.transition = 'opacity 140ms ease, left 180ms ease, top 180ms ease';
        document.body.appendChild(calloutText);
      }

      let style = document.getElementById('__codex_video_styles') as HTMLStyleElement | null;
      if (!style) {
        style = document.createElement('style');
        style.id = '__codex_video_styles';
        style.textContent = `
          @keyframes codexPulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.01); }
          }
        `;
        document.head.appendChild(style);
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

        const maxLeft = Math.max(12, window.innerWidth - 380);
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

async function createRecordedPage(browser: Browser): Promise<{ context: BrowserContext; page: Page }> {
  await ensureDirs();
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
  await installVideoOverlay(page);
  return { context, page };
}

async function saveRecordedVideo(page: Page, context: BrowserContext, fileBaseName: string): Promise<string | null> {
  const video = page.video();
  await context.close();
  if (!video) return null;

  const rawPath = await video.path();
  const finalPath = path.join(VIDEO_DIR, `${fileBaseName}.webm`);
  await rm(finalPath, { force: true });
  await rename(rawPath, finalPath);
  return finalPath;
}

async function setVideoLabel(page: Page, message: string | null): Promise<void> {
  await page.evaluate((value) => {
    const fn = (window as any).__codexVideoLabel as ((msg: string | null) => void) | undefined;
    fn?.(value);
  }, message);
}

async function showCallout(page: Page, locator: Locator, message: string, holdMs = 1800): Promise<void> {
  await expect(locator).toBeVisible({ timeout: 20_000 });
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if (!box) {
    throw new Error(`Could not calculate callout rectangle for: ${message}`);
  }

  await page.evaluate(({ rect, text }) => {
    const fn = (window as any).__codexVideoCallout as ((r: any, t: string | null) => void) | undefined;
    fn?.(rect, text);
  }, {
    rect: {
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height,
    },
    text: message,
  });
  await page.waitForTimeout(holdMs);
}

async function clearCallout(page: Page): Promise<void> {
  await page.evaluate(() => {
    const fn = (window as any).__codexVideoCallout as ((r: any, t: string | null) => void) | undefined;
    fn?.(null, null);
  });
}

async function clickLocator(page: Page, locator: Locator): Promise<void> {
  await expect(locator).toBeVisible({ timeout: 20_000 });
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if (!box) {
    throw new Error('Could not calculate locator position for click.');
  }

  await page.mouse.move(box.x + (box.width / 2), box.y + (box.height / 2), { steps: 18 });
  await page.waitForTimeout(120);
  await page.mouse.down();
  await page.waitForTimeout(70);
  await page.mouse.up();
  await page.waitForTimeout(220);
}

async function slowFill(page: Page, locator: Locator, value: string, delay = 55): Promise<void> {
  await clickLocator(page, locator);
  await locator.fill('');
  await locator.pressSequentially(value, { delay });
}

async function showTitleCard(page: Page, title: string, subtitle: string, bullets: string[]): Promise<void> {
  await page.setContent(`
    <style>
      :root { color-scheme: light; }
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background:
          radial-gradient(circle at top left, rgba(239,68,68,.18), transparent 32%),
          radial-gradient(circle at bottom right, rgba(14,165,233,.18), transparent 35%),
          linear-gradient(135deg, #020617 0%, #0f172a 45%, #1e293b 100%);
        color: #e2e8f0;
        font-family: "Segoe UI", system-ui, sans-serif;
      }
      .card {
        width: min(980px, calc(100vw - 80px));
        padding: 42px 44px;
        border-radius: 30px;
        border: 1px solid rgba(148, 163, 184, 0.22);
        background: rgba(15, 23, 42, 0.72);
        box-shadow: 0 28px 80px rgba(2, 6, 23, 0.46);
        backdrop-filter: blur(14px);
      }
      .eyebrow {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 8px 14px;
        border-radius: 999px;
        background: rgba(239, 68, 68, 0.14);
        color: #fca5a5;
        font-size: 13px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        font-weight: 800;
      }
      h1 {
        margin: 18px 0 12px;
        font-size: 44px;
        line-height: 1.08;
      }
      p {
        margin: 0 0 18px;
        font-size: 20px;
        color: #cbd5e1;
        line-height: 1.55;
      }
      ul {
        margin: 0;
        padding-left: 22px;
        color: #f8fafc;
        display: grid;
        gap: 10px;
        font-size: 18px;
      }
      li::marker {
        color: #f87171;
      }
    </style>
    <div class="card">
      <div class="eyebrow">Video Demo Nhà Đầu Tư</div>
      <h1>${title}</h1>
      <p>${subtitle}</p>
      <ul>${bullets.map((item) => `<li>${item}</li>`).join('')}</ul>
    </div>
  `);
  await page.waitForTimeout(3600);
}

async function loginViaUi(page: Page, email: string, password: string): Promise<void> {
  await page.goto(new URL('/login', APP_BASE_URL).toString());
  await page.waitForLoadState('networkidle');
  await setVideoLabel(page, 'Đăng nhập vào hệ thống bằng tài khoản Director để đi qua các màn doanh thu, vận hành và nhà đầu tư.');
  await showCallout(page, page.getByTestId('login-email'), 'Nhập tài khoản Director', 1400);
  await slowFill(page, page.getByTestId('login-email'), email, 50);
  await showCallout(page, page.getByTestId('login-password'), 'Nhập mật khẩu demo', 1200);
  await slowFill(page, page.getByTestId('login-password'), password, 50);
  await showCallout(page, page.getByTestId('login-submit'), 'Bắt đầu luồng demo từ một tài khoản duy nhất', 1400);
  await clickLocator(page, page.getByTestId('login-submit'));
  await page.waitForURL(/\/app\//, { timeout: 25_000 });
  await clearCallout(page);
  await page.waitForTimeout(1200);
}

async function completeTeachingReportByApi(request: Parameters<typeof apiCall>[0], fixture: Awaited<ReturnType<typeof createLearningFixture>>): Promise<any> {
  const teacherSession = await loginAsCredentials(
    request,
    'teacher',
    fixture.teacher.email,
    fixture.teacher.password || rolePassword(),
  );

  await apiCall(
    request,
    teacherSession,
    'POST',
    `/sessions/${fixture.session._id}/complete`,
    {
      topicsCovered: 'Investor showcase topics covered',
      lessonContent: 'Speaking practice and grammar review',
      studentPerformance: 4,
      studentEngagement: 4,
    },
    [200, 201],
  );

  await apiCall(
    request,
    teacherSession,
    'PATCH',
    `/sessions/${fixture.session._id}/teaching-report`,
    {
      lessonContent: 'Ôn ngữ pháp, luyện nghe và thực hành nói có hướng dẫn cho buổi demo investor.',
      studentAttitude: 'GOOD',
      teacherComment: 'Học sinh vào lớp đúng giờ và tham gia rất tốt trong suốt buổi học.',
      recordingUrl: 'https://example.com/investor-showcase-recording',
      homework: 'Ôn lại từ vựng hôm nay và hoàn thành phiếu bài tập số 4 trước buổi sau.',
      additionalNotes: 'Phụ huynh có thể dành 10 phút luyện lại các mẫu câu với học sinh tại nhà.',
    },
    [200, 201],
  );

  return teacherSession;
}

test.describe('Investor demo 5 minute video', () => {
  test('records a practical investor-facing walkthrough with Vietnamese captions', async ({ browser, request }) => {
    test.slow();
    test.setTimeout(600_000);

    const directorSession = await loginAsRole(request, 'director');
    const labelStamp = `${Date.now()}`;
    const orderLabel = `investor-order-${Math.random().toString(36).slice(2, 8)}`;
    const invoiceLabel = `investor-invoice-${Math.random().toString(36).slice(2, 8)}`;
    const learningLabel = `investor-learning-${Math.random().toString(36).slice(2, 8)}`;
    const artifactDir = path.join(META_DIR, `investor-demo-${labelStamp}`);
    await mkdir(artifactDir, { recursive: true });

    const orderFixture = await createSubmittedOrder(request, {
      label: orderLabel,
      totalAmount: 2_000_000,
      finalAmount: 2_000_000,
      sessions: 10,
      invoiceSessions: 10,
      pricePerSession: 200_000,
      teacherPayPerSession: 120_000,
      paymentPlan: 'FULL',
      teachingMode: 'ONLINE',
      receiptImage: RECEIPT_DATA_URL,
    });

    const invoiceFixture = await createEnrollmentFixture(request, {
      label: invoiceLabel,
      classMode: 'ONLINE',
      initializeWallet: true,
    });
    const pendingInvoice = await createPendingInvoice(request, invoiceFixture, {
      invoiceNumber: `INV-DEMO-${labelStamp.slice(-8)}`,
      amount: 1_500_000,
      paymentRound: 1,
      sessions: 8,
    });

    const learningFixture = await createLearningFixture(request, {
      label: learningLabel,
      classMode: 'ONLINE',
      initializeWallet: true,
      durationMinutes: 60,
      amountCharged: 200_000,
      teacherPayout: 120_000,
    });
    await completeTeachingReportByApi(request, learningFixture);

    const teacherRecords = await apiJson<any[]>(
      request,
      directorSession,
      'GET',
      '/users/teachers',
    );
    const teacherRecord = teacherRecords.find(
      (item: any) => item._id === learningFixture.teacher._id || item.email === learningFixture.teacher.email,
    );
    expect(teacherRecord?.userCode).toBeTruthy();

    const { context, page } = await createRecordedPage(browser);
    let savedVideoPath: string | null = null;

    try {
      await showTitleCard(
        page,
        'Investor Demo 5 Phút',
        'Một video thao tác tự động để trình bày hệ thống vận hành từ đơn hàng, hóa đơn, báo cáo giảng dạy đến dashboard nhà đầu tư.',
        [
          'Đăng nhập bằng Director',
          'Duyệt đơn hàng trên UI',
          'Duyệt hóa đơn và side effect tài chính',
          'Theo dõi báo cáo giảng dạy đã nộp',
          'Xem dashboard nhà đầu tư và kiểm soát tài chính',
        ],
      );

      await loginViaUi(page, roleEmail('director'), rolePassword());

      await page.goto('/app/orders');
      await page.waitForLoadState('networkidle');
      await setVideoLabel(page, 'Bước 1: Director vào Orders để duyệt một đơn hàng đã submit sẵn và xem giá trị giao dịch.');
      const orderRowLocator = orderRow(page, orderFixture.orderCode);
      await showCallout(page, orderRowLocator, 'Đơn mới đã submit sẵn, chưa cần tạo tay trong lúc demo', 1700);
      await showCallout(page, orderRowLocator.getByTestId('order-row-approve'), 'Duyệt đơn ngay trên bảng danh sách', 1400);
      await clickLocator(page, orderRowLocator.getByTestId('order-row-approve'));

      const orderApproveModal = page.getByTestId('order-approve-modal');
      await expect(orderApproveModal).toBeVisible({ timeout: 15_000 });
      await showCallout(page, orderApproveModal, 'Tải lên hóa đơn đối ứng trước khi xác nhận duyệt', 1500);
      await orderApproveModal.getByTestId('order-approve-image').setInputFiles(
        approvalFile(`investor-order-approve-${labelStamp}.png`),
      );
      await expect(orderApproveModal.getByTestId('order-approve-confirm')).toBeEnabled({ timeout: 10_000 });
      await page.waitForTimeout(1200);
      await showCallout(page, orderApproveModal.getByTestId('order-approve-confirm'), 'Duyệt đơn hàng và tạo side effect xuống các module liên quan', 1500);
      await acceptDialog(page, () => clickLocator(page, orderApproveModal.getByTestId('order-approve-confirm')));
      await expect(orderApproveModal).toBeHidden({ timeout: 20_000 });
      await expect(orderRowLocator).toContainText(/Da duyet|Đã duyệt|APPROVED/, { timeout: 20_000 });
      await showCallout(page, orderRowLocator, 'Trạng thái đơn hàng đã đổi ngay trên UI sau khi duyệt', 1800);
      await clickLocator(page, orderRowLocator);
      const orderDetailModal = page.getByTestId('order-detail-modal');
      await expect(orderDetailModal).toBeVisible({ timeout: 15_000 });
      await showCallout(page, orderDetailModal.getByTestId('order-detail-course-price'), 'Giá trị khóa học được tính và lưu ngay trong detail', 1500);
      await showCallout(page, orderDetailModal.getByTestId('order-detail-invoice-amount'), 'Số tiền hóa đơn được đối chiếu riêng với giá khóa học', 1500);
      await clickLocator(page, orderDetailModal.getByTestId('order-detail-close'));
      await expect(orderDetailModal).toBeHidden({ timeout: 10_000 });
      await clearCallout(page);
      await page.waitForTimeout(1500);

      await showTitleCard(
        page,
        'Hóa Đơn Và Dòng Tiền',
        'Sau đơn hàng, hệ thống tiếp tục đi qua lớp hóa đơn để kế toán hoặc Director đối chiếu và chốt luồng thu tiền.',
        [
          'Mở hóa đơn đang chờ duyệt',
          'Upload chứng từ đối ứng',
          'Xác nhận duyệt',
          'Theo dõi trạng thái cập nhật trên UI',
        ],
      );

      await page.goto('/app/invoices');
      await page.waitForLoadState('networkidle');
      await setVideoLabel(page, 'Bước 2: Director vào Invoices, duyệt một hóa đơn đang chờ duyệt và chốt phần thu tiền.');
      const invoiceRowLocator = invoiceRow(page, pendingInvoice.invoiceNumber);
      await showCallout(page, invoiceRowLocator, 'Hóa đơn chờ duyệt được seed sẵn để demo phê duyệt trên UI', 1600);
      await showCallout(page, invoiceRowLocator.getByTestId('invoice-row-approve'), 'Mở modal duyệt hóa đơn kèm chứng từ', 1400);
      await clickLocator(page, invoiceRowLocator.getByTestId('invoice-row-approve'));

      const invoiceApproveModal = page.getByTestId('invoice-approve-modal');
      await expect(invoiceApproveModal).toBeVisible({ timeout: 15_000 });
      await showCallout(page, invoiceApproveModal.getByTestId('invoice-approve-file'), 'Tải lên ảnh đối ứng để đối soát trước khi phê duyệt', 1500);
      await invoiceApproveModal.getByTestId('invoice-approve-file').setInputFiles(
        approvalFile(`investor-invoice-approve-${labelStamp}.png`),
      );
      await expect(invoiceApproveModal.getByTestId('invoice-approve-confirm')).toBeEnabled({ timeout: 10_000 });
      await page.waitForTimeout(1400);
      await showCallout(page, invoiceApproveModal.getByTestId('invoice-approve-confirm'), 'Duyệt hóa đơn và cập nhật trạng thái trên bảng hóa đơn', 1500);
      await acceptDialog(page, () => clickLocator(page, invoiceApproveModal.getByTestId('invoice-approve-confirm')));
      await expect(invoiceApproveModal).toBeHidden({ timeout: 20_000 });
      await expect(invoiceRowLocator).toContainText(/Da duyet|Đã duyệt|APPROVED/, { timeout: 20_000 });
      await showCallout(page, invoiceRowLocator, 'Hóa đơn đã duyệt, sẵn sàng đi tiếp xuống dashboard tài chính', 1800);
      await clearCallout(page);
      await page.waitForTimeout(1600);

      await showTitleCard(
        page,
        'Báo Cáo Giảng Dạy Và Vận Hành Lớp Học',
        'Phần vận hành sau bán hàng được giữ trong hệ thống để ban điều hành có thể xem ngay báo cáo giảng dạy.',
        [
          'Buổi học đã hoàn tất và đã nộp báo cáo giảng dạy qua API',
          'Director lọc theo mã giáo viên',
          'Mở card completed để xem báo cáo',
        ],
      );

      await page.goto('/app/teaching-report');
      await page.waitForLoadState('networkidle');
      await setVideoLabel(page, 'Bước 3: Director xem báo cáo giảng dạy đã nộp và lọc theo mã giáo viên để đối soát.');
      await clickLocator(page, page.getByTestId('report-tab-completed'));
      await showCallout(page, page.getByTestId('report-month-filter'), 'Lọc theo tháng hiện tại để giữ dữ liệu gọn và dễ đọc', 1400);
      const teacherCodeInput = page.locator('input[placeholder*="GV001"]').first();
      await showCallout(page, teacherCodeInput, 'Nhập mã giáo viên để lọc đúng người đang dạy', 1400);
      await slowFill(page, teacherCodeInput, teacherRecord.userCode, 45);
      await expect(page.locator('.teacher-hint')).toContainText(teacherRecord.fullName, { timeout: 10_000 });
      await showCallout(page, page.locator('.teacher-hint'), 'Hệ thống map mã giáo viên sang tên thật để giảm nhầm lẫn', 1400);
      await clickLocator(page, page.getByTestId('report-apply-filters'));
      const completedCard = page.locator('.session-card.completed').filter({ hasText: learningFixture.student.fullName }).first();
      await expect(completedCard).toBeVisible({ timeout: 15_000 });
      await showCallout(page, completedCard, 'Báo cáo giảng dạy đã có mặt trong completed tab để ban điều hành xem lại', 1700);
      await clickLocator(page, completedCard.locator('.session-header').first());
      await page.waitForTimeout(1200);
      await showCallout(page, completedCard, 'Card này gồm lesson content, comment và thông tin buổi học', 1700);
      await clearCallout(page);
      await page.waitForTimeout(1600);

      await showTitleCard(
        page,
        'Bảng Điều Khiển Nhà Đầu Tư',
        'Sau các nghiệp vụ giao dịch và vận hành, dữ liệu được đưa lên một lớp dành cho nhà đầu tư để ra quyết định nhanh.',
        [
          'Tiền mặt, tốc độ đốt tiền, runway',
          'Doanh thu và lợi nhuận',
          'Xu hướng 3, 6, 12 tháng',
        ],
      );

      await page.goto('/app/investor-dashboard');
      await page.waitForLoadState('networkidle');
      await setVideoLabel(page, 'Bước 4: Dashboard nhà đầu tư tổng hợp số liệu tài chính, xu hướng và hiệu quả vốn.');
      await showCallout(page, page.locator('.hero').first(), 'Đây là lớp chỉ đọc để Director hoặc Shareholder xem toàn cảnh', 1700);
      await showCallout(page, page.locator('.month-filter').first(), 'Có thể đổi khung xu hướng 3, 6, 12 tháng ngay trên đầu trang', 1500);
      await page.waitForTimeout(1500);
      await showCallout(page, page.locator('.metric-grid').first(), 'Tiền mặt hiện có, tốc độ đốt tiền và runway được lấy từ dữ liệu thật', 1900);
      const revenuePanel = page.locator('.panel-grid .panel').filter({ hasText: /Doanh thu|Gross profit|Net profit|EBITDA/ }).first();
      await showCallout(page, revenuePanel, 'Khối doanh thu và lợi nhuận dùng để nói chuyện với nhà đầu tư', 1900);
      await clearCallout(page);
      await page.waitForTimeout(1600);

      await showTitleCard(
        page,
        'Kiểm Soát Tài Chính',
        'Video kết thúc bằng lớp kiểm soát tài chính để cho thấy hệ thống không chỉ có dashboard đẹp mà còn có bộ đối soát vận hành.',
        [
          'Vị thế tiền mặt',
          'Nghĩa vụ và quỹ dự phòng',
          'Doanh thu chờ xử lý và nợ phụ huynh',
        ],
      );

      await page.goto('/app/financial-control');
      await page.waitForLoadState('networkidle');
      await setVideoLabel(page, 'Bước 5: Kiểm soát tài chính cho thấy vị thế tiền mặt, nghĩa vụ và doanh thu chờ xử lý trong cùng một màn.');
      await showCallout(page, page.locator('.tab-bar').first(), 'Kiểm soát tài chính tách tab tổng quan, cảnh báo, cashflow, P&L và đối soát', 1600);
      const cashSection = page.locator('.dash-section').nth(0);
      await showCallout(page, cashSection, 'Khối này trả lời câu hỏi hiện còn bao nhiêu tiền khả dụng', 1800);
      const obligationsSection = page.locator('.dash-section').nth(1);
      await showCallout(page, obligationsSection, 'Khối này cho thấy nghĩa vụ phải trả và reserve vận hành', 1800);
      const deferredSection = page.locator('.dash-section').nth(2);
      await showCallout(page, deferredSection, 'Đây là phần rất hợp để giải thích doanh thu chờ xử lý và wallet balance', 1800);
      await clearCallout(page);
      await page.waitForTimeout(1800);

      await showTitleCard(
        page,
        'Kết Thúc Demo',
        'Khung cốt lõi đã liên thông từ đơn hàng, hóa đơn, vận hành giảng dạy đến dashboard nhà đầu tư. Edge case và tính năng sâu có thể bổ sung tiếp mà không cần đợi phần showcase.',
        [
          'Đơn hàng -> Hóa đơn',
          'Báo cáo giảng dạy -> Ban điều hành',
          'Dashboard nhà đầu tư -> Kiểm soát tài chính',
        ],
      );
      await setVideoLabel(page, 'Video đã hoàn tất. Các luồng được chọn theo tiêu chí sẵn sàng demo, ưu tiên tính thực dụng và dễ trình bày.');
      await page.waitForTimeout(2600);

      await writeFile(
        path.join(artifactDir, 'README.txt'),
        [
          'Investor demo 5 minute video - chú thích tiếng Việt có dấu',
          `orderCode=${orderFixture.orderCode}`,
          `invoiceNumber=${pendingInvoice.invoiceNumber}`,
          `sessionId=${learningFixture.session._id}`,
          `teacherCode=${teacherRecord.userCode}`,
        ].join('\n'),
        'utf8',
      );
    } finally {
      savedVideoPath = await saveRecordedVideo(page, context, FINAL_VIDEO_BASENAME);
      if (savedVideoPath) {
        console.log(`FINAL_VIDEO_PATH=${savedVideoPath}`);
      }
    }

    expect(savedVideoPath).toBeTruthy();
    expect(await getSessionById(request, directorSession, learningFixture.session._id)).toBeTruthy();
  });
});
