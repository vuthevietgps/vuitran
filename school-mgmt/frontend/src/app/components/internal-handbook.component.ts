import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Role } from '../models/role.enum';
import { AuthService } from '../services/auth.service';
import { HANDBOOK_CONFIG, LEGACY_CONFIG } from './internal-handbook.configs';
import { DEFAULT_PLAYBOOK, ROLE_PLAYBOOKS } from './internal-handbook.playbooks';

@Component({
  selector: 'app-internal-handbook',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="handbook-page" *ngIf="config() as handbook" [attr.data-role]="currentRole() || 'UNKNOWN'" data-testid="internal-handbook-page">
      <section class="hero">
        <div class="hero-copy">
          <p class="eyebrow">Cẩm nang nội bộ</p>
          <h1>{{ handbook.title }}</h1>
          <p class="hero-subtitle">{{ handbook.subtitle }}</p>
          <p class="hero-text">{{ handbook.summary }}</p>

          <div class="hero-actions">
            <a class="btn btn-primary" [routerLink]="handbook.quickLinks[0].route" data-testid="handbook-primary-link">
              Mở màn hình ưu tiên
            </a>
            <a class="btn btn-secondary" *ngIf="handbook.deepDive" [routerLink]="handbook.deepDive.route" data-testid="handbook-deep-dive-link">
              {{ handbook.deepDive.label }}
            </a>
            <a class="btn btn-ghost" *ngIf="handbook.videos.length" [href]="handbook.videos[0].src" target="_blank" rel="noopener" data-testid="handbook-video-link">
              Xem video thao tác
            </a>
          </div>

          <div class="hero-metrics">
            <article class="metric-card">
              <span class="metric-label">{{ handbook.focusLabel }}</span>
              <strong>{{ handbook.focusValue }}</strong>
            </article>
            <article class="metric-card">
              <span class="metric-label">Vai trò hiện tại</span>
              <strong>{{ roleLabel(currentRole()) }}</strong>
            </article>
            <article class="metric-card">
              <span class="metric-label">Tư liệu đi kèm</span>
              <strong>{{ handbook.gallery.length }} ảnh • {{ handbook.videos.length }} video</strong>
            </article>
          </div>
        </div>

        <div class="hero-visual">
          <img [src]="handbook.heroImage" [alt]="handbook.heroAlt" loading="eager" />
        </div>
      </section>

      <section class="section">
        <div class="section-header">
          <div>
            <p class="section-kicker">Kịch bản chính</p>
            <h2>3 luồng thao tác cần nắm cho vai trò này</h2>
          </div>
        </div>

        <div class="scenario-grid">
          <article class="scenario-card" *ngFor="let scenario of handbook.scenarios">
            <div class="scenario-head">
              <h3>{{ scenario.title }}</h3>
              <a class="route-pill" *ngIf="scenario.route" [routerLink]="scenario.route">{{ scenario.route }}</a>
            </div>
            <p>{{ scenario.summary }}</p>
            <ul>
              <li *ngFor="let step of scenario.steps">{{ step }}</li>
            </ul>
          </article>
        </div>
      </section>

      <section class="section">
        <div class="section-header">
          <div>
            <p class="section-kicker">Giải thích chi tiết</p>
            <h2>Đi theo quy trình nào để thao tác đúng ngay từ đầu</h2>
            <p class="section-summary">{{ playbook().headline }}</p>
          </div>
        </div>

        <div class="workflow-grid">
          <article class="workflow-card" *ngFor="let stage of playbook().stages">
            <div class="workflow-head">
              <h3>{{ stage.title }}</h3>
              <a class="route-pill" *ngIf="stage.route" [routerLink]="stage.route">{{ stage.route }}</a>
            </div>
            <p>{{ stage.description }}</p>
            <ul>
              <li *ngFor="let step of stage.steps">{{ step }}</li>
            </ul>
            <div class="success-chip">Dấu hiệu làm đúng: {{ stage.successSignal }}</div>
          </article>
        </div>
      </section>

      <section class="section">
        <div class="section-header">
          <div>
            <p class="section-kicker">Ảnh minh họa</p>
            <h2>Gallery màn hình mẫu cho {{ roleLabel(currentRole()) }}</h2>
          </div>
        </div>

        <div class="gallery-grid" data-testid="handbook-gallery">
          <article class="gallery-card" *ngFor="let item of handbook.gallery; let index = index" [attr.data-testid]="'handbook-gallery-card-' + index">
            <img [src]="item.image" [alt]="item.title" loading="lazy" [attr.data-testid]="'handbook-gallery-image-' + index" />
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

      <section class="section">
        <div class="section-header">
          <div>
            <p class="section-kicker">Video thao tác</p>
            <h2>Video hướng dẫn quay từ môi trường demo thật</h2>
          </div>
        </div>

        <div class="video-grid" data-testid="handbook-videos">
          <article class="video-card" *ngFor="let video of handbook.videos; let index = index" [attr.data-testid]="'handbook-video-card-' + index">
            <video controls preload="metadata" [poster]="video.poster" [attr.data-testid]="'handbook-video-' + index">
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

      <section class="section dual-layout">
        <div class="panel">
          <p class="section-kicker">Lỗi thường gặp</p>
          <h2>Những chỗ người dùng hay nhầm khi thao tác</h2>
          <div class="pitfall-list">
            <article class="pitfall-card" *ngFor="let item of playbook().pitfalls">
              <h3>{{ item.title }}</h3>
              <p>{{ item.detail }}</p>
            </article>
          </div>
        </div>

        <div class="panel">
          <p class="section-kicker">Hỏi đáp nhanh</p>
          <h2>Giải thích rõ những thắc mắc thường gặp</h2>
          <div class="faq-list">
            <article class="faq-card" *ngFor="let item of playbook().faq">
              <h3>{{ item.question }}</h3>
              <p>{{ item.answer }}</p>
            </article>
          </div>
        </div>
      </section>

      <section class="section dual-layout">
        <div class="panel">
          <p class="section-kicker">Lối vào nhanh</p>
          <h2>Các màn hình cần dùng thường xuyên</h2>
          <div class="link-grid" data-testid="handbook-quick-links">
            <a class="link-card" *ngFor="let link of handbook.quickLinks; let index = index" [routerLink]="link.route" [attr.data-testid]="'handbook-quick-link-' + index">
              <strong>{{ link.label }}</strong>
              <span>{{ link.note }}</span>
              <code>{{ link.route }}</code>
            </a>
          </div>
        </div>

        <div class="panel">
          <p class="section-kicker">Lưu ý quyền</p>
          <h2>Những điểm cần nhớ khi đào tạo hoặc kiểm thử</h2>
          <ul class="guardrail-list">
            <li *ngFor="let note of handbook.guardrails">{{ note }}</li>
          </ul>

          <a class="deep-link" *ngIf="handbook.deepDive" [routerLink]="handbook.deepDive.route">
            {{ handbook.deepDive.note }}
          </a>
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
        radial-gradient(circle at top right, rgba(249, 115, 22, 0.12), transparent 18%),
        radial-gradient(circle at left center, rgba(13, 148, 136, 0.14), transparent 20%),
        linear-gradient(180deg, #f4efe6 0%, #f8f4ec 34%, #fcfbf7 100%);
      color: #132238;
      font-family: 'Trebuchet MS', 'Aptos', 'Segoe UI', sans-serif;
    }

    .handbook-page {
      display: grid;
      gap: 24px;
      max-width: 1480px;
      margin: 0 auto;
    }

    .hero,
    .section,
    .scenario-card,
    .gallery-card,
    .video-card,
    .metric-card,
    .panel,
    .link-card {
      box-shadow: 0 18px 48px rgba(15, 23, 42, 0.08);
    }

    .hero,
    .section {
      border-radius: 32px;
      border: 1px solid rgba(20, 33, 61, 0.08);
      background: rgba(255, 252, 247, 0.88);
      backdrop-filter: blur(10px);
    }

    .hero {
      display: grid;
      grid-template-columns: minmax(0, 1.1fr) minmax(340px, 0.9fr);
      gap: 24px;
      padding: 30px;
      overflow: hidden;
    }

    .hero-copy {
      display: grid;
      gap: 16px;
      align-content: start;
    }

    .eyebrow,
    .section-kicker,
    .metric-label {
      display: inline-flex;
      align-items: center;
      width: fit-content;
      padding: 8px 12px;
      border-radius: 999px;
      background: rgba(13, 148, 136, 0.12);
      color: #0f766e;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      font-size: 11px;
      font-weight: 800;
    }

    h1,
    h2,
    h3 {
      margin: 0;
      font-family: 'Aptos Display', 'Trebuchet MS', 'Segoe UI', sans-serif;
      letter-spacing: -0.03em;
    }

    h1 {
      font-size: clamp(34px, 5vw, 56px);
      line-height: 1.02;
    }

    h2 {
      font-size: clamp(28px, 3.2vw, 40px);
      line-height: 1.08;
    }

    h3 {
      font-size: 22px;
      line-height: 1.16;
    }

    .hero-subtitle {
      margin: 0;
      font-size: 18px;
      font-weight: 700;
      color: #9a3412;
      line-height: 1.55;
    }

    .hero-text,
    .scenario-card p,
    .workflow-card p,
    .gallery-copy p,
    .video-copy p,
    .link-card span,
    .guardrail-list,
    .section-summary,
    .pitfall-card p,
    .faq-card p {
      margin: 0;
      color: #475569;
      font-size: 15px;
      line-height: 1.68;
    }

    .hero-actions,
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
      text-decoration: none;
      font-size: 14px;
      font-weight: 700;
      transition: transform 160ms ease, box-shadow 160ms ease;
    }

    .btn:hover {
      transform: translateY(-1px);
    }

    .btn-primary {
      background: linear-gradient(135deg, #0f766e 0%, #115e59 100%);
      color: #f8fafc;
      box-shadow: 0 12px 24px rgba(15, 118, 110, 0.2);
    }

    .btn-secondary {
      background: #fff7ed;
      border-color: rgba(217, 119, 6, 0.2);
      color: #9a3412;
    }

    .btn-ghost {
      background: transparent;
      border-color: rgba(20, 33, 61, 0.12);
      color: #14213d;
    }

    .hero-metrics {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 14px;
    }

    .metric-card,
    .scenario-card,
    .gallery-card,
    .video-card,
    .panel,
    .link-card {
      border-radius: 24px;
      border: 1px solid rgba(20, 33, 61, 0.08);
      background: rgba(255, 255, 255, 0.94);
    }

    .metric-card {
      padding: 18px;
      display: grid;
      gap: 10px;
    }

    .metric-card strong {
      font-size: 18px;
      color: #14213d;
    }

    .hero-visual {
      position: relative;
      min-height: 100%;
      display: flex;
    }

    .hero-visual::before {
      content: '';
      position: absolute;
      inset: 18px 0 0 18px;
      border-radius: 28px;
      background: linear-gradient(145deg, rgba(217, 119, 6, 0.14), rgba(20, 184, 166, 0.14));
      filter: blur(6px);
    }

    .hero-visual img {
      position: relative;
      width: 100%;
      height: 100%;
      object-fit: cover;
      border-radius: 28px;
      border: 1px solid rgba(255, 255, 255, 0.74);
      display: block;
    }

    .section {
      padding: 26px;
      display: grid;
      gap: 18px;
    }

    .section-header {
      display: flex;
      align-items: end;
      justify-content: space-between;
      gap: 16px;
    }

    .scenario-grid,
    .workflow-grid,
    .gallery-grid,
    .video-grid,
    .link-grid {
      display: grid;
      gap: 16px;
    }

    .scenario-grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    .workflow-grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    .gallery-grid {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }

    .video-grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    .pitfall-list,
    .faq-list {
      display: grid;
      gap: 14px;
    }

    .pitfall-card,
    .faq-card {
      padding: 18px;
      border-radius: 20px;
      border: 1px solid rgba(20, 33, 61, 0.08);
      background: rgba(255, 255, 255, 0.94);
      display: grid;
      gap: 8px;
    }

    .scenario-card {
      padding: 22px;
      display: grid;
      gap: 12px;
    }

    .workflow-card {
      padding: 22px;
      display: grid;
      gap: 12px;
      border-radius: 24px;
      border: 1px solid rgba(20, 33, 61, 0.08);
      background: linear-gradient(180deg, rgba(255, 247, 237, 0.94) 0%, rgba(255, 255, 255, 0.96) 100%);
      box-shadow: 0 18px 48px rgba(15, 23, 42, 0.08);
    }

    .workflow-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      flex-wrap: wrap;
    }

    .scenario-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      flex-wrap: wrap;
    }

    .route-pill {
      display: inline-flex;
      align-items: center;
      width: fit-content;
      padding: 6px 10px;
      border-radius: 999px;
      background: #f1f5f9;
      color: #475569;
      text-decoration: none;
      font-size: 12px;
      font-weight: 700;
    }

    .success-chip {
      display: inline-flex;
      align-items: center;
      width: fit-content;
      padding: 8px 12px;
      border-radius: 999px;
      background: rgba(22, 163, 74, 0.12);
      color: #166534;
      font-size: 12px;
      font-weight: 700;
      line-height: 1.5;
    }

    ul {
      margin: 0;
      padding-left: 20px;
      display: grid;
      gap: 8px;
      color: #334155;
      font-size: 14px;
      line-height: 1.58;
    }

    li::marker {
      color: #d97706;
    }

    .gallery-card,
    .video-card {
      overflow: hidden;
    }

    .gallery-card {
      display: grid;
      grid-template-rows: 220px auto;
    }

    .gallery-card img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }

    .gallery-copy,
    .video-copy {
      padding: 18px;
      display: grid;
      gap: 10px;
    }

    .video-card video {
      width: 100%;
      display: block;
      aspect-ratio: 16 / 10;
      background: #0f172a;
    }

    .text-link,
    .deep-link {
      color: #0f766e;
      text-decoration: none;
      font-weight: 700;
    }

    .text-link:hover,
    .deep-link:hover {
      color: #115e59;
      text-decoration: underline;
    }

    .dual-layout {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 18px;
    }

    .panel {
      padding: 22px;
      display: grid;
      gap: 14px;
    }

    .link-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .link-card {
      display: grid;
      gap: 10px;
      padding: 18px;
      text-decoration: none;
      color: inherit;
      transition: transform 160ms ease, box-shadow 160ms ease;
    }

    .link-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 20px 50px rgba(15, 23, 42, 0.1);
    }

    .link-card strong {
      color: #0f172a;
      font-size: 18px;
    }

    .link-card code {
      width: fit-content;
      border-radius: 999px;
      background: #f1f5f9;
      padding: 6px 10px;
      color: #475569;
      font-size: 12px;
      font-weight: 700;
    }

    .guardrail-list {
      padding-left: 20px;
    }

    @media (max-width: 1320px) {
      .hero,
      .scenario-grid,
      .workflow-grid,
      .gallery-grid,
      .video-grid,
      .dual-layout,
      .link-grid {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 920px) {
      :host {
        padding: 16px;
      }

      .hero,
      .section {
        padding: 18px;
        border-radius: 24px;
      }

      .hero-metrics {
        grid-template-columns: 1fr;
      }

      .section-header {
        flex-direction: column;
        align-items: start;
      }

      .gallery-card {
        grid-template-rows: 190px auto;
      }
    }
  `],
})
export class InternalHandbookComponent {
  private readonly auth = inject(AuthService);

  protected readonly currentRole = computed(
    () => (this.auth.userSignal()?.role as Role | undefined) || Role.STAFF,
  );

  protected readonly config = computed(
    () => HANDBOOK_CONFIG[this.currentRole()] || LEGACY_CONFIG,
  );

  protected readonly playbook = computed(
    () => ROLE_PLAYBOOKS[this.currentRole()] || DEFAULT_PLAYBOOK,
  );

  protected roleLabel(role?: string): string {
    const labels: Record<string, string> = {
      DIRECTOR: 'Giám đốc',
      ACCOUNTING: 'Kế toán',
      OPS: 'Vận hành',
      ADSMANAGER: 'Ads manager',
      TEACHER: 'Giáo viên',
      PARENT: 'Phụ huynh',
      SALE: 'Sale',
      MANAGER: 'Quản lý cũ',
      HCNS: 'Hành chính cũ',
      PARTIME: 'Part-time cũ',
      STAFF: 'Nhân viên cũ',
    };
    return labels[role || ''] || (role || 'Không xác định');
  }
}
