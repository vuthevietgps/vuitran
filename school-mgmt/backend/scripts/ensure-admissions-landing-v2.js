'use strict';

/**
 * Landing Page Tuyển Sinh - v2 (Redesign)
 * Chạy: node scripts/ensure-admissions-landing-v2.js
 *
 * Thay thế hoàn toàn nội dung slug "tuyen-sinh" bằng bản thiết kế mới:
 *  - Hero gradient với thống kê nổi bật
 *  - Thanh trust (số liệu ấn tượng)
 *  - Benefit cards 3 cột
 *  - Quy trình đăng ký 3 bước
 *  - Tech screenshots xen kẽ trái-phải
 *  - Testimonials phụ huynh
 *  - FAQ CSS-only
 *  - CTA cuối mạnh
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/school-mgmt';
const LANDING_SLUG = 'tuyen-sinh';
const HOTLINE = '0363614511';
const HOTLINE_DISPLAY = '036 361 4511';
const FALLBACK_CREATED_BY_ID = new mongoose.Types.ObjectId('000000000000000000000001');

const SCREENSHOTS = {
  tuition: '/assets/landing/tuyen-sinh/hoc-phi-phu-huynh.png',
  reportCard: '/assets/landing/tuyen-sinh/hoc-ba-truc-tuyen.png',
  teachers: '/assets/landing/tuyen-sinh/danh-sach-giao-vien.png',
};

const IMAGES = {
  hero: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&q=80&w=1400',
  classroom: 'https://images.unsplash.com/photo-1580582932707-520aed937b7b?auto=format&fit=crop&q=80&w=800',
  onlineLearn: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&q=80&w=800',
  achievement: 'https://images.unsplash.com/photo-1571260899304-425eee4c7efc?auto=format&fit=crop&q=80&w=800',
};

/* ─── HTML BODY ─────────────────────────────────────────────────────────── */
function buildBodyHtml() {
  return `
<div class="v2-page">

  <!-- ══ TRUST BAR ══════════════════════════════════════════════════════ -->
  <div class="v2-trust-bar">
    <div class="v2-trust-item">
      <span class="v2-trust-num">1,200<span class="v2-trust-plus">+</span></span>
      <span class="v2-trust-label">Học viên đang theo học</span>
    </div>
    <div class="v2-trust-divider"></div>
    <div class="v2-trust-item">
      <span class="v2-trust-num">98<span class="v2-trust-pct">%</span></span>
      <span class="v2-trust-label">Phụ huynh hài lòng</span>
    </div>
    <div class="v2-trust-divider"></div>
    <div class="v2-trust-item">
      <span class="v2-trust-num">8</span>
      <span class="v2-trust-label">Năm kinh nghiệm</span>
    </div>
    <div class="v2-trust-divider"></div>
    <div class="v2-trust-item">
      <span class="v2-trust-num">40<span class="v2-trust-plus">+</span></span>
      <span class="v2-trust-label">Giáo viên chuyên môn</span>
    </div>
  </div>

  <!-- ══ HERO VISUAL ══════════════════════════════════════════════════════ -->
  <div class="v2-hero-visual">
    <div class="v2-hero-img-wrap">
      <img src="${IMAGES.hero}" alt="Học sinh học tập tích cực" class="v2-hero-img" />
      <div class="v2-hero-overlay"></div>
    </div>
    <div class="v2-hero-badge-group">
      <div class="v2-hero-badge">
        <span class="v2-badge-icon">🏅</span>
        <span>Đạt chuẩn Giáo dục Quốc gia</span>
      </div>
      <div class="v2-hero-badge">
        <span class="v2-badge-icon">🤖</span>
        <span>Ứng dụng AI trong giảng dạy</span>
      </div>
      <div class="v2-hero-badge">
        <span class="v2-badge-icon">🔒</span>
        <span>Bảo mật dữ liệu học sinh</span>
      </div>
    </div>
  </div>

  <!-- ══ SECTION: LÝ DO CHỌN CHÚNG TÔI ══════════════════════════════════ -->
  <section class="v2-section">
    <div class="v2-section-tag">Điểm khác biệt</div>
    <h2 class="v2-section-heading">Vì sao hàng nghìn phụ huynh<br/><span class="v2-accent">tin tưởng chúng tôi?</span></h2>
    <p class="v2-section-sub">Không chỉ là dạy – chúng tôi xây dựng nền tảng tư duy, kỹ năng và thái độ học tập đúng đắn để mỗi học sinh tự tin chinh phục mọi thách thức.</p>

    <div class="v2-benefit-grid">
      <div class="v2-benefit-card v2-card-teal">
        <div class="v2-benefit-icon">🎯</div>
        <h3>Lộ trình cá nhân hóa</h3>
        <p>Mỗi học sinh nhận một kế hoạch học tập riêng biệt, được điều chỉnh liên tục dựa trên kết quả thực tế và mục tiêu học tập cụ thể.</p>
      </div>
      <div class="v2-benefit-card v2-card-indigo">
        <div class="v2-benefit-icon">🤖</div>
        <h3>Trợ lý AI thông minh</h3>
        <p>Hệ thống AI phân tích điểm mạnh, điểm yếu và đưa ra gợi ý ôn tập tối ưu — giúp học sinh tiến bộ nhanh hơn với ít nỗ lực lãng phí hơn.</p>
      </div>
      <div class="v2-benefit-card v2-card-violet">
        <div class="v2-benefit-icon">📊</div>
        <h3>Minh bạch 100%</h3>
        <p>Phụ huynh xem học bạ điện tử, nhận xét của giáo viên và lịch sử học phí theo thời gian thực — không có bất kỳ thông tin nào bị che khuất.</p>
      </div>
      <div class="v2-benefit-card v2-card-emerald">
        <div class="v2-benefit-icon">👨‍🏫</div>
        <h3>Giáo viên được kiểm định</h3>
        <p>Đội ngũ 40+ giáo viên đều qua quá trình tuyển chọn nghiêm ngặt, hồ sơ và bằng cấp được công khai minh bạch trên hệ thống.</p>
      </div>
      <div class="v2-benefit-card v2-card-amber">
        <div class="v2-benefit-icon">🔔</div>
        <h3>Thông báo tức thì</h3>
        <p>Nhận thông báo ngay sau mỗi buổi học: điểm số, nhận xét, bài tập về nhà và cả những tiến bộ nhỏ của con bạn.</p>
      </div>
      <div class="v2-benefit-card v2-card-rose">
        <div class="v2-benefit-icon">💳</div>
        <h3>Thanh toán linh hoạt</h3>
        <p>Ví điện tử tích hợp, theo dõi số buổi học còn lại và thanh toán trực tuyến chỉ trong vài giây — không cần đến tận nơi.</p>
      </div>
    </div>
  </section>

  <!-- ══ SECTION: QUY TRÌNH 3 BƯỚC ════════════════════════════════════════ -->
  <section class="v2-section v2-section-alt">
    <div class="v2-section-tag">Đơn giản & Nhanh chóng</div>
    <h2 class="v2-section-heading">Bắt đầu <span class="v2-accent">chỉ với 3 bước</span></h2>

    <div class="v2-steps">
      <div class="v2-step">
        <div class="v2-step-num">01</div>
        <div class="v2-step-connector"></div>
        <div class="v2-step-content">
          <h3>Đăng ký & Đánh giá năng lực</h3>
          <p>Điền form đăng ký. Đội ngũ tuyển sinh sẽ liên hệ trong vòng 2 giờ để sắp xếp buổi kiểm tra năng lực miễn phí, giúp xác định chính xác trình độ hiện tại của học viên.</p>
        </div>
      </div>
      <div class="v2-step">
        <div class="v2-step-num">02</div>
        <div class="v2-step-connector"></div>
        <div class="v2-step-content">
          <h3>Nhận lộ trình & Học thử miễn phí</h3>
          <p>Chuyên gia thiết kế lộ trình học tập cá nhân hóa. Học viên được trải nghiệm 1 buổi học thử thực tế hoàn toàn miễn phí để cảm nhận phương pháp giảng dạy.</p>
        </div>
      </div>
      <div class="v2-step">
        <div class="v2-step-num">03</div>
        <div class="v2-step-connector v2-step-connector-last"></div>
        <div class="v2-step-content">
          <h3>Ghi danh & Theo dõi tiến độ</h3>
          <p>Sau khi ưng ý, phụ huynh hoàn tất thủ tục ghi danh trực tuyến. Ngay lập tức có thể truy cập hệ thống để theo dõi từng buổi học, điểm số và tương tác với giáo viên.</p>
        </div>
      </div>
    </div>
  </section>

  <!-- ══ SECTION: TECH SHOWCASE ════════════════════════════════════════════ -->
  <section class="v2-section">
    <div class="v2-section-tag">Nền tảng công nghệ</div>
    <h2 class="v2-section-heading">Ứng dụng quản lý học tập<br/><span class="v2-accent">thế hệ mới</span></h2>

    <!-- Feature 1: Học bạ -->
    <div class="v2-feature-row">
      <div class="v2-feature-img-wrap">
        <div class="v2-feature-img-glow v2-glow-teal"></div>
        <img src="${SCREENSHOTS.reportCard}" alt="Học bạ điện tử" class="v2-feature-img" loading="lazy"/>
      </div>
      <div class="v2-feature-text">
        <div class="v2-feature-num">01</div>
        <h3 class="v2-feature-heading">Học bạ điện tử thông minh</h3>
        <p>Không còn lo lắng về kết quả học tập của con. Hệ thống cập nhật điểm số, nhận xét của giáo viên ngay sau mỗi bài kiểm tra. Biểu đồ trực quan cho thấy rõ xu hướng tiến bộ theo từng tuần, từng tháng.</p>
        <ul class="v2-feature-list">
          <li>Cập nhật điểm số thời gian thực</li>
          <li>Nhận xét chi tiết từng môn học</li>
          <li>Biểu đồ tiến bộ trực quan</li>
          <li>So sánh với mục tiêu đề ra</li>
        </ul>
      </div>
    </div>

    <!-- Feature 2: Giáo viên -->
    <div class="v2-feature-row v2-feature-row-reverse">
      <div class="v2-feature-img-wrap">
        <div class="v2-feature-img-glow v2-glow-indigo"></div>
        <img src="${SCREENSHOTS.teachers}" alt="Đội ngũ giáo viên" class="v2-feature-img" loading="lazy"/>
      </div>
      <div class="v2-feature-text">
        <div class="v2-feature-num">02</div>
        <h3 class="v2-feature-heading">Đội ngũ chuyên môn minh bạch</h3>
        <p>Phụ huynh hoàn toàn biết rõ ai đang giảng dạy con mình. Hồ sơ giáo viên bao gồm bằng cấp, kinh nghiệm, chuyên môn và đánh giá từ phụ huynh khác — tất cả hiển thị công khai.</p>
        <ul class="v2-feature-list">
          <li>Hồ sơ chuyên môn chi tiết</li>
          <li>Xếp hạng & đánh giá từ phụ huynh</li>
          <li>Lịch dạy và lịch nghỉ rõ ràng</li>
          <li>Liên hệ trực tiếp khi cần</li>
        </ul>
      </div>
    </div>

    <!-- Feature 3: Tài chính -->
    <div class="v2-feature-row">
      <div class="v2-feature-img-wrap">
        <div class="v2-feature-img-glow v2-glow-emerald"></div>
        <img src="${SCREENSHOTS.tuition}" alt="Quản lý tài chính" class="v2-feature-img" loading="lazy"/>
      </div>
      <div class="v2-feature-text">
        <div class="v2-feature-num">03</div>
        <h3 class="v2-feature-heading">Quản lý tài chính không lo lắng</h3>
        <p>Mọi khoản thu chi được ghi nhận minh bạch. Phụ huynh theo dõi số buổi học còn lại, lịch sử đóng học phí và thanh toán trực tuyến an toàn mà không cần đến trường.</p>
        <ul class="v2-feature-list">
          <li>Ví điện tử tích hợp an toàn</li>
          <li>Hóa đơn điện tử tức thì</li>
          <li>Cảnh báo sắp hết buổi học</li>
          <li>Lịch sử giao dịch đầy đủ</li>
        </ul>
      </div>
    </div>
  </section>

  <!-- ══ SECTION: TESTIMONIALS ════════════════════════════════════════════ -->
  <section class="v2-section v2-section-alt">
    <div class="v2-section-tag">Phụ huynh nói gì</div>
    <h2 class="v2-section-heading">Những con người thật,<br/><span class="v2-accent">kết quả thật</span></h2>

    <div class="v2-testimonial-grid">
      <div class="v2-testimonial">
        <div class="v2-testimonial-stars">★★★★★</div>
        <blockquote>"Con tôi từ một học sinh yếu môn Toán đã đạt điểm 9+ sau 3 tháng học. Điều tôi ấn tượng nhất là hệ thống báo cáo — tôi biết chính xác con học gì, khó chỗ nào và tiến bộ ra sao từng ngày."</blockquote>
        <div class="v2-testimonial-author">
          <div class="v2-testimonial-avatar v2-avatar-1">NM</div>
          <div>
            <strong>Nguyễn Thị Minh</strong>
            <span>Phụ huynh học viên lớp 8</span>
          </div>
        </div>
      </div>

      <div class="v2-testimonial">
        <div class="v2-testimonial-stars">★★★★★</div>
        <blockquote>"Tôi đã thử nhiều trung tâm nhưng không nơi nào minh bạch về học phí như ở đây. Tôi biết còn bao nhiêu buổi, đóng tiền qua app, nhận hóa đơn ngay — không cần hỏi han gì thêm."</blockquote>
        <div class="v2-testimonial-author">
          <div class="v2-testimonial-avatar v2-avatar-2">TH</div>
          <div>
            <strong>Trần Văn Hoàng</strong>
            <span>Phụ huynh học viên lớp 6</span>
          </div>
        </div>
      </div>

      <div class="v2-testimonial">
        <div class="v2-testimonial-stars">★★★★★</div>
        <blockquote>"Giáo viên rất tận tâm, luôn nhận xét chi tiết sau buổi học. Quan trọng nhất là con tôi thích học hơn hẳn, không còn áp lực và sợ hãi như trước nữa. Cảm ơn đội ngũ rất nhiều!"</blockquote>
        <div class="v2-testimonial-author">
          <div class="v2-testimonial-avatar v2-avatar-3">LP</div>
          <div>
            <strong>Lê Thị Phương</strong>
            <span>Phụ huynh học viên lớp 10</span>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- ══ SECTION: FAQ ════════════════════════════════════════════════════ -->
  <section class="v2-section">
    <div class="v2-section-tag">Câu hỏi thường gặp</div>
    <h2 class="v2-section-heading"><span class="v2-accent">Giải đáp</span> thắc mắc</h2>

    <div class="v2-faq">
      <details class="v2-faq-item">
        <summary class="v2-faq-question">Học phí được tính như thế nào? Có ưu đãi không?</summary>
        <div class="v2-faq-answer">
          <p>Học phí được tính theo số buổi học thực tế, không áp dụng hình thức đóng tháng cứng nhắc. Học viên đăng ký gói càng nhiều buổi thì đơn giá càng ưu đãi. Ngoài ra, học sinh đăng ký mới trong tháng này được giảm 15% học phí tháng đầu tiên.</p>
        </div>
      </details>
      <details class="v2-faq-item">
        <summary class="v2-faq-question">Giáo viên có thể dạy online không?</summary>
        <div class="v2-faq-answer">
          <p>Có. Chúng tôi hỗ trợ cả hình thức học trực tiếp tại cơ sở và học online qua nền tảng video tích hợp. Lịch học và ghi chép bài học đều được đồng bộ tự động lên hệ thống quản lý.</p>
        </div>
      </details>
      <details class="v2-faq-item">
        <summary class="v2-faq-question">Buổi học thử có mất phí không?</summary>
        <div class="v2-faq-answer">
          <p>Hoàn toàn miễn phí. Sau khi đăng ký, đội ngũ sẽ sắp xếp 1 buổi đánh giá năng lực và 1 buổi học thử với giáo viên phù hợp nhất — tất cả đều không tốn bất kỳ chi phí nào.</p>
        </div>
      </details>
      <details class="v2-faq-item">
        <summary class="v2-faq-question">Nếu không hài lòng với giáo viên thì có được đổi không?</summary>
        <div class="v2-faq-answer">
          <p>Có. Phụ huynh hoàn toàn có quyền yêu cầu đổi giáo viên bất kỳ lúc nào mà không phát sinh thêm chi phí. Sự phù hợp giữa giáo viên và học sinh là ưu tiên hàng đầu của chúng tôi.</p>
        </div>
      </details>
      <details class="v2-faq-item">
        <summary class="v2-faq-question">Dữ liệu của con tôi có được bảo mật không?</summary>
        <div class="v2-faq-answer">
          <p>Tất cả dữ liệu học sinh và phụ huynh được mã hóa toàn bộ và lưu trữ trên hệ thống bảo mật chuẩn quốc tế. Chúng tôi không chia sẻ thông tin với bên thứ ba dưới bất kỳ hình thức nào.</p>
        </div>
      </details>
    </div>
  </section>

  <!-- ══ CTA CUỐI MẠNH ════════════════════════════════════════════════════ -->
  <section class="v2-cta-final">
    <div class="v2-cta-glow"></div>
    <div class="v2-cta-content">
      <div class="v2-cta-urgency">⏳ Chỉ còn vài suất học thử miễn phí trong tháng này</div>
      <h2 class="v2-cta-heading">Đầu tư đúng đắn nhất cho tương lai của con</h2>
      <p class="v2-cta-sub">Hàng nghìn học sinh đã thay đổi kết quả học tập. Con bạn xứng đáng được trải nghiệm điều đó.</p>
      <div class="v2-cta-contact">
        <a href="tel:${HOTLINE}" class="v2-cta-phone">
          <span class="v2-cta-phone-icon">📞</span>
          <div>
            <span class="v2-cta-phone-label">Gọi ngay để tư vấn miễn phí</span>
            <strong>${HOTLINE_DISPLAY}</strong>
          </div>
        </a>
        <span class="v2-cta-or">hoặc</span>
        <div class="v2-cta-note">Điền form đăng ký bên cạnh — Phản hồi trong vòng 2 giờ làm việc</div>
      </div>
    </div>
  </section>

</div>
`.trim();
}

/* ─── CSS ─────────────────────────────────────────────────────────────────── */
function buildCustomHeadHtml() {
  return `
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap" rel="stylesheet">
<style id="lp-tuyen-sinh-v2-styles">

/* ─── RESET & BASE ─────────────────────────────────────────────────── */
.v2-page {
  font-family: 'Be Vietnam Pro', 'Inter', system-ui, -apple-system, sans-serif;
  color: #1e293b;
  display: flex;
  flex-direction: column;
  gap: 0;
}

.v2-page *, .v2-page *::before, .v2-page *::after {
  box-sizing: border-box;
}

/* ─── TRUST BAR ────────────────────────────────────────────────────── */
.v2-trust-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 0;
  background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%);
  border-radius: 20px;
  padding: 24px 32px;
  margin-bottom: 32px;
}

.v2-trust-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 0 28px;
  flex: 1;
  min-width: 120px;
}

.v2-trust-num {
  font-size: 2.2rem;
  font-weight: 900;
  color: #ffffff;
  line-height: 1;
  letter-spacing: -0.03em;
}

.v2-trust-plus, .v2-trust-pct {
  font-size: 1.4rem;
  color: #38bdf8;
}

.v2-trust-label {
  font-size: 0.8rem;
  color: #94a3b8;
  text-align: center;
  font-weight: 500;
  letter-spacing: 0.02em;
}

.v2-trust-divider {
  width: 1px;
  height: 48px;
  background: rgba(255,255,255,0.1);
  flex-shrink: 0;
}

/* ─── HERO VISUAL ─────────────────────────────────────────────────── */
.v2-hero-visual {
  position: relative;
  margin-bottom: 48px;
  border-radius: 24px;
  overflow: hidden;
}

.v2-hero-img-wrap {
  position: relative;
  height: 420px;
  overflow: hidden;
  border-radius: 24px;
}

.v2-hero-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transform: scale(1.02);
  transition: transform 8s ease;
}

.v2-hero-img-wrap:hover .v2-hero-img {
  transform: scale(1.06);
}

.v2-hero-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    to bottom,
    rgba(15, 23, 42, 0.1) 0%,
    rgba(15, 23, 42, 0.5) 100%
  );
}

.v2-hero-badge-group {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  margin-top: 16px;
}

.v2-hero-badge {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #f0f9ff;
  border: 1px solid #bae6fd;
  border-radius: 100px;
  padding: 8px 16px;
  font-size: 0.875rem;
  font-weight: 600;
  color: #0369a1;
  white-space: nowrap;
}

.v2-badge-icon {
  font-size: 1rem;
}

/* ─── SECTIONS ────────────────────────────────────────────────────── */
.v2-section {
  padding: 56px 0;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.v2-section-alt {
  background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%);
  border-radius: 28px;
  padding: 48px 40px;
  margin: 0 -8px;
}

.v2-section-tag {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  color: #6366f1;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  width: fit-content;
}

.v2-section-tag::before {
  content: '';
  display: block;
  width: 28px;
  height: 1.5px;
  background: currentColor;
  flex-shrink: 0;
  border-radius: 2px;
}

.v2-section-heading {
  font-size: 2rem;
  font-weight: 700;
  color: #0f172a;
  line-height: 1.3;
  letter-spacing: -0.025em;
  margin: 0;
}

.v2-accent {
  background: linear-gradient(135deg, #4f46e5 0%, #0d9488 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.v2-section-sub {
  font-size: 1.05rem;
  color: #64748b;
  line-height: 1.7;
  max-width: 600px;
  margin: 0;
}

/* ─── BENEFIT CARDS ──────────────────────────────────────────────── */
.v2-benefit-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
  margin-top: 16px;
}

.v2-benefit-card {
  background: #ffffff;
  border-radius: 20px;
  padding: 28px 24px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  border: 1px solid rgba(15, 23, 42, 0.06);
  box-shadow: 0 4px 16px rgba(15, 23, 42, 0.05);
  transition: transform 0.3s ease, box-shadow 0.3s ease;
  position: relative;
  overflow: hidden;
}

.v2-benefit-card::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 3px;
  border-radius: 20px 20px 0 0;
}

.v2-card-teal::before    { background: linear-gradient(90deg, #0d9488, #06b6d4); }
.v2-card-indigo::before  { background: linear-gradient(90deg, #4f46e5, #7c3aed); }
.v2-card-violet::before  { background: linear-gradient(90deg, #7c3aed, #a855f7); }
.v2-card-emerald::before { background: linear-gradient(90deg, #059669, #10b981); }
.v2-card-amber::before   { background: linear-gradient(90deg, #d97706, #f59e0b); }
.v2-card-rose::before    { background: linear-gradient(90deg, #e11d48, #f43f5e); }

.v2-benefit-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 32px rgba(15, 23, 42, 0.1);
}

.v2-benefit-icon {
  font-size: 2rem;
  line-height: 1;
}

.v2-benefit-card h3 {
  font-size: 1.05rem;
  font-weight: 800;
  color: #0f172a;
  margin: 0;
  line-height: 1.3;
}

.v2-benefit-card p {
  font-size: 0.9rem;
  color: #64748b;
  line-height: 1.65;
  margin: 0;
}

/* ─── STEPS ─────────────────────────────────────────────────────── */
.v2-steps {
  display: flex;
  flex-direction: column;
  gap: 0;
  margin-top: 16px;
}

.v2-step {
  display: grid;
  grid-template-columns: 64px 24px 1fr;
  gap: 0 20px;
  align-items: start;
  padding-bottom: 40px;
}

.v2-step-num {
  font-size: 2rem;
  font-weight: 900;
  color: #4f46e5;
  line-height: 1;
  text-align: right;
  padding-top: 2px;
  letter-spacing: -0.04em;
}

.v2-step-connector {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 8px;
}

.v2-step-connector::before {
  content: '';
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #4f46e5;
  flex-shrink: 0;
}

.v2-step-connector::after {
  content: '';
  width: 2px;
  flex: 1;
  background: linear-gradient(180deg, #4f46e5 0%, #e2e8f0 100%);
  margin-top: 6px;
  min-height: 60px;
}

.v2-step-connector-last::after {
  display: none;
}

.v2-step-content {
  padding-top: 0;
}

.v2-step-content h3 {
  font-size: 1.15rem;
  font-weight: 800;
  color: #0f172a;
  margin: 0 0 8px 0;
  line-height: 1.3;
}

.v2-step-content p {
  font-size: 0.95rem;
  color: #64748b;
  line-height: 1.7;
  margin: 0;
}

/* ─── FEATURE ROWS ────────────────────────────────────────────────── */
.v2-feature-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 48px;
  align-items: center;
  padding: 48px 0;
  border-bottom: 1px solid #f1f5f9;
}

.v2-feature-row:last-of-type {
  border-bottom: none;
}

.v2-feature-row-reverse {
  direction: rtl;
}

.v2-feature-row-reverse > * {
  direction: ltr;
}

.v2-feature-img-wrap {
  position: relative;
}

.v2-feature-img-glow {
  position: absolute;
  inset: -20px;
  border-radius: 28px;
  filter: blur(40px);
  opacity: 0.25;
  z-index: 0;
}

.v2-glow-teal    { background: #0d9488; }
.v2-glow-indigo  { background: #4f46e5; }
.v2-glow-emerald { background: #059669; }

.v2-feature-img {
  display: block;
  width: 100%;
  height: auto;
  border-radius: 20px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  box-shadow: 0 20px 50px rgba(15, 23, 42, 0.1);
  position: relative;
  z-index: 1;
  transition: transform 0.4s ease, box-shadow 0.4s ease;
}

.v2-feature-img:hover {
  transform: translateY(-6px) scale(1.01);
  box-shadow: 0 32px 64px rgba(15, 23, 42, 0.14);
}

.v2-feature-text {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.v2-feature-num {
  font-size: 0.75rem;
  font-weight: 900;
  letter-spacing: 0.12em;
  color: #94a3b8;
  text-transform: uppercase;
}

.v2-feature-heading {
  font-size: 1.5rem;
  font-weight: 700;
  color: #0f172a;
  line-height: 1.3;
  letter-spacing: -0.02em;
  margin: 0;
}

.v2-feature-text p {
  font-size: 0.975rem;
  color: #64748b;
  line-height: 1.75;
  margin: 0;
}

.v2-feature-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.v2-feature-list li {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 0.9rem;
  color: #374151;
  font-weight: 500;
}

.v2-feature-list li::before {
  content: '✓';
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  background: #dcfce7;
  color: #16a34a;
  border-radius: 50%;
  font-size: 0.7rem;
  font-weight: 900;
  flex-shrink: 0;
}

/* ─── TESTIMONIALS ─────────────────────────────────────────────── */
.v2-testimonial-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
  margin-top: 16px;
}

.v2-testimonial {
  background: #ffffff;
  border-radius: 20px;
  padding: 28px 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  border: 1px solid rgba(15, 23, 42, 0.06);
  box-shadow: 0 4px 16px rgba(15, 23, 42, 0.05);
  position: relative;
}

.v2-testimonial::before {
  content: '"';
  position: absolute;
  top: 16px;
  right: 20px;
  font-size: 5rem;
  color: #e2e8f0;
  font-family: Georgia, serif;
  line-height: 1;
  font-weight: 900;
}

.v2-testimonial-stars {
  color: #f59e0b;
  font-size: 0.875rem;
  letter-spacing: 2px;
}

.v2-testimonial blockquote {
  margin: 0;
  font-size: 0.95rem;
  color: #334155;
  line-height: 1.75;
  font-style: italic;
  position: relative;
  z-index: 1;
}

.v2-testimonial-author {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: auto;
  padding-top: 16px;
  border-top: 1px solid #f1f5f9;
}

.v2-testimonial-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.8rem;
  font-weight: 800;
  color: #ffffff;
  flex-shrink: 0;
}

.v2-avatar-1 { background: linear-gradient(135deg, #0d9488, #06b6d4); }
.v2-avatar-2 { background: linear-gradient(135deg, #4f46e5, #7c3aed); }
.v2-avatar-3 { background: linear-gradient(135deg, #e11d48, #f43f5e); }

.v2-testimonial-author strong {
  display: block;
  font-size: 0.875rem;
  color: #0f172a;
  font-weight: 700;
}

.v2-testimonial-author span {
  font-size: 0.8rem;
  color: #94a3b8;
}

/* ─── FAQ ──────────────────────────────────────────────────────── */
.v2-faq {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 16px;
}

.v2-faq-item {
  background: #ffffff;
  border-radius: 16px;
  border: 1px solid #e2e8f0;
  overflow: hidden;
  transition: box-shadow 0.2s;
}

.v2-faq-item[open] {
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.08);
  border-color: #c7d2fe;
}

.v2-faq-question {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  font-size: 0.975rem;
  font-weight: 700;
  color: #0f172a;
  cursor: pointer;
  list-style: none;
  gap: 16px;
  user-select: none;
}

.v2-faq-question::-webkit-details-marker { display: none; }

.v2-faq-question::after {
  content: '+';
  font-size: 1.5rem;
  font-weight: 300;
  color: #4f46e5;
  flex-shrink: 0;
  transition: transform 0.2s;
  line-height: 1;
}

.v2-faq-item[open] .v2-faq-question::after {
  transform: rotate(45deg);
}

.v2-faq-answer {
  padding: 0 24px 20px 24px;
  border-top: 1px solid #f1f5f9;
}

.v2-faq-answer p {
  margin: 16px 0 0 0;
  font-size: 0.95rem;
  color: #475569;
  line-height: 1.75;
}

/* ─── CTA FINAL ─────────────────────────────────────────────────── */
.v2-cta-final {
  background: linear-gradient(135deg, #1e1b4b 0%, #312e81 40%, #1e3a5f 100%);
  border-radius: 28px;
  padding: 56px 48px;
  margin-top: 40px;
  position: relative;
  overflow: hidden;
}

.v2-cta-glow {
  position: absolute;
  top: -80px;
  right: -80px;
  width: 300px;
  height: 300px;
  background: radial-gradient(circle, rgba(99, 102, 241, 0.4) 0%, transparent 70%);
  pointer-events: none;
}

.v2-cta-content {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 20px;
  max-width: 640px;
}

.v2-cta-urgency {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: rgba(251, 191, 36, 0.15);
  border: 1px solid rgba(251, 191, 36, 0.4);
  color: #fbbf24;
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  padding: 6px 14px;
  border-radius: 100px;
  width: fit-content;
}

.v2-cta-heading {
  font-size: 2rem;
  font-weight: 700;
  color: #ffffff;
  line-height: 1.3;
  letter-spacing: -0.025em;
  margin: 0;
}

.v2-cta-sub {
  font-size: 1rem;
  color: #c7d2fe;
  line-height: 1.7;
  margin: 0;
}

.v2-cta-contact {
  display: flex;
  align-items: center;
  gap: 24px;
  flex-wrap: wrap;
  margin-top: 8px;
}

.v2-cta-phone {
  display: flex;
  align-items: center;
  gap: 14px;
  background: rgba(255,255,255,0.08);
  border: 1px solid rgba(255,255,255,0.15);
  border-radius: 16px;
  padding: 14px 20px;
  text-decoration: none;
  color: #ffffff;
  transition: background 0.2s, border-color 0.2s;
  backdrop-filter: blur(8px);
}

.v2-cta-phone:hover {
  background: rgba(255,255,255,0.14);
  border-color: rgba(255,255,255,0.3);
}

.v2-cta-phone-icon {
  font-size: 1.4rem;
}

.v2-cta-phone-label {
  display: block;
  font-size: 0.7rem;
  color: #a5b4fc;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  margin-bottom: 2px;
}

.v2-cta-phone strong {
  font-size: 1.4rem;
  font-weight: 900;
  letter-spacing: -0.02em;
}

.v2-cta-or {
  color: #94a3b8;
  font-size: 0.875rem;
}

.v2-cta-note {
  font-size: 0.9rem;
  color: #c7d2fe;
  line-height: 1.6;
  max-width: 220px;
}

/* ─── LARGE DESKTOP (≥ 1280px) ──────────────────────────────────── */
@media (min-width: 1280px) {
  .v2-section-heading {
    font-size: 2.4rem;
  }
  .v2-hero-img-wrap {
    height: 480px;
  }
  .v2-trust-num {
    font-size: 2.6rem;
  }
  .v2-trust-item {
    padding: 0 36px;
  }
  .v2-feature-row {
    gap: 64px;
  }
  .v2-benefit-grid {
    gap: 24px;
  }
  .v2-benefit-card {
    padding: 32px 28px;
  }
  .v2-cta-heading {
    font-size: 2.4rem;
  }
  .v2-feature-heading {
    font-size: 1.65rem;
  }
  .v2-section {
    padding: 64px 0;
  }
}

/* ─── XL DESKTOP (≥ 1440px) ─────────────────────────────────────── */
@media (min-width: 1440px) {
  .v2-section-heading {
    font-size: 2.8rem;
  }
  .v2-trust-num {
    font-size: 3rem;
  }
  .v2-trust-label {
    font-size: 0.9rem;
  }
  .v2-hero-img-wrap {
    height: 540px;
  }
  .v2-feature-row {
    gap: 80px;
  }
  .v2-benefit-card {
    padding: 36px 32px;
  }
  .v2-benefit-icon {
    font-size: 2.4rem;
  }
  .v2-benefit-card h3 {
    font-size: 1.15rem;
  }
  .v2-benefit-card p {
    font-size: 0.95rem;
  }
  .v2-cta-heading {
    font-size: 2.8rem;
  }
  .v2-cta-final {
    padding: 72px 64px;
  }
  .v2-section-alt {
    padding: 64px 56px;
  }
  .v2-testimonial {
    padding: 36px 32px;
  }
  .v2-feature-heading {
    font-size: 1.8rem;
  }
  .v2-section {
    padding: 72px 0;
  }
  .v2-feature-text p {
    font-size: 1.05rem;
  }
  .v2-benefit-grid {
    gap: 28px;
  }
}

/* ─── TABLET (≤ 1024px) ──────────────────────────────────────────── */
@media (max-width: 1024px) {
  .v2-benefit-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .v2-feature-row,
  .v2-feature-row-reverse {
    grid-template-columns: 1fr;
    direction: ltr;
    gap: 28px;
  }
}

/* ─── TABLET NARROW (≤ 900px) ────────────────────────────────────── */
@media (max-width: 900px) {
  .v2-testimonial-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

/* ─── MOBILE (≤ 768px) ───────────────────────────────────────────── */
@media (max-width: 768px) {
  /* Trust bar → lưới 2×2 */
  .v2-trust-bar {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1px;
    padding: 0;
    border-radius: 16px;
    overflow: hidden;
    background: rgba(255,255,255,0.08);
  }
  .v2-trust-item {
    padding: 20px 16px;
    background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%);
    min-width: unset;
    align-items: center;
  }
  .v2-trust-divider {
    display: none;
  }
  .v2-trust-num {
    font-size: 1.8rem;
  }
  .v2-trust-label {
    font-size: 0.75rem;
  }

  /* Hero */
  .v2-hero-img-wrap {
    height: 240px;
    border-radius: 16px;
  }
  .v2-hero-badge-group {
    overflow-x: auto;
    flex-wrap: nowrap;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
    padding-bottom: 4px;
  }
  .v2-hero-badge-group::-webkit-scrollbar { display: none; }
  .v2-hero-badge { flex-shrink: 0; }

  /* Sections */
  .v2-section {
    padding: 36px 0;
  }
  .v2-section-heading {
    font-size: 1.55rem;
  }
  .v2-section-sub {
    font-size: 0.95rem;
  }
  .v2-section-alt {
    padding: 32px 20px;
    margin: 0;
    border-radius: 20px;
  }

  /* Benefits → 1 cột, card nằm ngang */
  .v2-benefit-grid {
    grid-template-columns: 1fr;
    gap: 14px;
  }
  .v2-benefit-card {
    padding: 20px 18px;
    flex-direction: row;
    align-items: flex-start;
    gap: 16px;
  }
  .v2-benefit-card::before {
    top: 0; left: 0; bottom: 0; right: auto;
    width: 3px;
    height: auto;
    border-radius: 20px 0 0 20px;
  }
  .v2-benefit-icon {
    font-size: 1.6rem;
    flex-shrink: 0;
    margin-top: 2px;
  }

  /* Steps → bỏ grid, dùng đường kẻ trái */
  .v2-steps { gap: 0; }
  .v2-step {
    display: flex;
    flex-direction: column;
    padding: 0 0 28px 20px;
    margin-bottom: 0;
    border-left: 2px solid #4f46e5;
    gap: 6px;
  }
  .v2-step:last-child {
    border-left: 2px solid transparent;
  }
  .v2-step-num {
    font-size: 0.65rem;
    font-weight: 900;
    letter-spacing: 0.12em;
    color: #4f46e5;
    text-transform: uppercase;
    text-align: left;
  }
  .v2-step-connector { display: none; }
  .v2-step-content { padding: 0; }
  .v2-step-content h3 { font-size: 1rem; }

  /* Feature rows */
  .v2-feature-row { padding: 28px 0; gap: 20px; }
  .v2-feature-img { border-radius: 14px; }
  .v2-feature-heading { font-size: 1.2rem; }

  /* Testimonials → cuộn ngang snap */
  .v2-testimonial-grid {
    display: flex;
    overflow-x: auto;
    scroll-snap-type: x mandatory;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
    gap: 16px;
    padding-bottom: 12px;
    margin: 0 -4px;
    padding-left: 4px;
    padding-right: 4px;
  }
  .v2-testimonial-grid::-webkit-scrollbar { display: none; }
  .v2-testimonial {
    scroll-snap-align: start;
    flex: 0 0 85vw;
    max-width: 340px;
  }

  /* FAQ */
  .v2-faq-question {
    padding: 18px 20px;
    min-height: 56px;
    font-size: 0.925rem;
  }
  .v2-faq-answer { padding: 0 20px 18px 20px; }

  /* CTA */
  .v2-cta-final {
    padding: 36px 24px;
    border-radius: 20px;
  }
  .v2-cta-heading { font-size: 1.5rem; }
  .v2-cta-content { max-width: 100%; }
  .v2-cta-contact {
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;
  }
  .v2-cta-note { max-width: 100%; font-size: 0.875rem; }
  .v2-cta-or { display: none; }
}

/* ─── SMALL MOBILE (≤ 480px) ─────────────────────────────────────── */
@media (max-width: 480px) {
  .v2-section-heading { font-size: 1.35rem; }
  .v2-hero-img-wrap { height: 200px; }
  .v2-benefit-card { padding: 16px 14px; gap: 12px; }
  .v2-benefit-icon { font-size: 1.4rem; }
  .v2-testimonial { flex: 0 0 90vw; max-width: 100%; }
  .v2-cta-phone strong { font-size: 1.2rem; }
  .v2-cta-heading { font-size: 1.3rem; }
  .v2-cta-final { padding: 28px 18px; }
  .v2-section-alt { padding: 28px 16px; }
  .v2-faq-question { font-size: 0.875rem; }
}

</style>
`.trim();
}

/* ─── MAIN ────────────────────────────────────────────────────────────────── */
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
    name: 'Landing Page Tuyển Sinh v2 (Redesign)',
    slug: LANDING_SLUG,
    status: 'ACTIVE',
    heroTitle: 'Giáo dục đẳng cấp. Kết quả vượt kỳ vọng.',
    heroSubtitle:
      'Lộ trình học tập được thiết kế riêng cho từng học sinh — minh bạch tuyệt đối, ' +
      'giáo viên kiểm định và công nghệ AI đồng hành mỗi bước tiến.',
    formTitle: 'Nhận lộ trình & Học thử miễn phí',
    formDescription:
      'Đăng ký ngay để được đánh giá năng lực toàn diện và trải nghiệm 1 buổi học thử thực tế — hoàn toàn miễn phí, không ràng buộc.',
    submitButtonText: 'Đăng ký học thử miễn phí →',
    privacyNotice:
      'Thông tin của quý khách được mã hóa và bảo vệ tuyệt đối. Chúng tôi không chia sẻ dữ liệu với bên thứ ba.',
    successTitle: '🎉 Đăng ký thành công!',
    successMessage:
      'Cảm ơn quý phụ huynh đã tin tưởng. Chuyên viên tuyển sinh sẽ liên hệ trong vòng 2 giờ làm việc để sắp xếp lịch đánh giá năng lực và buổi học thử cho học viên.',
    bodyHtml: buildBodyHtml(),
    autoCreateLead: true,
    customHeadHtml: buildCustomHeadHtml(),
    customBodyHtml: undefined,
    notes: 'v2 Redesign: Trust bar, hero visual, 6-card benefit grid, 3-step process, alternating feature rows with glow, testimonials, CSS-only FAQ, gradient CTA.',
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
        version: 'v2',
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
