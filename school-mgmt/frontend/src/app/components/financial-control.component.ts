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

const FUND_TYPE_LABELS: Record<string, string> = {
  RESERVE: 'Quỹ dự phòng',
  PETTY_CASH: 'Quỹ tiền mặt',
  MARKETING: 'Quỹ marketing',
  TRAINING: 'Quỹ đào tạo',
  BONUS: 'Quỹ thưởng',
  OTHER: 'Quỹ khác',
};

const TX_TYPE_LABELS: Record<string, string> = {
  DEPOSIT: 'Nạp vào',
  WITHDRAWAL: 'Rút ra',
  TRANSFER_IN: 'Chuyển đến',
  TRANSFER_OUT: 'Chuyển đi',
  INTEREST: 'Lãi suất',
  FEE: 'Phí dịch vụ',
  ADJUSTMENT: 'Điều chỉnh',
  WITHDRAW: 'Rút từ quỹ',
};

const CATEGORY_LABELS: Record<string, string> = {
  TUITION_INCOME: 'Thu học phí',
  PAYROLL: 'Chi lương',
  EXPENSE: 'Chi phí VH',
  RESERVE_FUND: 'Quỹ dự phòng',
  PETTY_CASH: 'Tiền mặt',
  COMMISSION: 'Hoa hồng',
  REFUND: 'Hoàn tiền',
  LOAN_DISBURSEMENT: 'Giải ngân vốn vay',
  LOAN_REPAYMENT: 'Trả nợ vay',
  OTHER: 'Khác',
};

const EXPENSE_CAT_LABELS: Record<string, string> = {
  RENT: 'Thuê mặt bằng',
  UTILITIES: 'Điện nước Internet',
  SUPPLIES: 'Văn phòng phẩm',
  MARKETING: 'Marketing',
  MAINTENANCE: 'Sửa chữa',
  SALARY_BONUS: 'Thưởng/Phụ cấp',
  TRAINING: 'Đào tạo',
  TRANSPORT: 'Đi lại',
  MEAL: 'Ăn uống',
  ENTERTAINMENT: 'Tiếp khách',
  OTHER: 'Khác',
};

@Component({
  selector: 'app-financial-control',
  standalone: true,
  imports: [CommonModule, FormsModule, FlowGuideComponent],
  template: `
  <header class="page-header">
    <div>
      <h2>🏦 Kiểm soát Tài chính</h2>
      <p>Quản lý số dư ngân hàng, quỹ, dòng tiền và bảng cân đối.</p>
    </div>
    <div class="header-filters">
      <input type="date" [(ngModel)]="startDate" placeholder="Từ ngày" />
      <input type="date" [(ngModel)]="endDate" placeholder="Đến ngày" />
      <button class="primary" (click)="reload()">Cập nhật</button>
    </div>
  </header>

  <app-flow-guide featureKey="financial-control"></app-flow-guide>

  <!-- Tab bar -->
  <div class="tab-bar">
    <button *ngFor="let t of tabs" [class.active]="activeTab === t.key" (click)="activeTab = t.key; loadTab(t.key)">
      {{t.icon}} {{t.label}}
    </button>
  </div>

  <!-- â•â•â• TAB: Overview (Dashboard) â•â•â• -->
  <div *ngIf="activeTab === 'overview'" class="tab-content">
    <ng-container *ngIf="dashboard()">

      <!-- Section 1: Cash Position -->
      <div class="dash-section">
        <h4>TÌNH HÌNH TIỀN MẶT</h4>
        <div class="overview-grid">
          <div class="ov-card bank">
            <div class="ov-icon">🏦</div>
            <div class="ov-value">{{dashboard()!.cashPosition.bankBalance | number}}đ</div>
            <div class="ov-label">Số dư Ngân hàng ({{dashboard()!.cashPosition.bankAccountCount}} TK)</div>
          </div>
          <div class="ov-card fund">
            <div class="ov-icon">📢</div>
            <div class="ov-value">{{dashboard()!.cashPosition.marketingFund | number}}đ</div>
            <div class="ov-label">Quỹ Marketing ({{dashboard()!.cashPosition.marketingFundCount}} quỹ)</div>
          </div>
          <div class="ov-card fund">
            <div class="ov-icon">🏛️</div>
            <div class="ov-value">{{dashboard()!.cashPosition.fundBalance | number}}đ</div>
            <div class="ov-label">Tổng các Quỹ ({{dashboard()!.cashPosition.fundCount}} quỹ)</div>
          </div>
          <div class="ov-card profit">
            <div class="ov-icon">💵</div>
            <div class="ov-value">{{dashboard()!.cashPosition.availableCash | number}}đ</div>
            <div class="ov-label">Tổng tiền khả dụng (NH + Quỹ)</div>
          </div>
        </div>
      </div>

      <!-- Section 2: Obligations & Reserve -->
      <div class="dash-section">
        <h4>NGHĨA VỤ THANH TOÁN & DỰ PHÒNG</h4>
        <div class="overview-grid">
          <div class="ov-card outflow">
            <div class="ov-icon">📋</div>
            <div class="ov-value">{{dashboard()!.obligations.totalPayable14Days | number}}đ</div>
            <div class="ov-label">Phải trả trong 14 ngày tới</div>
            <div class="ov-detail" *ngIf="dashboard()!.obligations.totalPayable14Days > 0">
              <small>Lương: {{dashboard()!.obligations.payrollPayable | number}}đ ({{dashboard()!.obligations.payrollPayableCount}})</small><br/>
              <small>Chi phí: {{dashboard()!.obligations.expensePayable | number}}đ ({{dashboard()!.obligations.expensePayableCount}})</small><br/>
              <small>Đơn hàng: {{dashboard()!.obligations.orderPayable | number}}đ ({{dashboard()!.obligations.orderPayableCount}})</small>
            </div>
          </div>
          <div class="ov-card" [class.loss]="!dashboard()!.obligations.reserveHealthy" [class.profit]="dashboard()!.obligations.reserveHealthy">
            <div class="ov-icon">🛡️</div>
            <div class="ov-value">{{dashboard()!.obligations.operatingReserve3Months | number}}đ</div>
            <div class="ov-label">Dự phòng hoạt động 3 tháng cần</div>
            <div class="ov-warning" *ngIf="!dashboard()!.obligations.reserveHealthy">
              ⚠️ Tiền khả dụng chưa đủ dự phòng 3 tháng!
            </div>
          </div>
          <div class="ov-card" [class.loss]="dashboard()!.obligations.runway < 3" [class.profit]="dashboard()!.obligations.runway >= 3">
            <div class="ov-icon">⏱️</div>
            <div class="ov-value">{{dashboard()!.obligations.runway}} tháng</div>
            <div class="ov-label">Runway (hoạt động được bao lâu)</div>
          </div>
          <div class="ov-card" [class.profit]="dashboard()!.obligations.cashAfterObligations >= 0" [class.loss]="dashboard()!.obligations.cashAfterObligations < 0">
            <div class="ov-icon">💰</div>
            <div class="ov-value">{{dashboard()!.obligations.cashAfterObligations | number}}đ</div>
            <div class="ov-label">Tiền còn sau nghĩa vụ 14 ngày</div>
          </div>
        </div>
      </div>

      <!-- Section 3: Deferred Revenue -->
      <div class="dash-section">
        <h4>DOANH THU CHỜ XỬ LÝ & NỢ PHỤ HUYNH</h4>
        <div class="overview-grid">
          <div class="ov-card inflow">
            <div class="ov-icon">👛</div>
            <div class="ov-value">{{dashboard()!.deferredRevenue.walletBalance | number}}đ</div>
            <div class="ov-label">Ví Phụ huynh (sử dụng được, chưa là DT)</div>
            <div class="ov-detail"><small>{{dashboard()!.deferredRevenue.walletCount}} ví</small></div>
          </div>
          <div class="ov-card inflow">
            <div class="ov-icon">📄</div>
            <div class="ov-value">{{dashboard()!.deferredRevenue.pendingInvoiceAmount | number}}đ</div>
            <div class="ov-label">Hóa đơn chờ duyệt (tiền sắp vào)</div>
            <div class="ov-detail"><small>{{dashboard()!.deferredRevenue.pendingInvoiceCount}} hóa đơn</small></div>
          </div>
        </div>
      </div>

      <!-- Section 4: Debt Position (Loans) -->
      <div class="dash-section" *ngIf="dashboard()!.debtPosition">
        <h4>TÌNH HÌNH NỢ VAY</h4>
        <div class="overview-grid">
          <div class="ov-card loss">
            <div class="ov-icon">&#128178;</div>
            <div class="ov-value">{{dashboard()!.debtPosition!.totalDebt | number}}đ</div>
            <div class="ov-label">Tổng dư nợ vay ({{dashboard()!.debtPosition!.activeLoanCount}} khoản)</div>
          </div>
          <div class="ov-card outflow">
            <div class="ov-icon">&#128197;</div>
            <div class="ov-value">{{dashboard()!.debtPosition!.loanPayable | number}}đ</div>
            <div class="ov-label">Phải trả nợ vay 30 ngày tới ({{dashboard()!.debtPosition!.loanPayableCount}} kỳ)</div>
          </div>
        </div>
      </div>

      <!-- Section 5: Accounting Metrics -->
      <div class="dash-section">
        <h4>CHỈ SỐ KẾ TOÁN</h4>
        <div class="metrics-grid">
          <div class="metric-card">
            <div class="metric-label">Burn Rate / tháng</div>
            <div class="metric-value">{{dashboard()!.metrics.burnRate | number}}đ</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">Runway</div>
            <div class="metric-value" [class.amount-red]="dashboard()!.metrics.runway < 3" [class.amount-green]="dashboard()!.metrics.runway >= 6">
              {{dashboard()!.metrics.runway}} tháng
            </div>
          </div>
          <div class="metric-card">
            <div class="metric-label">Current Ratio</div>
            <div class="metric-value" [class.amount-red]="dashboard()!.metrics.currentRatio < 1" [class.amount-green]="dashboard()!.metrics.currentRatio >= 1.5">
              {{dashboard()!.metrics.currentRatio}}
            </div>
            <div class="metric-hint">&#8805; 1.5 = tốt</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">Biên lợi nhuận gộp</div>
            <div class="metric-value" [class.amount-green]="dashboard()!.metrics.grossMargin > 0" [class.amount-red]="dashboard()!.metrics.grossMargin <= 0">
              {{dashboard()!.metrics.grossMargin}}%
            </div>
          </div>
          <div class="metric-card">
            <div class="metric-label">Biên lợi nhuận ròng</div>
            <div class="metric-value" [class.amount-green]="dashboard()!.metrics.netMargin > 0" [class.amount-red]="dashboard()!.metrics.netMargin <= 0">
              {{dashboard()!.metrics.netMargin}}%
            </div>
          </div>
          <div class="metric-card">
            <div class="metric-label">Tăng trưởng DT tháng</div>
            <div class="metric-value" [class.amount-green]="dashboard()!.metrics.revenueGrowth > 0" [class.amount-red]="dashboard()!.metrics.revenueGrowth < 0">
              {{dashboard()!.metrics.revenueGrowth > 0 ? '+' : ''}}{{dashboard()!.metrics.revenueGrowth}}%
            </div>
            <div class="metric-hint">{{dashboard()!.metrics.lastMonthRevenue | number}}đ → {{dashboard()!.metrics.thisMonthRevenue | number}}đ</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">Phải thu (AR)</div>
            <div class="metric-value">{{dashboard()!.metrics.accountsReceivable | number}}đ</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">Phải trả (AP)</div>
            <div class="metric-value">{{dashboard()!.metrics.accountsPayable | number}}đ</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">Doanh thu trả trước (Nợ PH)</div>
            <div class="metric-value">{{dashboard()!.metrics.deferredRevenue | number}}đ</div>
          </div>
        </div>
      </div>

      <!-- Fund Warnings -->
      <div class="warning-section" *ngIf="dashboard()!.fundWarnings.length">
        <h4>⚠️ Cảnh báo Quỹ dưới mức tối thiểu</h4>
        <div class="warning-list">
          <div class="warning-item" *ngFor="let w of dashboard()!.fundWarnings">
            <strong>{{w.name}}</strong> ({{w.fundCode}}):
            Hiện có <span class="amount-red">{{w.currentBalance | number}}đ</span>,
            Tối thiểu <span class="amount-blue">{{w.minimumBalance | number}}đ</span>,
            Thiếu <span class="amount-red">{{w.deficit | number}}đ</span>
          </div>
        </div>
      </div>

    </ng-container>
    <p class="empty-text" *ngIf="!dashboard()">Đang tải dữ liệu dashboard...</p>
  </div>

  <!-- ═══ TAB: Lợi nhuận gộp tạm tính ═══ -->
  <div *ngIf="activeTab === 'provisional-gross-profit'" class="tab-content">
    <div class="section-header">
      <h3>Lợi nhuận gộp tạm tính</h3>
      <div class="filters inline provisional-filter">
        <span>Tháng</span>
        <input type="month" [(ngModel)]="provisionalMonth" />
        <button class="primary" (click)="loadProvisionalGrossProfit()">Xem</button>
      </div>
    </div>

    <ng-container *ngIf="provisionalGrossProfit() as provisional; else provisionalLoading">
      <div class="overview-grid">
        <div class="ov-card inflow">
          <div class="ov-icon">IN</div>
          <div class="ov-value">{{provisional.cashInflow.approvedInvoiceAmount | number}}đ</div>
          <div class="ov-label">Dòng tiền vào trong tháng (hóa đơn đã duyệt)</div>
          <div class="ov-detail"><small>{{provisional.cashInflow.approvedInvoiceCount}} hóa đơn</small></div>
        </div>
        <div class="ov-card inflow">
          <div class="ov-icon">REV</div>
          <div class="ov-value">{{provisional.provisional.revenueAmount | number}}đ</div>
          <div class="ov-label">Doanh thu tạm tính (trừ ví theo điểm danh)</div>
          <div class="ov-detail"><small>{{provisional.provisional.attendanceCount}} buổi điểm danh</small></div>
        </div>
        <div class="ov-card outflow">
          <div class="ov-icon">PAY</div>
          <div class="ov-value">{{provisional.provisional.teacherPayoutAmount | number}}đ</div>
          <div class="ov-label">Lương phải trả giáo viên tạm tính</div>
          <div class="ov-detail"><small>Dựa trên các buổi đã điểm danh</small></div>
        </div>
        <div class="ov-card" [class.profit]="provisional.grossProfitAmount >= 0" [class.loss]="provisional.grossProfitAmount < 0">
          <div class="ov-icon">GP</div>
          <div class="ov-value">{{provisional.grossProfitAmount | number}}đ</div>
          <div class="ov-label">Lợi nhuận gộp tạm tính</div>
          <div class="ov-detail"><small>= Doanh thu tạm tính - Lương giáo viên tạm tính</small></div>
        </div>
      </div>
    </ng-container>
    <ng-template #provisionalLoading>
      <p class="empty-text">Đang tải dữ liệu lợi nhuận gộp tạm tính...</p>
    </ng-template>
  </div>

  <!-- â•â•â• TAB: Bank Accounts â•â•â• -->
  <div *ngIf="activeTab === 'bank'" class="tab-content">
    <div class="section-header">
      <h3>Tài khoản Ngân hàng</h3>
      <button class="primary" (click)="openBankAccountModal()" *ngIf="isDirector()">+ Thêm TK ngân hàng</button>
    </div>

    <div class="card-grid" *ngIf="bankAccounts().length">
      <div class="bank-card" *ngFor="let ba of bankAccounts()" [class.primary-account]="ba.isPrimary" (click)="selectBankAccount(ba)">
        <div class="bank-name">{{ba.bankName}} {{ba.isPrimary ? '⭐' : ''}}</div>
        <div class="account-num">{{ba.accountNumber}}</div>
        <div class="bank-balance">{{ba.currentBalance | number}}đ</div>
        <div class="bank-holder" *ngIf="ba.accountHolder">{{ba.accountHolder}}</div>
        <span class="badge" [class.active]="ba.status === 'ACTIVE'" [class.inactive]="ba.status !== 'ACTIVE'">{{ba.status}}</span>
      </div>
    </div>
    <p class="empty-text" *ngIf="!bankAccounts().length">Chưa có tài khoản ngân hàng nào.</p>

    <!-- Bank Transactions -->
    <div class="section-header mt">
      <h3>Giao dịch ngân hàng {{selectedBankAccount() ? '— ' + selectedBankAccount()!.bankName : ''}}</h3>
      <button class="primary" (click)="openBankTxModal()">+ Ghi nhận giao dịch</button>
    </div>
    <div class="filters">
      <select [(ngModel)]="bankTxType" (ngModelChange)="loadBankTransactions()">
        <option value="">Tất cả loại</option>
        <option value="DEPOSIT">Nạp vào</option>
        <option value="WITHDRAWAL">Rút ra</option>
        <option value="TRANSFER_IN">Chuyển đến</option>
        <option value="TRANSFER_OUT">Chuyển đi</option>
        <option value="INTEREST">Lãi suất</option>
        <option value="FEE">Phí dịch vụ</option>
        <option value="ADJUSTMENT">Điều chỉnh</option>
      </select>
      <input placeholder="Tìm kiếm..." [(ngModel)]="bankTxKeyword" (ngModelChange)="loadBankTransactions()" />
    </div>

    <table class="data" *ngIf="bankTransactions().length">
      <thead><tr>
        <th>Mã</th><th>Ngày</th><th>Loại</th><th>Danh mục</th><th>Số tiền</th>
        <th>Trước</th><th>Sau</th><th>Mô tả</th><th>Người ghi</th><th>Đối soát</th>
      </tr></thead>
      <tbody>
        <tr *ngFor="let tx of bankTransactions()">
          <td><code>{{tx.transactionCode}}</code></td>
          <td>{{tx.transactionDate | date:'dd/MM/yyyy'}}</td>
          <td>{{txTypeLabel(tx.type)}}</td>
          <td>{{categoryLabel(tx.category)}}</td>
          <td class="right" [class.amount-green]="isInflow(tx.type)" [class.amount-red]="!isInflow(tx.type)">
            {{isInflow(tx.type) ? '+' : '-'}}{{tx.amount | number}}đ
          </td>
          <td class="right">{{tx.balanceBefore | number}}đ</td>
          <td class="right">{{tx.balanceAfter | number}}đ</td>
          <td>{{tx.description || '-'}}</td>
          <td>{{tx.recordedByName}}</td>
          <td>
            <span *ngIf="tx.isReconciled" class="badge reconciled">✓</span>
            <button *ngIf="!tx.isReconciled" class="btn-sm" (click)="reconcile(tx._id)">Đối soát</button>
          </td>
        </tr>
      </tbody>
    </table>
    <p class="empty-text" *ngIf="!bankTransactions().length">Chưa có giao dịch nào.</p>
  </div>

  <!-- â•â•â• TAB: Funds â•â•â• -->
  <div *ngIf="activeTab === 'funds'" class="tab-content">
    <div class="section-header">
      <h3>Quản lý Quỹ</h3>
      <button class="primary" (click)="openFundModal()" *ngIf="isDirector()">+ Tạo quỹ mới</button>
    </div>

    <div class="card-grid" *ngIf="funds().length">
      <div class="fund-card" *ngFor="let f of funds()" [class.warning]="f.currentBalance < f.minimumBalance" (click)="selectFund(f)">
        <div class="fund-type">{{fundTypeLabel(f.fundType)}}</div>
        <div class="fund-name">{{f.name}} <code>{{f.fundCode}}</code></div>
        <div class="fund-balance">{{f.currentBalance | number}}đ</div>
        <div class="fund-meta">
          <span>Tối thiểu: {{f.minimumBalance | number}}đ</span>
          <span>Đích: {{f.targetBalance | number}}đ</span>
        </div>
        <div class="fund-progress" *ngIf="f.targetBalance > 0">
          <div class="progress-bar">
            <div class="progress-fill" [style.width.%]="Math.min((f.currentBalance / f.targetBalance) * 100, 100)"></div>
          </div>
          <small>{{Math.round((f.currentBalance / f.targetBalance) * 100)}}%</small>
        </div>
        <div class="fund-warning" *ngIf="f.currentBalance < f.minimumBalance">
          ⚠️ Dưới mức tối thiểu (thiếu {{(f.minimumBalance - f.currentBalance) | number}}đ)
        </div>
        <span class="badge" [class.active]="f.status === 'ACTIVE'">{{f.status}}</span>
      </div>
    </div>
    <p class="empty-text" *ngIf="!funds().length">Chưa có quỹ nào.</p>

    <!-- Fund Transactions -->
    <div class="section-header mt" *ngIf="selectedFund()">
      <h3>Giao dịch quỹ — {{selectedFund()!.name}}</h3>
      <button class="primary" (click)="openFundTxModal()">+ Nạp/Rút quỹ</button>
    </div>

    <table class="data" *ngIf="fundTransactions().length">
      <thead><tr>
        <th>Mã</th><th>Ngày</th><th>Loại</th><th>Số tiền</th>
        <th>Trước</th><th>Sau</th><th>Mô tả</th><th>Người thực hiện</th>
      </tr></thead>
      <tbody>
        <tr *ngFor="let ft of fundTransactions()">
          <td><code>{{ft.transactionCode}}</code></td>
          <td>{{ft.transactionDate | date:'dd/MM/yyyy'}}</td>
          <td>{{txTypeLabel(ft.type)}}</td>
          <td class="right" [class.amount-green]="ft.type === 'DEPOSIT'" [class.amount-red]="ft.type === 'WITHDRAW'">
            {{ft.type === 'DEPOSIT' ? '+' : '-'}}{{ft.amount | number}}đ
          </td>
          <td class="right">{{ft.balanceBefore | number}}đ</td>
          <td class="right">{{ft.balanceAfter | number}}đ</td>
          <td>{{ft.description || '-'}}</td>
          <td>{{ft.performedByName}}</td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- â•â•â• TAB: Cash Flow â•â•â• -->
  <div *ngIf="activeTab === 'cashflow'" class="tab-content">
    <div class="section-header">
      <h3>Dòng tiền</h3>
      <div class="filters inline">
        <select [(ngModel)]="cashFlowGroupBy" (ngModelChange)="loadCashFlow()">
          <option value="day">Theo ngày</option>
          <option value="month">Theo tháng</option>
        </select>
      </div>
    </div>

    <div class="cashflow-summary" *ngIf="cashFlow()">
      <div class="cf-card inflow">
        <div>Tổng dòng tiền vào</div>
        <div class="cf-value amount-green">{{cashFlow()!.totalInflow | number}}đ</div>
      </div>
      <div class="cf-card outflow">
        <div>Tổng dòng tiền ra</div>
        <div class="cf-value amount-red">{{cashFlow()!.totalOutflow | number}}đ</div>
      </div>
      <div class="cf-card net" [class.positive]="cashFlow()!.netCashFlow >= 0" [class.negative]="cashFlow()!.netCashFlow < 0">
        <div>Dòng tiền ròng</div>
        <div class="cf-value">{{cashFlow()!.netCashFlow | number}}đ</div>
      </div>
    </div>
    <p class="empty-text" *ngIf="cashFlow()?.basis">
      Basis: {{cashFlow()!.basis!.applied | uppercase}}.
      Session revenue và teacher cost chỉ là tham chiếu accrual, không cộng vào tổng cashflow.
    </p>
    <p class="empty-text" *ngIf="cashFlow()?.accrualReference">
      Tham chiếu accrual: Doanh thu buổi học {{cashFlow()!.accrualReference!.sessionRevenue | number}}đ,
      Chi phí giáo viên {{cashFlow()!.accrualReference!.teacherCost | number}}đ.
    </p>

    <table class="data" *ngIf="cashFlow()?.timeline?.length">
      <thead><tr>
        <th>Kỳ</th><th>Hóa đơn (vào)</th><th>Doanh thu buổi học</th><th>Nạp ví (vào)</th><th>Vốn vay (vào)</th>
        <th>Lương GV (ra)</th><th>Chi phí VH (ra)</th><th>QC (ra)</th><th>Trả nợ vay (ra)</th>
        <th>Tổng vào</th><th>Tổng ra</th><th>Ròng</th>
      </tr></thead>
      <tbody>
        <tr *ngFor="let t of cashFlow()!.timeline">
          <td><strong>{{t.date}}</strong></td>
          <td class="right amount-green">{{t.inflow.invoices | number}}đ <small>({{t.inflow.invoiceCount}})</small></td>
          <td class="right">{{t.inflow.sessionRevenue | number}}đ <small>({{t.inflow.sessionCount}})</small></td>
          <td class="right amount-green">{{t.inflow.walletTopUps | number}}đ <small>({{t.inflow.walletTopUpCount}})</small></td>
          <td class="right amount-green">{{t.inflow.loanDisbursements | number}}đ <small>({{t.inflow.loanDisbursementCount}})</small></td>
          <td class="right amount-red">{{t.outflow.payroll | number}}đ <small>({{t.outflow.payrollCount}})</small></td>
          <td class="right amount-red">{{t.outflow.expenses | number}}đ <small>({{t.outflow.expenseCount}})</small></td>
          <td class="right amount-red">{{t.outflow.adCost | number}}đ <small>({{t.outflow.adCostCount}})</small></td>
          <td class="right amount-red">{{t.outflow.loanRepayments | number}}đ <small>({{t.outflow.loanRepaymentCount}})</small></td>
          <td class="right amount-green"><strong>{{t.totalInflow | number}}đ</strong></td>
          <td class="right amount-red"><strong>{{t.totalOutflow | number}}đ</strong></td>
          <td class="right" [class.amount-green]="t.netCashFlow >= 0" [class.amount-red]="t.netCashFlow < 0">
            <strong>{{t.netCashFlow | number}}đ</strong>
          </td>
        </tr>
      </tbody>
    </table>
    <p class="empty-text" *ngIf="!cashFlow()?.timeline?.length">Không có dữ liệu dòng tiền.</p>
  </div>

  <!-- â•â•â• TAB: P&L Report â•â•â• -->
  <div *ngIf="activeTab === 'pnl'" class="tab-content">
    <div class="section-header">
      <h3>P&L Report</h3>
      <div class="filters inline">
        <select [(ngModel)]="pnlBasis" (ngModelChange)="loadPnl()">
          <option value="cash">Cash basis</option>
          <option value="accrual">Accrual basis</option>
        </select>
      </div>
    </div>

    <div class="pnl-report" *ngIf="pnl()">
      <div class="pnl-section revenue">
        <h4>📈 DOANH THU</h4>
        <div class="pnl-row">
          <span>Doanh thu từ buổi học (tham chiếu accrual, {{pnl()!.revenue.sessionCount}} buổi):</span>
          <span class="amount-green">{{pnl()!.revenue.sessionRevenue | number}}đ</span>
        </div>
        <div class="pnl-row" *ngFor="let entry of invoiceTypeEntries()">
          <span>Hóa đơn {{entry.key}} ({{entry.value.count}}):</span>
          <span class="amount-green">{{entry.value.amount | number}}đ</span>
        </div>
        <div class="pnl-row total">
          <span>TỔNG DOANH THU ({{(pnl()!.basis?.selected || pnlBasis) | uppercase}}):</span>
          <span class="amount-green"><strong>{{pnl()!.revenue.total | number}}đ</strong></span>
        </div>
      </div>

      <div class="pnl-section costs">
        <h4>📉 CHI PHÍ</h4>
        <div class="pnl-row">
          <span>Chi phí giáo viên (tham chiếu accrual):</span>
          <span class="amount-red">{{pnl()!.costs.teacherCost | number}}đ</span>
        </div>
        <div class="pnl-row">
          <span>Payroll đã chi (GV + Staff):</span>
          <span class="amount-red">{{pnl()!.costs.payrollCost | number}}đ</span>
        </div>
        <div class="pnl-row" *ngFor="let entry of expenseCatEntries()">
          <span>{{expenseCatLabel(entry.key)}} ({{entry.value.count}}):</span>
          <span class="amount-red">{{entry.value.amount | number}}đ</span>
        </div>
        <div class="pnl-row" *ngFor="let entry of adCostPlatformEntries()">
          <span>Quảng cáo {{entry.key}} ({{entry.value.count}}):</span>
          <span class="amount-red">{{entry.value.amount | number}}đ</span>
        </div>
        <div class="pnl-row" *ngIf="pnl()!.costs.interestExpense">
          <span>Chi phí lãi vay:</span>
          <span class="amount-red">{{pnl()!.costs.interestExpense | number}}đ</span>
        </div>
        <div class="pnl-row total">
          <span>TỔNG CHI PHÍ ({{(pnl()!.basis?.selected || pnlBasis) | uppercase}}):</span>
          <span class="amount-red"><strong>{{pnl()!.costs.totalCosts | number}}đ</strong></span>
        </div>
      </div>

      <div class="pnl-section summary">
        <div class="pnl-row">
          <span>Lợi nhuận gộp:</span>
          <span [class.amount-green]="pnl()!.summary.grossProfit >= 0"
                [class.amount-red]="pnl()!.summary.grossProfit < 0">
            {{pnl()!.summary.grossProfit | number}}đ ({{pnl()!.summary.grossMargin}}%)
          </span>
        </div>
        <div class="pnl-row highlight">
          <span><strong>LỢI NHUẬN RÒNG:</strong></span>
          <span [class.amount-green]="pnl()!.summary.netProfit >= 0"
                [class.amount-red]="pnl()!.summary.netProfit < 0">
            <strong>{{pnl()!.summary.netProfit | number}}đ ({{pnl()!.summary.netMargin}}%)</strong>
          </span>
        </div>
      </div>
    </div>
  </div>

  <!-- â•â•â• TAB: Reconciliation â•â•â• -->
  <div *ngIf="activeTab === 'reconciliation'" class="tab-content">
    <h3>Đối soát Tài chính</h3>

    <div class="recon-grid" *ngIf="reconciliation()">
      <div class="recon-card">
        <h4>🏦 Ngân hàng</h4>
        <div class="recon-value">{{reconciliation()!.healthIndicators.bankBalance | number}}đ</div>
        <small>{{reconciliation()!.bankAccounts.accountCount}} tài khoản</small>
      </div>
      <div class="recon-card">
        <h4>🏛️ Các Quỹ</h4>
        <div class="recon-value">{{reconciliation()!.healthIndicators.fundBalance | number}}đ</div>
        <small>{{reconciliation()!.funds.fundCount}} quỹ</small>
      </div>
      <div class="recon-card">
        <h4>👛 Ví Phụ huynh (Nợ)</h4>
        <div class="recon-value amount-red">{{reconciliation()!.healthIndicators.walletLiability | number}}đ</div>
        <small>Tiền trong ví PH</small>
      </div>
      <div class="recon-card" *ngIf="reconciliation()!.healthIndicators.loanDebt">
        <h4>&#128178; Nợ vay</h4>
        <div class="recon-value amount-red">{{reconciliation()!.healthIndicators.loanDebt | number}}đ</div>
        <small>{{reconciliation()!.loanSummary?.activeLoanCount || 0}} khoản vay</small>
      </div>
      <div class="recon-card" [class.positive]="reconciliation()!.healthIndicators.netPosition >= 0"
           [class.negative]="reconciliation()!.healthIndicators.netPosition < 0">
        <h4>📊 Vị thế ròng</h4>
        <div class="recon-value">{{reconciliation()!.healthIndicators.netPosition | number}}đ</div>
        <small>NH + Quỹ - Nợ PH - Nợ vay</small>
      </div>
      <div class="recon-card" [class.warning-card]="reconciliation()!.healthIndicators.unreconciledItems > 0">
        <h4>📋 Chưa đối soát</h4>
        <div class="recon-value">{{reconciliation()!.healthIndicators.unreconciledItems}}</div>
        <small>giao dịch</small>
      </div>
      <div class="recon-card" [class.warning-card]="reconciliation()!.healthIndicators.fundWarnings > 0">
        <h4>⚠️ Cảnh báo Quỹ</h4>
        <div class="recon-value">{{reconciliation()!.healthIndicators.fundWarnings}}</div>
        <small>quỹ dưới ngưỡng</small>
      </div>
    </div>

    <div class="recon-pnl" *ngIf="reconciliation()?.profitAndLoss">
      <h4>Tóm tắt lãi/lỗ trong kỳ</h4>
      <div class="pnl-row">
        <span>Lợi nhuận gộp:</span>
        <span>{{reconciliation()!.profitAndLoss.grossProfit | number}}đ ({{reconciliation()!.profitAndLoss.grossMargin}}%)</span>
      </div>
      <div class="pnl-row bold">
        <span>Lợi nhuận ròng:</span>
        <span [class.amount-green]="reconciliation()!.profitAndLoss.netProfit >= 0"
              [class.amount-red]="reconciliation()!.profitAndLoss.netProfit < 0">
          {{reconciliation()!.profitAndLoss.netProfit | number}}đ ({{reconciliation()!.profitAndLoss.netMargin}}%)
        </span>
      </div>
    </div>
  </div>

  <!-- ═══ TAB: Alerts (Cảnh báo & Chỉ dẫn) ═══ -->
  <div *ngIf="activeTab === 'alerts'" class="tab-content">
    <div class="section-header">
      <h3>Cảnh báo & Chỉ dẫn hành động</h3>
      <button class="primary" (click)="loadTab('alerts')">🔄 Làm mới</button>
    </div>

    <ng-container *ngIf="alertsData()">
      <!-- Alert summary badges -->
      <div class="alert-summary">
        <div class="alert-badge critical" *ngIf="alertsData()!.criticalCount > 0">
          🔴 {{alertsData()!.criticalCount}} Nghiêm trọng
        </div>
        <div class="alert-badge warning" *ngIf="alertsData()!.warningCount > 0">
          🟡 {{alertsData()!.warningCount}} Cảnh báo
        </div>
        <div class="alert-badge info" *ngIf="alertsData()!.infoCount > 0">
          🔵 {{alertsData()!.infoCount}} Thông tin
        </div>
        <div class="alert-badge ok" *ngIf="alertsData()!.totalAlerts === 0">
          ✅ Không có cảnh báo nào
        </div>
      </div>

      <!-- Marketing Budget Overview -->
      <div class="marketing-budget-section" *ngIf="alertsData()!.marketingBudget.optimalDailyBudget > 0">
        <h4>📢 NGÂN SÁCH MARKETING TỐI ƯU (từ phân tích QC)</h4>
        <div class="mkt-overview">
          <div class="mkt-card">
            <div class="mkt-label">Quỹ Marketing hiện tại</div>
            <div class="mkt-value">{{alertsData()!.marketingBudget.fundBalance | number}}đ</div>
          </div>
          <div class="mkt-card">
            <div class="mkt-label">Chi phí QC tối ưu / ngày</div>
            <div class="mkt-value amount-blue">{{alertsData()!.marketingBudget.optimalDailyBudget | number}}đ</div>
          </div>
          <div class="mkt-card">
            <div class="mkt-label">Chi phí QC tối ưu / tháng</div>
            <div class="mkt-value amount-blue">{{alertsData()!.marketingBudget.optimalMonthlyBudget | number}}đ</div>
          </div>
          <div class="mkt-card" [class.positive]="alertsData()!.marketingBudget.fundBalance >= alertsData()!.marketingBudget.optimalMonthlyBudget"
               [class.negative]="alertsData()!.marketingBudget.fundBalance < alertsData()!.marketingBudget.optimalMonthlyBudget">
            <div class="mkt-label">Đủ cho</div>
            <div class="mkt-value">
              {{alertsData()!.marketingBudget.optimalMonthlyBudget > 0
                ? (alertsData()!.marketingBudget.fundBalance / alertsData()!.marketingBudget.optimalMonthlyBudget | number:'1.1-1')
                : '∞'}} tháng
            </div>
          </div>
        </div>

        <!-- Group breakdown -->
        <div class="mkt-breakdown" *ngIf="alertsData()!.marketingBudget.groupBreakdown.length">
          <h5>Chi tiết theo nhóm quảng cáo</h5>
          <table class="data">
            <thead><tr>
              <th>Nhóm QC</th><th>Nền tảng</th><th>Chi hiện tại/ngày</th>
              <th>Đề xuất tối ưu/ngày</th><th>Thay đổi</th><th>Độ tin cậy</th><th>Lý do</th>
            </tr></thead>
            <tbody>
              <tr *ngFor="let g of alertsData()!.marketingBudget.groupBreakdown">
                <td><strong>{{g.adGroupName || g.adGroupId}}</strong></td>
                <td><span class="badge platform">{{g.platform}}</span></td>
                <td class="right">{{g.currentDailySpend | number}}đ</td>
                <td class="right amount-blue"><strong>{{g.optimalDailySpend | number}}đ</strong></td>
                <td class="right" [class.amount-green]="g.changePercent > 0" [class.amount-red]="g.changePercent < 0">
                  {{g.changePercent > 0 ? '+' : ''}}{{g.changePercent || 0}}%
                </td>
                <td>
                  <span class="badge" [class.high-conf]="g.confidence === 'HIGH'"
                        [class.med-conf]="g.confidence === 'MEDIUM'" [class.low-conf]="g.confidence === 'LOW'">
                    {{g.confidence}}
                  </span>
                </td>
                <td class="reason-text">{{g.reason}}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Alert Cards -->
      <div class="alerts-list" *ngIf="alertsData()!.alerts.length">
        <div class="alert-card" *ngFor="let alert of alertsData()!.alerts"
             [class.alert-critical]="alert.severity === 'CRITICAL'"
             [class.alert-warning]="alert.severity === 'WARNING'"
             [class.alert-info]="alert.severity === 'INFO'">
          <div class="alert-header">
            <span class="alert-severity">
              {{alert.severity === 'CRITICAL' ? '🔴' : alert.severity === 'WARNING' ? '🟡' : '🔵'}}
            </span>
            <span class="alert-category-tag">{{alertCategoryLabel(alert.category)}}</span>
            <h4 class="alert-title">{{alert.title}}</h4>
          </div>
          <p class="alert-message">{{alert.message}}</p>
          <div class="alert-actions" *ngIf="alert.actions.length">
            <span class="action-label">Hành động đề xuất:</span>
            <div class="action-buttons">
              <button *ngFor="let action of alert.actions"
                      class="action-btn"
                      [class.action-navigate]="action.type === 'NAVIGATE'"
                      [class.action-fund]="action.type === 'FUND_DEPOSIT' || action.type === 'FUND_WITHDRAW'"
                      [class.action-info]="action.type === 'INFO'"
                      (click)="handleAlertAction(action)">
                {{action.type === 'NAVIGATE' ? '→' : action.type === 'INFO' ? 'ℹ️' : '💰'}} {{action.label}}
              </button>
            </div>
          </div>
        </div>
      </div>

      <p class="empty-text" *ngIf="!alertsData()!.alerts.length">✅ Không có cảnh báo nào. Tài chính đang ổn định!</p>
    </ng-container>
    <p class="empty-text" *ngIf="!alertsData()">Đang tải dữ liệu cảnh báo...</p>
  </div>

  <!-- â•â•â• MODALS â•â•â• -->

  <!-- Modal: Create Bank Account -->
  <div class="modal-backdrop" *ngIf="showBankAccountModal()">
    <div class="modal">
      <h3>Thêm tài khoản ngân hàng</h3>
      <form (ngSubmit)="submitBankAccount()" #baForm="ngForm">
        <label>Tên ngân hàng <span class="req">*</span>
          <input name="bankName" [(ngModel)]="bankAccountForm.bankName" required />
        </label>
        <label>Số tài khoản <span class="req">*</span>
          <input name="accountNumber" [(ngModel)]="bankAccountForm.accountNumber" required />
        </label>
        <label>Chủ tài khoản
          <input name="accountHolder" [(ngModel)]="bankAccountForm.accountHolder" />
        </label>
        <label>Chi nhánh
          <input name="branch" [(ngModel)]="bankAccountForm.branch" />
        </label>
        <label>Số dư ban đầu (đ)
          <input name="openingBalance" type="number" [(ngModel)]="bankAccountForm.openingBalance" min="0" />
        </label>
        <label>Mô tả
          <textarea name="description" [(ngModel)]="bankAccountForm.description" rows="2"></textarea>
        </label>
        <label class="checkbox-label">
          <input type="checkbox" name="isPrimary" [(ngModel)]="bankAccountForm.isPrimary" />
          Tài khoản chính
        </label>
        <div class="form-actions">
          <button type="submit" class="primary">Tạo</button>
          <button type="button" (click)="showBankAccountModal.set(false)">Hủy</button>
        </div>
        <p class="error" *ngIf="modalError()">{{modalError()}}</p>
      </form>
    </div>
  </div>

  <!-- Modal: Record Bank Transaction -->
  <div class="modal-backdrop" *ngIf="showBankTxModal()">
    <div class="modal">
      <h3>Ghi nhận giao dịch ngân hàng</h3>
      <form (ngSubmit)="submitBankTx()">
        <label>Tài khoản <span class="req">*</span>
          <select [(ngModel)]="bankTxForm.bankAccountId" name="bankAccountId" required>
            <option *ngFor="let ba of bankAccounts()" [value]="ba._id">{{ba.bankName}} - {{ba.accountNumber}}</option>
          </select>
        </label>
        <label>Loại giao dịch <span class="req">*</span>
          <select [(ngModel)]="bankTxForm.type" name="type" required>
            <option value="DEPOSIT">Nạp vào</option>
            <option value="WITHDRAWAL">Rút ra</option>
            <option value="TRANSFER_IN">Chuyển khoản đến</option>
            <option value="TRANSFER_OUT">Chuyển khoản đi</option>
            <option value="INTEREST">Lãi suất</option>
            <option value="FEE">Phí dịch vụ</option>
            <option value="ADJUSTMENT">Điều chỉnh</option>
          </select>
        </label>
        <label>Danh mục
          <select [(ngModel)]="bankTxForm.category" name="category">
            <option value="TUITION_INCOME">Thu học phí</option>
            <option value="PAYROLL">Chi lương</option>
            <option value="EXPENSE">Chi phí VH</option>
            <option value="RESERVE_FUND">Quỹ dự phòng</option>
            <option value="PETTY_CASH">Tiền mặt</option>
            <option value="COMMISSION">Hoa hồng</option>
            <option value="REFUND">Hoàn tiền</option>
            <option value="OTHER">Khác</option>
          </select>
        </label>
        <div class="form-grid">
          <label>Số tiền (đ) <span class="req">*</span>
            <input name="amount" type="number" [(ngModel)]="bankTxForm.amount" required min="0" />
          </label>
          <label>Ngày giao dịch <span class="req">*</span>
            <input name="transactionDate" type="date" [(ngModel)]="bankTxForm.transactionDate" required />
          </label>
        </div>
        <label>Mô tả
          <textarea name="description" [(ngModel)]="bankTxForm.description" rows="2"></textarea>
        </label>
        <label>Tham chiếu (mã hóa đơn, lương...)
          <input name="reference" [(ngModel)]="bankTxForm.reference" />
        </label>
        <div class="form-actions">
          <button type="submit" class="primary">Ghi nhận</button>
          <button type="button" (click)="showBankTxModal.set(false)">Hủy</button>
        </div>
        <p class="error" *ngIf="modalError()">{{modalError()}}</p>
      </form>
    </div>
  </div>

  <!-- Modal: Create Fund -->
  <div class="modal-backdrop" *ngIf="showFundModal()">
    <div class="modal">
      <h3>Tạo quỹ mới</h3>
      <form (ngSubmit)="submitFund()">
        <label>Tên quỹ <span class="req">*</span>
          <input name="name" [(ngModel)]="fundForm.name" required />
        </label>
        <label>Loại quỹ <span class="req">*</span>
          <select [(ngModel)]="fundForm.fundType" name="fundType" required>
            <option value="RESERVE">Quỹ dự phòng</option>
            <option value="PETTY_CASH">Quỹ tiền mặt</option>
            <option value="MARKETING">Quỹ marketing</option>
            <option value="TRAINING">Quỹ đào tạo</option>
            <option value="BONUS">Quỹ thưởng</option>
            <option value="OTHER">Quỹ khác</option>
          </select>
        </label>
        <div class="form-grid">
          <label>Số dư ban đầu (đ)
            <input name="currentBalance" type="number" [(ngModel)]="fundForm.currentBalance" min="0" />
          </label>
          <label>Mức tối thiểu (đ)
            <input name="minimumBalance" type="number" [(ngModel)]="fundForm.minimumBalance" min="0" />
          </label>
          <label>Mức đích (đ)
            <input name="targetBalance" type="number" [(ngModel)]="fundForm.targetBalance" min="0" />
          </label>
        </div>
        <label>Mô tả
          <textarea name="description" [(ngModel)]="fundForm.description" rows="2"></textarea>
        </label>
        <div class="form-actions">
          <button type="submit" class="primary">Tạo</button>
          <button type="button" (click)="showFundModal.set(false)">Hủy</button>
        </div>
        <p class="error" *ngIf="modalError()">{{modalError()}}</p>
      </form>
    </div>
  </div>

  <!-- Modal: Fund Transaction -->
  <div class="modal-backdrop" *ngIf="showFundTxModal()">
    <div class="modal">
      <h3>Nạp/Rút quỹ: {{selectedFund()?.name}}</h3>
      <form (ngSubmit)="submitFundTx()">
        <label>Loại <span class="req">*</span>
          <select [(ngModel)]="fundTxForm.type" name="type" required>
            <option value="DEPOSIT">Nạp vào</option>
            <option value="WITHDRAW">Rút ra</option>
            <option value="ADJUSTMENT">Điều chỉnh</option>
          </select>
        </label>
        <div class="form-grid">
          <label>Số tiền (đ) <span class="req">*</span>
            <input name="amount" type="number" [(ngModel)]="fundTxForm.amount" required min="0" />
          </label>
          <label>Ngày <span class="req">*</span>
            <input name="transactionDate" type="date" [(ngModel)]="fundTxForm.transactionDate" required />
          </label>
        </div>
        <label>Mô tả
          <textarea name="description" [(ngModel)]="fundTxForm.description" rows="2"></textarea>
        </label>
        <label>Tham chiếu
          <input name="reference" [(ngModel)]="fundTxForm.reference" />
        </label>
        <div class="form-actions">
          <button type="submit" class="primary">Thực hiện</button>
          <button type="button" (click)="showFundTxModal.set(false)">Hủy</button>
        </div>
        <p class="error" *ngIf="modalError()">{{modalError()}}</p>
      </form>
    </div>
  </div>
  `,
  styles: [`
    .page-header { display:flex; justify-content:space-between; align-items:flex-start; padding:24px 32px 16px; }
    .page-header h2 { margin:0; font-size:22px; color:#1e293b; }
    .page-header p { margin:4px 0 0; color:#64748b; font-size:13px; }
    .header-filters { display:flex; gap:8px; align-items:center; }
    .header-filters input { padding:6px 10px; border:1px solid #cbd5e1; border-radius:6px; font-size:13px; }

    .tab-bar { display:flex; gap:4px; padding:0 32px; border-bottom:2px solid #e2e8f0; }
    .tab-bar button {
      padding:10px 16px; border:none; background:none; cursor:pointer;
      font-size:13px; color:#64748b; border-bottom:2px solid transparent; margin-bottom:-2px;
      transition: all 0.15s;
    }
    .tab-bar button.active { color:#2563eb; border-bottom-color:#2563eb; font-weight:600; }
    .tab-bar button:hover { color:#1e293b; }

    .tab-content { padding:16px 32px 32px; }

    /* Overview cards */
    .overview-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:16px; margin-bottom:24px; }
    .ov-card { background:#fff; border-radius:12px; padding:20px; box-shadow:0 1px 3px rgba(0,0,0,0.08); }
    .ov-icon { font-size:28px; margin-bottom:8px; }
    .ov-value { font-size:20px; font-weight:700; color:#1e293b; }
    .ov-label { font-size:12px; color:#64748b; margin-top:4px; }
    .ov-warning { margin-top:8px; color:#f59e0b; font-size:12px; font-weight:600; }
    .ov-card.bank { border-left:4px solid #3b82f6; }
    .ov-card.fund { border-left:4px solid #8b5cf6; }
    .ov-card.inflow { border-left:4px solid #10b981; }
    .ov-card.outflow { border-left:4px solid #ef4444; }
    .ov-card.profit { border-left:4px solid #10b981; }
    .ov-card.loss { border-left:4px solid #ef4444; }
    .ov-detail { margin-top:6px; color:#64748b; line-height:1.6; }

    /* Dashboard sections */
    .dash-section { margin-bottom:24px; }
    .dash-section h4 { margin:0 0 12px; font-size:12px; text-transform:uppercase; letter-spacing:1px; color:#64748b; font-weight:700; }

    /* Metrics grid */
    .metrics-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(200px, 1fr)); gap:12px; }
    .metric-card { background:#fff; border-radius:12px; padding:16px; box-shadow:0 1px 3px rgba(0,0,0,0.08); }
    .metric-label { font-size:12px; color:#64748b; margin-bottom:4px; }
    .metric-value { font-size:20px; font-weight:700; color:#1e293b; }
    .metric-hint { font-size:11px; color:#94a3b8; margin-top:4px; }

    /* P&L quick */
    .pnl-quick, .recon-pnl { background:#fff; border-radius:12px; padding:20px; box-shadow:0 1px 3px rgba(0,0,0,0.08); margin-top:16px; }
    .pnl-quick h4, .recon-pnl h4 { margin:0 0 12px; color:#1e293b; }
    .pnl-row { display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid #f1f5f9; font-size:14px; }
    .pnl-row.bold { font-weight:600; }
    .pnl-row.total { font-weight:700; border-top:2px solid #e2e8f0; margin-top:8px; padding-top:12px; }
    .pnl-row.highlight { background:#f0fdf4; padding:12px; border-radius:8px; margin-top:8px; font-size:16px; border:none; }

    /* Warning section */
    .warning-section { background:#fffbeb; border:1px solid #f59e0b; border-radius:12px; padding:16px; margin-bottom:16px; }
    .warning-section h4 { margin:0 0 8px; color:#92400e; }
    .warning-item { padding:6px 0; font-size:13px; }

    /* Section headers */
    .section-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; }
    .section-header h3 { margin:0; color:#1e293b; }
    .section-header.mt { margin-top:32px; }

    /* Bank cards */
    .card-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(280px, 1fr)); gap:16px; margin-bottom:16px; }
    .bank-card, .fund-card { background:#fff; border-radius:12px; padding:20px; box-shadow:0 1px 3px rgba(0,0,0,0.08); cursor:pointer; transition:transform 0.15s,box-shadow 0.15s; }
    .bank-card:hover, .fund-card:hover { transform:translateY(-2px); box-shadow:0 4px 12px rgba(0,0,0,0.12); }
    .bank-card.primary-account { border:2px solid #2563eb; }
    .bank-name { font-weight:700; font-size:16px; color:#1e293b; }
    .account-num { font-size:13px; color:#64748b; font-family:monospace; }
    .bank-balance { font-size:22px; font-weight:700; color:#2563eb; margin:8px 0; }
    .bank-holder { font-size:12px; color:#94a3b8; }

    /* Fund cards */
    .fund-type { font-size:11px; text-transform:uppercase; color:#8b5cf6; font-weight:700; letter-spacing:0.5px; }
    .fund-name { font-weight:700; font-size:16px; color:#1e293b; margin:4px 0; }
    .fund-name code { font-size:11px; color:#94a3b8; }
    .fund-balance { font-size:22px; font-weight:700; color:#2563eb; margin:8px 0; }
    .fund-meta { display:flex; gap:16px; font-size:12px; color:#64748b; }
    .fund-card.warning { border:2px solid #f59e0b; }
    .fund-warning { color:#f59e0b; font-size:12px; font-weight:600; margin-top:8px; }
    .progress-bar { height:6px; background:#e2e8f0; border-radius:3px; margin-top:8px; overflow:hidden; }
    .progress-fill { height:100%; background:#2563eb; border-radius:3px; transition:width 0.3s; }

    /* Cash flow */
    .cashflow-summary { display:grid; grid-template-columns:repeat(3, 1fr); gap:16px; margin-bottom:24px; }
    .cf-card { background:#fff; border-radius:12px; padding:20px; box-shadow:0 1px 3px rgba(0,0,0,0.08); text-align:center; }
    .cf-card.inflow { border-top:3px solid #10b981; }
    .cf-card.outflow { border-top:3px solid #ef4444; }
    .cf-card.net.positive { border-top:3px solid #10b981; }
    .cf-card.net.negative { border-top:3px solid #ef4444; }
    .cf-value { font-size:20px; font-weight:700; margin-top:8px; }

    /* Reconciliation */
    .recon-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(200px, 1fr)); gap:16px; margin-bottom:24px; }
    .recon-card { background:#fff; border-radius:12px; padding:20px; box-shadow:0 1px 3px rgba(0,0,0,0.08); text-align:center; }
    .recon-card h4 { margin:0 0 8px; font-size:14px; color:#64748b; }
    .recon-value { font-size:20px; font-weight:700; color:#1e293b; }
    .recon-card small { color:#94a3b8; font-size:12px; }
    .recon-card.positive { border-top:3px solid #10b981; }
    .recon-card.negative { border-top:3px solid #ef4444; }
    .recon-card.warning-card { border-top:3px solid #f59e0b; }

    /* P&L report */
    .pnl-report { background:#fff; border-radius:12px; padding:24px; box-shadow:0 1px 3px rgba(0,0,0,0.08); }
    .pnl-section { margin-bottom:24px; }
    .pnl-section h4 { margin:0 0 12px; color:#1e293b; }
    .pnl-section.summary { background:#f8fafc; border-radius:8px; padding:16px; }

    /* Common */
    .amount-green { color:#10b981; }
    .amount-red { color:#ef4444; }
    .amount-blue { color:#3b82f6; }
    .primary { background:#2563eb; color:#fff; border:none; padding:8px 16px; border-radius:8px; cursor:pointer; font-weight:600; font-size:13px; }
    .primary:hover { background:#1d4ed8; }
    .filters { display:flex; gap:8px; margin-bottom:16px; flex-wrap:wrap; }
    .filters.inline { display:inline-flex; }
    .filters select, .filters input { padding:6px 10px; border:1px solid #cbd5e1; border-radius:6px; font-size:13px; }
    .provisional-filter { align-items:center; margin-bottom:0; }
    .provisional-filter span { font-size:13px; color:#475569; font-weight:600; }
    .empty-text { text-align:center; color:#94a3b8; padding:32px; font-size:14px; }

    .data { width:100%; border-collapse:collapse; background:#fff; border-radius:12px; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,0.08); }
    .data th { background:#f8fafc; text-align:left; padding:10px 12px; font-size:12px; color:#64748b; text-transform:uppercase; letter-spacing:0.5px; }
    .data td { padding:10px 12px; border-top:1px solid #f1f5f9; font-size:13px; }
    .data tr:hover { background:#f8fafc; }
    .data code { font-size:12px; color:#2563eb; }
    .right { text-align:right; }
    .badge { display:inline-block; padding:2px 8px; border-radius:999px; font-size:11px; font-weight:600; }
    .badge.active { background:#dcfce7; color:#16a34a; }
    .badge.inactive { background:#fee2e2; color:#dc2626; }
    .badge.reconciled { background:#dcfce7; color:#16a34a; }
    .btn-sm { padding:4px 8px; font-size:12px; border:1px solid #cbd5e1; background:#fff; border-radius:4px; cursor:pointer; }
    .btn-sm:hover { background:#f1f5f9; }

    /* Modals */
    .modal-backdrop { position:fixed; inset:0; background:rgba(0,0,0,0.5); display:flex; align-items:center; justify-content:center; z-index:999; }
    .modal { background:#fff; border-radius:16px; padding:28px; width:95%; max-width:520px; max-height:90vh; overflow-y:auto; box-shadow:0 20px 60px rgba(0,0,0,0.15); }
    .modal h3 { margin:0 0 20px; font-size:18px; color:#1e293b; }
    label { display:block; margin-bottom:12px; font-size:13px; font-weight:600; color:#374151; }
    label input, label select, label textarea { display:block; width:100%; padding:8px 12px; margin-top:4px; border:1px solid #d1d5db; border-radius:8px; font-size:14px; box-sizing:border-box; }
    .form-grid { display:grid; grid-template-columns:1fr 1fr 1fr; gap:12px; }
    .form-actions { display:flex; gap:8px; margin-top:16px; }
    .form-actions button { padding:10px 20px; border-radius:8px; font-size:14px; font-weight:600; cursor:pointer; border:1px solid #d1d5db; background:#f8fafc; }
    .form-actions .primary { background:#2563eb; color:#fff; border-color:#2563eb; }
    .req { color:#ef4444; }
    .error { color:#ef4444; font-size:13px; margin-top:8px; }
    .checkbox-label { display:flex; align-items:center; gap:8px; flex-direction:row; }
    .checkbox-label input { width:auto; margin:0; }

    /* Alerts styles */
    .alert-summary { display:flex; gap:12px; margin-bottom:20px; flex-wrap:wrap; }
    .alert-badge { padding:8px 16px; border-radius:8px; font-weight:700; font-size:14px; }
    .alert-badge.critical { background:#fef2f2; color:#dc2626; border:1px solid #fecaca; }
    .alert-badge.warning { background:#fffbeb; color:#d97706; border:1px solid #fde68a; }
    .alert-badge.info { background:#eff6ff; color:#2563eb; border:1px solid #bfdbfe; }
    .alert-badge.ok { background:#f0fdf4; color:#16a34a; border:1px solid #bbf7d0; }

    .marketing-budget-section { background:#fff; border-radius:12px; padding:20px; box-shadow:0 1px 3px rgba(0,0,0,0.08); margin-bottom:24px; border-left:4px solid #8b5cf6; }
    .marketing-budget-section h4 { margin:0 0 16px; font-size:12px; text-transform:uppercase; letter-spacing:1px; color:#64748b; font-weight:700; }
    .marketing-budget-section h5 { margin:16px 0 8px; color:#1e293b; font-size:14px; }
    .mkt-overview { display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:12px; margin-bottom:16px; }
    .mkt-card { background:#f8fafc; border-radius:8px; padding:14px; text-align:center; }
    .mkt-card.positive { background:#f0fdf4; border:1px solid #bbf7d0; }
    .mkt-card.negative { background:#fef2f2; border:1px solid #fecaca; }
    .mkt-label { font-size:12px; color:#64748b; margin-bottom:4px; }
    .mkt-value { font-size:18px; font-weight:700; color:#1e293b; }
    .mkt-breakdown { margin-top:12px; }

    .badge.platform { background:#e0e7ff; color:#4338ca; }
    .badge.high-conf { background:#dcfce7; color:#16a34a; }
    .badge.med-conf { background:#fef9c3; color:#a16207; }
    .badge.low-conf { background:#fee2e2; color:#dc2626; }
    .reason-text { font-size:12px; color:#64748b; max-width:200px; }

    .alerts-list { display:flex; flex-direction:column; gap:16px; }
    .alert-card { background:#fff; border-radius:12px; padding:20px; box-shadow:0 1px 3px rgba(0,0,0,0.08); }
    .alert-card.alert-critical { border-left:4px solid #dc2626; }
    .alert-card.alert-warning { border-left:4px solid #f59e0b; }
    .alert-card.alert-info { border-left:4px solid #3b82f6; }
    .alert-header { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
    .alert-severity { font-size:18px; }
    .alert-category-tag { background:#f1f5f9; color:#475569; padding:2px 8px; border-radius:4px; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.5px; }
    .alert-title { margin:0; font-size:15px; color:#1e293b; flex:1; }
    .alert-message { margin:8px 0 12px; font-size:13px; color:#475569; line-height:1.6; }
    .alert-actions { border-top:1px solid #f1f5f9; padding-top:12px; }
    .action-label { font-size:11px; color:#94a3b8; text-transform:uppercase; font-weight:600; letter-spacing:0.5px; display:block; margin-bottom:8px; }
    .action-buttons { display:flex; gap:8px; flex-wrap:wrap; }
    .action-btn { padding:6px 12px; border-radius:6px; font-size:12px; font-weight:600; cursor:pointer; border:1px solid #e2e8f0; background:#f8fafc; color:#374151; transition:all 0.15s; }
    .action-btn:hover { background:#e2e8f0; }
    .action-btn.action-navigate { border-color:#bfdbfe; color:#2563eb; background:#eff6ff; }
    .action-btn.action-navigate:hover { background:#dbeafe; }
    .action-btn.action-fund { border-color:#bbf7d0; color:#16a34a; background:#f0fdf4; }
    .action-btn.action-fund:hover { background:#dcfce7; }
    .action-btn.action-info { border-color:#e2e8f0; color:#64748b; }
  `]
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
  modalError = signal('');

  // Forms
  bankAccountForm: any = { bankName: '', accountNumber: '', accountHolder: '', branch: '', openingBalance: 0, description: '', isPrimary: false };
  bankTxForm: any = { bankAccountId: '', type: 'DEPOSIT', category: 'OTHER', amount: 0, transactionDate: '', description: '', reference: '' };
  fundForm: any = { name: '', fundType: 'RESERVE', currentBalance: 0, minimumBalance: 0, targetBalance: 0, description: '' };
  fundTxForm: any = { type: 'DEPOSIT', amount: 0, transactionDate: '', description: '', reference: '' };

  constructor(private service: FinancialControlService, private auth: AuthService, private router: Router) {}

  ngOnInit() { this.reload(); }

  isDirector(): boolean { return this.auth.hasRole([Role.DIRECTOR]); }

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
          this.bankAccounts.set(await this.service.getBankAccounts());
          this.loadBankTransactions();
          break;
        case 'funds':
          this.funds.set(await this.service.getFunds());
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

  // â”€â”€â”€ Bank Account Modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  openBankAccountModal() {
    this.bankAccountForm = { bankName: '', accountNumber: '', accountHolder: '', branch: '', openingBalance: 0, description: '', isPrimary: false };
    this.modalError.set('');
    this.showBankAccountModal.set(true);
  }

  async submitBankAccount() {
    const res = await this.service.createBankAccount(this.bankAccountForm);
    if (!res.ok) { this.modalError.set(res.message || 'Lỗi'); return; }
    this.showBankAccountModal.set(false);
    this.bankAccounts.set(await this.service.getBankAccounts());
  }

  // â”€â”€â”€ Bank Transaction Modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  openBankTxModal() {
    this.bankTxForm = {
      bankAccountId: this.selectedBankAccount()?._id || (this.bankAccounts().length ? this.bankAccounts()[0]._id : ''),
      type: 'DEPOSIT', category: 'OTHER', amount: 0, transactionDate: new Date().toISOString().split('T')[0], description: '', reference: '',
    };
    this.modalError.set('');
    this.showBankTxModal.set(true);
  }

  async submitBankTx() {
    const res = await this.service.recordBankTransaction(this.bankTxForm);
    if (!res.ok) { this.modalError.set(res.message || 'Lỗi'); return; }
    this.showBankTxModal.set(false);
    this.bankAccounts.set(await this.service.getBankAccounts());
    this.loadBankTransactions();
  }

  async reconcile(txId: string) {
    if (!confirm('Xác nhận đối soát giao dịch này?')) return;
    const res = await this.service.reconcileTransaction(txId);
    if (!res.ok) { alert(res.message); return; }
    this.loadBankTransactions();
  }

  // â”€â”€â”€ Fund Modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  openFundModal() {
    this.fundForm = { name: '', fundType: 'RESERVE', currentBalance: 0, minimumBalance: 0, targetBalance: 0, description: '' };
    this.modalError.set('');
    this.showFundModal.set(true);
  }

  async submitFund() {
    const res = await this.service.createFund(this.fundForm);
    if (!res.ok) { this.modalError.set(res.message || 'Lỗi'); return; }
    this.showFundModal.set(false);
    this.funds.set(await this.service.getFunds());
  }

  // â”€â”€â”€ Fund Transaction Modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  openFundTxModal() {
    this.fundTxForm = {
      type: 'DEPOSIT', amount: 0, transactionDate: new Date().toISOString().split('T')[0], description: '', reference: '',
    };
    this.modalError.set('');
    this.showFundTxModal.set(true);
  }

  async submitFundTx() {
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

  // â”€â”€â”€ Alerts helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  private readonly ALERT_CATEGORY_LABELS: Record<string, string> = {
    MARKETING: 'Marketing',
    CASH_FLOW: 'Dòng tiền',
    RESERVE: 'Dự phòng',
    FUND: 'Quỹ',
    OBLIGATIONS: 'Nghĩa vụ TT',
    METRICS: 'Chỉ số',
    PROFITABILITY: 'Lợi nhuận',
    RECONCILIATION: 'Đối soát',
    EXPENSES: 'Chi phí',
    RECEIVABLE: 'Công nợ',
    REVENUE: 'Doanh thu',
  };

  alertCategoryLabel(cat: string): string {
    return this.ALERT_CATEGORY_LABELS[cat] || cat;
  }

  private normalizeAppTarget(target: string): string {
    const trimmed = (target || '').trim();
    if (!trimmed) return '/app/dashboard';
    if (trimmed.startsWith('/app/')) return trimmed;
    if (trimmed.startsWith('/')) return `/app${trimmed}`;
    return `/app/${trimmed}`;
  }

  handleAlertAction(action: { label: string; type: string; target?: string; amount?: number }) {
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
