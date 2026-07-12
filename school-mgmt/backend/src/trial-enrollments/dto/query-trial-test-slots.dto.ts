import { IsMongoId, IsOptional, Matches } from 'class-validator';

export class QueryTrialTestSlotsDto {
  @IsMongoId()
  experienceTeacherId!: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date!: string;

  @IsMongoId()
  @IsOptional()
  excludeId?: string;
}
