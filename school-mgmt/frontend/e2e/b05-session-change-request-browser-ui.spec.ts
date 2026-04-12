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
const SESSIONS_API = new RegExp(`${API_ORIGIN_PATTERN}/sessions(?:\\?.*)?$`);
const SESSION_DETAIL_API = new RegExp(`${API_ORIGIN_PATTERN}/sessions/session-change-request-001(?:\\?.*)?$`);
const SESSION_CHANGE_REQUESTS_API = new RegExp(`${API_ORIGIN_PATTERN}/sessions/session-change-request-001/change-requests(?:\\?.*)?$`);
const TEACHERS_API = new RegExp(`${API_ORIGIN_PATTERN}/teachers(?:\\?.*)?$`);

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

function addMinutesToTime(startTime: string, durationMinutes: number): string {
  const startMinutes = parseTimeToMinutes(startTime);
  if (startMinutes === null) {
    throw new Error(`Invalid start time: ${startTime}`);
  }

  const endMinutes = startMinutes + durationMinutes;
  const hours = Math.floor(endMinutes / 60);
  const minutes = endMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function minutesBetween(startTime?: string, endTime?: string): number | undefined {
  const startMinutes = parseTimeToMinutes(startTime);
  const endMinutes = parseTimeToMinutes(endTime);
  if (startMinutes === null || endMinutes === null || endMinutes <= startMinutes) {
    return undefined;
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
  sessionStatus?: string;
  postFailureMessage?: string;
};

type HarnessState = {
  createdPayloads: Array<Record<string, unknown>>;
  history: any[];
  postAttempts: number;
};

function buildSessionListPayload(status = 'SCHEDULED') {
  return {
    data: [
      {
        _id: 'session-change-request-001',
        classId: {
          _id: 'class-change-request-001',
          name: 'Lop Session Change',
          code: 'CLS-SCR-001',
        },
        studentId: {
          _id: 'student-change-request-001',
          fullName: 'Hoc sinh Sale Request',
          studentCode: 'HS-SCR-001',
        },
        teacherId: {
          _id: 'teacher-current-001',
          fullName: 'Teacher Hien Tai',
        },
        scheduledDate: '2026-04-14',
        scheduledStartTime: '18:00',
        scheduledEndTime: '19:00',
        durationMinutes: 60,
        amountCharged: 200000,
        teacherPayout: 120000,
        status,
        isPaid: false,
        isTeacherPaid: false,
      },
    ],
    meta: {
      totalPages: 1,
      total: 1,
      page: 1,
      limit: 20,
    },
  };
}

function buildSessionDetailPayload(status = 'SCHEDULED') {
  return {
    _id: 'session-change-request-001',
    classId: {
      _id: 'class-change-request-001',
      name: 'Lop Session Change',
      code: 'CLS-SCR-001',
    },
    studentId: {
      _id: 'student-change-request-001',
      fullName: 'Hoc sinh Sale Request',
      studentCode: 'HS-SCR-001',
    },
    teacherId: {
      _id: 'teacher-current-001',
      fullName: 'Teacher Hien Tai',
    },
    scheduledDate: '2026-04-14',
    scheduledStartTime: '18:00',
    scheduledEndTime: '19:00',
    durationMinutes: 60,
    amountCharged: 200000,
    teacherPayout: 120000,
    status,
    isPaid: false,
    isTeacherPaid: false,
    editHistory: [],
  };
}

function buildTeachersPayload() {
  return [
    {
      _id: 'teacher-profile-current-001',
      userId: {
        _id: 'teacher-current-001',
        fullName: 'Teacher Hien Tai',
        email: 'teacher.current@example.com',
      },
      status: 'ACTIVE',
    },
    {
      _id: 'teacher-profile-new-001',
      userId: {
        _id: 'teacher-new-001',
        fullName: 'Teacher Moi De Xuat',
        email: 'teacher.new@example.com',
      },
      status: 'ACTIVE',
    },
  ];
}

function buildInitialHistory() {
  return [
    {
      _id: 'session-change-history-approved-001',
      sessionId: {
        _id: 'session-change-request-001',
        scheduledDate: '2026-04-14',
        scheduledStartTime: '18:00',
        scheduledEndTime: '19:00',
      },
      classId: {
        _id: 'class-change-request-001',
        name: 'Lop Session Change',
        code: 'CLS-SCR-001',
      },
      studentId: {
        _id: 'student-change-request-001',
        fullName: 'Hoc sinh Sale Request',
        studentCode: 'HS-SCR-001',
      },
      requestedBy: {
        _id: 'sale-user-001',
        fullName: 'Sale Session Change',
        role: 'SALE',
      },
      reviewedBy: {
        _id: 'ops-user-001',
        fullName: 'OPS Session Change',
        role: 'OPS',
      },
      reviewedAt: '2026-04-10T09:15:00.000Z',
      currentTeacherId: {
        _id: 'teacher-current-001',
        fullName: 'Teacher Hien Tai',
      },
      requestedTeacherId: {
        _id: 'teacher-new-001',
        fullName: 'Teacher Moi De Xuat',
      },
      currentScheduledDate: '2026-04-14',
      currentStartTime: '18:00',
      currentEndTime: '19:00',
      requestedScheduledDate: '2026-04-15',
      requestedStartTime: '19:00',
      requestedEndTime: '20:30',
      currentDurationMinutes: 60,
      requestedDurationMinutes: 90,
      reason: 'Can doi sang buoi toi va giao vien co the day tang cuong.',
      status: 'APPROVED',
      financialImpact: {
        oldDurationMinutes: 60,
        newDurationMinutes: 90,
        oldAmountCharged: 200000,
        newAmountCharged: 300000,
        deltaAmountCharged: 100000,
        oldTeacherPayout: 120000,
        newTeacherPayout: 180000,
        deltaTeacherPayout: 60000,
      },
    },
    {
      _id: 'session-change-history-rejected-001',
      sessionId: {
        _id: 'session-change-request-001',
        scheduledDate: '2026-04-14',
        scheduledStartTime: '18:00',
        scheduledEndTime: '19:00',
      },
      classId: {
        _id: 'class-change-request-001',
        name: 'Lop Session Change',
        code: 'CLS-SCR-001',
      },
      studentId: {
        _id: 'student-change-request-001',
        fullName: 'Hoc sinh Sale Request',
        studentCode: 'HS-SCR-001',
      },
      requestedBy: {
        _id: 'sale-user-001',
        fullName: 'Sale Session Change',
        role: 'SALE',
      },
      reviewedBy: {
        _id: 'director-user-001',
        fullName: 'Director Session Change',
        role: 'DIRECTOR',
      },
      reviewedAt: '2026-04-09T08:00:00.000Z',
      rejectionReason: 'Lop da kin lich vao khung gio de xuat.',
      currentTeacherId: {
        _id: 'teacher-current-001',
        fullName: 'Teacher Hien Tai',
      },
      currentScheduledDate: '2026-04-14',
      currentStartTime: '18:00',
      currentEndTime: '19:00',
      requestedScheduledDate: '2026-04-13',
      requestedStartTime: '17:00',
      requestedEndTime: '18:00',
      currentDurationMinutes: 60,
      requestedDurationMinutes: 60,
      reason: 'Phu huynh xin doi som hon mot ngay.',
      status: 'REJECTED',
      financialImpact: {
        oldDurationMinutes: 60,
        newDurationMinutes: 60,
        oldAmountCharged: 200000,
        newAmountCharged: 200000,
        deltaAmountCharged: 0,
        oldTeacherPayout: 120000,
        newTeacherPayout: 120000,
        deltaTeacherPayout: 0,
      },
    },
  ];
}

async function installRoutes(page: Page, options: HarnessOptions = {}): Promise<HarnessState> {
  const state: HarnessState = {
    createdPayloads: [],
    history: buildInitialHistory(),
    postAttempts: 0,
  };
  const sessionStatus = options.sessionStatus || 'SCHEDULED';

  await page.route(CLASSES_API, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          _id: 'class-change-request-001',
          name: 'Lop Session Change',
          code: 'CLS-SCR-001',
        },
      ]),
    });
  });

  await page.route(SESSIONS_API, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(buildSessionListPayload(sessionStatus)),
    });
  });

  await page.route(SESSION_DETAIL_API, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(buildSessionDetailPayload(sessionStatus)),
    });
  });

  await page.route(SESSION_CHANGE_REQUESTS_API, async (route) => {
    if (route.request().method() === 'POST') {
      state.postAttempts += 1;
      const payload = route.request().postDataJSON() as Record<string, unknown>;
      state.createdPayloads.push(payload);
      await new Promise((resolve) => setTimeout(resolve, 300));

      if (options.postFailureMessage) {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ message: options.postFailureMessage }),
        });
        return;
      }

      const requestedStartTime = typeof payload.requestedStartTime === 'string'
        ? payload.requestedStartTime
        : undefined;
      const requestedEndTime = typeof payload.requestedEndTime === 'string'
        ? payload.requestedEndTime
        : undefined;
      const requestedDurationMinutes =
        typeof payload.requestedDurationMinutes === 'number'
          ? payload.requestedDurationMinutes
          : minutesBetween(requestedStartTime, requestedEndTime);
      const nextDurationMinutes = requestedDurationMinutes ?? 60;
      const nextAmountCharged = nextDurationMinutes === 90 ? 300000 : 200000;
      const nextTeacherPayout = nextDurationMinutes === 90 ? 180000 : 120000;
      const createdRequest = {
        _id: 'session-change-history-pending-001',
        sessionId: {
          _id: 'session-change-request-001',
          scheduledDate: '2026-04-14',
          scheduledStartTime: '18:00',
          scheduledEndTime: '19:00',
        },
        classId: {
          _id: 'class-change-request-001',
          name: 'Lop Session Change',
          code: 'CLS-SCR-001',
        },
        studentId: {
          _id: 'student-change-request-001',
          fullName: 'Hoc sinh Sale Request',
          studentCode: 'HS-SCR-001',
        },
        requestedBy: {
          _id: 'sale-user-001',
          fullName: 'Sale Session Change',
          role: 'SALE',
        },
        currentTeacherId: {
          _id: 'teacher-current-001',
          fullName: 'Teacher Hien Tai',
        },
        requestedTeacherId: payload.requestedTeacherId
          ? {
            _id: String(payload.requestedTeacherId),
            fullName: 'Teacher Moi De Xuat',
          }
          : undefined,
        currentScheduledDate: '2026-04-14',
        currentStartTime: '18:00',
        currentEndTime: '19:00',
        requestedScheduledDate: payload.requestedScheduledDate,
        requestedStartTime: payload.requestedStartTime,
        requestedEndTime: payload.requestedEndTime,
        currentDurationMinutes: 60,
        requestedDurationMinutes,
        reason: payload.reason,
        status: 'PENDING',
        requestedAt: '2026-04-11T10:00:00.000Z',
        financialImpact: {
          oldDurationMinutes: 60,
          newDurationMinutes: nextDurationMinutes,
          oldAmountCharged: 200000,
          newAmountCharged: nextAmountCharged,
          deltaAmountCharged: nextAmountCharged - 200000,
          oldTeacherPayout: 120000,
          newTeacherPayout: nextTeacherPayout,
          deltaTeacherPayout: nextTeacherPayout - 120000,
        },
      };
      state.history = [createdRequest, ...state.history];

      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(createdRequest),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(clone(state.history)),
    });
  });

  await page.route(TEACHERS_API, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(buildTeachersPayload()),
    });
  });

  return state;
}

test.use({
  trace: 'off',
  video: 'on',
});

test('B05 sale can submit teacher-only change request from session detail and history reloads with pending status', async ({
  browser,
  page,
  request,
}) => {
  const batch = await openBatch(browser, 'sale_session_change_request_teacher_only_browser');

  try {
    const state = await installRoutes(page);

    await signInAs(page, request, 'sale');
    await page.goto(appUrl('/app/sessions'));
    await page.waitForLoadState('domcontentloaded');

    await page.getByTestId('session-row-session-change-request-001').getByTestId('sessions-view-detail').click();

    const detailModal = page.locator('.modal.modal-lg');
    await expect(detailModal).toBeVisible();
    await expect(detailModal.getByTestId('sessions-change-request-open')).toBeVisible();

    const history = detailModal.getByTestId('sessions-change-request-history');
    await expect(history.locator('.badge-approved')).toHaveCount(1);
    await expect(history.locator('.badge-rejected')).toHaveCount(1);
    await batch.step('sale-history-visible-before-submit');

    await detailModal.getByTestId('sessions-change-request-open').click();
    const requestForm = detailModal.getByTestId('sessions-change-request-form');
    await expect(requestForm).toBeVisible();
    await expect(requestForm.getByTestId('sessions-change-request-date')).toHaveValue('2026-04-14');
    await expect(requestForm.getByTestId('sessions-change-request-time')).toHaveValue('18:00');
    await expect(requestForm.getByTestId('sessions-change-request-teacher')).toHaveValue('');

    await requestForm.getByTestId('sessions-change-request-teacher').selectOption('teacher-new-001');
    await requestForm.getByTestId('sessions-change-request-reason').fill(
      'Can doi giao vien de dam bao nguoi day phu hop hon.',
    );

    const submitButton = requestForm.getByTestId('sessions-change-request-submit');
    await submitButton.click();
    await expect(submitButton).toContainText('Dang gui...');
    await expect.poll(() => state.createdPayloads.length).toBe(1);
    expect(state.createdPayloads[0]).toEqual({
      requestedTeacherId: 'teacher-new-001',
      reason: 'Can doi giao vien de dam bao nguoi day phu hop hon.',
    });

    await expect(history.locator('.badge-pending')).toHaveCount(1);
    await expect(history).toContainText('Teacher Hien Tai -> Teacher Moi De Xuat');
    await expect(history).toContainText('Can doi giao vien de dam bao nguoi day phu hop hon.');
    await expect(page.getByTestId('sessions-success-alert')).toBeVisible();
    await batch.step('sale-teacher-only-submit-success');

    await batch.finalize('PASS', {
      extraLines: [
        'Verified SALE sees the session-detail change-request CTA only on a SCHEDULED session.',
        'Verified teacher-only change request keeps date/time untouched and submits only teacher + reason.',
        'Verified request history renders APPROVED, REJECTED, and the newly added PENDING row after reload.',
      ],
    });
  } catch (error) {
    await batch.finalize('FAIL', { error });
    throw error;
  }
});

test('B05 sale can propose a new date and one new time, and frontend derives the end time before submit', async ({
  browser,
  page,
  request,
}) => {
  const batch = await openBatch(browser, 'sale_session_change_request_time_browser');

  try {
    const state = await installRoutes(page);

    await signInAs(page, request, 'sale');
    await page.goto(appUrl('/app/sessions'));
    await page.waitForLoadState('domcontentloaded');

    await page.getByTestId('session-row-session-change-request-001').getByTestId('sessions-view-detail').click();

    const detailModal = page.locator('.modal.modal-lg');
    await expect(detailModal).toBeVisible();
    await detailModal.getByTestId('sessions-change-request-open').click();

    const requestForm = detailModal.getByTestId('sessions-change-request-form');
    await requestForm.getByTestId('sessions-change-request-date').fill('2026-04-16');
    await requestForm.getByTestId('sessions-change-request-time').fill('19:00');
    await requestForm.getByTestId('sessions-change-request-reason').fill(
      'Phu huynh xin doi sang lich toi cung khung 60 phut.',
    );

    const submitButton = requestForm.getByTestId('sessions-change-request-submit');
    await submitButton.click();
    await expect(submitButton).toContainText('Dang gui...');
    await expect.poll(() => state.createdPayloads.length).toBe(1);
    expect(state.createdPayloads[0]).toEqual({
      requestedScheduledDate: '2026-04-16',
      requestedStartTime: '19:00',
      requestedEndTime: addMinutesToTime('19:00', 60),
      reason: 'Phu huynh xin doi sang lich toi cung khung 60 phut.',
    });

    const history = detailModal.getByTestId('sessions-change-request-history');
    await expect(history.locator('.badge-pending')).toHaveCount(1);
    await expect(history).toContainText('16/04/2026 19:00 - 20:00');
    await expect(page.getByTestId('sessions-success-alert')).toBeVisible();
    await batch.step('sale-date-time-submit-success');

    await batch.finalize('PASS', {
      extraLines: [
        'Verified the form exposes a single time picker for SALE and keeps duration fixed from the current session.',
        'Verified frontend derives requestedEndTime before calling POST /sessions/:id/change-requests.',
        'Verified request history shows the newly requested schedule after the authoritative reload.',
      ],
    });
  } catch (error) {
    await batch.finalize('FAIL', { error });
    throw error;
  }
});

test('B05 sale does not see the request-change CTA when the session is not SCHEDULED', async ({
  browser,
  page,
  request,
}) => {
  const batch = await openBatch(browser, 'sale_session_change_request_hidden_when_not_scheduled_browser');

  try {
    await installRoutes(page, { sessionStatus: 'TEACHER_COMPLETED' });

    await signInAs(page, request, 'sale');
    await page.goto(appUrl('/app/sessions'));
    await page.waitForLoadState('domcontentloaded');

    await page.getByTestId('session-row-session-change-request-001').getByTestId('sessions-view-detail').click();

    const detailModal = page.locator('.modal.modal-lg');
    await expect(detailModal).toBeVisible();
    await expect(detailModal.getByTestId('sessions-change-request-open')).toHaveCount(0);
    await expect(detailModal.getByTestId('sessions-change-request-history').locator('.badge-approved')).toHaveCount(1);
    await batch.step('sale-non-scheduled-hidden-cta');

    await batch.finalize('PASS', {
      extraLines: [
        'Verified SALE does not see the request-change CTA once the session status is no longer SCHEDULED.',
        'Verified request history remains visible inside session detail even when the CTA is hidden.',
      ],
    });
  } catch (error) {
    await batch.finalize('FAIL', { error });
    throw error;
  }
});

test('B05 sale sees backend error feedback when change-request submit fails', async ({
  browser,
  page,
  request,
}) => {
  const batch = await openBatch(browser, 'sale_session_change_request_error_alert_browser');

  try {
    const failureMessage = 'Khung gio de xuat bi trung lich OPS.';
    const state = await installRoutes(page, { postFailureMessage: failureMessage });

    await signInAs(page, request, 'sale');
    await page.goto(appUrl('/app/sessions'));
    await page.waitForLoadState('domcontentloaded');

    await page.getByTestId('session-row-session-change-request-001').getByTestId('sessions-view-detail').click();

    const detailModal = page.locator('.modal.modal-lg');
    await expect(detailModal).toBeVisible();
    await detailModal.getByTestId('sessions-change-request-open').click();

    const requestForm = detailModal.getByTestId('sessions-change-request-form');
    await requestForm.getByTestId('sessions-change-request-time').fill('19:00');
    await requestForm.getByTestId('sessions-change-request-reason').fill(
      'Can doi lich nhung backend dang tu choi do trung lich.',
    );

    await requestForm.getByTestId('sessions-change-request-submit').click();
    await expect.poll(() => state.postAttempts).toBe(1);
    await expect(page.getByTestId('sessions-error-alert')).toContainText(failureMessage);
    await expect(requestForm).toBeVisible();
    await batch.step('sale-submit-error-alert-visible');

    await batch.finalize('PASS', {
      extraLines: [
        'Verified frontend surfaces backend validation failure as an in-page error alert for SALE.',
        'Verified the change-request form stays open after a failed submit so the user can correct and retry.',
      ],
    });
  } catch (error) {
    await batch.finalize('FAIL', { error });
    throw error;
  }
});
