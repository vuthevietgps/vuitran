import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ActivatedRoute } from '@angular/router';
import { Quiz, QuizQuestion, QuizService } from '../services/quiz.service';

@Component({
  selector: 'app-student-quiz',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="page">
      <header>
        <div>
          <h2>Quiz cua em</h2>
          <p>Lam quiz duoc giao hoac quiz da duyet trong kho.</p>
        </div>
        <button type="button" (click)="loadQuizzes()" [disabled]="loading()">Tai lai</button>
      </header>

      <p class="error" *ngIf="error()">{{ error() }}</p>
      <p class="success" *ngIf="success()">{{ success() }}</p>

      <section class="quiz-list" *ngIf="!activeQuiz(); else quizBlock">
        <article class="quiz-card" *ngFor="let quiz of quizzes()">
          <h3>{{ quiz.title }}</h3>
          <p>{{ quiz.description || 'Quiz luyen tap' }}</p>
          <span class="video-badge" *ngIf="quiz.introVideoUrl">Co video</span>
          <button class="primary" type="button" (click)="openQuiz(quiz)">Lam quiz</button>
        </article>
        <p class="empty" *ngIf="!loading() && quizzes().length === 0">Chua co quiz kha dung.</p>
      </section>

      <ng-template #quizBlock>
        <section class="panel" *ngIf="activeQuiz() as quiz">
          <button type="button" (click)="closeQuiz()">Quay lai</button>
          <h3>{{ quiz.title }}</h3>
          <section class="quiz-video" *ngIf="quiz.introVideoUrl">
            <h4>{{ quiz.introVideoTitle || 'Video nghe/xem truoc khi tra loi' }}</h4>
            <video *ngIf="isDirectVideoUrl(quiz.introVideoUrl); else embeddedVideo" controls preload="metadata" [src]="quiz.introVideoUrl"></video>
            <ng-template #embeddedVideo>
              <iframe
                *ngIf="videoEmbedUrl(quiz.introVideoUrl) as embedUrl; else videoLink"
                [src]="embedUrl"
                title="Quiz video"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowfullscreen>
              </iframe>
            </ng-template>
            <ng-template #videoLink>
              <a [href]="quiz.introVideoUrl" target="_blank" rel="noopener noreferrer">Mo video rieng</a>
            </ng-template>
          </section>

          <article class="question" *ngFor="let question of quizQuestions(); let i = index">
            <strong>Cau {{ i + 1 }}. {{ question.questionText }}</strong>
            <div class="options" *ngIf="choiceQuestion(question); else textAnswer">
              <label *ngFor="let option of question.options || []">
                <input
                  [type]="question.type === 'MULTIPLE_CHOICE' ? 'checkbox' : 'radio'"
                  [name]="question._id"
                  [checked]="isSelected(question._id, option.id)"
                  (change)="toggleOption(question, option.id, $any($event.target).checked)"
                />
                <span>{{ option.text }}</span>
              </label>
            </div>
            <ng-template #textAnswer>
              <textarea rows="3" [ngModel]="textAnswerValue(question._id)" (ngModelChange)="setTextAnswer(question._id, $event)"></textarea>
            </ng-template>
          </article>
          <button class="primary" type="button" (click)="submit()" [disabled]="submitting()">Nop quiz</button>
        </section>
      </ng-template>
    </section>
  `,
  styles: [`
    .page{padding:20px;max-width:900px;margin:0 auto}
    header{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:16px}
    h2,h3{margin:0 0 8px;color:#0f172a}
    p{color:#64748b}
    .quiz-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px}
    .quiz-card,.panel{background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:14px}
    .video-badge{display:inline-flex;margin:0 0 10px;padding:3px 8px;border-radius:999px;background:#eff6ff;color:#1d4ed8;font-size:12px;font-weight:700}
    .quiz-video{border:1px solid #bfdbfe;background:#eff6ff;border-radius:8px;padding:12px;margin:12px 0}
    .quiz-video h4{margin:0 0 10px;color:#1e3a8a}
    .quiz-video video,.quiz-video iframe{display:block;width:100%;aspect-ratio:16/9;border:0;border-radius:8px;background:#0f172a}
    .question{border-top:1px solid #e2e8f0;padding:14px 0}
    .options{display:grid;gap:8px;margin-top:8px}
    .options label{display:flex;gap:8px;align-items:flex-start}
    .primary{border:1px solid #2563eb;background:#2563eb;color:#fff;border-radius:6px;padding:8px 12px;font-weight:700;cursor:pointer}
    button{border:1px solid #cbd5e1;background:#fff;border-radius:6px;padding:8px 12px;cursor:pointer}
    textarea{width:100%;border:1px solid #cbd5e1;border-radius:6px;padding:8px 10px;margin-top:8px}
    .error{color:#dc2626}.success{color:#047857}.empty{grid-column:1/-1}
  `],
})
export class StudentQuizComponent implements OnInit {
  quizzes = signal<Quiz[]>([]);
  activeQuiz = signal<Quiz | null>(null);
  loading = signal(false);
  submitting = signal(false);
  error = signal('');
  success = signal('');
  answers = new Map<string, { selectedOptionIds: string[]; textAnswer?: string }>();
  private studentId = '';
  private sessionId = '';
  private initialQuizId = '';

  constructor(
    private readonly quizService: QuizService,
    private readonly route: ActivatedRoute,
    private readonly sanitizer: DomSanitizer,
  ) {}

  ngOnInit() {
    const params = this.route.snapshot.queryParamMap;
    this.studentId = params.get('studentId') || '';
    this.sessionId = params.get('sessionId') || '';
    this.initialQuizId = params.get('quizId') || '';
    void this.loadQuizzes().then(() => this.openInitialQuiz());
  }

  async loadQuizzes() {
    this.loading.set(true);
    this.error.set('');
    try {
      this.quizzes.set(await this.quizService.listQuizzes('APPROVED'));
    } catch (err: any) {
      this.error.set(err?.error?.message || err?.message || 'Khong the tai quiz.');
    } finally {
      this.loading.set(false);
    }
  }

  async openQuiz(quiz: Quiz) {
    this.error.set('');
    this.success.set('');
    this.answers.clear();
    this.activeQuiz.set(await this.quizService.getQuiz(quiz._id));
  }

  private async openInitialQuiz() {
    if (!this.initialQuizId || this.activeQuiz()) return;
    const quiz = this.quizzes().find((item) => item._id === this.initialQuizId) || ({
      _id: this.initialQuizId,
      title: 'Quiz',
    } as Quiz);
    await this.openQuiz(quiz);
  }

  closeQuiz() {
    this.activeQuiz.set(null);
    this.answers.clear();
  }

  quizQuestions(): QuizQuestion[] {
    return (this.activeQuiz()?.questionIds || []).filter((item): item is QuizQuestion => typeof item !== 'string');
  }

  choiceQuestion(question: QuizQuestion): boolean {
    return ['SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'TRUE_FALSE'].includes(question.type);
  }

  isSelected(questionId: string, optionId: string): boolean {
    return this.answers.get(questionId)?.selectedOptionIds.includes(optionId) === true;
  }

  toggleOption(question: QuizQuestion, optionId: string, checked: boolean) {
    const current = this.answers.get(question._id) || { selectedOptionIds: [] };
    if (question.type === 'MULTIPLE_CHOICE') {
      const ids = new Set(current.selectedOptionIds);
      checked ? ids.add(optionId) : ids.delete(optionId);
      current.selectedOptionIds = Array.from(ids);
    } else {
      current.selectedOptionIds = checked ? [optionId] : [];
    }
    this.answers.set(question._id, current);
  }

  textAnswerValue(questionId: string): string {
    return this.answers.get(questionId)?.textAnswer || '';
  }

  setTextAnswer(questionId: string, value: string) {
    const current = this.answers.get(questionId) || { selectedOptionIds: [] };
    current.textAnswer = value;
    this.answers.set(questionId, current);
  }

  isDirectVideoUrl(url?: string): boolean {
    return /\.(mp4|webm|ogg)(\?|#|$)/i.test(url || '');
  }

  videoEmbedUrl(url?: string): SafeResourceUrl | null {
    const raw = (url || '').trim();
    if (!raw) return null;
    const embedUrl = this.toEmbedUrl(raw);
    return embedUrl ? this.sanitizer.bypassSecurityTrustResourceUrl(embedUrl) : null;
  }

  private toEmbedUrl(raw: string): string | null {
    try {
      const url = new URL(raw);
      const host = url.hostname.replace(/^www\./, '');
      if (host === 'youtube.com' || host === 'm.youtube.com') {
        const id = url.searchParams.get('v');
        return id ? `https://www.youtube.com/embed/${encodeURIComponent(id)}` : null;
      }
      if (host === 'youtu.be') {
        const id = url.pathname.split('/').filter(Boolean)[0];
        return id ? `https://www.youtube.com/embed/${encodeURIComponent(id)}` : null;
      }
      if (host === 'vimeo.com') {
        const id = url.pathname.split('/').filter(Boolean)[0];
        return id ? `https://player.vimeo.com/video/${encodeURIComponent(id)}` : null;
      }
      return null;
    } catch {
      return null;
    }
  }

  async submit() {
    const quiz = this.activeQuiz();
    if (!quiz) return;
    this.submitting.set(true);
    this.error.set('');
    this.success.set('');
    try {
      const result = await this.quizService.submitAttempt(quiz._id, {
        studentId: this.studentId || undefined,
        sessionId: this.sessionId || undefined,
        answers: this.quizQuestions().map((question) => ({
          questionId: question._id,
          selectedOptionIds: this.answers.get(question._id)?.selectedOptionIds || [],
          textAnswer: this.answers.get(question._id)?.textAnswer,
        })),
      });
      const waitingManual = result.status === 'NEEDS_GRADING';
      this.success.set(
        waitingManual
          ? `Da nop quiz. Diem tam thoi: ${result.autoScore}/${result.maxScore}. Phan tu luan dang cho giao vien cham.`
          : `Da nop quiz. Diem: ${result.finalScore}/${result.maxScore} (${result.percentScore}%).`,
      );
      this.closeQuiz();
    } catch (err: any) {
      this.error.set(err?.error?.message || err?.message || 'Khong the nop quiz.');
    } finally {
      this.submitting.set(false);
    }
  }
}
