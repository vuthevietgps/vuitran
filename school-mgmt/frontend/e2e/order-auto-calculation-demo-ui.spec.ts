import { expect, test } from '@playwright/test';
import { apiJson } from './support/api';
import { applySessionCookies, loginAsRole } from './support/auth';

test.use({
  trace: 'on',
  video: 'on',
});

test.describe('Orders auto-calculation demo artifacts', () => {
  test('captures UI steps for live order total and discount calculation', async ({
    page,
    request,
  }, testInfo) => {
    test.slow();
    test.setTimeout(120_000);

    const directorSession = await loginAsRole(request, 'director');
    const label = `AutoCalc${Date.now()}`;

    const product = await apiJson<any>(
      request,
      directorSession,
      'POST',
      '/products',
      {
        name: `E2E Auto Calc ${label}`,
        code: `E2EAUTO${Date.now().toString().slice(-8)}`,
        description: 'Product used for Playwright UI auto-calculation demo',
        category: 'ENGLISH',
        teachingMode: 'ONLINE',
        defaultSessions: 10,
        defaultSessionDuration: 60,
        pricePerSession: 500_000,
        suggestedPrice: 5_000_000,
        commissionRate: 0,
        isActive: true,
      },
    );

    await applySessionCookies(page.context(), directorSession);

    await page.goto('/app/orders');
    await page.waitForLoadState('networkidle');
    await page.screenshot({
      path: testInfo.outputPath('01-orders-list.png'),
      fullPage: true,
    });

    await page.getByTestId('orders-create-button').click();
    await expect(page.getByTestId('order-form-modal')).toBeVisible();
    await page.waitForTimeout(500);
    await page.screenshot({
      path: testInfo.outputPath('02-order-modal-opened.png'),
      fullPage: true,
    });

    const parentName = page.getByTestId('order-parent-name');
    await parentName.click();
    await parentName.pressSequentially('Le Thi Demo', { delay: 80 });

    const parentPhone = page.getByTestId('order-parent-phone');
    await parentPhone.click();
    await parentPhone.pressSequentially(`09${Date.now().toString().slice(-8)}`, { delay: 60 });

    const studentName = page.getByTestId('order-student-name');
    await studentName.click();
    await studentName.pressSequentially('Hoc Sinh Minh Hoa', { delay: 80 });

    await page.getByTestId('order-item-product-0').selectOption(product._id);
    await expect(page.getByTestId('order-item-price-0')).toHaveValue('500000');
    await expect(page.getByTestId('order-total-amount')).toHaveValue('5000000');

    await page.waitForTimeout(700);
    await page.screenshot({
      path: testInfo.outputPath('03-product-selected-total-5m.png'),
      fullPage: true,
    });

    const discountInput = page.getByTestId('order-discount-amount');
    await discountInput.scrollIntoViewIfNeeded();
    await discountInput.click();
    await discountInput.pressSequentially('500000', { delay: 90 });

    await expect(page.getByTestId('order-final-amount')).toHaveValue('4500000');
    await page.waitForTimeout(700);
    await page.screenshot({
      path: testInfo.outputPath('04-discount-applied-final-4_5m.png'),
      fullPage: true,
    });
  });
});
