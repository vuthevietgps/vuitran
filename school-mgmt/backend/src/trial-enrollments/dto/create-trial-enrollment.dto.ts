import { IsMongoId, IsNumber, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class CreateTrialEnrollmentDto {
  @IsMongoId()
  classId!: string;

  @IsMongoId()
  productId!: string;

  @IsMongoId()
  @IsOptional()
  saleId?: string;

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
}
