import { IsMongoId, IsOptional, IsString } from 'class-validator';

export class QueryDirectorAiMessagesDto {
  @IsMongoId()
  sessionId!: string;

  @IsString()
  @IsOptional()
  limit?: string;
}
