import { IsDateString, IsMongoId, IsOptional, IsString } from 'class-validator';

export class ConvertTrialEnrollmentDto {
  @IsMongoId()
  @IsOptional()
  studentId?: string;

  @IsMongoId()
  @IsOptional()
  orderId?: string;

  @IsMongoId()
  @IsOptional()
  invoiceId?: string;

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
