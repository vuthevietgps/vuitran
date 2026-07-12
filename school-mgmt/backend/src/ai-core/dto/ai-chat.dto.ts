import { IsEnum, IsMongoId, IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';
import { AiAssistantType } from '../../chatbot/schemas/ai-assistant-profile.schema';
import { AiActionKey, AiEntityType } from '../ai-core.types';

export class AiChatDto {
  @IsString()
  @IsNotEmpty()
  message!: string;

  @IsEnum(AiAssistantType)
  @IsOptional()
  assistantType?: AiAssistantType;

  @IsMongoId()
  @IsOptional()
  sessionId?: string;

  @IsString()
  @IsOptional()
  contextMode?: string;

  @IsString()
  @IsOptional()
  fromDate?: string;

  @IsString()
  @IsOptional()
  toDate?: string;

  @IsString()
  @IsOptional()
  activeRoute?: string;

  @IsObject()
  @IsOptional()
  filters?: Record<string, unknown>;

  @IsObject()
  @IsOptional()
  entityContext?: {
    type: string;
    id: string;
  };

  @IsObject()
  @IsOptional()
  actionDraft?: {
    actionKey: AiActionKey;
    entityType?: AiEntityType;
    entityId?: string;
    payload: Record<string, unknown>;
  };
}
