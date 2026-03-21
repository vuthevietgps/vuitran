import {
  IsArray,
  IsEmail,
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MinLength,
  Min,
  Max,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { DayOfWeek, TeacherStatus } from '../schemas/teacher-profile.schema';

export class AvailabilitySlotDto {
  @IsEnum(DayOfWeek)
  @IsNotEmpty()
  day!: DayOfWeek;

  @IsString()
  @IsNotEmpty()
  startTime!: string; // Format: "HH:mm"

  @IsString()
  @IsNotEmpty()
  endTime!: string; // Format: "HH:mm"
}

export class QualificationDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsOptional()
  institution?: string;

  @IsNumber()
  @IsOptional()
  year?: number;

  @IsString()
  @IsOptional()
  imageUrl?: string;
}

export class BankInfoDto {
  @IsString()
  @IsNotEmpty()
  bankName!: string;

  @IsString()
  @IsNotEmpty()
  accountNumber!: string;

  @IsString()
  @IsNotEmpty()
  accountHolderName!: string;

  @IsString()
  @IsOptional()
  branch?: string;
}

export class TeacherUserInfoDto {
  @IsString()
  @IsOptional()
  fullName?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @MinLength(6)
  @IsOptional()
  password?: string;
}

export class CreateTeacherProfileDto {
  @IsMongoId()
  @IsNotEmpty()
  userId!: string;

  @IsArray()
  @IsMongoId({ each: true })
  @IsOptional()
  managedSales?: string[];

  @IsArray()
  @IsString({ each: true })
  subjects!: string[];

  @IsArray()
  @IsString({ each: true })
  grades!: string[];

  @IsEnum(['ONLINE', 'OFFLINE', 'BOTH'])
  @IsOptional()
  teachingMode?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  locations?: string[];

  @IsString()
  @IsOptional()
  bio?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QualificationDto)
  @IsOptional()
  qualifications?: QualificationDto[];

  @IsNumber()
  @Min(0)
  @IsOptional()
  yearsOfExperience?: number;

  @IsString()
  @IsOptional()
  videoIntroUrl?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AvailabilitySlotDto)
  @IsOptional()
  availability?: AvailabilitySlotDto[];

  @IsNumber()
  @Min(0)
  @IsNotEmpty()
  pricePerSession!: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  pricePerHour?: number;

  @ValidateNested()
  @Type(() => BankInfoDto)
  @IsOptional()
  bankInfo?: BankInfoDto;

  @ValidateNested()
  @Type(() => TeacherUserInfoDto)
  @IsOptional()
  user?: TeacherUserInfoDto;
}
