import { expect, test, type Browser, type BrowserContext, type Page, type APIRequestContext } from '@playwright/test';
import { applySessionCookies, loginAsRole, roleEmail, rolePassword } from './support/auth';

const APP_BASE_URL =
  process.env['PLAYWRIGHT_BASE_URL'] ||
  process.env['E2E_BASE_URL'] ||
  'http://localhost:4200';

async function openAuthenticatedPage(
  browser: Browser,
  request: APIRequestContext,
  role: 'director' | 'parent' | 'sale',
  path: string,
  configurePage?: (page: Page) => Promise<void>,
): Promise<{ context: BrowserContext; page: Page }> {
  const session = await loginAsRole(request, role);
  const context = await browser.newContext({ baseURL: APP_BASE_URL });
  const page = await context.newPage();

  if (configurePage) {
    await configurePage(page);
  }

  await applySessionCookies(context, session);
  await page.goto(path);
  await page.waitForLoadState('domcontentloaded');

  return { context, page };
}

test.describe('App shell and handbook browser UI', () => {
  test('B01 login 429 hien thi thong bao than thien', async ({ page }) => {
    await page.route('**/auth/login', async (route) => {
      await route.fulfill({
        status: 429,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Too many requests' }),
      });
    });

    await page.goto('/login');
    await page.getByTestId('login-email').fill(roleEmail('director'));
    await page.getByTestId('login-password').fill(rolePassword());
    await page.getByTestId('login-submit').click();

    await expect(page.getByTestId('login-error')).toContainText('Ban da thu qua nhieu lan. Vui long doi 1 phut.');
    await expect(page.getByTestId('login-submit')).toBeEnabled();
  });

  test('B01 refresh sau login van restore session tu cookie', async ({ browser, request }) => {
    const { context, page } = await openAuthenticatedPage(browser, request, 'director', '/app/dashboard');

    try {
      await expect(page).toHaveURL(/\/app\/dashboard$/);
      await expect(page.getByTestId('app-sidebar')).toBeVisible();
      await expect(page.getByTestId('sidebar-user-info')).toBeVisible();

      await page.reload();
      await page.waitForLoadState('domcontentloaded');

      await expect(page).toHaveURL(/\/app\/dashboard$/);
      await expect(page.getByTestId('app-sidebar')).toBeVisible();
      await expect(page.getByTestId('sidebar-user-name')).not.toBeEmpty();
    } finally {
      await context.close();
    }
  });

  test('B01 menu trai hien thi dung theo role', async ({ browser, request }) => {
    const directorUi = await openAuthenticatedPage(browser, request, 'director', '/app/dashboard');
    const parentUi = await openAuthenticatedPage(browser, request, 'parent', '/app/dashboard');

    try {
      await expect(directorUi.page.getByTestId('nav-products')).toBeVisible();
      await expect(directorUi.page.getByTestId('nav-classes')).toBeVisible();
      await expect(directorUi.page.getByTestId('nav-agents')).toBeVisible();
      await expect(directorUi.page.getByTestId('nav-parent-chat')).toHaveCount(0);

      await expect(parentUi.page.getByTestId('nav-parent-materials')).toBeVisible();
      await expect(parentUi.page.getByTestId('nav-student-progress')).toBeVisible();
      await expect(parentUi.page.getByTestId('nav-parent-calendar')).toBeVisible();
      await expect(parentUi.page.getByTestId('nav-parent-chat')).toBeVisible();
      await expect(parentUi.page.getByTestId('nav-products')).toHaveCount(0);
      await expect(parentUi.page.getByTestId('nav-agents')).toHaveCount(0);
      await expect(parentUi.page.getByTestId('nav-users')).toHaveCount(0);
    } finally {
      await Promise.allSettled([directorUi.context.close(), parentUi.context.close()]);
    }
  });

  test('B01 sidebar active link dung theo route va query param', async ({ browser, request }) => {
    const { context, page } = await openAuthenticatedPage(browser, request, 'director', '/app/users?role=PARENT');

    try {
      await expect(page.getByTestId('nav-parent-users')).toHaveClass(/active/);
      await expect(page.getByTestId('nav-users')).not.toHaveClass(/active/);

      await page.goto('/app/users');
      await page.waitForLoadState('domcontentloaded');

      await expect(page.getByTestId('nav-users')).toHaveClass(/active/);
      await expect(page.getByTestId('nav-parent-users')).not.toHaveClass(/active/);
    } finally {
      await context.close();
    }
  });

  test('B01 loading bar khi chuyen route hien thi va bien mat dung thoi diem', async ({ browser, request }) => {
    const { context, page } = await openAuthenticatedPage(
      browser,
      request,
      'director',
      '/app/dashboard',
      async (authedPage) => {
        await authedPage.addInitScript(() => {
          (
            globalThis as typeof globalThis & {
              __appShellRouteLoadingMinDurationMs?: number;
            }
          ).__appShellRouteLoadingMinDurationMs = 350;
        });
      },
    );

    try {
      await expect(page.getByTestId('app-route-loading')).toHaveCount(0);

      await page.getByTestId('nav-users').click();

      await expect(page.getByTestId('app-route-loading')).toBeVisible();
      await expect(page).toHaveURL(/\/app\/users$/);
      await expect(page.getByTestId('app-route-loading')).toBeHidden({ timeout: 5_000 });
    } finally {
      await context.close();
    }
  });

  test('B01 badge thong bao va cho duyet hien thi va cap nhat dung', async ({ browser, request }) => {
    let unreadCount = 7;
    let pendingCount = 4;

    const { context, page } = await openAuthenticatedPage(
      browser,
      request,
      'director',
      '/app/dashboard',
      async (authedPage) => {
        await authedPage.addInitScript(() => {
          const originalSetInterval = window.setInterval.bind(window);
          window.setInterval = ((handler: TimerHandler, timeout?: number, ...args: unknown[]) => {
            const normalizedTimeout = timeout === 60000 ? 150 : timeout;
            return originalSetInterval(handler, normalizedTimeout, ...args);
          }) as typeof window.setInterval;
        });

        await authedPage.route('**/notifications/unread-count', async (route) => {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ count: unreadCount }),
          });
        });

        await authedPage.route('**/pending-approvals/summary', async (route) => {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ totalPending: pendingCount }),
          });
        });
      },
    );

    try {
      await expect(page.getByTestId('nav-badge-notifications')).toHaveText('7');
      await expect(page.getByTestId('nav-badge-pending')).toHaveText('4');

      unreadCount = 1;
      pendingCount = 2;

      await expect(page.getByTestId('nav-badge-notifications')).toHaveText('1', { timeout: 5_000 });
      await expect(page.getByTestId('nav-badge-pending')).toHaveText('2', { timeout: 5_000 });
    } finally {
      await context.close();
    }
  });

  test('B02 quick links trong handbook dieu huong dung', async ({ browser, request }) => {
    const { context, page } = await openAuthenticatedPage(browser, request, 'director', '/app/internal-handbook');

    try {
      const firstLink = page.getByTestId('handbook-quick-link-0');
      const targetHref = await firstLink.getAttribute('href');

      expect(targetHref).toBeTruthy();
      await firstLink.click();

      const targetPath = new URL(targetHref as string, APP_BASE_URL).pathname;
      await expect(page).toHaveURL(new RegExp(`${targetPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`));
    } finally {
      await context.close();
    }
  });

  test('B02 gallery va video handbook tai hien thi khong vo UI', async ({ browser, request }) => {
    const { context, page } = await openAuthenticatedPage(browser, request, 'director', '/app/internal-handbook');

    try {
      await expect(page.getByTestId('internal-handbook-page')).toBeVisible();
      await expect(page.getByTestId('handbook-gallery')).toBeVisible();
      await expect(page.getByTestId('handbook-videos')).toBeVisible();
      await expect(page.getByTestId('handbook-gallery-card-0')).toBeVisible();
      await expect(page.getByTestId('handbook-video-card-0')).toBeVisible();

      const imageLoaded = await page.getByTestId('handbook-gallery-image-0').evaluate((img) => {
        const image = img as HTMLImageElement;
        return image.complete && image.naturalWidth > 0 && image.naturalHeight > 0;
      });
      expect(imageLoaded).toBe(true);

      const videoSource = await page.locator('[data-testid="handbook-video-0"] source').getAttribute('src');
      expect(videoSource).toBeTruthy();
    } finally {
      await context.close();
    }
  });
});
