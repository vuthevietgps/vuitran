import {
  Controller,
  Get,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { QueryDashboardDto } from './dto/query-dashboard.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/interfaces/role.enum';
import { AuthenticatedRequest } from '../common/interfaces/authenticated-request.interface';

@Controller('dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  // ────────────────────────────────────────────────────────────────
  // GET /dashboard/director
  // Role: DIRECTOR
  // Tổng quan toàn hệ thống: doanh thu, lợi nhuận, sessions,
  // users, payroll, tickets, wallets, hoạt động gần đây
  // ────────────────────────────────────────────────────────────────
  @Get('director')
  @Roles(Role.DIRECTOR)
  getDirectorDashboard(@Query() query: QueryDashboardDto) {
    return this.dashboardService.getDirectorDashboard(query.fromDate, query.toDate);
  }

  // Director comprehensive = all dashboards combined for testing
  @Get('director/comprehensive')
  @Roles(Role.DIRECTOR)
  getDirectorComprehensive(@Query() query: QueryDashboardDto, @Req() req: AuthenticatedRequest) {
    return this.dashboardService.getDirectorComprehensive(query.fromDate, query.toDate, req.user.sub);
  }

  // Birthday promotions - students/parents with birthday this month
  @Get('birthdays')
  @Roles(Role.DIRECTOR, Role.OPS, Role.ACCOUNTING)
  getBirthdays(@Query('month') month?: number) {
    return this.dashboardService.getBirthdaysByMonth(month);
  }

  // Staff lists - danh sách nhân sự theo vai trò
  @Get('director/staff')
  @Roles(Role.DIRECTOR)
  getStaffLists() {
    return this.dashboardService.getStaffLists();
  }

  // ── Sales Dashboard ──────────────────────────────────────────────
  @Get('sales')
  @Roles(Role.DIRECTOR, Role.OPS, Role.SALE)
  getSalesDashboard(@Req() req: AuthenticatedRequest, @Query() query: QueryDashboardDto) {
    const saleId = req.user.role === Role.SALE ? req.user.sub : undefined;
    return this.dashboardService.getSalesDashboard(saleId, query.fromDate, query.toDate);
  }

  @Get('accounting')
  @Roles(Role.DIRECTOR, Role.ACCOUNTING)
  getAccountingDashboard(@Query() query: QueryDashboardDto) {
    return this.dashboardService.getAccountingDashboard(query.fromDate, query.toDate);
  }

  // ────────────────────────────────────────────────────────────────
  // GET /dashboard/ops
  // Role: DIRECTOR, OPS
  // Vận hành: classes, sessions hôm nay, teachers, students,
  // tickets (trạng thái + overdue + assigned-to-me)
  // ────────────────────────────────────────────────────────────────
  @Get('ops')
  @Roles(Role.DIRECTOR, Role.OPS)
  getOpsDashboard(@Req() req: AuthenticatedRequest) {
    return this.dashboardService.getOpsDashboard(req.user.sub);
  }

  // ────────────────────────────────────────────────────────────────
  // GET /dashboard/teacher
  // Role: TEACHER
  // Cá nhân GV: profile, sessions (thống kê & sắp tới),
  // earnings (tổng + pending + payroll), classes, tickets
  // ────────────────────────────────────────────────────────────────
  @Get('teacher')
  @Roles(Role.DIRECTOR, Role.TEACHER)
  getTeacherDashboard(@Req() req: AuthenticatedRequest, @Query('teacherId') teacherId?: string) {
    // DIRECTOR can view any teacher's dashboard by passing teacherId
    const targetId = req.user.role === Role.DIRECTOR && teacherId ? teacherId : req.user.sub;
    return this.dashboardService.getTeacherDashboard(targetId);
  }

  @Get('parent')
  @Roles(Role.DIRECTOR, Role.PARENT)
  getParentDashboard(@Req() req: AuthenticatedRequest) {
    return this.dashboardService.getParentDashboard(req.user.sub);
  }

  @Get('daily-tasks')
  @Roles(
    Role.DIRECTOR,
    Role.ACCOUNTING,
    Role.OPS,
    Role.TEACHER,
    Role.EXPERIENCE_TEACHER,
    Role.PARENT,
    Role.SALE,
    Role.ADSMANAGER,
  )
  getDailyTasks(@Req() req: AuthenticatedRequest) {
    return this.dashboardService.getDailyTasks(req.user.role, req.user.sub);
  }

  // ── KPI & Teacher Performance ─────────────────────────────────

  @Get('director/teacher-kpi')
  @Roles(Role.DIRECTOR)
  getTeacherKPI(@Query() query: QueryDashboardDto) {
    return this.dashboardService.getTeacherKPI(query.fromDate, query.toDate);
  }

  // ── Calendar Overview ─────────────────────────────────────────

  @Get('director/calendar')
  @Roles(Role.DIRECTOR)
  getCalendarOverview(
    @Query('month') month?: number,
    @Query('year') year?: number,
    @Query('teacherId') teacherId?: string,
    @Query('classId') classId?: string,
  ) {
    return this.dashboardService.getCalendarOverview(month, year, teacherId, classId);
  }

  // ── Revenue & Profit Report ────────────────────────────────────
  @Get('director/revenue')
  @Roles(Role.DIRECTOR, Role.ACCOUNTING)
  getRevenueReport(
    @Query('period') period?: 'monthly' | 'quarterly' | 'yearly',
    @Query() query?: QueryDashboardDto,
  ) {
    return this.dashboardService.getRevenueReport(period || 'monthly', query?.fromDate, query?.toDate);
  }

  // ── Student Retention ──────────────────────────────────────────
  @Get('director/retention')
  @Roles(Role.DIRECTOR, Role.SHAREHOLDER)
  getRetentionMetrics() {
    return this.dashboardService.getRetentionMetrics();
  }

  // ── Employee Performance ──────────────────────────────────────
  @Get('director/employee-performance')
  @Roles(Role.DIRECTOR)
  getEmployeePerformance() {
    return this.dashboardService.getEmployeePerformance();
  }

  // ── Revenue Forecasting ──────────────────────────────────────
  @Get('director/forecast')
  @Roles(Role.DIRECTOR)
  getRevenueForecast() {
    return this.dashboardService.getRevenueForecast();
  }
}
