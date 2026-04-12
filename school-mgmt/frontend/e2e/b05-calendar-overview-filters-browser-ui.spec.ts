import { expect, test, type APIRequestContext, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { applySessionCookies, loginAsRole } from './support/auth';

const APP_BASE_URL =
  process.env['PLAYWRIGHT_BASE_URL'] ||
  process.env['E2E_BASE_URL'] ||
  'http://localhost:4200';

const API_ORIGIN_PATTERN = 'https?://(?:localhost|127\\.0\\.0\\.1):3000';
const CALENDAR_API = new RegExp(`${API_ORIGIN_PATTERN}/dashboard/director/calendar(?:\\?.*)?$`);
const TEACHERS_API = new RegExp(`${API_ORIGIN_PATTERN}/users/teachers(?:\\?.*)?$`);
const CLASSES_API = new RegExp(`${API_ORIGIN_PATTERN}/classes(?:\\?.*)?$`);

type CalendarDataset = {
  totalSessions: number;
  byStatus: Record<string, number>;
  dailySummary: Record<string, { sessions: number; completed: number; cancelled: number }>;
  events: Array<Record<string, unknown>>;
  sessions: Array<Record<string, unknown>>;
  payrolls: Array<Record<string, unknown>>;
  tickets: Array<Record<string, unknown>>;
};

async function openAuthenticatedPage(
  browser: Browser,
  request: APIRequestContext,
  path: string,
  configurePage: (page: Page) => Promise<void>,
): Promise<{ context: BrowserContext; page: Page }> {
  const session = await loginAsRole(request, 'director');
  const context = await browser.newContext({ baseURL: APP_BASE_URL });
  const page = await context.newPage();

  await configurePage(page);
  await applySessionCookies(context, session);
  await page.goto(path);
  await page.waitForLoadState('domcontentloaded');

  return { context, page };
}

function buildCalendarPayload(teacherId = '', classId = ''): CalendarDataset & { month: number; year: number } {
  const sessionA = {
    _id: 'session-calendar-001',
    date: '2026-04-10',
    type: 'SESSION',
    title: 'Lop Dai So - Teacher Alpha',
    detail: 'HS: Hoc sinh An',
    status: 'SCHEDULED',
    time: '18:00',
  };
  const sessionB = {
    _id: 'session-calendar-002',
    date: '2026-04-18',
    type: 'SESSION',
    title: 'Lop Hinh Hoc - Teacher Beta',
    detail: 'HS: Hoc sinh Binh',
    status: 'SCHEDULED',
    time: '19:30',
  };
  const payrollA = {
    _id: 'payroll-calendar-001',
    date: '2026-04-03',
    type: 'PAYROLL',
    title: 'Luong: Teacher Alpha',
    detail: '180000d - PAID',
    status: 'PAID',
  };
  const payrollB = {
    _id: 'payroll-calendar-002',
    date: '2026-04-04',
    type: 'PAYROLL',
    title: 'Luong: Teacher Beta',
    detail: '220000d - PAID',
    status: 'PAID',
  };
  const ticketA = {
    _id: 'ticket-calendar-001',
    date: '2026-04-05',
    type: 'TICKET_CREATED',
    title: 'Ticket moi: TCK-CAL-001',
    detail: 'Can doi lich lop Dai So',
    status: 'OPEN',
  };
  const ticketB = {
    _id: 'ticket-calendar-002',
    date: '2026-04-06',
    type: 'TICKET_CREATED',
    title: 'Ticket moi: TCK-CAL-002',
    detail: 'Can doi lich lop Hinh Hoc',
    status: 'OPEN',
  };

  const teacherFiltered = teacherId === '000000000000000000000002';
  const classFiltered = classId === '100000000000000000000002';
  const useDatasetB = teacherFiltered || classFiltered;

  const events = useDatasetB
    ? [payrollB, ticketB, sessionB]
    : [payrollA, ticketA, sessionA, payrollB, ticketB, sessionB];

  const totalSessions = useDatasetB ? 1 : 2;
  const dailySummary = useDatasetB
    ? {
        '2026-04-18': { sessions: 1, completed: 0, cancelled: 0 },
      }
    : {
        '2026-04-10': { sessions: 1, completed: 0, cancelled: 0 },
        '2026-04-18': { sessions: 1, completed: 0, cancelled: 0 },
      };

  return {
    month: 4,
    year: 2026,
    totalSessions,
    byStatus: { SCHEDULED: totalSessions },
    dailySummary,
    events,
    sessions: useDatasetB ? [sessionB] : [sessionA, sessionB],
    payrolls: useDatasetB ? [payrollB] : [payrollA, payrollB],
    tickets: useDatasetB ? [ticketB] : [ticketA, ticketB],
  };
}

test.describe('B05 calendar overview filters browser UI', () => {
  test('hydrates teacher/class filters from query params and loads the filtered calendar dataset', async ({ browser, request }) => {
    const calendarRequests: string[] = [];

    const { context, page } = await openAuthenticatedPage(
      browser,
      request,
      '/app/calendar-overview?month=4&year=2026&teacherId=000000000000000000000002&classId=100000000000000000000002',
      async (authedPage) => {
        await authedPage.route('**/notifications/unread-count', async (route) => {
          await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ count: 0 }) });
        });
        await authedPage.route('**/pending-approvals/summary', async (route) => {
          await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ totalPending: 0 }) });
        });
        await authedPage.route(TEACHERS_API, async (route) => {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify([
              { _id: '000000000000000000000001', fullName: 'Teacher Alpha', email: 'alpha@example.com', role: 'TEACHER' },
              { _id: '000000000000000000000002', fullName: 'Teacher Beta', email: 'beta@example.com', role: 'TEACHER' },
            ]),
          });
        });
        await authedPage.route(CLASSES_API, async (route) => {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify([
              { _id: '100000000000000000000001', name: 'Lop Dai So', code: 'CLS-A' },
              { _id: '100000000000000000000002', name: 'Lop Hinh Hoc', code: 'CLS-B' },
            ]),
          });
        });
        await authedPage.route(CALENDAR_API, async (route) => {
          const url = new URL(route.request().url());
          calendarRequests.push(url.search);
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(buildCalendarPayload(url.searchParams.get('teacherId') || '', url.searchParams.get('classId') || '')),
          });
        });
      },
    );

    try {
      await expect(page.getByTestId('calendar-teacher-filter')).toHaveValue('000000000000000000000002');
      await expect(page.getByTestId('calendar-class-filter')).toHaveValue('100000000000000000000002');
      await expect(page.getByTestId('calendar-stat-total-sessions')).toContainText('1');
      await expect(page.getByTestId('calendar-event-session-calendar-002')).toContainText('Teacher Beta');
      await expect(page.getByTestId('calendar-event-session-calendar-001')).toHaveCount(0);

      expect(calendarRequests.at(-1)).toContain('teacherId=000000000000000000000002');
      expect(calendarRequests.at(-1)).toContain('classId=100000000000000000000002');
    } finally {
      await context.close();
    }
  });

  test('changing teacher/class filters updates query params and reloads calendar events', async ({ browser, request }) => {
    const calendarRequests: string[] = [];

    const { context, page } = await openAuthenticatedPage(
      browser,
      request,
      '/app/calendar-overview?month=4&year=2026',
      async (authedPage) => {
        await authedPage.route('**/notifications/unread-count', async (route) => {
          await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ count: 0 }) });
        });
        await authedPage.route('**/pending-approvals/summary', async (route) => {
          await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ totalPending: 0 }) });
        });
        await authedPage.route(TEACHERS_API, async (route) => {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify([
              { _id: '000000000000000000000001', fullName: 'Teacher Alpha', email: 'alpha@example.com', role: 'TEACHER' },
              { _id: '000000000000000000000002', fullName: 'Teacher Beta', email: 'beta@example.com', role: 'TEACHER' },
            ]),
          });
        });
        await authedPage.route(CLASSES_API, async (route) => {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify([
              { _id: '100000000000000000000001', name: 'Lop Dai So', code: 'CLS-A' },
              { _id: '100000000000000000000002', name: 'Lop Hinh Hoc', code: 'CLS-B' },
            ]),
          });
        });
        await authedPage.route(CALENDAR_API, async (route) => {
          const url = new URL(route.request().url());
          calendarRequests.push(url.search);
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(buildCalendarPayload(url.searchParams.get('teacherId') || '', url.searchParams.get('classId') || '')),
          });
        });
      },
    );

    try {
      await expect(page.getByTestId('calendar-stat-total-sessions')).toContainText('2');
      await expect(page.getByTestId('calendar-event-session-calendar-001')).toContainText('Teacher Alpha');
      await expect(page.getByTestId('calendar-event-session-calendar-002')).toContainText('Teacher Beta');

      await page.getByTestId('calendar-teacher-filter').selectOption('000000000000000000000002');
      await expect(page).toHaveURL(/teacherId=000000000000000000000002/);
      await expect(page.getByTestId('calendar-stat-total-sessions')).toContainText('1');
      await expect(page.getByTestId('calendar-event-session-calendar-002')).toContainText('Teacher Beta');
      await expect(page.getByTestId('calendar-event-session-calendar-001')).toHaveCount(0);

      await page.getByTestId('calendar-class-filter').selectOption('100000000000000000000002');
      await expect(page).toHaveURL(/classId=100000000000000000000002/);
      await expect(page.getByTestId('calendar-class-filter')).toHaveValue('100000000000000000000002');
      await expect(page.getByTestId('calendar-event-ticket-calendar-002')).toContainText('TCK-CAL-002');
      expect(calendarRequests.at(-1)).toContain('teacherId=000000000000000000000002');
      expect(calendarRequests.at(-1)).toContain('classId=100000000000000000000002');
    } finally {
      await context.close();
    }
  });

  test('normalizes stale teacher/class query params out of the URL before loading data', async ({ browser, request }) => {
    const calendarRequests: string[] = [];

    const { context, page } = await openAuthenticatedPage(
      browser,
      request,
      '/app/calendar-overview?month=4&year=2026&teacherId=stale-teacher&classId=stale-class',
      async (authedPage) => {
        await authedPage.route('**/notifications/unread-count', async (route) => {
          await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ count: 0 }) });
        });
        await authedPage.route('**/pending-approvals/summary', async (route) => {
          await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ totalPending: 0 }) });
        });
        await authedPage.route(TEACHERS_API, async (route) => {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify([
              { _id: '000000000000000000000001', fullName: 'Teacher Alpha', email: 'alpha@example.com', role: 'TEACHER' },
              { _id: '000000000000000000000002', fullName: 'Teacher Beta', email: 'beta@example.com', role: 'TEACHER' },
            ]),
          });
        });
        await authedPage.route(CLASSES_API, async (route) => {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify([
              { _id: '100000000000000000000001', name: 'Lop Dai So', code: 'CLS-A' },
              { _id: '100000000000000000000002', name: 'Lop Hinh Hoc', code: 'CLS-B' },
            ]),
          });
        });
        await authedPage.route(CALENDAR_API, async (route) => {
          const url = new URL(route.request().url());
          calendarRequests.push(url.search);
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(buildCalendarPayload(url.searchParams.get('teacherId') || '', url.searchParams.get('classId') || '')),
          });
        });
      },
    );

    try {
      await expect(page).not.toHaveURL(/teacherId=stale-teacher/);
      await expect(page).not.toHaveURL(/classId=stale-class/);
      await expect(page.getByTestId('calendar-teacher-filter')).toHaveValue('');
      await expect(page.getByTestId('calendar-class-filter')).toHaveValue('');
      await expect(page.getByTestId('calendar-stat-total-sessions')).toContainText('2');
      expect(calendarRequests).toHaveLength(1);
      expect(calendarRequests[0]).toContain('month=4');
      expect(calendarRequests[0]).toContain('year=2026');
      expect(calendarRequests[0]).not.toContain('teacherId=');
      expect(calendarRequests[0]).not.toContain('classId=');
    } finally {
      await context.close();
    }
  });
});
