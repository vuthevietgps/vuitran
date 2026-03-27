import { IsString, IsNotEmpty, IsOptional, IsNumber, IsArray, IsEnum, Min, ValidateNested, IsMongoId } from 'class-validator';
import { Type } from 'class-transformer';
import { LeadSource } from '../schemas/lead.schema';
import { TrackingAttributionDto } from '../../marketing-attribution/dto/tracking-attribution.dto';

export class CreateLeadDto {
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

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  interestedSubjects?: string[];

  @IsEnum(LeadSource)
  @IsOptional()
  source?: string;

  @IsString()
  @IsOptional()
  adGroupId?: string;

  @IsString()
  @IsOptional()
  adGroupName?: string;

  @IsString()
  @IsOptional()
  referredBy?: string;

  @IsMongoId()
  @IsOptional()
  referredByUserId?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  estimatedValue?: number;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @IsString()
  @IsOptional()
  notes?: string;

  @ValidateNested()
  @Type(() => TrackingAttributionDto)
  @IsOptional()
  tracking?: TrackingAttributionDto;
}
