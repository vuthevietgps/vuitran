import { expect, test, type APIRequestContext, type Browser, type Page } from '@playwright/test';
import {
  applySessionCookies,
  createBatchEvidenceContext,
  loginAsRole,
  type BatchEvidenceSession,
} from './support';

const APP_BASE_URL = process.env['PLAYWRIGHT_BASE_URL'] || process.env['E2E_BASE_URL'] || 'http://localhost:4200';
const API_PREFIX_PATTERN = '(?:https?://[^/]+)?(?:/api)?';
const SESSIONS_API = new RegExp(`${API_PREFIX_PATTERN}/sessions(?:\\?.*)?$`);
const TEACHING_REPORT_API = new RegExp(`${API_PREFIX_PATTERN}/sessions/([^/]+)/teaching-report(?:\\?.*)?$`);
const PAYROLL_PREVIEW_API = new RegExp(`${API_PREFIX_PATTERN}/payroll/teacher-preview(?:\\?.*)?$`);
const REPORT_TEMPLATES_API = new RegExp(`${API_PREFIX_PATTERN}/report-templates(?:\\?.*)?$`);

type DynamicField = { key: string; label: string; type: 'text' | 'textarea' | 'url'; required?: boolean; order?: number; maxLength?: number };
type ReportTemplate = { _id: string; teacherId: string; classId?: string; title: string; templateContent: string; version?: number; dynamicFields?: DynamicField[]; isGlobal?: boolean };
type ReportFormValues = {
  lessonContent: string;
  studentAttitude: string;
  recordingUrl: string;
  teacherComment: string;
  homework: string;
  additionalNotes: string;
  templateId?: string;
  templateTitle?: string;
  templateVersion?: number;
  dynamicFieldValues?: Record<string, string | number | boolean>;
  dynamicFieldSchemaSnapshot?: DynamicField[];
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
type TeachingReportState = {
  pendingSessions: SessionItem[];
  completedSessions: SessionItem[];
  templates: ReportTemplate[];
  preview: Record<string, unknown>;
  submitCalls: Array<{ sessionId: string; payload: ReportFormValues }>;
};

function appUrl(path: string): string { return new URL(path, APP_BASE_URL).toString(); }
function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }
function currentDateText(): string { return new Date().toISOString().slice(0, 10); }
function sessionListBody(sessions: SessionItem[]) { return { data: clone(sessions), meta: { total: sessions.length, page: 1, limit: 20, totalPages: Math.max(1, sessions.length || 1) } }; }

function buildState(): TeachingReportState {
  const scheduledDate = currentDateText();
  const pendingSession: SessionItem = {
    _id: 'session-dynamic-report-001',
    classId: { _id: 'class-dynamic-report-001', name: 'Lớp Cambridge Movers', code: 'CLS-CAM-01' },
    studentId: { _id: 'student-dynamic-report-001', fullName: 'Trần Gia Hân', studentCode: 'HS-6101' },
    teacherId: { _id: 'teacher-dynamic-report-001', fullName: 'Nguyễn Dynamic', email: 'teacher.dynamic@school.local' },
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

  const dynamicFields: DynamicField[] = [
    { key: 'vocabulary', label: 'Từ vựng', type: 'textarea', required: true, order: 1, maxLength: 500 },
    { key: 'grammar', label: 'Ngữ pháp', type: 'textarea', required: true, order: 2, maxLength: 500 },
    { key: 'pronunciation', label: 'Phát âm', type: 'textarea', required: true, order: 3, maxLength: 500 },
    { key: 'homework', label: 'Bài tập về nhà', type: 'textarea', required: false, order: 4, maxLength: 500 },
  ];

  return {
    pendingSessions: [pendingSession],
    completedSessions: [],
    templates: [
      {
        _id: 'tpl-dynamic-class-001',
        teacherId: pendingSession.teacherId._id,
        classId: pendingSession.classId._id,
        title: 'Template Từ vựng / Ngữ pháp / Phát âm',
        templateContent: 'Legacy summary fallback for dynamic teaching report.',
        version: 3,
        dynamicFields,
        isGlobal: false,
      },
      {
        _id: 'tpl-other-class-001',
        teacherId: pendingSession.teacherId._id,
        classId: 'class-other-999',
        title: 'Template lớp khác không được render',
        templateContent: 'Should stay hidden because classId does not match.',
        version: 1,
        dynamicFields: [{ key: 'other', label: 'Other', type: 'textarea', required: true, order: 1 }],
        isGlobal: false,
      },
    ],
    preview: {
      teacherId: pendingSession.teacherId._id,
      periodStart: `${scheduledDate.slice(0, 7)}-01`,
      periodEnd: `${scheduledDate.slice(0, 7)}-30`,
      summary: { totalSessions: 1, totalAttended: 1, eligibleForPayroll: 0, missingReport: 1, pendingParentConfirm: 0, pendingFinalize: 0, finalizedNoReport: 0, alreadyPaid: 0, cancelled: 0, noShow: 0 },
      amounts: { totalEligiblePayout: 0, totalAlreadyPaid: 0, totalBlockedByReport: 180000, totalPendingConfirm: 0, totalPendingFinalize: 0, totalAttendedPayout: 180000 },
      sessions: [{ _id: pendingSession._id, classId: clone(pendingSession.classId), studentId: clone(pendingSession.studentId), scheduledDate, durationMinutes: pendingSession.durationMinutes, teacherPayout: pendingSession.teacherPayout, status: pendingSession.status, hasTeachingReport: false, isTeacherPaid: false, isPaid: false, payrollStatus: 'BLOCKED_NO_REPORT' }],
      existingPayrolls: [],
    },
    submitCalls: [],
  };
}

async function openPage(browser: Browser, request: APIRequestContext, scenario: string): Promise<BatchEvidenceSession> {
  const batch = await createBatchEvidenceContext(browser, { batchId: 'B06', scenario });
  const session = await loginAsRole(request, 'teacher');
  await applySessionCookies(batch.page, session);
  return batch;
}

async function installRoutes(page: Page, state: TeachingReportState): Promise<void> {
  const context = page.context();
  await context.route(SESSIONS_API, async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    const hasReport = new URL(route.request().url()).searchParams.get('hasReport');
    const body = hasReport === 'true' ? sessionListBody(state.completedSessions) : sessionListBody(state.pendingSessions);
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await context.route(REPORT_TEMPLATES_API, async (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(clone(state.templates)) }));
  await context.route(PAYROLL_PREVIEW_API, async (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(clone(state.preview)) }));
  await context.route(TEACHING_REPORT_API, async (route) => {
    if (route.request().method() !== 'PATCH') return route.fallback();
    const payload = (await route.request().postDataJSON()) as ReportFormValues;
    const match = route.request().url().match(TEACHING_REPORT_API);
    const sessionId = match?.[1] || '';
    state.submitCalls.push({ sessionId, payload: clone(payload) });
    const session = state.pendingSessions.find((item) => item._id === sessionId);
    if (!session) return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ message: 'Session not found' }) });
    session.hasTeachingReport = true;
    session.teachingReport = { ...clone(payload), submittedAt: new Date().toISOString(), isLateSubmission: false };
    state.completedSessions = [{ ...clone(session) }, ...state.completedSessions];
    state.pendingSessions = state.pendingSessions.filter((item) => item._id !== sessionId);
    state.preview = {
      ...state.preview,
      ['summary']: {
        ...(state.preview['summary'] as Record<string, unknown>),
        eligibleForPayroll: 1,
        missingReport: 0,
      },
      ['sessions']: [
        {
          ...((state.preview['sessions'] as Array<Record<string, unknown>>)[0] || {}),
          hasTeachingReport: true,
          payrollStatus: 'READY',
        },
      ],
    };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(clone(session)) });
  });
}

async function openPendingForm(batch: BatchEvidenceSession, sessionId: string): Promise<Page> {
  await batch.page.goto(appUrl('/app/teaching-report'));
  await batch.page.waitForLoadState('domcontentloaded');
  await expect(batch.page.getByTestId('report-tab-pending')).toBeVisible();
  await expect(batch.page.getByTestId(`report-pending-card-${sessionId}`)).toBeVisible();
  await batch.page.getByTestId(`report-pending-expand-${sessionId}`).click();
  await expect(batch.page.getByTestId(`report-pending-form-${sessionId}`)).toBeVisible();
  return batch.page;
}

test('B06 teaching-report dynamic fields render validate and persist by applied template', async ({ browser, request }) => {
  const state = buildState();
  const sessionId = state.pendingSessions[0]._id;
  const dynamicTemplate = state.templates[0];
  const payload: ReportFormValues = {
    lessonContent: [
      'Từ vựng: ecosystem, habitat, preserve',
      'Ngữ pháp: Students practiced comparative adjectives in context.',
      'Phát âm: Teacher corrected /θ/ and /ð/ sounds carefully.',
      'Bài tập về nhà: Write 5 sentences comparing two animals.',
    ].join('\n'),
    studentAttitude: '',
    recordingUrl: '',
    teacherComment: '',
    homework: 'Write 5 sentences comparing two animals.',
    additionalNotes: '',
    templateId: dynamicTemplate._id,
    templateTitle: dynamicTemplate.title,
    templateVersion: dynamicTemplate.version,
    dynamicFieldValues: {
      vocabulary: 'ecosystem, habitat, preserve',
      grammar: 'Students practiced comparative adjectives in context.',
      pronunciation: 'Teacher corrected /θ/ and /ð/ sounds carefully.',
      homework: 'Write 5 sentences comparing two animals.',
    },
    dynamicFieldSchemaSnapshot: clone(dynamicTemplate.dynamicFields || []),
  };

  const batch = await openPage(browser, request, 'teaching_report_dynamic_fields_browser');
  try {
    await installRoutes(batch.page, state);
    const page = await openPendingForm(batch, sessionId);
    const form = page.getByTestId(`report-pending-form-${sessionId}`);
    const select = form.getByTestId('report-template-select');

    const optionTitles = await select.locator('option').evaluateAll((nodes) => nodes.map((node) => (node.textContent || '').trim()).filter((text) => text));
    expect(optionTitles).toContain(dynamicTemplate.title);
    expect(optionTitles).not.toContain('Template lớp khác không được render');

    await select.selectOption(dynamicTemplate._id);
    await expect(form.getByTestId('report-active-template')).toContainText(dynamicTemplate.title);
    await expect(form.getByTestId('report-dynamic-field-vocabulary')).toBeVisible();
    await expect(form.getByTestId('report-dynamic-field-grammar')).toBeVisible();
    await expect(form.getByTestId('report-dynamic-field-pronunciation')).toBeVisible();
    await expect(form.getByTestId('report-dynamic-field-homework')).toBeVisible();
    await expect(form.getByTestId('report-lesson-content')).toHaveCount(0);

    await form.getByTestId('report-dynamic-field-vocabulary').fill(String(payload.dynamicFieldValues?.['vocabulary'] || ''));
    await form.getByTestId('report-submit').click();
    await expect(form).toContainText('Ngữ pháp không được để trống');
    await expect.poll(() => state.submitCalls.length).toBe(0);

    await form.getByTestId('report-dynamic-field-grammar').fill(String(payload.dynamicFieldValues?.['grammar'] || ''));
    await form.getByTestId('report-dynamic-field-pronunciation').fill(String(payload.dynamicFieldValues?.['pronunciation'] || ''));
    await form.getByTestId('report-dynamic-field-homework').fill(String(payload.dynamicFieldValues?.['homework'] || ''));
    await form.getByTestId('report-submit').click();

    await expect.poll(() => state.submitCalls.length).toBe(1);
    expect(state.submitCalls[0]).toEqual({ sessionId, payload });
    await expect(page.locator('.alert-success')).toBeVisible();
    await expect(page.getByTestId('report-pending-empty')).toBeVisible();
    await batch.step('dynamic-template-submit-success');

    await page.getByTestId('report-tab-completed').click();
    const completedCard = page.locator('.session-card.completed').filter({ hasText: state.completedSessions[0].classId.name }).first();
    await expect(completedCard).toBeVisible();
    await completedCard.locator('.session-header').click();
    const reportView = completedCard.locator('.report-view');
    await expect(reportView).toContainText('Từ vựng');
    await expect(reportView).toContainText('ecosystem, habitat, preserve');
    await expect(reportView).toContainText('Ngữ pháp');
    await expect(reportView).toContainText('Students practiced comparative adjectives in context.');
    await expect(reportView).toContainText('Phát âm');
    await expect(reportView).toContainText('Teacher corrected /θ/ and /ð/ sounds carefully.');
    await expect(reportView).not.toContainText('Nội dung học');
    await batch.step('dynamic-template-completed-view');

    await batch.finalize('PASS', {
      extraLines: [
        'Verified only class-matching report templates appear in the pending form selector before apply.',
        'Verified dynamic template fields render by schema, block submit on required field gaps, and keep the exact payload with template snapshot metadata.',
        'Verified the completed view reads back dynamic labels and values from the saved template snapshot instead of collapsing everything into a generic lessonContent row.',
      ],
    });
  } catch (error) {
    await batch.finalize('FAIL', { error });
    throw error;
  }
});
