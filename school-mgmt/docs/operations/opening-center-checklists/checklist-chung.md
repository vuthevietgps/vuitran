# Checklist chung khi mở trung tâm

## Điều hướng nhanh

- [Tổng hợp link mở trung tâm](../tong-hop-link-mo-trung-tam.md)
- [Checklist master mở trung tâm](../checklist-opening-center-detailed.md)
- [Hub checklist theo đối tượng](./README.md)
- [Hub sổ tay theo vị trí](../opening-center-handbooks/README.md)

Nguồn gốc: tách từ `../checklist-opening-center-detailed.md` để dùng cho người quản lý dự án hoặc điều phối triển khai tổng.

## 1. Nguyên tắc bắt buộc

- [ ] Chỉ đánh dấu hoàn thành khi đầu việc đã được xử lý trên hệ thống hoặc có bằng chứng rõ ràng.
- [ ] Mỗi đầu việc phải có đúng một người chịu trách nhiệm chính; các vai trò còn lại là phối hợp.
- [ ] Dữ liệu gốc phải được nhập đúng nguồn: parent ở `Users`, student ở `Students`, lớp ở `Classes`, buổi học ở `Sessions`, hóa đơn ở `Invoices`.
- [ ] Không cho đội ngũ tự tạo luồng làm việc ngoài hệ thống nếu hệ thống đã có màn hình tương ứng.
- [ ] Mọi phát sinh liên quan tới lịch, tiền, khiếu nại, hoàn tiền hoặc chờ duyệt phải để lại dấu vết trong `Tickets`, `Notifications`, `Messages` hoặc `Audit Log`.
- [ ] Ngay từ tuần đầu phải có nhịp review cuối ngày và cuối tuần.

## 2. Quyết định phải khóa trước khi nhập dữ liệu

- [ ] Chốt profile Lumira: thương hiệu `lumiraEnglish.com`, lớp online `1 giáo viên - nhiều học sinh`, `1 buổi/tuần`, `2 giờ 15 phút/buổi`, `160.000đ / học sinh / buổi`, không học thử mà dùng `test trải nghiệm` để xếp lớp.
- [ ] Chốt chính sách nghỉ học, công nợ, chuyển lớp và hoàn tiền: nghỉ có phép không mất tiền, nghỉ không phép mất tiền, chuyển lớp và hoàn tiền theo số buổi còn lại.
- [ ] Chốt bảng giá gói `20/40/60/100` buổi và ưu đãi cố định `100.000đ / gói` cho gói nhiều buổi; Sale không được tự giảm giá.
- [ ] Chốt vai trò thao tác trên `Users`, `Students`, `Classes`, `Sessions`, `Orders`, `Invoices`, `Wallets`, `Payroll`, `Expenses`, `Financial Control`.
- [ ] Chốt tuyến duyệt, SLA phê duyệt và nguyên tắc không cấp quyền rộng cho người không chịu trách nhiệm đầu ra.
- [ ] Chốt quy tắc đặt mã lớp, mã đơn, mã gói học, mã học viên, mã phiếu chi và mã chiến dịch.
- [ ] Chốt danh mục nguồn lead, lý do mất lead, lý do đổi lịch, nghỉ học, hủy đơn và trả lại phiếu duyệt.

## 3. Hạ tầng và dữ liệu nền

- [ ] Kiểm tra môi trường chạy thật của backend, frontend, database, uploads, backup, log runtime và quy trình restart.
- [ ] Kiểm tra đăng nhập, đổi mật khẩu, lock/unlock user và cơ chế `Work Sessions`.
- [ ] Xác nhận mọi vai trò nhìn đúng menu, đúng quyền export, đúng quyền xem công nợ, đối soát và dữ liệu ẩn danh.
- [ ] Tạo file tổng hợp tài khoản, vai trò, người sở hữu thật và ngày kích hoạt.
- [ ] Tạo đầy đủ tài khoản thật cho các bộ phận, thiết lập người duyệt thay thế và tập huấn quy trình đăng nhập/đăng xuất.
- [ ] Khai báo đầy đủ gói học, lớp, lịch học, cấu hình tài chính nền và logic đối soát cuối ngày; khóa payroll trả ngày `10` hằng tháng cho dữ liệu tháng trước.

## 4. Dry-run và nghiệm thu chung

- [ ] Tổ chức chạy thử đầy đủ 3 cụm luồng: tuyển sinh, vận hành lớp học, tài chính và kiểm soát.
- [ ] Tổ chức một buổi nghiệm thu nội bộ với Director, OPS, Sale, Accounting và Teacher lead trước khai trương.
- [ ] Chốt danh sách lớp, roster, giáo viên, ca học và pending approvals của 7 ngày đầu.
- [ ] Gửi bản phân công vận hành ngày đầu cho toàn bộ đội ngũ và yêu cầu xác nhận đã đọc.

## 5. Vận hành tuần đầu và nhịp review

- [ ] Mọi khách mới phải đi qua `Leads` trước, mọi học viên vào lớp phải có roster đúng, mọi khoản tiền phải có dấu vết chứng từ.
- [ ] Cuối mỗi ngày phải có review lead mới, order, lớp chạy, sự cố phát sinh, doanh thu ghi nhận và việc chuyển sang ngày sau.
- [ ] Hằng tuần phải review lead, `test trải nghiệm`, tỷ lệ xếp lớp, tỷ lệ lấp đầy lớp, session treo, attendance/report thiếu, ticket quá hạn, công nợ và giao dịch chưa đối soát.
- [ ] Hằng tháng phải review P&L, payroll, commission, tỷ lệ nghỉ học, hiệu quả marketing và `Audit Log` cho thao tác nhạy cảm.
- [ ] Theo dõi hằng ngày các chỉ số cảnh báo: lead stale, order chờ duyệt, invoice chờ duyệt, session chưa finalize, attendance thiếu report, ticket quá hạn, giao dịch chưa đối soát và công nợ tăng.