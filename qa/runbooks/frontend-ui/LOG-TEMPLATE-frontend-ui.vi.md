# Mẫu Log Test Frontend UI

## Thông tin chung

- Ngày test:
- Người test:
- Batch:
- Video MP4:
- Part video:
- Vai trò:
- Môi trường:
- Ghi chú:

## Danh sách case

| Mã case | Case checklist | Màn submit | Màn đối soát sau submit | Kỳ vọng chính | Kết quả thực tế | Trạng thái | Mốc thời gian video |
|---|---|---|---|---|---|---|---|
| B10-ADS-001 | | | | | | PASS / FAIL / BLOCKED | |
| B10-ADS-002 | | | | | | PASS / FAIL / BLOCKED | |
| B10-ADS-003 | | | | | | PASS / FAIL / BLOCKED | |
| B11-REP-001 | | | | | | PASS / FAIL / BLOCKED | |
| B11-REP-002 | | | | | | PASS / FAIL / BLOCKED | |
| B11-REP-003 | | | | | | PASS / FAIL / BLOCKED | |

## Chuỗi quay bắt buộc

- Trạng thái trước thao tác:
- Form hoặc modal đang submit:
- Xác nhận ngay tại màn nguồn:
- Màn đối soát liên đới 1:
- Màn đối soát liên đới 2 nếu là luồng tài chính hoặc duyệt:

## Cách ghi kết quả

- `PASS`: UI đúng kỳ vọng, không có lỗi chặn
- `FAIL`: UI sai hoặc không đạt kỳ vọng
- `BLOCKED`: bị chặn bởi dữ liệu, backend, quyền hoặc môi trường

## Mẫu ghi chi tiết cho một case

### Case: B11-REP-001

- Màn hình / Route: `/app/teaching-report`
- Vai trò: `DIRECTOR`
- Tiền điều kiện:
  - Đã có dữ liệu báo cáo
  - Có quyền sửa nhanh

- Các bước test:
  1. Mở màn Teaching Report.
  2. Chọn một dòng có thể inline update.
  3. Click vào ô cần sửa.
  4. Nhập giá trị mới.
  5. Lưu thay đổi.

- Kỳ vọng:
  1. UI cho phép inline edit đúng vị trí.
  2. Dữ liệu cập nhật đúng sau khi lưu.
  3. Không cho `PARENT` hoặc `SALE` sửa nhanh nếu không có quyền.

- Kết quả thực tế:
  - ...

- Trạng thái:
  - ...

- Mốc thời gian video:
  - ...

## Tổng kết ngày

- Tổng case đã chạy:
- PASS:
- FAIL:
- BLOCKED:
- Các lỗi cần mở ticket:
- Link video:
