import { Component, computed, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  SalaryConfigService,
  SalaryConfig,
  CommissionTier,
  KpiBonusTier,
  SalaryConfigUserOption,
} from '../services/salary-config.service';
import { AuthService } from '../services/auth.service';

import { FlowGuideComponent } from './shared/flow-guide.component';

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: '#10b981',
  INACTIVE: '#6b7280',
};

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Đang áp dụng',
  INACTIVE: 'Không áp dụng',
};

const COMMISSION_TYPE_LABELS: Record<string, string> = {
  PROGRESSIVE: 'Lũy tiến',
  HIGHEST_TIER: 'Mốc cao nhất',
};

@Component({
  selector: 'app-salary-config',
  standalone: true,
  imports: [CommonModule, FormsModule, FlowGuideComponent],
  template: `
  <header class="page-header">
    <div>
      <h2>Cấu hình lương nhân viên</h2>
      <p>Quản lý cấu hình lương, hoa hồng và KPI cho từng nhân viên.</p>
    </div>
    <button class="primary" (click)="openCreate()" *ngIf="isManager()">+ Tạo cấu hình</button>
  </header>

  <app-flow-guide featureKey="salary-config"></app-flow-guide>

  <!-- Manager view: list all configs -->
  <ng-container *ngIf="isManager(); else myView">
    <section class="filters">
      <input placeholder="Tìm nhân viên..." [(ngModel)]="keyword" (ngModelChange)="applyFilter()" />
      <select [(ngModel)]="filterStatus" (ngModelChange)="applyFilter()">
        <option value="">Tất cả trạng thái</option>
        <option value="ACTIVE">Đang áp dụng</option>
        <option value="INACTIVE">Không áp dụng</option>
      </select>
      <button (click)="reload()">Làm mới</button>
    </section>

    <div class="card-wrap">
      <table class="data" *ngIf="filtered().length; else empty">
        <thead>
          <tr>
            <th>Nhân viên</th>
            <th>Lương cứng</th>
            <th>Giờ chuẩn/tháng</th>
            <th>Giờ vào ca</th>
            <th>Phạt muộn/lần</th>
            <th>Hoa hồng</th>
            <th>KPI</th>
            <th>Trạng thái</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let cfg of filtered()">
            <td>
              <div class="user-cell">
                <strong>{{cfg.userName || cfg.userId}}</strong>
                <small class="muted">{{cfg.userRole || ''}}</small>
              </div>
            </td>
            <td class="right mono">{{cfg.baseSalary | number}}đ</td>
            <td class="center">{{cfg.standardHours}}h</td>
            <td class="center">{{cfg.scheduledStartTime}}</td>
            <td class="right mono">{{cfg.latePenaltyAmount | number}}đ</td>
            <td class="center">
              <span class="pill" [class.on]="cfg.commissionEnabled" [class.off]="!cfg.commissionEnabled">
                {{cfg.commissionEnabled ? 'Bật' : 'Tắt'}}
              </span>
            </td>
            <td class="center">
              <span class="pill" [class.on]="cfg.kpiBonusEnabled" [class.off]="!cfg.kpiBonusEnabled">
                {{cfg.kpiBonusEnabled ? 'Bật' : 'Tắt'}}
              </span>
            </td>
            <td>
              <span class="badge" [style.background]="statusColor(cfg.status) + '20'" [style.color]="statusColor(cfg.status)">
                {{statusLabel(cfg.status)}}
              </span>
            </td>
            <td class="actions-cell">
              <button class="btn-sm" (click)="openEdit(cfg)">Sửa</button>
              <button class="btn-sm danger" (click)="deleteConfig(cfg)" *ngIf="isDirector()">Xóa</button>
            </td>
          </tr>
        </tbody>
      </table>
      <ng-template #empty>
        <p class="empty-text">Chưa có cấu hình lương nào. Nhấn "+ Tạo cấu hình" để bắt đầu.</p>
      </ng-template>
    </div>
  </ng-container>

  <!-- Employee view: my own config -->
  <ng-template #myView>
    <div *ngIf="myConfig(); else noConfig" class="card my-config">
      <h3>Cấu hình lương của bạn</h3>
      <div class="info-grid">
        <div class="info-row">
          <span class="info-label">Lương cứng</span>
          <span class="info-value highlight">{{myConfig()!.baseSalary | number}}đ</span>
        </div>
        <div class="info-row">
          <span class="info-label">Giờ chuẩn / tháng</span>
          <span class="info-value">{{myConfig()!.standardHours}}h</span>
        </div>
        <div class="info-row">
          <span class="info-label">Giờ vào ca</span>
          <span class="info-value">{{myConfig()!.scheduledStartTime}}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Phạt đi muộn / lần</span>
          <span class="info-value">{{myConfig()!.latePenaltyAmount | number}}đ</span>
        </div>
        <div class="info-row">
          <span class="info-label">Trạng thái</span>
          <span class="badge" [style.background]="statusColor(myConfig()!.status) + '20'" [style.color]="statusColor(myConfig()!.status)">
            {{statusLabel(myConfig()!.status)}}
          </span>
        </div>
        <div class="info-row" *ngIf="myConfig()!.notes">
          <span class="info-label">Ghi chú</span>
          <span class="info-value">{{myConfig()!.notes}}</span>
        </div>
      </div>

      <!-- Commission section -->
      <div class="section-block" *ngIf="myConfig()!.commissionEnabled">
        <h4>
          Hoa hồng
          <span class="pill on ml">{{commissionTypeLabel(myConfig()!.commissionType || '')}}</span>
        </h4>
        <div *ngIf="myConfig()!.commissionTiers && myConfig()!.commissionTiers!.length; else noTiers">
          <div class="tier-row" *ngFor="let t of myConfig()!.commissionTiers">
            Từ <strong>{{t.minRevenue | number}}đ</strong>
            đến <strong>{{t.maxRevenue != null ? (t.maxRevenue | number) + 'đ' : '∞'}}</strong>:
            <span class="pct">{{t.percentage}}%</span>
          </div>
        </div>
        <ng-template #noTiers><p class="muted-sm">Chưa cấu hình mốc hoa hồng.</p></ng-template>
      </div>
      <div class="section-block off-block" *ngIf="!myConfig()!.commissionEnabled">
        <span class="muted-sm">Hoa hồng: <strong>Tắt</strong></span>
      </div>

      <!-- KPI section -->
      <div class="section-block" *ngIf="myConfig()!.kpiBonusEnabled">
        <h4>Thưởng KPI</h4>
        <div *ngIf="myConfig()!.kpiBonusTiers && myConfig()!.kpiBonusTiers!.length; else noKpi">
          <div class="tier-row" *ngFor="let t of myConfig()!.kpiBonusTiers">
            Từ <strong>{{t.minScore}}</strong> đến <strong>{{t.maxScore != null ? t.maxScore : '∞'}}</strong> điểm:
            <span class="pct">{{t.bonusPercentage}}% lương cứng</span>
          </div>
        </div>
        <ng-template #noKpi><p class="muted-sm">Chưa cấu hình mốc KPI.</p></ng-template>
      </div>
      <div class="section-block off-block" *ngIf="!myConfig()!.kpiBonusEnabled">
        <span class="muted-sm">Thưởng KPI: <strong>Tắt</strong></span>
      </div>
    </div>

    <ng-template #noConfig>
      <div class="card">
        <p class="empty-text">Bạn chưa có cấu hình lương. Vui lòng liên hệ quản lý để được thiết lập.</p>
      </div>
    </ng-template>
  </ng-template>

  <!-- Create / Edit Modal -->
  <div class="modal-backdrop" *ngIf="showModal()">
    <div class="modal wide">
      <h3>{{editingUserId ? 'Chỉnh sửa cấu hình lương' : 'Tạo cấu hình lương mới'}}</h3>
      <form (ngSubmit)="submitForm()">

        <!-- User ID -->
        <label *ngIf="!editingUserId">
          Mã nhân viên (userId) <span class="req">*</span>
          <select name="userId" [(ngModel)]="form.userId" [disabled]="loadingUserOptions()" required>
            <option value="" disabled>{{ loadingUserOptions() ? 'Đang tải danh sách nhân viên...' : '-- Chọn nhân viên --' }}</option>
            <option *ngFor="let user of availableUserOptions()" [value]="user._id">
              {{ user.fullName }} ({{ user._id }})
            </option>
          </select>
          <small class="muted-sm" *ngIf="!loadingUserOptions() && !availableUserOptions().length">
            Không còn nhân viên nào chưa có cấu hình lương.
          </small>
          <small class="error" *ngIf="userOptionsError()">{{ userOptionsError() }}</small>
        </label>

        <div class="form-grid">
          <label>
            Lương cứng (VNĐ) <span class="req">*</span>
            <input name="baseSalary" type="number" [(ngModel)]="form.baseSalary" min="0" required />
          </label>
          <label>
            Giờ chuẩn / tháng
            <input name="standardHours" type="number" [(ngModel)]="form.standardHours" min="1" />
          </label>
          <label>
            Giờ vào ca
            <input name="scheduledStartTime" type="time" [(ngModel)]="form.scheduledStartTime" />
          </label>
          <label>
            Phạt đi muộn / lần (VNĐ)
            <input name="latePenaltyAmount" type="number" [(ngModel)]="form.latePenaltyAmount" min="0" />
          </label>
        </div>

        <!-- Commission -->
        <div class="section-toggle">
          <label class="toggle-label">
            <input type="checkbox" [(ngModel)]="form.commissionEnabled" name="commissionEnabled" />
            <strong>Bật Hoa hồng</strong>
          </label>
        </div>

        <div class="section-block indented" *ngIf="form.commissionEnabled">
          <label>
            Loại tính hoa hồng
            <select name="commissionType" [(ngModel)]="form.commissionType">
              <option value="PROGRESSIVE">Lũy tiến</option>
              <option value="HIGHEST_TIER">Mốc cao nhất</option>
            </select>
          </label>

          <div class="tier-header">
            <span class="tier-title">Mốc hoa hồng</span>
            <button type="button" class="btn-add" (click)="addCommissionTier()">+ Thêm mốc</button>
          </div>
          <div class="tier-table-wrap" *ngIf="form.commissionTiers.length">
            <table class="tier-table">
              <thead>
                <tr><th>Doanh thu từ (đ)</th><th>Đến (đ, để trống = vô hạn)</th><th>Tỉ lệ (%)</th><th></th></tr>
              </thead>
              <tbody>
                <tr *ngFor="let t of form.commissionTiers; let i = index">
                  <td><input type="number" [(ngModel)]="t.minRevenue" [name]="'cMin'+i" min="0" /></td>
                  <td><input type="number" [(ngModel)]="t.maxRevenue" [name]="'cMax'+i" min="0" placeholder="∞" /></td>
                  <td><input type="number" [(ngModel)]="t.percentage" [name]="'cPct'+i" min="0" max="100" step="0.1" /></td>
                  <td><button type="button" class="btn-remove" (click)="removeCommissionTier(i)">✕</button></td>
                </tr>
              </tbody>
            </table>
          </div>
          <p class="muted-sm" *ngIf="!form.commissionTiers.length">Chưa có mốc hoa hồng nào.</p>
        </div>

        <!-- KPI -->
        <div class="section-toggle">
          <label class="toggle-label">
            <input type="checkbox" [(ngModel)]="form.kpiBonusEnabled" name="kpiBonusEnabled" />
            <strong>Bật Thưởng KPI</strong>
          </label>
        </div>

        <div class="section-block indented" *ngIf="form.kpiBonusEnabled">
          <div class="tier-header">
            <span class="tier-title">Mốc KPI</span>
            <button type="button" class="btn-add" (click)="addKpiTier()">+ Thêm mốc</button>
          </div>
          <div class="tier-table-wrap" *ngIf="form.kpiBonusTiers.length">
            <table class="tier-table">
              <thead>
                <tr><th>Điểm từ</th><th>Đến (để trống = vô hạn)</th><th>Thưởng (% lương cứng)</th><th></th></tr>
              </thead>
              <tbody>
                <tr *ngFor="let t of form.kpiBonusTiers; let i = index">
                  <td><input type="number" [(ngModel)]="t.minScore" [name]="'kMin'+i" min="0" /></td>
                  <td><input type="number" [(ngModel)]="t.maxScore" [name]="'kMax'+i" min="0" placeholder="∞" /></td>
                  <td><input type="number" [(ngModel)]="t.bonusPercentage" [name]="'kPct'+i" min="0" max="100" step="0.1" /></td>
                  <td><button type="button" class="btn-remove" (click)="removeKpiTier(i)">✕</button></td>
                </tr>
              </tbody>
            </table>
          </div>
          <p class="muted-sm" *ngIf="!form.kpiBonusTiers.length">Chưa có mốc KPI nào.</p>
        </div>

        <label>
          Ghi chú
          <textarea name="notes" [(ngModel)]="form.notes" rows="2" placeholder="Ghi chú thêm..."></textarea>
        </label>

        <div class="form-actions">
          <button type="submit" class="primary">{{editingUserId ? 'Cập nhật' : 'Tạo'}}</button>
          <button type="button" (click)="closeModal()">Hủy</button>
        </div>
        <p class="error" *ngIf="error()">{{error()}}</p>
      </form>
    </div>
  </div>
  `,
  styles: [`
    .page-header { display:flex; justify-content:space-between; align-items:flex-start; padding:16px; }
    .page-header h2 { margin:0 0 4px; font-size:20px; color:#0f172a; }
    .page-header p { margin:0; font-size:13px; color:#64748b; }

    .filters { display:flex; gap:10px; padding:0 16px 12px; flex-wrap:wrap; }
    input, select, textarea { padding:6px 8px; border:1px solid #cbd5e1; border-radius:4px; font-size:13px; font-family:inherit; }
    textarea { width:100%; resize:vertical; }

    .card-wrap { padding:0 16px 16px; }
    .card { background:#fff; border-radius:8px; padding:20px; margin:0 16px 16px; box-shadow:0 1px 4px rgba(15,23,42,.08); }
    .my-config h3 { margin:0 0 16px; font-size:16px; color:#0f172a; }

    .data { width:100%; border-collapse:collapse; background:#fff; font-size:13px; box-shadow:0 1px 4px rgba(15,23,42,.08); border-radius:8px; overflow:hidden; }
    th, td { padding:9px 11px; border:1px solid #e2e8f0; }
    thead { background:#f1f5f9; font-size:11px; text-transform:uppercase; color:#64748b; letter-spacing:.04em; }
    .right { text-align:right; }
    .center { text-align:center; }
    .mono { font-variant-numeric:tabular-nums; }

    .user-cell { display:flex; flex-direction:column; gap:2px; }
    .muted { font-size:11px; color:#94a3b8; }

    .pill { font-size:11px; padding:2px 8px; border-radius:20px; font-weight:600; }
    .pill.on { background:#d1fae5; color:#065f46; }
    .pill.off { background:#f1f5f9; color:#64748b; }
    .ml { margin-left:8px; }

    .badge { font-size:11px; padding:2px 8px; border-radius:9px; font-weight:600; white-space:nowrap; }

    .actions-cell { white-space:nowrap; }
    .btn-sm { padding:4px 10px; border:1px solid #cbd5e1; border-radius:4px; background:#fff; cursor:pointer; font-size:12px; margin-right:4px; }
    .btn-sm.danger { color:#dc2626; border-color:#fca5a5; }
    .btn-sm:hover { background:#f8fafc; }

    .primary { background:#2563eb; color:#fff; border:none; padding:8px 16px; border-radius:4px; cursor:pointer; font-weight:600; font-size:13px; }
    .primary:hover { background:#1d4ed8; }

    .empty-text { padding:20px 16px; color:#64748b; font-size:13px; text-align:center; }

    /* Info grid for my config */
    .info-grid { display:flex; flex-direction:column; gap:8px; margin-bottom:16px; }
    .info-row { display:flex; align-items:center; gap:12px; font-size:13px; }
    .info-label { min-width:180px; color:#64748b; }
    .info-value { color:#0f172a; font-weight:500; }
    .info-value.highlight { font-size:16px; font-weight:700; color:#2563eb; }

    .section-block { background:#f8fafc; border-radius:6px; padding:12px 14px; margin-bottom:12px; }
    .section-block h4 { margin:0 0 10px; font-size:13px; color:#334155; display:flex; align-items:center; }
    .section-block.off-block { padding:8px 14px; }
    .off-block .muted-sm { font-size:13px; }

    .tier-row { font-size:13px; color:#334155; margin-bottom:4px; }
    .pct { font-weight:700; color:#2563eb; margin-left:4px; }
    .muted-sm { font-size:12px; color:#94a3b8; margin:0; }

    /* Modal */
    .modal-backdrop { position:fixed; inset:0; background:rgba(15,23,42,.55); display:flex; align-items:center; justify-content:center; z-index:100; }
    .modal { background:#fff; padding:24px; border-radius:8px; max-width:640px; width:95%; box-shadow:0 8px 24px rgba(15,23,42,.2); max-height:90vh; overflow-y:auto; }
    .modal.wide { max-width:720px; }
    .modal h3 { margin:0 0 16px; font-size:16px; color:#0f172a; }

    .form-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin:0 0 8px; }
    label { display:flex; flex-direction:column; gap:4px; font-size:13px; color:#334155; margin-bottom:8px; }
    .req { color:#dc2626; }

    .section-toggle { margin:12px 0 4px; }
    .toggle-label { flex-direction:row; align-items:center; gap:8px; cursor:pointer; }
    .toggle-label input[type=checkbox] { width:16px; height:16px; cursor:pointer; }

    .indented { margin-left:0; margin-bottom:12px; border-left:3px solid #2563eb; }

    .tier-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; }
    .tier-title { font-size:12px; font-weight:600; color:#334155; text-transform:uppercase; letter-spacing:.04em; }
    .btn-add { background:#eff6ff; color:#2563eb; border:1px solid #bfdbfe; border-radius:4px; padding:3px 10px; font-size:12px; cursor:pointer; font-weight:600; }
    .btn-add:hover { background:#dbeafe; }

    .tier-table-wrap { overflow-x:auto; }
    .tier-table { width:100%; border-collapse:collapse; font-size:12px; }
    .tier-table th { background:#f1f5f9; padding:5px 8px; text-align:left; color:#64748b; font-weight:600; border:1px solid #e2e8f0; }
    .tier-table td { padding:4px 6px; border:1px solid #e2e8f0; }
    .tier-table input { width:100%; min-width:80px; padding:4px 6px; }
    .btn-remove { background:none; border:none; color:#ef4444; cursor:pointer; font-size:14px; padding:2px 6px; }
    .btn-remove:hover { background:#fee2e2; border-radius:4px; }

    .form-actions { display:flex; gap:8px; justify-content:flex-end; margin-top:16px; }
    .form-actions button:not(.primary) { background:#fff; border:1px solid #cbd5e1; color:#334155; padding:8px 16px; border-radius:4px; cursor:pointer; font-size:13px; }
    .error { color:#dc2626; font-size:13px; margin-top:6px; }
  `]
})
export class SalaryConfigComponent implements OnInit {
  configs = signal<SalaryConfig[]>([]);
  myConfig = signal<SalaryConfig | null>(null);
  showModal = signal(false);
  error = signal('');
  userOptionsError = signal('');
  loadingUserOptions = signal(false);
  editingUserId: string | null = null;
  userOptions = signal<SalaryConfigUserOption[]>([]);

  keyword = '';
  filterStatus = '';

  form = this.emptyForm();

  constructor(
    private salaryConfigService: SalaryConfigService,
    private auth: AuthService
  ) {}

  ngOnInit() {
    if (this.isManager()) {
      this.reload();
      this.loadUserOptions();
    } else {
      this.loadMy();
    }
  }

  isManager(): boolean {
    return this.auth.hasRole(['DIRECTOR', 'ACCOUNTING']);
  }

  isDirector(): boolean {
    return this.auth.hasRole(['DIRECTOR']);
  }

  statusColor(s: string): string { return STATUS_COLORS[s] || '#6b7280'; }
  statusLabel(s: string): string { return STATUS_LABELS[s] || s; }
  commissionTypeLabel(t: string): string { return COMMISSION_TYPE_LABELS[t] || t; }

  filtered = computed(() => {
    let list = this.configs();
    const kw = this.keyword.trim().toLowerCase();
    if (kw) {
      list = list.filter(c =>
        (c.userName || '').toLowerCase().includes(kw) ||
        String(c.userId).toLowerCase().includes(kw)
      );
    }
    if (this.filterStatus) {
      list = list.filter(c => c.status === this.filterStatus);
    }
    return list;
  });

  availableUserOptions = computed(() =>
    this.userOptions().filter((user) => !user.hasSalaryConfig),
  );

  applyFilter() { /* triggers computed signal */ }

  async reload() {
    try {
      const result = await this.salaryConfigService.list({});
      this.configs.set(result.data || result);
    } catch (e: any) {
      this.error.set(e?.message || 'Không thể tải danh sách cấu hình lương.');
    }
  }

  async loadUserOptions() {
    this.loadingUserOptions.set(true);
    this.userOptionsError.set('');
    try {
      const users = await this.salaryConfigService.listUserOptions();
      this.userOptions.set(users || []);
    } catch (e: any) {
      this.userOptions.set([]);
      this.userOptionsError.set(e?.message || 'Không thể tải danh sách nhân viên.');
    } finally {
      this.loadingUserOptions.set(false);
    }
  }

  async loadMy() {
    try {
      const cfg = await this.salaryConfigService.getMy();
      this.myConfig.set(cfg);
    } catch {
      this.myConfig.set(null);
    }
  }

  emptyForm() {
    return {
      userId: '',
      baseSalary: 0,
      standardHours: 176,
      scheduledStartTime: '08:00',
      latePenaltyAmount: 0,
      commissionEnabled: false,
      commissionType: 'PROGRESSIVE' as string,
      commissionTiers: [] as CommissionTier[],
      kpiBonusEnabled: false,
      kpiBonusTiers: [] as KpiBonusTier[],
      notes: '',
    };
  }

  openCreate() {
    this.editingUserId = null;
    this.form = this.emptyForm();
    this.error.set('');
    this.showModal.set(true);
    if (!this.userOptions().length) {
      this.loadUserOptions();
    }
  }

  openEdit(cfg: SalaryConfig) {
    this.editingUserId = String(cfg.userId);
    this.form = {
      userId: String(cfg.userId),
      baseSalary: cfg.baseSalary,
      standardHours: cfg.standardHours,
      scheduledStartTime: cfg.scheduledStartTime,
      latePenaltyAmount: cfg.latePenaltyAmount,
      commissionEnabled: cfg.commissionEnabled,
      commissionType: cfg.commissionType || 'PROGRESSIVE',
      commissionTiers: (cfg.commissionTiers || []).map(t => ({ ...t })),
      kpiBonusEnabled: cfg.kpiBonusEnabled,
      kpiBonusTiers: (cfg.kpiBonusTiers || []).map(t => ({ ...t })),
      notes: cfg.notes || '',
    };
    this.error.set('');
    this.showModal.set(true);
  }

  closeModal() {
    this.showModal.set(false);
    this.editingUserId = null;
  }

  addCommissionTier() {
    this.form.commissionTiers = [
      ...this.form.commissionTiers,
      { minRevenue: 0, maxRevenue: null as any, percentage: 0 }
    ];
  }

  removeCommissionTier(i: number) {
    this.form.commissionTiers = this.form.commissionTiers.filter((_, idx) => idx !== i);
  }

  addKpiTier() {
    this.form.kpiBonusTiers = [
      ...this.form.kpiBonusTiers,
      { minScore: 0, maxScore: null as any, bonusPercentage: 0 }
    ];
  }

  removeKpiTier(i: number) {
    this.form.kpiBonusTiers = this.form.kpiBonusTiers.filter((_, idx) => idx !== i);
  }

  async submitForm() {
    this.error.set('');
    try {
      if (this.editingUserId) {
        await this.salaryConfigService.update(this.editingUserId, this.form);
      } else {
        if (!this.form.userId.trim()) {
          this.error.set('Vui lòng chọn nhân viên.');
          return;
        }
        await this.salaryConfigService.create(this.form);
      }
      this.closeModal();
      await Promise.all([this.reload(), this.loadUserOptions()]);
    } catch (e: any) {
      this.error.set(e?.message || 'Có lỗi xảy ra. Vui lòng thử lại.');
    }
  }

  async deleteConfig(cfg: SalaryConfig) {
    const name = cfg.userName || cfg.userId;
    if (!confirm(`Xóa cấu hình lương của "${name}"? Hành động này không thể hoàn tác.`)) return;
    try {
      await this.salaryConfigService.delete(String(cfg.userId));
      await Promise.all([this.reload(), this.loadUserOptions()]);
    } catch (e: any) {
      alert(e?.message || 'Không thể xóa cấu hình lương.');
    }
  }
}
