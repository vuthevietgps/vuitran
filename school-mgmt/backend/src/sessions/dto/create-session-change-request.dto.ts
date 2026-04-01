import { IsInt, IsMongoId, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class CreateSessionChangeRequestDto {
  @IsMongoId()
  @IsOptional()
  requestedTeacherId?: string;

  @IsInt()
  @Min(15)
  @Max(240)
  @IsOptional()
  requestedDurationMinutes?: number;

  @IsString()
  @MaxLength(1000)
  reason!: string;
}
