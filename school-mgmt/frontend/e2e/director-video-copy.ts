export const DIRECTOR_VIDEO_COPY = {
  workflowSteps: [
    'Đăng nhập',
    'Dashboard chiến lược',
    'Pending approvals',
    'KPI giáo viên',
    'Calendar overview',
    'Employee performance',
    'Financial control',
    'Ads analytics',
    'Đăng xuất',
  ],

  introNarration:
    'Xin chào. Đây là video walkthrough đầy đủ cho vai trò director. Khác với các role tác nghiệp, director dùng hệ thống để nhìn bức tranh toàn cục, kiểm tra các điểm nghẽn, ra quyết định duyệt, theo dõi hiệu suất đội ngũ và giám sát tài chính cùng marketing.',
  introTitle: 'Video Walkthrough Director',
  introDescription:
    'Video đi theo đúng format chuẩn: roadmap tổng thể, scene briefing từng chặng, thao tác thật trên giao diện và thuyết minh tiếng Việt đồng bộ.',
  introBullets: [
    'Đi qua các luồng quản trị điều hành cốt lõi của director.',
    'Nhấn mạnh điểm ra quyết định, điểm cần đọc số liệu và điểm cần phê duyệt.',
    'Giữ nhịp quay bám theo voice để dễ dùng lại cho đào tạo nội bộ.',
  ],

  roadmapNarration:
    'Luồng chuẩn của director bắt đầu từ đăng nhập và đọc dashboard chiến lược để nắm bức tranh doanh thu, lợi nhuận, cảnh báo và tồn đọng quan trọng. Sau đó director mở pending approvals để xử lý các quyết định chờ duyệt, sang KPI giáo viên và calendar overview để theo dõi chất lượng dạy và lịch vận hành, tiếp tục qua employee performance để so sánh hiệu suất teacher, sale và ops, rồi vào financial control để nhìn dòng tiền và trạng thái đối soát. Cuối cùng director sang ads analytics để kiểm tra hiệu quả marketing trước khi đăng xuất kết thúc phiên điều hành.',
  roadmapTitle: 'Sơ Đồ Công Việc Của Director',
  roadmapDescription:
    'Director không đi sâu vào một nghiệp vụ đơn lẻ mà điều phối toàn cục: nhìn số liệu đúng, duyệt đúng và ưu tiên đúng.',

  dashboardSceneNarration:
    'Chặng đầu tiên là dashboard chiến lược. Đây là nơi director đọc nhanh sức khỏe chung của hệ thống trước khi đi vào từng module chi tiết.',
  dashboardSceneTitle: 'Chặng 1. Đăng Nhập Và Đọc Dashboard Chiến Lược',
  dashboardSceneDescription:
    'Mục tiêu là xác định nhanh cảnh báo nào cần xử lý trước, chi phí nào đang bất thường và khu vực nào cần director can thiệp.',
  dashboardSceneBullets: [
    'Đăng nhập bằng tài khoản director.',
    'Đọc thẻ cảnh báo nổi bật và tín hiệu quá hạn.',
    'Chuyển sang tab phân tích chi phí để đọc nguyên nhân.',
  ],
  dashboardNarration:
    'Tại dashboard director, hệ thống gom các chỉ số điều hành quan trọng như doanh thu, lợi nhuận, ticket quá hạn, cảnh báo tài chính và phân rã chi phí. Director không xử lý chi tiết ngay trên đây, nhưng dùng màn hình này để quyết định thứ tự ưu tiên trong ngày và biết luồng nào cần mở tiếp theo.',
  dashboardLabel:
    'Chặng 1. Đăng nhập director và đọc dashboard để chốt thứ tự ưu tiên điều hành trong ngày.',
  dashboardPageCallout:
    'Khối tổng quan này là điểm vào đầu ngày của director để nhìn sức khỏe vận hành, tài chính và các đầu việc cần can thiệp.',
  dashboardAlertCallout:
    'Cảnh báo nổi bật giúp director thấy ngay vấn đề cần hành động như ticket quá hạn, payroll bất thường hoặc reserve xuống thấp.',
  dashboardExpenseCallout:
    'Tab chi phí cho director nhìn nguyên nhân biến động thay vì chỉ nhìn tổng số cuối cùng.',

  approvalsSceneNarration:
    'Sau dashboard là pending approvals. Đây là trung tâm ra quyết định của director cho các thay đổi cần phê duyệt trước khi hệ thống cập nhật trạng thái thật.',
  approvalsSceneTitle: 'Chặng 2. Xử Lý Pending Approvals',
  approvalsSceneDescription:
    'Mục tiêu là cho thấy director không duyệt cảm tính; mỗi quyết định đều gắn với một hàng chờ cụ thể và có tác động realtime lên số lượng tồn đọng.',
  approvalsSceneBullets: [
    'Mở bảng tổng hợp pending approvals.',
    'Duyệt thay đổi lớp học đang chờ.',
    'Từ chối một session change request để giảm count realtime.',
  ],
  approvalsNarration:
    'Trong pending approvals, director nhìn tổng số hạng mục còn chờ rồi đi vào từng tab theo loại nghiệp vụ. Với thay đổi lớp học, director kiểm tra nội dung điều chỉnh trước khi duyệt. Với session change request, director có thể từ chối nếu chưa đủ điều kiện. Sau mỗi quyết định, hệ thống cập nhật lại số tồn đọng ngay để director biết hàng chờ đang giảm thực sự.',
  approvalsLabel:
    'Chặng 2. Director xử lý các quyết định chờ duyệt và quan sát count giảm realtime.',
  approvalsSummaryCallout:
    'Tổng pending này là chỉ số điều hành quan trọng vì nó phản ánh các điểm tắc đang chờ người có thẩm quyền quyết định.',
  approvalsClassCallout:
    'Dòng thay đổi lớp học này cho director thấy rõ yêu cầu cần duyệt trước khi kế hoạch học tập được cập nhật.',
  approvalsSessionCallout:
    'Director có thể từ chối session change nếu lý do hoặc tác động chưa đủ thuyết phục.',

  teacherKpiSceneNarration:
    'Sau khâu phê duyệt là theo dõi chất lượng giảng dạy. Màn hình teacher KPI giúp director nhìn giáo viên nào đang mạnh, giáo viên nào cần coaching hoặc can thiệp.',
  teacherKpiSceneTitle: 'Chặng 3. Theo Dõi KPI Giáo Viên',
  teacherKpiSceneDescription:
    'Mục tiêu là chứng minh director không chỉ nhìn một điểm số KPI, mà có thể lọc, so sánh và mở sâu vào chi tiết của từng giáo viên.',
  teacherKpiSceneBullets: [
    'Mở trang KPI giáo viên.',
    'Lọc theo trạng thái để thu hẹp nhóm cần xem.',
    'Mở detail modal của một giáo viên để đọc breakdown.',
  ],
  teacherKpiNarration:
    'Màn hình teacher KPI gom nhiều tín hiệu vào một chỗ như số buổi dạy, tỷ lệ nộp báo cáo, phản hồi phụ huynh và dữ liệu tài chính liên quan. Director có thể lọc theo trạng thái, đổi cách sắp xếp rồi mở chi tiết để xác định chính xác giáo viên nào đang cần hỗ trợ, khen thưởng hoặc điều chỉnh.',
  teacherKpiLabel:
    'Chặng 3. Lọc bảng KPI giáo viên rồi mở chi tiết để đọc breakdown hiệu suất thực tế.',
  teacherKpiFilterCallout:
    'Bộ lọc này giúp director khoanh đúng nhóm giáo viên cần xem thay vì đọc toàn bộ bảng cùng lúc.',
  teacherKpiTableCallout:
    'Bảng KPI cho phép so sánh nhanh theo điểm số, số buổi, báo cáo và phản hồi phụ huynh.',
  teacherKpiDetailCallout:
    'Detail modal là nơi director đọc nguyên nhân đằng sau điểm KPI chứ không chỉ nhìn điểm tổng.',

  calendarSceneNarration:
    'Director cũng cần nhìn lịch tổng quan để biết giáo viên nào, lớp nào và sự kiện nào đang chiếm tải trong kỳ.',
  calendarSceneTitle: 'Chặng 4. Đọc Calendar Overview',
  calendarSceneDescription:
    'Mục tiêu là cho thấy director có thể lọc lịch theo giáo viên và lớp để soi đúng cụm vận hành cần theo dõi.',
  calendarSceneBullets: [
    'Mở lịch tổng quan theo tháng.',
    'Lọc theo giáo viên và lớp học.',
    'Đọc event đã được thu hẹp theo đúng bối cảnh.',
  ],
  calendarNarration:
    'Calendar overview giúp director nhìn đồng thời session, payroll và ticket theo trục thời gian. Khi cần đi sâu vào một giáo viên hoặc một lớp cụ thể, director chỉ việc lọc theo teacher và class để màn hình co lại đúng phạm vi cần đọc.',
  calendarLabel:
    'Chặng 4. Dùng calendar overview để lọc và đọc lịch vận hành theo từng teacher và class.',
  calendarFilterCallout:
    'Hai bộ lọc này giúp director thu hẹp lịch tổng quan về đúng người và đúng lớp cần theo dõi.',
  calendarEventCallout:
    'Event timeline sau khi lọc cho thấy ngay cụm session và ticket gắn với phạm vi director đang quan tâm.',

  performanceSceneNarration:
    'Tiếp theo là employee performance. Đây là màn hình so sánh hiệu suất liên chức năng giữa teacher, sale và ops trong cùng một dashboard.',
  performanceSceneTitle: 'Chặng 5. So Sánh Employee Performance',
  performanceSceneDescription:
    'Mục tiêu là cho thấy director có thể chuyển tab và mở detail theo từng nhóm nhân sự mà không mất ngữ cảnh điều hành.',
  performanceSceneBullets: [
    'Mở tab sales để xem chuyển đổi và doanh thu.',
    'Mở detail của một sale để đọc số liệu cụ thể.',
    'Chuyển sang ops để đọc năng lực xử lý ticket.',
  ],
  performanceNarration:
    'Employee performance gom ba góc nhìn vào một nơi. Ở tab sales, director đọc lead, conversion, revenue và commission. Ở tab ops, director đọc ticket workload và tỷ lệ giải quyết. Nhờ vậy director có thể ra quyết định nhân sự và mục tiêu theo cùng một hệ quy chiếu thay vì xem từng phòng ban rời rạc.',
  performanceLabel:
    'Chặng 5. So sánh hiệu suất sale và ops trong cùng dashboard quản trị nhân sự.',
  performanceSalesTabCallout:
    'Tab sales là nơi director đọc nhanh năng lực chuyển đổi và đóng doanh thu của đội kinh doanh.',
  performanceSalesDetailCallout:
    'Detail sale giúp director nhìn rõ lead, conversion, doanh thu và commission của từng người.',
  performanceOpsDetailCallout:
    'Detail ops cho director đọc tải ticket và tỷ lệ xử lý để đánh giá độ ổn định vận hành.',

  financeSceneNarration:
    'Sau hiệu suất đội ngũ là financial control. Đây là màn hình giám sát tiền mặt, cảnh báo, ngân hàng, quỹ và trạng thái đối soát của toàn hệ thống.',
  financeSceneTitle: 'Chặng 6. Kiểm Soát Tài Chính Tổng Thể',
  financeSceneDescription:
    'Mục tiêu là nhấn mạnh director nhìn tài chính ở cấp điều hành: đọc overview trước, rồi đi xuống các tab cảnh báo, ngân hàng, quỹ và đối soát.',
  financeSceneBullets: [
    'Đọc overview tiền và nghĩa vụ tài chính.',
    'Mở tab cảnh báo để xem vấn đề cần can thiệp.',
    'Đi tiếp qua ngân hàng, quỹ và reconciliation.',
  ],
  financeNarration:
    'Financial control là trạm điều hành tài chính của director. Màn hình overview cho biết tiền đang ở đâu, nghĩa vụ phải trả là gì và vị thế hiện tại có an toàn hay không. Từ đó director chuyển sang tab cảnh báo, rồi mở sâu vào ngân hàng, quỹ và tab reconciliation để biết hệ thống còn bao nhiêu điểm chưa chốt sổ.',
  financeLabel:
    'Chặng 6. Director đọc overview tài chính rồi kiểm tra các tab cảnh báo, ngân hàng, quỹ và đối soát.',
  financeOverviewCallout:
    'Khối overview này cho director cái nhìn tổng thể về tiền, reserve, nghĩa vụ phải trả và trạng thái tài chính hiện tại.',
  financeAlertCallout:
    'Cảnh báo tài chính cho biết điểm nào cần can thiệp ngay thay vì chờ tới cuối kỳ mới phát hiện.',
  financeBankCallout:
    'Tab ngân hàng giúp director đọc tài khoản, số dư và giao dịch gần nhất theo từng nguồn tiền.',
  financeFundCallout:
    'Tab quỹ cho thấy các quỹ vận hành như marketing hoặc reserve có đang dưới ngưỡng hay không.',
  financeReconciliationCallout:
    'Reconciliation là màn chốt để biết còn bao nhiêu mục chưa đối soát trước khi kết sổ.',

  adsSceneNarration:
    'Sau tài chính là ads analytics. Đây là nơi director theo dõi hiệu quả marketing, so sánh ROI theo nhóm quảng cáo và dùng gợi ý phân bổ ngân sách.',
  adsSceneTitle: 'Chặng 7. Phân Tích Ads Analytics',
  adsSceneDescription:
    'Mục tiêu là cho thấy director không chỉ xem spend, mà còn xem profit theo nhóm quảng cáo và dùng công cụ gợi ý ngân sách để điều phối tăng trưởng.',
  adsSceneBullets: [
    'Sắp xếp bảng overview theo ROI.',
    'Lọc platform và ad group để phân tích sâu.',
    'Mở tab profit theo phụ huynh và dùng gợi ý ngân sách.',
  ],
  adsNarration:
    'Ở ads analytics, director bắt đầu từ bảng funnel tổng quan để xem nhóm quảng cáo nào đang tạo ROI tốt và nhóm nào đang lỗ. Sau khi lọc theo platform và ad group, director có thể chuyển sang tab profit theo phụ huynh để nhìn lợi nhuận thực tế gần hơn với kết quả kinh doanh. Cuối cùng, director dùng công cụ gợi ý ngân sách để thử một kịch bản phân bổ ads phù hợp hơn.',
  adsLabel:
    'Chặng 7. Director đọc ROI quảng cáo, lọc nhóm ads và dùng công cụ gợi ý ngân sách.',
  adsOverviewCallout:
    'Bảng overview là nơi director nhìn nhanh nhóm quảng cáo nào hiệu quả và nhóm nào cần cắt hoặc tối ưu.',
  adsFilterCallout:
    'Bộ lọc platform và ad group giúp director đi từ bức tranh lớn xuống đúng chiến dịch cần phân tích.',
  adsParentTabCallout:
    'Tab profit theo phụ huynh nối dữ liệu ads với kết quả kinh doanh gần thực tế hơn.',
  adsSuggestionCallout:
    'Khu gợi ý ngân sách là phần director dùng để ra quyết định phân bổ ads thay vì chỉ xem báo cáo tĩnh.',

  logoutSceneNarration:
    'Sau khi đi hết các màn hình điều hành chính, director đăng xuất để kết thúc phiên làm việc và trả hệ thống về trang đăng nhập.',
  logoutSceneTitle: 'Chặng 8. Đăng Xuất',
  logoutSceneDescription:
    'Mục tiêu là đóng phiên điều hành an toàn sau khi đã xem số liệu, xử lý duyệt và kiểm tra các bức tranh quan trọng.',
  logoutSceneBullets: [
    'Quay về dashboard chính.',
    'Bấm đăng xuất trong sidebar.',
    'Xác nhận hệ thống quay về trang login.',
  ],
  logoutNarration:
    'Khi hệ thống đã được rà soát qua dashboard, approvals, KPI, vận hành, tài chính và marketing, director đăng xuất để kết thúc phiên làm việc. Đây là bước cuối cùng để bảo toàn phiên đăng nhập và tránh nhầm tài khoản khi bàn giao máy.',
  logoutLabel:
    'Chặng 8. Đăng xuất sau khi đã hoàn thành vòng kiểm soát điều hành của director.',
  logoutCallout:
    'Đăng xuất giúp chốt đúng phiên làm việc và bảo vệ tài khoản quản trị có quyền rất cao.',

  outroNarration:
    'Như vậy chúng ta vừa đi qua toàn bộ luồng điều hành cốt lõi của director, từ dashboard chiến lược, phê duyệt chờ xử lý, KPI giáo viên, lịch tổng quan, hiệu suất nhân sự, tài chính cho tới ads analytics và đăng xuất. Video này phù hợp để onboarding vai trò giám đốc, trình bày năng lực hệ thống hoặc dùng làm chuẩn quay cho các vai trò quản trị khác.',
  outroTitle: 'Hoàn Tất Walkthrough Director',
  outroDescription:
    'Director là role nhìn toàn cục và ra quyết định. Format video này được dựng để làm rõ đúng bản chất đó trên giao diện thật.',
  outroBullets: [
    'Có roadmap điều hành trước khi vào từng scene.',
    'Có giải thích rõ chỗ nào đọc số liệu và chỗ nào ra quyết định.',
    'Có thể dùng lại làm mẫu sản xuất cho các video quản trị khác.',
  ],
} as const;
