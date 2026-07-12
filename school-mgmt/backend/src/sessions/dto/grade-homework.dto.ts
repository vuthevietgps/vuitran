import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class GradeHomeworkDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(10)
  score!: number;

  @IsString()
  @IsOptional()
  feedback?: string;
}
