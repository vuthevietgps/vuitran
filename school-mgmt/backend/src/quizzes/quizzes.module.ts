import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Student, StudentSchema } from '../students/schemas/student.schema';
import { QuizzesController } from './quizzes.controller';
import { QuizzesService } from './quizzes.service';
import {
  QuestionBank,
  QuestionBankSchema,
  Quiz,
  QuizAttempt,
  QuizAttemptSchema,
  QuizQuestion,
  QuizQuestionSchema,
  QuizSchema,
} from './schemas/quiz.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: QuestionBank.name, schema: QuestionBankSchema },
      { name: QuizQuestion.name, schema: QuizQuestionSchema },
      { name: Quiz.name, schema: QuizSchema },
      { name: QuizAttempt.name, schema: QuizAttemptSchema },
      { name: Student.name, schema: StudentSchema },
    ]),
  ],
  controllers: [QuizzesController],
  providers: [QuizzesService],
  exports: [QuizzesService, MongooseModule],
})
export class QuizzesModule {}
