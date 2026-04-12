import { Type } from 'class-transformer';
import {
  IsArray,
  IsEmail,
  IsEnum,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { BankInfoDto } from '../../teachers/dto/create-teacher-profile.dto';
import {
  TeacherRegistrationTeachingMode,
} from '../schemas/teacher-registration.schema';

export class ConvertTeacherRegistrationDto {
  @IsString()
  @IsOptional()
  @MaxLength(255)
  fullName?: string;

  @IsString()
  @IsOptional()
  @MaxLength(30)
  phone?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  @MaxLength(30)
  userCode?: string;

  @IsString()
  @MinLength(6)
  password!: string;

  @IsArray()
  @IsMongoId({ each: true })
  @IsOptional()
  managedSales?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  subjects?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  grades?: string[];

  @IsEnum(TeacherRegistrationTeachingMode)
  @IsOptional()
  teachingMode?: TeacherRegistrationTeachingMode;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  locations?: string[];

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  yearsOfExperience?: number;

  @IsString()
  @IsOptional()
  @MaxLength(3000)
  bio?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  pricePerSession?: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  pricePerHour?: number;

  @ValidateNested()
  @Type(() => BankInfoDto)
  @IsOptional()
  bankInfo?: BankInfoDto;

  @IsString()
  @IsOptional()
  @MaxLength(3000)
  adminNotes?: string;
}
