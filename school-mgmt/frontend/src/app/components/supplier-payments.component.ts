import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  SupplierPaymentService,
  SupplierPaymentItem,
  SupplierPaymentStats,
} from '../services/supplier-payment.service';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-supplier-payments',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="container">
      <div class="header">
        <h2>Thanh ToÃƒÆ’Ã‚Â¡n NCC</h2>
        <button class="btn btn-primary" (click)="openCreate()">+ TÃƒÂ¡Ã‚ÂºÃ‚Â¡o thanh toÃƒÆ’Ã‚Â¡n</button>
      </div>

      <!-- Stats -->
      @if (stats()) {
        <div class="stats-row">
          <div class="stat-card"><div class="stat-label">TÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¢ng</div><div class="stat-value">{{ stats()!.totalCount }}</div></div>
          <div class="stat-card pending"><div class="stat-label">ChÃƒÂ¡Ã‚Â»Ã‚Â duyÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¡t</div><div class="stat-value">{{ statusCount('PENDING_APPROVAL') }}</div></div>
          <div class="stat-card approved"><div class="stat-label">Ãƒâ€žÃ‚ÂÃƒÆ’Ã‚Â£ duyÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¡t</div><div class="stat-value">{{ statusCount('APPROVED') }}</div></div>
          <div class="stat-card paid"><div class="stat-label">Ãƒâ€žÃ‚ÂÃƒÆ’Ã‚Â£ thanh toÃƒÆ’Ã‚Â¡n</div><div class="stat-value">{{ statusCount('PAID') }}</div></div>
        </div>
      }

      <!-- Filters -->
      <div class="filters">
        <input [(ngModel)]="keyword" placeholder="TÃƒÆ’Ã‚Â¬m mÃƒÆ’Ã‚Â£, tiÃƒÆ’Ã‚Âªu Ãƒâ€žÃ¢â‚¬ËœÃƒÂ¡Ã‚Â»Ã‚Â, NCC..." (input)="load()" />
        <select [(ngModel)]="statusFilter" (change)="load()">
          <option value="">TÃƒÂ¡Ã‚ÂºÃ‚Â¥t cÃƒÂ¡Ã‚ÂºÃ‚Â£ trÃƒÂ¡Ã‚ÂºÃ‚Â¡ng thÃƒÆ’Ã‚Â¡i</option>
          <option value="PENDING_APPROVAL">ChÃƒÂ¡Ã‚Â»Ã‚Â duyÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¡t</option>
          <option value="APPROVED">Ãƒâ€žÃ‚ÂÃƒÆ’Ã‚Â£ duyÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¡t</option>
          <option value="PAID">Ãƒâ€žÃ‚ÂÃƒÆ’Ã‚Â£ TT</option>
          <option value="REJECTED">TÃƒÂ¡Ã‚Â»Ã‚Â« chÃƒÂ¡Ã‚Â»Ã¢â‚¬Ëœi</option>
        </select>
      </div>

      <!-- Table -->
      <table class="data-table">
        <thead>
          <tr>
            <th>MÃƒÆ’Ã‚Â£</th>
            <th>NgÃƒÆ’Ã‚Â y</th>
            <th>TiÃƒÆ’Ã‚Âªu Ãƒâ€žÃ¢â‚¬ËœÃƒÂ¡Ã‚Â»Ã‚Â</th>
            <th>NCC</th>
            <th>SÃƒÂ¡Ã‚Â»Ã¢â‚¬Ëœ tiÃƒÂ¡Ã‚Â»Ã‚Ân</th>
            <th>TrÃƒÂ¡Ã‚ÂºÃ‚Â¡ng thÃƒÆ’Ã‚Â¡i</th>
            <th>NgÃƒâ€ Ã‚Â°ÃƒÂ¡Ã‚Â»Ã‚Âi tÃƒÂ¡Ã‚ÂºÃ‚Â¡o</th>
            <th>Thao tÃƒÆ’Ã‚Â¡c</th>
          </tr>
        </thead>
        <tbody>
          @for (item of items(); track item._id) {
            <tr (click)="viewDetail(item)">
              <td>{{ item.paymentCode }}</td>
              <td>{{ item.paymentDate | date:'dd/MM/yyyy' }}</td>
              <td>{{ item.title }}</td>
              <td>{{ item.supplierName }}</td>
              <td>{{ item.amount | number:'1.0-0' }}Ãƒâ€žÃ¢â‚¬Ëœ</td>
              <td><span class="badge" [class]="'badge-' + item.status.toLowerCase().replace('_','-')">{{ statusLabel(item.status) }}</span></td>
              <td>{{ item.createdByName }}</td>
              <td class="actions" (click)="$event.stopPropagation()">
                @if (item.status === 'PENDING_APPROVAL') {
                  <button class="btn-sm" (click)="edit(item)">SÃƒÂ¡Ã‚Â»Ã‚Â­a</button>
                  <button class="btn-sm btn-success" (click)="approve(item)">DuyÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¡t</button>
                  <button class="btn-sm btn-danger" (click)="promptReject(item)">TÃƒÂ¡Ã‚Â»Ã‚Â« chÃƒÂ¡Ã‚Â»Ã¢â‚¬Ëœi</button>
                }
                @if (item.status === 'APPROVED') {
                  <button class="btn-sm btn-primary" (click)="openPay(item)">Thanh toÃƒÆ’Ã‚Â¡n</button>
                }
                @if (item.status !== 'PAID') {
                  <button class="btn-sm btn-danger" (click)="deleteItem(item)">XÃƒÆ’Ã‚Â³a</button>
                }
              </td>
            </tr>
          }
        </tbody>
      </table>

      <div class="pagination" *ngIf="total() > limit">
        <button [disabled]="currentPage() <= 1" (click)="goPage(currentPage() - 1)">ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¹</button>
        <span>Trang {{ currentPage() }} / {{ totalPages() }}</span>
        <button [disabled]="currentPage() >= totalPages()" (click)="goPage(currentPage() + 1)">ÃƒÂ¢Ã¢â€šÂ¬Ã‚Âº</button>
      </div>

      <!-- Create/Edit Modal -->
      @if (showModal()) {
        <div class="modal-backdrop" (click)="showModal.set(false)">
          <div class="modal" (click)="$event.stopPropagation()">
            <h3>{{ editing() ? 'SÃƒÂ¡Ã‚Â»Ã‚Â­a thanh toÃƒÆ’Ã‚Â¡n NCC' : 'TÃƒÂ¡Ã‚ÂºÃ‚Â¡o thanh toÃƒÆ’Ã‚Â¡n NCC' }}</h3>
            <div class="form-group"><label>TiÃƒÆ’Ã‚Âªu Ãƒâ€žÃ¢â‚¬ËœÃƒÂ¡Ã‚Â»Ã‚Â *</label><input [(ngModel)]="form.title" /></div>
            <div class="form-group"><label>NCC *</label><input [(ngModel)]="form.supplierName" /></div>
            <div class="form-group"><label>SÃƒâ€žÃ‚ÂT NCC</label><input [(ngModel)]="form.supplierPhone" /></div>
            <div class="form-group"><label>Email NCC</label><input [(ngModel)]="form.supplierEmail" /></div>
            <div class="form-group"><label>TK ngÃƒÆ’Ã‚Â¢n hÃƒÆ’Ã‚Â ng NCC</label><input [(ngModel)]="form.supplierBankAccount" /></div>
            <div class="form-group"><label>NgÃƒÆ’Ã‚Â¢n hÃƒÆ’Ã‚Â ng NCC</label><input [(ngModel)]="form.supplierBankName" /></div>
            <div class="form-group"><label>SÃƒÂ¡Ã‚Â»Ã¢â‚¬Ëœ tiÃƒÂ¡Ã‚Â»Ã‚Ân *</label><input type="number" [(ngModel)]="form.amount" /></div>
            <div class="form-group"><label>NgÃƒÆ’Ã‚Â y thanh toÃƒÆ’Ã‚Â¡n *</label><input type="date" [(ngModel)]="form.paymentDate" /></div>
            <div class="form-group"><label>Ghi chÃƒÆ’Ã‚Âº</label><textarea [(ngModel)]="form.notes"></textarea></div>
            <div class="modal-actions">
              <button class="btn" (click)="showModal.set(false)">HÃƒÂ¡Ã‚Â»Ã‚Â§y</button>
              <button class="btn btn-primary" (click)="save()">LÃƒâ€ Ã‚Â°u</button>
            </div>
            @if (error()) { <div class="error">{{ error() }}</div> }
          </div>
        </div>
      }

      <!-- Pay Modal -->
      @if (showPayModal()) {
        <div class="modal-backdrop" (click)="showPayModal.set(false)">
          <div class="modal" (click)="$event.stopPropagation()">
            <h3>XÃƒÆ’Ã‚Â¡c nhÃƒÂ¡Ã‚ÂºÃ‚Â­n thanh toÃƒÆ’Ã‚Â¡n</h3>
            <p><strong>{{ payingItem()?.title }}</strong> - {{ payingItem()?.amount | number:'1.0-0' }}Ãƒâ€žÃ¢â‚¬Ëœ</p>
            <div class="form-group">
              <label>PhÃƒâ€ Ã‚Â°Ãƒâ€ Ã‚Â¡ng thÃƒÂ¡Ã‚Â»Ã‚Â©c thanh toÃƒÆ’Ã‚Â¡n *</label>
              <select [(ngModel)]="payForm.paymentMethod">
                <option value="CASH">TiÃƒÂ¡Ã‚Â»Ã‚Ân mÃƒÂ¡Ã‚ÂºÃ‚Â·t</option>
                <option value="BANK_TRANSFER">ChuyÃƒÂ¡Ã‚Â»Ã†â€™n khoÃƒÂ¡Ã‚ÂºÃ‚Â£n</option>
                <option value="E_WALLET">VÃƒÆ’Ã‚Â­ Ãƒâ€žÃ¢â‚¬ËœiÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¡n tÃƒÂ¡Ã‚Â»Ã‚Â­</option>
                <option value="OTHER">KhÃƒÆ’Ã‚Â¡c</option>
              </select>
            </div>
            <div class="form-group"><label>NgÃƒÆ’Ã‚Â y thanh toÃƒÆ’Ã‚Â¡n</label><input type="date" [(ngModel)]="payForm.paidAt" /></div>
            <div class="form-group"><label>Ghi chÃƒÆ’Ã‚Âº</label><textarea [(ngModel)]="payForm.notes"></textarea></div>
            <div class="modal-actions">
              <button class="btn" (click)="showPayModal.set(false)">HÃƒÂ¡Ã‚Â»Ã‚Â§y</button>
              <button class="btn btn-primary" (click)="confirmPay()">XÃƒÆ’Ã‚Â¡c nhÃƒÂ¡Ã‚ÂºÃ‚Â­n</button>
            </div>
          </div>
        </div>
      }

      <!-- Detail Modal -->
      @if (detailItem()) {
        <div class="modal-backdrop" (click)="detailItem.set(null)">
          <div class="modal" (click)="$event.stopPropagation()">
            <h3>Chi tiÃƒÂ¡Ã‚ÂºÃ‚Â¿t {{ detailItem()!.paymentCode }}</h3>
            <p><strong>TiÃƒÆ’Ã‚Âªu Ãƒâ€žÃ¢â‚¬ËœÃƒÂ¡Ã‚Â»Ã‚Â:</strong> {{ detailItem()!.title }}</p>
            <p><strong>NCC:</strong> {{ detailItem()!.supplierName }}</p>
            <p><strong>SÃƒÂ¡Ã‚Â»Ã¢â‚¬Ëœ tiÃƒÂ¡Ã‚Â»Ã‚Ân:</strong> {{ detailItem()!.amount | number:'1.0-0' }}Ãƒâ€žÃ¢â‚¬Ëœ</p>
            <p><strong>NgÃƒÆ’Ã‚Â y:</strong> {{ detailItem()!.paymentDate | date:'dd/MM/yyyy' }}</p>
            <p><strong>TrÃƒÂ¡Ã‚ÂºÃ‚Â¡ng thÃƒÆ’Ã‚Â¡i:</strong> {{ statusLabel(detailItem()!.status) }}</p>
            <p><strong>NgÃƒâ€ Ã‚Â°ÃƒÂ¡Ã‚Â»Ã‚Âi tÃƒÂ¡Ã‚ÂºÃ‚Â¡o:</strong> {{ detailItem()!.createdByName }}</p>
            @if (detailItem()!.approvedByName) {
              <p><strong>DuyÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¡t bÃƒÂ¡Ã‚Â»Ã…Â¸i:</strong> {{ detailItem()!.approvedByName }}</p>
            }
            @if (detailItem()!.paidByName) {
              <p><strong>Thanh toÃƒÆ’Ã‚Â¡n bÃƒÂ¡Ã‚Â»Ã…Â¸i:</strong> {{ detailItem()!.paidByName }} ({{ detailItem()!.paidAt | date:'dd/MM/yyyy HH:mm' }})</p>
            }
            @if (detailItem()!.rejectionReason) {
              <p><strong>LÃƒÆ’Ã‚Â½ do tÃƒÂ¡Ã‚Â»Ã‚Â« chÃƒÂ¡Ã‚Â»Ã¢â‚¬Ëœi:</strong> {{ detailItem()!.rejectionReason }}</p>
            }
            <button class="btn" (click)="detailItem.set(null)">Ãƒâ€žÃ‚ÂÃƒÆ’Ã‚Â³ng</button>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .container { padding: 20px; }
    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
    .stats-row { display: flex; gap: 12px; margin-bottom: 16px; }
    .stat-card { background: #f5f5f5; border-radius: 8px; padding: 12px 20px; flex: 1; }
    .stat-card.pending { background: #fff3e0; }
    .stat-card.approved { background: #e8f5e9; }
    .stat-card.paid { background: #e3f2fd; }
    .stat-label { font-size: 12px; color: #666; }
    .stat-value { font-size: 20px; font-weight: 700; }
    .filters { display: flex; gap: 8px; margin-bottom: 16px; }
    .filters input, .filters select { padding: 6px 10px; border: 1px solid #ddd; border-radius: 4px; }
    .data-table { width: 100%; border-collapse: collapse; }
    .data-table th, .data-table td { padding: 8px 12px; border-bottom: 1px solid #eee; text-align: left; }
    .data-table tbody tr:hover { background: #f5f5f5; cursor: pointer; }
    .badge { padding: 2px 8px; border-radius: 10px; font-size: 12px; }
    .badge-pending-approval { background: #fff3e0; color: #e65100; }
    .badge-approved { background: #e8f5e9; color: #2e7d32; }
    .badge-paid { background: #e3f2fd; color: #1565c0; }
    .badge-rejected { background: #ffcdd2; color: #c62828; }
    .btn { padding: 6px 16px; border: 1px solid #ddd; border-radius: 4px; cursor: pointer; background: #fff; }
    .btn-primary { background: #1976d2; color: #fff; border-color: #1976d2; }
    .btn-sm { padding: 2px 8px; font-size: 12px; border: 1px solid #ddd; border-radius: 3px; cursor: pointer; background: #fff; margin-right: 4px; }
    .btn-success { background: #4caf50; color: #fff; border-color: #4caf50; }
    .btn-danger { background: #e53935; color: #fff; border-color: #e53935; }
    .actions { white-space: nowrap; }
    .modal-backdrop { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.4); display: flex; justify-content: center; align-items: flex-start; padding-top: 40px; z-index: 1000; }
    .modal { background: #fff; border-radius: 8px; padding: 24px; min-width: 500px; max-width: 700px; max-height: 80vh; overflow-y: auto; }
    .form-group { margin-bottom: 12px; }
    .form-group label { display: block; font-weight: 600; margin-bottom: 4px; }
    .form-group input, .form-group textarea, .form-group select { width: 100%; padding: 6px 10px; border: 1px solid #ddd; border-radius: 4px; }
    .form-group textarea { min-height: 60px; }
    .modal-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 16px; }
    .error { color: #c62828; margin-top: 8px; }
    .pagination { display: flex; gap: 8px; align-items: center; justify-content: center; margin-top: 16px; }
    .pagination button { padding: 4px 12px; border: 1px solid #ddd; border-radius: 4px; cursor: pointer; background: #fff; }
    .pagination button:disabled { opacity: 0.5; cursor: default; }
  `],
})
export class SupplierPaymentsComponent implements OnInit {
  private svc = inject(SupplierPaymentService);
  private auth = inject(AuthService);

  items = signal<SupplierPaymentItem[]>([]);
  stats = signal<SupplierPaymentStats | null>(null);
  total = signal(0);
  currentPage = signal(1);
  limit = 20;
  totalPages = computed(() => Math.ceil(this.total() / this.limit));

  keyword = '';
  statusFilter = '';
  showModal = signal(false);
  showPayModal = signal(false);
  editing = signal(false);
  editingId = '';
  detailItem = signal<SupplierPaymentItem | null>(null);
  payingItem = signal<SupplierPaymentItem | null>(null);
  error = signal('');

  form: any = { title: '', supplierName: '', supplierPhone: '', supplierEmail: '', supplierBankAccount: '', supplierBankName: '', amount: 0, paymentDate: '', notes: '' };
  payForm = { paymentMethod: 'BANK_TRANSFER', paidAt: '', notes: '' };

  ngOnInit() { this.load(); this.loadStats(); }

  async load() {
    const params: Record<string, string> = { page: String(this.currentPage()), limit: String(this.limit) };
    if (this.keyword) params['keyword'] = this.keyword;
    if (this.statusFilter) params['status'] = this.statusFilter;
    const res = await this.svc.list(params);
    this.items.set(res.data);
    this.total.set(res.total);
  }

  async loadStats() {
    const s = await this.svc.getStats();
    this.stats.set(s);
  }

  statusCount(status: string): number {
    return this.stats()?.byStatus?.[status]?.count || 0;
  }

  goPage(p: number) { this.currentPage.set(p); this.load(); }

  statusLabel(s: string): string {
    const map: Record<string, string> = {
      PENDING_APPROVAL: 'Chờ duyệt',
      APPROVED: 'Đã duyệt',
      PAID: 'Đã TT',
      REJECTED: 'Từ chối',
    };
    return map[s] || s;
  }

  openCreate() {
    this.editing.set(false);
    this.editingId = '';
    this.form = { title: '', supplierName: '', supplierPhone: '', supplierEmail: '', supplierBankAccount: '', supplierBankName: '', amount: 0, paymentDate: new Date().toISOString().split('T')[0], notes: '' };
    this.error.set('');
    this.showModal.set(true);
  }

  edit(item: SupplierPaymentItem) {
    this.editing.set(true);
    this.editingId = item._id;
    this.form = {
      title: item.title, supplierName: item.supplierName, supplierPhone: item.supplierPhone || '',
      supplierEmail: item.supplierEmail || '', supplierBankAccount: item.supplierBankAccount || '',
      supplierBankName: item.supplierBankName || '', amount: item.amount,
      paymentDate: item.paymentDate?.split('T')[0] || '', notes: item.notes || '',
    };
    this.error.set('');
    this.showModal.set(true);
  }

  async save() {
    try {
      if (!this.form.title || !this.form.supplierName || !this.form.amount || !this.form.paymentDate) {
        this.error.set('Vui lÃƒÆ’Ã‚Â²ng Ãƒâ€žÃ¢â‚¬ËœiÃƒÂ¡Ã‚Â»Ã‚Ân Ãƒâ€žÃ¢â‚¬ËœÃƒÂ¡Ã‚ÂºÃ‚Â§y Ãƒâ€žÃ¢â‚¬ËœÃƒÂ¡Ã‚Â»Ã‚Â§ thÃƒÆ’Ã‚Â´ng tin bÃƒÂ¡Ã‚ÂºÃ‚Â¯t buÃƒÂ¡Ã‚Â»Ã¢â€žÂ¢c');
        return;
      }
      if (this.editing()) {
        await this.svc.update(this.editingId, this.form);
      } else {
        await this.svc.create(this.form);
      }
      this.showModal.set(false);
      this.load();
      this.loadStats();
    } catch (e: any) {
      this.error.set(e?.error?.message || 'LÃƒÂ¡Ã‚Â»Ã¢â‚¬â€i khi lÃƒâ€ Ã‚Â°u');
    }
  }

  viewDetail(item: SupplierPaymentItem) { this.detailItem.set(item); }

  async approve(item: SupplierPaymentItem) {
    if (confirm('DuyÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¡t thanh toÃƒÆ’Ã‚Â¡n nÃƒÆ’Ã‚Â y?')) {
      await this.svc.approve(item._id);
      this.load();
      this.loadStats();
    }
  }

  promptReject(item: SupplierPaymentItem) {
    const reason = prompt('LÃƒÆ’Ã‚Â½ do tÃƒÂ¡Ã‚Â»Ã‚Â« chÃƒÂ¡Ã‚Â»Ã¢â‚¬Ëœi:');
    if (reason !== null) {
      this.svc.reject(item._id, reason).then(() => { this.load(); this.loadStats(); });
    }
  }

  openPay(item: SupplierPaymentItem) {
    this.payingItem.set(item);
    this.payForm = { paymentMethod: 'BANK_TRANSFER', paidAt: new Date().toISOString().split('T')[0], notes: '' };
    this.showPayModal.set(true);
  }

  async confirmPay() {
    const item = this.payingItem();
    if (!item) return;
    await this.svc.markPaid(item._id, this.payForm);
    this.showPayModal.set(false);
    this.load();
    this.loadStats();
  }

  async deleteItem(item: SupplierPaymentItem) {
    if (confirm(`XÃƒÆ’Ã‚Â³a thanh toÃƒÆ’Ã‚Â¡n ${item.paymentCode}?`)) {
      await this.svc.delete(item._id);
      this.load();
      this.loadStats();
    }
  }
}
