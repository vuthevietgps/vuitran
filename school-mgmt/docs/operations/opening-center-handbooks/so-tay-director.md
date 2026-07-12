# 📋 Sổ tay Giám đốc — Lumira English

> **Giám đốc kiểm soát tổng thể, phê duyệt cuối và chịu trách nhiệm cho tăng trưởng doanh thu, chất lượng vận hành lớp học, kiểm soát dòng tiền và kỷ luật dữ liệu của toàn trung tâm.**

**Điều hướng nhanh:** [Hub tổng hợp](../tong-hop-link-mo-trung-tam.md) · [Checklist master](../checklist-opening-center-detailed.md) · [Tất cả sổ tay](./README.md) · [Checklist Director](../opening-center-checklists/checklist-director.md)

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

---

## Mục lục

1. [Sứ mệnh vai trò](#1-sứ-mệnh-vai-trò)
2. [Màn hình Giám đốc cần nắm](#2-màn-hình-giám-đốc-cần-nắm)
3. [Quyết định phải khóa trước go-live](#3-quyết-định-phải-khóa-trước-go-live)
4. [Quy trình làm việc hằng ngày](#4-quy-trình-làm-việc-hằng-ngày)
5. [Nhịp review hằng tuần và hằng tháng](#5-nhịp-review-hằng-tuần-và-hằng-tháng)
6. [Xử lý tình huống thường gặp](#6-xử-lý-tình-huống-thường-gặp)
7. [Những điều không được làm](#7-những-điều-không-được-làm)
8. [Cảnh báo cần theo dõi mỗi ngày](#8-cảnh-báo-cần-theo-dõi-mỗi-ngày)
9. [Tài liệu đọc thêm](#9-tài-liệu-đọc-thêm)

---

## 1. Sứ mệnh vai trò

Giám đốc không làm thay Sale, OPS hay Kế toán. Nhiệm vụ thực sự là:

- **Đọc đúng tín hiệu** từ hệ thống trước khi vấn đề lan rộng.
- **Ra quyết định cuối** cho mọi ngoại lệ vượt quá quyền hạn bộ phận.
- **Giữ kỷ luật dữ liệu** — không cho phép luồng công việc ngoài hệ thống khi hệ thống đã có màn hình tương ứng.
- **Bảo vệ dòng tiền** — mọi con số phải có nguồn gốc trong hệ thống, không dùng báo cáo nói miệng.

**Bốn trục Giám đốc chịu trách nhiệm cuối:**

| Trục | Chỉ số cốt lõi |
|---|---|
| Tăng trưởng | Lead → test trải nghiệm → xếp lớp → doanh thu |
| Chất lượng vận hành | % buổi finalize đúng SLA · % giáo viên nộp report đúng hạn |
| Kiểm soát dòng tiền | Công nợ · hóa đơn treo · reconcile · runway |
| Kỷ luật phê duyệt | SLA order · SLA invoice · thao tác ngoại lệ có audit |

---

## 2. Màn hình Giám đốc cần nắm

| Màn hình | Mục đích sử dụng |
|---|---|
| `Dashboard` | Sức khỏe tổng thể và cảnh báo ưu tiên trong ngày |
| `Pending Approvals` | Xử lý hàng chờ — order, invoice, thay đổi lớp, chi phí |
| `Financial Control` | Dòng tiền, reconcile, P&L, runway, công nợ |
| `Teacher KPI` | Chất lượng đội ngũ giảng dạy theo tuần / tháng |
| `Employee Performance` | So sánh hiệu suất Sale, OPS, Giáo viên |
| `Ads Analytics` | ROI, chi phí / lead, profit campaign |
| `Calendar Overview` | Tải vận hành theo thời gian — lịch lớp, lịch giáo viên |
| `Audit Log` | Kiểm tra thao tác nhạy cảm — ai sửa gì, khi nào |
| `Users / Orders / Invoices` | Chi tiết khi cần giải quyết ngoại lệ |
| `Bank Accounts / Funds / Loans` | Tài khoản nhận tiền và kiểm soát nguồn vốn |

> **Nguyên tắc đọc màn hình:** Luôn đọc `Dashboard` tổng quan trước. Sau đó mới vào màn hình chi tiết theo thứ tự ưu tiên đã xác định. Không nhảy vào xử lý từng case lẻ khi chưa biết bức tranh lớn của ngày.

---

## 3. Quyết định phải khóa trước go-live

### 3.1. Người duyệt và quyền hạn

- Chỉ định rõ Giám đốc chính và người duyệt dự phòng khi vắng mặt.
- Khóa quyền duyệt cuối cho: order, invoice, top-up, payroll, chi phí lớn, khoản vay, thay đổi lớp / giáo viên.
- Chốt ngưỡng bộ phận được tự xử lý so với ngưỡng phải đẩy lên Giám đốc.
- **Quy tắc Lumira:** Sale không được tự giảm giá. Mọi ưu đãi ngoài bảng giá là ngoại lệ Giám đốc phải phê duyệt.

### 3.2. SLA phê duyệt

| Hành động | SLA cảnh báo |
|---|---|
| Order chờ duyệt | > 4 giờ làm việc |
| Invoice chờ duyệt | > 1 ngày |
| Thay đổi lớp / giáo viên | > 24 giờ từ khi có yêu cầu |
| Ticket phụ huynh phản ánh | > 48 giờ |

### 3.3. Quy tắc tài chính cần khóa

- Chốt tài khoản nhận tiền chính thức trong `Financial Control → Bank Accounts`.
- Chốt quy ước nội dung chuyển khoản cho học phí, hoàn tiền, góp vốn, trả nợ.
- Chốt nguyên tắc tách ba loại tiền: **doanh thu vận hành · vốn góp chủ sở hữu · khoản vay/ứng vốn**.
- Xác nhận ngày payroll là ngày **10** và công thức lương từng nhóm đã đúng.

### 3.4. KPI và lịch review

- KPI phải lấy từ hệ thống — không từ file tổng hợp thủ công bên ngoài.
- Khóa lịch review: cuối ngày (15 phút), cuối tuần, cuối tháng.
- Khóa phễu đo: `lead → test trải nghiệm → xếp lớp → doanh thu`.

---

## 4. Quy trình làm việc hằng ngày

### Đầu ngày — 15 phút

1. Mở `Dashboard` — đọc cảnh báo, chưa vào giải quyết chi tiết ngay.
2. Kiểm tra `Pending Approvals` — hàng chờ nào ảnh hưởng doanh thu, tiền mặt, lớp học?
3. Kiểm tra `Financial Control` — cảnh báo giao dịch, quỹ dưới ngưỡng, đối soát treo, nợ vay đến hạn.
4. Chốt **3–5 đầu việc ưu tiên trong ngày** và giao rõ owner cho từng việc.
5. Xác nhận lịch học Lumira tuần này đang chạy đúng nhịp `1 buổi/tuần · 2 giờ 15 phút`.

### Giữa ngày

1. Quay lại `Pending Approvals` — không để order/invoice/request thay đổi treo quá SLA.
2. OPS báo session treo, lớp sai roster, khan giáo viên → chỉ can thiệp khi ảnh hưởng SLA hoặc chính sách.
3. Sale báo cần ưu đãi ngoài bảng giá, order tranh chấp, ownership bất thường → Giám đốc chốt quyết định.
4. Kế toán báo lệch dòng tiền, invoice không khớp chứng từ, giao dịch chưa reconcile → quyết định theo mức độ rủi ro.

### Cuối ngày — 15–20 phút

1. Họp chốt ngày với bộ phận liên quan.
2. Review: lead mới, order tạo / duyệt, lớp chạy, sự cố phát sinh, doanh thu ghi nhận trong ngày.
3. Xác nhận việc nào đóng trong ngày, việc nào chuyển sang ngày mai và ai là owner.
4. Kiểm tra `Notifications` trước khi thoát phiên.

---

## 5. Nhịp review hằng tuần và hằng tháng

### Hằng tuần

| Nội dung review | Màn hình tham chiếu |
|---|---|
| Hiệu suất giáo viên | `Teacher KPI` |
| Hiệu suất Sale và OPS | `Employee Performance` |
| Lead stale · tỉ lệ test trải nghiệm · tỉ lệ xếp lớp | `Leads` + `Dashboard` |
| Lớp thiếu học viên · buổi chưa finalize · ticket quá SLA | `Calendar Overview` + `Tickets` |
| Công nợ · giao dịch chưa đối soát · top-up treo | `Financial Control` |

### Hằng tháng

- Chốt P&L, burn rate, runway, doanh thu thực thu và lợi nhuận gộp.
- Chốt payroll: xác nhận ngày **10**, công thức lương đúng cho từng nhóm, commission khớp `Commission Report`.
- Review `Audit Log` cho thao tác nhạy cảm.
- Quyết định điều chỉnh nhân sự, chính sách hoặc budget marketing nếu cần.

---

## 6. Xử lý tình huống thường gặp

### Order chờ duyệt quá SLA

→ Xác định lý do tắc: thiếu chứng từ / thiếu thông tin Sale / chờ OPS xếp lớp / chờ tài chính phê duyệt.  
→ Yêu cầu owner bổ sung tại màn hình nguồn. **Không duyệt mơ hồ** để đẩy việc xuống dưới.  
→ Nếu đơn không đạt điều kiện, trả lại rõ lý do để Sale xử lý lại.

### Session đã dạy nhưng chưa finalize

→ Kiểm tra OPS có bỏ sót bước `TEACHER_COMPLETED` hay giáo viên chưa nộp report.  
→ Không ép finalize khi dữ liệu đầu vào chưa sạch.  
→ Nếu tồn đọng lặp lại, đưa vào review tuần để sửa SOP.

### Công nợ tăng nhưng vẫn xếp lớp vào học

→ Kiểm tra rule gate tài chính có đang bị bỏ qua không.  
→ Kiểm tra Sale bàn giao không đầy đủ hay OPS cho học viên vào lớp khi invoice chưa đạt điều kiện.  
→ Chốt lại ngưỡng được vào lớp và owner chịu trách nhiệm.

### Hiệu suất bộ phận lệch nhau bất thường

→ Dùng `Employee Performance + Commission Report + Teacher KPI + Calendar Overview` để tìm nguồn gốc lệch.  
→ Không kết luận từ một chỉ số đơn lẻ.  
→ Yêu cầu bộ phận xử lý từ màn hình nguồn, không tự chỉnh tay ở file bên ngoài.

---

## 7. Những điều không được làm

- ❌ Không duyệt để giảm hàng chờ khi chưa rõ nguồn dữ liệu.
- ❌ Không dùng tài khoản chung cho cổ đông, quản lý cá nhân hoặc nhân sự thay thế.
- ❌ Không cho phép bộ phận tạo luồng ngoài hệ thống khi hệ thống đã có màn hình tương ứng.
- ❌ Không chốt thưởng, phạt, doanh thu hay chi phí dựa trên báo cáo nói miệng hoặc chat riêng.
- ❌ Không phê duyệt ưu đãi giảm giá ngoài bảng giá Lumira mà không có biên bản kinh doanh chính thức.

---

## 8. Cảnh báo cần theo dõi mỗi ngày

| # | Cảnh báo | Ý nghĩa |
|---|---|---|
| 1 | Lead quá hạn follow-up tăng liên tục | Sale không chạm lead đúng SLA |
| 2 | Order chờ duyệt > 24 giờ làm việc | Nghẽn quy trình hoặc thiếu chứng từ |
| 3 | Invoice chờ duyệt > 1 ngày | Kế toán tắc hoặc Sale thiếu biên lai |
| 4 | Session đã dạy nhưng chưa finalize cuối ngày | Giáo viên chưa nộp report hoặc OPS bỏ sót |

---

## 9. Tài liệu đọc thêm

| Tài liệu | Đường dẫn |
|---|---|
| Checklist Director | [checklist-director.md](../opening-center-checklists/checklist-director.md) |
| Checklist master mở trung tâm | [checklist-opening-center-detailed.md](../checklist-opening-center-detailed.md) |
| Kịch bản Director thuyết trình | [KichBanVideo_Director_ThuyetTrinh.md](../KichBanVideo_Director_ThuyetTrinh.md) |
| Hub tổng hợp tất cả link | [tong-hop-link-mo-trung-tam.md](../tong-hop-link-mo-trung-tam.md) |
| Tất cả sổ tay | [README.md](./README.md) |
