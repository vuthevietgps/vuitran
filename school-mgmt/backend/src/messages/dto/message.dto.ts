import { IsString, IsNotEmpty, IsOptional, IsMongoId } from 'class-validator';

export class SendMessageDto {
  @IsMongoId()
  receiverId!: string;

  @IsMongoId()
  @IsOptional()
  contextStudentId?: string;

  @IsString()
  @IsNotEmpty()
  content!: string;
}

export class SendToConversationDto {
  @IsMongoId()
  conversationId!: string;

  @IsString()
  @IsNotEmpty()
  content!: string;
}
