import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuthenticatedRequest } from '../common/interfaces/authenticated-request.interface';
import { Role } from '../common/interfaces/role.enum';
import { ParseMongoIdPipe } from '../common/pipes/parse-mongo-id.pipe';
import { ConvertTeacherRegistrationDto } from './dto/convert-teacher-registration.dto';
import { CreateTeacherRegistrationDto } from './dto/create-teacher-registration.dto';
import { QueryTeacherRegistrationDto } from './dto/query-teacher-registration.dto';
import { UpdateTeacherRegistrationDto } from './dto/update-teacher-registration.dto';
import { TeacherRegistrationsService } from './teacher-registrations.service';

@Controller('teacher-registrations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TeacherRegistrationsController {
  constructor(
    private readonly teacherRegistrationsService: TeacherRegistrationsService,
  ) {}

  @Get()
  @Roles(Role.DIRECTOR, Role.OPS)
  findAll(@Query() query: QueryTeacherRegistrationDto) {
    return this.teacherRegistrationsService.findAll(query);
  }

  @Get(':id')
  @Roles(Role.DIRECTOR, Role.OPS)
  findOne(@Param('id', ParseMongoIdPipe) id: string) {
    return this.teacherRegistrationsService.findOne(id);
  }

  @Patch(':id')
  @Roles(Role.DIRECTOR, Role.OPS)
  update(
    @Param('id', ParseMongoIdPipe) id: string,
    @Body() dto: UpdateTeacherRegistrationDto,
  ) {
    return this.teacherRegistrationsService.update(id, dto);
  }

  @Post(':id/convert')
  @Roles(Role.DIRECTOR)
  convert(
    @Param('id', ParseMongoIdPipe) id: string,
    @Body() dto: ConvertTeacherRegistrationDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.teacherRegistrationsService.convert(id, dto, req.user);
  }
}

@Controller('public/teacher-registrations')
@UseGuards(ThrottlerGuard)
export class PublicTeacherRegistrationsController {
  constructor(
    private readonly teacherRegistrationsService: TeacherRegistrationsService,
  ) {}

  @Post()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  create(@Body() dto: CreateTeacherRegistrationDto) {
    return this.teacherRegistrationsService.createPublic(dto);
  }
}
