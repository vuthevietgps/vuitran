import { CommonModule, ViewportScroller } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Data, RouterLink } from '@angular/router';
import {
  erpLaunchClusterContent,
  ErpLaunchPageContent,
  ErpLaunchRoleBadge,
  ErpLaunchSection,
} from '../../../content/erp-launch';

type ImagePreview = {
  src: string;
  alt: string;
  title: string;
  description: string;
};

type PageMetric = {
  label: string;
  value: string;
  detail: string;
};

@Component({
  selector: 'app-erp-launch-landing',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './erp-launch-landing.component.html',
  styleUrls: ['./erp-launch-landing.component.css'],
})
export class ErpLaunchLandingComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly scroller = inject(ViewportScroller);
  private readonly cluster = erpLaunchClusterContent;
  private readonly roleLabels: Record<ErpLaunchRoleBadge, string> = {
    PUBLIC: 'Công khai',
    DIRECTOR: 'Giám đốc',
    SALE: 'Tư vấn tuyển sinh',
    OPS: 'Vận hành',
    ACCOUNTING: 'Kế toán',
    TEACHER: 'Giáo viên',
  };

  readonly page = signal<ErpLaunchPageContent>(this.cluster.hubPage);
  readonly imagePreview = signal<ImagePreview | null>(null);

  readonly isHub = computed(() => this.page().slug === this.cluster.hubPage.slug);
  readonly supportingImages = computed(() => this.page().imageAssets.slice(1, 4));
  readonly highlightSections = computed(() => this.page().sections.slice(0, 3));
  readonly totalVisualCount = computed(
    () =>
      this.page().imageAssets.length
      + this.page().sections.reduce((sum, section) => sum + section.imageAssets.length, 0),
  );
  readonly audienceText = computed(() =>
    this.page().roleBadges.map((badge) => this.roleLabels[badge]).join(' · '),
  );
  readonly pageSequenceText = computed(() =>
    this.isHub()
      ? `Trang trung tâm điều phối · ${this.cluster.detailPages.length + 1} trang`
      : `Trang ${this.currentDetailIndex() + 1}/${this.cluster.detailPages.length} trong cụm triển khai`,
  );
  readonly boundaryText = computed(() =>
    this.isHub()
      ? 'Trang trung tâm này giữ vai trò định hướng. Mỗi quy trình chi tiết được tách thành một landing page riêng để người xem không bị quá tải.'
      : `Trang này chỉ tập trung vào ${this.page().title.toLowerCase()}, không thay thế các trang quy trình còn lại trong cụm.`,
  );
  readonly scopeHeadline = computed(() =>
    this.isHub() ? 'Một cụm nội dung, nhiều quyết định vận hành' : 'Một chủ đề, một thông điệp hành động',
  );
  readonly themeClass = computed(() => `theme-${this.resolveTheme(this.page().slug)}`);
  readonly currentDetailIndex = computed(() =>
    this.cluster.detailPages.findIndex((item) => item.slug === this.page().slug),
  );
  readonly previousPage = computed(() => {
    const currentIndex = this.currentDetailIndex();
    if (currentIndex < 0) return this.cluster.detailPages[0] || this.cluster.hubPage;
    if (currentIndex === 0) return this.cluster.hubPage;
    return this.cluster.detailPages[currentIndex - 1];
  });
  readonly nextPage = computed(() => {
    const currentIndex = this.currentDetailIndex();
    if (currentIndex < 0) return this.cluster.detailPages[0] || this.cluster.hubPage;
    return this.cluster.detailPages[currentIndex + 1] || this.cluster.hubPage;
  });
  readonly secondaryRoute = computed(() =>
    this.isHub() ? this.cluster.pagesBySlug['pilot-14-ngay'] : this.nextPage(),
  );
  readonly nextStepText = computed(() =>
    this.isHub()
      ? 'Nếu cần triển khai gọn và an toàn, hãy bắt đầu từ lớp thử nghiệm 14 ngày trước khi mở rộng.'
      : `Sau phần này, người đọc nên chuyển sang ${this.secondaryRoute().title.toLowerCase()} để đi đúng nhịp triển khai.`,
  );
  readonly clusterIntroText = computed(() =>
    this.isHub()
      ? 'Cụm nội dung này gom toàn bộ landing page theo đúng trình tự một trung tâm dạy thêm cần chốt: gói học, vai trò, tuyển sinh, vận hành, giáo viên, kế toán và lớp thử nghiệm.'
      : 'Mỗi trang chỉ giải quyết một điểm nghẽn. Bản đồ dưới đây giúp người xem biết mình đang ở đâu và nên đi tiếp sang bước nào.',
  );
  readonly navigatorIntroText = computed(() =>
    this.isHub()
      ? 'Từ trang trung tâm, nên đi thẳng đến trang chi tiết phù hợp với mối quan tâm hiện tại thay vì đọc dàn trải.'
      : 'Đọc xong trang này thì nên chuyển ngay sang bước kế tiếp trong cụm để giữ mạch logic.',
  );
  readonly metricCards = computed<PageMetric[]>(() => [
    {
      label: 'Vai trò trọng tâm',
      value: `${this.page().roleBadges.length} vai trò`,
      detail: this.audienceText(),
    },
    {
      label: this.isHub() ? 'Quy mô cụm' : 'Cấu trúc trang',
      value: this.isHub()
        ? `${this.cluster.detailPages.length + 1} trang`
        : `${this.page().sections.length} mục · ${this.page().milestones.length} mốc`,
      detail: this.isHub()
        ? 'Một trang trung tâm tổng hợp và bảy trang chi tiết đi theo đúng trình tự triển khai.'
        : 'Mỗi mục bám một giai đoạn rõ ràng trong luồng ERP, không viết lan sang phần khác.',
    },
    {
      label: 'Minh họa chức năng',
      value: `${this.totalVisualCount()} ảnh`,
      detail: 'Ảnh lấy từ hệ thống và tài liệu vận hành hiện có, không dùng mockup chung chung.',
    },
  ]);
  readonly clusterCards = computed(() =>
    [this.cluster.hubPage, ...this.cluster.detailPages].map((item) => ({
      ...item,
      isActive: item.slug === this.page().slug,
      coverImage: item.imageAssets[0] || item.sections[0]?.imageAssets[0] || '',
    })),
  );

  constructor() {
    this.route.data.pipe(takeUntilDestroyed()).subscribe((data) => this.applyRouteData(data));
  }

  scrollTo(fragment: string): void {
    if (!fragment) return;
    setTimeout(() => this.scroller.scrollToAnchor(fragment));
  }

  openImage(src: string, title: string, description: string): void {
    this.imagePreview.set({
      src,
      alt: `${title} - ${description}`,
      title,
      description,
    });
  }

  closeImage(): void {
    this.imagePreview.set(null);
  }

  roleLabel(badge: ErpLaunchRoleBadge): string {
    return this.roleLabels[badge];
  }

  imageTitleForPage(index: number): string {
    return `${this.page().title} - minh họa ${index + 1}`;
  }

  imageTitleForSection(section: ErpLaunchSection, index: number): string {
    return `${section.title} - minh họa ${index + 1}`;
  }

  sectionAnchor(index: number): string {
    return `section-${index + 1}`;
  }

  clusterIndexLabel(index: number): string {
    return String(index).padStart(2, '0');
  }

  private applyRouteData(data: Data): void {
    const slug = String(data['erpLaunchSlug'] || '').trim();
    this.page.set(this.cluster.pagesBySlug[slug] || this.cluster.hubPage);
    this.closeImage();
    this.scroller.scrollToPosition([0, 0]);
    if (typeof document !== 'undefined') {
      document.title = `${this.page().title} | ERP Trung tâm dạy thêm`;
      document.documentElement.lang = 'vi';
    }
  }

  private resolveTheme(slug: string): string {
    if (slug.includes('goi-hoc')) return 'package';
    if (slug.includes('nhan-su')) return 'roles';
    if (slug.includes('sale')) return 'sale';
    if (slug.includes('van-hanh')) return 'ops';
    if (slug.includes('giao-vien')) return 'teacher';
    if (slug.includes('ke-toan')) return 'accounting';
    if (slug.includes('pilot')) return 'pilot';
    return 'hub';
  }
}
