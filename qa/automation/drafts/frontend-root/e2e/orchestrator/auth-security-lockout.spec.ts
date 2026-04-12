import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { apiJson, createBatchEvidenceContext, loginAsRole, rolePassword, uniquePhone } from '../support';

test.use({ video: 'on' });
test.describe.configure({ mode: 'serial' });

const APP_BASE_URL =
  process.env['PLAYWRIGHT_BASE_URL']
  || process.env['E2E_BASE_URL']
  || 'http://localhost:4200';

type LockoutUser = {
  _id: string;
  email: string;
  password: string;
};

function appUrl(path: string): string {
  return new URL(path, APP_BASE_URL).toString();
}

async function gotoLogin(page: Page): Promise<void> {
  await page.goto(appUrl('/login'));
  await page.waitForLoadState('domcontentloaded');
}

async function createDedicatedLockoutUser(request: APIRequestContext): Promise<LockoutUser> {
  const director = await loginAsRole(request, 'director');
  const suffix = `${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 1000)}`;
  const password = rolePassword();
  const user = await apiJson<any>(request, director, 'POST', '/users', {
    userCode: `LOCK${suffix}`,
    email: `e2e-lockout-${suffix}@school.local`,
    password,
    fullName: `E2E Lockout User ${suffix}`,
    role: 'PARENT',
    phone: uniquePhone(`lockout-${suffix}`),
  });

  return {
    _id: String(user._id),
    email: String(user.email),
    password,
  };
}

async function submitLogin(
  page: Page,
  email: string,
  password: string,
): Promise<{ status: number; bodyText: string }> {
  const responsePromise = page.waitForResponse((response) => {
    return response.request().method() === 'POST' && response.url().includes('/auth/login');
  });

  await page.getByTestId('login-email').fill(email);
  await page.getByTestId('login-password').fill(password);
  await page.getByTestId('login-submit').click();

  const response = await responsePromise;
  const bodyText = await response.text().catch(() => '');
  return {
    status: response.status(),
    bodyText,
  };
}

function hasLockoutKeyword(text: string): boolean {
  return /(khoa|khóa|qua nhieu lan|quá nhiều lần|thu lai sau|thử lại sau|lockout|locked)/i.test(text);
}

let lockoutUser: LockoutUser;

test.beforeAll(async ({ request }) => {
  lockoutUser = await createDedicatedLockoutUser(request);
});

test('B31 login brute-force lockout blocks a real password on the sixth attempt', async ({ browser }) => {
  test.slow();

  const batch = await createBatchEvidenceContext(browser, {
    batchId: 'B31',
    scenario: 'Auth_Security_Lockout',
  });

  try {
    batch.note(`Dedicated lockout user: ${lockoutUser.email}`);

    await gotoLogin(batch.page);
    await expect(batch.page.getByTestId('login-form')).toBeVisible();
    await batch.step('login-form-open');

    const loginError = batch.page.getByTestId('login-error');
    const email = lockoutUser.email;
    const wrongPassword = 'Definitely-Wrong-Password-001!';
    let lastStatus = 0;
    let lastBodyText = '';

    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const result = await submitLogin(batch.page, email, `${wrongPassword}${attempt}`);
      lastStatus = result.status;
      lastBodyText = result.bodyText;

      if (result.status === 429) {
        await expect(loginError).toHaveText('Ban da thu qua nhieu lan. Vui long doi 1 phut.');
      } else {
        await expect(result.status, `Unexpected status on failed attempt ${attempt}`).toBe(401);
        await expect(loginError).toHaveText('Sai email hoac mat khau');
      }

      await expect(batch.page).toHaveURL(/\/login$/);
      if (attempt < 5) {
        await batch.page.waitForTimeout(1100);
      }
    }

    await batch.step('after-five-failed-logins');

    const lockedResult = await submitLogin(batch.page, email, lockoutUser.password);
    lastStatus = lockedResult.status;
    lastBodyText = lockedResult.bodyText;

    await expect(batch.page).toHaveURL(/\/login$/);
    await expect(batch.page.getByTestId('login-form')).toBeVisible();
    await expect(lockedResult.status, 'Locked account should not authenticate successfully').not.toBe(200);

    const uiErrorText = (await loginError.textContent()) || '';
    const evidenceText = `${uiErrorText} ${lockedResult.bodyText}`.toLowerCase();
    expect(hasLockoutKeyword(evidenceText), `Expected lockout wording in UI or backend response, got: ${evidenceText}`).toBe(true);

    if (lockedResult.status === 429) {
      await expect(loginError).toHaveText('Ban da thu qua nhieu lan. Vui long doi 1 phut.');
    } else {
      await expect(lockedResult.status, 'Sixth attempt with the real password should be rejected while locked').toBe(401);
      await expect(loginError).toHaveText('Sai email hoac mat khau');
    }

    await batch.step('sixth-attempt-blocked');

    await batch.finalize('PASS', {
      extraLines: [
        `Lockout user: ${email}`,
        `Last response status: ${lastStatus}`,
        `Backend/UI evidence: ${evidenceText}`,
      ],
    });
  } catch (error) {
    await batch.finalize('FAIL', { error });
    throw error;
  }
});
