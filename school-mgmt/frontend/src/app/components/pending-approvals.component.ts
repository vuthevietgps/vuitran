import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { PendingApprovalsService } from '../services/pending-approvals.service';

import { FlowGuideComponent } from './shared/flow-guide.component';

@Component({
  selector: 'app-pending-approvals',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, FlowGuideComponent],
  template: `
  <app-flow-guide featureKey="pending-approvals"></app-flow-guide>
  <div class="container">
    <h2>&#128203; Chờ duyệt</h2>
    <p class="subtitle">Tất cả hạng mục đang chờ Giám đốc xem xét và phê duyệt</p>

    <!-- Summary Cards -->
    <div class="summary-cards" *ngIf="data?.summary">
      <div class="card total">
        <div class="card-number">{{ data.summary.totalPending }}</div>
        <div class="card-label">Tổng chờ duyệt</div>
      </div>
      <div class="card payroll" (click)="activeTab = 'payroll'">
        <div class="card-number">{{ data.summary.pendingPayrolls }}</div>
        <div class="card-label">Bảng lương</div>
      </div>
      <div class="card invoice" (click)="activeTab = 'invoices'">
        <div class="card-number">{{ data.summary.pendingInvoices }}</div>
        <div class="card-label">Hóa đơn</div>
      </div>
      <div class="card topup" (click)="activeTab = 'topups'">
        <div class="card-number">{{ data.summary.pendingTopUps }}</div>
        <div class="card-label">Nạp ví</div>
      </div>
      <div class="card teacher" (click)="activeTab = 'teachers'">
        <div class="card-number">{{ data.summary.pendingTeachers }}</div>
        <div class="card-label">Giáo viên mới</div>
      </div>
      <div class="card ticket" (click)="activeTab = 'tickets'">
        <div class="card-number">{{ data.summary.openTickets }}</div>
        <div class="card-label">Ticket mở</div>
      </div>
    </div>

    <!-- Tabs -->
    <div class="tabs">
      <button [class.active]="activeTab === 'payroll'" (click)="activeTab = 'payroll'">
        Bảng lương <span class="badge" *ngIf="data?.summary?.pendingPayrolls">{{ data.summary.pendingPayrolls }}</span>
      </button>
      <button [class.active]="activeTab === 'invoices'" (click)="activeTab = 'invoices'">
        Hóa đơn <span class="badge" *ngIf="data?.summary?.pendingInvoices">{{ data.summary.pendingInvoices }}</span>
      </button>
      <button [class.active]="activeTab === 'topups'" (click)="activeTab = 'topups'">
        Nạp ví <span class="badge" *ngIf="data?.summary?.pendingTopUps">{{ data.summary.pendingTopUps }}</span>
      </button>
      <button [class.active]="activeTab === 'teachers'" (click)="activeTab = 'teachers'">
        Giáo viên <span class="badge" *ngIf="data?.summary?.pendingTeachers">{{ data.summary.pendingTeachers }}</span>
      </button>
    </div>

    <!-- Payroll Tab -->
    <div *ngIf="activeTab === 'payroll'" class="tab-content">
      <div *ngIf="!data?.payrolls?.length" class="empty">Không có bảng lương chờ duyệt</div>
      <table *ngIf="data?.payrolls?.length" class="data-table">
        <thead>
          <tr>
            <th>Mã lương</th>
            <th>Giáo viên</th>
            <th>Kỳ thanh toán</th>
            <th>Số buổi</th>
            <th>Thực lĩnh</th>
            <th>Ngày tạo</th>
            <th>Thao tác</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let p of data.payrolls">
            <td><strong>{{ p.payrollCode }}</strong></td>
            <td>{{ p.teacherId?.fullName || 'N/A' }}</td>
            <td>{{ formatDate(p.periodStart) }} - {{ formatDate(p.periodEnd) }}</td>
            <td>{{ p.totalSessions }}</td>
            <td class="amount">{{ formatMoney(p.netAmount) }}</td>
            <td>{{ formatDate(p.createdAt) }}</td>
            <td>
              <a routerLink="/app/payroll" class="btn-link">Xem &rarr;</a>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Invoices Tab -->
    <div *ngIf="activeTab === 'invoices'" class="tab-content">
      <div *ngIf="!data?.invoices?.length" class="empty">Không có hóa đơn chờ duyệt</div>
      <table *ngIf="data?.invoices?.length" class="data-table">
        <thead>
          <tr>
            <th>Số hóa đơn</th>
            <th>Học sinh</th>
            <th>Số tiền</th>
            <th>Người tạo</th>
            <th>Ngày tạo</th>
            <th>Thao tác</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let inv of data.invoices">
            <td><strong>{{ inv.invoiceNumber }}</strong></td>
            <td>{{ inv.studentId?.fullName || 'N/A' }}</td>
            <td class="amount">{{ formatMoney(inv.totalAmount || inv.amount) }}</td>
            <td>{{ inv.createdBy?.fullName || 'N/A' }}</td>
            <td>{{ formatDate(inv.createdAt) }}</td>
            <td>
              <a routerLink="/app/invoices" class="btn-link">Xem &rarr;</a>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- TopUps Tab -->
    <div *ngIf="activeTab === 'topups'" class="tab-content">
      <div *ngIf="!data?.topUps?.length" class="empty">Không có yêu cầu nạp ví chờ duyệt</div>
      <table *ngIf="data?.topUps?.length" class="data-table">
        <thead>
          <tr>
            <th>Người dùng</th>
            <th>Email</th>
            <th>Số tiền</th>
            <th>PT thanh toán</th>
            <th>Ngày yêu cầu</th>
            <th>Thao tác</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let t of data.topUps">
            <td>{{ t.userId?.fullName || 'N/A' }}</td>
            <td>{{ t.userId?.email || '' }}</td>
            <td class="amount">{{ formatMoney(t.amount) }}</td>
            <td>{{ t.paymentMethod || '' }}</td>
            <td>{{ formatDate(t.createdAt) }}</td>
            <td>
              <a routerLink="/app/wallets" class="btn-link">Xem &rarr;</a>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Teachers Tab -->
    <div *ngIf="activeTab === 'teachers'" class="tab-content">
      <div *ngIf="!data?.teachers?.length" class="empty">Không có giáo viên chờ duyệt</div>
      <table *ngIf="data?.teachers?.length" class="data-table">
        <thead>
          <tr>
            <th>Họ tên</th>
            <th>Email</th>
            <th>SĐT</th>
            <th>Ngày đăng ký</th>
            <th>Thao tác</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let t of data.teachers">
            <td>{{ t.userId?.fullName || t.fullName || 'N/A' }}</td>
            <td>{{ t.userId?.email || '' }}</td>
            <td>{{ t.userId?.phone || t.phone || '' }}</td>
            <td>{{ formatDate(t.createdAt) }}</td>
            <td>
              <a routerLink="/app/sessions" class="btn-link">Xem &rarr;</a>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div *ngIf="loading" class="loading">Đang tải...</div>
    <div *ngIf="error" class="error">{{ error }}</div>
  </div>
  `,
  styles: [`
    .container { padding: 24px; max-width: 1200px; margin: 0 auto; }
    h2 { margin:0 0 4px; color:#1e293b; font-size:22px; }
    .subtitle { color:#64748b; margin:0 0 20px; font-size:14px; }
    .summary-cards { display:grid; grid-template-columns:repeat(auto-fit, minmax(150px, 1fr)); gap:12px; margin-bottom:24px; }
    .card {
      background:#fff; border-radius:10px; padding:16px; text-align:center;
      box-shadow:0 1px 3px rgba(0,0,0,.08); cursor:pointer; transition:transform .15s, box-shadow .15s;
      border-left:4px solid #94a3b8;
    }
    .card:hover { transform:translateY(-2px); box-shadow:0 4px 12px rgba(0,0,0,.12); }
    .card.total { border-left-color:#dc2626; }
    .card.payroll { border-left-color:#2563eb; }
    .card.invoice { border-left-color:#16a34a; }
    .card.topup { border-left-color:#eab308; }
    .card.teacher { border-left-color:#7c3aed; }
    .card.ticket { border-left-color:#f97316; }
    .card-number { font-size:28px; font-weight:700; color:#1e293b; }
    .card-label { font-size:12px; color:#64748b; margin-top:4px; }
    .tabs { display:flex; gap:4px; border-bottom:2px solid #e2e8f0; margin-bottom:16px; }
    .tabs button {
      padding:10px 18px; border:none; background:none; cursor:pointer; font-size:13px;
      font-weight:500; color:#64748b; border-bottom:2px solid transparent; margin-bottom:-2px;
      transition:color .15s, border-color .15s;
    }
    .tabs button.active { color:#2563eb; border-bottom-color:#2563eb; }
    .tabs button:hover { color:#1e293b; }
    .badge {
      display:inline-block; background:#dc2626; color:#fff; border-radius:999px;
      font-size:11px; padding:1px 7px; margin-left:6px; font-weight:600;
    }
    .tab-content { background:#fff; border-radius:8px; padding:16px; box-shadow:0 1px 3px rgba(0,0,0,.06); }
    .data-table { width:100%; border-collapse:collapse; font-size:13px; }
    .data-table th { text-align:left; padding:10px 12px; background:#f8fafc; color:#64748b; font-weight:600; border-bottom:1px solid #e2e8f0; }
    .data-table td { padding:10px 12px; border-bottom:1px solid #f1f5f9; }
    .data-table tbody tr:hover { background:#f8fafc; }
    .amount { font-weight:600; color:#1e293b; }
    .btn-link { color:#2563eb; text-decoration:none; font-weight:500; font-size:13px; }
    .btn-link:hover { text-decoration:underline; }
    .empty { text-align:center; padding:32px; color:#94a3b8; font-size:14px; }
    .loading { text-align:center; padding:24px; color:#64748b; }
    .error { text-align:center; padding:16px; color:#dc2626; background:#fef2f2; border-radius:8px; margin-top:12px; }
  `]
})
export class PendingApprovalsComponent implements OnInit {
  private svc = inject(PendingApprovalsService);

  data: any = null;
  loading = false;
  error = '';
  activeTab = 'payroll';

  async ngOnInit() {
    await this.loadData();
  }

  async loadData() {
    this.loading = true;
    this.error = '';
    try {
      this.data = await this.svc.getAll();
    } catch (err: any) {
      this.error = err?.error?.message || 'Không thể tải dữ liệu';
    } finally {
      this.loading = false;
    }
  }

  formatDate(d: string): string {
    if (!d) return '';
    return new Date(d).toLocaleDateString('vi-VN');
  }

  formatMoney(n: number): string {
    if (n == null) return '0';
    return n.toLocaleString('vi-VN') + 'đ';
  }
}
