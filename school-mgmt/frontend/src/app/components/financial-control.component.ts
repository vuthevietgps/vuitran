import { Component, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  FinancialControlService,
  BankAccount, BankTransaction, Fund, FundTransaction,
  FinancialOverview, CashFlowData, ProfitAndLoss, FinancialDashboard,
  FinancialAlertsResponse, FinancialAlert, ProvisionalGrossProfit,
} from '../services/financial-control.service';
import { AuthService } from '../services/auth.service';
import { Role } from '../models/role.enum';

import { FlowGuideComponent } from './shared/flow-guide.component';
import {
  FUND_TYPE_LABELS, TX_TYPE_LABELS, CATEGORY_LABELS,
  EXPENSE_CAT_LABELS, ALERT_CATEGORY_LABELS,
} from './financial-control.constants';

@Component({
  selector: 'app-financial-control',
  standalone: true,
  imports: [CommonModule, FormsModule, FlowGuideComponent],
  templateUrl: './financial-control.component.html',
  styleUrls: ['./financial-control.component.css'],
})
export class FinancialControlComponent implements OnInit {
  Math = Math;
  tabs = [
    { key: 'overview', label: 'Tổng quan', icon: '📊' },
    { key: 'provisional-gross-profit', label: 'Lợi nhuận gộp tạm tính', icon: '📉' },
    { key: 'alerts', label: 'Cảnh báo', icon: '🚨' },
    { key: 'bank', label: 'Ngân hàng', icon: '🏦' },
    { key: 'funds', label: 'Quỹ', icon: '🏛️' },
    { key: 'cashflow', label: 'Dòng tiền', icon: '💰' },
    { key: 'pnl', label: 'P&L', icon: '📈' },
    { key: 'reconciliation', label: 'Đối soát', icon: '🔄' },
  ];
  activeTab = 'overview';

  // Date filters
  startDate = '';
  endDate = '';

  // Data signals
  dashboard = signal<FinancialDashboard | null>(null);
  overview = signal<FinancialOverview | null>(null);
  bankAccounts = signal<BankAccount[]>([]);
  bankTransactions = signal<BankTransaction[]>([]);
  funds = signal<Fund[]>([]);
  fundTransactions = signal<FundTransaction[]>([]);
  cashFlow = signal<CashFlowData | null>(null);
  pnl = signal<ProfitAndLoss | null>(null);
  reconciliation = signal<any>(null);
  alertsData = signal<FinancialAlertsResponse | null>(null);
  provisionalGrossProfit = signal<ProvisionalGrossProfit | null>(null);

  // Selection
  selectedBankAccount = signal<BankAccount | null>(null);
  selectedFund = signal<Fund | null>(null);

  // Filter states
  provisionalMonth = this.currentMonthValue();
  bankTxType = '';
  bankTxKeyword = '';
  cashFlowGroupBy = 'month';
  pnlBasis: 'cash' | 'accrual' = 'cash';

  // Modals
  showBankAccountModal = signal(false);
  showBankTxModal = signal(false);
  showFundModal = signal(false);
  showFundTxModal = signal(false);
  editingBankAccount = signal<BankAccount | null>(null);
  editingFund = signal<Fund | null>(null);
  submittingBankAccount = signal(false);
  submittingFund = signal(false);
  modalError = signal('');

  // Forms
  bankAccountForm: any = { bankName: '', accountNumber: '', accountHolder: '', branch: '', openingBalance: 0, description: '', isPrimary: false };
  bankTxForm: any = { bankAccountId: '', type: 'DEPOSIT', category: 'OTHER', amount: 0, transactionDate: '', description: '', reference: '' };
  fundForm: any = { name: '', fundType: 'RESERVE', currentBalance: 0, minimumBalance: 0, targetBalance: 0, description: '' };
  fundTxForm: any = { type: 'DEPOSIT', amount: 0, transactionDate: '', description: '', reference: '' };

  constructor(private service: FinancialControlService, private auth: AuthService, private router: Router) {}

  ngOnInit() { this.reload(); }

  isDirector(): boolean { return this.auth.hasRole([Role.DIRECTOR]); }
  isShareholder(): boolean { return this.auth.hasRole([Role.SHAREHOLDER]); }

  // Labels
  fundTypeLabel(t: string) { return FUND_TYPE_LABELS[t] || t; }
  txTypeLabel(t: string) { return TX_TYPE_LABELS[t] || t; }
  categoryLabel(c: string) { return CATEGORY_LABELS[c] || c; }
  expenseCatLabel(c: string) { return EXPENSE_CAT_LABELS[c] || c; }
  private currentMonthValue(): string {
    const now = new Date();
    const month = `${now.getMonth() + 1}`.padStart(2, '0');
    return `${now.getFullYear()}-${month}`;
  }

  isInflow(type: string): boolean {
    return ['DEPOSIT', 'TRANSFER_IN', 'INTEREST'].includes(type);
  }

  invoiceTypeEntries() {
    if (!this.pnl()) return [];
    return Object.entries(this.pnl()!.revenue.byInvoiceType).map(([key, value]) => ({ key, value }));
  }

  expenseCatEntries() {
    if (!this.pnl()) return [];
    return Object.entries(this.pnl()!.costs.expenseByCategory).map(([key, value]) => ({ key, value }));
  }

  adCostPlatformEntries() {
    if (!this.pnl()?.costs?.adCostByPlatform) return [];
    return Object.entries(this.pnl()!.costs.adCostByPlatform).map(([key, value]) => ({ key, value }));
  }

  async reload() {
    this.loadTab(this.activeTab);
  }

  async loadTab(tab: string) {
    try {
      switch (tab) {
        case 'overview':
          this.dashboard.set(await this.service.getDashboard());
          break;
        case 'provisional-gross-profit':
          await this.loadProvisionalGrossProfit();
          break;
        case 'alerts':
          this.alertsData.set(await this.service.getAlerts());
          break;
        case 'bank':
          {
            const bankAccounts = await this.service.getBankAccounts();
            this.bankAccounts.set(bankAccounts);
            this.syncSelectedBankAccount(bankAccounts);
            await this.loadBankTransactions();
          }
          break;
        case 'funds':
          {
            const funds = await this.service.getFunds();
            this.funds.set(funds);
            this.syncSelectedFund(funds);
            if (this.selectedFund()) {
              await this.loadFundTransactions();
            } else {
              this.fundTransactions.set([]);
            }
          }
          break;
        case 'cashflow':
          this.loadCashFlow();
          break;
        case 'pnl':
          await this.loadPnl();
          break;
        case 'reconciliation':
          this.reconciliation.set(await this.service.getReconciliationReport(this.startDate, this.endDate));
          break;
      }
    } catch (err) { console.error('Error loading tab:', tab, err); }
  }

  private syncSelectedBankAccount(accounts: BankAccount[]) {
    const currentId = this.selectedBankAccount()?._id;
    if (!currentId) return;
    this.selectedBankAccount.set(accounts.find((account) => account._id === currentId) || null);
  }

  private syncSelectedFund(funds: Fund[]) {
    const currentId = this.selectedFund()?._id;
    if (!currentId) {
      this.selectedFund.set(null);
      return;
    }
    this.selectedFund.set(funds.find((fund) => fund._id === currentId) || null);
  }

  async loadBankTransactions() {
    const params: Record<string, string> = {};
    if (this.selectedBankAccount()) params['bankAccountId'] = this.selectedBankAccount()!._id;
    if (this.bankTxType) params['type'] = this.bankTxType;
    if (this.bankTxKeyword) params['keyword'] = this.bankTxKeyword;
    if (this.startDate) params['startDate'] = this.startDate;
    if (this.endDate) params['endDate'] = this.endDate;
    this.bankTransactions.set(await this.service.getBankTransactions(params));
  }

  async loadCashFlow() {
    const params: Record<string, string> = { groupBy: this.cashFlowGroupBy };
    if (this.startDate) params['startDate'] = this.startDate;
    if (this.endDate) params['endDate'] = this.endDate;
    this.cashFlow.set(await this.service.getCashFlow(params));
  }

  async loadPnl() {
    this.pnl.set(await this.service.getProfitAndLoss(this.startDate, this.endDate, this.pnlBasis));
  }

  async loadProvisionalGrossProfit() {
    const month = (this.provisionalMonth || '').trim();
    this.provisionalGrossProfit.set(await this.service.getProvisionalGrossProfit(month || undefined));
  }

  selectBankAccount(ba: BankAccount) {
    this.selectedBankAccount.set(ba);
    this.loadBankTransactions();
  }

  selectFund(f: Fund) {
    this.selectedFund.set(f);
    this.loadFundTransactions();
  }

  async loadFundTransactions() {
    if (!this.selectedFund()) return;
    const params: Record<string, string> = { fundId: this.selectedFund()!._id };
    if (this.startDate) params['startDate'] = this.startDate;
    if (this.endDate) params['endDate'] = this.endDate;
    this.fundTransactions.set(await this.service.getFundTransactions(params));
  }

  private resetBankAccountForm(): void {
    this.bankAccountForm = {
      bankName: '',
      accountNumber: '',
      accountHolder: '',
      branch: '',
      openingBalance: 0,
      description: '',
      isPrimary: false,
    };
  }

  private fillBankAccountForm(account: BankAccount): void {
    this.bankAccountForm = {
      bankName: account.bankName || '',
      accountNumber: account.accountNumber || '',
      accountHolder: account.accountHolder || '',
      branch: account.branch || '',
      openingBalance: account.openingBalance || 0,
      description: account.description || '',
      isPrimary: Boolean(account.isPrimary),
    };
  }

  private resetFundForm(): void {
    this.fundForm = {
      name: '',
      fundType: 'RESERVE',
      currentBalance: 0,
      minimumBalance: 0,
      targetBalance: 0,
      description: '',
    };
  }

  private fillFundForm(fund: Fund): void {
    this.fundForm = {
      name: fund.name || '',
      fundType: fund.fundType || 'RESERVE',
      currentBalance: fund.currentBalance || 0,
      minimumBalance: fund.minimumBalance || 0,
      targetBalance: fund.targetBalance || 0,
      description: fund.description || '',
    };
  }

  private async refreshBankAccounts(preferredId?: string | null): Promise<void> {
    const accounts = await this.service.getBankAccounts();
    this.bankAccounts.set(accounts);

    const preservedId = preferredId || this.selectedBankAccount()?._id || null;
    if (!preservedId) {
      this.selectedBankAccount.set(null);
      return;
    }

    this.selectedBankAccount.set(accounts.find((account) => account._id === preservedId) || null);
  }

  private async refreshFunds(preferredId?: string | null): Promise<void> {
    const funds = await this.service.getFunds();
    this.funds.set(funds);

    const preservedId = preferredId || this.selectedFund()?._id || null;
    if (!preservedId) {
      this.selectedFund.set(null);
      return;
    }

    this.selectedFund.set(funds.find((fund) => fund._id === preservedId) || null);
  }

  closeBankAccountModal() {
    if (this.submittingBankAccount()) return;
    this.showBankAccountModal.set(false);
    this.editingBankAccount.set(null);
    this.modalError.set('');
    this.resetBankAccountForm();
  }

  closeFundModal() {
    if (this.submittingFund()) return;
    this.showFundModal.set(false);
    this.editingFund.set(null);
    this.modalError.set('');
    this.resetFundForm();
  }

  // ——— Bank Account Modal ————————————————————————————
  openBankAccountModal() {
    if (!this.isDirector()) return;
    this.editingBankAccount.set(null);
    this.resetBankAccountForm();
    this.modalError.set('');
    this.showBankAccountModal.set(true);
  }

  openEditBankAccountModal(account: BankAccount, event?: Event) {
    event?.stopPropagation();
    if (!this.isDirector()) return;
    this.editingBankAccount.set(account);
    this.fillBankAccountForm(account);
    this.modalError.set('');
    this.showBankAccountModal.set(true);
  }

  async submitBankAccount() {
    if (!this.isDirector() || this.submittingBankAccount()) return;
    this.submittingBankAccount.set(true);
    this.modalError.set('');

    const editingAccount = this.editingBankAccount();
    const res = editingAccount
      ? await this.service.updateBankAccount(editingAccount._id, {
          bankName: this.bankAccountForm.bankName,
          accountNumber: this.bankAccountForm.accountNumber,
          accountHolder: this.bankAccountForm.accountHolder,
          branch: this.bankAccountForm.branch,
          description: this.bankAccountForm.description,
          isPrimary: this.bankAccountForm.isPrimary,
        })
      : await this.service.createBankAccount(this.bankAccountForm);

    this.submittingBankAccount.set(false);
    if (!res.ok) {
      this.modalError.set(res.message || 'Lỗi');
      return;
    }

    const preferredId = editingAccount?._id || null;
    this.closeBankAccountModal();
    await this.refreshBankAccounts(preferredId);
  }

  // ——— Bank Transaction Modal ————————————————————————
  openBankTxModal() {
    if (this.isShareholder()) return;
    this.bankTxForm = {
      bankAccountId: this.selectedBankAccount()?._id || (this.bankAccounts().length ? this.bankAccounts()[0]._id : ''),
      type: 'DEPOSIT', category: 'OTHER', amount: 0, transactionDate: new Date().toISOString().split('T')[0], description: '', reference: '',
    };
    this.modalError.set('');
    this.showBankTxModal.set(true);
  }

  async submitBankTx() {
    if (this.isShareholder()) return;
    const res = await this.service.recordBankTransaction(this.bankTxForm);
    if (!res.ok) { this.modalError.set(res.message || 'Lỗi'); return; }
    this.showBankTxModal.set(false);
    this.bankAccounts.set(await this.service.getBankAccounts());
    this.loadBankTransactions();
  }

  async reconcile(txId: string) {
    if (this.isShareholder()) return;
    if (!confirm('Xác nhận đối soát giao dịch này?')) return;
    const res = await this.service.reconcileTransaction(txId);
    if (!res.ok) { alert(res.message); return; }
    this.loadBankTransactions();
  }

  // ——— Fund Modal ————————————————————————————————————
  openFundModal() {
    if (!this.isDirector()) return;
    this.editingFund.set(null);
    this.resetFundForm();
    this.modalError.set('');
    this.showFundModal.set(true);
  }

  openEditFundModal(fund: Fund, event?: Event) {
    event?.stopPropagation();
    if (!this.isDirector()) return;
    this.editingFund.set(fund);
    this.fillFundForm(fund);
    this.modalError.set('');
    this.showFundModal.set(true);
  }

  async submitFund() {
    if (!this.isDirector() || this.submittingFund()) return;
    this.submittingFund.set(true);
    this.modalError.set('');

    const editingFund = this.editingFund();
    const res = editingFund
      ? await this.service.updateFund(editingFund._id, {
          name: this.fundForm.name,
          minimumBalance: this.fundForm.minimumBalance,
          targetBalance: this.fundForm.targetBalance,
          description: this.fundForm.description,
        })
      : await this.service.createFund(this.fundForm);

    this.submittingFund.set(false);
    if (!res.ok) {
      this.modalError.set(res.message || 'Lỗi');
      return;
    }

    const preferredId = editingFund?._id || null;
    this.closeFundModal();
    await this.refreshFunds(preferredId);
  }

  // ——— Fund Transaction Modal ————————————————————————
  openFundTxModal() {
    if (this.isShareholder()) return;
    this.fundTxForm = {
      type: 'DEPOSIT', amount: 0, transactionDate: new Date().toISOString().split('T')[0], description: '', reference: '',
    };
    this.modalError.set('');
    this.showFundTxModal.set(true);
  }

  async submitFundTx() {
    if (this.isShareholder()) return;
    const fund = this.selectedFund();
    if (!fund) return;
    const data = { ...this.fundTxForm, fundId: fund._id };
    const res = await this.service.recordFundTransaction(data);
    if (!res.ok) { this.modalError.set(res.message || 'Lỗi'); return; }
    this.showFundTxModal.set(false);
    this.funds.set(await this.service.getFunds());
    this.selectedFund.set(this.funds().find(f => f._id === fund._id) || null);
    this.loadFundTransactions();
  }

  // ——— Alerts helpers ———————————————————————————————

  alertCategoryLabel(cat: string): string {
    return ALERT_CATEGORY_LABELS[cat] || cat;
  }

  private normalizeAppTarget(target: string): string {
    const trimmed = (target || '').trim();
    if (!trimmed) return '/app/dashboard';
    if (trimmed.startsWith('/app/')) return trimmed;
    if (trimmed.startsWith('/')) return `/app${trimmed}`;
    return `/app/${trimmed}`;
  }

  handleAlertAction(action: { label: string; type: string; target?: string; amount?: number }) {
    if (this.isShareholder()) return;
    switch (action.type) {
      case 'NAVIGATE':
        if (!action.target) break;
        const normalizedTarget = this.normalizeAppTarget(action.target);
        if (normalizedTarget.startsWith('/app/financial-control')) {
          const tabMatch = normalizedTarget.match(/[?&]tab=([\w-]+)/);
          if (tabMatch) {
            this.activeTab = tabMatch[1];
            this.loadTab(tabMatch[1]);
          }
        }
        this.router.navigateByUrl(normalizedTarget);
        break;
      case 'FUND_DEPOSIT':
        // Open fund transaction modal for deposit
        this.activeTab = 'funds';
        this.loadTab('funds').then(() => {
          const targetFund = this.funds().find(f =>
            f.fundType === action.target || f.fundCode === action.target
          );
          if (targetFund) {
            this.selectFund(targetFund);
            setTimeout(() => {
              this.fundTxForm = {
                type: 'DEPOSIT',
                amount: action.amount || 0,
                transactionDate: new Date().toISOString().split('T')[0],
                description: `Nạp quỹ theo đề xuất cảnh báo: ${action.label}`,
                reference: '',
              };
              this.modalError.set('');
              this.showFundTxModal.set(true);
            }, 300);
          }
        });
        break;
      case 'FUND_WITHDRAW':
        this.activeTab = 'funds';
        this.loadTab('funds').then(() => {
          const targetFund = this.funds().find(f =>
            f.fundType === action.target || f.fundCode === action.target
          );
          if (targetFund) {
            this.selectFund(targetFund);
            setTimeout(() => {
              this.fundTxForm = {
                type: 'WITHDRAW',
                amount: action.amount || 0,
                transactionDate: new Date().toISOString().split('T')[0],
                description: `Rút quỹ theo đề xuất: ${action.label}`,
                reference: '',
              };
              this.modalError.set('');
              this.showFundTxModal.set(true);
            }, 300);
          }
        });
        break;
      case 'INFO':
        alert(action.label);
        break;
    }
  }
}
