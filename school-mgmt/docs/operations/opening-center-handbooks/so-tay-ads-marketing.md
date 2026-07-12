# 📣 Sổ tay Ads / Marketing — Lumira English

> **Ads/Marketing chịu trách nhiệm cho chất lượng đầu vào lead, hiệu quả chi phí theo profit thực tế và tính liên tục của attribution từ chatbot đến CRM — không chỉ tối ưu theo lead count hay spend.**

**Điều hướng nhanh:** [Hub tổng hợp](../tong-hop-link-mo-trung-tam.md) · [Checklist master](../checklist-opening-center-detailed.md) · [Tất cả sổ tay](./README.md) · [Checklist Ads / Marketing](../opening-center-checklists/checklist-ads-marketing.md)

---

## Thông tin nhanh

| Nội dung | Giá trị |
|---|---|
| Thương hiệu | lumiraEnglish.com |
| Sản phẩm | Lớp online · 1 giáo viên · nhiều học sinh |
| Nhịp học | 1 buổi / tuần · 2 giờ 15 phút / buổi |
| Học phí | 160.000đ / học sinh / buổi |
| Gói học | 20 · 40 · 60 · 100 buổi |
| Thông điệp chính | **Giao tiếp trôi chảy** |
| Không học thử | Phiếu conversion trung gian là **test trải nghiệm** |
| Phễu đo | lead → test trải nghiệm → xếp lớp → doanh thu |

---

## Mục lục

1. [Sứ mệnh vai trò](#1-sứ-mệnh-vai-trò)
2. [Màn hình Ads/Marketing được cấp quyền](#2-màn-hình-adsmarketing-được-cấp-quyền)
3. [Quy trình làm việc hằng ngày](#3-quy-trình-làm-việc-hằng-ngày)
4. [Cách đọc đúng từng màn hình](#4-cách-đọc-đúng-từng-màn-hình)
5. [Phễu chuyển đổi và cách đo hiệu quả thực](#5-phễu-chuyển-đổi-và-cách-đo-hiệu-quả-thực)
6. [Thông điệp và creative — Giao tiếp trôi chảy](#6-thông-điệp-và-creative--giao-tiếp-trôi-chảy)
7. [Phối hợp với Sale và Giám đốc](#7-phối-hợp-với-sale-và-giám-đốc)
8. [Công việc cần khóa trước go-live](#8-công-việc-cần-khóa-trước-go-live)
9. [Những điều không được làm](#9-những-điều-không-được-làm)
10. [Cảnh báo cần theo dõi](#10-cảnh-báo-cần-theo-dõi)
11. [Tài liệu đọc thêm](#11-tài-liệu-đọc-thêm)

---

## 1. Sứ mệnh vai trò

Ads/Marketing chịu trách nhiệm cho 3 mục tiêu:

1. **Chất lượng lead đầu vào** — lead phải đủ thông tin và có nhu cầu thật, không chỉ cần số lượng.
2. **Hiệu quả chi phí theo profit thực tế** — đọc ROI theo doanh thu ghi nhận, không chỉ theo lead count hay spend.
3. **Attribution liên tục** — fanpage, chatbot và CRM phải nói cùng ngôn ngữ attribution để Sale tiếp quản không mất dấu vết.

---

## 2. Màn hình Ads/Marketing được cấp quyền

| Màn hình | URL | Mục đích |
|---|---|---|
| Ads Management | `/app/ads-management` | Quản lý tài khoản, ad group, trạng thái campaign |
| Ads Analytics | `/app/ads-analytics` | Đọc profit, ROI, chi phí / lead theo nhóm |
| Chatbot Settings | `/app/chatbot-settings` | Cài đặt chatbot, fanpage, auto-reply |

Role `ADSMANAGER` **không được:**
- Tạo / xóa tài khoản quảng cáo gốc.
- Quản lý thư viện token gốc.
- Nhập / xóa chi phí thủ công nếu không có quyền phù hợp.
- Chạy sync hệ thống hoặc backfill dữ liệu.
- Vào các module tài chính, audit, user management ngoài phạm vi ads / chatbot.

---

## 3. Quy trình làm việc hằng ngày

### Đầu ngày

1. Vào `Ads Management`.
2. Xem tài khoản nào đang active.
3. Xem group nào đang chạy, tạm dừng hoặc có dấu hiệu bất thường.
4. Ghi ra nhóm campaign cần theo dõi trong ngày.

### Giữa ngày

1. Vào `Ads Analytics`.
2. Lọc theo khoảng ngày, nền tảng, ad group.
3. Đọc 3 lớp dữ liệu theo thứ tự:
   - **Cohort profit** — hiệu quả theo nhóm thời gian.
   - **Parent profit** — chất lượng phụ huynh từ nguồn này.
   - **ROI hoặc lợi nhuận theo nhóm** — nhóm nào tạo profit thật, nhóm nào đang hòa vốn hoặc lỗ.
4. Đối chiếu với thông tin lead chất lượng từ Sale nếu thấy nguồn bất thường.

### Cuối ngày

1. Nếu cần sửa group hoặc tracking, quay lại `Ads Management`.
2. Nếu cần sửa fanpage hoặc chatbot, vào `Chatbot Settings`.
3. Sau mỗi thay đổi, rà soát lại tracking key, liên kết fanpage và attribution.
4. Ghi chú nội bộ nếu thay đổi có ảnh hưởng đến đo lường.

---

## 4. Cách đọc đúng từng màn hình

### Ads Management

Dùng để:
- Rà trạng thái group (active / paused / flagged).
- Xem chi phí hiện tại.
- Đọc danh sách việc cần làm (tab cảnh báo nếu có).
- Sửa thông tin group trong phạm vi được mở.

> **Nguyên tắc:** Ưu tiên đọc tab cảnh báo và việc cần làm trước khi sửa campaign lớn.

### Ads Analytics

Dùng để trả lời các câu hỏi:

- Nhóm nào tạo **profit thật**, không chỉ tạo lead rẻ?
- Nhóm nào đang hòa vốn hoặc lỗ?
- Nguồn nào đang tạo parent quality tốt?
- Nên tiếp tục theo dõi hay yêu cầu Giám đốc ra quyết định budget?

### Chatbot Settings

Dùng để:
- Kiểm tra fanpage đang gắn đúng tài khoản.
- Kiểm tra token đang gắn và auto-reply đang chạy.
- Cập nhật config chatbot trong phạm vi được cấp quyền.

> Nếu cần token mới hoặc thay đổi nhạy cảm ở thư viện token, phải báo Giám đốc trước khi thực hiện.

---

## 5. Phễu chuyển đổi và cách đo hiệu quả thực

Lumira không có học thử. Phễu chuyển đổi trung gian là **test trải nghiệm**:

```
Lead (từ quảng cáo / chatbot / fanpage)
  ↓  Sale tiếp quản và chạm lead
Test trải nghiệm (Giáo viên trải nghiệm dẫn)
  ↓  Kết quả assessment
Xếp lớp + Order approved
  ↓
Doanh thu ghi nhận
```

**Khi đọc hiệu quả campaign, phải đối chiếu cả 4 bước** — không chỉ đọc lead count hoặc cost per lead:

| Bước | Chỉ số cần theo dõi |
|---|---|
| Lead | Số lượng, chất lượng (có số điện thoại, có nhu cầu thật) |
| Test trải nghiệm | Tỉ lệ lead → test TN (cho thấy Sale có đang tiếp quản đúng không) |
| Xếp lớp | Tỉ lệ test TN → order approved (cho thấy sản phẩm có phù hợp không) |
| Doanh thu | Doanh thu thực thu từ nhóm lead này (cho thấy profit thật) |

---

## 6. Thông điệp và creative — Giao tiếp trôi chảy

Thông điệp chính của Lumira là **"Giao tiếp trôi chảy"**. Tất cả creative, landing page và chatbot script phải:

- Đặt cam kết này ở vị trí nổi bật.
- Không hứa hẹn học thử miễn phí — Lumira không có học thử.
- Thay vào đó, mời học sinh đến làm **test trải nghiệm** để được đánh giá và xếp lớp phù hợp.
- Nhấn mạnh mô hình phù hợp: lớp online, 1 buổi / tuần, 2 giờ 15 phút, giáo viên chuyên dạy kỹ năng giao tiếp.

---

## 7. Phối hợp với Sale và Giám đốc

### Với Sale

- Bàn giao rõ source, campaign, ad group, ghi chú chất lượng lead.
- Khi Sale báo lead rác tăng, Ads phải đối chiếu lại theo group — không tranh luận bằng cảm giác.
- Attribution phải khớp giữa `Ads Analytics` và `Leads` trong CRM. Nếu lệch, tìm điểm đứt trong chuỗi fanpage → chatbot → CRM.

### Với Giám đốc

- Đẩy lên Giám đốc các thay đổi budget vượt ngưỡng hoặc thay đổi tracking ảnh hưởng rộng.
- Giám đốc đọc `Ads Analytics` từ góc nhìn đầu tư; Ads Manager đọc từ góc nhìn vận hành campaign. Cần dùng chung một hệ quy chiếu dữ liệu.

---

## 8. Công việc cần khóa trước go-live

- Chốt danh mục **source chuẩn** để CRM, `Leads` và `Ads` dùng cùng ngôn ngữ.
- Chốt quy tắc bàn giao campaign / ad group / tracking cho Sale.
- Chốt fanpage nào gắn với tài khoản nào.
- Chốt ai được phép thay đổi config chatbot, ai được phép đề xuất budget.

---

## 9. Những điều không được làm

- ❌ Không tối ưu dựa trên spend và lead count thuần túy — phải đọc đến profit.
- ❌ Không sửa tracking key nếu chưa hiểu tác động đến landing / chatbot / CRM.
- ❌ Không dùng quyền role Ads để can thiệp vào user, tài chính hoặc audit.
- ❌ Không thay đổi config chatbot mà không ghi chú ảnh hưởng đến đo lường.

---

## 10. Cảnh báo cần theo dõi

| # | Cảnh báo | Ý nghĩa |
|---|---|---|
| 1 | Chi phí tăng đột ngột nhưng profit không theo kịp | Nhóm đang tạo lead kém chất lượng |
| 2 | Parent profit lệch xấu dù lead count vẫn đẹp | Lead đang đến từ đối tượng không phù hợp |
| 3 | Fanpage / chatbot vừa đổi config nhưng Sale báo mất attribution | Chuỗi fanpage → chatbot → CRM đang đứt ở đâu đó |

---

## 11. Tài liệu đọc thêm

| Tài liệu | Đường dẫn |
|---|---|
| Checklist Ads / Marketing | [checklist-ads-marketing.md](../opening-center-checklists/checklist-ads-marketing.md) |
| Checklist master | [checklist-opening-center-detailed.md](../checklist-opening-center-detailed.md) |
| Hướng dẫn Ads Manager chi tiết | [HuongDanAdsManager_ChiTiet.md](../../adsmanager/HuongDanAdsManager_ChiTiet.md) |
| Hub tổng hợp tất cả link | [tong-hop-link-mo-trung-tam.md](../tong-hop-link-mo-trung-tam.md) |
| Tất cả sổ tay | [README.md](./README.md) |
