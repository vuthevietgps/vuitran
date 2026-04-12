import {
  Controller, Get, Post, Patch, Body, Param, Query, Req, UseGuards,
} from '@nestjs/common';
import { LoansService } from './loans.service';
import { CreateLoanDto, UpdateLoanDto, RecordLoanPaymentDto, QueryLoanDto, QueryLoanPaymentDto } from './dto/loan.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuthenticatedRequest } from '../common/interfaces/authenticated-request.interface';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/interfaces/role.enum';

@Controller('loans')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.DIRECTOR, Role.ACCOUNTING)
export class LoansController {
  constructor(private readonly loansService: LoansService) {}

  // ─── Loans ───────────────────────────────────────────────────────

  @Get()
  findAll(@Query() query: QueryLoanDto) {
    return this.loansService.findAll(query);
  }

  @Get('summary')
  @Roles(Role.DIRECTOR, Role.ACCOUNTING, Role.SHAREHOLDER)
  getSummary() {
    return this.loansService.getLoanSummary();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.loansService.findOne(id);
  }

  @Post()
  @Roles(Role.DIRECTOR)
  create(@Body() dto: CreateLoanDto, @Req() req: AuthenticatedRequest) {
    return this.loansService.create(dto, req.user);
  }

  @Patch(':id')
  @Roles(Role.DIRECTOR)
  update(@Param('id') id: string, @Body() dto: UpdateLoanDto) {
    return this.loansService.update(id, dto);
  }

  @Post(':id/activate')
  @Roles(Role.DIRECTOR)
  activate(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.loansService.activate(id, req.user);
  }

  // ─── Payments ────────────────────────────────────────────────────

  @Get('payments/list')
  findPayments(@Query() query: QueryLoanPaymentDto) {
    return this.loansService.findPayments(query);
  }

  @Post('payments/record')
  recordPayment(@Body() dto: RecordLoanPaymentDto, @Req() req: AuthenticatedRequest) {
    return this.loansService.recordPayment(dto, req.user);
  }

  @Post('update-overdue')
  updateOverdue() {
    return this.loansService.updateOverduePayments();
  }
}
