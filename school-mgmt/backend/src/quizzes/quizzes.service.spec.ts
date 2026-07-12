import { Types } from 'mongoose';
import { Role } from '../common/interfaces/role.enum';
import { QuizzesService } from './quizzes.service';
import { QuestionType, QuizAttemptStatus, QuizStatus } from './schemas/quiz.schema';

function chainLean<T>(value: T) {
  return {
    sort: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    populate: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(value),
  };
}

function buildService(overrides: Partial<Record<string, any>> = {}) {
  return new QuizzesService(
    overrides.questionBankModel ?? {},
    overrides.questionModel ?? {},
    overrides.quizModel ?? {},
    overrides.attemptModel ?? {},
    overrides.studentModel ?? {},
  );
}

describe('QuizzesService', () => {
  it('forces approved-only quiz listing for parents and students', async () => {
    const query = chainLean([]);
    const quizModel = { find: jest.fn().mockReturnValue(query) };
    const service = buildService({ quizModel });

    await service.listQuizzes(
      { status: QuizStatus.DRAFT },
      { sub: new Types.ObjectId().toHexString(), role: Role.PARENT } as any,
    );

    expect(quizModel.find).toHaveBeenCalledWith({ status: QuizStatus.APPROVED });
  });

  it('hides correct answers from non-manager quiz detail responses', async () => {
    const quizId = new Types.ObjectId().toHexString();
    const quizModel = {
      findById: jest.fn().mockReturnValue(
        chainLean({
          _id: quizId,
          title: 'Unit 1 quiz',
          status: QuizStatus.APPROVED,
          questionIds: [
            {
              _id: new Types.ObjectId(),
              type: QuestionType.SINGLE_CHOICE,
              questionText: 'Pick one',
              options: [{ id: 'a', text: 'A' }],
              correctOptionIds: ['a'],
              acceptedTextAnswers: ['A'],
              explanation: 'Because A',
            },
          ],
        }),
      ),
    };
    const service = buildService({ quizModel });

    const result = await service.getQuiz(quizId, {
      sub: new Types.ObjectId().toHexString(),
      role: Role.STUDENT,
    } as any);

    expect(result.questionIds[0].correctOptionIds).toBeUndefined();
    expect(result.questionIds[0].acceptedTextAnswers).toBeUndefined();
    expect(result.questionIds[0].explanation).toBeUndefined();
  });

  it('stores intro video metadata when creating a quiz', async () => {
    const questionId = new Types.ObjectId();
    const createdBy = new Types.ObjectId();
    const questionModel = { countDocuments: jest.fn().mockResolvedValue(1) };
    const quizModel = {
      create: jest.fn().mockImplementation((doc) => Promise.resolve(doc)),
    };
    const service = buildService({ questionModel, quizModel });

    const result = await service.createQuiz(
      {
        title: 'Listening quiz',
        questionIds: [questionId.toHexString()],
        introVideoUrl: 'https://youtu.be/demo123',
        introVideoTitle: 'Short listening video',
        status: QuizStatus.APPROVED,
      },
      { sub: createdBy.toHexString(), role: Role.DIRECTOR } as any,
    );

    expect(result.introVideoUrl).toBe('https://youtu.be/demo123');
    expect(result.introVideoTitle).toBe('Short listening video');
  });

  it('auto-grades submitted choice answers for a parent-owned student', async () => {
    const parentId = new Types.ObjectId();
    const studentId = new Types.ObjectId();
    const quizId = new Types.ObjectId();
    const questionId = new Types.ObjectId();
    const quizModel = {
      findById: jest.fn().mockReturnValue(
        chainLean({
          _id: quizId,
          status: QuizStatus.APPROVED,
          questionIds: [questionId],
          maxAttempts: 2,
        }),
      ),
    };
    const studentModel = {
      findOne: jest.fn().mockReturnValue(chainLean({ _id: studentId })),
    };
    const questionModel = {
      find: jest.fn().mockReturnValue(
        chainLean([
          {
            _id: questionId,
            type: QuestionType.SINGLE_CHOICE,
            points: 5,
            correctOptionIds: ['a'],
          },
        ]),
      ),
    };
    const attemptModel = {
      countDocuments: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockImplementation((doc) => Promise.resolve(doc)),
    };
    const service = buildService({ quizModel, studentModel, questionModel, attemptModel });

    const result = await service.submitAttempt(
      quizId.toHexString(),
      {
        studentId: studentId.toHexString(),
        answers: [{ questionId: questionId.toHexString(), selectedOptionIds: ['a'] }],
      },
      { sub: parentId.toHexString(), role: Role.PARENT } as any,
    );

    expect(studentModel.findOne).toHaveBeenCalledWith({
      _id: studentId,
      $or: [{ parentUserId: parentId }, { parentUserIds: parentId }],
    });
    expect(result.finalScore).toBe(5);
    expect(result.percentScore).toBe(100);
    expect(result.status).toBe(QuizAttemptStatus.GRADED);
    expect(result.answers[0].isCorrect).toBe(true);
  });

  it('marks quiz attempts with essay answers as needing teacher grading', async () => {
    const studentUserId = new Types.ObjectId();
    const studentId = new Types.ObjectId();
    const quizId = new Types.ObjectId();
    const questionId = new Types.ObjectId();
    const quizModel = {
      findById: jest.fn().mockReturnValue(
        chainLean({
          _id: quizId,
          status: QuizStatus.APPROVED,
          questionIds: [questionId],
          maxAttempts: 1,
        }),
      ),
    };
    const studentModel = {
      findOne: jest.fn().mockReturnValue(chainLean({ _id: studentId })),
    };
    const questionModel = {
      find: jest.fn().mockReturnValue(
        chainLean([
          {
            _id: questionId,
            type: QuestionType.ESSAY,
            points: 10,
          },
        ]),
      ),
    };
    const attemptModel = {
      countDocuments: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockImplementation((doc) => Promise.resolve(doc)),
    };
    const service = buildService({ quizModel, studentModel, questionModel, attemptModel });

    const result = await service.submitAttempt(
      quizId.toHexString(),
      {
        answers: [{ questionId: questionId.toHexString(), textAnswer: 'My essay answer' }],
      },
      { sub: studentUserId.toHexString(), role: Role.STUDENT } as any,
    );

    expect(result.status).toBe(QuizAttemptStatus.NEEDS_GRADING);
    expect(result.finalScore).toBe(0);
    expect(result.answers[0].isCorrect).toBeUndefined();
  });

  it('allows managers to finalize a manually graded quiz attempt', async () => {
    const attempt = {
      _id: new Types.ObjectId(),
      maxScore: 10,
      autoScore: 2,
      finalScore: 2,
      status: QuizAttemptStatus.NEEDS_GRADING,
      save: jest.fn().mockImplementation(function (this: any) {
        return Promise.resolve(this);
      }),
    };
    const attemptModel = { findById: jest.fn().mockResolvedValue(attempt) };
    const service = buildService({ attemptModel });

    const result = await service.gradeAttempt(
      attempt._id.toHexString(),
      { manualScore: 8, manualFeedback: 'Good essay' },
      { sub: new Types.ObjectId().toHexString(), role: Role.EXPERIENCE_TEACHER } as any,
    );

    expect(result.finalScore).toBe(8);
    expect(result.percentScore).toBe(80);
    expect(result.status).toBe(QuizAttemptStatus.GRADED);
    expect(result.manualFeedback).toBe('Good essay');
  });
});
