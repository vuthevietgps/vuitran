import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Req } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateParentAdsAttributionDto } from './dto/update-parent-ads-attribution.dto';
import { QueryParentManagementDto } from './dto/query-parent-management.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/interfaces/role.enum';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuthenticatedRequest } from '../common/interfaces/authenticated-request.interface';
import { ParseMongoIdPipe } from '../common/pipes/parse-mongo-id.pipe';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @Roles(Role.DIRECTOR, Role.SALE)
  create(@Body() dto: CreateUserDto, @Req() req: AuthenticatedRequest) {
    return this.usersService.create(dto, req.user);
  }

  @Get()
  @Roles(Role.DIRECTOR)
  findAll() {
    return this.usersService.findAll();
  }

  @Get('directory')
  findDirectory(@Req() req: AuthenticatedRequest) {
    return this.usersService.findDirectory(req.user.sub);
  }

  @Get('teachers')
  @Roles(Role.DIRECTOR, Role.SALE, Role.OPS, Role.ACCOUNTING)
  findTeachers(@Req() req: AuthenticatedRequest) {
    return this.usersService.findTeachers(req.user);
  }

  @Get('sales')
  @Roles(Role.DIRECTOR, Role.SALE, Role.OPS, Role.ACCOUNTING)
  findSales() {
    return this.usersService.findByRole(Role.SALE);
  }

  @Get('experience-teachers')
  @Roles(Role.DIRECTOR, Role.SALE, Role.OPS, Role.ACCOUNTING, Role.EXPERIENCE_TEACHER)
  findExperienceTeachers() {
    return this.usersService.findByRole(Role.EXPERIENCE_TEACHER);
  }

  @Get('parents')
  @Roles(Role.DIRECTOR, Role.OPS, Role.SALE, Role.ACCOUNTING)
  findParents(@Req() req: AuthenticatedRequest) {
    return this.usersService.findParents(req.user);
  }

  @Get('parents/management')
  @Roles(Role.DIRECTOR, Role.OPS, Role.SALE, Role.ACCOUNTING)
  findParentsManagement(
    @Query() query: QueryParentManagementDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.usersService.findParentsManagement(query, req.user);
  }

  @Get('me')
  me(@Req() req: AuthenticatedRequest) {
    return {
      _id: req.user._id,
      email: req.user.email,
      fullName: req.user.fullName,
      role: req.user.role,
      userCode: req.user.userCode,
    };
  }

  @Get(':id/ads-attribution')
  @Roles(Role.DIRECTOR)
  getParentAdsAttribution(@Param('id', ParseMongoIdPipe) id: string) {
    return this.usersService.getParentAdsAttribution(id);
  }

  @Patch(':id/ads-attribution')
  @Roles(Role.DIRECTOR)
  updateParentAdsAttribution(
    @Param('id', ParseMongoIdPipe) id: string,
    @Body() dto: UpdateParentAdsAttributionDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.usersService.updateParentAdsAttribution(id, dto, req.user);
  }

  @Delete(':id/ads-attribution')
  @Roles(Role.DIRECTOR)
  clearParentAdsAttribution(@Param('id', ParseMongoIdPipe) id: string, @Req() req: AuthenticatedRequest) {
    return this.usersService.clearParentAdsAttribution(id, req.user);
  }

  @Patch(':id')
  @Roles(Role.DIRECTOR, Role.SALE)
  update(@Param('id', ParseMongoIdPipe) id: string, @Body() dto: UpdateUserDto, @Req() req: AuthenticatedRequest) {
    return this.usersService.update(id, dto, req.user);
  }

  @Post(':id/lock')
  @Roles(Role.DIRECTOR)
  lock(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.usersService.lock(id, req.user);
  }

  @Post(':id/unlock')
  @Roles(Role.DIRECTOR)
  unlock(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.usersService.unlock(id, req.user);
  }

  @Delete(':id')
  @Roles(Role.DIRECTOR)
  remove(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.usersService.removeByDirector(id, req.user);
  }
}
