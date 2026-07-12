# 🏫 Sổ tay OPS / Vận hành — Lumira English

> **OPS là đầu mối giữ cho lớp học chạy đúng lịch, đúng người, đúng trạng thái — và mọi phát sinh đều phải có dấu vết trong hệ thống.**

**Điều hướng nhanh:** [Hub tổng hợp](../tong-hop-link-mo-trung-tam.md) · [Checklist master](../checklist-opening-center-detailed.md) · [Tất cả sổ tay](./README.md) · [Checklist OPS](../opening-center-checklists/checklist-ops.md)

---

## Thông tin nhanh

| Nội dung | Giá trị |
|---|---|
| Thương hiệu | lumiraEnglish.com |
| Mô hình lớp | Online · 1 giáo viên · nhiều học sinh |
| Nhịp học | 1 buổi / tuần · 2 giờ 15 phút / buổi |
| Cấu trúc buổi | 60' ngữ pháp → 60' giao tiếp → 15' game |
| Học phí niêm yết | 160.000đ / học sinh / buổi |
| Gói học | 20 · 40 · 60 · 100 buổi |
| Ưu đãi tối đa | 100.000đ / gói (bảng giá đã khóa) — Sale không tự giảm |
| Không học thử | Học sinh làm **test trải nghiệm** → xếp lớp |
| Cam kết bán hàng | **Giao tiếp trôi chảy** |
| Ngày payroll | Ngày **10** hằng tháng cho dữ liệu tháng trước |

| Chính sách nghỉ học | Nghỉ **có phép** → không mất tiền · Nghỉ **không phép** → mất tiền |
|---|---|
| Chuyển lớp / Hoàn tiền | Theo số buổi còn lại |

---

## Mục lục

1. [Sứ mệnh vai trò](#1-sứ-mệnh-vai-trò)
2. [Màn hình OPS cần sử dụng hằng ngày](#2-màn-hình-ops-cần-sử-dụng-hằng-ngày)
3. [Dữ liệu OPS phải giữ sạch](#3-dữ-liệu-ops-phải-giữ-sạch)
4. [Quy trình làm việc hằng ngày](#4-quy-trình-làm-việc-hằng-ngày)
5. [Luồng thao tác cần thuộc lòng](#5-luồng-thao-tác-cần-thuộc-lòng)
6. [Xử lý nghỉ học — có phép và không phép](#6-xử-lý-nghỉ-học--có-phép-và-không-phép)
7. [Test trải nghiệm → Xếp lớp](#7-test-trải-nghiệm--xếp-lớp)
8. [Phối hợp đúng với bộ phận khác](#8-phối-hợp-đúng-với-bộ-phận-khác)
9. [Mốc thời gian quan trọng](#9-mốc-thời-gian-quan-trọng)
10. [Những điều không được làm](#10-những-điều-không-được-làm)
11. [Cảnh báo cần theo dõi mỗi ngày](#11-cảnh-báo-cần-theo-dõi-mỗi-ngày)
12. [Tài liệu đọc thêm](#12-tài-liệu-đọc-thêm)

---

## 1. Sứ mệnh vai trò

OPS là đầu mối giữ cho lớp học chạy đúng lịch, đúng người, đúng trạng thái. Trong hệ thống, OPS đảm bảo 4 việc:

1. **Dữ liệu lớp và roster đúng ở nguồn** — không sửa tạm ở màn hình con.
2. **Session được tạo đủ và chốt đúng lúc** — không để treo qua cutoff payroll.
3. **Attendance và Teaching Report không bị treo** — thúc đúng chủ sở hữu nguồn.
4. **Mọi phát sinh đều có dấu vết** — trên `Tickets` hoặc kênh nội bộ phù hợp.

---

## 2. Màn hình OPS cần sử dụng hằng ngày

| Màn hình | Mục đích |
|---|---|
| `Dashboard` | Lớp đang chạy, ticket quá hạn, request chờ duyệt |
| `Classes` | Quản lý danh sách lớp, roster, giáo viên phụ trách |
| `Sessions` | Tạo và theo dõi buổi học — tạo trước ≥ 1 tuần |
| `Attendance` | Xem và hỗ trợ điểm danh khi cần |
| `Pending Approvals` | Thay đổi cần Giám đốc hoặc người duyệt xử lý |
| `Tickets` | Xử lý phát sinh — giáo viên xin nghỉ, đổi lịch, phụ huynh phản ánh |
| `Messages / Notifications` | Theo dõi thông báo từ giáo viên, Sale, Kế toán |

---

## 3. Dữ liệu OPS phải giữ sạch

### Dữ liệu lớp học

- Mã lớp, tên lớp, giáo viên phụ trách, Sale phụ trách và nhóm học viên phải đúng.
- Lớp chưa đủ sĩ số phải được đánh dấu rõ để tránh nhầm lẫn khi bán.

### Dữ liệu roster

- Mỗi học viên vào lớp phải có trong roster của `Classes`.
- Nếu roster thực tế khác hệ thống, phải sửa ở `Classes` trước khi điểm danh hoặc finalize.

### Dữ liệu session

- Session phải được tạo trước theo cadence **1 buổi / tuần**, thời lượng **2 giờ 15 phút**.
- Session sau khi giáo viên dạy xong phải đi đến `TEACHER_COMPLETED` trước khi được finalize.

---

## 4. Quy trình làm việc hằng ngày

### Đầu ngày

1. Mở `Dashboard` — xem lớp đang chạy, ticket quá hạn, request chờ duyệt.
2. Mở `Classes` và `Sessions` — kiểm tra các lớp bắt đầu trong 2 giờ tới.
3. Xác nhận giáo viên, roster, phòng học / link online không có sai lệch.
4. Nếu có dấu hiệu thiếu giáo viên hoặc đổi lịch, tạo ticket hoặc điều phối ngay.

### Trong ngày

1. Khi có học viên vào lớp nhưng chưa có trong roster → sửa ngay ở `Classes`.
2. Khi có thay đổi giáo viên hoặc lịch học → cập nhật dữ liệu nguồn và để lại dấu vết trên ticket.
3. Khi học sinh xin nghỉ → ghi rõ **nghỉ có phép hay không phép** để áp đúng rule mất tiền / không mất tiền.
4. Theo dõi `Pending Approvals` cho các thay đổi cần người duyệt xử lý.
5. Phối hợp với Giáo viên để đảm bảo attendance và teaching report được nộp trong ngày.

### Cuối ngày

1. Lọc `Sessions` theo `TEACHER_COMPLETED`.
2. Kiểm tra buổi nào đủ attendance và teaching report để finalize.
3. Ghi rõ buổi nào còn treo và lý do: thiếu report, thiếu attendance, đổi lịch chưa đóng, ticket mở.
4. Rà `Tickets`, `Teaching Report`, `Attendance`, `Pending Approvals` trước khi kết thúc ca.

---

## 5. Luồng thao tác cần thuộc lòng

### Sửa roster ở `Classes`

- Chỉ sửa roster ở lớp nguồn, không sửa tạm ở màn hình attendance.
- Sau khi lưu phải kiểm tra lại bảng lớp để chắc chắn dữ liệu đã đổi thật.

### Bulk create session

- Chọn đúng lớp.
- Tạo đủ lịch cho tuần đầu hoặc tháng đầu — tránh đến sát giờ học mới tạo.
- Sau khi tạo xong phải ra danh sách để đối chiếu số lượng buổi phát sinh.

### Finalize session đã dạy

- Chỉ finalize khi attendance và teaching report đã đủ.
- Nếu một trong hai thiếu → quay lại owner nguồn để bổ sung, không chốt tắt.

### Xử lý ticket vận hành

Các loại ticket OPS thường gặp:

| Loại ticket | Hành động |
|---|---|
| Giáo viên xin nghỉ | Tìm giáo viên thay thế, cập nhật session, thông báo phụ huynh |
| Phụ huynh xin đổi buổi | Kiểm tra lịch, xác nhận và cập nhật session |
| Học viên phản ánh chất lượng | Mở ticket, ghi rõ nội dung, bàn giao Giám đốc nếu vượt thẩm quyền |
| Test trải nghiệm cần xếp lớp | Xử lý phiếu từ Sale, xếp lớp phù hợp sau khi có kết quả assessment |

Mọi ticket phải có **owner, mức độ ưu tiên, trạng thái rõ ràng** và lịch sử comment để ca sau tiếp quản được.

---

## 6. Xử lý nghỉ học — có phép và không phép

Đây là điểm quan trọng nhất OPS phải xử lý đúng vì nó ảnh hưởng trực tiếp đến doanh thu được ghi nhận:

| Loại nghỉ | Tác động tài chính | Yêu cầu xử lý |
|---|---|---|
| **Nghỉ có phép** | Học sinh **không mất tiền** — buổi được bảo lưu | Phải có ghi chú "có phép" trong attendance và ticket |
| **Nghỉ không phép** | Học sinh **mất tiền** — buổi bị tính như đã học | Phải ghi rõ "không phép" để Kế toán đối chiếu đúng |

> **Quy tắc:** Kế toán phụ thuộc vào dữ liệu attendance của OPS để xác định doanh thu. Nếu OPS ghi sai loại nghỉ, báo cáo tài chính sẽ sai theo.

---

## 7. Test trải nghiệm → Xếp lớp

Lumira không có học thử. Học sinh mới đến trải nghiệm theo luồng:

1. Sale tạo phiếu / ticket cho ca **test trải nghiệm**.
2. Giáo viên trải nghiệm dẫn test và ghi kết quả assessment.
3. **OPS nhận phiếu** từ Sale và kết quả từ Giáo viên trải nghiệm.
4. OPS xem xét lớp phù hợp (trình độ, lịch, sĩ số) và xếp học sinh vào lớp.
5. OPS cập nhật roster trong `Classes` và thông báo cho phụ huynh.

---

## 8. Phối hợp đúng với bộ phận khác

### Với Giáo viên

- Nhắc attendance và teaching report trong ngày — không để đơn sang kỳ lương.
- Khi giáo viên xin nghỉ hoặc cần dạy thay, bắt buộc tạo request/ticket hệ thống.

### Với Sale

- Xác nhận học viên đã đủ điều kiện xuống lớp trước khi đưa vào roster.
- Xác nhận học sinh mới đã hoàn thành test trải nghiệm và có đề xuất lớp rõ ràng.
- Khi đơn đã duyệt nhưng chưa xếp lớp, mở ticket bàn giao thay vì trao đổi bằng chat rồi bỏ sót.

### Với Giám đốc

- Đẩy lên Giám đốc các yêu cầu vượt chính sách hoặc treo quá SLA.
- Không đẩy mọi phát sinh lên Giám đốc nếu OPS có thể đóng ở mức vận hành thường ngày.

---

## 9. Mốc thời gian quan trọng

### Trước khai trương

- Tạo danh sách lớp 4–8 tuần đầu.
- Tạo session cho tuần đầu theo cadence `1 buổi / tuần · 2 giờ 15 phút / buổi`.
- Chuẩn bị danh sách giáo viên thay thế cho các khung giờ cao điểm.
- Chạy thử: sửa roster, thay giáo viên, đổi lịch, tạo change request, xử lý test trải nghiệm, finalize.

### Ngày khai trương và 3 ngày đầu

- Trước giờ mở cửa: rà soát lớp bắt đầu trong 2 giờ đầu.
- Trong giờ: sửa roster ngay khi phát sinh lệch thực tế.
- Cuối ngày: lập danh sách buổi treo, request đổi lịch chưa xử lý và owner tiếp tục.

---

## 10. Những điều không được làm

- ❌ Không finalize session khi dữ liệu đầu vào chưa sạch.
- ❌ Không điều phối giáo viên chỉ bằng chat mà không cập nhật hệ thống.
- ❌ Không chữa cháy bằng cách sửa tạm ở màn hình con, bỏ qua màn hình nguồn.
- ❌ Không để ticket mở mà không có owner tiếp quản.

---

## 11. Cảnh báo cần theo dõi mỗi ngày

| # | Cảnh báo | Hành động |
|---|---|---|
| 1 | Session đã dạy nhưng chưa finalize cuối ngày | Nhắc Giáo viên nộp report và xử lý attendance |
| 2 | Lớp có roster sai hoặc thay đổi liên tục | Sửa nguồn ở `Classes`, kiểm tra nguyên nhân |
| 3 | Ticket bị mở lại nhiều lần hoặc quá SLA | Báo Giám đốc và review SOP xử lý ticket |

---

## 12. Tài liệu đọc thêm

| Tài liệu | Đường dẫn |
|---|---|
| Checklist OPS | [checklist-ops.md](../opening-center-checklists/checklist-ops.md) |
| Checklist master | [checklist-opening-center-detailed.md](../checklist-opening-center-detailed.md) |
| Kịch bản vận hành chi tiết | [KichBanVanHanh_ChiTiet.md](../KichBanVanHanh_ChiTiet.md) |
| Hub tổng hợp tất cả link | [tong-hop-link-mo-trung-tam.md](../tong-hop-link-mo-trung-tam.md) |
| Tất cả sổ tay | [README.md](./README.md) |
