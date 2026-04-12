import { IsEnum, IsOptional, IsString } from 'class-validator';
import { TeacherRegistrationStatus } from '../schemas/teacher-registration.schema';

export class QueryTeacherRegistrationDto {
  @IsEnum(TeacherRegistrationStatus)
  @IsOptional()
  status?: TeacherRegistrationStatus;

  @IsString()
  @IsOptional()
  search?: string;
}
