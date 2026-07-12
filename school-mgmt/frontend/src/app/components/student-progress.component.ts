import { Component, signal, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { FlowGuideComponent } from './shared/flow-guide.component';
import { HomeworkAttachment, SessionService } from '../services/session.service';

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
  imports: [CommonModule, FormsModule, FlowGuideComponent, RouterLink],
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
            <th>Bai nop</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let hw of student.homework">
            <td>
              <strong>{{ hw.topic || hw.homework || 'Bai tap' }}</strong>
              <div class="mini-files" *ngIf="hw.materialIds?.length">
                <a *ngFor="let material of hw.materialIds"
                   [href]="fileUrl(material)"
                   target="_blank"
                   rel="noopener noreferrer">
                  {{ material.title || 'Tai lieu bai tap' }}
                </a>
              </div>
              <div class="mini-files" *ngIf="hw.quizIds?.length">
                <a *ngFor="let quiz of hw.quizIds"
                   [routerLink]="['/app/student-quiz']"
                   [queryParams]="quizQueryParams(student, hw, quiz)">
                  Quiz: {{ quizTitle(quiz) }}
                </a>
              </div>
            </td>
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
            <td>
              <span *ngIf="hw.submittedAt; else notSubmitted">{{ hw.submittedAt | date:'dd/MM HH:mm' }}</span>
              <ng-template #notSubmitted><span class="muted">Chua nop</span></ng-template>
              <p class="submission-preview" *ngIf="hw.submissionText">{{ hw.submissionText }}</p>
              <div class="mini-files" *ngIf="hw.submissionVideoUrl">
                <a [href]="hw.submissionVideoUrl" target="_blank" rel="noopener noreferrer">Video bai lam</a>
              </div>
              <div class="mini-files" *ngIf="hw.submissionFiles?.length">
                <a *ngFor="let file of hw.submissionFiles"
                   [href]="fileUrl(file)"
                   target="_blank"
                   rel="noopener noreferrer">
                  {{ file.originalName || 'File bai lam' }}
                </a>
              </div>
              <p class="feedback" *ngIf="hw.feedback">{{ hw.feedback }}</p>
              <div class="mini-files" *ngIf="hw.reviewFiles?.length">
                <a *ngFor="let file of hw.reviewFiles"
                   [href]="fileUrl(file)"
                   target="_blank"
                   rel="noopener noreferrer">
                  File sua: {{ file.originalName || 'File' }}
                </a>
              </div>
            </td>
            <td class="right">
              <button type="button" class="btn-mini" (click)="openHomeworkSubmit(hw)" [disabled]="hw.status === 'GRADED'">
                {{ hw.submittedAt ? 'Sua bai nop' : 'Nop bai' }}
              </button>
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

  <div class="modal-backdrop" *ngIf="submittingHomework() as hw">
    <div class="modal">
      <h3>Nop bai tap</h3>
      <p class="modal-subtitle">{{ hw.topic || hw.homework || 'Bai tap ve nha' }}</p>
      <label>Noi dung bai lam
        <textarea [(ngModel)]="homeworkForm.submissionText" rows="5" placeholder="Nhap cau tra loi hoac ghi chu ve file da upload"></textarea>
      </label>
      <label>Link video bai lam
        <input [(ngModel)]="homeworkForm.submissionVideoUrl" placeholder="Dan link YouTube, Google Drive, Vimeo..." />
      </label>
      <label>File/anh bai lam
        <input type="file" multiple (change)="onHomeworkFilesSelected($event)" />
      </label>
      <div class="selected-files" *ngIf="homeworkForm.files.length">
        <span *ngFor="let file of homeworkForm.files">{{ file.name }}</span>
      </div>
      <p class="error" *ngIf="homeworkError()">{{ homeworkError() }}</p>
      <div class="modal-actions">
        <button type="button" class="btn-primary" (click)="submitHomework()" [disabled]="homeworkSaving()">
          {{ homeworkSaving() ? 'Dang nop...' : 'Nop bai' }}
        </button>
        <button type="button" class="btn-ghost" (click)="closeHomeworkSubmit()" [disabled]="homeworkSaving()">Huy</button>
      </div>
    </div>
  </div>
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
    .right { text-align:right; }
    .badge { font-size:11px; padding:2px 8px; border-radius:9px; font-weight:600; white-space:nowrap; }
    .muted { color:#94a3b8; }
    .mini-files { display:flex; flex-wrap:wrap; gap:6px; margin-top:6px; }
    .mini-files a { display:inline-flex; padding:3px 7px; border-radius:999px; border:1px solid #bfdbfe; background:#eff6ff; color:#1d4ed8; text-decoration:none; font-size:11px; font-weight:700; }
    .submission-preview { max-width:320px; margin:6px 0 0; color:#334155; line-height:1.4; white-space:pre-wrap; }
    .feedback { max-width:320px; margin:6px 0 0; color:#047857; line-height:1.4; white-space:pre-wrap; }
    .btn-mini { padding:6px 10px; border:1px solid #0f766e; border-radius:6px; background:#0f766e; color:#fff; font-size:12px; font-weight:700; cursor:pointer; white-space:nowrap; }
    .btn-mini:disabled { border-color:#cbd5e1; background:#e2e8f0; color:#64748b; cursor:not-allowed; }

    /* Teacher comments */
    .comments-section { padding:0 16px 16px; }
    .comments-section h3 { margin:0 0 12px; color:#334155; font-size:15px; }
    .timeline { margin:0; }
    .tl-item { padding:10px 14px; border-left:2px solid #2563eb; margin-bottom:10px; background:#fff; border-radius:0 6px 6px 0; }
    .tl-date { font-size:11px; color:#64748b; }
    .tl-teacher { font-weight:600; font-size:13px; color:#0f172a; margin-top:2px; }
    .tl-class { font-size:11px; color:#8b5cf6; margin-top:1px; }
    .tl-content { font-size:13px; color:#334155; margin-top:4px; line-height:1.5; }
    .modal-backdrop { position:fixed; inset:0; z-index:60; display:flex; align-items:center; justify-content:center; padding:16px; background:rgba(15,23,42,.35); }
    .modal { width:min(620px, 100%); background:#fff; border-radius:8px; padding:18px; box-shadow:0 20px 48px rgba(15,23,42,.22); }
    .modal h3 { margin:0; color:#0f172a; }
    .modal-subtitle { margin:6px 0 12px; color:#475569; line-height:1.45; }
    .modal label { display:flex; flex-direction:column; gap:6px; margin:10px 0; color:#334155; font-size:13px; font-weight:700; }
    .modal textarea, .modal input { border:1px solid #cbd5e1; border-radius:6px; padding:8px 10px; font:inherit; }
    .selected-files { display:flex; flex-wrap:wrap; gap:8px; margin-top:8px; }
    .selected-files span { padding:4px 8px; border-radius:999px; background:#f1f5f9; color:#334155; font-size:12px; font-weight:700; }
    .modal-actions { display:flex; justify-content:flex-end; gap:8px; margin-top:14px; }
    .btn-primary, .btn-ghost { border-radius:6px; padding:8px 14px; font-size:13px; font-weight:700; cursor:pointer; }
    .btn-primary { border:1px solid #0f766e; background:#0f766e; color:#fff; }
    .btn-ghost { border:1px solid #cbd5e1; background:#fff; color:#334155; }

    @media (max-width: 768px) {
      .page-header { flex-direction:column; align-items:flex-start; }
      .score-cards { grid-template-columns:1fr; }
      .progress-grid { grid-template-columns:1fr; }
    }
  `]
})
export class StudentProgressComponent implements OnInit {
  private http = inject(HttpClient);
  private sessionService = inject(SessionService);

  data = signal<any>(null);
  students = signal<any[]>([]);
  activeTab = signal(0);
  loading = signal(false);
  error = signal('');
  submittingHomework = signal<any | null>(null);
  homeworkSaving = signal(false);
  homeworkError = signal('');
  homeworkForm: { submissionText: string; submissionVideoUrl: string; files: File[] } = { submissionText: '', submissionVideoUrl: '', files: [] };

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
      this.students.set(this.normalizeStudents(res));
    } catch (err: any) {
      this.error.set(err?.error?.message || err?.message || 'Không thể tải dữ liệu tiến trình học tập.');
    } finally {
      this.loading.set(false);
    }
  }

  hwStatusLabel(s: string): string {
    return HOMEWORK_STATUS_LABELS[s] || s || '-';
  }

  hwStatusColor(s: string): string {
    return HOMEWORK_STATUS_COLORS[s] || '#64748b';
  }

  openHomeworkSubmit(homework: any) {
    if (!homework?.sessionId) {
      this.homeworkError.set('Khong tim thay buoi hoc de nop bai.');
      return;
    }
    this.homeworkError.set('');
    this.submittingHomework.set(homework);
    this.homeworkForm = {
      submissionText: homework.submissionText || '',
      submissionVideoUrl: homework.submissionVideoUrl || '',
      files: [],
    };
  }

  closeHomeworkSubmit() {
    this.submittingHomework.set(null);
    this.homeworkError.set('');
    this.homeworkForm = { submissionText: '', submissionVideoUrl: '', files: [] };
  }

  onHomeworkFilesSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    this.homeworkForm.files = Array.from(input.files || []);
  }

  async submitHomework() {
    const homework = this.submittingHomework();
    if (!homework?.sessionId) return;
    if (!this.homeworkForm.submissionText.trim() && !this.homeworkForm.submissionVideoUrl.trim() && this.homeworkForm.files.length === 0) {
      this.homeworkError.set('Can nhap noi dung, link video hoac chon file bai lam.');
      return;
    }

    this.homeworkSaving.set(true);
    this.homeworkError.set('');
    try {
      await this.sessionService.submitHomework(homework.sessionId, {
        submissionText: this.homeworkForm.submissionText,
        submissionVideoUrl: this.homeworkForm.submissionVideoUrl,
        files: this.homeworkForm.files,
      });
      this.closeHomeworkSubmit();
      await this.loadProgress();
    } catch (err: any) {
      this.homeworkError.set(err?.error?.message || err?.message || 'Khong the nop bai tap.');
    } finally {
      this.homeworkSaving.set(false);
    }
  }

  fileUrl(file: HomeworkAttachment | any): string {
    const url = file?.fileUrl || '';
    if (!url) return '#';
    return url.startsWith('http') ? url : `${environment.apiBase}${url}`;
  }

  quizTitle(quiz: any): string {
    return typeof quiz === 'string' ? 'Bai quiz' : quiz?.title || 'Bai quiz';
  }

  quizQueryParams(student: any, homework: any, quiz: any): Record<string, string> {
    const params: Record<string, string> = {};
    const quizId = typeof quiz === 'string' ? quiz : quiz?._id || quiz?.id;
    const studentId = student?._id || student?.studentId || homework?.studentId;
    if (quizId) params['quizId'] = String(quizId);
    if (studentId) params['studentId'] = String(studentId);
    if (homework?.sessionId) params['sessionId'] = String(homework.sessionId);
    return params;
  }

  private normalizeStudents(res: any): any[] {
    const rawStudents = res?.students || res?.children || (Array.isArray(res) ? res : []);
    return rawStudents.map((item: any) => {
      const student = item.student || item;
      const homeworkList = Array.isArray(item.homework)
        ? item.homework
        : Array.isArray(item.homework?.list)
          ? item.homework.list
          : [];
      const curriculumProgress = Array.isArray(item.curriculumProgress)
        ? item.curriculumProgress
        : item.progress?.classes || [];
      return {
        ...item,
        studentName: item.studentName || student.fullName || 'Hoc sinh',
        evaluations: item.evaluations || {
          averagePerformance: item.evaluation?.avgPerformance,
          averageEngagement: item.evaluation?.avgEngagement,
          averageComprehension: item.evaluation?.avgComprehension,
        },
        progress: item.progress || {
          sessionsCompleted: item.totalSessions || 0,
          sessionsTotal: item.totalSessions || 0,
          classes: curriculumProgress.map((entry: any) => ({
            className: entry.className,
            completed: entry.completedItems ?? entry.completed ?? 0,
            total: entry.totalItems ?? entry.total ?? 0,
          })),
        },
        homework: homeworkList,
        teacherComments: item.teacherComments || (item.recentComments || []).map((comment: any) => ({
          date: comment.sessionDate,
          className: comment.className,
          comment: comment.teacherComment || comment.overallComment || '',
        })),
      };
    });
  }
}
