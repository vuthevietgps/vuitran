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
const SESSIONS_API = new RegExp(`${API_PREFIX_PATTERN}/sessions(?:\\?.*)?$`);
const TEACHING_REPORT_API = new RegExp(`${API_PREFIX_PATTERN}/sessions/([^/]+)/teaching-report(?:\\?.*)?$`);
const PAYROLL_PREVIEW_API = new RegExp(`${API_PREFIX_PATTERN}/payroll/teacher-preview(?:\\?.*)?$`);
const REPORT_TEMPLATES_API = new RegExp(`${API_PREFIX_PATTERN}/report-templates(?:\\?.*)?$`);

type ReportTemplate = {
  _id: string;
  teacherId: string;
  classId?: string;
  title: string;
  templateContent: string;
  isGlobal?: boolean;
  createdAt?: string;
};

type ReportFormValues = {
  lessonContent: string;
  studentAttitude: string;
  recordingUrl: string;
  teacherComment: string;
  homework: string;
  additionalNotes: string;
};

type SessionItem = {
  _id: string;
  classId: { _id: string; name: string; code: string };
  studentId: { _id: string; fullName: string; studentCode?: string };
  teacherId: { _id: string; fullName: string; email?: string };
  scheduledDate: string;
  scheduledStartTime: string;
  scheduledEndTime: string;
  durationMinutes: number;
  amountCharged: number;
  teacherPayout: number;
  status: string;
  isPaid: boolean;
  isTeacherPaid: boolean;
  hasTeachingReport: boolean;
  teachingReport?: (ReportFormValues & { submittedAt?: string; isLateSubmission?: boolean }) | null;
};

type PayrollPreview = {
  teacherId: string;
  periodStart: string;
  periodEnd: string;
  summary: {
    totalSessions: number;
    totalAttended: number;
    eligibleForPayroll: number;
    missingReport: number;
    pendingParentConfirm: number;
    pendingFinalize: number;
    finalizedNoReport: number;
    alreadyPaid: number;
    cancelled: number;
    noShow: number;
  };
  amounts: {
    totalEligiblePayout: number;
    totalAlreadyPaid: number;
    totalBlockedByReport: number;
    totalPendingConfirm: number;
    totalPendingFinalize: number;
    totalAttendedPayout: number;
  };
  sessions: Array<{
    _id: string;
    classId?: { _id: string; name: string; code: string };
    studentId?: { _id: string; fullName: string; studentCode?: string };
    scheduledDate: string;
    durationMinutes: number;
    teacherPayout: number;
    status: string;
    hasTeachingReport: boolean;
    isTeacherPaid: boolean;
    isPaid: boolean;
    payrollStatus: string;
  }>;
  existingPayrolls: any[];
};

type TeachingReportState = {
  pendingSessions: SessionItem[];
  completedSessions: SessionItem[];
  templates: ReportTemplate[];
  preview: PayrollPreview;
  submitCalls: Array<{ sessionId: string; payload: ReportFormValues }>;
};

function appUrl(path: string): string {
  return new URL(path, APP_BASE_URL).toString();
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function currentDateText(): string {
  return new Date().toISOString().slice(0, 10);
}

function emptyReportForm(): ReportFormValues {
  return {
    lessonContent: '',
    studentAttitude: '',
    recordingUrl: '',
    teacherComment: '',
    homework: '',
    additionalNotes: '',
  };
}

function draftStorageKey(sessionId: string): string {
  return `teaching-report-draft-${sessionId}`;
}

function buildTeachingReportState(): TeachingReportState {
  const scheduledDate = currentDateText();
  const pendingSession: SessionItem = {
    _id: 'session-report-template-001',
    classId: {
      _id: 'class-report-template-001',
      name: 'Lop Speaking 6A',
      code: 'CLS-SPK-6A',
    },
    studentId: {
      _id: 'student-report-template-001',
      fullName: 'Pham Minh Anh',
      studentCode: 'HS-6001',
    },
    teacherId: {
      _id: 'teacher-report-template-001',
      fullName: 'Nguyen Thi Template',
      email: 'teacher.demo@school.local',
    },
    scheduledDate,
    scheduledStartTime: '18:00',
    scheduledEndTime: '19:00',
    durationMinutes: 60,
    amountCharged: 320000,
    teacherPayout: 180000,
    status: 'TEACHER_COMPLETED',
    isPaid: false,
    isTeacherPaid: false,
    hasTeachingReport: false,
    teachingReport: null,
  };

  const templates: ReportTemplate[] = [
    {
      _id: 'tpl-own-speaking-001',
      teacherId: 'teacher-report-template-001',
      title: 'Speaking Drill Template',
      templateContent: 'Vocabulary focus, pronunciation drills, and role-play speaking practice for the main topic.',
      isGlobal: false,
      createdAt: '2026-04-10T01:00:00.000Z',
    },
    {
      _id: 'tpl-global-homework-001',
      teacherId: 'system-global',
      title: 'Global Homework Wrap-up',
      templateContent: 'Grammar recap, sentence correction, and homework follow-up for the next learning block.',
      isGlobal: true,
      createdAt: '2026-04-01T01:00:00.000Z',
    },
  ];

  return {
    pendingSessions: [pendingSession],
    completedSessions: [],
    templates,
    preview: {
      teacherId: pendingSession.teacherId._id,
      periodStart: `${scheduledDate.slice(0, 7)}-01`,
      periodEnd: `${scheduledDate.slice(0, 7)}-30`,
      summary: {
        totalSessions: 1,
        totalAttended: 1,
        eligibleForPayroll: 0,
        missingReport: 1,
        pendingParentConfirm: 0,
        pendingFinalize: 0,
        finalizedNoReport: 0,
        alreadyPaid: 0,
        cancelled: 0,
        noShow: 0,
      },
      amounts: {
        totalEligiblePayout: 0,
        totalAlreadyPaid: 0,
        totalBlockedByReport: 180000,
        totalPendingConfirm: 0,
        totalPendingFinalize: 0,
        totalAttendedPayout: 180000,
      },
      sessions: [
        {
          _id: pendingSession._id,
          classId: clone(pendingSession.classId),
          studentId: clone(pendingSession.studentId),
          scheduledDate,
          durationMinutes: pendingSession.durationMinutes,
          teacherPayout: pendingSession.teacherPayout,
          status: pendingSession.status,
          hasTeachingReport: false,
          isTeacherPaid: false,
          isPaid: false,
          payrollStatus: 'BLOCKED_NO_REPORT',
        },
      ],
      existingPayrolls: [],
    },
    submitCalls: [],
  };
}

function sessionListBody(sessions: SessionItem[]) {
  return {
    data: clone(sessions),
    meta: {
      total: sessions.length,
      page: 1,
      limit: 20,
      totalPages: Math.max(1, sessions.length || 1),
    },
  };
}

async function openTeachingReportTemplatePage(
  browser: Browser,
  request: APIRequestContext,
  scenario: string,
): Promise<BatchEvidenceSession> {
  const batch = await createBatchEvidenceContext(browser, {
    batchId: 'B06',
    scenario,
  });
  const session = await loginAsRole(request, 'teacher');
  await applySessionCookies(batch.page, session);
  return batch;
}

async function installTeachingReportRoutes(page: Page, state: TeachingReportState): Promise<void> {
  const context = page.context();

  await context.route(SESSIONS_API, async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }

    const url = new URL(route.request().url());
    const hasReport = url.searchParams.get('hasReport');
    const body = hasReport === 'true'
      ? sessionListBody(state.completedSessions)
      : sessionListBody(state.pendingSessions);

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  });

  await context.route(REPORT_TEMPLATES_API, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(clone(state.templates)),
    });
  });

  await context.route(PAYROLL_PREVIEW_API, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(clone(state.preview)),
    });
  });

  await context.route(TEACHING_REPORT_API, async (route) => {
    if (route.request().method() !== 'PATCH') {
      await route.fallback();
      return;
    }

    const match = route.request().url().match(TEACHING_REPORT_API);
    const sessionId = match?.[1] || '';
    const payload = route.request().postDataJSON() as ReportFormValues;
    state.submitCalls.push({
      sessionId,
      payload: clone(payload),
    });

    const session = state.pendingSessions.find((item) => item._id === sessionId)
      || state.completedSessions.find((item) => item._id === sessionId);

    if (!session) {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Session not found' }),
      });
      return;
    }

    const updatedSession: SessionItem = {
      ...clone(session),
      hasTeachingReport: true,
      teachingReport: {
        ...clone(payload),
        submittedAt: '2026-04-10T03:45:00.000Z',
        isLateSubmission: false,
      },
    };

    state.pendingSessions = state.pendingSessions.filter((item) => item._id !== sessionId);
    state.completedSessions = [updatedSession];
    state.preview.summary.missingReport = 0;
    state.preview.summary.eligibleForPayroll = 1;
    state.preview.amounts.totalBlockedByReport = 0;
    state.preview.amounts.totalEligiblePayout = session.teacherPayout;
    state.preview.sessions = [
      {
        ...clone(state.preview.sessions[0]),
        hasTeachingReport: true,
        payrollStatus: 'ELIGIBLE',
      },
    ];

    await page.waitForTimeout(300);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(clone(updatedSession)),
    });
  });
}

async function openPendingForm(
  batch: BatchEvidenceSession,
  sessionId: string,
): Promise<Page> {
  await batch.page.goto(appUrl('/app/teaching-report'));
  await batch.page.waitForLoadState('domcontentloaded');
  await expect(batch.page.getByTestId('report-tab-pending')).toBeVisible();
  await expect(batch.page.getByTestId(`report-pending-card-${sessionId}`)).toBeVisible();
  await batch.page.getByTestId(`report-pending-expand-${sessionId}`).click();
  await expect(batch.page.getByTestId(`report-pending-form-${sessionId}`)).toBeVisible();
  return batch.page;
}

async function readDraft(page: Page, key: string): Promise<ReportFormValues | null> {
  return page.evaluate((storageKey) => {
    const raw = window.sessionStorage.getItem(storageKey);
    return raw ? JSON.parse(raw) : null;
  }, key);
}

test.use({
  trace: 'off',
  video: 'on',
});

test.describe.configure({ mode: 'serial', timeout: 120_000 });
test.setTimeout(120_000);

test('B06 teaching-report template apply submits exact payload and clears draft on success', async ({ browser, request }) => {
  const state = buildTeachingReportState();
  const sessionId = state.pendingSessions[0]._id;
  const ownTemplate = state.templates[0];
  const globalTemplate = state.templates[1];
  const storageKey = draftStorageKey(sessionId);
  const finalPayload: ReportFormValues = {
    lessonContent: globalTemplate.templateContent,
    studentAttitude: 'Student stayed focused and answered every speaking drill confidently.',
    recordingUrl: 'https://example.com/teaching-report/template-browser',
    teacherComment: 'Template-based report kept the teacher note structure consistent.',
    homework: 'Prepare the dialogue sheet and review the grammar recap.',
    additionalNotes: 'Parent requested a short speaking recap for the next session.',
  };

  const batch = await openTeachingReportTemplatePage(
    browser,
    request,
    'teaching_report_template_apply_submit_browser',
  );

  try {
    await installTeachingReportRoutes(batch.page, state);
    const page = await openPendingForm(batch, sessionId);
    const form = page.getByTestId(`report-pending-form-${sessionId}`);
    const templateSelect = form.getByTestId('report-template-select');

    const optgroupLabels = await templateSelect.locator('optgroup').evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute('label') || ''),
    );
    expect(optgroupLabels).toEqual(['Template của bạn', 'Template chung']);

    const optionTitles = await templateSelect.locator('option').evaluateAll((nodes) =>
      nodes
        .map((node) => (node.textContent || '').trim())
        .filter((text) => text !== ''),
    );
    expect(optionTitles).toContain(ownTemplate.title);
    expect(optionTitles).toContain(globalTemplate.title);

    await templateSelect.selectOption(ownTemplate._id);
    await expect(form.getByTestId('report-lesson-content')).toHaveValue(ownTemplate.templateContent);
    await expect(form.getByTestId('report-student-attitude')).toHaveValue('');
    await expect(form.getByTestId('report-homework')).toHaveValue('');
    await expect(templateSelect).toHaveValue('');
    await expect.poll(() => readDraft(page, storageKey)).toEqual({
      ...emptyReportForm(),
      lessonContent: ownTemplate.templateContent,
    });

    await templateSelect.selectOption(globalTemplate._id);
    await expect(form.getByTestId('report-lesson-content')).toHaveValue(globalTemplate.templateContent);
    await expect(form.getByTestId('report-teacher-comment')).toHaveValue('');
    await expect(templateSelect).toHaveValue('');

    await form.getByTestId('report-student-attitude').fill(finalPayload.studentAttitude);
    await form.getByTestId('report-recording-url').fill(finalPayload.recordingUrl);
    await form.getByTestId('report-teacher-comment').fill(finalPayload.teacherComment);
    await form.getByTestId('report-homework').fill(finalPayload.homework);
    await form.getByTestId('report-additional-notes').fill(finalPayload.additionalNotes);

    await expect.poll(() => readDraft(page, storageKey)).toEqual(finalPayload);
    await batch.step('template-apply-and-draft-saved');

    await form.getByTestId('report-submit').click();
    await expect.poll(() => state.submitCalls.length).toBe(1);
    expect(state.submitCalls[0]).toEqual({
      sessionId,
      payload: finalPayload,
    });
    await expect(page.locator('.alert-success')).toBeVisible();
    await expect.poll(() => readDraft(page, storageKey)).toBeNull();
    await expect(page.getByTestId('report-pending-empty')).toBeVisible();

    await page.getByTestId('report-tab-completed').click();
    const completedCard = page.locator('.session-card.completed').filter({ hasText: state.completedSessions[0].classId.name }).first();
    await expect(completedCard).toBeVisible();
    await completedCard.locator('.session-header').click();
    await expect(completedCard.locator('.report-view')).toContainText(finalPayload.lessonContent);
    await expect(completedCard.locator('.report-view')).toContainText(finalPayload.teacherComment);
    await batch.step('template-submit-completed-view');

    await batch.finalize('PASS', {
      extraLines: [
        'Verified own/global report-template groups render separately in the pending teaching-report form.',
        'Verified selecting a template only prefills lessonContent, resets the select, and autosaves the draft under the sessionStorage draft key.',
        'Verified submit keeps the exact report payload, clears the draft, and moves the session from pending to completed.',
      ],
    });
  } catch (error) {
    await batch.finalize('FAIL', { error });
    throw error;
  }
});

test('B06 teaching-report draft restore keeps templated content across collapse and reload', async ({ browser, request }) => {
  const state = buildTeachingReportState();
  const sessionId = state.pendingSessions[0]._id;
  const ownTemplate = state.templates[0];
  const storageKey = draftStorageKey(sessionId);
  const draftSnapshot: ReportFormValues = {
    lessonContent: ownTemplate.templateContent,
    studentAttitude: '',
    recordingUrl: '',
    teacherComment: 'Draft note stays in progress before final submit.',
    homework: 'Finish the pronunciation worksheet.',
    additionalNotes: '',
  };

  const batch = await openTeachingReportTemplatePage(
    browser,
    request,
    'teaching_report_template_draft_restore_browser',
  );

  try {
    await installTeachingReportRoutes(batch.page, state);
    let page = await openPendingForm(batch, sessionId);
    let form = page.getByTestId(`report-pending-form-${sessionId}`);

    await form.getByTestId('report-template-select').selectOption(ownTemplate._id);
    await expect(form.getByTestId('report-lesson-content')).toHaveValue(ownTemplate.templateContent);
    await form.getByTestId('report-teacher-comment').fill(draftSnapshot.teacherComment);
    await form.getByTestId('report-homework').fill(draftSnapshot.homework);

    await expect.poll(() => readDraft(page, storageKey)).toEqual(draftSnapshot);
    await batch.step('template-draft-before-collapse');

    await form.getByTestId('report-cancel').click();
    await expect(page.getByTestId(`report-pending-form-${sessionId}`)).toBeHidden();

    await page.getByTestId(`report-pending-expand-${sessionId}`).click();
    form = page.getByTestId(`report-pending-form-${sessionId}`);
    await expect(form).toBeVisible();
    await expect(form.getByTestId('report-template-select')).toHaveValue('');
    await expect(form.getByTestId('report-lesson-content')).toHaveValue(draftSnapshot.lessonContent);
    await expect(form.getByTestId('report-teacher-comment')).toHaveValue(draftSnapshot.teacherComment);
    await expect(form.getByTestId('report-homework')).toHaveValue(draftSnapshot.homework);

    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByTestId(`report-pending-card-${sessionId}`)).toBeVisible();
    await page.getByTestId(`report-pending-expand-${sessionId}`).click();
    form = page.getByTestId(`report-pending-form-${sessionId}`);
    await expect(form).toBeVisible();
    await expect(form.getByTestId('report-template-select')).toHaveValue('');
    await expect(form.getByTestId('report-lesson-content')).toHaveValue(draftSnapshot.lessonContent);
    await expect(form.getByTestId('report-teacher-comment')).toHaveValue(draftSnapshot.teacherComment);
    await expect(form.getByTestId('report-homework')).toHaveValue(draftSnapshot.homework);
    await expect.poll(() => readDraft(page, storageKey)).toEqual(draftSnapshot);
    await batch.step('template-draft-restored-after-reload');

    await batch.finalize('PASS', {
      extraLines: [
        'Verified a template-applied teaching-report draft persists in sessionStorage under the session-specific draft key.',
        'Verified collapse/reopen and full page reload both restore the templated lessonContent and other draft fields exactly.',
        'Verified the template select itself resets to empty after apply and stays empty when the restored draft is loaded.',
      ],
    });
  } catch (error) {
    await batch.finalize('FAIL', { error });
    throw error;
  }
});
