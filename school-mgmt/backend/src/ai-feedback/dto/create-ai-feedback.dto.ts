import {
  IsArray,
  IsEnum,
  IsMongoId,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import {
  AiFeedbackCategory,
  AiFeedbackSeverity,
  AiFeedbackSource,
} from '../schemas/ai-feedback.schema';

export class CreateAiFeedbackDto {
  @IsEnum(AiFeedbackSource)
  source!: AiFeedbackSource;

  @IsString()
  @IsOptional()
  @MaxLength(80)
  assistantType?: string;

  @IsMongoId()
  @IsOptional()
  sessionId?: string;

  @IsMongoId()
  @IsOptional()
  messageId?: string;

  @IsString()
  @IsOptional()
  @MaxLength(160)
  activeRoute?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  contextKeys?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  toolKeys?: string[];

  @IsString()
  @IsOptional()
  @MaxLength(6000)
  userMessage?: string;

  @IsString()
  @IsOptional()
  @MaxLength(12000)
  assistantAnswer?: string;

  @IsEnum(AiFeedbackCategory)
  @IsOptional()
  category?: AiFeedbackCategory;

  @IsEnum(AiFeedbackSeverity)
  @IsOptional()
  severity?: AiFeedbackSeverity;

  @IsString()
  @IsOptional()
  @MaxLength(3000)
  reason?: string;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;
}
