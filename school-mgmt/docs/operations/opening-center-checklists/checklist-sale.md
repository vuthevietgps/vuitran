# Checklist Sale / Tư vấn tuyển sinh

## Điều hướng nhanh

- [Tổng hợp link mở trung tâm](../tong-hop-link-mo-trung-tam.md)
- [Checklist master mở trung tâm](../checklist-opening-center-detailed.md)
- [Hub checklist theo đối tượng](./README.md)
- [Sổ tay Sale / Tư vấn tuyển sinh](../opening-center-handbooks/so-tay-sale.md)

## 1. Quy tắc thao tác và quyền hạn

- [ ] Đi đúng luồng `Lead -> Parent -> Student -> Order -> Invoice -> bàn giao xếp lớp`.
- [ ] Chỉ dùng các module được cấp quyền như `Leads`, `Orders`, `Students`, `Conversations`, `Commission Report`, `Sale Hub`; với Lumira không dùng `Trial Enrollments`.
- [ ] Không tự duyệt `Invoices`, không tự bulk tạo `Sessions`, không tự thêm `Bank Account`, không tự xử lý `Financial Control`.
- [ ] Không được tự giảm giá dưới bất kỳ hình thức nào; Sale chỉ bán theo bảng giá Lumira đã khóa.
- [ ] Mọi cuộc gọi, chat, gặp trực tiếp đều phải có contact log và ngày follow-up tiếp theo.
- [ ] Không tạo trùng parent hoặc student; luôn tìm kiếm trước khi tạo mới.

## 2. Chuẩn bị dữ liệu và dry-run trước khai trương

- [ ] Chuẩn hóa form thu thập thông tin phụ huynh, học viên, nhu cầu học, nguồn lead.
- [ ] Xác nhận chính sách gói học Lumira: `20/40/60/100` buổi, `160.000đ / học sinh / buổi`, có thể có ưu đãi cố định `100.000đ / gói` theo bảng giá trung tâm nhưng Sale không được tự xử lý giảm giá.
- [ ] Đào tạo toàn đội dùng `Sale Hub` đúng 5 bước chuẩn.
- [ ] Tạo lead mẫu từ các nguồn chính, test filter, tab follow-up, stale, pool và assignment history.
- [ ] Chạy thử hội thoại chatbot, tiếp quản hội thoại và tạo lead trực tiếp từ `Conversations` nếu trung tâm có dùng.
- [ ] Chạy thử tạo order cho khách mới, khách cũ, case installment, upload chứng từ và các nhánh `NEEDS_INFO`, reject, cancel, approved; xác nhận không có thao tác giảm giá thủ công từ phía Sale.
- [ ] Chạy thử các case `test trải nghiệm` và chốt người chịu trách nhiệm khóa kết quả test để xếp lớp.

## 3. Checklist ngày trước khai trương và 3 ngày đầu

- [ ] Trước ngày khai trương, rà lead nóng, khách hẹn đến trung tâm và owner của từng case.
- [ ] Trước giờ mở cửa, mở `Leads`, `Orders`, `Conversations`, `Notifications` để kiểm tra khách hẹn và lead nóng.
- [ ] Trong giờ hoạt động, mọi khách mới phải đi qua `Leads`; không bỏ qua CRM rồi nhập thẳng order nếu chưa có lý do chính đáng.
- [ ] Cuối ngày review lead follow-up sang ngày mai, khách chưa chốt, khách cần gửi proposal hoặc nhắc lịch `test trải nghiệm`.

## 4. Vận hành hằng ngày

- [ ] Mở `Dashboard Sale` đầu ngày và ghi ra 3 nhóm việc: follow-up hôm nay, lead nóng, order chờ thông tin.
- [ ] Sau khi gửi duyệt order, theo dõi tới khi biết rõ approved, needs info, reject hay cancel.
- [ ] Chỉ gửi cho phụ huynh tài khoản nhận tiền chính thức của công ty.
- [ ] Cuối ngày phải có danh sách lead chuyển sang ngày sau và lead quá hạn phải giải trình lý do.

## 5. KPI và kiểm soát

- [ ] Theo dõi KPI: lead hợp lệ, follow-up đúng hạn, lead sang `test trải nghiệm`, `test trải nghiệm -> order approved/xếp lớp`, doanh thu thực thu, lead stale.
- [ ] Chốt cơ chế lương Sale Lumira là `8.000.000đ / tháng + 3% hoa hồng doanh thu`.
- [ ] Chốt cơ chế clawback hoặc điều chỉnh hoa hồng nếu đơn bị hủy, hoàn tiền hoặc sai dữ liệu đầu vào.
- [ ] Theo dõi 3 cảnh báo cần xử lý ngay: lead quá hạn follow-up, order submitted treo quá SLA, tạo trùng parent/student.