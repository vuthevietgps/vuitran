import { expect, test } from '@playwright/test';
import { applySessionCookies, loginAsRole } from './support/auth';

const APP_BASE_URL =
  process.env['PLAYWRIGHT_BASE_URL'] ||
  process.env['E2E_BASE_URL'] ||
  'http://localhost:4200';

function appUrl(path: string): string {
  return new URL(path, APP_BASE_URL).toString();
}

test.use({
  trace: 'off',
  screenshot: 'off',
  video: 'off',
});

test('B05 classes table header stays fixed while content scrolls', async ({ page, request }) => {
  const session = await loginAsRole(request, 'director');
  await applySessionCookies(page, session);

  await page.goto(appUrl('/app/classes'));
  await page.waitForLoadState('domcontentloaded');

  const tableShell = page.locator('.data-table-shell');
  const headerCell = page.locator('table.data thead th').first();
  const rows = page.locator('table.data tbody tr');

  await expect(page).toHaveURL(/\/app\/classes$/);
  await expect(tableShell).toBeVisible();
  await expect(headerCell).toBeVisible();
  await expect(rows.first()).toBeVisible();

  const { shellTop, headerTop: initialHeaderTop, maxScroll } = await page.evaluate(() => {
    const shellElement = document.querySelector('.data-table-shell') as HTMLElement | null;
    const headerElement = document.querySelector('table.data thead th') as HTMLElement | null;
    if (!shellElement || !headerElement) {
      return { shellTop: 0, headerTop: 0, maxScroll: 0 };
    }
    return {
      shellTop: shellElement.getBoundingClientRect().top,
      headerTop: headerElement.getBoundingClientRect().top,
      maxScroll: shellElement.scrollHeight - shellElement.clientHeight,
    };
  });

  expect(maxScroll).toBeGreaterThan(0);

  const targetScrollTop = Math.min(maxScroll, Math.max(220, Math.round(initialHeaderTop - shellTop + 240)));

  await tableShell.evaluate((element, scrollTop) => {
    element.scrollTo(0, scrollTop);
  }, targetScrollTop);

  await expect.poll(async () => tableShell.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);

  const headerTop = await headerCell.evaluate((element) => element.getBoundingClientRect().top);

  expect(Math.abs(headerTop - shellTop)).toBeLessThanOrEqual(12);
});
