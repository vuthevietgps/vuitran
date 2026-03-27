import { IsEnum, IsMongoId, IsOptional, IsString } from 'class-validator';
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
}
