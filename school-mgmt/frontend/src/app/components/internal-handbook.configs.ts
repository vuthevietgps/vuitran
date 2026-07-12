import { Role } from '../models/role.enum';
import { HandbookConfig, internalImage, internalVideo, teacherImage, teacherVideo } from './internal-handbook.types';

export const LEGACY_CONFIG: HandbookConfig = {
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

export const HANDBOOK_CONFIG: Record<string, HandbookConfig> = {
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
      { label: 'Cẩm nang Kế toán', route: '/app/accounting-hub', note: 'Toàn bộ quy trình kế toán: ví, hóa đơn, lương và đối soát.' },
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
          'Mở Attendance để tạo link điểm danh (bắt buộc) và gửi cho học sinh tự check-in.',
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
    title: 'Cẩm nang Ads Manager',
    subtitle: 'Quản lý nhóm quảng cáo, đọc profit và giữ tracking/chatbot đồng bộ theo đúng phạm vi quyền',
    summary:
      'Cẩm nang này gom đúng nhịp làm việc của Ads Manager: vào Ads Hub để nắm quy trình đầy đủ; vào Ads Management để rà soát account, group, cost và actionable tasks; vào Ads Analytics để đọc cohort profit; vào Chatbot Settings để cảnh báo fanpage, token gắn và luồng AI reply.',
    focusLabel: 'Mục tiêu chính',
    focusValue: 'Tối ưu ads dựa trên profit, tracking đúng và chatbot ổn định',
    heroImage: internalImage('sale_overview'),
    heroAlt: 'Tổng quan cẩm nang Ads Manager',
    guardrails: [
      'Ads Manager được thao tác trong Ads Management, Ads Analytics và Chatbot Settings; không mở rộng sang user management, tài chính hay audit log.',
      'Trước khi sửa group, cần đối chiếu tracking keys, nguồn lead và quy tắc attribution đang dùng.',
      'Thư viện token nhạy cảm vẫn do Director quản lý; Ads Manager chỉ sử dụng token và fanpage đã được cấp trong hệ thống.',
    ],
    scenarios: [
      {
        title: 'Nắm quy trình và bắt đầu ngày',
        summary: 'Mở Cẩm nang Ads để nắm đầy đủ luồng vận hành, sau đó rà soát trong Ads Management.',
        steps: [
          'Mở Cẩm nang Ads (/app/ads-hub) để đọc lại quy trình và điểm kiểm soát.',
          'Kiểm tra trạng thái tài khoản và nhóm đang chạy trong Ads Management.',
          'Xem tab Việc cần làm để khoanh vùng nhóm cần xử lý ưu tiên trong ngày.',
        ],
        route: '/app/ads-hub',
      },
      {
        title: 'Đọc profit trước khi đề xuất thay đổi',
        summary: 'Sang Ads Analytics để đọc cohort profit, parent profit và xu hướng ROI trước khi quyết định.',
        steps: [
          'Lọc theo khoảng ngày, platform và nhóm quảng cáo cần theo dõi.',
          'So sánh nhóm đang lãi, hòa vốn và nhóm đang lỗ.',
          'Dùng parent-profit và realized cohort để giải thích vì sao cần giữ, giảm hoặc đổi nhóm.',
        ],
        route: '/app/ads-analytics',
      },
      {
        title: 'Đồng bộ fanpage và chatbot settings',
        summary: 'Khi nguồn hội thoại hoặc fanpage cần chỉnh, vào Chatbot Settings để cập nhật đúng điểm.',
        steps: [
          'Kiểm tra fanpage đang gắn ad account nào và token OpenAI nào.',
          'Cập nhật mô tả, trạng thái, auto-reply hoặc token gắn cho fanpage.',
          'Sau khi đổi fanpage/chatbot, quay lại Ads Management để đối chiếu tracking và nguồn leads.',
        ],
        route: '/app/chatbot-settings',
      },
    ],
    quickLinks: [
      { label: 'Cẩm nang Ads', route: '/app/ads-hub', note: 'Quy trình đầy đủ, checklist và phân quyền cho Ads Manager.' },
      { label: 'Ads Management', route: '/app/ads-management', note: 'Rà soát tài khoản, nhóm QC, chi phí và việc cần làm mỗi ngày.' },
      { label: 'Ads Analytics', route: '/app/ads-analytics', note: 'Đọc cohort profit, parent profit và ROI để ra quyết định.' },
      { label: 'Chatbot Settings', route: '/app/chatbot-settings', note: 'Cảnh báo fanpage, AI auto-reply và token đang được gắn.' },
      { label: 'Dashboard', route: '/app/dashboard', note: 'Quay lại dashboard Ads Manager để theo checklist trong ngày.' },
    ],
    gallery: [
      {
        title: 'Tổng quan role Ads Manager',
        description: 'Ảnh tổng quan cho nhóm marketing nội bộ, dùng làm mốc khi onboard vai trò mới.',
        image: internalImage('sale_overview'),
      },
      {
        title: 'Nhịp làm việc đầu ngày',
        description: 'Bắt đầu từ Cẩm nang Ads rồi chuyển sang Ads Management để rà soát nhóm quảng cáo.',
        image: internalImage('sale_dashboard'),
        route: '/app/ads-hub',
      },
    ],
    videos: [],
    deepDive: {
      label: 'Mở Cẩm nang Ads',
      route: '/app/ads-hub',
      note: 'Khi cần nắm đầy đủ quy trình, phân quyền hoặc onboard vai trò mới, mở Cẩm nang Ads trước.',
    },
  },
};
