import {
  IsDateString,
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Min,
} from 'class-validator';

export class CreateInvoiceDto {
  @IsString()
  @IsNotEmpty()
  invoiceNumber!: string;

  @IsOptional()
  @IsEnum(['TUITION', 'MATERIAL', 'OTHER'])
  invoiceType?: string;

  @IsOptional()
  @IsEnum(['ONLINE', 'OFFLINE'])
  classType?: string;

  @IsMongoId()
  @IsNotEmpty()
  studentId!: string;

  @IsMongoId()
  @IsOptional()
  classId?: string;

  @IsMongoId()
  @IsOptional()
  saleId?: string;

  @IsNumber()
  @Min(1)
  @IsOptional()
  sessions?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  bonusSessions?: number;

  @IsNumber()
  @Min(1)
  @IsOptional()
  paymentRound?: number;

  @IsOptional()
  @IsEnum(['NEW', 'CONTINUE_1', 'CONTINUE_2', 'CONTINUE_3', 'CONTINUE_4', 'CONTINUE_5'])
  courseStatus?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  pricePerSession?: number;

  @IsNumber()
  @Min(1)
  @IsOptional()
  referenceDuration?: number;

  @IsNumber()
  @Min(0)
  amount!: number;

  @IsDateString()
  paymentDate!: string;

  @IsOptional()
  @IsString()
  @Matches(/^(https?:\/\/|\/uploads\/|data:image\/)/, {
    message: 'receiptImage phai la URL, upload path, hoac base64 image',
  })
  receiptImage?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
