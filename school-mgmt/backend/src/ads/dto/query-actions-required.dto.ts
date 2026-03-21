import { Type } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, Max, Min } from 'class-validator';

export class QueryActionsRequiredDto {
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
}
