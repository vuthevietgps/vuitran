import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export const REPORT_TEMPLATE_DYNAMIC_FIELD_TYPES = [
  'text',
  'textarea',
  'url',
  'number',
  'select',
  'checkbox',
  'date',
] as const;

export type ReportTemplateDynamicFieldType =
  (typeof REPORT_TEMPLATE_DYNAMIC_FIELD_TYPES)[number];

export class ReportTemplateDynamicFieldOptionDto {
  @IsString()
  @IsNotEmpty({ message: 'Gia tri tuy chon khong duoc de trong' })
  @MaxLength(100, { message: 'Gia tri tuy chon khong vuot qua 100 ky tu' })
  value!: string;

  @IsString()
  @IsNotEmpty({ message: 'Nhan tuy chon khong duoc de trong' })
  @MaxLength(100, { message: 'Nhan tuy chon khong vuot qua 100 ky tu' })
  label!: string;
}

export class ReportTemplateDynamicFieldDto {
  @IsString()
  @IsNotEmpty({ message: 'Key truong dong khong duoc de trong' })
  @MaxLength(60, { message: 'Key truong dong khong vuot qua 60 ky tu' })
  key!: string;

  @IsString()
  @IsNotEmpty({ message: 'Nhan truong dong khong duoc de trong' })
  @MaxLength(100, { message: 'Nhan truong dong khong vuot qua 100 ky tu' })
  label!: string;

  @IsIn(REPORT_TEMPLATE_DYNAMIC_FIELD_TYPES, {
    message: 'Loai truong dong khong hop le',
  })
  type!: ReportTemplateDynamicFieldType;

  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(200, { message: 'Placeholder khong vuot qua 200 ky tu' })
  placeholder?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxLength?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  order?: number;

  @IsOptional()
  @IsString()
  @MaxLength(200, { message: 'Gia tri mac dinh khong vuot qua 200 ky tu' })
  defaultValue?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReportTemplateDynamicFieldOptionDto)
  options?: ReportTemplateDynamicFieldOptionDto[];
}

export class CreateReportTemplateDto {
  @IsString()
  @IsNotEmpty({ message: 'Ten template khong duoc de trong' })
  @MaxLength(100, { message: 'Ten template khong vuot qua 100 ky tu' })
  title!: string;

  @IsString()
  @IsNotEmpty({ message: 'Noi dung template khong duoc de trong' })
  @MaxLength(2000, { message: 'Noi dung template khong vuot qua 2000 ky tu' })
  templateContent!: string;

  @IsOptional()
  @IsMongoId({ message: 'classId phai la ObjectId hop le' })
  classId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReportTemplateDynamicFieldDto)
  dynamicFields?: ReportTemplateDynamicFieldDto[];
}
