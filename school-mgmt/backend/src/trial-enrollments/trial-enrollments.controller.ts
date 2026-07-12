import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/interfaces/role.enum';
import { ParseMongoIdPipe } from '../common/pipes/parse-mongo-id.pipe';
import { AuthenticatedRequest } from '../common/interfaces/authenticated-request.interface';
import { CreateTrialEnrollmentDto } from './dto/create-trial-enrollment.dto';
import { UpdateTrialEnrollmentDto } from './dto/update-trial-enrollment.dto';
import { QueryTrialEnrollmentDto } from './dto/query-trial-enrollment.dto';
import { QueryAvailableTrialTestSlotsDto } from './dto/query-available-trial-test-slots.dto';
import { QueryTrialTestSlotsDto } from './dto/query-trial-test-slots.dto';
import { RecordTrialSessionDto } from './dto/record-trial-session.dto';
import { ConvertTrialEnrollmentDto } from './dto/convert-trial-enrollment.dto';
import { RejectTrialEnrollmentDto } from './dto/reject-trial-enrollment.dto';
import { TeacherPaidOnlyTrialEnrollmentDto } from './dto/teacher-paid-only-trial-enrollment.dto';
import { TrialEnrollmentsService } from './trial-enrollments.service';

const trialResultUploadPath = join(process.cwd(), 'uploads', 'trial-results');
if (!existsSync(trialResultUploadPath)) mkdirSync(trialResultUploadPath, { recursive: true });

const trialResultStorage = diskStorage({
  destination: trialResultUploadPath,
  filename: (_req, file, cb) => {
    const suffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `trial-result-${suffix}${extname(file.originalname || '').toLowerCase()}`);
  },
});

const trialResultImageFilter = (_req: any, file: Express.Multer.File, cb: any) => {
  if (['image/jpeg', 'image/png', 'image/jpg', 'image/webp'].includes(file.mimetype)) {
    cb(null, true);
    return;
  }
  cb(new BadRequestException('Chi ho tro anh JPG, PNG hoac WEBP'), false);
};

@Controller('trial-enrollments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TrialEnrollmentsController {
  constructor(private readonly trialEnrollmentsService: TrialEnrollmentsService) {}

  @Post()
  @Roles(Role.SALE, Role.OPS, Role.DIRECTOR)
  create(@Body() dto: CreateTrialEnrollmentDto, @Req() req: AuthenticatedRequest) {
    return this.trialEnrollmentsService.create(dto, req.user);
  }

  @Post('result-upload')
  @Roles(Role.SALE, Role.OPS, Role.DIRECTOR, Role.EXPERIENCE_TEACHER)
  @UseInterceptors(FileInterceptor('file', {
    storage: trialResultStorage,
    fileFilter: trialResultImageFilter,
    limits: { fileSize: 5 * 1024 * 1024 },
  }))
  uploadResultImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Chua co anh ket qua test');
    }
    return { url: `/uploads/trial-results/${file.filename}` };
  }

  @Get()
  @Roles(Role.SALE, Role.OPS, Role.DIRECTOR, Role.EXPERIENCE_TEACHER)
  findAll(@Query() query: QueryTrialEnrollmentDto, @Req() req: AuthenticatedRequest) {
    return this.trialEnrollmentsService.findAll(query, req.user);
  }

  @Get('summary')
  @Roles(Role.SALE, Role.OPS, Role.DIRECTOR, Role.EXPERIENCE_TEACHER)
  getSummary(@Req() req: AuthenticatedRequest) {
    return this.trialEnrollmentsService.getSummary(req.user);
  }

  @Get('available-slots')
  @Roles(Role.SALE, Role.OPS, Role.DIRECTOR, Role.EXPERIENCE_TEACHER)
  getAvailableSlots(@Query() query: QueryAvailableTrialTestSlotsDto, @Req() req: AuthenticatedRequest) {
    return this.trialEnrollmentsService.getAvailableSlots(query, req.user);
  }

  @Get('test-slots')
  @Roles(Role.SALE, Role.OPS, Role.DIRECTOR, Role.EXPERIENCE_TEACHER)
  getTestSlots(@Query() query: QueryTrialTestSlotsDto, @Req() req: AuthenticatedRequest) {
    return this.trialEnrollmentsService.getTestSlots(query, req.user);
  }

  @Get(':id')
  @Roles(Role.SALE, Role.OPS, Role.DIRECTOR, Role.EXPERIENCE_TEACHER)
  findOne(@Param('id', ParseMongoIdPipe) id: string, @Req() req: AuthenticatedRequest) {
    return this.trialEnrollmentsService.findOne(id, req.user);
  }

  @Patch(':id')
  @Roles(Role.SALE, Role.OPS, Role.DIRECTOR, Role.EXPERIENCE_TEACHER)
  update(
    @Param('id', ParseMongoIdPipe) id: string,
    @Body() dto: UpdateTrialEnrollmentDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.trialEnrollmentsService.update(id, dto, req.user);
  }

  @Post(':id/trial-sessions')
  @Roles(Role.SALE, Role.OPS, Role.DIRECTOR, Role.EXPERIENCE_TEACHER)
  recordTrialSession(
    @Param('id', ParseMongoIdPipe) id: string,
    @Body() dto: RecordTrialSessionDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.trialEnrollmentsService.recordTrialSession(id, dto, req.user);
  }

  @Post(':id/convert')
  @Roles(Role.SALE, Role.OPS, Role.DIRECTOR)
  convert(
    @Param('id', ParseMongoIdPipe) id: string,
    @Body() dto: ConvertTrialEnrollmentDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.trialEnrollmentsService.convert(id, dto, req.user);
  }

  @Post(':id/reject')
  @Roles(Role.SALE, Role.OPS, Role.DIRECTOR)
  reject(
    @Param('id', ParseMongoIdPipe) id: string,
    @Body() dto: RejectTrialEnrollmentDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.trialEnrollmentsService.reject(id, dto, req.user);
  }

  @Post(':id/teacher-paid-only')
  @Roles(Role.OPS, Role.DIRECTOR)
  teacherPaidOnly(
    @Param('id', ParseMongoIdPipe) id: string,
    @Body() dto: TeacherPaidOnlyTrialEnrollmentDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.trialEnrollmentsService.teacherPaidOnly(id, dto, req.user);
  }

  @Delete(':id')
  @Roles(Role.DIRECTOR, Role.OPS)
  remove(@Param('id', ParseMongoIdPipe) id: string, @Req() req: AuthenticatedRequest) {
    return this.trialEnrollmentsService.remove(id, req.user);
  }
}
