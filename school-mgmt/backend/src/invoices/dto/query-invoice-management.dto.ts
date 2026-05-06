import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { ClassType, InvoiceCourseStatus, InvoiceStatus } from '../schemas/invoice.schema';

export class QueryInvoiceManagementDto {
  @IsOptional()
  @IsString()
  keyword?: string;

  @IsOptional()
  @IsString()
  parentKeyword?: string;

  @IsOptional()
  @IsString()
  saleKeyword?: string;

  @IsOptional()
  @IsIn(Object.values(ClassType))
  classType?: ClassType;

  @IsOptional()
  @IsIn(Object.values(InvoiceStatus))
  status?: InvoiceStatus;

  @IsOptional()
  @IsIn(Object.values(InvoiceCourseStatus))
  courseStatus?: InvoiceCourseStatus;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number = 25;
}
