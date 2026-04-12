import { IsDateString, IsOptional, IsString } from 'class-validator';

export class TeacherPaidOnlyTrialEnrollmentDto {
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
