# Runbook B01: Auth, Session, Routing, App Shell

## Mục tiêu

Kiểm tra toàn bộ luồng đăng nhập, đổi mật khẩu, phục hồi session, điều hướng route, sidebar và RBAC cơ bản. File này dùng để quay MP4 có hiện rõ con trỏ chuột và ghi kết quả hoàn toàn bằng tiếng Việt.

## Vai trò test

- `DIRECTOR`
- `SALE`
- `SHAREHOLDER`

## Tiền điều kiện

- Backend và frontend đều đang chạy ổn định
- Có sẵn ít nhất 3 tài khoản tương ứng 3 vai trò trên
- Đã đăng xuất khỏi ứng dụng trước khi bắt đầu batch
- Có thể truy cập các route nội bộ và route không tồn tại để test redirect

## Case trọng tâm

- Đăng nhập thành công, sai mật khẩu, quá số lần thử
- Đổi mật khẩu thành công và validation lỗi
- Restore session sau refresh
- Route guard khi chưa đăng nhập
- Logout khi API trả `401`
- Redirect `SHAREHOLDER` về `investor-dashboard`
- Menu trái theo role, badge chờ duyệt, sidebar thu gọn/mở rộng
- Loading bar khi chuyển route
- Link active theo route và query param
- Route không tồn tại chuyển về mặc định

## Checklist thao tác mẫu

### Case mẫu: Đổi mật khẩu

1. Mở màn hình đăng nhập và đăng nhập bằng tài khoản hợp lệ.
2. Vào màn hình đổi mật khẩu.
3. Nhập mật khẩu cũ đúng.
4. Nhập mật khẩu mới hợp lệ và xác nhận khớp.
5. Bấm lưu.

Kỳ vọng:

- Hiển thị thông báo thành công bằng tiếng Việt
- Session vẫn ổn định sau thao tác
- Không phát sinh lỗi layout hoặc reload sai trạng thái

### Case mẫu: Route guard

1. Mở trực tiếp một route nội bộ khi chưa đăng nhập.
2. Quan sát màn hình điều hướng.
3. Đăng nhập bằng vai trò `SHAREHOLDER`.
4. Kiểm tra app tự điều hướng đúng dashboard dành cho role này.

Kỳ vọng:

- Người chưa đăng nhập bị đẩy về `login`
- `SHAREHOLDER` vào app được đưa tới `investor-dashboard`

## Quy ước video và log

- Video: `UI_B01_Auth_AppShell_YYYYMMDD.mp4`
- Log: `LOG_B01_Auth_AppShell_YYYYMMDD.md`
- Ghi rõ mốc thời gian cho từng case
- Nếu fail thì chụp thêm ảnh màn hình tại thời điểm lỗi

## Tiêu chí PASS/FAIL

- PASS nếu toàn bộ route guard, login, logout, restore session và RBAC cơ bản hiển thị đúng
- FAIL nếu sai redirect, sai thông báo, sai quyền hoặc vỡ sidebar/app shell

