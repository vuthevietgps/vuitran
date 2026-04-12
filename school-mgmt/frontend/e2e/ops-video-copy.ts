export const OPS_VIDEO_COPY = {
  ticketCommentValue: 'Đã tiếp nhận và điều phối',

  workflowSteps: [
    'Dashboard',
    'Classes',
    'Sessions',
    'Attendance',
    'Tickets',
    'Điều phối GV',
    'Đóng ticket',
    'Đăng xuất',
  ],

  introNarration:
    'Xin chào. Đây là video walkthrough đầy đủ cho vai trò vận hành. Video sẽ bắt đầu bằng sơ đồ luồng tổng thể, sau đó đi lần lượt qua từng nhóm công việc chính của OPS với chú thích tiếng Việt, callout vùng thao tác và hành động thật trên giao diện.',
  introTitle: 'Video Walkthrough Vận Hành',
  introDescription:
    'Video mô phỏng các công việc lõi mà nhân viên OPS dùng hằng ngày để giữ lớp, lịch, attendance và ticket chạy đúng.',
  introBullets: [
    'Xem dashboard để chốt việc ưu tiên đầu ca.',
    'Vào classes, sessions và attendance để giữ dữ liệu vận hành đúng nguồn.',
    'Xử lý ticket, điều phối giáo viên thay thế và khép vòng xử lý phát sinh.',
  ],

  roadmapNarration:
    'Luồng chuẩn của OPS bắt đầu từ dashboard để đọc ưu tiên trong ngày, sau đó đi sang classes để kiểm tra roster và giáo viên phụ trách, tiếp tục sang sessions để tạo lịch và chốt buổi, sang attendance để xác nhận trạng thái học viên, rồi xử lý ticket phát sinh, điều phối giáo viên thay thế, quay lại đóng ticket và cuối cùng là đăng xuất.',
  roadmapTitle: 'Sơ đồ luồng công việc của OPS',
  roadmapDescription:
    'OPS là vai trò giữ cho lớp học chạy đúng lịch, đúng người và đúng trạng thái. Mỗi chặng dưới đây tương ứng với một nhóm thao tác cần đi theo đúng thứ tự.',

  dashboardSceneNarration:
    'Chặng đầu tiên là mở đầu ca làm việc. OPS vào dashboard để biết ngay việc nào quá hạn, lớp nào đang hoạt động và mục nào cần xử lý trước khi đi vào từng màn hình chi tiết.',
  dashboardSceneTitle: 'Chặng 1. Đọc dashboard đầu ngày',
  dashboardSceneDescription:
    'Mục tiêu là xác định đúng thứ tự ưu tiên trong ngày và không bỏ sót ticket hoặc request đang chờ xử lý.',
  dashboardSceneBullets: [
    'Đăng nhập đúng vai OPS.',
    'Đọc thẻ cảnh báo và số lớp đang vận hành.',
    'Xác định các mục cần xử lý ngay trong ca.',
  ],

  dashboardNarration:
    'Ở dashboard vận hành, OPS đọc ba nhóm thông tin. Nhóm thứ nhất là cảnh báo việc quá hạn hoặc cần xử lý sớm. Nhóm thứ hai là số lớp đang vận hành để ước lượng tải trong ngày. Nhóm thứ ba là các mục chờ duyệt hoặc cần phối hợp để không bỏ sót đầu việc.',
  dashboardLabel:
    'Chặng 1. Vào dashboard để đọc việc ưu tiên, số lớp đang chạy và các mục cần phối hợp trong ngày.',
  dashboardOverdueCallout:
    'Thẻ màu cam nhắc OPS có việc cần xử lý sớm trước khi ảnh hưởng lịch học hoặc ticket.',
  dashboardActiveClassCallout:
    'Thẻ này cho biết số lớp đang vận hành, giúp OPS nhìn nhanh tải lớp trong ca.',
  dashboardPendingApprovalCallout:
    'Khu vực điều hướng cũng báo các mục chờ duyệt để OPS không bỏ sót request liên quan tới vận hành.',

  classesSceneNarration:
    'Sau khi biết ưu tiên đầu ngày, OPS quay về nguồn dữ liệu lớp học. Đây là nơi kiểm tra roster thật, học sinh thật và giáo viên phụ trách thật trước khi đi tiếp sang lịch học hay attendance.',
  classesSceneTitle: 'Chặng 2. Kiểm tra lớp và roster',
  classesSceneDescription:
    'Mục tiêu là đảm bảo lớp đang chứa đúng học sinh và gắn đúng giáo viên phụ trách ngay tại màn hình nguồn.',
  classesSceneBullets: [
    'Mở đúng lớp cần xử lý.',
    'Kiểm tra cột học viên có thể thêm vào lớp.',
    'Lưu thay đổi và đọc lại dữ liệu ngay trên bảng lớp.',
  ],

  classesNarration:
    'Ở module classes, OPS mở đúng lớp cần chỉnh, kiểm tra roster hiện tại, thêm học viên còn thiếu và chỉ sửa ngay tại màn hình lớp nguồn. Cách làm này giúp sessions, attendance và các màn hình downstream dùng chung một dữ liệu lớp đã được chuẩn hóa.',
  classesLabel:
    'Chặng 2. Mở lớp học, kiểm tra roster và cập nhật học viên ngay tại màn hình nguồn.',
  classesRowCallout:
    'OPS mở đúng lớp cần chỉnh để cập nhật roster và giáo viên phụ trách ngay từ nguồn dữ liệu lớp.',
  classesAvailableStudentCallout:
    'Cột này chứa học viên có thể thêm vào lớp; OPS cần đưa đúng học viên vào roster để lịch và attendance chạy khớp.',
  classesUpdatedRowCallout:
    'Sau khi lưu, bảng lớp phản ánh roster mới ngay trên danh sách tổng.',

  sessionsCreateSceneNarration:
    'Khi lớp đã đúng dữ liệu, OPS sang sessions để tạo lịch học. Đây là chặng bảo đảm lớp có đủ buổi sắp tới trước khi giáo viên vào ca dạy.',
  sessionsCreateSceneTitle: 'Chặng 3. Tạo lịch học hàng loạt',
  sessionsCreateSceneDescription:
    'Mục tiêu là sinh nhanh các buổi mới theo lớp, ngày và khung giờ chuẩn thay vì tạo từng buổi riêng lẻ.',
  sessionsCreateSceneBullets: [
    'Mở màn sessions và vào chế độ bulk create.',
    'Chọn đúng lớp, ngày và khung giờ.',
    'Kiểm tra danh sách buổi mới phát sinh sau khi lưu.',
  ],

  sessionsCreateNarration:
    'Ở màn sessions, OPS dùng chế độ bulk create để sinh hàng loạt buổi học cho đúng lớp, đúng ngày và đúng khung giờ. Sau khi tạo xong, danh sách sessions phải tăng thêm để chứng minh lịch mới đã được ghi nhận.',
  sessionsCreateLabel:
    'Chặng 3. Tạo lịch học hàng loạt cho lớp trên màn sessions.',
  sessionsCreateModalCallout:
    'Ở chế độ bulk create, OPS chọn lớp, ngày và khung giờ để sinh lịch học đồng loạt.',
  sessionsCreateRowCallout:
    'Danh sách sessions tăng thêm sau khi lưu, xác nhận các buổi mới đã được tạo thành công.',

  sessionsFinalizeSceneNarration:
    'Không chỉ tạo lịch, OPS còn là người chốt các buổi đã hoàn thành. Chặng này ảnh hưởng trực tiếp đến downstream như payroll và đối soát nên phải làm cẩn thận.',
  sessionsFinalizeSceneTitle: 'Chặng 4. Chốt buổi học đã hoàn thành',
  sessionsFinalizeSceneDescription:
    'Mục tiêu là lọc đúng các buổi đủ điều kiện chốt, mở chi tiết và chuyển trạng thái buổi sang finalized.',
  sessionsFinalizeSceneBullets: [
    'Lọc đúng trạng thái chờ chốt.',
    'Mở chi tiết buổi đã đủ attendance và teaching report.',
    'Chuyển buổi sang finalized và kiểm tra lại trên bảng.',
  ],

  sessionsFinalizeNarration:
    'Với các buổi giáo viên đã dạy xong và đã có báo cáo, OPS là người chốt buổi để khóa trạng thái vận hành. Sau khi xác nhận, buổi học phải chuyển sang finalized để downstream có thể dùng đúng dữ liệu đã chốt.',
  sessionsFinalizeLabel:
    'Chặng 4. Lọc buổi đủ điều kiện và chốt buổi học hoàn tất.',
  sessionsFinalizeFilterCallout:
    'Bộ lọc trạng thái giúp OPS tìm riêng các buổi đang chờ chốt.',
  sessionsFinalizeButtonCallout:
    'Khi attendance và teaching report đã đủ, OPS chốt buổi tại đây để khóa nghiệp vụ vận hành.',
  sessionsFinalizeRowCallout:
    'Buổi học đã chuyển sang finalized và sẵn sàng cho các bước downstream.',

  attendanceSceneNarration:
    'Sau phần sessions là attendance. Đây là chặng kiểm soát dữ liệu có mặt, vắng mặt hay đi muộn của học viên trong ngày.',
  attendanceSceneTitle: 'Chặng 5. Điểm danh học viên',
  attendanceSceneDescription:
    'Mục tiêu là tải đúng lớp, đúng ngày, đánh dấu trạng thái học viên và lưu lại để số liệu cuối ngày không bị lệch.',
  attendanceSceneBullets: [
    'Chọn lớp và ngày cần điểm danh.',
    'Tải danh sách học viên thực tế.',
    'Lưu attendance và đọc lại phần tổng hợp sau khi save.',
  ],

  attendanceNarration:
    'Ở attendance, OPS phải chọn đúng lớp và đúng ngày trước khi tải danh sách học viên. Sau khi danh sách hiển thị đủ, OPS đánh dấu trạng thái có mặt hoặc dùng thao tác đánh dấu nhanh, rồi lưu lại để summary phản ánh đúng dữ liệu attendance của lớp.',
  attendanceLabel:
    'Chặng 5. Tải danh sách điểm danh và ghi nhận trạng thái học viên trong ngày.',
  attendanceLoadCallout:
    'OPS luôn nạp đúng lớp và đúng ngày trước khi điểm danh hoặc kiểm tra attendance.',
  attendanceCardsCallout:
    'Danh sách học viên hiển thị ra theo lớp đã chọn; đây là nơi OPS rà roster thực tế trước khi lưu.',
  attendanceSummaryCallout:
    'Sau khi lưu, phần tổng hợp cho thấy toàn bộ học viên đã được ghi nhận trạng thái.',

  ticketIntakeSceneNarration:
    'Khi có phát sinh từ giáo viên hoặc phụ huynh, ticket là nơi OPS tiếp nhận và lưu dấu vết phối hợp. Chặng này chưa đóng vấn đề, mà mới ghi nhận và điều phối bước đầu.',
  ticketIntakeSceneTitle: 'Chặng 6. Tiếp nhận ticket phát sinh',
  ticketIntakeSceneDescription:
    'Mục tiêu là mở đúng ticket, đọc bối cảnh gốc và để lại comment điều phối để các bên liên quan nhìn cùng một lịch sử xử lý.',
  ticketIntakeSceneBullets: [
    'Mở danh sách ticket tổng.',
    'Chọn đúng ticket phát sinh cần xử lý.',
    'Ghi comment xác nhận đã tiếp nhận và đang điều phối.',
  ],

  ticketIntakeNarration:
    'Trong ticket, OPS mở đúng case phát sinh, đọc mô tả gốc rồi để lại comment điều phối. Comment này giúp toàn bộ lịch sử tiếp nhận và phối hợp được gom về một nơi, thay vì xử lý rời rạc ngoài luồng.',
  ticketIntakeLabel:
    'Chặng 6. Mở ticket phát sinh và ghi nhận comment điều phối ban đầu.',
  ticketIntakeCardCallout:
    'Ticket này phát sinh do giáo viên xin nghỉ đột xuất và đang chờ OPS điều phối.',
  ticketIntakeReplyCallout:
    'OPS thêm comment để cập nhật hướng xử lý và giữ lịch sử phối hợp ngay trong ticket.',

  teacherSwapSceneNarration:
    'Sau khi đã tiếp nhận ticket, OPS phải xử lý tại nguồn. Với tình huống giáo viên nghỉ đột xuất, nguồn dữ liệu cần chỉnh là màn classes chứ không phải chỉ để lại comment.',
  teacherSwapSceneTitle: 'Chặng 7. Điều phối giáo viên thay thế',
  teacherSwapSceneDescription:
    'Mục tiêu là cập nhật giáo viên thay thế trực tiếp trên lớp để các buổi sau dùng đúng người dạy.',
  teacherSwapSceneBullets: [
    'Quay lại đúng lớp đang phát sinh.',
    'Chọn giáo viên thay thế trong form lớp.',
    'Lưu thay đổi và kiểm tra bảng lớp đã phản ánh người dạy mới.',
  ],

  teacherSwapNarration:
    'Sau khi tiếp nhận ticket, OPS quay lại lớp liên quan để đổi giáo viên phụ trách. Việc này phải thực hiện ngay trên lớp nguồn để tất cả lịch và các buổi sau dùng đúng giáo viên thay thế đã được điều phối.',
  teacherSwapLabel:
    'Chặng 7. Đổi giáo viên phụ trách cho lớp đang có phát sinh.',
  teacherSwapSelectCallout:
    'OPS chọn giáo viên dạy thay trực tiếp trong form lớp để dữ liệu vận hành được đồng bộ.',
  teacherSwapRowCallout:
    'Bảng lớp đã phản ánh giáo viên thay thế mới, hoàn tất bước điều phối ở nguồn.',

  ticketResolveSceneNarration:
    'Sau khi điều phối xong ở nguồn, OPS quay lại ticket để khép vòng xử lý. Ticket chỉ nên đóng khi đã có kết quả thực tế và có tóm tắt rõ ràng.',
  ticketResolveSceneTitle: 'Chặng 8. Đóng ticket sau khi xử lý xong',
  ticketResolveSceneDescription:
    'Mục tiêu là ghi lại kết quả cuối cùng, chuyển ticket sang resolved và để lại điểm kết thúc rõ ràng cho case phát sinh.',
  ticketResolveSceneBullets: [
    'Mở lại ticket vừa xử lý.',
    'Nhập tóm tắt kết quả cuối cùng.',
    'Xác nhận đóng ticket và đọc lại trạng thái resolved.',
  ],

  ticketResolveNarration:
    'Khi việc điều phối đã xong, OPS quay lại ticket để nhập tóm tắt xử lý và xác nhận đóng case. Lúc này ticket phải chuyển sang resolved để toàn bộ vòng tiếp nhận, điều phối và xác nhận xử lý được khép kín.',
  ticketResolveLabel:
    'Chặng 8. Quay lại ticket và xác nhận đã xử lý xong.',
  ticketResolveModalCallout:
    'Modal này lưu tóm tắt và kết quả cuối cùng để ticket có điểm kết thúc rõ ràng.',
  ticketResolveSummary:
    'Đã tiếp nhận ticket và điều phối giáo viên dạy thay thành công.',
  ticketResolveHeaderCallout:
    'Ticket đã chuyển sang resolved, hoàn tất vòng tiếp nhận, điều phối và xác nhận xử lý.',

  logoutSceneNarration:
    'Chặng cuối cùng là đăng xuất để đóng phiên làm việc. Đây là bước dừng đúng sau khi OPS đã đi qua dashboard, lớp, sessions, attendance và ticket.',
  logoutSceneTitle: 'Chặng 9. Đăng xuất kết thúc ca',
  logoutSceneDescription:
    'Mục tiêu là kết thúc đúng phiên thao tác và đưa hệ thống quay lại màn hình đăng nhập.',
  logoutSceneBullets: [
    'Kiểm tra đã hoàn tất các nhóm việc chính.',
    'Đăng xuất khỏi hệ thống.',
    'Xác nhận màn hình login xuất hiện trở lại.',
  ],

  logoutNarration:
    'Bước cuối cùng là đăng xuất. Khi hệ thống quay về màn hình login, chuỗi thao tác chính của role vận hành được xem là hoàn tất.',
  logoutLabel:
    'Chặng 9. Đăng xuất sau khi hoàn tất toàn bộ các luồng chính của vận hành.',
  logoutCallout:
    'Đăng xuất để kết thúc phiên làm việc và tránh nhầm vai trò khi chuyển sang kiểm tra account khác.',

  outroNarration:
    'Như vậy toàn bộ các luồng chính của vận hành đã được mô phỏng xong. Video này có thể dùng để đào tạo thao tác, onboarding nhân sự mới hoặc nghiệm thu giao diện role OPS theo đúng nghiệp vụ.',
  outroTitle: 'Hoàn tất walkthrough Vận Hành',
  outroDescription:
    'Video đã mô phỏng trọn chuỗi công việc lõi của OPS với dữ liệu thay đổi trạng thái thật ngay trên giao diện.',
  outroBullets: [
    'Dashboard và classes: đọc ưu tiên, kiểm tra roster và xử lý đúng màn nguồn.',
    'Sessions và attendance: tạo lịch, chốt buổi và lưu điểm danh đúng ngày.',
    'Tickets: tiếp nhận, điều phối, xác nhận kết quả và khép vòng xử lý phát sinh.',
  ],
} as const;
