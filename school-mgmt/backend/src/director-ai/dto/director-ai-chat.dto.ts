import { IsEnum, IsMongoId, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export enum DirectorAiContextMode {
  AUTO = 'AUTO',
  OVERVIEW = 'OVERVIEW',
  FINANCE = 'FINANCE',
  OPERATIONS = 'OPERATIONS',
  SALES = 'SALES',
  HR = 'HR',
  GUIDE = 'GUIDE',
}

export class DirectorAiChatDto {
  @IsString()
  @IsNotEmpty()
  message!: string;

  @IsMongoId()
  @IsOptional()
  sessionId?: string;

  @IsString()
  @IsOptional()
  fromDate?: string;

  @IsString()
  @IsOptional()
  toDate?: string;

  @IsEnum(DirectorAiContextMode)
  @IsOptional()
  contextMode?: DirectorAiContextMode;
}
