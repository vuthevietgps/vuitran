import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuditLogService } from '../services/audit-log.service';

import { FlowGuideComponent } from './shared/flow-guide.component';

@Component({
  selector: 'app-audit-log',
  standalone: true,
  imports: [CommonModule, FormsModule, FlowGuideComponent],
  template: `
  <app-flow-guide featureKey="audit-log"></app-flow-guide>
  <div class="container">
    <h2>&#128270; Nhật ký hoạt động</h2>
    <p class="subtitle">Theo dõi tất cả thao tác trong hệ thống</p>

    <!-- Stats Cards -->
    <div class="stat-row" *ngIf="stats">
      <div class="stat-card">
        <div class="stat-number">{{ stats.todayCount }}</div>
        <div class="stat-label">Hôm nay</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">{{ stats.weekCount }}</div>
        <div class="stat-label">7 ngày qua</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">{{ stats.totalCount }}</div>
        <div class="stat-label">Tổng</div>
      </div>
    </div>

    <!-- Filters -->
    <div class="filters">
      <input type="text" placeholder="Tìm kiếm..." [(ngModel)]="search" (keyup.enter)="loadData()" class="search-input" />
      <select [(ngModel)]="filterModule" (change)="loadData()" class="filter-select">
        <option value="">Tất cả module</option>
        <option *ngFor="let m of modules" [value]="m">{{ moduleLabels[m] || m }}</option>
      </select>
      <select [(ngModel)]="filterAction" (change)="loadData()" class="filter-select">
        <option value="">Tất cả thao tác</option>
        <option *ngFor="let a of actions" [value]="a">{{ actionLabels[a] || a }}</option>
      </select>
      <input type="date" [(ngModel)]="fromDate" (change)="loadData()" class="date-input" />
      <input type="date" [(ngModel)]="toDate" (change)="loadData()" class="date-input" />
      <button class="btn-reset" (click)="resetFilters()">Xóa lọc</button>
    </div>

    <!-- Activity Chart (bar simplified) -->
    <div class="activity-chart" *ngIf="stats?.recentActivity?.length">
      <h4>Hoạt động 7 ngày qua</h4>
      <div class="chart-bars">
        <div *ngFor="let day of stats.recentActivity" class="chart-col">
          <div class="chart-bar" [style.height.px]="getBarHeight(day.count)">
            <span class="bar-value" *ngIf="day.count > 0">{{ day.count }}</span>
          </div>
          <div class="chart-label">{{ formatShortDate(day.date) }}</div>
        </div>
      </div>
    </div>

    <!-- Data Table -->
    <div class="table-wrap">
      <table class="data-table" *ngIf="logs.length">
        <thead>
          <tr>
            <th>Thời gian</th>
            <th>Người dùng</th>
            <th>Vai trò</th>
            <th>Module</th>
            <th>Thao tác</th>
            <th>Mô tả</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let log of logs">
            <td class="time-cell">{{ formatDateTime(log.createdAt) }}</td>
            <td>
              <div class="user-cell">
                <strong>{{ log.userFullName || 'Hệ thống' }}</strong>
                <small>{{ log.userEmail || '' }}</small>
              </div>
            </td>
            <td><span class="role-tag">{{ log.userRole || '' }}</span></td>
            <td><span class="module-tag">{{ moduleLabels[log.module] || log.module }}</span></td>
            <td><span class="action-tag" [class]="'action-' + (log.action || '').toLowerCase()">{{ actionLabels[log.action] || log.action }}</span></td>
            <td class="desc-cell">{{ log.description }}</td>
          </tr>
        </tbody>
      </table>
      <div *ngIf="!logs.length && !loading" class="empty">Không có dữ liệu</div>
    </div>

    <!-- Pagination -->
    <div class="pagination" *ngIf="totalPages > 1">
      <button (click)="goPage(page - 1)" [disabled]="page <= 1">&laquo;</button>
      <span>{{ page }}/{{ totalPages }} ({{ total }} bản ghi)</span>
      <button (click)="goPage(page + 1)" [disabled]="page >= totalPages">&raquo;</button>
    </div>

    <div *ngIf="loading" class="loading">Đang tải...</div>
  </div>
  `,
  styles: [`
    .container { padding:24px; max-width:1200px; margin:0 auto; }
    h2 { margin:0 0 4px; color:#1e293b; font-size:22px; }
    .subtitle { color:#64748b; margin:0 0 20px; font-size:14px; }
    .stat-row { display:flex; gap:12px; margin-bottom:20px; }
    .stat-card { background:#fff; border-radius:10px; padding:16px 24px; text-align:center; box-shadow:0 1px 3px rgba(0,0,0,.06); flex:1; }
    .stat-number { font-size:26px; font-weight:700; color:#1e293b; }
    .stat-label { font-size:12px; color:#64748b; margin-top:2px; }
    .filters { display:flex; gap:8px; margin-bottom:16px; flex-wrap:wrap; align-items:center; }
    .search-input { padding:7px 12px; border:1px solid #e2e8f0; border-radius:6px; font-size:13px; width:180px; }
    .filter-select { padding:7px 10px; border:1px solid #e2e8f0; border-radius:6px; font-size:13px; background:#fff; }
    .date-input { padding:7px 10px; border:1px solid #e2e8f0; border-radius:6px; font-size:13px; }
    .btn-reset { padding:7px 14px; border:1px solid #e2e8f0; border-radius:6px; background:#fff; cursor:pointer; font-size:12px; color:#64748b; }
    .btn-reset:hover { background:#f8fafc; }
    .activity-chart { background:#fff; border-radius:10px; padding:16px; margin-bottom:16px; box-shadow:0 1px 3px rgba(0,0,0,.06); }
    .activity-chart h4 { margin:0 0 12px; font-size:14px; color:#1e293b; }
    .chart-bars { display:flex; gap:8px; align-items:flex-end; height:120px; }
    .chart-col { flex:1; display:flex; flex-direction:column; align-items:center; }
    .chart-bar { background:linear-gradient(#3b82f6, #2563eb); border-radius:4px 4px 0 0; min-width:28px; transition:height .3s; position:relative; min-height:2px; }
    .bar-value { position:absolute; top:-18px; font-size:10px; color:#64748b; font-weight:600; width:100%; text-align:center; }
    .chart-label { font-size:10px; color:#94a3b8; margin-top:4px; }
    .table-wrap { background:#fff; border-radius:10px; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,.06); }
    .data-table { width:100%; border-collapse:collapse; font-size:13px; }
    .data-table th { text-align:left; padding:10px 12px; background:#f8fafc; color:#64748b; font-weight:600; border-bottom:1px solid #e2e8f0; white-space:nowrap; }
    .data-table td { padding:10px 12px; border-bottom:1px solid #f1f5f9; vertical-align:top; }
    .data-table tbody tr:hover { background:#f8fafc; }
    .time-cell { white-space:nowrap; font-size:12px; color:#64748b; }
    .user-cell { display:flex; flex-direction:column; }
    .user-cell strong { font-size:13px; }
    .user-cell small { color:#94a3b8; font-size:11px; }
    .role-tag { font-size:11px; padding:2px 8px; border-radius:999px; background:#f1f5f9; color:#475569; font-weight:500; }
    .module-tag { font-size:11px; padding:2px 8px; border-radius:999px; background:#eff6ff; color:#2563eb; font-weight:500; }
    .action-tag { font-size:11px; padding:2px 8px; border-radius:999px; font-weight:500; }
    .action-create { background:#dcfce7; color:#166534; }
    .action-update { background:#fef3c7; color:#92400e; }
    .action-delete { background:#fecaca; color:#991b1b; }
    .action-approve { background:#dcfce7; color:#166534; }
    .action-reject { background:#fecaca; color:#991b1b; }
    .action-login { background:#e0e7ff; color:#3730a3; }
    .action-export { background:#f3e8ff; color:#7c3aed; }
    .action-status_change { background:#fef3c7; color:#92400e; }
    .action-lock { background:#fecaca; color:#991b1b; }
    .action-unlock { background:#dcfce7; color:#166534; }
    .action-payment { background:#cffafe; color:#0e7490; }
    .desc-cell { max-width:300px; word-break:break-word; color:#475569; }
    .pagination { display:flex; align-items:center; justify-content:center; gap:16px; margin-top:16px; }
    .pagination button { padding:6px 14px; border:1px solid #e2e8f0; border-radius:6px; background:#fff; cursor:pointer; }
    .pagination button:disabled { opacity:.4; cursor:default; }
    .pagination span { font-size:13px; color:#64748b; }
    .empty { text-align:center; padding:48px; color:#94a3b8; }
    .loading { text-align:center; padding:24px; color:#64748b; }
  `]
})
export class AuditLogComponent implements OnInit {
  private svc = inject(AuditLogService);

  logs: any[] = [];
  stats: any = null;
  loading = false;
  total = 0;
  page = 1;
  totalPages = 1;

  search = '';
  filterModule = '';
  filterAction = '';
  fromDate = '';
  toDate = '';

  modules = [
    'USERS', 'STUDENTS', 'TEACHERS', 'CLASSES', 'SESSIONS',
    'PAYROLL', 'WALLETS', 'INVOICES', 'TICKETS', 'PRODUCTS',
    'ATTENDANCE', 'AUTH', 'TEACHING_MATERIALS', 'LEADS', 'ORDERS', 'ADS',
  ];

  actions = [
    'CREATE', 'UPDATE', 'DELETE', 'APPROVE', 'REJECT',
    'LOGIN', 'LOGOUT', 'LOCK', 'UNLOCK', 'STATUS_CHANGE', 'PAYMENT', 'EXPORT',
  ];

  moduleLabels: Record<string, string> = {
    USERS: 'Người dùng', STUDENTS: 'Học sinh', TEACHERS: 'Giáo viên',
    CLASSES: 'Lớp học', SESSIONS: 'Buổi học', PAYROLL: 'Bảng lương',
    WALLETS: 'Ví', INVOICES: 'Hóa đơn', TICKETS: 'Ticket',
    PRODUCTS: 'Khóa học', ATTENDANCE: 'Điểm danh', AUTH: 'Đăng nhập',
    TEACHING_MATERIALS: 'Tài liệu GD', LEADS: 'Lead', ORDERS: 'Don hang', ADS: 'Quang cao',
  };

  actionLabels: Record<string, string> = {
    CREATE: 'Tạo mới', UPDATE: 'Cập nhật', DELETE: 'Xóa',
    APPROVE: 'Duyệt', REJECT: 'Từ chối', LOGIN: 'Đăng nhập',
    LOGOUT: 'Đăng xuất', LOCK: 'Khóa', UNLOCK: 'Mở khóa',
    STATUS_CHANGE: 'Đổi trạng thái', PAYMENT: 'Thanh toán', EXPORT: 'Xuất báo cáo',
  };

  async ngOnInit() {
    await Promise.all([this.loadData(), this.loadStats()]);
  }

  async loadData() {
    this.loading = true;
    try {
      const result = await this.svc.getAll({
        page: this.page, limit: 50,
        search: this.search, module: this.filterModule,
        action: this.filterAction, fromDate: this.fromDate, toDate: this.toDate,
      });
      this.logs = result.data || [];
      this.total = result.total || 0;
      this.totalPages = result.totalPages || 1;
    } catch (err) {
      console.error('Load audit logs error:', err);
    } finally {
      this.loading = false;
    }
  }

  async loadStats() {
    try {
      this.stats = await this.svc.getStats();
    } catch {}
  }

  resetFilters() {
    this.search = '';
    this.filterModule = '';
    this.filterAction = '';
    this.fromDate = '';
    this.toDate = '';
    this.page = 1;
    this.loadData();
  }

  async goPage(p: number) {
    this.page = p;
    await this.loadData();
  }

  formatDateTime(d: string): string {
    if (!d) return '';
    const dt = new Date(d);
    return dt.toLocaleDateString('vi-VN') + ' ' + dt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  }

  formatShortDate(d: string): string {
    if (!d) return '';
    const parts = d.split('-');
    return `${parts[2]}/${parts[1]}`;
  }

  getBarHeight(count: number): number {
    if (!this.stats?.recentActivity?.length) return 2;
    const max = Math.max(...this.stats.recentActivity.map((d: any) => d.count), 1);
    return Math.max(2, (count / max) * 100);
  }
}
