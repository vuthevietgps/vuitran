import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../services/auth.service';
import {
  WorkSessionItem,
  WorkSessionListSummary,
  WorkSessionService,
  WorkSessionStatus,
} from '../services/work-session.service';
import { FlowGuideComponent } from './shared/flow-guide.component';

type ViewMode = 'list' | 'summary';

type MonthlySummaryRow = {
  userId: string;
  fullName: string;
  email?: string;
  role?: string;
  totalMinutes: number;
  totalHours: number;
  totalSessions: number;
  lateDays: number;
  totalLateMinutes: number;
  earlyLeaveDays: number;
  totalEarlyLeaveMinutes: number;
};

const STATUS_LABELS: Record<WorkSessionStatus, string> = {
  ACTIVE: 'Dang online',
  COMPLETED: 'Hoan thanh',
  AUTO_CLOSED: 'Tu dong dong',
};

const STATUS_COLORS: Record<WorkSessionStatus, string> = {
  ACTIVE: '#0f766e',
  COMPLETED: '#2563eb',
  AUTO_CLOSED: '#b45309',
};

const EMPTY_SUMMARY: WorkSessionListSummary = {
  totalSessions: 0,
  activeSessions: 0,
  totalMinutes: 0,
  lateSessions: 0,
};

@Component({
  selector: 'app-work-sessions',
  standalone: true,
  imports: [CommonModule, FormsModule, FlowGuideComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="page-header">
      <div>
        <h2>Cham cong nhan vien</h2>
        <p>Theo doi gio lam viec va lich su check-in/check-out o quy mo lon.</p>
      </div>
      <button class="toggle-btn" type="button" (click)="toggleView()">
        {{ viewMode() === 'list' ? 'Xem tong hop thang' : 'Xem danh sach' }}
      </button>
    </header>

    <app-flow-guide featureKey="work-sessions"></app-flow-guide>

    <ng-container *ngIf="viewMode() === 'list'; else summaryView">
      <section class="stats">
        <div class="stat-card total">
          <div class="stat-value">{{ listSummary().totalSessions }}</div>
          <div class="stat-label">Tong phien</div>
        </div>
        <div class="stat-card active">
          <div class="stat-value">{{ listSummary().activeSessions }}</div>
          <div class="stat-label">Dang online</div>
        </div>
        <div class="stat-card hours">
          <div class="stat-value">{{ totalHoursText() }}</div>
          <div class="stat-label">Tong gio lam</div>
        </div>
        <div class="stat-card late">
          <div class="stat-value">{{ listSummary().lateSessions }}</div>
          <div class="stat-label">So lan muon</div>
        </div>
      </section>

      <section class="filters">
        <label>
          Tu ngay
          <input type="date" [(ngModel)]="fromDate" />
        </label>
        <label>
          Den ngay
          <input type="date" [(ngModel)]="toDate" />
        </label>
        <label>
          Trang thai
          <select [(ngModel)]="selectedStatus">
            <option value="">Tat ca</option>
            <option value="ACTIVE">Dang online</option>
            <option value="COMPLETED">Hoan thanh</option>
            <option value="AUTO_CLOSED">Tu dong dong</option>
          </select>
        </label>
        <label *ngIf="isAdmin()" class="search-field">
          Nhan vien
          <input
            type="text"
            placeholder="Ten, email hoac so dien thoai"
            [(ngModel)]="userKeyword"
            (keyup.enter)="applyFilters()"
          />
        </label>
        <div class="filter-actions">
          <button class="primary" type="button" (click)="applyFilters()" [disabled]="loading()">
            Tim kiem
          </button>
          <button type="button" (click)="reload()" [disabled]="loading()">Lam moi</button>
          <button
            class="ghost"
            type="button"
            *ngIf="hasActiveFilters()"
            (click)="clearFilters()"
            [disabled]="loading()"
          >
            Xoa loc
          </button>
        </div>
      </section>

      <p class="table-meta">
        Hien thi <strong>{{ items().length }}</strong> / {{ totalItems() }} phien cham cong
      </p>

      <div class="table-shell" *ngIf="items().length; else emptyList">
        <table class="data">
          <thead>
            <tr>
              <th *ngIf="isAdmin()">Nhan vien</th>
              <th>Ngay</th>
              <th>Gio vao</th>
              <th>Gio ra</th>
              <th class="center">Tong gio</th>
              <th>Trang thai</th>
              <th class="center">Muon / ve som</th>
              <th *ngIf="canEdit()"></th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let session of items(); trackBy: trackSessionById">
              <td *ngIf="isAdmin()">
                <div class="user-name">{{ session.userId?.fullName || '-' }}</div>
                <div class="user-meta">{{ session.userId?.email || '' }}</div>
              </td>
              <td>{{ session.date | date: 'dd/MM/yyyy' }}</td>
              <td>{{ session.loginTime | date: 'HH:mm' }}</td>
              <td>{{ session.logoutTime ? (session.logoutTime | date: 'HH:mm') : '-' }}</td>
              <td class="center">{{ formatMinutes(session.totalMinutes) }}</td>
              <td>
                <span
                  class="badge"
                  [style.backgroundColor]="statusTint(session.status)"
                  [style.color]="statusColor(session.status)"
                >
                  {{ statusLabel(session.status) }}
                </span>
              </td>
              <td class="center timing-cell">
                <div class="timing-flags">
                  <span *ngIf="session.isLate" class="badge danger-badge">
                    +{{ session.lateMinutes || 0 }}p
                  </span>
                  <span *ngIf="session.isEarlyLeave" class="badge warning-badge">
                    Ve som {{ session.earlyLeaveMinutes || 0 }}p
                  </span>
                  <span *ngIf="!hasTimingViolation(session)" class="muted">-</span>
                </div>
                <div *ngIf="scheduleHint(session)" class="schedule-hint">
                  {{ scheduleHint(session) }}
                </div>
              </td>
              <td *ngIf="canEdit()" class="actions-cell">
                <button class="btn-sm primary" type="button" (click)="openEdit(session)">
                  Sua
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <ng-template #emptyList>
        <p class="empty-text" *ngIf="!loading(); else loadingList">
          Khong co du lieu cham cong phu hop voi bo loc.
        </p>
      </ng-template>
      <ng-template #loadingList>
        <p class="empty-text">Dang tai du lieu cham cong...</p>
      </ng-template>

      <div class="table-footer">
        <label class="page-size-control">
          So dong moi trang
          <select [ngModel]="pageSize()" (ngModelChange)="onPageSizeChange($event)" [disabled]="loading()">
            <option *ngFor="let size of pageSizeOptions" [ngValue]="size">{{ size }}</option>
          </select>
        </label>
        <div class="pager">
          <span>
            Trang {{ currentPage() }} / {{ totalPages() }}
            ({{ totalItems() ? ((currentPage() - 1) * pageSize() + 1) : 0 }}-{{ totalItems() ? (((currentPage() - 1) * pageSize()) + items().length) : 0 }} / {{ totalItems() }})
          </span>
          <button type="button" (click)="goToPage(currentPage() - 1)" [disabled]="loading() || currentPage() === 1">
            Truoc
          </button>
          <button
            type="button"
            (click)="goToPage(currentPage() + 1)"
            [disabled]="loading() || currentPage() === totalPages()"
          >
            Sau
          </button>
        </div>
      </div>
    </ng-container>

    <ng-template #summaryView>
      <section class="summary-toolbar">
        <label>
          Thang
          <input type="month" [(ngModel)]="summaryMonth" (ngModelChange)="loadSummary()" />
        </label>
      </section>

      <div class="table-shell" *ngIf="monthlySummary().length; else emptySummary">
        <table class="data">
          <thead>
            <tr>
              <th>Nhan vien</th>
              <th class="center">Tong phien</th>
              <th class="center">Tong gio</th>
              <th class="center">So lan muon</th>
              <th class="center">Phut muon tich luy</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let row of monthlySummary(); trackBy: trackSummaryByUser">
              <td>
                <div class="user-name">{{ row.fullName }}</div>
                <div class="user-meta">{{ row.email || '' }}</div>
              </td>
              <td class="center">{{ row.totalSessions }}</td>
              <td class="center">{{ formatMinutes(row.totalMinutes) }}</td>
              <td class="center">{{ row.lateDays }}</td>
              <td class="center">
                <span *ngIf="row.totalLateMinutes > 0" class="late-text">
                  {{ row.totalLateMinutes }}p
                </span>
                <span *ngIf="!row.totalLateMinutes" class="muted">-</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <ng-template #emptySummary>
        <p class="empty-text" *ngIf="!summaryLoading(); else loadingSummary">
          Khong co du lieu tong hop.
        </p>
      </ng-template>
      <ng-template #loadingSummary>
        <p class="empty-text">Dang tai tong hop thang...</p>
      </ng-template>
    </ng-template>

    <div class="modal-backdrop" *ngIf="showEditModal()">
      <div class="modal">
        <h3>Chinh sua phien lam viec</h3>
        <p class="session-meta" *ngIf="editingSession()">
          {{ editingSession()?.userId?.fullName || 'Nhan vien' }} -
          {{ editingSession()?.date | date: 'dd/MM/yyyy' }}
        </p>
        <label>
          Gio vao
          <input type="datetime-local" [(ngModel)]="editForm.loginTime" />
        </label>
        <label>
          Gio ra
          <input type="datetime-local" [(ngModel)]="editForm.logoutTime" />
        </label>
        <label>
          Ghi chu
          <textarea rows="3" [(ngModel)]="editForm.notes"></textarea>
        </label>
        <div class="form-actions">
          <button class="primary" type="button" (click)="submitEdit()">Cap nhat</button>
          <button type="button" (click)="closeEditModal()">Huy</button>
        </div>
        <p class="error" *ngIf="editError()">{{ editError() }}</p>
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .page-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 16px;
        padding: 16px;
      }
      .page-header h2 {
        margin: 0 0 4px;
        color: #0f172a;
        font-size: 22px;
      }
      .page-header p {
        margin: 0;
        color: #64748b;
        font-size: 13px;
      }
      .toggle-btn,
      .filter-actions button,
      .pager button,
      .form-actions button,
      .btn-sm {
        border-radius: 6px;
        cursor: pointer;
        font-size: 13px;
      }
      .toggle-btn {
        border: 1px solid #cbd5e1;
        background: #f8fafc;
        color: #334155;
        padding: 8px 14px;
        font-weight: 600;
      }
      .toggle-btn:hover {
        background: #e2e8f0;
      }
      .stats {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
        gap: 12px;
        padding: 0 16px 16px;
      }
      .stat-card {
        border-radius: 12px;
        padding: 16px 18px;
        background: #fff;
        border: 1px solid #e2e8f0;
      }
      .stat-card.total {
        background: #eff6ff;
      }
      .stat-card.active {
        background: #ecfdf5;
      }
      .stat-card.hours {
        background: #f8fafc;
      }
      .stat-card.late {
        background: #fff7ed;
      }
      .stat-value {
        font-size: 24px;
        font-weight: 700;
        color: #0f172a;
      }
      .stat-label {
        margin-top: 4px;
        font-size: 12px;
        color: #64748b;
      }
      .filters,
      .summary-toolbar {
        display: flex;
        flex-wrap: wrap;
        align-items: end;
        gap: 12px;
        padding: 0 16px 12px;
      }
      .filters label,
      .summary-toolbar label {
        display: flex;
        flex-direction: column;
        gap: 6px;
        color: #334155;
        font-size: 13px;
      }
      .search-field {
        min-width: 260px;
        flex: 1 1 260px;
      }
      input,
      select,
      textarea {
        border: 1px solid #cbd5e1;
        border-radius: 6px;
        padding: 8px 10px;
        font-size: 13px;
        color: #0f172a;
        background: #fff;
      }
      textarea {
        resize: vertical;
      }
      .filter-actions {
        display: flex;
        gap: 8px;
        align-items: center;
      }
      .primary {
        border: 1px solid #2563eb;
        background: #2563eb;
        color: #fff;
        padding: 8px 14px;
        font-weight: 600;
      }
      .primary:hover {
        background: #1d4ed8;
      }
      .ghost,
      .filter-actions button:not(.primary),
      .pager button,
      .form-actions button[type='button'],
      .btn-sm {
        border: 1px solid #cbd5e1;
        background: #fff;
        color: #0f172a;
        padding: 8px 12px;
      }
      .table-meta {
        margin: 0;
        padding: 0 16px 12px;
        color: #475569;
        font-size: 13px;
      }
      .table-shell {
        margin: 0 16px;
        max-height: calc(100vh - 360px);
        overflow: auto;
        border: 1px solid #e2e8f0;
        border-radius: 10px 10px 0 0;
        background: #fff;
      }
      .data {
        width: 100%;
        border-collapse: separate;
        border-spacing: 0;
        font-size: 13px;
      }
      .data thead th {
        position: sticky;
        top: 0;
        z-index: 2;
        background: #f8fafc;
        color: #475569;
        text-transform: uppercase;
        letter-spacing: 0.03em;
        font-size: 12px;
      }
      .data th,
      .data td {
        padding: 10px 12px;
        border-bottom: 1px solid #e2e8f0;
        vertical-align: top;
      }
      .data tbody tr:hover {
        background: #f8fafc;
      }
      .center {
        text-align: center;
      }
      .user-name {
        font-weight: 600;
        color: #0f172a;
      }
      .user-meta,
      .schedule-hint,
      .muted {
        color: #64748b;
        font-size: 12px;
      }
      .badge {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 3px 8px;
        border-radius: 999px;
        font-size: 11px;
        font-weight: 700;
        white-space: nowrap;
      }
      .danger-badge {
        background: #fee2e2;
        color: #b91c1c;
      }
      .warning-badge {
        background: #ffedd5;
        color: #c2410c;
      }
      .timing-cell {
        min-width: 170px;
      }
      .timing-flags {
        display: flex;
        justify-content: center;
        flex-wrap: wrap;
        gap: 6px;
      }
      .late-text {
        color: #b91c1c;
        font-weight: 700;
      }
      .actions-cell {
        white-space: nowrap;
      }
      .btn-sm {
        padding: 6px 10px;
      }
      .btn-sm.primary {
        color: #2563eb;
        border-color: #93c5fd;
        background: #eff6ff;
      }
      .table-footer {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
        margin: 0 16px 16px;
        padding: 10px 12px;
        border: 1px solid #e2e8f0;
        border-top: none;
        border-radius: 0 0 10px 10px;
        background: #fff;
        flex-wrap: wrap;
      }
      .page-size-control,
      .pager {
        display: flex;
        align-items: center;
        gap: 8px;
        color: #334155;
        font-size: 13px;
      }
      .page-size-control select {
        min-width: 88px;
      }
      .pager button:disabled,
      .filter-actions button:disabled {
        opacity: 0.55;
        cursor: not-allowed;
      }
      .empty-text {
        margin: 0;
        padding: 24px 16px;
        color: #64748b;
        text-align: center;
      }
      .modal-backdrop {
        position: fixed;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(15, 23, 42, 0.55);
        z-index: 100;
      }
      .modal {
        width: min(480px, calc(100vw - 24px));
        max-height: 90vh;
        overflow: auto;
        border-radius: 12px;
        background: #fff;
        padding: 20px;
        box-shadow: 0 24px 60px rgba(15, 23, 42, 0.28);
      }
      .modal h3 {
        margin: 0 0 12px;
        color: #0f172a;
      }
      .session-meta {
        margin: 0 0 16px;
        color: #475569;
        font-size: 13px;
      }
      .modal label {
        display: flex;
        flex-direction: column;
        gap: 6px;
        margin-bottom: 12px;
        color: #334155;
        font-size: 13px;
      }
      .form-actions {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
      }
      .error {
        margin: 10px 0 0;
        color: #b91c1c;
        font-size: 13px;
      }
      @media (max-width: 900px) {
        .page-header {
          flex-direction: column;
          align-items: flex-start;
        }
        .table-shell {
          max-height: calc(100vh - 420px);
        }
        .table-footer {
          align-items: flex-start;
        }
        .pager {
          width: 100%;
          justify-content: space-between;
        }
      }
    `,
  ],
})
export class WorkSessionsComponent implements OnInit {
  readonly items = signal<WorkSessionItem[]>([]);
  readonly monthlySummary = signal<MonthlySummaryRow[]>([]);
  readonly listSummary = signal<WorkSessionListSummary>(EMPTY_SUMMARY);
  readonly loading = signal(false);
  readonly summaryLoading = signal(false);
  readonly showEditModal = signal(false);
  readonly editingSession = signal<WorkSessionItem | null>(null);
  readonly editError = signal('');
  readonly viewMode = signal<ViewMode>('list');
  readonly currentPage = signal(1);
  readonly totalPages = signal(1);
  readonly totalItems = signal(0);
  readonly pageSize = signal(25);
  readonly pageSizeOptions = [25, 50, 100];
  readonly totalHoursText = computed(() =>
    this.formatMinutes(this.listSummary().totalMinutes),
  );

  fromDate = '';
  toDate = '';
  userKeyword = '';
  selectedStatus = '';
  summaryMonth = this.currentYearMonth();

  private defaultFromDate = '';
  private defaultToDate = '';

  editForm: { loginTime: string; logoutTime: string; notes: string } = {
    loginTime: '',
    logoutTime: '',
    notes: '',
  };

  constructor(
    private readonly wsService: WorkSessionService,
    private readonly auth: AuthService,
  ) {}

  ngOnInit(): void {
    this.setDefaultDateRange();
    void this.reload();
  }

  isAdmin(): boolean {
    return this.auth.hasRole(['DIRECTOR', 'ACCOUNTING', 'OPS']);
  }

  canEdit(): boolean {
    return this.auth.hasRole(['DIRECTOR', 'OPS']);
  }

  statusLabel(status: WorkSessionStatus): string {
    return STATUS_LABELS[status] ?? status;
  }

  statusColor(status: WorkSessionStatus): string {
    return STATUS_COLORS[status] ?? '#64748b';
  }

  statusTint(status: WorkSessionStatus): string {
    const color = this.statusColor(status);
    return `${color}22`;
  }

  formatMinutes(minutes: number | null | undefined): string {
    if (!minutes || minutes <= 0) {
      return '-';
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}g${String(mins).padStart(2, '0')}p` : `${mins}p`;
  }

  async reload(): Promise<void> {
    this.loading.set(true);
    try {
      const query = {
        fromDate: this.fromDate || undefined,
        toDate: this.toDate || undefined,
        status: (this.selectedStatus || undefined) as WorkSessionStatus | undefined,
        search:
          this.isAdmin() && this.userKeyword.trim()
            ? this.userKeyword.trim()
            : undefined,
        page: this.currentPage(),
        limit: this.pageSize(),
      };
      const response = this.isAdmin()
        ? await this.wsService.list(query)
        : await this.wsService.getMy(query);

      this.items.set(response.data ?? []);
      this.listSummary.set(response.summary ?? EMPTY_SUMMARY);
      this.totalItems.set(response.meta?.total ?? 0);
      this.totalPages.set(response.meta?.totalPages ?? 1);
      this.currentPage.set(response.meta?.page ?? 1);
    } catch (error) {
      console.error('Error loading work sessions', error);
      this.items.set([]);
      this.listSummary.set(EMPTY_SUMMARY);
      this.totalItems.set(0);
      this.totalPages.set(1);
    } finally {
      this.loading.set(false);
    }
  }

  async applyFilters(): Promise<void> {
    this.currentPage.set(1);
    await this.reload();
  }

  async clearFilters(): Promise<void> {
    this.userKeyword = '';
    this.selectedStatus = '';
    this.fromDate = this.defaultFromDate;
    this.toDate = this.defaultToDate;
    this.currentPage.set(1);
    await this.reload();
  }

  hasActiveFilters(): boolean {
    return (
      !!this.userKeyword.trim() ||
      !!this.selectedStatus ||
      this.fromDate !== this.defaultFromDate ||
      this.toDate !== this.defaultToDate
    );
  }

  async goToPage(page: number): Promise<void> {
    const nextPage = Math.min(Math.max(page, 1), this.totalPages());
    if (nextPage === this.currentPage()) {
      return;
    }
    this.currentPage.set(nextPage);
    await this.reload();
  }

  async onPageSizeChange(pageSize: number): Promise<void> {
    this.pageSize.set(Number(pageSize) || 25);
    this.currentPage.set(1);
    await this.reload();
  }

  toggleView(): void {
    if (this.viewMode() === 'list') {
      this.viewMode.set('summary');
      void this.loadSummary();
      return;
    }
    this.viewMode.set('list');
  }

  async loadSummary(): Promise<void> {
    if (!this.summaryMonth) {
      return;
    }
    const [year, month] = this.summaryMonth.split('-').map(Number);
    if (!year || !month) {
      return;
    }

    const start = this.toLocalDateString(new Date(year, month - 1, 1));
    const end = this.toLocalDateString(new Date(year, month, 0));

    this.summaryLoading.set(true);
    try {
      const response = await this.wsService.getSummary(start, end);
      this.monthlySummary.set(Array.isArray(response) ? response : []);
    } catch (error) {
      console.error('Error loading work session summary', error);
      this.monthlySummary.set([]);
    } finally {
      this.summaryLoading.set(false);
    }
  }

  hasTimingViolation(session: WorkSessionItem): boolean {
    return !!(session.isLate || session.isEarlyLeave);
  }

  scheduleHint(session: WorkSessionItem): string {
    const start = session.scheduledStartTime;
    const end = session.scheduledEndTime;
    if (!start && !end) {
      return '';
    }
    if (start && end) {
      return `Ca ${start}-${end}`;
    }
    return `Ca ${start || end}`;
  }

  openEdit(session: WorkSessionItem): void {
    this.editingSession.set(session);
    this.editForm = {
      loginTime: session.loginTime ? this.toDatetimeLocal(session.loginTime) : '',
      logoutTime: session.logoutTime
        ? this.toDatetimeLocal(session.logoutTime)
        : '',
      notes: session.notes || '',
    };
    this.editError.set('');
    this.showEditModal.set(true);
  }

  closeEditModal(): void {
    this.showEditModal.set(false);
    this.editingSession.set(null);
    this.editError.set('');
  }

  async submitEdit(): Promise<void> {
    const session = this.editingSession();
    if (!session) {
      return;
    }

    const payload: Record<string, string> = {
      notes: this.editForm.notes,
    };
    if (this.editForm.loginTime) {
      payload['loginTime'] = new Date(this.editForm.loginTime).toISOString();
    }
    if (this.editForm.logoutTime) {
      payload['logoutTime'] = new Date(this.editForm.logoutTime).toISOString();
    }

    const response = await this.wsService.update(session._id, payload);
    if (!response.ok) {
      this.editError.set(response.message || 'Cap nhat that bai');
      return;
    }

    this.closeEditModal();
    await this.reload();
  }

  trackSessionById(_index: number, session: WorkSessionItem): string {
    return session._id;
  }

  trackSummaryByUser(_index: number, row: MonthlySummaryRow): string {
    return row.userId;
  }

  private currentYearMonth(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  private setDefaultDateRange(): void {
    const now = new Date();
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    this.defaultFromDate = this.toLocalDateString(first);
    this.defaultToDate = this.toLocalDateString(last);
    this.fromDate = this.defaultFromDate;
    this.toDate = this.defaultToDate;
  }

  private toDatetimeLocal(value: string): string {
    const date = new Date(value);
    const pad = (part: number) => String(part).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  private toLocalDateString(date: Date): string {
    const pad = (value: number) => String(value).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }
}
