import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Role } from '../models/role.enum';
import { AuthService } from '../services/auth.service';

interface QuickTrack {
  title: string;
  tone: 'gold' | 'teal' | 'ember' | 'slate';
  items: string[];
}

interface ScenarioCard {
  title: string;
  summary: string;
  checklist: string[];
  appRoute?: string;
  allowedRoles: Role[];
}

interface ResourceCard {
  title: string;
  description: string;
  href: string;
  kind: string;
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
  appRoute?: string;
  allowedRoles: Role[];
}

interface GalleryGroup {
  title: string;
  summary: string;
  items: GalleryItem[];
}

@Component({
  selector: 'app-teacher-guide-landing',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="guide-shell">
      <section class="hero-card">
        <div class="hero-copy">
          <p class="eyebrow">Internal Teacher Hub</p>
          <h1>Cổng đào tạo và vận hành giáo viên</h1>
          <p class="hero-text">
            Tất cả tài liệu hướng dẫn, kịch bản kiểm thử, ảnh minh họa và video thao tác của vai trò giáo viên đã được gom vào một trang nội bộ duy nhất.
            Trang này dùng để onboarding, kiểm tra chéo nghiệp vụ và hỗ trợ đội vận hành khi đào tạo giáo viên mới.
          </p>

          <div class="hero-actions">
            <a class="btn btn-primary" [href]="guideDocUrl" target="_blank" rel="noopener">Mở hướng dẫn chi tiết</a>
            <a class="btn btn-secondary" [href]="qaDocUrl" target="_blank" rel="noopener">Mở checklist QA</a>
            <a class="btn btn-ghost" [href]="videos[0].src" target="_blank" rel="noopener">Xem video login</a>
          </div>

          <div class="hero-meta">
            <article class="meta-card">
              <span class="meta-label">Môi trường</span>
              <strong>Local demo</strong>
              <p><code>http://localhost:4200</code> kết nối <code>http://localhost:3000</code></p>
            </article>
            <article class="meta-card">
              <span class="meta-label">Tài khoản mẫu</span>
              <strong><code>teacher.demo&#64;school.local</code></strong>
              <p>Mật khẩu demo lấy từ biến <code>DEMO_PASSWORD</code> trong file <code>.env</code>.</p>
            </article>
            <article class="meta-card">
              <span class="meta-label">Phạm vi</span>
              <strong>Teacher workflow</strong>
              <p>Login, dashboard, lớp học, điểm danh, báo cáo, lịch dạy, lương, ticket và tin nhắn.</p>
            </article>
          </div>
        </div>

        <div class="hero-visual">
          <img [src]="overviewSlide" alt="Tổng quan tài liệu giáo viên" loading="eager" />
        </div>
      </section>

      <section class="section">
        <div class="section-heading">
          <div>
            <p class="section-kicker">Checklist vận hành</p>
            <h2>Các việc cần làm theo nhịp làm việc của giáo viên</h2>
          </div>
          <a class="text-link" [href]="checklistSlide" target="_blank" rel="noopener">Mở slide checklist</a>
        </div>

        <div class="checklist-layout">
          <div class="track-grid">
            <article class="track-card" *ngFor="let track of quickTracks" [attr.data-tone]="track.tone">
              <h3>{{ track.title }}</h3>
              <ul>
                <li *ngFor="let item of track.items">{{ item }}</li>
              </ul>
            </article>
          </div>

          <div class="spotlight-card">
            <img [src]="checklistSlide" alt="Checklist ngày tuần tháng của giáo viên" loading="lazy" />
            <div class="spotlight-copy">
              <h3>Checklist gói gọn cho onboarding</h3>
              <p>
                Dùng phần này khi cần hướng dẫn giáo viên mới theo từng mốc: đầu ngày, trước giờ dạy, sau buổi dạy và cuối tuần hoặc cuối tháng.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section class="section">
        <div class="section-heading">
          <div>
            <p class="section-kicker">Kịch bản trọng tâm</p>
            <h2>Các tình huống giáo viên cần thực hành và kiểm tra</h2>
          </div>
          <a class="text-link" [href]="scenarioSlide" target="_blank" rel="noopener">Mở slide scenario</a>
        </div>

        <div class="scenario-banner">
          <img [src]="scenarioSlide" alt="Kịch bản giáo viên" loading="lazy" />
        </div>

        <div class="scenario-grid">
          <article class="scenario-card" *ngFor="let scenario of scenarios">
            <h3>{{ scenario.title }}</h3>
            <p>{{ scenario.summary }}</p>
            <ul>
              <li *ngFor="let step of scenario.checklist">{{ step }}</li>
            </ul>

            <div class="scenario-actions">
              <a
                class="btn btn-small btn-secondary"
                *ngIf="scenario.appRoute && canOpenRoute(scenario.allowedRoles)"
                [routerLink]="scenario.appRoute"
              >
                Mở màn hình
              </a>
              <span class="route-note" *ngIf="scenario.appRoute">{{ scenario.appRoute }}</span>
            </div>
          </article>
        </div>
      </section>

      <section class="section">
        <div class="section-heading">
          <div>
            <p class="section-kicker">Video thao tác</p>
            <h2>Video đào tạo quay từ môi trường demo thật</h2>
          </div>
        </div>

        <div class="video-grid">
          <article class="video-card" *ngFor="let video of videos">
            <video controls preload="metadata" [poster]="video.poster">
              <source [src]="video.src" type="video/webm" />
            </video>
            <div class="video-copy">
              <h3>{{ video.title }}</h3>
              <p>{{ video.description }}</p>
              <a class="text-link" [href]="video.src" target="_blank" rel="noopener">Mở video riêng</a>
            </div>
          </article>
        </div>
      </section>

      <section class="section">
        <div class="section-heading">
          <div>
            <p class="section-kicker">Tài liệu gốc</p>
            <h2>Markdown và tài nguyên bàn giao</h2>
          </div>
        </div>

        <div class="resource-grid">
          <article class="resource-card" *ngFor="let resource of resources">
            <span class="resource-kind">{{ resource.kind }}</span>
            <h3>{{ resource.title }}</h3>
            <p>{{ resource.description }}</p>
            <a class="text-link" [href]="resource.href" target="_blank" rel="noopener">Mở tài nguyên</a>
          </article>
        </div>
      </section>

      <section class="section" *ngFor="let group of galleryGroups">
        <div class="section-heading">
          <div>
            <p class="section-kicker">Gallery chức năng</p>
            <h2>{{ group.title }}</h2>
            <p class="section-summary">{{ group.summary }}</p>
          </div>
        </div>

        <div class="gallery-grid">
          <article class="gallery-card" *ngFor="let item of group.items">
            <img [src]="item.image" [alt]="item.title" loading="lazy" />
            <div class="gallery-copy">
              <h3>{{ item.title }}</h3>
              <p>{{ item.description }}</p>
              <div class="gallery-actions">
                <a class="text-link" [href]="item.image" target="_blank" rel="noopener">Mở ảnh</a>
                <a
                  class="text-link"
                  *ngIf="item.appRoute && canOpenRoute(item.allowedRoles)"
                  [routerLink]="item.appRoute"
                >
                  Mở màn hình
                </a>
              </div>
              <div class="route-pill" *ngIf="item.appRoute">{{ item.appRoute }}</div>
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
      background:
        radial-gradient(circle at top right, rgba(251, 191, 36, 0.16), transparent 20%),
        radial-gradient(circle at left center, rgba(20, 184, 166, 0.14), transparent 18%),
        linear-gradient(180deg, #f4efe4 0%, #f7f4ec 35%, #fbfaf6 100%);
      color: #14213d;
      padding: 28px;
      font-family: "Trebuchet MS", "Aptos", "Segoe UI", sans-serif;
    }

    .guide-shell {
      display: grid;
      gap: 26px;
      max-width: 1480px;
      margin: 0 auto;
      animation: page-enter 420ms ease-out;
    }

    .hero-card,
    .section,
    .scenario-card,
    .track-card,
    .spotlight-card,
    .video-card,
    .resource-card,
    .gallery-card {
      box-shadow: 0 18px 48px rgba(15, 23, 42, 0.08);
    }

    .hero-card,
    .section {
      border: 1px solid rgba(20, 33, 61, 0.08);
      border-radius: 32px;
      background: rgba(255, 252, 247, 0.86);
      backdrop-filter: blur(14px);
    }

    .hero-card {
      display: grid;
      grid-template-columns: minmax(0, 1.2fr) minmax(340px, 0.9fr);
      gap: 28px;
      padding: 30px;
      overflow: hidden;
    }

    .hero-copy {
      display: grid;
      gap: 18px;
      align-content: start;
    }

    .eyebrow,
    .section-kicker,
    .meta-label,
    .resource-kind {
      display: inline-flex;
      align-items: center;
      width: fit-content;
      padding: 8px 12px;
      border-radius: 999px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      font-size: 12px;
      font-weight: 800;
      background: rgba(20, 184, 166, 0.12);
      color: #0f766e;
    }

    h1,
    h2,
    h3 {
      margin: 0;
      font-family: "Aptos Display", "Trebuchet MS", "Segoe UI", sans-serif;
      letter-spacing: -0.03em;
    }

    h1 {
      font-size: clamp(34px, 5vw, 58px);
      line-height: 1.02;
    }

    h2 {
      font-size: clamp(28px, 3.4vw, 40px);
      line-height: 1.08;
    }

    h3 {
      font-size: 24px;
      line-height: 1.15;
    }

    .hero-text,
    .section-summary,
    .scenario-card p,
    .video-copy p,
    .resource-card p,
    .gallery-copy p,
    .meta-card p,
    .spotlight-copy p {
      margin: 0;
      color: #475569;
      line-height: 1.65;
      font-size: 15px;
    }

    .hero-actions,
    .scenario-actions,
    .gallery-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      align-items: center;
    }

    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 44px;
      padding: 0 18px;
      border-radius: 999px;
      border: 1px solid transparent;
      font-size: 14px;
      font-weight: 700;
      text-decoration: none;
      transition: transform 180ms ease, box-shadow 180ms ease, background 180ms ease;
    }

    .btn:hover {
      transform: translateY(-1px);
    }

    .btn-primary {
      background: linear-gradient(135deg, #0f766e 0%, #115e59 100%);
      color: #f8fafc;
      box-shadow: 0 12px 28px rgba(15, 118, 110, 0.22);
    }

    .btn-secondary {
      background: #fff7ed;
      border-color: rgba(217, 119, 6, 0.18);
      color: #9a3412;
    }

    .btn-ghost {
      background: transparent;
      border-color: rgba(20, 33, 61, 0.14);
      color: #14213d;
    }

    .btn-small {
      min-height: 38px;
      padding: 0 14px;
      font-size: 13px;
    }

    .hero-meta {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 14px;
    }

    .meta-card {
      border-radius: 22px;
      padding: 18px;
      background: linear-gradient(180deg, rgba(255, 255, 255, 0.96) 0%, rgba(249, 250, 251, 0.92) 100%);
      border: 1px solid rgba(20, 33, 61, 0.08);
      display: grid;
      gap: 10px;
    }

    .meta-card strong {
      font-size: 18px;
      color: #14213d;
    }

    .hero-visual {
      position: relative;
      min-height: 100%;
      align-self: stretch;
      display: flex;
    }

    .hero-visual::before {
      content: '';
      position: absolute;
      inset: 18px 0 0 18px;
      border-radius: 28px;
      background: linear-gradient(145deg, rgba(217, 119, 6, 0.16), rgba(20, 184, 166, 0.16));
      filter: blur(6px);
    }

    .hero-visual img,
    .spotlight-card img,
    .scenario-banner img,
    .gallery-card img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }

    .hero-visual img {
      position: relative;
      border-radius: 28px;
      border: 1px solid rgba(255, 255, 255, 0.74);
      min-height: 100%;
    }

    .section {
      padding: 26px;
      display: grid;
      gap: 18px;
      animation: section-rise 420ms ease both;
    }

    .section-heading {
      display: flex;
      align-items: end;
      justify-content: space-between;
      gap: 16px;
    }

    .text-link {
      color: #0f766e;
      text-decoration: none;
      font-weight: 700;
    }

    .text-link:hover {
      color: #115e59;
      text-decoration: underline;
    }

    .checklist-layout {
      display: grid;
      grid-template-columns: minmax(0, 1.15fr) minmax(320px, 0.85fr);
      gap: 18px;
    }

    .track-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 16px;
    }

    .track-card,
    .spotlight-card,
    .scenario-card,
    .video-card,
    .resource-card,
    .gallery-card {
      border-radius: 26px;
      border: 1px solid rgba(20, 33, 61, 0.08);
      background: rgba(255, 255, 255, 0.92);
      overflow: hidden;
      transition: transform 180ms ease, box-shadow 180ms ease;
    }

    .track-card:hover,
    .spotlight-card:hover,
    .scenario-card:hover,
    .video-card:hover,
    .resource-card:hover,
    .gallery-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 20px 54px rgba(15, 23, 42, 0.1);
    }

    .track-card {
      padding: 22px;
      display: grid;
      gap: 12px;
    }

    .track-card[data-tone="gold"] { background: linear-gradient(180deg, #fff9ed 0%, #fffef8 100%); }
    .track-card[data-tone="teal"] { background: linear-gradient(180deg, #ecfdf5 0%, #f8fffc 100%); }
    .track-card[data-tone="ember"] { background: linear-gradient(180deg, #fff7ed 0%, #fffaf5 100%); }
    .track-card[data-tone="slate"] { background: linear-gradient(180deg, #f8fafc 0%, #ffffff 100%); }

    ul {
      margin: 0;
      padding-left: 20px;
      display: grid;
      gap: 9px;
      color: #334155;
      line-height: 1.55;
      font-size: 14px;
    }

    li::marker {
      color: #d97706;
    }

    .spotlight-card {
      display: grid;
      grid-template-rows: minmax(240px, 1fr) auto;
    }

    .spotlight-copy,
    .video-copy,
    .resource-card,
    .gallery-copy {
      padding: 18px;
    }

    .spotlight-copy,
    .video-copy,
    .gallery-copy {
      display: grid;
      gap: 10px;
    }

    .scenario-banner {
      overflow: hidden;
      border-radius: 24px;
      border: 1px solid rgba(20, 33, 61, 0.08);
      min-height: 260px;
    }

    .scenario-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 16px;
    }

    .scenario-card {
      padding: 22px;
      display: grid;
      gap: 12px;
    }

    .route-note,
    .route-pill {
      display: inline-flex;
      align-items: center;
      width: fit-content;
      border-radius: 999px;
      padding: 6px 10px;
      background: #f1f5f9;
      color: #475569;
      font-size: 12px;
      font-weight: 700;
    }

    .video-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 16px;
    }

    .video-card video {
      display: block;
      width: 100%;
      background: #0f172a;
      aspect-ratio: 16 / 10;
    }

    .resource-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 16px;
    }

    .resource-card {
      display: grid;
      gap: 12px;
      padding: 20px;
    }

    .gallery-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 16px;
    }

    .gallery-card {
      display: grid;
      grid-template-rows: 220px auto;
    }

    .gallery-copy {
      min-height: 100%;
    }

    @keyframes page-enter {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }

    @keyframes section-rise {
      from { opacity: 0; transform: translateY(12px); }
      to { opacity: 1; transform: translateY(0); }
    }

    @media (max-width: 1320px) {
      .hero-card,
      .checklist-layout {
        grid-template-columns: 1fr;
      }

      .scenario-grid,
      .video-grid,
      .resource-grid,
      .gallery-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }

    @media (max-width: 900px) {
      :host {
        padding: 16px;
      }

      .section,
      .hero-card {
        padding: 18px;
        border-radius: 24px;
      }

      .hero-meta,
      .track-grid,
      .scenario-grid,
      .video-grid,
      .resource-grid,
      .gallery-grid {
        grid-template-columns: 1fr;
      }

      .section-heading {
        align-items: start;
        flex-direction: column;
      }

      .gallery-card {
        grid-template-rows: 200px auto;
      }
    }
  `],
})
export class TeacherGuideLandingComponent {
  private readonly auth = inject(AuthService);

  protected readonly guideDocUrl = '/assets/teacher-docs/HuongDanGiaoVien_ChiTiet.md';
  protected readonly qaDocUrl = '/assets/teacher-docs/KichBanKiemThu_GiaoVien.md';
  protected readonly overviewSlide = '/assets/teacher-docs/assets/00_teacher_overview.webp';
  protected readonly checklistSlide = '/assets/teacher-docs/assets/01_teacher_daily_checklist.webp';
  protected readonly scenarioSlide = '/assets/teacher-docs/assets/02_teacher_scenarios.webp';

  protected readonly quickTracks: QuickTrack[] = [
    {
      title: 'Đầu ngày',
      tone: 'gold',
      items: [
        'Đăng nhập và kiểm tra dashboard để nắm lịch dạy, thu nhập và ticket đang mở.',
        'Mở thông báo và lịch dạy để xác nhận các buổi trong ngày.',
        'Rà nhanh lớp phụ trách để chuẩn bị đúng tài liệu và danh sách học sinh.',
      ],
    },
    {
      title: 'Trước giờ dạy',
      tone: 'teal',
      items: [
        'Kiểm tra tài liệu giảng dạy, lịch lớp và tình trạng học sinh.',
        'Nếu có rủi ro vắng mặt, tạo yêu cầu xin nghỉ hoặc dạy thay.',
        'Chuẩn bị sẵn luồng điểm danh hoặc link check-in cho học sinh.',
      ],
    },
    {
      title: 'Sau buổi dạy',
      tone: 'ember',
      items: [
        'Cập nhật điểm danh theo lớp và ngày dạy.',
        'Hoàn thành session và nộp báo cáo giảng dạy ngay khi kết thúc buổi.',
        'Kiểm tra ticket hoặc tin nhắn phát sinh liên quan đến lớp đang dạy.',
      ],
    },
    {
      title: 'Cuối tuần hoặc cuối tháng',
      tone: 'slate',
      items: [
        'Xem payroll preview để biết buổi nào đã được tính lương.',
        'Rà lại work session login và logout để đối chiếu chấm công.',
        'Cập nhật hồ sơ dạy, lịch rảnh và thông tin nhận lương nếu cần.',
      ],
    },
  ];

  protected readonly scenarios: ScenarioCard[] = [
    {
      title: 'Bắt đầu ngày làm việc',
      summary: 'Đăng nhập, kiểm tra dashboard và xác nhận các buổi dạy phải xử lý trong ngày.',
      checklist: [
        'Login thành công và thấy đúng menu của giáo viên.',
        'Dashboard hiển thị số buổi, thu nhập và lớp đang dạy.',
        'Mở lịch dạy để xem các ca sắp tới.',
      ],
      appRoute: '/app/dashboard',
      allowedRoles: [Role.DIRECTOR, Role.OPS, Role.ACCOUNTING, Role.TEACHER],
    },
    {
      title: 'Chuẩn bị và điểm danh buổi học',
      summary: 'Chọn lớp, tải danh sách học sinh, tạo link điểm danh và rà nhanh trạng thái attendance.',
      checklist: [
        'Chọn đúng lớp và ngày học.',
        'Tải được danh sách học sinh theo ca.',
        'Tạo link attendance hợp lệ cho học sinh.',
      ],
      appRoute: '/app/attendance',
      allowedRoles: [Role.DIRECTOR, Role.OPS, Role.TEACHER],
    },
    {
      title: 'Chốt báo cáo để nhận lương',
      summary: 'Đối chiếu các buổi đã báo cáo với payroll preview để biết buổi nào đủ điều kiện tính lương.',
      checklist: [
        'Kiểm tra tab buổi đã có báo cáo.',
        'Xem buổi chờ phụ huynh hoặc OPS xác nhận.',
        'Đối chiếu tổng số buổi đủ điều kiện payroll.',
      ],
      appRoute: '/app/teaching-report',
      allowedRoles: [Role.DIRECTOR, Role.ACCOUNTING, Role.TEACHER],
    },
    {
      title: 'Xử lý phát sinh nội bộ',
      summary: 'Tạo yêu cầu dạy thay, mở ticket hỗ trợ hoặc nhắn tin nội bộ khi có rủi ro vận hành.',
      checklist: [
        'Tạo yêu cầu thay thế với lớp và khoảng thời gian cụ thể.',
        'Mở ticket nếu cần OPS hoặc kế toán hỗ trợ.',
        'Theo dõi tin nhắn nội bộ để phối hợp xử lý.',
      ],
      appRoute: '/app/teacher-substitute-request',
      allowedRoles: [Role.TEACHER],
    },
  ];

  protected readonly videos: VideoCard[] = [
    {
      title: 'Đăng nhập và vào dashboard',
      description: 'Video demo luồng giáo viên đăng nhập bằng tài khoản mẫu và kiểm tra dashboard sau khi vào hệ thống.',
      src: '/assets/teacher-docs/videos/teacher_login_dashboard.webm',
      poster: '/assets/teacher-docs/assets/10_teacher_login.webp',
    },
    {
      title: 'Điểm danh và tạo link cho học sinh',
      description: 'Video thao tác tại màn hình attendance: chọn lớp, chọn ngày và tạo link điểm danh cho học sinh.',
      src: '/assets/teacher-docs/videos/teacher_attendance_link.webm',
      poster: '/assets/teacher-docs/assets/13_teacher_attendance.webp',
    },
    {
      title: 'Báo cáo giảng dạy và payroll',
      description: 'Video nối tiếp giữa màn hình teaching report và payroll preview để kiểm tra điều kiện tính lương.',
      src: '/assets/teacher-docs/videos/teacher_report_payroll.webm',
      poster: '/assets/teacher-docs/assets/19_teacher_payroll.webp',
    },
  ];

  protected readonly resources: ResourceCard[] = [
    {
      title: 'Hướng dẫn giáo viên chi tiết',
      description: 'Tài liệu markdown đầy đủ từ đăng nhập, checklist theo ngày đến toàn bộ chức năng giáo viên.',
      href: this.guideDocUrl,
      kind: 'Markdown',
    },
    {
      title: 'Checklist kiểm thử và UAT',
      description: 'Bảng scenario để QA hoặc đội đào tạo dùng khi test vai trò giáo viên trên môi trường demo.',
      href: this.qaDocUrl,
      kind: 'QA',
    },
    {
      title: 'Slide tổng quan giáo viên',
      description: 'Ảnh `.webp` tóm tắt nhanh vai trò, nhịp công việc và các khối chức năng của giáo viên.',
      href: this.overviewSlide,
      kind: 'Slide',
    },
    {
      title: 'Slide các kịch bản trọng tâm',
      description: 'Ảnh `.webp` mô tả các tình huống cốt lõi khi onboarding hoặc huấn luyện lại giáo viên.',
      href: this.scenarioSlide,
      kind: 'Scenario',
    },
  ];

  protected readonly galleryGroups: GalleryGroup[] = [
    {
      title: 'Khởi động và điều phối hằng ngày',
      summary: 'Nhóm màn hình giúp giáo viên vào ca, nắm tình hình lớp học và điều phối công việc trong ngày.',
      items: [
        {
          title: 'Đăng nhập',
          description: 'Điểm bắt đầu của toàn bộ luồng giáo viên với form login dùng cookie phiên làm việc.',
          image: '/assets/teacher-docs/assets/10_teacher_login.webp',
          allowedRoles: [Role.DIRECTOR, Role.OPS, Role.ACCOUNTING, Role.TEACHER],
        },
        {
          title: 'Dashboard giáo viên',
          description: 'Tổng quan chỉ số, các buổi học, thu nhập và những việc cần xử lý ngay.',
          image: '/assets/teacher-docs/assets/11_teacher_dashboard.webp',
          appRoute: '/app/dashboard',
          allowedRoles: [Role.DIRECTOR, Role.OPS, Role.ACCOUNTING, Role.TEACHER],
        },
        {
          title: 'Lớp học phụ trách',
          description: 'Danh sách lớp giáo viên đang dạy cùng thông tin học sinh và đơn giá liên quan.',
          image: '/assets/teacher-docs/assets/12_teacher_classes.webp',
          appRoute: '/app/classes',
          allowedRoles: [Role.DIRECTOR, Role.OPS, Role.TEACHER, Role.SALE],
        },
        {
          title: 'Hồ sơ giảng dạy',
          description: 'Khu vực quản lý hồ sơ cá nhân, chuyên môn, lịch rảnh và thông tin nhận lương.',
          image: '/assets/teacher-docs/assets/15_teacher_profile.webp',
          appRoute: '/app/teacher-profile',
          allowedRoles: [Role.TEACHER],
        },
        {
          title: 'Lịch dạy',
          description: 'Lịch tuần hoặc tháng của giáo viên để rà soát các session sắp diễn ra.',
          image: '/assets/teacher-docs/assets/16_teacher_calendar.webp',
          appRoute: '/app/teacher-calendar',
          allowedRoles: [Role.TEACHER],
        },
      ],
    },
    {
      title: 'Vận hành buổi dạy',
      summary: 'Nhóm màn hình giáo viên dùng trực tiếp trước, trong và sau buổi học.',
      items: [
        {
          title: 'Điểm danh',
          description: 'Chọn lớp và ngày để tải danh sách học sinh, tạo link check-in hoặc lưu trạng thái attendance.',
          image: '/assets/teacher-docs/assets/13_teacher_attendance.webp',
          appRoute: '/app/attendance',
          allowedRoles: [Role.DIRECTOR, Role.OPS, Role.TEACHER],
        },
        {
          title: 'Báo cáo giảng dạy',
          description: 'Kiểm tra buổi đã có báo cáo hoặc còn thiếu báo cáo trước khi chốt lương.',
          image: '/assets/teacher-docs/assets/14_teacher_teaching_report.webp',
          appRoute: '/app/teaching-report',
          allowedRoles: [Role.DIRECTOR, Role.ACCOUNTING, Role.TEACHER],
        },
        {
          title: 'Xin nghỉ hoặc dạy thay',
          description: 'Tạo yêu cầu thay thế có khoảng ngày và lý do rõ ràng để đội vận hành xử lý.',
          image: '/assets/teacher-docs/assets/17_teacher_substitute.webp',
          appRoute: '/app/teacher-substitute-request',
          allowedRoles: [Role.TEACHER],
        },
        {
          title: 'Tài liệu giảng dạy',
          description: 'Kho tài liệu nội bộ để tải lên, chỉnh sửa và tái sử dụng giáo án hoặc file bài tập.',
          image: '/assets/teacher-docs/assets/18_teacher_materials.webp',
          appRoute: '/app/teaching-materials',
          allowedRoles: [Role.DIRECTOR, Role.OPS, Role.TEACHER],
        },
      ],
    },
    {
      title: 'Hỗ trợ, tài chính và phối hợp nội bộ',
      summary: 'Nhóm màn hình dùng để chốt dữ liệu lương, gửi yêu cầu hỗ trợ và liên lạc nội bộ.',
      items: [
        {
          title: 'Payroll preview',
          description: 'Đối chiếu các session đã dạy với trạng thái đủ điều kiện lương hoặc còn đang chờ xác nhận.',
          image: '/assets/teacher-docs/assets/19_teacher_payroll.webp',
          appRoute: '/app/payroll',
          allowedRoles: [Role.DIRECTOR, Role.ACCOUNTING, Role.OPS, Role.TEACHER],
        },
        {
          title: 'Ticket hỗ trợ',
          description: 'Kênh nội bộ để gửi yêu cầu hỗ trợ, theo dõi xử lý và trao đổi chi tiết với OPS hoặc các bộ phận liên quan.',
          image: '/assets/teacher-docs/assets/20_teacher_tickets.webp',
          appRoute: '/app/tickets',
          allowedRoles: [Role.DIRECTOR, Role.OPS, Role.ACCOUNTING, Role.TEACHER, Role.PARENT],
        },
        {
          title: 'Tin nhắn nội bộ',
          description: 'Khu vực chat nội bộ giữa giáo viên và các bộ phận để xử lý công việc nhanh.',
          image: '/assets/teacher-docs/assets/21_teacher_messages.webp',
          appRoute: '/app/messages',
          allowedRoles: [Role.DIRECTOR, Role.OPS, Role.ACCOUNTING, Role.TEACHER, Role.SALE, Role.PARENT],
        },
      ],
    },
  ];

  protected canOpenRoute(allowedRoles: Role[]): boolean {
    const currentRole = this.auth.userSignal()?.role as Role | undefined;
    return !!currentRole && allowedRoles.includes(currentRole);
  }
}
