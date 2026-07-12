import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HomeworkAttachment, SessionService } from '../services/session.service';
import { environment } from '../../environments/environment';
import { QuizAttempt, QuizQuestion, QuizService } from '../services/quiz.service';

const STATUS_LABELS: Record<string, string> = {
  NOT_ASSIGNED: 'Chua giao',
  ASSIGNED: 'Da giao',
  SUBMITTED: 'Da nop',
  REVIEWED: 'Da xem',
  GRADED: 'Da cham',
};

@Component({
  selector: 'app-homework-grading',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <header class="page-header">
      <div>
        <h2>Cham bai tap</h2>
        <p>Danh sach bai tap ve nha can giao vien trai nghiem cham diem.</p>
      </div>
      <div class="actions">
        <select [(ngModel)]="statusFilter" name="statusFilter" (ngModelChange)="load()">
          <option value="pending">Can cham</option>
          <option value="all">Tat ca</option>
        </select>
        <button type="button" (click)="load()" [disabled]="loading()">Tai lai</button>
      </div>
    </header>

    <p class="error" *ngIf="error()">{{ error() }}</p>
    <p class="success" *ngIf="success()">{{ success() }}</p>

    <section class="panel">
      <h3 class="section-title">Bai upload / anh can cham tay</h3>
      <table class="data" *ngIf="items().length; else empty">
        <thead>
          <tr>
            <th>Hoc sinh</th>
            <th>Lop</th>
            <th>Ngay hoc</th>
            <th>Bai tap</th>
            <th>Bai nop</th>
            <th>Trang thai</th>
            <th>Diem</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let item of items()">
            <td>
              <strong>{{ item.studentId?.fullName || '-' }}</strong>
              <small>{{ item.studentId?.studentCode || '' }}</small>
            </td>
            <td>{{ item.classId?.name || item.classId?.code || '-' }}</td>
            <td>{{ item.scheduledDate | date:'dd/MM/yyyy' }}</td>
            <td class="homework-text">{{ homeworkText(item) }}</td>
            <td>
              <span class="submitted" *ngIf="item.evaluation?.homeworkSubmittedAt; else notSubmitted">
                {{ item.evaluation?.homeworkSubmittedAt | date:'dd/MM HH:mm' }}
              </span>
              <ng-template #notSubmitted><span class="muted-inline">Chua nop</span></ng-template>
              <small *ngIf="item.evaluation?.homeworkSubmissionFiles?.length">
                {{ item.evaluation.homeworkSubmissionFiles.length }} file
              </small>
              <small *ngIf="item.evaluation?.homeworkSubmissionVideoUrl">Co link video</small>
            </td>
            <td>
              <span class="badge" [class.done]="isGraded(item)">
                {{ statusLabel(item.evaluation?.homeworkStatus) }}
              </span>
            </td>
            <td class="center">{{ item.evaluation?.homeworkScore ?? '-' }}</td>
            <td class="right">
              <button type="button" class="primary sm" (click)="openGrade(item)">
                {{ isGraded(item) ? 'Sua diem' : 'Cham bai' }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      <ng-template #empty>
        <p class="empty">{{ loading() ? 'Dang tai...' : 'Khong co bai tap can cham.' }}</p>
      </ng-template>
    </section>

    <section class="panel">
      <h3 class="section-title">Quiz tren he thong</h3>
      <table class="data" *ngIf="quizAttempts().length; else emptyQuiz">
        <thead>
          <tr>
            <th>Hoc sinh</th>
            <th>Quiz</th>
            <th>Ngay nop</th>
            <th>Trang thai</th>
            <th>Diem</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let attempt of quizAttempts()">
            <td>
              <strong>{{ attemptStudentName(attempt) }}</strong>
              <small>{{ attemptStudentCode(attempt) }}</small>
            </td>
            <td>{{ quizName(attempt) }}</td>
            <td>{{ attempt.submittedAt | date:'dd/MM HH:mm' }}</td>
            <td>
              <span class="badge" [class.done]="attempt.status === 'GRADED'">
                {{ quizStatusLabel(attempt.status) }}
              </span>
            </td>
            <td class="center">
              {{ attempt.finalScore }}/{{ attempt.maxScore }}
              <small>{{ attempt.percentScore }}%</small>
            </td>
            <td class="right">
              <button type="button" class="primary sm" (click)="openQuizGrade(attempt)">
                {{ attempt.status === 'NEEDS_GRADING' ? 'Cham tu luan' : 'Xem ket qua' }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      <ng-template #emptyQuiz>
        <p class="empty">{{ loading() ? 'Dang tai...' : 'Khong co quiz can cham.' }}</p>
      </ng-template>
    </section>

    <div class="modal-backdrop" *ngIf="selected() as item">
      <div class="modal">
        <h3>Cham bai tap</h3>
        <p class="muted">{{ item.studentId?.fullName || '-' }} - {{ item.classId?.name || item.classId?.code || '-' }}</p>
        <div class="homework-preview">{{ homeworkText(item) }}</div>

        <section class="submission-box">
          <h4>Bai hoc sinh nop</h4>
          <p class="submission-text" *ngIf="item.evaluation?.homeworkSubmissionText; else noText">
            {{ item.evaluation.homeworkSubmissionText }}
          </p>
          <ng-template #noText><p class="muted">Chua co noi dung text.</p></ng-template>
          <div class="file-list" *ngIf="item.evaluation?.homeworkSubmissionFiles?.length">
            <a *ngFor="let file of item.evaluation.homeworkSubmissionFiles"
               [href]="fileUrl(file)"
               target="_blank"
               rel="noopener noreferrer">
              {{ file.originalName || 'File bai lam' }}
            </a>
          </div>
          <div class="file-list" *ngIf="item.evaluation?.homeworkSubmissionVideoUrl">
            <a [href]="item.evaluation.homeworkSubmissionVideoUrl" target="_blank" rel="noopener noreferrer">
              Link video bai lam
            </a>
          </div>
        </section>

        <label>Diem (0-10)
          <input type="number" name="score" [(ngModel)]="form.score" min="0" max="10" step="0.1" />
        </label>
        <label>Nhan xet
          <textarea name="feedback" [(ngModel)]="form.feedback" rows="4"></textarea>
        </label>
        <label>File da sua / dap an gui lai
          <input type="file" multiple (change)="onReviewFilesSelected($event)" />
        </label>
        <div class="selected-files" *ngIf="selectedReviewFiles.length">
          <span *ngFor="let file of selectedReviewFiles">{{ file.name }}</span>
        </div>

        <p class="error" *ngIf="modalError()">{{ modalError() }}</p>
        <div class="modal-actions">
          <button type="button" class="primary" (click)="submitGrade()" [disabled]="saving()">
            {{ saving() ? 'Dang luu...' : 'Luu diem' }}
          </button>
          <button type="button" (click)="closeGrade()" [disabled]="saving()">Huy</button>
        </div>
      </div>
    </div>

    <div class="modal-backdrop" *ngIf="selectedAttempt() as attempt">
      <div class="modal">
        <h3>Ket qua quiz</h3>
        <p class="muted">{{ attemptStudentName(attempt) }} - {{ quizName(attempt) }}</p>
        <div class="homework-preview">
          Diem tu dong: {{ attempt.autoScore }}/{{ attempt.maxScore }}.
          Diem hien tai: {{ attempt.finalScore }}/{{ attempt.maxScore }} ({{ attempt.percentScore }}%).
        </div>

        <section class="submission-box">
          <h4>Cau tra loi</h4>
          <article class="quiz-answer" *ngFor="let answer of attempt.answers || []; let i = index">
            <strong>Cau {{ i + 1 }}. {{ questionText(answer.questionId) }}</strong>
            <p>{{ answerText(answer) }}</p>
            <small>
              {{ answer.isCorrect === true ? 'Dung' : answer.isCorrect === false ? 'Sai' : 'Can cham tay' }}
              - {{ answer.score || 0 }} diem
            </small>
          </article>
        </section>

        <ng-container *ngIf="attempt.status === 'NEEDS_GRADING'; else readonlyQuiz">
          <label>Diem tong sau khi cham
            <input type="number" name="manualScore" [(ngModel)]="quizForm.manualScore" min="0" [max]="attempt.maxScore" step="0.1" />
          </label>
          <label>Nhan xet quiz
            <textarea name="manualFeedback" [(ngModel)]="quizForm.manualFeedback" rows="4"></textarea>
          </label>
        </ng-container>
        <ng-template #readonlyQuiz>
          <p class="muted" *ngIf="attempt.manualFeedback">{{ attempt.manualFeedback }}</p>
        </ng-template>

        <p class="error" *ngIf="modalError()">{{ modalError() }}</p>
        <div class="modal-actions">
          <button type="button" class="primary" *ngIf="attempt.status === 'NEEDS_GRADING'" (click)="submitQuizGrade()" [disabled]="saving()">
            {{ saving() ? 'Dang luu...' : 'Luu diem quiz' }}
          </button>
          <button type="button" (click)="closeQuizGrade()" [disabled]="saving()">Dong</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .page-header { display:flex; justify-content:space-between; align-items:center; gap:16px; padding:16px; }
    .page-header h2 { margin:0; color:#0f172a; }
    .page-header p { margin:4px 0 0; color:#64748b; font-size:13px; }
    .actions { display:flex; gap:8px; align-items:center; }
    select, input, textarea { border:1px solid #cbd5e1; border-radius:6px; padding:8px 10px; font-size:13px; }
    button { border:1px solid #cbd5e1; border-radius:6px; padding:8px 12px; background:#fff; cursor:pointer; }
    button.primary { background:#2563eb; border-color:#2563eb; color:#fff; font-weight:600; }
    button.sm { padding:6px 10px; font-size:12px; }
    button:disabled { opacity:.6; cursor:not-allowed; }
    .panel { padding:0 16px 16px; }
    .data { width:100%; border-collapse:collapse; background:#fff; font-size:13px; }
    th, td { border:1px solid #e2e8f0; padding:9px 10px; vertical-align:top; }
    th { background:#f8fafc; text-align:left; color:#475569; font-size:12px; text-transform:uppercase; }
    td small { display:block; color:#64748b; margin-top:2px; }
    .homework-text { max-width:460px; white-space:pre-wrap; line-height:1.45; }
    .submitted { color:#047857; font-weight:700; font-size:12px; }
    .muted-inline { color:#94a3b8; font-size:12px; }
    .center { text-align:center; }
    .right { text-align:right; }
    .badge { display:inline-flex; padding:3px 8px; border-radius:999px; background:#fef3c7; color:#92400e; font-size:12px; font-weight:600; }
    .badge.done { background:#dcfce7; color:#166534; }
    .empty, .error, .success { margin:0 16px 12px; font-size:13px; }
    .empty { color:#64748b; }
    .error { color:#dc2626; }
    .success { color:#047857; }
    .modal-backdrop { position:fixed; inset:0; background:rgba(15,23,42,.35); display:flex; align-items:center; justify-content:center; padding:16px; z-index:50; }
    .modal { width:min(560px, 100%); background:#fff; border-radius:8px; padding:18px; box-shadow:0 20px 48px rgba(15,23,42,.22); }
    .modal h3 { margin:0 0 4px; }
    .muted { color:#64748b; margin:0 0 12px; font-size:13px; }
    .homework-preview { background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; padding:10px; margin-bottom:12px; white-space:pre-wrap; line-height:1.45; }
    .submission-box { border:1px solid #dbeafe; background:#eff6ff; border-radius:8px; padding:12px; margin-bottom:12px; }
    .submission-box h4 { margin:0 0 8px; color:#1e3a8a; font-size:13px; }
    .submission-text { margin:0 0 8px; white-space:pre-wrap; line-height:1.45; color:#1e293b; }
    .section-title { margin:0 0 10px; color:#334155; font-size:15px; }
    .quiz-answer { border-top:1px solid #bfdbfe; padding:10px 0; }
    .quiz-answer:first-child { border-top:0; padding-top:0; }
    .quiz-answer p { margin:6px 0; color:#1e293b; white-space:pre-wrap; }
    .file-list, .selected-files { display:flex; flex-wrap:wrap; gap:8px; }
    .file-list a, .selected-files span { display:inline-flex; padding:5px 9px; border-radius:999px; background:#fff; border:1px solid #bfdbfe; color:#1d4ed8; text-decoration:none; font-size:12px; font-weight:600; }
    label { display:flex; flex-direction:column; gap:6px; margin:10px 0; font-size:13px; font-weight:600; color:#334155; }
    .modal-actions { display:flex; justify-content:flex-end; gap:8px; margin-top:14px; }
    @media (max-width: 760px) {
      .page-header { flex-direction:column; align-items:flex-start; }
      .data { display:block; overflow-x:auto; }
    }
  `],
})
export class HomeworkGradingComponent implements OnInit {
  items = signal<any[]>([]);
  quizAttempts = signal<QuizAttempt[]>([]);
  loading = signal(false);
  saving = signal(false);
  error = signal('');
  success = signal('');
  modalError = signal('');
  selected = signal<any | null>(null);
  selectedAttempt = signal<QuizAttempt | null>(null);
  statusFilter = 'pending';
  form = { score: 0, feedback: '' };
  quizForm = { manualScore: 0, manualFeedback: '' };
  selectedReviewFiles: File[] = [];

  constructor(
    private readonly sessionService: SessionService,
    private readonly quizService: QuizService,
  ) {}

  ngOnInit() {
    this.load();
  }

  async load() {
    this.loading.set(true);
    this.error.set('');
    try {
      const [homeworkItems, quizAttempts] = await Promise.all([
        this.sessionService.listHomeworkForGrading(this.statusFilter),
        this.quizService.listAttempts(this.statusFilter),
      ]);
      this.items.set(homeworkItems);
      this.quizAttempts.set(quizAttempts);
    } catch (err: any) {
      this.error.set(err?.error?.message || err?.message || 'Khong the tai danh sach bai tap.');
      this.items.set([]);
      this.quizAttempts.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  homeworkText(item: any): string {
    return item?.evaluation?.homeworkAssigned || item?.teachingReport?.homework || item?.homework || '-';
  }

  statusLabel(status?: string): string {
    return STATUS_LABELS[status || ''] || status || 'Chua cham';
  }

  isGraded(item: any): boolean {
    return ['GRADED', 'REVIEWED'].includes(item?.evaluation?.homeworkStatus);
  }

  openGrade(item: any) {
    this.modalError.set('');
    this.selected.set(item);
    this.selectedReviewFiles = [];
    this.form = {
      score: item?.evaluation?.homeworkScore ?? 0,
      feedback: item?.evaluation?.homeworkFeedback || '',
    };
  }

  closeGrade() {
    this.selected.set(null);
    this.selectedReviewFiles = [];
  }

  onReviewFilesSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    this.selectedReviewFiles = Array.from(input.files || []);
  }

  fileUrl(file: HomeworkAttachment): string {
    const url = file?.fileUrl || '';
    if (!url) return '#';
    return url.startsWith('http') ? url : `${environment.apiBase}${url}`;
  }

  quizName(attempt: QuizAttempt): string {
    return typeof attempt.quizId === 'string' ? 'Quiz' : attempt.quizId?.title || 'Quiz';
  }

  attemptStudentName(attempt: QuizAttempt): string {
    return typeof attempt.studentId === 'string' ? '-' : attempt.studentId?.fullName || '-';
  }

  attemptStudentCode(attempt: QuizAttempt): string {
    return typeof attempt.studentId === 'string' ? '' : attempt.studentId?.studentCode || '';
  }

  quizStatusLabel(status?: string): string {
    if (status === 'NEEDS_GRADING') return 'Can cham tu luan';
    if (status === 'GRADED') return 'Da co diem';
    if (status === 'SUBMITTED') return 'Da nop';
    return status || '-';
  }

  questionText(question: QuizQuestion | string | undefined): string {
    return typeof question === 'string' ? 'Cau hoi' : question?.questionText || 'Cau hoi';
  }

  answerText(answer: NonNullable<QuizAttempt['answers']>[number]): string {
    const question = typeof answer.questionId === 'string' ? null : answer.questionId;
    const options = question?.options || [];
    const selected = (answer.selectedOptionIds || [])
      .map((id) => options.find((option) => option.id === id)?.text || id)
      .join(', ');
    return answer.textAnswer || selected || 'Chua tra loi';
  }

  openQuizGrade(attempt: QuizAttempt) {
    this.modalError.set('');
    this.selectedAttempt.set(attempt);
    this.quizForm = {
      manualScore: attempt.manualScore ?? attempt.finalScore ?? attempt.autoScore ?? 0,
      manualFeedback: attempt.manualFeedback || '',
    };
  }

  closeQuizGrade() {
    this.selectedAttempt.set(null);
  }

  async submitGrade() {
    const item = this.selected();
    if (!item?._id) return;
    const score = Number(this.form.score);
    if (!Number.isFinite(score) || score < 0 || score > 10) {
      this.modalError.set('Diem phai nam trong khoang 0-10.');
      return;
    }

    this.saving.set(true);
    this.modalError.set('');
    this.success.set('');
    try {
      await this.sessionService.gradeHomework(item._id, {
        score,
        feedback: this.form.feedback.trim() || undefined,
        files: this.selectedReviewFiles,
      });
      this.success.set('Da luu diem bai tap.');
      this.closeGrade();
      await this.load();
    } catch (err: any) {
      this.modalError.set(err?.error?.message || err?.message || 'Khong the luu diem bai tap.');
    } finally {
      this.saving.set(false);
    }
  }

  async submitQuizGrade() {
    const attempt = this.selectedAttempt();
    if (!attempt?._id) return;
    const manualScore = Number(this.quizForm.manualScore);
    if (!Number.isFinite(manualScore) || manualScore < 0 || manualScore > Number(attempt.maxScore || 0)) {
      this.modalError.set(`Diem quiz phai nam trong khoang 0-${attempt.maxScore}.`);
      return;
    }

    this.saving.set(true);
    this.modalError.set('');
    this.success.set('');
    try {
      await this.quizService.gradeAttempt(attempt._id, {
        manualScore,
        manualFeedback: this.quizForm.manualFeedback.trim() || undefined,
      });
      this.success.set('Da luu diem quiz.');
      this.closeQuizGrade();
      await this.load();
    } catch (err: any) {
      this.modalError.set(err?.error?.message || err?.message || 'Khong the luu diem quiz.');
    } finally {
      this.saving.set(false);
    }
  }
}
