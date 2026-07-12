import { Transform } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsMongoId,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { HomeworkSubmissionMode, LessonProgressStatus } from '../schemas/session.schema';

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

  @IsEnum(HomeworkSubmissionMode, { message: 'Cach nop bai tap khong hop le' })
  @IsOptional()
  homeworkSubmissionMode?: HomeworkSubmissionMode;

  @IsDateString({}, { message: 'Han nop bai tap phai dung dinh dang ISO 8601' })
  @IsOptional()
  homeworkDeadline?: string;

  @IsArray({ message: 'Danh sach bai tap trong kho phai la mang' })
  @IsMongoId({ each: true, message: 'Ma tai lieu bai tap khong hop le' })
  @IsOptional()
  homeworkMaterialIds?: string[];

  @IsArray({ message: 'Danh sach quiz BTVN phai la mang' })
  @IsMongoId({ each: true, message: 'Ma quiz BTVN khong hop le' })
  @IsOptional()
  homeworkQuizIds?: string[];

  @IsEnum(LessonProgressStatus, { message: 'Trang thai hoan thanh bai hoc khong hop le' })
  @IsOptional()
  lessonProgressStatus?: LessonProgressStatus;

  @IsInt({ message: 'Tien do bai hoc phai la so nguyen' })
  @Min(0, { message: 'Tien do bai hoc khong duoc nho hon 0' })
  @Max(100, { message: 'Tien do bai hoc khong duoc lon hon 100' })
  @IsOptional()
  @Transform(({ value }) => (value === '' || value == null ? undefined : Number(value)))
  progressPercent?: number;

  @IsInt({ message: 'Danh gia nang luc hoc sinh phai la so nguyen' })
  @Min(1, { message: 'Danh gia nang luc hoc sinh toi thieu la 1' })
  @Max(5, { message: 'Danh gia nang luc hoc sinh toi da la 5' })
  @IsOptional()
  @Transform(({ value }) => (value === '' || value == null ? undefined : Number(value)))
  studentPerformance?: number;

  @IsInt({ message: 'Danh gia muc do tham gia phai la so nguyen' })
  @Min(1, { message: 'Danh gia muc do tham gia toi thieu la 1' })
  @Max(5, { message: 'Danh gia muc do tham gia toi da la 5' })
  @IsOptional()
  @Transform(({ value }) => (value === '' || value == null ? undefined : Number(value)))
  studentEngagement?: number;

  @IsInt({ message: 'Danh gia muc do hieu bai phai la so nguyen' })
  @Min(1, { message: 'Danh gia muc do hieu bai toi thieu la 1' })
  @Max(5, { message: 'Danh gia muc do hieu bai toi da la 5' })
  @IsOptional()
  @Transform(({ value }) => (value === '' || value == null ? undefined : Number(value)))
  comprehensionLevel?: number;

  @IsString({ message: 'Ly do dieu chinh bai hoc phai la chuoi van ban' })
  @IsOptional()
  @MaxLength(500, { message: 'Ly do dieu chinh bai hoc khong duoc vuot qua 500 ky tu' })
  @Transform(trimToUndefined)
  deviationReason?: string;

  @IsString({ message: 'Ke hoach buoi sau phai la chuoi van ban' })
  @IsOptional()
  @MaxLength(500, { message: 'Ke hoach buoi sau khong duoc vuot qua 500 ky tu' })
  @Transform(trimToUndefined)
  nextSessionPlan?: string;

  @IsString({ message: 'Nhan xet tong quan phai la chuoi van ban' })
  @IsOptional()
  @MaxLength(1000, { message: 'Nhan xet tong quan khong duoc vuot qua 1000 ky tu' })
  @Transform(trimToUndefined)
  overallComment?: string;

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
