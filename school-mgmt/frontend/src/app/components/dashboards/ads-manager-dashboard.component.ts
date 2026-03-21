import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-ads-manager-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <section class="hero">
      <div class="hero-copy">
        <p class="eyebrow">Ads manager workspace</p>
        <h2>Bat dau ngay lam viec tu 3 man hinh chinh</h2>
        <p>
          Role nay duoc thiet ke de theo doi nhom quang cao, doc hieu qua theo loi nhuan va
          chinh fanpage/chatbot ma khong mo rong sang cac module van hanh khac.
        </p>
        <div class="hero-actions">
          <a routerLink="/app/ads-management" class="primary">Mo Ads management</a>
          <a routerLink="/app/ads-analytics" class="ghost">Mo Ads analytics</a>
          <a routerLink="/app/chatbot-settings" class="ghost">Mo Chatbot settings</a>
        </div>
      </div>

      <div class="hero-metrics">
        <article class="metric-card">
          <span class="metric-label">Pham vi quyen</span>
          <strong>3 module</strong>
          <p>Ads management, Ads analytics, Chatbot settings</p>
        </article>
        <article class="metric-card">
          <span class="metric-label">Muc tieu ngay</span>
          <strong>Theo doi loi nhuan</strong>
          <p>Khong chi nhin spend, ma can doi chieu lead, PH moi va cohort profit</p>
        </article>
        <article class="metric-card">
          <span class="metric-label">Nhip thao tac</span>
          <strong>Quan sat → phan tich → toi uu</strong>
          <p>Vao management de dieu chinh, analytics de quyet dinh, chatbot de khoa luong chat</p>
        </article>
      </div>
    </section>

    <section class="content-grid">
      <article class="panel">
        <h3>Checklist dau ngay</h3>
        <ul>
          <li>Mo Ads management de xem tai khoan, nhom QC, chi phi va viec can lam.</li>
          <li>Rao soat nhom nao can sua budget, tracking key hoac trang thai.</li>
          <li>Kiem tra fanpage/chatbot nao dang bat AI, token nao dang duoc gan.</li>
        </ul>
      </article>

      <article class="panel">
        <h3>Checklist giua ngay</h3>
        <ul>
          <li>Mo Ads analytics de doc cohort, parent profit va xu huong ROI.</li>
          <li>So sanh nhom lai, nhom hoa von va nhom dang lo truoc khi de xuat thay doi.</li>
          <li>Ghi chu cac nhom can theo doi them truoc khi chinh sua lon.</li>
        </ul>
      </article>

      <article class="panel">
        <h3>Checklist cuoi ngay</h3>
        <ul>
          <li>Cap nhat fanpage hoac chatbot settings neu co thay doi van ban, token gan hoac ad account.</li>
          <li>Xac nhan nhom da doi tracking key khop voi cac quy uoc landing/chatbot.</li>
          <li>Mo Cam nang Ads de doi chieu quy trinh neu can onboard hoac ban giao.</li>
        </ul>
      </article>
    </section>
  `,
  styles: [`
    :host {
      display: block;
    }

    .hero {
      display: grid;
      grid-template-columns: minmax(0, 1.2fr) minmax(320px, 0.8fr);
      gap: 18px;
      padding: 24px;
      border-radius: 24px;
      background:
        radial-gradient(circle at top right, rgba(56, 189, 248, 0.18), transparent 24%),
        linear-gradient(135deg, #f8fafc 0%, #eff6ff 45%, #fff7ed 100%);
      border: 1px solid rgba(59, 130, 246, 0.12);
      box-shadow: 0 18px 40px rgba(15, 23, 42, 0.08);
      margin-bottom: 18px;
    }

    .hero-copy {
      display: grid;
      gap: 12px;
    }

    .eyebrow,
    .metric-label {
      width: fit-content;
      padding: 6px 10px;
      border-radius: 999px;
      background: rgba(14, 165, 233, 0.12);
      color: #0369a1;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    h2,
    h3 {
      margin: 0;
      color: #0f172a;
      letter-spacing: -0.03em;
    }

    h2 {
      font-size: clamp(28px, 4vw, 42px);
      line-height: 1.05;
    }

    h3 {
      font-size: 20px;
    }

    p {
      margin: 0;
      color: #475569;
      line-height: 1.65;
      font-size: 14px;
    }

    .hero-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }

    .primary,
    .ghost {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 42px;
      padding: 0 16px;
      border-radius: 999px;
      text-decoration: none;
      font-weight: 700;
      font-size: 14px;
    }

    .primary {
      background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%);
      color: #fff;
      box-shadow: 0 10px 20px rgba(3, 105, 161, 0.18);
    }

    .ghost {
      background: rgba(255, 255, 255, 0.88);
      color: #0f172a;
      border: 1px solid rgba(148, 163, 184, 0.35);
    }

    .hero-metrics {
      display: grid;
      gap: 12px;
    }

    .metric-card,
    .panel {
      padding: 18px;
      border-radius: 20px;
      background: rgba(255, 255, 255, 0.94);
      border: 1px solid rgba(148, 163, 184, 0.2);
      box-shadow: 0 14px 30px rgba(15, 23, 42, 0.06);
    }

    .metric-card {
      display: grid;
      gap: 8px;
    }

    .metric-card strong {
      color: #0f172a;
      font-size: 18px;
    }

    .content-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 16px;
    }

    .panel {
      display: grid;
      gap: 10px;
    }

    ul {
      margin: 0;
      padding-left: 18px;
      display: grid;
      gap: 8px;
      color: #334155;
      line-height: 1.6;
      font-size: 14px;
    }

    li::marker {
      color: #0284c7;
    }

    @media (max-width: 1100px) {
      .hero,
      .content-grid {
        grid-template-columns: 1fr;
      }
    }
  `],
})
export class AdsManagerDashboardComponent {}
