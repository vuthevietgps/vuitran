import { Type } from 'class-transformer';
import { IsEnum, IsMongoId, IsOptional, IsString, Max, Min } from 'class-validator';
import { AiAssistantType } from '../../chatbot/schemas/ai-assistant-profile.schema';

export class QueryAiMessagesDto {
  @IsMongoId()
  sessionId!: string;

  @IsString()
  @IsOptional()
  limit?: string;
}

export class QueryAiSessionsDto {
  @IsEnum(AiAssistantType)
  @IsOptional()
  assistantType?: AiAssistantType;
}

export class QueryAiConversationCorpusDto {
  @Type(() => Number)
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @Type(() => Number)
  @Min(1)
  @Max(50)
  @IsOptional()
  limit?: number = 30;

  @IsEnum(AiAssistantType)
  @IsOptional()
  assistantType?: AiAssistantType;

  @IsString()
  @IsOptional()
  situationKey?: string;

  @IsString()
  @IsOptional()
  source?: string;

  @IsString()
  @IsOptional()
  activeRoute?: string;

  @IsString()
  @IsOptional()
  fromDate?: string;

  @IsString()
  @IsOptional()
  toDate?: string;

  @IsString()
  @IsOptional()
  search?: string;
}
