# Runbook BA02 - OPEX, Wallets, Refunds, Offline Economics

## Mục tiêu batch

Xác nhận các luồng chi phí vận hành, điều chỉnh ví, hoàn tiền, rollback và logic lớp offline không làm lệch số dư hay trạng thái tài chính.

## Phạm vi checklist

- `Nhóm 4`: Chi phí vận hành & marketing
- `Nhóm 5`: Chuyển tiền, điều chỉnh thủ công & đối soát
- `Nhóm 6`: Hoàn tiền & rollback
- `Nhóm 7`: Nghiệp vụ lớp offline phức tạp

## SOP/playbook bắt buộc

- `school-mgmt/docs/operations/HuongDanSuDung_KichBanVanHanh.md`
- `school-mgmt/docs/teacher/HuongDanGiaoVien_ChiTiet.md`
- `school-mgmt/frontend/src/app/components/internal-handbook.playbooks.ts`

## Vai trò cần dùng

- `ACCOUNTING`
- `DIRECTOR`
- `OPS`
- `PARENT`
- `TEACHER`

## Tiền điều kiện và seed

- Chạy `node scripts/seed-all.js`
- Đảm bảo có:
  - `1` expense chờ duyệt
  - `1` top-up pending
  - `1` invoice đã approve để test rollback/refund
  - `1` lớp offline có dữ liệu attendance và payroll
  - `1` case cần min payout guarantee hoặc exclude payroll

## Automation anchor bắt buộc

- `test/group4-opex-marketing.e2e-spec.ts`
- `test/group5-wallets-adjustments.e2e-spec.ts`
- `test/group6-refunds-offline.e2e-spec.ts`
- `test/group7-change-requests-reconciliation.e2e-spec.ts`
- `test/payroll.e2e-spec.ts`
- `test/scenario4-payroll-fund-fluctuation.e2e-spec.ts`
- `scripts/test-expenses-workflow.js`
- `scripts/test-wallet-topup-workflow.js`
- `scripts/test-staff-payroll-workflow.js`
- `scripts/test-teacher-payroll-ops-scenarios.js`

## Kịch bản chạy thực tế

1. Duyệt và thanh toán expense.
2. Approve/reject top-up, transfer wallet và manual adjustment.
3. Hủy invoice đã approve và kiểm tra rollback.
4. Chạy hoàn tiền toàn phần hoặc partial refund.
5. Xác nhận offline economics: attendance, guarantee, exclude, payroll hold.

## Chuỗi đối soát bắt buộc

- `Expense -> Ledger/Fund -> Financial Control`
- `Top-up/Transfer -> Wallet balance -> Ledger -> History`
- `Refund/Rollback -> Invoice status -> Wallet -> Ledger -> Related ticket/order nếu có`
- `Offline class -> Attendance -> Session -> Payroll preview/detail`

## Log và evidence

- Log file: `LOG_BA02_Opex_Wallets_Refunds_Offline_YYYYMMDD.md`
- Ghi rõ role chạy từng case
- Ghi rõ nguồn tiền bị ảnh hưởng khi rollback/refund

## Dấu hiệu FAIL phổ biến

- Balance ví đúng nhưng ledger sai loại entry
- Refund thành công nhưng invoice/session không phản ánh trạng thái mới
- Offline payroll không tách rõ guarantee, penalty, exclude
- Adjustment hoặc transfer bỏ qua RBAC
