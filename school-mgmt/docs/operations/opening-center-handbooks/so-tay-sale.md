# 💼 Sổ tay Sale / Tư vấn tuyển sinh — Lumira English

> **Sale là người làm chủ đầu phễu kinh doanh: từ tiếp nhận lead, chuyển sang order được duyệt, cho đến bàn giao đủ điều kiện xếp lớp — không để dữ liệu rơi giữa các bước.**

**Điều hướng nhanh:** [Hub tổng hợp](../tong-hop-link-mo-trung-tam.md) · [Checklist master](../checklist-opening-center-detailed.md) · [Tất cả sổ tay](./README.md) · [Checklist Sale](../opening-center-checklists/checklist-sale.md)

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

| Lương Sale | 8.000.000đ / tháng + 3% hoa hồng doanh thu |
|---|---|

---

## Mục lục

1. [Sứ mệnh vai trò](#1-sứ-mệnh-vai-trò)
2. [Màn hình Sale cần sử dụng thành thạo](#2-màn-hình-sale-cần-sử-dụng-thành-thạo)
3. [Dữ liệu phải nhập đúng ngay từ đầu](#3-dữ-liệu-phải-nhập-đúng-ngay-từ-đầu)
4. [Quy trình chuẩn hằng ngày](#4-quy-trình-chuẩn-hằng-ngày)
5. [Luồng chuyển đổi Lead → Order → Bàn giao](#5-luồng-chuyển-đổi-lead--order--bàn-giao)
6. [Test trải nghiệm — không phải học thử](#6-test-trải-nghiệm--không-phải-học-thử)
7. [Phối hợp đúng với bộ phận khác](#7-phối-hợp-đúng-với-bộ-phận-khác)
8. [Mốc thời gian quan trọng](#8-mốc-thời-gian-quan-trọng)
9. [Những điều không được làm](#9-những-điều-không-được-làm)
10. [Cảnh báo cần theo dõi mỗi ngày](#10-cảnh-báo-cần-theo-dõi-mỗi-ngày)
11. [Cơ chế lương Sale](#11-cơ-chế-lương-sale)
12. [Tài liệu đọc thêm](#12-tài-liệu-đọc-thêm)

---

## 1. Sứ mệnh vai trò

Sale là người làm chủ toàn bộ phần đầu pipeline kinh doanh:

- Tạo và chăm lead đúng chuẩn.
- Tạo parent và student với dữ liệu đủ và sạch.
- Tạo order đúng gói học, đúng thông tin tài chính.
- Theo dõi đơn cho đến khi được duyệt, sinh invoice và bàn giao xếp lớp.
- **Không để dữ liệu rơi giữa** `Lead → Parent → Student → Order → Invoice`.

Sale không phải người duyệt cuối, không phải người xếp lớp, không phải người kiểm soát tài chính. Giá trị của Sale nằm ở **chất lượng dữ liệu đầu vào** và **kỷ luật theo dõi đến cuối**.

---

## 2. Màn hình Sale cần sử dụng thành thạo

| Màn hình | Mục đích |
|---|---|
| `Dashboard Sale` | Đọc funnel, follow-up hôm nay, đơn hàng gần đây, hoa hồng chờ duyệt |
| `Sale Hub` | Tổng hợp 5 bước chuẩn của quy trình Sale |
| `Leads` | Quản lý lead theo status, source, tab Follow-up / Pool / Stale |
| `Orders` | Tạo và theo dõi đơn hàng |
| `Students` | Tra cứu và tạo học sinh |
| `Invoices` | Xem trạng thái hóa đơn sau khi đơn được duyệt |
| `Commission Report` | Đối chiếu doanh thu và hoa hồng |
| `Conversations` | Tiếp quản hội thoại chatbot và tạo lead trực tiếp |
| `Messages / Notifications` | Theo dõi thông báo phê duyệt và phản hồi từ bộ phận khác |
| `/app/users?role=PARENT` | Tra cứu phụ huynh trước khi tạo mới |

> Sale **không được** tự duyệt Invoice, tự bulk tạo Session, tự thêm Bank Account, tự xử lý `Financial Control`, và **không được tự giảm giá** dưới bất kỳ hình thức nào.

---

## 3. Dữ liệu phải nhập đúng ngay từ đầu

### Lead — phải có tối thiểu

- Tên phụ huynh hoặc thông tin liên hệ chính.
- Số điện thoại, email (nếu có).
- Học sinh, khối lớp, nhu cầu học.
- Nguồn lead (source) chuẩn theo danh mục đã khóa.
- Giá trị ước tính và ghi chú nếu đã đủ thông tin.
- Ngày `nextFollowUp` ngay sau khi tiếp nhận.

### Parent — kiểm tra trước khi tạo

- Luôn tìm phụ huynh cũ trước khi tạo mới — không tạo trùng.
- Owner phụ huynh phải rõ ràng; việc chuyển owner do Director quyết định.

### Student — gắn đúng phụ huynh

- Gắn đúng phụ huynh chính và phụ (nếu cần).
- Không tạo trùng học sinh chỉ vì sai chính tả tên.
- Ảnh, ghi chú, thông tin lớp học phải đủ để downstream không bị tắc.

### Order — điền đủ trước khi gửi duyệt

- Chọn đúng product, số buổi, số buổi xuất invoice, installment, ưu đãi theo bảng giá khóa sẵn.
- Upload chứng từ và ghi consultation note đầy đủ.
- Nếu order chưa đủ thông tin thì để đúng trạng thái — không gửi duyệt khi chưa sạch.

---

## 4. Quy trình chuẩn hằng ngày

### Đầu ngày

1. Mở `Dashboard Sale` — đọc funnel, follow-up hôm nay, đơn hàng gần đây.
2. Xác định 3 nhóm việc:
   - Lead nóng cần gọi ngay hôm nay.
   - Đơn đang chờ thông tin bổ sung.
   - Việc bàn giao cần theo đến cuối ngày.

### Làm việc với lead

1. Mở `Leads` — lọc theo status, source, tab `Follow-up`, `Pool`, `Stale`.
2. Đọc detail lead và lịch sử liên hệ trước khi tư vấn.
3. Ghi mọi cuộc gọi, Zalo, email, gặp trực tiếp vào timeline của lead.
4. Đặt lại `nextFollowUp` sau mỗi lần chạm.

### Cuối ngày

1. Lập danh sách lead chuyển sang ngày mai, lead quá hạn cần giải trình.
2. Kiểm tra mọi đơn đã gửi duyệt đều có trạng thái rõ ràng.
3. Không gửi cho phụ huynh tài khoản nhận tiền cá nhân — chỉ tài khoản chính thức của trung tâm.

---

## 5. Luồng chuyển đổi Lead → Order → Bàn giao

```
Lead (INTERESTED / QUALIFIED)
  ↓  tạo Parent + Student nếu chưa có
Order (DRAFT)
  ↓  kiểm tra gói học, bảng giá Lumira, installment, chứng từ
Order (SUBMITTED → APPROVED)
  ↓  kiểm tra Invoice đã sinh đúng
  ↓  bàn giao OPS khi học sinh hoàn thành test trải nghiệm
Xếp lớp → học sinh vào lớp
```

**Quy tắc convert lead sang order:**

- Chỉ convert khi lead đang ở trạng thái phù hợp (ví dụ `INTERESTED` trở lên).
- Nếu là khách cũ, chọn lại Parent và Student cũ thay vì tạo mới.
- Không tự nhập discount ngoài bảng giá Lumira. Ưu đãi tối đa `100.000đ / gói` đã được khóa sẵn trong hệ thống.

**Theo dõi order đến cuối:**

- Gửi duyệt từ `DRAFT` khi order đã sạch.
- Theo dõi phản hồi: `APPROVED`, `NEEDS_INFO`, reject, cancel.
- Sau khi order được duyệt, kiểm tra `Invoices` và `Students` để đảm bảo downstream đã sinh đúng.

---

## 6. Test trải nghiệm — không phải học thử

Lumira không có học thử. Quy trình đón học sinh mới:

1. Học sinh đến làm **test trải nghiệm** (đánh giá đầu vào).
2. Sale ghi kết quả assessment vào hệ thống.
3. Sale bàn giao kết quả test cho OPS để xếp lớp phù hợp.
4. Sale **không** tự xếp lớp và **không** tạo session cho học sinh.

Nếu trung tâm dùng chatbot, Sale phải biết tiếp quản hội thoại, tạo lead hoặc order trực tiếp từ `Conversations` mà không mất attribution.

---

## 7. Phối hợp đúng với bộ phận khác

### Với Giám đốc

- Đẩy lên Giám đốc khi: cần ưu đãi ngoài bảng giá, order tranh chấp, ownership lead/parent cần đổi, chính sách ngoại lệ.
- Khi order bị trả lại, Sale phải sửa ngay tại màn hình nguồn — không nhờ Giám đốc duyệt lại để đẩy việc.

### Với OPS

- Sau khi đơn được duyệt, xác nhận đã có đủ dữ liệu cho xếp lớp.
- Nếu cần đổi lịch hoặc đổi giáo viên, tạo yêu cầu chuẩn — không dùng chat riêng.

### Với Kế toán

- Sale không duyệt hóa đơn, nhưng phải cung cấp đúng biên lai, nguồn tiền và ghi chú khi cần.
- Nếu phụ huynh báo đã chuyển tiền, Sale phải đẩy đủ thông tin để Kế toán đối chiếu — không xác nhận bằng miệng.

---

## 8. Mốc thời gian quan trọng

### Trước khai trương

- Chuẩn hóa form thu thập thông tin phụ huynh, học viên, nhu cầu học, nguồn lead.
- Chạy thử lead từ các nguồn chính, test filter, tab follow-up, stale, pool.
- Chạy thử order cho khách mới, khách cũ, case installment, upload chứng từ theo bảng giá Lumira.
- Chạy thử các case `test trải nghiệm` và chốt người chịu trách nhiệm khóa kết quả.

### Ngày khai trương và 3 ngày đầu

- Trước giờ mở cửa: mở `Leads`, `Orders`, `Conversations`, `Notifications`.
- Trong giờ hoạt động: mọi khách mới phải đi qua `Leads` trước — không bỏ qua CRM rồi nhập thẳng order.
- Cuối ngày: danh sách lead chuyển sang ngày mai, khách chưa chốt, lịch test trải nghiệm cần nhắc.

### Hằng ngày sau khai trương

- Mọi cuộc gọi, chat, gặp trực tiếp đều phải có contact log.
- Mọi đơn đã gửi duyệt đều phải được theo đến kết quả cuối.
- Không tự cam kết ưu đãi, discount ngoài bảng giá, hoặc cam kết sai chính sách nghỉ học.

### Hằng tuần và hằng tháng

- Review lead mới, lead stale, tỉ lệ follow-up đúng hạn.
- Review test trải nghiệm, order approved, doanh thu thực thu, hoa hồng.
- Đối chiếu `Commission Report` để phát hiện đơn chưa hoàn thành dòng tiền.

---

## 9. Những điều không được làm

- ❌ Không tạo trùng parent hay student.
- ❌ Không bỏ qua CRM rồi nhập thẳng order nếu không có lý do chính đáng.
- ❌ Không tự xếp lớp, tự phê duyệt invoice hoặc tự chỉnh dữ liệu tài chính.
- ❌ Không để order ở trạng thái `SUBMITTED` mà không theo dõi tiếp.
- ❌ Không tự giảm giá hoặc cam kết ưu đãi ngoài bảng giá Lumira đã khóa.
- ❌ Không gửi cho phụ huynh tài khoản nhận tiền cá nhân.

---

## 10. Cảnh báo cần theo dõi mỗi ngày

| # | Cảnh báo | Ý nghĩa |
|---|---|---|
| 1 | Lead nóng không có log follow-up | Khách bị bỏ sót |
| 2 | Lead stale tăng nhanh | Follow-up không đều |
| 3 | Order chờ duyệt bị treo quá SLA | Nghẽn quy trình hoặc thiếu chứng từ |
| 4 | Khách cũ nhưng đang tạo mới parent / student | Nguy cơ tạo trùng dữ liệu |

---

## 11. Cơ chế lương Sale

- Lương cứng: **8.000.000đ / tháng**.
- Hoa hồng: **3% doanh thu** theo dữ liệu ghi nhận trong `Commission Report`.
- Payroll chốt cho tháng trước, chi trả vào ngày **10** hằng tháng.
- Nếu đơn bị hủy, hoàn tiền hoặc dữ liệu sai đầu vào, hoa hồng có thể bị điều chỉnh — xem cơ chế clawback với Giám đốc.

---

## 12. Tài liệu đọc thêm

| Tài liệu | Đường dẫn |
|---|---|
| Checklist Sale | [checklist-sale.md](../opening-center-checklists/checklist-sale.md) |
| Checklist master | [checklist-opening-center-detailed.md](../checklist-opening-center-detailed.md) |
| Kịch bản Sale chi tiết | [KichBanSale_ChiTiet.md](../KichBanSale_ChiTiet.md) |
| Hub tổng hợp tất cả link | [tong-hop-link-mo-trung-tam.md](../tong-hop-link-mo-trung-tam.md) |
| Tất cả sổ tay | [README.md](./README.md) |
