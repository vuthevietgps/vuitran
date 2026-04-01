import { IsOptional, IsEnum, IsDateString, IsString } from 'class-validator';
import { SupplierPaymentMethod } from '../schemas/supplier-payment.schema';

export class PaySupplierPaymentDto {
  @IsEnum(SupplierPaymentMethod)
  paymentMethod!: SupplierPaymentMethod;

  @IsOptional()
  @IsDateString()
  paidAt?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
