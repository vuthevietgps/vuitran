export const ACCOUNTING_VIDEO_COPY = {
  workflowSteps: [
    'Đăng nhập',
    'Dashboard kế toán',
    'Wallets',
    'Invoices',
    'Payroll giáo viên',
    'Staff payroll',
    'Expenses',
    'Loans',
    'Financial control',
    'Export reports',
    'Đăng xuất',
  ],

  introNarration:
    'Xin chào. Đây là video walkthrough đầy đủ cho vai trò kế toán. Video sẽ bắt đầu bằng sơ đồ luồng tổng thể, sau đó đi lần lượt qua từng màn hình và từng nghiệp vụ chính mà kế toán dùng để đối chiếu tiền, duyệt chứng từ, theo dõi công nợ, kiểm soát tài chính và xuất báo cáo.',
  introTitle: 'Video Walkthrough Kế Toán',
  introDescription:
    'Mục tiêu của video là giúp người xem hiểu rõ cả luồng nghiệp vụ lẫn thao tác thực tế trên giao diện kế toán.',
  introBullets: [
    'Đi từ dashboard tới wallets, invoices và payroll.',
    'Mô phỏng đủ các bước tạo, duyệt, ghi nhận thanh toán và đối chiếu.',
    'Kết lại bằng financial control, export reports và đăng xuất.',
  ],

  roadmapNarration:
    'Luồng chuẩn của kế toán bắt đầu từ đăng nhập và đọc dashboard để biết việc nào cần ưu tiên trong ngày. Sau đó kế toán vào wallets để duyệt top-up và đọc ledger, sang invoices để duyệt hóa đơn, sang payroll và staff payroll để kiểm tra lương, tiếp tục xử lý expenses và loans, rồi đi qua financial control để nhìn toàn cảnh tiền mặt, ngân hàng, quỹ và đối soát. Cuối cùng là export reports để tải các báo cáo CSV và đăng xuất để kết thúc phiên làm việc.',
  roadmapTitle: 'Sơ Đồ Luồng Làm Việc Của Kế Toán',
  roadmapDescription:
    'Đây là flow chuẩn theo nghiệp vụ tài chính nội bộ: duyệt đúng, đối chiếu đúng và chốt báo cáo đúng.',

  dashboardSceneNarration:
    'Chặng đầu tiên là vào dashboard kế toán để nhìn toàn cảnh. Màn hình này giúp xác định top-up chờ duyệt, hóa đơn chờ duyệt và các đầu việc tài chính cần xử lý ngay trong ngày.',
  dashboardSceneTitle: 'Chặng 1. Đăng Nhập Và Đọc Dashboard Kế Toán',
  dashboardSceneDescription:
    'Mục tiêu là vào đúng tài khoản kế toán và xác định nhanh thứ tự ưu tiên xử lý trước khi đi vào từng màn hình chi tiết.',
  dashboardSceneBullets: [
    'Đăng nhập bằng tài khoản kế toán.',
    'Đọc nhanh dashboard đầu ngày.',
    'Xác định đầu việc tài chính cần ưu tiên xử lý.',
  ],
  dashboardNarration:
    'Trên dashboard kế toán, hệ thống không thay thế các màn hình chi tiết nhưng giúp chốt thứ tự ưu tiên. Kế toán nhìn ngay các mục như top-up chờ duyệt, hóa đơn cần duyệt và các việc tài chính phát sinh để quyết định nên vào ví, hóa đơn hay payroll trước.',
  dashboardLabel:
    'Chặng 1. Đăng nhập kế toán và đọc dashboard để nắm việc nào cần xử lý trước trong ngày.',
  dashboardTaskCallout:
    'Khối đầu việc này giúp kế toán quyết định đúng thứ tự ưu tiên xử lý thay vì mở từng màn hình một cách rời rạc.',

  walletsSceneNarration:
    'Sau dashboard là wallets. Đây là luồng duyệt top-up, kiểm tra ledger và kiểm tra validation điều chỉnh ví để đảm bảo mọi biến động số dư đều có dấu vết.',
  walletsSceneTitle: 'Chặng 2. Duyệt Top-up Và Đối Chiếu Ví',
  walletsSceneDescription:
    'Mục tiêu là chứng minh kế toán không chỉ bấm duyệt mà còn phải đối chiếu hậu kiểm sau khi thao tác xong.',
  walletsSceneBullets: [
    'Mở danh sách top-up chờ duyệt.',
    'Duyệt đúng chứng từ rồi kiểm tra ledger.',
    'Xem validation audit của điều chỉnh ví.',
  ],
  walletsNarration:
    'Trong wallets, kế toán bắt đầu từ danh sách top-up chờ duyệt, kiểm tra đúng phụ huynh, đúng số tiền, đúng biên lai rồi mới xác nhận duyệt. Sau khi duyệt xong, bước bắt buộc tiếp theo là quay về ledger để nhìn đúng dòng bút toán mới sinh ra. Nếu cần điều chỉnh ví, hệ thống luôn yêu cầu lý do audit để tránh mọi thay đổi số dư không rõ nguyên nhân.',
  walletsLabel:
    'Chặng 2. Duyệt top-up, đọc lại ledger và kiểm tra validation khi điều chỉnh ví.',
  walletsPendingButtonCallout:
    'Nút này mở toàn bộ yêu cầu top-up đang chờ kế toán xác nhận.',
  walletsPendingRowCallout:
    'Trước khi duyệt, kế toán phải đối chiếu đúng phụ huynh, số tiền, mã giao dịch và ảnh biên lai.',
  walletsApproveCallout:
    'Khi xác nhận duyệt, hệ thống sẽ cộng tiền vào ví và sinh bút toán TOP_UP trong ledger.',
  walletsLedgerCallout:
    'Ledger là bước hậu kiểm bắt buộc để xác nhận đúng bút toán vừa sinh ra sau khi duyệt top-up.',
  walletsAdjustModalCallout:
    'Luồng điều chỉnh ví luôn yêu cầu lý do audit; hệ thống sẽ chặn nếu thiếu lý do để bảo vệ số dư.',

  invoicesSceneNarration:
    'Tiếp theo là invoices. Đây là nơi kế toán lọc các hóa đơn chờ duyệt, đối chiếu chứng từ thanh toán rồi duyệt để tiền vào được ghi nhận đúng trạng thái.',
  invoicesSceneTitle: 'Chặng 3. Duyệt Hóa Đơn',
  invoicesSceneDescription:
    'Mục tiêu là mô tả rõ cách kế toán chốt dòng tiền vào từ hóa đơn, không chỉ nhìn trạng thái cuối cùng.',
  invoicesSceneBullets: [
    'Lọc hóa đơn chờ duyệt.',
    'Kiểm tra chứng từ thanh toán.',
    'Duyệt hóa đơn và xác nhận trạng thái mới.',
  ],
  invoicesNarration:
    'Ở màn hình invoices, kế toán lọc trạng thái chờ duyệt để chỉ nhìn đúng các hóa đơn cần xử lý. Sau đó kế toán kiểm tra số tiền, học sinh, lớp, hình thức thanh toán và ảnh xác nhận, rồi mới duyệt hóa đơn. Bước cuối là kiểm tra lại bảng để thấy trạng thái đã chuyển sang approved thực sự.',
  invoicesLabel:
    'Chặng 3. Lọc hóa đơn chờ duyệt, đối chiếu chứng từ rồi xác nhận duyệt.',
  invoicesPendingCallout:
    'Dòng hóa đơn này đang chờ duyệt và đã đủ thông tin học sinh, lớp và số tiền để kế toán đối chiếu.',
  invoicesApproveCallout:
    'Ảnh xác nhận duyệt được tải lên trước khi kế toán chốt hóa đơn.',
  invoicesApprovedCallout:
    'Sau khi duyệt thành công, kế toán luôn kiểm tra lại trạng thái của chính dòng hóa đơn đó trên bảng.',

  teacherPayrollSceneNarration:
    'Sau hóa đơn là payroll giáo viên. Kế toán luôn đọc từ preview trước để biết buổi nào đủ điều kiện tính lương và buổi nào còn bị chặn vì thiếu báo cáo hoặc chờ xác nhận.',
  teacherPayrollSceneTitle: 'Chặng 4. Kiểm Tra Payroll Giáo Viên',
  teacherPayrollSceneDescription:
    'Mục tiêu là cho người xem thấy lương giáo viên không được chốt từ số cuối cùng, mà phải đi qua bước preview điều kiện.',
  teacherPayrollSceneBullets: [
    'Xem preview theo kỳ.',
    'Đọc các buổi đủ điều kiện hoặc đang bị chặn.',
    'Gửi bảng lương draft sang bước duyệt.',
  ],
  teacherPayrollNarration:
    'Trong payroll giáo viên, preview là nơi kế toán xác nhận đầu vào của bảng lương. Tại đây kế toán nhìn được buổi đủ điều kiện tính lương, buổi còn chờ teaching report hoặc chờ xác nhận. Chỉ khi dữ liệu đã sạch thì bảng lương draft mới được gửi sang bước pending review.',
  teacherPayrollLabel:
    'Chặng 4. Đọc preview payroll giáo viên rồi gửi bảng lương draft đi duyệt.',
  teacherPayrollPreviewCallout:
    'Bảng preview giúp kế toán nhìn rõ buổi nào đủ điều kiện và buổi nào còn đang bị chặn trước khi chốt kỳ lương.',
  teacherPayrollDraftCallout:
    'Đây là bảng lương draft; kế toán gửi đi duyệt chứ không tự phê duyệt ngay trên cùng màn hình.',
  teacherPayrollPendingCallout:
    'Sau khi gửi duyệt, kế toán kiểm tra lại đúng kỳ lương đã chuyển sang trạng thái chờ duyệt.',

  staffPayrollSceneNarration:
    'Với staff payroll, kế toán thường mở chi tiết để kiểm tra cấu phần lương, KPI, khấu trừ và chứng từ, rồi mới đánh dấu đã thanh toán khi tiền thực sự ra khỏi tài khoản.',
  staffPayrollSceneTitle: 'Chặng 5. Xử Lý Lương Nhân Sự Nội Bộ',
  staffPayrollSceneDescription:
    'Mục tiêu là chứng minh bước đánh dấu đã thanh toán chỉ diễn ra sau khi kế toán kiểm tra đủ cấu phần lương và mã tham chiếu thanh toán.',
  staffPayrollSceneBullets: [
    'Mở kỳ lương nhân sự đã duyệt.',
    'Đọc chi tiết cấu phần lương.',
    'Đánh dấu đã thanh toán với mã tham chiếu.',
  ],
  staffPayrollNarration:
    'Ở staff payroll, kế toán không chỉ nhìn trạng thái paid hay unpaid mà còn phải mở chi tiết để xác nhận đủ lương cơ bản, KPI, phụ cấp và khấu trừ. Khi tiền thực sự đã được chi, kế toán nhập mã tham chiếu hoặc mã chứng từ rồi mới đánh dấu đã thanh toán.',
  staffPayrollLabel:
    'Chặng 5. Mở chi tiết lương nhân sự rồi đánh dấu đã thanh toán với mã tham chiếu rõ ràng.',
  staffPayrollRowCallout:
    'Kỳ lương này đã được duyệt và đang chờ kế toán xác nhận rằng tiền đã thực sự được chi.',
  staffPayrollMarkPaidCallout:
    'Form này lưu dấu vết thanh toán bằng mã chứng từ hoặc mã giao dịch để phục vụ đối chiếu sau này.',
  staffPayrollPaidCallout:
    'Sau khi xác nhận, kế toán kiểm tra lại ngay trên bảng để thấy trạng thái đã chuyển sang đã thanh toán.',

  expensesSceneNarration:
    'Luồng expenses gồm ba bước rõ ràng: tạo phiếu chi, duyệt phiếu, rồi đánh dấu đã chi kèm phương thức thanh toán. Đây là phần kế toán dùng rất thường xuyên trong ngày.',
  expensesSceneTitle: 'Chặng 6. Tạo, Duyệt Và Ghi Nhận Phiếu Chi',
  expensesSceneDescription:
    'Mục tiêu là mô tả trọn vòng đời một phiếu chi từ lúc tạo đến lúc đã chi tiền thực tế.',
  expensesSceneBullets: [
    'Tạo phiếu chi mới.',
    'Duyệt phiếu chi.',
    'Đánh dấu đã chi với phương thức thanh toán.',
  ],
  expensesNarration:
    'Trong expenses, kế toán tạo phiếu chi với đủ tiêu đề, số tiền, ngày chi và nhóm chi phí. Sau khi phiếu lên trạng thái chờ duyệt, kế toán thực hiện duyệt phiếu rồi mới chuyển sang bước đánh dấu đã chi. Bước cuối luôn cần phương thức thanh toán và ghi chú để bảo toàn dấu vết tài chính.',
  expensesLabel:
    'Chặng 6. Tạo phiếu chi, duyệt phiếu rồi ghi nhận đã chi theo đúng vòng đời nghiệp vụ.',
  expensesCreatedCallout:
    'Phiếu chi mới tạo xong sẽ lên trạng thái chờ duyệt để tránh bỏ qua bước kiểm soát.',
  expensesPayModalCallout:
    'Ở bước đã chi, kế toán phải lưu phương thức thanh toán và ghi chú thanh toán thực tế.',
  expensesPaidCallout:
    'Sau khi ghi nhận đã chi, kế toán kiểm tra lại đúng phiếu đó đã đổi trạng thái trên bảng.',

  loansSceneNarration:
    'Ở module loans, kế toán theo dõi tổng nợ theo từng kỳ, cập nhật các kỳ quá hạn, mở lịch trả nợ rồi ghi nhận thanh toán từng kỳ để lịch sử và dư nợ cập nhật ngay.',
  loansSceneTitle: 'Chặng 7. Theo Dõi Và Thanh Toán Khoản Vay',
  loansSceneDescription:
    'Mục tiêu là giúp người xem hiểu kế toán quản lý nợ vay theo từng kỳ, không chỉ nhìn tổng dư nợ.',
  loansSceneBullets: [
    'Cập nhật các kỳ quá hạn.',
    'Mở lịch trả nợ của khoản vay.',
    'Ghi nhận thanh toán một kỳ cụ thể.',
  ],
  loansNarration:
    'Trong loans, nút cập nhật quá hạn giúp hệ thống rà soát các kỳ đến hạn để cảnh báo đúng. Sau đó kế toán mở lịch trả nợ của một khoản vay, đọc rõ kỳ nào đã trả, kỳ nào quá hạn và kỳ nào sắp đến hạn. Khi ghi nhận thanh toán một kỳ, lịch sử và dư nợ sẽ cập nhật ngay để tránh lệch số liệu.',
  loansLabel:
    'Chặng 7. Cập nhật kỳ quá hạn, đọc lịch trả nợ rồi ghi nhận thanh toán từng kỳ.',
  loansOverdueRunCallout:
    'Bước này rà soát các kỳ đến hạn để đưa đúng cảnh báo vào hệ thống trước khi kế toán xử lý tiếp.',
  loansRowCallout:
    'Danh sách khoản vay cho thấy bên cho vay, dư nợ còn lại và thao tác mở lịch trả nợ.',
  loansPaymentCallout:
    'Kỳ quá hạn hoặc đến hạn có thể được mở form để kế toán ghi nhận thanh toán trực tiếp.',
  loansHistoryCallout:
    'Lịch sử thanh toán là nơi kế toán xác nhận kỳ vừa trả đã được ghi nhận thật sự.',

  financialControlSceneNarration:
    'Sau các màn hình tác nghiệp là financial control. Đây là nơi kế toán nhìn toàn cảnh tiền mặt, cảnh báo, ngân hàng, quỹ, dòng tiền, P và L và đối soát trước khi chốt báo cáo.',
  financialControlSceneTitle: 'Chặng 8. Kiểm Soát Tài Chính Tổng Thể',
  financialControlSceneDescription:
    'Mục tiêu là nối các tab tài chính thành một câu chuyện liền mạch: tổng quan, cảnh báo, thao tác chi tiết rồi đối soát cuối cùng.',
  financialControlSceneBullets: [
    'Đọc tổng quan tiền mặt và cảnh báo.',
    'Ghi nhận giao dịch ngân hàng và quỹ.',
    'Đi qua cash flow, P&L và reconciliation.',
  ],
  financialOverviewNarration:
    'Ở financial control, kế toán bắt đầu từ tổng quan để đọc số dư ngân hàng, quỹ, nghĩa vụ phải trả và vị thế nợ vay trong cùng một nơi. Tiếp theo là tab cảnh báo để biết quỹ nào đang thấp, giao dịch nào chưa đối soát hoặc kỳ vay nào đã quá hạn trước khi đi sâu vào thao tác chi tiết.',
  bankAndFundsNarration:
    'Sau phần tổng quan, kế toán đi vào chi tiết ngân hàng và quỹ. Mỗi giao dịch mới đều phải có mô tả, ngày phát sinh và tham chiếu rõ ràng. Sau khi ghi nhận, kế toán đối soát giao dịch để giảm số mục chưa reconcile, rồi cập nhật thêm các giao dịch nạp hoặc rút quỹ trước khi đọc cash flow, P và L và tab reconciliation tổng hợp.',
  financialControlLabel:
    'Chặng 8. Đọc tổng quan tài chính rồi đi sâu vào ngân hàng, quỹ, cash flow, P&L và đối soát.',
  financialOverviewCallout:
    'Dashboard tài chính cho thấy tiền ngân hàng, quỹ, nghĩa vụ phải trả và vị thế nợ vay trong cùng một màn hình.',
  financialAlertCallout:
    'Các cảnh báo tài chính giúp kế toán biết ngay quỹ nào thấp, giao dịch nào chưa đối soát hoặc kỳ vay nào quá hạn.',
  financialBankCallout:
    'Chọn đúng tài khoản ngân hàng đang thao tác để ghi nhận và đối soát giao dịch đúng nguồn tiền.',
  financialUnreconciledCallout:
    'Giao dịch mới tạo xong vẫn ở trạng thái chưa đối soát cho tới khi kế toán xác nhận reconciliation.',
  financialFundCallout:
    'Quỹ marketing đang dưới ngưỡng nên kế toán cần ghi nhận nạp quỹ để bảo đảm ngân sách vận hành.',
  financialReconciliationCallout:
    'Tab đối soát là màn chốt tổng hợp số dư ngân hàng, quỹ, ví phụ huynh, nợ vay và các mục chưa reconcile.',

  exportsSceneNarration:
    'Cuối cùng là export reports. Kế toán có thể tải CSV cho payroll, hóa đơn, sổ cái tài chính và các báo cáo đối soát để phục vụ phân tích hoặc gửi nội bộ.',
  exportsSceneTitle: 'Chặng 9. Xuất Báo Cáo CSV',
  exportsSceneDescription:
    'Mục tiêu là kết lại luồng kế toán bằng đầu ra báo cáo phục vụ đối soát và báo cáo cuối ngày.',
  exportsSceneBullets: [
    'Chọn khoảng thời gian cần xuất.',
    'Xuất CSV payroll.',
    'Xuất tiếp CSV tài chính hoặc đối soát.',
  ],
  exportsNarration:
    'Ở export reports, kế toán chọn khoảng ngày phù hợp rồi xuất các gói CSV khác nhau như payroll và tài chính. Đây là đầu ra dùng cho đối soát cuối ngày, gửi báo cáo nội bộ hoặc lưu bằng chứng rằng dữ liệu đã được chốt đúng kỳ.',
  exportsLabel:
    'Chặng 9. Xuất CSV cho payroll và tài chính để phục vụ đối soát và báo cáo cuối ngày.',
  exportsCardCallout:
    'Cùng một màn hình, kế toán có thể tải nhiều gói CSV khác nhau tùy nhu cầu đối soát và báo cáo.',

  logoutSceneNarration:
    'Sau khi hoàn thành toàn bộ các luồng chính, kế toán đăng xuất để kết thúc phiên làm việc và trả hệ thống về màn hình đăng nhập.',
  logoutSceneTitle: 'Chặng 10. Đăng Xuất',
  logoutSceneDescription:
    'Mục tiêu là đóng phiên thao tác an toàn sau khi đã xử lý xong các nghiệp vụ tài chính chính trong ngày.',
  logoutSceneBullets: [
    'Quay về màn hình chính.',
    'Bấm đăng xuất ở sidebar.',
    'Xác nhận hệ thống quay về trang login.',
  ],
  logoutNarration:
    'Sau khi đã kiểm tra xong wallets, hóa đơn, payroll, chi phí, khoản vay và báo cáo, kế toán đăng xuất để kết thúc phiên làm việc. Khi hệ thống quay về màn hình đăng nhập, toàn bộ chuỗi thao tác chính của role kế toán được xem là hoàn tất.',
  logoutLabel:
    'Chặng 10. Đăng xuất để kết thúc phiên kế toán sau khi đã hoàn thành toàn bộ các luồng chính.',
  logoutCallout:
    'Đăng xuất giúp kết thúc đúng phiên thao tác và tránh nhầm tài khoản khi bàn giao máy cho người khác.',

  outroNarration:
    'Như vậy chúng ta vừa đi qua toàn bộ luồng chính của kế toán, từ dashboard, wallets, invoices, payroll, expenses và loans cho tới financial control, export reports và đăng xuất. Video này có thể dùng cho onboarding, đào tạo thao tác hoặc nghiệm thu giao diện kế toán theo đúng nghiệp vụ.',
  outroTitle: 'Hoàn Tất Walkthrough Kế Toán',
  outroDescription:
    'Video đã đi trọn chuỗi thao tác chính của kế toán với format có sơ đồ luồng, scene briefing, thao tác thật và thuyết minh tiếng Việt.',
  outroBullets: [
    'Có roadmap tổng thể trước khi vào từng màn hình.',
    'Có giải thích rõ ý nghĩa của từng chặng tài chính.',
    'Có thể dùng lại cho đào tạo nội bộ hoặc demo hệ thống.',
  ],
} as const;
