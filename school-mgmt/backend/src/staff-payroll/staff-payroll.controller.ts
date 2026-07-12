import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/interfaces/role.enum';
import { AuthenticatedRequest } from '../common/interfaces/authenticated-request.interface';
import { ParseMongoIdPipe } from '../common/pipes/parse-mongo-id.pipe';
import { StaffPayrollService } from './staff-payroll.service';

@Controller('staff-payroll')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StaffPayrollController {
  constructor(private readonly staffPayrollService: StaffPayrollService) {}

  // ── CREATE ──

  /** Tạo bảng lương cho 1 nhân viên */
  @Post()
  @Roles(Role.DIRECTOR, Role.ACCOUNTING)
  generate(
    @Body() dto: { userId: string; periodStart: string; periodEnd: string; bonusAmount?: number; deductionAmount?: number; notes?: string },
    @Req() req: AuthenticatedRequest,
  ) {
    return this.staffPayrollService.generate(dto, req.user.sub);
  }

  /** Tạo bảng lương cho tất cả nhân viên có cấu hình */
  @Post('bulk-generate')
  @Roles(Role.DIRECTOR, Role.ACCOUNTING)
  bulkGenerate(
    @Body() dto: { periodStart: string; periodEnd: string },
    @Req() req: AuthenticatedRequest,
  ) {
    return this.staffPayrollService.bulkGenerate(dto.periodStart, dto.periodEnd, req.user.sub);
  }

  // ── READ ──

  /** Danh sách bảng lương nhân viên */
  @Get()
  @Roles(Role.DIRECTOR, Role.ACCOUNTING, Role.OPS)
  findAll(
    @Query('userId') userId?: string,
    @Query('status') status?: any,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.staffPayrollService.findAll({ userId, status, fromDate, toDate, page, limit });
  }

  /** Tổng hợp theo trạng thái */
  @Get('summary')
  @Roles(Role.DIRECTOR, Role.ACCOUNTING)
  getSummary() {
    return this.staffPayrollService.getSummary();
  }

  /** Nhân viên xem bảng lương của mình */
  @Get('my')
  @Roles(Role.DIRECTOR, Role.ACCOUNTING, Role.OPS, Role.TEACHER, Role.EXPERIENCE_TEACHER, Role.SALE)
  findMy(
    @Req() req: AuthenticatedRequest,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.staffPayrollService.findAll({
      userId: req.user.sub,
      fromDate,
      toDate,
      page,
      limit,
    });
  }

  /** Chi tiết 1 bảng lương */
  @Get(':id')
  @Roles(Role.DIRECTOR, Role.ACCOUNTING, Role.OPS, Role.TEACHER, Role.EXPERIENCE_TEACHER, Role.SALE)
  findById(
    @Param('id', ParseMongoIdPipe) id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.staffPayrollService.findById(id, req.user);
  }

  // ── UPDATE ──

  /** Cập nhật thưởng/phạt/ghi chú (chỉ DRAFT) */
  @Patch(':id')
  @Roles(Role.DIRECTOR, Role.ACCOUNTING)
  update(
    @Param('id', ParseMongoIdPipe) id: string,
    @Body() dto: { bonusAmount?: number; deductionAmount?: number; notes?: string },
  ) {
    return this.staffPayrollService.update(id, dto);
  }

  // ── WORKFLOW ──

  /** Submit để duyệt */
  @Post(':id/submit')
  @Roles(Role.ACCOUNTING, Role.OPS)
  submitForReview(@Param('id', ParseMongoIdPipe) id: string) {
    return this.staffPayrollService.submitForReview(id);
  }

  /** Duyệt */
  @Post(':id/approve')
  @Roles(Role.DIRECTOR)
  approve(@Param('id', ParseMongoIdPipe) id: string, @Req() req: AuthenticatedRequest) {
    return this.staffPayrollService.approve(id, req.user.sub);
  }

  /** Từ chối */
  @Post(':id/reject')
  @Roles(Role.DIRECTOR)
  reject(
    @Param('id', ParseMongoIdPipe) id: string,
    @Body('reason') reason: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.staffPayrollService.reject(id, req.user.sub, reason);
  }

  /** Mở lại bảng lương bị từ chối */
  @Post(':id/reopen')
  @Roles(Role.DIRECTOR, Role.ACCOUNTING)
  reopen(@Param('id', ParseMongoIdPipe) id: string) {
    return this.staffPayrollService.reopen(id);
  }

  /** Xác nhận đã chi lương. Truyền bankAccountId để ghi BankTransaction (BUG #3 fix) */
  @Post(':id/mark-paid')
  @Roles(Role.DIRECTOR, Role.ACCOUNTING)
  markPaid(
    @Param('id', ParseMongoIdPipe) id: string,
    @Body() dto: { paymentRef?: string; bankAccountId?: string },
    @Req() req: AuthenticatedRequest,
  ) {
    return this.staffPayrollService.markPaid(
      id,
      req.user.sub,
      dto.paymentRef,
      dto.bankAccountId,
      req.user.fullName,
    );
  }

  // ── DELETE ──

  @Delete(':id')
  @Roles(Role.DIRECTOR, Role.ACCOUNTING)
  remove(@Param('id', ParseMongoIdPipe) id: string) {
    return this.staffPayrollService.remove(id);
  }
}
