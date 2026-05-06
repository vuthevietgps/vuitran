import { expect, test, type APIRequestContext, type Locator, type Page } from '@playwright/test';
import {
  acceptDialog,
  apiJson,
  applySessionCookies,
  createBatchEvidenceContext,
  extractAttendanceLink,
  findInvoicesByOrderId,
  getOrderById,
  getSessionById,
  getWalletBalanceByUserId,
  getSales,
  loginAsCredentials,
  loginAsRole,
  orderRow,
  roleEmail,
  rolePassword,
  uniquePhone,
} from './support';

const APP_BASE_URL =
  process.env['PLAYWRIGHT_BASE_URL']
  || process.env['E2E_BASE_URL']
  || 'http://localhost:4200';

const RUN_DATE =
  process.env['UI_EVIDENCE_DATE']
  || process.env['E2E_RUN_DATE']
  || '2026-04-14';

const PARENT_PASSWORD = '123456';

type TrialFixture = {
  product: any;
  teacher: any;
  classroom: any;
  sale: any;
};

function appUrl(path: string): string {
  return new URL(path, APP_BASE_URL).toString();
}

function uniqueDigits(length = 8): string {
  return `${Date.now()}${Math.floor(Math.random() * 10000)}`.slice(-length);
}

async function installOverlay(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const LABEL_ID = '__codex_video_label';

    const ensureOverlay = () => {
      if (!document.body) return;

      let label = document.getElementById(LABEL_ID) as HTMLDivElement | null;
      if (!label) {
        label = document.createElement('div');
        label.id = LABEL_ID;
        label.style.position = 'fixed';
        label.style.left = '24px';
        label.style.bottom = '24px';
        label.style.maxWidth = '760px';
        label.style.padding = '12px 16px';
        label.style.borderRadius = '14px';
        label.style.background = 'rgba(15, 23, 42, 0.86)';
        label.style.color = '#e2e8f0';
        label.style.font = '600 15px/1.45 "Segoe UI", system-ui, sans-serif';
        label.style.boxShadow = '0 20px 44px rgba(15, 23, 42, 0.28)';
        label.style.pointerEvents = 'none';
        label.style.zIndex = '2147483646';
        label.style.opacity = '0';
        label.style.transition = 'opacity 150ms ease';
        document.body.appendChild(label);
      }

      (window as any).__codexVideoLabel = (message: string | null) => {
        if (!label) return;
        if (!message) {
          label.style.opacity = '0';
          label.textContent = '';
          return;
        }
        label.textContent = message;
        label.style.opacity = '1';
      };
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', ensureOverlay, { once: true });
    } else {
      ensureOverlay();
    }
  });
}

async function setVideoLabel(page: Page, message: string | null): Promise<void> {
  await page.evaluate((value) => {
    const fn = (window as any).__codexVideoLabel as ((msg: string | null) => void) | undefined;
    fn?.(value);
  }, message);
}

async function showTitleCard(page: Page, title: string, subtitle: string, bullets: string[]): Promise<void> {
  await page.setContent(`
    <style>
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background:
          radial-gradient(circle at top left, rgba(16, 185, 129, .22), transparent 35%),
          radial-gradient(circle at bottom right, rgba(59, 130, 246, .22), transparent 40%),
          linear-gradient(135deg, #020617 0%, #0f172a 45%, #1e293b 100%);
        color: #e2e8f0;
        font-family: "Segoe UI", system-ui, sans-serif;
      }
      .card {
        width: min(980px, calc(100vw - 96px));
        border: 1px solid rgba(148, 163, 184, .24);
        border-radius: 28px;
        padding: 40px 44px;
        background: rgba(15, 23, 42, .72);
        box-shadow: 0 24px 80px rgba(2, 6, 23, .45);
        backdrop-filter: blur(14px);
      }
      .eyebrow {
        display: inline-flex;
        padding: 8px 14px;
        border-radius: 999px;
        background: rgba(34, 197, 94, .14);
        color: #86efac;
        font-size: 14px;
        letter-spacing: .08em;
        text-transform: uppercase;
        font-weight: 700;
      }
      h1 {
        margin: 20px 0 12px;
        font-size: 42px;
        line-height: 1.08;
      }
      p {
        margin: 0 0 18px;
        color: #cbd5e1;
        font-size: 20px;
        line-height: 1.5;
      }
      ul {
        margin: 0;
        padding-left: 22px;
        display: grid;
        gap: 10px;
        color: #f8fafc;
        font-size: 18px;
      }
      li::marker {
        color: #38bdf8;
      }
    </style>
    <div class="card">
      <div class="eyebrow">Trial Workflow Recorder</div>
      <h1>${title}</h1>
      <p>${subtitle}</p>
      <ul>${bullets.map((item) => `<li>${item}</li>`).join('')}</ul>
    </div>
  `);
  await page.waitForTimeout(1800);
}

async function clickLocator(page: Page, locator: Locator): Promise<void> {
  await expect(locator).toBeVisible({ timeout: 20_000 });
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if (!box) {
    throw new Error('Could not calculate locator position for click.');
  }

  await page.mouse.move(box.x + (box.width / 2), box.y + (box.height / 2), { steps: 14 });
  await page.waitForTimeout(80);
  await page.mouse.down();
  await page.waitForTimeout(50);
  await page.mouse.up();
  await page.waitForTimeout(160);
}

async function slowFill(page: Page, locator: Locator, value: string, delay = 45): Promise<void> {
  await clickLocator(page, locator);
  await locator.fill('');
  if (value) {
    await locator.pressSequentially(value, { delay });
  }
  await page.waitForTimeout(120);
}

async function loginViaUi(page: Page, email: string, password: string): Promise<void> {
  await page.goto(appUrl('/login'));
  await page.waitForLoadState('networkidle');
  await slowFill(page, page.getByTestId('login-email'), email);
  await slowFill(page, page.getByTestId('login-password'), password);
  await clickLocator(page, page.getByTestId('login-submit'));
  await page.waitForURL(/\/app\//, { timeout: 20_000 });
}

async function switchSession(
  page: Page,
  session: any,
  targetPath: string,
  fallbackCredentials: { email: string; password: string },
): Promise<void> {
  await page.goto('about:blank');
  await page.context().clearCookies();
  await page.evaluate(() => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {
      // Ignore storage clearing on opaque origins such as about:blank.
    }
  });
  await applySessionCookies(page.context(), session);
  await page.goto(appUrl(targetPath));
  await page.waitForLoadState('networkidle');

  if (new URL(page.url(), APP_BASE_URL).pathname === '/login') {
    await loginViaUi(page, fallbackCredentials.email, fallbackCredentials.password);
    if (new URL(page.url(), APP_BASE_URL).pathname !== targetPath) {
      await page.goto(appUrl(targetPath));
      await page.waitForLoadState('networkidle');
    }
  }

  await page.waitForTimeout(900);
}

async function installSuccessfulCameraMock(page: Page): Promise<void> {
  await page.evaluate(() => {
    const pngDataUrl =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7Z0ioAAAAASUVORK5CYII=';
    const mediaDevices = navigator.mediaDevices || ({} as MediaDevices);
    mediaDevices.getUserMedia = async () => new MediaStream();
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: mediaDevices,
    });

    const fakeContext = {
      drawImage() {
        return undefined;
      },
    } as unknown as CanvasRenderingContext2D;

    HTMLCanvasElement.prototype.getContext = (() => fakeContext) as unknown as typeof HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.toDataURL = (() => pngDataUrl) as typeof HTMLCanvasElement.prototype.toDataURL;

    const videoProto = HTMLMediaElement.prototype as HTMLMediaElement & {
      play?: () => Promise<void>;
    };
    videoProto.play = async () => undefined;
  });
}

async function setMockVideoSize(page: Page): Promise<void> {
  await page.evaluate(() => {
    const video = document.querySelector('video');
    if (!video) return;
    Object.defineProperty(video, 'videoWidth', {
      configurable: true,
      value: 1280,
    });
    Object.defineProperty(video, 'videoHeight', {
      configurable: true,
      value: 720,
    });
  });
}

async function findSaleFixture(
  request: APIRequestContext,
  directorSession: any,
): Promise<any> {
  const sales = await getSales(request, directorSession);
  const sale = sales.find((item) => item.email === roleEmail('sale')) || sales[0];
  if (!sale) {
    throw new Error('Could not locate any SALE user for the video fixture.');
  }
  return sale;
}

async function createOfflineTrialFixture(
  request: APIRequestContext,
  directorSession: any,
  sale: any,
  label: string,
): Promise<TrialFixture> {
  const digits = uniqueDigits(8);
  const teacher = await apiJson<any>(
    request,
    directorSession,
    'POST',
    '/users',
    {
      userCode: `TV${digits}`,
      email: `video-trial-teacher-${digits}@school.local`,
      password: rolePassword(),
      fullName: `Video Trial Teacher ${digits.slice(-4)}`,
      role: 'TEACHER',
      phone: uniquePhone(`teacher-${label}`),
    },
  );

  const product = await apiJson<any>(
    request,
    directorSession,
    'POST',
    '/products',
    {
      name: `Video Trial Offline ${digits.slice(-4)}`,
      code: `VTO${digits}`,
      description: 'Offline trial video fixture',
      category: 'ENGLISH',
      teachingMode: 'OFFLINE',
      defaultSessions: 1,
      defaultSessionDuration: 60,
      pricePerSession: 150_000,
      suggestedPrice: 150_000,
      commissionRate: 0,
      isActive: true,
    },
  );

  const classroom = await apiJson<any>(
    request,
    directorSession,
    'POST',
    '/classes',
    {
      name: `Video Trial Class ${digits.slice(-4)}`,
      code: `VTCLS${digits}`,
      teacherId: teacher._id,
      saleId: sale._id,
      classMode: 'OFFLINE',
      productPackageId: product._id,
      studentIds: [],
      subject: 'Tieng Anh',
      learningGoals: 'Video trial order to top-up walkthrough',
      pricePerSession: 150_000,
      teacherPayPerSession: 0,
      teacherPayPerStudent: 80_000,
      baseDuration: 60,
      sessionDuration: 60,
      maxStudents: 5,
    },
  );

  return {
    product,
    teacher,
    classroom,
    sale,
  };
}

async function createTrialEnrollmentTrackingRecord(
  request: APIRequestContext,
  saleSession: any,
  payload: {
    studentName: string;
    parentName: string;
    parentPhone: string;
    parentEmail: string;
    classId: string;
    productId: string;
    saleId: string;
  },
): Promise<any> {
  return apiJson<any>(
    request,
    saleSession,
    'POST',
    '/trial-enrollments',
    {
      ...payload,
      maxTrialSessions: 1,
      notes: 'Video trial tracking record for WAITING_DECISION conversion check',
    },
  );
}

async function completeAndFinalizeSession(
  request: APIRequestContext,
  teacherSession: any,
  opsSession: any,
  sessionId: string,
): Promise<void> {
  const now = new Date();
  const start = new Date(now.getTime() - (65 * 60 * 1000));
  const end = new Date(now.getTime() - (5 * 60 * 1000));

  const currentSession = await apiJson<any>(
    request,
    teacherSession,
    'GET',
    `/sessions/${sessionId}`,
  );

  if (String(currentSession?.status || '') === 'SCHEDULED') {
    await apiJson(
      request,
      teacherSession,
      'POST',
      `/sessions/${sessionId}/complete`,
      {
        actualStartTime: start.toISOString(),
        actualEndTime: end.toISOString(),
        lessonObjective: 'Trial lesson objective for video verification',
        lessonContent: 'Parent attended the offline trial lesson and the student completed the core speaking and listening practice.',
        overallComment: 'Teacher marked the trial as completed before the parent decision.',
      },
    );
  }

  await apiJson(
    request,
    teacherSession,
    'PATCH',
    `/sessions/${sessionId}/teaching-report`,
    {
      lessonContent: 'Detailed offline trial teaching report for the recorded flow. The student participated well and the parent asked to continue after the lesson.',
      studentAttitude: 'Co hop tac va theo sat buoi hoc',
      teacherComment: 'Trial report created from the recorded browser workflow',
      homework: 'On lai tu vung co ban va mau cau gioi thieu ban than',
      additionalNotes: 'Used to verify conversion into negative wallet debt after finalize.',
    },
  );

  await apiJson(request, opsSession, 'POST', `/sessions/${sessionId}/finalize`, {});
}

test.use({
  trace: 'off',
  launchOptions: {
    slowMo: 150,
  },
});

test('B04 records create -> approve -> attendance -> top-up for an offline trial order', async ({
  browser,
  request,
}) => {
  test.slow();
  test.setTimeout(600_000);

  const batch = await createBatchEvidenceContext(browser, {
    batchId: 'B04',
    scenario: 'trial_order_approve_attendance_topup_video',
    runDate: RUN_DATE,
  });

  const { page } = batch;
  const directorSession = await loginAsRole(request, 'director');
  const saleSession = await loginAsRole(request, 'sale');
  const opsSession = await loginAsRole(request, 'ops');
  const accountingSession = await loginAsRole(request, 'accounting');
  const sale = await findSaleFixture(request, directorSession);
  const digits = uniqueDigits(6);
  const fixture = await createOfflineTrialFixture(request, directorSession, sale, `video-${digits}`);
  const teacherSession = await loginAsCredentials(
    request,
    'teacher',
    fixture.teacher.email,
    rolePassword(),
  );

  const parentName = `Nguyen Van A Video ${digits}`;
  const studentName = `Nguyen Van B Video ${digits}`;
  const parentEmail = `nguyenvana+trialvideo${digits}@gmail.com`;
  const parentPhone = uniquePhone(`trial-video-parent-${digits}`);
  const transactionRef = `TRIALTOPUP${digits}`;
  const topUpDescription = `Trial wallet top-up ${digits}`;

  let orderCode = '';
  let orderId = '';
  let trialEnrollmentId = '';

  await installOverlay(page);

  try {
    await showTitleCard(
      page,
      'Order hoc thu offline -> diem danh -> nap vi',
      'Video nay quay mot luong kiem thu lien mach tu tao order hoc thu den approve, diem danh, convert va nap vi offset so du am.',
      [
        'Sale tao order hoc thu offline 0d tren mot lop OFFLINE da seed san.',
        'OPS duyet order, invoice hoc thu 0d duoc approve va hoc sinh vao roster lop ngay trong luong nay, sau do giao vien tao link diem danh.',
        'Sau khi session duoc chot, OPS convert trial de vi PH am roi Parent gui yeu cau nap vi va Accounting duyet.',
      ],
    );

    await setVideoLabel(page, 'Buoc 1: Sale tao order hoc thu offline 0d cho mot PH/HS moi va gui duyet.');
    await switchSession(page, saleSession, '/app/orders', {
      email: roleEmail('sale'),
      password: rolePassword(),
    });

    await clickLocator(page, page.getByTestId('orders-create-button'));
    const orderModal = page.getByTestId('order-form-modal');
    await expect(orderModal).toBeVisible({ timeout: 20_000 });

    await slowFill(page, orderModal.getByTestId('order-parent-name'), parentName);
    await slowFill(page, orderModal.getByTestId('order-parent-phone'), parentPhone);
    await slowFill(page, orderModal.getByTestId('order-parent-email'), parentEmail);
    await slowFill(page, orderModal.getByTestId('order-student-name'), studentName);

    await orderModal.getByTestId('order-item-product-0').selectOption(fixture.product._id);
    await page.waitForTimeout(300);
    await orderModal.getByTestId('order-item-mode-0').selectOption('OFFLINE');
    await orderModal.getByTestId('order-item-sessions-0').fill('1');
    await orderModal.getByTestId('order-item-price-0').fill('0');
    await orderModal.getByTestId('order-item-trial-0').fill('1');
    await orderModal.getByTestId('order-invoice-sessions-0').fill('0');
    await orderModal.getByTestId('order-invoice-amount-0').fill('0');
    await orderModal.getByTestId('order-item-class-0').selectOption(fixture.classroom._id);
    await slowFill(
      page,
      orderModal.getByTestId('order-consultation-notes'),
      'Video trial order. Offline trial only, expected invoice amount stays at 0 and later conversion should push parent wallet negative.',
      25,
    );

    await clickLocator(page, orderModal.getByTestId('order-submit'));
    await expect(orderModal).toBeHidden({ timeout: 30_000 });

    const saleKeyword = page.locator('section.filters input').first();
    await saleKeyword.fill(parentPhone);
    const saleRow = page.getByTestId('order-row').filter({ hasText: parentPhone }).first();
    await expect(saleRow).toBeVisible({ timeout: 20_000 });

    orderCode = String(await saleRow.getAttribute('data-order-code') || '');
    orderId = String(await saleRow.getAttribute('data-order-id') || '');
    expect(orderCode).toBeTruthy();
    expect(orderId).toBeTruthy();
    await batch.step('01-sale-created-trial-order');

    await acceptDialog(page, () => clickLocator(page, saleRow.getByTestId('order-row-submit')));
    await expect.poll(async () => (await getOrderById(request, directorSession, orderId)).status, {
      timeout: 30_000,
    }).toBe('SUBMITTED');
    await batch.step('02-sale-submitted-trial-order');

    await setVideoLabel(page, 'Buoc 2: OPS mo order vua gui va duyet order hoc thu 0d khong can chung tu doi ung.');
    await switchSession(page, opsSession, '/app/orders', {
      email: roleEmail('ops'),
      password: rolePassword(),
    });

    const opsKeyword = page.locator('section.filters input').first();
    await opsKeyword.fill(orderCode);
    const opsRow = orderRow(page, orderCode);
    await expect(opsRow).toBeVisible({ timeout: 20_000 });
    await clickLocator(page, opsRow.getByTestId('order-row-approve'));

    const approveModal = page.getByTestId('order-approve-modal');
    await expect(approveModal).toBeVisible({ timeout: 20_000 });
    await expect(approveModal).toContainText(/offline/i);
    await expect(approveModal).toContainText(/0/);
    await clickLocator(page, approveModal.getByTestId('order-approve-confirm'));
    await expect(approveModal).toBeHidden({ timeout: 30_000 });
    await batch.step('03-ops-approved-trial-order');

    await expect.poll(async () => (await getOrderById(request, directorSession, orderId)).status, {
      timeout: 30_000,
    }).toBe('COMPLETED');

    const orderData = await getOrderById(request, directorSession, orderId);
    expect(orderData.processedResults?.classIds || []).toContain(fixture.classroom._id);
    const invoices = await findInvoicesByOrderId(request, directorSession, orderId);
    expect(invoices).toHaveLength(1);
    expect(Number(invoices[0].amount || 0)).toBe(0);
    expect(String(invoices[0].status || '')).toBe('APPROVED');

    const approvedInvoice = invoices[0];
    const parentUserId = String(orderData.parentUserId || '');
    expect(parentUserId).toBeTruthy();
    expect(await getWalletBalanceByUserId(request, directorSession, parentUserId)).toBe(0);
    await expect.poll(async () => {
      const classroom = await apiJson<any>(
        request,
        directorSession,
        'GET',
        `/classes/${fixture.classroom._id}`,
      );
      return Array.isArray(classroom?.students) ? classroom.students.length : 0;
    }, {
      timeout: 30_000,
    }).toBe(1);

    const tracking = await createTrialEnrollmentTrackingRecord(request, saleSession, {
      studentName,
      parentName,
      parentPhone,
      parentEmail,
      classId: fixture.classroom._id,
      productId: fixture.product._id,
      saleId: sale._id,
    });
    trialEnrollmentId = String(tracking._id);

    await setVideoLabel(page, 'Buoc 3: Giao vien tao link diem danh cho hoc sinh tu man hinh Attendance.');
    await switchSession(page, teacherSession, '/app/attendance', {
      email: fixture.teacher.email,
      password: rolePassword(),
    });

    await page.getByTestId('attendance-class-select').selectOption(fixture.classroom._id);
    await clickLocator(page, page.getByTestId('attendance-load-button'));
    const studentCard = page.locator('.student-card').filter({ hasText: studentName }).first();
    await expect(studentCard).toBeVisible({ timeout: 20_000 });
    const studentCardTestId = String(await studentCard.getAttribute('data-testid') || '');
    const studentId = studentCardTestId.replace('attendance-student-card-', '');
    expect(studentId).toBeTruthy();

    const linkDialog = await acceptDialog(
      page,
      () => clickLocator(page, page.getByTestId(`attendance-generate-link-${studentId}`)),
    );
    const { attendanceUrl } = extractAttendanceLink(linkDialog);
    await batch.step('04-teacher-generated-attendance-link');

    await setVideoLabel(page, 'Buoc 4: Hoc sinh/PH mo link public, bat camera va submit diem danh truc tiep.');
    await page.goto(attendanceUrl);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.info-card')).toContainText(studentName, { timeout: 20_000 });
    await installSuccessfulCameraMock(page);
    await clickLocator(page, page.getByTestId('attendance-start-camera-button'));
    await expect(page.getByTestId('attendance-capture-button')).toBeVisible({ timeout: 20_000 });
    await setMockVideoSize(page);

    const submitResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST'
        && response.url().includes('/public/attendance/submit'),
    );
    await clickLocator(page, page.getByTestId('attendance-capture-button'));
    const submitResponse = await submitResponsePromise;
    const attendancePayload = await submitResponse.json().catch(() => null);
    const sessionId = String(attendancePayload?.sessionId || '');
    expect(sessionId).toBeTruthy();

    await expect(page.locator('.success-message')).toBeVisible({ timeout: 20_000 });
    await batch.step('05-public-attendance-submitted');

    await apiJson(
      request,
      saleSession,
      'POST',
      `/trial-enrollments/${trialEnrollmentId}/trial-sessions`,
      {
        count: 1,
        notes: 'Recorded one trial attendance from the public attendance workflow.',
      },
    );

    await completeAndFinalizeSession(request, teacherSession, opsSession, sessionId);

    await expect.poll(async () => (await getSessionById(request, directorSession, sessionId)).status, {
      timeout: 30_000,
    }).toBe('FINALIZED');
    const finalizedSessionData = await getSessionById(request, directorSession, sessionId);
    expect(finalizedSessionData.sessionType).toBe('TRIAL');
    expect(finalizedSessionData.trialConverted).toBe(false);
    expect(Number(finalizedSessionData.amountCharged || 0)).toBe(150_000);
    expect(finalizedSessionData.isPaid).toBe(false);

    await setVideoLabel(page, 'Buoc 5: OPS chot hoc thu tiep tuc tren man hinh Hoc thu offline de bien no thanh no vi cua PH.');
    await switchSession(page, opsSession, '/app/trial-enrollments', {
      email: roleEmail('ops'),
      password: rolePassword(),
    });

    await page.locator('.filters input').first().fill(parentPhone);
    const trialRow = page.locator('table.data tbody tr').filter({ hasText: parentPhone }).first();
    await expect(trialRow).toBeVisible({ timeout: 20_000 });
    await clickLocator(page, trialRow.getByTestId(`trial-convert-${trialEnrollmentId}`));
    await expect(page.getByTestId('trial-page-feedback')).toBeVisible({
      timeout: 20_000,
    });
    await batch.step('06-ops-converted-trial');

    await expect.poll(() => getWalletBalanceByUserId(request, directorSession, parentUserId), {
      timeout: 30_000,
    }).toBe(-150_000);

    const convertedSession = await getSessionById(request, directorSession, sessionId);
    expect(convertedSession.trialConverted).toBe(true);
    expect(convertedSession.isPaid).toBe(true);

    const convertedInvoice = await apiJson<any>(
      request,
      directorSession,
      'GET',
      `/invoices/${approvedInvoice._id}`,
    );
    expect(Number(convertedInvoice.trialSessionsRemaining || 0)).toBe(0);

    const parentSession = await loginAsCredentials(
      request,
      'parent',
      parentEmail,
      PARENT_PASSWORD,
    );

    await setVideoLabel(page, 'Buoc 6: Parent vao vi, thay so du am va gui yeu cau nap vi de bu offset khoan am do.');
    await switchSession(page, parentSession, '/app/wallets', {
      email: parentEmail,
      password: PARENT_PASSWORD,
    });

    await expect(page.locator('.my-wallet-card .balance-value')).toContainText('-', {
      timeout: 20_000,
    });
    await clickLocator(page, page.locator('.my-wallet-card button.primary').first());
    const parentTopUpModal = page.locator('.modal-backdrop .modal').first();
    await expect(parentTopUpModal).toBeVisible({ timeout: 20_000 });
    await slowFill(page, parentTopUpModal.locator('input[name="amount"]'), '150000');
    await parentTopUpModal.locator('select[name="paymentMethod"]').selectOption('CASH');
    await slowFill(page, parentTopUpModal.locator('input[name="transactionRef"]'), transactionRef);
    await slowFill(page, parentTopUpModal.locator('textarea[name="description"]'), topUpDescription, 30);
    await acceptDialog(page, () => clickLocator(page, parentTopUpModal.locator('button[type="submit"]')));
    await expect(parentTopUpModal).toHaveCount(0, { timeout: 20_000 });
    await batch.step('07-parent-submitted-topup');

    await setVideoLabel(page, 'Buoc 7: Accounting mo pending top-up va duyet yeu cau vua tao de xoa no am tren vi PH.');
    await switchSession(page, accountingSession, '/app/wallets', {
      email: roleEmail('accounting'),
      password: rolePassword(),
    });

    await clickLocator(page, page.locator('.header-actions button').last());
    const pendingItem = page.locator('.pending-item').filter({ hasText: transactionRef }).first();
    await expect(pendingItem).toBeVisible({ timeout: 20_000 });
    await clickLocator(page, pendingItem.locator('.pending-actions button').first());
    const approveTopUpModal = page.locator('.modal-backdrop .modal').last();
    await expect(approveTopUpModal).toBeVisible({ timeout: 20_000 });
    await slowFill(
      page,
      approveTopUpModal.locator('textarea[name="accountingNotes"]'),
      'Approve top-up to offset negative wallet from converted offline trial session.',
      28,
    );
    await clickLocator(page, approveTopUpModal.locator('.modal-actions button.primary'));
    await expect(page.locator('textarea[name="accountingNotes"]')).toHaveCount(0, { timeout: 20_000 });
    await expect(page.locator('.pending-item').filter({ hasText: transactionRef })).toHaveCount(0, { timeout: 20_000 });
    await batch.step('08-accounting-approved-topup');

    await expect.poll(() => getWalletBalanceByUserId(request, directorSession, parentUserId), {
      timeout: 30_000,
    }).toBe(0);

    await setVideoLabel(page, 'Buoc 8: Parent reload vi va xac nhan so du da duoc bu ve 0 sau khi ke toan duyet.');
    await switchSession(page, parentSession, '/app/wallets', {
      email: parentEmail,
      password: PARENT_PASSWORD,
    });

    await expect(page.locator('.my-wallet-card .balance-value')).not.toContainText('-', {
      timeout: 20_000,
    });
    await expect(page.locator('.my-wallet-card .balance-value')).toContainText(/0/);
    await batch.step('09-parent-wallet-cleared');

    await setVideoLabel(page, 'Kiem thu xong: order hoc thu offline da di het luong tao -> duyet -> diem danh -> convert -> nap vi.');
    await page.waitForTimeout(1400);
    await setVideoLabel(page, null);

    await batch.finalize('PASS', {
      extraLines: [
        `Order code: ${orderCode}`,
        `Parent email: ${parentEmail}`,
        `Generated attendance link: ${attendanceUrl}`,
        'Verified order approval created an APPROVED 0d trial invoice and kept the parent wallet at 0.',
        'Verified the approved order flow itself attached the student to the requested offline class so the teacher attendance screen could see the student roster.',
        'Verified public attendance created a TRIAL session, and after complete + teaching report + finalize the session remained pending the parent decision.',
        'Verified trial conversion pushed the parent wallet to -150000 and consuming one trial allowance happened only after conversion.',
        'Verified parent top-up request plus accounting approval brought the wallet balance back to exactly 0.',
        'Gap observed while testing: order-based trial approval still does not auto-create a trial-enrollment record for the decision UI, so this video seeds that tracking record through the API before the convert step.',
      ],
    });
  } catch (error) {
    await setVideoLabel(page, null);
    await batch.finalize('FAIL', {
      error,
    });
    throw error;
  }
});
