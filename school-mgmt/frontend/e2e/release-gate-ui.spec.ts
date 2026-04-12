import { expect, test, type Page } from '@playwright/test';
import {
  acceptDialog,
  apiJson,
  applySessionCookies,
  closeActors,
  createParentAccount,
  createEnrollmentFixture,
  ensureProductFixture,
  ensureSaleAccount,
  generateAttendanceLinkFromUi,
  invoiceRow,
  loginAsRole,
  openCustomPage,
  openRolePage,
  rolePassword,
  submitAttendanceByToken,
  timeSlot,
  uniquePhone,
} from './support';

async function fillTeachingReport(page: Page, sessionId: string): Promise<void> {
  const card = page.getByTestId(`report-pending-card-${sessionId}`);
  await expect(card).toBeVisible({ timeout: 15_000 });
  await card.getByTestId(`report-pending-expand-${sessionId}`).click();

  const form = page.getByTestId(`report-pending-form-${sessionId}`);
  await expect(form).toBeVisible();
  await form.getByTestId('report-lesson-content').fill('Luyen grammar, listening va guided speaking.');
  await form.getByTestId('report-student-attitude').fill('Tap trung tot va phoi hop xuyen suot buoi hoc.');
  await form.getByTestId('report-recording-url').fill('https://example.com/teaching-report-demo');
  await form.getByTestId('report-teacher-comment').fill('Tien bo tot, can tiep tuc luyen phat am.');
  await form.getByTestId('report-homework').fill('Hoan thanh worksheet 3 va on lai tu vung.');
  await form.getByTestId('report-additional-notes').fill('Phu huynh nen nhac con on bai 10 phut moi ngay.');
  await form.getByTestId('report-submit').click();
}

test.describe('Release gate UI suite', () => {
  test('1. Parent truy cap truc tiep financial-control bi chan boi route guard', async ({
    page,
    request,
  }) => {
    const parentSession = await loginAsRole(request, 'parent');
    await applySessionCookies(page.context(), parentSession);

    await page.goto('/app/financial-control');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/\/not-authorized$/);
    await expect(page.getByText(/not authorized|khong co quyen|không có quyền/i)).toBeVisible();
  });

  test('2. Sale tao order, UI tinh tien ngay lap tuc va gui duyet thanh cong', async ({
    browser,
    request,
  }) => {
    test.slow();

    const directorSession = await loginAsRole(request, 'director');
    const label = `ReleaseOrder${Date.now()}`;
    const product = await apiJson<any>(
      request,
      directorSession,
      'POST',
      '/products',
      {
        name: `Release Gate Product ${label}`,
        code: `RG${Date.now().toString().slice(-8)}`,
        description: 'Release gate order product',
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

    const saleUi = await openRolePage(browser, request, 'sale', '/app/orders');
    const parentName = `PH ${label}`;
    const studentName = `HS ${label}`;
    const phone = `09${Date.now().toString().slice(-8)}`;

    try {
      await saleUi.page.getByTestId('orders-create-button').click();
      await expect(saleUi.page.getByTestId('order-form-modal')).toBeVisible();

      await saleUi.page.getByTestId('order-parent-name').fill(parentName);
      await saleUi.page.getByTestId('order-parent-phone').fill(phone);
      await saleUi.page.getByTestId('order-student-name').fill(studentName);
      await saleUi.page.getByTestId('order-item-product-0').selectOption(product._id);
      await saleUi.page.getByTestId('order-item-class-0').selectOption('');

      await expect(saleUi.page.getByTestId('order-total-amount')).toHaveValue('5000000');

      await saleUi.page.getByTestId('order-discount-amount').fill('500000');
      await expect(saleUi.page.getByTestId('order-final-amount')).toHaveValue('4500000');

      await saleUi.page.getByTestId('order-submit').click();
      await expect(saleUi.page.getByTestId('order-form-modal')).toBeHidden({ timeout: 10_000 });

      const row = saleUi.page.getByTestId('order-row').filter({ hasText: parentName }).first();
      await expect(row).toBeVisible({ timeout: 10_000 });

      await acceptDialog(saleUi.page, () => row.getByTestId('order-row-submit').click());
      await expect(row.locator('.badge')).toContainText(/Cho duyet|Chờ duyệt|SUBMITTED/i);
    } finally {
      await closeActors(saleUi);
    }
  });

  test('3. Accounting mo approve invoice nhung bi chan khi thieu hoa don sale upload', async ({
    browser,
    request,
  }) => {
    test.slow();

    const directorSession = await loginAsRole(request, 'director');
    const fixture = await createEnrollmentFixture(request, {
      label: `InvoiceProof${Date.now()}`,
      classMode: 'ONLINE',
      initializeWallet: true,
    });
    const invoiceNumber = `RG-INV-${Date.now()}`;

    await apiJson(
      request,
      directorSession,
      'POST',
      '/invoices',
      {
        invoiceNumber,
        studentId: fixture.student._id,
        classId: fixture.classroom._id,
        classType: 'ONLINE',
        saleId: fixture.sale._id,
        sessions: 5,
        paymentRound: 1,
        amount: 1_000_000,
        paymentDate: new Date().toISOString().slice(0, 10),
        description: `Invoice proof gate ${invoiceNumber}`,
      },
    );

    const accountingUi = await openRolePage(browser, request, 'accounting', '/app/invoices');
    try {
      const row = invoiceRow(accountingUi.page, invoiceNumber);
      await expect(row).toBeVisible({ timeout: 10_000 });
      await row.getByTestId('invoice-row-approve').click();

      const modal = accountingUi.page.getByTestId('invoice-approve-modal');
      await expect(modal).toBeVisible();
      await expect(modal.getByText(/chưa có hóa đơn sale upload|chua co hoa don sale upload/i)).toBeVisible();
      await expect(modal.getByTestId('invoice-approve-confirm')).toBeDisabled();
      await expect(modal).toBeVisible();
    } finally {
      await closeActors(accountingUi);
    }
  });

  test('4. Teacher tao link diem danh va nop teaching report de item chuyen sang completed', async ({
    browser,
    request,
  }) => {
    test.slow();

    const directorSession = await loginAsRole(request, 'director');
    const label = `TeacherFlow${Date.now()}`;
    const scheduledDate = new Date().toISOString().slice(0, 10);
    const schedule = timeSlot((Date.now() % 10), 60);
    const teacherDigits = `${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(-10);
    const [product, sale, parent] = await Promise.all([
      ensureProductFixture(request, directorSession, label, 'ONLINE'),
      ensureSaleAccount(request, directorSession, label),
      createParentAccount(request, directorSession, label),
    ]);

    const teacher = await apiJson<any>(
      request,
      directorSession,
      'POST',
      '/users',
      {
        userCode: `RGT${teacherDigits}`,
        email: `release-teacher-${teacherDigits}@school.local`,
        password: rolePassword(),
        fullName: `Release Teacher ${label}`,
        role: 'TEACHER',
        phone: uniquePhone(`${label}-teacher`),
      },
    );

    const student = await apiJson<any>(
      request,
      directorSession,
      'POST',
      '/students',
      {
        studentCode: `HS${teacherDigits}`,
        fullName: `Release Student ${label}`,
        age: 10,
        parentName: parent.fullName,
        parentPhone: parent.phone,
        parentUserId: parent._id,
        faceImage: 'default-avatar.png',
        productPackage: product._id,
        level: 'Starter',
        studentType: 'ONLINE',
        saleId: sale._id,
        saleName: sale.fullName,
      },
    );

    const classroom = await apiJson<any>(
      request,
      directorSession,
      'POST',
      '/classes',
      {
        name: `Release Class ${label}`,
        code: `RGC${teacherDigits}`,
        teacherId: teacher._id,
        saleId: sale._id,
        classMode: 'ONLINE',
        productPackageId: product._id,
        studentIds: [student._id],
        subject: 'Tieng Anh',
        learningGoals: 'Release gate teacher workflow',
        pricePerSession: 200_000,
        teacherPayPerSession: 120_000,
        teacherPayPerStudent: 0,
        baseDuration: 60,
        sessionDuration: 60,
        maxStudents: 1,
      },
    );

    const session = await apiJson<any>(
      request,
      directorSession,
      'POST',
      '/sessions',
      {
        classId: classroom._id,
        studentId: student._id,
        teacherId: teacher._id,
        parentUserId: parent._id,
        scheduledDate,
        scheduledStartTime: schedule.startTime,
        scheduledEndTime: schedule.endTime,
        durationMinutes: 60,
        amountCharged: 200_000,
        teacherPayout: 120_000,
      },
    );

    const teacherUi = await openCustomPage(
      browser,
      request,
      'teacher',
      teacher.email,
      rolePassword(),
      '/app/attendance',
    );
    try {
      await teacherUi.page.getByTestId('attendance-class-select').selectOption(classroom._id);
      await teacherUi.page.getByTestId('attendance-date-input').fill(scheduledDate);
      await teacherUi.page.getByTestId('attendance-load-button').click();

      await expect(teacherUi.page.getByTestId(`attendance-student-card-${student._id}`)).toBeVisible({ timeout: 10_000 });
      await expect(teacherUi.page.getByTestId(`attendance-generate-link-${student._id}`)).toBeVisible();
      await expect(teacherUi.page.getByTestId('attendance-mark-all-present')).toHaveCount(0);
      await expect(teacherUi.page.getByTestId('attendance-save-button')).toHaveCount(0);
      const { token } = await generateAttendanceLinkFromUi(teacherUi.page, student._id);
      await submitAttendanceByToken(request, token);
      await teacherUi.page.getByTestId('attendance-load-button').click();
      await expect(teacherUi.page.getByText(/Co mat:\s*1/i)).toBeVisible({ timeout: 10_000 });

      await teacherUi.page.goto('/app/teaching-report');
      await teacherUi.page.waitForLoadState('networkidle');
      await teacherUi.page.getByTestId('report-tab-pending').click();

      await fillTeachingReport(teacherUi.page, session._id);
      await expect(teacherUi.page.getByTestId(`report-pending-card-${session._id}`)).toBeHidden({ timeout: 15_000 });

      await teacherUi.page.getByTestId('report-tab-completed').click();
      await expect(
        teacherUi.page.locator('.session-card.completed').filter({ hasText: student.fullName }).first(),
      ).toBeVisible({ timeout: 15_000 });
    } finally {
      await closeActors(teacherUi);
    }
  });

  test('5. Investor dashboard gap 401 thi auto logout ve login', async ({
    page,
    request,
  }) => {
    const directorSession = await loginAsRole(request, 'director');
    await applySessionCookies(page.context(), directorSession);

    await page.route('**/financial-control/**', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Unauthorized' }),
      });
    });

    await page.goto('/app/investor-dashboard');
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByTestId('login-form')).toBeVisible();
  });
});
