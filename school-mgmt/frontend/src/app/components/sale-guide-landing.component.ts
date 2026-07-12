import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { Role } from '../models/role.enum';

interface WorkflowStep {
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
  color: 'amber' | 'teal' | 'orange' | 'blue' | 'rose' | 'slate';
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
  sale: boolean;
  director: boolean;
  accounting: boolean;
  ops: boolean;
}

interface FAQItem {
  question: string;
  answer: string;
}

type SaleHubTab = 'workflow' | 'sale-kit';

interface SaleKitCard {
  title: string;
  summary: string;
  points: string[];
  route?: string;
  queryParams?: Record<string, string>;
  actionLabel?: string;
}

interface SalesScript {
  situation: string;
  opener: string;
  discovery: string[];
  pitch: string;
  close: string;
}

interface ObjectionResponse {
  objection: string;
  response: string;
  nextAction: string;
}

interface MessageTemplate {
  title: string;
  context: string;
  body: string;
}

interface SaleKitStage {
  stage: string;
  title: string;
  actions: string[];
}

const INTERNAL_IMAGE_BASE = '/assets/internal-handbook/images';

const saleImage = (name: string) => `${INTERNAL_IMAGE_BASE}/${name}.webp`;

@Component({
  selector: 'app-sale-guide-landing',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="sale-hub">

      <!-- ══ HERO ══════════════════════════════════════════════════════ -->
      <section class="hero-card">
        <div class="hero-copy">
          <span class="eyebrow">Sale Hub · Tư vấn tuyển sinh</span>
          <h1>Hai luồng quy trình — một điểm kết thúc</h1>
          <p class="hero-text">
            Trang này là điểm khởi đầu cho mọi Sale khi onboarding và làm việc hằng ngày.
            Cách nhanh nhất: tiếp nhận lead rồi tạo Đơn đăng ký tại <strong>/app/orders</strong> —
            form này gom luôn phụ huynh, học sinh, lớp học và hóa đơn. Cách thủ công (6 bước)
            dùng khi cần tạo và kiểm soát từng phần riêng.
          </p>
          <div class="hero-actions">
            <a class="btn btn-primary" href="#pipeline" (click)="setHubTab('workflow')">Xem hai luồng quy trình</a>
            <button class="btn btn-secondary" type="button" (click)="setHubTab('sale-kit')">Mở Sale Kit</button>
            <a class="btn btn-secondary" [routerLink]="'/app/leads'">Mở Leads</a>
            <a class="btn btn-ghost" [routerLink]="'/app/users'" [queryParams]="{ role: 'PARENT' }">Mở Phụ huynh</a>
          </div>
          <div class="hero-rules">
            <div class="rule-item rule-gold">
              <span class="rule-label">Điểm chặn quan trọng</span>
              <span>Chỉ tạo lớp khi hóa đơn đã được duyệt <em>hoặc</em> phụ huynh đã có đủ số dư trong ví</span>
            </div>
            <div class="rule-item rule-teal">
              <span class="rule-label">Phạm vi quyền hạn</span>
              <span>Sale được tạo/sửa parent account trong danh mục mình phụ trách — không được xóa</span>
            </div>
            <div class="rule-item rule-slate">
              <span class="rule-label">Chuyển owner</span>
              <span>Khi cần chuyển parent sang sale khác, ghi chú rõ lý do và nhờ Director thao tác</span>
            </div>
          </div>
        </div>
        <div class="hero-visual">
          <img [src]="heroImage" alt="Tổng quan sale hub" loading="eager" />
        </div>
      </section>

      <nav class="hub-tabs" aria-label="Sale hub tabs">
        <button type="button" [class.active]="activeHubTab === 'workflow'" (click)="setHubTab('workflow')">
          Quy trình
        </button>
        <button type="button" [class.active]="activeHubTab === 'sale-kit'" (click)="setHubTab('sale-kit')">
          Sale Kit
        </button>
      </nav>

      <ng-container *ngIf="activeHubTab === 'workflow'">
      <!-- ══ PIPELINE ═══════════════════════════════════════════════════ -->
      <section class="section section-pipeline" id="pipeline">
        <div class="section-heading">
          <div>
            <span class="section-kicker">Tổng quan luồng</span>
            <h2>Hai cách triển khai — cùng điểm kết thúc</h2>
            <p class="section-summary">Cách 1 dùng Đơn đăng ký — nhanh nhất, gom mọi thứ vào một form. Cách 2 tạo thủ công từng phần khi cần kiểm soát riêng.</p>
          </div>
        </div>

        <!-- Cách 1 -->
        <div class="flow-block">
          <div class="flow-label flow-label-primary">Cách 1 — Nhanh nhất · Qua Đơn đăng ký</div>
          <div class="pipeline">
            <div class="pipeline-step p-amber">
              <span class="p-num">01</span>
              <span class="p-label">Tiếp nhận Lead</span>
              <span class="p-sub">/app/leads</span>
            </div>
            <span class="pipeline-arrow">›</span>
            <div class="pipeline-step p-teal">
              <span class="p-num">02</span>
              <span class="p-label">Tạo Đơn đăng ký</span>
              <span class="p-sub">/app/orders</span>
            </div>
            <span class="pipeline-arrow">›</span>
            <div class="pipeline-step p-rose">
              <span class="p-num">03</span>
              <span class="p-label">Chờ duyệt đơn</span>
              <span class="p-sub">Gate tài chính</span>
            </div>
            <span class="pipeline-arrow">›</span>
            <div class="pipeline-step p-slate">
              <span class="p-num">04</span>
              <span class="p-label">Tạo Lớp học</span>
              <span class="p-sub">/app/classes</span>
            </div>
          </div>
          <p class="flow-note">Đơn đăng ký gom toàn bộ thông tin phụ huynh, học sinh, lớp học và hóa đơn vào một form — không cần tạo riêng từng phần.</p>
        </div>

        <!-- Cách 2 -->
        <div class="flow-block">
          <div class="flow-label flow-label-secondary">Cách 2 — Thủ công từng bước (khi cần kiểm soát riêng từng phần)</div>
          <div class="pipeline">
            <div class="pipeline-step p-amber">
              <span class="p-num">01</span>
              <span class="p-label">Tiếp nhận Lead</span>
              <span class="p-sub">/app/leads</span>
            </div>
            <span class="pipeline-arrow">›</span>
            <div class="pipeline-step p-teal">
              <span class="p-num">02</span>
              <span class="p-label">Tạo Phụ huynh</span>
              <span class="p-sub">/app/users</span>
            </div>
            <span class="pipeline-arrow">›</span>
            <div class="pipeline-step p-orange">
              <span class="p-num">03</span>
              <span class="p-label">Tạo Học sinh</span>
              <span class="p-sub">/app/students</span>
            </div>
            <span class="pipeline-arrow">›</span>
            <div class="pipeline-step p-blue">
              <span class="p-num">04</span>
              <span class="p-label">Lập Hóa đơn</span>
              <span class="p-sub">/app/invoices</span>
            </div>
            <span class="pipeline-arrow">›</span>
            <div class="pipeline-step p-rose">
              <span class="p-num">05</span>
              <span class="p-label">Chờ duyệt hóa đơn</span>
              <span class="p-sub">Gate tài chính</span>
            </div>
            <span class="pipeline-arrow">›</span>
            <div class="pipeline-step p-slate">
              <span class="p-num">06</span>
              <span class="p-label">Tạo Lớp học</span>
              <span class="p-sub">/app/classes</span>
            </div>
          </div>
        </div>
      </section>

      <!-- ══ WORKFLOW ════════════════════════════════════════════════════ -->
      <section class="section" id="workflow">
        <div class="section-heading">
          <div>
            <span class="section-kicker">Chi tiết · Cách 2 — Khách hàng mới</span>
            <h2>6 bước khi phụ huynh chưa có tài khoản</h2>
            <p class="section-summary">
              Áp dụng khi khách hàng hoàn toàn mới. Làm đúng thứ tự — đúng người phụ trách —
              đúng trạng thái tại từng bước. Không được bỏ qua bất kỳ mốc nào.
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

      <!-- ══ GATE ════════════════════════════════════════════════════════ -->
      <section class="section section-gate">
        <div class="section-heading">
          <div>
            <span class="section-kicker">Điểm chặn tài chính</span>
            <h2>Chỉ tạo lớp khi đạt một trong hai điều kiện</h2>
            <p class="section-summary">
              Đây là bước 05 trong quy trình. Sale phải tự kiểm tra trước khi sang bước tạo lớp.
            </p>
          </div>
        </div>
        <div class="gate-grid">
          <div class="gate-card gate-green">
            <span class="gate-icon">✓</span>
            <h3>Hóa đơn đã được duyệt</h3>
            <p>Hóa đơn có trạng thái <strong>APPROVED</strong>. Kế toán hoặc Director đã xác nhận.
            Sale có thể chuyển sang bước tạo lớp ngay khi thấy trạng thái này.</p>
            <a class="gate-link" [routerLink]="'/app/invoices'">Kiểm tra hóa đơn →</a>
          </div>
          <div class="gate-card gate-blue">
            <span class="gate-icon">✓</span>
            <h3>Phụ huynh đã nạp đủ tiền</h3>
            <p>Tài khoản phụ huynh có số dư ≥ giá trị hóa đơn. Đối chiếu số dư trong mục
            <strong>Ví</strong> trước khi tiếp tục — không dựa vào lời nói.</p>
            <a class="gate-link" [routerLink]="'/app/wallets'">Kiểm tra ví →</a>
          </div>
          <div class="gate-card gate-red">
            <span class="gate-icon">✗</span>
            <h3>Chưa đủ điều kiện — Dừng lại</h3>
            <p>Nếu chưa thỏa <em>một trong hai</em> điều kiện trên, <strong>không tạo lớp</strong>.
            Ghi chú tình trạng vào lead/phụ huynh, thông báo cho phụ huynh và phối hợp với Kế toán hoặc Director.</p>
          </div>
        </div>
      </section>

      <!-- ══ PERMISSIONS ════════════════════════════════════════════════ -->
      <section class="section">
        <div class="section-heading">
          <div>
            <span class="section-kicker">Phân quyền</span>
            <h2>Ai được làm gì trên hệ thống</h2>
          </div>
        </div>
        <div class="perm-table">
          <div class="perm-header">
            <span>Thao tác</span>
            <span>Sale</span>
            <span>Director</span>
            <span>Kế toán</span>
            <span>OPS</span>
          </div>
          <div class="perm-row" *ngFor="let row of permissions; let odd = odd" [class.perm-row-alt]="odd">
            <span class="perm-action">{{ row.action }}</span>
            <span [class]="row.sale ? 'perm-yes' : 'perm-no'">{{ row.sale ? '✓' : '—' }}</span>
            <span [class]="row.director ? 'perm-yes' : 'perm-no'">{{ row.director ? '✓' : '—' }}</span>
            <span [class]="row.accounting ? 'perm-yes' : 'perm-no'">{{ row.accounting ? '✓' : '—' }}</span>
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
      </ng-container>

      <ng-container *ngIf="activeHubTab === 'sale-kit'">
        <section class="section kit-overview" id="sale-kit">
          <div class="section-heading">
            <div>
              <span class="section-kicker">Sale Kit</span>
              <h2>Bộ công cụ tư vấn dùng ngay khi gọi hoặc nhắn phụ huynh</h2>
              <p class="section-summary">
                Tab này gom bảng giá, kịch bản tư vấn, xử lý từ chối, mẫu tin nhắn và checklist chốt đơn.
                Mục tiêu là giúp Sale trả lời nhanh, đúng chính sách và bàn giao đủ dữ liệu cho OPS/GV trải nghiệm.
              </p>
            </div>
            <a class="btn btn-primary" [routerLink]="'/app/products'">Mở bảng giá</a>
          </div>

          <div class="kit-command-grid">
            <a
              class="kit-command"
              *ngFor="let item of saleKitCards"
              [routerLink]="item.route || null"
              [queryParams]="item.queryParams">
              <div>
                <h3>{{ item.title }}</h3>
                <p>{{ item.summary }}</p>
              </div>
              <ul>
                <li *ngFor="let point of item.points">{{ point }}</li>
              </ul>
              <span *ngIf="item.actionLabel">{{ item.actionLabel }} →</span>
            </a>
          </div>
        </section>

        <section class="section kit-section">
          <div class="section-heading">
            <div>
              <span class="section-kicker">Kịch bản tư vấn</span>
              <h2>Script theo tình huống thường gặp</h2>
              <p class="section-summary">
                Mỗi script có câu mở đầu, câu hỏi khai thác, cách gắn gói học và câu chốt bước tiếp theo.
              </p>
            </div>
          </div>

          <div class="script-grid">
            <article class="script-card" *ngFor="let script of salesScripts">
              <span class="script-label">{{ script.situation }}</span>
              <h3>Câu mở đầu</h3>
              <p>{{ script.opener }}</p>
              <h3>Câu hỏi khai thác</h3>
              <ul>
                <li *ngFor="let question of script.discovery">{{ question }}</li>
              </ul>
              <h3>Gắn với gói học</h3>
              <p>{{ script.pitch }}</p>
              <div class="script-close">{{ script.close }}</div>
            </article>
          </div>
        </section>

        <section class="section kit-section">
          <div class="section-heading">
            <div>
              <span class="section-kicker">Xử lý từ chối</span>
              <h2>Phản hồi ngắn, giữ quyền kiểm soát cuộc tư vấn</h2>
            </div>
          </div>

          <div class="objection-list">
            <article class="objection-card" *ngFor="let item of objectionResponses">
              <h3>{{ item.objection }}</h3>
              <p>{{ item.response }}</p>
              <strong>{{ item.nextAction }}</strong>
            </article>
          </div>
        </section>

        <section class="section kit-section">
          <div class="section-heading">
            <div>
              <span class="section-kicker">Mẫu tin nhắn</span>
              <h2>Nội dung gửi nhanh qua Zalo/Facebook</h2>
            </div>
          </div>

          <div class="template-grid">
            <article class="template-card" *ngFor="let template of messageTemplates">
              <div class="template-head">
                <div>
                  <span>{{ template.context }}</span>
                  <h3>{{ template.title }}</h3>
                </div>
                <button type="button" class="copy-btn" (click)="copyText(template.body)">Copy</button>
              </div>
              <pre>{{ template.body }}</pre>
            </article>
          </div>
        </section>

        <section class="section kit-section">
          <div class="section-heading">
            <div>
              <span class="section-kicker">Pipeline playbook</span>
              <h2>Checklist theo trạng thái lead</h2>
            </div>
          </div>

          <div class="stage-grid">
            <article class="stage-card" *ngFor="let stage of saleKitStages">
              <span>{{ stage.stage }}</span>
              <h3>{{ stage.title }}</h3>
              <ul>
                <li *ngFor="let action of stage.actions">{{ action }}</li>
              </ul>
            </article>
          </div>
        </section>
      </ng-container>

    </div>
  `,
  styles: [`
    :host {
      display: block;
      min-height: 100%;
      padding: 28px;
      background:
        radial-gradient(circle at top right, rgba(249, 115, 22, 0.13), transparent 20%),
        radial-gradient(circle at bottom left, rgba(20, 184, 166, 0.12), transparent 22%),
        linear-gradient(180deg, #f5efe5 0%, #f9f4ec 40%, #fcfbf7 100%);
      color: #14213d;
      font-family: 'Be Vietnam Pro', 'Segoe UI', sans-serif;
    }

    .sale-hub {
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
    .link-card {
      box-shadow: 0 14px 40px rgba(15, 23, 42, 0.07);
    }

    .hero-card,
    .section {
      border: 1px solid rgba(20, 33, 61, 0.08);
      border-radius: 30px;
      background: rgba(255, 252, 247, 0.90);
      backdrop-filter: blur(12px);
    }

    /* ── hero ─────────────────────────────────────────────────────── */
    .hero-card {
      display: grid;
      grid-template-columns: minmax(0, 1.2fr) minmax(320px, 0.8fr);
      gap: 28px;
      padding: 32px;
      overflow: hidden;
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
      background: rgba(20, 184, 166, 0.13);
      color: #0f766e;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      font-size: 11px;
      font-weight: 800;
    }

    h1, h2, h3 { margin: 0; font-family: 'Be Vietnam Pro', 'Segoe UI', sans-serif; letter-spacing: -0.03em; }
    h1 { font-size: clamp(32px, 4.5vw, 54px); line-height: 1.03; }
    h2 { font-size: clamp(26px, 3.2vw, 38px); line-height: 1.1; }
    h3 { font-size: 20px; line-height: 1.2; }

    .hero-text,
    .section-summary,
    .wf-summary,
    .wf-note,
    .gate-card p,
    .faq-card p,
    .link-card span {
      margin: 0;
      color: #475569;
      line-height: 1.65;
      font-size: 15px;
    }

    .hero-actions {
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
      padding: 0 20px;
      border-radius: 999px;
      border: 1px solid transparent;
      font-size: 14px;
      font-weight: 700;
      text-decoration: none;
      cursor: pointer;
      transition: transform 160ms ease, box-shadow 160ms ease;
    }

    .btn:hover { transform: translateY(-1px); }

    .btn-primary {
      background: linear-gradient(135deg, #0f766e 0%, #115e59 100%);
      color: #f8fafc;
      box-shadow: 0 10px 24px rgba(15, 118, 110, 0.22);
    }

    .btn-secondary {
      background: #fff7ed;
      border-color: rgba(217, 119, 6, 0.2);
      color: #9a3412;
    }

    .btn-ghost {
      background: transparent;
      border-color: rgba(20, 33, 61, 0.16);
      color: #14213d;
    }

    .hub-tabs {
      display: inline-flex;
      width: fit-content;
      gap: 6px;
      padding: 6px;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.78);
      border: 1px solid rgba(20, 33, 61, 0.08);
    }

    .hub-tabs button {
      border: 0;
      border-radius: 999px;
      background: transparent;
      padding: 10px 18px;
      color: #475569;
      cursor: pointer;
      font-size: 14px;
      font-weight: 800;
    }

    .hub-tabs button.active {
      background: #14213d;
      color: #f8fafc;
      box-shadow: 0 8px 20px rgba(20, 33, 61, 0.18);
    }

    /* hero rule cards */
    .hero-rules {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 12px;
    }

    .rule-item {
      border-radius: 20px;
      padding: 16px;
      border: 1px solid transparent;
      display: grid;
      gap: 6px;
      font-size: 14px;
      line-height: 1.55;
      color: #334155;
    }

    .rule-label {
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }

    .rule-gold  { background: linear-gradient(160deg, #fffbeb, #fef9f0); border-color: rgba(217,119,6,0.18); }
    .rule-gold .rule-label  { color: #92400e; }
    .rule-teal  { background: linear-gradient(160deg, #ecfdf5, #f0fdf9); border-color: rgba(20,184,166,0.18); }
    .rule-teal .rule-label  { color: #0f766e; }
    .rule-slate { background: linear-gradient(160deg, #f8fafc, #f1f5f9); border-color: rgba(20,33,61,0.10); }
    .rule-slate .rule-label { color: #334155; }

    /* hero visual */
    .hero-visual {
      position: relative;
      display: flex;
    }

    .hero-visual::before {
      content: '';
      position: absolute;
      inset: 16px 0 0 16px;
      border-radius: 26px;
      background: linear-gradient(145deg, rgba(217,119,6,0.14), rgba(20,184,166,0.14));
      filter: blur(8px);
    }

    .hero-visual img {
      position: relative;
      display: block;
      width: 100%;
      object-fit: cover;
      min-height: 100%;
      border-radius: 26px;
      border: 1px solid rgba(255,255,255,0.72);
    }

    /* ── section common ───────────────────────────────────────────── */
    .section {
      padding: 26px;
      display: grid;
      gap: 20px;
    }

    .section-heading {
      display: flex;
      align-items: end;
      justify-content: space-between;
      gap: 16px;
    }

    .section-summary {
      margin-top: 6px;
      max-width: 640px;
    }

    /* ── pipeline ─────────────────────────────────────────────────── */
    .section-pipeline {
      background: linear-gradient(160deg, rgba(254,252,243,0.92), rgba(255,255,255,0.96));
    }

    .flow-block {
      display: grid;
      gap: 10px;
    }

    .flow-note {
      margin: 0;
      font-size: 13px;
      color: #64748b;
      font-style: italic;
      padding-left: 4px;
    }

    .flow-label {
      display: inline-flex;
      align-items: center;
      width: fit-content;
      padding: 6px 14px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.04em;
    }

    .flow-label-primary {
      background: rgba(20, 184, 166, 0.14);
      color: #0f766e;
    }

    .flow-label-secondary {
      background: rgba(249, 115, 22, 0.12);
      color: #9a3412;
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

    .p-amber { background: linear-gradient(160deg,#fffbeb,#fef9ef); border-color: rgba(217,119,6,0.22); color: #78350f; }
    .p-teal  { background: linear-gradient(160deg,#ecfdf5,#f0fdf9); border-color: rgba(20,184,166,0.22); color: #134e4a; }
    .p-orange{ background: linear-gradient(160deg,#fff7ed,#fef9f5); border-color: rgba(234,88,12,0.20); color: #7c2d12; }
    .p-blue  { background: linear-gradient(160deg,#eff6ff,#f0f9ff); border-color: rgba(59,130,246,0.20); color: #1e3a8a; }
    .p-rose  { background: linear-gradient(160deg,#fff1f2,#fff5f5); border-color: rgba(225,29,72,0.18); color: #9f1239; }
    .p-slate { background: linear-gradient(160deg,#f8fafc,#f1f5f9); border-color: rgba(20,33,61,0.12); color: #1e293b; }

    /* ── workflow ─────────────────────────────────────────────────── */
    .workflow-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 16px;
    }

    /* last card spans full width if odd count */
    .workflow-card:last-child:nth-child(odd) {
      grid-column: 1 / -1;
    }

    .workflow-card {
      padding: 24px;
      display: grid;
      gap: 16px;
      border-radius: 24px;
      border: 1px solid rgba(20, 33, 61, 0.08);
      background: rgba(255,252,248,0.96);
      align-content: start;
    }

    .workflow-card[data-color='amber'] { background: linear-gradient(160deg, rgba(255,251,235,0.98), rgba(255,255,255,0.99)); }
    .workflow-card[data-color='teal']  { background: linear-gradient(160deg, rgba(236,253,245,0.98), rgba(255,255,255,0.99)); }
    .workflow-card[data-color='orange']{ background: linear-gradient(160deg, rgba(255,247,237,0.98), rgba(255,255,255,0.99)); }
    .workflow-card[data-color='blue']  { background: linear-gradient(160deg, rgba(239,246,255,0.98), rgba(255,255,255,0.99)); }
    .workflow-card[data-color='rose']  { background: linear-gradient(160deg, rgba(255,241,242,0.98), rgba(255,255,255,0.99)); }
    .workflow-card[data-color='slate'] { background: linear-gradient(160deg, rgba(248,250,252,0.98), rgba(255,255,255,0.99)); }

    .wf-header {
      display: grid;
      gap: 8px;
    }

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
      background: rgba(20,184,166,0.12);
      color: #0f766e;
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

    .wf-checklist {
      display: grid;
      gap: 8px;
    }

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

    li::marker { color: #d97706; }

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
      background: rgba(15,118,110,0.08);
      color: #0f766e;
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
      background: #14213d;
      color: #f8fafc;
      font-size: 13px;
      font-weight: 700;
      text-decoration: none;
      transition: background 160ms ease;
    }

    .wf-action-btn:hover { background: #0f766e; }

    /* ── gate ─────────────────────────────────────────────────────── */
    .section-gate {
      background: linear-gradient(160deg, rgba(255,249,242,0.92), rgba(255,255,255,0.97));
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

    .gate-icon {
      font-size: 26px;
      line-height: 1;
    }

    .gate-green { background: linear-gradient(160deg,#ecfdf5,#f0fdf9); border-color: rgba(16,185,129,0.22); }
    .gate-green .gate-icon { color: #059669; }
    .gate-blue  { background: linear-gradient(160deg,#eff6ff,#f0f9ff); border-color: rgba(59,130,246,0.20); }
    .gate-blue  .gate-icon { color: #2563eb; }
    .gate-red   { background: linear-gradient(160deg,#fff1f2,#fff5f5); border-color: rgba(225,29,72,0.18); }
    .gate-red   .gate-icon { color: #e11d48; }

    .gate-link {
      display: inline-flex;
      align-items: center;
      color: #0f766e;
      font-size: 14px;
      font-weight: 700;
      text-decoration: none;
    }

    .gate-link:hover { text-decoration: underline; }

    /* ── permissions table ────────────────────────────────────────── */
    .perm-table {
      border-radius: 20px;
      overflow: hidden;
      border: 1px solid rgba(20,33,61,0.08);
    }

    .perm-header,
    .perm-row {
      display: grid;
      grid-template-columns: 2fr 1fr 1fr 1fr 1fr;
      align-items: center;
      gap: 0;
    }

    .perm-header {
      background: #14213d;
      color: #e2e8f0;
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      padding: 12px 20px;
    }

    .perm-row {
      padding: 12px 20px;
      background: rgba(255,255,255,0.95);
      border-top: 1px solid rgba(20,33,61,0.06);
      font-size: 14px;
    }

    .perm-row-alt {
      background: rgba(248,250,252,0.96);
    }

    .perm-action { color: #1e293b; font-weight: 500; }

    .perm-yes { color: #059669; font-weight: 800; font-size: 16px; }
    .perm-no  { color: #94a3b8; font-size: 15px; }

    /* ── dual layout (quick links + faq) ─────────────────────────── */
    .dual-layout {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 18px;
    }

    .panel {
      padding: 24px;
      display: grid;
      gap: 16px;
      align-content: start;
      border-radius: 24px;
      border: 1px solid rgba(20,33,61,0.08);
      background: rgba(255,255,255,0.96);
    }

    /* quick links */
    .link-list {
      display: grid;
      gap: 10px;
    }

    .link-card {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 14px 16px;
      border-radius: 18px;
      border: 1px solid rgba(20,33,61,0.08);
      background: rgba(248,250,252,0.96);
      text-decoration: none;
      color: inherit;
      transition: background 150ms ease, box-shadow 150ms ease;
    }

    .link-card:hover {
      background: rgba(236,253,245,0.96);
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
      background: rgba(20,184,166,0.12);
      color: #0f766e;
      font-size: 12px;
      font-weight: 900;
      font-family: monospace;
    }

    .link-body {
      display: grid;
      gap: 2px;
      flex: 1;
    }

    .link-body strong { font-size: 14px; color: #1e293b; }
    .link-body span   { font-size: 13px; }

    .link-arrow {
      color: #94a3b8;
      font-size: 18px;
      flex-shrink: 0;
    }

    /* faq */
    .faq-list {
      display: grid;
      gap: 10px;
    }

    .faq-card {
      padding: 16px 18px;
      border-radius: 18px;
      border: 1px solid rgba(20,33,61,0.07);
      background: rgba(248,250,252,0.96);
      display: grid;
      gap: 6px;
    }

    .faq-card h3 { font-size: 15px; color: #1e293b; }

    /* ── sale kit ─────────────────────────────────────────────────── */
    .kit-overview {
      background: linear-gradient(160deg, rgba(236,253,245,0.92), rgba(255,255,255,0.97));
    }

    .kit-command-grid,
    .script-grid,
    .template-grid,
    .stage-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 16px;
    }

    .kit-command,
    .script-card,
    .objection-card,
    .template-card,
    .stage-card {
      border: 1px solid rgba(20, 33, 61, 0.08);
      border-radius: 22px;
      background: rgba(255, 255, 255, 0.96);
    }

    .kit-command {
      display: grid;
      gap: 14px;
      padding: 20px;
      color: inherit;
      text-decoration: none;
    }

    .script-card,
    .template-card,
    .stage-card {
      display: grid;
      gap: 12px;
      padding: 22px;
      align-content: start;
    }

    .script-label,
    .stage-card > span,
    .template-head span {
      display: inline-flex;
      width: fit-content;
      padding: 5px 10px;
      border-radius: 999px;
      background: rgba(249, 115, 22, 0.12);
      color: #9a3412;
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .script-close {
      padding: 12px 14px;
      border-radius: 14px;
      background: rgba(15, 118, 110, 0.08);
      color: #0f766e;
      font-size: 14px;
      font-weight: 800;
      line-height: 1.55;
    }

    .objection-list {
      display: grid;
      gap: 12px;
    }

    .objection-card {
      display: grid;
      grid-template-columns: minmax(180px, 0.7fr) minmax(0, 1.4fr) minmax(190px, 0.8fr);
      gap: 14px;
      padding: 16px 18px;
      align-items: start;
    }

    .objection-card strong {
      color: #0f766e;
      font-size: 14px;
      line-height: 1.55;
    }

    .template-head {
      display: flex;
      justify-content: space-between;
      gap: 14px;
      align-items: start;
    }

    .copy-btn {
      border: 1px solid rgba(20, 33, 61, 0.12);
      border-radius: 999px;
      background: #f8fafc;
      color: #14213d;
      cursor: pointer;
      padding: 7px 12px;
      font-size: 12px;
      font-weight: 800;
    }

    pre {
      margin: 0;
      white-space: pre-wrap;
      word-break: break-word;
      font: 13px/1.65 'Be Vietnam Pro', 'Segoe UI', sans-serif;
      color: #334155;
      background: #f8fafc;
      border: 1px solid rgba(20, 33, 61, 0.06);
      border-radius: 14px;
      padding: 14px;
    }

    /* ── animations ───────────────────────────────────────────────── */
    @keyframes page-enter {
      from { opacity: 0; transform: translateY(10px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    /* ── responsive ───────────────────────────────────────────────── */
    @media (max-width: 1200px) {
      .hero-card,
      .gate-grid,
      .workflow-grid,
      .dual-layout,
      .kit-command-grid,
      .script-grid,
      .template-grid,
      .stage-grid {
        grid-template-columns: 1fr;
      }

      .objection-card {
        grid-template-columns: 1fr;
      }

      .workflow-card:last-child:nth-child(odd) {
        grid-column: auto;
      }

      .hero-card { gap: 20px; }
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
      .perm-header span:nth-child(5),
      .perm-row  span:nth-child(5) { display: none; }
    }
  `],
})
export class SaleGuideLandingComponent {
  private readonly auth = inject(AuthService);

  protected readonly currentRole = computed(
    () => (this.auth.userSignal()?.role as Role | undefined) || undefined,
  );

  protected readonly heroImage = saleImage('sale_overview');

  protected activeHubTab: SaleHubTab = 'workflow';

  protected readonly saleKitCards: SaleKitCard[] = [
    {
      title: 'Bảng giá và ưu đãi',
      summary: 'Điểm mở đầu trước mọi cuộc tư vấn. Sale cần nhìn giá, số buổi, đơn giá/buổi và chương trình đang chạy.',
      points: [
        'Mở bảng giá trước khi báo phí cho phụ huynh.',
        'Đọc kỹ ghi chú ưu đãi và điều kiện áp dụng.',
        'Không tự hứa giảm giá ngoài nội dung đã được duyệt.',
      ],
      route: '/app/products',
      actionLabel: 'Mở bảng giá',
    },
    {
      title: 'Lead và lịch follow-up',
      summary: 'Nơi ghi nhận nhu cầu, trạng thái, lịch hẹn gọi lại và lý do rớt deal.',
      points: [
        'Lead mới phải được xử lý trong ngày.',
        'Mỗi lần gọi/nhắn cần có ghi chú ngắn.',
        'Khi hẹn test, ghi rõ khung giờ và môn học.',
      ],
      route: '/app/leads',
      actionLabel: 'Mở Leads',
    },
    {
      title: 'Buổi test với GV trải nghiệm',
      summary: 'Dùng để phối hợp sale với giáo viên trải nghiệm: mục tiêu test, nhận xét sau test và cơ hội chốt.',
      points: [
        'Trước test: gửi bối cảnh học sinh cho GV trải nghiệm.',
        'Sau test: xin nhận xét ngắn, mức độ phù hợp và gói nên tư vấn.',
        'Chốt tiếp bằng dữ liệu sau test, không chốt cảm tính.',
      ],
      route: '/app/trial-enrollments',
      actionLabel: 'Mở buổi test',
    },
    {
      title: 'Đơn đăng ký',
      summary: 'Form chốt đơn nhanh: phụ huynh, học sinh, gói học, giảm giá, thanh toán và bàn giao vận hành.',
      points: [
        'Chỉ tạo đơn khi đã rõ gói, số buổi và chính sách áp dụng.',
        'Ghi lý do giảm giá nếu có giảm.',
        'Sau khi tạo đơn, theo dõi trạng thái duyệt trước khi tạo lớp.',
      ],
      route: '/app/orders',
      actionLabel: 'Tạo đơn',
    },
  ];

  protected readonly salesScripts: SalesScript[] = [
    {
      situation: 'Phụ huynh hỏi giá ngay',
      opener:
        'Dạ em gửi bảng giá được ạ. Trước khi báo gói phù hợp, em xin hỏi nhanh mục tiêu học của bé để tránh tư vấn thừa hoặc thiếu buổi.',
      discovery: [
        'Bé đang học lớp mấy và môn nào cần hỗ trợ nhất?',
        'Mục tiêu chính là lấy lại gốc, tăng điểm trên lớp hay chuẩn bị kỳ thi?',
        'Mỗi tuần gia đình sắp xếp được mấy buổi và muốn học online hay offline?',
      ],
      pitch:
        'Với mục tiêu này, mình nên bắt đầu bằng gói có số buổi đủ để giáo viên đánh giá nền và theo được tiến bộ. Em sẽ đối chiếu bảng giá và ưu đãi đang áp dụng để gửi phương án rõ nhất.',
      close:
        'Em đề xuất mình chốt một buổi test trước, sau đó mới chọn gói cuối cùng theo nhận xét của giáo viên trải nghiệm.',
    },
    {
      situation: 'Phụ huynh chê đắt',
      opener:
        'Dạ em hiểu. Mình đang so theo tổng tiền gói hay theo hiệu quả sau từng buổi ạ?',
      discovery: [
        'Trước đây bé đã học ở đâu và vì sao gia đình muốn đổi?',
        'Nếu học phí thấp hơn nhưng không cải thiện, mình có còn ưu tiên phương án đó không?',
        'Gia đình muốn tối ưu chi phí theo tháng hay muốn chọn lộ trình ngắn để thấy tiến bộ nhanh?',
      ],
      pitch:
        'Em sẽ tách rõ giá gói, số buổi và đơn giá/buổi để mình so công bằng. Nếu có ưu đãi hợp lệ, em áp dụng ngay trong đơn, còn phần chất lượng nên để buổi test xác nhận.',
      close:
        'Mình giữ lịch test trước nhé. Sau test em gửi lại 2 phương án: tiết kiệm và tối ưu tiến bộ để gia đình chọn.',
    },
    {
      situation: 'Phụ huynh chưa tin chất lượng giáo viên',
      opener:
        'Dạ phần giáo viên là điểm rất quan trọng. Bên em không muốn phụ huynh quyết chỉ dựa trên lời giới thiệu, nên mình nên dùng buổi test để kiểm chứng.',
      discovery: [
        'Bé hợp giáo viên nghiêm khắc, nhẹ nhàng hay cần người kéo tương tác nhiều?',
        'Gia đình kỳ vọng giáo viên báo cáo sau buổi học ở mức nào?',
        'Trước đây bé không hợp giáo viên vì phong cách dạy, chuyên môn hay lịch học?',
      ],
      pitch:
        'Sau buổi test, giáo viên trải nghiệm sẽ phản hồi nền hiện tại, điểm yếu và hướng học. Sale dùng phản hồi đó để tư vấn gói, không ép gói trước khi có dữ liệu.',
      close:
        'Em đặt lịch test và ghi rõ yêu cầu về phong cách giáo viên để đội trải nghiệm chuẩn bị trước.',
    },
    {
      situation: 'Phụ huynh cần hỏi thêm người nhà',
      opener:
        'Dạ được ạ. Để anh/chị dễ trao đổi lại với gia đình, em tóm tắt thành 3 ý: mục tiêu của bé, gói phù hợp và chi phí sau ưu đãi.',
      discovery: [
        'Người quyết định thêm thường quan tâm nhất đến chi phí, lịch học hay chất lượng giáo viên?',
        'Anh/chị muốn em gửi bản tóm tắt theo tin nhắn hay gọi lại vào khung giờ nào?',
        'Nếu gia đình đồng ý, mình có thể giữ lịch test trước được không?',
      ],
      pitch:
        'Em gửi nội dung ngắn, không quá nhiều thông tin. Trong đó có bảng giá, ưu đãi, lý do chọn gói và bước tiếp theo để gia đình dễ quyết.',
      close:
        'Em hẹn gọi lại vào đúng khung giờ mình chọn. Trước đó em gửi tin nhắn tóm tắt để anh/chị chuyển tiếp.',
    },
  ];

  protected readonly objectionResponses: ObjectionResponse[] = [
    {
      objection: 'Để chị suy nghĩ thêm',
      response:
        'Dạ được ạ. Em xin phép chốt lại mình đang cân nhắc phần nào: học phí, lịch học hay chất lượng giáo viên để em gửi đúng thông tin, tránh làm phiền.',
      nextAction: 'Ghi lý do do dự vào Lead và đặt lịch follow-up cụ thể.',
    },
    {
      objection: 'Bên khác rẻ hơn',
      response:
        'Dạ mình nên so theo số buổi, thời lượng, chất lượng giáo viên và cam kết theo sát. Em gửi bảng đơn giá/buổi để mình nhìn rõ hơn.',
      nextAction: 'Mở bảng giá, gửi so sánh theo đơn giá/buổi và đề xuất test.',
    },
    {
      objection: 'Bé bận, chưa xếp được lịch',
      response:
        'Dạ vậy em ưu tiên tìm khung học ổn định trước. Mình chỉ nên chốt gói khi lịch học có thể duy trì, nếu không hiệu quả sẽ bị đứt quãng.',
      nextAction: 'Ghi 2-3 khung giờ rảnh, chuyển OPS/GV trải nghiệm nếu cần test.',
    },
    {
      objection: 'Muốn học thử rồi tính',
      response:
        'Dạ hợp lý ạ. Buổi test là để xác nhận nền học và phong cách giáo viên. Sau test em mới tư vấn gói cuối cùng cho chắc.',
      nextAction: 'Tạo buổi test, gửi bối cảnh học sinh cho GV trải nghiệm.',
    },
  ];

  protected readonly messageTemplates: MessageTemplate[] = [
    {
      title: 'Gửi bảng giá sau tư vấn',
      context: 'Sau cuộc gọi',
      body:
        'Em gửi anh/chị tóm tắt phương án cho bé:\n' +
        '- Mục tiêu học: [mục tiêu]\n' +
        '- Gói phù hợp: [tên gói]\n' +
        '- Số buổi/thời lượng: [số buổi] buổi, [phút] phút/buổi\n' +
        '- Học phí: [giá gói]\n' +
        '- Ưu đãi hiện tại: [ưu đãi nếu có]\n\n' +
        'Để chọn gói chính xác hơn, em đề xuất mình đặt một buổi test trước để giáo viên đánh giá nền của bé ạ.',
    },
    {
      title: 'Nhắc lịch test',
      context: 'Trước buổi test',
      body:
        'Em nhắc lại lịch test của bé:\n' +
        '- Môn: [môn]\n' +
        '- Thời gian: [ngày giờ]\n' +
        '- Hình thức: [online/offline]\n' +
        '- Giáo viên trải nghiệm: [tên GV nếu có]\n\n' +
        'Mục tiêu buổi test là đánh giá nền hiện tại và xem phong cách học phù hợp, sau đó em gửi lại nhận xét và gói học đề xuất cho gia đình.',
    },
    {
      title: 'Follow-up sau test',
      context: 'Sau buổi test',
      body:
        'Em gửi anh/chị nhận xét nhanh sau buổi test:\n' +
        '- Điểm mạnh của bé: [điểm mạnh]\n' +
        '- Phần cần cải thiện: [điểm yếu]\n' +
        '- Hướng học đề xuất: [hướng học]\n' +
        '- Gói phù hợp: [tên gói]\n\n' +
        'Nếu gia đình đồng ý, em tạo đơn đăng ký theo gói này và gửi thông tin thanh toán để giữ lịch học cho bé ạ.',
    },
    {
      title: 'Chốt đơn và bàn giao',
      context: 'Khi phụ huynh đồng ý',
      body:
        'Em xác nhận thông tin đăng ký cho bé:\n' +
        '- Phụ huynh: [tên PH] - [SĐT]\n' +
        '- Học sinh: [tên HS]\n' +
        '- Gói học: [tên gói]\n' +
        '- Tổng tiền sau ưu đãi: [số tiền]\n' +
        '- Lịch mong muốn: [khung lịch]\n\n' +
        'Em sẽ tạo đơn trên hệ thống. Sau khi thanh toán/duyệt đơn hoàn tất, đội vận hành sẽ xác nhận lịch học chính thức.',
    },
  ];

  protected readonly saleKitStages: SaleKitStage[] = [
    {
      stage: 'NEW',
      title: 'Lead mới',
      actions: [
        'Gọi hoặc nhắn trong ngày lead phát sinh.',
        'Xác định môn học, lớp, mục tiêu và khung giờ rảnh.',
        'Ghi nguồn lead và ghi chú tư vấn đầu tiên.',
      ],
    },
    {
      stage: 'QUALIFIED',
      title: 'Đã xác định nhu cầu',
      actions: [
        'Mở bảng giá để chọn 1-2 gói phù hợp.',
        'Gửi ưu đãi đúng điều kiện, không hứa ngoài chính sách.',
        'Đề xuất lịch test nếu phụ huynh chưa sẵn sàng chốt.',
      ],
    },
    {
      stage: 'TRIAL',
      title: 'Đã hẹn test',
      actions: [
        'Tạo buổi test và điền đầy đủ bối cảnh học sinh.',
        'Nhắc lịch trước buổi test.',
        'Sau test, lấy nhận xét GV trải nghiệm để follow-up.',
      ],
    },
    {
      stage: 'CLOSING',
      title: 'Chuẩn bị chốt đơn',
      actions: [
        'Tóm tắt mục tiêu, gói học, giá và ưu đãi bằng tin nhắn.',
        'Xác nhận thông tin phụ huynh/học sinh trước khi tạo đơn.',
        'Tạo đơn đăng ký và theo dõi trạng thái duyệt.',
      ],
    },
    {
      stage: 'HANDOFF',
      title: 'Bàn giao vận hành',
      actions: [
        'Chỉ bàn giao khi đơn đã đủ điều kiện tài chính.',
        'Ghi rõ lịch mong muốn, ghi chú học tập và yêu cầu giáo viên.',
        'Theo dõi đến khi lớp được tạo hoặc có phản hồi từ OPS.',
      ],
    },
    {
      stage: 'LOST',
      title: 'Rớt deal',
      actions: [
        'Ghi đúng lý do rớt: giá, lịch, giáo viên, đối thủ hay chưa có nhu cầu.',
        'Đặt lịch chăm sóc lại nếu còn cơ hội.',
        'Không để lead rớt mà không có ghi chú.',
      ],
    },
  ];

  protected readonly workflowSteps: WorkflowStep[] = [
    {
      step: '01',
      title: 'Tiếp nhận và xử lý Lead',
      who: 'Sale',
      summary:
        'Xem danh sách lead mới từ landing page hoặc được assign. Liên hệ xác nhận nhu cầu, cập nhật trạng thái và chốt lịch học thử.',
      checklist: [
        'Mở màn hình Leads, lọc theo trạng thái NEW hoặc FOLLOW_UP.',
        'Gọi điện hoặc nhắn tin trong vòng 30 phút kể từ khi lead vào.',
        'Cập nhật trạng thái lead: INTERESTED / NOT_INTERESTED / FOLLOW_UP / CONVERTED.',
        'Ghi chú nội dung cuộc trao đổi vào trường ghi chú của lead.',
        'Nếu phụ huynh đồng ý, chốt thời gian học thử và chuyển sang bước tạo tài khoản.',
      ],
      note: 'Lead phải được cập nhật trạng thái trong ngày — không để nguyên trạng thái NEW quá 24 giờ.',
      route: '/app/leads',
      allowedRoles: [Role.DIRECTOR, Role.OPS, Role.SALE],
      color: 'amber',
    },
    {
      step: '02',
      title: 'Tạo tài khoản Phụ huynh',
      who: 'Sale',
      summary:
        'Tạo parent account, nhập đầy đủ thông tin người bảo hộ và gắn owner là chính sale ngay từ lúc tạo.',
      checklist: [
        'Nhập đầy đủ: họ tên, email, số điện thoại, địa chỉ và link Facebook (nếu có).',
        'Kiểm tra trùng lặp trước khi tạo — tìm theo email hoặc số điện thoại.',
        'Tài khoản phụ huynh do sale tạo sẽ có owner mặc định là sale đó.',
        'Sale được tạo và sửa parent account — không được xóa.',
        'Khi cần chuyển owner sang sale khác, ghi chú lý do và nhờ Director thao tác.',
      ],
      note: 'Mục tiêu: có một parent record sạch, đúng owner, đúng thông tin liên hệ ngay từ lần đầu.',
      route: '/app/users',
      queryParams: { role: 'PARENT' },
      allowedRoles: [Role.DIRECTOR, Role.SALE],
      color: 'teal',
    },
    {
      step: '03',
      title: 'Tạo Học sinh gắn vào Phụ huynh',
      who: 'Sale',
      summary:
        'Thêm học sinh và liên kết đúng vào parent account vừa tạo để dữ liệu không bị rời và truy xuất dễ sau này.',
      checklist: [
        'Nhập họ tên, ngày sinh, giới tính và thông tin học lực cơ bản của học sinh.',
        'Chọn đúng parentUserId trước khi lưu — đây là trường bắt buộc.',
        'Rà soát trường "sale phụ trách" trong hồ sơ học sinh để khớp với owner của phụ huynh.',
        'Nếu học sinh đã có tài khoản cũ, kiểm tra duplicate trước khi tạo mới.',
      ],
      note: 'Học sinh phải được gắn đúng phụ huynh trước khi lập hóa đơn. Không để trường parentUserId trống.',
      route: '/app/students',
      allowedRoles: [Role.DIRECTOR, Role.OPS, Role.SALE, Role.ACCOUNTING],
      color: 'orange',
    },
    {
      step: '04',
      title: 'Lập Hóa đơn và chờ phê duyệt',
      who: 'Sale',
      summary:
        'Lập hóa đơn đúng gói, đúng số tiền và để trạng thái PENDING_APPROVAL. Chờ Kế toán hoặc Director xác nhận.',
      checklist: [
        'Chọn đúng gói sản phẩm, số buổi học và đơn giá.',
        'Kiểm tra tổng tiền và mô tả gói trước khi lưu.',
        'Đặt trạng thái PENDING_APPROVAL — không để DRAFT nếu đã gửi cho phụ huynh.',
        'Thông báo cho Kế toán hoặc Director biết có hóa đơn cần duyệt.',
        'Chụp màn hình hoặc copy link hóa đơn để theo dõi tiến độ duyệt.',
      ],
      warning:
        'Không được chuyển sang bước tạo lớp khi hóa đơn vẫn còn trạng thái PENDING_APPROVAL.',
      note: 'Đây là mốc cần phối hợp với Kế toán hoặc Director. Sale không tự duyệt hóa đơn của mình.',
      route: '/app/invoices',
      allowedRoles: [Role.DIRECTOR, Role.OPS, Role.SALE, Role.ACCOUNTING],
      color: 'blue',
    },
    {
      step: '05',
      title: 'Kiểm tra điều kiện tài chính (Gate)',
      who: 'Sale kiểm tra — Kế toán/Director xác nhận',
      summary:
        'Trước khi tạo lớp, Sale phải tự kiểm tra một trong hai điều kiện tài chính. Chưa đủ thì dừng lại.',
      checklist: [
        'Điều kiện 1: Hóa đơn có trạng thái APPROVED — Kế toán hoặc Director đã xác nhận.',
        'Điều kiện 2: Phụ huynh đã nạp tiền và số dư trong ví ≥ giá trị hóa đơn.',
        'Vào màn hình Ví (/app/wallets) để đối chiếu số dư thực tế — không dựa vào lời nói.',
        'Nếu chưa đủ: ghi chú tình trạng vào lead/phụ huynh và thông báo cho phụ huynh.',
        'Phối hợp với Kế toán để đẩy nhanh tiến độ duyệt hoặc hướng dẫn phụ huynh nạp tiền.',
      ],
      warning:
        'Nếu cả hai điều kiện chưa thỏa — dừng lại, không tạo lớp, không ngoại lệ.',
      note: 'Đây là điểm chặn duy nhất trong quy trình. Vượt qua gate này mới được sang bước tạo lớp.',
      color: 'rose',
    },
    {
      step: '06',
      title: 'Tạo Lớp học',
      who: 'Sale / OPS',
      summary:
        'Sau khi qua được gate tài chính, tạo class, gắn học sinh, chọn giáo viên và chốt thông tin vận hành.',
      checklist: [
        'Chọn đúng cấp độ lớp, môn học và ca học phù hợp với học sinh.',
        'Gắn học sinh vào lớp — kiểm tra lại parentUserId và hóa đơn liên kết.',
        'Chỉ định giáo viên và xác nhận lịch dạy.',
        'Đối chiếu lại: sale phụ trách, parent owner và thông tin học sinh trước khi lưu lớp.',
        'Thông báo cho phụ huynh và giáo viên về lịch học đã được xác nhận.',
      ],
      note: 'Điểm kết thúc quy trình: lớp được tạo khi tất cả đầu vào đã sẵn sàng và tài chính đã xác nhận.',
      route: '/app/classes',
      allowedRoles: [Role.DIRECTOR, Role.OPS, Role.SALE],
      color: 'slate',
    },
  ];

  protected readonly permissions: PermissionRow[] = [
    { action: 'Xem danh sách lead',                          sale: true,  director: true,  accounting: false, ops: true  },
    { action: 'Cập nhật trạng thái lead',                    sale: true,  director: true,  accounting: false, ops: true  },
    { action: 'Tạo tài khoản phụ huynh',                    sale: true,  director: true,  accounting: false, ops: true  },
    { action: 'Sửa tài khoản phụ huynh',                    sale: true,  director: true,  accounting: false, ops: true  },
    { action: 'Xóa tài khoản phụ huynh',                    sale: false, director: true,  accounting: false, ops: false },
    { action: 'Chuyển owner phụ huynh sang sale khác',       sale: false, director: true,  accounting: false, ops: false },
    { action: 'Tạo hồ sơ học sinh',                         sale: true,  director: true,  accounting: true,  ops: true  },
    { action: 'Lập hóa đơn',                                 sale: true,  director: true,  accounting: true,  ops: true  },
    { action: 'Phê duyệt hóa đơn',                          sale: false, director: true,  accounting: true,  ops: false },
    { action: 'Xem số dư ví phụ huynh',                     sale: true,  director: true,  accounting: true,  ops: true  },
    { action: 'Tạo lớp học',                                 sale: true,  director: true,  accounting: false, ops: true  },
    { action: 'Xem báo cáo hoa hồng của mình',              sale: true,  director: true,  accounting: true,  ops: false },
  ];

  protected readonly quickLinks: QuickLink[] = [
    { title: 'Leads',            description: 'Tiếp nhận lead mới, cập nhật trạng thái và chốt lịch học thử.',                   route: '/app/leads',             badge: '01' },
    { title: 'Đơn đăng ký',      description: 'Cách 1 — tạo đơn tổng hợp gồm PH, HS, lớp và hóa đơn trong một form.',           route: '/app/orders',            badge: 'C1' },
    { title: 'Phụ huynh',        description: 'Cách 2 — tạo & sửa tài khoản phụ huynh riêng theo danh mục sale phụ trách.',     route: '/app/users',             queryParams: { role: 'PARENT' }, badge: '02' },
    { title: 'Học sinh',          description: 'Cách 2 — tạo hồ sơ học sinh, gắn phụ huynh và kiểm tra thông tin.',              route: '/app/students',          badge: '03' },
    { title: 'Hóa đơn',          description: 'Lập hóa đơn, theo dõi trạng thái PENDING → APPROVED, đối chiếu trước tạo lớp.',  route: '/app/invoices',          badge: '04' },
    { title: 'Lớp học',          description: 'Tạo lớp sau khi qua gate tài chính, gắn học sinh và giáo viên.',                  route: '/app/classes',           badge: '05' },
    { title: 'Hoa hồng',         description: 'Đối chiếu doanh số, hóa đơn đã chốt và kết quả hoa hồng theo kỳ.',               route: '/app/commission-report', badge: 'KH' },
  ];

  protected readonly faqs: FAQItem[] = [
    {
      question: 'Điểm dừng quan trọng nhất trong quy trình là bước nào?',
      answer:
        'Bước 05 — Gate tài chính. Nếu hóa đơn chưa được duyệt VÀ phụ huynh chưa có đủ số dư, tuyệt đối không tạo lớp. Đây là quy tắc không có ngoại lệ.',
    },
    {
      question: 'Sale được làm gì với tài khoản phụ huynh?',
      answer:
        'Sale được tạo và sửa parent account trong danh mục mình phụ trách. Sale không được xóa parent. Khi cần chuyển owner sang sale khác, ghi chú rõ lý do và nhờ Director thao tác.',
    },
    {
      question: 'Tại sao phải tạo học sinh trước khi lập hóa đơn?',
      answer:
        'Để đảm bảo dữ liệu không bị rời: hóa đơn và lớp học về sau sẽ truy nguồn đúng về đúng học sinh và đúng phụ huynh. Thiếu bước này dễ gây sai sót khi đối chiếu sau.',
    },
    {
      question: 'Ai được phê duyệt hóa đơn?',
      answer:
        'Chỉ Kế toán và Director mới được phê duyệt hóa đơn. Sale lập hóa đơn, đặt trạng thái PENDING_APPROVAL và thông báo cho Kế toán/Director — không tự duyệt.',
    },
    {
      question: 'Nếu phụ huynh muốn chuyển sang sale khác phụ trách thì làm thế nào?',
      answer:
        'Sale ghi chú lý do yêu cầu chuyển vào hồ sơ phụ huynh, sau đó liên hệ Director. Director sẽ đổi owner. Sau khi đổi owner, cần rà soát lại các học sinh đang gắn với phụ huynh đó.',
    },
    {
      question: 'Hoa hồng được tính như thế nào?',
      answer:
        'Hoa hồng tính theo hóa đơn đã được duyệt (APPROVED) trong kỳ. Xem chi tiết tại màn hình Commission Report — lọc theo tên sale và tháng cần đối chiếu.',
    },
  ];

  protected setHubTab(tab: SaleHubTab): void {
    this.activeHubTab = tab;
  }

  protected copyText(text: string): void {
    void navigator.clipboard?.writeText(text);
  }

  protected canOpenRoute(allowedRoles: Role[]): boolean {
    const role = this.currentRole();
    return !!role && allowedRoles.includes(role);
  }
}

