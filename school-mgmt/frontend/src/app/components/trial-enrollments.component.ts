import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../services/auth.service';
import { ClassItem, ClassService } from '../services/class.service';
import { ProductItem, ProductService } from '../services/product.service';
import { TrialEnrollmentItem, TrialEnrollmentPayload, TrialEnrollmentService, TrialEnrollmentStatus } from '../services/trial-enrollment.service';
import { UserItem, UserService } from '../services/user.service';

interface TrialForm {
  studentName: string;
  studentPhone: string;
  parentName: string;
  parentPhone: string;
  parentEmail: string;
  classId: string;
  productId: string;
  saleId: string;
  status: TrialEnrollmentStatus;
  maxTrialSessions: number;
  trialSessionsUsed: number;
  notes: string;
}

const STATUS_OPTIONS: TrialEnrollmentStatus[] = ['PENDING_TRIAL', 'WAITING_DECISION', 'CONVERTED', 'REJECTED'];

@Component({
  selector: 'app-trial-enrollments',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <header class="page-header">
      <div>
        <p class="eyebrow">Workflow hoc thu</p>
        <h2>Hoc thu offline</h2>
        <p>Quan ly hoc thu truoc hoa don, giu 2 buoi dau rieng, va chuyen sang hoc vien chinh thuc khi da chot.</p>
      </div>
      <div class="header-actions">
        <button class="secondary" type="button" (click)="reload()" [disabled]="loading()">Lam moi</button>
        <button class="primary" type="button" (click)="openCreate()" *ngIf="canCreate()">+ Tao hoc thu</button>
      </div>
    </header>

    <section class="info-banner">
      <div>
        <strong>Quy tac mo ta:</strong>
        <span>hoc thu khong vao roster chinh cho toi khi chot deng ky, nhung van co the diem danh va doi soat rieng.</span>
      </div>
      <div class="banner-note">
        Sale tao ban ghi, OPS/Director chot trang thai, he thong se giu lich su hoc thu de doi soat lương va bao cao.
      </div>
    </section>

    <section class="summary-grid">
      <article class="summary-card accent">
        <span class="summary-label">Tong</span>
        <strong>{{ summary().total }}</strong>
      </article>
      <article class="summary-card">
        <span class="summary-label">Dang hoc</span>
        <strong>{{ summary().active }}</strong>
      </article>
      <article class="summary-card">
        <span class="summary-label">Cho quyet dinh</span>
        <strong>{{ summary().waiting }}</strong>
      </article>
      <article class="summary-card success">
        <span class="summary-label">Da chot</span>
        <strong>{{ summary().converted }}</strong>
      </article>
      <article class="summary-card danger">
        <span class="summary-label">Khong tiep tuc</span>
        <strong>{{ summary().rejected }}</strong>
      </article>
    </section>

    <section class="filters">
      <input placeholder="Tim theo ten HS, PH, SDT, ma hoc thu..." [(ngModel)]="keyword" />
      <select [(ngModel)]="statusFilter">
        <option value="">Tat ca trang thai</option>
        <option *ngFor="let status of statusOptions" [value]="status">{{ statusLabel(status) }}</option>
      </select>
      <select [(ngModel)]="classFilter">
        <option value="">Tat ca lop</option>
        <option *ngFor="let cls of offlineClasses()" [value]="cls._id">{{ classLabel(cls) }}</option>
      </select>
      <select [(ngModel)]="productFilter">
        <option value="">Tat ca goi</option>
        <option *ngFor="let product of offlineProducts()" [value]="product._id">{{ productLabel(product) }}</option>
      </select>
    </section>

    <div class="table-wrap" *ngIf="filteredItems().length; else emptyState">
      <table class="data">
        <thead>
          <tr>
            <th>Ma hoc thu</th>
            <th>Hoc vien</th>
            <th>PH</th>
            <th>Lop / goi</th>
            <th>Sale</th>
            <th>Buoi</th>
            <th>Trang thai</th>
            <th>Cap nhat</th>
            <th>Hanh dong</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let item of filteredItems()">
            <td>
              <strong>{{ trialCode(item) }}</strong>
              <div class="muted-line">{{ item.createdAt | date:'dd/MM/yyyy' }}</div>
            </td>
            <td>
              <div class="primary-text">{{ item.studentName }}</div>
              <div class="muted-line" *ngIf="item.studentPhone">{{ item.studentPhone }}</div>
            </td>
            <td>
              <div>{{ item.parentName || '-' }}</div>
              <div class="muted-line" *ngIf="item.parentPhone">{{ item.parentPhone }}</div>
              <div class="muted-line" *ngIf="item.parentEmail">{{ item.parentEmail }}</div>
            </td>
            <td>
              <div>{{ classLabelByRef(item.classId) }}</div>
              <div class="muted-line">{{ productLabelByRef(item.productId) }}</div>
            </td>
            <td>{{ saleLabelByRef(item.saleId) }}</td>
            <td>
              <span class="session-pill">{{ item.trialSessionsUsed || 0 }}/{{ item.maxTrialSessions || 2 }}</span>
            </td>
            <td>
              <span class="badge" [style.background]="statusColor(item.status) + '20'" [style.color]="statusColor(item.status)">
                {{ statusLabel(item.status) }}
              </span>
            </td>
            <td>
              <div>{{ item.updatedAt ? (item.updatedAt | date:'dd/MM/yyyy HH:mm') : (item.decisionAt ? (item.decisionAt | date:'dd/MM/yyyy HH:mm') : '-') }}</div>
              <div class="muted-line" *ngIf="item.notes">{{ item.notes }}</div>
            </td>
            <td class="actions-cell">
              <button class="btn-sm" type="button" (click)="edit(item)" *ngIf="canEdit(item)">Sua</button>
              <button class="btn-sm" type="button" (click)="markWaiting(item)" *ngIf="canEdit(item) && item.status === 'PENDING_TRIAL'">Cho chot</button>
              <button class="btn-sm success" type="button" (click)="convert(item)" *ngIf="canApprove(item)">Chuyen doi</button>
              <button class="btn-sm danger" type="button" (click)="reject(item)" *ngIf="canApprove(item)">Tu choi</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <ng-template #emptyState>
      <div class="empty-state" *ngIf="!loading(); else loadingState">
        <h3>Chua co hoc thu nao</h3>
        <p>Tao mot ban ghi hoc thu de Sale co the xep lop offline va OPS giam sat 2 buoi dau.</p>
      </div>
    </ng-template>

    <ng-template #loadingState>
      <div class="empty-state">
        <h3>Dang tai du lieu...</h3>
        <p>Xin cho mot chut trong luc lay lop offline, goi offline va danh sach sale.</p>
      </div>
    </ng-template>

    <div class="modal-backdrop" *ngIf="showModal()">
      <div class="modal wide">
        <h3>{{ editingId ? 'Cap nhat hoc thu' : 'Tao hoc thu moi' }}</h3>
        <form (ngSubmit)="submit()" #f="ngForm">
          <div class="form-grid">
            <label>Hoc vien <span class="req">*</span>
              <input name="studentName" [(ngModel)]="form.studentName" required />
            </label>
            <label>So dien thoai hoc vien
              <input name="studentPhone" [(ngModel)]="form.studentPhone" />
            </label>
            <label>Phu huynh <span class="req">*</span>
              <input name="parentName" [(ngModel)]="form.parentName" required />
            </label>
            <label>So dien thoai PH <span class="req">*</span>
              <input name="parentPhone" [(ngModel)]="form.parentPhone" required />
            </label>
            <label>Email PH
              <input name="parentEmail" [(ngModel)]="form.parentEmail" />
            </label>
            <label>Lop offline <span class="req">*</span>
              <select name="classId" [(ngModel)]="form.classId" required>
                <option value="">-- Chon lop --</option>
                <option *ngFor="let cls of offlineClasses()" [value]="cls._id">{{ classLabel(cls) }}</option>
              </select>
            </label>
            <label>Goi san pham offline <span class="req">*</span>
              <select name="productId" [(ngModel)]="form.productId" required>
                <option value="">-- Chon goi --</option>
                <option *ngFor="let product of offlineProducts()" [value]="product._id">{{ productLabel(product) }}</option>
              </select>
            </label>
            <label *ngIf="!isSaleRole()">Sale phu trach
              <select name="saleId" [(ngModel)]="form.saleId">
                <option value="">-- Tu suy ra --</option>
                <option *ngFor="let sale of sales()" [value]="sale._id">{{ sale.fullName }}</option>
              </select>
            </label>
            <label *ngIf="isSaleRole()">Sale phu trach
              <input [value]="currentUserName" disabled />
            </label>
            <label>Trang thai
              <select name="status" [(ngModel)]="form.status">
                <option *ngFor="let status of editableStatuses()" [value]="status">{{ statusLabel(status) }}</option>
              </select>
            </label>
            <label>So buoi hoc thu
              <input name="maxTrialSessions" type="number" min="1" [(ngModel)]="form.maxTrialSessions" />
            </label>
            <label>So buoi da hoc
              <input name="trialSessionsUsed" type="number" min="0" [(ngModel)]="form.trialSessionsUsed" />
            </label>
          </div>
          <label class="full">Ghi chu
            <textarea name="notes" [(ngModel)]="form.notes" rows="3"></textarea>
          </label>
          <div class="form-actions">
            <button type="submit" class="primary">{{ editingId ? 'Cap nhat' : 'Tao hoc thu' }}</button>
            <button type="button" (click)="closeModal()">Huy</button>
          </div>
          <p class="error" *ngIf="error()">{{ error() }}</p>
        </form>
      </div>
    </div>
  `,
  styles: [`
    .page-header {
      display:flex;
      justify-content:space-between;
      align-items:flex-start;
      gap:16px;
      margin-bottom:18px;
      padding:20px 22px;
      border-radius:20px;
      border:1px solid rgba(148, 163, 184, 0.18);
      background:
        radial-gradient(circle at top right, rgba(245, 158, 11, 0.15), transparent 24%),
        linear-gradient(135deg, #ecfeff 0%, #fff7ed 100%);
      box-shadow:0 16px 32px rgba(15, 23, 42, 0.06);
    }
    .page-header h2 {
      margin:0 0 6px;
      font-size:28px;
      letter-spacing:-0.03em;
      color:#0f172a;
    }
    .page-header p {
      margin:0;
      color:#475569;
      line-height:1.6;
      max-width:760px;
    }
    .eyebrow {
      margin:0 0 8px;
      color:#0f766e;
      text-transform:uppercase;
      letter-spacing:0.12em;
      font-size:11px;
      font-weight:800;
    }
    .header-actions {
      display:flex;
      gap:10px;
      flex-wrap:wrap;
      justify-content:flex-end;
    }
    .primary,
    .secondary,
    .btn-sm {
      border:none;
      border-radius:999px;
      min-height:40px;
      padding:0 16px;
      cursor:pointer;
      font-weight:700;
      transition:transform .15s ease, box-shadow .15s ease, opacity .15s ease;
    }
    .primary {
      color:#fff;
      background:linear-gradient(135deg, #0f766e 0%, #115e59 100%);
      box-shadow:0 12px 24px rgba(15, 118, 110, 0.18);
    }
    .secondary {
      color:#0f172a;
      background:#fff;
      border:1px solid rgba(148, 163, 184, 0.35);
    }
    .btn-sm {
      min-height:34px;
      padding:0 12px;
      font-size:13px;
      background:#e2e8f0;
      color:#0f172a;
    }
    .btn-sm.success {
      background:#dcfce7;
      color:#166534;
    }
    .btn-sm.danger {
      background:#fee2e2;
      color:#b91c1c;
    }
    .primary:hover,
    .secondary:hover,
    .btn-sm:hover {
      transform:translateY(-1px);
    }
    .info-banner {
      display:flex;
      justify-content:space-between;
      gap:16px;
      padding:16px 18px;
      margin-bottom:18px;
      border-radius:18px;
      background:#fff;
      border:1px solid rgba(226, 232, 240, 0.9);
      box-shadow:0 12px 28px rgba(15, 23, 42, 0.05);
    }
    .info-banner strong {
      display:block;
      margin-bottom:4px;
      color:#0f172a;
    }
    .info-banner span,
    .banner-note {
      color:#475569;
      line-height:1.6;
    }
    .banner-note {
      max-width:540px;
      text-align:right;
    }
    .summary-grid {
      display:grid;
      gap:14px;
      grid-template-columns:repeat(auto-fit, minmax(160px, 1fr));
      margin-bottom:18px;
    }
    .summary-card {
      padding:16px;
      border-radius:18px;
      background:#fff;
      border:1px solid rgba(226, 232, 240, 0.9);
      box-shadow:0 12px 28px rgba(15, 23, 42, 0.05);
    }
    .summary-card.accent {
      background:linear-gradient(135deg, #ecfeff 0%, #f8fafc 100%);
    }
    .summary-card.success {
      background:linear-gradient(135deg, #f0fdf4 0%, #f8fafc 100%);
    }
    .summary-card.danger {
      background:linear-gradient(135deg, #fff1f2 0%, #f8fafc 100%);
    }
    .summary-label {
      display:block;
      margin-bottom:8px;
      color:#64748b;
      font-size:12px;
      text-transform:uppercase;
      letter-spacing:0.08em;
      font-weight:700;
    }
    .summary-card strong {
      color:#0f172a;
      font-size:28px;
      letter-spacing:-0.03em;
    }
    .filters {
      display:grid;
      gap:12px;
      grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));
      margin-bottom:18px;
    }
    .filters input,
    .filters select,
    .modal input,
    .modal select,
    .modal textarea {
      width:100%;
      padding:10px 12px;
      border:1px solid #cbd5e1;
      border-radius:12px;
      background:#fff;
      color:#0f172a;
      outline:none;
    }
    .table-wrap {
      width:100%;
      overflow:auto;
      border-radius:18px;
      border:1px solid rgba(226, 232, 240, 0.95);
      background:#fff;
      box-shadow:0 18px 32px rgba(15, 23, 42, 0.05);
    }
    .data {
      width:100%;
      min-width:1280px;
      border-collapse:collapse;
    }
    th, td {
      padding:12px 14px;
      border-bottom:1px solid #e2e8f0;
      vertical-align:top;
    }
    thead {
      background:#f8fafc;
      position:sticky;
      top:0;
      z-index:1;
    }
    th {
      text-align:left;
      font-size:12px;
      color:#64748b;
      text-transform:uppercase;
      letter-spacing:0.08em;
    }
    .primary-text {
      font-weight:700;
      color:#0f172a;
    }
    .muted-line {
      margin-top:4px;
      color:#64748b;
      font-size:12px;
    }
    .session-pill {
      display:inline-flex;
      align-items:center;
      min-height:28px;
      padding:0 10px;
      border-radius:999px;
      background:#eef2ff;
      color:#3730a3;
      font-size:12px;
      font-weight:700;
    }
    .badge {
      display:inline-flex;
      align-items:center;
      min-height:28px;
      padding:0 10px;
      border-radius:999px;
      font-size:12px;
      font-weight:700;
    }
    .actions-cell {
      white-space:nowrap;
    }
    .actions-cell .btn-sm {
      margin-right:6px;
      margin-bottom:4px;
    }
    .empty-state {
      margin-top:16px;
      padding:34px 20px;
      border-radius:18px;
      background:#fff;
      border:1px dashed #cbd5e1;
      text-align:center;
      color:#64748b;
    }
    .empty-state h3 {
      margin:0 0 8px;
      color:#0f172a;
    }
    .modal-backdrop {
      position:fixed;
      inset:0;
      z-index:1000;
      background:rgba(15, 23, 42, 0.58);
      display:flex;
      align-items:flex-start;
      justify-content:center;
      padding:16px;
      overflow:auto;
    }
    .modal {
      width:min(980px, calc(100vw - 32px));
      max-height:calc(100vh - 32px);
      background:#fff;
      border-radius:20px;
      box-shadow:0 20px 44px rgba(15, 23, 42, 0.22);
      padding:20px;
      overflow:auto;
    }
    .modal h3 {
      margin:0 0 14px;
      color:#0f172a;
    }
    .form-grid {
      display:grid;
      gap:12px;
      grid-template-columns:repeat(auto-fit, minmax(220px, 1fr));
    }
    label {
      display:flex;
      flex-direction:column;
      gap:6px;
      color:#0f172a;
      font-weight:600;
      font-size:14px;
    }
    .full {
      margin-top:12px;
    }
    .form-actions {
      display:flex;
      justify-content:flex-end;
      gap:10px;
      margin-top:16px;
    }
    .req {
      color:#dc2626;
    }
    .error {
      margin:12px 0 0;
      color:#dc2626;
      font-weight:600;
    }
    button:disabled {
      opacity:.55;
      cursor:not-allowed;
      transform:none;
    }
    @media (max-width: 768px) {
      .page-header,
      .info-banner {
        flex-direction:column;
      }
      .banner-note {
        text-align:left;
      }
      .page-header h2 {
        font-size:24px;
      }
      .modal {
        width:calc(100vw - 16px);
        max-height:calc(100vh - 16px);
        padding:16px;
      }
      .form-actions,
      .header-actions {
        width:100%;
      }
      .form-actions {
        justify-content:stretch;
      }
      .form-actions button,
      .header-actions button {
        flex:1;
      }
    }
  `],
})
export class TrialEnrollmentsComponent implements OnInit {
  items = signal<TrialEnrollmentItem[]>([]);
  classes = signal<ClassItem[]>([]);
  products = signal<ProductItem[]>([]);
  sales = signal<UserItem[]>([]);
  loading = signal(false);
  error = signal('');
  showModal = signal(false);

  editingId: string | null = null;
  keyword = '';
  statusFilter = '';
  classFilter = '';
  productFilter = '';
  currentUserId = '';
  currentUserName = '';
  currentRole = '';
  form: TrialForm = this.blankForm();

  readonly statusOptions = STATUS_OPTIONS;

  constructor(
    private readonly trialService: TrialEnrollmentService,
    private readonly classService: ClassService,
    private readonly productService: ProductService,
    private readonly userService: UserService,
    private readonly auth: AuthService,
  ) {}

  ngOnInit(): void {
    const user = this.auth.userSignal();
    this.currentUserId = user?.sub || user?._id || '';
    this.currentUserName = user?.fullName || '';
    this.currentRole = user?.role || '';
    if (this.isSaleRole()) {
      this.form.saleId = this.currentUserId;
    }
    void this.reload();
  }

  isSaleRole(): boolean {
    return this.currentRole === 'SALE';
  }

  isDecisionRole(): boolean {
    return this.currentRole === 'DIRECTOR' || this.currentRole === 'OPS';
  }

  canCreate(): boolean {
    return this.currentRole === 'DIRECTOR' || this.currentRole === 'OPS' || this.currentRole === 'SALE';
  }

  canEdit(item: TrialEnrollmentItem): boolean {
    if (this.isDecisionRole()) return true;
    if (!this.isSaleRole()) return false;
    return this.resolveId(item.saleId) === this.currentUserId || !this.resolveId(item.saleId);
  }

  canApprove(item: TrialEnrollmentItem): boolean {
    return this.isDecisionRole() && item.status !== 'CONVERTED' && item.status !== 'REJECTED';
  }

  editableStatuses(): TrialEnrollmentStatus[] {
    return this.isDecisionRole() ? STATUS_OPTIONS : ['PENDING_TRIAL', 'WAITING_DECISION'];
  }

  async reload(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      const [items, classes, products, sales] = await Promise.all([
        this.trialService.list(),
        this.classService.list(),
        this.productService.list(),
        this.userService.listSales(),
      ]);
      this.items.set((items || []).slice().sort((a, b) => {
        const aTime = new Date(a.createdAt || 0).getTime();
        const bTime = new Date(b.createdAt || 0).getTime();
        return bTime - aTime;
      }));
      this.classes.set((classes || []).filter((cls) => cls.classMode === 'OFFLINE'));
      this.products.set((products || []).filter((product) => product.teachingMode !== 'ONLINE'));
      this.sales.set((sales || []).sort((a, b) => a.fullName.localeCompare(b.fullName)));
      if (this.isSaleRole() && !this.form.saleId) {
        this.form.saleId = this.currentUserId;
      }
    } catch (err: any) {
      this.error.set(this.extractMessage(err) || 'Khong the tai danh sach hoc thu');
    } finally {
      this.loading.set(false);
    }
  }

  filteredItems(): TrialEnrollmentItem[] {
    const keyword = this.keyword.trim().toLowerCase();
    return this.items().filter((item) => {
      if (this.statusFilter && item.status !== this.statusFilter) return false;
      if (this.classFilter && this.resolveId(item.classId) !== this.classFilter) return false;
      if (this.productFilter && this.resolveId(item.productId) !== this.productFilter) return false;

      if (!keyword) return true;

      const haystack = [
        this.trialCode(item),
        item.studentName,
        item.studentPhone,
        item.parentName,
        item.parentPhone,
        item.parentEmail,
        this.classLabelByRef(item.classId),
        this.productLabelByRef(item.productId),
        this.saleLabelByRef(item.saleId),
        item.notes,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(keyword);
    });
  }

  summary() {
    const items = this.items();
    return {
      total: items.length,
      active: items.filter((item) => item.status === 'PENDING_TRIAL').length,
      waiting: items.filter((item) => item.status === 'WAITING_DECISION').length,
      converted: items.filter((item) => item.status === 'CONVERTED').length,
      rejected: items.filter((item) => item.status === 'REJECTED').length,
    };
  }

  offlineClasses(): ClassItem[] {
    return this.classes().slice().sort((a, b) => this.classLabel(a).localeCompare(this.classLabel(b)));
  }

  offlineProducts(): ProductItem[] {
    return this.products().slice().sort((a, b) => this.productLabel(a).localeCompare(this.productLabel(b)));
  }

  openCreate(): void {
    if (!this.canCreate()) return;
    this.editingId = null;
    this.form = this.blankForm();
    if (this.isSaleRole()) {
      this.form.saleId = this.currentUserId;
    }
    this.error.set('');
    this.showModal.set(true);
  }

  edit(item: TrialEnrollmentItem): void {
    if (!this.canEdit(item)) return;
    this.editingId = item._id;
    this.form = {
      studentName: item.studentName || '',
      studentPhone: item.studentPhone || '',
      parentName: item.parentName || '',
      parentPhone: item.parentPhone || '',
      parentEmail: item.parentEmail || '',
      classId: this.resolveId(item.classId),
      productId: this.resolveId(item.productId),
      saleId: this.resolveId(item.saleId) || (this.isSaleRole() ? this.currentUserId : ''),
      status: (item.status as TrialEnrollmentStatus) || 'PENDING_TRIAL',
      maxTrialSessions: item.maxTrialSessions || 2,
      trialSessionsUsed: item.trialSessionsUsed || 0,
      notes: item.notes || '',
    };
    this.error.set('');
    this.showModal.set(true);
  }

  closeModal(): void {
    this.showModal.set(false);
    this.error.set('');
  }

  async submit(): Promise<void> {
    const payload = this.buildPayload();
    if (!payload) return;

    const result = this.editingId
      ? await this.trialService.update(this.editingId, payload)
      : await this.trialService.create(payload);

    if (!result.ok) {
      this.error.set(result.message || 'Khong the luu hoc thu');
      return;
    }

    this.closeModal();
    await this.reload();
  }

  async markWaiting(item: TrialEnrollmentItem): Promise<void> {
    if (!this.canEdit(item)) return;
    const result = await this.trialService.markWaitingDecision(item._id, item.notes);
    if (!result.ok) {
      this.error.set(result.message || 'Khong the danh dau cho quyet dinh');
      return;
    }
    await this.reload();
  }

  async convert(item: TrialEnrollmentItem): Promise<void> {
    if (!this.canApprove(item)) return;
    const result = await this.trialService.convert(item._id, item.decisionNotes);
    if (!result.ok) {
      this.error.set(result.message || 'Khong the chuyen doi hoc thu');
      return;
    }
    await this.reload();
  }

  async reject(item: TrialEnrollmentItem): Promise<void> {
    if (!this.canApprove(item)) return;
    const result = await this.trialService.reject(item._id, item.decisionNotes);
    if (!result.ok) {
      this.error.set(result.message || 'Khong the tu choi hoc thu');
      return;
    }
    await this.reload();
  }

  statusLabel(status: string): string {
    const labels: Record<string, string> = {
      PENDING_TRIAL: 'Cho hoc thu',
      WAITING_DECISION: 'Cho quyet dinh',
      CONVERTED: 'Da chot',
      REJECTED: 'Khong tiep tuc',
    };
    return labels[status] || status;
  }

  statusColor(status: string): string {
    const colors: Record<string, string> = {
      PENDING_TRIAL: '#0284c7',
      WAITING_DECISION: '#d97706',
      CONVERTED: '#16a34a',
      REJECTED: '#dc2626',
    };
    return colors[status] || '#475569';
  }

  trialCode(item: TrialEnrollmentItem): string {
    return item.trialCode || `HT-${item._id.slice(-6).toUpperCase()}`;
  }

  classLabel(item: ClassItem): string {
    return `${item.name}${item.code ? ` (${item.code})` : ''}`;
  }

  productLabel(item: ProductItem): string {
    return `${item.name}${item.code ? ` (${item.code})` : ''}`;
  }

  classLabelByRef(ref: TrialEnrollmentItem['classId']): string {
    const id = this.resolveId(ref);
    const found = this.classes().find((item) => item._id === id);
    if (found) return this.classLabel(found);
    return id || '-';
  }

  productLabelByRef(ref: TrialEnrollmentItem['productId']): string {
    const id = this.resolveId(ref);
    const found = this.products().find((item) => item._id === id);
    if (found) return this.productLabel(found);
    return id || '-';
  }

  saleLabelByRef(ref: TrialEnrollmentItem['saleId']): string {
    const id = this.resolveId(ref);
    const found = this.sales().find((item) => item._id === id);
    if (found) return found.fullName || found.email || id || '-';
    return id || '-';
  }

  private buildPayload(): TrialEnrollmentPayload | null {
    const payload: TrialEnrollmentPayload = {
      studentName: this.form.studentName.trim(),
      studentPhone: this.normalizeText(this.form.studentPhone),
      parentName: this.form.parentName.trim(),
      parentPhone: this.form.parentPhone.trim(),
      parentEmail: this.normalizeText(this.form.parentEmail),
      classId: this.form.classId,
      productId: this.form.productId,
      saleId: this.isSaleRole() ? this.currentUserId : this.form.saleId || undefined,
      status: this.form.status,
      maxTrialSessions: Number(this.form.maxTrialSessions || 2),
      trialSessionsUsed: Number(this.form.trialSessionsUsed || 0),
      notes: this.normalizeText(this.form.notes),
    };

    if (!payload.studentName || !payload.parentName || !payload.parentPhone || !payload.classId || !payload.productId) {
      this.error.set('Vui long nhap day du thong tin bat buoc');
      return null;
    }

    return payload;
  }

  private blankForm(): TrialForm {
    return {
      studentName: '',
      studentPhone: '',
      parentName: '',
      parentPhone: '',
      parentEmail: '',
      classId: '',
      productId: '',
      saleId: '',
      status: 'PENDING_TRIAL',
      maxTrialSessions: 2,
      trialSessionsUsed: 0,
      notes: '',
    };
  }

  private resolveId(ref: TrialEnrollmentItem['classId'] | TrialEnrollmentItem['productId'] | TrialEnrollmentItem['saleId'] | TrialEnrollmentItem['studentId'] | TrialEnrollmentItem['orderId'] | TrialEnrollmentItem['invoiceId']): string {
    if (!ref) return '';
    return typeof ref === 'string' ? ref : ref._id;
  }

  private normalizeText(value?: string): string | undefined {
    const normalized = (value || '').trim();
    return normalized || undefined;
  }

  private extractMessage(error: any): string {
    const raw = error?.error?.message;
    if (typeof raw === 'string' && raw.trim()) return raw;
    if (Array.isArray(raw) && raw.length) return raw.join(', ');
    return error?.message || '';
  }
}
