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
import {
  erpLaunchClusterContent,
  ErpLaunchPageContent,
  ErpLaunchRoleBadge,
} from '../../content/erp-launch';

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Nháp',
  ACTIVE: 'Hoạt động',
  ARCHIVED: 'Lưu trữ',
};

const PLATFORM_LABELS: Record<string, string> = {
  FACEBOOK: 'Facebook',
  GOOGLE: 'Google',
  TIKTOK: 'TikTok',
};

const MATCH_LABELS: Record<string, string> = {
  NONE: 'Chưa ghép',
  USER_PHONE: 'Ghép người dùng theo số điện thoại',
  USER_EMAIL: 'Ghép người dùng theo email',
  STUDENT_PARENT: 'Ghép qua hồ sơ học sinh',
};

const SYSTEM_ROLE_LABELS: Record<ErpLaunchRoleBadge, string> = {
  PUBLIC: 'Công khai',
  DIRECTOR: 'Giám đốc',
  SALE: 'Tư vấn tuyển sinh',
  OPS: 'Vận hành',
  ACCOUNTING: 'Kế toán',
  TEACHER: 'Giáo viên',
};

type SystemLandingPageItem = {
  slug: string;
  title: string;
  summary: string;
  publicPath: string;
  sourceCode: 'ERP_CLUSTER';
  roleSummary: string;
  sectionCount: number;
  milestoneCount: number;
  primaryCta: string;
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
  readonly systemPages = computed<SystemLandingPageItem[]>(() =>
    [erpLaunchClusterContent.hubPage, ...erpLaunchClusterContent.detailPages].map((page) =>
      this.toSystemPage(page),
    ),
  );
  readonly error = signal('');
  readonly loading = signal(false);
  readonly showModal = signal(false);

  editingPage: LandingPageItem | null = null;

readonly pageSearch = signal('');
  readonly pageStatus = signal('');
  readonly submissionSearch = signal('');
  readonly submissionLandingPageId = signal('');
  readonly totalLandingLinks = computed(
    () => this.filteredSystemPages().length + this.filteredPages().length,
  );

  form: any = this.createEmptyForm();

  readonly filteredPages = computed(() => {
    const keyword = this.pageSearch().trim().toLowerCase();
    const status = this.pageStatus();

    return this.pages().filter((page) => {
      const matchesStatus = !status || page.status === status;
      const haystack = `${page.name} ${page.slug} ${page.pageCode}`.toLowerCase();
      const matchesKeyword = !keyword || haystack.includes(keyword);
      return matchesStatus && matchesKeyword;
    });
  });

  readonly filteredSystemPages = computed(() => {
    const keyword = this.pageSearch().trim().toLowerCase();
    const status = this.pageStatus();

    return this.systemPages().filter((page) => {
      const matchesStatus = !status || status === 'ACTIVE';
      const haystack = `${page.title} ${page.slug} ${page.sourceCode} ${page.roleSummary}`.toLowerCase();
      const matchesKeyword = !keyword || haystack.includes(keyword);
      return matchesStatus && matchesKeyword;
    });
  });

  readonly filteredSubmissions = computed(() => {
    const keyword = this.submissionSearch().trim().toLowerCase();
    const landingPageId = this.submissionLandingPageId();

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
      submitButtonText: 'Nhận tư vấn ngay',
      privacyNotice: 'Thông tin chỉ được dùng để tư vấn và liên hệ phụ huynh.',
      successTitle: 'Đã ghi nhận',
      successMessage: 'Chúng tôi sẽ liên hệ với phụ huynh trong thời gian sớm nhất.',
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
    if (this.loading()) return;
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
      this.error.set(result.message || 'Không lưu được landing page');
      return;
    }

    this.showModal.set(false);
    await Promise.all([this.loadPages(), this.loadSubmissions()]);
  }

  async removePage(page: LandingPageItem) {
    if (!this.canDelete()) return;
    if (!confirm(`Xóa landing page "${page.name}"?`)) return;

    const result = await this.landingPageService.remove(page._id);
    if (!result.ok) {
      alert(result.message || 'Không xóa được landing page');
      return;
    }

    await this.loadPages();
  }

  async copyPublicUrl(page: LandingPageItem) {
    await this.copyPublicUrlBySlug(page.slug);
  }

  async copyPublicUrlBySlug(slug: string) {
    const url = this.publicUrl(slug);
    try {
      await navigator.clipboard.writeText(url);
      alert(`Đã copy: ${url}`);
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

    return parts.length > 0 ? parts.join(' | ') : 'Chưa cấu hình';
  }

  dynamicPageSummary(page: LandingPageItem): string {
    return (
      page.heroSubtitle?.trim()
      || page.formDescription?.trim()
      || page.heroTitle?.trim()
      || page.notes?.trim()
      || 'Landing page động có tracking, submit form và attribution riêng.'
    );
  }

  formatDate(value?: string): string {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString('vi-VN');
  }

  private toSystemPage(page: ErpLaunchPageContent): SystemLandingPageItem {
    return {
      slug: page.slug,
      title: page.title,
      summary: page.summary,
      publicPath: page.publicPath,
      sourceCode: 'ERP_CLUSTER',
      roleSummary: page.roleBadges.map((badge) => SYSTEM_ROLE_LABELS[badge]).join(' | '),
      sectionCount: page.sections.length,
      milestoneCount: page.milestones.length,
      primaryCta: page.ctaLabels[0],
    };
  }
}
