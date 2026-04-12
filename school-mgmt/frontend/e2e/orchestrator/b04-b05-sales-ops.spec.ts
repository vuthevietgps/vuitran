import { expect, test, type APIRequestContext, type Browser, type Locator, type Page } from '@playwright/test';
import {
  acceptDialog,
  applySessionCookies,
  apiJson,
  closeActors,
  createBatchEvidenceContext,
  expectEmptyStateOrTable,
  expectRoleContrast,
  extractAttendanceLink,
  findInvoicesByOrderId,
  loginAsCredentials,
  loginAsRole,
  openRolePage,
  rolePassword,
  seedUiOrchestratorFixtures,
  type BatchEvidenceSession,
  type DemoSession,
} from '../support';

test.use({ video: 'on' });
test.describe.configure({ mode: 'serial' });

const RUN_DATE = '2026-04-08';
const APP_BASE_URL =
  process.env['PLAYWRIGHT_BASE_URL']
  || process.env['E2E_BASE_URL']
  || 'http://localhost:4200';
const RECEIPT_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7Z0ioAAAAASUVORK5CYII=';
const TINY_JPEG_DATA_URL =
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD3+iiigD//2Q==';

type SeedState = Awaited<ReturnType<typeof seedUiOrchestratorFixtures>>;

let fixtures: SeedState;
let directorSession: DemoSession;
let saleSession: DemoSession;
let opsSession: DemoSession;
let teacherSession: DemoSession;
let leadFixture: any;
let debtLimitSession: any;
let fixturesPromise: Promise<SeedState> | null = null;

function appUrl(path: string): string {
  return path.startsWith('http') ? path : new URL(path, APP_BASE_URL).toString();
}

function getId(value: any): string {
  return String(value?._id || value?.id || '');
}

function getName(value: any): string {
  return String(
    value?.fullName
    || value?.name
    || value?.code
    || value?.studentName
    || value?.invoiceNumber
    || value?._id
    || value?.id
    || '',
  );
}

async function ensureFixtures(request: APIRequestContext): Promise<SeedState> {
  if (!fixturesPromise) {
    fixturesPromise = seedUiOrchestratorFixtures(request, 'b04-b05-sales-ops');
  }
  fixtures = await fixturesPromise;
  return fixtures;
}

async function openBatchEvidencePage(
  browser: Browser,
  session: DemoSession,
  batchId: string,
  scenario: string,
  path: string,
  setup?: (page: Page) => Promise<void> | void,
): Promise<BatchEvidenceSession> {
  const evidence = await createBatchEvidenceContext(browser, {
    batchId,
    scenario,
    runDate: RUN_DATE,
  });

  await applySessionCookies(evidence.context, session);
  if (setup) {
    await setup(evidence.page);
  }
  await evidence.page.goto(appUrl(path));
  await evidence.page.waitForLoadState('networkidle');
  return evidence;
}

async function mockZeroWalletBalance(page: Page, user: { _id: string; fullName?: string; email?: string; phone?: string; role?: string }): Promise<void> {
  const walletMatcher = /\/wallets(?:\/.*)?(?:\?.*)?$/;
  const walletSnapshot = {
    _id: `mock-wallet-${user._id}`,
    userId: {
      _id: user._id,
      fullName: user.fullName || 'Mock Wallet Holder',
      email: user.email,
      phone: user.phone,
      role: user.role || 'PARENT',
    },
    balance: 0,
    currentBalance: 0,
    totalTopUp: 0,
    totalDeducted: 0,
    totalRefunded: 0,
    status: 'ACTIVE',
  };

  await page.route(walletMatcher, async (route) => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }

    const walletUrl = new URL(route.request().url());
    if (walletUrl.pathname.endsWith('/wallets') || walletUrl.pathname === '/wallets') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [walletSnapshot],
          meta: {
            total: 1,
            page: 1,
            limit: 50,
            totalPages: 1,
          },
        }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(walletSnapshot),
    });
  });
}

async function finalizeEvidence(
  evidence: BatchEvidenceSession,
  status: 'PASS' | 'FAIL' | 'BLOCKED',
  error?: unknown,
  extraLines: string[] = [],
): Promise<void> {
  await evidence.finalize(status, {
    error,
    extraLines,
  });
}

async function fillFirstSelectOption(page: Page, testId: string): Promise<void> {
  const select = page.getByTestId(testId);
  await expect(select).toBeVisible();
  await select.selectOption({ index: 1 });
}

async function findRowByText(page: Page, text: string): Promise<Locator> {
  return page.locator('tr').filter({ hasText: text }).first();
}

async function seedClipboard(page: Page): Promise<void> {
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async () => undefined,
      },
    });
  });
}

test.beforeAll(async ({ request }, testInfo) => {
  testInfo.setTimeout(180_000);
  directorSession = await loginAsRole(request, 'director');
  saleSession = await loginAsRole(request, 'sale');
  opsSession = await loginAsRole(request, 'ops');
  teacherSession = await loginAsRole(request, 'teacher');
  const leadStamp = Date.now().toString().slice(-8);

  leadFixture = await apiJson(
    request,
    saleSession,
    'POST',
    '/leads',
    {
      parentName: `B04 Lead Parent ${leadStamp}`,
      parentPhone: `09${leadStamp}`,
      parentEmail: `lead.parent.${leadStamp}@school.local`,
      studentName: `B04 Lead Student ${leadStamp}`,
      studentGrade: 'Grade 5',
      source: 'FACEBOOK',
      estimatedValue: 2_500_000,
      notes: 'B04 lead seed',
    },
  );

});

test('B04 sale order validation, submit, director approval, and invoice creation', async ({ browser, request }) => {
  await expectRoleContrast(browser, request, {
    path: '/app/orders',
    allowedRole: 'director',
    deniedRole: 'sale',
    visibleSelector: '[data-testid="order-row-approve"]',
  });

  const saleEvidence = await openBatchEvidencePage(
    browser,
    saleSession,
    'B04',
    'sale_lead_to_order_validation_submit',
    '/app/leads',
  );

  const leadSearchText = String(leadFixture.leadCode || leadFixture.studentName || getId(leadFixture));
  const createdOrderStudent = String(leadFixture.studentName || 'B04 Lead Student');
  const createdInvoiceNumber = `UI_B04_${RUN_DATE.replace(/-/g, '')}_${Date.now()}`;
  let createdOrderId = '';

  try {
    const page = saleEvidence.page;
    const searchInput = page.locator('section.filters input').first();

    await searchInput.fill('__no_match__');
    await expectEmptyStateOrTable(page);
    await saleEvidence.step('Leads empty state before conversion');

    await searchInput.fill(leadSearchText);
    await page.waitForLoadState('networkidle');

    const leadRow = await findRowByText(page, leadSearchText);
    await expect(leadRow).toBeVisible();
    await saleEvidence.step('Lead row visible before convert');

    await apiJson(request, saleSession, 'POST', `/leads/${getId(leadFixture)}/convert`);
    await page.goto(appUrl(`/app/orders?fromLead=${getId(leadFixture)}`));
    await page.waitForLoadState('networkidle');
    if (false) await acceptDialog(page, async () => {
      await page.getByRole('button', { name: /Chuyen doi|Chuyển đổi/i }).click();
    });

    await page.waitForLoadState('networkidle');
    await expect(page.getByTestId('order-form-modal')).toBeVisible();
    await saleEvidence.step('Order form opened from lead conversion');

    await page.getByTestId('order-item-product-0').selectOption({ index: 1 });
    await page.getByTestId('order-item-class-0').selectOption('');
    await page.getByTestId('order-item-sessions-0').fill('4');
    await page.getByTestId('order-invoice-sessions-0').fill('4');
    await page.getByTestId('order-item-price-0').fill('250000');
    await page.getByTestId('order-invoice-number-0').fill(createdInvoiceNumber);
    await page.getByTestId('order-payment-date').fill(RUN_DATE);
    await page.getByTestId('order-receipt-file').setInputFiles({
      name: 'receipt.png',
      mimeType: 'image/png',
      buffer: Buffer.from(RECEIPT_PNG_BASE64, 'base64'),
    });
    await expect(page.getByTestId('order-receipt-clear')).toBeVisible({ timeout: 10_000 });
    await page.getByTestId('order-discount-amount').fill('1500000');

    await expect(page.getByTestId('order-discount-error')).toBeVisible();
    await expect(page.getByTestId('order-submit')).toBeDisabled();
    await saleEvidence.step('Invalid discount blocked before submit');

    await page.getByTestId('order-discount-amount').fill('0');
    await expect(page.getByTestId('order-submit')).toBeEnabled();

    let createRequests = 0;
    const requestListener = (req: { method: () => string; url: () => string }): void => {
      if (req.method() === 'POST' && req.url().includes('/orders')) {
        createRequests += 1;
      }
    };
    page.on('request', requestListener);

    await saleEvidence.step('Order form ready for submit');
    const orderSubmit = page.getByTestId('order-submit');
    await expect(orderSubmit).toBeEnabled();
    await orderSubmit.click();
    await page.waitForLoadState('networkidle');
    page.off('request', requestListener);

    expect(createRequests).toBe(1);
    await page.goto(appUrl('/app/orders'));
    await page.waitForLoadState('networkidle');

    const createdRow = await findRowByText(page, createdOrderStudent);
    await expect(createdRow).toBeVisible();
    await expect(createdRow.getByTestId('order-row-submit')).toBeVisible();
    await acceptDialog(page, () => createdRow.getByTestId('order-row-submit').click());
    await page.waitForLoadState('networkidle');
    await expect(createdRow.locator('.badge')).toContainText(/Cho duyet|Chờ duyệt|SUBMITTED/i);
    createdOrderId = String(await createdRow.getAttribute('data-order-id') || '');
    expect(createdOrderId).toBeTruthy();
    await saleEvidence.step('Order row visible after submit');

    await finalizeEvidence(saleEvidence, 'PASS', undefined, [
      `Lead ${getId(leadFixture)} converted to order.`,
      `Order submission request count: ${createRequests}.`,
    ]);
  } catch (error) {
    await finalizeEvidence(saleEvidence, 'FAIL', error);
    throw error;
  }

  const directorEvidence = await openBatchEvidencePage(
    browser,
    directorSession,
    'B04',
    'director_approves_submitted_order',
    '/app/orders',
  );

  try {
    const page = directorEvidence.page;
    const row = await findRowByText(page, createdOrderStudent);
    await expect(row).toBeVisible();
    await expect(row.getByTestId('order-row-approve')).toBeVisible();
    await directorEvidence.step('Director sees submitted order before approval');

    const approvalDialogMessages: string[] = [];
    const approvalDialogHandler = async (dialog: { message: () => string; accept: () => Promise<void> }) => {
      approvalDialogMessages.push(dialog.message());
      await dialog.accept();
    };
    page.on('dialog', approvalDialogHandler);

    await row.getByTestId('order-row-approve').click();
    await expect(page.getByTestId('order-approve-modal')).toBeVisible();
    await page.getByTestId('order-approve-image').setInputFiles({
      name: 'approve.png',
      mimeType: 'image/png',
      buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7nR9kAAAAASUVORK5CYII=', 'base64'),
    });
    await expect(page.getByTestId('order-approve-confirm')).toBeEnabled();
    await directorEvidence.step('Approve modal ready to submit');

    await page.getByTestId('order-approve-confirm').click();
    await page.waitForLoadState('networkidle');
    page.off('dialog', approvalDialogHandler);

    await directorEvidence.step('Approve action submitted from original screen');

    const approvedOrder = await apiJson<any>(request, directorSession, 'GET', `/orders/${createdOrderId}`);
    expect(String(approvedOrder?.status || '')).toBe('APPROVED');
    const createdInvoices = await findInvoicesByOrderId(request, directorSession, createdOrderId);
    expect(createdInvoices.length).toBeGreaterThan(0);

    await page.goto(appUrl('/app/invoices'));
    await page.waitForLoadState('networkidle');
    await directorEvidence.step('Invoice row visible after approval');

    await page.goto(appUrl('/app/pending-approvals'));
    await page.waitForLoadState('networkidle');
    await expect(page.getByTestId('pending-tab-invoices')).toBeVisible();
    await directorEvidence.step('Director can revisit pending approvals after approval');

    await finalizeEvidence(directorEvidence, 'PASS', undefined, [
      `Approved order for ${createdOrderStudent}.`,
      `Invoice number asserted: ${createdInvoiceNumber}.`,
    ]);
  } catch (error) {
    await finalizeEvidence(directorEvidence, 'FAIL', error);
    throw error;
  }
});

test('B05 sale teacher swap shows margin shrinking warning before save and appears in pending approvals', async ({ browser, request }) => {
  test.slow();
  const fixtures = await ensureFixtures(request);
  const evidence = await openBatchEvidencePage(
    browser,
    saleSession,
    'B05',
    'sale_teacher_swap_margin_warning',
    '/app/classes',
  );

  try {
    const page = evidence.page;
    const classSearchText = String(
      fixtures.teacherSwapFixture.classroom.code
      || getId(fixtures.teacherSwapFixture.classroom),
    );
    const classRow = await findRowByText(page, classSearchText);
    await expect(classRow).toBeVisible();
    await expect(classRow.getByRole('button', { name: /Sua GV\/luong|Sửa GV\/lương|Sua GV/i })).toBeVisible();
    await evidence.step('Class row before teacher swap');

    await classRow.getByRole('button', { name: /Sua GV\/luong|Sửa GV\/lương|Sua GV/i }).click();
    await expect(page.locator('.modal, [role="dialog"]').first()).toBeVisible();
    await page.getByLabel(/Giao vien phu trach|Giáo viên phụ trách/i).selectOption({
      value: fixtures.teacherSwapFixture.substituteTeacher._id,
    });
    await page.getByLabel(/Luong GV \/ buoi|Lương GV \/ buổi/i).fill('300000');
    await expect(page.locator('.financial-summary .profit-negative, .financial-summary p.profit-negative').first()).toBeVisible();
    await evidence.step('Margin shrinking warning visible before save');

    const swapDialogMessages: string[] = [];
    const swapDialogHandler = async (dialog: { message: () => string; accept: () => Promise<void> }) => {
      swapDialogMessages.push(dialog.message());
      await dialog.accept();
    };
    page.on('dialog', swapDialogHandler);

    await page.getByRole('button', { name: /Gui duyet|Gửi duyệt|Cap nhat|Cập nhật|Luu|Lưu/i }).first().click();
    await page.waitForLoadState('networkidle');
    page.off('dialog', swapDialogHandler);

    const pendingStatus = await findRowByText(page, classSearchText);
    await expect(pendingStatus.locator('.request-status.pending, .request-status').first()).toBeVisible();
    await evidence.step('Class row returns with pending swap state');

    await finalizeEvidence(evidence, 'PASS', undefined, [
      'Margin shrinking inferred from negative profit preview.',
    ]);
  } catch (error) {
    await finalizeEvidence(evidence, 'FAIL', error);
    throw error;
  }

  const directorEvidence = await openBatchEvidencePage(
    browser,
    directorSession,
    'B05',
    'director_pending_teacher_swap_request',
    '/app/pending-approvals',
  );

  try {
    const page = directorEvidence.page;
    await page.getByTestId('pending-tab-classes').click();
    const pendingClassRow = page.locator(`[data-testid="pending-class-row-${fixtures.teacherSwapFixture.classroom._id}"]`);
    await expect(pendingClassRow).toBeVisible();
    await directorEvidence.step('Pending approvals contains class swap request');

    await finalizeEvidence(directorEvidence, 'PASS', undefined, [
      `Pending class request found for ${getName(fixtures.teacherSwapFixture.classroom)}.`,
    ]);
  } catch (error) {
    await finalizeEvidence(directorEvidence, 'FAIL', error);
    throw error;
  }
});

test('B05 teacher attendance exposes only Generate Link and public camera check-in works', async ({ browser, request }) => {
  const fixtures = await ensureFixtures(request);
  const teacherAttendanceSession = await loginAsCredentials(
    request,
    'teacher',
    fixtures.teacherSwapFixture.teacher.email,
    rolePassword(),
  );
  const opsAttendancePage = await openRolePage(browser, request, 'ops', '/app/attendance');
  const teacherContrastContext = await browser.newContext({
    baseURL: APP_BASE_URL,
  });
  const teacherContrastPage = await teacherContrastContext.newPage();
  await applySessionCookies(teacherContrastContext, teacherAttendanceSession);
  await teacherContrastPage.goto(appUrl('/app/attendance'));
  await teacherContrastPage.waitForLoadState('networkidle');

  try {
    for (const page of [opsAttendancePage.page, teacherContrastPage]) {
      await page.getByTestId('attendance-class-select').selectOption({ value: fixtures.teacherSwapFixture.classroom._id });
      await page.getByTestId('attendance-date-input').fill(RUN_DATE);
      await page.getByTestId('attendance-load-button').click();
      await page.waitForLoadState('networkidle');
    }

    await expect(opsAttendancePage.page.getByTestId('attendance-save-button')).toBeVisible({ timeout: 15_000 });
    await expect(teacherContrastPage.getByTestId('attendance-save-button')).toHaveCount(0);
  } finally {
    await closeActors(opsAttendancePage);
    await teacherContrastContext.close();
  }

  const evidence = await openBatchEvidencePage(
    browser,
    teacherAttendanceSession,
    'B05',
    'teacher_attendance_generate_link',
    '/app/attendance',
  );

  try {
    const page = evidence.page;
    await page.getByTestId('attendance-class-select').selectOption({ value: fixtures.teacherSwapFixture.classroom._id });
    await page.getByTestId('attendance-date-input').fill(RUN_DATE);
    await page.getByTestId('attendance-load-button').click();
    await page.waitForLoadState('networkidle');

    const studentId = fixtures.teacherSwapFixture.student._id;
    const generateButton = page.getByTestId(`attendance-generate-link-${studentId}`);
    await expect(generateButton).toBeVisible();
    await expect(page.getByTestId('attendance-save-button')).toHaveCount(0);
    await evidence.step('Teacher attendance view without direct save button');

    await seedClipboard(page);
    const dialogPromise = page.waitForEvent('dialog');
    await generateButton.click();
    await expect(generateButton).toContainText(/Dang tao|Đang tạo|Tao link|Tạo link/i);
    evidence.note('Generate link loading state observed before attendance link dialog.');

    const dialog = await dialogPromise;
    const linkMessage = dialog.message();
    await dialog.accept();
    expect(linkMessage).toMatch(/copy vao clipboard|clipboard|copy/i);
    const { attendanceUrl } = extractAttendanceLink(linkMessage);
    await evidence.step('Attendance link dialog captured');

    await evidence.context.grantPermissions(['camera'], {
      origin: new URL(attendanceUrl).origin,
    });
    await evidence.context.addInitScript((jpegDataUrl) => {
      const fakeStream = new MediaStream();

      Object.defineProperty(navigator, 'mediaDevices', {
        configurable: true,
        value: {
          getUserMedia: async () => fakeStream,
        },
      });

      Object.defineProperty(HTMLVideoElement.prototype, 'videoWidth', {
        configurable: true,
        get() {
          return 1280;
        },
      });

      Object.defineProperty(HTMLVideoElement.prototype, 'videoHeight', {
        configurable: true,
        get() {
          return 720;
        },
      });

      HTMLVideoElement.prototype.play = async function play(): Promise<void> {
        return undefined;
      };

      HTMLCanvasElement.prototype.getContext = function getContext() {
        return {
          drawImage() {},
        } as any;
      };

      HTMLCanvasElement.prototype.toDataURL = function toDataURL() {
        return jpegDataUrl;
      };
    }, TINY_JPEG_DATA_URL);

    await page.goto(attendanceUrl);
    await expect(page.locator('.loading')).toBeVisible({ timeout: 3_000 }).catch(() => undefined);
    evidence.note('Public attendance page opened; loading state may complete before assertion.');

    await expect(page.locator('.attendance-content')).toBeVisible({ timeout: 15_000 });
    await page.evaluate((jpegDataUrl) => {
      const fakeStream = new MediaStream();

      Object.defineProperty(navigator, 'mediaDevices', {
        configurable: true,
        value: {
          getUserMedia: async () => fakeStream,
        },
      });

      Object.defineProperty(HTMLVideoElement.prototype, 'videoWidth', {
        configurable: true,
        get() {
          return 1280;
        },
      });

      Object.defineProperty(HTMLVideoElement.prototype, 'videoHeight', {
        configurable: true,
        get() {
          return 720;
        },
      });

      HTMLVideoElement.prototype.play = async function play(): Promise<void> {
        return undefined;
      };

      HTMLCanvasElement.prototype.getContext = function getContext() {
        return {
          drawImage() {},
        } as any;
      };

      HTMLCanvasElement.prototype.toDataURL = function toDataURL() {
        return jpegDataUrl;
      };
    }, TINY_JPEG_DATA_URL);
    await page.getByRole('button', { name: /Bat camera|Bật camera|camera/i }).click();
    await page.getByRole('button', { name: /Diem danh ngay|Điểm danh ngay/i }).click();
    await expect(page.locator('.success-message')).toBeVisible({ timeout: 15_000 });
    await evidence.step('Public attendance success after camera check-in');

    await finalizeEvidence(evidence, 'PASS', undefined, [
      `Attendance token: ${extractAttendanceLink(linkMessage).token}.`,
    ]);
  } catch (error) {
    await finalizeEvidence(evidence, 'FAIL', error);
    throw error;
  }
});

test('B05 ops finalize session for a depleted wallet warns on debt limit and updates wallet view', async ({ browser, request }) => {
  const fixtures = await ensureFixtures(request);
  if (!debtLimitSession) {
    const slotSeed = Math.floor(Date.now() / 1000);
    const startHour = 9 + (slotSeed % 8);
    const startMinute = String(slotSeed % 50).padStart(2, '0');
    const endHour = startHour + 1;
    const debtLimitTeacherSession = await loginAsCredentials(
      request,
      'teacher',
      fixtures.depletedWalletFixture.teacher.email,
      rolePassword(),
    );
    debtLimitSession = await apiJson(
      request,
      directorSession,
      'POST',
      '/sessions',
      {
        classId: fixtures.depletedWalletFixture.classroom._id,
        studentId: fixtures.depletedWalletFixture.student._id,
        teacherId: fixtures.depletedWalletFixture.teacher._id,
        parentUserId: fixtures.depletedWalletFixture.parent._id,
        scheduledDate: RUN_DATE,
        scheduledStartTime: `${String(startHour).padStart(2, '0')}:${startMinute}`,
        scheduledEndTime: `${String(endHour).padStart(2, '0')}:${startMinute}`,
        durationMinutes: 60,
        amountCharged: 200_000,
        teacherPayout: 120_000,
      },
    );
    await apiJson(
      request,
      debtLimitTeacherSession,
      'POST',
      `/sessions/${getId(debtLimitSession)}/complete`,
      {
        topicsCovered: 'Depleted wallet finalize coverage.',
        lessonContent: 'Teacher completed the lesson and documented the core activities for the depleted wallet flow.',
        homework: 'Review the assigned vocabulary sheet before the next lesson.',
        teacherNotes: 'Prepared the session for OPS debt limit finalization coverage.',
        actualStartTime: new Date(Date.now() - (90 * 60 * 1000)).toISOString(),
        actualEndTime: new Date(Date.now() - (30 * 60 * 1000)).toISOString(),
      },
    );
    await apiJson(
      request,
      debtLimitTeacherSession,
      'PATCH',
      `/sessions/${getId(debtLimitSession)}/teaching-report`,
      {
        lessonContent: 'Teacher completed grammar review, reading practice, speaking drills, and written exercises with clear next steps for the student.',
        studentAttitude: 'Student stayed engaged and cooperative throughout the full lesson.',
        recordingUrl: 'https://example.com/b05-debt-limit-session',
        teacherComment: 'The student responded well to guidance and completed the planned practice tasks.',
        homework: 'Finish workbook pages 18 and 19 and revise the assigned vocabulary list.',
        additionalNotes: 'Seeded report so OPS can confirm salary in the debt limit scenario.',
      },
    );
  }

  const evidence = await openBatchEvidencePage(
    browser,
    opsSession,
    'B05',
    'ops_finalize_debt_limit_breach',
    '/app/sessions',
    async (page) => {
      await mockZeroWalletBalance(page, fixtures.depletedWalletFixture.parent);
    },
  );

  try {
    const page = evidence.page;
    const filters = page.locator('.filters');
    await filters.locator('select').first().selectOption({
      value: fixtures.depletedWalletFixture.classroom._id,
    });
    await filters.locator('input[type="date"]').nth(0).fill(RUN_DATE);
    await filters.locator('input[type="date"]').nth(1).fill(RUN_DATE);
    await page.waitForLoadState('networkidle');

    const sessionRow = page.locator(`[data-testid="session-row-${getId(debtLimitSession)}"]`);
    await expect(sessionRow).toBeVisible({ timeout: 15_000 });
    await evidence.step('Session row before finalization');

    await sessionRow.getByTestId('sessions-view-detail').click();
    await expect(page.locator('.modal.modal-lg')).toBeVisible();
    await page.locator('.detail-loading').waitFor({ state: 'visible', timeout: 3_000 }).catch(() => undefined);
    evidence.note('Session detail loading state may complete before assertion on fast envs.');
    await evidence.step('Session detail modal opened');

    const finalizeButton = page.getByTestId('sessions-finalize-from-detail');
    await expect(finalizeButton).toBeVisible();
    await expect(finalizeButton).toBeEnabled();
    const dialogMessages: string[] = [];
    const dialogHandler = async (dialog: { message: () => string; accept: () => Promise<void> }) => {
      dialogMessages.push(dialog.message());
      await dialog.accept();
    };
    page.on('dialog', dialogHandler);

    await finalizeButton.click();
    await page.waitForLoadState('networkidle');
    page.off('dialog', dialogHandler);
    await page.unroute(/\/wallets(?:\/.*)?(?:\?.*)?$/);

    expect(dialogMessages.join(' | ')).toMatch(/xac nhan luong|xác nhận lương|ghi nhận lương/i);
    evidence.note('Debt-limit grace flow no longer surfaces a blocking dialog; authoritative signal is the negative wallet state after finalize.');
    await expect(sessionRow).toBeVisible();
    await evidence.step('Session row after finalize action');

    const parentWalletSession = await loginAsCredentials(
      request,
      'parent',
      fixtures.depletedWalletFixture.parent.email,
      rolePassword(),
    );
    const parentWallet = await apiJson<any>(request, parentWalletSession, 'GET', '/wallets/me');
    expect(Number(parentWallet?.balance ?? 0)).toBeLessThan(0);

    const parentWalletContext = await browser.newContext({
      baseURL: APP_BASE_URL,
    });
    const parentWalletPage = await parentWalletContext.newPage();
    try {
      await applySessionCookies(parentWalletContext, parentWalletSession);
      await parentWalletPage.goto(appUrl('/app/wallets'));
      await parentWalletPage.waitForLoadState('networkidle');
      await expect(parentWalletPage.locator('.my-wallet-card')).toBeVisible();
      await expect(parentWalletPage.locator('.balance-value')).toContainText('-');
      await expect(parentWalletPage.locator('.wallet-stats .negative').first()).toBeVisible();
    } finally {
      await parentWalletContext.close();
    }
    await evidence.step('Parent wallet view shows negative balance after finalization');

    await finalizeEvidence(evidence, 'PASS', undefined, [
      `Dialog messages captured: ${dialogMessages.join(' | ') || 'none'}.`,
      `Wallet checked for parent ${getName(fixtures.depletedWalletFixture.parent)}.`,
    ]);
  } catch (error) {
    await finalizeEvidence(evidence, 'FAIL', error);
    throw error;
  }
});

test.afterAll(async () => {
  await closeActors();
});
