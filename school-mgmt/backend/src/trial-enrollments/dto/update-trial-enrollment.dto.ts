import { PartialType } from '@nestjs/mapped-types';
import { IsDateString, IsEnum, IsMongoId, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { CreateTrialEnrollmentDto } from './create-trial-enrollment.dto';
import { TrialEnrollmentStatus } from '../schemas/trial-enrollment.schema';

export class UpdateTrialEnrollmentDto extends PartialType(CreateTrialEnrollmentDto) {
  @IsEnum(TrialEnrollmentStatus)
  @IsOptional()
  status?: TrialEnrollmentStatus;

  @IsMongoId()
  @IsOptional()
  studentId?: string;

  @IsMongoId()
  @IsOptional()
  orderId?: string;

  @IsMongoId()
  @IsOptional()
  invoiceId?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  trialSessionsUsed?: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  assessmentScore?: number;

  @IsDateString()
  @IsOptional()
  decisionAt?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsOptional()
  decisionNotes?: string;
}
