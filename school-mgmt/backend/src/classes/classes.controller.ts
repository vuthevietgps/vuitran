import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { ClassesService } from './classes.service';
import { CreateClassDto } from './dto/create-class.dto';
import { UpdateClassDto } from './dto/update-class.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/interfaces/role.enum';
import { AssignStudentsDto } from './dto/assign-students.dto';
import { UpdateCurriculumDto } from './dto/update-curriculum.dto';
import { UpdateStudentConfigDto } from './dto/update-student-config.dto';
import { AuthenticatedRequest } from '../common/interfaces/authenticated-request.interface';
import { ParseMongoIdPipe } from '../common/pipes/parse-mongo-id.pipe';

@Controller('classes')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ClassesController {
  constructor(private readonly classesService: ClassesService) {}

  @Post()
  @Roles(Role.DIRECTOR, Role.OPS, Role.SALE)
  create(@Body() dto: CreateClassDto, @Req() req: AuthenticatedRequest) {
    return this.classesService.create(dto, req.user);
  }

  @Get()
  @Roles(Role.DIRECTOR, Role.OPS, Role.SALE, Role.TEACHER, Role.ACCOUNTING)
  findAll(@Req() req: AuthenticatedRequest) {
    return this.classesService.findAll(req.user);
  }

  @Get('suggest-teachers')
  @Roles(Role.DIRECTOR, Role.OPS)
  suggestTeachers(
    @Query('subject') subject?: string,
    @Query('grade') grade?: string,
    @Query('teachingMode') teachingMode?: string,
  ) {
    return this.classesService.suggestTeachers({ subject, grade, teachingMode });
  }

  @Get(':id')
  @Roles(Role.DIRECTOR, Role.OPS, Role.SALE, Role.TEACHER, Role.PARENT)
  findOne(@Param('id', ParseMongoIdPipe) id: string, @Req() req: AuthenticatedRequest) {
    return this.classesService.findOne(id, req.user);
  }

  @Patch(':id')
  @Roles(Role.DIRECTOR, Role.OPS, Role.SALE)
  update(
    @Param('id', ParseMongoIdPipe) id: string,
    @Body() dto: UpdateClassDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.classesService.update(id, dto, req.user);
  }

  @Delete(':id')
  @Roles(Role.DIRECTOR)
  remove(@Param('id', ParseMongoIdPipe) id: string) {
    return this.classesService.remove(id);
  }

  @Post(':id/assign-students')
  @Roles(Role.DIRECTOR, Role.OPS, Role.SALE)
  assignStudents(
    @Param('id', ParseMongoIdPipe) id: string,
    @Body() dto: AssignStudentsDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.classesService.assignStudentsBySale(id, dto, req.user);
  }

  @Patch(':id/students/:studentId/config')
  @Roles(Role.DIRECTOR, Role.OPS, Role.SALE)
  updateStudentConfig(
    @Param('id', ParseMongoIdPipe) id: string,
    @Param('studentId', ParseMongoIdPipe) studentId: string,
    @Body() dto: UpdateStudentConfigDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.classesService.updateStudentConfig(id, studentId, dto, req.user);
  }

  @Post(':id/pending-sale-update/approve')
  @Roles(Role.DIRECTOR, Role.OPS)
  approvePendingSaleUpdate(
    @Param('id', ParseMongoIdPipe) id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.classesService.approvePendingSaleUpdate(id, req.user);
  }

  @Post(':id/pending-sale-update/reject')
  @Roles(Role.DIRECTOR, Role.OPS)
  rejectPendingSaleUpdate(
    @Param('id', ParseMongoIdPipe) id: string,
    @Body() body: { reason?: string },
    @Req() req: AuthenticatedRequest,
  ) {
    return this.classesService.rejectPendingSaleUpdate(id, body?.reason, req.user);
  }

  // ── CURRICULUM (Chương trình học) ──────────────────────────────────

  /** Xem tiến độ chương trình học */
  @Get(':id/curriculum')
  @Roles(Role.DIRECTOR, Role.OPS, Role.TEACHER, Role.PARENT)
  getCurriculumProgress(@Param('id', ParseMongoIdPipe) id: string, @Req() req: AuthenticatedRequest) {
    return this.classesService.getCurriculumProgress(id, req.user);
  }

  /** Cập nhật toàn bộ chương trình học */
  @Put(':id/curriculum')
  @Roles(Role.DIRECTOR, Role.OPS, Role.TEACHER)
  updateCurriculum(
    @Param('id', ParseMongoIdPipe) id: string,
    @Body() dto: UpdateCurriculumDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.classesService.updateCurriculum(id, dto.curriculum, req.user);
  }

  /** Đánh dấu một mục chương trình đã hoàn thành */
  @Post(':id/curriculum/:itemId/complete')
  @Roles(Role.DIRECTOR, Role.OPS, Role.TEACHER)
  markCurriculumItemCompleted(
    @Param('id', ParseMongoIdPipe) id: string,
    @Param('itemId', ParseMongoIdPipe) itemId: string,
    @Body() body: { sessionId?: string },
    @Req() req: AuthenticatedRequest,
  ) {
    return this.classesService.markCurriculumItemCompleted(
      id,
      itemId,
      body.sessionId,
      req.user,
    );
  }
}
