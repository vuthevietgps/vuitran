import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsMongoId,
  IsNotEmpty,
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

export class BulkTeachingReportDto {
  @IsMongoId({ message: 'classId khong hop le' })
  @IsNotEmpty()
  classId!: string;

  @IsDateString({}, { message: 'date phai dung dinh dang ISO 8601' })
  @IsNotEmpty()
  date!: string;

  @IsString({ message: 'Noi dung hoc phai la chuoi van ban' })
  @IsOptional()
  @MinLength(20, { message: 'Noi dung hoc phai co it nhat 20 ky tu' })
  @MaxLength(2000, { message: 'Noi dung hoc khong duoc vuot qua 2000 ky tu' })
  @Transform(trimToUndefined)
  lessonContent?: string;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  @Transform(trimToUndefined)
  studentAttitude?: string;

  @IsString()
  @IsOptional()
  @IsUrl({ require_protocol: true }, { message: 'recordingUrl phai la URL hop le (https://...)' })
  @MaxLength(500)
  @Transform(trimToUndefined)
  recordingUrl?: string;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  @Transform(trimToUndefined)
  teacherComment?: string;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  @Transform(trimToUndefined)
  homework?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  @Transform(trimToUndefined)
  additionalNotes?: string;

  @IsMongoId({ message: 'templateId phai la ObjectId hop le' })
  @IsOptional()
  templateId?: string;

  @IsObject({ message: 'dynamicFieldValues phai la object hop le' })
  @IsOptional()
  dynamicFieldValues?: Record<string, unknown>;
}
