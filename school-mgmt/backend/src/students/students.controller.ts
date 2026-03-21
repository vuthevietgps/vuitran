import { BadRequestException, Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, UseInterceptors, UploadedFile, Req } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { StudentsService } from './students.service';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { StudentReportQueryDto } from './dto/student-report.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/interfaces/role.enum';
import { multerConfig } from '../common/config/multer.config';
import { AuthenticatedRequest } from '../common/interfaces/authenticated-request.interface';
import { ParseMongoIdPipe } from '../common/pipes/parse-mongo-id.pipe';

@Controller('students')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  @Get()
  @Roles(Role.DIRECTOR, Role.SALE, Role.OPS, Role.ACCOUNTING, Role.PARENT)
  findAll(@Req() req: AuthenticatedRequest) {
    return this.studentsService.findAll(req.user);
  }

  @Get('pending')
  @Roles(Role.DIRECTOR, Role.OPS)
  findPendingApproval() {
    return this.studentsService.findPendingApproval();
  }

  @Get('report')
  @Roles(Role.DIRECTOR, Role.SALE, Role.OPS, Role.ACCOUNTING)
  getStudentReport(@Query() query: StudentReportQueryDto, @Req() req: AuthenticatedRequest) {
    return this.studentsService.getStudentReport(query.classId, query.searchTerm, req.user);
  }

  @Get('comprehensive-report')
  @Roles(Role.DIRECTOR, Role.SALE, Role.OPS, Role.ACCOUNTING)
  getComprehensiveReport(@Query() query: StudentReportQueryDto, @Req() req: AuthenticatedRequest) {
    return this.studentsService.getComprehensiveReport(query.classId, query.searchTerm, req.user);
  }

  @Post()
  @Roles(Role.DIRECTOR, Role.SALE, Role.OPS)
  create(@Body() createStudentDto: CreateStudentDto, @Req() req: AuthenticatedRequest) {
    return this.studentsService.create(createStudentDto, req.user);
  }

  @Get(':id')
  @Roles(Role.DIRECTOR, Role.SALE, Role.OPS, Role.ACCOUNTING, Role.PARENT)
  findOne(@Param('id', ParseMongoIdPipe) id: string, @Req() req: AuthenticatedRequest) {
    return this.studentsService.findOne(id, req.user);
  }

  @Patch(':id')
  @Roles(Role.DIRECTOR, Role.SALE, Role.OPS)
  update(
    @Param('id', ParseMongoIdPipe) id: string,
    @Body() updateStudentDto: UpdateStudentDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.studentsService.update(id, updateStudentDto, req.user);
  }

  // clear-all route removed — bulk deletion is permanently disabled

  @Delete(':id')
  @Roles(Role.DIRECTOR, Role.OPS)
  remove(@Param('id', ParseMongoIdPipe) id: string) {
    return this.studentsService.remove(id);
  }

  @Post('face-upload')
  @UseInterceptors(FileInterceptor('file', multerConfig))
  @Roles(Role.DIRECTOR, Role.SALE, Role.OPS)
  async uploadFace(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    return { url: `/uploads/${file.filename}` };
  }

  @Post(':id/approve')
  @Roles(Role.DIRECTOR, Role.OPS)
  async approve(@Param('id', ParseMongoIdPipe) id: string, @Body() body: { action: 'APPROVE' | 'REJECT' }, @Req() req: AuthenticatedRequest) {
    return this.studentsService.approve(id, body.action, req.user.sub);
  }
}
