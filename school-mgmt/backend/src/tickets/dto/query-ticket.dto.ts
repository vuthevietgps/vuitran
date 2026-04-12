import {
  IsDateString,
  IsEnum,
  IsMongoId,
  IsOptional,
  IsString,
} from 'class-validator';
import { TicketType, TicketStatus, TicketPriority } from '../schemas/ticket.schema';

export class QueryTicketDto {
  @IsEnum(TicketType)
  @IsOptional()
  type?: TicketType;

  @IsEnum(TicketStatus)
  @IsOptional()
  status?: TicketStatus;

  @IsEnum(TicketPriority)
  @IsOptional()
  priority?: TicketPriority;

  @IsMongoId()
  @IsOptional()
  createdBy?: string;

  @IsMongoId()
  @IsOptional()
  assignedTo?: string;

  @IsMongoId()
  @IsOptional()
  sessionId?: string;

  @IsDateString()
  @IsOptional()
  fromDate?: string;

  @IsDateString()
  @IsOptional()
  toDate?: string;

  @IsString()
  @IsOptional()
  sort?: string;

  @IsOptional()
  overdue?: string;

  @IsOptional()
  page?: number;

  @IsOptional()
  limit?: number;
}
