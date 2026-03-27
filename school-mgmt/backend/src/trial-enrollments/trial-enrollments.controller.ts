import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/interfaces/role.enum';
import { ParseMongoIdPipe } from '../common/pipes/parse-mongo-id.pipe';
import { AuthenticatedRequest } from '../common/interfaces/authenticated-request.interface';
import { CreateTrialEnrollmentDto } from './dto/create-trial-enrollment.dto';
import { UpdateTrialEnrollmentDto } from './dto/update-trial-enrollment.dto';
import { QueryTrialEnrollmentDto } from './dto/query-trial-enrollment.dto';
import { RecordTrialSessionDto } from './dto/record-trial-session.dto';
import { ConvertTrialEnrollmentDto } from './dto/convert-trial-enrollment.dto';
import { RejectTrialEnrollmentDto } from './dto/reject-trial-enrollment.dto';
import { TrialEnrollmentsService } from './trial-enrollments.service';

@Controller('trial-enrollments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TrialEnrollmentsController {
  constructor(private readonly trialEnrollmentsService: TrialEnrollmentsService) {}

  @Post()
  @Roles(Role.SALE, Role.OPS, Role.DIRECTOR)
  create(@Body() dto: CreateTrialEnrollmentDto, @Req() req: AuthenticatedRequest) {
    return this.trialEnrollmentsService.create(dto, req.user);
  }

  @Get()
  @Roles(Role.SALE, Role.OPS, Role.DIRECTOR)
  findAll(@Query() query: QueryTrialEnrollmentDto, @Req() req: AuthenticatedRequest) {
    return this.trialEnrollmentsService.findAll(query, req.user);
  }

  @Get('summary')
  @Roles(Role.SALE, Role.OPS, Role.DIRECTOR)
  getSummary(@Req() req: AuthenticatedRequest) {
    return this.trialEnrollmentsService.getSummary(req.user);
  }

  @Get(':id')
  @Roles(Role.SALE, Role.OPS, Role.DIRECTOR)
  findOne(@Param('id', ParseMongoIdPipe) id: string, @Req() req: AuthenticatedRequest) {
    return this.trialEnrollmentsService.findOne(id, req.user);
  }

  @Patch(':id')
  @Roles(Role.SALE, Role.OPS, Role.DIRECTOR)
  update(
    @Param('id', ParseMongoIdPipe) id: string,
    @Body() dto: UpdateTrialEnrollmentDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.trialEnrollmentsService.update(id, dto, req.user);
  }

  @Post(':id/trial-sessions')
  @Roles(Role.SALE, Role.OPS, Role.DIRECTOR)
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

  @Delete(':id')
  @Roles(Role.DIRECTOR, Role.OPS)
  remove(@Param('id', ParseMongoIdPipe) id: string, @Req() req: AuthenticatedRequest) {
    return this.trialEnrollmentsService.remove(id, req.user);
  }
}
