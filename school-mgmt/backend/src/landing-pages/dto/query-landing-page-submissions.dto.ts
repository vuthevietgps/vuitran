import { IsMongoId, IsOptional, IsString } from 'class-validator';

export class QueryLandingPageSubmissionsDto {
  @IsMongoId()
  @IsOptional()
  landingPageId?: string;

  @IsString()
  @IsOptional()
  search?: string;
}
