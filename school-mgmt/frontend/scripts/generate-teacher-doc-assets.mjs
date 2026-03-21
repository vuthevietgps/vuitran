import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(frontendRoot, '..');
const docsRoot = path.join(repoRoot, 'docs', 'teacher');
const assetsDir = path.join(docsRoot, 'assets');
const videosDir = path.join(docsRoot, 'videos');
const tempVideoDir = path.join(videosDir, '.tmp');
const frontendTeacherDocsDir = path.join(frontendRoot, 'src', 'assets', 'teacher-docs');
const authStatePath = path.join(os.tmpdir(), `teacher-doc-assets-${Date.now()}.json`);

const BASE_URL = process.env.TEACHER_DOC_BASE_URL || 'http://localhost:4200';
const TEACHER_EMAIL = process.env.TEACHER_DOC_EMAIL || 'teacher.demo@school.local';
const TEACHER_PASSWORD = process.env.TEACHER_DOC_PASSWORD || readDemoPassword();
const ATTENDANCE_CLASS_ID = process.env.TEACHER_DOC_CLASS_ID || '69a6e965ca5bf5e73f481e51';
const ATTENDANCE_DATE = process.env.TEACHER_DOC_ATTENDANCE_DATE || '2026-02-27';
const REPORT_MONTH = process.env.TEACHER_DOC_REPORT_MONTH || '2026-02';
const PAYROLL_FROM = process.env.TEACHER_DOC_PAYROLL_FROM || '2026-02-01';
const PAYROLL_TO = process.env.TEACHER_DOC_PAYROLL_TO || '2026-02-28';
const DEFAULT_VIEWPORT = { width: 1500, height: 960 };

function readDemoPassword() {
  const envPath = path.join(repoRoot, '.env');
  const raw = fs.readFileSync(envPath, 'utf8');
  const match = raw.match(/^DEMO_PASSWORD=(.+)$/m);
  if (!match) {
    throw new Error(`Cannot find DEMO_PASSWORD in ${envPath}`);
  }
  return match[1].trim();
}

function ensureDir(targetPath) {
  fs.mkdirSync(targetPath, { recursive: true });
}

function copyRecursive(sourcePath, targetPath) {
  const stat = fs.statSync(sourcePath);

  if (stat.isDirectory()) {
    ensureDir(targetPath);
    for (const entry of fs.readdirSync(sourcePath)) {
      copyRecursive(path.join(sourcePath, entry), path.join(targetPath, entry));
    }
    return;
  }

  ensureDir(path.dirname(targetPath));
  fs.copyFileSync(sourcePath, targetPath);
}

function syncDocsToFrontendAssets() {
  fs.rmSync(frontendTeacherDocsDir, { recursive: true, force: true });
  ensureDir(frontendTeacherDocsDir);
  copyRecursive(docsRoot, frontendTeacherDocsDir);
  console.log(`Synced docs to ${frontendTeacherDocsDir}`);
}

function replaceFile(source, target) {
  if (fs.existsSync(target)) {
    fs.rmSync(target, { force: true });
  }
  fs.renameSync(source, target);
}

function buildSlideHtml({ eyebrow, title, subtitle, chips = [], columns = [], footer }) {
  const chipHtml = chips
    .map(
      (chip) => `
        <span class="chip">${chip}</span>
      `,
    )
    .join('');

  const columnHtml = columns
    .map(
      (column) => `
        <article class="panel">
          <div class="panel-icon">${column.icon}</div>
          <h3>${column.title}</h3>
          <ul>
            ${column.items.map((item) => `<li>${item}</li>`).join('')}
          </ul>
        </article>
      `,
    )
    .join('');

  return `
    <!doctype html>
    <html lang="vi">
      <head>
        <meta charset="utf-8" />
        <style>
          * { box-sizing: border-box; }
          body {
            margin: 0;
            min-height: 100vh;
            font-family: "Segoe UI", "Helvetica Neue", sans-serif;
            color: #f8fafc;
            background:
              radial-gradient(circle at top left, rgba(253, 224, 71, 0.28), transparent 28%),
              radial-gradient(circle at 82% 12%, rgba(56, 189, 248, 0.35), transparent 24%),
              linear-gradient(135deg, #0f172a 0%, #1d3557 45%, #16324f 100%);
          }
          .frame {
            width: 100%;
            min-height: 100vh;
            padding: 56px 64px;
            display: flex;
            flex-direction: column;
            gap: 28px;
          }
          .eyebrow {
            display: inline-flex;
            width: fit-content;
            border: 1px solid rgba(255, 255, 255, 0.18);
            border-radius: 999px;
            padding: 8px 14px;
            font-size: 15px;
            font-weight: 700;
            letter-spacing: 0.04em;
            text-transform: uppercase;
            background: rgba(255, 255, 255, 0.08);
          }
          h1 {
            margin: 0;
            max-width: 980px;
            font-size: 60px;
            line-height: 1.06;
            letter-spacing: -0.03em;
          }
          .subtitle {
            margin: 0;
            max-width: 1040px;
            font-size: 24px;
            line-height: 1.45;
            color: rgba(248, 250, 252, 0.88);
          }
          .chips {
            display: flex;
            flex-wrap: wrap;
            gap: 12px;
          }
          .chip {
            display: inline-flex;
            align-items: center;
            padding: 10px 16px;
            border-radius: 999px;
            background: rgba(248, 250, 252, 0.12);
            font-size: 16px;
            font-weight: 600;
            border: 1px solid rgba(248, 250, 252, 0.12);
          }
          .grid {
            display: grid;
            grid-template-columns: repeat(${Math.max(columns.length, 1)}, minmax(0, 1fr));
            gap: 18px;
            flex: 1;
          }
          .panel {
            position: relative;
            padding: 22px 22px 20px;
            border-radius: 26px;
            background: rgba(15, 23, 42, 0.42);
            border: 1px solid rgba(255, 255, 255, 0.12);
            box-shadow: 0 20px 50px rgba(2, 6, 23, 0.18);
            backdrop-filter: blur(12px);
          }
          .panel-icon {
            font-size: 24px;
            margin-bottom: 16px;
          }
          h3 {
            margin: 0 0 14px;
            font-size: 24px;
            line-height: 1.2;
          }
          ul {
            margin: 0;
            padding-left: 20px;
            display: grid;
            gap: 10px;
            font-size: 17px;
            line-height: 1.45;
            color: rgba(248, 250, 252, 0.92);
          }
          li::marker {
            color: #facc15;
          }
          .footer {
            margin-top: auto;
            padding-top: 6px;
            font-size: 16px;
            color: rgba(248, 250, 252, 0.78);
          }
        </style>
      </head>
      <body>
        <main class="frame">
          <span class="eyebrow">${eyebrow}</span>
          <div>
            <h1>${title}</h1>
            <p class="subtitle">${subtitle}</p>
          </div>
          <div class="chips">${chipHtml}</div>
          <section class="grid">${columnHtml}</section>
          <div class="footer">${footer}</div>
        </main>
      </body>
    </html>
  `;
}

async function captureWebp(page, targetPath, viewport = DEFAULT_VIEWPORT) {
  await page.setViewportSize(viewport);
  await page.waitForTimeout(700);
  await page.evaluate(() => window.scrollTo(0, 0));
  const session = await page.context().newCDPSession(page);
  const { data } = await session.send('Page.captureScreenshot', {
    format: 'webp',
    fromSurface: true,
    clip: {
      x: 0,
      y: 0,
      width: viewport.width,
      height: viewport.height,
      scale: 1,
    },
  });
  fs.writeFileSync(targetPath, Buffer.from(data, 'base64'));
  await session.detach();
}

async function createSlide(page, filename, definition) {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.setContent(buildSlideHtml(definition), { waitUntil: 'load' });
  await page.waitForTimeout(400);
  await captureWebp(page, path.join(assetsDir, filename), { width: 1600, height: 900 });
  console.log(`Created slide ${filename}`);
}

async function waitForApp(page, timeout = 6000) {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForLoadState('networkidle', { timeout }).catch(() => {});
  await page.waitForTimeout(900);
}

async function login(page, options = {}) {
  const email = options.email || TEACHER_EMAIL;
  const password = options.password || TEACHER_PASSWORD;
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
  await waitForApp(page);
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  if (options.captureBeforeSubmit) {
    await captureWebp(page, path.join(assetsDir, options.captureBeforeSubmit), { width: 1440, height: 940 });
  }
  await Promise.all([
    page.waitForURL('**/app/dashboard', { timeout: 20000 }),
    page.locator('button[type="submit"]').click(),
  ]);
  await waitForApp(page, 8000);
}

async function openAuthenticatedPage(context, route, viewport = DEFAULT_VIEWPORT) {
  const page = await context.newPage();
  await page.setViewportSize(viewport);
  await page.goto(`${BASE_URL}${route}`, { waitUntil: 'domcontentloaded' });
  await waitForApp(page);
  return page;
}

function attachDialogHandler(page, delayMs = 1400) {
  page.on('dialog', async (dialog) => {
    console.log(`Dialog: ${dialog.message()}`);
    await page.waitForTimeout(delayMs);
    await dialog.dismiss().catch(() => {});
  });
}

async function createStaticSlides(browser) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const page = await context.newPage();

  await createSlide(page, '00_teacher_overview.webp', {
    eyebrow: 'Teacher Onboarding',
    title: 'Bộ tài liệu vận hành chi tiết dành cho giáo viên',
    subtitle:
      'Tóm tắt đầy đủ những gì giáo viên cần biết khi làm việc với school-mgmt: đăng nhập, chuẩn bị lớp học, điểm danh, báo cáo, lịch dạy, tài liệu, ticket và lương.',
    chips: ['Role: TEACHER', 'Demo local: teacher.demo@school.local', 'Frontend: localhost:4200', 'Backend: localhost:3000'],
    columns: [
      {
        icon: '01',
        title: 'Trước buổi dạy',
        items: ['Đăng nhập và kiểm tra dashboard', 'Xem lịch dạy và lớp phụ trách', 'Kiểm tra tài liệu và thông báo mới'],
      },
      {
        icon: '02',
        title: 'Trong buổi dạy',
        items: ['Mở danh sách điểm danh theo lớp/ngày', 'Tạo link check-in nếu cần', 'Cập nhật trạng thái có mặt của học sinh'],
      },
      {
        icon: '03',
        title: 'Sau buổi dạy',
        items: ['Hoàn thành session', 'Nộp báo cáo giảng dạy', 'Rà lại ticket hoặc tin nhắn liên quan'],
      },
      {
        icon: '04',
        title: 'Cuối kỳ',
        items: ['Theo dõi payroll preview', 'Kiểm tra work session', 'Cập nhật hồ sơ và thông tin ngân hàng'],
      },
    ],
    footer: 'Tài liệu này đi kèm ảnh chụp màn hình thật và video thao tác được quay từ môi trường demo nội bộ.',
  });

  await createSlide(page, '01_teacher_daily_checklist.webp', {
    eyebrow: 'Daily Checklist',
    title: 'Các việc cần làm của giáo viên theo ngày, tuần và tháng',
    subtitle:
      'Slide này dùng như checklist vận hành nhanh cho giáo viên hoặc đội onboarding trước khi vào ca làm việc và khi chốt dữ liệu cuối kỳ.',
    chips: ['Đầu ngày', 'Trước giờ dạy', 'Sau buổi dạy', 'Cuối tuần hoặc cuối tháng'],
    columns: [
      {
        icon: 'A',
        title: 'Đầu ngày',
        items: ['Đăng nhập hệ thống', 'Mở dashboard để xem phiên dạy, thu nhập và ticket', 'Mở lịch dạy để xác nhận các ca trong ngày'],
      },
      {
        icon: 'B',
        title: 'Trước giờ dạy',
        items: ['Kiểm tra lớp học và danh sách học sinh', 'Mở tài liệu giảng dạy cần dùng', 'Tạo yêu cầu thay thế nếu có rủi ro vắng mặt'],
      },
      {
        icon: 'C',
        title: 'Ngay sau buổi dạy',
        items: ['Điểm danh hoặc tạo link điểm danh', 'Hoàn thành buổi dạy', 'Nộp báo cáo và ghi chú bài học'],
      },
      {
        icon: 'D',
        title: 'Cuối tuần hoặc cuối tháng',
        items: ['Kiểm tra payroll preview', 'Rà lại work session login/logout', 'Cập nhật hồ sơ dạy và thông tin nhận lương'],
      },
    ],
    footer: 'Nên dùng checklist này để đào tạo giáo viên mới hoặc làm SOP cho đội vận hành theo dõi chất lượng nhập liệu.',
  });

  await createSlide(page, '02_teacher_scenarios.webp', {
    eyebrow: 'Scenario Pack',
    title: 'Các kịch bản trọng tâm dành cho giáo viên khi kiểm tra hệ thống',
    subtitle:
      'Bộ scenario dưới đây được chọn theo đúng luồng nghiệp vụ cốt lõi: vào ca, dạy học, báo cáo, xin thay thế và nhận lương theo session.',
    chips: ['Login + Dashboard', 'Attendance + Link', 'Teaching Report + Payroll', 'Substitute + Ticket + Messages'],
    columns: [
      {
        icon: 'S1',
        title: 'Bắt đầu ngày làm việc',
        items: ['Đăng nhập thành công', 'Dashboard hiển thị chỉ số đúng', 'Lịch dạy và lớp phụ trách khớp dữ liệu thực tế'],
      },
      {
        icon: 'S2',
        title: 'Chuẩn bị và xử lý buổi dạy',
        items: ['Chọn lớp và ngày để tải danh sách học sinh', 'Tạo link điểm danh cho học sinh', 'Kiểm tra trạng thái lưu điểm danh thành công'],
      },
      {
        icon: 'S3',
        title: 'Chốt dữ liệu để tính lương',
        items: ['Kiểm tra buổi đã nộp báo cáo', 'Đối chiếu session đủ điều kiện lương', 'Xem buổi đang chờ phụ huynh hoặc OPS xác nhận'],
      },
      {
        icon: 'S4',
        title: 'Xử lý phát sinh',
        items: ['Tạo yêu cầu dạy thay', 'Mở ticket khi cần hỗ trợ', 'Nhắn tin nội bộ để phối hợp với OPS'],
      },
    ],
    footer: 'Ảnh chụp màn hình và video quay thật của từng kịch bản nằm trong cùng thư mục docs/teacher/assets và docs/teacher/videos.',
  });

  await context.close();
}

async function captureApplicationScreens(browser) {
  const bootstrapContext = await browser.newContext({ viewport: DEFAULT_VIEWPORT });
  const bootstrapPage = await bootstrapContext.newPage();
  await login(bootstrapPage);
  await bootstrapContext.storageState({ path: authStatePath });
  await bootstrapContext.close();

  const loginContext = await browser.newContext({ viewport: { width: 1440, height: 940 } });
  const loginPage = await loginContext.newPage();
  await login(loginPage, { captureBeforeSubmit: '10_teacher_login.webp' });
  await loginContext.close();

  const context = await browser.newContext({
    viewport: DEFAULT_VIEWPORT,
    storageState: authStatePath,
  });

  const routeCaptures = [
    {
      route: '/app/dashboard',
      asset: '11_teacher_dashboard.webp',
    },
    {
      route: '/app/classes',
      asset: '12_teacher_classes.webp',
      viewport: { width: 1500, height: 1020 },
    },
    {
      route: '/app/attendance',
      asset: '13_teacher_attendance.webp',
      viewport: { width: 1500, height: 1040 },
      afterLoad: async (page) => {
        await page.locator('select').selectOption(ATTENDANCE_CLASS_ID);
        await page.locator('input[type="date"]').fill(ATTENDANCE_DATE);
        await page.getByRole('button', { name: /Tai danh sach|Dang tai/i }).click().catch(() => {});
        await page.locator('.student-card').first().waitFor({ state: 'visible', timeout: 12000 });
      },
    },
    {
      route: '/app/teaching-report',
      asset: '14_teacher_teaching_report.webp',
      viewport: { width: 1500, height: 1120 },
      afterLoad: async (page) => {
        await page.locator('input[type="month"]').fill(REPORT_MONTH);
        await page.locator('.tabs button').nth(1).click();
        await page.waitForTimeout(1300);
      },
    },
    {
      route: '/app/teacher-profile',
      asset: '15_teacher_profile.webp',
      viewport: { width: 1500, height: 1140 },
    },
    {
      route: '/app/teacher-calendar',
      asset: '16_teacher_calendar.webp',
      viewport: { width: 1500, height: 1080 },
      afterLoad: async (page) => {
        await page.locator('.view-toggle button').nth(1).click();
        await page.waitForTimeout(700);
        await page.locator('.cal-nav .ghost').first().click();
        await page.waitForTimeout(900);
      },
    },
    {
      route: '/app/teacher-substitute-request',
      asset: '17_teacher_substitute.webp',
      viewport: { width: 1500, height: 1020 },
      afterLoad: async (page) => {
        await page.locator('.page-header button').first().click();
        await page.locator('.modal').waitFor({ state: 'visible', timeout: 8000 });
      },
    },
    {
      route: '/app/teaching-materials',
      asset: '18_teacher_materials.webp',
      viewport: { width: 1500, height: 1060 },
      afterLoad: async (page) => {
        await page.locator('.page-header button').first().click();
        await page.locator('.modal').waitFor({ state: 'visible', timeout: 8000 });
      },
    },
    {
      route: '/app/payroll',
      asset: '19_teacher_payroll.webp',
      viewport: { width: 1500, height: 1120 },
      afterLoad: async (page) => {
        await page.locator('input[type="date"]').nth(0).fill(PAYROLL_FROM);
        await page.locator('input[type="date"]').nth(1).fill(PAYROLL_TO);
        await page.getByRole('button', { name: /^Xem$/ }).click();
        await page.locator('.summary-grid').waitFor({ state: 'visible', timeout: 12000 });
      },
    },
    {
      route: '/app/tickets',
      asset: '20_teacher_tickets.webp',
      viewport: { width: 1500, height: 1080 },
      afterLoad: async (page) => {
        await page.locator('.page-header button').first().click();
        await page.waitForTimeout(1000);
      },
    },
    {
      route: '/app/messages',
      asset: '21_teacher_messages.webp',
      viewport: { width: 1500, height: 1080 },
      afterLoad: async (page) => {
        await page.locator('.page-header button').first().click();
        await page.waitForTimeout(1000);
      },
    },
  ];

  for (const capture of routeCaptures) {
    const page = await openAuthenticatedPage(context, capture.route, capture.viewport || DEFAULT_VIEWPORT);
    if (capture.afterLoad) {
      await capture.afterLoad(page);
      await page.waitForTimeout(700);
    }
    await captureWebp(page, path.join(assetsDir, capture.asset), capture.viewport || DEFAULT_VIEWPORT);
    console.log(`Captured ${capture.asset}`);
    await page.close();
  }

  await context.close();
}

async function recordVideo(browser, filename, task, storageStatePath) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    storageState: storageStatePath,
    recordVideo: {
      dir: tempVideoDir,
      size: { width: 1440, height: 900 },
    },
  });
  const page = await context.newPage();
  attachDialogHandler(page);
  const video = page.video();
  await task(page);
  await page.waitForTimeout(1800);
  await context.close();
  const videoPath = await video.path();
  replaceFile(videoPath, path.join(videosDir, filename));
  console.log(`Recorded ${filename}`);
}

async function recordTeacherVideos(browser) {
  await recordVideo(
    browser,
    'teacher_login_dashboard.webm',
    async (page) => {
      await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
      await waitForApp(page);
      await page.click('input[name="email"]');
      await page.keyboard.type(TEACHER_EMAIL, { delay: 60 });
      await page.waitForTimeout(250);
      await page.click('input[name="password"]');
      await page.keyboard.type(TEACHER_PASSWORD, { delay: 70 });
      await page.waitForTimeout(350);
      await Promise.all([
        page.waitForURL('**/app/dashboard', { timeout: 20000 }),
        page.locator('button[type="submit"]').click(),
      ]);
      await waitForApp(page, 8000);
      await page.waitForTimeout(2500);
    },
    undefined,
  );

  await recordVideo(
    browser,
    'teacher_attendance_link.webm',
    async (page) => {
      await page.goto(`${BASE_URL}/app/attendance`, { waitUntil: 'domcontentloaded' });
      await waitForApp(page);
      await page.locator('select').selectOption(ATTENDANCE_CLASS_ID);
      await page.waitForTimeout(500);
      await page.locator('input[type="date"]').fill(ATTENDANCE_DATE);
      await page.waitForTimeout(500);
      await page.getByRole('button', { name: /Tai danh sach|Dang tai/i }).click().catch(() => {});
      await page.locator('.student-card').first().waitFor({ state: 'visible', timeout: 12000 });
      await page.waitForTimeout(900);
      await page.locator('.btn-link').first().click();
      await page.waitForTimeout(2200);
    },
    authStatePath,
  );

  await recordVideo(
    browser,
    'teacher_report_payroll.webm',
    async (page) => {
      await page.goto(`${BASE_URL}/app/teaching-report`, { waitUntil: 'domcontentloaded' });
      await waitForApp(page);
      await page.locator('input[type="month"]').fill(REPORT_MONTH);
      await page.waitForTimeout(400);
      await page.locator('.tabs button').nth(1).click();
      await page.waitForTimeout(1800);
      await page.goto(`${BASE_URL}/app/payroll`, { waitUntil: 'domcontentloaded' });
      await waitForApp(page);
      await page.locator('input[type="date"]').nth(0).fill(PAYROLL_FROM);
      await page.waitForTimeout(350);
      await page.locator('input[type="date"]').nth(1).fill(PAYROLL_TO);
      await page.waitForTimeout(350);
      await page.getByRole('button', { name: /^Xem$/ }).click();
      await page.locator('.summary-grid').waitFor({ state: 'visible', timeout: 12000 });
      await page.waitForTimeout(2400);
    },
    authStatePath,
  );
}

async function main() {
  ensureDir(assetsDir);
  ensureDir(videosDir);
  ensureDir(tempVideoDir);

  const browser = await chromium.launch({ headless: true });

  try {
    await createStaticSlides(browser);
    await captureApplicationScreens(browser);
    await recordTeacherVideos(browser);
    syncDocsToFrontendAssets();
  } finally {
    await browser.close();
    fs.rmSync(authStatePath, { force: true });
    fs.rmSync(tempVideoDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
