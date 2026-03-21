import { IsEnum, IsOptional, IsString } from 'class-validator';
import {
  AiAssistantStatus,
  AiAssistantType,
} from '../schemas/ai-assistant-profile.schema';

export class UpdateAiAssistantProfileDto {
  @IsEnum(AiAssistantType)
  @IsOptional()
  assistantType?: AiAssistantType;

  @IsString()
  @IsOptional()
  label?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  rulesPrompt?: string;

  @IsString()
  @IsOptional()
  defaultOpenAITokenId?: string;

  @IsEnum(AiAssistantStatus)
  @IsOptional()
  status?: AiAssistantStatus;
}
