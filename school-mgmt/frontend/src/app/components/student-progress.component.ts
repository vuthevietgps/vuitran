import { Component, signal, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { FlowGuideComponent } from './shared/flow-guide.component';

const HOMEWORK_STATUS_LABELS: Record<string, string> = {
  ASSIGNED: 'Đã giao', IN_PROGRESS: 'Đang làm', SUBMITTED: 'Đã nộp',
  GRADED: 'Đã chấm', LATE: 'Trễ hạn', MISSING: 'Chưa nộp',
};
const HOMEWORK_STATUS_COLORS: Record<string, string> = {
  ASSIGNED: '#3b82f6', IN_PROGRESS: '#f59e0b', SUBMITTED: '#8b5cf6',
  GRADED: '#10b981', LATE: '#ef4444', MISSING: '#dc2626',
};

@Component({
  selector: 'app-student-progress',
  standalone: true,
  imports: [CommonModule, FlowGuideComponent, RouterLink],
  template: `
  <header class="page-header">
    <div>
      <h2>Tiến trình học tập</h2>
      <p>Theo dõi kết quả và tiến độ học tập của con.</p>
    </div>
    <a routerLink="/app/parent-chat" class="support-link">Chat ho tro</a>
  </header>
  <app-flow-guide featureKey="student-progress"></app-flow-guide>

  <!-- Loading -->
  <div class="loading-box" *ngIf="loading()">
    Đang tải dữ liệu...
  </div>

  <!-- Error -->
  <p class="error" *ngIf="error()">{{ error() }}</p>

  <!-- No data -->
  <p class="empty-text" *ngIf="!loading() && !error() && students().length === 0">
    Chưa có dữ liệu tiến trình học tập.
  </p>

  <!-- Student tabs -->
  <section class="tabs" *ngIf="students().length > 1">
    <button *ngFor="let s of students(); let i = index"
            [class.active]="activeTab() === i"
            (click)="activeTab.set(i)">
      {{ s.studentName }}
    </button>
  </section>

  <!-- Student content -->
  <ng-container *ngIf="activeStudent() as student">

    <!-- Score cards -->
    <section class="score-cards">
      <div class="score-card performance">
        <div class="score-value">{{ student.evaluations?.averagePerformance ?? '-' }}</div>
        <div class="score-label">Điểm hiệu suất TB</div>
        <div class="score-bar">
          <div class="score-fill" [style.width.%]="student.evaluations?.averagePerformance ?? 0" [style.background]="'#2563eb'"></div>
        </div>
      </div>
      <div class="score-card engagement">
        <div class="score-value">{{ student.evaluations?.averageEngagement ?? '-' }}</div>
        <div class="score-label">Điểm tương tác TB</div>
        <div class="score-bar">
          <div class="score-fill" [style.width.%]="student.evaluations?.averageEngagement ?? 0" [style.background]="'#10b981'"></div>
        </div>
      </div>
      <div class="score-card comprehension">
        <div class="score-value">{{ student.evaluations?.averageComprehension ?? '-' }}</div>
        <div class="score-label">Điểm hiểu bài TB</div>
        <div class="score-bar">
          <div class="score-fill" [style.width.%]="student.evaluations?.averageComprehension ?? 0" [style.background]="'#f59e0b'"></div>
        </div>
      </div>
    </section>

    <!-- Progress section -->
    <section class="progress-section" *ngIf="student.progress">
      <h3>Tiến độ học tập</h3>
      <div class="progress-grid">
        <div class="progress-card">
          <div class="progress-header">
            <span>Buổi học đã hoàn thành</span>
            <strong>{{ student.progress.sessionsCompleted }} / {{ student.progress.sessionsTotal }}</strong>
          </div>
          <div class="progress-bar-track">
            <div class="progress-bar-fill"
                 [style.width.%]="student.progress.sessionsTotal ? (student.progress.sessionsCompleted / student.progress.sessionsTotal * 100) : 0"
                 [style.background]="'#2563eb'"></div>
          </div>
        </div>
        <div class="progress-card" *ngFor="let cls of student.progress.classes || []">
          <div class="progress-header">
            <span>{{ cls.className }}</span>
            <strong>{{ cls.completed }} / {{ cls.total }}</strong>
          </div>
          <div class="progress-bar-track">
            <div class="progress-bar-fill"
                 [style.width.%]="cls.total ? (cls.completed / cls.total * 100) : 0"
                 [style.background]="'#8b5cf6'"></div>
          </div>
          <div class="progress-percent">{{ cls.total ? (cls.completed / cls.total * 100 | number:'1.0-0') : 0 }}%</div>
        </div>
      </div>
    </section>

    <!-- Homework table -->
    <section class="homework-section">
      <h3>Bài tập về nhà</h3>
      <table class="data" *ngIf="student.homework?.length; else noHomework">
        <thead>
          <tr>
            <th>Chủ đề</th>
            <th>Ngày giao</th>
            <th>Hạn nộp</th>
            <th>Trạng thái</th>
            <th>Điểm</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let hw of student.homework">
            <td>{{ hw.topic }}</td>
            <td>{{ hw.assignedDate | date:'dd/MM/yyyy' }}</td>
            <td>{{ hw.dueDate | date:'dd/MM/yyyy' }}</td>
            <td>
              <span class="badge"
                    [style.background]="hwStatusColor(hw.status) + '20'"
                    [style.color]="hwStatusColor(hw.status)">
                {{ hwStatusLabel(hw.status) }}
              </span>
            </td>
            <td class="center">
              <strong *ngIf="hw.score != null">{{ hw.score }}</strong>
              <span *ngIf="hw.score == null">-</span>
            </td>
          </tr>
        </tbody>
      </table>
      <ng-template #noHomework>
        <p class="empty-text">Chưa có bài tập nào.</p>
      </ng-template>
    </section>

    <!-- Teacher comments -->
    <section class="comments-section" *ngIf="student.teacherComments?.length">
      <h3>Nhận xét gần đây từ giáo viên</h3>
      <div class="timeline">
        <div class="tl-item" *ngFor="let c of student.teacherComments">
          <div class="tl-date">{{ c.date | date:'dd/MM/yyyy' }}</div>
          <div class="tl-teacher" *ngIf="c.teacherName">{{ c.teacherName }}</div>
          <div class="tl-class" *ngIf="c.className">Lớp: {{ c.className }}</div>
          <div class="tl-content">{{ c.comment }}</div>
        </div>
      </div>
    </section>

  </ng-container>
  `,
  styles: [`
    .page-header { display:flex; justify-content:space-between; align-items:center; gap:12px; padding:16px; }
    .page-header h2 { margin:0; color:#0f172a; }
    .page-header p { margin:4px 0 0; color:#64748b; font-size:13px; }
    .support-link {
      display:inline-flex; align-items:center; justify-content:center; padding:10px 16px;
      border-radius:999px; background:#0f766e; color:#fff; text-decoration:none; font-size:13px; font-weight:600;
      white-space:nowrap;
    }
    .support-link:hover { background:#115e59; }
    .loading-box { padding:32px; text-align:center; color:#64748b; font-size:14px; }
    .error { color:#dc2626; font-size:13px; padding:0 16px; }
    .empty-text { padding:16px; color:#64748b; font-size:13px; }

    /* Tabs */
    .tabs { display:flex; gap:4px; padding:0 16px 12px; flex-wrap:wrap; }
    .tabs button { background:#f1f5f9; border:1px solid #e2e8f0; padding:8px 16px; border-radius:6px; cursor:pointer; font-size:13px; font-weight:500; }
    .tabs button.active { background:#2563eb; color:#fff; border-color:#2563eb; }
    .tabs button:hover:not(.active) { background:#e2e8f0; }

    /* Score cards */
    .score-cards { display:grid; grid-template-columns:repeat(3, 1fr); gap:16px; padding:0 16px 16px; }
    .score-card { background:#fff; padding:16px 20px; border-radius:8px; border-left:4px solid #e2e8f0; }
    .score-card.performance { border-left-color:#2563eb; }
    .score-card.engagement { border-left-color:#10b981; }
    .score-card.comprehension { border-left-color:#f59e0b; }
    .score-value { font-size:28px; font-weight:700; color:#0f172a; }
    .score-label { font-size:12px; color:#64748b; margin-top:2px; }
    .score-bar { height:6px; background:#e2e8f0; border-radius:3px; margin-top:10px; overflow:hidden; }
    .score-fill { height:100%; border-radius:3px; transition:width 0.5s ease; }

    /* Progress section */
    .progress-section { padding:0 16px 16px; }
    .progress-section h3 { margin:0 0 12px; color:#334155; font-size:15px; }
    .progress-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(280px, 1fr)); gap:12px; }
    .progress-card { background:#fff; padding:14px 16px; border-radius:8px; }
    .progress-header { display:flex; justify-content:space-between; align-items:center; font-size:13px; color:#334155; margin-bottom:8px; }
    .progress-bar-track { height:8px; background:#e2e8f0; border-radius:4px; overflow:hidden; }
    .progress-bar-fill { height:100%; border-radius:4px; transition:width 0.5s ease; }
    .progress-percent { font-size:11px; color:#64748b; text-align:right; margin-top:4px; }

    /* Homework table */
    .homework-section { padding:0 16px 16px; }
    .homework-section h3 { margin:0 0 12px; color:#334155; font-size:15px; }
    .data { width:100%; border-collapse:collapse; background:#fff; font-size:13px; }
    th, td { padding:8px 10px; border:1px solid #e2e8f0; }
    thead { background:#f1f5f9; font-size:12px; text-transform:uppercase; color:#64748b; }
    .center { text-align:center; }
    .badge { font-size:11px; padding:2px 8px; border-radius:9px; font-weight:600; white-space:nowrap; }

    /* Teacher comments */
    .comments-section { padding:0 16px 16px; }
    .comments-section h3 { margin:0 0 12px; color:#334155; font-size:15px; }
    .timeline { margin:0; }
    .tl-item { padding:10px 14px; border-left:2px solid #2563eb; margin-bottom:10px; background:#fff; border-radius:0 6px 6px 0; }
    .tl-date { font-size:11px; color:#64748b; }
    .tl-teacher { font-weight:600; font-size:13px; color:#0f172a; margin-top:2px; }
    .tl-class { font-size:11px; color:#8b5cf6; margin-top:1px; }
    .tl-content { font-size:13px; color:#334155; margin-top:4px; line-height:1.5; }

    @media (max-width: 768px) {
      .page-header { flex-direction:column; align-items:flex-start; }
      .score-cards { grid-template-columns:1fr; }
      .progress-grid { grid-template-columns:1fr; }
    }
  `]
})
export class StudentProgressComponent implements OnInit {
  private http = inject(HttpClient);

  data = signal<any>(null);
  students = signal<any[]>([]);
  activeTab = signal(0);
  loading = signal(false);
  error = signal('');

  activeStudent = () => {
    const list = this.students();
    const idx = this.activeTab();
    return list.length > idx ? list[idx] : null;
  };

  ngOnInit() {
    this.loadProgress();
  }

  async loadProgress() {
    this.loading.set(true);
    this.error.set('');
    try {
      const res = await firstValueFrom(
        this.http.get<any>(`${environment.apiBase}/sessions/my-children/progress`, { withCredentials: true })
      );
      this.data.set(res);
      this.students.set(res.students || res.children || (Array.isArray(res) ? res : []));
    } catch (err: any) {
      this.error.set(err?.error?.message || err?.message || 'Không thể tải dữ liệu tiến trình học tập.');
    } finally {
      this.loading.set(false);
    }
  }

  hwStatusLabel(s: string): string {
    return HOMEWORK_STATUS_LABELS[s] || s;
  }

  hwStatusColor(s: string): string {
    return HOMEWORK_STATUS_COLORS[s] || '#64748b';
  }
}
