import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Role } from '../models/role.enum';
import { AuthService } from '../services/auth.service';

interface HandbookLink {
  label: string;
  route: string;
  note: string;
}

interface HandbookScenario {
  title: string;
  summary: string;
  steps: string[];
  route?: string;
}

interface HandbookGalleryItem {
  title: string;
  description: string;
  image: string;
  route?: string;
}

interface HandbookVideo {
  title: string;
  description: string;
  src: string;
  poster: string;
}

interface HandbookWorkflowStage {
  title: string;
  description: string;
  steps: string[];
  successSignal: string;
  route?: string;
}

interface HandbookPitfall {
  title: string;
  detail: string;
}

interface HandbookFaqItem {
  question: string;
  answer: string;
}

interface HandbookPlaybook {
  headline: string;
  stages: HandbookWorkflowStage[];
  pitfalls: HandbookPitfall[];
  faq: HandbookFaqItem[];
}

interface HandbookConfig {
  title: string;
  subtitle: string;
  summary: string;
  focusLabel: string;
  focusValue: string;
  heroImage: string;
  heroAlt: string;
  guardrails: string[];
  scenarios: HandbookScenario[];
  quickLinks: HandbookLink[];
  gallery: HandbookGalleryItem[];
  videos: HandbookVideo[];
  deepDive?: HandbookLink;
}

const INTERNAL_IMAGE_BASE = '/assets/internal-handbook/images';
const INTERNAL_VIDEO_BASE = '/assets/internal-handbook/videos';
const TEACHER_IMAGE_BASE = '/assets/teacher-docs/assets';
const TEACHER_VIDEO_BASE = '/assets/teacher-docs/videos';

const internalImage = (name: string) => `${INTERNAL_IMAGE_BASE}/${name}.webp`;
const internalVideo = (name: string) => `${INTERNAL_VIDEO_BASE}/${name}.webm`;
const teacherImage = (name: string) => `${TEACHER_IMAGE_BASE}/${name}.webp`;
const teacherVideo = (name: string) => `${TEACHER_VIDEO_BASE}/${name}.webm`;

const LEGACY_CONFIG: HandbookConfig = {
  title: 'Cẩm nang nội bộ',
  subtitle: 'Tài khoản legacy cần đối chiếu lại mapping quyền',
  summary:
    'Tài khoản hiện tại thuộc nhóm vai trò cũ. Hãy dùng trang này như điểm vào chung và đối chiếu lại role với nhóm quyền mới trước khi đào tạo hoặc kiểm thử.',
  focusLabel: 'Khuyến nghị',
  focusValue: 'Đối chiếu lại role trước khi thao tác',
  heroImage: internalImage('director_overview'),
  heroAlt: 'Ảnh tổng quan cẩm nang nội bộ',
  guardrails: [
    'Nếu menu hiển thị không đúng, kiểm tra lại role của tài khoản đang dùng.',
    'Không dùng tài khoản legacy để đánh giá logic quyền của các role core.',
    'Khi cần test đúng nghiệp vụ, hãy đăng nhập lại bằng tài khoản DIRECTOR, ACCOUNTING, OPS, TEACHER, PARENT hoặc SALE.',
  ],
  scenarios: [
    {
      title: 'Xác nhận role hiện tại',
      summary: 'Kiểm tra lại tài khoản đang đăng nhập và phần menu hiển thị.',
      steps: [
        'Mở dashboard để kiểm tra vai trò hiển thị trên giao diện.',
        'So khớp role với tài khoản test mục tiêu.',
        'Nếu sai, đăng xuất và đăng nhập lại bằng tài khoản chuẩn.',
      ],
      route: '/app/dashboard',
    },
  ],
  quickLinks: [
    { label: 'Dashboard', route: '/app/dashboard', note: 'Quay lại màn hình tổng quan để kiểm tra tài khoản hiện tại.' },
    { label: 'Tin nhắn', route: '/app/messages', note: 'Liên hệ nội bộ nếu cần đổi tài khoản hoặc hỗ trợ test.' },
  ],
  gallery: [
    {
      title: 'Tổng quan cẩm nang',
      description: 'Ảnh minh họa chung cho nhịp làm việc nội bộ.',
      image: internalImage('director_overview'),
      route: '/app/dashboard',
    },
  ],
  videos: [
    {
      title: 'Video thao tác mẫu',
      description: 'Video mẫu để tham khảo cách điều hướng nội bộ trên hệ thống.',
      src: internalVideo('director_daily_flow'),
      poster: internalImage('director_dashboard'),
    },
  ],
};

const HANDBOOK_CONFIG: Record<string, HandbookConfig> = {
  [Role.DIRECTOR]: {
    title: 'Cẩm nang giám đốc',
    subtitle: 'Điều hành, phê duyệt và kiểm soát rủi ro trên một màn hình hướng dẫn duy nhất',
    summary:
      'Trang này tổng hợp đúng luồng làm việc của giám đốc: mở dashboard để nhìn toàn cảnh, xử lý chờ duyệt, kiểm soát tài chính và truy vết hoạt động khi cần ra quyết định.',
    focusLabel: 'Mục tiêu chính',
    focusValue: 'Ra quyết định nhanh nhưng vẫn đúng dữ liệu và đúng quyền',
    heroImage: internalImage('director_overview'),
    heroAlt: 'Tổng quan cẩm nang giám đốc',
    guardrails: [
      'Giám đốc là vai trò quản trị cao nhất, chỉ nên dùng cho các quyết định cần phê duyệt hoặc kiểm soát nhạy cảm.',
      'Những thao tác như quản lý user, audit log hoặc điều chỉnh tài chính phải đi kèm đối chiếu dữ liệu trước khi xác nhận.',
      'Khi rà soát sai lệch logic quyền của role khác, dùng handbook tương ứng của vai trò đó để đối chiếu chéo.',
    ],
    scenarios: [
      {
        title: 'Bắt đầu ngày điều hành',
        summary: 'Mở dashboard để nắm số liệu chính rồi chuyển sang khu vực cần xử lý ngay.',
        steps: [
          'Xem dashboard để nắm doanh thu, lớp học, ticket và biến động nhân sự.',
          'Kiểm tra các cảnh báo hoặc chỉ số bất thường cần ưu tiên xử lý trong ngày.',
          'Đi tiếp sang khu vực chờ duyệt hoặc tài chính nếu có khoản cần xác nhận.',
        ],
        route: '/app/dashboard',
      },
      {
        title: 'Phê duyệt và kiểm soát tài chính',
        summary: 'Đối chiếu dòng tiền, công nợ và các yêu cầu cần giám đốc chốt.',
        steps: [
          'Mở Chờ duyệt để xử lý các yêu cầu phê duyệt phát sinh.',
          'Với yêu cầu đổi buổi học, đọc rõ tác động học phí và lương giáo viên trước khi chốt.',
          'Mở Financial Control để kiểm tra luồng tiền và các chỉ số tài chính.',
          'Khi cần truy nguồn gốc thay đổi, mở Audit log trước khi ra quyết định cuối.',
        ],
        route: '/app/pending-approvals',
      },
      {
        title: 'Truy vết và đánh giá đội ngũ',
        summary: 'Kiểm tra lịch sử thao tác và hiệu suất vận hành trước khi chốt điều chỉnh.',
        steps: [
          'Mở Audit log để biết ai đã tạo, sửa hoặc duyệt một nghiệp vụ.',
          'Đối chiếu hiệu suất theo từng bộ phận trước khi giao lại việc.',
          'Ghi nhận các điểm nghẽn để giao việc cho vận hành hoặc kế toán xử lý tiếp.',
        ],
        route: '/app/audit-log',
      },
    ],
    quickLinks: [
      { label: 'Dashboard', route: '/app/dashboard', note: 'Màn hình tổng quan đầu ngày của giám đốc.' },
      { label: 'Chờ duyệt', route: '/app/pending-approvals', note: 'Nơi xử lý các yêu cầu cần phê duyệt.' },
      { label: 'Financial Control', route: '/app/financial-control', note: 'Điểm kiểm soát tài chính và dòng tiền.' },
      { label: 'Audit log', route: '/app/audit-log', note: 'Truy vết lịch sử thao tác của toàn hệ thống.' },
    ],
    gallery: [
      {
        title: 'Tổng quan vai trò giám đốc',
        description: 'Ảnh minh họa nhịp làm việc của giám đốc từ điều hành sang phê duyệt và kiểm soát.',
        image: internalImage('director_overview'),
      },
      {
        title: 'Dashboard điều hành',
        description: 'Góc nhìn tổng quan để giám đốc nắm nhanh tình hình trung tâm trong ngày.',
        image: internalImage('director_dashboard'),
        route: '/app/dashboard',
      },
      {
        title: 'Khu vực chờ duyệt',
        description: 'Màn hình dùng để xử lý các đề xuất hoặc nghiệp vụ cần phê duyệt.',
        image: internalImage('director_pending_approvals'),
        route: '/app/pending-approvals',
      },
      {
        title: 'Financial Control',
        description: 'Khu vực kiểm soát tài chính trước khi ra quyết định cuối cùng.',
        image: internalImage('director_financial_control'),
        route: '/app/financial-control',
      },
    ],
    videos: [
      {
        title: 'Video thao tác giám đốc',
        description: 'Video hướng dẫn luồng đăng nhập, vào dashboard, chờ duyệt, financial control và audit log.',
        src: internalVideo('director_daily_flow'),
        poster: internalImage('director_dashboard'),
      },
    ],
  },
  [Role.ACCOUNTING]: {
    title: 'Cẩm nang kế toán',
    subtitle: 'Đối soát ví, hóa đơn và kỳ lương bằng đúng phạm vi quyền của kế toán',
    summary:
      'Cẩm nang này mô tả chính xác luồng kế toán sau khi đã chỉnh lại logic quyền: đọc được học sinh, lớp và báo cáo liên quan để đối chiếu; nhưng không sửa hồ sơ học sinh hay mở rộng sang phần vận hành ngoài phạm vi.',
    focusLabel: 'Mục tiêu chính',
    focusValue: 'Đối soát đúng số, đúng chứng từ, đúng phạm vi quyền',
    heroImage: internalImage('accounting_overview'),
    heroAlt: 'Tổng quan cẩm nang kế toán',
    guardrails: [
      'Kế toán được đọc dữ liệu học sinh và lớp để đối chiếu, nhưng không được sửa hồ sơ học sinh.',
      'Chuyển ví chỉ hiển thị cho giám đốc và kế toán, không áp dụng cho vận hành.',
      'Mọi chốt số cuối kỳ nên đi qua hóa đơn, ví, payroll và đối soát ngân hàng theo đúng thứ tự.',
    ],
    scenarios: [
      {
        title: 'Duyệt top-up và kiểm tra ví',
        summary: 'Từ dashboard sang ví để duyệt nạp tiền, kiểm tra ledger và số dư.',
        steps: [
          'Mở dashboard để xem các top-up chờ duyệt và giao dịch gần nhất.',
          'Đi vào Wallets để xử lý yêu cầu nạp tiền và kiểm tra lại ledger sau khi duyệt.',
          'Xác nhận số dư, chứng từ và tài khoản đối soát trước khi kết thúc tác vụ.',
        ],
        route: '/app/wallets',
      },
      {
        title: 'Xử lý hóa đơn và công nợ',
        summary: 'Đi qua hóa đơn, đối soát thanh toán và theo dõi khoản cần thu.',
        steps: [
          'Mở Invoices để kiểm tra tình trạng thanh toán và danh sách hóa đơn.',
          'Khi cần chốt số, đối chiếu thêm công nợ hoặc sao kê ngân hàng.',
          'Nếu có sai khác dữ liệu đầu vào, bàn giao lại cho bộ phận phụ trách thay vì tự chỉnh ngoài quyền.',
        ],
        route: '/app/invoices',
      },
      {
        title: 'Đóng kỳ lương',
        summary: 'Đi từ teaching report hoặc sessions sang payroll để chốt kỳ.',
        steps: [
          'Kiểm tra dữ liệu buổi học hoặc báo cáo giảng dạy dùng làm đầu vào tính lương.',
          'Mở Payroll để xem kỳ lương và đối chiếu điều kiện tính lương.',
          'Nếu kỳ lương ảnh hưởng chính sách, phối hợp thêm với giám đốc trước khi thay đổi cấu hình.',
        ],
        route: '/app/payroll',
      },
    ],
    quickLinks: [
      { label: 'Dashboard kế toán', route: '/app/dashboard', note: 'Điểm mở đầu để nắm top-up, ví và lương.' },
      { label: 'Wallets', route: '/app/wallets', note: 'Duyệt top-up, theo dõi ledger và số dư.' },
      { label: 'Invoices', route: '/app/invoices', note: 'Theo dõi hóa đơn và trạng thái thanh toán.' },
      { label: 'Payroll', route: '/app/payroll', note: 'Đối chiếu kỳ lương và dữ liệu tính lương.' },
      { label: 'Student report', route: '/app/student-report', note: 'Đọc báo cáo học sinh phục vụ đối soát.' },
    ],
    gallery: [
      {
        title: 'Tổng quan vai trò kế toán',
        description: 'Ảnh giới thiệu nhịp đối soát chuẩn của kế toán trong hệ thống.',
        image: internalImage('accounting_overview'),
      },
      {
        title: 'Dashboard kế toán',
        description: 'Nơi theo dõi top-up, ví và các chỉ số tài chính đầu ngày.',
        image: internalImage('accounting_dashboard'),
        route: '/app/dashboard',
      },
      {
        title: 'Quản lý ví',
        description: 'Màn hình xử lý top-up, duyệt yêu cầu và kiểm tra ledger.',
        image: internalImage('accounting_wallets'),
        route: '/app/wallets',
      },
      {
        title: 'Payroll',
        description: 'Màn hình đối chiếu kỳ lương để chốt số theo session.',
        image: internalImage('accounting_payroll'),
        route: '/app/payroll',
      },
    ],
    videos: [
      {
        title: 'Video thao tác kế toán',
        description: 'Video hướng dẫn luồng dashboard → wallets → invoices → payroll dành cho kế toán.',
        src: internalVideo('accounting_daily_flow'),
        poster: internalImage('accounting_wallets'),
      },
    ],
  },
  [Role.OPS]: {
    title: 'Cẩm nang vận hành',
    subtitle: 'Điều phối lớp học, lịch dạy và ticket theo đúng vai trò vận hành',
    summary:
      'Trang này dành cho vận hành để nhìn rõ luồng điều phối trong ngày: lớp học, session, attendance, ticket và phối hợp nội bộ. Vai trò này không có quyền chuyển ví hay chốt các nghiệp vụ tài chính nhạy cảm.',
    focusLabel: 'Mục tiêu chính',
    focusValue: 'Lịch học ổn định, xử lý phát sinh nhanh và bàn giao đúng bộ phận',
    heroImage: internalImage('ops_overview'),
    heroAlt: 'Tổng quan cẩm nang vận hành',
    guardrails: [
      'Vận hành được quản lý lớp, session, attendance, ticket và điều phối giáo viên, nhưng không được chuyển ví.',
      'Danh sách giáo viên và sale dùng từ directory nội bộ, không cần quyền quản lý user của giám đốc.',
      'OPS được duyệt hoặc từ chối yêu cầu đổi buổi học, nhưng phải kiểm tra kỹ tác động tài chính trước khi xác nhận.',
      'Khi phát sinh chạm đến tiền hoặc chính sách, phải bàn giao cho kế toán hoặc giám đốc.',
    ],
    scenarios: [
      {
        title: 'Xếp lớp và chuẩn bị lịch',
        summary: 'Mở classes rồi đi sang sessions để gán người và tạo lịch.',
        steps: [
          'Mở Classes để kiểm tra giáo viên, sale và học sinh gán cho từng lớp.',
          'Tạo hoặc cập nhật Session sau khi lớp đã sẵn sàng.',
          'Rà lại lịch dạy trước giờ vào ca để giảm phát sinh trong ngày.',
        ],
        route: '/app/classes',
      },
      {
        title: 'Điều phối trong ngày',
        summary: 'Theo dõi attendance, tài liệu và trạng thái lớp đang diễn ra.',
        steps: [
          'Kiểm tra attendance hoặc attendance report khi cần truy vết buổi học.',
          'Nếu Sale gửi yêu cầu đổi buổi học, mở Chờ duyệt để rà giáo viên mới và tác động lương trước khi xử lý.',
          'Hỗ trợ giáo viên bằng ticket, tài liệu và điều phối thay thế khi có rủi ro.',
          'Giữ ticket là kênh chính để đóng vòng các phát sinh vận hành.',
        ],
        route: '/app/sessions',
      },
      {
        title: 'Xử lý phát sinh và bàn giao',
        summary: 'Đóng ticket nội bộ và bàn giao nghiệp vụ sang sale hoặc kế toán khi cần.',
        steps: [
          'Mở Tickets để xử lý các yêu cầu đang chờ.',
          'Khi phát sinh lead hoặc hội thoại mới, phối hợp sale qua Conversations.',
          'Nếu nghiệp vụ chạm đến tài chính, bàn giao kế toán hoặc giám đốc thay vì tự xử lý.',
        ],
        route: '/app/tickets',
      },
    ],
    quickLinks: [
      { label: 'Dashboard vận hành', route: '/app/dashboard', note: 'Tổng quan phát sinh và nhịp vận hành trong ngày.' },
      { label: 'Classes', route: '/app/classes', note: 'Quản lý lớp, giáo viên, sale và học sinh.' },
      { label: 'Sessions', route: '/app/sessions', note: 'Tạo lịch và theo dõi buổi học.' },
      { label: 'Attendance', route: '/app/attendance', note: 'Kiểm tra điểm danh và trạng thái lớp học.' },
      { label: 'Tickets', route: '/app/tickets', note: 'Đóng vòng các yêu cầu nội bộ.' },
    ],
    gallery: [
      {
        title: 'Tổng quan vai trò vận hành',
        description: 'Ảnh mô tả điểm tập trung của vận hành trong một ngày làm việc.',
        image: internalImage('ops_overview'),
      },
      {
        title: 'Dashboard vận hành',
        description: 'Màn hình đầu ngày để kiểm tra số liệu và cảnh báo cần xử lý.',
        image: internalImage('ops_dashboard'),
        route: '/app/dashboard',
      },
      {
        title: 'Quản lý lớp học',
        description: 'Màn hình phân lớp và điều phối nguồn lực giảng dạy.',
        image: internalImage('ops_classes'),
        route: '/app/classes',
      },
      {
        title: 'Ticket nội bộ',
        description: 'Khu vực theo dõi và xử lý phát sinh giữa các bộ phận.',
        image: internalImage('ops_tickets'),
        route: '/app/tickets',
      },
    ],
    videos: [
      {
        title: 'Video thao tác vận hành',
        description: 'Video hướng dẫn luồng dashboard → classes → sessions → tickets dành cho vận hành.',
        src: internalVideo('ops_daily_flow'),
        poster: internalImage('ops_classes'),
      },
    ],
  },
  [Role.TEACHER]: {
    title: 'Cẩm nang giáo viên',
    subtitle: 'Lộ trình vào ca, điểm danh, báo cáo giảng dạy và phối hợp nội bộ',
    summary:
      'Cẩm nang giáo viên đã có sẵn ảnh minh họa và video thao tác thực tế từ môi trường demo. Trang này đóng vai trò cửa vào nhanh; khi cần đào sâu hơn, bạn có thể mở Teacher Hub chi tiết.',
    focusLabel: 'Mục tiêu chính',
    focusValue: 'Dạy đúng lịch, đủ dữ liệu, báo cáo đúng hạn',
    heroImage: teacherImage('00_teacher_overview'),
    heroAlt: 'Tổng quan cẩm nang giáo viên',
    guardrails: [
      'Giáo viên chỉ thao tác trên dữ liệu của mình: hồ sơ, lịch dạy, session, attendance và phần lương liên quan.',
      'Mọi phát sinh nghỉ dạy, thay thế hoặc hỗ trợ vận hành nên đi qua request hoặc ticket.',
      'Không có quyền sửa ví, hóa đơn, user hay các phần kiểm soát tài chính nội bộ.',
    ],
    scenarios: [
      {
        title: 'Bắt đầu ngày dạy',
        summary: 'Đăng nhập, xem dashboard và rà lịch dạy trước khi vào ca.',
        steps: [
          'Mở dashboard giáo viên để kiểm tra buổi học sắp tới và các việc cần xử lý.',
          'Xem lịch dạy để rà lại lớp và khung giờ.',
          'Kiểm tra tài liệu cần dùng trước khi bắt đầu buổi học.',
        ],
        route: '/app/dashboard',
      },
      {
        title: 'Điểm danh và nộp báo cáo',
        summary: 'Đi qua attendance và teaching report sau khi kết thúc buổi học.',
        steps: [
          'Mở Attendance để điểm danh hoặc tạo link điểm danh cho học sinh.',
          'Sau buổi dạy, vào Teaching report để nộp báo cáo và ghi chú bài học.',
          'Kiểm tra lại trạng thái buổi học trước khi rời ca.',
        ],
        route: '/app/teaching-report',
      },
      {
        title: 'Xử lý phát sinh',
        summary: 'Xin nghỉ, yêu cầu thay thế, mở ticket hoặc nhắn tin nội bộ khi cần hỗ trợ.',
        steps: [
          'Tạo request thay thế khi không thể dạy đúng lịch.',
          'Mở ticket để OPS hỗ trợ khi có vấn đề trong vận hành lớp.',
          'Dùng tin nhắn nội bộ để phối hợp nhanh với các bộ phận liên quan.',
        ],
        route: '/app/teacher-substitute-request',
      },
    ],
    quickLinks: [
      { label: 'Dashboard giáo viên', route: '/app/dashboard', note: 'Tổng quan đầu ngày của giáo viên.' },
      { label: 'Attendance', route: '/app/attendance', note: 'Điểm danh và tạo link cho học sinh.' },
      { label: 'Teaching report', route: '/app/teaching-report', note: 'Nộp báo cáo giảng dạy sau buổi học.' },
      { label: 'Teacher calendar', route: '/app/teacher-calendar', note: 'Rà lịch dạy và các ca sắp tới.' },
      { label: 'Payroll', route: '/app/payroll', note: 'Theo dõi tình trạng tính lương.' },
    ],
    gallery: [
      {
        title: 'Tổng quan vai trò giáo viên',
        description: 'Ảnh giới thiệu toàn bộ luồng làm việc của giáo viên trên hệ thống.',
        image: teacherImage('00_teacher_overview'),
      },
      {
        title: 'Dashboard giáo viên',
        description: 'Tổng quan buổi học, thu nhập và các việc cần xử lý trong ngày.',
        image: teacherImage('11_teacher_dashboard'),
        route: '/app/dashboard',
      },
      {
        title: 'Attendance',
        description: 'Màn hình điểm danh và tạo link check-in cho học sinh.',
        image: teacherImage('13_teacher_attendance'),
        route: '/app/attendance',
      },
      {
        title: 'Teaching report',
        description: 'Màn hình nộp báo cáo giảng dạy sau mỗi buổi học.',
        image: teacherImage('14_teacher_teaching_report'),
        route: '/app/teaching-report',
      },
      {
        title: 'Teacher calendar',
        description: 'Lịch dạy cá nhân để giáo viên rà lại các ca sắp tới.',
        image: teacherImage('16_teacher_calendar'),
        route: '/app/teacher-calendar',
      },
    ],
    videos: [
      {
        title: 'Đăng nhập và vào dashboard',
        description: 'Video thực tế về bước đăng nhập và kiểm tra dashboard của giáo viên.',
        src: teacherVideo('teacher_login_dashboard'),
        poster: teacherImage('10_teacher_login'),
      },
      {
        title: 'Điểm danh và tạo link',
        description: 'Video thao tác attendance: chọn lớp, chọn ngày và tạo link điểm danh.',
        src: teacherVideo('teacher_attendance_link'),
        poster: teacherImage('13_teacher_attendance'),
      },
      {
        title: 'Báo cáo giảng dạy và payroll',
        description: 'Video nối giữa teaching report và payroll để giáo viên tự đối chiếu dữ liệu lương.',
        src: teacherVideo('teacher_report_payroll'),
        poster: teacherImage('19_teacher_payroll'),
      },
    ],
    deepDive: {
      label: 'Teacher Hub chi tiết',
      route: '/app/teacher-hub',
      note: 'Mở thêm thư viện ảnh, tài liệu markdown và video đào tạo giáo viên đầy đủ.',
    },
  },
  [Role.PARENT]: {
    title: 'Cẩm nang phụ huynh',
    subtitle: 'Theo dõi tiến độ học, xác nhận buổi học và quản lý ví đúng phạm vi',
    summary:
      'Trang này dành cho phụ huynh để dùng hệ thống đúng cách: xem tiến độ học tập, lịch học, buổi học cần xác nhận và ví cá nhân. Phụ huynh không đi vào các khu vực nội bộ khác.',
    focusLabel: 'Mục tiêu chính',
    focusValue: 'Theo dõi sát việc học và thanh toán của chính mình',
    heroImage: internalImage('parent_overview'),
    heroAlt: 'Tổng quan cẩm nang phụ huynh',
    guardrails: [
      'Phụ huynh chỉ xem dữ liệu gắn với tài khoản của mình, không thấy dữ liệu nội bộ của trung tâm.',
      'Yêu cầu nạp ví chỉ áp dụng cho ví của chính mình và đi qua bước duyệt của kế toán.',
      'Nếu cần hỗ trợ thêm, dùng ticket hoặc liên hệ bộ phận phụ trách thay vì truy cập sai khu vực.',
    ],
    scenarios: [
      {
        title: 'Theo dõi tiến độ học',
        summary: 'Mở dashboard và student progress để nắm tình hình học tập của con.',
        steps: [
          'Xem dashboard phụ huynh để biết buổi học, ví và các mục cần chú ý.',
          'Mở Student progress để xem tiến độ học tập và kết quả liên quan.',
          'Kiểm tra thêm lịch học hoặc điểm danh nếu muốn rà chi tiết.',
        ],
        route: '/app/student-progress',
      },
      {
        title: 'Xác nhận buổi học',
        summary: 'Đi vào Sessions để rà lại buổi học đã hoàn thành và xác nhận khi cần.',
        steps: [
          'Mở Sessions để xem các buổi học liên quan đến tài khoản của mình.',
          'Đọc nội dung buổi học và xác nhận theo đúng quy trình của hệ thống.',
          'Nếu có thắc mắc, phản hồi qua kênh hỗ trợ thay vì sửa dữ liệu trực tiếp.',
        ],
        route: '/app/sessions',
      },
      {
        title: 'Quản lý ví và thanh toán',
        summary: 'Mở ví để kiểm tra số dư, nạp tiền và đối chiếu hóa đơn.',
        steps: [
          'Mở Wallets để xem số dư và lịch sử giao dịch.',
          'Gửi yêu cầu nạp ví, đính kèm biên lai nếu chuyển khoản.',
          'Đối chiếu hóa đơn hoặc tình trạng thanh toán khi cần.',
        ],
        route: '/app/wallets',
      },
    ],
    quickLinks: [
      { label: 'Dashboard phụ huynh', route: '/app/dashboard', note: 'Tổng quan đầu ngày cho phụ huynh.' },
      { label: 'Student progress', route: '/app/student-progress', note: 'Theo dõi tiến độ học tập.' },
      { label: 'Sessions', route: '/app/sessions', note: 'Xem và xác nhận buổi học.' },
      { label: 'Wallets', route: '/app/wallets', note: 'Kiểm tra số dư và gửi yêu cầu nạp ví.' },
      { label: 'Parent invoices', route: '/app/parent-invoices', note: 'Đối chiếu hóa đơn và thanh toán.' },
    ],
    gallery: [
      {
        title: 'Tổng quan vai trò phụ huynh',
        description: 'Ảnh giới thiệu phạm vi đúng của phụ huynh trên cổng nội bộ.',
        image: internalImage('parent_overview'),
      },
      {
        title: 'Dashboard phụ huynh',
        description: 'Tổng quan buổi học, ví và các đầu việc cần chú ý.',
        image: internalImage('parent_dashboard'),
        route: '/app/dashboard',
      },
      {
        title: 'Student progress',
        description: 'Màn hình theo dõi tiến độ học tập của con.',
        image: internalImage('parent_progress'),
        route: '/app/student-progress',
      },
      {
        title: 'Ví phụ huynh',
        description: 'Màn hình theo dõi số dư và yêu cầu nạp ví.',
        image: internalImage('parent_wallets'),
        route: '/app/wallets',
      },
    ],
    videos: [
      {
        title: 'Video thao tác phụ huynh',
        description: 'Video hướng dẫn luồng dashboard → tiến độ học → sessions → wallets cho phụ huynh.',
        src: internalVideo('parent_daily_flow'),
        poster: internalImage('parent_progress'),
      },
    ],
  },
  [Role.SALE]: {
    title: 'Cẩm nang sale',
    subtitle: 'Đi từ dashboard sang lead, order và hoa hồng bằng một lộ trình rõ ràng',
    summary:
      'Cẩm nang này giúp sale mới vào hệ thống thấy ngay luồng thao tác chuẩn: theo dõi lead, chốt order, bàn giao đúng cho vận hành và kiểm tra báo cáo hoa hồng sau khi đơn được xử lý.',
    focusLabel: 'Mục tiêu chính',
    focusValue: 'Chuyển đổi nhanh, bàn giao đúng và theo dõi đủ hoa hồng',
    heroImage: internalImage('sale_overview'),
    heroAlt: 'Tổng quan cẩm nang sale',
    guardrails: [
      'Sale tập trung vào lead, order, conversations, landing pages và commission report.',
      'Sale không có quyền vào wallet transfer, financial control hay audit log.',
      'Khi đơn đã chốt, bàn giao đủ thông tin cho vận hành thay vì tự xử lý phần xếp lớp.',
    ],
    scenarios: [
      {
        title: 'Theo dõi lead mới',
        summary: 'Mở dashboard sale rồi chuyển sang leads để xử lý follow-up.',
        steps: [
          'Xem dashboard sale để biết lượng follow-up và chỉ số cần chốt trong ngày.',
          'Mở Leads để cập nhật trạng thái, lịch hẹn và ghi chú với khách hàng.',
          'Khi lead đến từ chatbot hoặc landing page, tiếp quản đúng nguồn đầu vào.',
        ],
        route: '/app/leads',
      },
      {
        title: 'Chốt đơn và bàn giao',
        summary: 'Đi vào orders để tạo đơn, theo dõi trạng thái và bàn giao cho vận hành.',
        steps: [
          'Tạo Order khi lead đã đủ điều kiện chốt.',
          'Kiểm tra lại tình trạng đơn và hóa đơn liên quan sau khi tạo.',
          'Khi phụ huynh cần đổi giáo viên hoặc thời lượng buổi học, vào Sessions để tạo yêu cầu thay đổi thay vì nhắn miệng.',
          'Bàn giao đầy đủ thông tin cho OPS để xếp lớp hoặc triển khai tiếp.',
        ],
        route: '/app/orders',
      },
      {
        title: 'Kiểm tra hoa hồng và đầu vào marketing',
        summary: 'Mở commission report và landing pages để nhìn lại hiệu quả.',
        steps: [
          'Đối chiếu Commission report với các đơn đã chốt.',
          'Theo dõi chất lượng lead từ landing pages hoặc conversations.',
          'Dùng handbook này để chuẩn hóa cách thao tác giữa các bạn sale trong đội.',
        ],
        route: '/app/commission-report',
      },
    ],
    quickLinks: [
      { label: 'Dashboard sale', route: '/app/dashboard', note: 'Điểm mở đầu để nhìn funnel trong ngày.' },
      { label: 'Leads', route: '/app/leads', note: 'Xử lý lead và follow-up.' },
      { label: 'Orders', route: '/app/orders', note: 'Tạo và theo dõi đơn đăng ký.' },
      { label: 'Commission report', route: '/app/commission-report', note: 'Kiểm tra hoa hồng sau khi chốt đơn.' },
      { label: 'Landing pages', route: '/app/landing-pages', note: 'Theo dõi đầu vào marketing và biểu mẫu.' },
    ],
    gallery: [
      {
        title: 'Tổng quan vai trò sale',
        description: 'Ảnh giới thiệu lộ trình chuẩn của sale từ lead đến order.',
        image: internalImage('sale_overview'),
      },
      {
        title: 'Dashboard sale',
        description: 'Màn hình đầu ngày để nắm trạng thái funnel và follow-up.',
        image: internalImage('sale_dashboard'),
        route: '/app/dashboard',
      },
      {
        title: 'Leads',
        description: 'Màn hình xử lý lead và cập nhật trạng thái chăm sóc khách hàng.',
        image: internalImage('sale_leads'),
        route: '/app/leads',
      },
      {
        title: 'Orders',
        description: 'Màn hình chốt đơn và theo dõi tiến trình bàn giao sau chốt.',
        image: internalImage('sale_orders'),
        route: '/app/orders',
      },
    ],
    videos: [
      {
        title: 'Video thao tác sale',
        description: 'Video hướng dẫn luồng dashboard → leads → orders → commission report dành cho sale.',
        src: internalVideo('sale_daily_flow'),
        poster: internalImage('sale_leads'),
      },
    ],
  },
  [Role.ADSMANAGER]: {
    title: 'Cam nang ads manager',
    subtitle: 'Quan ly nhom quang cao, doc profit va giu tracking/chatbot dong bo theo dung pham vi quyen',
    summary:
      'Cam nang nay gom dung nhip lam viec cua ads manager: vao Ads management de ra soat account, group, cost va actionable tasks; vao Ads analytics de doc cohort profit; vao Chatbot settings de canh fanpage, token gan va luong AI reply.',
    focusLabel: 'Muc tieu chinh',
    focusValue: 'Toi uu ads dua tren profit, tracking dung va chatbot on dinh',
    heroImage: internalImage('sale_overview'),
    heroAlt: 'Tong quan cam nang ads manager',
    guardrails: [
      'Ads manager duoc thao tac trong Ads management, Ads analytics va Chatbot settings; khong mo rong sang user management, tai chinh hay audit log.',
      'Truoc khi sua group, can doi chieu tracking keys, nguon lead va quy tac attribution dang dung.',
      'Thu vien token nhay cam van do Director quan ly; ads manager chi su dung token va fanpage da duoc cap trong he thong.',
    ],
    scenarios: [
      {
        title: 'Ra soat dau ngay trong Ads management',
        summary: 'Bat dau tu man hinh ads-management de xem account, nhom quang cao, chi phi va viec can lam.',
        steps: [
          'Kiem tra trang thai account va group dang chay.',
          'Xem tab Viec can lam de khoanh vung nhom can xu ly som.',
          'Neu can sua nhom, cap nhat dung budget, tracking keys va ghi chu van hanh.',
        ],
        route: '/app/ads-management',
      },
      {
        title: 'Doc profit truoc khi de xuat thay doi',
        summary: 'Sang ads-analytics de doc cohort profit, parent profit va xu huong ROI truoc khi quyet dinh.',
        steps: [
          'Loc theo khoang ngay, platform va nhom quang cao can theo doi.',
          'So sanh nhom dang lai, hoa von va nhom dang lo.',
          'Dung parent-profit va realized cohort de giai thich vi sao can giu, giam hoac doi nhom.',
        ],
        route: '/app/ads-analytics',
      },
      {
        title: 'Dong bo fanpage va chatbot settings',
        summary: 'Khi nguon hoi thoai hoac fanpage can chinh, vao chatbot-settings de cap nhat dung diem.',
        steps: [
          'Kiem tra fanpage dang gan ad account nao va token OpenAI nao.',
          'Cap nhat mo ta, trang thai, auto-reply hoac token gan cho fanpage.',
          'Sau khi doi fanpage/chatbot, quay lai ads-management de doi chieu tracking va nguon leads.',
        ],
        route: '/app/chatbot-settings',
      },
    ],
    quickLinks: [
      { label: 'Ads management', route: '/app/ads-management', note: 'Ra soat account, group, chi phi va viec can lam moi ngay.' },
      { label: 'Ads analytics', route: '/app/ads-analytics', note: 'Doc cohort profit, parent profit va ROI de ra quyet dinh.' },
      { label: 'Chatbot settings', route: '/app/chatbot-settings', note: 'Canh fanpage, AI auto-reply va token dang duoc gan.' },
      { label: 'Dashboard', route: '/app/dashboard', note: 'Quay lai dashboard Ads manager de theo checklist trong ngay.' },
    ],
    gallery: [
      {
        title: 'Tong quan role ads manager',
        description: 'Anh tong quan cho nhom marketing noi bo, dung lam moc khi onboard vai tro moi.',
        image: internalImage('sale_overview'),
      },
      {
        title: 'Nhip lam viec dau ngay',
        description: 'Bat dau tu dashboard va chuyen sang Ads management de ra soat nhom quang cao.',
        image: internalImage('sale_dashboard'),
        route: '/app/ads-management',
      },
    ],
    videos: [],
    deepDive: {
      label: 'Mo Ads analytics',
      route: '/app/ads-analytics',
      note: 'Khi can de xuat budget hoac doi nhom, vao Ads analytics truoc khi thao tac.',
    },
  },
};

const DEFAULT_PLAYBOOK: HandbookPlaybook = {
  headline:
    'Dùng phần này để đọc kỹ hơn từng bước thao tác, cách nhận biết đang làm đúng và các lỗi thường gặp trước khi bắt đầu kiểm thử.',
  stages: [
    {
      title: 'Bước 1: xác nhận đúng tài khoản',
      description: 'Trước khi thao tác, luôn kiểm tra role hiện tại và menu hiển thị có khớp với mục tiêu test hay không.',
      steps: [
        'Mở dashboard và xem nhãn vai trò đang đăng nhập.',
        'Đối chiếu menu hiển thị với quyền mong đợi.',
        'Nếu sai role, đăng xuất và đăng nhập lại trước khi tiếp tục.',
      ],
      successSignal: 'Menu hiển thị đúng vai trò đang muốn kiểm thử.',
      route: '/app/dashboard',
    },
    {
      title: 'Bước 2: đi vào màn hình chính',
      description: 'Chỉ mở các màn hình thuộc phạm vi quyền của vai trò hiện tại để tránh đánh giá sai logic quyền.',
      steps: [
        'Đi theo quick links của handbook hiện tại.',
        'Không dùng link trực tiếp của role khác để kiểm tra quyền.',
        'Nếu hệ thống chặn đúng, ghi nhận là hành vi hợp lệ.',
      ],
      successSignal: 'Có thể mở các màn đúng role, còn màn ngoài quyền bị chặn đúng cách.',
    },
  ],
  pitfalls: [
    {
      title: 'Nhầm role khi test',
      detail: 'Cùng một email hoặc session cũ có thể khiến bạn nghĩ quyền sai. Luôn đăng xuất rồi vào lại bằng tài khoản đúng role.',
    },
    {
      title: 'Đánh giá dựa trên dữ liệu cũ',
      detail: 'Một số màn phụ thuộc dữ liệu mẫu. Nếu dữ liệu trống, hãy phân biệt rõ lỗi quyền và trạng thái không có dữ liệu.',
    },
  ],
  faq: [
    {
      question: 'Khi nào nên dùng handbook này?',
      answer: 'Dùng khi onboarding người mới, kiểm thử quyền, hoặc hướng dẫn vận hành nhanh theo từng tài khoản.',
    },
    {
      question: 'Nếu một màn hình mở được nhưng thao tác không được thì sao?',
      answer: 'Đó có thể là logic đúng giữa quyền xem và quyền sửa. Hãy đối chiếu thêm phần lưu ý quyền và lỗi thường gặp bên dưới.',
    },
  ],
};

const ROLE_PLAYBOOKS: Record<string, HandbookPlaybook> = {
  [Role.DIRECTOR]: {
    headline:
      'Giám đốc không cần đi quá nhiều màn trong một ngày, nhưng mỗi màn mở ra phải có mục đích rõ: nhìn toàn cảnh, phê duyệt, đối chiếu và truy vết.',
    stages: [
      {
        title: 'Đầu ngày: đọc dashboard như bảng điều khiển',
        description: 'Dashboard là nơi giám đốc lấy bức tranh tổng thể trước khi đi sâu vào từng vấn đề.',
        steps: [
          'Đọc nhanh doanh thu, số buổi học, ticket và các cảnh báo bất thường.',
          'Xác định việc nào cần phê duyệt ngay và việc nào chỉ cần theo dõi.',
          'Ghi nhận điểm nghẽn để lát nữa chuyển đúng người xử lý.',
        ],
        successSignal: 'Giám đốc có thể trả lời ngay hôm nay hệ thống đang nóng ở đâu.',
        route: '/app/dashboard',
      },
      {
        title: 'Giữa ngày: xử lý khu vực chờ duyệt và tài chính',
        description: 'Mục tiêu của giám đốc là ra quyết định sau khi đã có đối chiếu, không duyệt cảm tính.',
        steps: [
          'Mở Chờ duyệt để xem danh sách yêu cầu đang đợi xác nhận.',
          'Nếu là yêu cầu đổi buổi học, đối chiếu thêm học phí và lương giáo viên ngay trên thẻ chờ duyệt.',
          'Nếu nghiệp vụ chạm đến tiền, mở thêm Financial Control để kiểm tra số nền.',
          'Chỉ chốt khi lý do, chứng từ và dữ liệu liên quan đã đủ rõ.',
        ],
        successSignal: 'Mỗi quyết định đều có dữ liệu đối chiếu đi kèm, không có duyệt “mù”.',
        route: '/app/pending-approvals',
      },
      {
        title: 'Cuối ngày: truy vết trước khi kết luận',
        description: 'Khi có tranh cãi hoặc sai lệch, Audit log giúp giám đốc nhìn lại dòng thời gian thao tác.',
        steps: [
          'Mở Audit log để biết ai đã tạo, sửa hoặc duyệt nghiệp vụ.',
          'Đối chiếu lịch sử thao tác với dữ liệu đang hiển thị trên màn hình thực tế.',
          'Kết luận dựa trên log thay vì suy đoán.',
        ],
        successSignal: 'Có thể giải thích rõ vì sao một dữ liệu ở trạng thái hiện tại.',
        route: '/app/audit-log',
      },
    ],
    pitfalls: [
      {
        title: 'Dùng tài khoản giám đốc cho thao tác hằng ngày',
        detail: 'Nếu dùng tài khoản giám đốc để làm luôn tác vụ vận hành hoặc kế toán, bạn sẽ rất khó phát hiện lệch quyền ở các vai trò còn lại.',
      },
      {
        title: 'Duyệt trước, đối chiếu sau',
        detail: 'Đây là lỗi rủi ro nhất. Với nghiệp vụ tài chính, luôn mở thêm màn đối soát trước khi bấm duyệt.',
      },
      {
        title: 'Không truy log khi thấy bất thường',
        detail: 'Khi đã có Audit log, việc bỏ qua bước truy vết thường dẫn đến kết luận sai người hoặc sai nguyên nhân.',
      },
    ],
    faq: [
      {
        question: 'Giám đốc nên mở handbook này lúc nào?',
        answer: 'Phù hợp nhất ở đầu ngày, khi onboarding quản lý mới, hoặc khi cần xác nhận nhanh một luồng quyền/phê duyệt có đang đúng logic hay không.',
      },
      {
        question: 'Nếu màn chờ duyệt trống thì có phải lỗi không?',
        answer: 'Không. Đó có thể chỉ là không có dữ liệu chờ duyệt. Cần phân biệt rõ giữa “không có dữ liệu” và “không có quyền”.',
      },
    ],
  },
  [Role.ACCOUNTING]: {
    headline:
      'Kế toán cần hiểu rõ ranh giới giữa xem để đối chiếu và sửa dữ liệu. Handbook này ưu tiên giải thích kỹ các chỗ dễ nhầm giữa ví, hóa đơn, học sinh và payroll.',
    stages: [
      {
        title: 'Đầu ca: xác nhận top-up và biến động ví',
        description: 'Dashboard là nơi kế toán nhận tín hiệu xem hôm nay có yêu cầu nạp tiền nào cần xử lý không.',
        steps: [
          'Nhìn nhanh các số liệu top-up và wallet trên dashboard.',
          'Đi thẳng sang Wallets nếu có yêu cầu đang chờ.',
          'Mở ledger để chắc giao dịch hiển thị đúng sau khi duyệt.',
        ],
        successSignal: 'Số dư ví và ledger khớp nhau sau mỗi lần duyệt.',
        route: '/app/wallets',
      },
      {
        title: 'Trong ngày: đối chiếu hóa đơn và công nợ',
        description: 'Luồng này giúp kế toán chốt trạng thái thanh toán mà không cần đi sửa dữ liệu vận hành.',
        steps: [
          'Mở Invoices để xem danh sách hóa đơn và trạng thái hiện tại.',
          'Khi thấy lệch số, mở thêm báo cáo hoặc sao kê liên quan để so sánh.',
          'Nếu dữ liệu gốc sai từ khâu vận hành, bàn giao lại đúng bộ phận thay vì tự sửa ngoài quyền.',
        ],
        successSignal: 'Kế toán chỉ chạm vào phần tài chính, còn dữ liệu vận hành được chuyển trả đúng nơi.',
        route: '/app/invoices',
      },
      {
        title: 'Cuối kỳ: chốt payroll có đối chiếu',
        description: 'Payroll chỉ đáng tin khi đầu vào từ sessions hoặc teaching report đã đủ sạch.',
        steps: [
          'Mở Teaching report hoặc Sessions để hiểu nguồn dữ liệu lương.',
          'Qua Payroll để xem kỳ tính lương và các buổi đủ điều kiện.',
          'Nếu có tranh chấp, truy lại buổi học thay vì chỉ nhìn số cuối cùng.',
        ],
        successSignal: 'Có thể giải thích mỗi khoản lương bằng dữ liệu buổi học cụ thể.',
        route: '/app/payroll',
      },
    ],
    pitfalls: [
      {
        title: 'Thấy được học sinh rồi sửa luôn hồ sơ',
        detail: 'Kế toán hiện chỉ được đọc học sinh/lớp để đối chiếu. Sửa hồ sơ học sinh vẫn không phải trách nhiệm của role này.',
      },
      {
        title: 'Duyệt top-up nhưng quên nhìn ledger',
        detail: 'Nếu không kiểm lại ledger sau khi duyệt, rất dễ bỏ sót trường hợp giao dịch lên trạng thái sai hoặc số dư không khớp mong đợi.',
      },
      {
        title: 'Chốt lương mà không xem nguồn dữ liệu',
        detail: 'Payroll chỉ là kết quả cuối. Khi có sai khác, phải quay về teaching report hoặc sessions để xác định nguyên nhân.',
      },
    ],
    faq: [
      {
        question: 'Kế toán mở được học sinh/lớp có phải là sai quyền không?',
        answer: 'Không. Đây là thay đổi có chủ đích để kế toán đọc dữ liệu phục vụ đối soát, nhưng quyền sửa vẫn bị chặn ở frontend và backend.',
      },
      {
        question: 'OPS có được chuyển ví không?',
        answer: 'Không. Nút chuyển ví và action chuyển ví chỉ còn cho Giám đốc và Kế toán.',
      },
    ],
  },
  [Role.OPS]: {
    headline:
      'Vận hành là role điều phối. Điểm quan trọng nhất không phải là mở được bao nhiêu màn, mà là biết lúc nào cần xử lý và lúc nào cần bàn giao đúng người.',
    stages: [
      {
        title: 'Chuẩn bị lớp và lịch',
        description: 'Bắt đầu bằng việc chắc lớp học đúng người, đúng lịch, đúng dữ liệu.',
        steps: [
          'Mở Classes để kiểm tra giáo viên, sale và học sinh trên từng lớp.',
          'Sau đó sang Sessions để xem lịch đã được tạo đầy đủ chưa.',
          'Nếu thiếu dữ liệu, sửa ở đúng màn nguồn thay vì vá tạm ở màn khác.',
        ],
        successSignal: 'Lớp, giáo viên và lịch dạy khớp nhau trước giờ vào ca.',
        route: '/app/classes',
      },
      {
        title: 'Theo dõi trong ngày',
        description: 'Mục tiêu là phát hiện sớm điểm nghẽn trước khi nó trở thành sự cố cho phụ huynh hoặc giáo viên.',
        steps: [
          'Xem dashboard vận hành để nắm tình hình tổng quan.',
          'Kiểm tra attendance hoặc sessions nếu thấy buổi học có nguy cơ chậm.',
          'Vào Chờ duyệt khi có yêu cầu đổi buổi học để chốt nhanh trước giờ dạy.',
          'Mở ticket để kéo các bên liên quan vào xử lý sớm.',
        ],
        successSignal: 'Phát sinh được ghi nhận sớm, có ticket và có người chịu trách nhiệm xử lý.',
        route: '/app/tickets',
      },
      {
        title: 'Bàn giao đúng bộ phận',
        description: 'Khi sự cố chạm sang tài chính hoặc sale, vận hành cần dừng ở điểm bàn giao chứ không làm thay.',
        steps: [
          'Nếu sự cố liên quan tiền, đưa sang kế toán hoặc giám đốc.',
          'Nếu phát sinh từ lead hoặc hội thoại khách hàng, kéo sale vào xử lý.',
          'Giữ ticket như nơi ghi dấu vết phối hợp giữa các bên.',
        ],
        successSignal: 'Mỗi phát sinh đều có người nhận xử lý đúng chuyên môn.',
      },
    ],
    pitfalls: [
      {
        title: 'Ôm luôn phần tài chính',
        detail: 'Đây là lỗi rất hay gặp. Vận hành có thể nhìn thấy hệ quả tài chính nhưng không nên tự xử lý các thao tác chạm vào tiền.',
      },
      {
        title: 'Sửa dữ liệu ở màn không phải nguồn',
        detail: 'Ví dụ thấy một buổi học sai nhưng lại vá ở màn khác cho nhanh. Điều này khiến dữ liệu về sau khó truy lại nguồn gốc.',
      },
      {
        title: 'Không dùng ticket để đóng vòng phối hợp',
        detail: 'Nếu chỉ nhắn tin mà không mở ticket, phát sinh rất dễ bị bỏ quên hoặc không có dấu vết bàn giao.',
      },
    ],
    faq: [
      {
        question: 'Vì sao OPS nhìn thấy ví nhưng không được chuyển tiền?',
        answer: 'OPS có thể cần quan sát để phối hợp, nhưng hành động chuyển ví là nghiệp vụ tài chính nên đã bị giới hạn lại đúng role.',
      },
      {
        question: 'Nếu lớp trống học sinh thì handbook có còn đúng không?',
        answer: 'Có. Handbook mô tả luồng thao tác và cách đọc màn hình. Dữ liệu demo có thể khác nhau, nhưng quyền và trật tự xử lý vẫn giữ nguyên.',
      },
    ],
  },
  [Role.TEACHER]: {
    headline:
      'Giáo viên cần một cẩm nang giải thích theo nhịp làm việc thực tế: trước giờ dạy, trong buổi học, sau buổi học và khi có phát sinh nội bộ.',
    stages: [
      {
        title: 'Trước giờ dạy',
        description: 'Đây là lúc giáo viên cần xác nhận lịch, lớp và tài liệu để vào ca chủ động.',
        steps: [
          'Đăng nhập rồi xem dashboard để nắm buổi sắp tới.',
          'Mở lịch dạy để rà khung giờ và lớp phụ trách.',
          'Kiểm tra tài liệu cần dùng hoặc ghi chú mới từ vận hành.',
        ],
        successSignal: 'Giáo viên biết rõ hôm nay dạy lớp nào, lúc nào và cần chuẩn bị gì.',
        route: '/app/dashboard',
      },
      {
        title: 'Ngay sau buổi dạy',
        description: 'Phần quan trọng nhất là không để attendance và teaching report bị treo đến cuối ngày.',
        steps: [
          'Mở Attendance để điểm danh hoặc xác nhận link điểm danh đã dùng đúng.',
          'Đi sang Teaching report để nộp báo cáo giảng dạy ngay sau buổi học.',
          'Đọc lại trạng thái buổi học trước khi rời màn hình.',
        ],
        successSignal: 'Buổi học có attendance và teaching report đầy đủ ngay trong ngày.',
        route: '/app/teaching-report',
      },
      {
        title: 'Khi có phát sinh',
        description: 'Giáo viên không nên xử lý phát sinh bằng cách nhắn miệng hoặc để quên, mà cần đi qua request hoặc ticket.',
        steps: [
          'Nếu không thể dạy đúng lịch, tạo request thay thế càng sớm càng tốt.',
          'Mở ticket nếu cần OPS hoặc bộ phận khác hỗ trợ.',
          'Dùng tin nhắn nội bộ để phối hợp nhanh nhưng vẫn nên có ticket khi sự việc cần theo dấu.',
        ],
        successSignal: 'Mọi phát sinh đều có dấu vết trên hệ thống, không phụ thuộc trí nhớ.',
        route: '/app/teacher-substitute-request',
      },
    ],
    pitfalls: [
      {
        title: 'Để cuối ngày mới điểm danh hoặc viết báo cáo',
        detail: 'Khi làm dồn cuối ngày, giáo viên dễ nhầm lớp, nhầm giờ hoặc quên chi tiết buổi học. Dữ liệu sẽ kém tin cậy hơn nhiều.',
      },
      {
        title: 'Chỉ nhắn tin mà không tạo request thay thế',
        detail: 'Tin nhắn giúp trao đổi nhanh, nhưng request hoặc ticket mới là dấu vết chính thức để vận hành xử lý.',
      },
      {
        title: 'Tưởng payroll sai nhưng không kiểm buổi học',
        detail: 'Nếu lương lệch, hãy quay lại buổi học và teaching report trước. Đa số nguyên nhân nằm ở dữ liệu đầu vào chứ không phải màn payroll.',
      },
    ],
    faq: [
      {
        question: 'Khi nào nên dùng Teacher Hub chi tiết?',
        answer: 'Dùng khi cần tài liệu sâu hơn cho onboarding, xem nhiều ảnh minh họa hơn hoặc cần đọc markdown/checklist chi tiết cho giáo viên.',
      },
      {
        question: 'Nếu attendance đã làm nhưng payroll chưa tính thì sao?',
        answer: 'Hãy kiểm tra thêm teaching report, trạng thái session và điều kiện xác nhận liên quan. Payroll là kết quả cuối của nhiều bước phía trước.',
      },
    ],
  },
  [Role.PARENT]: {
    headline:
      'Phụ huynh cần một hướng dẫn dễ hiểu, ít thuật ngữ nội bộ và giải thích rõ đâu là dữ liệu xem được, đâu là phần chỉ mang tính theo dõi chứ không chỉnh sửa.',
    stages: [
      {
        title: 'Theo dõi tiến độ học',
        description: 'Bắt đầu từ dashboard rồi đi vào tiến độ học để hiểu tình hình tổng quát của con.',
        steps: [
          'Xem dashboard để nắm nhanh buổi học, ví và các mục cần chú ý.',
          'Mở Student progress để xem tiến độ học tập hoặc kết quả liên quan.',
          'Nếu muốn xem cụ thể hơn theo ngày, mở thêm lịch học hoặc điểm danh.',
        ],
        successSignal: 'Phụ huynh có thể trả lời được con đang học đến đâu và có buổi nào cần lưu ý.',
        route: '/app/student-progress',
      },
      {
        title: 'Xác nhận buổi học',
        description: 'Phần này giúp phụ huynh kiểm tra buổi học đã diễn ra và xác nhận theo đúng luồng hệ thống.',
        steps: [
          'Mở Sessions để xem buổi học liên quan.',
          'Đọc nội dung hoặc ghi chú buổi học trước khi xác nhận.',
          'Nếu có thắc mắc, dùng kênh hỗ trợ thay vì cố chỉnh sửa dữ liệu.',
        ],
        successSignal: 'Phụ huynh hiểu mình đang xác nhận cái gì và vì sao cần xác nhận.',
        route: '/app/sessions',
      },
      {
        title: 'Quản lý ví và thanh toán',
        description: 'Ví phụ huynh chỉ dành cho tài khoản của chính mình, không phải khu vực tài chính nội bộ.',
        steps: [
          'Mở Wallets để xem số dư và giao dịch gần nhất.',
          'Khi nạp ví, đính kèm biên lai nếu thanh toán bằng chuyển khoản.',
          'Đối chiếu lại hóa đơn sau khi thanh toán hoặc sau khi ví được duyệt.',
        ],
        successSignal: 'Số dư, giao dịch và hóa đơn của phụ huynh tự khớp nhau sau khi thao tác.',
        route: '/app/wallets',
      },
    ],
    pitfalls: [
      {
        title: 'Tưởng ví là tài khoản chung của trung tâm',
        detail: 'Không phải. Đây là ví của chính phụ huynh đang đăng nhập. Mọi thao tác chỉ áp dụng cho tài khoản này.',
      },
      {
        title: 'Nhìn thấy ít dữ liệu rồi nghĩ hệ thống thiếu quyền',
        detail: 'Phụ huynh vốn chỉ thấy dữ liệu gắn với mình. Ít dữ liệu thường là đúng logic chứ không phải lỗi.',
      },
      {
        title: 'Không đính kèm biên lai khi chuyển khoản',
        detail: 'Nếu dùng chuyển khoản mà thiếu biên lai, quá trình duyệt nạp ví sẽ chậm hoặc bị từ chối vì thiếu căn cứ.',
      },
    ],
    faq: [
      {
        question: 'Phụ huynh có xem được học sinh khác không?',
        answer: 'Không. Phụ huynh chỉ xem dữ liệu học tập, buổi học và ví gắn với tài khoản của mình.',
      },
      {
        question: 'Nếu ví đã gửi yêu cầu nạp mà chưa lên tiền thì sao?',
        answer: 'Cần chờ bước duyệt của kế toán. Trước tiên hãy kiểm tra đã đính kèm đúng chứng từ và thông tin thanh toán hay chưa.',
      },
    ],
  },
  [Role.SALE]: {
    headline:
      'Sale cần nhìn handbook như một lộ trình chuyển đổi: đọc dashboard để biết ưu tiên, chốt lead đúng lúc, tạo order và bàn giao đủ thông tin cho vận hành.',
    stages: [
      {
        title: 'Đầu ngày: đọc funnel',
        description: 'Dashboard sale là nơi nhìn bức tranh đầu ngày: lead nào nóng, lead nào cần follow-up và áp lực doanh số hiện tại ra sao.',
        steps: [
          'Xem dashboard để biết các chỉ số cần ưu tiên.',
          'Chuyển sang Leads để đọc lại danh sách khách hàng đang theo dõi.',
          'Đặt rõ thứ tự xử lý trước khi bắt đầu liên hệ khách.',
        ],
        successSignal: 'Sale biết rõ hôm nay nên tập trung lead nào trước.',
        route: '/app/dashboard',
      },
      {
        title: 'Trong ngày: chốt order có kiểm soát',
        description: 'Order là điểm bàn giao chính thức chứ không chỉ là “đánh dấu đã chốt”.',
        steps: [
          'Chỉ tạo order khi lead đã đủ điều kiện.',
          'Kiểm tra lại thông tin bàn giao trước khi lưu order.',
          'Nếu cần đổi giáo viên hoặc thời lượng cho một buổi chưa diễn ra, tạo Session Change Request trên màn Sessions.',
          'Sau khi tạo, theo dõi tiếp tình trạng đơn và phối hợp với OPS nếu cần.',
        ],
        successSignal: 'Order tạo xong là OPS có thể tiếp nhận mà không phải hỏi lại quá nhiều.',
        route: '/app/orders',
      },
      {
        title: 'Cuối vòng: kiểm tra hoa hồng và đầu vào',
        description: 'Đây là bước giúp sale nhìn lại hiệu quả thay vì chỉ chạy theo lead mới.',
        steps: [
          'Mở Commission report để xem các đơn đã phản ánh vào hoa hồng hay chưa.',
          'Đối chiếu thêm Landing pages hoặc Conversations để hiểu chất lượng nguồn lead.',
          'Ghi nhận kênh nào hiệu quả để tối ưu cách follow-up về sau.',
        ],
        successSignal: 'Sale không chỉ chốt đơn mà còn nhìn được kênh nào đang tạo ra đơn chất lượng.',
        route: '/app/commission-report',
      },
    ],
    pitfalls: [
      {
        title: 'Tạo order quá sớm',
        detail: 'Nếu tạo order khi lead chưa đủ điều kiện, OPS sẽ phải xử lý lại rất nhiều và dữ liệu doanh số cũng dễ bị méo.',
      },
      {
        title: 'Không bàn giao đủ thông tin cho OPS',
        detail: 'Một order thiếu thông tin khiến sale tưởng đã xong nhưng thực tế vận hành không thể triển khai trơn tru.',
      },
      {
        title: 'Chỉ nhìn số lượng lead mà không nhìn chất lượng',
        detail: 'Dashboard và báo cáo hoa hồng cần được đọc cùng nhau để hiểu nguồn lead nào đang tạo ra đơn thật.',
      },
    ],
    faq: [
      {
        question: 'Sale có cần vào landing pages không?',
        answer: 'Có, nếu bạn cần hiểu chất lượng nguồn đầu vào marketing hoặc đối chiếu submission với lead thực tế.',
      },
      {
        question: 'Nếu commission chưa lên ngay sau khi chốt đơn thì có phải lỗi không?',
        answer: 'Không hẳn. Cần kiểm tra trạng thái order, các bước bàn giao sau chốt và quy tắc ghi nhận hoa hồng trước khi kết luận.',
      },
    ],
  },
  [Role.ADSMANAGER]: {
    headline:
      'Ads manager can di theo nhip observe -> analyze -> adjust: xem dau hieu can xu ly trong Ads management, xac thuc bang profit trong Ads analytics, roi moi quay lai update group hoac chatbot settings.',
    stages: [
      {
        title: 'Dau ngay: quan sat dung cho',
        description: 'Khong nen lao vao sua ngay. Dau tien can xem nhom nao dang co van de ve chi phi, trang thai hoac tracking.',
        steps: [
          'Mo Ads management de doc account, group, chi phi va tab Viec can lam.',
          'Khoanh vung nhom can theo doi them trong ngay.',
          'Neu du lieu bat thuong, ghi lai de doi chieu o Ads analytics.',
        ],
        successSignal: 'Biet ro hom nay can xu ly nhom nao truoc va vi sao.',
        route: '/app/ads-management',
      },
      {
        title: 'Giua ngay: doc hieu qua theo loi nhuan',
        description: 'Ads analytics la noi xac nhan mot thay doi co hop ly hay khong, dua tren cohort profit va parent profit.',
        steps: [
          'Loc theo khoang ngay, platform va nhom can quyet dinh.',
          'Doc realized cohort de biet spend da tao ra doanh thu va loi nhuan thuc ra sao.',
          'Doc parent profit neu can truy ve chat luong nguon theo phu huynh.',
        ],
        successSignal: 'Co ly do ro rang truoc khi de xuat tang, giam hay dung nhom.',
        route: '/app/ads-analytics',
      },
      {
        title: 'Cuoi vong: canh lai tracking va chatbot',
        description: 'Sau khi co ket luan, moi quay lai cap nhat group hoac fanpage/chatbot settings cho dong bo.',
        steps: [
          'Sua group trong Ads management neu can doi budget, status hoac tracking keys.',
          'Vao Chatbot settings neu can doi fanpage, token gan hoac auto-reply.',
          'Kiem tra lai xem thay doi co anh huong den attribution va luong hoi thoai hay khong.',
        ],
        successSignal: 'Thay doi da duoc ghi nhan dung man hinh va khong lam vo attribution.',
        route: '/app/chatbot-settings',
      },
    ],
    pitfalls: [
      {
        title: 'Chi nhin spend ma khong nhin profit',
        detail: 'Neu chi thay chi phi tang ma khong doc cohort profit, de quyet dinh se de bi thieu ngu canh doanh thu thuc.',
      },
      {
        title: 'Sua nhom nhung quen tracking keys',
        detail: 'Tracking key khong dong bo voi nhom quang cao se lam meo attribution xuong chatbot, leads va parent-profit.',
      },
      {
        title: 'Doi fanpage ma khong doi chieu token gan',
        detail: 'Fanpage update xong nhung token OpenAI hoac ad account gan sai se dan den luong hoi thoai va bao cao bi lech.',
      },
    ],
    faq: [
      {
        question: 'Khi nao nen vao Ads management, khi nao nen vao Ads analytics?',
        answer: 'Ads management de quan sat va thao tac; Ads analytics de giai thich ly do va kiem chung hieu qua truoc khi thay doi.',
      },
      {
        question: 'Vi sao Ads manager thay duoc token gan nhung khong thay tab thu vien token?',
        answer: 'Thu vien token nhay cam van do Director quan ly. Ads manager chi duoc dung va gan lai cac token da co san trong he thong.',
      },
    ],
  },
};

@Component({
  selector: 'app-internal-handbook',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="handbook-page" *ngIf="config() as handbook" [attr.data-role]="currentRole() || 'UNKNOWN'">
      <section class="hero">
        <div class="hero-copy">
          <p class="eyebrow">Cẩm nang nội bộ</p>
          <h1>{{ handbook.title }}</h1>
          <p class="hero-subtitle">{{ handbook.subtitle }}</p>
          <p class="hero-text">{{ handbook.summary }}</p>

          <div class="hero-actions">
            <a class="btn btn-primary" [routerLink]="handbook.quickLinks[0].route">
              Mở màn hình ưu tiên
            </a>
            <a class="btn btn-secondary" *ngIf="handbook.deepDive" [routerLink]="handbook.deepDive.route">
              {{ handbook.deepDive.label }}
            </a>
            <a class="btn btn-ghost" *ngIf="handbook.videos.length" [href]="handbook.videos[0].src" target="_blank" rel="noopener">
              Xem video thao tác
            </a>
          </div>

          <div class="hero-metrics">
            <article class="metric-card">
              <span class="metric-label">{{ handbook.focusLabel }}</span>
              <strong>{{ handbook.focusValue }}</strong>
            </article>
            <article class="metric-card">
              <span class="metric-label">Vai trò hiện tại</span>
              <strong>{{ roleLabel(currentRole()) }}</strong>
            </article>
            <article class="metric-card">
              <span class="metric-label">Tư liệu đi kèm</span>
              <strong>{{ handbook.gallery.length }} ảnh • {{ handbook.videos.length }} video</strong>
            </article>
          </div>
        </div>

        <div class="hero-visual">
          <img [src]="handbook.heroImage" [alt]="handbook.heroAlt" loading="eager" />
        </div>
      </section>

      <section class="section">
        <div class="section-header">
          <div>
            <p class="section-kicker">Kịch bản chính</p>
            <h2>3 luồng thao tác cần nắm cho vai trò này</h2>
          </div>
        </div>

        <div class="scenario-grid">
          <article class="scenario-card" *ngFor="let scenario of handbook.scenarios">
            <div class="scenario-head">
              <h3>{{ scenario.title }}</h3>
              <a class="route-pill" *ngIf="scenario.route" [routerLink]="scenario.route">{{ scenario.route }}</a>
            </div>
            <p>{{ scenario.summary }}</p>
            <ul>
              <li *ngFor="let step of scenario.steps">{{ step }}</li>
            </ul>
          </article>
        </div>
      </section>

      <section class="section">
        <div class="section-header">
          <div>
            <p class="section-kicker">Giải thích chi tiết</p>
            <h2>Đi theo quy trình nào để thao tác đúng ngay từ đầu</h2>
            <p class="section-summary">{{ playbook().headline }}</p>
          </div>
        </div>

        <div class="workflow-grid">
          <article class="workflow-card" *ngFor="let stage of playbook().stages">
            <div class="workflow-head">
              <h3>{{ stage.title }}</h3>
              <a class="route-pill" *ngIf="stage.route" [routerLink]="stage.route">{{ stage.route }}</a>
            </div>
            <p>{{ stage.description }}</p>
            <ul>
              <li *ngFor="let step of stage.steps">{{ step }}</li>
            </ul>
            <div class="success-chip">Dấu hiệu làm đúng: {{ stage.successSignal }}</div>
          </article>
        </div>
      </section>

      <section class="section">
        <div class="section-header">
          <div>
            <p class="section-kicker">Ảnh minh họa</p>
            <h2>Gallery màn hình mẫu cho {{ roleLabel(currentRole()) }}</h2>
          </div>
        </div>

        <div class="gallery-grid">
          <article class="gallery-card" *ngFor="let item of handbook.gallery">
            <img [src]="item.image" [alt]="item.title" loading="lazy" />
            <div class="gallery-copy">
              <h3>{{ item.title }}</h3>
              <p>{{ item.description }}</p>
              <div class="gallery-actions">
                <a class="text-link" [href]="item.image" target="_blank" rel="noopener">Mở ảnh</a>
                <a class="text-link" *ngIf="item.route" [routerLink]="item.route">Mở màn hình</a>
              </div>
            </div>
          </article>
        </div>
      </section>

      <section class="section">
        <div class="section-header">
          <div>
            <p class="section-kicker">Video thao tác</p>
            <h2>Video hướng dẫn quay từ môi trường demo thật</h2>
          </div>
        </div>

        <div class="video-grid">
          <article class="video-card" *ngFor="let video of handbook.videos">
            <video controls preload="metadata" [poster]="video.poster">
              <source [src]="video.src" type="video/webm" />
            </video>
            <div class="video-copy">
              <h3>{{ video.title }}</h3>
              <p>{{ video.description }}</p>
              <a class="text-link" [href]="video.src" target="_blank" rel="noopener">Mở video riêng</a>
            </div>
          </article>
        </div>
      </section>

      <section class="section dual-layout">
        <div class="panel">
          <p class="section-kicker">Lỗi thường gặp</p>
          <h2>Những chỗ người dùng hay nhầm khi thao tác</h2>
          <div class="pitfall-list">
            <article class="pitfall-card" *ngFor="let item of playbook().pitfalls">
              <h3>{{ item.title }}</h3>
              <p>{{ item.detail }}</p>
            </article>
          </div>
        </div>

        <div class="panel">
          <p class="section-kicker">Hỏi đáp nhanh</p>
          <h2>Giải thích rõ những thắc mắc thường gặp</h2>
          <div class="faq-list">
            <article class="faq-card" *ngFor="let item of playbook().faq">
              <h3>{{ item.question }}</h3>
              <p>{{ item.answer }}</p>
            </article>
          </div>
        </div>
      </section>

      <section class="section dual-layout">
        <div class="panel">
          <p class="section-kicker">Lối vào nhanh</p>
          <h2>Các màn hình cần dùng thường xuyên</h2>
          <div class="link-grid">
            <a class="link-card" *ngFor="let link of handbook.quickLinks" [routerLink]="link.route">
              <strong>{{ link.label }}</strong>
              <span>{{ link.note }}</span>
              <code>{{ link.route }}</code>
            </a>
          </div>
        </div>

        <div class="panel">
          <p class="section-kicker">Lưu ý quyền</p>
          <h2>Những điểm cần nhớ khi đào tạo hoặc kiểm thử</h2>
          <ul class="guardrail-list">
            <li *ngFor="let note of handbook.guardrails">{{ note }}</li>
          </ul>

          <a class="deep-link" *ngIf="handbook.deepDive" [routerLink]="handbook.deepDive.route">
            {{ handbook.deepDive.note }}
          </a>
        </div>
      </section>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      min-height: 100%;
      padding: 28px;
      background:
        radial-gradient(circle at top right, rgba(249, 115, 22, 0.12), transparent 18%),
        radial-gradient(circle at left center, rgba(13, 148, 136, 0.14), transparent 20%),
        linear-gradient(180deg, #f4efe6 0%, #f8f4ec 34%, #fcfbf7 100%);
      color: #132238;
      font-family: 'Trebuchet MS', 'Aptos', 'Segoe UI', sans-serif;
    }

    .handbook-page {
      display: grid;
      gap: 24px;
      max-width: 1480px;
      margin: 0 auto;
    }

    .hero,
    .section,
    .scenario-card,
    .gallery-card,
    .video-card,
    .metric-card,
    .panel,
    .link-card {
      box-shadow: 0 18px 48px rgba(15, 23, 42, 0.08);
    }

    .hero,
    .section {
      border-radius: 32px;
      border: 1px solid rgba(20, 33, 61, 0.08);
      background: rgba(255, 252, 247, 0.88);
      backdrop-filter: blur(10px);
    }

    .hero {
      display: grid;
      grid-template-columns: minmax(0, 1.1fr) minmax(340px, 0.9fr);
      gap: 24px;
      padding: 30px;
      overflow: hidden;
    }

    .hero-copy {
      display: grid;
      gap: 16px;
      align-content: start;
    }

    .eyebrow,
    .section-kicker,
    .metric-label {
      display: inline-flex;
      align-items: center;
      width: fit-content;
      padding: 8px 12px;
      border-radius: 999px;
      background: rgba(13, 148, 136, 0.12);
      color: #0f766e;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      font-size: 11px;
      font-weight: 800;
    }

    h1,
    h2,
    h3 {
      margin: 0;
      font-family: 'Aptos Display', 'Trebuchet MS', 'Segoe UI', sans-serif;
      letter-spacing: -0.03em;
    }

    h1 {
      font-size: clamp(34px, 5vw, 56px);
      line-height: 1.02;
    }

    h2 {
      font-size: clamp(28px, 3.2vw, 40px);
      line-height: 1.08;
    }

    h3 {
      font-size: 22px;
      line-height: 1.16;
    }

    .hero-subtitle {
      margin: 0;
      font-size: 18px;
      font-weight: 700;
      color: #9a3412;
      line-height: 1.55;
    }

    .hero-text,
    .scenario-card p,
    .workflow-card p,
    .gallery-copy p,
    .video-copy p,
    .link-card span,
    .guardrail-list,
    .section-summary,
    .pitfall-card p,
    .faq-card p {
      margin: 0;
      color: #475569;
      font-size: 15px;
      line-height: 1.68;
    }

    .hero-actions,
    .gallery-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      align-items: center;
    }

    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 44px;
      padding: 0 18px;
      border-radius: 999px;
      border: 1px solid transparent;
      text-decoration: none;
      font-size: 14px;
      font-weight: 700;
      transition: transform 160ms ease, box-shadow 160ms ease;
    }

    .btn:hover {
      transform: translateY(-1px);
    }

    .btn-primary {
      background: linear-gradient(135deg, #0f766e 0%, #115e59 100%);
      color: #f8fafc;
      box-shadow: 0 12px 24px rgba(15, 118, 110, 0.2);
    }

    .btn-secondary {
      background: #fff7ed;
      border-color: rgba(217, 119, 6, 0.2);
      color: #9a3412;
    }

    .btn-ghost {
      background: transparent;
      border-color: rgba(20, 33, 61, 0.12);
      color: #14213d;
    }

    .hero-metrics {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 14px;
    }

    .metric-card,
    .scenario-card,
    .gallery-card,
    .video-card,
    .panel,
    .link-card {
      border-radius: 24px;
      border: 1px solid rgba(20, 33, 61, 0.08);
      background: rgba(255, 255, 255, 0.94);
    }

    .metric-card {
      padding: 18px;
      display: grid;
      gap: 10px;
    }

    .metric-card strong {
      font-size: 18px;
      color: #14213d;
    }

    .hero-visual {
      position: relative;
      min-height: 100%;
      display: flex;
    }

    .hero-visual::before {
      content: '';
      position: absolute;
      inset: 18px 0 0 18px;
      border-radius: 28px;
      background: linear-gradient(145deg, rgba(217, 119, 6, 0.14), rgba(20, 184, 166, 0.14));
      filter: blur(6px);
    }

    .hero-visual img {
      position: relative;
      width: 100%;
      height: 100%;
      object-fit: cover;
      border-radius: 28px;
      border: 1px solid rgba(255, 255, 255, 0.74);
      display: block;
    }

    .section {
      padding: 26px;
      display: grid;
      gap: 18px;
    }

    .section-header {
      display: flex;
      align-items: end;
      justify-content: space-between;
      gap: 16px;
    }

    .scenario-grid,
    .workflow-grid,
    .gallery-grid,
    .video-grid,
    .link-grid {
      display: grid;
      gap: 16px;
    }

    .scenario-grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    .workflow-grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    .gallery-grid {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }

    .video-grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    .pitfall-list,
    .faq-list {
      display: grid;
      gap: 14px;
    }

    .pitfall-card,
    .faq-card {
      padding: 18px;
      border-radius: 20px;
      border: 1px solid rgba(20, 33, 61, 0.08);
      background: rgba(255, 255, 255, 0.94);
      display: grid;
      gap: 8px;
    }

    .scenario-card {
      padding: 22px;
      display: grid;
      gap: 12px;
    }

    .workflow-card {
      padding: 22px;
      display: grid;
      gap: 12px;
      border-radius: 24px;
      border: 1px solid rgba(20, 33, 61, 0.08);
      background: linear-gradient(180deg, rgba(255, 247, 237, 0.94) 0%, rgba(255, 255, 255, 0.96) 100%);
      box-shadow: 0 18px 48px rgba(15, 23, 42, 0.08);
    }

    .workflow-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      flex-wrap: wrap;
    }

    .scenario-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      flex-wrap: wrap;
    }

    .route-pill {
      display: inline-flex;
      align-items: center;
      width: fit-content;
      padding: 6px 10px;
      border-radius: 999px;
      background: #f1f5f9;
      color: #475569;
      text-decoration: none;
      font-size: 12px;
      font-weight: 700;
    }

    .success-chip {
      display: inline-flex;
      align-items: center;
      width: fit-content;
      padding: 8px 12px;
      border-radius: 999px;
      background: rgba(22, 163, 74, 0.12);
      color: #166534;
      font-size: 12px;
      font-weight: 700;
      line-height: 1.5;
    }

    ul {
      margin: 0;
      padding-left: 20px;
      display: grid;
      gap: 8px;
      color: #334155;
      font-size: 14px;
      line-height: 1.58;
    }

    li::marker {
      color: #d97706;
    }

    .gallery-card,
    .video-card {
      overflow: hidden;
    }

    .gallery-card {
      display: grid;
      grid-template-rows: 220px auto;
    }

    .gallery-card img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }

    .gallery-copy,
    .video-copy {
      padding: 18px;
      display: grid;
      gap: 10px;
    }

    .video-card video {
      width: 100%;
      display: block;
      aspect-ratio: 16 / 10;
      background: #0f172a;
    }

    .text-link,
    .deep-link {
      color: #0f766e;
      text-decoration: none;
      font-weight: 700;
    }

    .text-link:hover,
    .deep-link:hover {
      color: #115e59;
      text-decoration: underline;
    }

    .dual-layout {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 18px;
    }

    .panel {
      padding: 22px;
      display: grid;
      gap: 14px;
    }

    .link-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .link-card {
      display: grid;
      gap: 10px;
      padding: 18px;
      text-decoration: none;
      color: inherit;
      transition: transform 160ms ease, box-shadow 160ms ease;
    }

    .link-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 20px 50px rgba(15, 23, 42, 0.1);
    }

    .link-card strong {
      color: #0f172a;
      font-size: 18px;
    }

    .link-card code {
      width: fit-content;
      border-radius: 999px;
      background: #f1f5f9;
      padding: 6px 10px;
      color: #475569;
      font-size: 12px;
      font-weight: 700;
    }

    .guardrail-list {
      padding-left: 20px;
    }

    @media (max-width: 1320px) {
      .hero,
      .scenario-grid,
      .workflow-grid,
      .gallery-grid,
      .video-grid,
      .dual-layout,
      .link-grid {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 920px) {
      :host {
        padding: 16px;
      }

      .hero,
      .section {
        padding: 18px;
        border-radius: 24px;
      }

      .hero-metrics {
        grid-template-columns: 1fr;
      }

      .section-header {
        flex-direction: column;
        align-items: start;
      }

      .gallery-card {
        grid-template-rows: 190px auto;
      }
    }
  `],
})
export class InternalHandbookComponent {
  private readonly auth = inject(AuthService);

  protected readonly currentRole = computed(
    () => (this.auth.userSignal()?.role as Role | undefined) || Role.STAFF,
  );

  protected readonly config = computed(
    () => HANDBOOK_CONFIG[this.currentRole()] || LEGACY_CONFIG,
  );

  protected readonly playbook = computed(
    () => ROLE_PLAYBOOKS[this.currentRole()] || DEFAULT_PLAYBOOK,
  );

  protected roleLabel(role?: string): string {
    const labels: Record<string, string> = {
      DIRECTOR: 'Giám đốc',
      ACCOUNTING: 'Kế toán',
      OPS: 'Vận hành',
      ADSMANAGER: 'Ads manager',
      TEACHER: 'Giáo viên',
      PARENT: 'Phụ huynh',
      SALE: 'Sale',
      MANAGER: 'Quản lý cũ',
      HCNS: 'Hành chính cũ',
      PARTIME: 'Part-time cũ',
      STAFF: 'Nhân viên cũ',
    };
    return labels[role || ''] || (role || 'Không xác định');
  }
}
