import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/interfaces/role.enum';
import { AuthenticatedRequest } from '../common/interfaces/authenticated-request.interface';
import { SalaryConfigService } from './salary-config.service';

@Controller('salary-config')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SalaryConfigController {
  constructor(private readonly salaryConfigService: SalaryConfigService) {}

  /** Tạo cấu hình lương cho nhân viên */
  @Post()
  @Roles(Role.DIRECTOR, Role.ACCOUNTING)
  create(@Body() dto: any) {
    return this.salaryConfigService.create(dto);
  }

  /** Danh sách cấu hình lương */
  @Get()
  @Roles(Role.DIRECTOR, Role.ACCOUNTING)
  findAll(
    @Query('status') status?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.salaryConfigService.findAll({ status, page, limit });
  }

  /** Nhân viên xem cấu hình lương của mình */
  @Get('users/options')
  @Roles(Role.DIRECTOR, Role.ACCOUNTING)
  listUsersForConfig() {
    return this.salaryConfigService.listUsersForConfig();
  }

  @Get('my')
  @Roles(Role.DIRECTOR, Role.ACCOUNTING, Role.OPS, Role.TEACHER, Role.EXPERIENCE_TEACHER, Role.SALE)
  findMy(@Req() req: AuthenticatedRequest) {
    return this.salaryConfigService.findByUserId(req.user.sub);
  }

  /** Xem cấu hình lương 1 user */
  @Get(':userId')
  @Roles(Role.DIRECTOR, Role.ACCOUNTING)
  findByUserId(@Param('userId') userId: string) {
    return this.salaryConfigService.findByUserId(userId);
  }

  /** Cập nhật cấu hình lương */
  @Put(':userId')
  @Roles(Role.DIRECTOR, Role.ACCOUNTING)
  update(@Param('userId') userId: string, @Body() dto: any) {
    return this.salaryConfigService.update(userId, dto);
  }

  /** Xóa cấu hình lương */
  @Delete(':userId')
  @Roles(Role.DIRECTOR)
  remove(@Param('userId') userId: string) {
    return this.salaryConfigService.remove(userId);
  }
}
