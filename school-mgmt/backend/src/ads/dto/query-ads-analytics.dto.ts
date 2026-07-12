import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsMongoId, IsNumber, IsOptional, Max, Min } from 'class-validator';
import { AdPlatform } from '../schemas/ad-account.schema';

export class QueryAdsAnalyticsDto {
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

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(180)
  @IsOptional()
  maturityDays?: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  refundRatePercentX?: number;
}
