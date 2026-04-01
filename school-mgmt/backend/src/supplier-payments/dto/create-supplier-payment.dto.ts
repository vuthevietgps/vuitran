import { IsString, IsOptional, IsNumber, IsDateString, IsEnum, Min } from 'class-validator';
import { SupplierPaymentMethod } from '../schemas/supplier-payment.schema';

export class CreateSupplierPaymentDto {
  @IsString()
  supplierName!: string;

  @IsOptional()
  @IsString()
  supplierPhone?: string;

  @IsOptional()
  @IsString()
  supplierEmail?: string;

  @IsOptional()
  @IsString()
  supplierBankAccount?: string;

  @IsOptional()
  @IsString()
  supplierBankName?: string;

  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
  @Min(0)
  amount!: number;

  @IsDateString()
  paymentDate!: string;

  @IsOptional()
  @IsEnum(SupplierPaymentMethod)
  paymentMethod?: SupplierPaymentMethod;

  @IsOptional()
  @IsString()
  supplierQuoteId?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
