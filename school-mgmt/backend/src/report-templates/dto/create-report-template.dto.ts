import { IsString, IsNotEmpty, MaxLength, IsOptional, IsMongoId } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateReportTemplateDto {
  @IsString()
  @IsNotEmpty({ message: 'Tên template không được để trống' })
  @MaxLength(100, { message: 'Tên template không vượt quá 100 ký tự' })
  @Transform(({ value }) => value?.trim())
  title!: string;

  @IsString()
  @IsNotEmpty({ message: 'Nội dung template không được để trống' })
  @MaxLength(2000, { message: 'Nội dung template không vượt quá 2000 ký tự' })
  @Transform(({ value }) => value?.trim())
  templateContent!: string;

  @IsOptional()
  @IsMongoId({ message: 'classId phải là ObjectId hợp lệ' })
  classId?: string;
}
