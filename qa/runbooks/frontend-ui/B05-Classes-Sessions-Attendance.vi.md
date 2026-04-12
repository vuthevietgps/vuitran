# Runbook B05 - Classes, Sessions, Attendance

## Mục tiêu batch

Test các luồng lớp học, buổi học và điểm danh với trọng tâm là các cảnh báo, auto state và quyền thao tác trên UI.

## Vai trò dùng để test

- `OPS`
- `TEACHER`
- `PARENT`
- `SALE`

## Tiền điều kiện và dữ liệu mẫu

- Có sẵn 1 lớp Offline.
- Có sẵn 1 lớp có nhiều học sinh và 1 lớp có substitute teacher.
- Có sẵn 1 session có thể reschedule.
- Có sẵn 1 session auto-confirm sau 48h.
- Có sẵn 1 work session có trạng thái `AUTO_CLOSED`.
- Có sẵn 1 phụ huynh đã chạm giới hạn nợ để test cảnh báo Debt Limit Breach.

## Case trọng tâm

- Teacher swap hiển thị đúng giáo viên cũ/mới và cập nhật session detail.
- Co-teaching lớp Offline cho phép chọn nhiều giáo viên và cả hai có quyền thao tác hợp lệ.
- Student Configs cho phép một học sinh có nhiều slot hoặc nhiều giáo viên.
- Pricing snapshot giữ nguyên `amountCharged` của lịch sử.
- Finalize session cảnh báo Debt Limit Breach khi phụ huynh hết tiền.
- Session auto-confirm hiển thị nguồn xác nhận là hệ thống.
- Khi có substitute teacher, UI ẩn/chặn nút điểm danh của giáo viên chính.
- Work session `AUTO_CLOSED` phải hiện rõ trạng thái.
- Nút copy link điểm danh phải copy đúng và phản hồi mượt.

## Chuỗi đối soát bắt buộc sau submit

- Tạo, sửa, xóa lớp hoặc submit class update:
  - Mở lại `class list`
  - Mở `class detail`
  - Nếu qua luồng duyệt, mở `Pending Approvals`
- Teacher swap, reschedule, cancel, remove, finalize session:
  - Mở lại `session detail`
  - Mở lịch lớp
  - Mở lịch giáo viên hoặc lịch phụ huynh để đối chiếu
- Attendance:
  - Mở lại `attendance by class/day`
  - Mở `session detail`
  - Nếu có báo cáo liên quan, mở thêm `attendance report`
- Auto-confirm và substitute teacher:
  - Mở màn của `TEACHER`
  - Mở màn của `PARENT` hoặc `OPS`
  - Đối chiếu cùng một session trước và sau thao tác

## Checklist bước test mẫu

### Case mẫu: Hoàn thành buổi học

1. Mở chi tiết session.
2. Bấm nút `Hoàn thành buổi học`.
3. Kiểm tra form popup.
4. Nhập đủ `Nội dung`, `Bài tập`, `Ghi chú`.
5. Submit form.

Kỳ vọng:

- Form popup mở đúng.
- 3 trường bắt buộc hiển thị rõ.
- Không cho hoàn tất nếu thiếu một trong các trường.
- Sau submit phải mở lại `session detail` và ít nhất 1 màn liên đới như lịch lớp hoặc báo cáo điểm danh.

### Case mẫu: Auto-confirm

1. Mở chi tiết buổi học đã quá 48 giờ.
2. Xem phần lịch sử/trạng thái xác nhận.
3. Đối chiếu tên người xác nhận.

Kỳ vọng:

- UI phải ghi rõ `Xác nhận tự động bởi Hệ thống`.
- Không gắn nhầm tên phụ huynh.

### Case mẫu: Điểm danh và copy link

1. Mở màn hình điểm danh.
2. Copy link điểm danh tự động.
3. Kiểm tra thông báo copy.
4. Thử trạng thái với session có substitute teacher.

Kỳ vọng:

- Copy link thành công.
- Nút điểm danh của giáo viên chính bị ẩn/chặn khi có substitute teacher.

## Quy ước video và log

- Video phải là `MP4` và thấy rõ con trỏ chuột.
- Nên tách video theo cụm `Session`, `Attendance`, `Teacher Swap`.
- Khuyến nghị tách 2 phần:
  - `UI_B05A_Class_Session_Changes_YYYYMMDD.mp4`
  - `UI_B05B_Attendance_Finalize_SideEffects_YYYYMMDD.mp4`
- Tên gợi ý:
  - `UI_B05_Sessions_Attendance_YYYYMMDD.mp4`
  - `LOG_B05_Sessions_Attendance_YYYYMMDD.md`
- Log ghi tiếng Việt, kèm mốc thời gian từng case.

## Tiêu chí PASS/FAIL

PASS khi:

- Session swap, attendance, auto-confirm, auto-closed và copy link hiển thị đúng.
- Validation ngày tháng, quyền và trạng thái được chặn đúng.

FAIL khi:

- Hiển thị sai người xác nhận.
- Cho điểm danh sai role.
- Không hiện cảnh báo Debt Limit Breach.
- Không giữ nguyên lịch sử giá/lương hợp lệ.
