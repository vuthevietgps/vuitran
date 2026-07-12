import { IsEnum, IsMongoId, IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';
import { AiAssistantType } from '../../chatbot/schemas/ai-assistant-profile.schema';
import { AiActionDraftStatus, AiActionKey, AiEntityType } from '../ai-core.types';

export class PreviewAiActionDto {
  @IsEnum(AiActionKey)
  actionKey!: AiActionKey;

  @IsEnum(AiEntityType)
  @IsOptional()
  entityType?: AiEntityType;

  @IsMongoId()
  @IsOptional()
  entityId?: string;

  @IsObject()
  @IsNotEmpty()
  payload!: Record<string, unknown>;

  @IsMongoId()
  @IsOptional()
  sessionId?: string;

  @IsEnum(AiAssistantType)
  @IsOptional()
  assistantType?: AiAssistantType;

  @IsString()
  @IsOptional()
  sourceMessage?: string;
}

export class ConfirmAiActionDto {
  @IsString()
  @IsOptional()
  confirmationText?: string;
}

export class ApproveAiActionDto {
  @IsString()
  @IsOptional()
  approvalNote?: string;
}

export class RejectAiActionDto {
  @IsString()
  @IsOptional()
  reason?: string;
}

export class QueryAiActionsDto {
  @IsEnum(AiActionDraftStatus)
  @IsOptional()
  status?: AiActionDraftStatus;

  @IsEnum(AiAssistantType)
  @IsOptional()
  assistantType?: AiAssistantType;

  @IsString()
  @IsOptional()
  limit?: string;
}
