import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuthenticatedRequest } from '../common/interfaces/authenticated-request.interface';
import { Role } from '../common/interfaces/role.enum';
import { ParseMongoIdPipe } from '../common/pipes/parse-mongo-id.pipe';
import {
  CreateQuestionBankDto,
  CreateQuestionDto,
  CreateQuizDto,
  GradeQuizAttemptDto,
  SubmitQuizAttemptDto,
} from './dto/quiz.dto';
import { QuizStatus } from './schemas/quiz.schema';
import { QuizzesService } from './quizzes.service';

@Controller('quizzes')
@UseGuards(JwtAuthGuard, RolesGuard)
export class QuizzesController {
  constructor(private readonly quizzesService: QuizzesService) {}

  @Post('banks')
  @Roles(Role.DIRECTOR, Role.OPS)
  createQuestionBank(@Body() dto: CreateQuestionBankDto, @Req() req: AuthenticatedRequest) {
    return this.quizzesService.createQuestionBank(dto, req.user);
  }

  @Get('banks')
  @Roles(Role.DIRECTOR, Role.OPS, Role.TEACHER, Role.EXPERIENCE_TEACHER)
  listQuestionBanks() {
    return this.quizzesService.listQuestionBanks();
  }

  @Post('questions')
  @Roles(Role.DIRECTOR, Role.OPS)
  createQuestion(@Body() dto: CreateQuestionDto, @Req() req: AuthenticatedRequest) {
    return this.quizzesService.createQuestion(dto, req.user);
  }

  @Get('questions')
  @Roles(Role.DIRECTOR, Role.OPS, Role.TEACHER, Role.EXPERIENCE_TEACHER)
  listQuestions(@Query('bankId') bankId?: string, @Query('status') status?: QuizStatus) {
    return this.quizzesService.listQuestions({ bankId, status });
  }

  @Post()
  @Roles(Role.DIRECTOR, Role.OPS)
  createQuiz(@Body() dto: CreateQuizDto, @Req() req: AuthenticatedRequest) {
    return this.quizzesService.createQuiz(dto, req.user);
  }

  @Get()
  @Roles(Role.DIRECTOR, Role.OPS, Role.TEACHER, Role.EXPERIENCE_TEACHER, Role.PARENT, Role.STUDENT)
  listQuizzes(@Query('status') status: QuizStatus | undefined, @Req() req: AuthenticatedRequest) {
    return this.quizzesService.listQuizzes({ status }, req.user);
  }

  @Get('attempts')
  @Roles(Role.DIRECTOR, Role.OPS, Role.EXPERIENCE_TEACHER)
  listAttempts(
    @Query('status') status: string | undefined,
    @Query('limit') limit: string | undefined,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.quizzesService.listAttemptsForGrading({ status, limit }, req.user);
  }

  @Patch('attempts/:attemptId/grade')
  @Roles(Role.DIRECTOR, Role.OPS, Role.EXPERIENCE_TEACHER)
  gradeAttempt(
    @Param('attemptId', ParseMongoIdPipe) attemptId: string,
    @Body() dto: GradeQuizAttemptDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.quizzesService.gradeAttempt(attemptId, dto, req.user);
  }

  @Get(':id')
  @Roles(Role.DIRECTOR, Role.OPS, Role.TEACHER, Role.EXPERIENCE_TEACHER, Role.PARENT, Role.STUDENT)
  getQuiz(@Param('id', ParseMongoIdPipe) id: string, @Req() req: AuthenticatedRequest) {
    return this.quizzesService.getQuiz(id, req.user);
  }

  @Post(':id/attempts')
  @Roles(Role.PARENT, Role.STUDENT)
  submitAttempt(
    @Param('id', ParseMongoIdPipe) id: string,
    @Body() dto: SubmitQuizAttemptDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.quizzesService.submitAttempt(id, dto, req.user);
  }
}
