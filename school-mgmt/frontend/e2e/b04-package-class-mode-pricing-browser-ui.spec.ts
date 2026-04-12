import { expect, test, type APIRequestContext, type Locator } from '@playwright/test';
import {
  apiJson,
  applySessionCookies,
  createBatchEvidenceContext,
  ensureSaleAccount,
  ensureTeacherAccount,
  getOrderById,
  loginAsRole,
} from './support';

const APP_BASE_URL =
  process.env['PLAYWRIGHT_BASE_URL'] ||
  process.env['E2E_BASE_URL'] ||
  'http://localhost:4200';

const RUN_DATE =
  process.env['UI_EVIDENCE_DATE'] ||
  process.env['E2E_RUN_DATE'] ||
  '2026-04-11';

function appUrl(path: string): string {
  return new URL(path, APP_BASE_URL).toString();
}

function uniqueDigits(length = 8): string {
  return `${Date.now()}${Math.floor(Math.random() * 10000)}`
    .replace(/\D/g, '')
    .slice(-length);
}

function uniquePhone(): string {
  return `09${uniqueDigits(8)}`;
}

function digitsOnly(value: string | null | undefined): string {
  return String(value || '').replace(/\D/g, '');
}

async function expectMoneyText(locator: Locator, amount: number): Promise<void> {
  await expect.poll(async () => digitsOnly(await locator.innerText())).toBe(String(amount));
}

async function createProduct(
  request: APIRequestContext,
  directorSession: Awaited<ReturnType<typeof loginAsRole>>,
  options: {
    label: string;
    suffix: string;
    name: string;
    codePrefix: string;
    category: 'ENGLISH' | 'MATH';
    teachingMode: 'ONLINE' | 'OFFLINE';
    defaultSessions: number;
    defaultSessionDuration: number;
    pricePerSession: number;
    suggestedPrice: number;
  },
): Promise<any> {
  return apiJson<any>(request, directorSession, 'POST', '/products', {
    name: `${options.name} ${options.label}`,
    code: `${options.codePrefix}${uniqueDigits(8)}`,
    description: `B04 ${options.suffix} product fixture ${options.label}`,
    category: options.category,
    teachingMode: options.teachingMode,
    defaultSessions: options.defaultSessions,
    defaultSessionDuration: options.defaultSessionDuration,
    pricePerSession: options.pricePerSession,
    suggestedPrice: options.suggestedPrice,
    commissionRate: 0,
    isActive: true,
  });
}

async function createClassFixture(
  request: APIRequestContext,
  directorSession: Awaited<ReturnType<typeof loginAsRole>>,
  options: {
    label: string;
    suffix: string;
    teacherId: string;
    saleId: string;
    productId: string;
    classMode: 'ONLINE' | 'OFFLINE';
    subject: string;
    pricePerSession: number;
    teacherPayPerSession?: number;
    teacherPayPerStudent?: number;
    baseDuration: number;
    sessionDuration: number;
    maxStudents: number;
  },
): Promise<any> {
  return apiJson<any>(request, directorSession, 'POST', '/classes', {
    name: `E2E ${options.suffix} Class ${options.label}`,
    code: `CLS${uniqueDigits(8)}`,
    teacherId: options.teacherId,
    saleId: options.saleId,
    classMode: options.classMode,
    productPackageId: options.productId,
    studentIds: [],
    subject: options.subject,
    learningGoals: `B04 ${options.suffix} order pricing fixture`,
    pricePerSession: options.pricePerSession,
    teacherPayPerSession: options.teacherPayPerSession || 0,
    teacherPayPerStudent: options.teacherPayPerStudent || 0,
    baseDuration: options.baseDuration,
    sessionDuration: options.sessionDuration,
    maxStudents: options.maxStudents,
  });
}

test.use({
  trace: 'off',
  video: 'on',
});

test('B04 package, class, teaching mode, and pricing stay exact from form selection through draft detail reopen', async ({
  browser,
  request,
}) => {
  test.slow();
  test.setTimeout(300_000);

  const evidence = await createBatchEvidenceContext(browser, {
    batchId: 'B04',
    scenario: 'package_class_mode_pricing_browser',
    runDate: RUN_DATE,
  });

  const directorSession = await loginAsRole(request, 'director');
  const label = `pkg-class-price-${Date.now()}`;
  const [sale, teacher] = await Promise.all([
    ensureSaleAccount(request, directorSession, label),
    ensureTeacherAccount(request, directorSession, label),
  ]);

  const onlineProduct = await createProduct(request, directorSession, {
    label,
    suffix: 'online',
    name: 'E2E Order Online',
    codePrefix: 'E2EONL',
    category: 'ENGLISH',
    teachingMode: 'ONLINE',
    defaultSessions: 10,
    defaultSessionDuration: 60,
    pricePerSession: 180_000,
    suggestedPrice: 0,
  });

  const offlineProduct = await createProduct(request, directorSession, {
    label,
    suffix: 'offline',
    name: 'E2E Order Offline',
    codePrefix: 'E2EOFF',
    category: 'MATH',
    teachingMode: 'OFFLINE',
    defaultSessions: 8,
    defaultSessionDuration: 60,
    pricePerSession: 200_000,
    suggestedPrice: 0,
  });

  const onlineClass = await createClassFixture(request, directorSession, {
    label,
    suffix: 'online',
    teacherId: teacher._id,
    saleId: sale._id,
    productId: onlineProduct._id,
    classMode: 'ONLINE',
    subject: 'English 1-1',
    pricePerSession: 180_000,
    teacherPayPerSession: 120_000,
    baseDuration: 60,
    sessionDuration: 60,
    maxStudents: 1,
  });

  const offlineClass = await createClassFixture(request, directorSession, {
    label,
    suffix: 'offline',
    teacherId: teacher._id,
    saleId: sale._id,
    productId: offlineProduct._id,
    classMode: 'OFFLINE',
    subject: 'Toan Lop Nhom',
    pricePerSession: 200_000,
    teacherPayPerStudent: 70_000,
    baseDuration: 60,
    sessionDuration: 90,
    maxStudents: 6,
  });

  const parentName = `E2E Parent ${label}`;
  const parentPhone = uniquePhone();
  const studentName = `E2E Student ${label}`;

  try {
    await applySessionCookies(evidence.page, directorSession);
    await evidence.page.goto(appUrl('/app/orders'));
    await evidence.page.waitForLoadState('networkidle');

    await expect(evidence.page.locator('h2')).toContainText(/Don dang ky|Đơn đăng ký/i);

    await evidence.page.getByTestId('orders-create-button').click();
    const formModal = evidence.page.getByTestId('order-form-modal');
    await expect(formModal).toBeVisible({ timeout: 20_000 });

    await formModal.getByTestId('order-parent-name').fill(parentName);
    await formModal.getByTestId('order-parent-phone').fill(parentPhone);
    await formModal.getByTestId('order-student-name').fill(studentName);

    const saleSelect = formModal.getByTestId('order-sale');
    if (await saleSelect.isVisible()) {
      await saleSelect.selectOption(sale._id);
    }

    const productSelect = formModal.getByTestId('order-item-product-0');
    const classSelect = formModal.getByTestId('order-item-class-0');

    await productSelect.selectOption(onlineProduct._id);
    await expect(formModal.getByTestId('order-item-mode-0')).toHaveValue('ONLINE');
    await expect(formModal.getByTestId('order-item-sessions-0')).toHaveValue('10');
    await expect(formModal.getByTestId('order-invoice-sessions-0')).toHaveValue('10');
    await expect(formModal.getByTestId('order-item-duration-0')).toHaveValue('60');
    await expect(formModal.getByTestId('order-item-base-duration-0')).toHaveValue('60');
    await expect(formModal.getByTestId('order-item-price-0')).toHaveValue('180000');
    await expect(formModal.getByTestId('order-item-suggested-0')).toHaveValue('1800000');
    await expect(formModal.getByTestId('order-invoice-amount-0')).toHaveValue('1800000');
    await expect(formModal.getByTestId('order-total-amount')).toHaveValue('1800000');
    await expect(classSelect.locator(`option[value="${onlineClass._id}"]`)).toHaveCount(1);
    await expect(classSelect.locator(`option[value="${offlineClass._id}"]`)).toHaveCount(0);
    await evidence.step('01-online-package-keeps-online-mode-and-only-online-class-options');

    await productSelect.selectOption(offlineProduct._id);
    await expect(formModal.getByTestId('order-item-mode-0')).toHaveValue('OFFLINE');
    await expect(formModal.getByTestId('order-item-sessions-0')).toHaveValue('8');
    await expect(formModal.getByTestId('order-invoice-sessions-0')).toHaveValue('8');
    await expect(formModal.getByTestId('order-item-duration-0')).toHaveValue('60');
    await expect(formModal.getByTestId('order-item-base-duration-0')).toHaveValue('60');
    await expect(formModal.getByTestId('order-item-price-0')).toHaveValue('200000');
    await expect(formModal.getByTestId('order-item-suggested-0')).toHaveValue('1600000');
    await expect(formModal.getByTestId('order-invoice-amount-0')).toHaveValue('1600000');
    await expect(formModal.getByTestId('order-total-amount')).toHaveValue('1600000');
    await expect(classSelect.locator(`option[value="${offlineClass._id}"]`)).toHaveCount(1);
    await expect(classSelect.locator(`option[value="${onlineClass._id}"]`)).toHaveCount(0);
    await evidence.step('02-offline-package-flips-mode-and-filters-class-options-by-product-and-mode');

    await classSelect.selectOption(offlineClass._id);
    await expect(formModal.getByTestId('order-item-mode-0')).toHaveValue('OFFLINE');
    await expect(formModal.getByTestId('order-item-subject-0')).toHaveValue('Toan Lop Nhom');
    await expect(formModal.getByTestId('order-item-teacher-0')).toHaveValue(teacher._id);
    await expect(formModal.getByTestId('order-item-price-0')).toHaveValue('200000');
    await expect(formModal.getByTestId('order-item-base-duration-0')).toHaveValue('60');
    await expect(formModal.getByTestId('order-item-duration-0')).toHaveValue('90');
    await expect(formModal.getByTestId('order-item-teacher-pay-student-0')).toHaveValue('70000');
    await expect(formModal.getByTestId('order-item-max-students-0')).toHaveValue('6');
    await expect(formModal.getByTestId('order-invoice-amount-0')).toHaveValue('2400000');
    await expect(formModal.getByTestId('order-total-amount')).toHaveValue('2400000');
    await expect(formModal.getByTestId('order-final-amount')).toHaveValue('2400000');
    await evidence.step('03-selecting-offline-class-backfills-teacher-duration-and-pricing-exactly');

    await formModal.getByTestId('order-submit').click();
    await expect(formModal).toBeHidden({ timeout: 20_000 });

    const orderRow = evidence.page.getByTestId('order-row').filter({ hasText: parentPhone }).first();
    await expect(orderRow).toBeVisible({ timeout: 20_000 });
    await expect(orderRow.locator('.badge')).toContainText(/Nhap|Nháp|DRAFT/i);
    await expectMoneyText(orderRow.getByTestId('order-row-invoice-amount'), 2_400_000);

    const orderId = await orderRow.getAttribute('data-order-id');
    const orderCode = await orderRow.getAttribute('data-order-code');
    expect(orderId).toBeTruthy();
    expect(orderCode).toBeTruthy();

    const createdOrder = await getOrderById(request, directorSession, String(orderId));
    expect(createdOrder.status).toBe('DRAFT');
    expect(createdOrder.totalAmount).toBe(2_400_000);
    expect(createdOrder.finalAmount).toBe(2_400_000);
    expect(createdOrder.items?.[0]?.productId).toBe(offlineProduct._id);
    expect(createdOrder.items?.[0]?.selectedClassId).toBe(offlineClass._id);
    expect(createdOrder.items?.[0]?.preferredTeacherId).toBe(teacher._id);
    expect(createdOrder.items?.[0]?.teachingMode).toBe('OFFLINE');
    expect(createdOrder.items?.[0]?.pricePerSession).toBe(200_000);
    expect(createdOrder.items?.[0]?.sessionDuration).toBe(90);
    expect(createdOrder.items?.[0]?.baseDuration).toBe(60);
    expect(createdOrder.items?.[0]?.teacherPayPerStudent).toBe(70_000);
    expect(createdOrder.items?.[0]?.maxStudents).toBe(6);
    expect(createdOrder.items?.[0]?.amount).toBe(2_400_000);

    await evidence.page.goto(appUrl(`/app/orders?orderId=${orderId}`));
    await evidence.page.waitForLoadState('networkidle');

    const detailModal = evidence.page.getByTestId('order-detail-modal');
    await expect(detailModal).toBeVisible({ timeout: 20_000 });
    await expect(detailModal).toContainText(String(orderCode));
    await expect(detailModal).toContainText(offlineClass.code);
    await expect(detailModal).toContainText(offlineClass.name);
    await expect(detailModal).toContainText(teacher.fullName);
    await expect(detailModal).toContainText(/OFFLINE/);
    await expect(detailModal.getByTestId('order-detail-item-sessions-0')).toContainText('8');
    await expect(detailModal.getByTestId('order-detail-item-invoice-sessions-0')).toContainText('8');
    await expectMoneyText(detailModal.getByTestId('order-detail-invoice-amount'), 2_400_000);
    await evidence.step('04-draft-order-reopen-keeps-package-class-mode-and-pricing-without-drift');

    await evidence.finalize('PASS', {
      extraLines: [
        `Created order: ${orderCode}`,
        `Online class hidden after offline package select: ${onlineClass.code}`,
        `Offline class applied with exact persisted pricing: ${offlineClass.code}`,
        'Verified product selection flips teaching mode and recalculates exact amounts, class options stay filtered by product + mode, and selecting the class persists the exact teacher, duration, class, and 2,400,000d invoice amount after detail reopen.',
      ],
    });
  } catch (error) {
    await evidence.finalize('FAIL', { error });
    throw error;
  }
});
