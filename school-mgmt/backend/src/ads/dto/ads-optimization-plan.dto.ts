import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import {
  AdsOptimizationPlanItemStatus,
  AdsOptimizationPlanStatus,
} from '../schemas/ads-optimization-plan.schema';
import { AdGroupStatus } from '../schemas/ad-group.schema';

export class GenerateAdsOptimizationPlanDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  refundRatePercentX?: number;

  @Type(() => Number)
  @IsInt()
  @Min(7)
  @Max(90)
  @IsOptional()
  lookbackDays?: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0.1)
  @Max(1.0)
  @IsOptional()
  targetProfitableRatio?: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  totalBudget?: number;

  @IsString()
  @IsOptional()
  title?: string;
}

export class QueryAdsOptimizationPlansDto {
  @IsEnum(AdsOptimizationPlanStatus)
  @IsOptional()
  status?: string;

  @IsMongoId()
  @IsOptional()
  adGroupId?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  @IsOptional()
  limit?: number;
}

export class DecideAdsOptimizationPlanItemDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  proposedDailyBudget?: number;

  @IsEnum(AdGroupStatus)
  @IsOptional()
  proposedStatus?: string;

  @IsString()
  @IsOptional()
  note?: string;
}

export class ExecuteAdsOptimizationPlanDto {
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  itemIds?: string[];

  @IsBoolean()
  @IsOptional()
  dryRun?: boolean;
}

export class QueryAdsOptimizationFollowUpDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(90)
  @IsOptional()
  days?: number;
}

export class QueryAdsOptimizationPlanItemsDto {
  @IsEnum(AdsOptimizationPlanItemStatus)
  @IsOptional()
  status?: string;
}
