import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { FlowGuideComponent } from './shared/flow-guide.component';

interface CommissionDetail {
  orderCode: string;
  parentName: string;
  studentName: string;
  finalAmount: number;
  saleCommission: number;
  status: string;
  saleName: string;
  createdAt: string;
}

interface CommissionByMonth {
  month: string;
  revenue: number;
  commission: number;
  count: number;
}

interface CommissionSummary {
  totalRevenue: number;
  totalCommission: number;
  pendingCommission: number;
  totalOrders: number;
}

interface CommissionReport {
  details: CommissionDetail[];
  byMonth: CommissionByMonth[];
  summary: CommissionSummary;
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Nháp',
  SUBMITTED: 'Chờ duyệt',
  APPROVED: 'Đã duyệt',
  REJECTED: 'Từ chối',
  COMPLETED: 'Hoàn tất',
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: '#64748b',
  SUBMITTED: '#f59e0b',
  APPROVED: '#3b82f6',
  REJECTED: '#ef4444',
  COMPLETED: '#059669',
};

@Component({
  selector: 'app-commission-report',
  standalone: true,
  imports: [CommonModule, FormsModule, FlowGuideComponent],
  template: `
  <header class="page-header">
    <div>
      <h2>Báo cáo Hoa hồng</h2>
      <p>Thống kê hoa hồng bán hàng theo đơn đăng ký.</p>
    </div>
  </header>

  <app-flow-guide featureKey="commission-report"></app-flow-guide>

  <!-- Filters -->
  <section class="filters">
    <label class="filter-label">Từ ngày
      <input type="date" [(ngModel)]="fromDate" (ngModelChange)="loadReport()" />
    </label>
    <label class="filter-label">Đến ngày
      <input type="date" [(ngModel)]="toDate" (ngModelChange)="loadReport()" />
    </label>
    <button (click)="loadReport()">Làm mới</button>
  </section>

  <!-- Loading -->
  <p class="loading-text" *ngIf="loading()">Đang tải dữ liệu...</p>

  <!-- Summary cards -->
  <section class="stats" *ngIf="summary()">
    <div class="stat-card revenue">
      <div class="stat-value">{{summary()!.totalRevenue | number}}đ</div>
      <div class="stat-label">Tổng Doanh thu</div>
    </div>
    <div class="stat-card commission">
      <div class="stat-value">{{summary()!.totalCommission | number}}đ</div>
      <div class="stat-label">Tổng Hoa hồng</div>
    </div>
    <div class="stat-card pending">
      <div class="stat-value">{{summary()!.pendingCommission | number}}đ</div>
      <div class="stat-label">Hoa hồng Chờ duyệt</div>
    </div>
    <div class="stat-card orders">
      <div class="stat-value">{{summary()!.totalOrders | number}}</div>
      <div class="stat-label">Tổng Đơn hàng</div>
    </div>
  </section>

  <!-- Monthly breakdown -->
  <section class="section-block" *ngIf="byMonth().length">
    <h3 class="section-title">Thống kê theo tháng</h3>
    <table class="data">
      <thead><tr>
        <th>Tháng</th>
        <th>Doanh thu</th>
        <th>Hoa hồng</th>
        <th>Số đơn</th>
      </tr></thead>
      <tbody>
        <tr *ngFor="let m of byMonth()">
          <td>{{m.month}}</td>
          <td class="right">{{m.revenue | number}}đ</td>
          <td class="right">{{m.commission | number}}đ</td>
          <td class="right">{{m.count | number}}</td>
        </tr>
      </tbody>
    </table>
  </section>

  <!-- Detail table -->
  <section class="section-block" *ngIf="details().length; else empty">
    <h3 class="section-title">Chi tiết đơn hàng</h3>
    <table class="data">
      <thead><tr>
        <th>Mã đơn</th>
        <th>Phụ huynh</th>
        <th>Học viên</th>
        <th>Tổng tiền</th>
        <th>Hoa hồng</th>
        <th>Trạng thái</th>
        <th>Sale</th>
        <th>Ngày tạo</th>
      </tr></thead>
      <tbody>
        <tr *ngFor="let d of details()">
          <td><code>{{d.orderCode}}</code></td>
          <td>{{d.parentName}}</td>
          <td>{{d.studentName}}</td>
          <td class="right">{{d.finalAmount | number}}đ</td>
          <td class="right">{{d.saleCommission | number}}đ</td>
          <td>
            <span class="badge" [style.background]="statusColor(d.status) + '20'" [style.color]="statusColor(d.status)">
              {{statusLabel(d.status)}}
            </span>
          </td>
          <td>{{d.saleName || '-'}}</td>
          <td>{{d.createdAt | date:'dd/MM/yyyy'}}</td>
        </tr>
      </tbody>
    </table>
  </section>
  <ng-template #empty>
    <p class="empty-text" *ngIf="!loading()">Không có dữ liệu hoa hồng.</p>
  </ng-template>

  <!-- Error -->
  <p class="error" *ngIf="error()">{{error()}}</p>
  `,
  styles: [`
    .page-header { display:flex; justify-content:space-between; align-items:center; padding:16px; }
    .filters { display:flex; gap:10px; padding:0 16px 12px; flex-wrap:wrap; align-items:flex-end; }
    .filter-label { display:flex; flex-direction:column; gap:4px; font-size:13px; color:#334155; }
    input, select { padding:6px 8px; border:1px solid #cbd5e1; border-radius:4px; font-size:13px; }
    .stats { display:flex; gap:12px; padding:0 16px 16px; flex-wrap:wrap; }
    .stat-card { background:#fff; padding:14px 18px; border-radius:8px; min-width:140px; border-left:4px solid #e2e8f0; }
    .stat-card.revenue { background:#dbeafe; border-left-color:#2563eb; }
    .stat-card.commission { background:#d1fae5; border-left-color:#10b981; }
    .stat-card.pending { background:#fef3c7; border-left-color:#f59e0b; }
    .stat-card.orders { background:#f3e8ff; border-left-color:#8b5cf6; }
    .stat-value { font-size:20px; font-weight:700; color:#0f172a; }
    .stat-label { font-size:12px; color:#64748b; margin-top:2px; }
    .section-block { padding:0 16px 16px; }
    .section-title { font-size:15px; color:#334155; margin:0 0 8px; }
    .data { width:100%; border-collapse:collapse; background:#fff; font-size:13px; }
    th, td { padding:8px 10px; border:1px solid #e2e8f0; }
    thead { background:#f1f5f9; font-size:12px; text-transform:uppercase; color:#64748b; }
    .right { text-align:right; }
    .badge { font-size:11px; padding:2px 8px; border-radius:9px; font-weight:600; white-space:nowrap; }
    .primary { background:#2563eb; color:#fff; border:none; padding:8px 14px; border-radius:4px; cursor:pointer; font-weight:600; }
    .empty-text { padding:16px; color:#64748b; }
    .loading-text { padding:16px; color:#64748b; font-style:italic; }
    .error { color:#dc2626; font-size:13px; padding:0 16px; }
    button { padding:6px 12px; border:1px solid #cbd5e1; border-radius:4px; background:#fff; cursor:pointer; font-size:13px; }
  `]
})
export class CommissionReportComponent implements OnInit {
  private http = inject(HttpClient);

  fromDate = '';
  toDate = '';

  summary = signal<CommissionSummary | null>(null);
  byMonth = signal<CommissionByMonth[]>([]);
  details = signal<CommissionDetail[]>([]);
  loading = signal(false);
  error = signal('');

  ngOnInit() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    this.fromDate = `${y}-${m}-01`;
    this.toDate = `${y}-${m}-${String(new Date(y, now.getMonth() + 1, 0).getDate()).padStart(2, '0')}`;
    this.loadReport();
  }

  async loadReport() {
    this.loading.set(true);
    this.error.set('');
    try {
      const params: any = {};
      if (this.fromDate) params.fromDate = this.fromDate;
      if (this.toDate) params.toDate = this.toDate;
      const res = await firstValueFrom(
        this.http.get<CommissionReport>(`${environment.apiBase}/orders/commission-report`, { params, withCredentials: true })
      );
      this.summary.set(res.summary);
      this.byMonth.set(res.byMonth || []);
      this.details.set(res.details || []);
    } catch (e: any) {
      this.error.set(e?.error?.message || 'Lỗi tải báo cáo hoa hồng.');
    } finally {
      this.loading.set(false);
    }
  }

  statusLabel(status: string): string {
    return STATUS_LABELS[status] || status;
  }

  statusColor(status: string): string {
    return STATUS_COLORS[status] || '#64748b';
  }
}
