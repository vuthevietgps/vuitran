import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuthenticatedRequest } from '../common/interfaces/authenticated-request.interface';
import { Role } from '../common/interfaces/role.enum';
import { ParseMongoIdPipe } from '../common/pipes/parse-mongo-id.pipe';
import { QueryWorkSessionsDto } from './dto/query-work-sessions.dto';
import { WorkSessionsService } from './work-sessions.service';

@Controller('work-sessions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class WorkSessionsController {
  constructor(private readonly workSessionsService: WorkSessionsService) {}

  @Get()
  @Roles(Role.DIRECTOR, Role.ACCOUNTING, Role.OPS)
  findAll(@Query() query: QueryWorkSessionsDto) {
    return this.workSessionsService.findAll(query);
  }

  @Get('my')
  @Roles(Role.DIRECTOR, Role.ACCOUNTING, Role.OPS, Role.TEACHER, Role.SALE)
  findMy(
    @Req() req: AuthenticatedRequest,
    @Query() query: QueryWorkSessionsDto,
  ) {
    return this.workSessionsService.findAll({
      ...query,
      userId: req.user.sub,
      search: undefined,
    });
  }

  @Get('summary')
  @Roles(Role.DIRECTOR, Role.ACCOUNTING, Role.OPS)
  getMonthlySummary(
    @Query('periodStart') periodStart: string,
    @Query('periodEnd') periodEnd: string,
  ) {
    return this.workSessionsService.getMonthlySummary(
      new Date(periodStart),
      new Date(periodEnd),
    );
  }

  @Patch(':id')
  @Roles(Role.DIRECTOR, Role.OPS)
  update(
    @Param('id', ParseMongoIdPipe) id: string,
    @Body() dto: { loginTime?: string; logoutTime?: string; notes?: string },
  ) {
    return this.workSessionsService.update(id, dto);
  }
}
