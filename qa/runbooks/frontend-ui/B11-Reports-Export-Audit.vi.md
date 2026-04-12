# Runbook Test UI - Batch B11: Reports, Export, Audit

## Mục tiêu

Batch này kiểm tra các màn báo cáo, xuất file và audit. Trọng tâm là inline update, export dung lượng lớn, encoding file, dữ liệu bị ẩn cho `SHAREHOLDER` và trạng thái loading an toàn khi tải báo cáo lớn.

## Vai trò cần dùng

- `DIRECTOR`
- `ACCOUNTING`
- `OPS`
- `SHAREHOLDER`

## Dữ liệu cần chuẩn bị

- 1 tập dữ liệu báo cáo có đủ dòng để test phân trang
- 1 case report có inline update được
- 1 case export CSV có tiếng Việt
- 1 case streaming export lớn hoặc có thể mô phỏng 50,000+ dòng
- 1 tài khoản `SHAREHOLDER`
- 1 tài khoản có quyền xem Teaching Report
- 1 mẫu audit log có dữ liệu để filter

## Case trọng tâm

- Attendance report filter và phân trang
- Student report filter và preview ảnh
- Comprehensive report filter
- Teaching report pending/completed
- Inline update RBAC của Teaching Report
- Employee performance dashboard
- Export reports
- CSV dùng UTF-8 BOM
- Streaming export 50,000+ dòng
- Masked export cho `SHAREHOLDER`
- Audit log filter, pagination, read-only

## Checklist thực thi mẫu

1. Đăng nhập bằng `DIRECTOR` hoặc `ACCOUNTING`.
2. Mở từng màn báo cáo trong batch.
3. Kiểm tra filter, sort, pagination và trạng thái empty/error nếu có.
4. Mở Teaching Report và thử inline update trên ô bảng.
5. Đăng nhập lại bằng `PARENT` hoặc `SALE` nếu cần xác nhận RBAC bị chặn.
6. Chạy export báo cáo với file nhỏ để kiểm tra format cơ bản.
7. Chạy export CSV có tiếng Việt để xác nhận UTF-8 BOM.
8. Nếu có streaming export lớn, giữ màn hình quan sát loading cho tới khi tải xong.
9. Đăng nhập `SHAREHOLDER` và kiểm tra dữ liệu nhạy cảm bị masked trên file xuất.
10. Mở audit log, filter theo điều kiện và xác nhận chỉ đọc.

## Quy ước ghi hình

- Mỗi video MP4 nên tương ứng 1 nhánh nội dung chính của batch
- Tên file gợi ý: `UI_B11_Reports_Export_Audit_YYYYMMDD.mp4`
- Nếu export lâu, quay liên tục cho tới khi file tải xong
- Bật hiển thị con trỏ chuột

## Quy ước log

- Ghi rõ tên báo cáo, bộ lọc đã chọn và tên file xuất
- Với export, ghi thêm dung lượng file nếu đáng chú ý
- Với lỗi loading hoặc treo, ghi đúng mốc thời gian video

## Tiêu chí PASS

- Báo cáo hiển thị đúng dữ liệu và filter
- Inline update đúng quyền
- Export đúng định dạng và encoding
- Streaming export không làm UI chết hoặc mất trạng thái
- Audit log chỉ đọc, không sửa dữ liệu

## Tiêu chí FAIL

- File xuất lỗi font
- Dữ liệu `SHAREHOLDER` không bị ẩn
- Inline edit mở cho role không có quyền
- Export lớn làm treo UI
- Filter/pagination sai dữ liệu
