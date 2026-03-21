import { IsString, IsNumber, Min, IsEnum, IsOptional, IsDateString, IsArray } from 'class-validator';
import { AdGroupStatus } from '../schemas/ad-group.schema';

export class UpdateAdGroupDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  platformCampaignId?: string;

  @IsEnum(AdGroupStatus)
  @IsOptional()
  status?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  dailyBudget?: number;

  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;

  @IsString()
  @IsOptional()
  targetAudience?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  trackingKeys?: string[];
}
