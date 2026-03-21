import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  ChatbotService,
  AiAssistantProfileItem,
  FanpageItem,
  OpenAITokenItem,
} from '../services/chatbot.service';
import { AdsService, AdAccountItem } from '../services/ads.service';
import { AuthService } from '../services/auth.service';
import { Role } from '../models/role.enum';
import { FlowGuideComponent } from './shared/flow-guide.component';

const PLATFORM_LABELS: Record<string, string> = {
  FACEBOOK: 'Facebook',
  TIKTOK: 'TikTok',
};

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Hoat dong',
  INACTIVE: 'Ngung',
  EXPIRED: 'Het han',
  REVOKED: 'Da thu hoi',
};

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: '#15803d',
  INACTIVE: '#475569',
  EXPIRED: '#b91c1c',
  REVOKED: '#7f1d1d',
};

const SYNC_SOURCE_LABELS: Record<string, string> = {
  MANUAL: 'Nhap tay',
  FACEBOOK_BM: 'Dong bo BM',
};

const AI_ASSISTANT_TYPE_LABELS: Record<string, string> = {
  PARENT_SUPPORT: 'Cham soc phu huynh',
  INTERNAL_SUPPORT: 'Ho tro noi bo',
  TEACHER_SUPPORT: 'Tro ly giao vien',
  LEAD_CARE: 'Cham soc lead',
};

@Component({
  selector: 'app-chatbot-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, FlowGuideComponent],
  templateUrl: './chatbot-settings.component.html',
  styleUrls: ['./chatbot-settings.component.css'],
})
export class ChatbotSettingsComponent implements OnInit {
  activeTab = 'fanpages';

  fanpages = signal<FanpageItem[]>([]);
  tokens = signal<OpenAITokenItem[]>([]);
  aiAssistantProfiles = signal<AiAssistantProfileItem[]>([]);
  adAccounts = signal<AdAccountItem[]>([]);

  fpKeyword = '';
  fpFilterPlatform = '';
  fpFilterStatus = '';
  fpFilterSyncSource = '';

  showFpModal = signal(false);
  editingFanpage: FanpageItem | null = null;
  fpForm: any = this.emptyFpForm();
  fpError = signal('');

  showTokenModal = signal(false);
  editingToken: OpenAITokenItem | null = null;
  tokenForm: any = this.emptyTokenForm();
  tokenError = signal('');

  showAiProfileModal = signal(false);
  editingAiProfile: AiAssistantProfileItem | null = null;
  aiProfileForm: any = this.emptyAiProfileForm();
  aiProfileError = signal('');

  saving = signal(false);

  constructor(
    private readonly chatbotService: ChatbotService,
    private readonly adsService: AdsService,
    private readonly authService: AuthService,
  ) {}

  ngOnInit() {
    this.loadFanpages();
    this.loadTokens();
    this.loadAiAssistantProfiles();
    this.loadAdAccounts();
  }

  switchTab(tab: string) {
    if (tab === 'tokens' && !this.canManageTokenLibrary()) return;
    if (tab === 'profiles' && !this.canViewAiAssistantProfiles()) return;
    this.activeTab = tab;
  }

  platformLabel(value?: string) {
    return PLATFORM_LABELS[value || ''] || value || '-';
  }

  statusLabel(value?: string) {
    return STATUS_LABELS[value || ''] || value || '-';
  }

  statusColor(value?: string) {
    return STATUS_COLORS[value || ''] || '#475569';
  }

  syncSourceLabel(value?: string) {
    return SYNC_SOURCE_LABELS[value || ''] || value || 'Nhap tay';
  }

  aiAssistantTypeLabel(value?: string) {
    return AI_ASSISTANT_TYPE_LABELS[value || ''] || value || '-';
  }

  formatDate(value?: string | null) {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString('vi-VN');
  }

  canEditFanpages() {
    return this.authService.hasRole([Role.DIRECTOR, Role.OPS, Role.ADSMANAGER]);
  }

  canCreateFanpages() {
    return this.authService.hasRole([Role.DIRECTOR]);
  }

  canManageTokenLibrary() {
    return this.authService.hasRole([Role.DIRECTOR]);
  }

  canUseOpenAITokens() {
    return this.authService.hasRole([Role.DIRECTOR, Role.OPS, Role.ADSMANAGER]);
  }

  canViewAiAssistantProfiles() {
    return this.canUseOpenAITokens();
  }

  canManageAiAssistantProfiles() {
    return this.authService.hasRole([Role.DIRECTOR]);
  }

  openAITokenLabel(fanpage: FanpageItem) {
    if (fanpage.openaiTokenLabel) {
      return fanpage.openaiModel
        ? `${fanpage.openaiTokenLabel} (${fanpage.openaiModel})`
        : fanpage.openaiTokenLabel;
    }

    const token = this.tokens().find((item) => item._id === fanpage.openaiTokenId);
    if (!token) return '-';
    return `${token.label} (${token.model})`;
  }

  descriptionPreview(value?: string) {
    const description = (value || '').trim();
    if (!description) return '-';
    if (description.length <= 90) return description;
    return `${description.slice(0, 87)}...`;
  }

  emptyFpForm() {
    return {
      name: '',
      platform: '',
      pageId: '',
      pageAccessToken: '',
      description: '',
      adAccountId: '',
      openaiTokenId: '',
      webhookVerifyToken: '',
      appSecret: '',
      aiAutoReplyEnabled: true,
      status: 'ACTIVE',
    };
  }

  emptyTokenForm() {
    return {
      label: '',
      apiKey: '',
      model: 'gpt-4o-mini',
      temperature: 0.7,
      maxTokens: 2000,
      systemPromptPrefix: '',
      status: 'ACTIVE',
    };
  }

  emptyAiProfileForm() {
    return {
      assistantType: 'PARENT_SUPPORT',
      label: '',
      description: '',
      rulesPrompt: '',
      defaultOpenAITokenId: '',
      status: 'ACTIVE',
    };
  }

  isSyncedFacebookFanpage() {
    return this.editingFanpage?.syncSource === 'FACEBOOK_BM' && this.fpForm.platform === 'FACEBOOK';
  }

  async loadFanpages() {
    try {
      const params: Record<string, string> = {};
      if (this.fpKeyword) params['search'] = this.fpKeyword;
      if (this.fpFilterPlatform) params['platform'] = this.fpFilterPlatform;
      if (this.fpFilterStatus) params['status'] = this.fpFilterStatus;
      const result = await this.chatbotService.listFanpages(params);
      let items = result.data;
      if (this.fpFilterSyncSource) {
        items = items.filter((item) => (item.syncSource || 'MANUAL') === this.fpFilterSyncSource);
      }
      this.fanpages.set(items);
    } catch {
      this.fanpages.set([]);
    }
  }

  async loadTokens() {
    if (!this.canUseOpenAITokens()) {
      this.tokens.set([]);
      return;
    }
    try {
      const items = await this.chatbotService.listOpenAITokens();
      this.tokens.set(items);
    } catch {
      this.tokens.set([]);
    }
  }

  async loadAdAccounts() {
    try {
      const result = await this.adsService.listAccounts({ limit: '200' });
      this.adAccounts.set(result.data);
    } catch {
      this.adAccounts.set([]);
    }
  }

  async loadAiAssistantProfiles() {
    if (!this.canViewAiAssistantProfiles()) {
      this.aiAssistantProfiles.set([]);
      return;
    }

    try {
      const items = await this.chatbotService.listAiAssistantProfiles();
      this.aiAssistantProfiles.set(items);
    } catch {
      this.aiAssistantProfiles.set([]);
    }
  }

  openFanpageModal() {
    if (!this.canCreateFanpages()) return;
    this.editingFanpage = null;
    this.fpForm = this.emptyFpForm();
    this.fpError.set('');
    this.showFpModal.set(true);
  }

  editFanpage(fanpage: FanpageItem) {
    if (!this.canEditFanpages()) return;
    this.editingFanpage = fanpage;
    this.fpForm = {
      name: fanpage.name,
      platform: fanpage.platform,
      pageId: fanpage.pageId,
      pageAccessToken: '',
      description: fanpage.description || '',
      adAccountId: fanpage.adAccountId || '',
      openaiTokenId: fanpage.openaiTokenId || '',
      webhookVerifyToken: fanpage.webhookVerifyToken || '',
      appSecret: '',
      aiAutoReplyEnabled: fanpage.aiAutoReplyEnabled,
      status: fanpage.status,
    };
    this.fpError.set('');
    this.showFpModal.set(true);
  }

  closeFpModal() {
    this.showFpModal.set(false);
  }

  async saveFanpage() {
    if (!this.canEditFanpages()) return;
    if (!this.fpForm.name || !this.fpForm.platform || !this.fpForm.pageId) {
      this.fpError.set('Vui long dien du cac truong bat buoc.');
      return;
    }

    this.saving.set(true);
    this.fpError.set('');

    const data: any = { ...this.fpForm };
    if (this.isSyncedFacebookFanpage()) {
      delete data.pageAccessToken;
      delete data.platform;
      delete data.pageId;
      delete data.name;
    }

    if (this.editingFanpage) {
      if (!data.pageAccessToken) delete data.pageAccessToken;
      if (!data.appSecret) delete data.appSecret;
      if (!data.adAccountId) data.adAccountId = '';
      if (!data.openaiTokenId) data.openaiTokenId = '';
    } else {
      if (!data.adAccountId) delete data.adAccountId;
      if (!data.openaiTokenId) delete data.openaiTokenId;
    }

    const result = this.editingFanpage
      ? await this.chatbotService.updateFanpage(this.editingFanpage._id, data)
      : await this.chatbotService.createFanpage(data);

    this.saving.set(false);
    if (!result.ok) {
      this.fpError.set(result.message || 'Khong luu duoc fanpage.');
      return;
    }

    this.closeFpModal();
    await this.loadFanpages();
  }

  async removeFanpage(fanpage: FanpageItem) {
    if (!this.canCreateFanpages()) return;
    if (!confirm(`Xoa fanpage "${fanpage.name}"?`)) return;
    await this.chatbotService.deleteFanpage(fanpage._id);
    await this.loadFanpages();
  }

  openTokenModal() {
    if (!this.canManageTokenLibrary()) return;
    this.editingToken = null;
    this.tokenForm = this.emptyTokenForm();
    this.tokenError.set('');
    this.showTokenModal.set(true);
  }

  editToken(token: OpenAITokenItem) {
    if (!this.canManageTokenLibrary()) return;
    this.editingToken = token;
    this.tokenForm = {
      label: token.label,
      apiKey: '',
      model: token.model,
      temperature: token.temperature ?? 0.7,
      maxTokens: token.maxTokens ?? 2000,
      systemPromptPrefix: token.systemPromptPrefix || '',
      status: token.status,
    };
    this.tokenError.set('');
    this.showTokenModal.set(true);
  }

  closeTokenModal() {
    this.showTokenModal.set(false);
  }

  async saveToken() {
    if (!this.canManageTokenLibrary()) return;
    if (!this.tokenForm.label || (!this.editingToken && !this.tokenForm.apiKey)) {
      this.tokenError.set('Vui long dien du cac truong bat buoc.');
      return;
    }

    this.saving.set(true);
    this.tokenError.set('');

    const data: any = { ...this.tokenForm };
    if (this.editingToken && !data.apiKey) {
      delete data.apiKey;
    }

    const result = this.editingToken
      ? await this.chatbotService.updateOpenAIToken(this.editingToken._id, data)
      : await this.chatbotService.createOpenAIToken(data);

    this.saving.set(false);
    if (!result.ok) {
      this.tokenError.set(result.message || 'Khong luu duoc token.');
      return;
    }

    this.closeTokenModal();
    await this.loadTokens();
  }

  async removeToken(token: OpenAITokenItem) {
    if (!this.canManageTokenLibrary()) return;
    if (!confirm(`Xoa token "${token.label}"?`)) return;
    await this.chatbotService.deleteOpenAIToken(token._id);
    await this.loadTokens();
  }

  openAiProfileModal() {
    if (!this.canManageAiAssistantProfiles()) return;
    this.editingAiProfile = null;
    this.aiProfileForm = this.emptyAiProfileForm();
    this.aiProfileError.set('');
    this.showAiProfileModal.set(true);
  }

  editAiProfile(profile: AiAssistantProfileItem) {
    if (!this.canManageAiAssistantProfiles()) return;
    this.editingAiProfile = profile;
    this.aiProfileForm = {
      assistantType: profile.assistantType,
      label: profile.label,
      description: profile.description || '',
      rulesPrompt: profile.rulesPrompt || '',
      defaultOpenAITokenId: profile.defaultOpenAITokenId || '',
      status: profile.status,
    };
    this.aiProfileError.set('');
    this.showAiProfileModal.set(true);
  }

  closeAiProfileModal() {
    this.showAiProfileModal.set(false);
  }

  aiProfileTokenLabel(profile: AiAssistantProfileItem) {
    if (profile.defaultOpenAITokenLabel) {
      return profile.defaultOpenAIModel
        ? `${profile.defaultOpenAITokenLabel} (${profile.defaultOpenAIModel})`
        : profile.defaultOpenAITokenLabel;
    }

    const token = this.tokens().find((item) => item._id === profile.defaultOpenAITokenId);
    if (!token) return '-';
    return `${token.label} (${token.model})`;
  }

  rulesPreview(value?: string) {
    const rules = (value || '').trim();
    if (!rules) return '-';
    if (rules.length <= 120) return rules;
    return `${rules.slice(0, 117)}...`;
  }

  async saveAiProfile() {
    if (!this.canManageAiAssistantProfiles()) return;
    if (!this.aiProfileForm.assistantType || !this.aiProfileForm.label) {
      this.aiProfileError.set('Vui long dien du cac truong bat buoc.');
      return;
    }

    this.saving.set(true);
    this.aiProfileError.set('');

    const data: any = { ...this.aiProfileForm };
    if (!data.defaultOpenAITokenId) data.defaultOpenAITokenId = '';

    const result = this.editingAiProfile
      ? await this.chatbotService.updateAiAssistantProfile(this.editingAiProfile._id, data)
      : await this.chatbotService.createAiAssistantProfile(data);

    this.saving.set(false);
    if (!result.ok) {
      this.aiProfileError.set(result.message || 'Khong luu duoc AI profile.');
      return;
    }

    this.closeAiProfileModal();
    await this.loadAiAssistantProfiles();
  }

  async removeAiProfile(profile: AiAssistantProfileItem) {
    if (!this.canManageAiAssistantProfiles()) return;
    if (!confirm(`Xoa AI profile "${profile.label}"?`)) return;
    await this.chatbotService.deleteAiAssistantProfile(profile._id);
    await this.loadAiAssistantProfiles();
  }
}
