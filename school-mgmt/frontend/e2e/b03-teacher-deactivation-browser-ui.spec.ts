import { expect, test, type APIRequestContext, type Browser } from '@playwright/test';
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

const API_ORIGIN_PATTERN = 'https?://(?:localhost|127\\.0\\.0\\.1):3000';
const TEACHERS_API = new RegExp(`${API_ORIGIN_PATTERN}/teachers(?:\\?.*)?$`);
const TEACHER_PROFILE_API = new RegExp(`${API_ORIGIN_PATTERN}/teachers/([^/]+)/profile(?:\\?.*)?$`);
const TEACHER_SUSPEND_API = new RegExp(`${API_ORIGIN_PATTERN}/teachers/([^/]+)/suspend(?:\\?.*)?$`);
const TEACHER_ACTIVATE_API = new RegExp(`${API_ORIGIN_PATTERN}/teachers/([^/]+)/activate(?:\\?.*)?$`);

type TeacherLinkedUser = {
  _id: string;
  userCode?: string;
  fullName: string;
  email: string;
  phone?: string;
  role?: string;
};

type TeacherProfile = {
  _id: string;
  userId: TeacherLinkedUser;
  managedSales?: TeacherLinkedUser[];
  subjects: string[];
  grades: string[];
  teachingMode: 'ONLINE' | 'OFFLINE' | 'BOTH';
  locations: string[];
  bio?: string;
  qualifications: Array<{ title: string }>;
  yearsOfExperience: number;
  availability: Array<{ day: string; startTime: string; endTime: string }>;
  pricePerSession: number;
  pricePerHour?: number;
  status: string;
  rating: number;
  totalReviews: number;
  totalSessions: number;
  activeClasses: number;
  bankInfo?: {
    bankName: string;
    accountNumber: string;
    accountHolderName: string;
    branch?: string;
  };
  adminNotes?: string;
};

type TeacherFullProfile = {
  profile: TeacherProfile;
  classes: {
    active: Array<{
      name: string;
      code: string;
      students: Array<{ fullName: string; studentCode: string }>;
      pricePerSession: number;
      teacherPayPerSession: number;
    }>;
    completed: any[];
    totalActive: number;
    totalCompleted: number;
  };
  sessions: {
    byStatus: Record<string, { count: number; totalPayout: number }>;
    totalCount: number;
    totalEarnings: number;
    recent: Array<{
      scheduledDate: string;
      classId: { name: string };
      studentId: { fullName: string };
      status: string;
      teacherPayout: number;
    }>;
  };
  payroll: {
    byStatus: Record<string, { count: number; totalAmount: number }>;
    totalPaid: number;
  };
};

type TeacherState = {
  teachers: TeacherProfile[];
  fullProfile: TeacherFullProfile;
  suspendCalls: Array<{ teacherId: string }>;
};

function appUrl(path: string): string {
  return new URL(path, APP_BASE_URL).toString();
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function buildTeacherState(): TeacherState {
  const managedSale: TeacherLinkedUser = {
    _id: 'sale-teacher-001',
    userCode: 'SALE001',
    fullName: 'Sale Alpha',
    email: 'sale.alpha@example.com',
    phone: '0905555555',
    role: 'SALE',
  };

  const teacherUser: TeacherLinkedUser = {
    _id: 'teacher-user-activate-001',
    userCode: 'GVLOCK001',
    fullName: 'Tran Thi Tam Ngung',
    email: 'teacher.deactivate@example.com',
    phone: '0901111222',
  };

  const teacherProfile: TeacherProfile = {
    _id: 'teacher-profile-deactivate-001',
    userId: teacherUser,
    managedSales: [managedSale],
    subjects: ['Tieng Anh'],
    grades: ['Lop 8'],
    teachingMode: 'BOTH',
    locations: ['Q1'],
    bio: 'Giao vien dang day on dinh cho lop offline va online.',
    qualifications: [{ title: 'TESOL' }],
    yearsOfExperience: 5,
    availability: [{ day: 'MONDAY', startTime: '18:00', endTime: '20:00' }],
    pricePerSession: 280000,
    pricePerHour: 160000,
    status: 'ACTIVE',
    rating: 4.6,
    totalReviews: 12,
    totalSessions: 31,
    activeClasses: 2,
    bankInfo: {
      bankName: 'ACB',
      accountNumber: '123123123',
      accountHolderName: 'TRAN THI TAM NGUNG',
      branch: 'Q1',
    },
  };

  return {
    teachers: [teacherProfile],
    fullProfile: {
      profile: teacherProfile,
      classes: {
        active: [
          {
            name: 'Lop IELTS 8A',
            code: 'CLS-IELTS-8A',
            students: [{ fullName: 'Hoc sinh A', studentCode: 'HS-A' }],
            pricePerSession: 280000,
            teacherPayPerSession: 160000,
          },
        ],
        completed: [],
        totalActive: 1,
        totalCompleted: 0,
      },
      sessions: {
        byStatus: {
          FINALIZED: {
            count: 4,
            totalPayout: 640000,
          },
        },
        totalCount: 4,
        totalEarnings: 640000,
        recent: [
          {
            scheduledDate: '2026-04-09T00:00:00.000Z',
            classId: { name: 'Lop IELTS 8A' },
            studentId: { fullName: 'Hoc sinh A' },
            status: 'FINALIZED',
            teacherPayout: 160000,
          },
        ],
      },
      payroll: {
        byStatus: {
          PAID: {
            count: 2,
            totalAmount: 320000,
          },
        },
        totalPaid: 320000,
      },
    },
    suspendCalls: [],
  };
}

async function openTeacherDeactivationPage(
  browser: Browser,
  request: APIRequestContext,
  scenario: string,
): Promise<BatchEvidenceSession> {
  const batch = await createBatchEvidenceContext(browser, {
    batchId: 'B03',
    scenario,
  });
  const session = await loginAsRole(request, 'director');
  await applySessionCookies(batch.page, session);
  return batch;
}

async function installTeacherRoutes(batch: BatchEvidenceSession, state: TeacherState): Promise<void> {
  await batch.page.route(TEACHERS_API, async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(clone(state.teachers)),
    });
  });

  await batch.page.route(TEACHER_PROFILE_API, async (route) => {
    const match = route.request().url().match(TEACHER_PROFILE_API);
    const teacherId = match?.[1] || '';
    if (teacherId !== state.fullProfile.profile._id) {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Teacher not found' }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(clone(state.fullProfile)),
    });
  });

  await batch.page.route(TEACHER_SUSPEND_API, async (route) => {
    if (route.request().method() !== 'POST') {
      await route.fallback();
      return;
    }

    const match = route.request().url().match(TEACHER_SUSPEND_API);
    const teacherId = match?.[1] || '';
    state.suspendCalls.push({ teacherId });

    if (teacherId !== state.fullProfile.profile._id) {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Teacher not found' }),
      });
      return;
    }

    state.fullProfile.profile = {
      ...state.fullProfile.profile,
      status: 'SUSPENDED',
      adminNotes: 'Locked from teacher-profiles browser flow.',
    };
    state.teachers = state.teachers.map((teacher) =>
      teacher._id === teacherId
        ? {
            ...teacher,
            status: 'SUSPENDED',
            adminNotes: 'Locked from teacher-profiles browser flow.',
          }
        : teacher,
    );

    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify(clone(state.fullProfile.profile)),
    });
  });

  await batch.page.route(TEACHER_ACTIVATE_API, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(clone(state.fullProfile.profile)),
    });
  });
}

test.use({
  trace: 'off',
  video: 'on',
});

test.describe.configure({ mode: 'serial', timeout: 120_000 });
test.setTimeout(120_000);

test('B03 teacher deactivation keeps strict confirm/status/action behavior on teacher profiles', async ({ browser, request }) => {
  const state = buildTeacherState();
  const batch = await openTeacherDeactivationPage(
    browser,
    request,
    'teacher_deactivation_browser',
  );

  try {
    await installTeacherRoutes(batch, state);

    const page = batch.page;
    await page.goto(appUrl('/app/teacher-profiles'));
    await page.waitForLoadState('domcontentloaded');

    const teacherCard = page.getByTestId(`teacher-card-${state.fullProfile.profile._id}`);
    await expect(teacherCard).toBeVisible();
    await expect(teacherCard).toContainText('Tran Thi Tam Ngung');
    await expect(teacherCard.getByTestId('teacher-list-status-badge')).toHaveText('Dang hoat dong');
    await batch.step('teacher-active-visible-on-list');

    await teacherCard.click();
    await expect(page).toHaveURL(new RegExp(`/app/teacher-profiles/${state.fullProfile.profile._id}$`));
    await expect(page.getByRole('heading', { name: 'Chi tiet giao vien' })).toBeVisible();
    await expect(page.getByTestId('teacher-detail-status-badge')).toHaveText('Dang hoat dong');
    await expect(page.getByTestId('teacher-suspend-button')).toBeVisible();
    await expect(page.getByTestId('teacher-activate-button')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Duyet' })).toHaveCount(0);

    let confirmMessage = '';
    page.once('dialog', async (dialog) => {
      confirmMessage = dialog.message();
      await dialog.accept();
    });

    await page.getByTestId('teacher-suspend-button').click();
    await expect.poll(() => confirmMessage).toBe('Vo hieu hoa giao vien nay?');
    await expect.poll(() => state.suspendCalls.length).toBe(1);
    expect(state.suspendCalls[0]).toEqual({
      teacherId: state.fullProfile.profile._id,
    });

    await expect(page.getByTestId('teacher-detail-status-badge')).toHaveText('Tam ngung');
    await expect(page.getByTestId('teacher-suspend-button')).toHaveCount(0);
    await expect(page.getByTestId('teacher-activate-button')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Duyet' })).toHaveCount(0);
    await batch.step('teacher-suspended-on-detail');

    await page.getByRole('button', { name: '← Quay lai' }).click();
    await expect(page).toHaveURL(/\/app\/teacher-profiles$/);
    await expect(page.getByTestId(`teacher-card-${state.fullProfile.profile._id}`)).toBeVisible();
    await expect(page.getByTestId(`teacher-card-${state.fullProfile.profile._id}`).getByTestId('teacher-list-status-badge')).toHaveText('Tam ngung');
    await page.getByTestId('teacher-status-filter').selectOption('SUSPENDED');
    await expect(page.getByTestId(`teacher-card-${state.fullProfile.profile._id}`)).toBeVisible();
    await batch.step('teacher-suspended-on-list');

    await batch.finalize('PASS', {
      extraLines: [
        'Verified the teacher profiles detail page shows a strict confirm dialog before deactivation and calls the suspend endpoint exactly once.',
        'Verified teacher status changes from ACTIVE to SUSPENDED on both detail and list without weakening the oracle.',
        'Verified invalid actions are hidden after deactivation: the suspend button disappears, approve stays hidden, and only the reactivate action remains visible.',
      ],
    });
  } catch (error) {
    await batch.finalize('FAIL', { error });
    throw error;
  }
});
