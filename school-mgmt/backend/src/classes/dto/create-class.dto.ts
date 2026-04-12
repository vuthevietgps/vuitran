import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CurriculumItemDto {
  @IsNumber()
  @Min(1)
  order!: number;

  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  objectives?: string[];

  @IsNumber()
  @Min(1)
  @IsOptional()
  estimatedSessions?: number;
}

export class ClassCoTeacherDto {
  @IsMongoId()
  @IsNotEmpty()
  teacherId!: string;

  @IsString()
  @IsNotEmpty()
  role!: string;

  @IsBoolean()
  @IsOptional()
  canManageAttendance?: boolean;

  @IsBoolean()
  @IsOptional()
  canManageReports?: boolean;

  @IsBoolean()
  @IsOptional()
  canCreateLink?: boolean;

  @IsString()
  @IsOptional()
  note?: string;
}

export class CreateClassDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsMongoId()
  @IsNotEmpty()
  teacherId!: string;

  @IsMongoId()
  @IsOptional()
  saleId?: string; // Optional - OPS/Director có thể không chỉ định Sale

  @IsMongoId()
  @IsOptional()
  invoiceId?: string; // Hóa đơn đã duyệt (bắt buộc khi SALE tạo lớp)

  /**
   * Chế độ lớp: ONLINE (1:1) | OFFLINE (1:N).
   * ONLINE: lương GV cố định/buổi.
   * OFFLINE: lương GV = teacherPayPerStudent × số HS điểm danh.
   */
  @IsEnum(['ONLINE', 'OFFLINE'])
  @IsOptional()
  classMode?: string;

  @IsMongoId()
  @IsOptional()
  productPackageId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ClassCoTeacherDto)
  @IsOptional()
  coTeachers?: ClassCoTeacherDto[];

  @IsArray()
  @IsMongoId({ each: true })
  @ArrayUnique()
  @IsOptional()
  studentIds?: string[];

  // ── Thông tin môn học ──

  @IsString()
  @IsOptional()
  subject?: string; // Môn học (e.g. "Toán", "Tiếng Anh")

  @IsString()
  @IsOptional()
  grade?: string; // Khối lớp (e.g. "Lớp 10", "Lớp 12")

  @IsString()
  @IsOptional()
  learningGoals?: string; // Mục tiêu tổng thể khóa học

  // ── Chương trình học ──

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CurriculumItemDto)
  @IsOptional()
  curriculum?: CurriculumItemDto[];

  // ── Per-session pricing (mô hình mới) ──

  @IsNumber()
  @Min(0)
  @IsOptional()
  pricePerSession?: number; // Giá thu học sinh mỗi buổi (VNĐ)

  @IsNumber()
  @Min(0)
  @IsOptional()
  teacherPayPerSession?: number; // Lương giáo viên mỗi buổi (VNĐ) - dùng cho ONLINE 1:1

  /** Lương GV / 1 HS / 1 buổi (VNĐ) — dùng cho OFFLINE 1:N */
  @IsNumber()
  @Min(0)
  @IsOptional()
  teacherPayPerStudent?: number;

  @IsNumber()
  @Min(15)
  @IsOptional()
  baseDuration?: number; // Thời lượng cơ sở để tính giá (phút), mặc định 60

  @IsNumber()
  @Min(15)
  @IsOptional()
  sessionDuration?: number; // Thời lượng thực tế mỗi buổi (phút), mặc định 60

  // ── Legacy fields ──

  @IsNumber()
  @Min(0)
  @IsOptional()
  revenuePerStudent?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  teacherSalaryCost?: number;

  /** Sĩ số tối đa (null/undefined = không giới hạn) */
  @IsNumber()
  @Min(1)
  @IsOptional()
  maxStudents?: number;
}
