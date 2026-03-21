import { Component, computed, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ExpenseService, ExpenseItem, ExpenseStats } from '../services/expense.service';
import { FlowGuideComponent } from './shared/flow-guide.component';
import { AuthService } from '../services/auth.service';
import { Role } from '../models/role.enum';

const CATEGORY_LABELS: Record<string, string> = {
  RENT: 'Thuê mặt bằng',
  UTILITIES: 'Điện nước Internet',
  SUPPLIES: 'Văn phòng phẩm',
  MARKETING: 'Quảng cáo Marketing',
  MAINTENANCE: 'Sửa chữa Bảo trì',
  SALARY_BONUS: 'Thưởng Phụ cấp',
  TRAINING: 'Đào tạo',
  TRANSPORT: 'Đi lại Xăng xe',
  MEAL: 'Ăn uống',
  ENTERTAINMENT: 'Tiếp khách',
  OTHER: 'Khác',
};

const STATUS_LABELS: Record<string, string> = {
  PENDING_APPROVAL: 'Chờ duyệt',
  APPROVED_UNPAID: 'Đã duyệt, chưa chi',
  PAID: 'Đã chi',
  REJECTED: 'Từ chối',
};

const STATUS_COLORS: Record<string, string> = {
  PENDING_APPROVAL: '#f59e0b',
  APPROVED_UNPAID: '#3b82f6',
  PAID: '#10b981',
  REJECTED: '#ef4444',
};

const PAYMENT_METHODS: Record<string, string> = {
  CASH: 'Tiền mặt',
  BANK_TRANSFER: 'Chuyển khoản',
  CREDIT_CARD: 'Thẻ tín dụng',
  E_WALLET: 'Ví điện tử',
  OTHER: 'Khác',
};

@Component({
  selector: 'app-expenses',
  standalone: true,
  imports: [CommonModule, FormsModule, FlowGuideComponent],
  template: `
  <header class="page-header">
    <div>
      <h2>Quản lý Chi phí khác</h2>
      <p>Theo dõi chi phí phát sinh hàng ngày.</p>
    </div>
    <button class="primary" (click)="openCreate()">+ Tạo phiếu chi</button>
  </header>

  <app-flow-guide featureKey="expenses"></app-flow-guide>

  <!-- Stats summary -->
  <section class="stats" *ngIf="stats()">
    <div class="stat-card total">
      <div class="stat-value">{{stats()!.totalAmount | number}}đ</div>
      <div class="stat-label">Tổng chi phí</div>
    </div>
    <div class="stat-card pending" *ngIf="stats()!.byStatus['PENDING_APPROVAL']">
      <div class="stat-value">{{stats()!.byStatus['PENDING_APPROVAL'].total | number}}đ</div>
      <div class="stat-label">Chờ duyệt ({{stats()!.byStatus['PENDING_APPROVAL'].count}})</div>
    </div>
    <div class="stat-card approved" *ngIf="stats()!.byStatus['APPROVED_UNPAID']">
      <div class="stat-value">{{stats()!.byStatus['APPROVED_UNPAID'].total | number}}đ</div>
      <div class="stat-label">Đã duyệt chưa chi ({{stats()!.byStatus['APPROVED_UNPAID'].count}})</div>
    </div>
    <div class="stat-card paid" *ngIf="stats()!.byStatus['PAID']">
      <div class="stat-value">{{stats()!.byStatus['PAID'].total | number}}đ</div>
      <div class="stat-label">Đã chi ({{stats()!.byStatus['PAID'].count}})</div>
    </div>
  </section>

  <!-- Filters -->
  <section class="filters">
    <input placeholder="Tìm mã, tiêu đề..." [(ngModel)]="keyword" (ngModelChange)="applyFilter()" />
    <select [(ngModel)]="filterStatus" (ngModelChange)="applyFilter()">
      <option value="">Tất cả trạng thái</option>
      <option *ngFor="let s of allStatuses" [value]="s.value">{{s.label}}</option>
    </select>
    <select [(ngModel)]="filterCategory" (ngModelChange)="applyFilter()">
      <option value="">Tất cả loại chi</option>
      <option *ngFor="let c of allCategories" [value]="c.value">{{c.label}}</option>
    </select>
    <input type="date" [(ngModel)]="startDate" (ngModelChange)="applyFilter()" placeholder="Từ ngày" />
    <input type="date" [(ngModel)]="endDate" (ngModelChange)="applyFilter()" placeholder="Đến ngày" />
    <button (click)="reload()">Làm mới</button>
  </section>

  <!-- Table -->
  <table class="data" *ngIf="filtered().length; else empty">
    <thead><tr>
      <th>Mã</th><th>Ngày chi</th><th>Tiêu đề</th><th>Loại</th>
      <th>Số tiền</th><th>Trạng thái</th><th>Người tạo</th><th></th>
    </tr></thead>
    <tbody>
      <tr *ngFor="let e of filtered()" (click)="openDetail(e)" class="clickable">
        <td><code>{{e.expenseCode}}</code></td>
        <td>{{e.expenseDate | date:'dd/MM/yyyy'}}</td>
        <td>{{e.title}}</td>
        <td>{{categoryLabel(e.category)}}</td>
        <td class="right">{{e.amount | number}}đ</td>
        <td>
          <span class="badge" [style.background]="statusColor(e.paymentStatus) + '20'" [style.color]="statusColor(e.paymentStatus)">
            {{statusLabel(e.paymentStatus)}}
          </span>
        </td>
        <td>{{e.createdByName}}</td>
        <td class="actions-cell" (click)="$event.stopPropagation()">
          <button class="btn-sm" (click)="openEdit(e)" *ngIf="canEdit(e)">✏️</button>
          <button class="btn-sm success" (click)="approveExpense(e)" *ngIf="canApprove(e)">✓ Duyệt</button>
          <button class="btn-sm danger" (click)="rejectExpense(e)" *ngIf="canApprove(e)">✗ Từ chối</button>
          <button class="btn-sm primary" (click)="openPay(e)" *ngIf="canPay(e)">💰 Đã chi</button>
        </td>
      </tr>
    </tbody>
  </table>
  <ng-template #empty><p class="empty-text">Không có chi phí nào.</p></ng-template>

  <!-- Modal Create/Edit -->
  <div class="modal-backdrop" *ngIf="showModal()">
    <div class="modal">
      <h3>{{editingId ? 'Sửa phiếu chi' : 'Tạo phiếu chi mới'}}</h3>
      <form (ngSubmit)="submitForm()" #f="ngForm">
        <label>Tiêu đề <span class="req">*</span>
          <input name="title" [(ngModel)]="form.title" required />
        </label>
        <label>Mô tả
          <textarea name="description" [(ngModel)]="form.description" rows="2"></textarea>
        </label>
        <div class="form-grid">
          <label>Số tiền (đ) <span class="req">*</span>
            <input name="amount" type="number" [(ngModel)]="form.amount" required min="0" />
          </label>
          <label>Ngày chi <span class="req">*</span>
            <input name="expenseDate" type="date" [(ngModel)]="form.expenseDate" required />
          </label>
          <label>Loại chi <span class="req">*</span>
            <select name="category" [(ngModel)]="form.category" required>
              <option *ngFor="let c of allCategories" [value]="c.value">{{c.label}}</option>
            </select>
          </label>
        </div>
        <label>Ghi chú
          <textarea name="notes" [(ngModel)]="form.notes" rows="2"></textarea>
        </label>
        <div class="form-actions">
          <button type="submit" class="primary">{{editingId ? 'Cập nhật' : 'Tạo'}}</button>
          <button type="button" (click)="closeModal()">Hủy</button>
        </div>
        <p class="error" *ngIf="error()">{{error()}}</p>
      </form>
    </div>
  </div>

  <!-- Modal Detail -->
  <div class="modal-backdrop" *ngIf="detailExpense()">
    <div class="modal wide">
      <div class="detail-header">
        <h3>{{detailExpense()!.expenseCode}} — {{detailExpense()!.title}}</h3>
        <span class="badge lg" [style.background]="statusColor(detailExpense()!.paymentStatus) + '20'" [style.color]="statusColor(detailExpense()!.paymentStatus)">
          {{statusLabel(detailExpense()!.paymentStatus)}}
        </span>
      </div>
      <div class="detail-grid">
        <div><strong>Ngày chi:</strong> {{detailExpense()!.expenseDate | date:'dd/MM/yyyy'}}</div>
        <div><strong>Số tiền:</strong> <span class="amount-text">{{detailExpense()!.amount | number}}đ</span></div>
        <div><strong>Loại:</strong> {{categoryLabel(detailExpense()!.category)}}</div>
        <div><strong>Người tạo:</strong> {{detailExpense()!.createdByName}}</div>
        <div><strong>Ngày tạo:</strong> {{detailExpense()!.createdAt | date:'dd/MM/yyyy HH:mm'}}</div>
      </div>
      <div *ngIf="detailExpense()!.description"><strong>Mô tả:</strong> {{detailExpense()!.description}}</div>
      <div *ngIf="detailExpense()!.notes"><strong>Ghi chú:</strong> {{detailExpense()!.notes}}</div>

      <div *ngIf="detailExpense()!.approvedByName" class="approval-section">
        <h4>Thông tin duyệt</h4>
        <div><strong>Người duyệt:</strong> {{detailExpense()!.approvedByName}}</div>
        <div><strong>Thời gian:</strong> {{detailExpense()!.approvedAt | date:'dd/MM/yyyy HH:mm'}}</div>
        <div *ngIf="detailExpense()!.rejectionReason"><strong>Lý do từ chối:</strong> <span class="rejection-text">{{detailExpense()!.rejectionReason}}</span></div>
      </div>

      <div *ngIf="detailExpense()!.paidByName" class="payment-section">
        <h4>Thông tin chi tiền</h4>
        <div><strong>Người chi:</strong> {{detailExpense()!.paidByName}}</div>
        <div><strong>Thời gian chi:</strong> {{detailExpense()!.paidAt | date:'dd/MM/yyyy HH:mm'}}</div>
        <div><strong>Phương thức:</strong> {{paymentMethodLabel(detailExpense()!.paymentMethod!)}}</div>
      </div>

      <div class="form-actions">
        <button class="primary" (click)="openEdit(detailExpense()!); detailExpense.set(null)" *ngIf="canEdit(detailExpense()!)">Sửa</button>
        <button class="success" (click)="approveExpense(detailExpense()!)" *ngIf="canApprove(detailExpense()!)">✓ Duyệt</button>
        <button class="danger" (click)="rejectExpense(detailExpense()!)" *ngIf="canApprove(detailExpense()!)">✗ Từ chối</button>
        <button class="btn-pay" (click)="openPay(detailExpense()!); detailExpense.set(null)" *ngIf="canPay(detailExpense()!)">💰 Đánh dấu đã chi</button>
        <button type="button" (click)="detailExpense.set(null)">Đóng</button>
      </div>
    </div>
  </div>

  <!-- Modal Pay -->
  <div class="modal-backdrop" *ngIf="showPayModal()">
    <div class="modal">
      <h3>Xác nhận đã chi tiền</h3>
      <div *ngIf="payingExpense()" class="pay-info">
        <strong>{{payingExpense()!.title}}</strong>
        <div class="amount-large">{{payingExpense()!.amount | number}}đ</div>
      </div>
      <label>Phương thức thanh toán <span class="req">*</span>
        <select [(ngModel)]="payForm.paymentMethod">
          <option *ngFor="let m of paymentMethods" [value]="m.value">{{m.label}}</option>
        </select>
      </label>
      <label>Ngày chi (để trống = hôm nay)
        <input type="date" [(ngModel)]="payForm.paidAt" />
      </label>
      <label>Ghi chú thêm
        <textarea [(ngModel)]="payForm.notes" rows="2"></textarea>
      </label>
      <div class="form-actions">
        <button class="primary" (click)="submitPay()">Xác nhận</button>
        <button type="button" (click)="showPayModal.set(false)">Hủy</button>
      </div>
    </div>
  </div>
  `,
  styles: [`
    .page-header { display:flex; justify-content:space-between; align-items:center; padding:16px; }
    .stats { display:flex; gap:12px; padding:0 16px 16px; flex-wrap:wrap; }
    .stat-card { background:#fff; padding:14px 18px; border-radius:8px; min-width:140px; border-left:4px solid #e2e8f0; }
    .stat-card.total { background:#fef9c3; border-left-color:#f59e0b; }
    .stat-card.pending { background:#fef3c7; border-left-color:#f59e0b; }
    .stat-card.approved { background:#dbeafe; border-left-color:#3b82f6; }
    .stat-card.paid { background:#d1fae5; border-left-color:#10b981; }
    .stat-value { font-size:20px; font-weight:700; color:#0f172a; }
    .stat-label { font-size:12px; color:#64748b; margin-top:2px; }
    .filters { display:flex; gap:10px; padding:0 16px 12px; flex-wrap:wrap; }
    input, select, textarea { padding:6px 8px; border:1px solid #cbd5e1; border-radius:4px; font-size:13px; }
    textarea { width:100%; resize:vertical; }
    .data { width:100%; border-collapse:collapse; background:#fff; font-size:13px; }
    th, td { padding:8px 10px; border:1px solid #e2e8f0; }
    thead { background:#f1f5f9; font-size:12px; text-transform:uppercase; color:#64748b; }
    .right { text-align:right; }
    .clickable { cursor:pointer; }
    .clickable:hover { background:#f8fafc; }
    .badge { font-size:11px; padding:2px 8px; border-radius:9px; font-weight:600; white-space:nowrap; }
    .badge.lg { font-size:13px; padding:4px 12px; }
    .primary { background:#2563eb; color:#fff; border:none; padding:8px 14px; border-radius:4px; cursor:pointer; font-weight:600; }
    .success { background:#10b981; color:#fff; border:none; padding:8px 14px; border-radius:4px; cursor:pointer; font-weight:600; }
    .danger { background:#ef4444; color:#fff; border:none; padding:8px 14px; border-radius:4px; cursor:pointer; font-weight:600; }
    .btn-pay { background:#f59e0b; color:#fff; border:none; padding:8px 14px; border-radius:4px; cursor:pointer; font-weight:600; }
    .btn-sm { padding:4px 8px; border:1px solid #cbd5e1; border-radius:4px; background:#fff; cursor:pointer; font-size:12px; margin-right:2px; }
    .btn-sm.primary { color:#2563eb; border-color:#93c5fd; }
    .btn-sm.success { color:#059669; border-color:#6ee7b7; }
    .btn-sm.danger { color:#dc2626; border-color:#fca5a5; }
    .actions-cell { white-space:nowrap; }
    .modal-backdrop { position:fixed; inset:0; background:rgba(15,23,42,.55); display:flex; align-items:center; justify-content:center; z-index:100; }
    .modal { background:#fff; padding:24px; border-radius:8px; max-width:560px; width:95%; box-shadow:0 8px 24px rgba(15,23,42,.2); max-height:90vh; overflow-y:auto; }
    .modal.wide { max-width:700px; }
    .form-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin:8px 0; }
    label { display:flex; flex-direction:column; gap:4px; font-size:13px; color:#334155; margin-bottom:8px; }
    .req { color:#dc2626; }
    .form-actions { display:flex; gap:8px; justify-content:flex-end; margin-top:12px; flex-wrap:wrap; }
    .error { color:#dc2626; font-size:13px; }
    .empty-text { padding:16px; color:#64748b; }
    .detail-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; }
    .detail-grid { display:grid; grid-template-columns:1fr 1fr; gap:8px; font-size:13px; margin-bottom:12px; }
    .amount-text { color:#f59e0b; font-weight:700; font-size:15px; }
    .approval-section, .payment-section { background:#f8fafc; padding:10px 12px; border-radius:6px; margin-top:12px; font-size:13px; }
    .rejection-text { color:#ef4444; font-weight:600; }
    h4 { margin:0 0 8px; color:#334155; font-size:14px; }
    .pay-info { background:#fef9c3; padding:12px; border-radius:6px; margin-bottom:12px; text-align:center; }
    .amount-large { font-size:28px; font-weight:700; color:#f59e0b; margin-top:4px; }
  `]
})
export class ExpensesComponent implements OnInit {
  items = signal<ExpenseItem[]>([]);
  stats = signal<ExpenseStats | null>(null);
  showModal = signal(false);
  showPayModal = signal(false);
  detailExpense = signal<ExpenseItem | null>(null);
  payingExpense = signal<ExpenseItem | null>(null);
  error = signal('');
  editingId: string | null = null;

  keyword = '';
  filterStatus = '';
  filterCategory = '';
  startDate = '';
  endDate = '';

  form: any = this.emptyForm();
  payForm = { paymentMethod: 'CASH', paidAt: '', notes: '' };

  allCategories = Object.entries(CATEGORY_LABELS).map(([value, label]) => ({ value, label }));
  allStatuses = Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }));
  paymentMethods = Object.entries(PAYMENT_METHODS).map(([value, label]) => ({ value, label }));

  constructor(private expenseService: ExpenseService, private auth: AuthService) {}

  ngOnInit() {
    this.reload();
  }

  categoryLabel(c: string) { return CATEGORY_LABELS[c] || c; }
  statusLabel(s: string) { return STATUS_LABELS[s] || s; }
  statusColor(s: string) { return STATUS_COLORS[s] || '#64748b'; }
  paymentMethodLabel(m: string) { return PAYMENT_METHODS[m] || m; }

  isFinanceStaff(): boolean {
    return this.auth.hasRole([Role.DIRECTOR, Role.ACCOUNTING]);
  }

  canEdit(e: ExpenseItem): boolean {
    const user = this.auth.userSignal();
    if (!user) return false;
    if (e.paymentStatus === 'PAID') return false;
    return String(e.createdById) === String(user._id) || this.isFinanceStaff();
  }

  canApprove(e: ExpenseItem): boolean {
    return this.isFinanceStaff() && e.paymentStatus === 'PENDING_APPROVAL';
  }

  canPay(e: ExpenseItem): boolean {
    return this.isFinanceStaff() && e.paymentStatus === 'APPROVED_UNPAID';
  }

  emptyForm() {
    return { title: '', description: '', amount: 0, expenseDate: '', category: 'OTHER', notes: '' };
  }

  filtered = computed(() => {
    let list = this.items();
    const kw = this.keyword.trim().toLowerCase();
    if (kw) list = list.filter(e =>
      e.expenseCode.toLowerCase().includes(kw) || e.title.toLowerCase().includes(kw) ||
      (e.description || '').toLowerCase().includes(kw));
    if (this.filterStatus) list = list.filter(e => e.paymentStatus === this.filterStatus);
    if (this.filterCategory) list = list.filter(e => e.category === this.filterCategory);
    return list;
  });

  applyFilter() { /* triggers computed */ }

  async reload() {
    const params: any = {};
    if (this.startDate) params.startDate = this.startDate;
    if (this.endDate) params.endDate = this.endDate;

    const [result, stats] = await Promise.all([
      this.expenseService.list(params),
      this.expenseService.getStats(this.startDate, this.endDate),
    ]);
    this.items.set(result.data);
    this.stats.set(stats);
  }

  openCreate() {
    this.editingId = null;
    this.form = this.emptyForm();
    this.error.set('');
    this.showModal.set(true);
  }

  openEdit(e: ExpenseItem) {
    this.editingId = e._id;
    this.form = {
      title: e.title,
      description: e.description || '',
      amount: e.amount,
      expenseDate: e.expenseDate.split('T')[0],
      category: e.category,
      notes: e.notes || '',
    };
    this.error.set('');
    this.detailExpense.set(null);
    this.showModal.set(true);
  }

  closeModal() { this.showModal.set(false); this.editingId = null; }

  openDetail(e: ExpenseItem) { this.detailExpense.set(e); }

  openPay(e: ExpenseItem) {
    this.payingExpense.set(e);
    this.payForm = { paymentMethod: 'CASH', paidAt: '', notes: '' };
    this.showPayModal.set(true);
  }

  async submitForm() {
    if (this.editingId) {
      const res = await this.expenseService.update(this.editingId, this.form);
      if (!res.ok) { this.error.set(res.message || 'Lỗi'); return; }
    } else {
      const res = await this.expenseService.create(this.form);
      if (!res.ok) { this.error.set(res.message || 'Lỗi'); return; }
    }
    this.closeModal();
    this.reload();
  }

  async approveExpense(e: ExpenseItem) {
    if (!confirm(`Duyệt phiếu chi "${e.title}" với số tiền ${e.amount.toLocaleString()}đ?`)) return;
    const res = await this.expenseService.approve(e._id);
    if (!res.ok) { alert(res.message); return; }
    this.detailExpense.set(null);
    this.reload();
  }

  async rejectExpense(e: ExpenseItem) {
    const reason = prompt('Lý do từ chối:');
    if (!reason) return;
    const res = await this.expenseService.reject(e._id, reason);
    if (!res.ok) { alert(res.message); return; }
    this.detailExpense.set(null);
    this.reload();
  }

  async submitPay() {
    const expense = this.payingExpense();
    if (!expense) return;
    const res = await this.expenseService.markPaid(expense._id, this.payForm);
    if (!res.ok) { alert(res.message); return; }
    this.showPayModal.set(false);
    this.payingExpense.set(null);
    this.reload();
  }
}
