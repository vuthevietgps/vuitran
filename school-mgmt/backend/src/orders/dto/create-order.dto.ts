import { IsString, IsNotEmpty, IsOptional, IsNumber, IsArray, IsEnum, ValidateNested, Min, IsMongoId } from 'class-validator';
import { Type } from 'class-transformer';
import { OrderType, PaymentPlan, LeadSource } from '../schemas/order.schema';
import { TrackingAttributionDto } from '../../marketing-attribution/dto/tracking-attribution.dto';

export class OrderItemDto {
  @IsString()
  @IsNotEmpty()
  productId!: string;

  @IsString()
  @IsOptional()
  productName?: string;

  @IsNumber()
  @Min(1)
  sessions!: number;

  @IsNumber()
  @Min(15)
  @IsOptional()
  sessionDuration?: number;

  @IsNumber()
  @Min(0)
  pricePerSession!: number;

  @IsNumber()
  @Min(0)
  amount!: number;

  @IsString()
  @IsOptional()
  teachingMode?: string;

  @IsString()
  @IsOptional()
  preferredSchedule?: string;

  @IsString()
  @IsOptional()
  preferredTeacherId?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class CreateOrderDto {
  @IsEnum(OrderType)
  orderType!: string;

  @IsString()
  @IsNotEmpty()
  parentName!: string;

  @IsString()
  @IsNotEmpty()
  parentPhone!: string;

  @IsString()
  @IsOptional()
  parentEmail?: string;

  @IsString()
  @IsOptional()
  parentUserId?: string;

  @IsString()
  @IsNotEmpty()
  studentName!: string;

  @IsString()
  @IsOptional()
  studentDob?: string;

  @IsString()
  @IsOptional()
  studentGrade?: string;

  @IsString()
  @IsOptional()
  existingStudentId?: string;

  @IsMongoId()
  @IsOptional()
  saleId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items!: OrderItemDto[];

  @IsNumber()
  @Min(0)
  totalAmount!: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  discountAmount?: number;

  @IsString()
  @IsOptional()
  discountReason?: string;

  @IsNumber()
  @Min(0)
  finalAmount!: number;

  @IsEnum(PaymentPlan)
  @IsOptional()
  paymentPlan?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  saleCommission?: number;

  @IsEnum(LeadSource)
  @IsOptional()
  leadSource?: string;

  @IsString()
  @IsOptional()
  leadId?: string;

  @IsString()
  @IsOptional()
  adGroupId?: string;

  @IsString()
  @IsOptional()
  adGroupName?: string;

  @IsString()
  @IsOptional()
  consultationNotes?: string;

  @ValidateNested()
  @Type(() => TrackingAttributionDto)
  @IsOptional()
  tracking?: TrackingAttributionDto;
}
