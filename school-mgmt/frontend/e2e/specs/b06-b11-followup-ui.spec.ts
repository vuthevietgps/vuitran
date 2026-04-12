import { expect, test } from '@playwright/test';
import {
  apiCall,
  apiJson,
  closeActors,
  createEnrollmentFixture,
  createLearningFixture,
  createPendingInvoice,
  getSessionById,
  loginAsRole,
  openCustomPage,
  openRolePage,
  type UiActor,
} from '../support';

const AUDIT_MODULE_LABELS: Record<string, string> = {
  USERS: 'Nguoi dung',
  STUDENTS: 'Hoc sinh',
  TEACHERS: 'Giao vien',
  CLASSES: 'Lop hoc',
  SESSIONS: 'Buoi hoc',
  PAYROLL: 'Bang luong',
  WALLETS: 'Vi',
  INVOICES: 'Hoa don',
  TICKETS: 'Ticket',
  PRODUCTS: 'Khoa hoc',
  ATTENDANCE: 'Diem danh',
  AUTH: 'Dang nhap',
  TEACHING_MATERIALS: 'Tai lieu GD',
  LEADS: 'Lead',
  ORDERS: 'Don hang',
  ADS: 'Quang cao',
};

async function createShareholderAccount(
  request: Parameters<typeof loginAsRole>[0],
  directorSession: Awaited<ReturnType<typeof loginAsRole>>,
  label: string,
) {
  const uniqueStamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(-10);
  const email = `e2e-shareholder-${label}-${uniqueStamp}@school.local`;
  const password = 'Demo123456!';
  const phone = `09${uniqueStamp.slice(-8).padStart(8, '0')}`;

  await apiJson<any>(
    request,
    directorSession,
    'POST',
    '/users',
    {
      userCode: `SH${uniqueStamp.slice(-8)}`,
      email,
      password,
      fullName: `E2E Shareholder ${label}`,
      role: 'SHAREHOLDER',
      phone,
      ownershipPercentage: 15,
    },
    [200, 201],
  );

  return { email, password, phone };
}

async function submitTeachingReportForSession(page: UiActor['page'], sessionId: string) {
  const pendingCard = page.getByTestId(`report-pending-card-${sessionId}`);
  await expect(pendingCard).toBeVisible();
  await page.getByTestId(`report-pending-expand-${sessionId}`).click();

  const form = page.getByTestId(`report-pending-form-${sessionId}`);
  await expect(form).toBeVisible();
  await form.getByTestId('report-lesson-content').fill(
    'Student completed grammar practice, listening review, and guided speaking exercises.',
  );
  await form.getByTestId('report-student-attitude').fill(
    'Student stayed focused, cooperative, and followed instructions throughout the lesson.',
  );
  await form.getByTestId('report-recording-url').fill('https://example.com/e2e-recording-followup');
  await form.getByTestId('report-teacher-comment').fill(
    'Initial report comment for follow-up verification.',
  );
  await form.getByTestId('report-homework').fill(
    'Complete worksheet 4 and review the vocabulary list before the next lesson.',
  );
  await form.getByTestId('report-additional-notes').fill(
    'Parent should review speaking prompts with the student for 10 minutes.',
  );
  await form.getByTestId('report-submit').click();
}

test.describe.serial('B06/B11 follow-up UI coverage', () => {
  test('B06 parent invoices chi hien thi invoice dung pham vi parent hien tai', async ({ browser, request }) => {
    test.slow();

    const fixtureA = await createEnrollmentFixture(request, {
      label: `parent-invoice-a-${Date.now()}`,
      classMode: 'ONLINE',
      initializeWallet: true,
    });
    const fixtureB = await createEnrollmentFixture(request, {
      label: `parent-invoice-b-${Date.now()}`,
      classMode: 'ONLINE',
      initializeWallet: true,
    });

    const invoiceA = await createPendingInvoice(request, fixtureA, {
      invoiceNumber: `INV-PA-${Date.now()}`,
      amount: 1_230_000,
      paymentRound: 1,
      sessions: 6,
    });
    const invoiceB = await createPendingInvoice(request, fixtureB, {
      invoiceNumber: `INV-PB-${Date.now()}`,
      amount: 1_450_000,
      paymentRound: 1,
      sessions: 7,
    });

    const parentUi = await openCustomPage(
      browser,
      request,
      'parent',
      fixtureA.parent.email,
      fixtureA.parent.password,
      '/app/parent-invoices',
    );

    try {
      await expect(parentUi.page.locator('h2')).toBeVisible();
      await expect(parentUi.page.locator('body')).toContainText(invoiceA.invoiceNumber);
      await expect(parentUi.page.locator('body')).not.toContainText(invoiceB.invoiceNumber);
      await expect(parentUi.page.locator('.student-name')).toContainText(fixtureA.student.fullName);
      await expect(parentUi.page.locator('.stats')).toContainText('1,230,000');

      const apiInvoices = await apiJson<any>(
        request,
        parentUi.session,
        'GET',
        '/invoices/my-children',
      );
      const apiText = JSON.stringify(apiInvoices);
      expect(apiText).toContain(invoiceA.invoiceNumber);
      expect(apiText).not.toContain(invoiceB.invoiceNumber);
    } finally {
      await closeActors(parentUi);
    }
  });

  test('B11 teaching report submit-edit theo thang, teacher code lookup va role guard chan parent-sale', async ({
    browser,
    request,
  }) => {
    test.slow();

    const directorSession = await loginAsRole(request, 'director');
    const fixture = await createLearningFixture(request, {
      label: `teaching-report-followup-${Date.now()}`,
      classMode: 'ONLINE',
      initializeWallet: true,
      durationMinutes: 60,
      amountCharged: 200_000,
      teacherPayout: 120_000,
    });

    const teacherRecords = await apiJson<any[]>(
      request,
      directorSession,
      'GET',
      '/users/teachers',
    );
    const teacherRecord = teacherRecords.find(
      (item: any) => item._id === fixture.teacher._id || item.email === fixture.teacher.email,
    );
    expect(teacherRecord?.userCode).toBeTruthy();

    const teacherReportUi = await openCustomPage(
      browser,
      request,
      'teacher',
      fixture.teacher.email,
      fixture.teacher.password,
      '/app/teaching-report',
    );
    const directorReportUi = await openRolePage(browser, request, 'director', '/app/teaching-report');
    const saleBlockedUi = await openRolePage(browser, request, 'sale', '/app/teaching-report');
    const parentBlockedUi = await openCustomPage(
      browser,
      request,
      'parent',
      fixture.parent.email,
      fixture.parent.password,
      '/app/teaching-report',
    );

    try {
      await apiCall(
        request,
        teacherReportUi.session,
        'POST',
        `/sessions/${fixture.session._id}/complete`,
        {
          topicsCovered: 'Grammar review and speaking practice',
          homework: 'Workbook page 14',
          teacherNotes: 'Student joined on time',
        },
        [200, 201],
      );

      await teacherReportUi.page.getByTestId('report-tab-pending').click();
      await submitTeachingReportForSession(teacherReportUi.page, fixture.session._id);

      await expect
        .poll(async () => {
          const session = await getSessionById(request, directorSession, fixture.session._id);
          return session.teachingReport?.teacherComment || '';
        })
        .toContain('Initial report comment');

      await teacherReportUi.page.getByTestId('report-tab-completed').click();
      const completedCard = teacherReportUi.page
        .locator('.session-card.completed')
        .filter({ hasText: fixture.student.fullName })
        .first();
      await expect(completedCard).toBeVisible();
      await completedCard.locator('.session-header').click();
      await completedCard.locator('.form-actions .btn.secondary').click();
      await completedCard.getByTestId('report-teacher-comment').fill(
        'Updated report comment via completed tab inline edit.',
      );
      await completedCard.getByTestId('report-submit').click();

      await expect
        .poll(async () => {
          const session = await getSessionById(request, directorSession, fixture.session._id);
          return session.teachingReport?.teacherComment || '';
        })
        .toContain('Updated report comment via completed tab inline edit.');

      await expect(directorReportUi.page.getByTestId('report-month-filter')).toBeVisible();
      await directorReportUi.page.getByTestId('report-tab-completed').click();
      const teacherCodeInput = directorReportUi.page.getByPlaceholder('VD: GV001');
      await teacherCodeInput.fill(teacherRecord.userCode);
      await expect(directorReportUi.page.locator('.teacher-hint')).toContainText(teacherRecord.fullName, {
        timeout: 5000,
      });
      await directorReportUi.page.getByTestId('report-apply-filters').click();
      const directorCompletedCard = directorReportUi.page
        .locator('.session-card.completed')
        .filter({ hasText: fixture.student.fullName })
        .first();
      await expect(directorCompletedCard).toContainText(
        fixture.student.fullName,
      );
      await expect(directorCompletedCard).toContainText(
        fixture.classroom.name,
      );

      expect(new URL(saleBlockedUi.page.url()).pathname).not.toBe('/app/teaching-report');
      expect(new URL(parentBlockedUi.page.url()).pathname).not.toBe('/app/teaching-report');
    } finally {
      await closeActors(
        teacherReportUi,
        directorReportUi,
        saleBlockedUi,
        parentBlockedUi,
      );
    }
  });

  test('B11 audit log hien thi thong ke-filter-paging va khong co hanh vi sua xoa', async ({ browser, request }) => {
    test.slow();

    const directorSession = await loginAsRole(request, 'director');
    const pageOne = await apiJson<any>(
      request,
      directorSession,
      'GET',
      '/audit-log?page=1&limit=50',
    );
    const pageTwo = pageOne.total > 50
      ? await apiJson<any>(request, directorSession, 'GET', '/audit-log?page=2&limit=50')
      : null;
    const stats = await apiJson<any>(request, directorSession, 'GET', '/audit-log/stats');
    const moduleWithData = Object.entries(stats.byModule || {}).find(([, count]) => Number(count) > 0)?.[0] || '';
    const filteredByModule = moduleWithData
      ? await apiJson<any>(
        request,
        directorSession,
        'GET',
        `/audit-log?module=${moduleWithData}&page=1&limit=50`,
      )
      : null;

    const directorUi = await openRolePage(browser, request, 'director', '/app/audit-log');

    try {
      await expect(directorUi.page.locator('h2')).toBeVisible();
      await expect(directorUi.page.locator('.stat-row')).toContainText(String(stats.todayCount));
      await expect(directorUi.page.locator('.stat-row')).toContainText(String(stats.weekCount));
      await expect(directorUi.page.locator('.stat-row')).toContainText(String(stats.totalCount));
      await expect(directorUi.page.locator('table.data-table')).toBeVisible();

      const deleteButtons = directorUi.page.locator(
        'button:has-text("Xoa"), button:has-text("Delete"), button[data-action="delete"]',
      );
      await expect(deleteButtons).toHaveCount(0);

      if (moduleWithData) {
        await directorUi.page.locator('select').nth(0).selectOption(moduleWithData);
        await expect(directorUi.page.locator('table.data-table tbody tr')).toHaveCount(
          Math.min(Number(filteredByModule?.total || 0), 50),
        );
        const label = AUDIT_MODULE_LABELS[moduleWithData] || moduleWithData;
        await expect(directorUi.page.locator('table.data-table tbody tr').first()).toContainText(label);
        await directorUi.page.locator('.btn-reset').click();
      }

      if (pageTwo?.data?.length) {
        const firstPageFirstText = await directorUi.page
          .locator('table.data-table tbody tr')
          .first()
          .textContent();
        await directorUi.page.locator('.pagination button').nth(1).click();
        await expect(directorUi.page.locator('.pagination')).toContainText('2/');
        const secondPageFirstText = await directorUi.page
          .locator('table.data-table tbody tr')
          .first()
          .textContent();
        expect(secondPageFirstText).not.toBe(firstPageFirstText);
        expect(secondPageFirstText || '').toContain(pageTwo.data[0].description);
      }
    } finally {
      await closeActors(directorUi);
    }
  });

  test('B11 employee performance chi cho director va chan direct URL voi sale-shareholder', async ({
    browser,
    request,
  }) => {
    test.slow();

    const directorSession = await loginAsRole(request, 'director');
    const shareholder = await createShareholderAccount(request, directorSession, 'employee-perf');

    const directorUi = await openRolePage(browser, request, 'director', '/app/dashboard');
    const saleUi = await openRolePage(browser, request, 'sale', '/app/dashboard');
    const shareholderUi = await openCustomPage(
      browser,
      request,
      'shareholder',
      shareholder.email,
      shareholder.password,
      '/app/dashboard',
    );

    try {
      await directorUi.page.route('**/dashboard/director/employee-performance', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            teachers: [
              { name: 'Teacher Alpha', totalSessions: 24, reportRate: 96.5, avgRating: 4.8 },
            ],
            sales: [
              {
                name: 'Sale Bravo',
                totalLeads: 32,
                convertedLeads: 14,
                conversionRate: 43.8,
                revenue: 48_000_000,
                commission: 4_800_000,
              },
            ],
            ops: [
              { name: 'Ops Charlie', totalTickets: 28, resolvedTickets: 26, resolutionRate: 92.9 },
            ],
          }),
        });
      });

      await directorUi.page.goto('/app/employee-performance');
      await directorUi.page.waitForLoadState('networkidle');
      await expect(directorUi.page).toHaveURL(/\/app\/employee-performance$/);
      await expect(directorUi.page.locator('.tab-bar button')).toHaveCount(3);
      await expect(directorUi.page.locator('table.data tbody tr').first()).toContainText('Teacher Alpha');
      await directorUi.page.locator('.tab-bar button').nth(1).click();
      await expect(directorUi.page.locator('table.data tbody tr').first()).toContainText('Sale Bravo');
      await directorUi.page.locator('.tab-bar button').nth(2).click();
      await expect(directorUi.page.locator('table.data tbody tr').first()).toContainText('Ops Charlie');

      await saleUi.page.goto('/app/employee-performance');
      await saleUi.page.waitForLoadState('networkidle');
      expect(new URL(saleUi.page.url()).pathname).toBe('/not-authorized');
      await expect(saleUi.page.locator('app-employee-performance')).toHaveCount(0);

      await shareholderUi.page.goto('/app/employee-performance');
      await shareholderUi.page.waitForLoadState('networkidle');
      expect(new URL(shareholderUi.page.url()).pathname).toBe('/not-authorized');
      await expect(shareholderUi.page.locator('app-employee-performance')).toHaveCount(0);
    } finally {
      await closeActors(directorUi, saleUi, shareholderUi);
    }
  });

  test('B11 comprehensive report mask du lieu nhay cam va an control voi shareholder', async ({
    browser,
    request,
  }) => {
    test.slow();

    const directorSession = await loginAsRole(request, 'director');
    const fixture = await createLearningFixture(request, {
      label: `comprehensive-shareholder-${Date.now()}`,
      classMode: 'ONLINE',
      initializeWallet: true,
      durationMinutes: 60,
      amountCharged: 200_000,
      teacherPayout: 120_000,
    });
    const shareholder = await createShareholderAccount(request, directorSession, 'comprehensive');

    await expect
      .poll(async () => {
        const report = await apiJson<any>(
          request,
          directorSession,
          'GET',
          `/students/comprehensive-report?classId=${fixture.classroom._id}`,
        );
        return Boolean(
          (report?.rows || []).find(
            (row: any) =>
              String(row.studentId) === String(fixture.student._id)
              && String(row.classId) === String(fixture.classroom._id),
          ),
        );
      })
      .toBeTruthy();
    const seededReport = await apiJson<any>(
      request,
      directorSession,
      'GET',
      `/students/comprehensive-report?classId=${fixture.classroom._id}`,
    );
    const seededRow = (seededReport?.rows || []).find(
      (row: any) =>
        String(row.studentId) === String(fixture.student._id)
        && String(row.classId) === String(fixture.classroom._id),
    );
    expect(seededRow).toBeTruthy();

    const directorUi = await openRolePage(browser, request, 'director', '/app/dashboard');
    const shareholderUi = await openCustomPage(
      browser,
      request,
      'shareholder',
      shareholder.email,
      shareholder.password,
      '/app/dashboard',
    );

    try {
      for (const page of [directorUi.page, shareholderUi.page]) {
        await page.route('**/classes', async (route) => {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify([
              {
                _id: fixture.classroom._id,
                code: fixture.classroom.code,
                name: fixture.classroom.name,
              },
            ]),
          });
        });
        await page.route('**/students/comprehensive-report**', async (route) => {
          const url = new URL(route.request().url());
          const searchTerm = (url.searchParams.get('searchTerm') || '').trim().toLowerCase();
          const classId = url.searchParams.get('classId') || '';
          const rowStudentText = [
            seededRow.fullName,
            seededRow.studentCode,
            seededRow.parentName,
            seededRow.parentPhone,
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
          const shouldIncludeRow =
            (!classId || classId === fixture.classroom._id)
            && (!searchTerm || rowStudentText.includes(searchTerm));

          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              maxSessions: seededReport.maxSessions || 1,
              rows: shouldIncludeRow ? [seededRow] : [],
            }),
          });
        });
      }

      await directorUi.page.goto('/app/comprehensive-report');
      await directorUi.page.waitForLoadState('networkidle');
      await directorUi.page.getByTestId('comprehensive-class-filter').selectOption(fixture.classroom._id);
      const directorRow = directorUi.page.getByTestId(
        `comprehensive-row-${fixture.student._id}-${fixture.classroom._id}`,
      );
      await expect(directorRow).toBeVisible({ timeout: 20_000 });
      await expect(directorUi.page.getByTestId('comprehensive-search-input')).toBeVisible();
      await expect(directorUi.page.getByTestId('comprehensive-export-button')).toBeVisible();
      await expect(directorRow).toContainText(fixture.student.fullName);
      await expect(directorRow).toContainText(fixture.parent.fullName);
      await expect(directorRow).toContainText(fixture.parent.phone);
      await directorUi.page.getByTestId('comprehensive-search-input').fill(fixture.student.fullName);
      await directorUi.page.getByTestId('comprehensive-search-button').click();
      await expect(directorRow).toBeVisible({ timeout: 20_000 });
      if (seededRow.dataStatus) {
        await directorUi.page.getByTestId('comprehensive-data-status-filter').selectOption(seededRow.dataStatus);
        await expect(directorRow).toBeVisible({ timeout: 20_000 });

        const alternateStatus = ['DANG_HOC', 'BAO_LUU', 'KET_THUC', 'HOAN_HOC_PHI'].find(
          (status) => status !== seededRow.dataStatus,
        );
        if (alternateStatus) {
          await directorUi.page.getByTestId('comprehensive-data-status-filter').selectOption(alternateStatus);
          await expect(directorUi.page.locator('.no-data')).toBeVisible({ timeout: 20_000 });
          await directorUi.page.getByTestId('comprehensive-data-status-filter').selectOption('');
        }
      }
      await directorUi.page.getByTestId('comprehensive-search-input').fill(`missing-${Date.now()}`);
      await directorUi.page.getByTestId('comprehensive-search-button').click();
      await expect(directorUi.page.locator('.no-data')).toBeVisible({ timeout: 20_000 });
      await directorUi.page.getByTestId('comprehensive-search-input').fill(fixture.student.fullName);
      await directorUi.page.getByTestId('comprehensive-search-button').click();
      await expect(directorRow).toBeVisible({ timeout: 20_000 });

      await shareholderUi.page.goto('/app/comprehensive-report');
      await shareholderUi.page.waitForLoadState('networkidle');
      await shareholderUi.page.getByTestId('comprehensive-class-filter').selectOption(fixture.classroom._id);
      const shareholderRow = shareholderUi.page.getByTestId(
        `comprehensive-row-${fixture.student._id}-${fixture.classroom._id}`,
      );
      await expect(shareholderUi.page.locator('.privacy-banner')).toBeVisible();
      await expect(shareholderUi.page.getByTestId('comprehensive-search-input')).toHaveCount(0);
      await expect(shareholderUi.page.getByTestId('comprehensive-export-button')).toHaveCount(0);
      await expect(
        shareholderUi.page.locator('th').filter({ hasText: /^Ten HS$/ }),
      ).toHaveCount(0);
      await expect(
        shareholderUi.page.locator('th').filter({ hasText: /^Ten PH$/ }),
      ).toHaveCount(0);
      await expect(
        shareholderUi.page.locator('th').filter({ hasText: /^SDT$/ }),
      ).toHaveCount(0);
      await expect(shareholderRow).toBeVisible({ timeout: 20_000 });
      await expect(shareholderRow).toContainText(fixture.student.studentCode);
      await expect(shareholderRow).toContainText(fixture.classroom.code);
      await expect(shareholderRow).not.toContainText(fixture.student.fullName);
      await expect(shareholderRow).not.toContainText(fixture.parent.fullName);
      await expect(shareholderRow).not.toContainText(fixture.parent.phone);
    } finally {
      await closeActors(directorUi, shareholderUi);
    }
  });

  test('B11 comprehensive report sale filter tach dung row theo sale', async ({
    browser,
    request,
  }) => {
    test.slow();

    const directorUi = await openRolePage(browser, request, 'director', '/app/dashboard');

    const stubRows = [
      {
        studentId: 'student-sale-alpha',
        classId: 'class-sale-alpha',
        classMode: 'ONLINE',
        studentCode: 'HS-SALE-ALPHA',
        fullName: 'Student Sale Alpha',
        level: 'Starter',
        parentName: 'Parent Alpha',
        parentPhone: '0900000001',
        classCode: 'CLS-ALPHA',
        teacherCodeAndName: 'GV001 - Teacher Alpha',
        teacherSalary: 120000,
        teacherSalaryType: 'PER_SESSION',
        invoiceNumber: 'INV-SALE-ALPHA',
        totalSessions: 6,
        sessionsCompleted: 2,
        attendedCount: 2,
        saleId: 'sale-alpha',
        saleName: 'Sale Alpha',
        dataStatus: 'DANG_HOC',
        sessions: [
          {
            status: 'PRESENT',
            date: '2026-04-01',
            duration: 60,
            teacherDisplay: 'GV001 - Teacher Alpha',
          },
        ],
      },
      {
        studentId: 'student-sale-bravo',
        classId: 'class-sale-bravo',
        classMode: 'OFFLINE',
        studentCode: 'HS-SALE-BRAVO',
        fullName: 'Student Sale Bravo',
        level: 'Mover',
        parentName: 'Parent Bravo',
        parentPhone: '0900000002',
        classCode: 'CLS-BRAVO',
        teacherCodeAndName: 'GV002 - Teacher Bravo',
        teacherSalary: 150000,
        teacherSalaryType: 'PER_SESSION',
        invoiceNumber: 'INV-SALE-BRAVO',
        totalSessions: 8,
        sessionsCompleted: 3,
        attendedCount: 3,
        saleId: 'sale-bravo',
        saleName: 'Sale Bravo',
        dataStatus: 'BAO_LUU',
        sessions: [
          {
            status: 'ABSENT',
            date: '2026-04-02',
            duration: 60,
            teacherDisplay: 'GV002 - Teacher Bravo',
          },
        ],
      },
    ];

    try {
      await directorUi.page.route('**/classes', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            { _id: 'class-sale-alpha', code: 'CLS-ALPHA', name: 'Class Alpha' },
            { _id: 'class-sale-bravo', code: 'CLS-BRAVO', name: 'Class Bravo' },
          ]),
        });
      });
      await directorUi.page.route('**/students/comprehensive-report**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            maxSessions: 1,
            rows: stubRows,
          }),
        });
      });

      await directorUi.page.goto('/app/comprehensive-report');
      await directorUi.page.waitForLoadState('networkidle');

      const saleFilter = directorUi.page.getByTestId('comprehensive-sale-filter');
      const alphaRow = directorUi.page.getByTestId('comprehensive-row-student-sale-alpha-class-sale-alpha');
      const bravoRow = directorUi.page.getByTestId('comprehensive-row-student-sale-bravo-class-sale-bravo');

      await expect(saleFilter).toBeVisible();
      await expect(saleFilter.locator('option')).toHaveCount(3);
      await expect(saleFilter).toContainText('Sale Alpha');
      await expect(saleFilter).toContainText('Sale Bravo');
      await expect(alphaRow).toBeVisible();
      await expect(bravoRow).toBeVisible();
      await expect(directorUi.page.getByTestId('comprehensive-summary-total-rows')).toContainText('2');

      await saleFilter.selectOption('sale-alpha');
      await expect(alphaRow).toBeVisible();
      await expect(bravoRow).toHaveCount(0);
      await expect(directorUi.page.getByTestId('comprehensive-summary-total-rows')).toContainText('1');

      await saleFilter.selectOption('sale-bravo');
      await expect(alphaRow).toHaveCount(0);
      await expect(bravoRow).toBeVisible();
      await expect(directorUi.page.getByTestId('comprehensive-summary-total-rows')).toContainText('1');

      await saleFilter.selectOption('');
      await expect(alphaRow).toBeVisible();
      await expect(bravoRow).toBeVisible();
      await expect(directorUi.page.getByTestId('comprehensive-summary-total-rows')).toContainText('2');
    } finally {
      await closeActors(directorUi);
    }
  });

  test('B11 student report mo preview anh tu avatar trong bang', async ({
    browser,
    request,
  }) => {
    test.slow();

    const directorUi = await openRolePage(browser, request, 'director', '/app/dashboard');

    try {
      await directorUi.page.route('**/classes', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            { _id: 'class-student-preview', code: 'CLS-PREVIEW', name: 'Class Preview' },
          ]),
        });
      });
      await directorUi.page.route('**/students/report**', async (route) => {
        const url = new URL(route.request().url());
        const classId = url.searchParams.get('classId') || '';
        const searchTerm = (url.searchParams.get('searchTerm') || '').trim().toLowerCase();
        const row = {
          _id: 'student-preview-001',
          studentCode: 'HS-PREVIEW-001',
          fullName: 'Student Preview',
          age: 8,
          parentName: 'Parent Preview',
          parentPhone: '0900000100',
          faceImage: '/uploads/students/student-preview-001.jpg',
          totalAttendance: 4,
          productPackage: { name: 'English Preview Pack' },
        };
        const haystack = [row.fullName, row.parentName, row.parentPhone, row.studentCode]
          .join(' ')
          .toLowerCase();
        const matches =
          (!classId || classId === 'class-student-preview')
          && (!searchTerm || haystack.includes(searchTerm));

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(matches ? [row] : []),
        });
      });

      await directorUi.page.goto('/app/student-report');
      await directorUi.page.waitForLoadState('networkidle');

      const avatar = directorUi.page.locator('.student-avatar').first();
      await expect(avatar).toBeVisible();
      await expect(directorUi.page.locator('.report-table')).toContainText('Student Preview');
      await expect(avatar).toHaveAttribute('src', /student-preview-001\.jpg/i);

      await avatar.click();
      const modal = directorUi.page.locator('.modal');
      const modalImage = modal.locator('.modal-content img');
      await expect(modal).toBeVisible();
      await expect(modalImage).toHaveAttribute('src', /student-preview-001\.jpg/i);

      await modal.click();
      await expect(modal).toHaveCount(0);
    } finally {
      await closeActors(directorUi);
    }
  });
});
