import { Component, signal, computed, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

import { FlowGuideComponent } from './shared/flow-guide.component';

/* ── Status labels & colors ────────────────────────────────────────── */

const STATUS_LABELS: Record<string, string> = {
  SCHEDULED: 'Đã lên lịch',
  TEACHER_COMPLETED: 'GV đã dạy',
  PARENT_CONFIRMED: 'PH xác nhận',
  FINALIZED: 'Đã chốt',
  CANCELLED: 'Đã hủy',
  NO_SHOW: 'Vắng mặt',
  RESCHEDULED: 'Dời lịch',
};

const STATUS_COLORS: Record<string, string> = {
  SCHEDULED: '#3b82f6',
  TEACHER_COMPLETED: '#f59e0b',
  PARENT_CONFIRMED: '#8b5cf6',
  FINALIZED: '#10b981',
  CANCELLED: '#ef4444',
  NO_SHOW: '#6b7280',
  RESCHEDULED: '#6366f1',
};

const SESSION_TYPE_LABELS: Record<string, string> = {
  REGULAR: 'Thường',
  TRIAL: 'Học thử',
  MAKE_UP: 'Bù',
  EXAM_PREP: 'Ôn thi',
  REVIEW: 'Ôn tập',
  EXTRA: 'Thêm',
};

const CLASS_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16',
  '#06b6d4', '#e11d48', '#7c3aed', '#0d9488', '#d97706',
];

const WEEKDAY_LABELS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

@Component({
  selector: 'app-teacher-calendar',
  standalone: true,
  imports: [CommonModule, FlowGuideComponent],
  template: `
  <header class="page-header">
    <div>
      <h2>Lịch dạy</h2>
      <p>Tổng quan lịch dạy tất cả các lớp.</p>
    </div>
    <div class="header-actions">
      <div class="view-toggle">
        <button [class.active]="viewMode() === 'week'" (click)="viewMode.set('week')">Tuần</button>
        <button [class.active]="viewMode() === 'month'" (click)="viewMode.set('month')">Tháng</button>
      </div>
    </div>
  </header>

  <app-flow-guide featureKey="teacher-calendar"></app-flow-guide>

  <!-- Legend -->
  <div class="legend" *ngIf="classColorMap().size > 0">
    <span class="legend-label">Lớp:</span>
    <span class="legend-item" *ngFor="let entry of classColorEntries()">
      <span class="legend-dot" [style.background]="entry[1]"></span>
      {{entry[0]}}
    </span>
  </div>

  <!-- Navigation -->
  <div class="cal-nav">
    <button class="ghost" (click)="navigatePrev()">&#9664;</button>
    <span class="cal-nav-label">{{ navLabel() }}</span>
    <button class="ghost" (click)="navigateNext()">&#9654;</button>
    <button class="ghost today-btn" (click)="goToday()">Hôm nay</button>
  </div>

  <!-- Loading -->
  <div class="loading" *ngIf="loading()">Đang tải...</div>

  <!-- ─── WEEKLY VIEW ─────────────────────────────── -->
  <div class="week-view" *ngIf="viewMode() === 'week' && !loading()">
    <div class="week-grid">
      <div class="day-col" *ngFor="let day of weekDays()">
        <div class="day-header" [class.today]="isToday(day.date)">
          <span class="day-label">{{ day.weekday }}</span>
          <span class="day-number">{{ day.date | date:'dd/MM' }}</span>
        </div>
        <div class="day-sessions">
          <div class="session-card"
            *ngFor="let s of getSessionsForDate(day.dateStr)"
            [style.border-left-color]="getClassColor(s.classId?.name || s.classId)"
            [class.expanded]="expandedId() === s._id"
            (click)="toggleExpand(s._id)">
            <div class="session-time">
              {{ s.scheduledStartTime || '--:--' }} - {{ s.scheduledEndTime || '--:--' }}
            </div>
            <div class="session-class">{{ s.classId?.name || 'N/A' }}</div>
            <div class="session-student">{{ s.studentId?.fullName || 'N/A' }}</div>
            <span class="badge" [style.background]="statusColor(s.status)">{{ statusLabel(s.status) }}</span>

            <!-- Expanded details -->
            <div class="session-details" *ngIf="expandedId() === s._id">
              <div class="detail-row"><strong>Học sinh:</strong> {{ s.studentId?.fullName || 'N/A' }} ({{ s.studentId?.studentCode || '' }})</div>
              <div class="detail-row"><strong>Lớp:</strong> {{ s.classId?.name || 'N/A' }} ({{ s.classId?.code || '' }})</div>
              <div class="detail-row"><strong>Thời lượng:</strong> {{ s.durationMinutes }} phút</div>
              <div class="detail-row"><strong>Loại:</strong> {{ sessionTypeLabel(s.sessionType) }}</div>
              <div class="detail-row"><strong>Buổi thứ:</strong> {{ s.sessionNumber || '--' }}</div>
              <div class="detail-row">
                <strong>Đánh giá:</strong>
                <span class="badge small" [style.background]="s.evaluation ? '#10b981' : '#6b7280'">
                  {{ s.evaluation ? 'Đã đánh giá' : 'Chưa đánh giá' }}
                </span>
              </div>
              <div class="detail-row">
                <strong>Báo cáo:</strong>
                <span class="badge small" [style.background]="s.hasTeachingReport ? '#10b981' : '#ef4444'">
                  {{ s.hasTeachingReport ? 'Đã nộp' : 'Chưa nộp' }}
                </span>
              </div>
              <div class="detail-row" *ngIf="s.topicsCovered">
                <strong>Nội dung:</strong> {{ s.topicsCovered }}
              </div>
            </div>
          </div>
          <div class="no-sessions" *ngIf="getSessionsForDate(day.dateStr).length === 0">—</div>
        </div>
      </div>
    </div>
  </div>

  <!-- ─── MONTHLY VIEW ────────────────────────────── -->
  <div class="month-view" *ngIf="viewMode() === 'month' && !loading()">
    <div class="month-grid">
      <div class="month-header-cell" *ngFor="let wd of weekdayLabels">{{ wd }}</div>
      <ng-container *ngFor="let cell of monthCells()">
        <div class="month-cell"
          [class.other-month]="!cell.currentMonth"
          [class.today]="cell.isToday">
          <div class="cell-date">{{ cell.day }}</div>
          <div class="cell-sessions">
            <div class="mini-session"
              *ngFor="let s of getSessionsForDate(cell.dateStr)"
              [style.background]="getClassColor(s.classId?.name || s.classId)"
              [class.expanded]="expandedId() === s._id"
              (click)="toggleExpand(s._id); $event.stopPropagation()">
              <span class="mini-time">{{ s.scheduledStartTime || '--:--' }}</span>
              <span class="mini-class">{{ s.classId?.name || '' }}</span>
              <span class="mini-student">{{ s.studentId?.fullName || '' }}</span>
              <span class="mini-badge" [style.background]="statusColor(s.status)">{{ statusLabel(s.status) }}</span>

              <div class="session-details month-details" *ngIf="expandedId() === s._id" (click)="$event.stopPropagation()">
                <div class="detail-row"><strong>Học sinh:</strong> {{ s.studentId?.fullName || 'N/A' }} ({{ s.studentId?.studentCode || '' }})</div>
                <div class="detail-row"><strong>Lớp:</strong> {{ s.classId?.name || 'N/A' }} ({{ s.classId?.code || '' }})</div>
                <div class="detail-row"><strong>Thời gian:</strong> {{ s.scheduledStartTime || '--:--' }} - {{ s.scheduledEndTime || '--:--' }}</div>
                <div class="detail-row"><strong>Thời lượng:</strong> {{ s.durationMinutes }} phút</div>
                <div class="detail-row"><strong>Loại:</strong> {{ sessionTypeLabel(s.sessionType) }}</div>
                <div class="detail-row">
                  <strong>Đánh giá:</strong>
                  <span class="badge small" [style.background]="s.evaluation ? '#10b981' : '#6b7280'">
                    {{ s.evaluation ? 'Đã đánh giá' : 'Chưa đánh giá' }}
                  </span>
                </div>
                <div class="detail-row">
                  <strong>Báo cáo:</strong>
                  <span class="badge small" [style.background]="s.hasTeachingReport ? '#10b981' : '#ef4444'">
                    {{ s.hasTeachingReport ? 'Đã nộp' : 'Chưa nộp' }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </ng-container>
    </div>
  </div>

  <!-- Stats -->
  <section class="stats" *ngIf="!loading()">
    <div class="stat-card"><div class="stat-value">{{ totalSessions() }}</div><div class="stat-label">Tổng buổi</div></div>
    <div class="stat-card"><div class="stat-value">{{ scheduledCount() }}</div><div class="stat-label">Đã lên lịch</div></div>
    <div class="stat-card"><div class="stat-value">{{ completedCount() }}</div><div class="stat-label">Đã hoàn thành</div></div>
    <div class="stat-card"><div class="stat-value">{{ pendingReportCount() }}</div><div class="stat-label">Chưa nộp báo cáo</div></div>
  </section>
  `,
  styles: [`
    :host { display: block; padding: 24px; }
    .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; }
    .page-header h2 { margin: 0 0 4px; font-size: 22px; }
    .page-header p { margin: 0; color: #64748b; font-size: 14px; }

    .header-actions { display: flex; gap: 8px; align-items: center; }
    .view-toggle { display: flex; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; }
    .view-toggle button {
      padding: 6px 16px; border: none; background: #fff; cursor: pointer; font-size: 13px;
      transition: background .15s, color .15s;
    }
    .view-toggle button.active { background: #3b82f6; color: #fff; }

    .legend { display: flex; gap: 12px; flex-wrap: wrap; align-items: center; margin-bottom: 12px; font-size: 13px; }
    .legend-label { font-weight: 600; color: #475569; }
    .legend-item { display: flex; align-items: center; gap: 4px; }
    .legend-dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }

    .cal-nav { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
    .cal-nav-label { font-weight: 600; font-size: 16px; min-width: 180px; text-align: center; }
    .today-btn { margin-left: 8px; font-size: 12px; padding: 4px 10px; }
    .ghost { border: 1px solid #e2e8f0; background: #fff; border-radius: 6px; cursor: pointer; padding: 6px 10px; }
    .ghost:hover { background: #f1f5f9; }
    .ghost:disabled { opacity: .4; cursor: default; }

    .loading { text-align: center; padding: 40px; color: #64748b; }

    /* ── Weekly ── */
    .week-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 8px; }
    .day-col { min-height: 120px; }
    .day-header {
      text-align: center; padding: 6px 4px; border-radius: 8px 8px 0 0;
      background: #f8fafc; border-bottom: 2px solid #e2e8f0; margin-bottom: 4px;
    }
    .day-header.today { background: #eff6ff; border-bottom-color: #3b82f6; }
    .day-label { display: block; font-size: 11px; color: #64748b; text-transform: uppercase; }
    .day-number { display: block; font-size: 14px; font-weight: 600; }

    .day-sessions { display: flex; flex-direction: column; gap: 4px; }
    .session-card {
      border-left: 4px solid #3b82f6; background: #fff; border-radius: 6px;
      padding: 8px; font-size: 12px; box-shadow: 0 1px 3px rgba(0,0,0,.08);
      cursor: pointer; transition: box-shadow .15s;
    }
    .session-card:hover { box-shadow: 0 2px 8px rgba(0,0,0,.14); }
    .session-card.expanded { box-shadow: 0 4px 12px rgba(0,0,0,.15); }
    .session-time { font-weight: 600; color: #1e293b; margin-bottom: 2px; }
    .session-class { color: #3b82f6; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .session-student { color: #475569; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 4px; }

    .badge {
      display: inline-block; padding: 2px 6px; border-radius: 4px;
      font-size: 10px; color: #fff; font-weight: 600; white-space: nowrap;
    }
    .badge.small { font-size: 9px; padding: 1px 5px; }

    .session-details {
      margin-top: 8px; padding-top: 8px; border-top: 1px solid #e2e8f0; font-size: 11px;
    }
    .detail-row { margin-bottom: 4px; color: #334155; }
    .detail-row strong { color: #1e293b; }

    .no-sessions { text-align: center; color: #cbd5e1; font-size: 13px; padding: 8px 0; }

    /* ── Monthly ── */
    .month-grid {
      display: grid; grid-template-columns: repeat(7, 1fr); gap: 1px;
      background: #e2e8f0; border-radius: 8px; overflow: hidden;
    }
    .month-header-cell {
      background: #f1f5f9; text-align: center; padding: 8px 4px;
      font-size: 12px; font-weight: 600; color: #64748b;
    }
    .month-cell {
      background: #fff; min-height: 90px; padding: 4px; position: relative;
    }
    .month-cell.other-month { background: #fafafa; }
    .month-cell.other-month .cell-date { color: #cbd5e1; }
    .month-cell.today { background: #eff6ff; }
    .cell-date { font-size: 12px; font-weight: 600; color: #334155; margin-bottom: 2px; }
    .cell-sessions { display: flex; flex-direction: column; gap: 2px; }

    .mini-session {
      display: flex; flex-wrap: wrap; gap: 2px; align-items: center;
      padding: 2px 4px; border-radius: 4px; font-size: 10px; color: #fff;
      cursor: pointer; position: relative; transition: opacity .15s;
    }
    .mini-session:hover { opacity: .85; }
    .mini-time { font-weight: 600; }
    .mini-class { max-width: 60px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .mini-student { max-width: 50px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; opacity: .9; }
    .mini-badge {
      display: inline-block; padding: 0 3px; border-radius: 3px;
      font-size: 8px; font-weight: 600; line-height: 14px;
    }

    .month-details {
      position: absolute; left: 0; top: 100%; z-index: 10;
      background: #fff; border: 1px solid #e2e8f0; border-radius: 8px;
      box-shadow: 0 4px 16px rgba(0,0,0,.15); padding: 10px; min-width: 220px;
      color: #334155;
    }

    /* ── Stats ── */
    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin-top: 20px; }
    .stat-card {
      background: #fff; border-radius: 10px; padding: 16px; text-align: center;
      box-shadow: 0 1px 3px rgba(0,0,0,.08);
    }
    .stat-value { font-size: 24px; font-weight: 700; color: #1e293b; }
    .stat-label { font-size: 12px; color: #64748b; margin-top: 4px; }
  `],
})
export class TeacherCalendarComponent implements OnInit {
  private readonly http = inject(HttpClient);

  /* ── State ── */
  loading = signal(false);
  sessions = signal<any[]>([]);
  viewMode = signal<'week' | 'month'>('week');
  currentDate = signal(new Date());
  expandedId = signal<string | null>(null);

  weekdayLabels = WEEKDAY_LABELS;

  /* ── Derived ── */

  /** Map className → color */
  classColorMap = computed(() => {
    const map = new Map<string, string>();
    const names = [...new Set(this.sessions().map(s => s.classId?.name || 'N/A'))];
    names.forEach((n, i) => map.set(n, CLASS_COLORS[i % CLASS_COLORS.length]));
    return map;
  });

  classColorEntries = computed(() => Array.from(this.classColorMap().entries()));

  /** Sessions indexed by dateStr "YYYY-MM-DD" */
  sessionsByDate = computed(() => {
    const map: Record<string, any[]> = {};
    for (const s of this.sessions()) {
      const d = this.toDateStr(new Date(s.scheduledDate));
      (map[d] ??= []).push(s);
    }
    // Sort each day by start time
    for (const key of Object.keys(map)) {
      map[key].sort((a: any, b: any) => (a.scheduledStartTime || '').localeCompare(b.scheduledStartTime || ''));
    }
    return map;
  });

  navLabel = computed(() => {
    const d = this.currentDate();
    if (this.viewMode() === 'week') {
      const start = this.weekStart(d);
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      return `${this.fmtShort(start)} — ${this.fmtShort(end)}`;
    }
    return d.toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' });
  });

  weekDays = computed(() => {
    const start = this.weekStart(this.currentDate());
    return Array.from({ length: 7 }, (_, i) => {
      const dt = new Date(start);
      dt.setDate(dt.getDate() + i);
      return {
        date: dt,
        dateStr: this.toDateStr(dt),
        weekday: WEEKDAY_LABELS[dt.getDay()],
      };
    });
  });

  monthCells = computed(() => {
    const d = this.currentDate();
    const year = d.getFullYear();
    const month = d.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startOffset = firstDay.getDay(); // 0=Sun
    const cells: { day: number; dateStr: string; currentMonth: boolean; isToday: boolean }[] = [];
    const today = this.toDateStr(new Date());

    // Previous month filler
    for (let i = startOffset - 1; i >= 0; i--) {
      const dt = new Date(year, month, -i);
      cells.push({ day: dt.getDate(), dateStr: this.toDateStr(dt), currentMonth: false, isToday: false });
    }
    // Current month
    for (let day = 1; day <= lastDay.getDate(); day++) {
      const dt = new Date(year, month, day);
      const ds = this.toDateStr(dt);
      cells.push({ day, dateStr: ds, currentMonth: true, isToday: ds === today });
    }
    // Next month filler
    const remaining = 7 - (cells.length % 7);
    if (remaining < 7) {
      for (let i = 1; i <= remaining; i++) {
        const dt = new Date(year, month + 1, i);
        cells.push({ day: i, dateStr: this.toDateStr(dt), currentMonth: false, isToday: false });
      }
    }
    return cells;
  });

  /* Stats */
  totalSessions = computed(() => this.sessions().length);
  scheduledCount = computed(() => this.sessions().filter(s => s.status === 'SCHEDULED').length);
  completedCount = computed(() =>
    this.sessions().filter(s => ['TEACHER_COMPLETED', 'PARENT_CONFIRMED', 'FINALIZED'].includes(s.status)).length
  );
  pendingReportCount = computed(() =>
    this.sessions().filter(s =>
      ['TEACHER_COMPLETED', 'PARENT_CONFIRMED', 'FINALIZED'].includes(s.status) && !s.hasTeachingReport
    ).length
  );

  /* ── Lifecycle ── */

  ngOnInit() {
    this.loadSessions();
  }

  /* ── Data loading ── */

  async loadSessions() {
    this.loading.set(true);
    try {
      const { fromDate, toDate } = this.getDateRange();
      const res = await firstValueFrom(
        this.http.get<any>(`${environment.apiBase}/sessions/my-sessions`, {
          withCredentials: true,
          params: { fromDate, toDate, limit: '100', sort: 'scheduledDate' },
        })
      );
      this.sessions.set(res.data || []);
    } catch (e) {
      console.error('Lỗi tải lịch dạy:', e);
      this.sessions.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  /* ── Navigation ── */

  navigatePrev() {
    const d = new Date(this.currentDate());
    if (this.viewMode() === 'week') d.setDate(d.getDate() - 7);
    else d.setMonth(d.getMonth() - 1);
    this.currentDate.set(d);
    this.loadSessions();
  }

  navigateNext() {
    const d = new Date(this.currentDate());
    if (this.viewMode() === 'week') d.setDate(d.getDate() + 7);
    else d.setMonth(d.getMonth() + 1);
    this.currentDate.set(d);
    this.loadSessions();
  }

  goToday() {
    this.currentDate.set(new Date());
    this.loadSessions();
  }

  toggleExpand(id: string) {
    this.expandedId.set(this.expandedId() === id ? null : id);
  }

  /* ── Helpers ── */

  getSessionsForDate(dateStr: string): any[] {
    return this.sessionsByDate()[dateStr] || [];
  }

  getClassColor(nameOrObj: any): string {
    const name = typeof nameOrObj === 'string' ? nameOrObj : (nameOrObj?.name || 'N/A');
    return this.classColorMap().get(name) || '#94a3b8';
  }

  statusLabel(s: string): string { return STATUS_LABELS[s] || s; }
  statusColor(s: string): string { return STATUS_COLORS[s] || '#94a3b8'; }
  sessionTypeLabel(t: string): string { return SESSION_TYPE_LABELS[t] || t || '--'; }

  isToday(d: Date): boolean { return this.toDateStr(d) === this.toDateStr(new Date()); }

  private weekStart(d: Date): Date {
    const dt = new Date(d);
    const day = dt.getDay(); // 0=Sun
    const diff = day === 0 ? 6 : day - 1; // Start on Monday
    dt.setDate(dt.getDate() - diff);
    dt.setHours(0, 0, 0, 0);
    return dt;
  }

  private getDateRange(): { fromDate: string; toDate: string } {
    if (this.viewMode() === 'week') {
      const start = this.weekStart(this.currentDate());
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      return { fromDate: this.toDateStr(start), toDate: this.toDateStr(end) };
    }
    const d = this.currentDate();
    const first = new Date(d.getFullYear(), d.getMonth(), 1);
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    return { fromDate: this.toDateStr(first), toDate: this.toDateStr(last) };
  }

  private toDateStr(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  }

  private fmtShort(d: Date): string {
    return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
  }
}
