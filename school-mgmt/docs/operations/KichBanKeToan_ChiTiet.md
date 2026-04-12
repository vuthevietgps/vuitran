# Kịch Bản Kế Toán Chi Tiết

Tài liệu này tổng hợp toàn bộ các luồng kế toán đang được mô phỏng và quay video trong hệ thống ở thời điểm rà soát ngày 2026-04-12. Phạm vi ưu tiên là những màn hình và nghiệp vụ mà kế toán dùng trực tiếp trong ngày để đối chiếu tiền, chứng từ, công nợ, chi phí, vốn vay và báo cáo xuất file.

## 1. Phạm vi vai trò Kế toán hiện tại

- Đọc `Dashboard Kế toán` để nắm top-up chờ duyệt, hóa đơn chờ duyệt, đầu việc ưu tiên trong ngày.
- Xử lý `Wallets`: duyệt top-up, đọc ledger, kiểm tra số dư ví và validation khi điều chỉnh.
- Xử lý `Invoices`: lọc hóa đơn chờ duyệt, đối chiếu chứng từ, duyệt hóa đơn.
- Xử lý `Payroll`: xem preview lương giáo viên, đọc phiên đủ điều kiện và gửi bảng lương sang bước duyệt.
- Xử lý `Staff Payroll`: mở chi tiết lương nhân sự nội bộ, kiểm tra cấu phần và đánh dấu đã thanh toán.
- Xử lý `Expenses`: tạo phiếu chi, duyệt phiếu chi, đánh dấu đã chi theo phương thức thanh toán thực tế.
- Xử lý `Loans`: cập nhật kỳ quá hạn, mở lịch trả nợ, ghi nhận thanh toán từng kỳ.
- Xử lý `Financial Control`: xem tổng quan tiền mặt, cảnh báo, ngân hàng, quỹ, dòng tiền, P&L và đối soát.
- Xử lý `Export Reports`: xuất CSV cho payroll, hóa đơn, tài chính và các gói báo cáo đối soát.

## 2. Quy ước quay video

- `Caption`: câu mô tả ngắn xuất hiện phía dưới video.
- `Khoanh đỏ`: callout đỏ đánh dấu vùng thao tác chính trên màn hình.
- `Lồng tiếng`: giọng AI tiếng Việt giải thích mục tiêu của từng bước và nhấn mạnh điểm cần lưu ý.
- `Actor`: vai trò trực tiếp thao tác trong cảnh.
- `Kết quả mong đợi`: trạng thái mà người xem cần xác nhận sau khi thao tác xong.

## 3. Danh sách đầy đủ các tình huống và luồng kế toán

| Mã | Nhóm | Actor | Màn hình | Tình huống | Kết quả mong đợi |
| --- | --- | --- | --- | --- | --- |
| A01 | Daily start | Kế toán | `/app/dashboard` | Đọc dashboard đầu ngày | Biết ngay top-up, hóa đơn và việc tài chính cần ưu tiên |
| A02 | Wallets | Kế toán | `/app/wallets` | Duyệt top-up ví phụ huynh | Số dư ví tăng đúng, yêu cầu rời danh sách chờ |
| A03 | Wallets | Kế toán | `/app/wallets` | Kiểm tra ledger sau duyệt | Ledger có bút toán mới, số dư trước và sau khớp |
| A04 | Wallets | Kế toán | `/app/wallets` | Kiểm tra validation khi điều chỉnh ví | Hệ thống chặn thao tác sai và giải thích rõ lý do |
| A05 | Invoices | Kế toán | `/app/invoices` | Lọc hóa đơn chờ duyệt | Tìm đúng hóa đơn cần kiểm tra trong ngày |
| A06 | Invoices | Kế toán | `/app/invoices` | Duyệt hóa đơn có chứng từ | Hóa đơn chuyển sang `APPROVED` kèm ảnh xác nhận |
| A07 | Teacher payroll | Kế toán | `/app/payroll` | Xem preview lương giáo viên | Biết buổi nào đủ điều kiện, buổi nào còn bị chặn |
| A08 | Teacher payroll | Kế toán | `/app/payroll` | Gửi bảng lương giáo viên đi duyệt | Kỳ lương chuyển sang `PENDING_REVIEW` |
| A09 | Staff payroll | Kế toán | `/app/staff-payroll` | Mở chi tiết lương nhân sự nội bộ | Kiểm tra rõ lương cơ bản, KPI, khấu trừ, thưởng phạt |
| A10 | Staff payroll | Kế toán | `/app/staff-payroll` | Đánh dấu đã thanh toán lương nội bộ | Trạng thái lương chuyển sang `PAID`, có mã tham chiếu |
| A11 | Expenses | Kế toán | `/app/expenses` | Tạo phiếu chi mới | Phiếu chi lên trạng thái chờ duyệt |
| A12 | Expenses | Kế toán | `/app/expenses` | Duyệt phiếu chi | Phiếu chi chuyển sang `APPROVED_UNPAID` |
| A13 | Expenses | Kế toán | `/app/expenses` | Đánh dấu đã chi | Phiếu chi chuyển sang `PAID`, lưu phương thức và ghi chú |
| A14 | Loans | Kế toán | `/app/loans` | Cập nhật các kỳ quá hạn | Kỳ đến hạn cũ chuyển sang `OVERDUE` để cảnh báo đúng |
| A15 | Loans | Kế toán | `/app/loans` | Mở lịch trả nợ và đọc dư nợ | Biết rõ kỳ nào đã trả, chưa trả, quá hạn |
| A16 | Loans | Kế toán | `/app/loans` | Ghi nhận thanh toán một kỳ vay | Lịch sử trả nợ tăng thêm và dư nợ giảm ngay |
| A17 | Financial control | Kế toán | `/app/financial-control` | Xem dashboard tài chính tổng quan | Nhìn được tiền ngân hàng, quỹ, nghĩa vụ, runway và cảnh báo |
| A18 | Financial control | Kế toán | `/app/financial-control` | Xem lợi nhuận gộp tạm tính | Hiểu bức tranh dòng vào, doanh thu tạm tính và biên gộp |
| A19 | Financial control | Kế toán | `/app/financial-control` | Đọc tab cảnh báo | Biết quỹ nào dưới ngưỡng, giao dịch nào chưa đối soát, kỳ vay nào quá hạn |
| A20 | Financial control | Kế toán | `/app/financial-control` | Ghi nhận giao dịch ngân hàng | Giao dịch mới xuất hiện đúng tài khoản và trạng thái chưa đối soát |
| A21 | Financial control | Kế toán | `/app/financial-control` | Đối soát giao dịch ngân hàng | Giao dịch chuyển sang đã đối soát, giảm rủi ro lệch số |
| A22 | Financial control | Kế toán | `/app/financial-control` | Nạp hoặc rút quỹ | Quỹ cập nhật số dư đúng và giữ được lịch sử giao dịch |
| A23 | Financial control | Kế toán | `/app/financial-control` | Xem dòng tiền | Đọc được tổng inflow, outflow và net cash flow theo kỳ |
| A24 | Financial control | Kế toán | `/app/financial-control` | Xem P&L | Đối chiếu doanh thu, giá vốn, chi phí và lợi nhuận ròng |
| A25 | Financial control | Kế toán | `/app/financial-control` | Xem đối soát tài chính | Có một màn tổng hợp số dư NH, quỹ, ví phụ huynh, nợ vay và mục chưa reconcile |
| A26 | Export | Kế toán | `/app/export-reports` | Xuất CSV payroll | Có file CSV phục vụ đối soát hoặc gửi nội bộ |
| A27 | Export | Kế toán | `/app/export-reports` | Xuất CSV tài chính | Có file CSV phục vụ báo cáo cuối ngày hoặc cuối kỳ |

## 4. Kịch bản chi tiết để quay video

### A01. Đọc dashboard kế toán đầu ngày

- Mục tiêu: xác định ngay việc tài chính cần xử lý trước.
- Actor: Kế toán.
- Các bước:
  1. Đăng nhập bằng tài khoản kế toán.
  2. Mở `Dashboard Kế toán`.
  3. Đọc nhanh các thẻ top-up chờ duyệt, hóa đơn chờ duyệt và đầu việc trong ngày.
  4. Chỉ ra từ dashboard có thể quyết định nên vào ví, hóa đơn hay payroll trước.
- Caption: "Kế toán bắt đầu từ dashboard để biết việc nào cần xử lý ngay."
- Khoanh đỏ:
  - khối KPI chính
  - danh sách đầu việc trong ngày
- Lồng tiếng cần nhấn:
  - dashboard không thay thế màn chi tiết, nhưng là nơi chốt thứ tự ưu tiên

### A02-A04. Luồng ví: duyệt top-up, kiểm tra ledger, kiểm tra validation

- Mục tiêu: chứng minh kế toán không chỉ bấm duyệt mà còn phải đối chiếu hậu kiểm.
- Actor: Kế toán.
- Các bước:
  1. Mở `Wallets`.
  2. Lọc hoặc chọn yêu cầu top-up đang `PENDING`.
  3. Mở ảnh/chứng từ và bấm duyệt.
  4. Quan sát số dư ví tăng lên đúng số tiền nạp.
  5. Chuyển sang phần ledger để xem bút toán mới, số dư trước và sau.
  6. Mở thao tác điều chỉnh ví với dữ liệu sai để cho người xem thấy validation bảo vệ số dư.
- Caption: "Ví luôn đi theo cặp thao tác và đối chiếu: duyệt trước, kiểm tra ledger sau."
- Khoanh đỏ:
  - nút duyệt top-up
  - bảng ledger
  - ô thông báo validation khi điều chỉnh sai
- Nhánh xử lý cần giải thích:
  - nếu thiếu chứng từ thì chưa duyệt
  - nếu số dư sau duyệt không khớp ledger thì phải dừng để kiểm tra

### A05-A06. Luồng hóa đơn: lọc chờ duyệt, kiểm tra chứng từ, duyệt

- Mục tiêu: mô tả cách kế toán chốt dòng tiền vào từ hóa đơn.
- Actor: Kế toán.
- Các bước:
  1. Mở `Invoices`.
  2. Lọc trạng thái `PENDING_APPROVAL`.
  3. Mở hóa đơn cần xử lý.
  4. Kiểm tra số tiền, người nộp, hình thức thanh toán và ảnh xác nhận.
  5. Bấm duyệt hóa đơn.
  6. Xác nhận trạng thái chuyển sang `APPROVED`.
- Caption: "Hóa đơn chỉ được duyệt khi tiền, chứng từ và trạng thái khớp nhau."
- Khoanh đỏ:
  - bộ lọc trạng thái
  - hàng hóa đơn đang thao tác
  - nút duyệt và trạng thái sau duyệt
- Nhánh xử lý cần giải thích:
  - sai tiền hoặc thiếu biên lai thì trả lại
  - duyệt xong phải kiểm tra trạng thái thay đổi thực sự trên bảng

### A07-A08. Luồng payroll giáo viên: xem preview rồi gửi duyệt

- Mục tiêu: giải thích vì sao kế toán phải đọc đầu vào trước khi chốt bảng lương.
- Actor: Kế toán.
- Các bước:
  1. Mở `Payroll`.
  2. Chọn kỳ cần xem.
  3. Đọc phần preview để thấy buổi đủ điều kiện và buổi đang bị chặn.
  4. Giải thích lý do chặn thường đến từ attendance hoặc teaching report.
  5. Khi dữ liệu đủ sạch, bấm gửi bảng lương đi duyệt.
  6. Xác nhận kỳ lương lên `PENDING_REVIEW`.
- Caption: "Không chốt lương giáo viên từ số cuối cùng; luôn đọc preview trước."
- Khoanh đỏ:
  - bảng preview
  - cột trạng thái từng buổi
  - nút gửi duyệt
- Nhánh xử lý cần giải thích:
  - buổi bị thiếu báo cáo dạy phải quay lại nguồn dữ liệu, không sửa tắt ở payroll

### A09-A10. Luồng lương nhân sự nội bộ: mở chi tiết và đánh dấu đã thanh toán

- Mục tiêu: cho thấy kế toán cần kiểm tra cấu phần lương trước khi xác nhận tiền ra.
- Actor: Kế toán.
- Các bước:
  1. Mở `Staff Payroll`.
  2. Chọn một kỳ lương đã được duyệt.
  3. Mở chi tiết để xem lương cơ bản, KPI, phụ cấp, khấu trừ, phạt.
  4. Nhấn `Đã thanh toán`.
  5. Nhập mã tham chiếu thanh toán và ghi chú.
  6. Xác nhận trạng thái đổi sang `PAID`.
- Caption: "Lương nội bộ cần đủ chứng từ trước khi đánh dấu đã thanh toán."
- Khoanh đỏ:
  - nút xem chi tiết
  - modal hoặc panel chi tiết
  - nút đánh dấu đã thanh toán

### A11-A13. Luồng chi phí: tạo phiếu, duyệt phiếu, đánh dấu đã chi

- Mục tiêu: mô tả trọn vòng đời một phiếu chi.
- Actor: Kế toán.
- Các bước:
  1. Mở `Expenses`.
  2. Nhấn `+ Tạo phiếu chi`.
  3. Nhập tiêu đề, mô tả, số tiền, ngày chi, nhóm chi phí và ghi chú.
  4. Lưu phiếu để đưa về trạng thái `PENDING_APPROVAL`.
  5. Thực hiện duyệt phiếu.
  6. Sau khi phiếu chuyển `APPROVED_UNPAID`, mở thao tác `Đã chi`.
  7. Chọn phương thức chi, ngày chi và ghi chú thanh toán.
  8. Xác nhận phiếu chuyển `PAID`.
- Caption: "Chi phí khác luôn đi qua ba bước rõ ràng: tạo, duyệt, xác nhận đã chi."
- Khoanh đỏ:
  - nút tạo phiếu
  - hàng phiếu mới tạo
  - trạng thái sau duyệt và sau thanh toán
- Nhánh xử lý cần giải thích:
  - chưa duyệt thì không được đánh dấu đã chi
  - đã chi phải lưu kèm phương thức và ghi chú

### A14-A16. Luồng vốn vay: cập nhật quá hạn, đọc lịch trả nợ, ghi nhận thanh toán

- Mục tiêu: giúp người xem hiểu kế toán quản lý nợ vay theo từng kỳ, không chỉ theo tổng số nợ.
- Actor: Kế toán.
- Các bước:
  1. Mở `Loans`.
  2. Nhấn `Cập nhật quá hạn` để hệ thống rà các kỳ đã đến hạn.
  3. Quan sát các kỳ quá hạn được đánh dấu.
  4. Chuyển sang tab danh sách khoản vay.
  5. Mở `Lịch trả nợ` của một khoản vay.
  6. Chọn một kỳ đang quá hạn hoặc đến hạn.
  7. Ghi nhận thanh toán với phương thức, mã tham chiếu và ghi chú.
  8. Chuyển sang lịch sử thanh toán để xác nhận kỳ vừa trả đã xuất hiện.
- Caption: "Vốn vay phải theo dõi theo từng kỳ để cảnh báo và dư nợ luôn đúng."
- Khoanh đỏ:
  - nút cập nhật quá hạn
  - dòng kỳ vay quá hạn
  - form ghi nhận thanh toán
- Nhánh xử lý cần giải thích:
  - quá hạn không phải chỉ để hiển thị đỏ, mà để buộc quy trình theo dõi và nhắc trả

### A17-A25. Luồng kiểm soát tài chính: tổng quan, cảnh báo, ngân hàng, quỹ, dòng tiền, P&L, đối soát

- Mục tiêu: gom toàn bộ góc nhìn quản trị tài chính vào một chuỗi liền mạch.
- Actor: Kế toán.
- Các bước:
  1. Mở `Financial Control`.
  2. Ở `Tổng quan`, đọc số dư ngân hàng, quỹ, tiền khả dụng, nghĩa vụ phải trả, runway và chỉ số kế toán.
  3. Chuyển sang `Lợi nhuận gộp tạm tính` để giải thích dòng vào, doanh thu tạm tính và biên gộp.
  4. Chuyển sang `Cảnh báo` để chỉ ra quỹ dưới ngưỡng, giao dịch chưa đối soát, kỳ vay quá hạn.
  5. Vào `Ngân hàng`, chọn đúng tài khoản và ghi nhận một giao dịch mới.
  6. Từ danh sách giao dịch, bấm đối soát để giảm mục chưa reconcile.
  7. Vào `Quỹ`, chọn quỹ marketing và ghi nhận một lần nạp quỹ.
  8. Vào `Dòng tiền`, giải thích inflow, outflow và net cash flow theo kỳ.
  9. Vào `P&L`, giải thích doanh thu, giá vốn, chi phí và lợi nhuận ròng.
  10. Vào `Đối soát`, chốt lại bức tranh tổng hợp của ngân hàng, quỹ, ví phụ huynh, nợ vay và số mục chưa đối soát.
- Caption: "Financial Control là nơi kế toán nhìn toàn cảnh trước khi kết luận số liệu."
- Khoanh đỏ:
  - thẻ tiền mặt tổng quan
  - thẻ cảnh báo đầu tiên
  - hàng giao dịch ngân hàng vừa ghi nhận
  - thẻ quỹ marketing
  - các thẻ tổng dòng tiền và P&L
  - thẻ `Chưa đối soát`
- Nhánh xử lý cần giải thích:
  - giao dịch mới phải có mô tả và tham chiếu
  - quỹ dưới ngưỡng cần được xử lý trên tab quỹ, không chỉ đọc cảnh báo rồi bỏ qua
  - tab đối soát là màn chốt tổng hợp cuối cùng

### A26-A27. Luồng xuất báo cáo: CSV payroll và CSV tài chính

- Mục tiêu: kết thúc video bằng đầu ra phục vụ báo cáo và đối soát cuối ngày.
- Actor: Kế toán.
- Các bước:
  1. Mở `Export Reports`.
  2. Chọn khoảng ngày cho gói `Payroll`.
  3. Bấm `Xuất CSV` và xác nhận thông báo thành công.
  4. Chọn khoảng ngày cho gói `Tài chính`.
  5. Bấm `Xuất CSV` lần nữa.
  6. Giải thích đây là đầu ra phục vụ phân tích, gửi nội bộ hoặc lưu bằng chứng.
- Caption: "Cuối quy trình là xuất file để đối soát và báo cáo."
- Khoanh đỏ:
  - thẻ xuất payroll
  - thẻ xuất tài chính
  - thông báo thành công

## 5. Điểm nhấn khi viết lời dẫn tiếng Việt

- Nhấn rõ ba ý trong mọi cảnh: đang làm gì, vì sao phải làm, kết quả nào cần kiểm tra sau khi làm xong.
- Với các cảnh liên quan đến tiền, luôn nhắc thêm bước đối chiếu hậu kiểm.
- Với payroll và loans, luôn giải thích nguồn dữ liệu hoặc kỳ thanh toán, không chỉ đọc trạng thái cuối.
- Với `Financial Control`, dùng lời dẫn để nối các tab lại thành một câu chuyện: tổng quan -> cảnh báo -> thao tác chi tiết -> đối soát cuối.

## 6. Đầu ra mong muốn của video kế toán

- Video `.mp4` có caption tiếng Việt ở từng bước.
- Có callout đỏ khoanh đúng vùng thao tác quan trọng.
- Có lồng tiếng AI tiếng Việt theo từng chặng của luồng.
- Có thể dùng lại cho onboarding, kiểm thử giao diện và nghiệm thu UAT nội bộ.
