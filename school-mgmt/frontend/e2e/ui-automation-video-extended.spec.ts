import { mkdir, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import {
  expect,
  test,
  type APIRequestContext,
  type Browser,
  type BrowserContext,
  type Locator,
  type Page,
} from '@playwright/test';
import {
  apiJson,
  createParentAccount,
  ensureProductFixture,
  ensureSaleAccount,
  generateAttendanceLinkFromUi,
  roleEmail,
  rolePassword,
  timeSlot,
} from './support';

type BuiltInRole =
  | 'director'
  | 'accounting'
  | 'ops'
  | 'teacher'
  | 'sale'
  | 'parent'
  | 'shareholder';

type VideoSession = {
  role: string;
  email: string;
  password: string;
  accessToken: string;
  xsrfToken: string;
  cookieHeader: string;
  user: any;
};

const APP_BASE_URL =
  process.env['PLAYWRIGHT_BASE_URL'] ||
  process.env['E2E_BASE_URL'] ||
  'http://localhost:4200';

const API_BASE_URL =
  process.env['PLAYWRIGHT_API_BASE_URL'] ||
  process.env['E2E_API_BASE_URL'] ||
  'http://localhost:3000';

const RUN_DATE = process.env['UI_EVIDENCE_DATE'] || new Date().toISOString().slice(0, 10);
const DATE_STAMP = RUN_DATE.replace(/-/g, '');
const ROOT_DIR = path.resolve(process.cwd(), '../..');
const VIDEO_DIR =
  process.env['UI_EVIDENCE_VIDEO_DIR'] ||
  path.join(ROOT_DIR, 'frontend-ui-evidence', RUN_DATE, 'videos');
const RAW_VIDEO_DIR = path.join(VIDEO_DIR, 'raw');
const VIEWPORT = { width: 1600, height: 900 };
const ONE_BY_ONE_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wn8s4kAAAAASUVORK5CYII=';

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
        label.style.maxWidth = '680px';
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

async function slowFill(page: Page, locator: Locator, value: string, delay = 60): Promise<void> {
  await clickLocator(page, locator);
  await locator.fill('');
  if (value) {
    await locator.pressSequentially(value, { delay });
  }
  await page.waitForTimeout(120);
}

function parseCookieValue(setCookieValue: string): { name: string; value: string } | null {
  const firstPart = String(setCookieValue || '').split(';')[0];
  const separatorIndex = firstPart.indexOf('=');
  if (separatorIndex <= 0) {
    return null;
  }
  return {
    name: firstPart.slice(0, separatorIndex).trim(),
    value: firstPart.slice(separatorIndex + 1).trim(),
  };
}

function getSetCookieValues(response: {
  headers?: () => Record<string, string>;
  headersArray?: () => Array<{ name: string; value: string }>;
}): string[] {
  if (typeof response.headersArray === 'function') {
    return response
      .headersArray()
      .filter((header) => header.name.toLowerCase() === 'set-cookie')
      .map((header) => header.value);
  }

  const headers = typeof response.headers === 'function' ? response.headers() : {};
  const value = Object.entries(headers).find(([key]) => key.toLowerCase() === 'set-cookie')?.[1];
  return value ? [value] : [];
}

function buildCookieHeader(cookies: Array<{ name: string; value: string }>): string {
  return cookies
    .filter((cookie) => cookie.name && cookie.value)
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join('; ');
}

async function loginWithCredentials(
  request: APIRequestContext,
  role: string,
  email: string,
  password: string,
): Promise<VideoSession> {
  const loginResponse = await request.post(`${API_BASE_URL}/auth/login`, {
    data: { email, password },
  });
  expect([200, 201]).toContain(loginResponse.status());

  const loginCookies = getSetCookieValues(loginResponse)
    .map(parseCookieValue)
    .filter((item): item is { name: string; value: string } => !!item);

  const accessToken = loginCookies.find((cookie) => cookie.name === 'access_token')?.value;
  expect(accessToken, `Missing access token for ${email}`).toBeTruthy();

  let xsrfToken = loginCookies.find((cookie) => cookie.name === 'XSRF-TOKEN')?.value || '';
  if (!xsrfToken) {
    const meBootstrap = await request.get(`${API_BASE_URL}/users/me`, {
      headers: {
        Cookie: `access_token=${accessToken}`,
      },
    });
    const meCookies = getSetCookieValues(meBootstrap)
      .map(parseCookieValue)
      .filter((item): item is { name: string; value: string } => !!item);
    xsrfToken = meCookies.find((cookie) => cookie.name === 'XSRF-TOKEN')?.value || '';
  }
  expect(xsrfToken, `Missing XSRF token for ${email}`).toBeTruthy();

  const cookieHeader = buildCookieHeader([
    { name: 'access_token', value: accessToken as string },
    { name: 'XSRF-TOKEN', value: xsrfToken },
  ]);

  const meResponse = await request.get(`${API_BASE_URL}/users/me`, {
    headers: {
      Cookie: cookieHeader,
      'X-XSRF-TOKEN': xsrfToken,
    },
  });
  expect([200, 201]).toContain(meResponse.status());
  const mePayload = await meResponse.json().catch(() => null);

  return {
    role,
    email,
    password,
    accessToken: accessToken as string,
    xsrfToken,
    cookieHeader,
    user: mePayload?.user ?? mePayload ?? null,
  };
}

async function loginBuiltInRole(request: APIRequestContext, role: BuiltInRole): Promise<VideoSession> {
  return loginWithCredentials(request, role.toUpperCase(), roleEmail(role), rolePassword());
}

async function applyVideoSessionCookies(target: BrowserContext | Page, session: VideoSession): Promise<void> {
  const context = 'addCookies' in target ? target : target.context();
  const urls = Array.from(new Set([
    new URL(APP_BASE_URL).origin,
    new URL(API_BASE_URL).origin,
    'http://localhost:4200',
    'http://localhost:3000',
    'http://127.0.0.1:4200',
    'http://127.0.0.1:3000',
  ]));

  await context.addCookies(
    urls.flatMap((url) => ([
      {
        name: 'access_token',
        value: session.accessToken,
        url,
      },
      {
        name: 'XSRF-TOKEN',
        value: session.xsrfToken,
        url,
      },
    ])),
  );
}

async function loginViaUi(page: Page, session: VideoSession, targetPath: string): Promise<void> {
  await page.goto(new URL('/login', APP_BASE_URL).toString());
  await page.waitForLoadState('networkidle');
  await slowFill(page, page.getByTestId('login-email'), session.email);
  await slowFill(page, page.getByTestId('login-password'), session.password);
  await clickLocator(page, page.getByTestId('login-submit'));
  await page.waitForURL(/\/app\//, { timeout: 20_000 });
  if (new URL(page.url(), APP_BASE_URL).pathname !== targetPath) {
    await page.goto(new URL(targetPath, APP_BASE_URL).toString());
    await page.waitForLoadState('networkidle');
  }
}

async function openVideoContextForSession(page: Page, session: VideoSession, targetPath: string): Promise<void> {
  await page.context().clearCookies();
  await page.goto('about:blank');
  await applyVideoSessionCookies(page, session);
  await page.goto(new URL(targetPath, APP_BASE_URL).toString());
  await page.waitForLoadState('networkidle');

  if (new URL(page.url(), APP_BASE_URL).pathname === '/login') {
    await loginViaUi(page, session, targetPath);
  }
}

async function createAdsManagerAccount(request: APIRequestContext, directorSession: VideoSession): Promise<{
  email: string;
  password: string;
  fullName: string;
}> {
  return createRoleAccount(request, directorSession, 'ADSMANAGER', 'ADS', 'Video Ads Manager');
}

async function createRoleAccount(
  request: APIRequestContext,
  directorSession: VideoSession,
  role: 'ACCOUNTING' | 'ADSMANAGER' | 'SHAREHOLDER',
  codePrefix: string,
  fullNamePrefix: string,
): Promise<{
  email: string;
  password: string;
  fullName: string;
}> {
  const digits = `${Date.now()}${Math.floor(Math.random() * 10000)}`.slice(-8);
  const password = rolePassword();

  const user = await apiJson<any>(
    request,
    directorSession as any,
    'POST',
    '/users',
    {
      userCode: `${codePrefix}${digits}`,
      email: `video-${role.toLowerCase()}-${digits}@school.local`,
      password,
      fullName: `${fullNamePrefix} ${digits.slice(-4)}`,
      role,
      ownershipPercentage: role === 'SHAREHOLDER' ? 12.5 : undefined,
      phone: `09${digits}`,
    },
  );

  return {
    email: user.email,
    password,
    fullName: user.fullName,
  };
}

async function installDeniedCameraMock(page: Page): Promise<void> {
  await page.evaluate(() => {
    const mediaDevices = navigator.mediaDevices || ({} as MediaDevices);
    mediaDevices.getUserMedia = async () => {
      throw new Error('Permission denied by recorder');
    };
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: mediaDevices,
    });
  });
}

async function installSuccessfulCameraMock(page: Page): Promise<void> {
  await page.evaluate((pngDataUrl) => {
    const mediaDevices = navigator.mediaDevices || ({} as MediaDevices);
    mediaDevices.getUserMedia = async () => new MediaStream();
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: mediaDevices,
    });

    const fakeContext = {
      drawImage() {
        return undefined;
      },
    } as unknown as CanvasRenderingContext2D;

    HTMLCanvasElement.prototype.getContext = (() => fakeContext) as unknown as typeof HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.toDataURL = (() => pngDataUrl) as typeof HTMLCanvasElement.prototype.toDataURL;
  }, ONE_BY_ONE_PNG);
}

async function setMockVideoSize(page: Page): Promise<void> {
  await page.evaluate(() => {
    const video = document.querySelector('video');
    if (!video) {
      return;
    }

    Object.defineProperty(video, 'videoWidth', {
      configurable: true,
      value: 1280,
    });
    Object.defineProperty(video, 'videoHeight', {
      configurable: true,
      value: 720,
    });
  });
}

test.describe('Frontend UI automation video extension batches', () => {
  test('B02 P2 accounting ads shareholder and sidebar persistence', async ({ browser, request }) => {
    test.slow();
    test.setTimeout(240_000);

    const directorSession = await loginBuiltInRole(request, 'director');
    const accountingAccount = await createRoleAccount(
      request,
      directorSession,
      'ACCOUNTING',
      'KT',
      'Video Accounting',
    );
    const shareholderAccount = await createRoleAccount(
      request,
      directorSession,
      'SHAREHOLDER',
      'SH',
      'Video Shareholder',
    );
    const adsManagerAccount = await createAdsManagerAccount(request, directorSession);
    const accountingSession = await loginWithCredentials(
      request,
      'ACCOUNTING',
      accountingAccount.email,
      accountingAccount.password,
    );
    const shareholderSession = await loginWithCredentials(
      request,
      'SHAREHOLDER',
      shareholderAccount.email,
      shareholderAccount.password,
    );
    const adsManagerSession = await loginWithCredentials(
      request,
      'ADSMANAGER',
      adsManagerAccount.email,
      adsManagerAccount.password,
    );

    const { context, page } = await createRecordedPage(browser);
    try {
      await showTitleCard(
        page,
        'B02. Dashboard, Handbook, Redirect, Sidebar - P2',
        'Video nay tiep tuc batch dashboard de chot cac role con thieu: SHAREHOLDER, ACCOUNTING, ADSMANAGER va state sidebar sau reload.',
        [
          'SHAREHOLDER vao /app phai tu dong ve investor-dashboard.',
          'ACCOUNTING va ADSMANAGER phai mo dung dashboard va handbook theo role.',
          'Sidebar collapse state phai duoc luu lai sau khi reload trang.',
        ],
      );

      await setVideoLabel(page, 'Buoc 1: dang nhap SHAREHOLDER va vao /app. Ky vong app tu dieu huong sang investor-dashboard.');
      await openVideoContextForSession(page, shareholderSession, '/app');
      await page.waitForURL(/\/app\/investor-dashboard$/, { timeout: 20_000 });
      await expect(page.getByText(/Investor dashboard/i).first()).toBeVisible({ timeout: 15_000 });
      await expect(page.locator('.role-chip')).toContainText(/SHAREHOLDER/i, { timeout: 10_000 });
      const monthSelect = page.locator('.month-filter select');
      await monthSelect.selectOption({ index: 2 });
      await page.waitForTimeout(900);
      await monthSelect.selectOption({ index: 0 });
      await page.waitForTimeout(900);

      await setVideoLabel(page, 'Buoc 2: chuyen sang ACCOUNTING dashboard. Ky vong banner Cam nang ke toan va hero dashboard tai dung.');
      await openVideoContextForSession(page, accountingSession, '/app/dashboard');
      await expect(page.getByText(/Dashboard K/i)).toBeVisible({ timeout: 20_000 });
      await expect(page.getByText(/Cam nang ke toan/i)).toBeVisible({ timeout: 12_000 });
      await expect(page.getByRole('link', { name: /Mo cam nang/i })).toBeVisible({ timeout: 10_000 });
      await page.waitForTimeout(900);

      await setVideoLabel(page, 'Buoc 3: ACCOUNTING mo internal handbook. Ky vong handbook mang data-role ACCOUNTING va co noi dung role-specific.');
      await clickLocator(page, page.getByRole('link', { name: /Mo cam nang/i }));
      await page.waitForURL(/\/app\/internal-handbook$/, { timeout: 20_000 });
      await expect(page.locator('.handbook-page[data-role="ACCOUNTING"]')).toBeVisible({ timeout: 15_000 });
      await expect(page.locator('.handbook-page .metric-card').nth(1)).toBeVisible({ timeout: 10_000 });
      await page.waitForTimeout(900);

      await setVideoLabel(page, 'Buoc 4: thu gon sidebar va reload trang. Ky vong trang thai collapsed duoc giu nguyen sau reload.');
      const sidebar = page.locator('aside.sidebar');
      const sidebarToggle = page.locator('aside.sidebar .toggle').first();
      await clickLocator(page, sidebarToggle);
      await expect(sidebar).toHaveClass(/collapsed/, { timeout: 10_000 });
      await page.reload({ waitUntil: 'networkidle' });
      await expect(sidebar).toHaveClass(/collapsed/, { timeout: 10_000 });
      await expect
        .poll(() => page.evaluate(() => window.localStorage.getItem('school_mgmt_sidebar_collapsed')))
        .toBe('true');
      await clickLocator(page, page.locator('aside.sidebar .toggle').first());
      await expect(sidebar).not.toHaveClass(/collapsed/, { timeout: 10_000 });
      await page.waitForTimeout(800);

      await setVideoLabel(page, 'Buoc 5: chuyen sang ADSMANAGER dashboard. Ky vong hero Ads manager workspace, banner Cam nang ads va menu role-specific hien dung.');
      await openVideoContextForSession(page, adsManagerSession, '/app/dashboard');
      await expect(page.getByText(/Ads manager workspace/i)).toBeVisible({ timeout: 20_000 });
      await expect(page.getByRole('heading', { name: /Cam nang ads/i })).toBeVisible({ timeout: 12_000 });
      await expect(page.locator('a[href="/app/ads-management"]').first()).toBeVisible({ timeout: 10_000 });
      await expect(page.locator('a[href="/app/chatbot-settings"]').first()).toBeVisible({ timeout: 10_000 });
      await expect(page.locator('a[href="/app/pending-approvals"]')).toHaveCount(0);
      await page.waitForTimeout(900);

      await setVideoLabel(page, 'Buoc 6: ADSMANAGER mo handbook rieng. Ky vong internal handbook chuyen sang data-role ADSMANAGER va giu quick links dung.');
      await clickLocator(page, page.getByRole('link', { name: /Mo cam nang/i }));
      await page.waitForURL(/\/app\/internal-handbook$/, { timeout: 20_000 });
      await expect(page.locator('.handbook-page[data-role="ADSMANAGER"]')).toBeVisible({ timeout: 15_000 });
      await expect(page.locator('.handbook-page h1')).toContainText(/ads/i, { timeout: 10_000 });
      await page.waitForTimeout(1200);

      await setVideoLabel(page, 'Ket qua thuc te: da bo sung SHAREHOLDER redirect, ACCOUNTING + ADSMANAGER dashboard/handbook va xac nhan sidebar persist sau reload.');
      await page.waitForTimeout(1200);
      await setVideoLabel(page, null);
    } finally {
      await saveRecordedVideo(page, context, `UI_B02_Dashboard_Handbook_P2_${DATE_STAMP}`);
    }
  });

  test('B05 P2 public attendance token camera success and error states', async ({ browser, request }) => {
    test.slow();
    test.setTimeout(240_000);

    const directorSession = await loginBuiltInRole(request, 'director');
    const label = `B05P2Video${Date.now()}`;
    const digits = `${Date.now()}${Math.floor(Math.random() * 10000)}`.slice(-8);
    const scheduledDate = new Date().toISOString().slice(0, 10);
    const schedule = timeSlot(7, 60);
    const product = await ensureProductFixture(request, directorSession as any, label, 'ONLINE');
    const sale = await ensureSaleAccount(request, directorSession as any, label);
    const parent = await createParentAccount(request, directorSession as any, label);
    const teacher = await apiJson<any>(
      request,
      directorSession as any,
      'POST',
      '/users',
      {
        userCode: `VIDGV${digits}`,
        email: `video-teacher-p2-${digits}@school.local`,
        password: rolePassword(),
        fullName: `Video Teacher P2 ${digits.slice(-4)}`,
        role: 'TEACHER',
        phone: `08${digits}`,
      },
    );
    const student = await apiJson<any>(
      request,
      directorSession as any,
      'POST',
      '/students',
      {
        studentCode: `VIDHS${digits}`,
        fullName: `Video Student P2 ${digits.slice(-4)}`,
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
      directorSession as any,
      'POST',
      '/classes',
      {
        name: `Video Class P2 ${digits.slice(-4)}`,
        code: `VIDCLS${digits}`,
        teacherId: teacher._id,
        saleId: sale._id,
        classMode: 'ONLINE',
        productPackageId: product._id,
        studentIds: [student._id],
        subject: 'Tieng Anh',
        learningGoals: 'Public attendance token and camera video',
        pricePerSession: 200_000,
        teacherPayPerSession: 120_000,
        teacherPayPerStudent: 0,
        baseDuration: 60,
        sessionDuration: 60,
        maxStudents: 1,
      },
    );
    await apiJson<any>(
      request,
      directorSession as any,
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
    const teacherSession = await loginWithCredentials(
      request,
      'TEACHER',
      teacher.email,
      rolePassword(),
    );

    const { context, page } = await createRecordedPage(browser);
    try {
      await showTitleCard(
        page,
        'B05. Public Attendance Token and Camera - P2',
        'Video nay tap trung vao luong student-attendance public: token hop le, token sai, camera bi tu choi va camera submit thanh cong.',
        [
          'Token hop le phai tai dung thong tin hoc sinh, lop va giao vien.',
          'Token sai phai hien thong bao loi ro rang, khong ra trang trang.',
          'UI camera phai bao loi khi bi tu choi va chi submit mot lan khi chup thanh cong.',
        ],
      );

      await setVideoLabel(page, 'Buoc 1: giao vien vao Attendance, tai lop hoc va tao link public attendance cho hoc sinh.');
      await openVideoContextForSession(page, teacherSession, '/app/attendance');
      await page.getByTestId('attendance-class-select').selectOption(classroom._id);
      await page.getByTestId('attendance-date-input').fill(scheduledDate);
      await clickLocator(page, page.getByTestId('attendance-load-button'));
      await expect(page.getByTestId(`attendance-student-card-${student._id}`)).toBeVisible({ timeout: 15_000 });
      const { token } = await generateAttendanceLinkFromUi(page, student._id);
      await page.waitForTimeout(900);

      await setVideoLabel(page, 'Buoc 2: mo token sai tren trang public. Ky vong UI hien error state ro rang.');
      await page.goto(new URL('/student-attendance/invalid-token-b05-p2', APP_BASE_URL).toString());
      await page.waitForLoadState('networkidle');
      await expect(page.locator('.error-message')).toBeVisible({ timeout: 15_000 });
      await expect(page.locator('.error-message h2')).not.toHaveText('', { timeout: 10_000 });
      await page.waitForTimeout(1000);

      await setVideoLabel(page, 'Buoc 3: mo token hop le. Ky vong trang public tai dung thong tin hoc sinh, lop va giao vien.');
      await page.goto(new URL(`/student-attendance/${token}`, APP_BASE_URL).toString());
      await page.waitForLoadState('networkidle');
      await expect(page.locator('.info-card')).toBeVisible({ timeout: 15_000 });
      await expect(page.locator('.info-card')).toContainText(student.fullName, { timeout: 10_000 });
      await expect(page.locator('.info-card')).toContainText(classroom.name, { timeout: 10_000 });
      await expect(page.locator('.info-card')).toContainText(teacher.fullName, { timeout: 10_000 });
      await page.waitForTimeout(900);

      await setVideoLabel(page, 'Buoc 4: mo phong camera bi tu choi quyen. Ky vong UI hien thong bao huong dan, khong submit im lang.');
      await installDeniedCameraMock(page);
      await clickLocator(page, page.locator('.btn-primary').first());
      await expect(page.locator('.error-message')).toBeVisible({ timeout: 15_000 });
      await expect(page.locator('.error-message')).toContainText(/camera/i, { timeout: 10_000 });
      await page.waitForTimeout(1000);

      await setVideoLabel(page, 'Buoc 5: reload token hop le va mo phong camera thanh cong. Ky vong chup anh, submit mot lan va hien thong bao thanh cong.');
      let submitCount = 0;
      page.on('request', (req) => {
        if (req.method() === 'POST' && req.url().includes('/public/attendance/submit')) {
          submitCount += 1;
        }
      });
      await page.goto(new URL(`/student-attendance/${token}`, APP_BASE_URL).toString());
      await page.waitForLoadState('networkidle');
      await installSuccessfulCameraMock(page);
      await clickLocator(page, page.locator('.btn-primary').first());
      await expect(page.locator('.btn-success')).toBeVisible({ timeout: 15_000 });
      await setMockVideoSize(page);
      await clickLocator(page, page.locator('.btn-success').first());
      await expect(page.locator('.success-message')).toBeVisible({ timeout: 20_000 });
      await expect(page.locator('.success-message h2')).not.toHaveText('', { timeout: 10_000 });
      expect(submitCount).toBe(1);
      await page.waitForTimeout(1300);

      await setVideoLabel(page, 'Ket qua thuc te: token valid/invalid, camera denied va camera success deu da duoc quay ro trong public attendance flow.');
      await page.waitForTimeout(1200);
      await setVideoLabel(page, null);
    } finally {
      await saveRecordedVideo(page, context, `UI_B05_Classes_Sessions_Attendance_P2_${DATE_STAMP}`);
    }
  });
});
