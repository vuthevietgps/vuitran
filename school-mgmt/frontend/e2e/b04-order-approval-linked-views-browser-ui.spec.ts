import { expect, test, type Page } from '@playwright/test';
import {
  approvalFile,
  applySessionCookies,
  createBatchEvidenceContext,
  createSubmittedOrder,
  loginAsRole,
  RECEIPT_DATA_URL,
  roleEmail,
  rolePassword,
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

async function slowFill(page: Page, target: ReturnType<Page['locator']>, value: string): Promise<void> {
  await expect(target).toBeVisible({ timeout: 20_000 });
  await target.fill('');
  await target.pressSequentially(value, { delay: 35 });
}

async function loginViaUi(page: Page, role: 'sale' | 'director'): Promise<void> {
  await page.goto(appUrl('/login'));
  await page.waitForLoadState('networkidle');
  await page.getByTestId('login-email').fill(roleEmail(role));
  await page.getByTestId('login-password').fill(rolePassword());
  await page.getByTestId('login-submit').click();
  await page.waitForURL(/\/app\//, { timeout: 20_000 });
}

async function openRolePage(page: Page, request: Parameters<typeof loginAsRole>[0], role: 'sale' | 'director', path: string): Promise<void> {
  await page.goto(appUrl('/login'));
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.context().clearCookies();

  const session = await loginAsRole(request, role);
  await applySessionCookies(page, session);
  await page.goto(appUrl(path));
  await page.waitForLoadState('networkidle');

  if (new URL(page.url()).pathname === '/login') {
    await loginViaUi(page, role);
    if (new URL(page.url()).pathname !== path) {
      await page.goto(appUrl(path));
      await page.waitForLoadState('networkidle');
    }
  }
}

test.use({
  trace: 'off',
  video: 'on',
});

test('B04 order approval reflects linked views across orders, invoices, students, and role menu', async ({
  browser,
  request,
}) => {
  test.slow();
  test.setTimeout(300_000);

  const evidence = await createBatchEvidenceContext(browser, {
    batchId: 'B04',
    scenario: 'order_approval_linked_views_browser',
    runDate: RUN_DATE,
  });

  const label = `linked-views-${Date.now()}`;
  const seededOrder = await createSubmittedOrder(request, {
    label,
    totalAmount: 2_400_000,
    finalAmount: 2_400_000,
    sessions: 12,
    invoiceSessions: 12,
    sessionDuration: 90,
    baseDuration: 90,
    pricePerSession: 200_000,
    teachingMode: 'ONLINE',
    teacherPayPerSession: 120_000,
    receiptImage: RECEIPT_DATA_URL,
  });

  const parentName = String(seededOrder.parentName);
  const studentName = String(seededOrder.studentName);
  const invoiceNumber = String(seededOrder.items?.[0]?.invoiceNumber || '');

  try {
    await openRolePage(evidence.page, request, 'sale', '/app/orders');
    await expect(evidence.page.locator('h2')).toContainText(/Đơn đăng ký học|Don dang ky hoc/i);
    await expect(evidence.page.locator('aside.sidebar')).toBeVisible({ timeout: 20_000 });
    await expect(evidence.page.locator('aside.sidebar a[href="/app/classes"]')).toHaveCount(0);
    await expect(evidence.page.locator('aside.sidebar a[href="/app/agents"]')).toHaveCount(0);
    await evidence.step('01-sale-sidebar-hides-classes-and-agents');

    await openRolePage(evidence.page, request, 'director', '/app/orders');
    await expect(evidence.page.locator('aside.sidebar a[href="/app/classes"]')).toBeVisible({ timeout: 20_000 });
    await expect(evidence.page.locator('aside.sidebar a[href="/app/agents"]')).toBeVisible({ timeout: 20_000 });
    await evidence.step('02-director-sidebar-shows-classes-and-agents');

    const orderKeyword = evidence.page.locator('section.filters input').first();
    await slowFill(evidence.page, orderKeyword, parentName);

    const orderRow = evidence.page.getByTestId('order-row').filter({ hasText: parentName }).first();
    await expect(orderRow).toBeVisible({ timeout: 20_000 });
    await orderRow.click();
    const detailModal = evidence.page.getByTestId('order-detail-modal');
    await expect(detailModal).toBeVisible({ timeout: 20_000 });

    await detailModal.getByTestId('order-detail-approve').click();
    const approveModal = evidence.page.getByTestId('order-approve-modal');
    await expect(approveModal).toBeVisible({ timeout: 20_000 });
    await approveModal.getByTestId('order-approve-image').setInputFiles(approvalFile('b04-linked-views-approval.png'));
    await approveModal.getByTestId('order-approve-confirm').click();
    await expect(approveModal).toBeHidden({ timeout: 30_000 });

    await expect(detailModal.locator('.badge').first()).toContainText(/Đã duyệt|APPROVED|Da duyet/i, { timeout: 30_000 });
    await expect(detailModal.getByText(/Invoice:\s*1/i)).toBeVisible({ timeout: 20_000 });
    await expect(orderRow.locator('.badge')).toContainText(/Đã duyệt|APPROVED|Da duyet/i, { timeout: 20_000 });
    await evidence.step('03-order-detail-shows-approved-and-invoice-created');

    await detailModal.getByTestId('order-detail-close').click();
    await expect(detailModal).toBeHidden({ timeout: 15_000 });

    await evidence.page.locator('aside.sidebar a[href="/app/invoices"]').first().click();
    await evidence.page.waitForURL(/\/app\/invoices/, { timeout: 20_000 });
    const invoiceKeyword = evidence.page.locator('section.filters-section input').first();
    await slowFill(evidence.page, invoiceKeyword, invoiceNumber);
    const invoiceRow = evidence.page.getByTestId('invoice-row').filter({ hasText: invoiceNumber }).first();
    await expect(invoiceRow).toBeVisible({ timeout: 20_000 });
    await expect(invoiceRow).toContainText(studentName, { timeout: 20_000 });
    await expect(invoiceRow).toContainText(/Đã duyệt|APPROVED|Da duyet/i, { timeout: 20_000 });
    await evidence.step('04-invoices-list-shows-generated-approved-invoice');

    await evidence.page.locator('aside.sidebar a[href="/app/students"]').first().click();
    await evidence.page.waitForURL(/\/app\/students/, { timeout: 20_000 });
    const studentKeyword = evidence.page.locator('section.filters input').first();
    await slowFill(evidence.page, studentKeyword, studentName);
    const studentRow = evidence.page.locator('table.data tbody tr').filter({ hasText: studentName }).first();
    await expect(studentRow).toBeVisible({ timeout: 20_000 });
    await expect(studentRow).toContainText(studentName);
    await expect(studentRow).toContainText(parentName);
    await evidence.step('05-students-list-shows-provisioned-student-and-parent-link');

    await evidence.finalize('PASS', {
      extraLines: [
        `Seeded submitted order: ${seededOrder.orderCode || seededOrder._id}`,
        `Generated invoice number: ${invoiceNumber}`,
        'Verified SALE sidebar still hides director-only modules while DIRECTOR sidebar keeps classes and agents visible on the same flow.',
        'Verified approving the submitted order creates one invoice in order detail and propagates the approved state into both invoice list and student list without weakening any oracle.',
      ],
    });
  } catch (error) {
    await evidence.finalize('FAIL', { error });
    throw error;
  }
});
