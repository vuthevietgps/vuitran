# Runbook B03: Người Dùng, Học Sinh, Sản Phẩm, Đại Lý

## Mục tiêu

Kiểm tra các màn quản lý user, học sinh, sản phẩm và đại lý, bao gồm RBAC đọc/sửa/xóa, multiple parents, deactivate product, deactivate teacher và onboarding có salary config. Khi ghi log phải dùng tiếng Việt hoàn toàn.

## Vai trò test

- `DIRECTOR`
- `OPS`
- `ACCOUNTING`
- `SALE`

## Tiền điều kiện

- Có sẵn dữ liệu user, student, product, agent
- Có ít nhất 1 học sinh nhiều phụ huynh
- Có ít nhất 1 sản phẩm cần test trạng thái ngừng bán
- Có ít nhất 1 giáo viên cần test deactivate
- Có quyền truy cập các màn cần đối soát dưới vai trò `ACCOUNTING`

## Case trọng tâm

- Tạo/sửa user, đổi role
- Multiple parents cho học sinh
- Chuyển giao owner giữa các sale
- Deactivate product chặn sale chọn khi tạo order
- Deactivate teacher hiển thị trạng thái đúng
- Onboarding giáo viên mới kèm salary config
- Quản lý đại lý và tier
- RBAC đọc/sửa/xóa cho `ACCOUNTING` trên màn Lớp/Học sinh

## Checklist thao tác mẫu

### Case mẫu: Multiple parents

1. Mở màn chi tiết học sinh.
2. Gán thêm phụ huynh thứ hai.
3. Lưu thay đổi.
4. Tải lại trang và kiểm tra danh sách phụ huynh.

Kỳ vọng:

- Học sinh giữ đầy đủ nhiều phụ huynh
- Không ghi đè nhầm owner hiện tại
- UI hiển thị rõ thông tin liên kết

### Case mẫu: Deactivate product

1. Mở màn danh sách sản phẩm.
2. Chuyển một gói học sang trạng thái ngừng bán.
3. Mở form tạo order.
4. Kiểm tra gói đó không còn chọn được.

Kỳ vọng:

- Trạng thái ngừng bán hiển thị rõ
- Sale không thể chọn gói đã deactivate

## Quy ước video và log

- Video: `UI_B03_Users_Students_Products_YYYYMMDD.mp4`
- Log: `LOG_B03_Users_Students_Products_YYYYMMDD.md`
- Ghi rõ role, màn hình và dữ liệu seed đang dùng
- Mỗi case nên có mốc thời gian riêng trong log

## Tiêu chí PASS/FAIL

- PASS nếu user/student/product/agent/RBAC đều hoạt động đúng
- FAIL nếu sai quyền, sai owner, sai trạng thái ngừng bán hoặc lưu dữ liệu lệch

