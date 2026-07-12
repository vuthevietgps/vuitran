import { IsDateString, IsMongoId, IsOptional } from 'class-validator';

export class QuerySaleFunnelDiagnosticsDto {
  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsMongoId()
  @IsOptional()
  adGroupId?: string;

  @IsMongoId()
  @IsOptional()
  saleId?: string;
}
