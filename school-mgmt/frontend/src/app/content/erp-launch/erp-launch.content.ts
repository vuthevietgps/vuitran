export type ErpLaunchRoleBadge =
  | 'PUBLIC'
  | 'DIRECTOR'
  | 'SALE'
  | 'OPS'
  | 'ACCOUNTING'
  | 'TEACHER';

export interface ErpLaunchSection {
  title: string;
  summary: string;
  bullets: string[];
  imageAssets: string[];
}

export interface ErpLaunchMilestone {
  label: string;
  title: string;
  summary: string;
}

export interface ErpLaunchPageContent {
  slug: string;
  title: string;
  summary: string;
  ctaLabels: [string, string];
  sections: ErpLaunchSection[];
  bullets: string[];
  milestones: ErpLaunchMilestone[];
  roleBadges: ErpLaunchRoleBadge[];
  imageAssets: string[];
  publicPath: string;
}

export interface ErpLaunchClusterContent {
  hubPage: ErpLaunchPageContent;
  detailPages: ErpLaunchPageContent[];
  pagesBySlug: Record<string, ErpLaunchPageContent>;
  publicLinks: Array<Pick<ErpLaunchPageContent, 'slug' | 'title' | 'publicPath'>>;
}

const publicPath = (slug: string) => `/lp/${slug}`;

const erpLaunchPages: ErpLaunchPageContent[] = [
  {
    slug: 'mo-trung-tam-day-them-tren-erp',
    title: 'Mở trung tâm dạy thêm trên ERP',
    summary:
      'Trang trung tâm cho cụm landing page công khai, trình bày cách mở trung tâm dạy thêm bằng ERP với quy trình rõ ràng, vai trò rõ ràng và cổng duyệt tài chính chặt chẽ.',
    ctaLabels: ['Xem 7 trang chi tiết', 'Xem lộ trình thử nghiệm 14 ngày'],
    bullets: [
      'Chốt gói học, vai trò, SOP và lớp thử nghiệm trong một cụm nội dung có thứ tự rõ ràng.',
      'Dẫn người xem theo luồng: phụ huynh -> học viên -> hóa đơn/đơn hàng -> cổng duyệt tài chính -> lớp học -> điểm danh -> bảng lương.',
      'Dùng đúng asset thật từ hệ thống để minh họa từng vai trò và từng màn hình chính.',
    ],
    sections: [
      {
        title: 'Khung vận hành gốc',
        summary:
          'Cụm trang này gom đủ các mắt xích cần có để một trung tâm dạy thêm đi từ ý tưởng sang vận hành thật ngay trên ERP.',
        bullets: [
          'Có gói học đầu tiên để chốt sản phẩm công khai.',
          'Có sơ đồ vai trò và quyền để không giao sai việc.',
          'Có SOP riêng cho tuyển sinh, vận hành, giáo viên và kế toán để mở rộng mà không vỡ quy trình.',
        ],
        imageAssets: [
          '/assets/internal-handbook/images/director_overview.webp',
          '/assets/internal-handbook/images/sale_overview.webp',
          '/assets/internal-handbook/images/ops_overview.webp',
          '/assets/internal-handbook/images/accounting_overview.webp',
        ],
      },
      {
        title: 'Trình tự triển khai',
        summary:
          'Mỗi landing page xử lý một điểm quyết định: gói học, vai trò, tuyển sinh, vận hành, giáo viên, kế toán và lớp thử nghiệm 14 ngày.',
        bullets: [
          'Dùng trang trung tâm làm điểm vào cho traffic công khai.',
          'Dùng từng trang chi tiết để giải thích sâu hơn theo đúng mối quan tâm của người đọc.',
          'Ưu tiên cấu trúc có thể dẫn sang hành động thay vì chỉ mô tả chức năng.',
        ],
        imageAssets: [
          '/assets/landing/tuyen-sinh/hoc-phi-phu-huynh.png',
          '/assets/landing/tuyen-sinh/danh-sach-giao-vien.png',
          '/assets/landing/tuyen-sinh/hoc-ba-truc-tuyen.png',
        ],
      },
      {
        title: 'Điều kiện cần trước khi vận hành chính thức',
        summary:
          'Muốn đi từ landing page sang vận hành thật thì route, hình minh họa, cấu trúc điều hướng và lớp nội dung phải chạy ổn định trên cùng một cụm.',
        bullets: [
          'Mỗi slug công khai phải render đúng tại đường dẫn `/lp/:slug`.',
          'Hệ thống xem ảnh phải đọc được toàn bộ asset minh họa của từng trang.',
          'Nội dung phải dẫn người đọc sang đúng bước tiếp theo, không bị đứt mạch giữa các vai trò.',
        ],
        imageAssets: [
          '/assets/internal-handbook/images/director_pending_approvals.webp',
          '/assets/internal-handbook/images/ops_classes.webp',
        ],
      },
    ],
    milestones: [
      {
        label: '01',
        title: 'Chốt gói học đầu tiên',
        summary: 'Người đọc hiểu ngay trung tâm đang bán gì, học trong bao lâu, học phí ra sao và khác biệt nằm ở đâu.',
      },
      {
        label: '02',
        title: 'Chốt vai trò và cổng duyệt',
        summary: 'Tư vấn tuyển sinh, vận hành, kế toán, giáo viên và giám đốc có quyền rõ ràng, không chồng chéo.',
      },
      {
        label: '03',
        title: 'Chạy thử lớp nhỏ trước khi mở rộng',
        summary: 'Lớp thử nghiệm 14 ngày giúp kiểm chứng mô hình trước khi mở thêm lớp và tăng quy mô.',
      },
    ],
    roleBadges: ['PUBLIC', 'DIRECTOR', 'SALE', 'OPS', 'ACCOUNTING', 'TEACHER'],
    imageAssets: [
      '/assets/internal-handbook/images/director_overview.webp',
      '/assets/internal-handbook/images/sale_overview.webp',
      '/assets/internal-handbook/images/ops_overview.webp',
      '/assets/internal-handbook/images/accounting_overview.webp',
    ],
    publicPath: publicPath('mo-trung-tam-day-them-tren-erp'),
  },
  {
    slug: 'goi-hoc-dau-tien',
    title: 'Gói học đầu tiên',
    summary:
      'Trang chốt gói học đầu tiên với tên gói, số buổi, học phí, hình thức học, mã lớp, lịch học và giáo viên dự kiến.',
    ctaLabels: ['Xem cấu trúc gói học', 'Sang sơ đồ nhân sự'],
    bullets: [
      'Một gói học cần đủ thông tin để bộ phận tư vấn tuyển sinh không phải tự diễn giải lại.',
      'Phụ huynh cần nhìn thấy ngay hình thức học, số buổi, học phí và mã lớp.',
      'Lịch học cùng giáo viên dự kiến giúp chốt nhanh niềm tin trước khi đi vào SOP.',
    ],
    sections: [
      {
        title: 'Cấu trúc gói học',
        summary:
          'Trang này phải nói rõ sản phẩm để phụ huynh hiểu quy mô và giá trị ngay từ màn hình đầu tiên.',
        bullets: [
          'Tên gói và mã lớp cần ngắn gọn, dễ nhớ, dễ dùng lại trong tư vấn tuyển sinh.',
          'Số buổi và học phí phải nhìn thấy ngay, không để người xem phải tự suy đoán.',
          'Hình thức học trực tuyến hoặc trực tiếp cần được tách rõ để tránh nhầm luồng.',
        ],
        imageAssets: [
          '/assets/landing/tuyen-sinh/hoc-phi-phu-huynh.png',
          '/assets/landing/tuyen-sinh/hoc-ba-truc-tuyen.png',
        ],
      },
      {
        title: 'Tín hiệu tạo niềm tin',
        summary:
          'Một trung tâm mới vẫn có thể tạo cảm giác chắc chắn nếu gói học đầu tiên cho thấy được năng lực tổ chức và chất lượng giảng dạy.',
        bullets: [
          'Danh sách giáo viên dự kiến giúp tăng độ tin cậy ngay trong trang giới thiệu.',
          'Học bạ trực tuyến là bằng chứng rõ hơn cho phụ huynh muốn theo dõi kết quả học tập.',
          'Mỗi thông tin nên giúp người xem tiến gần hơn tới quyết định đăng ký hoặc tư vấn.',
        ],
        imageAssets: ['/assets/landing/tuyen-sinh/danh-sach-giao-vien.png'],
      },
      {
        title: 'Cách dùng trong tư vấn tuyển sinh',
        summary:
          'Landing page này phục vụ chốt sản phẩm và tạo chuyển đổi, không nên ôm sang các workflow nội bộ khác.',
        bullets: [
          'Dùng làm trang chuẩn để tư vấn và nhấn mạnh giá trị gói học.',
          'Dùng làm mẫu khi mở rộng sang các gói học khác sau này.',
          'Nên giữ một lời kêu gọi hành động rõ ràng cho đăng ký tư vấn hoặc giữ chỗ.',
        ],
        imageAssets: ['/assets/internal-handbook/images/sale_orders.webp'],
      },
    ],
    milestones: [
      {
        label: '01',
        title: 'Đặt tên gói học',
        summary: 'Tên gói phải gọn, dễ nhớ và dễ lặp lại trong mọi điểm chạm bán hàng.',
      },
      {
        label: '02',
        title: 'Chốt cấu trúc công khai',
        summary: 'Số buổi, học phí, hình thức học và mã lớp cần được xác định trước khi đưa ra thị trường.',
      },
      {
        label: '03',
        title: 'Gắn giáo viên dự kiến',
        summary: 'Phụ huynh thấy rõ trung tâm đã chuẩn bị nhân sự và chất lượng đầu vào cho lớp học.',
      },
    ],
    roleBadges: ['PUBLIC', 'SALE', 'DIRECTOR'],
    imageAssets: [
      '/assets/landing/tuyen-sinh/hoc-phi-phu-huynh.png',
      '/assets/landing/tuyen-sinh/hoc-ba-truc-tuyen.png',
      '/assets/landing/tuyen-sinh/danh-sach-giao-vien.png',
    ],
    publicPath: publicPath('goi-hoc-dau-tien'),
  },
  {
    slug: 'phan-quyen-nhan-su',
    title: 'Phân quyền nhân sự',
    summary:
      'Trang làm rõ vai trò và quyền hạn: ai phụ trách tư vấn tuyển sinh, ai phụ trách vận hành, ai duyệt tài chính, ai giảng dạy và ai giữ quyền quyết định cuối cùng.',
    ctaLabels: ['Xem ma trận vai trò', 'Sang quy trình tuyển sinh'],
    bullets: [
      'ERP này vận hành theo vai trò khá chặt, nên sơ đồ quyền phải rõ ngay từ đầu.',
      'Mỗi vai trò có ranh giới thao tác khác nhau để tránh cấp sai quyền hoặc chồng chéo trách nhiệm.',
      'Giám đốc giữ quyền chốt cuối, còn từng bộ phận chỉ làm đúng phần việc của mình.',
    ],
    sections: [
      {
        title: 'Bản đồ vai trò',
        summary:
          'Trang này chốt danh sách vai trò và mức độ tham gia của từng bộ phận trong chuỗi vận hành của trung tâm.',
        bullets: [
          'Tư vấn tuyển sinh xử lý lead, phụ huynh, học viên và khởi tạo hóa đơn ban đầu.',
          'Vận hành quản lý lớp, buổi học, danh sách lớp và điều phối phát sinh.',
          'Kế toán duyệt nạp tiền, hóa đơn, bảng lương tạm tính và đối soát cuối kỳ.',
        ],
        imageAssets: [
          '/assets/internal-handbook/images/director_dashboard.webp',
          '/assets/internal-handbook/images/ops_overview.webp',
        ],
      },
      {
        title: 'Ranh giới quyết định',
        summary:
          'Mỗi vai trò có một phần việc, một cấp phê duyệt và một phạm vi không được lấn sang để hệ thống luôn có trật tự.',
        bullets: [
          'Tư vấn tuyển sinh không xếp lớp khi cổng duyệt tài chính chưa mở.',
          'Vận hành không thay kế toán chốt số tiền hoặc duyệt nghiệp vụ tài chính.',
          'Giáo viên không chốt bảng lương, chỉ cập nhật dữ liệu đầu vào đúng hạn.',
        ],
        imageAssets: [
          '/assets/internal-handbook/images/director_pending_approvals.webp',
          '/assets/internal-handbook/images/accounting_wallets.webp',
        ],
      },
      {
        title: 'Cách trình bày cho khách mới',
        summary:
          'Người mới cần nhìn vào là hiểu ngay ai là chủ thể chính, ai làm gì và vì sao hệ thống vận hành ổn định.',
        bullets: [
          'Dùng badge vai trò để dẫn luồng đọc thay vì dồn quá nhiều giải thích kỹ thuật.',
          'Đặt giám đốc ở vị trí chốt cuối để làm rõ cơ chế kiểm soát.',
          'Ưu tiên sự rõ ràng, ngắn gọn và có thứ tự hơn là nhồi quá nhiều thuật ngữ.',
        ],
        imageAssets: ['/assets/internal-handbook/images/director_financial_control.webp'],
      },
    ],
    milestones: [
      {
        label: '01',
        title: 'Xác định người chịu trách nhiệm',
        summary: 'Mỗi vai trò đều có owner rõ ràng và không đạp chồng lên nhau.',
      },
      {
        label: '02',
        title: 'Khóa các quyền tài chính',
        summary: 'Mọi thao tác chạm vào tiền cần có phê duyệt rõ ràng và có vành đai kiểm soát.',
      },
      {
        label: '03',
        title: 'Công khai ma trận quyền',
        summary: 'Người xem nhìn vào là hiểu ai làm gì và hệ thống kiểm soát rủi ro ra sao.',
      },
    ],
    roleBadges: ['PUBLIC', 'DIRECTOR', 'SALE', 'OPS', 'ACCOUNTING', 'TEACHER'],
    imageAssets: [
      '/assets/internal-handbook/images/director_dashboard.webp',
      '/assets/internal-handbook/images/director_pending_approvals.webp',
      '/assets/internal-handbook/images/ops_overview.webp',
    ],
    publicPath: publicPath('phan-quyen-nhan-su'),
  },
  {
    slug: 'quy-trinh-sale',
    title: 'Quy trình tuyển sinh',
    summary:
      'Trang mô tả luồng 5 bước: phụ huynh -> học viên -> hóa đơn/đơn hàng -> cổng duyệt tài chính -> xếp lớp.',
    ctaLabels: ['Xem 5 bước tuyển sinh', 'Sang quy trình vận hành'],
    bullets: [
      'Chưa xếp lớp khi hóa đơn chưa duyệt hoặc ví phụ huynh chưa đủ số dư.',
      'Bộ phận tuyển sinh phải nắm đúng thứ tự đưa dữ liệu vào hệ thống.',
      'Mục tiêu là đưa lead sang lớp thật mà không phá vỡ cổng duyệt tài chính.',
    ],
    sections: [
      {
        title: 'Luồng chuẩn của tuyển sinh',
        summary:
          'Mỗi lead đi theo một đường thẳng, có điểm kiểm tra rõ ràng và có điều kiện đạt ở cuối luồng.',
        bullets: [
          'Tạo hồ sơ phụ huynh trước, sau đó gắn học viên đúng thông tin.',
          'Phải có hóa đơn hoặc đơn hàng trước khi nghĩ tới bước xếp lớp.',
          'Cổng duyệt tài chính là điều kiện bắt buộc trước khi chuyển sang lớp học.',
        ],
        imageAssets: [
          '/assets/internal-handbook/images/sale_leads.webp',
          '/assets/internal-handbook/images/sale_orders.webp',
        ],
      },
      {
        title: 'Cổng duyệt tài chính bắt buộc',
        summary:
          'Trang này cần giải thích rõ vì sao bộ phận tuyển sinh không được bỏ qua phê duyệt hoặc trạng thái số dư.',
        bullets: [
          'Cổng duyệt bảo vệ doanh thu và tránh tạo ra lớp học chưa đủ điều kiện tài chính.',
          'Làm đúng từ đầu thì việc đối soát về sau nhẹ hơn và ít sai lệch hơn.',
          'Dữ liệu sạch giúp vận hành chốt lớp gọn hơn và giảm phát sinh xử lý tay.',
        ],
        imageAssets: ['/assets/internal-handbook/images/sale_dashboard.webp'],
      },
      {
        title: 'Nhịp tư vấn cần giữ',
        summary:
          'Nội dung của trang nên làm rõ tính bắt buộc của trình tự, độ sạch dữ liệu và cách nhìn trạng thái trên ERP.',
        bullets: [
          'Nhấn mạnh tính liên tục của luồng tuyển sinh từ đầu tới lúc xếp lớp.',
          'Dùng các mốc duyệt để cho thấy lead đang đứng ở trạng thái nào.',
          'Giúp nhân sự mới hiểu vì sao phải đi theo đúng thứ tự này.',
        ],
        imageAssets: ['/assets/internal-handbook/images/sale_overview.webp'],
      },
    ],
    milestones: [
      {
        label: '01',
        title: 'Tạo phụ huynh',
        summary: 'Nguồn lead ban đầu được ghi nhận đầy đủ và có thể tiếp tục sang hồ sơ học viên.',
      },
      {
        label: '02',
        title: 'Lập hóa đơn hoặc đơn hàng',
        summary: 'Sản phẩm, học phí và trạng thái thanh toán phải được khởi tạo rõ ràng trong hệ thống.',
      },
      {
        label: '03',
        title: 'Mở cổng duyệt tài chính',
        summary: 'Chỉ khi hóa đơn hợp lệ hoặc ví đủ số dư thì mới được chuyển sang bước xếp lớp.',
      },
    ],
    roleBadges: ['SALE', 'DIRECTOR', 'ACCOUNTING', 'OPS'],
    imageAssets: [
      '/assets/internal-handbook/images/sale_leads.webp',
      '/assets/internal-handbook/images/sale_orders.webp',
      '/assets/internal-handbook/images/sale_dashboard.webp',
    ],
    publicPath: publicPath('quy-trinh-sale'),
  },
  {
    slug: 'quy-trinh-van-hanh',
    title: 'Quy trình vận hành',
    summary:
      'Trang mô tả cách vận hành: cập nhật danh sách ở mục "Classes", tạo lịch ở mục "Sessions", điểm danh đúng ngày và chỉ chốt buổi khi dữ liệu đã đủ.',
    ctaLabels: ['Xem luồng lớp và buổi học', 'Sang quy trình giáo viên'],
    bullets: [
      'Danh sách lớp được cập nhật ở "Classes", lịch học được tạo ở "Sessions", không làm ngược thứ tự.',
      'Điểm danh cần đúng ngày để không làm lệch dữ liệu cuối buổi.',
      'Buổi học chỉ được chốt khi điểm danh và báo cáo giảng dạy đã đủ.',
    ],
    sections: [
      {
        title: 'Phân biệt "Classes" và "Sessions"',
        summary:
          'Bộ phận vận hành phải tách bạch rõ giữa lớp học, danh sách lớp và từng buổi học để không nhầm logic quản trị.',
        bullets: [
          '"Classes" là nơi cập nhật danh sách học viên, giáo viên và người phụ trách.',
          '"Sessions" là nơi tạo lịch, theo dõi tiến độ và kiểm soát từng buổi học.',
          'Trước giờ vào ca, vận hành cần kiểm tra cả danh sách lớp lẫn lịch buổi học.',
        ],
        imageAssets: [
          '/assets/internal-handbook/images/ops_classes.webp',
          '/assets/internal-handbook/images/ops_dashboard.webp',
        ],
      },
      {
        title: 'Điểm danh và chốt buổi học',
        summary:
          'Trang này phải làm rõ điều kiện đóng buổi để không dây chuyền sai sang báo cáo và bảng lương.',
        bullets: [
          'Điểm danh phải đúng ngày, đúng lớp và đúng người học.',
          'Báo cáo giảng dạy là đầu vào bắt buộc để buổi học được đóng hoàn chỉnh.',
          'Thiếu một trong hai thành phần thì buổi học chưa được chốt.',
        ],
        imageAssets: ['/assets/internal-handbook/images/ops_tickets.webp'],
      },
      {
        title: 'Xử lý phát sinh đúng kênh',
        summary:
          'Vận hành không ôm luôn logic tài chính, nhưng phải biết khi nào cần đẩy việc sang kế toán hoặc giám đốc.',
        bullets: [
          'Phiếu phối hợp là kênh chính để ghi nhận phát sinh và bám theo tiến độ xử lý.',
          'Các thay đổi liên quan đến buổi học, lớp học hoặc chi phí đều phải được ghi nhận có chủ đích.',
          'Trang cần chỉ rõ khi nào nên chuyển việc sang tuyển sinh, giáo viên, kế toán hoặc giám đốc.',
        ],
        imageAssets: ['/assets/internal-handbook/images/ops_overview.webp'],
      },
    ],
    milestones: [
      {
        label: '01',
        title: 'Chốt danh sách lớp',
        summary: 'Danh sách học viên và giáo viên phải khớp trước khi vào ngày học.',
      },
      {
        label: '02',
        title: 'Tạo lịch buổi học',
        summary: 'Mỗi buổi học được lên lịch rõ ràng và có thể theo dõi theo từng ca.',
      },
      {
        label: '03',
        title: 'Chốt buổi học đúng điều kiện',
        summary: 'Chỉ khóa buổi khi điểm danh và báo cáo giảng dạy đã đủ.',
      },
    ],
    roleBadges: ['OPS', 'DIRECTOR', 'TEACHER', 'ACCOUNTING', 'SALE'],
    imageAssets: [
      '/assets/internal-handbook/images/ops_classes.webp',
      '/assets/internal-handbook/images/ops_dashboard.webp',
      '/assets/internal-handbook/images/ops_tickets.webp',
    ],
    publicPath: publicPath('quy-trinh-van-hanh'),
  },
  {
    slug: 'quy-trinh-giao-vien',
    title: 'Quy trình giáo viên',
    summary:
      'Trang mô tả luồng giáo viên: mở link điểm danh, hoàn thành buổi dạy, nộp báo cáo giảng dạy và bảo đảm bảng lương không bị chặn.',
    ctaLabels: ['Xem luồng điểm danh', 'Sang quy trình kế toán'],
    bullets: [
      'Giáo viên cần có lịch dạy rõ ràng, link điểm danh đúng buổi và checklist cuối buổi đầy đủ.',
      'Thiếu báo cáo giảng dạy thì bảng lương sẽ bị chặn, nên bước nộp báo cáo là bắt buộc.',
      'Trang này chỉ tập trung vào hành động giáo viên cần làm, không đẩy sang nghiệp vụ của vận hành hoặc kế toán.',
    ],
    sections: [
      {
        title: 'Trước giờ vào lớp',
        summary:
          'Giáo viên phải biết chính xác buổi dạy nào, lớp nào, lịch nào và tài liệu nào cần dùng trước khi vào lớp.',
        bullets: [
          'Kiểm tra bảng điều khiển và lịch dạy trước khi bắt đầu ca.',
          'Mở danh sách lớp để xác nhận đúng lớp phụ trách.',
          'Nếu thấy lịch bất thường, báo cho vận hành càng sớm càng tốt.',
        ],
        imageAssets: [
          '/assets/teacher-docs/assets/10_teacher_login.webp',
          '/assets/teacher-docs/assets/11_teacher_dashboard.webp',
          '/assets/teacher-docs/assets/12_teacher_classes.webp',
        ],
      },
      {
        title: 'Trong và sau buổi học',
        summary:
          'Hai đầu vào quan trọng nhất là điểm danh và báo cáo giảng dạy; cả hai đều phải hoàn thành ngay trong nhịp vận hành của buổi học.',
        bullets: [
          'Mở đúng link điểm danh cho đúng buổi, đúng lớp.',
          'Hoàn tất điểm danh ngay sau khi kết thúc buổi học.',
          'Nộp báo cáo giảng dạy để buổi học có thể được đóng hoàn chỉnh.',
        ],
        imageAssets: [
          '/assets/teacher-docs/assets/13_teacher_attendance.webp',
          '/assets/teacher-docs/assets/14_teacher_teaching_report.webp',
        ],
      },
      {
        title: 'Liên hệ với bảng lương',
        summary:
          'Tiền lương của giáo viên phụ thuộc trực tiếp vào buổi học và báo cáo hợp lệ, nên trang này phải nhấn mạnh tính bắt buộc của dữ liệu cuối buổi.',
        bullets: [
          'Thiếu báo cáo thì bảng lương chưa thể chốt.',
          'Có thay đổi hoặc phát sinh thì cần báo vận hành ngay trong ngày.',
          'Lịch dạy và tổng quan lớp giúp giáo viên không bỏ sót buổi học nào.',
        ],
        imageAssets: [
          '/assets/teacher-docs/assets/16_teacher_calendar.webp',
          '/assets/teacher-docs/assets/19_teacher_payroll.webp',
        ],
      },
    ],
    milestones: [
      {
        label: '01',
        title: 'Nhận lịch dạy rõ ràng',
        summary: 'Giáo viên biết đúng lớp và đúng giờ ngay từ đầu ca.',
      },
      {
        label: '02',
        title: 'Làm điểm danh đúng buổi',
        summary: 'Điểm danh được ghi nhận trước khi buổi học được đóng.',
      },
      {
        label: '03',
        title: 'Nộp báo cáo giảng dạy',
        summary: 'Báo cáo đầy đủ là điều kiện để bảng lương có thể chốt.',
      },
    ],
    roleBadges: ['TEACHER', 'OPS', 'ACCOUNTING'],
    imageAssets: [
      '/assets/teacher-docs/assets/11_teacher_dashboard.webp',
      '/assets/teacher-docs/assets/13_teacher_attendance.webp',
      '/assets/teacher-docs/assets/14_teacher_teaching_report.webp',
    ],
    publicPath: publicPath('quy-trinh-giao-vien'),
  },
  {
    slug: 'quy-trinh-ke-toan',
    title: 'Quy trình kế toán',
    summary:
      'Trang mô tả quy trình nạp tiền, hóa đơn, sổ cái, bảng lương tạm tính và đối soát tài chính trong đúng phạm vi vai trò kế toán.',
    ctaLabels: ['Xem cổng duyệt tài chính', 'Sang thử nghiệm 14 ngày'],
    bullets: [
      'Kế toán duyệt nạp tiền và hóa đơn, sau đó kiểm tra sổ cái trước khi đi tiếp.',
      'Bảng lương tạm tính và đối soát là chuẩn bắt buộc trước khi khóa sổ.',
      'Trang này tập trung vào kiểm soát tài chính, không đi sang việc vận hành lớp học.',
    ],
    sections: [
      {
        title: 'Nạp tiền và ví phụ huynh',
        summary:
          'Người đọc cần thấy rõ quy trình duyệt nạp tiền, kiểm tra số dư và xác nhận thay đổi trên ví phụ huynh.',
        bullets: [
          'Duyệt nạp tiền trước khi tính số dư thực tế trong ví.',
          'Kiểm tra sổ cái sau mỗi lần duyệt để bảo đảm số liệu khớp.',
          'Ví phụ huynh là nơi cần rõ ràng giữa thao tác xem số dư và thao tác phê duyệt.',
        ],
        imageAssets: [
          '/assets/internal-handbook/images/accounting_wallets.webp',
          '/assets/internal-handbook/images/accounting_dashboard.webp',
        ],
      },
      {
        title: 'Hóa đơn và bảng lương tạm tính',
        summary:
          'Kế toán phải đi theo thứ tự: hóa đơn trước, bảng lương tạm tính sau, rồi mới khóa sổ hoặc đối soát.',
        bullets: [
          'Duyệt hóa đơn theo đúng trạng thái thanh toán của từng hồ sơ.',
          'Kiểm tra bảng lương tạm tính trước khi chốt lương cuối kỳ.',
          'Khi cần, đối chiếu với buổi học và báo cáo giảng dạy để giải thích số liệu.',
        ],
        imageAssets: [
          '/assets/internal-handbook/images/accounting_overview.webp',
          '/assets/internal-handbook/images/accounting_payroll.webp',
        ],
      },
      {
        title: 'Đối soát tài chính',
        summary:
          'Mục tiêu cuối cùng là hợp nhất số liệu, giảm sai lệch và tạo đầu vào minh bạch cho giám đốc theo dõi.',
        bullets: [
          'Đối soát khoản thu và khoản chi theo kỳ với nguồn gốc dữ liệu rõ ràng.',
          'Báo cáo sai lệch phải truy được về hóa đơn, sổ cái hoặc dữ liệu buổi học.',
          'Nếu cần phối hợp, chuyển việc sang vận hành hoặc giám đốc bằng luồng rõ ràng.',
        ],
        imageAssets: ['/assets/internal-handbook/images/director_financial_control.webp'],
      },
    ],
    milestones: [
      {
        label: '01',
        title: 'Duyệt nạp tiền',
        summary: 'Số dư ví và sổ cái phải khớp ngay sau khi phê duyệt.',
      },
      {
        label: '02',
        title: 'Chốt bảng lương tạm tính',
        summary: 'Đối chiếu đủ dữ liệu trước khi bước vào chốt lương cuối kỳ.',
      },
      {
        label: '03',
        title: 'Đối soát cuối kỳ',
        summary: 'Báo cáo đối soát hoàn chỉnh và sẵn sàng cho giám đốc theo dõi.',
      },
    ],
    roleBadges: ['ACCOUNTING', 'DIRECTOR', 'OPS', 'TEACHER'],
    imageAssets: [
      '/assets/internal-handbook/images/accounting_wallets.webp',
      '/assets/internal-handbook/images/accounting_payroll.webp',
      '/assets/internal-handbook/images/accounting_overview.webp',
    ],
    publicPath: publicPath('quy-trinh-ke-toan'),
  },
  {
    slug: 'pilot-14-ngay',
    title: 'Thử nghiệm 14 ngày',
    summary:
      'Trang mô tả cách chạy thử một lớp nhỏ trong 1-2 tuần để kiểm tra luồng tuyển sinh, vận hành, giáo viên và kế toán trước khi mở rộng.',
    ctaLabels: ['Xem checklist 14 ngày', 'Quay về trang trung tâm'],
    bullets: [
      'Lớp thử nghiệm cần nhỏ, nhanh và đủ quan sát để thấy rõ từng điểm nghẽn trong hệ thống.',
      'Mục tiêu là kiểm tra nhân sự, quy trình và đầu vào tài chính trong thời gian ngắn.',
      'Chỉ sau khi thử nghiệm ổn mới quyết định mở rộng sang lớp tiếp theo.',
    ],
    sections: [
      {
        title: 'Giai đoạn chuẩn bị',
        summary:
          'Lớp thử nghiệm bắt đầu bằng việc chốt gói học, vai trò, danh sách lớp và lịch học để có thể vận hành ngay.',
        bullets: [
          'Chốt lớp học và giáo viên trước ngày bắt đầu.',
          'Bảo đảm hóa đơn, cổng duyệt tài chính và lớp học đều đã sẵn sàng.',
          'Thông báo rõ nhịp phối hợp cho tuyển sinh, vận hành, giáo viên và kế toán.',
        ],
        imageAssets: [
          '/assets/internal-handbook/images/ops_classes.webp',
          '/assets/internal-handbook/images/director_dashboard.webp',
        ],
      },
      {
        title: 'Giai đoạn vận hành thử',
        summary:
          'Trong 1-2 tuần, chỉ cần tập trung theo dõi điểm danh, báo cáo giảng dạy, cổng duyệt tài chính và phản hồi nhanh từ các vai trò.',
        bullets: [
          'Theo dõi từng buổi học trong mục buổi học đã lên lịch.',
          'Ghi nhận điểm danh và báo cáo giảng dạy ngay trong ngày.',
          'Đánh dấu mọi điểm nghẽn phát sinh để xử lý hoặc điều chỉnh sau thử nghiệm.',
        ],
        imageAssets: [
          '/assets/teacher-docs/assets/01_teacher_daily_checklist.webp',
          '/assets/teacher-docs/assets/13_teacher_attendance.webp',
          '/assets/teacher-docs/assets/14_teacher_teaching_report.webp',
        ],
      },
      {
        title: 'Giai đoạn rà soát và mở rộng',
        summary:
          'Kết quả thử nghiệm phải được dùng để quyết định mở thêm lớp hay sửa quy trình trước khi tăng quy mô.',
        bullets: [
          'Rà lại độ đầy đủ của điểm danh, báo cáo giảng dạy và bảng lương.',
          'Đối chiếu phản hồi từ phụ huynh, giáo viên và bộ phận vận hành.',
          'Chốt danh sách cải tiến trước khi triển khai lớp tiếp theo.',
        ],
        imageAssets: [
          '/assets/internal-handbook/images/parent_progress.webp',
          '/assets/internal-handbook/images/accounting_overview.webp',
        ],
      },
    ],
    milestones: [
      {
        label: '01',
        title: 'Mở lớp nhỏ để quan sát',
        summary: 'Bắt đầu với quy mô vừa đủ để nhìn thấy rõ chất lượng vận hành.',
      },
      {
        label: '02',
        title: 'Theo dõi liên tục trong 14 ngày',
        summary: 'Kiểm tra đầy đủ nhịp làm việc của tuyển sinh, vận hành, giáo viên và kế toán.',
      },
      {
        label: '03',
        title: 'Quyết định mở rộng có căn cứ',
        summary: 'Chỉ mở rộng khi kết quả thử nghiệm đủ tốt và các điểm nghẽn đã được nhìn thấy rõ.',
      },
    ],
    roleBadges: ['DIRECTOR', 'SALE', 'OPS', 'TEACHER', 'ACCOUNTING'],
    imageAssets: [
      '/assets/teacher-docs/assets/01_teacher_daily_checklist.webp',
      '/assets/teacher-docs/assets/13_teacher_attendance.webp',
      '/assets/teacher-docs/assets/14_teacher_teaching_report.webp',
    ],
    publicPath: publicPath('pilot-14-ngay'),
  },
];

export const erpLaunchClusterContent: ErpLaunchClusterContent = {
  hubPage: erpLaunchPages[0],
  detailPages: erpLaunchPages.slice(1),
  pagesBySlug: erpLaunchPages.reduce<Record<string, ErpLaunchPageContent>>((acc, page) => {
    acc[page.slug] = page;
    return acc;
  }, {}),
  publicLinks: erpLaunchPages.map(({ slug, title, publicPath: linkPath }) => ({
    slug,
    title,
    publicPath: linkPath,
  })),
};

export const erpLaunchPageSlugs = erpLaunchPages.map((page) => page.slug);
