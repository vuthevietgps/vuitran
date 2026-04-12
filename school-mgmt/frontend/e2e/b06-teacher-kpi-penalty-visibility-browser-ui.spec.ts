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
const RUN_DATE =
  process.env['UI_EVIDENCE_DATE'] ||
  process.env['E2E_RUN_DATE'] ||
  '2026-04-11';

type TeacherKpiRow = {
  profileId: string;
  userId: string;
  fullName: string;
  email: string;
  phone: string;
  teacherStatus: 'ACTIVE' | 'APPROVED';
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
    totalPenalty: number;
    penaltySessionCount: number;
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
};

function appUrl(path: string): string {
  return new URL(path, APP_BASE_URL).toString();
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function formatPenalty(amount: number): string {
  const formatted = new Intl.NumberFormat('en-US').format(Math.abs(amount));
  return `${amount > 0 ? '-' : ''}${formatted}đ`;
}

function buildTeacherKpiState(): TeacherKpiState {
  return {
    summary: {
      totalTeachers: 2,
      activeTeachers: 1,
      avgKPI: 77,
      avgRating: 4.1,
      kpiDistribution: {
        excellent: 1,
        good: 1,
        average: 0,
        belowAverage: 0,
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
          totalRevenue: 5_600_000,
          totalPayout: 3_200_000,
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
          totalPaid: 3_100_000,
          payrollCount: 2,
          totalPenalty: 36_000,
          penaltySessionCount: 1,
        },
      },
      {
        profileId: 'teacher-kpi-profile-bravo',
        userId: 'teacher-kpi-user-bravo',
        fullName: 'Bravo Le',
        email: 'bravo.teacher@example.com',
        phone: '0901000102',
        teacherStatus: 'APPROVED',
        subjects: ['Vat ly'],
        grades: ['Lop 8'],
        profileRating: 4.2,
        yearsOfExperience: 4,
        kpiScore: 62,
        sessions: {
          total: 12,
          completed: 10,
          cancelled: 1,
          noShow: 1,
          completionRate: 83,
          totalRevenue: 2_900_000,
          totalPayout: 1_700_000,
        },
        reports: {
          submitted: 10,
          late: 0,
          submissionRate: 100,
          onTimeRate: 100,
        },
        evaluation: {
          avgStudentPerformance: 3.9,
          avgStudentEngagement: 4.0,
          avgComprehension: 3.8,
          evalCount: 8,
        },
        parentFeedback: {
          avgOverallRating: 3.5,
          avgTeachingQuality: 3.6,
          avgCommunication: 3.4,
          satisfactionRate: 80,
          feedbackCount: 6,
        },
        classes: {
          activeClasses: 2,
          totalStudents: 7,
        },
        payroll: {
          totalPaid: 1_650_000,
          payrollCount: 1,
          totalPenalty: 0,
          penaltySessionCount: 0,
        },
      },
    ],
  };
}

async function openTeacherKpiPage(
  browser: Browser,
  request: APIRequestContext,
  scenario: string,
): Promise<BatchEvidenceSession> {
  const evidence = await createBatchEvidenceContext(browser, {
    batchId: 'B06',
    scenario,
    runDate: RUN_DATE,
  });
  const session = await loginAsRole(request, 'director');
  await applySessionCookies(evidence.page, session);
  return evidence;
}

async function installTeacherKpiRoutes(page: Page, state: TeacherKpiState): Promise<void> {
  await page.context().route(TEACHER_KPI_API, async (route) => {
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

test.use({
  trace: 'off',
  video: 'on',
});

test('B06 teacher-kpi surfaces penalty as an exact standalone amount in table, cards, and detail modal', async ({
  browser,
  request,
}) => {
  const state = buildTeacherKpiState();
  const alpha = state.teachers[0];
  const bravo = state.teachers[1];
  const evidence = await openTeacherKpiPage(
    browser,
    request,
    'teacher_kpi_penalty_visibility_browser',
  );

  try {
    await installTeacherKpiRoutes(evidence.page, state);
    await evidence.page.goto(appUrl('/app/teacher-kpi'));
    await evidence.page.waitForLoadState('domcontentloaded');

    const alphaRow = evidence.page.locator('.data-table tbody tr').filter({ hasText: alpha.fullName }).first();
    const bravoRow = evidence.page.locator('.data-table tbody tr').filter({ hasText: bravo.fullName }).first();
    await expect(alphaRow).toBeVisible();
    await expect(bravoRow).toBeVisible();
    await expect(alphaRow.locator('.penalty-amount')).toHaveText(formatPenalty(alpha.payroll.totalPenalty));
    await expect(alphaRow.locator('.penalty-cell small')).toHaveText('1 buổi');
    await expect(bravoRow.locator('.penalty-amount')).toHaveText(formatPenalty(bravo.payroll.totalPenalty));
    await evidence.step('01_teacher_kpi_table_penalty_visibility');

    await evidence.page.getByRole('button', { name: 'Thẻ' }).click();
    const alphaCard = evidence.page.locator('.kpi-card').filter({ hasText: alpha.fullName }).first();
    await expect(alphaCard.locator('.teacher-penalty-inline')).toHaveText(`Phạt: ${formatPenalty(alpha.payroll.totalPenalty)}`);
    await evidence.step('02_teacher_kpi_card_penalty_visibility');

    await alphaCard.getByRole('button', { name: /Chi tiết/ }).click();
    const modal = evidence.page.locator('.modal-content');
    const financeCard = modal.locator('.detail-card').filter({ hasText: 'Tài chính' }).first();
    await expect(financeCard).toContainText('Tổng phạt:');
    await expect(financeCard).toContainText(formatPenalty(alpha.payroll.totalPenalty));
    await expect(financeCard).toContainText('Buổi bị phạt:');
    await expect(financeCard).toContainText(String(alpha.payroll.penaltySessionCount));
    await evidence.step('03_teacher_kpi_detail_penalty_visibility');

    await evidence.finalize('PASS', {
      extraLines: [
        'Browser evidence proves Teacher KPI no longer hides payroll penalty inside payout totals or detail-only metrics.',
        `The teacher row, card footer, and detail finance card all surface the exact penalty amount ${formatPenalty(alpha.payroll.totalPenalty)} for ${alpha.fullName}.`,
        `Teachers without penalty remain explicit at ${formatPenalty(bravo.payroll.totalPenalty)} instead of silently omitting the field.`,
      ],
    });
  } catch (error) {
    await evidence.finalize('FAIL', { error });
    throw error;
  }
});
