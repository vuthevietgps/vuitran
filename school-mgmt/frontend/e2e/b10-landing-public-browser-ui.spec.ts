import { expect, test, type Browser, type Page } from '@playwright/test';
import { createBatchEvidenceContext, type BatchEvidenceSession } from './support';

const APP_BASE_URL =
  process.env['PLAYWRIGHT_BASE_URL'] ||
  process.env['E2E_BASE_URL'] ||
  'http://localhost:4200';

const RUN_DATE = process.env['UI_EVIDENCE_DATE'] || new Date().toISOString().slice(0, 10);

test.use({
  trace: 'off',
  video: 'on',
});

function appUrl(path: string): string {
  return new URL(path, APP_BASE_URL).toString();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function openPublicEvidencePage(
  browser: Browser,
  scenario: string,
  path: string,
  setup?: (page: Page) => Promise<void> | void,
): Promise<BatchEvidenceSession> {
  const evidence = await createBatchEvidenceContext(browser, {
    batchId: 'B10',
    scenario,
    runDate: RUN_DATE,
  });
  if (setup) {
    await setup(evidence.page);
  }
  await evidence.page.goto(appUrl(path));
  await evidence.page.waitForLoadState('domcontentloaded');
  return evidence;
}

async function collectTrackingAssetState(page: Page) {
  return page.evaluate(() => {
    const win = window as any;
    const scripts = Array.from(document.scripts);
    const fbqQueue = Array.isArray(win.fbq?.queue) ? win.fbq.queue.slice() : [];
    const dataLayer = Array.isArray(win.dataLayer) ? win.dataLayer.slice() : [];

    const countMatchingScripts = (pattern: string) =>
      scripts.filter((script) => script.src.includes(pattern)).length;

    return {
      metaSdkScripts: countMatchingScripts('connect.facebook.net/en_US/fbevents.js'),
      googleTagScripts: scripts.filter((script) => script.id === 'landing-gtag-G-UNITTEST').length,
      tikTokSdkScripts: countMatchingScripts('analytics.tiktok.com/i18n/pixel/events.js'),
      metaPixelIds: Array.from(win.__landingMetaPixelIds || []),
      tikTokPixelIds: Array.from(win.__landingTikTokPixels || []),
      fbqInitCalls: fbqQueue.filter((entry: any) => Array.isArray(entry) && entry[0] === 'init' && entry[1] === 'PIXEL-UNIT-1').length,
      fbqPageViewCalls: fbqQueue.filter((entry: any) => Array.isArray(entry) && entry[0] === 'track' && entry[1] === 'PageView').length,
      googleConfigCalls: dataLayer.filter((entry: any) => Array.isArray(entry) && entry[0] === 'config' && entry[1] === 'G-UNITTEST').length,
    };
  });
}

test.describe.serial('B10 landing public browser flows', () => {
  test('B10 public landing tracking assets do not duplicate across route leave and revisit', async ({ browser }) => {
    test.slow();
    test.setTimeout(300_000);

    const evidence = await openPublicEvidencePage(
      browser,
      'public-landing-tracking-assets-no-duplicate',
      '/lp/e2e-tracking-assets',
      async (page) => {
        await page.route(/^https:\/\/connect\.facebook\.net\/.*$/, async (route) => {
          await route.fulfill({ status: 200, contentType: 'application/javascript', body: '' });
        });
        await page.route(/^https:\/\/www\.googletagmanager\.com\/gtag\/js.*$/, async (route) => {
          await route.fulfill({ status: 200, contentType: 'application/javascript', body: '' });
        });
        await page.route(/^https:\/\/analytics\.tiktok\.com\/i18n\/pixel\/events\.js.*$/, async (route) => {
          await route.fulfill({ status: 200, contentType: 'application/javascript', body: '' });
        });
        await page.route(/\/public\/landing-pages\/e2e-tracking-assets(?:\?.*)?$/, async (route) => {
          await sleep(350);
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              _id: 'lp-b10-pixels-001',
              name: 'Tracking Assets Landing',
              slug: 'e2e-tracking-assets',
              status: 'ACTIVE',
              heroTitle: 'Tracking Assets Landing',
              heroSubtitle: 'Xac minh pixel va script khong bi lap khi vao ra trang.',
              formTitle: 'Nhan tu van hoc thu',
              formDescription: 'Trang demo cho browser test tracking assets.',
              submitButtonText: 'Nhan tu van ngay',
              privacyNotice: 'Thong tin chi dung de tu van.',
              successTitle: 'Cam on phu huynh',
              successMessage: 'Chung toi se lien he som.',
              metaPixelId: 'PIXEL-UNIT-1',
              googleTagId: 'G-UNITTEST',
              tiktokPixelId: 'TIKTOK-UNIT-1',
              customHeadHtml: '<meta id=\"lp-pixel-head-hook\" name=\"lp-pixel-head-hook\" content=\"present\">',
              customBodyHtml: '<div id=\"lp-pixel-body-hook\">pixel body hook</div>',
            }),
          });
        });
      },
    );

    try {
      await expect(evidence.page.locator('.hero h1')).toContainText(/Tracking Assets Landing/i);
      await expect(evidence.page.locator('#lp-pixel-head-hook')).toHaveCount(1);
      await expect(evidence.page.locator('#lp-pixel-body-hook')).toBeVisible();
      await expect(evidence.page.locator('script#landing-gtag-G-UNITTEST')).toHaveCount(1);

      const firstVisit = await collectTrackingAssetState(evidence.page);
      expect(firstVisit.metaSdkScripts).toBe(1);
      expect(firstVisit.googleTagScripts).toBe(1);
      expect(firstVisit.tikTokSdkScripts).toBe(1);
      expect(firstVisit.metaPixelIds).toEqual(['PIXEL-UNIT-1']);
      expect(firstVisit.tikTokPixelIds).toEqual(['TIKTOK-UNIT-1']);
      expect(firstVisit.fbqInitCalls).toBe(1);
      expect(firstVisit.fbqPageViewCalls).toBe(1);
      expect(firstVisit.googleConfigCalls).toBeGreaterThanOrEqual(1);
      await evidence.step('01-first-visit-single-assets');

      await evidence.page.goto(appUrl('/login'));
      await evidence.page.waitForLoadState('domcontentloaded');
      await expect(evidence.page.locator('#lp-pixel-head-hook')).toHaveCount(0);
      await expect(evidence.page.locator('#lp-pixel-body-hook')).toHaveCount(0);
      await expect(evidence.page.locator('script#landing-gtag-G-UNITTEST')).toHaveCount(0);

      const afterLeave = await collectTrackingAssetState(evidence.page);
      expect(afterLeave.googleTagScripts).toBe(0);
      await evidence.step('02-route-leave-cleanup');

      await evidence.page.goto(appUrl('/lp/e2e-tracking-assets'));
      await evidence.page.waitForLoadState('domcontentloaded');
      await expect(evidence.page.locator('.hero h1')).toContainText(/Tracking Assets Landing/i);
      await expect(evidence.page.locator('#lp-pixel-head-hook')).toHaveCount(1);
      await expect(evidence.page.locator('#lp-pixel-body-hook')).toBeVisible();
      await expect(evidence.page.locator('script#landing-gtag-G-UNITTEST')).toHaveCount(1);

      const secondVisit = await collectTrackingAssetState(evidence.page);
      expect(secondVisit.metaSdkScripts).toBe(1);
      expect(secondVisit.googleTagScripts).toBe(1);
      expect(secondVisit.tikTokSdkScripts).toBe(1);
      expect(secondVisit.metaPixelIds).toEqual(['PIXEL-UNIT-1']);
      expect(secondVisit.tikTokPixelIds).toEqual(['TIKTOK-UNIT-1']);
      expect(secondVisit.fbqInitCalls).toBe(1);
      expect(secondVisit.fbqPageViewCalls).toBe(1);
      await evidence.step('03-second-visit-still-single-assets');

      evidence.note('Public landing tracking assets stay single-instance across leave/revisit: Facebook init is not duplicated, Google tag script returns as a single node, and TikTok SDK is not loaded twice.');
      await evidence.finalize('PASS', {
        extraLines: [
          'Meta Pixel / Google Tag / TikTok Pixel assets stay single-instance across route leave and revisit: PASS',
          'Facebook init stays single while PageView tracks again on revisit: PASS',
          'Google tag custom head/body hooks clean up on destroy and reappear once on revisit: PASS',
        ],
      });
    } catch (error) {
      await evidence.finalize('FAIL', { error });
      throw error;
    }
  });

  test('B10 public landing invalid slug shows loading then error state', async ({ browser }) => {
    test.slow();
    test.setTimeout(300_000);

    const evidence = await openPublicEvidencePage(
      browser,
      'public-landing-invalid-slug',
      '/lp/missing-landing',
      async (page) => {
        await page.route(/\/public\/landing-pages\/missing-landing(?:\?.*)?$/, async (route) => {
          await sleep(800);
          await route.fulfill({
            status: 404,
            contentType: 'application/json',
            body: JSON.stringify({ message: 'Landing page khong ton tai.' }),
          });
        });
      },
    );

    try {
      await expect(evidence.page.locator('.spinner')).toBeVisible();
      await evidence.step('01-loading-state');

      await expect(evidence.page.locator('.state-shell.error')).toBeVisible();
      await expect(evidence.page.locator('.state-shell.error h2')).toContainText(/Landing page khong ton tai/i);
      await expect(evidence.page.locator('.hero')).toHaveCount(0);
      await evidence.step('02-error-state');

      evidence.note('Missing slug stays in loading state first, then resolves to the public error shell without rendering a broken form.');
      await evidence.finalize('PASS', {
        extraLines: [
          'Public landing loading state: PASS',
          'Invalid slug error state: PASS',
        ],
      });
    } catch (error) {
      await evidence.finalize('FAIL', { error });
      throw error;
    }
  });

  test('B10 public landing submit error keeps tracking payload and cleans injected markup on destroy', async ({ browser }) => {
    test.slow();
    test.setTimeout(300_000);

    const submitBodies: any[] = [];

    const evidence = await openPublicEvidencePage(
      browser,
      'public-landing-submit-error-tracking',
      '/lp/e2e-math-boost?utm_source=facebook&utm_medium=cpc&utm_campaign=wave3&utm_content=hero&utm_term=math&fbclid=fbclid123&gclid=gclid123&ttclid=ttclid123&campaign_id=camp-1',
      async (page) => {
        await page.route(/^https:\/\/connect\.facebook\.net\/.*$/, async (route) => {
          await route.fulfill({ status: 200, contentType: 'application/javascript', body: '' });
        });
        await page.route(/^https:\/\/www\.googletagmanager\.com\/gtag\/js.*$/, async (route) => {
          await route.fulfill({ status: 200, contentType: 'application/javascript', body: '' });
        });
        await page.route(/^https:\/\/analytics\.tiktok\.com\/i18n\/pixel\/events\.js.*$/, async (route) => {
          await route.fulfill({ status: 200, contentType: 'application/javascript', body: '' });
        });
        await page.route(/\/public\/landing-pages\/e2e-math-boost\/submit(?:\?.*)?$/, async (route) => {
          submitBodies.push(route.request().postDataJSON());
          await sleep(900);
          await route.fulfill({
            status: 400,
            contentType: 'application/json',
            body: JSON.stringify({ message: 'Khong gui duoc form demo.' }),
          });
        });
        await page.route(/\/public\/landing-pages\/e2e-math-boost(?:\?.*)?$/, async (route) => {
          await sleep(700);
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              _id: 'lp-b10-001',
              name: 'Math Boost Sprint',
              slug: 'e2e-math-boost',
              status: 'ACTIVE',
              heroTitle: 'Math Boost Sprint',
              heroSubtitle: 'De lai thong tin de nhan lo trinh hoc phu hop.',
              formTitle: 'Nhan tu van hoc thu',
              formDescription: 'He thong se luu tracking va attribution truoc khi submit.',
              submitButtonText: 'Nhan tu van ngay',
              privacyNotice: 'Thong tin chi dung de tu van.',
              successTitle: 'Cam on phu huynh',
              successMessage: 'Chung toi se lien he som.',
              bodyHtml: '<div id=\"lp-body-copy\">Body intro</div>',
              metaPixelId: 'PIXEL-UNIT-1',
              googleTagId: 'G-UNITTEST',
              tiktokPixelId: 'TIKTOK-UNIT-1',
              customHeadHtml: '<meta id=\"lp-head-hook\" name=\"lp-head-hook\" content=\"present\">',
              customBodyHtml: '<div id=\"lp-body-hook\">custom body hook</div>',
            }),
          });
        });
      },
    );

    try {
      await expect(evidence.page.locator('.spinner')).toBeVisible();
      await expect(evidence.page.locator('.hero h1')).toContainText(/Math Boost Sprint/i);
      await expect(evidence.page.locator('#lp-head-hook')).toHaveCount(1);
      await expect(evidence.page.locator('#lp-body-hook')).toBeVisible();
      await expect(evidence.page.locator('script#landing-gtag-G-UNITTEST')).toHaveCount(1);
      await evidence.step('01-public-landing-loaded');

      await evidence.page.locator('input').nth(0).fill('Parent Alpha');
      await evidence.page.locator('input').nth(1).fill('0901234567');
      await evidence.page.locator('input').nth(2).fill('parent.alpha@example.com');
      await evidence.page.locator('input').nth(3).fill('Student Alpha');
      await evidence.page.locator('input').nth(4).fill('Lop 5');
      await evidence.page.locator('textarea').fill('Can tu van khoa hoc tang toc.');

      const submitButton = evidence.page.locator('.submit-btn');
      await submitButton.click();
      await expect(submitButton).toBeDisabled();
      await expect(submitButton).toContainText(/Dang gui/i);
      await expect(evidence.page.locator('.submit-error')).toHaveCount(0);
      await evidence.step('02-submit-loading');

      await expect(evidence.page.locator('.submit-error')).toContainText(/Khong gui duoc form demo/i, {
        timeout: 20_000,
      });
      await expect(evidence.page.locator('.success-card')).toHaveCount(0);
      await expect(submitBodies).toHaveLength(1);
      expect(submitBodies[0]).toMatchObject({
        parentName: 'Parent Alpha',
        parentPhone: '0901234567',
        parentEmail: 'parent.alpha@example.com',
        studentName: 'Student Alpha',
        studentGrade: 'Lop 5',
        notes: 'Can tu van khoa hoc tang toc.',
        platform: 'FACEBOOK',
        adRefParam: 'camp-1',
      });
      expect(submitBodies[0].tracking).toMatchObject({
        landingPageId: 'lp-b10-001',
        landingPageSlug: 'e2e-math-boost',
        landingPageName: 'Math Boost Sprint',
        fbclid: 'fbclid123',
        gclid: 'gclid123',
        ttclid: 'ttclid123',
        utmSource: 'facebook',
        utmMedium: 'cpc',
        utmCampaign: 'wave3',
        utmContent: 'hero',
        utmTerm: 'math',
      });
      expect(String(submitBodies[0].tracking?.submittedUrl || '')).toContain('utm_source=facebook');
      await evidence.step('03-submit-error-tracking');

      await evidence.page.goto(appUrl('/login'));
      await evidence.page.waitForLoadState('domcontentloaded');
      await expect(evidence.page.locator('#lp-head-hook')).toHaveCount(0);
      await expect(evidence.page.locator('#lp-body-hook')).toHaveCount(0);
      await expect(evidence.page.locator('script#landing-gtag-G-UNITTEST')).toHaveCount(0);
      await evidence.step('04-markup-cleanup');

      evidence.note('Public landing submit error preserved payload contract, kept the form on screen, and cleaned custom injected markup on route destroy.');
      await evidence.finalize('PASS', {
        extraLines: [
          'Public landing submit error state: PASS',
          'Tracking payload before submit: PASS',
          'Custom head/body injection cleanup: PASS',
        ],
      });
    } catch (error) {
      await evidence.finalize('FAIL', { error });
      throw error;
    }
  });
});
