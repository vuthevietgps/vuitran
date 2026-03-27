import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

/**
 * PH xác nhận buổi học → chuyển status TEACHER_COMPLETED → FINALIZED
 * Bao gồm phản hồi chi tiết từ phụ huynh
 */
export class ConfirmSessionDto {
  // ── Legacy ──
  @IsString()
  @IsOptional()
  parentNotes?: string;

  @IsInt()
  @Min(1)
  @Max(5)
  @IsOptional()
  rating?: number;

  @IsInt()
  @Min(1)
  @Max(5)
  @IsOptional()
  parentRating?: number;

  // ── Phản hồi chi tiết ──

  /** Đánh giá tổng quan (1-5) */
  @IsInt()
  @Min(1)
  @Max(5)
  @IsOptional()
  overallRating?: number;

  /** Chất lượng giảng dạy (1-5) */
  @IsInt()
  @Min(1)
  @Max(5)
  @IsOptional()
  teachingQualityRating?: number;

  /** Giao tiếp/tương tác (1-5) */
  @IsInt()
  @Min(1)
  @Max(5)
  @IsOptional()
  communicationRating?: number;

  /** Điều PH lo ngại / cần cải thiện */
  @IsString()
  @IsOptional()
  concerns?: string;

  /** PH hài lòng không? */
  @IsBoolean()
  @IsOptional()
  isSatisfied?: boolean;
}
