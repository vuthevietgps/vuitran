import { Transform } from 'class-transformer';
import {
  IsMongoId,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';

const trimToUndefined = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
};

export class SubmitTeachingReportDto {
  @IsString({ message: 'Noi dung hoc phai la chuoi van ban' })
  @IsOptional()
  @MinLength(20, { message: 'Noi dung hoc phai co it nhat 20 ky tu' })
  @MaxLength(2000, { message: 'Noi dung hoc khong duoc vuot qua 2000 ky tu' })
  @Transform(trimToUndefined)
  lessonContent?: string;

  @IsString({ message: 'Thai do hoc sinh phai la chuoi van ban' })
  @IsOptional()
  @MaxLength(1000, { message: 'Thai do hoc sinh khong duoc vuot qua 1000 ky tu' })
  @Transform(trimToUndefined)
  studentAttitude?: string;

  @IsString({ message: 'Link ghi hinh phai la chuoi van ban' })
  @IsOptional()
  @IsUrl({ require_protocol: true }, { message: 'Link ghi hinh phai la URL hop le (https://...)' })
  @MaxLength(500, { message: 'Link ghi hinh khong duoc vuot qua 500 ky tu' })
  @Transform(trimToUndefined)
  recordingUrl?: string;

  @IsString({ message: 'Nhan xet phai la chuoi van ban' })
  @IsOptional()
  @MaxLength(1000, { message: 'Nhan xet khong duoc vuot qua 1000 ky tu' })
  @Transform(trimToUndefined)
  teacherComment?: string;

  @IsString({ message: 'Bai tap ve nha phai la chuoi van ban' })
  @IsOptional()
  @MaxLength(1000, { message: 'Bai tap ve nha khong duoc vuot qua 1000 ky tu' })
  @Transform(trimToUndefined)
  homework?: string;

  @IsString({ message: 'Ghi chu them phai la chuoi van ban' })
  @IsOptional()
  @MaxLength(500, { message: 'Ghi chu them khong duoc vuot qua 500 ky tu' })
  @Transform(trimToUndefined)
  additionalNotes?: string;

  @IsMongoId({ message: 'templateId phai la ObjectId hop le' })
  @IsOptional()
  templateId?: string;

  @IsObject({ message: 'dynamicFieldValues phai la object hop le' })
  @IsOptional()
  dynamicFieldValues?: Record<string, unknown>;
}
