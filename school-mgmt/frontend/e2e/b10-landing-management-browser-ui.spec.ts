import { expect, test, type Browser, type Page, type APIRequestContext } from '@playwright/test';
import { applySessionCookies, createBatchEvidenceContext, loginAsRole, type BatchEvidenceSession } from './support';

const APP_BASE_URL =
  process.env['PLAYWRIGHT_BASE_URL'] ||
  process.env['E2E_BASE_URL'] ||
  'http://localhost:4200';
const APP_ORIGIN = new URL(APP_BASE_URL).origin;

const RUN_DATE = process.env['UI_EVIDENCE_DATE'] || new Date().toISOString().slice(0, 10);

test.use({
  trace: 'off',
  video: 'on',
});

type LandingState = {
  pages: any[];
  submissions: any[];
  groups: any[];
  nextId: number;
};

function appUrl(path: string): string {
  return new URL(path, APP_BASE_URL).toString();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function nowIso(): string {
  return new Date().toISOString();
}

function field(modal: ReturnType<Page['locator']>, labelText: RegExp, selector = 'input,textarea,select') {
  return modal.locator('label').filter({ hasText: labelText }).locator(selector).first();
}

async function seedManagementBrowserApis(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const win = window as any;
    win.__alerts = [];
    win.__prompts = [];
    win.__confirms = [];
    win.__copiedTexts = [];
    win.__clipboardMode = 'success';

    window.alert = (message?: string) => {
      win.__alerts.push(String(message || ''));
    };
    window.prompt = (message?: string, defaultValue?: string) => {
      win.__prompts.push({
        message: String(message || ''),
        defaultValue: String(defaultValue || ''),
      });
      return defaultValue || '';
    };
    window.confirm = (message?: string) => {
      win.__confirms.push(String(message || ''));
      return true;
    };

    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async (value: string) => {
          win.__copiedTexts.push(String(value));
          if (win.__clipboardMode === 'fail') {
            throw new Error('clipboard blocked');
          }
        },
      },
    });
  });
}

async function routeManagementApis(page: Page, state: LandingState): Promise<void> {
  await page.route(/\/ads\/groups\/all(?:\?.*)?$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(state.groups),
    });
  });

  await page.route(/\/landing-pages(?:\/[^?/]*)?(?:\?.*)?$/, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    const path = url.pathname;

    if (url.origin === APP_ORIGIN) {
      await route.continue();
      return;
    }

    if (path.endsWith('/landing-pages/submissions') && method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(state.submissions),
      });
      return;
    }

    if (path.endsWith('/landing-pages') && method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(state.pages),
      });
      return;
    }

    if (path.endsWith('/landing-pages') && method === 'POST') {
      await sleep(900);
      const payload = request.postDataJSON() as any;
      const pageId = `lp-b10-${state.nextId}`;
      state.nextId += 1;
      const group = state.groups.find((item) => item._id === payload.defaultAdGroupId);
      const created = {
        _id: pageId,
        pageCode: `LP-${String(state.nextId).padStart(3, '0')}`,
        name: payload.name,
        slug: payload.slug,
        status: payload.status || 'DRAFT',
        heroTitle: payload.heroTitle || '',
        heroSubtitle: payload.heroSubtitle || '',
        formTitle: payload.formTitle || '',
        formDescription: payload.formDescription || '',
        submitButtonText: payload.submitButtonText || '',
        privacyNotice: payload.privacyNotice || '',
        successTitle: payload.successTitle || '',
        successMessage: payload.successMessage || '',
        bodyHtml: payload.bodyHtml || '',
        defaultPlatform: payload.defaultPlatform || group?.platform || '',
        defaultAdGroupId: payload.defaultAdGroupId || '',
        defaultAdGroupName: group?.name || '',
        autoCreateLead: payload.autoCreateLead !== false,
        metaPixelId: payload.metaPixelId || '',
        googleTagId: payload.googleTagId || '',
        googleAdsConversionId: payload.googleAdsConversionId || '',
        googleAdsConversionLabel: payload.googleAdsConversionLabel || '',
        tiktokPixelId: payload.tiktokPixelId || '',
        customHeadHtml: payload.customHeadHtml || '',
        customBodyHtml: payload.customBodyHtml || '',
        notes: payload.notes || '',
        createdAt: nowIso(),
      };
      state.pages = [created, ...state.pages];
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(created),
      });
      return;
    }

    const pageId = path.split('/').pop() || '';

    if (method === 'PATCH') {
      await sleep(900);
      const payload = request.postDataJSON() as any;
      state.pages = state.pages.map((item) => {
        if (item._id !== pageId) return item;
        const group = state.groups.find((groupItem) => groupItem._id === payload.defaultAdGroupId);
        return {
          ...item,
          ...payload,
          defaultPlatform: payload.defaultPlatform || group?.platform || '',
          defaultAdGroupName: group?.name || '',
        };
      });
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
      return;
    }

    if (method === 'DELETE') {
      state.pages = state.pages.filter((item) => item._id !== pageId);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
      return;
    }

    await route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Unhandled landing route' }),
    });
  });
}

async function openDirectorEvidencePage(
  browser: Browser,
  request: APIRequestContext,
  scenario: string,
  setup: (page: Page) => Promise<void> | void,
): Promise<BatchEvidenceSession> {
  const directorSession = await loginAsRole(request, 'director');
  const evidence = await createBatchEvidenceContext(browser, {
    batchId: 'B10',
    scenario,
    runDate: RUN_DATE,
  });
  await applySessionCookies(evidence.context, directorSession);
  await setup(evidence.page);
  await evidence.page.goto(appUrl('/app/landing-pages'));
  await evidence.page.waitForLoadState('domcontentloaded');
  return evidence;
}

test.describe.serial('B10 landing pages management browser flows', () => {
  test('B10 landing pages management create edit delete keeps UI and loading state consistent', async ({ browser, request }) => {
    test.slow();
    test.setTimeout(300_000);

    const state: LandingState = {
      pages: [
        {
          _id: 'lp-seed-1',
          pageCode: 'LP-001',
          name: 'Seed Landing',
          slug: 'seed-landing',
          status: 'ACTIVE',
          defaultPlatform: 'FACEBOOK',
          defaultAdGroupId: 'group-alpha',
          defaultAdGroupName: 'Group Alpha',
          autoCreateLead: true,
          metaPixelId: 'META-SEED',
          googleTagId: 'G-SEED',
          googleAdsConversionId: '',
          googleAdsConversionLabel: '',
          tiktokPixelId: '',
          createdAt: nowIso(),
        },
      ],
      submissions: [],
      groups: [
        {
          _id: 'group-alpha',
          groupCode: 'AG-001',
          name: 'Group Alpha',
          adAccountId: 'acc-1',
          platform: 'FACEBOOK',
          platformCampaignId: 'cmp-1',
          status: 'ACTIVE',
          createdAt: nowIso(),
          updatedAt: nowIso(),
        },
      ],
      nextId: 2,
    };

    const evidence = await openDirectorEvidencePage(browser, request, 'landing-management-crud', async (page) => {
      await seedManagementBrowserApis(page);
      await routeManagementApis(page, state);
    });

    try {
      const createButton = evidence.page.locator('.page-header .primary');
      await expect(createButton).toBeVisible();
      await expect(evidence.page.locator('table.data-table')).toContainText(/Seed Landing/i);
      await evidence.step('01-management-loaded');

      await createButton.click();
      const modal = evidence.page.locator('.modal');
      await expect(modal).toBeVisible();
      await field(modal, /Ten landing page/i).fill('Math Boost Sprint');
      await field(modal, /Slug public/i).fill('math-boost-sprint');
      await field(modal, /Trang thai/i, 'select').selectOption('ACTIVE');
      await field(modal, /Tieu de hero/i).fill('Math Boost Hero');
      await field(modal, /Meta Pixel ID/i).fill('PIXEL-NEW');
      await field(modal, /Ad group mac dinh/i, 'select').selectOption('group-alpha');
      await expect(field(modal, /Platform mac dinh/i, 'select')).toHaveValue('FACEBOOK');

      const saveButton = modal.locator('.modal-actions .primary');
      await saveButton.click();
      await expect(saveButton).toBeDisabled();
      await evidence.step('02-create-loading');

      const createdRow = evidence.page.locator('tbody tr').filter({ hasText: /Math Boost Sprint/i }).first();
      await expect(createdRow).toBeVisible({ timeout: 20_000 });
      await expect(createdRow).toContainText(/Meta PIXEL-NEW/i);
      await expect(createdRow).toContainText(/Hoat dong/i);
      await evidence.step('03-created-row');

      await createdRow.getByRole('button', { name: /Sua/i }).click();
      await expect(modal).toBeVisible();
      await field(modal, /Ten landing page/i).fill('Math Boost Sprint Updated');
      await field(modal, /Trang thai/i, 'select').selectOption('ARCHIVED');
      await field(modal, /TikTok Pixel ID/i).fill('TT-UPDATED');
      await saveButton.click();
      await expect(saveButton).toBeDisabled();
      await evidence.step('04-edit-loading');

      const updatedRow = evidence.page.locator('tbody tr').filter({ hasText: /Math Boost Sprint Updated/i }).first();
      await expect(updatedRow).toBeVisible({ timeout: 20_000 });
      await expect(updatedRow).toContainText(/Luu tru/i);
      await expect(updatedRow).toContainText(/TikTok TT-UPDATED/i);
      await evidence.step('05-edited-row');

      await updatedRow.getByRole('button', { name: /Xoa/i }).click();
      await expect(updatedRow).toHaveCount(0);
      await expect(evidence.page.locator('tbody tr').filter({ hasText: /Seed Landing/i }).first()).toBeVisible();
      const confirms = await evidence.page.evaluate(() => (window as any).__confirms as string[]);
      expect(confirms.at(-1)).toContain('Math Boost Sprint Updated');
      await evidence.step('06-deleted-row');

      evidence.note('Landing pages management create/edit/delete flow stayed consistent, and save actions disabled the modal button while requests were in flight.');
      await evidence.finalize('PASS', {
        extraLines: [
          'Landing pages create/edit/delete: PASS',
          'Save button loading/disabled state: PASS',
        ],
      });
    } catch (error) {
      await evidence.finalize('FAIL', { error });
      throw error;
    }
  });

  test('B10 landing pages copy public URL uses clipboard success and prompt fallback', async ({ browser, request }) => {
    test.slow();
    test.setTimeout(300_000);

    const state: LandingState = {
      pages: [
        {
          _id: 'lp-copy-1',
          pageCode: 'LP-101',
          name: 'Copy Landing',
          slug: 'copy-landing',
          status: 'ACTIVE',
          defaultPlatform: 'GOOGLE',
          defaultAdGroupId: 'group-alpha',
          defaultAdGroupName: 'Group Alpha',
          autoCreateLead: true,
          metaPixelId: '',
          googleTagId: '',
          googleAdsConversionId: '',
          googleAdsConversionLabel: '',
          tiktokPixelId: '',
          createdAt: nowIso(),
        },
      ],
      submissions: [],
      groups: [
        {
          _id: 'group-alpha',
          groupCode: 'AG-001',
          name: 'Group Alpha',
          adAccountId: 'acc-1',
          platform: 'FACEBOOK',
          platformCampaignId: 'cmp-1',
          status: 'ACTIVE',
          createdAt: nowIso(),
          updatedAt: nowIso(),
        },
      ],
      nextId: 2,
    };

    const evidence = await openDirectorEvidencePage(browser, request, 'landing-management-copy-link', async (page) => {
      await seedManagementBrowserApis(page);
      await routeManagementApis(page, state);
    });

    try {
      const row = evidence.page.locator('tbody tr').filter({ hasText: /Copy Landing/i }).first();
      await expect(row).toBeVisible();
      const expectedUrl = `${APP_BASE_URL}/lp/copy-landing`;

      await evidence.page.evaluate(() => {
        (window as any).__clipboardMode = 'success';
      });
      await row.getByRole('button', { name: /Copy link/i }).click();
      const clipboardSuccess = await evidence.page.evaluate(() => ({
        alerts: (window as any).__alerts as string[],
        copiedTexts: (window as any).__copiedTexts as string[],
      }));
      expect(clipboardSuccess.copiedTexts.at(-1)).toBe(expectedUrl);
      expect(clipboardSuccess.alerts.at(-1)).toContain(expectedUrl);
      await evidence.step('01-copy-success');

      await evidence.page.evaluate(() => {
        (window as any).__clipboardMode = 'fail';
      });
      await row.getByRole('button', { name: /Copy link/i }).click();
      const clipboardFallback = await evidence.page.evaluate(() => ({
        prompts: (window as any).__prompts as Array<{ message: string; defaultValue: string }>,
      }));
      expect(clipboardFallback.prompts.at(-1)?.message).toContain('Copy link landing page');
      expect(clipboardFallback.prompts.at(-1)?.defaultValue).toBe(expectedUrl);
      await evidence.step('02-copy-fallback');

      evidence.note('Copy public URL uses clipboard when available and falls back to prompt with the same URL when clipboard is blocked.');
      await evidence.finalize('PASS', {
        extraLines: [
          'Copy public URL clipboard path: PASS',
          'Copy public URL prompt fallback: PASS',
        ],
      });
    } catch (error) {
      await evidence.finalize('FAIL', { error });
      throw error;
    }
  });
});
