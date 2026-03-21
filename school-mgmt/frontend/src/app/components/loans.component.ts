import { Component, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LoanService, Loan, LoanPayment, LoanSummary } from '../services/loan.service';
import { AuthService } from '../services/auth.service';
import { Role } from '../models/role.enum';

import { FlowGuideComponent } from './shared/flow-guide.component';

const LENDER_TYPE_LABELS: Record<string, string> = {
  BANK: 'Ngân hàng',
  INDIVIDUAL: 'Cá nhân',
  ORGANIZATION: 'Tổ chức',
  OTHER: 'Khác',
};

const LOAN_TYPE_LABELS: Record<string, string> = {
  WORKING_CAPITAL: 'Vốn lưu động',
  EQUIPMENT: 'Mua thiết bị',
  RENOVATION: 'Sửa chữa',
  EXPANSION: 'Mở rộng',
  OTHER: 'Khác',
};

const LOAN_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Nháp',
  ACTIVE: 'Đang vay',
  COMPLETED: 'Đã tất toán',
  DEFAULTED: 'Nợ xấu',
  RESTRUCTURED: 'Tái cấu trúc',
};

const LOAN_STATUS_COLORS: Record<string, string> = {
  DRAFT: '#9ca3af',
  ACTIVE: '#3b82f6',
  COMPLETED: '#10b981',
  DEFAULTED: '#ef4444',
  RESTRUCTURED: '#f59e0b',
};

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  SCHEDULED: 'Chưa đến hạn',
  PAID: 'Đã trả',
  OVERDUE: 'Quá hạn',
  PARTIAL: 'Trả một phần',
};

const PAYMENT_STATUS_COLORS: Record<string, string> = {
  SCHEDULED: '#9ca3af',
  PAID: '#10b981',
  OVERDUE: '#ef4444',
  PARTIAL: '#f59e0b',
};

const FREQUENCY_LABELS: Record<string, string> = {
  MONTHLY: 'Hàng tháng',
  QUARTERLY: 'Hàng quý',
  SEMI_ANNUALLY: 'Nửa năm',
  ANNUALLY: 'Hàng năm',
};

const INTEREST_TYPE_LABELS: Record<string, string> = {
  FIXED: 'Cố định',
  FLOATING: 'Thả nổi',
};

@Component({
  selector: 'app-loans',
  standalone: true,
  imports: [CommonModule, FormsModule, FlowGuideComponent],
  template: `
  <header class="page-header">
    <div>
      <h2>Quản lý Vốn vay</h2>
      <p>Theo dõi các khoản vay, lịch trả nợ và tình hình nợ.</p>
    </div>
    <div class="header-actions">
      <button class="secondary" (click)="doUpdateOverdue()">Cập nhật quá hạn</button>
      <button class="primary" *ngIf="isDirector" (click)="openCreateModal()">+ Tạo khoản vay</button>
    </div>
  </header>

  <app-flow-guide featureKey="loans"></app-flow-guide>

  <!-- Tab bar -->
  <div class="tab-bar">
    <button *ngFor="let t of tabs" [class.active]="activeTab === t.key" (click)="activeTab = t.key; loadTab(t.key)">
      {{t.icon}} {{t.label}}
    </button>
  </div>

  <!-- ═══ TAB: Tổng quan ═══ -->
  <div *ngIf="activeTab === 'summary'" class="tab-content">
    <ng-container *ngIf="summary()">
      <div class="stats">
        <div class="stat-card danger">
          <div class="stat-value">{{summary()!.totalDebt | number}}đ</div>
          <div class="stat-label">Tổng dư nợ</div>
        </div>
        <div class="stat-card primary">
          <div class="stat-value">{{summary()!.activeLoanCount}}</div>
          <div class="stat-label">Khoản vay đang hoạt động</div>
        </div>
        <div class="stat-card warning">
          <div class="stat-value">{{summary()!.upcomingPayments30d | number}}đ</div>
          <div class="stat-label">Phải trả 30 ngày tới ({{summary()!.upcomingPaymentCount30d}} kỳ)</div>
        </div>
        <div class="stat-card success">
          <div class="stat-value">{{summary()!.totalAmountPaid | number}}đ</div>
          <div class="stat-label">Đã trả tổng cộng</div>
        </div>
      </div>

      <div class="stats" style="margin-top: 12px;">
        <div class="stat-card" [class.danger]="summary()!.overdueCount > 0">
          <div class="stat-value">{{summary()!.overdueAmount | number}}đ</div>
          <div class="stat-label">Quá hạn ({{summary()!.overdueCount}} kỳ)</div>
        </div>
        <div class="stat-card info">
          <div class="stat-value">{{summary()!.totalInterestPaid | number}}đ</div>
          <div class="stat-label">Tổng lãi đã trả</div>
        </div>
      </div>

      <!-- Active loans list -->
      <h4 style="margin-top: 20px;">Các khoản vay đang hoạt động</h4>
      <div class="loan-cards">
        <div class="loan-card" *ngFor="let loan of activeLoans()">
          <div class="loan-card-header">
            <span class="loan-code">{{loan.loanCode}}</span>
            <span class="badge" [style.background]="getStatusColor(loan.status)">{{getStatusLabel(loan.status)}}</span>
          </div>
          <div class="loan-card-body">
            <div class="loan-info-row"><span class="lbl">Bên cho vay:</span> <strong>{{loan.lenderName}}</strong></div>
            <div class="loan-info-row"><span class="lbl">Loại vay:</span> {{getLoanTypeLabel(loan.loanType)}}</div>
            <div class="loan-info-row"><span class="lbl">Gốc:</span> {{loan.principal | number}}đ</div>
            <div class="loan-info-row"><span class="lbl">Lãi suất:</span> {{loan.interestRate}}%/năm ({{getInterestTypeLabel(loan.interestType)}})</div>
            <div class="loan-info-row"><span class="lbl">Kỳ hạn:</span> {{loan.term}} tháng ({{getFrequencyLabel(loan.paymentFrequency)}})</div>
            <div class="loan-info-row"><span class="lbl">Đáo hạn:</span> {{loan.endDate | date:'dd/MM/yyyy'}}</div>
            <div class="progress-row">
              <div class="progress-bar">
                <div class="progress-fill" [style.width.%]="getPaymentProgress(loan)"></div>
              </div>
              <span class="progress-text">Đã trả {{getPaymentProgress(loan)}}%</span>
            </div>
            <div class="loan-info-row"><span class="lbl">Còn nợ:</span> <strong style="color:#ef4444">{{loan.remainingBalance | number}}đ</strong></div>
          </div>
        </div>
        <div *ngIf="activeLoans().length === 0" class="empty">Chưa có khoản vay nào đang hoạt động.</div>
      </div>
    </ng-container>
  </div>

  <!-- ═══ TAB: Danh sách ═══ -->
  <div *ngIf="activeTab === 'list'" class="tab-content">
    <div class="filters">
      <input type="text" [(ngModel)]="filterKeyword" placeholder="Tìm mã/tên..." (input)="loadLoans()" />
      <select [(ngModel)]="filterStatus" (change)="loadLoans()">
        <option value="">Tất cả trạng thái</option>
        <option value="DRAFT">Nháp</option>
        <option value="ACTIVE">Đang vay</option>
        <option value="COMPLETED">Đã tất toán</option>
        <option value="DEFAULTED">Nợ xấu</option>
        <option value="RESTRUCTURED">Tái cấu trúc</option>
      </select>
      <select [(ngModel)]="filterLenderType" (change)="loadLoans()">
        <option value="">Tất cả loại chủ nợ</option>
        <option value="BANK">Ngân hàng</option>
        <option value="INDIVIDUAL">Cá nhân</option>
        <option value="ORGANIZATION">Tổ chức</option>
        <option value="OTHER">Khác</option>
      </select>
    </div>

    <table class="data-table">
      <thead>
        <tr>
          <th>Mã</th>
          <th>Bên cho vay</th>
          <th>Loại</th>
          <th>Gốc</th>
          <th>Lãi suất</th>
          <th>Kỳ hạn</th>
          <th>Còn nợ</th>
          <th>Trạng thái</th>
          <th>Thao tác</th>
        </tr>
      </thead>
      <tbody>
        <tr *ngFor="let loan of loans()">
          <td><strong>{{loan.loanCode}}</strong></td>
          <td>{{loan.lenderName}} <small>({{getLenderTypeLabel(loan.lenderType)}})</small></td>
          <td>{{getLoanTypeLabel(loan.loanType)}}</td>
          <td class="num">{{loan.principal | number}}đ</td>
          <td>{{loan.interestRate}}%</td>
          <td>{{loan.term}} tháng</td>
          <td class="num" [style.color]="loan.remainingBalance > 0 ? '#ef4444' : '#10b981'">{{loan.remainingBalance | number}}đ</td>
          <td><span class="badge" [style.background]="getStatusColor(loan.status)">{{getStatusLabel(loan.status)}}</span></td>
          <td>
            <button class="btn-sm" (click)="viewLoanSchedule(loan)">Lịch trả nợ</button>
            <button class="btn-sm primary" *ngIf="loan.status === 'DRAFT' && isDirector" (click)="doActivate(loan)">Kích hoạt</button>
          </td>
        </tr>
        <tr *ngIf="loans().length === 0"><td colspan="9" class="empty">Chưa có khoản vay nào.</td></tr>
      </tbody>
    </table>
  </div>

  <!-- ═══ TAB: Lịch trả nợ ═══ -->
  <div *ngIf="activeTab === 'schedule'" class="tab-content">
    <div class="filters">
      <select [(ngModel)]="selectedLoanId" (change)="loadSchedule()">
        <option value="">-- Chọn khoản vay --</option>
        <option *ngFor="let loan of allLoans()" [value]="loan._id">{{loan.loanCode}} - {{loan.lenderName}} ({{getStatusLabel(loan.status)}})</option>
      </select>
    </div>

    <ng-container *ngIf="selectedLoanId && schedulePayments().length > 0">
      <div class="schedule-summary" *ngIf="selectedLoanDetail()">
        <span>Gốc: <strong>{{selectedLoanDetail()!.principal | number}}đ</strong></span>
        <span>Còn nợ: <strong style="color:#ef4444">{{selectedLoanDetail()!.remainingBalance | number}}đ</strong></span>
        <span>Đã trả: <strong style="color:#10b981">{{selectedLoanDetail()!.totalPaid | number}}đ</strong></span>
      </div>

      <table class="data-table">
        <thead>
          <tr>
            <th>Kỳ</th>
            <th>Ngày đến hạn</th>
            <th>Gốc</th>
            <th>Lãi</th>
            <th>Tổng</th>
            <th>Trạng thái</th>
            <th>Ngày trả</th>
            <th>Thao tác</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let p of schedulePayments()" [style.background]="p.status === 'OVERDUE' ? '#fef2f2' : ''">
            <td>{{p.paymentNumber}}</td>
            <td>{{p.dueDate | date:'dd/MM/yyyy'}}</td>
            <td class="num">{{p.principalAmount | number}}đ</td>
            <td class="num">{{p.interestAmount | number}}đ</td>
            <td class="num"><strong>{{p.totalAmount | number}}đ</strong></td>
            <td><span class="badge" [style.background]="getPaymentStatusColor(p.status)">{{getPaymentStatusLabel(p.status)}}</span></td>
            <td>{{p.paidDate ? (p.paidDate | date:'dd/MM/yyyy') : '-'}}</td>
            <td>
              <button class="btn-sm primary" *ngIf="p.status === 'SCHEDULED' || p.status === 'OVERDUE'" (click)="openPayModal(p)">Ghi nhận trả</button>
            </td>
          </tr>
        </tbody>
      </table>
    </ng-container>
    <div *ngIf="!selectedLoanId" class="empty">Chọn khoản vay để xem lịch trả nợ.</div>
  </div>

  <!-- ═══ TAB: Lịch sử thanh toán ═══ -->
  <div *ngIf="activeTab === 'history'" class="tab-content">
    <div class="filters">
      <input type="date" [(ngModel)]="historyStartDate" (change)="loadHistory()" />
      <input type="date" [(ngModel)]="historyEndDate" (change)="loadHistory()" />
    </div>

    <table class="data-table">
      <thead>
        <tr>
          <th>Mã TT</th>
          <th>Khoản vay</th>
          <th>Kỳ</th>
          <th>Ngày trả</th>
          <th>Gốc</th>
          <th>Lãi</th>
          <th>Tổng</th>
          <th>PTTT</th>
          <th>Người trả</th>
        </tr>
      </thead>
      <tbody>
        <tr *ngFor="let p of paidPayments()">
          <td><strong>{{p.paymentCode}}</strong></td>
          <td>{{getLoanCodeById(p.loanId)}}</td>
          <td>{{p.paymentNumber}}</td>
          <td>{{p.paidDate | date:'dd/MM/yyyy'}}</td>
          <td class="num">{{p.principalAmount | number}}đ</td>
          <td class="num">{{p.interestAmount | number}}đ</td>
          <td class="num"><strong>{{p.totalAmount | number}}đ</strong></td>
          <td>{{p.paymentMethod || '-'}}</td>
          <td>{{p.paidByName || '-'}}</td>
        </tr>
        <tr *ngIf="paidPayments().length === 0"><td colspan="9" class="empty">Chưa có lịch sử thanh toán nào.</td></tr>
      </tbody>
    </table>
  </div>

  <!-- ═══ MODAL: Tạo khoản vay ═══ -->
  <div class="modal-overlay" *ngIf="showCreateModal" (click)="showCreateModal = false">
    <div class="modal" (click)="$event.stopPropagation()">
      <h3>Tạo khoản vay mới</h3>
      <div class="form-grid">
        <div class="form-group">
          <label>Bên cho vay *</label>
          <input type="text" [(ngModel)]="createForm.lenderName" placeholder="Tên ngân hàng/cá nhân/tổ chức" />
        </div>
        <div class="form-group">
          <label>Loại chủ nợ *</label>
          <select [(ngModel)]="createForm.lenderType">
            <option value="BANK">Ngân hàng</option>
            <option value="INDIVIDUAL">Cá nhân</option>
            <option value="ORGANIZATION">Tổ chức</option>
            <option value="OTHER">Khác</option>
          </select>
        </div>
        <div class="form-group">
          <label>Mục đích vay *</label>
          <select [(ngModel)]="createForm.loanType">
            <option value="WORKING_CAPITAL">Vốn lưu động</option>
            <option value="EQUIPMENT">Mua thiết bị</option>
            <option value="RENOVATION">Sửa chữa</option>
            <option value="EXPANSION">Mở rộng</option>
            <option value="OTHER">Khác</option>
          </select>
        </div>
        <div class="form-group">
          <label>Số tiền vay (đ) *</label>
          <input type="number" [(ngModel)]="createForm.principal" min="0" />
        </div>
        <div class="form-group">
          <label>Lãi suất (%/năm) *</label>
          <input type="number" [(ngModel)]="createForm.interestRate" min="0" step="0.1" />
        </div>
        <div class="form-group">
          <label>Loại lãi suất *</label>
          <select [(ngModel)]="createForm.interestType">
            <option value="FIXED">Cố định</option>
            <option value="FLOATING">Thả nổi</option>
          </select>
        </div>
        <div class="form-group">
          <label>Kỳ hạn (tháng) *</label>
          <input type="number" [(ngModel)]="createForm.term" min="1" />
        </div>
        <div class="form-group">
          <label>Ngày giải ngân *</label>
          <input type="date" [(ngModel)]="createForm.startDate" />
        </div>
        <div class="form-group">
          <label>Tần suất trả nợ *</label>
          <select [(ngModel)]="createForm.paymentFrequency">
            <option value="MONTHLY">Hàng tháng</option>
            <option value="QUARTERLY">Hàng quý</option>
            <option value="SEMI_ANNUALLY">Nửa năm</option>
            <option value="ANNUALLY">Hàng năm</option>
          </select>
        </div>
        <div class="form-group">
          <label>Tài sản đảm bảo</label>
          <input type="text" [(ngModel)]="createForm.collateral" placeholder="(không bắt buộc)" />
        </div>
        <div class="form-group full-width">
          <label>Ghi chú</label>
          <textarea [(ngModel)]="createForm.notes" rows="2"></textarea>
        </div>
      </div>
      <div *ngIf="createForm.startDate && createForm.term" class="preview-info">
        Ngày đáo hạn dự kiến: <strong>{{getEndDatePreview()}}</strong>
      </div>
      <div class="modal-actions">
        <button class="secondary" (click)="showCreateModal = false">Hủy</button>
        <button class="primary" (click)="doCreate()" [disabled]="creating()">{{creating() ? 'Đang tạo...' : 'Tạo khoản vay'}}</button>
      </div>
      <div class="error" *ngIf="createError">{{createError}}</div>
    </div>
  </div>

  <!-- ═══ MODAL: Ghi nhận thanh toán ═══ -->
  <div class="modal-overlay" *ngIf="showPayModal" (click)="showPayModal = false">
    <div class="modal" (click)="$event.stopPropagation()">
      <h3>Ghi nhận thanh toán kỳ {{payForm.paymentNumber}}</h3>
      <div class="pay-summary">
        <div>Gốc: <strong>{{payForm.principalAmount | number}}đ</strong></div>
        <div>Lãi: <strong>{{payForm.interestAmount | number}}đ</strong></div>
        <div>Tổng phải trả: <strong>{{payForm.totalAmount | number}}đ</strong></div>
      </div>
      <div class="form-grid">
        <div class="form-group">
          <label>Ngày trả *</label>
          <input type="date" [(ngModel)]="payForm.paidDate" />
        </div>
        <div class="form-group">
          <label>Phương thức</label>
          <select [(ngModel)]="payForm.paymentMethod">
            <option value="">-- Chọn --</option>
            <option value="BANK_TRANSFER">Chuyển khoản</option>
            <option value="CASH">Tiền mặt</option>
            <option value="OTHER">Khác</option>
          </select>
        </div>
        <div class="form-group">
          <label>Mã tham chiếu</label>
          <input type="text" [(ngModel)]="payForm.reference" placeholder="Số GD ngân hàng..." />
        </div>
        <div class="form-group full-width">
          <label>Ghi chú</label>
          <textarea [(ngModel)]="payForm.notes" rows="2"></textarea>
        </div>
      </div>
      <div class="modal-actions">
        <button class="secondary" (click)="showPayModal = false">Hủy</button>
        <button class="primary" (click)="doRecordPayment()" [disabled]="paying()">{{paying() ? 'Đang xử lý...' : 'Ghi nhận thanh toán'}}</button>
      </div>
      <div class="error" *ngIf="payError">{{payError}}</div>
    </div>
  </div>
  `,
  styles: [`
    :host { display: block; padding: 20px; }
    .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
    .page-header h2 { margin: 0; font-size: 1.5rem; }
    .page-header p { margin: 4px 0 0; color: #64748b; font-size: 0.9rem; }
    .header-actions { display: flex; gap: 8px; }

    .tab-bar { display: flex; gap: 4px; border-bottom: 2px solid #e2e8f0; margin-bottom: 20px; }
    .tab-bar button { padding: 10px 18px; border: none; background: none; cursor: pointer; font-size: 0.9rem; color: #64748b; border-bottom: 2px solid transparent; margin-bottom: -2px; }
    .tab-bar button.active { color: #3b82f6; border-bottom-color: #3b82f6; font-weight: 600; }

    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; }
    .stat-card { background: #fff; border-radius: 8px; padding: 16px; border: 1px solid #e2e8f0; }
    .stat-card.danger { border-left: 4px solid #ef4444; }
    .stat-card.primary { border-left: 4px solid #3b82f6; }
    .stat-card.warning { border-left: 4px solid #f59e0b; }
    .stat-card.success { border-left: 4px solid #10b981; }
    .stat-card.info { border-left: 4px solid #8b5cf6; }
    .stat-value { font-size: 1.3rem; font-weight: 700; }
    .stat-label { font-size: 0.8rem; color: #64748b; margin-top: 4px; }

    .loan-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 14px; margin-top: 12px; }
    .loan-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; }
    .loan-card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
    .loan-code { font-weight: 700; font-size: 1rem; }
    .loan-card-body { font-size: 0.85rem; }
    .loan-info-row { margin-bottom: 4px; }
    .loan-info-row .lbl { color: #64748b; }
    .progress-row { display: flex; align-items: center; gap: 10px; margin: 8px 0; }
    .progress-bar { flex: 1; height: 8px; background: #e2e8f0; border-radius: 4px; overflow: hidden; }
    .progress-fill { height: 100%; background: #10b981; border-radius: 4px; transition: width 0.3s; }
    .progress-text { font-size: 0.8rem; color: #64748b; white-space: nowrap; }

    .filters { display: flex; gap: 10px; margin-bottom: 16px; flex-wrap: wrap; }
    .filters input, .filters select { padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 0.85rem; }

    .data-table { width: 100%; border-collapse: collapse; background: #fff; border-radius: 8px; overflow: hidden; border: 1px solid #e2e8f0; }
    .data-table th { background: #f8fafc; padding: 10px 12px; text-align: left; font-size: 0.8rem; color: #64748b; font-weight: 600; border-bottom: 1px solid #e2e8f0; }
    .data-table td { padding: 10px 12px; font-size: 0.85rem; border-bottom: 1px solid #f1f5f9; }
    .data-table .num { text-align: right; font-variant-numeric: tabular-nums; }
    .data-table .empty { text-align: center; color: #94a3b8; padding: 30px; }

    .badge { padding: 3px 10px; border-radius: 12px; font-size: 0.75rem; color: #fff; font-weight: 500; }
    .btn-sm { padding: 4px 10px; border: 1px solid #d1d5db; border-radius: 4px; background: #fff; cursor: pointer; font-size: 0.78rem; margin-right: 4px; }
    .btn-sm.primary { background: #3b82f6; color: #fff; border-color: #3b82f6; }
    .btn-sm:hover { opacity: 0.85; }

    button.primary { padding: 8px 18px; background: #3b82f6; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-weight: 500; }
    button.primary:disabled { opacity: 0.5; }
    button.secondary { padding: 8px 18px; background: #f1f5f9; color: #334155; border: 1px solid #d1d5db; border-radius: 6px; cursor: pointer; }

    .schedule-summary { display: flex; gap: 24px; margin-bottom: 14px; font-size: 0.9rem; flex-wrap: wrap; }

    .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.4); display: flex; align-items: center; justify-content: center; z-index: 1000; }
    .modal { background: #fff; border-radius: 12px; padding: 24px; width: 95%; max-width: 640px; max-height: 90vh; overflow-y: auto; }
    .modal h3 { margin: 0 0 16px; font-size: 1.1rem; }
    .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .form-group { display: flex; flex-direction: column; }
    .form-group.full-width { grid-column: span 2; }
    .form-group label { font-size: 0.8rem; color: #64748b; margin-bottom: 4px; }
    .form-group input, .form-group select, .form-group textarea { padding: 8px 10px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 0.85rem; }
    .modal-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; }
    .preview-info { margin-top: 12px; padding: 8px 12px; background: #f0f9ff; border-radius: 6px; font-size: 0.85rem; color: #1e40af; }
    .pay-summary { display: flex; gap: 20px; margin-bottom: 14px; padding: 10px; background: #f8fafc; border-radius: 6px; font-size: 0.9rem; }
    .error { color: #ef4444; margin-top: 10px; font-size: 0.85rem; }
    .empty { text-align: center; color: #94a3b8; padding: 30px; }
  `],
})
export class LoansComponent implements OnInit {
  tabs = [
    { key: 'summary', icon: '📊', label: 'Tổng quan' },
    { key: 'list', icon: '📋', label: 'Danh sách' },
    { key: 'schedule', icon: '📅', label: 'Lịch trả nợ' },
    { key: 'history', icon: '✅', label: 'Lịch sử thanh toán' },
  ];
  activeTab = 'summary';

  summary = signal<LoanSummary | null>(null);
  loans = signal<Loan[]>([]);
  allLoans = signal<Loan[]>([]);
  activeLoans = signal<Loan[]>([]);
  schedulePayments = signal<LoanPayment[]>([]);
  paidPayments = signal<LoanPayment[]>([]);
  selectedLoanDetail = signal<Loan | null>(null);
  creating = signal(false);
  paying = signal(false);

  filterKeyword = '';
  filterStatus = '';
  filterLenderType = '';
  selectedLoanId = '';
  historyStartDate = '';
  historyEndDate = '';

  showCreateModal = false;
  showPayModal = false;
  createError = '';
  payError = '';

  isDirector = false;

  createForm: any = {
    lenderName: '', lenderType: 'BANK', loanType: 'WORKING_CAPITAL',
    principal: 0, interestRate: 0, interestType: 'FIXED',
    term: 12, startDate: '', paymentFrequency: 'MONTHLY',
    collateral: '', notes: '',
  };

  payForm: any = {
    loanId: '', paymentNumber: 0, paidDate: '', paymentMethod: '',
    reference: '', notes: '', principalAmount: 0, interestAmount: 0, totalAmount: 0,
  };

  // Loan map for quick lookup
  private loanMap = new Map<string, Loan>();

  constructor(
    private loanService: LoanService,
    private authService: AuthService,
  ) {}

  ngOnInit() {
    this.isDirector = this.authService.hasRole([Role.DIRECTOR]);
    this.loadTab('summary');
    this.loadAllLoans();
  }

  async loadTab(tab: string) {
    switch (tab) {
      case 'summary': await this.loadSummary(); break;
      case 'list': await this.loadLoans(); break;
      case 'schedule': break;
      case 'history': await this.loadHistory(); break;
    }
  }

  async loadSummary() {
    try {
      const [summary, loans] = await Promise.all([
        this.loanService.getSummary(),
        this.loanService.getLoans({ status: 'ACTIVE' }),
      ]);
      this.summary.set(summary);
      this.activeLoans.set(loans);
    } catch {}
  }

  async loadLoans() {
    try {
      const params: Record<string, string> = {};
      if (this.filterKeyword) params['keyword'] = this.filterKeyword;
      if (this.filterStatus) params['status'] = this.filterStatus;
      if (this.filterLenderType) params['lenderType'] = this.filterLenderType;
      const loans = await this.loanService.getLoans(params);
      this.loans.set(loans);
    } catch {}
  }

  async loadAllLoans() {
    try {
      const loans = await this.loanService.getLoans();
      this.allLoans.set(loans);
      this.loanMap.clear();
      loans.forEach(l => this.loanMap.set(l._id, l));
    } catch {}
  }

  async loadSchedule() {
    if (!this.selectedLoanId) { this.schedulePayments.set([]); return; }
    try {
      const [payments, loan] = await Promise.all([
        this.loanService.getPayments({ loanId: this.selectedLoanId }),
        this.loanService.getLoan(this.selectedLoanId),
      ]);
      this.schedulePayments.set(payments);
      this.selectedLoanDetail.set(loan);
    } catch {}
  }

  async loadHistory() {
    try {
      const params: Record<string, string> = { status: 'PAID' };
      if (this.historyStartDate) params['startDate'] = this.historyStartDate;
      if (this.historyEndDate) params['endDate'] = this.historyEndDate;
      const payments = await this.loanService.getPayments(params);
      this.paidPayments.set(payments);
    } catch {}
  }

  // ─── Actions ─────────────────────────────────────────────────────

  openCreateModal() {
    this.createForm = {
      lenderName: '', lenderType: 'BANK', loanType: 'WORKING_CAPITAL',
      principal: 0, interestRate: 0, interestType: 'FIXED',
      term: 12, startDate: new Date().toISOString().split('T')[0],
      paymentFrequency: 'MONTHLY', collateral: '', notes: '',
    };
    this.createError = '';
    this.showCreateModal = true;
  }

  async doCreate() {
    if (!this.createForm.lenderName || !this.createForm.principal || !this.createForm.startDate) {
      this.createError = 'Vui lòng điền đầy đủ thông tin bắt buộc.';
      return;
    }
    this.creating.set(true);
    this.createError = '';
    const res = await this.loanService.createLoan(this.createForm);
    this.creating.set(false);
    if (res.ok) {
      this.showCreateModal = false;
      await Promise.all([this.loadLoans(), this.loadAllLoans(), this.loadSummary()]);
    } else {
      this.createError = res.message || 'Tạo khoản vay thất bại';
    }
  }

  async doActivate(loan: Loan) {
    if (!confirm(`Kích hoạt khoản vay ${loan.loanCode}? Hệ thống sẽ tạo lịch trả nợ tự động.`)) return;
    const res = await this.loanService.activateLoan(loan._id);
    if (res.ok) {
      await Promise.all([this.loadLoans(), this.loadAllLoans(), this.loadSummary()]);
    } else {
      alert(res.message || 'Kích hoạt thất bại');
    }
  }

  viewLoanSchedule(loan: Loan) {
    this.activeTab = 'schedule';
    this.selectedLoanId = loan._id;
    this.loadSchedule();
  }

  openPayModal(payment: LoanPayment) {
    this.payForm = {
      loanId: payment.loanId,
      paymentNumber: payment.paymentNumber,
      paidDate: new Date().toISOString().split('T')[0],
      paymentMethod: '',
      reference: '',
      notes: '',
      principalAmount: payment.principalAmount,
      interestAmount: payment.interestAmount,
      totalAmount: payment.totalAmount,
    };
    this.payError = '';
    this.showPayModal = true;
  }

  async doRecordPayment() {
    if (!this.payForm.paidDate) {
      this.payError = 'Vui lòng chọn ngày trả.';
      return;
    }
    this.paying.set(true);
    this.payError = '';
    const res = await this.loanService.recordPayment({
      loanId: this.payForm.loanId,
      paymentNumber: this.payForm.paymentNumber,
      paidDate: this.payForm.paidDate,
      paymentMethod: this.payForm.paymentMethod || undefined,
      reference: this.payForm.reference || undefined,
      notes: this.payForm.notes || undefined,
    });
    this.paying.set(false);
    if (res.ok) {
      this.showPayModal = false;
      await Promise.all([this.loadSchedule(), this.loadSummary(), this.loadAllLoans()]);
    } else {
      this.payError = res.message || 'Ghi nhận thất bại';
    }
  }

  async doUpdateOverdue() {
    const res = await this.loanService.updateOverdue();
    if (res.ok) {
      await Promise.all([this.loadSummary(), this.loadLoans(), this.loadSchedule()]);
    }
  }

  // ─── Helpers ─────────────────────────────────────────────────────

  getStatusLabel(s: string) { return LOAN_STATUS_LABELS[s] || s; }
  getStatusColor(s: string) { return LOAN_STATUS_COLORS[s] || '#9ca3af'; }
  getLenderTypeLabel(s: string) { return LENDER_TYPE_LABELS[s] || s; }
  getLoanTypeLabel(s: string) { return LOAN_TYPE_LABELS[s] || s; }
  getFrequencyLabel(s: string) { return FREQUENCY_LABELS[s] || s; }
  getInterestTypeLabel(s: string) { return INTEREST_TYPE_LABELS[s] || s; }
  getPaymentStatusLabel(s: string) { return PAYMENT_STATUS_LABELS[s] || s; }
  getPaymentStatusColor(s: string) { return PAYMENT_STATUS_COLORS[s] || '#9ca3af'; }

  getPaymentProgress(loan: Loan): number {
    if (!loan.principal) return 0;
    return Math.round((loan.totalPaid / loan.principal) * 100);
  }

  getLoanCodeById(loanId: string): string {
    return this.loanMap.get(loanId)?.loanCode || loanId;
  }

  getEndDatePreview(): string {
    if (!this.createForm.startDate || !this.createForm.term) return '';
    const d = new Date(this.createForm.startDate);
    d.setMonth(d.getMonth() + this.createForm.term);
    return d.toLocaleDateString('vi-VN');
  }
}
