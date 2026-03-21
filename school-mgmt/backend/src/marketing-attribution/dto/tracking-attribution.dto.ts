import { IsMongoId, IsOptional, IsString, ValidateIf } from 'class-validator';

export class TrackingAttributionDto {
  @ValidateIf((_, value) => value !== '' && value !== null && value !== undefined)
  @IsMongoId()
  @IsOptional()
  landingPageId?: string;

  @IsString()
  @IsOptional()
  landingPageSlug?: string;

  @IsString()
  @IsOptional()
  landingPageName?: string;

  @IsString()
  @IsOptional()
  submittedUrl?: string;

  @IsString()
  @IsOptional()
  referrerUrl?: string;

  @IsString()
  @IsOptional()
  eventId?: string;

  @IsString()
  @IsOptional()
  fbclid?: string;

  @IsString()
  @IsOptional()
  fbc?: string;

  @IsString()
  @IsOptional()
  fbp?: string;

  @IsString()
  @IsOptional()
  gclid?: string;

  @IsString()
  @IsOptional()
  gbraid?: string;

  @IsString()
  @IsOptional()
  wbraid?: string;

  @IsString()
  @IsOptional()
  ttclid?: string;

  @IsString()
  @IsOptional()
  ttp?: string;

  @IsString()
  @IsOptional()
  utmSource?: string;

  @IsString()
  @IsOptional()
  utmMedium?: string;

  @IsString()
  @IsOptional()
  utmCampaign?: string;

  @IsString()
  @IsOptional()
  utmContent?: string;

  @IsString()
  @IsOptional()
  utmTerm?: string;
}
