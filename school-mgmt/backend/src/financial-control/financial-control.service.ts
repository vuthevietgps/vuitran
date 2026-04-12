import { Injectable } from '@nestjs/common';
import { ClientSession } from 'mongoose';
import { BankAccount } from './schemas/bank-account.schema';
import { BankTransaction } from './schemas/bank-transaction.schema';
import { Fund, FundDocument } from './schemas/fund.schema';
import { FundTransaction } from './schemas/fund-transaction.schema';
import {
  CreateBankAccountDto, UpdateBankAccountDto,
  RecordBankTransactionDto, QueryBankTransactionDto,
} from './dto/bank-account.dto';
import {
  CreateFundDto, UpdateFundDto,
  FundTransactionDto, QueryFundTransactionDto,
  QueryCashFlowDto,
} from './dto/fund.dto';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { BankAccountDocument } from './schemas/bank-account.schema';
import { FinancialControlBankFundService } from './financial-control-bank-fund.service';
import { FinancialControlCashflowService } from './financial-control-cashflow.service';
import { FinancialControlPnlService } from './financial-control-pnl.service';
import { FinancialControlDashboardService } from './financial-control-dashboard.service';
import { FinancialControlAlertsService } from './financial-control-alerts.service';
import { FinancialControlAgingService } from './financial-control-aging.service';
import { FinancialControlBankReconciliationService } from './financial-control-bank-reconciliation.service';

@Injectable()
export class FinancialControlService {
  constructor(
    private readonly bankFundService: FinancialControlBankFundService,
    private readonly cashflowService: FinancialControlCashflowService,
    private readonly pnlService: FinancialControlPnlService,
    private readonly dashboardSvc: FinancialControlDashboardService,
    private readonly alertsService: FinancialControlAlertsService,
    private readonly agingService: FinancialControlAgingService,
    private readonly bankReconciliationService: FinancialControlBankReconciliationService,
  ) {}

  // ── Bank account delegation ──

  async createBankAccount(dto: CreateBankAccountDto, user: JwtPayload): Promise<BankAccount> {
    return this.bankFundService.createBankAccount(dto, user);
  }

  async findAllBankAccounts(): Promise<BankAccount[]> {
    return this.bankFundService.findAllBankAccounts();
  }

  async findBankAccount(id: string): Promise<BankAccountDocument> {
    return this.bankFundService.findBankAccount(id);
  }

  async updateBankAccount(id: string, dto: UpdateBankAccountDto, _user: JwtPayload): Promise<BankAccount> {
    return this.bankFundService.updateBankAccount(id, dto);
  }

  async getBankAccountSummary(): Promise<any> {
    return this.bankFundService.getBankAccountSummary();
  }

  async recordBankTransaction(
    dto: RecordBankTransactionDto,
    user: JwtPayload,
    options?: { session?: ClientSession },
  ): Promise<BankTransaction> {
    return this.bankFundService.recordBankTransaction(dto, user, options);
  }

  async findBankTransactions(query: QueryBankTransactionDto): Promise<BankTransaction[]> {
    return this.bankFundService.findBankTransactions(query);
  }

  async reconcileTransaction(id: string, user: JwtPayload): Promise<BankTransaction> {
    return this.bankFundService.reconcileTransaction(id, user);
  }

  // ── Fund delegation ──

  async createFund(dto: CreateFundDto, user: JwtPayload): Promise<Fund> {
    return this.bankFundService.createFund(dto, user);
  }

  async findAllFunds(): Promise<Fund[]> {
    return this.bankFundService.findAllFunds();
  }

  async findFund(id: string): Promise<FundDocument> {
    return this.bankFundService.findFund(id);
  }

  async updateFund(id: string, dto: UpdateFundDto): Promise<Fund> {
    return this.bankFundService.updateFund(id, dto);
  }

  async recordFundTransaction(dto: FundTransactionDto, user: JwtPayload): Promise<FundTransaction> {
    return this.bankFundService.recordFundTransaction(dto, user);
  }

  async findFundTransactions(query: QueryFundTransactionDto): Promise<FundTransaction[]> {
    return this.bankFundService.findFundTransactions(query);
  }

  async getFundsSummary(): Promise<any> {
    return this.bankFundService.getFundsSummary();
  }

  // ── Cash flow ──

  async getCashFlow(query: QueryCashFlowDto): Promise<any> {
    return this.cashflowService.getCashFlow(query);
  }

  async getProvisionalGrossProfit(month?: string) {
    return this.cashflowService.getProvisionalGrossProfit(month);
  }

  // ── P&L / Balance Sheet / Tax ──

  async getProfitAndLoss(startDate?: string, endDate?: string, basis?: string): Promise<any> {
    return this.pnlService.getProfitAndLoss(startDate, endDate, basis);
  }

  async getBalanceSheet() {
    return this.pnlService.getBalanceSheet();
  }

  async getTaxReport(year: number) {
    return this.pnlService.getTaxReport(year);
  }

  // ── Dashboard / Overview / Investor ──

  async getFinancialDashboard(): Promise<any> {
    return this.dashboardSvc.getFinancialDashboard();
  }

  async getReconciliationReport(startDate?: string, endDate?: string): Promise<any> {
    return this.dashboardSvc.getReconciliationReport(startDate, endDate);
  }

  async getFinancialOverview(startDate?: string, endDate?: string): Promise<any> {
    return this.dashboardSvc.getFinancialOverview(startDate, endDate);
  }

  async getInvestorMetrics(monthCountInput?: number | string): Promise<any> {
    return this.dashboardSvc.getInvestorMetrics(monthCountInput);
  }

  // ── Alerts ──

  async getFinancialAlerts(): Promise<any> {
    return this.alertsService.getFinancialAlerts();
  }

  // ── Aging ──

  async getAgingReport(user?: JwtPayload) {
    return this.agingService.getAgingReport(user);
  }

  // ── Bank Reconciliation ──

  async getReconciliation(bankAccountId: string, fromDate: string, toDate: string) {
    return this.bankReconciliationService.getReconciliation(bankAccountId, fromDate, toDate);
  }
}
