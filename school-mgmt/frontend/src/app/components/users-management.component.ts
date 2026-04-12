import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  ParentAdsAttributionItem,
  CreateUserSalaryConfigPayload,
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

interface TeacherOnboardingSalaryConfigDraft {
  baseSalary: number | null;
  standardHours: number;
  scheduledStartTime: string;
  latePenaltyAmount: number | null;
  notes: string;
}

interface UserManagementForm {
  userCode: string;
  email: string;
  phone: string;
  password: string;
  fullName: string;
  role: string;
  ownershipPercentage: number | null;
  facebookLink: string;
  address: string;
  saleOwnerId: string;
  adGroupId: string;
  managedSales: string[];
  salaryConfig: TeacherOnboardingSalaryConfigDraft | null;
}

@Component({
  selector: 'app-users-management',
  standalone: true,
  imports: [CommonModule, FormsModule, FlowGuideComponent],
  templateUrl: './users-management.component.html',
  styleUrls: ['./users-management.component.css'],
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
  form: UserManagementForm = this.buildEmptyForm('DIRECTOR');
  editingId: string | null = null;

  roleOptions: RoleOption[] = [
    { value: 'DIRECTOR', label: 'Giam doc', codeLabel: 'Ma giam doc', codeHint: 'VD: GD001' },
    { value: 'ACCOUNTING', label: 'Ke toan', codeLabel: 'Ma ke toan', codeHint: 'VD: KT001' },
    { value: 'OPS', label: 'Van hanh', codeLabel: 'Ma van hanh', codeHint: 'VD: OPS001' },
    { value: 'SALE', label: 'Sale', codeLabel: 'Ma sale', codeHint: 'VD: SALE001' },
    { value: 'ADSMANAGER', label: 'Ads manager', codeLabel: 'Ma ads manager', codeHint: 'VD: ADS001' },
    { value: 'TEACHER', label: 'Giao vien', codeLabel: 'Ma giao vien', codeHint: 'VD: GV001' },
    { value: 'PARENT', label: 'Phu huynh', codeLabel: 'Ma phu huynh', codeHint: 'VD: PH001' },
    { value: 'SHAREHOLDER', label: 'Co dong', codeLabel: 'Ma co dong', codeHint: 'VD: SH001' },
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

  isShareholderRole(role: string): boolean {
    return role === 'SHAREHOLDER';
  }

  private emptyTeacherSalaryConfig(): TeacherOnboardingSalaryConfigDraft {
    return {
      baseSalary: null,
      standardHours: 176,
      scheduledStartTime: '08:00',
      latePenaltyAmount: 0,
      notes: '',
    };
  }

  private buildEmptyForm(role: string): UserManagementForm {
    return {
      userCode: '',
      email: '',
      phone: '',
      password: '',
      fullName: '',
      role,
      ownershipPercentage: null,
      facebookLink: '',
      address: '',
      saleOwnerId: '',
      adGroupId: '',
      managedSales: [],
      salaryConfig: this.isTeacherRole(role) ? this.emptyTeacherSalaryConfig() : null,
    };
  }

  onFormRoleChange(role: string) {
    if (this.isParentRole(role)) {
      this.form.ownershipPercentage = null;
      this.form.managedSales = [];
      this.form.salaryConfig = null;
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
    if (!this.isShareholderRole(role)) {
      this.form.ownershipPercentage = null;
    }

    if (this.isTeacherRole(role)) {
      if (!this.form.managedSales.length) {
        this.form.managedSales = [''];
      }
      if (!this.form.salaryConfig) {
        this.form.salaryConfig = this.emptyTeacherSalaryConfig();
      }
      void this.ensureSalesLoaded();
      return;
    }

    this.form.managedSales = [];
    this.form.salaryConfig = null;
  }

  formatOwnershipPercentage(user: UserItem): string {
    if (!this.isShareholderRole(user.role)) {
      return '-';
    }

    const value = user.ownershipPercentage;
    if (value === null || value === undefined) {
      return '-';
    }

    return `${Number(value).toLocaleString('vi-VN', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })}%`;
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

    const parent = this.selectedParentDetail;
    const nextSale = this.salesOptions().find((sale) => sale._id === this.selectedParentSaleOwnerId) || null;
    if (!nextSale) {
      this.parentOwnerError.set('Khong tim thay sale phu trach moi');
      return;
    }

    const currentOwnerLabel = this.currentParentOwnerLabel(parent);
    const nextOwnerLabel = nextSale.fullName;
    const confirmMessage = `Chuyen sale phu trach tu ${currentOwnerLabel} sang ${nextOwnerLabel} cho ${parent?.fullName || 'phu huynh nay'}?`;
    if (!confirm(confirmMessage)) {
      return;
    }

    this.parentOwnerSaving.set(true);
    this.parentOwnerError.set('');
    this.parentOwnerSuccess.set('');

    try {
      const savedUser = await this.userService.update(this.selectedParentId, {
        saleOwnerId: this.selectedParentSaleOwnerId,
      });
      this.syncLocalParentOwner(this.selectedParentId, nextSale);
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
    const role = this.isSaleViewer() || this.parentMode() ? this.parentRole : 'DIRECTOR';
    this.form = this.buildEmptyForm(role);
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

  private buildTeacherSalaryConfigPayload(): CreateUserSalaryConfigPayload | null {
    const draft = this.form.salaryConfig;
    if (!draft) {
      this.error.set('Vui long khai bao salary config mac dinh cho giao vien');
      return null;
    }

    if (draft.baseSalary === null || draft.baseSalary === undefined || `${draft.baseSalary}`.trim() === '') {
      this.error.set('Vui long nhap luong cung mac dinh hop le cho giao vien');
      return null;
    }
    const baseSalary = Number(draft.baseSalary);
    if (!Number.isFinite(baseSalary) || baseSalary < 0) {
      this.error.set('Vui long nhap luong cung mac dinh hop le cho giao vien');
      return null;
    }

    if (draft.standardHours === null || draft.standardHours === undefined || `${draft.standardHours}`.trim() === '') {
      this.error.set('Vui long nhap so gio chuan hop le cho giao vien');
      return null;
    }
    const standardHours = Number(draft.standardHours);
    if (!Number.isFinite(standardHours) || standardHours < 1) {
      this.error.set('Vui long nhap so gio chuan hop le cho giao vien');
      return null;
    }

    const scheduledStartTime = draft.scheduledStartTime.trim();
    if (!scheduledStartTime) {
      this.error.set('Vui long nhap gio vao ca mac dinh cho giao vien');
      return null;
    }

    const latePenaltyAmount = Number(draft.latePenaltyAmount ?? 0);
    if (!Number.isFinite(latePenaltyAmount) || latePenaltyAmount < 0) {
      this.error.set('Phat di muon mac dinh khong duoc am');
      return null;
    }

    const notes = draft.notes.trim();
    return {
      baseSalary,
      standardHours,
      scheduledStartTime,
      latePenaltyAmount,
      commissionEnabled: false,
      commissionType: 'PROGRESSIVE',
      commissionTiers: [],
      kpiBonusEnabled: false,
      kpiBonusTiers: [],
      notes: notes || undefined,
    };
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
      const isCreateTeacher = !this.editingId && this.isTeacherRole(this.form.role);
      const adGroupId = isParentRole ? this.form.adGroupId.trim() : '';
      const managedSales = !this.editingId && this.isTeacherRole(this.form.role)
        ? Array.from(new Set(this.form.managedSales.map((saleId) => saleId.trim()).filter(Boolean)))
        : [];
      const saleOwnerId = this.isParentRole(this.form.role) ? this.form.saleOwnerId.trim() : '';
      const teacherSalaryConfig = isCreateTeacher ? this.buildTeacherSalaryConfigPayload() : undefined;
      if (isCreateTeacher && !teacherSalaryConfig) {
        return;
      }
      const salaryConfig = teacherSalaryConfig ?? undefined;
      const payload = {
        userCode,
        email: this.form.email.trim(),
        phone: this.form.phone.trim() || undefined,
        password: this.form.password.trim(),
        fullName: this.form.fullName.trim(),
        role: this.form.role,
        ownershipPercentage: this.isShareholderRole(this.form.role) && this.form.ownershipPercentage !== null
          ? Number(this.form.ownershipPercentage)
          : undefined,
        facebookLink: isParentRole ? this.form.facebookLink.trim() : undefined,
        address: isParentRole ? this.form.address.trim() : undefined,
        saleOwnerId: isParentRole && saleOwnerId ? saleOwnerId : undefined,
        managedSales: managedSales.length ? managedSales : undefined,
        salaryConfig,
      };

      let savedUser: UserItem;
      if (this.editingId) {
        const updatePayload: any = {
          userCode: payload.userCode,
          email: payload.email,
          phone: payload.phone,
          fullName: payload.fullName,
          role: payload.role,
          ownershipPercentage: payload.ownershipPercentage,
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
      ownershipPercentage: user.ownershipPercentage ?? null,
      facebookLink: user.facebookLink || '',
      address: user.address || '',
      saleOwnerId: user.saleOwnerId || '',
      adGroupId: user.adGroupId || '',
      managedSales: [],
      salaryConfig: null,
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
