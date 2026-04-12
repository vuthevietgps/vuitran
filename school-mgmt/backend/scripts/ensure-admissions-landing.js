'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/school-mgmt';
const LANDING_SLUG = 'tuyen-sinh';
const HOTLINE = '0363614511';
const FALLBACK_CREATED_BY_ID = new mongoose.Types.ObjectId('000000000000000000000001');
const SCREENSHOTS = {
  tuition: '/assets/landing/tuyen-sinh/hoc-phi-phu-huynh.png',
  reportCard: '/assets/landing/tuyen-sinh/hoc-ba-truc-tuyen.png',
  teachers: '/assets/landing/tuyen-sinh/danh-sach-giao-vien.png',
};

function buildBodyHtml() {
  return `
    <div class="ts-landing">
      <section class="ts-banner">
        <div>
          <p class="ts-label">Hotline tuyển sinh</p>
          <a class="ts-phone" href="tel:${HOTLINE}">${HOTLINE}</a>
        </div>
        <p class="ts-banner-copy">
          Phụ huynh hoặc học sinh có thể gọi trực tiếp để được tư vấn lộ trình, xếp lịch học thử và chọn giáo viên phù hợp.
        </p>
      </section>

      <section class="ts-grid ts-grid-2">
        <article class="ts-card">
          <p class="ts-card-kicker">Điểm mạnh hệ thống</p>
          <h2>Học không chỉ là một lớp học, mà là một hệ thống đồng hành xuyên suốt.</h2>
          <ul class="ts-list">
            <li>Giáo viên được kiểm duyệt chuyên môn, theo dõi chất lượng dạy học và KPI rõ ràng.</li>
            <li>Học bạ trực tuyến cập nhật sau buổi học, phụ huynh theo dõi tiến độ mà không cần đợi tổng hợp thủ công.</li>
            <li>AI hỗ trợ gợi ý lộ trình, tổng hợp báo cáo và nhận diện sớm điểm cần bổ sung.</li>
            <li>Lịch học, điểm danh, số buổi còn lại, hóa đơn và thông tin đóng phí được hiển thị minh bạch.</li>
          </ul>
        </article>

        <article class="ts-card ts-card-accent">
          <p class="ts-card-kicker">Dành cho phụ huynh</p>
          <h2>Quan sát được kết quả học tập thay vì chỉ nghe báo cáo.</h2>
          <ul class="ts-list">
            <li>Xem lịch học, điểm danh, nhận xét giáo viên và học bạ theo từng buổi.</li>
            <li>Nhận cảnh báo khi học sinh cần theo sát thêm về kiến thức, thái độ học hoặc mức độ hoàn thành.</li>
            <li>Có dữ liệu rõ ràng để trao đổi với giáo viên và đội ngũ vận hành khi cần điều chỉnh lộ trình.</li>
          </ul>
        </article>
      </section>

      <section class="ts-grid ts-grid-3">
        <article class="ts-metric">
          <strong>1:1 hoặc nhóm nhỏ</strong>
          <span>Lộ trình được tư vấn theo mục tiêu và trình độ hiện tại của học sinh.</span>
        </article>
        <article class="ts-metric">
          <strong>Học bạ trực tuyến</strong>
          <span>Phụ huynh xem được tiến độ, nhận xét và lịch sử học tập ngay trên hệ thống.</span>
        </article>
        <article class="ts-metric">
          <strong>AI hỗ trợ</strong>
          <span>AI tổng hợp dữ liệu học tập, nhắc việc và đề xuất nội dung cần tăng cường.</span>
        </article>
      </section>

      <section class="ts-card">
        <p class="ts-card-kicker">Dành cho học sinh</p>
        <h2>Học để tiến bộ thật sự, không học theo một khuôn mẫu chung.</h2>
        <div class="ts-pill-row">
          <span class="ts-pill">Lộ trình cá nhân hoá</span>
          <span class="ts-pill">Theo dõi tiến độ mỗi buổi</span>
          <span class="ts-pill">Phản hồi nhanh từ giáo viên</span>
          <span class="ts-pill">Ôn tập có định hướng bằng AI</span>
        </div>
        <p class="ts-body-copy">
          Học sinh được học với mục tiêu rõ ràng, biết mình đang gặp vấn đề ở đâu và cần tập trung vào phần nào. Sau mỗi buổi, hệ thống lưu nhận xét, bài tập và kết quả để việc học liên tục, không bị đứt quãng.
        </p>
      </section>

      <section class="ts-grid ts-grid-2">
        <article class="ts-card">
          <p class="ts-card-kicker">Vận hành minh bạch</p>
          <h2>Dễ dàng phối hợp giữa phụ huynh, học sinh, giáo viên và trung tâm.</h2>
          <ul class="ts-list">
            <li>Lịch học và thay đổi lịch được theo dõi tập trung, giảm sót thông tin.</li>
            <li>Thông tin học phí, hóa đơn, ví và các buổi học còn lại hiển thị rõ ràng.</li>
            <li>Lead từ landing page được đưa thẳng vào hệ thống để đội ngũ tuyển sinh chăm sóc không bỏ sót.</li>
          </ul>
        </article>

        <article class="ts-card">
          <p class="ts-card-kicker">Quy trình đăng ký</p>
          <h2>Nhanh, gọn và có người liên hệ thực tế.</h2>
          <ol class="ts-steps">
            <li>Để lại thông tin phụ huynh hoặc học sinh trong form.</li>
            <li>Hệ thống tạo lead ngay để đội ngũ tuyển sinh tiếp nhận.</li>
            <li>Tư vấn lộ trình, xếp lịch học thử và đề xuất giáo viên phù hợp.</li>
            <li>Bắt đầu học với lịch học, báo cáo và theo dõi xuyên suốt trên hệ thống.</li>
          </ol>
        </article>
      </section>

      <section class="ts-card ts-card-gallery">
        <p class="ts-card-kicker">Màn hình thực tế</p>
        <h2>Phụ huynh nhìn rõ học phí, học bạ và đội ngũ giáo viên ngay trên hệ thống.</h2>
        <div class="ts-gallery">
          <figure class="ts-shot">
            <img src="${SCREENSHOTS.tuition}" alt="Màn hình quản lý học phí phụ huynh" loading="lazy" />
            <figcaption>
              <strong>Quản lý học phí phụ huynh</strong>
              <span>Theo dõi tổng đã thanh toán, khoản chờ duyệt và số buổi còn lại theo từng lớp.</span>
            </figcaption>
          </figure>
          <figure class="ts-shot">
            <img src="${SCREENSHOTS.reportCard}" alt="Màn hình học bạ trực tuyến" loading="lazy" />
            <figcaption>
              <strong>Học bạ trực tuyến</strong>
              <span>Xem tiến độ học, bài tập về nhà, nhận xét giáo viên và chỉ số học tập ngay sau mỗi buổi.</span>
            </figcaption>
          </figure>
          <figure class="ts-shot">
            <img src="${SCREENSHOTS.teachers}" alt="Màn hình danh sách giáo viên" loading="lazy" />
            <figcaption>
              <strong>Danh sách giáo viên</strong>
              <span>Quan sát hồ sơ giáo viên, môn dạy, kinh nghiệm, lớp đang phụ trách và người quản lý.</span>
            </figcaption>
          </figure>
        </div>
      </section>
    </div>
  `.trim();
}

function buildCustomHeadHtml() {
  return `
    <style id="lp-tuyen-sinh-styles">
      .content-card {
        overflow: hidden;
      }

      .ts-landing {
        display: grid;
        gap: 20px;
      }

      .ts-banner,
      .ts-card,
      .ts-metric {
        border-radius: 24px;
        border: 1px solid rgba(15, 23, 42, 0.08);
        background:
          linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(248, 250, 252, 0.98));
        box-shadow: 0 18px 45px rgba(15, 23, 42, 0.08);
      }

      .ts-banner {
        display: grid;
        grid-template-columns: minmax(0, 220px) minmax(0, 1fr);
        gap: 18px;
        align-items: center;
        padding: 20px 22px;
        background:
          linear-gradient(135deg, rgba(15, 118, 110, 0.92), rgba(30, 64, 175, 0.92));
        color: #ffffff;
      }

      .ts-label,
      .ts-card-kicker {
        margin: 0 0 10px;
        text-transform: uppercase;
        letter-spacing: 0.16em;
        font-size: 11px;
        font-weight: 800;
      }

      .ts-label {
        color: rgba(255, 255, 255, 0.72);
      }

      .ts-phone {
        color: #ffffff;
        font-size: clamp(1.7rem, 4vw, 2.4rem);
        line-height: 1;
        font-weight: 800;
        text-decoration: none;
      }

      .ts-banner-copy,
      .ts-body-copy {
        margin: 0;
        line-height: 1.8;
      }

      .ts-grid {
        display: grid;
        gap: 18px;
      }

      .ts-grid-2 {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .ts-grid-3 {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }

      .ts-card {
        padding: 22px;
      }

      .ts-card-gallery {
        background:
          linear-gradient(180deg, rgba(248, 250, 252, 0.98), rgba(255, 255, 255, 0.98));
      }

      .ts-card-accent {
        background:
          linear-gradient(180deg, rgba(240, 249, 255, 0.98), rgba(255, 255, 255, 0.98));
      }

      .ts-card h2 {
        margin: 0 0 12px;
        font-size: clamp(1.25rem, 2vw, 1.7rem);
        line-height: 1.25;
        color: #0f172a;
      }

      .ts-list,
      .ts-steps {
        margin: 0;
        padding-left: 18px;
        color: #334155;
        line-height: 1.75;
      }

      .ts-metric {
        padding: 20px;
      }

      .ts-metric strong {
        display: block;
        margin-bottom: 8px;
        font-size: 1rem;
        color: #0f172a;
      }

      .ts-metric span {
        display: block;
        color: #475569;
        line-height: 1.65;
      }

      .ts-pill-row {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        margin-bottom: 14px;
      }

      .ts-pill {
        display: inline-flex;
        align-items: center;
        border-radius: 999px;
        padding: 8px 12px;
        background: rgba(14, 165, 233, 0.11);
        color: #075985;
        font-size: 12px;
        font-weight: 700;
      }

      .ts-gallery {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 16px;
        margin-top: 18px;
      }

      .ts-shot {
        overflow: hidden;
        margin: 0;
        border-radius: 22px;
        border: 1px solid rgba(148, 163, 184, 0.25);
        background: #ffffff;
        box-shadow: 0 16px 32px rgba(15, 23, 42, 0.08);
      }

      .ts-shot img {
        display: block;
        width: 100%;
        aspect-ratio: 16 / 10;
        object-fit: cover;
        object-position: top center;
        background: #e2e8f0;
      }

      .ts-shot figcaption {
        display: grid;
        gap: 6px;
        padding: 14px 16px 16px;
      }

      .ts-shot strong {
        color: #0f172a;
        font-size: 0.98rem;
      }

      .ts-shot span {
        color: #475569;
        line-height: 1.65;
        font-size: 0.9rem;
      }

      @media (max-width: 900px) {
        .ts-banner,
        .ts-grid-2,
        .ts-grid-3,
        .ts-gallery {
          grid-template-columns: 1fr;
        }
      }
    </style>
  `.trim();
}

async function main() {
  await mongoose.connect(MONGO_URI);

  const db = mongoose.connection.db;
  const users = db.collection('users');
  const landingPages = db.collection('landingpages');

  const director =
    (await users.findOne({ role: 'DIRECTOR' }, { sort: { createdAt: 1 } })) ||
    (await users.findOne({ email: 'director.demo@school.local' }));

  const now = new Date();
  const createdById = director?._id || FALLBACK_CREATED_BY_ID;
  const createdByName = director?.fullName || director?.email || 'System Seed';
  const existing = await landingPages.findOne({ slug: LANDING_SLUG });

  const pageCode =
    existing?.pageCode ||
    `LP-${now.getFullYear()}-TS-${String(Date.now()).slice(-6)}`;

  const payload = {
    name: 'Landing Page Tuyển Sinh',
    slug: LANDING_SLUG,
    status: 'ACTIVE',
    heroTitle: 'Tuyển sinh chương trình học cá nhân hoá cho học sinh từ tiểu học đến THPT',
    heroSubtitle: `Đăng ký để nhận lộ trình học phù hợp, học thử và tư vấn nhanh qua hotline ${HOTLINE}.`,
    formTitle: 'Đăng ký tư vấn / học thử',
    formDescription: 'Phụ huynh hoặc học sinh để lại thông tin, hệ thống sẽ đẩy ngay vào lead để đội ngũ tuyển sinh liên hệ.',
    submitButtonText: 'Đăng ký ngay',
    privacyNotice: 'Thông tin được sử dụng để tư vấn tuyển sinh, chăm sóc học tập và đối soát attribution quảng cáo.',
    successTitle: 'Đã ghi nhận đăng ký',
    successMessage: 'Thông tin đã được đưa vào hệ thống lead. Đội ngũ tuyển sinh sẽ liên hệ sớm nhất để tư vấn lộ trình học.',
    bodyHtml: buildBodyHtml(),
    autoCreateLead: true,
    customHeadHtml: buildCustomHeadHtml(),
    customBodyHtml: undefined,
    notes: 'Landing page tuyển sinh mặc định với hotline 0363614511, tiếng Việt có dấu và gallery ảnh màn hình hệ thống.',
    createdById,
    createdByName,
    updatedAt: now,
  };

  await landingPages.updateOne(
    { slug: LANDING_SLUG },
    {
      $set: payload,
      $setOnInsert: {
        pageCode,
        createdAt: now,
      },
    },
    { upsert: true },
  );

  const saved = await landingPages.findOne({ slug: LANDING_SLUG });

  console.log(
    JSON.stringify(
      {
        ok: true,
        slug: LANDING_SLUG,
        pageId: saved?._id?.toString?.() || null,
        pageCode,
        hotline: HOTLINE,
        route: `/lp/${LANDING_SLUG}`,
        updatedAt: now.toISOString(),
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => undefined);
  });
