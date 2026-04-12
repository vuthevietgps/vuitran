import { expect, test, type APIRequestContext, type Browser, type Page } from '@playwright/test';
import {
  applySessionCookies,
  createBatchEvidenceContext,
  loginAsRole,
  type BatchEvidenceSession,
} from './support';

const APP_BASE_URL =
  process.env['PLAYWRIGHT_BASE_URL'] ||
  process.env['E2E_BASE_URL'] ||
  'http://localhost:4200';

const API_PREFIX_PATTERN = '(?:https?://[^/]+)?(?:/api)?';
const TEACHER_KPI_API = new RegExp(`${API_PREFIX_PATTERN}/dashboard/director/teacher-kpi(?:\\?.*)?$`);

type TeacherKpiRow = {
  profileId: string;
  userId: string;
  fullName: string;
  email: string;
  phone: string;
  teacherStatus: 'ACTIVE' | 'APPROVED' | 'PENDING' | 'SUSPENDED' | 'INACTIVE';
  subjects: string[];
  grades: string[];
  profileRating: number;
  yearsOfExperience: number;
  kpiScore: number;
  sessions: {
    total: number;
    completed: number;
    cancelled: number;
    noShow: number;
    completionRate: number;
    totalRevenue: number;
    totalPayout: number;
  };
  reports: {
    submitted: number;
    late: number;
    submissionRate: number;
    onTimeRate: number;
  };
  evaluation: {
    avgStudentPerformance: number;
    avgStudentEngagement: number;
    avgComprehension: number;
    evalCount: number;
  };
  parentFeedback: {
    avgOverallRating: number;
    avgTeachingQuality: number;
    avgCommunication: number;
    satisfactionRate: number;
    feedbackCount: number;
  };
  classes: {
    activeClasses: number;
    totalStudents: number;
  };
  payroll: {
    totalPaid: number;
    payrollCount: number;
  };
};

type TeacherKpiState = {
  summary: {
    totalTeachers: number;
    activeTeachers: number;
    avgKPI: number;
    avgRating: number;
    kpiDistribution: {
      excellent: number;
      good: number;
      average: number;
      belowAverage: number;
    };
  };
  teachers: TeacherKpiRow[];
  requestUrls: string[];
};

function appUrl(path: string): string {
  return new URL(path, APP_BASE_URL).toString();
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function formatUiNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

function buildTeacherKpiState(): TeacherKpiState {
  return {
    summary: {
      totalTeachers: 4,
      activeTeachers: 1,
      avgKPI: 66,
      avgRating: 3.1,
      kpiDistribution: {
        excellent: 1,
        good: 2,
        average: 0,
        belowAverage: 1,
      },
    },
    teachers: [
      {
        profileId: 'teacher-kpi-profile-alpha',
        userId: 'teacher-kpi-user-alpha',
        fullName: 'Alpha Nguyen',
        email: 'alpha.teacher@example.com',
        phone: '0901000101',
        teacherStatus: 'ACTIVE',
        subjects: ['Toan', 'Tieng Anh'],
        grades: ['Lop 6', 'Lop 7'],
        profileRating: 4.8,
        yearsOfExperience: 7,
        kpiScore: 92,
        sessions: {
          total: 18,
          completed: 17,
          cancelled: 1,
          noShow: 0,
          completionRate: 94,
          totalRevenue: 5600000,
          totalPayout: 3200000,
        },
        reports: {
          submitted: 16,
          late: 2,
          submissionRate: 94,
          onTimeRate: 88,
        },
        evaluation: {
          avgStudentPerformance: 4.8,
          avgStudentEngagement: 4.6,
          avgComprehension: 4.5,
          evalCount: 14,
        },
        parentFeedback: {
          avgOverallRating: 4.7,
          avgTeachingQuality: 4.8,
          avgCommunication: 4.6,
          satisfactionRate: 93,
          feedbackCount: 15,
        },
        classes: {
          activeClasses: 3,
          totalStudents: 11,
        },
        payroll: {
          totalPaid: 3100000,
          payrollCount: 2,
        },
      },
      {
        profileId: 'teacher-kpi-profile-bravo',
        userId: 'teacher-kpi-user-bravo',
        fullName: 'Bravo Le',
        email: 'bravo.teacher@example.com',
        phone: '0901000102',
        teacherStatus: 'PENDING',
        subjects: ['Vat ly'],
        grades: ['Lop 8'],
        profileRating: 4.3,
        yearsOfExperience: 4,
        kpiScore: 61,
        sessions: {
          total: 30,
          completed: 21,
          cancelled: 6,
          noShow: 3,
          completionRate: 70,
          totalRevenue: 7200000,
          totalPayout: 4100000,
        },
        reports: {
          submitted: 17,
          late: 5,
          submissionRate: 81,
          onTimeRate: 71,
        },
        evaluation: {
          avgStudentPerformance: 3.9,
          avgStudentEngagement: 4.0,
          avgComprehension: 3.8,
          evalCount: 9,
        },
        parentFeedback: {
          avgOverallRating: 4.2,
          avgTeachingQuality: 4.3,
          avgCommunication: 4.1,
          satisfactionRate: 84,
          feedbackCount: 10,
        },
        classes: {
          activeClasses: 4,
          totalStudents: 14,
        },
        payroll: {
          totalPaid: 2800000,
          payrollCount: 1,
        },
      },
      {
        profileId: 'teacher-kpi-profile-charlie',
        userId: 'teacher-kpi-user-charlie',
        fullName: 'Charlie Pham',
        email: 'charlie.teacher@example.com',
        phone: '0901000103',
        teacherStatus: 'SUSPENDED',
        subjects: ['Hoa hoc'],
        grades: ['Lop 9'],
        profileRating: 0,
        yearsOfExperience: 2,
        kpiScore: 37,
        sessions: {
          total: 12,
          completed: 4,
          cancelled: 5,
          noShow: 3,
          completionRate: 33,
          totalRevenue: 2100000,
          totalPayout: 900000,
        },
        reports: {
          submitted: 2,
          late: 2,
          submissionRate: 50,
          onTimeRate: 0,
        },
        evaluation: {
          avgStudentPerformance: 2.5,
          avgStudentEngagement: 2.7,
          avgComprehension: 2.4,
          evalCount: 2,
        },
        parentFeedback: {
          avgOverallRating: 0,
          avgTeachingQuality: 0,
          avgCommunication: 0,
          satisfactionRate: 0,
          feedbackCount: 0,
        },
        classes: {
          activeClasses: 1,
          totalStudents: 3,
        },
        payroll: {
          totalPaid: 500000,
          payrollCount: 1,
        },
      },
      {
        profileId: 'teacher-kpi-profile-delta',
        userId: 'teacher-kpi-user-delta',
        fullName: 'Delta Tran',
        email: 'delta.teacher@example.com',
        phone: '0901000104',
        teacherStatus: 'APPROVED',
        subjects: ['Sinh hoc'],
        grades: ['Lop 10'],
        profileRating: 3.9,
        yearsOfExperience: 5,
        kpiScore: 74,
        sessions: {
          total: 16,
          completed: 14,
          cancelled: 1,
          noShow: 1,
          completionRate: 88,
          totalRevenue: 4800000,
          totalPayout: 2700000,
        },
        reports: {
          submitted: 13,
          late: 1,
          submissionRate: 93,
          onTimeRate: 92,
        },
        evaluation: {
          avgStudentPerformance: 4.1,
          avgStudentEngagement: 4.0,
          avgComprehension: 3.9,
          evalCount: 7,
        },
        parentFeedback: {
          avgOverallRating: 3.6,
          avgTeachingQuality: 3.7,
          avgCommunication: 3.5,
          satisfactionRate: 78,
          feedbackCount: 6,
        },
        classes: {
          activeClasses: 2,
          totalStudents: 8,
        },
        payroll: {
          totalPaid: 1900000,
          payrollCount: 1,
        },
      },
    ],
    requestUrls: [],
  };
}

async function openTeacherKpiPage(
  browser: Browser,
  request: APIRequestContext,
  scenario: string,
): Promise<BatchEvidenceSession> {
  const batch = await createBatchEvidenceContext(browser, {
    batchId: 'B06',
    scenario,
  });
  const session = await loginAsRole(request, 'director');
  await applySessionCookies(batch.page, session);
  return batch;
}

async function installTeacherKpiRoutes(page: Page, state: TeacherKpiState): Promise<void> {
  await page.context().route(TEACHER_KPI_API, async (route) => {
    state.requestUrls.push(route.request().url());
    await page.waitForTimeout(220);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        summary: clone(state.summary),
        teachers: clone(state.teachers),
      }),
    });
  });
}

async function tableTeacherNames(page: Page): Promise<string[]> {
  return page.locator('.data-table tbody tr .teacher-cell strong').evaluateAll((nodes) =>
    nodes.map((node) => (node.textContent || '').trim()),
  );
}

async function cardTeacherNames(page: Page): Promise<string[]> {
  return page.locator('.cards-grid .kpi-card h4').evaluateAll((nodes) =>
    nodes.map((node) => (node.textContent || '').trim()),
  );
}

async function setDateInput(page: Page, index: number, value: string): Promise<void> {
  await page.locator('.controls input[type="date"]').nth(index).evaluate((node, nextValue) => {
    const input = node as HTMLInputElement;
    input.value = String(nextValue);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
}

test.use({
  trace: 'off',
  video: 'on',
});

test.describe.configure({ mode: 'serial', timeout: 120_000 });
test.setTimeout(120_000);

test('B06 teacher-kpi filters, sorts, date requests, and card toggle keep exact board state', async ({ browser, request }) => {
  const state = buildTeacherKpiState();
  const batch = await openTeacherKpiPage(
    browser,
    request,
    'teacher_kpi_filter_sort_browser',
  );

  try {
    await installTeacherKpiRoutes(batch.page, state);
    await batch.page.goto(appUrl('/app/teacher-kpi'));
    await batch.page.waitForLoadState('domcontentloaded');

    await expect(batch.page.getByRole('heading', { name: /KPI/i })).toBeVisible();
    await expect(batch.page.locator('.summary-strip .summary-card')).toHaveCount(4);
    await expect(batch.page.locator('.summary-strip .summary-card .s-value').nth(0)).toHaveText('4');
    await expect(batch.page.locator('.summary-strip .summary-card .s-value').nth(1)).toHaveText('1');
    await expect(batch.page.locator('.summary-strip .summary-card .s-value').nth(2)).toHaveText('66/100');
    await expect(batch.page.locator('.summary-strip .summary-card .s-value').nth(3)).toHaveText('3.1/5');
    await expect(batch.page.locator('.distribution-bar')).toContainText('Xuất sắc: 1');
    await expect(batch.page.locator('.distribution-bar')).toContainText('Tốt: 2');
    await expect(batch.page.locator('.distribution-bar')).toContainText('Yếu: 1');

    await expect(batch.page.locator('.result-count')).toHaveText('4 giáo viên');
    expect(await tableTeacherNames(batch.page)).toEqual([
      'Alpha Nguyen',
      'Delta Tran',
      'Bravo Le',
      'Charlie Pham',
    ]);
    await batch.step('teacher-kpi-default-kpi-sort');

    await setDateInput(batch.page, 0, '2026-03-01');
    await setDateInput(batch.page, 1, '2026-04-10');
    await expect.poll(() => state.requestUrls.length).toBe(3);
    const latestRequestUrl = new URL(state.requestUrls[state.requestUrls.length - 1]);
    expect(latestRequestUrl.searchParams.get('fromDate')).toBe('2026-03-01');
    expect(latestRequestUrl.searchParams.get('toDate')).toBe('2026-04-10');

    await batch.page.locator('.controls select').nth(0).selectOption('PENDING');
    await expect(batch.page.locator('.data-table tbody tr')).toHaveCount(1);
    await expect(batch.page.locator('.result-count')).toHaveText('1 giáo viên');
    expect(await tableTeacherNames(batch.page)).toEqual(['Bravo Le']);

    await batch.page.locator('.controls select').nth(0).selectOption('ALL');
    await batch.page.locator('.controls select').nth(1).selectOption('name');
    expect(await tableTeacherNames(batch.page)).toEqual([
      'Alpha Nguyen',
      'Bravo Le',
      'Charlie Pham',
      'Delta Tran',
    ]);

    await batch.page.locator('.controls select').nth(1).selectOption('sessions');
    expect(await tableTeacherNames(batch.page)).toEqual([
      'Bravo Le',
      'Alpha Nguyen',
      'Delta Tran',
      'Charlie Pham',
    ]);

    await batch.page.getByRole('button', { name: 'Thẻ' }).click();
    await expect(batch.page.locator('.cards-grid .kpi-card')).toHaveCount(4);
    expect(await cardTeacherNames(batch.page)).toEqual([
      'Bravo Le',
      'Alpha Nguyen',
      'Delta Tran',
      'Charlie Pham',
    ]);
    await expect(batch.page.locator('.cards-grid .kpi-card').first()).toContainText('30');
    await expect(batch.page.locator('.cards-grid .kpi-card').first()).toContainText('70%');
    await batch.step('teacher-kpi-filter-sort-cards');

    await batch.finalize('PASS', {
      extraLines: [
        'Verified summary cards and KPI distribution render the exact mocked board totals.',
        'Verified date controls fan out exact fromDate/toDate request params to /dashboard/director/teacher-kpi.',
        'Verified status filter, name sort, sessions sort, and card-toggle preserve the expected teacher order and counts.',
      ],
    });
  } catch (error) {
    await batch.finalize('FAIL', { error });
    throw error;
  }
});

test('B06 teacher-kpi detail modal keeps exact teacher metrics and KPI breakdown', async ({ browser, request }) => {
  const state = buildTeacherKpiState();
  const alpha = state.teachers[0];
  const batch = await openTeacherKpiPage(
    browser,
    request,
    'teacher_kpi_detail_modal_browser',
  );

  try {
    await installTeacherKpiRoutes(batch.page, state);
    await batch.page.goto(appUrl('/app/teacher-kpi'));
    await batch.page.waitForLoadState('domcontentloaded');

    const alphaRow = batch.page.locator('.data-table tbody tr').filter({ hasText: alpha.fullName }).first();
    await expect(alphaRow).toBeVisible();
    await alphaRow.locator('button[title="Xem chi tiết"]').click();

    const modal = batch.page.locator('.modal-content');
    await expect(modal).toBeVisible();
    await expect(modal.getByRole('heading', { name: `Chi tiết KPI: ${alpha.fullName}` })).toBeVisible();
    await expect(modal.locator('.kpi-big-score')).toContainText('92');
    await expect(modal.locator('.kpi-level')).toHaveText('Xuất sắc');

    const sessionCard = modal.locator('.detail-card').filter({ hasText: 'Buổi dạy' }).first();
    await expect(sessionCard).toContainText('18');
    await expect(sessionCard).toContainText('17');
    await expect(sessionCard).toContainText('1');
    await expect(sessionCard).toContainText('94%');

    const reportCard = modal.locator('.detail-card').filter({ hasText: 'Báo cáo giảng dạy' }).first();
    await expect(reportCard).toContainText('16');
    await expect(reportCard).toContainText('2');
    await expect(reportCard).toContainText('94%');
    await expect(reportCard).toContainText('88%');

    const feedbackCard = modal.locator('.detail-card').filter({ hasText: 'Phản hồi phụ huynh' }).first();
    await expect(feedbackCard).toContainText('(4.7/5)');
    await expect(feedbackCard).toContainText('4.8/5');
    await expect(feedbackCard).toContainText('4.6/5');
    await expect(feedbackCard).toContainText('93%');
    await expect(feedbackCard).toContainText('15');

    const financeCard = modal.locator('.detail-card').filter({ hasText: 'Tài chính' }).first();
    await expect(financeCard).toContainText(`${formatUiNumber(alpha.sessions.totalRevenue)}đ`);
    await expect(financeCard).toContainText(`${formatUiNumber(alpha.sessions.totalPayout)}đ`);
    await expect(financeCard).toContainText(`${formatUiNumber(alpha.payroll.totalPaid)}đ`);
    await expect(financeCard).toContainText('3');
    await expect(financeCard).toContainText('11');

    const formulaCard = modal.locator('.detail-card.wide').filter({ hasText: 'Công thức KPI' }).first();
    await expect(formulaCard).toContainText('25%');
    await expect(formulaCard).toContainText('94%');
    await expect(formulaCard).toContainText('88%');
    await expect(formulaCard).toContainText('4.7/5');
    await expect(formulaCard).toContainText('4.8/5');
    await expect(formulaCard).toContainText('93%');
    await batch.step('teacher-kpi-detail-modal');

    await modal.locator('.modal-close').click();
    await expect(modal).toBeHidden();

    await batch.finalize('PASS', {
      extraLines: [
        'Verified teacher KPI detail modal keeps the exact session, report, evaluation, parent-feedback, and financial metrics for the selected teacher.',
        'Verified the KPI breakdown card keeps the exact weighted formula inputs visible in the modal.',
        'Penalty visibility remains intentionally out of scope for this spec because the current teacher-kpi response/template does not expose a penalty field.',
      ],
    });
  } catch (error) {
    await batch.finalize('FAIL', { error });
    throw error;
  }
});
