import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { Role } from '../models/role.enum';

interface AdWorkflowStep {
  step: string;
  title: string;
  who: string;
  summary: string;
  checklist: string[];
  warning?: string;
  note: string;
  route?: string;
  queryParams?: Record<string, string>;
  allowedRoles?: Role[];
  color: 'sky' | 'indigo' | 'violet' | 'teal' | 'rose' | 'slate';
}

interface QuickLink {
  title: string;
  description: string;
  route: string;
  queryParams?: Record<string, string>;
  badge: string;
}

interface PermissionRow {
  action: string;
  adsmanager: boolean;
  director: boolean;
  ops: boolean;
}

interface FAQItem {
  question: string;
  answer: string;
}

const INTERNAL_IMAGE_BASE = '/assets/internal-handbook/images';
const adsImage = (name: string) => `${INTERNAL_IMAGE_BASE}/${name}.webp`;

@Component({
  selector: 'app-ads-guide-landing',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="ads-hub">

      <!-- ══ HERO ══════════════════════════════════════════════════════ -->
      <section class="hero-card">
        <div class="hero-copy">
          <span class="eyebrow">Ads Hub · Quản lý quảng cáo</span>
          <h1>Một luồng vận hành — ba màn hình cốt lõi</h1>
          <p class="hero-text">
            Trang này là điểm khởi đầu cho mọi Ads Manager khi onboarding và làm việc hằng ngày.
            Luồng chính: thiết lập tài khoản QC → tạo nhóm &amp; tracking keys → cấu hình landing page với pixel →
            theo dõi leads → phân tích profit tại <strong>/app/ads-analytics</strong> → tối ưu chatbot/fanpage.
          </p>
          <div class="hero-actions">
            <a class="btn btn-primary" href="#pipeline">Xem luồng quy trình đầy đủ</a>
            <a class="btn btn-secondary" [routerLink]="'/app/ads-management'">Mở Ads Management</a>
            <a class="btn btn-ghost" [routerLink]="'/app/ads-analytics'">Mở Ads Analytics</a>
          </div>
          <div class="hero-rules">
            <div class="rule-item rule-sky">
              <span class="rule-label">Nguyên tắc vận hành</span>
              <span>Không sửa nhóm quảng cáo khi chưa đối chiếu tracking keys, nguồn lead và quy tắc attribution đang dùng</span>
            </div>
            <div class="rule-item rule-indigo">
              <span class="rule-label">Phạm vi quyền hạn</span>
              <span>Ads Manager được thao tác Ads Management, Ads Analytics và Chatbot Settings — không mở rộng sang tài chính, audit log hay user management</span>
            </div>
            <div class="rule-item rule-slate">
              <span class="rule-label">Token &amp; tài khoản nhạy cảm</span>
              <span>Token API và cấp phép tài khoản quảng cáo do Director quản lý — Ads Manager chỉ sử dụng token và fanpage đã được cấp trong hệ thống</span>
            </div>
          </div>
        </div>
        <div class="hero-visual">
          <img [src]="heroImage" alt="Tổng quan Ads Hub" loading="eager" />
        </div>
      </section>

      <!-- ══ PIPELINE ═══════════════════════════════════════════════════ -->
      <section class="section section-pipeline" id="pipeline">
        <div class="section-heading">
          <div>
            <span class="section-kicker">Tổng quan luồng</span>
            <h2>Một luồng vận hành — sáu điểm kiểm soát</h2>
            <p class="section-summary">
              Từ thiết lập tài khoản đến phân tích profit — mỗi điểm trong luồng có màn hình riêng và
              quy tắc rõ ràng. Làm đúng thứ tự để tracking chính xác và lead không bị mất attribution.
            </p>
          </div>
        </div>

        <div class="flow-block">
          <div class="flow-label flow-label-primary">Luồng vận hành ads đầy đủ — từ thiết lập đến tối ưu</div>
          <div class="pipeline">
            <div class="pipeline-step p-sky">
              <span class="p-num">01</span>
              <span class="p-label">Tài khoản QC</span>
              <span class="p-sub">/app/ads-management</span>
            </div>
            <span class="pipeline-arrow">›</span>
            <div class="pipeline-step p-indigo">
              <span class="p-num">02</span>
              <span class="p-label">Nhóm &amp; Tracking</span>
              <span class="p-sub">Ad Groups · Keys</span>
            </div>
            <span class="pipeline-arrow">›</span>
            <div class="pipeline-step p-violet">
              <span class="p-num">03</span>
              <span class="p-label">Landing Page + Pixel</span>
              <span class="p-sub">/app/landing-pages</span>
            </div>
            <span class="pipeline-arrow">›</span>
            <div class="pipeline-step p-teal">
              <span class="p-num">04</span>
              <span class="p-label">Leads từ QC</span>
              <span class="p-sub">/app/leads</span>
            </div>
            <span class="pipeline-arrow">›</span>
            <div class="pipeline-step p-rose">
              <span class="p-num">05</span>
              <span class="p-label">Phân tích Profit</span>
              <span class="p-sub">/app/ads-analytics</span>
            </div>
            <span class="pipeline-arrow">›</span>
            <div class="pipeline-step p-slate">
              <span class="p-num">06</span>
              <span class="p-label">Chatbot &amp; Fanpage</span>
              <span class="p-sub">/app/chatbot-settings</span>
            </div>
          </div>
          <p class="flow-note">
            Luồng này lặp lại hằng ngày: quan sát → phân tích → điều chỉnh. Mỗi vòng lặp cần
            đối chiếu số liệu trước khi hành động — không chỉnh nhóm dựa vào cảm tính.
          </p>
        </div>

        <!-- Nhịp làm việc theo ngày -->
        <div class="daily-rhythm">
          <div class="rhythm-card rhythm-morning">
            <span class="rhythm-label">Đầu ngày</span>
            <h3>Rà soát &amp; xử lý ngay</h3>
            <ul>
              <li>Mở Ads Management — kiểm tra tài khoản, nhóm đang chạy, chi phí và việc cần làm.</li>
              <li>Xem tab <em>Việc cần làm</em> để khoanh vùng nhóm cần xử lý ưu tiên.</li>
              <li>Kiểm tra leads mới từ đêm hôm trước — phối hợp với Sale nếu cần chuyển đổi nhanh.</li>
            </ul>
          </div>
          <div class="rhythm-card rhythm-midday">
            <span class="rhythm-label">Giữa ngày</span>
            <h3>Đọc profit &amp; đề xuất</h3>
            <ul>
              <li>Mở Ads Analytics — lọc theo khoảng ngày, platform và nhóm cần theo dõi.</li>
              <li>So sánh nhóm đang lãi, hòa vốn và nhóm đang lỗ trước khi đề xuất thay đổi.</li>
              <li>Dùng parent-profit và realized cohort để giải thích quyết định điều chỉnh ngân sách.</li>
            </ul>
          </div>
          <div class="rhythm-card rhythm-evening">
            <span class="rhythm-label">Cuối ngày</span>
            <h3>Đồng bộ chatbot &amp; fanpage</h3>
            <ul>
              <li>Cập nhật fanpage/chatbot nếu có thay đổi văn bản, token hoặc ad account gắn.</li>
              <li>Xác nhận nhóm đã đổi tracking keys khớp với quy ước landing page/chatbot.</li>
              <li>Ghi chú kết quả ngày và kế hoạch hành động cho ngày mai.</li>
            </ul>
          </div>
        </div>
      </section>

      <!-- ══ WORKFLOW ════════════════════════════════════════════════════ -->
      <section class="section" id="workflow">
        <div class="section-heading">
          <div>
            <span class="section-kicker">Chi tiết từng bước</span>
            <h2>6 bước vận hành ads từ đầu đến cuối</h2>
            <p class="section-summary">
              Áp dụng khi thiết lập chiến dịch mới hoặc onboarding ads manager. Làm đúng thứ tự —
              đúng người phụ trách — đúng màn hình. Không được bỏ qua bất kỳ mốc tracking nào.
            </p>
          </div>
        </div>

        <div class="workflow-grid" id="workflow-steps">
          <article
            class="workflow-card"
            *ngFor="let step of workflowSteps"
            [attr.data-color]="step.color">
            <div class="wf-header">
              <div class="wf-header-top">
                <span class="step-badge">Bước {{ step.step }}</span>
                <span class="who-badge">{{ step.who }}</span>
              </div>
              <h3>{{ step.title }}</h3>
              <p class="wf-summary">{{ step.summary }}</p>
            </div>
            <div class="wf-checklist">
              <p class="checklist-label">Checklist thực hiện</p>
              <ul>
                <li *ngFor="let item of step.checklist">{{ item }}</li>
              </ul>
            </div>
            <div class="wf-warning" *ngIf="step.warning">
              <span class="warn-icon">⚠</span>
              {{ step.warning }}
            </div>
            <div class="wf-note">{{ step.note }}</div>
            <a
              class="wf-action-btn"
              *ngIf="step.route && canOpenRoute(step.allowedRoles || [])"
              [routerLink]="step.route"
              [queryParams]="step.queryParams">
              Mở màn hình →
            </a>
          </article>
        </div>
      </section>

      <!-- ══ DECISION GATE ══════════════════════════════════════════════ -->
      <section class="section section-gate">
        <div class="section-heading">
          <div>
            <span class="section-kicker">Điểm quyết định ngân sách</span>
            <h2>Chỉ điều chỉnh nhóm khi đủ dữ liệu profit</h2>
            <p class="section-summary">
              Đây là rule bắt buộc trước mọi quyết định tăng/giảm budget hoặc tắt nhóm.
              Không hành động dựa trên chi phí đơn thuần — phải nhìn vào profit tổng hợp.
            </p>
          </div>
        </div>
        <div class="gate-grid">
          <div class="gate-card gate-green">
            <span class="gate-icon">✓</span>
            <h3>Nhóm đang lãi thực sự</h3>
            <p>Cohort profit dương và ROI ≥ ngưỡng mục tiêu đã thiết lập. Leads đã chuyển đổi
            thành phụ huynh thanh toán. Có thể tăng budget có kiểm soát.</p>
            <a class="gate-link" [routerLink]="'/app/ads-analytics'">Xem Cohort Profit →</a>
          </div>
          <div class="gate-card gate-amber">
            <span class="gate-icon">◐</span>
            <h3>Nhóm hòa vốn — cần theo dõi</h3>
            <p>Profit xấp xỉ 0 hoặc ROI thấp hơn mục tiêu. Chưa đủ dữ liệu để kết luận. Giữ
            ngân sách hiện tại, theo dõi thêm 3–5 ngày trước khi quyết định.</p>
            <a class="gate-link" [routerLink]="'/app/ads-analytics'">Xem Parent Profit →</a>
          </div>
          <div class="gate-card gate-red">
            <span class="gate-icon">✗</span>
            <h3>Nhóm lỗ — Dừng hoặc điều chỉnh</h3>
            <p>Cohort profit âm và không có dấu hiệu phục hồi. Tắt nhóm hoặc giảm budget đáng kể.
            Ghi chú nguyên nhân và đề xuất thay đổi để Director phê duyệt nếu cần.</p>
          </div>
        </div>
      </section>

      <!-- ══ KEY SCREENS ════════════════════════════════════════════════ -->
      <section class="section">
        <div class="section-heading">
          <div>
            <span class="section-kicker">Ba màn hình cốt lõi</span>
            <h2>Hiểu rõ từng màn hình trước khi thao tác</h2>
            <p class="section-summary">
              Mỗi màn hình có phạm vi riêng. Không dùng sai màn hình cho sai mục đích.
            </p>
          </div>
        </div>
        <div class="screen-grid">
          <article class="screen-card screen-ads">
            <div class="screen-badge">Ads Management</div>
            <h3>Quản lý tài khoản, nhóm và chi phí</h3>
            <p>Nơi thiết lập tài khoản quảng cáo (Facebook/Google/TikTok), tạo nhóm QC, nhập
            tracking keys, xem chi phí và danh sách việc cần làm theo ngày.</p>
            <ul>
              <li>Thêm/sửa ad account và trạng thái</li>
              <li>Tạo/cập nhật ad group và tracking keys</li>
              <li>Nhập chi phí quảng cáo thực tế</li>
              <li>Xem tab <em>Việc cần làm</em> mỗi sáng</li>
            </ul>
            <a class="screen-link" [routerLink]="'/app/ads-management'">Mở Ads Management →</a>
          </article>
          <article class="screen-card screen-analytics">
            <div class="screen-badge">Ads Analytics</div>
            <h3>Phân tích profit theo cohort và nhóm</h3>
            <p>Nơi đọc hiệu quả thực sự của từng nhóm QC: cohort profit (phụ huynh chuyển đổi),
            realized profit (doanh thu đã thu), ROI và xu hướng theo thời gian.</p>
            <ul>
              <li>Lọc theo platform, nhóm QC và khoảng thời gian</li>
              <li>So sánh nhóm lãi, hòa vốn và lỗ</li>
              <li>Đọc parent-profit để hiểu giá trị lâu dài</li>
              <li>Dùng dữ liệu này làm căn cứ điều chỉnh budget</li>
            </ul>
            <a class="screen-link" [routerLink]="'/app/ads-analytics'">Mở Ads Analytics →</a>
          </article>
          <article class="screen-card screen-chatbot">
            <div class="screen-badge">Chatbot Settings</div>
            <h3>Cài đặt fanpage và AI auto-reply</h3>
            <p>Nơi quản lý fanpage đang được gắn với ad account nào, token OpenAI nào đang dùng,
            AI auto-reply có bật không và cấu hình luồng hội thoại tự động.</p>
            <ul>
              <li>Xem và cập nhật fanpage → ad account mapping</li>
              <li>Quản lý token OpenAI đã được cấp</li>
              <li>Bật/tắt AI auto-reply theo fanpage</li>
              <li>Sau khi đổi, quay lại Ads Management đối chiếu tracking</li>
            </ul>
            <a class="screen-link" [routerLink]="'/app/chatbot-settings'">Mở Chatbot Settings →</a>
          </article>
        </div>
      </section>

      <!-- ══ PERMISSIONS ════════════════════════════════════════════════ -->
      <section class="section">
        <div class="section-heading">
          <div>
            <span class="section-kicker">Phân quyền</span>
            <h2>Ai được làm gì trên hệ thống quảng cáo</h2>
          </div>
        </div>
        <div class="perm-table">
          <div class="perm-header">
            <span>Thao tác</span>
            <span>Ads Manager</span>
            <span>Director</span>
            <span>OPS</span>
          </div>
          <div class="perm-row" *ngFor="let row of permissions; let odd = odd" [class.perm-row-alt]="odd">
            <span class="perm-action">{{ row.action }}</span>
            <span [class]="row.adsmanager ? 'perm-yes' : 'perm-no'">{{ row.adsmanager ? '✓' : '—' }}</span>
            <span [class]="row.director ? 'perm-yes' : 'perm-no'">{{ row.director ? '✓' : '—' }}</span>
            <span [class]="row.ops ? 'perm-yes' : 'perm-no'">{{ row.ops ? '✓' : '—' }}</span>
          </div>
        </div>
      </section>

      <!-- ══ QUICK LINKS + FAQ ══════════════════════════════════════════ -->
      <section class="section dual-layout">
        <div class="panel">
          <span class="section-kicker">Truy cập nhanh</span>
          <h2>Màn hình cần mở thường xuyên</h2>
          <div class="link-list">
            <a
              class="link-card"
              *ngFor="let link of quickLinks"
              [routerLink]="link.route"
              [queryParams]="link.queryParams">
              <span class="link-badge">{{ link.badge }}</span>
              <div class="link-body">
                <strong>{{ link.title }}</strong>
                <span>{{ link.description }}</span>
              </div>
              <span class="link-arrow">→</span>
            </a>
          </div>
        </div>

        <div class="panel">
          <span class="section-kicker">Hỏi đáp nhanh</span>
          <h2>Câu hỏi thường gặp khi onboarding</h2>
          <div class="faq-list">
            <article class="faq-card" *ngFor="let item of faqs">
              <h3>{{ item.question }}</h3>
              <p>{{ item.answer }}</p>
            </article>
          </div>
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
        radial-gradient(circle at top right, rgba(56, 189, 248, 0.14), transparent 22%),
        radial-gradient(circle at bottom left, rgba(99, 102, 241, 0.11), transparent 24%),
        linear-gradient(180deg, #f0f5ff 0%, #f5f3ff 40%, #fafafe 100%);
      color: #14213d;
      font-family: 'Be Vietnam Pro', 'Segoe UI', sans-serif;
    }

    .ads-hub {
      display: grid;
      gap: 22px;
      max-width: 1480px;
      margin: 0 auto;
      animation: page-enter 380ms ease-out;
    }

    /* ── shared card base ──────────────────────────────────────────── */
    .hero-card,
    .section,
    .workflow-card,
    .gate-card,
    .panel,
    .faq-card,
    .link-card,
    .screen-card {
      box-shadow: 0 14px 40px rgba(15, 23, 42, 0.07);
    }

    .hero-card,
    .section {
      border: 1px solid rgba(99, 102, 241, 0.10);
      border-radius: 30px;
      background: rgba(250, 250, 255, 0.92);
      backdrop-filter: blur(12px);
    }

    /* ── hero ─────────────────────────────────────────────────────── */
    .hero-card {
      display: grid;
      grid-template-columns: minmax(0, 1.2fr) minmax(320px, 0.8fr);
      gap: 28px;
      padding: 32px;
      overflow: hidden;
      background:
        radial-gradient(circle at top right, rgba(56,189,248,0.10), transparent 32%),
        rgba(250, 250, 255, 0.94);
    }

    .hero-copy {
      display: grid;
      gap: 18px;
      align-content: start;
    }

    .eyebrow,
    .section-kicker {
      display: inline-flex;
      align-items: center;
      width: fit-content;
      padding: 7px 13px;
      border-radius: 999px;
      background: rgba(56, 189, 248, 0.13);
      color: #0369a1;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      font-size: 11px;
      font-weight: 800;
    }

    h1, h2, h3 { margin: 0; font-family: 'Be Vietnam Pro', 'Segoe UI', sans-serif; letter-spacing: -0.03em; }
    h1 { font-size: clamp(32px, 4.5vw, 54px); line-height: 1.03; color: #0c1a3a; }
    h2 { font-size: clamp(26px, 3.2vw, 38px); line-height: 1.1; color: #0c1a3a; }
    h3 { font-size: 20px; line-height: 1.2; color: #0c1a3a; }

    .hero-text,
    .section-summary,
    .wf-summary,
    .wf-note,
    .gate-card p,
    .faq-card p,
    .link-card span,
    .screen-card p {
      margin: 0;
      font-size: 15px;
      color: #334155;
      line-height: 1.65;
    }

    /* hero actions */
    .hero-actions {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }

    .btn {
      display: inline-flex;
      align-items: center;
      padding: 11px 22px;
      border-radius: 999px;
      font-size: 14px;
      font-weight: 700;
      text-decoration: none;
      transition: all 160ms ease;
    }

    .btn-primary  { background: #0c1a3a; color: #e0f2fe; }
    .btn-primary:hover { background: #0369a1; }
    .btn-secondary { background: rgba(3,105,161,0.10); color: #0369a1; border: 1px solid rgba(3,105,161,0.22); }
    .btn-secondary:hover { background: rgba(3,105,161,0.18); }
    .btn-ghost { background: transparent; color: #475569; border: 1px solid rgba(20,33,61,0.14); }
    .btn-ghost:hover { background: rgba(20,33,61,0.06); }

    /* hero rules */
    .hero-rules {
      display: grid;
      gap: 10px;
    }

    .rule-item {
      display: flex;
      align-items: start;
      gap: 12px;
      padding: 14px 16px;
      border-radius: 18px;
      border: 1px solid transparent;
      font-size: 14px;
      line-height: 1.6;
    }

    .rule-label {
      flex-shrink: 0;
      padding: 4px 10px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }

    .rule-sky    { background: rgba(56,189,248,0.08); border-color: rgba(56,189,248,0.22); color: #0c4a6e; }
    .rule-sky .rule-label { background: rgba(56,189,248,0.18); color: #0369a1; }
    .rule-indigo { background: rgba(99,102,241,0.08); border-color: rgba(99,102,241,0.20); color: #1e1b4b; }
    .rule-indigo .rule-label { background: rgba(99,102,241,0.15); color: #4338ca; }
    .rule-slate  { background: rgba(20,33,61,0.05); border-color: rgba(20,33,61,0.10); color: #334155; }
    .rule-slate .rule-label { background: rgba(20,33,61,0.08); color: #475569; }

    /* hero visual */
    .hero-visual {
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 24px;
      overflow: hidden;
      background: rgba(224,242,254,0.4);
      border: 1px solid rgba(56,189,248,0.18);
    }

    .hero-visual img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      border-radius: 24px;
    }

    /* ── section base ─────────────────────────────────────────────── */
    .section {
      padding: 28px 32px;
      display: grid;
      gap: 20px;
    }

    .section-heading {
      display: flex;
      justify-content: space-between;
      align-items: start;
      gap: 16px;
    }

    .section-heading > div { display: grid; gap: 10px; }

    /* ── pipeline ─────────────────────────────────────────────────── */
    .section-pipeline { background: linear-gradient(160deg, rgba(240,245,255,0.95), rgba(250,250,255,0.97)); }

    .flow-block {
      display: grid;
      gap: 14px;
    }

    .flow-label {
      display: inline-flex;
      align-items: center;
      padding: 8px 16px;
      border-radius: 999px;
      font-size: 13px;
      font-weight: 700;
      width: fit-content;
    }

    .flow-label-primary {
      background: rgba(3,105,161,0.10);
      color: #0369a1;
      border: 1px solid rgba(3,105,161,0.20);
    }

    .flow-note {
      margin: 0;
      font-size: 14px;
      color: #475569;
      line-height: 1.65;
      padding: 12px 16px;
      background: rgba(99,102,241,0.06);
      border-radius: 16px;
      border-left: 3px solid rgba(99,102,241,0.35);
    }

    .pipeline {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
    }

    .pipeline-step {
      display: grid;
      align-items: center;
      justify-items: center;
      gap: 4px;
      padding: 14px 18px;
      border-radius: 20px;
      border: 1px solid transparent;
      min-width: 120px;
      text-align: center;
    }

    .p-num {
      font-size: 22px;
      font-weight: 900;
      letter-spacing: -0.04em;
      font-family: 'Be Vietnam Pro', 'Segoe UI', sans-serif;
    }

    .p-label {
      font-size: 13px;
      font-weight: 700;
      line-height: 1.3;
    }

    .p-sub {
      font-size: 11px;
      opacity: 0.65;
      font-family: monospace;
    }

    .pipeline-arrow {
      font-size: 28px;
      color: #94a3b8;
      font-weight: 300;
      flex-shrink: 0;
    }

    .p-sky    { background: linear-gradient(160deg,#e0f2fe,#f0f9ff); border-color: rgba(14,165,233,0.25); color: #0c4a6e; }
    .p-indigo { background: linear-gradient(160deg,#eef2ff,#f5f3ff); border-color: rgba(99,102,241,0.22); color: #1e1b4b; }
    .p-violet { background: linear-gradient(160deg,#f5f3ff,#faf5ff); border-color: rgba(139,92,246,0.20); color: #4c1d95; }
    .p-teal   { background: linear-gradient(160deg,#ecfdf5,#f0fdf9); border-color: rgba(20,184,166,0.22); color: #134e4a; }
    .p-rose   { background: linear-gradient(160deg,#fff1f2,#fff5f5); border-color: rgba(225,29,72,0.18); color: #9f1239; }
    .p-slate  { background: linear-gradient(160deg,#f8fafc,#f1f5f9); border-color: rgba(20,33,61,0.12); color: #1e293b; }

    /* ── daily rhythm ─────────────────────────────────────────────── */
    .daily-rhythm {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 14px;
    }

    .rhythm-card {
      padding: 20px 22px;
      border-radius: 22px;
      border: 1px solid transparent;
      display: grid;
      gap: 10px;
      align-content: start;
    }

    .rhythm-label {
      display: inline-flex;
      padding: 5px 11px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.07em;
      width: fit-content;
    }

    .rhythm-morning { background: linear-gradient(160deg,#fefce8,#fef9c3); border-color: rgba(234,179,8,0.25); }
    .rhythm-morning .rhythm-label { background: rgba(234,179,8,0.20); color: #713f12; }
    .rhythm-morning h3 { color: #78350f; font-size: 16px; }
    .rhythm-midday  { background: linear-gradient(160deg,#eff6ff,#dbeafe); border-color: rgba(59,130,246,0.22); }
    .rhythm-midday .rhythm-label { background: rgba(59,130,246,0.15); color: #1e3a8a; }
    .rhythm-midday h3 { color: #1e3a8a; font-size: 16px; }
    .rhythm-evening { background: linear-gradient(160deg,#f5f3ff,#ede9fe); border-color: rgba(139,92,246,0.20); }
    .rhythm-evening .rhythm-label { background: rgba(139,92,246,0.15); color: #4c1d95; }
    .rhythm-evening h3 { color: #4c1d95; font-size: 16px; }

    .rhythm-card ul {
      margin: 0;
      padding-left: 18px;
      display: grid;
      gap: 7px;
      color: #334155;
      font-size: 13.5px;
      line-height: 1.6;
    }

    /* ── workflow ─────────────────────────────────────────────────── */
    .workflow-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 16px;
    }

    .workflow-card:last-child:nth-child(odd) {
      grid-column: 1 / -1;
    }

    .workflow-card {
      padding: 24px;
      display: grid;
      gap: 16px;
      border-radius: 24px;
      border: 1px solid rgba(99, 102, 241, 0.10);
      background: rgba(250,250,255,0.96);
      align-content: start;
    }

    .workflow-card[data-color='sky']    { background: linear-gradient(160deg, rgba(224,242,254,0.98), rgba(255,255,255,0.99)); }
    .workflow-card[data-color='indigo'] { background: linear-gradient(160deg, rgba(238,242,255,0.98), rgba(255,255,255,0.99)); }
    .workflow-card[data-color='violet'] { background: linear-gradient(160deg, rgba(245,243,255,0.98), rgba(255,255,255,0.99)); }
    .workflow-card[data-color='teal']   { background: linear-gradient(160deg, rgba(236,253,245,0.98), rgba(255,255,255,0.99)); }
    .workflow-card[data-color='rose']   { background: linear-gradient(160deg, rgba(255,241,242,0.98), rgba(255,255,255,0.99)); }
    .workflow-card[data-color='slate']  { background: linear-gradient(160deg, rgba(248,250,252,0.98), rgba(255,255,255,0.99)); }

    .wf-header { display: grid; gap: 8px; }

    .wf-header-top {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }

    .step-badge {
      display: inline-flex;
      align-items: center;
      padding: 5px 12px;
      border-radius: 999px;
      background: rgba(3,105,161,0.12);
      color: #0369a1;
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.07em;
    }

    .who-badge {
      display: inline-flex;
      align-items: center;
      padding: 5px 12px;
      border-radius: 999px;
      background: rgba(20,33,61,0.06);
      color: #475569;
      font-size: 11px;
      font-weight: 700;
    }

    .wf-checklist { display: grid; gap: 8px; }

    .checklist-label {
      margin: 0;
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.07em;
      color: #64748b;
    }

    ul {
      margin: 0;
      padding-left: 20px;
      display: grid;
      gap: 8px;
      color: #334155;
      line-height: 1.6;
      font-size: 14px;
    }

    li::marker { color: #0369a1; }

    .wf-warning {
      display: flex;
      align-items: start;
      gap: 8px;
      padding: 12px 14px;
      border-radius: 14px;
      background: rgba(239,68,68,0.07);
      color: #991b1b;
      font-size: 14px;
      font-weight: 600;
      line-height: 1.55;
    }

    .warn-icon { flex-shrink: 0; }

    .wf-note {
      padding: 12px 16px;
      border-radius: 16px;
      background: rgba(3,105,161,0.08);
      color: #0369a1;
      font-size: 14px;
      font-weight: 700;
      line-height: 1.55;
    }

    .wf-action-btn {
      display: inline-flex;
      align-items: center;
      align-self: start;
      padding: 8px 16px;
      border-radius: 999px;
      background: #0c1a3a;
      color: #e0f2fe;
      font-size: 13px;
      font-weight: 700;
      text-decoration: none;
      transition: background 160ms ease;
    }

    .wf-action-btn:hover { background: #0369a1; }

    /* ── gate ─────────────────────────────────────────────────────── */
    .section-gate {
      background: linear-gradient(160deg, rgba(240,245,255,0.92), rgba(250,250,255,0.97));
    }

    .gate-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 16px;
    }

    .gate-card {
      padding: 22px;
      border-radius: 22px;
      border: 1px solid transparent;
      display: grid;
      gap: 10px;
      align-content: start;
    }

    .gate-icon { font-size: 26px; line-height: 1; }

    .gate-green { background: linear-gradient(160deg,#ecfdf5,#f0fdf9); border-color: rgba(16,185,129,0.22); }
    .gate-green .gate-icon { color: #059669; }
    .gate-amber { background: linear-gradient(160deg,#fffbeb,#fefce8); border-color: rgba(217,119,6,0.20); }
    .gate-amber .gate-icon { color: #b45309; }
    .gate-red   { background: linear-gradient(160deg,#fff1f2,#fff5f5); border-color: rgba(225,29,72,0.18); }
    .gate-red   .gate-icon { color: #e11d48; }

    .gate-link {
      display: inline-flex;
      align-items: center;
      color: #0369a1;
      font-size: 14px;
      font-weight: 700;
      text-decoration: none;
    }

    .gate-link:hover { text-decoration: underline; }

    /* ── key screens ──────────────────────────────────────────────── */
    .screen-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 16px;
    }

    .screen-card {
      padding: 22px;
      border-radius: 22px;
      border: 1px solid transparent;
      display: grid;
      gap: 12px;
      align-content: start;
    }

    .screen-badge {
      display: inline-flex;
      align-items: center;
      padding: 5px 12px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 900;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      width: fit-content;
    }

    .screen-ads {
      background: linear-gradient(160deg,#e0f2fe,#f0f9ff);
      border-color: rgba(14,165,233,0.22);
    }

    .screen-ads .screen-badge { background: rgba(14,165,233,0.18); color: #0c4a6e; }

    .screen-analytics {
      background: linear-gradient(160deg,#eef2ff,#f5f3ff);
      border-color: rgba(99,102,241,0.22);
    }

    .screen-analytics .screen-badge { background: rgba(99,102,241,0.15); color: #3730a3; }

    .screen-chatbot {
      background: linear-gradient(160deg,#f5f3ff,#fdf4ff);
      border-color: rgba(168,85,247,0.18);
    }

    .screen-chatbot .screen-badge { background: rgba(168,85,247,0.13); color: #6b21a8; }

    .screen-card ul {
      margin: 0;
      padding-left: 18px;
      display: grid;
      gap: 6px;
      color: #374151;
      font-size: 13.5px;
      line-height: 1.6;
    }

    .screen-link {
      display: inline-flex;
      align-items: center;
      color: #0369a1;
      font-size: 14px;
      font-weight: 700;
      text-decoration: none;
      margin-top: 4px;
    }

    .screen-link:hover { text-decoration: underline; }

    /* ── permissions table ────────────────────────────────────────── */
    .perm-table {
      border-radius: 20px;
      overflow: hidden;
      border: 1px solid rgba(99,102,241,0.12);
    }

    .perm-header,
    .perm-row {
      display: grid;
      grid-template-columns: 2fr 1fr 1fr 1fr;
      align-items: center;
      gap: 0;
    }

    .perm-header {
      background: #0c1a3a;
      color: #bfdbfe;
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      padding: 12px 20px;
    }

    .perm-row {
      padding: 12px 20px;
      background: rgba(255,255,255,0.95);
      border-top: 1px solid rgba(99,102,241,0.07);
      font-size: 14px;
    }

    .perm-row-alt { background: rgba(248,250,255,0.96); }

    .perm-action { color: #1e293b; font-weight: 500; }
    .perm-yes { color: #059669; font-weight: 800; font-size: 16px; }
    .perm-no  { color: #94a3b8; font-size: 15px; }

    /* ── dual layout (quick links + faq) ─────────────────────────── */
    .dual-layout {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 18px;
      padding: 0 !important;
      background: transparent !important;
      border: none !important;
      box-shadow: none !important;
      backdrop-filter: none !important;
    }

    .panel {
      padding: 24px;
      display: grid;
      gap: 16px;
      align-content: start;
      border-radius: 24px;
      border: 1px solid rgba(99,102,241,0.10);
      background: rgba(250,250,255,0.96);
    }

    .link-list { display: grid; gap: 10px; }

    .link-card {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 14px 16px;
      border-radius: 18px;
      border: 1px solid rgba(99,102,241,0.10);
      background: rgba(248,250,255,0.96);
      text-decoration: none;
      color: inherit;
      transition: background 150ms ease, box-shadow 150ms ease;
    }

    .link-card:hover {
      background: rgba(224,242,254,0.96);
      box-shadow: 0 8px 24px rgba(15,23,42,0.08);
    }

    .link-badge {
      flex-shrink: 0;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      border-radius: 12px;
      background: rgba(3,105,161,0.12);
      color: #0369a1;
      font-size: 12px;
      font-weight: 900;
      font-family: monospace;
    }

    .link-body { display: grid; gap: 2px; flex: 1; }
    .link-body strong { font-size: 14px; color: #1e293b; }
    .link-body span   { font-size: 13px; color: #64748b; }

    .link-arrow { color: #94a3b8; font-size: 18px; flex-shrink: 0; }

    .faq-list { display: grid; gap: 10px; }

    .faq-card {
      padding: 16px 18px;
      border-radius: 18px;
      border: 1px solid rgba(99,102,241,0.08);
      background: rgba(248,250,255,0.96);
      display: grid;
      gap: 6px;
    }

    .faq-card h3 { font-size: 15px; color: #1e293b; }

    /* ── animations ───────────────────────────────────────────────── */
    @keyframes page-enter {
      from { opacity: 0; transform: translateY(10px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    /* ── responsive ───────────────────────────────────────────────── */
    @media (max-width: 1200px) {
      .hero-card,
      .gate-grid,
      .screen-grid,
      .workflow-grid,
      .daily-rhythm {
        grid-template-columns: 1fr;
      }

      .workflow-card:last-child:nth-child(odd) {
        grid-column: auto;
      }

      .hero-card { gap: 20px; }

      .dual-layout { grid-template-columns: 1fr; }
    }

    @media (max-width: 900px) {
      :host { padding: 14px; }

      .hero-card,
      .section { padding: 18px; border-radius: 22px; }

      .hero-rules { grid-template-columns: 1fr; }

      .pipeline { gap: 4px; }
      .pipeline-step { min-width: 90px; padding: 10px 12px; }
      .pipeline-arrow { font-size: 20px; }

      .perm-header,
      .perm-row { grid-template-columns: 2fr 1fr 1fr; }
      .perm-header span:nth-child(4),
      .perm-row  span:nth-child(4) { display: none; }
    }
  `],
})
export class AdsGuideLandingComponent {
  private readonly auth = inject(AuthService);

  protected readonly currentRole = computed(
    () => (this.auth.userSignal()?.role as Role | undefined) || undefined,
  );

  protected readonly heroImage = adsImage('sale_overview');

  protected readonly workflowSteps: AdWorkflowStep[] = [
    {
      step: '01',
      title: 'Thiết lập Tài khoản quảng cáo',
      who: 'Ads Manager · Director',
      summary:
        'Kết nối tài khoản quảng cáo từ Facebook Business Manager, Google MCC hoặc TikTok Business Center vào hệ thống. Xác nhận quyền truy cập và trạng thái tài khoản trước khi tạo nhóm.',
      checklist: [
        'Mở Ads Management → tab Tài khoản quảng cáo.',
        'Thêm tài khoản với đầy đủ: tên, platform (Facebook/Google/TikTok), Account ID và trạng thái.',
        'Kiểm tra token API được gắn cho tài khoản — token do Director cấp trong hệ thống.',
        'Đặt trạng thái tài khoản đúng: ACTIVE (đang chạy), PAUSED (tạm dừng), DISABLED (vô hiệu).',
        'Ghi chú mục đích và chiến lược sử dụng của từng tài khoản trong trường ghi chú.',
      ],
      note: 'Tài khoản quảng cáo là nền tảng của toàn bộ tracking và attribution. Thiết lập sai tài khoản sẽ làm hỏng toàn bộ dữ liệu leads sau này.',
      route: '/app/ads-management',
      allowedRoles: [Role.DIRECTOR, Role.OPS, Role.ADSMANAGER],
      color: 'sky',
    },
    {
      step: '02',
      title: 'Tạo Nhóm quảng cáo và Tracking Keys',
      who: 'Ads Manager',
      summary:
        'Tạo ad group gắn với tài khoản đã thiết lập. Đặt tracking key — đây là chuỗi định danh duy nhất để hệ thống ghép lead về đúng nhóm và chiến dịch khi phụ huynh submit form.',
      checklist: [
        'Mở Ads Management → tab Nhóm quảng cáo → Tạo nhóm mới.',
        'Chọn đúng tài khoản quảng cáo và đặt tên nhóm theo quy ước nội bộ.',
        'Nhập tracking key — đây là từ khóa duy nhất, không trùng với nhóm khác.',
        'Ghi chú mục tiêu của nhóm: đối tượng, khu vực, loại chiến dịch.',
        'Đặt trạng thái ACTIVE và xác nhận nhóm hiển thị đúng trong danh sách.',
        'Đối chiếu tracking key với Landing Page sẽ dùng trước khi chạy quảng cáo.',
      ],
      warning:
        'Tracking key là trường cực kỳ quan trọng — sai tracking key dẫn đến lead bị mất attribution và không thể tính ROI chính xác.',
      note: 'Mỗi chiến dịch hoặc thông điệp quảng cáo khác nhau nên có tracking key riêng để đo được hiệu quả từng nhóm.',
      route: '/app/ads-management',
      allowedRoles: [Role.DIRECTOR, Role.OPS, Role.ADSMANAGER],
      color: 'indigo',
    },
    {
      step: '03',
      title: 'Tạo Landing Page và cài Pixel',
      who: 'Ads Manager · Director',
      summary:
        'Tạo landing page động hoặc dùng landing page hệ thống. Nhập đúng Pixel ID (Meta), Google Tag ID và TikTok Pixel ID để hệ thống kích hoạt tracking chuyển đổi khi phụ huynh submit form.',
      checklist: [
        'Vào Ads Management → Landing Pages (hoặc vào /app/landing-pages).',
        'Tạo landing page mới với đầy đủ: tên, slug, hero title, hero subtitle và nội dung form.',
        'Nhập Meta Pixel ID nếu chiến dịch chạy Facebook — copy từ Events Manager.',
        'Nhập Google Tag ID hoặc Google Ads Conversion ID nếu dùng Google Ads.',
        'Nhập TikTok Pixel ID nếu chiến dịch chạy TikTok.',
        'Chọn defaultPlatform và gắn đúng Ad Group cho landing page.',
        'Đặt trạng thái ACTIVE và test form submit trước khi share link quảng cáo.',
      ],
      warning:
        'Không share link landing page cho quảng cáo khi chưa test form submit và xác nhận pixel fire đúng trong Events Manager.',
      note: 'URL chuẩn của landing page: /lp/{slug}. Dùng URL này làm landing page URL trong chiến dịch quảng cáo để tracking hoạt động đúng.',
      route: '/app/landing-pages',
      allowedRoles: [Role.DIRECTOR, Role.OPS, Role.ADSMANAGER],
      color: 'violet',
    },
    {
      step: '04',
      title: 'Theo dõi Leads từ quảng cáo',
      who: 'Ads Manager · Sale',
      summary:
        'Sau khi chiến dịch chạy, leads từ landing page sẽ tự động xuất hiện trong Leads với đầy đủ: tên, số điện thoại, landing page, ad group và tracking attribution. Rà soát lead mới mỗi ngày.',
      checklist: [
        'Mở /app/leads — lọc theo nguồn LANDING_PAGE để xem leads từ quảng cáo.',
        'Kiểm tra trường "Ad Group" và "Tracking Attribution" của mỗi lead — đảm bảo gắn đúng nhóm.',
        'Phối hợp với Sale để phân công chăm sóc lead theo khu vực hoặc chiến dịch.',
        'Theo dõi tỷ lệ chuyển đổi: lead → phụ huynh → đơn đăng ký → lớp học.',
        'Cập nhật ghi chú nếu lead có vấn đề về tracking hoặc attribution sai.',
        'Báo cáo Director nếu có dấu hiệu lead bị trùng hoặc attribution bất thường.',
      ],
      note: 'Lead từ quảng cáo cần được xử lý trong 30 phút đầu để tỷ lệ chuyển đổi cao nhất. Phối hợp với Sale để đảm bảo không để lead nguội.',
      route: '/app/leads',
      allowedRoles: [Role.DIRECTOR, Role.OPS, Role.ADSMANAGER],
      color: 'teal',
    },
    {
      step: '05',
      title: 'Phân tích Profit và điều chỉnh ngân sách',
      who: 'Ads Manager',
      summary:
        'Đọc Ads Analytics để so sánh cohort profit của các nhóm quảng cáo. Chỉ điều chỉnh budget sau khi đã đủ dữ liệu để kết luận — không dựa vào chi phí hay số lượng lead đơn thuần.',
      checklist: [
        'Mở Ads Analytics — lọc theo khoảng thời gian, platform và ad group cần phân tích.',
        'Đọc Cohort Profit: tổng doanh thu phụ huynh đã chuyển đổi từ nhóm đó trừ chi phí ads.',
        'Đọc Parent Profit: giá trị lâu dài của từng phụ huynh đến từ nhóm (lifetime value).',
        'So sánh nhóm đang lãi, hòa vốn và nhóm đang lỗ trước khi đề xuất thay đổi.',
        'Chỉ tăng budget nhóm đang lãi với cohort profit dương và ROI ≥ ngưỡng mục tiêu.',
        'Ghi chú nguyên nhân và đề xuất thay đổi — báo cáo Director nếu cần thay đổi lớn.',
      ],
      warning:
        'Không tăng budget chỉ vì nhóm có nhiều lead — lead không chuyển đổi thành doanh thu vẫn là chi phí lãng phí.',
      note: 'Ngưỡng mục tiêu ROI và cohort profit cần được thống nhất với Director trước khi bắt đầu chiến dịch. Đây là con số tham chiếu để ra quyết định.',
      route: '/app/ads-analytics',
      allowedRoles: [Role.DIRECTOR, Role.OPS, Role.ADSMANAGER],
      color: 'rose',
    },
    {
      step: '06',
      title: 'Đồng bộ Chatbot và Fanpage',
      who: 'Ads Manager',
      summary:
        'Sau khi chiến dịch đã ổn định, vào Chatbot Settings để kiểm tra fanpage đang gắn đúng ad account, token OpenAI còn hiệu lực và AI auto-reply đang hoạt động đúng trạng thái.',
      checklist: [
        'Mở Chatbot Settings — kiểm tra từng fanpage: ad account gắn là đúng không.',
        'Xác nhận token OpenAI đang dùng còn hiệu lực (trạng thái ACTIVE, chưa hết hạn).',
        'Kiểm tra AI auto-reply: bật đúng fanpage cần tự động phản hồi hội thoại.',
        'Nếu đổi fanpage hoặc token, quay lại Ads Management đối chiếu tracking key.',
        'Báo Director nếu cần thêm token hoặc đổi cấu hình nhạy cảm.',
      ],
      note: 'Chatbot là điểm cuối trong luồng — nếu fanpage sai hoặc token hết hạn, hội thoại từ quảng cáo sẽ không được tự động xử lý và lead có thể nguội.',
      route: '/app/chatbot-settings',
      allowedRoles: [Role.DIRECTOR, Role.OPS, Role.ADSMANAGER],
      color: 'slate',
    },
  ];

  protected readonly permissions: PermissionRow[] = [
    { action: 'Xem danh sách tài khoản quảng cáo', adsmanager: true, director: true, ops: true },
    { action: 'Thêm / sửa tài khoản quảng cáo', adsmanager: true, director: true, ops: false },
    { action: 'Tạo / sửa nhóm quảng cáo (Ad Group)', adsmanager: true, director: true, ops: false },
    { action: 'Nhập chi phí quảng cáo', adsmanager: true, director: true, ops: true },
    { action: 'Xem Ads Analytics (cohort profit)', adsmanager: true, director: true, ops: false },
    { action: 'Tạo / cấu hình Landing Page', adsmanager: true, director: true, ops: false },
    { action: 'Xem leads từ Landing Page', adsmanager: true, director: true, ops: true },
    { action: 'Cấu hình Chatbot / Fanpage', adsmanager: true, director: true, ops: false },
    { action: 'Thêm / quản lý API Token', adsmanager: false, director: true, ops: false },
    { action: 'Xóa tài khoản hoặc nhóm quảng cáo', adsmanager: false, director: true, ops: false },
    { action: 'Xem Audit Log và User Management', adsmanager: false, director: true, ops: false },
  ];

  protected readonly quickLinks: QuickLink[] = [
    { title: 'Ads Management', description: 'Tài khoản, nhóm QC, chi phí và việc cần làm mỗi ngày', route: '/app/ads-management', badge: 'QC' },
    { title: 'Ads Analytics', description: 'Cohort profit, parent profit và ROI để ra quyết định', route: '/app/ads-analytics', badge: 'AN' },
    { title: 'Chatbot Settings', description: 'Fanpage, token AI và cấu hình auto-reply', route: '/app/chatbot-settings', badge: 'CB' },
    { title: 'Landing Pages', description: 'Quản lý landing page động và tracking pixel', route: '/app/landing-pages', badge: 'LP' },
    { title: 'Leads', description: 'Danh sách leads từ landing page và quảng cáo', route: '/app/leads', badge: 'LD' },
    { title: 'Dashboard', description: 'Tổng quan và checklist hằng ngày của Ads Manager', route: '/app/dashboard', badge: 'DB' },
  ];

  protected readonly faqs: FAQItem[] = [
    {
      question: 'Tracking key là gì và tại sao quan trọng?',
      answer:
        'Tracking key là chuỗi định danh gắn với nhóm quảng cáo. Khi phụ huynh submit form trên landing page, hệ thống dùng tracking key để ghép lead về đúng nhóm và chiến dịch, từ đó tính được cohort profit chính xác.',
    },
    {
      question: 'Tôi có thể đổi budget của nhóm quảng cáo không?',
      answer:
        'Ads Manager được sửa thông tin nhóm trong hệ thống. Tuy nhiên quyết định tăng/giảm budget phải dựa trên dữ liệu từ Ads Analytics — không điều chỉnh trước khi có đủ cohort profit để kết luận.',
    },
    {
      question: 'Pixel fire khi nào?',
      answer:
        'Pixel (Meta/Google/TikTok) được kích hoạt ngay khi phụ huynh submit form thành công trên landing page. Cần kiểm tra trong Events Manager của từng platform để xác nhận pixel đang hoạt động đúng.',
    },
    {
      question: 'Ai quản lý token API và tài khoản quảng cáo nhạy cảm?',
      answer:
        'Token API (Facebook BM, Google MCC, TikTok BC) và quyền cấp phép tài khoản quảng cáo do Director quản lý. Ads Manager chỉ sử dụng token và fanpage đã được cấp — không tự thêm hoặc sửa token.',
    },
    {
      question: 'Tôi cần làm gì nếu thấy lead bị mất attribution?',
      answer:
        'Kiểm tra tracking key của landing page và ad group có khớp nhau không. Nếu vẫn sai, ghi chú chi tiết và báo ngay cho Director để kiểm tra cấu hình hệ thống — không tự sửa dữ liệu attribution.',
    },
    {
      question: 'Cohort profit và realized profit khác nhau như thế nào?',
      answer:
        'Cohort profit là tổng giá trị phụ huynh đã chuyển đổi từ nhóm QC (bao gồm cả doanh thu chưa thu). Realized profit là doanh thu đã thực sự thu được. Cần xem cả hai để hiểu đúng hiệu quả thực sự của chiến dịch.',
    },
  ];

  protected canOpenRoute(allowedRoles: Role[]): boolean {
    const role = this.currentRole();
    if (!role) return false;
    return allowedRoles.includes(role);
  }
}
