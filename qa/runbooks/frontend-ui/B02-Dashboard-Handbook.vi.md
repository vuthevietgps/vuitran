# Runbook B02: Dashboard, Hub Duyệt, Cẩm Nang Theo Role

## Mục tiêu

Kiểm tra dashboard theo role, cẩm nang nội bộ, các cảnh báo dữ liệu quan trọng, empty state và widget `Flow Guide` trên màn hình có nhúng. Tất cả bước test, kỳ vọng và kết quả phải viết bằng tiếng Việt khi ghi log.

## Vai trò test

- `DIRECTOR`
- `OPS`
- `SALE`
- `PARENT`
- `SHAREHOLDER`

## Tiền điều kiện

- Có đủ tài khoản các role trên
- Có dữ liệu dashboard đủ để thấy cả trạng thái có dữ liệu lẫn empty state
- Có một vài cảnh báo `Critical` và `Warning` trên dashboard Director
- Có màn hình có nhúng `Flow Guide` để test mở/đóng widget

## Case trọng tâm

- Dashboard load đúng theo role
- `Overdue Tickets` nổi bật trên dashboard
- `Critical Anomalies` hiển thị rõ
- Biểu đồ `Expense Breakdown` theo danh mục
- Investor Dashboard partial failure không làm sập toàn trang
- Cẩm nang nội bộ, quick links, gallery
- `teacher-hub` và `sale-hub`
- Hub Duyệt, badge count, approve/reject realtime
- Empty state thân thiện cho user mới
- `Flow Guide` mở/đóng đúng

## Checklist thao tác mẫu

### Case mẫu: `Flow Guide`

1. Mở một màn hình có nhúng widget `Flow Guide`.
2. Quan sát phần mô tả luồng.
3. Bấm nút mở/đóng widget.
4. Kiểm tra nội dung checklist và tiêu đề hiển thị đủ.

Kỳ vọng:

- Widget mở/đóng mượt
- Nội dung không vỡ layout
- Không che mất vùng thao tác chính

### Case mẫu: Critical Anomalies

1. Mở dashboard Director.
2. Quan sát khu vực cảnh báo dữ liệu.
3. Kiểm tra cảnh báo nghiêm trọng được tô nổi bật.
4. Bấm vào action hoặc link liên quan nếu có.

Kỳ vọng:

- Cảnh báo mức nghiêm trọng dễ nhìn
- Màu sắc và khối cảnh báo phân biệt rõ `CRITICAL` và `WARNING`
- Điều hướng đúng nơi xử lý

## Quy ước video và log

- Video: `UI_B02_Dashboard_Handbook_YYYYMMDD.mp4`
- Log: `LOG_B02_Dashboard_Handbook_YYYYMMDD.md`
- Ghi rõ role đang dùng cho từng lượt quay
- Với dashboard dài, nên chia mốc theo tab hoặc khối cảnh báo

## Tiêu chí PASS/FAIL

- PASS nếu dashboard theo role, cảnh báo, cẩm nang, empty state và Flow Guide đều đúng
- FAIL nếu sai role, sai cảnh báo, sai điều hướng hoặc widget làm vỡ layout

