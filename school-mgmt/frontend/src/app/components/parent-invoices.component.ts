import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

import { FlowGuideComponent } from './shared/flow-guide.component';

interface StudentInvoice {
  _id: string;
  invoiceNumber: string;
  classId: { _id: string; name: string };
  sessions: number;
  bonusSessions?: number;
  trialSessions?: number;
  pricePerSession: number;
  amount: number;
  sessionsRemaining: number;
  bonusSessionsRemaining?: number;
  trialSessionsRemaining?: number;
  status: string;
  createdAt: string;
}

interface ChildData {
  student: { _id: string; fullName: string; studentCode: string };
  invoices: StudentInvoice[];
}

interface ParentInvoicesResponse {
  children: ChildData[];
  summary: { totalPaid: number; totalPending: number; totalSessionsRemaining: number };
}

const STATUS_LABELS: Record<string, string> = {
  APPROVED: 'Đã thanh toán',
  PENDING_APPROVAL: 'Chờ duyệt',
  REJECTED: 'Từ chối',
};

const STATUS_COLORS: Record<string, string> = {
  APPROVED: '#10b981',
  PENDING_APPROVAL: '#f59e0b',
  REJECTED: '#ef4444',
};

@Component({
  selector: 'app-parent-invoices',
  standalone: true,
  imports: [CommonModule, FlowGuideComponent],
  template: `
  <header class="page-header">
    <div>
      <h2>Hóa đơn học phí</h2>
      <p>Theo dõi hóa đơn và buổi học còn lại của con.</p>
    </div>
  </header>

  <app-flow-guide featureKey="parent-invoices"></app-flow-guide>

  <!-- Summary cards -->
  <section class="stats" *ngIf="summary()">
    <div class="stat-card paid">
      <div class="stat-value">{{summary()!.totalPaid | number}}đ</div>
      <div class="stat-label">Tổng đã thanh toán</div>
    </div>
    <div class="stat-card pending">
      <div class="stat-value">{{summary()!.totalPending | number}}đ</div>
      <div class="stat-label">Chờ duyệt</div>
    </div>
    <div class="stat-card sessions">
      <div class="stat-value">{{summary()!.totalSessionsRemaining}}</div>
      <div class="stat-label">Buổi còn lại</div>
    </div>
  </section>

  <!-- Student tabs -->
  <section class="tabs" *ngIf="children().length > 1">
    <button
      *ngFor="let child of children(); let i = index"
      class="tab-btn"
      [class.active]="selectedTab() === i"
      (click)="selectedTab.set(i)">
      {{child.student.fullName}} ({{child.student.studentCode}})
    </button>
  </section>

  <!-- Invoices per student -->
  <div *ngIf="selectedChild() as child" class="student-section">
    <h3 class="student-name">{{child.student.fullName}} — <small>{{child.student.studentCode}}</small></h3>

    <table class="data" *ngIf="child.invoices.length; else empty">
      <thead><tr>
        <th>Mã hóa đơn</th>
        <th>Lớp</th>
        <th title="Lấy từ hóa đơn: buổi chính + buổi tặng + buổi thử">Số buổi (HĐ)</th>
        <th>Giá/buổi</th>
        <th>Thành tiền</th>
        <th title="Lấy từ số dư hóa đơn đã duyệt: chính + tặng + thử còn lại">Buổi còn lại (HĐ)</th>
        <th>Trạng thái</th>
        <th>Ngày tạo</th>
      </tr></thead>
      <tbody>
        <tr *ngFor="let inv of child.invoices">
          <td><code>{{inv.invoiceNumber}}</code></td>
          <td>{{inv.classId.name || '-'}}</td>
          <td class="center">{{formatRegisteredSessions(inv)}}</td>
          <td class="right">{{inv.pricePerSession | number}}đ</td>
          <td class="right"><strong>{{inv.amount | number}}đ</strong></td>
          <td class="center">{{formatRemainingSessions(inv)}}</td>
          <td>
            <span class="badge"
              [style.background]="statusColor(inv.status) + '20'"
              [style.color]="statusColor(inv.status)">
              {{statusLabel(inv.status)}}
            </span>
          </td>
          <td>{{inv.createdAt | date:'dd/MM/yyyy'}}</td>
        </tr>
      </tbody>
    </table>
    <ng-template #empty><p class="empty-text">Chưa có hóa đơn nào.</p></ng-template>
  </div>

  <div *ngIf="loading()" class="loading-text">Đang tải dữ liệu...</div>
  <div *ngIf="error()" class="error">{{error()}}</div>
  `,
  styles: [`
    .page-header { display:flex; justify-content:space-between; align-items:center; padding:16px; }
    .stats { display:flex; gap:12px; padding:0 16px 16px; flex-wrap:wrap; }
    .stat-card { background:#fff; padding:14px 18px; border-radius:8px; min-width:140px; border-left:4px solid #e2e8f0; }
    .stat-card.paid { background:#d1fae5; border-left-color:#10b981; }
    .stat-card.pending { background:#fef3c7; border-left-color:#f59e0b; }
    .stat-card.sessions { background:#dbeafe; border-left-color:#3b82f6; }
    .stat-value { font-size:20px; font-weight:700; color:#0f172a; }
    .stat-label { font-size:12px; color:#64748b; margin-top:2px; }
    .tabs { display:flex; gap:8px; padding:0 16px 12px; flex-wrap:wrap; }
    .tab-btn { padding:8px 16px; border:1px solid #cbd5e1; border-radius:6px; background:#fff; cursor:pointer; font-size:13px; font-weight:500; color:#334155; transition:all .15s; }
    .tab-btn:hover { background:#f1f5f9; }
    .tab-btn.active { background:#2563eb; color:#fff; border-color:#2563eb; }
    .student-section { padding:0 16px 16px; }
    .student-name { font-size:15px; color:#334155; margin:0 0 12px; }
    .student-name small { color:#64748b; font-weight:400; }
    .data { width:100%; border-collapse:collapse; background:#fff; font-size:13px; }
    th, td { padding:8px 10px; border:1px solid #e2e8f0; }
    thead { background:#f1f5f9; font-size:12px; text-transform:uppercase; color:#64748b; }
    .center { text-align:center; }
    .right { text-align:right; }
    .badge { font-size:11px; padding:2px 8px; border-radius:9px; font-weight:600; white-space:nowrap; }
    .empty-text { padding:16px; color:#64748b; }
    .loading-text { padding:16px; color:#64748b; font-size:13px; }
    .error { padding:16px; color:#dc2626; font-size:13px; }
  `]
})
export class ParentInvoicesComponent implements OnInit {
  private http: HttpClient;

  children = signal<ChildData[]>([]);
  summary = signal<ParentInvoicesResponse['summary'] | null>(null);
  selectedTab = signal(0);
  loading = signal(false);
  error = signal('');

  selectedChild = computed(() => {
    const list = this.children();
    const idx = this.selectedTab();
    return list.length > 0 ? list[idx] : null;
  });

  constructor(http: HttpClient) {
    this.http = http;
  }

  ngOnInit() {
    this.loadData();
  }

  statusLabel(s: string) { return STATUS_LABELS[s] || s; }
  statusColor(s: string) { return STATUS_COLORS[s] || '#64748b'; }

  formatRegisteredSessions(inv: StudentInvoice): string {
    const sessions = Number(inv.sessions || 0);
    const bonusSessions = Number(inv.bonusSessions || 0);
    const trialSessions = Number(inv.trialSessions || 0);

    const parts: string[] = [];
    if (sessions > 0) parts.push(`${sessions} chính`);
    if (bonusSessions > 0) parts.push(`${bonusSessions} tặng`);
    if (trialSessions > 0) parts.push(`${trialSessions} thử`);

    const total = sessions + bonusSessions + trialSessions;
    if (parts.length === 0) return '0';
    if (parts.length === 1) return String(total);
    return `${total} (${parts.join(' + ')})`;
  }

  formatRemainingSessions(inv: StudentInvoice): number {
    return Number(inv.sessionsRemaining || 0)
      + Number(inv.bonusSessionsRemaining || 0)
      + Number(inv.trialSessionsRemaining || 0);
  }

  async loadData() {
    this.loading.set(true);
    this.error.set('');
    try {
      const res = await firstValueFrom(
        this.http.get<ParentInvoicesResponse>(`${environment.apiBase}/invoices/my-children`, { withCredentials: true })
      );
      this.children.set(res.children || []);
      this.summary.set(res.summary || null);
      this.selectedTab.set(0);
    } catch (err: any) {
      this.error.set(err?.error?.message || 'Không thể tải dữ liệu hóa đơn.');
    } finally {
      this.loading.set(false);
    }
  }
}

