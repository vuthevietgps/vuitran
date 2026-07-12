import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { Role } from '../models/role.enum';

interface AccWorkflowStep {
  step: string;
  title: string;
  summary: string;
  checklist: string[];
  warning?: string;
  note: string;
  route?: string;
  color: 'emerald' | 'teal' | 'cyan' | 'amber' | 'rose' | 'slate';
}

interface QuickLink {
  title: string;
  description: string;
  route: string;
  badge: string;
}

interface PermissionRow {
  action: string;
  accounting: boolean;
  director: boolean;
  ops: boolean;
}

interface FAQItem {
  question: string;
  answer: string;
}

@Component({
  selector: 'app-accounting-guide-landing',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="acc-hub">

      <!-- ══ HERO ══════════════════════════════════════════════════════ -->
      <section class="hero-card">
        <div class="hero-copy">
          <span class="eyebrow">Accounting Hub · Kế toán tài chính</span>
          <h1>Một chu trình đối soát — sáu điểm kiểm soát tài chính</h1>
          <p class="hero-text">
            Trang này là điểm bắt đầu cho kế toán: từ duyệt top-up, xử lý hóa đơn, đóng kỳ lương giáo viên,
            kiểm soát chi phí đến đối soát ngân hàng và xuất báo cáo cuối kỳ. Mỗi bước đều cần đúng thứ tự
            để số liệu khớp nhau và không phát sinh sai lệch sổ sách.
          </p>
          <div class="hero-actions">
            <a class="btn btn-primary" href="#pipeline">Xem chu trình đầy đủ</a>
            <a class="btn btn-secondary" [routerLink]="'/app/wallets'">Mở Wallets</a>
            <a class="btn btn-ghost" [routerLink]="'/app/payroll'">Mở Payroll</a>
          </div>
          <div class="hero-rules">
            <div class="rule-item rule-emerald">
              <span class="rule-label">Thứ tự thực hiện</span>
              <span>Phải đi đúng thứ tự: hóa đơn → ví → payroll → đối soát. Không bỏ bước giữa dù có áp lực thời gian</span>
            </div>
            <div class="rule-item rule-teal">
              <span class="rule-label">Phạm vi quyền kế toán</span>
              <span>Kế toán duyệt top-up, chuyển ví, chốt lương và kiểm soát tài chính — OPS không có các thao tác này</span>
            </div>
            <div class="rule-item rule-slate">
              <span class="rule-label">Chứng từ &amp; đối soát</span>
              <span>Mọi thay đổi số dư ví hoặc trạng thái hóa đơn đều ghi nhận audit log — không tự chỉnh số liệu ngoài luồng hệ thống</span>
            </div>
          </div>
        </div>
        <div class="hero-visual">
          <div class="hero-stat-grid">
            <div class="hero-stat">
              <span class="stat-icon">&#128176;</span>
              <span class="stat-label">Wallets</span>
              <span class="stat-sub">Ví &amp; ledger</span>
            </div>
            <div class="hero-stat">
              <span class="stat-icon">&#128196;</span>
              <span class="stat-label">Invoices</span>
              <span class="stat-sub">Hóa đơn</span>
            </div>
            <div class="hero-stat">
              <span class="stat-icon">&#128181;</span>
              <span class="stat-label">Payroll</span>
              <span class="stat-sub">Kỳ lương GV</span>
            </div>
            <div class="hero-stat">
              <span class="stat-icon">&#127974;</span>
              <span class="stat-label">Financial Control</span>
              <span class="stat-sub">Kiểm soát cuối kỳ</span>
            </div>
            <div class="hero-stat">
              <span class="stat-icon">&#128200;</span>
              <span class="stat-label">Reports</span>
              <span class="stat-sub">Xuất báo cáo</span>
            </div>
            <div class="hero-stat">
              <span class="stat-icon">&#128203;</span>
              <span class="stat-label">Aging Report</span>
              <span class="stat-sub">Công nợ phải thu</span>
            </div>
          </div>
        </div>
      </section>

      <!-- ══ PIPELINE ═══════════════════════════════════════════════════ -->
      <section class="section section-pipeline" id="pipeline">
        <div class="section-heading">
          <div>
            <span class="section-kicker">Chu trình tổng quan</span>
            <h2>Sáu bước kiểm soát tài chính đúng thứ tự</h2>
            <p class="section-summary">
              Chu trình này lặp lại hàng ngày (top-up, hóa đơn) và hàng tháng (lương, đối soát, đóng sổ).
              Tuân thủ đúng thứ tự để số liệu nhất quán và audit trail đầy đủ.
            </p>
          </div>
        </div>

        <div class="flow-block">
          <div class="flow-label flow-label-primary">Chu trình kế toán — từ giao dịch hàng ngày đến đóng sổ cuối kỳ</div>
          <div class="pipeline">
            <div class="pipeline-step p-emerald">
              <span class="p-num">01</span>
              <span class="p-label">Dashboard</span>
              <span class="p-sub">Tổng quan tài chính</span>
            </div>
            <span class="pipeline-arrow">›</span>
            <div class="pipeline-step p-teal">
              <span class="p-num">02</span>
              <span class="p-label">Ví &amp; Top-up</span>
              <span class="p-sub">/app/wallets</span>
            </div>
            <span class="pipeline-arrow">›</span>
            <div class="pipeline-step p-cyan">
              <span class="p-num">03</span>
              <span class="p-label">Hóa đơn</span>
              <span class="p-sub">/app/invoices</span>
            </div>
            <span class="pipeline-arrow">›</span>
            <div class="pipeline-step p-amber">
              <span class="p-num">04</span>
              <span class="p-label">Kỳ lương GV</span>
              <span class="p-sub">/app/payroll</span>
            </div>
            <span class="pipeline-arrow">›</span>
            <div class="pipeline-step p-rose">
              <span class="p-num">05</span>
              <span class="p-label">Chi phí &amp; NCC</span>
              <span class="p-sub">expenses · suppliers</span>
            </div>
            <span class="pipeline-arrow">›</span>
            <div class="pipeline-step p-slate">
              <span class="p-num">06</span>
              <span class="p-label">Đối soát &amp; Đóng sổ</span>
              <span class="p-sub">bank-recon · financial-control</span>
            </div>
          </div>
          <p class="flow-note">
            Bước 01–03 diễn ra hàng ngày. Bước 04–05 diễn ra hàng tuần/cuối tháng. Bước 06 là nhịp đóng sổ cuối kỳ.
          </p>
        </div>

        <!-- Nhịp làm việc theo ngày -->
        <div class="daily-rhythm">
          <div class="rhythm-card rhythm-morning">
            <span class="rhythm-label">Đầu ngày</span>
            <h3>Kiểm tra &amp; duyệt giao dịch chờ</h3>
            <ul>
              <li>Mở Dashboard kế toán — xem top-up chờ duyệt, hóa đơn pending và payroll cần xử lý.</li>
              <li>Vào Wallets → tab Pending — duyệt từng yêu cầu nạp tiền, đối chiếu chứng từ.</li>
              <li>Kiểm tra Invoices → trạng thái PENDING — duyệt hoặc từ chối từng hóa đơn.</li>
            </ul>
          </div>
          <div class="rhythm-card rhythm-midday">
            <span class="rhythm-label">Trong ngày</span>
            <h3>Xử lý công nợ &amp; đối soát liên tục</h3>
            <ul>
              <li>Aging Report — theo dõi công nợ phải thu quá hạn, phối hợp sale để nhắc thanh toán.</li>
              <li>Xử lý chi phí phát sinh: Expenses → thêm mới, duyệt và phân loại đúng khoản mục.</li>
              <li>Kiểm tra Supplier Quotes/Payments nếu có đơn hàng NCC cần duyệt trong ngày.</li>
            </ul>
          </div>
          <div class="rhythm-card rhythm-closing">
            <span class="rhythm-label">Cuối ngày / Cuối tháng</span>
            <h3>Đóng kỳ &amp; xuất báo cáo</h3>
            <ul>
              <li>Payroll — đối chiếu teaching report, chốt kỳ lương GV, xuất file thanh toán.</li>
              <li>Bank Reconciliation — đối soát sao kê ngân hàng với ledger trong hệ thống.</li>
              <li>Financial Control → kiểm tra P&amp;L, duyệt ngân sách. Export Reports → xuất CSV.</li>
            </ul>
          </div>
        </div>
      </section>

      <!-- ══ WORKFLOW STEPS ═════════════════════════════════════════════ -->
      <section class="section section-workflow" id="workflow">
        <div class="section-heading">
          <div>
            <span class="section-kicker">Chi tiết từng bước</span>
            <h2>Quy trình đầy đủ theo từng nghiệp vụ</h2>
          </div>
        </div>

        <div class="workflow-grid">
          @for (s of steps; track s.step) {
            <div class="step-card step-{{ s.color }}">
              <div class="step-header">
                <span class="step-badge">{{ s.step }}</span>
                <div class="step-meta">
                  <h3>{{ s.title }}</h3>
                  <p class="step-summary">{{ s.summary }}</p>
                </div>
              </div>
              <ul class="step-checklist">
                @for (item of s.checklist; track item) {
                  <li>{{ item }}</li>
                }
              </ul>
              @if (s.warning) {
                <div class="step-warning">&#9888; {{ s.warning }}</div>
              }
              <div class="step-footer">
                <span class="step-note">{{ s.note }}</span>
                @if (s.route) {
                  <a class="step-link" [routerLink]="s.route">Mở màn hình ›</a>
                }
              </div>
            </div>
          }
        </div>
      </section>

      <!-- ══ PERMISSIONS ═══════════════════════════════════════════════ -->
      <section class="section section-perms" id="permissions">
        <div class="section-heading">
          <div>
            <span class="section-kicker">Phân quyền thao tác</span>
            <h2>Kế toán được và không được làm gì?</h2>
            <p class="section-summary">
              Phân quyền rõ ràng giúp tránh thao tác sai phạm vi. Cột OPS là đối chiếu — những gì OPS làm
              được nhưng kế toán không có (và ngược lại) đều được đánh dấu riêng.
            </p>
          </div>
        </div>

        <div class="perms-table-wrap">
          <table class="perms-table">
            <thead>
              <tr>
                <th>Thao tác</th>
                <th class="col-acc">Kế toán</th>
                <th class="col-dir">Giám đốc</th>
                <th class="col-ops">Vận hành</th>
              </tr>
            </thead>
            <tbody>
              @for (row of permRows; track row.action) {
                <tr>
                  <td>{{ row.action }}</td>
                  <td class="col-acc">
                    <span [class]="row.accounting ? 'perm-yes' : 'perm-no'">{{ row.accounting ? '✓' : '✗' }}</span>
                  </td>
                  <td class="col-dir">
                    <span [class]="row.director ? 'perm-yes' : 'perm-no'">{{ row.director ? '✓' : '✗' }}</span>
                  </td>
                  <td class="col-ops">
                    <span [class]="row.ops ? 'perm-yes' : 'perm-no'">{{ row.ops ? '✓' : '✗' }}</span>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </section>

      <!-- ══ QUICK LINKS ════════════════════════════════════════════════ -->
      <section class="section section-links" id="links">
        <div class="section-heading">
          <div>
            <span class="section-kicker">Truy cập nhanh</span>
            <h2>Các màn hình kế toán dùng hàng ngày</h2>
          </div>
        </div>
        <div class="links-grid">
          @for (lk of quickLinks; track lk.route) {
            <a class="link-card" [routerLink]="lk.route">
              <span class="lk-badge">{{ lk.badge }}</span>
              <span class="lk-title">{{ lk.title }}</span>
              <span class="lk-desc">{{ lk.description }}</span>
            </a>
          }
        </div>
      </section>

      <!-- ══ FAQ ════════════════════════════════════════════════════════ -->
      <section class="section section-faq" id="faq">
        <div class="section-heading">
          <div>
            <span class="section-kicker">Câu hỏi thường gặp</span>
            <h2>Kế toán hay hỏi về nghiệp vụ</h2>
          </div>
        </div>
        <div class="faq-list">
          @for (faq of faqs; track faq.question) {
            <div class="faq-item">
              <div class="faq-q">{{ faq.question }}</div>
              <div class="faq-a">{{ faq.answer }}</div>
            </div>
          }
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
        radial-gradient(circle at top right, rgba(16,185,129,0.12) 0%, transparent 55%),
        radial-gradient(circle at bottom left, rgba(20,184,166,0.09) 0%, transparent 50%),
        linear-gradient(160deg, #f0fdf4 0%, #ecfdf5 40%, #f0fdfa 70%, #fafffe 100%);
      color: #0f2a1a;
      font-family: 'Be Vietnam Pro', 'Segoe UI', sans-serif;
    }

    h1, h2, h3 { margin: 0; font-family: 'Be Vietnam Pro', 'Segoe UI', sans-serif; letter-spacing: -0.03em; }

    a { text-decoration: none; }

    /* ── HERO ─────────────────────────────────────────────────────── */
    .hero-card {
      display: grid;
      grid-template-columns: 1fr 340px;
      gap: 32px;
      background: linear-gradient(135deg, #ffffff 60%, #f0fdf4 100%);
      border: 1px solid rgba(16,185,129,0.18);
      border-radius: 20px;
      padding: 40px;
      margin-bottom: 32px;
      box-shadow: 0 2px 16px rgba(16,185,129,0.08);
    }
    .eyebrow {
      display: inline-block;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: #059669;
      background: rgba(16,185,129,0.1);
      padding: 4px 12px;
      border-radius: 999px;
      margin-bottom: 14px;
    }
    .hero-copy h1 {
      font-size: clamp(1.6rem, 3vw, 2.2rem);
      font-weight: 800;
      line-height: 1.2;
      color: #064e3b;
      margin-bottom: 14px;
    }
    .hero-text {
      font-size: 15px;
      line-height: 1.7;
      color: #374151;
      margin: 0 0 22px;
      max-width: 680px;
    }
    .hero-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-bottom: 22px;
    }
    .btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 10px 20px;
      border-radius: 10px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all .15s;
    }
    .btn-primary { background: #059669; color: #fff; }
    .btn-primary:hover { background: #047857; }
    .btn-secondary { background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; }
    .btn-secondary:hover { background: #d1fae5; }
    .btn-ghost { background: transparent; color: #059669; border: 1px solid rgba(16,185,129,0.3); }
    .btn-ghost:hover { background: rgba(16,185,129,0.06); }

    .hero-rules { display: flex; flex-direction: column; gap: 10px; }
    .rule-item {
      display: flex;
      flex-direction: column;
      gap: 3px;
      padding: 12px 14px;
      border-radius: 10px;
      font-size: 13px;
      line-height: 1.5;
    }
    .rule-label {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      opacity: .75;
      margin-bottom: 2px;
    }
    .rule-emerald { background: rgba(16,185,129,0.08); border-left: 3px solid #10b981; color: #064e3b; }
    .rule-teal    { background: rgba(20,184,166,0.08); border-left: 3px solid #14b8a6; color: #134e4a; }
    .rule-slate   { background: rgba(100,116,139,0.08); border-left: 3px solid #64748b; color: #1e293b; }

    /* Hero visual */
    .hero-visual { display: flex; align-items: center; justify-content: center; }
    .hero-stat-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      width: 100%;
    }
    .hero-stat {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      background: rgba(16,185,129,0.06);
      border: 1px solid rgba(16,185,129,0.15);
      border-radius: 12px;
      padding: 16px 10px;
      gap: 4px;
    }
    .stat-icon { font-size: 24px; }
    .stat-label { font-size: 13px; font-weight: 700; color: #064e3b; }
    .stat-sub { font-size: 11px; color: #6b7280; }

    /* ── SECTIONS ─────────────────────────────────────────────────── */
    .section { margin-bottom: 40px; }
    .section-heading { margin-bottom: 24px; }
    .section-kicker {
      display: inline-block;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: #059669;
      margin-bottom: 6px;
    }
    .section-heading h2 {
      font-size: clamp(1.25rem, 2.5vw, 1.65rem);
      font-weight: 800;
      color: #064e3b;
      margin-bottom: 8px;
    }
    .section-summary { font-size: 14px; color: #6b7280; line-height: 1.6; margin: 0; max-width: 680px; }

    /* ── PIPELINE ─────────────────────────────────────────────────── */
    .flow-block {
      background: #fff;
      border: 1px solid rgba(16,185,129,0.15);
      border-radius: 16px;
      padding: 28px;
      margin-bottom: 24px;
    }
    .flow-label {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      margin-bottom: 20px;
    }
    .flow-label-primary { color: #059669; }
    .pipeline {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 16px;
    }
    .pipeline-step {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      padding: 12px 16px;
      border-radius: 12px;
      min-width: 110px;
      flex: 1;
    }
    .p-num {
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 0.08em;
      margin-bottom: 4px;
      font-family: 'Be Vietnam Pro', 'Segoe UI', sans-serif;
    }
    .p-label { font-size: 13px; font-weight: 700; margin-bottom: 2px; }
    .p-sub { font-size: 10px; opacity: .7; }
    .pipeline-arrow { font-size: 20px; color: #d1d5db; flex-shrink: 0; }

    .p-emerald { background: rgba(16,185,129,0.1);  border: 1px solid rgba(16,185,129,0.25);  color: #064e3b; }
    .p-teal    { background: rgba(20,184,166,0.1);  border: 1px solid rgba(20,184,166,0.25);  color: #134e4a; }
    .p-cyan    { background: rgba(6,182,212,0.1);   border: 1px solid rgba(6,182,212,0.25);   color: #164e63; }
    .p-amber   { background: rgba(245,158,11,0.1);  border: 1px solid rgba(245,158,11,0.25);  color: #78350f; }
    .p-rose    { background: rgba(244,63,94,0.1);   border: 1px solid rgba(244,63,94,0.25);   color: #881337; }
    .p-slate   { background: rgba(100,116,139,0.1); border: 1px solid rgba(100,116,139,0.25); color: #1e293b; }

    .flow-note { font-size: 12px; color: #9ca3af; font-style: italic; margin: 0; }

    /* Daily rhythm */
    .daily-rhythm { display: grid; grid-template-columns: repeat(3,1fr); gap: 16px; }
    .rhythm-card { background: #fff; border-radius: 14px; padding: 22px; border: 1px solid #e5e7eb; }
    .rhythm-label {
      display: inline-block;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      padding: 3px 10px;
      border-radius: 999px;
      margin-bottom: 10px;
    }
    .rhythm-morning  .rhythm-label { background: rgba(16,185,129,0.12); color: #059669; }
    .rhythm-midday   .rhythm-label { background: rgba(245,158,11,0.12); color: #d97706; }
    .rhythm-closing  .rhythm-label { background: rgba(100,116,139,0.12); color: #475569; }
    .rhythm-card h3 { font-size: 15px; font-weight: 700; color: #1f2937; margin-bottom: 12px; }
    .rhythm-card ul { margin: 0; padding-left: 18px; }
    .rhythm-card ul li { font-size: 13px; color: #4b5563; line-height: 1.55; margin-bottom: 6px; }

    /* ── WORKFLOW STEPS ───────────────────────────────────────────── */
    .workflow-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; }
    .step-card {
      background: #fff;
      border-radius: 16px;
      padding: 24px;
      border: 1px solid #e5e7eb;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .step-header { display: flex; gap: 14px; align-items: flex-start; }
    .step-badge {
      flex-shrink: 0;
      width: 42px;
      height: 42px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 13px;
      font-weight: 800;
    }
    .step-meta h3 { font-size: 16px; font-weight: 700; margin-bottom: 4px; }
    .step-summary { font-size: 13px; color: #6b7280; line-height: 1.5; margin: 0; }
    .step-checklist { margin: 0; padding-left: 20px; }
    .step-checklist li { font-size: 13.5px; color: #374151; line-height: 1.55; margin-bottom: 6px; }
    .step-warning {
      font-size: 12.5px;
      padding: 10px 14px;
      border-radius: 8px;
      background: rgba(245,158,11,0.08);
      border: 1px solid rgba(245,158,11,0.25);
      color: #92400e;
    }
    .step-footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: auto; }
    .step-note { font-size: 12px; color: #9ca3af; font-style: italic; flex: 1; }
    .step-link {
      font-size: 12.5px;
      font-weight: 700;
      white-space: nowrap;
      padding: 6px 12px;
      border-radius: 8px;
    }

    .step-emerald .step-badge { background: rgba(16,185,129,0.12); color: #059669; }
    .step-emerald .step-meta h3 { color: #064e3b; }
    .step-emerald .step-link { background: rgba(16,185,129,0.08); color: #059669; }
    .step-emerald .step-link:hover { background: rgba(16,185,129,0.16); }

    .step-teal .step-badge { background: rgba(20,184,166,0.12); color: #0d9488; }
    .step-teal .step-meta h3 { color: #134e4a; }
    .step-teal .step-link { background: rgba(20,184,166,0.08); color: #0d9488; }
    .step-teal .step-link:hover { background: rgba(20,184,166,0.16); }

    .step-cyan .step-badge { background: rgba(6,182,212,0.12); color: #0891b2; }
    .step-cyan .step-meta h3 { color: #164e63; }
    .step-cyan .step-link { background: rgba(6,182,212,0.08); color: #0891b2; }
    .step-cyan .step-link:hover { background: rgba(6,182,212,0.16); }

    .step-amber .step-badge { background: rgba(245,158,11,0.12); color: #d97706; }
    .step-amber .step-meta h3 { color: #78350f; }
    .step-amber .step-link { background: rgba(245,158,11,0.08); color: #d97706; }
    .step-amber .step-link:hover { background: rgba(245,158,11,0.16); }

    .step-rose .step-badge { background: rgba(244,63,94,0.12); color: #e11d48; }
    .step-rose .step-meta h3 { color: #881337; }
    .step-rose .step-link { background: rgba(244,63,94,0.08); color: #e11d48; }
    .step-rose .step-link:hover { background: rgba(244,63,94,0.16); }

    .step-slate .step-badge { background: rgba(100,116,139,0.12); color: #475569; }
    .step-slate .step-meta h3 { color: #1e293b; }
    .step-slate .step-link { background: rgba(100,116,139,0.08); color: #475569; }
    .step-slate .step-link:hover { background: rgba(100,116,139,0.16); }

    /* ── PERMISSIONS TABLE ────────────────────────────────────────── */
    .perms-table-wrap {
      background: #fff;
      border-radius: 16px;
      border: 1px solid #e5e7eb;
      overflow: hidden;
    }
    .perms-table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
    .perms-table thead { background: #f9fafb; }
    .perms-table th { padding: 12px 16px; text-align: left; font-size: 12px; font-weight: 700; letter-spacing: 0.05em; color: #6b7280; border-bottom: 1px solid #e5e7eb; }
    .perms-table td { padding: 12px 16px; border-bottom: 1px solid #f3f4f6; color: #374151; }
    .perms-table tr:last-child td { border-bottom: none; }
    .perms-table tr:hover td { background: #f9fafb; }
    .col-acc { text-align: center; }
    .col-dir { text-align: center; }
    .col-ops { text-align: center; }
    .perm-yes { display: inline-block; color: #059669; font-weight: 700; font-size: 16px; }
    .perm-no  { display: inline-block; color: #d1d5db; font-weight: 700; font-size: 16px; }

    /* ── QUICK LINKS ──────────────────────────────────────────────── */
    .links-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
    .link-card {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 20px;
      background: #fff;
      border: 1px solid rgba(16,185,129,0.18);
      border-radius: 14px;
      transition: all .15s;
      color: inherit;
    }
    .link-card:hover { border-color: #10b981; box-shadow: 0 4px 16px rgba(16,185,129,0.12); transform: translateY(-2px); }
    .lk-badge {
      font-size: 18px;
      width: 40px;
      height: 40px;
      background: rgba(16,185,129,0.08);
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 4px;
    }
    .lk-title { font-size: 14px; font-weight: 700; color: #064e3b; }
    .lk-desc { font-size: 12px; color: #6b7280; line-height: 1.4; }

    /* ── FAQ ──────────────────────────────────────────────────────── */
    .faq-list { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
    .faq-item {
      background: #fff;
      border: 1px solid #e5e7eb;
      border-radius: 14px;
      padding: 20px;
    }
    .faq-q {
      font-size: 14px;
      font-weight: 700;
      color: #064e3b;
      margin-bottom: 8px;
    }
    .faq-a { font-size: 13px; color: #6b7280; line-height: 1.6; }

    @media (max-width: 1100px) {
      .hero-card { grid-template-columns: 1fr; }
      .hero-visual { display: none; }
      .daily-rhythm { grid-template-columns: 1fr; }
      .workflow-grid { grid-template-columns: 1fr; }
      .links-grid { grid-template-columns: repeat(2, 1fr); }
      .faq-list { grid-template-columns: 1fr; }
    }
  `],
})
export class AccountingGuideLandingComponent {
  readonly steps: AccWorkflowStep[] = [
    {
      step: '01',
      title: 'Dashboard — Tổng quan tài chính đầu ngày',
      summary: 'Bước đầu tiên mỗi ngày: mở dashboard kế toán để nắm nhanh các chỉ số cần xử lý.',
      checklist: [
        'Kiểm tra danh sách top-up chờ duyệt (số lượng và tổng giá trị).',
        'Xem hóa đơn PENDING — ưu tiên những hóa đơn gần hạn duyệt.',
        'Đọc tổng doanh thu, chi phí GV và lợi nhuận gộp trong kỳ đang xem.',
        'Xem payroll theo trạng thái để biết kỳ lương nào đang chờ chốt.',
        'Ghi nhận các số liệu bất thường để theo dõi trong ngày.',
      ],
      note: 'Dashboard là điểm xuất phát — không bỏ qua bước này dù ngày bận.',
      route: '/app/dashboard',
      color: 'emerald',
    },
    {
      step: '02',
      title: 'Wallets — Duyệt top-up & quản lý ví phụ huynh',
      summary: 'Kế toán (không phải OPS) có quyền duyệt yêu cầu nạp tiền và thực hiện chuyển ví.',
      checklist: [
        'Vào Wallets → tab Pending — xem toàn bộ yêu cầu nạp tiền chờ duyệt.',
        'Đối chiếu từng yêu cầu với chứng từ chuyển khoản do phụ huynh cung cấp.',
        'Duyệt (APPROVED) hoặc từ chối (REJECTED) kèm ghi chú lý do.',
        'Sau khi duyệt, kiểm tra lại ledger để xác nhận số dư được cập nhật đúng.',
        'Nếu cần chuyển ví giữa hai tài khoản phụ huynh, thực hiện tại tab Chuyển ví (chỉ giám đốc và kế toán).',
        'Xuất lịch sử giao dịch nếu phụ huynh yêu cầu sao kê.',
      ],
      warning: 'Không duyệt top-up nếu chưa nhận được chứng từ chuyển khoản hợp lệ. Mọi duyệt nhầm sẽ ghi vào audit log và không thể hoàn tác tự động.',
      note: 'Chuyển ví là đặc quyền của kế toán và giám đốc — OPS không thực hiện được thao tác này.',
      route: '/app/wallets',
      color: 'teal',
    },
    {
      step: '03',
      title: 'Invoices — Xử lý hóa đơn & theo dõi công nợ',
      summary: 'Duyệt hóa đơn, theo dõi trạng thái thanh toán và kiểm soát công nợ phải thu.',
      checklist: [
        'Mở Invoices — lọc theo trạng thái PENDING để xử lý ưu tiên.',
        'Đọc chi tiết hóa đơn: học sinh, gói học, số buổi, số tiền và ngày tạo.',
        'Duyệt hóa đơn (APPROVED) — hệ thống tự động nạp vào ví phụ huynh sau khi duyệt.',
        'Đánh dấu PAID cho những hóa đơn đã nhận đủ thanh toán thực tế.',
        'Kiểm tra Aging Report (/app/aging-report) để theo dõi công nợ quá hạn 30/60/90 ngày.',
        'Phối hợp với Sale khi cần nhắc phụ huynh thanh toán công nợ quá hạn.',
      ],
      note: 'Hóa đơn CANCELLED có thể kích hoạt hoàn tiền tự động vào ví — kiểm tra ledger sau khi hủy.',
      route: '/app/invoices',
      color: 'cyan',
    },
    {
      step: '04',
      title: 'Payroll — Đóng kỳ lương giáo viên',
      summary: 'Đối chiếu teaching report với session, chốt kỳ lương và xuất file thanh toán.',
      checklist: [
        'Mở Teaching Report — kiểm tra danh sách buổi học đã có báo cáo giảng dạy.',
        'So sánh với Sessions để phát hiện buổi thiếu báo cáo (ảnh hưởng phạt trễ hạn).',
        'Vào Payroll — xem kỳ lương DRAFT, đối chiếu số buổi, thưởng/phạt từng giáo viên.',
        'Chuyển trạng thái PENDING_APPROVAL → APPROVED → PAID sau khi đã chốt số.',
        'Nếu có giáo viên phụ, kiểm tra Staff Payroll (/app/staff-payroll) riêng.',
        'Xuất file báo cáo payroll qua Export Reports để lưu hồ sơ tháng.',
      ],
      warning: 'Giáo viên nộp báo cáo trễ hơn 24h sau buổi học sẽ bị phạt tự động. Kế toán không nên tự điều chỉnh khoản phạt này nếu chưa có chỉ đạo từ giám đốc.',
      note: 'Salary Config (/app/salary-config) do kế toán và giám đốc quản lý — OPS không có quyền thay đổi.',
      route: '/app/payroll',
      color: 'amber',
    },
    {
      step: '05',
      title: 'Chi phí & NCC — Theo dõi chi tiêu vận hành',
      summary: 'Ghi nhận, phân loại và duyệt chi phí phát sinh cùng thanh toán nhà cung cấp.',
      checklist: [
        'Mở Expenses — thêm mới chi phí phát sinh, phân loại theo khoản mục (vận hành, marketing, nhân sự, khác).',
        'Cập nhật trạng thái thanh toán chi phí (PENDING → PAID).',
        'Kiểm tra Supplier Quotes (/app/supplier-quotes) — xem các báo giá đang chờ duyệt.',
        'Duyệt hoặc từ chối báo giá NCC, ghi chú lý do khi từ chối.',
        'Vào Supplier Payments (/app/payments/supplier) — thanh toán NCC sau khi nghiệm thu dịch vụ.',
        'Kiểm tra Loans (/app/loans) nếu có vốn vay đang trong kỳ theo dõi.',
      ],
      note: 'Chi phí và NCC cần ghi đầy đủ để Financial Control tổng hợp P&L chính xác cuối kỳ.',
      route: '/app/expenses',
      color: 'rose',
    },
    {
      step: '06',
      title: 'Đối soát ngân hàng & Đóng sổ cuối kỳ',
      summary: 'Đối soát sao kê ngân hàng, kiểm soát tài chính tổng thể và xuất báo cáo cuối tháng.',
      checklist: [
        'Bank Reconciliation (/app/bank-reconciliation) — nhập sao kê ngân hàng, đối chiếu với ledger hệ thống.',
        'Phát hiện và xử lý chênh lệch: giao dịch thiếu, nhầm số tiền hoặc chưa cập nhật.',
        'Mở Financial Control (/app/financial-control) — xem P&L, doanh thu/chi phí/lợi nhuận gộp toàn kỳ.',
        'Đối chiếu từng khoản mục chi phí với thực chi trong Expenses.',
        'Export Reports (/app/export-reports) — xuất CSV: Payroll, Invoices, Ledger, Sessions.',
        'Lưu file báo cáo tháng và cập nhật trạng thái kỳ kế toán đã đóng.',
      ],
      warning: 'Financial Control hiển thị số liệu tổng hợp — mọi điều chỉnh phải thực hiện qua đúng module nguồn (Wallets/Invoices/Payroll), không chỉnh trực tiếp trên Financial Control.',
      note: 'Bước đóng sổ cần hoàn thành bước 02–05 trước. Không đóng sổ khi còn hóa đơn hoặc payroll chưa duyệt.',
      route: '/app/financial-control',
      color: 'slate',
    },
  ];

  readonly permRows: PermissionRow[] = [
    { action: 'Xem dashboard tài chính', accounting: true, director: true, ops: false },
    { action: 'Duyệt yêu cầu top-up (nạp ví)', accounting: true, director: true, ops: false },
    { action: 'Chuyển ví giữa phụ huynh', accounting: true, director: true, ops: false },
    { action: 'Xem & duyệt hóa đơn', accounting: true, director: true, ops: true },
    { action: 'Xem & quản lý ví', accounting: true, director: true, ops: true },
    { action: 'Cấu hình lương (salary-config)', accounting: true, director: true, ops: false },
    { action: 'Xem & chốt payroll GV', accounting: true, director: true, ops: true },
    { action: 'Quản lý bảng lương NV', accounting: true, director: true, ops: true },
    { action: 'Quản lý chi phí', accounting: true, director: true, ops: true },
    { action: 'Duyệt báo giá & thanh toán NCC', accounting: true, director: true, ops: true },
    { action: 'Kiểm soát tài chính (Financial Control)', accounting: true, director: true, ops: false },
    { action: 'Đối soát ngân hàng', accounting: true, director: true, ops: false },
    { action: 'Công nợ phải thu (Aging Report)', accounting: true, director: true, ops: false },
    { action: 'Quản lý vốn vay (Loans)', accounting: true, director: true, ops: false },
    { action: 'Xuất báo cáo (Export Reports)', accounting: true, director: true, ops: false },
    { action: 'Đọc báo cáo học sinh (đối chiếu)', accounting: true, director: true, ops: true },
    { action: 'Audit log (toàn bộ)', accounting: false, director: true, ops: false },
    { action: 'Quản lý người dùng', accounting: false, director: true, ops: false },
  ];

  readonly quickLinks: QuickLink[] = [
    { title: 'Dashboard kế toán', description: 'Tổng quan tài chính: top-up, ví, payroll và doanh thu.', route: '/app/dashboard', badge: '📊' },
    { title: 'Wallets', description: 'Duyệt top-up, chuyển ví và kiểm tra ledger phụ huynh.', route: '/app/wallets', badge: '💰' },
    { title: 'Invoices', description: 'Quản lý hóa đơn, duyệt và theo dõi trạng thái thanh toán.', route: '/app/invoices', badge: '📄' },
    { title: 'Payroll GV', description: 'Đối chiếu kỳ lương giáo viên theo teaching report.', route: '/app/payroll', badge: '💵' },
    { title: 'Staff Payroll', description: 'Bảng lương nhân viên không phải giáo viên.', route: '/app/staff-payroll', badge: '🧾' },
    { title: 'Salary Config', description: 'Cấu hình lương cơ bản và điều kiện thưởng/phạt.', route: '/app/salary-config', badge: '⚙️' },
    { title: 'Expenses', description: 'Chi phí vận hành: ghi nhận, phân loại và duyệt.', route: '/app/expenses', badge: '📋' },
    { title: 'Aging Report', description: 'Công nợ phải thu phân loại theo 30/60/90 ngày.', route: '/app/aging-report', badge: '📈' },
    { title: 'Financial Control', description: 'P&L, doanh thu và kiểm soát tài chính tổng thể.', route: '/app/financial-control', badge: '🏦' },
    { title: 'Bank Reconciliation', description: 'Đối soát sao kê ngân hàng với ledger hệ thống.', route: '/app/bank-reconciliation', badge: '🔄' },
    { title: 'Supplier Quotes', description: 'Báo giá nhà cung cấp chờ duyệt và đã duyệt.', route: '/app/supplier-quotes', badge: '📑' },
    { title: 'Export Reports', description: 'Xuất CSV: Payroll, Invoices, Ledger, Sessions.', route: '/app/export-reports', badge: '📥' },
  ];

  readonly faqs: FAQItem[] = [
    {
      question: 'Tôi duyệt top-up xong nhưng ví phụ huynh chưa cộng tiền — tại sao?',
      answer: 'Hệ thống cập nhật số dư ngay lập tức khi duyệt. Nếu chưa thấy, hãy refresh trang ví và kiểm tra ledger. Nếu vẫn sai, liên hệ giám đốc — không tự duyệt lại để tránh trùng giao dịch.',
    },
    {
      question: 'Hóa đơn đã APPROVED nhưng cần hủy — phải làm thế nào?',
      answer: 'Hóa đơn APPROVED chuyển sang CANCELLED sẽ kích hoạt hoàn tiền tự động vào ví phụ huynh. Kiểm tra kỹ trước khi hủy và đối chiếu ledger sau đó. Mọi thao tác đều ghi audit log.',
    },
    {
      question: 'Giáo viên yêu cầu điều chỉnh kỳ lương đã PAID — kế toán xử lý thế nào?',
      answer: 'Payroll đã PAID không thể chỉnh trực tiếp. Cần tạo kỳ lương điều chỉnh bổ sung hoặc phối hợp với giám đốc để mở lại kỳ. Không tự tạo khoản bù trừ bên ngoài hệ thống.',
    },
    {
      question: 'Financial Control và Comprehensive Report khác nhau thế nào?',
      answer: 'Financial Control là màn hình kiểm soát P&L theo thời gian thực — chỉ kế toán và giám đốc truy cập. Comprehensive Report là báo cáo tổng hợp nhiều vai trò có thể xem — không có dữ liệu lương nhạy cảm.',
    },
    {
      question: 'Khi nào tôi cần dùng Bank Reconciliation vs chỉ xem Wallets?',
      answer: 'Wallets theo dõi số dư và giao dịch trong hệ thống. Bank Reconciliation đối chiếu với sao kê ngân hàng thực tế — dùng cuối tháng để đảm bảo không có giao dịch ngoài hệ thống bị bỏ sót.',
    },
    {
      question: 'OPS có thể duyệt hóa đơn không? Tôi có cần phối hợp không?',
      answer: 'OPS có quyền xem và duyệt hóa đơn nhưng không duyệt được top-up hay chuyển ví. Kế toán giữ vai trò chốt số cuối cùng — nếu OPS đã duyệt, kế toán vẫn cần kiểm tra lại trước khi đóng sổ.',
    },
  ];
}
