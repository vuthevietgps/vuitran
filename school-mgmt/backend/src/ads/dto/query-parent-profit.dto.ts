import { IsDateString, IsEnum, IsMongoId, IsOptional } from 'class-validator';
import { AdPlatform } from '../schemas/ad-account.schema';

export class QueryParentProfitDto {
  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsMongoId()
  @IsOptional()
  adGroupId?: string;

  @IsEnum(AdPlatform)
  @IsOptional()
  platform?: string;
}
