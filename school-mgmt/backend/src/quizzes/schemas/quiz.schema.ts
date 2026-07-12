import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

export type QuestionBankDocument = HydratedDocument<QuestionBank>;
export type QuizQuestionDocument = HydratedDocument<QuizQuestion>;
export type QuizDocument = HydratedDocument<Quiz>;
export type QuizAttemptDocument = HydratedDocument<QuizAttempt>;

export enum QuizStatus {
  DRAFT = 'DRAFT',
  APPROVED = 'APPROVED',
  ARCHIVED = 'ARCHIVED',
}

export enum QuestionType {
  SINGLE_CHOICE = 'SINGLE_CHOICE',
  MULTIPLE_CHOICE = 'MULTIPLE_CHOICE',
  TRUE_FALSE = 'TRUE_FALSE',
  SHORT_TEXT = 'SHORT_TEXT',
  ESSAY = 'ESSAY',
}

export enum QuizAttemptStatus {
  IN_PROGRESS = 'IN_PROGRESS',
  SUBMITTED = 'SUBMITTED',
  NEEDS_GRADING = 'NEEDS_GRADING',
  GRADED = 'GRADED',
}

@Schema({ timestamps: true })
export class QuestionBank {
  @Prop({ type: String, required: true, trim: true })
  title!: string;

  @Prop({ type: String, trim: true })
  description?: string;

  @Prop({ type: String, trim: true, index: true })
  subject?: string;

  @Prop({ type: String, trim: true, index: true })
  grade?: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Product', index: true })
  productId?: Types.ObjectId;

  @Prop({ type: String, trim: true, index: true })
  courseName?: string;

  @Prop({ type: String, trim: true, uppercase: true, index: true })
  unitCode?: string;

  @Prop({ type: String, trim: true, uppercase: true, index: true })
  lessonCode?: string;

  @Prop({ type: String, enum: Object.values(QuizStatus), default: QuizStatus.DRAFT, index: true })
  status!: QuizStatus;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true, index: true })
  createdBy!: Types.ObjectId;
}

export const QuestionBankSchema = SchemaFactory.createForClass(QuestionBank);

@Schema({ _id: false })
export class QuestionOption {
  @Prop({ type: String, required: true })
  id!: string;

  @Prop({ type: String, required: true, trim: true })
  text!: string;
}

export const QuestionOptionSchema = SchemaFactory.createForClass(QuestionOption);

@Schema({ timestamps: true })
export class QuizQuestion {
  @Prop({ type: SchemaTypes.ObjectId, ref: QuestionBank.name, index: true })
  bankId?: Types.ObjectId;

  @Prop({ type: String, enum: Object.values(QuestionType), required: true, index: true })
  type!: QuestionType;

  @Prop({ type: String, required: true, trim: true })
  questionText!: string;

  @Prop({ type: [QuestionOptionSchema], default: [] })
  options!: QuestionOption[];

  @Prop({ type: [String], default: [] })
  correctOptionIds!: string[];

  @Prop({ type: [String], default: [] })
  acceptedTextAnswers!: string[];

  @Prop({ type: String, trim: true })
  explanation?: string;

  @Prop({ type: Number, min: 0, default: 1 })
  points!: number;

  @Prop({ type: String, trim: true, index: true })
  difficulty?: string;

  @Prop({ type: [String], default: [], index: true })
  skills!: string[];

  @Prop({ type: String, enum: Object.values(QuizStatus), default: QuizStatus.DRAFT, index: true })
  status!: QuizStatus;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true, index: true })
  createdBy!: Types.ObjectId;
}

export const QuizQuestionSchema = SchemaFactory.createForClass(QuizQuestion);

@Schema({ timestamps: true })
export class Quiz {
  @Prop({ type: String, required: true, trim: true })
  title!: string;

  @Prop({ type: String, trim: true })
  description?: string;

  @Prop({ type: String, trim: true })
  introVideoUrl?: string;

  @Prop({ type: String, trim: true })
  introVideoTitle?: string;

  @Prop({ type: [SchemaTypes.ObjectId], ref: QuizQuestion.name, default: [] })
  questionIds!: Types.ObjectId[];

  @Prop({ type: String, trim: true, index: true })
  subject?: string;

  @Prop({ type: String, trim: true, index: true })
  grade?: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Product', index: true })
  productId?: Types.ObjectId;

  @Prop({ type: String, trim: true, index: true })
  courseName?: string;

  @Prop({ type: String, trim: true, uppercase: true, index: true })
  unitCode?: string;

  @Prop({ type: String, trim: true, uppercase: true, index: true })
  lessonCode?: string;

  @Prop({ type: Number, min: 1 })
  timeLimitMinutes?: number;

  @Prop({ type: Number, min: 1, default: 1 })
  maxAttempts!: number;

  @Prop({ type: Boolean, default: false })
  shuffleQuestions!: boolean;

  @Prop({ type: Boolean, default: false })
  shuffleOptions!: boolean;

  @Prop({ type: Number, min: 0, max: 100, default: 0 })
  passingScore!: number;

  @Prop({ type: Boolean, default: false })
  showCorrectAnswersAfterSubmit!: boolean;

  @Prop({ type: String, enum: Object.values(QuizStatus), default: QuizStatus.DRAFT, index: true })
  status!: QuizStatus;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true, index: true })
  createdBy!: Types.ObjectId;
}

export const QuizSchema = SchemaFactory.createForClass(Quiz);

@Schema({ _id: false })
export class QuizAttemptAnswer {
  @Prop({ type: SchemaTypes.ObjectId, ref: QuizQuestion.name, required: true })
  questionId!: Types.ObjectId;

  @Prop({ type: [String], default: [] })
  selectedOptionIds!: string[];

  @Prop({ type: String, trim: true })
  textAnswer?: string;

  @Prop({ type: Boolean })
  isCorrect?: boolean;

  @Prop({ type: Number, min: 0, default: 0 })
  score!: number;

  @Prop({ type: String, trim: true })
  feedback?: string;
}

export const QuizAttemptAnswerSchema = SchemaFactory.createForClass(QuizAttemptAnswer);

@Schema({ timestamps: true })
export class QuizAttempt {
  @Prop({ type: SchemaTypes.ObjectId, ref: Quiz.name, required: true, index: true })
  quizId!: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Student', required: true, index: true })
  studentId!: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Session', index: true })
  sessionId?: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true, index: true })
  submittedBy!: Types.ObjectId;

  @Prop({ type: [QuizAttemptAnswerSchema], default: [] })
  answers!: QuizAttemptAnswer[];

  @Prop({ type: Number, min: 0, default: 0 })
  autoScore!: number;

  @Prop({ type: Number, min: 0 })
  manualScore?: number;

  @Prop({ type: String, trim: true })
  manualFeedback?: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', index: true })
  gradedBy?: Types.ObjectId;

  @Prop({ type: Date })
  gradedAt?: Date;

  @Prop({ type: Number, min: 0, default: 0 })
  finalScore!: number;

  @Prop({ type: Number, min: 0, default: 0 })
  maxScore!: number;

  @Prop({ type: Number, min: 0, max: 100, default: 0 })
  percentScore!: number;

  @Prop({ type: String, enum: Object.values(QuizAttemptStatus), default: QuizAttemptStatus.SUBMITTED, index: true })
  status!: QuizAttemptStatus;

  @Prop({ type: Date, default: Date.now })
  submittedAt!: Date;
}

export const QuizAttemptSchema = SchemaFactory.createForClass(QuizAttempt);

QuestionBankSchema.index({ subject: 1, grade: 1, unitCode: 1, lessonCode: 1 });
QuizQuestionSchema.index({ bankId: 1, status: 1, type: 1 });
QuizSchema.index({ status: 1, subject: 1, grade: 1, updatedAt: -1 });
QuizAttemptSchema.index({ quizId: 1, studentId: 1, submittedAt: -1 });
