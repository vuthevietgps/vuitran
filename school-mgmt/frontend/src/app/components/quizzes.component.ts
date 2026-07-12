import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Quiz, QuizQuestion, QuizService } from '../services/quiz.service';

@Component({
  selector: 'app-quizzes',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="page">
      <header>
        <div>
          <h2>Quiz cấu trúc</h2>
          <p>Tạo câu hỏi trắc nghiệm và ghép thành quiz đã duyệt để giao BTVN.</p>
        </div>
        <button type="button" (click)="reload()" [disabled]="loading()">Tải lại</button>
      </header>

      <p class="error" *ngIf="error()">{{ error() }}</p>
      <p class="success" *ngIf="success()">{{ success() }}</p>

      <section class="grid">
        <article class="panel">
          <h3>Tạo câu hỏi</h3>
          <label>Loại câu hỏi
            <select [(ngModel)]="questionForm.type">
              <option value="SINGLE_CHOICE">Một đáp án</option>
              <option value="MULTIPLE_CHOICE">Nhiều đáp án</option>
              <option value="TRUE_FALSE">Đúng / sai</option>
              <option value="SHORT_TEXT">Text ngắn</option>
              <option value="ESSAY">Tự luận</option>
            </select>
          </label>
          <label>Nội dung câu hỏi
            <textarea rows="3" [(ngModel)]="questionForm.questionText"></textarea>
          </label>
          <label>Options, mỗi dòng dạng A|Nội dung
            <textarea rows="4" [(ngModel)]="questionForm.optionsText" placeholder="A|Đáp án A&#10;B|Đáp án B"></textarea>
          </label>
          <label>Đáp án đúng
            <input [(ngModel)]="questionForm.correctOptionIdsText" placeholder="A hoặc A,B" />
          </label>
          <label>Giải thích
            <textarea rows="2" [(ngModel)]="questionForm.explanation"></textarea>
          </label>
          <div class="row">
            <label>Điểm
              <input type="number" min="0" [(ngModel)]="questionForm.points" />
            </label>
            <label>Trạng thái
              <select [(ngModel)]="questionForm.status">
                <option value="DRAFT">Nháp</option>
                <option value="APPROVED">Đã duyệt</option>
              </select>
            </label>
          </div>
          <button class="primary" type="button" (click)="createQuestion()" [disabled]="saving()">Tạo câu hỏi</button>
        </article>

        <article class="panel">
          <h3>Tạo quiz</h3>
          <label>Tiêu đề
            <input [(ngModel)]="quizForm.title" />
          </label>
          <label>Mô tả
            <textarea rows="2" [(ngModel)]="quizForm.description"></textarea>
          </label>
          <label>Link video nghe/xem trước khi làm
            <input [(ngModel)]="quizForm.introVideoUrl" placeholder="https://youtube.com/... hoặc https://.../video.mp4" />
          </label>
          <label>Tiêu đề video
            <input [(ngModel)]="quizForm.introVideoTitle" placeholder="Listening video, đoạn hội thoại..." />
          </label>
          <label>Câu hỏi đã duyệt</label>
          <div class="question-picker">
            <label *ngFor="let q of approvedQuestions()">
              <input type="checkbox" [checked]="quizForm.questionIds.includes(q._id)" (change)="toggleQuestion(q._id, $any($event.target).checked)" />
              <span>{{ q.questionText }}</span>
            </label>
          </div>
          <div class="row">
            <label>Số lần làm
              <input type="number" min="1" [(ngModel)]="quizForm.maxAttempts" />
            </label>
            <label>Điểm đạt (%)
              <input type="number" min="0" max="100" [(ngModel)]="quizForm.passingScore" />
            </label>
          </div>
          <label>
            <input type="checkbox" [(ngModel)]="quizForm.showCorrectAnswersAfterSubmit" />
            Hiện đáp án sau khi nộp
          </label>
          <button class="primary" type="button" (click)="createQuiz()" [disabled]="saving()">Tạo quiz đã duyệt</button>
        </article>
      </section>

      <section class="panel">
        <h3>Quiz hiện có</h3>
        <table *ngIf="quizzes().length; else empty">
          <thead><tr><th>Tiêu đề</th><th>Trạng thái</th><th>Câu hỏi</th><th>Điểm đạt</th></tr></thead>
          <tbody>
            <tr *ngFor="let quiz of quizzes()">
              <td>{{ quiz.title }}</td>
              <td>{{ quiz.status }}</td>
              <td>{{ quiz.questionIds?.length || 0 }}</td>
              <td>{{ quiz.passingScore || 0 }}%</td>
            </tr>
          </tbody>
        </table>
        <ng-template #empty><p class="muted">{{ loading() ? 'Đang tải...' : 'Chưa có quiz.' }}</p></ng-template>
      </section>
    </section>
  `,
  styles: [`
    .page{padding:20px;max-width:1100px;margin:0 auto}header{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:16px}h2,h3{margin:0 0 8px;color:#0f172a}p{margin:4px 0;color:#64748b}.grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}.panel{background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:14px;margin-bottom:14px}label{display:flex;flex-direction:column;gap:5px;margin:9px 0;font-size:13px;font-weight:700;color:#334155}input,select,textarea{border:1px solid #cbd5e1;border-radius:6px;padding:8px 10px;font:inherit}button{border:1px solid #cbd5e1;border-radius:6px;padding:8px 12px;background:#fff;cursor:pointer}.primary{background:#2563eb;border-color:#2563eb;color:#fff;font-weight:700}.row{display:grid;grid-template-columns:1fr 1fr;gap:10px}.question-picker{max-height:260px;overflow:auto;border:1px solid #e2e8f0;border-radius:6px;padding:8px}.question-picker label{flex-direction:row;align-items:flex-start;font-weight:500}.error{color:#dc2626}.success{color:#047857}.muted{color:#64748b}table{width:100%;border-collapse:collapse;font-size:13px}th,td{border:1px solid #e2e8f0;padding:8px;text-align:left}th{background:#f8fafc}@media(max-width:800px){.grid,.row{grid-template-columns:1fr}}
  `],
})
export class QuizzesComponent implements OnInit {
  quizzes = signal<Quiz[]>([]);
  questions = signal<QuizQuestion[]>([]);
  loading = signal(false);
  saving = signal(false);
  error = signal('');
  success = signal('');

  questionForm = {
    type: 'SINGLE_CHOICE',
    questionText: '',
    optionsText: 'A|\nB|',
    correctOptionIdsText: 'A',
    explanation: '',
    points: 1,
    status: 'APPROVED',
  };

  quizForm = {
    title: '',
    description: '',
    introVideoUrl: '',
    introVideoTitle: '',
    questionIds: [] as string[],
    maxAttempts: 1,
    passingScore: 0,
    showCorrectAnswersAfterSubmit: true,
  };

  constructor(private readonly quizService: QuizService) {}

  ngOnInit() { this.reload(); }

  approvedQuestions() {
    return this.questions().filter((q) => q.status === 'APPROVED');
  }

  async reload() {
    this.loading.set(true);
    this.error.set('');
    try {
      const [questions, quizzes] = await Promise.all([
        this.quizService.listQuestions(),
        this.quizService.listQuizzes(),
      ]);
      this.questions.set(questions);
      this.quizzes.set(quizzes);
    } catch (err: any) {
      this.error.set(err?.error?.message || err?.message || 'Không thể tải quiz.');
    } finally {
      this.loading.set(false);
    }
  }

  async createQuestion() {
    this.saving.set(true);
    this.error.set('');
    this.success.set('');
    try {
      const options = this.questionForm.optionsText.split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const [id, ...rest] = line.split('|');
          return { id: id.trim(), text: rest.join('|').trim() };
        })
        .filter((option) => option.id && option.text);
      await this.quizService.createQuestion({
        type: this.questionForm.type as any,
        questionText: this.questionForm.questionText,
        options,
        correctOptionIds: this.questionForm.correctOptionIdsText.split(',').map((item) => item.trim()).filter(Boolean),
        explanation: this.questionForm.explanation,
        points: Number(this.questionForm.points) || 1,
        status: this.questionForm.status as any,
      });
      this.success.set('Đã tạo câu hỏi.');
      this.questionForm.questionText = '';
      await this.reload();
    } catch (err: any) {
      this.error.set(err?.error?.message || err?.message || 'Không thể tạo câu hỏi.');
    } finally {
      this.saving.set(false);
    }
  }

  toggleQuestion(id: string, checked: boolean) {
    const ids = new Set(this.quizForm.questionIds);
    checked ? ids.add(id) : ids.delete(id);
    this.quizForm.questionIds = Array.from(ids);
  }

  async createQuiz() {
    if (!this.quizForm.title.trim() || this.quizForm.questionIds.length === 0) {
      this.error.set('Cần nhập tiêu đề và chọn ít nhất 1 câu hỏi.');
      return;
    }
    this.saving.set(true);
    this.error.set('');
    this.success.set('');
    try {
      await this.quizService.createQuiz({
        title: this.quizForm.title,
        description: this.quizForm.description,
        introVideoUrl: this.quizForm.introVideoUrl.trim() || undefined,
        introVideoTitle: this.quizForm.introVideoTitle.trim() || undefined,
        questionIds: this.quizForm.questionIds,
        maxAttempts: Number(this.quizForm.maxAttempts) || 1,
        passingScore: Number(this.quizForm.passingScore) || 0,
        showCorrectAnswersAfterSubmit: this.quizForm.showCorrectAnswersAfterSubmit,
        status: 'APPROVED',
      });
      this.success.set('Đã tạo quiz.');
      this.quizForm = { title: '', description: '', introVideoUrl: '', introVideoTitle: '', questionIds: [], maxAttempts: 1, passingScore: 0, showCorrectAnswersAfterSubmit: true };
      await this.reload();
    } catch (err: any) {
      this.error.set(err?.error?.message || err?.message || 'Không thể tạo quiz.');
    } finally {
      this.saving.set(false);
    }
  }
}
