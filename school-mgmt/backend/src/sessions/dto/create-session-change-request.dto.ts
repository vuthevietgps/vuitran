import {
  IsDateString,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateSessionChangeRequestDto {
  @IsDateString()
  @IsOptional()
  requestedScheduledDate?: string;

  @IsString()
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'requestedStartTime must be in HH:mm format',
  })
  requestedStartTime?: string;

  @IsString()
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'requestedEndTime must be in HH:mm format',
  })
  requestedEndTime?: string;

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
