import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  acceptDialog,
  apiJson,
  applySessionCookies,
  createParentAccount,
  ensureProductFixture,
  ensureSaleAccount,
  generateAttendanceLinkFromUi,
  getSessionById,
  loginAsCredentials,
  loginAsRole,
  roleEmail,
  rolePassword,
  submitAttendanceByToken,
  timeSlot,
  uniquePhone,
} from './support';

test.use({
  trace: 'off',
  launchOptions: { slowMo: 250 },
});

const RUN_DATE = process.env['UI_EVIDENCE_DATE'] || new Date().toISOString().slice(0, 10);
const DATE_STAMP = RUN_DATE.replace(/-/g, '');
const ROOT_DIR = path.resolve(process.cwd(), '../..');
const EVIDENCE_DIR = path.join(ROOT_DIR, 'frontend-ui-evidence', RUN_DATE);
const VIDEO_DIR = path.join(EVIDENCE_DIR, 'videos');
const RAW_VIDEO_DIR = path.join(VIDEO_DIR, 'raw');
const SHOWCASE_ARTIFACTS_DIR = path.join(EVIDENCE_DIR, 'showcase-artifacts');
const FINAL_VIDEO_NAME = `UI_Long_Linked_UI_Showcase_${DATE_STAMP}`;

async function ensureEvidenceDirs(): Promise<void> {
  await mkdir(VIDEO_DIR, { recursive: true });
  await mkdir(RAW_VIDEO_DIR, { recursive: true });
  await mkdir(SHOWCASE_ARTIFACTS_DIR, { recursive: true });
}

async function installOverlay(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const LABEL_ID = '__codex_video_label';
    const CURSOR_ID = '__codex_video_cursor';

    const ensureOverlay = () => {
      if (!document.body) return;

      let cursor = document.getElementById(CURSOR_ID) as HTMLDivElement | null;
      if (!cursor) {
        cursor = document.createElement('div');
        cursor.id = CURSOR_ID;
        cursor.style.position = 'fixed';
        cursor.style.left = '0';
        cursor.style.top = '0';
        cursor.style.width = '24px';
        cursor.style.height = '24px';
        cursor.style.borderRadius = '999px';
        cursor.style.border = '3px solid rgba(14, 165, 233, 0.92)';
        cursor.style.background = 'rgba(255,255,255,0.74)';
        cursor.style.boxShadow = '0 10px 28px rgba(14, 165, 233, 0.35)';
        cursor.style.pointerEvents = 'none';
        cursor.style.zIndex = '2147483647';
        cursor.style.transform = 'translate(-999px, -999px)';
        cursor.style.transition = 'transform 60ms linear, width 100ms ease, height 100ms ease, border-color 100ms ease';
        document.body.appendChild(cursor);
      }

      let label = document.getElementById(LABEL_ID) as HTMLDivElement | null;
      if (!label) {
        label = document.createElement('div');
        label.id = LABEL_ID;
        label.style.position = 'fixed';
        label.style.left = '20px';
        label.style.bottom = '20px';
        label.style.maxWidth = '760px';
        label.style.padding = '10px 14px';
        label.style.borderRadius = '14px';
        label.style.background = 'rgba(15, 23, 42, 0.82)';
        label.style.color = '#e2e8f0';
        label.style.font = '600 15px/1.45 "Segoe UI", system-ui, sans-serif';
        label.style.boxShadow = '0 20px 44px rgba(15, 23, 42, 0.28)';
        label.style.pointerEvents = 'none';
        label.style.zIndex = '2147483646';
        label.style.opacity = '0';
        label.style.transition = 'opacity 150ms ease';
        document.body.appendChild(label);
      }

      window.addEventListener('mousemove', (event) => {
        cursor!.style.transform = `translate(${Math.round(event.clientX - 12)}px, ${Math.round(event.clientY - 12)}px)`;
      }, { passive: true });

      document.addEventListener('mousedown', () => {
        cursor!.style.width = '18px';
        cursor!.style.height = '18px';
        cursor!.style.borderColor = 'rgba(249, 115, 22, 0.95)';
      });

      document.addEventListener('mouseup', () => {
        cursor!.style.width = '24px';
        cursor!.style.height = '24px';
        cursor!.style.borderColor = 'rgba(14, 165, 233, 0.92)';
      });

      (window as any).__codexVideoLabel = (message: string | null) => {
        if (!label) return;
        if (!message) {
          label.style.opacity = '0';
          label.textContent = '';
          return;
        }
        label.textContent = message;
        label.style.opacity = '1';
      };
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', ensureOverlay, { once: true });
    } else {
      ensureOverlay();
    }
  });
}

async function setVideoLabel(page: Page, message: string | null): Promise<void> {
  await page.evaluate((value) => {
    const fn = (window as any).__codexVideoLabel as ((msg: string | null) => void) | undefined;
    fn?.(value);
  }, message);
}

async function showTitleCard(page: Page, title: string, subtitle: string): Promise<void> {
  await page.setContent(`
    <style>
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background:
          radial-gradient(circle at top left, rgba(34,197,94,.24), transparent 35%),
          radial-gradient(circle at bottom right, rgba(59,130,246,.28), transparent 40%),
          linear-gradient(135deg, #020617 0%, #0f172a 45%, #1e293b 100%);
        color: #e2e8f0;
        font-family: "Segoe UI", system-ui, sans-serif;
      }
      .card {
        width: min(920px, calc(100vw - 80px));
        border: 1px solid rgba(148,163,184,.26);
        border-radius: 28px;
        padding: 40px 44px;
        background: rgba(15,23,42,.68);
        box-shadow: 0 24px 80px rgba(2,6,23,.45);
        backdrop-filter: blur(14px);
      }
      .eyebrow {
        display: inline-flex;
        padding: 8px 14px;
        border-radius: 999px;
        background: rgba(34,197,94,.14);
        color: #86efac;
        font-size: 14px;
        letter-spacing: .08em;
        text-transform: uppercase;
        font-weight: 700;
      }
      h1 {
        margin: 20px 0 14px;
        font-size: 44px;
        line-height: 1.08;
      }
      p {
        margin: 0;
        color: #cbd5e1;
        font-size: 20px;
        line-height: 1.5;
      }
    </style>
    <div class="card">
      <div class="eyebrow">Ghi Hinh Playwright</div>
      <h1>${title}</h1>
      <p>${subtitle}</p>
    </div>
  `);
  await page.waitForTimeout(1400);
}

async function clickLocator(page: Page, locator: Locator): Promise<void> {
  await expect(locator).toBeVisible({ timeout: 20_000 });
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if (!box) {
    throw new Error('Could not calculate locator position for click.');
  }

  await page.mouse.move(box.x + (box.width / 2), box.y + (box.height / 2), { steps: 18 });
  await page.waitForTimeout(100);
  await page.mouse.down();
  await page.waitForTimeout(60);
  await page.mouse.up();
  await page.waitForTimeout(160);
}

async function loginViaUi(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/login');
  await page.waitForLoadState('networkidle');
  await slowType(page.getByTestId('login-email'), email, 55);
  await slowType(page.getByTestId('login-password'), password, 55);
  await clickLocator(page, page.getByTestId('login-submit'));
  await page.waitForURL(/\/app\//, { timeout: 20_000 });
}

async function switchSession(
  page: Page,
  session: any,
  path: string,
  fallbackCredentials?: { email: string; password: string },
): Promise<void> {
  await page.context().clearCookies();
  await page.goto('about:blank');
  await applySessionCookies(page.context(), session);
  await page.goto(path);
  await page.waitForLoadState('networkidle');
  if (new URL(page.url(), 'http://localhost').pathname === '/login' && fallbackCredentials) {
    await loginViaUi(page, fallbackCredentials.email, fallbackCredentials.password);
    if (new URL(page.url(), 'http://localhost').pathname !== path) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
    }
  }
  await page.waitForTimeout(900);
}

async function slowType(locator: Locator, value: string, delay = 70): Promise<void> {
  await clickLocator(locator.page(), locator);
  await locator.fill('');
  await locator.pressSequentially(value, { delay });
}

async function fillTeachingReport(page: Page, sessionId: string): Promise<void> {
  const card = page.getByTestId(`report-pending-card-${sessionId}`);
  await expect(card).toBeVisible({ timeout: 15_000 });
  await card.getByTestId(`report-pending-expand-${sessionId}`).click();

  const form = page.getByTestId(`report-pending-form-${sessionId}`);
  await expect(form).toBeVisible();
  await slowType(form.getByTestId('report-lesson-content'), 'Grammar review, listening practice, and guided speaking.');
  await slowType(form.getByTestId('report-student-attitude'), 'Focused, cooperative, and followed instructions well.');
  await slowType(form.getByTestId('report-recording-url'), 'https://example.com/showcase-recording', 35);
  await slowType(form.getByTestId('report-teacher-comment'), 'Strong participation. Continue practising pronunciation at home.');
  await slowType(form.getByTestId('report-homework'), 'Finish worksheet 4 and review today vocabulary list.');
  await slowType(form.getByTestId('report-additional-notes'), 'Parent can spend 10 minutes revising prompts before next lesson.');
}

async function capture(page: Page, artifactDir: string, fileName: string): Promise<void> {
  await page.screenshot({
    path: path.join(artifactDir, fileName),
    fullPage: true,
  });
}

test.describe('Linked UI showcase video', () => {
  test('records a polished multi-screen workflow with linked data propagation', async ({
    browser,
    request,
  }) => {
    test.slow();

    const directorSession = await loginAsRole(request, 'director');
    const label = `Showcase${Date.now()}`;
    const digits = `${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(-10);
    const scheduledDate = new Date().toISOString().slice(0, 10);
    const schedule = timeSlot((Date.now() % 10), 60);
    const artifactDir = path.join(SHOWCASE_ARTIFACTS_DIR, `linked-ui-showcase-${digits}`);

    await ensureEvidenceDirs();
    await mkdir(artifactDir, { recursive: true });
    console.log(`ARTIFACT_DIR=${artifactDir}`);
    const context = await browser.newContext({
      viewport: { width: 1600, height: 900 },
      recordVideo: {
        dir: RAW_VIDEO_DIR,
        size: { width: 1600, height: 900 },
      },
    });
    const page = await context.newPage();
    await installOverlay(page);

    const [product, sale, parent] = await Promise.all([
      ensureProductFixture(request, directorSession, label, 'ONLINE'),
      ensureSaleAccount(request, directorSession, label),
      createParentAccount(request, directorSession, label),
    ]);

    const teacher = await apiJson<any>(
      request,
      directorSession,
      'POST',
      '/users',
      {
        userCode: `SCTV${digits}`,
        email: `showcase-teacher-${digits}@school.local`,
        password: rolePassword(),
        fullName: `Showcase Teacher ${label}`,
        role: 'TEACHER',
        phone: uniquePhone(`${label}-teacher`),
      },
    );

    const student = await apiJson<any>(
      request,
      directorSession,
      'POST',
      '/students',
      {
        studentCode: `HS${digits}`,
        fullName: `Showcase Student ${label}`,
        age: 10,
        parentName: parent.fullName,
        parentPhone: parent.phone,
        parentUserId: parent._id,
        faceImage: 'default-avatar.png',
        productPackage: product._id,
        level: 'Starter',
        studentType: 'ONLINE',
        saleId: sale._id,
        saleName: sale.fullName,
      },
    );

    const classroom = await apiJson<any>(
      request,
      directorSession,
      'POST',
      '/classes',
      {
        name: `Showcase Class ${label}`,
        code: `SCC${digits}`,
        teacherId: teacher._id,
        saleId: sale._id,
        classMode: 'ONLINE',
        productPackageId: product._id,
        studentIds: [student._id],
        subject: 'Tieng Anh',
        learningGoals: 'Demonstrate linked UI data propagation across related screens',
        pricePerSession: 200_000,
        teacherPayPerSession: 120_000,
        teacherPayPerStudent: 0,
        baseDuration: 60,
        sessionDuration: 60,
        maxStudents: 1,
      },
    );

    const topUp = await apiJson<any>(
      request,
      directorSession,
      'POST',
      '/wallets/top-up',
      {
        userId: parent._id,
        amount: 500_000,
        paymentMethod: 'BANK_TRANSFER',
        transactionRef: `SHOWCASE-${digits.slice(-6)}`,
        receiptImageUrl: '/uploads/wallets/showcase-top-up.png',
        description: `Top up for ${label}`,
      },
    );

    await apiJson<any>(
      request,
      directorSession,
      'POST',
      `/wallets/top-up/${topUp._id}/approve`,
      {
        bankMatched: true,
        bankStatementRef: `BANK-${digits.slice(-5)}`,
        accountingNotes: `Approved showcase ${label}`,
      },
    );

    const session = await apiJson<any>(
      request,
      directorSession,
      'POST',
      '/sessions',
      {
        classId: classroom._id,
        studentId: student._id,
        teacherId: teacher._id,
        parentUserId: parent._id,
        scheduledDate,
        scheduledStartTime: schedule.startTime,
        scheduledEndTime: schedule.endTime,
        durationMinutes: 60,
        amountCharged: 200_000,
        teacherPayout: 120_000,
      },
    );

    const teacherSession = await loginAsCredentials(request, 'teacher', teacher.email, rolePassword());
    const parentSession = await loginAsCredentials(request, 'parent', parent.email, parent.password);

    await showTitleCard(
      page,
      'Kich Ban Dai: Lien Ket Du Lieu UI End-to-End',
      'Video nay ghi lai mot flow lien tuc: giao vien tao link diem danh, hoc sinh tu submit, nop teaching report, phu huynh xac nhan va director doi chieu ket qua.',
    );

    await setVideoLabel(page, 'Buoc 1: Giao vien mo Attendance, tai lop hoc va tao link diem danh public cho hoc sinh.');
    await switchSession(page, teacherSession, '/app/attendance', {
      email: teacher.email,
      password: rolePassword(),
    });
    await capture(page, artifactDir, '01-teacher-attendance-entry.png');
    await page.getByTestId('attendance-class-select').selectOption(classroom._id);
    await page.getByTestId('attendance-date-input').fill(scheduledDate);
    await clickLocator(page, page.getByTestId('attendance-load-button'));
    await expect(page.getByTestId(`attendance-student-card-${student._id}`)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('attendance-mark-all-present')).toHaveCount(0);
    await expect(page.getByTestId('attendance-save-button')).toHaveCount(0);
    await page.waitForTimeout(900);
    await capture(page, artifactDir, '02-attendance-loaded.png');
    const { token } = await generateAttendanceLinkFromUi(page, student._id);
    await submitAttendanceByToken(request, token);
    await expect
      .poll(async () => (await getSessionById(request, directorSession, session._id))?.status)
      .toBe('TEACHER_COMPLETED');
    await clickLocator(page, page.getByTestId('attendance-load-button'));
    await expect(page.locator('.attendance-summary .stat.present')).toContainText(/Co mat:\s*1/i, { timeout: 10_000 });
    await page.waitForTimeout(1000);
    await capture(page, artifactDir, '03-attendance-saved.png');

    await showTitleCard(
      page,
      'Attendance Day Du Se Day Sang Sessions',
      'Sau khi hoc sinh submit qua link, trang Sessions phai cap nhat ngay trang thai teacher-completed ma khong can reload tay.',
    );

    await setVideoLabel(page, 'Buoc 2: Chuyen sang Sessions de xac nhan buoi hoc da doi trang thai sau khi attendance submit thanh cong.');
    await switchSession(page, teacherSession, '/app/sessions', {
      email: teacher.email,
      password: rolePassword(),
    });
    await page.locator('.filters select').nth(0).selectOption(classroom._id);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(800);
    const teacherRow = page.getByTestId(`session-row-${session._id}`);
    await expect(teacherRow).toBeVisible({ timeout: 12_000 });
    await expect(teacherRow).toContainText(student.fullName);
    await page.waitForTimeout(1000);
    await capture(page, artifactDir, '04-session-linked-state.png');

    await showTitleCard(
      page,
      'Giao Vien Nop Teaching Report',
      'Sau khi submit, item phai bien mat khoi danh sach Pending va xuat hien o tab Completed ma khong can tai lai trang.',
    );

    await setVideoLabel(page, 'Buoc 3: Giao vien mo teaching report pending, dien day du cac truong va submit bao cao giang day.');
    await switchSession(page, teacherSession, '/app/teaching-report', {
      email: teacher.email,
      password: rolePassword(),
    });
    await clickLocator(page, page.getByTestId('report-tab-pending'));
    await expect(page.getByTestId(`report-pending-card-${session._id}`)).toBeVisible({ timeout: 15_000 });
    await capture(page, artifactDir, '05-report-pending-list.png');
    await fillTeachingReport(page, session._id);
    await capture(page, artifactDir, '06-report-form-filled.png');
    await clickLocator(page, page.getByTestId('report-submit'));
    await expect(page.getByTestId(`report-pending-card-${session._id}`)).toBeHidden({ timeout: 15_000 });
    await clickLocator(page, page.getByTestId('report-tab-completed'));
    await expect(page.locator('.session-card.completed').filter({ hasText: student.fullName }).first()).toBeVisible({ timeout: 15_000 });
    await expect
      .poll(async () => {
        const latest = await getSessionById(request, directorSession, session._id);
        return latest.hasTeachingReport ? 'yes' : 'no';
      })
      .toBe('yes');
    await page.waitForTimeout(1000);
    await capture(page, artifactDir, '07-report-completed-list.png');

    await showTitleCard(
      page,
      'Phu Huynh Xem Day Du Du Lieu Lien Ket',
      'Phu huynh phai mo duoc session detail, xem duoc teaching report vua nop, roi xac nhan buoi hoc ngay tren cung luong du lieu.',
    );

    await setVideoLabel(page, 'Buoc 4: Phu huynh vao Sessions, mo detail de xem teaching report, sau do xac nhan buoi hoc va ghi chu.');
    await switchSession(page, parentSession, '/app/sessions', {
      email: parent.email,
      password: parent.password,
    });
    const parentRow = page.getByTestId(`session-row-${session._id}`);
    await expect(parentRow).toBeVisible({ timeout: 12_000 });
    await expect(parentRow.getByTestId('sessions-parent-confirm-button')).toBeVisible();
    await capture(page, artifactDir, '08-parent-can-confirm.png');
    await clickLocator(page, parentRow.getByTestId('sessions-view-detail'));
    const parentDetail = page.locator('.modal.modal-lg').last();
    const parentReport = parentDetail.locator('.report-card-clean').first();
    await expect(page.getByTestId('sessions-detail-close')).toBeVisible();
    await expect(parentReport).toBeVisible();
    await expect(parentReport.getByText(/Grammar review, listening practice, and guided speaking\./i)).toBeVisible();
    await expect(parentReport.getByText(/Strong participation\. Continue practising pronunciation at home\./i)).toBeVisible();
    await capture(page, artifactDir, '09-parent-detail-with-report.png');
    await clickLocator(page, page.getByTestId('sessions-detail-close'));
    await expect(page.getByTestId('sessions-detail-close')).toBeHidden();
    await clickLocator(page, parentRow.getByTestId('sessions-parent-confirm-button'));
    await slowType(page.getByTestId('sessions-confirm-rating'), '5', 120);
    await slowType(page.getByTestId('sessions-confirm-notes'), 'Phu huynh da xem bao cao va xac nhan buoi hoc tot.');
    await capture(page, artifactDir, '10-parent-confirm-modal-filled.png');
    await clickLocator(page, page.getByTestId('sessions-confirm-submit'));
    await expect
      .poll(async () => {
        const status = (await getSessionById(request, directorSession, session._id))?.status;
        return status === 'PARENT_CONFIRMED' || status === 'FINALIZED' ? 'ready' : (status || 'unknown');
      })
      .toBe('ready');
    await page.waitForTimeout(1000);
    await capture(page, artifactDir, '11-parent-confirmed.png');

    await showTitleCard(
      page,
      'Director Doi Chieu Ket Qua Cuoi Cung',
      'Director phai thay teaching report va ghi chu cua phu huynh tren cung detail, sau do chot buoi hoc tu du lieu moi nhat.',
    );

    await setVideoLabel(page, 'Buoc 5: Director mo session detail, doi chieu teaching report va ghi chu phu huynh, sau do finalize tu man hinh chi tiet.');
    await switchSession(page, directorSession, '/app/sessions', {
      email: roleEmail('director'),
      password: rolePassword(),
    });
    await page.locator('.filters select').nth(0).selectOption(classroom._id);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(800);
    const directorRow = page.getByTestId(`session-row-${session._id}`);
    await expect(directorRow).toBeVisible({ timeout: 12_000 });
    await clickLocator(page, directorRow.getByTestId('sessions-view-detail'));
    const directorDetail = page.locator('.modal.modal-lg').last();
    const directorReport = directorDetail.locator('.report-card-clean').first();
    await expect(page.getByTestId('sessions-detail-close')).toBeVisible();
    await expect(directorReport).toBeVisible();
    await expect(directorReport.getByText(/Grammar review, listening practice, and guided speaking\./i)).toBeVisible();
    await expect(directorReport.getByText(/Focused, cooperative, and followed instructions well\./i)).toBeVisible();
    await expect(directorDetail.getByText(/Phu huynh da xem bao cao va xac nhan buoi hoc tot\./i)).toBeVisible();
    await expect(page.getByTestId('sessions-finalize-from-detail')).toBeVisible();
    await page.waitForTimeout(1200);
    await capture(page, artifactDir, '12-director-detail-with-linked-data.png');

    await acceptDialog(page, () => page.getByTestId('sessions-finalize-from-detail').click());
    await expect
      .poll(async () => (await getSessionById(request, directorSession, session._id))?.status)
      .toBe('FINALIZED');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1200);
    await capture(page, artifactDir, '13-finalized-result.png');

    await showTitleCard(
      page,
      'Hoan Tat Kich Ban Dai',
      'Du lieu da di thong suot qua Attendance, Sessions, Teaching Report, Parent Confirmation va Director Review trong cung mot flow lien ket.',
    );
    await setVideoLabel(page, 'Ket qua thuc te: du lieu lien ket giua cac man da duoc xac nhan ro tren video va screenshot evidence.');

    await writeFile(
      path.join(artifactDir, 'README.txt'),
      [
        'Bang chung video showcase UI lien ket',
        `artifactDir=${artifactDir}`,
        `sessionId=${session._id}`,
        `teacher=${teacher.email}`,
        `parent=${parent.email}`,
      ].join('\n'),
      'utf8',
    );

    const recordedVideo = page.video();
    await context.close();
    if (recordedVideo) {
      const rawVideoPath = await recordedVideo.path();
      console.log(`RAW_VIDEO_PATH=${rawVideoPath}`);
      const finalVideoPath = path.join(VIDEO_DIR, `${FINAL_VIDEO_NAME}.webm`);
      await rm(finalVideoPath, { force: true });
      await rename(rawVideoPath, finalVideoPath);
      console.log(`FINAL_VIDEO_PATH=${finalVideoPath}`);
    }
  });
});
