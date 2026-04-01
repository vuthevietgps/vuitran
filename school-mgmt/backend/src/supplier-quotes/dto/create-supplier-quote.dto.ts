import { IsString, IsOptional, IsNumber, IsDateString, IsArray, ValidateNested, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class QuoteItemDto {
  @IsString()
  itemName!: string;

  @IsNumber()
  @Min(0)
  quantity!: number;

  @IsString()
  unit!: string;

  @IsNumber()
  @Min(0)
  unitPrice!: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateSupplierQuoteDto {
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
  supplierAddress?: string;

  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuoteItemDto)
  items!: QuoteItemDto[];

  @IsDateString()
  quoteDate!: string;

  @IsOptional()
  @IsDateString()
  validUntil?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
