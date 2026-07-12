import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, IsMongoId, IsNumber, IsNotEmpty, IsOptional, IsString, Matches, Max, Min } from 'class-validator';

export class CreateTrialEnrollmentDto {
  @IsMongoId()
  classId!: string;

  @IsMongoId()
  productId!: string;

  @IsMongoId()
  @IsOptional()
  saleId?: string;

  @IsMongoId()
  @IsOptional()
  experienceTeacherId?: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsOptional()
  testDate?: string;

  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  @IsOptional()
  testStartTime?: string;

  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  @IsOptional()
  testEndTime?: string;

  @IsString()
  @IsNotEmpty()
  parentName!: string;

  @IsString()
  @IsNotEmpty()
  parentPhone!: string;

  @IsString()
  @IsOptional()
  parentEmail?: string;

  @IsString()
  @IsNotEmpty()
  studentName!: string;

  @IsString()
  @IsOptional()
  studentPhone?: string;

  @IsString()
  @IsOptional()
  studentGrade?: string;

  @IsNumber()
  @Min(1)
  @IsOptional()
  maxTrialSessions?: number;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  assessmentScore?: number;

  @IsString()
  @IsOptional()
  recommendedLevel?: string;

  @IsString()
  @IsOptional()
  assessmentNotes?: string;

  @IsString()
  @IsOptional()
  zoomMeetingUrl?: string;

  @IsString()
  @IsOptional()
  zoomRecordingUrl?: string;

  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @IsOptional()
  resultImageUrls?: string[];

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  listeningScore?: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  speakingScore?: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  readingScore?: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  writingScore?: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  pronunciationScore?: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  grammarScore?: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  vocabularyScore?: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  reflexScore?: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  confidenceScore?: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  focusScore?: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  testDurationMinutes?: number;

  @IsString()
  @IsOptional()
  learningGaps?: string;

  @IsString()
  @IsOptional()
  strengthsObserved?: string;

  @IsString()
  @IsOptional()
  improvementAreas?: string;

  @IsString()
  @IsOptional()
  recommendedRoadmap?: string;

  @IsString()
  @IsOptional()
  suggestedPackage?: string;

  @IsString()
  @IsOptional()
  suggestedSchedule?: string;

  @IsString()
  @IsOptional()
  salesAdvice?: string;

  @IsIn(['HIGH', 'MEDIUM', 'LOW', 'UNKNOWN'])
  @IsOptional()
  closingPotential?: string;

  @IsString()
  @IsOptional()
  technicalNotes?: string;
}
