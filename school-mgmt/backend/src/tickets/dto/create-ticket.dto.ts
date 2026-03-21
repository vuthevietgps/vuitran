import {
  IsArray,
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { TicketType, TicketPriority } from '../schemas/ticket.schema';

export class CreateTicketDto {
  @IsEnum(TicketType)
  @IsNotEmpty()
  type!: TicketType;

  @IsString()
  @IsNotEmpty()
  subject!: string;

  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsEnum(TicketPriority)
  @IsOptional()
  priority?: TicketPriority;

  // Optional references
  @IsMongoId()
  @IsOptional()
  sessionId?: string;

  @IsMongoId()
  @IsOptional()
  classId?: string;

  @IsMongoId()
  @IsOptional()
  studentId?: string;

  @IsMongoId()
  @IsOptional()
  teacherId?: string;

  @IsMongoId()
  @IsOptional()
  parentId?: string;

  @IsMongoId()
  @IsOptional()
  sourceConversationId?: string;

  @IsMongoId()
  @IsOptional()
  payrollId?: string;

  @IsMongoId()
  @IsOptional()
  ledgerEntryId?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  attachments?: string[];

  // ── GV dạy thay (SUBSTITUTE_TEACHER) ──

  @IsMongoId()
  @IsOptional()
  substituteTeacherId?: string;

  @IsString()
  @IsOptional()
  substituteFromDate?: string;

  @IsString()
  @IsOptional()
  substituteToDate?: string;
}
