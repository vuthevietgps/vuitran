import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  SupplierQuoteService,
  SupplierQuoteItem,
} from '../services/supplier-quote.service';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-supplier-quotes',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="container">
      <div class="header">
        <h2>Báo Giá NCC</h2>
        <button class="btn btn-primary" (click)="openCreate()">+ Tạo báo giá</button>
      </div>

      <!-- Filters -->
      <div class="filters">
        <input [(ngModel)]="keyword" placeholder="Tìm mã, tiêu đề, NCC..." (input)="load()" />
        <select [(ngModel)]="statusFilter" (change)="load()">
          <option value="">Tất cả trạng thái</option>
          <option value="DRAFT">Nháp</option>
          <option value="SENT">Đã gửi</option>
          <option value="ACCEPTED">Đã duyệt</option>
          <option value="REJECTED">Từ chối</option>
          <option value="EXPIRED">Hết hạn</option>
        </select>
      </div>

      <!-- Table -->
      <table class="data-table">
        <thead>
          <tr>
            <th>Mã</th>
            <th>Ngày</th>
            <th>Tiêu đề</th>
            <th>NCC</th>
            <th>Tổng tiền</th>
            <th>Trạng thái</th>
            <th>Thao tác</th>
          </tr>
        </thead>
        <tbody>
          @for (item of items(); track item._id) {
            <tr (click)="viewDetail(item)">
              <td>{{ item.quoteCode }}</td>
              <td>{{ item.quoteDate | date:'dd/MM/yyyy' }}</td>
              <td>{{ item.title }}</td>
              <td>{{ item.supplierName }}</td>
              <td>{{ item.totalAmount | number:'1.0-0' }}đ</td>
              <td><span class="badge" [class]="'badge-' + item.status.toLowerCase()">{{ statusLabel(item.status) }}</span></td>
              <td class="actions" (click)="$event.stopPropagation()">
                @if (item.status === 'DRAFT') {
                  <button class="btn-sm" (click)="edit(item)">Sửa</button>
                  <button class="btn-sm btn-info" (click)="send(item)">Gửi</button>
                }
                @if (item.status === 'DRAFT' || item.status === 'SENT') {
                  <button class="btn-sm btn-success" (click)="accept(item)">Duyệt</button>
                  <button class="btn-sm btn-danger" (click)="promptReject(item)">Từ chối</button>
                }
                @if (item.status !== 'ACCEPTED') {
                  <button class="btn-sm btn-danger" (click)="deleteItem(item)">Xóa</button>
                }
              </td>
            </tr>
          }
        </tbody>
      </table>

      <div class="pagination" *ngIf="total() > limit">
        <button [disabled]="currentPage() <= 1" (click)="goPage(currentPage() - 1)">‹</button>
        <span>Trang {{ currentPage() }} / {{ totalPages() }}</span>
        <button [disabled]="currentPage() >= totalPages()" (click)="goPage(currentPage() + 1)">›</button>
      </div>

      <!-- Create/Edit Modal -->
      @if (showModal()) {
        <div class="modal-backdrop" (click)="showModal.set(false)">
          <div class="modal" (click)="$event.stopPropagation()">
            <h3>{{ editing() ? 'Sửa báo giá' : 'Tạo báo giá' }}</h3>
            <div class="form-group"><label>Tiêu đề *</label><input [(ngModel)]="form.title" /></div>
            <div class="form-group"><label>NCC *</label><input [(ngModel)]="form.supplierName" /></div>
            <div class="form-group"><label>SĐT NCC</label><input [(ngModel)]="form.supplierPhone" /></div>
            <div class="form-group"><label>Email NCC</label><input [(ngModel)]="form.supplierEmail" /></div>
            <div class="form-group"><label>Địa chỉ NCC</label><input [(ngModel)]="form.supplierAddress" /></div>
            <div class="form-group"><label>Ngày báo giá *</label><input type="date" [(ngModel)]="form.quoteDate" /></div>
            <div class="form-group"><label>Có hiệu lực đến</label><input type="date" [(ngModel)]="form.validUntil" /></div>
            <div class="form-group"><label>Ghi chú</label><textarea [(ngModel)]="form.notes"></textarea></div>

            <h4>Hạng mục</h4>
            @for (item of form.items; track item; let i = $index) {
              <div class="line-item">
                <input placeholder="Tên" [(ngModel)]="item.itemName" />
                <input type="number" placeholder="SL" [(ngModel)]="item.quantity" style="width:60px" />
                <input placeholder="ĐVT" [(ngModel)]="item.unit" style="width:60px" />
                <input type="number" placeholder="Đơn giá" [(ngModel)]="item.unitPrice" style="width:100px" />
                <button class="btn-sm btn-danger" (click)="form.items.splice(i, 1)">x</button>
              </div>
            }
            <button class="btn-sm" (click)="form.items.push({itemName:'',quantity:1,unit:'',unitPrice:0})">+ Thêm hạng mục</button>

            <div class="modal-actions">
              <button class="btn" (click)="showModal.set(false)">Hủy</button>
              <button class="btn btn-primary" (click)="save()">Lưu</button>
            </div>
            @if (error()) { <div class="error">{{ error() }}</div> }
          </div>
        </div>
      }

      <!-- Detail Modal -->
      @if (detailItem()) {
        <div class="modal-backdrop" (click)="detailItem.set(null)">
          <div class="modal" (click)="$event.stopPropagation()">
            <h3>Chi tiết báo giá {{ detailItem()!.quoteCode }}</h3>
            <p><strong>Tiêu đề:</strong> {{ detailItem()!.title }}</p>
            <p><strong>NCC:</strong> {{ detailItem()!.supplierName }}</p>
            <p><strong>Ngày:</strong> {{ detailItem()!.quoteDate | date:'dd/MM/yyyy' }}</p>
            <p><strong>Tổng:</strong> {{ detailItem()!.totalAmount | number:'1.0-0' }}đ</p>
            <p><strong>Trạng thái:</strong> {{ statusLabel(detailItem()!.status) }}</p>
            @if (detailItem()!.items.length) {
              <table class="data-table">
                <thead><tr><th>Tên</th><th>SL</th><th>ĐVT</th><th>Đơn giá</th><th>Thành tiền</th></tr></thead>
                <tbody>
                  @for (li of detailItem()!.items; track $index) {
                    <tr><td>{{li.itemName}}</td><td>{{li.quantity}}</td><td>{{li.unit}}</td><td>{{li.unitPrice | number:'1.0-0'}}đ</td><td>{{li.totalPrice | number:'1.0-0'}}đ</td></tr>
                  }
                </tbody>
              </table>
            }
            @if (detailItem()!.approvedByName) {
              <p><strong>Duyệt bởi:</strong> {{ detailItem()!.approvedByName }} ({{ detailItem()!.approvedAt | date:'dd/MM/yyyy HH:mm' }})</p>
            }
            @if (detailItem()!.rejectionReason) {
              <p><strong>Lý do từ chối:</strong> {{ detailItem()!.rejectionReason }}</p>
            }
            <button class="btn" (click)="detailItem.set(null)">Đóng</button>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .container { padding: 20px; }
    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
    .filters { display: flex; gap: 8px; margin-bottom: 16px; }
    .filters input, .filters select { padding: 6px 10px; border: 1px solid #ddd; border-radius: 4px; }
    .data-table { width: 100%; border-collapse: collapse; }
    .data-table th, .data-table td { padding: 8px 12px; border-bottom: 1px solid #eee; text-align: left; }
    .data-table tbody tr:hover { background: #f5f5f5; cursor: pointer; }
    .badge { padding: 2px 8px; border-radius: 10px; font-size: 12px; }
    .badge-draft { background: #e0e0e0; }
    .badge-sent { background: #bbdefb; color: #1565c0; }
    .badge-accepted { background: #c8e6c9; color: #2e7d32; }
    .badge-rejected { background: #ffcdd2; color: #c62828; }
    .badge-expired { background: #fff9c4; color: #f57f17; }
    .btn { padding: 6px 16px; border: 1px solid #ddd; border-radius: 4px; cursor: pointer; background: #fff; }
    .btn-primary { background: #1976d2; color: #fff; border-color: #1976d2; }
    .btn-sm { padding: 2px 8px; font-size: 12px; border: 1px solid #ddd; border-radius: 3px; cursor: pointer; background: #fff; margin-right: 4px; }
    .btn-success { background: #4caf50; color: #fff; border-color: #4caf50; }
    .btn-danger { background: #e53935; color: #fff; border-color: #e53935; }
    .btn-info { background: #2196f3; color: #fff; border-color: #2196f3; }
    .actions { white-space: nowrap; }
    .modal-backdrop { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.4); display: flex; justify-content: center; align-items: flex-start; padding-top: 40px; z-index: 1000; }
    .modal { background: #fff; border-radius: 8px; padding: 24px; min-width: 500px; max-width: 700px; max-height: 80vh; overflow-y: auto; }
    .form-group { margin-bottom: 12px; }
    .form-group label { display: block; font-weight: 600; margin-bottom: 4px; }
    .form-group input, .form-group textarea, .form-group select { width: 100%; padding: 6px 10px; border: 1px solid #ddd; border-radius: 4px; }
    .form-group textarea { min-height: 60px; }
    .modal-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 16px; }
    .line-item { display: flex; gap: 6px; margin-bottom: 6px; align-items: center; }
    .line-item input { flex: 1; padding: 4px 6px; border: 1px solid #ddd; border-radius: 3px; }
    .error { color: #c62828; margin-top: 8px; }
    .pagination { display: flex; gap: 8px; align-items: center; justify-content: center; margin-top: 16px; }
    .pagination button { padding: 4px 12px; border: 1px solid #ddd; border-radius: 4px; cursor: pointer; background: #fff; }
    .pagination button:disabled { opacity: 0.5; cursor: default; }
  `],
})
export class SupplierQuotesComponent implements OnInit {
  private svc = inject(SupplierQuoteService);
  private auth = inject(AuthService);

  items = signal<SupplierQuoteItem[]>([]);
  total = signal(0);
  currentPage = signal(1);
  limit = 20;
  totalPages = computed(() => Math.ceil(this.total() / this.limit));

  keyword = '';
  statusFilter = '';
  showModal = signal(false);
  editing = signal(false);
  editingId = '';
  detailItem = signal<SupplierQuoteItem | null>(null);
  error = signal('');

  form: any = { title: '', supplierName: '', supplierPhone: '', supplierEmail: '', supplierAddress: '', quoteDate: '', validUntil: '', notes: '', items: [] };

  ngOnInit() { this.load(); }

  async load() {
    const params: Record<string, string> = { page: String(this.currentPage()), limit: String(this.limit) };
    if (this.keyword) params['keyword'] = this.keyword;
    if (this.statusFilter) params['status'] = this.statusFilter;
    const res = await this.svc.list(params);
    this.items.set(res.data);
    this.total.set(res.total);
  }

  goPage(p: number) { this.currentPage.set(p); this.load(); }

  statusLabel(s: string): string {
    const map: Record<string, string> = { DRAFT: 'Nháp', SENT: 'Đã gửi', ACCEPTED: 'Đã duyệt', REJECTED: 'Từ chối', EXPIRED: 'Hết hạn' };
    return map[s] || s;
  }

  openCreate() {
    this.editing.set(false);
    this.editingId = '';
    this.form = { title: '', supplierName: '', supplierPhone: '', supplierEmail: '', supplierAddress: '', quoteDate: new Date().toISOString().split('T')[0], validUntil: '', notes: '', items: [{ itemName: '', quantity: 1, unit: '', unitPrice: 0 }] };
    this.error.set('');
    this.showModal.set(true);
  }

  edit(item: SupplierQuoteItem) {
    this.editing.set(true);
    this.editingId = item._id;
    this.form = {
      title: item.title, supplierName: item.supplierName, supplierPhone: item.supplierPhone || '',
      supplierEmail: item.supplierEmail || '', supplierAddress: item.supplierAddress || '',
      quoteDate: item.quoteDate?.split('T')[0] || '', validUntil: item.validUntil?.split('T')[0] || '',
      notes: item.notes || '', items: item.items?.map(i => ({ ...i })) || [],
    };
    this.error.set('');
    this.showModal.set(true);
  }

  async save() {
    try {
      if (!this.form.title || !this.form.supplierName || !this.form.quoteDate) {
        this.error.set('Vui lòng điền đầy đủ thông tin bắt buộc');
        return;
      }
      if (this.editing()) {
        await this.svc.update(this.editingId, this.form);
      } else {
        await this.svc.create(this.form);
      }
      this.showModal.set(false);
      this.load();
    } catch (e: any) {
      this.error.set(e?.error?.message || 'Lỗi khi lưu');
    }
  }

  viewDetail(item: SupplierQuoteItem) { this.detailItem.set(item); }

  async send(item: SupplierQuoteItem) {
    if (confirm('Gửi báo giá này?')) {
      await this.svc.markSent(item._id);
      this.load();
    }
  }

  async accept(item: SupplierQuoteItem) {
    if (confirm('Duyệt báo giá này?')) {
      await this.svc.accept(item._id);
      this.load();
    }
  }

  promptReject(item: SupplierQuoteItem) {
    const reason = prompt('Lý do từ chối:');
    if (reason !== null) {
      this.svc.reject(item._id, reason).then(() => this.load());
    }
  }

  async deleteItem(item: SupplierQuoteItem) {
    if (confirm(`Xóa báo giá ${item.quoteCode}?`)) {
      await this.svc.delete(item._id);
      this.load();
    }
  }
}
