import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdGroupItem, AdsService } from '../../services/ads.service';
import {
  LandingPageItem,
  LandingPageService,
  LandingPageSubmissionItem,
} from '../../services/landing-page.service';
import { AuthService } from '../../services/auth.service';
import { Role } from '../../models/role.enum';
import { FlowGuideComponent } from '../shared/flow-guide.component';

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Nhap',
  ACTIVE: 'Hoat dong',
  ARCHIVED: 'Luu tru',
};

const PLATFORM_LABELS: Record<string, string> = {
  FACEBOOK: 'Facebook',
  GOOGLE: 'Google',
  TIKTOK: 'TikTok',
};

const MATCH_LABELS: Record<string, string> = {
  NONE: 'Chua match',
  USER_PHONE: 'Match user theo phone',
  USER_EMAIL: 'Match user theo email',
  STUDENT_PARENT: 'Match qua hoc sinh',
};

@Component({
  selector: 'app-landing-pages-management',
  standalone: true,
  imports: [CommonModule, FormsModule, FlowGuideComponent],
  templateUrl: './landing-pages-management.component.html',
  styleUrls: ['./landing-pages-management.component.css'],
})
export class LandingPagesManagementComponent implements OnInit {
  readonly activeTab = signal<'pages' | 'submissions'>('pages');
  readonly pages = signal<LandingPageItem[]>([]);
  readonly submissions = signal<LandingPageSubmissionItem[]>([]);
  readonly allGroups = signal<AdGroupItem[]>([]);
  readonly error = signal('');
  readonly loading = signal(false);
  readonly showModal = signal(false);

  editingPage: LandingPageItem | null = null;

  pageSearch = '';
  pageStatus = '';
  submissionSearch = '';
  submissionLandingPageId = '';

  form: any = this.createEmptyForm();

  readonly filteredPages = computed(() => {
    const keyword = this.pageSearch.trim().toLowerCase();
    const status = this.pageStatus;

    return this.pages().filter((page) => {
      const matchesStatus = !status || page.status === status;
      const haystack = `${page.name} ${page.slug} ${page.pageCode}`.toLowerCase();
      const matchesKeyword = !keyword || haystack.includes(keyword);
      return matchesStatus && matchesKeyword;
    });
  });

  readonly filteredSubmissions = computed(() => {
    const keyword = this.submissionSearch.trim().toLowerCase();
    const landingPageId = this.submissionLandingPageId;

    return this.submissions().filter((submission) => {
      const matchesPage = !landingPageId || submission.landingPageId === landingPageId;
      const haystack = [
        submission.parentName,
        submission.parentPhone,
        submission.studentName || '',
        submission.landingPageName,
        submission.leadCode || '',
      ].join(' ').toLowerCase();
      const matchesKeyword = !keyword || haystack.includes(keyword);
      return matchesPage && matchesKeyword;
    });
  });

  constructor(
    private readonly landingPageService: LandingPageService,
    private readonly adsService: AdsService,
    private readonly authService: AuthService,
  ) {}

  async ngOnInit() {
    await Promise.all([
      this.loadPages(),
      this.loadSubmissions(),
      this.loadGroups(),
    ]);
  }

  private createEmptyForm() {
    return {
      name: '',
      slug: '',
      status: 'DRAFT',
      heroTitle: '',
      heroSubtitle: '',
      formTitle: '',
      formDescription: '',
      submitButtonText: 'Nhan tu van ngay',
      privacyNotice: 'Thong tin chi duoc dung de tu van va lien he phu huynh.',
      successTitle: 'Da ghi nhan',
      successMessage: 'Chung toi se lien he voi phu huynh trong thoi gian som nhat.',
      bodyHtml: '',
      defaultPlatform: '',
      defaultAdGroupId: '',
      autoCreateLead: true,
      metaPixelId: '',
      googleTagId: '',
      googleAdsConversionId: '',
      googleAdsConversionLabel: '',
      tiktokPixelId: '',
      customHeadHtml: '',
      customBodyHtml: '',
      notes: '',
    };
  }

  async loadPages() {
    this.pages.set(await this.landingPageService.list());
  }

  async loadSubmissions() {
    this.submissions.set(await this.landingPageService.listSubmissions());
  }

  async loadGroups() {
    this.allGroups.set(await this.adsService.getAllGroups());
  }

  canEdit(): boolean {
    return this.authService.hasRole([Role.DIRECTOR, Role.OPS]);
  }

  canDelete(): boolean {
    return this.authService.hasRole([Role.DIRECTOR]);
  }

  openCreate() {
    if (!this.canEdit()) return;
    this.editingPage = null;
    this.form = this.createEmptyForm();
    this.error.set('');
    this.showModal.set(true);
  }

  editPage(page: LandingPageItem) {
    if (!this.canEdit()) return;
    this.editingPage = page;
    this.form = {
      name: page.name,
      slug: page.slug,
      status: page.status,
      heroTitle: page.heroTitle || '',
      heroSubtitle: page.heroSubtitle || '',
      formTitle: page.formTitle || '',
      formDescription: page.formDescription || '',
      submitButtonText: page.submitButtonText || '',
      privacyNotice: page.privacyNotice || '',
      successTitle: page.successTitle || '',
      successMessage: page.successMessage || '',
      bodyHtml: page.bodyHtml || '',
      defaultPlatform: page.defaultPlatform || '',
      defaultAdGroupId: page.defaultAdGroupId || '',
      autoCreateLead: page.autoCreateLead,
      metaPixelId: page.metaPixelId || '',
      googleTagId: page.googleTagId || '',
      googleAdsConversionId: page.googleAdsConversionId || '',
      googleAdsConversionLabel: page.googleAdsConversionLabel || '',
      tiktokPixelId: page.tiktokPixelId || '',
      customHeadHtml: page.customHeadHtml || '',
      customBodyHtml: page.customBodyHtml || '',
      notes: page.notes || '',
    };
    this.error.set('');
    this.showModal.set(true);
  }

  async savePage() {
    if (!this.canEdit()) return;
    this.loading.set(true);
    this.error.set('');

    const payload = {
      ...this.form,
      defaultAdGroupId: this.form.defaultAdGroupId || undefined,
      defaultPlatform: this.form.defaultPlatform || undefined,
    };

    const result = this.editingPage
      ? await this.landingPageService.update(this.editingPage._id, payload)
      : await this.landingPageService.create(payload);

    this.loading.set(false);
    if (!result.ok) {
      this.error.set(result.message || 'Khong luu duoc landing page');
      return;
    }

    this.showModal.set(false);
    await Promise.all([this.loadPages(), this.loadSubmissions()]);
  }

  async removePage(page: LandingPageItem) {
    if (!this.canDelete()) return;
    if (!confirm(`Xoa landing page "${page.name}"?`)) return;

    const result = await this.landingPageService.remove(page._id);
    if (!result.ok) {
      alert(result.message || 'Khong xoa duoc landing page');
      return;
    }

    await this.loadPages();
  }

  async copyPublicUrl(page: LandingPageItem) {
    const url = this.publicUrl(page.slug);
    try {
      await navigator.clipboard.writeText(url);
      alert(`Da copy: ${url}`);
    } catch {
      prompt('Copy link landing page', url);
    }
  }

  publicUrl(slug: string): string {
    return `${window.location.origin}/lp/${slug}`;
  }

  onDefaultGroupChange() {
    const selected = this.allGroups().find((group) => group._id === this.form.defaultAdGroupId);
    if (selected && !this.form.defaultPlatform) {
      this.form.defaultPlatform = selected.platform;
    }
  }

  statusLabel(status?: string): string {
    return STATUS_LABELS[status || ''] || (status || '-');
  }

  platformLabel(platform?: string): string {
    return PLATFORM_LABELS[platform || ''] || (platform || '-');
  }

  matchLabel(matchSource?: string): string {
    return MATCH_LABELS[matchSource || ''] || (matchSource || '-');
  }

  trackingSummary(page: LandingPageItem): string {
    const parts = [
      page.metaPixelId ? `Meta ${page.metaPixelId}` : '',
      page.googleTagId ? `Google ${page.googleTagId}` : '',
      page.googleAdsConversionId ? `AW ${page.googleAdsConversionId}` : '',
      page.tiktokPixelId ? `TikTok ${page.tiktokPixelId}` : '',
    ].filter(Boolean);

    return parts.length > 0 ? parts.join(' | ') : 'Chua cau hinh';
  }

  formatDate(value?: string): string {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString('vi-VN');
  }
}
