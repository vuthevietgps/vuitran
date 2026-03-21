import { IsOptional, IsString } from 'class-validator';

export class QueryLandingPagesDto {
  @IsString()
  @IsOptional()
  status?: string;

  @IsString()
  @IsOptional()
  search?: string;
}
