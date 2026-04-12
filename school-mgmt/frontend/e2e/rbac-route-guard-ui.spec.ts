import { test, expect } from '@playwright/test';
import { applySessionCookies, loginAsRole } from './support/auth';

test.describe('RBAC route guard', () => {
  test('Parent truy cap truc tiep financial-control bi redirect sang not-authorized', async ({
    page,
    request,
  }) => {
    const parentSession = await loginAsRole(request, 'parent');
    await applySessionCookies(page.context(), parentSession);

    await page.goto('/app/financial-control');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/\/not-authorized$/);
    await expect(page.getByText(/not authorized|khong co quyen|không có quyền/i)).toBeVisible();
  });
});
