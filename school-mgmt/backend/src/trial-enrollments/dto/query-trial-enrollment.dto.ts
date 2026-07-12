import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsMongoId, IsOptional, IsString, Max, Min } from 'class-validator';
import { TrialEnrollmentStatus } from '../schemas/trial-enrollment.schema';

export class QueryTrialEnrollmentDto {
  @IsEnum(TrialEnrollmentStatus)
  @IsOptional()
  status?: TrialEnrollmentStatus;

  @IsMongoId()
  @IsOptional()
  classId?: string;

  @IsMongoId()
  @IsOptional()
  productId?: string;

  @IsMongoId()
  @IsOptional()
  saleId?: string;

  @IsMongoId()
  @IsOptional()
  experienceTeacherId?: string;

  @IsMongoId()
  @IsOptional()
  studentId?: string;

  @IsString()
  @IsOptional()
  search?: string;

  @IsString()
  @IsOptional()
  keyword?: string;

  @IsString()
  @IsOptional()
  fromDate?: string;

  @IsString()
  @IsOptional()
  toDate?: string;

  @IsString()
  @IsOptional()
  needsDecision?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number;
}
