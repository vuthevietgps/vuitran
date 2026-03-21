import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  AdAccountItem,
  AdGroupBackfillResult,
  AdCostItem,
  AdGroupItem,
  AdsService,
  ApiTokenItem,
  ParentAttributionBackfillResult,
} from '../services/ads.service';
import { AuditLogService } from '../services/audit-log.service';
import { AuthService } from '../services/auth.service';
import { Role } from '../models/role.enum';
import { FlowGuideComponent } from './shared/flow-guide.component';
import { AdsActionsComponent } from './ads-actions.component';

const PLATFORM_LABELS: Record<string, string> = {
  FACEBOOK: 'Facebook',
  GOOGLE: 'Google',
  TIKTOK: 'TikTok',
};

const ACCOUNT_STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Hoat dong',
  PAUSED: 'Tam dung',
  DISABLED: 'Vo hieu',
};

const GROUP_STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Hoat dong',
  PAUSED: 'Tam dung',
  ARCHIVED: 'Luu tru',
};

const TOKEN_STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Hoat dong',
  EXPIRED: 'Het han',
  REVOKED: 'Da thu hoi',
};

const TOKEN_TYPE_LABELS: Record<string, string> = {
  ACCOUNT: 'Token tai khoan quang cao',
  FACEBOOK_SYSTEM_USER: 'Facebook BM / System User',
  GOOGLE_MCC: 'Google MCC',
  TIKTOK_BUSINESS_CENTER: 'TikTok Business Center',
};

const SYNC_SOURCE_LABELS: Record<string, string> = {
  MANUAL: 'Nhap tay',
  FACEBOOK_BM: 'Dong bo BM',
  GOOGLE_MCC: 'Dong bo MCC',
  TIKTOK_BC: 'Dong bo BC',
};

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: '#15803d',
  PAUSED: '#b45309',
  DISABLED: '#b91c1c',
  ARCHIVED: '#475569',
  EXPIRED: '#b91c1c',
  REVOKED: '#7f1d1d',
};

type MaintenanceResultView = {
  title: string;
  description: string;
  items: Array<{ label: string; value: number | string }>;
};

type MaintenanceHistoryItem = {
  title: string;
  actor: string;
  actorEmail: string;
  createdAt: string;
  summary: string;
};

@Component({
  selector: 'app-ads-management',
  standalone: true,
  imports: [CommonModule, FormsModule, FlowGuideComponent, AdsActionsComponent],
  templateUrl: './ads-management.component.html',
  styleUrls: ['./ads-management.component.css'],
})
export class AdsManagementComponent implements OnInit {
  activeTab = 'accounts';

  accounts = signal<AdAccountItem[]>([]);
  allAccounts = signal<AdAccountItem[]>([]);
  groups = signal<AdGroupItem[]>([]);
  allGroupsList = signal<AdGroupItem[]>([]);
  tokens = signal<ApiTokenItem[]>([]);
  costs = signal<AdCostItem[]>([]);
  error = signal('');
  syncing = signal(false);
  syncResult = signal<any | null>(null);
  maintenanceRunning = signal(false);
  maintenanceResult = signal<MaintenanceResultView | null>(null);
  maintenanceHistory = signal<MaintenanceHistoryItem[]>([]);
  maintenanceHistoryLoading = signal(false);

  showAccountModal = signal(false);
  showGroupModal = signal(false);
  showTokenModal = signal(false);
  showCostModal = signal(false);

  editingAccount: AdAccountItem | null = null;
  editingGroup: AdGroupItem | null = null;
  editingToken: ApiTokenItem | null = null;

  accKeyword = '';
  accFilterPlatform = '';
  accFilterStatus = '';

  grpKeyword = '';
  grpFilterPlatform = '';
  grpFilterStatus = '';
  grpFilterAccount = '';

  tokenFilterType = '';
  tokenFilterPlatform = '';

  costStartDate = '';
  costEndDate = '';
  costFilterPlatform = '';
  costFilterGroup = '';

  accForm: any = {};
  grpForm: any = {};
  tokenForm: any = {};
  costForm: any = {};

  constructor(
    private readonly adsService: AdsService,
    private readonly auditLogService: AuditLogService,
    private readonly authService: AuthService,
    private readonly router: Router,
  ) {}

  ngOnInit() {
    const now = new Date();
    this.costEndDate = this.toDateInput(now);
    this.costStartDate = this.toDateInput(new Date(now.getTime() - 30 * 86400000));

    this.loadAccounts();
    this.loadAllAccounts();
    this.loadAllGroups();
    if (this.canManageTokens()) {
      this.loadTokens();
    }
    if (this.canRunBackfill()) {
      void this.loadMaintenanceHistory();
    }
  }

  switchTab(tab: string) {
    if (tab === 'tokens' && !this.canManageTokens()) return;
    this.activeTab = tab;
    if (tab === 'accounts') this.loadAccounts();
    if (tab === 'groups') this.loadGroups();
    if (tab === 'tokens') this.loadTokens();
    if (tab === 'costs') this.loadCosts();
    if (tab === 'costs' && this.canRunBackfill()) {
      void this.loadMaintenanceHistory();
    }
  }

  canViewActions() {
    return this.authService.hasRole([Role.DIRECTOR, Role.OPS, Role.ADSMANAGER]);
  }

  platformLabel(value?: string) {
    return PLATFORM_LABELS[value || ''] || value || '-';
  }

  accountStatusLabel(value?: string) {
    return ACCOUNT_STATUS_LABELS[value || ''] || value || '-';
  }

  groupStatusLabel(value?: string) {
    return GROUP_STATUS_LABELS[value || ''] || value || '-';
  }

  tokenStatusLabel(value?: string) {
    return TOKEN_STATUS_LABELS[value || ''] || value || '-';
  }

  tokenTypeLabel(value?: string) {
    return TOKEN_TYPE_LABELS[value || ''] || value || 'Token';
  }

  syncSourceLabel(value?: string) {
    return SYNC_SOURCE_LABELS[value || ''] || value || 'Nhap tay';
  }

  statusColor(value?: string) {
    return STATUS_COLORS[value || ''] || '#475569';
  }

  isDirector() {
    return this.authService.hasRole([Role.DIRECTOR]);
  }

  canManageAccounts() {
    return this.isDirector();
  }

  canManageGroups() {
    return this.authService.hasRole([Role.DIRECTOR, Role.OPS, Role.ADSMANAGER]);
  }

  canDeleteGroups() {
    return this.isDirector();
  }

  canManageTokens() {
    return this.isDirector();
  }

  canManageCosts() {
    return this.isDirector();
  }

  canTriggerSync() {
    return this.isDirector();
  }

  canRunBackfill() {
    return this.isDirector();
  }

  toDateInput(value?: string | Date | null) {
    if (!value) return '';
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toISOString().split('T')[0];
  }

  currencyAmount(amount?: number | null) {
    if (amount === undefined || amount === null) return '-';
    return `${Number(amount).toLocaleString('vi-VN')}đ`;
  }

  syncErrors() {
    const result = this.syncResult();
    if (!result) return [];
    return result.errors || result.data?.errors || [];
  }

  syncCount(key: string) {
    const result = this.syncResult();
    if (!result) return 0;
    return result[key] ?? result.data?.[key] ?? 0;
  }

  tokenTargetLabel(token: ApiTokenItem) {
    if (this.isManagerTokenType(token.tokenType)) {
      if (token.businessName || token.businessId) {
        return `${token.businessName || this.tokenBusinessTargetLabel(token.tokenType)}${token.businessId ? ` (${token.businessId})` : ''}`;
      }
      return `Tat ca ${this.tokenBusinessTargetLabel(token.tokenType).toLowerCase()} token truy cap duoc`;
    }
    return token.adAccountName || token.adAccountId || '-';
  }

  isManagerTokenType(tokenType?: string) {
    return ['FACEBOOK_SYSTEM_USER', 'GOOGLE_MCC', 'TIKTOK_BUSINESS_CENTER'].includes(tokenType || '');
  }

  isManagerTokenForm() {
    return this.isManagerTokenType(this.tokenForm.tokenType);
  }

  tokenBusinessTargetLabel(tokenType?: string) {
    if (tokenType === 'GOOGLE_MCC') return 'MCC';
    if (tokenType === 'TIKTOK_BUSINESS_CENTER') return 'Business Center';
    return 'Business Manager';
  }

  tokenBusinessIdLabel() {
    if (this.tokenForm.tokenType === 'GOOGLE_MCC') return 'MCC customer ID';
    if (this.tokenForm.tokenType === 'TIKTOK_BUSINESS_CENTER') return 'Business Center ID';
    return 'Business ID';
  }

  tokenBusinessNameLabel() {
    if (this.tokenForm.tokenType === 'GOOGLE_MCC') return 'MCC name';
    if (this.tokenForm.tokenType === 'TIKTOK_BUSINESS_CENTER') return 'Business Center name';
    return 'Business name';
  }

  tokenHelperText() {
    if (this.tokenForm.tokenType === 'GOOGLE_MCC') {
      return 'Sau khi luu token MCC, bam Dong bo de keo danh sach customer ads, campaign va chi phi Google Ads theo ngay.';
    }
    if (this.tokenForm.tokenType === 'TIKTOK_BUSINESS_CENTER') {
      return 'Sau khi luu token Business Center, bam Dong bo de keo danh sach advertiser, campaign va chi phi TikTok Ads theo ngay.';
    }
    return 'Sau khi luu token BM, bam Dong bo de keo danh sach ad account, fanpage, page access token va chi phi ads theo ad set tung ngay.';
  }

  onTokenTypeChange() {
    if (this.isManagerTokenForm()) {
      if (this.tokenForm.tokenType === 'GOOGLE_MCC') this.tokenForm.platform = 'GOOGLE';
      else if (this.tokenForm.tokenType === 'TIKTOK_BUSINESS_CENTER') this.tokenForm.platform = 'TIKTOK';
      else this.tokenForm.platform = 'FACEBOOK';
      this.tokenForm.adAccountId = '';
    } else {
      this.tokenForm.businessId = '';
      this.tokenForm.businessName = '';
      this.onTokenAccountChange();
    }
  }

  onTokenAccountChange() {
    const account = this.allAccounts().find((item) => item._id === this.tokenForm.adAccountId);
    this.tokenForm.platform = account?.platform || '';
  }

  onGroupAccountChange() {
    const account = this.allAccounts().find((item) => item._id === this.grpForm.adAccountId);
    this.grpForm.platform = account?.platform || '';
  }

  onCostGroupChange() {
    const group = this.allGroupsList().find((item) => item._id === this.costForm.adGroupId);
    this.costForm.adAccountId = group?.adAccountId || '';
    this.costForm.platform = group?.platform || '';
  }

  async loadAccounts() {
    try {
      this.error.set('');
      const params: Record<string, string> = {};
      if (this.accKeyword) params['search'] = this.accKeyword;
      if (this.accFilterPlatform) params['platform'] = this.accFilterPlatform;
      if (this.accFilterStatus) params['status'] = this.accFilterStatus;
      const result = await this.adsService.listAccounts(params);
      this.accounts.set(result.data);
    } catch {
      this.accounts.set([]);
      this.error.set('Khong tai duoc danh sach tai khoan quang cao.');
    }
  }

  async loadAllAccounts() {
    try {
      const result = await this.adsService.listAccounts({ limit: '300' });
      this.allAccounts.set(result.data);
    } catch {
      this.allAccounts.set([]);
    }
  }

  async loadGroups() {
    try {
      this.error.set('');
      const params: Record<string, string> = {};
      if (this.grpKeyword) params['search'] = this.grpKeyword;
      if (this.grpFilterPlatform) params['platform'] = this.grpFilterPlatform;
      if (this.grpFilterStatus) params['status'] = this.grpFilterStatus;
      if (this.grpFilterAccount) params['adAccountId'] = this.grpFilterAccount;
      const result = await this.adsService.listGroups(params);
      this.groups.set(result.data);
    } catch {
      this.groups.set([]);
      this.error.set('Khong tai duoc danh sach nhom quang cao.');
    }
  }

  async loadAllGroups() {
    try {
      const result = await this.adsService.getAllGroups();
      this.allGroupsList.set(result);
    } catch {
      this.allGroupsList.set([]);
    }
  }

  async loadTokens() {
    if (!this.canManageTokens()) return;
    try {
      this.error.set('');
      let result = await this.adsService.listTokens();
      if (this.tokenFilterType) {
        result = result.filter((item) => item.tokenType === this.tokenFilterType);
      }
      if (this.tokenFilterPlatform) {
        result = result.filter((item) => item.platform === this.tokenFilterPlatform);
      }
      this.tokens.set(result);
    } catch {
      this.tokens.set([]);
      this.error.set('Khong tai duoc danh sach API token.');
    }
  }

  async loadCosts() {
    try {
      this.error.set('');
      const params: Record<string, string> = {};
      if (this.costStartDate) params['startDate'] = this.costStartDate;
      if (this.costEndDate) params['endDate'] = this.costEndDate;
      if (this.costFilterPlatform) params['platform'] = this.costFilterPlatform;
      if (this.costFilterGroup) params['adGroupId'] = this.costFilterGroup;
      const result = await this.adsService.listCosts(params);
      this.costs.set(result.data);
    } catch {
      this.costs.set([]);
      this.error.set('Khong tai duoc du lieu chi phi ads.');
    }
  }

  async loadMaintenanceHistory() {
    if (!this.canRunBackfill()) return;
    this.maintenanceHistoryLoading.set(true);
    try {
      const result = await this.auditLogService.getAll({
        module: 'ADS',
        page: 1,
        limit: 6,
      });
      const items = Array.isArray(result?.data) ? result.data : [];
      this.maintenanceHistory.set(
        items
          .filter((item: any) => ['backfill-parent-attribution', 'backfill-adgroup'].includes(item?.targetId))
          .map((item: any) => this.mapMaintenanceHistoryItem(item)),
      );
    } catch {
      this.maintenanceHistory.set([]);
    } finally {
      this.maintenanceHistoryLoading.set(false);
    }
  }

  openAccountModal() {
    if (!this.canManageAccounts()) return;
    this.editingAccount = null;
    this.accForm = {
      name: '',
      platform: '',
      platformAccountId: '',
      monthlyBudget: 0,
      notes: '',
    };
    this.error.set('');
    this.showAccountModal.set(true);
  }

  editAccount(account: AdAccountItem) {
    if (!this.canManageAccounts()) return;
    this.editingAccount = account;
    this.accForm = {
      name: account.name,
      platform: account.platform,
      platformAccountId: account.platformAccountId,
      monthlyBudget: account.monthlyBudget || 0,
      status: account.status,
      notes: account.notes || '',
    };
    this.error.set('');
    this.showAccountModal.set(true);
  }

  async submitAccount() {
    if (!this.canManageAccounts()) return;
    this.error.set('');
    const result = this.editingAccount
      ? await this.adsService.updateAccount(this.editingAccount._id, this.accForm)
      : await this.adsService.createAccount(this.accForm);
    if (!result.ok) {
      this.error.set(result.message || 'Khong luu duoc tai khoan.');
      return;
    }
    this.showAccountModal.set(false);
    await Promise.all([this.loadAccounts(), this.loadAllAccounts()]);
  }

  async removeAccount(account: AdAccountItem) {
    if (!this.canManageAccounts()) return;
    if (!confirm(`Xoa tai khoan "${account.name}"?`)) return;
    const result = await this.adsService.deleteAccount(account._id);
    if (!result.ok) {
      alert(result.message || 'Khong xoa duoc tai khoan.');
      return;
    }
    await Promise.all([this.loadAccounts(), this.loadAllAccounts(), this.loadTokens()]);
  }

  openGroupModal() {
    if (!this.canManageGroups()) return;
    this.editingGroup = null;
    this.grpForm = {
      name: '',
      adAccountId: '',
      platform: '',
      platformCampaignId: '',
      dailyBudget: 0,
      startDate: '',
      endDate: '',
      targetAudience: '',
      notes: '',
      trackingKeysInput: '',
    };
    this.error.set('');
    this.showGroupModal.set(true);
  }

  editGroup(group: AdGroupItem) {
    if (!this.canManageGroups()) return;
    this.editingGroup = group;
    this.grpForm = {
      name: group.name,
      adAccountId: group.adAccountId,
      platform: group.platform,
      platformCampaignId: group.platformCampaignId,
      dailyBudget: group.dailyBudget || 0,
      startDate: this.toDateInput(group.startDate),
      endDate: this.toDateInput(group.endDate),
      targetAudience: group.targetAudience || '',
      status: group.status,
      notes: group.notes || '',
      trackingKeysInput: (group.trackingKeys || []).join(', '),
    };
    this.error.set('');
    this.showGroupModal.set(true);
  }

  parseTrackingKeysInput(value?: string) {
    return Array.from(
      new Set(
        String(value || '')
          .split(/[\n,]+/)
          .map((item) => item.trim())
          .filter(Boolean),
      ),
    );
  }

  async submitGroup() {
    if (!this.canManageGroups()) return;
    this.error.set('');
    const payload = {
      ...this.grpForm,
      trackingKeys: this.parseTrackingKeysInput(this.grpForm.trackingKeysInput),
    };
    delete payload.trackingKeysInput;
    const result = this.editingGroup
      ? await this.adsService.updateGroup(this.editingGroup._id, payload)
      : await this.adsService.createGroup(payload);
    if (!result.ok) {
      this.error.set(result.message || 'Khong luu duoc nhom quang cao.');
      return;
    }
    this.showGroupModal.set(false);
    await Promise.all([this.loadGroups(), this.loadAllGroups()]);
  }

  async removeGroup(group: AdGroupItem) {
    if (!this.canDeleteGroups()) return;
    if (!confirm(`Xoa nhom "${group.name}"?`)) return;
    const result = await this.adsService.deleteGroup(group._id);
    if (!result.ok) {
      alert(result.message || 'Khong xoa duoc nhom quang cao.');
      return;
    }
    await Promise.all([this.loadGroups(), this.loadAllGroups(), this.loadCosts()]);
  }

  openTokenModal() {
    if (!this.canManageTokens()) return;
    this.editingToken = null;
    this.tokenForm = {
      tokenType: 'FACEBOOK_SYSTEM_USER',
      platform: 'FACEBOOK',
      adAccountId: '',
      businessId: '',
      businessName: '',
      accessToken: '',
      refreshToken: '',
      expiresAt: '',
      label: '',
      status: 'ACTIVE',
    };
    this.error.set('');
    this.showTokenModal.set(true);
  }

  editToken(token: ApiTokenItem) {
    if (!this.canManageTokens()) return;
    this.editingToken = token;
    this.tokenForm = {
      tokenType: token.tokenType || 'ACCOUNT',
      platform: token.platform,
      adAccountId: token.adAccountId || '',
      businessId: token.businessId || '',
      businessName: token.businessName || '',
      accessToken: '',
      refreshToken: '',
      expiresAt: this.toDateInput(token.expiresAt),
      label: token.label || '',
      status: token.status,
    };
    this.error.set('');
    this.showTokenModal.set(true);
  }

  async submitToken() {
    if (!this.canManageTokens()) return;
    this.error.set('');

    const payload: any = this.editingToken
      ? {
          // Update DTO fields
          tokenType: this.tokenForm.tokenType,
          label: this.tokenForm.label || undefined,
          status: this.tokenForm.status || undefined,
          businessId: this.tokenForm.businessId || undefined,
          businessName: this.tokenForm.businessName || undefined,
          expiresAt: this.tokenForm.expiresAt || undefined,
          refreshToken: this.tokenForm.refreshToken || undefined,
          adAccountId: this.tokenForm.adAccountId || undefined,
        }
      : {
          // Create DTO fields
          tokenType: this.tokenForm.tokenType,
          platform: this.tokenForm.platform,
          label: this.tokenForm.label || undefined,
          businessId: this.tokenForm.businessId || undefined,
          businessName: this.tokenForm.businessName || undefined,
          expiresAt: this.tokenForm.expiresAt || undefined,
          refreshToken: this.tokenForm.refreshToken || undefined,
          adAccountId: this.tokenForm.adAccountId || undefined,
        };

    if (this.tokenForm.accessToken) {
      payload.accessToken = this.tokenForm.accessToken;
    }

    if (this.isManagerTokenType(payload.tokenType)) {
      if (payload.tokenType === 'GOOGLE_MCC') payload.platform = 'GOOGLE';
      if (payload.tokenType === 'TIKTOK_BUSINESS_CENTER') payload.platform = 'TIKTOK';
      if (payload.tokenType === 'FACEBOOK_SYSTEM_USER') payload.platform = 'FACEBOOK';
      delete payload.adAccountId;
    } else {
      delete payload.businessId;
      delete payload.businessName;
    }

    const result = this.editingToken
      ? await this.adsService.updateToken(this.editingToken._id, payload)
      : await this.adsService.createToken(payload);
    if (!result.ok) {
      this.error.set(result.message || 'Khong luu duoc token.');
      return;
    }
    this.showTokenModal.set(false);
    await this.loadTokens();
  }

  async removeToken(token: ApiTokenItem) {
    if (!this.canManageTokens()) return;
    if (!confirm('Xoa token nay?')) return;
    const result = await this.adsService.deleteToken(token._id);
    if (!result.ok) {
      alert(result.message || 'Khong xoa duoc token.');
      return;
    }
    await this.loadTokens();
  }

  openCostModal() {
    if (!this.canManageCosts()) return;
    this.costForm = {
      adGroupId: '',
      adAccountId: '',
      platform: '',
      date: this.toDateInput(new Date()),
      spend: 0,
      impressions: 0,
      clicks: 0,
      conversions: 0,
    };
    this.error.set('');
    this.showCostModal.set(true);
  }

  async submitCost() {
    if (!this.canManageCosts()) return;
    this.error.set('');
    const result = await this.adsService.createCost({
      ...this.costForm,
      source: 'MANUAL',
    });
    if (!result.ok) {
      this.error.set(result.message || 'Khong luu duoc chi phi.');
      return;
    }
    this.showCostModal.set(false);
    await this.loadCosts();
  }

  async removeCost(cost: AdCostItem) {
    if (!this.canManageCosts()) return;
    if (!confirm('Xoa ban ghi chi phi nay?')) return;
    const result = await this.adsService.deleteCost(cost._id);
    if (!result.ok) {
      alert(result.message || 'Khong xoa duoc ban ghi chi phi.');
      return;
    }
    await this.loadCosts();
  }

  async syncToken(token: ApiTokenItem) {
    if (!this.canManageTokens()) return;
    if (!this.isManagerTokenType(token.tokenType) && !token.adAccountId) {
      alert('Token nay chua gan voi tai khoan quang cao.');
      return;
    }
    this.syncing.set(true);
    this.error.set('');

    const result = token.tokenType === 'FACEBOOK_SYSTEM_USER'
      ? await this.adsService.syncFacebookBusinessToken(token._id)
      : token.tokenType === 'GOOGLE_MCC'
        ? await this.adsService.syncGoogleMccToken(token._id)
        : token.tokenType === 'TIKTOK_BUSINESS_CENTER'
          ? await this.adsService.syncTikTokBusinessCenterToken(token._id)
          : await this.adsService.triggerSync(token.adAccountId);

    this.syncing.set(false);
    if (!result.ok) {
      alert(result.message || 'Dong bo that bai.');
      return;
    }

    this.syncResult.set(result.data || result);
    await Promise.all([
      this.loadTokens(),
      this.loadAccounts(),
      this.loadAllAccounts(),
      this.loadGroups(),
      this.loadAllGroups(),
      this.loadCosts(),
    ]);
  }

  async triggerSync() {
    if (!this.canTriggerSync()) return;
    this.syncing.set(true);
    const result = await this.adsService.triggerSync();
    this.syncing.set(false);
    if (!result.ok) {
      alert(result.message || 'Dong bo that bai.');
      return;
    }
    this.syncResult.set(result.data || result);
    await this.loadCosts();
  }

  private openMaintenanceResult(
    title: string,
    description: string,
    items: Array<{ label: string; value: number | string }>,
  ) {
    this.maintenanceResult.set({ title, description, items });
  }

  async runParentAttributionBackfill() {
    if (!this.canRunBackfill()) return;
    if (!confirm('Chay backfill parent attribution cho du lieu cu?')) return;

    this.maintenanceRunning.set(true);
    this.error.set('');
    const result = await this.adsService.backfillParentAttribution();
    this.maintenanceRunning.set(false);

    if (!result.ok || !result.data) {
      alert(result.message || 'Backfill parent attribution that bai.');
      return;
    }

    await this.loadMaintenanceHistory();
    this.openMaintenanceResult(
      'Ket qua backfill parent attribution',
      'Da quet lai conversation, lead, order va student cu de bo sung parent attribution.',
      this.mapParentAttributionBackfillItems(result.data),
    );
  }

  async runAdGroupBackfill() {
    if (!this.canRunBackfill()) return;
    if (!confirm('Chay backfill adGroup cho student/session cu?')) return;

    this.maintenanceRunning.set(true);
    this.error.set('');
    const result = await this.adsService.backfillAdGroupIds();
    this.maintenanceRunning.set(false);

    if (!result.ok || !result.data) {
      alert(result.message || 'Backfill adGroup that bai.');
      return;
    }

    await this.loadMaintenanceHistory();
    this.openMaintenanceResult(
      'Ket qua backfill adGroup',
      'Da bo sung adGroup tu order cu sang student va session chua co tracking nhom quang cao.',
      this.mapAdGroupBackfillItems(result.data),
    );
  }

  private mapParentAttributionBackfillItems(data: ParentAttributionBackfillResult) {
    return [
      { label: 'Conversations', value: data.conversations },
      { label: 'Leads', value: data.leads },
      { label: 'Orders', value: data.orders },
      { label: 'Students', value: data.students },
      { label: 'Upserted', value: data.upserted },
    ];
  }

  private mapAdGroupBackfillItems(data: AdGroupBackfillResult) {
    return [
      { label: 'Students updated', value: data.studentsUpdated },
      { label: 'Sessions updated', value: data.sessionsUpdated },
    ];
  }

  private mapMaintenanceHistoryItem(item: any): MaintenanceHistoryItem {
    const payload = item?.newValue || {};
    const isParentAttribution = payload.operation === 'BACKFILL_PARENT_ATTRIBUTION'
      || item?.targetId === 'backfill-parent-attribution';

    return {
      title: item?.targetName || (isParentAttribution ? 'Backfill parent attribution' : 'Backfill adGroup'),
      actor: item?.userFullName || 'He thong',
      actorEmail: item?.userEmail || '',
      createdAt: item?.createdAt || '',
      summary: isParentAttribution
        ? `Conv ${payload.conversations || 0} | Leads ${payload.leads || 0} | Orders ${payload.orders || 0} | Students ${payload.students || 0} | Upserted ${payload.upserted || 0}`
        : `Students updated ${payload.studentsUpdated || 0} | Sessions updated ${payload.sessionsUpdated || 0}`,
    };
  }

  closeSyncResult() {
    this.syncResult.set(null);
  }

  closeMaintenanceResult() {
    this.maintenanceResult.set(null);
  }

  async openFanpageSettings() {
    this.closeSyncResult();
    await this.router.navigate(['/app/chatbot-settings']);
  }
}
