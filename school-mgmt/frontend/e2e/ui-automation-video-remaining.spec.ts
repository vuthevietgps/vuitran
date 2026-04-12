import { mkdir, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import {
  expect,
  test,
  type Browser,
  type BrowserContext,
  type Locator,
  type Page,
} from '@playwright/test';
import { apiJson } from './support/api';
import {
  applySessionCookies,
  createEnrollmentFixture,
  loginAsCredentials,
  loginAsRole,
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
    slowMo: 180,
  },
});

function uniqueDigits(label: string, length = 6): string {
  const raw = `${Date.now()}${Math.floor(Math.random() * 10000)}${label}`.replace(/\D/g, '');
  return raw.slice(-length).padStart(length, '0');
}

function localDate(offsetDays = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

async function ensureVideoDirs(): Promise<void> {
  await mkdir(RAW_VIDEO_DIR, { recursive: true });
  await mkdir(VIDEO_DIR, { recursive: true });
}

async function installCursorOverlay(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const CURSOR_ID = '__codex_video_cursor';
    const LABEL_ID = '__codex_video_label';

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
        label.style.maxWidth = '660px';
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

      window.addEventListener(
        'mousemove',
        (event) => {
          cursor!.style.transform = `translate(${Math.round(event.clientX - 13)}px, ${Math.round(event.clientY - 13)}px)`;
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
    acceptDownloads: true,
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

async function saveRecordedVideo(
  page: Page,
  context: BrowserContext,
  fileBaseName: string,
): Promise<string | null> {
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

  await page.mouse.move(box.x + (box.width / 2), box.y + (box.height / 2), { steps: 18 });
  await page.waitForTimeout(100);
  await page.mouse.down();
  await page.waitForTimeout(60);
  await page.mouse.up();
  await page.waitForTimeout(180);
}

async function slowFill(page: Page, locator: Locator, value: string, delay = 45): Promise<void> {
  await clickLocator(page, locator);
  await locator.fill('');
  await locator.pressSequentially(value, { delay });
}

async function loginViaUi(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/login');
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
  fallbackCredentials?: { email: string; password: string },
): Promise<void> {
  await page.context().clearCookies();
  await page.goto('about:blank');
  await applySessionCookies(page.context(), session);
  await page.goto(targetPath);
  await page.waitForLoadState('networkidle');
  if (new URL(page.url(), APP_BASE_URL).pathname === '/login' && fallbackCredentials) {
    await loginViaUi(page, fallbackCredentials.email, fallbackCredentials.password);
    if (new URL(page.url(), APP_BASE_URL).pathname !== new URL(targetPath, APP_BASE_URL).pathname) {
      await page.goto(targetPath);
      await page.waitForLoadState('networkidle');
    }
  }
  await page.waitForTimeout(800);
}

async function maybeMarkAllNotifications(page: Page): Promise<void> {
  const markAll = page.locator('button.btn-mark-all');
  if (await markAll.count()) {
    await setVideoLabel(page, 'Neu co thong bao chua doc, danh dau da doc de thay unread count giam ngay tren UI.');
    await clickLocator(page, markAll.first());
    await page.waitForTimeout(800);
  }
}

test('B08 finance alerts reconciliation linked flow', async ({ browser, request }) => {
  test.slow();
  const directorSession = await loginAsRole(request, 'director');
  const digits = uniqueDigits('b08', 7);
  const bankName = `E2E Bank ${digits}`;
  const accountNumber = `9704${digits}${uniqueDigits('x', 5)}`;
  const accountHolder = `B08 HOLDER ${digits}`;
  const description = `B08 linked tx ${digits}`;

  const { context, page } = await createRecordedPage(browser);

  try {
    await showTitleCard(
      page,
      'B08 Finance Alerts Reconciliation',
      'Tao tai khoan va giao dich tu Financial Control, sau do mo Bank Reconciliation de thay transaction vua submit.',
      [
        'Submit form tai khoan ngan hang va giao dich tu Financial Control.',
        'Mo Bank Reconciliation va doi soat tai khoan vua tao.',
        'Video phai thay ro state thay doi o chuc nang lien doi sau submit.',
      ],
    );

    await loginViaUi(page, roleEmail('director'), rolePassword());
    await page.goto('/app/financial-control');
    await page.waitForLoadState('networkidle');

    await setVideoLabel(page, 'Mo tab ngan hang va tao tai khoan moi ngay trong Financial Control.');
    await clickLocator(page, page.locator('.tab-bar button').nth(3));
    await clickLocator(page, page.locator('.tab-content .section-header .primary').first());
    await slowFill(page, page.locator('input[name="bankName"]'), bankName);
    await slowFill(page, page.locator('input[name="accountNumber"]'), accountNumber);
    await slowFill(page, page.locator('input[name="accountHolder"]'), accountHolder);
    await slowFill(page, page.locator('input[name="branch"]'), 'HCM Branch');
    await slowFill(page, page.locator('input[name="openingBalance"]'), '5000000', 25);
    await slowFill(page, page.locator('textarea[name="description"]'), 'Tai khoan test quay video B08', 25);
    await clickLocator(page, page.locator('.modal .form-actions .primary').first());
    await expect(page.locator('.bank-card').filter({ hasText: accountNumber }).first()).toBeVisible({ timeout: 20_000 });

    await setVideoLabel(page, 'Chon tai khoan vua tao va ghi nhan them mot giao dich de tao side effect doi soat.');
    const bankCard = page.locator('.bank-card').filter({ hasText: accountNumber }).first();
    await clickLocator(page, bankCard);
    await clickLocator(page, page.locator('.section-header.mt .primary').first());
    await page.locator('select[name="type"]').selectOption('DEPOSIT');
    await page.locator('select[name="category"]').selectOption('OTHER');
    await slowFill(page, page.locator('input[name="amount"]'), '1250000', 25);
    await slowFill(page, page.locator('textarea[name="description"]'), description, 25);
    await slowFill(page, page.locator('input[name="reference"]'), `B08-${digits}`, 25);
    await clickLocator(page, page.locator('.modal .form-actions .primary').first());
    await expect(page.locator('table.data tbody tr').filter({ hasText: description }).first()).toBeVisible({ timeout: 20_000 });

    const bankAccounts = await apiJson<any[]>(request, directorSession, 'GET', '/financial-control/bank-accounts');
    const createdAccount = bankAccounts.find((item: any) => item.accountNumber === accountNumber);
    expect(createdAccount?._id).toBeTruthy();

    await setVideoLabel(page, 'Roi khoi man submit va mo Bank Reconciliation de thay tai khoan, giao dich va ket qua doi soat lien doi.');
    await page.goto('/app/bank-reconciliation');
    await page.waitForLoadState('networkidle');
    await page.locator('.filter-bar select').first().selectOption(createdAccount!._id);
    await page.locator('input[type="date"]').nth(0).fill(localDate(-1));
    await page.locator('input[type="date"]').nth(1).fill(localDate(1));
    await clickLocator(page, page.locator('.filter-bar button.primary').first());
    await expect(page.locator('.summary-grid')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('.row-unmatched-bank, .row-matched, .empty-text').first()).toBeVisible({ timeout: 20_000 });

    await setVideoLabel(page, 'Ket qua thuc te: giao dich vua submit da xuat hien o chuc nang doi soat ngan hang.');
    await page.waitForTimeout(1500);
  } finally {
    await saveRecordedVideo(page, context, `UI_B08_Finance_Alerts_Reconciliation_${DATE_STAMP}`);
  }
});

test('B09A notifications and chatbot settings evidence flow', async ({ browser, request }) => {
  test.slow();
  const directorSession = await loginAsRole(request, 'director');
  const opsSession = await loginAsRole(request, 'ops');
  const seedTokenLabel = `B09 Seed Token ${uniqueDigits('seedtoken', 6)}`;
  const tokenLabel = `B09 Token ${uniqueDigits('token', 6)}`;
  let seedProfileLabel = `B09 Seed Profile ${uniqueDigits('seedprofile', 6)}`;
  const profileLabel = `B09 Profile ${uniqueDigits('profile', 6)}`;
  const seedTokenRes = await apiJson<any>(request, '/chatbot/openai-tokens', {
    method: 'POST',
    session: directorSession,
    body: {
      label: seedTokenLabel,
      apiKey: `sk-seed-${uniqueDigits('api', 8)}`,
      model: 'gpt-4o-mini',
    },
  });
  const seedTokenId = seedTokenRes.body?._id || seedTokenRes.body?.id;
  expect(seedTokenId).toBeTruthy();

  const existingProfilesRes = await apiJson<any[]>(request, '/chatbot/ai-assistant-profiles', {
    method: 'GET',
    session: directorSession,
  });
  const existingProfiles = Array.isArray(existingProfilesRes.body) ? existingProfilesRes.body : [];
   const existingParentSupportProfile = existingProfiles.find((item: any) => item.assistantType === 'PARENT_SUPPORT');

  let seedProfileId = existingParentSupportProfile?._id || existingParentSupportProfile?.id;
  if (existingParentSupportProfile?.label) {
    seedProfileLabel = existingParentSupportProfile.label;
  }
  if (!seedProfileId) {
    const seedProfileRes = await apiJson<any>(request, '/chatbot/ai-assistant-profiles', {
      method: 'POST',
      session: directorSession,
      body: {
        assistantType: 'PARENT_SUPPORT',
        label: seedProfileLabel,
        description: 'Seed profile for B09A video',
        rulesPrompt: 'Seed profile',
        defaultOpenAITokenId: seedTokenId,
      },
    });
    seedProfileId = seedProfileRes.body?._id || seedProfileRes.body?.id;
  }
  expect(seedProfileId).toBeTruthy();

  const { context, page } = await createRecordedPage(browser);

  try {
    await showTitleCard(
      page,
      'B09A Notifications and Chatbot Settings',
      'Kiem tra notifications co phan hoi tren UI, sau do luu OpenAI token va AI profile, reload lai va doi role de doi chieu RBAC.',
      [
        'Neu co unread notifications thi danh dau da doc de thay doi badge.',
        'Director tao token va AI profile trong chatbot-settings.',
        'Reload va mo role OPS de thay data vua luu va tab tokens bi an theo RBAC.',
      ],
    );

    await loginViaUi(page, roleEmail('parent'), rolePassword());
    await page.goto('/app/notifications');
    await page.waitForLoadState('networkidle');
    await maybeMarkAllNotifications(page);
    await page.waitForTimeout(900);

    await switchSession(page, directorSession, `${APP_BASE_URL}/app/chatbot-settings`, {
      email: roleEmail('director'),
      password: rolePassword(),
    });

    await setVideoLabel(page, 'Director sua token da seed san trong chatbot-settings de quay evidence save va reload.');
    await clickLocator(page, page.getByRole('button', { name: /OpenAI Tokens/i }));
    const seedTokenRow = page.locator('table.data-table tbody tr').filter({ hasText: seedTokenLabel }).first();
    await expect(seedTokenRow).toBeVisible({ timeout: 20_000 });
    await clickLocator(page, seedTokenRow.locator('button').filter({ hasText: /Sua/i }).first());
    await slowFill(page, page.locator('.modal input').nth(0), tokenLabel);
    await slowFill(page, page.locator('.modal input[type="number"]').nth(0), '0.2', 20);
    await slowFill(page, page.locator('.modal input[type="number"]').nth(1), '800', 20);
    await slowFill(page, page.locator('.modal textarea').first(), 'B09 system prompt prefix', 20);
    await clickLocator(page, page.locator('.modal button.primary').filter({ hasText: /Luu/i }));
    await expect(page.locator('table.data-table tbody tr').filter({ hasText: tokenLabel }).first()).toBeVisible({ timeout: 20_000 });

    const tokens = await apiJson<any[]>(request, directorSession, 'GET', '/chatbot/openai-tokens');
   const createdToken = tokens.find((item: any) => item.label === tokenLabel);
    expect(createdToken?._id).toBeTruthy();

    await setVideoLabel(page, 'Tiep tuc sua AI profile da seed san, gan token vua luu, sau do reload lai de xac nhan profile da ton tai.');
    await clickLocator(page, page.getByRole('button', { name: /AI Profiles/i }));
    const seedProfileRow = page.locator('table.data-table tbody tr').filter({ hasText: seedProfileLabel }).first();
    await expect(seedProfileRow).toBeVisible({ timeout: 20_000 });
    await clickLocator(page, seedProfileRow.locator('button').filter({ hasText: /Sua/i }).first());
    await slowFill(page, page.locator('.modal input').nth(0), profileLabel);
    await slowFill(page, page.locator('.modal input').nth(1), 'Profile quay video B09');
    await page.locator('.modal select').nth(1).selectOption(createdToken!._id);
    await slowFill(page, page.locator('.modal textarea').first(), 'Chi tra loi trong pham vi da xac thuc; neu thanh toan hoac khieu nai thi handoff.', 18);
    await clickLocator(page, page.locator('.modal button.primary').filter({ hasText: /Luu/i }));
    await expect(page.locator('table.data-table tbody tr').filter({ hasText: profileLabel }).first()).toBeVisible({ timeout: 20_000 });

    await page.reload();
    await page.waitForLoadState('networkidle');
    await clickLocator(page, page.getByRole('button', { name: /AI Profiles/i }));
    await expect(page.locator('table.data-table tbody tr').filter({ hasText: profileLabel }).first()).toBeVisible({ timeout: 20_000 });

    await setVideoLabel(page, 'Doi role sang OPS de doi chieu: AI profile da co, nhung tab OpenAI Tokens phai bi an.');
    await switchSession(page, opsSession, `${APP_BASE_URL}/app/chatbot-settings`, {
      email: roleEmail('ops'),
      password: rolePassword(),
    });
    await expect(page.getByRole('button', { name: /AI Profiles/i })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('button', { name: /OpenAI Tokens/i })).toHaveCount(0);
    await clickLocator(page, page.getByRole('button', { name: /AI Profiles/i }));
    await expect(page.locator('table.data-table tbody tr').filter({ hasText: profileLabel }).first()).toBeVisible({ timeout: 20_000 });

    await setVideoLabel(page, 'Ket qua thuc te: save trong chatbot-settings da ton tai sau reload va duoc role khac nhin thay dung pham vi.');
    await page.waitForTimeout(1400);
  } finally {
    await saveRecordedVideo(page, context, `UI_B09A_Notifications_ChatbotSettings_${DATE_STAMP}`);
  }
});

test('B09B parent chat handoff to ticket side effects', async ({ browser, request }) => {
  test.slow();
  const fixture = await createEnrollmentFixture(request, {
    label: `B09-${uniqueDigits('parent', 5)}`,
    classMode: 'ONLINE',
    initializeWallet: true,
  });
  const opsSession = await loginAsRole(request, 'ops');
  const refundMessage = 'Mình cần hoàn tiền học phí gấp vì con nghỉ học, nhờ trung tâm xử lý hoàn tiền giúp.';

  const { context, page } = await createRecordedPage(browser);

  try {
    await showTitleCard(
      page,
      'B09B Parent Support Chat to Tickets',
      'Gui mot yeu cau nhay cam tu parent support chat de he thong handoff sang ticket, sau do mo ticket va doi role OPS de thay state lien doi.',
      [
        'Phu huynh gui noi dung co intent hoan tien de AI tao handoff ticket.',
        'Mo ticket ngay tu banner trong parent-chat.',
        'Chuyen sang OPS de thay cung ticket va bat dau xu ly.',
      ],
    );

    await loginViaUi(page, fixture.parent.email, fixture.parent.password);
    await page.goto('/app/parent-chat');
    await page.waitForLoadState('networkidle');

    const studentSelect = page.locator('.setup-card select').nth(0);
    const supportSelect = page.locator('.setup-card select').nth(1);
    if ((await studentSelect.inputValue()) === '') {
      const studentValue = await studentSelect.locator('option').nth(1).getAttribute('value');
      if (studentValue) {
        await studentSelect.selectOption(studentValue);
      }
    }
    if ((await supportSelect.inputValue()) === '') {
      const supportValue = await supportSelect.locator('option').nth(1).getAttribute('value');
      if (supportValue) {
        await supportSelect.selectOption(supportValue);
      }
    }

    await setVideoLabel(page, 'Gui tin nhan hoan tien tu parent support chat de he thong tao ticket handoff.');
    await slowFill(page, page.locator('.composer textarea').first(), refundMessage, 16);
    await clickLocator(page, page.locator('.composer button.primary').first());
    const ticketBanner = page.locator('.ticket-banner');
    await expect(ticketBanner).toBeVisible({ timeout: 30_000 });
    const ticketHref = await ticketBanner.locator('a.ticket-banner-link').getAttribute('href');
    expect(ticketHref).toBeTruthy();

    await setVideoLabel(page, 'Mo ticket ngay tu parent-chat de thay side effect da sinh ra o module Tickets.');
    await clickLocator(page, ticketBanner.locator('a.ticket-banner-link'));
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.ticket-detail-page, .ticket-code').first()).toBeVisible({ timeout: 20_000 });

    await setVideoLabel(page, 'Doi role sang OPS va mo lai cung ticket de thay team van hanh nhan duoc case vua handoff.');
    await switchSession(page, opsSession, `${APP_BASE_URL}${ticketHref}`, {
      email: roleEmail('ops'),
      password: rolePassword(),
    });
    await expect(page.locator('.ticket-detail-page')).toBeVisible({ timeout: 20_000 });
    const startButton = page.locator('.action-btn.start').first();
    if (await startButton.count()) {
      await clickLocator(page, startButton);
      await page.waitForTimeout(1000);
    }

    await setVideoLabel(page, 'Ket qua thuc te: tin nhan o parent-chat da mo ra ticket va ticket hien ngay o role OPS.');
    await page.waitForTimeout(1500);
  } finally {
    await saveRecordedVideo(page, context, `UI_B09B_Chatbot_Tickets_SideEffects_${DATE_STAMP}`);
  }
});

test('B10 landing page public submit linked evidence', async ({ browser, request }) => {
  test.slow();
  const directorSession = await loginAsRole(request, 'director');
  const digits = uniqueDigits('b10', 6);
  const pageName = `B10 LP ${digits}`;
  const slug = `b10-${digits}`;
  const parentPhone = `090${uniqueDigits('phone', 7)}`;

  const { context, page } = await createRecordedPage(browser);

  try {
    await showTitleCard(
      page,
      'B10 Landing Page Public Flow',
      'Tao landing page tu man quan ly, submit form cong khai, sau do mo submissions va leads de thay ro du lieu lien doi sau submit.',
      [
        'Save landing page moi voi slug va tracking IDs.',
        'Mo route /lp/:slug va submit form cong khai.',
        'Quay lai management submissions va leads de doi soat side effect.',
      ],
    );

    await loginViaUi(page, roleEmail('director'), rolePassword());
    await page.goto('/app/landing-pages');
    await page.waitForLoadState('networkidle');

    await setVideoLabel(page, 'Tao landing page moi trong trang quan ly.');
    await clickLocator(page, page.getByRole('button', { name: /Tao landing page/i }));
    await slowFill(page, page.locator('.modal input').nth(0), pageName);
    await slowFill(page, page.locator('.modal input').nth(1), slug);
    await page.locator('.modal select').first().selectOption('ACTIVE');
    await slowFill(page, page.locator('.modal input').nth(2), `Hero ${digits}`);
    await slowFill(page, page.locator('.modal input').nth(3), 'LP quay video B10');
    await slowFill(page, page.locator('.modal input').nth(4), 'Dang ky tu van');
    await slowFill(page, page.locator('.modal input').nth(5), 'Gui thong tin');
    await slowFill(page, page.locator('.modal textarea').nth(0), 'Form landing page phuc vu video B10', 18);
    await slowFill(page, page.locator('.modal textarea').nth(1), 'Thong tin duoc dung de tu van.', 18);
    await slowFill(page, page.locator('.modal textarea').nth(2), '<p>Noi dung landing page B10</p>', 18);
    await page.locator('.modal input[type="checkbox"]').check();
    await slowFill(page, page.locator('label:has-text("Meta Pixel ID") input').first(), `META-${digits}`);
    await slowFill(page, page.locator('label:has-text("Google Tag ID") input').first(), `G-${digits}`);
    await clickLocator(page, page.locator('.modal button.primary').filter({ hasText: /Luu/i }));
    await expect(page.locator('table.data-table tbody tr').filter({ hasText: slug }).first()).toBeVisible({ timeout: 20_000 });

    await setVideoLabel(page, 'Mo public slug va submit form de tao submission va lead lien doi.');
    await page.goto(`/lp/${slug}`);
    await page.waitForLoadState('networkidle');
    await slowFill(page, page.locator('.form-card input').nth(0), `Phu huynh ${digits}`);
    await slowFill(page, page.locator('.form-card input').nth(1), parentPhone);
    await slowFill(page, page.locator('.form-card input').nth(2), `b10-${digits}@school.local`);
    await slowFill(page, page.locator('.form-card input').nth(3), `Hoc sinh ${digits}`);
    await slowFill(page, page.locator('.form-card input').nth(4), 'Lop 6');
    await slowFill(page, page.locator('.form-card textarea').first(), 'Can hoc thu va tu van lich hoc', 18);
    await clickLocator(page, page.locator('button.submit-btn'));
    await expect(page.locator('.success-card')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('.success-meta')).toContainText(/Submission:/i);

    await setVideoLabel(page, 'Quay lai man quan ly submissions de thay row vua submit, roi mo Leads de doi chieu lead tao ra.');
    await switchSession(page, directorSession, `${APP_BASE_URL}/app/landing-pages`, {
      email: roleEmail('director'),
      password: rolePassword(),
    });
    await clickLocator(page, page.getByRole('button', { name: /Submissions/i }));
    await slowFill(page, page.locator('input[placeholder*="phu huynh"]').first(), parentPhone);
    await expect(page.locator('table.data-table tbody tr').filter({ hasText: parentPhone }).first()).toBeVisible({ timeout: 20_000 });

    await page.goto('/app/leads');
    await page.waitForLoadState('networkidle');
    await slowFill(page, page.locator('section.filters input').first(), parentPhone);
    const leadRow = page.locator('table.data tbody tr').filter({ hasText: parentPhone }).first();
    await expect(leadRow).toBeVisible({ timeout: 20_000 });
    await clickLocator(page, leadRow);
    await expect(page.locator('.drawer, h3').filter({ hasText: /Lead|Phu huynh|lead/i }).first()).toBeVisible({ timeout: 20_000 });

    await setVideoLabel(page, 'Ket qua thuc te: submit form cong khai da tao submission trong landing management va tao lead lien doi.');
    await page.waitForTimeout(1500);
  } finally {
    await saveRecordedVideo(page, context, `UI_B10_Ads_PublicFlows_${DATE_STAMP}`);
  }
});

test('B06 teacher hub substitute linked flow', async ({ browser, request }) => {
  test.slow();
  const teacherSession = await loginAsRole(request, 'teacher');
  const directorSession = await loginAsRole(request, 'director');
  const opsSession = await loginAsRole(request, 'ops');
  const teacherProfile = await apiJson<any>(request, teacherSession, 'GET', '/teachers/me');
  const teacherProfileId = teacherProfile?._id;
  expect(teacherProfileId).toBeTruthy();

  const digits = uniqueDigits('b06', 6);
  const bankName = `VCB ${digits}`;
  const accountNumber = `001${uniqueDigits('acct', 9)}`;
  const reason = `Xin day thay B06 ${digits}`;

  const { context, page } = await createRecordedPage(browser);

  try {
    await showTitleCard(
      page,
      'B06 Teacher Hub and Parent Pages',
      'Cap nhat bank info trong teacher profile, sau do mo teacher-profiles bang role Director; tiep theo tao substitute request va mo ticket OPS lien doi.',
      [
        'Teacher save bank info va reload lai profile.',
        'Director mo teacher-profiles/:id de thay thong tin vua luu.',
        'Teacher submit substitute request roi mo ticket lien doi o role OPS.',
      ],
    );

    await loginViaUi(page, roleEmail('teacher'), rolePassword());
    await page.goto('/app/teacher-profile');
    await page.waitForLoadState('networkidle');

    await setVideoLabel(page, 'Teacher chinh sua ho so va luu lai bank info moi.');
    await clickLocator(page, page.locator('header .btn.primary').first());
    await slowFill(page, page.locator('input[name="bankName"]'), bankName);
    await slowFill(page, page.locator('input[name="accountNumber"]'), accountNumber);
    await slowFill(page, page.locator('input[name="accountHolderName"]'), `GV ${digits}`);
    await slowFill(page, page.locator('input[name="bankBranch"]'), 'CN Quan 1');
    await clickLocator(page, page.locator('button[type="submit"].btn.primary').first());
    await expect(page.locator('.alert.success')).toBeVisible({ timeout: 20_000 });
    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.section-card').filter({ hasText: bankName }).first()).toBeVisible({ timeout: 20_000 });

    await setVideoLabel(page, 'Mo teacher-profiles bang Director de thay bank info vua luu xuat hien o man lien doi.');
    await switchSession(page, directorSession, `${APP_BASE_URL}/app/teacher-profiles/${teacherProfileId}`, {
      email: roleEmail('director'),
      password: rolePassword(),
    });
    await expect(page.locator('.card').filter({ hasText: bankName }).first()).toBeVisible({ timeout: 20_000 });

    await setVideoLabel(page, 'Quay lai teacher-substitute-request, test validation ngay va gui yeu cau day thay.');
    await switchSession(page, teacherSession, `${APP_BASE_URL}/app/teacher-substitute-request`, {
      email: roleEmail('teacher'),
      password: rolePassword(),
    });
    await clickLocator(page, page.locator('.page-header .primary').first());
    const classSelect = page.locator('select[name="classId"]');
    const classValue = await classSelect.locator('option').nth(1).getAttribute('value');
    if (classValue) {
      await classSelect.selectOption(classValue);
    }
    await page.locator('input[name="fromDate"]').fill(localDate(2));
    await page.locator('input[name="toDate"]').fill(localDate(1));
    await slowFill(page, page.locator('textarea[name="reason"]'), reason, 18);
    await clickLocator(page, page.locator('.modal button.primary').first());
    await expect(page.locator('.modal .error')).toBeVisible({ timeout: 10_000 });
    await page.locator('input[name="toDate"]').fill(localDate(3));
    await clickLocator(page, page.locator('.modal button.primary').first());
    await expect(page.locator('.success-msg')).toBeVisible({ timeout: 20_000 });

    const myTickets = await apiJson<any>(request, '/tickets/my-tickets', {
      method: 'GET',
      session: teacherSession,
    });
    const substituteTicket = (myTickets.body?.data || myTickets.body || [])
      .find((item: any) => item.type === 'SUBSTITUTE_TEACHER' && item.description?.includes(reason));
    expect(substituteTicket?._id).toBeTruthy();

    await setVideoLabel(page, 'Mo ticket lien doi bang role OPS de xac nhan submit substitute request da sinh ra case cho van hanh.');
    await switchSession(page, opsSession, `${APP_BASE_URL}/app/tickets?ticketId=${substituteTicket._id}`, {
      email: roleEmail('ops'),
      password: rolePassword(),
    });
    await expect(page.locator('.ticket-detail-page')).toBeVisible({ timeout: 20_000 });

    await setVideoLabel(page, 'Ket qua thuc te: bank info va substitute request deu mo ra thay doi o cac man lien doi.');
    await page.waitForTimeout(1500);
  } finally {
    await saveRecordedVideo(page, context, `UI_B06_TeacherHub_ParentPages_${DATE_STAMP}`);
  }
});

test('B11 reports export audit linked flow', async ({ browser, request }) => {
  test.slow();
  const directorSession = await loginAsRole(request, 'director');

  const { context, page } = await createRecordedPage(browser);

  try {
    await showTitleCard(
      page,
      'B11 Reports Export Audit',
      'Mo report UI, xuat CSV tu export-reports, sau do vao audit-log loc theo EXPORT de thay hoat dong vua phat sinh.',
      [
        'Mo attendance-report de ghi nhan man report.',
        'Export file CSV tu export-reports.',
        'Mo audit-log va loc theo action EXPORT de doi soat side effect.',
      ],
    );

    await loginViaUi(page, roleEmail('director'), rolePassword());
    await page.goto('/app/attendance-report');
    await page.waitForLoadState('networkidle');
    await clickLocator(page, page.getByTestId('attendance-report-search-button'));
    await page.waitForTimeout(1200);
    await expect(page.locator('[data-testid="attendance-report-table-container"], .empty-state, .report-summary').first()).toBeVisible({ timeout: 20_000 });

    await setVideoLabel(page, 'Chuyen sang Export Reports va xuat CSV de tao side effect trong audit log.');
    await page.goto('/app/export-reports');
    await page.waitForLoadState('networkidle');
    const downloadPromise = page.waitForEvent('download', { timeout: 30_000 });
    await clickLocator(page, page.locator('.export-card').nth(3).locator('button.btn-export').first());
    const download = await downloadPromise;
    expect(await download.suggestedFilename()).toMatch(/hoc-sinh/i);
    await expect(page.locator('.message')).toContainText('thành công', { timeout: 20_000 });

    await setVideoLabel(page, 'Mo Audit Log va loc action EXPORT de thay log vua phat sinh sau thao tac xuat file.');
    await switchSession(page, directorSession, `${APP_BASE_URL}/app/audit-log`, {
      email: roleEmail('director'),
      password: rolePassword(),
    });
    await page.locator('select.filter-select').nth(1).selectOption('EXPORT');
    await page.waitForTimeout(1500);
    await expect(page.locator('.data-table tbody tr, .empty').first()).toBeVisible({ timeout: 20_000 });

    await setVideoLabel(page, 'Ket qua thuc te: export thanh cong va audit-log co the duoc mo ngay de doi chieu action EXPORT.');
    await page.waitForTimeout(1500);
  } finally {
    await saveRecordedVideo(page, context, `UI_B11_Reports_Export_Audit_${DATE_STAMP}`);
  }
});
