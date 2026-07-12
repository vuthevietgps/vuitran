import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Role } from '../common/interfaces/role.enum';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { Student, StudentDocument } from '../students/schemas/student.schema';
import {
  CreateQuestionBankDto,
  CreateQuestionDto,
  CreateQuizDto,
  GradeQuizAttemptDto,
  SubmitQuizAttemptDto,
} from './dto/quiz.dto';
import {
  QuestionBank,
  QuestionBankDocument,
  QuestionType,
  Quiz,
  QuizAttempt,
  QuizAttemptDocument,
  QuizAttemptStatus,
  QuizDocument,
  QuizQuestion,
  QuizQuestionDocument,
  QuizStatus,
} from './schemas/quiz.schema';

@Injectable()
export class QuizzesService {
  constructor(
    @InjectModel(QuestionBank.name)
    private questionBankModel: Model<QuestionBankDocument>,
    @InjectModel(QuizQuestion.name)
    private questionModel: Model<QuizQuestionDocument>,
    @InjectModel(Quiz.name)
    private quizModel: Model<QuizDocument>,
    @InjectModel(QuizAttempt.name)
    private attemptModel: Model<QuizAttemptDocument>,
    @InjectModel(Student.name)
    private studentModel: Model<StudentDocument>,
  ) {}

  private actorObjectId(actor: JwtPayload): Types.ObjectId {
    const id = actor.sub || actor._id;
    if (!id || !Types.ObjectId.isValid(id)) {
      throw new ForbiddenException('Khong xac dinh duoc tai khoan');
    }
    return new Types.ObjectId(id);
  }

  private objectIdOrUndefined(id?: string): Types.ObjectId | undefined {
    return id && Types.ObjectId.isValid(id) ? new Types.ObjectId(id) : undefined;
  }

  private normalizeCode(value?: string): string | undefined {
    const trimmed = value?.trim();
    return trimmed ? trimmed.toUpperCase() : undefined;
  }

  private normalizeStringArray(values?: string[]): string[] {
    if (!Array.isArray(values)) return [];
    return values.map((item) => String(item).trim()).filter(Boolean);
  }

  private canManageQuiz(actor: JwtPayload): boolean {
    return [Role.DIRECTOR, Role.OPS].includes(actor.role as Role);
  }

  private assertCanGradeQuiz(actor?: JwtPayload) {
    if (!actor) return;
    if (!this.canManageQuiz(actor) && actor.role !== Role.EXPERIENCE_TEACHER) {
      throw new ForbiddenException('Ban khong co quyen cham quiz');
    }
  }

  async createQuestionBank(dto: CreateQuestionBankDto, actor: JwtPayload) {
    if (!this.canManageQuiz(actor)) {
      throw new ForbiddenException('Ban khong co quyen tao ngan hang cau hoi');
    }
    return this.questionBankModel.create({
      title: dto.title.trim(),
      description: dto.description?.trim() || undefined,
      subject: dto.subject?.trim() || undefined,
      grade: dto.grade?.trim() || undefined,
      productId: this.objectIdOrUndefined(dto.productId),
      courseName: dto.courseName?.trim() || undefined,
      unitCode: this.normalizeCode(dto.unitCode),
      lessonCode: this.normalizeCode(dto.lessonCode),
      status: dto.status || QuizStatus.DRAFT,
      createdBy: this.actorObjectId(actor),
    });
  }

  async listQuestionBanks() {
    return this.questionBankModel.find().sort({ updatedAt: -1 }).lean();
  }

  async createQuestion(dto: CreateQuestionDto, actor: JwtPayload) {
    if (!this.canManageQuiz(actor)) {
      throw new ForbiddenException('Ban khong co quyen tao cau hoi');
    }
    this.validateQuestionPayload(dto);
    return this.questionModel.create({
      bankId: this.objectIdOrUndefined(dto.bankId),
      type: dto.type,
      questionText: dto.questionText.trim(),
      options: dto.options || [],
      correctOptionIds: this.normalizeStringArray(dto.correctOptionIds),
      acceptedTextAnswers: this.normalizeStringArray(dto.acceptedTextAnswers),
      explanation: dto.explanation?.trim() || undefined,
      points: dto.points ?? 1,
      difficulty: dto.difficulty?.trim() || undefined,
      skills: this.normalizeStringArray(dto.skills),
      status: dto.status || QuizStatus.DRAFT,
      createdBy: this.actorObjectId(actor),
    });
  }

  private validateQuestionPayload(dto: CreateQuestionDto) {
    const options = dto.options || [];
    const correctIds = new Set(this.normalizeStringArray(dto.correctOptionIds));
    if (
      [QuestionType.SINGLE_CHOICE, QuestionType.MULTIPLE_CHOICE, QuestionType.TRUE_FALSE].includes(
        dto.type,
      )
    ) {
      if (options.length < 2) {
        throw new BadRequestException('Cau hoi trac nghiem can it nhat 2 lua chon');
      }
      const optionIds = new Set(options.map((option) => option.id));
      if (correctIds.size === 0) {
        throw new BadRequestException('Cau hoi trac nghiem can dap an dung');
      }
      for (const id of correctIds) {
        if (!optionIds.has(id)) {
          throw new BadRequestException('Dap an dung khong nam trong danh sach lua chon');
        }
      }
      if (dto.type === QuestionType.SINGLE_CHOICE && correctIds.size !== 1) {
        throw new BadRequestException('Cau hoi mot dap an chi duoc co 1 dap an dung');
      }
    }
  }

  async listQuestions(query: { bankId?: string; status?: QuizStatus } = {}) {
    const filter: Record<string, unknown> = {};
    if (query.bankId && Types.ObjectId.isValid(query.bankId)) {
      filter.bankId = new Types.ObjectId(query.bankId);
    }
    if (query.status) filter.status = query.status;
    return this.questionModel.find(filter).sort({ updatedAt: -1 }).lean();
  }

  async createQuiz(dto: CreateQuizDto, actor: JwtPayload) {
    if (!this.canManageQuiz(actor)) {
      throw new ForbiddenException('Ban khong co quyen tao quiz');
    }
    const questionIds = dto.questionIds.map((id) => new Types.ObjectId(id));
    const questionCount = await this.questionModel.countDocuments({
      _id: { $in: questionIds },
      status: QuizStatus.APPROVED,
    });
    if (questionCount !== questionIds.length) {
      throw new BadRequestException('Quiz chi duoc dung cau hoi da duyet');
    }
    return this.quizModel.create({
      title: dto.title.trim(),
      description: dto.description?.trim() || undefined,
      introVideoUrl: dto.introVideoUrl?.trim() || undefined,
      introVideoTitle: dto.introVideoTitle?.trim() || undefined,
      questionIds,
      subject: dto.subject?.trim() || undefined,
      grade: dto.grade?.trim() || undefined,
      productId: this.objectIdOrUndefined(dto.productId),
      courseName: dto.courseName?.trim() || undefined,
      unitCode: this.normalizeCode(dto.unitCode),
      lessonCode: this.normalizeCode(dto.lessonCode),
      timeLimitMinutes: dto.timeLimitMinutes,
      maxAttempts: dto.maxAttempts ?? 1,
      shuffleQuestions: dto.shuffleQuestions === true,
      shuffleOptions: dto.shuffleOptions === true,
      passingScore: dto.passingScore ?? 0,
      showCorrectAnswersAfterSubmit: dto.showCorrectAnswersAfterSubmit === true,
      status: dto.status || QuizStatus.DRAFT,
      createdBy: this.actorObjectId(actor),
    });
  }

  async listQuizzes(query: { status?: QuizStatus } = {}, actor?: JwtPayload) {
    const filter: Record<string, unknown> = {};
    if (actor && !this.canManageQuiz(actor)) {
      filter.status = QuizStatus.APPROVED;
    } else if (query.status) {
      filter.status = query.status;
    }
    return this.quizModel.find(filter).sort({ updatedAt: -1 }).lean();
  }

  async getQuiz(id: string, actor: JwtPayload) {
    const quiz = await this.quizModel
      .findById(id)
      .populate('questionIds')
      .lean<any>();
    if (!quiz) throw new NotFoundException('Quiz khong ton tai');
    if (!this.canManageQuiz(actor) && quiz.status !== QuizStatus.APPROVED) {
      throw new NotFoundException('Quiz khong ton tai');
    }
    return this.sanitizeQuizForActor(quiz, actor);
  }

  private sanitizeQuizForActor(quiz: any, actor: JwtPayload) {
    if (this.canManageQuiz(actor)) return quiz;
    const showAnswers = false;
    return {
      ...quiz,
      questionIds: (quiz.questionIds || []).map((question: any) =>
        this.sanitizeQuestion(question, showAnswers),
      ),
    };
  }

  private sanitizeQuestion(question: any, showAnswers: boolean) {
    const safe = { ...question };
    if (!showAnswers) {
      delete safe.correctOptionIds;
      delete safe.acceptedTextAnswers;
      delete safe.explanation;
    }
    return safe;
  }

  async submitAttempt(quizId: string, dto: SubmitQuizAttemptDto, actor: JwtPayload) {
    const quiz = await this.quizModel.findById(quizId).lean<any>();
    if (!quiz || quiz.status !== QuizStatus.APPROVED) {
      throw new NotFoundException('Quiz khong ton tai hoac chua duoc duyet');
    }
    const studentId = await this.resolveStudentId(actor, dto.studentId);
    await this.assertAttemptLimit(quiz, studentId);

    const questions = await this.questionModel
      .find({ _id: { $in: quiz.questionIds } })
      .lean<any[]>();
    const questionMap = new Map(questions.map((question) => [question._id.toString(), question]));
    const gradedAnswers = (dto.answers || []).map((answer) => {
      const question = questionMap.get(answer.questionId);
      if (!question) {
        throw new BadRequestException('Cau tra loi co cau hoi khong thuoc quiz');
      }
      return this.gradeAnswer(question, answer);
    });
    const maxScore = questions.reduce((sum, question) => sum + Number(question.points || 0), 0);
    const autoScore = gradedAnswers.reduce((sum, answer) => sum + answer.score, 0);
    const percentScore = maxScore > 0 ? Math.round((autoScore / maxScore) * 10000) / 100 : 0;
    const needsManualGrading = gradedAnswers.some((answer) => answer.isCorrect === undefined);

    return this.attemptModel.create({
      quizId: new Types.ObjectId(quizId),
      studentId,
      sessionId: this.objectIdOrUndefined(dto.sessionId),
      submittedBy: this.actorObjectId(actor),
      answers: gradedAnswers,
      autoScore,
      finalScore: autoScore,
      maxScore,
      percentScore,
      status: needsManualGrading ? QuizAttemptStatus.NEEDS_GRADING : QuizAttemptStatus.GRADED,
      submittedAt: new Date(),
    });
  }

  async listAttemptsForGrading(query?: { status?: string; limit?: string }, actor?: JwtPayload) {
    this.assertCanGradeQuiz(actor);
    const limit = Math.min(200, Math.max(1, Number(query?.limit) || 100));
    const filter: Record<string, unknown> = {};
    if ((query?.status || 'pending') === 'pending') {
      filter.status = QuizAttemptStatus.NEEDS_GRADING;
    }
    return this.attemptModel
      .find(filter)
      .sort({ submittedAt: -1 })
      .limit(limit)
      .populate('quizId', 'title subject grade courseName unitCode lessonCode passingScore')
      .populate('studentId', 'fullName studentCode')
      .populate('sessionId', 'scheduledDate scheduledStartTime classId')
      .populate('answers.questionId', 'type questionText options points')
      .lean();
  }

  async findAttemptForGrading(attemptId: string, actor: JwtPayload) {
    this.assertCanGradeQuiz(actor);
    if (!Types.ObjectId.isValid(attemptId)) {
      throw new BadRequestException('attemptId khong hop le');
    }
    const attempt = await this.attemptModel
      .findById(attemptId)
      .populate('quizId', 'title subject grade courseName unitCode lessonCode passingScore')
      .populate('studentId', 'fullName studentCode')
      .populate('sessionId', 'scheduledDate scheduledStartTime classId')
      .populate('answers.questionId', 'type questionText options points')
      .lean();
    if (!attempt) throw new NotFoundException('Bai lam quiz khong ton tai');
    return attempt;
  }

  async gradeAttempt(attemptId: string, dto: GradeQuizAttemptDto, actor: JwtPayload) {
    this.assertCanGradeQuiz(actor);
    const attempt = await this.attemptModel.findById(attemptId);
    if (!attempt) throw new NotFoundException('Bai lam quiz khong ton tai');
    const manualScore = Number(dto.manualScore);
    if (!Number.isFinite(manualScore) || manualScore < 0 || manualScore > Number(attempt.maxScore || 0)) {
      throw new BadRequestException('Diem quiz khong hop le');
    }
    attempt.manualScore = manualScore;
    attempt.finalScore = manualScore;
    attempt.percentScore =
      attempt.maxScore > 0 ? Math.round((manualScore / attempt.maxScore) * 10000) / 100 : 0;
    attempt.manualFeedback = dto.manualFeedback?.trim() || undefined;
    attempt.status = QuizAttemptStatus.GRADED;
    attempt.gradedBy = this.actorObjectId(actor);
    attempt.gradedAt = new Date();
    return attempt.save();
  }

  private async resolveStudentId(actor: JwtPayload, requestedStudentId?: string): Promise<Types.ObjectId> {
    if (actor.role === Role.STUDENT) {
      const student = await this.studentModel
        .findOne({ studentUserId: this.actorObjectId(actor) })
        .select('_id')
        .lean();
      if (!student) throw new ForbiddenException('Tai khoan hoc sinh chua lien ket ho so hoc vien');
      return student._id as Types.ObjectId;
    }

    if (actor.role === Role.PARENT) {
      if (!requestedStudentId || !Types.ObjectId.isValid(requestedStudentId)) {
        throw new BadRequestException('Can chon hoc sinh de nop quiz');
      }
      const student = await this.studentModel
        .findOne({
          _id: new Types.ObjectId(requestedStudentId),
          $or: [
            { parentUserId: this.actorObjectId(actor) },
            { parentUserIds: this.actorObjectId(actor) },
          ],
        })
        .select('_id')
        .lean();
      if (!student) throw new ForbiddenException('Ban khong phai phu huynh cua hoc sinh nay');
      return student._id as Types.ObjectId;
    }

    throw new ForbiddenException('Chi hoc sinh hoac phu huynh moi duoc nop quiz');
  }

  private async assertAttemptLimit(quiz: any, studentId: Types.ObjectId) {
    const count = await this.attemptModel.countDocuments({
      quizId: quiz._id,
      studentId,
    });
    if (count >= Number(quiz.maxAttempts || 1)) {
      throw new BadRequestException('Hoc sinh da het so lan lam quiz');
    }
  }

  private gradeAnswer(question: any, answer: any) {
    const selectedOptionIds = this.normalizeStringArray(answer.selectedOptionIds).sort();
    const correctOptionIds = this.normalizeStringArray(question.correctOptionIds).sort();
    let isCorrect: boolean | undefined;

    if (
      [QuestionType.SINGLE_CHOICE, QuestionType.MULTIPLE_CHOICE, QuestionType.TRUE_FALSE].includes(
        question.type,
      )
    ) {
      isCorrect =
        selectedOptionIds.length === correctOptionIds.length &&
        selectedOptionIds.every((id, index) => id === correctOptionIds[index]);
    } else if (question.type === QuestionType.SHORT_TEXT) {
      const normalizedAnswer = String(answer.textAnswer || '').trim().toLowerCase();
      const accepted = this.normalizeStringArray(question.acceptedTextAnswers).map((item) =>
        item.toLowerCase(),
      );
      isCorrect = accepted.length > 0 ? accepted.includes(normalizedAnswer) : undefined;
    }

    return {
      questionId: new Types.ObjectId(answer.questionId),
      selectedOptionIds,
      textAnswer: answer.textAnswer?.trim() || undefined,
      isCorrect,
      score: isCorrect === true ? Number(question.points || 0) : 0,
    };
  }
}
