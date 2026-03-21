import { IsMongoId } from 'class-validator';

export class UpdateParentAdsAttributionDto {
  @IsMongoId()
  adGroupId!: string;
}
