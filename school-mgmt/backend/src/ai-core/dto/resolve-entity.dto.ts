import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { AiAssistantType } from '../../chatbot/schemas/ai-assistant-profile.schema';
import { AiEntityType } from '../ai-core.types';

export class ResolveAiEntityDto {
  @IsString()
  @IsNotEmpty()
  q!: string;

  @IsEnum(AiEntityType)
  @IsOptional()
  type?: AiEntityType;

  @IsString()
  @IsOptional()
  limit?: string;

  @IsEnum(AiAssistantType)
  @IsOptional()
  assistantType?: AiAssistantType;
}
