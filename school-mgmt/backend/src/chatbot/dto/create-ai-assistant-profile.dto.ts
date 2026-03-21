import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import {
  AiAssistantStatus,
  AiAssistantType,
} from '../schemas/ai-assistant-profile.schema';

export class CreateAiAssistantProfileDto {
  @IsEnum(AiAssistantType)
  assistantType!: AiAssistantType;

  @IsString()
  @IsNotEmpty()
  label!: string;

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
