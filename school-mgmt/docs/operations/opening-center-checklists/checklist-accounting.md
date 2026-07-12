# Checklist Accounting / Kế toán

## Điều hướng nhanh

- [Tổng hợp link mở trung tâm](../tong-hop-link-mo-trung-tam.md)
- [Checklist master mở trung tâm](../checklist-opening-center-detailed.md)
- [Hub checklist theo đối tượng](./README.md)
- [Sổ tay Accounting / Kế toán](../opening-center-handbooks/so-tay-accounting.md)

## 1. Vai trò và kiểm soát bắt buộc

- [ ] Kế toán là chủ luồng `Invoices`, `Wallets`, `Financial Control`, `Bank Reconciliation`, `Expenses`, `Payroll`, `Aging Report`.
- [ ] Phải phân biệt rõ doanh thu vận hành, góp vốn và khoản vay; không tự ý đổi bản chất dòng tiền khi chưa có phê duyệt.
- [ ] Chỉ duyệt hóa đơn hoặc top-up khi có chứng từ hợp lệ, số tiền khớp, ngày giao dịch rõ và nguồn tiền xác định được.
- [ ] Là người ghi nhận giao dịch ngân hàng trong ngày và đánh dấu reconcile sau khi đối chiếu đủ bằng chứng.

## 2. Chuẩn bị trước khai trương

- [ ] Chốt tài khoản ngân hàng, quỹ tiền mặt, ví phụ huynh, danh mục chi phí, nhóm chi phí, nguồn vay và hạn mức quỹ.
- [ ] Kiểm tra mẫu invoice, phương thức thanh toán, quy tắc ghi chú giao dịch và yêu cầu upload chứng từ.
- [ ] Thiết lập cấu hình lương Sale, giáo viên trải nghiệm, giáo viên giảng dạy và lương nhân sự nội bộ; khóa ngày trả lương là ngày `10` hằng tháng cho dữ liệu tháng trước.
- [ ] Khóa rule tài chính cho Lumira: nghỉ có phép không mất tiền, nghỉ không phép mất tiền, chuyển lớp và hoàn tiền theo số buổi còn lại.
- [ ] Chốt logic đối soát cuối ngày: ai kiểm tra hóa đơn chờ duyệt, ai đối chiếu top-up ví, ai review bút toán chưa reconcile.

## 3. Dry-run tài chính và kiểm soát

- [ ] Chạy thử top-up ví, mở ledger, kiểm tra số dư trước sau đúng.
- [ ] Chạy thử `Invoices` với case chờ duyệt, có chứng từ, cần trả lại và xem `Aging Report`.
- [ ] Chạy thử `Payroll` giáo viên, `Staff Payroll`, `Work Sessions` và điều kiện chặn do thiếu attendance/report; xác nhận đúng công thức lương Sale và giáo viên Lumira.
- [ ] Chạy thử `Financial Control`, tạo giao dịch ngân hàng, đối soát, tạo phiếu chi, đánh dấu đã chi, ghi nhận trả nợ trong `Loans` nếu có dùng.
- [ ] Chạy thử `Export Reports` để xác nhận file CSV cho payroll, tài chính và đối soát.

## 4. Checklist ngày trước khai trương và 3 ngày đầu

- [ ] Trước ngày khai trương, chốt quy trình nhận tiền trong ngày đầu: ai nhận, ai nhập, ai duyệt, ai kiểm tra cuối ngày.
- [ ] Trước giờ mở cửa, mở `Invoices`, `Wallets`, `Financial Control` để sẵn sàng duyệt và ghi nhận phát sinh.
- [ ] Trong giờ hoạt động, mọi khoản tiền nhận trong ngày phải có dấu vết chứng từ, hóa đơn hoặc top-up ví.
- [ ] Cuối ngày review hóa đơn chờ duyệt, top-up chờ duyệt, khoản chưa reconcile và lập danh sách việc tài chính chuyển sang ngày sau.

## 5. Vận hành hằng ngày và cuối kỳ

- [ ] Rà `Invoices`, `Wallets`, `Financial Control` ít nhất 2 lần/ngày trong tháng đầu.
- [ ] Theo dõi các buổi payroll bị chặn để nhắc OPS hoặc giáo viên bổ sung dữ liệu kịp kỳ lương.
- [ ] Cuối ngày phải biết rõ doanh thu ghi nhận, số tiền chờ duyệt, số tiền đã vào ví, số mục chưa đối soát.
- [ ] Hằng tuần review hóa đơn chờ duyệt, công nợ quá hạn, giao dịch chưa đối soát, top-up treo và phiếu chi chờ xử lý.
- [ ] Hằng tháng chốt P&L, payroll, đối soát công nợ, báo cáo quản trị và báo cáo cổ đông theo lịch; chốt lương vào cuối tháng và bảo đảm chi trả ngày `10` tháng sau.