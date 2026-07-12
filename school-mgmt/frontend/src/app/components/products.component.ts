import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProductService, ProductItem } from '../services/product.service';
import { AuthService } from '../services/auth.service';
import { Role } from '../models/role.enum';

import { FlowGuideComponent } from './shared/flow-guide.component';

const MODE_LABELS: Record<string, string> = {
  ONLINE: 'Online',
  OFFLINE: 'Offline',
  BOTH: 'Online/Offline',
};

const SUBJECT_LABELS: Record<string, string> = {
  ENGLISH: 'Tiếng Anh',
  MATH: 'Toán',
  LITERATURE: 'Ngữ văn',
  PHYSICS: 'Vật lý',
  CHEMISTRY: 'Hóa học',
  BIOLOGY: 'Sinh học',
  HISTORY: 'Lịch sử',
  GEOGRAPHY: 'Địa lý',
  INFORMATICS: 'Tin học',
  SCIENCE: 'Khoa học',
  MULTI_SUBJECT: 'Liên môn',
  OTHER: 'Khác',
};

interface ProductForm {
  name: string;
  category: string;
  teachingMode: 'ONLINE' | 'OFFLINE';
  defaultSessions: number;
  suggestedPrice: number;
  defaultSessionDuration: number;
  description: string;
  highlightsText: string;
  isActive: boolean;
}

@Component({
  selector: 'app-products',
  standalone: true,
  imports: [CommonModule, FormsModule, FlowGuideComponent],
  template: `
  <header class="page-header">
    <div>
      <h2>Quan ly goi san pham</h2>
      <p>Bang gia, so buoi va chuong trinh uu dai de tu van phu huynh.</p>
    </div>
    <button class="primary" *ngIf="canManage()" (click)="openModal()">+ Them goi</button>
  </header>

  <app-flow-guide featureKey="products"></app-flow-guide>

  <section class="filters">
    <input placeholder="Tim ten goi" [(ngModel)]="keyword" />
    <select [(ngModel)]="filterActive">
      <option value="">Tat ca trang thai</option>
      <option value="true">Dang ban</option>
      <option value="false">Dung ban</option>
    </select>
    <button (click)="reload()">Lam moi</button>
  </section>

  <table class="data" *ngIf="filtered().length; else empty">
    <thead>
      <tr>
        <th>Ten goi</th>
        <th>Mon hoc</th>
        <th>Hinh thuc</th>
        <th>So buoi</th>
        <th>So tien</th>
        <th>Don gia/buoi</th>
        <th>Thoi luong/buoi (phut)</th>
        <th>Uu dai / ghi chu tu van</th>
        <th>Trang thai</th>
        <th *ngIf="canManage()">Hanh dong</th>
      </tr>
    </thead>
    <tbody>
      <tr *ngFor="let p of filtered()" [class.inactive]="p.isActive === false">
        <td>
          <strong>{{ p.name }}</strong>
        </td>
        <td>{{ subjectLabel(p.category) }}</td>
        <td>{{ modeLabel(p.teachingMode) }}</td>
        <td class="center">{{ p.defaultSessions || 0 }}</td>
        <td class="right">{{ (p.suggestedPrice || 0) | number }}d</td>
        <td class="right">{{ pricePerSession(p) | number }}d</td>
        <td class="center">{{ p.defaultSessionDuration || 0 }}</td>
        <td class="notes">{{ promotionText(p) }}</td>
        <td>
          <span class="badge" [class.active]="p.isActive !== false" [class.off]="p.isActive === false">
            {{ p.isActive !== false ? 'Dang ban' : 'Dung ban' }}
          </span>
        </td>
        <td class="actions-cell" *ngIf="canManage()">
          <button class="btn-sm" (click)="openEdit(p)">Sua</button>
          <button class="btn-sm danger" (click)="remove(p)">Xoa</button>
        </td>
      </tr>
    </tbody>
  </table>
  <ng-template #empty><p class="empty-text">Chua co goi san pham.</p></ng-template>

  <div class="modal-backdrop" *ngIf="showModal()">
    <div class="modal">
      <h3>{{ editingId ? 'Sua goi san pham' : 'Them goi san pham' }}</h3>
      <form (ngSubmit)="submit()">
        <label>Ten goi <span class="req">*</span>
          <input name="name" [(ngModel)]="form.name" required />
        </label>

        <label>Mon hoc
          <select name="category" [(ngModel)]="form.category">
            <option *ngFor="let subject of subjectOptions" [value]="subject.value">{{ subject.label }}</option>
          </select>
        </label>

        <label>Hinh thuc
          <select name="teachingMode" [(ngModel)]="form.teachingMode">
            <option value="ONLINE">Online</option>
            <option value="OFFLINE">Offline</option>
          </select>
        </label>

        <label>So buoi
          <input name="defaultSessions" type="number" min="1" [(ngModel)]="form.defaultSessions" />
        </label>

        <label>So tien (VND)
          <input name="suggestedPrice" type="number" min="0" [(ngModel)]="form.suggestedPrice" />
        </label>

        <label>Thoi luong buoi (phut)
          <input name="defaultSessionDuration" type="number" min="15" [(ngModel)]="form.defaultSessionDuration" />
        </label>

        <label>Uu dai / ghi chu tu van
          <textarea name="description" rows="3" [(ngModel)]="form.description" placeholder="VD: Tang 2 buoi, uu dai thang 5, dieu kien ap dung..."></textarea>
        </label>

        <label>Diem noi bat
          <textarea name="highlightsText" rows="3" [(ngModel)]="form.highlightsText" placeholder="Moi dong la mot y tu van"></textarea>
        </label>

        <label class="checkbox-label">
          <input type="checkbox" name="isActive" [(ngModel)]="form.isActive" /> Dang ban
        </label>

        <div class="actions">
          <button type="submit" class="primary">{{ editingId ? 'Cap nhat' : 'Luu' }}</button>
          <button type="button" (click)="closeModal()">Huy</button>
        </div>
        <p class="error" *ngIf="error()">{{ error() }}</p>
      </form>
    </div>
  </div>
  `,
  styles: [`
    .page-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; padding:16px; }
    .page-header h2 { margin:0 0 4px; }
    .page-header p { margin:0; color:#64748b; }
    .filters { display:flex; gap:10px; margin-bottom:16px; padding:0 16px; }
    input, select, textarea { padding:6px 8px; border:1px solid #cbd5e1; border-radius:4px; font-size:13px; }
    textarea { resize:vertical; font-family:inherit; }
    .data { width:100%; border-collapse:collapse; background:#fff; font-size:13px; }
    th, td { padding:8px 10px; border:1px solid #e2e8f0; }
    thead { background:#f1f5f9; font-size:12px; text-transform:uppercase; color:#64748b; }
    .center { text-align:center; }
    .right { text-align:right; }
    .notes { max-width:260px; white-space:pre-line; color:#334155; }
    .inactive { opacity:0.6; }
    .badge { font-size:11px; padding:2px 8px; border-radius:9px; font-weight:600; }
    .badge.active { background:#dcfce7; color:#166534; }
    .badge.off { background:#fee2e2; color:#991b1b; }
    .primary { background:#2563eb; color:#fff; border:none; padding:8px 14px; border-radius:4px; cursor:pointer; font-weight:600; }
    .btn-sm { padding:4px 10px; border:1px solid #cbd5e1; border-radius:4px; background:#fff; cursor:pointer; font-size:12px; margin-right:4px; }
    .btn-sm.danger { color:#dc2626; border-color:#fca5a5; }
    .actions-cell { white-space:nowrap; }
    .modal-backdrop { position:fixed; inset:0; background:rgba(15,23,42,.55); display:flex; align-items:center; justify-content:center; z-index:100; }
    .modal { background:#fff; padding:24px; border-radius:8px; width:420px; box-shadow:0 8px 24px rgba(15,23,42,.2); }
    .modal form { display:flex; flex-direction:column; gap:12px; }
    .modal label { display:flex; flex-direction:column; gap:4px; font-size:13px; color:#334155; }
    .checkbox-label { flex-direction:row !important; align-items:center; gap:8px; }
    .actions { display:flex; gap:8px; justify-content:flex-end; }
    .error { color:#dc2626; font-size:13px; margin:0; }
    .empty-text { padding:16px; color:#64748b; }
    .req { color:#dc2626; }
  `],
})
export class ProductsComponent {
  private productService = inject(ProductService);
  private auth = inject(AuthService);

  items = signal<ProductItem[]>([]);
  keyword = '';
  filterActive = '';
  showModal = signal(false);
  error = signal('');
  editingId: string | null = null;
  subjectOptions = Object.entries(SUBJECT_LABELS).map(([value, label]) => ({ value, label }));
  canManage = computed(() => this.auth.userSignal()?.role === Role.DIRECTOR);

  form: ProductForm = this.emptyForm();

  constructor() {
    this.reload();
  }

  modeLabel(v?: string) {
    return v ? MODE_LABELS[v] || v : '-';
  }

  subjectLabel(v?: string) {
    return v ? SUBJECT_LABELS[v] || v : '-';
  }

  emptyForm(): ProductForm {
    return {
      name: '',
      category: 'ENGLISH',
      teachingMode: 'OFFLINE',
      defaultSessions: 24,
      suggestedPrice: 0,
      defaultSessionDuration: 90,
      description: '',
      highlightsText: '',
      isActive: true,
    };
  }

  filtered = computed(() => {
    let list = this.items();
    const kw = this.keyword.trim().toLowerCase();

    if (kw) {
      list = list.filter((p) =>
        p.name.toLowerCase().includes(kw),
      );
    }

    if (this.filterActive === 'true') list = list.filter((p) => p.isActive !== false);
    if (this.filterActive === 'false') list = list.filter((p) => p.isActive === false);
    return list;
  });

  openModal() {
    if (!this.canManage()) return;
    this.editingId = null;
    this.form = this.emptyForm();
    this.error.set('');
    this.showModal.set(true);
  }

  openEdit(p: ProductItem) {
    if (!this.canManage()) return;
    this.editingId = p._id;
    this.form = {
      name: p.name || '',
      category: p.category || 'ENGLISH',
      teachingMode: (p.teachingMode === 'ONLINE' ? 'ONLINE' : 'OFFLINE'),
      defaultSessions: p.defaultSessions || 24,
      suggestedPrice: p.suggestedPrice || 0,
      defaultSessionDuration: p.defaultSessionDuration || 90,
      description: p.description || '',
      highlightsText: (p.highlights || []).join('\n'),
      isActive: p.isActive !== false,
    };
    this.error.set('');
    this.showModal.set(true);
  }

  closeModal() {
    this.showModal.set(false);
    this.editingId = null;
  }

  async reload() {
    const data = await this.productService.list();
    this.items.set(data);
  }

  async submit() {
    if (!this.canManage()) return;
    const sessions = Number(this.form.defaultSessions || 0);
    const totalPrice = Number(this.form.suggestedPrice || 0);

    if (!this.form.name.trim()) {
      this.error.set('Ten goi la bat buoc');
      return;
    }

    if (sessions < 1) {
      this.error.set('So buoi phai >= 1');
      return;
    }

    if (this.form.defaultSessionDuration < 15) {
      this.error.set('Thoi luong buoi phai >= 15 phut');
      return;
    }

    if (totalPrice < 0) {
      this.error.set('So tien khong hop le');
      return;
    }

    const payload: Partial<ProductItem> = {
      name: this.form.name.trim(),
      category: this.form.category || 'ENGLISH',
      teachingMode: this.form.teachingMode,
      defaultSessions: sessions,
      suggestedPrice: totalPrice,
      defaultSessionDuration: Number(this.form.defaultSessionDuration),
      description: this.form.description.trim(),
      highlights: this.form.highlightsText
        .split('\n')
        .map((item) => item.trim())
        .filter(Boolean),
      isActive: !!this.form.isActive,
      // Keep compatibility for old flows still reading price per session.
      pricePerSession: sessions > 0 ? Math.round(totalPrice / sessions) : 0,
    };

    if (this.editingId) {
      const result = await this.productService.update(this.editingId, payload);
      if (!result.ok) {
        this.error.set(result.message || 'Khong the cap nhat goi');
        return;
      }
    } else {
      const result = await this.productService.create(payload);
      if (!result.ok) {
        this.error.set(result.message || 'Khong the tao goi');
        return;
      }
    }

    this.closeModal();
    await this.reload();
  }

  async remove(p: ProductItem) {
    if (!this.canManage()) return;
    if (!confirm(`Xoa goi "${p.name}"?`)) return;
    await this.productService.remove(p._id);
    await this.reload();
  }

  pricePerSession(p: ProductItem): number {
    if (p.pricePerSession) return p.pricePerSession;
    const sessions = Number(p.defaultSessions || 0);
    return sessions > 0 ? Math.round(Number(p.suggestedPrice || 0) / sessions) : 0;
  }

  promotionText(p: ProductItem): string {
    const lines = [
      ...(p.highlights || []),
      p.description || '',
    ].map((item) => item.trim()).filter(Boolean);
    return lines.length ? lines.join('\n') : '-';
  }
}
