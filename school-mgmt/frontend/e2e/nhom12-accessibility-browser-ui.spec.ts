import { expect, test, type APIRequestContext, type Browser, type Page } from '@playwright/test';
import { applySessionCookies, createBatchEvidenceContext, loginAsRole, type BatchEvidenceSession } from './support';

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

function srgbChannel(value: number): number {
  const normalized = value / 255;
  return normalized <= 0.03928
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
}

function luminance([red, green, blue]: number[]): number {
  return (0.2126 * srgbChannel(red)) + (0.7152 * srgbChannel(green)) + (0.0722 * srgbChannel(blue));
}

async function contrastRatio(page: Page, selector: string): Promise<number> {
  return page.locator(selector).first().evaluate((node) => {
    function parseColor(input: string): [number, number, number] {
      const match = String(input).match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
      if (!match) {
        throw new Error(`Unsupported color format: ${input}`);
      }
      return [Number(match[1]), Number(match[2]), Number(match[3])];
    }

    function srgbChannel(value: number): number {
      const normalized = value / 255;
      return normalized <= 0.03928
        ? normalized / 12.92
        : ((normalized + 0.055) / 1.055) ** 2.4;
    }

    function luminance([red, green, blue]: [number, number, number]): number {
      return (0.2126 * srgbChannel(red)) + (0.7152 * srgbChannel(green)) + (0.0722 * srgbChannel(blue));
    }

    function resolvedBackground(element: Element | null): [number, number, number] {
      let current: Element | null = element;
      while (current) {
        const style = window.getComputedStyle(current);
        const color = style.backgroundColor;
        if (color && color !== 'rgba(0, 0, 0, 0)' && color !== 'transparent') {
          return parseColor(color);
        }
        current = current.parentElement;
      }
      return [255, 255, 255];
    }

    const element = node as HTMLElement;
    const style = window.getComputedStyle(element);
    const foreground = parseColor(style.color);
    const background = resolvedBackground(element);
    const light = Math.max(luminance(foreground), luminance(background));
    const dark = Math.min(luminance(foreground), luminance(background));
    return Number((((light + 0.05) / (dark + 0.05))).toFixed(2));
  });
}

async function expectFocused(page: Page, locator: ReturnType<Page['locator']>): Promise<void> {
  await expect(locator).toBeFocused();
  await expect(locator.evaluate((node) => {
    const style = window.getComputedStyle(node as HTMLElement);
    return {
      outlineStyle: style.outlineStyle,
      outlineWidth: style.outlineWidth,
      boxShadow: style.boxShadow,
    };
  })).resolves.toEqual(expect.objectContaining({
    outlineStyle: expect.any(String),
    outlineWidth: expect.any(String),
    boxShadow: expect.any(String),
  }));
}

async function openPublicEvidence(
  browser: Browser,
  scenario: string,
  path: string,
): Promise<BatchEvidenceSession> {
  const evidence = await createBatchEvidenceContext(browser, {
    batchId: 'NHOM12',
    scenario,
    runDate: RUN_DATE,
  });
  await evidence.page.goto(appUrl(path));
  await evidence.page.waitForLoadState('domcontentloaded');
  return evidence;
}

async function openDirectorEvidence(
  browser: Browser,
  request: APIRequestContext,
  scenario: string,
  path: string,
): Promise<BatchEvidenceSession> {
  const directorSession = await loginAsRole(request, 'director');
  const evidence = await createBatchEvidenceContext(browser, {
    batchId: 'NHOM12',
    scenario,
    runDate: RUN_DATE,
  });
  await applySessionCookies(evidence.context, directorSession);
  await evidence.page.goto(appUrl(path));
  await evidence.page.waitForLoadState('domcontentloaded');
  return evidence;
}

test.describe.serial('NHOM12 accessibility browser flows', () => {
  test('NHOM12 login form keeps labels, keyboard tab order, and readable contrast', async ({ browser }) => {
    const evidence = await openPublicEvidence(browser, 'accessibility_login_form', '/login');

    try {
      const email = evidence.page.getByLabel(/^Email\b/i);
      const password = evidence.page.getByLabel(/^Mat khau\b/i);
      const showPassword = evidence.page.getByLabel(/^Hien mat khau\b/i);
      const submit = evidence.page.getByTestId('login-submit');

      await expect(evidence.page.getByTestId('login-form')).toBeVisible();
      await expect(email).toBeVisible();
      await expect(password).toBeVisible();
      await expect(showPassword).toBeVisible();

      await email.focus();
      await expectFocused(evidence.page, email);
      await evidence.page.keyboard.press('Tab');
      await expectFocused(evidence.page, password);
      await evidence.page.keyboard.press('Tab');
      await expectFocused(evidence.page, showPassword);
      await evidence.page.keyboard.press('Tab');
      await expectFocused(evidence.page, submit);
      await evidence.step('01-login-form-keyboard-order');

      const labelContrast = await contrastRatio(evidence.page, 'label:has([data-testid="login-email"])');
      const submitContrast = await contrastRatio(evidence.page, '[data-testid="login-submit"]');
      expect(labelContrast).toBeGreaterThanOrEqual(4.5);
      expect(submitContrast).toBeGreaterThanOrEqual(4.5);

      evidence.note(`Login labels remained programmatically associated and keyboard order stayed email -> password -> show password -> submit. Contrast ratios: label=${labelContrast}, submit=${submitContrast}.`);
      await evidence.finalize('PASS', {
        extraLines: [
          'Login inputs stayed reachable via labels: PASS',
          'Login keyboard tab order stayed stable and focusable: PASS',
          'Login label/button contrast stayed at or above 4.5:1: PASS',
        ],
      });
    } catch (error) {
      await evidence.finalize('FAIL', { error });
      throw error;
    }
  });

  test('NHOM12 internal handbook keeps keyboard-reachable hero actions and readable contrast on a main internal screen', async ({ browser, request }) => {
    const evidence = await openDirectorEvidence(browser, request, 'accessibility_internal_handbook', '/app/internal-handbook');

    try {
      const handbookPage = evidence.page.getByTestId('internal-handbook-page');
      const primaryLink = evidence.page.getByTestId('handbook-primary-link');
      const quickLink = evidence.page.getByTestId('handbook-quick-link-0');
      const focusableLinks = handbookPage.locator('a[href]');

      await expect(handbookPage).toBeVisible();
      await expect(primaryLink).toBeVisible();
      await expect(quickLink).toBeVisible();
      const focusableCount = await focusableLinks.count();
      expect(focusableCount).toBeGreaterThanOrEqual(3);
      const secondLink = focusableLinks.nth(1);
      const thirdLink = focusableLinks.nth(2);

      await primaryLink.focus();
      await expectFocused(evidence.page, primaryLink);
      await evidence.page.keyboard.press('Tab');
      await expectFocused(evidence.page, secondLink);
      await evidence.page.keyboard.press('Tab');
      await expectFocused(evidence.page, thirdLink);
      await evidence.page.keyboard.press('Shift+Tab');
      await expectFocused(evidence.page, secondLink);
      await evidence.step('01-handbook-hero-actions-keyboard-order');

      const primaryContrast = await contrastRatio(evidence.page, '.hero-subtitle');
      const secondaryContrast = await contrastRatio(evidence.page, '[data-testid="handbook-quick-link-0"] strong');
      expect(primaryContrast).toBeGreaterThanOrEqual(4.5);
      expect(secondaryContrast).toBeGreaterThanOrEqual(4.5);

      evidence.note(`Internal handbook kept natural keyboard navigation across visible links and retained readable contrast on hero subtitle and quick-link title text. Ratios: heroSubtitle=${primaryContrast}, quickLinkTitle=${secondaryContrast}.`);
      await evidence.finalize('PASS', {
        extraLines: [
          'Main internal screen links stayed keyboard reachable via Tab and Shift+Tab: PASS',
          'Hero subtitle and quick-link title kept contrast at or above 4.5:1: PASS',
        ],
      });
    } catch (error) {
      await evidence.finalize('FAIL', { error });
      throw error;
    }
  });
});
