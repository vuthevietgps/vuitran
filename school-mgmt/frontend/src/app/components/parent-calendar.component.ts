import { Component, OnInit, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { FlowGuideComponent } from './shared/flow-guide.component';

interface SessionItem {
  _id: string;
  classId: { _id: string; name: string; code: string };
  studentId: { _id: string; fullName: string; studentCode: string };
  teacherId: { _id: string; fullName: string; email: string };
  scheduledDate: string;
  scheduledStartTime?: string;
  scheduledEndTime?: string;
  durationMinutes: number;
  sessionNumber?: number;
  sessionType: string;
  status: string;
  amountCharged: number;
}

const STATUS_LABELS: Record<string, string> = {
  SCHEDULED: 'Đã lên lịch',
  TEACHER_COMPLETED: 'GV đã xác nhận',
  PARENT_CONFIRMED: 'PH đã xác nhận',
  FINALIZED: 'Đã chốt',
  CANCELLED: 'Đã hủy',
  NO_SHOW: 'Vắng mặt',
  RESCHEDULED: 'Đã dời lịch',
};

const STATUS_COLORS: Record<string, string> = {
  SCHEDULED: '#3b82f6',
  TEACHER_COMPLETED: '#f59e0b',
  PARENT_CONFIRMED: '#8b5cf6',
  FINALIZED: '#10b981',
  CANCELLED: '#ef4444',
  NO_SHOW: '#6b7280',
  RESCHEDULED: '#64748b',
};

const STUDENT_COLORS = [
  '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
  '#ec4899', '#06b6d4', '#f97316', '#14b8a6', '#6366f1',
];

@Component({
  selector: 'app-parent-calendar',
  standalone: true,
  imports: [CommonModule, FlowGuideComponent],
  template: `
  <header class="page-header">
    <div>
      <h2>Lịch học của con</h2>
      <p>Xem lịch các buổi học theo tháng.</p>
    </div>
  </header>
  <app-flow-guide featureKey="parent-calendar"></app-flow-guide>

  <!-- Student Legend -->
  <section class="legend" *ngIf="studentList().length > 0">
    <span class="legend-label">Học sinh:</span>
    <span class="legend-item" *ngFor="let s of studentList(); let i = index">
      <span class="legend-dot" [style.background]="getStudentColor(s.id)"></span>
      {{ s.name }}
    </span>
  </section>

  <!-- Calendar Navigation -->
  <section class="calendar-nav">
    <button class="nav-btn" (click)="prevMonth()">&laquo; Tháng trước</button>
    <h3 class="month-title">Tháng {{ currentMonth() + 1 }} / {{ currentYear() }}</h3>
    <button class="nav-btn" (click)="nextMonth()">Tháng sau &raquo;</button>
  </section>

  <!-- Calendar Grid -->
  <section class="calendar-grid">
    <div class="day-header" *ngFor="let d of dayNames">{{ d }}</div>
    <div
      class="day-cell"
      *ngFor="let cell of calendarCells()"
      [class.other-month]="!cell.isCurrentMonth"
      [class.today]="cell.isToday"
      [class.selected]="selectedDate() === cell.dateKey"
      (click)="selectDate(cell.dateKey)"
    >
      <div class="day-number">{{ cell.day }}</div>
      <div class="session-dots" *ngIf="cell.sessions.length > 0">
        <span
          class="dot"
          *ngFor="let dot of cell.dots"
          [style.background]="dot.color"
          [title]="dot.studentName + ' (' + dot.count + ' buổi)'"
        ></span>
      </div>
      <div class="session-count" *ngIf="cell.sessions.length > 0">
        {{ cell.sessions.length }} buổi
      </div>
    </div>
  </section>

  <!-- Selected Day Details -->
  <section class="day-details" *ngIf="selectedSessions().length > 0">
    <h3>Chi tiết ngày {{ selectedDateFormatted() }}</h3>
    <div class="session-card" *ngFor="let s of selectedSessions()">
      <div class="session-header">
        <span class="student-badge" [style.background]="getStudentColor(s.studentId._id)">
          {{ s.studentId.fullName || 'N/A' }}
        </span>
        <span class="status-badge" [style.background]="getStatusColor(s.status)">
          {{ getStatusLabel(s.status) }}
        </span>
      </div>
      <div class="session-info">
        <div><strong>Lớp:</strong> {{ s.classId.name || 'N/A' }} ({{ s.classId.code || '' }})</div>
        <div><strong>Giáo viên:</strong> {{ s.teacherId.fullName || 'N/A' }}</div>
        <div *ngIf="s.scheduledStartTime">
          <strong>Thời gian:</strong> {{ s.scheduledStartTime }} - {{ s.scheduledEndTime || '?' }}
        </div>
        <div><strong>Thời lượng:</strong> {{ s.durationMinutes }} phút</div>
        <div *ngIf="s.sessionNumber"><strong>Buổi thứ:</strong> {{ s.sessionNumber }}</div>
        <div><strong>Loại:</strong> {{ getSessionTypeLabel(s.sessionType) }}</div>
        <div *ngIf="s.amountCharged"><strong>Học phí:</strong> {{ s.amountCharged | number }}đ</div>
      </div>
    </div>
  </section>

  <section class="day-details empty" *ngIf="selectedDate() && selectedSessions().length === 0">
    <p>Không có buổi học nào trong ngày {{ selectedDateFormatted() }}.</p>
  </section>

  <!-- Loading -->
  <div class="loading" *ngIf="loading()">Đang tải dữ liệu...</div>
  `,
  styles: [`
    :host { display: block; padding: 24px; }

    .page-header {
      display: flex; justify-content: space-between; align-items: center;
      margin-bottom: 20px;
    }
    .page-header h2 { margin: 0; font-size: 1.5rem; color: #1e293b; }
    .page-header p { margin: 4px 0 0; color: #64748b; font-size: 0.9rem; }

    .legend {
      display: flex; align-items: center; gap: 16px; flex-wrap: wrap;
      margin-bottom: 16px; padding: 12px 16px;
      background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;
    }
    .legend-label { font-weight: 600; color: #475569; }
    .legend-item {
      display: flex; align-items: center; gap: 6px;
      font-size: 0.875rem; color: #334155;
    }
    .legend-dot {
      width: 12px; height: 12px; border-radius: 50%; display: inline-block;
    }

    .calendar-nav {
      display: flex; justify-content: space-between; align-items: center;
      margin-bottom: 16px;
    }
    .month-title { margin: 0; font-size: 1.2rem; color: #1e293b; }
    .nav-btn {
      padding: 8px 16px; border: 1px solid #cbd5e1; border-radius: 6px;
      background: #fff; color: #475569; cursor: pointer; font-size: 0.875rem;
      transition: all 0.15s;
    }
    .nav-btn:hover { background: #f1f5f9; border-color: #94a3b8; }

    .calendar-grid {
      display: grid; grid-template-columns: repeat(7, 1fr); gap: 1px;
      background: #e2e8f0; border: 1px solid #e2e8f0; border-radius: 8px;
      overflow: hidden; margin-bottom: 24px;
    }
    .day-header {
      background: #f1f5f9; padding: 10px 4px; text-align: center;
      font-weight: 600; font-size: 0.8rem; color: #475569;
    }
    .day-cell {
      background: #fff; min-height: 80px; padding: 6px;
      cursor: pointer; transition: background 0.15s;
      display: flex; flex-direction: column;
    }
    .day-cell:hover { background: #f8fafc; }
    .day-cell.other-month { background: #f9fafb; }
    .day-cell.other-month .day-number { color: #cbd5e1; }
    .day-cell.today { background: #eff6ff; }
    .day-cell.today .day-number { color: #2563eb; font-weight: 700; }
    .day-cell.selected { background: #dbeafe; outline: 2px solid #3b82f6; outline-offset: -2px; }

    .day-number { font-size: 0.85rem; color: #334155; margin-bottom: 4px; }

    .session-dots {
      display: flex; gap: 3px; flex-wrap: wrap; margin-bottom: 2px;
    }
    .dot {
      width: 8px; height: 8px; border-radius: 50%; display: inline-block;
    }
    .session-count {
      font-size: 0.7rem; color: #64748b; margin-top: auto;
    }

    .day-details {
      background: #fff; border: 1px solid #e2e8f0; border-radius: 8px;
      padding: 20px; margin-bottom: 16px;
    }
    .day-details h3 { margin: 0 0 16px; font-size: 1.1rem; color: #1e293b; }
    .day-details.empty p { color: #94a3b8; margin: 0; }

    .session-card {
      border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px;
      margin-bottom: 12px; background: #fafbfc;
    }
    .session-card:last-child { margin-bottom: 0; }
    .session-header {
      display: flex; justify-content: space-between; align-items: center;
      margin-bottom: 10px;
    }
    .student-badge, .status-badge {
      padding: 4px 10px; border-radius: 12px; font-size: 0.8rem;
      color: #fff; font-weight: 500;
    }
    .session-info { display: grid; gap: 6px; font-size: 0.875rem; color: #475569; }
    .session-info strong { color: #334155; }

    .loading {
      text-align: center; padding: 40px; color: #94a3b8; font-size: 0.9rem;
    }
  `]
})
export class ParentCalendarComponent implements OnInit {
  private http = inject(HttpClient);

  dayNames = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

  loading = signal(false);
  sessions = signal<SessionItem[]>([]);
  currentYear = signal(new Date().getFullYear());
  currentMonth = signal(new Date().getMonth()); // 0-based
  selectedDate = signal<string | null>(null);

  /** Unique student list derived from sessions */
  studentList = computed(() => {
    const map = new Map<string, string>();
    for (const s of this.sessions()) {
      if (s.studentId?._id && !map.has(s.studentId._id)) {
        map.set(s.studentId._id, s.studentId.fullName);
      }
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  });

  /** Map studentId -> color index */
  private studentColorMap = computed(() => {
    const map = new Map<string, string>();
    const list = this.studentList();
    list.forEach((s, i) => map.set(s.id, STUDENT_COLORS[i % STUDENT_COLORS.length]));
    return map;
  });

  /** Sessions grouped by date key (YYYY-MM-DD) */
  private sessionsByDate = computed(() => {
    const map = new Map<string, SessionItem[]>();
    for (const s of this.sessions()) {
      const key = s.scheduledDate?.substring(0, 10);
      if (!key) continue;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    return map;
  });

  /** Calendar grid cells for the current month */
  calendarCells = computed(() => {
    const year = this.currentYear();
    const month = this.currentMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const today = new Date();
    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    // Monday = 0, Sunday = 6 (ISO week)
    let startDow = firstDay.getDay() - 1; // JS: 0=Sun -> -1, Mon=0, Tue=1 ...
    if (startDow < 0) startDow = 6; // Sunday

    const cells: {
      day: number;
      dateKey: string;
      isCurrentMonth: boolean;
      isToday: boolean;
      sessions: SessionItem[];
      dots: { color: string; studentName: string; count: number }[];
    }[] = [];

    // Days from previous month
    const prevLastDay = new Date(year, month, 0).getDate();
    for (let i = startDow - 1; i >= 0; i--) {
      const d = prevLastDay - i;
      const m = month === 0 ? 12 : month;
      const y = month === 0 ? year - 1 : year;
      const key = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const daySessions = this.sessionsByDate().get(key) || [];
      cells.push({
        day: d, dateKey: key, isCurrentMonth: false,
        isToday: key === todayKey, sessions: daySessions,
        dots: this.buildDots(daySessions),
      });
    }

    // Days of current month
    for (let d = 1; d <= lastDay.getDate(); d++) {
      const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const daySessions = this.sessionsByDate().get(key) || [];
      cells.push({
        day: d, dateKey: key, isCurrentMonth: true,
        isToday: key === todayKey, sessions: daySessions,
        dots: this.buildDots(daySessions),
      });
    }

    // Fill remaining to complete last week row
    const remaining = 7 - (cells.length % 7);
    if (remaining < 7) {
      for (let d = 1; d <= remaining; d++) {
        const m = month + 2 > 12 ? 1 : month + 2;
        const y = month + 2 > 12 ? year + 1 : year;
        const key = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const daySessions = this.sessionsByDate().get(key) || [];
        cells.push({
          day: d, dateKey: key, isCurrentMonth: false,
          isToday: key === todayKey, sessions: daySessions,
          dots: this.buildDots(daySessions),
        });
      }
    }

    return cells;
  });

  /** Sessions for the selected date */
  selectedSessions = computed(() => {
    const key = this.selectedDate();
    if (!key) return [];
    return this.sessionsByDate().get(key) || [];
  });

  /** Formatted selected date for display */
  selectedDateFormatted = computed(() => {
    const key = this.selectedDate();
    if (!key) return '';
    const [y, m, d] = key.split('-');
    return `${d}/${m}/${y}`;
  });

  ngOnInit() {
    this.loadSessions();
  }

  async loadSessions() {
    this.loading.set(true);
    try {
      const year = this.currentYear();
      const month = this.currentMonth();
      // Fetch sessions for the visible range (prev month last week to next month first week)
      const fromDate = new Date(year, month, -6).toISOString().substring(0, 10);
      const toDate = new Date(year, month + 1, 7).toISOString().substring(0, 10);

      const res = await firstValueFrom(
        this.http.get<any>(`${environment.apiBase}/sessions`, {
          withCredentials: true,
          params: { fromDate, toDate, limit: '100', sort: 'scheduledDate' },
        })
      );
      this.sessions.set(res.data || []);
    } catch (err) {
      console.error('Failed to load sessions', err);
      this.sessions.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  prevMonth() {
    if (this.currentMonth() === 0) {
      this.currentMonth.set(11);
      this.currentYear.set(this.currentYear() - 1);
    } else {
      this.currentMonth.set(this.currentMonth() - 1);
    }
    this.selectedDate.set(null);
    this.loadSessions();
  }

  nextMonth() {
    if (this.currentMonth() === 11) {
      this.currentMonth.set(0);
      this.currentYear.set(this.currentYear() + 1);
    } else {
      this.currentMonth.set(this.currentMonth() + 1);
    }
    this.selectedDate.set(null);
    this.loadSessions();
  }

  selectDate(dateKey: string) {
    this.selectedDate.set(this.selectedDate() === dateKey ? null : dateKey);
  }

  getStudentColor(studentId: string): string {
    return this.studentColorMap().get(studentId) || '#94a3b8';
  }

  getStatusLabel(status: string): string {
    return STATUS_LABELS[status] || status;
  }

  getStatusColor(status: string): string {
    return STATUS_COLORS[status] || '#94a3b8';
  }

  getSessionTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      REGULAR: 'Buổi thường',
      TRIAL: 'Học thử',
      MAKE_UP: 'Buổi bù',
      EXAM_PREP: 'Ôn thi',
      REVIEW: 'Ôn tập',
      EXTRA: 'Buổi thêm',
    };
    return labels[type] || type;
  }

  private buildDots(sessions: SessionItem[]): { color: string; studentName: string; count: number }[] {
    const map = new Map<string, { color: string; studentName: string; count: number }>();
    for (const s of sessions) {
      const id = s.studentId?._id;
      if (!id) continue;
      if (map.has(id)) {
        map.get(id)!.count++;
      } else {
        map.set(id, {
          color: this.studentColorMap().get(id) || '#94a3b8',
          studentName: s.studentId.fullName || 'N/A',
          count: 1,
        });
      }
    }
    return Array.from(map.values());
  }
}
