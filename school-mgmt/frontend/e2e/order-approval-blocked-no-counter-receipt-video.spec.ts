import { mkdir, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { expect, test, type Browser, type BrowserContext, type Locator, type Page } from '@playwright/test';
import {
  applySessionCookies,
  createSubmittedOrder,
  loginAsRole,
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
const VIDEO_DIR =
  process.env['UI_EVIDENCE_VIDEO_DIR'] ||
  path.join(ROOT_DIR, 'frontend-ui-evidence', RUN_DATE, 'videos');
const RAW_VIDEO_DIR = path.join(VIDEO_DIR, 'raw');
const VIEWPORT = { width: 1600, height: 900 };

test.use({
  trace: 'off',
  launchOptions: {
    slowMo: 140,
  },
});

async function ensureVideoDirs(): Promise<void> {
  await mkdir(RAW_VIDEO_DIR, { recursive: true });
  await mkdir(VIDEO_DIR, { recursive: true });
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
        cursor.style.width = '22px';
        cursor.style.height = '22px';
        cursor.style.borderRadius = '999px';
        cursor.style.border = '3px solid rgba(14, 165, 233, 0.9)';
        cursor.style.background = 'rgba(255,255,255,0.72)';
        cursor.style.pointerEvents = 'none';
        cursor.style.zIndex = '2147483647';
        cursor.style.transform = 'translate(-999px, -999px)';
        cursor.style.transition = 'transform 60ms linear';
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
        cursor!.style.transform = `translate(${Math.round(event.clientX - 11)}px, ${Math.round(event.clientY - 11)}px)`;
      }, { passive: true });

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
  await installOverlay(page);
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

async function clickLocator(page: Page, locator: Locator): Promise<void> {
  await expect(locator).toBeVisible({ timeout: 20_000 });
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if (!box) {
    throw new Error('Could not calculate locator position for click.');
  }
  await page.mouse.move(box.x + (box.width / 2), box.y + (box.height / 2), { steps: 16 });
  await page.waitForTimeout(100);
  await page.mouse.down();
  await page.waitForTimeout(60);
  await page.mouse.up();
  await page.waitForTimeout(160);
}

async function slowFill(page: Page, locator: Locator, value: string, delay = 45): Promise<void> {
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

async function openVideoContextForRole(
  page: Page,
  request: Parameters<typeof loginAsRole>[0],
  role: 'director',
  targetPath: string,
): Promise<void> {
  await page.goto(new URL('/login', APP_BASE_URL).toString());
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.context().clearCookies();

  const session = await loginAsRole(request, role);
  await applySessionCookies(page.context(), session);
  await page.goto(new URL(targetPath, APP_BASE_URL).toString());
  await page.waitForLoadState('networkidle');

  if (new URL(page.url()).pathname === '/login') {
    await loginViaUi(page, roleEmail(role), rolePassword());
    if (new URL(page.url(), APP_BASE_URL).pathname !== targetPath) {
      await page.goto(new URL(targetPath, APP_BASE_URL).toString());
      await page.waitForLoadState('networkidle');
    }
  }
}

test('record approval blocked when counter receipt is missing', async ({ browser, request }) => {
  test.slow();
  test.setTimeout(240_000);

  const label = `BLOCKED-${Date.now()}`;
  const seededOrder = await createSubmittedOrder(request, {
    label,
    totalAmount: 1_800_000,
    finalAmount: 1_800_000,
    sessions: 9,
    invoiceSessions: 9,
    sessionDuration: 90,
    baseDuration: 90,
    pricePerSession: 200_000,
    teachingMode: 'ONLINE',
    teacherPayPerSession: 120_000,
    receiptImage: RECEIPT_DATA_URL,
  });

  const parentName = seededOrder.parentName as string;

  const { context, page } = await createRecordedPage(browser);
  try {
    await page.setContent(`
      <style>
        body {
          margin: 0;
          min-height: 100vh;
          display: grid;
          place-items: center;
          background: linear-gradient(135deg, #020617 0%, #0f172a 45%, #1e293b 100%);
          color: #e2e8f0;
          font-family: "Segoe UI", system-ui, sans-serif;
        }
        .card {
          width: min(940px, calc(100vw - 80px));
          padding: 40px 44px;
          border-radius: 28px;
          background: rgba(15, 23, 42, 0.8);
          border: 1px solid rgba(148, 163, 184, 0.25);
          box-shadow: 0 28px 80px rgba(2, 6, 23, 0.46);
        }
        h1 { margin: 0 0 10px; font-size: 38px; }
        p { margin: 0 0 18px; font-size: 20px; color: #cbd5e1; line-height: 1.55; }
        ul { margin: 0; padding-left: 22px; font-size: 18px; display: grid; gap: 10px; }
        li::marker { color: #38bdf8; }
      </style>
      <div class="card">
        <h1>Order Approval Must Be Blocked</h1>
        <p>Demo ngan nay chi quay tinh huong bam duyet order ma khong upload hoa don doi ung.</p>
        <ul>
          <li>Order da co hoa don sale upload san.</li>
          <li>Director mo modal duyet va co tinh bo qua hoa don doi ung.</li>
          <li>He thong phai chan va hien loi "Phai tai hoa don doi ung truoc khi duyet don".</li>
        </ul>
      </div>
    `);
    await page.waitForTimeout(1500);

    await setVideoLabel(page, 'Buoc 1: Dang nhap role Director va mo danh sach Orders.');
    await openVideoContextForRole(page, request, 'director', '/app/orders');
    await expect(page.locator('aside.sidebar')).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(1000);

    await setVideoLabel(page, 'Buoc 2: Loc order SUBMITTED da co hoa don sale upload, mo chi tiet de bat dau duyet.');
    await slowFill(page, page.locator('section.filters input').first(), parentName);
    const orderRow = page.getByTestId('order-row').filter({ hasText: parentName }).first();
    await expect(orderRow).toBeVisible({ timeout: 20_000 });
    await clickLocator(page, orderRow);
    await expect(page.getByTestId('order-detail-modal')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('order-detail-modal').locator('.badge').first()).toContainText(/Cho duyet|SUBMITTED|Chờ duyệt/i);
    await page.waitForTimeout(1000);

    await setVideoLabel(page, 'Buoc 3: Bam Duyet, nhung KHONG upload hoa don doi ung. Sau do bam xac nhan de kiem tra he thong chan.');
    await clickLocator(page, page.getByTestId('order-detail-approve'));
    await expect(page.getByTestId('order-approve-modal')).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(1200);
    await clickLocator(page, page.getByTestId('order-approve-confirm'));

    const errorText = page.getByTestId('order-approve-modal').locator('.error').first();
    await expect(errorText).toBeVisible({ timeout: 20_000 });
    await expect(errorText).toContainText('Phai tai hoa don doi ung truoc khi duyet don', { timeout: 20_000 });
    await expect(page.getByTestId('order-approve-modal')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('order-detail-modal').locator('.badge').first()).toContainText(/Cho duyet|SUBMITTED|Chờ duyệt/i);
    await page.waitForTimeout(2200);

    await setVideoLabel(page, 'Ket qua: khong co hoa don doi ung thi order KHONG duyet duoc. Modal van mo va he thong hien dung thong bao loi.');
    await page.waitForTimeout(1800);
    await setVideoLabel(page, null);
  } finally {
    await saveRecordedVideo(page, context, `UI_Order_Approval_Blocked_No_Counter_Receipt_${DATE_STAMP}`);
  }
});
