import {
  IsEnum,
  IsIn,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { AdjustmentType } from '../schemas/ledger-entry.schema';

/**
 * ACCOUNTING/DIRECTOR điều chỉnh số dư thủ công (cộng hoặc trừ).
 * Bắt buộc phải ghi rõ loại điều chỉnh và lý do để audit trail.
 */
export class AdjustBalanceDto {
  @IsMongoId()
  @IsNotEmpty()
  userId!: string; // Chủ ví

  @IsNumber()
  @Min(0)
  amount!: number; // Số tiền điều chỉnh (VNĐ)

  @IsIn(['ADD', 'SUBTRACT'])
  direction!: 'ADD' | 'SUBTRACT'; // Cộng / Trừ

  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsNotEmpty()
  description!: string; // Mô tả ngắn

  /**
   * Loại điều chỉnh (bắt buộc để phân loại audit).
   * Mặc định: MANUAL_ADJUST nếu không truyền.
   */
  @IsEnum(AdjustmentType)
  @IsOptional()
  adjustmentType?: AdjustmentType;

  /**
   * Lý do điều chỉnh chi tiết (bắt buộc cho audit trail).
   * Phải ghi rõ lý do để kế toán và director có thể review.
   */
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  reason!: string;
}
