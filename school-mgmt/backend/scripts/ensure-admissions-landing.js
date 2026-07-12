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
const PREMIUM_HERO_IMAGE = 'https://images.unsplash.com/photo-1577896851231-70ef18881754?auto=format&fit=crop&q=80&w=1200';
const PATH_IMAGE = 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&q=80&w=800';

function buildBodyHtml() {
  return `
    <div class="premium-content">
      <div class="premium-hero-img-wrapper">
        <img src="${PREMIUM_HERO_IMAGE}" alt="Môi trường học tập chuyên nghiệp" class="premium-hero-img" />
      </div>

      <div class="premium-split">
        <div class="premium-split-content">
          <h2 class="premium-heading">Giáo Dục Lấy Học Sinh Làm Trung Tâm</h2>
          <p class="premium-text">
            Chúng tôi tin rằng mỗi học sinh là một cá thể duy nhất với nhịp độ và phong cách học tập khác biệt. Thay vì áp dụng một khuôn mẫu chung, hệ thống của chúng tôi thiết kế <strong>lộ trình học tập cá nhân hóa</strong> cho từng học viên nhằm khai phóng tối đa tiềm năng.
          </p>
          <div class="premium-features">
            <div class="feature-item">
              <span class="feature-icon">✓</span>
              <div class="feature-content">
                <strong>Lộ trình chuyên biệt</strong>
                <span>Giáo trình được tinh chỉnh liên tục dựa trên năng lực và kết quả thực tế của học sinh.</span>
              </div>
            </div>
            <div class="feature-item">
              <span class="feature-icon">✓</span>
              <div class="feature-content">
                <strong>Trợ lý học tập AI</strong>
                <span>Công nghệ trí tuệ nhân tạo phân tích điểm mạnh, điểm yếu để đưa ra gợi ý ôn tập chính xác.</span>
              </div>
            </div>
            <div class="feature-item">
              <span class="feature-icon">✓</span>
              <div class="feature-content">
                <strong>Báo cáo thời gian thực</strong>
                <span>Cập nhật tiến độ học tập và đánh giá của giáo viên ngay lập tức sau mỗi buổi học.</span>
              </div>
            </div>
          </div>
        </div>
        <div class="premium-split-image">
          <img src="${PATH_IMAGE}" alt="Lộ trình học tập" loading="lazy" />
        </div>
      </div>

      <hr class="premium-divider" />

      <section class="premium-section">
        <h2 class="premium-heading text-center">Trải Nghiệm Công Nghệ Đỉnh Cao</h2>
        <p class="premium-text text-center" style="max-width: 600px; margin: 0 auto;">
          Một nền tảng duy nhất kết nối chặt chẽ giữa Nhà trường - Gia đình - Học sinh. Mọi thông tin được thiết kế trực quan, rõ nét và minh bạch tuyệt đối trên mọi thiết bị.
        </p>
        
        <div class="spotlight-stack">
          <!-- Spotlight 1 -->
          <figure class="spotlight-item">
            <div class="spotlight-img-wrapper">
              <img src="${SCREENSHOTS.reportCard}" alt="Học bạ điện tử" loading="lazy" />
            </div>
            <figcaption class="spotlight-caption">
              <h3>Học bạ điện tử thông minh</h3>
              <p>Phụ huynh theo dõi sát sao từng thay đổi trong kết quả, thái độ học tập và nhận xét của giáo viên ngay sau mỗi buổi học. Đồ thị trực quan giúp nhìn rõ sự tiến bộ theo thời gian.</p>
            </figcaption>
          </figure>

          <!-- Spotlight 2 -->
          <figure class="spotlight-item">
            <div class="spotlight-img-wrapper">
              <img src="${SCREENSHOTS.teachers}" alt="Đội ngũ chuyên gia" loading="lazy" />
            </div>
            <figcaption class="spotlight-caption">
              <h3>Hồ sơ Đội ngũ chuyên môn</h3>
              <p>Kiểm chứng hồ sơ, kinh nghiệm, bằng cấp và năng lực của từng giáo viên giảng dạy. Bạn hoàn toàn an tâm khi biết rõ ai đang đồng hành cùng sự phát triển của con mình.</p>
            </figcaption>
          </figure>

          <!-- Spotlight 3 -->
          <figure class="spotlight-item">
            <div class="spotlight-img-wrapper">
              <img src="${SCREENSHOTS.tuition}" alt="Quản lý tài chính" loading="lazy" />
            </div>
            <figcaption class="spotlight-caption">
              <h3>Quản lý tài chính minh bạch</h3>
              <p>Hệ thống ví điện tử và hóa đơn trực tuyến giúp bạn dễ dàng theo dõi số buổi học còn lại, lịch sử đóng học phí và thực hiện thanh toán nhanh chóng chỉ với vài thao tác.</p>
            </figcaption>
          </figure>
        </div>
      </section>

      <div class="premium-contact">
        <div class="contact-info">
          <span class="contact-label">Hotline Tuyển sinh</span>
          <a href="tel:${HOTLINE}" class="contact-phone">${HOTLINE.replace(/(\d{4})(\d{3})(\d{3})/, '$1 $2 $3')}</a>
        </div>
        <div class="contact-desc">
          Bộ phận tuyển sinh luôn sẵn sàng hỗ trợ trực tiếp 24/7 để giải đáp thắc mắc và đặt lịch kiểm tra năng lực.
        </div>
      </div>
    </div>
  `.trim();
}

function buildCustomHeadHtml() {
  return `
    <style id="lp-tuyen-sinh-premium-styles">
      .premium-content {
        display: flex;
        flex-direction: column;
        gap: 40px;
        font-family: Inter, system-ui, -apple-system, sans-serif;
        color: #334155;
      }

      .text-center {
        text-align: center;
      }

      .premium-hero-img-wrapper {
        margin: -24px -24px 8px -24px;
        overflow: hidden;
        border-radius: 26px 26px 0 0;
        background: #e2e8f0;
      }

      .premium-hero-img {
        width: 100%;
        height: 380px;
        object-fit: cover;
        display: block;
        transform: scale(1.01);
        transition: transform 0.6s cubic-bezier(0.16, 1, 0.3, 1);
      }

      .premium-hero-img:hover {
        transform: scale(1.03);
      }
      
      .premium-split {
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(0, 0.8fr);
        gap: 32px;
        align-items: stretch;
      }

      .premium-split-content {
        display: flex;
        flex-direction: column;
        gap: 20px;
        justify-content: center;
      }

      .premium-split-image {
        width: 100%;
        border-radius: 20px;
        overflow: hidden;
        box-shadow: 0 12px 30px rgba(15, 23, 42, 0.08);
      }

      .premium-split-image img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }

      .premium-section {
        display: flex;
        flex-direction: column;
        gap: 20px;
      }

      .premium-heading {
        font-size: 1.7rem;
        color: #0f172a;
        font-weight: 800;
        line-height: 1.3;
        margin: 0;
        letter-spacing: -0.02em;
      }

      .premium-text {
        font-size: 1.1rem;
        line-height: 1.7;
        margin: 0;
        color: #475569;
      }

      .premium-text strong {
        color: #0f172a;
        font-weight: 600;
      }

      .premium-features {
        display: flex;
        flex-direction: column;
        gap: 20px;
        margin-top: 12px;
      }

      .feature-item {
        display: flex;
        gap: 20px;
        align-items: flex-start;
      }

      .feature-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        width: 28px;
        height: 28px;
        background: rgba(15, 118, 110, 0.1);
        color: #0f766e;
        border-radius: 50%;
        font-size: 15px;
        font-weight: 800;
        margin-top: 2px;
      }

      .feature-content {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      .feature-content strong {
        color: #0f172a;
        font-size: 1.1rem;
        font-weight: 700;
      }

      .feature-content span {
        font-size: 1rem;
        color: #475569;
        line-height: 1.6;
      }

      .premium-divider {
        border: 0;
        height: 1px;
        background: linear-gradient(90deg, rgba(148,163,184,0.05) 0%, rgba(148,163,184,0.3) 50%, rgba(148,163,184,0.05) 100%);
        margin: 12px 0;
      }

      /* SPOTLIGHT DESIGN cho hình ảnh phần mềm to rõ */
      .spotlight-stack {
        display: flex;
        flex-direction: column;
        gap: 60px;
        margin-top: 32px;
      }

      .spotlight-item {
        margin: 0;
        display: flex;
        flex-direction: column;
        gap: 24px;
        align-items: center;
      }

      .spotlight-img-wrapper {
        width: 100%;
        overflow: hidden;
        border-radius: 20px;
        border: 1px solid rgba(15, 23, 42, 0.1);
        background: #f8fafc;
        box-shadow: 0 16px 40px rgba(15, 23, 42, 0.08);
        transition: transform 0.5s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.5s;
        cursor: zoom-in;
      }

      .spotlight-img-wrapper:hover {
        transform: translateY(-6px);
        box-shadow: 0 24px 50px rgba(15, 23, 42, 0.12);
      }

      .spotlight-img-wrapper img {
        display: block;
        width: 100%;
        height: auto;
        object-fit: cover;
      }

      .spotlight-caption {
        text-align: center;
        max-width: 640px;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .spotlight-caption h3 {
        margin: 0;
        color: #0f172a;
        font-size: 1.4rem;
        font-weight: 800;
        letter-spacing: -0.01em;
      }

      .spotlight-caption p {
        margin: 0;
        color: #475569;
        font-size: 1.05rem;
        line-height: 1.7;
      }

      .premium-contact {
        background: #f8fafc;
        border-radius: 20px;
        padding: 28px 32px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 24px;
        border: 1px solid rgba(15, 23, 42, 0.06);
        margin-top: 16px;
      }

      .contact-info {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .contact-label {
        text-transform: uppercase;
        font-size: 11px;
        font-weight: 800;
        letter-spacing: 0.15em;
        color: #64748b;
      }

      .contact-phone {
        font-size: 2rem;
        font-weight: 800;
        color: #0f172a;
        text-decoration: none;
        line-height: 1;
        letter-spacing: -0.02em;
        transition: color 0.2s;
      }

      .contact-phone:hover {
        color: #0f766e;
      }

      .contact-desc {
        font-size: 1rem;
        color: #475569;
        max-width: 260px;
        text-align: right;
        line-height: 1.6;
      }

      @media (max-width: 960px) {
        .premium-split {
          grid-template-columns: 1fr;
        }
        .premium-split-image {
          min-height: 280px;
        }
      }

      @media (max-width: 768px) {
        .spotlight-stack {
          gap: 48px;
        }
        .spotlight-caption h3 {
          font-size: 1.25rem;
        }
        .premium-contact {
          flex-direction: column;
          align-items: flex-start;
          text-align: left;
        }
        .contact-desc {
          text-align: left;
          max-width: 100%;
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
    name: 'Landing Page Tuyển Sinh (Premium)',
    slug: LANDING_SLUG,
    status: 'ACTIVE',
    heroTitle: 'Hệ Thống Giáo Dục Cá Nhân Hóa',
    heroSubtitle: 'Đánh thức tiềm năng bằng lộ trình học tập chuyên biệt, công nghệ AI và đội ngũ chuyên gia tận tâm. Môi trường học tập chuẩn mực và minh bạch 100%.',
    formTitle: 'Kiểm tra năng lực & Học thử',
    formDescription: 'Đăng ký ngay hôm nay để nhận đặc quyền đánh giá năng lực toàn diện và trải nghiệm 1 buổi học thử cùng chuyên gia.',
    submitButtonText: 'Đăng ký nhận lộ trình',
    privacyNotice: 'Thông tin của quý khách được bảo vệ chặt chẽ và chỉ sử dụng cho mục đích xếp lớp, tư vấn lộ trình giáo dục.',
    successTitle: 'Ghi nhận đăng ký thành công',
    successMessage: 'Cảm ơn quý phụ huynh. Đội ngũ Tuyển sinh cấp cấp sẽ liên hệ lại trực tiếp qua điện thoại để hỗ trợ xếp lịch đánh giá năng lực cho học viên.',
    bodyHtml: buildBodyHtml(),
    autoCreateLead: true,
    customHeadHtml: buildCustomHeadHtml(),
    customBodyHtml: undefined,
    notes: 'Thiết kế chuẩn premium, thêm ảnh minh hoạ lộ trình học tập và Spotlight layout cho ảnh ứng dụng.',
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