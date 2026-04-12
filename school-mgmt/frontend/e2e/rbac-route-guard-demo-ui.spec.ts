import { expect, test } from '@playwright/test';
import { applySessionCookies, loginAsRole } from './support/auth';

test.use({
  trace: 'on',
  video: 'on',
});

test.describe('RBAC route guard demo artifacts', () => {
  test('captures screenshots and video for parent financial-control redirect', async ({
    page,
    request,
  }, testInfo) => {
    const parentSession = await loginAsRole(request, 'parent');
    await applySessionCookies(page.context(), parentSession);

    await page.goto('/app/dashboard');
    await page.waitForLoadState('networkidle');
    await page.screenshot({
      path: testInfo.outputPath('01-dashboard-after-session.png'),
      fullPage: true,
    });

    await page.goto('/app/financial-control');
    await page.waitForLoadState('networkidle');
    await page.screenshot({
      path: testInfo.outputPath('02-after-direct-financial-control.png'),
      fullPage: true,
    });

    await expect(page).toHaveURL(/\/not-authorized$/);
    await expect(page.getByText(/not authorized|khong co quyen|không có quyền/i)).toBeVisible();

    await page.screenshot({
      path: testInfo.outputPath('03-not-authorized-final.png'),
      fullPage: true,
    });
  });
});
