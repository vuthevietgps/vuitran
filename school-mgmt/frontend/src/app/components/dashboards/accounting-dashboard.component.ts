import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DashboardService } from '../../services/dashboard.service';

@Component({
  selector: 'app-accounting-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
  <div class="dashboard">
    <div class="header">
      <div class="header-left">
        <h2>Dashboard Kế toán</h2>
        <a [routerLink]="'/app/accounting-hub'" class="hub-cta">&#128218; Mở Cẩm nang Kế toán</a>
      </div>
      <div class="date-range">
        <input type="date" [(ngModel)]="fromDate" (change)="load()">
        <input type="date" [(ngModel)]="toDate" (change)="load()">
      </div>
    </div>

    <div *ngIf="loading()" class="loading">Đang tải dữ liệu...</div>
    <div *ngIf="error()" class="error">{{ error() }}</div>

    <div *ngIf="data()" class="grid">
      <!-- Revenue summary -->
      <div class="card highlight blue">
        <h4>Doanh thu buổi học</h4>
        <div class="value">{{ data()!.revenue.totalSessionRevenue | number:'1.0-0' }}đ</div>
        <small>Chi phí GV: {{ data()!.revenue.totalTeacherCost | number:'1.0-0' }}đ</small>
      </div>
      <div class="card highlight green">
        <h4>Lợi nhuận gộp</h4>
        <div class="value">{{ data()!.revenue.grossProfit | number:'1.0-0' }}đ</div>
      </div>
      <div class="card highlight purple">
        <h4>Tổng số dư ví</h4>
        <div class="value">{{ data()!.wallets.totalBalance | number:'1.0-0' }}đ</div>
        <small>{{ data()!.wallets.walletCount }} ví | {{ data()!.wallets.frozenCount }} đóng băng</small>
      </div>
      <div class="card highlight orange">
        <h4>Payroll đã trả</h4>
        <div class="value">{{ data()!.payroll.totalPaidThisPeriod | number:'1.0-0' }}đ</div>
      </div>

      <!-- Financial summary by transaction type -->
      <div class="card wide">
        <h4>Tổng hợp giao dịch</h4>
        <table class="data-table">
          <thead><tr><th>Loại</th><th>Số lượng</th><th>Tổng tiền</th></tr></thead>
          <tbody>
            <tr *ngFor="let item of objectEntries(data()!.financialSummary)">
              <td><span class="badge" [attr.data-type]="item[0]">{{ txTypeLabel(item[0]) }}</span></td>
              <td>{{ item[1].count }}</td>
              <td>{{ item[1].totalAmount | number:'1.0-0' }}đ</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Wallet stats -->
      <div class="card">
        <h4>Thống kê ví</h4>
        <div class="stat-row">
          <div class="stat"><span class="num">{{ data()!.wallets.totalTopUp | number:'1.0-0' }}đ</span><span class="lbl">Tổng nạp</span></div>
          <div class="stat"><span class="num">{{ data()!.wallets.totalDeducted | number:'1.0-0' }}đ</span><span class="lbl">Tổng trừ</span></div>
          <div class="stat"><span class="num">{{ data()!.wallets.totalRefunded | number:'1.0-0' }}đ</span><span class="lbl">Tổng hoàn</span></div>
        </div>
      </div>

      <!-- Payroll by status -->
      <div class="card">
        <h4>Payroll theo trạng thái</h4>
        <div class="status-list">
          <div *ngFor="let item of objectEntries(data()!.payroll.byStatus)" class="status-item">
            <span class="badge" [attr.data-status]="item[0]">{{ item[0] }}</span>
            <div>
              <span class="count">{{ item[1].count }} bảng</span>
              <small> | {{ item[1].totalNet | number:'1.0-0' }}đ</small>
            </div>
          </div>
        </div>
      </div>

      <!-- Pending top-ups -->
      <div class="card wide">
        <h4>Top-up chờ duyệt ({{ data()!.pendingTopUps.length }})</h4>
        <div *ngIf="data()!.pendingTopUps.length === 0" class="empty">Không có yêu cầu nào chờ duyệt</div>
        <table *ngIf="data()!.pendingTopUps.length > 0" class="data-table">
          <thead><tr><th>Người dùng</th><th>Số tiền</th><th>Ngày tạo</th></tr></thead>
          <tbody>
            <tr *ngFor="let t of data()!.pendingTopUps">
              <td>{{ t.userId?.fullName || t.userId?.email || 'N/A' }}</td>
              <td>{{ t.amount | number:'1.0-0' }}đ</td>
              <td>{{ t.createdAt | date:'dd/MM/yyyy HH:mm' }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Recent ledger -->
      <div class="card full">
        <h4>Giao dịch gần đây</h4>
        <table class="data-table">
          <thead><tr><th>Loại</th><th>Người dùng</th><th>Số tiền</th><th>Trạng thái</th><th>Ngày</th></tr></thead>
          <tbody>
            <tr *ngFor="let l of data()!.ledgerRecent">
              <td><span class="badge" [attr.data-type]="l.type">{{ txTypeLabel(l.type) }}</span></td>
              <td>{{ l.userId?.fullName || 'N/A' }}</td>
              <td>{{ l.amount | number:'1.0-0' }}đ</td>
              <td><span class="badge" [attr.data-status]="l.status">{{ l.status }}</span></td>
              <td>{{ l.createdAt | date:'dd/MM/yyyy HH:mm' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
  `,
  styles: [`
    .dashboard { padding: 24px; }
    .header { display:flex; justify-content:space-between; align-items:center; margin-bottom:24px; flex-wrap:wrap; gap:12px; }
    .header-left { display:flex; align-items:center; gap:16px; flex-wrap:wrap; }
    .hub-cta { font-size:13px; font-weight:600; padding:7px 14px; border-radius:8px; background:rgba(16,185,129,0.1); color:#059669; border:1px solid rgba(16,185,129,0.25); text-decoration:none; }
    .hub-cta:hover { background:rgba(16,185,129,0.18); }
    .header h2 { margin:0; color:#1e293b; }
    .date-range { display:flex; gap:8px; }
    .date-range input { padding:6px 10px; border:1px solid #cbd5e1; border-radius:6px; font-size:14px; }
    .loading { text-align:center; padding:40px; color:#64748b; }
    .error { background:#fef2f2; color:#dc2626; padding:12px 16px; border-radius:8px; margin-bottom:16px; }
    .grid { display:grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap:16px; }
    .card { background:#fff; border-radius:12px; padding:20px; box-shadow:0 1px 3px rgba(0,0,0,0.08); }
    .card h4 { margin:0 0 12px; color:#475569; font-size:14px; text-transform:uppercase; letter-spacing:0.5px; }
    .card.wide { grid-column: span 2; }
    .card.full { grid-column: 1 / -1; }
    .card.highlight { border-top:4px solid; }
    .card.highlight.blue { border-color:#3b82f6; }
    .card.highlight.green { border-color:#22c55e; }
    .card.highlight.purple { border-color:#8b5cf6; }
    .card.highlight.orange { border-color:#f97316; }
    .value { font-size:28px; font-weight:700; color:#1e293b; margin-bottom:4px; }
    .card small { color:#94a3b8; }
    .stat-row { display:flex; gap:24px; flex-wrap:wrap; }
    .stat { display:flex; flex-direction:column; align-items:center; }
    .stat .num { font-size:18px; font-weight:700; color:#1e293b; }
    .stat .lbl { font-size:12px; color:#94a3b8; margin-top:2px; }
    .status-list { display:flex; flex-direction:column; gap:8px; }
    .status-item { display:flex; justify-content:space-between; align-items:center; }
    .badge { padding:2px 8px; border-radius:99px; font-size:11px; background:#e2e8f0; color:#475569; font-weight:600; }
    .badge[data-status="PAID"], .badge[data-status="COMPLETED"], .badge[data-status="APPROVED"] { background:#dcfce7; color:#16a34a; }
    .badge[data-status="PENDING"], .badge[data-status="PENDING_REVIEW"] { background:#fef9c3; color:#ca8a04; }
    .badge[data-status="REJECTED"] { background:#fef2f2; color:#dc2626; }
    .badge[data-type="TOP_UP"] { background:#dbeafe; color:#2563eb; }
    .badge[data-type="SESSION_DEDUCT"] { background:#fef2f2; color:#dc2626; }
    .badge[data-type="REFUND"] { background:#fef9c3; color:#ca8a04; }
    .badge[data-type="ADJUSTMENT"] { background:#f3e8ff; color:#7c3aed; }
    .badge[data-type="BONUS"] { background:#dcfce7; color:#16a34a; }
    .count { font-weight:600; color:#1e293b; }
    .data-table { width:100%; border-collapse:collapse; font-size:13px; }
    .data-table th { text-align:left; padding:8px; border-bottom:2px solid #e2e8f0; color:#64748b; font-size:12px; text-transform:uppercase; }
    .data-table td { padding:8px; border-bottom:1px solid #f1f5f9; }
    .empty { color:#94a3b8; font-style:italic; padding:12px 0; }
    p { margin:4px 0; color:#475569; font-size:14px; }
    @media (max-width:768px) { .card.wide, .card.full { grid-column: span 1; } }
  `]
})
export class AccountingDashboardComponent implements OnInit {
  data = signal<any>(null);
  loading = signal(false);
  error = signal('');
  fromDate = '';
  toDate = '';

  constructor(private dashboardService: DashboardService) {}

  ngOnInit() { this.load(); }

  async load() {
    this.loading.set(true);
    this.error.set('');
    try {
      const result = await this.dashboardService.getAccountingDashboard(this.fromDate || undefined, this.toDate || undefined);
      this.data.set(result);
    } catch (e: any) {
      this.error.set(e?.error?.message || 'Lỗi tải dữ liệu');
    } finally {
      this.loading.set(false);
    }
  }

  objectEntries(obj: any): [string, any][] {
    return obj ? Object.entries(obj) : [];
  }

  txTypeLabel(type: string): string {
    const map: Record<string, string> = {
      TOP_UP: 'Nạp tiền',
      SESSION_DEDUCT: 'Trừ buổi học',
      REFUND: 'Hoàn tiền',
      ADJUSTMENT: 'Điều chỉnh',
      BONUS: 'Thưởng',
    };
    return map[type] || type;
  }
}
