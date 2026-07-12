import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import {
  MaterialDifficulty,
  MaterialScope,
  MaterialStatus,
  MaterialType,
  MaterialUsagePhase,
} from '../schemas/teaching-material.schema';

export class CreateTeachingMaterialDto {
  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  subject?: string;

  @IsOptional()
  @IsString()
  grade?: string;

  @IsOptional()
  @IsMongoId()
  classId?: string;

  @IsOptional()
  @IsMongoId()
  productId?: string;

  @IsOptional()
  @IsString()
  courseName?: string;

  @IsOptional()
  @IsString()
  unitCode?: string;

  @IsOptional()
  @IsString()
  unitTitle?: string;

  @IsOptional()
  @IsString()
  lessonCode?: string;

  @IsOptional()
  @IsString()
  lessonTitle?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  lessonOrder?: number;

  @IsOptional()
  @IsEnum(MaterialScope)
  materialScope?: MaterialScope;

  @IsOptional()
  @IsEnum(MaterialType)
  materialType?: MaterialType;

  @IsOptional()
  @IsEnum(MaterialUsagePhase)
  usagePhase?: MaterialUsagePhase;

  @IsOptional()
  @IsEnum(MaterialDifficulty)
  difficulty?: MaterialDifficulty;

  @IsOptional()
  @IsEnum(MaterialStatus)
  status?: MaterialStatus;

  @IsOptional()
  @IsNumber()
  @Min(0)
  estimatedMinutes?: number;

  @IsOptional()
  @IsArray()
  skills?: string[];

  @IsOptional()
  @IsBoolean()
  assignableAsHomework?: boolean;

  @IsOptional()
  @IsBoolean()
  autoGradeable?: boolean;

  @IsOptional()
  @IsString()
  version?: string;

  @IsOptional()
  @IsArray()
  tags?: string[];

  @IsOptional()
  @IsBoolean()
  isShared?: boolean;

  @IsOptional()
  @IsString()
  manualSummary?: string;
}

export class UpdateTeachingMaterialDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  subject?: string;

  @IsOptional()
  @IsString()
  grade?: string;

  @IsOptional()
  @IsMongoId()
  classId?: string;

  @IsOptional()
  @IsMongoId()
  productId?: string;

  @IsOptional()
  @IsString()
  courseName?: string;

  @IsOptional()
  @IsString()
  unitCode?: string;

  @IsOptional()
  @IsString()
  unitTitle?: string;

  @IsOptional()
  @IsString()
  lessonCode?: string;

  @IsOptional()
  @IsString()
  lessonTitle?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  lessonOrder?: number;

  @IsOptional()
  @IsEnum(MaterialScope)
  materialScope?: MaterialScope;

  @IsOptional()
  @IsEnum(MaterialType)
  materialType?: MaterialType;

  @IsOptional()
  @IsEnum(MaterialUsagePhase)
  usagePhase?: MaterialUsagePhase;

  @IsOptional()
  @IsEnum(MaterialDifficulty)
  difficulty?: MaterialDifficulty;

  @IsOptional()
  @IsEnum(MaterialStatus)
  status?: MaterialStatus;

  @IsOptional()
  @IsNumber()
  @Min(0)
  estimatedMinutes?: number;

  @IsOptional()
  @IsArray()
  skills?: string[];

  @IsOptional()
  @IsBoolean()
  assignableAsHomework?: boolean;

  @IsOptional()
  @IsBoolean()
  autoGradeable?: boolean;

  @IsOptional()
  @IsString()
  version?: string;

  @IsOptional()
  @IsArray()
  tags?: string[];

  @IsOptional()
  @IsBoolean()
  isShared?: boolean;

  @IsOptional()
  @IsString()
  manualSummary?: string;
}
