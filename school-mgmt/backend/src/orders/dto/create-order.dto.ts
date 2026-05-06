import {
  ArrayMinSize,
  IsBoolean,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { OrderType, PaymentPlan, LeadSource } from '../schemas/order.schema';
import { TrackingAttributionDto } from '../../marketing-attribution/dto/tracking-attribution.dto';
import { InvoiceCourseStatus } from '../../invoices/schemas/invoice.schema';

const normalizeOptionalIdInput = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const normalized = value.trim();
  return normalized || null;
};

const normalizeOptionalCodeInput = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const normalized = value.trim().toUpperCase();
  return normalized || undefined;
};

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
  @Min(0)
  @IsOptional()
  invoiceSessions?: number;

  @IsNumber()
  @Min(15)
  @IsOptional()
  sessionDuration?: number;

  @IsNumber()
  @Min(15)
  @IsOptional()
  baseDuration?: number;

  @IsNumber()
  @Min(0)
  pricePerSession!: number;

  @IsNumber()
  @Min(0)
  amount!: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  bonusSessions?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  trialSessions?: number;

  @IsEnum(InvoiceCourseStatus)
  @IsOptional()
  courseStatus?: string;

  @IsString()
  @IsOptional()
  teachingMode?: string;

  @IsString()
  @IsOptional()
  preferredSchedule?: string;

  @IsMongoId()
  @IsOptional()
  @Transform(normalizeOptionalIdInput)
  selectedClassId?: string;

  @IsString()
  @IsOptional()
  @Transform(normalizeOptionalCodeInput)
  requestedClassCode?: string;

  @IsBoolean()
  @IsOptional()
  createNewClassWhenApproved?: boolean;

  @IsMongoId()
  @IsOptional()
  @Transform(normalizeOptionalIdInput)
  preferredTeacherId?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  paymentRound?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  teacherPayPerSession?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  teacherPayPerStudent?: number;

  @IsString()
  @IsOptional()
  subject?: string;

  @IsString()
  @IsOptional()
  learningGoals?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  maxStudents?: number;

  @IsString()
  @IsOptional()
  invoiceDescription?: string;

  @IsString()
  @IsOptional()
  invoiceNumber?: string;

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
  @Matches(/^0\d{9}$/, {
    message: 'So dien thoai phai co 10 so va bat dau bang 0',
  })
  parentPhone!: string;

  @IsString()
  @IsOptional()
  parentEmail?: string;

  @IsMongoId()
  @IsOptional()
  @Transform(normalizeOptionalIdInput)
  parentUserId?: string;

  @IsString()
  @IsOptional()
  parentUserCode?: string;

  @IsString()
  @IsOptional()
  parentAddress?: string;

  @IsString()
  @IsOptional()
  parentFacebookLink?: string;

  @IsString()
  @IsNotEmpty()
  studentName!: string;

  @IsString()
  @IsOptional()
  studentCode?: string;

  @IsString()
  @IsOptional()
  studentDob?: string;

  @IsString()
  @IsOptional()
  studentGrade?: string;

  @IsString()
  @IsOptional()
  studentLevel?: string;

  @IsInt()
  @Min(3)
  @Max(25)
  @IsOptional()
  studentAge?: number;

  @IsInt()
  @Min(1)
  @Max(12)
  @IsOptional()
  studentBirthMonth?: number;

  @IsInt()
  @Min(1)
  @Max(12)
  @IsOptional()
  parentBirthMonth?: number;

  @IsString()
  @IsOptional()
  @Matches(/^(https?:\/\/|\/uploads\/|data:image\/)/, {
    message: 'studentFaceImage phai la URL, upload path, hoac base64 image',
  })
  studentFaceImage?: string;

  @IsMongoId()
  @IsOptional()
  @Transform(normalizeOptionalIdInput)
  existingStudentId?: string;

  @IsMongoId()
  @IsOptional()
  @Transform(normalizeOptionalIdInput)
  saleId?: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'Don hang phai co it nhat 1 san pham' })
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

  @IsDateString()
  @IsOptional()
  paymentDate?: string;

  @IsString()
  @IsOptional()
  @Matches(/^(https?:\/\/|\/uploads\/|data:image\/)/, {
    message: 'receiptImage phai la URL, upload path, hoac base64 image',
  })
  receiptImage?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  saleCommission?: number;

  @IsEnum(LeadSource)
  @IsOptional()
  leadSource?: string;

  @IsMongoId()
  @IsOptional()
  @Transform(normalizeOptionalIdInput)
  leadId?: string;

  @IsMongoId()
  @IsOptional()
  @Transform(normalizeOptionalIdInput)
  adGroupId?: string;

  @IsMongoId()
  @IsOptional()
  @Transform(normalizeOptionalIdInput)
  referredByUserId?: string;

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
