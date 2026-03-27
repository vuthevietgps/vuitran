import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class RecordTrialSessionDto {
  @IsNumber()
  @Min(1)
  @IsOptional()
  count?: number;

  @IsString()
  @IsOptional()
  notes?: string;
}
