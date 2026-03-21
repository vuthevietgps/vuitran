import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ReportsService } from './reports.service';
import { TeachingReportQueryDto } from './dto/teaching-report-query.dto';
import { InlineUpdateDto } from './dto/inline-update.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/interfaces/role.enum';
import { AuthenticatedRequest } from '../common/interfaces/authenticated-request.interface';
import { ParseMongoIdPipe } from '../common/pipes/parse-mongo-id.pipe';

@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  /**
   * GET /reports/teaching
   * Lấy báo cáo giảng dạy tổng hợp từ Attendance + Sessions (SSOT) + PayrollTransactions (SSOT).
   * Không copy dữ liệu giữa collections – dùng MongoDB $lookup tại thời điểm query.
   */
  @Get('teaching')
  @Roles(Role.DIRECTOR, Role.OPS, Role.TEACHER)
  getTeachingReport(
    @Query() query: TeachingReportQueryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.reportsService.getTeachingReport(
      query.startDate,
      query.endDate,
      query.classId,
      query.teacherId,
      req.user,
      query.page,
      query.limit,
    );
  }

  /**
   * PATCH /reports/:attendanceId/inline-update
   * Cập nhật inline từ Frontend theo nguyên tắc SSOT:
   *   • sessionContent / comment / recordLink → Sessions.teachingReport (SSOT)
   *   • imageUrl                              → Attendance.imageUrl     (SSOT)
   */
  @Patch(':attendanceId/inline-update')
  @Roles(Role.DIRECTOR, Role.OPS, Role.TEACHER)
  updateReportRow(
    @Param('attendanceId', ParseMongoIdPipe) attendanceId: string,
    @Body() dto: InlineUpdateDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.reportsService.updateReportRow(attendanceId, dto, req.user);
  }
}
