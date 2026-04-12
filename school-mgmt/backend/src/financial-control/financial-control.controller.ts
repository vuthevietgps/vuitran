import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { FinancialControlService } from './financial-control.service';
import {
  CreateBankAccountDto, UpdateBankAccountDto,
  RecordBankTransactionDto, QueryBankTransactionDto,
} from './dto/bank-account.dto';
import {
  CreateFundDto, UpdateFundDto,
  FundTransactionDto, QueryFundTransactionDto,
  QueryCashFlowDto,
} from './dto/fund.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/interfaces/role.enum';
import { AuthenticatedRequest } from '../common/interfaces/authenticated-request.interface';

@Controller('financial-control')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.DIRECTOR, Role.ACCOUNTING, Role.SHAREHOLDER)
export class FinancialControlController {
  constructor(private readonly service: FinancialControlService) {}

  // ─── Dashboard ─────────────────────────────────────────────────
  @Get('dashboard')
  getDashboard() {
    return this.service.getFinancialDashboard();
  }

  @Get('investor-metrics')
  getInvestorMetrics(@Query('monthCount') monthCount?: string) {
    return this.service.getInvestorMetrics(monthCount);
  }

  // ─── Aging Report ───────────────────────────────────────────
  @Get('aging-report')
  getAgingReport(@Req() req: AuthenticatedRequest) {
    return this.service.getAgingReport(req.user);
  }

  // ─── Bank Reconciliation ────────────────────────────────────
  @Get('bank-reconciliation')
  getReconciliation(
    @Query('bankAccountId') bankAccountId: string,
    @Query('fromDate') fromDate: string,
    @Query('toDate') toDate: string,
  ) {
    return this.service.getReconciliation(bankAccountId, fromDate, toDate);
  }

  // ─── Balance Sheet ──────────────────────────────────────────
  @Get('balance-sheet')
  getBalanceSheet() {
    return this.service.getBalanceSheet();
  }

  // ─── Tax Report ────────────────────────────────────────────
  @Get('tax-report')
  getTaxReport(@Query('year') year: number) {
    return this.service.getTaxReport(year || new Date().getFullYear());
  }

  // ─── Alerts ───────────────────────────────────────────────────
  @Get('alerts')
  getAlerts() {
    return this.service.getFinancialAlerts();
  }

  // ─── Overview ───────────────────────────────────────────────────
  @Get('overview')
  getOverview(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.service.getFinancialOverview(startDate, endDate);
  }

  @Get('provisional-gross-profit')
  getProvisionalGrossProfit(@Query('month') month?: string) {
    return this.service.getProvisionalGrossProfit(month);
  }

  // ─── Bank Accounts ─────────────────────────────────────────────
  @Get('bank-accounts')
  getBankAccounts() {
    return this.service.findAllBankAccounts();
  }

  @Get('bank-accounts/summary')
  getBankAccountSummary() {
    return this.service.getBankAccountSummary();
  }

  @Get('bank-accounts/:id')
  getBankAccount(@Param('id') id: string) {
    return this.service.findBankAccount(id);
  }

  @Post('bank-accounts')
  @Roles(Role.DIRECTOR)
  createBankAccount(@Body() dto: CreateBankAccountDto, @Req() req: AuthenticatedRequest) {
    return this.service.createBankAccount(dto, req.user);
  }

  @Patch('bank-accounts/:id')
  @Roles(Role.DIRECTOR)
  updateBankAccount(
    @Param('id') id: string,
    @Body() dto: UpdateBankAccountDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.updateBankAccount(id, dto, req.user);
  }

  // ─── Bank Transactions ─────────────────────────────────────────
  @Get('bank-transactions')
  getBankTransactions(@Query() query: QueryBankTransactionDto) {
    return this.service.findBankTransactions(query);
  }

  @Post('bank-transactions')
  @Roles(Role.DIRECTOR, Role.ACCOUNTING)
  recordBankTransaction(@Body() dto: RecordBankTransactionDto, @Req() req: AuthenticatedRequest) {
    return this.service.recordBankTransaction(dto, req.user);
  }

  @Post('bank-transactions/:id/reconcile')
  @Roles(Role.DIRECTOR, Role.ACCOUNTING)
  reconcileTransaction(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.service.reconcileTransaction(id, req.user);
  }

  // ─── Funds ─────────────────────────────────────────────────────
  @Get('funds')
  getFunds() {
    return this.service.findAllFunds();
  }

  @Get('funds/summary')
  getFundsSummary() {
    return this.service.getFundsSummary();
  }

  @Get('funds/:id')
  getFund(@Param('id') id: string) {
    return this.service.findFund(id);
  }

  @Post('funds')
  @Roles(Role.DIRECTOR)
  createFund(@Body() dto: CreateFundDto, @Req() req: AuthenticatedRequest) {
    return this.service.createFund(dto, req.user);
  }

  @Patch('funds/:id')
  @Roles(Role.DIRECTOR)
  updateFund(@Param('id') id: string, @Body() dto: UpdateFundDto) {
    return this.service.updateFund(id, dto);
  }

  // ─── Fund Transactions ─────────────────────────────────────────
  @Get('fund-transactions')
  getFundTransactions(@Query() query: QueryFundTransactionDto) {
    return this.service.findFundTransactions(query);
  }

  @Post('fund-transactions')
  @Roles(Role.DIRECTOR, Role.ACCOUNTING)
  recordFundTransaction(@Body() dto: FundTransactionDto, @Req() req: AuthenticatedRequest) {
    return this.service.recordFundTransaction(dto, req.user);
  }

  // ─── Cash Flow ─────────────────────────────────────────────────
  @Get('cash-flow')
  getCashFlow(@Query() query: QueryCashFlowDto) {
    return this.service.getCashFlow(query);
  }

  // ─── P&L Report ────────────────────────────────────────────────
  @Get('profit-and-loss')
  getProfitAndLoss(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('basis') basis?: string,
  ) {
    return this.service.getProfitAndLoss(startDate, endDate, basis);
  }

  // ─── Reconciliation ────────────────────────────────────────────
  @Get('reconciliation')
  getReconciliationReport(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.service.getReconciliationReport(startDate, endDate);
  }
}
