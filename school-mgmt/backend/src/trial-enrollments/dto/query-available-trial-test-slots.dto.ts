import { Type } from 'class-transformer';
import { IsInt, IsMongoId, IsOptional, Matches, Max, Min } from 'class-validator';

export class QueryAvailableTrialTestSlotsDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsOptional()
  fromDate?: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsOptional()
  toDate?: string;

  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  @IsOptional()
  preferredStart?: string;

  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  @IsOptional()
  preferredEnd?: string;

  @IsMongoId()
  @IsOptional()
  experienceTeacherId?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number;
}
