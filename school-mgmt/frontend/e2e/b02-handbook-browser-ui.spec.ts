import { expect, test, type APIRequestContext, type Browser, type Page } from '@playwright/test';
import { applySessionCookies, loginAsRole } from './support/auth';
import { createBatchEvidenceContext } from './support/orchestrator';

const APP_BASE_URL =
  process.env['PLAYWRIGHT_BASE_URL']
  || process.env['E2E_BASE_URL']
  || 'http://localhost:4200';

const DIRECTOR_QUICK_LINKS = [
  {
    label: 'Dashboard',
    note: 'Màn hình tổng quan đầu ngày của giám đốc.',
    route: '/app/dashboard',
  },
  {
    label: 'Chờ duyệt',
    note: 'Nơi xử lý các yêu cầu cần phê duyệt.',
    route: '/app/pending-approvals',
  },
  {
    label: 'Financial Control',
    note: 'Điểm kiểm soát tài chính và dòng tiền.',
    route: '/app/financial-control',
  },
  {
    label: 'Audit log',
    note: 'Truy vết lịch sử thao tác của toàn hệ thống.',
    route: '/app/audit-log',
  },
] as const;

const ACCOUNTING_GALLERY = [
  {
    title: 'Tổng quan vai trò kế toán',
    description: 'Ảnh giới thiệu nhịp đối soát chuẩn của kế toán trong hệ thống.',
    image: '/assets/internal-handbook/images/accounting_overview.webp',
  },
  {
    title: 'Dashboard kế toán',
    description: 'Nơi theo dõi top-up, ví và các chỉ số tài chính đầu ngày.',
    image: '/assets/internal-handbook/images/accounting_dashboard.webp',
    route: '/app/dashboard',
  },
  {
    title: 'Quản lý ví',
    description: 'Màn hình xử lý top-up, duyệt yêu cầu và kiểm tra ledger.',
    image: '/assets/internal-handbook/images/accounting_wallets.webp',
    route: '/app/wallets',
  },
  {
    title: 'Payroll',
    description: 'Màn hình đối chiếu kỳ lương để chốt số theo session.',
    image: '/assets/internal-handbook/images/accounting_payroll.webp',
    route: '/app/payroll',
  },
] as const;

const ACCOUNTING_VIDEO = {
  title: 'Video thao tác kế toán',
  description: 'Video hướng dẫn luồng dashboard → wallets → invoices → payroll dành cho kế toán.',
  src: '/assets/internal-handbook/videos/accounting_daily_flow.webm',
  poster: '/assets/internal-handbook/images/accounting_wallets.webp',
} as const;

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function gotoApp(page: Page, path: string): Promise<void> {
  await page.goto(new URL(path, APP_BASE_URL).toString());
  await page.waitForLoadState('domcontentloaded');
}

async function openHandbook(
  browser: Browser,
  request: APIRequestContext,
  role: 'director' | 'accounting',
  batchId: string,
  scenario: string,
) {
  const batch = await createBatchEvidenceContext(browser, { batchId, scenario });
  await batch.page.addInitScript(() => {
    window.localStorage.setItem('school_mgmt_sidebar_collapsed', 'false');
  });

  const session = await loginAsRole(request, role);
  await applySessionCookies(batch.page, session);
  await gotoApp(batch.page, '/app/dashboard');
  await expect(batch.page.getByTestId('nav-handbook')).toBeVisible();
  await batch.page.getByTestId('nav-handbook').click();
  await expect(batch.page).toHaveURL(/\/app\/internal-handbook$/);
  await expect(batch.page.getByTestId('internal-handbook-page')).toBeVisible();

  return batch;
}

async function expectImageLoaded(page: Page, testId: string): Promise<void> {
  const loaded = await page.getByTestId(testId).evaluate((node) => {
    const image = node as HTMLImageElement;
    return image.complete && image.naturalWidth > 0 && image.naturalHeight > 0;
  });
  expect(loaded).toBe(true);
}

test.describe.configure({ mode: 'serial', timeout: 120_000 });
test.setTimeout(120_000);

test('B02 director handbook quick links render exact modules and navigate correctly', async ({ browser, request }) => {
  const batch = await openHandbook(browser, request, 'director', 'B02', 'handbook_browser_director_quick_links');

  try {
    await expect(batch.page.getByTestId('internal-handbook-page')).toHaveAttribute('data-role', 'DIRECTOR');
    await expect(batch.page.locator('h1').first()).toHaveText('Cẩm nang giám đốc');
    await expect(batch.page.getByTestId('handbook-primary-link')).toHaveAttribute('href', '/app/dashboard');
    await expect(batch.page.getByTestId('handbook-video-link')).toHaveAttribute(
      'href',
      '/assets/internal-handbook/videos/director_daily_flow.webm',
    );
    await expect(batch.page.getByTestId('handbook-deep-dive-link')).toHaveCount(0);
    await expect(batch.page.getByTestId('handbook-quick-links').locator('[data-testid^="handbook-quick-link-"]')).toHaveCount(
      DIRECTOR_QUICK_LINKS.length,
    );

    for (const [index, link] of DIRECTOR_QUICK_LINKS.entries()) {
      const card = batch.page.getByTestId(`handbook-quick-link-${index}`);
      await expect(card.locator('strong')).toHaveText(link.label);
      await expect(card.locator('span')).toHaveText(link.note);
      await expect(card.locator('code')).toHaveText(link.route);
      await expect(card).toHaveAttribute('href', link.route);
    }

    await batch.step('director-handbook-quick-links');

    for (const [index, link] of DIRECTOR_QUICK_LINKS.entries()) {
      await batch.page.getByTestId(`handbook-quick-link-${index}`).click();
      await expect(batch.page).toHaveURL(new RegExp(`${escapeRegex(link.route)}$`));
      await gotoApp(batch.page, '/app/internal-handbook');
      await expect(batch.page.getByTestId('internal-handbook-page')).toBeVisible();
    }

    await batch.finalize('PASS', {
      extraLines: [
        'Verified director handbook opens from sidebar and renders the director-specific handbook shell.',
        'Verified all 4 director quick links keep exact labels, notes, routes, and navigation targets.',
        'Verified the director handbook exposes the correct hero primary link and no deep-dive CTA.',
      ],
    });
  } catch (error) {
    await batch.finalize('FAIL', { error });
    throw error;
  }
});

test('B02 accounting handbook gallery and video assets keep exact media contract', async ({ browser, request }) => {
  const batch = await openHandbook(browser, request, 'accounting', 'B02', 'handbook_browser_accounting_media');

  try {
    await expect(batch.page.getByTestId('internal-handbook-page')).toHaveAttribute('data-role', 'ACCOUNTING');
    await expect(batch.page.locator('h1').first()).toHaveText('Cẩm nang kế toán');
    await expect(batch.page.getByTestId('handbook-video-link')).toHaveAttribute('href', ACCOUNTING_VIDEO.src);
    await expect(batch.page.getByTestId('handbook-deep-dive-link')).toHaveCount(0);
    await expect(batch.page.getByTestId('handbook-gallery').locator('[data-testid^="handbook-gallery-card-"]')).toHaveCount(
      ACCOUNTING_GALLERY.length,
    );
    await expect(batch.page.getByTestId('handbook-videos').locator('[data-testid^="handbook-video-card-"]')).toHaveCount(1);
    await expect(batch.page.locator('.metric-card strong').nth(2)).toHaveText('4 ảnh • 1 video');

    for (const [index, item] of ACCOUNTING_GALLERY.entries()) {
      const card = batch.page.getByTestId(`handbook-gallery-card-${index}`);
      await card.scrollIntoViewIfNeeded();
      await expect(card.locator('h3')).toHaveText(item.title);
      await expect(card.locator('p')).toHaveText(item.description);
      await expect(batch.page.getByTestId(`handbook-gallery-image-${index}`)).toHaveAttribute('src', item.image);
      await expectImageLoaded(batch.page, `handbook-gallery-image-${index}`);
      await expect(card.getByRole('link', { name: 'Mở ảnh' })).toHaveAttribute('href', item.image);

      const screenLink = card.getByRole('link', { name: 'Mở màn hình' });
      if (item.route) {
        await expect(screenLink).toHaveAttribute('href', item.route);
      } else {
        await expect(screenLink).toHaveCount(0);
      }
    }

    const videoCard = batch.page.getByTestId('handbook-video-card-0');
    await videoCard.scrollIntoViewIfNeeded();
    await expect(videoCard.locator('h3')).toHaveText(ACCOUNTING_VIDEO.title);
    await expect(videoCard.locator('p')).toHaveText(ACCOUNTING_VIDEO.description);
    await expect(batch.page.getByTestId('handbook-video-0')).toHaveAttribute('poster', ACCOUNTING_VIDEO.poster);
    await expect(batch.page.locator('[data-testid="handbook-video-0"] source')).toHaveAttribute('src', ACCOUNTING_VIDEO.src);
    await expect(videoCard.getByRole('link', { name: 'Mở video riêng' })).toHaveAttribute('href', ACCOUNTING_VIDEO.src);

    await batch.step('accounting-handbook-gallery-video');

    await batch.finalize('PASS', {
      extraLines: [
        'Verified accounting handbook keeps the expected gallery count, image assets, captions, and route links.',
        'Verified the accounting handbook video keeps the expected source, poster, and standalone video link.',
        'Verified the accounting handbook media metric stays at 4 gallery images and 1 video.',
      ],
    });
  } catch (error) {
    await batch.finalize('FAIL', { error });
    throw error;
  }
});
