import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

export type QuizStatus = 'DRAFT' | 'APPROVED' | 'ARCHIVED';
export type QuestionType = 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'SHORT_TEXT' | 'ESSAY';
export type QuizAttemptStatus = 'IN_PROGRESS' | 'SUBMITTED' | 'NEEDS_GRADING' | 'GRADED';

export interface QuizQuestionOption {
  id: string;
  text: string;
}

export interface QuizQuestion {
  _id: string;
  type: QuestionType;
  questionText: string;
  options?: QuizQuestionOption[];
  correctOptionIds?: string[];
  acceptedTextAnswers?: string[];
  explanation?: string;
  points?: number;
  skills?: string[];
  status?: QuizStatus;
}

export interface Quiz {
  _id: string;
  title: string;
  description?: string;
  introVideoUrl?: string;
  introVideoTitle?: string;
  questionIds?: Array<string | QuizQuestion>;
  subject?: string;
  grade?: string;
  productId?: string | { _id?: string; name?: string; code?: string };
  courseName?: string;
  unitCode?: string;
  lessonCode?: string;
  timeLimitMinutes?: number;
  maxAttempts?: number;
  passingScore?: number;
  showCorrectAnswersAfterSubmit?: boolean;
  status?: QuizStatus;
}

export interface SubmitQuizAttemptPayload {
  studentId?: string;
  sessionId?: string;
  answers: Array<{
    questionId: string;
    selectedOptionIds?: string[];
    textAnswer?: string;
  }>;
}

export interface QuizAttempt {
  _id: string;
  quizId?: Quiz | string;
  studentId?: { _id?: string; fullName?: string; studentCode?: string } | string;
  sessionId?: { _id?: string; scheduledDate?: string; scheduledStartTime?: string } | string;
  answers?: Array<{
    questionId?: QuizQuestion | string;
    selectedOptionIds?: string[];
    textAnswer?: string;
    isCorrect?: boolean;
    score?: number;
  }>;
  autoScore: number;
  manualScore?: number;
  finalScore: number;
  maxScore: number;
  percentScore: number;
  manualFeedback?: string;
  status: QuizAttemptStatus;
  submittedAt?: string;
}

@Injectable({ providedIn: 'root' })
export class QuizService {
  private http = inject(HttpClient);
  private base = `${environment.apiBase}/quizzes`;

  listQuizzes(status?: QuizStatus): Promise<Quiz[]> {
    const suffix = status ? `?status=${encodeURIComponent(status)}` : '';
    return firstValueFrom(this.http.get<Quiz[]>(`${this.base}${suffix}`, { withCredentials: true }));
  }

  getQuiz(id: string): Promise<Quiz> {
    return firstValueFrom(this.http.get<Quiz>(`${this.base}/${id}`, { withCredentials: true }));
  }

  createQuestion(payload: Partial<QuizQuestion>): Promise<QuizQuestion> {
    return firstValueFrom(this.http.post<QuizQuestion>(`${this.base}/questions`, payload, { withCredentials: true }));
  }

  listQuestions(status?: QuizStatus): Promise<QuizQuestion[]> {
    const suffix = status ? `?status=${encodeURIComponent(status)}` : '';
    return firstValueFrom(this.http.get<QuizQuestion[]>(`${this.base}/questions${suffix}`, { withCredentials: true }));
  }

  createQuiz(payload: Partial<Quiz> & { questionIds: string[] }): Promise<Quiz> {
    return firstValueFrom(this.http.post<Quiz>(this.base, payload, { withCredentials: true }));
  }

  submitAttempt(quizId: string, payload: SubmitQuizAttemptPayload): Promise<any> {
    return firstValueFrom(this.http.post(`${this.base}/${quizId}/attempts`, payload, { withCredentials: true }));
  }

  listAttempts(status = 'pending', limit = 100): Promise<QuizAttempt[]> {
    const suffix = `?status=${encodeURIComponent(status)}&limit=${encodeURIComponent(String(limit))}`;
    return firstValueFrom(this.http.get<QuizAttempt[]>(`${this.base}/attempts${suffix}`, { withCredentials: true }));
  }

  gradeAttempt(attemptId: string, payload: { manualScore: number; manualFeedback?: string }): Promise<QuizAttempt> {
    return firstValueFrom(
      this.http.patch<QuizAttempt>(`${this.base}/attempts/${attemptId}/grade`, payload, { withCredentials: true }),
    );
  }
}
