import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgentService, AgentItem } from '../services/agent.service';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-agents',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="container">
      <div class="header">
        <h2>Danh Sách Đại Lý</h2>
        @if (canManage()) {
          <button class="btn btn-primary" data-testid="agents-create-button" (click)="openCreate()">+ Thêm đại lý</button>
        }
      </div>

      <div class="filters">
        <input
          [(ngModel)]="keyword"
          placeholder="Tìm mã, tên, liên hệ, SĐT..."
          data-testid="agents-keyword-filter"
          (input)="load()"
        />
        <select [(ngModel)]="statusFilter" data-testid="agents-status-filter" (change)="load()">
          <option value="">Tất cả trạng thái</option>
          <option value="ACTIVE">Hoạt động</option>
          <option value="INACTIVE">Ngừng HĐ</option>
          <option value="SUSPENDED">Tạm ngừng</option>
        </select>
        <select [(ngModel)]="tierFilter" data-testid="agents-tier-filter" (change)="load()">
          <option value="">Tất cả hạng</option>
          <option value="SILVER">Silver</option>
          <option value="GOLD">Gold</option>
          <option value="PLATINUM">Platinum</option>
        </select>
      </div>

      <table class="data-table">
        <thead>
          <tr>
            <th>Mã</th>
            <th>Tên đại lý</th>
            <th>Người liên hệ</th>
            <th>SĐT</th>
            <th>Hạng</th>
            <th>Hoa hồng %</th>
            <th>Trạng thái</th>
            <th>Thao tác</th>
          </tr>
        </thead>
        <tbody>
          @for (item of items(); track item._id) {
            <tr [attr.data-testid]="'agents-row-' + item._id" (click)="viewDetail(item)">
              <td>{{ item.agentCode }}</td>
              <td data-testid="agents-row-name">{{ item.name }}</td>
              <td>{{ item.contactPerson }}</td>
              <td>{{ item.phone }}</td>
              <td>
                <span class="tier-badge" data-testid="agents-row-tier" [class]="'tier-' + item.tier.toLowerCase()">
                  {{ item.tier }}
                </span>
              </td>
              <td data-testid="agents-row-commission">{{ item.commissionRate }}%</td>
              <td><span class="badge" [class]="'badge-' + item.status.toLowerCase()">{{ statusLabel(item.status) }}</span></td>
              <td class="actions" (click)="$event.stopPropagation()">
                @if (canManage()) {
                  <button class="btn-sm" [attr.data-testid]="'agents-edit-' + item._id" (click)="edit(item)">Sửa</button>
                  @if (item.status !== 'SUSPENDED') {
                    <button class="btn-sm btn-warning" [attr.data-testid]="'agents-suspend-' + item._id" (click)="suspend(item)">Tạm ngừng</button>
                  }
                  @if (item.status !== 'ACTIVE') {
                    <button class="btn-sm btn-success" [attr.data-testid]="'agents-activate-' + item._id" (click)="activate(item)">Kích hoạt</button>
                  }
                }
                @if (isDirector()) {
                  <button class="btn-sm btn-danger" [attr.data-testid]="'agents-delete-' + item._id" (click)="deleteItem(item)">Xóa</button>
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

      @if (showModal()) {
        <div class="modal-backdrop" (click)="showModal.set(false)">
          <div class="modal" data-testid="agents-form-modal" (click)="$event.stopPropagation()">
            <h3>{{ editing() ? 'Sửa đại lý' : 'Thêm đại lý' }}</h3>
            <div class="form-group"><label>Tên đại lý *</label><input name="name" [(ngModel)]="form.name" /></div>
            <div class="form-group"><label>Người liên hệ</label><input name="contactPerson" [(ngModel)]="form.contactPerson" /></div>
            <div class="form-group"><label>SĐT</label><input name="phone" [(ngModel)]="form.phone" /></div>
            <div class="form-group"><label>Email</label><input name="email" [(ngModel)]="form.email" /></div>
            <div class="form-group"><label>Địa chỉ</label><input name="address" [(ngModel)]="form.address" /></div>
            <div class="form-group"><label>Mã số thuế</label><input name="taxCode" [(ngModel)]="form.taxCode" /></div>
            <div class="form-group"><label>Ngân hàng</label><input name="bankName" [(ngModel)]="form.bankName" /></div>
            <div class="form-group"><label>Số TK</label><input name="bankAccount" [(ngModel)]="form.bankAccount" /></div>
            <div class="form-group"><label>Chủ TK</label><input name="bankAccountHolder" [(ngModel)]="form.bankAccountHolder" /></div>
            <div class="form-group">
              <label>Hạng</label>
              <select name="tier" data-testid="agents-tier-select" [(ngModel)]="form.tier">
                <option value="SILVER">Silver</option>
                <option value="GOLD">Gold</option>
                <option value="PLATINUM">Platinum</option>
              </select>
            </div>
            <div class="form-group">
              <label>Hoa hồng (%)</label>
              <input
                type="number"
                name="commissionRate"
                data-testid="agents-commission-input"
                [(ngModel)]="form.commissionRate"
                min="0"
                max="100"
              />
            </div>
            <div class="form-group"><label>Ghi chú</label><textarea name="notes" [(ngModel)]="form.notes"></textarea></div>
            <div class="modal-actions">
              <button class="btn" data-testid="agents-cancel" (click)="showModal.set(false)">Hủy</button>
              <button class="btn btn-primary" data-testid="agents-save" (click)="save()">Lưu</button>
            </div>
            @if (error()) { <div class="error">{{ error() }}</div> }
          </div>
        </div>
      }

      @if (detailItem()) {
        <div class="modal-backdrop" (click)="detailItem.set(null)">
          <div class="modal" data-testid="agents-detail-modal" (click)="$event.stopPropagation()">
            <h3>Chi tiết đại lý {{ detailItem()!.agentCode }}</h3>
            <p><strong>Tên:</strong> {{ detailItem()!.name }}</p>
            <p><strong>Liên hệ:</strong> {{ detailItem()!.contactPerson }}</p>
            <p><strong>SĐT:</strong> {{ detailItem()!.phone }}</p>
            <p><strong>Email:</strong> {{ detailItem()!.email }}</p>
            <p><strong>Địa chỉ:</strong> {{ detailItem()!.address }}</p>
            <p><strong>MST:</strong> {{ detailItem()!.taxCode }}</p>
            <p><strong>Ngân hàng:</strong> {{ detailItem()!.bankName }} - {{ detailItem()!.bankAccount }}</p>
            <p><strong>Hạng:</strong> {{ detailItem()!.tier }}</p>
            <p><strong>Hoa hồng:</strong> {{ detailItem()!.commissionRate }}%</p>
            <p><strong>Tổng giới thiệu:</strong> {{ detailItem()!.totalReferred }}</p>
            <p><strong>Tổng HH đã trả:</strong> {{ detailItem()!.totalCommissionPaid | number:'1.0-0' }}đ</p>
            <p><strong>Trạng thái:</strong> {{ statusLabel(detailItem()!.status) }}</p>
            <p><strong>Người tạo:</strong> {{ detailItem()!.createdByName }}</p>
            <button class="btn" data-testid="agents-detail-close" (click)="detailItem.set(null)">Đóng</button>
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
    .badge-active { background: #c8e6c9; color: #2e7d32; }
    .badge-inactive { background: #e0e0e0; color: #616161; }
    .badge-suspended { background: #ffcdd2; color: #c62828; }
    .tier-badge { padding: 2px 8px; border-radius: 10px; font-size: 12px; font-weight: 600; }
    .tier-silver { background: #e0e0e0; color: #616161; }
    .tier-gold { background: #fff8e1; color: #f57f17; }
    .tier-platinum { background: #e8eaf6; color: #283593; }
    .btn { padding: 6px 16px; border: 1px solid #ddd; border-radius: 4px; cursor: pointer; background: #fff; }
    .btn-primary { background: #1976d2; color: #fff; border-color: #1976d2; }
    .btn-sm { padding: 2px 8px; font-size: 12px; border: 1px solid #ddd; border-radius: 3px; cursor: pointer; background: #fff; margin-right: 4px; }
    .btn-success { background: #4caf50; color: #fff; border-color: #4caf50; }
    .btn-danger { background: #e53935; color: #fff; border-color: #e53935; }
    .btn-warning { background: #ff9800; color: #fff; border-color: #ff9800; }
    .actions { white-space: nowrap; }
    .modal-backdrop {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.4);
      display: flex;
      justify-content: center;
      align-items: flex-start;
      padding-top: 40px;
      z-index: 1000;
    }
    .modal {
      background: #fff;
      border-radius: 8px;
      padding: 24px;
      min-width: 500px;
      max-width: 700px;
      max-height: 80vh;
      overflow-y: auto;
    }
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
export class AgentsComponent implements OnInit {
  private svc = inject(AgentService);
  private auth = inject(AuthService);

  items = signal<AgentItem[]>([]);
  total = signal(0);
  currentPage = signal(1);
  limit = 20;
  totalPages = computed(() => Math.ceil(this.total() / this.limit));

  keyword = '';
  statusFilter = '';
  tierFilter = '';
  showModal = signal(false);
  editing = signal(false);
  editingId = '';
  detailItem = signal<AgentItem | null>(null);
  error = signal('');

  form: any = {
    name: '',
    contactPerson: '',
    phone: '',
    email: '',
    address: '',
    taxCode: '',
    bankName: '',
    bankAccount: '',
    bankAccountHolder: '',
    tier: 'SILVER',
    commissionRate: 0,
    notes: '',
  };

  ngOnInit() {
    this.load();
  }

  canManage(): boolean {
    const role = this.auth.userSignal()?.role;
    return role === 'DIRECTOR' || role === 'OPS';
  }

  isDirector(): boolean {
    return this.auth.userSignal()?.role === 'DIRECTOR';
  }

  async load() {
    const params: Record<string, string> = {
      page: String(this.currentPage()),
      limit: String(this.limit),
    };
    if (this.keyword) params['keyword'] = this.keyword;
    if (this.statusFilter) params['status'] = this.statusFilter;
    if (this.tierFilter) params['tier'] = this.tierFilter;
    const res = await this.svc.list(params);
    this.items.set(res.data);
    this.total.set(res.total);
  }

  goPage(p: number) {
    this.currentPage.set(p);
    this.load();
  }

  statusLabel(s: string): string {
    const map: Record<string, string> = {
      ACTIVE: 'Hoạt động',
      INACTIVE: 'Ngừng HĐ',
      SUSPENDED: 'Tạm ngừng',
    };
    return map[s] || s;
  }

  openCreate() {
    this.editing.set(false);
    this.editingId = '';
    this.form = {
      name: '',
      contactPerson: '',
      phone: '',
      email: '',
      address: '',
      taxCode: '',
      bankName: '',
      bankAccount: '',
      bankAccountHolder: '',
      tier: 'SILVER',
      commissionRate: 0,
      notes: '',
    };
    this.error.set('');
    this.showModal.set(true);
  }

  edit(item: AgentItem) {
    this.editing.set(true);
    this.editingId = item._id;
    this.form = {
      name: item.name,
      contactPerson: item.contactPerson || '',
      phone: item.phone || '',
      email: item.email || '',
      address: item.address || '',
      taxCode: item.taxCode || '',
      bankName: item.bankName || '',
      bankAccount: item.bankAccount || '',
      bankAccountHolder: item.bankAccountHolder || '',
      tier: item.tier,
      commissionRate: item.commissionRate,
      notes: item.notes || '',
    };
    this.error.set('');
    this.showModal.set(true);
  }

  async save() {
    try {
      if (!this.form.name) {
        this.error.set('Vui lòng nhập tên đại lý');
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

  viewDetail(item: AgentItem) {
    this.detailItem.set(item);
  }

  async suspend(item: AgentItem) {
    if (confirm(`Tạm ngừng đại lý ${item.name}?`)) {
      await this.svc.suspend(item._id);
      this.load();
    }
  }

  async activate(item: AgentItem) {
    if (confirm(`Kích hoạt đại lý ${item.name}?`)) {
      await this.svc.activate(item._id);
      this.load();
    }
  }

  async deleteItem(item: AgentItem) {
    if (confirm(`Xóa đại lý ${item.name}?`)) {
      await this.svc.delete(item._id);
      this.load();
    }
  }
}
