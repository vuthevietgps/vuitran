import { CommonModule } from '@angular/common';
import { Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

type JourneyTab = 'registration' | 'approval' | 'management';

interface ThesisCard {
  label: string;
  title: string;
  summary: string;
}

interface BenefitCard {
  title: string;
  summary: string;
  highlight: string;
}

interface ChecklistCard {
  title: string;
  items: string[];
}

interface TimelineStep {
  phase: string;
  title: string;
  summary: string;
}

interface ModuleCard {
  title: string;
  route: string;
  summary: string;
}

interface IllustrationCard {
  tag: string;
  title: string;
  summary: string;
  image: string;
}

interface ImagePreview {
  title: string;
  summary: string;
  image: string;
}

@Component({
  selector: 'app-shareholder-collaboration-landing',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './shareholder-collaboration-landing.component.html',
  styleUrls: ['./shareholder-collaboration-landing.component.css'],
})
export class ShareholderCollaborationLandingComponent {
  readonly activeJourneyTab = signal<JourneyTab>('registration');
  readonly activePreview = signal<ImagePreview | null>(null);
  protected readonly heroImage = '/assets/internal-handbook/images/director_dashboard.webp';

  protected readonly marketTheses: ThesisCard[] = [
    {
      label: 'Thị trường thật',
      title: 'Phụ huynh sẵn sàng chi cho giáo dục khi kết quả học tập được nhìn thấy rõ.',
      summary:
        'Nhu cầu học bổ trợ, phát triển kỹ năng và đầu tư cho con tiếp tục tăng khi gia đình ưu tiên các mô hình tạo ra tiến bộ dài hạn.',
    },
    {
      label: 'Recurring model',
      title: 'Học phí, gia hạn gói học và retention tạo ra dòng tiền lặp lại.',
      summary:
        'Giá trị doanh nghiệp được xây từ khả năng giữ học sinh, mở rộng gói học và kiểm soát chi phí trên mỗi học viên đang hoạt động.',
    },
    {
      label: 'Scale by system',
      title: 'Giáo viên, lớp học, attendance, payroll, ads và finance được vận hành trên một hệ thống chung.',
      summary:
        'Khi quy trình được chuẩn hóa, doanh nghiệp scale nhanh hơn, giảm phụ thuộc vào xử lý thủ công và minh bạch hơn với cổ đông.',
    },
    {
      label: 'Data governance',
      title: 'CAC, LTV, ARPU, burn rate, runway và cảnh báo được đọc bằng dashboard thay vì cảm tính.',
      summary:
        'Cổ đông có thể dựa vào dữ liệu để tham gia quyết định, theo dõi sức khỏe tài chính và đánh giá tốc độ tăng trưởng một cách minh bạch.',
    },
  ];

  protected readonly shareholderBenefits: BenefitCard[] = [
    {
      highlight: '01. Transparency',
      title: 'Quyền xem dashboard cổ đông theo các chỉ số cốt lõi.',
      summary:
        'Cổ đông đã duyệt có thể theo dõi doanh thu, lợi nhuận, burn rate, runway, retention và nhóm cảnh báo tài chính trong một cửa sổ chung.',
    },
    {
      highlight: '02. Governance',
      title: 'Quyền tiếp cận báo cáo được ẩn danh và cấp quyền đúng lớp.',
      summary:
        'Báo cáo giảng dạy, công nợ, ads analytics và các dashboard liên quan được mở theo role để giữ minh bạch nhưng vẫn an toàn dữ liệu nhạy cảm.',
    },
    {
      highlight: '03. Strategic seat',
      title: 'Quyền đồng hành vào các quyết định mở rộng và tối ưu vận hành.',
      summary:
        'Giá trị của cổ đông không chỉ nằm ở phần vốn, mà còn ở network, kinh nghiệm M&A, vận hành, marketing và khả năng mở rộng đối tác.',
    },
    {
      highlight: '04. Upside',
      title: 'Cơ hội tăng giá trị vốn theo năng lực scale của doanh nghiệp.',
      summary:
        'Khi doanh nghiệp tăng trưởng nhờ retention tốt, vận hành chắc và marketing hiệu quả, giá trị cổ phần được cải thiện theo năng lực thực thi.',
    },
    {
      highlight: '05. Review cycle',
      title: 'Cập nhật định kỳ về sức khỏe tài chính và milestone tăng trưởng.',
      summary:
        'Cổ đông có thể đồng hành trên một nhịp báo cáo rõ ràng, có đủ dữ liệu để chất vấn, đánh giá và đề xuất hướng hành động cho ban điều hành.',
    },
  ];

  protected readonly illustrationCards: IllustrationCard[] = [
    {
      tag: 'Tăng trưởng',
      title: 'Bảng điều hành tăng trưởng được nhìn thấy rõ theo thời gian thực.',
      summary:
        'Cổ đông không chỉ nghe báo cáo, mà có thể nhìn thấy ngay tốc độ vận hành, doanh thu, lớp học và mức độ sẵn sàng mở rộng.',
      image: '/assets/internal-handbook/images/director_dashboard.webp',
    },
    {
      tag: 'Kiểm soát',
      title: 'Kiểm soát tài chính và dòng tiền là một năng lực lõi của hệ vận hành.',
      summary:
        'Ảnh minh họa này đại diện cho lớp quản trị tiền mặt, nghĩa vụ tài chính, cảnh báo và mức an toàn của doanh nghiệp.',
      image: '/assets/internal-handbook/images/director_financial_control.webp',
    },
    {
      tag: 'Governance',
      title: 'Quy trình chờ duyệt giúp mở rộng mà không đánh đổi governance.',
      summary:
        'Từ tiếp nhận hồ sơ đến cấp quyền cho cổ đông đều đi qua pipeline nội bộ rõ ràng để tránh cấp quyền sớm hoặc sai phạm vi.',
      image: '/assets/internal-handbook/images/director_pending_approvals.webp',
    },
  ];

  protected readonly registrationChecklist: ChecklistCard[] = [
    {
      title: 'Hồ sơ cần chuẩn bị',
      items: [
        'Thông tin cá nhân hoặc pháp nhân tham gia hợp tác.',
        'Quy mô đồng hành dự kiến và khung thời gian giải ngân.',
        'Tầm nhìn dài hạn khi đồng hành cùng doanh nghiệp giáo dục.',
      ],
    },
    {
      title: 'Giá trị cộng thêm kỳ vọng',
      items: [
        'Network kinh doanh, kênh bán hàng, đối tác chiến lược.',
        'Kinh nghiệm vận hành, tài chính, M&A, governance hoặc marketing.',
        'Khả năng mở cửa cơ hội hợp tác, mở rộng cơ sở hoặc sản phẩm.',
      ],
    },
    {
      title: 'Nguyên tắc tiếp nhận',
      items: [
        'Đăng ký không đồng nghĩa với cấp quyền truy cập ngay.',
        'Mọi hồ sơ đều đi qua lớp thẩm định và chờ duyệt nội bộ.',
        'Chỉ sau khi xác nhận phù hợp mới tạo tài khoản cổ đông.',
      ],
    },
    {
      title: 'Kết quả mong đợi sau đăng ký',
      items: [
        'Hồ sơ được đưa vào pipeline thẩm định rõ ràng.',
        'Ban điều hành đánh giá mức độ phù hợp với chiến lược tăng trưởng.',
        'Nếu đạt yêu cầu, hệ thống sẽ kích hoạt luồng quản lý cổ đông.',
      ],
    },
  ];

  protected readonly approvalTimeline: TimelineStep[] = [
    {
      phase: 'Step 01',
      title: 'Tiếp nhận hồ sơ hợp tác',
      summary:
        'Thông tin từ landing page được tập hợp thành một đầu mối để đội ngũ vận hành và ban điều hành rà soát, thay vì mở thẳng quyền truy cập.',
    },
    {
      phase: 'Step 02',
      title: 'Thẩm định sự phù hợp và giá trị cộng thêm',
      summary:
        'Doanh nghiệp đánh giá mức độ đồng bộ về tầm nhìn, khả năng đồng hành, năng lực tài chính và giá trị chiến lược mà đối tác có thể mang vào.',
    },
    {
      phase: 'Step 03',
      title: 'Duyệt nội bộ và phân bổ thông tin cổ đông',
      summary:
        'Sau khi thông qua, đội ngũ nội bộ tạo user role SHAREHOLDER, cập nhật tỷ lệ cổ phần và đặt quyền truy cập theo đúng governance.',
    },
    {
      phase: 'Step 04',
      title: 'Kích hoạt khu quản lý cổ đông',
      summary:
        'Tài khoản được dẫn vào investor dashboard và các module được mở theo phạm vi được phê duyệt, không mở sớm hơn quy trình.',
    },
  ];

  protected readonly managementModules: ModuleCard[] = [
    {
      title: 'Investor dashboard',
      route: '/app/investor-dashboard',
      summary:
        'Doc snapshot tien mat, burn rate, runway, xu huong doanh thu, loi nhuan va cac canh bao can theo doi.',
    },
    {
      title: 'Kiểm soát tài chính',
      route: '/app/financial-control',
      summary:
        'Theo dõi nghĩa vụ, dòng tiền, cảnh báo và sức khỏe tài chính vận hành trong một màn hình quản trị tập trung.',
    },
    {
      title: 'Công nợ phải thu',
      route: '/app/aging-report',
      summary:
        'Xem bức tranh công nợ đã được ẩn danh hóa các thông tin nhạy cảm khi truy cập bằng role cổ đông.',
    },
    {
      title: 'Phân tích quảng cáo',
      route: '/app/ads-analytics',
      summary:
        'Đánh giá CAC, nguồn lead, hiệu quả ads và chất lượng dòng tiền đầu vào để nối dữ liệu marketing với tăng trưởng.',
    },
    {
      title: 'Báo cáo giảng dạy',
      route: '/app/teaching-report',
      summary:
        'Theo dõi chất lượng vận hành học tập qua các báo cáo đã ẩn danh, giúp cổ đông đọc được năng lực thực thi của hệ thống.',
    },
    {
      title: 'Báo cáo tổng hợp',
      route: '/app/comprehensive-report',
      summary:
        'Tổng hợp các chỉ số vận hành và doanh thu trên cùng một lớp báo cáo để phục vụ review và ra quyết định.',
    },
  ];

  protected isActiveJourneyTab(tab: JourneyTab): boolean {
    return this.activeJourneyTab() === tab;
  }

  protected openJourneyTab(tab: JourneyTab, scroll = false): void {
    this.activeJourneyTab.set(tab);

    if (!scroll || typeof document === 'undefined') {
      return;
    }

    requestAnimationFrame(() => {
      document.getElementById('shareholder-control-room')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    });
  }

  protected openPreview(image: string, title: string, summary: string): void {
    this.activePreview.set({ image, title, summary });
  }

  protected closePreview(): void {
    this.activePreview.set(null);
  }
}
