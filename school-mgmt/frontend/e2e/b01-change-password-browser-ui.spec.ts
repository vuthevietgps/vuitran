import { expect, test, type APIRequestContext, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { applySessionCookies, loginAsRole, rolePassword } from './support/auth';

const APP_BASE_URL =
  process.env['PLAYWRIGHT_BASE_URL'] ||
  process.env['E2E_BASE_URL'] ||
  'http://localhost:4200';

async function openAuthenticatedPage(
  browser: Browser,
  request: APIRequestContext,
  path: string,
  configurePage?: (page: Page) => Promise<void>,
): Promise<{ context: BrowserContext; page: Page }> {
  const session = await loginAsRole(request, 'director');
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

test.describe('B01 change password browser UI', () => {
  test('B01 doi mat khau submit thanh cong, clear form va dang nhap lai', async ({ browser, request }) => {
    let changePasswordPayload: Record<string, unknown> | null = null;
    let logoutCalls = 0;

    const { context, page } = await openAuthenticatedPage(
      browser,
      request,
      '/app/dashboard',
      async (authedPage) => {
        await authedPage.addInitScript(() => {
          (
            globalThis as typeof globalThis & {
              __changePasswordLogoutDelayMs?: number;
            }
          ).__changePasswordLogoutDelayMs = 250;
        });

        await authedPage.route('**/notifications/unread-count', async (route) => {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ count: 0 }),
          });
        });

        await authedPage.route('**/pending-approvals/summary', async (route) => {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ totalPending: 0 }),
          });
        });

        await authedPage.route('**/auth/change-password', async (route) => {
          changePasswordPayload = route.request().postDataJSON() as Record<string, unknown>;
          await route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify({ message: 'Doi mat khau thanh cong' }),
          });
        });

        await authedPage.route('**/auth/logout', async (route) => {
          logoutCalls += 1;
          await route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify({ ok: true }),
          });
        });
      },
    );

    try {
      await page.getByTestId('change-password-open').click();
      await expect(page.getByTestId('change-password-modal')).toBeVisible();

      await page.getByTestId('change-password-current').fill(rolePassword());
      await page.getByTestId('change-password-new').fill('StrongPass123');
      await page.getByTestId('change-password-confirm').fill('StrongPass123');
      await page.getByTestId('change-password-submit').click();

      await expect(page.getByTestId('change-password-success-toast')).toContainText('Doi mat khau thanh cong');
      await expect(page.getByTestId('change-password-current')).toHaveValue('');
      await expect(page.getByTestId('change-password-new')).toHaveValue('');
      await expect(page.getByTestId('change-password-confirm')).toHaveValue('');
      expect(changePasswordPayload).toEqual({
        oldPassword: rolePassword(),
        newPassword: 'StrongPass123',
      });

      await expect(page).toHaveURL(/\/login$/, { timeout: 5_000 });
      expect(logoutCalls).toBe(1);
    } finally {
      await context.close();
    }
  });

  test('B01 doi mat khau validate frontend va hien loi khi mat khau cu sai', async ({ browser, request }) => {
    let changePasswordCalls = 0;
    let logoutCalls = 0;

    const { context, page } = await openAuthenticatedPage(
      browser,
      request,
      '/app/dashboard',
      async (authedPage) => {
        await authedPage.route('**/notifications/unread-count', async (route) => {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ count: 0 }),
          });
        });

        await authedPage.route('**/pending-approvals/summary', async (route) => {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ totalPending: 0 }),
          });
        });

        await authedPage.route('**/auth/change-password', async (route) => {
          changePasswordCalls += 1;
          await route.fulfill({
            status: 401,
            contentType: 'application/json',
            body: JSON.stringify({ message: 'Mat khau cu khong dung' }),
          });
        });

        await authedPage.route('**/auth/logout', async (route) => {
          logoutCalls += 1;
          await route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify({ ok: true }),
          });
        });
      },
    );

    try {
      await page.getByTestId('change-password-open').click();
      await expect(page.getByTestId('change-password-modal')).toBeVisible();

      await page.getByTestId('change-password-current').fill(rolePassword());
      await page.getByTestId('change-password-new').fill('1234567');
      await page.getByTestId('change-password-confirm').fill('12345678');
      await page.getByTestId('change-password-submit').click();

      await expect(page.getByTestId('change-password-new-error')).toContainText(/it nhat 8 ky tu/i);
      await expect(page.getByTestId('change-password-confirm-error')).toContainText(/khong khop/i);
      expect(changePasswordCalls).toBe(0);

      await page.getByTestId('change-password-new').fill('StrongPass123');
      await page.getByTestId('change-password-confirm').fill('StrongPass123');
      await page.getByTestId('change-password-submit').click();

      await expect(page.getByTestId('change-password-error')).toContainText('Mat khau cu khong dung');
      await expect(page.getByTestId('change-password-success-toast')).toHaveCount(0);
      await expect(page).toHaveURL(/\/app\/dashboard$/);
      expect(changePasswordCalls).toBe(1);
      expect(logoutCalls).toBe(0);
    } finally {
      await context.close();
    }
  });
});
