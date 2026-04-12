import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../environments/environment';

export interface BankAccount {
  _id: string;
  accountCode: string;
  bankName: string;
  accountNumber: string;
  accountHolder?: string;
  branch?: string;
  currentBalance: number;
  openingBalance: number;
  status: string;
  description?: string;
  isPrimary?: boolean;
  createdByName?: string;
  createdAt: string;
}

export interface BankTransaction {
  _id: string;
  transactionCode: string;
  bankAccountId: string;
  type: string;
  category: string;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  transactionDate: string;
  description?: string;
  reference?: string;
  referenceType?: string;
  recordedByName: string;
  isReconciled?: boolean;
  createdAt: string;
}

export interface Fund {
  _id: string;
  fundCode: string;
  name: string;
  fundType: string;
  currentBalance: number;
  minimumBalance: number;
  targetBalance: number;
  status: string;
  description?: string;
  totalDeposited: number;
  totalWithdrawn: number;
  createdByName?: string;
  createdAt: string;
}

export interface FundTransaction {
  _id: string;
  transactionCode: string;
  fundId: string;
  type: string;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  transactionDate: string;
  description?: string;
  reference?: string;
  performedByName: string;
  createdAt: string;
}

export interface CashFlowData {
  totalInflow: number;
  totalOutflow: number;
  netCashFlow: number;
  timeline: any[];
  basis?: {
    requested: 'cash' | 'accrual';
    applied: 'cash' | 'accrual';
    totalInflow: 'cash' | 'accrual';
    totalOutflow: 'cash' | 'accrual';
  };
  accrualReference?: {
    sessionRevenue: number;
    teacherCost: number;
    serviceMargin: number;
  };
  period: { startDate: string; endDate: string; groupBy: string };
}

export interface ProfitAndLoss {
  period: { startDate: string; endDate: string };
  basis?: { selected: 'cash' | 'accrual'; default: 'cash' | 'accrual'; supported: Array<'cash' | 'accrual'> };
  revenue: {
    total: number;
    sessionRevenue: number;
    invoiceRevenue?: number;
    accrualRevenue?: number;
    byBasis?: { cash: number; accrual: number };
    sessionCount: number;
    byInvoiceType: Record<string, any>;
  };
  costs: {
    costOfGoodsSold?: number;
    teacherCost: number;
    teacherPayrollCash?: number;
    staffPayrollCash?: number;
    payrollCost: number;
    operatingExpenses: number;
    expenseByCategory: Record<string, any>;
    adCost: number;
    adCostByPlatform: Record<string, any>;
    interestExpense?: number;
    totalCosts: number;
    byBasis?: Record<string, any>;
  };
  summary: { basis?: 'cash' | 'accrual'; grossProfit: number; grossMargin: number; netProfit: number; netMargin: number; byBasis?: Record<string, any> };
}

export interface FinancialDashboard {
  cashPosition: {
    bankBalance: number;
    bankAccountCount: number;
    fundBalance: number;
    fundCount: number;
    marketingFund: number;
    marketingFundCount: number;
    availableCash: number;
  };
  obligations: {
    payrollPayable: number;
    payrollPayableCount: number;
    expensePayable: number;
    expensePayableCount: number;
    orderPayable: number;
    orderPayableCount: number;
    totalPayable14Days: number;
    operatingReserve3Months: number;
    burnRate: number;
    runway: number;
    reserveHealthy: boolean;
    cashAfterObligations: number;
  };
  deferredRevenue: {
    walletBalance: number;
    walletCount: number;
    pendingInvoiceAmount: number;
    pendingInvoiceCount: number;
  };
  metrics: {
    burnRate: number;
    runway: number;
    currentRatio: number;
    grossMargin: number;
    netMargin: number;
    grossProfit: number;
    netProfit: number;
    revenueGrowth: number;
    thisMonthRevenue: number;
    lastMonthRevenue: number;
    accountsReceivable: number;
    accountsPayable: number;
    deferredRevenue: number;
  };
  debtPosition?: {
    totalDebt: number;
    activeLoanCount: number;
    loanPayable: number;
    loanPayableCount: number;
  };
  fundWarnings: any[];
}

export interface ProvisionalGrossProfit {
  period: {
    month: number;
    year: number;
    startDate: string;
    endDate: string;
  };
  cashInflow: {
    approvedInvoiceAmount: number;
    approvedInvoiceCount: number;
  };
  provisional: {
    revenueAmount: number;
    teacherPayoutAmount: number;
    attendanceCount: number;
  };
  grossProfitAmount: number;
}

export interface FinancialAlert {
  id: string;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  category: string;
  title: string;
  message: string;
  data: any;
  actions: Array<{ label: string; type: string; target?: string; amount?: number }>;
}

export interface FinancialAlertsResponse {
  totalAlerts: number;
  criticalCount: number;
  warningCount: number;
  infoCount: number;
  marketingBudget: {
    fundBalance: number;
    optimalDailyBudget: number;
    optimalMonthlyBudget: number;
    groupBreakdown: any[];
  };
  alerts: FinancialAlert[];
}

export interface FinancialOverview {
  bankAccounts: { totalBalance: number; accountCount: number; accounts: any[] };
  funds: { totalBalance: number; fundCount: number; warningCount: number; warnings: any[]; funds: any[] };
  cashFlow: { totalInflow: number; totalOutflow: number; netCashFlow: number; recentMonths: any[] };
  profitAndLoss: ProfitAndLoss;
}

export interface InvestorMetrics {
  snapshot: {
    cashOnHand: number;
    totalFundBalance: number;
    burnRate: number;
    runway: number;
  };
  revenue: {
    recognizedRevenue: {
      thisMonth: number;
      lastMonth: number;
      ytd: number;
      growthPercent?: number;
    };
    unearnedRevenue: {
      walletBalance: number;
      unconsumedInvoiceValue: number;
      total: number;
    };
  };
  profitability: {
    grossProfit: number;
    grossMargin: number;
    netProfit: number;
    netMargin: number;
    ebitda: number;
    ebitdaMargin: number;
  };
  unitEconomics: {
    cac: number | null;
    costPerLead: number | null;
    costPerOrder: number | null;
    ltv: number;
    ltvCacRatio: number | null;
    arpu: number | null;
    arpuActive: number | null;
    activeStudents: number;
    enrolledStudents: number;
  };
  customerBase: {
    activeStudents: number;
    enrolledStudents: number;
  };
  methodology: {
    cac: {
      formula: string;
      note: string;
    };
    ltv: {
      formula: string;
      note: string;
    };
    arpu: {
      formula: string;
      activeFormula?: string;
      note: string;
    };
  };
  retention: {
    retentionRate: number;
    churnRate: number;
    atRiskCount: number;
  };
  liabilities: {
    accountsReceivable: number;
    payrollPayable: number;
    expensePayable: number;
    loanSummary?: any;
    arAgingBuckets?: Record<string, number>;
  };
  trend: {
    monthCount: number;
    months: string[];
    revenue: number[];
    netProfit: number[];
    studentCount: number[];
  };
}

@Injectable({ providedIn: 'root' })
export class FinancialControlService {
  private apiUrl = `${environment.apiBase}/financial-control`;

  constructor(private http: HttpClient) {}

  // ─── Dashboard ─────────────────────────────────────────────────
  async getDashboard(): Promise<FinancialDashboard> {
    const response = await this.http.get<unknown>(`${this.apiUrl}/dashboard`).toPromise();
    return this.validateDashboardResponse(response);
  }

  async getInvestorMetrics(monthCount?: number): Promise<InvestorMetrics> {
    let params = new HttpParams();
    if (typeof monthCount === 'number' && Number.isFinite(monthCount)) {
      params = params.set('monthCount', String(monthCount));
    }

    const response = await this.http.get<unknown>(`${this.apiUrl}/investor-metrics`, { params }).toPromise();
    return this.validateInvestorMetricsResponse(response);
  }

  async getProvisionalGrossProfit(month?: string): Promise<ProvisionalGrossProfit> {
    let params = new HttpParams();
    if (month) params = params.set('month', month);
    return this.http.get<ProvisionalGrossProfit>(`${this.apiUrl}/provisional-gross-profit`, { params }).toPromise() as Promise<ProvisionalGrossProfit>;
  }

  // ─── Alerts ────────────────────────────────────────────────────
  async getAlerts(): Promise<FinancialAlertsResponse> {
    const response = await this.http.get<unknown>(`${this.apiUrl}/alerts`).toPromise();
    return this.validateAlertsResponse(response);
  }

  // ─── Overview ───────────────────────────────────────────────────
  async getOverview(startDate?: string, endDate?: string): Promise<FinancialOverview> {
    let params = new HttpParams();
    if (startDate) params = params.set('startDate', startDate);
    if (endDate) params = params.set('endDate', endDate);
    return this.http.get<FinancialOverview>(`${this.apiUrl}/overview`, { params }).toPromise() as Promise<FinancialOverview>;
  }

  // ─── Bank Accounts ─────────────────────────────────────────────
  async getBankAccounts(): Promise<BankAccount[]> {
    return this.http.get<BankAccount[]>(`${this.apiUrl}/bank-accounts`).toPromise() as Promise<BankAccount[]>;
  }

  async getBankAccountSummary(): Promise<any> {
    return this.http.get<any>(`${this.apiUrl}/bank-accounts/summary`).toPromise();
  }

  async createBankAccount(data: any): Promise<{ ok: boolean; message?: string; data?: any }> {
    try {
      const result = await this.http.post(`${this.apiUrl}/bank-accounts`, data).toPromise();
      return { ok: true, data: result };
    } catch (err: any) { return { ok: false, message: err.error?.message || 'Failed' }; }
  }

  async updateBankAccount(id: string, data: any): Promise<{ ok: boolean; message?: string }> {
    try { await this.http.patch(`${this.apiUrl}/bank-accounts/${id}`, data).toPromise(); return { ok: true }; }
    catch (err: any) { return { ok: false, message: err.error?.message || 'Failed' }; }
  }

  // ─── Bank Transactions ─────────────────────────────────────────
  async getBankTransactions(params?: Record<string, string>): Promise<BankTransaction[]> {
    let httpParams = new HttpParams();
    if (params) Object.entries(params).forEach(([k, v]) => { if (v) httpParams = httpParams.set(k, v); });
    return this.http.get<BankTransaction[]>(`${this.apiUrl}/bank-transactions`, { params: httpParams }).toPromise() as Promise<BankTransaction[]>;
  }

  async recordBankTransaction(data: any): Promise<{ ok: boolean; message?: string }> {
    try { await this.http.post(`${this.apiUrl}/bank-transactions`, data).toPromise(); return { ok: true }; }
    catch (err: any) { return { ok: false, message: err.error?.message || 'Failed' }; }
  }

  async reconcileTransaction(id: string): Promise<{ ok: boolean; message?: string }> {
    try { await this.http.post(`${this.apiUrl}/bank-transactions/${id}/reconcile`, {}).toPromise(); return { ok: true }; }
    catch (err: any) { return { ok: false, message: err.error?.message || 'Failed' }; }
  }

  // ─── Funds ─────────────────────────────────────────────────────
  async getFunds(): Promise<Fund[]> {
    return this.http.get<Fund[]>(`${this.apiUrl}/funds`).toPromise() as Promise<Fund[]>;
  }

  async getFundsSummary(): Promise<any> {
    return this.http.get<any>(`${this.apiUrl}/funds/summary`).toPromise();
  }

  async createFund(data: any): Promise<{ ok: boolean; message?: string }> {
    try { await this.http.post(`${this.apiUrl}/funds`, data).toPromise(); return { ok: true }; }
    catch (err: any) { return { ok: false, message: err.error?.message || 'Failed' }; }
  }

  async updateFund(id: string, data: any): Promise<{ ok: boolean; message?: string }> {
    try { await this.http.patch(`${this.apiUrl}/funds/${id}`, data).toPromise(); return { ok: true }; }
    catch (err: any) { return { ok: false, message: err.error?.message || 'Failed' }; }
  }

  // ─── Fund Transactions ─────────────────────────────────────────
  async getFundTransactions(params?: Record<string, string>): Promise<FundTransaction[]> {
    let httpParams = new HttpParams();
    if (params) Object.entries(params).forEach(([k, v]) => { if (v) httpParams = httpParams.set(k, v); });
    return this.http.get<FundTransaction[]>(`${this.apiUrl}/fund-transactions`, { params: httpParams }).toPromise() as Promise<FundTransaction[]>;
  }

  async recordFundTransaction(data: any): Promise<{ ok: boolean; message?: string }> {
    try { await this.http.post(`${this.apiUrl}/fund-transactions`, data).toPromise(); return { ok: true }; }
    catch (err: any) { return { ok: false, message: err.error?.message || 'Failed' }; }
  }

  // ─── Cash Flow ─────────────────────────────────────────────────
  async getCashFlow(params?: Record<string, string>): Promise<CashFlowData> {
    let httpParams = new HttpParams();
    if (params) Object.entries(params).forEach(([k, v]) => { if (v) httpParams = httpParams.set(k, v); });
    return this.http.get<CashFlowData>(`${this.apiUrl}/cash-flow`, { params: httpParams }).toPromise() as Promise<CashFlowData>;
  }

  // ─── P&L ───────────────────────────────────────────────────────
  async getProfitAndLoss(startDate?: string, endDate?: string, basis: 'cash' | 'accrual' = 'cash'): Promise<ProfitAndLoss> {
    let params = new HttpParams();
    if (startDate) params = params.set('startDate', startDate);
    if (endDate) params = params.set('endDate', endDate);
    params = params.set('basis', basis);
    return this.http.get<ProfitAndLoss>(`${this.apiUrl}/profit-and-loss`, { params }).toPromise() as Promise<ProfitAndLoss>;
  }

  // ─── Reconciliation ────────────────────────────────────────────
  async getReconciliationReport(startDate?: string, endDate?: string): Promise<any> {
    let params = new HttpParams();
    if (startDate) params = params.set('startDate', startDate);
    if (endDate) params = params.set('endDate', endDate);
    return this.http.get<any>(`${this.apiUrl}/reconciliation`, { params }).toPromise();
  }

  private validateDashboardResponse(value: unknown): FinancialDashboard {
    const response = this.expectRecord(value, 'financial dashboard');
    this.expectRecord(response['cashPosition'], 'financial dashboard.cashPosition');
    this.expectRecord(response['obligations'], 'financial dashboard.obligations');
    this.expectRecord(response['metrics'], 'financial dashboard.metrics');
    return response as unknown as FinancialDashboard;
  }

  private validateInvestorMetricsResponse(value: unknown): InvestorMetrics {
    const response = this.expectRecord(value, 'investor metrics');
    this.expectRecord(response['snapshot'], 'investor metrics.snapshot');
    this.expectRecord(response['revenue'], 'investor metrics.revenue');
    this.expectRecord(response['profitability'], 'investor metrics.profitability');
    this.expectRecord(response['unitEconomics'], 'investor metrics.unitEconomics');
    this.expectRecord(response['customerBase'], 'investor metrics.customerBase');
    this.expectRecord(response['methodology'], 'investor metrics.methodology');
    const trend = this.expectRecord(response['trend'], 'investor metrics.trend');
    this.expectArray(trend['months'], 'investor metrics.trend.months');
    this.expectArray(trend['revenue'], 'investor metrics.trend.revenue');
    this.expectArray(trend['netProfit'], 'investor metrics.trend.netProfit');
    this.expectArray(trend['studentCount'], 'investor metrics.trend.studentCount');
    return response as unknown as InvestorMetrics;
  }

  private validateAlertsResponse(value: unknown): FinancialAlertsResponse {
    const response = this.expectRecord(value, 'financial alerts');
    this.expectArray(response['alerts'], 'financial alerts.alerts');
    return response as unknown as FinancialAlertsResponse;
  }

  private expectRecord(value: unknown, label: string): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error(`Invalid ${label} response.`);
    }
    return value as Record<string, unknown>;
  }

  private expectArray(value: unknown, label: string): unknown[] {
    if (!Array.isArray(value)) {
      throw new Error(`Invalid ${label} response.`);
    }
    return value;
  }
}
