import { expect, test } from '@playwright/test';
import {
  apiCall,
  apiJson,
  closeActors,
  createEnrollmentFixture,
  dateOffset,
  generateAttendanceLinkFromUi,
  loginAsCredentials,
  openSessionPage,
  rolePassword,
  submitAttendanceByToken,
} from '../support';

test.describe('Attendance fraud prevention', () => {
  test('Teacher chỉ tạo link, không được điểm danh trực tiếp hay hàng loạt', async ({
    browser,
    request,
  }) => {
    test.slow();

    const fixture = await createEnrollmentFixture(request, {
      label: `attendance-link-only-${Date.now()}`,
      classMode: 'ONLINE',
    });
    const attendanceDate = dateOffset(0);
    const teacherSession = await loginAsCredentials(
      request,
      'teacher',
      fixture.teacher.email,
      rolePassword(),
    );
    const teacherUi = await openSessionPage(browser, teacherSession, '/app/attendance');

    try {
      const singleMark = await apiCall(
        request,
        teacherSession,
        'POST',
        '/attendance/mark',
        {
          classId: fixture.classroom._id,
          studentId: fixture.student._id,
          date: attendanceDate,
          status: 'PRESENT',
          notes: 'teacher manual mark should be blocked',
        },
        403,
      );
      expect(singleMark.status).toBe(403);

      const bulkMark = await apiCall(
        request,
        teacherSession,
        'POST',
        '/attendance/bulk-mark',
        {
          classId: fixture.classroom._id,
          date: attendanceDate,
          attendances: [
            {
              studentId: fixture.student._id,
              status: 'PRESENT',
              notes: 'teacher bulk mark should be blocked',
            },
          ],
        },
        403,
      );
      expect(bulkMark.status).toBe(403);

      await teacherUi.page.getByTestId('attendance-class-select').selectOption(fixture.classroom._id);
      await teacherUi.page.getByTestId('attendance-date-input').fill(attendanceDate);
      await teacherUi.page.getByTestId('attendance-load-button').click();

      await expect(
        teacherUi.page.getByTestId(`attendance-student-card-${fixture.student._id}`),
      ).toBeVisible({ timeout: 10_000 });
      await expect(
        teacherUi.page.getByTestId(`attendance-generate-link-${fixture.student._id}`),
      ).toBeVisible();
      await expect(teacherUi.page.getByTestId('attendance-mark-all-present')).toHaveCount(0);
      await expect(teacherUi.page.getByTestId('attendance-save-button')).toHaveCount(0);
      await expect(teacherUi.page.getByTestId(`attendance-present-${fixture.student._id}`)).toHaveCount(0);
      await expect(teacherUi.page.getByTestId(`attendance-unmark-${fixture.student._id}`)).toHaveCount(0);

      const { token, attendanceUrl } = await generateAttendanceLinkFromUi(
        teacherUi.page,
        fixture.student._id,
      );
      expect(attendanceUrl).toContain('/student-attendance/');

      const submitted = await submitAttendanceByToken(request, token);
      expect(submitted?.status).toBe('PRESENT');

      await expect
        .poll(async () => {
          const attendance = await apiJson<any>(
            request,
            teacherSession,
            'GET',
            `/attendance/class/${fixture.classroom._id}?date=${attendanceDate}`,
          );
          const record = attendance.attendanceList.find(
            (item: any) => item.student._id === fixture.student._id,
          );
          return record?.attendance?.status || null;
        })
        .toBe('PRESENT');
    } finally {
      await closeActors(teacherUi);
    }
  });
});
