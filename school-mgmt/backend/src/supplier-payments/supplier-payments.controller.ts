import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/interfaces/role.enum';
import { SupplierPaymentsService } from './supplier-payments.service';
import { CreateSupplierPaymentDto } from './dto/create-supplier-payment.dto';
import { UpdateSupplierPaymentDto } from './dto/update-supplier-payment.dto';
import { QuerySupplierPaymentDto } from './dto/query-supplier-payment.dto';
import { PaySupplierPaymentDto } from './dto/pay-supplier-payment.dto';

@Controller('supplier-payments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SupplierPaymentsController {
  constructor(private readonly service: SupplierPaymentsService) {}

  @Get('stats')
  @Roles(Role.DIRECTOR, Role.ACCOUNTING)
  getStats() {
    return this.service.getStats();
  }

  @Get()
  @Roles(Role.DIRECTOR, Role.ACCOUNTING, Role.OPS)
  findAll(@Query() query: QuerySupplierPaymentDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  @Roles(Role.DIRECTOR, Role.ACCOUNTING, Role.OPS)
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @Roles(Role.DIRECTOR, Role.ACCOUNTING, Role.OPS)
  create(@Body() dto: CreateSupplierPaymentDto, @Request() req: any) {
    return this.service.create(dto, req.user);
  }

  @Patch(':id')
  @Roles(Role.DIRECTOR, Role.ACCOUNTING, Role.OPS)
  update(@Param('id') id: string, @Body() dto: UpdateSupplierPaymentDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.DIRECTOR, Role.ACCOUNTING)
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @Post(':id/approve')
  @Roles(Role.DIRECTOR, Role.ACCOUNTING)
  approve(@Param('id') id: string, @Request() req: any) {
    return this.service.approve(id, req.user);
  }

  @Post(':id/reject')
  @Roles(Role.DIRECTOR, Role.ACCOUNTING)
  reject(@Param('id') id: string, @Body('reason') reason: string, @Request() req: any) {
    return this.service.reject(id, reason, req.user);
  }

  @Post(':id/mark-paid')
  @Roles(Role.DIRECTOR, Role.ACCOUNTING)
  markPaid(@Param('id') id: string, @Body() dto: PaySupplierPaymentDto, @Request() req: any) {
    return this.service.markPaid(id, dto, req.user);
  }
}
