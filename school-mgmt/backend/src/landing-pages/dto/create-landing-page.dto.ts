import {
  IsBoolean,
  IsEnum,
  IsMongoId,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';
import { AdPlatform } from '../../ads/schemas/ad-account.schema';
import { LandingPageStatus } from '../schemas/landing-page.schema';

export class CreateLandingPageDto {
  @IsString()
  name!: string;

  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  slug!: string;

  @IsEnum(LandingPageStatus)
  @IsOptional()
  status?: string;

  @IsString()
  @IsOptional()
  heroTitle?: string;

  @IsString()
  @IsOptional()
  heroSubtitle?: string;

  @IsString()
  @IsOptional()
  formTitle?: string;

  @IsString()
  @IsOptional()
  formDescription?: string;

  @IsString()
  @IsOptional()
  submitButtonText?: string;

  @IsString()
  @IsOptional()
  privacyNotice?: string;

  @IsString()
  @IsOptional()
  successTitle?: string;

  @IsString()
  @IsOptional()
  successMessage?: string;

  @IsString()
  @IsOptional()
  bodyHtml?: string;

  @IsEnum(AdPlatform)
  @IsOptional()
  defaultPlatform?: string;

  @IsMongoId()
  @IsOptional()
  defaultAdGroupId?: string;

  @IsBoolean()
  @IsOptional()
  autoCreateLead?: boolean;

  @IsString()
  @IsOptional()
  metaPixelId?: string;

  @IsString()
  @IsOptional()
  googleTagId?: string;

  @IsString()
  @IsOptional()
  googleAdsConversionId?: string;

  @IsString()
  @IsOptional()
  googleAdsConversionLabel?: string;

  @IsString()
  @IsOptional()
  tiktokPixelId?: string;

  @IsString()
  @IsOptional()
  customHeadHtml?: string;

  @IsString()
  @IsOptional()
  customBodyHtml?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
