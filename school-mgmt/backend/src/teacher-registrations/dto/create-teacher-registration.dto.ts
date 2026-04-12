import { Type } from 'class-transformer';
import {
  IsArray,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import {
  TeacherRegistrationTeachingMode,
} from '../schemas/teacher-registration.schema';

export class CreateTeacherRegistrationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  fullName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  phone!: string;

  @IsEmail()
  @IsOptional()
  email?: string;

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

  @IsString()
  @IsOptional()
  @MaxLength(100)
  sourcePage?: string;
}
