# Runbook BA07 - Auth, Trials, Attendance

## Mục tiêu batch

Chạy batch nền để xác nhận bảo mật đăng nhập, học thử, chuyển đổi và tính tiền theo attendance vẫn ổn trước khi mở các batch tài chính sâu hơn.

## Phạm vi checklist

- `Nhóm 31`: Đăng nhập, bảo mật & phiên làm việc
- `Nhóm 32`: Học thử & chuyển đổi
- `Nhóm 33`: Điểm danh chi tiết & tính tiền theo phút

## SOP/playbook bắt buộc

- `school-mgmt/docs/operations/HuongDanSuDung_KichBanVanHanh.md`
- `school-mgmt/docs/teacher/HuongDanGiaoVien_ChiTiet.md`
- `school-mgmt/docs/teacher/KichBanKiemThu_GiaoVien.md`
- `school-mgmt/frontend/src/app/components/internal-handbook.playbooks.ts`

## Vai trò cần dùng

- `DIRECTOR`
- `SALE`
- `OPS`
- `TEACHER`
- `PARENT`

## Tiền điều kiện và seed

- Seed user và trial enrollment nền
- Có ít nhất `1` class/session để test attendance
- Có token/link attendance hợp lệ và token lỗi/hết hạn
- Có account để test login rate limit hoặc lockout

## Automation anchor bắt buộc

- `test/security-rbac.e2e-spec.ts`
- `test/data-isolation-rbac.e2e-spec.ts`
- `test/trial-enrollment-conversion.e2e-spec.ts`
- `test/trial-order-propagation.e2e-spec.ts`
- `test/attendance.e2e-spec.ts`
- `scripts/test-attendance-workflow.js`
- `scripts/test-attendance-report-workflow.js`
- `scripts/test-class-attendance-pricing-workflow.js`

## Kịch bản chạy thực tế

1. Test login success/fail, rate limit hoặc lockout, restore session cơ bản.
2. Chạy trial enrollment, convert thành order hoặc stop flow.
3. Chạy attendance theo phút hoặc theo duration config.
4. Test token expiry/public attendance error handling ở backend contract.

## Chuỗi đối soát bắt buộc

- `Auth -> session/cookie or guard behavior -> audit/work session nếu có`
- `Trial -> Enrollment -> Order/Student/Session propagation`
- `Attendance -> Session -> amountCharged/revenue/payroll condition`

## Log và evidence

- Log file: `LOG_BA07_Auth_Trials_Attendance_YYYYMMDD.md`
- Ghi rõ tài khoản và role dùng cho từng ca auth

## Dấu hiệu FAIL phổ biến

- Login endpoint đúng mã nhưng session/guard sai
- Trial convert xong nhưng thiếu enrollment/order side effect
- Attendance ghi nhận được nhưng amountCharged hoặc billing snapshot sai
- Token hết hạn trả mã đúng nhưng vẫn mutate dữ liệu
