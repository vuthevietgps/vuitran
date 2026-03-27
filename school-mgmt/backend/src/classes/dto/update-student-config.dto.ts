import { IsInt, IsMongoId, IsOptional, Min } from 'class-validator';

export class UpdateStudentConfigDto {
  @IsMongoId()
  @IsOptional()
  teacherId?: string;

  @IsInt()
  @Min(15)
  @IsOptional()
  baseDuration?: number;

  @IsInt()
  @Min(15)
  @IsOptional()
  sessionDuration?: number;
}
