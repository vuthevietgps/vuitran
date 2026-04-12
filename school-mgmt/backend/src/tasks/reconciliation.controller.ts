import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { IsDateString } from 'class-validator';
import { ReconciliationService, ReconciliationResult } from './reconciliation.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/interfaces/role.enum';

export class ManualReconcileDto {
  /** Ngày bắt đầu (ISO string), ví dụ: "2025-01-01" */
  @IsDateString()
  fromDate!: string;
  /** Ngày kết thúc (ISO string), ví dụ: "2025-01-31" */
  @IsDateString()
  toDate!: string;
}

/**
 * ReconciliationController:
 * Endpoint dành cho Admin kích hoạt đối soát dữ liệu thủ công.
 * Chỉ DIRECTOR và ADMIN mới có quyền truy cập.
 */
@Controller('admin/reconciliation')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.DIRECTOR, Role.ACCOUNTING)
export class ReconciliationController {
  constructor(private readonly reconciliationService: ReconciliationService) {}

  /**
   * POST /admin/reconciliation/run
   * Kích hoạt đối soát thủ công cho một khoảng thời gian tuỳ chọn.
   *
   * Body: { fromDate: "2025-01-01", toDate: "2025-01-31" }
   */
  @Post('run')
  @HttpCode(HttpStatus.OK)
  async runManual(@Body() dto: ManualReconcileDto): Promise<ReconciliationResult> {
    const from = new Date(dto.fromDate);
    const to = new Date(dto.toDate);
    return this.reconciliationService.runManual(from, to);
  }
}
