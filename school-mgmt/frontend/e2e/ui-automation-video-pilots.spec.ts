import { mkdir, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { expect, test, type Browser, type BrowserContext, type Locator, type Page } from '@playwright/test';
import { apiJson } from './support/api';
import {
  acceptDialog,
  applySessionCookies,
  createParentAccount,
  ensureProductFixture,
  ensureSaleAccount,
  ensureTeacherAccount,
  generateAttendanceLinkFromUi,
  getSessionById,
  loginAsCredentials,
  loginAsRole,
  pngFilePayload,
  RECEIPT_DATA_URL,
  roleEmail,
  rolePassword,
  submitAttendanceByToken,
  timeSlot,
  uniquePhone,
} from './support';
import type { DemoSession } from './support/types';

const APP_BASE_URL =
  process.env['PLAYWRIGHT_BASE_URL'] ||
  process.env['E2E_BASE_URL'] ||
  'http://localhost:4200';

const RUN_DATE = process.env['UI_EVIDENCE_DATE'] || new Date().toISOString().slice(0, 10);
const DATE_STAMP = RUN_DATE.replace(/-/g, '');
const ROOT_DIR = path.resolve(process.cwd(), '../..');
const VIDEO_DIR =
  process.env['UI_EVIDENCE_VIDEO_DIR'] ||
  path.join(ROOT_DIR, 'frontend-ui-evidence', RUN_DATE, 'videos');
const RAW_VIDEO_DIR = path.join(VIDEO_DIR, 'raw');
const TEST_UPLOAD_FILE = pngFilePayload('b04-order-approval.png');
const VIEWPORT = { width: 1600, height: 900 };

test.use({
  trace: 'off',
  launchOptions: {
    slowMo: 180,
  },
});

async function ensureVideoDirs(): Promise<void> {
  await mkdir(RAW_VIDEO_DIR, { recursive: true });
  await mkdir(VIDEO_DIR, { recursive: true });
}

async function installCursorOverlay(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const CURSOR_ID = '__codex_video_cursor';
    const LABEL_ID = '__codex_video_label';

    const ensureOverlay = () => {
      if (!document.body) {
        return;
      }

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
        cursor.style.background = 'rgba(255,255,255,0.75)';
        cursor.style.boxShadow = '0 10px 28px rgba(14, 165, 233, 0.35)';
        cursor.style.transform = 'translate(-999px, -999px)';
        cursor.style.transition = 'transform 60ms linear, width 100ms ease, height 100ms ease, border-color 100ms ease';
        cursor.style.pointerEvents = 'none';
        cursor.style.zIndex = '2147483647';
        document.body.appendChild(cursor);
      }

      let label = document.getElementById(LABEL_ID) as HTMLDivElement | null;
      if (!label) {
        label = document.createElement('div');
        label.id = LABEL_ID;
        label.style.position = 'fixed';
        label.style.left = '20px';
        label.style.bottom = '20px';
        label.style.maxWidth = '620px';
        label.style.padding = '10px 14px';
        label.style.borderRadius = '14px';
        label.style.background = 'rgba(15, 23, 42, 0.8)';
        label.style.color = '#e2e8f0';
        label.style.font = '600 15px/1.45 "Segoe UI", system-ui, sans-serif';
        label.style.letterSpacing = '0.01em';
        label.style.boxShadow = '0 20px 44px rgba(15, 23, 42, 0.28)';
        label.style.pointerEvents = 'none';
        label.style.zIndex = '2147483646';
        label.style.opacity = '0';
        label.style.transition = 'opacity 150ms ease';
        document.body.appendChild(label);
      }

      const moveCursor = (x: number, y: number) => {
        cursor!.style.transform = `translate(${Math.round(x - 13)}px, ${Math.round(y - 13)}px)`;
      };

      window.addEventListener(
        'mousemove',
        (event) => {
          moveCursor(event.clientX, event.clientY);
        },
        { passive: true },
      );

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
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', ensureOverlay, { once: true });
    } else {
      ensureOverlay();
    }
  });
}

async function createRecordedPage(browser: Browser): Promise<{ context: BrowserContext; page: Page }> {
  await ensureVideoDirs();
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
  await installCursorOverlay(page);
  return { context, page };
}

async function saveRecordedVideo(page: Page, context: BrowserContext, fileBaseName: string): Promise<string | null> {
  const video = page.video();
  await context.close();
  if (!video) {
    return null;
  }

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
          radial-gradient(circle at top left, rgba(14, 165, 233, 0.16), transparent 32%),
          radial-gradient(circle at bottom right, rgba(249, 115, 22, 0.16), transparent 35%),
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
        background: rgba(14, 165, 233, 0.16);
        color: #7dd3fc;
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
        color: #38bdf8;
      }
    </style>
    <div class="card">
      <div class="eyebrow">Automation UI Recorder</div>
      <h1>${title}</h1>
      <p>${subtitle}</p>
      <ul>${bullets.map((item) => `<li>${item}</li>`).join('')}</ul>
    </div>
  `);
  await page.waitForTimeout(1800);
}

async function loginViaUi(page: Page, email: string, password: string): Promise<void> {
  await page.goto(new URL('/login', APP_BASE_URL).toString());
  await page.waitForLoadState('networkidle');
  await slowFill(page, page.getByTestId('login-email'), email);
  await slowFill(page, page.getByTestId('login-password'), password);
  await clickLocator(page, page.getByTestId('login-submit'));
}

async function switchSession(page: Page, session: DemoSession, appPath: string): Promise<void> {
  await page.context().clearCookies();
  await page.goto('about:blank');
  await applySessionCookies(page.context(), session);
  await page.goto(new URL(appPath, APP_BASE_URL).toString());
  await page.waitForLoadState('networkidle');
}

async function clickLocator(page: Page, locator: Locator): Promise<void> {
  await expect(locator).toBeVisible({ timeout: 20_000 });
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if (!box) {
    throw new Error('Could not calculate locator position for click.');
  }
  const x = box.x + (box.width / 2);
  const y = box.y + (box.height / 2);
  await page.mouse.move(x, y, { steps: 20 });
  await page.waitForTimeout(120);
  await page.mouse.down();
  await page.waitForTimeout(70);
  await page.mouse.up();
  await page.waitForTimeout(150);
}

async function slowFill(page: Page, locator: Locator, value: string, delay = 70): Promise<void> {
  await clickLocator(page, locator);
  await locator.fill('');
  if (value) {
    await locator.pressSequentially(value, { delay });
  }
  await page.waitForTimeout(120);
}

async function maybeOpenFlowGuide(page: Page): Promise<void> {
  const flowGuideButton = page.locator('app-flow-guide .flow-toggle').first();
  if (await flowGuideButton.count()) {
    await clickLocator(page, flowGuideButton);
    await page.waitForTimeout(600);
  }
}

async function fillTeachingReport(page: Page, sessionId: string): Promise<void> {
  const card = page.getByTestId(`report-pending-card-${sessionId}`);
  await expect(card).toBeVisible({ timeout: 15_000 });
  await clickLocator(page, card.getByTestId(`report-pending-expand-${sessionId}`));

  const form = page.getByTestId(`report-pending-form-${sessionId}`);
  await expect(form).toBeVisible({ timeout: 10_000 });
  await slowFill(page, form.getByTestId('report-lesson-content'), 'Ôn ngữ pháp, luyện nghe và thực hành nói có hướng dẫn.');
  await slowFill(page, form.getByTestId('report-student-attitude'), 'Học sinh tập trung tốt và phối hợp ổn định trong cả buổi.');
  await slowFill(page, form.getByTestId('report-recording-url'), 'https://example.com/b05-demo-recording', 40);
  await slowFill(page, form.getByTestId('report-teacher-comment'), 'Tiến bộ tốt, cần tiếp tục rèn phát âm và phản xạ.');
  await slowFill(page, form.getByTestId('report-homework'), 'Hoàn thành worksheet số 4 và ôn lại từ vựng của buổi hôm nay.');
  await slowFill(page, form.getByTestId('report-additional-notes'), 'Phụ huynh nên dành 10 phút ôn bài cùng con trước buổi kế tiếp.');
}

async function openVideoContextForRole(page: Page, session: DemoSession, targetPath: string): Promise<void> {
  await switchSession(page, session, targetPath);
  if (new URL(page.url()).pathname === '/login') {
    const email = String(session.user?.email || roleEmail(session.role));
    const password = String(rolePassword());
    await loginViaUi(page, email, password);
    await page.waitForURL(/\/app\//, { timeout: 20_000 });
    if (new URL(page.url(), APP_BASE_URL).pathname !== targetPath) {
      await page.goto(new URL(targetPath, APP_BASE_URL).toString());
      await page.waitForLoadState('networkidle');
    }
  }
}

async function createVideoParent(
  request: Parameters<typeof apiJson>[0],
  session: DemoSession,
  label: string,
): Promise<{ _id: string; email: string; fullName: string; phone: string; password: string }> {
  const digits = `${Date.now()}${Math.floor(Math.random() * 100000)}`.slice(-10);
  const password = rolePassword();
  const phone = uniquePhone(`${label}-${digits}`);
  const parent = await apiJson<any>(
    request,
    session,
    'POST',
    '/users',
    {
      userCode: `PH${digits}`,
      email: `video-parent-${digits}@school.local`,
      password,
      fullName: `Video Parent ${label} ${digits.slice(-4)}`,
      role: 'PARENT',
      phone,
    },
  );
  return {
    _id: parent._id,
    email: parent.email,
    fullName: parent.fullName,
    phone: parent.phone,
    password,
  };
}

test.describe('Frontend UI automation video pilots', () => {
  test('B01 auth, routing, app shell va flow guide', async ({ browser, request }) => {
    test.slow();
    test.setTimeout(180_000);

    const { context, page } = await createRecordedPage(browser);
    try {
      await showTitleCard(
        page,
        'B01. Auth, Session, Routing, App Shell',
        'Video này kiểm tra route guard, đăng nhập sai/đúng, widget Mô tả luồng, sidebar và chặn quyền theo role.',
        [
          'Bước test và kỳ vọng đều hiển thị bằng tiếng Việt.',
          'Con trỏ chuột được render trực tiếp trong video.',
          'Cuối video có kiểm tra chặn quyền khi PARENT mở trang tài chính nội bộ.',
        ],
      );

      await setVideoLabel(page, 'Bước 1: mở route nội bộ khi chưa đăng nhập, kỳ vọng bị đẩy về màn hình đăng nhập.');
      await page.goto(new URL('/app/dashboard', APP_BASE_URL).toString());
      await page.waitForURL(/\/login$/, { timeout: 20_000 });
      await expect(page.getByTestId('login-form')).toBeVisible();
      await page.waitForTimeout(1200);

      await setVideoLabel(page, 'Bước 2: nhập sai mật khẩu để xác nhận UI báo lỗi đăng nhập thân thiện.');
      await slowFill(page, page.getByTestId('login-email'), roleEmail('director'));
      await slowFill(page, page.getByTestId('login-password'), 'SaiMatKhau123!');
      await clickLocator(page, page.getByTestId('login-submit'));
      await expect(page.getByTestId('login-error')).toContainText(/Dang nhap that bai|Sai email hoac mat khau/i, { timeout: 10_000 });
      await page.waitForTimeout(1000);

      await setVideoLabel(page, 'Bước 3: đăng nhập đúng bằng DIRECTOR, kỳ vọng vào được dashboard.');
      await clickLocator(page, page.getByTestId('login-show-password'));
      await slowFill(page, page.getByTestId('login-password'), rolePassword());
      await clickLocator(page, page.getByTestId('login-submit'));
      await page.waitForURL(/\/app\/dashboard$/, { timeout: 20_000 });
      await expect(page.locator('aside.sidebar')).toBeVisible();
      await page.waitForTimeout(1000);

      await setVideoLabel(page, 'Bước 4: mở widget Mô tả luồng trên dashboard và kiểm tra nội dung hướng dẫn.');
      await maybeOpenFlowGuide(page);
      await expect(page.locator('.flow-content')).toBeVisible({ timeout: 10_000 });
      await page.waitForTimeout(1000);

      await setVideoLabel(page, 'Bước 5: thu gọn và mở lại sidebar, rồi điều hướng sang màn Quản lý User.');
      const sidebarToggle = page.locator('aside.sidebar .toggle').first();
      await clickLocator(page, sidebarToggle);
      await page.waitForTimeout(700);
      await clickLocator(page, sidebarToggle);
      await page.waitForTimeout(700);
      const usersLink = page.locator('a[href="/app/users"]').first();
      await clickLocator(page, usersLink);
      await page.waitForURL(/\/app\/users$/, { timeout: 20_000 });
      await page.waitForTimeout(1000);

      await setVideoLabel(page, 'Bước 6: đăng xuất, kỳ vọng quay về login và kết thúc session hiện tại.');
      await clickLocator(page, page.locator('button.logout').first());
      await page.waitForURL(/\/login$/, { timeout: 20_000 });
      await expect(page.getByTestId('login-form')).toBeVisible();
      await page.waitForTimeout(1000);

      await setVideoLabel(page, 'Bước 7: đăng nhập bằng PARENT rồi mở thẳng trang tài chính, kỳ vọng bị chặn quyền.');
      const parentSession = await loginAsRole(request, 'parent');
      await openVideoContextForRole(page, parentSession, '/app/financial-control');
      await page.waitForURL(/\/not-authorized$/, { timeout: 20_000 });
      await expect(page.getByText(/not authorized|khong co quyen|không có quyền/i)).toBeVisible({ timeout: 10_000 });
      await page.waitForTimeout(1500);

      await setVideoLabel(page, 'Kết quả thực tế: route guard, login, flow guide, sidebar, logout và chặn quyền theo role đều hoạt động.');
      await page.waitForTimeout(1200);
      await setVideoLabel(page, null);
    } finally {
      await saveRecordedVideo(page, context, `UI_B01_Auth_AppShell_${DATE_STAMP}`);
    }
  });

  test('B02 dashboards, handbook, pending approvals va hub theo role', async ({ browser, request }) => {
    test.slow();
    test.setTimeout(300_000);

    const directorSession = await loginAsRole(request, 'director');
    const opsSession = await loginAsRole(request, 'ops');
    const parentSession = await loginAsRole(request, 'parent');
    const label = `B02Video${Date.now()}`;
    const digits = `${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(-10);

    const pendingParent = await createParentAccount(request, directorSession, `${label}-pending-topup`);
    await apiJson<any>(
      request,
      directorSession,
      'POST',
      '/wallets/top-up',
      {
        userId: pendingParent._id,
        amount: 350_000,
        paymentMethod: 'BANK_TRANSFER',
        transactionRef: `B02-${digits.slice(-6)}`,
        receiptImageUrl: '/uploads/wallets/b02-top-up.png',
        description: `Top up cho ${label}`,
      },
    );

    const [sale, teacher] = await Promise.all([
      ensureSaleAccount(request, directorSession, label),
      ensureTeacherAccount(request, directorSession, label),
    ]);

    const [saleSession, teacherSession] = await Promise.all([
      loginAsCredentials(request, 'sale', sale.email, sale.password),
      loginAsCredentials(request, 'teacher', teacher.email, teacher.password),
    ]);

    const { context, page } = await createRecordedPage(browser);
    try {
      await showTitleCard(
        page,
        'B02. Dashboard, Handbook, Empty State, Alerts',
        'Video pilot này quay các màn hình tổng quan theo role, cẩm nang nội bộ, hub landing và hub chờ duyệt với dữ liệu chờ xử lý thật.',
        [
          'Kỳ vọng: dashboard theo role mở đúng mà không vỡ layout.',
          'Kỳ vọng: Director mở được handbook và pending approvals có dữ liệu top-up chờ duyệt.',
          'Kỳ vọng: teacher-hub và sale-hub mở đúng bằng URL trực tiếp, còn route sai quyền bị chặn.',
        ],
      );

      await setVideoLabel(page, 'Bước 1: mở dashboard Director, kiểm tra banner cẩm nang và widget Mô tả luồng.');
      await openVideoContextForRole(page, directorSession, '/app/dashboard');
      await expect(page.getByText(/Dashboard Giám đốc|Dashboard Giam doc/i)).toBeVisible({ timeout: 20_000 });
      await expect(page.getByRole('link', { name: /Mo cam nang/i })).toBeVisible({ timeout: 10_000 });
      await maybeOpenFlowGuide(page);
      await expect(page.locator('.flow-content')).toBeVisible({ timeout: 10_000 });
      await page.waitForTimeout(1000);

      await setVideoLabel(page, 'Bước 2: Director mở cẩm nang nội bộ và kiểm tra phần hero, quick flow và nội dung hướng dẫn.');
      await clickLocator(page, page.getByRole('link', { name: /Mo cam nang/i }));
      await page.waitForURL(/\/app\/internal-handbook$/, { timeout: 20_000 });
      await expect(page.getByText(/Cẩm nang nội bộ|Cam nang noi bo/i).first()).toBeVisible({ timeout: 10_000 });
      await expect(page.getByText(/3 luồng thao tác cần nắm|3 luong thao tac can nam/i)).toBeVisible({ timeout: 10_000 });
      await page.waitForTimeout(1000);

      await setVideoLabel(page, 'Bước 3: Director vào hub Chờ duyệt, chuyển sang tab Nạp ví và kiểm tra yêu cầu top-up mới vừa seed.');
      await page.goto(new URL('/app/pending-approvals', APP_BASE_URL).toString());
      await page.waitForLoadState('networkidle');
      await expect(page.getByRole('heading', { name: /Cho duyet/i })).toBeVisible({ timeout: 20_000 });
      await expect(page.locator('.tabs button').filter({ hasText: /Bang luong/i })).toBeVisible();
      await expect(page.locator('.tabs button').filter({ hasText: /Hoa don/i })).toBeVisible();
      await expect(page.locator('.tabs button').filter({ hasText: /Nap vi/i })).toBeVisible();
      await expect(page.locator('.tabs button').filter({ hasText: /Giao vien/i })).toBeVisible();
      await expect(page.locator('.tabs button').filter({ hasText: /Sua lop/i })).toBeVisible();
      await expect(page.locator('.tabs button').filter({ hasText: /Doi buoi hoc/i })).toBeVisible();
      const topupTab = page.locator('.tabs button').filter({ hasText: /Nap vi/i }).first();
      await clickLocator(page, topupTab);
      await expect(page.getByText(pendingParent.fullName, { exact: false })).toBeVisible({ timeout: 20_000 });
      await page.waitForTimeout(1200);

      await setVideoLabel(page, 'Bước 4: chuyển sang dashboard OPS để xác nhận màn tổng quan vận hành tải đúng.');
      await openVideoContextForRole(page, opsSession, '/app/dashboard');
      await expect(page.getByText(/Dashboard Vận hành|Dashboard Van hanh/i)).toBeVisible({ timeout: 20_000 });
      await page.waitForTimeout(900);

      await setVideoLabel(page, 'Bước 5: mở dashboard Parent để kiểm tra layout tổng quan tài chính, học bạ và hỗ trợ.');
      await openVideoContextForRole(page, parentSession, '/app/dashboard');
      await expect(page.getByText(/Dashboard phụ huynh|Dashboard phu huynh/i)).toBeVisible({ timeout: 20_000 });
      await expect(page.getByText(/Tài chính|Tai chinh/i).first()).toBeVisible({ timeout: 10_000 });
      await page.waitForTimeout(900);

      await setVideoLabel(page, 'Bước 6: mở dashboard Teacher rồi vào trực tiếp teacher-hub bằng URL, kỳ vọng landing page tải đúng.');
      await openVideoContextForRole(page, teacherSession, '/app/dashboard');
      await expect(page.getByText(/Dashboard Giáo viên|Dashboard Giao vien/i)).toBeVisible({ timeout: 20_000 });
      await page.goto(new URL('/app/teacher-hub', APP_BASE_URL).toString());
      await page.waitForLoadState('networkidle');
      await expect(page.getByText(/Internal Teacher Hub/i)).toBeVisible({ timeout: 20_000 });
      await page.waitForTimeout(1000);

      await setVideoLabel(page, 'Bước 7: mở dashboard Sale rồi vào trực tiếp sale-hub bằng URL, kỳ vọng landing page tải đúng.');
      await openVideoContextForRole(page, saleSession, '/app/dashboard');
      await expect(page.getByText(/Dashboard Sale/i)).toBeVisible({ timeout: 20_000 });
      await page.goto(new URL('/app/sale-hub', APP_BASE_URL).toString());
      await page.waitForLoadState('networkidle');
      await expect(page.getByText(/Internal Sale Hub/i)).toBeVisible({ timeout: 20_000 });
      await page.waitForTimeout(1000);

      await setVideoLabel(page, 'Bước 8: Director mở trực tiếp teacher-hub để xác nhận route guard vẫn chặn đúng theo role.');
      await openVideoContextForRole(page, directorSession, '/app/teacher-hub');
      await page.waitForURL(/\/not-authorized$/, { timeout: 20_000 });
      await expect(page.getByText(/not authorized|khong co quyen|không có quyền/i)).toBeVisible({ timeout: 10_000 });
      await page.waitForTimeout(1000);

      await setVideoLabel(page, 'Bước 9: Director mở investor-dashboard và đổi filter xu hướng 3, 6, 12 tháng mà không làm sập trang.');
      await openVideoContextForRole(page, directorSession, '/app/investor-dashboard');
      await expect(page.getByText(/Investor dashboard/i).first()).toBeVisible({ timeout: 20_000 });
      const monthSelect = page.locator('.month-filter select');
      await monthSelect.selectOption({ index: 1 });
      await page.waitForTimeout(1000);
      await monthSelect.selectOption({ index: 2 });
      await page.waitForTimeout(1000);
      await expect(monthSelect.locator('option:checked')).toContainText(/12 tháng/i);
      await page.waitForTimeout(1200);

      await setVideoLabel(page, 'Kết quả thực tế: dashboard theo nhiều role, handbook, pending approvals, investor filter và hub landing đều hoạt động đúng trong pilot này.');
      await page.waitForTimeout(1200);
      await setVideoLabel(page, null);
    } finally {
      await saveRecordedVideo(page, context, `UI_B02_Dashboard_Handbook_P1_${DATE_STAMP}`);
    }
  });

  test('B03 users, students, products, agents va owner assignment', async ({ browser, request }) => {
    test.slow();
    test.setTimeout(420_000);

    const directorSession = await loginAsRole(request, 'director');
    const accountingSession = await loginAsRole(request, 'accounting');
    const opsSession = await loginAsRole(request, 'ops');

    const label = `B03Video${Date.now()}`;
    const digits = `${Date.now()}${Math.floor(Math.random() * 1000)}`.replace(/\D/g, '').slice(-10);
    const saleADigits = `${digits}11`.slice(-10);
    const saleBDigits = `${digits}22`.slice(-10);

    const saleA = await apiJson<any>(
      request,
      directorSession,
      'POST',
      '/users',
      {
        userCode: `B03SA${saleADigits.slice(-5)}`,
        email: `b03-sale-a-${saleADigits}@school.local`,
        password: rolePassword(),
        fullName: `B03 Sale A ${saleADigits.slice(-4)}`,
        role: 'SALE',
        phone: uniquePhone(`b03-sale-a-${saleADigits}`),
      },
    );

    const saleB = await apiJson<any>(
      request,
      directorSession,
      'POST',
      '/users',
      {
        userCode: `B03SB${saleBDigits.slice(-5)}`,
        email: `b03-sale-b-${saleBDigits}@school.local`,
        password: rolePassword(),
        fullName: `B03 Sale B ${saleBDigits.slice(-4)}`,
        role: 'SALE',
        phone: uniquePhone(`b03-sale-b-${saleBDigits}`),
      },
    );

    const saleSession = await loginAsCredentials(request, 'sale', saleA.email, rolePassword());

    const ownerParent = await apiJson<any>(
      request,
      directorSession,
      'POST',
      '/users',
      {
        userCode: `B03PH${digits.slice(-5)}`,
        email: `b03-parent-${digits}@school.local`,
        password: rolePassword(),
        fullName: `B03 Parent ${digits.slice(-4)}`,
        role: 'PARENT',
        phone: uniquePhone(`b03-parent-${digits}`),
        address: '123 B03 Test Street',
        facebookLink: 'https://facebook.com/b03-parent',
        saleOwnerId: saleA._id,
      },
    );

    const ownerStudent = await apiJson<any>(
      request,
      directorSession,
      'POST',
      '/students',
      {
        studentCode: `B03OWN${digits.slice(-5)}`,
        fullName: `B03 Owner Student ${digits.slice(-4)}`,
        age: 9,
        parentName: ownerParent.fullName,
        parentPhone: ownerParent.phone,
        parentUserId: ownerParent._id,
        faceImage: 'default-avatar.png',
        saleId: saleA._id,
        saleName: saleA.fullName,
      },
    );

    const uiUserCode = `B03USR${digits.slice(-5)}`;
    const uiUserEmail = `b03-user-${digits}@school.local`;
    const uiUserPhone = uniquePhone(`b03-ui-user-${digits}`);
    const uiUserUpdatedName = `B03 Ops User ${digits.slice(-4)}`;
    const uiUserUpdatedPhone = uniquePhone(`b03-ui-user-updated-${digits}`);

    const uiStudentCode = `B03HS${digits.slice(-5)}`;
    const uiStudentName = `B03 UI Student ${digits.slice(-4)}`;
    const uiStudentUpdatedName = `B03 UI Student Updated ${digits.slice(-4)}`;

    const productName = `B03 Product ${digits.slice(-4)}`;
    const productUpdatedName = `B03 Product Archived ${digits.slice(-4)}`;

    const agentName = `B03 Agent ${digits.slice(-4)}`;
    const agentUpdatedName = `B03 Agent Updated ${digits.slice(-4)}`;
    const agentPhone = uniquePhone(`b03-agent-${digits}`);
    const agentUpdatedPhone = uniquePhone(`b03-agent-updated-${digits}`);

    const { context, page } = await createRecordedPage(browser);
    try {
      await showTitleCard(
        page,
        'B03. Users, Students, Products, Agents',
        'Video nay gom nhung flow quan trong cua batch B03: user CRUD co doi role, parent owner assignment, student CRUD, product CRUD va agents theo nhieu role.',
        [
          'Ky vong: Director tao va sua user thanh cong, doi role va cap nhat thong tin co ban.',
          'Ky vong: parent owner assignment doi sang sale moi va dong bo du lieu lien quan.',
          'Ky vong: student va product CRUD hoat dong on dinh tren UI hien tai.',
          'Ky vong: agents page tai duoc voi Director, Accounting, OPS, Sale; rieng Sale khong thay nut tao dai ly.',
        ],
      );

      await setVideoLabel(page, 'Buoc 1: Director mo Users, tao user role SALE moi va kiem tra dong du lieu vua tao xuat hien trong bang.');
      await openVideoContextForRole(page, directorSession, '/app/users');
      await expect(page.getByText(/Quan ly tai khoan/i).first()).toBeVisible({ timeout: 20_000 });
      await maybeOpenFlowGuide(page);
      await clickLocator(page, page.locator('header.page-header button.primary').first());
      const userModal = page.locator('.modal-backdrop .modal').first();
      await slowFill(page, userModal.locator('input[name="userCode"]'), uiUserCode, 45);
      await slowFill(page, userModal.locator('input[name="email"]'), uiUserEmail, 35);
      await slowFill(page, userModal.locator('input[name="phone"]'), uiUserPhone, 45);
      await slowFill(page, userModal.locator('input[name="password"]'), rolePassword(), 35);
      await slowFill(page, userModal.locator('input[name="fullName"]'), `B03 Sale User ${digits.slice(-4)}`, 35);
      await userModal.locator('select[name="role"]').selectOption('SALE');
      await clickLocator(page, userModal.locator('button[type="submit"]').first());
      const usersSearch = page.locator('section.filters input').first();
      await slowFill(page, usersSearch, uiUserCode, 30);
      const createdUserRow = page.locator('table.data tbody tr').filter({ hasText: uiUserCode }).first();
      await expect(createdUserRow).toBeVisible({ timeout: 20_000 });
      await expect
        .poll(async () => {
          const users = await apiJson<any[]>(request, directorSession, 'GET', '/users');
          return users.find((user: any) => user.email === uiUserEmail)?.role || '';
        })
        .toBe('SALE');
      await page.waitForTimeout(1000);

      await setVideoLabel(page, 'Buoc 2: Sua user vua tao, doi role sang OPS va cap nhat thong tin co ban, ky vong bang va API cung phan anh role moi.');
      await clickLocator(page, createdUserRow.locator('button').filter({ hasText: /^Sua$/i }).first());
      const editUserModal = page.locator('.modal-backdrop .modal').first();
      await slowFill(page, editUserModal.locator('input[name="fullName"]'), uiUserUpdatedName, 35);
      await slowFill(page, editUserModal.locator('input[name="phone"]'), uiUserUpdatedPhone, 40);
      await editUserModal.locator('select[name="role"]').selectOption('OPS');
      await clickLocator(page, editUserModal.locator('button[type="submit"]').first());
      await expect(createdUserRow).toContainText(uiUserUpdatedName, { timeout: 20_000 });
      await expect(createdUserRow).toContainText(/Van hanh|OPS/i, { timeout: 20_000 });
      await expect
        .poll(async () => {
          const users = await apiJson<any[]>(request, directorSession, 'GET', '/users');
          const updated = users.find((user: any) => user.email === uiUserEmail);
          return `${updated?.role || ''}|${updated?.fullName || ''}|${updated?.phone || ''}`;
        })
        .toBe(`OPS|${uiUserUpdatedName}|${uiUserUpdatedPhone}`);
      await page.waitForTimeout(1000);

      await setVideoLabel(page, 'Buoc 3: Chuyen sang che do tai khoan phu huynh, doi sale owner cua parent seed tu Sale A sang Sale B va xac nhan du lieu owner duoc cap nhat.');
      await clickLocator(page, page.getByRole('button', { name: /Tai khoan phu huynh/i }).first());
      await page.waitForTimeout(800);
      await slowFill(page, usersSearch, ownerParent.userCode || ownerParent.fullName, 35);
      const parentRow = page.locator('table.data tbody tr').filter({ hasText: ownerParent.userCode || ownerParent.fullName }).first();
      await clickLocator(page, parentRow);
      await expect(page.locator('.detail-table')).toBeVisible({ timeout: 10_000 });
      await page.locator('select[name="selectedParentSaleOwnerId"]').first().selectOption(saleB._id);
      await clickLocator(page, page.getByRole('button', { name: /Luu sale phu trach/i }).first());
      await expect(page.getByText(/Da cap nhat sale phu trach cho phu huynh/i)).toBeVisible({ timeout: 20_000 });
      await expect(page.locator('.detail-table')).toContainText(saleB.fullName, { timeout: 20_000 });
      await expect
        .poll(async () => {
          const parents = await apiJson<any[]>(request, directorSession, 'GET', '/users/parents');
          return parents.find((item: any) => item._id === ownerParent._id)?.saleOwnerId || '';
        })
        .toBe(saleB._id);
      await expect
        .poll(async () => {
          const student = await apiJson<any>(request, directorSession, 'GET', `/students/${ownerStudent._id}`);
          return student.saleId || '';
        })
        .toBe(saleB._id);
      await page.waitForTimeout(1000);

      await setVideoLabel(page, 'Buoc 4: Mo Students, tao hoc sinh moi co upload anh, sau do sua va xoa ngay tren UI.');
      await page.goto(new URL('/app/students', APP_BASE_URL).toString());
      await page.waitForLoadState('networkidle');
      await expect(page.getByText(/Quan ly hoc sinh/i).first()).toBeVisible({ timeout: 20_000 });
      await maybeOpenFlowGuide(page);
      const studentsSearch = page.locator('section.filters input').first();
      await clickLocator(page, page.locator('header.page-header button.primary').first());
      const studentModal = page.locator('.modal-backdrop .modal').first();
      await slowFill(page, studentModal.locator('input[name="studentCode"]'), uiStudentCode, 45);
      await slowFill(page, studentModal.locator('input[name="fullName"]'), uiStudentName, 35);
      await slowFill(page, studentModal.locator('input[name="age"]'), '8', 80);
      await studentModal.locator('select[name="parentUserId"]').selectOption(ownerParent._id);
      await studentModal.locator('input[type="file"]').setInputFiles(pngFilePayload('b03-student-face.png'));
      await expect(studentModal.locator('.preview')).toBeVisible({ timeout: 20_000 });
      await clickLocator(page, studentModal.locator('button[type="submit"]').first());
      await slowFill(page, studentsSearch, uiStudentCode, 35);
      const createdStudentRow = page.locator('table.data tbody tr').filter({ hasText: uiStudentCode }).first();
      await expect(createdStudentRow).toBeVisible({ timeout: 20_000 });
      await expect
        .poll(async () => {
          const students = await apiJson<any[]>(request, directorSession, 'GET', '/students');
          return students.find((student: any) => student.studentCode === uiStudentCode)?._id || '';
        })
        .not.toBe('');

      await clickLocator(page, createdStudentRow.locator('button').filter({ hasText: /^Sua$/i }).first());
      const editStudentModal = page.locator('.modal-backdrop .modal').first();
      await slowFill(page, editStudentModal.locator('input[name="fullName"]'), uiStudentUpdatedName, 35);
      await slowFill(page, editStudentModal.locator('input[name="age"]'), '10', 80);
      await clickLocator(page, editStudentModal.locator('button[type="submit"]').first());
      await expect(createdStudentRow).toContainText(uiStudentUpdatedName, { timeout: 20_000 });
      await expect
        .poll(async () => {
          const students = await apiJson<any[]>(request, directorSession, 'GET', '/students');
          const updated = students.find((student: any) => student.studentCode === uiStudentCode);
          return `${updated?.fullName || ''}|${updated?.age || ''}`;
        })
        .toBe(`${uiStudentUpdatedName}|10`);

      await acceptDialog(
        page,
        () => clickLocator(page, createdStudentRow.locator('button').filter({ hasText: /^Xoa$/i }).first()),
      );
      await expect(createdStudentRow).toHaveCount(0, { timeout: 20_000 });
      await expect
        .poll(async () => {
          const students = await apiJson<any[]>(request, directorSession, 'GET', '/students');
          return students.some((student: any) => student.studentCode === uiStudentCode) ? 'present' : 'removed';
        })
        .toBe('removed');
      await page.waitForTimeout(1000);

      await setVideoLabel(page, 'Buoc 5: Mo Products, tao san pham moi, sua san pham sang trang thai dung ban roi xoa de xac nhan CRUD co ban.');
      await page.goto(new URL('/app/products', APP_BASE_URL).toString());
      await page.waitForLoadState('networkidle');
      await expect(page.getByText(/Quan ly goi san pham/i).first()).toBeVisible({ timeout: 20_000 });
      await maybeOpenFlowGuide(page);
      const productsSearch = page.locator('section.filters input').first();
      await clickLocator(page, page.locator('header.page-header button.primary').first());
      const productModal = page.locator('.modal-backdrop .modal').first();
      await slowFill(page, productModal.locator('input[name="name"]'), productName, 35);
      await productModal.locator('select[name="category"]').selectOption('ENGLISH');
      await productModal.locator('select[name="teachingMode"]').selectOption('ONLINE');
      await slowFill(page, productModal.locator('input[name="defaultSessions"]'), '12', 80);
      await slowFill(page, productModal.locator('input[name="suggestedPrice"]'), '3600000', 20);
      await slowFill(page, productModal.locator('input[name="defaultSessionDuration"]'), '90', 80);
      await clickLocator(page, productModal.locator('button[type="submit"]').first());
      await productsSearch.fill(productName);
      const createdProductRow = page.locator('table.data tbody tr').filter({ hasText: productName }).first();
      await expect(createdProductRow).toBeVisible({ timeout: 20_000 });

      await clickLocator(page, createdProductRow.locator('button').filter({ hasText: /^Sua$/i }).first());
      const editProductModal = page.locator('.modal-backdrop .modal').first();
      const activeCheckbox = editProductModal.locator('input[name="isActive"]');
      await slowFill(page, editProductModal.locator('input[name="name"]'), productUpdatedName, 35);
      if (await activeCheckbox.isChecked()) {
        await clickLocator(page, activeCheckbox);
      }
      await clickLocator(page, editProductModal.locator('button[type="submit"]').first());
      await expect
        .poll(async () => {
          const products = await apiJson<any[]>(request, directorSession, 'GET', '/products');
          const updated = products.find((product: any) => product.name === productUpdatedName);
          return `${updated?.name || ''}|${updated?.isActive === false ? 'inactive' : 'active'}`;
        })
        .toBe(`${productUpdatedName}|inactive`);
      await page.goto(new URL('/app/products', APP_BASE_URL).toString());
      await page.waitForLoadState('networkidle');
      const productsSearchAfterEdit = page.locator('section.filters input').first();
      await productsSearchAfterEdit.fill(productUpdatedName);
      const updatedProductRow = page.locator('table.data tbody tr').filter({ hasText: productUpdatedName }).first();
      await expect(updatedProductRow).toBeVisible({ timeout: 20_000 });
      await expect(updatedProductRow).toContainText(/Dung ban/i, { timeout: 20_000 });
      await expect(updatedProductRow).toContainText(productUpdatedName, { timeout: 20_000 });

      await acceptDialog(
        page,
        () => clickLocator(page, updatedProductRow.locator('button').filter({ hasText: /^Xoa$/i }).first()),
      );
      await expect(updatedProductRow).toHaveCount(0, { timeout: 20_000 });
      await expect
        .poll(async () => {
          const products = await apiJson<any[]>(request, directorSession, 'GET', '/products');
          return products.some((product: any) => product.name === productUpdatedName) ? 'present' : 'removed';
        })
        .toBe('removed');
      await page.waitForTimeout(1000);

      await setVideoLabel(page, 'Buoc 6: Director mo Agents, tao dai ly moi, sua thong tin roi suspend va activate de kiem tra status cap nhat tren UI.');
      await page.goto(new URL('/app/agents', APP_BASE_URL).toString());
      await page.waitForLoadState('networkidle');
      await expect(page.getByText(/Dai Ly|Đại Lý/i).first()).toBeVisible({ timeout: 20_000 });
      const agentsSearch = page.locator('.filters input').first();
      await clickLocator(page, page.locator('.header button').filter({ hasText: /Them dai ly|Thêm đại lý/i }).first());
      const agentModal = page.locator('.modal-backdrop .modal').first();
      const agentField = (pattern: RegExp, selector = 'input') =>
        agentModal.locator('.form-group').filter({ hasText: pattern }).locator(selector).first();
      await slowFill(page, agentField(/Ten dai ly|Tên đại lý/i), agentName, 35);
      await slowFill(page, agentField(/Nguoi lien he|Người liên hệ/i), 'B03 Contact', 35);
      await slowFill(page, agentField(/SĐT|SDT/i), agentPhone, 35);
      await slowFill(page, agentField(/Email/i), `b03-agent-${digits}@school.local`, 20);
      await agentField(/Hang|Hạng/i, 'select').selectOption('GOLD');
      await slowFill(page, agentField(/Hoa hong|Hoa hồng/i), '12', 80);
      await clickLocator(page, agentModal.locator('.modal-actions button').filter({ hasText: /Luu|Lưu/i }).first());
      await slowFill(page, agentsSearch, agentName, 35);
      const createdAgentRow = page.locator('table.data-table tbody tr').filter({ hasText: agentName }).first();
      await expect(createdAgentRow).toBeVisible({ timeout: 20_000 });

      await clickLocator(page, createdAgentRow.locator('button').filter({ hasText: /Sua|Sửa/i }).first());
      const editAgentModal = page.locator('.modal-backdrop .modal').first();
      const editAgentField = (pattern: RegExp, selector = 'input') =>
        editAgentModal.locator('.form-group').filter({ hasText: pattern }).locator(selector).first();
      await slowFill(page, editAgentField(/Ten dai ly|Tên đại lý/i), agentUpdatedName, 35);
      await slowFill(page, editAgentField(/Nguoi lien he|Người liên hệ/i), 'B03 Contact Updated', 35);
      await slowFill(page, editAgentField(/SĐT|SDT/i), agentUpdatedPhone, 35);
      await editAgentField(/Hang|Hạng/i, 'select').selectOption('PLATINUM');
      await slowFill(page, editAgentField(/Hoa hong|Hoa hồng/i), '18', 80);
      await clickLocator(page, editAgentModal.locator('.modal-actions button').filter({ hasText: /Luu|Lưu/i }).first());
      await slowFill(page, agentsSearch, agentUpdatedName, 35);
      const updatedAgentRow = page.locator('table.data-table tbody tr').filter({ hasText: agentUpdatedName }).first();
      await expect(updatedAgentRow).toBeVisible({ timeout: 20_000 });
      await expect(updatedAgentRow).toContainText(/PLATINUM/i, { timeout: 20_000 });

      await acceptDialog(
        page,
        () => clickLocator(page, updatedAgentRow.locator('button').filter({ hasText: /Tam ngung|Tạm ngưng/i }).first()),
      );
      await expect(updatedAgentRow).toContainText(/Tam ngung|Tạm ngưng|SUSPENDED/i, { timeout: 20_000 });

      await acceptDialog(
        page,
        () => clickLocator(page, updatedAgentRow.locator('button').filter({ hasText: /Kich hoat|Kích hoạt/i }).first()),
      );
      await expect(updatedAgentRow).toContainText(/Hoat dong|Hoạt động|ACTIVE/i, { timeout: 20_000 });
      await page.waitForTimeout(1000);

      await setVideoLabel(page, 'Buoc 7: Mo agents page voi Accounting, OPS va Sale. Ky vong danh sach tai duoc cho ca 3 role; rieng Sale khong thay nut tao dai ly.');
      await openVideoContextForRole(page, accountingSession, '/app/agents');
      await expect(page.getByText(/Dai Ly|Đại Lý/i).first()).toBeVisible({ timeout: 20_000 });
      await slowFill(page, page.locator('.filters input').first(), agentUpdatedName, 35);
      await expect(page.locator('table.data-table tbody tr').filter({ hasText: agentUpdatedName }).first()).toBeVisible({ timeout: 20_000 });

      await openVideoContextForRole(page, opsSession, '/app/agents');
      await expect(page.getByText(/Dai Ly|Đại Lý/i).first()).toBeVisible({ timeout: 20_000 });
      await expect(page.locator('.header button').filter({ hasText: /Them dai ly|Thêm đại lý/i }).first()).toBeVisible({ timeout: 20_000 });
      await slowFill(page, page.locator('.filters input').first(), agentUpdatedName, 35);
      await expect(page.locator('table.data-table tbody tr').filter({ hasText: agentUpdatedName }).first()).toBeVisible({ timeout: 20_000 });

      await openVideoContextForRole(page, saleSession, '/app/agents');
      await expect(page.getByText(/Dai Ly|Đại Lý/i).first()).toBeVisible({ timeout: 20_000 });
      await slowFill(page, page.locator('.filters input').first(), agentUpdatedName, 35);
      await expect(page.locator('table.data-table tbody tr').filter({ hasText: agentUpdatedName }).first()).toBeVisible({ timeout: 20_000 });
      await expect(page.locator('.header button').filter({ hasText: /Them dai ly|Thêm đại lý/i })).toHaveCount(0);
      await page.waitForTimeout(1200);

      await setVideoLabel(page, 'Ket qua thuc te: B03 da cover user CRUD co doi role, owner assignment, student CRUD, product CRUD va agents theo nhieu role; rieng deactivation product moi chi cover trang thai tren man Products.');
      await page.waitForTimeout(1500);
      await setVideoLabel(page, null);
    } finally {
      await saveRecordedVideo(page, context, `UI_B03_Users_Students_Products_${DATE_STAMP}`);
    }
  });

  test('B04 order auto calculation, auto provision va submit duyet', async ({ browser, request }) => {
    test.slow();
    test.setTimeout(240_000);

    const directorSession = await loginAsRole(request, 'director');
    const label = `AutoVideoB04${Date.now()}`;
    const product = await apiJson<any>(
      request,
      directorSession,
      'POST',
      '/products',
      {
        name: `UI Video Product ${label}`,
        code: `VID${Date.now().toString().slice(-8)}`,
        description: 'Product phuc vu quay video automation UI',
        category: 'ENGLISH',
        teachingMode: 'ONLINE',
        defaultSessions: 10,
        defaultSessionDuration: 60,
        pricePerSession: 500_000,
        suggestedPrice: 5_000_000,
        commissionRate: 0,
        isActive: true,
      },
    );

    const { context, page } = await createRecordedPage(browser);
    try {
      const saleSession = await loginAsRole(request, 'sale');
      const parentPhone = `09${Date.now().toString().slice(-8)}`;
      const parentName = `PH Video ${Date.now().toString().slice(-6)}`;
      const studentName = `HS Video ${Date.now().toString().slice(-6)}`;

      await showTitleCard(
        page,
        'B04. Leads, Orders, Trials',
        'Video pilot này tập trung vào tạo order với phụ huynh mới, tính tiền tự động, upload chứng từ và gửi duyệt.',
        [
          'Kỳ vọng: form Order cho nhập SĐT phụ huynh mới mà vẫn submit được.',
          'Kỳ vọng: tổng tiền và thành tiền cuối cập nhật ngay trên UI.',
          'Kỳ vọng: Sale gửi duyệt được và Director nhìn thấy trạng thái Chờ duyệt.',
        ],
      );

      await openVideoContextForRole(page, saleSession, '/app/orders');
      await setVideoLabel(page, 'Bước 1: mở màn Orders, mở Flow Guide và khởi tạo form tạo đơn.');
      await maybeOpenFlowGuide(page);
      await clickLocator(page, page.getByTestId('orders-create-button'));
      await expect(page.getByTestId('order-form-modal')).toBeVisible({ timeout: 10_000 });
      await page.waitForTimeout(800);

      await setVideoLabel(page, 'Bước 2: nhập phụ huynh mới hoàn toàn, học sinh mới và chọn gói học.');
      await clickLocator(page, page.getByTestId('order-parent-new'));
      await clickLocator(page, page.getByTestId('order-student-new'));
      await slowFill(page, page.getByTestId('order-parent-name'), parentName);
      await slowFill(page, page.getByTestId('order-parent-phone'), parentPhone);
      await slowFill(page, page.getByTestId('order-student-name'), studentName);
      await clickLocator(page, page.getByTestId('order-item-product-0'));
      await page.getByTestId('order-item-product-0').selectOption(product._id);
      await expect(page.getByTestId('order-total-amount')).toHaveValue('5000000');
      await page.waitForTimeout(600);

      await setVideoLabel(page, 'Bước 3: nhập giảm giá hợp lệ, kỳ vọng thành tiền cuối cập nhật tức thì.');
      await slowFill(page, page.getByTestId('order-discount-amount'), '500000');
      await slowFill(page, page.getByTestId('order-discount-reason'), 'Khuyến mãi chốt đơn tháng 4', 45);
      await expect(page.getByTestId('order-final-amount')).toHaveValue('4500000');

      await setVideoLabel(page, 'Bước 4: chọn phương án xếp lớp sau và upload chứng từ để chuẩn bị gửi duyệt.');
      await page.getByTestId('order-item-class-0').selectOption('');
      await page.getByTestId('order-receipt-file').setInputFiles(TEST_UPLOAD_FILE);
      await page.waitForTimeout(1200);

      await setVideoLabel(page, 'Bước 5: lưu order nháp. Kỳ vọng dòng order mới xuất hiện trong danh sách.');
      await clickLocator(page, page.getByTestId('order-submit'));
      await expect(page.getByTestId('order-form-modal')).toBeHidden({ timeout: 15_000 });
      const row = page.getByTestId('order-row').filter({ hasText: parentName }).first();
      await expect(row).toBeVisible({ timeout: 15_000 });
      await page.waitForTimeout(900);

      await setVideoLabel(page, 'Bước 6: Sale gửi duyệt order. Kỳ vọng badge chuyển sang Chờ duyệt.');
      await acceptDialog(page, async () => {
        await clickLocator(page, row.getByTestId('order-row-submit'));
      });
      await expect(row.locator('.badge')).toContainText(/Chờ duyệt|SUBMITTED/i, { timeout: 10_000 });
      await page.waitForTimeout(1200);

      await setVideoLabel(page, 'Bước 7: Director mở lại màn Orders để xác nhận order mới đã ở trạng thái Chờ duyệt.');
      await openVideoContextForRole(page, directorSession, '/app/orders');
      const directorRow = page.getByTestId('order-row').filter({ hasText: parentName }).first();
      await expect(directorRow).toBeVisible({ timeout: 15_000 });
      await expect(directorRow.locator('.badge')).toContainText(/Chờ duyệt|SUBMITTED/i, { timeout: 10_000 });
      await page.waitForTimeout(1500);

      await setVideoLabel(page, 'Kết quả thực tế: Order chấp nhận phụ huynh mới, tính tiền đúng và gửi duyệt thành công.');
      await page.waitForTimeout(1200);
      await setVideoLabel(page, null);
    } finally {
      await saveRecordedVideo(page, context, `UI_B04_Orders_Trials_P1_${DATE_STAMP}`);
    }
  });

  test('B04 P2 existing order validation, approve order va trial enrollment decisions', async ({ browser, request }) => {
    test.slow();
    test.setTimeout(420_000);

    const directorSession = await loginAsRole(request, 'director');
    const label = `AutoVideoB04P2${Date.now()}`;
    const digits = `${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(-10);
    const sale = await ensureSaleAccount(request, directorSession, label);
    const teacher = await ensureTeacherAccount(request, directorSession, label);
    const saleSession = await loginAsCredentials(request, 'sale', sale.email, sale.password);

    const onlineProduct = await apiJson<any>(
      request,
      directorSession,
      'POST',
      '/products',
      {
        name: `UI Video Online ${label}`,
        code: `B4ON${digits.slice(-6)}`,
        description: 'San pham online phuc vu B04 P2',
        category: 'ENGLISH',
        teachingMode: 'ONLINE',
        defaultSessions: 10,
        defaultSessionDuration: 60,
        pricePerSession: 400_000,
        suggestedPrice: 4_000_000,
        commissionRate: 0,
        isActive: true,
      },
    );
    const offlineProduct = await apiJson<any>(
      request,
      directorSession,
      'POST',
      '/products',
      {
        name: `UI Video Offline ${label}`,
        code: `B4OF${digits.slice(-6)}`,
        description: 'San pham offline phuc vu B04 P2',
        category: 'ENGLISH',
        teachingMode: 'OFFLINE',
        defaultSessions: 2,
        defaultSessionDuration: 60,
        pricePerSession: 150_000,
        suggestedPrice: 300_000,
        commissionRate: 0,
        isActive: true,
      },
    );

    const existingParent = await createVideoParent(request, directorSession, `${label}-existing-parent`);
    const existingStudent = await apiJson<any>(
      request,
      directorSession,
      'POST',
      '/students',
      {
        studentCode: `B4HS${digits.slice(-6)}`,
        fullName: `HS Existing ${digits.slice(-4)}`,
        age: 10,
        parentName: existingParent.fullName,
        parentPhone: existingParent.phone,
        parentUserId: existingParent._id,
        faceImage: 'default-avatar.png',
        productPackage: onlineProduct._id,
        level: 'Starter',
        studentType: 'ONLINE',
        saleId: sale._id,
        saleName: sale.fullName,
      },
    );

    const offlineClass = await apiJson<any>(
      request,
      directorSession,
      'POST',
      '/classes',
      {
        name: `B04 Trial Class ${digits.slice(-4)}`,
        code: `B4CL${digits.slice(-6)}`,
        teacherId: teacher._id,
        saleId: sale._id,
        classMode: 'OFFLINE',
        productPackageId: offlineProduct._id,
        studentIds: [],
        subject: 'Tieng Anh',
        learningGoals: 'B04 P2 offline trial flow',
        pricePerSession: 150_000,
        teacherPayPerSession: 0,
        teacherPayPerStudent: 60_000,
        baseDuration: 60,
        sessionDuration: 60,
        maxStudents: 6,
      },
    );

    const trialParent = await createVideoParent(request, directorSession, `${label}-trial-parent`);
    const trialStudent = await apiJson<any>(
      request,
      directorSession,
      'POST',
      '/students',
      {
        studentCode: `B4TR${digits.slice(-6)}`,
        fullName: `HS Trial Convert ${digits.slice(-4)}`,
        age: 9,
        parentName: trialParent.fullName,
        parentPhone: trialParent.phone,
        parentUserId: trialParent._id,
        faceImage: 'default-avatar.png',
        productPackage: offlineProduct._id,
        level: 'Starter',
        studentType: 'OFFLINE',
        saleId: sale._id,
        saleName: sale.fullName,
      },
    );

    const trialInvoice = await apiJson<any>(
      request,
      directorSession,
      'POST',
      '/invoices',
      {
        invoiceNumber: `B4INV${digits.slice(-6)}`,
        studentId: trialStudent._id,
        classId: offlineClass._id,
        classType: 'OFFLINE',
        saleId: sale._id,
        sessions: 2,
        paymentRound: 1,
        amount: 300_000,
        paymentDate: RUN_DATE,
        receiptImage: RECEIPT_DATA_URL,
        description: 'Invoice cho trial convert B04 P2',
      },
    );
    await apiJson<any>(
      request,
      directorSession,
      'POST',
      `/invoices/${trialInvoice._id}/approve`,
      {
        action: 'APPROVE',
        approvalImage: RECEIPT_DATA_URL,
      },
    );

    const trialReadyForConvert = await apiJson<any>(
      request,
      directorSession,
      'POST',
      '/trial-enrollments',
      {
        classId: offlineClass._id,
        productId: offlineProduct._id,
        saleId: sale._id,
        parentName: trialParent.fullName,
        parentPhone: trialParent.phone,
        parentEmail: trialParent.email,
        studentName: trialStudent.fullName,
        maxTrialSessions: 2,
        notes: 'Trial da hoan tat va san sang convert',
      },
    );
    await apiJson<any>(
      request,
      directorSession,
      'PATCH',
      `/trial-enrollments/${trialReadyForConvert._id}`,
      {
        trialSessionsUsed: 2,
        status: 'WAITING_DECISION',
        notes: 'Da hoc du 2 buoi. Cho quyet dinh.',
      },
    );

    const orderForApprovalParent = `PH Approve ${digits.slice(-4)}`;
    const orderForApproval = await apiJson<any>(
      request,
      directorSession,
      'POST',
      '/orders',
      {
        orderType: 'NEW_ENROLLMENT',
        saleId: sale._id,
        parentName: orderForApprovalParent,
        parentPhone: uniquePhone(`${label}-approve-order`),
        studentName: `HS Approve ${digits.slice(-4)}`,
        studentAge: 10,
        items: [
          {
            productId: onlineProduct._id,
            productName: onlineProduct.name,
            sessions: 10,
            invoiceSessions: 10,
            sessionDuration: 60,
            baseDuration: 60,
            pricePerSession: 400_000,
            amount: 4_000_000,
            bonusSessions: 0,
            trialSessions: 0,
            teachingMode: 'ONLINE',
            paymentRound: 1,
            subject: 'Tieng Anh',
            learningGoals: 'B04 P2 approve order',
            invoiceNumber: `B4OA${digits.slice(-6)}`,
            invoiceDescription: 'Order can duyet trong B04 P2',
          },
        ],
        totalAmount: 4_000_000,
        discountAmount: 200_000,
        discountReason: 'Video B04 P2',
        finalAmount: 3_800_000,
        paymentPlan: 'FULL',
        paymentDate: RUN_DATE,
        receiptImage: RECEIPT_DATA_URL,
      },
    );
    await apiJson<any>(request, directorSession, 'POST', `/orders/${orderForApproval._id}/submit`, {});

    const { context, page } = await createRecordedPage(browser);
    try {
      const rejectTrialStudent = `HS Trial Reject ${digits.slice(-4)}`;
      const rejectTrialParent = `PH Trial Reject ${digits.slice(-4)}`;
      const rejectTrialPhone = uniquePhone(`${label}-trial-reject`);

      await showTitleCard(
        page,
        'B04. Orders, Trials - P2',
        'Video nay cover order voi parent/student da co, validation discount va cac nhanh xu ly trial enrollment.',
        [
          'Order tu du lieu co san phai auto-fill dung va chan submit neu discount lon hon total.',
          'Director co the duyet order da submit va thay ngay badge cung du lieu phat sinh lien quan.',
          'Trial enrollment duoc tao, sua, chuyen Cho quyet dinh, tu choi va convert tren UI.',
        ],
      );

      await openVideoContextForRole(page, saleSession, '/app/orders');
      await setVideoLabel(page, 'Buoc 1: Sale tao order tu parent/student da ton tai. Ky vong form tu dien dung thong tin lien ket.');
      await maybeOpenFlowGuide(page);
      await clickLocator(page, page.getByTestId('orders-create-button'));
      await expect(page.getByTestId('order-form-modal')).toBeVisible({ timeout: 10_000 });
      await slowFill(page, page.getByTestId('order-parent-lookup'), existingParent.phone);
      await page.getByTestId('order-parent-existing').selectOption(existingParent._id);
      await slowFill(page, page.getByTestId('order-student-lookup'), existingStudent.studentCode);
      await page.getByTestId('order-student-existing').selectOption(existingStudent._id);
      await expect(page.getByTestId('order-parent-name')).toHaveValue(existingParent.fullName);
      await expect(page.getByTestId('order-parent-phone')).toHaveValue(existingParent.phone);
      await expect(page.getByTestId('order-student-name')).toHaveValue(existingStudent.fullName);
      await page.getByTestId('order-item-product-0').selectOption(onlineProduct._id);
      await page.getByTestId('order-item-class-0').selectOption('');
      await expect(page.getByTestId('order-total-amount')).toHaveValue('4000000');
      await page.waitForTimeout(800);

      await setVideoLabel(page, 'Buoc 2: Nhap discount lon hon Tong tien. Ky vong UI bao loi ro rang va khoa nut submit.');
      await slowFill(page, page.getByTestId('order-discount-amount'), '4500000');
      await expect(page.getByTestId('order-discount-error')).toContainText(/Giam gia khong duoc lon hon Tong tien don hang/i, { timeout: 10_000 });
      await expect(page.getByTestId('order-submit')).toBeDisabled();
      await page.waitForTimeout(1200);

      await setVideoLabel(page, 'Buoc 3: Dua discount ve muc hop le roi luu don nhap. Ky vong finalAmount cap nhat va dong order moi xuat hien.');
      await slowFill(page, page.getByTestId('order-discount-amount'), '100000');
      await expect(page.getByTestId('order-discount-error')).toBeHidden({ timeout: 10_000 });
      await expect(page.getByTestId('order-final-amount')).toHaveValue('3900000');
      await expect(page.getByTestId('order-submit')).toBeEnabled();
      await clickLocator(page, page.getByTestId('order-submit'));
      await expect(page.getByTestId('order-form-modal')).toBeHidden({ timeout: 15_000 });
      const existingOrderRow = page.getByTestId('order-row').filter({ hasText: existingParent.fullName }).first();
      await expect(existingOrderRow).toBeVisible({ timeout: 15_000 });
      await page.waitForTimeout(900);

      await setVideoLabel(page, 'Buoc 4: Director duyet mot order da submit san. Ky vong badge doi sang Da duyet va detail hien Invoice phat sinh.');
      await openVideoContextForRole(page, directorSession, '/app/orders');
      await slowFill(page, page.locator('section.filters input').first(), orderForApprovalParent);
      const orderToApproveRow = page.getByTestId('order-row').filter({ hasText: orderForApprovalParent }).first();
      await expect(orderToApproveRow).toBeVisible({ timeout: 15_000 });
      await clickLocator(page, orderToApproveRow);
      await expect(page.getByTestId('order-detail-modal')).toBeVisible({ timeout: 10_000 });
      await clickLocator(page, page.getByTestId('order-detail-approve'));
      await expect(page.getByTestId('order-approve-modal')).toBeVisible({ timeout: 10_000 });
      await page.getByTestId('order-approve-image').setInputFiles(TEST_UPLOAD_FILE);
      await expect(page.getByTestId('order-approve-confirm')).toBeEnabled({ timeout: 15_000 });
      await clickLocator(page, page.getByTestId('order-approve-confirm'));
      await expect(page.getByTestId('order-approve-modal')).toBeHidden({ timeout: 15_000 });
      await expect(page.getByTestId('order-detail-modal').locator('.badge').first()).toContainText(/Đã duyệt|APPROVED/i, { timeout: 15_000 });
      await expect(page.getByTestId('order-detail-modal').getByText(/Invoice:\s*1/i)).toBeVisible({ timeout: 15_000 });
      await clickLocator(page, page.getByTestId('order-detail-close'));
      await expect(page.getByTestId('order-detail-modal')).toBeHidden({ timeout: 10_000 });
      await expect(orderToApproveRow.locator('.badge')).toContainText(/Đã duyệt|APPROVED/i, { timeout: 15_000 });
      await page.waitForTimeout(900);

      await setVideoLabel(page, 'Buoc 5: Sale tao trial enrollment moi, sua so buoi da hoc va chuyen sang Cho quyet dinh.');
      await openVideoContextForRole(page, saleSession, '/app/trial-enrollments');
      await clickLocator(page, page.getByRole('button', { name: /\+ Tao hoc thu/i }));
      const trialCreateModal = page.locator('.modal-backdrop .modal').first();
      await expect(trialCreateModal.getByRole('heading', { name: /Tao hoc thu moi/i })).toBeVisible({ timeout: 10_000 });
      await slowFill(page, trialCreateModal.getByLabel(/^Hoc vien/i), rejectTrialStudent);
      await slowFill(page, trialCreateModal.getByLabel(/^Phu huynh/i), rejectTrialParent);
      await slowFill(page, trialCreateModal.getByLabel(/So dien thoai PH/i), rejectTrialPhone);
      await page.waitForTimeout(300);
      await trialCreateModal.getByLabel(/Lop offline/i).selectOption(offlineClass._id);
      await trialCreateModal.getByLabel(/Goi san pham offline/i).selectOption(offlineProduct._id);
      await slowFill(page, trialCreateModal.getByLabel(/Ghi chu/i), 'Hoc thu de kiem tra flow waiting decision va reject.', 35);
      await clickLocator(page, trialCreateModal.getByRole('button', { name: /^Tao hoc thu$/i }));
      const rejectTrialRow = page.locator('.table-wrap table.data tbody tr').filter({ hasText: rejectTrialStudent }).first();
      await expect(rejectTrialRow).toBeVisible({ timeout: 15_000 });
      await expect(rejectTrialRow).toContainText(/Cho hoc thu/i, { timeout: 10_000 });
      await clickLocator(page, rejectTrialRow.getByRole('button', { name: /^Sua$/i }));
      const trialEditModal = page.locator('.modal-backdrop .modal').first();
      await expect(trialEditModal.getByRole('heading', { name: /Cap nhat hoc thu/i })).toBeVisible({ timeout: 10_000 });
      await slowFill(page, trialEditModal.getByLabel(/So buoi da hoc/i), '1');
      await slowFill(page, trialEditModal.getByLabel(/Ghi chu/i), 'Da hoc 1 buoi va can quyet dinh tiep theo.', 35);
      await clickLocator(page, trialEditModal.getByRole('button', { name: /^Cap nhat$/i }));
      await expect(rejectTrialRow).toContainText(/1\/2/i, { timeout: 10_000 });
      await clickLocator(page, rejectTrialRow.getByRole('button', { name: /Cho chot/i }));
      await expect(rejectTrialRow).toContainText(/Cho quyet dinh/i, { timeout: 15_000 });
      await page.waitForTimeout(1000);

      await setVideoLabel(page, 'Buoc 6: Director tu choi mot trial dang Cho quyet dinh, sau do convert trial da du invoice da duyet.');
      await openVideoContextForRole(page, directorSession, '/app/trial-enrollments');
      const trialKeywordInput = page.getByPlaceholder(/Tim theo ten HS, PH, SDT, ma hoc thu/i);
      await slowFill(page, trialKeywordInput, rejectTrialStudent);
      const rejectDecisionRow = page.locator('.table-wrap table.data tbody tr').filter({ hasText: rejectTrialStudent }).first();
      await expect(rejectDecisionRow).toBeVisible({ timeout: 15_000 });
      await clickLocator(page, rejectDecisionRow.getByRole('button', { name: /Tu choi/i }));
      await expect(rejectDecisionRow).toContainText(/Khong tiep tuc/i, { timeout: 15_000 });
      await page.waitForTimeout(900);

      await slowFill(page, trialKeywordInput, trialStudent.fullName);
      const convertTrialRow = page.locator('.table-wrap table.data tbody tr').filter({ hasText: trialStudent.fullName }).first();
      await expect(convertTrialRow).toBeVisible({ timeout: 15_000 });
      await expect(convertTrialRow).toContainText(/Cho quyet dinh/i, { timeout: 10_000 });
      await clickLocator(page, convertTrialRow.getByRole('button', { name: /Chuyen doi/i }));
      await expect(convertTrialRow).toContainText(/Da chot/i, { timeout: 15_000 });
      await page.waitForTimeout(1200);

      await setVideoLabel(page, 'Ket qua thuc te: Order tu du lieu co san va approve flow da on dinh; trial enrollment tao, sua, waiting decision, reject va convert deu hoat dong.');
      await page.waitForTimeout(1500);
      await setVideoLabel(page, null);
    } finally {
      await saveRecordedVideo(page, context, `UI_B04_Orders_Trials_P2_${DATE_STAMP}`);
    }
  });

  test('B05 classes sessions attendance va teaching report linked flow', async ({ browser, request }) => {
    test.slow();
    test.setTimeout(300_000);

    const directorSession = await loginAsRole(request, 'director');
    const label = `B05Video${Date.now()}`;
    const digits = `${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(-10);
    const scheduledDate = new Date().toISOString().slice(0, 10);
    const schedule = timeSlot((Date.now() % 10), 60);

    const { context, page } = await createRecordedPage(browser);
    try {
      const [product, sale, parent] = await Promise.all([
        ensureProductFixture(request, directorSession, label, 'ONLINE'),
        ensureSaleAccount(request, directorSession, label),
        createParentAccount(request, directorSession, label),
      ]);

      const teacher = await apiJson<any>(
        request,
        directorSession,
        'POST',
        '/users',
        {
          userCode: `VIDGV${digits}`,
          email: `video-teacher-${digits}@school.local`,
          password: rolePassword(),
          fullName: `Giáo viên video ${label}`,
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
          studentCode: `VIDHS${digits}`,
          fullName: `Học sinh video ${label}`,
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
          name: `Lớp video ${label}`,
          code: `VIDCLS${digits}`,
          teacherId: teacher._id,
          saleId: sale._id,
          classMode: 'ONLINE',
          productPackageId: product._id,
          studentIds: [student._id],
          subject: 'Tiếng Anh',
          learningGoals: 'Kiểm tra luồng attendance -> teaching report -> parent confirm',
          pricePerSession: 200_000,
          teacherPayPerSession: 120_000,
          teacherPayPerStudent: 0,
          baseDuration: 60,
          sessionDuration: 60,
          maxStudents: 1,
        },
      );

      const topUp = await apiJson<any>(
        request,
        directorSession,
        'POST',
        '/wallets/top-up',
        {
          userId: parent._id,
          amount: 500_000,
          paymentMethod: 'BANK_TRANSFER',
          transactionRef: `B05-${digits.slice(-6)}`,
          receiptImageUrl: '/uploads/wallets/b05-top-up.png',
          description: `Top up cho ${label}`,
        },
      );

      await apiJson<any>(
        request,
        directorSession,
        'POST',
        `/wallets/top-up/${topUp._id}/approve`,
        {
          bankMatched: true,
          bankStatementRef: `BANK-${digits.slice(-5)}`,
          accountingNotes: `Approve top up cho ${label}`,
        },
      );

      const session = await apiJson<any>(
        request,
        directorSession,
        'POST',
        '/sessions',
        {
          classId: classroom._id,
          studentId: student._id,
          teacherId: teacher._id,
          parentUserId: parent._id,
          scheduledDate,
          scheduledStartTime: schedule.startTime,
          scheduledEndTime: schedule.endTime,
          durationMinutes: 60,
          amountCharged: 200_000,
          teacherPayout: 120_000,
        },
      );

      const teacherSession = await loginAsCredentials(request, 'teacher', teacher.email, rolePassword());
      const parentSession = await loginAsCredentials(request, 'parent', parent.email, parent.password);

      await showTitleCard(
        page,
        'B05. Classes, Sessions, Attendance',
        'Video này minh họa một luồng liên kết hoàn chỉnh: giáo viên tạo link điểm danh, học sinh tự submit, rồi nộp báo cáo giảng dạy và phụ huynh xác nhận.',
        [
          'Kỳ vọng: giáo viên chỉ thấy nút tạo link, không còn quyền tick tay hay lưu điểm danh trực tiếp.',
          'Kỳ vọng: sau khi học sinh submit qua link, trạng thái session và tổng điểm danh phản ánh đúng trên UI.',
          'Kỳ vọng: báo cáo giảng dạy chuyển từ Pending sang Completed mà không cần reload thủ công.',
          'Kỳ vọng: phụ huynh xem được báo cáo rồi xác nhận buổi học ngay trên UI.',
        ],
      );

      await openVideoContextForRole(page, teacherSession, '/app/attendance');
      await setVideoLabel(page, 'Bước 1: giáo viên mở Attendance, chọn lớp và ngày học rồi tải danh sách học sinh.');
      await maybeOpenFlowGuide(page);
      await page.getByTestId('attendance-class-select').selectOption(classroom._id);
      await page.getByTestId('attendance-date-input').fill(scheduledDate);
      await clickLocator(page, page.getByTestId('attendance-load-button'));
      await expect(page.getByTestId(`attendance-student-card-${student._id}`)).toBeVisible({ timeout: 12_000 });
      await expect(page.getByTestId('attendance-mark-all-present')).toHaveCount(0);
      await expect(page.getByTestId('attendance-save-button')).toHaveCount(0);
      await page.waitForTimeout(900);

      await setVideoLabel(page, 'Bước 2: giáo viên tạo link điểm danh. Học sinh sẽ tự submit selfie qua link này, sau đó tải lại danh sách để kiểm tra trạng thái.');
      const { token } = await generateAttendanceLinkFromUi(page, student._id);
      await submitAttendanceByToken(request, token);
      await expect
        .poll(async () => (await getSessionById(request, directorSession, session._id))?.status)
        .toBe('TEACHER_COMPLETED');
      await clickLocator(page, page.getByTestId('attendance-load-button'));
      await expect(page.locator('.attendance-summary .stat.present')).toContainText('Co mat: 1', { timeout: 10_000 });
      await page.waitForTimeout(1200);

      await setVideoLabel(page, 'Bước 3: sang màn Teaching Report, nhập đầy đủ báo cáo buổi học và submit.');
      await page.goto(new URL('/app/teaching-report', APP_BASE_URL).toString());
      await page.waitForLoadState('networkidle');
      await maybeOpenFlowGuide(page);
      await clickLocator(page, page.getByTestId('report-tab-pending'));
      await fillTeachingReport(page, session._id);
      await clickLocator(page, page.getByTestId('report-submit'));
      await expect(page.getByTestId(`report-pending-card-${session._id}`)).toBeHidden({ timeout: 20_000 });
      await clickLocator(page, page.getByTestId('report-tab-completed'));
      await expect(
        page.locator('.session-card.completed').filter({ hasText: student.fullName }).first(),
      ).toBeVisible({ timeout: 20_000 });
      await page.waitForTimeout(1000);

      await setVideoLabel(page, 'Bước 4: phụ huynh mở danh sách session, xem báo cáo chi tiết rồi xác nhận buổi học.');
      await openVideoContextForRole(page, parentSession, '/app/sessions');
      const parentRow = page.getByTestId(`session-row-${session._id}`);
      await expect(parentRow).toBeVisible({ timeout: 15_000 });
      await clickLocator(page, parentRow.getByTestId('sessions-view-detail'));
      await expect(page.getByTestId('sessions-detail-close')).toBeVisible({ timeout: 10_000 });
      await expect(page.locator('.report-card-clean').first()).toContainText(/Ôn ngữ pháp|Ôn ng/i, { timeout: 10_000 });
      await clickLocator(page, page.getByTestId('sessions-detail-close'));
      await clickLocator(page, parentRow.getByTestId('sessions-parent-confirm-button'));
      await slowFill(page, page.getByTestId('sessions-confirm-rating'), '5', 120);
      await slowFill(page, page.getByTestId('sessions-confirm-notes'), 'Phụ huynh đã xem báo cáo và xác nhận buổi học đạt yêu cầu.');
      await clickLocator(page, page.getByTestId('sessions-confirm-submit'));
      await expect
        .poll(async () => {
          const latest = await getSessionById(request, directorSession, session._id);
          return latest?.status === 'PARENT_CONFIRMED' || latest?.status === 'FINALIZED' ? 'ok' : (latest?.status || 'unknown');
        })
        .toBe('ok');
      await page.waitForTimeout(1400);

      await setVideoLabel(page, 'Kết quả thực tế: dữ liệu Attendance, Teaching Report và Parent Confirmation lan truyền đúng qua các màn hình.');
      await page.waitForTimeout(1300);
      await setVideoLabel(page, null);
    } finally {
      await saveRecordedVideo(page, context, `UI_B05_Classes_Sessions_Attendance_P1_${DATE_STAMP}`);
    }
  });
});
