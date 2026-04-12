import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import { ClassItem, ClassService } from '../services/class.service';
import { DashboardService } from '../services/dashboard.service';
import { UserItem, UserService } from '../services/user.service';
import { FlowGuideComponent } from './shared/flow-guide.component';

@Component({
  selector: 'app-calendar-overview',
  standalone: true,
  imports: [CommonModule, FormsModule, FlowGuideComponent],
  template: `
  <app-flow-guide featureKey="calendar-overview"></app-flow-guide>
  <div class="calendar-page">
    <div class="header">
      <h2>Lich tong quan</h2>
      <div class="month-nav">
        <button class="nav-btn" data-testid="calendar-prev-month" (click)="prevMonth()">&laquo;</button>
        <select data-testid="calendar-month-select" [(ngModel)]="selectedMonth" (change)="onCalendarWindowChange()">
          <option *ngFor="let m of months" [ngValue]="m.value">{{ m.label }}</option>
        </select>
        <select data-testid="calendar-year-select" [(ngModel)]="selectedYear" (change)="onCalendarWindowChange()">
          <option *ngFor="let y of years" [ngValue]="y">{{ y }}</option>
        </select>
        <button class="nav-btn" data-testid="calendar-next-month" (click)="nextMonth()">&raquo;</button>
        <button class="today-btn" data-testid="calendar-go-today" (click)="goToday()">Hom nay</button>
      </div>
    </div>

    <div class="filter-toolbar" data-testid="calendar-filter-toolbar">
      <label class="filter-control">
        <span>Chon Giao Vien</span>
        <select
          data-testid="calendar-teacher-filter"
          [(ngModel)]="selectedTeacherId"
          (change)="onEntityFilterChange()"
        >
          <option value="">Tat ca giao vien</option>
          <option *ngFor="let teacher of teachers()" [value]="teacher._id">
            {{ teacher.fullName }}
          </option>
        </select>
      </label>

      <label class="filter-control">
        <span>Chon Lop Hoc</span>
        <select
          data-testid="calendar-class-filter"
          [(ngModel)]="selectedClassId"
          (change)="onEntityFilterChange()"
        >
          <option value="">Tat ca lop hoc</option>
          <option *ngFor="let classroom of classOptions()" [value]="classroom._id">
            {{ classroom.name }}<ng-container *ngIf="classroom.code"> ({{ classroom.code }})</ng-container>
          </option>
        </select>
      </label>
    </div>

    <div *ngIf="loading()" class="loading">Dang tai lich...</div>
    <div *ngIf="error()" class="error">{{ error() }}</div>

    <div *ngIf="data()" class="stats-strip">
      <div class="stat-card blue" data-testid="calendar-stat-total-sessions">
        <span class="stat-val">{{ data()!.totalSessions }}</span>
        <span class="stat-lbl">Tong buoi hoc</span>
      </div>
      <div class="stat-card green">
        <span class="stat-val">{{ data()!.byStatus['FINALIZED'] || 0 }}</span>
        <span class="stat-lbl">Hoan thanh</span>
      </div>
      <div class="stat-card orange">
        <span class="stat-val">{{ data()!.byStatus['SCHEDULED'] || 0 }}</span>
        <span class="stat-lbl">Da len lich</span>
      </div>
      <div class="stat-card red">
        <span class="stat-val">{{ data()!.byStatus['CANCELLED'] || 0 }}</span>
        <span class="stat-lbl">Da huy</span>
      </div>
      <div class="stat-card purple">
        <span class="stat-val">{{ data()!.payrolls?.length || 0 }}</span>
        <span class="stat-lbl">Bang luong</span>
      </div>
      <div class="stat-card gray">
        <span class="stat-val">{{ data()!.tickets?.length || 0 }}</span>
        <span class="stat-lbl">Ticket</span>
      </div>
    </div>

    <div *ngIf="data()" class="filter-tabs">
      <button [class.active]="eventFilter === 'ALL'" (click)="eventFilter = 'ALL'">Tat ca</button>
      <button [class.active]="eventFilter === 'SESSION'" (click)="eventFilter = 'SESSION'">Buoi hoc</button>
      <button [class.active]="eventFilter === 'PAYROLL'" (click)="eventFilter = 'PAYROLL'">Bang luong</button>
      <button [class.active]="eventFilter === 'TICKET'" (click)="eventFilter = 'TICKET'">Ticket</button>
    </div>

    <div *ngIf="data()" class="calendar-grid">
      <div class="day-header" *ngFor="let dh of dayHeaders">{{ dh }}</div>
      <div *ngFor="let cell of calendarCells" class="day-cell"
           [class.other-month]="!cell.inMonth"
           [class.today]="cell.isToday"
           [class.has-events]="cell.events.length > 0"
           (click)="selectDate(cell)">
        <div class="day-num">{{ cell.day }}</div>
        <div *ngIf="cell.summary && cell.inMonth" class="day-summary">
          <span *ngIf="cell.summary.sessions" class="dot blue" title="Buoi hoc">{{ cell.summary.sessions }}</span>
          <span *ngIf="cell.summary.completed" class="dot green" title="Hoan thanh">{{ cell.summary.completed }}</span>
          <span *ngIf="cell.summary.cancelled" class="dot red" title="Da huy">{{ cell.summary.cancelled }}</span>
        </div>
        <div *ngIf="cell.eventIndicators.length > 0 && cell.inMonth" class="event-indicators">
          <span *ngFor="let ind of cell.eventIndicators.slice(0, 3)" class="event-dot" [class]="'dot-' + ind"></span>
          <span *ngIf="cell.eventIndicators.length > 3" class="more-dots">+{{ cell.eventIndicators.length - 3 }}</span>
        </div>
      </div>
    </div>

    <div *ngIf="selectedDateCell && selectedDateCell.events.length > 0" class="date-detail">
      <div class="detail-header">
        <h3>{{ selectedDateCell.dateStr }} - {{ selectedDateCell.events.length }} su kien</h3>
        <button class="close-btn" (click)="selectedDateCell = null">x</button>
      </div>
      <div class="event-list">
        <div *ngFor="let ev of filteredEvents()"
             class="event-item"
             [class]="'event-type-' + ev.type"
             [attr.data-testid]="'calendar-selected-event-' + ev._id">
          <div class="event-icon">
            <span *ngIf="ev.type === 'SESSION'">SS</span>
            <span *ngIf="ev.type === 'PAYROLL'">$$</span>
            <span *ngIf="ev.type === 'TICKET_CREATED'">TK</span>
            <span *ngIf="ev.type === 'TICKET_DUE'">!!</span>
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

    <div *ngIf="data() && !selectedDateCell" class="timeline" data-testid="calendar-timeline">
      <h3>Su kien trong thang</h3>
      <div *ngIf="filteredAllEvents().length === 0" class="empty" data-testid="calendar-empty-state">Khong co su kien nao</div>
      <div *ngFor="let group of groupedEvents()" class="timeline-group">
        <div class="timeline-date">{{ formatDateLabel(group.date) }}</div>
        <div class="timeline-events">
          <div *ngFor="let ev of group.events"
               class="timeline-event"
               [class]="'event-type-' + ev.type"
               [attr.data-testid]="'calendar-event-' + ev._id">
            <div class="tl-icon">
              <span *ngIf="ev.type === 'SESSION'">SS</span>
              <span *ngIf="ev.type === 'PAYROLL'">$$</span>
              <span *ngIf="ev.type === 'TICKET_CREATED'">TK</span>
              <span *ngIf="ev.type === 'TICKET_DUE'">!!</span>
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
    .filter-toolbar { display: flex; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; padding: 14px; border: 1px solid #e2e8f0; border-radius: 12px; background: #fff; }
    .filter-control { display: flex; flex-direction: column; gap: 6px; min-width: 220px; flex: 1; }
    .filter-control span { color: #475569; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.03em; }
    .filter-control select { width: 100%; padding: 10px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 14px; background: #fff; color: #0f172a; }
    .loading { text-align: center; padding: 40px; color: #64748b; }
    .error { background: #fef2f2; color: #dc2626; padding: 12px; border-radius: 8px; margin-bottom: 16px; }
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
    .filter-tabs { display: flex; gap: 4px; margin-bottom: 16px; }
    .filter-tabs button { padding: 6px 16px; border: 1px solid #cbd5e1; background: #fff; cursor: pointer; font-size: 13px; border-radius: 6px; }
    .filter-tabs button.active { background: #2563eb; color: #fff; border-color: #2563eb; }
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
    .date-detail { background: #fff; border-radius: 12px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); margin-bottom: 24px; }
    .detail-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
    .detail-header h3 { margin: 0; color: #1e293b; font-size: 16px; }
    .close-btn { border: none; background: #f1f5f9; width: 28px; height: 28px; border-radius: 50%; cursor: pointer; font-size: 14px; }
    .event-list { display: flex; flex-direction: column; gap: 8px; }
    .event-item { display: flex; align-items: center; gap: 12px; padding: 10px 14px; border-radius: 8px; background: #f8fafc; }
    .event-type-SESSION { border-left: 3px solid #3b82f6; }
    .event-type-PAYROLL { border-left: 3px solid #22c55e; }
    .event-type-TICKET_CREATED, .event-type-TICKET_DUE { border-left: 3px solid #f59e0b; }
    .event-icon { font-size: 12px; font-weight: 700; color: #1e293b; min-width: 22px; }
    .event-info { flex: 1; }
    .event-title { font-weight: 600; color: #334155; font-size: 13px; }
    .event-detail { color: #64748b; font-size: 12px; }
    .event-time { font-size: 11px; color: #94a3b8; font-family: monospace; }
    .timeline { background: #fff; border-radius: 12px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
    .timeline h3 { margin: 0 0 16px; color: #1e293b; font-size: 16px; }
    .timeline-group { margin-bottom: 16px; }
    .timeline-date { font-weight: 700; color: #475569; font-size: 13px; padding: 6px 0; border-bottom: 1px solid #e2e8f0; margin-bottom: 8px; }
    .timeline-events { display: flex; flex-direction: column; gap: 6px; }
    .timeline-event { display: flex; align-items: center; gap: 10px; padding: 8px 12px; border-radius: 6px; background: #f8fafc; font-size: 13px; }
    .tl-icon { font-size: 12px; font-weight: 700; color: #1e293b; min-width: 22px; }
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
      .filter-control { min-width: 100%; }
    }
    @media (max-width: 600px) {
      .stats-strip { grid-template-columns: repeat(2, 1fr); }
      .calendar-page { padding: 16px; }
      .month-nav { width: 100%; flex-wrap: wrap; }
      .month-nav select, .today-btn { flex: 1; }
    }
  `],
})
export class CalendarOverviewComponent implements OnInit {
  private readonly dashboardService = inject(DashboardService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly userService = inject(UserService);
  private readonly classService = inject(ClassService);

  data = signal<any>(null);
  loading = signal(false);
  error = signal('');
  teachers = signal<UserItem[]>([]);
  classOptions = signal<ClassItem[]>([]);

  selectedMonth = new Date().getMonth() + 1;
  selectedYear = new Date().getFullYear();
  selectedTeacherId = '';
  selectedClassId = '';
  eventFilter = 'ALL';
  selectedDateCell: any = null;

  dayHeaders = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
  months = [
    { value: 1, label: 'Thang 1' }, { value: 2, label: 'Thang 2' }, { value: 3, label: 'Thang 3' },
    { value: 4, label: 'Thang 4' }, { value: 5, label: 'Thang 5' }, { value: 6, label: 'Thang 6' },
    { value: 7, label: 'Thang 7' }, { value: 8, label: 'Thang 8' }, { value: 9, label: 'Thang 9' },
    { value: 10, label: 'Thang 10' }, { value: 11, label: 'Thang 11' }, { value: 12, label: 'Thang 12' },
  ];
  years: number[] = [];
  calendarCells: any[] = [];
  private lastQueryState = '';

  constructor() {
    const now = new Date().getFullYear();
    for (let y = now - 2; y <= now + 2; y++) this.years.push(y);
  }

  ngOnInit() {
    void this.bootstrap();
  }

  async load() {
    this.loading.set(true);
    this.error.set('');
    this.selectedDateCell = null;
    try {
      const result = await this.dashboardService.getCalendarOverview(
        this.selectedMonth,
        this.selectedYear,
        this.selectedTeacherId || undefined,
        this.selectedClassId || undefined,
      );
      this.data.set(result);
      this.buildCalendarCells();
    } catch (e: any) {
      this.error.set(e?.error?.message || 'Loi tai lich');
    } finally {
      this.loading.set(false);
    }
  }

  buildCalendarCells() {
    const d = this.data();
    if (!d) return;

    const year = this.selectedYear;
    const month = this.selectedMonth - 1;
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDayOfWeek = firstDay.getDay();
    const todayStr = new Date().toISOString().split('T')[0];
    const cells: any[] = [];

    const prevMonthLast = new Date(year, month, 0);
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const day = prevMonthLast.getDate() - i;
      cells.push({ day, inMonth: false, isToday: false, events: [], summary: null, eventIndicators: [], dateStr: '' });
    }

    for (let day = 1; day <= lastDay.getDate(); day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const summary = this.data()?.dailySummary?.[dateStr] || null;
      const events = (this.data()?.events || []).filter((event: any) => event.date === dateStr);
      const eventIndicators = [...new Set(events.map((event: any) => event.type))];

      cells.push({
        day,
        inMonth: true,
        isToday: dateStr === todayStr,
        events,
        summary,
        eventIndicators,
        dateStr,
      });
    }

    const remaining = 42 - cells.length;
    for (let day = 1; day <= remaining; day++) {
      cells.push({ day, inMonth: false, isToday: false, events: [], summary: null, eventIndicators: [], dateStr: '' });
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
    return this.selectedDateCell.events.filter((event: any) => {
      if (this.eventFilter === 'TICKET') return event.type.startsWith('TICKET');
      return event.type === this.eventFilter;
    });
  }

  filteredAllEvents(): any[] {
    if (!this.data()) return [];
    const events = this.data().events || [];
    if (this.eventFilter === 'ALL') return events;
    return events.filter((event: any) => {
      if (this.eventFilter === 'TICKET') return event.type.startsWith('TICKET');
      return event.type === this.eventFilter;
    });
  }

  groupedEvents(): { date: string; events: any[] }[] {
    const groups = new Map<string, any[]>();
    for (const event of this.filteredAllEvents()) {
      if (!groups.has(event.date)) groups.set(event.date, []);
      groups.get(event.date)!.push(event);
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
    void this.syncQueryParams();
  }

  nextMonth() {
    if (this.selectedMonth === 12) {
      this.selectedMonth = 1;
      this.selectedYear++;
    } else {
      this.selectedMonth++;
    }
    void this.syncQueryParams();
  }

  goToday() {
    const now = new Date();
    this.selectedMonth = now.getMonth() + 1;
    this.selectedYear = now.getFullYear();
    void this.syncQueryParams();
  }

  onCalendarWindowChange() {
    void this.syncQueryParams();
  }

  onEntityFilterChange() {
    void this.syncQueryParams();
  }

  formatDateLabel(dateStr: string): string {
    const date = new Date(dateStr);
    const days = ['Chu nhat', 'Thu 2', 'Thu 3', 'Thu 4', 'Thu 5', 'Thu 6', 'Thu 7'];
    return `${days[date.getDay()]}, ${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
  }

  statusLabel(status: string): string {
    const map: Record<string, string> = {
      SCHEDULED: 'Da len lich',
      TEACHER_COMPLETED: 'GV hoan thanh',
      PARENT_CONFIRMED: 'PH xac nhan',
      FINALIZED: 'Hoan tat',
      CANCELLED: 'Da huy',
      NO_SHOW: 'Vang',
      RESCHEDULED: 'Doi lich',
      PAID: 'Da tra',
      PENDING: 'Cho duyet',
      PENDING_REVIEW: 'Cho duyet',
      APPROVED: 'Da duyet',
      DRAFT: 'Nhap',
      OPEN: 'Mo',
      IN_PROGRESS: 'Dang xu ly',
      RESOLVED: 'Da giai quyet',
      CLOSED: 'Da dong',
    };
    return map[status] || status;
  }

  private async bootstrap() {
    await this.loadFilterOptions();
    this.route.queryParamMap.subscribe((params) => {
      const queryState = this.buildQueryState(params);
      const shouldReload = queryState !== this.lastQueryState || !this.data();
      this.lastQueryState = queryState;
      this.applyQueryParams(params);
      if (this.normalizeSelectedFilters()) {
        void this.syncQueryParams();
        return;
      }
      if (shouldReload) {
        void this.load();
      }
    });
  }

  private async loadFilterOptions() {
    const [teachers, classes] = await Promise.all([
      this.userService.listTeachers(),
      this.classService.list(),
    ]);

    this.teachers.set(
      [...teachers].sort((left, right) => left.fullName.localeCompare(right.fullName)),
    );
    this.classOptions.set(
      [...classes].sort((left, right) => `${left.name}${left.code || ''}`.localeCompare(`${right.name}${right.code || ''}`)),
    );
  }

  private applyQueryParams(params: ParamMap): boolean {
    const nextMonth = this.parseCalendarNumber(params.get('month'), new Date().getMonth() + 1, 1, 12);
    const nextYear = this.parseCalendarNumber(params.get('year'), new Date().getFullYear(), 2000, 2100);
    const nextTeacherId = params.get('teacherId') || '';
    const nextClassId = params.get('classId') || '';

    const changed =
      nextMonth !== this.selectedMonth
      || nextYear !== this.selectedYear
      || nextTeacherId !== this.selectedTeacherId
      || nextClassId !== this.selectedClassId;

    this.selectedMonth = nextMonth;
    this.selectedYear = nextYear;
    this.selectedTeacherId = nextTeacherId;
    this.selectedClassId = nextClassId;
    return changed;
  }

  private buildQueryState(params: ParamMap): string {
    return [
      params.get('month') || '',
      params.get('year') || '',
      params.get('teacherId') || '',
      params.get('classId') || '',
    ].join('|');
  }

  private normalizeSelectedFilters(): boolean {
    let changed = false;
    const teachers = this.teachers();
    const classes = this.classOptions();

    if (
      this.selectedTeacherId
      && teachers.length > 0
      && !teachers.some((teacher) => teacher._id === this.selectedTeacherId)
    ) {
      this.selectedTeacherId = '';
      changed = true;
    }

    if (
      this.selectedClassId
      && classes.length > 0
      && !classes.some((classroom) => classroom._id === this.selectedClassId)
    ) {
      this.selectedClassId = '';
      changed = true;
    }

    return changed;
  }

  private parseCalendarNumber(value: string | null, fallback: number, min: number, max: number): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
      return fallback;
    }
    return Math.trunc(parsed);
  }

  private async syncQueryParams() {
    const month = String(this.selectedMonth);
    const year = String(this.selectedYear);
    const teacherId = this.selectedTeacherId || null;
    const classId = this.selectedClassId || null;
    const current = this.route.snapshot.queryParamMap;
    const isUnchanged =
      current.get('month') === month
      && current.get('year') === year
      && (current.get('teacherId') || null) === teacherId
      && (current.get('classId') || null) === classId;

    if (isUnchanged) {
      await this.load();
      return;
    }

    await this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        month,
        year,
        teacherId,
        classId,
      },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
}
