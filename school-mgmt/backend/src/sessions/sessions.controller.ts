import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Req,
  Query,
} from '@nestjs/common';
import { SessionsService } from './sessions.service';
import { AuthenticatedRequest } from '../common/interfaces/authenticated-request.interface';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/interfaces/role.enum';

import { CreateSessionDto } from './dto/create-session.dto';
import { UpdateSessionDto } from './dto/update-session.dto';
import { QuerySessionDto } from './dto/query-session.dto';
import { CompleteSessionDto } from './dto/complete-session.dto';
import { ConfirmSessionDto } from './dto/confirm-session.dto';
import { CancelSessionDto } from './dto/cancel-session.dto';
import { RescheduleSessionDto } from './dto/reschedule-session.dto';
import { BulkCreateSessionDto } from './dto/bulk-create-session.dto';
import { SubmitTeachingReportDto } from './dto/submit-teaching-report.dto';
import { BulkTeachingReportDto } from './dto/bulk-teaching-report.dto';
import { SubmitParentFeedbackDto } from './dto/submit-parent-feedback.dto';
import { ParseMongoIdPipe } from '../common/pipes/parse-mongo-id.pipe';

@Controller('sessions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  // ── CREATE ──────────────────────────────────────────────────────

  /** Tạo 1 buổi học */
  @Post()
  @Roles(Role.OPS, Role.DIRECTOR)
  create(@Body() dto: CreateSessionDto, @Req() req: AuthenticatedRequest) {
    return this.sessionsService.create(dto, req.user.sub, req.user);
  }

  /** Tạo buổi học hàng loạt cho cả lớp */
  @Post('bulk')
  @Roles(Role.OPS, Role.DIRECTOR)
  bulkCreate(@Body() dto: BulkCreateSessionDto, @Req() req: AuthenticatedRequest) {
    return this.sessionsService.bulkCreate(dto, req.user);
  }

  // ── QUERY ───────────────────────────────────────────────────────

  /** Danh sách sessions (filter, paginate, sort) */
  @Get()
  @Roles(Role.OPS, Role.DIRECTOR, Role.ACCOUNTING, Role.TEACHER, Role.PARENT)
  findAll(@Query() query: QuerySessionDto, @Req() req: AuthenticatedRequest) {
    // Force ownership filter for PARENT and TEACHER to prevent data leaks
    if (req.user.role === Role.PARENT) {
      return this.sessionsService.findAll({ ...query, parentUserId: req.user.sub });
    }
    if (req.user.role === Role.TEACHER) {
      return this.sessionsService.findAll({ ...query, teacherId: req.user.sub });
    }
    return this.sessionsService.findAll(query);
  }

  /** Thống kê tổng hợp */
  @Get('stats')
  @Roles(Role.OPS, Role.DIRECTOR, Role.ACCOUNTING)
  getStats(
    @Query('teacherId') teacherId?: string,
    @Query('classId') classId?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
  ) {
    return this.sessionsService.getStats({ teacherId, classId, fromDate, toDate });
  }

  /** Lấy sessions của GV đang đăng nhập */
  @Get('my-sessions')
  @Roles(Role.TEACHER)
  getMyTeacherSessions(@Req() req: AuthenticatedRequest, @Query() query: QuerySessionDto) {
    return this.sessionsService.findAll({ ...query, teacherId: req.user.sub });
  }

  /** Lấy sessions của PH đang đăng nhập */
  @Get('my-children')
  @Roles(Role.PARENT)
  getMyChildrenSessions(@Req() req: AuthenticatedRequest, @Query() query: QuerySessionDto) {
    return this.sessionsService.findAll({ ...query, parentUserId: req.user.sub });
  }

  /** PH xem tiến trình học tập tổng hợp của tất cả con */
  @Get('my-children/progress')
  @Roles(Role.PARENT)
  getChildrenProgress(@Req() req: AuthenticatedRequest) {
    return this.sessionsService.getChildrenProgress(req.user.sub);
  }

  /** PH gửi feedback tổng quan */
  @Post('general-feedback')
  @Roles(Role.PARENT)
  submitGeneralFeedback(
    @Body() body: SubmitParentFeedbackDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.sessionsService.submitParentFeedback(req.user.sub, body);
  }

  /** GV lấy danh sách sessions cần nộp báo cáo (chưa có report) */
  @Get('my-sessions/pending-report')
  @Roles(Role.TEACHER)
  getSessionsPendingReport(@Req() req: AuthenticatedRequest, @Query() query: QuerySessionDto) {
    return this.sessionsService.findAll({
      ...query,
      teacherId: req.user.sub,
      hasReport: 'false',
    } as any);
  }

  /** GV lấy danh sách sessions đã có báo cáo (phân trang chuẩn theo server) */
  @Get('my-sessions/completed-report')
  @Roles(Role.TEACHER)
  getSessionsCompletedReport(@Req() req: AuthenticatedRequest, @Query() query: QuerySessionDto) {
    return this.sessionsService.findAll({
      ...query,
      teacherId: req.user.sub,
      hasReport: 'true',
    } as any);
  }

  /** Chi tiết 1 session */
  @Get(':id')
  @Roles(Role.OPS, Role.DIRECTOR, Role.ACCOUNTING, Role.TEACHER, Role.PARENT)
  findOne(@Param('id', ParseMongoIdPipe) id: string, @Req() req: AuthenticatedRequest) {
    return this.sessionsService.findById(id, req.user);
  }

  // ── UPDATE ──────────────────────────────────────────────────────

  /** Sửa thông tin buổi học (chỉ SCHEDULED) */
  @Patch(':id')
  @Roles(Role.OPS, Role.DIRECTOR)
  update(@Param('id', ParseMongoIdPipe) id: string, @Body() dto: UpdateSessionDto) {
    return this.sessionsService.update(id, dto);
  }

  // ── WORKFLOW ACTIONS ────────────────────────────────────────────

  /** GV hoàn thành buổi dạy */
  @Post(':id/complete')
  @Roles(Role.TEACHER)
  teacherComplete(
    @Param('id', ParseMongoIdPipe) id: string,
    @Body() dto: CompleteSessionDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.sessionsService.teacherComplete(id, req.user.sub, dto);
  }

  /** PH xác nhận buổi học */
  @Post(':id/confirm')
  @Roles(Role.PARENT)
  parentConfirm(
    @Param('id', ParseMongoIdPipe) id: string,
    @Body() dto: ConfirmSessionDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.sessionsService.parentConfirm(id, req.user.sub, dto);
  }

  /** OPS/DIRECTOR chốt thủ công */
  @Post(':id/finalize')
  @Roles(Role.OPS, Role.DIRECTOR)
  manualFinalize(@Param('id', ParseMongoIdPipe) id: string, @Req() req: AuthenticatedRequest) {
    return this.sessionsService.manualFinalize(id, req.user.sub);
  }

  /** Hủy buổi học */
  @Post(':id/cancel')
  @Roles(Role.OPS, Role.DIRECTOR, Role.TEACHER, Role.PARENT)
  cancel(
    @Param('id', ParseMongoIdPipe) id: string,
    @Body() dto: CancelSessionDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.sessionsService.cancel(id, req.user.sub, req.user.role, dto);
  }

  /** Dời lịch buổi học */
  @Post(':id/reschedule')
  @Roles(Role.OPS, Role.DIRECTOR)
  reschedule(
    @Param('id', ParseMongoIdPipe) id: string,
    @Body() dto: RescheduleSessionDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.sessionsService.reschedule(id, req.user, dto);
  }

  /** Đánh dấu vắng không phép */
  @Post(':id/no-show')
  @Roles(Role.OPS, Role.DIRECTOR, Role.TEACHER)
  markNoShow(@Param('id', ParseMongoIdPipe) id: string, @Req() req: AuthenticatedRequest) {
    return this.sessionsService.markNoShow(id, req.user);
  }

  // ── TEACHING REPORT (Báo cáo giảng dạy) ────────────────────────

  /** GV nộp báo cáo giảng dạy hàng loạt cho toàn bộ sessions của lớp OFFLINE trong 1 ngày.
   * Route này phải đặt TRƯỚC :id/teaching-report để tránh NestJS parse "bulk-teaching-report" thành MongoId.
   */
  @Patch('bulk-teaching-report')
  @Roles(Role.TEACHER)
  bulkSubmitTeachingReport(@Body() dto: BulkTeachingReportDto, @Req() req: AuthenticatedRequest) {
    return this.sessionsService.bulkSubmitTeachingReport(dto.classId, dto.date, req.user.sub, dto);
  }

  /** GV nộp / cập nhật báo cáo giảng dạy.
   * Chỉ sessions có báo cáo mới được tính lương.
   */
  @Patch(':id/teaching-report')
  @Roles(Role.TEACHER)
  submitTeachingReport(
    @Param('id', ParseMongoIdPipe) id: string,
    @Body() dto: SubmitTeachingReportDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.sessionsService.submitTeachingReport(id, req.user.sub, dto);
  }

  // ── TRIAL ───────────────────────────────────────────────────────

  /** Học viên tiếp tục → convert trial sessions thành billable */
  @Post('trial/convert')
  @Roles(Role.OPS, Role.DIRECTOR, Role.ACCOUNTING)
  convertTrial(
    @Body() body: { studentId: string; classId: string },
  ) {
    return this.sessionsService.convertTrialSessions(body.studentId, body.classId);
  }

  /** Học viên KHÔNG tiếp tục → không tính lương GV, không charge phụ huynh */
  @Post('trial/reject')
  @Roles(Role.OPS, Role.DIRECTOR, Role.ACCOUNTING)
  rejectTrial(
    @Body() body: { studentId: string; classId: string },
    @Req() req: AuthenticatedRequest,
  ) {
    return this.sessionsService.markTrialRejectedNoPay(body.studentId, body.classId, req.user.sub);
  }

  /** Route cũ giữ tương thích nhưng đã map sang nghiệp vụ reject-no-pay */
  @Post('trial/teacher-paid-only')
  @Roles(Role.OPS, Role.DIRECTOR, Role.ACCOUNTING)
  trialTeacherPaidOnly(
    @Body() body: { studentId: string; classId: string },
    @Req() req: AuthenticatedRequest,
  ) {
    return this.sessionsService.markTrialTeacherPaidOnly(body.studentId, body.classId, req.user.sub);
  }

  // ── DELETE ──────────────────────────────────────────────────────

  /** Xóa buổi SCHEDULED */
  @Delete(':id')
  @Roles(Role.OPS, Role.DIRECTOR)
  remove(@Param('id', ParseMongoIdPipe) id: string) {
    return this.sessionsService.remove(id);
  }
}
