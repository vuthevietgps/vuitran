import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { AuthService } from '../../services/auth.service';
import { DailyTaskBoard, DailyTaskItem, DashboardService } from '../../services/dashboard.service';

@Component({
  selector: 'app-daily-task-tabs',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <section class="task-board" *ngIf="shouldRender()">
      <div class="board-shell">
        <div class="board-header">
          <div class="header-copy">
            <p class="eyebrow">Viec trong ngay</p>
            <h3>Danh sach can xu ly theo tai khoan</h3>
            <p>
              Bang nay gom viec can mo module de xu ly ngay, khong chi la KPI thong ke.
            </p>
          </div>

          <div class="summary-grid" *ngIf="board() as data">
            <article class="summary-card">
              <span class="summary-label">Tong viec</span>
              <strong>{{ data.summary.totalTasks }}</strong>
            </article>
            <article class="summary-card">
              <span class="summary-label">Uu tien cao</span>
              <strong>{{ data.summary.highPriorityTasks }}</strong>
            </article>
            <article class="summary-card">
              <span class="summary-label">Qua han</span>
              <strong>{{ data.summary.overdueTasks }}</strong>
            </article>
            <article class="summary-card">
              <span class="summary-label">Hom nay</span>
              <strong>{{ data.summary.dueTodayTasks }}</strong>
            </article>
          </div>
        </div>

        <div class="loading-state" *ngIf="loading()">Dang tai danh sach cong viec...</div>
        <div class="error-state" *ngIf="error()">{{ error() }}</div>

        <ng-container *ngIf="board() as data">
          <div class="tabs" *ngIf="data.tabs.length > 0">
            <button
              *ngFor="let tab of data.tabs"
              type="button"
              [class.active]="activeTabKey() === tab.key"
              (click)="activeTabKey.set(tab.key)">
              <span>{{ tab.label }}</span>
              <span class="tab-count">{{ tab.count }}</span>
            </button>
          </div>

          <section class="tab-panel" *ngIf="activeTab() as tab">
            <div class="panel-header">
              <div>
                <h4>{{ tab.label }}</h4>
                <p>{{ tab.description }}</p>
              </div>
              <span class="panel-count">{{ tab.count }} viec</span>
            </div>

            <div class="empty-state" *ngIf="tab.tasks.length === 0">{{ tab.emptyMessage }}</div>

            <div class="table-scroll" *ngIf="tab.tasks.length > 0">
              <table class="task-table">
                <thead>
                  <tr>
                    <th>Cong viec</th>
                    <th>Uu tien</th>
                    <th>Han xu ly</th>
                    <th>Mo chuc nang</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let task of tab.tasks">
                    <td>
                      <div class="task-title">{{ task.title }}</div>
                      <div class="task-detail" *ngIf="task.detail">{{ task.detail }}</div>
                      <div class="task-meta" *ngIf="task.meta?.length">{{ task.meta!.join(' · ') }}</div>
                    </td>
                    <td>
                      <span class="priority-chip" [attr.data-priority]="task.priority">
                        {{ priorityLabel(task.priority) }}
                      </span>
                    </td>
                    <td>
                      <span class="due-chip" [class.overdue]="task.overdue">
                        {{ dueLabel(task) }}
                      </span>
                    </td>
                    <td>
                      <a
                        class="open-link"
                        [routerLink]="task.route"
                        [queryParams]="task.queryParams || null">
                        {{ task.actionLabel || 'Mo man hinh' }}
                      </a>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </ng-container>
      </div>
    </section>
  `,
  styles: [`
    :host {
      display: block;
      margin-bottom: 18px;
    }

    .board-shell {
      border-radius: 24px;
      border: 1px solid rgba(15, 118, 110, 0.12);
      background:
        radial-gradient(circle at top right, rgba(245, 158, 11, 0.16), transparent 24%),
        linear-gradient(135deg, #ffffff 0%, #f8fafc 48%, #ecfeff 100%);
      box-shadow: 0 18px 36px rgba(15, 23, 42, 0.08);
      padding: 22px;
    }

    .board-header {
      display: flex;
      justify-content: space-between;
      gap: 18px;
      align-items: flex-start;
      margin-bottom: 18px;
    }

    .header-copy {
      max-width: 720px;
    }

    .eyebrow {
      margin: 0 0 8px;
      color: #0f766e;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.14em;
      text-transform: uppercase;
    }

    h3,
    h4 {
      margin: 0;
      color: #0f172a;
      letter-spacing: -0.03em;
    }

    h3 {
      font-size: 26px;
      margin-bottom: 8px;
    }

    h4 {
      font-size: 18px;
      margin-bottom: 6px;
    }

    p {
      margin: 0;
      color: #475569;
      line-height: 1.6;
      font-size: 14px;
    }

    .summary-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(110px, 1fr));
      gap: 10px;
      min-width: 260px;
    }

    .summary-card {
      border-radius: 18px;
      padding: 14px;
      background: rgba(255, 255, 255, 0.88);
      border: 1px solid rgba(148, 163, 184, 0.18);
      display: grid;
      gap: 4px;
    }

    .summary-label {
      color: #64748b;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    .summary-card strong {
      color: #0f172a;
      font-size: 24px;
    }

    .tabs {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 16px;
    }

    .tabs button {
      border: 1px solid rgba(148, 163, 184, 0.28);
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.92);
      color: #334155;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      min-height: 40px;
      padding: 0 14px;
      font-size: 13px;
      font-weight: 700;
      transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
    }

    .tabs button:hover {
      transform: translateY(-1px);
      border-color: rgba(15, 118, 110, 0.3);
      box-shadow: 0 10px 20px rgba(15, 23, 42, 0.06);
    }

    .tabs button.active {
      border-color: transparent;
      background: linear-gradient(135deg, #0f766e 0%, #115e59 100%);
      color: #fff;
      box-shadow: 0 12px 24px rgba(15, 118, 110, 0.18);
    }

    .tab-count,
    .panel-count {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 28px;
      height: 28px;
      padding: 0 10px;
      border-radius: 999px;
      background: rgba(15, 23, 42, 0.08);
      color: inherit;
      font-size: 12px;
      font-weight: 800;
    }

    .tabs button.active .tab-count {
      background: rgba(255, 255, 255, 0.18);
    }

    .tab-panel {
      border-radius: 20px;
      background: rgba(255, 255, 255, 0.94);
      border: 1px solid rgba(148, 163, 184, 0.16);
      padding: 18px;
    }

    .panel-header {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: flex-start;
      margin-bottom: 14px;
    }

    .loading-state,
    .empty-state {
      color: #64748b;
      padding: 10px 0;
      font-size: 14px;
    }

    .error-state {
      color: #b91c1c;
      background: #fef2f2;
      border: 1px solid #fecaca;
      border-radius: 16px;
      padding: 12px 14px;
      margin-bottom: 14px;
      font-size: 14px;
    }

    .table-scroll {
      overflow-x: auto;
    }

    .task-table {
      width: 100%;
      border-collapse: collapse;
      min-width: 780px;
    }

    .task-table th,
    .task-table td {
      padding: 12px 10px;
      border-bottom: 1px solid #e2e8f0;
      text-align: left;
      vertical-align: top;
      font-size: 13px;
    }

    .task-table th {
      color: #64748b;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }

    .task-title {
      color: #0f172a;
      font-size: 14px;
      font-weight: 700;
      margin-bottom: 4px;
    }

    .task-detail {
      color: #334155;
      margin-bottom: 4px;
    }

    .task-meta {
      color: #64748b;
      font-size: 12px;
    }

    .priority-chip,
    .due-chip {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 28px;
      padding: 0 10px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 700;
      white-space: nowrap;
    }

    .priority-chip[data-priority="CRITICAL"],
    .priority-chip[data-priority="HIGH"] {
      background: #fef2f2;
      color: #b91c1c;
    }

    .priority-chip[data-priority="MEDIUM"] {
      background: #fef9c3;
      color: #a16207;
    }

    .priority-chip[data-priority="LOW"] {
      background: #e2e8f0;
      color: #475569;
    }

    .due-chip {
      background: #e2e8f0;
      color: #334155;
    }

    .due-chip.overdue {
      background: #fee2e2;
      color: #b91c1c;
    }

    .open-link {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 34px;
      padding: 0 12px;
      border-radius: 999px;
      background: #0f172a;
      color: #fff;
      font-weight: 700;
      text-decoration: none;
      white-space: nowrap;
    }

    @media (max-width: 960px) {
      .board-header,
      .panel-header {
        flex-direction: column;
      }

      .summary-grid {
        width: 100%;
        min-width: 0;
      }
    }
  `],
})
export class DailyTaskTabsComponent implements OnInit {
  private readonly dashboardService = inject(DashboardService);
  private readonly auth = inject(AuthService);

  readonly board = signal<DailyTaskBoard | null>(null);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly activeTabKey = signal('');
  readonly role = computed(() => this.auth.userSignal()?.role || '');
  readonly shouldRender = computed(() => Boolean(this.role()));
  readonly activeTab = computed(() => {
    const data = this.board();
    const key = this.activeTabKey();
    return data?.tabs.find((tab) => tab.key === key) || data?.tabs[0] || null;
  });

  async ngOnInit(): Promise<void> {
    if (!this.shouldRender()) {
      return;
    }

    await this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      const data = await this.dashboardService.getDailyTasks();
      this.board.set(data);
      this.activeTabKey.set(data.tabs[0]?.key || '');
    } catch (error: any) {
      this.error.set(error?.error?.message || 'Khong the tai danh sach viec trong ngay.');
    } finally {
      this.loading.set(false);
    }
  }

  priorityLabel(priority: DailyTaskItem['priority']): string {
    switch (priority) {
      case 'CRITICAL':
        return 'Rat gap';
      case 'HIGH':
        return 'Cao';
      case 'MEDIUM':
        return 'Trung binh';
      default:
        return 'Thong thuong';
    }
  }

  dueLabel(task: DailyTaskItem): string {
    if (task.overdue) {
      return 'Qua han';
    }

    if (!task.dueAt) {
      return 'Xu ly trong ngay';
    }

    const due = new Date(task.dueAt);
    if (Number.isNaN(due.getTime())) {
      return 'Trong ngay';
    }

    const today = this.startOfDay(new Date());
    const tomorrow = this.addDays(today, 1);

    if (this.isSameDay(due, today)) {
      return `Hom nay ${this.formatTime(due)}`;
    }

    if (this.isSameDay(due, tomorrow)) {
      return `Ngay mai ${this.formatTime(due)}`;
    }

    return `${due.toLocaleDateString('vi-VN')} ${this.formatTime(due)}`;
  }

  private startOfDay(date: Date): Date {
    const clone = new Date(date);
    clone.setHours(0, 0, 0, 0);
    return clone;
  }

  private addDays(date: Date, days: number): Date {
    const clone = new Date(date);
    clone.setDate(clone.getDate() + days);
    return clone;
  }

  private isSameDay(value: Date, reference: Date): boolean {
    const start = this.startOfDay(reference);
    const end = this.addDays(start, 1);
    return value >= start && value < end;
  }

  private formatTime(date: Date): string {
    return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  }
}
