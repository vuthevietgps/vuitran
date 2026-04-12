export const TEACHER_VIDEO_COPY = {
  workflowSteps: [
    'Đăng nhập',
    'Dashboard',
    'Lịch dạy',
    'Tài liệu',
    'Attendance',
    'Hoàn thành buổi',
    'Teaching report',
    'Payroll',
    'Xin nghỉ hoặc dạy thay',
    'Đăng xuất',
  ],

  introNarration:
    'Xin chào. Đây là video giáo viên được dựng lại từ đầu. Video sẽ bắt đầu bằng sơ đồ luồng tổng thể, sau đó đi lần lượt qua từng màn hình và từng thao tác chính, kèm thuyết trình bằng tiếng Việt.',
  introTitle: 'Video walkthrough giáo viên',
  introDescription:
    'Mục tiêu của video này là giúp người xem hiểu cả logic nghiệp vụ lẫn thao tác thực tế trên giao diện giáo viên.',
  introBullets: [
    'Phần 1: nhìn sơ đồ luồng tổng thể của một ngày làm việc giáo viên.',
    'Phần 2: mở từng màn hình, chỉ rõ từng thao tác quan trọng trên UI.',
    'Phần 3: kết lại bằng checklist nghiệp vụ để dùng cho onboarding và nghiệm thu.',
  ],

  roadmapNarration:
    'Luồng chuẩn của giáo viên đi từ đăng nhập, đọc dashboard và lịch dạy, sang chuẩn bị tài liệu và attendance, rồi hoàn thành session, nộp teaching report, kiểm tra payroll, xử lý phát sinh xin nghỉ hoặc dạy thay và cuối cùng là đăng xuất.',
  roadmapTitle: 'Sơ đồ luồng làm việc của giáo viên',
  roadmapDescription:
    'Đây là flow chuẩn theo thứ tự nghiệp vụ. Khi xem video, chúng ta sẽ đi đúng từng chặng trên sơ đồ này rồi mới thao tác chi tiết trên từng màn hình.',

  dashboardSceneNarration:
    'Chặng đầu tiên là chuẩn bị đầu ngày. Giáo viên đăng nhập và đọc dashboard để biết hôm nay có gì cần ưu tiên trước giờ lên lớp.',
  dashboardSceneTitle: 'Chặng 1. Đăng nhập và đọc dashboard',
  dashboardSceneDescription:
    'Mục tiêu là vào đúng workspace giáo viên và lấy cái nhìn tổng quan về lịch dạy, thu nhập và việc cần xử lý.',
  dashboardSceneBullets: [
    'Đăng nhập bằng tài khoản giáo viên.',
    'Đọc nhanh khối cẩm nang, thẻ thu nhập và lịch dạy sắp tới.',
    'Xác định buổi học gần nhất cần chuẩn bị.',
  ],
  dashboardNarration:
    'Bây giờ chúng ta vào dashboard. Ở màn này, giáo viên kiểm tra cẩm nang nội bộ, tổng thu nhập đang tích lũy và bảng lịch dạy sắp tới để biết ca gần nhất và việc nào cần làm trước.',
  dashboardLabel:
    'Chặng 1. Đăng nhập thành công và đọc dashboard để nắm cẩm nang nội bộ, thu nhập hiện tại và lịch dạy sắp tới.',
  dashboardHandbookCallout:
    'Khối cẩm nang ở đầu trang là điểm vào nhanh cho hướng dẫn, checklist vận hành và tài liệu onboarding của giáo viên.',
  dashboardIncomeCallout:
    'Thẻ tổng thu nhập cho biết phần đã ghi nhận và phần còn chờ thanh toán trong các kỳ lương.',
  dashboardUpcomingCallout:
    'Bảng lịch dạy sắp tới giúp giáo viên rà ngay buổi gần nhất trước khi chuyển sang bước chuẩn bị.',

  calendarSceneNarration:
    'Sau dashboard, giáo viên cần mở lịch dạy để xác nhận đúng buổi, đúng lớp, đúng học sinh và đúng trạng thái trước khi chuẩn bị nội dung.',
  calendarSceneTitle: 'Chặng 2. Kiểm tra lịch dạy',
  calendarSceneDescription:
    'Mục tiêu là rà lại buổi học cụ thể trong tuần để tránh nhầm ca hoặc bỏ sót session đang chờ xử lý.',
  calendarSceneBullets: [
    'Mở lịch dạy ở chế độ tuần.',
    'Chọn một session cụ thể trong tuần hiện tại.',
    'Đọc phần chi tiết mở rộng của session.',
  ],
  calendarNarration:
    'Tại màn lịch dạy, mỗi thẻ session cho biết giờ học, lớp, học sinh và trạng thái. Giáo viên nên mở rộng đúng buổi sắp dạy để xác nhận thông tin trước khi sang bước chuẩn bị tài liệu.',
  calendarLabel: 'Chặng 2. Mở lịch dạy và xem nhanh chi tiết một buổi học trong tuần.',
  calendarEventCallout:
    'Mỗi thẻ buổi học hiển thị giờ dạy, lớp, học sinh và trạng thái hiện tại của session.',
  calendarDetailCallout:
    'Phần mở rộng cho biết thêm thời lượng, loại buổi, trạng thái báo cáo và nội dung đã dạy nếu session đã có dữ liệu.',

  materialsSceneNarration:
    'Khi đã xác nhận đúng buổi học, giáo viên sang phần tài liệu để lấy đúng giáo án hoặc học liệu phục vụ cho buổi sắp dạy.',
  materialsSceneTitle: 'Chặng 3. Tìm tài liệu giảng dạy',
  materialsSceneDescription:
    'Mục tiêu là tìm nhanh đúng giáo án theo tên bài hoặc chủ đề, thay vì dò thủ công toàn bộ danh sách.',
  materialsSceneBullets: [
    'Mở màn hình tài liệu giảng dạy.',
    'Gõ từ khóa của bài học.',
    'Kiểm tra kết quả lọc và xác nhận đúng material card.',
  ],
  materialsNarration:
    'Ở màn materials, giáo viên chỉ cần nhập từ khóa bài học. Hệ thống sẽ lọc lại danh sách để giáo viên mở đúng tài liệu cần dùng cho buổi sắp tới.',
  materialsLabel: 'Chặng 3. Tìm tài liệu giảng dạy theo từ khóa để chuẩn bị đúng giáo án.',
  materialsSearchCallout:
    'Ô tìm kiếm giúp lọc nhanh theo tên bài, chủ đề hoặc mô tả thay vì lật toàn bộ danh sách.',
  materialsCardCallout:
    'Khi kết quả đã lọc đúng, giáo viên chỉ cần mở đúng material card tương ứng với buổi học cần chuẩn bị.',

  attendanceSceneNarration:
    'Trước giờ vào lớp, giáo viên cần chuẩn bị attendance. Luồng chuẩn là chọn đúng lớp, đúng ngày, tải roster rồi tạo link điểm danh cho học sinh.',
  attendanceSceneTitle: 'Chặng 4. Chuẩn bị attendance',
  attendanceSceneDescription:
    'Mục tiêu là sinh đúng attendance link cho đúng lớp và đúng ngày, để tránh gửi sai cho học sinh.',
  attendanceSceneBullets: [
    'Chọn đúng lớp và đúng ngày học.',
    'Tải danh sách attendance thực tế của lớp.',
    'Tạo link điểm danh và xác nhận link đã được copy.',
  ],
  attendanceNarration:
    'Tại đây giáo viên chọn lớp, chọn ngày rồi tải danh sách attendance. Sau khi kiểm tra đúng roster, giáo viên bấm tạo link để hệ thống sinh URL điểm danh và tự copy vào clipboard.',
  attendanceLabel: 'Chặng 4. Chọn lớp, tải attendance và tạo link điểm danh cho học sinh.',
  attendanceLoadCallout:
    'Luôn chọn đúng lớp và đúng ngày trước khi tạo link, vì attendance URL gắn trực tiếp với bộ lọc này.',
  attendanceStudentCallout:
    'Sau khi tải xong, giáo viên nhìn thấy roster thực tế của lớp để kiểm tra trước khi gửi link.',
  attendanceLinkCallout:
    'Nút tạo link sẽ sinh attendance URL và tự copy vào clipboard để giáo viên gửi nhanh cho học sinh.',

  sessionSceneNarration:
    'Sau khi dạy xong, giáo viên phải hoàn thành session để ghi lại nội dung đã dạy, bài tập về nhà và ghi chú nội bộ.',
  sessionSceneTitle: 'Chặng 5. Hoàn thành buổi học',
  sessionSceneDescription:
    'Mục tiêu là chốt buổi học ở mức giáo viên, trước khi nộp teaching report chính thức.',
  sessionSceneBullets: [
    'Mở danh sách sessions và rà đúng session đang ở trạng thái đã lên lịch.',
    'Xem lại chi tiết lớp và học sinh.',
    'Điền form hoàn thành buổi học rồi gửi lưu.',
  ],
  sessionCompleteNarration:
    'Ở màn sessions, giáo viên chọn đúng session đang ở trạng thái đã lên lịch, mở chi tiết để kiểm tra lại lớp và học sinh, sau đó điền form tổng kết buổi học và xác nhận hoàn thành.',
  sessionCompleteLabel:
    'Chặng 5. Mở session đã lên lịch, xem chi tiết rồi hoàn thành buổi học bằng form tổng kết.',
  sessionRowCallout:
    'Hàng session là nơi giáo viên kiểm tra nhanh trạng thái buổi hiện tại trước khi thao tác.',
  sessionDetailCallout:
    'Modal chi tiết giúp rà lại đúng lớp và học sinh trước khi chốt phần tổng kết buổi dạy.',
  sessionCompleteFormCallout:
    'Form hoàn thành buổi học lưu nội dung đã dạy, bài tập về nhà và ghi chú để dữ liệu vận hành phía sau không bị thiếu.',
  sessionCompletedCallout:
    'Khi session chuyển sang trạng thái giáo viên hoàn thành, buổi học đã sẵn sàng cho bước nộp teaching report.',

  teachingReportSceneNarration:
    'Khi session đã được giáo viên hoàn thành, bước tiếp theo là nộp teaching report chính thức để session đủ điều kiện đi tiếp sang payroll.',
  teachingReportSceneTitle: 'Chặng 6. Nộp teaching report',
  teachingReportSceneDescription:
    'Mục tiêu là chọn đúng template báo cáo, điền đủ rating và nhận xét rồi xác nhận session đã chuyển sang tab có báo cáo.',
  teachingReportSceneBullets: [
    'Mở tab chưa có báo cáo.',
    'Chọn template phù hợp với session.',
    'Điền form, gửi báo cáo và kiểm tra lại ở tab đã có báo cáo.',
  ],
  teachingReportNarration:
    'Ở màn báo cáo giảng dạy, giáo viên xử lý các session còn thiếu report. Sau khi chọn đúng template, giáo viên điền đánh giá và nhận xét rồi nộp báo cáo để session chuyển sang danh sách đã có báo cáo.',
  teachingReportLabel:
    'Chặng 6. Mở teaching report, chọn template, điền đánh giá và nộp báo cáo giảng dạy.',
  teachingReportPendingCallout:
    'Tab chưa có báo cáo là nơi giáo viên xử lý các buổi còn thiếu report trước khi đến kỳ tính lương.',
  teachingReportTemplateCallout:
    'Chọn đúng template sẽ giúp form hiển thị đúng các trường cần điền cho loại buổi học đang xử lý.',
  teachingReportFormCallout:
    'Điền rating và nhận xét đủ rõ để vận hành hoặc người duyệt đọc lại vẫn hiểu chất lượng buổi học.',
  teachingReportCompletedCallout:
    'Sau khi nộp thành công, session sẽ xuất hiện ở tab đã có báo cáo cùng toàn bộ nội dung vừa gửi.',

  payrollSceneNarration:
    'Sau phần dạy học và báo cáo, giáo viên thường kiểm tra payroll preview để biết session nào đã tính lương, session nào còn chờ xác nhận hoặc đang thiếu điều kiện.',
  payrollSceneTitle: 'Chặng 7. Kiểm tra payroll preview',
  payrollSceneDescription:
    'Mục tiêu là rà kỳ lương hiện tại và đọc các nhóm trạng thái quan trọng trong phần tổng hợp.',
  payrollSceneBullets: [
    'Chọn đúng khoảng thời gian của kỳ lương.',
    'Mở preview thu nhập.',
    'Đọc phần đã thanh toán, chờ OPS xác nhận và thiếu báo cáo.',
  ],
  payrollNarration:
    'Ở màn payroll, giáo viên chọn kỳ lương cần xem rồi đọc khối tổng hợp. Đây là nơi giúp phát hiện nhanh session nào đã được tính lương và session nào còn bị giữ lại vì thiếu báo cáo hoặc thiếu xác nhận.',
  payrollLabel:
    'Chặng 7. Chọn kỳ lương hiện tại và xem preview thu nhập của giáo viên theo trạng thái xử lý.',
  payrollFilterCallout:
    'Bộ lọc kỳ lương giúp giáo viên thu hẹp đúng khoảng thời gian muốn kiểm tra thay vì đọc cả lịch sử.',
  payrollSummaryCallout:
    'Khối tổng hợp cho biết ngay phần đã thanh toán, phần chờ OPS xác nhận và phần chưa đủ điều kiện tính lương.',

  substituteSceneNarration:
    'Nếu có phát sinh không thể dạy, giáo viên phải tạo yêu cầu chính thức để OPS tiếp nhận và điều phối thay thế. Đây là bước cần làm càng sớm càng tốt.',
  substituteSceneTitle: 'Chặng 8. Tạo yêu cầu xin nghỉ hoặc dạy thay',
  substituteSceneDescription:
    'Mục tiêu là ghi nhận rõ lớp, thời gian và lý do phát sinh để OPS có căn cứ xử lý.',
  substituteSceneBullets: [
    'Mở form tạo yêu cầu mới.',
    'Chọn đúng lớp, ngày bắt đầu và ngày kết thúc.',
    'Điền lý do, gửi yêu cầu và kiểm tra lại trên danh sách.',
  ],
  substituteNarration:
    'Tại màn xin nghỉ hoặc thay thế, giáo viên tạo yêu cầu chính thức với đầy đủ lớp, thời gian và lý do. Sau khi lưu thành công, request mới sẽ xuất hiện trong danh sách để tiếp tục theo dõi trạng thái xử lý.',
  substituteLabel:
    'Chặng 8. Tạo yêu cầu giáo viên dạy thay hoặc xin nghỉ khi có phát sinh đột xuất.',
  substituteCreateCallout:
    'Nút tạo yêu cầu mở form chính thức để giáo viên khai báo đúng lớp, thời gian và lý do phát sinh.',
  substituteModalCallout:
    'Form này là căn cứ để OPS điều phối. Vì vậy lớp, thời gian và lý do cần ghi rõ và đủ cụ thể.',
  substituteSuccessCallout:
    'Khi yêu cầu đã lưu, request mới sẽ xuất hiện trên danh sách để giáo viên theo dõi lại trạng thái xử lý.',

  logoutSceneNarration:
    'Chặng cuối cùng là đăng xuất để kết thúc phiên làm việc sau khi đã kiểm tra xong toàn bộ luồng đứng lớp và hậu kiểm.',
  logoutSceneTitle: 'Chặng 9. Đăng xuất',
  logoutSceneDescription:
    'Mục tiêu là đóng phiên làm việc an toàn và quay lại màn hình đăng nhập.',
  logoutSceneBullets: [
    'Bấm đăng xuất ở sidebar.',
    'Kiểm tra hệ thống quay về login.',
    'Kết thúc trọn chuỗi thao tác của role giáo viên.',
  ],
  logoutNarration:
    'Cuối cùng, giáo viên đăng xuất ở sidebar để kết thúc phiên làm việc. Khi hệ thống quay về màn hình login, chuỗi thao tác của role giáo viên được xem là hoàn tất.',
  logoutLabel: 'Chặng 9. Đăng xuất sau khi hoàn tất toàn bộ các luồng chính của giáo viên.',
  logoutCallout:
    'Đăng xuất để kết thúc phiên làm việc và tránh nhầm vai trò khi chuyển sang tài khoản khác để kiểm tra.',

  outroNarration:
    'Như vậy chúng ta vừa đi qua toàn bộ flow chuẩn của giáo viên, từ chuẩn bị trước giờ dạy, thao tác trong và sau buổi học, cho đến phần hậu kiểm payroll và xử lý phát sinh xin nghỉ hoặc dạy thay.',
  outroTitle: 'Hoàn tất walkthrough giáo viên',
  outroDescription:
    'Video đã được dựng theo format mới: nhìn luồng tổng thể trước, rồi đi từng màn hình và từng thao tác với thuyết trình song song.',
  outroBullets: [
    'Có sơ đồ luồng tổng thể để người xem hiểu nghiệp vụ trước khi nhìn UI.',
    'Có phần thuyết trình trước mỗi chặng rồi mới mở màn hình thao tác.',
    'Có thể dùng lại cho onboarding, demo nội bộ và nghiệm thu role giáo viên.',
  ],
} as const;
