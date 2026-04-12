import { expect, test } from '@playwright/test';
import {
  apiJson,
  applySessionCookies,
  createBatchEvidenceContext,
  createLearningFixture,
  generateAttendanceLinkAndSubmit,
  getSessionById,
  loginAsCredentials,
  loginAsRole,
} from './support';

const APP_BASE_URL =
  process.env['PLAYWRIGHT_BASE_URL'] ||
  process.env['E2E_BASE_URL'] ||
  'http://localhost:4200';

const RUN_DATE =
  process.env['UI_EVIDENCE_DATE'] ||
  process.env['E2E_RUN_DATE'] ||
  '2026-04-11';

const HOLD_CONCERNS = 'Audio mat ket noi lien tuc khien phu huynh yeu cau OPS xem lai.';
const PARENT_NOTES = 'Phu huynh yeu cau xem lai chat luong buoi hoc nay.';

function periodRangeFor(dateText: string): { periodStart: string; periodEnd: string } {
  const [year, month] = dateText.split('-').map((value) => Number(value));
  const lastDay = new Date(year, month, 0).getDate();
  return {
    periodStart: `${year}-${String(month).padStart(2, '0')}-01`,
    periodEnd: `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
  };
}

test('B07 payroll preview shows HELD sessions with prominent hold reason labels instead of a generic waiting state', async ({
  browser,
  request,
}) => {
  test.slow();
  test.setTimeout(300_000);

  const evidence = await createBatchEvidenceContext(browser, {
    batchId: 'B07',
    scenario: 'payroll_held_reason_labels_browser',
    runDate: RUN_DATE,
  });

  const directorSession = await loginAsRole(request, 'director');
  const fixture = await createLearningFixture(request, {
    label: `b07-payroll-held-${Date.now()}`,
    classMode: 'ONLINE',
    initializeWallet: true,
    durationMinutes: 60,
    amountCharged: 200_000,
    teacherPayout: 120_000,
  });

  const teacherSession = await loginAsCredentials(
    request,
    'teacher',
    fixture.teacher.email,
    fixture.teacher.password,
  );
  const parentSession = await loginAsCredentials(
    request,
    'parent',
    fixture.parent.email,
    fixture.parent.password,
  );
  const { periodStart, periodEnd } = periodRangeFor(fixture.scheduledDate);

  try {
    await generateAttendanceLinkAndSubmit(request, teacherSession, {
      classId: fixture.classroom._id,
      studentId: fixture.student._id,
      date: fixture.scheduledDate,
    });

    await apiJson(
      request,
      teacherSession,
      'PATCH',
      `/sessions/${fixture.session._id}/teaching-report`,
      {
        lessonContent: 'Teacher finished the lesson and submitted the report for payroll preview verification.',
        studentAttitude: 'Student completed listening and speaking exercises but parent raised a follow-up concern.',
        teacherComment: 'Seeded specifically for HELD payroll preview visibility.',
      },
    );

    await expect
      .poll(async () => (await getSessionById(request, directorSession, fixture.session._id)).status)
      .toBe('TEACHER_COMPLETED');

    await apiJson(
      request,
      parentSession,
      'POST',
      `/sessions/${fixture.session._id}/confirm`,
      {
        rating: 1,
        isSatisfied: false,
        concerns: HOLD_CONCERNS,
        parentNotes: PARENT_NOTES,
      },
    );

    await expect
      .poll(async () => {
        const session = await getSessionById(request, directorSession, fixture.session._id);
        return {
          status: session.status,
          parentRating: session.parentRating,
          parentNotes: session.parentNotes || '',
        };
      })
      .toEqual({
        status: 'PARENT_CONFIRMED',
        parentRating: 1,
        parentNotes: PARENT_NOTES,
      });

    let previewPayload: {
      payrollStatus: string;
      holdReason: string;
      holdDescription: string;
    } | null = null;
    await expect
      .poll(async () => {
        const preview = await apiJson<any>(
          request,
          teacherSession,
          'GET',
          `/payroll/teacher-preview?teacherId=${fixture.teacher._id}&periodStart=${periodStart}&periodEnd=${periodEnd}`,
        );
        const session = (preview?.sessions || []).find((entry: any) => entry._id === fixture.session._id);
        previewPayload = session
          ? {
              payrollStatus: session.payrollStatus,
              holdReason: session.holdReason,
              holdDescription: session.holdDescription || '',
            }
          : null;
        return previewPayload;
      })
      .toEqual({
        payrollStatus: 'HELD',
        holdReason: 'PARENT_REJECTED',
        holdDescription: `Phụ huynh không hài lòng: ${HOLD_CONCERNS}`,
      });

    await applySessionCookies(evidence.page, teacherSession);
    await evidence.page.goto(new URL('/app/payroll', APP_BASE_URL).toString());
    await evidence.page.waitForLoadState('domcontentloaded');
    for (let attempt = 0; attempt < 3; attempt += 1) {
      if ((await evidence.page.locator('vite-error-overlay').count()) === 0) {
        break;
      }
      await evidence.page.reload({ waitUntil: 'domcontentloaded' });
    }
    await expect(evidence.page.locator('vite-error-overlay')).toHaveCount(0);

    const dateInputs = evidence.page.locator('.filter-bar input[type="date"]');
    await dateInputs.first().fill(periodStart);
    await dateInputs.first().dispatchEvent('change');
    await dateInputs.nth(1).fill(periodEnd);
    await dateInputs.nth(1).dispatchEvent('change');
    await evidence.page.getByRole('button', { name: /^Xem$/ }).click();

    const heldTab = evidence.page.getByRole('button', { name: /HELD \(1\)/i });
    await expect(heldTab).toBeVisible();
    await heldTab.click();

    const rows = evidence.page.locator('.session-table tbody tr');
    await expect(rows).toHaveCount(1);
    const row = rows.first();
    await expect(row).toContainText(fixture.classroom.name);
    await expect(row).toContainText(fixture.student.fullName);
    await expect(row.locator('.badge-held')).toHaveText('HELD');
    await expect(row.locator('.hold-reason-token')).toHaveText('PARENT_REJECTED');
    await expect(row.locator('.hold-reason-label')).toHaveText(/Phụ huynh từ chối xác nhận|Phu huynh tu choi xac nhan/i);
    await expect(row.locator('.hold-reason-detail')).toHaveText(`Phụ huynh không hài lòng: ${HOLD_CONCERNS}`);
    await expect(evidence.page.locator('.summary-grid .card').filter({ hasText: 'HELD' }).locator('.card-number')).toHaveText('1');
    await evidence.step('01_payroll_preview_shows_held_reason_labels');

    await evidence.finalize('PASS', {
      extraLines: [
        `Session ${fixture.session._id} reached HELD preview status with reason ${previewPayload?.holdReason || 'unknown'}.`,
        `Preview detail: ${previewPayload?.holdDescription || ''}`,
        'Browser evidence proves payroll preview shows a dedicated HELD badge plus a prominent PARENT_REJECTED label instead of collapsing the row into a generic waiting state.',
      ],
    });
  } catch (error) {
    await evidence.finalize('FAIL', { error });
    throw error;
  }
});
