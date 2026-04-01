import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { SessionType } from '../schemas/session.schema';

export class UpdateSessionDto {
  @IsMongoId()
  @IsOptional()
  teacherId?: string;

  @IsDateString()
  @IsOptional()
  scheduledDate?: string;

  @IsEnum(SessionType)
  @IsOptional()
  sessionType?: SessionType;

  @IsString()
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'scheduledStartTime must be in HH:mm format',
  })
  scheduledStartTime?: string;

  @IsString()
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'scheduledEndTime must be in HH:mm format',
  })
  scheduledEndTime?: string;

  @IsInt()
  @Min(15)
  @IsOptional()
  durationMinutes?: number;

  @IsString()
  @IsOptional()
  topicsCovered?: string;

  @IsString()
  @IsOptional()
  homework?: string;

  @IsString()
  @IsOptional()
  teacherNotes?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  amountCharged?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  teacherPayout?: number;

  @IsInt()
  @Min(1)
  @IsOptional()
  autoConfirmAfterHours?: number;

  // Mục tiêu buổi học
  @IsString()
  @IsOptional()
  lessonObjective?: string;
}
