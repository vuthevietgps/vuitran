import { CommonModule, NgComponentOutlet } from '@angular/common';
import { Component, OnInit, Type, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { LandingPageItem, LandingPageService } from '../../services/landing-page.service';
import { Role } from '../../models/role.enum';
import { FlowGuideComponent } from '../shared/flow-guide.component';
import { DailyTaskTabsComponent } from '../shared/daily-task-tabs.component';

interface HandbookBanner {
  title: string;
  summary: string;
}

interface DashboardLandingLinkItem {
  key: string;
  name: string;
  path: string;
  url: string;
  sourceLabel: string;
  status: string;
  statusLabel: string;
  note: string;
  isPublic: boolean;
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
  EXPERIENCE_TEACHER: {
    title: 'Cam nang giao vien trai nghiem',
    summary: 'Theo doi hoc thu duoc giao, nhap ket qua test va ho tro sale chot phuong an hoc.',
  },
  ADSMANAGER: {
    title: 'Cam nang ads',
    summary: 'Checklist theo doi ads-management, ads-analytics va chatbot-settings cho nhan vien ads.',
  },
};

const LANDING_LINK_ROLES = [Role.DIRECTOR, Role.OPS, Role.SALE];

const LANDING_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Nhap',
  ACTIVE: 'Hoat dong',
  ARCHIVED: 'Luu tru',
};

const STATIC_DASHBOARD_LINKS = [
  {
    key: 'shareholder-collaboration',
    name: 'Landing page Co dong',
    path: '/co-dong',
    note: 'Route co dinh cho hop tac va ket noi co dong.',
  },
  {
    key: 'teacher-recruitment',
    name: 'Landing page Tuyen dung giao vien',
    path: '/tuyen-dung-giao-vien',
    note: 'Route co dinh cho chien dich tuyen dung giao vien.',
  },
] as const;

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FlowGuideComponent, RouterLink, NgComponentOutlet, DailyTaskTabsComponent],
  template: `
    <app-flow-guide featureKey="dashboard"></app-flow-guide>

    <section class="handbook-banner" *ngIf="handbookBanner" data-testid="dashboard-handbook-banner">
      <div>
        <p class="eyebrow">Cam nang noi bo</p>
        <h3>{{ handbookBanner.title }}</h3>
        <p>{{ handbookBanner.summary }}</p>
      </div>
      <a routerLink="/app/internal-handbook" class="handbook-link" data-testid="dashboard-handbook-link">Mo cam nang</a>
    </section>

    <app-daily-task-tabs *ngIf="role"></app-daily-task-tabs>

    <section *ngIf="canShowLandingLinks()" class="landing-links-panel" data-testid="dashboard-landing-links">
      <div class="landing-links-header">
        <div>
          <p class="eyebrow">Link landing page</p>
          <h3>Danh sach landing page public</h3>
          <p>
            Gom ca route co dinh va cac landing page dong. Muc nay dat ngay tren dashboard de khong phai mo them menu
            linh tinh.
          </p>
        </div>
        <a routerLink="/app/landing-pages" class="landing-links-manage">Mo quan ly chi tiet</a>
      </div>

      <div class="landing-links-summary" *ngIf="!landingLinksLoading()">
        <span>{{ landingLinks().length }} link</span>
        <span>{{ publicLandingLinkCount() }} dang public</span>
      </div>

      <div *ngIf="landingLinksLoading()" class="landing-links-state">Dang tai danh sach link...</div>

      <div *ngIf="!landingLinksLoading() && landingLinks().length === 0" class="landing-links-state">
        Chua co landing page nao.
      </div>

      <div *ngIf="!landingLinksLoading() && landingLinks().length > 0" class="landing-links-grid">
        <article *ngFor="let link of landingLinks()" class="landing-link-card">
          <div class="landing-link-top">
            <div>
              <strong>{{ link.name }}</strong>
              <div class="landing-link-path">{{ link.path }}</div>
            </div>
            <span
              class="landing-link-status"
              [class.active]="link.isPublic"
              [class.inactive]="!link.isPublic && link.status !== 'ARCHIVED'"
              [class.archived]="link.status === 'ARCHIVED'">
              {{ link.statusLabel }}
            </span>
          </div>

          <a class="landing-link-url" [href]="link.url" target="_blank" rel="noopener">{{ link.url }}</a>

          <div class="landing-link-meta">
            <span class="landing-link-source">{{ link.sourceLabel }}</span>
            <span>{{ link.note }}</span>
          </div>

          <div class="landing-link-actions">
            <button type="button" class="landing-link-btn" (click)="copyLandingLink(link.url)">Copy link</button>
            <a *ngIf="link.isPublic" [href]="link.url" target="_blank" rel="noopener" class="landing-link-open">Mo link</a>
            <span *ngIf="!link.isPublic" class="landing-link-disabled">Chua public</span>
          </div>
        </article>
      </div>
    </section>

    <section class="dashboard-loader" *ngIf="loading" data-testid="dashboard-loader">
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

    <section *ngIf="error" class="dashboard-error" data-testid="dashboard-error">
      <h3>Khong the tai dashboard</h3>
      <p>{{ error }}</p>
      <button type="button" class="retry-btn" (click)="loadDashboardComponent()" data-testid="dashboard-retry">Thu tai lai</button>
    </section>

    <div *ngIf="!role" class="no-role" data-testid="dashboard-no-role">
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
    .landing-links-panel {
      margin:0 0 20px;
      padding:20px 22px;
      border-radius:22px;
      border:1px solid rgba(59, 130, 246, 0.18);
      background:
        radial-gradient(circle at top right, rgba(59, 130, 246, 0.14), transparent 24%),
        linear-gradient(135deg, #eff6ff 0%, #f8fafc 52%, #f0fdf4 100%);
      box-shadow:0 16px 36px rgba(37, 99, 235, 0.08);
    }
    .landing-links-header {
      display:flex;
      align-items:flex-start;
      justify-content:space-between;
      gap:16px;
      margin-bottom:14px;
    }
    .landing-links-header h3 {
      margin:0 0 8px;
      color:#0f172a;
      font-size:24px;
      letter-spacing:-0.03em;
    }
    .landing-links-header p {
      margin:0;
      color:#475569;
      line-height:1.6;
      font-size:14px;
      max-width:760px;
    }
    .landing-links-manage {
      display:inline-flex;
      align-items:center;
      justify-content:center;
      min-height:44px;
      padding:0 18px;
      border-radius:999px;
      background:#fff;
      color:#0f172a;
      text-decoration:none;
      font-weight:700;
      border:1px solid rgba(148, 163, 184, 0.3);
      white-space:nowrap;
      box-shadow:0 12px 24px rgba(15, 23, 42, 0.06);
    }
    .landing-links-summary {
      display:flex;
      flex-wrap:wrap;
      gap:10px;
      margin-bottom:14px;
    }
    .landing-links-summary span {
      display:inline-flex;
      align-items:center;
      min-height:32px;
      padding:0 12px;
      border-radius:999px;
      background:rgba(255, 255, 255, 0.9);
      border:1px solid rgba(148, 163, 184, 0.18);
      color:#334155;
      font-size:12px;
      font-weight:700;
    }
    .landing-links-state {
      padding:18px;
      border-radius:18px;
      background:rgba(255, 255, 255, 0.82);
      border:1px dashed rgba(148, 163, 184, 0.36);
      color:#64748b;
      text-align:center;
    }
    .landing-links-grid {
      display:grid;
      gap:14px;
      grid-template-columns:repeat(auto-fit, minmax(260px, 1fr));
    }
    .landing-link-card {
      display:grid;
      gap:12px;
      padding:16px;
      border-radius:18px;
      background:rgba(255, 255, 255, 0.94);
      border:1px solid rgba(148, 163, 184, 0.2);
      box-shadow:0 14px 30px rgba(15, 23, 42, 0.05);
    }
    .landing-link-top {
      display:flex;
      align-items:flex-start;
      justify-content:space-between;
      gap:12px;
    }
    .landing-link-top strong {
      display:block;
      color:#0f172a;
      font-size:16px;
    }
    .landing-link-path {
      margin-top:4px;
      color:#64748b;
      font-size:12px;
      font-family:Consolas, monospace;
    }
    .landing-link-status {
      display:inline-flex;
      align-items:center;
      min-height:28px;
      padding:0 10px;
      border-radius:999px;
      font-size:11px;
      font-weight:800;
      white-space:nowrap;
      background:#e2e8f0;
      color:#475569;
    }
    .landing-link-status.active {
      background:#dcfce7;
      color:#15803d;
    }
    .landing-link-status.inactive {
      background:#fef3c7;
      color:#b45309;
    }
    .landing-link-status.archived {
      background:#e2e8f0;
      color:#475569;
    }
    .landing-link-url {
      color:#0f766e;
      text-decoration:none;
      font-weight:700;
      word-break:break-all;
    }
    .landing-link-url:hover,
    .landing-link-open:hover {
      text-decoration:underline;
    }
    .landing-link-meta {
      display:grid;
      gap:8px;
      color:#475569;
      font-size:13px;
      line-height:1.5;
    }
    .landing-link-source {
      width:fit-content;
      display:inline-flex;
      align-items:center;
      padding:5px 10px;
      border-radius:999px;
      background:#dbeafe;
      color:#1d4ed8;
      font-size:11px;
      font-weight:800;
    }
    .landing-link-actions {
      display:flex;
      align-items:center;
      gap:12px;
      flex-wrap:wrap;
    }
    .landing-link-btn,
    .landing-link-open {
      display:inline-flex;
      align-items:center;
      justify-content:center;
      min-height:34px;
      padding:0 12px;
      border-radius:999px;
      font-size:12px;
      font-weight:700;
      text-decoration:none;
    }
    .landing-link-btn {
      border:none;
      background:#2563eb;
      color:#fff;
      cursor:pointer;
    }
    .landing-link-open {
      background:rgba(15, 118, 110, 0.1);
      color:#0f766e;
    }
    .landing-link-disabled {
      color:#94a3b8;
      font-size:12px;
      font-weight:700;
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
      .loader-top,
      .landing-links-header {
        flex-direction:column;
        align-items:flex-start;
      }
      .handbook-banner h3 {
        font-size:21px;
      }
      .landing-links-header h3 {
        font-size:21px;
      }
      .loader-title,
      .loader-pill {
        width:100%;
      }
      .landing-links-manage {
        width:100%;
      }
    }
  `],
})
export class DashboardComponent implements OnInit {
  private readonly landingPageService = inject(LandingPageService);

  role: Role | undefined;
  handbookBanner: HandbookBanner | null = null;
  activeDashboardComponent: Type<unknown> | null = null;
  loading = false;
  error = '';
  readonly skeletonCards = Array.from({ length: 6 }, (_, index) => index);
  readonly landingPageItems = signal<LandingPageItem[]>([]);
  readonly landingLinksLoading = signal(false);
  readonly landingLinks = computed<DashboardLandingLinkItem[]>(() => {
    if (!this.canShowLandingLinks()) {
      return [];
    }

    const staticLinks = STATIC_DASHBOARD_LINKS.map((link) => ({
      key: link.key,
      name: link.name,
      path: link.path,
      url: this.absoluteUrl(link.path),
      sourceLabel: 'Route co dinh',
      status: 'ACTIVE',
      statusLabel: this.landingStatusLabel('ACTIVE'),
      note: link.note,
      isPublic: true,
    }));

    const managedLinks = this.landingPageItems().map((page) => {
      const noteParts = [page.pageCode];
      const tracking = this.landingTrackingSummary(page);

      if (tracking) {
        noteParts.push(tracking);
      }

      return {
        key: page._id,
        name: page.name,
        path: `/lp/${page.slug}`,
        url: this.publicUrl(page.slug),
        sourceLabel: 'Landing page dong',
        status: page.status || 'DRAFT',
        statusLabel: this.landingStatusLabel(page.status),
        note: noteParts.join(' | '),
        isPublic: page.status === 'ACTIVE',
      };
    });

    return [...staticLinks, ...managedLinks];
  });
  readonly publicLandingLinkCount = computed(() =>
    this.landingLinks().filter((link) => link.isPublic).length,
  );

  constructor(private readonly auth: AuthService) {
    this.role = this.auth.userSignal()?.role as Role | undefined;
    this.handbookBanner = this.role && this.role !== Role.TEACHER
      ? (HANDBOOK_BANNERS[this.role] || null)
      : null;
  }

  ngOnInit() {
    void this.loadDashboardComponent();
    void this.loadLandingLinks();
  }

  async loadDashboardComponent() {
    if (!this.role) {
      this.activeDashboardComponent = null;
      return;
    }

    this.loading = true;
    this.error = '';

    try {
      await this.applyTestDelayIfNeeded();
      this.throwTestErrorIfNeeded();
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
      case Role.SHAREHOLDER:
        return (await import('./investor-dashboard.component')).InvestorDashboardComponent;
      default:
        return null;
    }
  }

  canShowLandingLinks(): boolean {
    return !!this.role && LANDING_LINK_ROLES.includes(this.role);
  }

  async copyLandingLink(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      alert(`Da copy: ${url}`);
    } catch {
      prompt('Copy link landing page', url);
    }
  }

  private async loadLandingLinks() {
    if (!this.canShowLandingLinks()) {
      this.landingPageItems.set([]);
      return;
    }

    this.landingLinksLoading.set(true);
    try {
      this.landingPageItems.set(await this.landingPageService.list());
    } finally {
      this.landingLinksLoading.set(false);
    }
  }

  private landingStatusLabel(status?: string): string {
    return LANDING_STATUS_LABELS[status || ''] || (status || '-');
  }

  private landingTrackingSummary(page: LandingPageItem): string {
    const parts = [
      page.metaPixelId ? `Meta ${page.metaPixelId}` : '',
      page.googleTagId ? `Google ${page.googleTagId}` : '',
      page.googleAdsConversionId ? `AW ${page.googleAdsConversionId}` : '',
      page.tiktokPixelId ? `TikTok ${page.tiktokPixelId}` : '',
    ].filter(Boolean);

    return parts.join(' | ');
  }

  private publicUrl(slug: string): string {
    return `${window.location.origin}/lp/${slug}`;
  }

  private absoluteUrl(path: string): string {
    return `${window.location.origin}${path.startsWith('/') ? path : `/${path}`}`;
  }

  private async applyTestDelayIfNeeded(): Promise<void> {
    const scope = globalThis as typeof globalThis & { __dashboardTestDelayMs?: unknown };
    const delay = Number(scope.__dashboardTestDelayMs || 0);

    if (!Number.isFinite(delay) || delay <= 0) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  private throwTestErrorIfNeeded(): void {
    const scope = globalThis as typeof globalThis & { __dashboardTestForceError?: unknown };
    if (scope.__dashboardTestForceError) {
      throw new Error('Dashboard forced error for UI test.');
    }
  }
}
