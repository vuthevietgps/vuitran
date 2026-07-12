import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

interface DailyTrack {
  phase: string;
  tone: 'dawn' | 'prep' | 'live' | 'close';
  icon: string;
  title: string;
  items: string[];
}

interface ScenarioCard {
  index: number;
  tag: string;
  title: string;
  summary: string;
  steps: string[];
  route: string;
}

interface PlaybookStage {
  num: string;
  title: string;
  description: string;
  steps: string[];
  signal: string;
  route: string;
}

interface QuickLink {
  label: string;
  route: string;
  note: string;
}

interface VideoCard {
  title: string;
  description: string;
  src: string;
  poster: string;
}

interface GalleryItem {
  title: string;
  description: string;
  image: string;
  route?: string;
}

@Component({
  selector: 'app-teacher-guide-landing',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="page-shell">

      <!-- ═══════════════════════════════ HERO ═══════════════════════════════ -->
      <section class="hero">
        <div class="hero-copy">
          <span class="eyebrow">Cổng thông tin giáo viên</span>
          <h1>Hướng dẫn vận hành<br><em>giáo viên</em></h1>
          <p class="hero-text">
            Tất cả thông tin, quy trình làm việc, kịch bản quan trọng, video thao tác
            và ảnh minh họa dành cho giáo viên được gom tại một nơi duy nhất.
            Dùng trang này khi onboarding, ôn lại nghiệp vụ hoặc khi cần xử lý phát sinh.
          </p>

          <div class="hero-badges">
            <span class="badge badge-teal">Vai trò: Giáo viên</span>
            <span class="badge badge-amber">Tài liệu vận hành chính thức</span>
          </div>

          <div class="hero-actions">
            <a class="btn btn-primary" routerLink="/app/dashboard">Mở Dashboard</a>
            <a class="btn btn-secondary" routerLink="/app/attendance">Điểm danh</a>
            <a class="btn btn-secondary" routerLink="/app/teaching-report">Báo cáo giảng dạy</a>
            <a class="btn btn-ghost" routerLink="/app/handbook">Cẩm nang vai trò</a>
          </div>

          <div class="quick-link-row">
            <a class="ql-chip" *ngFor="let link of quickLinks" [routerLink]="link.route" [title]="link.note">
              {{ link.label }}
            </a>
          </div>
        </div>

        <div class="hero-visual">
          <img [src]="heroImage" alt="Tổng quan vai trò giáo viên" loading="eager"/>
        </div>
      </section>

      <!-- ═══════════════════════════ QUY TRÌNH ════════════════════════════= -->
      <section class="section flow-section">
        <div class="section-header">
          <span class="section-kicker">Quy trình đầy đủ</span>
          <h2>Luồng làm việc chuẩn của giáo viên</h2>
          <p class="section-summary">
            Bốn giai đoạn chính trong ngày dạy và luồng xử lý phát sinh khi có rủi ro.
            Hiểu rõ luồng này để không bỏ sót bước nào gây ảnh hưởng đến lương.
          </p>
        </div>

        <div class="flow-diagram-wrap">
          <svg viewBox="0 0 1060 390" xmlns="http://www.w3.org/2000/svg"
               class="flow-svg" role="img" aria-label="Quy trình làm việc của giáo viên">
            <defs>
              <linearGradient id="g1" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#0d9488"/>
                <stop offset="100%" stop-color="#0f766e"/>
              </linearGradient>
              <linearGradient id="g2" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#0891b2"/>
                <stop offset="100%" stop-color="#0e7490"/>
              </linearGradient>
              <linearGradient id="g3" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#7c3aed"/>
                <stop offset="100%" stop-color="#6d28d9"/>
              </linearGradient>
              <linearGradient id="g4" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#d97706"/>
                <stop offset="100%" stop-color="#b45309"/>
              </linearGradient>
              <marker id="arr" markerWidth="9" markerHeight="7" refX="8" refY="3.5" orient="auto">
                <polygon points="0 0, 9 3.5, 0 7" fill="#94a3b8"/>
              </marker>
              <marker id="arr-e" markerWidth="9" markerHeight="7" refX="8" refY="3.5" orient="auto">
                <polygon points="0 0, 9 3.5, 0 7" fill="#dc2626"/>
              </marker>
              <marker id="arr-g" markerWidth="9" markerHeight="7" refX="8" refY="3.5" orient="auto">
                <polygon points="0 0, 9 3.5, 0 7" fill="#16a34a"/>
              </marker>
            </defs>

            <!-- ── Phase 1: KHỞI ĐỘNG ── -->
            <g transform="translate(20,20)">
              <rect width="215" height="215" rx="18" fill="url(#g1)"/>
              <circle cx="28" cy="28" r="18" fill="rgba(255,255,255,.18)"/>
              <text x="28" y="34" text-anchor="middle" fill="white"
                    font-size="15" font-weight="800" font-family="sans-serif">1</text>
              <text x="118" y="30" text-anchor="middle" fill="rgba(255,255,255,.85)"
                    font-size="10" font-weight="800" font-family="sans-serif"
                    letter-spacing="1.8">KHỞI ĐỘNG</text>
              <text x="16" y="65"  fill="white" font-size="13" font-weight="700" font-family="sans-serif">Đăng nhập hệ thống</text>
              <text x="16" y="82"  fill="rgba(255,255,255,.7)" font-size="11" font-family="sans-serif">Form login → cookie phiên làm việc</text>
              <line x1="16" y1="94" x2="199" y2="94" stroke="rgba(255,255,255,.2)" stroke-width="1"/>
              <text x="16" y="116" fill="white" font-size="13" font-weight="700" font-family="sans-serif">Kiểm tra Dashboard</text>
              <text x="16" y="133" fill="rgba(255,255,255,.7)" font-size="11" font-family="sans-serif">Nắm buổi học, thu nhập, ticket</text>
              <line x1="16" y1="145" x2="199" y2="145" stroke="rgba(255,255,255,.2)" stroke-width="1"/>
              <text x="16" y="167" fill="white" font-size="13" font-weight="700" font-family="sans-serif">Xem lịch dạy</text>
              <text x="16" y="184" fill="rgba(255,255,255,.7)" font-size="11" font-family="sans-serif">Rà lớp, khung giờ, lớp phụ trách</text>
              <text x="16" y="207" fill="rgba(255,255,255,.5)" font-size="10" font-family="sans-serif">→ /dashboard · /teacher-calendar</text>
            </g>

            <!-- Arrow 1→2 -->
            <line x1="237" y1="127" x2="272" y2="127" stroke="#94a3b8" stroke-width="2.5" marker-end="url(#arr)"/>

            <!-- ── Phase 2: CHUẨN BỊ ── -->
            <g transform="translate(275,20)">
              <rect width="215" height="215" rx="18" fill="url(#g2)"/>
              <circle cx="28" cy="28" r="18" fill="rgba(255,255,255,.18)"/>
              <text x="28" y="34" text-anchor="middle" fill="white"
                    font-size="15" font-weight="800" font-family="sans-serif">2</text>
              <text x="118" y="30" text-anchor="middle" fill="rgba(255,255,255,.85)"
                    font-size="10" font-weight="800" font-family="sans-serif"
                    letter-spacing="1.8">CHUẨN BỊ</text>
              <text x="16" y="65"  fill="white" font-size="13" font-weight="700" font-family="sans-serif">Chuẩn bị tài liệu</text>
              <text x="16" y="82"  fill="rgba(255,255,255,.7)" font-size="11" font-family="sans-serif">Tải giáo án, xem bài tập cần dùng</text>
              <line x1="16" y1="94" x2="199" y2="94" stroke="rgba(255,255,255,.2)" stroke-width="1"/>
              <text x="16" y="116" fill="white" font-size="13" font-weight="700" font-family="sans-serif">Rà danh sách học sinh</text>
              <text x="16" y="133" fill="rgba(255,255,255,.7)" font-size="11" font-family="sans-serif">Kiểm tra lớp và số học sinh dự kiến</text>
              <line x1="16" y1="145" x2="199" y2="145" stroke="rgba(255,255,255,.2)" stroke-width="1"/>
              <text x="16" y="167" fill="white" font-size="13" font-weight="700" font-family="sans-serif">Xác nhận có mặt</text>
              <text x="16" y="184" fill="rgba(255,255,255,.7)" font-size="11" font-family="sans-serif">Hoặc tạo yêu cầu thay thế sớm</text>
              <text x="16" y="207" fill="rgba(255,255,255,.5)" font-size="10" font-family="sans-serif">→ /classes · /teaching-materials</text>
            </g>

            <!-- Arrow 2→3 -->
            <line x1="492" y1="127" x2="527" y2="127" stroke="#94a3b8" stroke-width="2.5" marker-end="url(#arr)"/>

            <!-- ── Phase 3: VẬN HÀNH ── -->
            <g transform="translate(530,20)">
              <rect width="215" height="215" rx="18" fill="url(#g3)"/>
              <circle cx="28" cy="28" r="18" fill="rgba(255,255,255,.18)"/>
              <text x="28" y="34" text-anchor="middle" fill="white"
                    font-size="15" font-weight="800" font-family="sans-serif">3</text>
              <text x="118" y="30" text-anchor="middle" fill="rgba(255,255,255,.85)"
                    font-size="10" font-weight="800" font-family="sans-serif"
                    letter-spacing="1.8">VẬN HÀNH</text>
              <text x="16" y="65"  fill="white" font-size="13" font-weight="700" font-family="sans-serif">Tạo link điểm danh</text>
              <text x="16" y="82"  fill="rgba(255,255,255,.7)" font-size="11" font-family="sans-serif">Chọn lớp + ngày → link cho học sinh</text>
              <line x1="16" y1="94" x2="199" y2="94" stroke="rgba(255,255,255,.2)" stroke-width="1"/>
              <text x="16" y="116" fill="white" font-size="13" font-weight="700" font-family="sans-serif">Học sinh self check-in</text>
              <text x="16" y="133" fill="rgba(255,255,255,.7)" font-size="11" font-family="sans-serif">Gửi link, học sinh tự điểm danh</text>
              <line x1="16" y1="145" x2="199" y2="145" stroke="rgba(255,255,255,.2)" stroke-width="1"/>
              <text x="16" y="167" fill="white" font-size="13" font-weight="700" font-family="sans-serif">Giảng dạy &amp; ghi chú</text>
              <text x="16" y="184" fill="rgba(255,255,255,.7)" font-size="11" font-family="sans-serif">Điểm danh cuối buổi nếu cần bổ sung</text>
              <text x="16" y="207" fill="rgba(255,255,255,.5)" font-size="10" font-family="sans-serif">→ /attendance</text>
            </g>

            <!-- Arrow 3→4 -->
            <line x1="747" y1="127" x2="782" y2="127" stroke="#94a3b8" stroke-width="2.5" marker-end="url(#arr)"/>

            <!-- ── Phase 4: CHỐT & LƯƠNG ── -->
            <g transform="translate(785,20)">
              <rect width="255" height="215" rx="18" fill="url(#g4)"/>
              <circle cx="28" cy="28" r="18" fill="rgba(255,255,255,.18)"/>
              <text x="28" y="34" text-anchor="middle" fill="white"
                    font-size="15" font-weight="800" font-family="sans-serif">4</text>
              <text x="148" y="30" text-anchor="middle" fill="rgba(255,255,255,.85)"
                    font-size="10" font-weight="800" font-family="sans-serif"
                    letter-spacing="1.8">CHỐT &amp; LƯƠNG</text>
              <text x="16" y="65"  fill="white" font-size="13" font-weight="700" font-family="sans-serif">Nộp báo cáo giảng dạy</text>
              <text x="16" y="82"  fill="rgba(255,255,255,.7)" font-size="11" font-family="sans-serif">Teaching report ngay sau buổi học</text>
              <line x1="16" y1="94" x2="239" y2="94" stroke="rgba(255,255,255,.2)" stroke-width="1"/>
              <text x="16" y="116" fill="white" font-size="13" font-weight="700" font-family="sans-serif">Phụ huynh xác nhận</text>
              <text x="16" y="133" fill="rgba(255,255,255,.7)" font-size="11" font-family="sans-serif">Chờ parent confirm để buổi đủ điều kiện</text>
              <line x1="16" y1="145" x2="239" y2="145" stroke="rgba(255,255,255,.2)" stroke-width="1"/>
              <text x="16" y="167" fill="white" font-size="13" font-weight="700" font-family="sans-serif">Đối chiếu Payroll preview</text>
              <text x="16" y="184" fill="rgba(255,255,255,.7)" font-size="11" font-family="sans-serif">Xem buổi đủ điều kiện tính lương</text>
              <text x="16" y="207" fill="rgba(255,255,255,.5)" font-size="10" font-family="sans-serif">→ /teaching-report · /payroll</text>
            </g>

            <!-- ── Divider + Exception label ── -->
            <line x1="20" y1="262" x2="1040" y2="262" stroke="#e2e8f0" stroke-width="1.5" stroke-dasharray="8,5"/>
            <text x="20" y="258" fill="#94a3b8" font-size="10" font-weight="700"
                  font-family="sans-serif" letter-spacing="1.5">LUỒNG PHÁT SINH KHI CÓ RỦI RO</text>

            <!-- Vertical trigger from Phase 2 bottom -->
            <line x1="382" y1="235" x2="382" y2="278" stroke="#dc2626" stroke-width="2"
                  stroke-dasharray="4,3" marker-end="url(#arr-e)"/>

            <!-- ── Exc Box 1: Phát sinh ── -->
            <g transform="translate(275,280)">
              <rect width="215" height="90" rx="14" fill="#fef2f2" stroke="#fca5a5" stroke-width="1.5"/>
              <rect width="215" height="30" rx="14" fill="#dc2626"/>
              <rect x="0" y="16" width="215" height="14" fill="#dc2626"/>
              <text x="108" y="20" text-anchor="middle" fill="white"
                    font-size="10" font-weight="800" font-family="sans-serif"
                    letter-spacing="1.5">PHÁT SINH RỦI RO</text>
              <text x="14" y="52" fill="#991b1b" font-size="12" font-weight="700" font-family="sans-serif">Không thể dạy đúng lịch</text>
              <text x="14" y="70" fill="#dc2626" font-size="11" font-family="sans-serif">Vắng mặt, sự cố, cần thay thế</text>
            </g>

            <!-- Arrow Exc 1→2 -->
            <line x1="492" y1="325" x2="527" y2="325" stroke="#dc2626" stroke-width="2" marker-end="url(#arr-e)"/>

            <!-- ── Exc Box 2: Tạo yêu cầu ── -->
            <g transform="translate(530,280)">
              <rect width="215" height="90" rx="14" fill="#fff7ed" stroke="#fed7aa" stroke-width="1.5"/>
              <rect width="215" height="30" rx="14" fill="#ea580c"/>
              <rect x="0" y="16" width="215" height="14" fill="#ea580c"/>
              <text x="108" y="20" text-anchor="middle" fill="white"
                    font-size="10" font-weight="800" font-family="sans-serif"
                    letter-spacing="1.5">TẠO YÊU CẦU</text>
              <text x="14" y="52" fill="#7c2d12" font-size="12" font-weight="700" font-family="sans-serif">Substitute Request hoặc Ticket</text>
              <text x="14" y="70" fill="#ea580c" font-size="11" font-family="sans-serif">Ghi rõ lớp, ngày, lý do cụ thể</text>
            </g>

            <!-- Arrow Exc 2→3 -->
            <line x1="747" y1="325" x2="782" y2="325" stroke="#16a34a" stroke-width="2" marker-end="url(#arr-g)"/>

            <!-- ── Exc Box 3: OPS xử lý ── -->
            <g transform="translate(785,280)">
              <rect width="255" height="90" rx="14" fill="#f0fdf4" stroke="#86efac" stroke-width="1.5"/>
              <rect width="255" height="30" rx="14" fill="#16a34a"/>
              <rect x="0" y="16" width="255" height="14" fill="#16a34a"/>
              <text x="128" y="20" text-anchor="middle" fill="white"
                    font-size="10" font-weight="800" font-family="sans-serif"
                    letter-spacing="1.5">OPS XỬ LÝ &amp; DUYỆT</text>
              <text x="14" y="52" fill="#14532d" font-size="12" font-weight="700" font-family="sans-serif">Vận hành sắp xếp giáo viên thay</text>
              <text x="14" y="70" fill="#16a34a" font-size="11" font-family="sans-serif">Ticket hoặc request được cập nhật</text>
            </g>
          </svg>
        </div>

        <div class="flow-legend">
          <span class="legend-dot" style="background:#0d9488"></span><span>Khởi động</span>
          <span class="legend-dot" style="background:#0891b2"></span><span>Chuẩn bị</span>
          <span class="legend-dot" style="background:#7c3aed"></span><span>Vận hành</span>
          <span class="legend-dot" style="background:#d97706"></span><span>Chốt &amp; Lương</span>
          <span class="legend-dot" style="background:#dc2626"></span><span>Phát sinh</span>
        </div>
      </section>

      <!-- ═══════════════════════════ NHỊP LÀM VIỆC ═══════════════════════════ -->
      <section class="section">
        <div class="section-header">
          <span class="section-kicker">Nhịp làm việc</span>
          <h2>Checklist theo từng thời điểm trong ngày</h2>
          <p class="section-summary">
            Gom tất cả việc cần làm vào 4 nhóm thời điểm để giáo viên không bỏ sót,
            đặc biệt khi mới onboarding hoặc khi thay người vận hành.
          </p>
        </div>

        <div class="track-grid">
          <article class="track-card" *ngFor="let track of dailyTracks" [attr.data-tone]="track.tone">
            <div class="track-head">
              <span class="track-icon">{{ track.icon }}</span>
              <div>
                <p class="track-phase">{{ track.phase }}</p>
                <h3>{{ track.title }}</h3>
              </div>
            </div>
            <ul>
              <li *ngFor="let item of track.items">{{ item }}</li>
            </ul>
          </article>
        </div>
      </section>

      <!-- ═══════════════════════════ KỊCH BẢN ═══════════════════════════════ -->
      <section class="section">
        <div class="section-header">
          <span class="section-kicker">Kịch bản trọng tâm</span>
          <h2>Bốn tình huống giáo viên phải thực hành thành thục</h2>
          <p class="section-summary">
            Mỗi kịch bản đi kèm checklist và đường dẫn trực tiếp đến màn hình tương ứng.
          </p>
        </div>

        <div class="scenario-grid">
          <article class="scenario-card" *ngFor="let sc of scenarios">
            <div class="scenario-num">{{ sc.index }}</div>
            <div class="scenario-tag">{{ sc.tag }}</div>
            <h3>{{ sc.title }}</h3>
            <p>{{ sc.summary }}</p>
            <ul>
              <li *ngFor="let step of sc.steps">{{ step }}</li>
            </ul>
            <a class="route-pill" [routerLink]="sc.route">{{ sc.route }}</a>
          </article>
        </div>
      </section>

      <!-- ═══════════════════════ PLAYBOOK STAGES ══════════════════════════ -->
      <section class="section">
        <div class="section-header">
          <span class="section-kicker">Hướng dẫn chi tiết theo giai đoạn</span>
          <h2>Đi từng bước đúng quy trình ngay từ đầu</h2>
          <p class="section-summary">
            Mỗi giai đoạn có dấu hiệu để giáo viên tự kiểm tra mình đang làm đúng hay chưa
            trước khi chuyển sang bước tiếp theo.
          </p>
        </div>

        <div class="playbook-grid">
          <article class="playbook-card" *ngFor="let stage of playbookStages">
            <div class="playbook-head">
              <span class="stage-num">{{ stage.num }}</span>
              <div>
                <h3>{{ stage.title }}</h3>
                <p class="stage-desc">{{ stage.description }}</p>
              </div>
            </div>
            <ul>
              <li *ngFor="let step of stage.steps">{{ step }}</li>
            </ul>
            <div class="signal-chip">
              <span class="signal-icon">✓</span>
              {{ stage.signal }}
            </div>
            <a class="route-pill" [routerLink]="stage.route">{{ stage.route }}</a>
          </article>
        </div>
      </section>

      <!-- ═══════════════════════ PITFALLS + FAQ ════════════════════════════ -->
      <section class="dual-section">
        <div class="dual-panel">
          <span class="section-kicker">Lỗi thường gặp</span>
          <h2>Những chỗ giáo viên hay nhầm</h2>
          <div class="pitfall-list">
            <article class="pitfall-card" *ngFor="let p of pitfalls">
              <div class="pitfall-icon">!</div>
              <div>
                <h3>{{ p.title }}</h3>
                <p>{{ p.detail }}</p>
              </div>
            </article>
          </div>
        </div>

        <div class="dual-panel">
          <span class="section-kicker">Hỏi &amp; Đáp nhanh</span>
          <h2>Giải thích các thắc mắc phổ biến</h2>
          <div class="faq-list">
            <article class="faq-card" *ngFor="let f of faq">
              <h3>{{ f.q }}</h3>
              <p>{{ f.a }}</p>
            </article>
          </div>
        </div>
      </section>

      <!-- ═════════════════════ QUICK LINKS + GUARDRAILS ═══════════════════ -->
      <section class="dual-section">
        <div class="dual-panel">
          <span class="section-kicker">Lối vào nhanh</span>
          <h2>Màn hình dùng thường xuyên</h2>
          <div class="link-grid">
            <a class="link-card" *ngFor="let link of quickLinks" [routerLink]="link.route">
              <strong>{{ link.label }}</strong>
              <p>{{ link.note }}</p>
              <code>{{ link.route }}</code>
            </a>
          </div>
        </div>

        <div class="dual-panel">
          <span class="section-kicker">Phạm vi quyền</span>
          <h2>Những điều giáo viên cần nhớ</h2>
          <ul class="guardrail-list">
            <li *ngFor="let g of guardrails">{{ g }}</li>
          </ul>
          <div class="guardrail-note">
            Nếu thấy màn hình bị chặn, đó là logic quyền đúng.
            Liên hệ OPS qua Ticket nếu cần hỗ trợ thêm.
          </div>
        </div>
      </section>

      <!-- ══════════════════════════ VIDEOS ════════════════════════════════ -->
      <section class="section">
        <div class="section-header">
          <span class="section-kicker">Video thao tác</span>
          <h2>Video đào tạo quay từ môi trường demo thực tế</h2>
        </div>

        <div class="video-grid">
          <article class="video-card" *ngFor="let v of videos">
            <video controls preload="metadata" [poster]="v.poster">
              <source [src]="v.src" type="video/webm"/>
            </video>
            <div class="video-copy">
              <h3>{{ v.title }}</h3>
              <p>{{ v.description }}</p>
              <a class="text-link" [href]="v.src" target="_blank" rel="noopener">Mở video riêng</a>
            </div>
          </article>
        </div>
      </section>

      <!-- ══════════════════════════ GALLERY ════════════════════════════════ -->
      <section class="section">
        <div class="section-header">
          <span class="section-kicker">Ảnh minh họa màn hình</span>
          <h2>Các màn hình chính của giáo viên</h2>
          <p class="section-summary">Nhấn "Mở ảnh" để phóng to hoặc "Mở màn hình" để điều hướng trực tiếp.</p>
        </div>

        <div class="gallery-grid">
          <article class="gallery-card" *ngFor="let item of gallery">
            <div class="gallery-thumb">
              <img [src]="item.image" [alt]="item.title" loading="lazy"/>
            </div>
            <div class="gallery-copy">
              <h3>{{ item.title }}</h3>
              <p>{{ item.description }}</p>
              <div class="gallery-actions">
                <a class="text-link" [href]="item.image" target="_blank" rel="noopener">Mở ảnh</a>
                <a class="text-link" *ngIf="item.route" [routerLink]="item.route">Mở màn hình</a>
              </div>
            </div>
          </article>
        </div>
      </section>

    </div>
  `,
  styles: [`
    :host {
      display: block;
      min-height: 100%;
      padding: 28px;
      background:
        radial-gradient(ellipse at top right, rgba(20, 184, 166, 0.14), transparent 30%),
        radial-gradient(ellipse at left 60%, rgba(124, 58, 237, 0.08), transparent 25%),
        linear-gradient(180deg, #f3f0ea 0%, #f7f5ee 40%, #fbfaf6 100%);
      color: #14213d;
      font-family: "Trebuchet MS", "Aptos", "Segoe UI", sans-serif;
    }

    .page-shell {
      display: grid;
      gap: 24px;
      max-width: 1520px;
      margin: 0 auto;
      animation: page-enter 380ms ease-out both;
    }

    /* ── shared card base ── */
    .hero,
    .section,
    .dual-panel,
    .track-card,
    .scenario-card,
    .playbook-card,
    .pitfall-card,
    .faq-card,
    .link-card,
    .video-card,
    .gallery-card {
      box-shadow: 0 16px 44px rgba(15, 23, 42, 0.07);
    }

    .hero,
    .section {
      border-radius: 32px;
      border: 1px solid rgba(20, 33, 61, 0.08);
      background: rgba(255, 252, 247, 0.9);
      backdrop-filter: blur(12px);
      padding: 30px;
      display: grid;
      gap: 22px;
    }

    /* ─────────── HERO ─────────── */
    .hero {
      grid-template-columns: minmax(0, 1.15fr) minmax(300px, 0.85fr);
      gap: 32px;
      align-items: center;
    }

    .hero-copy { display: grid; gap: 16px; align-content: start; }

    .eyebrow,
    .section-kicker,
    .track-phase {
      display: inline-flex;
      align-items: center;
      width: fit-content;
      padding: 7px 13px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      background: rgba(20, 184, 166, 0.12);
      color: #0f766e;
    }

    h1 {
      margin: 0;
      font-size: clamp(36px, 4.8vw, 60px);
      line-height: 1.02;
      font-family: "Aptos Display", "Trebuchet MS", "Segoe UI", sans-serif;
      letter-spacing: -0.035em;
      color: #0f172a;
    }

    h1 em {
      font-style: normal;
      background: linear-gradient(135deg, #0d9488 0%, #7c3aed 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    h2 {
      margin: 0;
      font-size: clamp(26px, 3vw, 38px);
      line-height: 1.1;
      font-family: "Aptos Display", "Trebuchet MS", "Segoe UI", sans-serif;
      letter-spacing: -0.03em;
      color: #0f172a;
    }

    h3 {
      margin: 0;
      font-size: 20px;
      line-height: 1.2;
      font-family: "Aptos Display", "Trebuchet MS", "Segoe UI", sans-serif;
      color: #0f172a;
    }

    .hero-text,
    .section-summary,
    p { margin: 0; color: #475569; line-height: 1.68; font-size: 15px; }

    .hero-badges { display: flex; flex-wrap: wrap; gap: 8px; }

    .badge { padding: 5px 12px; border-radius: 999px; font-size: 12px; font-weight: 700; }
    .badge-teal  { background: rgba(20, 184, 166, 0.12); color: #0f766e; }
    .badge-amber { background: rgba(217, 119, 6, 0.12);  color: #92400e; }

    .hero-actions { display: flex; flex-wrap: wrap; gap: 10px; }

    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 44px;
      padding: 0 20px;
      border-radius: 999px;
      border: 1px solid transparent;
      font-size: 14px;
      font-weight: 700;
      text-decoration: none;
      cursor: pointer;
      transition: transform 150ms ease, box-shadow 150ms ease;
    }

    .btn:hover { transform: translateY(-1px); }

    .btn-primary {
      background: linear-gradient(135deg, #0f766e 0%, #0d9488 100%);
      color: #f8fafc;
      box-shadow: 0 10px 26px rgba(15, 118, 110, 0.22);
    }

    .btn-secondary {
      background: #fff7ed;
      border-color: rgba(217, 119, 6, 0.2);
      color: #9a3412;
    }

    .btn-ghost {
      background: transparent;
      border-color: rgba(20, 33, 61, 0.14);
      color: #14213d;
    }

    .quick-link-row { display: flex; flex-wrap: wrap; gap: 8px; padding-top: 4px; }

    .ql-chip {
      padding: 6px 14px;
      border-radius: 999px;
      background: #f1f5f9;
      color: #334155;
      font-size: 13px;
      font-weight: 600;
      text-decoration: none;
      border: 1px solid rgba(20, 33, 61, 0.08);
      transition: background 140ms ease;
    }

    .ql-chip:hover { background: #e2e8f0; }

    .hero-visual {
      position: relative;
      display: flex;
      align-self: stretch;
    }

    .hero-visual::before {
      content: '';
      position: absolute;
      inset: 20px 0 0 20px;
      border-radius: 26px;
      background: linear-gradient(145deg, rgba(20, 184, 166, 0.18), rgba(124, 58, 237, 0.12));
      filter: blur(8px);
    }

    .hero-visual img {
      position: relative;
      width: 100%;
      height: 100%;
      object-fit: cover;
      border-radius: 26px;
      border: 1px solid rgba(255, 255, 255, 0.7);
      min-height: 320px;
    }

    /* ─────────── SECTION HEADERS ─────────── */
    .section-header { display: grid; gap: 10px; }

    /* ─────────── FLOW DIAGRAM ─────────── */
    .flow-section { gap: 18px; }

    .flow-diagram-wrap {
      overflow-x: auto;
      border-radius: 20px;
      background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%);
      border: 1px solid rgba(20, 33, 61, 0.07);
      padding: 16px;
    }

    .flow-svg { width: 100%; min-width: 780px; display: block; }

    .flow-legend {
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
      align-items: center;
      font-size: 13px;
      color: #64748b;
      font-weight: 600;
    }

    .legend-dot {
      display: inline-block;
      width: 12px;
      height: 12px;
      border-radius: 50%;
    }

    /* ─────────── DAILY TRACKS ─────────── */
    .track-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 16px;
    }

    .track-card {
      border-radius: 24px;
      border: 1px solid rgba(20, 33, 61, 0.08);
      padding: 22px;
      display: grid;
      gap: 14px;
      background: white;
      transition: transform 150ms ease;
    }

    .track-card:hover { transform: translateY(-2px); }
    .track-card[data-tone="dawn"]  { background: linear-gradient(180deg, #fffbeb 0%, #fffef5 100%); }
    .track-card[data-tone="prep"]  { background: linear-gradient(180deg, #ecfdf5 0%, #f9fffd 100%); }
    .track-card[data-tone="live"]  { background: linear-gradient(180deg, #f5f3ff 0%, #fdfcff 100%); }
    .track-card[data-tone="close"] { background: linear-gradient(180deg, #fff7ed 0%, #fffaf5 100%); }

    .track-head { display: flex; align-items: flex-start; gap: 12px; }
    .track-icon { font-size: 26px; line-height: 1; flex-shrink: 0; }
    .track-phase { font-size: 10px; padding: 4px 10px; margin-bottom: 4px; }

    ul {
      margin: 0;
      padding-left: 18px;
      display: grid;
      gap: 8px;
      color: #334155;
      font-size: 14px;
      line-height: 1.58;
    }

    li::marker { color: #0d9488; }

    /* ─────────── SCENARIOS ─────────── */
    .scenario-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 16px;
    }

    .scenario-card {
      border-radius: 24px;
      border: 1px solid rgba(20, 33, 61, 0.08);
      background: white;
      padding: 22px;
      display: grid;
      gap: 12px;
      align-content: start;
      position: relative;
      overflow: hidden;
      transition: transform 150ms ease;
    }

    .scenario-card:hover { transform: translateY(-2px); }

    .scenario-num {
      position: absolute;
      top: 16px;
      right: 18px;
      font-size: 56px;
      font-weight: 900;
      color: rgba(20, 33, 61, 0.05);
      line-height: 1;
      font-family: "Aptos Display", sans-serif;
    }

    .scenario-tag {
      display: inline-flex;
      width: fit-content;
      padding: 5px 11px;
      border-radius: 999px;
      background: rgba(20, 184, 166, 0.1);
      color: #0f766e;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    /* ─────────── PLAYBOOK ─────────── */
    .playbook-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 16px;
    }

    .playbook-card {
      border-radius: 24px;
      border: 1px solid rgba(20, 33, 61, 0.08);
      background: white;
      padding: 24px;
      display: grid;
      gap: 14px;
      align-content: start;
      transition: transform 150ms ease;
    }

    .playbook-card:hover { transform: translateY(-2px); }

    .playbook-head { display: flex; gap: 14px; align-items: flex-start; }

    .stage-num {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: linear-gradient(135deg, #0d9488, #7c3aed);
      color: white;
      font-size: 16px;
      font-weight: 800;
      flex-shrink: 0;
    }

    .stage-desc { font-size: 14px; color: #64748b; }

    .signal-chip {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 14px;
      border-radius: 12px;
      background: rgba(20, 184, 166, 0.08);
      color: #0f766e;
      font-size: 13px;
      font-weight: 600;
      border: 1px solid rgba(20, 184, 166, 0.15);
    }

    .signal-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: #0d9488;
      color: white;
      font-size: 11px;
      font-weight: 800;
      flex-shrink: 0;
    }

    .route-pill {
      display: inline-flex;
      align-items: center;
      width: fit-content;
      padding: 6px 12px;
      border-radius: 999px;
      background: #f1f5f9;
      color: #475569;
      font-size: 12px;
      font-weight: 700;
      font-family: monospace;
      text-decoration: none;
      border: 1px solid rgba(20, 33, 61, 0.08);
      transition: background 140ms ease;
    }

    .route-pill:hover { background: #e2e8f0; }

    /* ─────────── DUAL LAYOUT ─────────── */
    .dual-section {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      gap: 24px;
    }

    .dual-panel {
      border-radius: 32px;
      border: 1px solid rgba(20, 33, 61, 0.08);
      background: rgba(255, 252, 247, 0.9);
      backdrop-filter: blur(12px);
      padding: 28px;
      display: grid;
      gap: 18px;
      align-content: start;
    }

    .pitfall-list,
    .faq-list { display: grid; gap: 12px; }

    .pitfall-card {
      display: flex;
      gap: 14px;
      align-items: flex-start;
      padding: 16px;
      border-radius: 16px;
      background: #fef2f2;
      border: 1px solid #fecaca;
    }

    .pitfall-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: #dc2626;
      color: white;
      font-size: 13px;
      font-weight: 900;
      flex-shrink: 0;
    }

    .pitfall-card h3 { font-size: 15px; margin-bottom: 6px; color: #991b1b; }
    .pitfall-card p  { font-size: 13.5px; color: #7f1d1d; }

    .faq-card {
      padding: 16px;
      border-radius: 16px;
      background: #f8fafc;
      border: 1px solid rgba(20, 33, 61, 0.08);
    }

    .faq-card h3 { font-size: 15px; margin-bottom: 8px; color: #1e3a5f; }
    .faq-card p  { font-size: 13.5px; }

    /* ─────────── QUICK LINKS ─────────── */
    .link-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }

    .link-card {
      padding: 14px 16px;
      border-radius: 16px;
      background: #f8fafc;
      border: 1px solid rgba(20, 33, 61, 0.08);
      text-decoration: none;
      display: grid;
      gap: 4px;
      transition: background 140ms ease, transform 140ms ease;
    }

    .link-card:hover { background: #f1f5f9; transform: translateY(-1px); }
    .link-card strong { font-size: 14px; color: #0f172a; }
    .link-card p { font-size: 12.5px; color: #64748b; }
    .link-card code { font-size: 11px; color: #0f766e; font-family: monospace; }

    .guardrail-list {
      padding-left: 18px;
      display: grid;
      gap: 10px;
      color: #334155;
      font-size: 14px;
      line-height: 1.65;
    }

    .guardrail-list li::marker { color: #d97706; }

    .guardrail-note {
      padding: 14px;
      border-radius: 14px;
      background: rgba(217, 119, 6, 0.06);
      border: 1px solid rgba(217, 119, 6, 0.14);
      color: #92400e;
      font-size: 13.5px;
      line-height: 1.6;
    }

    /* ─────────── VIDEOS ─────────── */
    .video-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 16px;
    }

    .video-card {
      border-radius: 22px;
      border: 1px solid rgba(20, 33, 61, 0.08);
      background: white;
      overflow: hidden;
      display: grid;
      grid-template-rows: auto 1fr;
      transition: transform 150ms ease;
    }

    .video-card:hover { transform: translateY(-2px); }

    .video-card video {
      display: block;
      width: 100%;
      aspect-ratio: 16 / 10;
      background: #0f172a;
    }

    .video-copy { padding: 18px; display: grid; gap: 8px; }
    .video-copy h3 { font-size: 17px; }
    .video-copy p  { font-size: 13.5px; }

    .text-link {
      color: #0f766e;
      text-decoration: none;
      font-weight: 700;
      font-size: 13px;
    }

    .text-link:hover { text-decoration: underline; }

    /* ─────────── GALLERY ─────────── */
    .gallery-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 16px;
    }

    .gallery-card {
      border-radius: 22px;
      border: 1px solid rgba(20, 33, 61, 0.08);
      background: white;
      overflow: hidden;
      display: grid;
      grid-template-rows: 200px 1fr;
      transition: transform 150ms ease;
    }

    .gallery-card:hover { transform: translateY(-2px); }

    .gallery-thumb { overflow: hidden; background: #f1f5f9; }

    .gallery-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }

    .gallery-copy { padding: 16px; display: grid; gap: 8px; align-content: start; }
    .gallery-copy h3 { font-size: 16px; }
    .gallery-copy p  { font-size: 13px; }

    .gallery-actions { display: flex; gap: 14px; align-items: center; }

    /* ─────────── ANIMATIONS ─────────── */
    @keyframes page-enter {
      from { opacity: 0; transform: translateY(10px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    /* ─────────── RESPONSIVE ─────────── */
    @media (max-width: 1280px) {
      .hero { grid-template-columns: 1fr; }
      .hero-visual { display: none; }
      .track-grid,
      .scenario-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .playbook-grid,
      .gallery-grid,
      .video-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }

    @media (max-width: 860px) {
      :host { padding: 14px; }
      .hero,
      .section,
      .dual-panel { padding: 20px; border-radius: 22px; }
      .dual-section { grid-template-columns: 1fr; }
      .track-grid,
      .scenario-grid,
      .gallery-grid,
      .video-grid,
      .link-grid,
      .playbook-grid { grid-template-columns: 1fr; }
    }
  `],
})
export class TeacherGuideLandingComponent {
  protected readonly heroImage = '/assets/teacher-docs/assets/00_teacher_overview.webp';

  protected readonly quickLinks: QuickLink[] = [
    { label: 'Dashboard',       route: '/app/dashboard',                   note: 'Tổng quan đầu ngày.' },
    { label: 'Attendance',      route: '/app/attendance',                  note: 'Điểm danh và tạo link cho học sinh.' },
    { label: 'Teaching Report', route: '/app/teaching-report',             note: 'Nộp báo cáo sau buổi học.' },
    { label: 'Lịch dạy',        route: '/app/teacher-calendar',            note: 'Rà lịch dạy và ca sắp tới.' },
    { label: 'Payroll',         route: '/app/payroll',                     note: 'Theo dõi tình trạng tính lương.' },
    { label: 'Hồ sơ giáo viên', route: '/app/teacher-profile',             note: 'Cập nhật hồ sơ cá nhân.' },
  ];

  protected readonly dailyTracks: DailyTrack[] = [
    {
      phase: 'Đầu ngày',
      tone: 'dawn',
      icon: '🌅',
      title: 'Bắt đầu ca làm việc',
      items: [
        'Đăng nhập và kiểm tra Dashboard để nắm lịch dạy, thu nhập và ticket đang mở.',
        'Mở thông báo và lịch dạy để xác nhận các buổi trong ngày.',
        'Rà nhanh lớp phụ trách để chuẩn bị đúng tài liệu và danh sách học sinh.',
      ],
    },
    {
      phase: 'Trước giờ dạy',
      tone: 'prep',
      icon: '📋',
      title: 'Chuẩn bị cho buổi học',
      items: [
        'Kiểm tra tài liệu giảng dạy, lịch lớp và tình trạng học sinh đăng ký.',
        'Nếu có rủi ro vắng mặt, tạo yêu cầu thay thế càng sớm càng tốt.',
        'Chuẩn bị sẵn luồng điểm danh hoặc link check-in cho học sinh.',
      ],
    },
    {
      phase: 'Sau buổi dạy',
      tone: 'live',
      icon: '✅',
      title: 'Chốt dữ liệu buổi học',
      items: [
        'Cập nhật điểm danh theo lớp và ngày dạy – không để sang ngày hôm sau.',
        'Nộp Teaching Report ngay khi kết thúc buổi học.',
        'Kiểm tra ticket hoặc tin nhắn phát sinh liên quan đến lớp đang dạy.',
      ],
    },
    {
      phase: 'Cuối tuần / Cuối tháng',
      tone: 'close',
      icon: '💰',
      title: 'Đối chiếu lương',
      items: [
        'Xem Payroll preview để biết buổi nào đã được tính lương.',
        'Rà lại work session login/logout để đối chiếu chấm công.',
        'Cập nhật hồ sơ dạy, lịch rảnh và thông tin nhận lương nếu cần.',
      ],
    },
  ];

  protected readonly scenarios: ScenarioCard[] = [
    {
      index: 1,
      tag: 'Hằng ngày',
      title: 'Bắt đầu ngày làm việc',
      summary: 'Đăng nhập, kiểm tra Dashboard và xác nhận các buổi dạy cần xử lý trong ngày.',
      steps: [
        'Login thành công và thấy đúng menu của giáo viên.',
        'Dashboard hiển thị số buổi, thu nhập và lớp đang dạy.',
        'Mở lịch dạy để xem các ca sắp tới và chuẩn bị.',
      ],
      route: '/app/dashboard',
    },
    {
      index: 2,
      tag: 'Trong buổi học',
      title: 'Điểm danh và tạo link',
      summary: 'Chọn lớp, tạo link điểm danh và rà nhanh trạng thái attendance sau buổi.',
      steps: [
        'Chọn đúng lớp và ngày học trong màn Attendance.',
        'Tạo link điểm danh hợp lệ và gửi cho học sinh tự check-in.',
        'Xác nhận danh sách điểm danh trước khi đóng ca.',
      ],
      route: '/app/attendance',
    },
    {
      index: 3,
      tag: 'Sau buổi học',
      title: 'Báo cáo và đối chiếu lương',
      summary: 'Nộp báo cáo giảng dạy và đối chiếu với Payroll preview để biết buổi nào đủ điều kiện.',
      steps: [
        'Vào Teaching Report, chọn buổi học vừa hoàn thành.',
        'Nộp báo cáo có ghi chú nội dung bài học.',
        'Kiểm tra Payroll preview để xem trạng thái đủ điều kiện lương.',
      ],
      route: '/app/teaching-report',
    },
    {
      index: 4,
      tag: 'Phát sinh',
      title: 'Xử lý phát sinh nội bộ',
      summary: 'Tạo yêu cầu dạy thay, mở ticket hỗ trợ hoặc nhắn tin khi có rủi ro vận hành.',
      steps: [
        'Tạo yêu cầu thay thế với lớp và khoảng thời gian cụ thể.',
        'Mở ticket nếu cần OPS hoặc kế toán hỗ trợ xử lý.',
        'Theo dõi tin nhắn nội bộ để phối hợp xử lý nhanh.',
      ],
      route: '/app/teacher-substitute-request',
    },
  ];

  protected readonly playbookStages: PlaybookStage[] = [
    {
      num: '1',
      title: 'Trước giờ dạy',
      description: 'Xác nhận lịch, lớp và tài liệu để vào ca chủ động, không bị động.',
      steps: [
        'Đăng nhập rồi xem Dashboard để nắm buổi sắp tới và thông báo mới.',
        'Mở Teacher Calendar để rà khung giờ và lớp phụ trách trong ngày.',
        'Kiểm tra Teaching Materials nếu cần tải tài liệu hoặc xem ghi chú từ vận hành.',
      ],
      signal: 'Biết rõ hôm nay dạy lớp nào, lúc nào và cần chuẩn bị gì.',
      route: '/app/dashboard',
    },
    {
      num: '2',
      title: 'Ngay sau buổi dạy',
      description: 'Không để Attendance và Teaching Report bị treo đến cuối ngày – dữ liệu trễ ảnh hưởng trực tiếp đến lương.',
      steps: [
        'Mở Attendance để điểm danh hoặc xác nhận link điểm danh đã dùng đúng lớp.',
        'Đi sang Teaching Report để nộp báo cáo giảng dạy ngay sau buổi học.',
        'Đọc lại trạng thái buổi học trước khi rời màn hình để đảm bảo đủ dữ liệu.',
      ],
      signal: 'Buổi học có đủ Attendance và Teaching Report trong cùng ngày.',
      route: '/app/teaching-report',
    },
    {
      num: '3',
      title: 'Khi có phát sinh',
      description: 'Giáo viên không nên xử lý phát sinh bằng nhắn miệng – mọi thay đổi cần có dấu vết trên hệ thống.',
      steps: [
        'Nếu không thể dạy đúng lịch, tạo Substitute Request càng sớm càng tốt.',
        'Mở Ticket nếu cần OPS hoặc bộ phận khác hỗ trợ xử lý vấn đề.',
        'Dùng tin nhắn nội bộ để phối hợp nhanh nhưng vẫn nên có ticket khi cần theo dấu.',
      ],
      signal: 'Mọi phát sinh đều có dấu vết trên hệ thống, không phụ thuộc trí nhớ.',
      route: '/app/teacher-substitute-request',
    },
  ];

  protected readonly pitfalls: { title: string; detail: string }[] = [
    {
      title: 'Để cuối ngày mới điểm danh hoặc viết báo cáo',
      detail:
        'Khi làm dồn cuối ngày, giáo viên dễ nhầm lớp, nhầm giờ hoặc quên chi tiết buổi học. Dữ liệu kém tin cậy và ảnh hưởng trực tiếp đến điều kiện tính lương.',
    },
    {
      title: 'Chỉ nhắn tin mà không tạo Substitute Request',
      detail:
        'Tin nhắn giúp trao đổi nhanh, nhưng request hoặc ticket mới là dấu vết chính thức để vận hành xử lý và ghi nhận vào hệ thống.',
    },
    {
      title: 'Thấy Payroll lệch nhưng không kiểm tra nguồn dữ liệu',
      detail:
        'Nếu lương lệch, hãy quay lại Teaching Report và Attendance trước. Hầu hết nguyên nhân nằm ở dữ liệu đầu vào, không phải màn Payroll.',
    },
  ];

  protected readonly faq: { q: string; a: string }[] = [
    {
      q: 'Nếu Attendance đã làm nhưng Payroll chưa tính thì sao?',
      a: 'Hãy kiểm tra Teaching Report, trạng thái session và điều kiện xác nhận từ phụ huynh. Payroll là kết quả cuối của nhiều bước phía trước.',
    },
    {
      q: 'Giáo viên có xem được dữ liệu của giáo viên khác không?',
      a: 'Không. Giáo viên chỉ xem và thao tác trên dữ liệu của chính mình: hồ sơ, lịch dạy, attendance, báo cáo và payroll liên quan.',
    },
    {
      q: 'Khi nào nên mở Ticket thay vì nhắn tin?',
      a: 'Dùng Ticket khi vấn đề cần theo dõi hoặc cần bộ phận khác xử lý chính thức. Tin nhắn dùng để phối hợp nhanh, không thay thế cho quy trình.',
    },
  ];

  protected readonly guardrails: string[] = [
    'Giáo viên chỉ thao tác trên dữ liệu của mình: hồ sơ, lịch dạy, session, attendance và phần lương liên quan.',
    'Mọi phát sinh nghỉ dạy, thay thế hoặc hỗ trợ vận hành nên đi qua Substitute Request hoặc Ticket.',
    'Không có quyền sửa ví, hóa đơn, user hay các phần kiểm soát tài chính nội bộ.',
    'Nếu màn hình bị chặn truy cập, đó là logic quyền hợp lệ – liên hệ OPS qua Ticket để được hỗ trợ.',
  ];

  protected readonly videos: VideoCard[] = [
    {
      title: 'Đăng nhập và vào Dashboard',
      description: 'Video demo luồng giáo viên đăng nhập bằng tài khoản mẫu và kiểm tra Dashboard sau khi vào hệ thống.',
      src: '/assets/teacher-docs/videos/teacher_login_dashboard.webm',
      poster: '/assets/teacher-docs/assets/10_teacher_login.webp',
    },
    {
      title: 'Điểm danh và tạo link cho học sinh',
      description: 'Video thao tác tại màn Attendance: chọn lớp, chọn ngày và tạo link điểm danh hợp lệ.',
      src: '/assets/teacher-docs/videos/teacher_attendance_link.webm',
      poster: '/assets/teacher-docs/assets/13_teacher_attendance.webp',
    },
    {
      title: 'Báo cáo giảng dạy và Payroll',
      description: 'Video nối tiếp giữa Teaching Report và Payroll preview để kiểm tra điều kiện tính lương.',
      src: '/assets/teacher-docs/videos/teacher_report_payroll.webm',
      poster: '/assets/teacher-docs/assets/19_teacher_payroll.webp',
    },
  ];

  protected readonly gallery: GalleryItem[] = [
    {
      title: 'Đăng nhập',
      description: 'Điểm bắt đầu của toàn bộ luồng giáo viên với form login dùng cookie phiên làm việc.',
      image: '/assets/teacher-docs/assets/10_teacher_login.webp',
    },
    {
      title: 'Dashboard giáo viên',
      description: 'Tổng quan chỉ số, buổi học, thu nhập và những việc cần xử lý ngay trong ngày.',
      image: '/assets/teacher-docs/assets/11_teacher_dashboard.webp',
      route: '/app/dashboard',
    },
    {
      title: 'Lớp học phụ trách',
      description: 'Danh sách lớp giáo viên đang dạy cùng thông tin học sinh và đơn giá liên quan.',
      image: '/assets/teacher-docs/assets/12_teacher_classes.webp',
      route: '/app/classes',
    },
    {
      title: 'Điểm danh',
      description: 'Chọn lớp và ngày để tải danh sách học sinh, tạo link check-in hoặc lưu trạng thái attendance.',
      image: '/assets/teacher-docs/assets/13_teacher_attendance.webp',
      route: '/app/attendance',
    },
    {
      title: 'Báo cáo giảng dạy',
      description: 'Kiểm tra buổi đã có báo cáo hoặc còn thiếu báo cáo trước khi chốt lương.',
      image: '/assets/teacher-docs/assets/14_teacher_teaching_report.webp',
      route: '/app/teaching-report',
    },
    {
      title: 'Hồ sơ giáo viên',
      description: 'Quản lý hồ sơ cá nhân, chuyên môn, lịch rảnh và thông tin nhận lương.',
      image: '/assets/teacher-docs/assets/15_teacher_profile.webp',
      route: '/app/teacher-profile',
    },
    {
      title: 'Lịch dạy',
      description: 'Lịch tuần/tháng của giáo viên để rà soát các session sắp diễn ra.',
      image: '/assets/teacher-docs/assets/16_teacher_calendar.webp',
      route: '/app/teacher-calendar',
    },
    {
      title: 'Xin nghỉ hoặc dạy thay',
      description: 'Tạo yêu cầu thay thế có khoảng ngày và lý do rõ ràng để đội vận hành xử lý.',
      image: '/assets/teacher-docs/assets/17_teacher_substitute.webp',
      route: '/app/teacher-substitute-request',
    },
    {
      title: 'Payroll preview',
      description: 'Đối chiếu các session đã dạy với trạng thái đủ điều kiện lương hoặc còn đang chờ xác nhận.',
      image: '/assets/teacher-docs/assets/19_teacher_payroll.webp',
      route: '/app/payroll',
    },
  ];
}

