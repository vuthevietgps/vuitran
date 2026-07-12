import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { QuestionType, QuizStatus } from '../schemas/quiz.schema';

export class CreateQuestionBankDto {
  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  subject?: string;

  @IsOptional()
  @IsString()
  grade?: string;

  @IsOptional()
  @IsMongoId()
  productId?: string;

  @IsOptional()
  @IsString()
  courseName?: string;

  @IsOptional()
  @IsString()
  unitCode?: string;

  @IsOptional()
  @IsString()
  lessonCode?: string;

  @IsOptional()
  @IsEnum(QuizStatus)
  status?: QuizStatus;
}

export class QuestionOptionDto {
  @IsString()
  id!: string;

  @IsString()
  text!: string;
}

export class CreateQuestionDto {
  @IsOptional()
  @IsMongoId()
  bankId?: string;

  @IsEnum(QuestionType)
  type!: QuestionType;

  @IsString()
  questionText!: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuestionOptionDto)
  options?: QuestionOptionDto[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  correctOptionIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  acceptedTextAnswers?: string[];

  @IsOptional()
  @IsString()
  explanation?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  points?: number;

  @IsOptional()
  @IsString()
  difficulty?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  skills?: string[];

  @IsOptional()
  @IsEnum(QuizStatus)
  status?: QuizStatus;
}

export class CreateQuizDto {
  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUrl({ require_protocol: true }, { message: 'introVideoUrl phai la URL hop le' })
  @MaxLength(1000)
  introVideoUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  introVideoTitle?: string;

  @IsArray()
  @IsMongoId({ each: true })
  questionIds!: string[];

  @IsOptional()
  @IsString()
  subject?: string;

  @IsOptional()
  @IsString()
  grade?: string;

  @IsOptional()
  @IsMongoId()
  productId?: string;

  @IsOptional()
  @IsString()
  courseName?: string;

  @IsOptional()
  @IsString()
  unitCode?: string;

  @IsOptional()
  @IsString()
  lessonCode?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  timeLimitMinutes?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  maxAttempts?: number;

  @IsOptional()
  @IsBoolean()
  shuffleQuestions?: boolean;

  @IsOptional()
  @IsBoolean()
  shuffleOptions?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  passingScore?: number;

  @IsOptional()
  @IsBoolean()
  showCorrectAnswersAfterSubmit?: boolean;

  @IsOptional()
  @IsEnum(QuizStatus)
  status?: QuizStatus;
}

export class QuizAnswerDto {
  @IsMongoId()
  questionId!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  selectedOptionIds?: string[];

  @IsOptional()
  @IsString()
  textAnswer?: string;
}

export class SubmitQuizAttemptDto {
  @IsOptional()
  @IsMongoId()
  studentId?: string;

  @IsOptional()
  @IsMongoId()
  sessionId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuizAnswerDto)
  answers!: QuizAnswerDto[];
}

export class GradeQuizAttemptDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  manualScore!: number;

  @IsOptional()
  @IsString()
  manualFeedback?: string;
}
