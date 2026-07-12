import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { AiFeedbackStatus } from '../schemas/ai-feedback.schema';

export class UpdateAiFeedbackStatusDto {
  @IsEnum(AiFeedbackStatus)
  status!: AiFeedbackStatus;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  resolutionNotes?: string;
}
