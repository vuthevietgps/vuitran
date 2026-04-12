export const SALE_VIDEO_COPY = {
  workflowSteps: [
    'Dashboard',
    'Sale Hub',
    'Leads',
    'Conversations',
    'Order khách mới',
    'Order khách cũ',
    'Duyệt đơn',
    'Invoice và Student',
    'Sessions',
    'Trial offline',
    'Commission',
    'Đăng xuất',
  ],

  introNarration:
    'Xin chào. Đây là video sale được sản xuất lại theo quy trình mới. Video sẽ bắt đầu bằng sơ đồ luồng tổng thể, sau đó đi lần lượt qua từng nhóm công việc chính của sale với chú thích tiếng Việt và thao tác thật trên hệ thống.',
  introTitle: 'Video walkthrough Sale',
  introDescription:
    'Mục tiêu của video này là giúp người xem hiểu cả logic nghiệp vụ lẫn chuỗi thao tác thực tế của role sale trong một ngày làm việc.',
  introBullets: [
    'Phần 1: nhìn sơ đồ luồng tổng thể của role sale.',
    'Phần 2: đi qua từng nhóm việc chính như leads, chatbot, orders, duyệt và đối soát.',
    'Phần 3: dùng lại được cho onboarding, demo nội bộ và nghiệm thu luồng sale.',
  ],

  roadmapNarration:
    'Luồng chuẩn của sale bắt đầu từ dashboard và sale hub, sau đó chuyển sang lead và chatbot, tiếp tục lên order cho khách mới hoặc khách cũ, gửi duyệt, kiểm tra invoice và student phát sinh, xử lý các yêu cầu liên quan tới session, tạo trial offline, đối chiếu commission và cuối cùng là đăng xuất.',
  roadmapTitle: 'Sơ đồ luồng làm việc của sale',
  roadmapDescription:
    'Đây là flow tổng thể theo đúng nhịp vận hành. Mỗi chặng sẽ có một scene briefing trước khi mở màn hình thật để thao tác.',

  dashboardSceneNarration:
    'Chặng đầu tiên là khởi động ngày làm việc. Sale vào dashboard để biết hôm nay cần ưu tiên lead nào, follow-up nào và tình hình doanh số, hoa hồng hiện tại ra sao.',
  dashboardSceneTitle: 'Chặng 1. Đọc dashboard đầu ngày',
  dashboardSceneDescription:
    'Mục tiêu là nắm nhanh KPI, follow-up và các đơn gần đây trước khi lao ngay vào thao tác chi tiết.',
  dashboardSceneBullets: [
    'Đăng nhập đúng vai sale.',
    'Đọc khối KPI doanh số và hoa hồng.',
    'Xem follow-up và đơn gần đây để biết việc ưu tiên.',
  ],
  dashboardNarration:
    'Ở dashboard sale, người dùng đọc tỷ lệ chuyển đổi, doanh thu, hoa hồng, follow-up hôm nay và các đơn gần đây. Đây là màn hình để chốt ưu tiên làm việc trước khi mở từng module riêng.',
  dashboardLabel:
    'Chặng 1. Vào dashboard sale để nắm KPI, follow-up trong ngày và trạng thái đơn hàng hiện tại.',
  dashboardKpiCallout:
    'Khối KPI này giúp sale biết nhanh conversion, doanh thu và hoa hồng đang ghi nhận.',
  dashboardFollowupCallout:
    'Bảng follow-up hôm nay là nơi chốt những lead nào cần gọi hoặc nhắn lại ngay.',
  dashboardRecentOrderCallout:
    'Các đơn gần đây giúp sale nhìn được đơn nào đang chờ duyệt và đơn nào đã đi tiếp xuống downstream.',

  saleHubSceneNarration:
    'Sau dashboard, sale cần nhìn lại sale hub để luôn nhớ đúng thứ tự thao tác. Đây là điểm đặc biệt quan trọng với sale mới, vì hệ thống có nhiều màn hình nhưng phải đi đúng luồng.',
  saleHubSceneTitle: 'Chặng 2. Xem Sale Hub và quy trình chuẩn',
  saleHubSceneDescription:
    'Mục tiêu là nhắc lại 5 bước cốt lõi: parent, student, invoice hoặc order, gate tài chính và class.',
  saleHubSceneBullets: [
    'Mở sale hub.',
    'Đọc 5 bước chuẩn của luồng sale.',
    'Nhìn rõ điều kiện chỉ tạo lớp sau khi đủ gate tài chính.',
  ],
  saleHubNarration:
    'Sale hub là màn hình tóm tắt quy trình chuẩn. Người xem chỉ cần nhìn vào hero card, năm workflow card và gate tài chính là hiểu ngay vì sao phải đi theo thứ tự parent, student, order, duyệt hoặc nạp tiền rồi mới sang lớp.',
  saleHubLabel:
    'Chặng 2. Mở sale hub để nhìn lại luồng chuẩn và các điều kiện chặn trước khi tạo lớp.',
  saleHubHeroCallout:
    'Hero card này giải thích ngắn gọn mục tiêu của toàn bộ luồng sale trong hệ thống.',
  saleHubWorkflowCallout:
    'Năm workflow card là bộ khung sale mới phải nhớ trước khi thao tác trên dữ liệu thật.',
  saleHubGateCallout:
    'Gate tài chính là chốt chặn quan trọng: chưa duyệt hóa đơn hoặc chưa có số dư thì chưa sang bước tạo lớp.',

  leadsSceneNarration:
    'Khi đã nắm đúng luồng, sale quay về CRM để làm việc với lead. Chặng này tập trung vào việc tìm đúng lead cần xử lý và đọc đủ bối cảnh trước khi tư vấn.',
  leadsSceneTitle: 'Chặng 3. Làm việc với leads',
  leadsSceneDescription:
    'Mục tiêu là lọc đúng lead, mở detail và đọc lại toàn bộ thông tin phụ huynh, học sinh, nguồn vào và lịch sử chăm sóc.',
  leadsSceneBullets: [
    'Mở module leads.',
    'Tìm lead theo số điện thoại hoặc mã lead.',
    'Mở detail để đọc lại bối cảnh.',
  ],
  leadsNarration:
    'Ở module leads, sale dùng bộ lọc và keyword để tìm đúng lead. Sau đó mở detail để xem phụ huynh, học sinh, source, estimated value và lịch sử liên hệ trước khi tiếp tục chăm sóc hoặc chuyển đổi.',
  leadsLabel:
    'Chặng 3. Vào leads, lọc lead cần xử lý rồi mở detail để đọc lại toàn bộ ngữ cảnh.',
  leadsFilterCallout:
    'Bộ lọc và ô tìm kiếm là công cụ giúp sale không bỏ sót lead cần follow-up.',
  leadsRowCallout:
    'Mỗi dòng lead tóm tắt đủ thông tin để sale quyết định có cần mở sâu hay không.',
  leadsDetailCallout:
    'Lead detail là nơi đọc lại đầy đủ dữ liệu phụ huynh, học sinh và lịch sử chăm sóc trước khi chốt bước tiếp theo.',

  conversationsSceneNarration:
    'Không phải lead nào cũng vào trực tiếp từ form. Một phần lớn đến từ chatbot và fanpage. Vì vậy sale cần biết cách tiếp quản hội thoại và chuyển nó thành lead chính thức.',
  conversationsSceneTitle: 'Chặng 4. Tiếp quản hội thoại chatbot',
  conversationsSceneDescription:
    'Mục tiêu là nhận lại hội thoại AI đang xử lý và tạo lead ngay từ sidebar mà không làm mất ngữ cảnh chat.',
  conversationsSceneBullets: [
    'Mở conversations.',
    'Tiếp quản hội thoại AI.',
    'Tạo lead trực tiếp từ thông tin đang có trong cuộc chat.',
  ],
  conversationsNarration:
    'Trong conversations, sale chọn một hội thoại AI đang xử lý, bấm tiếp quản rồi dùng form tạo lead ở sidebar. Cách làm này giúp nối liền kênh marketing và CRM ngay trong cùng một flow.',
  conversationsLabel:
    'Chặng 4. Tiếp quản hội thoại chatbot và chuyển đổi thành lead trên cùng một màn hình.',
  conversationsCardCallout:
    'Thẻ hội thoại này cho thấy nguồn chat và khách đang được AI giữ trạng thái xử lý.',
  conversationsTakeoverCallout:
    'Nút tiếp quản chuyển quyền xử lý từ AI sang sale để bắt đầu thao tác thủ công.',
  conversationsLeadCallout:
    'Form sidebar cho phép tạo lead trực tiếp từ hội thoại mà không cần nhập lại từ đầu ở module leads.',

  newOrderSceneNarration:
    'Sau khi lead đủ điều kiện, sale bắt đầu lên order. Tình huống đầu tiên là khách hoàn toàn mới, nghĩa là parent và student đều chưa có sẵn trong hệ thống.',
  newOrderSceneTitle: 'Chặng 5. Tạo order cho khách mới',
  newOrderSceneDescription:
    'Mục tiêu là nhập parent mới, student mới, chọn gói học, tải chứng từ và lưu order nháp trước khi gửi duyệt.',
  newOrderSceneBullets: [
    'Tạo order mới.',
    'Nhập parent và student mới.',
    'Chọn gói học, upload chứng từ và lưu nháp.',
  ],
  newOrderNarration:
    'Ở tình huống khách mới, sale tạo order từ đầu với phụ huynh mới, học sinh mới, gói học phù hợp và chứng từ thanh toán. Sau khi lưu nháp, đơn sẽ xuất hiện trên bảng để sale rà lại trước khi submit.',
  newOrderLabel:
    'Chặng 5. Tạo order cho khách mới với đầy đủ parent, student, gói học và chứng từ.',
  newOrderCreateCallout:
    'Bắt đầu bằng nút tạo order mới để mở modal thao tác đầy đủ.',
  newOrderFormCallout:
    'Trong form này, sale nhập parent mới, student mới, số buổi và các thông tin tài chính cần thiết.',
  newOrderReceiptCallout:
    'Chứng từ được tải ngay trên form để tránh thất lạc khi chuyển sang bước duyệt.',
  newOrderDraftCallout:
    'Sau khi lưu nháp, order xuất hiện trên bảng để sale kiểm tra lại trước khi gửi duyệt.',
  newOrderSubmitCallout:
    'Bước gửi duyệt là mốc bàn giao order sang luồng phê duyệt chính thức.',

  existingOrderSceneNarration:
    'Tình huống thứ hai là khách cũ. Đây là nhánh sale dùng rất thường xuyên, vì hệ thống cho phép tái dùng parent và student có sẵn để tránh tạo trùng hồ sơ.',
  existingOrderSceneTitle: 'Chặng 6. Tạo order cho khách cũ',
  existingOrderSceneDescription:
    'Mục tiêu là tìm đúng phụ huynh cũ, chọn đúng học sinh cũ và gắn luôn lớp hiện hữu nếu phù hợp.',
  existingOrderSceneBullets: [
    'Tìm lại parent cũ.',
    'Chọn student cũ.',
    'Lên order tiếp theo mà không tạo trùng hồ sơ.',
  ],
  existingOrderNarration:
    'Với khách cũ, sale dùng chức năng lookup để tìm parent và student đã có. Sau đó vẫn thao tác chọn product, lớp và chứng từ như một order bình thường, nhưng toàn bộ dữ liệu gốc được tái sử dụng.',
  existingOrderLabel:
    'Chặng 6. Tạo order cho khách cũ bằng cách tái sử dụng đúng parent và student đã tồn tại.',
  existingOrderParentCallout:
    'Lookup phụ huynh theo số điện thoại giúp sale tránh nhập lại hồ sơ cũ.',
  existingOrderStudentCallout:
    'Lookup học sinh đảm bảo đơn mới gắn đúng người học đang có trên hệ thống.',
  existingOrderClassCallout:
    'Ở tình huống phù hợp, sale có thể gắn luôn lớp hiện hữu để luồng đi nhanh hơn.',
  existingOrderSubmitCallout:
    'Sau khi lưu xong, order khách cũ cũng được gửi vào bước chờ duyệt như đơn mới.',

  approvalSceneNarration:
    'Khi sale gửi duyệt, quyền xử lý được chuyển sang Director hoặc OPS. Đây là khâu kiểm tra chứng từ và xác nhận order có thể đi xuống downstream hay chưa.',
  approvalSceneTitle: 'Chặng 7. Duyệt order',
  approvalSceneDescription:
    'Mục tiêu là đổi vai, mở order vừa gửi, kiểm tra chứng từ và xác nhận duyệt ngay trên hệ thống.',
  approvalSceneBullets: [
    'Chuyển từ vai sale sang director.',
    'Mở lại order vừa gửi.',
    'Duyệt đơn để hệ thống sinh invoice và student downstream.',
  ],
  approvalNarration:
    'Ở góc nhìn Director, order được mở lại từ danh sách chờ duyệt. Người duyệt rà chứng từ, xác nhận và hệ thống sẽ ghi nhận trạng thái mới cùng các dữ liệu phát sinh liên quan.',
  approvalLabel:
    'Chặng 7. Chuyển sang vai duyệt để kiểm tra và xác nhận order ngay trong hệ thống.',
  approvalRowCallout:
    'Dòng order chờ duyệt là điểm vào để mở modal xử lý phê duyệt.',
  approvalModalCallout:
    'Modal duyệt là nơi người có thẩm quyền đối chiếu chứng từ và xác nhận bước duyệt chính thức.',
  approvalDoneCallout:
    'Sau khi duyệt xong, trạng thái trên danh sách thay đổi ngay để sale có thể theo dõi downstream.',

  downstreamSceneNarration:
    'Khi order đã được duyệt, sale không dừng lại ở đó. Chặng tiếp theo là quay lại kiểm tra các dữ liệu phát sinh như invoice và student để chắc chắn luồng downstream đã chạy đúng.',
  downstreamSceneTitle: 'Chặng 8. Kiểm tra dữ liệu phát sinh sau duyệt',
  downstreamSceneDescription:
    'Mục tiêu là xác nhận invoice đã được tạo đúng và học sinh mới đã xuất hiện đúng trên module students.',
  downstreamSceneBullets: [
    'Quay lại vai sale.',
    'Tìm invoice vừa phát sinh.',
    'Kiểm tra học sinh mới trong danh sách students.',
  ],
  invoiceNarration:
    'Đầu tiên, sale mở module invoices để tìm lại hóa đơn vừa phát sinh từ order đã được duyệt. Đây là bước xác nhận hệ thống đã sinh downstream đúng và đủ.',
  invoiceLabel:
    'Chặng 8A. Mở invoices để kiểm tra hóa đơn vừa phát sinh từ order đã được duyệt.',
  invoiceCallout:
    'Dòng invoice này là bằng chứng cho thấy order đã chạy qua bước downstream tài chính.',
  studentNarration:
    'Sau invoice, sale mở module students để xác nhận hồ sơ học sinh mới đã được provision đúng. Khi học sinh đã xuất hiện ở đây, luồng bàn giao cho vận hành sẽ không bị đứt.',
  studentLabel:
    'Chặng 8B. Mở students để xác nhận học sinh mới đã được tạo đúng sau bước duyệt.',
  studentCallout:
    'Học sinh mới đã có trên danh sách cho thấy phần provision dữ liệu đã hoàn tất.',

  sessionsSceneNarration:
    'Ngoài lead và order, sale còn tham gia vào các phát sinh liên quan tới buổi học. Tình huống điển hình là gửi yêu cầu thay đổi giáo viên hoặc thay đổi buổi cho một session đang được lên lịch.',
  sessionsSceneTitle: 'Chặng 9. Gửi yêu cầu thay đổi session',
  sessionsSceneDescription:
    'Mục tiêu là mở session đang scheduled, vào form change request và gửi yêu cầu chính thức để OPS hoặc người duyệt tiếp nhận.',
  sessionsSceneBullets: [
    'Mở sessions.',
    'Xem chi tiết buổi đang scheduled.',
    'Gửi yêu cầu thay đổi giáo viên hoặc lịch học.',
  ],
  sessionsNarration:
    'Ở module sessions, sale mở đúng buổi học đang scheduled, vào khu vực change request, chọn giáo viên đề xuất và ghi rõ lý do thay đổi. Đây là cách chuẩn để chuyển phát sinh cho người duyệt tiếp nhận.',
  sessionsLabel:
    'Chặng 9. Mở session đang scheduled và gửi change request chính thức từ role sale.',
  sessionsRowCallout:
    'Session row là nơi sale chọn đúng buổi học đang có phát sinh cần điều chỉnh.',
  sessionsRequestCallout:
    'Thẻ change request cho phép mở form thay đổi ngay từ chi tiết session.',
  sessionsFormCallout:
    'Form này cần ghi rõ giáo viên đề xuất hoặc thay đổi cần thực hiện để tránh xử lý mơ hồ ở bước sau.',
  sessionsHistoryCallout:
    'Lịch sử request cho thấy yêu cầu đã được ghi nhận và đang ở trạng thái chờ duyệt.',

  trialSceneNarration:
    'Một nghiệp vụ khác của sale là tạo bản ghi học thử offline. Đây là nhánh dùng trước khi khóa học chính thức được chốt thành order hoặc invoice hoàn chỉnh.',
  trialSceneTitle: 'Chặng 10. Tạo trial enrollment offline',
  trialSceneDescription:
    'Mục tiêu là tạo bản ghi học thử với đúng học viên, phụ huynh, lớp offline, gói offline và sale phụ trách.',
  trialSceneBullets: [
    'Mở trial enrollments.',
    'Tạo học thử mới.',
    'Kiểm tra trial record xuất hiện đúng trên bảng.',
  ],
  trialNarration:
    'Ở module trial enrollments, sale tạo một bản ghi học thử offline với đầy đủ học viên, phụ huynh, lớp và gói sản phẩm. Bản ghi này giúp luồng học thử được theo dõi tách biệt trước khi chốt đăng ký chính thức.',
  trialLabel:
    'Chặng 10. Tạo trial enrollment offline để theo dõi nhánh học thử trước khi chuyển đổi chính thức.',
  trialSummaryCallout:
    'Khối tổng quan này giúp sale và OPS nhìn nhanh số trial đang học, chờ quyết định hoặc đã chốt.',
  trialCreateCallout:
    'Nút tạo học thử mở form để sale ghi nhận bản trial mới cho phụ huynh và học viên.',
  trialFormCallout:
    'Form học thử cần điền đủ thông tin phụ huynh, học viên, lớp offline và gói học offline.',
  trialRowCallout:
    'Khi trial record xuất hiện trên bảng, sale có thể theo dõi trạng thái và bàn giao cho bước quyết định tiếp theo.',

  commissionSceneNarration:
    'Chặng gần cuối là đối chiếu hiệu quả bán hàng. Sale vào commission report để đọc doanh thu, hoa hồng, phần chờ duyệt và từng dòng đơn hàng liên quan.',
  commissionSceneTitle: 'Chặng 11. Đối chiếu commission report',
  commissionSceneDescription:
    'Mục tiêu là đọc summary, bảng theo tháng và chi tiết order để sale tự đối chiếu hiệu quả chốt đơn của mình.',
  commissionSceneBullets: [
    'Mở commission report.',
    'Đọc khối tổng doanh thu và hoa hồng.',
    'Rà bảng chi tiết order để kiểm tra từng đơn.',
  ],
  commissionNarration:
    'Ở báo cáo hoa hồng, sale xem tổng doanh thu, tổng hoa hồng, phần đang chờ duyệt và từng đơn chi tiết. Đây là nơi nối kết công việc chốt đơn hằng ngày với kết quả tài chính cuối kỳ.',
  commissionLabel:
    'Chặng 11. Mở commission report để đối chiếu doanh thu, hoa hồng và chi tiết đơn hàng.',
  commissionSummaryCallout:
    'Khối summary là nơi đọc nhanh kết quả tài chính gắn với hoạt động bán hàng.',
  commissionTableCallout:
    'Bảng chi tiết cho phép sale rà từng order và phần hoa hồng tương ứng của mình.',

  logoutSceneNarration:
    'Chặng cuối cùng là đăng xuất để đóng phiên làm việc. Khi hệ thống quay về màn hình login, chuỗi thao tác của role sale được xem là hoàn tất.',
  logoutSceneTitle: 'Chặng 12. Đăng xuất',
  logoutSceneDescription:
    'Mục tiêu là kết thúc phiên làm việc an toàn sau khi đã đi qua toàn bộ luồng sale.',
  logoutSceneBullets: [
    'Bấm đăng xuất ở shell ứng dụng.',
    'Kiểm tra hệ thống quay về login.',
    'Kết thúc video bằng trạng thái sạch.',
  ],
  logoutNarration:
    'Cuối cùng, sale đăng xuất khỏi hệ thống để kết thúc phiên làm việc. Đây là điểm dừng đúng sau khi đã đi qua dashboard, leads, orders, downstream và các nghiệp vụ bổ trợ.',
  logoutLabel:
    'Chặng 12. Đăng xuất sau khi đã hoàn tất toàn bộ nhóm công việc chính của role sale.',
  logoutCallout:
    'Nút đăng xuất giúp đóng phiên làm việc và đưa hệ thống về trạng thái sẵn sàng cho vai khác.',

  outroNarration:
    'Như vậy chúng ta vừa đi qua toàn bộ luồng công việc chính của sale, từ nhìn dashboard và sale hub, xử lý lead và chatbot, lên order, gửi duyệt, kiểm tra dữ liệu phát sinh, cho tới các nghiệp vụ trial, sessions và commission.',
  outroTitle: 'Hoàn tất walkthrough Sale',
  outroDescription:
    'Video đã được dựng theo format chuẩn: có roadmap, có scene briefing, có thao tác thật trên UI và có lồng tiếng tiếng Việt đồng bộ với từng nhóm nghiệp vụ.',
  outroBullets: [
    'Đủ các nhóm việc chính của role sale.',
    'Có giải thích nghiệp vụ trước khi thao tác trên UI.',
    'Có thể dùng lại cho onboarding và demo hệ thống.',
  ],
} as const;
