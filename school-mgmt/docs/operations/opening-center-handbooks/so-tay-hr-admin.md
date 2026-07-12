# 👥 Sổ tay HCNS / Admin — Lumira English

> **HCNS/Admin là đầu mối quản lý vòng đời nhân sự và kỷ luật tài khoản trong hệ thống — onboard đúng, cấp đúng quyền, offboard kịp thời và payroll sạch vào ngày 10.**

**Điều hướng nhanh:** [Hub tổng hợp](../tong-hop-link-mo-trung-tam.md) · [Checklist master](../checklist-opening-center-detailed.md) · [Tất cả sổ tay](./README.md) · [Checklist HCNS / Admin](../opening-center-checklists/checklist-hr-admin.md)

---

## Thông tin nhanh — Cấu trúc nhân sự Lumira

| Nhóm nhân sự | Cơ cấu lương |
|---|---|
| Sale | 8.000.000đ / tháng + 3% doanh thu |
| Giáo viên trải nghiệm | 7.000.000đ / tháng + 0,5% doanh thu + 5.000đ / ca test |
| Giáo viên giảng dạy | 250.000đ / ca 2h15 · không lương cứng |
| Các nhóm khác | Theo hợp đồng / thỏa thuận riêng |
| Ngày payroll | Ngày **10** hằng tháng cho dữ liệu tháng trước |

---

## Mục lục

1. [Sứ mệnh vai trò](#1-sứ-mệnh-vai-trò)
2. [Phân biệt 3 nhóm nhân sự cần nắm rõ](#2-phân-biệt-3-nhóm-nhân-sự-cần-nắm-rõ)
3. [Dữ liệu HCNS/Admin phải quản lý](#3-dữ-liệu-hcnsadmin-phải-quản-lý)
4. [Quy trình onboard nhân sự mới](#4-quy-trình-onboard-nhân-sự-mới)
5. [Quy trình offboard hoặc chuyển vị trí](#5-quy-trình-offboard-hoặc-chuyển-vị-trí)
6. [Theo dõi Work Sessions và chấm công](#6-theo-dõi-work-sessions-và-chấm-công)
7. [Nguyên tắc phân quyền phải giữ](#7-nguyên-tắc-phân-quyền-phải-giữ)
8. [Nhịp làm việc hằng ngày](#8-nhịp-làm-việc-hằng-ngày)
9. [Phối hợp đúng với Giám đốc và bộ phận khác](#9-phối-hợp-đúng-với-giám-đốc-và-bộ-phận-khác)
10. [Những điều không được làm](#10-những-điều-không-được-làm)
11. [Cảnh báo cần theo dõi](#11-cảnh-báo-cần-theo-dõi)
12. [Tài liệu đọc thêm](#12-tài-liệu-đọc-thêm)

---

## 1. Sứ mệnh vai trò

HCNS/Admin là đầu mối quản lý vòng đời nhân sự và kỷ luật tài khoản trong hệ thống, bao gồm:

- **Onboard** nhân sự mới — cấp tài khoản và gán đúng role.
- **Quản lý hồ sơ cơ bản** — thông tin liên hệ, bộ phận, vai trò, ghi chú bàn giao.
- **Theo dõi hiện diện** — `Work Sessions` và các bất thường check-in / check-out.
- **Offboard / chuyển vị trí** — thu hồi quyền đúng thời điểm.
- **Phối hợp với Giám đốc** để giữ cho phân quyền hệ thống sạch và đúng thực tế.

---

## 2. Phân biệt 3 nhóm nhân sự cần nắm rõ

Lumira có 3 nhóm nhân sự có cơ chế lương khác nhau. HCNS/Admin phải khởi tạo đúng role và đúng quy tắc payroll cho từng nhóm:

| Nhóm | Role trong hệ thống | Cơ chế lương |
|---|---|---|
| Sale | `SALE` | 8.000.000đ + 3% doanh thu |
| Giáo viên trải nghiệm | `TEACHER_TRIAL` (hoặc role tương ứng) | 7.000.000đ + 0,5% doanh thu + 5.000đ / ca test |
| Giáo viên giảng dạy | `TEACHER` (hoặc role tương ứng) | 250.000đ / ca 2h15 finalize hợp lệ |

> **Lưu ý:** Nếu thiết lập sai role cho giáo viên (ví dụ gán `TEACHER` thay vì `TEACHER_TRIAL`), hệ thống sẽ tính lương theo công thức sai. Phải xác nhận với Giám đốc và Kế toán trước khi hoàn tất onboard.

---

## 3. Dữ liệu HCNS/Admin phải quản lý

### Tài khoản và phân quyền

| Trường | Nội dung |
|---|---|
| Tên nhân sự | Họ tên thật, không dùng nickname |
| Email / login | Email công ty hoặc cá nhân theo quy ước |
| Role hiện tại | Đúng với vị trí đang đảm nhận |
| Trạng thái | `active` / `inactive` |
| Ngày kích hoạt | Ngày onboard thực tế |
| Owner phê duyệt | Người có quyền phê duyệt thay đổi role cho nhân sự này |

### Hồ sơ cơ bản

- Thông tin liên hệ (số điện thoại, email cá nhân dự phòng).
- Bộ phận và vai trò.
- Ghi chú bàn giao nếu thế chân nhân sự cũ.

### Work Sessions

- Giờ đăng nhập, giờ đăng xuất.
- Case đi muộn, case auto-close.
- Case check-in / check-out bất thường.

---

## 4. Quy trình onboard nhân sự mới

1. Nhận phê duyệt role từ Giám đốc — **không cấp tài khoản khi chưa có phê duyệt**.
2. Tạo tài khoản đúng role, đúng bộ phận.
3. Giao thông tin đăng nhập theo quy trình nội bộ (không gửi mật khẩu qua kênh không bảo mật).
4. Yêu cầu nhân sự đăng nhập và đổi mật khẩu ngay nếu quy trình bắt buộc.
5. Xác nhận menu hiển thị đúng role — không lộ module ngoài quyền.
6. Ghi nhận ngày kích hoạt và role vào file tổng hợp tài khoản.

**Với nhân sự giáo viên:** Phải xác nhận rõ thuộc nhóm **giáo viên trải nghiệm** hay **giáo viên giảng dạy** trước khi hoàn tất onboard, vì ảnh hưởng đến công thức lương.

---

## 5. Quy trình offboard hoặc chuyển vị trí

1. Nhận xác nhận từ Giám đốc — rõ ngày hiệu lực.
2. **Khóa tài khoản cũ hoặc đổi role đúng thời điểm** — không để trễ.
3. Kiểm tra không còn menu hoặc quyền cũ bị lộ.
4. Cập nhật file tổng hợp tài khoản và ghi ngày thay đổi.
5. Nếu chuyển vị trí: xác nhận role mới và onboard lại theo quy trình bình thường.

---

## 6. Theo dõi Work Sessions và chấm công

`Work Sessions` không chỉ để chấm công. Đây còn là công cụ phát hiện kỷ luật vận hành và lỗi quy trình:

| Dấu hiệu | Ý nghĩa |
|---|---|
| Auto-close nhiều lần | Thói quen không đăng xuất — cần tập huấn lại |
| Check-in / check-out bất thường | Cần đối chiếu với lịch làm việc thực tế |
| Sai role nhưng vẫn login được vào module | Phân quyền có lỗ hổng cần vá ngay |

> **Nguyên tắc:** Không tự kết luận kỷ luật từ một bản ghi đơn lẻ. Phải đối chiếu theo nhóm, theo chu kỳ và theo bộ phận trước khi báo cáo Giám đốc.

---

## 7. Nguyên tắc phân quyền phải giữ

- Mỗi nhân sự dùng một tài khoản riêng — **không dùng chung**.
- Không mở quyền rộng vì tiện mà bỏ qua role thật.
- Mọi thay đổi role phải có dấu vết phê duyệt.
- Tài khoản đã nghỉ việc hoặc chuyển vị trí phải được xử lý đúng hạn.

---

## 8. Nhịp làm việc hằng ngày

### Trước khai trương

1. Tạo đủ tài khoản thật cho Giám đốc, OPS, Sale, Kế toán, Giáo viên và tài khoản hỗ trợ.
2. Đối chiếu người sở hữu thật của mỗi tài khoản.
3. Tập huấn cách đăng nhập, đổi mật khẩu, đăng xuất đúng quy trình.
4. Chốt người duyệt dự phòng trong trường hợp vắng mặt.
5. Chốt rõ nhân sự nào là Sale, GV trải nghiệm, GV giảng dạy để khởi tạo đúng role và quy tắc payroll.

### Hằng ngày sau khai trương

1. Rà các bất thường trong `Work Sessions`.
2. Rà nhân sự mới vào làm, nhân sự chuyển vai trò, nhân sự nghỉ việc.
3. Phối hợp với Giám đốc nếu có tài khoản cần đổi role, khóa quyền hoặc mở quyền bổ sung.
4. **Rà danh sách payroll trước ngày 8 hằng tháng** để chắc chắn nhân sự đã đủ thông tin ngân hàng và role payroll không bị sai trước ngày chi trả ngày 10.

---

## 9. Phối hợp đúng với Giám đốc và bộ phận khác

### Với Giám đốc

- Xin phê duyệt rõ ràng khi mở role, đổi role, khóa quyền.
- Báo ngay nếu có tài khoản cũ chưa khóa, tài khoản sai role hoặc quyền vượt phạm vi.

### Với Giáo viên, OPS, Sale, Kế toán

- Hỗ trợ onboarding tài khoản.
- Ghi nhận bất thường chấm công và đẩy về đúng owner bộ phận để xử lý.
- Không tự nhảy vào thao tác nghiệp vụ của bộ phận khác nếu không nằm trong phạm vi role.

---

## 10. Những điều không được làm

- ❌ Không cấp quyền theo nhờ vả hoặc vì thuận tiện — phải có phê duyệt.
- ❌ Không để tài khoản cũ tiếp tục dùng sau khi nhân sự nghỉ việc.
- ❌ Không bỏ qua bất thường lặp lại ở `Work Sessions`.
- ❌ Không sửa hồ sơ nhân sự nhạy cảm nếu chưa có phê duyệt hoặc log.
- ❌ Không để payroll chạy ngày 10 khi nhân sự chưa có đủ thông tin ngân hàng hoặc role bị sai.

---

## 11. Cảnh báo cần theo dõi

| # | Cảnh báo | Hành động |
|---|---|---|
| 1 | Nhân sự chuyển vị trí nhưng role cũ chưa được thu hồi | Xử lý ngay, báo Giám đốc |
| 2 | Tài khoản nhân sự nghỉ việc chưa bị khóa | Khóa ngay, ghi log |
| 3 | Nhóm nhân sự có nhiều case auto-close hoặc check-in / check-out bất thường | Đối chiếu và tổng hợp cho Giám đốc |
| 4 | Sắp đến ngày 8 nhưng danh sách payroll vẫn có nhân sự thiếu thông tin ngân hàng | Liên hệ nhân sự bổ sung gấp |

---

## 12. Tài liệu đọc thêm

| Tài liệu | Đường dẫn |
|---|---|
| Checklist HCNS / Admin | [checklist-hr-admin.md](../opening-center-checklists/checklist-hr-admin.md) |
| Checklist master | [checklist-opening-center-detailed.md](../checklist-opening-center-detailed.md) |
| Hub tổng hợp tất cả link | [tong-hop-link-mo-trung-tam.md](../tong-hop-link-mo-trung-tam.md) |
| Tất cả sổ tay | [README.md](./README.md) |
