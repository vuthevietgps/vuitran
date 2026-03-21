import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(frontendRoot, '..');
const assetsRoot = path.join(frontendRoot, 'src', 'assets', 'internal-handbook');
const imagesDir = path.join(assetsRoot, 'images');
const videosDir = path.join(assetsRoot, 'videos');
const tempVideoDir = path.join(videosDir, '.tmp');

const BASE_URL = process.env.INTERNAL_HANDBOOK_BASE_URL || 'http://localhost:4200';
const DEMO_PASSWORD = process.env.INTERNAL_HANDBOOK_PASSWORD || readDemoPassword();
const DEFAULT_VIEWPORT = { width: 1500, height: 960 };

const ROLE_GUIDES = [
  {
    key: 'director',
    email: 'director.demo@school.local',
    overview: {
      eyebrow: 'Cẩm nang giám đốc',
      title: 'Giám đốc theo dõi tổng quan, phê duyệt và kiểm soát rủi ro vận hành',
      subtitle:
        'Bộ ảnh này mô tả luồng ưu tiên của giám đốc từ dashboard tổng quan sang chờ duyệt, tài chính và truy vết hoạt động để ra quyết định nhanh nhưng vẫn an toàn quyền hạn.',
      chips: ['Role: DIRECTOR', 'Ưu tiên: tổng quan - phê duyệt - tài chính', 'Môi trường: localhost'],
      columns: [
        {
          icon: '01',
          title: 'Mở đầu ngày',
          items: ['Xem dashboard để nắm doanh thu, lớp học, ticket và cảnh báo.', 'Đi vào khu vực chờ duyệt khi có hóa đơn, lương hoặc chi phí cần xử lý.', 'Đánh dấu ngay các điểm nghẽn cần giao cho vận hành hoặc kế toán.'],
        },
        {
          icon: '02',
          title: 'Kiểm soát tài chính',
          items: ['Theo dõi financial control và wallet để nhìn rõ luồng tiền.', 'Đối chiếu công nợ, sao kê và khoản mục lương trước khi chốt.', 'Chỉ duyệt những thay đổi có dữ liệu đối chiếu đủ.'],
        },
        {
          icon: '03',
          title: 'Truy vết và quyết định',
          items: ['Mở audit log khi cần kiểm tra ai đã tạo hoặc sửa nghiệp vụ.', 'So sánh hiệu suất nhân sự để ưu tiên nguồn lực.', 'Dùng handbook này như bản đồ điều hướng nội bộ theo ngày làm việc.'],
        },
      ],
      footer: 'Ảnh và video được quay từ chính môi trường demo nội bộ để dùng cho đào tạo quản lý.',
    },
    captures: [
      { route: '/app/dashboard', file: 'director_dashboard.webp' },
      { route: '/app/pending-approvals', file: 'director_pending_approvals.webp' },
      { route: '/app/financial-control', file: 'director_financial_control.webp' },
    ],
    video: {
      file: 'director_daily_flow.webm',
      steps: [
        { route: '/app/dashboard', pauseMs: 2200 },
        { route: '/app/pending-approvals', pauseMs: 2200 },
        { route: '/app/financial-control', pauseMs: 2200 },
        { route: '/app/audit-log', pauseMs: 2200 },
      ],
    },
  },
  {
    key: 'accounting',
    email: 'accounting.demo@school.local',
    overview: {
      eyebrow: 'Cẩm nang kế toán',
      title: 'Kế toán đi từ dashboard sang ví, hóa đơn và payroll để đối soát',
      subtitle:
        'Bộ minh họa này tập trung vào những màn hình kế toán dùng thường xuyên nhất: duyệt top-up, đối soát ví, xử lý hóa đơn và theo dõi kỳ lương mà không đụng sang quyền vận hành ngoài phạm vi.',
      chips: ['Role: ACCOUNTING', 'Ưu tiên: ví - hóa đơn - payroll', 'Có quyền đọc học sinh/lớp để đối chiếu'],
      columns: [
        {
          icon: '01',
          title: 'Đầu ca kế toán',
          items: ['Xem dashboard để kiểm tra top-up chờ duyệt và dòng tiền bất thường.', 'Mở ví học viên để xử lý yêu cầu nạp tiền kèm chứng từ.', 'Rà nhanh ledger sau khi duyệt để chắc số dư đã cập nhật đúng.'],
        },
        {
          icon: '02',
          title: 'Xử lý công nợ',
          items: ['Theo dõi hóa đơn và trạng thái thanh toán.', 'Mở báo cáo công nợ hoặc sao kê ngân hàng khi cần chốt số.', 'Chỉ giữ kế toán ở chế độ đọc với dữ liệu học sinh, không sửa hồ sơ học sinh.'],
        },
        {
          icon: '03',
          title: 'Đóng kỳ lương',
          items: ['Đi qua teaching report hoặc sessions để kiểm tra đầu vào lương.', 'Đối chiếu payroll và staff payroll theo kỳ.', 'Khi có thay đổi chính sách lương, phối hợp với giám đốc trước khi chỉnh cấu hình.'],
        },
      ],
      footer: 'Ảnh và video giúp kế toán mới nhìn nhanh luồng đối soát chuẩn trên hệ thống.',
    },
    captures: [
      { route: '/app/dashboard', file: 'accounting_dashboard.webp' },
      { route: '/app/wallets', file: 'accounting_wallets.webp' },
      { route: '/app/payroll', file: 'accounting_payroll.webp' },
    ],
    video: {
      file: 'accounting_daily_flow.webm',
      steps: [
        { route: '/app/dashboard', pauseMs: 2200 },
        { route: '/app/wallets', pauseMs: 2500 },
        { route: '/app/invoices', pauseMs: 2200 },
        { route: '/app/payroll', pauseMs: 2200 },
      ],
    },
  },
  {
    key: 'ops',
    email: 'ops.demo@school.local',
    overview: {
      eyebrow: 'Cẩm nang vận hành',
      title: 'Vận hành tập trung vào lớp học, lịch dạy, ticket và điều phối phát sinh',
      subtitle:
        'Luồng ưu tiên của vận hành là giữ lịch học ổn định, phân lớp đúng người, chốt attendance và xử lý ticket nhanh. Các thao tác chạm vào tiền mặt hoặc chuyển ví không nằm trong phạm vi role này.',
      chips: ['Role: OPS', 'Ưu tiên: lớp - session - ticket', 'Không có quyền chuyển ví'],
      columns: [
        {
          icon: '01',
          title: 'Xếp lớp và lịch',
          items: ['Mở danh sách lớp để kiểm tra giáo viên, sale và học sinh được gán.', 'Tạo hoặc cập nhật session sau khi lớp sẵn sàng.', 'Theo dõi lịch và vật tư giảng dạy trước giờ vào ca.'],
        },
        {
          icon: '02',
          title: 'Điều phối trong ngày',
          items: ['Rà attendance, ticket và các yêu cầu thay thế giáo viên.', 'Giao tiếp nội bộ bằng ticket và tin nhắn để đóng vòng phát sinh.', 'Dùng handbook này như checklist bàn giao giữa các ca vận hành.'],
        },
        {
          icon: '03',
          title: 'Bàn giao sang bộ phận khác',
          items: ['Nếu phát sinh luồng tiền thì bàn giao kế toán hoặc giám đốc.', 'Nếu cần tiếp nhận lead từ chatbot thì chuyển sale.', 'Giữ vai trò điều phối thay vì tự xử lý nghiệp vụ ngoài quyền.'],
        },
      ],
      footer: 'Đây là bộ minh họa dùng tốt cho onboarding vận hành hoặc kiểm tra logic quyền hiển thị.',
    },
    captures: [
      { route: '/app/dashboard', file: 'ops_dashboard.webp' },
      { route: '/app/classes', file: 'ops_classes.webp' },
      { route: '/app/tickets', file: 'ops_tickets.webp' },
    ],
    video: {
      file: 'ops_daily_flow.webm',
      steps: [
        { route: '/app/dashboard', pauseMs: 2200 },
        { route: '/app/classes', pauseMs: 2400 },
        { route: '/app/sessions', pauseMs: 2200 },
        { route: '/app/tickets', pauseMs: 2200 },
      ],
    },
  },
  {
    key: 'parent',
    email: 'parent.demo@school.local',
    overview: {
      eyebrow: 'Cẩm nang phụ huynh',
      title: 'Phụ huynh chỉ theo dõi tiến độ học, lịch học, buổi học và ví của mình',
      subtitle:
        'Trang minh họa này cho thấy phạm vi đúng của phụ huynh: xem tiến độ của con, xác nhận buổi học, theo dõi thanh toán và gửi yêu cầu nạp ví mà không đi vào khu vực nội bộ khác.',
      chips: ['Role: PARENT', 'Ưu tiên: tiến độ - buổi học - ví', 'Chỉ xem dữ liệu của chính mình'],
      columns: [
        {
          icon: '01',
          title: 'Theo dõi học tập',
          items: ['Xem dashboard và student progress để nắm tình hình học tập.', 'Rà lịch học và điểm danh trong tuần.', 'Theo dõi các buổi cần xác nhận sau khi giáo viên hoàn thành.'],
        },
        {
          icon: '02',
          title: 'Xác nhận và thanh toán',
          items: ['Đi vào sessions để xác nhận buổi học khi cần.', 'Theo dõi hóa đơn và số dư ví.', 'Gửi yêu cầu nạp ví kèm biên lai chuyển khoản nếu cần.'],
        },
        {
          icon: '03',
          title: 'Giới hạn quyền',
          items: ['Phụ huynh không được xem dữ liệu học sinh khác.', 'Không có quyền truy cập quản trị nội bộ.', 'Mọi thao tác tài chính đều gắn với tài khoản của chính mình.'],
        },
      ],
      footer: 'Bộ cẩm nang này hữu ích khi hướng dẫn phụ huynh sử dụng cổng nội bộ trong giai đoạn đầu.',
    },
    captures: [
      { route: '/app/dashboard', file: 'parent_dashboard.webp' },
      { route: '/app/student-progress', file: 'parent_progress.webp' },
      { route: '/app/wallets', file: 'parent_wallets.webp' },
    ],
    video: {
      file: 'parent_daily_flow.webm',
      steps: [
        { route: '/app/dashboard', pauseMs: 2200 },
        { route: '/app/student-progress', pauseMs: 2200 },
        { route: '/app/sessions', pauseMs: 2200 },
        { route: '/app/wallets', pauseMs: 2200 },
      ],
    },
  },
  {
    key: 'sale',
    email: 'sale.huong@school.local',
    overview: {
      eyebrow: 'Cẩm nang sale',
      title: 'Sale theo dõi lead, chốt đơn, bàn giao cho vận hành và kiểm tra hoa hồng',
      subtitle:
        'Bộ minh họa dành cho sale tập trung vào funnel chính: dashboard, lead, order và các đầu vào marketing. Mục tiêu là chốt nhanh nhưng vẫn bàn giao đúng cho vận hành và kế toán.',
      chips: ['Role: SALE', 'Ưu tiên: lead - order - hoa hồng', 'Không chạm vào ví và kiểm soát tài chính'],
      columns: [
        {
          icon: '01',
          title: 'Từ lead sang follow-up',
          items: ['Mở dashboard để xem lượng follow-up trong ngày.', 'Đi vào leads để cập nhật trạng thái và lịch hẹn.', 'Nhận bàn giao hội thoại chatbot khi cần.'],
        },
        {
          icon: '02',
          title: 'Chốt và bàn giao',
          items: ['Tạo order khi lead đủ điều kiện.', 'Theo dõi hóa đơn và tình trạng đơn sau khi chốt.', 'Bàn giao đúng thông tin cho vận hành để xếp lớp.'],
        },
        {
          icon: '03',
          title: 'Nhìn lại hiệu quả',
          items: ['Theo dõi báo cáo hoa hồng.', 'Rà landing page và chất lượng đầu vào marketing.', 'Dùng handbook để chuẩn hóa cách thao tác giữa các bạn sale.'],
        },
      ],
      footer: 'Bộ ảnh và video này giúp sale mới nắm nhanh lộ trình thao tác chuẩn trên hệ thống.',
    },
    captures: [
      { route: '/app/dashboard', file: 'sale_dashboard.webp' },
      { route: '/app/leads', file: 'sale_leads.webp' },
      { route: '/app/orders', file: 'sale_orders.webp' },
    ],
    video: {
      file: 'sale_daily_flow.webm',
      steps: [
        { route: '/app/dashboard', pauseMs: 2200 },
        { route: '/app/leads', pauseMs: 2400 },
        { route: '/app/orders', pauseMs: 2200 },
        { route: '/app/commission-report', pauseMs: 2200 },
      ],
    },
  },
];

function readDemoPassword() {
  const envPath = path.join(repoRoot, '.env');
  const raw = fs.readFileSync(envPath, 'utf8');
  const match = raw.match(/^DEMO_PASSWORD=(.+)$/m);
  if (!match) {
    throw new Error(`Không tìm thấy DEMO_PASSWORD trong ${envPath}`);
  }
  return match[1].trim();
}

function ensureDir(targetPath) {
  fs.mkdirSync(targetPath, { recursive: true });
}

function buildSlideHtml({ eyebrow, title, subtitle, chips = [], columns = [], footer }) {
  const chipHtml = chips.map((chip) => `<span class="chip">${chip}</span>`).join('');
  const columnHtml = columns
    .map(
      (column) => `
        <article class="panel">
          <div class="panel-icon">${column.icon}</div>
          <h3>${column.title}</h3>
          <ul>${column.items.map((item) => `<li>${item}</li>`).join('')}</ul>
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
              radial-gradient(circle at top left, rgba(250, 204, 21, 0.24), transparent 26%),
              radial-gradient(circle at 85% 12%, rgba(45, 212, 191, 0.28), transparent 22%),
              linear-gradient(135deg, #0f172a 0%, #16324f 48%, #1f2937 100%);
          }
          .frame {
            min-height: 100vh;
            padding: 54px 62px;
            display: flex;
            flex-direction: column;
            gap: 26px;
          }
          .eyebrow {
            display: inline-flex;
            width: fit-content;
            padding: 8px 14px;
            border-radius: 999px;
            background: rgba(255, 255, 255, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.16);
            text-transform: uppercase;
            letter-spacing: 0.06em;
            font-size: 14px;
            font-weight: 800;
          }
          h1 {
            margin: 0;
            max-width: 1020px;
            font-size: 58px;
            line-height: 1.05;
            letter-spacing: -0.03em;
          }
          .subtitle {
            margin: 0;
            max-width: 1080px;
            font-size: 24px;
            line-height: 1.5;
            color: rgba(248, 250, 252, 0.9);
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
            border: 1px solid rgba(248, 250, 252, 0.12);
            font-size: 16px;
            font-weight: 600;
          }
          .grid {
            display: grid;
            grid-template-columns: repeat(${Math.max(columns.length, 1)}, minmax(0, 1fr));
            gap: 18px;
            flex: 1;
          }
          .panel {
            padding: 22px;
            border-radius: 26px;
            background: rgba(15, 23, 42, 0.42);
            border: 1px solid rgba(255, 255, 255, 0.12);
            box-shadow: 0 20px 50px rgba(2, 6, 23, 0.18);
            backdrop-filter: blur(12px);
          }
          .panel-icon {
            font-size: 24px;
            margin-bottom: 14px;
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
            line-height: 1.48;
            color: rgba(248, 250, 252, 0.92);
          }
          li::marker {
            color: #facc15;
          }
          .footer {
            font-size: 16px;
            color: rgba(248, 250, 252, 0.8);
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

async function waitForApp(page, timeout = 8000) {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForLoadState('networkidle', { timeout }).catch(() => {});
  await page.waitForTimeout(900);
}

async function captureWebp(page, targetPath, viewport = DEFAULT_VIEWPORT) {
  await page.setViewportSize(viewport);
  await page.waitForTimeout(500);
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

async function login(page, email) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
  await waitForApp(page);
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(DEMO_PASSWORD);
  await Promise.all([
    page.waitForURL('**/app/dashboard', { timeout: 20000 }),
    page.locator('button[type="submit"]').click(),
  ]);
  await waitForApp(page, 10000);
}

async function createOverviewSlides(browser) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const page = await context.newPage();

  for (const guide of ROLE_GUIDES) {
    await page.setContent(buildSlideHtml(guide.overview), { waitUntil: 'load' });
    await page.waitForTimeout(400);
    await captureWebp(page, path.join(imagesDir, `${guide.key}_overview.webp`), {
      width: 1600,
      height: 900,
    });
    console.log(`Đã tạo ảnh overview cho ${guide.key}`);
  }

  await context.close();
}

async function captureRoleScreens(browser) {
  for (const guide of ROLE_GUIDES) {
    const context = await browser.newContext({ viewport: DEFAULT_VIEWPORT });
    const page = await context.newPage();

    await login(page, guide.email);

    for (const capture of guide.captures) {
      await page.goto(`${BASE_URL}${capture.route}`, { waitUntil: 'domcontentloaded' });
      await waitForApp(page, 10000);
      await captureWebp(page, path.join(imagesDir, capture.file), capture.viewport || DEFAULT_VIEWPORT);
      console.log(`Đã chụp ${capture.file}`);
    }

    await context.close();
  }
}

async function recordRoleVideos(browser) {
  for (const guide of ROLE_GUIDES) {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      recordVideo: {
        dir: tempVideoDir,
        size: { width: 1440, height: 900 },
      },
    });
    const page = await context.newPage();
    const video = page.video();

    await login(page, guide.email);
    await page.waitForTimeout(1600);

    for (const step of guide.video.steps) {
      await page.goto(`${BASE_URL}${step.route}`, { waitUntil: 'domcontentloaded' });
      await waitForApp(page, 10000);
      await page.waitForTimeout(step.pauseMs || 1800);
      await page.mouse.wheel(0, 420);
      await page.waitForTimeout(450);
      await page.mouse.wheel(0, -420);
      await page.waitForTimeout(450);
    }

    await page.waitForTimeout(1200);
    await context.close();

    const rawVideoPath = await video.path();
    const targetPath = path.join(videosDir, guide.video.file);
    if (fs.existsSync(targetPath)) {
      fs.rmSync(targetPath, { force: true });
    }
    fs.renameSync(rawVideoPath, targetPath);
    console.log(`Đã quay ${guide.video.file}`);
  }
}

async function main() {
  ensureDir(imagesDir);
  ensureDir(videosDir);
  ensureDir(tempVideoDir);

  const browser = await chromium.launch({ headless: true });

  try {
    await createOverviewSlides(browser);
    await captureRoleScreens(browser);
    await recordRoleVideos(browser);
  } finally {
    await browser.close();
    fs.rmSync(tempVideoDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
