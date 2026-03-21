import {
  Body,
  Controller,
  Delete,
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
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/interfaces/role.enum';
import { AuthenticatedRequest } from '../common/interfaces/authenticated-request.interface';
import { ParseMongoIdPipe } from '../common/pipes/parse-mongo-id.pipe';
import { CreateLandingPageDto } from './dto/create-landing-page.dto';
import { QueryLandingPageSubmissionsDto } from './dto/query-landing-page-submissions.dto';
import { QueryLandingPagesDto } from './dto/query-landing-pages.dto';
import { SubmitLandingPageDto } from './dto/submit-landing-page.dto';
import { UpdateLandingPageDto } from './dto/update-landing-page.dto';
import { LandingPagesService } from './landing-pages.service';

@Controller('landing-pages')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LandingPagesController {
  constructor(private readonly landingPagesService: LandingPagesService) {}

  @Get()
  @Roles(Role.DIRECTOR, Role.OPS, Role.SALE)
  findAll(@Query() query: QueryLandingPagesDto) {
    return this.landingPagesService.findAll(query);
  }

  @Get('submissions')
  @Roles(Role.DIRECTOR, Role.OPS, Role.SALE)
  findSubmissions(@Query() query: QueryLandingPageSubmissionsDto) {
    return this.landingPagesService.findSubmissions(query);
  }

  @Get(':id')
  @Roles(Role.DIRECTOR, Role.OPS, Role.SALE)
  findOne(@Param('id', ParseMongoIdPipe) id: string) {
    return this.landingPagesService.findOne(id);
  }

  @Post()
  @Roles(Role.DIRECTOR, Role.OPS)
  create(@Body() dto: CreateLandingPageDto, @Req() req: AuthenticatedRequest) {
    return this.landingPagesService.create(dto, req.user);
  }

  @Patch(':id')
  @Roles(Role.DIRECTOR, Role.OPS)
  update(@Param('id', ParseMongoIdPipe) id: string, @Body() dto: UpdateLandingPageDto) {
    return this.landingPagesService.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.DIRECTOR)
  async delete(@Param('id', ParseMongoIdPipe) id: string) {
    await this.landingPagesService.delete(id);
    return { message: 'Da xoa landing page' };
  }
}

@Controller('public/landing-pages')
@UseGuards(ThrottlerGuard)
export class PublicLandingPagesController {
  constructor(private readonly landingPagesService: LandingPagesService) {}

  @Get(':slug')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  getBySlug(@Param('slug') slug: string) {
    return this.landingPagesService.getPublicBySlug(slug);
  }

  @Post(':slug/submit')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  submitBySlug(@Param('slug') slug: string, @Body() dto: SubmitLandingPageDto) {
    return this.landingPagesService.submitPublicBySlug(slug, dto);
  }
}
