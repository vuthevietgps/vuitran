import { CommonModule, NgComponentOutlet } from '@angular/common';
import { Component, OnInit, Type } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { Role } from '../../models/role.enum';
import { FlowGuideComponent } from '../shared/flow-guide.component';
import { DailyTaskTabsComponent } from '../shared/daily-task-tabs.component';

interface HandbookBanner {
  title: string;
  summary: string;
}

const HANDBOOK_BANNERS: Record<string, HandbookBanner> = {
  DIRECTOR: {
    title: 'Cam nang giam doc',
    summary: 'Tong hop phe duyet, tai chinh, nhan su va cac man hinh can theo doi moi ngay.',
  },
  ACCOUNTING: {
    title: 'Cam nang ke toan',
    summary: 'Huong dan xu ly top-up, invoice, payroll va doi soat theo logic role hien tai.',
  },
  OPS: {
    title: 'Cam nang van hanh',
    summary: 'Checklist dieu phoi lop, session, ticket va ban giao nghiep vu sang ke toan hoac sale.',
  },
  PARENT: {
    title: 'Cam nang phu huynh',
    summary: 'Cac buoc xem tien do hoc, xac nhan buoi hoc va nap vi theo tai khoan cua minh.',
  },
  SALE: {
    title: 'Cam nang sale',
    summary: 'Flow lead, order, landing page, chatbot va hoa hong duoc gom vao mot diem vao chung.',
  },
  ADSMANAGER: {
    title: 'Cam nang ads',
    summary: 'Checklist theo doi ads-management, ads-analytics va chatbot-settings cho nhan vien ads.',
  },
};

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FlowGuideComponent, RouterLink, NgComponentOutlet, DailyTaskTabsComponent],
  template: `
    <app-flow-guide featureKey="dashboard"></app-flow-guide>

    <section class="handbook-banner" *ngIf="handbookBanner">
      <div>
        <p class="eyebrow">Cam nang noi bo</p>
        <h3>{{ handbookBanner.title }}</h3>
        <p>{{ handbookBanner.summary }}</p>
      </div>
      <a routerLink="/app/internal-handbook" class="handbook-link">Mo cam nang</a>
    </section>

    <app-daily-task-tabs *ngIf="role"></app-daily-task-tabs>

    <section class="dashboard-loader" *ngIf="loading">
      <div class="loader-top">
        <div class="loader-title shimmer"></div>
        <div class="loader-pill shimmer"></div>
      </div>
      <div class="loader-grid">
        <div class="loader-card shimmer" *ngFor="let item of skeletonCards"></div>
      </div>
    </section>

    <ng-container *ngIf="!loading && activeDashboardComponent">
      <ng-container *ngComponentOutlet="activeDashboardComponent"></ng-container>
    </ng-container>

    <section *ngIf="error" class="dashboard-error">
      <h3>Khong the tai dashboard</h3>
      <p>{{ error }}</p>
      <button type="button" class="retry-btn" (click)="loadDashboardComponent()">Thu tai lai</button>
    </section>

    <div *ngIf="!role" class="no-role">
      <p>Khong xac dinh duoc vai tro. Vui long dang nhap lai.</p>
    </div>
  `,
  styles: [`
    .handbook-banner {
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:16px;
      margin:0 0 20px;
      padding:20px 22px;
      border-radius:18px;
      border:1px solid rgba(15, 118, 110, 0.14);
      background:
        radial-gradient(circle at top right, rgba(245, 158, 11, 0.18), transparent 24%),
        linear-gradient(135deg, #ecfeff 0%, #fff7ed 100%);
      box-shadow:0 14px 34px rgba(15, 23, 42, 0.08);
    }
    .eyebrow {
      margin:0 0 8px;
      color:#0f766e;
      font-size:11px;
      font-weight:800;
      letter-spacing:0.12em;
      text-transform:uppercase;
    }
    .handbook-banner h3 {
      margin:0 0 8px;
      color:#0f172a;
      font-size:24px;
      letter-spacing:-0.03em;
    }
    .handbook-banner p {
      margin:0;
      color:#475569;
      line-height:1.6;
      font-size:14px;
      max-width:780px;
    }
    .handbook-link,
    .retry-btn {
      display:inline-flex;
      align-items:center;
      justify-content:center;
      min-height:44px;
      padding:0 18px;
      border:none;
      border-radius:999px;
      background:linear-gradient(135deg, #0f766e 0%, #115e59 100%);
      color:#fff;
      text-decoration:none;
      font-weight:700;
      box-shadow:0 12px 24px rgba(15, 118, 110, 0.18);
      white-space:nowrap;
      cursor:pointer;
    }
    .dashboard-loader {
      background:#fff;
      border:1px solid rgba(226, 232, 240, 0.9);
      border-radius:24px;
      box-shadow:0 16px 36px rgba(15, 23, 42, 0.06);
      padding:22px;
    }
    .loader-top {
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:16px;
      margin-bottom:18px;
    }
    .loader-title {
      border-radius:999px;
      height:26px;
      width:min(320px, 55%);
    }
    .loader-pill {
      border-radius:999px;
      height:44px;
      width:152px;
    }
    .loader-grid {
      display:grid;
      gap:16px;
      grid-template-columns:repeat(auto-fit, minmax(220px, 1fr));
    }
    .loader-card {
      border-radius:20px;
      height:152px;
    }
    .shimmer {
      background:linear-gradient(90deg, #e2e8f0 10%, #f8fafc 42%, #e2e8f0 74%);
      background-size:220% 100%;
      animation:shimmer 1.3s linear infinite;
    }
    .dashboard-error,
    .no-role {
      padding:40px;
      text-align:center;
      color:#64748b;
      background:#fff;
      border-radius:20px;
      border:1px solid rgba(226, 232, 240, 0.9);
      box-shadow:0 14px 30px rgba(15, 23, 42, 0.06);
    }
    .dashboard-error h3 {
      margin:0 0 10px;
      color:#0f172a;
    }
    .dashboard-error p {
      margin:0 0 18px;
      line-height:1.6;
    }
    @keyframes shimmer {
      0% { background-position:200% 0; }
      100% { background-position:-20% 0; }
    }
    @media (max-width: 768px) {
      .handbook-banner,
      .loader-top {
        flex-direction:column;
        align-items:flex-start;
      }
      .handbook-banner h3 {
        font-size:21px;
      }
      .loader-title,
      .loader-pill {
        width:100%;
      }
    }
  `],
})
export class DashboardComponent implements OnInit {
  role: Role | undefined;
  handbookBanner: HandbookBanner | null = null;
  activeDashboardComponent: Type<unknown> | null = null;
  loading = false;
  error = '';
  readonly skeletonCards = Array.from({ length: 6 }, (_, index) => index);

  constructor(private readonly auth: AuthService) {
    this.role = this.auth.userSignal()?.role as Role | undefined;
    this.handbookBanner = this.role && this.role !== Role.TEACHER
      ? (HANDBOOK_BANNERS[this.role] || null)
      : null;
  }

  ngOnInit() {
    void this.loadDashboardComponent();
  }

  async loadDashboardComponent() {
    if (!this.role) {
      this.activeDashboardComponent = null;
      return;
    }

    this.loading = true;
    this.error = '';

    try {
      this.activeDashboardComponent = await this.resolveDashboardComponent(this.role);
    } catch (err) {
      this.activeDashboardComponent = null;
      this.error = err instanceof Error
        ? err.message
        : 'Da xay ra loi khi tai dashboard cho vai tro nay.';
    } finally {
      this.loading = false;
    }
  }

  private async resolveDashboardComponent(role: Role): Promise<Type<unknown> | null> {
    switch (role) {
      case Role.DIRECTOR:
        return (await import('./director-dashboard.component')).DirectorDashboardComponent;
      case Role.ACCOUNTING:
        return (await import('./accounting-dashboard.component')).AccountingDashboardComponent;
      case Role.OPS:
        return (await import('./ops-dashboard.component')).OpsDashboardComponent;
      case Role.TEACHER:
        return (await import('./teacher-dashboard.component')).TeacherDashboardComponent;
      case Role.PARENT:
        return (await import('./parent-dashboard.component')).ParentDashboardComponent;
      case Role.SALE:
        return (await import('../sale-dashboard.component')).SaleDashboardComponent;
      case Role.ADSMANAGER:
        return (await import('./ads-manager-dashboard.component')).AdsManagerDashboardComponent;
      default:
        return null;
    }
  }
}
