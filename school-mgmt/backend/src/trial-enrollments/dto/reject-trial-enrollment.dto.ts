import { IsDateString, IsOptional, IsString } from 'class-validator';

export class RejectTrialEnrollmentDto {
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
