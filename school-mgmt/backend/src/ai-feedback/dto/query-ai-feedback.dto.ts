import { Type } from 'class-transformer';
import { IsEnum, IsOptional, IsString, Max, Min } from 'class-validator';
import {
  AiFeedbackCategory,
  AiFeedbackSeverity,
  AiFeedbackSource,
  AiFeedbackStatus,
} from '../schemas/ai-feedback.schema';

export class QueryAiFeedbackDto {
  @Type(() => Number)
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @Type(() => Number)
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number = 30;

  @IsEnum(AiFeedbackStatus)
  @IsOptional()
  status?: AiFeedbackStatus;

  @IsEnum(AiFeedbackSource)
  @IsOptional()
  source?: AiFeedbackSource;

  @IsString()
  @IsOptional()
  assistantType?: string;

  @IsEnum(AiFeedbackCategory)
  @IsOptional()
  category?: AiFeedbackCategory;

  @IsEnum(AiFeedbackSeverity)
  @IsOptional()
  severity?: AiFeedbackSeverity;

  @IsString()
  @IsOptional()
  userRole?: string;

  @IsString()
  @IsOptional()
  search?: string;

  @IsString()
  @IsOptional()
  fromDate?: string;

  @IsString()
  @IsOptional()
  toDate?: string;
}
