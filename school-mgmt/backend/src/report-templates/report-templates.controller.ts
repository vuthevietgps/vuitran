import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ReportTemplatesService } from './report-templates.service';
import { CreateReportTemplateDto } from './dto/create-report-template.dto';
import { AuthenticatedRequest } from '../common/interfaces/authenticated-request.interface';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/interfaces/role.enum';
import { ParseMongoIdPipe } from '../common/pipes/parse-mongo-id.pipe';

@Controller('report-templates')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportTemplatesController {
  constructor(private readonly reportTemplatesService: ReportTemplatesService) {}

  /** Lấy danh sách template của GV + global templates */
  @Get()
  @Roles(Role.TEACHER, Role.OPS, Role.DIRECTOR)
  findAll(@Req() req: AuthenticatedRequest) {
    return this.reportTemplatesService.findByTeacher(req.user.sub);
  }

  /** Tạo template mới */
  @Post()
  @Roles(Role.TEACHER, Role.OPS, Role.DIRECTOR)
  create(
    @Body() dto: CreateReportTemplateDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.reportTemplatesService.create(req.user.sub, dto);
  }

  /** Xóa template (chỉ xóa được template của mình) */
  @Delete(':id')
  @Roles(Role.TEACHER, Role.OPS, Role.DIRECTOR)
  remove(
    @Param('id', ParseMongoIdPipe) id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.reportTemplatesService.remove(id, req.user.sub);
  }
}
