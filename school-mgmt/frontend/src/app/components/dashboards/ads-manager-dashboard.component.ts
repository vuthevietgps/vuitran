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
          <p class="eyebrow">Ads Manager Workspace</p>
          <h2>Bắt đầu ngay — làm việc từ 3 màn hình chính</h2>
          <p>
            Role này được thiết kế để theo dõi nhóm quảng cáo, đọc hiệu quả theo lợi nhuận và
            chỉnh fanpage/chatbot mà không mở rộng sang các module vận hành khác.
          </p>
          <div class="hero-actions">
            <a routerLink="/app/ads-hub" class="primary">Mở Cẩm nang Ads</a>
            <a routerLink="/app/ads-management" class="ghost">Mở Ads Management</a>
            <a routerLink="/app/ads-analytics" class="ghost">Mở Ads Analytics</a>
          </div>
      </div>

      <div class="hero-metrics">
        <article class="metric-card">
          <span class="metric-label">Phạm vi quyền</span>
          <strong>3 module</strong>
          <p>Ads Management, Ads Analytics, Chatbot Settings</p>
        </article>
        <article class="metric-card">
          <span class="metric-label">Mục tiêu ngày</span>
          <strong>Theo dõi lợi nhuận</strong>
          <p>Không chỉ nhìn chi phí, mà cần đối chiếu lead, phụ huynh mới và cohort profit</p>
        </article>
        <article class="metric-card">
          <span class="metric-label">Nhịp thao tác</span>
          <strong>Quan sát → Phân tích → Tối ưu</strong>
          <p>Vào Ads Management để điều chỉnh, Analytics để quyết định, Chatbot để khoá luồng chat</p>
        </article>
      </div>
    </section>

    <section class="content-grid">
      <article class="panel">
        <h3>Checklist đầu ngày</h3>
        <ul>
          <li>Mở Cẩm nang Ads để nắm luồng quy trình và điểm kiểm soát trong ngày.</li>
          <li>Mở Ads Management để xem tài khoản, nhóm QC, chi phí và việc cần làm.</li>
          <li>Rà soát nhóm nào cần sửa budget, tracking key hoặc trạng thái.</li>
        </ul>
      </article>

      <article class="panel">
        <h3>Checklist giữa ngày</h3>
        <ul>
          <li>Mở Ads Analytics để đọc cohort, parent profit và xu hướng ROI.</li>
          <li>So sánh nhóm lãi, nhóm hoà vốn và nhóm đang lỗ trước khi đề xuất thay đổi.</li>
          <li>Ghi chú các nhóm cần theo dõi thêm trước khi chỉnh sửa lớn.</li>
        </ul>
      </article>

      <article class="panel">
        <h3>Checklist cuối ngày</h3>
        <ul>
          <li>Cập nhật fanpage hoặc chatbot settings nếu có thay đổi văn bản, token gắn hoặc ad account.</li>
          <li>Xác nhận nhóm đã đổi tracking key khớp với quy ước landing/chatbot.</li>
          <li>Mở Cẩm nang Ads để đối chiếu quy trình nếu cần onboard hoặc bàn giao.</li>
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
