# 💰 Sổ tay Kế toán — Lumira English

> **Kế toán là chủ sở hữu của cụm kiểm soát tiền và chứng từ trong hệ thống — đọc đúng dòng tiền, duyệt đúng chứng từ, và không để một đồng nào bị phân loại sai.**

**Điều hướng nhanh:** [Hub tổng hợp](../tong-hop-link-mo-trung-tam.md) · [Checklist master](../checklist-opening-center-detailed.md) · [Tất cả sổ tay](./README.md) · [Checklist Kế toán](../opening-center-checklists/checklist-accounting.md)

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

| Vai trò | Cơ cấu lương |
|---|---|
| Sale | 8.000.000đ / tháng + 3% doanh thu |
| Giáo viên trải nghiệm | 7.000.000đ / tháng + 0,5% doanh thu + 5.000đ / ca test |
| Giáo viên giảng dạy | 250.000đ / ca 2h15 · không lương cứng |

| Chính sách nghỉ học | Nghỉ **có phép** → không mất tiền · Nghỉ **không phép** → mất tiền |
|---|---|
| Hoàn tiền | Theo số buổi còn lại |

---

## Mục lục

1. [Sứ mệnh vai trò](#1-sứ-mệnh-vai-trò)
2. [Màn hình Kế toán cần nắm thành thạo](#2-màn-hình-kế-toán-cần-nắm-thành-thạo)
3. [Nguyên tắc tài chính bắt buộc](#3-nguyên-tắc-tài-chính-bắt-buộc)
4. [Quy trình làm việc hằng ngày](#4-quy-trình-làm-việc-hằng-ngày)
5. [Luồng thao tác từng màn hình](#5-luồng-thao-tác-từng-màn-hình)
6. [Quy tắc tài chính đặc thù Lumira](#6-quy-tắc-tài-chính-đặc-thù-lumira)
7. [Phối hợp đúng với bộ phận khác](#7-phối-hợp-đúng-với-bộ-phận-khác)
8. [Những điều không được làm](#8-những-điều-không-được-làm)
9. [Cảnh báo cuối ngày cần chốt](#9-cảnh-báo-cuối-ngày-cần-chốt)
10. [Tài liệu đọc thêm](#10-tài-liệu-đọc-thêm)

---

## 1. Sứ mệnh vai trò

Kế toán không chỉ là người bấm duyệt. Nhiệm vụ thực sự là **giữ cho dòng tiền và chứng từ phản ánh đúng nghiệp vụ, đúng thời điểm và đúng dữ liệu nguồn**, bao gồm:

- `Wallets` — quản lý ví học sinh và duyệt top-up.
- `Invoices` — duyệt hóa đơn theo chứng từ.
- `Payroll` và `Staff Payroll` — kiểm tra và xác nhận chi lương.
- `Expenses` và `Loans` — theo dõi chi phí và gánh nặng nợ vay.
- `Financial Control` — đối soát, reconcile, P&L, runway.
- `Aging Report` — theo dõi công nợ theo tuổi nợ.
- `Export Reports` — xuất báo cáo cho Giám đốc và Cổ đông.

---

## 2. Màn hình Kế toán cần nắm thành thạo

| Màn hình | Mục đích sử dụng |
|---|---|
| `Dashboard Kế toán` | Tổng quan đầu việc tài chính ưu tiên trong ngày |
| `Wallets` | Duyệt top-up, xem ledger sau duyệt, kiểm tra validation ví |
| `Invoices` | Duyệt hóa đơn hoặc trả lại với lý do rõ ràng |
| `Payroll` | Preview buổi đủ điều kiện vs buổi bị chặn |
| `Staff Payroll` | Chi tiết lương từng nhân sự — chỉ đánh dấu `PAID` khi có căn cứ |
| `Expenses` | Ghi nhận và phê duyệt chi phí vận hành |
| `Loans` | Theo dõi các khoản vay và lịch trả nợ |
| `Financial Control` | Reconcile ngân hàng, P&L, runway, cảnh báo độ lệch |
| `Aging Report` | Phân tích công nợ theo tuổi nợ |
| `Export Reports` | Xuất báo cáo định kỳ |

---

## 3. Nguyên tắc tài chính bắt buộc

### 3.1. Tách đúng 3 loại tiền

Mỗi khoản tiền vào phải được xác định ngay:

| Loại | Ý nghĩa | Hậu quả nếu sai |
|---|---|---|
| Doanh thu vận hành | Học phí, phí lớp học | P&L sai, cổ đông đọc sai |
| Vốn góp chủ sở hữu | Tiền góp vốn của cổ đông | Runway sai, lãi/lỗ sai |
| Khoản vay / ứng vốn | Nợ phải trả, ứng trước | Gánh nặng nợ không hiện rõ |

### 3.2. Chỉ duyệt khi đủ chứng từ

- Hóa đơn chỉ được duyệt khi số tiền, biên lai, người nộp và hình thức thanh toán khớp nhau.
- Top-up ví chỉ được duyệt khi có bằng chứng chuyển khoản hợp lệ.
- Phiếu chi chỉ được đánh dấu `PAID` khi có căn cứ chi tiền thật.

### 3.3. Không đổi bản chất dòng tiền bằng tay

Khi giao dịch không rõ nguồn gốc, Kế toán phải tìm nguồn gốc và đẩy lại owner liên quan — không sửa tắt để cho khớp báo cáo.

---

## 4. Quy trình làm việc hằng ngày

### Đầu ngày

1. Mở `Dashboard Kế toán`.
2. Đọc top-up chờ duyệt, hóa đơn chờ duyệt, đầu việc tài chính ưu tiên.
3. Xác định nên vào `Wallets`, `Invoices` hay `Payroll` trước.

### Trong ngày

1. Xử lý top-up ở `Wallets` và xem ledger ngay sau khi duyệt.
2. Xử lý `Invoices` chờ duyệt — trả lại hóa đơn nếu thiếu chứng từ hoặc sai số tiền.
3. Ghi nhận giao dịch ngân hàng trong `Financial Control` nếu có phát sinh.
4. Theo dõi `Expenses`, `Loans`, `Payroll` theo mức ưu tiên trong ngày.

### Cuối ngày

1. Lập danh sách hóa đơn chờ duyệt còn tồn.
2. Lập danh sách giao dịch chưa reconcile.
3. Lập danh sách top-up treo.
4. Chốt nhanh: doanh thu ghi nhận, số tiền đã vào, số tiền chờ xử lý, các mục rủi ro chuyển sang ngày sau.
5. Kiểm tra các case nghỉ có phép / không phép, chuyển lớp và hoàn tiền trong ngày đã đi đúng rule tài chính chưa.

---

## 5. Luồng thao tác từng màn hình

### Wallets — Ví học sinh

1. Duyệt top-up.
2. Xem ledger sau duyệt — không dừng ở thông báo thành công.
3. Kiểm tra validation khi điều chỉnh ví bất thường.

> **Nguyên tắc:** Duyệt xong phải hậu kiểm ledger. Top-up hiển thị duyệt thành công không đồng nghĩa với ledger đã cập nhật đúng.

### Invoices — Hóa đơn

1. Lọc `PENDING_APPROVAL`.
2. Mở hóa đơn — đối chiếu số tiền, người nộp, hình thức thanh toán, ảnh xác nhận.
3. Kiểm tra giá trị hóa đơn có khớp gói `20 / 40 / 60 / 100` và bảng giá Lumira hay không.
4. Duyệt hoặc trả lại với lý do rõ ràng.

### Payroll và Staff Payroll — Lương

1. Ở `Payroll`: xem preview buổi nào đủ điều kiện, buổi nào bị chặn vì thiếu attendance hoặc teaching report.
2. Ở `Staff Payroll`: mở chi tiết lương, kiểm tra cấu phần, chỉ đánh dấu `PAID` khi có căn cứ thanh toán.

---

## 6. Quy tắc tài chính đặc thù Lumira

### Công thức lương cần kiểm tra mỗi kỳ payroll

| Vai trò | Công thức | Phần biến |
|---|---|---|
| Sale | 8.000.000đ + 3% doanh thu | % doanh thu theo `Commission Report` |
| GV trải nghiệm | 7.000.000đ + 0,5% doanh thu + 5.000đ / ca | Số ca test trải nghiệm ghi nhận |
| GV giảng dạy | 250.000đ / ca 2h15 | Số buổi finalize hợp lệ |

### Nghỉ học ảnh hưởng đến doanh thu

- Nghỉ **có phép**: buổi không tính vào doanh thu thực thu — Kế toán không ghi nhận doanh thu buổi đó.
- Nghỉ **không phép**: buổi vẫn tính doanh thu — Kế toán ghi nhận bình thường.
- OPS ghi loại nghỉ trong attendance → Kế toán đọc dữ liệu đó để đối chiếu.

### Chuyển lớp và hoàn tiền

- Hoàn tiền dựa trên **số buổi còn lại** tính theo học phí niêm yết.
- Không hoàn tiền theo thỏa thuận miệng hoặc tự tính lại ngoài hệ thống.
- Mọi ưu đãi giá phải khớp bảng giá Lumira đã được duyệt — không hợp thức hóa giảm giá tay sau khi đơn đã tạo.

### Ngày payroll

- Payroll chốt cho **tháng trước** và chi trả vào ngày **10** hằng tháng.
- Phải đảm bảo mọi công thức lương và dữ liệu attendance sạch trước ngày 8 hằng tháng.

---

## 7. Phối hợp đúng với bộ phận khác

### Với Sale

- Sale phải bổ sung đủ biên lai, nguồn tiền, ghi chú nộp tiền khi Kế toán yêu cầu.
- Sale **không được** nhờ Kế toán hợp thức hóa giảm giá ngoài bảng giá Lumira.
- Kế toán không xác nhận đã thu tiền chỉ vì có chat hay lời nói — cần bằng chứng hệ thống.

### Với OPS và Giáo viên

- Kế toán phụ thuộc vào attendance chính xác từ OPS/Giáo viên để tính lương và doanh thu đúng.
- Nếu attendance sai, Kế toán đẩy về owner nguồn để sửa — không tự điều chỉnh.

### Với Giám đốc

- Các giao dịch mơ hồ về bản chất hoặc nguồn gốc phải báo Giám đốc trước khi xử lý.
- Kế toán không tự quyết định việc tái phân loại khoản tiền lớn.

---

## 8. Những điều không được làm

- ❌ Không duyệt hóa đơn chỉ vì có lời nói hoặc tin nhắn xác nhận.
- ❌ Không đổi bản chất dòng tiền để báo cáo khớp — phải sửa ở nguồn.
- ❌ Không đánh dấu `PAID` khi chưa có căn cứ thanh toán thật.
- ❌ Không hợp thức hóa giảm giá tay sau khi đơn đã được tạo.
- ❌ Không để payroll chạy ngày 10 khi công thức lương hay attendance vẫn chưa sạch.

---

## 9. Cảnh báo cuối ngày cần chốt

| # | Đầu mục cần kiểm tra |
|---|---|
| 1 | Hóa đơn chờ duyệt quá 1 ngày |
| 2 | Giao dịch ngân hàng chưa reconcile treo qua cutoff |
| 3 | Top-up đã duyệt nhưng ledger không khớp |
| 4 | Buổi payroll bị chặn vì dữ liệu treo lặp lại nhiều kỳ |
| 5 | Sắp đến ngày 10 nhưng công thức lương hoặc attendance vẫn chưa sạch |

---

## 10. Tài liệu đọc thêm

| Tài liệu | Đường dẫn |
|---|---|
| Checklist Kế toán | [checklist-accounting.md](../opening-center-checklists/checklist-accounting.md) |
| Checklist master | [checklist-opening-center-detailed.md](../checklist-opening-center-detailed.md) |
| Kịch bản Kế toán chi tiết | [KichBanKeToan_ChiTiet.md](../KichBanKeToan_ChiTiet.md) |
| Hub tổng hợp tất cả link | [tong-hop-link-mo-trung-tam.md](../tong-hop-link-mo-trung-tam.md) |
| Tất cả sổ tay | [README.md](./README.md) |
