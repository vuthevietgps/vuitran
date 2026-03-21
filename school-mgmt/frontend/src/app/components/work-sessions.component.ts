import { Component, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WorkSessionService } from '../services/work-session.service';
import { AuthService } from '../services/auth.service';

import { FlowGuideComponent } from './shared/flow-guide.component';

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Đang online',
  COMPLETED: 'Hoàn thành',
  AUTO_CLOSED: 'Tự đóng',
};

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: '#10b981',
  COMPLETED: '#3b82f6',
  AUTO_CLOSED: '#f59e0b',
};

@Component({
  selector: 'app-work-sessions',
  standalone: true,
  imports: [CommonModule, FormsModule, FlowGuideComponent],
  template: `
  <header class="page-header">
    <div>
      <h2>Chấm công nhân viên</h2>
      <p>Theo dõi giờ làm việc và chấm công hàng ngày.</p>
    </div>
    <button class="toggle-btn" (click)="toggleView()">
      {{ viewMode() === 'list' ? '📊 Xem tổng hợp tháng' : '📋 Xem danh sách' }}
    </button>
  </header>

  <app-flow-guide featureKey="work-sessions"></app-flow-guide>

  <!-- Summary stats bar -->
  <section class="stats" *ngIf="viewMode() === 'list'">
    <div class="stat-card total">
      <div class="stat-value">{{ totalSessions() }}</div>
      <div class="stat-label">Tổng phiên</div>
    </div>
    <div class="stat-card active">
      <div class="stat-value">{{ activeSessions() }}</div>
      <div class="stat-label">Đang online</div>
    </div>
    <div class="stat-card completed">
      <div class="stat-value">{{ totalHours() }}</div>
      <div class="stat-label">Tổng giờ làm</div>
    </div>
    <div class="stat-card late">
      <div class="stat-value">{{ lateSessions() }}</div>
      <div class="stat-label">Số lần muộn</div>
    </div>
  </section>

  <!-- Filters -->
  <section class="filters">
    <input type="date" [(ngModel)]="fromDate" (ngModelChange)="reload()" placeholder="Từ ngày" />
    <input type="date" [(ngModel)]="toDate" (ngModelChange)="reload()" placeholder="Đến ngày" />
    <input
      *ngIf="isAdmin()"
      placeholder="Lọc theo nhân viên..."
      [(ngModel)]="userKeyword"
      (ngModelChange)="applyFilter()"
    />
    <button (click)="resetFilters()">Làm mới</button>
  </section>

  <!-- LIST VIEW -->
  <ng-container *ngIf="viewMode() === 'list'">
    <table class="data" *ngIf="filtered().length; else emptyList">
      <thead>
        <tr>
          <th *ngIf="isAdmin()">Nhân viên</th>
          <th>Ngày</th>
          <th>Giờ vào</th>
          <th>Giờ ra</th>
          <th>Tổng giờ</th>
          <th>Trạng thái</th>
          <th>Đi muộn</th>
          <th *ngIf="canEdit()"></th>
        </tr>
      </thead>
      <tbody>
        <tr *ngFor="let s of paginated()">
          <td *ngIf="isAdmin()">{{ s.userId?.fullName || '—' }}</td>
          <td>{{ s.date | date:'dd/MM/yyyy' }}</td>
          <td>{{ s.loginTime | date:'HH:mm' }}</td>
          <td>{{ s.logoutTime ? (s.logoutTime | date:'HH:mm') : '—' }}</td>
          <td class="center">{{ formatMinutes(s.totalMinutes) }}</td>
          <td>
            <span
              class="badge"
              [style.background]="statusColor(s.status) + '20'"
              [style.color]="statusColor(s.status)"
            >
              {{ statusLabel(s.status) }}
            </span>
          </td>
          <td class="center">
            <span *ngIf="s.isLate" class="badge late-badge">
              +{{ s.lateMinutes }}p
            </span>
            <span *ngIf="!s.isLate" class="on-time">—</span>
          </td>
          <td *ngIf="canEdit()" class="actions-cell">
            <button class="btn-sm primary" (click)="openEdit(s)">✏️ Sửa</button>
          </td>
        </tr>
      </tbody>
    </table>
    <ng-template #emptyList>
      <p class="empty-text">Không có dữ liệu chấm công.</p>
    </ng-template>

    <!-- Pagination -->
    <div class="pagination" *ngIf="totalPages() > 1">
      <button [disabled]="page() === 1" (click)="setPage(page() - 1)">‹</button>
      <span>Trang {{ page() }} / {{ totalPages() }}</span>
      <button [disabled]="page() === totalPages()" (click)="setPage(page() + 1)">›</button>
    </div>
  </ng-container>

  <!-- SUMMARY VIEW -->
  <ng-container *ngIf="viewMode() === 'summary'">
    <div class="summary-header">
      <label>Tháng:
        <input type="month" [(ngModel)]="summaryMonth" (ngModelChange)="loadSummary()" />
      </label>
    </div>
    <table class="data" *ngIf="summary().length; else emptySummary">
      <thead>
        <tr>
          <th>Nhân viên</th>
          <th class="center">Tổng phiên</th>
          <th class="center">Tổng giờ</th>
          <th class="center">Số lần muộn</th>
          <th class="center">Phút muộn tích lũy</th>
        </tr>
      </thead>
      <tbody>
        <tr *ngFor="let row of summary()">
          <td><strong>{{ row.fullName }}</strong></td>
          <td class="center">{{ row.totalSessions }}</td>
          <td class="center">{{ formatMinutes(row.totalMinutes) }}</td>
          <td class="center">
            <span *ngIf="row.lateDays > 0" class="badge late-badge">{{ row.lateDays }}</span>
            <span *ngIf="!row.lateDays">0</span>
          </td>
          <td class="center">
            <span *ngIf="row.totalLateMinutes > 0" class="late-text">{{ row.totalLateMinutes }}p</span>
            <span *ngIf="!row.totalLateMinutes">—</span>
          </td>
        </tr>
      </tbody>
    </table>
    <ng-template #emptySummary>
      <p class="empty-text">Không có dữ liệu tổng hợp.</p>
    </ng-template>
  </ng-container>

  <!-- Edit Modal -->
  <div class="modal-backdrop" *ngIf="showEditModal()">
    <div class="modal">
      <h3>Chỉnh sửa phiên làm việc</h3>
      <div class="session-info" *ngIf="editingSession()">
        <strong>{{ editingSession()!.userId?.fullName }}</strong>
        — {{ editingSession()!.date | date:'dd/MM/yyyy' }}
      </div>
      <label>Giờ vào <span class="req">*</span>
        <input type="datetime-local" [(ngModel)]="editForm.loginTime" />
      </label>
      <label>Giờ ra
        <input type="datetime-local" [(ngModel)]="editForm.logoutTime" />
      </label>
      <label>Ghi chú
        <textarea [(ngModel)]="editForm.notes" rows="3"></textarea>
      </label>
      <div class="form-actions">
        <button class="primary" (click)="submitEdit()">Cập nhật</button>
        <button type="button" (click)="closeEditModal()">Hủy</button>
      </div>
      <p class="error" *ngIf="editError()">{{ editError() }}</p>
    </div>
  </div>
  `,
  styles: [`
    .page-header { display:flex; justify-content:space-between; align-items:center; padding:16px; }
    h2 { margin:0 0 4px; font-size:20px; color:#0f172a; }
    p { margin:0; font-size:13px; color:#64748b; }

    .toggle-btn { background:#f1f5f9; border:1px solid #cbd5e1; padding:8px 14px; border-radius:6px; cursor:pointer; font-size:13px; font-weight:600; color:#334155; }
    .toggle-btn:hover { background:#e2e8f0; }

    .stats { display:flex; gap:12px; padding:0 16px 16px; flex-wrap:wrap; }
    .stat-card { background:#fff; padding:14px 18px; border-radius:8px; min-width:130px; border-left:4px solid #e2e8f0; }
    .stat-card.total { background:#f0f9ff; border-left-color:#3b82f6; }
    .stat-card.active { background:#d1fae5; border-left-color:#10b981; }
    .stat-card.completed { background:#ede9fe; border-left-color:#8b5cf6; }
    .stat-card.late { background:#fef3c7; border-left-color:#f59e0b; }
    .stat-value { font-size:22px; font-weight:700; color:#0f172a; }
    .stat-label { font-size:12px; color:#64748b; margin-top:2px; }

    .filters { display:flex; gap:10px; padding:0 16px 12px; flex-wrap:wrap; align-items:center; }
    input, select, textarea { padding:6px 8px; border:1px solid #cbd5e1; border-radius:4px; font-size:13px; }
    textarea { width:100%; resize:vertical; }
    .filters input { min-width:130px; }
    .filters button { padding:6px 12px; border:1px solid #cbd5e1; border-radius:4px; background:#fff; cursor:pointer; font-size:13px; }
    .filters button:hover { background:#f1f5f9; }

    .data { width:100%; border-collapse:collapse; background:#fff; font-size:13px; }
    th, td { padding:8px 10px; border:1px solid #e2e8f0; }
    thead { background:#f1f5f9; font-size:12px; text-transform:uppercase; color:#64748b; }
    .center { text-align:center; }

    .badge { font-size:11px; padding:2px 8px; border-radius:9px; font-weight:600; white-space:nowrap; }
    .late-badge { background:#fee2e2; color:#dc2626; font-weight:700; }
    .on-time { color:#94a3b8; font-size:12px; }
    .late-text { color:#dc2626; font-weight:700; }

    .actions-cell { white-space:nowrap; }
    .btn-sm { padding:4px 8px; border:1px solid #cbd5e1; border-radius:4px; background:#fff; cursor:pointer; font-size:12px; }
    .btn-sm.primary { color:#2563eb; border-color:#93c5fd; }
    .btn-sm.primary:hover { background:#eff6ff; }

    .pagination { display:flex; align-items:center; gap:12px; padding:12px 16px; justify-content:flex-end; font-size:13px; color:#64748b; }
    .pagination button { padding:4px 10px; border:1px solid #cbd5e1; border-radius:4px; cursor:pointer; background:#fff; }
    .pagination button:disabled { opacity:0.4; cursor:default; }

    .summary-header { padding:0 16px 12px; display:flex; gap:12px; align-items:center; }
    .summary-header label { display:flex; align-items:center; gap:8px; font-size:13px; color:#334155; }

    .modal-backdrop { position:fixed; inset:0; background:rgba(15,23,42,.55); display:flex; align-items:center; justify-content:center; z-index:100; }
    .modal { background:#fff; padding:24px; border-radius:8px; max-width:480px; width:95%; box-shadow:0 8px 24px rgba(15,23,42,.2); max-height:90vh; overflow-y:auto; }
    .modal h3 { margin:0 0 16px; font-size:16px; color:#0f172a; }
    .session-info { background:#f1f5f9; padding:8px 12px; border-radius:6px; margin-bottom:14px; font-size:13px; color:#334155; }
    label { display:flex; flex-direction:column; gap:4px; font-size:13px; color:#334155; margin-bottom:10px; }
    .req { color:#dc2626; }
    .form-actions { display:flex; gap:8px; justify-content:flex-end; margin-top:14px; }
    .primary { background:#2563eb; color:#fff; border:none; padding:8px 16px; border-radius:4px; cursor:pointer; font-weight:600; }
    .primary:hover { background:#1d4ed8; }
    .form-actions button[type=button] { padding:8px 14px; border:1px solid #cbd5e1; border-radius:4px; background:#fff; cursor:pointer; }
    .error { color:#dc2626; font-size:13px; margin-top:8px; }
    .empty-text { padding:24px 16px; color:#64748b; text-align:center; }
  `]
})
export class WorkSessionsComponent implements OnInit {
  sessions = signal<any[]>([]);
  summary = signal<any[]>([]);
  viewMode = signal<'list' | 'summary'>('list');
  showEditModal = signal(false);
  editingSession = signal<any | null>(null);
  editError = signal('');
  page = signal(1);
  pageSize = 20;

  fromDate = '';
  toDate = '';
  userKeyword = '';
  summaryMonth = this.currentYearMonth();

  editForm: any = { loginTime: '', logoutTime: '', notes: '' };

  constructor(private wsService: WorkSessionService, private auth: AuthService) {}

  ngOnInit() {
    this.setDefaultDateRange();
    this.reload();
  }

  isAdmin(): boolean {
    return this.auth.hasRole(['DIRECTOR', 'ACCOUNTING', 'OPS']);
  }

  canEdit(): boolean {
    return this.auth.hasRole(['DIRECTOR', 'ACCOUNTING', 'OPS']);
  }

  statusLabel(s: string) { return STATUS_LABELS[s] || s; }
  statusColor(s: string) { return STATUS_COLORS[s] || '#64748b'; }

  formatMinutes(mins: number | null | undefined): string {
    if (!mins || mins <= 0) return '—';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h}g${m.toString().padStart(2, '0')}p` : `${m}p`;
  }

  currentYearMonth(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  setDefaultDateRange() {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const first = new Date(y, m, 1);
    const last = new Date(y, m + 1, 0);
    this.fromDate = first.toISOString().split('T')[0];
    this.toDate = last.toISOString().split('T')[0];
  }

  async reload() {
    const params: Record<string, string> = {};
    if (this.fromDate) params['fromDate'] = this.fromDate;
    if (this.toDate) params['toDate'] = this.toDate;

    try {
      if (this.isAdmin()) {
        const res = await this.wsService.list(params);
        const data = Array.isArray(res) ? res : (res?.data ?? []);
        this.sessions.set(data);
      } else {
        const res = await this.wsService.getMy(params);
        const data = Array.isArray(res) ? res : (res?.data ?? []);
        this.sessions.set(data);
      }
      this.page.set(1);
    } catch (err) {
      console.error('Error loading work sessions', err);
    }
  }

  async loadSummary() {
    if (!this.summaryMonth) return;
    const [year, month] = this.summaryMonth.split('-').map(Number);
    const start = new Date(year, month - 1, 1).toISOString().split('T')[0];
    const end = new Date(year, month, 0).toISOString().split('T')[0];
    try {
      const res = await this.wsService.getSummary(start, end);
      this.summary.set(Array.isArray(res) ? res : (res?.data ?? []));
    } catch (err) {
      console.error('Error loading summary', err);
    }
  }

  applyFilter() {
    this.page.set(1);
  }

  resetFilters() {
    this.userKeyword = '';
    this.setDefaultDateRange();
    this.reload();
  }

  toggleView() {
    if (this.viewMode() === 'list') {
      this.viewMode.set('summary');
      this.loadSummary();
    } else {
      this.viewMode.set('list');
    }
  }

  filtered = computed(() => {
    let list = this.sessions();
    const kw = this.userKeyword.trim().toLowerCase();
    if (kw) {
      list = list.filter(s =>
        (s.userId?.fullName || '').toLowerCase().includes(kw)
      );
    }
    return list;
  });

  totalPages = computed(() => Math.max(1, Math.ceil(this.filtered().length / this.pageSize)));

  paginated = computed(() => {
    const start = (this.page() - 1) * this.pageSize;
    return this.filtered().slice(start, start + this.pageSize);
  });

  totalSessions = computed(() => this.sessions().length);
  activeSessions = computed(() => this.sessions().filter(s => s.status === 'ACTIVE').length);
  lateSessions = computed(() => this.sessions().filter(s => s.isLate).length);
  totalHours = computed(() => {
    const total = this.sessions().reduce((acc, s) => acc + (s.totalMinutes || 0), 0);
    return this.formatMinutes(total);
  });

  setPage(p: number) {
    this.page.set(p);
  }

  openEdit(s: any) {
    this.editingSession.set(s);
    this.editForm = {
      loginTime: s.loginTime ? this.toDatetimeLocal(s.loginTime) : '',
      logoutTime: s.logoutTime ? this.toDatetimeLocal(s.logoutTime) : '',
      notes: s.notes || '',
    };
    this.editError.set('');
    this.showEditModal.set(true);
  }

  closeEditModal() {
    this.showEditModal.set(false);
    this.editingSession.set(null);
  }

  async submitEdit() {
    const session = this.editingSession();
    if (!session) return;

    const payload: any = { notes: this.editForm.notes };
    if (this.editForm.loginTime) payload.loginTime = new Date(this.editForm.loginTime).toISOString();
    if (this.editForm.logoutTime) payload.logoutTime = new Date(this.editForm.logoutTime).toISOString();

    const res = await this.wsService.update(session._id, payload);
    if (!res.ok) {
      this.editError.set(res.message || 'Cập nhật thất bại');
      return;
    }
    this.closeEditModal();
    this.reload();
  }

  private toDatetimeLocal(iso: string): string {
    if (!iso) return '';
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
}
