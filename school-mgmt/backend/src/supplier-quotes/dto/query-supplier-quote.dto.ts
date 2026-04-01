import { IsOptional, IsString, IsEnum, IsNumberString } from 'class-validator';
import { QuoteStatus } from '../schemas/supplier-quote.schema';

export class QuerySupplierQuoteDto {
  @IsOptional()
  @IsString()
  keyword?: string;

  @IsOptional()
  @IsEnum(QuoteStatus)
  status?: QuoteStatus;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;

  @IsOptional()
  @IsNumberString()
  page?: string;

  @IsOptional()
  @IsNumberString()
  limit?: string;
}
