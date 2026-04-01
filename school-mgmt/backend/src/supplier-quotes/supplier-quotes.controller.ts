import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/interfaces/role.enum';
import { SupplierQuotesService } from './supplier-quotes.service';
import { CreateSupplierQuoteDto } from './dto/create-supplier-quote.dto';
import { UpdateSupplierQuoteDto } from './dto/update-supplier-quote.dto';
import { QuerySupplierQuoteDto } from './dto/query-supplier-quote.dto';

@Controller('supplier-quotes')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SupplierQuotesController {
  constructor(private readonly service: SupplierQuotesService) {}

  @Get()
  @Roles(Role.DIRECTOR, Role.ACCOUNTING, Role.OPS)
  findAll(@Query() query: QuerySupplierQuoteDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  @Roles(Role.DIRECTOR, Role.ACCOUNTING, Role.OPS)
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @Roles(Role.DIRECTOR, Role.ACCOUNTING, Role.OPS)
  create(@Body() dto: CreateSupplierQuoteDto, @Request() req: any) {
    return this.service.create(dto, req.user);
  }

  @Patch(':id')
  @Roles(Role.DIRECTOR, Role.ACCOUNTING, Role.OPS)
  update(@Param('id') id: string, @Body() dto: UpdateSupplierQuoteDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.DIRECTOR, Role.ACCOUNTING)
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @Post(':id/accept')
  @Roles(Role.DIRECTOR, Role.ACCOUNTING)
  accept(@Param('id') id: string, @Request() req: any) {
    return this.service.accept(id, req.user);
  }

  @Post(':id/reject')
  @Roles(Role.DIRECTOR, Role.ACCOUNTING)
  reject(@Param('id') id: string, @Body('reason') reason: string, @Request() req: any) {
    return this.service.reject(id, reason, req.user);
  }

  @Post(':id/send')
  @Roles(Role.DIRECTOR, Role.ACCOUNTING, Role.OPS)
  markSent(@Param('id') id: string) {
    return this.service.markSent(id);
  }
}
