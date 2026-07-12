import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuthenticatedRequest } from '../common/interfaces/authenticated-request.interface';
import { Role } from '../common/interfaces/role.enum';
import { AiFeedbackService } from './ai-feedback.service';
import { CreateAiFeedbackDto } from './dto/create-ai-feedback.dto';
import { QueryAiFeedbackDto } from './dto/query-ai-feedback.dto';
import { UpdateAiFeedbackStatusDto } from './dto/update-ai-feedback-status.dto';

const AI_FEEDBACK_CREATE_ROLES = [
  Role.DIRECTOR,
  Role.ACCOUNTING,
  Role.OPS,
  Role.TEACHER,
  Role.EXPERIENCE_TEACHER,
  Role.PARENT,
  Role.STUDENT,
  Role.SALE,
  Role.ADSMANAGER,
  Role.SHAREHOLDER,
];

const AI_FEEDBACK_REVIEW_ROLES = [
  Role.DIRECTOR,
  Role.OPS,
];

@Controller('ai-feedback')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AiFeedbackController {
  constructor(private readonly aiFeedbackService: AiFeedbackService) {}

  @Post()
  @Roles(...AI_FEEDBACK_CREATE_ROLES)
  create(@Body() dto: CreateAiFeedbackDto, @Req() req: AuthenticatedRequest) {
    return this.aiFeedbackService.create(dto, req.user);
  }

  @Get()
  @Roles(...AI_FEEDBACK_REVIEW_ROLES)
  findAll(@Query() query: QueryAiFeedbackDto) {
    return this.aiFeedbackService.findAll(query);
  }

  @Patch(':id/status')
  @Roles(...AI_FEEDBACK_REVIEW_ROLES)
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateAiFeedbackStatusDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.aiFeedbackService.updateStatus(id, dto, req.user);
  }
}
