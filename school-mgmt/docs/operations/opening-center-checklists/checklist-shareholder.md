# Checklist Shareholder / Cổ đông

## Điều hướng nhanh

- [Tổng hợp link mở trung tâm](../tong-hop-link-mo-trung-tam.md)
- [Checklist master mở trung tâm](../checklist-opening-center-detailed.md)
- [Hub checklist theo đối tượng](./README.md)
- [Sổ tay Shareholder / Cổ đông](../opening-center-handbooks/so-tay-shareholder.md)

## 1. Phân loại dòng tiền và phạm vi sử dụng hệ thống

- [ ] Phân biệt rõ `doanh thu vận hành`, `vốn góp cổ phần`, `tiền cho vay/ứng vốn`.
- [ ] Không nhập chung tiền góp vốn với học phí hoặc doanh thu vận hành rồi mới tách tay cuối tháng.
- [ ] Với mỗi khoản tiền vào, xác định ngay bản chất: tiền mua khóa học, tiền góp vốn hay tiền cho vay.
- [ ] Nếu là khoản vay thì đi theo `Loans`; nếu là góp vốn chủ sở hữu thì đi theo quy trình vốn góp riêng.

## 2. Tài khoản cổ đông và quyền xem

- [ ] Tạo user `SHAREHOLDER` cho từng cổ đông thật; mỗi tài khoản có `ownershipPercentage` rõ ràng.
- [ ] Rà tổng tỷ lệ sở hữu để khớp với cơ cấu sở hữu đang được công nhận.
- [ ] Xác nhận cổ đông chỉ dùng để xem `Investor Dashboard`, `Financial Control`, `Aging Report` và báo cáo ẩn danh phù hợp.
- [ ] Kiểm tra dữ liệu cá nhân nhạy cảm đã được ẩn danh đúng trên các báo cáo cần thiết.

## 3. Tài khoản nhận tiền và góp vốn

- [ ] Tạo đầy đủ tài khoản ngân hàng nhận tiền trong `Financial Control -> Bank Accounts`, đánh dấu tài khoản chính bằng `isPrimary`.
- [ ] Tách tài khoản nhận học phí và tài khoản nhận góp vốn/tiền đầu tư nếu có cả hai loại dòng tiền.
- [ ] Thống nhất reference chuẩn cho giao dịch góp vốn, ví dụ `GOP VON - TEN CO DONG - DOT 1`.
- [ ] Sau mỗi đợt góp vốn, rà lại `ownershipPercentage` và cập nhật nếu có thay đổi thực sự về cơ cấu vốn.

## 4. Giới hạn hiện tại của hệ thống

- [ ] Ghi rõ hệ thống hiện chưa phải phần mềm quản trị cap table đầy đủ: chưa có lịch sử chuyển nhượng, phát hành mới, ESOP hay cổ tức.
- [ ] Nếu có nhiều vòng góp vốn hoặc thay đổi tỷ lệ sở hữu, duy trì thêm một cap table master ngoài hệ thống làm nguồn pháp lý chính thức.
- [ ] Không dùng `ownershipPercentage` làm căn cứ pháp lý duy nhất để chia cổ tức hoặc xử lý tranh chấp cổ phần.

## 5. Nhịp minh bạch và báo cáo

- [ ] Chốt lịch gửi báo cáo cổ đông theo tuần hoặc tháng.
- [ ] Chốt bộ chỉ số phải xem định kỳ: tiền mặt, burn rate, runway, doanh thu tháng, lợi nhuận gộp, công nợ phải thu, nợ vay, giao dịch chưa đối soát.
- [ ] Rà lại quyền thực tế trước go-live để bảo đảm cổ đông chỉ xem, không có quyền ghi nhận giao dịch, duyệt invoice, chỉnh payroll hoặc thay đổi quỹ.