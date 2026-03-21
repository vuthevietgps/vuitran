import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DashboardService } from '../services/dashboard.service';

import { FlowGuideComponent } from './shared/flow-guide.component';

@Component({
  selector: 'app-calendar-overview',
  standalone: true,
  imports: [CommonModule, FormsModule, FlowGuideComponent],
  template: `
  <app-flow-guide featureKey="calendar-overview"></app-flow-guide>
  <div class="calendar-page">
    <div class="header">
      <h2>Lịch tổng quan</h2>
      <div class="month-nav">
        <button class="nav-btn" (click)="prevMonth()">&laquo;</button>
        <select [(ngModel)]="selectedMonth" (change)="load()">
          <option *ngFor="let m of months" [value]="m.value">{{ m.label }}</option>
        </select>
        <select [(ngModel)]="selectedYear" (change)="load()">
          <option *ngFor="let y of years" [value]="y">{{ y }}</option>
        </select>
        <button class="nav-btn" (click)="nextMonth()">&raquo;</button>
        <button class="today-btn" (click)="goToday()">Hôm nay</button>
      </div>
    </div>

    <div *ngIf="loading()" class="loading">Đang tải lịch...</div>
    <div *ngIf="error()" class="error">{{ error() }}</div>

    <!-- Summary Cards -->
    <div *ngIf="data()" class="stats-strip">
      <div class="stat-card blue">
        <span class="stat-val">{{ data()!.totalSessions }}</span>
        <span class="stat-lbl">Tổng buổi học</span>
      </div>
      <div class="stat-card green">
        <span class="stat-val">{{ data()!.byStatus['FINALIZED'] || 0 }}</span>
        <span class="stat-lbl">Hoàn thành</span>
      </div>
      <div class="stat-card orange">
        <span class="stat-val">{{ data()!.byStatus['SCHEDULED'] || 0 }}</span>
        <span class="stat-lbl">Đã lên lịch</span>
      </div>
      <div class="stat-card red">
        <span class="stat-val">{{ data()!.byStatus['CANCELLED'] || 0 }}</span>
        <span class="stat-lbl">Đã hủy</span>
      </div>
      <div class="stat-card purple">
        <span class="stat-val">{{ data()!.payrolls?.length || 0 }}</span>
        <span class="stat-lbl">Bảng lương</span>
      </div>
      <div class="stat-card gray">
        <span class="stat-val">{{ data()!.tickets?.length || 0 }}</span>
        <span class="stat-lbl">Ticket</span>
      </div>
    </div>

    <!-- Filter tabs -->
    <div *ngIf="data()" class="filter-tabs">
      <button [class.active]="eventFilter === 'ALL'" (click)="eventFilter = 'ALL'">Tất cả</button>
      <button [class.active]="eventFilter === 'SESSION'" (click)="eventFilter = 'SESSION'">Buổi học</button>
      <button [class.active]="eventFilter === 'PAYROLL'" (click)="eventFilter = 'PAYROLL'">Bảng lương</button>
      <button [class.active]="eventFilter === 'TICKET'" (click)="eventFilter = 'TICKET'">Ticket</button>
    </div>

    <!-- Calendar Grid -->
    <div *ngIf="data()" class="calendar-grid">
      <div class="day-header" *ngFor="let dh of dayHeaders">{{ dh }}</div>
      <div *ngFor="let cell of calendarCells" class="day-cell"
           [class.other-month]="!cell.inMonth"
           [class.today]="cell.isToday"
           [class.has-events]="cell.events.length > 0"
           (click)="selectDate(cell)">
        <div class="day-num">{{ cell.day }}</div>
        <div *ngIf="cell.summary && cell.inMonth" class="day-summary">
          <span *ngIf="cell.summary.sessions" class="dot blue" title="Buổi học">{{ cell.summary.sessions }}</span>
          <span *ngIf="cell.summary.completed" class="dot green" title="Hoàn thành">{{ cell.summary.completed }}</span>
          <span *ngIf="cell.summary.cancelled" class="dot red" title="Đã hủy">{{ cell.summary.cancelled }}</span>
        </div>
        <div *ngIf="cell.eventIndicators.length > 0 && cell.inMonth" class="event-indicators">
          <span *ngFor="let ind of cell.eventIndicators.slice(0, 3)" class="event-dot" [class]="'dot-' + ind"></span>
          <span *ngIf="cell.eventIndicators.length > 3" class="more-dots">+{{ cell.eventIndicators.length - 3 }}</span>
        </div>
      </div>
    </div>

    <!-- Selected Date Details -->
    <div *ngIf="selectedDateCell && selectedDateCell.events.length > 0" class="date-detail">
      <div class="detail-header">
        <h3>{{ selectedDateCell.dateStr }} — {{ selectedDateCell.events.length }} sự kiện</h3>
        <button class="close-btn" (click)="selectedDateCell = null">✕</button>
      </div>
      <div class="event-list">
        <div *ngFor="let ev of filteredEvents()" class="event-item" [class]="'event-type-' + ev.type">
          <div class="event-icon">
            <span *ngIf="ev.type === 'SESSION'">📚</span>
            <span *ngIf="ev.type === 'PAYROLL'">💰</span>
            <span *ngIf="ev.type === 'TICKET_CREATED'">🎫</span>
            <span *ngIf="ev.type === 'TICKET_DUE'">⚠️</span>
          </div>
          <div class="event-info">
            <div class="event-title">{{ ev.title }}</div>
            <div class="event-detail">{{ ev.detail }}</div>
            <span *ngIf="ev.time" class="event-time">{{ ev.time }}</span>
          </div>
          <span class="badge" [attr.data-status]="ev.status">{{ statusLabel(ev.status) }}</span>
        </div>
      </div>
    </div>

    <!-- Events Timeline -->
    <div *ngIf="data() && !selectedDateCell" class="timeline">
      <h3>Sự kiện trong tháng</h3>
      <div *ngIf="filteredAllEvents().length === 0" class="empty">Không có sự kiện nào</div>
      <div *ngFor="let group of groupedEvents()" class="timeline-group">
        <div class="timeline-date">{{ formatDateLabel(group.date) }}</div>
        <div class="timeline-events">
          <div *ngFor="let ev of group.events" class="timeline-event" [class]="'event-type-' + ev.type">
            <div class="tl-icon">
              <span *ngIf="ev.type === 'SESSION'">📚</span>
              <span *ngIf="ev.type === 'PAYROLL'">💰</span>
              <span *ngIf="ev.type === 'TICKET_CREATED'">🎫</span>
              <span *ngIf="ev.type === 'TICKET_DUE'">⚠️</span>
            </div>
            <div class="tl-info">
              <span class="tl-title">{{ ev.title }}</span>
              <span class="tl-detail">{{ ev.detail }}</span>
            </div>
            <span class="badge" [attr.data-status]="ev.status">{{ statusLabel(ev.status) }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
  `,
  styles: [`
    .calendar-page { padding: 24px; max-width: 1200px; margin: 0 auto; }
    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 12px; }
    .header h2 { margin: 0; color: #1e293b; font-size: 20px; }
    .month-nav { display: flex; align-items: center; gap: 6px; }
    .nav-btn { border: 1px solid #cbd5e1; background: #fff; border-radius: 6px; padding: 6px 12px; cursor: pointer; font-size: 16px; font-weight: 700; }
    .nav-btn:hover { background: #f1f5f9; }
    .today-btn { padding: 6px 14px; border: 1px solid #3b82f6; background: #eff6ff; border-radius: 6px; cursor: pointer; font-size: 13px; color: #2563eb; font-weight: 600; }
    .today-btn:hover { background: #dbeafe; }
    .month-nav select { padding: 6px 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 14px; }
    .loading { text-align: center; padding: 40px; color: #64748b; }
    .error { background: #fef2f2; color: #dc2626; padding: 12px; border-radius: 8px; margin-bottom: 16px; }

    /* Stats */
    .stats-strip { display: grid; grid-template-columns: repeat(6, 1fr); gap: 12px; margin-bottom: 20px; }
    .stat-card { background: #fff; border-radius: 10px; padding: 14px; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.06); border-top: 3px solid; }
    .stat-card.blue { border-color: #3b82f6; }
    .stat-card.green { border-color: #22c55e; }
    .stat-card.orange { border-color: #f59e0b; }
    .stat-card.red { border-color: #ef4444; }
    .stat-card.purple { border-color: #8b5cf6; }
    .stat-card.gray { border-color: #64748b; }
    .stat-val { display: block; font-size: 24px; font-weight: 700; color: #1e293b; }
    .stat-lbl { font-size: 11px; color: #94a3b8; }

    /* Filter tabs */
    .filter-tabs { display: flex; gap: 4px; margin-bottom: 16px; }
    .filter-tabs button { padding: 6px 16px; border: 1px solid #cbd5e1; background: #fff; cursor: pointer; font-size: 13px; border-radius: 6px; }
    .filter-tabs button.active { background: #2563eb; color: #fff; border-color: #2563eb; }

    /* Calendar Grid */
    .calendar-grid { display: grid; grid-template-columns: repeat(7, 1fr); background: #fff; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); overflow: hidden; margin-bottom: 24px; }
    .day-header { padding: 10px; text-align: center; font-size: 12px; font-weight: 700; color: #64748b; background: #f8fafc; text-transform: uppercase; border-bottom: 1px solid #e2e8f0; }
    .day-cell { min-height: 90px; padding: 6px 8px; border: 1px solid #f1f5f9; cursor: pointer; transition: background 0.15s; position: relative; }
    .day-cell:hover { background: #f8fafc; }
    .day-cell.other-month { background: #fafafa; }
    .day-cell.other-month .day-num { color: #cbd5e1; }
    .day-cell.today { background: #eff6ff; }
    .day-cell.today .day-num { background: #2563eb; color: #fff; border-radius: 50%; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; }
    .day-cell.has-events { border-color: #bfdbfe; }
    .day-num { font-size: 13px; font-weight: 600; color: #334155; margin-bottom: 4px; }
    .day-summary { display: flex; gap: 4px; flex-wrap: wrap; }
    .dot { display: inline-flex; align-items: center; justify-content: center; min-width: 18px; height: 18px; border-radius: 99px; font-size: 10px; font-weight: 700; color: #fff; padding: 0 4px; }
    .dot.blue { background: #3b82f6; }
    .dot.green { background: #22c55e; }
    .dot.red { background: #ef4444; }
    .event-indicators { display: flex; gap: 3px; margin-top: 4px; }
    .event-dot { width: 6px; height: 6px; border-radius: 50%; }
    .dot-SESSION { background: #3b82f6; }
    .dot-PAYROLL { background: #22c55e; }
    .dot-TICKET_CREATED, .dot-TICKET_DUE { background: #f59e0b; }
    .more-dots { font-size: 10px; color: #94a3b8; }

    /* Date Detail Panel */
    .date-detail { background: #fff; border-radius: 12px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); margin-bottom: 24px; }
    .detail-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
    .detail-header h3 { margin: 0; color: #1e293b; font-size: 16px; }
    .close-btn { border: none; background: #f1f5f9; width: 28px; height: 28px; border-radius: 50%; cursor: pointer; font-size: 14px; }
    .event-list { display: flex; flex-direction: column; gap: 8px; }
    .event-item { display: flex; align-items: center; gap: 12px; padding: 10px 14px; border-radius: 8px; background: #f8fafc; }
    .event-type-SESSION { border-left: 3px solid #3b82f6; }
    .event-type-PAYROLL { border-left: 3px solid #22c55e; }
    .event-type-TICKET_CREATED, .event-type-TICKET_DUE { border-left: 3px solid #f59e0b; }
    .event-icon { font-size: 20px; }
    .event-info { flex: 1; }
    .event-title { font-weight: 600; color: #334155; font-size: 13px; }
    .event-detail { color: #64748b; font-size: 12px; }
    .event-time { font-size: 11px; color: #94a3b8; font-family: monospace; }

    /* Timeline */
    .timeline { background: #fff; border-radius: 12px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
    .timeline h3 { margin: 0 0 16px; color: #1e293b; font-size: 16px; }
    .timeline-group { margin-bottom: 16px; }
    .timeline-date { font-weight: 700; color: #475569; font-size: 13px; padding: 6px 0; border-bottom: 1px solid #e2e8f0; margin-bottom: 8px; }
    .timeline-events { display: flex; flex-direction: column; gap: 6px; }
    .timeline-event { display: flex; align-items: center; gap: 10px; padding: 8px 12px; border-radius: 6px; background: #f8fafc; font-size: 13px; }
    .tl-icon { font-size: 16px; }
    .tl-info { flex: 1; display: flex; flex-direction: column; }
    .tl-title { font-weight: 600; color: #334155; }
    .tl-detail { font-size: 12px; color: #64748b; }

    .badge { padding: 2px 8px; border-radius: 99px; font-size: 11px; background: #e2e8f0; color: #475569; font-weight: 600; white-space: nowrap; }
    .badge[data-status="FINALIZED"], .badge[data-status="PAID"], .badge[data-status="RESOLVED"], .badge[data-status="CLOSED"] { background: #dcfce7; color: #16a34a; }
    .badge[data-status="SCHEDULED"], .badge[data-status="OPEN"] { background: #dbeafe; color: #2563eb; }
    .badge[data-status="CANCELLED"] { background: #fef2f2; color: #dc2626; }
    .badge[data-status="PENDING"], .badge[data-status="PENDING_REVIEW"], .badge[data-status="TEACHER_COMPLETED"], .badge[data-status="IN_PROGRESS"], .badge[data-status="DRAFT"] { background: #fef9c3; color: #ca8a04; }
    .badge[data-status="APPROVED"] { background: #dbeafe; color: #2563eb; }

    .empty { color: #94a3b8; font-style: italic; padding: 20px; text-align: center; }

    @media (max-width: 900px) {
      .stats-strip { grid-template-columns: repeat(3, 1fr); }
      .day-cell { min-height: 60px; padding: 4px; }
      .day-summary { display: none; }
    }
    @media (max-width: 600px) {
      .stats-strip { grid-template-columns: repeat(2, 1fr); }
      .calendar-page { padding: 16px; }
    }
  `]
})
export class CalendarOverviewComponent implements OnInit {
  data = signal<any>(null);
  loading = signal(false);
  error = signal('');
  selectedMonth = new Date().getMonth() + 1;
  selectedYear = new Date().getFullYear();
  eventFilter = 'ALL';
  selectedDateCell: any = null;

  dayHeaders = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
  months = [
    { value: 1, label: 'Tháng 1' }, { value: 2, label: 'Tháng 2' }, { value: 3, label: 'Tháng 3' },
    { value: 4, label: 'Tháng 4' }, { value: 5, label: 'Tháng 5' }, { value: 6, label: 'Tháng 6' },
    { value: 7, label: 'Tháng 7' }, { value: 8, label: 'Tháng 8' }, { value: 9, label: 'Tháng 9' },
    { value: 10, label: 'Tháng 10' }, { value: 11, label: 'Tháng 11' }, { value: 12, label: 'Tháng 12' },
  ];
  years: number[] = [];
  calendarCells: any[] = [];

  constructor(private dashboardService: DashboardService) {
    const now = new Date().getFullYear();
    for (let y = now - 2; y <= now + 2; y++) this.years.push(y);
  }

  ngOnInit() { this.load(); }

  async load() {
    this.loading.set(true);
    this.error.set('');
    this.selectedDateCell = null;
    try {
      const result = await this.dashboardService.getCalendarOverview(
        this.selectedMonth,
        this.selectedYear,
      );
      this.data.set(result);
      this.buildCalendarCells();
    } catch (e: any) {
      this.error.set(e?.error?.message || 'Lỗi tải lịch');
    } finally {
      this.loading.set(false);
    }
  }

  buildCalendarCells() {
    const d = this.data();
    if (!d) return;

    const year = this.selectedYear;
    const month = this.selectedMonth - 1; // 0-indexed
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDayOfWeek = firstDay.getDay(); // 0=Sun

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    const cells: any[] = [];

    // Prev month padding
    const prevMonthLast = new Date(year, month, 0);
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const day = prevMonthLast.getDate() - i;
      cells.push({ day, inMonth: false, isToday: false, events: [], summary: null, eventIndicators: [], dateStr: '' });
    }

    // Current month
    for (let d = 1; d <= lastDay.getDate(); d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const summary = this.data()?.dailySummary?.[dateStr] || null;
      const events = (this.data()?.events || []).filter((e: any) => e.date === dateStr);
      const eventIndicators = [...new Set(events.map((e: any) => e.type))];

      cells.push({
        day: d,
        inMonth: true,
        isToday: dateStr === todayStr,
        events,
        summary,
        eventIndicators,
        dateStr,
      });
    }

    // Next month padding
    const remaining = 42 - cells.length;
    for (let d = 1; d <= remaining; d++) {
      cells.push({ day: d, inMonth: false, isToday: false, events: [], summary: null, eventIndicators: [], dateStr: '' });
    }

    this.calendarCells = cells;
  }

  selectDate(cell: any) {
    if (!cell.inMonth || cell.events.length === 0) {
      this.selectedDateCell = null;
      return;
    }
    this.selectedDateCell = cell;
  }

  filteredEvents(): any[] {
    if (!this.selectedDateCell) return [];
    if (this.eventFilter === 'ALL') return this.selectedDateCell.events;
    return this.selectedDateCell.events.filter((e: any) => {
      if (this.eventFilter === 'TICKET') return e.type.startsWith('TICKET');
      return e.type === this.eventFilter;
    });
  }

  filteredAllEvents(): any[] {
    if (!this.data()) return [];
    const events = this.data().events || [];
    if (this.eventFilter === 'ALL') return events;
    return events.filter((e: any) => {
      if (this.eventFilter === 'TICKET') return e.type.startsWith('TICKET');
      return e.type === this.eventFilter;
    });
  }

  groupedEvents(): { date: string; events: any[] }[] {
    const events = this.filteredAllEvents();
    const groups = new Map<string, any[]>();
    for (const e of events) {
      if (!groups.has(e.date)) groups.set(e.date, []);
      groups.get(e.date)!.push(e);
    }
    return Array.from(groups.entries())
      .map(([date, events]) => ({ date, events }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  prevMonth() {
    if (this.selectedMonth === 1) {
      this.selectedMonth = 12;
      this.selectedYear--;
    } else {
      this.selectedMonth--;
    }
    this.load();
  }

  nextMonth() {
    if (this.selectedMonth === 12) {
      this.selectedMonth = 1;
      this.selectedYear++;
    } else {
      this.selectedMonth++;
    }
    this.load();
  }

  goToday() {
    const now = new Date();
    this.selectedMonth = now.getMonth() + 1;
    this.selectedYear = now.getFullYear();
    this.load();
  }

  formatDateLabel(dateStr: string): string {
    const d = new Date(dateStr);
    const days = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
    return `${days[d.getDay()]}, ${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
  }

  statusLabel(s: string): string {
    const map: Record<string, string> = {
      SCHEDULED: 'Đã lên lịch', TEACHER_COMPLETED: 'GV hoàn thành',
      PARENT_CONFIRMED: 'PH xác nhận', FINALIZED: 'Hoàn tất',
      CANCELLED: 'Đã hủy', NO_SHOW: 'Vắng', RESCHEDULED: 'Dời lịch',
      PAID: 'Đã trả', PENDING: 'Chờ duyệt', PENDING_REVIEW: 'Chờ duyệt',
      APPROVED: 'Đã duyệt', DRAFT: 'Nháp',
      OPEN: 'Mở', IN_PROGRESS: 'Đang xử lý', RESOLVED: 'Đã giải quyết', CLOSED: 'Đã đóng',
    };
    return map[s] || s;
  }
}
