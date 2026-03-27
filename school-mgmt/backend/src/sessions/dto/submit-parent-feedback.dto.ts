import { IsInt, IsMongoId, IsOptional, IsString, Max, Min } from 'class-validator';

export class SubmitParentFeedbackDto {
  @IsInt()
  @Min(1)
  @Max(5)
  overallRating!: number;

  @IsInt()
  @Min(1)
  @Max(5)
  @IsOptional()
  teachingQuality?: number;

  @IsInt()
  @Min(1)
  @Max(5)
  @IsOptional()
  communication?: number;

  @IsInt()
  @Min(1)
  @Max(5)
  @IsOptional()
  facility?: number;

  @IsString()
  @IsOptional()
  comment?: string;

  @IsMongoId()
  @IsOptional()
  studentId?: string;

  @IsMongoId()
  @IsOptional()
  sessionId?: string;
}