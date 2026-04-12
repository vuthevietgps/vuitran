import { PartialType } from '@nestjs/mapped-types';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { CreateTeacherRegistrationDto } from './create-teacher-registration.dto';
import { TeacherRegistrationStatus } from '../schemas/teacher-registration.schema';

export class UpdateTeacherRegistrationDto extends PartialType(
  CreateTeacherRegistrationDto,
) {
  @IsEnum(TeacherRegistrationStatus)
  @IsOptional()
  status?: TeacherRegistrationStatus;

  @IsString()
  @IsOptional()
  @MaxLength(3000)
  interviewNotes?: string;

  @IsString()
  @IsOptional()
  @MaxLength(3000)
  adminNotes?: string;

  @IsDateString()
  @IsOptional()
  interviewedAt?: string;

  @IsDateString()
  @IsOptional()
  decidedAt?: string;
}
