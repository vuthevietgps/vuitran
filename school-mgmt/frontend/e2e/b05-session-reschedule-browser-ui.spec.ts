import { expect, test, type APIRequestContext, type Browser, type Page } from '@playwright/test';
import {
  applySessionCookies,
  createBatchEvidenceContext,
  loginAsRole,
  type BatchEvidenceSession,
  type DemoRole,
} from './support';

const APP_BASE_URL =
  process.env['PLAYWRIGHT_BASE_URL'] ||
  process.env['E2E_BASE_URL'] ||
  'http://localhost:4200';

const API_ORIGIN_PATTERN = 'https?://(?:localhost|127\\.0\\.0\\.1):3000';
const CLASSES_API = new RegExp(`${API_ORIGIN_PATTERN}/classes(?:\\?.*)?$`);
const SESSION_STATS_API = new RegExp(`${API_ORIGIN_PATTERN}/sessions/stats(?:\\?.*)?$`);
const SESSIONS_API = new RegExp(`${API_ORIGIN_PATTERN}/sessions(?:\\?.*)?$`);
const SESSION_DETAIL_API = new RegExp(`${API_ORIGIN_PATTERN}/sessions/session-reschedule-001(?:\\?.*)?$`);
const SESSION_CHANGE_REQUESTS_API = new RegExp(`${API_ORIGIN_PATTERN}/sessions/session-reschedule-001/change-requests(?:\\?.*)?$`);
const SESSION_RESCHEDULE_API = new RegExp(`${API_ORIGIN_PATTERN}/sessions/session-reschedule-001/reschedule(?:\\?.*)?$`);

function appUrl(path: string): string {
  return new URL(path, APP_BASE_URL).toString();
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function parseTimeToMinutes(value?: string | null): number | null {
  const safeValue = `${value || ''}`.trim();
  const match = /^(\d{2}):(\d{2})$/.exec(safeValue);
  if (!match) {
    return null;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return null;
  }

  return (hours * 60) + minutes;
}

function minutesBetween(startTime?: string, endTime?: string): number | null {
  const startMinutes = parseTimeToMinutes(startTime);
  const endMinutes = parseTimeToMinutes(endTime);
  if (startMinutes === null || endMinutes === null || endMinutes <= startMinutes) {
    return null;
  }
  return endMinutes - startMinutes;
}

async function signInAs(page: Page, request: APIRequestContext, role: DemoRole): Promise<void> {
  await page.context().clearCookies();
  const session = await loginAsRole(request, role);
  await applySessionCookies(page, session);
}

async function openBatch(browser: Browser, scenario: string): Promise<BatchEvidenceSession> {
  return createBatchEvidenceContext(browser, {
    batchId: 'B05',
    scenario,
  });
}

type HarnessOptions = {
  postFailureMessage?: string;
};

type HarnessState = {
  listRows: any[];
  detailSession: any;
  reschedulePayloads: Array<Record<string, unknown>>;
  rescheduleAttempts: number;
};

function buildSession(overrides: Record<string, unknown> = {}) {
  return {
    _id: 'session-reschedule-001',
    classId: {
      _id: 'class-reschedule-001',
      name: 'Lop Reschedule',
      code: 'CLS-RS-001',
    },
    studentId: {
      _id: 'student-reschedule-001',
      fullName: 'Hoc sinh Reschedule',
      studentCode: 'HS-RS-001',
    },
    teacherId: {
      _id: 'teacher-reschedule-001',
      fullName: 'Teacher Reschedule',
    },
    scheduledDate: '2026-04-18',
    scheduledStartTime: '18:00',
    scheduledEndTime: '19:00',
    durationMinutes: 60,
    amountCharged: 200000,
    teacherPayout: 120000,
    status: 'SCHEDULED',
    isPaid: false,
    isTeacherPaid: false,
    editHistory: [],
    ...overrides,
  };
}

function buildListPayload(rows: any[]) {
  return {
    data: rows,
    meta: {
      totalPages: 1,
      total: rows.length,
      page: 1,
      limit: 20,
    },
  };
}

async function installRoutes(page: Page, options: HarnessOptions = {}): Promise<HarnessState> {
  const state: HarnessState = {
    listRows: [buildSession()],
    detailSession: buildSession(),
    reschedulePayloads: [],
    rescheduleAttempts: 0,
  };

  await page.route(CLASSES_API, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          _id: 'class-reschedule-001',
          name: 'Lop Reschedule',
          code: 'CLS-RS-001',
        },
      ]),
    });
  });

  await page.route(SESSION_STATS_API, async (route) => {
    const finalizedRows = state.listRows.filter((row) => row.status === 'FINALIZED').length;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        totalSessions: state.listRows.length,
        totalRevenue: state.listRows.reduce((sum, row) => sum + Number(row.amountCharged || 0), 0),
        totalTeacherCost: state.listRows.reduce((sum, row) => sum + Number(row.teacherPayout || 0), 0),
        byStatus: {
          SCHEDULED: { count: state.listRows.filter((row) => row.status === 'SCHEDULED').length, totalCharged: 290000, totalPayout: 170000 },
          RESCHEDULED: { count: state.listRows.filter((row) => row.status === 'RESCHEDULED').length, totalCharged: 200000, totalPayout: 120000 },
          FINALIZED: { count: finalizedRows, totalCharged: 0, totalPayout: 0 },
        },
      }),
    });
  });

  await page.route(SESSIONS_API, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(buildListPayload(clone(state.listRows))),
    });
  });

  await page.route(SESSION_DETAIL_API, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(clone(state.detailSession)),
    });
  });

  await page.route(SESSION_CHANGE_REQUESTS_API, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });

  await page.route(SESSION_RESCHEDULE_API, async (route) => {
    state.rescheduleAttempts += 1;
    const payload = route.request().postDataJSON() as Record<string, unknown>;
    state.reschedulePayloads.push(payload);
    await new Promise((resolve) => setTimeout(resolve, 300));

    if (options.postFailureMessage) {
      await route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({ message: options.postFailureMessage }),
      });
      return;
    }

    const nextDurationMinutes = minutesBetween(
      String(payload.newStartTime || ''),
      String(payload.newEndTime || ''),
    );
    if (!nextDurationMinutes) {
      throw new Error('Expected valid duration in reschedule payload');
    }

    const oldSession = buildSession({
      status: 'RESCHEDULED',
      rescheduledToId: {
        _id: 'session-reschedule-002',
        scheduledDate: payload.newScheduledDate,
        scheduledStartTime: payload.newStartTime,
        scheduledEndTime: payload.newEndTime,
        status: 'SCHEDULED',
      },
    });
    const newSession = buildSession({
      _id: 'session-reschedule-002',
      scheduledDate: payload.newScheduledDate,
      scheduledStartTime: payload.newStartTime,
      scheduledEndTime: payload.newEndTime,
      durationMinutes: nextDurationMinutes,
      amountCharged: 290000,
      teacherPayout: 170000,
      status: 'SCHEDULED',
      rescheduledFromId: {
        _id: 'session-reschedule-001',
        scheduledDate: '2026-04-18',
        scheduledStartTime: '18:00',
        scheduledEndTime: '19:00',
        status: 'RESCHEDULED',
      },
    });

    state.detailSession = clone(oldSession);
    state.listRows = [clone(oldSession), clone(newSession)];

    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        oldSession,
        newSession,
      }),
    });
  });

  return state;
}

test.use({
  trace: 'off',
  video: 'on',
});

test('B05 ops can reschedule a scheduled session from detail and list reloads old/new states', async ({
  browser,
  page,
  request,
}) => {
  const batch = await openBatch(browser, 'ops_session_reschedule_browser');

  try {
    const state = await installRoutes(page);

    await signInAs(page, request, 'ops');
    await page.goto(appUrl('/app/sessions'));
    await page.waitForLoadState('domcontentloaded');

    await page.getByTestId('session-row-session-reschedule-001').getByTestId('sessions-view-detail').click();

    const detailModal = page.locator('.modal.modal-lg');
    await expect(detailModal).toBeVisible();
    await expect(detailModal.getByTestId('sessions-reschedule-open')).toBeVisible();
    await batch.step('ops-reschedule-cta-visible');

    await detailModal.getByTestId('sessions-reschedule-open').click();
    const rescheduleForm = detailModal.getByTestId('sessions-reschedule-form');
    await expect(rescheduleForm).toBeVisible();
    await expect(rescheduleForm.getByTestId('sessions-reschedule-date')).toHaveValue('2026-04-18');
    await expect(rescheduleForm.getByTestId('sessions-reschedule-start')).toHaveValue('18:00');
    await expect(rescheduleForm.getByTestId('sessions-reschedule-end')).toHaveValue('19:00');
    await expect(rescheduleForm.getByTestId('sessions-reschedule-submit')).toBeDisabled();

    await rescheduleForm.getByTestId('sessions-reschedule-date').fill('2026-04-20');
    await rescheduleForm.getByTestId('sessions-reschedule-start').fill('19:30');
    await rescheduleForm.getByTestId('sessions-reschedule-end').fill('21:00');
    await rescheduleForm.getByTestId('sessions-reschedule-reason').fill(
      'Phu huynh xin doi sang toi thu Hai va tang them 30 phut.',
    );

    const submitButton = rescheduleForm.getByTestId('sessions-reschedule-submit');
    await expect(submitButton).toBeEnabled();
    await submitButton.click();
    await expect(submitButton).toContainText('Dang doi lich...');
    await expect.poll(() => state.reschedulePayloads.length).toBe(1);
    expect(state.reschedulePayloads[0]).toEqual({
      newScheduledDate: '2026-04-20',
      newStartTime: '19:30',
      newEndTime: '21:00',
      durationMinutes: 90,
      reason: 'Phu huynh xin doi sang toi thu Hai va tang them 30 phut.',
    });

    await expect(page.getByTestId('sessions-success-alert')).toContainText('Da doi lich buoi hoc thanh cong.');
    await expect(detailModal.locator('.detail-grid .badge-rescheduled')).toHaveCount(1);

    const summary = detailModal.getByTestId('sessions-reschedule-summary');
    await expect(summary).toContainText('Da doi lich');
    await expect(summary).toContainText('20/04/2026');
    await expect(summary).toContainText('19:30 - 21:00');

    const oldRow = page.getByTestId('session-row-session-reschedule-001');
    const newRow = page.getByTestId('session-row-session-reschedule-002');
    await expect(oldRow.locator('.badge-rescheduled')).toHaveCount(1);
    await expect(newRow.locator('.badge-scheduled')).toHaveCount(1);
    await expect(newRow).toContainText('20/04/2026');
    await expect(newRow).toContainText('19:30');
    await expect(newRow).toContainText('21:00');
    await batch.step('ops-reschedule-success-reload');

    await batch.finalize('PASS', {
      extraLines: [
        'Verified OPS sees the reschedule CTA only inside Session Detail for a SCHEDULED session.',
        'Verified submit keeps a strict payload with exact new date, start, end, duration, and reason.',
        'Verified the detail modal switches the old session to RESCHEDULED and list reload shows the newly created SCHEDULED session.',
      ],
    });
  } catch (error) {
    await batch.finalize('FAIL', { error });
    throw error;
  }
});

test('B05 ops sees exact backend conflict message when reschedule fails due to schedule overlap', async ({
  browser,
  page,
  request,
}) => {
  const batch = await openBatch(browser, 'ops_session_reschedule_conflict_browser');

  try {
    const failureMessage = 'Trung lich: Giao vien da co buoi hoc trung gio';
    const state = await installRoutes(page, { postFailureMessage: failureMessage });

    await signInAs(page, request, 'ops');
    await page.goto(appUrl('/app/sessions'));
    await page.waitForLoadState('domcontentloaded');

    await page.getByTestId('session-row-session-reschedule-001').getByTestId('sessions-view-detail').click();

    const detailModal = page.locator('.modal.modal-lg');
    await expect(detailModal).toBeVisible();
    await detailModal.getByTestId('sessions-reschedule-open').click();

    const rescheduleForm = detailModal.getByTestId('sessions-reschedule-form');
    await rescheduleForm.getByTestId('sessions-reschedule-date').fill('2026-04-20');
    await rescheduleForm.getByTestId('sessions-reschedule-start').fill('18:30');
    await rescheduleForm.getByTestId('sessions-reschedule-end').fill('19:30');
    await rescheduleForm.getByTestId('sessions-reschedule-reason').fill(
      'Can doi nhung dang trung lich giao vien.',
    );

    await rescheduleForm.getByTestId('sessions-reschedule-submit').click();
    await expect.poll(() => state.rescheduleAttempts).toBe(1);
    await expect(page.getByTestId('sessions-error-alert')).toContainText(failureMessage);
    await expect(rescheduleForm).toBeVisible();
    await expect(page.getByTestId('session-row-session-reschedule-001').locator('.badge-scheduled')).toHaveCount(1);
    await expect(page.getByTestId('session-row-session-reschedule-002')).toHaveCount(0);
    await batch.step('ops-reschedule-conflict-error-visible');

    await batch.finalize('PASS', {
      extraLines: [
        'Verified the frontend surfaces the exact backend conflict message when the reschedule API returns a 409 overlap error.',
        'Verified the reschedule form stays open and the list does not invent a replacement session after failure.',
      ],
    });
  } catch (error) {
    await batch.finalize('FAIL', { error });
    throw error;
  }
});
