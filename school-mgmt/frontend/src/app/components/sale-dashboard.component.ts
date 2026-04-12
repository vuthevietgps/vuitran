import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

interface SalesDashboardData {
  leads: {
    total: number;
    converted: number;
    conversionRate: number;
    active: number;
    byStatus: Record<string, number>;
    followUpsDueToday: Array<{
      leadCode: string;
      parentName: string;
      parentPhone: string;
      status: string;
      nextFollowUp: string;
    }>;
    followUpsOverdue: number;
  };
  orders: {
    total: number;
    byStatus: Record<string, number>;
    revenueGenerated: number;
    commissionEarned: number;
    commissionPending: number;
    recentOrders: Array<{
      orderCode: string;
      parentName: string;
      studentName: string;
      finalAmount: number;
      saleCommission: number;
      status: string;
      createdAt: string;
    }>;
  };
}

interface CommissionDetail {
  finalAmount: number;
  status: string;
  createdAt: string;
}

interface CommissionSummary {
  totalRevenue: number;
}

interface CommissionReport {
  details: CommissionDetail[];
  summary: CommissionSummary;
}

interface RevenueByMonth {
  month: string;
  revenue: number;
  count: number;
}

interface EmptyStateAction {
  label: string;
  description: string;
  route: string;
  queryParams?: Record<string, string>;
  testId: string;
}

const STATUS_LABELS: Record<string, string> = {
  NEW: 'Mới',
  CONTACTED: 'Đã liên hệ',
  CONSULTING: 'Đang tư vấn',
  INTERESTED: 'Quan tâm',
  CONVERTED: 'Đã chuyển đổi',
  NOT_INTERESTED: 'Không quan tâm',
  NO_RESPONSE: 'Không phản hồi',
};

const STATUS_COLORS: Record<string, string> = {
  NEW: '#3b82f6',
  CONTACTED: '#8b5cf6',
  CONSULTING: '#f59e0b',
  INTERESTED: '#10b981',
  CONVERTED: '#059669',
  NOT_INTERESTED: '#6b7280',
  NO_RESPONSE: '#ef4444',
};

const ORDER_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Nháp',
  SUBMITTED: 'Chờ duyệt',
  APPROVED: 'Đã duyệt',
  REJECTED: 'Từ chối',
  NEEDS_INFO: 'Cần bổ sung',
  COMPLETED: 'Hoàn tất',
  CANCELLED: 'Đã hủy',
};

const ORDER_STATUS_COLORS: Record<string, string> = {
  DRAFT: '#64748b',
  SUBMITTED: '#f59e0b',
  APPROVED: '#10b981',
  REJECTED: '#ef4444',
  NEEDS_INFO: '#8b5cf6',
  COMPLETED: '#059669',
  CANCELLED: '#9ca3af',
};

const FUNNEL_STATUSES = ['NEW', 'CONTACTED', 'CONSULTING', 'INTERESTED', 'CONVERTED'];

@Component({
  selector: 'app-sale-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
  <header class="page-header">
    <div>
      <h2>Dashboard Sale</h2>
      <p>Tổng quan hiệu suất bán hàng và theo dõi leads.</p>
    </div>
    <button class="primary" (click)="reload()">Làm mới</button>
  </header>

  <div *ngIf="loading()" class="loading-bar">Đang tải dữ liệu...</div>

  <ng-container *ngIf="data()">
    <section *ngIf="showFreshStartState()" class="friendly-empty-state" data-testid="sale-dashboard-empty-state">
      <div class="empty-copy">
        <p class="empty-kicker">Khoi dong an toan</p>
        <h3>Dashboard sale dang cho du lieu dau tien</h3>
        <p class="empty-text">
          Tai khoan nay chua co lead, don hang hay doanh thu nao, nen he thong chuyen sang che do huong dan thay vi
          hien mot loat so 0d de tranh gay hieu nham la du lieu da bi loi.
        </p>
        <ul class="empty-checklist">
          <li>Bat dau tu lead dau tien hoac mo danh sach phu huynh de khoi dong pipeline.</li>
          <li>Lap hoa don va doi duyet hoac nap tien truoc khi chuyen sang tao lop.</li>
          <li>Mo sale hub de xem dung thu tu thao tac cho sale moi.</li>
        </ul>
      </div>

      <div class="empty-actions">
        <a
          *ngFor="let action of emptyStateActions"
          class="empty-action-card"
          [routerLink]="action.route"
          [queryParams]="action.queryParams"
          [attr.data-testid]="action.testId">
          <strong>{{ action.label }}</strong>
          <p>{{ action.description }}</p>
        </a>
      </div>
    </section>

    <ng-container *ngIf="!showFreshStartState()">
    <section class="kpi-grid" data-testid="sale-dashboard-kpi-grid">
      <div class="kpi-card blue">
        <div class="kpi-value">{{ data()!.leads.conversionRate }}%</div>
        <div class="kpi-label">Tỷ lệ chuyển đổi</div>
        <div class="kpi-sub">{{ data()!.leads.converted }}/{{ data()!.leads.total }} leads</div>
      </div>

      <div class="kpi-card green">
        <div class="kpi-value">{{ currentMonthRevenue() | number }}đ</div>
        <div class="kpi-label">Doanh thu tháng này</div>
        <div class="kpi-sub">{{ currentMonthLabel() }}</div>
      </div>

      <div class="kpi-card navy">
        <div class="kpi-value">{{ totalRevenue() | number }}đ</div>
        <div class="kpi-label">Tổng doanh thu</div>
        <div class="kpi-sub">Từ đơn hoàn tất</div>
      </div>

      <div class="kpi-card purple">
        <div class="kpi-value">{{ data()!.orders.commissionEarned | number }}đ</div>
        <div class="kpi-label">Hoa hồng đã nhận</div>
      </div>

      <div class="kpi-card orange">
        <div class="kpi-value">{{ data()!.leads.active }}</div>
        <div class="kpi-label">Leads đang xử lý</div>
      </div>

      <div class="kpi-card teal">
        <div class="kpi-value">{{ data()!.orders.commissionPending | number }}đ</div>
        <div class="kpi-label">Hoa hồng chờ duyệt</div>
      </div>
    </section>

    <section class="section-card">
      <div class="section-header">
        <h3>Doanh thu theo tháng</h3>
        <span class="summary-chip" *ngIf="revenueByMonth().length">
          {{ revenueByMonth().length }} tháng
        </span>
      </div>
      <table class="data-table" *ngIf="revenueByMonth().length; else noRevenueByMonth">
        <thead>
          <tr>
            <th>Tháng</th>
            <th>Doanh thu</th>
            <th>Số đơn hoàn tất</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let month of revenueByMonth()">
            <td>{{ formatMonth(month.month) }}</td>
            <td class="right">{{ month.revenue | number }}đ</td>
            <td class="right">{{ month.count }}</td>
          </tr>
        </tbody>
      </table>
      <ng-template #noRevenueByMonth>
        <p class="empty-text">Chưa có doanh thu theo tháng.</p>
      </ng-template>
    </section>

    <section class="section-card">
      <h3>Phễu chuyển đổi Lead</h3>
      <div class="funnel">
        <div class="funnel-step" *ngFor="let status of funnelStatuses; let i = index">
          <div class="funnel-bar" [style.background]="statusColor(status)" [style.width.%]="funnelWidth(status)">
            <span class="funnel-count">{{ getLeadCount(status) }}</span>
          </div>
          <div class="funnel-label">{{ statusLabel(status) }}</div>
          <div class="funnel-arrow" *ngIf="i < funnelStatuses.length - 1">&#8594;</div>
        </div>
      </div>
    </section>

    <section class="section-card">
      <div class="section-header">
        <h3>
          Follow-up hôm nay
          <span class="count-badge" *ngIf="data()!.leads.followUpsDueToday.length">
            {{ data()!.leads.followUpsDueToday.length }}
          </span>
        </h3>
        <span class="overdue-badge" *ngIf="data()!.leads.followUpsOverdue > 0">
          {{ data()!.leads.followUpsOverdue }} quá hạn
        </span>
      </div>

      <table class="data-table" *ngIf="data()!.leads.followUpsDueToday.length; else noFollowUps">
        <thead>
          <tr>
            <th>Mã Lead</th>
            <th>Phụ huynh</th>
            <th>SĐT</th>
            <th>Trạng thái</th>
            <th>Hẹn follow-up</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let followUp of data()!.leads.followUpsDueToday">
            <td><code>{{ followUp.leadCode }}</code></td>
            <td>{{ followUp.parentName }}</td>
            <td>{{ followUp.parentPhone }}</td>
            <td>
              <span
                class="badge"
                [style.background]="statusColor(followUp.status) + '20'"
                [style.color]="statusColor(followUp.status)"
              >
                {{ statusLabel(followUp.status) }}
              </span>
            </td>
            <td>{{ followUp.nextFollowUp | date:'dd/MM/yyyy HH:mm' }}</td>
          </tr>
        </tbody>
      </table>
      <ng-template #noFollowUps>
        <p class="empty-text">Không có follow-up nào hôm nay.</p>
      </ng-template>
    </section>

    <section class="section-card">
      <h3>Đơn hàng gần đây</h3>
      <table class="data-table" *ngIf="data()!.orders.recentOrders.length; else noOrders">
        <thead>
          <tr>
            <th>Mã đơn</th>
            <th>Phụ huynh</th>
            <th>Học viên</th>
            <th>Tổng tiền</th>
            <th>Hoa hồng</th>
            <th>Trạng thái</th>
            <th>Ngày tạo</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let order of data()!.orders.recentOrders">
            <td><code>{{ order.orderCode }}</code></td>
            <td>{{ order.parentName }}</td>
            <td>{{ order.studentName }}</td>
            <td class="right">{{ order.finalAmount | number }}đ</td>
            <td class="right">{{ order.saleCommission ? (order.saleCommission | number) + 'đ' : '-' }}</td>
            <td>
              <span
                class="badge"
                [style.background]="orderStatusColor(order.status) + '20'"
                [style.color]="orderStatusColor(order.status)"
              >
                {{ orderStatusLabel(order.status) }}
              </span>
            </td>
            <td>{{ order.createdAt | date:'dd/MM/yyyy' }}</td>
          </tr>
        </tbody>
      </table>
      <ng-template #noOrders>
        <p class="empty-text">Chưa có đơn hàng nào.</p>
      </ng-template>
    </section>

    <section class="section-card">
      <h3>Pipeline đơn hàng</h3>
      <div class="pipeline">
        <div class="pipe-card" *ngFor="let status of orderStatuses" [style.border-left-color]="orderStatusColor(status)">
          <div class="pipe-count">{{ getOrderCount(status) }}</div>
          <div class="pipe-label">{{ orderStatusLabel(status) }}</div>
        </div>
      </div>
    </section>
    </ng-container>
  </ng-container>
  `,
  styles: [`
    .page-header { display:flex; justify-content:space-between; align-items:center; padding:16px; }
    .page-header h2 { margin:0; color:#0f172a; }
    .page-header p { margin:4px 0 0; color:#64748b; font-size:13px; }
    .primary { background:#2563eb; color:#fff; border:none; padding:8px 14px; border-radius:4px; cursor:pointer; font-weight:600; }
    .loading-bar { padding:12px 16px; background:#eff6ff; color:#2563eb; font-size:13px; font-weight:600; margin:0 16px; border-radius:6px; }
    .friendly-empty-state {
      margin: 0 16px 16px;
      padding: 22px;
      border-radius: 20px;
      border: 1px solid #bfdbfe;
      background:
        radial-gradient(circle at top right, rgba(59, 130, 246, 0.18), transparent 24%),
        linear-gradient(135deg, #eff6ff 0%, #f8fafc 58%, #eef2ff 100%);
      box-shadow: 0 16px 30px rgba(37, 99, 235, 0.08);
      display: grid;
      gap: 18px;
    }
    .empty-copy h3 {
      margin: 0 0 10px;
      color: #0f172a;
      font-size: 24px;
      letter-spacing: -0.03em;
    }
    .empty-kicker {
      margin: 0 0 8px;
      color: #2563eb;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }
    .empty-text {
      margin: 0;
      color: #475569;
      line-height: 1.6;
      font-size: 14px;
    }
    .empty-checklist {
      margin: 14px 0 0;
      padding-left: 18px;
      color: #334155;
      display: grid;
      gap: 8px;
      font-size: 14px;
    }
    .empty-actions {
      display: grid;
      gap: 12px;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    }
    .empty-action-card {
      text-decoration: none;
      border-radius: 18px;
      padding: 16px;
      background: rgba(255, 255, 255, 0.95);
      border: 1px solid #dbeafe;
      min-height: 120px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
    }
    .empty-action-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 14px 24px rgba(37, 99, 235, 0.12);
      border-color: #93c5fd;
    }
    .empty-action-card strong {
      color: #0f172a;
      font-size: 15px;
    }
    .empty-action-card p {
      margin: 0;
      color: #64748b;
      font-size: 13px;
      line-height: 1.6;
    }

    .kpi-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:12px; padding:0 16px 16px; }
    .kpi-card { background:#fff; padding:16px; border-radius:8px; border-left:4px solid #e2e8f0; }
    .kpi-card.blue { border-left-color:#2563eb; background:#eff6ff; }
    .kpi-card.green { border-left-color:#059669; background:#f0fdf4; }
    .kpi-card.navy { border-left-color:#0f172a; background:#e2e8f0; }
    .kpi-card.purple { border-left-color:#7c3aed; background:#f5f3ff; }
    .kpi-card.orange { border-left-color:#ea580c; background:#fff7ed; }
    .kpi-card.teal { border-left-color:#0d9488; background:#f0fdfa; }
    .kpi-value { font-size:24px; font-weight:700; color:#0f172a; }
    .kpi-label { font-size:12px; color:#64748b; margin-top:2px; text-transform:uppercase; letter-spacing:0.3px; }
    .kpi-sub { font-size:11px; color:#94a3b8; margin-top:4px; }

    .section-card { background:#fff; margin:0 16px 16px; border-radius:8px; padding:16px; }
    .section-card h3 { margin:0 0 12px; font-size:15px; color:#0f172a; display:inline-flex; align-items:center; gap:8px; }
    .section-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; gap:12px; flex-wrap:wrap; }
    .section-header h3 { margin-bottom:0; }

    .badge { font-size:11px; padding:2px 8px; border-radius:9px; font-weight:600; white-space:nowrap; }
    .count-badge { display:inline-flex; align-items:center; justify-content:center; min-width:20px; height:20px; padding:0 6px; border-radius:99px; background:#2563eb; color:#fff; font-size:11px; font-weight:700; }
    .overdue-badge { display:inline-flex; align-items:center; padding:4px 10px; border-radius:99px; background:#fef2f2; color:#dc2626; font-size:12px; font-weight:600; border:1px solid #fca5a5; }
    .summary-chip { display:inline-flex; align-items:center; padding:4px 10px; border-radius:99px; background:#eff6ff; color:#2563eb; font-size:12px; font-weight:600; border:1px solid #bfdbfe; }

    .funnel { display:flex; align-items:center; gap:4px; flex-wrap:wrap; }
    .funnel-step { display:flex; flex-direction:column; align-items:center; min-width:80px; flex:1; }
    .funnel-bar { height:40px; border-radius:6px; display:flex; align-items:center; justify-content:center; min-width:50px; transition:width 0.3s; }
    .funnel-count { color:#fff; font-weight:700; font-size:16px; text-shadow:0 1px 2px rgba(0, 0, 0, 0.2); }
    .funnel-label { font-size:11px; color:#64748b; margin-top:4px; text-align:center; }
    .funnel-arrow { font-size:16px; color:#cbd5e1; margin:0 2px; align-self:center; }

    .pipeline { display:flex; gap:12px; flex-wrap:wrap; }
    .pipe-card { background:#f8fafc; padding:12px 16px; border-radius:8px; border-left:4px solid #e2e8f0; min-width:100px; }
    .pipe-count { font-size:24px; font-weight:700; color:#0f172a; }
    .pipe-label { font-size:12px; color:#64748b; margin-top:2px; }

    .data-table { width:100%; border-collapse:collapse; font-size:13px; }
    .data-table th, .data-table td { padding:8px 10px; border:1px solid #e2e8f0; }
    .data-table thead { background:#f1f5f9; font-size:12px; text-transform:uppercase; color:#64748b; }
    .data-table tbody tr:hover { background:#f8fafc; }
    .right { text-align:right; }
    code { background:#f1f5f9; padding:1px 5px; border-radius:3px; font-size:12px; color:#334155; }
    .empty-text { padding:8px 0; color:#94a3b8; font-size:13px; }
  `],
})
export class SaleDashboardComponent implements OnInit {
  private http = inject(HttpClient);

  data = signal<SalesDashboardData | null>(null);
  revenueSummary = signal<CommissionSummary | null>(null);
  revenueByMonth = signal<RevenueByMonth[]>([]);
  loading = signal(false);
  readonly emptyStateActions: EmptyStateAction[] = [
    {
      label: 'Mo leads',
      description: 'Bat dau tu lead dau tien de dashboard co pipeline can theo doi.',
      route: '/app/leads',
      testId: 'sale-dashboard-empty-cta-leads',
    },
    {
      label: 'Mo danh sach phu huynh',
      description: 'Tao ho so phu huynh truoc khi lap hoa don va tiep tuc flow sale.',
      route: '/app/users',
      queryParams: { role: 'PARENT' },
      testId: 'sale-dashboard-empty-cta-parents',
    },
    {
      label: 'Xem sale hub',
      description: 'Mo hub huong dan 5 buoc chuan de onboarding sale moi nhanh hon.',
      route: '/app/sale-hub',
      testId: 'sale-dashboard-empty-cta-guide',
    },
  ];

  funnelStatuses = FUNNEL_STATUSES;
  orderStatuses = ['DRAFT', 'SUBMITTED', 'APPROVED', 'COMPLETED', 'REJECTED', 'CANCELLED'];

  ngOnInit() {
    this.reload();
  }

  async reload() {
    this.loading.set(true);

    const [dashboardResult, revenueResult] = await Promise.allSettled([
      firstValueFrom(
        this.http.get<SalesDashboardData>(`${environment.apiBase}/dashboard/sales`, { withCredentials: true }),
      ),
      firstValueFrom(
        this.http.get<CommissionReport>(`${environment.apiBase}/orders/commission-report`, { withCredentials: true }),
      ),
    ]);

    if (dashboardResult.status === 'fulfilled') {
      this.data.set(dashboardResult.value);
    } else {
      this.data.set(null);
      console.error('Failed to load sales dashboard', dashboardResult.reason);
    }

    if (revenueResult.status === 'fulfilled') {
      this.revenueSummary.set(revenueResult.value.summary || null);
      this.revenueByMonth.set(this.buildRevenueByMonth(revenueResult.value.details || []));
    } else {
      this.revenueSummary.set(null);
      this.revenueByMonth.set([]);
      console.error('Failed to load sales revenue summary', revenueResult.reason);
    }

    this.loading.set(false);
  }

  statusLabel(status: string) {
    return STATUS_LABELS[status] || status;
  }

  statusColor(status: string) {
    return STATUS_COLORS[status] || '#64748b';
  }

  orderStatusLabel(status: string) {
    return ORDER_STATUS_LABELS[status] || status;
  }

  orderStatusColor(status: string) {
    return ORDER_STATUS_COLORS[status] || '#64748b';
  }

  getLeadCount(status: string): number {
    return this.data()?.leads?.byStatus?.[status] || 0;
  }

  getOrderCount(status: string): number {
    return this.data()?.orders?.byStatus?.[status] || 0;
  }

  totalRevenue(): number {
    return this.revenueSummary()?.totalRevenue ?? this.data()?.orders?.revenueGenerated ?? 0;
  }

  currentMonthRevenue(): number {
    return this.revenueByMonth().find((month) => month.month === this.currentMonthKey())?.revenue || 0;
  }

  currentMonthLabel(): string {
    const [year, month] = this.currentMonthKey().split('-');
    return `${month}/${year}`;
  }

  formatMonth(month: string): string {
    const [year, monthValue] = month.split('-');
    return monthValue && year ? `${monthValue}/${year}` : month;
  }

  funnelWidth(status: string): number {
    const total = this.data()?.leads?.total || 1;
    const count = this.getLeadCount(status);
    const percent = Math.max((count / total) * 100, 15);
    return Math.min(percent, 100);
  }

  showFreshStartState(): boolean {
    const dashboard = this.data();
    if (!dashboard) {
      return false;
    }

    const hasLeads = Number(dashboard.leads?.total || 0) > 0;
    const hasOrders = Number(dashboard.orders?.total || 0) > 0;
    const hasRevenue = Number(this.totalRevenue() || 0) > 0 || this.revenueByMonth().length > 0;
    const hasFollowUps = Number(dashboard.leads?.followUpsOverdue || 0) > 0 || (dashboard.leads?.followUpsDueToday?.length || 0) > 0;
    const hasRecentOrders = (dashboard.orders?.recentOrders?.length || 0) > 0;

    return !(hasLeads || hasOrders || hasRevenue || hasFollowUps || hasRecentOrders);
  }

  private buildRevenueByMonth(details: CommissionDetail[]): RevenueByMonth[] {
    const grouped = new Map<string, RevenueByMonth>();

    for (const detail of details) {
      if (detail.status !== 'COMPLETED') continue;
      const month = this.toMonthKey(detail.createdAt);
      if (!month) continue;

      const existing = grouped.get(month) || { month, revenue: 0, count: 0 };
      existing.revenue += detail.finalAmount || 0;
      existing.count += 1;
      grouped.set(month, existing);
    }

    return Array.from(grouped.values()).sort((a, b) => b.month.localeCompare(a.month));
  }

  private currentMonthKey(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  private toMonthKey(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }
}
