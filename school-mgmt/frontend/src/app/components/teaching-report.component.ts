import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';
import { PayrollItem, PayrollPreview, PayrollService } from '../services/payroll.service';
import { SessionService, SessionItem } from '../services/session.service';
import { UserItem, UserService } from '../services/user.service';
import { ReportTemplateService, ReportTemplate } from '../services/report-template.service';
import { FlowGuideComponent } from './shared/flow-guide.component';
import {
  TeachingReportPendingComponent,
  PendingMeta,
} from './shared/teaching-report-pending.component';
import { TeachingReportCompletedComponent } from './shared/teaching-report-completed.component';
import {
  ReportFormValues,
  teachingReportDraftStorageKey,
} from './shared/teaching-report-form.component';

@Component({
  selector: 'app-teaching-report',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    FlowGuideComponent,
    TeachingReportPendingComponent,
    TeachingReportCompletedComponent,
  ],
  template: `
  <app-flow-guide featureKey="teaching-report"></app-flow-guide>
  <div class="page">
    <div class="header">
      <h2>Báo cáo giảng dạy</h2>
      <p class="subtitle">Điền nhận xét cho từng buổi học — chỉ buổi có báo cáo mới được tính lương</p>
    </div>

    <!-- Tab filter -->
    <div class="tabs">
      <button [class.active]="activeTab === 'pending'" (click)="activeTab = 'pending'; loadPending()">
        Chưa có báo cáo
        <span class="tab-count" *ngIf="pendingCount() > 0">{{ pendingCount() }}</span>
      </button>
      <button [class.active]="activeTab === 'completed'" (click)="activeTab = 'completed'; loadCompleted()">
        Đã có báo cáo
      </button>
    </div>

    <section class="filter-panel">
      <div class="filter-row">
        <div class="filter-group">
          <label>Tháng</label>
          <input type="month" [(ngModel)]="selectedMonth" (change)="onMonthChange()" />
        </div>
        <div class="filter-group">
          <label>Từ ngày</label>
          <input type="date" [(ngModel)]="fromDate" />
        </div>
        <div class="filter-group">
          <label>Đến ngày</label>
          <input type="date" [(ngModel)]="toDate" />
        </div>
        <div class="filter-group" *ngIf="!isTeacher()">
          <label>Mã giáo viên</label>
          <input
            type="text"
            [(ngModel)]="teacherCodeSearch"
            (ngModelChange)="onTeacherCodeInput($event)"
            list="teacher-code-options"
            placeholder="VD: GV001"
          />
          <small class="teacher-hint" *ngIf="matchedTeacherByCode()">
            {{ matchedTeacherByCode()!.fullName }}
          </small>
          <datalist id="teacher-code-options">
            <option *ngFor="let teacher of teachers()" [value]="teacher.userCode || ''">
              {{ teacher.fullName }}
            </option>
          </datalist>
        </div>
        <button class="btn-filter" type="button" (click)="applyFilters()" [disabled]="loading()">Lọc báo cáo</button>
        <button class="btn-ghost" type="button" (click)="resetToCurrentMonth()" [disabled]="loading()">Tháng này</button>
      </div>

      <div class="salary-summary" *ngIf="payrollPreview()">
        <article class="summary-card">
          <strong>{{ payrollPreview()!.summary.totalAttended }}</strong>
          <span>Buổi đã dạy trong kỳ</span>
        </article>
        <article class="summary-card">
          <strong>{{ payrollPreview()!.summary.eligibleForPayroll }}</strong>
          <span>Buổi đủ điều kiện lương</span>
        </article>
        <article class="summary-card emphasis">
          <strong>{{ formatCurrency(payrollPreview()!.amounts.totalAttendedPayout) }}</strong>
          <span>Tổng lương dự kiến buổi dạy</span>
        </article>
        <article class="summary-card emphasis success">
          <strong>{{ formatCurrency(getPaidPayrollTotal()) }}</strong>
          <span>Đã nhận lương trong kỳ</span>
        </article>
      </div>

      <ng-container *ngIf="payrollPreview()">
        <div class="accounting-note" *ngIf="accountingNotes().length; else emptyAccountingNote">
          <h3>Note kế toán</h3>
          <div class="note-item" *ngFor="let payroll of accountingNotes()">
            <div class="note-meta">
              <strong>{{ payroll.payrollCode }}</strong>
              <span>{{ payroll.periodStart | date:'dd/MM/yyyy' }} - {{ payroll.periodEnd | date:'dd/MM/yyyy' }}</span>
              <span class="note-status">{{ payrollStatusLabel(payroll.status) }}</span>
            </div>
            <p>{{ payroll.notes }}</p>
          </div>
        </div>
        <ng-template #emptyAccountingNote>
          <div class="accounting-note empty-note">
            <h3>Note kế toán</h3>
            <p>Chưa có ghi chú kế toán trong kỳ đang lọc.</p>
          </div>
        </ng-template>
      </ng-container>
    </section>

    <div *ngIf="loading()" class="loading">Đang tải...</div>
    <div *ngIf="error()" class="alert alert-error">❌ {{ error() }}</div>
    <div *ngIf="success()" class="alert alert-success">{{ success() }}</div>

    <!-- ═══ PENDING REPORT ═══ -->
    <div *ngIf="activeTab === 'pending' && !loading()">
      <app-teaching-report-pending
        [sessions]="pendingSessions()"
        [templates]="templates()"
        [submitting]="submitting()"
        [canEdit]="canEditReports()"
        [teacherView]="isTeacher()"
        [meta]="pendingMeta()"
        (submitReport)="handleSubmit($event)"
        (pageChange)="onPendingPageChange($event)">
      </app-teaching-report-pending>
    </div>

    <!-- ═══ COMPLETED REPORT ═══ -->
    <div *ngIf="activeTab === 'completed' && !loading()">
      <app-teaching-report-completed
        [sessions]="completedSessions()"
        [templates]="templates()"
        [submitting]="submitting()"
        [canEdit]="canEditReports()"
        [teacherView]="isTeacher()"
        [meta]="completedMeta()"
        (submitReport)="handleSubmit($event)"
        (pageChange)="onCompletedPageChange($event)">
      </app-teaching-report-completed>
    </div>
  </div>
  `,
  styles: [`
    .page { padding: 24px; max-width: 1100px; margin: 0 auto; }
    .header h2 { margin: 0 0 4px; color: #1e293b; font-size: 20px; }
    .subtitle { margin: 0 0 16px; color: #64748b; font-size: 14px; }
    .tabs { display: flex; gap: 4px; margin-bottom: 20px; border-bottom: 2px solid #e2e8f0; }
    .tabs button {
      padding: 10px 20px; border: none; background: transparent; cursor: pointer;
      font-size: 14px; font-weight: 600; color: #64748b; border-bottom: 3px solid transparent;
      transition: all 0.2s; position: relative;
    }
    .tabs button:hover { color: #1e293b; }
    .tabs button.active { color: #2563eb; border-bottom-color: #2563eb; }
    .tab-count {
      display: inline-flex; align-items: center; justify-content: center;
      min-width: 20px; height: 20px; padding: 0 6px; border-radius: 99px;
      background: #ef4444; color: #fff; font-size: 11px; font-weight: 700;
      margin-left: 6px; line-height: 1;
    }
    .filter-panel {
      margin-bottom: 16px; padding: 16px; border: 1px solid #e2e8f0;
      border-radius: 10px; background: #f8fafc;
    }
    .filter-row {
      display: flex; align-items: flex-end; gap: 12px; flex-wrap: wrap;
      margin-bottom: 14px;
    }
    .filter-group { display: flex; flex-direction: column; gap: 4px; }
    .filter-group label { font-size: 12px; font-weight: 600; color: #64748b; }
    .filter-group input {
      min-width: 150px; padding: 8px 10px; border: 1px solid #cbd5e1;
      border-radius: 6px; font-size: 13px; background: #fff;
    }
    .teacher-hint { color: #475569; font-size: 11px; }
    .btn-filter, .btn-ghost {
      height: 38px; padding: 0 16px; border-radius: 6px;
      font-size: 13px; font-weight: 600; cursor: pointer;
    }
    .btn-filter {
      border: none; background: #2563eb; color: #fff;
    }
    .btn-filter:disabled, .btn-ghost:disabled { cursor: not-allowed; opacity: 0.7; }
    .btn-ghost {
      border: 1px solid #cbd5e1; background: #fff; color: #475569;
    }
    .salary-summary {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 10px; margin-bottom: 14px;
    }
    .summary-card {
      display: flex; flex-direction: column; gap: 4px; padding: 14px;
      border-radius: 10px; background: #fff; border: 1px solid #e2e8f0;
    }
    .summary-card strong { color: #0f172a; font-size: 20px; }
    .summary-card span { color: #64748b; font-size: 12px; font-weight: 600; }
    .summary-card.emphasis { background: #eff6ff; border-color: #bfdbfe; }
    .summary-card.emphasis strong { color: #1d4ed8; }
    .summary-card.success { background: #ecfdf5; border-color: #bbf7d0; }
    .summary-card.success strong { color: #15803d; }
    .accounting-note {
      padding: 14px; border-radius: 10px; background: #fff;
      border: 1px solid #e2e8f0;
    }
    .accounting-note h3 {
      margin: 0 0 10px; color: #1e293b; font-size: 15px;
    }
    .note-item {
      padding-top: 10px; margin-top: 10px; border-top: 1px solid #e2e8f0;
    }
    .note-item:first-of-type {
      padding-top: 0; margin-top: 0; border-top: none;
    }
    .note-meta {
      display: flex; gap: 10px; flex-wrap: wrap; align-items: center;
      margin-bottom: 6px; font-size: 12px; color: #64748b;
    }
    .note-meta strong { color: #0f172a; }
    .note-status {
      display: inline-flex; align-items: center; padding: 3px 8px;
      border-radius: 999px; background: #e2e8f0; color: #475569;
      font-weight: 700; font-size: 11px;
    }
    .accounting-note p {
      margin: 0; color: #334155; font-size: 13px; line-height: 1.5;
    }
    .empty-note p { color: #64748b; }
    .loading { text-align: center; padding: 40px; color: #64748b; }
    
    /* Alert styles */
    .alert { padding: 12px 16px; border-radius: 8px; margin-bottom: 16px; font-size: 14px; font-weight: 500; }
    .alert-error { background: #fef2f2; color: #dc2626; border: 1px solid #fca5a5; }
    .alert-success { background: #f0fdf4; color: #16a34a; border: 1px solid #86efac; }
    
    .empty { text-align: center; padding: 40px; color: #94a3b8; font-size: 15px; }

    .session-card {
      background: #fff; border-radius: 10px; margin-bottom: 10px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.06); border-left: 4px solid #f97316;
      overflow: hidden;
    }
    .session-card.completed { border-left-color: #22c55e; }
    .session-card.editing { border-left-color: #2563eb; }

    .session-header {
      display: flex; justify-content: space-between; align-items: center;
      padding: 14px 18px; cursor: pointer; transition: background 0.15s;
    }
    .session-header:hover { background: #f8fafc; }
    .session-info { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 13px; color: #475569; }
    .session-info strong { color: #1e293b; }
    .divider { color: #cbd5e1; }

    .btn-expand {
      padding: 6px 14px; border: 1px solid #cbd5e1; border-radius: 6px; background: #fff;
      cursor: pointer; font-size: 12px; font-weight: 600; color: #475569; white-space: nowrap;
    }
    .btn-expand:hover { background: #f1f5f9; }

    .badge { padding: 2px 8px; border-radius: 99px; font-size: 11px; font-weight: 600; }
    .badge.warning { background: #fef9c3; color: #b45309; }
    .badge.success { background: #dcfce7; color: #16a34a; }
    .badge[data-status="FINALIZED"] { background: #dcfce7; color: #16a34a; }
    .badge[data-status="TEACHER_COMPLETED"] { background: #dbeafe; color: #2563eb; }
    .badge[data-status="PARENT_CONFIRMED"] { background: #e0e7ff; color: #4f46e5; }
    .badge[data-status="SCHEDULED"] { background: #f1f5f9; color: #64748b; }
    .deadline-badge { padding: 2px 8px; border-radius: 99px; font-size: 11px; font-weight: 600; background: #dcfce7; color: #16a34a; }
    .deadline-badge.near-deadline { background: #fef9c3; color: #b45309; }
    .deadline-badge.overdue { background: #fee2e2; color: #dc2626; }
    .badge.late-badge { background: #fee2e2; color: #dc2626; }

    .report-form, .report-view { padding: 0 18px 18px; }
    .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
    .form-group { display: flex; flex-direction: column; gap: 4px; position: relative; }
    .form-group.full { grid-column: 1 / -1; }
    .form-group label { font-size: 13px; font-weight: 600; color: #475569; display: flex; justify-content: space-between; align-items: center; }
    .required { color: #ef4444; }
    .char-count { font-size: 11px; font-weight: 400; color: #94a3b8; }
    .form-group textarea, .form-group input {
      padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 6px;
      font-size: 14px; font-family: inherit; resize: vertical; transition: all 0.15s;
    }
    .form-group textarea:focus, .form-group input:focus {
      outline: none; border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37,99,235,0.1);
    }
    .form-group.has-error textarea, .form-group.has-error input {
      border-color: #ef4444; background: #fef2f2;
    }
    .form-group.has-error textarea:focus, .form-group.has-error input:focus {
      box-shadow: 0 0 0 3px rgba(239,68,68,0.1);
    }
    .error-message {
      font-size: 12px; color: #dc2626; margin-top: 4px; display: block;
      animation: shake 0.3s ease-in-out;
    }
    @keyframes shake {
      0%, 100% { transform: translateX(0); }
      25% { transform: translateX(-4px); }
      75% { transform: translateX(4px); }
    }
    .form-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 14px; }
    .btn {
      padding: 8px 18px; border: none; border-radius: 6px; cursor: pointer;
      font-size: 14px; font-weight: 600; transition: all 0.15s;
    }
    .btn.primary { background: #2563eb; color: #fff; }
    .btn.primary:hover { background: #1d4ed8; }
    .btn.primary:disabled { background: #93c5fd; cursor: not-allowed; }
    .btn.secondary { background: #f1f5f9; color: #475569; }
    .btn.secondary:hover { background: #e2e8f0; }

    .report-table { width: 100%; border-collapse: collapse; font-size: 14px; }
    .report-table th { text-align: left; padding: 8px 12px; background: #f8fafc; color: #64748b; font-size: 12px; width: 140px; font-weight: 600; white-space: nowrap; }
    .report-table td { padding: 8px 12px; color: #1e293b; word-break: break-word; }
    .report-table tr { border-bottom: 1px solid #f1f5f9; }
    .report-table a { color: #2563eb; text-decoration: none; }
    .report-table a:hover { text-decoration: underline; }

    .pagination { display: flex; gap: 12px; align-items: center; justify-content: center; padding: 20px 0; }
    .pagination button {
      padding: 6px 14px; border: 1px solid #cbd5e1; border-radius: 6px;
      background: #fff; cursor: pointer; font-size: 13px;
    }
    .pagination button:disabled { opacity: 0.5; cursor: not-allowed; }
    .pagination span { font-size: 13px; color: #64748b; }

    @media (max-width: 768px) {
      .form-grid { grid-template-columns: 1fr; }
      .filter-row { align-items: stretch; }
      .filter-group, .filter-group input, .btn-filter, .btn-ghost { width: 100%; }
      .session-header { flex-direction: column; align-items: flex-start; gap: 10px; }
      .btn-expand { width: 100%; }
    }
  `]
})
export class TeachingReportComponent implements OnInit, OnDestroy {
  // ── Signals ────────────────────────────────────────────────────────
  teachers = signal<UserItem[]>([]);
  pendingSessions = signal<SessionItem[]>([]);
  completedSessions = signal<SessionItem[]>([]);
  pendingCount = signal(0);
  pendingMeta = signal<PendingMeta>({ total: 0, page: 1, totalPages: 1 });
  completedMeta = signal<any>({});
  payrollPreview = signal<PayrollPreview | null>(null);
  templates = signal<ReportTemplate[]>([]);
  loading = signal(false);
  submitting = signal(false);
  error = signal('');
  success = signal('');

  // ── State ──────────────────────────────────────────────────────────
  activeTab = 'pending';
  pendingPage = 1;
  completedPage = 1;
  selectedMonth = '';
  fromDate = '';
  toDate = '';
  teacherCodeSearch = '';
  selectedTeacherId = '';

  // ── Debounce: teacher code search (800ms) ─────────────────────────
  private teacherCode$ = new Subject<string>();
  private destroy$ = new Subject<void>();

  constructor(
    private sessionService: SessionService,
    private auth: AuthService,
    private payrollService: PayrollService,
    private userService: UserService,
    private templateService: ReportTemplateService,
  ) {}

  ngOnInit() {
    // Debounce teacher-code input: auto-sync selection 800ms after typing stops
    this.teacherCode$.pipe(
      debounceTime(800),
      distinctUntilChanged(),
    ).subscribe(() => {
      this.syncTeacherSelection();
    });

    if (!this.isTeacher()) {
      this.loadTeacherOptions();
    } else {
      // Teachers load their own templates on init
      this.loadTemplates();
    }
    this.resetToCurrentMonth();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    this.teacherCode$.complete();
  }

  // Called from template on ngModelChange of teacher code input
  onTeacherCodeInput(value: string) {
    this.teacherCodeSearch = value;
    this.teacherCode$.next(value);
  }

  async loadPending() {
    this.loading.set(true);
    this.error.set('');
    try {
      await Promise.all([this.fetchPending(), this.fetchPayrollPreview()]);
    } catch (e: any) {
      this.error.set(e?.message || 'Lỗi tải dữ liệu');
    } finally {
      this.loading.set(false);
    }
  }

  async loadCompleted() {
    this.loading.set(true);
    this.error.set('');
    try {
      await Promise.all([this.fetchCompleted(), this.fetchPayrollPreview()]);
    } catch (e: any) {
      this.error.set(e?.message || 'Lỗi tải dữ liệu');
    } finally {
      this.loading.set(false);
    }
  }

  onMonthChange() {
    if (!this.selectedMonth) return;
    const [year, month] = this.selectedMonth.split('-').map(Number);
    if (!year || !month) return;
    const lastDay = new Date(year, month, 0).getDate();
    this.fromDate = `${year}-${String(month).padStart(2, '0')}-01`;
    this.toDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    this.applyFilters();
  }

  resetToCurrentMonth() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    this.selectedMonth = `${year}-${String(month).padStart(2, '0')}`;
    const lastDay = new Date(year, month, 0).getDate();
    this.fromDate = `${year}-${String(month).padStart(2, '0')}-01`;
    this.toDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    this.applyFilters();
  }

  async applyFilters(resetPage = true) {
    if (this.fromDate && this.toDate && this.fromDate > this.toDate) {
      this.error.set('Khoảng ngày không hợp lệ');
      return;
    }

    if (!this.syncTeacherSelection()) return;

    if (resetPage) {
      this.pendingPage = 1;
      this.completedPage = 1;
    }

    this.loading.set(true);
    this.error.set('');

    try {
      await Promise.all([
        this.fetchPending(),
        this.fetchCompleted(),
        this.fetchPayrollPreview(),
      ]);
    } catch (e: any) {
      this.error.set(e?.message || 'Lỗi tải dữ liệu');
    } finally {
      this.loading.set(false);
    }
  }

  onPendingPageChange(page: number) {
    this.pendingPage = page;
    this.loadPending();
  }

  onCompletedPageChange(page: number) {
    this.completedPage = page;
    this.loadCompleted();
  }

  // ── Handle submit from sub-components ────────────────────────────
  async handleSubmit(event: { sessionId: string; data: ReportFormValues }) {
    if (!this.canEditReports()) return;
    this.submitting.set(true);
    this.error.set('');
    this.success.set('');
    try {
      await this.sessionService.submitTeachingReport(event.sessionId, event.data);
      this.clearDraft(event.sessionId);
      this.success.set('Nộp báo cáo thành công! ✓');
      setTimeout(() => this.success.set(''), 3000);
      await this.applyFilters(false);
    } catch (e: any) {
      const msg = e?.error?.message;
      this.error.set(
        Array.isArray(msg) ? msg.join('; ') : msg || e?.message || 'Lỗi gửi báo cáo.',
      );
      setTimeout(() => this.error.set(''), 5000);
    } finally {
      this.submitting.set(false);
    }
  }

  // ── Private data fetchers ─────────────────────────────────────────

  private async fetchPending() {
    const result = await this.sessionService.list({
      page: this.pendingPage,
      limit: 20,
      hasReport: 'false',
      teacherId: this.getSelectedTeacherId() || undefined,
      fromDate: this.fromDate || undefined,
      toDate: this.toDate || undefined,
    });
    this.pendingSessions.set(result.data);
    const total = result.meta?.total ?? result.data.length;
    const limit = result.meta?.limit ?? 20;
    this.pendingCount.set(total);
    this.pendingMeta.set({
      total,
      page: this.pendingPage,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  }

  private async fetchCompleted() {
    const result = await this.sessionService.list({
      page: this.completedPage,
      limit: 20,
      hasReport: 'true',
      teacherId: this.getSelectedTeacherId() || undefined,
      fromDate: this.fromDate || undefined,
      toDate: this.toDate || undefined,
    });
    this.completedSessions.set(result.data);
    this.completedMeta.set(result.meta || {});
  }

  private async fetchPayrollPreview() {
    const teacherId = this.getSelectedTeacherId();
    if (!teacherId || !this.fromDate || !this.toDate) {
      this.payrollPreview.set(null);
      return;
    }
    const preview = await this.payrollService.getTeacherPreview(teacherId, this.fromDate, this.toDate);
    this.payrollPreview.set(preview);
  }

  private async loadTeacherOptions() {
    const teachers = await this.userService.listTeachers();
    this.teachers.set(teachers);
  }

  private async loadTemplates() {
    try {
      const tpls = await this.templateService.list();
      this.templates.set(tpls);
    } catch {
      // Non-critical: silently ignore template load errors
    }
  }

  private syncTeacherSelection(): boolean {
    if (this.isTeacher()) {
      this.selectedTeacherId = this.auth.userSignal()?.sub || '';
      // Reload templates for this teacher
      this.loadTemplates();
      return true;
    }

    const teacherCode = this.teacherCodeSearch.trim().toLowerCase();
    if (!teacherCode) {
      this.selectedTeacherId = '';
      return true;
    }

    const exactMatch = this.teachers().find(
      (teacher) => (teacher.userCode || '').trim().toLowerCase() === teacherCode,
    );
    if (exactMatch) {
      this.selectedTeacherId = exactMatch._id;
      return true;
    }

    this.selectedTeacherId = '';
    this.error.set('Không tìm thấy giáo viên theo mã đã nhập');
    return false;
  }

  private getSelectedTeacherId(): string {
    return this.isTeacher() ? (this.auth.userSignal()?.sub || '') : this.selectedTeacherId;
  }

  private clearDraft(sessionId: string) {
    if (typeof window === 'undefined') return;

    try {
      window.sessionStorage.removeItem(teachingReportDraftStorageKey(sessionId));
    } catch {
      // Ignore storage cleanup failures.
    }
  }

  matchedTeacherByCode(): UserItem | null {
    if (!this.teacherCodeSearch.trim()) return null;
    return this.teachers().find(
      (teacher) =>
        (teacher.userCode || '').trim().toLowerCase() ===
        this.teacherCodeSearch.trim().toLowerCase(),
    ) || null;
  }

  canEditReports(): boolean {
    return this.isTeacher();
  }

  isTeacher() {
    return this.auth.userSignal()?.role === 'TEACHER';
  }

  formatCurrency(amount?: number): string {
    if (amount == null) return '-';
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
  }

  getPaidPayrollTotal(): number {
    return (this.payrollPreview()?.existingPayrolls || [])
      .filter((p) => p.status === 'PAID')
      .reduce((total, p) => total + (p.netAmount || 0), 0);
  }

  accountingNotes(): PayrollItem[] {
    return (this.payrollPreview()?.existingPayrolls || []).filter(
      (p) => !!p.notes?.trim(),
    );
  }

  payrollStatusLabel(status?: string): string {
    const map: Record<string, string> = {
      DRAFT: 'Nháp', PENDING_REVIEW: 'Chờ duyệt',
      APPROVED: 'Đã duyệt', PAID: 'Đã chi', REJECTED: 'Từ chối',
    };
    return map[status || ''] || status || 'Khác';
  }
}
