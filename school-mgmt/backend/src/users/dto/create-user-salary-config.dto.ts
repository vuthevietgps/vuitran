import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CommissionType } from '../../salary-config/schemas/salary-config.schema';

export class CreateUserCommissionTierDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minRevenue!: number;

  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxRevenue?: number | null;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  percentage!: number;
}

export class CreateUserKpiBonusTierDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minScore!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxScore!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  bonusPercentage!: number;
}

export class CreateUserSalaryConfigDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  baseSalary!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  standardHours!: number;

  @IsString()
  @IsNotEmpty()
  scheduledStartTime!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  latePenaltyAmount!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  punctualityBonusAmount?: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  experienceCaseRate?: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  homeworkGradingRate?: number;

  @IsOptional()
  @IsBoolean()
  commissionEnabled?: boolean;

  @IsOptional()
  @IsEnum(CommissionType)
  commissionType?: CommissionType;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateUserCommissionTierDto)
  commissionTiers?: CreateUserCommissionTierDto[];

  @IsOptional()
  @IsBoolean()
  kpiBonusEnabled?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateUserKpiBonusTierDto)
  kpiBonusTiers?: CreateUserKpiBonusTierDto[];

  @IsOptional()
  @IsString()
  notes?: string;
}
