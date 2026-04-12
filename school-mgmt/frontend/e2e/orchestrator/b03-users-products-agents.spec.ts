import { expect, test, type APIRequestContext, type Locator, type Page } from '@playwright/test';
import { applySessionCookies, loginAsRole } from '../support/auth';
import { createBatchEvidenceContext } from '../support/orchestrator';

test.use({ video: 'on' });
test.describe.configure({ mode: 'serial', timeout: 120_000 });

const APP_BASE_URL =
  process.env['PLAYWRIGHT_BASE_URL']
  || process.env['E2E_BASE_URL']
  || 'http://localhost:4200';

function appUrl(path: string): string {
  return new URL(path, APP_BASE_URL).toString();
}

function uniqueLabel(prefix: string): string {
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
  return `${prefix} ${stamp}`;
}

async function gotoApp(page: Page, path: string): Promise<void> {
  await page.goto(appUrl(path));
  await page.waitForLoadState('domcontentloaded');
}

async function signIn(page: Page, session: Awaited<ReturnType<typeof loginAsRole>>): Promise<void> {
  await page.context().clearCookies();
  await applySessionCookies(page, session);
}

async function openProductForm(page: Page): Promise<Locator> {
  await page.locator('.page-header button.primary').click();
  const modal = page.locator('.modal-backdrop .modal').last();
  await expect(modal).toBeVisible();
  return modal.locator('form');
}

async function createProductViaUi(page: Page, productName: string): Promise<void> {
  const form = await openProductForm(page);
  await form.locator('input[name="name"]').fill(productName);
  await form.locator('select[name="category"]').selectOption('MATH');
  await form.locator('select[name="teachingMode"]').selectOption('ONLINE');
  await form.locator('input[name="defaultSessions"]').fill('12');
  await form.locator('input[name="suggestedPrice"]').fill('1200000');
  await form.locator('input[name="defaultSessionDuration"]').fill('90');
  await expect(form.locator('input[name="isActive"]')).toBeChecked();
  await form.locator('button[type="submit"]').click();
  await expect(page.locator('tbody tr').filter({ hasText: productName }).first()).toBeVisible();
}

async function deactivateProductViaUi(page: Page, productName: string): Promise<void> {
  const row = page.locator('tbody tr').filter({ hasText: productName }).first();
  await expect(row).toBeVisible();
  await row.locator('button.btn-sm').first().click();

  const form = page.locator('.modal-backdrop .modal').last().locator('form');
  const activeCheckbox = form.locator('input[name="isActive"]');
  await expect(activeCheckbox).toBeChecked();
  await activeCheckbox.uncheck();
  await form.locator('button[type="submit"]').click();

  const refreshedRow = page.locator('tbody tr').filter({ hasText: productName }).first();
  await expect(refreshedRow).toBeVisible();
  await expect(refreshedRow).toHaveClass(/inactive/);
  await expect(refreshedRow.locator('.badge.off')).toBeVisible();
}

async function createAgentViaUi(page: Page, agentName: string): Promise<void> {
  await page.locator('.header .btn-primary').click();
  const modal = page.locator('.modal-backdrop .modal').last();
  await expect(modal).toBeVisible();

  const inputs = modal.locator('input');
  const selects = modal.locator('select');
  const notes = modal.locator('textarea');

  await inputs.nth(0).fill(agentName);
  await inputs.nth(1).fill(`Lien he ${agentName}`);
  await inputs.nth(2).fill(`090${Date.now().toString().slice(-7)}`);
  await inputs.nth(3).fill(`${agentName.toLowerCase().replace(/\s+/g, '.')}@school.local`);
  await inputs.nth(4).fill(`Dia chi ${agentName}`);
  await inputs.nth(5).fill(`TX${Date.now().toString().slice(-8)}`);
  await inputs.nth(6).fill(`Bank ${agentName}`);
  await inputs.nth(7).fill(`123${Date.now().toString().slice(-9)}`);
  await inputs.nth(8).fill(`Chu tai khoan ${agentName}`);
  await selects.nth(0).selectOption('GOLD');
  await inputs.nth(9).fill('15');
  await notes.fill(`Batch B03 evidence for ${agentName}`);

  await modal.locator('.modal-actions .btn-primary').click();
  await expect(page.locator('tbody tr').filter({ hasText: agentName }).first()).toBeVisible();
}

async function openOrderFormAsSale(page: Page, request: APIRequestContext): Promise<Locator> {
  const saleSession = await loginAsRole(request, 'sale');
  await signIn(page, saleSession);
  await gotoApp(page, '/app/orders');
  await page.getByTestId('orders-create-button').click();
  const modal = page.getByTestId('order-form-modal');
  await expect(modal).toBeVisible();
  await expect.poll(async () => page.getByTestId('order-item-product-0').locator('option').count()).toBeGreaterThan(1);
  return modal;
}

test('B03 Products can be created then deactivated through the product editor', async ({ browser, request }) => {
  const batch = await createBatchEvidenceContext(browser, {
    batchId: 'B03',
    scenario: 'users-products-agents-products-deactivation',
  });

  const productName = uniqueLabel('B03 goi hoc');

  try {
    const directorSession = await loginAsRole(request, 'director');
    await signIn(batch.page, directorSession);

    await gotoApp(batch.page, '/app/products');
    await expect(batch.page.locator('.page-header h2')).toBeVisible();
    await createProductViaUi(batch.page, productName);
    await batch.step('director-created-active-product');

    await deactivateProductViaUi(batch.page, productName);
    await batch.step('director-deactivated-product');

    await batch.finalize('PASS', {
      extraLines: [
        `Created product: ${productName}`,
        'Verified the row changes from active to inactive after editing isActive off.',
      ],
    });
  } catch (error) {
    await batch.finalize('FAIL', { error });
    throw error;
  }
});

test('B03 Sale order product dropdown does not show the deactivated product', async ({ browser, request }) => {
  const batch = await createBatchEvidenceContext(browser, {
    batchId: 'B03',
    scenario: 'users-products-agents-sale-order-guard',
  });

  const productName = uniqueLabel('B03 goi hoc');

  try {
    const directorSession = await loginAsRole(request, 'director');
    await signIn(batch.page, directorSession);
    await gotoApp(batch.page, '/app/products');
    await createProductViaUi(batch.page, productName);
    await deactivateProductViaUi(batch.page, productName);

    await openOrderFormAsSale(batch.page, request);
    const productSelect = batch.page.getByTestId('order-item-product-0');
    await expect(productSelect.locator('option', { hasText: productName })).toHaveCount(0);
    await batch.step('sale-order-dropdown-hidden-deactivated-product');

    await batch.finalize('PASS', {
      extraLines: [
        `Checked order dropdown against deactivated product: ${productName}`,
        'Expected the inactive package to be absent from the sale dropdown.',
      ],
    });
  } catch (error) {
    await batch.finalize('FAIL', { error });
    throw error;
  }
});

test('B03 Agents can be created as GOLD with 15 percent commission', async ({ browser, request }) => {
  const batch = await createBatchEvidenceContext(browser, {
    batchId: 'B03',
    scenario: 'users-products-agents-agent-create',
  });

  const agentName = uniqueLabel('B03 dai ly GOLD');

  try {
    const directorSession = await loginAsRole(request, 'director');
    await signIn(batch.page, directorSession);

    await gotoApp(batch.page, '/app/agents');
    await expect(batch.page.locator('.header h2')).toBeVisible();
    await createAgentViaUi(batch.page, agentName);
    await batch.step('director-created-gold-agent');

    const row = batch.page.locator('tbody tr').filter({ hasText: agentName }).first();
    await expect(row).toBeVisible();
    await expect(row).toContainText('GOLD');
    await expect(row).toContainText('15%');

    await batch.finalize('PASS', {
      extraLines: [
        `Created agent: ${agentName}`,
        'Verified tier GOLD and commission 15% on the list row.',
      ],
    });
  } catch (error) {
    await batch.finalize('FAIL', { error });
    throw error;
  }
});
