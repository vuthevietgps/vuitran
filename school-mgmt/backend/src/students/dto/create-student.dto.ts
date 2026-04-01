import { IsInt, IsNotEmpty, IsOptional, IsString, Matches, Max, Min, IsMongoId } from 'class-validator';

export class CreateStudentDto {
  @IsString()
  @IsNotEmpty()
  studentCode!: string;

  @IsString()
  @IsNotEmpty()
  fullName!: string;

  @IsInt()
  @Min(3)
  @Max(25)
  age!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  studentBirthMonth?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  parentBirthMonth?: number;

  @IsString()
  @IsNotEmpty()
  parentName!: string;

  @IsString()
  @Matches(/^[0-9+\-()\s]{6,20}$/)
  parentPhone!: string;

  @IsOptional()
  @IsMongoId()
  parentUserId?: string;

  @IsString()
  @IsNotEmpty()
  faceImage!: string;

  @IsOptional()
  @IsString()
  productPackage?: string;

  @IsOptional()
  @IsString()
  level?: string;

  @IsOptional()
  @IsString()
  studentType?: 'ONLINE' | 'OFFLINE';

  @IsOptional()
  @IsMongoId()
  saleId?: string;

  @IsOptional()
  @IsString()
  saleName?: string;

  // approvalStatus and approvedBy are system-managed via approve() endpoint
}
