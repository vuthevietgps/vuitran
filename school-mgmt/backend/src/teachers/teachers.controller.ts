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
import { TeachersService } from './teachers.service';
import { CreateTeacherProfileDto } from './dto/create-teacher-profile.dto';
import { UpdateTeacherProfileDto } from './dto/update-teacher-profile.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/interfaces/role.enum';
import { AuthenticatedRequest } from '../common/interfaces/authenticated-request.interface';
import { TeacherStatus } from './schemas/teacher-profile.schema';
import { ParseMongoIdPipe } from '../common/pipes/parse-mongo-id.pipe';

@Controller('teachers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TeachersController {
  constructor(private readonly teachersService: TeachersService) {}

  // ── STATS ─────────────────────────────────────────────────────

  /** Thống kê số lượng giáo viên theo trạng thái */
  @Get('stats')
  @Roles(Role.OPS, Role.DIRECTOR, Role.ACCOUNTING)
  getStats() {
    return this.teachersService.getStats();
  }

  // ── CRUD ──────────────────────────────────────────────────────

  @Post()
  @Roles(Role.OPS, Role.DIRECTOR)
  create(@Body() dto: CreateTeacherProfileDto, @Req() req: AuthenticatedRequest) {
    return this.teachersService.create(dto, req.user);
  }

  @Get()
  @Roles(Role.OPS, Role.DIRECTOR, Role.ACCOUNTING, Role.SALE)
  findAll(
    @Query('status') status?: TeacherStatus,
    @Query('subjects') subjects?: string,
    @Query('grades') grades?: string,
    @Req() req?: AuthenticatedRequest,
  ) {
    const filters: any = {};
    if (status) filters.status = status;
    if (subjects) filters.subjects = subjects.split(',');
    if (grades) filters.grades = grades.split(',');
    return this.teachersService.findAll(filters, req?.user);
  }

  @Get('me')
  @Roles(Role.TEACHER)
  getMyProfile(@Req() req: AuthenticatedRequest) {
    return this.teachersService.findByUserId(req.user.sub);
  }

  @Get(':id')
  @Roles(Role.OPS, Role.DIRECTOR, Role.ACCOUNTING, Role.TEACHER, Role.SALE)
  findOne(@Param('id', ParseMongoIdPipe) id: string, @Req() req: AuthenticatedRequest) {
    return this.teachersService.findOne(id, req.user);
  }

  /** Profile chi tiết với thống kê lớp, buổi học, lương */
  @Get(':id/profile')
  @Roles(Role.OPS, Role.DIRECTOR, Role.ACCOUNTING, Role.TEACHER, Role.SALE)
  getFullProfile(@Param('id', ParseMongoIdPipe) id: string, @Req() req: AuthenticatedRequest) {
    return this.teachersService.getFullProfile(id, req.user);
  }

  @Patch(':id')
  @Roles(Role.OPS, Role.DIRECTOR, Role.TEACHER, Role.SALE, Role.ACCOUNTING)
  update(@Param('id', ParseMongoIdPipe) id: string, @Body() dto: UpdateTeacherProfileDto, @Req() req: AuthenticatedRequest) {
    return this.teachersService.update(id, dto, req.user);
  }

  @Post(':id/approve')
  @Roles(Role.OPS, Role.DIRECTOR)
  approve(@Param('id', ParseMongoIdPipe) id: string, @Req() req: AuthenticatedRequest) {
    return this.teachersService.approve(id, req.user);
  }

  @Post(':id/activate')
  @Roles(Role.OPS, Role.DIRECTOR)
  activate(@Param('id', ParseMongoIdPipe) id: string) {
    return this.teachersService.activate(id);
  }

  @Post(':id/suspend')
  @Roles(Role.OPS, Role.DIRECTOR)
  suspend(@Param('id', ParseMongoIdPipe) id: string, @Body('reason') reason?: string) {
    return this.teachersService.suspend(id, reason);
  }

  @Delete(':id')
  @Roles(Role.DIRECTOR)
  remove(@Param('id', ParseMongoIdPipe) id: string) {
    return this.teachersService.remove(id);
  }
}
