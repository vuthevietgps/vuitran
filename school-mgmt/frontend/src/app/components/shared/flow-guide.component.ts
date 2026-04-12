import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

interface FlowStep {
  step: string;
  desc: string;
}

interface FlowInfo {
  title: string;
  summary: string;
  steps: FlowStep[];
}

const FLOW_DATA: Record<string, FlowInfo> = {
  dashboard: {
    title: 'Dashboard',
    summary: 'Tổng quan hoạt động của trung tâm, hiển thị các chỉ số quan trọng.',
    steps: [
      { step: 'Đăng nhập', desc: 'Hệ thống tự động hiển thị Dashboard phù hợp với vai trò người dùng.' },
      { step: 'Xem chỉ số', desc: 'Tổng quan doanh thu, số học sinh, lớp học, leads, đơn hàng.' },
      { step: 'Theo dõi cảnh báo', desc: 'Hiển thị các mục cần xử lý: follow-up, hóa đơn chờ duyệt, buổi học sắp tới.' },
    ],
  },
  'pending-approvals': {
    title: 'Chờ duyệt',
    summary: 'Duyệt các yêu cầu từ nhân viên: hóa đơn, đơn hàng, xin nghỉ, chi phí và yêu cầu thay đổi buổi học.',
    steps: [
      { step: 'Xem danh sách', desc: 'Hiển thị tất cả yêu cầu đang chờ duyệt, phân loại theo loại yêu cầu.' },
      { step: 'Xem chi tiết', desc: 'Click vào yêu cầu để xem thông tin chi tiết, đặc biệt là tác động tài chính của các yêu cầu đổi buổi học.' },
      { step: 'Duyệt / Từ chối', desc: 'Giám đốc hoặc OPS duyệt, từ chối và có thể ghi chú lý do.' },
      { step: 'Thông báo', desc: 'Hệ thống tự động gửi thông báo kết quả cho người yêu cầu.' },
    ],
  },
  notifications: {
    title: 'Thông báo',
    summary: 'Quản lý và xem các thông báo từ hệ thống.',
    steps: [
      { step: 'Nhận thông báo', desc: 'Hệ thống tự động gửi thông báo khi có sự kiện liên quan.' },
      { step: 'Xem danh sách', desc: 'Hiển thị tất cả thông báo, có badge đếm chưa đọc.' },
      { step: 'Đọc chi tiết', desc: 'Click vào thông báo để xem nội dung và đánh dấu đã đọc.' },
    ],
  },
  users: {
    title: 'Quản lý User',
    summary: 'Quản lý tài khoản người dùng hệ thống: nhân viên, giáo viên, phụ huynh.',
    steps: [
      { step: 'Xem danh sách', desc: 'Danh sách tất cả tài khoản, lọc theo vai trò, trạng thái.' },
      { step: 'Tạo tài khoản', desc: 'Nhập thông tin: họ tên, email, SĐT, vai trò, mật khẩu.' },
      { step: 'Chỉnh sửa', desc: 'Cập nhật thông tin, đổi vai trò, reset mật khẩu.' },
      { step: 'Vô hiệu hóa', desc: 'Khóa tài khoản không còn sử dụng.' },
    ],
  },
  'parent-accounts': {
    title: 'Tài khoản phụ huynh',
    summary: 'Quản lý tài khoản phụ huynh, liên kết với học sinh.',
    steps: [
      { step: 'Xem danh sách', desc: 'Danh sách phụ huynh, lọc theo tên, SĐT.' },
      { step: 'Tạo tài khoản', desc: 'Nhập thông tin phụ huynh và liên kết với học sinh.' },
      { step: 'Quản lý ví', desc: 'Xem số dư ví, lịch sử nạp/trừ tiền.' },
    ],
  },
  products: {
    title: 'Quản lý gói sản phẩm',
    summary: 'Tạo và quản lý các gói học (khóa học, combo buổi).',
    steps: [
      { step: 'Xem danh sách', desc: 'Hiển thị tất cả gói sản phẩm với giá, số buổi, loại lớp.' },
      { step: 'Tạo gói mới', desc: 'Nhập tên gói, giá, số buổi, loại lớp (online/offline), mô tả.' },
      { step: 'Chỉnh sửa', desc: 'Cập nhật thông tin gói, điều chỉnh giá.' },
      { step: 'Kích hoạt/Ẩn', desc: 'Bật/tắt gói sản phẩm trên hệ thống.' },
    ],
  },
  students: {
    title: 'Quản lý Học sinh',
    summary: 'Quản lý thông tin học sinh, lớp học, tiến trình.',
    steps: [
      { step: 'Xem danh sách', desc: 'Danh sách học sinh, lọc theo tên, lớp, trạng thái.' },
      { step: 'Thêm học sinh', desc: 'Nhập thông tin: họ tên, ngày sinh, phụ huynh, lớp.' },
      { step: 'Xem chi tiết', desc: 'Xem hồ sơ đầy đủ: thông tin cá nhân, lớp học, buổi còn lại, điểm danh.' },
      { step: 'Chuyển lớp', desc: 'Chuyển học sinh sang lớp khác khi cần.' },
    ],
  },
  classes: {
    title: 'Quản lý Lớp học',
    summary: 'Tạo và quản lý lớp học, phân giáo viên, lịch học.',
    steps: [
      { step: 'Xem danh sách', desc: 'Danh sách lớp học với giáo viên, số học sinh, lịch học.' },
      { step: 'Tạo lớp mới', desc: 'Nhập tên lớp, loại (online/offline), giáo viên, lịch học.' },
      { step: 'Quản lý học sinh', desc: 'Thêm/xóa học sinh khỏi lớp.' },
      { step: 'Xem lịch', desc: 'Xem lịch học chi tiết của lớp.' },
    ],
  },
  leads: {
    title: 'KH tiềm năng (Leads)',
    summary: 'Quản lý khách hàng tiềm năng, theo dõi tư vấn và chuyển đổi.',
    steps: [
      { step: 'Tiếp nhận Lead', desc: 'Lead được tạo từ quảng cáo, chatbot, hoặc nhập tay. Tự động phân bổ cho Sale.' },
      { step: 'Liên hệ tư vấn', desc: 'Sale gọi điện/nhắn Zalo tư vấn, ghi nhận lịch sử liên hệ.' },
      { step: 'Theo dõi Follow-up', desc: 'Đặt lịch follow-up, hệ thống nhắc khi đến hạn.' },
      { step: 'Chuyển đổi', desc: 'Khi khách đồng ý, chuyển Lead thành Đơn đăng ký.' },
      { step: 'Đánh dấu mất', desc: 'Nếu không chuyển đổi, đánh dấu lý do mất lead.' },
    ],
  },
  orders: {
    title: 'Đơn đăng ký',
    summary: 'Quản lý đơn đăng ký học, gia hạn, mua thêm buổi.',
    steps: [
      { step: 'Tạo đơn', desc: 'Tạo đơn từ Lead hoặc trực tiếp: chọn học sinh, gói sản phẩm, giá.' },
      { step: 'Gửi duyệt', desc: 'Sale gửi đơn cho Giám đốc duyệt.' },
      { step: 'Duyệt đơn', desc: 'Giám đốc xem xét và duyệt/từ chối đơn.' },
      { step: 'Thanh toán', desc: 'Sau khi duyệt, tạo hóa đơn thanh toán.' },
      { step: 'Enrollment', desc: 'Hệ thống tự động cập nhật buổi học, ví, lớp cho học sinh.' },
    ],
  },
  'commission-report': {
    title: 'BC Hoa hồng',
    summary: 'Báo cáo hoa hồng bán hàng cho nhân viên Sale.',
    steps: [
      { step: 'Xem tổng quan', desc: 'Hiển thị tổng doanh thu, hoa hồng đã nhận, đang chờ.' },
      { step: 'Lọc theo thời gian', desc: 'Lọc báo cáo theo tháng, quý, năm.' },
      { step: 'Chi tiết đơn hàng', desc: 'Xem hoa hồng chi tiết từng đơn hàng đã chốt.' },
    ],
  },
  'ads-management': {
    title: 'Quản lý Quảng cáo',
    summary: 'Quản lý tài khoản quảng cáo, nhóm QC, theo dõi chi phí & hiệu quả.',
    steps: [
      { step: 'Kết nối tài khoản', desc: 'Thêm tài khoản quảng cáo Facebook/Google/TikTok với API token.' },
      { step: 'Tạo nhóm QC', desc: 'Tạo nhóm quảng cáo: tên, nền tảng, ngân sách, thời gian chạy.' },
      { step: 'Theo dõi chi phí', desc: 'Tự động đồng bộ chi phí từ nền tảng QC, tính CPL/CPA.' },
      { step: 'Phân tích ROI', desc: 'So sánh chi phí QC với doanh thu thực tế để đánh giá hiệu quả.' },
    ],
  },
  'ads-analytics': {
    title: 'Phân tích Quảng cáo',
    summary: 'Phân tích chi tiết hiệu quả quảng cáo, so sánh các chiến dịch.',
    steps: [
      { step: 'Chọn khoảng thời gian', desc: 'Lọc dữ liệu theo ngày/tuần/tháng.' },
      { step: 'Xem biểu đồ', desc: 'Biểu đồ chi phí, CPL, số lead, tỷ lệ chuyển đổi theo thời gian.' },
      { step: 'So sánh nền tảng', desc: 'So sánh hiệu quả giữa Facebook, Google, TikTok.' },
      { step: 'Xuất báo cáo', desc: 'Xuất dữ liệu phân tích ra Excel.' },
    ],
  },
  conversations: {
    title: 'Hội thoại Chatbot',
    summary: 'Xem và quản lý các cuộc hội thoại từ chatbot Zalo/Facebook.',
    steps: [
      { step: 'Xem danh sách', desc: 'Danh sách cuộc hội thoại, lọc theo trạng thái, nền tảng.' },
      { step: 'Đọc chi tiết', desc: 'Xem lịch sử tin nhắn giữa chatbot và khách hàng.' },
      { step: 'Can thiệp', desc: 'Sale có thể tiếp quản hội thoại từ chatbot để tư vấn trực tiếp.' },
      { step: 'Chuyển Lead', desc: 'Chuyển cuộc hội thoại thành Lead để theo dõi.' },
    ],
  },
  'chatbot-settings': {
    title: 'Cài đặt Chatbot',
    summary: 'Cấu hình chatbot: kịch bản hội thoại, tích hợp nền tảng.',
    steps: [
      { step: 'Cấu hình kết nối', desc: 'Kết nối chatbot với Zalo OA, Facebook Page.' },
      { step: 'Thiết lập kịch bản', desc: 'Cấu hình các câu trả lời tự động, flow hội thoại.' },
      { step: 'Quản lý webhook', desc: 'Cấu hình webhook nhận tin nhắn từ các nền tảng.' },
    ],
  },
  'student-progress': {
    title: 'Tiến trình học',
    summary: 'Phụ huynh theo dõi tiến trình học tập của con.',
    steps: [
      { step: 'Xem tổng quan', desc: 'Hiển thị số buổi đã học, buổi còn lại, tỷ lệ tham gia.' },
      { step: 'Xem chi tiết buổi học', desc: 'Xem nhận xét của giáo viên sau mỗi buổi học.' },
      { step: 'Theo dõi điểm danh', desc: 'Lịch sử điểm danh: có mặt, vắng, nghỉ phép.' },
    ],
  },
  'parent-attendance': {
    title: 'Điểm danh (Phụ huynh)',
    summary: 'Phụ huynh xem lịch sử điểm danh của con.',
    steps: [
      { step: 'Chọn học sinh', desc: 'Nếu có nhiều con, chọn học sinh cần xem.' },
      { step: 'Xem lịch sử', desc: 'Danh sách buổi học với trạng thái điểm danh.' },
      { step: 'Xem chi tiết', desc: 'Xem ghi chú, nhận xét giáo viên cho từng buổi.' },
    ],
  },
  sessions: {
    title: 'Buổi học',
    summary: 'Quản lý danh sách buổi học, lịch trình, trạng thái và yêu cầu thay đổi buổi học.',
    steps: [
      { step: 'Xem danh sách', desc: 'Hiển thị buổi học theo ngày/tuần, lọc theo lớp, giáo viên.' },
      { step: 'Tạo buổi học', desc: 'Tạo buổi học mới: chọn lớp, giáo viên, thời gian, phòng.' },
      { step: 'Yêu cầu thay đổi', desc: 'Sale mở chi tiết buổi học để gửi đề nghị đổi giáo viên hoặc thời lượng trước khi buổi học diễn ra.' },
      { step: 'Phê duyệt', desc: 'Director hoặc OPS xử lý yêu cầu trên màn Chờ duyệt, hệ thống chỉ cập nhật session sau khi được phê duyệt.' },
    ],
  },
  'parent-calendar': {
    title: 'Lịch học (Phụ huynh)',
    summary: 'Phụ huynh xem lịch học của con theo tuần/tháng.',
    steps: [
      { step: 'Xem lịch', desc: 'Hiển thị lịch học dạng calendar với các buổi học sắp tới.' },
      { step: 'Xem chi tiết', desc: 'Click vào buổi học để xem thông tin: giáo viên, lớp, phòng.' },
    ],
  },
  attendance: {
    title: 'Điểm danh',
    summary: 'Giáo viên điểm danh học sinh cho buổi học.',
    steps: [
      { step: 'Chọn buổi học', desc: 'Chọn buổi học cần điểm danh từ danh sách.' },
      { step: 'Điểm danh', desc: 'Đánh dấu có mặt/vắng/trễ cho từng học sinh.' },
      { step: 'Ghi chú', desc: 'Thêm ghi chú, nhận xét cho học sinh.' },
      { step: 'Lưu kết quả', desc: 'Xác nhận và lưu điểm danh, hệ thống tự động trừ buổi.' },
    ],
  },
  'teaching-materials': {
    title: 'Tài liệu giảng dạy',
    summary: 'Quản lý tài liệu, giáo trình phục vụ giảng dạy.',
    steps: [
      { step: 'Xem danh sách', desc: 'Danh sách tài liệu theo môn học, cấp độ.' },
      { step: 'Tải lên tài liệu', desc: 'Upload file PDF, hình ảnh, video bài giảng.' },
      { step: 'Phân loại', desc: 'Gắn tag, phân loại theo chủ đề, cấp độ.' },
      { step: 'Chia sẻ', desc: 'Chia sẻ tài liệu với giáo viên khác trong hệ thống.' },
    ],
  },
  'teaching-report': {
    title: 'BC Giảng dạy',
    summary: 'Báo cáo hoạt động giảng dạy: số buổi dạy, số học sinh, chất lượng.',
    steps: [
      { step: 'Chọn khoảng thời gian', desc: 'Lọc báo cáo theo tháng/quý.' },
      { step: 'Xem tổng quan', desc: 'Tổng số buổi dạy, học sinh, tỷ lệ điểm danh.' },
      { step: 'Chi tiết giáo viên', desc: 'Xem báo cáo chi tiết từng giáo viên.' },
    ],
  },
  'teacher-kpi': {
    title: 'KPI Giáo viên',
    summary: 'Đánh giá hiệu suất giáo viên dựa trên các chỉ số KPI.',
    steps: [
      { step: 'Xem bảng KPI', desc: 'Bảng xếp hạng giáo viên theo điểm KPI tổng hợp.' },
      { step: 'Xem chi tiết', desc: 'Chi tiết từng chỉ số: số buổi dạy, tỷ lệ điểm danh HS, đánh giá.' },
      { step: 'Đánh giá', desc: 'Giám đốc đánh giá và ghi nhận KPI cho giáo viên.' },
    ],
  },
  'calendar-overview': {
    title: 'Lịch tổng quan',
    summary: 'Xem lịch tổng quan tất cả lớp học, buổi học trong trung tâm.',
    steps: [
      { step: 'Xem lịch', desc: 'Hiển thị lịch dạng tuần/tháng với tất cả buổi học.' },
      { step: 'Lọc theo GV/Lớp', desc: 'Lọc lịch theo giáo viên hoặc lớp cụ thể.' },
      { step: 'Xem chi tiết', desc: 'Click vào buổi học để xem thông tin chi tiết.' },
    ],
  },
  'teacher-profiles': {
    title: 'Quản lý giáo viên',
    summary: 'Quản lý hồ sơ giáo viên: thông tin cá nhân, hợp đồng, lương.',
    steps: [
      { step: 'Xem danh sách', desc: 'Danh sách giáo viên với trạng thái, lớp phụ trách.' },
      { step: 'Thêm giáo viên', desc: 'Tạo hồ sơ mới: thông tin cá nhân, chuyên môn, lương.' },
      { step: 'Chỉnh sửa', desc: 'Cập nhật thông tin, điều chỉnh hợp đồng, lương.' },
    ],
  },
  'teacher-profile': {
    title: 'Hồ sơ cá nhân (Giáo viên)',
    summary: 'Giáo viên xem và cập nhật hồ sơ cá nhân.',
    steps: [
      { step: 'Xem hồ sơ', desc: 'Xem thông tin cá nhân, lịch dạy, lương.' },
      { step: 'Cập nhật', desc: 'Cập nhật thông tin liên hệ, ảnh đại diện.' },
    ],
  },
  'teacher-calendar': {
    title: 'Lịch dạy',
    summary: 'Giáo viên xem lịch dạy cá nhân.',
    steps: [
      { step: 'Xem lịch', desc: 'Hiển thị lịch dạy theo tuần/tháng.' },
      { step: 'Xem chi tiết buổi', desc: 'Click vào buổi để xem thông tin lớp, học sinh.' },
    ],
  },
  'teacher-substitute': {
    title: 'Xin nghỉ / Thay thế',
    summary: 'Giáo viên xin nghỉ và yêu cầu giáo viên thay thế.',
    steps: [
      { step: 'Tạo yêu cầu', desc: 'Chọn buổi học cần nghỉ, lý do, đề xuất GV thay thế.' },
      { step: 'Gửi duyệt', desc: 'Gửi yêu cầu cho Giám đốc/OPS duyệt.' },
      { step: 'Phê duyệt', desc: 'Giám đốc duyệt và chỉ định GV thay thế.' },
      { step: 'Thông báo', desc: 'Hệ thống thông báo cho GV thay thế và phụ huynh.' },
    ],
  },
  'employee-performance': {
    title: 'Hiệu suất nhân viên',
    summary: 'Đánh giá hiệu suất làm việc của nhân viên.',
    steps: [
      { step: 'Xem tổng quan', desc: 'Bảng xếp hạng nhân viên theo các chỉ số hiệu suất.' },
      { step: 'Xem chi tiết', desc: 'Chi tiết từng nhân viên: KPI, chấm công, đánh giá.' },
      { step: 'Đánh giá', desc: 'Giám đốc đánh giá và phản hồi cho nhân viên.' },
    ],
  },
  invoices: {
    title: 'Quản lý Hóa đơn',
    summary: 'Quản lý hóa đơn thanh toán, theo dõi doanh thu.',
    steps: [
      { step: 'Tạo hóa đơn', desc: 'Tạo hóa đơn: chọn học sinh, gói sản phẩm, số tiền, đợt thanh toán.' },
      { step: 'Gửi duyệt', desc: 'Hóa đơn được gửi cho Giám đốc duyệt.' },
      { step: 'Duyệt hóa đơn', desc: 'Giám đốc xem xét và duyệt/từ chối hóa đơn.' },
      { step: 'Cập nhật ví', desc: 'Sau khi duyệt, hệ thống tự động cộng buổi vào ví học sinh.' },
      { step: 'Xuất hóa đơn', desc: 'Xuất hóa đơn PDF để gửi phụ huynh.' },
    ],
  },
  'parent-invoices': {
    title: 'Hóa đơn của tôi',
    summary: 'Phụ huynh xem hóa đơn thanh toán và lịch sử giao dịch.',
    steps: [
      { step: 'Xem danh sách', desc: 'Danh sách hóa đơn của phụ huynh, trạng thái thanh toán.' },
      { step: 'Xem chi tiết', desc: 'Click vào hóa đơn để xem thông tin chi tiết.' },
      { step: 'Yêu cầu nạp ví', desc: 'Gửi yêu cầu nạp tiền vào ví học sinh.' },
    ],
  },
  wallets: {
    title: 'Quản lý Ví',
    summary: 'Quản lý ví buổi học của học sinh: nạp, trừ, theo dõi số dư.',
    steps: [
      { step: 'Xem danh sách', desc: 'Danh sách ví học sinh với số dư buổi còn lại.' },
      { step: 'Nạp buổi', desc: 'Nạp buổi học vào ví sau khi hóa đơn được duyệt.' },
      { step: 'Trừ buổi', desc: 'Hệ thống tự động trừ buổi khi học sinh được điểm danh.' },
      { step: 'Lịch sử giao dịch', desc: 'Xem toàn bộ lịch sử nạp/trừ buổi.' },
    ],
  },
  payroll: {
    title: 'Lương GV (session)',
    summary: 'Tính và thanh toán lương giáo viên theo buổi dạy.',
    steps: [
      { step: 'Chọn kỳ lương', desc: 'Chọn tháng cần tính lương.' },
      { step: 'Xem bảng lương', desc: 'Danh sách giáo viên với số buổi dạy, đơn giá, tổng lương.' },
      { step: 'Kiểm tra', desc: 'Đối chiếu số buổi dạy với điểm danh thực tế.' },
      { step: 'Duyệt thanh toán', desc: 'Giám đốc duyệt bảng lương để thanh toán.' },
    ],
  },
  'work-sessions': {
    title: 'Chấm công',
    summary: 'Ghi nhận giờ làm việc của nhân viên.',
    steps: [
      { step: 'Check-in', desc: 'Nhân viên check-in khi bắt đầu ca làm.' },
      { step: 'Check-out', desc: 'Nhân viên check-out khi kết thúc ca.' },
      { step: 'Xem lịch sử', desc: 'Xem lịch sử chấm công theo ngày/tháng.' },
      { step: 'Tổng hợp', desc: 'Quản lý xem tổng hợp chấm công toàn bộ nhân viên.' },
    ],
  },
  'salary-config': {
    title: 'Cấu hình lương',
    summary: 'Thiết lập cấu hình lương cho các vai trò: lương cứng, phụ cấp, thưởng.',
    steps: [
      { step: 'Xem cấu hình', desc: 'Danh sách cấu hình lương theo vai trò, cấp bậc.' },
      { step: 'Tạo/sửa', desc: 'Thiết lập lương cơ bản, phụ cấp, hệ số.' },
      { step: 'Áp dụng', desc: 'Áp dụng cấu hình cho nhân viên cụ thể.' },
    ],
  },
  'staff-payroll': {
    title: 'Bảng lương NV',
    summary: 'Tính và quản lý bảng lương nhân viên hàng tháng.',
    steps: [
      { step: 'Chọn kỳ lương', desc: 'Chọn tháng cần tính lương.' },
      { step: 'Tính lương', desc: 'Hệ thống tự động tính: lương cơ bản + phụ cấp + thưởng - khấu trừ.' },
      { step: 'Xem bảng lương', desc: 'Xem chi tiết lương từng nhân viên.' },
      { step: 'Duyệt', desc: 'Giám đốc duyệt bảng lương toàn bộ.' },
      { step: 'Xuất file', desc: 'Xuất bảng lương ra Excel.' },
    ],
  },
  expenses: {
    title: 'Chi phí khác',
    summary: 'Ghi nhận và quản lý các chi phí hoạt động ngoài lương.',
    steps: [
      { step: 'Tạo chi phí', desc: 'Nhập loại chi phí, số tiền, ngày, mô tả, đính kèm hóa đơn.' },
      { step: 'Gửi duyệt', desc: 'Gửi yêu cầu chi cho Giám đốc duyệt.' },
      { step: 'Duyệt chi', desc: 'Giám đốc xem xét và duyệt/từ chối chi phí.' },
      { step: 'Thống kê', desc: 'Xem thống kê chi phí theo loại, theo tháng.' },
    ],
  },
  loans: {
    title: 'Vốn vay',
    summary: 'Quản lý các khoản vốn vay, lãi suất, lịch trả nợ.',
    steps: [
      { step: 'Tạo khoản vay', desc: 'Nhập thông tin: nguồn vay, số tiền, lãi suất, kỳ hạn.' },
      { step: 'Theo dõi', desc: 'Xem lịch trả nợ, số tiền đã trả, còn nợ.' },
      { step: 'Ghi nhận thanh toán', desc: 'Ghi nhận khi thanh toán gốc + lãi.' },
    ],
  },
  'financial-control': {
    title: 'Kiểm soát Tài chính',
    summary: 'Kiểm soát và đối soát tài chính tổng thể.',
    steps: [
      { step: 'Xem tổng quan', desc: 'Dashboard tài chính: doanh thu, chi phí, lợi nhuận.' },
      { step: 'Đối soát', desc: 'So sánh doanh thu hóa đơn với doanh thu thực thu.' },
      { step: 'Kiểm tra bất thường', desc: 'Phát hiện các giao dịch bất thường cần xem xét.' },
      { step: 'Báo cáo', desc: 'Xuất báo cáo kiểm soát tài chính.' },
    ],
  },
  'aging-report': {
    title: 'Công nợ phải thu',
    summary: 'Theo dõi các khoản công nợ phải thu từ phụ huynh.',
    steps: [
      { step: 'Xem danh sách', desc: 'Danh sách phụ huynh còn nợ, phân nhóm theo tuổi nợ.' },
      { step: 'Chi tiết', desc: 'Xem chi tiết từng khoản nợ: hóa đơn, số tiền, ngày đến hạn.' },
      { step: 'Nhắc nợ', desc: 'Gửi nhắc nhở thanh toán cho phụ huynh.' },
      { step: 'Cập nhật', desc: 'Ghi nhận khi phụ huynh thanh toán công nợ.' },
    ],
  },
  'bank-reconciliation': {
    title: 'Đối soát Ngân hàng',
    summary: 'Đối soát giao dịch ngân hàng với hóa đơn trong hệ thống.',
    steps: [
      { step: 'Import giao dịch', desc: 'Nhập file sao kê ngân hàng hoặc kết nối API.' },
      { step: 'Tự động matching', desc: 'Hệ thống tự động khớp giao dịch NH với hóa đơn.' },
      { step: 'Xử lý chưa khớp', desc: 'Xem xét các giao dịch chưa khớp và xử lý thủ công.' },
      { step: 'Xác nhận', desc: 'Xác nhận đối soát hoàn tất cho kỳ.' },
    ],
  },
  'attendance-report': {
    title: 'BC Điểm danh',
    summary: 'Báo cáo điểm danh tổng hợp theo lớp, giáo viên, học sinh.',
    steps: [
      { step: 'Chọn bộ lọc', desc: 'Lọc theo lớp, giáo viên, khoảng thời gian.' },
      { step: 'Xem báo cáo', desc: 'Hiển thị tỷ lệ điểm danh, danh sách vắng mặt.' },
      { step: 'Xuất báo cáo', desc: 'Xuất báo cáo điểm danh ra Excel/PDF.' },
    ],
  },
  'student-report': {
    title: 'BC Học sinh',
    summary: 'Báo cáo tổng hợp về học sinh: số lượng, tình trạng, buổi còn lại.',
    steps: [
      { step: 'Xem tổng quan', desc: 'Tổng số học sinh, phân bổ theo lớp, trạng thái.' },
      { step: 'Lọc chi tiết', desc: 'Lọc theo lớp, loại lớp, trạng thái học.' },
      { step: 'Cảnh báo', desc: 'Danh sách học sinh sắp hết buổi, cần gia hạn.' },
    ],
  },
  'comprehensive-report': {
    title: 'BC Tổng hợp',
    summary: 'Báo cáo tổng hợp toàn diện về hoạt động trung tâm.',
    steps: [
      { step: 'Chọn khoảng thời gian', desc: 'Lọc báo cáo theo tháng/quý/năm.' },
      { step: 'Xem tổng quan', desc: 'Tổng hợp: doanh thu, chi phí, lợi nhuận, số HS, số buổi dạy.' },
      { step: 'Phân tích chi tiết', desc: 'Drill-down vào từng mảng: tài chính, giảng dạy, kinh doanh.' },
      { step: 'Xuất báo cáo', desc: 'Xuất báo cáo tổng hợp ra Excel/PDF.' },
    ],
  },
  'export-reports': {
    title: 'Xuất báo cáo',
    summary: 'Xuất dữ liệu báo cáo ra file Excel, PDF.',
    steps: [
      { step: 'Chọn loại báo cáo', desc: 'Chọn báo cáo cần xuất: tài chính, điểm danh, học sinh, v.v.' },
      { step: 'Cấu hình bộ lọc', desc: 'Thiết lập khoảng thời gian, phạm vi dữ liệu.' },
      { step: 'Xuất file', desc: 'Tải về file Excel/PDF.' },
    ],
  },
  tickets: {
    title: 'Hỗ trợ & Ticket',
    summary: 'Gửi và theo dõi yêu cầu hỗ trợ.',
    steps: [
      { step: 'Tạo ticket', desc: 'Gửi yêu cầu hỗ trợ: mô tả vấn đề, mức ưu tiên.' },
      { step: 'Theo dõi', desc: 'Xem trạng thái xử lý ticket.' },
      { step: 'Phản hồi', desc: 'Trao đổi thêm thông tin với bộ phận hỗ trợ.' },
      { step: 'Đóng ticket', desc: 'Xác nhận vấn đề đã được giải quyết.' },
    ],
  },
  messages: {
    title: 'Tin nhắn',
    summary: 'Nhắn tin nội bộ giữa các nhân viên trong hệ thống.',
    steps: [
      { step: 'Xem hộp thư', desc: 'Danh sách cuộc trò chuyện, tin nhắn chưa đọc.' },
      { step: 'Gửi tin nhắn', desc: 'Gửi tin nhắn cho nhân viên/giáo viên khác.' },
      { step: 'Đọc & trả lời', desc: 'Đọc và trả lời tin nhắn.' },
    ],
  },
  'audit-log': {
    title: 'Nhật ký hoạt động',
    summary: 'Giám đốc xem lịch sử hoạt động trên hệ thống.',
    steps: [
      { step: 'Xem danh sách', desc: 'Danh sách hành động: ai, làm gì, lúc nào.' },
      { step: 'Lọc', desc: 'Lọc theo người dùng, loại hành động, thời gian.' },
      { step: 'Xem chi tiết', desc: 'Xem chi tiết thay đổi: giá trị cũ → mới.' },
    ],
  },
  'landing-pages': {
    title: 'Landing Pages',
    summary: 'Tạo và quản lý landing page thu thập thông tin khách hàng tiềm năng.',
    steps: [
      { step: 'Tạo Landing Page', desc: 'Tạo trang đích: tiêu đề, mô tả, form thu thập thông tin, liên kết nhóm QC.' },
      { step: 'Xuất bản', desc: 'Kích hoạt landing page để nhận submissions từ khách hàng.' },
      { step: 'Xem Submissions', desc: 'Danh sách khách hàng đã điền form, thông tin liên hệ.' },
      { step: 'Chuyển Lead', desc: 'Chuyển submissions thành Lead để theo dõi tư vấn.' },
    ],
  },
};

@Component({
  selector: 'app-flow-guide',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="flow-guide" *ngIf="flowInfo" data-testid="flow-guide">
      <button class="flow-toggle" type="button" data-testid="flow-guide-toggle" (click)="expanded = !expanded" [class.active]="expanded">
        &#9432; Mô tả luồng
        <span class="arrow">{{ expanded ? '&#9650;' : '&#9660;' }}</span>
      </button>
      <div class="flow-content" *ngIf="expanded" data-testid="flow-guide-content">
        <h3 class="flow-title" data-testid="flow-guide-title">{{ flowInfo.title }}</h3>
        <p class="flow-summary" data-testid="flow-guide-summary">{{ flowInfo.summary }}</p>
        <ol class="flow-steps" data-testid="flow-guide-steps">
          <li *ngFor="let s of flowInfo.steps" data-testid="flow-guide-step">
            <strong>{{ s.step }}:</strong> {{ s.desc }}
          </li>
        </ol>
      </div>
    </div>
  `,
  styles: [`
    .flow-guide { margin-bottom: 16px; }
    .flow-toggle {
      display: inline-flex; align-items: center; gap: 8px;
      padding: 6px 14px; border: 1px solid #cbd5e1; border-radius: 6px;
      background: #f8fafc; color: #334155; font-size: 13px; font-weight: 600;
      cursor: pointer; transition: all 0.15s;
    }
    .flow-toggle:hover { background: #e2e8f0; border-color: #94a3b8; }
    .flow-toggle.active { background: #eff6ff; border-color: #3b82f6; color: #1d4ed8; }
    .arrow { font-size: 10px; opacity: 0.7; }
    .flow-content {
      margin-top: 8px; padding: 16px; background: #f0f9ff;
      border: 1px solid #bae6fd; border-radius: 8px;
    }
    .flow-title {
      margin: 0 0 10px;
      color: #0f172a;
      font-size: 16px;
      font-weight: 700;
    }
    .flow-summary { margin: 0 0 12px; color: #0369a1; font-size: 14px; font-weight: 500; }
    .flow-steps {
      margin: 0; padding-left: 20px;
      display: flex; flex-direction: column; gap: 6px;
    }
    .flow-steps li { font-size: 13px; color: #334155; line-height: 1.5; }
    .flow-steps li strong { color: #0369a1; }
  `],
})
export class FlowGuideComponent {
  @Input() featureKey = '';
  expanded = false;

  get flowInfo(): FlowInfo | null {
    return FLOW_DATA[this.featureKey] || null;
  }
}
