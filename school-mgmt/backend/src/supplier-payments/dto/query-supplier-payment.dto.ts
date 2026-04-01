import { IsOptional, IsString, IsEnum, IsNumberString } from 'class-validator';
import { SupplierPaymentStatus } from '../schemas/supplier-payment.schema';

export class QuerySupplierPaymentDto {
  @IsOptional()
  @IsString()
  keyword?: string;

  @IsOptional()
  @IsEnum(SupplierPaymentStatus)
  status?: SupplierPaymentStatus;

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
