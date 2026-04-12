# Runbook B06 - Teacher Hub, Parent Pages, Teaching Reports

## Mục tiêu batch

Test các màn hình dành cho giáo viên và phụ huynh, tập trung vào form nghiệp vụ, báo cáo giảng dạy, phản hồi và dữ liệu lương.

## Vai trò dùng để test

- `TEACHER`
- `PARENT`
- `OPS`

## Tiền điều kiện và dữ liệu mẫu

- Có sẵn 1 teacher profile có `bankInfo`.
- Có sẵn 1 request xin nghỉ/thay thế để test validation ngày.
- Có sẵn 1 lớp Offline để test báo cáo hàng loạt.
- Có sẵn 1 template báo cáo giảng dạy có field động.
- Có sẵn 1 session đủ điều kiện để hoàn thành buổi học.
- Có sẵn 1 dữ liệu feedback tổng quát và 1 dữ liệu rating thấp.
- Có sẵn 1 giáo viên có bảng lương preview theo nhiều trạng thái.

## Case trọng tâm

- Teacher profile lưu đúng `bankInfo`.
- Form xin nghỉ/thay thế bắt buộc `Đến ngày >= Từ ngày`.
- Bảng xem trước lương chia đúng 5 nhóm: `Đã thanh toán`, `Chờ PH`, `Chờ OPS`, `Thiếu báo cáo`, `Hủy`.
- Form Báo cáo giảng dạy render động đúng theo template.
- `Bulk Teaching Report` cho lớp Offline cho phép nộp hàng loạt.
- Form `general-feedback` hiển thị đủ `teachingQuality`, `communication`, `facility`.
- Rating 1-5 sao hoạt động đúng, rating thấp phải nổi bật ở màn theo dõi.

## Checklist bước test mẫu

### Case mẫu: Lưu bankInfo giáo viên

1. Mở trang hồ sơ giáo viên.
2. Vào phần thông tin ngân hàng.
3. Nhập tên ngân hàng, số tài khoản, chủ tài khoản.
4. Lưu thay đổi.

Kỳ vọng:

- Form validate đúng.
- Dữ liệu lưu lại chính xác.
- Không làm hỏng dữ liệu payroll.

### Case mẫu: Form xin nghỉ/thay thế

1. Mở form xin nghỉ hoặc thay thế.
2. Nhập `Từ ngày`.
3. Nhập `Đến ngày` nhỏ hơn `Từ ngày`.
4. Submit form.

Kỳ vọng:

- UI chặn submit.
- Hiển thị validation rõ bằng tiếng Việt.

### Case mẫu: Báo cáo giảng dạy hàng loạt

1. Mở form `Bulk Teaching Report`.
2. Chọn lớp Offline.
3. Nhập dữ liệu cho nhiều học sinh hoặc nhiều dòng báo cáo.
4. Submit toàn bộ.

Kỳ vọng:

- UI hỗ trợ nhập hàng loạt.
- Không cần click nộp từng người.
- Các field động theo template hiển thị đủ.

### Case mẫu: General feedback

1. Mở form feedback.
2. Điền `teachingQuality`, `communication`, `facility`.
3. Submit.

Kỳ vọng:

- Cả 3 trường đều hiển thị và lưu đúng.

## Quy ước video và log

- Video bắt buộc là `MP4`.
- Ghi rõ chuột, không che vùng form.
- Một video cho một cụm màn: `Teacher Hub`, `Parent Pages`, `Teaching Reports`.
- Tên gợi ý:
  - `UI_B06_TeacherHub_ParentPages_YYYYMMDD.mp4`
  - `LOG_B06_TeacherHub_ParentPages_YYYYMMDD.md`
- Log phải có mốc thời gian và kết quả thực tế bằng tiếng Việt.

## Tiêu chí PASS/FAIL

PASS khi:

- Bank info, teaching report, bulk report, feedback và rating chạy đúng.
- Validation ngày tháng và hiển thị 5 nhóm lương đúng.

FAIL khi:

- Mất field động.
- Submit hàng loạt không chạy.
- Bank info lưu sai.
- Rating hoặc feedback không hiển thị đúng.
