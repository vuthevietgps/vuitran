import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { expect, test, type Browser, type BrowserContext, type Locator, type Page } from '@playwright/test';
import {
  acceptDialog,
  apiJson,
  applySessionCookies,
  approvalFile,
  createEnrollmentFixture,
  findInvoicesByOrderId,
  getOrderById,
  loginAsRole,
  RECEIPT_DATA_URL,
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
const META_DIR = path.join(EVIDENCE_DIR, 'showcase-artifacts');
const FINAL_VIDEO_BASENAME = `UI_Sale_Daily_Demo_VI_${DATE_STAMP}`;
const VIEWPORT = { width: 1600, height: 900 };

type NarrationCue = {
  id: string;
  atMs: number;
  section: string;
  text: string;
};

test.use({
  trace: 'off',
  launchOptions: {
    slowMo: 210,
  },
});

async function ensureDirs(): Promise<void> {
  await mkdir(RAW_VIDEO_DIR, { recursive: true });
  await mkdir(VIDEO_DIR, { recursive: true });
  await mkdir(META_DIR, { recursive: true });
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
    '# Sale Daily Demo Narration',
    '',
    'Danh sach cue de render long tieng cho video sale.',
    '',
    '| Cue | Time | Section | Text |',
    '| --- | --- | --- | --- |',
    ...cues.map((cue) => `| ${cue.id} | ${formatCueTimestamp(cue.atMs)} | ${cue.section} | ${cue.text} |`),
    '',
  ];

  await writeFile(
    path.join(artifactDir, 'narration-script.md'),
    lines.join('\n'),
    'utf8',
  );
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
      <div class="eyebrow">Video Demo Sale</div>
      <h1>${title}</h1>
      <p>${subtitle}</p>
      <ul>${bullets.map((item) => `<li>${item}</li>`).join('')}</ul>
    </div>
  `);
  await page.waitForTimeout(3600);
}

async function loginViaUi(page: Page, email: string, password: string, roleLabel: string): Promise<void> {
  await page.goto(new URL('/login', APP_BASE_URL).toString());
  await page.waitForLoadState('networkidle');
  await setVideoLabel(page, `Đăng nhập vai ${roleLabel} để đi qua đúng công việc trong ngày của đội bán hàng.`);
  await showCallout(page, page.getByTestId('login-email'), `Nhập tài khoản ${roleLabel}`, 1200);
  await slowFill(page, page.getByTestId('login-email'), email, 48);
  await showCallout(page, page.getByTestId('login-password'), 'Nhập mật khẩu demo', 1100);
  await slowFill(page, page.getByTestId('login-password'), password, 48);
  await showCallout(page, page.getByTestId('login-submit'), 'Bắt đầu phiên thao tác', 1200);
  await clickLocator(page, page.getByTestId('login-submit'));
  await page.waitForURL(/\/app\//, { timeout: 25_000 });
  await clearCallout(page);
  await page.waitForTimeout(900);
}

async function switchSession(page: Page, session: Awaited<ReturnType<typeof loginAsRole>>, targetPath: string, label: string): Promise<void> {
  try {
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  } catch {
    // ignore storage clear failures during route transitions
  }
  await page.context().clearCookies();
  await applySessionCookies(page, session);
  await page.goto(new URL(targetPath, APP_BASE_URL).toString());
  await page.waitForLoadState('networkidle');
  await setVideoLabel(page, label);
}

function leadRow(page: Page, phone: string): Locator {
  return page.locator('table.data tbody tr').filter({ hasText: phone }).first();
}

function orderRowByStudent(page: Page, studentName: string): Locator {
  return page.locator('[data-testid="order-row"], table.data tbody tr').filter({ hasText: studentName }).first();
}

function studentRow(page: Page, studentName: string): Locator {
  return page.locator('table.data tbody tr').filter({ hasText: studentName }).first();
}

async function filterOrders(page: Page, keyword: string): Promise<void> {
  const input = page.locator('section.filters input').first();
  await slowFill(page, input, keyword, 36);
  await page.waitForTimeout(900);
}

async function searchLeads(page: Page, keyword: string): Promise<void> {
  const input = page.locator('section.filters input').first();
  await slowFill(page, input, keyword, 36);
  await page.waitForTimeout(900);
}

async function searchStudents(page: Page, keyword: string): Promise<void> {
  const input = page.locator('section.filters input').first();
  await slowFill(page, input, keyword, 36);
  await page.waitForTimeout(900);
}

async function searchInvoices(page: Page, keyword: string): Promise<void> {
  const input = page.locator('.filters-section .filter-row .filter-input').first();
  await slowFill(page, input, keyword, 36);
  await page.waitForTimeout(900);
}

async function selectByValue(page: Page, locator: Locator, value: string): Promise<void> {
  await expect(locator).toBeVisible({ timeout: 20_000 });
  const options = await locator.locator('option').evaluateAll((items) =>
    items.map((item) => ({
      value: (item as HTMLOptionElement).value,
    })),
  );
  const fallbackValue = options.find((item) => item.value && !item.value.startsWith('__'))?.value;
  const targetValue = options.some((item) => item.value === value) ? value : fallbackValue;
  if (!targetValue) {
    throw new Error('No selectable option found for dropdown.');
  }
  await locator.selectOption(targetValue);
  await page.waitForTimeout(350);
}

async function createNewCustomerOrder(page: Page, data: {
  parentName: string;
  parentPhone: string;
  studentName: string;
  productId: string;
  note: string;
  receiptFileName: string;
}): Promise<void> {
  await showCallout(page, page.getByTestId('orders-create-button'), 'Tạo một order mới cho khách hoàn toàn mới', 1400);
  await clickLocator(page, page.getByTestId('orders-create-button'));
  const modal = page.getByTestId('order-form-modal');
  await expect(modal).toBeVisible({ timeout: 15_000 });

  await showCallout(page, modal.getByTestId('order-parent-phone'), 'Phụ huynh mới chỉ cần số điện thoại mới là có thể bắt đầu lên đơn', 1500);
  await slowFill(page, modal.getByTestId('order-parent-name'), data.parentName);
  await slowFill(page, modal.getByTestId('order-parent-phone'), data.parentPhone);
  await slowFill(page, modal.getByTestId('order-student-name'), data.studentName);
  await slowFill(page, modal.getByTestId('order-student-age'), '10');

  await showCallout(page, modal.getByTestId('order-item-product-0'), 'Chọn gói học cho học sinh mới', 1300);
  await selectByValue(page, modal.getByTestId('order-item-product-0'), data.productId);
  await slowFill(page, modal.getByTestId('order-item-sessions-0'), '10');
  await slowFill(page, modal.getByTestId('order-invoice-sessions-0'), '10');
  await showCallout(page, modal.getByTestId('order-item-class-0'), 'Tạm để xếp lớp sau để Sale có thể chốt order nhanh mà không cần xếp lớp ngay', 1500);
  await modal.getByTestId('order-item-class-0').selectOption('');
  await page.waitForTimeout(350);

  await showCallout(page, modal.getByTestId('order-receipt-file'), 'Upload chứng từ ngay trong lúc Sale lên đơn', 1300);
  await modal.getByTestId('order-receipt-file').setInputFiles(approvalFile(data.receiptFileName));
  await expect(modal.locator('text=Đã có chứng từ')).toBeVisible({ timeout: 15_000 });
  await slowFill(page, modal.getByTestId('order-consultation-notes'), data.note, 24);

  await showCallout(page, modal.getByTestId('order-submit'), 'Lưu order nháp để Sale rà lại trước khi gửi duyệt', 1500);
  await clickLocator(page, modal.getByTestId('order-submit'));
  await expect(modal).toBeHidden({ timeout: 20_000 });
}

async function createExistingCustomerOrder(page: Page, data: {
  parentPhone: string;
  studentCodeOrName: string;
  productId: string;
  classId: string;
  note: string;
  receiptFileName: string;
}): Promise<void> {
  await showCallout(page, page.getByTestId('orders-create-button'), 'Tạo order thứ hai cho phụ huynh và học sinh đã có sẵn', 1500);
  await clickLocator(page, page.getByTestId('orders-create-button'));
  const modal = page.getByTestId('order-form-modal');
  await expect(modal).toBeVisible({ timeout: 15_000 });

  await showCallout(page, modal.getByTestId('order-parent-lookup'), 'Tìm lại phụ huynh cũ theo số điện thoại, không cần nhập lại toàn bộ hồ sơ', 1600);
  await slowFill(page, modal.getByTestId('order-parent-lookup'), data.parentPhone, 34);
  await page.waitForTimeout(700);
  const parentSelect = modal.getByTestId('order-parent-existing');
  const parentValue = await parentSelect.locator('option').nth(1).getAttribute('value');
  if (!parentValue) {
    throw new Error('Could not locate existing parent option for sale demo.');
  }
  await selectByValue(page, parentSelect, parentValue);

  await showCallout(page, modal.getByTestId('order-student-lookup'), 'Chọn đúng học sinh cũ để tránh tạo trùng dữ liệu', 1500);
  await slowFill(page, modal.getByTestId('order-student-lookup'), data.studentCodeOrName, 34);
  await page.waitForTimeout(700);
  const studentSelect = modal.getByTestId('order-student-existing');
  const studentValue = await studentSelect.locator('option').nth(1).getAttribute('value');
  if (!studentValue) {
    throw new Error('Could not locate existing student option for sale demo.');
  }
  await selectByValue(page, studentSelect, studentValue);

  await selectByValue(page, modal.getByTestId('order-item-product-0'), data.productId);
  await slowFill(page, modal.getByTestId('order-item-sessions-0'), '8');
  await slowFill(page, modal.getByTestId('order-invoice-sessions-0'), '8');
  await showCallout(page, modal.getByTestId('order-item-class-0'), 'Với khách cũ, Sale có thể gắn luôn vào lớp hiện có nếu phù hợp', 1500);
  await selectByValue(page, modal.getByTestId('order-item-class-0'), data.classId);

  await modal.getByTestId('order-receipt-file').setInputFiles(approvalFile(data.receiptFileName));
  await expect(modal.locator('text=Đã có chứng từ')).toBeVisible({ timeout: 15_000 });
  await slowFill(page, modal.getByTestId('order-consultation-notes'), data.note, 24);

  await showCallout(page, modal.getByTestId('order-submit'), 'Lưu nháp order cho khách cũ sau khi tái dùng đúng parent và student', 1500);
  await clickLocator(page, modal.getByTestId('order-submit'));
  await expect(modal).toBeHidden({ timeout: 20_000 });
}

async function submitOrderFromList(page: Page, row: Locator, message: string): Promise<void> {
  await showCallout(page, row.getByTestId('order-row-submit'), message, 1400);
  await acceptDialog(page, () => clickLocator(page, row.getByTestId('order-row-submit')));
  await page.waitForTimeout(1200);
}
test.describe('Sale daily demo video', () => {
  test('records a sale-focused daily workflow demo with Vietnamese captions', async ({ browser, request }) => {
    test.slow();
    test.setTimeout(900_000);

    const directorSession = await loginAsRole(request, 'director');
    const saleSession = await loginAsRole(request, 'sale');
    const labelStamp = `${Date.now()}`;
    const artifactDir = path.join(META_DIR, `sale-demo-${labelStamp}`);
    await mkdir(artifactDir, { recursive: true });

    const existingFixture = await createEnrollmentFixture(request, {
      label: `sale-existing-${Math.random().toString(36).slice(2, 8)}`,
      classMode: 'ONLINE',
      initializeWallet: true,
    });

    const leadPhone = uniquePhone(`sale-lead-${labelStamp}`);
    const saleLead = await apiJson<any>(
      request,
      saleSession,
      'POST',
      '/leads',
      {
        parentName: `Phụ huynh lead ${labelStamp.slice(-4)}`,
        parentPhone: leadPhone,
        parentEmail: `sale-lead-${labelStamp}@school.local`,
        studentName: `Học viên lead ${labelStamp.slice(-4)}`,
        studentGrade: 'Lớp 5',
        source: 'FACEBOOK',
        estimatedValue: 2_400_000,
        notes: 'Khách cần tư vấn lộ trình và học phí.',
      },
    );

    const newParentName = `Phụ huynh mới ${labelStamp.slice(-4)}`;
    const newParentPhone = uniquePhone(`sale-new-${labelStamp}`);
    const newStudentName = `Học sinh mới ${labelStamp.slice(-4)}`;

    const { context, page } = await createRecordedPage(browser);
    const recordingStartedAt = Date.now();
    const narrationCues: NarrationCue[] = [];
    let savedVideoPath: string | null = null;
    let newOrderId = '';
    let newOrderCode = '';
    let createdInvoiceNumber = '';

    try {
      pushNarrationCue(
        narrationCues,
        recordingStartedAt,
        'intro',
        'Đây là video giới thiệu hệ thống quản lý trung tâm ở góc nhìn Sale. Luồng demo sẽ đi từ lead, sang order, rồi qua bước duyệt và dữ liệu phát sinh sau duyệt.',
      );
      await showTitleCard(
        page,
        'Video Sale Theo Công Việc Hằng Ngày',
        'Video này đi theo đúng mạch làm việc của Sale: xem lead, tạo order cho khách mới và khách cũ, gửi duyệt, rồi kiểm tra dữ liệu phát sinh sau duyệt.',
        [
          'Lead và follow-up trong ngày',
          'Order cho khách mới',
          'Order cho khách cũ',
          'Director duyệt order',
          'Sale kiểm tra invoice và học sinh phát sinh',
        ],
      );

      await loginViaUi(page, roleEmail('sale'), rolePassword(), 'Sale');

      await page.goto('/app/leads');
      await page.waitForLoadState('networkidle');
      pushNarrationCue(
        narrationCues,
        recordingStartedAt,
        'lead-review',
        'Sale bắt đầu từ danh sách lead để đọc lại nguồn vào, xem khách nào cần follow-up và kiểm tra lịch sử tư vấn trước khi tiếp tục chăm sóc.',
      );
      await setVideoLabel(page, 'Bước 1: Sale bắt đầu từ danh sách lead và xem nhanh khách đang cần theo dõi trong ngày.');
      await showCallout(page, page.locator('.pipeline').first(), 'Pipeline cho thấy số lead ở từng trạng thái để Sale ưu tiên đúng việc cần làm', 1700);
      await searchLeads(page, leadPhone);
      const saleLeadRow = leadRow(page, leadPhone);
      await showCallout(page, saleLeadRow, 'Đây là lead mới vào để Sale đọc lại nguồn, phụ huynh và học sinh trước khi tư vấn', 1700);
      await clickLocator(page, saleLeadRow);
      const leadDetail = page.locator('.modal-backdrop .modal.wide').first();
      await expect(leadDetail).toBeVisible({ timeout: 15_000 });
      await showCallout(page, leadDetail, 'Lead detail giữ thông tin phụ huynh, học sinh, nguồn vào và lịch sử chăm sóc', 1700);
      await clickLocator(page, leadDetail.getByRole('button', { name: 'Đóng' }));
      await expect(leadDetail).toBeHidden({ timeout: 10_000 });
      await clearCallout(page);
      await page.waitForTimeout(1200);

      pushNarrationCue(
        narrationCues,
        recordingStartedAt,
        'new-customer',
        'Tình huống thứ nhất là khách hoàn toàn mới. Sale nhập phụ huynh, học sinh, chọn gói học và tải chứng từ ngay trên form order.',
      );
      await showTitleCard(
        page,
        'Tình Huống 1: Khách Mới',
        'Sale lên order trực tiếp cho phụ huynh và học sinh hoàn toàn mới, upload chứng từ ngay trên form rồi gửi duyệt.',
        [
          'Nhập thông tin phụ huynh mới',
          'Nhập học sinh mới',
          'Chọn gói học và giáo viên dự kiến',
          'Upload chứng từ và lưu nháp',
        ],
      );

      await page.goto('/app/orders');
      await page.waitForLoadState('networkidle');
      await setVideoLabel(page, 'Bước 2: Sale tạo order cho khách hoàn toàn mới ngay trên màn Orders.');
      await createNewCustomerOrder(page, {
        parentName: newParentName,
        parentPhone: newParentPhone,
        studentName: newStudentName,
        productId: existingFixture.product._id,
        note: 'Khách mới cần học online buổi tối và đã gửi chứng từ cọc.',
        receiptFileName: `sale-order-new-${labelStamp}.png`,
      });

      await filterOrders(page, newStudentName);
      const newOrderRow = orderRowByStudent(page, newStudentName);
      await expect(newOrderRow).toBeVisible({ timeout: 20_000 });
      newOrderId = (await newOrderRow.getAttribute('data-order-id')) || '';
      newOrderCode = (await newOrderRow.getAttribute('data-order-code')) || '';
      await showCallout(page, newOrderRow, 'Order nháp đã xuất hiện trên bảng để Sale rà lại trước khi gửi duyệt', 1700);
      await submitOrderFromList(page, newOrderRow, 'Gửi order khách mới vào luồng duyệt');
      await expect(newOrderRow).toContainText(/Chờ duyệt|SUBMITTED/i, { timeout: 20_000 });
      await showCallout(page, newOrderRow, 'Sau khi gửi, trạng thái đổi sang chờ duyệt ngay trên danh sách', 1600);
      await clearCallout(page);
      await page.waitForTimeout(1300);

      pushNarrationCue(
        narrationCues,
        recordingStartedAt,
        'existing-customer',
        'Tình huống thứ hai là khách cũ. Hệ thống cho phép tìm lại parent và student đã có để tránh tạo trùng hồ sơ và rút ngắn thời gian lên đơn.',
      );
      await showTitleCard(
        page,
        'Tình Huống 2: Khách Cũ',
        'Sale tiếp tục lên đơn cho phụ huynh và học sinh đã có sẵn, không cần nhập lại từ đầu và có thể chọn luôn lớp hiện hữu.',
        [
          'Tìm lại phụ huynh cũ',
          'Chọn học sinh cũ',
          'Gắn vào lớp đang học',
          'Lưu nháp rồi gửi duyệt',
        ],
      );

      await page.goto('/app/orders');
      await page.waitForLoadState('networkidle');
      await setVideoLabel(page, 'Bước 3: Sale tạo order cho khách cũ bằng cách tái dùng parent và student đã có trong hệ thống.');
      await createExistingCustomerOrder(page, {
        parentPhone: existingFixture.parent.phone,
        studentCodeOrName: existingFixture.student.studentCode || existingFixture.student.fullName,
        productId: existingFixture.product._id,
        classId: existingFixture.classroom._id,
        note: 'Khách cũ đăng ký thêm gói tiếp theo và giữ nguyên lớp đang học.',
        receiptFileName: `sale-order-existing-${labelStamp}.png`,
      });

      await filterOrders(page, existingFixture.student.fullName);
      const existingOrderRow = orderRowByStudent(page, existingFixture.student.fullName);
      await expect(existingOrderRow).toBeVisible({ timeout: 20_000 });
      await showCallout(page, existingOrderRow, 'Order khách cũ dùng lại đúng hồ sơ cũ, giảm rủi ro trùng dữ liệu', 1700);
      await submitOrderFromList(page, existingOrderRow, 'Gửi order khách cũ sang bước chờ duyệt');
      await expect(existingOrderRow).toContainText(/Chờ duyệt|SUBMITTED/i, { timeout: 20_000 });
      await clearCallout(page);
      await page.waitForTimeout(1300);

      pushNarrationCue(
        narrationCues,
        recordingStartedAt,
        'approval-handoff',
        'Khi Sale gửi duyệt, order được bàn giao cho Director hoặc OPS. Việc đối chiếu chứng từ và xác nhận duyệt được thực hiện ngay trên hệ thống.',
      );
      await showTitleCard(
        page,
        'Bước Duyệt',
        'Khi Sale gửi xong, order chuyển qua người có thẩm quyền để duyệt. Quy trình này nằm trong hệ thống thay vì xử lý ngoài chat hoặc file rời.',
        [
          'Đổi vai từ Sale sang Director',
          'Mở lại order vừa gửi',
          'Upload hóa đơn đối ứng',
          'Xác nhận duyệt',
        ],
      );

      await switchSession(
        page,
        directorSession,
        '/app/orders',
        'Bước 4: Director nhận order từ Sale, đối chiếu chứng từ và duyệt ngay trên UI.',
      );
      await filterOrders(page, newStudentName);
      const directorOrderRow = orderRowByStudent(page, newStudentName);
      await expect(directorOrderRow).toBeVisible({ timeout: 20_000 });
      await showCallout(page, directorOrderRow.getByTestId('order-row-approve'), 'Director mở modal duyệt cho order khách mới', 1500);
      await clickLocator(page, directorOrderRow.getByTestId('order-row-approve'));

      const orderApproveModal = page.getByTestId('order-approve-modal');
      await expect(orderApproveModal).toBeVisible({ timeout: 15_000 });
      await showCallout(page, orderApproveModal.getByTestId('order-approve-image'), 'Upload hóa đơn đối ứng trước khi xác nhận duyệt', 1500);
      await orderApproveModal.getByTestId('order-approve-image').setInputFiles(
        approvalFile(`sale-order-approve-${labelStamp}.png`),
      );
      await expect(orderApproveModal.getByTestId('order-approve-confirm')).toBeEnabled({ timeout: 15_000 });
      await showCallout(page, orderApproveModal.getByTestId('order-approve-confirm'), 'Xác nhận duyệt để hệ thống sinh side effect xuống invoices và students', 1600);
      await acceptDialog(page, () => clickLocator(page, orderApproveModal.getByTestId('order-approve-confirm')));
      await expect(orderApproveModal).toBeHidden({ timeout: 25_000 });
      await expect(directorOrderRow).toContainText(/Đã duyệt|Hoàn tất|APPROVED|COMPLETED/i, { timeout: 25_000 });
      await showCallout(page, directorOrderRow, 'Order đã đổi trạng thái sau khi duyệt', 1700);
      await clearCallout(page);
      await page.waitForTimeout(1200);

      if (!newOrderId) {
        newOrderId = (await directorOrderRow.getAttribute('data-order-id')) || '';
      }
      for (let attempt = 0; attempt < 12 && !createdInvoiceNumber; attempt += 1) {
        const linkedInvoices = newOrderId
          ? await findInvoicesByOrderId(request, directorSession, newOrderId)
          : [];
        createdInvoiceNumber = linkedInvoices[0]?.invoiceNumber || '';
        if (createdInvoiceNumber) break;
        await page.waitForTimeout(1000);
      }
      if (!createdInvoiceNumber && newOrderId) {
        const refreshedOrder = await getOrderById(request, directorSession, newOrderId);
        createdInvoiceNumber = refreshedOrder?.processedResults?.invoiceNumbers?.[0] || '';
      }
      pushNarrationCue(
        narrationCues,
        recordingStartedAt,
        'invoice-check',
        'Sau khi được duyệt, Sale quay lại màn hóa đơn để xác nhận invoice đã phát sinh đúng từ order vừa xử lý.',
      );
      await showTitleCard(
        page,
        'Quay Lại Góc Nhìn Sale',
        'Sau khi Director duyệt, Sale có thể quay lại các module liên quan để kiểm tra hóa đơn và học sinh phát sinh từ order vừa xử lý.',
        [
          'Mở danh sách hóa đơn',
          'Tìm invoice vừa phát sinh',
          'Mở danh sách học sinh',
          'Kiểm tra học sinh mới đã được tạo đúng',
        ],
      );

      await switchSession(
        page,
        saleSession,
        '/app/invoices',
        'Bước 5: Sale kiểm tra hóa đơn phát sinh từ order vừa được duyệt.',
      );
      await searchInvoices(page, createdInvoiceNumber || newStudentName);
      const invoiceRow = page
        .locator('[data-testid="invoice-row"], table.data tbody tr')
        .filter({ hasText: createdInvoiceNumber || newStudentName })
        .first();
      await expect(invoiceRow).toBeVisible({ timeout: 25_000 });
      await showCallout(page, invoiceRow, 'Sale nhìn thấy hóa đơn phát sinh ngay sau khi order được duyệt', 1800);
      await page.waitForTimeout(1100);

      await page.goto('/app/students');
      await page.waitForLoadState('networkidle');
      pushNarrationCue(
        narrationCues,
        recordingStartedAt,
        'student-check',
        'Bước cuối là kiểm tra danh sách học sinh để chắc chắn hồ sơ mới đã được tạo đúng và sẵn sàng bàn giao cho vận hành.',
      );
      await setVideoLabel(page, 'Bước 6: Sale kiểm tra danh sách học sinh để xác nhận hồ sơ mới đã được provision đúng.');
      await searchStudents(page, newStudentName);
      const newStudentRow = studentRow(page, newStudentName);
      await expect(newStudentRow).toBeVisible({ timeout: 25_000 });
      await showCallout(page, newStudentRow, 'Học sinh mới đã xuất hiện ở module Students sau khi order được duyệt', 1800);
      await clearCallout(page);
      await page.waitForTimeout(1500);

      pushNarrationCue(
        narrationCues,
        recordingStartedAt,
        'outro',
        'Đó là luồng Sale cốt lõi của hệ thống, nơi lead, order, phê duyệt, hóa đơn và học sinh được nối liền trên cùng một chuỗi dữ liệu.',
      );
      await showTitleCard(
        page,
        'Kết Thúc Video Sale',
        'Một vòng làm việc của Sale đã được nối liền từ lead đến order, rồi sang duyệt và các dữ liệu phát sinh sau duyệt. Đây là phần cốt lõi đủ dùng để showcase với nhà đầu tư hoặc đối tác vận hành.',
        [
          'Lead -> Order khách mới',
          'Order khách cũ bằng dữ liệu đã có',
          'Director duyệt',
          'Invoice và Student phát sinh đúng flow',
        ],
      );
      await setVideoLabel(page, 'Video đã hoàn tất. Flow được chọn theo tiêu chí vận hành thực tế và ổn định cho showcase.');
      await page.waitForTimeout(2600);

      await writeFile(
        path.join(artifactDir, 'README.txt'),
        [
          'Sale daily demo video - tiếng Việt có dấu',
          `leadId=${saleLead._id}`,
          `newOrderId=${newOrderId}`,
          `newOrderCode=${newOrderCode}`,
          `invoiceNumber=${createdInvoiceNumber}`,
          `existingStudentId=${existingFixture.student._id}`,
        ].join('\n'),
        'utf8',
      );
      await writeNarrationArtifacts(artifactDir, narrationCues);
    } finally {
      savedVideoPath = await saveRecordedVideo(page, context, FINAL_VIDEO_BASENAME);
      if (savedVideoPath) {
        console.log(`FINAL_VIDEO_PATH=${savedVideoPath}`);
      }
    }

    expect(savedVideoPath).toBeTruthy();
    expect(newOrderId).toBeTruthy();
  });
});

