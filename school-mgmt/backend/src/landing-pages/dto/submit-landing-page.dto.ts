import { Type } from 'class-transformer';
import {
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { AdPlatform } from '../../ads/schemas/ad-account.schema';
import { TrackingAttributionDto } from '../../marketing-attribution/dto/tracking-attribution.dto';

export class SubmitLandingPageDto {
  @IsString()
  @IsNotEmpty()
  parentName!: string;

  @IsString()
  @IsNotEmpty()
  parentPhone!: string;

  @IsString()
  @IsOptional()
  parentEmail?: string;

  @IsString()
  @IsOptional()
  studentName?: string;

  @IsString()
  @IsOptional()
  studentGrade?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsEnum(AdPlatform)
  @IsOptional()
  platform?: string;

  @IsMongoId()
  @IsOptional()
  adGroupId?: string;

  @IsString()
  @IsOptional()
  adGroupName?: string;

  @IsString()
  @IsOptional()
  adRefParam?: string;

  @ValidateNested()
  @Type(() => TrackingAttributionDto)
  @IsOptional()
  tracking?: TrackingAttributionDto;
}
