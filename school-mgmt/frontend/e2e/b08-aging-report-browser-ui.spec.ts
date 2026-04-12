import { expect, test, type APIRequestContext, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { applySessionCookies, loginAsRole } from './support/auth';

const APP_BASE_URL =
  process.env['PLAYWRIGHT_BASE_URL'] ||
  process.env['E2E_BASE_URL'] ||
  'http://localhost:4200';

const AGING_REPORT_API_PATTERN = /^https?:\/\/[^/]+:3000\/financial-control\/aging-report(?:\?.*)?$/;

type DemoRole = 'director' | 'shareholder';

function buildAgingReport() {
  return {
    summary: {
      totalAR: 8550000,
      current: 1800000,
      '1-30': 1250000,
      '31-60': 2000000,
      '61-90': 1000000,
      '90+': 2500000,
    },
    details: [
      {
        parentName: 'Nguyen Thi Hanh',
        parentPhone: '0901000001',
        students: ['Minh Anh'],
        totalDebt: 1800000,
        oldestDate: '2026-04-02T00:00:00.000Z',
        bucket: 'current',
        items: [],
      },
      {
        parentName: 'Tran Quoc Bao',
        parentPhone: '0901000002',
        students: ['Bao Chau'],
        totalDebt: 1250000,
        oldestDate: '2026-03-18T00:00:00.000Z',
        bucket: '1-30',
        items: [],
      },
      {
        parentName: 'Le Thanh Son',
        parentPhone: '0901000003',
        students: ['Son Tung', 'Son Nhi'],
        totalDebt: 2000000,
        oldestDate: '2026-02-21T00:00:00.000Z',
        bucket: '31-60',
        items: [],
      },
      {
        parentName: 'Pham Gia Han',
        parentPhone: '0901000004',
        students: ['Gia Han'],
        totalDebt: 1000000,
        oldestDate: '2026-01-28T00:00:00.000Z',
        bucket: '61-90',
        items: [],
      },
      {
        parentName: 'Do Hoang Phuc',
        parentPhone: '0901000005',
        students: ['Hoang Phuc', 'Hoang Mai'],
        totalDebt: 2500000,
        oldestDate: '2025-12-11T00:00:00.000Z',
        bucket: '90+',
        items: [],
      },
    ],
  };
}

async function routeJson(page: Page, pattern: RegExp, body: unknown, status = 200): Promise<void> {
  await page.route(pattern, async (route) => {
    await route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  });
}

async function openAgingReportPage(
  browser: Browser,
  request: APIRequestContext,
  role: DemoRole,
): Promise<{ context: BrowserContext; page: Page }> {
  const session = await loginAsRole(request, role);
  const context = await browser.newContext({ baseURL: APP_BASE_URL });
  const page = await context.newPage();
  await routeJson(page, AGING_REPORT_API_PATTERN, buildAgingReport());
  await applySessionCookies(context, session);
  await page.goto('/app/aging-report');
  await page.waitForLoadState('domcontentloaded');
  return { context, page };
}

async function expectSummaryCards(page: Page): Promise<void> {
  const cards = page.locator('.summary-card');
  await expect(cards).toHaveCount(6);
  await expect(cards.nth(0)).toContainText('8,550,000d');
  await expect(cards.nth(0)).toContainText('Tong cong no (AR)');
  await expect(cards.nth(1)).toContainText('1,800,000d');
  await expect(cards.nth(1)).toContainText('Hien tai (Current)');
  await expect(cards.nth(2)).toContainText('1,250,000d');
  await expect(cards.nth(2)).toContainText('1-30 ngay');
  await expect(cards.nth(3)).toContainText('2,000,000d');
  await expect(cards.nth(3)).toContainText('31-60 ngay');
  await expect(cards.nth(4)).toContainText('1,000,000d');
  await expect(cards.nth(4)).toContainText('61-90 ngay');
  await expect(cards.nth(5)).toContainText('2,500,000d');
  await expect(cards.nth(5)).toContainText('Qua 90 ngay');
}

test.describe('B08 aging-report browser coverage', () => {
  test('B08 aging-report keeps exact summary totals, bucket labels, and filter semantics for director', async ({ browser, request }) => {
    const { context, page } = await openAgingReportPage(browser, request, 'director');

    try {
      await expect(page.getByRole('heading', { name: /Bao cao Cong no|Aging Report/i })).toBeVisible();
      await expectSummaryCards(page);
      await expect(page.locator('table.data tbody tr')).toHaveCount(5);

      await page.locator('.filters select').selectOption('31-60');
      await expect(page.locator('table.data tbody tr')).toHaveCount(1);
      const bucket31Row = page.locator('table.data tbody tr').first();
      await expect(bucket31Row.locator('td').nth(0)).toHaveText('Le Thanh Son');
      await expect(bucket31Row.locator('td').nth(1)).toHaveText('0901000003');
      await expect(bucket31Row.locator('td').nth(2)).toHaveText('Son Tung, Son Nhi');
      await expect(bucket31Row.locator('td').nth(3)).toContainText('2,000,000d');
      await expect(bucket31Row.locator('.badge')).toHaveText('31-60 ngay');

      await page.locator('.filters select').selectOption('90+');
      await expect(page.locator('table.data tbody tr')).toHaveCount(1);
      const bucket90Row = page.locator('table.data tbody tr').first();
      await expect(bucket90Row.locator('td').nth(0)).toHaveText('Do Hoang Phuc');
      await expect(bucket90Row.locator('td').nth(1)).toHaveText('0901000005');
      await expect(bucket90Row.locator('td').nth(2)).toHaveText('Hoang Phuc, Hoang Mai');
      await expect(bucket90Row.locator('.badge')).toHaveText('90+ ngay');

      await page.locator('.filters select').selectOption('current');
      await expect(page.locator('table.data tbody tr')).toHaveCount(1);
      const currentRow = page.locator('table.data tbody tr').first();
      await expect(currentRow.locator('td').nth(0)).toHaveText('Nguyen Thi Hanh');
      await expect(currentRow.locator('td').nth(1)).toHaveText('0901000001');
      await expect(currentRow.locator('td').nth(2)).toHaveText('Minh Anh');
      await expect(currentRow.locator('.badge')).toHaveText('Hien tai');

      await page.locator('.filters select').selectOption('');
      await expect(page.locator('table.data tbody tr')).toHaveCount(5);
      await expect(page.locator('table.data tbody tr').nth(1).locator('.badge')).toHaveText('1-30 ngay');
      await expect(page.locator('table.data tbody tr').nth(3).locator('.badge')).toHaveText('61-90 ngay');
    } finally {
      await context.close();
    }
  });

  test('B08 aging-report keeps bucket filters exact while shareholder view stays anonymized', async ({ browser, request }) => {
    const { context, page } = await openAgingReportPage(browser, request, 'shareholder');

    try {
      await expect(page.getByText(/Chi tiet ca nhan da duoc an danh cho vai tro co dong/i)).toBeVisible();
      await expectSummaryCards(page);
      await expect(page.locator('table.data tbody tr')).toHaveCount(5);

      await page.locator('.filters select').selectOption('31-60');
      await expect(page.locator('table.data tbody tr')).toHaveCount(1);
      const row = page.locator('table.data tbody tr').first();
      await expect(row.locator('td').nth(0)).toHaveText('PH #1');
      await expect(row.locator('td').nth(1)).toHaveText('An danh');
      await expect(row.locator('td').nth(2)).toHaveText('2 hoc sinh');
      await expect(row.locator('.badge')).toHaveText('31-60 ngay');

      await page.locator('.filters select').selectOption('90+');
      await expect(page.locator('table.data tbody tr')).toHaveCount(1);
      await expect(page.locator('table.data tbody tr').first().locator('td').nth(0)).toHaveText('PH #1');
      await expect(page.locator('table.data tbody tr').first().locator('td').nth(1)).toHaveText('An danh');
      await expect(page.locator('table.data tbody tr').first().locator('.badge')).toHaveText('90+ ngay');

      await page.locator('.filters select').selectOption('');
      await expect(page.locator('table.data tbody tr')).toHaveCount(5);
      await expect(page.locator('table.data tbody tr').nth(4).locator('td').nth(0)).toHaveText('PH #5');
      await expect(page.locator('table.data tbody tr').nth(4).locator('td').nth(2)).toHaveText('2 hoc sinh');
    } finally {
      await context.close();
    }
  });
});
