# Runbook B04 - Leads, Orders, Trial Enrollments

## Mục tiêu batch

Xác minh toàn bộ luồng Lead, Order và Trial trên UI trước khi ghi hình MP4, tập trung vào các điểm dễ sai nghiệp vụ và validation tinh tế.

## Vai trò dùng để test

- `SALE`
- `DIRECTOR`

## Tiền điều kiện và dữ liệu mẫu

- Có sẵn ít nhất 1 lead mới, 1 lead đang gán sale, 1 lead có lịch sử attribution.
- Có sẵn 1 phụ huynh mới tinh chưa có user trong hệ thống.
- Có sẵn 1 học sinh đã tồn tại để thử tạo order từ dữ liệu có sẵn.
- Có sẵn 1 order trả góp.
- Có sẵn 1 order partial payment.
- Có sẵn 1 trial enrollment đang ở trạng thái chờ quyết định.
- Có sẵn dữ liệu hội thoại chatbot để thử tạo order từ conversation.

## Case trọng tâm

- Chuyển giao lead giữa các sale và kiểm tra lịch sử thay đổi.
- Lead detail hiển thị attribution merge theo timeline touchpoints.
- Tạo order với SĐT phụ huynh mới và kiểm tra auto-provision parent/user.
- Order không cho phép Discount lớn hơn Total.
- Order trả góp hiển thị lịch thanh toán và tác động lên Deferred Revenue.
- Partial payment hiển thị số đã thanh toán, số còn thiếu và trạng thái chưa đủ.
- Luồng `trial/teacher-paid-only` giữ lương cho giáo viên nhưng không charge phụ huynh.
- Trial enrollment tạo, sửa, duyệt, từ chối, chuyển đổi hoạt động đúng.

## Chuỗi đối soát bắt buộc sau submit

- Tạo hoặc sửa lead:
  - Mở lại `lead list`
  - Mở `lead detail`
  - Nếu có reassign, mở thêm lịch sử thay đổi owner
- Convert lead sang order:
  - Mở `order draft/detail`
  - Mở lại `lead detail` để đối chiếu nguồn dữ liệu
- Submit order:
  - Mở `order detail`
  - Mở `Pending Approvals`
  - Mở badge hoặc pipeline/list liên quan
- Approve, reject, request more info, cancel order:
  - Mở lại `order detail`
  - Mở `invoice list/detail`
  - Mở `student list/detail`
  - Nếu case tài chính, mở thêm `Deferred Revenue`, `Aging`, wallet hoặc payroll liên quan
- Trial enrollment:
  - Mở lại list trial
  - Mở detail trial
  - Nếu convert thành order, mở tiếp order mới sinh ra

## Checklist bước test mẫu

### Case mẫu: Discount không được lớn hơn Total

1. Mở màn hình Đơn hàng.
2. Chọn tạo đơn mới.
3. Nhập thông tin phụ huynh, học sinh, lớp và gói học.
4. Nhập `Discount` lớn hơn `Total`.
5. Bấm lưu.

Kỳ vọng:

- UI hiển thị validation bằng tiếng Việt.
- Nút lưu bị khóa hoặc submit bị chặn.
- Không tạo đơn sai dữ liệu.

Kết quả thực tế cần ghi:

- Thông báo hiển thị đúng hay sai.
- Nút lưu có bị chặn hay không.
- Có phát sinh data lỗi hay không.

### Case mẫu: Auto-provision phụ huynh mới

1. Mở form Order.
2. Nhập số điện thoại phụ huynh chưa từng tồn tại trong hệ thống.
3. Điền phần còn lại của order.
4. Submit đơn.

Kỳ vọng:

- Order vẫn tạo thành công.
- UI không ép phải sang màn quản lý User để tạo parent trước.
- Nếu có thông báo tạo mới parent/user, nội dung phải rõ ràng.
- Sau submit phải mở `order detail`, `parent/user detail` và `student detail` nếu có liên kết mới.

## Quy ước video và log

- Video bắt buộc định dạng `MP4`.
- Ghi rõ cursor trong video.
- Một video cho một batch, nếu dài quá `40 phút` thì tách file.
- Khuyến nghị tách 2 phần:
  - `UI_B04A_Leads_OrderForm_YYYYMMDD.mp4`
  - `UI_B04B_OrderApproval_SideEffects_YYYYMMDD.mp4`
- Tên gợi ý:
  - `UI_B04_Orders_Trials_YYYYMMDD.mp4`
  - `LOG_B04_Orders_Trials_YYYYMMDD.md`
- Log phải ghi bằng tiếng Việt, có mốc thời gian video cho từng case.

## Tiêu chí PASS/FAIL

PASS khi:

- Discount, installment, partial payment, trial và auto-provision hoạt động đúng như checklist.
- UI hiển thị đúng validation, badge và trạng thái.
- Không sai dữ liệu, không submit lặp, không sai quyền.

FAIL khi:

- Cho submit sai tiền.
- Hiển thị sai trạng thái trial/order.
- Auto-provision không hoạt động hoặc bắt tạo parent trước khi submit.
- Sai text nghiệp vụ hoặc mất dữ liệu.
