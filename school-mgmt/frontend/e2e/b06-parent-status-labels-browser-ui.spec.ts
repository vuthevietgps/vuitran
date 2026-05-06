import { expect, test } from '@playwright/test';
import { applySessionCookies, loginAsRole } from './support/auth';

const APP_BASE_URL =
  process.env['PLAYWRIGHT_BASE_URL'] ||
  process.env['E2E_BASE_URL'] ||
  'http://localhost:4200';

const API_ORIGIN_PATTERN = 'https?://(?:localhost|127\\.0\\.0\\.1):3000';
const SESSIONS_API = new RegExp(`${API_ORIGIN_PATTERN}/sessions(?:\\?.*)?$`);
const CLASSES_API = new RegExp(`${API_ORIGIN_PATTERN}/classes(?:\\?.*)?$`);
const PARENT_INVOICES_API = new RegExp(`${API_ORIGIN_PATTERN}/invoices/my-children(?:\\?.*)?$`);

function appUrl(path: string): string {
  return new URL(path, APP_BASE_URL).toString();
}

function buildTrialApprovedSession() {
  return {
    _id: 'session-trial-approved-001',
    classId: { _id: 'class-1', name: 'Lop Trial Parent', code: 'CLS-TRIAL-01' },
    studentId: { _id: 'student-1', fullName: 'Hoc sinh Trial Parent', studentCode: 'HS-TRIAL-01' },
    teacherId: { _id: 'teacher-1', fullName: 'Giao vien Trial Parent' },
    sessionType: 'TRIAL',
    scheduledDate: '2026-04-14T00:00:00.000Z',
    scheduledStartTime: '09:00',
    scheduledEndTime: '10:00',
    durationMinutes: 60,
    amountCharged: 0,
    teacherPayout: 0,
    status: 'FINALIZED',
    isPaid: true,
    isTeacherPaid: true,
    trialConverted: true,
    trialTeacherPaidOnly: false,
    trialRejectedNoPay: false,
    hasTeachingReport: true,
    teachingReport: {
      lessonContent: 'Noi dung hoc thu',
    },
    confirmation: {
      finalizedBy: 'ops-1',
    },
  };
}

async function installCommonRoutes(page: any): Promise<void> {
  await page.route('**/notifications/unread-count', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ count: 0 }),
    });
  });

  await page.route('**/pending-approvals/summary', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ totalPending: 0 }),
    });
  });
}

test.use({
  trace: 'off',
  screenshot: 'off',
  video: 'off',
});

test.describe('B06 parent status labels browser UI', () => {
  test('parent sessions show approved trial status without using the invoice paid label', async ({ page, request }) => {
    const session = await loginAsRole(request, 'parent');
    await applySessionCookies(page, session);
    await installCommonRoutes(page);

    await page.route(CLASSES_API, async (route: any) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { _id: 'class-1', name: 'Lop Trial Parent', code: 'CLS-TRIAL-01' },
        ]),
      });
    });

    await page.route(SESSIONS_API, async (route: any) => {
      if (route.request().method() !== 'GET') {
        await route.fallback();
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [buildTrialApprovedSession()],
          meta: { totalPages: 1 },
        }),
      });
    });

    await page.goto(appUrl('/app/sessions'));
    await page.waitForLoadState('domcontentloaded');

    const row = page.getByTestId('session-row-session-trial-approved-001');
    await expect(row).toBeVisible();
    await expect(row).toContainText('Đã được duyệt học thử');
    await expect(row).not.toContainText(/Đã thanh toán|Da thanh toan/i);
  });

  test('parent invoice pages keep invoice payment labels as paid', async ({ page, request }) => {
    const session = await loginAsRole(request, 'parent');
    await applySessionCookies(page, session);
    await installCommonRoutes(page);

    await page.route(PARENT_INVOICES_API, async (route: any) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          children: [
            {
              student: {
                _id: 'student-1',
                fullName: 'Hoc sinh Invoice Parent',
                studentCode: 'HS-INV-01',
              },
              invoices: [
                {
                  _id: 'invoice-approved-001',
                  invoiceNumber: 'INV-PARENT-APPROVED',
                  classId: { _id: 'class-1', name: 'Lop Invoice Parent' },
                  sessions: 8,
                  bonusSessions: 1,
                  trialSessions: 0,
                  pricePerSession: 200000,
                  amount: 1600000,
                  sessionsRemaining: 5,
                  bonusSessionsRemaining: 1,
                  trialSessionsRemaining: 0,
                  status: 'APPROVED',
                  createdAt: '2026-04-14T00:00:00.000Z',
                },
                {
                  _id: 'invoice-paid-legacy-001',
                  invoiceNumber: 'INV-PARENT-PAID',
                  classId: { _id: 'class-1', name: 'Lop Invoice Parent' },
                  sessions: 6,
                  bonusSessions: 0,
                  trialSessions: 1,
                  pricePerSession: 180000,
                  amount: 1080000,
                  sessionsRemaining: 2,
                  bonusSessionsRemaining: 0,
                  trialSessionsRemaining: 1,
                  status: 'PAID',
                  createdAt: '2026-04-13T00:00:00.000Z',
                },
                {
                  _id: 'invoice-pending-001',
                  invoiceNumber: 'INV-PARENT-PENDING',
                  classId: { _id: 'class-1', name: 'Lop Invoice Parent' },
                  sessions: 4,
                  bonusSessions: 0,
                  trialSessions: 0,
                  pricePerSession: 150000,
                  amount: 600000,
                  sessionsRemaining: 4,
                  bonusSessionsRemaining: 0,
                  trialSessionsRemaining: 0,
                  status: 'PENDING_APPROVAL',
                  createdAt: '2026-04-12T00:00:00.000Z',
                },
              ],
            },
          ],
          summary: {
            totalPaid: 2680000,
            totalPending: 600000,
            totalSessionsRemaining: 9,
          },
        }),
      });
    });

    await page.goto(appUrl('/app/parent-invoices'));
    await page.waitForLoadState('domcontentloaded');

    const approvedRow = page.locator('table.data tbody tr').filter({ hasText: 'INV-PARENT-APPROVED' }).first();
    const paidRow = page.locator('table.data tbody tr').filter({ hasText: 'INV-PARENT-PAID' }).first();
    const pendingRow = page.locator('table.data tbody tr').filter({ hasText: 'INV-PARENT-PENDING' }).first();

    await expect(approvedRow).toContainText('Đã thanh toán');
    await expect(paidRow).toContainText('Đã thanh toán');
    await expect(pendingRow).toContainText('Chờ duyệt');
  });
});
