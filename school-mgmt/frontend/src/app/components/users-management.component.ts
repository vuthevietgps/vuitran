import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  ParentAdsAttributionItem,
  UserService,
  UserItem,
} from '../services/user.service';
import { AuthService } from '../services/auth.service';
import { AdGroupItem, AdsService } from '../services/ads.service';

import { FlowGuideComponent } from './shared/flow-guide.component';

interface RoleOption {
  value: string;
  label: string;
  codeLabel: string;
  codeHint: string;
}

@Component({
  selector: 'app-users-management',
  standalone: true,
  imports: [CommonModule, FormsModule, FlowGuideComponent],
  template: `
  <header class="page-header">
    <div>
      <h2>{{ parentMode() ? 'Quan ly tai khoan phu huynh' : 'Quan ly tai khoan' }}</h2>
      <p>{{ parentMode() ? 'Tao moi, chinh sua va tim kiem tai khoan phu huynh theo dung pham vi quyen.' : 'Them moi, loc va tim kiem tai khoan trong he thong.' }}</p>
    </div>
    <button class="primary" (click)="openModal()">{{ parentMode() ? '+ Them phu huynh' : '+ Them moi' }}</button>
  </header>

  <app-flow-guide featureKey="users"></app-flow-guide>

  <section class="scope-tabs" *ngIf="canViewAllAccounts()">
    <button type="button" [class.active]="!parentMode()" (click)="showAllAccounts()">Tat ca tai khoan</button>
    <button type="button" [class.active]="parentMode()" (click)="showParentAccounts()">Tai khoan phu huynh</button>
  </section>

  <section class="filters">
    <input
      placeholder="Tim theo ma, email hoac ho ten"
      [(ngModel)]="search"
      (ngModelChange)="onFilterChange()" />
    <select *ngIf="canViewAllAccounts()" [(ngModel)]="roleFilter" (ngModelChange)="onFilterChange()">
      <option value="">Tat ca role</option>
      <option *ngFor="let r of roleOptions" [value]="r.value">{{ r.label }}</option>
    </select>
    <button (click)="reload()">Lam moi</button>
  </section>

  <section class="table-wrapper" *ngIf="filteredUsers.length; else empty">
    <div class="table-scroll">
      <table class="data">
        <thead>
          <tr>
            <th>Ma TK</th>
            <th>Email</th>
            <th>Ho ten</th>
            <th>Role</th>
            <th *ngIf="parentMode()">Dia chi</th>
            <th *ngIf="parentMode()">Link Facebook</th>
            <th *ngIf="parentMode()">Nhom quang cao</th>
            <th>Trang thai</th>
            <th>Hanh dong</th>
          </tr>
        </thead>
        <tbody>
          <tr
            *ngFor="let u of pagedUsers"
            [class.selected]="parentMode() && selectedParentId === u._id"
            (click)="selectParent(u)">
            <td><strong>{{ u.userCode || '-' }}</strong></td>
            <td>{{ u.email }}</td>
            <td>{{ u.fullName }}</td>
            <td>{{ translateRole(u.role) }}</td>
            <td *ngIf="parentMode()">{{ u.address || '-' }}</td>
            <td *ngIf="parentMode()">
              <a
                *ngIf="u.facebookLink; else noFacebookInRow"
                [href]="u.facebookLink"
                target="_blank"
                rel="noopener noreferrer">
                {{ u.facebookLink }}
              </a>
              <ng-template #noFacebookInRow>-</ng-template>
            </td>
            <td *ngIf="parentMode()">
              <span *ngIf="u.adGroupName || u.adGroupId; else noAdGroupInRow">
                {{ u.adGroupName || u.adGroupId }}
                <small *ngIf="u.adPlatform">({{ u.adPlatform }})</small>
              </span>
              <ng-template #noAdGroupInRow>-</ng-template>
            </td>
            <td>{{ u.status || 'N/A' }}</td>
            <td class="actions-cell">
              <button class="ghost" *ngIf="canEditUser(u)" (click)="onEdit(u, $event)" [disabled]="isSelf(u)">Sua</button>
              <button class="danger" *ngIf="canDeleteUser(u)" (click)="onRemove(u, $event)" [disabled]="isSelf(u)">Xoa</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="table-footer">
      <label class="page-size-control">
        So dong/trang
        <select [(ngModel)]="pageSize" (ngModelChange)="onPageSizeChange($event)">
          <option *ngFor="let size of pageSizeOptions" [ngValue]="size">{{ size }}</option>
        </select>
      </label>

      <div class="pager">
        <button type="button" (click)="goPrevPage()" [disabled]="safeCurrentPage <= 1">Truoc</button>
        <span>Trang {{ safeCurrentPage }}/{{ totalPages }} ({{ pageStart }}-{{ pageEnd }} / {{ filteredUsers.length }})</span>
        <button type="button" (click)="goNextPage()" [disabled]="safeCurrentPage >= totalPages">Sau</button>
      </div>
    </div>
  </section>

  <section class="parent-contact" *ngIf="parentMode() && selectedParentDetail as parentDetail">
    <h4>Bang chi tiet phu huynh</h4>
    <table class="detail-table">
      <tbody>
        <tr>
          <th>Ma tai khoan</th>
          <td>{{ parentDetail.userCode || '-' }}</td>
          <th>Trang thai</th>
          <td>{{ parentDetail.status || 'N/A' }}</td>
        </tr>
        <tr>
          <th>Ho ten</th>
          <td>{{ parentDetail.fullName }}</td>
          <th>Email</th>
          <td>{{ parentDetail.email }}</td>
        </tr>
        <tr>
          <th>So dien thoai</th>
          <td>{{ parentDetail.phone || '-' }}</td>
          <th>Role</th>
          <td>{{ translateRole(parentDetail.role) }}</td>
        </tr>
        <tr>
          <th>Dia chi</th>
          <td colspan="3">{{ parentDetail.address || '-' }}</td>
        </tr>
        <tr>
          <th>Link Facebook</th>
          <td colspan="3">
            <a
              *ngIf="parentDetail.facebookLink; else noFacebook"
              [href]="parentDetail.facebookLink"
              target="_blank"
              rel="noopener noreferrer">
              {{ parentDetail.facebookLink }}
            </a>
            <ng-template #noFacebook>-</ng-template>
          </td>
        </tr>
        <tr>
          <th>Sale phu trach</th>
          <td colspan="3">{{ currentParentOwnerLabel(parentDetail) }}</td>
        </tr>
        <tr *ngIf="canManageParentAds()">
          <th>Nhom quang cao</th>
          <td colspan="3">{{ currentParentAdGroupLabel() }}</td>
        </tr>
      </tbody>
    </table>

    <div class="ads-attribution-card" *ngIf="canAssignParentOwner()">
      <div class="ads-attribution-header">
        <div>
          <h5>Chuyen sale phu trach</h5>
          <p>Giám đốc có thể đổi owner sale của phụ huynh. Hệ thống sẽ cập nhật sale phụ trách cho các học sinh đang gắn với phụ huynh này.</p>
        </div>
        <span class="ads-pill" [class.empty]="!selectedParentSaleOwnerId">
          {{ currentParentOwnerLabel(parentDetail) }}
        </span>
      </div>

      <p class="success" *ngIf="parentOwnerSuccess()">{{ parentOwnerSuccess() }}</p>
      <p class="error" *ngIf="parentOwnerError()">{{ parentOwnerError() }}</p>

      <div class="ads-form-grid">
        <label>Sale phu trach moi
          <select
            [(ngModel)]="selectedParentSaleOwnerId"
            name="selectedParentSaleOwnerId"
            [disabled]="salesLoading() || parentOwnerSaving()">
            <option value="">-- Chua chon sale --</option>
            <option *ngFor="let sale of salesOptions()" [value]="sale._id">
              {{ sale.fullName }}{{ sale.userCode ? ' (' + sale.userCode + ')' : '' }}
            </option>
          </select>
        </label>
      </div>

      <p class="hint" *ngIf="salesLoading()">Dang tai danh sach sale...</p>

      <div class="ads-actions">
        <button
          type="button"
          class="primary"
          (click)="saveParentOwnerAssignment()"
          [disabled]="parentOwnerSaving() || !selectedParentId || !selectedParentSaleOwnerId || isParentOwnerSelectionUnchanged()">
          {{ parentOwnerSaving() ? 'Dang luu...' : 'Luu sale phu trach' }}
        </button>
        <button
          type="button"
          class="ghost"
          (click)="resetParentOwnerSelection()"
          [disabled]="parentOwnerSaving()">
          Dat lai
        </button>
      </div>
    </div>

    <div class="ads-attribution-card" *ngIf="canManageParentAds()">
      <div class="ads-attribution-header">
        <div>
          <h5>Gan nhom quang cao</h5>
          <p>Theo doi doanh thu theo ads group se uu tien attribution duoc gan tai day cho phu huynh dang chon.</p>
        </div>
        <span class="ads-pill" [class.empty]="!parentAdsAttribution()?.adGroupId">
          {{ currentParentAdGroupLabel() }}
        </span>
      </div>

      <div class="ads-attribution-summary">
        <div class="ads-summary-item">
          <span class="ads-summary-label">Nguon gan</span>
          <strong>{{ parentAdsSourceLabel(parentAdsAttribution()?.sourceType) }}</strong>
        </div>
        <div class="ads-summary-item">
          <span class="ads-summary-label">Cach match</span>
          <strong>{{ parentAdsMatchLabel(parentAdsAttribution()?.matchedBy) }}</strong>
        </div>
        <div class="ads-summary-item">
          <span class="ads-summary-label">Lan cap nhat cuoi</span>
          <strong>{{ parentAdsAttribution()?.lastConfirmedAt ? (parentAdsAttribution()?.lastConfirmedAt | date:'dd/MM/yyyy HH:mm') : '-' }}</strong>
        </div>
      </div>

      <p class="loading-text" *ngIf="parentAdsLoading()">Dang tai attribution ads cho {{ parentDetail.fullName }}...</p>
      <p class="success" *ngIf="parentAdsSuccess()">{{ parentAdsSuccess() }}</p>
      <p class="error" *ngIf="parentAdsError()">{{ parentAdsError() }}</p>

      <div class="ads-form-grid">
        <label>Tim nhom quang cao
          <input
            [(ngModel)]="adGroupSearch"
            name="adGroupSearch"
            placeholder="Tim theo ten nhom, ma nhom hoac nen tang" />
        </label>
        <label>Chon nhom quang cao
          <select
            [(ngModel)]="selectedParentAdGroupId"
            name="selectedParentAdGroupId"
            [disabled]="adGroupsLoading() || parentAdsSaving()">
            <option value="">-- Chua gan --</option>
            <option *ngFor="let group of filteredAdGroups" [value]="group._id">
              {{ group.name }} ({{ group.platform }})
            </option>
          </select>
        </label>
      </div>

      <p class="hint" *ngIf="adGroupsLoading()">Dang tai danh sach nhom quang cao...</p>
      <p class="hint" *ngIf="!adGroupsLoading() && !filteredAdGroups.length">Khong tim thay nhom quang cao phu hop voi bo loc hien tai.</p>

      <div class="ads-actions">
        <button
          type="button"
          class="primary"
          (click)="saveParentAdsAttribution()"
          [disabled]="parentAdsSaving() || parentAdsLoading() || !selectedParentId || !selectedParentAdGroupId || isParentAdsSelectionUnchanged()">
          {{ parentAdsSaving() ? 'Dang luu...' : 'Luu nhom ads' }}
        </button>
        <button
          type="button"
          class="ghost"
          (click)="resetParentAdsSelection()"
          [disabled]="parentAdsSaving() || parentAdsLoading()">
          Dat lai
        </button>
        <button
          type="button"
          class="danger-outline"
          (click)="clearParentAdsAttribution()"
          [disabled]="parentAdsSaving() || parentAdsLoading() || !parentAdsAttribution()?.adGroupId">
          Bo gan hien tai
        </button>
      </div>
    </div>
  </section>

  <ng-template #empty><p>Khong co du lieu hoac khong trung bo loc.</p></ng-template>

  <div class="modal-backdrop" *ngIf="showModal()">
    <div class="modal">
      <h3>{{ editingId ? 'Chinh sua tai khoan' : (parentMode() ? 'Them tai khoan phu huynh' : 'Them tai khoan moi') }}</h3>
      <form (ngSubmit)="submit()">
        <label>{{ getCodeLabel(form.role) }}
          <input
            [(ngModel)]="form.userCode"
            name="userCode"
            required
            placeholder="{{ getCodeHint(form.role) }}" />
        </label>
        <label>Email<input [(ngModel)]="form.email" name="email" type="email" required /></label>
        <label>So dien thoai
          <input [(ngModel)]="form.phone" name="phone" placeholder="Nhap so dien thoai" />
        </label>
        <label>Mat khau
          <input
            [(ngModel)]="form.password"
            name="password"
            type="password"
            [required]="!editingId"
            minlength="8"
            placeholder="{{ editingId ? 'De trong neu giu nguyen' : '' }}" />
        </label>
        <label>Ho ten<input [(ngModel)]="form.fullName" name="fullName" required /></label>
        <label *ngIf="canChooseRole(); else fixedRoleBlock">Role
          <select [(ngModel)]="form.role" name="role" required [disabled]="isSelfEditing()" (ngModelChange)="onFormRoleChange($event)">
            <option *ngFor="let r of availableRoleOptions()" [value]="r.value">{{ r.label }}</option>
          </select>
        </label>
        <ng-template #fixedRoleBlock>
          <label>Role
            <input [value]="translateRole(form.role)" disabled />
          </label>
        </ng-template>
        <ng-container *ngIf="isParentRole(form.role)">
          <label>Link Facebook
            <input
              [(ngModel)]="form.facebookLink"
              name="facebookLink"
              placeholder="https://facebook.com/..." />
          </label>
          <label>Dia chi
            <input
              [(ngModel)]="form.address"
              name="address"
              placeholder="Nhap dia chi phu huynh" />
          </label>
          <label *ngIf="canAssignParentOwner()">Sale phu trach
            <select
              [(ngModel)]="form.saleOwnerId"
              name="saleOwnerId"
              [disabled]="salesLoading()">
              <option value="">-- Chua chon sale --</option>
              <option *ngFor="let sale of salesOptions()" [value]="sale._id">
                {{ sale.fullName }}{{ sale.userCode ? ' (' + sale.userCode + ')' : '' }}
              </option>
            </select>
          </label>
          <ng-container *ngIf="canManageParentAds()">
            <label>Nhom quang cao
              <select
                [(ngModel)]="form.adGroupId"
                name="adGroupId"
                [disabled]="adGroupsLoading()">
                <option value="">-- Chua gan --</option>
                <option *ngFor="let group of adGroups()" [value]="group._id">
                  {{ group.name }} ({{ group.platform }})
                </option>
              </select>
            </label>
            <small class="hint" *ngIf="adGroupsLoading()">Dang tai danh sach nhom quang cao...</small>
          </ng-container>
        </ng-container>
        <div *ngIf="!editingId && isTeacherRole(form.role)" class="sales-editor">
          <div class="sales-editor-header">
            <strong>Sale quan ly</strong>
            <button type="button" class="ghost" (click)="addManagedSaleSlot()">+ Them sale</button>
          </div>
          <div *ngIf="!form.managedSales.length" class="hint">Co the bo trong va them sau trong Ho so giao vien.</div>
          <div *ngFor="let saleId of form.managedSales; let idx = index" class="sale-row">
            <label>
              Sale quan ly {{ idx + 1 }}
              <select [ngModel]="saleId" (ngModelChange)="updateManagedSaleSlot(idx, $event)" [name]="'managedSale' + idx">
                <option value="">-- Chon sale --</option>
                <option *ngFor="let sale of salesOptions()" [value]="sale._id">
                  {{ sale.fullName }}{{ sale.userCode ? ' (' + sale.userCode + ')' : '' }}
                </option>
              </select>
            </label>
            <button type="button" class="danger" (click)="removeManagedSaleSlot(idx)">Xoa</button>
          </div>
          <small class="hint" *ngIf="salesLoading()">Dang tai danh sach sale...</small>
          <small class="hint" *ngIf="!salesLoading() && !salesOptions().length">Chua co sale nao de gan.</small>
        </div>
        <small class="hint" *ngIf="isSelfEditing()">Khong the doi role cua tai khoan dang dang nhap.</small>
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
    .page-header { display:flex; justify-content:space-between; align-items:center; gap:16px; margin-bottom:12px; }
    .page-header h2 { margin:0 0 4px; }
    .page-header p { margin:0; color:#475569; }
    .scope-tabs { display:flex; gap:8px; margin-bottom:12px; }
    .scope-tabs button { border:1px solid #cbd5e1; background:#fff; padding:6px 10px; border-radius:999px; cursor:pointer; font-weight:500; }
    .scope-tabs button.active { border-color:#2563eb; color:#1d4ed8; background:#eff6ff; }
    .filters { display:flex; gap:10px; margin-bottom:16px; flex-wrap:wrap; }
    input, select, textarea { padding:6px 8px; border:1px solid #cbd5e1; border-radius:4px; }
    .table-wrapper { border:1px solid #e2e8f0; border-radius:8px; background:#fff; overflow:hidden; }
    .table-scroll { max-height:calc(100vh - 320px); overflow:auto; }
    .data { width:100%; border-collapse:separate; border-spacing:0; background:#fff; }
    th, td { padding:8px; border-bottom:1px solid #e2e8f0; border-left:1px solid #e2e8f0; text-align:left; }
    th:first-child, td:first-child { border-left:none; }
    thead th { position:sticky; top:0; z-index:2; background:#f1f5f9; }
    tbody tr:hover { background:#f8fafc; }
    tbody tr.selected { background:#eff6ff; }
    .table-footer { display:flex; justify-content:space-between; align-items:center; gap:12px; padding:10px 12px; border-top:1px solid #e2e8f0; flex-wrap:wrap; }
    .page-size-control { display:flex; align-items:center; gap:8px; color:#334155; font-size:13px; }
    .pager { display:flex; align-items:center; gap:8px; color:#334155; font-size:13px; }
    .pager button { border:1px solid #cbd5e1; background:#fff; color:#0f172a; padding:4px 10px; border-radius:4px; cursor:pointer; }
    .pager button:disabled { opacity:.5; cursor:not-allowed; }
    .parent-contact { margin-top:12px; border:1px solid #e2e8f0; border-radius:8px; padding:12px; background:#fff; }
    .parent-contact h4 { margin:0 0 10px; color:#1e293b; }
    .detail-table { width:100%; border-collapse:collapse; }
    .detail-table th, .detail-table td { padding:10px 12px; border:1px solid #e2e8f0; vertical-align:top; }
    .detail-table th { width:18%; background:#f8fafc; color:#334155; font-size:13px; text-align:left; }
    .detail-table td { color:#334155; }
    .parent-contact a { color:#2563eb; word-break:break-all; text-decoration:none; }
    .parent-contact p { margin:0; color:#334155; word-break:break-word; }
    .ads-attribution-card { margin-top:16px; padding-top:16px; border-top:1px dashed #cbd5e1; display:flex; flex-direction:column; gap:12px; }
    .ads-attribution-header { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; }
    .ads-attribution-header h5 { margin:0 0 4px; color:#0f172a; font-size:16px; }
    .ads-attribution-header p { margin:0; color:#475569; max-width:760px; }
    .ads-attribution-summary { display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:10px; }
    .ads-summary-item { border:1px solid #e2e8f0; border-radius:10px; padding:10px 12px; background:#f8fafc; }
    .ads-summary-label { display:block; font-size:12px; color:#64748b; margin-bottom:4px; text-transform:uppercase; letter-spacing:.04em; }
    .ads-pill { display:inline-flex; align-items:center; gap:6px; padding:8px 12px; border-radius:999px; background:#dcfce7; color:#166534; font-weight:600; text-align:center; }
    .ads-pill.empty { background:#f1f5f9; color:#475569; }
    .ads-form-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(260px, 1fr)); gap:12px; }
    .ads-form-grid label { display:flex; flex-direction:column; gap:6px; color:#334155; }
    .ads-actions { display:flex; gap:8px; flex-wrap:wrap; }
    .danger-outline { border:1px solid #dc2626; background:#fff; color:#dc2626; padding:8px 12px; border-radius:4px; cursor:pointer; }
    .danger-outline:disabled { opacity:.45; cursor:not-allowed; }
    .loading-text { color:#334155; }
    .success { color:#15803d; margin:0; }
    .primary { background:#2563eb; color:#fff; border:none; padding:8px 12px; border-radius:4px; cursor:pointer; }
    .ghost { border:1px solid #94a3b8; background:transparent; padding:4px 10px; border-radius:4px; cursor:pointer; margin-right:6px; }
    .danger { border:1px solid #dc2626; background:#dc2626; color:#fff; padding:4px 10px; border-radius:4px; cursor:pointer; }
    .ghost:disabled, .danger:disabled { opacity:.4; cursor:not-allowed; }
    .actions-cell { white-space:nowrap; width:140px; }
    .modal-backdrop { position:fixed; inset:0; background:rgba(15,23,42,.55); display:flex; align-items:center; justify-content:center; }
    .modal { background:#fff; padding:20px; border-radius:8px; width:min(520px, calc(100vw - 24px)); box-shadow:0 12px 32px rgba(15,23,42,.2); }
    .modal form { display:flex; flex-direction:column; gap:12px; }
    .sales-editor { border-top:1px solid #e2e8f0; padding-top:12px; display:flex; flex-direction:column; gap:10px; }
    .sales-editor-header { display:flex; align-items:center; justify-content:space-between; gap:8px; }
    .sale-row { display:flex; align-items:end; gap:8px; }
    .sale-row label { flex:1; display:flex; flex-direction:column; gap:6px; color:#334155; }
    .actions { display:flex; gap:8px; justify-content:flex-end; }
    .hint { color:#64748b; font-size:12px; }
    .error { color:#dc2626; margin:0; }
    @media (max-width: 900px) {
      .detail-table th, .detail-table td { display:block; width:100%; box-sizing:border-box; }
      .sale-row { flex-direction:column; align-items:stretch; }
    }
  `]
})
export class UsersManagementComponent {
  private readonly parentRole = 'PARENT';
  private parentAdsRequestSeq = 0;

  users = signal<UserItem[]>([]);
  showModal = signal(false);
  error = signal('');
  parentMode = signal(false);
  adGroups = signal<AdGroupItem[]>([]);
  adGroupsLoading = signal(false);
  parentAdsAttribution = signal<ParentAdsAttributionItem | null>(null);
  parentAdsLoading = signal(false);
  parentAdsSaving = signal(false);
  parentAdsError = signal('');
  parentAdsSuccess = signal('');
  salesOptions = signal<UserItem[]>([]);
  salesLoading = signal(false);
  parentOwnerSaving = signal(false);
  parentOwnerError = signal('');
  parentOwnerSuccess = signal('');

  search = '';
  roleFilter = '';
  adGroupSearch = '';
  selectedParentAdGroupId = '';
  selectedParentSaleOwnerId = '';
  pageSizeOptions: number[] = [50, 100, 200];
  pageSize = 50;
  currentPage = 1;
  selectedParentId: string | null = null;
  editingOriginalRole: string | null = null;
  form = {
    userCode: '',
    email: '',
    phone: '',
    password: '',
    fullName: '',
    role: 'DIRECTOR',
    facebookLink: '',
    address: '',
    saleOwnerId: '',
    adGroupId: '',
    managedSales: [] as string[],
  };
  editingId: string | null = null;

  roleOptions: RoleOption[] = [
    { value: 'DIRECTOR', label: 'Giam doc', codeLabel: 'Ma giam doc', codeHint: 'VD: GD001' },
    { value: 'ACCOUNTING', label: 'Ke toan', codeLabel: 'Ma ke toan', codeHint: 'VD: KT001' },
    { value: 'OPS', label: 'Van hanh', codeLabel: 'Ma van hanh', codeHint: 'VD: OPS001' },
    { value: 'SALE', label: 'Sale', codeLabel: 'Ma sale', codeHint: 'VD: SALE001' },
    { value: 'ADSMANAGER', label: 'Ads manager', codeLabel: 'Ma ads manager', codeHint: 'VD: ADS001' },
    { value: 'TEACHER', label: 'Giao vien', codeLabel: 'Ma giao vien', codeHint: 'VD: GV001' },
    { value: 'PARENT', label: 'Phu huynh', codeLabel: 'Ma phu huynh', codeHint: 'VD: PH001' },
    { value: 'MANAGER', label: 'Quan ly (legacy)', codeLabel: 'Ma quan ly', codeHint: 'VD: QL001' },
    { value: 'HCNS', label: 'HCNS (legacy)', codeLabel: 'Ma HCNS', codeHint: 'VD: HCNS001' },
    { value: 'PARTIME', label: 'Partime (legacy)', codeLabel: 'Ma partime', codeHint: 'VD: PT001' },
    { value: 'STAFF', label: 'Nhan vien (legacy)', codeLabel: 'Ma nhan vien', codeHint: 'VD: NV001' },
  ];

  constructor(
    private userService: UserService,
    private adsService: AdsService,
    private auth: AuthService,
    private route: ActivatedRoute,
    private router: Router,
  ) {
    this.route.queryParamMap.subscribe((params) => {
      const isSaleViewer = this.isSaleViewer();
      const isParentMode = isSaleViewer || (params.get('role') || '').toUpperCase() === this.parentRole;
      const wasParentMode = this.parentMode();
      this.parentMode.set(isParentMode);

      if (isParentMode) this.roleFilter = this.parentRole;
      if (!isParentMode && wasParentMode && this.roleFilter === this.parentRole) this.roleFilter = '';
      if (!isParentMode) this.selectedParentId = null;

      this.currentPage = 1;
      this.syncParentSelection();
      if (isParentMode) {
        if (this.canAssignParentOwner()) {
          void this.ensureSalesLoaded();
        }
        if (this.canManageParentAds()) {
          void this.ensureAdGroupsLoaded();
        }
      } else {
        this.resetParentAdsState();
      }
    });
    this.reload();
  }

  get filteredUsers(): UserItem[] {
    const term = this.search.trim().toLowerCase();
    return this.users().filter((u) =>
      (!this.roleFilter || u.role === this.roleFilter) &&
      (!term ||
        (u.userCode || '').toLowerCase().includes(term) ||
        u.email.toLowerCase().includes(term) ||
        (u.fullName || '').toLowerCase().includes(term))
    );
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredUsers.length / this.pageSize));
  }

  get safeCurrentPage(): number {
    return Math.min(Math.max(this.currentPage, 1), this.totalPages);
  }

  get pagedUsers(): UserItem[] {
    const start = (this.safeCurrentPage - 1) * this.pageSize;
    return this.filteredUsers.slice(start, start + this.pageSize);
  }

  get pageStart(): number {
    if (!this.filteredUsers.length) return 0;
    return (this.safeCurrentPage - 1) * this.pageSize + 1;
  }

  get pageEnd(): number {
    if (!this.filteredUsers.length) return 0;
    return Math.min(this.pageStart + this.pageSize - 1, this.filteredUsers.length);
  }

  get selectedParentDetail(): UserItem | null {
    if (!this.parentMode() || !this.selectedParentId) return null;
    return this.filteredUsers.find((u) => u._id === this.selectedParentId) || null;
  }

  get filteredAdGroups(): AdGroupItem[] {
    const term = this.adGroupSearch.trim().toLowerCase();
    const groups = this.adGroups();
    return groups
      .filter((group) => {
        if (!term) return true;
        return (
          (group.name || '').toLowerCase().includes(term)
          || (group.groupCode || '').toLowerCase().includes(term)
          || (group.platform || '').toLowerCase().includes(term)
        );
      })
      .sort((a, b) =>
        (a.platform || '').localeCompare(b.platform || '')
        || (a.name || '').localeCompare(b.name || ''),
      );
  }

  private currentUserRole(): string {
    return this.auth.userSignal()?.role || '';
  }

  isSaleViewer(): boolean {
    return this.currentUserRole() === 'SALE';
  }

  canViewAllAccounts(): boolean {
    return this.currentUserRole() === 'DIRECTOR';
  }

  canChooseRole(): boolean {
    return this.canViewAllAccounts();
  }

  canAssignParentOwner(): boolean {
    return this.currentUserRole() === 'DIRECTOR';
  }

  canManageParentAds(): boolean {
    return this.currentUserRole() === 'DIRECTOR';
  }

  canEditUser(user: UserItem): boolean {
    if (this.currentUserRole() === 'DIRECTOR') return true;
    return this.isSaleViewer() && user.role === this.parentRole;
  }

  canDeleteUser(user: UserItem): boolean {
    return this.currentUserRole() === 'DIRECTOR' && !this.isSelf(user);
  }

  availableRoleOptions(): RoleOption[] {
    return this.isSaleViewer()
      ? this.roleOptions.filter((option) => option.value === this.parentRole)
      : this.roleOptions;
  }

  translateRole(role: string) {
    return this.roleOptions.find((r) => r.value === role)?.label || role;
  }

  getCodeLabel(role: string) {
    return this.roleOptions.find((r) => r.value === role)?.codeLabel || 'Ma tai khoan';
  }

  getCodeHint(role: string) {
    return this.roleOptions.find((r) => r.value === role)?.codeHint || 'VD: TK001';
  }

  isSelfEditing(): boolean {
    if (!this.editingId) return false;
    const current = this.auth.userSignal();
    return !!current && current.sub === this.editingId;
  }

  isParentRole(role: string): boolean {
    return role === this.parentRole;
  }

  isTeacherRole(role: string): boolean {
    return role === 'TEACHER';
  }

  onFormRoleChange(role: string) {
    if (this.isParentRole(role)) {
      this.form.managedSales = [];
      if (this.canAssignParentOwner()) {
        void this.ensureSalesLoaded();
      }
      if (this.canManageParentAds()) {
        void this.ensureAdGroupsLoaded();
      }
      return;
    }

    this.form.facebookLink = '';
    this.form.address = '';
    this.form.saleOwnerId = '';
    this.form.adGroupId = '';

    if (this.isTeacherRole(role)) {
      if (!this.form.managedSales.length) {
        this.form.managedSales = [''];
      }
      void this.ensureSalesLoaded();
      return;
    }

    this.form.managedSales = [];
  }

  onFilterChange() {
    this.currentPage = 1;
    this.syncParentSelection();
  }

  onPageSizeChange(value: number) {
    this.pageSize = Number(value) || this.pageSizeOptions[0];
    this.currentPage = 1;
    this.syncParentSelection();
  }

  goPrevPage() {
    if (this.safeCurrentPage <= 1) return;
    this.currentPage = this.safeCurrentPage - 1;
    this.syncParentSelection();
  }

  goNextPage() {
    if (this.safeCurrentPage >= this.totalPages) return;
    this.currentPage = this.safeCurrentPage + 1;
    this.syncParentSelection();
  }

  selectParent(user: UserItem) {
    if (!this.parentMode()) return;
    this.selectedParentId = user._id;
    this.selectedParentSaleOwnerId = user.saleOwnerId || '';
    this.parentOwnerError.set('');
    this.parentOwnerSuccess.set('');
    void this.loadSelectedParentAdsAttribution();
  }

  onEdit(user: UserItem, event: Event) {
    event.stopPropagation();
    this.edit(user);
  }

  onRemove(user: UserItem, event: Event) {
    event.stopPropagation();
    this.remove(user);
  }

  private syncParentSelection() {
    if (!this.parentMode()) {
      this.selectedParentId = null;
      this.selectedParentSaleOwnerId = '';
      this.parentOwnerError.set('');
      this.parentOwnerSuccess.set('');
      this.resetParentAdsState();
      return;
    }

    const currentRows = this.pagedUsers;
    if (!currentRows.length) {
      this.selectedParentId = null;
      this.selectedParentSaleOwnerId = '';
      this.parentOwnerError.set('');
      this.parentOwnerSuccess.set('');
      this.resetParentAdsState();
      return;
    }

    this.currentPage = this.safeCurrentPage;
    if (!this.selectedParentId || !currentRows.some((u) => u._id === this.selectedParentId)) {
      this.selectedParentId = currentRows[0]._id;
    }

    const selectedParent = currentRows.find((u) => u._id === this.selectedParentId) || null;
    this.selectedParentSaleOwnerId = selectedParent?.saleOwnerId || '';

    void this.loadSelectedParentAdsAttribution();
  }

  private resetParentAdsState() {
    this.parentAdsAttribution.set(null);
    this.parentAdsLoading.set(false);
    this.parentAdsSaving.set(false);
    this.parentAdsError.set('');
    this.parentAdsSuccess.set('');
    this.adGroupSearch = '';
    this.selectedParentAdGroupId = '';
  }

  private async ensureAdGroupsLoaded() {
    if (!this.canManageParentAds()) return;
    if (this.adGroupsLoading() || this.adGroups().length) return;
    try {
      this.adGroupsLoading.set(true);
      const groups = await this.adsService.listAllGroups();
      this.adGroups.set(Array.isArray(groups) ? groups : []);
    } catch {
      this.parentAdsError.set('Khong tai duoc danh sach nhom quang cao');
    } finally {
      this.adGroupsLoading.set(false);
    }
  }

  private async ensureSalesLoaded() {
    if (this.salesLoading() || this.salesOptions().length) return;
    try {
      this.salesLoading.set(true);
      const sales = await this.userService.listSales();
      this.salesOptions.set((sales || []).filter((item) => item.role === 'SALE'));
    } catch {
      this.salesOptions.set([]);
    } finally {
      this.salesLoading.set(false);
    }
  }

  addManagedSaleSlot() {
    if (this.editingId) return;
    void this.ensureSalesLoaded();
    this.form.managedSales = [...this.form.managedSales, ''];
  }

  updateManagedSaleSlot(index: number, saleId: string) {
    this.form.managedSales = this.form.managedSales.map((item, idx) => idx === index ? saleId : item);
  }

  removeManagedSaleSlot(index: number) {
    this.form.managedSales = this.form.managedSales.filter((_, idx) => idx !== index);
  }

  private async loadSelectedParentAdsAttribution() {
    if (!this.canManageParentAds()) {
      this.resetParentAdsState();
      return;
    }

    if (!this.parentMode() || !this.selectedParentId) {
      this.resetParentAdsState();
      return;
    }

    const parentId = this.selectedParentId;
    const requestSeq = ++this.parentAdsRequestSeq;
    this.parentAdsLoading.set(true);
    this.parentAdsError.set('');
    this.parentAdsSuccess.set('');
    void this.ensureAdGroupsLoaded();

    try {
      const attribution = await this.userService.getParentAdsAttribution(parentId);
      if (requestSeq !== this.parentAdsRequestSeq || this.selectedParentId !== parentId) return;
      this.parentAdsAttribution.set(attribution);
      this.selectedParentAdGroupId = attribution.adGroupId || '';
      this.syncLocalUserAds(parentId, attribution);
    } catch {
      if (requestSeq !== this.parentAdsRequestSeq || this.selectedParentId !== parentId) return;
      this.parentAdsAttribution.set(null);
      this.selectedParentAdGroupId = '';
      this.parentAdsError.set('Khong tai duoc attribution ads cua phu huynh');
    } finally {
      if (requestSeq === this.parentAdsRequestSeq && this.selectedParentId === parentId) {
        this.parentAdsLoading.set(false);
      }
    }
  }

  resetParentAdsSelection() {
    this.parentAdsError.set('');
    this.parentAdsSuccess.set('');
    this.selectedParentAdGroupId = this.parentAdsAttribution()?.adGroupId || '';
  }

  resetParentOwnerSelection() {
    this.parentOwnerError.set('');
    this.parentOwnerSuccess.set('');
    this.selectedParentSaleOwnerId = this.selectedParentDetail?.saleOwnerId || '';
  }

  isParentAdsSelectionUnchanged(): boolean {
    return (this.parentAdsAttribution()?.adGroupId || '') === (this.selectedParentAdGroupId || '');
  }

  isParentOwnerSelectionUnchanged(): boolean {
    return (this.selectedParentDetail?.saleOwnerId || '') === (this.selectedParentSaleOwnerId || '');
  }

  currentParentAdGroupLabel(): string {
    if (!this.canManageParentAds()) return '-';
    const attribution = this.parentAdsAttribution();
    if (!attribution?.adGroupId) return 'Chua gan nhom ads';
    const parts = [attribution.adGroupName || attribution.adGroupId];
    if (attribution.platform) parts.push(attribution.platform);
    return parts.join(' - ');
  }

  currentParentOwnerLabel(parent?: UserItem | null): string {
    if (!parent?.saleOwnerId) {
      return this.isSaleViewer() ? 'Ban dang phu trach tai khoan nay' : 'Chua gan sale phu trach';
    }
    return parent.saleOwnerName || parent.saleOwnerId;
  }

  parentAdsSourceLabel(sourceType?: string | null): string {
    const labels: Record<string, string> = {
      MANUAL: 'Thu cong',
      LEAD: 'Tu lead',
      ORDER: 'Tu order',
      STUDENT: 'Tu hoc vien',
      CONVERSATION: 'Tu chatbot',
      LANDING_PAGE: 'Tu landing page',
      SYSTEM: 'He thong',
    };
    return sourceType ? (labels[sourceType] || sourceType) : 'Chua co';
  }

  parentAdsMatchLabel(matchedBy?: string | null): string {
    if (matchedBy === 'PARENT_USER') return 'Theo tai khoan PH';
    if (matchedBy === 'PHONE_FALLBACK') return 'Fallback theo so dien thoai';
    return 'Chua co attribution';
  }

  private syncLocalUserAds(userId: string, attribution: ParentAdsAttributionItem | null) {
    this.users.update((users) =>
      users.map((user) =>
        user._id !== userId
          ? user
          : {
              ...user,
              adGroupId: attribution?.adGroupId || null,
              adGroupName: attribution?.adGroupName || '',
              adPlatform: attribution?.platform || '',
              adAttributionSource: attribution?.sourceType || null,
            },
      ),
    );
  }

  private syncLocalParentOwner(userId: string, sale?: UserItem | null) {
    this.users.update((users) =>
      users.map((user) =>
        user._id !== userId
          ? user
          : {
              ...user,
              saleOwnerId: sale?._id || null,
              saleOwnerName: sale?.fullName || '',
            },
      ),
    );
  }

  async saveParentAdsAttribution() {
    if (!this.selectedParentId) return;
    if (!this.selectedParentAdGroupId) {
      this.parentAdsError.set('Vui long chon nhom quang cao truoc khi luu');
      return;
    }

    this.parentAdsSaving.set(true);
    this.parentAdsError.set('');
    this.parentAdsSuccess.set('');

    try {
      const result = await this.userService.updateParentAdsAttribution(this.selectedParentId, {
        adGroupId: this.selectedParentAdGroupId,
      });
      this.parentAdsAttribution.set(result);
      this.selectedParentAdGroupId = result.adGroupId || '';
      this.syncLocalUserAds(this.selectedParentId, result);
      this.parentAdsSuccess.set('Da cap nhat nhom quang cao cho phu huynh');
    } catch {
      this.parentAdsError.set('Cap nhat nhom quang cao that bai');
    } finally {
      this.parentAdsSaving.set(false);
    }
  }

  async saveParentOwnerAssignment() {
    if (!this.selectedParentId || !this.selectedParentSaleOwnerId) return;

    this.parentOwnerSaving.set(true);
    this.parentOwnerError.set('');
    this.parentOwnerSuccess.set('');

    try {
      const savedUser = await this.userService.update(this.selectedParentId, {
        saleOwnerId: this.selectedParentSaleOwnerId,
      });
      const selectedSale = this.salesOptions().find((sale) => sale._id === this.selectedParentSaleOwnerId) || null;
      this.syncLocalParentOwner(this.selectedParentId, selectedSale);
      this.selectedParentSaleOwnerId = savedUser.saleOwnerId || this.selectedParentSaleOwnerId;
      this.parentOwnerSuccess.set('Da cap nhat sale phu trach cho phu huynh');
      await this.reload();
    } catch (error) {
      this.parentOwnerError.set(this.extractErrorMessage(error));
    } finally {
      this.parentOwnerSaving.set(false);
    }
  }

  async clearParentAdsAttribution() {
    if (!this.selectedParentId || !this.parentAdsAttribution()?.adGroupId) return;
    if (!confirm('Bo gan nhom quang cao hien tai cho phu huynh nay?')) return;

    this.parentAdsSaving.set(true);
    this.parentAdsError.set('');
    this.parentAdsSuccess.set('');

    try {
      const result = await this.userService.clearParentAdsAttribution(this.selectedParentId);
      this.parentAdsAttribution.set(result);
      this.selectedParentAdGroupId = result.adGroupId || '';
      this.syncLocalUserAds(this.selectedParentId, result);
      this.parentAdsSuccess.set('Da bo gan nhom quang cao hien tai');
    } catch {
      this.parentAdsError.set('Bo gan nhom quang cao that bai');
    } finally {
      this.parentAdsSaving.set(false);
    }
  }

  async reload() {
    const data = this.parentMode() || this.isSaleViewer()
      ? await this.userService.listParents()
      : await this.userService.list();
    this.users.set(data);
    this.currentPage = this.safeCurrentPage;
    this.syncParentSelection();
    if (this.parentMode() && this.canAssignParentOwner()) {
      void this.ensureSalesLoaded();
    }
    if (this.parentMode() && this.canManageParentAds()) {
      void this.ensureAdGroupsLoaded();
    }
  }

  async showAllAccounts() {
    await this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { role: null },
      queryParamsHandling: 'merge',
    });
  }

  async showParentAccounts() {
    await this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { role: this.parentRole },
      queryParamsHandling: 'merge',
    });
  }

  openModal() {
    this.error.set('');
      this.form = {
        userCode: '',
        email: '',
        phone: '',
        password: '',
        fullName: '',
        role: this.isSaleViewer() || this.parentMode() ? this.parentRole : 'DIRECTOR',
        facebookLink: '',
        address: '',
        saleOwnerId: '',
        adGroupId: '',
        managedSales: [],
      };
      this.editingId = null;
      this.editingOriginalRole = null;
      if (this.isParentRole(this.form.role)) {
        if (this.canAssignParentOwner()) {
          void this.ensureSalesLoaded();
        }
        if (this.canManageParentAds()) {
          void this.ensureAdGroupsLoaded();
        }
    }
    this.showModal.set(true);
  }

  closeModal() {
    this.showModal.set(false);
    this.editingId = null;
    this.editingOriginalRole = null;
  }

  private normalizeErrorMessage(message: unknown): string {
    if (Array.isArray(message)) {
      return message.map((item) => String(item).trim()).filter(Boolean).join(', ');
    }

    if (typeof message === 'string') {
      return message.trim();
    }

    if (message && typeof message === 'object') {
      const nestedMessage = this.normalizeErrorMessage((message as { message?: unknown }).message);
      if (nestedMessage) return nestedMessage;

      const nestedError = (message as { error?: unknown }).error;
      if (typeof nestedError === 'string' && nestedError.trim()) {
        return nestedError.trim();
      }
    }

    return '';
  }

  private extractErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const backendMessage = this.normalizeErrorMessage(error.error?.message);
      if (backendMessage) return backendMessage;

      if (typeof error.error === 'string' && error.error.trim()) {
        return error.error.trim();
      }

      if (error.message?.trim()) {
        return error.message.trim();
      }
    }

    if (error && typeof error === 'object') {
      const message = this.normalizeErrorMessage((error as { message?: unknown }).message);
      if (message) return message;
    }

    return 'Thao tac that bai, vui long kiem tra lai du lieu';
  }

  async submit() {
    const userCode = this.form.userCode.trim().toUpperCase();
    const selfEditing = this.isSelfEditing();
    if (!userCode) {
      this.error.set('Vui long nhap ma tai khoan');
      return;
    }

    try {
      const isParentRole = this.isParentRole(this.form.role);
      const adGroupId = isParentRole ? this.form.adGroupId.trim() : '';
      const managedSales = !this.editingId && this.isTeacherRole(this.form.role)
        ? Array.from(new Set(this.form.managedSales.map((saleId) => saleId.trim()).filter(Boolean)))
        : [];
      const saleOwnerId = this.isParentRole(this.form.role) ? this.form.saleOwnerId.trim() : '';
      const payload = {
        userCode,
        email: this.form.email.trim(),
        phone: this.form.phone.trim() || undefined,
        password: this.form.password.trim(),
        fullName: this.form.fullName.trim(),
        role: this.form.role,
        facebookLink: isParentRole ? this.form.facebookLink.trim() : undefined,
        address: isParentRole ? this.form.address.trim() : undefined,
        saleOwnerId: isParentRole && saleOwnerId ? saleOwnerId : undefined,
        managedSales: managedSales.length ? managedSales : undefined,
      };

      let savedUser: UserItem;
      if (this.editingId) {
        const updatePayload: any = {
          userCode: payload.userCode,
          email: payload.email,
          phone: payload.phone,
          fullName: payload.fullName,
          role: payload.role,
          facebookLink: payload.facebookLink,
          address: payload.address,
          saleOwnerId: payload.saleOwnerId,
        };
        if (payload.password) updatePayload.password = payload.password;

        if (selfEditing) {
          delete updatePayload.role;
        }

        savedUser = await this.userService.update(this.editingId, updatePayload);
      } else {
        savedUser = await this.userService.create(payload);
      }

      const effectiveRole = selfEditing && this.editingOriginalRole ? this.editingOriginalRole : payload.role;
      if (this.isParentRole(effectiveRole) && this.canManageParentAds()) {
        if (adGroupId) {
          await this.userService.updateParentAdsAttribution(savedUser._id, { adGroupId });
        } else {
          await this.userService.clearParentAdsAttribution(savedUser._id);
        }
      } else if (this.editingId && this.editingOriginalRole === this.parentRole && this.canManageParentAds()) {
        await this.userService.clearParentAdsAttribution(savedUser._id);
      }

      this.closeModal();
      await this.reload();
    } catch (error) {
      this.error.set(this.extractErrorMessage(error));
    }
  }

  edit(user: UserItem) {
    this.editingId = user._id;
    this.editingOriginalRole = user.role;
      this.form = {
        userCode: (user.userCode || '').trim(),
        email: user.email,
        phone: user.phone || '',
        password: '',
        fullName: user.fullName,
        role: user.role,
        facebookLink: user.facebookLink || '',
        address: user.address || '',
        saleOwnerId: user.saleOwnerId || '',
        adGroupId: user.adGroupId || '',
        managedSales: [],
      };
    if (this.isParentRole(user.role)) {
      if (this.canAssignParentOwner()) {
        void this.ensureSalesLoaded();
      }
      if (this.canManageParentAds()) {
        void this.ensureAdGroupsLoaded();
      }
    }
    if (this.parentMode()) this.selectedParentId = user._id;
    this.error.set('');
    this.showModal.set(true);
  }

  async remove(user: UserItem) {
    if (this.isSelf(user)) return;
    if (!confirm(`Xoa tai khoan ${user.email}?`)) return;
    try {
      await this.userService.remove(user._id);
      await this.reload();
    } catch {
      alert('Khong the xoa tai khoan');
    }
  }

  isSelf(user: UserItem): boolean {
    const current = this.auth.userSignal();
    return !!current && current.sub === user._id;
  }
}
