# Kịch Bản Kiểm Thử Dành Cho Giáo Viên

## 1. Mục tiêu

Tài liệu này dùng để QA hoặc UAT vai trò `TEACHER`, bám vào đúng module giáo viên đang có trong hệ thống hiện tại.

## 2. Tiền điều kiện chung

1. Frontend chạy tại `http://localhost:4200`
2. Backend chạy tại `http://localhost:3000`
3. Có tài khoản giáo viên hợp lệ
4. Có dữ liệu lớp, buổi học, ít nhất một học sinh để test attendance/report

## 3. Checklist Kiểm Thử

| ID | Nhóm | Kịch bản | Bước kiểm tra | Kết quả mong đợi |
| --- | --- | --- | --- | --- |
| AUTH-01 | Đăng nhập | Login thành công | Mở trang login, nhập email/mật khẩu đúng, bấm `Đăng nhập` | Chuyển vào `Dashboard`, hiện đúng menu giáo viên |
| AUTH-02 | Đăng nhập | Sai mật khẩu | Nhập sai mật khẩu | Hiện lỗi đăng nhập, không vào hệ thống |
| AUTH-03 | Đăng nhập | Session restore | Login, refresh trang `/app/dashboard` | Vẫn còn phiên đăng nhập |
| AUTH-04 | Đăng xuất | Logout | Bấm `Đăng xuất` | Quay về `/login`, session bị xóa |
| RBAC-01 | Phân quyền | Ẩn menu admin | Login bằng giáo viên | Không thấy `Users`, `Products`, `Invoices`, `Wallets`, `Audit log`, `Ads`, `Financial control` |
| DASH-01 | Dashboard | Widget tổng quan | Mở Dashboard | Thấy số buổi, thu nhập, lớp đang dạy, ticket |
| DASH-02 | Dashboard | Dữ liệu lớp | Dashboard có phần lớp đang dạy | Chỉ hiển thị lớp thuộc giáo viên hiện tại |
| CLASS-01 | Lớp học | Xem danh sách lớp | Mở `Quản lý Lớp học` | Chỉ thấy lớp được phân công hoặc thay thế |
| CLASS-02 | Lớp học | Không có quyền tạo lớp | Mở `Quản lý Lớp học` | Không thấy hoặc không dùng được nút tạo lớp đối với giáo viên |
| SESS-01 | Buổi học | Lọc buổi học | Mở `Buổi học`, thay đổi filter lớp/trạng thái/ngày | Danh sách cập nhật đúng |
| SESS-02 | Buổi học | Hoàn thành buổi dạy | Với session `SCHEDULED`, bấm `Hoàn thành`, nhập nội dung và lưu | Buổi học đổi trạng thái và lưu được dữ liệu |
| SESS-03 | Buổi học | Xem chi tiết | Bấm icon chi tiết của session | Hiển thị đầy đủ lớp, học sinh, giáo viên, ghi chú |
| SESS-04 | Buổi học | Không tạo session | Login role giáo viên | Không thấy nút tạo buổi học |
| ATT-01 | Điểm danh | Tải danh sách theo lớp/ngày | Mở `Điểm danh`, chọn lớp và ngày, bấm `Tải danh sách` | Danh sách học sinh hiện đúng |
| ATT-02 | Điểm danh | Đánh dấu có mặt | Chọn `Có mặt` cho một hoặc nhiều học sinh rồi `Lưu điểm danh` | Backend lưu thành công, reload thấy trạng thái đã lưu |
| ATT-03 | Điểm danh | Tạo link điểm danh | Bấm `Tạo link` cho học sinh | Sinh link hợp lệ, có hạn sử dụng |
| ATT-04 | Điểm danh | Validate thiếu lớp/ngày | Chưa chọn lớp hoặc ngày mà bấm thao tác link | Hệ thống chặn và báo lỗi phù hợp |
| ATT-05 | Điểm danh | Kiểm tra role save | Login bằng giáo viên và lưu điểm danh | Không bị 403, quyền teacher được áp dụng đúng |
| ATTR-01 | BC Điểm danh | Lọc báo cáo điểm danh | Mở `BC Điểm danh`, lọc ngày/lớp | Hiển thị đúng dữ liệu attendance |
| ATTR-02 | BC Điểm danh | Xem ảnh | Click ảnh học sinh hoặc ảnh điểm danh | Mở modal xem ảnh |
| TR-01 | BC Giảng dạy | Tab chưa có báo cáo | Mở `BC Giảng dạy` tab `Chưa có báo cáo` | Hiển thị đúng các session chưa có report |
| TR-02 | BC Giảng dạy | Tab đã có báo cáo | Chuyển tab `Đã có báo cáo` | Hiển thị đúng các session đã nộp |
| TR-03 | BC Giảng dạy | Lọc theo tháng | Đổi giá trị `Tháng` | `Từ ngày` và `Đến ngày` đồng bộ đúng, dữ liệu refresh |
| TR-04 | BC Giảng dạy | Ảnh hưởng payroll | Kiểm tra session có/không có report và mở payroll preview | Session thiếu report không được tính là eligible |
| PAY-01 | Payroll | Preview theo kỳ | Mở `Lương GV`, chọn `Từ ngày`/`Đến ngày`, bấm `Xem` | Số liệu preview hiển thị đúng |
| PAY-02 | Payroll | Chỉ thấy payroll của mình | Mở tab `Bảng lương` bằng giáo viên | Chỉ thấy payroll của giáo viên hiện tại |
| PAY-03 | Payroll | Không có quyền duyệt | Mở bảng lương bằng giáo viên | Không có nút submit/approve/reject/mark paid |
| PROF-01 | Hồ sơ | Xem hồ sơ | Mở `Hồ sơ cá nhân` | Thấy đúng thông tin hồ sơ, lớp, lịch rảnh, ngân hàng |
| PROF-02 | Hồ sơ | Sửa hồ sơ | Bấm `Chỉnh sửa hồ sơ`, sửa một trường, lưu | Dữ liệu lưu thành công và hiển thị lại |
| PROF-03 | Hồ sơ | Validate dữ liệu ngân hàng | Sửa thông tin ngân hàng | Dữ liệu sau lưu không mất định dạng |
| CAL-01 | Lịch dạy | Xem tuần | Mở `Lịch dạy`, ở mode tuần | Hiển thị buổi theo ngày trong tuần |
| CAL-02 | Lịch dạy | Xem tháng | Chuyển sang mode tháng và dùng điều hướng | Hiển thị đúng buổi theo tháng |
| CAL-03 | Lịch dạy | Mở chi tiết buổi | Click một session trong calendar | Hiện chi tiết học sinh, lớp, trạng thái, report |
| SUB-01 | Xin nghỉ | Tạo yêu cầu hợp lệ | Mở `Xin nghỉ/Thay thế`, nhập lớp + từ ngày + đến ngày + lý do | Ticket loại thay thế được tạo |
| SUB-02 | Xin nghỉ | Validate ngày | Nhập `Đến ngày` nhỏ hơn `Từ ngày` | Hiện lỗi validation |
| MAT-01 | Tài liệu | Upload file hợp lệ | Upload PDF/Doc/Image <= 50MB | Tài liệu tạo thành công |
| MAT-02 | Tài liệu | Chỉnh sửa metadata | Sửa title/subject/tags | Dữ liệu cập nhật thành công |
| MAT-03 | Tài liệu | Xóa tài liệu | Bấm xóa và xác nhận | Tài liệu biến mất khỏi list |
| MAT-04 | Tài liệu | Chặn file không hợp lệ | Upload file mime không hỗ trợ hoặc >50MB | Backend trả lỗi phù hợp |
| WS-01 | Chấm công | Ghi nhận login | Login vào hệ thống | Có bản ghi work session hoặc phiên active |
| WS-02 | Chấm công | Ghi nhận logout | Logout khỏi hệ thống | Bản ghi work session có giờ ra |
| WS-03 | Chấm công | Giáo viên chỉ xem | Mở `Chấm công` bằng giáo viên | Không có nút sửa work session |
| TIC-01 | Ticket | Tạo ticket | Mở `Hỗ trợ & Ticket`, tạo ticket mới | Ticket tạo thành công |
| TIC-02 | Ticket | Xem chi tiết ticket | Mở 1 ticket | Xem được mô tả, comment, trạng thái |
| TIC-03 | Ticket | Comment ticket | Gửi phản hồi trong detail | Comment xuất hiện trong luồng trao đổi |
| MSG-01 | Tin nhắn | Tạo hội thoại mới | Mở `Tin nhắn`, chọn người nhận, gửi tin đầu tiên | Hội thoại mới xuất hiện |
| MSG-02 | Tin nhắn | Xem unread | Gửi/nhận message | Badge unread cập nhật đúng |
| NOTI-01 | Thông báo | Badge thông báo | Có notification chưa đọc | Badge hiển thị ở sidebar |

## 4. Kịch bản UAT Đề Xuất

### Kịch bản A. Giáo viên bắt đầu ngày làm việc

1. Login thành công
2. Xem Dashboard
3. Xem lịch dạy
4. Xem lớp đang phụ trách

### Kịch bản B. Giáo viên chuẩn bị và xử lý buổi dạy

1. Mở `Điểm danh`
2. Chọn lớp/ngày
3. Tạo link check-in cho học sinh
4. Lưu điểm danh
5. Mở `Buổi học` và `Hoàn thành`

### Kịch bản C. Giáo viên chốt dữ liệu để nhận lương

1. Mở `BC Giảng dạy`
2. Kiểm tra còn session thiếu report không
3. Mở `Lương GV`
4. Kiểm tra session nào chờ OPS/phụ huynh/report

### Kịch bản D. Giáo viên xin nghỉ hoặc báo sự cố

1. Tạo `Xin nghỉ/Thay thế`
2. Tạo `Ticket`
3. Nhắn `Tin nhắn nội bộ` cho OPS

## 5. Bằng Chứng Nên Thu Khi QA

1. Ảnh `.webp` của từng màn hình chính
2. Video login + dashboard
3. Video attendance + generate link
4. Video teaching report + payroll preview
5. Screenshot lỗi validation
6. Screenshot role restriction/hide menu

## 6. Asset Gợi Ý Dùng Chung Với QA

1. `docs/teacher/assets/10_teacher_login.webp`
2. `docs/teacher/assets/11_teacher_dashboard.webp`
3. `docs/teacher/assets/13_teacher_attendance.webp`
4. `docs/teacher/assets/14_teacher_teaching_report.webp`
5. `docs/teacher/assets/19_teacher_payroll.webp`
6. `docs/teacher/videos/teacher_login_dashboard.webm`
7. `docs/teacher/videos/teacher_attendance_link.webm`
8. `docs/teacher/videos/teacher_report_payroll.webm`
