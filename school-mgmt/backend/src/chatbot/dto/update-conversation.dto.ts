import { IsString, IsOptional, IsArray, IsEnum, IsMongoId } from 'class-validator';
import { ConversationStatus } from '../schemas/conversation.schema';

export class UpdateConversationDto {
  @IsString()
  @IsOptional()
  customerName?: string;

  @IsString()
  @IsOptional()
  customerPhone?: string;

  @IsString()
  @IsOptional()
  customerEmail?: string;

  @IsEnum(ConversationStatus)
  @IsOptional()
  status?: string;

  @IsString()
  @IsOptional()
  assignedAgentId?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsOptional()
  adRefParam?: string;

  @IsMongoId()
  @IsOptional()
  adGroupId?: string;

  @IsString()
  @IsOptional()
  adGroupName?: string;
}
