# Kịch Bản Video Kế Toán

## Mục tiêu

Tài liệu này là kịch bản thuyết trình cho video role kế toán theo format:

1. giới thiệu mục tiêu video;
2. vẽ và thuyết trình sơ đồ luồng tổng thể;
3. đi lần lượt từng màn hình, từng thao tác có lồng tiếng;
4. kết lại bằng phần tóm tắt để dùng cho onboarding và nghiệm thu.

## Cấu trúc video

### Cảnh 1. Mở đầu

Màn hình:

- title card mở đầu.

Lời dẫn:

> Xin chào. Đây là video walkthrough đầy đủ cho vai trò kế toán. Video sẽ bắt đầu bằng sơ đồ luồng tổng thể, sau đó đi lần lượt qua từng màn hình và từng nghiệp vụ chính mà kế toán dùng để đối chiếu tiền, duyệt chứng từ, theo dõi công nợ, kiểm soát tài chính và xuất báo cáo.

### Cảnh 2. Sơ đồ luồng tổng thể

Màn hình:

- roadmap gồm các chặng:
  `Đăng nhập -> Dashboard kế toán -> Wallets -> Invoices -> Payroll giáo viên -> Staff payroll -> Expenses -> Loans -> Financial control -> Export reports -> Đăng xuất`

Lời dẫn:

> Luồng chuẩn của kế toán bắt đầu từ đăng nhập và đọc dashboard để biết việc nào cần ưu tiên trong ngày. Sau đó kế toán vào wallets để duyệt top-up và đọc ledger, sang invoices để duyệt hóa đơn, sang payroll và staff payroll để kiểm tra lương, tiếp tục xử lý expenses và loans, rồi đi qua financial control để nhìn toàn cảnh tiền mặt, ngân hàng, quỹ và đối soát. Cuối cùng là export reports để tải các báo cáo CSV và đăng xuất để kết thúc phiên làm việc.

## Phần thao tác chi tiết

### Chặng 1. Đăng nhập và đọc dashboard kế toán

Lời dẫn scene:

> Chặng đầu tiên là vào dashboard kế toán để nhìn toàn cảnh. Màn hình này giúp xác định top-up chờ duyệt, hóa đơn chờ duyệt và các đầu việc tài chính cần xử lý ngay trong ngày.

Lời dẫn khi thao tác:

> Trên dashboard kế toán, hệ thống không thay thế các màn hình chi tiết nhưng giúp chốt thứ tự ưu tiên. Kế toán nhìn ngay các mục như top-up chờ duyệt, hóa đơn cần duyệt và các việc tài chính phát sinh để quyết định nên vào ví, hóa đơn hay payroll trước.

Thao tác:

1. Đăng nhập bằng tài khoản kế toán.
2. Mở dashboard.
3. Đọc nhanh khối công việc cần ưu tiên.

### Chặng 2. Duyệt top-up và đối chiếu ví

Lời dẫn scene:

> Sau dashboard là wallets. Đây là luồng duyệt top-up, kiểm tra ledger và kiểm tra validation điều chỉnh ví để đảm bảo mọi biến động số dư đều có dấu vết.

Lời dẫn khi thao tác:

> Trong wallets, kế toán bắt đầu từ danh sách top-up chờ duyệt, kiểm tra đúng phụ huynh, đúng số tiền, đúng biên lai rồi mới xác nhận duyệt. Sau khi duyệt xong, bước bắt buộc tiếp theo là quay về ledger để nhìn đúng dòng bút toán mới sinh ra. Nếu cần điều chỉnh ví, hệ thống luôn yêu cầu lý do audit để tránh mọi thay đổi số dư không rõ nguyên nhân.

Thao tác:

1. Mở danh sách top-up chờ duyệt.
2. Duyệt đúng yêu cầu cần xử lý.
3. Quay lại ledger để kiểm tra bút toán.
4. Mở luồng điều chỉnh ví để xem validation audit.

### Chặng 3. Duyệt hóa đơn

Lời dẫn scene:

> Tiếp theo là invoices. Đây là nơi kế toán lọc các hóa đơn chờ duyệt, đối chiếu chứng từ thanh toán rồi duyệt để tiền vào được ghi nhận đúng trạng thái.

Lời dẫn khi thao tác:

> Ở màn hình invoices, kế toán lọc trạng thái chờ duyệt để chỉ nhìn đúng các hóa đơn cần xử lý. Sau đó kế toán kiểm tra số tiền, học sinh, lớp, hình thức thanh toán và ảnh xác nhận, rồi mới duyệt hóa đơn. Bước cuối là kiểm tra lại bảng để thấy trạng thái đã chuyển sang approved thực sự.

Thao tác:

1. Lọc `PENDING_APPROVAL`.
2. Mở đúng hóa đơn cần xử lý.
3. Tải chứng từ xác nhận duyệt.
4. Duyệt và kiểm tra lại trạng thái.

### Chặng 4. Kiểm tra payroll giáo viên

Lời dẫn scene:

> Sau hóa đơn là payroll giáo viên. Kế toán luôn đọc từ preview trước để biết buổi nào đủ điều kiện tính lương và buổi nào còn bị chặn vì thiếu báo cáo hoặc chờ xác nhận.

Lời dẫn khi thao tác:

> Trong payroll giáo viên, preview là nơi kế toán xác nhận đầu vào của bảng lương. Tại đây kế toán nhìn được buổi đủ điều kiện tính lương, buổi còn chờ teaching report hoặc chờ xác nhận. Chỉ khi dữ liệu đã sạch thì bảng lương draft mới được gửi sang bước pending review.

Thao tác:

1. Chọn đúng kỳ payroll.
2. Đọc preview.
3. Chuyển sang bảng lương.
4. Gửi bảng lương draft đi duyệt.

### Chặng 5. Xử lý lương nhân sự nội bộ

Lời dẫn scene:

> Với staff payroll, kế toán thường mở chi tiết để kiểm tra cấu phần lương, KPI, khấu trừ và chứng từ, rồi mới đánh dấu đã thanh toán khi tiền thực sự ra khỏi tài khoản.

Lời dẫn khi thao tác:

> Ở staff payroll, kế toán không chỉ nhìn trạng thái paid hay unpaid mà còn phải mở chi tiết để xác nhận đủ lương cơ bản, KPI, phụ cấp và khấu trừ. Khi tiền thực sự đã được chi, kế toán nhập mã tham chiếu hoặc mã chứng từ rồi mới đánh dấu đã thanh toán.

Thao tác:

1. Mở dòng lương nhân sự cần xử lý.
2. Xem chi tiết.
3. Đánh dấu đã thanh toán với mã tham chiếu.
4. Kiểm tra lại trạng thái trên bảng.

### Chặng 6. Tạo, duyệt và ghi nhận phiếu chi

Lời dẫn scene:

> Luồng expenses gồm ba bước rõ ràng: tạo phiếu chi, duyệt phiếu, rồi đánh dấu đã chi kèm phương thức thanh toán. Đây là phần kế toán dùng rất thường xuyên trong ngày.

Lời dẫn khi thao tác:

> Trong expenses, kế toán tạo phiếu chi với đủ tiêu đề, số tiền, ngày chi và nhóm chi phí. Sau khi phiếu lên trạng thái chờ duyệt, kế toán thực hiện duyệt phiếu rồi mới chuyển sang bước đánh dấu đã chi. Bước cuối luôn cần phương thức thanh toán và ghi chú để bảo toàn dấu vết tài chính.

Thao tác:

1. Tạo phiếu chi mới.
2. Duyệt phiếu chi.
3. Đánh dấu đã chi.
4. Kiểm tra lại trạng thái sau cùng.

### Chặng 7. Theo dõi và thanh toán khoản vay

Lời dẫn scene:

> Ở module loans, kế toán theo dõi tổng nợ theo từng kỳ, cập nhật các kỳ quá hạn, mở lịch trả nợ rồi ghi nhận thanh toán từng kỳ để lịch sử và dư nợ cập nhật ngay.

Lời dẫn khi thao tác:

> Trong loans, nút cập nhật quá hạn giúp hệ thống rà soát các kỳ đến hạn để cảnh báo đúng. Sau đó kế toán mở lịch trả nợ của một khoản vay, đọc rõ kỳ nào đã trả, kỳ nào quá hạn và kỳ nào sắp đến hạn. Khi ghi nhận thanh toán một kỳ, lịch sử và dư nợ sẽ cập nhật ngay để tránh lệch số liệu.

Thao tác:

1. Cập nhật các kỳ quá hạn.
2. Mở lịch trả nợ.
3. Ghi nhận thanh toán một kỳ.
4. Kiểm tra lịch sử thanh toán.

### Chặng 8. Kiểm soát tài chính tổng thể

Lời dẫn scene:

> Sau các màn hình tác nghiệp là financial control. Đây là nơi kế toán nhìn toàn cảnh tiền mặt, cảnh báo, ngân hàng, quỹ, dòng tiền, P và L và đối soát trước khi chốt báo cáo.

Lời dẫn khi thao tác:

> Ở financial control, kế toán bắt đầu từ tổng quan để đọc số dư ngân hàng, quỹ, nghĩa vụ phải trả và vị thế nợ vay trong cùng một nơi. Tiếp theo là tab cảnh báo để biết quỹ nào đang thấp, giao dịch nào chưa đối soát hoặc kỳ vay nào đã quá hạn trước khi đi sâu vào thao tác chi tiết.

> Sau phần tổng quan, kế toán đi vào chi tiết ngân hàng và quỹ. Mỗi giao dịch mới đều phải có mô tả, ngày phát sinh và tham chiếu rõ ràng. Sau khi ghi nhận, kế toán đối soát giao dịch để giảm số mục chưa reconcile, rồi cập nhật thêm các giao dịch nạp hoặc rút quỹ trước khi đọc cash flow, P và L và tab reconciliation tổng hợp.

Thao tác:

1. Đọc overview.
2. Chuyển qua tab cảnh báo.
3. Ghi nhận giao dịch ngân hàng.
4. Đối soát giao dịch.
5. Ghi nhận nạp quỹ.
6. Đi qua cash flow, P&L và reconciliation.

### Chặng 9. Xuất báo cáo CSV

Lời dẫn scene:

> Cuối cùng là export reports. Kế toán có thể tải CSV cho payroll, hóa đơn, sổ cái tài chính và các báo cáo đối soát để phục vụ phân tích hoặc gửi nội bộ.

Lời dẫn khi thao tác:

> Ở export reports, kế toán chọn khoảng ngày phù hợp rồi xuất các gói CSV khác nhau như payroll và tài chính. Đây là đầu ra dùng cho đối soát cuối ngày, gửi báo cáo nội bộ hoặc lưu bằng chứng rằng dữ liệu đã được chốt đúng kỳ.

Thao tác:

1. Chọn khoảng ngày cho payroll.
2. Xuất CSV payroll.
3. Chọn khoảng ngày cho tài chính.
4. Xuất CSV tài chính.

### Chặng 10. Đăng xuất

Lời dẫn scene:

> Sau khi hoàn thành toàn bộ các luồng chính, kế toán đăng xuất để kết thúc phiên làm việc và trả hệ thống về màn hình đăng nhập.

Lời dẫn khi thao tác:

> Sau khi đã kiểm tra xong wallets, hóa đơn, payroll, chi phí, khoản vay và báo cáo, kế toán đăng xuất để kết thúc phiên làm việc. Khi hệ thống quay về màn hình đăng nhập, toàn bộ chuỗi thao tác chính của role kế toán được xem là hoàn tất.

Thao tác:

1. Quay về màn hình chính.
2. Bấm đăng xuất ở sidebar.
3. Kiểm tra hệ thống quay về login.

## Cảnh kết

Lời dẫn:

> Như vậy chúng ta vừa đi qua toàn bộ luồng chính của kế toán, từ dashboard, wallets, invoices, payroll, expenses và loans cho tới financial control, export reports và đăng xuất. Video này có thể dùng cho onboarding, đào tạo thao tác hoặc nghiệm thu giao diện kế toán theo đúng nghiệp vụ.
