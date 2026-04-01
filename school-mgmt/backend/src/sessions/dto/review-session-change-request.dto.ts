import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export enum SessionChangeReviewAction {
  APPROVE = 'APPROVE',
  REJECT = 'REJECT',
}

export class ReviewSessionChangeRequestDto {
  @IsEnum(SessionChangeReviewAction)
  action!: SessionChangeReviewAction;

  @IsString()
  @MaxLength(1000)
  @IsOptional()
  rejectionReason?: string;
}